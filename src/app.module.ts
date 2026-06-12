import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ClsModule } from 'nestjs-cls';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmpresaModule } from './empresa/empresa.module';
import { FiscalModule } from './fiscal/fiscal.module';
import { MotorCreditoModule } from './motor-credito/motor-credito.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { ApuracaoModule } from './apuracao/apuracao.module';
import { SpedModule } from './sped/sped.module';
import { CteModule } from './cte/cte.module';
import { DfeModule } from './dfe/dfe.module';
import { ReformaModule } from './reforma/reforma.module';
import { ApuracaoFiscalModule } from './apuracao-fiscal/apuracao-fiscal.module';
import { NfseModule } from './nfse/nfse.module';
import { BlingModule } from './bling/bling.module';
import { IaModule } from './ia/ia.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HealthController } from './health.controller';

// Em produção (1 serviço no Render), o NestJS serve o front estático (web/dist)
// no mesmo domínio; a API fica sob /api (prefixo global). Em dev, o front roda
// no Vite (:5173), então só liga isto quando SERVE_STATIC=true.
const serveStatic =
  process.env.SERVE_STATIC === 'true'
    ? [
        ServeStaticModule.forRoot({
          rootPath: join(__dirname, '..', 'web', 'dist'),
          exclude: ['/api/(.*)'],
        }),
      ]
    : [];

@Module({
  imports: [
    ...serveStatic,
    ConfigModule.forRoot({ isGlobal: true }),
    // CLS: cada requisição roda num contexto isolado; a JwtStrategy grava aqui o
    // tenantId, lido depois pelo PrismaService para a RLS.
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    PrismaModule,
    AuthModule,
    EmpresaModule,
    FiscalModule,
    MotorCreditoModule,
    AuditoriaModule,
    ApuracaoModule,
    SpedModule,
    CteModule,
    DfeModule,
    ReformaModule,
    ApuracaoFiscalModule,
    NfseModule,
    BlingModule,
    IaModule,
  ],
  controllers: [HealthController],
  providers: [
    // JwtAuthGuard global (rotas são protegidas por padrão; use @Public para abrir).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
