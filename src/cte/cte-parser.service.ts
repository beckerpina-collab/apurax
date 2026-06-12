import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

export interface CteParsed {
  chaveAcesso: string;
  modelo: string; // '57'
  numero: string;
  serie: string;
  dataEmissao: Date;
  emitenteCnpj: string; // transportadora
  emitenteNome: string;
  tomadorCnpj: string | null; // resolvido por toma3/toma4
  tomadorPapel: string;
  cfop: string; // ide.CFOP — da transportadora (NÃO é o CFOP de escrituração do tomador)
  ufIni?: string;
  ufFim?: string;
  vTPrest: string;
  // grupo ICMS (polimórfico)
  grupoIcms: string;
  cstIcms: string;
  vBcIcms?: string;
  vIcms?: string;
  vCred?: string;
  cBenef?: string;
}

const PAPEL_POR_TOMA: Record<string, string> = {
  '0': 'REMETENTE',
  '1': 'EXPEDIDOR',
  '2': 'RECEBEDOR',
  '3': 'DESTINATARIO',
  '4': 'OUTROS',
};
const GRUPO_POR_TOMA: Record<string, string> = { '0': 'rem', '1': 'exped', '2': 'receb', '3': 'dest' };

@Injectable()
export class CteParserService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: false,
    parseTagValue: false,
    trimValues: true,
  });

  parse(xml: string): CteParsed {
    let obj: Record<string, unknown>;
    try {
      obj = this.parser.parse(xml);
    } catch {
      throw new BadRequestException('XML inválido ou ilegível.');
    }

    const root = obj as Record<string, unknown>;
    const cteProc = (root['cteProc'] as Record<string, unknown>) ?? root;
    const cte = (cteProc['CTe'] as Record<string, unknown>) ?? (root['CTe'] as Record<string, unknown>);
    const infCte = cte?.['infCte'] as Record<string, unknown> | undefined;
    if (!infCte) {
      throw new BadRequestException('Não foi possível localizar infCte — não parece um CT-e (modelo 57).');
    }

    const chaveAcesso = String(infCte['@_Id'] ?? '').replace(/\D/g, '');
    if (chaveAcesso.length !== 44) {
      throw new BadRequestException('Chave de acesso do CT-e ausente ou com tamanho diferente de 44 dígitos.');
    }

    const ide = (infCte['ide'] as Record<string, unknown>) ?? {};
    const emit = (infCte['emit'] as Record<string, unknown>) ?? {};
    const vPrest = (infCte['vPrest'] as Record<string, unknown>) ?? {};

    const dhEmi = String(ide['dhEmi'] ?? '');
    const tomador = this.resolverTomador(infCte, ide);
    const icms = this.extrairIcms(infCte);

    return {
      chaveAcesso,
      modelo: this.str(ide['mod']) ?? '57',
      numero: this.str(ide['nCT']) ?? '',
      serie: this.str(ide['serie']) ?? '',
      dataEmissao: dhEmi ? new Date(dhEmi) : new Date(0),
      emitenteCnpj: this.str(emit['CNPJ']) ?? '',
      emitenteNome: this.str(emit['xNome']) ?? '',
      tomadorCnpj: tomador.cnpj,
      tomadorPapel: tomador.papel,
      cfop: this.str(ide['CFOP']) ?? '',
      ufIni: this.str(ide['UFIni']),
      ufFim: this.str(ide['UFFim']),
      vTPrest: this.str(vPrest['vTPrest']) ?? '0',
      ...icms,
    };
  }

  private resolverTomador(
    infCte: Record<string, unknown>,
    ide: Record<string, unknown>,
  ): { cnpj: string | null; papel: string } {
    const toma3 = ide['toma3'] as Record<string, unknown> | undefined;
    const toma4 = ide['toma4'] as Record<string, unknown> | undefined;
    const codigo = this.str(toma3?.['toma']) ?? this.str(toma4?.['toma']) ?? '';

    if (toma4) {
      return { cnpj: this.str(toma4['CNPJ']) ?? this.str(toma4['CPF']) ?? null, papel: 'OUTROS' };
    }
    const grupo = GRUPO_POR_TOMA[codigo];
    const part = grupo ? (infCte[grupo] as Record<string, unknown> | undefined) : undefined;
    return {
      cnpj: part ? (this.str(part['CNPJ']) ?? this.str(part['CPF']) ?? null) : null,
      papel: PAPEL_POR_TOMA[codigo] ?? 'DESCONHECIDO',
    };
  }

  /** O grupo ICMS é polimórfico: a única chave-filha de imp.ICMS indica o subgrupo. */
  private extrairIcms(infCte: Record<string, unknown>): {
    grupoIcms: string;
    cstIcms: string;
    vBcIcms?: string;
    vIcms?: string;
    vCred?: string;
    cBenef?: string;
  } {
    const imp = (infCte['imp'] as Record<string, unknown>) ?? {};
    const icms = (imp['ICMS'] as Record<string, unknown>) ?? {};
    const grupoIcms = Object.keys(icms)[0] ?? '';
    const inner = (icms[grupoIcms] as Record<string, unknown>) ?? {};
    return {
      grupoIcms,
      cstIcms: this.str(inner['CST']) ?? '',
      vBcIcms: this.str(inner['vBC']) ?? this.str(inner['vBCOutraUF']),
      vIcms: this.str(inner['vICMS']) ?? this.str(inner['vICMSOutraUF']),
      vCred: this.str(inner['vCred']),
      cBenef: this.str(inner['cBenef']),
    };
  }

  private str(v: unknown): string | undefined {
    if (v === undefined || v === null || v === '') return undefined;
    return String(v);
  }
}
