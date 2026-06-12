import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ClassificarItemDto {
  @IsString()
  @MaxLength(500)
  descricao!: string;

  @IsString()
  ncm!: string;

  @IsString()
  cfop!: string;

  @IsOptional()
  @IsString()
  cstIcms?: string;

  @IsOptional()
  @IsString()
  cstPis?: string;

  @IsOptional()
  @IsString()
  cstCofins?: string;
}
