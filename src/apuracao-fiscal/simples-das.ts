// Simples Nacional — cálculo do DAS (PGDAS-D). NÃO é débito-crédito: incide
// sobre a receita bruta do mês com alíquota efetiva progressiva (LC 123/2006
// art. 18; Res. CGSN 140/2018). Tabelas de 2026 (inalteradas) — versionar.
// (Anexos II/IV/V: revalidar PD contra a Resolução antes do go-live.)

export type Anexo = 'I' | 'II' | 'III' | 'IV' | 'V';

interface Faixa {
  ate: number; // teto da RBT12 (R$)
  aliq: number; // alíquota nominal (%)
  pd: number; // parcela a deduzir (R$)
}

export const TABELA_ANEXOS_2026: Record<Anexo, Faixa[]> = {
  I: [
    { ate: 180_000, aliq: 4.0, pd: 0 },
    { ate: 360_000, aliq: 7.3, pd: 5_940 },
    { ate: 720_000, aliq: 9.5, pd: 13_860 },
    { ate: 1_800_000, aliq: 10.7, pd: 22_500 },
    { ate: 3_600_000, aliq: 14.3, pd: 87_300 },
    { ate: 4_800_000, aliq: 19.0, pd: 378_000 },
  ],
  II: [
    { ate: 180_000, aliq: 4.5, pd: 0 },
    { ate: 360_000, aliq: 7.8, pd: 5_940 },
    { ate: 720_000, aliq: 10.0, pd: 13_860 },
    { ate: 1_800_000, aliq: 11.2, pd: 22_500 },
    { ate: 3_600_000, aliq: 14.7, pd: 85_500 },
    { ate: 4_800_000, aliq: 30.0, pd: 720_000 },
  ],
  III: [
    { ate: 180_000, aliq: 6.0, pd: 0 },
    { ate: 360_000, aliq: 11.2, pd: 9_360 },
    { ate: 720_000, aliq: 13.5, pd: 17_640 },
    { ate: 1_800_000, aliq: 16.0, pd: 35_640 },
    { ate: 3_600_000, aliq: 21.0, pd: 125_640 },
    { ate: 4_800_000, aliq: 33.0, pd: 648_000 },
  ],
  IV: [
    { ate: 180_000, aliq: 4.5, pd: 0 },
    { ate: 360_000, aliq: 9.0, pd: 8_100 },
    { ate: 720_000, aliq: 10.2, pd: 12_420 },
    { ate: 1_800_000, aliq: 14.0, pd: 39_780 },
    { ate: 3_600_000, aliq: 22.0, pd: 183_780 },
    { ate: 4_800_000, aliq: 33.0, pd: 828_000 },
  ],
  V: [
    { ate: 180_000, aliq: 15.5, pd: 0 },
    { ate: 360_000, aliq: 18.0, pd: 4_500 },
    { ate: 720_000, aliq: 19.5, pd: 9_900 },
    { ate: 1_800_000, aliq: 20.5, pd: 17_100 },
    { ate: 3_600_000, aliq: 23.0, pd: 62_100 },
    { ate: 4_800_000, aliq: 30.5, pd: 540_000 },
  ],
};

export interface ResultadoDas {
  anexo: Anexo;
  faixa: number; // 1..6
  aliquotaNominal: number; // %
  parcelaDeduzir: number; // R$
  aliquotaEfetiva: number; // fração (ex.: 0.0845)
  das: number; // R$ do mês = receita × alíquota efetiva
}

/** Seleciona a faixa pela RBT12 (receita acumulada dos 12 meses anteriores). */
export function faixaPorRbt12(anexo: Anexo, rbt12: number): { faixa: Faixa; indice: number } {
  const tabela = TABELA_ANEXOS_2026[anexo];
  const idx = tabela.findIndex((f) => rbt12 <= f.ate);
  const indice = idx === -1 ? tabela.length - 1 : idx;
  return { faixa: tabela[indice], indice: indice + 1 };
}

/** Fator R: folha/receita (12m) ≥ 28% → Anexo III; senão Anexo V. */
export function anexoPorFatorR(folha12: number, receita12: number): 'III' | 'V' {
  if (receita12 <= 0) return 'V';
  return folha12 / receita12 >= 0.28 ? 'III' : 'V';
}

/**
 * DAS do mês: alíquota efetiva = (RBT12 × aliq − PD) / RBT12; DAS = receita × efetiva.
 * A faixa vem da RBT12; o DAS incide sobre a receita do mês no anexo.
 */
export function calcularDas(params: { anexo: Anexo; rbt12: number; receitaMes: number }): ResultadoDas {
  const { anexo, rbt12, receitaMes } = params;
  const { faixa, indice } = faixaPorRbt12(anexo, rbt12);
  const aliquotaEfetiva = rbt12 > 0 ? (rbt12 * (faixa.aliq / 100) - faixa.pd) / rbt12 : faixa.aliq / 100;
  const das = Math.round(receitaMes * aliquotaEfetiva * 100) / 100;
  return {
    anexo,
    faixa: indice,
    aliquotaNominal: faixa.aliq,
    parcelaDeduzir: faixa.pd,
    aliquotaEfetiva: Math.round(aliquotaEfetiva * 1e6) / 1e6,
    das,
  };
}
