import { Body, Controller, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { ApuracaoFiscalService } from './apuracao-fiscal.service';
import { ApurarIcmsDto } from './dto/apurar-icms.dto';
import { ApurarSimplesDto } from './dto/apurar-simples.dto';
import { SimplesDasDto } from './dto/simples-das.dto';

@Controller('apuracao')
export class ApuracaoFiscalController {
  constructor(private readonly apuracao: ApuracaoFiscalService) {}

  @Roles(Role.ADMIN, Role.CONTADOR)
  @Post('icms')
  icms(@Body() dto: ApurarIcmsDto) {
    return this.apuracao.apurarIcmsCompetencia(dto.empresaId, dto.ano, dto.mes);
  }

  @Roles(Role.ADMIN, Role.CONTADOR)
  @Post('ipi')
  ipi(@Body() dto: ApurarIcmsDto) {
    return this.apuracao.apurarIpiCompetencia(dto.empresaId, dto.ano, dto.mes);
  }

  @Roles(Role.ADMIN, Role.CONTADOR)
  @Post('pis-cofins')
  pisCofins(@Body() dto: ApurarIcmsDto) {
    return this.apuracao.apurarPisCofinsCompetencia(dto.empresaId, dto.ano, dto.mes);
  }

  @Roles(Role.ADMIN, Role.CONTADOR)
  @Post('iss')
  iss(@Body() dto: ApurarIcmsDto) {
    return this.apuracao.apurarIssCompetencia(dto.empresaId, dto.ano, dto.mes);
  }

  @Roles(Role.ADMIN, Role.CONTADOR)
  @Post('cbs')
  cbs(@Body() dto: ApurarIcmsDto) {
    return this.apuracao.apurarCbsIbsCompetencia(dto.empresaId, 'CBS', dto.ano, dto.mes);
  }

  @Roles(Role.ADMIN, Role.CONTADOR)
  @Post('ibs')
  ibs(@Body() dto: ApurarIcmsDto) {
    return this.apuracao.apurarCbsIbsCompetencia(dto.empresaId, 'IBS', dto.ano, dto.mes);
  }

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('simples')
  simples(@Body() dto: ApurarSimplesDto) {
    return this.apuracao.apurarSimplesCompetencia(dto.empresaId, dto.ano, dto.mes, {
      anexo: dto.anexo,
      folha12: dto.folha12,
      receita12: dto.receita12,
    });
  }

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('simples-das')
  das(@Body() dto: SimplesDasDto) {
    const fatorR =
      dto.folha12 !== undefined && dto.receita12 !== undefined
        ? { folha12: dto.folha12, receita12: dto.receita12 }
        : undefined;
    return this.apuracao.calcularDasSimples({ anexo: dto.anexo, rbt12: dto.rbt12, receitaMes: dto.receitaMes, fatorR });
  }
}
