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
  blingLimiter,
  buildBlingAuthUrl,
  exchangeBlingCode,
  getConsumerInvoice,
  getInvoice,
  listConsumerInvoices,
  listInvoices,
  mapInvoiceToSaida,
} from './bling.client';
import { assinaturaValida, parseEventoNota } from './bling.webhook';
import { BlingFilaService } from './bling-fila.service';
import type { OrigemNota } from './fila-sequencial';
import type { BlingConexao } from '@prisma/client';

const PAGE = 100;
const PREVIEW_MAX = 2000; // teto só da PRÉ-VISUALIZAÇÃO (Listar); a importação não tem teto
const MAX_PAGINAS = 1000; // backstop da varredura em 2º plano (~100 mil notas)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Progresso de uma varredura de período (exposto no status p/ o usuário ver). */
export interface VarreduraStatus {
  estado: 'varrendo' | 'concluida' | 'erro' | 'cancelada';
  periodo: string;
  encontradas: number; // total de notas varridas no período
  enfileiradas: number; // quantas eram novas na fila (≤ encontradas)
  paginas: number;
  truncada?: boolean; // true se bateu o backstop de MAX_PAGINAS (período pode ter mais)
  // Resultado do PROCESSAMENTO da fila (preenchido pelo consumidor, em tempo real):
  importadas: number; // gravadas como saída
  semXml: number; // a nota não trouxe XML utilizável
  errosImport: number; // falha ao importar (re-tentável)
  atualizadoEm: string; // ISO
  erro?: string;
}

// Uma varredura sem progresso há mais que isto é considerada "presa" (processo
// reiniciou / fetch travou) e pode ser substituída por uma nova.
const VARREDURA_STALE_MS = 5 * 60 * 1000;

@Injectable()
export class BlingService {
  private readonly logger = new Logger(BlingService.name);
  /** Progresso da última varredura por empresa (em memória; reinicia no deploy). */
  private readonly varreduras = new Map<string, VarreduraStatus>();
  /** Chaves de varredura marcadas para CANCELAR (a paginação interrompe). */
  private readonly cancelamentos = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly token: BlingTokenService,
    private readonly nfe: NfeService,
    private readonly cls: ClsService,
    private readonly config: ConfigService,
    private readonly fila: BlingFilaService,
  ) {
    // Fila ÚNICA (webhook + importação manual): Redis/BullMQ quando REDIS_URL
    // existe; memória no dev. Falha transitória re-tenta; vazão ~2 notas/s.
    this.fila.definirProcessador((id, origem) => this.processarInvoice(id, origem));
  }

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
    // State expira em 15 min (anti-replay/CSRF de state antigo).
    if (Date.now() - st.criadoEm.getTime() > 15 * 60 * 1000) {
      return back('bling=erro&motivo=state_expirado');
    }

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
    return {
      ...s,
      filaPendentes: await this.fila.pendentes(),
      varredura: this.varreduras.get(this.chaveVarr(this.prisma.tenantId, empresaId)) ?? null,
    };
  }

  /** Lista as NF-e do período — saída (venda) e entrada (devolução) (pré-visualização; não baixa XML). */
  async puxarSaidas(empresaId: string, dataInicial: string, dataFinal: string) {
    const access = await this.token.accessToken(this.prisma.tenantId, empresaId);
    const notas = await this.coletarSaidas(access, dataInicial, dataFinal, PREVIEW_MAX);
    await this.token.marcarSync(this.prisma.tenantId, empresaId).catch(() => undefined);

    const mapeadas = notas.map(mapInvoiceToSaida);
    const truncado = mapeadas.length >= PREVIEW_MAX;
    return {
      periodo: `${dataInicial} a ${dataFinal}`,
      totalNotas: mapeadas.length,
      totalValor: mapeadas.reduce((s, n) => s + n.valor, 0),
      truncado,
      notas: mapeadas,
      observacao: truncado
        ? `Pré-visualização limitada às primeiras ${PREVIEW_MAX} notas. "Importar para apuração" varre o período inteiro, sem limite.`
        : 'Pré-visualização: a listagem do Bling NÃO traz valor nem impostos por nota — eles aparecem em Documentos (e o imposto em Apurações) depois de "Importar para apuração".',
    };
  }

  /**
   * Importação por período → SEGUNDO PLANO. Lista os ids das notas (rápido) e
   * ENFILEIRA cada uma; a resposta volta na hora e o processamento corre na
   * fila, respeitando o limite do Bling. Acompanhe pelo status (filaPendentes)
   * e pela tela Documentos.
   */
  async importarSaidas(empresaId: string, dataInicial: string, dataFinal: string, _usuarioId?: string) {
    const tenantId = this.prisma.tenantId;
    const chave = this.chaveVarr(tenantId, empresaId);

    // Evita varreduras concorrentes p/ a mesma empresa (duplicariam chamadas ao
    // Bling) — mas só se a anterior ainda estiver VIVA (progrediu há pouco). Uma
    // varredura "presa" (sem progresso há VARREDURA_STALE_MS) é substituível.
    const emAndamento = this.varreduras.get(chave);
    if (emAndamento?.estado === 'varrendo') {
      const inativaHa = Date.now() - new Date(emAndamento.atualizadoEm).getTime();
      if (inativaHa < VARREDURA_STALE_MS) {
        return {
          status: 'varrendo',
          jaEmAndamento: true,
          varredura: emAndamento,
          filaPendentes: await this.fila.pendentes(),
          observacao: `Já há uma varredura em andamento (${emAndamento.periodo}) — aguarde concluir antes de iniciar outra.`,
        };
      }
      this.logger.warn(`Bling varredura ${empresaId}: substituindo varredura presa (${Math.round(inativaHa / 1000)}s sem progresso).`);
    }

    // Garante conexão (lança se não conectado) e captura o tenant ANTES de ir p/ 2º plano.
    await this.token.accessToken(tenantId, empresaId);

    this.cancelamentos.delete(chave); // nova varredura zera um cancelamento anterior
    this.varreduras.set(chave, {
      estado: 'varrendo',
      periodo: `${dataInicial} a ${dataFinal}`,
      encontradas: 0,
      enfileiradas: 0,
      paginas: 0,
      importadas: 0,
      semXml: 0,
      errosImport: 0,
      atualizadoEm: new Date().toISOString(),
    });

    // Varre o período INTEIRO em segundo plano (sem o teto de 500) e enfileira
    // cada nota. A resposta volta na hora; a fila baixa ~2 notas/segundo. O .catch
    // GARANTE que a trava ('varrendo') seja liberada mesmo se rejeitar fora do try.
    void this.varrerEEnfileirar(tenantId, empresaId, dataInicial, dataFinal).catch((e) => {
      const base = this.varreduras.get(chave);
      if (base) {
        this.varreduras.set(chave, { ...base, estado: 'erro', erro: (e as Error).message, atualizadoEm: new Date().toISOString() });
      }
      this.logger.error(`Bling varredura ${empresaId} (rejeição não tratada): ${(e as Error).message}`);
    });

    return {
      status: 'varrendo',
      varredura: this.varreduras.get(chave),
      filaPendentes: await this.fila.pendentes(),
      observacao:
        'Varredura do período iniciada em segundo plano (sem limite de 500). As notas são enfileiradas e baixadas (~2/segundo). Acompanhe em "Atualizar status" — o contador mostra quantas foram encontradas; quando a fila zerar, todas as saídas estarão em Documentos.',
    };
  }

  private chaveVarr(tenantId: string, empresaId: string): string {
    return `${tenantId}:${empresaId}`;
  }

  /**
   * PARA a importação: cancela a varredura em andamento (a paginação interrompe
   * na próxima página) e ESVAZIA a fila (no máx. 1 nota em execução conclui).
   * A fila é compartilhada, então limpa as pendências de todas as empresas.
   */
  async pararImportacao(empresaId: string) {
    const tenantId = this.prisma.tenantId;
    const chave = this.chaveVarr(tenantId, empresaId);
    this.cancelamentos.add(chave);
    const removidas = await this.fila.limpar();
    const v = this.varreduras.get(chave);
    if (v && v.estado === 'varrendo') {
      this.varreduras.set(chave, { ...v, estado: 'cancelada', atualizadoEm: new Date().toISOString() });
    }
    this.logger.warn(`Bling: importação parada (empresa ${empresaId}) — ${removidas} nota(s) removida(s) da fila.`);
    return {
      ok: true,
      filaRemovidas: removidas,
      filaPendentes: await this.fila.pendentes(),
      observacao:
        'Importação interrompida: a varredura para na próxima página e a fila foi esvaziada. No máximo 1 nota que já estava em processamento conclui.',
    };
  }

  /**
   * Varre TODAS as páginas do período (sem teto de 500) e enfileira cada nota.
   * Roda em segundo plano: renova o token por página (varreduras longas), publica
   * o progresso em `varreduras` e NUNCA rejeita (erros são logados e registrados).
   */
  private async varrerEEnfileirar(
    tenantId: string,
    empresaId: string,
    dataInicial: string,
    dataFinal: string,
  ): Promise<void> {
    const chave = this.chaveVarr(tenantId, empresaId);
    const atualizar = (patch: Partial<VarreduraStatus>) => {
      const base = this.varreduras.get(chave);
      if (base) this.varreduras.set(chave, { ...base, ...patch, atualizadoEm: new Date().toISOString() });
    };
    let encontradas = 0;
    let enfileiradas = 0;
    let paginas = 0;
    let truncada = false;
    try {
      // parse de data DENTRO do try: data inválida lançaria, e a trava precisa cair.
      const ini = blingDate(new Date(`${dataInicial}T00:00:00`));
      const fim = blingDate(new Date(`${dataFinal}T23:59:59`));
      // NF-e (mod 55) e NFC-e (mod 65) são ENDPOINTS SEPARADOS na v3. A ref enfileirada
      // carrega o tipo ("nfce-<id>") p/ o processador baixar do endpoint certo. Tipo de
      // operação (entrada/saída) é decidido no import pelo tpNF do XML.
      const recursos: Array<{ listar: typeof listInvoices; ref: (id: number | string) => string }> = [
        { listar: listInvoices, ref: (id) => String(id) },
        { listar: listConsumerInvoices, ref: (id) => `nfce-${id}` },
      ];
      for (const rec of recursos) {
        for (let pagina = 1; pagina <= MAX_PAGINAS; pagina += 1) {
          if (this.cancelamentos.has(chave)) {
            atualizar({ estado: 'cancelada' });
            this.logger.warn(`Bling varredura ${empresaId}: cancelada pelo usuário na página ${pagina}.`);
            return;
          }
          // Listagem resiliente: se o blingGet já esgotou o backoff de 429, dá UMA
          // segunda chance após pausa longa (sem isto, um 429 transitório numa página
          // abortava a descoberta INTEIRA do período).
          const lote = await this.listarPaginaResiliente(rec.listar, tenantId, empresaId, pagina, ini, fim, () =>
            atualizar({ encontradas, enfileiradas, paginas }),
          );
          if (!lote?.length) break;
          for (const nf of lote) {
            if (nf?.id == null) continue;
            encontradas += 1;
            // Importação manual: enfileira COM a empresa de origem → o processador
            // tenta a conexão dela primeiro (não varre todas as conexões à toa).
            if (await this.fila.enfileirar(rec.ref(nf.id), { tenantId, empresaId })) enfileiradas += 1;
          }
          paginas += 1;
          atualizar({ encontradas, enfileiradas, paginas });
          if (lote.length < PAGE) break;
          if (pagina === MAX_PAGINAS) truncada = true; // bateu no teto → pode haver mais
        }
      }
      await this.token
        .marcarSync(tenantId, empresaId)
        .catch((e) => this.logger.warn(`Bling marcarSync ${empresaId}: ${(e as Error).message}`));
      atualizar({ estado: 'concluida', encontradas, enfileiradas, truncada });
      this.logger.log(
        `Bling varredura ${empresaId} (${dataInicial}..${dataFinal}): ${encontradas} encontrada(s) [NF-e + NFC-e], ${enfileiradas} nova(s) na fila${truncada ? ' [TRUNCADA no backstop]' : ''}.`,
      );
    } catch (e) {
      // A DESCOBERTA parou, mas as notas já enfileiradas continuam sendo baixadas
      // pela fila (independente da varredura). Deixa isso explícito no status.
      const cont = enfileiradas > 0 ? ` (${enfileiradas} já enfileirada(s) seguem sendo importadas; reimporte o período p/ pegar o restante)` : '';
      atualizar({ estado: 'erro', encontradas, enfileiradas, paginas, erro: `${(e as Error).message}${cont}` });
      this.logger.error(`Bling varredura ${empresaId}: ${(e as Error).message}`);
    }
  }

  /**
   * Lista UMA página re-capturando o token; se o blingGet já esgotou o backoff de
   * 429, dá uma 2ª chance após pausa longa (deixa a taxa da conta esfriar). NÃO
   * aninha mais que isto — insistir acumula erros e o Bling bloqueia o IP (300
   * erros / 600 req em 10s = 10 min). `tocar()` refresca o progresso durante a
   * espera p/ a varredura não ser considerada "presa" (VARREDURA_STALE_MS).
   */
  private async listarPaginaResiliente(
    listar: typeof listInvoices,
    tenantId: string,
    empresaId: string,
    pagina: number,
    ini: string,
    fim: string,
    tocar: () => void,
  ): Promise<BlingInvoice[]> {
    let ultimoErro: unknown;
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      if (tentativa > 0) {
        // Pausa de 30s em passos de 5s, refrescando o progresso a cada passo.
        for (let t = 0; t < 30_000; t += 5_000) {
          await sleep(5_000);
          tocar();
        }
      }
      try {
        const access = await this.token.accessToken(tenantId, empresaId); // renova sozinho perto de expirar
        return (await listar(access, { pagina, limite: PAGE, dataEmissaoInicial: ini, dataEmissaoFinal: fim })) as BlingInvoice[];
      } catch (e) {
        ultimoErro = e;
        this.logger.warn(
          `Bling varredura ${empresaId} pág ${pagina}: ${(e as Error).message}${tentativa === 0 ? ' — 2ª chance em 30s.' : ' — desistindo da página.'}`,
        );
      }
    }
    throw ultimoErro;
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
    const ev = parseEventoNota(raw);
    if (ev) {
      // NFC-e vai prefixada ("nfce-<id>") p/ processarInvoice baixar do endpoint certo.
      const ref = ev.modelo === 'nfce' ? `nfce-${ev.invoiceId}` : String(ev.invoiceId);
      await this.fila.enfileirar(ref);
    }
    return { ok: true };
  }

  /**
   * Resolve a conexão dona da NF por PROVA DE POSSE e importa o XML como saída.
   * 404/403 = "não é desta conta" → tenta a próxima conexão. Qualquer outra
   * falha (429/5xx/rede) é LANÇADA para a fila re-tentar — antes, era descartada.
   */
  private async processarInvoice(ref: number | string, origem?: OrigemNota): Promise<void> {
    // ref pode vir prefixada: "nfce-<id>" (NFC-e mod 65) ou "<id>" puro (NF-e mod 55 —
    // também é o formato que o webhook enfileira). Roteia p/ o endpoint certo do Bling.
    const refStr = String(ref);
    const ehNfce = refStr.startsWith('nfce-');
    const invoiceId = ehNfce ? refStr.slice('nfce-'.length) : refStr;

    // Importação manual: a origem é conhecida → tenta a conexão da empresa PRIMEIRO.
    // Evita varrer todas as conexões à toa — cada GET que dá 404/403 numa conexão
    // que não é a dona conta p/ o bloqueio de IP do Bling (300 erros em 10s). O
    // webhook não tem origem e cai direto no fallback (prova de posse).
    if (origem) {
      const cx = await this.token.conexaoDe(origem.tenantId, origem.empresaId);
      if (cx && (await this.tentarConexao(cx, invoiceId, ehNfce))) return;
    }

    // Fallback: varre as conexões ativas (pulando a origem já tentada acima).
    const conexoes = await this.token.listarAtivas();
    for (const cx of conexoes) {
      if (origem && cx.tenantId === origem.tenantId && cx.empresaId === origem.empresaId) continue;
      if (await this.tentarConexao(cx, invoiceId, ehNfce)) return; // dono encontrado
    }
    this.logger.warn(`NF ${invoiceId}: nenhuma conexão dona (404/403 em todas).`);
  }

  /**
   * Tenta processar a NF com UMA conexão. Retorna true se ela é a dona (achou e
   * importou — ou registrou "sem XML"); false se não é desta conta (404/403) ou o
   * token está morto. LANÇA em 429/5xx/rede (a fila re-tenta).
   */
  private async tentarConexao(cx: BlingConexao, invoiceId: string, ehNfce: boolean): Promise<boolean> {
    let access: string;
    try {
      access = await this.token.accessTokenDaConexao(cx);
    } catch {
      return false; // token morto p/ esta conexão
    }
    let nf: BlingInvoice;
    try {
      nf = ehNfce ? await getConsumerInvoice(access, invoiceId) : await getInvoice(access, invoiceId);
    } catch (e) {
      if (e instanceof BlingApiError && (e.status === 404 || e.status === 403)) return false; // não é desta conta
      throw e; // 429/5xx/rede → re-tenta via fila
    }
    const xml = await this.obterXml(nf, access);
    if (xml) {
      await this.cls.run(async () => {
        this.cls.set('tenantId', cx.tenantId);
        try {
          await this.nfe.importarClassificado(cx.empresaId, xml);
          this.bumpVarredura(cx.tenantId, cx.empresaId, 'importadas');
        } catch (e) {
          this.bumpVarredura(cx.tenantId, cx.empresaId, 'errosImport');
          this.logger.warn(`importarSaida NF ${invoiceId}: ${(e as Error).message}`);
        }
      });
    } else {
      this.bumpVarredura(cx.tenantId, cx.empresaId, 'semXml');
      // Diagnóstico SEM expor o conteúdo do documento: só o tamanho e a natureza do campo.
      const v = String(nf.xml ?? '');
      const natureza = v === '' ? 'vazio' : /^https?:\/\//i.test(v.trim()) ? 'url' : v.includes('<') ? 'xml' : 'outro';
      this.logger.warn(
        `NF ${invoiceId} sem XML utilizável (campo xml: natureza=${natureza}, ${v.length} chars; campos=[${Object.keys(nf).join(',')}]).`,
      );
    }
    // marcarSync é só informativo (não decide dedupe) — falha aqui NÃO deve
    // re-disparar a fila (re-importaria a nota). Logamos para ter visibilidade.
    await this.token
      .marcarSync(cx.tenantId, cx.empresaId)
      .catch((e) => this.logger.warn(`Bling marcarSync NF ${invoiceId}: ${(e as Error).message}`));
    return true; // dono encontrado
  }

  /**
   * Obtém o XML da NF: o Bling pode devolver o conteúdo cru, em base64, OU um
   * LINK (URL) — neste caso BAIXA o XML. Só envia o token se o link for do
   * próprio Bling (não vaza credencial p/ storage/CDN de terceiros).
   */
  private async obterXml(nf: BlingInvoice, access: string): Promise<string | null> {
    const candidatos = [nf.xml, (nf as { linkXml?: string }).linkXml].filter(Boolean) as string[];
    for (const bruto of candidatos) {
      if (bruto.includes('<')) return bruto; // conteúdo cru
      if (/^https?:\/\//i.test(bruto)) {
        try {
          const url = new URL(bruto);
          // SSRF: recusa IP privado / loopback / link-local / metadata de nuvem.
          if (this.hostUrlPerigoso(url.hostname)) {
            this.logger.warn(`Bling download XML: host bloqueado (SSRF): ${url.hostname}`);
            continue;
          }
          const doBling = /(^|\.)bling\.com\.br$/i.test(url.hostname);
          await blingLimiter.aguardar();
          const res = await fetch(bruto, {
            headers: {
              Accept: 'application/xml, text/xml, */*',
              ...(doBling ? { Authorization: `Bearer ${access}` } : {}),
            },
          });
          if (!res.ok) {
            this.logger.warn(`Bling download XML: HTTP ${res.status} em ${url.hostname}`);
            continue;
          }
          const texto = await res.text();
          if (texto.includes('<')) return texto;
        } catch (e) {
          this.logger.warn(`Bling download XML falhou: ${(e as Error).message}`);
        }
        continue;
      }
      const inline = normalizarXml(bruto); // tenta base64
      if (inline) return inline;
    }
    return null;
  }

  /** Bloqueia hosts internos/privados/metadata (anti-SSRF) ao baixar XML por link. */
  private hostUrlPerigoso(hostname: string): boolean {
    const h = hostname.toLowerCase();
    if (h === 'localhost' || h === '[::1]' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) {
      return true;
    }
    const ip = h.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    if (ip) {
      return /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.)/.test(h);
    }
    return false;
  }

  /** Incrementa um contador da varredura da empresa (se houver uma em memória). */
  private bumpVarredura(tenantId: string, empresaId: string, campo: 'importadas' | 'semXml' | 'errosImport'): void {
    const chave = this.chaveVarr(tenantId, empresaId);
    const v = this.varreduras.get(chave);
    if (v) this.varreduras.set(chave, { ...v, [campo]: (v[campo] ?? 0) + 1, atualizadoEm: new Date().toISOString() });
  }

  // ----- internos ------------------------------------------------------------

  /** Coleta as NF do período — saída e entrada (paginado; o blingLimiter rege o ritmo). */
  private async coletarSaidas(
    access: string,
    dataInicial: string,
    dataFinal: string,
    max: number,
  ): Promise<BlingInvoice[]> {
    const ini = blingDate(new Date(`${dataInicial}T00:00:00`));
    const fim = blingDate(new Date(`${dataFinal}T23:59:59`));
    const notas: BlingInvoice[] = [];
    // NF-e (mod 55) e NFC-e (mod 65) — endpoints separados na v3.
    for (const listar of [listInvoices, listConsumerInvoices]) {
      let pagina = 1;
      while (notas.length < max) {
        const lote = (await listar(access, {
          pagina,
          limite: PAGE,
          dataEmissaoInicial: ini,
          dataEmissaoFinal: fim,
        })) as BlingInvoice[];
        if (!lote?.length) break;
        notas.push(...lote.filter((n) => n?.id != null));
        if (lote.length < PAGE) break;
        pagina += 1;
      }
      if (notas.length >= max) break;
    }
    return notas.slice(0, max);
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
