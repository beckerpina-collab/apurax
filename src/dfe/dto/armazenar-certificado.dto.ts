import { IsBase64, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ArmazenarCertificadoDto {
  @IsUUID()
  empresaId!: string;

  /** Certificado A1 (.pfx/.p12) em base64. A1 real tem <100KB; 3MB é margem segura. */
  @IsBase64()
  @MinLength(100)
  @MaxLength(3_000_000)
  pfxBase64!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  senha!: string;

  /** Data de expiração (ISO) — opcional; usada para bloquear uso após vencer. */
  @IsOptional()
  @IsString()
  notAfter?: string;
}
