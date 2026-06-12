import { Module } from '@nestjs/common';
import { FiscalModule } from '../fiscal/fiscal.module';
import { MotorCreditoModule } from '../motor-credito/motor-credito.module';
import { ReformaController } from './reforma.controller';
import { ReformaService } from './reforma.service';

@Module({
  imports: [FiscalModule, MotorCreditoModule],
  controllers: [ReformaController],
  providers: [ReformaService],
})
export class ReformaModule {}
