import { useState, type ChangeEvent } from 'react';
import { Settings, Building2, ShieldCheck, ShieldAlert, Plug, RefreshCw, BadgeCheck, FileText } from 'lucide-react';
import { toast } from 'sonner';

import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { api } from '@/lib/api';
import { cnpjMask } from '@/lib/format';
import { useEmpresa } from '@/lib/empresa-context';

const REDIRECT_URI_PADRAO = 'https://app.apurax.com.br/integracoes/bling/callback';

export default function Configuracao() {
  const { empresa, empresaId } = useEmpresa();

  const [pfxBase64, setPfxBase64] = useState<string | null>(null);
  const [pfxNome, setPfxNome] = useState<string>('');
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);

  function aoEscolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) {
      setPfxBase64(null);
      setPfxNome('');
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => {
      const resultado = String(leitor.result ?? '');
      const base64 = resultado.includes('base64,') ? resultado.split('base64,')[1] : resultado;
      setPfxBase64(base64);
      setPfxNome(arquivo.name);
    };
    leitor.onerror = () => toast.error('Não foi possível ler o arquivo do certificado.');
    leitor.readAsDataURL(arquivo);
  }

  async function salvarCertificado() {
    if (!empresaId) {
      toast.warning('Selecione uma empresa no topo antes de enviar o certificado.');
      return;
    }
    if (!pfxBase64) {
      toast.warning('Escolha o arquivo .pfx ou .p12 do certificado A1.');
      return;
    }
    if (!senha.trim()) {
      toast.warning('Informe a senha do certificado.');
      return;
    }
    setSalvando(true);
    try {
      const r = await api.salvarCertificado(empresaId, pfxBase64, senha);
      if (r.ok) {
        toast.success(r.mensagem ?? 'Certificado A1 salvo com segurança.');
        setSenha('');
      } else {
        toast.error(r.mensagem ?? 'Não foi possível salvar o certificado.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar o certificado.');
    } finally {
      setSalvando(false);
    }
  }

  function conectarBling() {
    toast.info('A conexão com o Bling requer client_id e redirect_uri reais cadastrados no seu app. Configure-os no cadastro do usuário.');
  }

  const regimeLabel = empresa?.regimeTributario?.replace(/_/g, ' ') ?? '—';

  return (
    <>
      <PageHeader
        title="Configuração"
        description="Dados da empresa, certificado digital A1 e integração Bling."
      >
        <Settings className="h-6 w-6 text-muted-foreground" />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Empresa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Empresa
            </CardTitle>
            <CardDescription>Dados cadastrais (somente leitura). Selecione a empresa no topo para alternar.</CardDescription>
          </CardHeader>
          <CardContent>
            {!empresa ? (
              <EmptyState
                icon={Building2}
                title="Nenhuma empresa selecionada"
                description="Selecione uma empresa no seletor do topo para visualizar os dados cadastrais."
              />
            ) : (
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Razão social</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{empresa.razaoSocial}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">CNPJ</dt>
                  <dd className="mt-0.5 font-mono text-foreground">{cnpjMask(empresa.cnpj)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Regime tributário</dt>
                  <dd className="mt-0.5 text-foreground">
                    <Badge variant="secondary">{regimeLabel}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">UF</dt>
                  <dd className="mt-0.5 text-foreground">{empresa.uf}</dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Certificado Digital A1 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Certificado Digital A1
            </CardTitle>
            <CardDescription>
              Usado para autenticar na SEFAZ e baixar os documentos fiscais de entrada (DF-e).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pfx">Arquivo do certificado (.pfx / .p12)</Label>
              <Input id="pfx" type="file" accept=".pfx,.p12" onChange={aoEscolherArquivo} />
              {pfxBase64 && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  arquivo carregado ✓ {pfxNome && <span className="text-muted-foreground">({pfxNome})</span>}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="senha-pfx">Senha do certificado</Label>
              <Input
                id="senha-pfx"
                type="password"
                placeholder="Senha do PFX"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="off"
              />
            </div>

            <Button onClick={salvarCertificado} disabled={salvando}>
              {salvando ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Salvar certificado
            </Button>

            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Custódia segura do A1</AlertTitle>
              <AlertDescription>
                A senha e o PFX são cifrados no servidor; a chave privada só é decifrada na memória do worker durante a
                consulta à SEFAZ (custódia A1) — nunca em texto puro no banco.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Integração Bling */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-muted-foreground" />
              Integração Bling
            </CardTitle>
            <CardDescription>
              Importe as notas de saída do Bling para compor o débito de imposto a pagar. Os valores reais de
              client_id e redirect_uri vêm do cadastro do usuário.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-id">client_id</Label>
                <Input id="client-id" readOnly placeholder="(definido no cadastro do usuário)" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="redirect-uri">redirect_uri</Label>
                <Input id="redirect-uri" readOnly placeholder={REDIRECT_URI_PADRAO} />
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Como criar o app no Bling
              </p>
              <ol className="ml-1 list-inside list-decimal space-y-1 text-muted-foreground">
                <li>
                  Acesse{' '}
                  <span className="font-mono text-foreground">developer.bling.com.br/aplicativos</span> e crie um novo
                  aplicativo.
                </li>
                <li>
                  Habilite os escopos <Badge variant="secondary">Notas Fiscais</Badge> e{' '}
                  <Badge variant="secondary">Produtos</Badge>.
                </li>
                <li>
                  Informe a <span className="font-mono text-foreground">redirect_uri</span> acima e copie o{' '}
                  <span className="font-mono text-foreground">client_id</span> e o{' '}
                  <span className="font-mono text-foreground">client_secret</span> para o cadastro do usuário.
                </li>
                <li>Volte aqui e clique em “Conectar Bling” para autorizar o acesso.</li>
              </ol>
            </div>

            <Button variant="outline" onClick={conectarBling}>
              <Plug className="mr-2 h-4 w-4" />
              Conectar Bling
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
