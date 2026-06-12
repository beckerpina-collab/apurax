import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, clearSession, getToken, type RegistrarPayload, type Usuario } from '../lib/api';

interface AuthState {
  usuario: Usuario | null;
  autenticado: boolean;
  login: (email: string, senha: string) => Promise<void>;
  registrar: (payload: RegistrarPayload) => Promise<void>;
  logout: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);

const USER_KEY = 'apurax_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lê a sessão de forma SÍNCRONA no 1º render — evita o "flash de login" ao
  // recarregar/abrir um link interno direto.
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw && getToken() ? (JSON.parse(raw) as Usuario) : null;
  });

  const value = useMemo<AuthState>(
    () => ({
      usuario,
      autenticado: !!usuario,
      async login(email, senha) {
        const { usuario: u } = await api.login(email, senha);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
        setUsuario(u);
      },
      async registrar(payload) {
        const { usuario: u } = await api.registrar(payload);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
        setUsuario(u);
      },
      logout() {
        clearSession();
        setUsuario(null);
      },
    }),
    [usuario],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
