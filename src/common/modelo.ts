/** Código do modelo do documento fiscal (55/65/57…) → rótulo curto das telas. */
export function rotuloModelo(modelo: string): 'NF-e' | 'CT-e' | 'NFS-e' {
  if (modelo === '55' || modelo === '65') return 'NF-e';
  if (modelo === '57') return 'CT-e';
  return 'NFS-e';
}
