# Apurax — Web (frontend)

App web do Apurax: **Vite + React + TypeScript + React Router**. Tela de login + painel de créditos (apurações, importação de NF-e, delta da reforma CBS/IBS).

## Rodar

```bash
cd web
npm install
cp .env.example .env   # Windows: copy .env.example .env
npm run dev            # http://localhost:5173
```

Build estático: `npm run build` → `dist/` (servível por qualquer static host / `npx serve -s dist`).

## Modo demo × API real

O app tem um **modo demo** (padrão) com dados de exemplo, para rodar **sem o backend**:

- `VITE_DEMO="true"` → login e dados vêm de mocks no próprio frontend. Login: **admin@apurax.local / apurax123**.
- `VITE_DEMO="false"` + `VITE_API_URL="https://www.apurax.com.br"` → fala com a **API NestJS** real (`/auth/login`, `/empresas`, `/apuracoes`, `/fiscal/nfe`, `/reforma/comparar`).

O cliente HTTP (`src/lib/api.ts`) já está pronto para os dois modos — é só virar a env quando o backend estiver no ar.

## Telas

- **Login** — autenticação (JWT no modo real).
- **Painel** — crédito sugerido/homologado, lacuna do SPED, delta da reforma + apurações recentes.
- **Empresas** — regime tributário (define o que credita).
- **Importar NF-e** — cola o XML → crédito por item.
- **Apurações** — homologar/glosar (SUGERIDO → HOMOLOGADO/GLOSADO).
- **Reforma CBS/IBS** — delta de oportunidade (legado × novo).
