import { Prisma, RegimeTributario, Tributo } from '@prisma/client';

/**
 * Condição estruturada de uma RegraCredito (campo `condicao` JSON).
 * Avaliada pelo motor contra o item e o regime da empresa.
 */
export interface CondicaoRegra {
  /** CST que satisfazem a regra (ICMS: cstIcms; PIS/COFINS: cstPis/cstCofins). */
  cstIn?: string[];
  /** CSOSN que satisfazem a regra (somente ICMS de emitente do Simples). */
  csosnIn?: string[];
  /** regimes do ADQUIRENTE para os quais a regra vale. */
  regimeIn?: string[];
  /** regimes do adquirente para os quais a regra NÃO vale. */
  regimeNotIn?: string[];
  /** campo do item que carrega o valor do crédito quando permitido. */
  campoValor: 'vIcms' | 'vCredIcmsSn' | 'vPis' | 'vCofins';
  /** se a regra concede (true) ou veda (false) o crédito. */
  creditoPermitido: boolean;
}

/** Subconjunto do item necessário para apurar o crédito. */
export interface ItemApuravel {
  cstIcms?: string | null;
  csosn?: string | null;
  vIcms?: Prisma.Decimal | string | number | null;
  vIcmsSt?: Prisma.Decimal | string | number | null;
  vCredIcmsSn?: Prisma.Decimal | string | number | null;
  cstPis?: string | null;
  vPis?: Prisma.Decimal | string | number | null;
  cstCofins?: string | null;
  vCofins?: Prisma.Decimal | string | number | null;
}

/** Resultado auditável do motor para um (item, tributo). */
export interface ResultadoCredito {
  tributo: Tributo;
  creditoPermitido: boolean;
  valorCredito: Prisma.Decimal;
  regraId: string | null;
  regraCodigo: string | null;
  baseLegal: string;
  alertas: string[];
}

/**
 * Elegibilidade de crédito a partir do CST do C170 do SPED (perspectiva do
 * ADQUIRENTE — domínio distinto do CST do emitente no XML da NF-e):
 * 50-56 = crédito; 60-67 = crédito presumido (alíquota própria da norma);
 * 70-75/98/99 = sem direito.
 */
export interface SpedElegibilidade {
  elegivel: boolean;
  presumido: boolean;
  semDireito: boolean;
  baseLegal: string;
  observacao: string;
}

/**
 * Entrada para o cálculo do crédito de ICMS sobre um CT-e (serviço de transporte).
 * O crédito do frete é do TOMADOR (quem contratou/pagou), contribuinte em regime
 * normal, vinculado a operação tributada — daí `tomadorEhEmpresa` e `regime`.
 */
export interface EntradaCreditoCte {
  grupoIcms: string; // 'ICMS00' | 'ICMS20' | 'ICMS45' | 'ICMS60' | 'ICMS90' | 'ICMSOutraUF' | 'ICMSSN'
  cstIcms: string;
  vIcms?: Prisma.Decimal | string | number | null; // vICMS destacado (ou vICMSOutraUF)
  vCred?: Prisma.Decimal | string | number | null; // crédito presumido/outorgado (não ordinário)
  cBenef?: string | null;
  vTPrest?: Prisma.Decimal | string | number | null;
  cfopEscrituracao?: string | null; // CFOP que a EMPRESA atribui (1/2.35x); o XML não traz
  regime: RegimeTributario;
  tomadorEhEmpresa: boolean; // CNPJ resolvido (toma3/toma4) == CNPJ da empresa
  operacaoVinculadaTributada?: boolean; // undefined => alerta de confirmação (A0)
}

// ----------------------------------------------------------------------------
// Reforma 2026 — CBS/IBS (dual-regime). Crédito financeiro amplo (LC 214/2025
// art. 47); vedação a uso/consumo pessoal (art. 57). Em 2026 (ano-teste) as
// alíquotas destacadas são simbólicas (CBS 0,9% / IBS 0,1%) — o valor de negócio
// é o POTENCIAL projetado sob a alíquota de referência cheia.
// ----------------------------------------------------------------------------

export type Finalidade = 'REVENDA' | 'INDUSTRIALIZACAO' | 'USO_CONSUMO' | 'USO_PESSOAL' | 'ATIVO';

export interface AliquotaReferencia {
  cbs: number; // ex.: 0.088 (~8,8%)
  ibs: number; // ex.: 0.177 (~17,7%)
}

export interface EntradaCbsIbs {
  cst?: string | null; // CST do IBS/CBS (000 integral, 400 isenção, 410 imunidade...)
  cClassTrib?: string | null; // vincula ao artigo da LC 214/2025
  vBc?: Prisma.Decimal | string | number | null; // base compartilhada IBS/CBS
  vCbs?: Prisma.Decimal | string | number | null;
  vIbsUf?: Prisma.Decimal | string | number | null;
  vIbsMun?: Prisma.Decimal | string | number | null;
  finalidade?: Finalidade;
  aliqRef: AliquotaReferencia;
}

export interface CreditoCbsIbs {
  creditoPermitido: boolean;
  creditoEfetivo: Prisma.Decimal; // vCBS + vIBS destacados (simbólico em 2026)
  creditoPotencial: Prisma.Decimal; // vBC × alíquota de referência (projeção)
  baseLegal: string;
  alertas: string[];
}

export interface DeltaOportunidade {
  legado: { icms: Prisma.Decimal; pis: Prisma.Decimal; cofins: Prisma.Decimal; total: Prisma.Decimal };
  novoEfetivo: Prisma.Decimal; // crédito CBS/IBS de 2026 (alíquota-teste)
  novoPotencial: Prisma.Decimal; // crédito CBS/IBS sob alíquota de referência cheia
  deltaPotencial: Prisma.Decimal; // novoPotencial - legado.total
  pctGanho: number | null; // null quando o crédito legado é zero (ganho "100% novo")
  baseLegal: string[];
  alertas: string[];
}
