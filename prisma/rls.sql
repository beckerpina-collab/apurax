-- ============================================================================
-- APURAX — Row-Level Security (defesa em profundidade do multi-tenant)
--
-- Rode DEPOIS de `prisma migrate` e do `seed` (o seed insere sem contexto de
-- tenant; com RLS forçada ele seria bloqueado):
--     npm run db:rls
--
-- Como funciona: a aplicação seta, por transação, o GUC `app.current_tenant`
-- (ver PrismaService.scoped()). As políticas abaixo só liberam linhas cujo
-- "tenantId" casa com esse GUC. Se o GUC não estiver setado, current_setting
-- retorna NULL e NENHUMA linha é liberada (fail-closed).
--
-- IMPORTANTE: superusuário do Postgres IGNORA RLS. Para que isto valha, a
-- aplicação precisa conectar com um papel NÃO-superusuário (apurax_app, criado
-- por init-db.sql). FORCE garante que a política valha até para o dono da tabela.
-- ============================================================================

DO $$
DECLARE
  t text;
  -- 'usuario' fica FORA da RLS de propósito: é a tabela de identidade consultada
  -- no login, quando ainda não há tenant no contexto. O isolamento de usuários
  -- por tenant é feito em nível de aplicação (filtro explícito por tenantId).
  tabelas text[] := ARRAY[
    'empresa',
    'documento_fiscal',
    'item_documento',
    'apuracao_credito',
    'auditoria_evento',
    'competencia',
    'importacao_sped',
    'lacuna_credito',
    'certificado_digital',
    'distribuicao_cursor',
    'apuracao_imposto',
    'nota_servico'
    -- 'bling_conexao' fica FORA da RLS de propósito (como 'usuario'): o webhook
    -- do Bling é PÚBLICO (sem contexto de tenant) e precisa varrer as conexões
    -- para resolver o dono da NF por prova de posse. Tokens ficam cifrados em
    -- repouso e o escopo de tenant é forçado por código (filtro explícito).
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING ("tenantId" = current_setting(''app.current_tenant'', true)::uuid)
         WITH CHECK ("tenantId" = current_setting(''app.current_tenant'', true)::uuid);',
      t
    );
  END LOOP;
END
$$;
