import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ImportarCteDto {
  @IsUUID()
  empresaId!: string;

  /** Conteúdo do XML do CT-e (modelo 57). */
  @IsString()
  @MinLength(50)
  @MaxLength(5_242_880)
  xml!: string;
}
