/**
 * Fila em memória, SEQUENCIAL, com dedupe e re-tentativas — usada para
 * processar notas do Bling em segundo plano (webhook + importação manual).
 *
 * - Processa UM item por vez; a vazão real é regida pelo RateLimiter nas
 *   chamadas ao Bling (a fila só ordena o trabalho).
 * - Dedupe: o mesmo item (ex.: a mesma NF entregue 2x pelo webhook) não entra
 *   duas vezes enquanto estiver pendente/em processamento.
 * - Falhou? Volta para o FIM da fila e re-tenta até maxTentativas; depois
 *   desiste (onErro é avisado com desistiu=true).
 *
 * Em produção single-instance (Render) é suficiente; a fila vive em memória e
 * se perde num restart — as notas são recuperáveis pela importação manual.
 * Para múltiplas instâncias, trocar por fila externa (Redis/BullMQ).
 */
export interface OpcoesFila {
  maxTentativas?: number;
  atrasoRetryMs?: number;
  onErro?: (chave: string, erro: Error, desistiu: boolean) => void;
}

/** Empresa de ORIGEM de uma nota (só na importação manual; o webhook não sabe).
 *  Permite o processador tentar a conexão dona PRIMEIRO, em vez de varrer todas. */
export interface OrigemNota {
  tenantId: string;
  empresaId: string;
}

interface ItemFila {
  chave: string;
  tentativas: number;
  origem?: OrigemNota;
}

export class FilaSequencial {
  private fila: ItemFila[] = [];
  private pendentes = new Set<string>();
  private rodando = false;

  constructor(
    private readonly processar: (chave: string, origem?: OrigemNota) => Promise<void>,
    private readonly opts: OpcoesFila = {},
  ) {}

  /** Itens aguardando ou em processamento. */
  get tamanho(): number {
    return this.fila.length + (this.rodando ? 1 : 0);
  }

  /** Esvazia a fila (cancela o pendente). O item em execução termina. Retorna quantos removeu. */
  limpar(): number {
    const n = this.fila.length;
    this.fila = [];
    this.pendentes.clear();
    return n;
  }

  /** Enfileira; retorna false se o item já estava pendente (dedupe pela `chave`). */
  enfileirar(chave: string, origem?: OrigemNota): boolean {
    if (this.pendentes.has(chave)) return false;
    this.pendentes.add(chave);
    this.fila.push({ chave, tentativas: 0, origem });
    void this.drenar();
    return true;
  }

  private async drenar(): Promise<void> {
    if (this.rodando) return;
    this.rodando = true;
    try {
      let item: ItemFila | undefined;
      while ((item = this.fila.shift())) {
        try {
          await this.processar(item.chave, item.origem);
          this.pendentes.delete(item.chave);
        } catch (e) {
          item.tentativas += 1;
          const desistiu = item.tentativas >= (this.opts.maxTentativas ?? 3);
          this.opts.onErro?.(item.chave, e as Error, desistiu);
          if (desistiu) {
            this.pendentes.delete(item.chave);
          } else {
            this.fila.push(item); // volta para o fim
            await new Promise((r) => setTimeout(r, this.opts.atrasoRetryMs ?? 5000));
          }
        }
      }
    } finally {
      this.rodando = false;
      if (this.fila.length > 0) void this.drenar(); // chegou item durante o finally
    }
  }
}
