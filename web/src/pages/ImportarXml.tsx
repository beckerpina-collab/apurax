import JSZip from 'jszip';
import { FileArchive, FileCheck2, FileText, ReceiptText, RefreshCw, Truck, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import StatusPill from '@/components/StatusPill';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { brl } from '@/lib/format';
import { useEmpresa } from '@/lib/empresa-context';

type ModeloDoc = 'nfe' | 'cte' | 'nfse';

interface ResultadoImport {
  chaveAcesso: string;
  totalItens?: number;
  creditoPotencial?: { ICMS: number | string; PIS: number | string; COFINS: number | string };
  observacao: string;
}

interface ItemLote {
  nome: string;
  modelo: ModeloDoc | null;
  status: 'OK' | 'DIVERGENCIA';
  mensagem: string;
}

const ABAS: { value: string; label: string; modelo: ModeloDoc; icon: typeof FileText; dica: string }[] = [
  { value: 'nfe', label: 'NF-e / NFC-e', modelo: 'nfe', icon: FileCheck2, dica: 'Notas fiscais de mercadoria (modelos 55 e 65).' },
  { value: 'cte', label: 'CT-e', modelo: 'cte', icon: Truck, dica: 'Conhecimentos de transporte (modelo 57).' },
  { value: 'nfse', label: 'NFS-e', modelo: 'nfse', icon: ReceiptText, dica: 'Notas fiscais de serviço eletrônicas.' },
];

const ROTULO: Record<ModeloDoc, string> = { nfe: 'NF-e/NFC-e', cte: 'CT-e', nfse: 'NFS-e' };

/** Detecta o tipo do documento pelo conteúdo (NFS-e primeiro — tags parecidas). */
function detectarModelo(xml: string): ModeloDoc | null {
  if (/<infNFSe|<infDPS|<CompNfse|<InfNfse/i.test(xml)) return 'nfse';
  if (/<infCte|<cteProc/i.test(xml)) return 'cte';
  if (/<infNFe|<nfeProc/i.test(xml)) return 'nfe';
  return null;
}

/** Extrai todos os XMLs dos arquivos selecionados (lê .zip por dentro). */
async function extrairXmls(arquivos: File[]): Promise<{ nome: string; xml: string }[]> {
  const saida: { nome: string; xml: string }[] = [];
  for (const arq of arquivos) {
    if (/\.zip$/i.test(arq.name)) {
      const zip = await JSZip.loadAsync(await arq.arrayBuffer());
      for (const entrada of Object.values(zip.files)) {
        if (entrada.dir || !/\.xml$/i.test(entrada.name)) continue;
        saida.push({ nome: `${arq.name} → ${entrada.name.split('/').pop()}`, xml: await entrada.async('string') });
      }
    } else {
      saida.push({ nome: arq.name, xml: await arq.text() });
    }
  }
  return saida;
}

export default function ImportarXml() {
  const { empresaId } = useEmpresa();
  const [aba, setAba] = useState('nfe');
  const [xml, setXml] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [lote, setLote] = useState<ItemLote[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const abaAtual = ABAS.find((a) => a.value === aba) ?? ABAS[0];

  function onTrocarAba(value: string) {
    setAba(value);
    setXml('');
    setResultado(null);
    setLote(null);
    setArquivos([]);
    if (fileRef.current) fileRef.current.value = '';
  }

  function onArquivos(e: React.ChangeEvent<HTMLInputElement>) {
    const lista = Array.from(e.target.files ?? []);
    setArquivos(lista);
    setResultado(null);
    setLote(null);
    if (lista.length === 0) return;
    const zips = lista.filter((f) => /\.zip$/i.test(f.name)).length;
    toast.info(
      `${lista.length} arquivo(s) selecionado(s)${zips ? ` (${zips} ZIP)` : ''}. Clique em Importar para processar.`,
    );
  }

  async function importarLote() {
    if (!empresaId) return;
    setLote(null);
    let itens: { nome: string; xml: string }[];
    try {
      itens = await extrairXmls(arquivos);
    } catch (e) {
      toast.error(`Não foi possível ler os arquivos: ${(e as Error).message}`);
      return;
    }
    if (itens.length === 0) {
      toast.error('Nenhum XML encontrado nos arquivos selecionados.');
      return;
    }

    const resultados: ItemLote[] = [];
    let ok = 0;
    for (let i = 0; i < itens.length; i++) {
      setProgresso(`${i + 1}/${itens.length}`);
      const item = itens[i];
      const modelo = detectarModelo(item.xml) ?? abaAtual.modelo;
      try {
        const r = (await api.importarDoc(modelo, empresaId, item.xml)) as ResultadoImport;
        ok += 1;
        resultados.push({ nome: item.nome, modelo, status: 'OK', mensagem: `Chave ${(r.chaveAcesso ?? '').slice(0, 12)}… · ${r.totalItens ?? 1} item(ns)` });
      } catch (e) {
        resultados.push({ nome: item.nome, modelo, status: 'DIVERGENCIA', mensagem: (e as Error).message });
      }
    }
    setLote(resultados);
    setProgresso('');
    const falhas = itens.length - ok;
    if (falhas === 0) toast.success(`${ok} documento(s) importado(s) com sucesso.`);
    else toast.warning(`${ok} importado(s), ${falhas} com erro — veja o detalhe abaixo.`);
  }

  async function onImportar() {
    if (!empresaId) {
      toast.error('Selecione uma empresa no topo da página antes de importar.');
      return;
    }
    setLoading(true);
    setResultado(null);
    try {
      if (arquivos.length > 0) {
        await importarLote();
      } else if (xml.trim()) {
        const modelo = detectarModelo(xml) ?? abaAtual.modelo;
        const r = (await api.importarDoc(modelo, empresaId, xml)) as ResultadoImport;
        setResultado(r);
        toast.success(`Documento importado: ${r.totalItens} ite${r.totalItens === 1 ? 'm' : 'ns'} processado(s).`);
      } else {
        toast.error('Selecione arquivos (.xml/.zip) ou cole um XML antes de importar.');
      }
    } catch (e) {
      toast.error((e as Error).message ?? 'Falha ao importar.');
    } finally {
      setLoading(false);
      setProgresso('');
    }
  }

  return (
    <div>
      <PageHeader
        title="Importar XML"
        description="Envie NF-e (55), NFC-e (65), CT-e (57) ou NFS-e — vários arquivos de uma vez, inclusive ZIP."
      />

      {!empresaId && (
        <Alert className="mb-6">
          <AlertTitle>Selecione uma empresa</AlertTitle>
          <AlertDescription>
            Escolha a empresa no seletor no topo da página para habilitar a importação de documentos.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={aba} onValueChange={onTrocarAba}>
        <TabsList className="mb-4">
          {ABAS.map((a) => {
            const Icon = a.icon;
            return (
              <TabsTrigger key={a.value} value={a.value} className="gap-2">
                <Icon className="h-4 w-4" />
                {a.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {ABAS.map((a) => (
          <TabsContent key={a.value} value={a.value}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  {a.label}
                </CardTitle>
                <CardDescription>
                  {a.dica} O tipo de cada arquivo é detectado automaticamente pelo conteúdo — a aba vale como
                  padrão quando não der para identificar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`arquivo-${a.value}`}>Selecionar arquivos (.xml ou .zip — pode escolher vários)</Label>
                  <input
                    id={`arquivo-${a.value}`}
                    ref={fileRef}
                    type="file"
                    accept=".xml,.zip"
                    multiple
                    onChange={onArquivos}
                    disabled={loading}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                  />
                  {arquivos.length > 0 && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileArchive className="h-3.5 w-3.5" />
                      {arquivos.length} arquivo(s) pronto(s) para importar.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`xml-${a.value}`}>Ou cole o conteúdo de um XML</Label>
                  <Textarea
                    id={`xml-${a.value}`}
                    value={xml}
                    onChange={(e) => setXml(e.target.value)}
                    disabled={loading || arquivos.length > 0}
                    placeholder={
                      arquivos.length > 0
                        ? 'Arquivos selecionados acima serão importados.'
                        : 'Cole aqui o conteúdo do XML ou selecione arquivos acima.'
                    }
                    className="min-h-[180px] font-mono text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-3">
                  {progresso && <span className="text-sm text-muted-foreground">Processando {progresso}…</span>}
                  <Button onClick={onImportar} disabled={loading || !empresaId}>
                    {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {loading ? 'Importando...' : 'Importar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {lote && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Resultado do lote</CardTitle>
            <CardDescription>
              {lote.filter((l) => l.status === 'OK').length} de {lote.length} documento(s) importado(s). Documentos já
              importados antes aparecem como erro de duplicidade (não duplicam).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Detalhe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lote.map((l, i) => (
                    <TableRow key={`${l.nome}-${i}`}>
                      <TableCell className="max-w-[260px] truncate font-medium" title={l.nome}>
                        {l.nome}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{l.modelo ? ROTULO[l.modelo] : '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={l.status === 'OK' ? 'OK' : 'DIVERGENCIA'} />
                      </TableCell>
                      <TableCell className="max-w-[360px] truncate text-xs text-muted-foreground" title={l.mensagem}>
                        {l.mensagem}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {resultado && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Resultado da importação</CardTitle>
            <CardDescription>Documento processado com sucesso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chave de acesso</p>
                <p className="mt-1 break-all font-mono text-sm text-foreground">{resultado.chaveAcesso}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total de itens</p>
                <p className="mt-1 text-sm text-foreground">{resultado.totalItens ?? 1}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Crédito potencial</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">ICMS</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{brl(resultado.creditoPotencial?.ICMS ?? 0)}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">PIS</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{brl(resultado.creditoPotencial?.PIS ?? 0)}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">COFINS</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{brl(resultado.creditoPotencial?.COFINS ?? 0)}</p>
                </div>
              </div>
            </div>

            {resultado.observacao && (
              <Alert>
                <AlertTitle>Observação</AlertTitle>
                <AlertDescription>{resultado.observacao}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
