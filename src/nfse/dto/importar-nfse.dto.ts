import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ImportarNfseDto {
  @IsUUID()
  empresaId!: string;

  /** XML da NFS-e (padrão nacional). */
  @IsString()
  @MinLength(50)
  @MaxLength(5_242_880)
  xml!: string;
}
