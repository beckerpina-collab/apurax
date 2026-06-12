import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { EmpresaService } from './empresa.service';

@Controller('empresas')
export class EmpresaController {
  constructor(private readonly empresas: EmpresaService) {}

  @Roles(Role.ADMIN, Role.CONTADOR)
  @Post()
  criar(@Body() dto: CreateEmpresaDto) {
    return this.empresas.criar(dto);
  }

  @Get()
  listar() {
    return this.empresas.listar();
  }
}
