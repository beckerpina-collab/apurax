import { Injectable } from '@nestjs/common';

export interface TrechoLegal {
  fonte: string;
  titulo: string;
  trecho: string;
}

interface DocLegal extends TrechoLegal {
  tags: string;
}

/**
 * RAG sobre legislação (versão MVP: corpus curado + recuperação por sobreposição
 * de termos). Em produção, evoluir para embeddings + pgvector. O agente usa isto
 * via a tool `buscar_base_legal` para SEMPRE citar a fonte ao explicar um crédito.
 */
@Injectable()
export class LegislacaoService {
  private readonly corpus: DocLegal[] = [
    {
      fonte: 'CF, art. 155, §2º, I',
      titulo: 'Não-cumulatividade do ICMS',
      trecho:
        'O ICMS será não-cumulativo, compensando-se o que for devido em cada operação com o montante cobrado nas anteriores.',
      tags: 'icms credito nao cumulatividade entrada compensacao',
    },
    {
      fonte: 'LC 87/1996 (Kandir), art. 20',
      titulo: 'Direito ao crédito de ICMS na entrada',
      trecho:
        'É assegurado ao contribuinte o direito de creditar-se do ICMS anteriormente cobrado em operações de entrada de mercadoria, real ou simbólica, destinada à comercialização ou industrialização.',
      tags: 'icms credito entrada revenda insumo industrializacao kandir',
    },
    {
      fonte: 'LC 87/1996, art. 33',
      titulo: 'Restrições ao crédito (uso/consumo, energia, comunicação)',
      trecho:
        'O crédito de ICMS sobre uso/consumo é postergado; energia elétrica e comunicação só dão crédito em hipóteses específicas (industrialização, exportação).',
      tags: 'icms vedacao uso consumo energia comunicacao ativo restricao',
    },
    {
      fonte: 'Lei 10.637/2002, art. 3º (PIS)',
      titulo: 'Crédito de PIS no regime não-cumulativo',
      trecho:
        'No regime não-cumulativo (Lucro Real) a pessoa jurídica pode descontar créditos de PIS sobre bens para revenda, insumos, energia, aluguéis de PJ, fretes e depreciação, entre outros.',
      tags: 'pis credito nao cumulativo lucro real insumo aluguel frete energia',
    },
    {
      fonte: 'Lei 10.833/2003, art. 3º (COFINS)',
      titulo: 'Crédito de COFINS no regime não-cumulativo',
      trecho:
        'No regime não-cumulativo a pessoa jurídica pode descontar créditos de COFINS sobre bens para revenda, insumos, energia, aluguéis de PJ, fretes e depreciação. No regime cumulativo (Lucro Presumido) não há crédito.',
      tags: 'cofins credito nao cumulativo lucro real presumido cumulativo insumo',
    },
    {
      fonte: 'IN RFB 2.121/2022',
      titulo: 'Consolidação da legislação de PIS/COFINS',
      trecho:
        'Consolida as regras de apuração de PIS/COFINS, incluindo o conceito de insumo e as hipóteses sem direito a crédito (monofásico, substituição tributária, alíquota zero, isenção, suspensão).',
      tags: 'pis cofins insumo monofasico substituicao aliquota zero isencao suspensao cst',
    },
    {
      fonte: 'STJ, REsp 1.221.170/PR (Tema 779)',
      titulo: 'Conceito de insumo: essencialidade e relevância',
      trecho:
        'O conceito de insumo para fins de crédito de PIS/COFINS deve ser aferido pelos critérios da essencialidade ou relevância do bem/serviço para a atividade econômica do contribuinte.',
      tags: 'insumo essencialidade relevancia tema 779 stj pis cofins zona cinzenta credito',
    },
    {
      fonte: 'EC 132/2023 + LC 214/2025',
      titulo: 'Reforma tributária: CBS/IBS e crédito financeiro amplo',
      trecho:
        'A CBS (federal) e o IBS (estadual/municipal) substituem PIS/COFINS e ICMS/ISS na transição. O modelo adota não-cumulatividade plena com crédito financeiro amplo: praticamente toda aquisição vinculada à atividade gera crédito, salvo uso/consumo pessoal.',
      tags: 'reforma cbs ibs credito financeiro amplo transicao 2026 nao cumulatividade plena',
    },
  ];

  buscar(consulta: string, k = 3): TrechoLegal[] {
    const termos = this.normalizar(consulta)
      .split(/\s+/)
      .filter((t) => t.length >= 3);
    if (termos.length === 0) {
      return [];
    }

    return this.corpus
      .map((doc) => {
        const alvo = this.normalizar(`${doc.titulo} ${doc.trecho} ${doc.tags}`);
        const score = termos.reduce((s, termo) => (alvo.includes(termo) ? s + 1 : s), 0);
        return { doc, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(({ doc }) => ({ fonte: doc.fonte, titulo: doc.titulo, trecho: doc.trecho }));
  }

  /** lowercase + remove acentos (sem regex de combinantes, por robustez). */
  private normalizar(texto: string): string {
    const decomposto = texto.normalize('NFD');
    let saida = '';
    for (const ch of decomposto) {
      const code = ch.codePointAt(0) ?? 0;
      if (code < 0x0300 || code > 0x036f) {
        saida += ch;
      }
    }
    return saida.toLowerCase();
  }
}
