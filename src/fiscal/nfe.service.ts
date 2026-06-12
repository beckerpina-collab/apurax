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

  listarDocumentos() {
    return this.prisma.scoped.documentoFiscal.findMany({
      orderBy: { dataEmissao: 'desc' },
      include: { empresa: { select: { razaoSocial: true, cnpj: true } } },
    });
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
