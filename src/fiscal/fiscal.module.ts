import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { MotorCreditoModule } from '../motor-credito/motor-credito.module';
import { NfeController } from './nfe.controller';
import { NfeParserService } from './nfe-parser.service';
import { NfeService } from './nfe.service';

@Module({
  imports: [MotorCreditoModule, AuditoriaModule],
  controllers: [NfeController],
  providers: [NfeService, NfeParserService],
  exports: [NfeService, NfeParserService],
})
export class FiscalModule {}
