import { Body, Controller, Get, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator';
import { CertificadoService } from './certificado.service';
import { DistribuicaoService } from './distribuicao.service';
import { ArmazenarCertificadoDto } from './dto/armazenar-certificado.dto';
import { ManifestarDto } from './dto/manifestar.dto';
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

  /** Metadados do certificado ATIVO da empresa (para a tela de Configuração). */
  @Get('certificados/atual')
  atual(@Query('empresaId', ParseUUIDPipe) empresaId: string) {
    return this.certificados.atual(empresaId);
  }

  @Roles(Role.ADMIN, Role.CONTADOR)
  @Post('distribuicao/sincronizar')
  sincronizar(@Body() dto: SincronizarDto) {
    return this.distribuicao.sincronizar(dto.empresaId, dto.modelo ?? 'NFE');
  }

  @Roles(Role.ADMIN, Role.CONTADOR)
  @Get('distribuicao/cursores')
  cursores() {
    return this.distribuicao.listarCursores();
  }

  /** Manifestação do destinatário (NF-e): Ciência/Confirmação/Desconhecimento/Não realizada. */
  @Throttle({ default: { ttl: 60_000, limit: 30 } }) // evita spam de eventos à SEFAZ
  @Roles(Role.ADMIN, Role.CONTADOR)
  @Post('distribuicao/manifestar')
  manifestar(@Body() dto: ManifestarDto) {
    return this.distribuicao.manifestar(dto.empresaId, dto.chave, dto.tpEvento, dto.xJust);
  }
}
