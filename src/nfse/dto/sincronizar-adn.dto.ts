import { IsUUID } from 'class-validator';

export class SincronizarAdnDto {
  @IsUUID()
  empresaId!: string;
}
