import { montarEventoManifestacao } from './manifestacao';

describe('montarEventoManifestacao', () => {
  const chNFe = '3'.repeat(44);

  it('monta 210210 (Ciência) com Id, cOrgao 91 e descEvento corretos', () => {
    const { id, xml } = montarEventoManifestacao({
      chNFe,
      cnpj: '11111111000111',
      tpEvento: '210210',
      dhEvento: '2026-06-09T10:00:00-03:00',
      tpAmb: 2,
    });
    expect(id).toBe(`ID210210${chNFe}01`);
    expect(xml).toContain('<cOrgao>91</cOrgao>');
    expect(xml).toContain('<tpEvento>210210</tpEvento>');
    expect(xml).toContain('Ciencia da Operacao');
  });

  it('exige xJust (15–255) para 210240 (Operação não Realizada)', () => {
    expect(() =>
      montarEventoManifestacao({ chNFe, cnpj: '1', tpEvento: '210240', dhEvento: 'x', tpAmb: 2 }),
    ).toThrow();
  });

  it('rejeita chNFe inválida', () => {
    expect(() =>
      montarEventoManifestacao({ chNFe: '123', cnpj: '1', tpEvento: '210210', dhEvento: 'x', tpAmb: 2 }),
    ).toThrow();
  });
});
