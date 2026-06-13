/**
 * Converte (ano, mês) em faixa [início, fim) sobre datas de emissão.
 * Fronteiras em UTC — MESMA convenção do painel, p/ todas as telas baterem.
 */
export function faixaCompetencia(ano?: number, mes?: number): { inicio: Date; fim: Date } | null {
  if (!ano) return null;
  if (mes) {
    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(mes === 12 ? ano + 1 : ano, mes === 12 ? 0 : mes, 1));
    return { inicio, fim };
  }
  // só ano: o ano inteiro (mesma convenção do painel)
  return { inicio: new Date(Date.UTC(ano, 0, 1)), fim: new Date(Date.UTC(ano + 1, 0, 1)) };
}

/** Normaliza query params ano/mes (strings) em números válidos ou undefined. */
export function parseCompetencia(ano?: string, mes?: string): { ano?: number; mes?: number } {
  const a = Number(ano);
  const m = Number(mes);
  return {
    ano: Number.isInteger(a) && a > 0 ? a : undefined,
    mes: Number.isInteger(m) && m >= 1 && m <= 12 ? m : undefined,
  };
}
