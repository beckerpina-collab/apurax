import { Prisma, RegraCredito, Tributo } from '@prisma/client';

/** Regras de crédito espelhando o seed (prisma/seed.ts), para testes sem banco. */
function r(codigo: string, tributo: Tributo, condicao: Record<string, unknown>, prioridade: number): RegraCredito {
  return {
    id: codigo,
    codigo,
    tributo,
    descricao: codigo,
    baseLegal: `base-legal-${codigo}`,
    condicao: condicao as Prisma.JsonValue,
    prioridade,
    vigenciaInicio: new Date('2000-01-01'),
    vigenciaFim: null,
    ativo: true,
  };
}

export const REGRAS_SEED: RegraCredito[] = [
  r('R-ICMS-CRED-NORMAL', Tributo.ICMS, { cstIn: ['00', '10', '20', '70'], regimeNotIn: ['SIMPLES_NACIONAL'], campoValor: 'vIcms', creditoPermitido: true }, 10),
  r('R-ICMS-CRED-SN', Tributo.ICMS, { csosnIn: ['101', '201'], regimeNotIn: ['SIMPLES_NACIONAL'], campoValor: 'vCredIcmsSn', creditoPermitido: true }, 10),
  r('R-ICMS-VEDADO', Tributo.ICMS, { cstIn: ['40', '41', '50', '51', '60', '90'], campoValor: 'vIcms', creditoPermitido: false }, 50),
  r('R-ICMS-VEDADO-SN', Tributo.ICMS, { csosnIn: ['102', '103', '300', '400', '500', '900'], campoValor: 'vCredIcmsSn', creditoPermitido: false }, 50),
  r('R-PIS-CRED', Tributo.PIS, { cstIn: ['01', '02'], regimeIn: ['LUCRO_REAL'], campoValor: 'vPis', creditoPermitido: true }, 10),
  r('R-PIS-VEDADO', Tributo.PIS, { cstIn: ['04', '05', '06', '07', '08', '09'], campoValor: 'vPis', creditoPermitido: false }, 50),
  r('R-COFINS-CRED', Tributo.COFINS, { cstIn: ['01', '02'], regimeIn: ['LUCRO_REAL'], campoValor: 'vCofins', creditoPermitido: true }, 10),
  r('R-COFINS-VEDADO', Tributo.COFINS, { cstIn: ['04', '05', '06', '07', '08', '09'], campoValor: 'vCofins', creditoPermitido: false }, 50),
];
