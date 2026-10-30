import { DomainException, requireAnoEmCurso, AuditoriaRecorder, requestSessao, type Database } from '@educa/nucleo'
import {
  alcanceDe,
  ErrorCode,
  InvariantException,
  alunosDaTurmaResponseSchema,
  listaDeTurmasResponseSchema,
  turmaResponseSchema,
  turmaAbertaResponseSchema,
  type AlunosDaTurmaQuery,
  type PaginationQuery,
  type TurmaQuery,
  type CriarTurmaRequest,
  type RenomearTurmaRequest,
  type AlunosDaTurmaResponse,
  type ListaDeTurmasResponse,
  type TurmaResponse,
  type TurmaAbertaResponse,
} from '@educa/shared'
import { paginar, paginarPor } from '../../http/paginacao.js'
import { SerieRepository } from '../serie/serie.repository.js'
import { TurmaRepository, type AlcanceDaTurma } from './turma.repository.js'

const registro = new AuditoriaRecorder()

/**
 * Como o papel da sessão alcança a turma, pela célula da `MATRIZ`: `unidade` e `nominal_auditado` são a coordenação,
 * que alcança toda turma da escola; `turma_vinculada` é o professor, que precisa do vínculo confirmado. Qualquer outro
 * alcance não chega aqui (a guarda de permissão barra o `nunca`) e, se chegasse, responderia como inexistente.
 */
function alcanceDaTurma(recurso: 'turma' | 'aluno_da_turma'): AlcanceDaTurma {
  const alcance = alcanceDe(requestSessao().papel, recurso, 'ler')
  if (alcance === 'unidade' || alcance === 'nominal_auditado') return 'unidade'
  if (alcance === 'turma_vinculada') return 'turma_vinculada'
  throw new DomainException(ErrorCode.NAO_ENCONTRADO)
}

/**
 * A coordenação cria, lista, renomeia e exclui as turmas do ano letivo em curso (RF2; A1, RF3; regra 60, item 5). Sem
 * ano em curso, todas essas rotas falham fechadas com `NAO_ENCONTRADO` (Tech Spec, seção 5, "Requisição").
 *
 * - A turma nasce no ano em curso da escola da sessão. Um `anoLetivoId` no corpo que não seja ele (planejado,
 *   encerrado, de outra escola, inexistente) responde como inexistente, e nada é criado.
 * - Série de outra escola ou inexistente: `NAO_ENCONTRADO`, igual.
 * - O mesmo nome no mesmo ano, sem diferenciar maiúscula: `CONFLITO`, sem o valor.
 */
export class TurmaService {
  constructor(private readonly banco: Database) {}

  async criar(pedido: CriarTurmaRequest): Promise<TurmaResponse> {
    const anoEmCurso = requireAnoEmCurso()
    if (pedido.anoLetivoId !== undefined && pedido.anoLetivoId.toLowerCase() !== anoEmCurso) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const criada = await this.banco.transaction(async (tx) => {
      const turmas = new TurmaRepository(tx)
      if (!(await turmas.travarAnoEmCurso())) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const serie = await new SerieRepository(tx).porId(pedido.serieId.toLowerCase())
      if (serie === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      return { ...(await turmas.criar({ serieId: serie.id, nome: pedido.nome, turno: pedido.turno ?? null })), serie }
    })
    return turmaResponseSchema.parse(criada)
  }

  /**
   * `PATCH /v1/turmas/:id` (A1, RF3): a coordenação troca o nome da turma do ano em curso. Turma de outro ano, de outra
   * escola ou inexistente: `NAO_ENCONTRADO`, e nada muda. O nome de outra turma do mesmo ano: `CONFLITO`, sem o valor.
   */
  async renomear(id: string, pedido: RenomearTurmaRequest): Promise<TurmaResponse> {
    const renomeada = await this.banco.transaction(async (tx) => {
      const gravada = await new TurmaRepository(tx).renomear(id, pedido.nome)
      if (gravada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const { serieId, ...turma } = gravada
      const serie = await new SerieRepository(tx).porId(serieId)
      if (serie === undefined) throw new InvariantException('série da turma não encontrada')
      return { ...turma, serie }
    })
    return turmaResponseSchema.parse(renomeada)
  }

  /**
   * `DELETE /v1/turmas/:id` (A1, RF3): a turma vazia do ano em curso sai. Com vínculo, nome na lista ou acesso vigente
   * (4.0): `CONFLITO`, e nada é apagado; o acesso revogado ou vencido sai com ela. Turma de outro ano, de outra escola ou
   * inexistente: `NAO_ENCONTRADO`.
   *
   * A turma é travada em `FOR UPDATE` num comando próprio, antes do `delete` (C11): o gerar acesso que está no meio
   * termina primeiro, e o `delete` enxerga o acesso dele. Travada e não apagada, a turma só pode ter acesso vigente.
   */
  async excluir(id: string): Promise<void> {
    await this.banco.transaction(async (tx) => {
      const turmas = new TurmaRepository(tx)
      if (!(await turmas.travarContraOGerar(id, 'update'))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if (!(await turmas.excluir(id))) throw new DomainException(ErrorCode.CONFLITO)
    })
  }

  async listar(consulta: PaginationQuery): Promise<ListaDeTurmasResponse> {
    const linhas = await new TurmaRepository(this.banco).listar(consulta)
    return listaDeTurmasResponseSchema.parse(paginar(linhas, consulta.limite))
  }

  /**
   * `GET /v1/turmas/:id` (RF5, RF15): a coordenação abre qualquer turma do ano em curso da escola; o professor, só a
   * turma em que tem vínculo `confirmado`. Pendente, contestado, encerrado, turma de outra escola ou inexistente: o
   * mesmo `NAO_ENCONTRADO`.
   *
   * Com `?anoLetivoId` (10.0, RF16), a leitura é de um ano `encerrado` da escola, só leitura: a coordenação abre sem
   * vínculo; o professor, só a turma em que o vínculo chegou confirmado ao fim do ano (nem `desligamento`, nem
   * `realocacao`, nem outra turma do mesmo ano). O ano em curso, de outra escola ou inexistente: o mesmo 404.
   */
  async abrir(id: string, { anoLetivoId }: TurmaQuery): Promise<TurmaAbertaResponse> {
    const aberta = await new TurmaRepository(this.banco).aberta(id, alcanceDaTurma('turma'), anoLetivoId?.toLowerCase())
    if (aberta === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return turmaAbertaResponseSchema.parse(aberta)
  }

  /**
   * `GET /v1/turmas/:id/alunos` (RF5; regra 20, itens 4, 5 e 10): o mesmo critério de acesso da turma, e uma página de
   * `{ usuarioId, nome }`.
   *
   * A coordenação (`nominal_auditado`) é obrigada a dizer a finalidade, e a leitura grava `turma.alunos_lidos` na mesma
   * transação: sem registro, sem lista. A finalidade é conferida antes de procurar a turma, então a falta dela responde
   * igual para qualquer id. O professor com vínculo confirmado lê a própria turma sem finalidade e sem registro.
   *
   * Com `?anoLetivoId`, as mesmas condições de `abrir` para o ano encerrado, e a mesma finalidade e auditoria para a
   * coordenação.
   */
  async alunos(id: string, consulta: AlunosDaTurmaQuery): Promise<AlunosDaTurmaResponse> {
    const nominalAuditado = alcanceDe(requestSessao().papel, 'aluno_da_turma', 'ler') === 'nominal_auditado'
    const { finalidade } = consulta
    if (nominalAuditado && finalidade === undefined) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
    const alcance = alcanceDaTurma('aluno_da_turma')
    const anoEncerrado = consulta.anoLetivoId?.toLowerCase()
    const pagina = await this.banco.transaction(async (tx) => {
      const turmas = new TurmaRepository(tx)
      if ((await turmas.aberta(id, alcance, anoEncerrado)) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const cortada = paginarPor(await turmas.alunos(id, consulta, anoEncerrado), consulta.limite, (aluno) => aluno.usuarioId)
      if (nominalAuditado && finalidade !== undefined) {
        await registro.gravar(tx, 'turma.alunos_lidos', { entidadeId: id, depois: { quantidade: cortada.itens.length }, finalidade })
      }
      return cortada
    })
    return alunosDaTurmaResponseSchema.parse(pagina)
  }
}
