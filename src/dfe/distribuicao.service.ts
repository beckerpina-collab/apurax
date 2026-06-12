import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CteService } from '../cte/cte.service';
import { NfeService } from '../fiscal/nfe.service';
import { PrismaService } from '../prisma/prisma.service';
import { CertificadoService } from './certificado.service';
import { avaliarResposta } from './distribuicao.state';
import { DocZipService } from './doc-zip.service';
import { ConsultaDfeParams, ModeloDfe, SEFAZ_DFE_CLIENT, SefazDfeClient } from './sefaz-dfe.client';

const MAX_CICLOS = 10; // teto por chamada (cada ciclo = 1 consulta à SEFAZ)

const UF_IBGE: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29',
  MG: '31', ES: '32', RJ: '33', SP: '35',
  PR: '41', SC: '42', RS: '43',
  MS: '50', MT: '51', GO: '52', DF: '53',
};

@Injectable()
export class DistribuicaoService {
  private readonly logger = new Logger(DistribuicaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certificados: CertificadoService,
    @Inject(SEFAZ_DFE_CLIENT) private readonly sefaz: SefazDfeClient,
    private readonly docZip: DocZipService,
    private readonly nfe: NfeService,
    private readonly cte: CteService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
  ) {}

  /** Varre a Distribuição DFe da empresa (NF-e ou CT-e), respeitando NSU e cooldown. */
  async sincronizar(empresaId: string, modelo: ModeloDfe = 'NFE') {
    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada para este tenant.');
    }

    const cursor = await this.obterCursor(empresa.id, modelo);
    const agora = Date.now();
    const espera = this.emEspera(cursor, agora);
    if (espera) {
      return { status: 'aguardando', motivo: espera.motivo, ate: espera.ate, cursor };
    }

    const tpAmb = Number(this.config.get('APURAX_DFE_TPAMB') ?? 2); // 2=homolog por padrão (seguro)
    const cUF = UF_IBGE[empresa.uf] ?? '35';

    const { pfx, senha } = await this.certificados.carregarEmMemoria(empresa.id);
    const ciclos: Array<Record<string, unknown>> = [];
    let ultNsu = cursor.ultNsu;

    try {
      for (let i = 0; i < MAX_CICLOS; i++) {
        const params: ConsultaDfeParams = { modelo, cnpj: empresa.cnpj, ultNsu, pfx, senha, tpAmb, cUF };
        const ret = await this.sefaz.consultar(params);
        const resumo = await this.processarLote(empresa.id, ret.docs);
        const prox = avaliarResposta(ret.cStat, ret.ultNsu, ret.maxNsu, ultNsu);
        ultNsu = prox.ultNsu;

        await this.atualizarCursor(empresa.id, modelo, prox, ret, resumo.total);
        await this.auditoria.registrar({
          tipo: `DFE_${modelo}_CONSULTA`,
          entidade: 'DistribuicaoCursor',
          entidadeId: cursor.id,
          dados: { cStat: ret.cStat, ultNsu: ret.ultNsu, maxNsu: ret.maxNsu, docs: resumo, estado: prox.estado },
        });

        ciclos.push({ cStat: ret.cStat, ultNsu: ret.ultNsu, maxNsu: ret.maxNsu, ...resumo, estado: prox.estado });
        if (prox.estado !== 'CONSULTAR_JA') break;
      }
    } finally {
      pfx.fill(0); // zera o material em claro
    }

    return { status: 'concluido', modelo, ciclos };
  }

  /** Decodifica e roteia cada docZip para a ingestão existente (NF-e/CT-e). */
  private async processarLote(empresaId: string, docs: { nsu: string; schema: string; conteudoBase64: string }[]) {
    const contagem = { total: docs.length, nfeCompletas: 0, cteCompletas: 0, resumos: 0, eventos: 0, ignorados: 0, erros: 0 };
    for (const doc of docs) {
      const tipo = this.docZip.classificar(doc.schema);
      try {
        if (tipo === 'NFE_COMPLETA') {
          await this.nfe.importar(empresaId, this.docZip.decodificar(doc.conteudoBase64), 'dfe-sync').catch((e) => this.ignorarDuplicado(e));
          contagem.nfeCompletas++;
        } else if (tipo === 'CTE_COMPLETA') {
          await this.cte.importar(empresaId, this.docZip.decodificar(doc.conteudoBase64), 'dfe-sync').catch((e) => this.ignorarDuplicado(e));
          contagem.cteCompletas++;
        } else if (tipo === 'NFE_RESUMO' || tipo === 'CTE_RESUMO') {
          contagem.resumos++; // resumo: requer manifestação (210210) p/ liberar o XML completo
        } else if (tipo === 'EVENTO') {
          contagem.eventos++;
        } else {
          contagem.ignorados++;
        }
      } catch {
        contagem.erros++;
      }
    }
    return contagem;
  }

  private ignorarDuplicado(e: unknown): void {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/já importad/i.test(msg)) {
      throw e;
    }
  }

  private async obterCursor(empresaId: string, modelo: ModeloDfe) {
    const existente = await this.prisma.scoped.distribuicaoCursor.findFirst({ where: { empresaId, modelo } });
    if (existente) return existente;
    return this.prisma.scoped.distribuicaoCursor.create({
      data: { tenantId: this.prisma.tenantId, empresaId, modelo },
    });
  }

  private emEspera(
    cursor: { cooldownAte: Date | null; bloqueadoAte: Date | null },
    agora: number,
  ): { motivo: string; ate: Date } | null {
    if (cursor.bloqueadoAte && cursor.bloqueadoAte.getTime() > agora) {
      return { motivo: 'Bloqueado (consumo indevido / 656).', ate: cursor.bloqueadoAte };
    }
    if (cursor.cooldownAte && cursor.cooldownAte.getTime() > agora) {
      return { motivo: 'Em cooldown — aguardando janela da próxima consulta.', ate: cursor.cooldownAte };
    }
    return null;
  }

  private async atualizarCursor(
    empresaId: string,
    modelo: ModeloDfe,
    prox: ReturnType<typeof avaliarResposta>,
    ret: { cStat: string; maxNsu: string },
    qtdDocs: number,
  ) {
    const proximaJanela = prox.cooldownSegundos > 0 ? new Date(Date.now() + prox.cooldownSegundos * 1000) : null;
    await this.prisma.scoped.distribuicaoCursor.update({
      where: { tenantId_empresaId_modelo: { tenantId: this.prisma.tenantId, empresaId, modelo } },
      data: {
        ultNsu: prox.ultNsu,
        maxNsu: ret.maxNsu,
        ultimoCStat: ret.cStat,
        ultimaConsultaEm: new Date(),
        totalDocumentos: { increment: qtdDocs },
        cooldownAte: prox.estado === 'COOLDOWN' || prox.estado === 'ERRO' ? proximaJanela : null,
        bloqueadoAte: prox.estado === 'BLOQUEADO' ? proximaJanela : null,
      },
    });
  }

  listarCursores() {
    return this.prisma.scoped.distribuicaoCursor.findMany({
      orderBy: { ultimaConsultaEm: 'desc' },
      include: { empresa: { select: { razaoSocial: true, cnpj: true } } },
    });
  }
}
