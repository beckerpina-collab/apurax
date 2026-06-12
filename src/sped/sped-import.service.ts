import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { AchadoLacuna, SpedGapService } from './sped-gap.service';
import { SpedArquivo, SpedParserService } from './sped-parser.service';

@Injectable()
export class SpedImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: SpedParserService,
    private readonly gap: SpedGapService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async importar(empresaId: string, conteudo: string, usuarioId: string) {
    const arquivo = this.parser.parse(conteudo);

    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada para este tenant.');
    }
    if (arquivo.cnpj && arquivo.cnpj !== empresa.cnpj) {
      throw new BadRequestException(
        `CNPJ do SPED (${arquivo.cnpj}) difere do CNPJ da empresa (${empresa.cnpj}).`,
      );
    }

    const hashArquivo = createHash('sha256').update(conteudo).digest('hex');
    const existente = await this.prisma.scoped.importacaoSped.findFirst({ where: { hashArquivo } });
    if (existente) {
      throw new BadRequestException('Este arquivo SPED já foi importado.');
    }

    const resultado = this.gap.analisar(arquivo);
    const reconciliacao = await this.reconciliarComNfe(empresa.id, arquivo);
    const todos = [...resultado.achados, ...reconciliacao];

    const lacunaPisTotal = this.somar(todos, 'PIS');
    const lacunaCofinsTotal = this.somar(todos, 'COFINS');

    const importacao = await this.prisma.scoped.importacaoSped.create({
      data: {
        tenantId: this.prisma.tenantId,
        empresaId: empresa.id,
        dtIni: arquivo.dtIni,
        dtFin: arquivo.dtFin,
        hashArquivo,
        totalDocumentos: arquivo.documentos.length,
        totalItens: resultado.totalItens,
        creditoPisDeclarado: arquivo.creditoPisDeclarado,
        creditoCofinsDeclarado: arquivo.creditoCofinsDeclarado,
        lacunaPisTotal,
        lacunaCofinsTotal,
      },
    });

    if (todos.length > 0) {
      await this.prisma.scoped.lacunaCredito.createMany({
        data: todos.map((a) => ({
          tenantId: this.prisma.tenantId,
          importacaoId: importacao.id,
          tributo: a.tributo,
          tipo: a.tipo,
          referencia: a.referencia,
          cst: a.cst || null,
          cfop: a.cfop || null,
          creditoDeclarado: a.creditoDeclarado,
          creditoPotencial: a.creditoPotencial,
          lacuna: a.lacuna,
          baseLegal: a.baseLegal,
          observacao: a.observacao,
        })),
      });
    }

    await this.auditoria.registrar({
      tipo: 'SPED_IMPORTADO_E_ANALISADO',
      entidade: 'ImportacaoSped',
      entidadeId: importacao.id,
      usuarioId,
      dados: {
        competencia: `${arquivo.dtIni.toISOString().slice(0, 7)}`,
        totalAchados: todos.length,
        lacunaPisTotal: lacunaPisTotal.toString(),
        lacunaCofinsTotal: lacunaCofinsTotal.toString(),
      },
    });

    return {
      importacaoId: importacao.id,
      empresa: { id: empresa.id, razaoSocial: empresa.razaoSocial, regime: empresa.regimeTributario },
      competencia: { inicio: arquivo.dtIni, fim: arquivo.dtFin },
      creditoDeclarado: {
        PIS: arquivo.creditoPisDeclarado.toFixed(2),
        COFINS: arquivo.creditoCofinsDeclarado.toFixed(2),
      },
      lacunaTotal: { PIS: lacunaPisTotal.toFixed(2), COFINS: lacunaCofinsTotal.toFixed(2) },
      achadosPorTipo: this.contarPorTipo(todos),
      observacao:
        'Lacunas calculadas pelo motor determinístico. CST 60-67 (presumido) e 98/99 são marcados para revisão (IA/Etapa 7), não calculados automaticamente.',
    };
  }

  /** Entradas (NF-e já ingeridas) na competência que NÃO aparecem no SPED. */
  private async reconciliarComNfe(empresaId: string, arquivo: SpedArquivo): Promise<AchadoLacuna[]> {
    const chavesSped = new Set(
      arquivo.documentos.filter((d) => d.indOper === '0' && d.chaveAcesso).map((d) => d.chaveAcesso),
    );

    const docsNfe = await this.prisma.scoped.documentoFiscal.findMany({
      where: {
        empresaId,
        tipoOperacao: 'ENTRADA',
        dataEmissao: { gte: arquivo.dtIni, lte: arquivo.dtFin },
      },
      include: { apuracoes: true },
    });

    const achados: AchadoLacuna[] = [];
    for (const doc of docsNfe) {
      if (chavesSped.has(doc.chaveAcesso)) continue;
      for (const tributo of ['PIS', 'COFINS'] as const) {
        const potencial = doc.apuracoes
          .filter((ap) => ap.tributo === tributo && ap.creditoPermitido)
          .reduce((s, ap) => s.add(ap.valorCredito), new Prisma.Decimal(0));
        if (potencial.greaterThan(0)) {
          achados.push({
            tributo,
            tipo: 'ENTRADA_NAO_ESCRITURADA',
            referencia: `NF-e ${doc.chaveAcesso}`,
            cst: '',
            cfop: '',
            creditoDeclarado: new Prisma.Decimal(0),
            creditoPotencial: potencial.toDecimalPlaces(2),
            lacuna: potencial.toDecimalPlaces(2),
            baseLegal: 'Crédito de entrada documentada por NF-e não localizada na escrituração (C100) da competência.',
            observacao: 'NF-e de entrada ingerida no Apurax sem documento correspondente no SPED — possível crédito não escriturado.',
          });
        }
      }
    }
    return achados;
  }

  listarImportacoes() {
    return this.prisma.scoped.importacaoSped.findMany({
      orderBy: { criadoEm: 'desc' },
      include: { empresa: { select: { razaoSocial: true, cnpj: true } } },
    });
  }

  async detalhe(id: string) {
    const imp = await this.prisma.scoped.importacaoSped.findFirst({
      where: { id },
      include: { lacunas: { orderBy: { lacuna: 'desc' } } },
    });
    if (!imp) {
      throw new NotFoundException('Importação não encontrada.');
    }
    return imp;
  }

  private somar(achados: AchadoLacuna[], tributo: 'PIS' | 'COFINS'): Prisma.Decimal {
    return achados
      .filter((a) => a.tributo === tributo && a.lacuna.greaterThan(0))
      .reduce((s, a) => s.add(a.lacuna), new Prisma.Decimal(0));
  }

  private contarPorTipo(achados: AchadoLacuna[]): Record<string, number> {
    return achados.reduce<Record<string, number>>((acc, a) => {
      acc[a.tipo] = (acc[a.tipo] ?? 0) + 1;
      return acc;
    }, {});
  }
}
