// ============================================================================
// Cliente da API do Bling v3 (OAuth2 Authorization Code + endpoints de NF-e).
// Portado do SellerNexo (G:\APP\marketplace-conciliacao) e adaptado p/ Node.
// ----------------------------------------------------------------------------
// Particularidades CONFIRMADAS (SellerNexo + pesquisa adversarial):
//  - AUTORIZAÇÃO usa o host do site (www.bling.com.br); TOKEN usa api.bling.com.br.
//  - Troca/renovação de token: POST x-www-form-urlencoded + header
//    Authorization: Basic base64(client_id:client_secret) + Accept: 1.0.
//  - redirect_uri e scope são OPCIONAIS na URL de authorize (herdam do app).
//  - access_token ~6h; refresh_token ~30 dias (ROTACIONA → persistir o novo).
//  - Respostas vêm embrulhadas em { data: ... }; rate limit ~3 req/s (429+Retry-After).
// ============================================================================

import { Logger } from '@nestjs/common';
import { RateLimiter } from './rate-limiter';

const log = new Logger('BlingClient');

export const BLING_AUTH = 'https://www.bling.com.br/Api/v3/oauth/authorize';
export const BLING_API = 'https://api.bling.com.br/Api/v3';
export const BLING_TOKEN = 'https://api.bling.com.br/Api/v3/oauth/token';

/** Limitador GLOBAL: 1 chamada a cada 400ms (2,5 req/s — folga sob o limite de
 *  3 req/s do Bling). Webhook, importação manual e token dividem o orçamento. */
export const blingLimiter = new RateLimiter(400);

export class BlingApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'BlingApiError';
  }
}

export interface BlingTokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number; // segundos
  scope?: string;
  token_type?: string;
}

/** URL para o usuário autorizar o app. redirect_uri/scope herdam do cadastro. */
export function buildBlingAuthUrl(clientId: string, state: string): string {
  const p = new URLSearchParams({ response_type: 'code', client_id: clientId, state });
  return `${BLING_AUTH}?${p.toString()}`;
}

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

async function blingTokenRequest(
  clientId: string,
  clientSecret: string,
  body: Record<string, string>,
): Promise<BlingTokenSet> {
  await blingLimiter.aguardar();
  const res = await fetch(BLING_TOKEN, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: '1.0',
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, string>;
  if (!res.ok) {
    const msg = data?.error_description ?? data?.error ?? data?.message ?? 'erro';
    throw new BlingApiError(res.status, `Bling oauth/token ${res.status}: ${msg}`, data);
  }
  return data as unknown as BlingTokenSet;
}

/** Troca o `code` do callback por tokens. */
export function exchangeBlingCode(args: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<BlingTokenSet> {
  return blingTokenRequest(args.clientId, args.clientSecret, {
    grant_type: 'authorization_code',
    code: args.code,
    redirect_uri: args.redirectUri,
  });
}

/** Renova o access_token a partir do refresh_token (que rotaciona). */
export function refreshBlingToken(args: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<BlingTokenSet> {
  return blingTokenRequest(args.clientId, args.clientSecret, {
    grant_type: 'refresh_token',
    refresh_token: args.refreshToken,
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET autenticado genérico. Desembrulha `{ data }`. Em 429 respeita Retry-After. */
export async function blingGet<T = unknown>(
  path: string,
  accessToken: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${BLING_API}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  for (let attempt = 0; ; attempt++) {
    await blingLimiter.aguardar(); // cada tentativa (inclusive retry de 429) respeita o limite global
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (res.status === 429 && attempt < 3) {
      const ra = Number(res.headers.get('Retry-After'));
      const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 20) : Math.min(2 * 2 ** attempt, 12);
      log.warn(`Bling 429 em ${path} (tentativa ${attempt + 1}) — aguardando ${wait}s (Retry-After=${res.headers.get('Retry-After') ?? '—'}).`);
      await sleep(wait * 1000);
      continue;
    }
    const json = (await res.json().catch(() => ({}))) as { data?: T; message?: string; error?: { message?: string } };
    if (!res.ok) {
      const msg = json?.error?.message ?? json?.message ?? 'erro';
      throw new BlingApiError(res.status, `Bling GET ${path}: ${msg}`, json);
    }
    return (json.data ?? (json as unknown)) as T;
  }
}

/** Lista notas fiscais (tipo=1 saída por padrão). Filtros por situação e data. */
export function listInvoices(
  accessToken: string,
  params: {
    pagina?: number;
    limite?: number;
    tipo?: number;
    situacao?: number;
    dataEmissaoInicial?: string;
    dataEmissaoFinal?: string;
  },
) {
  const q: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) q[k] = v as string | number;
  return blingGet<BlingInvoice[]>('/nfe', accessToken, q);
}

/** Detalhe completo de uma NF (chave, xml, links). */
export function getInvoice(accessToken: string, id: number | string) {
  return blingGet<BlingInvoice>(`/nfe/${id}`, accessToken);
}

/** Produtos do cadastro (NCM/CEST/origem). situacao 'A' = ativos. */
export function listProducts(accessToken: string, params: { pagina?: number; limite?: number; situacao?: string }) {
  const q: Record<string, string | number> = { pagina: params.pagina ?? 1, limite: params.limite ?? 100 };
  if (params.situacao) q.situacao = params.situacao;
  return blingGet<BlingProduct[]>('/produtos', accessToken, q);
}

export function getProduct(accessToken: string, id: number | string) {
  return blingGet<BlingProduct>(`/produtos/${id}`, accessToken);
}

// --- Tipos parciais (só o que consumimos) -----------------------------------
export interface BlingInvoice {
  id: number;
  tipo?: number; // 0=entrada, 1=saída
  situacao?: number | { id?: number; valor?: number };
  numero?: string;
  serie?: string | number;
  chaveAcesso?: string;
  valorNota?: number;
  dataEmissao?: string;
  dataOperacao?: string;
  xml?: string;
  linkDanfe?: string;
  contato?: { id?: number; nome?: string; numeroDocumento?: string };
  loja?: { id?: number | string };
}

export interface BlingProduct {
  id?: number | string;
  nome?: string;
  codigo?: string; // SKU
  preco?: number;
  situacao?: string;
  gtin?: string;
  // dados fiscais do cadastro (nomes podem variar — [INCERTO], validar no schema oficial)
  tributacao?: { ncm?: string; cest?: string; origem?: number | string };
  ncm?: string;
}

// --- Helpers puros (testáveis sem rede) -------------------------------------

/** Formata Date no padrão do filtro do Bling: 'YYYY-MM-DD HH:MM:SS'. */
export function blingDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/** Decide se o access_token precisa renovar (folga de 5 min, igual ao SellerNexo). */
export function precisaRenovar(expiresAtMs: number, agoraMs: number, margemMs = 5 * 60 * 1000): boolean {
  return expiresAtMs - agoraMs <= margemMs;
}

const SITUACAO_NFE: Record<number, string> = {
  1: 'Pendente',
  2: 'Cancelada',
  3: 'Aguardando recibo',
  4: 'Rejeitada',
  5: 'Autorizada',
  6: 'Emitida DANFE',
  7: 'Registrada',
  8: 'Aguardando protocolo',
  9: 'Denegada',
  10: 'Consulta situação',
  11: 'Bloqueada',
};

/** Normaliza a situação (pode vir número ou objeto) para um rótulo legível. */
export function rotuloSituacao(s: BlingInvoice['situacao']): string {
  const cod = typeof s === 'object' && s ? (s.id ?? s.valor) : s;
  if (cod == null) return '—';
  return SITUACAO_NFE[Number(cod)] ?? `Código ${cod}`;
}

export interface NotaSaida {
  id: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  destinatario: string;
  valor: number;
  chaveAcesso: string | null;
  situacao: string;
  tipoOperacao: 'ENTRADA' | 'SAIDA'; // tipo no Bling (0=entrada/devolução, 1=saída/venda)
}

/** Mapeia uma NF do Bling para o formato exibido no front. Os impostos
 *  (ICMS/PIS/COFINS) NÃO vêm na listagem — saem da apuração após importar o XML. */
export function mapInvoiceToSaida(nf: BlingInvoice): NotaSaida {
  return {
    id: String(nf.id),
    numero: String(nf.numero ?? ''),
    serie: String(nf.serie ?? ''),
    dataEmissao: nf.dataEmissao ?? nf.dataOperacao ?? '',
    destinatario: nf.contato?.nome ?? '—',
    valor: Number(nf.valorNota ?? 0),
    chaveAcesso: nf.chaveAcesso ?? null,
    situacao: rotuloSituacao(nf.situacao),
    tipoOperacao: nf.tipo === 0 ? 'ENTRADA' : 'SAIDA',
  };
}
