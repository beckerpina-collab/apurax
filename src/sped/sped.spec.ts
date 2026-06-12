import { readFileSync } from 'fs';
import { join } from 'path';
import { MotorCreditoService } from '../motor-credito/motor-credito.service';
import { SpedGapService, AchadoLacuna } from './sped-gap.service';
import { SpedParserService } from './sped-parser.service';

describe('SPED EFD-Contribuições: parser + análise de lacuna (sem banco)', () => {
  const parser = new SpedParserService();
  const gap = new SpedGapService(new MotorCreditoService(null as never));
  const conteudo = readFileSync(join(__dirname, '../../test/fixtures/efd-contribuicoes-exemplo.txt'), 'utf8');

  it('parseia o arquivo: competência, CNPJ, documentos, itens e crédito declarado', () => {
    const arq = parser.parse(conteudo);
    expect(arq.cnpj).toBe('11111111000111');
    expect(arq.dtIni.getUTCMonth()).toBe(1); // fevereiro
    expect(arq.documentos).toHaveLength(1);
    expect(arq.documentos[0].indOper).toBe('0'); // entrada
    expect(arq.documentos[0].itens).toHaveLength(4);
    // VL_CRED dos M100/M500
    expect(arq.creditoPisDeclarado.toFixed(2)).toBe('26.50');
    expect(arq.creditoCofinsDeclarado.toFixed(2)).toBe('126.00');
    // índices verificados do C170 do item 1
    const it1 = arq.documentos[0].itens[0];
    expect(it1.cstPis).toBe('50');
    expect(it1.cfop).toBe('1101');
    expect(it1.vlPis.toFixed(2)).toBe('16.50');
  });

  it('mede a lacuna: totais de PIS e COFINS', () => {
    const r = gap.analisar(parser.parse(conteudo));
    expect(r.totalItens).toBe(4);
    // item2 (33,00 + 152,00 não aproveitados) + item4 (6,50 + 26,00 divergência)
    expect(r.lacunaPisTotal.toFixed(2)).toBe('39.50');
    expect(r.lacunaCofinsTotal.toFixed(2)).toBe('178.00');
    expect(r.achados).toHaveLength(6); // item2(2) + item3(2) + item4(2); item1 está OK
  });

  it('classifica cada achado pelo tipo correto', () => {
    const achados = gap.analisar(parser.parse(conteudo)).achados;
    const pis = (item: number): AchadoLacuna =>
      achados.find((a) => a.referencia.includes(`item ${item}`) && a.tributo === 'PIS')!;

    // item 2: CST 50 com crédito zerado -> não aproveitado
    expect(pis(2).tipo).toBe('NAO_APROVEITADO');
    expect(pis(2).lacuna.toFixed(2)).toBe('33.00');

    // item 3: CST 73 (alíquota zero) com crédito declarado -> indevido (risco)
    expect(pis(3).tipo).toBe('INDEVIDO');
    expect(pis(3).lacuna.toFixed(2)).toBe('-5.00');

    // item 4: crédito divergente do esperado (10,00 vs 16,50)
    expect(pis(4).tipo).toBe('INCONSISTENCIA');
    expect(pis(4).lacuna.toFixed(2)).toBe('6.50');

    // item 1 não gera achado (consistente)
    expect(achados.find((a) => a.referencia.includes('item 1'))).toBeUndefined();
  });
});
