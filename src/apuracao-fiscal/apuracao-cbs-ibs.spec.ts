import { somarCbsIbs } from './apuracao-cbs-ibs';

describe('somarCbsIbs', () => {
  const itens = [
    { vCbs: '112.50', vIbsUf: '10.00', vIbsMun: '2.50' },
    { vCbs: '16.20', vIbsUf: '1.50', vIbsMun: '0.30' },
    { vCbs: null, vIbsUf: undefined, vIbsMun: undefined }, // item sem destaque
  ];

  it('soma o CBS destacado (vCBS)', () => {
    expect(somarCbsIbs(itens, 'CBS').toFixed(2)).toBe('128.70');
  });

  it('soma o IBS como vIBSUF + vIBSMun', () => {
    expect(somarCbsIbs(itens, 'IBS').toFixed(2)).toBe('14.30');
  });

  it('retorna 0,00 para lista vazia', () => {
    expect(somarCbsIbs([], 'CBS').toFixed(2)).toBe('0.00');
    expect(somarCbsIbs([], 'IBS').toFixed(2)).toBe('0.00');
  });
});
