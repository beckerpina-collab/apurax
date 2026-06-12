import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { NfseController } from './nfse.controller';
import { NfseParserService } from './nfse-parser.service';
import { NfseService } from './nfse.service';

@Module({
  imports: [AuditoriaModule],
  controllers: [NfseController],
  providers: [NfseService, NfseParserService],
})
export class NfseModule {}
