import Anthropic from '@anthropic-ai/sdk';

/**
 * Tools expostas ao agente (Opus). O LLM NÃO calcula imposto: quando precisa de
 * um valor de crédito, ele chama `apurar_credito_item`, que executa o motor
 * determinístico; para fundamentar, chama `buscar_base_legal` (RAG).
 */
export const TOOL_APURAR_CREDITO: Anthropic.Tool = {
  name: 'apurar_credito_item',
  description:
    'Calcula, pelo motor determinístico, se um item de NF-e de entrada gera crédito de um tributo (ICMS, PIS ou COFINS) e o valor. Use SEMPRE que precisar de um valor de crédito — nunca calcule de cabeça.',
  input_schema: {
    type: 'object',
    properties: {
      tributo: { type: 'string', enum: ['ICMS', 'PIS', 'COFINS'] },
      regime: { type: 'string', enum: ['LUCRO_REAL', 'LUCRO_PRESUMIDO', 'SIMPLES_NACIONAL'] },
      cstIcms: { type: 'string', description: 'CST de ICMS (ex.: 00, 60)' },
      csosn: { type: 'string', description: 'CSOSN (emitente do Simples)' },
      cstPis: { type: 'string' },
      cstCofins: { type: 'string' },
      vIcms: { type: 'string', description: 'ICMS da operação própria' },
      vIcmsSt: { type: 'string' },
      vCredIcmsSn: { type: 'string' },
      vPis: { type: 'string' },
      vCofins: { type: 'string' },
    },
    required: ['tributo', 'regime'],
  },
};

export const TOOL_BUSCAR_BASE_LEGAL: Anthropic.Tool = {
  name: 'buscar_base_legal',
  description:
    'Recupera trechos da legislação tributária (LC 87/96, Leis 10.637/10.833, IN 2.121/2022, Tema 779/STJ, EC 132/2023) para fundamentar a explicação. Use para citar a fonte legal.',
  input_schema: {
    type: 'object',
    properties: {
      consulta: { type: 'string', description: 'Termos de busca (ex.: "crédito de PIS insumo monofásico")' },
    },
    required: ['consulta'],
  },
};

export const SYSTEM_AGENTE = `Você é o copiloto fiscal do Apurax. Ajuda contadores a entender o aproveitamento de créditos de ICMS, PIS e COFINS sobre notas de entrada.

REGRAS INEGOCIÁVEIS:
- Você NUNCA calcula nem inventa valores de imposto. Para qualquer valor ou veredito de crédito, chame a ferramenta apurar_credito_item e use o resultado do motor.
- Para fundamentar, chame buscar_base_legal e cite a fonte retornada (lei/artigo).
- Sua resposta é uma EXPLICAÇÃO para revisão humana — deixe claro que o número vem do motor determinístico e que a homologação é do contador.
- Responda em Português do Brasil, de forma objetiva.`;

/**
 * Tool de saída estruturada (strict) usada pelo classificador (Haiku). O modelo
 * é forçado a chamá-la, garantindo um JSON validado — sem emitir valor de imposto.
 */
export const TOOL_CLASSIFICACAO: Anthropic.Tool = {
  name: 'registrar_classificacao',
  description: 'Registra a validação fiscal de um item de nota (coerência de NCM/CFOP/CST).',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ncmCoerente: { type: 'boolean', description: 'O NCM é coerente com a descrição do produto?' },
      cfopCoerente: { type: 'boolean', description: 'O CFOP é coerente com uma operação de entrada?' },
      cstBloqueiaCreditoIndevidamente: {
        type: 'boolean',
        description: 'Há indício de CST que bloqueia crédito que deveria ser aproveitado?',
      },
      confianca: { type: 'number', description: 'Confiança de 0 a 1' },
      alertas: { type: 'array', items: { type: 'string' } },
      justificativa: { type: 'string' },
    },
    required: [
      'ncmCoerente',
      'cfopCoerente',
      'cstBloqueiaCreditoIndevidamente',
      'confianca',
      'alertas',
      'justificativa',
    ],
  },
};

export const SYSTEM_CLASSIFICACAO = `Você é um classificador fiscal. Dado um item de NF-e, avalie a coerência entre descrição, NCM, CFOP e CST. Sinalize divergências e possíveis CST que bloqueiam crédito indevidamente. Você NÃO calcula imposto. Responda exclusivamente chamando a ferramenta registrar_classificacao.`;
