/* eslint-disable no-console */
// ============================================================================
// LIMPEZA DE DADOS DE TESTE — apaga TODOS os dados transacionais/fiscais de
// todos os tenants: documentos (NF-e/NFC-e/CT-e), itens, apurações de crédito,
// apurações de imposto, NFS-e, lacunas/importações SPED, competências,
// cursores DFe e trilha de auditoria.
//
// MANTÉM: contas (tenants/usuários), empresas, regras de crédito, certificados
// e a CONEXÃO BLING (não precisa reconectar).
//
// Como as tabelas estão sob RLS (fail-closed), o script seta o GUC
// app.current_tenant por tenant, dentro de transação — igual ao app.
//
// Uso (na pasta do projeto, com DATABASE_URL apontando para o banco alvo):
//   npm run db:limpar
//
// Opcional — APAGAR também a conta demo do seed (tenant "Escritório Demo",
// com o login admin@apurax.local e as 2 empresas de CNPJ fictício; o cascade
// remove usuários/empresas/conexões dela):
//   PowerShell:  $env:APAGAR_CONTA_DEMO="sim"; npm run db:limpar
// ============================================================================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_DEMO = '00000000-0000-0000-0000-000000000001';

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, nome: true } });
  console.log(`Limpando dados transacionais de ${tenants.length} tenant(s)...`);

  for (const t of tenants) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${t.id}, true)`;
      // ordem respeita as FKs (filhos antes dos pais)
      const apc = await tx.apuracaoCredito.deleteMany({});
      const lac = await tx.lacunaCredito.deleteMany({});
      const itm = await tx.itemDocumento.deleteMany({});
      const doc = await tx.documentoFiscal.deleteMany({});
      const nfs = await tx.notaServico.deleteMany({});
      const api = await tx.apuracaoImposto.deleteMany({});
      const spd = await tx.importacaoSped.deleteMany({});
      const cmp = await tx.competencia.deleteMany({});
      const cur = await tx.distribuicaoCursor.deleteMany({});
      const aud = await tx.auditoriaEvento.deleteMany({});
      console.log(
        `  ${t.nome}: ${doc.count} documentos, ${itm.count} itens, ${apc.count} apurações de crédito, ` +
          `${api.count} apurações de imposto, ${nfs.count} NFS-e, ${spd.count} SPED, ${lac.count} lacunas, ` +
          `${cmp.count} competências, ${cur.count} cursores, ${aud.count} eventos de auditoria.`,
      );
    });
  }

  if (process.env.APAGAR_CONTA_DEMO === 'sim') {
    const demo = await prisma.tenant.findUnique({ where: { id: TENANT_DEMO } });
    if (demo) {
      await prisma.tenant.delete({ where: { id: TENANT_DEMO } }); // cascade: usuários, empresas, conexão Bling
      console.log(`Conta demo "${demo.nome}" apagada (login admin@apurax.local deixou de existir).`);
    } else {
      console.log('Conta demo não encontrada (já removida).');
    }
  } else {
    console.log('Conta demo MANTIDA (para apagar: APAGAR_CONTA_DEMO=sim).');
  }

  console.log('Limpeza concluída. As regras de crédito, contas, empresas e a conexão Bling foram preservadas.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
