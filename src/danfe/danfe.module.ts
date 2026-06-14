import { Module } from '@nestjs/common';
import { DacteParser } from './dacte-cte.parser';
import { DanfeNfeParser } from './danfe-nfe.parser';
import { DanfeService } from './danfe.service';

@Module({
  providers: [DanfeService, DanfeNfeParser, DacteParser],
  exports: [DanfeService],
})
export class DanfeModule {}
