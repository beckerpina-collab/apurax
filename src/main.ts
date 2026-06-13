import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  // rawBody: true mantém o corpo CRU disponível (req.rawBody) — necessário para
  // validar a assinatura HMAC do webhook do Bling sobre os bytes exatos.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // Atrás do proxy do Render: confiar no X-Forwarded-For p/ o rate limit por IP
  // funcionar (senão todos os clientes aparecem com o IP do proxy).
  app.set('trust proxy', 1);
  // Limite de 10mb (padrão do Express é 100kb): NF-e com muitos itens e o PFX
  // em base64 passam disso. useBodyParser preserva o rawBody do webhook.
  app.useBodyParser('json', { limit: '10mb' });

  // Prefixo global /api: o front e a API moram no mesmo domínio
  // (www.apurax.com.br); o Firebase Hosting reescreve /api/** para o Cloud Run.
  // Logo todas as rotas ficam em /api/... (ex.: callback do Bling em
  // /api/bling/callback). Em dev, o backend atende em http://localhost:3000/api.
  app.setGlobalPrefix('api');

  // Servindo o front no mesmo domínio, o CSP padrão do helmet bloquearia a fonte
  // do Google e os estilos inline do Radix. Liberamos só o necessário.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
        },
      },
    }),
  );
  // CORS restrito ao domínio do Apurax (+ localhost em dev). Ajuste via
  // APURAX_CORS_ORIGINS (lista separada por vírgula).
  const origensPadrao = [
    'https://apurax.com.br',
    'https://www.apurax.com.br',
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  const origens = (process.env.APURAX_CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origens.length > 0 ? origens : origensPadrao, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Apurax API em http://localhost:${port}`);
}

void bootstrap();
