import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { CteModule } from '../cte/cte.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { CapturaAgendadaService } from './captura-agendada.service';
import { CertificadoService } from './certificado.service';
import { CryptoEnvelopeService, KMS_MASTER_KEY } from './crypto-envelope.service';
import { DfeController } from './dfe.controller';
import { DistribuicaoService } from './distribuicao.service';
import { DocZipService } from './doc-zip.service';
import { SefazDfeSoapClient } from './sefaz-dfe-soap.client';
import { SEFAZ_DFE_CLIENT } from './sefaz-dfe.client';
import { SefazEventoSoapClient } from './sefaz-evento-soap.client';

@Module({
  imports: [AuditoriaModule, FiscalModule, CteModule],
  controllers: [DfeController],
  providers: [
    {
      // Master key da custódia (envelope encryption). Em produção, substituir por
      // KMS (AWS/GCP/Azure). sha256 garante 32 bytes a partir do segredo de ambiente.
      provide: KMS_MASTER_KEY,
      useFactory: (config: ConfigService) =>
        createHash('sha256')
          .update(config.get<string>('APURAX_KMS_MASTER_KEY') ?? 'apurax-dev-master-key-trocar-em-producao')
          .digest(),
      inject: [ConfigService],
    },
    { provide: SEFAZ_DFE_CLIENT, useClass: SefazDfeSoapClient },
    SefazEventoSoapClient,
    CryptoEnvelopeService,
    DocZipService,
    CertificadoService,
    DistribuicaoService,
    CapturaAgendadaService,
  ],
})
export class DfeModule {}
