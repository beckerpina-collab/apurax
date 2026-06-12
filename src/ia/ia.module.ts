import { Module } from '@nestjs/common';
import { MotorCreditoModule } from '../motor-credito/motor-credito.module';
import { AgenteService } from './agente.service';
import { AnthropicModule } from './anthropic.module';
import { ClassificacaoService } from './classificacao.service';
import { IaController } from './ia.controller';
import { LegislacaoService } from './legislacao.service';

@Module({
  imports: [AnthropicModule, MotorCreditoModule],
  controllers: [IaController],
  providers: [ClassificacaoService, AgenteService, LegislacaoService],
})
export class IaModule {}
