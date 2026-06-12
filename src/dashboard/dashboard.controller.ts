import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { FiltroDashboardDto } from './dto/filtro-dashboard.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('resumo')
  resumo(@Query() filtro: FiltroDashboardDto) {
    return this.dashboard.resumo(filtro);
  }
}
