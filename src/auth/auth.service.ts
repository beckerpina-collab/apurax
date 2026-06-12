import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Usuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrarDto } from './dto/registrar.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, senha: string) {
    // 'usuario' fica fora da RLS: lookup de identidade antes de haver tenant.
    const usuario = await this.prisma.usuario.findFirst({ where: { email, ativo: true } });
    if (!usuario || !(await bcrypt.compare(senha, usuario.senhaHash))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.gerarSessao(usuario);
  }

  /**
   * Cadastro self-service (público). Cria um TENANT novo, o usuário ADMIN e a
   * primeira empresa, e já devolve a sessão (login automático). E-mail é único
   * globalmente (o login resolve o usuário só pelo e-mail).
   */
  async registrar(dto: RegistrarDto) {
    const jaExiste = await this.prisma.usuario.findFirst({ where: { email: dto.email } });
    if (jaExiste) {
      throw new ConflictException('E-mail já cadastrado. Faça login ou use outro e-mail.');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const tenant = await this.prisma.tenant.create({
      data: { nome: dto.nomeConta?.trim() || dto.razaoSocial },
    });

    const usuario = await this.prisma.usuario.create({
      data: { tenantId: tenant.id, email: dto.email, senhaHash, nome: dto.nome, role: 'ADMIN' },
    });

    // empresa está sob RLS → cria no contexto do tenant recém-criado.
    await this.prisma.forTenant(tenant.id).empresa.create({
      data: {
        tenantId: tenant.id,
        cnpj: dto.cnpj,
        razaoSocial: dto.razaoSocial,
        regimeTributario: dto.regimeTributario,
        uf: dto.uf.toUpperCase(),
      },
    });

    return this.gerarSessao(usuario);
  }

  /**
   * Troca um refresh token válido por uma nova sessão (access + refresh novos —
   * rotação). Usado pelo front quando o access expira, de forma transparente.
   */
  async refresh(refreshToken: string) {
    let payload: { sub?: string; type?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: this.refreshSecret() });
    } catch {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }
    if (payload.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Token de atualização inválido.');
    }
    const usuario = await this.prisma.usuario.findFirst({ where: { id: payload.sub, ativo: true } });
    if (!usuario) {
      throw new UnauthorizedException('Usuário não encontrado ou inativo.');
    }
    return this.gerarSessao(usuario);
  }

  /** Monta access (curto) + refresh (longo) + dados de sessão. */
  private async gerarSessao(usuario: Usuario) {
    const accessToken = await this.jwt.signAsync(
      { sub: usuario.id, tenantId: usuario.tenantId, role: usuario.role, email: usuario.email },
      {
        secret: this.config.get<string>('JWT_SECRET') ?? 'dev-secret',
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: usuario.id, type: 'refresh' },
      { secret: this.refreshSecret(), expiresIn: this.config.get<string>('JWT_REFRESH_TTL') ?? '30d' },
    );
    return {
      accessToken,
      refreshToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        tenantId: usuario.tenantId,
      },
    };
  }

  /** Segredo do refresh: usa JWT_REFRESH_SECRET se houver; senão deriva do JWT_SECRET. */
  private refreshSecret(): string {
    return (
      this.config.get<string>('JWT_REFRESH_SECRET') ??
      `${this.config.get<string>('JWT_SECRET') ?? 'dev-secret'}-refresh`
    );
  }
}
