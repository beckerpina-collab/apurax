import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

export interface DacteParte {
  nome: string;
  cnpjCpf: string;
  ie: string;
  endereco: string;
  municipio: string;
  uf: string;
  cep: string;
  fone: string;
}

export interface DacteData {
  chave: string;
  modelo: string;
  numero: string;
  serie: string;
  cfop: string;
  natOp: string;
  tpAmb: string;
  tpCTe: string; // 0=Normal,1=Complemento,2=Anulação,3=Substituto
  tpServ: string; // 0=Normal,1=Subcontratação,2=Redespacho,3=Redesp. Interm.,4=Vinc. Multimodal
  modal: string; // 01=Rodoviário, 02=Aéreo, 03=Aquaviário, 04=Ferroviário, 05=Dutoviário, 06=Multimodal
  dhEmi: Date | null;
  protocolo: { nProt: string; dhRecbto: Date | null } | null;

  municipioIni: string;
  ufIni: string;
  municipioFim: string;
  ufFim: string;

  emit: DacteParte & { im: string };
  remetente: DacteParte;
  destinatario: DacteParte;
  expedidor: DacteParte;
  recebedor: DacteParte;
  tomador: DacteParte & { papel: string };

  vTPrest: string;
  vRec: string;
  componentes: Array<{ nome: string; valor: string }>;

  cst: string;
  vBcIcms: string;
  pIcms: string;
  vIcms: string;
  pRedBc: string;

  produtoPredominante: string;
  vCarga: string;
  documentosNfe: string[]; // chaves de NF-e originárias

  observacoes: string;
}

@Injectable()
export class DacteParser {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: false,
    parseTagValue: false,
    trimValues: true,
  });

  parse(xml: string): DacteData {
    let obj: Record<string, unknown>;
    try {
      obj = this.parser.parse(xml) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('XML inválido ou ilegível.');
    }

    const cteProc = (obj['cteProc'] as Record<string, unknown>) ?? obj;
    const cte = (cteProc['CTe'] as Record<string, unknown>) ?? (obj['CTe'] as Record<string, unknown>);
    const infCte = cte?.['infCte'] as Record<string, unknown> | undefined;
    if (!infCte) {
      throw new BadRequestException('Não foi possível localizar infCte — não parece um CT-e (modelo 57).');
    }

    const chave = String(infCte['@_Id'] ?? '').replace(/\D/g, '');
    const ide = this.obj(infCte['ide']);
    const emit = this.obj(infCte['emit']);
    const rem = this.obj(infCte['rem']);
    const dest = this.obj(infCte['dest']);
    const exped = this.obj(infCte['exped']);
    const receb = this.obj(infCte['receb']);
    const vPrest = this.obj(infCte['vPrest']);
    const imp = this.obj(infCte['imp']);
    const icms = this.grupoInterno(imp['ICMS']);
    const infNorm = this.obj(infCte['infCTeNorm']);
    const infCarga = this.obj(infNorm['infCarga']);
    const infDoc = this.obj(infNorm['infDoc']);
    const compl = this.obj(infCte['compl']);
    const prot = this.obj((cteProc['protCTe'] as Record<string, unknown>)?.['infProt']);

    const componentes = this.arr(vPrest['Comp']).map((c) => {
      const comp = this.obj(c);
      return { nome: this.s(comp['xNome']), valor: this.s(comp['vComp']) };
    });

    const documentosNfe = this.arr(infDoc['infNFe']).map((d) => this.s(this.obj(d)['chave'])).filter(Boolean);

    const tomadorPapel = this.resolverTomador(ide);
    const tomadorParte = this.parteDoTomador(ide, rem, exped, receb, dest, tomadorPapel);

    return {
      chave,
      modelo: this.s(ide['mod']) || '57',
      numero: this.s(ide['nCT']),
      serie: this.s(ide['serie']),
      cfop: this.s(ide['CFOP']),
      natOp: this.s(ide['natOp']),
      tpAmb: this.s(ide['tpAmb']),
      tpCTe: this.s(ide['tpCTe']),
      tpServ: this.s(ide['tpServ']),
      modal: this.s(ide['modal']),
      dhEmi: this.data(this.s(ide['dhEmi'])),
      protocolo: prot['nProt'] ? { nProt: this.s(prot['nProt']), dhRecbto: this.data(this.s(prot['dhRecbto'])) } : null,
      municipioIni: this.s(ide['xMunIni']),
      ufIni: this.s(ide['UFIni']),
      municipioFim: this.s(ide['xMunFim']),
      ufFim: this.s(ide['UFFim']),
      emit: { ...this.parte(emit, this.obj(emit['enderEmit'])), im: this.s(emit['IM']) },
      remetente: this.parte(rem, this.obj(rem['enderReme'])),
      destinatario: this.parte(dest, this.obj(dest['enderDest'])),
      expedidor: this.parte(exped, this.obj(exped['enderExped'])),
      recebedor: this.parte(receb, this.obj(receb['enderReceb'])),
      tomador: { ...tomadorParte, papel: tomadorPapel },
      vTPrest: this.s(vPrest['vTPrest']),
      vRec: this.s(vPrest['vRec']),
      componentes,
      cst: this.s(icms['CST']),
      vBcIcms: this.s(icms['vBC']),
      pIcms: this.s(icms['pICMS']),
      vIcms: this.s(icms['vICMS']),
      pRedBc: this.s(icms['pRedBC']),
      produtoPredominante: this.s(infCarga['proPred']),
      vCarga: this.s(infCarga['vCarga']),
      documentosNfe,
      observacoes: this.s(compl['xObs']),
    };
  }

  /** toma3.toma (0..3) ou toma4 (=4, "outros", dados embutidos). */
  private resolverTomador(ide: Record<string, unknown>): string {
    const toma3 = this.obj(ide['toma3']);
    const toma4 = this.obj(ide['toma4']);
    if (toma4 && Object.keys(toma4).length) return '4';
    return this.s(toma3['toma']) || '';
  }

  private parteDoTomador(
    ide: Record<string, unknown>,
    rem: Record<string, unknown>,
    exped: Record<string, unknown>,
    receb: Record<string, unknown>,
    dest: Record<string, unknown>,
    papel: string,
  ): DacteParte {
    switch (papel) {
      case '0':
        return this.parte(rem, this.obj(rem['enderReme']));
      case '1':
        return this.parte(exped, this.obj(exped['enderExped']));
      case '2':
        return this.parte(receb, this.obj(receb['enderReceb']));
      case '3':
        return this.parte(dest, this.obj(dest['enderDest']));
      case '4': {
        const toma4 = this.obj(ide['toma4']);
        return this.parte(toma4, this.obj(toma4['enderToma']));
      }
      default:
        return this.parte({}, {});
    }
  }

  private parte(p: Record<string, unknown>, ender: Record<string, unknown>): DacteParte {
    const num = this.s(ender['nro']);
    const lgr = this.s(ender['xLgr']);
    const cpl = this.s(ender['xCpl']);
    const endereco = [lgr, num, cpl].filter(Boolean).join(', ');
    return {
      nome: this.s(p['xNome']),
      cnpjCpf: this.s(p['CNPJ']) || this.s(p['CPF']),
      ie: this.s(p['IE']),
      endereco,
      municipio: this.s(ender['xMun']),
      uf: this.s(ender['UF']),
      cep: this.s(ender['CEP']),
      fone: this.s(p['fone']),
    };
  }

  private grupoInterno(grupo: unknown): Record<string, unknown> {
    if (!grupo || typeof grupo !== 'object') return {};
    const interno = Object.values(grupo as Record<string, unknown>).find((v) => v && typeof v === 'object');
    return (interno as Record<string, unknown>) ?? {};
  }
  private obj(v: unknown): Record<string, unknown> {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  }
  private arr(v: unknown): unknown[] {
    if (v === undefined || v === null) return [];
    return Array.isArray(v) ? v : [v];
  }
  private s(v: unknown): string {
    if (v === undefined || v === null) return '';
    return String(v);
  }
  private data(v: string): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
}
