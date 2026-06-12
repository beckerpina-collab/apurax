import { Prisma } from '@prisma/client';

/** CST de ICMS que geram DÉBITO próprio na saída (LC 87/96; EFD E110.02). */
export const CST_ICMS_GERA_DEBITO = ['00', '10', '20', '70', '90'];

type Num = Prisma.Decimal | string | number | null | undefined;

export interface ItemSaidaIcms {
  cstIcms?: string | null;
  vIcms?: Num; // ICMS próprio destacado (NÃO incluir vICMSST/FCP/DIFAL)
}

export interface EntradaApuracaoIcms {
  debito: Num; // Σ vICMS das saídas (CST que geram débito)
  credito: Num; // crédito das entradas (motor existente)
  saldoCredorAnterior?: Num; // carry-over da competência anterior (E110.10)
  ajusteDebito?: Num; // E110.03+04+05
  ajusteCredito?: Num; // E110.07+08+09
  deducoes?: Num; // E110.12
}

export interface ResultadoApuracaoIcms {
  totalDebitos: Prisma.Decimal;
  totalCreditos: Prisma.Decimal;
  saldoApurado: Prisma.Decimal; // E110.11 (>=0)
  aRecolher: Prisma.Decimal; // E110.13 — o "ICMS a recolher"
  saldoCredorTransportar: Prisma.Decimal; // E110.14 → vira saldoCredorAnterior de N+1
}

const dec = (v: Num) => new Prisma.Decimal(v ?? 0);
const r2 = (d: Prisma.Decimal) => d.toDecimalPlaces(2);

/** Soma o débito de ICMS dos itens de saída (só CST que geram débito próprio). */
export function somarDebitoIcms(itens: ItemSaidaIcms[]): Prisma.Decimal {
  return r2(
    itens.reduce(
      (s, it) => (CST_ICMS_GERA_DEBITO.includes((it.cstIcms ?? '').trim()) ? s.add(dec(it.vIcms)) : s),
      new Prisma.Decimal(0),
    ),
  );
}

/**
 * Apuração de ICMS por competência (regime normal — Lucro Real/Presumido),
 * conforme o registro E110 da EFD-ICMS/IPI:
 *   SALDO = (débito + ajusteDébito) − (crédito + ajusteCrédito + saldoCredorAnterior)
 *   SALDO ≥ 0 → a recolher = max(saldo − deduções, 0); credor transportado = 0
 *   SALDO < 0 → a recolher = 0; credor transportado = |SALDO| + deduções
 */
export function apurarIcms(e: EntradaApuracaoIcms): ResultadoApuracaoIcms {
  const totalDebitos = dec(e.debito).add(dec(e.ajusteDebito));
  const totalCreditos = dec(e.credito).add(dec(e.ajusteCredito)).add(dec(e.saldoCredorAnterior));
  const deducoes = dec(e.deducoes);
  const saldo = totalDebitos.minus(totalCreditos);

  if (saldo.greaterThanOrEqualTo(0)) {
    const aRecolher = saldo.minus(deducoes);
    return {
      totalDebitos: r2(totalDebitos),
      totalCreditos: r2(totalCreditos),
      saldoApurado: r2(saldo),
      aRecolher: r2(aRecolher.greaterThan(0) ? aRecolher : new Prisma.Decimal(0)),
      saldoCredorTransportar: new Prisma.Decimal('0.00'),
    };
  }
  return {
    totalDebitos: r2(totalDebitos),
    totalCreditos: r2(totalCreditos),
    saldoApurado: new Prisma.Decimal('0.00'),
    aRecolher: new Prisma.Decimal('0.00'),
    saldoCredorTransportar: r2(saldo.abs().add(deducoes)),
  };
}
