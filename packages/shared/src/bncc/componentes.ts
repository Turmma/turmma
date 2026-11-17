import { chaveDaDisciplina } from '../importacao/normalizador.js'
import type { Etapa } from '../estrutura/serie.js'

/**
 * Os componentes da BNCC que uma disciplina da escola pode ter (classificacao-bncc, 1.0; Tech Spec, seção 3, "Componentes"):
 * os do Ensino Fundamental e os do Ensino Médio, na forma em que a disciplina os guarda (`disciplina.componente_bncc`, com o check
 * do mesmo conjunto) e a tabela `habilidade_bncc` os grava. Um lugar só: o check do banco, o contrato da API e a tela leem daqui.
 */
export const COMPONENTES_BNCC = [
  'arte',
  'biologia',
  'ciencias',
  'educacao_fisica',
  'ensino_religioso',
  'filosofia',
  'fisica',
  'geografia',
  'historia',
  'lingua_inglesa',
  'lingua_portuguesa',
  'matematica',
  'quimica',
  'sociologia',
] as const
export type ComponenteBncc = (typeof COMPONENTES_BNCC)[number]

/** O nome de cada componente como a coordenação o lê na Estrutura. */
export const NOME_DO_COMPONENTE: Readonly<Record<ComponenteBncc, string>> = {
  arte: 'Arte',
  biologia: 'Biologia',
  ciencias: 'Ciências',
  educacao_fisica: 'Educação Física',
  ensino_religioso: 'Ensino Religioso',
  filosofia: 'Filosofia',
  fisica: 'Física',
  geografia: 'Geografia',
  historia: 'História',
  lingua_inglesa: 'Língua Inglesa',
  lingua_portuguesa: 'Língua Portuguesa',
  matematica: 'Matemática',
  quimica: 'Química',
  sociologia: 'Sociologia',
}

/**
 * O que a escola escreve no nome da disciplina e o componente que isso quer dizer, sem acento, sem caixa e com os espaços reduzidos
 * (`chaveDaDisciplina`). Só o nome do próprio componente e os atalhos que a escola usa de verdade: "Português" é Língua Portuguesa, "Inglês"
 * é Língua Inglesa, "Artes" é Arte. O que não está aqui ("Projeto de Vida", "Robótica") fica sem componente, e a coordenação o define na
 * Estrutura. A migration `0059_habilidade_bncc` repete esta tabela em SQL para as disciplinas que já existem, e um teste confere as duas.
 */
export const COMPONENTE_PELA_CHAVE_DO_NOME: Readonly<Record<string, ComponenteBncc>> = {
  arte: 'arte',
  artes: 'arte',
  biologia: 'biologia',
  ciencias: 'ciencias',
  'educacao fisica': 'educacao_fisica',
  'ensino religioso': 'ensino_religioso',
  filosofia: 'filosofia',
  fisica: 'fisica',
  geografia: 'geografia',
  historia: 'historia',
  ingles: 'lingua_inglesa',
  'lingua inglesa': 'lingua_inglesa',
  'lingua portuguesa': 'lingua_portuguesa',
  matematica: 'matematica',
  portugues: 'lingua_portuguesa',
  quimica: 'quimica',
  sociologia: 'sociologia',
}

/**
 * O componente que o nome da disciplina diz, ou `null` quando não casa. É o que o `DisciplinaRepository.criar` grava: "química" nasce com
 * Química, "Robótica" nasce sem. Renomear a disciplina não passa por aqui, e o componente continua o que estava.
 */
export function componenteDoNomeDaDisciplina(nome: string): ComponenteBncc | null {
  return COMPONENTE_PELA_CHAVE_DO_NOME[chaveDaDisciplina(nome)] ?? null
}

/** A sigla do componente dentro do código do Ensino Fundamental (`EF69LP01`: LP), ou `null` quando o Fundamental não tem o componente. */
const SIGLA_NO_FUNDAMENTAL: Readonly<Record<ComponenteBncc, string | null>> = {
  arte: 'AR',
  // A BNCC do Fundamental não tem Biologia, Física nem Química: o conteúdo delas está em Ciências, e é nele que a série do Fundamental as procura.
  biologia: 'CI',
  ciencias: 'CI',
  educacao_fisica: 'EF',
  ensino_religioso: 'ER',
  filosofia: null,
  fisica: 'CI',
  geografia: 'GE',
  historia: 'HI',
  lingua_inglesa: 'LI',
  lingua_portuguesa: 'LP',
  matematica: 'MA',
  quimica: 'CI',
  sociologia: null,
}

/**
 * As siglas do Ensino Médio que o componente alcança. O Médio da BNCC é por área (`EM13LGG`, `EM13MAT`, `EM13CNT`, `EM13CHS`), e só a
 * Língua Portuguesa tem habilidades próprias (`EM13LP`), que valem junto com as de Linguagens.
 */
const SIGLAS_NO_MEDIO: Readonly<Record<ComponenteBncc, readonly string[]>> = {
  arte: ['LGG'],
  biologia: ['CNT'],
  ciencias: ['CNT'],
  educacao_fisica: ['LGG'],
  ensino_religioso: [],
  filosofia: ['CHS'],
  fisica: ['CNT'],
  geografia: ['CHS'],
  historia: ['CHS'],
  lingua_inglesa: ['LGG'],
  lingua_portuguesa: ['LP', 'LGG'],
  matematica: ['MAT'],
  quimica: ['CNT'],
  sociologia: ['CHS'],
}

/** Os anos que o código do Fundamental alcança: `06` a `09` são um ano, e `67`, `69` e `89` são os blocos (6º e 7º; 6º ao 9º; 8º e 9º). */
const ANOS_DO_PREFIXO: Readonly<Record<string, readonly number[]>> = {
  '06': [6],
  '07': [7],
  '08': [8],
  '09': [9],
  '67': [6, 7],
  '69': [6, 7, 8, 9],
  '89': [8, 9],
}

const CODIGO_DO_FUNDAMENTAL = /^EF(06|07|08|09|67|69|89)([A-Z]{2})\d{2}$/
const CODIGO_DO_MEDIO = /^EM13(?:(LGG|MAT|CNT|CHS)\d{3}|(LP)\d{2})$/

/**
 * O formato de todo código de habilidade da tabela `habilidade_bncc` (o check dela repete este conjunto): o do Fundamental (`EF07MA33`) ou o do Médio (`EM13CNT301`, `EM13LP05`). Sem sufixo estadual
 * (`EF07LP01A`), sem minúscula e sem espaço. É o que a saída da classificação confere antes de olhar a lista de candidatas.
 */
export const CODIGO_DE_HABILIDADE_BNCC = new RegExp(`${CODIGO_DO_FUNDAMENTAL.source}|${CODIGO_DO_MEDIO.source}`)

/** O que o código da habilidade diz sobre ela: a etapa, os anos (só no Fundamental) e a sigla do componente ou da área. `null` para código fora do recorte. */
export function partesDoCodigoBncc(codigo: string): { readonly etapa: Etapa; readonly anos: readonly number[] | null; readonly sigla: string } | null {
  const fundamental = CODIGO_DO_FUNDAMENTAL.exec(codigo)
  if (fundamental !== null) return { etapa: 'ef_anos_finais', anos: ANOS_DO_PREFIXO[fundamental[1] ?? ''] ?? [], sigla: fundamental[2] ?? '' }
  const medio = CODIGO_DO_MEDIO.exec(codigo)
  if (medio !== null) return { etapa: 'em', anos: null, sigla: medio[1] ?? medio[2] ?? '' }
  return null
}

/**
 * O que a coordenação ou o material dizem sobre o recorte de uma disciplina: as séries do material (6º ao 9º do Fundamental, 1º ao 3º do Médio)
 * e o componente da disciplina.
 */
export interface SerieDoRecorte {
  readonly etapa: Etapa
  readonly ano: number
}

/**
 * Se a habilidade é candidata para o componente nas séries dadas (Tech Spec, seção 3, "Componentes"). No Fundamental, a sigla do componente e
 * ao menos um dos anos da série (o `EF69LP01` vale do 6º ao 9º, o `EF67EF` só no 6º e no 7º). No Médio, a sigla da área do componente, sem
 * olhar o ano: a BNCC do Médio não é seriada. Material de séries das duas etapas (o 9º do Fundamental e o 1º do Médio) traz a união.
 * Sem série, sem candidata.
 */
export function habilidadeEhCandidata(codigo: string, componente: ComponenteBncc, series: readonly SerieDoRecorte[]): boolean {
  const partes = partesDoCodigoBncc(codigo)
  if (partes === null) return false
  if (partes.etapa === 'em') return series.some((serie) => serie.etapa === 'em') && SIGLAS_NO_MEDIO[componente].includes(partes.sigla)
  const sigla = SIGLA_NO_FUNDAMENTAL[componente]
  if (sigla !== partes.sigla) return false
  const anos = partes.anos ?? []
  return series.some((serie) => serie.etapa === 'ef_anos_finais' && anos.includes(serie.ano))
}
