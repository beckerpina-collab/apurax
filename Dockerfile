# ============================================================================
# Apurax — imagem única (1 serviço): NestJS serve a API (/api) E o front (web/dist).
# Render/Cloud Run injetam PORT; o app lê process.env.PORT (main.ts).
# ============================================================================
FROM node:20-slim AS build
WORKDIR /app
# openssl: necessário para o query engine do Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# 1) Backend (NestJS) → dist
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# 2) Front (Vite) → web/dist (usa web/.env.production: VITE_DEMO=false, VITE_API_URL=/api)
WORKDIR /app/web
RUN npm ci && npm run build
WORKDIR /app

FROM node:20-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV SERVE_STATIC=true
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Cliente Prisma gerado (engine + client) + build do backend + front estático.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/web/dist ./web/dist
EXPOSE 8080
CMD ["node", "dist/main.js"]
