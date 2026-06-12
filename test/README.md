# Testes do Apurax

## Unitários / integração (sem banco) — `npm test`

- `src/motor-credito/motor-credito.service.spec.ts` — regras do motor determinístico.
- `src/fiscal/nfe-fluxo.spec.ts` — parser + motor sobre o XML de exemplo (`test/fixtures/nfe-entrada-exemplo.xml`).

Rodam sem infraestrutura.

## E2E de isolamento de tenant (RLS) — `npm run test:e2e`  **[P0]**

`test/tenant-isolation/rls.e2e-spec.ts` prova que o tenant A não acessa dados de B.
Para ter valor, **precisa rodar contra o papel NÃO-superusuário** `apurax_app`
(superusuário ignora RLS e o teste passaria falsamente).

### Preparar o banco de teste (uma vez)

```bash
# com o Postgres do docker-compose no ar:
docker compose up -d postgres

# cria o banco de teste, de dono apurax_app (papel criado pelo init-db.sql)
docker exec -i apurax-postgres psql -U postgres -c "CREATE DATABASE apurax_test OWNER apurax_app;"

# migra o schema e aplica a RLS no banco de teste
$env:TEST_DATABASE_URL="postgresql://apurax_app:apurax_dev@localhost:5432/apurax_test?schema=public"
npx prisma migrate deploy
npx prisma db execute --file prisma/rls.sql --url $env:TEST_DATABASE_URL
```

### Rodar

```bash
$env:TEST_DATABASE_URL="postgresql://apurax_app:apurax_dev@localhost:5432/apurax_test?schema=public"
npm run test:e2e
```

> Se você apontar `TEST_DATABASE_URL` para o superusuário `postgres`, o teste
> `fail-closed` vai **falhar de propósito** — é o sinal de que a RLS não está
> sendo enforçada e o papel está errado.
