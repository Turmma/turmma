import type { AulaDaGrade } from '@educa/shared'
import { and, asc, eq, ne } from 'drizzle-orm'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { alocacao } from '../db/schema/alocacao.js'
import { turma } from '../db/schema/turma.js'
import { usuario } from '../db/schema/usuario.js'
import { vinculo } from '../db/schema/vinculo.js'
import { requestSessao } from '../identidade/auth.guard.js'

/** O `time` do Postgres vem como `HH:MM:SS`; o contrato fala em `HH:MM`. */
const horario = (valor: string): string => valor.slice(0, 5)

/**
 * A leitura da grade de uma turma (F2, 12.0; Tech Spec, seção 4): `GET /v1/grade?turmaId=`. Escola e usuário vêm do contexto (regra 10, item 3); o
 * ano é o argumento, já conferido por quem chama (o `anoDeDestino` da coordenação, o ano em curso do professor). A escrita da grade é do motor da
 * planilha, e não passa por aqui. Não há leitura por professor: a grade é da turma, e não a medida de quem a dá (regra 70, item 8).
 */
export class GradeRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** Se a turma é da escola do contexto e do ano dado. Id de outra escola, ou de outro ano, não acha nada. */
  async turmaExiste(anoLetivoId: string, turmaId: string): Promise<boolean> {
    const [achada] = await this.banco
      .select({ id: turma.id })
      .from(turma)
      .where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, anoLetivoId), eq(turma.id, turmaId)))
      .limit(1)
    return achada !== undefined
  }

  /**
   * As aulas da turma no ano, por dia, início e id, com o id e o nome do professor de cada uma: o e-mail nunca é lido. A aula de vínculo
   * `encerrado` não aparece (quem saiu da turma não dá mais a aula, ainda que a reimportação não a tenha tirado), e a de vínculo `pendente` ou
   * `contestado` aparece: a grade é o que a escola definiu, e só o acesso à turma espera a confirmação.
   */
  async aulasDaTurma(anoLetivoId: string, turmaId: string): Promise<AulaDaGrade[]> {
    const escolaId = requireEscolaId()
    const linhas = await this.banco
      .select({
        id: alocacao.id,
        turmaId: vinculo.turmaId,
        disciplinaId: vinculo.disciplinaId,
        usuarioId: usuario.id,
        nome: usuario.nome,
        diaSemana: alocacao.diaSemana,
        inicio: alocacao.inicio,
        fim: alocacao.fim,
        sala: alocacao.sala,
      })
      .from(alocacao)
      .innerJoin(vinculo, and(eq(vinculo.escolaId, alocacao.escolaId), eq(vinculo.anoLetivoId, alocacao.anoLetivoId), eq(vinculo.id, alocacao.vinculoId)))
      .innerJoin(usuario, and(eq(usuario.escolaId, vinculo.escolaId), eq(usuario.id, vinculo.usuarioId)))
      .where(and(eq(alocacao.escolaId, escolaId), eq(alocacao.anoLetivoId, anoLetivoId), eq(vinculo.turmaId, turmaId), ne(vinculo.estado, 'encerrado')))
      .orderBy(asc(alocacao.diaSemana), asc(alocacao.inicio), asc(alocacao.id))
    return linhas.map(({ usuarioId, nome, inicio, fim, ...resto }) => ({ ...resto, inicio: horario(inicio), fim: horario(fim), professor: { usuarioId, nome } }))
  }

  /**
   * Se o professor da sessão tem vínculo `confirmado` nesta turma, no ano dado (RF16; regra 60, item 8a): o vínculo `pendente`, `contestado` ou
   * `encerrado` não abre a grade. Lido a cada chamada, nunca guardado no token: o vínculo encerrado fecha a grade na mesma hora.
   */
  async professorTemVinculoConfirmadoNaTurma(anoLetivoId: string, turmaId: string): Promise<boolean> {
    const [achado] = await this.banco
      .select({ id: vinculo.id })
      .from(vinculo)
      .where(
        and(
          eq(vinculo.escolaId, requireEscolaId()),
          eq(vinculo.anoLetivoId, anoLetivoId),
          eq(vinculo.turmaId, turmaId),
          eq(vinculo.usuarioId, requestSessao().usuarioId),
          eq(vinculo.papel, 'professor'),
          eq(vinculo.estado, 'confirmado'),
        ),
      )
      .limit(1)
    return achado !== undefined
  }
}
