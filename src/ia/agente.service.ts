import { Inject, Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { RegimeTributario } from '@prisma/client';
import { MotorCreditoService } from '../motor-credito/motor-credito.service';
import { ItemApuravel } from '../motor-credito/motor-credito.types';
import { ANTHROPIC_CLIENT, MODELOS } from './anthropic.constants';
import { LegislacaoService } from './legislacao.service';
import { SYSTEM_AGENTE, TOOL_APURAR_CREDITO, TOOL_BUSCAR_BASE_LEGAL } from './ia.prompts';

const MAX_ITERACOES = 6;

export interface ContextoItem extends ItemApuravel {
  descricao?: string;
}

export interface RespostaAgente {
  resposta: string;
  ferramentasUsadas: string[];
  // valores SEMPRE oriundos do motor determinístico (nunca do texto do LLM)
  valoresMotor: Array<Record<string, unknown>>;
  aviso: string;
}

/**
 * Agente explicador (claude-opus-4-8) com tool-use. O LLM orquestra e narra, mas
 * delega TODO cálculo ao motor (apurar_credito_item) e cita a legislação via RAG
 * (buscar_base_legal). Nenhum valor monetário é lido do texto do modelo —
 * apenas dos resultados das ferramentas (proveniência 'engine').
 */
@Injectable()
export class AgenteService {
  constructor(
    @Inject(ANTHROPIC_CLIENT) private readonly anthropic: Anthropic,
    private readonly motor: MotorCreditoService,
    private readonly legislacao: LegislacaoService,
  ) {}

  async perguntar(
    pergunta: string,
    item?: ContextoItem,
    regime?: RegimeTributario,
    dataReferencia: Date = new Date(),
  ): Promise<RespostaAgente> {
    const contexto = this.montarContexto(pergunta, item, regime);
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: contexto }];
    const ferramentasUsadas: string[] = [];
    const valoresMotor: Array<Record<string, unknown>> = [];

    let resposta: Anthropic.Message | undefined;

    for (let i = 0; i < MAX_ITERACOES; i++) {
      resposta = await this.anthropic.messages.create({
        model: MODELOS.RACIOCINIO,
        max_tokens: 8192,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        system: SYSTEM_AGENTE,
        tools: [TOOL_APURAR_CREDITO, TOOL_BUSCAR_BASE_LEGAL],
        messages,
      });

      if (resposta.stop_reason !== 'tool_use') {
        break;
      }

      messages.push({ role: 'assistant', content: resposta.content });

      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const bloco of resposta.content) {
        if (bloco.type !== 'tool_use') continue;
        ferramentasUsadas.push(bloco.name);
        const { resultado, valorMotor } = await this.executarTool(
          bloco.name,
          (bloco.input ?? {}) as Record<string, unknown>,
          regime,
          dataReferencia,
        );
        if (valorMotor) {
          valoresMotor.push(valorMotor);
        }
        resultados.push({
          type: 'tool_result',
          tool_use_id: bloco.id,
          content: JSON.stringify(resultado),
        });
      }
      messages.push({ role: 'user', content: resultados });
    }

    const texto = (resposta?.content ?? [])
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return {
      resposta: texto,
      ferramentasUsadas,
      valoresMotor,
      aviso:
        'Os valores são do motor determinístico (proveniência engine). O texto é explicação gerada por IA e deve ser homologado pelo contador.',
    };
  }

  private async executarTool(
    nome: string,
    input: Record<string, unknown>,
    regimePadrao: RegimeTributario | undefined,
    dataReferencia: Date,
  ): Promise<{ resultado: unknown; valorMotor?: Record<string, unknown> }> {
    if (nome === TOOL_BUSCAR_BASE_LEGAL.name) {
      const trechos = this.legislacao.buscar(String(input.consulta ?? ''), 3);
      return { resultado: { trechos } };
    }

    if (nome === TOOL_APURAR_CREDITO.name) {
      const tributo = String(input.tributo ?? 'ICMS');
      const regime = (input.regime as RegimeTributario) ?? regimePadrao ?? RegimeTributario.LUCRO_REAL;
      const item: ItemApuravel = {
        cstIcms: (input.cstIcms as string) ?? null,
        csosn: (input.csosn as string) ?? null,
        vIcms: (input.vIcms as string) ?? null,
        vIcmsSt: (input.vIcmsSt as string) ?? null,
        vCredIcmsSn: (input.vCredIcmsSn as string) ?? null,
        cstPis: (input.cstPis as string) ?? null,
        vPis: (input.vPis as string) ?? null,
        cstCofins: (input.cstCofins as string) ?? null,
        vCofins: (input.vCofins as string) ?? null,
      };
      const regras = await this.motor.carregarRegras(dataReferencia);
      const resultados = this.motor.avaliarItem(item, regime, regras);
      const r = resultados.find((x) => x.tributo === tributo) ?? resultados[0];
      const payload = {
        tributo: r.tributo,
        creditoPermitido: r.creditoPermitido,
        valorCredito: r.valorCredito.toFixed(2),
        baseLegal: r.baseLegal,
        regraCodigo: r.regraCodigo,
        alertas: r.alertas,
        proveniencia: 'engine',
      };
      return { resultado: payload, valorMotor: payload };
    }

    return { resultado: { erro: `Ferramenta desconhecida: ${nome}` } };
  }

  private montarContexto(pergunta: string, item?: ContextoItem, regime?: RegimeTributario): string {
    let texto = `Pergunta do contador: ${pergunta}`;
    if (regime) {
      texto += `\nRegime tributário da empresa: ${regime}`;
    }
    if (item) {
      texto +=
        `\nItem em análise: ` +
        JSON.stringify({
          descricao: item.descricao,
          cstIcms: item.cstIcms,
          csosn: item.csosn,
          vIcms: item.vIcms,
          cstPis: item.cstPis,
          vPis: item.vPis,
          cstCofins: item.cstCofins,
          vCofins: item.vCofins,
        });
    }
    return texto;
  }
}
