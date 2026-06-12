import { useState } from 'react';
import { BadgeCheck, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import StatusPill from '@/components/StatusPill';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';

interface Resultado {
  veredito: 'OK' | 'ATENCAO' | 'DIVERGENCIA';
  confianca: number;
  ncmInformado: string;
  ncmSugerido: string;
  cfopInformado: string;
  cfopSugerido: string;
  alertas: string[];
  observacao: string;
}

export default function Validador() {
  const [descricao, setDescricao] = useState('');
  const [ncm, setNcm] = useState('');
  const [cfop, setCfop] = useState('');
  const [cstIcms, setCstIcms] = useState('');
  const [cstPis, setCstPis] = useState('');
  const [cstCofins, setCstCofins] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  async function validar() {
    if (!descricao.trim()) {
      toast.error('Informe a descrição do produto.');
      return;
    }
    if (!ncm.trim()) {
      toast.error('Informe o NCM do produto.');
      return;
    }
    setCarregando(true);
    try {
      const r = (await api.classificarItem({
        descricao: descricao.trim(),
        ncm: ncm.trim(),
        cfop: cfop.trim(),
        cstIcms: cstIcms.trim() || undefined,
        cstPis: cstPis.trim() || undefined,
        cstCofins: cstCofins.trim() || undefined,
      })) as Resultado;
      setRes(r);
      toast.success('Validação concluída.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao validar o produto.');
    } finally {
      setCarregando(false);
    }
  }

  const ncmDiferente = res ? res.ncmInformado !== res.ncmSugerido : false;
  const cfopDiferente = res ? res.cfopInformado !== res.cfopSugerido : false;
  const confiancaPct = res ? Math.round(res.confianca * 100) : 0;

  return (
    <>
      <PageHeader
        title="Validador de NCM"
        description="Confere se o produto está com NCM correto e tributação coerente."
      >
        <BadgeCheck className="h-6 w-6 text-accent" />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados do produto</CardTitle>
            <CardDescription>
              Preencha a descrição e o NCM (obrigatórios). CFOP e CSTs ajudam a IA a avaliar a coerência tributária.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição do produto</Label>
              <Textarea
                id="descricao"
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Cadeira de escritório giratória em madeira com encosto..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ncm">NCM</Label>
                <Input
                  id="ncm"
                  value={ncm}
                  onChange={(e) => setNcm(e.target.value)}
                  placeholder="Ex.: 94036000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cfop">CFOP</Label>
                <Input
                  id="cfop"
                  value={cfop}
                  onChange={(e) => setCfop(e.target.value)}
                  placeholder="Ex.: 1102"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cstIcms">CST ICMS</Label>
                <Input
                  id="cstIcms"
                  value={cstIcms}
                  onChange={(e) => setCstIcms(e.target.value)}
                  placeholder="opcional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cstPis">CST PIS</Label>
                <Input
                  id="cstPis"
                  value={cstPis}
                  onChange={(e) => setCstPis(e.target.value)}
                  placeholder="opcional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cstCofins">CST COFINS</Label>
                <Input
                  id="cstCofins"
                  value={cstCofins}
                  onChange={(e) => setCstCofins(e.target.value)}
                  placeholder="opcional"
                />
              </div>
            </div>

            <Button onClick={validar} disabled={carregando}>
              {carregando ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Validando…
                </>
              ) : (
                <>
                  <BadgeCheck className="mr-2 h-4 w-4" />
                  Validar
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Resultado da validação</CardTitle>
              {res && <StatusPill status={res.veredito} />}
            </div>
            <CardDescription>Veredito, confiança e sugestões da IA assistiva.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!res ? (
              <p className="text-sm text-muted-foreground">
                Preencha os dados ao lado e clique em <span className="font-medium">Validar</span> para ver o resultado.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Confiança</span>
                    <span className="font-semibold text-foreground">Confiança: {confiancaPct}%</span>
                  </div>
                  <Progress value={confiancaPct} />
                </div>

                <Separator />

                <div className="space-y-3">
                  <ComparacaoLinha
                    rotulo="NCM"
                    informado={res.ncmInformado}
                    sugerido={res.ncmSugerido}
                    diferente={ncmDiferente}
                  />
                  <ComparacaoLinha
                    rotulo="CFOP"
                    informado={res.cfopInformado}
                    sugerido={res.cfopSugerido}
                    diferente={cfopDiferente}
                  />
                </div>

                {res.alertas.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Alertas</p>
                    {res.alertas.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-chart-3" />
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Alert>
                  <AlertDescription>{res.observacao}</AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ComparacaoLinha({
  rotulo,
  informado,
  sugerido,
  diferente,
}: {
  rotulo: string;
  informado: string;
  sugerido: string;
  diferente: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo} informado</p>
        <p className="truncate font-mono text-sm font-semibold text-foreground">{informado || '—'}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 text-right">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo} sugerido</p>
        <p
          className={
            diferente
              ? 'truncate font-mono text-sm font-bold text-destructive'
              : 'truncate font-mono text-sm font-semibold text-accent'
          }
        >
          {sugerido || '—'}
        </p>
      </div>
    </div>
  );
}
