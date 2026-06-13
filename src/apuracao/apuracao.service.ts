import { Injectable, NotFoundException } from '@nestjs/common';
import { StatusApuracao } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { faixaCompetencia } from '../common/competencia';
import { rotuloModelo } from '../common/modelo';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApuracaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Lista os créditos no formato da tela ({documento: 'NF-e 123', item, origem…}).
   * O registro cru traz documento/item como OBJETOS — renderizá-los direto
   * quebraria o React (tela branca). Filtro opcional por competência (emissão).
   */
  async listar(status?: StatusApuracao, ano?: number, mes?: number) {
    const periodo = faixaCompetencia(ano, mes);
    const apuracoes = await this.prisma.scoped.apuracaoCredito.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(periodo ? { documento: { dataEmissao: { gte: periodo.inicio, lt: periodo.fim } } } : {}),
      },
      orderBy: { criadoEm: 'desc' },
      include: {
        item: { select: { descricao: true } },
        documento: { select: { modelo: true, numero: true, dataEmissao: true } },
      },
    });
    return apuracoes.map((a) => ({
      id: a.id,
      documento: `${rotuloModelo(a.documento.modelo)} ${a.documento.numero}`,
      item: a.item.descricao,
      tributo: a.tributo,
      creditoPermitido: a.creditoPermitido,
      valorCredito: Number(a.valorCredito),
      baseLegal: a.baseLegal,
      alertas: a.alertas ?? [],
      status: a.status,
      origem: rotuloModelo(a.documento.modelo),
      dataEmissao: a.documento.dataEmissao.toISOString(),
    }));
  }

  private async buscar(id: string) {
    const ap = await this.prisma.scoped.apuracaoCredito.findFirst({ where: { id } });
    if (!ap) {
      throw new NotFoundException('Apuração não encontrada.');
    }
    return ap;
  }

  /** Homologa: o humano (contador) ASSUME o número. Só então é crédito oficial. */
  async homologar(id: string, usuarioId: string) {
    const ap = await this.buscar(id);
    const atualizado = await this.prisma.scoped.apuracaoCredito.update({
      where: { id },
      data: { status: StatusApuracao.HOMOLOGADO, homologadoPor: usuarioId, homologadoEm: new Date() },
    });
    await this.auditoria.registrar({
      tipo: 'APURACAO_HOMOLOGADA',
      entidade: 'ApuracaoCredito',
      entidadeId: id,
      usuarioId,
      dados: { tributo: ap.tributo, valorCredito: ap.valorCredito.toString(), regraId: ap.regraId },
    });
    return atualizado;
  }

  // (homologar/glosar devolvem o registro cru — só consumidos por chamadas diretas)

  /** Glosa: rejeita o crédito sugerido, com motivo registrado na trilha. */
  async glosar(id: string, usuarioId: string, motivo: string) {
    const ap = await this.buscar(id);
    const atualizado = await this.prisma.scoped.apuracaoCredito.update({
      where: { id },
      data: { status: StatusApuracao.GLOSADO, homologadoPor: usuarioId, homologadoEm: new Date() },
    });
    await this.auditoria.registrar({
      tipo: 'APURACAO_GLOSADA',
      entidade: 'ApuracaoCredito',
      entidadeId: id,
      usuarioId,
      dados: { tributo: ap.tributo, valorCredito: ap.valorCredito.toString(), motivo },
    });
    return atualizado;
  }
}
