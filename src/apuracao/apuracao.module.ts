import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ApuracaoController } from './apuracao.controller';
import { ApuracaoService } from './apuracao.service';

@Module({
  imports: [AuditoriaModule],
  controllers: [ApuracaoController],
  providers: [ApuracaoService],
})
export class ApuracaoModule {}
