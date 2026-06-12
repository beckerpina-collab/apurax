import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { type Empresa } from '../lib/mock';
import { cnpjMask } from '../lib/format';

const REGIME_LABEL: Record<Empresa['regimeTributario'], string> = {
  LUCRO_REAL: 'Lucro Real',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  SIMPLES_NACIONAL: 'Simples Nacional',
};

export default function Empresas() {
  const [itens, setItens] = useState<Empresa[]>([]);
  useEffect(() => {
    api.empresas().then(setItens);
  }, []);

  return (
    <>
      <div className="page-head">
        <h1>Empresas</h1>
        <p>O regime tributário define o que credita — é o roteador de todo o cálculo.</p>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Razão social</th><th>CNPJ</th><th>Regime</th><th>UF</th><th>Crédito PIS/COFINS?</th></tr>
          </thead>
          <tbody>
            {itens.map((e) => (
              <tr key={e.id}>
                <td><b>{e.razaoSocial}</b></td>
                <td className="mono">{cnpjMask(e.cnpj)}</td>
                <td>{REGIME_LABEL[e.regimeTributario]}</td>
                <td>{e.uf}</td>
                <td>{e.regimeTributario === 'LUCRO_REAL' ? <span className="pill pill-hom">Sim</span> : <span className="pill pill-glo">Não</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
