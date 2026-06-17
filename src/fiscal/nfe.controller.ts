import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { parseCompetencia } from '../common/competencia';
import { CurrentUser, UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { DanfeService } from '../danfe/danfe.service';
import { ImportarNfeDto } from './dto/importar-nfe.dto';
import { NfeService } from './nfe.service';

@Controller('fiscal')
export class NfeController {
  constructor(
    private readonly nfe: NfeService,
    private readonly danfe: DanfeService,
  ) {}

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('nfe')
  importar(@Body() dto: ImportarNfeDto, @CurrentUser() user: UsuarioAutenticado) {
    // Classifica pelo tpNF do XML: compra (entrada → motor de crédito) ou venda/NFC-e
    // (saída → débito). Permite subir notas EMITIDAS de qualquer sistema (ex.: VOTI).
    return this.nfe.importarClassificado(dto.empresaId, dto.xml, user.userId);
  }

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Get('documentos')
  listar(@Query('ano') ano?: string, @Query('mes') mes?: string, @Query('tipo') tipo?: string) {
    const t = tipo === 'ENTRADA' || tipo === 'SAIDA' ? tipo : undefined;
    return this.nfe.listarDocumentos({ ...parseCompetencia(ano, mes), tipo: t });
  }

  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Get('documentos/:id')
  detalhe(@Param('id', ParseUUIDPipe) id: string) {
    return this.nfe.detalhe(id);
  }

  /** Download do XML bruto (valor legal) da NF-e/CT-e. */
  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Get('documentos/:id/xml')
  async baixarXml(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { xml, nomeArquivo } = await this.nfe.baixarXml(id);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.send(xml);
  }

  /** Download do PDF auxiliar (DANFE p/ NF-e, DACTE p/ CT-e) gerado localmente a partir do XML. */
  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Get('documentos/:id/pdf')
  async baixarPdf(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { xml, modelo } = await this.nfe.obterXmlEModelo(id);
    const { pdf, nomeArquivo } = await this.danfe.gerar(xml, modelo);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.send(pdf);
  }
}
