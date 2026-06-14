import { Prisma } from '@prisma/client';

/**
 * Apuração de CBS e IBS na transição da reforma (LC 214/2025). São tributos
 * NÃO-CUMULATIVOS com crédito amplo: o confronto é débito (destacado nas saídas)
 * × crédito (destacado nas entradas) ± saldo credor anterior — mesma mecânica do
 * ICMS (reusa `apurarIcms`). O valor é o DESTACADO no documento (no ano-teste 2026
 * as alíquotas são simbólicas; o motor da Reforma faz a projeção sob alíquota cheia).
 */
export type TributoReforma = 'CBS' | 'IBS';

type Num = Prisma.Decimal | string | number | null | undefined;

export interface ItemCbsIbs {
  vCbs?: Num; // CBS destacado
  vIbsUf?: Num; // IBS da UF
  vIbsMun?: Num; // IBS do município
}

const dec = (v: Num) => new Prisma.Decimal(v ?? 0);

/** Soma o valor destacado de CBS (vCBS) ou IBS (vIBSUF + vIBSMun) dos itens. */
export function somarCbsIbs(itens: ItemCbsIbs[], tributo: TributoReforma): Prisma.Decimal {
  const total = itens.reduce((s, it) => {
    if (tributo === 'CBS') return s.add(dec(it.vCbs));
    return s.add(dec(it.vIbsUf)).add(dec(it.vIbsMun));
  }, new Prisma.Decimal(0));
  return total.toDecimalPlaces(2);
}
