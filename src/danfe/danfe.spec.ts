import { DacteParser } from './dacte-cte.parser';
import { DanfeNfeParser } from './danfe-nfe.parser';
import { DanfeService } from './danfe.service';
import { CTE_XML, NFE_XML } from './__fixtures__/sample-docs';

describe('DanfeService', () => {
  const service = new DanfeService(new DanfeNfeParser(), new DacteParser());

  it('gera DANFE (NF-e mod. 55) como PDF válido', async () => {
    const { pdf, nomeArquivo } = await service.gerar(NFE_XML, '55');
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(2000);
    expect(nomeArquivo).toContain('DANFE-35260211111111000111550010000000011000000017');
  });

  it('gera DACTE (CT-e mod. 57) como PDF válido', async () => {
    const { pdf, nomeArquivo } = await service.gerar(CTE_XML, '57');
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(2000);
    expect(nomeArquivo).toContain('DACTE-35260222333444000155570010000000051000000098');
  });

  it('detecta o tipo pelo XML quando o modelo não é informado', async () => {
    const nfe = await service.gerar(NFE_XML);
    expect(nfe.nomeArquivo.startsWith('DANFE-')).toBe(true);
    const cte = await service.gerar(CTE_XML);
    expect(cte.nomeArquivo.startsWith('DACTE-')).toBe(true);
  });

  it('aplica marca d’água em homologação (tpAmb=2) sem quebrar', async () => {
    const homolog = NFE_XML.replace('<tpAmb>1</tpAmb>', '<tpAmb>2</tpAmb>');
    const { pdf } = await service.gerar(homolog, '55');
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('rejeita documento que não é NF-e nem CT-e', async () => {
    await expect(service.gerar('<nfseProc><x/></nfseProc>')).rejects.toThrow();
  });
});
