import { IsBase64, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class ArmazenarCertificadoDto {
  @IsUUID()
  empresaId!: string;

  /** Certificado A1 (.pfx/.p12) em base64. */
  @IsBase64()
  @MinLength(100)
  pfxBase64!: string;

  @IsString()
  @MinLength(1)
  senha!: string;

  /** Data de expiração (ISO) — opcional; usada para bloquear uso após vencer. */
  @IsOptional()
  @IsString()
  notAfter?: string;
}
