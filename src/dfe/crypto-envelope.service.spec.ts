import { CryptoEnvelopeService } from './crypto-envelope.service';

describe('CryptoEnvelopeService (envelope encryption)', () => {
  const masterKey = Buffer.alloc(32, 7);
  const svc = new CryptoEnvelopeService(masterKey);

  it('cifra e decifra o certificado (round-trip), sem material em claro', () => {
    const env = svc.cifrarCertificado(Buffer.from('conteudo-do-pfx-de-teste', 'utf8'), 'senha-secreta');
    expect(env.encryptedPfx).not.toContain('conteudo');
    expect(env.encryptedSenha).not.toContain('senha');

    const aberto = svc.decifrarCertificado(env);
    expect(aberto.pfx.toString('utf8')).toBe('conteudo-do-pfx-de-teste');
    expect(aberto.senha).toBe('senha-secreta');
  });

  it('detecta adulteração do ciphertext (AES-GCM authTag)', () => {
    const env = svc.cifrarCertificado(Buffer.from('pfx-original-aaaaaaaa', 'utf8'), 's');
    const adulterado = {
      ...env,
      encryptedPfx: Buffer.from('pfx-adulterado-bbbbb', 'utf8').toString('base64'),
    };
    expect(() => svc.decifrarCertificado(adulterado)).toThrow();
  });

  it('exige master key de 32 bytes', () => {
    expect(() => new CryptoEnvelopeService(Buffer.alloc(16))).toThrow();
  });
});
