export const SEFAZ_DFE_CLIENT = 'SEFAZ_DFE_CLIENT';

export type ModeloDfe = 'NFE' | 'CTE';

export interface DocZipBruto {
  nsu: string;
  schema: string;
  conteudoBase64: string; // Base64( GZIP( XML ) )
}

export interface RetDistDFe {
  cStat: string;
  xMotivo: string;
  ultNsu: string;
  maxNsu: string;
  docs: DocZipBruto[];
}

export interface ConsultaDfeParams {
  modelo: ModeloDfe;
  cnpj: string;
  ultNsu: string; // 15 dígitos, zero-pad
  pfx: Buffer; // certificado A1 descriptografado (em memória)
  senha: string;
  tpAmb: number; // 1=prod, 2=homolog
  cUF: string; // UF do autor (IBGE)
}

/**
 * Transporte da Distribuição DFe. Abstraído para que o orquestrador
 * (DistribuicaoService) seja testável com um stub — a implementação SOAP/mTLS
 * real exige certificado e rede.
 */
export interface SefazDfeClient {
  consultar(params: ConsultaDfeParams): Promise<RetDistDFe>;
}
