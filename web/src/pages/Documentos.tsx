import { useEffect, useMemo, useState } from 'react';
import { FileText, Receipt, ShieldCheck, Coins, RefreshCw, FileX } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import ResumoCst, { type ResumoCstData } from '@/components/ResumoCst';
import StatCard from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { api } from '@/lib/api';
import { brl, cnpjMask, dataBR, mesAtualSP } from '@/lib/format';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type Modelo = 'NF-e' | 'CT-e' | 'NFS-e';
type TipoOperacao = 'ENTRADA' | 'SAIDA';

interface Documento {
  id: string;
  chaveAcesso: string;
  modelo: Modelo;
  numero: string;
  serie: string;
  tipoOperacao: TipoOperacao;
  emitente: string;
  cnpjEmitente: string;
  destinatario: string;
  cnpjDestinatario: string;
  dataEmissao: string;
  valor: number;
  creditoIcms: number;
  creditoPisCofins: number;
  bcIcms: number; // base de cálculo do ICMS (soma dos itens)
  icms: number; // ICMS próprio (soma dos itens) — débito na saída
  pis: number; // PIS (soma dos itens)
  cofins: number; // COFINS (soma dos itens)
}

type Filtro = 'Todos' | Modelo;

// Entrada aceita NF-e/CT-e/NFS-e; saída, na prática, NF-e.
const FILTROS_ENTRADA: Filtro[] = ['Todos', 'NF-e', 'CT-e', 'NFS-e'];
const FILTROS_SAIDA: Filtro[] = ['Todos', 'NF-e'];

const COMP_ATUAL = mesAtualSP(); // 'YYYY-MM' no fuso de São Paulo
const ANO_ATUAL = Number(COMP_ATUAL.slice(0, 4));
const ANOS = [ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2, ANO_ATUAL - 3];

/** Lista de documentos fiscais de um tipo fixo (Entrada ou Saída) — usado por duas rotas. */
export default function Documentos({ tipo }: { tipo: TipoOperacao }) {
  const ehEntrada = tipo === 'ENTRADA';
  const [docs, setDocs] = useState<Documento[]>([]);
  const [resumoCst, setResumoCst] = useState<ResumoCstData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  // Filtro de período igual ao Painel: 'todos' = sem filtro. Default = ano e mês atuais.
  const [ano, setAno] = useState<string>(String(ANO_ATUAL));
  const [mes, setMes] = useState<string>(String(Number(COMP_ATUAL.slice(5, 7))));

  // ao trocar de aba (entrada/saída), o filtro de modelo volta p/ "Todos"
  useEffect(() => {
    setFiltro('Todos');
  }, [tipo]);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    const anoNum = ano === 'todos' ? undefined : Number(ano);
    const mesNum = mes === 'todos' ? undefined : Number(mes);
    api
      .documentos(anoNum, mesNum, tipo)
      .then((r) => {
        if (!ativo) return;
        const resp = r as { documentos: Documento[]; resumoCst: ResumoCstData };
        setDocs(resp.documentos ?? []);
        setResumoCst(resp.resumoCst ?? null);
      })
      .catch(() => {
        if (ativo) {
          setDocs([]);
          setResumoCst(null);
        }
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
        acc.valor += d.valor ?? 0;
        acc.credIcms += d.creditoIcms ?? 0;
        acc.credPisCofins += d.creditoPisCofins ?? 0;
        acc.bcIcms += d.bcIcms ?? 0;
        acc.icms += d.icms ?? 0;
        return acc;
      },
      { valor: 0, credIcms: 0, credPisCofins: 0, bcIcms: 0, icms: 0 },
    );
  }, [docs]);

  const filtros = ehEntrada ? FILTROS_ENTRADA : FILTROS_SAIDA;
  const filtrados = useMemo(
    () => (filtro === 'Todos' ? docs : docs.filter((d) => d.modelo === filtro)),
    [docs, filtro],
  );

  const periodoLabel =
    ano === 'todos' ? 'todos os períodos' : mes === 'todos' ? ano : `${MESES[Number(mes) - 1]}/${ano}`;

  return (
    <div>
      <PageHeader
        title={ehEntrada ? 'Documentos de Entrada' : 'Documentos de Saída'}
        description={
          ehEntrada
            ? 'NF-e, NFC-e e CT-e de entrada (compras) — base dos créditos.'
            : 'NF-e de saída (vendas) — base do imposto a pagar.'
        }
      >
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
            {ANOS.map((a) => (
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
        <StatCard title="Documentos" value={docs.length} subtitle="no período selecionado" icon={FileText} />
        <StatCard title="Valor total" value={brl(totais.valor)} subtitle="soma das notas" icon={Receipt} variant="primary" />
        {ehEntrada ? (
          <>
            <StatCard title="Crédito ICMS" value={brl(totais.credIcms)} subtitle="potencial sobre entradas" icon={ShieldCheck} />
            <StatCard
              title="Crédito PIS/COFINS"
              value={brl(totais.credPisCofins)}
              subtitle="potencial sobre entradas"
              icon={Coins}
              variant="accent"
            />
          </>
        ) : (
          <>
            <StatCard title="BC ICMS" value={brl(totais.bcIcms)} subtitle="base de cálculo (saídas)" icon={ShieldCheck} />
            <StatCard title="ICMS de saída" value={brl(totais.icms)} subtitle="débito de ICMS" icon={Coins} variant="accent" />
          </>
        )}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-semibold">
            {ehEntrada ? 'Notas de entrada' : 'Notas de saída'}
          </CardTitle>
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <TabsList>
              {filtros.map((f) => (
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
                ehEntrada
                  ? ano !== 'todos'
                    ? `Nenhuma nota de entrada${filtro === 'Todos' ? '' : ` (${filtro})`} em ${periodoLabel}. Troque o período, ou capture na SEFAZ / importe um XML.`
                    : 'Capture na SEFAZ ou importe um XML para começar.'
                  : ano !== 'todos'
                    ? `Nenhuma nota de saída em ${periodoLabel}. Importe pelo Bling ("Bling (saídas)") ou em "Importar XML", ou troque o período.`
                    : 'Importe suas vendas pelo Bling ("Bling (saídas)") ou por "Importar XML".'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>{ehEntrada ? 'Emitente' : 'Destinatário'}</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">BC ICMS</TableHead>
                    <TableHead className="text-right">ICMS</TableHead>
                    <TableHead className="text-right">PIS</TableHead>
                    <TableHead className="text-right">COFINS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.modelo}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="font-medium">{d.numero || '—'}</span>
                        {d.serie ? <span className="text-xs text-muted-foreground"> · sér. {d.serie}</span> : null}
                      </TableCell>
                      <TableCell>
                        {ehEntrada ? (
                          <>
                            <div className="font-medium text-foreground">{d.emitente}</div>
                            <div className="text-xs text-muted-foreground">{cnpjMask(d.cnpjEmitente)}</div>
                          </>
                        ) : (
                          <>
                            <div className="font-medium text-foreground">{d.destinatario || '— (reimporte p/ ver o nome)'}</div>
                            <div className="text-xs text-muted-foreground">{cnpjMask(d.cnpjDestinatario) || '—'}</div>
                          </>
                        )}
                        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground" title={d.chaveAcesso}>
                          {(d.chaveAcesso ?? '').slice(0, 12)}…
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{dataBR(d.dataEmissao)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{brl(d.valor)}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(d.bcIcms ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(d.icms ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(d.pis ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(d.cofins ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <ResumoCst
          data={resumoCst}
          titulo={`Resumo CST — PIS e COFINS (${ehEntrada ? 'entradas' : 'saídas'})`}
        />
      </div>
    </div>
  );
}
