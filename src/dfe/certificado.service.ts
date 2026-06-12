import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoEnvelopeService } from './crypto-envelope.service';

@Injectable()
export class CertificadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoEnvelopeService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Recebe o A1 (.pfx em base64) + senha, cifra (envelope) e persiste. Nada em claro. */
  async armazenar(empresaId: string, pfxBase64: string, senha: string, notAfter?: string) {
    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada para este tenant.');
    }

    const pfx = Buffer.from(pfxBase64, 'base64');
    const env = this.crypto.cifrarCertificado(pfx, senha);
    pfx.fill(0); // zera o material em claro

    const cert = await this.prisma.scoped.certificadoDigital.create({
      data: {
        tenantId: this.prisma.tenantId,
        empresaId: empresa.id,
        tipo: 'A1',
        cnpj: empresa.cnpj,
        notAfter: notAfter ? new Date(notAfter) : null,
        ...env,
      },
    });

    await this.auditoria.registrar({
      tipo: 'CERTIFICADO_ARMAZENADO',
      entidade: 'CertificadoDigital',
      entidadeId: cert.id,
      dados: { cnpj: cert.cnpj, tipo: cert.tipo },
    });

    return { id: cert.id, cnpj: cert.cnpj, tipo: cert.tipo, status: cert.status };
  }

  /** Metadados do certificado ATIVO da empresa (nunca o material cifrado). */
  async atual(empresaId: string) {
    const cert = await this.prisma.scoped.certificadoDigital.findFirst({
      where: { empresaId, status: 'ATIVO' },
      orderBy: { criadoEm: 'desc' },
      select: { id: true, cnpj: true, tipo: true, status: true, notAfter: true, criadoEm: true },
    });
    return cert ?? null;
  }

  /**
   * Descriptografa o certificado ativo da empresa EM MEMÓRIA, para uso imediato.
   * O chamador DEVE zerar o `pfx` após usar (`pfx.fill(0)`). Cada uso é auditado.
   */
  async carregarEmMemoria(empresaId: string): Promise<{ pfx: Buffer; senha: string }> {
    const cert = await this.prisma.scoped.certificadoDigital.findFirst({
      where: { empresaId, status: 'ATIVO' },
      orderBy: { criadoEm: 'desc' },
    });
    if (!cert) {
      throw new NotFoundException('Nenhum certificado A1 ativo para esta empresa.');
    }
    if (cert.notAfter && cert.notAfter.getTime() < Date.now()) {
      throw new NotFoundException('Certificado expirado — renove o A1.');
    }

    await this.auditoria.registrar({
      tipo: 'CERTIFICADO_DESCRIPTOGRAFADO',
      entidade: 'CertificadoDigital',
      entidadeId: cert.id,
      dados: { cnpj: cert.cnpj },
    });

    return this.crypto.decifrarCertificado(cert);
  }
}
