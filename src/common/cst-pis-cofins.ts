// Descrições das CST de PIS/COFINS (tabela da EFD-Contribuições).
export const DESC_CST_PIS_COFINS: Record<string, string> = {
  '01': 'Tributável — alíquota básica',
  '02': 'Tributável — alíquota diferenciada',
  '03': 'Tributável — por unidade de medida',
  '04': 'Monofásico — revenda a alíquota zero',
  '05': 'Tributável — Substituição Tributária',
  '06': 'Alíquota zero',
  '07': 'Isenta da contribuição',
  '08': 'Sem incidência da contribuição',
  '09': 'Suspensão da contribuição',
  '49': 'Outras operações de saída',
  '50': 'Crédito — operação tributada (mercado interno)',
  '51': 'Crédito — operação não tributada (mercado interno)',
  '52': 'Crédito — operação de exportação',
  '53': 'Crédito — tributadas e não tributadas (mercado interno)',
  '54': 'Crédito — tributadas (mercado interno) e exportação',
  '55': 'Crédito — não tributadas (mercado interno) e exportação',
  '56': 'Crédito — tributadas/não tributadas (interno) e exportação',
  '60': 'Crédito presumido — operação tributada (mercado interno)',
  '61': 'Crédito presumido — não tributada (mercado interno)',
  '62': 'Crédito presumido — exportação',
  '63': 'Crédito presumido — tributadas e não tributadas (interno)',
  '64': 'Crédito presumido — tributadas (interno) e exportação',
  '65': 'Crédito presumido — não tributadas (interno) e exportação',
  '66': 'Crédito presumido — tributadas/não tributadas (interno) e exportação',
  '67': 'Crédito — outras operações',
  '70': 'Aquisição sem direito a crédito',
  '71': 'Aquisição com isenção',
  '72': 'Aquisição com suspensão',
  '73': 'Aquisição a alíquota zero',
  '74': 'Aquisição sem incidência da contribuição',
  '75': 'Aquisição por Substituição Tributária',
  '98': 'Outras operações de entrada',
  '99': 'Outras operações',
};

export interface LinhaCst {
  cst: string;
  descricao: string;
  itens: number;
  base: number;
  valor: number;
}

export interface ResumoCst {
  pis: LinhaCst[];
  cofins: LinhaCst[];
}

/** Aceita Decimal do Prisma, string ou number. */
type Valor = { toString(): string } | string | number | null | undefined;

interface ItemPisCofins {
  cstPis?: string | null;
  vBcPis?: Valor;
  vPis?: Valor;
  cstCofins?: string | null;
  vBcCofins?: Valor;
  vCofins?: Valor;
}

/** Agrupa os itens por CST de PIS e por CST de COFINS (base e valor somados). */
export function resumirCstPisCofins(itens: ItemPisCofins[]): ResumoCst {
  const agrupar = (tributo: 'pis' | 'cofins'): LinhaCst[] => {
    const mapa = new Map<string, LinhaCst>();
    for (const it of itens) {
      const cst = (tributo === 'pis' ? it.cstPis : it.cstCofins) ?? '—';
      const base = Number((tributo === 'pis' ? it.vBcPis : it.vBcCofins) ?? 0);
      const valor = Number((tributo === 'pis' ? it.vPis : it.vCofins) ?? 0);
      const linha =
        mapa.get(cst) ?? { cst, descricao: DESC_CST_PIS_COFINS[cst] ?? `CST ${cst}`, itens: 0, base: 0, valor: 0 };
      linha.itens += 1;
      linha.base += base;
      linha.valor += valor;
      mapa.set(cst, linha);
    }
    return [...mapa.values()].sort((a, b) => b.valor - a.valor || b.base - a.base);
  };
  return { pis: agrupar('pis'), cofins: agrupar('cofins') };
}
