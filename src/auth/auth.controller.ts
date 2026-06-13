import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegistrarDto } from './dto/registrar.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // 8 tentativas/min por IP — corta brute-force de credenciais.
  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.senha);
  }

  // 4 cadastros/min por IP — evita criação em massa de tenants.
  @Throttle({ default: { ttl: 60_000, limit: 4 } })
  @Public()
  @Post('registrar')
  @HttpCode(201)
  registrar(@Body() dto: RegistrarDto) {
    return this.auth.registrar(dto);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
}
