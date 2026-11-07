import type { ItemDoDia } from '@educa/shared'
import { and, asc, eq, exists, gte, inArray, lte, sql, type AnyColumn, type SQL } from 'drizzle-orm'
import { currentContext } from '../context/context.js'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { alocacao } from '../db/schema/alocacao.js'
import { anoLetivo } from '../db/schema/ano-letivo.js'
import { artefato } from '../db/schema/artefato.js'
import { atividadeAplicada } from '../db/schema/atividade-aplicada.js'
import { aula } from '../db/schema/aula.js'
import { disciplina } from '../db/schema/disciplina.js'
import { entrega } from '../db/schema/entrega.js'
import { eventoCalendario } from '../db/schema/evento-calendario.js'
import { turma } from '../db/schema/turma.js'
import { vinculo } from '../db/schema/vinculo.js'
import { requestSessao } from '../identidade/auth.guard.js'
import { FUSO_DO_USO } from '../usage/usage-day.js'

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

/** Um fato do dia na turma e disciplina da professora, com o dia (`AAAA-MM-DD`, no fuso da escola) em que aconteceu. Sem nota, acerto, nome de aluno nem autor. */
export type ItemDaSemana = ItemDoDia & { readonly data: string }

/** O dia, no fuso da escola, de um instante (nulo só para o instante nulo, que o filtro da semana já deixa de fora): a atividade aplicada às 22h de domingo em Brasília é de domingo, e não da segunda em UTC. */
const diaNoFuso = (instante: AnyColumn): SQL<string> => sql<string>`to_char(${instante} at time zone ${sql.raw(`'${FUSO_DO_USO}'`)}, 'YYYY-MM-DD')`

/** O dia do instante cai entre a segunda e o domingo da semana (inclusive). Instante nulo (atividade ainda aberta) não cai. */
const naSemana = (instante: AnyColumn, segunda: string, domingo: string): SQL | undefined => and(gte(diaNoFuso(instante), segunda), lte(diaNoFuso(instante), domingo))

/**
 * A leitura da Semana do professor (F2b, tarefa 2.0; Tech Spec da semana-do-professor, seção 5, "Ler"). Escola e ano vêm do contexto, e a
 * professora é a da sessão (regra 10, item 3; alcance `proprio` da matriz): nenhum método recebe escola nem usuário. Os métodos que leem
 * alocação e registro recebem os ids dos vínculos que `vinculosDaProfessora` devolveu, e ainda assim repetem a escola e o ano na consulta.
 * A escrita do registro é do `AulaRepository` (4.0). Os itens do dia (3.0) são lidos de `atividade_aplicada` e `entrega`, pela turma da aplicação e pela
 * disciplina do artefato, só onde a professora da sessão tem vínculo `confirmado` nas duas. Nunca lê e-mail nem nome de professor ou de aluno, e o texto nunca vai a log.
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

  /**
   * O vínculo `confirmado` de professor da sessão na turma **e na disciplina** da linha, na escola e no ano da própria linha: a professora de
   * Matemática do 2ºB não vê a atividade de Química da colega da mesma turma (regra 10, itens 3 e 4). `exists`, e não `join`: quem dá duas
   * disciplinas na turma tem dois vínculos. A escola e o ano da linha já foram conferidos com os do contexto no `where` de quem chama; é essa
   * comparação (e não uma segunda, com o contexto, aqui dentro) que o teste de isolamento prova.
   */
  #daProfessora(linha: { readonly escolaId: AnyColumn; readonly anoLetivoId: AnyColumn; readonly turmaId: AnyColumn }, disciplinaId: AnyColumn): SQL {
    return exists(
      this.banco
        .select({ um: vinculo.id })
        .from(vinculo)
        .where(
          and(
            eq(vinculo.escolaId, linha.escolaId),
            eq(vinculo.anoLetivoId, linha.anoLetivoId),
            eq(vinculo.turmaId, linha.turmaId),
            eq(vinculo.disciplinaId, disciplinaId),
            eq(vinculo.usuarioId, requestSessao().usuarioId),
            eq(vinculo.papel, 'professor'),
            eq(vinculo.estado, 'confirmado'),
          ),
        ),
    )
  }

  /**
   * As três consultas dos itens do dia, ainda sem rodar (a `itensDaSemana` as roda). Público só para o `EXPLAIN` de `semana-itens.int.test.ts`, que lê o SQL montado: nenhum outro código chama. Todas partem da escola e do ano do contexto
   * e chegam à turma pelo vínculo da professora (`#daProfessora`), sem lista de turmas: a atividade aplicada, pelo único `(escola, ano, turma, id)`, que o
   * planejador prefere ao `atividade_aplicada_turma_idx` (os dois começam pela escola e pela turma), e a entrega, pelo `entrega_turma_idx` (regra 80,
   * item 8). A turma é a da **aplicação**, e a disciplina, a do **artefato** (como em `AtividadeAplicadaRepository`): a mesma atividade aplicada a
   * outra turma dela é da outra turma.
   */
  consultasDosItens(anoLetivoId: string, segunda: string, domingo: string) {
    const escolaId = requireEscolaId()
    const daAplicacao = (instante: AnyColumn) =>
      this.banco
        .select({ id: atividadeAplicada.id, turmaId: atividadeAplicada.turmaId, disciplinaId: artefato.disciplinaId, titulo: artefato.titulo, dia: diaNoFuso(instante) })
        .from(atividadeAplicada)
        .innerJoin(artefato, and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId)))
        .where(
          and(
            eq(atividadeAplicada.escolaId, escolaId),
            eq(atividadeAplicada.anoLetivoId, anoLetivoId),
            naSemana(instante, segunda, domingo),
            this.#daProfessora(atividadeAplicada, artefato.disciplinaId),
          ),
        )
        .orderBy(asc(atividadeAplicada.id))
    const lotes = this.banco
      .select({ atividadeAplicadaId: atividadeAplicada.id, turmaId: atividadeAplicada.turmaId, disciplinaId: artefato.disciplinaId, titulo: artefato.titulo, estado: entrega.estado, dia: diaNoFuso(entrega.criadaEm) })
      .from(entrega)
      .innerJoin(
        atividadeAplicada,
        and(eq(atividadeAplicada.escolaId, entrega.escolaId), eq(atividadeAplicada.anoLetivoId, entrega.anoLetivoId), eq(atividadeAplicada.turmaId, entrega.turmaId), eq(atividadeAplicada.id, entrega.atividadeAplicadaId)),
      )
      .innerJoin(artefato, and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId)))
      .where(
        and(
          eq(entrega.escolaId, escolaId),
          eq(entrega.anoLetivoId, anoLetivoId),
          eq(entrega.tipo, 'lote_de_correcao'),
          naSemana(entrega.criadaEm, segunda, domingo),
          this.#daProfessora(entrega, artefato.disciplinaId),
        ),
      )
      .orderBy(asc(entrega.id))
    return { aplicadas: daAplicacao(atividadeAplicada.aplicadaEm), encerradas: daAplicacao(atividadeAplicada.encerradaEm), lotes }
  }

  /**
   * Os itens do dia na semana, nas turmas e disciplinas dos vínculos `confirmado` da professora: a atividade **aplicada** e a **encerrada** no dia
   * (cada uma no dia do seu instante, no fuso da escola) e a correção do Assistente (`lote_de_correcao`) criada no dia, com o **estado de hoje**. Uma
   * correção aprovada depois da semana volta `aprovada`. Em sequência, e não em `Promise.all`: uma conexão do pool por vez. Sem nota, acerto, nome de
   * aluno nem autor: o `select` das três consultas é a lista exata do contrato.
   */
  async itensDaSemana(anoLetivoId: string, segunda: string, domingo: string): Promise<ItemDaSemana[]> {
    const consultas = this.consultasDosItens(anoLetivoId, segunda, domingo)
    const aplicadas = await consultas.aplicadas
    const encerradas = await consultas.encerradas
    const lotes = await consultas.lotes
    return [
      ...aplicadas.map((linha): ItemDaSemana => ({ tipo: 'aplicada', data: linha.dia, turmaId: linha.turmaId, disciplinaId: linha.disciplinaId, atividadeAplicadaId: linha.id, titulo: linha.titulo })),
      ...encerradas.map((linha): ItemDaSemana => ({ tipo: 'encerrada', data: linha.dia, turmaId: linha.turmaId, disciplinaId: linha.disciplinaId, atividadeAplicadaId: linha.id, titulo: linha.titulo })),
      ...lotes.map((linha): ItemDaSemana => ({ tipo: 'correcao', data: linha.dia, turmaId: linha.turmaId, disciplinaId: linha.disciplinaId, atividadeAplicadaId: linha.atividadeAplicadaId, titulo: linha.titulo, estado: linha.estado })),
    ]
  }
}
