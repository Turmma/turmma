import type { AlocacaoDaSemana, AnoDaSemana, EventoDaSemana, ItemDaSemana, RegistroDaSemana, VinculoDaSemana } from '@educa/core'
import type { AulaDaSemana, DiaDaSemana, ItemDoDia, TipoDeItemDoDia } from '@educa/shared'

/** `AAAA-MM-DD` mais `n` dias. Aritmética de calendário, sem fuso: `2026-12-30` + 3 = `2027-01-02`. */
export function somarDias(dia: string, n: number): string {
  const data = new Date(`${dia}T00:00:00Z`)
  data.setUTCDate(data.getUTCDate() + n)
  return data.toISOString().slice(0, 10)
}

/** O dia da semana de `AAAA-MM-DD`, de 1 (segunda) a 7 (domingo), como a `alocacao`. */
export function diaDaSemanaDe(dia: string): number {
  const dom0 = new Date(`${dia}T00:00:00Z`).getUTCDay()
  return dom0 === 0 ? 7 : dom0
}

/** O que a montagem recebe: tudo já lido, escolhido pela escola, pelo ano e pela professora da sessão. */
export interface EntradaDaMontagem {
  readonly segunda: string
  readonly ano: Pick<AnoDaSemana, 'inicio' | 'fim'>
  /** O dia de hoje no fuso da escola: o registro de data anterior a ele, sem alocação, é "fora da grade"; de hoje em diante, é ignorado. */
  readonly hoje: string
  readonly vinculos: readonly VinculoDaSemana[]
  readonly alocacoes: readonly AlocacaoDaSemana[]
  readonly eventos: readonly EventoDaSemana[]
  readonly registros: readonly RegistroDaSemana[]
  /** Os itens da semana inteira, cada um com o seu dia: a montagem põe cada um no dia dele. */
  readonly itens: readonly ItemDaSemana[]
}

/** Uma aula do dia antes de ganhar o formato do contrato: o vínculo que a dá e o que a distingue das outras. */
interface Candidata {
  readonly vinculo: VinculoDaSemana
  readonly inicio: string
  readonly fim: string
  readonly sala: string | null
  readonly texto: string | null
  readonly foraDaGrade: boolean
}

const chaveDaAula = (vinculoId: string, inicio: string): string => `${vinculoId}|${inicio}`

const naOrdemDoDia = (a: Candidata, b: Candidata): number =>
  a.inicio.localeCompare(b.inicio) || a.vinculo.turma.localeCompare(b.vinculo.turma) || a.vinculo.disciplina.localeCompare(b.vinculo.disciplina)

/** A ordem dos itens no dia: o que foi aplicado, o que foi encerrado e a correção; dentro do tipo, pelo título e, no empate, pela atividade. */
const ORDEM_DOS_ITENS: Record<TipoDeItemDoDia, number> = { aplicada: 0, encerrada: 1, correcao: 2 }

const naOrdemDosItens = (a: ItemDaSemana, b: ItemDaSemana): number =>
  ORDEM_DOS_ITENS[a.tipo] - ORDEM_DOS_ITENS[b.tipo] || a.titulo.localeCompare(b.titulo) || a.atividadeAplicadaId.localeCompare(b.atividadeAplicadaId)

/** O item no formato do contrato, com as chaves exatas dele: sem o `data`, que só serve para achar o dia, e com o `estado` só na correção. */
const comoItem = ({ tipo, turmaId, disciplinaId, atividadeAplicadaId, titulo, estado }: ItemDaSemana): ItemDoDia =>
  tipo === 'correcao' && estado !== undefined ? { tipo, turmaId, disciplinaId, atividadeAplicadaId, titulo, estado } : { tipo, turmaId, disciplinaId, atividadeAplicadaId, titulo }

const comoAula = ({ vinculo, ...resto }: Candidata): AulaDaSemana => ({
  vinculoId: vinculo.id,
  turmaId: vinculo.turmaId,
  turma: vinculo.turma,
  disciplinaId: vinculo.disciplinaId,
  disciplina: vinculo.disciplina,
  ...resto,
})

/**
 * Os dias da semana (Tech Spec da semana-do-professor, seção 5, "Ler"). Função pura. De segunda a sexta, os dias que caem no ano; sábado e
 * domingo, só quando a grade tem aula neles (ou há registro passado fora da grade). Dia de `feriado` ou `recesso` não traz aula (nem a fora
 * da grade); `evento` aparece e não tira a aula. Cada alocação do dia da semana é uma aula, com o texto do registro de mesmo (vínculo, data,
 * início); o registro **passado** sem alocação entra como `foraDaGrade`, e o de hoje ou futuro sem alocação é ignorado. Só entra o que é de
 * um dos vínculos recebidos. Os itens do dia (RF7) entram no dia do seu `data`, **também no feriado e no recesso**: a atividade aplicada no dia da prova fica, mesmo
 * sem aula. Item de dia que a semana não traz (fim de semana sem grade, fora do ano) não aparece: o contrato só tem os dias que a Tech Spec lista.
 */
export function montarDias(entrada: EntradaDaMontagem): DiaDaSemana[] {
  const vinculos = new Map(entrada.vinculos.map((vinculo) => [vinculo.id, vinculo]))
  const dias: DiaDaSemana[] = []
  for (let deslocamento = 0; deslocamento < 7; deslocamento += 1) {
    const data = somarDias(entrada.segunda, deslocamento)
    if (data < entrada.ano.inicio || data > entrada.ano.fim) continue
    const diaDaSemana = diaDaSemanaDe(data)
    const eventos = entrada.eventos.filter((evento) => evento.inicio <= data && data <= evento.fim)

    const daGrade = entrada.alocacoes.flatMap((alocacao) => {
      const vinculo = vinculos.get(alocacao.vinculoId)
      return vinculo !== undefined && alocacao.diaSemana === diaDaSemana ? [{ vinculo, alocacao }] : []
    })
    const registros = entrada.registros.flatMap((registro) => {
      const vinculo = vinculos.get(registro.vinculoId)
      return vinculo !== undefined && registro.data === data ? [{ vinculo, registro }] : []
    })
    const textos = new Map(registros.map(({ registro }) => [chaveDaAula(registro.vinculoId, registro.inicio), registro.conteudo]))
    const foraDaGrade = registros.filter(
      ({ registro }) => registro.data < entrada.hoje && !daGrade.some(({ alocacao }) => alocacao.vinculoId === registro.vinculoId && alocacao.inicio === registro.inicio),
    )
    // Sábado e domingo só aparecem quando a grade (ou um registro passado) tem aula neles, antes de o feriado tirá-la.
    if (diaDaSemana > 5 && daGrade.length === 0 && foraDaGrade.length === 0) continue

    const semAula = eventos.some((evento) => evento.tipo === 'feriado' || evento.tipo === 'recesso')
    const candidatas: Candidata[] = [
      ...daGrade.map(({ vinculo, alocacao }) => ({
        vinculo,
        inicio: alocacao.inicio,
        fim: alocacao.fim,
        sala: alocacao.sala,
        texto: textos.get(chaveDaAula(alocacao.vinculoId, alocacao.inicio)) ?? null,
        foraDaGrade: false,
      })),
      ...foraDaGrade.map(({ vinculo, registro }) => ({ vinculo, inicio: registro.inicio, fim: registro.fim, sala: null, texto: registro.conteudo, foraDaGrade: true })),
    ]
    dias.push({ data, eventos: eventos.map(({ tipo, descricao }) => ({ tipo, descricao })), aulas: semAula ? [] : candidatas.sort(naOrdemDoDia).map(comoAula), itens: entrada.itens.filter((item) => item.data === data).sort(naOrdemDosItens).map(comoItem) })
  }
  return dias
}
