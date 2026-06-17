import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdnNfseService } from './adn-nfse.service';
import { ImportarNfseDto } from './dto/importar-nfse.dto';
import { SincronizarAdnDto } from './dto/sincronizar-adn.dto';
import { NfseService } from './nfse.service';

@Controller('nfse')
export class NfseController {
  constructor(
    private readonly nfse: NfseService,
    private readonly adn: AdnNfseService,
  ) {}

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('import')
  importar(@Body() dto: ImportarNfseDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.nfse.importar(dto.empresaId, dto.xml, user.userId);
  }

  /** Captura das NFS-e emitidas pelo ADN (Sistema Nacional NFS-e) — por NSU. */
  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('adn/sincronizar')
  sincronizarAdn(@Body() dto: SincronizarAdnDto) {
    return this.adn.sincronizar(dto.empresaId);
  }

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Get()
  listar() {
    return this.nfse.listar();
  }
}
