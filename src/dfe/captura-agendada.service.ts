import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { DistribuicaoService } from './distribuicao.service';

/**
 * Captura AUTOMÁTICA da SEFAZ (Distribuição DFe), de hora em hora:
 *  - varre todas as empresas (de todos os tenants) com certificado A1 ativo;
 *  - sincroniza NF-e e CT-e (respeitando o cooldown/NSU já embutido em sincronizar);
 *  - manifesta CIÊNCIA (210210) nas NF-e que vieram como RESUMO — isso libera o
 *    XML completo na sincronização seguinte (CT-e já vem completo).
 *
 * Ciência é o evento de menor compromisso fiscal e o usado em captura automática.
 * Roda numa instância única (Render starter). Kill-switch: CAPTURA_AUTOMATICA=off.
 */
@Injectable()
export class CapturaAgendadaService {
  private readonly logger = new Logger(CapturaAgendadaService.name);
  private rodando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly distribuicao: DistribuicaoService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async capturar(): Promise<void> {
    if (this.config.get('CAPTURA_AUTOMATICA') === 'off') return;
    if (this.rodando) {
      this.logger.warn('Captura automática já em execução — pulando este ciclo.');
      return;
    }
    this.rodando = true;
    try {
      const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
      for (const t of tenants) {
        await this.cls.run(async () => {
          this.cls.set('tenantId', t.id);
          let empresas: { empresaId: string }[] = [];
          try {
            empresas = await this.prisma.scoped.certificadoDigital.findMany({
              where: { status: 'ATIVO' },
              distinct: ['empresaId'],
              select: { empresaId: true },
            });
          } catch (e) {
            this.logger.warn(`Tenant ${t.id}: falha ao listar certificados — ${(e as Error).message}`);
            return;
          }
          for (const { empresaId } of empresas) {
            await this.capturarEmpresa(empresaId).catch((e) =>
              this.logger.warn(`Captura automática ${empresaId}: ${(e as Error).message}`),
            );
          }
        });
      }
    } finally {
      this.rodando = false;
    }
  }

  private async capturarEmpresa(empresaId: string): Promise<void> {
    // NF-e: sincroniza e manifesta Ciência nos resumos (libera o XML completo).
    const rNfe = (await this.distribuicao.sincronizar(empresaId, 'NFE')) as {
      documentosNovos?: number;
      resumos?: number;
      chavesResumoNfe?: string[];
    };
    const chaves = rNfe.chavesResumoNfe ?? [];
    let manifestados = 0;
    for (const chave of chaves) {
      try {
        const m = await this.distribuicao.manifestar(empresaId, chave, '210210');
        if (m.ok) manifestados += 1;
        else this.logger.warn(`Manifestação ${chave}: cStat ${m.cStat} — ${m.xMotivo}`);
      } catch (e) {
        this.logger.warn(`Manifestação ${chave}: ${(e as Error).message}`);
      }
    }
    // CT-e: vem completo direto para o tomador (sem manifestação).
    await this.distribuicao
      .sincronizar(empresaId, 'CTE')
      .catch((e) => this.logger.warn(`Sync CT-e ${empresaId}: ${(e as Error).message}`));

    this.logger.log(
      `Captura automática ${empresaId}: NF-e novos=${rNfe.documentosNovos ?? 0} resumos=${rNfe.resumos ?? 0} manifestados=${manifestados}/${chaves.length}.`,
    );
  }
}
