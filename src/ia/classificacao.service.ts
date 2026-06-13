import { Inject, Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_CLIENT, MODELOS } from './anthropic.constants';
import { SYSTEM_CLASSIFICACAO, TOOL_CLASSIFICACAO } from './ia.prompts';

export interface ItemParaClassificar {
  descricao: string;
  ncm: string;
  cfop: string;
  cstIcms?: string;
  cstPis?: string;
  cstCofins?: string;
}

/** Saída crua do tool da IA. */
interface SaidaTool {
  ncmCoerente: boolean;
  cfopCoerente: boolean;
  ncmSugerido: string;
  cfopSugerido: string;
  cstBloqueiaCreditoIndevidamente: boolean;
  confianca: number;
  alertas: string[];
  justificativa: string;
}

/** Contrato consumido pela tela Validador de NCM. */
export interface ResultadoValidacao {
  veredito: 'OK' | 'ATENCAO' | 'DIVERGENCIA';
  confianca: number;
  ncmInformado: string;
  ncmSugerido: string;
  cfopInformado: string;
  cfopSugerido: string;
  alertas: string[];
  observacao: string;
  origemIA: true;
}

/**
 * Validação/classificação de item por IA (claude-haiku-4-5), com saída estruturada
 * forçada (strict tool use). Resultado é SUGESTÃO revisável (origemIA), nunca um
 * valor fiscal — o número continua sendo do motor determinístico.
 */
@Injectable()
export class ClassificacaoService {
  constructor(@Inject(ANTHROPIC_CLIENT) private readonly anthropic: Anthropic) {}

  async classificar(item: ItemParaClassificar): Promise<ResultadoValidacao> {
    const prompt =
      `Item da NF-e de entrada:\n` +
      `- Descrição: ${item.descricao}\n` +
      `- NCM: ${item.ncm}\n` +
      `- CFOP: ${item.cfop}\n` +
      `- CST ICMS: ${item.cstIcms ?? '-'}\n` +
      `- CST PIS: ${item.cstPis ?? '-'}\n` +
      `- CST COFINS: ${item.cstCofins ?? '-'}\n\n` +
      `Valide a coerência e registre via a ferramenta.`;

    const resposta = await this.anthropic.messages.create({
      model: MODELOS.CLASSIFICACAO,
      max_tokens: 1024,
      system: SYSTEM_CLASSIFICACAO,
      tools: [TOOL_CLASSIFICACAO],
      tool_choice: { type: 'tool', name: TOOL_CLASSIFICACAO.name },
      messages: [{ role: 'user', content: prompt }],
    });

    const bloco = resposta.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!bloco) {
      throw new Error('Classificador não retornou a ferramenta esperada.');
    }
    const d = bloco.input as SaidaTool;
    const veredito: ResultadoValidacao['veredito'] =
      !d.ncmCoerente || !d.cfopCoerente || d.cstBloqueiaCreditoIndevidamente
        ? 'DIVERGENCIA'
        : (d.alertas?.length ?? 0) > 0
          ? 'ATENCAO'
          : 'OK';
    return {
      veredito,
      confianca: d.confianca,
      ncmInformado: item.ncm,
      ncmSugerido: d.ncmSugerido || item.ncm,
      cfopInformado: item.cfop,
      cfopSugerido: d.cfopSugerido || item.cfop,
      alertas: d.alertas ?? [],
      observacao: d.justificativa,
      origemIA: true,
    };
  }
}
