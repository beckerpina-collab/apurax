import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ImportarNfeDto {
  @IsUUID()
  empresaId!: string;

  /** Conteúdo do XML da NF-e (modelo 55). XML real raramente passa de 100KB; 5MB é teto seguro. */
  @IsString()
  @MinLength(50)
  @MaxLength(5_242_880)
  xml!: string;
}
