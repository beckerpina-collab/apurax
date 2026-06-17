import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { DfeModule } from '../dfe/dfe.module';
import { AdnNfseClient } from './adn-nfse.client';
import { AdnNfseService } from './adn-nfse.service';
import { NfseController } from './nfse.controller';
import { NfseParserService } from './nfse-parser.service';
import { NfseService } from './nfse.service';

@Module({
  imports: [AuditoriaModule, DfeModule], // DfeModule exporta CertificadoService (custódia A1)
  controllers: [NfseController],
  providers: [NfseService, NfseParserService, AdnNfseClient, AdnNfseService],
})
export class NfseModule {}
