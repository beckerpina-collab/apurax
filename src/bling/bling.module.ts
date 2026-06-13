import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { CryptoEnvelopeService, KMS_MASTER_KEY } from '../dfe/crypto-envelope.service';
import { FiscalModule } from '../fiscal/fiscal.module';
import { BlingController } from './bling.controller';
import { BlingFilaService } from './bling-fila.service';
import { BlingService } from './bling.service';
import { BlingTokenService } from './bling-token.service';

@Module({
  imports: [FiscalModule],
  controllers: [BlingController],
  providers: [
    BlingService,
    BlingFilaService,
    BlingTokenService,
    CryptoEnvelopeService,
    {
      // Mesma master key de custódia do A1 (envelope encryption). KMS em produção.
      provide: KMS_MASTER_KEY,
      useFactory: (config: ConfigService) => {
        const chave = config.get<string>('APURAX_KMS_MASTER_KEY');
        if (!chave && config.get('NODE_ENV') === 'production') {
          throw new Error('APURAX_KMS_MASTER_KEY ausente em produção — abortando (custódia não pode usar chave padrão).');
        }
        return createHash('sha256')
          .update(chave ?? 'apurax-dev-master-key-trocar-em-producao')
          .digest();
      },
      inject: [ConfigService],
    },
  ],
})
export class BlingModule {}
