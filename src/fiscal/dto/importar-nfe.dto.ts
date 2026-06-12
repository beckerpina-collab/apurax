import { IsString, IsUUID, MinLength } from 'class-validator';

export class ImportarNfeDto {
  @IsUUID()
  empresaId!: string;

  /** Conteúdo do XML da NF-e (modelo 55). Upload multipart/ZIP fica para a próxima etapa. */
  @IsString()
  @MinLength(50)
  xml!: string;
}
