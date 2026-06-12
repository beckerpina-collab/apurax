/**
 * Limitador de taxa GLOBAL para a API do Bling (limite oficial ~3 req/s).
 * Serializa as chamadas garantindo um intervalo mínimo entre elas. É um
 * singleton de processo compartilhado por webhook, importação manual e
 * renovação de token — assim a soma nunca estoura o limite.
 *
 * Vale para 1 instância (Render). Se um dia houver múltiplas instâncias,
 * trocar por um limitador distribuído (Redis).
 */
export class RateLimiter {
  private proximoSlot = 0;

  constructor(private readonly intervaloMs: number) {}

  /** Reserva o próximo slot e espera até ele chegar. */
  async aguardar(): Promise<void> {
    const agora = Date.now();
    const slot = Math.max(agora, this.proximoSlot);
    this.proximoSlot = slot + this.intervaloMs;
    const espera = slot - agora;
    if (espera > 0) {
      await new Promise((r) => setTimeout(r, espera));
    }
  }
}
