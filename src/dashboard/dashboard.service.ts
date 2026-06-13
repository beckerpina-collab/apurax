import { Injectable } from '@nestjs/common';
import { DESC_CST_PIS_COFINS, type LinhaCst } from '../common/cst-pis-cofins';
import { PrismaService } from '../prisma/prisma.service';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export interface FiltroDashboard {
  ano?: number;
  mes?: number;
}

/**
 * Resumo REAL do painel, agregado do banco. Filtro opcional:
 * — sem filtro: tudo (série = últimas 6 competências apuradas);
 * — só ano: agrega o ano (série = competências do ano);
 * — ano+mês: agrega a competência (série continua mostrando o ano, p/ contexto).
 * A data fiscal usada é a EMISSÃO do documento (competência), não a importação.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async resumo(filtro: FiltroDashboard = {}) {
    const db = this.prisma.scoped;
    const periodo = this.periodo(filtro);
    const whereDoc = periodo ? { dataEmissao: { gte: periodo.inicio, lt: periodo.fim } } : {};
    const whereCredito = periodo ? { documento: { dataEmissao: { gte: periodo.inicio, lt: periodo.fim } } } : {};
    const whereLacuna = periodo ? { importacao: { dtIni: { gte: periodo.inicio, lt: periodo.fim } } } : {};
    const whereImposto = filtro.ano ? { ano: filtro.ano } : {};

    const [sugerido, homologado, lacunas, documentos, porCompetencia, faixaDocs, saidaAgg, saidaIcms, grpPis, grpCofins] =
      await Promise.all([
        db.apuracaoCredito.aggregate({
          _sum: { valorCredito: true },
          where: { status: 'SUGERIDO', creditoPermitido: true, ...whereCredito },
        }),
        db.apuracaoCredito.aggregate({
          _sum: { valorCredito: true },
          where: { status: 'HOMOLOGADO', creditoPermitido: true, ...whereCredito },
        }),
        db.lacunaCredito.aggregate({ _sum: { lacuna: true }, where: { lacuna: { gt: 0 }, ...whereLacuna } }),
        db.documentoFiscal.count({ where: whereDoc }),
        db.apuracaoImposto.groupBy({
          by: ['ano', 'mes'],
          _sum: { credito: true, aRecolher: true },
          where: whereImposto,
          orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
        }),
        // faixa de anos com documentos (sempre SEM filtro — alimenta o seletor)
        db.documentoFiscal.aggregate({ _min: { dataEmissao: true }, _max: { dataEmissao: true } }),
        // SAÍDAS importadas (direto dos documentos — não precisa rodar apuração)
        db.documentoFiscal.aggregate({
          _count: true,
          _sum: { valorTotal: true },
          where: { tipoOperacao: 'SAIDA', ...whereDoc },
        }),
        db.itemDocumento.aggregate({
          _sum: { vIcms: true },
          where: { documento: { tipoOperacao: 'SAIDA', ...whereDoc } },
        }),
        // PIS/COFINS de SAÍDA por CST (débito) — resumo no painel.
        db.itemDocumento.groupBy({
          by: ['cstPis'],
          _count: true,
          _sum: { vPis: true, vBcPis: true },
          where: { documento: { tipoOperacao: 'SAIDA', ...whereDoc } },
        }),
        db.itemDocumento.groupBy({
          by: ['cstCofins'],
          _count: true,
          _sum: { vCofins: true, vBcCofins: true },
          where: { documento: { tipoOperacao: 'SAIDA', ...whereDoc } },
        }),
      ]);

    const linhaCst = (cst: string | null, itens: number, base: unknown, valor: unknown): LinhaCst => ({
      cst: cst ?? '—',
      descricao: (cst && DESC_CST_PIS_COFINS[cst]) || (cst ? `CST ${cst}` : 'Sem CST'),
      itens,
      base: Number((base as { toString(): string } | null) ?? 0),
      valor: Number((valor as { toString(): string } | null) ?? 0),
    });
    const cstPis = grpPis
      .map((g) => linhaCst(g.cstPis, g._count, g._sum.vBcPis, g._sum.vPis))
      .sort((a, b) => b.valor - a.valor || b.base - a.base);
    const cstCofins = grpCofins
      .map((g) => linhaCst(g.cstCofins, g._count, g._sum.vBcCofins, g._sum.vCofins))
      .sort((a, b) => b.valor - a.valor || b.base - a.base);
    const pisDebito = cstPis.reduce((s, l) => s + l.valor, 0);
    const cofinsDebito = cstCofins.reduce((s, l) => s + l.valor, 0);

    const serie = (filtro.ano ? porCompetencia : porCompetencia.slice(-6)).map((c) => ({
      mes: `${MESES[c.mes - 1]}/${String(c.ano).slice(2)}`,
      credito: Number(c._sum.credito ?? 0),
      debito: Number(c._sum.aRecolher ?? 0),
    }));

    // imposto a pagar conforme o filtro
    let impostoTotal: number;
    if (filtro.ano && filtro.mes) {
      impostoTotal = Number(porCompetencia.find((c) => c.mes === filtro.mes)?._sum.aRecolher ?? 0);
    } else if (filtro.ano) {
      impostoTotal = porCompetencia.reduce((s, c) => s + Number(c._sum.aRecolher ?? 0), 0);
    } else {
      impostoTotal = Number(porCompetencia.at(-1)?._sum.aRecolher ?? 0);
    }

    const competencia =
      filtro.ano && filtro.mes
        ? `competência ${MESES[filtro.mes - 1]}/${filtro.ano}`
        : filtro.ano
          ? `ano ${filtro.ano}`
          : 'todas as competências';

    const anoMin = faixaDocs._min.dataEmissao?.getUTCFullYear();
    const anoMax = faixaDocs._max.dataEmissao?.getUTCFullYear();
    const anosDisponiveis: number[] = [];
    if (anoMin && anoMax) {
      for (let a = anoMax; a >= anoMin; a--) anosDisponiveis.push(a);
    }

    return {
      creditoSugerido: Number(sugerido._sum.valorCredito ?? 0),
      creditoHomologado: Number(homologado._sum.valorCredito ?? 0),
      lacunaSped: Number(lacunas._sum.lacuna ?? 0),
      deltaReforma: 0, // comparações da reforma não são persistidas (tela Reforma é sob demanda)
      competencia,
      impostoAPagar: { total: impostoTotal },
      saidas: {
        quantidade: saidaAgg._count ?? 0,
        faturamento: Number(saidaAgg._sum.valorTotal ?? 0),
        icmsDebito: Number(saidaIcms._sum.vIcms ?? 0),
        pisDebito,
        cofinsDebito,
      },
      resumoCst: { pis: cstPis, cofins: cstCofins },
      serie,
      documentos,
      anosDisponiveis,
    };
  }

  /** Converte o filtro em faixa [inicio, fim) sobre a data de emissão. */
  private periodo(f: FiltroDashboard): { inicio: Date; fim: Date } | null {
    if (!f.ano) return null;
    if (f.mes) {
      return {
        inicio: new Date(Date.UTC(f.ano, f.mes - 1, 1)),
        fim: new Date(Date.UTC(f.mes === 12 ? f.ano + 1 : f.ano, f.mes === 12 ? 0 : f.mes, 1)),
      };
    }
    return { inicio: new Date(Date.UTC(f.ano, 0, 1)), fim: new Date(Date.UTC(f.ano + 1, 0, 1)) };
  }
}
