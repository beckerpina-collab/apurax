import { Prisma, RegimeTributario, Tributo } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MotorCreditoService } from '../motor-credito/motor-credito.service';
import { REGRAS_SEED } from '../../test/fixtures/regras.fixture';
import { NfeParserService } from './nfe-parser.service';

// Integração parser -> motor SEM banco: lê o XML de exemplo, parseia e apura.
describe('Fluxo NF-e: parser + motor de crédito (sem banco)', () => {
  const parser = new NfeParserService();
  const motor = new MotorCreditoService(null as never);
  const xml = readFileSync(join(__dirname, '../../test/fixtures/nfe-entrada-exemplo.xml'), 'utf8');

  it('parseia a NF-e de exemplo (chave, emitente, 3 itens)', () => {
    const nfe = parser.parse(xml);
    expect(nfe.chaveAcesso).toHaveLength(44);
    expect(nfe.emitenteCnpj).toBe('99999999000199');
    expect(nfe.destinatarioCnpj).toBe('11111111000111');
    expect(nfe.itens).toHaveLength(3);
    expect(nfe.itens[0].cstIcms).toBe('00');
    expect(nfe.itens[1].cstIcms).toBe('60');
    expect(nfe.itens[2].csosn).toBe('101');
  });

  it('apura o crédito potencial de uma empresa do Lucro Real', () => {
    const nfe = parser.parse(xml);
    const totais: Record<'ICMS' | 'PIS' | 'COFINS', Prisma.Decimal> = {
      ICMS: new Prisma.Decimal(0),
      PIS: new Prisma.Decimal(0),
      COFINS: new Prisma.Decimal(0),
    };

    for (const item of nfe.itens) {
      for (const r of motor.avaliarItem(item, RegimeTributario.LUCRO_REAL, REGRAS_SEED)) {
        if (r.creditoPermitido) {
          const t = r.tributo as 'ICMS' | 'PIS' | 'COFINS';
          totais[t] = totais[t].add(r.valorCredito);
        }
      }
    }

    // item1 (180 + 16.50 + 76) + item2 (0) + item3 (5.65 + 3.30 + 15.20)
    expect(totais.ICMS.toFixed(2)).toBe('185.65');
    expect(totais.PIS.toFixed(2)).toBe('19.80');
    expect(totais.COFINS.toFixed(2)).toBe('91.20');
  });

  it('veda o item monofásico/ST (item 2) em todos os tributos', () => {
    const nfe = parser.parse(xml);
    const item2 = nfe.itens[1];
    const resultados = motor.avaliarItem(item2, RegimeTributario.LUCRO_REAL, REGRAS_SEED);
    for (const r of resultados) {
      expect(r.creditoPermitido).toBe(false);
      expect(r.valorCredito.toFixed(2)).toBe('0.00');
    }
    expect(resultados.find((r) => r.tributo === Tributo.ICMS)!.regraCodigo).toBe('R-ICMS-VEDADO');
  });
});
