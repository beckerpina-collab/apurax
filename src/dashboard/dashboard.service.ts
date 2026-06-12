import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Resumo REAL do painel, agregado do banco (substitui o mock do front). */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async resumo() {
    const db = this.prisma.scoped;
    const [sugerido, homologado, lacunas, documentos, porCompetencia] = await Promise.all([
      db.apuracaoCredito.aggregate({
        _sum: { valorCredito: true },
        where: { status: 'SUGERIDO', creditoPermitido: true },
      }),
      db.apuracaoCredito.aggregate({
        _sum: { valorCredito: true },
        where: { status: 'HOMOLOGADO', creditoPermitido: true },
      }),
      db.lacunaCredito.aggregate({ _sum: { lacuna: true }, where: { lacuna: { gt: 0 } } }),
      db.documentoFiscal.count(),
      db.apuracaoImposto.groupBy({
        by: ['ano', 'mes'],
        _sum: { credito: true, aRecolher: true },
        orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
      }),
    ]);

    const serie = porCompetencia.slice(-6).map((c) => ({
      mes: `${MESES[c.mes - 1]}/${String(c.ano).slice(2)}`,
      credito: Number(c._sum.credito ?? 0),
      debito: Number(c._sum.aRecolher ?? 0),
    }));
    const ultima = porCompetencia.at(-1);

    return {
      creditoSugerido: Number(sugerido._sum.valorCredito ?? 0),
      creditoHomologado: Number(homologado._sum.valorCredito ?? 0),
      lacunaSped: Number(lacunas._sum.lacuna ?? 0),
      deltaReforma: 0, // comparações da reforma não são persistidas (tela Reforma é sob demanda)
      competencia: ultima ? `${MESES[ultima.mes - 1]}/${ultima.ano}` : this.competenciaAtual(),
      impostoAPagar: { total: Number(ultima?._sum.aRecolher ?? 0) },
      serie,
      documentos,
    };
  }

  /** Competência corrente no fuso de São Paulo. */
  private competenciaAtual(): string {
    const partes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      month: 'numeric',
      year: 'numeric',
    }).formatToParts(new Date());
    const mes = Number(partes.find((p) => p.type === 'month')?.value ?? '1');
    const ano = partes.find((p) => p.type === 'year')?.value ?? '';
    return `${MESES[mes - 1]}/${ano}`;
  }
}
