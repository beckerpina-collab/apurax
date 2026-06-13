import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { MotorCreditoService } from '../motor-credito/motor-credito.service';
import { PrismaService } from '../prisma/prisma.service';
import { NfeParserService } from './nfe-parser.service';

type ChaveTributo = 'ICMS' | 'PIS' | 'COFINS';

@Injectable()
export class NfeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly motor: MotorCreditoService,
    private readonly auditoria: AuditoriaService,
    private readonly parser: NfeParserService,
  ) {}

  /** Importa uma NF-e de entrada, calcula os créditos (motor) e registra a auditoria. */
  async importar(empresaId: string, xml: string, usuarioId: string) {
    const nfe = this.parser.parse(xml);

    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada para este tenant.');
    }

    const existente = await this.prisma.scoped.documentoFiscal.findFirst({
      where: { chaveAcesso: nfe.chaveAcesso },
    });
    if (existente) {
      throw new BadRequestException(`NF-e já importada (chave ${nfe.chaveAcesso}).`);
    }

    const alertasDoc: string[] = [];
    if (nfe.destinatarioCnpj && nfe.destinatarioCnpj !== empresa.cnpj) {
      alertasDoc.push('CNPJ do destinatário no XML difere do CNPJ da empresa selecionada.');
    }

    const doc = await this.prisma.scoped.documentoFiscal.create({
      data: {
        tenantId: this.prisma.tenantId,
        empresaId: empresa.id,
        chaveAcesso: nfe.chaveAcesso,
        modelo: nfe.modelo,
        numero: nfe.numero,
        serie: nfe.serie,
        dataEmissao: nfe.dataEmissao,
        tipoOperacao: 'ENTRADA',
        emitenteCnpj: nfe.emitenteCnpj,
        emitenteNome: nfe.emitenteNome,
        destinatarioCnpj: nfe.destinatarioCnpj,
        valorTotal: nfe.valorTotal,
        status: 'PROCESSADO',
        itens: {
          create: nfe.itens.map((it) => ({
            tenantId: this.prisma.tenantId,
            numItem: it.numItem,
            codProduto: it.codProduto,
            descricao: it.descricao,
            ncm: it.ncm,
            cfop: it.cfop,
            quantidade: it.quantidade,
            valorProduto: it.valorProduto,
            cstIcms: it.cstIcms ?? null,
            csosn: it.csosn ?? null,
            vBcIcms: it.vBcIcms ?? null,
            vIcms: it.vIcms ?? null,
            vIcmsSt: it.vIcmsSt ?? null,
            vCredIcmsSn: it.vCredIcmsSn ?? null,
            cstPis: it.cstPis ?? null,
            vBcPis: it.vBcPis ?? null,
            vPis: it.vPis ?? null,
            cstCofins: it.cstCofins ?? null,
            vBcCofins: it.vBcCofins ?? null,
            vCofins: it.vCofins ?? null,
            cstIpi: it.cstIpi ?? null,
            vIpi: it.vIpi ?? null,
          })),
        },
      },
      include: { itens: true },
    });

    const regras = await this.motor.carregarRegras(nfe.dataEmissao);
    const apuracoes: Prisma.ApuracaoCreditoCreateManyInput[] = [];
    const totais: Record<ChaveTributo, Prisma.Decimal> = {
      ICMS: new Prisma.Decimal(0),
      PIS: new Prisma.Decimal(0),
      COFINS: new Prisma.Decimal(0),
    };

    for (const item of doc.itens) {
      const resultados = this.motor.avaliarItem(item, empresa.regimeTributario, regras);
      for (const r of resultados) {
        apuracoes.push({
          tenantId: this.prisma.tenantId,
          documentoId: doc.id,
          itemId: item.id,
          tributo: r.tributo,
          creditoPermitido: r.creditoPermitido,
          valorCredito: r.valorCredito,
          regraId: r.regraId ?? undefined,
          baseLegal: r.baseLegal,
          alertas: r.alertas,
          status: 'SUGERIDO',
          proveniencia: 'engine',
          origemIA: false,
        });
        if (r.creditoPermitido) {
          const t = r.tributo as ChaveTributo;
          totais[t] = totais[t].add(r.valorCredito);
        }
      }
    }

    await this.prisma.scoped.apuracaoCredito.createMany({ data: apuracoes });

    await this.auditoria.registrar({
      tipo: 'NFE_IMPORTADA_E_APURADA',
      entidade: 'DocumentoFiscal',
      entidadeId: doc.id,
      usuarioId,
      dados: {
        chaveAcesso: doc.chaveAcesso,
        totalItens: doc.itens.length,
        totalApuracoes: apuracoes.length,
        creditoPotencial: {
          ICMS: totais.ICMS.toString(),
          PIS: totais.PIS.toString(),
          COFINS: totais.COFINS.toString(),
        },
      },
    });

    return {
      documentoId: doc.id,
      chaveAcesso: doc.chaveAcesso,
      empresa: { id: empresa.id, razaoSocial: empresa.razaoSocial, regime: empresa.regimeTributario },
      totalItens: doc.itens.length,
      creditoPotencial: {
        ICMS: totais.ICMS.toFixed(2),
        PIS: totais.PIS.toFixed(2),
        COFINS: totais.COFINS.toFixed(2),
      },
      alertas: alertasDoc,
      observacao:
        'Créditos calculados pelo motor determinístico e gravados como SUGERIDO; pendem de homologação humana.',
    };
  }

  /**
   * Importa uma NF-e de SAÍDA (emitida pela empresa) como DocumentoFiscal
   * tipoOperacao=SAIDA — é a base do DÉBITO na apuração (não gera crédito, então
   * NÃO roda o motor). Idempotente: re-entrega do webhook não duplica nem falha.
   */
  async importarSaida(empresaId: string, xml: string, usuarioId?: string) {
    const nfe = this.parser.parse(xml);

    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada para este tenant.');
    }

    const existente = await this.prisma.scoped.documentoFiscal.findFirst({
      where: { chaveAcesso: nfe.chaveAcesso },
    });
    if (existente) {
      return { documentoId: existente.id, chaveAcesso: nfe.chaveAcesso, jaImportada: true, tipoOperacao: 'SAIDA' };
    }

    const alertas: string[] = [];
    if (nfe.emitenteCnpj && nfe.emitenteCnpj !== empresa.cnpj) {
      alertas.push('CNPJ do emitente no XML difere do CNPJ da empresa (saída deveria ser emitida por ela).');
    }

    const doc = await this.prisma.scoped.documentoFiscal.create({
      data: {
        tenantId: this.prisma.tenantId,
        empresaId: empresa.id,
        chaveAcesso: nfe.chaveAcesso,
        modelo: nfe.modelo,
        numero: nfe.numero,
        serie: nfe.serie,
        dataEmissao: nfe.dataEmissao,
        tipoOperacao: 'SAIDA',
        emitenteCnpj: nfe.emitenteCnpj,
        emitenteNome: nfe.emitenteNome,
        destinatarioCnpj: nfe.destinatarioCnpj,
        valorTotal: nfe.valorTotal,
        status: 'PROCESSADO',
        itens: {
          create: nfe.itens.map((it) => ({
            tenantId: this.prisma.tenantId,
            numItem: it.numItem,
            codProduto: it.codProduto,
            descricao: it.descricao,
            ncm: it.ncm,
            cfop: it.cfop,
            quantidade: it.quantidade,
            valorProduto: it.valorProduto,
            cstIcms: it.cstIcms ?? null,
            csosn: it.csosn ?? null,
            vBcIcms: it.vBcIcms ?? null,
            vIcms: it.vIcms ?? null,
            vIcmsSt: it.vIcmsSt ?? null,
            vCredIcmsSn: it.vCredIcmsSn ?? null,
            cstPis: it.cstPis ?? null,
            vBcPis: it.vBcPis ?? null,
            vPis: it.vPis ?? null,
            cstCofins: it.cstCofins ?? null,
            vBcCofins: it.vBcCofins ?? null,
            vCofins: it.vCofins ?? null,
            cstIpi: it.cstIpi ?? null,
            vIpi: it.vIpi ?? null,
          })),
        },
      },
      include: { itens: true },
    });

    await this.auditoria.registrar({
      tipo: 'NFE_SAIDA_IMPORTADA',
      entidade: 'DocumentoFiscal',
      entidadeId: doc.id,
      ...(usuarioId ? { usuarioId } : {}),
      dados: { chaveAcesso: doc.chaveAcesso, totalItens: doc.itens.length, origem: 'bling' },
    });

    return { documentoId: doc.id, chaveAcesso: doc.chaveAcesso, totalItens: doc.itens.length, tipoOperacao: 'SAIDA', alertas };
  }

  /**
   * Lista os documentos de ENTRADA (base dos créditos) já no formato da tela.
   * Filtro opcional por competência (ano+mês). Normaliza o registro cru
   * (emitenteNome/valorTotal/modelo "55"…) para o contrato do front e soma os
   * créditos a partir das apurações (ICMS, PIS+COFINS).
   */
  async listarDocumentos(filtro: { ano?: number; mes?: number } = {}) {
    const periodo = this.faixaCompetencia(filtro);
    const docs = await this.prisma.scoped.documentoFiscal.findMany({
      where: {
        tipoOperacao: 'ENTRADA',
        ...(periodo ? { dataEmissao: { gte: periodo.inicio, lt: periodo.fim } } : {}),
      },
      orderBy: { dataEmissao: 'desc' },
      include: {
        empresa: { select: { razaoSocial: true, cnpj: true } },
        apuracoes: { select: { tributo: true, valorCredito: true, creditoPermitido: true } },
      },
    });

    return docs.map((d) => {
      let creditoIcms = 0;
      let creditoPisCofins = 0;
      for (const a of d.apuracoes) {
        if (!a.creditoPermitido) continue;
        const v = Number(a.valorCredito);
        if (a.tributo === 'ICMS') creditoIcms += v;
        else if (a.tributo === 'PIS' || a.tributo === 'COFINS') creditoPisCofins += v;
      }
      return {
        id: d.id,
        chaveAcesso: d.chaveAcesso,
        modelo: rotuloModelo(d.modelo),
        emitente: d.emitenteNome,
        cnpjEmitente: d.emitenteCnpj,
        dataEmissao: d.dataEmissao.toISOString(),
        valor: Number(d.valorTotal),
        creditoIcms,
        creditoPisCofins,
      };
    });
  }

  /** Faixa [início, fim) sobre a dataEmissão p/ a competência (mês) informada.
   *  Fronteiras em UTC, IGUAIS às do painel, p/ as duas telas baterem. */
  private faixaCompetencia(f: { ano?: number; mes?: number }): { inicio: Date; fim: Date } | null {
    if (!f.ano || !f.mes) return null;
    const inicio = new Date(Date.UTC(f.ano, f.mes - 1, 1));
    const fim = new Date(Date.UTC(f.mes === 12 ? f.ano + 1 : f.ano, f.mes === 12 ? 0 : f.mes, 1));
    return { inicio, fim };
  }

  async detalhe(id: string) {
    const doc = await this.prisma.scoped.documentoFiscal.findFirst({
      where: { id },
      include: { itens: { include: { apuracoes: true } } },
    });
    if (!doc) {
      throw new NotFoundException('Documento não encontrado.');
    }
    return doc;
  }
}

/** Código do modelo (55/65/57…) → rótulo curto da tela. */
function rotuloModelo(modelo: string): 'NF-e' | 'CT-e' | 'NFS-e' {
  if (modelo === '55' || modelo === '65') return 'NF-e';
  if (modelo === '57') return 'CT-e';
  return 'NFS-e';
}
