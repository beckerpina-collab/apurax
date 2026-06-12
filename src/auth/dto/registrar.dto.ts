import { RegimeTributario } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

/** Cadastro self-service: cria um TENANT novo + usuário ADMIN + a 1ª empresa. */
export class RegistrarDto {
  // --- Conta / usuário admin ---
  @IsString()
  @Length(2, 120)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  senha!: string;

  /** Nome da conta/escritório. Se omitido, usa a razão social da empresa. */
  @IsOptional()
  @IsString()
  @Length(2, 200)
  nomeConta?: string;

  // --- Primeira empresa (o app é fiscal: já entra com uma empresa) ---
  @Matches(/^\d{14}$/, { message: 'cnpj deve ter 14 dígitos (somente números)' })
  cnpj!: string;

  @IsString()
  @Length(2, 200)
  razaoSocial!: string;

  @IsEnum(RegimeTributario)
  regimeTributario!: RegimeTributario;

  @IsString()
  @Length(2, 2)
  uf!: string;
}
