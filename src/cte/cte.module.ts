import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { MotorCreditoModule } from '../motor-credito/motor-credito.module';
import { CteController } from './cte.controller';
import { CteParserService } from './cte-parser.service';
import { CteService } from './cte.service';

@Module({
  imports: [MotorCreditoModule, AuditoriaModule],
  controllers: [CteController],
  providers: [CteService, CteParserService],
  exports: [CteService],
})
export class CteModule {}
