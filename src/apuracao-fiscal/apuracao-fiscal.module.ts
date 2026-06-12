import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ApuracaoFiscalController } from './apuracao-fiscal.controller';
import { ApuracaoFiscalService } from './apuracao-fiscal.service';

@Module({
  imports: [AuditoriaModule],
  controllers: [ApuracaoFiscalController],
  providers: [ApuracaoFiscalService],
})
export class ApuracaoFiscalModule {}
