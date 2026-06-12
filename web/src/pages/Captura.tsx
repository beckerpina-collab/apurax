import { useEffect, useState } from 'react';
import { DownloadCloud, RefreshCw, ShieldCheck, FileText, Hash } from 'lucide-react';
import { toast } from 'sonner';

import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import StatusPill from '@/components/StatusPill';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

import { api } from '@/lib/api';
import { useEmpresa } from '@/lib/empresa-context';
import { dataHoraBR } from '@/lib/format';

type ModeloSync = 'NFE' | 'CTE';

interface Cursor {
  modelo: ModeloSync;
  ultimoNSU: string;
  maxNSU: string;
  ultimaConsulta: string;
  status: 'ativo' | 'inativo';
}

interface ResultadoSync {
  modelo: ModeloSync;
  documentosNovos: number;
  ultimoNSU: string;
  maxNSU: string;
  cStat: string;
  mensagem: string;
}

export default function Captura() {
  const { empresaId } = useEmpresa();

  const [cursores, setCursores] = useState<Cursor[]>([]);
  const [carregandoCursores, setCarregandoCursores] = useState(true);
  const [sincronizando, setSincronizando] = useState<ModeloSync | null>(null);
  const [resultado, setResultado] = useState<ResultadoSync | null>(null);

  async function carregarCursores() {
    setCarregandoCursores(true);
    try {
      const lista = (await api.cursores()) as Cursor[];
      setCursores(lista);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar os cursores de NSU.');
    } finally {
      setCarregandoCursores(false);
    }
  }

  useEffect(() => {
    carregarCursores();
  }, []);

  async function sincronizar(modelo: ModeloSync) {
    if (!empresaId) {
      toast.error('Selecione a empresa no topo antes de capturar na SEFAZ.');
      return;
    }
    setSincronizando(modelo);
    try {
      const r = (await api.sincronizarSefaz(empresaId, modelo)) as Omit<ResultadoSync, 'modelo'>;
      setResultado({ ...r, modelo });
      toast.success(r.mensagem);
      await carregarCursores();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha na captura junto à SEFAZ.');
    } finally {
      setSincronizando(null);
    }
  }

  const rotuloModelo = resultado?.modelo === 'CTE' ? 'CT-e' : 'NF-e';

  return (
    <>
      <PageHeader
        title="Captura SEFAZ"
        description="Download automático de NF-e e CT-e de entrada direto na SEFAZ, via certificado A1."
      >
        <Button variant="outline" onClick={() => sincronizar('NFE')} disabled={sincronizando !== null}>
          {sincronizando === 'NFE' ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <DownloadCloud className="mr-2 h-4 w-4" />
          )}
          Sincronizar NF-e
        </Button>
        <Button onClick={() => sincronizar('CTE')} disabled={sincronizando !== null}>
          {sincronizando === 'CTE' ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <DownloadCloud className="mr-2 h-4 w-4" />
          )}
          Sincronizar CT-e
        </Button>
      </PageHeader>

      <Alert className="mb-6">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Captura segura via Distribuição DFe</AlertTitle>
        <AlertDescription>
          A captura usa o certificado A1 cadastrado em Configuração e respeita o controle de NSU
          (consulta sempre a partir do último NSU recebido). Isso evita o cStat 656 — bloqueio por
          consumo indevido do serviço de Distribuição DFe da SEFAZ.
        </AlertDescription>
      </Alert>

      {resultado && (
        <div className="mb-6">
          <div className="mb-3 text-sm font-medium text-muted-foreground">
            Última sincronização ({rotuloModelo})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Documentos novos"
              value={resultado.documentosNovos}
              subtitle={`${rotuloModelo} de entrada capturadas`}
              icon={FileText}
              variant="primary"
            />
            <StatCard
              title="Último NSU"
              value={resultado.ultimoNSU}
              subtitle="Posição atual do cursor"
              icon={Hash}
            />
            <StatCard
              title="Máx NSU"
              value={resultado.maxNSU}
              subtitle="Maior NSU disponível na SEFAZ"
              icon={Hash}
            />
            <StatCard
              title="cStat"
              value={resultado.cStat}
              subtitle="Código de status do retorno"
              icon={ShieldCheck}
              variant="accent"
            />
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cursores de NSU</CardTitle>
          <CardDescription>
            Controle de leitura por modelo de documento — o NSU garante que cada documento seja
            baixado uma única vez.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {carregandoCursores ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Carregando cursores…
            </div>
          ) : cursores.length === 0 ? (
            <EmptyState
              icon={DownloadCloud}
              title="Nenhum cursor de captura"
              description="Sincronize NF-e ou CT-e para iniciar o controle de NSU desta empresa."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Último NSU</TableHead>
                  <TableHead>Máx NSU</TableHead>
                  <TableHead>Última consulta</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cursores.map((c) => (
                  <TableRow key={c.modelo}>
                    <TableCell className="font-medium">{c.modelo === 'CTE' ? 'CT-e' : 'NF-e'}</TableCell>
                    <TableCell className="font-mono text-xs">{c.ultimoNSU}</TableCell>
                    <TableCell className="font-mono text-xs">{c.maxNSU}</TableCell>
                    <TableCell>{dataHoraBR(c.ultimaConsulta)}</TableCell>
                    <TableCell>
                      <StatusPill status={(c.status ?? 'inativo').toUpperCase()} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
