import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export const KMS_MASTER_KEY = 'KMS_MASTER_KEY';

export interface EnvelopeCifrado {
  encryptedPfx: string;
  pfxIv: string;
  pfxAuthTag: string;
  encryptedSenha: string;
  senhaIv: string;
  senhaAuthTag: string;
  encryptedDek: string;
  dekIv: string;
  dekAuthTag: string;
}

interface CampoCifrado {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/** Envelope de um segredo de texto genérico (ex.: tokens OAuth do Bling). */
export interface SegredoCifrado {
  tokenCiphertext: string;
  tokenIv: string;
  tokenAuthTag: string;
  encryptedDek: string;
  dekIv: string;
  dekAuthTag: string;
}

/**
 * Envelope encryption para custódia do certificado A1:
 * - DEK aleatória de 256 bits por certificado cifra o PFX e a senha (AES-256-GCM).
 * - A DEK é embrulhada (wrap) pela master key (KMS em produção; chave de ambiente
 *   em dev). Só a DEK cifrada é persistida; a master key nunca sai do cofre.
 * - O material em claro só existe em memória do worker, no momento do uso.
 */
@Injectable()
export class CryptoEnvelopeService {
  constructor(@Inject(KMS_MASTER_KEY) private readonly masterKey: Buffer) {
    if (masterKey.length !== 32) {
      throw new Error('KMS_MASTER_KEY deve ter 32 bytes (256 bits).');
    }
  }

  cifrarCertificado(pfx: Buffer, senha: string): EnvelopeCifrado {
    const dek = randomBytes(32);
    const pfxC = this.cifrar(dek, pfx);
    const senhaC = this.cifrar(dek, Buffer.from(senha, 'utf8'));
    const dekC = this.cifrar(this.masterKey, dek); // wrap da DEK
    dek.fill(0);
    return {
      encryptedPfx: pfxC.ciphertext,
      pfxIv: pfxC.iv,
      pfxAuthTag: pfxC.authTag,
      encryptedSenha: senhaC.ciphertext,
      senhaIv: senhaC.iv,
      senhaAuthTag: senhaC.authTag,
      encryptedDek: dekC.ciphertext,
      dekIv: dekC.iv,
      dekAuthTag: dekC.authTag,
    };
  }

  /** Descriptografa em memória. O chamador deve zerar o PFX após o uso. */
  decifrarCertificado(env: EnvelopeCifrado): { pfx: Buffer; senha: string } {
    const dek = this.decifrar(this.masterKey, {
      ciphertext: env.encryptedDek,
      iv: env.dekIv,
      authTag: env.dekAuthTag,
    });
    try {
      const pfx = this.decifrar(dek, {
        ciphertext: env.encryptedPfx,
        iv: env.pfxIv,
        authTag: env.pfxAuthTag,
      });
      const senha = this.decifrar(dek, {
        ciphertext: env.encryptedSenha,
        iv: env.senhaIv,
        authTag: env.senhaAuthTag,
      });
      return { pfx, senha: senha.toString('utf8') };
    } finally {
      dek.fill(0);
    }
  }

  /** Cifra um segredo de texto (ex.: JSON de tokens OAuth) com envelope encryption. */
  cifrarSegredo(texto: string): SegredoCifrado {
    const dek = randomBytes(32);
    const c = this.cifrar(dek, Buffer.from(texto, 'utf8'));
    const dekC = this.cifrar(this.masterKey, dek); // wrap da DEK
    dek.fill(0);
    return {
      tokenCiphertext: c.ciphertext,
      tokenIv: c.iv,
      tokenAuthTag: c.authTag,
      encryptedDek: dekC.ciphertext,
      dekIv: dekC.iv,
      dekAuthTag: dekC.authTag,
    };
  }

  /** Decifra um segredo cifrado por `cifrarSegredo`, em memória. */
  decifrarSegredo(env: SegredoCifrado): string {
    const dek = this.decifrar(this.masterKey, {
      ciphertext: env.encryptedDek,
      iv: env.dekIv,
      authTag: env.dekAuthTag,
    });
    try {
      const txt = this.decifrar(dek, {
        ciphertext: env.tokenCiphertext,
        iv: env.tokenIv,
        authTag: env.tokenAuthTag,
      });
      return txt.toString('utf8');
    } finally {
      dek.fill(0);
    }
  }

  private cifrar(chave: Buffer, dados: Buffer): CampoCifrado {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', chave, iv);
    const ciphertext = Buffer.concat([cipher.update(dados), cipher.final()]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  private decifrar(chave: Buffer, c: CampoCifrado): Buffer {
    const decipher = createDecipheriv('aes-256-gcm', chave, Buffer.from(c.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(c.authTag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(c.ciphertext, 'base64')), decipher.final()]);
  }
}
