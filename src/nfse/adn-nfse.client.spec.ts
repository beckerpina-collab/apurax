import { gzipSync } from 'zlib';
import { AdnNfseClient } from './adn-nfse.client';

describe('AdnNfseClient.parse', () => {
  const c = new AdnNfseClient();
  const nfseXml = '<NFSe versao="1.00"><infNFSe Id="NFS123"><valores><vServ>1000.00</vServ></valores></infNFSe></NFSe>';

  it('descomprime GZip+Base64 e extrai documentos + NSU (campos no formato esperado)', () => {
    const b64 = gzipSync(Buffer.from(nfseXml)).toString('base64');
    const json = JSON.stringify({
      StatusProcessamento: '100',
      NsuMaximo: 5,
      UltimoNSU: 5,
      LoteDFe: [{ NSU: 5, ChaveAcesso: 'CHAVE123', ArquivoXml: b64 }],
    });
    const r = c.parse(json);
    expect(r.status).toBe('100');
    expect(r.maxNsu).toBe('5');
    expect(r.ultNsu).toBe('5');
    expect(r.documentos).toHaveLength(1);
    expect(r.documentos[0].nsu).toBe('5');
    expect(r.documentos[0].chave).toBe('CHAVE123');
    expect(r.documentos[0].xml).toContain('<NFSe');
  });

  it('tolera nomes de campo alternativos e base64 puro (sem gzip)', () => {
    const b64 = Buffer.from(nfseXml).toString('base64');
    const json = JSON.stringify({ status: 'OK', documentos: [{ nsu: 2, arquivoXml: b64 }] });
    const r = c.parse(json);
    expect(r.documentos[0].xml).toContain('<NFSe');
    expect(r.maxNsu).toBe('2'); // derivado do maior NSU quando não há campo explícito
  });

  it('trata lote vazio e JSON inválido sem quebrar', () => {
    expect(c.parse('{"documentos":[]}').documentos).toEqual([]);
    expect(c.parse('isto-nao-e-json').status).toBe('ERRO_JSON');
  });

  it('marca xml=null quando o conteúdo não é XML válido', () => {
    const lixo = Buffer.from('conteudo binario qualquer').toString('base64');
    const r = c.parse(JSON.stringify({ documentos: [{ nsu: 1, ArquivoXml: lixo }] }));
    expect(r.documentos[0].xml).toBeNull();
  });
});
