import { cn } from '@/lib/utils';

const MAP: Record<string, string> = {
  SUGERIDO: 'bg-chart-3/15 text-chart-3 border-chart-3/30',
  HOMOLOGADO: 'bg-accent/15 text-accent border-accent/30',
  GLOSADO: 'bg-destructive/15 text-destructive border-destructive/30',
  ATIVO: 'bg-accent/15 text-accent border-accent/30',
  INATIVO: 'bg-muted text-muted-foreground border-border',
  OK: 'bg-accent/15 text-accent border-accent/30',
  ATENCAO: 'bg-chart-3/15 text-chart-3 border-chart-3/30',
  DIVERGENCIA: 'bg-destructive/15 text-destructive border-destructive/30',
};

const LABEL: Record<string, string> = {
  SUGERIDO: 'Sugerido',
  HOMOLOGADO: 'Homologado',
  GLOSADO: 'Glosado',
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  OK: 'OK',
  ATENCAO: 'Atenção',
  DIVERGENCIA: 'Divergência',
};

export default function StatusPill({ status }: { status: string }) {
  const key = (status ?? '').toUpperCase();
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', MAP[key] ?? MAP.INATIVO)}>
      {LABEL[key] ?? status}
    </span>
  );
}
