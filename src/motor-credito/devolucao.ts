/**
 * CFOPs de DEVOLUÇÃO DE VENDA (operação de ENTRADA): o cliente devolve mercadoria
 * que a empresa vendeu. O imposto destacado na devolução NÃO é crédito de aquisição
 * de insumo — é o ESTORNO do débito gerado na venda original:
 *  - ICMS: o estabelecimento credita o ICMS que destacou na venda (não-cumulatividade);
 *  - PIS/COFINS não-cumulativo (Lucro Real): crédito sobre a devolução (Leis 10.637/2002
 *    e 10.833/2003, art. 3º), pois a receita da venda foi tributada;
 *  - PIS/COFINS cumulativo (Lucro Presumido) e Simples: NÃO é crédito — o valor é
 *    DEDUZIDO da base de cálculo (receita bruta) do período (Lei 9.718/98, art. 3º).
 *
 * Devolução de COMPRA (a empresa devolve ao fornecedor) é SAÍDA (5/6.20x) e NÃO entra aqui.
 */
const CFOP_DEVOLUCAO_VENDA = new Set<string>([
  // dentro do estado (1xxx)
  '1201', '1202', '1203', '1204', '1410', '1411', '1660', '1661', '1662',
  // interestadual (2xxx)
  '2201', '2202', '2203', '2204', '2410', '2411', '2660', '2661', '2662',
]);

/** true se o CFOP é de devolução de venda (entrada) — só os dígitos importam. */
export function ehDevolucaoVenda(cfop: string | null | undefined): boolean {
  return CFOP_DEVOLUCAO_VENDA.has((cfop ?? '').replace(/\D/g, ''));
}
