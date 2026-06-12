import { readFileSync } from 'fs';
import { join } from 'path';
import { apurarIss } from '../apuracao-fiscal/apuracao-iss';
import { NfseParserService } from './nfse-parser.service';

describe('NFS-e — parser + apuração de ISS (sem banco)', () => {
  const parser = new NfseParserService();
  const xml = readFileSync(join(__dirname, '../../test/fixtures/nfse-exemplo.xml'), 'utf8');

  it('parseia a NFS-e nacional (prestador, valores, retenção)', () => {
    const n = parser.parse(xml);
    expect(n.chaveAcesso.length).toBeGreaterThanOrEqual(40);
    expect(n.prestadorCnpj).toBe('11111111000111');
    expect(n.tomadorCnpj).toBe('22222222000122');
    expect(n.vServ).toBe('1000.00');
    expect(n.vIss).toBe('50.00');
    expect(n.pAliq).toBe('5.0000');
    expect(n.tpRetISSQN).toBe('1'); // não retido → prestador recolhe
    expect(n.municipioIncidencia).toBe('3550308');
    expect(n.cTribNac).toBe('010101');
    expect(n.dhEmi.getUTCMonth()).toBe(1); // fevereiro
  });

  it('a NFS-e parseada gera débito de ISS (não retida)', () => {
    const n = parser.parse(xml);
    const r = apurarIss([
      { vISSQN: n.vIss, vBC: n.vBc, pAliqAplic: n.pAliq, tpRetISSQN: n.tpRetISSQN, tribISSQN: n.tribISSQN },
    ]);
    expect(r.aRecolher.toFixed(2)).toBe('50.00');
    expect(r.retidoFonte.toFixed(2)).toBe('0.00');
  });
});
