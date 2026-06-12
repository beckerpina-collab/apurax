import { apurarIpi, somarCreditoIpi, somarDebitoIpi } from './apuracao-ipi';
import { apurarPisCofins, somarDebitoPisCofins } from './apuracao-pis-cofins';
import { apurarIss } from './apuracao-iss';

describe('Apuração de IPI', () => {
  it('soma débito (CST 50) e crédito (CST 00) pelo vIPI', () => {
    expect(
      somarDebitoIpi([{ cstIpi: '50', vIpi: '70.00' }, { cstIpi: '51', vIpi: '0' }, { cstIpi: '50', vIpi: '30.00' }]).toFixed(2),
    ).toBe('100.00');
    expect(somarCreditoIpi([{ cstIpi: '00', vIpi: '40.00' }, { cstIpi: '02', vIpi: '0' }]).toFixed(2)).toBe('40.00');
  });

  it('confronto débito × crédito → a recolher', () => {
    const r = apurarIpi({ debito: '100.00', credito: '40.00' });
    expect(r.aRecolher.toFixed(2)).toBe('60.00');
  });
});

describe('Apuração de PIS/COFINS', () => {
  it('soma débito só dos CST de saída 01/02/03 (exclui monofásico 04)', () => {
    const itens = [
      { cstPis: '01', vPis: '16.50' },
      { cstPis: '04', vPis: '5.00' }, // monofásico — não gera débito
      { cstPis: '02', vPis: '3.50' },
    ];
    expect(somarDebitoPisCofins(itens, 'PIS').toFixed(2)).toBe('20.00');
  });

  it('não-cumulativo (Lucro Real): a recolher = débito − crédito', () => {
    const r = apurarPisCofins({ modalidade: 'NAO_CUMULATIVO', debito: '76.00', credito: '50.00' });
    expect(r.aRecolher.toFixed(2)).toBe('26.00');
    expect(r.saldoCredorTransportar.toFixed(2)).toBe('0.00');
  });

  it('não-cumulativo credor: crédito > débito → transporta, nada a recolher', () => {
    const r = apurarPisCofins({ modalidade: 'NAO_CUMULATIVO', debito: '10.00', credito: '50.00' });
    expect(r.aRecolher.toFixed(2)).toBe('0.00');
    expect(r.saldoCredorTransportar.toFixed(2)).toBe('40.00');
  });

  it('cumulativo (Lucro Presumido): crédito é zerado → a recolher = débito', () => {
    const r = apurarPisCofins({ modalidade: 'CUMULATIVO', debito: '30.00', credito: '50.00' });
    expect(r.credito.toFixed(2)).toBe('0.00');
    expect(r.aRecolher.toFixed(2)).toBe('30.00');
  });
});

describe('Apuração de ISS (cumulativo)', () => {
  it('débito só do não-retido (tpRetISSQN=1) e tributável; retido é informativo', () => {
    const r = apurarIss([
      { vISSQN: '50.00', tpRetISSQN: '1' }, // prestador recolhe → débito
      { vISSQN: '30.00', tpRetISSQN: '2' }, // retido pelo tomador → informativo
      { vISSQN: '20.00', tpRetISSQN: '1', tribISSQN: '2' }, // imune → fora
    ]);
    expect(r.aRecolher.toFixed(2)).toBe('50.00');
    expect(r.retidoFonte.toFixed(2)).toBe('30.00');
    expect(r.totalNotas).toBe(3);
  });
});
