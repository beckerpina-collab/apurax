import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class ApurarIcmsDto {
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
}
