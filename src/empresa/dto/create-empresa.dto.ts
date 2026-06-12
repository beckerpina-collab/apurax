import { RegimeTributario } from '@prisma/client';
import { IsEnum, IsString, Length, Matches } from 'class-validator';

export class CreateEmpresaDto {
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
