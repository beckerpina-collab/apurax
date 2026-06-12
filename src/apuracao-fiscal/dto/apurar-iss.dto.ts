import { ArrayMaxSize, IsArray } from 'class-validator';
import { NotaServicoIss } from '../apuracao-iss';

export class ApurarIssDto {
  /** NFS-e emitidas no período: { vISSQN, vBC, pAliqAplic, tpRetISSQN, tribISSQN }. */
  @IsArray()
  @ArrayMaxSize(100000)
  notas!: NotaServicoIss[];
}
