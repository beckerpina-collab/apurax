import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { apurarIcms, somarDebitoIcms } from './apuracao-icms';
import { apurarIpi, somarCreditoIpi, somarDebitoIpi } from './apuracao-ipi';
import { apurarPisCofins, ModalidadePisCofins, somarDebitoPisCofins, TributoPC } from './apuracao-pis-cofins';
import { apurarIss, NotaServicoIss } from './apuracao-iss';
import { Anexo, anexoPorFatorR, calcularDas } from './simples-das';

@Injectable()
export class ApuracaoFiscalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

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

    return {
      empresa: { razaoSocial: empresa.razaoSocial, regime: empresa.regimeTributario },
      competencia: `${ano}-${String(mes).padStart(2, '0')}`,
      imposto: 'ICMS',
      debito: debito.toFixed(2),
      credito: credito.toFixed(2),
      saldoCredorAnterior: saldoCredorAnterior.toFixed(2),
      saldoApurado: r.saldoApurado.toFixed(2),
      aRecolher: r.aRecolher.toFixed(2),
      saldoCredorTransportar: r.saldoCredorTransportar.toFixed(2),
    };
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
    return {
      empresa: { razaoSocial: empresa.razaoSocial, regime: empresa.regimeTributario },
      competencia: `${ano}-${String(mes).padStart(2, '0')}`,
      imposto: 'IPI',
      debito: debito.toFixed(2),
      credito: credito.toFixed(2),
      aRecolher: r.aRecolher.toFixed(2),
      saldoCredorTransportar: r.saldoCredorTransportar.toFixed(2),
    };
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

    const resultado: Record<string, unknown> = {};
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
      resultado[tributo] = {
        modalidade,
        debito: r.debito.toFixed(2),
        credito: r.credito.toFixed(2),
        aRecolher: r.aRecolher.toFixed(2),
        saldoCredorTransportar: r.saldoCredorTransportar.toFixed(2),
      };
    }
    return {
      empresa: { razaoSocial: empresa.razaoSocial, regime: empresa.regimeTributario },
      competencia: `${ano}-${String(mes).padStart(2, '0')}`,
      ...resultado,
    };
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
    return {
      empresa: { razaoSocial: empresa.razaoSocial, regime: empresa.regimeTributario },
      competencia: `${ano}-${String(mes).padStart(2, '0')}`,
      imposto: 'ISS',
      aRecolher: r.aRecolher.toFixed(2),
      retidoFonte: r.retidoFonte.toFixed(2),
      totalNotas: r.totalNotas,
    };
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
