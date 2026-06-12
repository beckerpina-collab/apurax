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
    return this.sessao(usuario);
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

    // empresa está sob RLS → cria no contexto do tenant recém-criado (forTenant
    // seta o GUC app.current_tenant na transação).
    await this.prisma.forTenant(tenant.id).empresa.create({
      data: {
        tenantId: tenant.id,
        cnpj: dto.cnpj,
        razaoSocial: dto.razaoSocial,
        regimeTributario: dto.regimeTributario,
        uf: dto.uf.toUpperCase(),
      },
    });

    return this.sessao(usuario);
  }

  /** Monta o token + os dados de sessão (mesmo formato do login). */
  private async sessao(usuario: Usuario) {
    const payload = { sub: usuario.id, tenantId: usuario.tenantId, role: usuario.role, email: usuario.email };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET') ?? 'dev-secret',
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
    });
    return {
      accessToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        tenantId: usuario.tenantId,
      },
    };
  }
}
