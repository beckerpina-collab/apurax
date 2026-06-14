import { DanfeNfeData } from './danfe-nfe.parser';
import { PdfBuilder } from './pdf-builder';
import {
  MOD_FRETE,
  cep,
  chaveEspacada,
  cpfCnpj,
  dataHoraSP,
  dataSP,
  fone,
  moeda,
  num2,
  qtd,
} from './danfe-format';

interface Col {
  label: string;
  w: number;
  align: 'left' | 'center' | 'right';
  get: (i: DanfeNfeData['itens'][number]) => string;
}

/** Renderiza o DANFE (NF-e modelo 55) na grade oficial. */
export function renderDanfe(b: PdfBuilder, d: DanfeNfeData, barcode: Buffer | null): void {
  const X0 = b.left;
  const W = b.contentW;
  const X1 = X0 + W;
  const bottom = b.pageH - b.margin;
  const doc = b.doc;
  const folhaStamps: Array<{ page: number; x: number; y: number; w: number }> = [];

  if (d.tpAmb === '2') b.watermark('SEM VALOR FISCAL');

  let y = b.margin;

  // ───────────────────────── CANHOTO ─────────────────────────
  const canhotoH = 26;
  const nfBoxW = 92;
  const reciboW = W - nfBoxW;
  b.box(X0, y, reciboW, canhotoH);
  b.paragraph(
    X0 + 3,
    y + 2,
    reciboW - 6,
    `RECEBEMOS DE ${d.emit.nome} OS PRODUTOS / SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO`,
    5.5,
  );
  const reciboMid = y + canhotoH - 11;
  b.hline(X0, reciboMid, X0 + reciboW);
  b.box(X0, reciboMid, 120, 11);
  b.cell(X0, reciboMid, 120, 11, 'DATA DE RECEBIMENTO', '', { labelSize: 4.5 });
  b.cell(X0 + 120, reciboMid, reciboW - 120, 11, 'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', '', { labelSize: 4.5 });
  // box NF-e (número/série)
  b.box(X0 + reciboW, y, nfBoxW, canhotoH);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000');
  doc.text('NF-e', X0 + reciboW, y + 2, { width: nfBoxW, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(6.5);
  doc.text(`Nº ${d.numero}`, X0 + reciboW, y + 13, { width: nfBoxW, align: 'center', lineBreak: false });
  doc.text(`SÉRIE ${d.serie}`, X0 + reciboW, y + 19, { width: nfBoxW, align: 'center', lineBreak: false });

  y += canhotoH + 6;

  // ───────────────────────── CABEÇALHO ─────────────────────────
  const headH = 78;
  const colA = 232; // emitente
  const colB = 96; // bloco DANFE
  const colC = W - colA - colB; // chave / barcode
  b.box(X0, y, colA, headH);
  b.box(X0 + colA, y, colB, headH);
  b.box(X0 + colA + colB, y, colC, headH);

  // Col A — emitente
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
  doc.text(d.emit.nome, X0 + 4, y + 5, { width: colA - 8 });
  const endLinha = [d.emit.logradouro, d.emit.numero, d.emit.complemento].filter(Boolean).join(', ');
  const munLinha = [d.emit.bairro, `${d.emit.municipio} - ${d.emit.uf}`, cep(d.emit.cep)].filter(Boolean).join(' - ');
  b.paragraph(
    X0 + 4,
    y + 28,
    colA - 8,
    `${endLinha}\n${munLinha}${d.emit.fone ? `\nFone: ${fone(d.emit.fone)}` : ''}`,
    6.5,
  );

  // Col B — bloco DANFE
  const bx = X0 + colA;
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('DANFE', bx, y + 4, { width: colB, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(5);
  doc.text('Documento Auxiliar da Nota Fiscal Eletrônica', bx + 3, y + 17, { width: colB - 6, align: 'center' });
  // 0-entrada / 1-saída + caixa do tipo
  doc.fontSize(5.5);
  doc.text('0 - ENTRADA', bx + 4, y + 30, { width: colB - 22, lineBreak: false });
  doc.text('1 - SAÍDA', bx + 4, y + 38, { width: colB - 22, lineBreak: false });
  b.box(bx + colB - 16, y + 30, 12, 14);
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text(d.tpNF || '', bx + colB - 16, y + 32, { width: 12, align: 'center', lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(7);
  doc.text(`Nº ${d.numero}`, bx, y + 50, { width: colB, align: 'center', lineBreak: false });
  doc.text(`SÉRIE ${d.serie}`, bx, y + 59, { width: colB, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(6);
  doc.text('FOLHA', bx, y + 68, { width: colB, align: 'center', lineBreak: false });
  folhaStamps.push({ page: 0, x: bx + colB / 2, y: y + 68, w: colB / 2 - 2 });

  // Col C — barcode + chave + protocolo
  const cx = X0 + colA + colB;
  if (barcode) {
    try {
      doc.image(barcode, cx + 6, y + 4, { width: colC - 12, height: 22 });
    } catch {
      /* ignora imagem inválida */
    }
  }
  b.box(cx, y + 30, colC, 22);
  b.cell(cx, y + 30, colC, 22, 'CHAVE DE ACESSO', chaveEspacada(d.chave), {
    valueSize: 7,
    bold: true,
    align: 'center',
    drawBox: false,
    valueY: y + 40,
  });
  b.box(cx, y + 52, colC, headH - 52);
  b.paragraph(
    cx + 4,
    y + 55,
    colC - 8,
    'Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da Sefaz autorizadora',
    5.5,
  );

  y += headH;

  // natureza da operação | protocolo
  const natH = 18;
  const protW = 200;
  b.cell(X0, y, W - protW, natH, 'NATUREZA DA OPERAÇÃO', d.natOp, { valueSize: 7 });
  const protTxt = d.protocolo ? `${d.protocolo.nProt} - ${dataHoraSP(d.protocolo.dhRecbto)}` : '';
  b.cell(X0 + W - protW, y, protW, natH, 'PROTOCOLO DE AUTORIZAÇÃO DE USO', protTxt, { valueSize: 7 });
  y += natH;

  // IE | IE-ST | CNPJ
  const ieW = W / 3;
  b.cell(X0, y, ieW, natH, 'INSCRIÇÃO ESTADUAL', d.emit.ie, { valueSize: 7 });
  b.cell(X0 + ieW, y, ieW, natH, 'INSCR. ESTADUAL DO SUBST. TRIB.', d.emit.iest, { valueSize: 7 });
  b.cell(X0 + ieW * 2, y, W - ieW * 2, natH, 'CNPJ / CPF', cpfCnpj(d.emit.cnpj), { valueSize: 7 });
  y += natH;

  // ───────────────────────── DESTINATÁRIO ─────────────────────────
  y = titulo(b, X0, y, W, 'DESTINATÁRIO / REMETENTE');
  const r = 18;
  // Row1: nome | cnpj | data emissão
  b.cell(X0, y, W - 200, r, 'NOME / RAZÃO SOCIAL', d.dest.nome, { valueSize: 7 });
  b.cell(X0 + W - 200, y, 110, r, 'CNPJ / CPF', cpfCnpj(d.dest.cnpjCpf), { valueSize: 7 });
  b.cell(X0 + W - 90, y, 90, r, 'DATA DA EMISSÃO', dataSP(d.dhEmi), { valueSize: 7 });
  y += r;
  // Row2: endereço | bairro | cep | data saída
  const dEnd = [d.dest.logradouro, d.dest.numero, d.dest.complemento].filter(Boolean).join(', ');
  b.cell(X0, y, 250, r, 'ENDEREÇO', dEnd, { valueSize: 7 });
  b.cell(X0 + 250, y, 130, r, 'BAIRRO / DISTRITO', d.dest.bairro, { valueSize: 7 });
  b.cell(X0 + 380, y, 89, r, 'CEP', cep(d.dest.cep), { valueSize: 7 });
  b.cell(X0 + 469, y, W - 469, r, 'DATA DA SAÍDA / ENTRADA', dataSP(d.dhSaiEnt), { valueSize: 7 });
  y += r;
  // Row3: município | fone | uf | ie
  b.cell(X0, y, 220, r, 'MUNICÍPIO', d.dest.municipio, { valueSize: 7 });
  b.cell(X0 + 220, y, 120, r, 'FONE / FAX', fone(d.dest.fone), { valueSize: 7 });
  b.cell(X0 + 340, y, 30, r, 'UF', d.dest.uf, { valueSize: 7, align: 'center' });
  b.cell(X0 + 370, y, W - 370, r, 'INSCRIÇÃO ESTADUAL', d.dest.ie, { valueSize: 7 });
  y += r;

  // ───────────────────────── FATURA / DUPLICATAS ─────────────────────────
  if (d.duplicatas.length) {
    y = titulo(b, X0, y, W, 'FATURA / DUPLICATAS');
    const perRow = 7;
    const dupW = W / perRow;
    let col = 0;
    let rowY = y;
    for (const dup of d.duplicatas) {
      if (col === perRow) {
        col = 0;
        rowY += r;
      }
      b.cell(X0 + col * dupW, rowY, dupW, r, `DUP ${dup.nDup} · venc ${dup.dVenc}`, moeda(dup.vDup), {
        valueSize: 6.5,
        labelSize: 4.2,
        align: 'right',
        valueY: rowY + r - 9,
      });
      col++;
    }
    y = rowY + r;
  }

  // ───────────────────────── CÁLCULO DO IMPOSTO ─────────────────────────
  y = titulo(b, X0, y, W, 'CÁLCULO DO IMPOSTO');
  const c6 = W / 6;
  const t = d.totais;
  rowCells(b, X0, y, [
    ['BASE DE CÁLCULO DO ICMS', moeda(t.vBC), c6],
    ['VALOR DO ICMS', moeda(t.vICMS), c6],
    ['BASE DE CÁLCULO ICMS ST', moeda(t.vBCST), c6],
    ['VALOR DO ICMS ST', moeda(t.vST), c6],
    ['V. APROX. TRIBUTOS', num2(t.vTotTrib), c6],
    ['VALOR TOTAL DOS PRODUTOS', moeda(t.vProd), W - c6 * 5],
  ], r);
  y += r;
  rowCells(b, X0, y, [
    ['VALOR DO FRETE', moeda(t.vFrete), c6],
    ['VALOR DO SEGURO', moeda(t.vSeg), c6],
    ['DESCONTO', moeda(t.vDesc), c6],
    ['OUTRAS DESPESAS', moeda(t.vOutro), c6],
    ['VALOR DO IPI', moeda(t.vIPI), c6],
    ['VALOR TOTAL DA NOTA', moeda(t.vNF), W - c6 * 5],
  ], r, 5);
  y += r;

  // ───────────────────────── TRANSPORTADOR / VOLUMES ─────────────────────────
  y = titulo(b, X0, y, W, 'TRANSPORTADOR / VOLUMES TRANSPORTADOS');
  const tr = d.transp;
  b.cell(X0, y, 200, r, 'NOME / RAZÃO SOCIAL', tr.transportadorNome, { valueSize: 7 });
  b.cell(X0 + 200, y, 110, r, 'FRETE POR CONTA', MOD_FRETE[tr.modFrete] ?? tr.modFrete, { valueSize: 6 });
  b.cell(X0 + 310, y, 60, r, 'CÓDIGO ANTT', tr.rntc, { valueSize: 6 });
  b.cell(X0 + 370, y, 55, r, 'PLACA DO VEÍCULO', tr.placa, { valueSize: 6 });
  b.cell(X0 + 425, y, 24, r, 'UF', tr.placaUf, { valueSize: 6, align: 'center' });
  b.cell(X0 + 449, y, W - 449, r, 'CNPJ / CPF', cpfCnpj(tr.transportadorCnpjCpf), { valueSize: 6 });
  y += r;
  b.cell(X0, y, 250, r, 'ENDEREÇO', tr.transportadorEndereco, { valueSize: 7 });
  b.cell(X0 + 250, y, 170, r, 'MUNICÍPIO', tr.transportadorMunicipio, { valueSize: 7 });
  b.cell(X0 + 420, y, 24, r, 'UF', tr.transportadorUf, { valueSize: 7, align: 'center' });
  b.cell(X0 + 444, y, W - 444, r, 'INSCRIÇÃO ESTADUAL', tr.transportadorIe, { valueSize: 7 });
  y += r;
  const vol = tr.volumes[0] ?? { qVol: '', esp: '', marca: '', nVol: '', pesoL: '', pesoB: '' };
  const cv = W / 6;
  rowCells(b, X0, y, [
    ['QUANTIDADE', vol.qVol, cv],
    ['ESPÉCIE', vol.esp, cv],
    ['MARCA', vol.marca, cv],
    ['NUMERAÇÃO', vol.nVol, cv],
    ['PESO BRUTO', num2(vol.pesoB), cv],
    ['PESO LÍQUIDO', num2(vol.pesoL), W - cv * 5],
  ], r);
  y += r;

  // ───────────────────────── DADOS DOS PRODUTOS / SERVIÇOS ─────────────────────────
  y = titulo(b, X0, y, W, 'DADOS DOS PRODUTOS / SERVIÇOS');
  const cols: Col[] = [
    { label: 'CÓDIGO', w: 36, align: 'left', get: (i) => i.cProd },
    { label: 'DESCRIÇÃO', w: 138, align: 'left', get: (i) => i.xProd },
    { label: 'NCM/SH', w: 36, align: 'center', get: (i) => i.ncm },
    { label: 'CST', w: 22, align: 'center', get: (i) => i.cstOuCsosn },
    { label: 'CFOP', w: 24, align: 'center', get: (i) => i.cfop },
    { label: 'UN', w: 18, align: 'center', get: (i) => i.uCom },
    { label: 'QUANT', w: 38, align: 'right', get: (i) => qtd(i.qCom) },
    { label: 'V.UNIT', w: 44, align: 'right', get: (i) => num2(i.vUnCom, true) },
    { label: 'V.TOTAL', w: 46, align: 'right', get: (i) => num2(i.vProd, true) },
    { label: 'BC ICMS', w: 42, align: 'right', get: (i) => num2(i.vBcIcms) },
    { label: 'V.ICMS', w: 38, align: 'right', get: (i) => num2(i.vIcms) },
    { label: 'V.IPI', w: 30, align: 'right', get: (i) => num2(i.vIpi) },
    { label: 'ALÍQ ICMS', w: 22, align: 'right', get: (i) => num2(i.pIcms) },
    { label: 'ALÍQ IPI', w: 25, align: 'right', get: (i) => num2(i.pIpi) },
  ];

  const drawItemsHeader = (yy: number): number => {
    const hh = 14;
    let cxp = X0;
    for (const c of cols) {
      b.box(cxp, yy, c.w, hh);
      doc.font('Helvetica-Bold').fontSize(4.6).fillColor('#000000');
      doc.text(c.label, cxp + 1, yy + 3, { width: c.w - 2, align: 'center' });
      cxp += c.w;
    }
    return yy + hh;
  };

  y = drawItemsHeader(y);

  for (const item of d.itens) {
    const descH = b.heightOfString(item.xProd, 138 - 3, 6);
    const rowH = Math.max(9, descH + 3);
    if (y + rowH > bottom - 4) {
      // overflow → nova página, repete só o cabeçalho das colunas
      doc.addPage();
      y = b.margin;
      folhaStamps.push({ page: doc.bufferedPageRange().count - 1, x: X1 - 80, y: y, w: 78 });
      y += 8;
      y = drawItemsHeader(y);
    }
    let cxp = X0;
    for (const c of cols) {
      b.box(cxp, y, c.w, rowH);
      doc.font('Helvetica').fontSize(6).fillColor('#000000');
      const multiline = c.label === 'DESCRIÇÃO';
      doc.text(c.get(item) || '', cxp + 1.5, y + 2, {
        width: c.w - 3,
        align: c.align,
        lineBreak: multiline,
        ellipsis: !multiline,
      });
      cxp += c.w;
    }
    y += rowH;
  }

  // ───────────────────────── DADOS ADICIONAIS ─────────────────────────
  const addH = 76;
  if (y + addH + 8 > bottom) {
    doc.addPage();
    y = b.margin;
    folhaStamps.push({ page: doc.bufferedPageRange().count - 1, x: X1 - 80, y, w: 78 });
    y += 8;
  }
  y = titulo(b, X0, y, W, 'DADOS ADICIONAIS');
  const infoW = W - 200;
  b.box(X0, y, infoW, addH);
  b.cell(X0, y, infoW, addH, 'INFORMAÇÕES COMPLEMENTARES', '', { drawBox: false });
  b.paragraph(X0 + 3, y + 9, infoW - 6, [d.infCpl, d.infAdFisco].filter(Boolean).join('\n'), 6);
  b.cell(X0 + infoW, y, 200, addH, 'RESERVADO AO FISCO', '', {});
  y += addH;

  // ───────────────────────── FOLHA x/y ─────────────────────────
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (const st of folhaStamps) {
    doc.switchToPage(st.page);
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#000000');
    doc.text(`${st.page + 1}/${total}`, st.x, st.y, { width: st.w, align: 'center', lineBreak: false });
  }
}

/** Faixa de título de seção (texto pequeno em itálico, como no DANFE). */
function titulo(b: PdfBuilder, x: number, y: number, w: number, txt: string): number {
  b.doc.font('Helvetica-Oblique').fontSize(6).fillColor('#000000');
  b.doc.text(txt, x + 1, y + 1, { width: w, lineBreak: false });
  return y + 9;
}

/** Linha de N células [label, value, width]. */
function rowCells(
  b: PdfBuilder,
  x: number,
  y: number,
  cells: Array<[string, string, number]>,
  h: number,
  labelSize = 5,
): void {
  let cx = x;
  for (const [label, value, w] of cells) {
    b.cell(cx, y, w, h, label, value, { valueSize: 7, labelSize, align: 'right', valueY: y + h - 9 });
    cx += w;
  }
}
