import { IsString, MinLength } from 'class-validator';

export class GlosarDto {
  @IsString()
  @MinLength(3)
  motivo!: string;
}
