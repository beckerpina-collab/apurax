import { RegimeTributario } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ContextoItem } from '../agente.service';

export class PerguntarDto {
  @IsString()
  @MaxLength(2000)
  pergunta!: string;

  @IsOptional()
  @IsEnum(RegimeTributario)
  regime?: RegimeTributario;

  @IsOptional()
  @IsObject()
  item?: ContextoItem;
}
