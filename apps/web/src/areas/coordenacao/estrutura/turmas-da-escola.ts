import type { Turma, VinculoDaCoordenacao } from '@educa/shared'
import { turmasSemProfessor } from '../painel/fila-da-coordenacao'
import { ordenarPeloNome, ordenarTurmas } from '../comum/ordem'

/**
 * O que a aba Turmas desenha, sem React (telas da coordenação, 5.0; Tech Spec seção 9, "Escola › Turmas"): as turmas do ano
 * agrupadas por série, com os professores de cada uma e a marca "Sem professor". Fica num módulo puro para a conta ter teste
 * de unidade e para a tela só desenhar.
 *
 * **Nenhuma leitura auditada e nenhum indicador de professor** (regra 70, itens 8 e 9; D45, D64): os nomes vêm dos vínculos
 * que a escola criou, e o que a linha diz é o vínculo, não o uso. A lista de nomes da turma não é lida aqui, e por isso a
 * tabela não tem contagem de nomes nem "sem lista" (regra 20, item 10).
 */

/** O que a tela diz de um professor cujo nome a lista de professores não trouxe. É o mesmo texto da lista da turma. */
export const NOME_NAO_CARREGADO = 'Nome não carregado'

/** Os vínculos como a tela os leu: os itens e se vieram inteiros (`lerPaginas` para no teto de páginas). */
export interface VinculosLidos {
  readonly itens: readonly VinculoDaCoordenacao[]
  readonly completa: boolean
}

export interface TurmaDaTabela {
  readonly turma: Turma
  /** Um nome por professor com vínculo pendente ou confirmado na turma, pelo nome. O professor com duas disciplinas conta uma vez. */
  readonly professores: readonly string[]
  /** `true` sem professor; `false` com; `undefined` quando os vínculos não foram lidos inteiros e a turma não tem professor à vista. */
  readonly semProfessor: boolean | undefined
}

export interface GrupoDeSerie {
  readonly serie: Turma['serie']
  readonly turmas: readonly TurmaDaTabela[]
}

/** O vínculo que dá professor à turma: o mesmo que o sino conta (`turmasSemProfessor`). Contestado e encerrado não dão. */
function daProfessor(vinculo: VinculoDaCoordenacao): boolean {
  return vinculo.papel === 'professor' && (vinculo.estado === 'pendente' || vinculo.estado === 'confirmado')
}

/**
 * Cada turma com os professores dela e a marca "Sem professor". A marca vem de `turmasSemProfessor`, a conta única do sino e
 * do filtro; sem os vínculos inteiros ela não se afirma: a turma que a lista parcial não mostra com professor pode ter um na
 * parte que ficou de fora.
 */
export function turmasDaTabela(turmas: readonly Turma[], vinculos: VinculosLidos | undefined, nomeDoProfessor: (usuarioId: string) => string): TurmaDaTabela[] {
  const semProfessor = vinculos?.completa === true ? new Set(turmasSemProfessor(turmas, vinculos.itens).map((turma) => turma.id)) : undefined
  const nomesPorTurma = new Map<string, Map<string, string>>()
  for (const vinculo of vinculos?.itens ?? []) {
    if (!daProfessor(vinculo)) continue
    const daTurma = nomesPorTurma.get(vinculo.turma.id) ?? new Map<string, string>()
    daTurma.set(vinculo.usuarioId, nomeDoProfessor(vinculo.usuarioId))
    nomesPorTurma.set(vinculo.turma.id, daTurma)
  }
  return turmas.map((turma) => {
    const nomes = ordenarPeloNome(
      [...(nomesPorTurma.get(turma.id)?.values() ?? [])].map((nome) => ({
        nome,
      })),
    ).map((item) => item.nome)
    return {
      turma,
      professores: nomes,
      semProfessor: semProfessor === undefined ? (nomes.length > 0 ? false : undefined) : semProfessor.has(turma.id),
    }
  })
}

/** As turmas por série, na ordem da escola (anos finais e depois Ensino Médio, cada série pelo ano) e, dentro dela, pelo nome. */
export function agruparPorSerie(turmas: readonly TurmaDaTabela[]): GrupoDeSerie[] {
  const grupos: { serie: Turma['serie']; turmas: TurmaDaTabela[] }[] = []
  for (const item of ordenarTurmas(
    turmas.map((turma) => ({
      nome: turma.turma.nome,
      serie: turma.turma.serie,
      turma,
    })),
  ).map((ordenada) => ordenada.turma)) {
    const ultimo = grupos.at(-1)
    if (ultimo?.serie.id === item.turma.serie.id) ultimo.turmas.push(item)
    else grupos.push({ serie: item.turma.serie, turmas: [item] })
  }
  return grupos
}

/** O que abre por cima da tela, no endereço: `?painel=ano`, `?painel=falta` ou `?painel=importar`. Valor desconhecido é ignorado. */
export const PAINEIS_DA_ESTRUTURA = ['ano', 'falta', 'importar'] as const
export type PainelDaEstrutura = (typeof PAINEIS_DA_ESTRUTURA)[number]

export function painelDoEndereco(busca: string): PainelDaEstrutura | undefined {
  const valor = new URLSearchParams(busca).get('painel')
  return PAINEIS_DA_ESTRUTURA.find((painel) => painel === valor)
}

/** O filtro "Situação", no endereço: `?situacao=sem-professor`. Sem ele, ou com valor desconhecido, são todas. */
export type SituacaoDasTurmas = 'todas' | 'sem-professor'

export function situacaoDoEndereco(busca: string): SituacaoDasTurmas {
  return new URLSearchParams(busca).get('situacao') === 'sem-professor' ? 'sem-professor' : 'todas'
}
