// Dados de exemplo do modo demo (frontend sem backend). A mesma forma de dados
// que a API NestJS devolve — o cliente real (api.ts) substitui isto quando
// VITE_DEMO="false".

export interface Empresa {
  id: string;
  cnpj: string;
  razaoSocial: string;
  regimeTributario: 'LUCRO_REAL' | 'LUCRO_PRESUMIDO' | 'SIMPLES_NACIONAL';
  uf: string;
}

export interface Apuracao {
  id: string;
  documento: string;
  item: string;
  tributo: 'ICMS' | 'PIS' | 'COFINS' | 'CBS' | 'IBS';
  creditoPermitido: boolean;
  valorCredito: number;
  baseLegal: string;
  alertas?: string[];
  status: 'SUGERIDO' | 'HOMOLOGADO' | 'GLOSADO';
  origem: 'NF-e' | 'CT-e' | 'SPED';
}

export interface DocumentoEntrada {
  id: string;
  chaveAcesso: string;
  modelo: 'NF-e' | 'NFC-e' | 'CT-e' | 'NFS-e';
  emitente: string;
  cnpjEmitente: string;
  dataEmissao: string;
  valor: number;
  creditoIcms: number;
  creditoPisCofins: number;
  origem: 'SEFAZ' | 'XML' | 'SPED';
  tipoOperacao?: 'ENTRADA' | 'SAIDA';
  numero?: string;
  serie?: string;
  destinatario?: string;
  cnpjDestinatario?: string;
  bcIcms?: number;
  icms?: number;
  pis?: number;
  cofins?: number;
  cbs?: number;
  ibs?: number;
}

export interface LinhaCstDemo {
  cst: string;
  descricao: string;
  itens: number;
  base: number;
  valor: number;
}

export const RESUMO_CST_DEMO = {
  pis: [
    { cst: '01', descricao: 'Tributável — alíquota básica', itens: 5, base: 22300.0, valor: 367.95 },
    { cst: '06', descricao: 'Alíquota zero', itens: 1, base: 3000.0, valor: 0 },
  ] as LinhaCstDemo[],
  cofins: [
    { cst: '01', descricao: 'Tributável — alíquota básica', itens: 5, base: 22300.0, valor: 1694.8 },
    { cst: '06', descricao: 'Alíquota zero', itens: 1, base: 3000.0, valor: 0 },
  ] as LinhaCstDemo[],
};

export interface ApuracaoImposto {
  imposto: string;
  competencia: string;
  debito: number;
  credito: number;
  saldoCredorAnterior: number;
  aRecolher: number;
  saldoCredorTransportar: number;
}

export interface CursorDfe {
  modelo: 'NFE' | 'CTE';
  ultimoNSU: string;
  maxNSU: string;
  ultimaConsulta: string;
  status: 'ativo' | 'inativo';
}

export interface NotaSaida {
  id: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  destinatario: string;
  valor: number;
  icms: number;
  pisCofins: number;
  situacao: string;
  tipoOperacao: 'ENTRADA' | 'SAIDA';
}

export const EMPRESAS: Empresa[] = [
  { id: 'e1', cnpj: '11111111000111', razaoSocial: 'Comércio Lucro Real Ltda', regimeTributario: 'LUCRO_REAL', uf: 'SP' },
  { id: 'e2', cnpj: '22222222000122', razaoSocial: 'Serviços Presumido Ltda', regimeTributario: 'LUCRO_PRESUMIDO', uf: 'SP' },
];

export const APURACOES: Apuracao[] = [
  { id: 'a1', documento: 'NF-e 1', item: 'Matéria-prima aço', tributo: 'ICMS', creditoPermitido: true, valorCredito: 180.0, baseLegal: 'LC 87/96, art. 20', status: 'SUGERIDO', origem: 'NF-e' },
  { id: 'a2', documento: 'NF-e 1', item: 'Matéria-prima aço', tributo: 'PIS', creditoPermitido: true, valorCredito: 16.5, baseLegal: 'Lei 10.637/2002, art. 3º', status: 'SUGERIDO', origem: 'NF-e' },
  { id: 'a3', documento: 'NF-e 1', item: 'Matéria-prima aço', tributo: 'COFINS', creditoPermitido: true, valorCredito: 76.0, baseLegal: 'Lei 10.833/2003, art. 3º', status: 'HOMOLOGADO', origem: 'NF-e' },
  { id: 'a4', documento: 'CT-e 1', item: 'Frete s/ compra', tributo: 'ICMS', creditoPermitido: true, valorCredito: 180.0, baseLegal: 'LC 87/96, art. 20 (frete)', alertas: ['A0: confirmar vínculo do transporte com operação tributada/creditável (entrada p/ revenda/industrialização).'], status: 'SUGERIDO', origem: 'CT-e' },
  { id: 'a5', documento: 'NF-e 1', item: 'Produto monofásico', tributo: 'PIS', creditoPermitido: false, valorCredito: 0, baseLegal: 'IN RFB 2.121/2022 (monofásico)', alertas: ['CST/CSOSN não gera crédito de PIS (regime monofásico).'], status: 'GLOSADO', origem: 'NF-e' },
  { id: 'a6', documento: 'SPED fev/26', item: 'Insumo não aproveitado', tributo: 'COFINS', creditoPermitido: true, valorCredito: 152.0, baseLegal: 'Lacuna SPED (não escriturado)', status: 'SUGERIDO', origem: 'SPED' },
];

export const DOCUMENTOS: DocumentoEntrada[] = [
  { id: 'd1', chaveAcesso: '35260211111111000111550010000000011000000017', modelo: 'NF-e', numero: '1', serie: '1', emitente: 'Aço Forte Distribuidora', cnpjEmitente: '33444555000166', dataEmissao: '2026-02-03', valor: 12500.0, creditoIcms: 1500.0, creditoPisCofins: 1156.25, bcIcms: 12500.0, icms: 1500.0, pis: 206.25, cofins: 950.0, cbs: 112.5, ibs: 12.5, origem: 'SEFAZ', tipoOperacao: 'ENTRADA' },
  { id: 'd2', chaveAcesso: '35260222333444000155570010000000051000000098', modelo: 'CT-e', numero: '5', serie: '1', emitente: 'TransLog Fretes SA', cnpjEmitente: '44555666000177', dataEmissao: '2026-02-05', valor: 1800.0, creditoIcms: 216.0, creditoPisCofins: 0, bcIcms: 1800.0, icms: 216.0, pis: 0, cofins: 0, cbs: 16.2, ibs: 1.8, origem: 'SEFAZ', tipoOperacao: 'ENTRADA' },
  { id: 'd3', chaveAcesso: '35260288999000000122550010000000021000000044', modelo: 'NF-e', numero: '2', serie: '1', emitente: 'Insumos Brasil Ltda', cnpjEmitente: '55666777000188', dataEmissao: '2026-02-11', valor: 7400.0, creditoIcms: 888.0, creditoPisCofins: 684.5, bcIcms: 7400.0, icms: 888.0, pis: 122.1, cofins: 562.4, cbs: 66.6, ibs: 7.4, origem: 'XML', tipoOperacao: 'ENTRADA' },
  { id: 'd4', chaveAcesso: '35260277000111000199500010000000071000000122', modelo: 'NFS-e', numero: '7', serie: '1', emitente: 'Consultoria Tributária ME', cnpjEmitente: '66777888000199', dataEmissao: '2026-02-18', valor: 3000.0, creditoIcms: 0, creditoPisCofins: 277.5, bcIcms: 0, icms: 0, pis: 49.5, cofins: 228.0, cbs: 27.0, ibs: 3.0, origem: 'XML', tipoOperacao: 'ENTRADA' },
  { id: 'd5', chaveAcesso: '35260211111111000111550010000010421000000201', modelo: 'NF-e', numero: '1042', serie: '1', emitente: 'Comércio Lucro Real Ltda', cnpjEmitente: '11111111000111', destinatario: 'Cliente Varejo A', cnpjDestinatario: '12345678000190', dataEmissao: '2026-02-04', valor: 2400.0, creditoIcms: 0, creditoPisCofins: 0, bcIcms: 2400.0, icms: 432.0, pis: 39.6, cofins: 182.4, cbs: 21.6, ibs: 2.4, origem: 'XML', tipoOperacao: 'SAIDA' },
  { id: 'd6', chaveAcesso: '35260211111111000111550010000010431000000219', modelo: 'NF-e', numero: '1043', serie: '1', emitente: 'Comércio Lucro Real Ltda', cnpjEmitente: '11111111000111', destinatario: 'Cliente Atacado B', cnpjDestinatario: '98765432000121', dataEmissao: '2026-02-09', valor: 9800.0, creditoIcms: 0, creditoPisCofins: 0, bcIcms: 9800.0, icms: 1764.0, pis: 161.7, cofins: 744.8, cbs: 88.2, ibs: 9.8, origem: 'XML', tipoOperacao: 'SAIDA' },
  { id: 'd7', chaveAcesso: '35260211111111000111650010000088410000000209', modelo: 'NFC-e', numero: '8841', serie: '1', emitente: 'Comércio Lucro Real Ltda', cnpjEmitente: '11111111000111', destinatario: 'Consumidor não identificado', cnpjDestinatario: '', dataEmissao: '2026-02-20', valor: 350.0, creditoIcms: 0, creditoPisCofins: 0, bcIcms: 350.0, icms: 63.0, pis: 5.78, cofins: 26.6, cbs: 3.15, ibs: 0.35, origem: 'XML', tipoOperacao: 'SAIDA' },
];

export const DASHBOARD = {
  creditoSugerido: 604.5,
  creditoHomologado: 76.0,
  lacunaSped: 217.5,
  deltaReforma: 85.0,
  competencia: 'competência fev/2026',
  documentos: 4,
  anosDisponiveis: [2026, 2025],
  impostoAPagar: { ICMS: 4200.0, IPI: 0, 'PIS/COFINS': 3120.0, ISS: 150.0, total: 7470.0 },
  saidas: { quantidade: 2, faturamento: 12200.0, icmsDebito: 2196.0, pisDebito: 201.3, cofinsDebito: 927.2, cbsDebito: 109.8, ibsDebito: 12.2 },
  resumoCst: {
    pis: [{ cst: '01', descricao: 'Tributável — alíquota básica', itens: 2, base: 12200.0, valor: 201.3 }],
    cofins: [{ cst: '01', descricao: 'Tributável — alíquota básica', itens: 2, base: 12200.0, valor: 927.2 }],
  },
  serie: [
    { mes: 'set', credito: 1820, debito: 6400 },
    { mes: 'out', credito: 2310, debito: 6900 },
    { mes: 'nov', credito: 1990, debito: 7100 },
    { mes: 'dez', credito: 2640, debito: 8200 },
    { mes: 'jan', credito: 2200, debito: 6800 },
    { mes: 'fev', credito: 2760, debito: 7470 },
  ],
};

export const CURSORES: CursorDfe[] = [
  { modelo: 'NFE', ultimoNSU: '000000000001245', maxNSU: '000000000001245', ultimaConsulta: '2026-02-20T08:30:00-03:00', status: 'ativo' },
  { modelo: 'CTE', ultimoNSU: '000000000000312', maxNSU: '000000000000312', ultimaConsulta: '2026-02-20T08:31:00-03:00', status: 'ativo' },
];

export const SAIDAS_BLING: NotaSaida[] = [
  { id: 's1', numero: '1042', serie: '1', dataEmissao: '2026-02-04', destinatario: 'Cliente Varejo A', valor: 2400.0, icms: 432.0, pisCofins: 222.0, situacao: 'Autorizada', tipoOperacao: 'SAIDA' },
  { id: 's2', numero: '1043', serie: '1', dataEmissao: '2026-02-09', destinatario: 'Cliente Atacado B', valor: 9800.0, icms: 1764.0, pisCofins: 906.5, situacao: 'Autorizada', tipoOperacao: 'SAIDA' },
  { id: 's3', numero: '55', serie: '1', dataEmissao: '2026-02-15', destinatario: 'Cliente Varejo A (devolução)', valor: 600.0, icms: 108.0, pisCofins: 55.5, situacao: 'Autorizada', tipoOperacao: 'ENTRADA' },
];

export function demoImportarNfe() {
  return {
    chaveAcesso: '35260211111111000111550010000000011000000017',
    totalItens: 3,
    creditoPotencial: { ICMS: '185.65', PIS: '19.80', COFINS: '91.20', CBS: '9.00', IBS: '1.00' },
    observacao: 'Créditos calculados pelo motor determinístico e gravados como SUGERIDO; pendem de homologação.',
  };
}

export function demoSincronizar() {
  return {
    documentosNovos: 3,
    ultimoNSU: '000000000001248',
    maxNSU: '000000000001248',
    cStat: '138',
    mensagem: 'Documentos localizados (cStat 138). 3 NF-e de entrada capturadas e enviadas ao motor de crédito.',
  };
}

export function demoApurarImposto(imposto: string, ano: number, mes: number): ApuracaoImposto {
  const tabela: Record<string, Partial<ApuracaoImposto>> = {
    ICMS: { debito: 7470, credito: 3270, saldoCredorAnterior: 0, aRecolher: 4200, saldoCredorTransportar: 0 },
    IPI: { debito: 0, credito: 0, saldoCredorAnterior: 0, aRecolher: 0, saldoCredorTransportar: 0 },
    'PIS/COFINS': { debito: 4646.5, credito: 1526.5, saldoCredorAnterior: 0, aRecolher: 3120, saldoCredorTransportar: 0 },
    ISS: { debito: 150, credito: 0, saldoCredorAnterior: 0, aRecolher: 150, saldoCredorTransportar: 0 },
    CBS: { debito: 109.8, credito: 222.3, saldoCredorAnterior: 0, aRecolher: 0, saldoCredorTransportar: 112.5 },
    IBS: { debito: 12.2, credito: 24.7, saldoCredorAnterior: 0, aRecolher: 0, saldoCredorTransportar: 12.5 },
  };
  const base = tabela[imposto] ?? tabela.ICMS;
  return {
    imposto,
    competencia: `${ano}-${String(mes).padStart(2, '0')}`,
    debito: base.debito ?? 0,
    credito: base.credito ?? 0,
    saldoCredorAnterior: base.saldoCredorAnterior ?? 0,
    aRecolher: base.aRecolher ?? 0,
    saldoCredorTransportar: base.saldoCredorTransportar ?? 0,
  };
}

export function demoApurarSimples(ano: number, mes: number, anexo = 'I') {
  // Demo: receita do mês R$ 12.200; RBT12 R$ 146.400 (1ª faixa do Anexo I → 4% efetivo).
  const receitaMes = 12200;
  const rbt12 = 146400;
  const aliquotaEfetiva = 0.04;
  const das = Math.round(receitaMes * aliquotaEfetiva * 100) / 100;
  const competencia = `${ano}-${String(mes).padStart(2, '0')}`;
  return {
    linhas: [
      {
        imposto: 'SIMPLES (DAS)',
        competencia,
        debito: das,
        credito: 0,
        saldoCredorAnterior: 0,
        aRecolher: das,
        saldoCredorTransportar: 0,
      },
    ],
    simples: { anexo, faixa: 1, aliquotaNominal: 4, parcelaDeduzir: 0, aliquotaEfetiva, das, receitaMes, rbt12 },
    alertas: ['Receita considerada = vendas (NF-e/NFC-e de saída). (demo)'],
  };
}

export function demoClassificar(payload: { descricao: string; ncm: string; cfop: string }) {
  // Validador de NCM/impostos — devolve veredito + sugestões (IA assistiva).
  const ncmOk = /^\d{8}$/.test(payload.ncm.replace(/\D/g, ''));
  return {
    veredito: ncmOk ? 'ATENCAO' : 'DIVERGENCIA',
    confianca: 0.82,
    ncmInformado: payload.ncm,
    ncmSugerido: ncmOk ? payload.ncm : '94036000',
    cfopInformado: payload.cfop,
    cfopSugerido: payload.cfop,
    alertas: ncmOk
      ? ['NCM com formato válido. Confirmar enquadramento do CST de PIS/COFINS para o produto descrito.']
      : ['NCM inválido (esperado 8 dígitos). Sugestão baseada na descrição: 9403.60.00 (móveis de madeira).'],
    observacao: 'Sugestão da IA é assistiva. O motor determinístico é a fonte oficial dos números do imposto.',
  };
}

export function demoBlingStatus() {
  return { conectado: false, expiraEm: null as string | null, escopos: ['NFe', 'Produtos'] };
}

export function demoBlingPuxar() {
  return {
    periodo: '2026-02',
    totalNotas: SAIDAS_BLING.length,
    totalValor: SAIDAS_BLING.reduce((s, n) => s + n.valor, 0),
    notas: SAIDAS_BLING,
    observacao: 'Notas de saída importadas do Bling (demo). Servem de base para o débito de imposto a pagar.',
  };
}

export function demoCompararReforma() {
  return {
    totais: {
      creditoLegado: '180.00',
      creditoNovoEfetivo2026: '10.00',
      creditoNovoPotencial: '265.00',
      deltaPotencial: '85.00',
    },
    itens: [
      {
        item: 'Mercadoria para revenda',
        creditoLegado: '180.00',
        creditoNovoPotencial: '265.00',
        deltaPotencial: '85.00',
        pctGanho: 0.4722,
        alertas: ['Crédito CBS/IBS de 2026 é simbólico (alíquota-teste); potencial sob alíquota de referência.'],
      },
    ],
  };
}
