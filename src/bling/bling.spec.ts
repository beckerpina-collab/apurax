import {
  BLING_AUTH,
  blingDate,
  buildBlingAuthUrl,
  mapInvoiceToSaida,
  precisaRenovar,
  rotuloSituacao,
} from './bling.client';
import { assinaturaValida, hmacHex, parseEventoNfe } from './bling.webhook';

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

  it('extrai o invoiceId de eventos de NF-e e ignora os demais', () => {
    expect(parseEventoNfe(raw)).toEqual({ event: 'invoice.updated', invoiceId: 12345 });
    expect(parseEventoNfe(JSON.stringify({ event: 'product.updated', data: { id: 1 } }))).toBeNull();
    expect(parseEventoNfe('não-json')).toBeNull();
  });
});
