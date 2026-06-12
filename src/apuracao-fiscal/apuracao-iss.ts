import { Prisma } from '@prisma/client';

// ISS (municipal, LC 116/2003) — CUMULATIVO, sem crédito. O débito vem das
// NFS-e EMITIDAS; vem de NFS-e (documento municipal/padrão nacional), NÃO de
// NF-e/NFC-e/CT-e — a ingestão de NFS-e é uma sub-etapa à parte.
//
// tpRetISSQN (padrão nacional — polaridade verificada):
//   1 = NÃO retido (prestador recolhe → entra no débito a recolher)
//   2 = Retido pelo tomador  | 3 = Retido pelo intermediário (prestador NÃO recolhe)
// tribISSQN: 1 = tributável; 2 = imunidade; 3 = exportação; 4 = não incidência (2-4 não geram débito).

type Num = Prisma.Decimal | string | number | null | undefined;
const dec = (v: Num) => new Prisma.Decimal(v ?? 0);
const r2 = (d: Prisma.Decimal) => d.toDecimalPlaces(2);

export interface NotaServicoIss {
  vISSQN?: Num; // valor do ISS destacado
  vBC?: Num; // base (fallback: vBC × pAliqAplic)
  pAliqAplic?: Num; // alíquota aplicada (2%–5%)
  tpRetISSQN?: string | number; // 1=não retido, 2/3=retido
  tribISSQN?: string | number; // 1=tributável, 2/3/4=fora
}

export interface ResultadoIss {
  debito: Prisma.Decimal; // ISS-próprio (não retido, tributável)
  aRecolher: Prisma.Decimal; // = débito (cumulativo, sem crédito)
  retidoFonte: Prisma.Decimal; // informativo (retido pelo tomador/intermediário)
  totalNotas: number;
}

function valorIss(n: NotaServicoIss): Prisma.Decimal {
  const v = dec(n.vISSQN);
  if (!v.isZero()) return v;
  return dec(n.vBC).mul(dec(n.pAliqAplic)).div(100); // fallback
}

/** Apura o ISS-próprio do prestador (cumulativo). */
export function apurarIss(notas: NotaServicoIss[]): ResultadoIss {
  let debito = new Prisma.Decimal(0);
  let retido = new Prisma.Decimal(0);
  for (const n of notas) {
    const trib = String(n.tribISSQN ?? '1');
    if (trib !== '1') continue; // imune/exportação/não incidência → fora
    const ret = String(n.tpRetISSQN ?? '1');
    if (ret === '1') {
      debito = debito.add(valorIss(n)); // prestador recolhe
    } else {
      retido = retido.add(valorIss(n)); // retido na fonte (informativo)
    }
  }
  return { debito: r2(debito), aRecolher: r2(debito), retidoFonte: r2(retido), totalNotas: notas.length };
}
