import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Executa `fn` dentro de uma transação com o GUC `app.current_tenant` setado,
 * ativando as políticas de RLS — exatamente o que o PrismaService.scoped faz em
 * produção, isolado aqui para os testes.
 */
export async function asTenant<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
    return fn(tx);
  });
}
