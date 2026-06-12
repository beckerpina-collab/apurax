import { IsString, IsUUID, MinLength } from 'class-validator';

export class ImportarNfseDto {
  @IsUUID()
  empresaId!: string;

  /** XML da NFS-e (padrão nacional). */
  @IsString()
  @MinLength(50)
  xml!: string;
}
