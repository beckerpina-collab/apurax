import { useRef, useState } from 'react';
import { Upload, RefreshCw, FileText, FileCheck2, Truck, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { brl } from '@/lib/format';
import { useEmpresa } from '@/lib/empresa-context';

type ModeloDoc = 'nfe' | 'cte' | 'nfse';

interface ResultadoImport {
  chaveAcesso: string;
  totalItens: number;
  creditoPotencial: { ICMS: number; PIS: number; COFINS: number };
  observacao: string;
}

const ABAS: { value: string; label: string; modelo: ModeloDoc; icon: typeof FileText; dica: string }[] = [
  { value: 'nfe', label: 'NF-e / NFC-e', modelo: 'nfe', icon: FileCheck2, dica: 'Notas fiscais de mercadoria (modelos 55 e 65).' },
  { value: 'cte', label: 'CT-e', modelo: 'cte', icon: Truck, dica: 'Conhecimentos de transporte (modelo 57).' },
  { value: 'nfse', label: 'NFS-e', modelo: 'nfse', icon: ReceiptText, dica: 'Notas fiscais de serviço eletrônicas.' },
];

export default function ImportarXml() {
  const { empresaId } = useEmpresa();
  const [aba, setAba] = useState('nfe');
  const [xml, setXml] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const abaAtual = ABAS.find((a) => a.value === aba) ?? ABAS[0];

  function onTrocarAba(value: string) {
    setAba(value);
    setXml('');
    setResultado(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setXml(String(reader.result ?? ''));
      toast.info(`Arquivo "${file.name}" carregado. Confira e clique em Importar.`);
    };
    reader.onerror = () => toast.error('Não foi possível ler o arquivo selecionado.');
    reader.readAsText(file);
  }

  async function onImportar() {
    if (!xml.trim()) {
      toast.error('Cole ou selecione um XML antes de importar.');
      return;
    }
    if (!empresaId) {
      toast.error('Selecione uma empresa no topo da página antes de importar.');
      return;
    }
    setLoading(true);
    setResultado(null);
    try {
      const r = (await api.importarDoc(abaAtual.modelo, empresaId, xml)) as ResultadoImport;
      setResultado(r);
      toast.success(`Documento importado: ${r.totalItens} ite${r.totalItens === 1 ? 'm' : 'ns'} processado(s).`);
    } catch (e) {
      toast.error((e as Error).message ?? 'Falha ao importar o documento.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Importar XML"
        description="Envie NF-e (mod. 55), NFC-e (65), CT-e (57) ou NFS-e manualmente."
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
                <CardDescription>{a.dica}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`arquivo-${a.value}`}>Selecionar arquivo .xml</Label>
                  <input
                    id={`arquivo-${a.value}`}
                    ref={fileRef}
                    type="file"
                    accept=".xml"
                    onChange={onArquivo}
                    disabled={loading}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`xml-${a.value}`}>Conteúdo do XML</Label>
                  <Textarea
                    id={`xml-${a.value}`}
                    value={xml}
                    onChange={(e) => setXml(e.target.value)}
                    disabled={loading}
                    placeholder="Cole aqui o conteúdo do XML ou selecione um arquivo acima."
                    className="min-h-[220px] font-mono text-xs"
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={onImportar} disabled={loading || !empresaId}>
                    {loading ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {loading ? 'Importando...' : 'Importar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

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
                <p className="mt-1 text-sm text-foreground">{resultado.totalItens}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Crédito potencial
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">ICMS</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{brl(resultado.creditoPotencial.ICMS)}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">PIS</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{brl(resultado.creditoPotencial.PIS)}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">COFINS</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{brl(resultado.creditoPotencial.COFINS)}</p>
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
