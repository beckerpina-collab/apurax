import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class SincronizarDto {
  @IsUUID()
  empresaId!: string;

  @IsOptional()
  @IsIn(['NFE', 'CTE'])
  modelo?: 'NFE' | 'CTE';
}
