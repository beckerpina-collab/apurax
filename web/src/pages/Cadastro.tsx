import { Landmark } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '../auth/AuthContext';
import type { RegistrarPayload } from '../lib/api';

type Regime = RegistrarPayload['regimeTributario'];

export default function Cadastro() {
  const { registrar } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    razaoSocial: '',
    cnpj: '',
    regimeTributario: 'LUCRO_REAL' as Regime,
    uf: 'SP',
  });
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const set = (campo: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    const cnpj = form.cnpj.replace(/\D/g, '');
    if (!form.nome || !form.email || form.senha.length < 6) {
      setErro('Preencha nome, e-mail e uma senha de pelo menos 6 caracteres.');
      return;
    }
    if (cnpj.length !== 14) {
      setErro('CNPJ deve ter 14 dígitos.');
      return;
    }
    if (!form.razaoSocial || form.uf.length !== 2) {
      setErro('Informe a razão social e a UF (2 letras) da empresa.');
      return;
    }
    setCarregando(true);
    try {
      await registrar({ ...form, cnpj, uf: form.uf.toUpperCase() });
      navigate('/');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao criar a conta.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <Landmark className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <span className="text-lg font-bold">Apurax</span>
        </div>
        <div className="space-y-4">
          <h1 className="max-w-md text-3xl font-bold leading-tight">Crie sua conta e comece a apurar.</h1>
          <p className="max-w-md text-sm text-sidebar-foreground/80">
            Captura de NF-e/CT-e, apuração de ICMS, IPI, PIS/COFINS, ISS e CBS/IBS, integração com o Bling e
            validação de NCM — tudo num só lugar.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/40">www.apurax.com.br</p>
      </aside>

      <main className="flex items-center justify-center overflow-y-auto p-8">
        <form onSubmit={criar} className="w-full max-w-md space-y-6 py-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Criar conta</h2>
            <p className="mt-1 text-sm text-muted-foreground">Você é o administrador da sua conta.</p>
          </div>

          {erro && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </div>
          )}

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seus dados</p>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={form.nome} onChange={set('nome')} placeholder="Seu nome" autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={form.email} onChange={set('email')} placeholder="voce@empresa.com.br" autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input id="senha" type="password" value={form.senha} onChange={set('senha')} placeholder="mínimo 6 caracteres" autoComplete="new-password" />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sua empresa</p>
            <div className="space-y-2">
              <Label htmlFor="razaoSocial">Razão social</Label>
              <Input id="razaoSocial" value={form.razaoSocial} onChange={set('razaoSocial')} placeholder="Nome da empresa" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0000-00" inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uf">UF</Label>
                <Input id="uf" value={form.uf} onChange={set('uf')} maxLength={2} placeholder="SP" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Regime tributário</Label>
              <Select value={form.regimeTributario} onValueChange={(v) => setForm((f) => ({ ...f, regimeTributario: v as Regime }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LUCRO_REAL">Lucro Real</SelectItem>
                  <SelectItem value="LUCRO_PRESUMIDO">Lucro Presumido</SelectItem>
                  <SelectItem value="SIMPLES_NACIONAL">Simples Nacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={carregando}>
            {carregando ? 'Criando conta…' : 'Criar conta'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
