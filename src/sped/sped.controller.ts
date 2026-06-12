import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ImportarSpedDto } from './dto/importar-sped.dto';
import { SpedImportService } from './sped-import.service';

@Controller('sped')
export class SpedController {
  constructor(private readonly sped: SpedImportService) {}

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('import')
  importar(@Body() dto: ImportarSpedDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.sped.importar(dto.empresaId, dto.conteudo, user.userId);
  }

  @Get('importacoes')
  listar() {
    return this.sped.listarImportacoes();
  }

  @Get('importacoes/:id')
  detalhe(@Param('id', ParseUUIDPipe) id: string) {
    return this.sped.detalhe(id);
  }
}
