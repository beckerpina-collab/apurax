import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { Agent, request as httpsRequest } from 'https';
import { ConsultaDfeParams, DocZipBruto, RetDistDFe, SefazDfeClient } from './sefaz-dfe.client';

/**
 * Implementação SOAP 1.2 + mTLS da Distribuição DFe (Ambiente Nacional da RFB).
 *
 * NF-e e CT-e são serviços separados (NSU independente). O `distDFeInt` é igual;
 * mudam URL, namespace e SOAPAction.
 *
 * ATENÇÃO (pré-deploy — ver docs/dfe-protocolo-custodia.md):
 *  - Confirmar a `versao` vigente do distDFeInt e as URLs no portal de homologação.
 *  - Esta implementação faz a chamada autenticada por mTLS (https.Agent com o PFX),
 *    mas NÃO foi exercitada contra a SEFAZ aqui (exige certificado + rede). Validar
 *    em homologação antes de produção.
 */
@Injectable()
export class SefazDfeSoapClient implements SefazDfeClient {
  private readonly logger = new Logger(SefazDfeSoapClient.name);
  private readonly parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true });

  private readonly endpoints = {
    NFE: {
      1: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
      2: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
      ns: 'http://www.portalfiscal.inf.br/nfe',
      soapAction: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse',
      metodo: 'nfeDistDFeInteresse',
      dadosMsg: 'nfeDadosMsg',
    },
    CTE: {
      1: 'https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx',
      2: 'https://hom1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx',
      ns: 'http://www.portalfiscal.inf.br/cte',
      soapAction: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe/cteDistDFeInteresse',
      metodo: 'cteDistDFeInteresse',
      dadosMsg: 'cteDadosMsg',
    },
  } as const;

  /** Monta o XML distDFeInt (puro — testável). */
  montarDistDFeInt(params: ConsultaDfeParams, namespace: string): string {
    const nsu = params.ultNsu.padStart(15, '0');
    return (
      `<distDFeInt versao="1.35" xmlns="${namespace}">` +
      `<tpAmb>${params.tpAmb}</tpAmb>` +
      `<cUFAutor>${params.cUF}</cUFAutor>` +
      `<CNPJ>${params.cnpj}</CNPJ>` +
      `<distNSU><ultNSU>${nsu}</ultNSU></distNSU>` +
      `</distDFeInt>`
    );
  }

  async consultar(params: ConsultaDfeParams): Promise<RetDistDFe> {
    const cfg = this.endpoints[params.modelo];
    const url = cfg[params.tpAmb === 1 ? 1 : 2];
    const distDFeInt = this.montarDistDFeInt(params, cfg.ns);
    const envelope =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
      `<soap12:Body><${cfg.metodo} xmlns="${cfg.ns}/wsdl/${params.modelo === 'NFE' ? 'NFeDistribuicaoDFe' : 'CTeDistribuicaoDFe'}">` +
      `<${cfg.dadosMsg}>${distDFeInt}</${cfg.dadosMsg}>` +
      `</${cfg.metodo}></soap12:Body></soap12:Envelope>`;

    const agent = new Agent({ pfx: params.pfx, passphrase: params.senha, keepAlive: false });
    const xmlResposta = await this.post(url, envelope, cfg.soapAction, agent);
    return this.parseRetorno(xmlResposta);
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
          res.on('end', () => resolve(data));
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  /** Extrai cStat/ultNSU/maxNSU e os docZip do retDistDFeInt (puro — testável). */
  parseRetorno(xml: string): RetDistDFe {
    const obj = this.parser.parse(xml) as Record<string, any>;
    const ret = this.localizar(obj, 'retDistDFeInt') ?? {};
    const lote = ret.loteDistDFeInt ?? ret.loteDistDFe ?? {};
    const docZipRaw = lote.docZip;
    const arr = docZipRaw === undefined ? [] : Array.isArray(docZipRaw) ? docZipRaw : [docZipRaw];
    const docs: DocZipBruto[] = arr.map((d: Record<string, unknown>) => ({
      nsu: String(d['@_NSU'] ?? ''),
      schema: String(d['@_schema'] ?? ''),
      conteudoBase64: String(d['#text'] ?? ''),
    }));
    return {
      cStat: String(ret.cStat ?? ''),
      xMotivo: String(ret.xMotivo ?? ''),
      ultNsu: String(ret.ultNSU ?? '0').padStart(15, '0'),
      maxNsu: String(ret.maxNSU ?? '0').padStart(15, '0'),
      docs,
    };
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
