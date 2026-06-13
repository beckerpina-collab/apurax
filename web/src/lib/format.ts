export const brl = (v: number | string): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));

export const pct = (v: number | null): string =>
  v === null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(v);

export const cnpjMask = (c: string): string =>
  (c ?? '').replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

export const dataBR = (s: string | null | undefined): string => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

/** Mês atual no formato YYYY-MM, SEMPRE no fuso de São Paulo (preferência do usuário). */
export function mesAtualSP(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const ano = partes.find((p) => p.type === 'year')?.value ?? '2026';
  const mes = partes.find((p) => p.type === 'month')?.value ?? '01';
  return `${ano}-${mes}`;
}

export const dataHoraBR = (s: string | null | undefined): string => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};
