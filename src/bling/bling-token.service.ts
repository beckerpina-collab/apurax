import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BlingConexao } from '@prisma/client';
import { CryptoEnvelopeService, type SegredoCifrado } from '../dfe/crypto-envelope.service';
import { PrismaService } from '../prisma/prisma.service';
import { type BlingTokenSet, precisaRenovar, refreshBlingToken } from './bling.client';

interface TokensClaro {
  access_token: string;
  refresh_token: string;
  scope?: string;
}

export interface BlingCreds {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Sinaliza "precisa reconectar o Bling" (refresh inválido/expirado/revogado). */
export class BlingReconectarError extends BadRequestException {}

/**
 * Custódia dos tokens do Bling. A tabela bling_conexao fica FORA da RLS (o
 * webhook público varre conexões p/ achar o dono da NF) — por isso aqui usamos
 * o cliente BASE do Prisma com filtro EXPLÍCITO por (tenantId, empresaId).
 */
@Injectable()
export class BlingTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoEnvelopeService,
    private readonly config: ConfigService,
  ) {}

  /** Credenciais do app Bling (env). */
  creds(): BlingCreds {
    const clientId = this.config.get<string>('BLING_CLIENT_ID');
    const clientSecret = this.config.get<string>('BLING_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('BLING_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new InternalServerErrorException(
        'Servidor sem credenciais do Bling (BLING_CLIENT_ID / BLING_CLIENT_SECRET / BLING_REDIRECT_URI).',
      );
    }
    return { clientId, clientSecret, redirectUri };
  }

  clientSecret(): string | undefined {
    return this.config.get<string>('BLING_CLIENT_SECRET');
  }

  configurado(): boolean {
    return !!(
      this.config.get('BLING_CLIENT_ID') &&
      this.config.get('BLING_CLIENT_SECRET') &&
      this.config.get('BLING_REDIRECT_URI')
    );
  }

  /** Persiste (cifrado) o conjunto de tokens da empresa. */
  async salvar(tenantId: string, empresaId: string, tok: BlingTokenSet): Promise<void> {
    const claro: TokensClaro = {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      scope: tok.scope,
    };
    const env = this.crypto.cifrarSegredo(JSON.stringify(claro));
    const expiresAt = new Date(Date.now() + (tok.expires_in ?? 21600) * 1000);
    await this.prisma.blingConexao.upsert({
      where: { tenantId_empresaId: { tenantId, empresaId } },
      create: { tenantId, empresaId, expiresAt, scope: tok.scope ?? null, status: 'ativo', ...env },
      update: { expiresAt, scope: tok.scope ?? null, status: 'ativo', ...env },
    });
  }

  /** Garante um access_token válido (renova com folga de 5 min; o refresh
   *  rotaciona → persiste o novo). Lança BlingReconectarError se não conectado. */
  async accessToken(tenantId: string, empresaId: string): Promise<string> {
    const conexao = await this.prisma.blingConexao.findUnique({
      where: { tenantId_empresaId: { tenantId, empresaId } },
    });
    if (!conexao) {
      throw new BlingReconectarError('Empresa não conectada ao Bling. Conecte em Configuração.');
    }
    return this.accessTokenDaConexao(conexao);
  }

  /** Igual, mas a partir de uma conexão já carregada (usado no webhook). */
  async accessTokenDaConexao(conexao: BlingConexao): Promise<string> {
    const tokens = JSON.parse(this.crypto.decifrarSegredo(conexao as SegredoCifrado)) as TokensClaro;
    if (!precisaRenovar(conexao.expiresAt.getTime(), Date.now())) {
      return tokens.access_token;
    }
    const { clientId, clientSecret } = this.creds();
    let novo: BlingTokenSet;
    try {
      novo = await refreshBlingToken({ clientId, clientSecret, refreshToken: tokens.refresh_token });
    } catch (e) {
      await this.marcarExpirado(conexao.tenantId, conexao.empresaId).catch(() => undefined);
      throw new BlingReconectarError(`Falha ao renovar o token do Bling — reconecte. (${(e as Error).message})`);
    }
    await this.salvar(conexao.tenantId, conexao.empresaId, novo);
    return novo.access_token;
  }

  async statusConexao(tenantId: string, empresaId: string) {
    const conexao = await this.prisma.blingConexao.findUnique({
      where: { tenantId_empresaId: { tenantId, empresaId } },
    });
    if (!conexao) return { conectado: false, expiraEm: null as string | null, escopos: [] as string[] };
    return {
      conectado: conexao.status === 'ativo',
      expiraEm: conexao.expiresAt.toISOString(),
      escopos: conexao.scope ? conexao.scope.split(/\s+/).filter(Boolean) : [],
      ultimoSyncEm: conexao.ultimoSyncEm?.toISOString() ?? null,
    };
  }

  /** Conexões ativas (todas as tenants) — usado pela resolução do webhook. */
  listarAtivas(): Promise<BlingConexao[]> {
    return this.prisma.blingConexao.findMany({ where: { status: 'ativo' }, orderBy: { criadoEm: 'asc' }, take: 50 });
  }

  marcarSync(tenantId: string, empresaId: string): Promise<unknown> {
    return this.prisma.blingConexao.updateMany({
      where: { tenantId, empresaId },
      data: { ultimoSyncEm: new Date() },
    });
  }

  private marcarExpirado(tenantId: string, empresaId: string): Promise<unknown> {
    return this.prisma.blingConexao.updateMany({ where: { tenantId, empresaId }, data: { status: 'expirado' } });
  }
}
