import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { apurarIcms, somarDebitoIcms } from './apuracao-icms';
import { somarCbsIbs, TributoReforma } from './apuracao-cbs-ibs';
import { apurarIpi, somarCreditoIpi, somarDebitoIpi } from './apuracao-ipi';
import { apurarPisCofins, ModalidadePisCofins, somarDebitoPisCofins, TributoPC } from './apuracao-pis-cofins';
import { apurarIss, NotaServicoIss } from './apuracao-iss';
import { Anexo, anexoPorFatorR, calcularDas } from './simples-das';

/** Linha de resultado de apuração — contrato ÚNICO consumido pela tela Apurações.
 *  PIS/COFINS devolve 2 linhas; os demais, 1. Valores em number (não Decimal/string). */
export interface ResultadoImposto {
  imposto: string;
  competencia: string;
  debito: number;
  credito: number;
  saldoCredorAnterior: number;
  aRecolher: number;
  saldoCredorTransportar: number;
}

@Injectable()
export class ApuracaoFiscalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private linha(
    imposto: string,
    competencia: string,
    v: {
      debito: Prisma.Decimal;
      credito: Prisma.Decimal;
      saldoCredorAnterior: Prisma.Decimal;
      aRecolher: Prisma.Decimal;
      saldoCredorTransportar: Prisma.Decimal;
    },
  ): ResultadoImposto {
    return {
      imposto,
      competencia,
      debito: v.debito.toNumber(),
      credito: v.credito.toNumber(),
      saldoCredorAnterior: v.saldoCredorAnterior.toNumber(),
      aRecolher: v.aRecolher.toNumber(),
      saldoCredorTransportar: v.saldoCredorTransportar.toNumber(),
    };
  }

  /**
   * Apuração de ICMS de uma competência (regime normal): débito das saídas −
   * crédito das entradas (± saldo credor anterior) → saldo a recolher / credor.
   */
  async apurarIcmsCompetencia(empresaId: string, ano: number, mes: number) {
    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada para este tenant.');
    }
    if (empresa.regimeTributario === 'SIMPLES_NACIONAL') {
      throw new NotFoundException('Empresa do Simples Nacional apura via DAS, não por débito-crédito de ICMS.');
    }

    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(ano, mes, 1));

    // DÉBITO: ICMS próprio das saídas (NF-e/NFC-e) da competência.
    const saidas = await this.prisma.scoped.documentoFiscal.findMany({
      where: { empresaId, tipoOperacao: 'SAIDA', dataEmissao: { gte: inicio, lt: fim } },
      include: { itens: { select: { cstIcms: true, vIcms: true } } },
    });
    const debito = somarDebitoIcms(saidas.flatMap((d) => d.itens));

    // CRÉDITO: apurações de ICMS permitidas das entradas da competência (motor).
    const entradas = await this.prisma.scoped.documentoFiscal.findMany({
      where: { empresaId, tipoOperacao: 'ENTRADA', dataEmissao: { gte: inicio, lt: fim } },
      include: { apuracoes: { where: { tributo: 'ICMS', creditoPermitido: true }, select: { valorCredito: true } } },
    });
    const credito = entradas
      .flatMap((d) => d.apuracoes)
      .reduce((s, a) => s.add(a.valorCredito), new Prisma.Decimal(0));

    // SALDO CREDOR ANTERIOR: transportado da competência anterior.
    const antMes = mes === 1 ? 12 : mes - 1;
    const antAno = mes === 1 ? ano - 1 : ano;
    const anterior = await this.prisma.scoped.apuracaoImposto.findFirst({
      where: { empresaId, imposto: 'ICMS', ano: antAno, mes: antMes },
    });
    const saldoCredorAnterior = anterior?.saldoCredorTransportar ?? new Prisma.Decimal(0);

    const r = apurarIcms({ debito, credito, saldoCredorAnterior });

    const apuracao = await this.prisma.scoped.apuracaoImposto.upsert({
      where: { tenantId_empresaId_imposto_ano_mes: { tenantId: this.prisma.tenantId, empresaId, imposto: 'ICMS', ano, mes } },
      create: {
        tenantId: this.prisma.tenantId,
        empresaId,
        imposto: 'ICMS',
        ano,
        mes,
        debito,
        credito,
        saldoCredorAnterior,
        saldoApurado: r.saldoApurado,
        aRecolher: r.aRecolher,
        saldoCredorTransportar: r.saldoCredorTransportar,
        detalhe: { totalDebitos: r.totalDebitos.toString(), totalCreditos: r.totalCreditos.toString(), docsSaida: saidas.length, docsEntrada: entradas.length },
      },
      update: {
        debito,
        credito,
        saldoCredorAnterior,
        saldoApurado: r.saldoApurado,
        aRecolher: r.aRecolher,
        saldoCredorTransportar: r.saldoCredorTransportar,
      },
    });

    await this.auditoria.registrar({
      tipo: 'APURACAO_ICMS',
      entidade: 'ApuracaoImposto',
      entidadeId: apuracao.id,
      dados: { ano, mes, debito: debito.toString(), credito: credito.toString(), aRecolher: r.aRecolher.toString() },
    });

    return [
      this.linha('ICMS', `${ano}-${String(mes).padStart(2, '0')}`, {
        debito,
        credito,
        saldoCredorAnterior,
        aRecolher: r.aRecolher,
        saldoCredorTransportar: r.saldoCredorTransportar,
      }),
    ];
  }

  /** Apuração de IPI (confronto débito×crédito, E520). Simples → no DAS. */
  async apurarIpiCompetencia(empresaId: string, ano: number, mes: number) {
    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada para este tenant.');
    if (empresa.regimeTributario === 'SIMPLES_NACIONAL') {
      throw new NotFoundException('Simples Nacional: IPI está embutido no DAS, sem apuração por débito-crédito.');
    }
    const { inicio, fim } = this.periodo(ano, mes);
    const sel = { itens: { select: { cstIpi: true, vIpi: true } } };
    const saidas = await this.prisma.scoped.documentoFiscal.findMany({
      where: { empresaId, tipoOperacao: 'SAIDA', dataEmissao: { gte: inicio, lt: fim } },
      include: sel,
    });
    const entradas = await this.prisma.scoped.documentoFiscal.findMany({
      where: { empresaId, tipoOperacao: 'ENTRADA', dataEmissao: { gte: inicio, lt: fim } },
      include: sel,
    });
    const debito = somarDebitoIpi(saidas.flatMap((d) => d.itens));
    const credito = somarCreditoIpi(entradas.flatMap((d) => d.itens));
    const saldoCredorAnterior = await this.saldoCredorAnterior(empresaId, 'IPI', ano, mes);
    const r = apurarIpi({ debito, credito, saldoCredorAnterior });
    const ap = await this.upsertApuracao(empresaId, 'IPI', ano, mes, { debito, credito, saldoCredorAnterior, ...r });
    await this.audit('APURACAO_IPI', ap.id, { ano, mes, aRecolher: r.aRecolher.toString() });
    return [
      this.linha('IPI', `${ano}-${String(mes).padStart(2, '0')}`, {
        debito,
        credito,
        saldoCredorAnterior,
        aRecolher: r.aRecolher,
        saldoCredorTransportar: r.saldoCredorTransportar,
      }),
    ];
  }

  /** Apuração de PIS e COFINS (débito das saídas; crédito só no não-cumulativo). */
  async apurarPisCofinsCompetencia(empresaId: string, ano: number, mes: number) {
    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada para este tenant.');
    if (empresa.regimeTributario === 'SIMPLES_NACIONAL') {
      throw new NotFoundException('Simples Nacional: PIS/COFINS estão no DAS, sem apuração própria.');
    }
    const modalidade: ModalidadePisCofins =
      empresa.regimeTributario === 'LUCRO_REAL' ? 'NAO_CUMULATIVO' : 'CUMULATIVO';
    const { inicio, fim } = this.periodo(ano, mes);

    const saidas = await this.prisma.scoped.documentoFiscal.findMany({
      where: { empresaId, tipoOperacao: 'SAIDA', dataEmissao: { gte: inicio, lt: fim } },
      include: { itens: { select: { cstPis: true, vPis: true, cstCofins: true, vCofins: true } } },
    });
    const itensSaida = saidas.flatMap((d) => d.itens);

    const competencia = `${ano}-${String(mes).padStart(2, '0')}`;
    const linhas: ResultadoImposto[] = [];
    for (const tributo of ['PIS', 'COFINS'] as TributoPC[]) {
      const debito = somarDebitoPisCofins(itensSaida, tributo);
      const credito =
        modalidade === 'NAO_CUMULATIVO' ? await this.creditoEntradas(empresaId, tributo, inicio, fim) : new Prisma.Decimal(0);
      const saldoCredorAnterior =
        modalidade === 'NAO_CUMULATIVO' ? await this.saldoCredorAnterior(empresaId, tributo, ano, mes) : new Prisma.Decimal(0);
      const r = apurarPisCofins({ modalidade, debito, credito, saldoCredorAnterior });
      const ap = await this.upsertApuracao(empresaId, tributo, ano, mes, {
        debito: r.debito,
        credito: r.credito,
        saldoCredorAnterior,
        saldoApurado: r.aRecolher,
        aRecolher: r.aRecolher,
        saldoCredorTransportar: r.saldoCredorTransportar,
      });
      await this.audit(`APURACAO_${tributo}`, ap.id, { ano, mes, modalidade, aRecolher: r.aRecolher.toString() });
      linhas.push(
        this.linha(tributo, competencia, {
          debito: r.debito,
          credito: r.credito,
          saldoCredorAnterior,
          aRecolher: r.aRecolher,
          saldoCredorTransportar: r.saldoCredorTransportar,
        }),
      );
    }
    return linhas;
  }

  /**
   * Apuração de CBS ou IBS por competência (reforma 2026, não-cumulativo):
   * débito destacado nas saídas − crédito destacado nas entradas (± saldo credor).
   * Reusa a mecânica do ICMS (apurarIcms). Vale para qualquer regime na transição.
   */
  async apurarCbsIbsCompetencia(empresaId: string, tributo: TributoReforma, ano: number, mes: number) {
    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada para este tenant.');
    const { inicio, fim } = this.periodo(ano, mes);
    const sel = { itens: { select: { vCbs: true, vIbsUf: true, vIbsMun: true } } };
    const saidas = await this.prisma.scoped.documentoFiscal.findMany({
      where: { empresaId, tipoOperacao: 'SAIDA', dataEmissao: { gte: inicio, lt: fim } },
      include: sel,
    });
    const entradas = await this.prisma.scoped.documentoFiscal.findMany({
      where: { empresaId, tipoOperacao: 'ENTRADA', dataEmissao: { gte: inicio, lt: fim } },
      include: sel,
    });
    const debito = somarCbsIbs(saidas.flatMap((d) => d.itens), tributo);
    const credito = somarCbsIbs(entradas.flatMap((d) => d.itens), tributo);
    const saldoCredorAnterior = await this.saldoCredorAnterior(empresaId, tributo, ano, mes);
    const r = apurarIcms({ debito, credito, saldoCredorAnterior });
    const ap = await this.upsertApuracao(empresaId, tributo, ano, mes, {
      debito,
      credito,
      saldoCredorAnterior,
      saldoApurado: r.saldoApurado,
      aRecolher: r.aRecolher,
      saldoCredorTransportar: r.saldoCredorTransportar,
    });
    await this.audit(`APURACAO_${tributo}`, ap.id, { ano, mes, aRecolher: r.aRecolher.toString() });
    return [
      this.linha(tributo, `${ano}-${String(mes).padStart(2, '0')}`, {
        debito,
        credito,
        saldoCredorAnterior,
        aRecolher: r.aRecolher,
        saldoCredorTransportar: r.saldoCredorTransportar,
      }),
    ];
  }

  /** ISS (cumulativo) a partir de NFS-e fornecidas (ingestão de NFS-e é sub-etapa). */
  apurarIssNotas(notas: NotaServicoIss[]) {
    const r = apurarIss(notas);
    return {
      imposto: 'ISS',
      debito: r.debito.toFixed(2),
      aRecolher: r.aRecolher.toFixed(2),
      retidoFonte: r.retidoFonte.toFixed(2),
      totalNotas: r.totalNotas,
      observacao:
        'ISS é cumulativo (sem crédito). Débito = ISS das NFS-e emitidas não retidas (tpRetISSQN=1). O ISS vem de NFS-e (municipal/padrão nacional), não de NF-e/NFC-e/CT-e — a captura de NFS-e é uma sub-etapa.',
    };
  }

  /** Apuração de ISS por competência, a partir das NFS-e emitidas persistidas. */
  async apurarIssCompetencia(empresaId: string, ano: number, mes: number) {
    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada para este tenant.');
    if (empresa.regimeTributario === 'SIMPLES_NACIONAL') {
      throw new NotFoundException('Simples Nacional: ISS está no DAS, sem apuração própria.');
    }
    const { inicio, fim } = this.periodo(ano, mes);
    const notas = await this.prisma.scoped.notaServico.findMany({
      where: { empresaId, dhEmi: { gte: inicio, lt: fim } },
    });
    const r = apurarIss(
      notas.map((n) => ({
        vISSQN: n.vIss,
        vBC: n.vBc,
        pAliqAplic: n.pAliq,
        tpRetISSQN: n.tpRetISSQN,
        tribISSQN: n.tribISSQN ?? undefined,
      })),
    );
    const zero = new Prisma.Decimal(0);
    const ap = await this.upsertApuracao(empresaId, 'ISS', ano, mes, {
      debito: r.debito,
      credito: zero,
      saldoCredorAnterior: zero,
      aRecolher: r.aRecolher,
      saldoCredorTransportar: zero,
    });
    await this.audit('APURACAO_ISS', ap.id, { ano, mes, aRecolher: r.aRecolher.toString(), notas: r.totalNotas });
    return [
      this.linha('ISS', `${ano}-${String(mes).padStart(2, '0')}`, {
        debito: r.debito,
        credito: zero,
        saldoCredorAnterior: zero,
        aRecolher: r.aRecolher,
        saldoCredorTransportar: zero,
      }),
    ];
  }

  /**
   * Apuração do Simples Nacional (DAS / PGDAS-D) por competência — bem mais simples
   * que os demais regimes: NÃO há débito-crédito. O DAS = receita bruta do mês ×
   * alíquota EFETIVA da faixa da RBT12 no anexo (LC 123/2006, art. 18).
   *   - receita do mês = Σ valorTotal das saídas (NF-e/NFC-e) da competência;
   *   - RBT12 = receita bruta dos 12 meses ANTERIORES ao período;
   *   - anexo: explícito, ou por Fator R (folha/receita 12m → III/V), ou I (comércio).
   */
  async apurarSimplesCompetencia(
    empresaId: string,
    ano: number,
    mes: number,
    opts: { anexo?: Anexo; folha12?: number; receita12?: number } = {},
  ) {
    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada para este tenant.');
    if (empresa.regimeTributario !== 'SIMPLES_NACIONAL') {
      throw new BadRequestException(
        'A apuração do DAS é exclusiva do Simples Nacional. No Lucro Real/Presumido use as apurações por imposto (ICMS, IPI, PIS/COFINS, ISS).',
      );
    }

    const anexo: Anexo =
      opts.anexo ??
      (opts.folha12 != null && opts.receita12 != null ? anexoPorFatorR(opts.folha12, opts.receita12) : 'I');

    const { inicio, fim } = this.periodo(ano, mes);
    const receitaMes = await this.receitaBrutaSaidas(empresaId, inicio, fim);
    // RBT12: 12 meses anteriores ao período — [mês-12, mês) (JS normaliza meses negativos).
    const ini12 = new Date(Date.UTC(ano, mes - 1 - 12, 1));
    const rbt12 = await this.receitaBrutaSaidas(empresaId, ini12, inicio);

    const r = calcularDas({ anexo, rbt12: rbt12.toNumber(), receitaMes: receitaMes.toNumber() });
    const das = new Prisma.Decimal(r.das);
    const zero = new Prisma.Decimal(0);

    const detalhe = {
      anexo: r.anexo,
      faixa: r.faixa,
      aliquotaNominal: r.aliquotaNominal,
      parcelaDeduzir: r.parcelaDeduzir,
      aliquotaEfetiva: r.aliquotaEfetiva,
      receitaMes: receitaMes.toFixed(2),
      rbt12: rbt12.toFixed(2),
    };

    const ap = await this.prisma.scoped.apuracaoImposto.upsert({
      where: { tenantId_empresaId_imposto_ano_mes: { tenantId: this.prisma.tenantId, empresaId, imposto: 'SIMPLES', ano, mes } },
      create: {
        tenantId: this.prisma.tenantId,
        empresaId,
        imposto: 'SIMPLES',
        ano,
        mes,
        debito: das,
        credito: zero,
        saldoCredorAnterior: zero,
        saldoApurado: das,
        aRecolher: das,
        saldoCredorTransportar: zero,
        detalhe,
      },
      update: { debito: das, credito: zero, saldoApurado: das, aRecolher: das, detalhe },
    });
    await this.audit('APURACAO_SIMPLES', ap.id, { ano, mes, anexo: r.anexo, das: r.das, rbt12: rbt12.toFixed(2) });

    const alertas: string[] = [];
    if (rbt12.isZero()) {
      alertas.push(
        'RBT12 = 0 (sem receita nos 12 meses anteriores no sistema) → usou a 1ª faixa. Em início de atividade a RBT12 é proporcionalizada (média × 12) — confira no PGDAS-D.',
      );
    }
    alertas.push(
      'Receita considerada = vendas (NF-e/NFC-e de saída). Serviços (NFS-e) e a segregação por anexo em atividade mista devem ser conferidos no PGDAS-D.',
    );

    return {
      linhas: [
        this.linha('SIMPLES (DAS)', `${ano}-${String(mes).padStart(2, '0')}`, {
          debito: das,
          credito: zero,
          saldoCredorAnterior: zero,
          aRecolher: das,
          saldoCredorTransportar: zero,
        }),
      ],
      simples: { ...r, receitaMes: receitaMes.toNumber(), rbt12: rbt12.toNumber() },
      alertas,
    };
  }

  /** Receita bruta (Σ valorTotal das saídas NF-e/NFC-e) no intervalo [inicio, fim). */
  private async receitaBrutaSaidas(empresaId: string, inicio: Date, fim: Date): Promise<Prisma.Decimal> {
    const agg = await this.prisma.scoped.documentoFiscal.aggregate({
      _sum: { valorTotal: true },
      where: { empresaId, tipoOperacao: 'SAIDA', dataEmissao: { gte: inicio, lt: fim } },
    });
    return new Prisma.Decimal(agg._sum.valorTotal ?? 0);
  }

  private periodo(ano: number, mes: number) {
    return { inicio: new Date(Date.UTC(ano, mes - 1, 1)), fim: new Date(Date.UTC(ano, mes, 1)) };
  }

  private async saldoCredorAnterior(empresaId: string, imposto: string, ano: number, mes: number): Promise<Prisma.Decimal> {
    const antMes = mes === 1 ? 12 : mes - 1;
    const antAno = mes === 1 ? ano - 1 : ano;
    const ant = await this.prisma.scoped.apuracaoImposto.findFirst({
      where: { empresaId, imposto, ano: antAno, mes: antMes },
    });
    return ant?.saldoCredorTransportar ?? new Prisma.Decimal(0);
  }

  private async creditoEntradas(empresaId: string, tributo: string, inicio: Date, fim: Date): Promise<Prisma.Decimal> {
    const entradas = await this.prisma.scoped.documentoFiscal.findMany({
      where: { empresaId, tipoOperacao: 'ENTRADA', dataEmissao: { gte: inicio, lt: fim } },
      include: { apuracoes: { where: { tributo: tributo as never, creditoPermitido: true }, select: { valorCredito: true } } },
    });
    return entradas.flatMap((d) => d.apuracoes).reduce((s, a) => s.add(a.valorCredito), new Prisma.Decimal(0));
  }

  private upsertApuracao(
    empresaId: string,
    imposto: string,
    ano: number,
    mes: number,
    dados: {
      debito: Prisma.Decimal;
      credito: Prisma.Decimal;
      saldoCredorAnterior: Prisma.Decimal;
      saldoApurado?: Prisma.Decimal;
      aRecolher: Prisma.Decimal;
      saldoCredorTransportar: Prisma.Decimal;
    },
  ) {
    const data = {
      debito: dados.debito,
      credito: dados.credito,
      saldoCredorAnterior: dados.saldoCredorAnterior,
      saldoApurado: dados.saldoApurado ?? dados.aRecolher,
      aRecolher: dados.aRecolher,
      saldoCredorTransportar: dados.saldoCredorTransportar,
    };
    return this.prisma.scoped.apuracaoImposto.upsert({
      where: { tenantId_empresaId_imposto_ano_mes: { tenantId: this.prisma.tenantId, empresaId, imposto, ano, mes } },
      create: { tenantId: this.prisma.tenantId, empresaId, imposto, ano, mes, ...data },
      update: data,
    });
  }

  private audit(tipo: string, entidadeId: string, dados: Prisma.InputJsonValue) {
    return this.auditoria.registrar({ tipo, entidade: 'ApuracaoImposto', entidadeId, dados });
  }

  /** DAS do Simples (PGDAS-D) — cálculo puro a partir de receita + RBT12. */
  calcularDasSimples(input: {
    anexo?: Anexo;
    rbt12: number;
    receitaMes: number;
    fatorR?: { folha12: number; receita12: number };
  }) {
    const anexo: Anexo = input.fatorR ? anexoPorFatorR(input.fatorR.folha12, input.fatorR.receita12) : (input.anexo ?? 'I');
    const r = calcularDas({ anexo, rbt12: input.rbt12, receitaMes: input.receitaMes });
    return {
      ...r,
      observacao:
        'DAS calculado pela alíquota efetiva ((RBT12×alíquota−PD)/RBT12). No Simples não há débito-crédito de ICMS/PIS/COFINS. Base: LC 123/2006 art. 18.',
    };
  }
}
