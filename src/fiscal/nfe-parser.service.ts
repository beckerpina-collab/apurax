import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

export interface NfeItemParsed {
  numItem: number;
  codProduto: string;
  descricao: string;
  ncm: string;
  cfop: string;
  quantidade: string;
  valorProduto: string;
  cstIcms?: string;
  csosn?: string;
  vBcIcms?: string;
  vIcms?: string;
  vIcmsSt?: string;
  vCredIcmsSn?: string;
  cstPis?: string;
  vBcPis?: string;
  vPis?: string;
  cstCofins?: string;
  vBcCofins?: string;
  vCofins?: string;

  // IPI (det/imposto/IPI → IPITrib/IPINT). cEnq/clEnq são irmãos, não o grupo.
  cstIpi?: string;
  vIpi?: string;

  // IBS/CBS (reforma — grupo det/imposto/IBSCBS; presente a partir de 2026)
  cstIbsCbs?: string;
  cClassTrib?: string;
  vBcIbsCbs?: string;
  vCbs?: string;
  vIbsUf?: string;
  vIbsMun?: string;
  vIbs?: string;
}

export interface NfeParsed {
  chaveAcesso: string;
  modelo: string;
  numero: string;
  serie: string;
  dataEmissao: Date;
  tpNF: string; // 0=entrada, 1=saída (do ponto de vista do emitente)
  crt: string; // emit/CRT — 1/2=Simples, 3=Regime Normal, 4=MEI (roteador de regime)
  emitenteCnpj: string;
  emitenteNome: string;
  destinatarioCnpj: string;
  destinatarioNome: string;
  valorTotal: string;
  itens: NfeItemParsed[];
}

@Injectable()
export class NfeParserService {
  // processEntities:false neutraliza XXE / "billion laughs"; parseTagValue:false
  // mantém valores como string (precisão fiscal preservada).
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: false,
    parseTagValue: false,
    trimValues: true,
  });

  parse(xml: string): NfeParsed {
    let obj: Record<string, unknown>;
    try {
      obj = this.parser.parse(xml);
    } catch {
      throw new BadRequestException('XML inválido ou ilegível.');
    }

    const root = obj as Record<string, unknown>;
    const nfeProc = (root['nfeProc'] as Record<string, unknown>) ?? root;
    const nfe = (nfeProc['NFe'] as Record<string, unknown>) ?? (root['NFe'] as Record<string, unknown>);
    const infNFe = nfe?.['infNFe'] as Record<string, unknown> | undefined;
    if (!infNFe) {
      throw new BadRequestException('Não foi possível localizar infNFe — não parece uma NF-e (modelo 55).');
    }

    const chaveAcesso = String(infNFe['@_Id'] ?? '').replace(/\D/g, '');
    if (chaveAcesso.length !== 44) {
      throw new BadRequestException('Chave de acesso ausente ou com tamanho diferente de 44 dígitos.');
    }

    const ide = (infNFe['ide'] as Record<string, unknown>) ?? {};
    const emit = (infNFe['emit'] as Record<string, unknown>) ?? {};
    const dest = (infNFe['dest'] as Record<string, unknown>) ?? {};
    const total = ((infNFe['total'] as Record<string, unknown>)?.['ICMSTot'] as Record<string, unknown>) ?? {};

    const dhEmi = String(ide['dhEmi'] ?? ide['dEmi'] ?? '');
    const dataEmissao = dhEmi ? new Date(dhEmi) : new Date(0);

    const dets = this.asArray(infNFe['det']);
    const itens = dets.map((det, idx) => this.parseItem(det as Record<string, unknown>, idx));

    return {
      chaveAcesso,
      modelo: this.str(ide['mod']) ?? '55',
      numero: this.str(ide['nNF']) ?? '',
      serie: this.str(ide['serie']) ?? '',
      dataEmissao,
      tpNF: this.str(ide['tpNF']) ?? '',
      crt: this.str(emit['CRT']) ?? '',
      emitenteCnpj: this.str(emit['CNPJ']) ?? this.str(emit['CPF']) ?? '',
      emitenteNome: this.str(emit['xNome']) ?? '',
      destinatarioCnpj: this.str(dest['CNPJ']) ?? this.str(dest['CPF']) ?? '',
      destinatarioNome: this.str(dest['xNome']) ?? '',
      valorTotal: this.str(total['vNF']) ?? '0',
      itens,
    };
  }

  private parseItem(det: Record<string, unknown>, idx: number): NfeItemParsed {
    const prod = (det['prod'] as Record<string, unknown>) ?? {};
    const imposto = (det['imposto'] as Record<string, unknown>) ?? {};

    const icms = this.grupoInterno(imposto['ICMS']);
    const pis = this.grupoInterno(imposto['PIS']);
    const cofins = this.grupoInterno(imposto['COFINS']);

    // IPI: IPITrib (tributado, traz vIPI) / IPINT (não tributado) são irmãos de
    // cEnq/clEnq — ler por nome explícito, não pela heurística do "primeiro objeto".
    const ipi = (imposto['IPI'] as Record<string, unknown>) ?? {};
    const ipiTrib = (ipi['IPITrib'] as Record<string, unknown>) ?? {};
    const ipiNt = (ipi['IPINT'] as Record<string, unknown>) ?? {};

    // IBS/CBS (reforma) — grupo único por item; convive com os legados em 2026.
    const ibsCbs = (imposto['IBSCBS'] as Record<string, unknown>) ?? {};
    const gIbsCbs = (ibsCbs['gIBSCBS'] as Record<string, unknown>) ?? {};
    const gIbsUf = (gIbsCbs['gIBSUF'] as Record<string, unknown>) ?? {};
    const gIbsMun = (gIbsCbs['gIBSMun'] as Record<string, unknown>) ?? {};
    const gCbs = (gIbsCbs['gCBS'] as Record<string, unknown>) ?? {};

    return {
      numItem: Number(det['@_nItem'] ?? idx + 1),
      codProduto: this.str(prod['cProd']) ?? '',
      descricao: this.str(prod['xProd']) ?? '',
      ncm: this.str(prod['NCM']) ?? '',
      cfop: this.str(prod['CFOP']) ?? '',
      quantidade: this.str(prod['qCom']) ?? '0',
      valorProduto: this.str(prod['vProd']) ?? '0',
      cstIcms: this.str(icms['CST']),
      csosn: this.str(icms['CSOSN']),
      vBcIcms: this.str(icms['vBC']),
      vIcms: this.str(icms['vICMS']),
      vIcmsSt: this.str(icms['vICMSST']),
      vCredIcmsSn: this.str(icms['vCredICMSSN']),
      cstPis: this.str(pis['CST']),
      vBcPis: this.str(pis['vBC']),
      vPis: this.str(pis['vPIS']),
      cstCofins: this.str(cofins['CST']),
      vBcCofins: this.str(cofins['vBC']),
      vCofins: this.str(cofins['vCOFINS']),
      cstIpi: this.str(ipiTrib['CST']) ?? this.str(ipiNt['CST']),
      vIpi: this.str(ipiTrib['vIPI']),
      cstIbsCbs: this.str(ibsCbs['CST']),
      cClassTrib: this.str(ibsCbs['cClassTrib']),
      vBcIbsCbs: this.str(gIbsCbs['vBC']),
      vCbs: this.str(gCbs['vCBS']),
      vIbsUf: this.str(gIbsUf['vIBSUF']),
      vIbsMun: this.str(gIbsMun['vIBSMun']),
      vIbs: this.str(gIbsCbs['vIBS']),
    };
  }

  /** ICMS/PIS/COFINS são grupos polimórficos (ICMS00, ICMSSN101, PISAliq...); pega o objeto interno. */
  private grupoInterno(grupo: unknown): Record<string, unknown> {
    if (!grupo || typeof grupo !== 'object') {
      return {};
    }
    const valores = Object.values(grupo as Record<string, unknown>);
    const interno = valores.find((v) => v && typeof v === 'object');
    return (interno as Record<string, unknown>) ?? {};
  }

  private asArray(v: unknown): unknown[] {
    if (v === undefined || v === null) return [];
    return Array.isArray(v) ? v : [v];
  }

  private str(v: unknown): string | undefined {
    if (v === undefined || v === null || v === '') return undefined;
    return String(v);
  }
}
