import {
  APURACOES,
  CURSORES,
  DASHBOARD,
  DOCUMENTOS,
  EMPRESAS,
  demoApurarImposto,
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

export const isDemo = DEMO;
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export interface Usuario {
  nome: string;
  email: string;
  role: string;
}

export type ModeloDoc = 'nfe' | 'cte' | 'nfse';
export type ImpostoTipo = 'icms' | 'ipi' | 'pis-cofins' | 'iss';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Erro ${res.status}`);
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
    const r = await http<{ accessToken: string; usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    });
    setToken(r.accessToken);
    return { usuario: r.usuario };
  },

  async empresas() {
    if (DEMO) {
      await delay();
      return EMPRESAS;
    }
    return http<typeof EMPRESAS>('/empresas');
  },

  async documentos() {
    if (DEMO) {
      await delay();
      return DOCUMENTOS;
    }
    return http<typeof DOCUMENTOS>('/fiscal/documentos');
  },

  async apuracoes() {
    if (DEMO) {
      await delay();
      return APURACOES;
    }
    return http<typeof APURACOES>('/apuracoes');
  },

  async dashboard() {
    if (DEMO) {
      await delay();
      return DASHBOARD;
    }
    // backend ainda não expõe um resumo único; agregaríamos aqui no real.
    return DASHBOARD;
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

  async salvarCertificado(empresaId: string, pfxBase64: string, senha: string, notAfter?: string) {
    if (DEMO) {
      await delay(700);
      return { ok: true, mensagem: 'Certificado A1 armazenado com segurança (demo).' };
    }
    return http('/certificados', { method: 'POST', body: JSON.stringify({ empresaId, pfxBase64, senha, notAfter }) });
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
      return { total: 3, importadas: 3, semXml: 0, erros: [], observacao: 'Importadas como documentos de saída (demo).' };
    }
    return http('/bling/importar-saidas', { method: 'POST', body: JSON.stringify({ empresaId, dataInicial, dataFinal }) });
  },
};
