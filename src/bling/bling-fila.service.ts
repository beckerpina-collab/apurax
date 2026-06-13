import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { FilaSequencial } from './fila-sequencial';

const FILA = 'bling-notas';

/**
 * Fila de processamento das notas do Bling (webhook + importação manual).
 *
 * - Com REDIS_URL: BullMQ no Redis — sobrevive a restarts/redeploys do app,
 *   re-tentativas com backoff e DEDUPE por jobId (a mesma NF entregue 2x pelo
 *   webhook vira 1 job). O worker processa 1 nota por vez com limitador
 *   (~2 notas/s) — somado ao blingLimiter global, nunca estoura o Bling.
 * - Sem REDIS_URL (dev local): cai na FilaSequencial em memória.
 *
 * O processador é registrado pelo BlingService no boot (evita ciclo de DI).
 */
@Injectable()
export class BlingFilaService implements OnModuleDestroy {
  private readonly logger = new Logger(BlingFilaService.name);
  private filaMem?: FilaSequencial;
  private queue?: Queue;
  private worker?: Worker;
  private processador?: (invoiceId: string) => Promise<void>;

  constructor(private readonly config: ConfigService) {}

  /** Registra quem processa cada nota e liga o backend (Redis ou memória). */
  definirProcessador(fn: (invoiceId: string) => Promise<void>): void {
    this.processador = fn;
    const url = this.config.get<string>('REDIS_URL');

    if (url) {
      // BullMQ aceita { url } e exige maxRetriesPerRequest: null nas conexões.
      const conexao = { url, maxRetriesPerRequest: null };
      this.queue = new Queue(FILA, { connection: conexao });
      this.worker = new Worker(
        FILA,
        async (job) => {
          await this.processador?.(String(job.data.invoiceId));
        },
        {
          connection: conexao,
          concurrency: 1,
          // 1 job a cada 500ms (~2/s) — folga sob o limite de 3 req/s do Bling.
          limiter: { max: 1, duration: 500 },
        },
      );
      this.worker.on('failed', (job, err) => {
        const restam = job ? (job.opts.attempts ?? 1) - job.attemptsMade : 0;
        this.logger.warn(
          `fila NF ${job?.data?.invoiceId}: ${err.message}${restam > 0 ? ` — vai re-tentar (${restam} restante(s))` : ' — desistiu'}`,
        );
      });
      this.worker.on('error', (err) => this.logger.error(`worker da fila: ${err.message}`));
      this.logger.log('Fila do Bling no Redis (BullMQ) — sobrevive a restarts.');
    } else {
      this.filaMem = new FilaSequencial(fn, {
        maxTentativas: 4,
        atrasoRetryMs: 5000,
        onErro: (id, e, desistiu) =>
          this.logger.warn(`fila NF ${id}: ${e.message}${desistiu ? ' — desistiu' : ' — vai re-tentar'}`),
      });
      this.logger.warn('REDIS_URL ausente — fila do Bling em MEMÓRIA (se o app reiniciar, reimporte o período).');
    }
  }

  /** Enfileira uma NF; retorna false se ela já está pendente (dedupe). */
  async enfileirar(invoiceId: string): Promise<boolean> {
    if (this.queue) {
      const jobId = `nf-${invoiceId}`;
      const existente = await this.queue.getJob(jobId);
      if (existente) return false; // ainda pendente/processando → dedupe
      await this.queue.add(
        'nf',
        { invoiceId },
        {
          jobId,
          attempts: 4,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true, // libera o jobId p/ futuras atualizações da mesma NF
          removeOnFail: true,
        },
      );
      return true;
    }
    return this.filaMem?.enfileirar(invoiceId) ?? false;
  }

  /**
   * Esvazia a fila (parar importação). No BullMQ remove waiting+delayed (drain);
   * o job ativo no momento termina (concurrency 1 → no máximo +1 nota). Retorna
   * quantas notas estavam pendentes antes de limpar.
   */
  async limpar(): Promise<number> {
    if (this.queue) {
      const antes = await this.pendentes();
      await this.queue.drain(true).catch((e) => this.logger.warn(`drain da fila: ${(e as Error).message}`));
      return antes;
    }
    return this.filaMem?.limpar() ?? 0;
  }

  /** Quantas notas aguardam ou estão em processamento. */
  async pendentes(): Promise<number> {
    if (this.queue) {
      const c = await this.queue.getJobCounts('waiting', 'active', 'delayed', 'paused');
      return (c.waiting ?? 0) + (c.active ?? 0) + (c.delayed ?? 0) + (c.paused ?? 0);
    }
    return this.filaMem?.tamanho ?? 0;
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
  }
}
