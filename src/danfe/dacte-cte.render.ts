import { DacteData, DacteParte } from './dacte-cte.parser';
import { PdfBuilder } from './pdf-builder';
import {
  MODAL_CTE,
  TOMADOR_CTE,
  TP_CTE,
  TP_SERV_CTE,
  cep,
  chaveEspacada,
  cpfCnpj,
  dataHoraSP,
  fone,
  moeda,
  num2,
} from './danfe-format';

/** Renderiza o DACTE (CT-e modelo 57) na grade oficial. */
export function renderDacte(b: PdfBuilder, d: DacteData, barcode: Buffer | null): void {
  const X0 = b.left;
  const W = b.contentW;
  const X1 = X0 + W;
  const bottom = b.pageH - b.margin;
  const doc = b.doc;
  const r = 18;
  const folhaStamps: Array<{ page: number; x: number; y: number; w: number }> = [];

  if (d.tpAmb === '2') b.watermark('SEM VALOR FISCAL');

  let y = b.margin;

  // ───────────── CANHOTO ─────────────
  const canhotoH = 24;
  const nfBoxW = 96;
  const reciboW = W - nfBoxW;
  b.box(X0, y, reciboW, canhotoH);
  b.paragraph(
    X0 + 3,
    y + 2,
    reciboW - 6,
    `Declaro que recebi os volumes deste conhecimento de transporte — DACTE Nº ${d.numero}, Série ${d.serie}.`,
    5.5,
  );
  b.hline(X0, y + canhotoH - 11, X0 + reciboW);
  b.cell(X0, y + canhotoH - 11, 120, 11, 'NOME / RG', '', { labelSize: 4.5 });
  b.cell(X0 + 120, y + canhotoH - 11, reciboW - 120, 11, 'ASSINATURA / CARIMBO', '', { labelSize: 4.5 });
  b.box(X0 + reciboW, y, nfBoxW, canhotoH);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
  doc.text('DACTE', X0 + reciboW, y + 3, { width: nfBoxW, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(6.5);
  doc.text(`Nº ${d.numero}`, X0 + reciboW, y + 13, { width: nfBoxW, align: 'center', lineBreak: false });
  y += canhotoH + 6;

  // ───────────── CABEÇALHO ─────────────
  const headH = 80;
  const colA = 226;
  const colB = 100;
  const colC = W - colA - colB;
  b.box(X0, y, colA, headH);
  b.box(X0 + colA, y, colB, headH);
  b.box(X0 + colA + colB, y, colC, headH);

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
  doc.text(d.emit.nome, X0 + 4, y + 5, { width: colA - 8 });
  const munLinha = [d.emit.endereco, `${d.emit.municipio} - ${d.emit.uf}`, cep(d.emit.cep)].filter(Boolean).join(' - ');
  b.paragraph(
    X0 + 4,
    y + 30,
    colA - 8,
    `${munLinha}${d.emit.cnpjCpf ? `\nCNPJ: ${cpfCnpj(d.emit.cnpjCpf)}  IE: ${d.emit.ie}` : ''}${d.emit.fone ? `  Fone: ${fone(d.emit.fone)}` : ''}`,
    6.5,
  );

  const bx = X0 + colA;
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('DACTE', bx, y + 4, { width: colB, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(4.6);
  doc.text('Documento Auxiliar do Conhecimento de Transporte Eletrônico', bx + 3, y + 16, {
    width: colB - 6,
    align: 'center',
  });
  doc.font('Helvetica').fontSize(6);
  doc.text(`Modal: ${MODAL_CTE[d.modal] ?? d.modal}`, bx + 3, y + 30, { width: colB - 6, align: 'center', lineBreak: false });
  doc.text(`Modelo: ${d.modelo}   Série: ${d.serie}`, bx + 3, y + 39, { width: colB - 6, align: 'center', lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(7);
  doc.text(`Nº ${d.numero}`, bx + 3, y + 49, { width: colB - 6, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(5);
  doc.text(`Emissão: ${dataHoraSP(d.dhEmi)}`, bx + 3, y + 60, { width: colB - 6, align: 'center', lineBreak: false });
  doc.text('FOLHA', bx + 3, y + 69, { width: colB - 6, align: 'center', lineBreak: false });
  folhaStamps.push({ page: 0, x: bx + 3, y: y + 73, w: colB - 6 });

  const cx = X0 + colA + colB;
  if (barcode) {
    try {
      doc.image(barcode, cx + 6, y + 4, { width: colC - 12, height: 22 });
    } catch {
      /* ignora */
    }
  }
  b.cell(cx, y + 30, colC, 20, 'CHAVE DE ACESSO', chaveEspacada(d.chave), {
    valueSize: 7,
    bold: true,
    align: 'center',
    valueY: y + 40,
  });
  const protTxt = d.protocolo ? `${d.protocolo.nProt} - ${dataHoraSP(d.protocolo.dhRecbto)}` : '';
  b.cell(cx, y + 50, colC, headH - 50, 'PROTOCOLO DE AUTORIZAÇÃO DE USO', protTxt, { valueSize: 6.5 });
  y += headH;

  // CFOP / natureza | tipo CTe | tipo serviço
  b.cell(X0, y, W - 260, r, 'CFOP — NATUREZA DA PRESTAÇÃO', `${d.cfop} — ${d.natOp}`, { valueSize: 7 });
  b.cell(X0 + W - 260, y, 130, r, 'TIPO DO CT-e', TP_CTE[d.tpCTe] ?? d.tpCTe, { valueSize: 6 });
  b.cell(X0 + W - 130, y, 130, r, 'TIPO DO SERVIÇO', TP_SERV_CTE[d.tpServ] ?? d.tpServ, { valueSize: 6 });
  y += r;

  // origem | destino da prestação
  b.cell(X0, y, W / 2, r, 'INÍCIO DA PRESTAÇÃO', `${d.municipioIni} - ${d.ufIni}`, { valueSize: 7 });
  b.cell(X0 + W / 2, y, W / 2, r, 'TÉRMINO DA PRESTAÇÃO', `${d.municipioFim} - ${d.ufFim}`, { valueSize: 7 });
  y += r;

  // ───────────── TOMADOR ─────────────
  y = sec(b, X0, y, W, `TOMADOR DO SERVIÇO: ${TOMADOR_CTE[d.tomador.papel] ?? ''}`);
  y = parteRows(b, X0, y, W, d.tomador, r);

  // ───────────── REMETENTE / DESTINATÁRIO ─────────────
  y = sec(b, X0, y, W, 'REMETENTE');
  y = parteRows(b, X0, y, W, d.remetente, r);
  y = sec(b, X0, y, W, 'DESTINATÁRIO');
  y = parteRows(b, X0, y, W, d.destinatario, r);
  if (d.expedidor.nome) {
    y = sec(b, X0, y, W, 'EXPEDIDOR');
    y = parteRows(b, X0, y, W, d.expedidor, r);
  }
  if (d.recebedor.nome) {
    y = sec(b, X0, y, W, 'RECEBEDOR');
    y = parteRows(b, X0, y, W, d.recebedor, r);
  }

  // ───────────── CARGA ─────────────
  y = sec(b, X0, y, W, 'PRODUTO PREDOMINANTE / CARGA');
  b.cell(X0, y, W - 140, r, 'PRODUTO PREDOMINANTE', d.produtoPredominante, { valueSize: 7 });
  b.cell(X0 + W - 140, y, 140, r, 'VALOR TOTAL DA CARGA', moeda(d.vCarga), { valueSize: 7, align: 'right', valueY: y + r - 9 });
  y += r;

  // ───────────── COMPONENTES DO VALOR DA PRESTAÇÃO ─────────────
  y = sec(b, X0, y, W, 'COMPONENTES DO VALOR DA PRESTAÇÃO DO SERVIÇO');
  const compCols = 3;
  const compW = W / compCols;
  let col = 0;
  let rowY = y;
  for (const comp of d.componentes) {
    if (col === compCols) {
      col = 0;
      rowY += r;
    }
    b.cell(X0 + col * compW, rowY, compW, r, comp.nome, moeda(comp.valor), {
      valueSize: 7,
      align: 'right',
      valueY: rowY + r - 9,
    });
    col++;
  }
  if (d.componentes.length) y = rowY + r;
  // vRec | vTPrest
  b.cell(X0, y, W / 2, r, 'VALOR A RECEBER', moeda(d.vRec), { valueSize: 7, align: 'right', valueY: y + r - 9 });
  b.cell(X0 + W / 2, y, W / 2, r, 'VALOR TOTAL DA PRESTAÇÃO', moeda(d.vTPrest), {
    valueSize: 8,
    bold: true,
    align: 'right',
    valueY: y + r - 9,
  });
  y += r;

  // ───────────── IMPOSTO ─────────────
  y = sec(b, X0, y, W, 'INFORMAÇÕES RELATIVAS AO IMPOSTO (ICMS)');
  const c5 = W / 5;
  cellNum(b, X0, y, c5, r, 'SIT. TRIBUTÁRIA (CST)', d.cst);
  cellNum(b, X0 + c5, y, c5, r, 'BASE DE CÁLCULO', moeda(d.vBcIcms));
  cellNum(b, X0 + c5 * 2, y, c5, r, 'ALÍQUOTA ICMS (%)', num2(d.pIcms));
  cellNum(b, X0 + c5 * 3, y, c5, r, 'VALOR DO ICMS', moeda(d.vIcms));
  cellNum(b, X0 + c5 * 4, y, W - c5 * 4, r, '% RED. BC', num2(d.pRedBc));
  y += r;

  // ───────────── DOCUMENTOS ORIGINÁRIOS ─────────────
  if (d.documentosNfe.length) {
    y = sec(b, X0, y, W, 'DOCUMENTOS ORIGINÁRIOS (CHAVES DE NF-e)');
    const docsTxt = d.documentosNfe.map((c) => chaveEspacada(c)).join('   •   ');
    const h = Math.max(r, b.heightOfString(docsTxt, W - 8, 6) + 6);
    if (y + h > bottom) {
      doc.addPage();
      y = b.margin;
      folhaStamps.push({ page: doc.bufferedPageRange().count - 1, x: X1 - 80, y, w: 78 });
      y += 8;
    }
    b.box(X0, y, W, h);
    b.paragraph(X0 + 4, y + 3, W - 8, docsTxt, 6);
    y += h;
  }

  // ───────────── OBSERVAÇÕES ─────────────
  const obsH = 60;
  if (y + obsH + 8 > bottom) {
    doc.addPage();
    y = b.margin;
    folhaStamps.push({ page: doc.bufferedPageRange().count - 1, x: X1 - 80, y, w: 78 });
    y += 8;
  }
  y = sec(b, X0, y, W, 'OBSERVAÇÕES');
  b.box(X0, y, W, obsH);
  b.paragraph(X0 + 4, y + 3, W - 8, d.observacoes, 6.5);
  y += obsH;

  // FOLHA x/y
  const total = doc.bufferedPageRange().count;
  for (const st of folhaStamps) {
    doc.switchToPage(st.page);
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#000000');
    doc.text(`${st.page + 1}/${total}`, st.x, st.y, { width: st.w, align: 'center', lineBreak: false });
  }
}

/** Duas linhas compactas por participante: nome/cnpj/ie + endereço/município/uf. */
function parteRows(b: PdfBuilder, x: number, y: number, w: number, p: DacteParte, r: number): number {
  b.cell(x, y, w - 230, r, 'NOME / RAZÃO SOCIAL', p.nome, { valueSize: 7 });
  b.cell(x + w - 230, y, 120, r, 'CNPJ / CPF', cpfCnpj(p.cnpjCpf), { valueSize: 7 });
  b.cell(x + w - 110, y, 110, r, 'INSCRIÇÃO ESTADUAL', p.ie, { valueSize: 7 });
  y += r;
  b.cell(x, y, w - 260, r, 'ENDEREÇO', p.endereco, { valueSize: 7 });
  b.cell(x + w - 260, y, 150, r, 'MUNICÍPIO', p.municipio, { valueSize: 7 });
  b.cell(x + w - 110, y, 30, r, 'UF', p.uf, { valueSize: 7, align: 'center' });
  b.cell(x + w - 80, y, 80, r, 'CEP', cep(p.cep), { valueSize: 7 });
  return y + r;
}

function sec(b: PdfBuilder, x: number, y: number, w: number, txt: string): number {
  b.doc.font('Helvetica-Bold').fontSize(6).fillColor('#000000');
  b.doc.text(txt, x + 1, y + 1.5, { width: w, lineBreak: false });
  return y + 9;
}

function cellNum(b: PdfBuilder, x: number, y: number, w: number, h: number, label: string, value: string): void {
  b.cell(x, y, w, h, label, value, { valueSize: 7, align: 'right', valueY: y + h - 9 });
}
