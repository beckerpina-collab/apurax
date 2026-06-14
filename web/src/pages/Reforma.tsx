import { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import TablePagination, { PAGE_SIZE } from '@/components/TablePagination';

import { api } from '@/lib/api';
import { brl, pct } from '@/lib/format';
import { useEmpresa } from '@/lib/empresa-context';

interface ItemReforma {
  item: string;
  creditoLegado: string | number;
  creditoNovoPotencial: string | number;
  deltaPotencial: string | number;
  pctGanho: number | null;
  alertas: string[];
}

interface ResultadoReforma {
  totais: {
    creditoLegado: string | number;
    creditoNovoEfetivo2026: string | number;
    creditoNovoPotencial: string | number;
    deltaPotencial: string | number;
  };
  itens: ItemReforma[];
}

export default function Reforma() {
  const { empresaId } = useEmpresa();
  const [xml, setXml] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<ResultadoReforma | null>(null);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    setPagina(1);
  }, [res]);

  async function comparar() {
    if (!empresaId) {
      toast.warning('Selecione uma empresa no topo antes de comparar.');
      return;
    }
    if (!xml.trim()) {
      toast.warning('Cole o XML da NF-e para comparar.');
      return;
    }
    setCarregando(true);
    try {
      const r = (await api.compararReforma(empresaId, xml)) as ResultadoReforma;
      setRes(r);
      toast.success('Comparação concluída.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao comparar a NF-e.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reforma CBS/IBS"
        description="Compare o crédito no modelo legado vs. CBS/IBS para uma NF-e."
      >
        <ArrowLeftRight className="h-6 w-6 text-primary" />
      </PageHeader>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>2026 é fase de teste da reforma</AlertTitle>
        <AlertDescription>
          Em 2026 a CBS/IBS roda com alíquotas simbólicas (período de transição). Por isso o
          crédito efetivo do ano é baixo. O valor "potencial" projeta o crédito usando a alíquota
          de referência, para dimensionar o impacto quando o novo modelo estiver pleno.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>XML da NF-e</CardTitle>
          <CardDescription>
            Cole o XML da nota de entrada (modelo 55) e clique em Comparar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!empresaId && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Nenhuma empresa selecionada</AlertTitle>
              <AlertDescription>
                Selecione a empresa no topo para habilitar a comparação.
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="xml-reforma">XML da NF-e</Label>
            <Textarea
              id="xml-reforma"
              rows={12}
              value={xml}
              onChange={(e) => setXml(e.target.value)}
              placeholder='<?xml version="1.0"?><nfeProc>... cole aqui o XML da NF-e de entrada ...</nfeProc>'
              className="font-mono text-xs"
            />
          </div>
          <Button onClick={comparar} disabled={carregando}>
            {carregando ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Comparando...
              </>
            ) : (
              <>
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Comparar
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {res ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Crédito legado"
              value={brl(res.totais.creditoLegado)}
              subtitle="Modelo atual (ICMS/PIS/COFINS)"
              icon={Scale}
            />
            <StatCard
              title="CBS/IBS efetivo 2026"
              value={brl(res.totais.creditoNovoEfetivo2026)}
              subtitle="Alíquotas simbólicas de transição"
              icon={Info}
            />
            <StatCard
              title="CBS/IBS potencial"
              value={brl(res.totais.creditoNovoPotencial)}
              subtitle="Alíquota de referência (modelo pleno)"
              icon={Sparkles}
              variant="primary"
            />
            <StatCard
              title="Delta potencial"
              value={brl(res.totais.deltaPotencial)}
              subtitle="Ganho vs. modelo legado"
              icon={TrendingUp}
              variant="accent"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Comparativo por item</CardTitle>
              <CardDescription>
                Crédito legado x crédito potencial CBS/IBS, item a item.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Crédito legado</TableHead>
                    <TableHead className="text-right">Crédito novo potencial</TableHead>
                    <TableHead className="text-right">Delta</TableHead>
                    <TableHead className="text-right">% ganho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {res.itens
                    .slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)
                    .map((it, idx) => (
                      <TableRow key={`${it.item}-${idx}`}>
                        <TableCell className="font-medium">{it.item}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(it.creditoLegado)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(it.creditoNovoPotencial)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(it.deltaPotencial)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(it.pctGanho)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <TablePagination page={pagina} total={res.itens.length} onPageChange={setPagina} />

              {res.itens.some((it) => it.alertas && it.alertas.length > 0) && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Alertas por item</h3>
                  {res.itens
                    .filter((it) => it.alertas && it.alertas.length > 0)
                    .map((it, idx) => (
                      <div key={`alertas-${it.item}-${idx}`} className="rounded-lg border p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge variant="secondary">{it.item}</Badge>
                        </div>
                        <ul className="space-y-1">
                          {it.alertas.map((a, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-muted-foreground"
                            >
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={ArrowLeftRight}
          title="Nenhuma comparação ainda"
          description="Cole o XML de uma NF-e de entrada e clique em Comparar para ver o crédito legado vs. CBS/IBS."
        />
      )}
    </div>
  );
}
