import { gzipSync } from 'zlib';
import { DocZipService } from './doc-zip.service';

describe('DocZipService', () => {
  const svc = new DocZipService();

  it('decodifica Base64(GZIP(xml)) de volta ao XML', () => {
    const xml = '<resNFe><chNFe>35260211111111000111550010000000011000000017</chNFe></resNFe>';
    const b64 = gzipSync(Buffer.from(xml, 'utf8')).toString('base64');
    expect(svc.decodificar(b64)).toBe(xml);
  });

  it('roteia pelo prefixo do schema (tolera versão e ausência de v)', () => {
    expect(svc.classificar('resNFe_v1.01.xsd')).toBe('NFE_RESUMO');
    expect(svc.classificar('procNFe_v4.00.xsd')).toBe('NFE_COMPLETA');
    expect(svc.classificar('resCTe_v1.00.xsd')).toBe('CTE_RESUMO');
    expect(svc.classificar('procCTe_v4.00.xsd')).toBe('CTE_COMPLETA');
    expect(svc.classificar('resEvento_1.00.xsd')).toBe('EVENTO');
    expect(svc.classificar('procEventoNFe_v1.00.xsd')).toBe('EVENTO');
    expect(svc.classificar('algoFuturo_v9.xsd')).toBe('DESCONHECIDO');
  });
});
