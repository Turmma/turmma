import { AuditoriaRecorder, DomainException, type Database } from '@educa/core'
import { ErrorCode, acompanhamentoResponseSchema, limiteDaTentativa, type AcompanhamentoResponse, type EstenderTempoRequest, type SituacaoNoAcompanhamento } from '@educa/shared'
import { AcompanhamentoRepository, ExtensaoRepository, type AlunoDoAcompanhamento, type LeituraDoAcompanhamento } from './acompanhamento.repository.js'
import { AtividadeAplicadaRepository } from './atividade-aplicada.repository.js'

const registro = new AuditoriaRecorder()

/**
 * Onde o aluno está na prova (RF4; Tech Spec §4). Quem não tem tentativa não começou. A tentativa enviada é `enviou`, salvo a que a rotina fechou no limite (`envio = 'limite'`), que é
 * `tempo_esgotado`. A sem envio com o limite passado também é `tempo_esgotado`: **vencida sem envio conta como enviada em toda leitura** (§5.5), e o professor lê isso como "Tempo esgotado".
 * A sem envio, com a aplicação encerrada pelo professor e o limite ainda adiante, foi levada com o salvo: `enviou`. O resto está `fazendo`.
 */
function situacaoDoAluno(aluno: AlunoDoAcompanhamento, leitura: LeituraDoAcompanhamento, limite: Date | null): SituacaoNoAcompanhamento {
  const { tentativa } = aluno
  if (tentativa === null) return 'nao_comecou'
  if (tentativa.enviadaEm !== null) return tentativa.envio === 'limite' ? 'tempo_esgotado' : 'enviou'
  if (limite !== null && leitura.agora.getTime() > limite.getTime()) return 'tempo_esgotado'
  return leitura.estado === 'encerrada' ? 'enviou' : 'fazendo'
}

/**
 * O acompanhamento e a extensão de tempo da prova (avaliacao-e-correcao, 5.0; RF4; Tech Spec §4, §5.4 e §5.6).
 *
 * - **Estender** é do professor da turma e da disciplina, com a aplicação travada em `for share` (o encerramento e a rotina a tomam em `for update`): estende **só prova aberta**
 *   (`ATIVIDADE_ENCERRADA` depois), com minutos de 1 a 120 (o contrato) e, quando a extensão é de um aluno, aluno da turma (`ENTRADA_INVALIDA`, o mesmo para o de outra turma, de outra escola e o
 *   inexistente). A `chave` é por aplicação: o pedido repetido devolve o acompanhamento sem gravar outra extensão nem outra auditoria. **A auditoria diz só o escopo** (`aluno` ou `turma`): nem os
 *   minutos nem o aluno, porque tempo a mais é adaptação, dado sensível (regra 20, item 3; D35), e a auditoria da escola não pode virar a lista de quem a recebeu. Quem deu e quando está na linha da extensão.
 * - **Acompanhar** devolve por aluno a situação e o `limiteEm` de quem está fazendo, calculado em memória pela mesma `limiteDaTentativa` de que o PUT, a saída, a rotina e o Tutor
 *   dependem, sobre uma leitura só. **Nunca a contagem de saídas da aba** (D70, D88): ela só existe no lote.
 */
export class ExtensaoService {
  constructor(private readonly banco: Database) {}

  async estender(atividadeAplicadaId: string, pedido: EstenderTempoRequest): Promise<AcompanhamentoResponse> {
    return this.banco.transaction(async (tx) => {
      const extensoes = new ExtensaoRepository(tx)
      const travada = await extensoes.lockParaEstender(atividadeAplicadaId)
      if (travada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if (travada.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
      if (pedido.alunoId !== undefined) {
        const daTurma = await new AtividadeAplicadaRepository(tx).alunosDaTurmaEntre(travada.turmaId, [pedido.alunoId.toLowerCase()])
        if (!daTurma.has(pedido.alunoId.toLowerCase())) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
      }
      const gravou = await extensoes.save(atividadeAplicadaId, pedido)
      if (gravou) await registro.save(tx, 'atividade.tempo_estendido', { entidadeId: atividadeAplicadaId, depois: { escopo: pedido.alunoId === undefined ? 'turma' : 'aluno' } })
      return this.#read(new AcompanhamentoRepository(tx), atividadeAplicadaId)
    })
  }

  acompanhar(atividadeAplicadaId: string): Promise<AcompanhamentoResponse> {
    return this.#read(new AcompanhamentoRepository(this.banco), atividadeAplicadaId)
  }

  async #read(acompanhamentos: AcompanhamentoRepository, atividadeAplicadaId: string): Promise<AcompanhamentoResponse> {
    const leitura = await acompanhamentos.read(atividadeAplicadaId)
    if (leitura === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const alunos = leitura.alunos.map((aluno) => {
      const limite =
        aluno.tentativa === null
          ? null
          : limiteDaTentativa({ alunoId: aluno.alunoId, iniciadaEm: aluno.tentativa.iniciadaEm, limiteBase: aluno.tentativa.limiteBase, extensoes: aluno.extensoes, indisponibilidades: aluno.indisponibilidades, pulso: aluno.pulso })
      const situacao = situacaoDoAluno(aluno, leitura, limite)
      return { alunoId: aluno.alunoId, nome: aluno.nome, situacao, limiteEm: situacao === 'fazendo' ? (limite?.toISOString() ?? null) : null }
    })
    return acompanhamentoResponseSchema.parse({ atividadeAplicadaId: leitura.atividadeAplicadaId, agora: leitura.agora.toISOString(), alunos })
  }
}
