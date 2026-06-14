import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Tamanho de página padrão de TODAS as listas do app. */
export const PAGE_SIZE = 100;

interface Props {
  page: number; // 1-based
  total: number; // total de registros (não da página)
  pageSize?: number;
  onPageChange: (page: number) => void;
}

/**
 * Paginação controlada e reutilizável (pt-BR). Some sozinha quando há ≤ 1 página,
 * então pode ser colocada sob qualquer tabela sem poluir listas pequenas.
 */
export default function TablePagination({ page, total, pageSize = PAGE_SIZE, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Reconcilia o pai se a página ficar fora de faixa (ex.: filtro encolheu a lista) —
  // independe de cada tela lembrar de resetar e vale até quando a barra está oculta.
  useEffect(() => {
    if (page > totalPages) onPageChange(totalPages);
    else if (page < 1) onPageChange(1);
  }, [page, totalPages, onPageChange]);

  if (total <= pageSize) return null;

  const atual = Math.min(Math.max(1, page), totalPages);
  const from = (atual - 1) * pageSize + 1;
  const to = Math.min(atual * pageSize, total);
  const go = (p: number) => onPageChange(Math.min(totalPages, Math.max(1, p)));

  // Janela de até 5 números centrada na página atual.
  const win = 2;
  const start = Math.max(1, Math.min(atual - win, totalPages - win * 2));
  const end = Math.min(totalPages, start + win * 2);
  const nums: number[] = [];
  for (let i = start; i <= end; i++) nums.push(i);

  return (
    <div className="flex flex-col items-center justify-between gap-3 pt-4 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        Mostrando{' '}
        <span className="font-medium text-foreground tabular-nums">
          {from}–{to}
        </span>{' '}
        de <span className="font-medium text-foreground tabular-nums">{total}</span> registro(s)
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2"
          disabled={atual <= 1}
          onClick={() => go(atual - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>
        {start > 1 && <span className="px-1 text-xs text-muted-foreground">…</span>}
        {nums.map((n) => (
          <Button
            key={n}
            variant={n === atual ? 'default' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0 tabular-nums"
            onClick={() => go(n)}
          >
            {n}
          </Button>
        ))}
        {end < totalPages && <span className="px-1 text-xs text-muted-foreground">…</span>}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2"
          disabled={atual >= totalPages}
          onClick={() => go(atual + 1)}
        >
          <span className="hidden sm:inline">Próxima</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
