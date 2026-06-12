import { LogOut } from 'lucide-react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '../auth/AuthContext';
import { isDemo } from '../lib/api';
import { useEmpresa } from '../lib/empresa-context';
import Sidebar from './Sidebar';

export default function Layout() {
  const { usuario, logout } = useAuth();
  const { empresas, empresaId, setEmpresaId } = useEmpresa();
  const navigate = useNavigate();
  const iniciais = (usuario?.nome ?? 'A')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64 flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card/80 px-8 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            {empresas.length > 0 && (
              <Select value={empresaId ?? undefined} onValueChange={setEmpresaId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.razaoSocial} · {e.regimeTributario.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isDemo && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-chart-3/15 px-2.5 py-1 text-[11px] font-medium text-chart-3">
                <span className="h-1.5 w-1.5 rounded-full bg-chart-3" /> modo demo
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{usuario?.email}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {iniciais}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </header>
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
