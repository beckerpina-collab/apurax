import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

/** Item da NF-e na visão do DANFE (dados do produto/serviço). */
export interface DanfeNfeItem {
  nItem: number;
  cProd: string;
  xProd: string;
  ncm: string;
  cstOuCsosn: string; // origem + CST (regime normal) ou origem + CSOSN (Simples)
  cfop: string;
  uCom: string;
  qCom: string;
  vUnCom: string;
  vProd: string;
  vBcIcms: string;
  vIcms: string;
  vIpi: string;
  pIcms: string;
  pIpi: string;
}

export interface DanfeNfeData {
  chave: string;
  modelo: string;
  numero: string;
  serie: string;
  tpNF: string; // 0=entrada, 1=saída
  natOp: string;
  tpAmb: string; // 1=produção, 2=homologação (marca d'água)
  dhEmi: Date | null;
  dhSaiEnt: Date | null;
  protocolo: { nProt: string; dhRecbto: Date | null } | null;

  emit: {
    nome: string;
    fantasia: string;
    cnpj: string;
    ie: string;
    iest: string;
    im: string;
    crt: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
    fone: string;
  };
  dest: {
    nome: string;
    cnpjCpf: string;
    ie: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
    fone: string;
  };
  totais: {
    vBC: string;
    vICMS: string;
    vICMSDeson: string;
    vBCST: string;
    vST: string;
    vProd: string;
    vFrete: string;
    vSeg: string;
    vDesc: string;
    vII: string;
    vIPI: string;
    vPIS: string;
    vCOFINS: string;
    vOutro: string;
    vNF: string;
    vTotTrib: string;
  };
  transp: {
    modFrete: string;
    transportadorNome: string;
    transportadorCnpjCpf: string;
    transportadorIe: string;
    transportadorEndereco: string;
    transportadorMunicipio: string;
    transportadorUf: string;
    placa: string;
    placaUf: string;
    rntc: string;
    volumes: Array<{ qVol: string; esp: string; marca: string; nVol: string; pesoL: string; pesoB: string }>;
  };
  duplicatas: Array<{ nDup: string; dVenc: string; vDup: string }>;
  infCpl: string;
  infAdFisco: string;
  itens: DanfeNfeItem[];
}

@Injectable()
export class DanfeNfeParser {
  // processEntities:false neutraliza XXE; parseTagValue:false preserva strings (precisão fiscal).
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: false,
    parseTagValue: false,
    trimValues: true,
  });

  parse(xml: string): DanfeNfeData {
    let obj: Record<string, unknown>;
    try {
      obj = this.parser.parse(xml) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('XML inválido ou ilegível.');
    }

    const nfeProc = (obj['nfeProc'] as Record<string, unknown>) ?? obj;
    const nfe = (nfeProc['NFe'] as Record<string, unknown>) ?? (obj['NFe'] as Record<string, unknown>);
    const infNFe = nfe?.['infNFe'] as Record<string, unknown> | undefined;
    if (!infNFe) {
      throw new BadRequestException('Não foi possível localizar infNFe — não parece uma NF-e (modelo 55).');
    }

    const chave = String(infNFe['@_Id'] ?? '').replace(/\D/g, '');
    const ide = this.obj(infNFe['ide']);
    const emit = this.obj(infNFe['emit']);
    const enderEmit = this.obj(emit['enderEmit']);
    const dest = this.obj(infNFe['dest']);
    const enderDest = this.obj(dest['enderDest']);
    const total = this.obj(this.obj(infNFe['total'])['ICMSTot']);
    const transp = this.obj(infNFe['transp']);
    const transporta = this.obj(transp['transporta']);
    const veicTransp = this.obj(transp['veicTransp']);
    const cobr = this.obj(infNFe['cobr']);
    const infAdic = this.obj(infNFe['infAdic']);

    const prot = this.obj((nfeProc['protNFe'] as Record<string, unknown>)?.['infProt']);

    const dets = this.arr(infNFe['det']);
    const itens = dets.map((d, i) => this.parseItem(this.obj(d), i));

    const dups = this.arr(cobr['dup']).map((d) => {
      const dup = this.obj(d);
      return { nDup: this.s(dup['nDup']), dVenc: this.dataBR(this.s(dup['dVenc'])), vDup: this.s(dup['vDup']) };
    });

    const volumes = this.arr(transp['vol']).map((v) => {
      const vol = this.obj(v);
      return {
        qVol: this.s(vol['qVol']),
        esp: this.s(vol['esp']),
        marca: this.s(vol['marca']),
        nVol: this.s(vol['nVol']),
        pesoL: this.s(vol['pesoL']),
        pesoB: this.s(vol['pesoB']),
      };
    });

    return {
      chave,
      modelo: this.s(ide['mod']) || '55',
      numero: this.s(ide['nNF']),
      serie: this.s(ide['serie']),
      tpNF: this.s(ide['tpNF']),
      natOp: this.s(ide['natOp']),
      tpAmb: this.s(ide['tpAmb']),
      dhEmi: this.data(this.s(ide['dhEmi']) || this.s(ide['dEmi'])),
      dhSaiEnt: this.data(this.s(ide['dhSaiEnt']) || this.s(ide['dSaiEnt'])),
      protocolo: prot['nProt'] ? { nProt: this.s(prot['nProt']), dhRecbto: this.data(this.s(prot['dhRecbto'])) } : null,
      emit: {
        nome: this.s(emit['xNome']),
        fantasia: this.s(emit['xFant']),
        cnpj: this.s(emit['CNPJ']) || this.s(emit['CPF']),
        ie: this.s(emit['IE']),
        iest: this.s(emit['IEST']),
        im: this.s(emit['IM']),
        crt: this.s(emit['CRT']),
        logradouro: this.s(enderEmit['xLgr']),
        numero: this.s(enderEmit['nro']),
        complemento: this.s(enderEmit['xCpl']),
        bairro: this.s(enderEmit['xBairro']),
        municipio: this.s(enderEmit['xMun']),
        uf: this.s(enderEmit['UF']),
        cep: this.s(enderEmit['CEP']),
        fone: this.s(enderEmit['fone']),
      },
      dest: {
        nome: this.s(dest['xNome']),
        cnpjCpf: this.s(dest['CNPJ']) || this.s(dest['CPF']),
        ie: this.s(dest['IE']),
        logradouro: this.s(enderDest['xLgr']),
        numero: this.s(enderDest['nro']),
        complemento: this.s(enderDest['xCpl']),
        bairro: this.s(enderDest['xBairro']),
        municipio: this.s(enderDest['xMun']),
        uf: this.s(enderDest['UF']),
        cep: this.s(enderDest['CEP']),
        fone: this.s(enderDest['fone']),
      },
      totais: {
        vBC: this.s(total['vBC']),
        vICMS: this.s(total['vICMS']),
        vICMSDeson: this.s(total['vICMSDeson']),
        vBCST: this.s(total['vBCST']),
        vST: this.s(total['vST']),
        vProd: this.s(total['vProd']),
        vFrete: this.s(total['vFrete']),
        vSeg: this.s(total['vSeg']),
        vDesc: this.s(total['vDesc']),
        vII: this.s(total['vII']),
        vIPI: this.s(total['vIPI']),
        vPIS: this.s(total['vPIS']),
        vCOFINS: this.s(total['vCOFINS']),
        vOutro: this.s(total['vOutro']),
        vNF: this.s(total['vNF']),
        vTotTrib: this.s(total['vTotTrib']),
      },
      transp: {
        modFrete: this.s(transp['modFrete']),
        transportadorNome: this.s(transporta['xNome']),
        transportadorCnpjCpf: this.s(transporta['CNPJ']) || this.s(transporta['CPF']),
        transportadorIe: this.s(transporta['IE']),
        transportadorEndereco: this.s(transporta['xEnder']),
        transportadorMunicipio: this.s(transporta['xMun']),
        transportadorUf: this.s(transporta['UF']),
        placa: this.s(veicTransp['placa']),
        placaUf: this.s(veicTransp['UF']),
        rntc: this.s(veicTransp['RNTC']),
        volumes,
      },
      duplicatas: dups,
      infCpl: this.s(infAdic['infCpl']),
      infAdFisco: this.s(infAdic['infAdFisco']),
      itens,
    };
  }

  private parseItem(det: Record<string, unknown>, idx: number): DanfeNfeItem {
    const prod = this.obj(det['prod']);
    const imposto = this.obj(det['imposto']);
    const icms = this.grupoInterno(imposto['ICMS']);
    const ipi = this.obj(imposto['IPI']);
    const ipiTrib = this.obj(ipi['IPITrib']);

    const orig = this.s(icms['orig']);
    const cst = this.s(icms['CST']);
    const csosn = this.s(icms['CSOSN']);
    const cstOuCsosn = `${orig}${cst || csosn}`.trim();

    return {
      nItem: Number(det['@_nItem'] ?? idx + 1),
      cProd: this.s(prod['cProd']),
      xProd: this.s(prod['xProd']),
      ncm: this.s(prod['NCM']),
      cstOuCsosn,
      cfop: this.s(prod['CFOP']),
      uCom: this.s(prod['uCom']),
      qCom: this.s(prod['qCom']),
      vUnCom: this.s(prod['vUnCom']),
      vProd: this.s(prod['vProd']),
      vBcIcms: this.s(icms['vBC']),
      vIcms: this.s(icms['vICMS']),
      vIpi: this.s(ipiTrib['vIPI']),
      pIcms: this.s(icms['pICMS']),
      pIpi: this.s(ipiTrib['pIPI']),
    };
  }

  /** ICMS é grupo polimórfico (ICMS00, ICMSSN101...); retorna o objeto interno. */
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
  private dataBR(v: string): string {
    const d = this.data(v);
    if (!d) return v;
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(d);
  }
}
