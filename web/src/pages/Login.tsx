import { Landmark, ShieldCheck, TrendingUp, Truck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../auth/AuthContext';
import { isDemo } from '../lib/api';

const destaques = [
  { icon: TrendingUp, texto: 'ICMS, PIS e COFINS de notas de entrada, por um motor determinístico e auditável.' },
  { icon: Truck, texto: 'Captura automática de NF-e e CT-e na SEFAZ via certificado A1.' },
  { icon: ShieldCheck, texto: 'Apuração de imposto a pagar e validação de NCM por produto.' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(isDemo ? 'admin@apurax.local' : '');
  const [senha, setSenha] = useState(isDemo ? 'apurax123' : '');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(email, senha);
      navigate('/');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Painel de marca */}
      <aside className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <Landmark className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <span className="text-lg font-bold">Apurax</span>
        </div>
        <div className="space-y-8">
          <h1 className="max-w-md text-3xl font-bold leading-tight">
            Recupere o crédito tributário que passa despercebido.
          </h1>
          <ul className="space-y-4">
            {destaques.map(({ icon: Icon, texto }) => (
              <li key={texto} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
                  <Icon className="h-4 w-4 text-sidebar-primary-foreground" />
                </div>
                <span className="text-sm text-sidebar-foreground/80">{texto}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/40">www.apurax.com.br</p>
      </aside>

      {/* Formulário */}
      <main className="flex items-center justify-center p-8">
        <form onSubmit={entrar} className="w-full max-w-sm space-y-6">
          <div className="space-y-1 lg:hidden">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Landmark className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">Apurax</span>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Entrar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Acesse o painel fiscal da sua empresa.</p>
          </div>

          {erro && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" autoComplete="username" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </div>

          <Button type="submit" className="w-full" disabled={carregando}>
            {carregando ? 'Entrando…' : 'Entrar'}
          </Button>

          {isDemo && (
            <p className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
              Demonstração — login <b>admin@apurax.local</b> / <b>apurax123</b>
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
