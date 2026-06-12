import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { MotorCreditoModule } from '../motor-credito/motor-credito.module';
import { SpedController } from './sped.controller';
import { SpedGapService } from './sped-gap.service';
import { SpedImportService } from './sped-import.service';
import { SpedParserService } from './sped-parser.service';

@Module({
  imports: [MotorCreditoModule, AuditoriaModule],
  controllers: [SpedController],
  providers: [SpedParserService, SpedGapService, SpedImportService],
})
export class SpedModule {}
