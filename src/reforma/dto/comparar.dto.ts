import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CompararDto {
  @IsUUID()
  empresaId!: string;

  /** XML da NF-e de entrada (pode conter, ou não, o grupo IBSCBS de 2026). */
  @IsString()
  @MinLength(50)
  xml!: string;

  /** Finalidade do item (afeta o crédito legado de ICMS e a vedação do art. 57). */
  @IsOptional()
  @IsIn(['REVENDA', 'INDUSTRIALIZACAO', 'USO_CONSUMO', 'USO_PESSOAL', 'ATIVO'])
  finalidade?: 'REVENDA' | 'INDUSTRIALIZACAO' | 'USO_CONSUMO' | 'USO_PESSOAL' | 'ATIVO';
}
