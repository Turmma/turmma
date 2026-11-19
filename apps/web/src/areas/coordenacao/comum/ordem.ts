import { ETAPAS, type Etapa } from '@educa/shared'

/**
 * A ordem em que a Estrutura mostra as listas (A1, 13.0). A API pagina pelo id, que segue a ordem em que cada item foi
 * criado: sem isto, a 7ºB criada antes da 6ºA viria antes dela, e a turma de quem chegou em maio ficaria sempre no fim.
 * Aqui a tela põe na ordem em que a escola fala: a série pela etapa e pelo ano, a turma pela série e depois pelo nome, e
 * o resto pelo nome.
 *
 * O nome é comparado em português, e não pelo código do caractere, e com o número como número: "Ética" entre "Educação
 * Física" e "Física", "artes" antes de "Biologia", e "7ºA" antes de "10ºA".
 */
const PELO_NOME = new Intl.Collator('pt-BR', { numeric: true })

interface DaSerie {
  readonly etapa: Etapa
  readonly ano: number
}

function compararSeries(a: DaSerie, b: DaSerie): number {
  return ETAPAS.indexOf(a.etapa) - ETAPAS.indexOf(b.etapa) || a.ano - b.ano
}

/** As séries na ordem da escola: anos finais, depois Ensino Médio, cada uma pelo ano. */
export function sortSeries<Item extends DaSerie>(series: readonly Item[]): Item[] {
  return [...series].sort(compararSeries)
}

/** Disciplinas e professores, pelo nome. */
export function sortPeloNome<Item extends { readonly nome: string }>(itens: readonly Item[]): Item[] {
  return [...itens].sort((a, b) => PELO_NOME.compare(a.nome, b.nome))
}

/** As turmas pela série e, dentro dela, pelo nome. */
export function sortTurmas<Item extends { readonly nome: string; readonly serie: DaSerie }>(turmas: readonly Item[]): Item[] {
  return [...turmas].sort((a, b) => compararSeries(a.serie, b.serie) || PELO_NOME.compare(a.nome, b.nome))
}

/** Os vínculos pela turma, depois pela disciplina e pelo professor: quem dá aula em cada turma fica junto. */
export function sortVinculos<Item extends { readonly turma: { readonly nome: string }; readonly disciplina?: { readonly nome: string } | undefined }>(
  vinculos: readonly Item[],
  nomeDoProfessor: (vinculo: Item) => string,
): Item[] {
  return [...vinculos].sort(
    (a, b) => PELO_NOME.compare(a.turma.nome, b.turma.nome) || PELO_NOME.compare(a.disciplina?.nome ?? '', b.disciplina?.nome ?? '') || PELO_NOME.compare(nomeDoProfessor(a), nomeDoProfessor(b)),
  )
}
