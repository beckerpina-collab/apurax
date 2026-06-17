import { Module } from '@nestjs/common';
import { DfeModule } from '../dfe/dfe.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { SaeController } from './sae.controller';
import { SaeService } from './sae.service';
import { SaeSpClient } from './sae-sp.client';

/**
 * SAE — captura de NFC-e emitidas pela SEFAZ-SP. Reaproveita CertificadoService
 * (custódia A1) do DfeModule e NfeService (importação como saída) do FiscalModule.
 */
@Module({
  imports: [DfeModule, FiscalModule],
  controllers: [SaeController],
  providers: [SaeService, SaeSpClient],
})
export class SaeModule {}
