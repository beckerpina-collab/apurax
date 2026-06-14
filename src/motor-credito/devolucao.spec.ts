import { ehDevolucaoVenda } from './devolucao';

describe('ehDevolucaoVenda', () => {
  it('reconhece CFOPs de devolução de venda (entrada), dentro e fora do estado', () => {
    for (const cfop of ['1201', '1202', '1411', '1662', '2201', '2202', '2660']) {
      expect(ehDevolucaoVenda(cfop)).toBe(true);
    }
    expect(ehDevolucaoVenda('1.201')).toBe(true); // tolera máscara
  });

  it('NÃO marca compras comuns nem devolução de COMPRA (saída)', () => {
    for (const cfop of ['1102', '1101', '2102', '5201', '6202', '5102', '']) {
      expect(ehDevolucaoVenda(cfop)).toBe(false);
    }
    expect(ehDevolucaoVenda(null)).toBe(false);
    expect(ehDevolucaoVenda(undefined)).toBe(false);
  });
});
