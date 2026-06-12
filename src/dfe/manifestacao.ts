/**
 * Construção do evento de manifestação do destinatário (NF-e). O XML aqui é
 * NÃO-assinado; a assinatura XML-DSig (xml-crypto, com a chave do A1) e o envio
 * ao webservice RecepcaoEvento são a etapa seguinte (ver docs).
 *
 * 210210 (Ciência da Operação) é o evento de MENOR compromisso fiscal que
 * destrava o procNFe completo na Distribuição DFe — é o usado na captura
 * automática (com consentimento). 210200/210220/210240 são conclusivos e
 * JAMAIS automáticos sem ação humana explícita.
 */
export type TipoEventoManifestacao = '210210' | '210200' | '210220' | '210240';

export const DESC_EVENTO: Record<TipoEventoManifestacao, string> = {
  '210210': 'Ciencia da Operacao',
  '210200': 'Confirmacao da Operacao',
  '210220': 'Desconhecimento da Operacao',
  '210240': 'Operacao nao Realizada',
};

export interface EventoManifestacaoInput {
  chNFe: string; // 44 dígitos
  cnpj: string; // destinatário que manifesta
  tpEvento: TipoEventoManifestacao;
  nSeqEvento?: number; // 1..20 (default 1)
  dhEvento: string; // ISO com timezone
  tpAmb: number; // 1=prod, 2=homolog
  xJust?: string; // obrigatório só p/ 210240 (15..255 chars)
}

export function montarEventoManifestacao(input: EventoManifestacaoInput): { id: string; xml: string } {
  if (!/^\d{44}$/.test(input.chNFe)) {
    throw new Error('chNFe deve ter 44 dígitos.');
  }
  const nSeq = input.nSeqEvento ?? 1;
  if (input.tpEvento === '210240' && (!input.xJust || input.xJust.length < 15 || input.xJust.length > 255)) {
    throw new Error('xJust obrigatório (15–255 chars) para 210240 (Operação não Realizada).');
  }
  const id = `ID${input.tpEvento}${input.chNFe}${String(nSeq).padStart(2, '0')}`;
  const descEvento = DESC_EVENTO[input.tpEvento];
  const justTag = input.tpEvento === '210240' ? `<xJust>${input.xJust}</xJust>` : '';

  const xml =
    `<evento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<infEvento Id="${id}">` +
    `<cOrgao>91</cOrgao>` + // 91 = Ambiente Nacional (manifestação)
    `<tpAmb>${input.tpAmb}</tpAmb>` +
    `<CNPJ>${input.cnpj}</CNPJ>` +
    `<chNFe>${input.chNFe}</chNFe>` +
    `<dhEvento>${input.dhEvento}</dhEvento>` +
    `<tpEvento>${input.tpEvento}</tpEvento>` +
    `<nSeqEvento>${nSeq}</nSeqEvento>` +
    `<verEvento>1.00</verEvento>` +
    `<detEvento versao="1.00"><descEvento>${descEvento}</descEvento>${justTag}</detEvento>` +
    `</infEvento>` +
    `</evento>`;

  return { id, xml };
}
