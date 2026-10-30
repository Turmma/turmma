import { ErroDeDominio, type Banco } from '@educa/nucleo'
import { ErrorCode, minhaTurmaResponseSchema, type MinhaTurmaResponse } from '@educa/shared'
import { MinhaTurmaRepository } from './minha-turma.repository.js'

/**
 * `GET /v1/minha-turma` (A1, tarefa 8.0, RF13): o aluno aprovado vê a própria turma, a escola e a série, e nada dos
 * colegas. O aluno sem vínculo confirmado no ano em curso (pedido ainda pendente, vínculo só no ano encerrado) recebe
 * `NAO_ENCONTRADO`; a célula `minha_turma` é só do aluno, e professor e coordenação recebem o mesmo 404 da guarda (P4).
 */
export class MinhaTurmaService {
  constructor(private readonly banco: Banco) {}

  async ler(): Promise<MinhaTurmaResponse> {
    const minha = await new MinhaTurmaRepository(this.banco).daSessao()
    if (minha === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
    return minhaTurmaResponseSchema.parse(minha)
  }
}
