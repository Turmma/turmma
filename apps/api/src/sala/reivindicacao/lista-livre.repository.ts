import { requireAnoEmCurso, requireEscolaId, listaNome, turma, type Database, type DatabaseTransaction } from '@educa/nucleo'
import { MAXIMO_DE_NOMES_NA_SALA } from '@educa/shared'
import { and, asc, eq, ne } from 'drizzle-orm'

/** Um nome livre como a página da sala o mostra: o id e o nome, nunca a matrícula. */
export interface NomeLivre {
  readonly id: string
  readonly nome: string | null
}

/** O nome que o aluno escolheu na sala, com a matrícula que ele digitou, na turma do acesso. */
export interface NomeEscolhido {
  readonly turmaId: string
  readonly listaNomeId: string
  readonly matricula: string
}

/**
 * O que a página pública da sala mostra e toma (A1, tarefas 5.0 e 6.0), na escola e no ano do contexto que o
 * `AcessoDaSala` abriu com a linha do acesso vigente (regra 10, item 3): o nome da turma, os nomes livres da lista dela
 * e, na reivindicação, o nome livre que passa a `reivindicado`. Escola e ano vêm do contexto, nunca de argumento; a
 * turma também é a da linha do acesso, e aqui é só filtro.
 *
 * Lido a cada abertura, sem cache: o nome avulso que a coordenação acrescentou aparece no link já vigente (E26), e o
 * nome que alguém reivindicou some. A matrícula não sai daqui, e nada daqui vai a log.
 */
export class ListaLivreRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** O nome da turma, ou `undefined` quando ela não está na escola e no ano do contexto. */
  async nomeDaTurma(turmaId: string): Promise<string | undefined> {
    const [linha] = await this.banco
      .select({ nome: turma.nome })
      .from(turma)
      .where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, requireAnoEmCurso()), eq(turma.id, turmaId)))
      .limit(1)
    return linha?.nome
  }

  /**
   * Os nomes `livre` da lista da turma, em ordem de nome, até `MAXIMO_DE_NOMES_NA_SALA`, pelo índice `(escola_id, ano_letivo_id,
   * turma_id, estado)`. O reivindicado e o aprovado não aparecem.
   */
  async nomesLivres(turmaId: string): Promise<NomeLivre[]> {
    return this.banco
      .select({ id: listaNome.id, nome: listaNome.nome })
      .from(listaNome)
      .where(
        and(eq(listaNome.escolaId, requireEscolaId()), eq(listaNome.anoLetivoId, requireAnoEmCurso()), eq(listaNome.turmaId, turmaId), eq(listaNome.estado, 'livre')),
      )
      .orderBy(asc(listaNome.nome))
      .limit(MAXIMO_DE_NOMES_NA_SALA)
  }

  /**
   * Toma o nome para o pedido (6.0): o `update` condicional passa o nome a `reivindicado` só se ele é daquele id, da
   * escola e do ano do contexto, da turma do acesso, ainda `livre` e com a matrícula digitada (que chega sem espaço nas
   * pontas, como a lista a guarda). Diz se tomou: `false` para o nome de outra turma, escola ou ano, já tomado ou com
   * a matrícula de outro, sem dizer qual. Roda na transação do pedido, depois do `insert` dele.
   */
  async tomar({ turmaId, listaNomeId, matricula }: NomeEscolhido): Promise<boolean> {
    const tomados = await this.banco
      .update(listaNome)
      .set({ estado: 'reivindicado' })
      .where(
        and(
          eq(listaNome.escolaId, requireEscolaId()),
          eq(listaNome.anoLetivoId, requireAnoEmCurso()),
          eq(listaNome.turmaId, turmaId),
          eq(listaNome.id, listaNomeId),
          eq(listaNome.estado, 'livre'),
          eq(listaNome.matricula, matricula),
        ),
      )
      .returning({ id: listaNome.id })
    return tomados.length === 1
  }

  /**
   * Se o pedido traz matrícula errada para um nome livre (7.0; Tech Spec da A1, seção 5, passo 5): lido antes do hash,
   * fora da transação, com a escola e o ano do contexto e a turma do acesso. O nome de outra turma, de outra escola,
   * inexistente, tomado ou com a matrícula certa (também a chave de outro pedido da escola, E21) dá `false`, e não conta no
   * limite do nome: só o nome livre da turma do acesso trava, e o travado não diz a ninguém que existe um nome que a página
   * da sala não mostra. A resposta ao aluno não muda com isto: o hash roda do mesmo jeito. Escola e ano são segunda
   * camada: a turma é a da linha do acesso, e a FK composta da lista prende o nome a ela.
   */
  async livreComOutraMatricula({ turmaId, listaNomeId, matricula }: NomeEscolhido): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: listaNome.id })
      .from(listaNome)
      .where(
        and(
          eq(listaNome.escolaId, requireEscolaId()),
          eq(listaNome.anoLetivoId, requireAnoEmCurso()),
          eq(listaNome.turmaId, turmaId),
          eq(listaNome.id, listaNomeId),
          eq(listaNome.estado, 'livre'),
          ne(listaNome.matricula, matricula),
        ),
      )
      .limit(1)
    return linha !== undefined
  }
}
