import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshDto {
  @IsString()
  @MinLength(10)
  @MaxLength(4096) // JWT real tem <2KB; corta payloads gigantes (DoS no verify)
  refreshToken!: string;
}
