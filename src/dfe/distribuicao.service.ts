import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CteService } from '../cte/cte.service';
import { NfeService } from '../fiscal/nfe.service';
import { PrismaService } from '../prisma/prisma.service';
import { CertificadoService } from './certificado.service';
import { avaliarResposta } from './distribuicao.state';
import { DocZipService } from './doc-zip.service';
import { TipoEventoManifestacao } from './manifestacao';
import { ConsultaDfeParams, ModeloDfe, SEFAZ_DFE_CLIENT, SefazDfeClient } from './sefaz-dfe.client';
import { SefazEventoSoapClient } from './sefaz-evento-soap.client';

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
    private readonly evento: SefazEventoSoapClient,
  ) {}

  /**
   * Manifestação do destinatário (NF-e): Ciência (210210) destrava o XML completo
   * na próxima sincronização; Confirmação/Desconhecimento/Não realizada são
   * conclusivas. Assina com o A1 e envia ao Ambiente Nacional.
   */
  async manifestar(empresaId: string, chave: string, tpEvento: TipoEventoManifestacao, xJust?: string) {
    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada para este tenant.');
    }
    const tpAmb = Number(this.config.get('APURAX_DFE_TPAMB') ?? 2);
    const { pfx, senha } = await this.certificados.carregarEmMemoria(empresa.id);
    try {
      const { privateKeyPem, certDerBase64, cnpj } = await this.certificados.carregarPem(empresa.id);
      const ret = await this.evento.manifestar({
        chave,
        cnpj: cnpj || empresa.cnpj,
        tpEvento,
        xJust,
        tpAmb,
        dhEvento: this.dhEventoSP(),
        pfx,
        senha,
        privateKeyPem,
        certDerBase64,
      });
      await this.auditoria.registrar({
        tipo: 'NFE_MANIFESTACAO',
        entidade: 'DocumentoFiscal',
        entidadeId: chave,
        dados: { tpEvento, cStat: ret.cStat, xMotivo: ret.xMotivo },
      });
      // 135/136 = registrado; 573 = duplicidade (já manifestado antes) → tratamos como ok.
      const ok = ['135', '136', '573'].includes(ret.cStat);
      return {
        ok,
        cStat: ret.cStat,
        xMotivo: ret.xMotivo,
        nProt: ret.nProt,
        mensagem: ok
          ? `Manifestação registrada (cStat ${ret.cStat} — ${ret.xMotivo}). Sincronize NF-e novamente para baixar o XML completo.`
          : `Manifestação não registrada: cStat ${ret.cStat} — ${ret.xMotivo}.`,
      };
    } finally {
      pfx.fill(0);
    }
  }

  /** Data/hora do evento no fuso de São Paulo (-03:00), formato da SEFAZ. */
  private dhEventoSP(): string {
    const sp = new Date(Date.now() - 3 * 3600 * 1000); // UTC-3, sem DST
    const p = (n: number) => String(n).padStart(2, '0');
    return `${sp.getUTCFullYear()}-${p(sp.getUTCMonth() + 1)}-${p(sp.getUTCDate())}T${p(sp.getUTCHours())}:${p(sp.getUTCMinutes())}:${p(sp.getUTCSeconds())}-03:00`;
  }

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
      const ate = espera.ate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      return {
        estado: 'aguardando' as const,
        documentosNovos: 0,
        ultimoNSU: cursor.ultNsu,
        maxNSU: cursor.maxNsu,
        cStat: cursor.ultimoCStat ?? '—',
        mensagem: `${espera.motivo} Próxima janela: ${ate}.`,
      };
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

        ciclos.push({ cStat: ret.cStat, xMotivo: ret.xMotivo, ultNsu: ret.ultNsu, maxNsu: ret.maxNsu, ...resumo, estado: prox.estado });
        if (prox.estado !== 'CONSULTAR_JA') break;
      }
    } finally {
      pfx.fill(0); // zera o material em claro
    }

    // Normaliza para o contrato da tela Captura ({ documentosNovos, ultimoNSU, maxNSU, cStat, mensagem }).
    const novos = ciclos.reduce((s, c) => s + (Number(c.nfeCompletas) || 0) + (Number(c.cteCompletas) || 0), 0);
    const resumos = ciclos.reduce((s, c) => s + (Number(c.resumos) || 0), 0);
    const ultimo: Record<string, unknown> = ciclos[ciclos.length - 1] ?? {};
    const ultimoNSU = String(ultimo.ultNsu ?? cursor.ultNsu);
    const maxNSU = String(ultimo.maxNsu ?? cursor.maxNsu);
    const cStat = String(ultimo.cStat ?? cursor.ultimoCStat ?? '—');
    const xMotivo = String(ultimo.xMotivo ?? '');
    const ambiente = tpAmb === 1 ? 'produção' : 'HOMOLOGAÇÃO (ambiente de teste — não traz notas reais)';
    const faltam = maxNSU > ultimoNSU; // ainda há NSU a percorrer → clicar de novo
    let mensagem: string;
    if (novos > 0) {
      mensagem =
        `Capturados ${novos} documento(s) completo(s)${resumos > 0 ? ` + ${resumos} resumo(s)` : ''} ` +
        `(NSU ${ultimoNSU}/${maxNSU}).${faltam ? ' Há mais — clique novamente para continuar.' : ''}`;
    } else if (resumos > 0) {
      mensagem =
        `${resumos} resumo(s) de nota localizado(s) (NSU ${ultimoNSU}/${maxNSU}). ` +
        `Para baixar o XML completo é preciso MANIFESTAR ciência da operação na SEFAZ.${faltam ? ' Clique novamente para continuar.' : ''}`;
    } else {
      mensagem = `Nenhum documento novo. cStat ${cStat}${xMotivo ? ` — ${xMotivo}` : ''}. Ambiente: ${ambiente}.`;
    }
    return {
      estado: 'concluido' as const,
      modelo,
      documentosNovos: novos,
      resumos,
      ultimoNSU,
      maxNSU,
      cStat,
      mensagem,
    };
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

  /** Normaliza os cursores para o formato consumido pela tela Captura SEFAZ
   *  ({ modelo, ultimoNSU, maxNSU, ultimaConsulta, status }) — o registro cru
   *  usa ultNsu/maxNsu/ultimaConsultaEm e não tem 'status'. */
  async listarCursores() {
    const cursores = await this.prisma.scoped.distribuicaoCursor.findMany({
      orderBy: { ultimaConsultaEm: 'desc' },
    });
    const agora = Date.now();
    return cursores.map((c) => ({
      modelo: c.modelo,
      ultimoNSU: c.ultNsu,
      maxNSU: c.maxNsu,
      ultimaConsulta: c.ultimaConsultaEm ? c.ultimaConsultaEm.toISOString() : null,
      status: c.bloqueadoAte && c.bloqueadoAte.getTime() > agora ? 'inativo' : 'ativo',
      ultimoCStat: c.ultimoCStat ?? null,
      totalDocumentos: c.totalDocumentos,
    }));
  }
}
