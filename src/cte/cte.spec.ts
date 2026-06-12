import { RegimeTributario } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MotorCreditoService } from '../motor-credito/motor-credito.service';
import { EntradaCreditoCte } from '../motor-credito/motor-credito.types';
import { CteParserService } from './cte-parser.service';

describe('CT-e: parser + crédito de ICMS sobre frete (sem banco)', () => {
  const parser = new CteParserService();
  const motor = new MotorCreditoService(null as never);
  const xml = readFileSync(join(__dirname, '../../test/fixtures/cte-exemplo.xml'), 'utf8');

  const base = (over: Partial<EntradaCreditoCte> = {}): EntradaCreditoCte => ({
    grupoIcms: 'ICMS00',
    cstIcms: '00',
    vIcms: '180.00',
    vTPrest: '1500.00',
    regime: RegimeTributario.LUCRO_REAL,
    tomadorEhEmpresa: true,
    ...over,
  });

  it('parseia o CT-e: chave, tomador (destinatário), grupo ICMS e vICMS', () => {
    const cte = parser.parse(xml);
    expect(cte.chaveAcesso).toHaveLength(44);
    expect(cte.modelo).toBe('57');
    expect(cte.emitenteCnpj).toBe('33333333000133');
    expect(cte.tomadorCnpj).toBe('11111111000111');
    expect(cte.tomadorPapel).toBe('DESTINATARIO');
    expect(cte.grupoIcms).toBe('ICMS00');
    expect(cte.vIcms).toBe('180.00');
    expect(cte.vTPrest).toBe('1500.00');
  });

  it('credita o ICMS do frete quando a empresa é a tomadora (Lucro Real, ICMS00)', () => {
    const r = motor.avaliarCreditoCte(base());
    expect(r.creditoPermitido).toBe(true);
    expect(r.valorCredito.toFixed(2)).toBe('180.00');
    // sempre alerta para confirmar o vínculo com operação tributada
    expect(r.alertas.some((a) => a.startsWith('A0'))).toBe(true);
  });

  it('NÃO credita quando a empresa não é a tomadora (provável CIF)', () => {
    const r = motor.avaliarCreditoCte(base({ tomadorEhEmpresa: false }));
    expect(r.creditoPermitido).toBe(false);
    expect(r.valorCredito.toFixed(2)).toBe('0.00');
    expect(r.alertas.some((a) => a.startsWith('A2'))).toBe(true);
  });

  it('NÃO credita para tomador do Simples Nacional', () => {
    const r = motor.avaliarCreditoCte(base({ regime: RegimeTributario.SIMPLES_NACIONAL }));
    expect(r.creditoPermitido).toBe(false);
    expect(r.alertas.some((a) => a.startsWith('A1'))).toBe(true);
  });

  it('NÃO credita CT-e isento/não tributado (ICMS45)', () => {
    const r = motor.avaliarCreditoCte(base({ grupoIcms: 'ICMS45', cstIcms: '41', vIcms: null }));
    expect(r.creditoPermitido).toBe(false);
    expect(r.alertas.some((a) => a.startsWith('A4'))).toBe(true);
  });

  it('NÃO credita frete de transportadora do Simples (ICMSSN)', () => {
    const r = motor.avaliarCreditoCte(base({ grupoIcms: 'ICMSSN', cstIcms: '90', vIcms: null }));
    expect(r.creditoPermitido).toBe(false);
    expect(r.alertas.some((a) => a.startsWith('A5'))).toBe(true);
  });
});
