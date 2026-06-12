import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MotorCreditoService } from '../motor-credito/motor-credito.service';
import { SpedArquivo, SpedDocumento, SpedItem } from './sped-parser.service';

type TributoPC = 'PIS' | 'COFINS';

const ALIQ_PADRAO: Record<TributoPC, Prisma.Decimal> = {
  PIS: new Prisma.Decimal('1.65'),
  COFINS: new Prisma.Decimal('7.6'),
};
const TOLERANCIA = new Prisma.Decimal('0.02');

export interface AchadoLacuna {
  tributo: TributoPC;
  // NAO_APROVEITADO | INCONSISTENCIA | INDEVIDO | REVISAO_PRESUMIDO
  tipo: string;
  referencia: string;
  cst: string;
  cfop: string;
  creditoDeclarado: Prisma.Decimal;
  creditoPotencial: Prisma.Decimal;
  lacuna: Prisma.Decimal; // potencial - declarado (negativo = indébito/risco)
  baseLegal: string;
  observacao: string;
}

export interface ResultadoLacuna {
  achados: AchadoLacuna[];
  totalItens: number;
  lacunaPisTotal: Prisma.Decimal;
  lacunaCofinsTotal: Prisma.Decimal;
}

/**
 * Análise determinística de lacuna de crédito sobre os itens (C170) de entrada
 * do SPED. Compara o crédito ESCRITURADO (declarado) com o crédito DEVIDO que o
 * motor reconhece pelo CST. Quatro tipos de achado:
 *  - NAO_APROVEITADO: CST com direito, mas crédito zerado -> dinheiro na mesa.
 *  - INCONSISTENCIA: crédito divergente de VL_BC × alíquota.
 *  - INDEVIDO: CST sem direito com crédito > 0 -> risco de glosa.
 *  - REVISAO_PRESUMIDO: crédito presumido (60-67) não escriturado -> revisar.
 */
@Injectable()
export class SpedGapService {
  constructor(private readonly motor: MotorCreditoService) {}

  analisar(arquivo: SpedArquivo): ResultadoLacuna {
    const achados: AchadoLacuna[] = [];
    let totalItens = 0;

    for (const doc of arquivo.documentos) {
      if (doc.indOper !== '0') continue; // só entradas geram crédito
      for (const item of doc.itens) {
        totalItens++;
        const ref = `doc ${doc.numDoc}/item ${item.numItem}`;
        this.analisarTributo('PIS', item, ref, achados);
        this.analisarTributo('COFINS', item, ref, achados);
      }
    }

    const soma = (t: TributoPC) =>
      achados
        .filter((a) => a.tributo === t && a.lacuna.greaterThan(0))
        .reduce((s, a) => s.add(a.lacuna), new Prisma.Decimal(0));

    return {
      achados,
      totalItens,
      lacunaPisTotal: soma('PIS'),
      lacunaCofinsTotal: soma('COFINS'),
    };
  }

  private analisarTributo(tributo: TributoPC, item: SpedItem, ref: string, out: AchadoLacuna[]): void {
    const cst = tributo === 'PIS' ? item.cstPis : item.cstCofins;
    const vlBc = tributo === 'PIS' ? item.vlBcPis : item.vlBcCofins;
    const aliq = tributo === 'PIS' ? item.aliqPis : item.aliqCofins;
    const declarado = tributo === 'PIS' ? item.vlPis : item.vlCofins;

    const elig = this.motor.avaliarCstSped(cst);
    const r2 = (d: Prisma.Decimal) => d.toDecimalPlaces(2);

    if (elig.semDireito) {
      if (declarado.greaterThan(0)) {
        out.push({
          tributo,
          tipo: 'INDEVIDO',
          referencia: ref,
          cst,
          cfop: item.cfop,
          creditoDeclarado: r2(declarado),
          creditoPotencial: new Prisma.Decimal(0),
          lacuna: r2(declarado.negated()),
          baseLegal: elig.baseLegal,
          observacao: 'Crédito escriturado em CST sem direito — risco de glosa.',
        });
      }
      return;
    }

    if (elig.presumido) {
      if (declarado.isZero()) {
        out.push({
          tributo,
          tipo: 'REVISAO_PRESUMIDO',
          referencia: ref,
          cst,
          cfop: item.cfop,
          creditoDeclarado: new Prisma.Decimal(0),
          creditoPotencial: new Prisma.Decimal(0),
          lacuna: new Prisma.Decimal(0),
          baseLegal: elig.baseLegal,
          observacao: 'Crédito presumido não escriturado — requer alíquota presumida da norma; revisar manualmente.',
        });
      }
      return;
    }

    // CST com direito a crédito (50-56)
    const aliqUsar = aliq.greaterThan(0) ? aliq : ALIQ_PADRAO[tributo];
    const esperado = r2(vlBc.mul(aliqUsar).div(100));

    if (declarado.isZero() && vlBc.greaterThan(0)) {
      out.push({
        tributo,
        tipo: 'NAO_APROVEITADO',
        referencia: ref,
        cst,
        cfop: item.cfop,
        creditoDeclarado: new Prisma.Decimal(0),
        creditoPotencial: esperado,
        lacuna: esperado,
        baseLegal: elig.baseLegal,
        observacao: 'CST com direito a crédito, porém crédito não escriturado (VL ausente/zerado).',
      });
      return;
    }

    if (declarado.greaterThan(0) && declarado.minus(esperado).abs().greaterThan(TOLERANCIA)) {
      out.push({
        tributo,
        tipo: 'INCONSISTENCIA',
        referencia: ref,
        cst,
        cfop: item.cfop,
        creditoDeclarado: r2(declarado),
        creditoPotencial: esperado,
        lacuna: r2(esperado.minus(declarado)),
        baseLegal: elig.baseLegal,
        observacao: 'Crédito escriturado diverge de VL_BC × alíquota.',
      });
    }
  }
}
