import { Injectable, Logger } from '@nestjs/common';
import { Agent, request as httpsRequest } from 'https';
import { gunzipSync } from 'zlib';

/**
 * Cliente do ADN — Ambiente de Dados Nacional da NFS-e (Sistema Nacional NFS-e,
 * gov.br/nfse; Manual dos Contribuintes das APIs do ADN v1.0, 12/02/2026).
 * Distribui ao contribuinte (como EMITENTE, tomador ou intermediário) os DF-e de
 * serviço — NFS-e e eventos — por POLLING de NSU (igual à Distribuição DFe da NF-e):
 *   GET {base}/DFe/{NSU}?lote=true&tipoNSU=DISTRIBUICAO  → lote de até 50 DF-e.
 * REST/JSON sobre HTTPS, autenticado por mTLS com e-CNPJ A1 (sem OAuth). O XML da
 * NFS-e vem assinado, embutido GZip+Base64 no JSON.
 *
 * ⚠️ NÃO validado contra o ADN real. O schema JSON exato do lote (nomes de campos,
 * paginação, status "sem documentos") é LACUNA — o parser abaixo é TOLERANTE (procura
 * o array e os campos por nomes prováveis) e DEVE ser ajustado ao Swagger de produção
 * restrita (adn.producaorestrita.nfse.gov.br/contribuintes) com certificado real.
 */

const BASE = {
  1: 'https://adn.nfse.gov.br/contribuintes',
  2: 'https://adn.producaorestrita.nfse.gov.br/contribuintes',
} as const;

// Anti-DoS: teto do conteúdo comprimido (Base64→buffer) e do descomprimido (gunzip),
// e teto da resposta HTTP acumulada — evita zip/gzip bomb e resposta gigante (OOM).
const MAX_COMPRIMIDO = 8 * 1024 * 1024; // 8 MB comprimido
const MAX_DESCOMPRIMIDO = 16 * 1024 * 1024; // 16 MB após gunzip
const MAX_RESPOSTA = 32 * 1024 * 1024; // 32 MB de corpo HTTP (lote de até 50 DF-e)

export type TpAmbAdn = 1 | 2;

export interface AdnDoc {
  nsu: string;
  chave: string;
  xml: string | null; // XML da NFS-e/DPS/evento (descomprimido)
}

export interface AdnResult {
  status: string; // status do processamento / cStat-like
  ultNsu: string; // maior NSU retornado neste lote
  maxNsu: string; // maior NSU existente no ADN p/ o contribuinte
  documentos: AdnDoc[];
}

@Injectable()
export class AdnNfseClient {
  private readonly logger = new Logger(AdnNfseClient.name);

  async distribuir(p: { pfx: Buffer; senha: string; tpAmb: TpAmbAdn; ultNsu: string }): Promise<AdnResult> {
    const url = `${BASE[p.tpAmb]}/DFe/${encodeURIComponent(p.ultNsu)}?lote=true&tipoNSU=DISTRIBUICAO`;
    const agent = new Agent({ pfx: p.pfx, passphrase: p.senha, keepAlive: false });
    const body = await this.get(url, agent);
    const r = this.parse(body);
    this.logger.log(`ADN NFS-e tpAmb=${p.tpAmb} status=${r.status} docs=${r.documentos.length} ultNSU=${r.ultNsu} maxNSU=${r.maxNsu}`);
    return r;
  }

  /** Parser TOLERANTE do JSON do ADN (nomes de campos a confirmar no Swagger real). */
  parse(jsonStr: string): AdnResult {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {
      return { status: 'ERRO_JSON', ultNsu: '0', maxNsu: '0', documentos: [] };
    }
    const lote = this.acharArray(obj);
    const documentos: AdnDoc[] = lote.map((d) => {
      const item = (d ?? {}) as Record<string, unknown>;
      const b64 = this.primeiroValor(item, ['ArquivoXml', 'arquivoXml', 'documentoXml', 'DocumentoXml', 'xml', 'conteudo', 'conteudoXml']);
      return {
        nsu: String(this.primeiroValor(item, ['NSU', 'nsu', 'Nsu']) ?? ''),
        chave: String(this.primeiroValor(item, ['ChaveAcesso', 'chaveAcesso', 'chave', 'idDfe']) ?? ''),
        xml: b64 ? this.descomprimir(String(b64)) : null,
      };
    });
    return {
      status: String(this.primeiroValor(obj, ['StatusProcessamento', 'statusProcessamento', 'status', 'situacao']) ?? 'OK'),
      ultNsu: String(this.primeiroValor(obj, ['UltimoNSU', 'ultimoNSU', 'ultNsu', 'nsuFinal']) ?? this.maiorNsu(documentos)),
      maxNsu: String(this.primeiroValor(obj, ['NsuMaximo', 'nsuMaximo', 'maxNsu', 'NSUMaximo']) ?? this.maiorNsu(documentos)),
      documentos,
    };
  }

  /** XML embutido vem GZip+Base64; se não for gzip, tenta base64 puro. */
  private descomprimir(b64: string): string | null {
    try {
      const buf = Buffer.from(b64, 'base64');
      if (buf.length > MAX_COMPRIMIDO) {
        this.logger.warn(`ADN: documento comprimido grande demais (${buf.length} bytes) — ignorado.`);
        return null;
      }
      try {
        // maxOutputLength barra gzip bomb (lança RangeError em vez de estourar a memória).
        return gunzipSync(buf, { maxOutputLength: MAX_DESCOMPRIMIDO }).toString('utf8');
      } catch {
        if (buf.length > MAX_DESCOMPRIMIDO) return null; // não-gzip: limita o texto cru também
        const txt = buf.toString('utf8');
        return txt.includes('<') ? txt : null;
      }
    } catch {
      return null;
    }
  }

  private acharArray(obj: Record<string, unknown>): unknown[] {
    for (const k of ['LoteDFe', 'loteDFe', 'lote', 'documentos', 'Documentos', 'DFe', 'dfe', 'data']) {
      const v = obj[k];
      if (Array.isArray(v)) return v;
    }
    // fallback: o primeiro array de objetos encontrado no topo
    for (const v of Object.values(obj)) if (Array.isArray(v)) return v;
    return [];
  }

  private primeiroValor(obj: Record<string, unknown>, chaves: string[]): unknown {
    for (const k of chaves) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    return undefined;
  }

  private maiorNsu(docs: AdnDoc[]): string {
    return docs.reduce((m, d) => (Number(d.nsu) > Number(m) ? d.nsu : m), '0');
  }

  private get(url: string, agent: Agent): Promise<string> {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const req = httpsRequest(
        { hostname: u.hostname, path: `${u.pathname}${u.search}`, method: 'GET', agent, headers: { Accept: 'application/json' } },
        (res) => {
          let data = '';
          let abortado = false;
          res.on('data', (c) => {
            if (abortado) return;
            data += c;
            if (data.length > MAX_RESPOSTA) {
              abortado = true;
              res.destroy();
              reject(new Error('ADN NFS-e: resposta excede o limite de tamanho — abortada (anti-DoS).'));
            }
          });
          res.on('end', () => {
            if (abortado) return;
            const status = res.statusCode ?? 0;
            if (status === 200) resolve(data);
            else if (status === 204) resolve('{"documentos":[]}'); // sem documentos novos
            else reject(new Error(`ADN NFS-e HTTP ${status}: ${data.slice(0, 300)}`));
          });
        },
      );
      req.on('error', (e) => reject(new Error(`Falha de conexão com o ADN (NFS-e): ${e.message}`)));
      req.setTimeout(20000, () => req.destroy(new Error('Tempo esgotado ao consultar o ADN (20s).')));
      req.end();
    });
  }
}
