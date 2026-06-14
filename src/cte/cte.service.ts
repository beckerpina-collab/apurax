import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { MotorCreditoService } from '../motor-credito/motor-credito.service';
import { PrismaService } from '../prisma/prisma.service';
import { CteParserService } from './cte-parser.service';

@Injectable()
export class CteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly motor: MotorCreditoService,
    private readonly auditoria: AuditoriaService,
    private readonly parser: CteParserService,
  ) {}

  /** Importa um CT-e (modelo 57), calcula o crédito de ICMS do frete e audita. */
  async importar(empresaId: string, xml: string, usuarioId: string) {
    const cte = this.parser.parse(xml);

    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada para este tenant.');
    }

    const existente = await this.prisma.scoped.documentoFiscal.findFirst({
      where: { chaveAcesso: cte.chaveAcesso },
    });
    if (existente) {
      throw new BadRequestException(`CT-e já importado (chave ${cte.chaveAcesso}).`);
    }

    const tomadorEhEmpresa = !!cte.tomadorCnpj && cte.tomadorCnpj === empresa.cnpj;

    const resultado = this.motor.avaliarCreditoCte({
      grupoIcms: cte.grupoIcms,
      cstIcms: cte.cstIcms,
      vIcms: cte.vIcms ?? null,
      vCred: cte.vCred ?? null,
      cBenef: cte.cBenef ?? null,
      vTPrest: cte.vTPrest,
      regime: empresa.regimeTributario,
      tomadorEhEmpresa,
    });

    const doc = await this.prisma.scoped.documentoFiscal.create({
      data: {
        tenantId: this.prisma.tenantId,
        empresaId: empresa.id,
        chaveAcesso: cte.chaveAcesso,
        modelo: '57',
        numero: cte.numero,
        serie: cte.serie,
        dataEmissao: cte.dataEmissao,
        tipoOperacao: 'ENTRADA',
        emitenteCnpj: cte.emitenteCnpj,
        emitenteNome: cte.emitenteNome,
        destinatarioCnpj: cte.tomadorCnpj ?? '',
        tomadorCnpj: cte.tomadorCnpj,
        valorTotal: cte.vTPrest,
        xml, // XML bruto p/ download (valor legal)
        status: 'PROCESSADO',
        itens: {
          create: [
            {
              tenantId: this.prisma.tenantId,
              numItem: 1,
              codProduto: 'FRETE',
              descricao: `Serviço de transporte (CT-e ${cte.numero})`,
              ncm: '00000000',
              cfop: cte.cfop,
              quantidade: '1',
              valorProduto: cte.vTPrest,
              cstIcms: cte.cstIcms || null,
              vBcIcms: cte.vBcIcms ?? null,
              vIcms: cte.vIcms ?? null,
            },
          ],
        },
      },
      include: { itens: true },
    });

    const item = doc.itens[0];
    await this.prisma.scoped.apuracaoCredito.create({
      data: {
        tenantId: this.prisma.tenantId,
        documentoId: doc.id,
        itemId: item.id,
        tributo: 'ICMS',
        creditoPermitido: resultado.creditoPermitido,
        valorCredito: resultado.valorCredito,
        regraId: undefined,
        baseLegal: resultado.baseLegal,
        alertas: resultado.alertas,
        status: 'SUGERIDO',
        proveniencia: 'engine',
        origemIA: false,
      },
    });

    await this.auditoria.registrar({
      tipo: 'CTE_IMPORTADO_E_APURADO',
      entidade: 'DocumentoFiscal',
      entidadeId: doc.id,
      usuarioId,
      dados: {
        chaveAcesso: doc.chaveAcesso,
        grupoIcms: cte.grupoIcms,
        creditoPermitido: resultado.creditoPermitido,
        valorCredito: resultado.valorCredito.toString(),
        tomadorEhEmpresa,
      },
    });

    return {
      documentoId: doc.id,
      chaveAcesso: doc.chaveAcesso,
      // Contrato comum da tela Importar XML (CT-e = 1 "item"; crédito é só ICMS do frete).
      totalItens: 1,
      creditoPotencial: {
        ICMS: resultado.creditoPermitido ? resultado.valorCredito.toNumber() : 0,
        PIS: 0,
        COFINS: 0,
      },
      transportadora: { cnpj: cte.emitenteCnpj, nome: cte.emitenteNome },
      tomador: { cnpj: cte.tomadorCnpj, papel: cte.tomadorPapel, ehEmpresa: tomadorEhEmpresa },
      trajeto: cte.ufIni && cte.ufFim ? `${cte.ufIni} → ${cte.ufFim}` : undefined,
      valorFrete: cte.vTPrest,
      icms: {
        grupo: cte.grupoIcms,
        cst: cte.cstIcms,
        creditoPermitido: resultado.creditoPermitido,
        valorCredito: resultado.valorCredito.toFixed(2),
        baseLegal: resultado.baseLegal,
        alertas: resultado.alertas,
      },
      observacao:
        'Crédito de ICMS do frete calculado pelo motor determinístico e gravado como SUGERIDO; pende de homologação humana.',
    };
  }
}
