import { Prisma } from '@prisma/client';
import { apurarIcms, EntradaApuracaoIcms, ResultadoApuracaoIcms } from './apuracao-icms';

/** CST de IPI que geram DÉBITO (saída tributada) e CRÉDITO (entrada). */
export const CST_IPI_DEBITO = ['50', '99']; // 99 = "outras saídas" (condicional, com vIPI>0)
export const CST_IPI_CREDITO = ['00', '49']; // 49 = "outras entradas" (condicional)

type Num = Prisma.Decimal | string | number | null | undefined;

export interface ItemIpi {
  cstIpi?: string | null;
  vIpi?: Num;
}

const dec = (v: Num) => new Prisma.Decimal(v ?? 0);

const somar = (itens: ItemIpi[], csts: string[]) =>
  itens
    .reduce((s, it) => (csts.includes((it.cstIpi ?? '').trim()) ? s.add(dec(it.vIpi)) : s), new Prisma.Decimal(0))
    .toDecimalPlaces(2);

export const somarDebitoIpi = (itens: ItemIpi[]) => somar(itens, CST_IPI_DEBITO);
export const somarCreditoIpi = (itens: ItemIpi[]) => somar(itens, CST_IPI_CREDITO);

/**
 * Apuração de IPI: o confronto débito × crédito ± saldo credor anterior é
 * idêntico ao do ICMS (não-cumulatividade, registro E520). Reutiliza apurarIcms.
 */
export const apurarIpi = (e: EntradaApuracaoIcms): ResultadoApuracaoIcms => apurarIcms(e);
