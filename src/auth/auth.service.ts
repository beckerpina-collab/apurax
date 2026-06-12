import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, senha: string) {
    // 'usuario' fica fora da RLS: lookup de identidade antes de haver tenant.
    // Em produção, multi-tenant real escopa o login por subdomínio/tenant slug.
    const usuario = await this.prisma.usuario.findFirst({
      where: { email, ativo: true },
    });
    if (!usuario || !(await bcrypt.compare(senha, usuario.senhaHash))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = {
      sub: usuario.id,
      tenantId: usuario.tenantId,
      role: usuario.role,
      email: usuario.email,
    };
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
