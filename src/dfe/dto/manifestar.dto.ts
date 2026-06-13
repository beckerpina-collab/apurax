import { IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class ManifestarDto {
  @IsUUID()
  empresaId!: string;

  @Matches(/^\d{44}$/, { message: 'chave deve ter 44 dígitos.' })
  chave!: string;

  @IsIn(['210210', '210200', '210220', '210240'])
  tpEvento!: '210210' | '210200' | '210220' | '210240';

  // Obrigatório só para 210240 (Operação não Realizada): 15–255 chars.
  @IsOptional()
  @IsString()
  @Length(15, 255)
  xJust?: string;
}
