import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

export interface CellOpts {
  valueSize?: number;
  labelSize?: number;
  bold?: boolean; // valor em negrito
  align?: 'left' | 'center' | 'right';
  drawBox?: boolean; // default true
  valueY?: number; // ajuste fino vertical do valor
}

/**
 * Wrapper leve sobre PDFKit com as primitivas do DANFE/DACTE: a folha é uma
 * grade de caixas, cada uma com um rótulo minúsculo no topo e o valor abaixo.
 * Unidades em pontos (1pt = 1/72"). A4 retrato = 595.28 x 841.89.
 */
export class PdfBuilder {
  readonly doc: PDFKit.PDFDocument;
  readonly pageW = 595.28;
  readonly pageH = 841.89;
  readonly margin = 18;
  readonly left = 18;
  readonly right = 595.28 - 18;
  readonly contentW = 595.28 - 36;
  private readonly chunks: Buffer[] = [];
  private readonly done: Promise<Buffer>;

  constructor() {
    this.doc = new PDFDocument({ size: 'A4', margin: this.margin, bufferPages: true });
    this.doc.on('data', (c: Buffer) => this.chunks.push(c));
    this.done = new Promise<Buffer>((resolve, reject) => {
      this.doc.on('end', () => resolve(Buffer.concat(this.chunks)));
      this.doc.on('error', reject);
    });
    this.doc.lineWidth(0.6).strokeColor('#000000');
  }

  box(x: number, y: number, w: number, h: number): void {
    this.doc.lineWidth(0.6).strokeColor('#000000').rect(x, y, w, h).stroke();
  }

  hline(x1: number, y: number, x2: number): void {
    this.doc.lineWidth(0.6).strokeColor('#000000').moveTo(x1, y).lineTo(x2, y).stroke();
  }

  /** Caixa rotulada: rótulo 5pt em cima, valor abaixo. Retorna a altura usada. */
  cell(x: number, y: number, w: number, h: number, label: string, value: string, opts: CellOpts = {}): void {
    const { valueSize = 7, labelSize = 5, bold = false, align = 'left', drawBox = true } = opts;
    if (drawBox) this.box(x, y, w, h);
    const padX = 2.5;
    if (label) {
      this.doc.font('Helvetica').fontSize(labelSize).fillColor('#000000');
      this.doc.text(label, x + padX, y + 1.5, { width: w - padX * 2, lineBreak: false, ellipsis: true });
    }
    if (value !== undefined && value !== null && value !== '') {
      this.doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(valueSize).fillColor('#000000');
      const vy = opts.valueY ?? y + labelSize + 3.5;
      this.doc.text(value, x + padX, vy, { width: w - padX * 2, align, lineBreak: false, ellipsis: true });
    }
  }

  /** Texto livre dentro de uma área (com quebra de linha). */
  paragraph(x: number, y: number, w: number, str: string, size = 6.5, bold = false): void {
    this.doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor('#000000');
    this.doc.text(str || '', x, y, { width: w, align: 'left' });
  }

  /** Título centralizado (usado nos cabeçalhos das seções). */
  sectionTitle(x: number, y: number, w: number, str: string, size = 6): void {
    this.doc.font('Helvetica-Bold').fontSize(size).fillColor('#000000');
    this.doc.text(str, x, y, { width: w, align: 'center', lineBreak: false });
  }

  heightOfString(str: string, w: number, size = 6.5): number {
    this.doc.font('Helvetica').fontSize(size);
    return this.doc.heightOfString(str || ' ', { width: w });
  }

  /** Gera PNG de código de barras (Code128) da chave de acesso (44 dígitos). */
  static async barcode(text: string): Promise<Buffer | null> {
    if (!text) return null;
    try {
      return await bwipjs.toBuffer({
        bcid: 'code128',
        text,
        scale: 3,
        height: 9,
        includetext: false,
        paddingwidth: 0,
        paddingheight: 0,
      });
    } catch {
      return null;
    }
  }

  /** Marca d'água diagonal (ex.: HOMOLOGAÇÃO / SEM VALOR FISCAL). */
  watermark(text: string): void {
    const d = this.doc;
    d.save();
    d.rotate(-45, { origin: [this.pageW / 2, this.pageH / 2] });
    d.font('Helvetica-Bold').fontSize(48).fillColor('#000000').opacity(0.12);
    d.text(text, 0, this.pageH / 2 - 24, { width: this.pageW, align: 'center' });
    d.opacity(1).restore();
  }

  finish(): Promise<Buffer> {
    this.doc.end();
    return this.done;
  }
}
