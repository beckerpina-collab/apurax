import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

/**
 * PrismaService com escopo de tenant para Row-Level Security.
 *
 * - `this` (cliente base) é usado para tabelas NÃO tenant-scoped (auth/usuario,
 *   regra_credito) e operações administrativas.
 * - `scoped` retorna um cliente que, a cada operação, abre uma transação e seta
 *   o GUC `app.current_tenant`, ativando as políticas de RLS (prisma/rls.sql).
 *   O tenant vem do CLS (preenchido pela JwtStrategy a partir do token).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly cls: ClsService) {
    // omit global: o XML bruto (grande) NUNCA é carregado nas consultas normais
    // (listagens, apurações). Só é lido quando o download faz select explícito.
    super({ omit: { documentoFiscal: { xml: true } } });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.aplicarMigracoesLeves();
  }

  /**
   * Migrações LEVES e IDEMPOTENTES aplicadas no boot. O projeto não versiona
   * migrations nem aplica schema no deploy; isto sincroniza alterações ADITIVAS
   * (ADD COLUMN IF NOT EXISTS) automaticamente, sem CLI do Prisma em produção e
   * sem risco — NUNCA dropa nada. Mudanças destrutivas exigem migration real.
   */
  private async aplicarMigracoesLeves(): Promise<void> {
    const ddl = [
      'ALTER TABLE "documento_fiscal" ADD COLUMN IF NOT EXISTS "destinatarioNome" TEXT',
      'ALTER TABLE "documento_fiscal" ADD COLUMN IF NOT EXISTS "xml" TEXT',
    ];
    for (const sql of ddl) {
      try {
        await this.$executeRawUnsafe(sql);
      } catch (e) {
        this.logger.error(`Migração leve falhou (${sql}): ${(e as Error).message}`);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** tenant atual (do CLS / JWT). */
  get tenantId(): string {
    const id = this.cls.get<string>('tenantId');
    if (!id) {
      throw new Error('Contexto de tenant ausente — requisição sem autenticação?');
    }
    return id;
  }

  /** cliente vinculado a um tenant explícito (RLS via set_config por transação). */
  forTenant(tenantId: string) {
    const base = this;
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const [, result] = await base.$transaction([
              base.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`,
              query(args),
            ]);
            return result as unknown;
          },
        },
      },
    });
  }

  /** cliente escopado ao tenant do contexto atual. */
  get scoped() {
    return this.forTenant(this.tenantId);
  }
}
