import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
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
      // IBS/CBS por item (reforma — destacado a partir de 2026)
      'ALTER TABLE "item_documento" ADD COLUMN IF NOT EXISTS "cstIbsCbs" TEXT',
      'ALTER TABLE "item_documento" ADD COLUMN IF NOT EXISTS "cClassTrib" TEXT',
      'ALTER TABLE "item_documento" ADD COLUMN IF NOT EXISTS "vBcIbsCbs" DECIMAL(18,2)',
      'ALTER TABLE "item_documento" ADD COLUMN IF NOT EXISTS "vCbs" DECIMAL(18,2)',
      'ALTER TABLE "item_documento" ADD COLUMN IF NOT EXISTS "vIbsUf" DECIMAL(18,2)',
      'ALTER TABLE "item_documento" ADD COLUMN IF NOT EXISTS "vIbsMun" DECIMAL(18,2)',
      'ALTER TABLE "item_documento" ADD COLUMN IF NOT EXISTS "vIbs" DECIMAL(18,2)',
      // Índice p/ as agregações de SAÍDA do Painel (tenantId+tipoOperacao+faixa de
      // dataEmissao) — complementa o índice (tenantId, dataEmissao) existente.
      'CREATE INDEX IF NOT EXISTS "idx_docfiscal_tenant_tipo_data" ON "documento_fiscal" ("tenantId", "tipoOperacao", "dataEmissao")',
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

  /**
   * Executa VÁRIAS consultas escopadas ao tenant dentro de UMA ÚNICA transação,
   * setando o GUC `app.current_tenant` uma só vez. Use em telas que disparam
   * muitas agregações de uma vez (ex.: o Painel faz ~11): com `scoped`, cada
   * consulta abriria sua PRÓPRIA transação (BEGIN/set_config/COMMIT) e disputaria
   * o pool de conexões — lento e capaz de esgotar o pool. Aqui é 1 transação,
   * 1 conexão, 1 set_config.
   *
   * A RLS continua garantida: o set_config(...,true) é LOCAL à transação e roda
   * ANTES do callback, então todas as queries de `fn` veem só o tenant atual.
   */
  scopedBatch<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const tenantId = this.tenantId;
    return this.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
        return fn(tx);
      },
      { timeout: 20_000 },
    );
  }
}
