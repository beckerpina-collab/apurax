export type EstadoConsulta = 'CONSULTAR_JA' | 'COOLDOWN' | 'BLOQUEADO' | 'ERRO';

export interface ProximaConsulta {
  estado: EstadoConsulta;
  ultNsu: string; // NSU a persistir como cursor
  cooldownSegundos: number;
  motivo: string;
}

const COOLDOWN_PADRAO = 3600; // ~1h após 137/656 (evita consumo indevido / 656)

/**
 * Máquina de estados PURA da Distribuição DFe (testável sem rede).
 * - 138 + ultNSU < maxNSU  → CONSULTAR_JA (encadeia lotes; respeitar teto de 20/h)
 * - 138 + ultNSU == maxNSU → COOLDOWN (sincronizado)
 * - 137 (vazio)            → COOLDOWN (não avança NSU)
 * - 656 (consumo indevido) → BLOQUEADO ~1h (tentar durante o bloqueio reinicia o timer)
 * - demais                 → ERRO (não avança NSU)
 */
export function avaliarResposta(
  cStat: string,
  ultNsuResposta: string,
  maxNsuResposta: string,
  ultNsuAtual: string,
): ProximaConsulta {
  switch (cStat) {
    case '138': {
      const sincronizado = BigInt(ultNsuResposta || '0') >= BigInt(maxNsuResposta || '0');
      return {
        estado: sincronizado ? 'COOLDOWN' : 'CONSULTAR_JA',
        ultNsu: ultNsuResposta,
        cooldownSegundos: sincronizado ? COOLDOWN_PADRAO : 0,
        motivo: sincronizado ? 'Sincronizado (ultNSU == maxNSU).' : 'Há mais lotes — encadear.',
      };
    }
    case '137':
      return {
        estado: 'COOLDOWN',
        ultNsu: ultNsuAtual,
        cooldownSegundos: COOLDOWN_PADRAO,
        motivo: 'Nenhum documento novo — aguardar ~1h.',
      };
    case '656':
      return {
        estado: 'BLOQUEADO',
        ultNsu: ultNsuAtual,
        cooldownSegundos: COOLDOWN_PADRAO,
        motivo: 'Consumo indevido — bloqueio ~1h; não reconsultar durante o bloqueio.',
      };
    default:
      return {
        estado: 'ERRO',
        ultNsu: ultNsuAtual,
        cooldownSegundos: COOLDOWN_PADRAO,
        motivo: `cStat ${cStat} — não avançar NSU; corrigir/retentar com backoff.`,
      };
  }
}
