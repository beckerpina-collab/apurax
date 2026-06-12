import { Prisma } from '@prisma/client';

export type ModalidadePisCofins = 'NAO_CUMULATIVO' | 'CUMULATIVO';
export type TributoPC = 'PIS' | 'COFINS';

/** Alíquotas de referência (validação cruzada; o débito vem do destaque do XML). */
export const ALIQUOTAS_PIS_COFINS: Record<ModalidadePisCofins, Record<TributoPC, number>> = {
  NAO_CUMULATIVO: { PIS: 0.0165, COFINS: 0.076 },
  CUMULATIVO: { PIS: 0.0065, COFINS: 0.03 },
};

/** CST de PIS/COFINS de SAÍDA que geram débito do vendedor (01/02/03). */
export const CST_PISCOFINS_DEBITO = ['01', '02', '03'];

type Num = Prisma.Decimal | string | number | null | undefined;
const dec = (v: Num) => new Prisma.Decimal(v ?? 0);
const r2 = (d: Prisma.Decimal) => d.toDecimalPlaces(2);

export interface ItemPisCofins {
  cstPis?: string | null;
  vPis?: Num;
  cstCofins?: string | null;
  vCofins?: Num;
}

/** Soma o débito de PIS ou COFINS das saídas (só CST 01/02/03). */
export function somarDebitoPisCofins(itens: ItemPisCofins[], tributo: TributoPC): Prisma.Decimal {
  return r2(
    itens.reduce((s, it) => {
      const cst = (tributo === 'PIS' ? it.cstPis : it.cstCofins) ?? '';
      const v = tributo === 'PIS' ? it.vPis : it.vCofins;
      return CST_PISCOFINS_DEBITO.includes(cst.trim()) ? s.add(dec(v)) : s;
    }, new Prisma.Decimal(0)),
  );
}

export interface EntradaPisCofins {
  modalidade: ModalidadePisCofins;
  debito: Num; // Σ vPIS|vCOFINS das saídas
  credito?: Num; // crédito das entradas (só usado no não-cumulativo)
  saldoCredorAnterior?: Num; // só não-cumulativo
}

export interface ResultadoPisCofins {
  modalidade: ModalidadePisCofins;
  debito: Prisma.Decimal;
  credito: Prisma.Decimal; // 0 no cumulativo (juridicamente inexistente)
  aRecolher: Prisma.Decimal;
  saldoCredorTransportar: Prisma.Decimal;
}

/**
 * Apuração de PIS/COFINS conforme o regime:
 * - NÃO-CUMULATIVO (Lucro Real): a recolher = max(débito − crédito − saldoCredorAnt, 0);
 *   excedente de crédito → saldo credor transportado.
 * - CUMULATIVO (Lucro Presumido): crédito é inexistente → a recolher = débito.
 * (Simples não apura PIS/COFINS — está no DAS.)
 */
export function apurarPisCofins(e: EntradaPisCofins): ResultadoPisCofins {
  const naoCumulativo = e.modalidade === 'NAO_CUMULATIVO';
  const debito = dec(e.debito);
  const credito = naoCumulativo ? dec(e.credito) : new Prisma.Decimal(0);
  const credAnt = naoCumulativo ? dec(e.saldoCredorAnterior) : new Prisma.Decimal(0);

  const liquido = debito.minus(credito).minus(credAnt);
  const positivo = liquido.greaterThanOrEqualTo(0);

  return {
    modalidade: e.modalidade,
    debito: r2(debito),
    credito: r2(credito),
    aRecolher: positivo ? r2(liquido) : new Prisma.Decimal('0.00'),
    saldoCredorTransportar: positivo ? new Prisma.Decimal('0.00') : r2(liquido.abs()),
  };
}
