import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { CertificadoService } from '../dfe/certificado.service';
import { NfeService } from '../fiscal/nfe.service';
import { PrismaService } from '../prisma/prisma.service';
import { SaeSpClient, TpAmb } from './sae-sp.client';

export interface StatusCaptura {
  estado: 'capturando' | 'concluida' | 'erro';
  periodo: string;
  ambiente: string;
  chavesEncontradas: number;
  importadas: number;
  jaImportadas: number;
  semXml: number;
  erros: number;
  cStat?: string;
  mensagem?: string;
  atualizadoEm: string;
}

const MAX_PAGINAS_LISTAGEM = 50; // janelas de data (cStat 101 = lista incompleta)
const DELAY_DOWNLOAD_MS = 300; // ~3/s — calibrar com o rate-limit real (cStat 656)
const MAX_RETRY_656 = 4;

/**
 * Captura das NFC-e EMITIDAS pela empresa via SAE da SEFAZ-SP (NFCeListagemChaves +
 * NFCeDownloadXML). Roda em 2º plano (status em memória, como a varredura do Bling):
 * lista as chaves do período (paginando por data) e baixa/importa cada XML como SAÍDA
 * (NfeService.importarDoBling classifica pelo tpNF). Dedup por chave evita reimportar.
 */
@Injectable()
export class SaeService {
  private readonly logger = new Logger(SaeService.name);
  private readonly status = new Map<string, StatusCaptura>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly config: ConfigService,
    private readonly certificados: CertificadoService,
    private readonly client: SaeSpClient,
    private readonly nfe: NfeService,
  ) {}

  private tpAmb(): TpAmb {
    return Number(this.config.get('APURAX_SAE_TPAMB') ?? 2) === 1 ? 1 : 2; // 2=homolog (padrão seguro)
  }

  private chaveStatus(empresaId: string): string {
    return `${this.prisma.tenantId}:${empresaId}`;
  }

  /** Inicia a captura de NFC-e (SP) do período; responde na hora e processa em 2º plano. */
  async capturar(empresaId: string, dataInicial?: string, dataFinal?: string) {
    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada para este tenant.');
    if (empresa.uf !== 'SP') {
      throw new BadRequestException('O SAE é da SEFAZ-SP — disponível apenas para empresas de São Paulo (UF=SP).');
    }
    // Garante que há certificado ATIVO (lança erro claro se não) antes de ir p/ 2º plano.
    await this.certificados.carregarEmMemoria(empresa.id).then(({ pfx }) => pfx.fill(0));

    const tenantId = this.prisma.tenantId;
    const { ini, fim } = this.janela(dataInicial, dataFinal);
    const chave = this.chaveStatus(empresa.id);
    if (this.status.get(chave)?.estado === 'capturando') {
      return { status: 'capturando', jaEmAndamento: true, captura: this.status.get(chave) };
    }
    const ambiente = this.tpAmb() === 1 ? 'produção' : 'HOMOLOGAÇÃO (teste — não traz notas reais)';
    this.status.set(chave, {
      estado: 'capturando',
      periodo: `${ini} a ${fim}`,
      ambiente,
      chavesEncontradas: 0,
      importadas: 0,
      jaImportadas: 0,
      semXml: 0,
      erros: 0,
      atualizadoEm: new Date().toISOString(),
    });

    void this.executar(tenantId, empresa.id, ini, fim).catch((e) => {
      this.patch(chave, { estado: 'erro', mensagem: (e as Error).message });
      this.logger.error(`SAE captura ${empresaId}: ${(e as Error).message}`);
    });

    return {
      status: 'capturando',
      captura: this.status.get(chave),
      observacao: `Captura de NFC-e (SP) iniciada em 2º plano (${ambiente}). Acompanhe pelo status; as notas entram em Documentos de Saída.`,
    };
  }

  statusCaptura(empresaId: string): StatusCaptura | null {
    return this.status.get(this.chaveStatus(empresaId)) ?? null;
  }

  private async executar(tenantId: string, empresaId: string, ini: string, fim: string): Promise<void> {
    const chave = `${tenantId}:${empresaId}`;
    await this.cls.run(async () => {
      this.cls.set('tenantId', tenantId);
      const tpAmb = this.tpAmb();
      const { pfx, senha } = await this.certificados.carregarEmMemoria(empresaId);
      try {
        // 1) lista as chaves do período, paginando por data quando cStat=101 (lista incompleta).
        const chaves = new Set<string>();
        let dataHoraInicial = ini;
        let cStat = '';
        for (let p = 0; p < MAX_PAGINAS_LISTAGEM; p++) {
          const r = await this.client.listarChaves({ pfx, senha, tpAmb, dataHoraInicial, dataHoraFinal: fim });
          cStat = r.cStat;
          r.chaves.forEach((c) => chaves.add(c));
          this.patch(chave, { chavesEncontradas: chaves.size, cStat });
          if (r.cStat === '101' && r.dhEmisUltNfce && r.dhEmisUltNfce !== dataHoraInicial) {
            dataHoraInicial = r.dhEmisUltNfce; // avança a janela (não há NSU)
            continue;
          }
          break; // 100 (ok) / 107 (sem registros) / erro → encerra a listagem
        }

        // 2) baixa o XML de cada chave e importa como saída (rate-limit + backoff em 656).
        for (const ch of chaves) {
          await this.baixarEImportar(empresaId, tpAmb, ch, pfx, senha, chave);
          await new Promise((res) => setTimeout(res, DELAY_DOWNLOAD_MS));
        }

        const s = this.status.get(chave);
        this.patch(chave, {
          estado: 'concluida',
          mensagem: `Concluído (cStat ${cStat}): ${chaves.size} chave(s), ${s?.importadas ?? 0} importada(s), ${s?.jaImportadas ?? 0} já existia(m), ${s?.erros ?? 0} erro(s).`,
        });
      } finally {
        pfx.fill(0); // zera o material do certificado em claro
      }
    });
  }

  private async baixarEImportar(
    empresaId: string,
    tpAmb: TpAmb,
    chNFCe: string,
    pfx: Buffer,
    senha: string,
    chaveStatus: string,
  ): Promise<void> {
    for (let tentativa = 0; tentativa < MAX_RETRY_656; tentativa++) {
      const r = await this.client.baixarXml({ pfx, senha, tpAmb, chNFCe });
      if (r.cStat === '656') {
        await new Promise((res) => setTimeout(res, 2000 * (tentativa + 1))); // consumo indevido → backoff
        continue;
      }
      if (r.xml) {
        try {
          const imp = (await this.nfe.importarDoBling(empresaId, r.xml)) as { jaImportada?: boolean };
          this.bump(chaveStatus, imp?.jaImportada ? 'jaImportadas' : 'importadas');
        } catch (e) {
          this.bump(chaveStatus, 'erros');
          this.logger.warn(`SAE importar ${chNFCe}: ${(e as Error).message}`);
        }
      } else {
        this.bump(chaveStatus, 'semXml');
      }
      return;
    }
    this.bump(chaveStatus, 'erros'); // esgotou as tentativas de 656
  }

  /** Período no formato AAAA-MM-DDThh:mm (SEFAZ-SP); default = últimos 30 dias no fuso SP. */
  private janela(dataInicial?: string, dataFinal?: string): { ini: string; fim: string } {
    const iniData = dataInicial || this.diaSP(-30);
    const fimData = dataFinal || this.diaSP(0);
    return { ini: `${iniData}T00:00`, fim: `${fimData}T23:59` };
  }

  private diaSP(offsetDias: number): string {
    const ms = Date.now() + offsetDias * 86_400_000;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ms)); // en-CA => YYYY-MM-DD
  }

  private patch(chave: string, patch: Partial<StatusCaptura>): void {
    const base = this.status.get(chave);
    if (base) this.status.set(chave, { ...base, ...patch, atualizadoEm: new Date().toISOString() });
  }

  private bump(chave: string, campo: 'importadas' | 'jaImportadas' | 'semXml' | 'erros'): void {
    const base = this.status.get(chave);
    if (base) this.status.set(chave, { ...base, [campo]: base[campo] + 1, atualizadoEm: new Date().toISOString() });
  }
}
