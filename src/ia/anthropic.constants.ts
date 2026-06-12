/** Token de injeção do cliente Anthropic. */
export const ANTHROPIC_CLIENT = 'ANTHROPIC_CLIENT';

/**
 * Modelos Claude usados pelo Apurax (IDs exatos — sem sufixo de data):
 * - RACIOCINIO: claude-opus-4-8 para o agente que raciocina e explica (tool-use).
 * - CLASSIFICACAO: claude-haiku-4-5 para validação/classificação em massa.
 */
export const MODELOS = {
  RACIOCINIO: 'claude-opus-4-8',
  CLASSIFICACAO: 'claude-haiku-4-5',
} as const;
