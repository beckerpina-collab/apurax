import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface RegistroAuditoria {
  tipo: string; // ex.: APURACAO_CALCULADA, APURACAO_HOMOLOGADA
  entidade: string; // ex.: ApuracaoCredito
  entidadeId: string;
  dados: Prisma.InputJsonValue;
  usuarioId?: string | null;
}

/**
 * Trilha de auditoria append-only com encadeamento por hash (hash chain).
 * hash_n = sha256(sequencia, tipo, entidade, entidadeId, dados, hash_{n-1}).
 * Adulterar qualquer evento passado quebra a verificação de toda a cadeia.
 */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  private calcularHash(params: {
    sequencia: number;
    tipo: string;
    entidade: string;
    entidadeId: string;
    dados: unknown;
    hashAnterior: string | null;
  }): string {
    return createHash('sha256').update(JSON.stringify(params)).digest('hex');
  }

  async registrar(input: RegistroAuditoria) {
    const tenantId = this.prisma.tenantId;
    const ultimo = await this.prisma.scoped.auditoriaEvento.findFirst({
      orderBy: { sequencia: 'desc' },
    });
    const sequencia = (ultimo?.sequencia ?? 0) + 1;
    const hashAnterior = ultimo?.hash ?? null;
    const hash = this.calcularHash({
      sequencia,
      tipo: input.tipo,
      entidade: input.entidade,
      entidadeId: input.entidadeId,
      dados: input.dados,
      hashAnterior,
    });

    return this.prisma.scoped.auditoriaEvento.create({
      data: {
        tenantId,
        sequencia,
        tipo: input.tipo,
        entidade: input.entidade,
        entidadeId: input.entidadeId,
        dados: input.dados,
        usuarioId: input.usuarioId ?? null,
        hashAnterior,
        hash,
      },
    });
  }

  /** Recalcula a cadeia e aponta a primeira sequência adulterada, se houver. */
  async verificarCadeia(): Promise<{ valida: boolean; quebraNaSequencia?: number }> {
    const eventos = await this.prisma.scoped.auditoriaEvento.findMany({
      orderBy: { sequencia: 'asc' },
    });
    let hashAnterior: string | null = null;
    for (const ev of eventos) {
      const esperado = this.calcularHash({
        sequencia: ev.sequencia,
        tipo: ev.tipo,
        entidade: ev.entidade,
        entidadeId: ev.entidadeId,
        dados: ev.dados,
        hashAnterior,
      });
      if (esperado !== ev.hash || ev.hashAnterior !== hashAnterior) {
        return { valida: false, quebraNaSequencia: ev.sequencia };
      }
      hashAnterior = ev.hash;
    }
    return { valida: true };
  }
}
