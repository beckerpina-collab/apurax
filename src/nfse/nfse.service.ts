import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { NfseParserService } from './nfse-parser.service';

@Injectable()
export class NfseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: NfseParserService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Importa uma NFS-e EMITIDA pela empresa (base do débito de ISS do prestador). */
  async importar(empresaId: string, xml: string, usuarioId: string) {
    const n = this.parser.parse(xml);

    const empresa = await this.prisma.scoped.empresa.findFirst({ where: { id: empresaId } });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada para este tenant.');
    }
    if (n.prestadorCnpj && n.prestadorCnpj !== empresa.cnpj) {
      throw new BadRequestException(
        `NFS-e emitida por outro CNPJ (${n.prestadorCnpj}); o débito de ISS é do prestador. NFS-e recebida (tomador) é uma etapa futura.`,
      );
    }

    const existente = await this.prisma.scoped.notaServico.findFirst({ where: { chaveAcesso: n.chaveAcesso } });
    if (existente) {
      throw new BadRequestException(`NFS-e já importada (chave ${n.chaveAcesso}).`);
    }

    const nota = await this.prisma.scoped.notaServico.create({
      data: {
        tenantId: this.prisma.tenantId,
        empresaId: empresa.id,
        chaveAcesso: n.chaveAcesso,
        numero: n.numero ?? null,
        dhEmi: n.dhEmi,
        prestadorCnpj: n.prestadorCnpj,
        tomadorCnpj: n.tomadorCnpj ?? null,
        cTribNac: n.cTribNac ?? null,
        municipioIncidencia: n.municipioIncidencia ?? null,
        descServico: n.descServico ?? null,
        vServ: n.vServ,
        vBc: n.vBc,
        pAliq: n.pAliq,
        vIss: n.vIss,
        tpRetISSQN: n.tpRetISSQN,
        tribISSQN: n.tribISSQN ?? null,
      },
    });

    await this.auditoria.registrar({
      tipo: 'NFSE_IMPORTADA',
      entidade: 'NotaServico',
      entidadeId: nota.id,
      usuarioId,
      dados: { chaveAcesso: nota.chaveAcesso, vIss: nota.vIss.toString(), tpRetISSQN: nota.tpRetISSQN },
    });

    return {
      notaServicoId: nota.id,
      chaveAcesso: nota.chaveAcesso,
      prestador: n.prestadorCnpj,
      vServico: nota.vServ.toFixed(2),
      vIss: nota.vIss.toFixed(2),
      retido: n.tpRetISSQN !== '1',
      observacao: 'NFS-e importada. O ISS é apurado por competência em /apuracao/iss.',
    };
  }

  listar() {
    return this.prisma.scoped.notaServico.findMany({ orderBy: { dhEmi: 'desc' } });
  }
}
