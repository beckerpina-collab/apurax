import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Empresa } from './mock';

interface EmpresaState {
  empresas: Empresa[];
  empresaId: string | null;
  empresa: Empresa | null;
  setEmpresaId: (id: string) => void;
  carregando: boolean;
}

const Ctx = createContext<EmpresaState | null>(null);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    api
      .empresas()
      .then((lista) => {
        if (!vivo) return;
        setEmpresas(lista);
        setEmpresaId((atual) => atual ?? lista[0]?.id ?? null);
      })
      .catch(() => undefined)
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  const value = useMemo<EmpresaState>(
    () => ({
      empresas,
      empresaId,
      empresa: empresas.find((e) => e.id === empresaId) ?? null,
      setEmpresaId,
      carregando,
    }),
    [empresas, empresaId, carregando],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEmpresa(): EmpresaState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEmpresa fora do EmpresaProvider');
  return ctx;
}
