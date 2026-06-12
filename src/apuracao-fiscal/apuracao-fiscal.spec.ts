import { apurarIcms, somarDebitoIcms } from './apuracao-icms';
import { anexoPorFatorR, calcularDas, faixaPorRbt12 } from './simples-das';

describe('Apuração de ICMS (regime normal — E110)', () => {
  it('apuração devedora: débito > crédito → ICMS a recolher', () => {
    const r = apurarIcms({ debito: '1000.00', credito: '600.00' });
    expect(r.saldoApurado.toFixed(2)).toBe('400.00');
    expect(r.aRecolher.toFixed(2)).toBe('400.00');
    expect(r.saldoCredorTransportar.toFixed(2)).toBe('0.00');
  });

  it('apuração credora: crédito > débito → saldo credor transportado, nada a recolher', () => {
    const r = apurarIcms({ debito: '200.00', credito: '600.00' });
    expect(r.aRecolher.toFixed(2)).toBe('0.00');
    expect(r.saldoCredorTransportar.toFixed(2)).toBe('400.00');
  });

  it('usa o saldo credor anterior no confronto (carry-over)', () => {
    const r = apurarIcms({ debito: '500.00', credito: '100.00', saldoCredorAnterior: '300.00' });
    // total créditos = 100 + 300 = 400; saldo = 500 - 400 = 100
    expect(r.aRecolher.toFixed(2)).toBe('100.00');
  });

  it('soma o débito só dos CST que geram débito próprio (exclui ST/sem destaque)', () => {
    const debito = somarDebitoIcms([
      { cstIcms: '00', vIcms: '180.00' }, // gera débito
      { cstIcms: '60', vIcms: '0' }, // ST — não soma
      { cstIcms: '40', vIcms: '0' }, // isenta — não soma
      { cstIcms: '20', vIcms: '20.00' }, // gera débito
    ]);
    expect(debito.toFixed(2)).toBe('200.00');
  });
});

describe('Simples Nacional — DAS (PGDAS-D)', () => {
  it('alíquota efetiva e DAS — Anexo I, 4ª faixa', () => {
    // RBT12 1.000.000 (4ª faixa: 10,70% / PD 22.500) → efetiva = (107000-22500)/1e6 = 0,0845
    const r = calcularDas({ anexo: 'I', rbt12: 1_000_000, receitaMes: 100_000 });
    expect(r.faixa).toBe(4);
    expect(r.aliquotaEfetiva).toBeCloseTo(0.0845, 6);
    expect(r.das.toFixed(2)).toBe('8450.00');
  });

  it('1ª faixa: alíquota nominal = efetiva (PD 0)', () => {
    const r = calcularDas({ anexo: 'I', rbt12: 100_000, receitaMes: 10_000 });
    expect(r.faixa).toBe(1);
    expect(r.das.toFixed(2)).toBe('400.00'); // 4%
  });

  it('Fator R decide Anexo III (folha ≥ 28% da receita) ou V', () => {
    expect(anexoPorFatorR(35_000, 100_000)).toBe('III'); // 35% ≥ 28%
    expect(anexoPorFatorR(20_000, 100_000)).toBe('V'); // 20% < 28%
  });

  it('faixa pela RBT12', () => {
    expect(faixaPorRbt12('III', 500_000).indice).toBe(3); // 360k–720k
    expect(faixaPorRbt12('III', 4_000_000).indice).toBe(6);
  });
});
