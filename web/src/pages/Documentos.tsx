import { useEffect, useMemo, useState } from 'react';
import { FileText, Receipt, ShieldCheck, Coins, RefreshCw, FileX, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import ResumoCst, { type ResumoCstData } from '@/components/ResumoCst';
import StatCard from '@/components/StatCard';
import TablePagination, { PAGE_SIZE } from '@/components/TablePagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  cbs: number; // CBS destacado (reforma 2026)
  ibs: number; // IBS destacado (UF + município)
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
  const [baixando, setBaixando] = useState<string | null>(null);
  // Filtros de texto (client-side, dentro do período carregado) + paginação.
  const [buscaContraparte, setBuscaContraparte] = useState('');
  const [buscaNumero, setBuscaNumero] = useState('');
  const [pagina, setPagina] = useState(1);

  async function baixarXml(d: Documento) {
    setBaixando(`${d.id}:xml`);
    try {
      await api.baixarDocumentoXml(d.id, d.chaveAcesso);
    } catch (e) {
      toast.error((e as Error).message || 'Não foi possível baixar o XML.');
    } finally {
      setBaixando(null);
    }
  }

  async function baixarPdf(d: Documento) {
    setBaixando(`${d.id}:pdf`);
    try {
      await api.baixarDocumentoPdf(d.id, d.chaveAcesso);
    } catch (e) {
      toast.error((e as Error).message || 'Não foi possível gerar o PDF.');
    } finally {
      setBaixando(null);
    }
  }

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
  const filtrados = useMemo(() => {
    const txt = buscaContraparte.trim().toLowerCase();
    const num = buscaNumero.trim();
    return docs.filter((d) => {
      if (filtro !== 'Todos' && d.modelo !== filtro) return false;
      if (txt) {
        // entrada filtra pelo emitente; saída, pelo destinatário (nome + CNPJ)
        const nome = ehEntrada ? d.emitente : d.destinatario;
        const cnpj = ehEntrada ? d.cnpjEmitente : d.cnpjDestinatario;
        if (!`${nome ?? ''} ${cnpj ?? ''}`.toLowerCase().includes(txt)) return false;
      }
      if (num && !(d.numero ?? '').includes(num)) return false;
      return true;
    });
  }, [docs, filtro, buscaContraparte, buscaNumero, ehEntrada]);

  // qualquer mudança de filtro/período volta para a 1ª página
  useEffect(() => {
    setPagina(1);
  }, [filtro, buscaContraparte, buscaNumero, ano, mes, tipo]);

  const paginados = useMemo(
    () => filtrados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE),
    [filtrados, pagina],
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
        <CardHeader className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="shrink-0 text-sm font-semibold">
            {ehEntrada ? 'Notas de entrada' : 'Notas de saída'}
          </CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={buscaContraparte}
                onChange={(e) => setBuscaContraparte(e.target.value)}
                placeholder={ehEntrada ? 'Buscar emitente…' : 'Buscar destinatário…'}
                className="h-9 w-full pl-8 sm:w-[220px]"
              />
            </div>
            <Input
              value={buscaNumero}
              onChange={(e) => setBuscaNumero(e.target.value)}
              placeholder="Nº da nota"
              inputMode="numeric"
              className="h-9 w-full sm:w-[130px]"
            />
            <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
              <TabsList>
                {filtros.map((f) => (
                  <TabsTrigger key={f} value={f}>
                    {f}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
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
                    <TableHead className="text-right">CBS</TableHead>
                    <TableHead className="text-right">IBS</TableHead>
                    <TableHead className="text-center">Arquivos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginados.map((d) => (
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
                      <TableCell className="text-right tabular-nums">{brl(d.cbs ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(d.ibs ?? 0)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            title="Baixar XML"
                            disabled={baixando === `${d.id}:xml`}
                            onClick={() => baixarXml(d)}
                          >
                            {baixando === `${d.id}:xml` ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            <span className="ml-1 text-xs">XML</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            title="Baixar PDF (DANFE/DACTE)"
                            disabled={baixando === `${d.id}:pdf`}
                            onClick={() => baixarPdf(d)}
                          >
                            {baixando === `${d.id}:pdf` ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                            <span className="ml-1 text-xs">PDF</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination page={pagina} total={filtrados.length} onPageChange={setPagina} />
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
