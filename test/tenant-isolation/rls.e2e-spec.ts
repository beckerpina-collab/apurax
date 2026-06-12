import { PrismaClient } from '@prisma/client';
import { asTenant } from '../helpers/rls-tenant';

/**
 * TESTE P0 — Isolamento de tenant via Row-Level Security.
 *
 * É o teste que, se falhar, encerra o negócio. Prova que o tenant A não acessa
 * dados do tenant B por nenhum caminho, que escrita cruzada é barrada e que a
 * ausência de contexto é fail-closed (zero linhas).
 *
 * PRÉ-REQUISITOS (ver test/README.md):
 *   - Postgres com a TEST_DATABASE_URL apontando para o papel NÃO-superusuário
 *     apurax_app (superusuário ignora RLS e este teste passaria falsamente).
 *   - schema migrado + `prisma/rls.sql` aplicado no banco de teste.
 */
const URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://apurax_app:apurax_dev@localhost:5432/apurax_test?schema=public';

const TENANT_A = '00000000-0000-0000-0000-00000000aaaa';
const TENANT_B = '00000000-0000-0000-0000-00000000bbbb';

describe('Isolamento de tenant (RLS) [P0]', () => {
  const prisma = new PrismaClient({ datasources: { db: { url: URL } } });

  beforeAll(async () => {
    await prisma.$connect();
    // 'tenant' não está sob RLS — cria direto.
    await prisma.tenant.upsert({ where: { id: TENANT_A }, update: {}, create: { id: TENANT_A, nome: 'Tenant A' } });
    await prisma.tenant.upsert({ where: { id: TENANT_B }, update: {}, create: { id: TENANT_B, nome: 'Tenant B' } });

    await asTenant(prisma, TENANT_A, (tx) => tx.empresa.deleteMany({ where: { tenantId: TENANT_A } }));
    await asTenant(prisma, TENANT_B, (tx) => tx.empresa.deleteMany({ where: { tenantId: TENANT_B } }));

    await asTenant(prisma, TENANT_A, (tx) =>
      tx.empresa.create({
        data: { tenantId: TENANT_A, cnpj: '10000000000001', razaoSocial: 'Empresa A', regimeTributario: 'LUCRO_REAL', uf: 'SP' },
      }),
    );
    await asTenant(prisma, TENANT_B, (tx) =>
      tx.empresa.create({
        data: { tenantId: TENANT_B, cnpj: '20000000000002', razaoSocial: 'Empresa B', regimeTributario: 'LUCRO_REAL', uf: 'RJ' },
      }),
    );
  });

  afterAll(async () => {
    await asTenant(prisma, TENANT_A, (tx) => tx.empresa.deleteMany({ where: { tenantId: TENANT_A } }));
    await asTenant(prisma, TENANT_B, (tx) => tx.empresa.deleteMany({ where: { tenantId: TENANT_B } }));
    await prisma.$disconnect();
  });

  it('A só enxerga as próprias empresas (via ORM)', async () => {
    const empresas = await asTenant(prisma, TENANT_A, (tx) => tx.empresa.findMany());
    expect(empresas).toHaveLength(1);
    expect(empresas[0].razaoSocial).toBe('Empresa A');
  });

  it('A não enxerga B nem em SQL cru', async () => {
    const linhas = await asTenant(
      prisma,
      TENANT_A,
      (tx) => tx.$queryRaw<Array<{ razaoSocial: string }>>`SELECT "razaoSocial" FROM empresa`,
    );
    expect(linhas.length).toBeGreaterThan(0);
    expect(linhas.every((l) => l.razaoSocial === 'Empresa A')).toBe(true);
  });

  it('A não consegue ler uma empresa de B por id', async () => {
    const empresaB = await asTenant(prisma, TENANT_B, (tx) => tx.empresa.findFirstOrThrow());
    const tentativa = await asTenant(prisma, TENANT_A, (tx) => tx.empresa.findUnique({ where: { id: empresaB.id } }));
    expect(tentativa).toBeNull();
  });

  it('A não consegue inserir linha com tenantId de B (WITH CHECK)', async () => {
    await expect(
      asTenant(prisma, TENANT_A, (tx) =>
        tx.empresa.create({
          data: { tenantId: TENANT_B, cnpj: '30000000000003', razaoSocial: 'Intrusa', regimeTributario: 'LUCRO_REAL', uf: 'SP' },
        }),
      ),
    ).rejects.toThrow();
  });

  it('fail-closed: sem contexto de tenant, nenhuma linha é retornada', async () => {
    // consulta FORA de asTenant => GUC ausente => current_setting NULL => 0 linhas
    const semContexto = await prisma.empresa.findMany();
    expect(semContexto).toHaveLength(0);
  });
});
