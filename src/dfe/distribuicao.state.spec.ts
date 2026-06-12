import { avaliarResposta } from './distribuicao.state';

describe('avaliarResposta (máquina de estados da Distribuição DFe)', () => {
  it('138 com ultNSU < maxNSU → encadeia (CONSULTAR_JA, sem cooldown)', () => {
    const r = avaliarResposta('138', '000000000000050', '000000000000875', '000000000000000');
    expect(r.estado).toBe('CONSULTAR_JA');
    expect(r.ultNsu).toBe('000000000000050');
    expect(r.cooldownSegundos).toBe(0);
  });

  it('138 sincronizado (ultNSU == maxNSU) → COOLDOWN', () => {
    const r = avaliarResposta('138', '000000000000875', '000000000000875', '000000000000800');
    expect(r.estado).toBe('COOLDOWN');
    expect(r.cooldownSegundos).toBeGreaterThan(0);
  });

  it('137 (vazio) → COOLDOWN e NÃO avança o NSU', () => {
    const r = avaliarResposta('137', '000000000000800', '000000000000800', '000000000000800');
    expect(r.estado).toBe('COOLDOWN');
    expect(r.ultNsu).toBe('000000000000800');
  });

  it('656 (consumo indevido) → BLOQUEADO e não avança o NSU', () => {
    const r = avaliarResposta('656', '0', '0', '000000000000800');
    expect(r.estado).toBe('BLOQUEADO');
    expect(r.ultNsu).toBe('000000000000800');
  });

  it('cStat desconhecido → ERRO sem avançar o NSU', () => {
    const r = avaliarResposta('215', '0', '0', '000000000000800');
    expect(r.estado).toBe('ERRO');
    expect(r.ultNsu).toBe('000000000000800');
  });
});
