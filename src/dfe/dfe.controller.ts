import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CertificadoService } from './certificado.service';
import { DistribuicaoService } from './distribuicao.service';
import { ArmazenarCertificadoDto } from './dto/armazenar-certificado.dto';
import { SincronizarDto } from './dto/sincronizar.dto';

@Controller()
export class DfeController {
  constructor(
    private readonly certificados: CertificadoService,
    private readonly distribuicao: DistribuicaoService,
  ) {}

  @Roles(Role.ADMIN, Role.CONTADOR)
  @Post('certificados')
  armazenar(@Body() dto: ArmazenarCertificadoDto) {
    return this.certificados.armazenar(dto.empresaId, dto.pfxBase64, dto.senha, dto.notAfter);
  }

  @Roles(Role.ADMIN, Role.CONTADOR)
  @Post('distribuicao/sincronizar')
  sincronizar(@Body() dto: SincronizarDto) {
    return this.distribuicao.sincronizar(dto.empresaId, dto.modelo ?? 'NFE');
  }

  @Get('distribuicao/cursores')
  cursores() {
    return this.distribuicao.listarCursores();
  }
}
