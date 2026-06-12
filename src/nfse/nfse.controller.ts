import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ImportarNfseDto } from './dto/importar-nfse.dto';
import { NfseService } from './nfse.service';

@Controller('nfse')
export class NfseController {
  constructor(private readonly nfse: NfseService) {}

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('import')
  importar(@Body() dto: ImportarNfseDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.nfse.importar(dto.empresaId, dto.xml, user.userId);
  }

  @Get()
  listar() {
    return this.nfse.listar();
  }
}
