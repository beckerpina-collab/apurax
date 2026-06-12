import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { CryptoEnvelopeService, KMS_MASTER_KEY } from '../dfe/crypto-envelope.service';
import { FiscalModule } from '../fiscal/fiscal.module';
import { BlingController } from './bling.controller';
import { BlingService } from './bling.service';
import { BlingTokenService } from './bling-token.service';

@Module({
  imports: [FiscalModule],
  controllers: [BlingController],
  providers: [
    BlingService,
    BlingTokenService,
    CryptoEnvelopeService,
    {
      // Mesma master key de custódia do A1 (envelope encryption). KMS em produção.
      provide: KMS_MASTER_KEY,
      useFactory: (config: ConfigService) =>
        createHash('sha256')
          .update(config.get<string>('APURAX_KMS_MASTER_KEY') ?? 'apurax-dev-master-key-trocar-em-producao')
          .digest(),
      inject: [ConfigService],
    },
  ],
})
export class BlingModule {}
