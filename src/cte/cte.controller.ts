import { Body, Controller, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CteService } from './cte.service';
import { ImportarCteDto } from './dto/importar-cte.dto';

@Controller('fiscal')
export class CteController {
  constructor(private readonly cte: CteService) {}

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('cte')
  importar(@Body() dto: ImportarCteDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.cte.importar(dto.empresaId, dto.xml, user.userId);
  }
}
