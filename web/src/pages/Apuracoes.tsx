import { useEffect, useState } from 'react';
import { Calculator, RefreshCw, Receipt } from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import StatusPill from '@/components/StatusPill';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

import { toast } from 'sonner';
import { brl } from '@/lib/format';
import { useEmpresa } from '@/lib/empresa-context';
import { api, type ImpostoTipo } from '@/lib/api';

interface Apuracao {
  id: string;
  documento: string;
  item: string;
  tributo: string;
  creditoPermitido: boolean;
  valorCredito: number;
  baseLegal: string;
  status: 'SUGERIDO' | 'HOMOLOGADO' | 'GLOSADO';
  origem: string;
}

interface ResultadoImposto {
  imposto: string;
  competencia: string;
  debito: number;
  credito: number;
  saldoCredorAnterior: number;
  aRecolher: number;
  saldoCredorTransportar: number;
}

const IMPOSTOS: Array<{ label: string; value: ImpostoTipo }> = [
  { label: 'ICMS', value: 'icms' },
  { label: 'IPI', value: 'ipi' },
  { label: 'PIS/COFINS', value: 'pis-cofins' },
  { label: 'ISS', value: 'iss' },
];

export default function Apuracoes() {
  const { empresaId } = useEmpresa();

  // ---- Aba Créditos ----
  const [creditos, setCreditos] = useState<Apuracao[]>([]);
  const [carregandoCreditos, setCarregandoCreditos] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregandoCreditos(true);
      try {
        const dados = (await api.apuracoes()) as Apuracao[];
        if (ativo) setCreditos(dados);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha ao carregar os créditos.');
      } finally {
        if (ativo) setCarregandoCreditos(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  // ---- Aba Imposto a pagar ----
  const [tipo, setTipo] = useState<ImpostoTipo>('icms');
  const [ano, setAno] = useState(2026);
  const [mes, setMes] = useState(2);
  const [apurando, setApurando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImposto | null>(null);

  async function apurar() {
    if (!empresaId) {
      toast.error('Selecione uma empresa no topo da página antes de apurar.');
      return;
    }
    setApurando(true);
    try {
      const r = (await api.apurarImposto(tipo, empresaId, ano, mes)) as ResultadoImposto;
      setResultado(r);
      toast.success(`Apuração de ${r.imposto} concluída para ${r.competencia}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao apurar o imposto.');
    } finally {
      setApurando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apurações"
        description="Créditos de entrada e apuração do imposto a pagar por competência."
      />

      <Tabs defaultValue="creditos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="creditos">Créditos</TabsTrigger>
          <TabsTrigger value="imposto">Imposto a pagar</TabsTrigger>
        </TabsList>

        {/* ===================== CRÉDITOS ===================== */}
        <TabsContent value="creditos" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Créditos apurados</CardTitle>
                  <CardDescription>
                    Itens de documentos de entrada com crédito sugerido, homologado ou glosado.
                  </CardDescription>
                </div>
                {carregandoCreditos && (
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!carregandoCreditos && creditos.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="Nenhum crédito apurado"
                  description="Importe documentos de entrada ou sincronize com a SEFAZ para gerar créditos."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Documento</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Tributo</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-right">Crédito</TableHead>
                        <TableHead>Base legal</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditos.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.documento}</TableCell>
                          <TableCell>{c.item}</TableCell>
                          <TableCell className="font-semibold">{c.tributo}</TableCell>
                          <TableCell>{c.origem}</TableCell>
                          <TableCell className="text-right">{brl(c.valorCredito)}</TableCell>
                          <TableCell
                            className="max-w-[220px] truncate text-muted-foreground"
                            title={c.baseLegal}
                          >
                            {c.baseLegal}
                          </TableCell>
                          <TableCell>
                            <StatusPill status={c.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== IMPOSTO A PAGAR ===================== */}
        <TabsContent value="imposto" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Apurar imposto da competência</CardTitle>
              <CardDescription>
                Selecione o imposto e a competência para calcular o saldo a recolher.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="imposto">Imposto</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as ImpostoTipo)}>
                    <SelectTrigger id="imposto">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPOSTOS.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ano">Ano</Label>
                  <Input
                    id="ano"
                    type="number"
                    value={ano}
                    onChange={(e) => setAno(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mes">Mês</Label>
                  <Input
                    id="mes"
                    type="number"
                    min={1}
                    max={12}
                    value={mes}
                    onChange={(e) => setMes(Number(e.target.value))}
                  />
                </div>

                <div className="flex items-end">
                  <Button onClick={apurar} disabled={apurando} className="w-full md:w-auto">
                    {apurando ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Calculator className="mr-2 h-4 w-4" />
                    )}
                    Apurar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {resultado && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {resultado.imposto} — {resultado.competencia}
                </CardTitle>
                <CardDescription>Resultado da apuração da competência.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    A recolher
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">
                    {brl(resultado.aRecolher)}
                  </p>
                </div>

                <Separator />

                <dl className="space-y-3">
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-muted-foreground">Débito</dt>
                    <dd className="text-sm font-medium tabular-nums">{brl(resultado.debito)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-muted-foreground">Crédito</dt>
                    <dd className="text-sm font-medium tabular-nums">{brl(resultado.credito)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-muted-foreground">Saldo credor anterior</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {brl(resultado.saldoCredorAnterior)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-muted-foreground">Saldo credor a transportar</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {brl(resultado.saldoCredorTransportar)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
