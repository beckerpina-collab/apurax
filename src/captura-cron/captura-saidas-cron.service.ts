import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClsService } from 'nestjs-cls';
import { AdnNfseService } from '../nfse/adn-nfse.service';
import { PrismaService } from '../prisma/prisma.service';
import { SaeService } from '../sae/sae.service';

/**
 * Captura AUTOMÁTICA das notas EMITIDAS (de hora em hora), complementando a captura
 * de ENTRADA (CapturaAgendadaService, no DfeModule):
 *  - NFS-e Nacional (ADN): para toda empresa com certificado A1 ativo;
 *  - NFC-e (SAE da SEFAZ-SP): apenas empresas de UF=SP.
 *
 * Vive em módulo PRÓPRIO (folha) que importa SaeModule + NfseModule — evita o ciclo
 * de DI que existiria se o DfeModule (dono do cron de entrada) importasse esses módulos.
 * Mesma instância única / kill-switch CAPTURA_AUTOMATICA=off do cron de entrada.
 */
@Injectable()
export class CapturaSaidasCronService {
  private readonly logger = new Logger(CapturaSaidasCronService.name);
  private rodando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly config: ConfigService,
    private readonly sae: SaeService,
    private readonly adn: AdnNfseService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async capturar(): Promise<void> {
    if (this.config.get('CAPTURA_AUTOMATICA') === 'off') return;
    if (this.rodando) {
      this.logger.warn('Captura de saídas já em execução — pulando este ciclo.');
      return;
    }
    this.rodando = true;
    try {
      const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
      for (const t of tenants) {
        await this.cls.run(async () => {
          this.cls.set('tenantId', t.id);
          let empresas: { id: string; uf: string }[] = [];
          try {
            const certs = await this.prisma.scoped.certificadoDigital.findMany({
              where: { status: 'ATIVO' },
              distinct: ['empresaId'],
              select: { empresaId: true },
            });
            const ids = certs.map((c) => c.empresaId);
            if (ids.length === 0) return;
            empresas = await this.prisma.scoped.empresa.findMany({
              where: { id: { in: ids } },
              select: { id: true, uf: true },
            });
          } catch (e) {
            this.logger.warn(`Tenant ${t.id}: falha ao listar empresas/certificados — ${(e as Error).message}`);
            return;
          }
          for (const emp of empresas) {
            // NFS-e Nacional (ADN) — qualquer UF
            await this.adn
              .sincronizar(emp.id)
              .catch((e) => this.logger.warn(`ADN NFS-e ${emp.id}: ${(e as Error).message}`));
            // NFC-e via SAE — exclusivo de SP
            if (emp.uf === 'SP') {
              await this.sae
                .capturar(emp.id)
                .catch((e) => this.logger.warn(`SAE NFC-e ${emp.id}: ${(e as Error).message}`));
            }
          }
        });
      }
    } finally {
      this.rodando = false;
    }
  }
}
