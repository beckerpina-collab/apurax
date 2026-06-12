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
import { FilaSequencial } from './fila-sequencial';

const PAGE = 100;
const MAX_NOTAS = 500;

@Injectable()
export class BlingService {
  private readonly logger = new Logger(BlingService.name);

  /**
   * Fila ÚNICA de processamento de notas (webhook + importação manual).
   * O webhook só enfileira e responde 200 na hora; a vazão é regida pelo
   * blingLimiter (~2,5 req/s) dentro das chamadas à API. Falha transitória
   * (429/5xx/rede) volta para o fim da fila e re-tenta até 4x.
   */
  private readonly fila = new FilaSequencial((id) => this.processarInvoice(id), {
    maxTentativas: 4,
    atrasoRetryMs: 5000,
    onErro: (id, e, desistiu) =>
      this.logger.warn(`fila NF ${id}: ${e.message}${desistiu ? ' — desistiu após re-tentativas' : ' — vai re-tentar'}`),
  });

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

  /** Callback PÚBLICO do Bling. Consome o state, troca o code e grava os tokens. */
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

  async status(empresaId: string) {
    const s = await this.token.statusConexao(this.prisma.tenantId, empresaId);
    return { ...s, filaPendentes: this.fila.tamanho };
  }

  /** Lista as NF-e de SAÍDA do período (pré-visualização; não baixa XML). */
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
        'Notas de saída listadas do Bling. Use "Importar para apuração" para baixar o XML e alimentar o débito (processa em segundo plano).',
    };
  }

  /**
   * Importação por período → SEGUNDO PLANO. Lista os ids das notas (rápido) e
   * ENFILEIRA cada uma; a resposta volta na hora e o processamento corre na
   * fila, respeitando o limite do Bling. Acompanhe pelo status (filaPendentes)
   * e pela tela Documentos.
   */
  async importarSaidas(empresaId: string, dataInicial: string, dataFinal: string, _usuarioId?: string) {
    const access = await this.token.accessToken(this.prisma.tenantId, empresaId);
    const notas = await this.coletarSaidas(access, dataInicial, dataFinal);

    let enfileiradas = 0;
    for (const nf of notas) {
      if (this.fila.enfileirar(String(nf.id))) enfileiradas += 1;
    }
    await this.token.marcarSync(this.prisma.tenantId, empresaId).catch(() => undefined);

    return {
      total: notas.length,
      enfileiradas,
      jaNaFila: notas.length - enfileiradas,
      filaPendentes: this.fila.tamanho,
      observacao:
        'Importação em segundo plano: as notas entram como documentos de saída conforme a fila avança (~2 notas/segundo, limite do Bling). Acompanhe em Documentos e depois rode /apuracao.',
    };
  }

  // ----- Webhook (PÚBLICO) ---------------------------------------------------

  /** Valida a assinatura HMAC e ENFILEIRA o processamento (responde na hora). */
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
      this.fila.enfileirar(String(ev.invoiceId));
    }
    return { ok: true };
  }

  /**
   * Resolve a conexão dona da NF por PROVA DE POSSE e importa o XML como saída.
   * 404/403 = "não é desta conta" → tenta a próxima conexão. Qualquer outra
   * falha (429/5xx/rede) é LANÇADA para a fila re-tentar — antes, era descartada.
   */
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
        throw e; // 429/5xx/rede → re-tenta via fila
      }
      const xml = normalizarXml(nf.xml);
      if (xml) {
        await this.cls.run(async () => {
          this.cls.set('tenantId', cx.tenantId);
          await this.nfe
            .importarSaida(cx.empresaId, xml)
            .catch((e) => this.logger.warn(`importarSaida NF ${invoiceId}: ${(e as Error).message}`));
        });
      } else {
        this.logger.warn(`NF ${invoiceId} sem XML utilizável na resposta do Bling.`);
      }
      await this.token.marcarSync(cx.tenantId, cx.empresaId).catch(() => undefined);
      return; // dono encontrado
    }
    this.logger.warn(`NF ${invoiceId}: nenhuma conexão dona (404/403 em todas).`);
  }

  // ----- internos ------------------------------------------------------------

  /** Coleta as NF de saída do período (paginado; o blingLimiter rege o ritmo). */
  private async coletarSaidas(access: string, dataInicial: string, dataFinal: string): Promise<BlingInvoice[]> {
    const ini = blingDate(new Date(`${dataInicial}T00:00:00`));
    const fim = blingDate(new Date(`${dataFinal}T23:59:59`));
    const notas: BlingInvoice[] = [];
    let pagina = 1;
    while (notas.length < MAX_NOTAS) {
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
