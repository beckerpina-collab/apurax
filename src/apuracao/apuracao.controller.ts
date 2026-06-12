import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { Role, StatusApuracao } from '@prisma/client';
import { CurrentUser, UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApuracaoService } from './apuracao.service';
import { GlosarDto } from './dto/glosar.dto';

@Controller('apuracoes')
export class ApuracaoController {
  constructor(private readonly apuracoes: ApuracaoService) {}

  @Get()
  listar(@Query('status') status?: StatusApuracao) {
    return this.apuracoes.listar(status);
  }

  @Roles(Role.ADMIN, Role.CONTADOR)
  @Patch(':id/homologar')
  homologar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.apuracoes.homologar(id, user.userId);
  }

  @Roles(Role.ADMIN, Role.CONTADOR)
  @Patch(':id/glosar')
  glosar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GlosarDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.apuracoes.glosar(id, user.userId, dto.motivo);
  }
}
