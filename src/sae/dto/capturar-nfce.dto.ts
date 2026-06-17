import { IsOptional, IsUUID, Matches } from 'class-validator';

export class CapturarNfceDto {
  @IsUUID()
  empresaId!: string;

  /** Data inicial AAAA-MM-DD (opcional; default = 30 dias atrás). Janela máx. 100 dias. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataInicial deve ser AAAA-MM-DD.' })
  dataInicial?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataFinal deve ser AAAA-MM-DD.' })
  dataFinal?: string;
}
