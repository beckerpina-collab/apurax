import {
  BLING_AUTH,
  blingDate,
  buildBlingAuthUrl,
  mapInvoiceToSaida,
  precisaRenovar,
  rotuloSituacao,
} from './bling.client';
import { assinaturaValida, hmacHex, parseEventoNota } from './bling.webhook';
import { FilaSequencial } from './fila-sequencial';
import { RateLimiter } from './rate-limiter';

describe('Bling client (helpers puros)', () => {
  it('monta a URL de autorização com response_type/client_id/state', () => {
    const url = buildBlingAuthUrl('abc123', 'st-1');
    expect(url.startsWith(BLING_AUTH)).toBe(true);
    expect(url).toContain('response_type=code');
    expect(url).toContain('client_id=abc123');
    expect(url).toContain('state=st-1');
  });

  it('formata data no padrão do Bling (YYYY-MM-DD HH:MM:SS)', () => {
    expect(blingDate(new Date('2026-02-15T10:30:45.000Z'))).toBe('2026-02-15 10:30:45');
  });

  it('decide renovação com folga de 5 min', () => {
    const agora = 1_000_000_000_000;
    expect(precisaRenovar(agora + 4 * 60 * 1000, agora)).toBe(true); // falta 4 min → renova
    expect(precisaRenovar(agora + 10 * 60 * 1000, agora)).toBe(false); // falta 10 min → ok
    expect(precisaRenovar(agora - 1, agora)).toBe(true); // já expirou
  });

  it('rotula a situação (número ou objeto)', () => {
    expect(rotuloSituacao(5)).toBe('Autorizada');
    expect(rotuloSituacao({ id: 6 })).toBe('Emitida DANFE');
    expect(rotuloSituacao(99)).toBe('Código 99');
    expect(rotuloSituacao(undefined)).toBe('—');
  });

  it('mapeia a NF do Bling para o formato do front', () => {
    const s = mapInvoiceToSaida({
      id: 42,
      tipo: 1,
      numero: '1042',
      serie: 1,
      valorNota: 2400.5,
      dataEmissao: '2026-02-04',
      chaveAcesso: '3526...',
      situacao: 5,
      contato: { nome: 'Cliente A' },
    });
    expect(s).toMatchObject({
      id: '42',
      numero: '1042',
      serie: '1',
      destinatario: 'Cliente A',
      valor: 2400.5,
      situacao: 'Autorizada',
    });
  });
});

describe('Bling webhook (assinatura + parse)', () => {
  const secret = 'segredo-do-app-bling';
  const raw = JSON.stringify({ eventId: 'e1', event: 'invoice.updated', companyId: 999, data: { id: 12345 } });

  it('aceita assinatura HMAC-SHA256 válida (com e sem prefixo sha256=)', () => {
    const sig = hmacHex(secret, raw);
    expect(assinaturaValida(secret, raw, `sha256=${sig}`)).toBe(true);
    expect(assinaturaValida(secret, raw, sig)).toBe(true);
    expect(assinaturaValida(secret, raw, sig.toUpperCase())).toBe(true); // case-insensitive
  });

  it('rejeita assinatura inválida, corpo adulterado, ou ausências (fail-closed)', () => {
    const sig = hmacHex(secret, raw);
    expect(assinaturaValida(secret, raw, 'sha256=deadbeef')).toBe(false);
    expect(assinaturaValida(secret, `${raw} `, `sha256=${sig}`)).toBe(false); // corpo alterado
    expect(assinaturaValida('outro-secret', raw, `sha256=${sig}`)).toBe(false);
    expect(assinaturaValida(undefined, raw, `sha256=${sig}`)).toBe(false);
    expect(assinaturaValida(secret, raw, undefined)).toBe(false);
  });

  it('classifica eventos de NF-e (mod 55) e NFC-e (mod 65) e ignora os demais', () => {
    // NF-e (cobre venda E devolução — o tpNF do XML decide entrada/saída)
    expect(parseEventoNota(raw)).toEqual({ event: 'invoice.updated', invoiceId: 12345, modelo: 'nfe' });
    expect(parseEventoNota(JSON.stringify({ event: 'invoice.created', data: { id: 7 } }))).toEqual({
      event: 'invoice.created',
      invoiceId: 7,
      modelo: 'nfe',
    });
    // NFC-e — recurso "consumer_invoice" (contém "invoice", mas é classificada como nfce)
    expect(parseEventoNota(JSON.stringify({ event: 'consumer_invoice.created', data: { id: 88 } }))).toEqual({
      event: 'consumer_invoice.created',
      invoiceId: 88,
      modelo: 'nfce',
    });
    // não-nota e lixo → null
    expect(parseEventoNota(JSON.stringify({ event: 'product.updated', data: { id: 1 } }))).toBeNull();
    expect(parseEventoNota(JSON.stringify({ event: 'invoice.created' }))).toBeNull(); // sem data.id
    expect(parseEventoNota('não-json')).toBeNull();
  });
});

describe('RateLimiter (limite global do Bling)', () => {
  it('espaça as chamadas pelo intervalo mínimo', async () => {
    const rl = new RateLimiter(40);
    const t0 = Date.now();
    await rl.aguardar();
    await rl.aguardar();
    await rl.aguardar();
    // 3 chamadas → pelo menos 2 intervalos de 40ms (com folga p/ timer impreciso)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(70);
  });
});

describe('FilaSequencial (processamento em segundo plano)', () => {
  it('processa em ordem e deduplica itens pendentes', async () => {
    const vistos: string[] = [];
    const fila = new FilaSequencial(async (c) => {
      vistos.push(c);
    });
    expect(fila.enfileirar('a')).toBe(true);
    expect(fila.enfileirar('b')).toBe(true);
    expect(fila.enfileirar('a')).toBe(false); // dedupe enquanto pendente
    await new Promise((r) => setTimeout(r, 50));
    expect(vistos).toEqual(['a', 'b']);
    expect(fila.tamanho).toBe(0);
  });

  it('re-tenta após falha transitória e conclui', async () => {
    let chamadas = 0;
    const fila = new FilaSequencial(
      async () => {
        chamadas += 1;
        if (chamadas === 1) throw new Error('429 simulado');
      },
      { maxTentativas: 3, atrasoRetryMs: 10 },
    );
    fila.enfileirar('x');
    await new Promise((r) => setTimeout(r, 150));
    expect(chamadas).toBe(2); // falhou 1x, re-tentou e concluiu
    expect(fila.tamanho).toBe(0);
  });

  it('desiste após maxTentativas e avisa onErro', async () => {
    let chamadas = 0;
    const desistencias: boolean[] = [];
    const fila = new FilaSequencial(
      async () => {
        chamadas += 1;
        throw new Error('sempre falha');
      },
      { maxTentativas: 2, atrasoRetryMs: 10, onErro: (_c, _e, d) => desistencias.push(d) },
    );
    fila.enfileirar('y');
    await new Promise((r) => setTimeout(r, 200));
    expect(chamadas).toBe(2);
    expect(desistencias).toEqual([false, true]);
    expect(fila.tamanho).toBe(0);
  });
});
