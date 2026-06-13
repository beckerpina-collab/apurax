import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ImportarSpedDto {
  @IsUUID()
  empresaId!: string;

  /** Conteúdo do arquivo SPED EFD-Contribuições (texto pipe-delimitado). */
  @IsString()
  @MinLength(50)
  @MaxLength(10_485_760)
  conteudo!: string;
}
