import { Injectable, NotFoundException } from '@nestjs/common';
import { StatusApuracao } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApuracaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  listar(status?: StatusApuracao) {
    return this.prisma.scoped.apuracaoCredito.findMany({
      where: status ? { status } : {},
      orderBy: { criadoEm: 'desc' },
      include: {
        item: { select: { descricao: true, ncm: true, cfop: true } },
        documento: { select: { chaveAcesso: true } },
      },
    });
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
