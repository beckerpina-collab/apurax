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
  status: 'SUGERIDO' | 'HOMOLOGADO' | 'GLOSADO';
  origem: 'NF-e' | 'CT-e' | 'SPED';
}

export interface DocumentoEntrada {
  id: string;
  chaveAcesso: string;
  modelo: 'NF-e' | 'CT-e' | 'NFS-e';
  emitente: string;
  cnpjEmitente: string;
  dataEmissao: string;
  valor: number;
  creditoIcms: number;
  creditoPisCofins: number;
  origem: 'SEFAZ' | 'XML' | 'SPED';
}

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
}

export const EMPRESAS: Empresa[] = [
  { id: 'e1', cnpj: '11111111000111', razaoSocial: 'Comércio Lucro Real Ltda', regimeTributario: 'LUCRO_REAL', uf: 'SP' },
  { id: 'e2', cnpj: '22222222000122', razaoSocial: 'Serviços Presumido Ltda', regimeTributario: 'LUCRO_PRESUMIDO', uf: 'SP' },
];

export const APURACOES: Apuracao[] = [
  { id: 'a1', documento: 'NF-e 1', item: 'Matéria-prima aço', tributo: 'ICMS', creditoPermitido: true, valorCredito: 180.0, baseLegal: 'LC 87/96, art. 20', status: 'SUGERIDO', origem: 'NF-e' },
  { id: 'a2', documento: 'NF-e 1', item: 'Matéria-prima aço', tributo: 'PIS', creditoPermitido: true, valorCredito: 16.5, baseLegal: 'Lei 10.637/2002, art. 3º', status: 'SUGERIDO', origem: 'NF-e' },
  { id: 'a3', documento: 'NF-e 1', item: 'Matéria-prima aço', tributo: 'COFINS', creditoPermitido: true, valorCredito: 76.0, baseLegal: 'Lei 10.833/2003, art. 3º', status: 'HOMOLOGADO', origem: 'NF-e' },
  { id: 'a4', documento: 'CT-e 1', item: 'Frete s/ compra', tributo: 'ICMS', creditoPermitido: true, valorCredito: 180.0, baseLegal: 'LC 87/96, art. 20 (frete)', status: 'SUGERIDO', origem: 'CT-e' },
  { id: 'a5', documento: 'NF-e 1', item: 'Produto monofásico', tributo: 'PIS', creditoPermitido: false, valorCredito: 0, baseLegal: 'IN RFB 2.121/2022 (monofásico)', status: 'GLOSADO', origem: 'NF-e' },
  { id: 'a6', documento: 'SPED fev/26', item: 'Insumo não aproveitado', tributo: 'COFINS', creditoPermitido: true, valorCredito: 152.0, baseLegal: 'Lacuna SPED (não escriturado)', status: 'SUGERIDO', origem: 'SPED' },
];

export const DOCUMENTOS: DocumentoEntrada[] = [
  { id: 'd1', chaveAcesso: '35260211111111000111550010000000011000000017', modelo: 'NF-e', emitente: 'Aço Forte Distribuidora', cnpjEmitente: '33444555000166', dataEmissao: '2026-02-03', valor: 12500.0, creditoIcms: 1500.0, creditoPisCofins: 1156.25, origem: 'SEFAZ' },
  { id: 'd2', chaveAcesso: '35260222333444000155570010000000051000000098', modelo: 'CT-e', emitente: 'TransLog Fretes SA', cnpjEmitente: '44555666000177', dataEmissao: '2026-02-05', valor: 1800.0, creditoIcms: 216.0, creditoPisCofins: 0, origem: 'SEFAZ' },
  { id: 'd3', chaveAcesso: '35260288999000000122550010000000021000000044', modelo: 'NF-e', emitente: 'Insumos Brasil Ltda', cnpjEmitente: '55666777000188', dataEmissao: '2026-02-11', valor: 7400.0, creditoIcms: 888.0, creditoPisCofins: 684.5, origem: 'XML' },
  { id: 'd4', chaveAcesso: '35260277000111000199500010000000071000000122', modelo: 'NFS-e', emitente: 'Consultoria Tributária ME', cnpjEmitente: '66777888000199', dataEmissao: '2026-02-18', valor: 3000.0, creditoIcms: 0, creditoPisCofins: 277.5, origem: 'XML' },
];

export const DASHBOARD = {
  creditoSugerido: 604.5,
  creditoHomologado: 76.0,
  lacunaSped: 217.5,
  deltaReforma: 85.0,
  competencia: 'fev/2026',
  impostoAPagar: { ICMS: 4200.0, IPI: 0, 'PIS/COFINS': 3120.0, ISS: 150.0, total: 7470.0 },
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
  { id: 's1', numero: '1042', serie: '1', dataEmissao: '2026-02-04', destinatario: 'Cliente Varejo A', valor: 2400.0, icms: 432.0, pisCofins: 222.0, situacao: 'Autorizada' },
  { id: 's2', numero: '1043', serie: '1', dataEmissao: '2026-02-09', destinatario: 'Cliente Atacado B', valor: 9800.0, icms: 1764.0, pisCofins: 906.5, situacao: 'Autorizada' },
  { id: 's3', numero: '1044', serie: '1', dataEmissao: '2026-02-15', destinatario: 'Cliente Varejo C', valor: 5600.0, icms: 1008.0, pisCofins: 518.0, situacao: 'Autorizada' },
];

export function demoImportarNfe() {
  return {
    chaveAcesso: '35260211111111000111550010000000011000000017',
    totalItens: 3,
    creditoPotencial: { ICMS: '185.65', PIS: '19.80', COFINS: '91.20' },
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
