import { Body, Controller, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CompararDto } from './dto/comparar.dto';
import { ReformaService } from './reforma.service';

@Controller('reforma')
export class ReformaController {
  constructor(private readonly reforma: ReformaService) {}

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('comparar')
  comparar(@Body() dto: CompararDto) {
    return this.reforma.compararDocumento(dto.empresaId, dto.xml, dto.finalidade);
  }
}
