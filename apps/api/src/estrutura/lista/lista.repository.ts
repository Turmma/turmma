import { credencialMatricula, requireAnoEmCurso, requireEscolaId, listaNome, requestSessao, type Database, type DatabaseTransaction } from '@educa/core'
import type { PaginationQuery, NomeDaLista } from '@educa/shared'
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'

/** Um nome a gravar: nome e matrícula já conferidos, sem espaço nas pontas. */
export interface NomeNovo {
  readonly nome: string
  readonly matricula: string
}

/** Onde a matrícula está na lista da escola neste ano. */
export interface MatriculaNaLista {
  readonly matricula: string
  readonly turmaId: string
}

const colunas = { id: listaNome.id, nome: listaNome.nome, matricula: listaNome.matricula, estado: listaNome.estado }

/** A matrícula como o índice único a guarda: é por ela que a busca usa o índice `(escola_id, ano_letivo_id, btrim)`. */
const matriculaDoIndice = sql<string>`btrim(${listaNome.matricula})`

/**
 * A lista de nomes da escola do contexto no ano letivo em curso dela, e só dela (A1, 2.0; regra 10, itens 2 e 3): escola
 * e ano vêm do contexto que a `SessaoGuard` gravou, nunca de argumento. Sem ano em curso, `requireAnoEmCurso` falha
 * fechado com `NAO_ENCONTRADO` antes de qualquer consulta. A turma de cada escrita já foi conferida pelo service
 * (`TurmaRepository.travarContraExclusao`), e a FK composta `(escola_id, ano_letivo_id, turma_id)` é a segunda camada.
 *
 * O nome e a matrícula nunca saem daqui para log: só para a resposta da coordenação.
 */
export class ListaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** Das matrículas dadas, as que já estão na lista de alguma turma da escola neste ano, com a turma. */
  async naLista(matriculas: readonly string[]): Promise<MatriculaNaLista[]> {
    if (matriculas.length === 0) return []
    return this.banco
      .select({ matricula: matriculaDoIndice, turmaId: listaNome.turmaId })
      .from(listaNome)
      .where(and(eq(listaNome.escolaId, requireEscolaId()), eq(listaNome.anoLetivoId, requireAnoEmCurso()), inArray(matriculaDoIndice, [...matriculas])))
  }

  /**
   * Das matrículas dadas, as que são de um aluno da escola (`credencial_matricula`, de qualquer ano, também a do aluno
   * desativado, que continua com ela). Só da escola do contexto: a matrícula de outra escola é outra matrícula (regra 60,
   * item 6), e dizer que ela existe lá confirmaria à coordenação um aluno de outra escola (E5).
   */
  async comCredencial(matriculas: readonly string[]): Promise<string[]> {
    if (matriculas.length === 0) return []
    const linhas = await this.banco
      .select({ matricula: credencialMatricula.matricula })
      .from(credencialMatricula)
      .where(and(eq(credencialMatricula.escolaId, requireEscolaId()), inArray(credencialMatricula.matricula, [...matriculas])))
    return linhas.map((linha) => linha.matricula)
  }

  /**
   * Das matrículas dadas, as de aluno aprovado **nesta** turma no ano em curso (A1, 8.0, E6): a credencial dele, pelo
   * usuário da linha da lista da turma, que só a linha `aprovado` tem (check `lista_nome_aprovado_sem_nome`) e que já não
   * guarda a matrícula. Reenviar a lista não as acusa de em uso: saem `ja_existe`, como a matrícula que ainda está na
   * lista da turma. Tudo na escola do contexto; o ano é a segunda camada, porque a turma é de um ano só.
   */
  async aprovadasNaTurma(turmaId: string, matriculas: readonly string[]): Promise<string[]> {
    if (matriculas.length === 0) return []
    const escolaId = requireEscolaId()
    const linhas = await this.banco
      .select({ matricula: credencialMatricula.matricula })
      .from(credencialMatricula)
      .innerJoin(listaNome, and(eq(listaNome.escolaId, credencialMatricula.escolaId), eq(listaNome.usuarioId, credencialMatricula.usuarioId)))
      .where(
        and(
          eq(credencialMatricula.escolaId, escolaId),
          inArray(credencialMatricula.matricula, [...matriculas]),
          eq(listaNome.anoLetivoId, requireAnoEmCurso()),
          eq(listaNome.turmaId, turmaId),
        ),
      )
    return linhas.map((linha) => linha.matricula)
  }

  /**
   * Grava os nomes na turma, `livre`, com quem gravou, e devolve os que entraram. A matrícula que já está na lista da
   * escola neste ano não entra de novo nem falha (`on conflict do nothing`, C8): a mesma lista gravada duas vezes ao
   * mesmo tempo entra uma vez.
   */
  inserirSemRepetir(turmaId: string, nomes: readonly NomeNovo[]): Promise<Array<{ readonly id: string; readonly matricula: string | null }>> {
    if (nomes.length === 0) return Promise.resolve([])
    const escolaId = requireEscolaId()
    const anoLetivoId = requireAnoEmCurso()
    const criadoPor = requestSessao().usuarioId
    return this.banco
      .insert(listaNome)
      .values(nomes.map(({ nome, matricula }) => ({ escolaId, anoLetivoId, turmaId, nome, matricula, criadoPor })))
      .onConflictDoNothing()
      .returning({ id: listaNome.id, matricula: listaNome.matricula })
  }

  /** Quantas das matrículas dadas estão na lista desta turma. */
  async quantasNaTurma(turmaId: string, matriculas: readonly string[]): Promise<number> {
    if (matriculas.length === 0) return 0
    const [linha] = await this.banco
      .select({ total: sql<number>`count(*)::int` })
      .from(listaNome)
      .where(
        and(
          eq(listaNome.escolaId, requireEscolaId()),
          eq(listaNome.anoLetivoId, requireAnoEmCurso()),
          eq(listaNome.turmaId, turmaId),
          inArray(matriculaDoIndice, [...matriculas]),
        ),
      )
    return linha?.total ?? 0
  }

  /**
   * Grava um nome avulso na turma, `livre`. A matrícula que já está na lista da escola neste ano é barrada pelo índice
   * único (23505), que o filtro global traduz em `CONFLITO`, e a transação de quem chamou volta atrás inteira.
   */
  async inserir(turmaId: string, { nome, matricula }: NomeNovo): Promise<NomeDaLista> {
    const [criado] = await this.banco
      .insert(listaNome)
      .values({ escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), turmaId, nome, matricula, criadoPor: requestSessao().usuarioId })
      .returning(colunas)
    if (criado === undefined) throw new InvariantException('nome da lista não criado')
    return criado
  }

  /**
   * Apaga o nome `livre` com esse id, do ano em curso, e devolve a turma dele; o nome livre sai de fato, porque é
   * pré-cadastro, sem conta nem histórico (Tech Spec da A1, seção 7). O reivindicado e o aprovado não saem, nem o nome de
   * outro ano, de outra escola ou inexistente (`undefined`).
   */
  async retirarLivre(id: string): Promise<{ readonly turmaId: string } | undefined> {
    const [apagado] = await this.banco
      .delete(listaNome)
      .where(and(eq(listaNome.escolaId, requireEscolaId()), eq(listaNome.anoLetivoId, requireAnoEmCurso()), eq(listaNome.id, id), eq(listaNome.estado, 'livre')))
      .returning({ turmaId: listaNome.turmaId })
    return apagado
  }

  /** Se o nome com esse id existe na escola, no ano em curso, em qualquer estado. */
  async existe(id: string): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: listaNome.id })
      .from(listaNome)
      .where(and(eq(listaNome.escolaId, requireEscolaId()), eq(listaNome.anoLetivoId, requireAnoEmCurso()), eq(listaNome.id, id)))
    return linha !== undefined
  }

  /**
   * Uma página dos nomes da turma no ano em curso, em ordem de id, com uma linha a mais que diz se há próxima. Não
   * confere quem pede: o service chama depois de abrir a turma.
   */
  pagina(turmaId: string, { pagina, limite }: PaginationQuery): Promise<NomeDaLista[]> {
    return this.banco
      .select(colunas)
      .from(listaNome)
      .where(
        and(
          eq(listaNome.escolaId, requireEscolaId()),
          eq(listaNome.anoLetivoId, requireAnoEmCurso()),
          eq(listaNome.turmaId, turmaId),
          pagina === undefined ? undefined : gt(listaNome.id, pagina),
        ),
      )
      .orderBy(asc(listaNome.id))
      .limit(limite + 1)
  }
}
