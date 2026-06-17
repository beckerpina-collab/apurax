import { useEffect, useState } from 'react';
import { DownloadCloud, RefreshCw, ShieldCheck, FileText, Hash, Stamp } from 'lucide-react';
import { toast } from 'sonner';

import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import StatusPill from '@/components/StatusPill';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

import { api } from '@/lib/api';
import { useEmpresa } from '@/lib/empresa-context';
import { dataHoraBR, mesAtualSP } from '@/lib/format';

// Período pré-filtrado p/ a captura de NFC-e (SP) = mês atual no fuso de São Paulo.
const COMP_SP = mesAtualSP();
const NFCE_INI = `${COMP_SP}-01`;
const NFCE_FIM = `${COMP_SP}-${String(
  new Date(Number(COMP_SP.slice(0, 4)), Number(COMP_SP.slice(5, 7)), 0).getDate(),
).padStart(2, '0')}`;

interface StatusNfce {
  estado: 'capturando' | 'concluida' | 'erro';
  periodo: string;
  ambiente: string;
  chavesEncontradas: number;
  importadas: number;
  jaImportadas: number;
  semXml: number;
  erros: number;
  cStat?: string;
  mensagem?: string;
  atualizadoEm: string;
}

type TipoEvento = '210210' | '210200' | '210220' | '210240';
const EVENTOS: { value: TipoEvento; label: string; dica: string }[] = [
  { value: '210210', label: 'Ciência da Operação', dica: 'Libera o download do XML completo na próxima sincronização.' },
  { value: '210200', label: 'Confirmação da Operação', dica: 'Confirma que a compra/operação ocorreu (conclusivo).' },
  { value: '210220', label: 'Desconhecimento da Operação', dica: 'Você não reconhece esta operação (conclusivo).' },
  { value: '210240', label: 'Operação não Realizada', dica: 'A operação não se concretizou — exige justificativa.' },
];

interface ResultadoManif {
  ok: boolean;
  cStat: string;
  xMotivo: string;
  mensagem: string;
}

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

  // Captura de NFC-e (SEFAZ-SP / SAE)
  const [dataIniNfce, setDataIniNfce] = useState(NFCE_INI);
  const [dataFimNfce, setDataFimNfce] = useState(NFCE_FIM);
  const [capturandoNfce, setCapturandoNfce] = useState(false);
  const [statusNfce, setStatusNfce] = useState<StatusNfce | null>(null);

  async function capturarNfce() {
    if (!empresaId) {
      toast.error('Selecione uma empresa no topo da página antes de capturar.');
      return;
    }
    setCapturandoNfce(true);
    try {
      const r = (await api.capturarNfceSp(empresaId, dataIniNfce, dataFimNfce)) as {
        captura?: StatusNfce;
        observacao?: string;
      };
      setStatusNfce(r.captura ?? null);
      toast.success(r.observacao ?? 'Captura de NFC-e (SP) iniciada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao capturar NFC-e (SP).');
    } finally {
      setCapturandoNfce(false);
    }
  }

  async function atualizarStatusNfce() {
    if (!empresaId) return;
    try {
      setStatusNfce((await api.statusNfceSp(empresaId)) as StatusNfce | null);
    } catch {
      /* status é informativo — silencioso */
    }
  }

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

  // ---- Manifestação do destinatário (NF-e) ----
  const [chaveManif, setChaveManif] = useState('');
  const [tpEvento, setTpEvento] = useState<TipoEvento>('210210');
  const [xJust, setXJust] = useState('');
  const [manifestando, setManifestando] = useState(false);
  const [resultadoManif, setResultadoManif] = useState<ResultadoManif | null>(null);

  async function manifestar() {
    if (!empresaId) {
      toast.error('Selecione a empresa no topo antes de manifestar.');
      return;
    }
    const chave = chaveManif.replace(/\D/g, '');
    if (chave.length !== 44) {
      toast.error('Informe a chave de acesso da NF-e (44 dígitos).');
      return;
    }
    if (tpEvento === '210240' && (xJust.trim().length < 15 || xJust.trim().length > 255)) {
      toast.error('Para "Operação não Realizada", a justificativa deve ter entre 15 e 255 caracteres.');
      return;
    }
    setManifestando(true);
    setResultadoManif(null);
    try {
      const r = (await api.manifestar(empresaId, chave, tpEvento, tpEvento === '210240' ? xJust.trim() : undefined)) as ResultadoManif;
      setResultadoManif(r);
      if (r.ok) toast.success(r.mensagem);
      else toast.error(r.mensagem);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao manifestar na SEFAZ.');
    } finally {
      setManifestando(false);
    }
  }

  const eventoSel = EVENTOS.find((e) => e.value === tpEvento)!;
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
        <AlertTitle>Captura automática ativa (a cada hora)</AlertTitle>
        <AlertDescription>
          O sistema busca NF-e e CT-e de entrada na SEFAZ <b>sozinho, de hora em hora</b>, e manifesta a
          <b> Ciência da Operação</b> nas NF-e (libera o XML completo). Use os botões abaixo para forçar uma
          captura agora. Tudo respeita o controle de NSU e o cooldown (evita o bloqueio cStat 656).
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stamp className="h-5 w-5 text-primary" />
            Manifestação do destinatário (NF-e)
          </CardTitle>
          <CardDescription>
            Para notas em que você é o destinatário, a SEFAZ entrega só um <b>resumo</b>. Manifeste a{' '}
            <b>Ciência da Operação</b> para liberar o <b>XML completo</b> (baixe na próxima sincronização). As demais
            situações (confirmação, desconhecimento, não realizada) são conclusivas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="chaveManif">Chave de acesso da NF-e (44 dígitos)</Label>
              <Input
                id="chaveManif"
                value={chaveManif}
                onChange={(e) => setChaveManif(e.target.value)}
                placeholder="3526..."
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpEvento">Situação</Label>
              <Select value={tpEvento} onValueChange={(v) => setTpEvento(v as TipoEvento)}>
                <SelectTrigger id="tpEvento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENTOS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{eventoSel.dica}</p>
          {tpEvento === '210240' && (
            <div className="space-y-1.5">
              <Label htmlFor="xJust">Justificativa (15 a 255 caracteres)</Label>
              <Textarea id="xJust" rows={2} value={xJust} onChange={(e) => setXJust(e.target.value)} />
            </div>
          )}
          <Button onClick={manifestar} disabled={manifestando || !empresaId}>
            {manifestando ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Stamp className="mr-2 h-4 w-4" />}
            Manifestar
          </Button>
          {resultadoManif && (
            <Alert variant={resultadoManif.ok ? 'default' : 'destructive'}>
              <AlertTitle>
                {resultadoManif.ok ? 'Manifestação registrada' : 'Não registrada'} — cStat {resultadoManif.cStat}
              </AlertTitle>
              <AlertDescription>{resultadoManif.mensagem}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>NFC-e emitidas (SEFAZ-SP)</CardTitle>
          <CardDescription>
            Baixa as suas NFC-e (modelo 65) direto da SEFAZ-SP pelo SAE — só para empresas de <b>SP</b>, usando o
            certificado e-CNPJ. A Distribuição DFe nacional não entrega NFC-e; este é o canal estadual. As notas
            capturadas entram em <b>Documentos de Saída</b> (débito na apuração).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="nfceIni">Data inicial</Label>
              <Input id="nfceIni" type="date" value={dataIniNfce} onChange={(e) => setDataIniNfce(e.target.value)} className="w-[170px]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nfceFim">Data final</Label>
              <Input id="nfceFim" type="date" value={dataFimNfce} onChange={(e) => setDataFimNfce(e.target.value)} className="w-[170px]" />
            </div>
            <Button onClick={capturarNfce} disabled={capturandoNfce}>
              {capturandoNfce ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />}
              Capturar NFC-e (SP)
            </Button>
            <Button variant="outline" onClick={atualizarStatusNfce}>
              Atualizar status
            </Button>
          </div>

          {statusNfce && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>
                Captura {statusNfce.estado} · {statusNfce.ambiente}
              </AlertTitle>
              <AlertDescription>
                {statusNfce.mensagem ??
                  `Encontradas ${statusNfce.chavesEncontradas} · importadas ${statusNfce.importadas} · já existiam ${statusNfce.jaImportadas} · sem XML ${statusNfce.semXml} · erros ${statusNfce.erros}`}
              </AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground">
            Janela máxima de 100 dias. Serviço novo da SEFAZ-SP (NT SAE-NFC-e v1.00) — validar em homologação.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
