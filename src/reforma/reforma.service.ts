import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { NfeParserService } from '../fiscal/nfe-parser.service';
import { MotorCreditoService } from '../motor-credito/motor-credito.service';
import { AliquotaReferencia, Finalidade } from '../motor-credito/motor-credito.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReformaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: NfeParserService,
    private readonly motor: MotorCreditoService,
    private readonly config: ConfigService,
  ) {}

  private aliqRef(): AliquotaReferencia {
    return {
      cbs: Number(this.config.get('APURAX_ALIQ_REF_CBS') ?? 0.088),
      ibs: Number(this.config.get('APURAX_ALIQ_REF_IBS') ?? 0.177),
    };
  }

  /**
   * Compara, na mesma NF-e de entrada, o crédito legado (ICMS/PIS/COFINS) com o
   * crédito CBS/IBS (financeiro amplo) e devolve o delta de oportunidade.
   * Em nota legada pura (sem grupo IBSCBS), projeta o potencial sobre o valor do item.
   */
  async compararDocumento(empresaId: string, xml: string, finalidade?: Finalidade) {
    const nfe = this.parser.parse(xml);
    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada para este tenant.');
    }

    const regras = await this.motor.carregarRegras(nfe.dataEmissao);
    const aliqRef = this.aliqRef();
    const zero = () => new Prisma.Decimal(0);
    const tot = { legado: zero(), novoEfetivo: zero(), novoPotencial: zero(), delta: zero() };

    const itens = nfe.itens.map((item) => {
      const r = this.motor.compararRegimes({
        legado: item,
        novo: {
          cst: item.cstIbsCbs ?? null,
          cClassTrib: item.cClassTrib ?? null,
          vBc: item.vBcIbsCbs ?? item.valorProduto, // sem IBSCBS: projeta sobre o valor do item
          vCbs: item.vCbs ?? null,
          vIbsUf: item.vIbsUf ?? null,
          vIbsMun: item.vIbsMun ?? null,
          aliqRef,
        },
        regime: empresa.regimeTributario,
        regras,
        finalidade,
      });
      tot.legado = tot.legado.add(r.legado.total);
      tot.novoEfetivo = tot.novoEfetivo.add(r.novoEfetivo);
      tot.novoPotencial = tot.novoPotencial.add(r.novoPotencial);
      tot.delta = tot.delta.add(r.deltaPotencial);

      return {
        item: item.descricao,
        cfop: item.cfop,
        creditoLegado: r.legado.total.toFixed(2),
        creditoNovoEfetivo2026: r.novoEfetivo.toFixed(2),
        creditoNovoPotencial: r.novoPotencial.toFixed(2),
        deltaPotencial: r.deltaPotencial.toFixed(2),
        pctGanho: r.pctGanho,
        alertas: r.alertas,
      };
    });

    return {
      documento: { chaveAcesso: nfe.chaveAcesso, emitente: nfe.emitenteNome, dataEmissao: nfe.dataEmissao },
      empresa: { razaoSocial: empresa.razaoSocial, regime: empresa.regimeTributario },
      aliquotaReferencia: { cbs: aliqRef.cbs, ibs: aliqRef.ibs },
      itens,
      totais: {
        creditoLegado: tot.legado.toFixed(2),
        creditoNovoEfetivo2026: tot.novoEfetivo.toFixed(2),
        creditoNovoPotencial: tot.novoPotencial.toFixed(2),
        deltaPotencial: tot.delta.toFixed(2),
      },
      observacao:
        'Crédito de 2026 é simbólico (alíquota-teste CBS 0,9%/IBS 0,1%). O "delta de oportunidade" usa o crédito novo projetado sob a alíquota de referência cheia (parametrizável) vs. o crédito legado. Base legal: LC 214/2025 arts. 47 e 57.',
    };
  }
}
