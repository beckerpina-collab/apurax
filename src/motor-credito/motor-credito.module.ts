import { Module } from '@nestjs/common';
import { MotorCreditoService } from './motor-credito.service';

@Module({
  providers: [MotorCreditoService],
  exports: [MotorCreditoService],
})
export class MotorCreditoModule {}
