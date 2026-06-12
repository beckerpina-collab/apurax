# Deploy Apurax — Google Cloud (Firebase Hosting + Cloud Run + Cloud SQL)

> **Arquitetura:** o front (estático) vai no **Firebase Hosting**; o backend NestJS vai no **Cloud Run**; o Postgres no **Cloud SQL** — tudo no mesmo projeto GCP, na região **southamerica-east1 (São Paulo)**. O Hosting reescreve `/api/**` para o Cloud Run, então tudo fica em `https://www.apurax.com.br` e o callback/webhook do Bling em `https://www.apurax.com.br/api/bling/...`.
>
> O nome do serviço Cloud Run **precisa ser `apurax-api`** (é o que está em `web/firebase.json`).

Placeholders a substituir: `PROJECT_ID`, `DB_PASS` (senha forte do apurax_app).
Constantes: `REGION=southamerica-east1`, `INSTANCE=apurax-db`, `DB=apurax`, `CONNECTION_NAME=PROJECT_ID:southamerica-east1:apurax-db`.

---

## Fase 0 — Pré-requisitos (uma vez)
```bash
# CLIs
npm install -g firebase-tools
# gcloud: instale o Google Cloud SDK (cloud.google.com/sdk/docs/install)

gcloud auth login
gcloud config set project PROJECT_ID

# habilita as APIs necessárias
gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  secretmanager.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```
Crie o projeto em console.cloud.google.com (com billing ativo) antes, se ainda não existir.

## Fase 1 — Banco (Cloud SQL Postgres 16, São Paulo)
```bash
gcloud sql instances create apurax-db \
  --database-version=POSTGRES_16 --region=southamerica-east1 \
  --tier=db-f1-micro --storage-size=10GB

gcloud sql users set-password postgres --instance=apurax-db --password='SENHA_POSTGRES_FORTE'
gcloud sql databases create apurax --instance=apurax-db

# pegue o CONNECTION_NAME (PROJECT_ID:southamerica-east1:apurax-db):
gcloud sql instances describe apurax-db --format='value(connectionName)'
```

## Fase 2 — Criar tabelas + RLS + seed (via Cloud SQL Auth Proxy, do seu PC)
Baixe o **Cloud SQL Auth Proxy** (cloud.google.com/sql/docs/postgres/sql-proxy) e rode:
```bash
./cloud-sql-proxy CONNECTION_NAME --port 5432      # deixa rodando num terminal
```
Noutro terminal, **como superusuário** crie o papel não-superusuário (a RLS depende disso):
```bash
psql "postgresql://postgres:SENHA_POSTGRES_FORTE@localhost:5432/apurax" -c \
 "CREATE ROLE apurax_app WITH LOGIN PASSWORD 'DB_PASS' NOSUPERUSER;
  GRANT ALL PRIVILEGES ON DATABASE apurax TO apurax_app;
  GRANT ALL ON SCHEMA public TO apurax_app;
  ALTER SCHEMA public OWNER TO apurax_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO apurax_app;"
```
Agora, **como apurax_app**, crie o schema a partir do Prisma e aplique RLS + seed (na raiz do projeto):
```bash
export DATABASE_URL="postgresql://apurax_app:DB_PASS@localhost:5432/apurax?schema=public"
npx prisma db push        # cria TODAS as tabelas do schema atual (inclui nfse e bling)
npm run db:rls            # ativa as políticas de Row-Level Security
npm run seed              # cria tenant + usuário admin + regras de crédito + 1 empresa
```
> **Login inicial:** confira/edite as credenciais do admin em `prisma/seed.ts` antes de rodar o seed. Garanta que o seed cria **ao menos uma empresa** (o seletor do topo precisa dela); se não criar, cadastre depois via `POST /api/empresas`.
>
> Usei `db push` (sem histórico de migration) por ser MVP — depois dá para adotar `prisma migrate`.

## Fase 3 — Segredos (Secret Manager)
```bash
# DATABASE_URL de produção (socket do Cloud SQL):
printf 'postgresql://apurax_app:DB_PASS@localhost/apurax?host=/cloudsql/CONNECTION_NAME&schema=public' \
  | gcloud secrets create apurax-db-url --data-file=-

# segredos fortes:
openssl rand -hex 32 | gcloud secrets create apurax-jwt --data-file=-
openssl rand -hex 32 | gcloud secrets create apurax-kms --data-file=-   # custódia A1 + tokens Bling
printf 'fdfb56733a6d56be4759fa629010d7d82ddf9fb93d0eb98cdb706d146115' \
  | gcloud secrets create apurax-bling-secret --data-file=-
# (opcional, p/ o validador de NCM real) printf 'SUA_ANTHROPIC_KEY' | gcloud secrets create apurax-anthropic --data-file=-
```
> ⚠️ A `apurax-kms` é definitiva: se mudar depois, os tokens do Bling e o A1 já cifrados ficam ilegíveis (exige reconectar).

Dê acesso à conta de serviço do Cloud Run aos segredos:
```bash
PROJ_NUM=$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')
for s in apurax-db-url apurax-jwt apurax-kms apurax-bling-secret; do
  gcloud secrets add-iam-policy-binding $s \
    --member="serviceAccount:${PROJ_NUM}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

## Fase 4 — Backend (Cloud Run) — nome do serviço = apurax-api
Na raiz do projeto (usa o `Dockerfile`):
```bash
gcloud run deploy apurax-api --source . --region southamerica-east1 \
  --allow-unauthenticated \
  --add-cloudsql-instances CONNECTION_NAME \
  --set-env-vars NODE_ENV=production,APURAX_DFE_TPAMB=2,BLING_CLIENT_ID=af3f0b0addf6523c8be167b6c47f20a474fc2d4b,BLING_REDIRECT_URI=https://www.apurax.com.br/api/bling/callback,APP_URL=https://www.apurax.com.br \
  --set-secrets DATABASE_URL=apurax-db-url:latest,JWT_SECRET=apurax-jwt:latest,APURAX_KMS_MASTER_KEY=apurax-kms:latest,BLING_CLIENT_SECRET=apurax-bling-secret:latest
```
- `--allow-unauthenticated`: a API é pública na borda; a proteção é o JWT da própria app (+ o callback/webhook do Bling, que são públicos por natureza).
- CORS: o `main.ts` já libera `apurax.com.br`/`www` por padrão (não precisa setar).
- Teste: `https://<url-do-cloud-run>/api/health` deve responder `{status:"ok"}`.

## Fase 5 — Frontend (Firebase Hosting)
```bash
cd web
firebase use --add            # selecione o MESMO projeto GCP
```
Crie `web/.env.production`:
```
VITE_DEMO=false
VITE_API_URL=/api
```
Build e publique (o `firebase.json` já reescreve `/api/**` → Cloud Run `apurax-api`):
```bash
npm run build
firebase deploy --only hosting
```

## Fase 6 — Domínio (www.apurax.com.br)
1. Firebase Console → **Hosting → Adicionar domínio personalizado** → `www.apurax.com.br` (repita para `apurax.com.br`).
2. O Firebase mostra registros **A** (apex) / **TXT** (verificação) / **CNAME** (`www`).
3. No **registro.br** (painel do domínio), cadastre esses registros. O TLS é emitido sozinho.
4. Propagação: minutos a algumas horas. Confirme `https://www.apurax.com.br/api/health`.

## Fase 7 — Conectar o Bling e testar de ponta a ponta
1. Acesse `https://www.apurax.com.br` → faça login (admin do seed).
2. Selecione a empresa no topo.
3. **Bling → Conectar Bling** → autorize no Bling → volta em `/bling?bling=conectado` ("Conectado").
4. **Bling → Importar para apuração** (período) → as saídas viram documentos.
5. **Apurações → Imposto a pagar** → ICMS/PIS-COFINS/IPI a recolher da competência.
6. **Webhook:** emita/altere uma NF no Bling → deve ser ingerida automaticamente (sem importar manual).

> No app do Bling, confirme que **Redirect** = `https://www.apurax.com.br/api/bling/callback` e **Webhook** = `https://www.apurax.com.br/api/bling/webhook` (idênticos ao que está no Cloud Run).

## (Opcional) Worker da Distribuição DFe
Cloud Run escala a zero. Para a captura automática de NF-e/CT-e de entrada na SEFAZ, agende o **Cloud Scheduler** (a cada 1h) chamando o endpoint de sincronização. Não é necessário para o fluxo do Bling.

## Custo (ordem de grandeza)
- Hosting + Cloud Run: ~grátis em baixo tráfego (Run escala a zero).
- **Cloud SQL: principal custo (~US$ 9–35/mês)** conforme o tier.
- Secret Manager: centavos.
