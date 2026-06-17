import {
  APURACOES,
  CURSORES,
  DASHBOARD,
  DOCUMENTOS,
  EMPRESAS,
  RESUMO_CST_DEMO,
  demoApurarImposto,
  demoApurarSimples,
  demoBlingPuxar,
  demoBlingStatus,
  demoClassificar,
  demoCompararReforma,
  demoImportarNfe,
  demoSincronizar,
} from './mock';

const DEMO = import.meta.env.VITE_DEMO !== 'false';
// O backend mora atrás de /api (prefixo global; rewrite Firebase→Cloud Run).
// Em prod o front e a API dividem o domínio → use '/api' (mesma origem, sem CORS).
// Em dev, o backend atende em http://localhost:3000/api.
const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3000/api';
const TOKEN_KEY = 'apurax_token';
const REFRESH_KEY = 'apurax_refresh';
const USER_KEY = 'apurax_user';

export const isDemo = DEMO;
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
export const getRefresh = () => localStorage.getItem(REFRESH_KEY);
export const setRefresh = (t: string) => localStorage.setItem(REFRESH_KEY, t);
/** Limpa toda a sessão (logout ou refresh expirado). */
export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
};

export interface Usuario {
  nome: string;
  email: string;
  role: string;
}

export interface RegistrarPayload {
  nome: string;
  email: string;
  senha: string;
  nomeConta?: string;
  cnpj: string;
  razaoSocial: string;
  regimeTributario: 'LUCRO_REAL' | 'LUCRO_PRESUMIDO' | 'SIMPLES_NACIONAL';
  uf: string;
}

export type ModeloDoc = 'nfe' | 'cte' | 'nfse';
export type ImpostoTipo = 'icms' | 'ipi' | 'pis-cofins' | 'iss' | 'cbs' | 'ibs' | 'simples';

// Renovação de token compartilhada: várias chamadas que tomem 401 ao mesmo
// tempo disparam UM único /auth/refresh e aguardam o mesmo resultado.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  const rt = getRefresh();
  if (!rt) return null;
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })
      .then(async (r) => {
        if (!r.ok) return null;
        const d = (await r.json()) as { accessToken?: string; refreshToken?: string };
        if (d.accessToken) setToken(d.accessToken);
        if (d.refreshToken) setRefresh(d.refreshToken);
        return d.accessToken ?? null;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/** Sessão acabou (refresh inválido/expirado): limpa tudo e volta ao login. */
function encerrarSessao(): void {
  clearSession();
  if (!location.pathname.startsWith('/login')) location.assign('/login');
}

async function http<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  // Access token expirou → tenta renovar com o refresh (1x) e repete a chamada.
  if (res.status === 401 && retry && getRefresh()) {
    const novoAccess = await refreshAccess();
    if (novoAccess) return http<T>(path, init, false);
    encerrarSessao();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: unknown };
    const m = body.message;
    const msg = Array.isArray(m)
      ? m.join('; ')
      : typeof m === 'string' && m.trim()
        ? m
        : `Erro ${res.status}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

const DOC_ENDPOINT: Record<ModeloDoc, string> = {
  nfe: '/fiscal/nfe',
  cte: '/fiscal/cte',
  nfse: '/nfse/import',
};

export const api = {
  async login(email: string, senha: string): Promise<{ usuario: Usuario }> {
    if (DEMO) {
      await delay();
      if (email.trim().toLowerCase() !== 'admin@apurax.local' || senha !== 'apurax123') {
        throw new Error('Credenciais inválidas. Use o login de demonstração.');
      }
      setToken('demo-token');
      return { usuario: { nome: 'Admin Demo', email: 'admin@apurax.local', role: 'ADMIN' } };
    }
    const r = await http<{ accessToken: string; refreshToken?: string; usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    });
    setToken(r.accessToken);
    if (r.refreshToken) setRefresh(r.refreshToken);
    return { usuario: r.usuario };
  },

  async registrar(payload: RegistrarPayload): Promise<{ usuario: Usuario }> {
    if (DEMO) {
      await delay(700);
      setToken('demo-token');
      return { usuario: { nome: payload.nome, email: payload.email, role: 'ADMIN' } };
    }
    const r = await http<{ accessToken: string; refreshToken?: string; usuario: Usuario }>('/auth/registrar', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setToken(r.accessToken);
    if (r.refreshToken) setRefresh(r.refreshToken);
    return { usuario: r.usuario };
  },

  async empresas() {
    if (DEMO) {
      await delay();
      return EMPRESAS;
    }
    return http<typeof EMPRESAS>('/empresas');
  },

  async documentos(ano?: number, mes?: number, tipo?: 'ENTRADA' | 'SAIDA') {
    if (DEMO) {
      await delay();
      const documentos = DOCUMENTOS.filter((d) => {
        const dt = new Date(d.dataEmissao);
        if (ano && dt.getUTCFullYear() !== ano) return false;
        if (ano && mes && dt.getUTCMonth() + 1 !== mes) return false;
        // mock pode não ter tipoOperacao → trata como ENTRADA
        if (tipo && ((d as { tipoOperacao?: string }).tipoOperacao ?? 'ENTRADA') !== tipo) return false;
        return true;
      });
      return { documentos, resumoCst: RESUMO_CST_DEMO };
    }
    const qs = new URLSearchParams();
    if (ano) qs.set('ano', String(ano));
    if (mes) qs.set('mes', String(mes));
    if (tipo) qs.set('tipo', tipo);
    const sufixo = qs.toString() ? `?${qs.toString()}` : '';
    return http<{ documentos: typeof DOCUMENTOS; resumoCst: typeof RESUMO_CST_DEMO }>(`/fiscal/documentos${sufixo}`);
  },

  /** Baixa o XML bruto de um documento (NF-e/CT-e) — fetch autenticado + download no navegador. */
  async baixarDocumentoXml(id: string, chave?: string): Promise<void> {
    let blob: Blob;
    let nome = `${chave || id}.xml`;
    if (DEMO) {
      await delay(300);
      blob = new Blob(
        [`<?xml version="1.0" encoding="UTF-8"?>\n<nfeProc><!-- XML de demonstração (${chave || id}) --></nfeProc>`],
        { type: 'application/xml' },
      );
    } else {
      const res = await fetch(`${API_URL}/fiscal/documentos/${id}/xml`, {
        headers: { ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}) },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Falha ao baixar o XML (${res.status}).`);
      }
      const cd = res.headers.get('content-disposition');
      const m = cd?.match(/filename="?([^"]+)"?/);
      if (m) nome = m[1];
      blob = await res.blob();
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /** Baixa o PDF auxiliar (DANFE/DACTE) gerado a partir do XML — fetch autenticado + download. */
  async baixarDocumentoPdf(id: string, chave?: string): Promise<void> {
    let blob: Blob;
    let nome = `${chave || id}.pdf`;
    if (DEMO) {
      await delay(300);
      blob = new Blob(
        [`%PDF-1.4\n% DANFE/DACTE de demonstração (${chave || id}) — disponível na versão conectada.`],
        { type: 'application/pdf' },
      );
    } else {
      const res = await fetch(`${API_URL}/fiscal/documentos/${id}/pdf`, {
        headers: { ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}) },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Falha ao gerar o PDF (${res.status}).`);
      }
      const cd = res.headers.get('content-disposition');
      const m = cd?.match(/filename="?([^"]+)"?/);
      if (m) nome = m[1];
      blob = await res.blob();
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async apuracoes(ano?: number, mes?: number) {
    if (DEMO) {
      await delay();
      return APURACOES; // mock não tem data por crédito — filtro só na API real
    }
    const qs = new URLSearchParams();
    if (ano) qs.set('ano', String(ano));
    if (mes) qs.set('mes', String(mes));
    const sufixo = qs.toString() ? `?${qs.toString()}` : '';
    return http<typeof APURACOES>(`/apuracoes${sufixo}`);
  },

  async dashboard(ano?: number, mes?: number) {
    if (DEMO) {
      await delay();
      return DASHBOARD;
    }
    const q = new URLSearchParams();
    if (ano) q.set('ano', String(ano));
    if (mes) q.set('mes', String(mes));
    const qs = q.toString();
    return http<typeof DASHBOARD>(`/dashboard/resumo${qs ? `?${qs}` : ''}`);
  },

  async importarDoc(modelo: ModeloDoc, empresaId: string, xml: string) {
    if (DEMO) {
      await delay(600);
      return demoImportarNfe();
    }
    return http(DOC_ENDPOINT[modelo], { method: 'POST', body: JSON.stringify({ empresaId, xml }) });
  },

  async apurarImposto(tipo: ImpostoTipo, empresaId: string, ano: number, mes: number) {
    if (DEMO) {
      await delay(500);
      const nome = tipo === 'pis-cofins' ? 'PIS/COFINS' : tipo.toUpperCase();
      return demoApurarImposto(nome, ano, mes);
    }
    return http(`/apuracao/${tipo}`, { method: 'POST', body: JSON.stringify({ empresaId, ano, mes }) });
  },

  /** Apuração do Simples Nacional (DAS) por competência — lê as saídas e calcula a alíquota efetiva. */
  async apurarSimples(empresaId: string, ano: number, mes: number, anexo?: string) {
    if (DEMO) {
      await delay(500);
      return demoApurarSimples(ano, mes, anexo);
    }
    return http(`/apuracao/simples`, { method: 'POST', body: JSON.stringify({ empresaId, ano, mes, anexo }) });
  },

  async sincronizarSefaz(empresaId: string, modelo: 'NFE' | 'CTE' = 'NFE') {
    if (DEMO) {
      await delay(900);
      return demoSincronizar();
    }
    return http('/distribuicao/sincronizar', { method: 'POST', body: JSON.stringify({ empresaId, modelo }) });
  },

  async cursores() {
    if (DEMO) {
      await delay();
      return CURSORES;
    }
    return http<typeof CURSORES>('/distribuicao/cursores');
  },

  async manifestar(
    empresaId: string,
    chave: string,
    tpEvento: '210210' | '210200' | '210220' | '210240',
    xJust?: string,
  ) {
    if (DEMO) {
      await delay(700);
      return {
        ok: true,
        cStat: '135',
        xMotivo: 'Evento registrado e vinculado a NF-e (demo)',
        mensagem: 'Manifestação registrada (demo). Sincronize NF-e para baixar o XML completo.',
      };
    }
    return http('/distribuicao/manifestar', {
      method: 'POST',
      body: JSON.stringify({ empresaId, chave, tpEvento, xJust }),
    });
  },

  async salvarCertificado(empresaId: string, pfxBase64: string, senha: string, notAfter?: string) {
    if (DEMO) {
      await delay(700);
      return { ok: true, mensagem: 'Certificado A1 armazenado com segurança (demo).' };
    }
    // A API devolve { id, cnpj, tipo, status } — normalizamos com ok:true
    // (erro vira exceção no http(), nunca chega aqui).
    const r = await http<{ id: string; cnpj: string; status: string }>('/certificados', {
      method: 'POST',
      body: JSON.stringify({ empresaId, pfxBase64, senha, notAfter }),
    });
    return { ok: true, mensagem: `Certificado A1 salvo com segurança (CNPJ ${r.cnpj}).` };
  },

  async certificadoAtual(empresaId: string): Promise<{
    id: string;
    cnpj: string;
    tipo: string;
    status: string;
    notAfter: string | null;
    criadoEm: string;
  } | null> {
    if (DEMO) {
      await delay();
      return { id: 'demo', cnpj: '11111111000111', tipo: 'A1', status: 'ATIVO', notAfter: null, criadoEm: new Date().toISOString() };
    }
    return http(`/certificados/atual?empresaId=${encodeURIComponent(empresaId)}`);
  },

  async classificarItem(payload: { descricao: string; ncm: string; cfop: string; cstIcms?: string; cstPis?: string; cstCofins?: string }) {
    if (DEMO) {
      await delay(700);
      return demoClassificar(payload);
    }
    return http('/ia/classificar-item', { method: 'POST', body: JSON.stringify(payload) });
  },

  async compararReforma(empresaId: string, xml: string) {
    if (DEMO) {
      await delay(600);
      return demoCompararReforma();
    }
    return http('/reforma/comparar', { method: 'POST', body: JSON.stringify({ empresaId, xml }) });
  },

  async blingStatus(empresaId?: string) {
    if (DEMO) {
      await delay();
      return demoBlingStatus();
    }
    return http(`/bling/status?empresaId=${encodeURIComponent(empresaId ?? '')}`);
  },

  async blingAuthUrl(empresaId: string): Promise<{ authorization_url: string }> {
    if (DEMO) {
      await delay();
      return { authorization_url: '#demo' };
    }
    return http(`/bling/auth-url?empresaId=${encodeURIComponent(empresaId)}`);
  },

  async blingPuxarSaidas(empresaId: string, dataInicial: string, dataFinal: string) {
    if (DEMO) {
      await delay(900);
      return demoBlingPuxar();
    }
    return http('/bling/saidas', { method: 'POST', body: JSON.stringify({ empresaId, dataInicial, dataFinal }) });
  },

  async blingImportarSaidas(empresaId: string, dataInicial: string, dataFinal: string) {
    if (DEMO) {
      await delay(900);
      return {
        total: 3,
        enfileiradas: 3,
        jaNaFila: 0,
        filaPendentes: 3,
        observacao: 'Notas enfileiradas para importação em segundo plano (demo).',
      };
    }
    return http('/bling/importar-saidas', { method: 'POST', body: JSON.stringify({ empresaId, dataInicial, dataFinal }) });
  },

  async blingPararImportacao(empresaId: string) {
    if (DEMO) {
      await delay();
      return { ok: true, filaRemovidas: 0, filaPendentes: 0, observacao: 'Importação interrompida (demo).' };
    }
    return http('/bling/parar-importacao', { method: 'POST', body: JSON.stringify({ empresaId }) });
  },
};
