import { useEffect, useMemo, useState } from 'react';
import { FileText, Receipt, ShieldCheck, Coins, RefreshCw, FileX } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { api } from '@/lib/api';
import { brl, cnpjMask, dataBR, mesAtualSP } from '@/lib/format';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type Modelo = 'NF-e' | 'CT-e' | 'NFS-e';
type TipoOperacao = 'ENTRADA' | 'SAIDA';
type FiltroTipo = TipoOperacao | 'todas';

interface Documento {
  id: string;
  chaveAcesso: string;
  modelo: Modelo;
  tipoOperacao: TipoOperacao;
  emitente: string;
  cnpjEmitente: string;
  dataEmissao: string;
  valor: number;
  creditoIcms: number;
  creditoPisCofins: number;
}

type Filtro = 'Todos' | Modelo;

const FILTROS: Filtro[] = ['Todos', 'NF-e', 'CT-e', 'NFS-e'];

const COMP_ATUAL = mesAtualSP(); // 'YYYY-MM' no fuso de São Paulo
const ANO_ATUAL = Number(COMP_ATUAL.slice(0, 4));
const ANOS = [ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2, ANO_ATUAL - 3];

const TITULO_TIPO: Record<FiltroTipo, string> = {
  ENTRADA: 'Notas de entrada (compras)',
  SAIDA: 'Notas de saída (vendas)',
  todas: 'Todas as notas',
};

export default function Documentos() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  // Entrada (compras) por padrão — é a base dos créditos. Saída = vendas (débito).
  const [tipo, setTipo] = useState<FiltroTipo>('ENTRADA');
  // Filtro de período igual ao Painel: 'todos' = sem filtro. Default = ano e mês atuais.
  const [ano, setAno] = useState<string>(String(ANO_ATUAL));
  const [mes, setMes] = useState<string>(String(Number(COMP_ATUAL.slice(5, 7))));

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    const anoNum = ano === 'todos' ? undefined : Number(ano);
    const mesNum = mes === 'todos' ? undefined : Number(mes);
    api
      .documentos(anoNum, mesNum, tipo === 'todas' ? undefined : tipo)
      .then((d) => {
        if (ativo) setDocs(d as Documento[]);
      })
      .catch(() => {
        if (ativo) setDocs([]);
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, [ano, mes, tipo]);

  const totais = useMemo(() => {
    return docs.reduce(
      (acc, d) => {
        acc.valor += d.valor;
        acc.icms += d.creditoIcms;
        acc.pisCofins += d.creditoPisCofins;
        return acc;
      },
      { valor: 0, icms: 0, pisCofins: 0 },
    );
  }, [docs]);

  const filtrados = useMemo(
    () => (filtro === 'Todos' ? docs : docs.filter((d) => d.modelo === filtro)),
    [docs, filtro],
  );

  const mostraCredito = tipo !== 'SAIDA'; // saídas não geram crédito de entrada
  const periodoLabel =
    ano === 'todos' ? 'todos os períodos' : mes === 'todos' ? ano : `${MESES[Number(mes) - 1]}/${ano}`;

  return (
    <div>
      <PageHeader
        title="Documentos"
        description="Notas fiscais de entrada (compras) e de saída (vendas), capturadas ou importadas."
      >
        <Select value={tipo} onValueChange={(v) => setTipo(v as FiltroTipo)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ENTRADA">Entrada</SelectItem>
            <SelectItem value="SAIDA">Saída</SelectItem>
            <SelectItem value="todas">Entrada e saída</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={ano}
          onValueChange={(v) => {
            setAno(v);
            if (v === 'todos') setMes('todos');
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os anos</SelectItem>
            {ANOS.map((a) => (
              <SelectItem key={a} value={String(a)}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mes} onValueChange={setMes} disabled={ano === 'todos'}>
          <SelectTrigger className="w-[140px]">
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
        <StatCard title="Documentos" value={docs.length} subtitle="no período/tipo selecionado" icon={FileText} />
        <StatCard title="Valor total" value={brl(totais.valor)} subtitle="soma das notas" icon={Receipt} variant="primary" />
        <StatCard
          title="Crédito ICMS"
          value={mostraCredito ? brl(totais.icms) : '—'}
          subtitle={mostraCredito ? 'potencial sobre entradas' : 'só em notas de entrada'}
          icon={ShieldCheck}
        />
        <StatCard
          title="Crédito PIS/COFINS"
          value={mostraCredito ? brl(totais.pisCofins) : '—'}
          subtitle={mostraCredito ? 'potencial sobre entradas' : 'só em notas de entrada'}
          icon={Coins}
          variant="accent"
        />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-semibold">{TITULO_TIPO[tipo]}</CardTitle>
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <TabsList>
              {FILTROS.map((f) => (
                <TabsTrigger key={f} value={f}>
                  {f}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Carregando documentos…
            </div>
          ) : filtrados.length === 0 ? (
            <EmptyState
              icon={FileX}
              title="Nenhum documento"
              description={
                tipo === 'SAIDA'
                  ? `Nenhuma nota de saída em ${periodoLabel}. Importe pelo Bling ("Bling (saídas)") ou em "Importar XML", ou troque o período.`
                  : ano !== 'todos'
                    ? `Nenhuma nota de entrada${filtro === 'Todos' ? '' : ` (${filtro})`} em ${periodoLabel}. Troque o período, ou capture na SEFAZ / importe um XML.`
                    : 'Capture na SEFAZ ou importe um XML para começar.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>{tipo === 'SAIDA' ? 'Destinatário' : 'Emitente'}</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Créd. ICMS</TableHead>
                    <TableHead className="text-right">Créd. PIS/COFINS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Badge variant={d.tipoOperacao === 'SAIDA' ? 'secondary' : 'default'}>
                          {d.tipoOperacao === 'SAIDA' ? 'Saída' : 'Entrada'}
                        </Badge>
                      </TableCell>
                      <TableCell>{d.modelo}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{d.emitente}</div>
                        <div className="text-xs text-muted-foreground">{cnpjMask(d.cnpjEmitente)}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground" title={d.chaveAcesso}>
                          {(d.chaveAcesso ?? '').slice(0, 12)}…
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{dataBR(d.dataEmissao)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{brl(d.valor)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.tipoOperacao === 'SAIDA' ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          brl(d.creditoIcms)
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.tipoOperacao === 'SAIDA' ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          brl(d.creditoPisCofins)
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
