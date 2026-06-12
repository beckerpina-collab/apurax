import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';

@Injectable()
export class EmpresaService {
  constructor(private readonly prisma: PrismaService) {}

  criar(dto: CreateEmpresaDto) {
    return this.prisma.scoped.empresa.create({
      data: {
        tenantId: this.prisma.tenantId,
        cnpj: dto.cnpj,
        razaoSocial: dto.razaoSocial,
        regimeTributario: dto.regimeTributario,
        uf: dto.uf.toUpperCase(),
      },
    });
  }

  listar() {
    return this.prisma.scoped.empresa.findMany({ orderBy: { razaoSocial: 'asc' } });
  }
}
