import { IsString, IsUUID, Matches } from 'class-validator';

export class ConectarBlingDto {
  @IsUUID()
  empresaId!: string;
}

export class PuxarSaidasDto {
  @IsUUID()
  empresaId!: string;

  /** Data inicial (YYYY-MM-DD). */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataInicial deve ser YYYY-MM-DD' })
  dataInicial!: string;

  /** Data final (YYYY-MM-DD). */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataFinal deve ser YYYY-MM-DD' })
  dataFinal!: string;
}
