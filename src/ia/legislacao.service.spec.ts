import { LegislacaoService } from './legislacao.service';

describe('LegislacaoService (RAG por termos)', () => {
  const svc = new LegislacaoService();

  it('recupera o Tema 779 ao buscar por insumo/essencialidade', () => {
    const r = svc.buscar('conceito de insumo e essencialidade', 3);
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((t) => t.fonte.includes('1.221.170') || t.fonte.includes('Tema 779'))).toBe(true);
  });

  it('recupera a Lei Kandir ao buscar crédito de ICMS na entrada', () => {
    const r = svc.buscar('crédito de ICMS na entrada', 3);
    expect(r.some((t) => t.fonte.includes('LC 87'))).toBe(true);
  });

  it('é insensível a acentos', () => {
    const comAcento = svc.buscar('não-cumulatividade', 3);
    expect(comAcento.length).toBeGreaterThan(0);
  });

  it('retorna vazio quando nada casa', () => {
    expect(svc.buscar('zzz qqq', 3)).toEqual([]);
  });
});
