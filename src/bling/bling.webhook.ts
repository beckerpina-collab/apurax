import { createHmac, timingSafeEqual } from 'crypto';

/** HMAC-SHA256 do corpo cru, em hex (chave = client_secret do app Bling). */
export function hmacHex(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

/**
 * Valida a assinatura do webhook do Bling. Header:
 *   X-Bling-Signature-256: sha256=<hex>
 * Compara em tempo constante. Fail-closed (qualquer ausência → inválida).
 */
export function assinaturaValida(secret: string | undefined, rawBody: string, header: string | undefined): boolean {
  if (!secret || !rawBody || !header) return false;
  const provided = (header.startsWith('sha256=') ? header.slice(7) : header).toLowerCase();
  const expected = hmacHex(secret, rawBody);
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface BlingNotification {
  eventId?: string;
  event?: string;
  companyId?: number | string;
  data?: { id?: number | string };
}

/** Extrai (evento, invoiceId) de uma notificação de NF-e; null se não for de NF. */
export function parseEventoNfe(raw: string): { event: string; invoiceId: number | string } | null {
  let note: BlingNotification;
  try {
    note = JSON.parse(raw) as BlingNotification;
  } catch {
    return null;
  }
  const event = String(note?.event ?? '');
  const invoiceId = note?.data?.id;
  if (!/^(invoice|nfe|nota)/i.test(event) || invoiceId == null) return null;
  return { event, invoiceId };
}
