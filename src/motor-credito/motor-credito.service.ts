import { Injectable } from '@nestjs/common';
import { Prisma, RegraCredito, RegimeTributario, Tributo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CondicaoRegra,
  CreditoCbsIbs,
  DeltaOportunidade,
  EntradaCbsIbs,
  EntradaCreditoCte,
  Finalidade,
  ItemApuravel,
  ResultadoCredito,
  SpedElegibilidade,
} from './motor-credito.types';

// CST do IBS/CBS sem crédito ao adquirente (sem tributo na etapa anterior).
const CST_IBSCBS_SEM_CREDITO = ['400', '410'];
// finalidades que bloqueiam o crédito legado de ICMS (uso/consumo, ativo 1/48).
const FINALIDADES_SEM_CREDITO_ICMS: Finalidade[] = ['USO_CONSUMO', 'USO_PESSOAL', 'ATIVO'];

const CST_SPED_CREDITO = ['50', '51', '52', '53', '54', '55', '56'];
const CST_SPED_PRESUMIDO = ['60', '61', '62', '63', '64', '65', '66', '67'];
const CST_SPED_SEM_DIREITO = ['70', '71', '72', '73', '74', '75', '98', '99'];

const TRIBUTOS_PADRAO: Tributo[] = [Tributo.ICMS, Tributo.PIS, Tributo.COFINS];

/**
 * Motor de crédito DETERMINÍSTICO.
 *
 * É o ÚNICO emissor de número fiscal do sistema. Dado (item, regime, data), ele
 * resolve a RegraCredito vigente aplicável e devolve um resultado auditável —
 * sempre com a base legal da regra usada. Nenhum valor aqui vem de IA/LLM.
 *
 * `avaliarItem` é uma função pura sobre as regras carregadas, portanto
 * totalmente testável sem banco (ver motor-credito.service.spec.ts).
 */
@Injectable()
export class MotorCreditoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Carrega as regras vigentes na data para os tributos pedidos (referência global). */
  async carregarRegras(data: Date, tributos: Tributo[] = TRIBUTOS_PADRAO): Promise<RegraCredito[]> {
    return this.prisma.regraCredito.findMany({
      where: {
        ativo: true,
        tributo: { in: tributos },
        vigenciaInicio: { lte: data },
        OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: data } }],
      },
      orderBy: { prioridade: 'asc' },
    });
  }

  /** Apura ICMS, PIS e COFINS de um item, dado o regime e as regras vigentes. */
  avaliarItem(item: ItemApuravel, regime: RegimeTributario, regras: RegraCredito[]): ResultadoCredito[] {
    return TRIBUTOS_PADRAO.map((tributo) => this.avaliarTributo(tributo, item, regime, regras));
  }

  private avaliarTributo(
    tributo: Tributo,
    item: ItemApuravel,
    regime: RegimeTributario,
    regras: RegraCredito[],
  ): ResultadoCredito {
    // --- short-circuits por regime (fato jurídico que precede qualquer CST) ---
    if (tributo === Tributo.ICMS && regime === RegimeTributario.SIMPLES_NACIONAL) {
      return this.negar(
        tributo,
        'Empresa optante do Simples Nacional não se apropria de créditos de ICMS (LC 123/2006, art. 23).',
      );
    }
    if (
      (tributo === Tributo.PIS || tributo === Tributo.COFINS) &&
      regime !== RegimeTributario.LUCRO_REAL
    ) {
      return this.negar(
        tributo,
        'Regime cumulativo (Lucro Presumido) ou Simples Nacional não permite crédito de PIS/COFINS (Leis 10.637/2002 e 10.833/2003).',
      );
    }

    const regra = regras.find((r) => r.tributo === tributo && this.condicaoCasou(r, tributo, item, regime));

    if (!regra) {
      return {
        tributo,
        creditoPermitido: false,
        valorCredito: new Prisma.Decimal(0),
        regraId: null,
        regraCodigo: null,
        baseLegal: 'Sem regra de crédito aplicável — CST/CSOSN não mapeado; requer análise manual.',
        alertas: [`CST/CSOSN não mapeado para ${tributo}.`],
      };
    }

    const cond = regra.condicao as unknown as CondicaoRegra;
    const alertas: string[] = [];
    let valor = new Prisma.Decimal(0);

    if (cond.creditoPermitido) {
      valor = this.valorDoCampo(item, cond.campoValor);
      if (valor.isZero()) {
        alertas.push(`Crédito permitido, mas o campo ${cond.campoValor} está ausente ou zerado no XML.`);
      }
      if (tributo === Tributo.ICMS && this.temIcmsSt(item)) {
        alertas.push('ICMS-ST (vICMSST) destacado não gera crédito ordinário; creditado apenas o ICMS da operação própria.');
      }
    }

    return {
      tributo,
      creditoPermitido: cond.creditoPermitido,
      valorCredito: valor,
      regraId: regra.id,
      regraCodigo: regra.codigo,
      baseLegal: regra.baseLegal,
      alertas,
    };
  }

  private condicaoCasou(
    regra: RegraCredito,
    tributo: Tributo,
    item: ItemApuravel,
    regime: RegimeTributario,
  ): boolean {
    const cond = regra.condicao as unknown as CondicaoRegra;

    if (cond.regimeIn && !cond.regimeIn.includes(regime)) {
      return false;
    }
    if (cond.regimeNotIn && cond.regimeNotIn.includes(regime)) {
      return false;
    }

    const temFiltroCodigo = !!cond.cstIn || !!cond.csosnIn;
    if (!temFiltroCodigo) {
      return true; // regra dependente só do regime
    }

    if (tributo === Tributo.ICMS) {
      const cstOk = !!cond.cstIn && !!item.cstIcms && cond.cstIn.includes(item.cstIcms);
      const csosnOk = !!cond.csosnIn && !!item.csosn && cond.csosnIn.includes(item.csosn);
      return cstOk || csosnOk;
    }

    const cst = tributo === Tributo.PIS ? item.cstPis : item.cstCofins;
    return !!cond.cstIn && !!cst && cond.cstIn.includes(cst);
  }

  private valorDoCampo(item: ItemApuravel, campo: CondicaoRegra['campoValor']): Prisma.Decimal {
    const bruto = item[campo];
    return new Prisma.Decimal(bruto ?? 0);
  }

  private temIcmsSt(item: ItemApuravel): boolean {
    return !!item.vIcmsSt && !new Prisma.Decimal(item.vIcmsSt).isZero();
  }

  /**
   * Elegibilidade de crédito a partir do CST do C170 do SPED (adquirente).
   * É a "verdade legal" de elegibilidade na ingestão SPED; o cálculo do valor
   * e a comparação com o declarado ficam no SpedGapService.
   */
  avaliarCstSped(cst: string | null | undefined): SpedElegibilidade {
    const n = (cst ?? '').trim();
    if (CST_SPED_CREDITO.includes(n)) {
      return {
        elegivel: true,
        presumido: false,
        semDireito: false,
        baseLegal: 'Leis 10.637/2002 e 10.833/2003, art. 3º; IN RFB 2.121/2022 (CST 50-56 — operação com direito a crédito).',
        observacao: 'Crédito integral (sujeito a rateio nos CST 53-56).',
      };
    }
    if (CST_SPED_PRESUMIDO.includes(n)) {
      return {
        elegivel: true,
        presumido: true,
        semDireito: false,
        baseLegal: 'Crédito presumido (CST 60-67) — alíquota específica da norma; IN RFB 2.121/2022.',
        observacao: 'Alíquota presumida própria — não recalcular com 1,65%/7,6%.',
      };
    }
    return {
      elegivel: false,
      presumido: false,
      semDireito: CST_SPED_SEM_DIREITO.includes(n),
      baseLegal: 'CST sem direito a crédito (70-75/98/99); IN RFB 2.121/2022.',
      observacao: n === '98' || n === '99' ? 'CST genérico — exige análise caso a caso.' : 'Aquisição sem direito a crédito.',
    };
  }

  /**
   * Crédito de ICMS sobre CT-e (serviço de transporte). Decisão determinística e
   * auditável: o crédito do frete é do tomador, contribuinte em regime normal,
   * com destaque de ICMS, vinculado a operação tributada. O número é sempre o
   * vICMS destacado no XML (lido, nunca recalculado por IA).
   * Base legal: CF art. 155, II e §2º, I; LC 87/96, arts. 19-20; LC 123/06 art. 23.
   */
  avaliarCreditoCte(e: EntradaCreditoCte): ResultadoCredito {
    const dec = (v: EntradaCreditoCte['vIcms']) => new Prisma.Decimal(v ?? 0);
    const ICMS = Tributo.ICMS;

    const negar = (baseLegal: string, alertas: string[]): ResultadoCredito => ({
      tributo: ICMS,
      creditoPermitido: false,
      valorCredito: new Prisma.Decimal(0),
      regraId: null,
      regraCodigo: 'CTE-ICMS',
      baseLegal,
      alertas,
    });

    // 1) Tomador optante do Simples não toma crédito ordinário.
    if (e.regime === RegimeTributario.SIMPLES_NACIONAL) {
      return negar('LC 123/06, art. 23 — optante do Simples não se apropria de crédito de ICMS.', [
        'A1: tomador optante do Simples Nacional não toma crédito ordinário (LC 123/06, art. 23).',
      ]);
    }
    // 2) Empresa precisa ser a tomadora do serviço (toma3/toma4).
    if (!e.tomadorEhEmpresa) {
      return negar('LC 87/96, art. 20 — crédito do frete pertence ao tomador do serviço.', [
        'A2: empresa não é a tomadora (toma3/toma4 diverge do CNPJ) — provável CIF; crédito é do remetente.',
      ]);
    }
    // 3) Se houver CFOP de escrituração informado e for de saída/prestação, barra.
    if (e.cfopEscrituracao && /^[56]/.test(e.cfopEscrituracao)) {
      return negar('CFOP de escrituração incompatível com tomada de serviço de transporte.', [
        'A3: CFOP de escrituração é de saída/prestação (5/6xxx); a tomada exige 1/2.35x.',
      ]);
    }

    const baseCredito = 'CF art. 155, §2º, I; LC 87/96, art. 20 — crédito do ICMS do serviço de transporte tomado.';
    const permitir = (valor: Prisma.Decimal, baseLegal: string, alertas: string[]): ResultadoCredito => {
      const al = [...alertas];
      if (e.operacaoVinculadaTributada !== true) {
        al.push('A0: confirmar vínculo do transporte com operação tributada/creditável (entrada p/ revenda/industrialização).');
      }
      if (e.vTPrest && valor.greaterThan(dec(e.vTPrest))) {
        al.push('A10: vICMS incompatível com vTPrest — possível inconsistência no XML.');
      }
      return { tributo: ICMS, creditoPermitido: true, valorCredito: valor, regraId: null, regraCodigo: 'CTE-ICMS', baseLegal, alertas: al };
    };

    const cBenefAlerta = e.cBenef
      ? ['A7: há cBenef/benefício fiscal — possível crédito presumido/outorgado; confirmar norma estadual.']
      : [];

    switch (e.grupoIcms) {
      case 'ICMS00':
        return permitir(dec(e.vIcms), baseCredito, []);
      case 'ICMS20':
        return dec(e.vIcms).greaterThan(0)
          ? permitir(dec(e.vIcms), `${baseCredito} (BC reduzida — LC 87/96 art. 21)`, cBenefAlerta)
          : negar(baseCredito, ['A6: ICMS20 sem vICMS destacado — verificar XML.']);
      case 'ICMS45':
        return negar('LC 87/96, art. 20, §3º; CF art. 155, §2º, II — operação sem imposto destacado.', [
          'A4: sem destaque de ICMS (CST 40/41/51 isenta/não tributada/diferimento) — sem crédito.',
        ]);
      case 'ICMS60':
        return negar('LC 87/96 — ICMS do transporte retido por substituição tributária.', [
          'A8: ICMS-ST (CST 60) — crédito segue regra de ST da UF, não é crédito ordinário.',
        ]);
      case 'ICMS90':
        if (dec(e.vIcms).greaterThan(0)) {
          return permitir(dec(e.vIcms), baseCredito, cBenefAlerta);
        }
        return negar(baseCredito, [
          dec(e.vCred).greaterThan(0)
            ? 'A8: vCred (presumido/outorgado) informado — segue regra estadual; não é crédito ordinário.'
            : 'A4: sem destaque de ICMS — sem crédito.',
        ]);
      case 'ICMSOutraUF':
        return dec(e.vIcms).greaterThan(0)
          ? negar('Tratamento interestadual específico do ICMS.', [
              'A9: ICMSOutraUF — tratamento interestadual específico; sem crédito ordinário automático.',
            ])
          : negar('Tratamento interestadual específico do ICMS.', [
              'A9: ICMSOutraUF — sem crédito ordinário automático.',
            ]);
      case 'ICMSSN':
        return negar('LC 123/06, art. 23 — transportadora optante do Simples (exclui prestação de serviço).', [
          'A5: transportadora optante do Simples (ICMSSN) — sem crédito ordinário ao tomador.',
        ]);
      default:
        return negar('Grupo de ICMS do CT-e não mapeado — requer análise manual.', [
          `Grupo ICMS não mapeado: ${e.grupoIcms}.`,
        ]);
    }
  }

  /**
   * Crédito de CBS/IBS no novo modelo (crédito financeiro amplo — LC 214/2025
   * art. 47): toda aquisição vinculada à atividade gera crédito, salvo uso/consumo
   * PESSOAL (art. 57) e operações sem tributo na etapa (CST 400/410).
   * Devolve o crédito EFETIVO (alíquota-teste 2026, simbólico) e o POTENCIAL
   * (projeção sob a alíquota de referência cheia — o número de negócio).
   */
  avaliarCreditoCbsIbs(e: EntradaCbsIbs): CreditoCbsIbs {
    const dec = (v: EntradaCbsIbs['vBc']) => new Prisma.Decimal(v ?? 0);
    const cst = (e.cst ?? '').trim();

    if (e.finalidade === 'USO_PESSOAL') {
      return {
        creditoPermitido: false,
        creditoEfetivo: new Prisma.Decimal(0),
        creditoPotencial: new Prisma.Decimal(0),
        baseLegal: 'LC 214/2025, art. 57 — uso/consumo pessoal não gera crédito.',
        alertas: ['Uso/consumo pessoal (art. 57): vedado o crédito de CBS/IBS.'],
      };
    }
    if (CST_IBSCBS_SEM_CREDITO.includes(cst)) {
      return {
        creditoPermitido: false,
        creditoEfetivo: new Prisma.Decimal(0),
        creditoPotencial: new Prisma.Decimal(0),
        baseLegal: `LC 214/2025 — CST ${cst} (isenção/imunidade): sem tributo na etapa, sem crédito.`,
        alertas: [],
      };
    }

    const efetivo = dec(e.vCbs).add(dec(e.vIbsUf)).add(dec(e.vIbsMun));
    const potencial = dec(e.vBc).mul(e.aliqRef.cbs + e.aliqRef.ibs).toDecimalPlaces(2);
    return {
      creditoPermitido: true,
      creditoEfetivo: efetivo.toDecimalPlaces(2),
      creditoPotencial: potencial,
      baseLegal: `LC 214/2025, art. 47 — crédito financeiro amplo${e.cClassTrib ? ` (cClassTrib ${e.cClassTrib})` : ''}.`,
      alertas: [
        'Crédito CBS/IBS de 2026 é simbólico (alíquota-teste); potencial projetado sob alíquota de referência (parametrizável).',
        'LC 214/2025 art. 48 — na transição, crédito admitido mesmo sem prova de recolhimento (split payment ainda não operante).',
      ],
    };
  }

  /**
   * Delta de oportunidade: compara, na MESMA NF-e de entrada, o crédito LEGADO
   * (ICMS/PIS/COFINS) com o crédito NOVO (CBS/IBS). O valor de negócio é o
   * `deltaPotencial` = crédito novo sob alíquota de referência − crédito legado.
   */
  compararRegimes(params: {
    legado: ItemApuravel;
    novo: EntradaCbsIbs;
    regime: RegimeTributario;
    regras: import('@prisma/client').RegraCredito[];
    finalidade?: Finalidade;
  }): DeltaOportunidade {
    const { legado, novo, regime, regras, finalidade } = params;
    const resultados = this.avaliarItem(legado, regime, regras);
    const valor = (t: Tributo) => {
      const r = resultados.find((x) => x.tributo === t);
      return r && r.creditoPermitido ? r.valorCredito : new Prisma.Decimal(0);
    };

    // uso/consumo/ativo bloqueiam o crédito físico de ICMS no legado
    const bloqueiaIcmsLegado = finalidade ? FINALIDADES_SEM_CREDITO_ICMS.includes(finalidade) : false;
    const icms = bloqueiaIcmsLegado ? new Prisma.Decimal(0) : valor(Tributo.ICMS);
    const pis = valor(Tributo.PIS);
    const cofins = valor(Tributo.COFINS);
    const legadoTotal = icms.add(pis).add(cofins);

    const cbsIbs = this.avaliarCreditoCbsIbs({ ...novo, finalidade });
    const novoEfetivo = cbsIbs.creditoEfetivo;
    const novoPotencial = cbsIbs.creditoPotencial;
    const deltaPotencial = novoPotencial.minus(legadoTotal).toDecimalPlaces(2);
    const pctGanho = legadoTotal.isZero() ? null : Number(deltaPotencial.div(legadoTotal).toDecimalPlaces(4));

    const alertas = [...cbsIbs.alertas];
    if (bloqueiaIcmsLegado && cbsIbs.creditoPermitido) {
      alertas.push('Item de uso/consumo/ativo: não credita ICMS no legado, mas credita CBS/IBS no novo modelo (art. 47).');
    }
    if (legadoTotal.isZero() && cbsIbs.creditoPermitido) {
      alertas.push('Crédito 100% novo: a aquisição não gerava crédito no regime atual e passa a gerar com a CBS/IBS.');
    }

    return {
      legado: { icms, pis, cofins, total: legadoTotal },
      novoEfetivo,
      novoPotencial,
      deltaPotencial,
      pctGanho,
      baseLegal: [cbsIbs.baseLegal, 'Comparação CBS/IBS × ICMS/PIS/COFINS (transição EC 132/2023).'],
      alertas,
    };
  }

  private negar(tributo: Tributo, baseLegal: string): ResultadoCredito {
    return {
      tributo,
      creditoPermitido: false,
      valorCredito: new Prisma.Decimal(0),
      regraId: null,
      regraCodigo: null,
      baseLegal,
      alertas: [],
    };
  }
}
