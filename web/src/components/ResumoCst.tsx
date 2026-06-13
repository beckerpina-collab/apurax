import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { brl } from '@/lib/format';

export interface LinhaCst {
  cst: string;
  descricao: string;
  itens: number;
  base: number;
  valor: number;
}

export interface ResumoCstData {
  pis: LinhaCst[];
  cofins: LinhaCst[];
}

function Tabela({ titulo, linhas }: { titulo: string; linhas: LinhaCst[] }) {
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className="text-xs font-semibold tabular-nums">{brl(total)}</p>
      </div>
      {linhas.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Sem dados no período.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">CST</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={l.cst}>
                <TableCell className="font-mono font-medium">{l.cst}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.descricao}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(l.base)}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(l.valor)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/** Resumo das CST de PIS e COFINS (base e valor por código), lado a lado. */
export default function ResumoCst({ data, titulo }: { data?: ResumoCstData | null; titulo?: string }) {
  const pis = data?.pis ?? [];
  const cofins = data?.cofins ?? [];
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{titulo ?? 'Resumo CST — PIS e COFINS'}</CardTitle>
        <CardDescription>Base de cálculo e valor de PIS/COFINS por código de situação tributária (CST).</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Tabela titulo="PIS" linhas={pis} />
        <Tabela titulo="COFINS" linhas={cofins} />
      </CardContent>
    </Card>
  );
}
