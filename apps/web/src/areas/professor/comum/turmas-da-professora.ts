import type { Vinculo } from '@educa/shared'

/**
 * A turma e a disciplina sobre as quais a professora fala com o Assistente (`docs/interface.md` 11.2): o contexto da
 * caixa de pedido e o primeiro campo de toda ferramenta. Vem dos vínculos **confirmados** dela (`GET /v1/meus-vinculos`,
 * A1): a turma pendente, a contestada e a encerrada não aparecem, porque a API responderia como inexistente (regra 10).
 */
export interface TurmaDaProfessora {
  /** O valor do seletor: a turma e a disciplina juntas, porque é o par que o pedido leva. */
  readonly valor: string
  readonly turmaId: string
  readonly disciplinaId: string
  readonly turmaNome: string
  /** "2ºB · Química". */
  readonly rotulo: string
}

const SEPARADOR = ':'

export function valorDoContexto(turmaId: string, disciplinaId: string): string {
  return `${turmaId}${SEPARADOR}${disciplinaId}`
}

/** A turma e a disciplina de um valor do seletor, ou `undefined` para o que não é um. */
export function readContexto(valor: string): { readonly turmaId: string; readonly disciplinaId: string } | undefined {
  const [turmaId, disciplinaId, resto] = valor.split(SEPARADOR)
  if (turmaId === undefined || turmaId === '' || disciplinaId === undefined || disciplinaId === '' || resto !== undefined) return undefined
  return { turmaId, disciplinaId }
}

/**
 * As turmas com que a professora pode pedir: os vínculos confirmados que têm disciplina, uma vez cada par, em ordem de
 * nome. O vínculo sem disciplina não entra: todo pedido ao Assistente leva a disciplina, que diz de que material sair.
 */
export function turmasDaProfessora(vinculos: readonly Vinculo[]): TurmaDaProfessora[] {
  const porValor = new Map<string, TurmaDaProfessora>()
  for (const vinculo of vinculos) {
    if (vinculo.estado !== 'confirmado' || vinculo.disciplina === undefined) continue
    const valor = valorDoContexto(vinculo.turma.id, vinculo.disciplina.id)
    if (porValor.has(valor)) continue
    porValor.set(valor, { valor, turmaId: vinculo.turma.id, disciplinaId: vinculo.disciplina.id, turmaNome: vinculo.turma.nome, rotulo: `${vinculo.turma.nome} · ${vinculo.disciplina.nome}` })
  }
  return [...porValor.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR', { numeric: true }))
}

/** A turma escolhida: a que a professora escolheu, se ainda é dela, ou a primeira da lista. Sem turma, nenhuma. */
export function turmaEscolhida(turmas: readonly TurmaDaProfessora[], escolhida: string | undefined): TurmaDaProfessora | undefined {
  return turmas.find((turma) => turma.valor === escolhida) ?? turmas[0]
}

/** O nome de cada turma, pelo id, para as telas que recebem só o `turmaId` (a entrega, o artefato). */
export function nomesDasTurmas(vinculos: readonly Vinculo[]): Readonly<Record<string, string>> {
  return Object.fromEntries(vinculos.map((vinculo) => [vinculo.turma.id, vinculo.turma.nome]))
}

/** O nome de cada disciplina, pelo id. */
export function nomesDasDisciplinas(vinculos: readonly Vinculo[]): Readonly<Record<string, string>> {
  return Object.fromEntries(vinculos.flatMap((vinculo) => (vinculo.disciplina === undefined ? [] : [[vinculo.disciplina.id, vinculo.disciplina.nome]])))
}
