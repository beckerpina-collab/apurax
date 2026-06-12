import { useState } from 'react';
import { api } from '../lib/api';
import { brl } from '../lib/format';

interface Resultado {
  chaveAcesso: string;
  totalItens: number;
  creditoPotencial: { ICMS: string; PIS: string; COFINS: string };
  observacao: string;
}

const EXEMPLO = '<?xml version="1.0"?>\n<nfeProc>... cole aqui o XML da NF-e de entrada ...</nfeProc>';

export default function ImportarNfe() {
  const [xml, setXml] = useState('');
  const [res, setRes] = useState<Resultado | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function importar() {
    setErro('');
    setCarregando(true);
    try {
      const r = (await api.importarNfe('e1', xml || EXEMPLO)) as Resultado;
      setRes(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao importar');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Importar NF-e</h1>
        <p>Cole o XML de uma nota de entrada — o motor calcula o crédito por item e a base legal.</p>
      </div>

      <div className="grid cols-2">
        <div className="card card-pad">
          <div className="field">
            <label>XML da NF-e (modelo 55)</label>
            <textarea className="input" rows={12} value={xml} onChange={(e) => setXml(e.target.value)} placeholder={EXEMPLO} />
          </div>
          {erro && <div className="error">{erro}</div>}
          <button className="btn btn-primary" onClick={importar} disabled={carregando}>
            {carregando ? 'Calculando…' : 'Importar e apurar'}
          </button>
        </div>

        <div className="card card-pad">
          {!res ? (
            <p className="muted">O resultado da apuração aparece aqui.</p>
          ) : (
            <>
              <div className="label" style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>CHAVE DE ACESSO</div>
              <div className="mono" style={{ fontSize: 12.5, wordBreak: 'break-all', margin: '4px 0 16px' }}>{res.chaveAcesso}</div>
              <div className="grid cols-2" style={{ gap: 10 }}>
                <Mini label="ICMS" v={res.creditoPotencial.ICMS} />
                <Mini label="PIS" v={res.creditoPotencial.PIS} />
                <Mini label="COFINS" v={res.creditoPotencial.COFINS} />
                <Mini label="Itens" v={String(res.totalItens)} plain />
              </div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 16 }}>{res.observacao}</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Mini({ label, v, plain }: { label: string; v: string; plain?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div className="num" style={{ fontSize: 18, fontWeight: 700, color: plain ? 'var(--text)' : 'var(--brand-strong)' }}>
        {plain ? v : brl(v)}
      </div>
    </div>
  );
}
