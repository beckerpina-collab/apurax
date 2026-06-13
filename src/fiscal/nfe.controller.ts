import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ImportarNfeDto } from './dto/importar-nfe.dto';
import { NfeService } from './nfe.service';

@Controller('fiscal')
export class NfeController {
  constructor(private readonly nfe: NfeService) {}

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('nfe')
  importar(@Body() dto: ImportarNfeDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.nfe.importar(dto.empresaId, dto.xml, user.userId);
  }

  @Get('documentos')
  listar(@Query('ano') ano?: string, @Query('mes') mes?: string) {
    const a = Number(ano);
    const m = Number(mes);
    return this.nfe.listarDocumentos({
      ano: Number.isInteger(a) && a > 0 ? a : undefined,
      mes: Number.isInteger(m) && m >= 1 && m <= 12 ? m : undefined,
    });
  }

  @Get('documentos/:id')
  detalhe(@Param('id', ParseUUIDPipe) id: string) {
    return this.nfe.detalhe(id);
  }
}
