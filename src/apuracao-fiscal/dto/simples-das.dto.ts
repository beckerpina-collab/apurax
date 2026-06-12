import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class SimplesDasDto {
  /** Anexo I–V. Opcional se informar folha12+receita12 (Fator R decide III/V). */
  @IsOptional()
  @IsIn(['I', 'II', 'III', 'IV', 'V'])
  anexo?: 'I' | 'II' | 'III' | 'IV' | 'V';

  @IsNumber()
  @Min(0)
  rbt12!: number;

  @IsNumber()
  @Min(0)
  receitaMes!: number;

  // Fator R (opcional): folha e receita dos últimos 12 meses → escolhe Anexo III ou V.
  @IsOptional()
  @IsNumber()
  @Min(0)
  folha12?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  receita12?: number;
}
