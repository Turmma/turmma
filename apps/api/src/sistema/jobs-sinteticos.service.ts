import { JobOutbox, DomainException, JobOutboxRepository, type Database } from '@educa/core'
import {
  ErrorCode,
  jobStateResponseSchema,
  TIPO_JOB_SINTETICO,
  type SyntheticJobRequest,
  type JobStateResponse,
  type JobAcceptedResponse,
} from '@educa/shared'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { BANCO } from '../banco.module.js'

@Injectable()
export class JobsSinteticosService {
  private readonly logger = new Logger('jobs')

  constructor(
    @Inject(BANCO) private readonly banco: Database,
    private readonly enfileirador: JobOutbox,
    private readonly repositorio: JobOutboxRepository,
  ) {}

  /**
   * Grava o job e responde na hora; quem executa é o worker. Dois pedidos iguais criam dois jobs:
   * a rota é de teste e não tem chave de idempotência (Tech Spec, seção 4).
   */
  async enfileirar(pedido: SyntheticJobRequest): Promise<JobAcceptedResponse> {
    const jobId = await this.banco.transaction((tx) =>
      // O tipo é sempre o sintético: o corpo da requisição escolhe a fila e o `naoUrgente`, e mais nada.
      this.enfileirador.enfileirar(tx, TIPO_JOB_SINTETICO, { cpuMs: pedido.cpuMs, falhar: pedido.falhar ?? false }, { fila: pedido.fila, naoUrgente: pedido.naoUrgente }),
    )
    // A linha leva o `requisicaoId` e a escola pelo contexto: é por ele que se segue o job até o worker.
    this.logger.log('job.enfileirado')
    return { jobId }
  }

  /** Estado do job da escola do token. De outra escola ou inexistente, o mesmo 404. */
  async consultar(id: string): Promise<JobStateResponse> {
    const registro = await this.repositorio.buscarDaEscola(id)
    if (registro === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return jobStateResponseSchema.parse({
      estado: registro.estado,
      criadoEm: registro.criadoEm.toISOString(),
      ...(registro.iniciadoEm === null ? {} : { iniciadoEm: registro.iniciadoEm.toISOString() }),
      ...(registro.concluidoEm === null ? {} : { concluidoEm: registro.concluidoEm.toISOString() }),
      ...(registro.codigoFalha === null ? {} : { codigoFalha: registro.codigoFalha }),
    })
  }
}
