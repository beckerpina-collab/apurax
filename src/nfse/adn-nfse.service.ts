import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CertificadoService } from '../dfe/certificado.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdnNfseClient, TpAmbAdn } from './adn-nfse.client';
import { NfseService } from './nfse.service';

const MODELO = 'NFSE'; // cursor no DistribuicaoCursor (série de NSU própria do ADN)
const MAX_CICLOS = 10; // lote ~50/req → até ~500 DF-e por sincronização

/**
 * Captura das NFS-e EMITIDAS pela empresa no ADN (Sistema Nacional NFS-e), por NSU —
 * mesma mecânica da Distribuição DFe (cursor incremental). Importa cada NFS-e via
 * NfseService (base do débito de ISS); eventos são apenas contados por ora.
 */
@Injectable()
export class AdnNfseService {
  private readonly logger = new Logger(AdnNfseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly certificados: CertificadoService,
    private readonly client: AdnNfseClient,
    private readonly nfse: NfseService,
  ) {}

  private tpAmb(): TpAmbAdn {
    return Number(this.config.get('APURAX_NFSE_ADN_TPAMB') ?? 2) === 1 ? 1 : 2; // 2=homolog (padrão seguro)
  }

  async sincronizar(empresaId: string) {
    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada para este tenant.');

    const cursor = await this.obterCursor(empresa.id);
    const tpAmb = this.tpAmb();
    const { pfx, senha } = await this.certificados.carregarEmMemoria(empresa.id);

    let ultNsu = cursor.ultNsu;
    let maxNsu = cursor.maxNsu;
    let status = '';
    const tot = { importadas: 0, jaImportadas: 0, eventos: 0, semXml: 0, erros: 0 };

    try {
      for (let i = 0; i < MAX_CICLOS; i++) {
        const r = await this.client.distribuir({ pfx, senha, tpAmb, ultNsu });
        status = r.status;
        if (r.maxNsu && Number(r.maxNsu) > 0) maxNsu = r.maxNsu;

        for (const d of r.documentos) {
          if (!d.xml) {
            tot.semXml++;
            continue;
          }
          // só NFS-e alimenta a apuração; eventos (cancelamento/substituição) são contados.
          if (!/<\s*(NFSe|infNFSe|nfseProc)\b/i.test(d.xml)) {
            tot.eventos++;
            continue;
          }
          try {
            await this.nfse.importar(empresa.id, d.xml, 'adn-nfse-sync');
            tot.importadas++;
          } catch (e) {
            if (/já import|duplicad/i.test((e as Error).message)) tot.jaImportadas++;
            else {
              tot.erros++;
              this.logger.warn(`ADN NFS-e importar (NSU ${d.nsu}): ${(e as Error).message}`);
            }
          }
        }

        if (r.ultNsu && Number(r.ultNsu) > Number(ultNsu)) ultNsu = r.ultNsu;
        await this.atualizarCursor(empresa.id, ultNsu, maxNsu, status, tot.importadas);

        if (r.documentos.length === 0 || Number(ultNsu) >= Number(maxNsu)) break; // esgotou
      }
    } finally {
      pfx.fill(0);
    }

    const faltam = Number(maxNsu) > Number(ultNsu);
    const ambiente = tpAmb === 1 ? 'produção' : 'HOMOLOGAÇÃO (teste)';
    return {
      documentosNovos: tot.importadas,
      jaImportadas: tot.jaImportadas,
      eventos: tot.eventos,
      semXml: tot.semXml,
      erros: tot.erros,
      ultimoNSU: ultNsu,
      maxNSU: maxNsu,
      status,
      mensagem:
        tot.importadas > 0
          ? `${tot.importadas} NFS-e importada(s)${tot.jaImportadas ? ` (+${tot.jaImportadas} já existiam)` : ''} (NSU ${ultNsu}/${maxNsu}).${faltam ? ' Há mais — sincronize novamente.' : ''}`
          : `Nenhuma NFS-e nova (NSU ${ultNsu}/${maxNsu}). Ambiente: ${ambiente}.`,
    };
  }

  private async obterCursor(empresaId: string) {
    const existente = await this.prisma.scoped.distribuicaoCursor.findFirst({ where: { empresaId, modelo: MODELO } });
    if (existente) return existente;
    return this.prisma.scoped.distribuicaoCursor.create({
      data: { tenantId: this.prisma.tenantId, empresaId, modelo: MODELO },
    });
  }

  private async atualizarCursor(empresaId: string, ultNsu: string, maxNsu: string, status: string, novos: number) {
    await this.prisma.scoped.distribuicaoCursor.update({
      where: { tenantId_empresaId_modelo: { tenantId: this.prisma.tenantId, empresaId, modelo: MODELO } },
      data: {
        ultNsu,
        maxNsu,
        ultimoCStat: status,
        ultimaConsultaEm: new Date(),
        totalDocumentos: { increment: novos },
      },
    });
  }
}
