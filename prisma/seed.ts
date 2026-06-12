/* eslint-disable no-console */
import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Regras de crédito (data-driven, versionadas por vigência). O motor resolve a
// regra aplicável por tributo + vigência + condição. Cada crédito cita a baseLegal.
// Para PIS/COFINS o CST avaliado é o do EMITENTE (operação a montante): 01/02 =
// tributado → adquirente (Lucro Real) credita; 04/05/06/07/08/09 = monofásico/ST/
// alíquota zero/isento/suspensão/não incidência → não credita.
const REGRAS: Prisma.RegraCreditoCreateInput[] = [
  // --- ICMS (regime normal) ---
  {
    codigo: 'R-ICMS-CRED-NORMAL',
    tributo: 'ICMS',
    descricao: 'Crédito de ICMS da operação própria em entrada para revenda/insumo',
    baseLegal: 'CF art. 155, §2º, I; LC 87/96, art. 20',
    condicao: { cstIn: ['00', '10', '20', '70'], regimeNotIn: ['SIMPLES_NACIONAL'], campoValor: 'vIcms', creditoPermitido: true },
    prioridade: 10,
    vigenciaInicio: new Date('1996-11-01'),
    ativo: true,
  },
  {
    codigo: 'R-ICMS-CRED-SN',
    tributo: 'ICMS',
    descricao: 'Crédito de ICMS permitido por emitente do Simples (CSOSN 101/201)',
    baseLegal: 'LC 123/2006, art. 23, §1º',
    condicao: { csosnIn: ['101', '201'], regimeNotIn: ['SIMPLES_NACIONAL'], campoValor: 'vCredIcmsSn', creditoPermitido: true },
    prioridade: 10,
    vigenciaInicio: new Date('2007-07-01'),
    ativo: true,
  },
  {
    codigo: 'R-ICMS-VEDADO',
    tributo: 'ICMS',
    descricao: 'Sem crédito: isenta/não trib./suspensão/diferimento/ST (CST 40,41,50,51,60,90)',
    baseLegal: 'LC 87/96, arts. 20 e 21 (operação sem imposto cobrado, ST ou diferimento)',
    condicao: { cstIn: ['40', '41', '50', '51', '60', '90'], campoValor: 'vIcms', creditoPermitido: false },
    prioridade: 50,
    vigenciaInicio: new Date('1996-11-01'),
    ativo: true,
  },
  {
    codigo: 'R-ICMS-VEDADO-SN',
    tributo: 'ICMS',
    descricao: 'Sem crédito: CSOSN sem permissão (102,103,300,400,500,900)',
    baseLegal: 'LC 123/2006 (CSOSN sem permissão de crédito)',
    condicao: { csosnIn: ['102', '103', '300', '400', '500', '900'], campoValor: 'vCredIcmsSn', creditoPermitido: false },
    prioridade: 50,
    vigenciaInicio: new Date('2007-07-01'),
    ativo: true,
  },
  // --- PIS (não-cumulativo) ---
  {
    codigo: 'R-PIS-CRED',
    tributo: 'PIS',
    descricao: 'Crédito de PIS sobre entrada tributada (emitente CST 01/02), regime não-cumulativo',
    baseLegal: 'Lei 10.637/2002, art. 3º',
    condicao: { cstIn: ['01', '02'], regimeIn: ['LUCRO_REAL'], campoValor: 'vPis', creditoPermitido: true },
    prioridade: 10,
    vigenciaInicio: new Date('2002-12-01'),
    ativo: true,
  },
  {
    codigo: 'R-PIS-VEDADO',
    tributo: 'PIS',
    descricao: 'Sem crédito de PIS: monofásico/ST/alíq. zero/isento/suspensão (CST 04-09)',
    baseLegal: 'Lei 10.637/2002, art. 3º, §2º; IN RFB 2.121/2022',
    condicao: { cstIn: ['04', '05', '06', '07', '08', '09'], campoValor: 'vPis', creditoPermitido: false },
    prioridade: 50,
    vigenciaInicio: new Date('2002-12-01'),
    ativo: true,
  },
  // --- COFINS (não-cumulativo) ---
  {
    codigo: 'R-COFINS-CRED',
    tributo: 'COFINS',
    descricao: 'Crédito de COFINS sobre entrada tributada (emitente CST 01/02), regime não-cumulativo',
    baseLegal: 'Lei 10.833/2003, art. 3º',
    condicao: { cstIn: ['01', '02'], regimeIn: ['LUCRO_REAL'], campoValor: 'vCofins', creditoPermitido: true },
    prioridade: 10,
    vigenciaInicio: new Date('2004-02-01'),
    ativo: true,
  },
  {
    codigo: 'R-COFINS-VEDADO',
    tributo: 'COFINS',
    descricao: 'Sem crédito de COFINS: monofásico/ST/alíq. zero/isento/suspensão (CST 04-09)',
    baseLegal: 'Lei 10.833/2003, art. 3º, §2º; IN RFB 2.121/2022',
    condicao: { cstIn: ['04', '05', '06', '07', '08', '09'], campoValor: 'vCofins', creditoPermitido: false },
    prioridade: 50,
    vigenciaInicio: new Date('2004-02-01'),
    ativo: true,
  },
];

async function main() {
  console.log('Seed: regras de crédito...');
  for (const r of REGRAS) {
    await prisma.regraCredito.upsert({
      where: { codigo: r.codigo },
      update: r,
      create: r,
    });
  }
  console.log(`  ${REGRAS.length} regras.`);

  console.log('Seed: tenant + usuário admin + empresas demo...');
  const tenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000001', nome: 'Escritório Demo' },
  });

  const senhaHash = await bcrypt.hash('apurax123', 10);
  await prisma.usuario.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@apurax.local' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@apurax.local',
      senhaHash,
      nome: 'Admin Demo',
      role: 'ADMIN',
    },
  });

  // 'empresa' está sob RLS. O seed roda sem contexto de tenant, então setamos
  // app.current_tenant DENTRO da transação (mesmo mecanismo do PrismaService.scoped)
  // para passar pela política WITH CHECK. Funciona mesmo com a RLS já forçada.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenant.id}, true)`;
    await tx.empresa.upsert({
      where: { tenantId_cnpj: { tenantId: tenant.id, cnpj: '11111111000111' } },
      update: {},
      create: {
        tenantId: tenant.id,
        cnpj: '11111111000111',
        razaoSocial: 'Comércio Lucro Real Ltda',
        regimeTributario: 'LUCRO_REAL',
        uf: 'SP',
      },
    });
    await tx.empresa.upsert({
      where: { tenantId_cnpj: { tenantId: tenant.id, cnpj: '22222222000122' } },
      update: {},
      create: {
        tenantId: tenant.id,
        cnpj: '22222222000122',
        razaoSocial: 'Serviços Presumido Ltda',
        regimeTributario: 'LUCRO_PRESUMIDO',
        uf: 'SP',
      },
    });
  });

  console.log('Seed concluído.');
  console.log('  Login demo: admin@apurax.local / apurax123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
