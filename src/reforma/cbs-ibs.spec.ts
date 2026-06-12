import { RegimeTributario } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NfeParserService } from '../fiscal/nfe-parser.service';
import { MotorCreditoService } from '../motor-credito/motor-credito.service';
import { AliquotaReferencia, EntradaCbsIbs, ItemApuravel } from '../motor-credito/motor-credito.types';
import { REGRAS_SEED } from '../../test/fixtures/regras.fixture';

const motor = new MotorCreditoService(null as never);
const aliqRef: AliquotaReferencia = { cbs: 0.088, ibs: 0.177 }; // ~26,5%

describe('Parser NF-e — grupo IBSCBS (dupla conformidade 2026)', () => {
  it('extrai o grupo IBSCBS junto com os legados', () => {
    const parser = new NfeParserService();
    const xml = readFileSync(join(__dirname, '../../test/fixtures/nfe-com-ibscbs.xml'), 'utf8');
    const item = parser.parse(xml).itens[0];
    expect(item.cstIcms).toBe('00'); // legado preservado
    expect(item.cstIbsCbs).toBe('000');
    expect(item.cClassTrib).toBe('000001');
    expect(item.vBcIbsCbs).toBe('1000.00');
    expect(item.vCbs).toBe('9.00');
    expect(item.vIbsUf).toBe('1.00');
  });
});

describe('MotorCreditoService.avaliarCreditoCbsIbs', () => {
  it('credita CST 000 (crédito financeiro amplo): efetivo destacado + potencial projetado', () => {
    const r = motor.avaliarCreditoCbsIbs({ cst: '000', vBc: '1000.00', vCbs: '9.00', vIbsUf: '1.00', vIbsMun: '0.00', aliqRef });
    expect(r.creditoPermitido).toBe(true);
    expect(r.creditoEfetivo.toFixed(2)).toBe('10.00'); // 9 + 1 + 0 (alíquota-teste)
    expect(r.creditoPotencial.toFixed(2)).toBe('265.00'); // 1000 × 26,5%
    expect(r.baseLegal).toContain('art. 47');
  });

  it('não credita isenção/imunidade (CST 410)', () => {
    const r = motor.avaliarCreditoCbsIbs({ cst: '410', vBc: '1000.00', aliqRef });
    expect(r.creditoPermitido).toBe(false);
    expect(r.creditoPotencial.toFixed(2)).toBe('0.00');
  });

  it('não credita uso/consumo PESSOAL (art. 57)', () => {
    const r = motor.avaliarCreditoCbsIbs({ cst: '000', vBc: '1000.00', finalidade: 'USO_PESSOAL', aliqRef });
    expect(r.creditoPermitido).toBe(false);
    expect(r.baseLegal).toContain('art. 57');
  });
});

describe('MotorCreditoService.compararRegimes (delta de oportunidade)', () => {
  const legado: ItemApuravel = { cstIcms: '00', vIcms: '180.00', cstPis: '01', vPis: '16.50', cstCofins: '01', vCofins: '76.00' };
  const novo: EntradaCbsIbs = { cst: '000', vBc: '1000.00', vCbs: '9.00', vIbsUf: '1.00', vIbsMun: '0.00', aliqRef };

  it('Lucro Presumido: PIS/COFINS não creditam no legado → delta positivo no novo', () => {
    const d = motor.compararRegimes({ legado, novo, regime: RegimeTributario.LUCRO_PRESUMIDO, regras: REGRAS_SEED });
    expect(d.legado.icms.toFixed(2)).toBe('180.00');
    expect(d.legado.total.toFixed(2)).toBe('180.00'); // PIS/COFINS = 0 (cumulativo)
    expect(d.novoPotencial.toFixed(2)).toBe('265.00');
    expect(d.deltaPotencial.toFixed(2)).toBe('85.00');
    expect(d.pctGanho).toBeCloseTo(0.4722, 3);
  });

  it('uso/consumo: ICMS legado bloqueado, mas CBS/IBS credita (art. 47) → ganho', () => {
    const d = motor.compararRegimes({ legado, novo, regime: RegimeTributario.LUCRO_REAL, regras: REGRAS_SEED, finalidade: 'USO_CONSUMO' });
    expect(d.legado.icms.toFixed(2)).toBe('0.00'); // uso/consumo não credita ICMS no legado
    expect(d.legado.total.toFixed(2)).toBe('92.50'); // só PIS+COFINS
    expect(d.deltaPotencial.toFixed(2)).toBe('172.50');
    expect(d.alertas.join(' ')).toMatch(/uso\/consumo/i);
  });

  it('crédito 100% novo quando o legado é zero (Simples sem crédito)', () => {
    const d = motor.compararRegimes({ legado, novo, regime: RegimeTributario.SIMPLES_NACIONAL, regras: REGRAS_SEED });
    expect(d.legado.total.toFixed(2)).toBe('0.00'); // Simples não credita ICMS/PIS/COFINS
    expect(d.pctGanho).toBeNull();
    expect(d.alertas.join(' ')).toMatch(/100% novo/i);
  });
});
