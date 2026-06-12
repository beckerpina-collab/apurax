import { Prisma, RegraCredito, RegimeTributario, Tributo } from '@prisma/client';
import { MotorCreditoService } from './motor-credito.service';
import { ItemApuravel } from './motor-credito.types';

// Regras espelhando o seed — o motor é determinístico e testável sem banco.
function regra(
  codigo: string,
  tributo: Tributo,
  condicao: Record<string, unknown>,
  prioridade: number,
): RegraCredito {
  return {
    id: codigo,
    codigo,
    tributo,
    descricao: codigo,
    baseLegal: `base-legal-${codigo}`,
    condicao: condicao as Prisma.JsonValue,
    prioridade,
    vigenciaInicio: new Date('2000-01-01'),
    vigenciaFim: null,
    ativo: true,
  };
}

const REGRAS: RegraCredito[] = [
  regra('R-ICMS-CRED-NORMAL', Tributo.ICMS, { cstIn: ['00', '10', '20', '70'], regimeNotIn: ['SIMPLES_NACIONAL'], campoValor: 'vIcms', creditoPermitido: true }, 10),
  regra('R-ICMS-CRED-SN', Tributo.ICMS, { csosnIn: ['101', '201'], regimeNotIn: ['SIMPLES_NACIONAL'], campoValor: 'vCredIcmsSn', creditoPermitido: true }, 10),
  regra('R-ICMS-VEDADO', Tributo.ICMS, { cstIn: ['40', '41', '50', '51', '60', '90'], campoValor: 'vIcms', creditoPermitido: false }, 50),
  regra('R-PIS-CRED', Tributo.PIS, { cstIn: ['01', '02'], regimeIn: ['LUCRO_REAL'], campoValor: 'vPis', creditoPermitido: true }, 10),
  regra('R-PIS-VEDADO', Tributo.PIS, { cstIn: ['04', '05', '06', '07', '08', '09'], campoValor: 'vPis', creditoPermitido: false }, 50),
  regra('R-COFINS-CRED', Tributo.COFINS, { cstIn: ['01', '02'], regimeIn: ['LUCRO_REAL'], campoValor: 'vCofins', creditoPermitido: true }, 10),
  regra('R-COFINS-VEDADO', Tributo.COFINS, { cstIn: ['04', '05', '06', '07', '08', '09'], campoValor: 'vCofins', creditoPermitido: false }, 50),
];

describe('MotorCreditoService.avaliarItem', () => {
  const motor = new MotorCreditoService(null as never);

  const pega = (resultados: ReturnType<typeof motor.avaliarItem>, tributo: Tributo) =>
    resultados.find((r) => r.tributo === tributo)!;

  it('credita ICMS de CST 00 e PIS/COFINS de CST 01 no Lucro Real', () => {
    const item: ItemApuravel = {
      cstIcms: '00',
      vIcms: '100.00',
      cstPis: '01',
      vPis: '16.50',
      cstCofins: '01',
      vCofins: '76.00',
    };
    const r = motor.avaliarItem(item, RegimeTributario.LUCRO_REAL, REGRAS);

    const icms = pega(r, Tributo.ICMS);
    expect(icms.creditoPermitido).toBe(true);
    expect(icms.valorCredito.toString()).toBe('100');
    expect(icms.regraCodigo).toBe('R-ICMS-CRED-NORMAL');

    expect(pega(r, Tributo.PIS).valorCredito.toString()).toBe('16.5');
    expect(pega(r, Tributo.COFINS).valorCredito.toString()).toBe('76');
  });

  it('NÃO credita PIS/COFINS no Lucro Presumido (regime cumulativo)', () => {
    const item: ItemApuravel = { cstIcms: '00', vIcms: '100', cstPis: '01', vPis: '16.50', cstCofins: '01', vCofins: '76' };
    const r = motor.avaliarItem(item, RegimeTributario.LUCRO_PRESUMIDO, REGRAS);

    expect(pega(r, Tributo.PIS).creditoPermitido).toBe(false);
    expect(pega(r, Tributo.PIS).valorCredito.toString()).toBe('0');
    expect(pega(r, Tributo.COFINS).creditoPermitido).toBe(false);
    // ICMS continua valendo no Presumido
    expect(pega(r, Tributo.ICMS).creditoPermitido).toBe(true);
  });

  it('NÃO credita ICMS para adquirente do Simples Nacional', () => {
    const item: ItemApuravel = { cstIcms: '00', vIcms: '100' };
    const r = motor.avaliarItem(item, RegimeTributario.SIMPLES_NACIONAL, REGRAS);
    expect(pega(r, Tributo.ICMS).creditoPermitido).toBe(false);
    expect(pega(r, Tributo.ICMS).baseLegal).toContain('Simples Nacional');
  });

  it('veda ICMS-ST (CST 60) e PIS monofásico (CST 04)', () => {
    const item: ItemApuravel = { cstIcms: '60', vIcms: '0', cstPis: '04', vPis: '0' };
    const r = motor.avaliarItem(item, RegimeTributario.LUCRO_REAL, REGRAS);
    expect(pega(r, Tributo.ICMS).creditoPermitido).toBe(false);
    expect(pega(r, Tributo.ICMS).regraCodigo).toBe('R-ICMS-VEDADO');
    expect(pega(r, Tributo.PIS).creditoPermitido).toBe(false);
    expect(pega(r, Tributo.PIS).regraCodigo).toBe('R-PIS-VEDADO');
  });

  it('credita só a operação própria em CST 10 e alerta sobre o ICMS-ST', () => {
    const item: ItemApuravel = { cstIcms: '10', vIcms: '50.00', vIcmsSt: '30.00' };
    const icms = pega(motor.avaliarItem(item, RegimeTributario.LUCRO_REAL, REGRAS), Tributo.ICMS);
    expect(icms.valorCredito.toString()).toBe('50');
    expect(icms.alertas.join(' ')).toContain('ICMS-ST');
  });

  it('credita ICMS de emitente do Simples via CSOSN 101 (vCredICMSSN)', () => {
    const item: ItemApuravel = { csosn: '101', vCredIcmsSn: '5.25' };
    const icms = pega(motor.avaliarItem(item, RegimeTributario.LUCRO_REAL, REGRAS), Tributo.ICMS);
    expect(icms.creditoPermitido).toBe(true);
    expect(icms.valorCredito.toString()).toBe('5.25');
    expect(icms.regraCodigo).toBe('R-ICMS-CRED-SN');
  });

  it('marca CST não mapeado para análise manual (fail-safe)', () => {
    const item: ItemApuravel = { cstIcms: '99' };
    const icms = pega(motor.avaliarItem(item, RegimeTributario.LUCRO_REAL, REGRAS), Tributo.ICMS);
    expect(icms.creditoPermitido).toBe(false);
    expect(icms.regraId).toBeNull();
    expect(icms.alertas.join(' ')).toContain('não mapeado');
  });
});
