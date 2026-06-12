import { useEffect, useMemo, useState } from 'react';
import { FileText, Receipt, ShieldCheck, Coins, RefreshCw, FileX } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { api } from '@/lib/api';
import { brl, cnpjMask, dataBR } from '@/lib/format';

type Modelo = 'NF-e' | 'CT-e' | 'NFS-e';

interface DocumentoEntrada {
  id: string;
  chaveAcesso: string;
  modelo: Modelo;
  emitente: string;
  cnpjEmitente: string;
  dataEmissao: string;
  valor: number;
  creditoIcms: number;
  creditoPisCofins: number;
  origem: 'SEFAZ' | 'XML' | 'SPED';
}

type Filtro = 'Todos' | Modelo;

const FILTROS: Filtro[] = ['Todos', 'NF-e', 'CT-e', 'NFS-e'];

export default function Documentos() {
  const [docs, setDocs] = useState<DocumentoEntrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('Todos');

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    api
      .documentos()
      .then((d) => {
        if (ativo) setDocs(d as DocumentoEntrada[]);
      })
      .catch(() => undefined)
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

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

  return (
    <div>
      <PageHeader
        title="Documentos de entrada"
        description="NF-e, CT-e e NFS-e capturados ou importados — base dos créditos."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Documentos" value={docs.length} subtitle="capturados ou importados" icon={FileText} />
        <StatCard title="Valor total" value={brl(totais.valor)} subtitle="soma das notas" icon={Receipt} variant="primary" />
        <StatCard title="Crédito ICMS" value={brl(totais.icms)} subtitle="potencial sobre entradas" icon={ShieldCheck} />
        <StatCard title="Crédito PIS/COFINS" value={brl(totais.pisCofins)} subtitle="potencial sobre entradas" icon={Coins} variant="accent" />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-semibold">Notas de entrada</CardTitle>
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
                filtro === 'Todos'
                  ? 'Sincronize a SEFAZ ou importe um XML para começar a capturar créditos.'
                  : `Nenhum documento do modelo ${filtro} encontrado.`
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Emitente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Créd. ICMS</TableHead>
                    <TableHead className="text-right">Créd. PIS/COFINS</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Badge>{d.modelo}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{d.emitente}</div>
                        <div className="text-xs text-muted-foreground">{cnpjMask(d.cnpjEmitente)}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground" title={d.chaveAcesso}>
                          {d.chaveAcesso.slice(0, 12)}…
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{dataBR(d.dataEmissao)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{brl(d.valor)}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(d.creditoIcms)}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(d.creditoPisCofins)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{d.origem}</Badge>
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
