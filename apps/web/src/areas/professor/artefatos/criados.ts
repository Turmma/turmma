import { ESTADOS_DE_ENTREGA, NOME_DA_FERRAMENTA, TIPOS_DE_ARTEFATO, type ArtefatoResumido, type EstadoDeEntrega, type TipoDeArtefato } from '@educa/shared'
import type { StatusFamily } from '../../../components/ui/StatusBadge'

/**
 * O que a tela de Criados decide sem tocar a rede (telas do professor, 5.0; `docs/interface.md` 11.2): os filtros que moram
 * no endereço, o que cada um deixa passar, o agrupamento por turma e o texto de cada estado. Só id e valor de lista fechada
 * vão ao endereço, nunca nome (regra 20, item 9).
 */

/** Os nomes dos parâmetros do endereço. O voltar do navegador devolve a lista como ela estava porque os filtros moram aqui. */
export const PARAMETRO_DO_TIPO = 'tipo'
export const PARAMETRO_DA_TURMA = 'turma'
export const PARAMETRO_DO_ESTADO = 'estado'

export type TipoFiltrado = TipoDeArtefato | 'todos'
export type EstadoFiltrado = EstadoDeEntrega | 'todos'

export interface FiltrosDeCriados {
  readonly tipo: TipoFiltrado
  /** O id da turma, que vai ao servidor. `undefined`: todas as turmas em que ela tem vínculo confirmado. */
  readonly turma: string | undefined
  readonly estado: EstadoFiltrado
}

export const SEM_FILTROS: FiltrosDeCriados = { tipo: 'todos', turma: undefined, estado: 'todos' }

/**
 * O que a versão adaptada diz da decisão sobre ela. O original não passa por aprovação (só a versão adaptada e "Aplicar à
 * turma" são atos), e por isso não tem selo. O detalhe — quem decidiu e quando — está no artefato aberto.
 */
export const SELO_DA_ENTREGA: Readonly<Record<EstadoDeEntrega, string>> = { pendente: 'Esperando você', aprovada: 'Aprovada', rejeitada: 'Rejeitada' }
export const FAMILIA_DA_ENTREGA: Readonly<Record<EstadoDeEntrega, StatusFamily>> = { pendente: 'pendente', aprovada: 'ok', rejeitada: 'erro' }

export interface OpcaoDeFiltro<Valor extends string> {
  readonly id: Valor
  readonly rotulo: string
}

export const OPCOES_DE_TIPO: readonly OpcaoDeFiltro<TipoFiltrado>[] = [
  { id: 'todos', rotulo: 'Todos os tipos' },
  ...TIPOS_DE_ARTEFATO.map((tipo) => ({ id: tipo, rotulo: NOME_DA_FERRAMENTA[tipo] })),
]

export const OPCOES_DE_ESTADO: readonly OpcaoDeFiltro<EstadoFiltrado>[] = [{ id: 'todos', rotulo: 'Todos os estados' }, ...ESTADOS_DE_ENTREGA.map((estado) => ({ id: estado, rotulo: SELO_DA_ENTREGA[estado] }))]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function ehTipo(valor: string | null): valor is TipoDeArtefato {
  return valor !== null && (TIPOS_DE_ARTEFATO as readonly string[]).includes(valor)
}

function ehEstado(valor: string | null): valor is EstadoDeEntrega {
  return valor !== null && (ESTADOS_DE_ENTREGA as readonly string[]).includes(valor)
}

/**
 * Os filtros que o endereço diz. Valor que a tela não conhece (um tipo ou um estado fora da lista, uma turma que não é um id)
 * cai em "todos", e a tela abre em vez de quebrar. **A turma não é conferida contra as da professora**: ela vai ao servidor,
 * que responde a de outra escola como a que não existe (regra 10, itens 4 e 6), e a tela mostra o mesmo para as duas.
 */
export function lerFiltros(busca: string): FiltrosDeCriados {
  const parametros = new URLSearchParams(busca)
  const tipo = parametros.get(PARAMETRO_DO_TIPO)
  const estado = parametros.get(PARAMETRO_DO_ESTADO)
  const turma = parametros.get(PARAMETRO_DA_TURMA)
  return {
    tipo: ehTipo(tipo) ? tipo : 'todos',
    turma: turma !== null && UUID.test(turma) ? turma.toLowerCase() : undefined,
    estado: ehEstado(estado) ? estado : 'todos',
  }
}

/**
 * O endereço com os filtros trocados, sem mexer nos outros parâmetros (o sino abre o painel de um item por `?item=`). "Todos"
 * tira o parâmetro: o endereço sem filtro é o endereço limpo.
 */
export function enderecoComFiltros(caminho: string, busca: string, mudanca: Partial<FiltrosDeCriados>): string {
  const parametros = new URLSearchParams(busca)
  const definir = (nome: string, valor: string | undefined): void => {
    if (valor === undefined || valor === 'todos') parametros.delete(nome)
    else parametros.set(nome, valor)
  }
  if ('tipo' in mudanca) definir(PARAMETRO_DO_TIPO, mudanca.tipo)
  if ('turma' in mudanca) definir(PARAMETRO_DA_TURMA, mudanca.turma)
  if ('estado' in mudanca) definir(PARAMETRO_DO_ESTADO, mudanca.estado)
  const resto = parametros.toString()
  return resto === '' ? caminho : `${caminho}?${resto}`
}

/** Quantos dos três filtros estão ligados: é o número do botão "Filtrar (2)" do celular. */
export function filtrosLigados(filtros: FiltrosDeCriados): number {
  return Number(filtros.tipo !== 'todos') + Number(filtros.turma !== undefined) + Number(filtros.estado !== 'todos')
}

/**
 * O que tipo e estado deixam passar do que já foi lido. **A turma não filtra aqui**: ela vai ao servidor, e a lista que chega já
 * é dela. O estado é o da decisão sobre a versão adaptada: o original não tem entrega, e com um estado escolhido ele não passa.
 */
export function filtrar(artefatos: readonly ArtefatoResumido[], filtros: Pick<FiltrosDeCriados, 'tipo' | 'estado'>): ArtefatoResumido[] {
  return artefatos.filter((artefato) => (filtros.tipo === 'todos' || artefato.tipo === filtros.tipo) && (filtros.estado === 'todos' || artefato.entrega?.estado === filtros.estado))
}

export interface GrupoDeCriados {
  /** Turma e disciplina juntas: a professora que dá duas disciplinas na mesma turma tem dois grupos. */
  readonly chave: string
  /** "7ºA · Química". Sem o nome da disciplina, só a turma; sem nenhum dos dois, "Outra turma": nunca o id. */
  readonly titulo: string
  readonly itens: readonly ArtefatoResumido[]
}

export const TITULO_DA_TURMA_SEM_NOME = 'Outra turma'

/** Um grupo por turma e disciplina, na ordem em que aparecem na lista, que é a do mais novo para o mais antigo. */
export function agruparPorTurma(artefatos: readonly ArtefatoResumido[], nomeDaTurma: (turmaId: string) => string | undefined, nomeDaDisciplina: (disciplinaId: string) => string | undefined): GrupoDeCriados[] {
  const grupos = new Map<string, { titulo: string; itens: ArtefatoResumido[] }>()
  for (const artefato of artefatos) {
    const chave = `${artefato.turmaId}:${artefato.disciplinaId}`
    const existente = grupos.get(chave)
    if (existente !== undefined) {
      existente.itens.push(artefato)
      continue
    }
    const turma = nomeDaTurma(artefato.turmaId)
    const disciplina = nomeDaDisciplina(artefato.disciplinaId)
    grupos.set(chave, { titulo: turma === undefined ? TITULO_DA_TURMA_SEM_NOME : disciplina === undefined ? turma : `${turma} · ${disciplina}`, itens: [artefato] })
  }
  return [...grupos].map(([chave, grupo]) => ({ chave, ...grupo }))
}

/** O botão que fecha o diálogo de filtros no celular: quantos documentos a lista tem agora, e "ou mais" quando falta ler páginas. */
export function rotuloDeVerDocumentos(quantos: number, maisPaginas: boolean): string {
  if (quantos === 0) return 'Ver a lista'
  return `Ver ${String(quantos)}${maisPaginas ? ' ou mais' : ''} ${quantos === 1 && !maisPaginas ? 'documento' : 'documentos'}`
}
