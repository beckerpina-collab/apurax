import { Module } from '@nestjs/common';
import { NfseModule } from '../nfse/nfse.module';
import { SaeModule } from '../sae/sae.module';
import { CapturaSaidasCronService } from './captura-saidas-cron.service';

/**
 * Módulo FOLHA do cron de captura de saídas (NFC-e SAE-SP + NFS-e ADN). Importa
 * SaeModule e NfseModule (que já dependem do DfeModule) — como ninguém importa este
 * módulo de volta, não há ciclo de DI, e o cron de ENTRADA (DfeModule) fica intocado.
 */
@Module({
  imports: [SaeModule, NfseModule],
  providers: [CapturaSaidasCronService],
})
export class CapturaSaidasCronModule {}
