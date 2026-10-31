import { DomainException, postgresErrorIn, AuditoriaRecorder, DEFAULT_RETRY_AFTER_SECONDS, type Database } from '@educa/core'
import { ErrorCode, acessoDaTurmaResponseSchema, acessoGeradoResponseSchema, type GerarAcessoRequest, type AcessoDaTurmaResponse, type AcessoGeradoResponse } from '@educa/shared'
import { TurmaRepository } from '../../estrutura/turma/turma.repository.js'
import { AcessoDaTurmaRepository } from './acesso-da-turma.repository.js'
import { hashDoToken } from '../../credencial/index.js'
import { hmacDoCodigoDaTurma, sortearTokenDaSala, type SorteioDoCodigo } from '../codigo-da-sala.js'

const registro = new AuditoriaRecorder()

/** SQLSTATE `unique_violation`: o índice único recusou a linha. */
const LINHA_REPETIDA = '23505'

/**
 * Quantas vezes o gerar sorteia o código antes de desistir com 503. Com 31⁸ códigos e algumas centenas vigentes numa
 * escola, uma colisão já é rara (~10⁻⁹); três seguidas só acontecem com o sorteio quebrado, e aí tentar de novo mais
 * tarde é melhor que um 500.
 */
export const SORTEIOS_DO_CODIGO = 3

/**
 * O acesso da turma pelo professor (A1, tarefa 4.0, RF9; Tech Spec da A1, seções 3, 4 e 7c). As três rotas são só do
 * professor com vínculo `confirmado` na turma do ano em curso (célula `turma_vinculada`): o sem vínculo, o pendente, o
 * contestado, o encerrado, o de outra turma ou escola, a coordenação e o aluno recebem o `NAO_ENCONTRADO` da turma
 * inexistente (P2).
 *
 * Nada disto loga: o token e o código nunca vão a log nem à auditoria, que leva só ids e a validade. O link e o código
 * aparecem uma vez, na resposta do gerar.
 */
export class AcessoDaTurmaService {
  constructor(
    private readonly banco: Database,
    private readonly chaveCodigo: Uint8Array,
    private readonly sortearCodigo: SorteioDoCodigo,
  ) {}

  /**
   * `POST /v1/turmas/:id/acesso`: gera o link da sala e o código da turma, com a validade escolhida, numa transação:
   *
   * 1. Trava o ano em curso (`FOR SHARE`), como o criar turma: o encerramento que chega depois espera, e o que chegou
   *    antes faz o gerar sair `NAO_ENCONTRADO`. O ano encerrado não ganha acesso novo, nem na corrida.
   * 2. Trava a turma com o vínculo confirmado do professor (`FOR SHARE`, C11): a turma que outra transação apagou não é
   *    achada, e sai `NAO_ENCONTRADO`, nunca a FK violada.
   * 3. Revoga todo acesso não revogado da turma, também o de outro professor (E14), e grava o novo. O 23505 do índice é
   *    resolvido num savepoint, para a transação continuar viva (C6): com outro acesso não revogado na turma, foi outro
   *    gerar ao mesmo tempo, e sai `CONFLITO` (C5); sem, foi o código que repetiu, e sorteia de novo, até
   *    `SORTEIOS_DO_CODIGO` vezes, e depois 503 `INDISPONIVEL_TENTE_DE_NOVO`.
   * 4. Grava `acesso_turma.gerado`, com os acessos que derrubou.
   */
  async gerar(turmaId: string, { validadeDias }: GerarAcessoRequest): Promise<AcessoGeradoResponse> {
    const gerado = await this.banco.transaction(async (tx) => {
      const turmas = new TurmaRepository(tx)
      if (!(await turmas.travarAnoEmCurso())) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if (!(await turmas.travarComVinculoDoProfessor(turmaId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const acessos = new AcessoDaTurmaRepository(tx)
      const substituidos = await acessos.revogarNaoRevogados(turmaId)
      for (let sorteio = 1; sorteio <= SORTEIOS_DO_CODIGO; sorteio++) {
        const token = sortearTokenDaSala()
        const codigo = this.sortearCodigo()
        const novo = { turmaId, tokenHash: hashDoToken(token), codigoHmac: hmacDoCodigoDaTurma(this.chaveCodigo, codigo), validadeDias }
        let gravado: { readonly id: string; readonly expiraEm: Date }
        try {
          gravado = await tx.transaction((savepoint) => new AcessoDaTurmaRepository(savepoint).inserir(novo))
        } catch (erro) {
          if (postgresErrorIn(erro)?.code !== LINHA_REPETIDA) throw erro
          if (await acessos.temNaoRevogado(turmaId)) throw new DomainException(ErrorCode.CONFLITO)
          continue
        }
        const expiraEm = gravado.expiraEm.toISOString()
        await registro.gravar(tx, 'acesso_turma.gerado', { entidadeId: gravado.id, depois: { turmaId, validadeDias, expiraEm, substituidos } })
        return { token, codigo, expiraEm }
      }
      throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
    })
    return acessoGeradoResponseSchema.parse(gerado)
  }

  /**
   * `POST /v1/turmas/:id/acesso/revogar`: o link e o código vigentes da turma deixam de valer na hora, com
   * `acesso_turma.revogado` na mesma transação. Sem acesso vigente (revogado, vencido ou nunca gerado):
   * `NAO_ENCONTRADO`, como o convite já revogado.
   */
  async revogar(turmaId: string): Promise<void> {
    await this.banco.transaction(async (tx) => {
      if ((await new TurmaRepository(tx).aberta(turmaId, 'turma_vinculada')) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const revogado = await new AcessoDaTurmaRepository(tx).revogarVigente(turmaId)
      if (revogado === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      await registro.gravar(tx, 'acesso_turma.revogado', { entidadeId: revogado, depois: { turmaId } })
    })
  }

  /** `GET /v1/turmas/:id/acesso`: só até quando vale o acesso vigente, ou `null` sem nenhum. Nunca o link nem o código. */
  async ler(turmaId: string): Promise<AcessoDaTurmaResponse> {
    if ((await new TurmaRepository(this.banco).aberta(turmaId, 'turma_vinculada')) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const expiraEm = await new AcessoDaTurmaRepository(this.banco).vigente(turmaId)
    return acessoDaTurmaResponseSchema.parse({ expiraEm: expiraEm?.toISOString() ?? null })
  }
}
