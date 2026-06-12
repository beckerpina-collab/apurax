import { Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { ClsService } from 'nestjs-cls';
import { NfeService } from '../fiscal/nfe.service';
import { PrismaService } from '../prisma/prisma.service';
import { BlingTokenService } from './bling-token.service';
import {
  type BlingInvoice,
  BlingApiError,
  blingDate,
  buildBlingAuthUrl,
  exchangeBlingCode,
  getInvoice,
  listInvoices,
  mapInvoiceToSaida,
} from './bling.client';
import { assinaturaValida, parseEventoNfe } from './bling.webhook';

const PAGE = 100;
const MAX_NOTAS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class BlingService {
  private readonly logger = new Logger(BlingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly token: BlingTokenService,
    private readonly nfe: NfeService,
    private readonly cls: ClsService,
    private readonly config: ConfigService,
  ) {}

  /** URL de autorização OAuth. Cria o `state` (CSRF) amarrado à empresa. */
  async authUrl(empresaId: string): Promise<{ authorization_url: string }> {
    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) throw new Error('Empresa não encontrada para este tenant.');
    const { clientId } = this.token.creds();
    const state = randomUUID();
    // bling_oauth_state fica FORA da RLS (callback é público) → cliente base.
    await this.prisma.blingOAuthState.create({
      data: { tenantId: this.prisma.tenantId, empresaId, state },
    });
    return { authorization_url: buildBlingAuthUrl(clientId, state) };
  }

  /** Callback PÚBLICO do Bling. Consome o state, troca o code e grava os tokens.
   *  Retorna a URL do app para onde redirecionar (sucesso ou erro). */
  async handleCallback(code: string | undefined, state: string | undefined, oauthError?: string): Promise<string> {
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    const back = (qs: string) => `${appUrl}/bling?${qs}`;
    if (oauthError) return back(`bling=erro&motivo=${encodeURIComponent(oauthError)}`);
    if (!code || !state) return back('bling=erro&motivo=code_ou_state_ausente');

    const st = await this.prisma.blingOAuthState.findUnique({ where: { state } });
    if (!st) return back('bling=erro&motivo=state_invalido');
    await this.prisma.blingOAuthState.delete({ where: { state } }).catch(() => undefined); // uso único

    try {
      const { clientId, clientSecret, redirectUri } = this.token.creds();
      const tok = await exchangeBlingCode({ clientId, clientSecret, code, redirectUri });
      await this.token.salvar(st.tenantId, st.empresaId, tok);
      return back('bling=conectado');
    } catch (e) {
      return back(`bling=erro&motivo=${encodeURIComponent((e as Error).message.slice(0, 80))}`);
    }
  }

  status(empresaId: string) {
    return this.token.statusConexao(this.prisma.tenantId, empresaId);
  }

  /** Lista as NF-e de SAÍDA do período (base do imposto a pagar). */
  async puxarSaidas(empresaId: string, dataInicial: string, dataFinal: string) {
    const access = await this.token.accessToken(this.prisma.tenantId, empresaId);
    const notas = await this.coletarSaidas(access, dataInicial, dataFinal);
    await this.token.marcarSync(this.prisma.tenantId, empresaId).catch(() => undefined);

    const mapeadas = notas.map(mapInvoiceToSaida);
    return {
      periodo: `${dataInicial} a ${dataFinal}`,
      totalNotas: mapeadas.length,
      totalValor: mapeadas.reduce((s, n) => s + n.valor, 0),
      notas: mapeadas,
      observacao:
        'Notas de saída listadas do Bling. Os valores de imposto saem da apuração após importar o XML (use "Importar para apuração").',
    };
  }

  /** Importa o XML de cada NF de saída do período como DocumentoFiscal SAIDA (via
   *  NfeService.importarSaida) — é o que alimenta o débito de /apuracao. */
  async importarSaidas(empresaId: string, dataInicial: string, dataFinal: string, usuarioId: string) {
    const access = await this.token.accessToken(this.prisma.tenantId, empresaId);
    const notas = await this.coletarSaidas(access, dataInicial, dataFinal);

    let importadas = 0;
    let semXml = 0;
    const erros: string[] = [];
    for (let i = 0; i < notas.length; i++) {
      if (i > 0) await sleep(450); // rate limit ~3 req/s
      try {
        const nf = await getInvoice(access, notas[i].id);
        const xml = normalizarXml(nf.xml);
        if (!xml) {
          semXml += 1;
          continue;
        }
        await this.nfe.importarSaida(empresaId, xml, usuarioId);
        importadas += 1;
      } catch (e) {
        erros.push(`nota ${notas[i].id}: ${(e as Error).message}`);
      }
    }

    await this.token.marcarSync(this.prisma.tenantId, empresaId).catch(() => undefined);
    return {
      total: notas.length,
      importadas,
      semXml,
      erros: erros.slice(0, 10),
      observacao:
        'Saídas importadas como documentos fiscais. Rode /apuracao/{icms,ipi,pis-cofins} para o imposto a pagar da competência. [Campo xml do Bling: validar formato — cru ou base64.]',
    };
  }

  // ----- Webhook (PÚBLICO) ---------------------------------------------------

  /** Processa um webhook do Bling. Valida a assinatura HMAC do corpo CRU; em
   *  evento de NF-e, resolve o dono por prova de posse e importa como saída. */
  async handleWebhook(raw: string, signature: string | undefined): Promise<{ ok: boolean }> {
    const secret = this.token.clientSecret();
    if (!secret) {
      this.logger.error('Webhook Bling sem BLING_CLIENT_SECRET — recusando.');
      throw new InternalServerErrorException('Webhook do Bling não configurado.');
    }
    if (!assinaturaValida(secret, raw, signature)) {
      throw new UnauthorizedException('Assinatura do webhook inválida.');
    }
    const ev = parseEventoNfe(raw);
    if (ev) {
      try {
        await this.processarInvoice(ev.invoiceId);
      } catch (e) {
        this.logger.error(`webhook invoice ${ev.invoiceId}: ${(e as Error).message}`);
      }
    }
    return { ok: true };
  }

  /** Resolve a conexão dona da NF por PROVA DE POSSE (o token só enxerga notas
   *  da própria empresa no Bling) e importa o XML como saída. */
  private async processarInvoice(invoiceId: number | string): Promise<void> {
    const conexoes = await this.token.listarAtivas();
    for (const cx of conexoes) {
      let access: string;
      try {
        access = await this.token.accessTokenDaConexao(cx);
      } catch {
        continue; // token morto p/ esta conexão → próxima
      }
      let nf: BlingInvoice;
      try {
        nf = await getInvoice(access, invoiceId);
      } catch (e) {
        if (e instanceof BlingApiError && (e.status === 404 || e.status === 403)) continue; // não é desta conta
        this.logger.warn(`webhook getInvoice ${invoiceId}: ${(e as Error).message}`);
        continue;
      }
      const xml = normalizarXml(nf.xml);
      if (xml) {
        await this.cls.run(async () => {
          this.cls.set('tenantId', cx.tenantId);
          await this.nfe
            .importarSaida(cx.empresaId, xml)
            .catch((e) => this.logger.warn(`webhook importarSaida: ${(e as Error).message}`));
        });
      }
      await this.token.marcarSync(cx.tenantId, cx.empresaId).catch(() => undefined);
      return; // dono encontrado
    }
    this.logger.warn(`webhook: nenhuma conexão dona da NF ${invoiceId}`);
  }

  // ----- internos ------------------------------------------------------------

  /** Coleta as NF de saída do período (paginado, respeitando o rate limit). */
  private async coletarSaidas(access: string, dataInicial: string, dataFinal: string): Promise<BlingInvoice[]> {
    const ini = blingDate(new Date(`${dataInicial}T00:00:00`));
    const fim = blingDate(new Date(`${dataFinal}T23:59:59`));
    const notas: BlingInvoice[] = [];
    let pagina = 1;
    while (notas.length < MAX_NOTAS) {
      if (pagina > 1) await sleep(350);
      const lote = (await listInvoices(access, {
        pagina,
        limite: PAGE,
        tipo: 1,
        dataEmissaoInicial: ini,
        dataEmissaoFinal: fim,
      })) as BlingInvoice[];
      if (!lote?.length) break;
      notas.push(...lote.filter((n) => n?.id != null));
      if (lote.length < PAGE) break;
      pagina += 1;
    }
    return notas.slice(0, MAX_NOTAS);
  }
}

/** O Bling pode devolver o XML cru ou em base64 — normaliza para o XML cru. [INCERTO] */
function normalizarXml(xml: string | undefined): string | null {
  if (!xml) return null;
  if (xml.includes('<')) return xml;
  try {
    const dec = Buffer.from(xml, 'base64').toString('utf8');
    return dec.includes('<') ? dec : null;
  } catch {
    return null;
  }
}
