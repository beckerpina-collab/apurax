import { Prisma } from '@prisma/client';
import { AgenteService } from './agente.service';

// fábrica de uma resposta Anthropic mínima (só os campos que o serviço lê)
function msg(partial: Record<string, unknown>): any {
  return {
    id: 'm',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-4-8',
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
    ...partial,
  };
}

describe('AgenteService — tool-use loop + guardrail "no-número-da-IA"', () => {
  it('chama o motor para o valor e explica; o número vem do motor, não do texto', async () => {
    const anthropic = {
      messages: {
        create: jest
          .fn()
          // 1ª volta: o modelo pede a ferramenta de cálculo
          .mockResolvedValueOnce(
            msg({
              stop_reason: 'tool_use',
              content: [
                {
                  type: 'tool_use',
                  id: 'tu1',
                  name: 'apurar_credito_item',
                  input: { tributo: 'ICMS', regime: 'LUCRO_REAL', cstIcms: '00', vIcms: '180.00' },
                },
              ],
            }),
          )
          // 2ª volta: o modelo explica com o resultado da ferramenta
          .mockResolvedValueOnce(
            msg({
              stop_reason: 'end_turn',
              content: [{ type: 'text', text: 'O item gera crédito de ICMS, conforme o motor.' }],
            }),
          ),
      },
    } as any;

    const motor = {
      carregarRegras: jest.fn().mockResolvedValue([]),
      avaliarItem: jest.fn().mockReturnValue([
        {
          tributo: 'ICMS',
          creditoPermitido: true,
          valorCredito: new Prisma.Decimal('180'),
          regraId: 'r',
          regraCodigo: 'R-ICMS-CRED-NORMAL',
          baseLegal: 'LC 87/96, art. 20',
          alertas: [],
        },
      ]),
    } as any;

    const legislacao = {
      buscar: jest.fn().mockReturnValue([{ fonte: 'LC 87/96', titulo: 't', trecho: 'x' }]),
    } as any;

    const svc = new AgenteService(anthropic, motor, legislacao);
    const res = await svc.perguntar('Esse item gera crédito de ICMS?', undefined, undefined, new Date(0));

    expect(motor.avaliarItem).toHaveBeenCalled();
    expect(res.ferramentasUsadas).toContain('apurar_credito_item');
    expect(res.valoresMotor).toHaveLength(1);
    // valor e proveniência vêm do motor — nunca parseados do texto do LLM
    expect(res.valoresMotor[0].valorCredito).toBe('180.00');
    expect(res.valoresMotor[0].proveniencia).toBe('engine');
    expect(res.resposta).toContain('crédito');
    expect(anthropic.messages.create).toHaveBeenCalledTimes(2);
  });

  it('responde direto, sem ferramentas, quando o modelo não pede tool_use', async () => {
    const anthropic = {
      messages: {
        create: jest.fn().mockResolvedValue(
          msg({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Resposta direta.' }] }),
        ),
      },
    } as any;
    const motor = { carregarRegras: jest.fn(), avaliarItem: jest.fn() } as any;
    const legislacao = { buscar: jest.fn() } as any;

    const svc = new AgenteService(anthropic, motor, legislacao);
    const res = await svc.perguntar('Olá');

    expect(res.ferramentasUsadas).toHaveLength(0);
    expect(res.valoresMotor).toHaveLength(0);
    expect(res.resposta).toBe('Resposta direta.');
    expect(motor.avaliarItem).not.toHaveBeenCalled();
  });
});
