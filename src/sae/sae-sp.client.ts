import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { Agent, request as httpsRequest } from 'https';

/**
 * Cliente do SAE — Serviços de Apoio à Escrituração da NFC-e da SEFAZ-SP
 * (NT SAE-NFC-e v1.00, jan/2026). Dois webservices SOAP (.asmx) sobre HTTPS,
 * autenticados por mTLS com e-CNPJ A1 (mesmo padrão dos WS do Projeto NF-e):
 *  - NFCeListagemChaves: período → chaves das NFC-e emitidas pelo CNPJ do certificado;
 *  - NFCeDownloadXML: chave → XML completo (nfeProc/NFe) + eventos.
 *
 * ⚠️ NÃO validado contra a SEFAZ aqui (exige e-CNPJ + rede). Os builders/parsers da
 * ÁREA DE DADOS seguem a NT; o ENVELOPE SOAP exterior (método/SOAPAction/binding) é o
 * melhor palpite e DEVE ser confirmado no WSDL real (endpoint + "?wsdl") em homologação.
 * As constantes ENV_* abaixo isolam exatamente o que pode precisar de ajuste.
 */

const NS = 'http://www.portalfiscal.inf.br/nfe'; // namespace padrão da NF-e (NT manda usar)

const SVC = {
  listagem: {
    url: {
      1: 'https://nfce.fazenda.sp.gov.br/ws/NFCeListagemChaves.asmx',
      2: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFCeListagemChaves.asmx',
    },
    metodo: 'NFCeListagemChaves', // [CONFIRMAR no WSDL] nome da operação .asmx
  },
  download: {
    url: {
      1: 'https://nfce.fazenda.sp.gov.br/ws/NFCeDownloadXML.asmx',
      2: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFCeDownloadXML.asmx',
    },
    metodo: 'NFCeDownloadXML',
  },
} as const;

export type TpAmb = 1 | 2;

export interface SaeListagemResult {
  cStat: string;
  xMotivo: string;
  chaves: string[];
  /** data/hora de emissão da última NFC-e retornada — cursor p/ paginar (cStat 101). */
  dhEmisUltNfce: string;
}

export interface SaeDownloadResult {
  cStat: string;
  xMotivo: string;
  /** XML cru (nfeProc/NFe) da NFC-e autorizada; null se a resposta não trouxe o documento. */
  xml: string | null;
}

@Injectable()
export class SaeSpClient {
  private readonly logger = new Logger(SaeSpClient.name);
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    processEntities: false, // anti-XXE na resposta
    parseTagValue: false, // CRÍTICO: chave de 44 dígitos NÃO pode virar number (perde precisão)
  });

  // ---- builders (puros, testáveis) ----

  /** Área de dados do NFCeListagemChaves (datas no formato AAAA-MM-DDThh:mm). */
  montarListagemChaves(p: { tpAmb: TpAmb; dataHoraInicial: string; dataHoraFinal?: string }): string {
    return (
      `<nfceListagemChaves versao="1.00" xmlns="${NS}">` +
      `<tpAmb>${p.tpAmb}</tpAmb>` +
      `<dataHoraInicial>${p.dataHoraInicial}</dataHoraInicial>` +
      (p.dataHoraFinal ? `<dataHoraFinal>${p.dataHoraFinal}</dataHoraFinal>` : '') +
      `</nfceListagemChaves>`
    );
  }

  /** Área de dados do NFCeDownloadXML (uma chave de 44 dígitos por chamada). */
  montarDownloadXml(p: { tpAmb: TpAmb; chNFCe: string }): string {
    return (
      `<nfceDownloadXML versao="1.00" xmlns="${NS}">` +
      `<tpAmb>${p.tpAmb}</tpAmb>` +
      `<chNFCe>${p.chNFCe}</chNFCe>` +
      `</nfceDownloadXML>`
    );
  }

  // ---- parsers (puros, testáveis) ----

  parseListagem(xmlResposta: string): SaeListagemResult {
    const ret = this.localizar(this.parser.parse(this.desescapar(xmlResposta)), 'retNfceListagemChaves') ?? {};
    const ch = ret.chNFCe;
    const chaves = ch == null ? [] : (Array.isArray(ch) ? ch : [ch]).map((c) => String(c).replace(/\D/g, '')).filter((c) => c.length === 44);
    return {
      cStat: String(ret.cStat ?? ''),
      xMotivo: String(ret.xMotivo ?? ''),
      chaves,
      dhEmisUltNfce: ret.dhEmisUltNfce ? String(ret.dhEmisUltNfce) : '',
    };
  }

  parseDownload(xmlResposta: string): SaeDownloadResult {
    const desc = this.desescapar(xmlResposta);
    const ret = this.localizar(this.parser.parse(desc), 'retNfceDownloadXML') ?? {};
    return {
      cStat: String(ret.cStat ?? ''),
      xMotivo: String(ret.xMotivo ?? ''),
      xml: this.extrairNfe(desc),
    };
  }

  /** Extrai a substring CRUA do <nfeProc>…</nfeProc> (ou <NFe>…</NFe>) p/ guardar/importar. */
  private extrairNfe(xml: string): string | null {
    const proc = xml.match(/<nfeProc[\s\S]*?<\/nfeProc>/i);
    if (proc) return proc[0];
    const nfe = xml.match(/<NFe[\s>][\s\S]*?<\/NFe>/i);
    return nfe ? nfe[0] : null;
  }

  /** Alguns .asmx devolvem o XML de retorno escapado dentro do elemento *Result. */
  private desescapar(xml: string): string {
    if (/&lt;\s*ret(Nfce|NFCe)/.test(xml)) {
      return xml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    }
    return xml;
  }

  // ---- transporte (mTLS) ----

  async listarChaves(p: {
    pfx: Buffer;
    senha: string;
    tpAmb: TpAmb;
    dataHoraInicial: string;
    dataHoraFinal?: string;
  }): Promise<SaeListagemResult> {
    const dados = this.montarListagemChaves(p);
    const xml = await this.chamar(SVC.listagem, p.tpAmb, dados, p.pfx, p.senha);
    const r = this.parseListagem(xml);
    if (!r.cStat) {
      this.logger.warn(`SAE-SP listagem resposta inesperada: ${xml.slice(0, 400)}`);
      throw new Error('SAE-SP devolveu resposta inesperada (sem cStat) — verificar certificado/schema/conexão.');
    }
    this.logger.log(`SAE-SP listagem tpAmb=${p.tpAmb} cStat=${r.cStat} "${r.xMotivo}" chaves=${r.chaves.length}`);
    return r;
  }

  async baixarXml(p: { pfx: Buffer; senha: string; tpAmb: TpAmb; chNFCe: string }): Promise<SaeDownloadResult> {
    const dados = this.montarDownloadXml(p);
    const xml = await this.chamar(SVC.download, p.tpAmb, dados, p.pfx, p.senha);
    const r = this.parseDownload(xml);
    if (!r.cStat) {
      this.logger.warn(`SAE-SP download resposta inesperada: ${xml.slice(0, 400)}`);
      throw new Error('SAE-SP devolveu resposta inesperada (sem cStat).');
    }
    return r;
  }

  private chamar(
    svc: { url: Record<1 | 2, string>; metodo: string },
    tpAmb: TpAmb,
    dados: string,
    pfx: Buffer,
    senha: string,
  ): Promise<string> {
    const url = svc.url[tpAmb];
    const soapAction = `${NS}/wsdl/${svc.metodo}`; // [CONFIRMAR no WSDL]
    const envelope =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
      `<soap12:Body><${svc.metodo} xmlns="${NS}/wsdl/${svc.metodo}">${dados}</${svc.metodo}></soap12:Body>` +
      `</soap12:Envelope>`;
    const agent = new Agent({ pfx, passphrase: senha, keepAlive: false });
    return this.post(url, envelope, soapAction, agent);
  }

  private post(url: string, body: string, soapAction: string, agent: Agent): Promise<string> {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const req = httpsRequest(
        {
          hostname: u.hostname,
          path: u.pathname,
          method: 'POST',
          agent,
          headers: {
            'Content-Type': `application/soap+xml; charset=utf-8; action="${soapAction}"`,
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            const status = res.statusCode ?? 0;
            if (status < 200 || status >= 300) reject(new Error(`SAE-SP HTTP ${status}: ${data.slice(0, 300)}`));
            else resolve(data);
          });
        },
      );
      req.on('error', (e) => reject(new Error(`Falha de conexão com o SAE-SP: ${e.message}`)));
      req.setTimeout(20000, () => req.destroy(new Error('Tempo esgotado ao consultar o SAE-SP (20s).')));
      req.write(body);
      req.end();
    });
  }

  private localizar(obj: Record<string, any>, chave: string): Record<string, any> | undefined {
    if (obj == null || typeof obj !== 'object') return undefined;
    if (obj[chave]) return obj[chave];
    for (const v of Object.values(obj)) {
      const achado = this.localizar(v as Record<string, any>, chave);
      if (achado) return achado;
    }
    return undefined;
  }
}
