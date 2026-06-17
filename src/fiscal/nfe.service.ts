import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { faixaCompetencia } from '../common/competencia';
import { resumirCstPisCofins } from '../common/cst-pis-cofins';
import { rotuloModelo } from '../common/modelo';
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

  /** Importa uma NF-e de entrada, calcula os créditos (motor) e registra a auditoria.
   *  usuarioId é opcional — o fluxo do Bling (webhook/varredura) não tem usuário logado. */
  async importar(empresaId: string, xml: string, usuarioId?: string) {
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
        destinatarioNome: nfe.destinatarioNome,
        valorTotal: nfe.valorTotal,
        xml, // XML bruto p/ download (valor legal)
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
            cstIbsCbs: it.cstIbsCbs ?? null,
            cClassTrib: it.cClassTrib ?? null,
            vBcIbsCbs: it.vBcIbsCbs ?? null,
            vCbs: it.vCbs ?? null,
            vIbsUf: it.vIbsUf ?? null,
            vIbsMun: it.vIbsMun ?? null,
            vIbs: it.vIbs ?? null,
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
      ...(usuarioId ? { usuarioId } : {}),
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

    // CBS/IBS destacados na entrada = crédito disponível na reforma (não-cumulativo, crédito amplo).
    const cbsDestacado = nfe.itens.reduce((s, it) => s + Number(it.vCbs ?? 0), 0);
    const ibsDestacado = nfe.itens.reduce((s, it) => s + Number(it.vIbsUf ?? 0) + Number(it.vIbsMun ?? 0), 0);

    return {
      documentoId: doc.id,
      chaveAcesso: doc.chaveAcesso,
      empresa: { id: empresa.id, razaoSocial: empresa.razaoSocial, regime: empresa.regimeTributario },
      totalItens: doc.itens.length,
      creditoPotencial: {
        ICMS: totais.ICMS.toFixed(2),
        PIS: totais.PIS.toFixed(2),
        COFINS: totais.COFINS.toFixed(2),
        CBS: cbsDestacado.toFixed(2),
        IBS: ibsDestacado.toFixed(2),
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
        destinatarioNome: nfe.destinatarioNome,
        valorTotal: nfe.valorTotal,
        xml, // XML bruto p/ download (valor legal)
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
            cstIbsCbs: it.cstIbsCbs ?? null,
            cClassTrib: it.cClassTrib ?? null,
            vBcIbsCbs: it.vBcIbsCbs ?? null,
            vCbs: it.vCbs ?? null,
            vIbsUf: it.vIbsUf ?? null,
            vIbsMun: it.vIbsMun ?? null,
            vIbs: it.vIbs ?? null,
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
   * Importa uma NF-e/NFC-e classificando pelo tpNF do XML (origem: Bling, SAE-SP,
   * upload de XML emitido em outro sistema — ex.: VOTI):
   *  - tpNF=1 (saída/venda) → importarSaida (gera débito);
   *  - tpNF=0 (entrada — compra ou DEVOLUÇÃO de venda emitida pela empresa) → importar
   *    (roda o motor de crédito; na devolução, estorna imposto na apuração).
   * Dedup por chave aqui (silenciosa) evita lançar/contar erro em re-entrega de webhook
   * e evita duplicar com a captura SEFAZ.
   */
  async importarClassificado(empresaId: string, xml: string, usuarioId?: string) {
    const nfe = this.parser.parse(xml);
    const existente = await this.prisma.scoped.documentoFiscal.findFirst({
      where: { chaveAcesso: nfe.chaveAcesso },
      select: { id: true, tipoOperacao: true },
    });
    if (existente) {
      return { documentoId: existente.id, chaveAcesso: nfe.chaveAcesso, jaImportada: true, tipoOperacao: existente.tipoOperacao };
    }
    return nfe.tpNF === '0' ? this.importar(empresaId, xml, usuarioId) : this.importarSaida(empresaId, xml, usuarioId);
  }

  /**
   * Lista os documentos fiscais já no formato da tela. Filtro opcional por
   * competência (ano+mês) e por tipo (ENTRADA/SAIDA; sem tipo = ambos).
   * Normaliza o registro cru (emitenteNome/valorTotal/modelo "55"…) para o
   * contrato do front e soma os créditos das entradas (ICMS, PIS+COFINS).
   */
  async listarDocumentos(filtro: { ano?: number; mes?: number; tipo?: 'ENTRADA' | 'SAIDA' } = {}) {
    const periodo = faixaCompetencia(filtro.ano, filtro.mes);
    const docs = await this.prisma.scoped.documentoFiscal.findMany({
      where: {
        ...(filtro.tipo ? { tipoOperacao: filtro.tipo } : {}),
        ...(periodo ? { dataEmissao: { gte: periodo.inicio, lt: periodo.fim } } : {}),
      },
      orderBy: { dataEmissao: 'desc' },
      include: {
        empresa: { select: { razaoSocial: true, cnpj: true } },
        apuracoes: { select: { tributo: true, valorCredito: true, creditoPermitido: true } },
        itens: {
          select: {
            vIcms: true,
            vBcIcms: true,
            cstPis: true,
            vBcPis: true,
            vPis: true,
            cstCofins: true,
            vBcCofins: true,
            vCofins: true,
            vCbs: true,
            vIbsUf: true,
            vIbsMun: true,
          },
        },
      },
    });

    const documentos = docs.map((d) => {
      let creditoIcms = 0;
      let creditoPisCofins = 0;
      for (const a of d.apuracoes) {
        if (!a.creditoPermitido) continue;
        const v = Number(a.valorCredito);
        if (a.tributo === 'ICMS') creditoIcms += v;
        else if (a.tributo === 'PIS' || a.tributo === 'COFINS') creditoPisCofins += v;
      }
      // Valores de imposto (somados dos itens) — débito na saída / destacado na entrada.
      let icms = 0;
      let bcIcms = 0;
      let pis = 0;
      let cofins = 0;
      let cbs = 0;
      let ibs = 0;
      for (const it of d.itens) {
        icms += Number(it.vIcms ?? 0);
        bcIcms += Number(it.vBcIcms ?? 0);
        pis += Number(it.vPis ?? 0);
        cofins += Number(it.vCofins ?? 0);
        cbs += Number(it.vCbs ?? 0);
        ibs += Number(it.vIbsUf ?? 0) + Number(it.vIbsMun ?? 0);
      }
      return {
        id: d.id,
        chaveAcesso: d.chaveAcesso,
        modelo: rotuloModelo(d.modelo),
        numero: d.numero,
        serie: d.serie,
        tipoOperacao: d.tipoOperacao, // 'ENTRADA' | 'SAIDA'
        emitente: d.emitenteNome,
        cnpjEmitente: d.emitenteCnpj,
        destinatario: d.destinatarioNome ?? '',
        cnpjDestinatario: d.destinatarioCnpj,
        dataEmissao: d.dataEmissao.toISOString(),
        valor: Number(d.valorTotal),
        creditoIcms,
        creditoPisCofins,
        bcIcms,
        icms,
        pis,
        cofins,
        cbs,
        ibs,
      };
    });

    // Resumo das CST de PIS/COFINS sobre TODOS os itens do conjunto filtrado.
    const resumoCst = resumirCstPisCofins(docs.flatMap((d) => d.itens));

    return { documentos, resumoCst };
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

  /** XML bruto (valor legal) p/ download. select explícito do xml (vence o omit global). */
  async baixarXml(id: string): Promise<{ xml: string; nomeArquivo: string }> {
    const doc = await this.prisma.scoped.documentoFiscal.findFirst({
      where: { id },
      select: { xml: true, chaveAcesso: true },
    });
    if (!doc) {
      throw new NotFoundException('Documento não encontrado.');
    }
    if (!doc.xml) {
      throw new NotFoundException(
        'XML não disponível (documento importado antes do armazenamento do XML — reimporte/recapture para baixar).',
      );
    }
    return { xml: doc.xml, nomeArquivo: `${doc.chaveAcesso}.xml` };
  }

  /** XML bruto + modelo p/ gerar o DANFE/DACTE. select explícito do xml (vence o omit global). */
  async obterXmlEModelo(id: string): Promise<{ xml: string; modelo: string }> {
    const doc = await this.prisma.scoped.documentoFiscal.findFirst({
      where: { id },
      select: { xml: true, modelo: true },
    });
    if (!doc) {
      throw new NotFoundException('Documento não encontrado.');
    }
    if (!doc.xml) {
      throw new NotFoundException(
        'XML não disponível (documento importado antes do armazenamento do XML — reimporte/recapture para gerar o PDF).',
      );
    }
    return { xml: doc.xml, modelo: doc.modelo };
  }
}
