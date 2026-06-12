import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
  constructor(private readonly cls: ClsService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
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
