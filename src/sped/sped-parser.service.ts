import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Parser de SPED EFD-Contribuições (arquivo texto pipe-delimitado).
 * Convenção dos índices: `arr = linha.split('|')` → arr[0]="" , arr[1]=REG,
 * arr[2]=primeiro campo... (índice de array == nº oficial do campo no Guia).
 * Posições verificadas contra o Guia Prático (ver docs/sped-efd-contribuicoes-layout.md).
 */
export interface SpedItem {
  numItem: string;
  codItem: string;
  descricao: string;
  vlItem: Prisma.Decimal;
  cfop: string;
  cstIcms: string;
  vlBcIcms: Prisma.Decimal;
  vlIcms: Prisma.Decimal;
  cstPis: string;
  vlBcPis: Prisma.Decimal;
  aliqPis: Prisma.Decimal;
  vlPis: Prisma.Decimal;
  cstCofins: string;
  vlBcCofins: Prisma.Decimal;
  aliqCofins: Prisma.Decimal;
  vlCofins: Prisma.Decimal;
}

export interface SpedDocumento {
  indOper: string; // '0' = entrada (gera crédito); '1' = saída
  codMod: string;
  serie: string;
  numDoc: string;
  chaveAcesso: string;
  vlDoc: Prisma.Decimal;
  itens: SpedItem[];
}

export interface SpedArquivo {
  codVersao: string;
  cnpj: string;
  nome: string;
  dtIni: Date;
  dtFin: Date;
  documentos: SpedDocumento[];
  creditoPisDeclarado: Prisma.Decimal; // Σ M100.VL_CRED
  creditoCofinsDeclarado: Prisma.Decimal; // Σ M500.VL_CRED
  totalLinhas: number;
}

@Injectable()
export class SpedParserService {
  parse(conteudo: string): SpedArquivo {
    const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim().length > 0);

    let codVersao = '';
    let cnpj = '';
    let nome = '';
    let dtIni: Date | null = null;
    let dtFin: Date | null = null;
    let totalLinhas = 0;
    let creditoPisDeclarado = new Prisma.Decimal(0);
    let creditoCofinsDeclarado = new Prisma.Decimal(0);
    const documentos: SpedDocumento[] = [];
    let atual: SpedDocumento | null = null;

    for (const linha of linhas) {
      const a = linha.split('|');
      switch (a[1]) {
        case '0000':
          codVersao = a[2] ?? '';
          dtIni = this.data(a[6]);
          dtFin = this.data(a[7]);
          nome = a[8] ?? '';
          cnpj = (a[9] ?? '').replace(/\D/g, '');
          break;
        case 'C100':
          atual = {
            indOper: a[2] ?? '',
            codMod: a[5] ?? '',
            serie: a[7] ?? '',
            numDoc: a[8] ?? '',
            chaveAcesso: (a[9] ?? '').replace(/\D/g, ''),
            vlDoc: this.dec(a[12]),
            itens: [],
          };
          documentos.push(atual);
          break;
        case 'C170':
          if (atual) {
            atual.itens.push({
              numItem: a[2] ?? '',
              codItem: a[3] ?? '',
              descricao: a[4] ?? '',
              vlItem: this.dec(a[7]),
              cstIcms: a[10] ?? '',
              cfop: a[11] ?? '',
              vlBcIcms: this.dec(a[13]),
              vlIcms: this.dec(a[15]),
              cstPis: a[25] ?? '',
              vlBcPis: this.dec(a[26]),
              aliqPis: this.dec(a[27]),
              vlPis: this.dec(a[30]),
              cstCofins: a[31] ?? '',
              vlBcCofins: this.dec(a[32]),
              aliqCofins: this.dec(a[33]),
              vlCofins: this.dec(a[36]),
            });
          }
          break;
        case 'M100': // crédito de PIS apurado — VL_CRED = arr[8]
          creditoPisDeclarado = creditoPisDeclarado.add(this.dec(a[8]));
          break;
        case 'M500': // crédito de COFINS apurado — VL_CRED = arr[8]
          creditoCofinsDeclarado = creditoCofinsDeclarado.add(this.dec(a[8]));
          break;
        case '9999':
          totalLinhas = Number(a[2] ?? 0);
          break;
        default:
          break;
      }
    }

    if (!dtIni || !dtFin || !cnpj) {
      throw new BadRequestException('Registro 0000 ausente ou inválido — não parece uma EFD-Contribuições.');
    }

    return {
      codVersao,
      cnpj,
      nome,
      dtIni,
      dtFin,
      documentos,
      creditoPisDeclarado,
      creditoCofinsDeclarado,
      totalLinhas,
    };
  }

  /** Converte número do SPED ("1000,00") em Decimal. Vazio => 0. */
  private dec(v: string | undefined): Prisma.Decimal {
    const s = (v ?? '').trim();
    if (!s) return new Prisma.Decimal(0);
    return new Prisma.Decimal(s.replace(',', '.'));
  }

  /** Converte data SPED "ddmmaaaa" em Date (UTC). */
  private data(v: string | undefined): Date | null {
    const s = (v ?? '').trim();
    if (s.length !== 8) return null;
    const dia = Number(s.slice(0, 2));
    const mes = Number(s.slice(2, 4));
    const ano = Number(s.slice(4, 8));
    return new Date(Date.UTC(ano, mes - 1, dia));
  }
}
