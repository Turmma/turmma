import { acessoTurma, exigirAnoEmCurso, exigirEscolaDoContexto, sessaoDaRequisicao, type Banco, type TransacaoBanco } from '@educa/nucleo'
import type { ValidadeDoAcessoDias } from '@educa/shared'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'

export interface NovoAcesso {
  readonly turmaId: string
  readonly tokenHash: string
  readonly codigoHmac: string
  readonly validadeDias: ValidadeDoAcessoDias
}

/**
 * O acesso da turma na escola do contexto, no ano letivo em curso dela (A1, tarefa 4.0; regra 10, itens 2 e 3): escola
 * e ano vêm do contexto que a `GuardaDeSessao` gravou, nunca de argumento. Quem chama confere antes que a turma é do
 * professor (`TurmaRepository.travarComVinculoDoProfessor` ou `aberta` com `turma_vinculada`); aqui a turma é só um
 * filtro, e as FKs compostas `(escola_id, ano_letivo_id, turma_id)` e `(escola_id, criado_por)` são a segunda camada.
 *
 * Vigente é o não revogado com `expira_em > now()`. Nada daqui devolve o hash do token nem o HMAC do código.
 */
export class AcessoDaTurmaRepository {
  constructor(private readonly banco: Banco | TransacaoBanco) {}

  /** O acesso da turma, na escola e no ano do contexto. */
  #daTurma(turmaId: string) {
    return and(eq(acessoTurma.escolaId, exigirEscolaDoContexto()), eq(acessoTurma.anoLetivoId, exigirAnoEmCurso()), eq(acessoTurma.turmaId, turmaId))
  }

  /**
   * Revoga todo acesso não revogado da turma, vigente ou vencido, e devolve os ids ("Gerar novo", RF9): o vencido também,
   * porque o índice único por turma olha só o `revogado_em`. O gerar que chega ao mesmo tempo espera a linha e, relida,
   * ela já está revogada: ele não revoga de novo (C5).
   */
  async revogarNaoRevogados(turmaId: string): Promise<string[]> {
    const revogados = await this.banco
      .update(acessoTurma)
      .set({ revogadoEm: sql`now()` })
      .where(and(this.#daTurma(turmaId), isNull(acessoTurma.revogadoEm)))
      .returning({ id: acessoTurma.id })
    return revogados.map((revogado) => revogado.id)
  }

  /**
   * Grava o acesso novo, com o professor do contexto como autor e o `expira_em` contado de agora pela validade. O token e
   * o código repetidos entre os não revogados, ou a turma que já tem um não revogado, sobem como o 23505 do índice único:
   * quem chama grava num savepoint e decide.
   */
  async inserir(novo: NovoAcesso): Promise<{ readonly id: string; readonly expiraEm: Date }> {
    const [gravado] = await this.banco
      .insert(acessoTurma)
      .values({
        escolaId: exigirEscolaDoContexto(),
        anoLetivoId: exigirAnoEmCurso(),
        turmaId: novo.turmaId,
        tokenHash: novo.tokenHash,
        codigoHmac: novo.codigoHmac,
        validadeDias: novo.validadeDias,
        expiraEm: sql`now() + make_interval(days => ${novo.validadeDias}::int)`,
        criadoPor: sessaoDaRequisicao().usuarioId,
      })
      .returning({ id: acessoTurma.id, expiraEm: acessoTurma.expiraEm })
    if (gravado === undefined) throw new InvariantException('acesso da turma não gravado')
    return gravado
  }

  /** Se a turma tem acesso não revogado: depois de um 23505, separa a turma que outro gerar tomou da colisão do código. */
  async temNaoRevogado(turmaId: string): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: acessoTurma.id })
      .from(acessoTurma)
      .where(and(this.#daTurma(turmaId), isNull(acessoTurma.revogadoEm)))
      .limit(1)
    return linha !== undefined
  }

  /** Revoga o acesso vigente da turma e devolve o id, ou `undefined` quando ela não tem nenhum. */
  async revogarVigente(turmaId: string): Promise<string | undefined> {
    const [revogado] = await this.banco
      .update(acessoTurma)
      .set({ revogadoEm: sql`now()` })
      .where(and(this.#daTurma(turmaId), isNull(acessoTurma.revogadoEm), gt(acessoTurma.expiraEm, sql`now()`)))
      .returning({ id: acessoTurma.id })
    return revogado?.id
  }

  /**
   * Revoga todo acesso vigente da escola do contexto, de todas as turmas, e devolve o id e a turma de cada um (o
   * `ops:revogar-acessos-sala`, A1, tarefa 9.0; runbook, "Código da turma errado em massa numa escola"). O escopo é só a
   * escola: o comando do operador não tem ano no contexto, e o que ele derruba é tudo que o atacante podia estar
   * testando naquela escola. Um vigente de outro ano não abre a sala (o `AcessoDaSala` exige o ano `em_curso`), e cair
   * junto não tira nada de ninguém. Duas execuções ao mesmo tempo esperam a linha uma da outra e, relida, ela já está
   * revogada: cada acesso sai numa só.
   */
  async revogarVigentesDaEscola(): Promise<Array<{ readonly id: string; readonly turmaId: string }>> {
    return this.banco
      .update(acessoTurma)
      .set({ revogadoEm: sql`now()` })
      .where(and(eq(acessoTurma.escolaId, exigirEscolaDoContexto()), isNull(acessoTurma.revogadoEm), gt(acessoTurma.expiraEm, sql`now()`)))
      .returning({ id: acessoTurma.id, turmaId: acessoTurma.turmaId })
  }

  /** Até quando vale o acesso vigente da turma, ou `undefined` quando ela não tem nenhum. */
  async vigente(turmaId: string): Promise<Date | undefined> {
    const [linha] = await this.banco
      .select({ expiraEm: acessoTurma.expiraEm })
      .from(acessoTurma)
      .where(and(this.#daTurma(turmaId), isNull(acessoTurma.revogadoEm), gt(acessoTurma.expiraEm, sql`now()`)))
      .limit(1)
    return linha?.expiraEm
  }
}
