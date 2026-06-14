import { BadRequestException, Injectable } from '@nestjs/common';
import { DacteParser } from './dacte-cte.parser';
import { DanfeNfeParser } from './danfe-nfe.parser';
import { renderDacte } from './dacte-cte.render';
import { renderDanfe } from './danfe-nfe.render';
import { PdfBuilder } from './pdf-builder';

@Injectable()
export class DanfeService {
  constructor(
    private readonly nfeParser: DanfeNfeParser,
    private readonly cteParser: DacteParser,
  ) {}

  /**
   * Gera o PDF do documento auxiliar (DANFE p/ NF-e mod. 55, DACTE p/ CT-e mod. 57)
   * a partir do XML bruto. 100% local — nada é enviado para fora.
   */
  async gerar(xml: string, modelo?: string): Promise<{ pdf: Buffer; nomeArquivo: string }> {
    const ehCte = modelo === '57' || (!modelo && /<\s*(cteProc|CTe)[\s>]/.test(xml));
    const b = new PdfBuilder();

    if (ehCte) {
      const d = this.cteParser.parse(xml);
      const bc = await PdfBuilder.barcode(d.chave);
      renderDacte(b, d, bc);
      const pdf = await b.finish();
      return { pdf, nomeArquivo: `DACTE-${d.chave || 'documento'}.pdf` };
    }

    const ehNfe = modelo === '55' || /<\s*(nfeProc|NFe)[\s>]/.test(xml);
    if (!ehNfe) {
      throw new BadRequestException('Documento sem DANFE/DACTE: só NF-e (modelo 55) e CT-e (modelo 57) geram PDF.');
    }
    const d = this.nfeParser.parse(xml);
    const bc = await PdfBuilder.barcode(d.chave);
    renderDanfe(b, d, bc);
    const pdf = await b.finish();
    return { pdf, nomeArquivo: `DANFE-${d.chave || 'documento'}.pdf` };
  }
}
