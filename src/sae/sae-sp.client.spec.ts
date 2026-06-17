import { SaeSpClient } from './sae-sp.client';

describe('SaeSpClient (SAE SEFAZ-SP)', () => {
  const c = new SaeSpClient();

  describe('builders', () => {
    it('monta NFCeListagemChaves com e sem dataHoraFinal', () => {
      const com = c.montarListagemChaves({ tpAmb: 2, dataHoraInicial: '2026-06-01T00:00', dataHoraFinal: '2026-06-17T23:59' });
      expect(com).toContain('<nfceListagemChaves versao="1.00"');
      expect(com).toContain('xmlns="http://www.portalfiscal.inf.br/nfe"');
      expect(com).toContain('<tpAmb>2</tpAmb>');
      expect(com).toContain('<dataHoraInicial>2026-06-01T00:00</dataHoraInicial>');
      expect(com).toContain('<dataHoraFinal>2026-06-17T23:59</dataHoraFinal>');

      const sem = c.montarListagemChaves({ tpAmb: 1, dataHoraInicial: '2026-06-01T00:00' });
      expect(sem).toContain('<tpAmb>1</tpAmb>');
      expect(sem).not.toContain('dataHoraFinal');
    });

    it('monta NFCeDownloadXML com a chave', () => {
      const x = c.montarDownloadXml({ tpAmb: 2, chNFCe: '35260711111111000111650010000088411000000209' });
      expect(x).toContain('<nfceDownloadXML versao="1.00"');
      expect(x).toContain('<chNFCe>35260711111111000111650010000088411000000209</chNFCe>');
    });
  });

  describe('parseListagem', () => {
    const resp = (corpo: string) =>
      `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><NFCeListagemChavesResponse>${corpo}</NFCeListagemChavesResponse></soap:Body></soap:Envelope>`;

    it('extrai cStat, chaves (44 díg.) e dhEmisUltNfce', () => {
      const xml = resp(
        `<retNfceListagemChaves versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
          `<tpAmb>2</tpAmb><cStat>100</cStat><xMotivo>Consulta realizada com sucesso</xMotivo>` +
          `<chNFCe>35260711111111000111650010000088411000000209</chNFCe>` +
          `<chNFCe>35260711111111000111650010000088421000000210</chNFCe>` +
          `<dhEmisUltNfce>2026-06-15T18:30</dhEmisUltNfce>` +
          `</retNfceListagemChaves>`,
      );
      const r = c.parseListagem(xml);
      expect(r.cStat).toBe('100');
      expect(r.chaves).toHaveLength(2);
      expect(r.chaves[0]).toBe('35260711111111000111650010000088411000000209');
      expect(r.dhEmisUltNfce).toBe('2026-06-15T18:30');
    });

    it('trata "sem registros" (cStat 107, sem chNFCe) e uma única chave', () => {
      expect(c.parseListagem(resp(`<retNfceListagemChaves><cStat>107</cStat><xMotivo>sem registros</xMotivo></retNfceListagemChaves>`)).chaves).toEqual([]);
      const uma = c.parseListagem(
        resp(`<retNfceListagemChaves><cStat>101</cStat><chNFCe>35260711111111000111650010000088411000000209</chNFCe><dhEmisUltNfce>2026-06-10T09:00</dhEmisUltNfce></retNfceListagemChaves>`),
      );
      expect(uma.cStat).toBe('101');
      expect(uma.chaves).toHaveLength(1);
    });
  });

  describe('parseDownload', () => {
    const proc = `<proc><nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe35260711111111000111650010000088411000000209"><ide><mod>65</mod></ide></infNFe></NFe><protNFe><infProt><nProt>135260000000209</nProt></infProt></protNFe></nfeProc></proc>`;
    const resp = (corpo: string) =>
      `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><NFCeDownloadXMLResponse><retNfceDownloadXML versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>2</tpAmb><cStat>200</cStat><xMotivo>ok</xMotivo>${corpo}</retNfceDownloadXML></NFCeDownloadXMLResponse></soap:Body></soap:Envelope>`;

    it('extrai cStat e o XML cru do nfeProc', () => {
      const r = c.parseDownload(resp(proc));
      expect(r.cStat).toBe('200');
      expect(r.xml).toContain('<nfeProc');
      expect(r.xml).toContain('</nfeProc>');
      expect(r.xml).toContain('<mod>65</mod>');
    });

    it('desescapa quando o retorno vem escapado dentro do *Result', () => {
      const escapado = `<NFCeDownloadXMLResult>${resp(proc).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</NFCeDownloadXMLResult>`;
      const r = c.parseDownload(escapado);
      expect(r.cStat).toBe('200');
      expect(r.xml).toContain('<nfeProc');
    });

    it('xml null quando a resposta não traz o documento (ex.: chave não encontrada 205)', () => {
      const r = c.parseDownload(resp(''));
      expect(r.cStat).toBe('200'); // (cStat do molde; o ponto é xml ausente)
      expect(r.xml).toBeNull();
    });
  });
});
