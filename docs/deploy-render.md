# Deploy Apurax — Render (1 serviço: front + API juntos)

> O **NestJS serve o front estático (web/dist) + a API sob `/api`** no mesmo domínio. Um único serviço web (Docker) + um Postgres gerenciado, tudo no painel do Render. Atende `https://www.apurax.com.br/api/bling/callback` sem proxy externo.
>
> Vantagem: o Postgres do Render **não é superusuário** → a RLS (`FORCE`) já vale sem precisar do papel `apurax_app`.

## Fase 0 — Repositório no GitHub
O Render faz deploy a partir de um repositório Git.
```bash
cd G:\APP\apurax
git init && git add -A && git commit -m "Apurax MVP"
# crie um repo no GitHub (privado) e:
git remote add origin https://github.com/SEU_USUARIO/apurax.git
git branch -M main && git push -u origin main
```
> O `.env` (com segredos) **não** é commitado (está no `.gitignore`). Confirme com `git status` antes do push.

## Fase 1 — Blueprint no Render
1. render.com → **New + → Blueprint** → conecte o repositório `apurax`.
2. O Render lê o **`render.yaml`** e propõe criar: o web service `apurax-api` (Docker) + o Postgres `apurax-db`.
3. **Apply**. (Se reclamar do nome do plano do banco, escolha um plano atual de Postgres no painel.)

## Fase 2 — Segredos manuais (web service → Environment)
O blueprint já injeta `DATABASE_URL` (do Postgres) e gera o `JWT_SECRET`. Defina à mão:
- `APURAX_KMS_MASTER_KEY` → gere um forte: `openssl rand -hex 32` (⚠️ **definitivo** — trocar depois torna tokens/A1 cifrados ilegíveis).
- `BLING_CLIENT_SECRET` → `fdfb56733a6d56be4759fa629010d7d82ddf9fb93d0eb98cdb706d146115`.
- `ANTHROPIC_API_KEY` → opcional (validador de NCM real).

Salve → o Render redeploya.

## Fase 3 — Criar tabelas + RLS + seed (do seu PC, contra a External URL)
No painel do Postgres `apurax-db`, copie a **External Database URL** (vem com `sslmode=require`).
```bash
cd G:\APP\apurax
$env:DATABASE_URL="postgresql://...EXTERNAL_URL_DO_RENDER...?sslmode=require"   # PowerShell
npx prisma db push        # cria TODAS as tabelas (inclui nfse e bling)
npm run db:rls            # ativa a Row-Level Security
npm run seed              # cria admin + regras + 1 empresa
```
> **Login inicial:** confira/edite as credenciais do admin em `prisma/seed.ts` antes de rodar o seed; garanta que ele cria **ao menos uma empresa** (o seletor do topo depende disso).

## Fase 4 — Domínio www.apurax.com.br
1. Render → web service `apurax-api` → **Settings → Custom Domains → Add** `www.apurax.com.br` (e `apurax.com.br`).
2. O Render mostra um **CNAME** (para `www`) e instrução para o apex.
3. No **registro.br**: cadastre o CNAME do `www` e o apex conforme o Render indicar. TLS é emitido automaticamente.
4. Confirme `https://www.apurax.com.br/api/health` → `{status:"ok"}`.

## Fase 5 — Conferir o app do Bling
- Redirect = `https://www.apurax.com.br/api/bling/callback`
- Webhook = `https://www.apurax.com.br/api/bling/webhook`
(idênticos ao que está no serviço.)

## Fase 6 — Testar de ponta a ponta
`https://www.apurax.com.br` → login → selecionar empresa → **Bling → Conectar** → autoriza → **Importar para apuração** → **Apurações → Imposto a pagar**. Emitir uma NF no Bling deve disparar o **webhook** e ingerir sozinho.

## Atualizações futuras
`git push` na `main` → o Render redeploya sozinho (`autoDeploy: true`). Mudou o schema? rode de novo `prisma db push` (Fase 3) contra a External URL.

## Custo (ordem de grandeza)
- Web service Starter: **US$7/mês** (sempre ligado).
- Postgres: **~US$7/mês** (Basic; suba o plano para produção séria).
- **Total ≈ US$14/mês** (≈ R$77). HTTPS e domínio inclusos.
