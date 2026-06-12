import { Injectable } from '@nestjs/common';
import { gunzipSync } from 'zlib';

export type TipoDocumento =
  | 'NFE_RESUMO'
  | 'NFE_COMPLETA'
  | 'CTE_RESUMO'
  | 'CTE_COMPLETA'
  | 'EVENTO'
  | 'DESCONHECIDO';

/**
 * Decode e roteamento do conteúdo de cada `docZip` da Distribuição DFe.
 * Conteúdo = Base64( GZIP( XML ) ) — usar gunzip (RFC 1952), nunca inflate.
 * O roteamento é pelo PREFIXO do atributo `schema` (antes de `_`), tolerando
 * variação de versão e presença/ausência de `v`.
 */
@Injectable()
export class DocZipService {
  decodificar(conteudoBase64: string): string {
    return gunzipSync(Buffer.from(conteudoBase64, 'base64')).toString('utf8');
  }

  classificar(schema: string): TipoDocumento {
    const prefixo = (schema ?? '').split('_')[0].toLowerCase();
    switch (prefixo) {
      case 'resnfe':
        return 'NFE_RESUMO';
      case 'procnfe':
        return 'NFE_COMPLETA';
      case 'rescte':
        return 'CTE_RESUMO';
      case 'proccte':
        return 'CTE_COMPLETA';
      case 'resevento':
      case 'reseventocte':
      case 'proceventonfe':
      case 'proceventocte':
        return 'EVENTO';
      default:
        return 'DESCONHECIDO';
    }
  }
}
