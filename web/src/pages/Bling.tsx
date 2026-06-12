import { AlertTriangle, BadgeCheck, Calculator, DownloadCloud, Plug, Receipt, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, isDemo } from '@/lib/api';
import { useEmpresa } from '@/lib/empresa-context';
import { brl, dataBR, dataHoraBR } from '@/lib/format';

interface Varredura {
  estado: 'varrendo' | 'concluida' | 'erro';
  periodo: string;
  encontradas: number;
  enfileiradas: number;
  paginas: number;
  truncada?: boolean;
  atualizadoEm: string;
  erro?: string;
}

interface BlingStatus {
  conectado: boolean;
  expiraEm: string | null;
  escopos: string[];
  filaPendentes?: number;
  varredura?: Varredura | null;
}

interface NotaSaida {
  id: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  destinatario: string;
  valor: number;
  icms?: number;
  pisCofins?: number;
  situacao: string;
}

interface PuxarSaidasResp {
  periodo: string;
  totalNotas: number;
  totalValor: number;
  truncado?: boolean;
  notas: NotaSaida[];
  observacao: string;
}

interface ImportResp {
  status?: string; // 'varrendo' no fluxo real (segundo plano, sem limite)
  total?: number; // legado/demo
  enfileiradas?: number; // legado/demo
  jaNaFila?: number;
  filaPendentes?: number;
  observacao: string;
}

export default function Bling() {
  const { empresaId } = useEmpresa();
  const [status, setStatus] = useState<BlingStatus | null>(null);
  const [carregandoStatus, setCarregandoStatus] = useState(false);
  const [conectando, setConectando] = useState(false);

  const [dataInicial, setDataInicial] = useState('2026-02-01');
  const [dataFinal, setDataFinal] = useState('2026-02-28');
  const [puxando, setPuxando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<PuxarSaidasResp | null>(null);
  const [importResultado, setImportResultado] = useState<ImportResp | null>(null);

  async function carregarStatus(silent = false) {
    if (!silent) setCarregandoStatus(true);
    try {
      const r = (await api.blingStatus(empresaId ?? undefined)) as BlingStatus;
      setStatus(r);
    } catch (e: any) {
      if (!silent) toast.error(e?.message ?? 'Falha ao consultar o status do Bling.');
    } finally {
      if (!silent) setCarregandoStatus(false);
    }
  }

  useEffect(() => {
    carregarStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  // Enquanto há varredura em andamento OU fila pendente, atualiza sozinho (silencioso).
  const trabalhando = status?.varredura?.estado === 'varrendo' || (status?.filaPendentes ?? 0) > 0;
  useEffect(() => {
    if (!trabalhando) return;
    const id = setInterval(() => carregarStatus(true), 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabalhando, empresaId]);

  // Trata o retorno do callback OAuth (?bling=conectado|erro).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const b = p.get('bling');
    if (b === 'conectado') {
      toast.success('Bling conectado com sucesso!');
      carregarStatus();
    } else if (b === 'erro') {
      toast.error(`Falha ao conectar o Bling: ${p.get('motivo') ?? 'tente novamente'}`);
    }
    if (b) window.history.replaceState({}, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validarPeriodo(): boolean {
    if (!empresaId) {
      toast.warning('Selecione a empresa no topo da página.');
      return false;
    }
    if (!dataInicial || !dataFinal) {
      toast.warning('Informe a data inicial e a data final.');
      return false;
    }
    if (dataInicial > dataFinal) {
      toast.warning('A data inicial não pode ser posterior à data final.');
      return false;
    }
    return true;
  }

  async function conectar() {
    if (!empresaId) {
      toast.warning('Selecione a empresa no topo da página antes de conectar.');
      return;
    }
    setConectando(true);
    try {
      const { authorization_url } = await api.blingAuthUrl(empresaId);
      if (!authorization_url || authorization_url === '#demo') {
        toast.info('Modo demo: a conexão real abre o consentimento do Bling. Rode com VITE_DEMO=false e o backend no ar.');
        return;
      }
      // Redireciona o navegador para a tela de consentimento do Bling.
      window.location.href = authorization_url;
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao iniciar a conexão com o Bling.');
    } finally {
      setConectando(false);
    }
  }

  async function puxarSaidas() {
    if (!validarPeriodo() || !empresaId) return;
    setPuxando(true);
    try {
      const r = (await api.blingPuxarSaidas(empresaId, dataInicial, dataFinal)) as PuxarSaidasResp;
      setResultado(r);
      toast.success(`${r.totalNotas} nota(s) de saída listada(s).`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao puxar as notas de saída do Bling.');
    } finally {
      setPuxando(false);
    }
  }

  async function importarParaApuracao() {
    if (!validarPeriodo() || !empresaId) return;
    setImportando(true);
    try {
      const r = (await api.blingImportarSaidas(empresaId, dataInicial, dataFinal)) as ImportResp;
      setImportResultado(r);
      toast.success(
        r.status === 'varrendo'
          ? 'Varredura do período iniciada — importando em segundo plano.'
          : `${r.enfileiradas} de ${r.total} nota(s) enfileirada(s) — importando em segundo plano.`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao importar as saídas para a apuração.');
    } finally {
      setImportando(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Bling — notas de saída"
        description="Importe as NF-e emitidas no Bling para apurar o imposto a pagar."
      >
        <Button variant="outline" onClick={carregarStatus} disabled={carregandoStatus}>
          <RefreshCw className={carregandoStatus ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Atualizar status
        </Button>
      </PageHeader>

      {!empresaId && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Nenhuma empresa selecionada</AlertTitle>
          <AlertDescription>
            Selecione a empresa no seletor no topo da página para consultar a conexão e importar as notas.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Conexão */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-primary" />
              Conexão
            </CardTitle>
            <CardDescription>Status da integração OAuth com o Bling (API v3).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {carregandoStatus && !status ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Consultando status…
              </div>
            ) : status?.conectado ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className="gap-1">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Conectado
                  </Badge>
                  <span className="text-sm text-muted-foreground">Expira em {dataHoraBR(status.expiraEm)}</span>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Escopos autorizados
                  </p>
                  {status.escopos && status.escopos.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {status.escopos.map((e) => (
                        <Badge key={e} variant="secondary">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum escopo informado.</p>
                  )}
                </div>
                {status.varredura && (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      {status.varredura.estado === 'varrendo' && (
                        <RefreshCw className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
                      )}
                      Varredura {status.varredura.periodo}: <b>{status.varredura.encontradas}</b> nota(s) encontrada(s)
                      {status.varredura.enfileiradas !== status.varredura.encontradas
                        ? ` (${status.varredura.enfileiradas} nova(s) na fila)`
                        : ''}
                      {status.varredura.estado === 'varrendo'
                        ? ' — em andamento…'
                        : status.varredura.estado === 'concluida'
                          ? ' — concluída.'
                          : ` — erro: ${status.varredura.erro ?? 'falha na varredura'}`}
                    </p>
                    {status.varredura.truncada && (
                      <p className="font-medium text-destructive">
                        ⚠ Período muito grande: a varredura parou no limite de segurança. Reimporte em fatias menores
                        (ex.: por semana) para garantir que nada ficou de fora.
                      </p>
                    )}
                  </div>
                )}
                {(status.filaPendentes ?? 0) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    <RefreshCw className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
                    Fila de importação: <b>{status.filaPendentes}</b> nota(s) pendente(s) — processando em segundo
                    plano.
                  </p>
                )}
                <Button variant="outline" size="sm" onClick={conectar} disabled={conectando || !empresaId}>
                  <Plug className="mr-2 h-4 w-4" />
                  Reconectar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  A integração ainda não está conectada. Ao clicar em <b>Conectar Bling</b> você é redirecionado ao
                  Bling para autorizar a Apurax (escopos de Notas Fiscais e Produtos) e volta com o token salvo para
                  esta empresa.
                </p>
                <Button onClick={conectar} disabled={conectando || !empresaId}>
                  {conectando ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
                  Conectar Bling
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Importar período */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DownloadCloud className="h-5 w-5 text-primary" />
              Período de emissão
            </CardTitle>
            <CardDescription>Intervalo de emissão das NF-e de saída.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dataInicial">Data inicial</Label>
                <Input id="dataInicial" type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dataFinal">Data final</Label>
                <Input id="dataFinal" type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={puxarSaidas} disabled={puxando || !empresaId}>
                {puxando ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />}
                Listar saídas
              </Button>
              <Button onClick={importarParaApuracao} disabled={importando || !empresaId}>
                {importando ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                Importar para apuração
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <b>Listar</b> só pré-visualiza as notas. <b>Importar para apuração</b> baixa o XML de cada uma e grava
              como documento de saída — é o que alimenta o débito em <b>Apurações</b>.
            </p>
          </CardContent>
        </Card>
      </div>

      {importResultado && (
        <Alert className="mt-6">
          <Calculator className="h-4 w-4" />
          <AlertTitle>
            {importResultado.status === 'varrendo'
              ? 'Varredura iniciada — importando o período inteiro em segundo plano'
              : `${importResultado.enfileiradas} de ${importResultado.total} nota(s) na fila de importação${
                  importResultado.jaNaFila ? ` · ${importResultado.jaNaFila} já estavam na fila` : ''
                }`}
          </AlertTitle>
          <AlertDescription>
            {importResultado.observacao} Use <b>Atualizar status</b> para acompanhar a fila; quando zerar, rode a
            apuração em <b>Apurações → Imposto a pagar</b>.
          </AlertDescription>
        </Alert>
      )}

      {resultado && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <StatCard
              title="Notas de saída"
              value={resultado.totalNotas}
              subtitle={`Período: ${resultado.periodo}`}
              icon={Receipt}
              variant="primary"
            />
            <StatCard
              title="Valor total das saídas"
              value={resultado.totalValor > 0 ? brl(resultado.totalValor) : '—'}
              subtitle={
                resultado.totalValor > 0
                  ? 'Base do imposto a pagar'
                  : 'A listagem do Bling não traz valor — veja em Documentos após importar'
              }
              icon={DownloadCloud}
              variant="accent"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Notas listadas</CardTitle>
              <CardDescription>NF-e de saída emitidas no Bling no período selecionado.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Série</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.notas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                          Nenhuma nota de saída encontrada no período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      resultado.notas.map((n) => (
                        <TableRow key={n.id}>
                          <TableCell className="font-medium">{n.numero}</TableCell>
                          <TableCell>{n.serie}</TableCell>
                          <TableCell>{dataBR(n.dataEmissao)}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{n.destinatario}</TableCell>
                          <TableCell className="text-right tabular-nums">{n.valor > 0 ? brl(n.valor) : '—'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{n.situacao}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {resultado.observacao && (
            <Alert variant={resultado.truncado ? 'destructive' : 'default'}>
              {resultado.truncado ? <AlertTriangle className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
              <AlertTitle>{resultado.truncado ? 'Pré-visualização truncada' : 'Observação'}</AlertTitle>
              <AlertDescription>{resultado.observacao}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <Alert className="mt-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Campos a validar contra o schema oficial</AlertTitle>
        <AlertDescription>
          O ICMS/PIS/COFINS por nota saem da apuração (após importar o XML), não da listagem. Alguns campos da API
          Bling v3 (formato do XML, códigos de situação, paginação) ainda estão marcados como [INCERTO] no código —
          confirme contra developer.bling.com.br antes do uso intensivo.
        </AlertDescription>
      </Alert>
    </>
  );
}
