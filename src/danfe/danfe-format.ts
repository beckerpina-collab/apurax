/** Formatadores do DANFE/DACTE. Valores fiscais chegam como string (ex.: "1234.56"). */

const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf4 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

/** Número com 2 casas (sem "R$"). Vazio/zero → vazio (DANFE deixa células em branco). */
export function num2(v: string | number | null | undefined, mostrarZero = false): string {
  const n = toNum(v);
  if (n === null) return '';
  if (n === 0 && !mostrarZero) return '';
  return nf2.format(n);
}

/** Sempre mostra (inclusive 0,00) — usado nos totais. */
export function moeda(v: string | number | null | undefined): string {
  const n = toNum(v);
  return nf2.format(n ?? 0);
}

export function qtd(v: string | number | null | undefined): string {
  const n = toNum(v);
  if (n === null) return '';
  return nf4.format(n);
}

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

export function cpfCnpj(v: string): string {
  const d = (v || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return v || '';
}

export function cep(v: string): string {
  const d = (v || '').replace(/\D/g, '');
  if (d.length === 8) return d.replace(/(\d{5})(\d{3})/, '$1-$2');
  return v || '';
}

export function fone(v: string): string {
  const d = (v || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return v || '';
}

/** Chave de 44 dígitos em grupos de 4, como no DANFE. */
export function chaveEspacada(chave: string): string {
  const d = (chave || '').replace(/\D/g, '');
  return d.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** Data/hora no fuso de São Paulo (preferência fixa do usuário). */
export function dataHoraSP(d: Date | null): string {
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

export function dataSP(d: Date | null): string {
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export const MOD_FRETE: Record<string, string> = {
  '0': '0 - Por conta do emitente',
  '1': '1 - Por conta do destinatário',
  '2': '2 - Por conta de terceiros',
  '3': '3 - Transp. próprio (remetente)',
  '4': '4 - Transp. próprio (destinatário)',
  '9': '9 - Sem ocorrência de transporte',
};

export const MODAL_CTE: Record<string, string> = {
  '01': 'Rodoviário',
  '02': 'Aéreo',
  '03': 'Aquaviário',
  '04': 'Ferroviário',
  '05': 'Dutoviário',
  '06': 'Multimodal',
};

export const TP_CTE: Record<string, string> = {
  '0': '0 - Normal',
  '1': '1 - Complemento de valores',
  '2': '2 - Anulação',
  '3': '3 - Substituto',
};

export const TP_SERV_CTE: Record<string, string> = {
  '0': '0 - Normal',
  '1': '1 - Subcontratação',
  '2': '2 - Redespacho',
  '3': '3 - Redespacho intermediário',
  '4': '4 - Serviço vinculado a multimodal',
};

export const TOMADOR_CTE: Record<string, string> = {
  '0': 'Remetente',
  '1': 'Expedidor',
  '2': 'Recebedor',
  '3': 'Destinatário',
  '4': 'Outros',
};
