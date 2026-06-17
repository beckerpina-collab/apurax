import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CapturarNfceDto } from './dto/capturar-nfce.dto';
import { SaeService } from './sae.service';

/** Captura de NFC-e emitidas via SAE da SEFAZ-SP (NFCeListagemChaves + NFCeDownloadXML). */
@Controller('sae')
export class SaeController {
  constructor(private readonly sae: SaeService) {}

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('nfce/sincronizar')
  sincronizar(@Body() dto: CapturarNfceDto) {
    return this.sae.capturar(dto.empresaId, dto.dataInicial, dto.dataFinal);
  }

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Get('nfce/status')
  status(@Query('empresaId') empresaId: string) {
    return this.sae.statusCaptura(empresaId);
  }
}
