import { Body, Controller, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AgenteService } from './agente.service';
import { ClassificacaoService } from './classificacao.service';
import { ClassificarItemDto } from './dto/classificar-item.dto';
import { PerguntarDto } from './dto/perguntar.dto';

@Controller('ia')
export class IaController {
  constructor(
    private readonly classificacao: ClassificacaoService,
    private readonly agente: AgenteService,
  ) {}

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('classificar-item')
  classificar(@Body() dto: ClassificarItemDto) {
    return this.classificacao.classificar(dto);
  }

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('perguntar')
  perguntar(@Body() dto: PerguntarDto) {
    return this.agente.perguntar(dto.pergunta, dto.item, dto.regime);
  }
}
