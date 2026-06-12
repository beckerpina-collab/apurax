import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

export interface NfseParsed {
  chaveAcesso: string;
  numero?: string;
  dhEmi: Date;
  prestadorCnpj: string;
  tomadorCnpj?: string;
  cTribNac?: string;
  municipioIncidencia?: string;
  descServico?: string;
  vServ: string;
  vBc: string;
  pAliq: string;
  vIss: string;
  tpRetISSQN: string; // 1=não retido (prestador recolhe); 2/3=retido
  tribISSQN?: string; // 1=tributável; 2/3/4=fora
}

/**
 * Parser de NFS-e (padrão nacional — DPS/NFS-e). Os caminhos exatos do leiaute
 * ainda variam entre fontes ([INCERTO] no doc) — por isso a leitura dos valores
 * é tolerante (busca recursiva por nome de tag); prestador/tomador são lidos por
 * navegação explícita. Validar contra o XSD oficial (gov.br/nfse) antes do go-live.
 */
@Injectable()
export class NfseParserService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: false,
    parseTagValue: false,
    removeNSPrefix: true,
    trimValues: true,
  });

  parse(xml: string): NfseParsed {
    let obj: Record<string, unknown>;
    try {
      obj = this.parser.parse(xml) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('XML inválido ou ilegível.');
    }

    const nfse = (obj['NFSe'] as Record<string, unknown>) ?? obj;
    const infNFSe = (nfse['infNFSe'] as Record<string, unknown>) ?? {};
    // DPS embutida (declaração) — onde ficam prestador/tomador/serviço.
    const dps =
      ((infNFSe['DPS'] as Record<string, unknown>)?.['infDPS'] as Record<string, unknown>) ??
      ((obj['DPS'] as Record<string, unknown>)?.['infDPS'] as Record<string, unknown>) ??
      {};

    const prest = (dps['prest'] as Record<string, unknown>) ?? {};
    const toma = (dps['toma'] as Record<string, unknown>) ?? {};

    const chaveAcesso = String(infNFSe['@_Id'] ?? this.achar(nfse, 'chNFSe') ?? '').replace(/\D/g, '');
    if (!chaveAcesso) {
      throw new BadRequestException('Não foi possível localizar a chave da NFS-e (não parece uma NFS-e nacional).');
    }
    const prestadorCnpj = String(prest['CNPJ'] ?? prest['CPF'] ?? this.achar(prest, 'CNPJ') ?? '');
    if (!prestadorCnpj) {
      throw new BadRequestException('Prestador não localizado no XML da NFS-e.');
    }

    const dhEmiStr = String(this.achar(dps, 'dhEmi') ?? this.achar(infNFSe, 'dhProc') ?? '');

    return {
      chaveAcesso,
      numero: this.achar(infNFSe, 'nNFSe') ?? this.achar(dps, 'nDPS'),
      dhEmi: dhEmiStr ? new Date(dhEmiStr) : new Date(0),
      prestadorCnpj,
      tomadorCnpj: String(toma['CNPJ'] ?? toma['CPF'] ?? '') || undefined,
      cTribNac: this.achar(dps, 'cTribNac'),
      municipioIncidencia: this.achar(infNFSe, 'cLocIncid') ?? this.achar(dps, 'cLocPrestacao'),
      descServico: this.achar(dps, 'xDescServ'),
      // valores: vISSQN/pAliqAplic/vBC vêm da NFS-e autorizada; vServ da DPS.
      vServ: this.achar(infNFSe, 'vServ') ?? '0',
      vBc: this.achar(infNFSe, 'vBC') ?? this.achar(infNFSe, 'vServ') ?? '0',
      pAliq: this.achar(infNFSe, 'pAliqAplic') ?? '0',
      vIss: this.achar(infNFSe, 'vISSQN') ?? '0',
      tpRetISSQN: this.achar(dps, 'tpRetISSQN') ?? this.achar(infNFSe, 'tpRetISSQN') ?? '1',
      tribISSQN: this.achar(dps, 'tribISSQN') ?? this.achar(infNFSe, 'tribISSQN'),
    };
  }

  /** Busca recursiva pelo primeiro valor escalar de uma tag (tolerante ao agrupamento). */
  private achar(obj: unknown, chave: string): string | undefined {
    if (obj == null || typeof obj !== 'object') return undefined;
    const rec = obj as Record<string, unknown>;
    const direto = rec[chave];
    if (direto != null && typeof direto !== 'object') {
      const s = String(direto).trim();
      return s === '' ? undefined : s;
    }
    for (const v of Object.values(rec)) {
      const achado = this.achar(v, chave);
      if (achado !== undefined) return achado;
    }
    return undefined;
  }
}
