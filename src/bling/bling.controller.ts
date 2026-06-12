import { Body, Controller, Get, Headers, Post, Query, RawBodyRequest, Req, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { CurrentUser, UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { BlingService } from './bling.service';
import { ConectarBlingDto, PuxarSaidasDto } from './dto/bling.dto';

@Controller('bling')
export class BlingController {
  constructor(private readonly bling: BlingService) {}

  /** Gera a URL de autorização OAuth para o usuário conectar a conta Bling. */
  @Roles(Role.ADMIN, Role.CONTADOR)
  @Get('auth-url')
  authUrl(@Query() q: ConectarBlingDto) {
    return this.bling.authUrl(q.empresaId);
  }

  /** Callback do Bling (redirect do navegador) — PÚBLICO (sem JWT). */
  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const url = await this.bling.handleCallback(code, state, error);
    res.redirect(302, url);
  }

  /** Webhook do Bling (eventos de NF-e) — PÚBLICO; autentica pela assinatura HMAC
   *  do corpo CRU (X-Bling-Signature-256, chave = client_secret). */
  @Public()
  @Post('webhook')
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-bling-signature-256') signature: string) {
    const raw = req.rawBody?.toString('utf8') ?? (req.body ? JSON.stringify(req.body) : '');
    return this.bling.handleWebhook(raw, signature);
  }

  @Get('status')
  status(@Query() q: ConectarBlingDto) {
    return this.bling.status(q.empresaId);
  }

  /** Lista as NF-e de saída do período (base do imposto a pagar). */
  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('saidas')
  saidas(@Body() dto: PuxarSaidasDto) {
    return this.bling.puxarSaidas(dto.empresaId, dto.dataInicial, dto.dataFinal);
  }

  /** Importa o XML das saídas do período como documentos fiscais (alimenta a apuração). */
  @Roles(Role.ADMIN, Role.CONTADOR, Role.CLIENTE)
  @Post('importar-saidas')
  importar(@Body() dto: PuxarSaidasDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.bling.importarSaidas(dto.empresaId, dto.dataInicial, dto.dataFinal, user.userId);
  }
}
