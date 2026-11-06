import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import { currentContext } from '../context/context.js'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { alocacao } from '../db/schema/alocacao.js'
import { anoLetivo } from '../db/schema/ano-letivo.js'
import { aula } from '../db/schema/aula.js'
import { disciplina } from '../db/schema/disciplina.js'
import { eventoCalendario } from '../db/schema/evento-calendario.js'
import { turma } from '../db/schema/turma.js'
import { vinculo } from '../db/schema/vinculo.js'
import { requestSessao } from '../identidade/auth.guard.js'

/** O `time` do Postgres vem como `HH:MM:SS`; o contrato fala em `HH:MM`. */
const horario = (valor: string): string => valor.slice(0, 5)

/** O ano em curso da escola, com o período. */
export interface AnoDaSemana {
  readonly id: string
  readonly inicio: string
  readonly fim: string
}

/** O vínculo `confirmado` de professor da sessão, com os nomes que a aula mostra. */
export interface VinculoDaSemana {
  readonly id: string
  readonly turmaId: string
  readonly turma: string
  readonly disciplinaId: string
  readonly disciplina: string
}

/** A alocação do vínculo: o dia da semana (1 = segunda a 7 = domingo), o horário e a sala. */
export interface AlocacaoDaSemana {
  readonly vinculoId: string
  readonly diaSemana: number
  readonly inicio: string
  readonly fim: string
  readonly sala: string | null
}

export interface EventoDaSemana {
  readonly tipo: 'feriado' | 'recesso' | 'evento'
  readonly inicio: string
  readonly fim: string
  readonly descricao: string
}

/** O registro de texto da aula (`aula`), com o `conteudo` que só a professora dona do vínculo lê. */
export interface RegistroDaSemana {
  readonly vinculoId: string
  readonly data: string
  readonly inicio: string
  readonly fim: string
  readonly conteudo: string
}

/**
 * A leitura da Semana do professor (F2b, tarefa 2.0; Tech Spec da semana-do-professor, seção 5, "Ler"). Escola e ano vêm do contexto, e a
 * professora é a da sessão (regra 10, item 3; alcance `proprio` da matriz): nenhum método recebe escola nem usuário. Os métodos que leem
 * alocação e registro recebem os ids dos vínculos que `vinculosDaProfessora` devolveu, e ainda assim repetem a escola e o ano na consulta.
 * A escrita do registro é do `AulaRepository` (4.0). Nunca lê e-mail nem nome de professor ou de aluno, e o texto nunca vai a log.
 */
export class SemanaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * O ano em curso da escola do contexto, ou `null` quando a escola não tem um (só `planejado` ou `encerrado`). Não usa `requireAnoEmCurso`:
   * sem ano em curso a Semana responde `ano: null`, e não `NAO_ENCONTRADO`.
   */
  async anoEmCurso(): Promise<AnoDaSemana | null> {
    const anoLetivoId = currentContext()?.anoLetivoId
    if (typeof anoLetivoId !== 'string') return null
    const [achado] = await this.banco
      .select({ id: anoLetivo.id, inicio: anoLetivo.inicio, fim: anoLetivo.fim })
      .from(anoLetivo)
      .where(and(eq(anoLetivo.escolaId, requireEscolaId()), eq(anoLetivo.id, anoLetivoId), eq(anoLetivo.situacao, 'em_curso')))
      .limit(1)
    return achado ?? null
  }

  /** Os vínculos `confirmado` de professor da sessão no ano, por turma e disciplina. Pendente, contestado e encerrado não dão aula (regra 60, item 8a). */
  async vinculosDaProfessora(anoLetivoId: string): Promise<VinculoDaSemana[]> {
    const linhas = await this.banco
      .select({ id: vinculo.id, turmaId: vinculo.turmaId, turma: turma.nome, disciplinaId: disciplina.id, disciplina: disciplina.nome })
      .from(vinculo)
      .innerJoin(turma, and(eq(turma.escolaId, vinculo.escolaId), eq(turma.anoLetivoId, vinculo.anoLetivoId), eq(turma.id, vinculo.turmaId)))
      .innerJoin(disciplina, and(eq(disciplina.escolaId, vinculo.escolaId), eq(disciplina.id, vinculo.disciplinaId)))
      .where(
        and(
          eq(vinculo.escolaId, requireEscolaId()),
          eq(vinculo.anoLetivoId, anoLetivoId),
          eq(vinculo.usuarioId, requestSessao().usuarioId),
          eq(vinculo.papel, 'professor'),
          eq(vinculo.estado, 'confirmado'),
        ),
      )
      .orderBy(asc(turma.nome), asc(disciplina.nome), asc(vinculo.id))
    return linhas
  }

  /** As alocações desses vínculos no ano. */
  async alocacoesDosVinculos(anoLetivoId: string, vinculoIds: readonly string[]): Promise<AlocacaoDaSemana[]> {
    const linhas = await this.banco
      .select({ vinculoId: alocacao.vinculoId, diaSemana: alocacao.diaSemana, inicio: alocacao.inicio, fim: alocacao.fim, sala: alocacao.sala })
      .from(alocacao)
      .where(and(eq(alocacao.escolaId, requireEscolaId()), eq(alocacao.anoLetivoId, anoLetivoId), inArray(alocacao.vinculoId, [...vinculoIds])))
      .orderBy(asc(alocacao.diaSemana), asc(alocacao.inicio), asc(alocacao.id))
    return linhas.map((linha) => ({ ...linha, inicio: horario(linha.inicio), fim: horario(linha.fim) }))
  }

  /**
   * Os eventos do calendário que cruzam a semana: `fim ≥ segunda` e `inicio ≤ domingo`. O filtro é por cruzamento, e não pelo início do evento:
   * o recesso que começou na sexta anterior ainda esvazia esta semana.
   */
  async eventosDaSemana(anoLetivoId: string, segunda: string, domingo: string): Promise<EventoDaSemana[]> {
    return this.banco
      .select({ tipo: eventoCalendario.tipo, inicio: eventoCalendario.inicio, fim: eventoCalendario.fim, descricao: eventoCalendario.descricao })
      .from(eventoCalendario)
      .where(
        and(
          eq(eventoCalendario.escolaId, requireEscolaId()),
          eq(eventoCalendario.anoLetivoId, anoLetivoId),
          gte(eventoCalendario.fim, segunda),
          lte(eventoCalendario.inicio, domingo),
        ),
      )
      .orderBy(asc(eventoCalendario.inicio), asc(eventoCalendario.fim), asc(eventoCalendario.id))
  }

  /** Os registros de texto **desses vínculos** na semana: o da escola, do ano e do vínculo da professora. */
  async registrosDosVinculos(anoLetivoId: string, vinculoIds: readonly string[], segunda: string, domingo: string): Promise<RegistroDaSemana[]> {
    const linhas = await this.banco
      .select({ vinculoId: aula.vinculoId, data: aula.data, inicio: aula.inicio, fim: aula.fim, conteudo: aula.conteudo })
      .from(aula)
      .where(
        and(
          eq(aula.escolaId, requireEscolaId()),
          eq(aula.anoLetivoId, anoLetivoId),
          inArray(aula.vinculoId, [...vinculoIds]),
          gte(aula.data, segunda),
          lte(aula.data, domingo),
        ),
      )
      .orderBy(asc(aula.data), asc(aula.inicio), asc(aula.id))
    return linhas.map((linha) => ({ ...linha, inicio: horario(linha.inicio), fim: horario(linha.fim) }))
  }

  /** Se a escola tem alguma alocação no ano: sem ela, a Semana diz que a coordenação ainda não importou a grade. */
  async gradeImportada(anoLetivoId: string): Promise<boolean> {
    const [achada] = await this.banco
      .select({ id: alocacao.id })
      .from(alocacao)
      .where(and(eq(alocacao.escolaId, requireEscolaId()), eq(alocacao.anoLetivoId, anoLetivoId)))
      .limit(1)
    return achada !== undefined
  }

  /** Se a escola tem algum evento no ano: sem ele, a Semana avisa que o calendário falta. */
  async calendarioImportado(anoLetivoId: string): Promise<boolean> {
    const [achado] = await this.banco
      .select({ id: eventoCalendario.id })
      .from(eventoCalendario)
      .where(and(eq(eventoCalendario.escolaId, requireEscolaId()), eq(eventoCalendario.anoLetivoId, anoLetivoId)))
      .limit(1)
    return achado !== undefined
  }
}
