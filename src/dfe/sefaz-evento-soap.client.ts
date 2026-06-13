import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { Agent, request as httpsRequest } from 'https';
import { SignedXml } from 'xml-crypto';
import { montarEventoManifestacao, TipoEventoManifestacao } from './manifestacao';

export interface ManifestarParams {
  chave: string; // 44 dígitos
  cnpj: string; // destinatário que manifesta
  tpEvento: TipoEventoManifestacao;
  xJust?: string; // obrigatório p/ 210240
  nSeqEvento?: number;
  tpAmb: number; // 1=prod, 2=homolog
  dhEvento: string; // ISO com offset (-03:00)
  pfx: Buffer; // mTLS
  senha: string;
  privateKeyPem: string; // assinatura
  certDerBase64: string;
}

export interface RetManifestacao {
  cStatLote: string;
  cStat: string;
  xMotivo: string;
  nProt?: string;
}

const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

/**
 * Recepção de Evento (manifestação do destinatário NF-e) no Ambiente Nacional.
 * Assina o <infEvento> com XML-DSig (RSA-SHA1, C14N) usando o A1 e envia por mTLS.
 * NÃO validado contra a SEFAZ real — o cStat/xMotivo do retorno são logados/expostos.
 */
@Injectable()
export class SefazEventoSoapClient {
  private readonly logger = new Logger(SefazEventoSoapClient.name);
  private readonly parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true });

  private readonly url = {
    1: 'https://www1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    2: 'https://hom1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  } as const;
  private readonly ns = 'http://www.portalfiscal.inf.br/nfe';
  private readonly nsWsdl = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4';

  /** Assina o evento (XML-DSig enveloped sobre infEvento). */
  assinarEvento(eventoXml: string, privateKeyPem: string, certDerBase64: string): string {
    const sig = new SignedXml({
      privateKey: privateKeyPem,
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
      canonicalizationAlgorithm: C14N,
    });
    sig.addReference({
      xpath: "//*[local-name(.)='infEvento']",
      transforms: [ENVELOPED, C14N],
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    });
    sig.getKeyInfoContent = () => `<X509Data><X509Certificate>${certDerBase64}</X509Certificate></X509Data>`;
    sig.computeSignature(eventoXml, { location: { reference: "//*[local-name(.)='infEvento']", action: 'after' } });
    return sig.getSignedXml();
  }

  async manifestar(params: ManifestarParams): Promise<RetManifestacao> {
    const { xml: eventoXml } = montarEventoManifestacao({
      chNFe: params.chave,
      cnpj: params.cnpj,
      tpEvento: params.tpEvento,
      nSeqEvento: params.nSeqEvento,
      dhEvento: params.dhEvento,
      tpAmb: params.tpAmb,
      xJust: params.xJust,
    });
    const eventoAssinado = this.assinarEvento(eventoXml, params.privateKeyPem, params.certDerBase64);
    const idLote = String(params.dhEvento.replace(/\D/g, '')).slice(0, 15) || '1';
    const envEvento = `<envEvento versao="1.00" xmlns="${this.ns}"><idLote>${idLote}</idLote>${eventoAssinado}</envEvento>`;
    const envelope =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
      `<soap12:Body><nfeRecepcaoEvento xmlns="${this.nsWsdl}"><nfeDadosMsg>${envEvento}</nfeDadosMsg></nfeRecepcaoEvento>` +
      `</soap12:Body></soap12:Envelope>`;

    const agent = new Agent({ pfx: params.pfx, passphrase: params.senha, keepAlive: false });
    const soapAction = `${this.nsWsdl}/nfeRecepcaoEvento`;
    const resposta = await this.post(this.url[params.tpAmb === 1 ? 1 : 2], envelope, soapAction, agent);
    return this.parseRetorno(resposta);
  }

  private parseRetorno(xml: string): RetManifestacao {
    const obj = this.parser.parse(xml) as Record<string, any>;
    const ret = this.localizar(obj, 'retEnvEvento') ?? {};
    const evento = this.localizar(ret, 'infEvento') ?? {};
    const out: RetManifestacao = {
      cStatLote: String(ret.cStat ?? ''),
      cStat: String(evento.cStat ?? ret.cStat ?? ''),
      xMotivo: String(evento.xMotivo ?? ret.xMotivo ?? ''),
      nProt: evento.nProt ? String(evento.nProt) : undefined,
    };
    if (!out.cStat) {
      this.logger.warn(`Recepção Evento: resposta inesperada: ${xml.slice(0, 400)}`);
      throw new Error('A SEFAZ devolveu uma resposta inesperada na manifestação (sem cStat).');
    }
    this.logger.log(`Manifestação cStatLote=${out.cStatLote} cStat=${out.cStat} "${out.xMotivo}" nProt=${out.nProt ?? '-'}`);
    return out;
  }

  private localizar(obj: Record<string, any>, chave: string): Record<string, any> | undefined {
    if (obj == null || typeof obj !== 'object') return undefined;
    if (obj[chave]) return Array.isArray(obj[chave]) ? obj[chave][0] : obj[chave];
    for (const v of Object.values(obj)) {
      const achado = this.localizar(v as Record<string, any>, chave);
      if (achado) return achado;
    }
    return undefined;
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
            if (status < 200 || status >= 300) reject(new Error(`SEFAZ HTTP ${status}: ${data.slice(0, 300)}`));
            else resolve(data);
          });
        },
      );
      req.on('error', (e) => reject(new Error(`Falha de conexão com a SEFAZ: ${e.message}`)));
      req.setTimeout(20000, () => req.destroy(new Error('Tempo esgotado na SEFAZ (20s).')));
      req.write(body);
      req.end();
    });
  }
}
