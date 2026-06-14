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

export interface EventoNotaBling {
  event: string;
  invoiceId: number | string;
  modelo: 'nfe' | 'nfce'; // nfe = NF-e mod 55 (venda E devolução; tpNF decide); nfce = NFC-e mod 65
}

/**
 * Extrai (evento, id, modelo) de uma notificação de nota fiscal do Bling v3.
 * O campo `event` é "<recurso>.<ação>" — recurso `invoice` = NF-e (mod 55, cobre
 * venda e devolução: o tpNF do XML decide entrada/saída) e `consumer_invoice` =
 * NFC-e (mod 65). Retorna null se não for evento de nota.
 * (NFC-e é testada ANTES de NF-e porque "consumer_invoice" contém "invoice".)
 */
export function parseEventoNota(raw: string): EventoNotaBling | null {
  let note: BlingNotification;
  try {
    note = JSON.parse(raw) as BlingNotification;
  } catch {
    return null;
  }
  const event = String(note?.event ?? '');
  const invoiceId = note?.data?.id;
  if (invoiceId == null) return null;
  if (/^consumer_invoice\b/i.test(event) || /nfce/i.test(event)) {
    return { event, invoiceId, modelo: 'nfce' };
  }
  if (/^(invoice|nfe|nota)\b/i.test(event)) {
    return { event, invoiceId, modelo: 'nfe' };
  }
  return null;
}
