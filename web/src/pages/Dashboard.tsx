import { ArrowLeftRight, FileWarning, Receipt, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import StatusPill from '@/components/StatusPill';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '../lib/api';
import { brl } from '../lib/format';
import { DASHBOARD, type Apuracao } from '../lib/mock';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export default function Dashboard() {
  const [d, setD] = useState(DASHBOARD);
  const [apur, setApur] = useState<Apuracao[]>([]);
  const [ano, setAno] = useState('todos');
  const [mes, setMes] = useState('todos');

  useEffect(() => {
    api
      .dashboard(ano === 'todos' ? undefined : Number(ano), mes === 'todos' ? undefined : Number(mes))
      .then(setD)
      .catch(() => undefined);
  }, [ano, mes]);

  useEffect(() => {
    api.apuracoes().then(setApur).catch(() => undefined);
  }, []);

  const anos = d.anosDisponiveis ?? [];

  return (
    <div>
      <PageHeader title="Painel" description={`Visão fiscal — ${d.competencia}`}>
        <Select
          value={ano}
          onValueChange={(v) => {
            setAno(v);
            if (v === 'todos') setMes('todos');
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os anos</SelectItem>
            {anos.map((a) => (
              <SelectItem key={a} value={String(a)}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mes} onValueChange={setMes} disabled={ano === 'todos'}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {MESES.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Crédito sugerido" value={brl(d.creditoSugerido)} subtitle="aguardando homologação" icon={TrendingUp} variant="primary" />
        <StatCard title="Imposto a pagar" value={brl(d.impostoAPagar.total)} subtitle="débito − crédito do período" icon={Receipt} />
        <StatCard title="Lacuna no SPED" value={brl(d.lacunaSped)} subtitle="crédito não escriturado" icon={FileWarning} />
        <StatCard title="Delta reforma" value={brl(d.deltaReforma)} subtitle="CBS/IBS vs. legado" icon={ArrowLeftRight} variant="accent" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Crédito vs. débito por competência</CardTitle>
          </CardHeader>
          <CardContent>
            {d.serie.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={d.serie} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => brl(value)}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="debito" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} name="Débito (a pagar)" />
                  <Bar dataKey="credito" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Crédito" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="Sem apurações no período"
                description="Importe documentos (Bling, SEFAZ ou XML) e rode a apuração em Apurações → Imposto a pagar."
              />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Apurações recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {apur.length > 0 ? (
              apur.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{a.item}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {a.documento} · {a.tributo}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold">{brl(a.valorCredito)}</span>
                    <StatusPill status={a.status} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="Sem apurações" description="Importe documentos ou sincronize a SEFAZ." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
