import { IsIn, IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ApurarSimplesDto {
  @IsUUID()
  empresaId!: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  ano!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;

  /** Anexo I–V. Default I (comércio). Ignorado se folha12+receita12 (Fator R decide III/V). */
  @IsOptional()
  @IsIn(['I', 'II', 'III', 'IV', 'V'])
  anexo?: 'I' | 'II' | 'III' | 'IV' | 'V';

  // Fator R (opcional): folha e receita dos 12 meses → escolhe Anexo III ou V.
  @IsOptional()
  @IsNumber()
  @Min(0)
  folha12?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  receita12?: number;
}
