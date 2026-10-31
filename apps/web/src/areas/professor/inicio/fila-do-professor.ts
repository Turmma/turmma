import { ErrorCode, FUNCOES, NOME_DO_TIPO_DE_ENTREGA, type ChaveDeFuncao, type Entrega, type ListaDeEntregasResponse, type MeusVinculosResponse, type Vinculo } from '@educa/shared'
import { useInfiniteQuery, useQueries, useQuery, useQueryClient, type InfiniteData, type UseInfiniteQueryResult, type UseQueryResult } from '@tanstack/react-query'
import { useState } from 'react'
import { ErroDaApi } from '../../../api/client'
import { consultaEntregasPendentes } from '../artefatos/api/entregas'
import { consultaContagemDePedidos, type ContagemDePedidos } from '../../../api/pedidos'
import { consultaMeusVinculos } from '../comum/api/vinculos'
import { caminhoDaCorrecaoDoProfessor, caminhoDaTurmaDoProfessor, ROTAS_DO_PROFESSOR } from '../../../paths'
import { LEITURA_DA_FILA, type LeituraDaFila } from '../../../components/sino/leitura-do-sino'
import type { ItemDoSino, SituacaoDoSino } from '../../../components/sino/Sino'
import { nomesDasTurmas } from '../comum/turmas-da-professora'

/**
 * A fila "Esperando você" da professora (telas do professor, 1.0; Tech Spec, seção 5, "A fila do professor"; RF3 a RF5): uma
 * função pura, `filaDoProfessor`, sobre leituras que a web já faz, e o gancho que as lê. Nenhuma rota e nenhuma tabela são
 * novas.
 *
 * **Os tipos são quatro e só esses**, e todos são decisão que é dela: a correção para revisar, a versão adaptada para
 * decidir, os pedidos de nome (um item por turma, com a quantidade) e a turma para confirmar. O vínculo contestado espera a
 * coordenação e não conta. **Nenhum item leva nome de aluno** (regra 20; D34): os pedidos entram só como número (`api/pedidos.ts`,
 * `consultaContagemDePedidos`), e os itens falam do trabalho e da turma. O sino de hoje não tem sinal do Tutor (F10).
 */
export const TIPOS_DA_FILA_DO_PROFESSOR = ['correcao', 'versao-adaptada', 'pedidos-de-nome', 'confirme-sua-turma'] as const
export type TipoDeItemDoProfessor = (typeof TIPOS_DA_FILA_DO_PROFESSOR)[number]

export interface ItemDaFilaDoProfessor extends ItemDoSino {
  readonly tipo: TipoDeItemDoProfessor
  /** A turma, que é o grupo do item no sino. */
  readonly grupo: string
  /** O id da turma do item: é por ele que o cartão de Turmas soma o que espera naquela turma, sem refazer a conta (9.0). */
  readonly turmaId: string
  /** Só nos pedidos de nome: a página veio cheia e há outra, e o número é "ou mais". */
  readonly haMais?: boolean
}

/** A turma que o item não sabe nomear (a entrega de uma turma que a lista de vínculos lida não traz) vai para este grupo, por último. */
export const GRUPO_DA_TURMA_SEM_NOME = 'Outras turmas'

/** Quantas turmas o sino lê por vez (Tech Spec, seção 7c): as 12 primeiras por nome, para a manhã de segunda não virar centenas de leituras. */
export const TETO_DE_TURMAS_LIDAS = 12

/** O que a leitura dos pedidos de uma turma diz: lendo (ou esperando a vez, em série), falhou, lida, ou não lida por ter parado antes. */
export type LeituraDaContagem =
  | { readonly estado: 'carregando' }
  | { readonly estado: 'erro'; readonly erro: unknown }
  | { readonly estado: 'lida'; readonly dado: ContagemDePedidos }
  | { readonly estado: 'nao-lida' }

export interface EntradaDaFilaDoProfessor {
  readonly entregas: LeituraDaFila<readonly Entrega[]>
  readonly vinculos: LeituraDaFila<readonly Vinculo[]>
  /** A leitura dos pedidos de cada turma, pelo id dela. A turma que falta no mapa não foi lida. */
  readonly contagens: ReadonlyMap<string, LeituraDaContagem>
}

export interface FilaDoProfessor {
  readonly itens: readonly ItemDaFilaDoProfessor[]
  readonly situacao: SituacaoDoSino
  /** A primeira falha, para a mensagem; só com a fila em `erro`. */
  readonly erro?: unknown
  /** O que o sino não leu, em palavras ("os pedidos de nome de 2 turmas"): é o que o aviso da lista parcial diz. */
  readonly naoLeu: readonly string[]
  /** A página de entregas veio cheia e há outra: o número do sino é um piso, e ele diz "100 ou mais" (PRD, seção 7). Falso quando as entregas não foram lidas. */
  readonly haMais: boolean
  /** A escola não tem ano letivo em curso: a professora não lê os anos (só a coordenação), e a API responde como inexistente. */
  readonly semAnoLetivo: boolean
  /** O quanto o sino já leu de cada turma confirmada, pelo id (9.0): é o que impede o cartão de dizer "Em dia" sem ter lido. */
  readonly leituraPorTurma: ReadonlyMap<string, LeituraDaTurma>
}

/** `lida`: entregas e pedidos da turma foram lidos inteiros. `lendo`: ainda falta resposta. `nao-lida`: falhou, foi recusada, veio truncada ou passou das 12. */
export type LeituraDaTurma = 'lida' | 'lendo' | 'nao-lida'

function lida<Dado>(leitura: LeituraDaFila<Dado>): Dado | undefined {
  return leitura.estado === 'lida' ? leitura.dado : undefined
}

/** Sem ano letivo em curso, `meus-vinculos` e `entregas` respondem `NAO_ENCONTRADO` (`requireAnoEmCurso`), e a professora não tem como ler o ano. */
function semAnoLetivoPelaResposta(leitura: LeituraDaFila<unknown>): boolean {
  return leitura.estado === 'erro' && leitura.erro instanceof ErroDaApi && leitura.erro.codigo === ErrorCode.NAO_ENCONTRADO
}

const porNome = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true })

/**
 * As turmas em que a professora tem vínculo confirmado, uma vez cada (duas disciplinas na mesma turma são uma leitura de
 * pedidos só), em ordem de nome. O pendente, o contestado e o encerrado não entram: a API responderia como inexistente (regra 10).
 */
export function turmasConfirmadas(vinculos: readonly Vinculo[]): readonly { readonly turmaId: string; readonly nome: string }[] {
  const porId = new Map<string, string>()
  for (const vinculo of vinculos) if (vinculo.estado === 'confirmado' && !porId.has(vinculo.turma.id)) porId.set(vinculo.turma.id, vinculo.turma.nome)
  return [...porId].map(([turmaId, nome]) => ({ turmaId, nome })).sort((a, b) => porNome(a.nome, b.nome))
}

function itensDeEntrega(entregas: readonly Entrega[], nomes: Readonly<Record<string, string>>): ItemDaFilaDoProfessor[] {
  return entregas
    .filter((entrega) => entrega.estado === 'pendente')
    .sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))
    .map((entrega) => {
      const grupo = nomes[entrega.turmaId] ?? GRUPO_DA_TURMA_SEM_NOME
      if (entrega.tipo === 'lote_de_correcao')
        return {
          id: `entrega-${entrega.id}`,
          tipo: 'correcao',
          grupo,
          turmaId: entrega.turmaId,
          titulo: 'Correção para revisar',
          detalhe: entrega.titulo,
          urgente: false,
          // O lote sem atividade aplicada (o contrato admite `null`) não tem tela de correção: a decisão fica no Assistente.
          para: entrega.atividadeAplicadaId === null ? ROTAS_DO_PROFESSOR.timeDoAssistente : caminhoDaCorrecaoDoProfessor(entrega.atividadeAplicadaId),
        }
      return { id: `entrega-${entrega.id}`, tipo: 'versao-adaptada', grupo, turmaId: entrega.turmaId, titulo: 'Versão adaptada para decidir', detalhe: entrega.titulo, urgente: false, para: ROTAS_DO_PROFESSOR.timeDoAssistente }
    })
}

/** "3 pedidos esperando a decisão", "1 pedido…" ou "100 ou mais pedidos…": a página veio cheia e há outra. */
function frasesDosPedidos({ quantidade, haMais }: ContagemDePedidos): { readonly detalhe: string; readonly oQueConta: string } {
  if (haMais) return { detalhe: `${String(quantidade)} ou mais pedidos esperando a decisão`, oQueConta: 'ou mais pedidos de nome' }
  if (quantidade === 1) return { detalhe: '1 pedido esperando a decisão', oQueConta: 'pedido de nome' }
  return { detalhe: `${String(quantidade)} pedidos esperando a decisão`, oQueConta: 'pedidos de nome' }
}

function itensDeConfirmacao(vinculos: readonly Vinculo[]): ItemDaFilaDoProfessor[] {
  // O pendente é o que espera a decisão dela. O contestado espera a coordenação corrigir, e o encerrado (o de ano que acabou) não espera ninguém.
  return vinculos
    .filter((vinculo) => vinculo.estado === 'pendente')
    .map((vinculo) => ({
      id: `vinculo-${vinculo.id}`,
      tipo: 'confirme-sua-turma',
      grupo: vinculo.turma.nome,
      turmaId: vinculo.turma.id,
      titulo: 'Confirme sua turma',
      detalhe: vinculo.disciplina?.nome ?? 'A coordenação alocou você nesta turma',
      urgente: false,
      para: ROTAS_DO_PROFESSOR.turmas,
    }))
}

/**
 * Monta a fila das leituras (Tech Spec, seção 5). Os itens saem agrupados por turma, em ordem de nome (as sem nome por
 * último), e dentro da turma na ordem dos tipos: correção, versão adaptada, pedidos de nome, turma a confirmar.
 *
 * **Nunca "Tudo em dia" sem ter lido tudo.** Leitura que falhou, lista que veio truncada, turma além do teto de 12 e turma que
 * ficou sem ler depois de uma recusa por limite deixam a fila `parcial`, com o que faltou em `naoLeu`. `carregando` é enquanto
 * alguma leitura não respondeu; `erro` é quando nem as entregas nem os vínculos foram lidos. Sem ano letivo em curso nada se lê:
 * a fila é `parcial` e `semAnoLetivo`, e nenhuma turma é lida.
 */
export function filaDoProfessor({ entregas, vinculos, contagens }: EntradaDaFilaDoProfessor): FilaDoProfessor {
  const dosVinculos = lida(vinculos) ?? []
  const semAnoLetivo = semAnoLetivoPelaResposta(vinculos)
  const nomes = nomesDasTurmas(dosVinculos)
  const turmas = turmasConfirmadas(dosVinculos)
  const noTeto = turmas.slice(0, TETO_DE_TURMAS_LIDAS)
  const alemDoTeto = turmas.slice(TETO_DE_TURMAS_LIDAS)
  const leituras = noTeto.map((turma) => ({ turma, leitura: contagens.get(turma.turmaId) ?? ({ estado: 'nao-lida' } as const) }))

  const itens: ItemDaFilaDoProfessor[] = [...itensDeEntrega(lida(entregas) ?? [], nomes)]
  for (const { turma, leitura } of leituras) {
    if (leitura.estado !== 'lida' || leitura.dado.quantidade === 0) continue
    const frases = frasesDosPedidos(leitura.dado)
    itens.push({
      id: `pedidos-${turma.turmaId}`,
      tipo: 'pedidos-de-nome',
      grupo: turma.nome,
      turmaId: turma.turmaId,
      haMais: leitura.dado.haMais,
      titulo: 'Pedidos de nome para decidir',
      detalhe: frases.detalhe,
      urgente: false,
      para: `${caminhoDaTurmaDoProfessor(turma.turmaId)}?aba=alunos`,
      contador: { n: leitura.dado.quantidade, oQueConta: frases.oQueConta },
    })
  }
  itens.push(...itensDeConfirmacao(dosVinculos))
  // Estável: dentro da turma e do tipo fica a ordem de chegada (a entrega mais antiga primeiro).
  const grupoDoItem = (item: ItemDaFilaDoProfessor) => (item.grupo === GRUPO_DA_TURMA_SEM_NOME ? '￿' : item.grupo)
  itens.sort((a, b) => porNome(grupoDoItem(a), grupoDoItem(b)) || TIPOS_DA_FILA_DO_PROFESSOR.indexOf(a.tipo) - TIPOS_DA_FILA_DO_PROFESSOR.indexOf(b.tipo))

  const leituraPorTurma = leituraDeCadaTurma(entregas, turmas, contagens)
  // A página de entregas cheia, com outra depois: o que se leu é um piso. Entrega que falhou ou ainda lê não tem número a dizer.
  const haMais = entregas.estado === 'lida' && !entregas.completa
  const lendo = entregas.estado === 'carregando' || vinculos.estado === 'carregando' || leituras.some(({ leitura }) => leitura.estado === 'carregando')
  if (lendo) return { itens, situacao: 'carregando', naoLeu: [], haMais, semAnoLetivo: false, leituraPorTurma }
  if (semAnoLetivo) return { itens, situacao: 'parcial', naoLeu: [], haMais, semAnoLetivo: true, leituraPorTurma }
  if (entregas.estado === 'erro' && vinculos.estado === 'erro') return { itens, situacao: 'erro', erro: entregas.erro, naoLeu: [], haMais, semAnoLetivo: false, leituraPorTurma }

  const naoLeu: string[] = []
  if (entregas.estado === 'erro') naoLeu.push('as correções e as versões adaptadas')
  else if (entregas.estado === 'lida' && !entregas.completa) naoLeu.push('parte das correções e das versões adaptadas')
  if (vinculos.estado === 'erro') naoLeu.push('as suas turmas')
  else if (vinculos.estado === 'lida' && !vinculos.completa) naoLeu.push('parte das suas turmas')
  const semLeitura = leituras.filter(({ leitura }) => leitura.estado !== 'lida').length + alemDoTeto.length
  if (semLeitura > 0) naoLeu.push(semLeitura === 1 ? 'os pedidos de nome de 1 turma' : `os pedidos de nome de ${String(semLeitura)} turmas`)
  return { itens, situacao: naoLeu.length > 0 ? 'parcial' : 'pronta', naoLeu, haMais, semAnoLetivo: false, leituraPorTurma }
}

/**
 * O quanto se leu de cada turma confirmada. Turma só é `lida` com as entregas lidas **inteiras** e a contagem de pedidos dela
 * respondida: a que não tem leitura no mapa (além das 12, ou parada pela recusa por limite) é `nao-lida`, e é por isso que o cartão
 * dela nunca diz "Em dia".
 */
function leituraDeCadaTurma(
  entregas: LeituraDaFila<readonly Entrega[]>,
  turmas: readonly { readonly turmaId: string }[],
  contagens: ReadonlyMap<string, LeituraDaContagem>,
): ReadonlyMap<string, LeituraDaTurma> {
  const dasEntregas: LeituraDaTurma = entregas.estado === 'carregando' ? 'lendo' : entregas.estado === 'lida' && entregas.completa ? 'lida' : 'nao-lida'
  return new Map(
    turmas.map(({ turmaId }) => {
      const dosPedidos = contagens.get(turmaId)?.estado
      const leitura: LeituraDaTurma = dasEntregas === 'nao-lida' || dosPedidos === undefined || dosPedidos === 'erro' || dosPedidos === 'nao-lida' ? 'nao-lida' : dasEntregas === 'lendo' || dosPedidos === 'carregando' ? 'lendo' : 'lida'
      return [turmaId, leitura]
    }),
  )
}

/** O que espera a professora numa turma, para o selo do cartão de Turmas (9.0). */
export interface EsperaNaTurma {
  /** Entregas pendentes e pedidos de nome da turma. O vínculo a confirmar não conta: ele é a faixa, não o cartão. */
  readonly n: number
  /** O número é um piso: a página de pedidos veio cheia, ou a turma não foi lida inteira. */
  readonly ouMais: boolean
  readonly leitura: LeituraDaTurma
}

/**
 * A soma que o cartão da turma mostra, tirada **dos itens que o sino já tem**: nenhuma leitura a mais (Tech Spec, seção 9, "Cartão da
 * turma"). Dois cartões da mesma turma (duas disciplinas) leem a mesma soma, porque a fila conta a turma uma vez só. A turma que não
 * está no mapa de leitura (não confirmada) é `nao-lida`.
 */
export function esperaNaTurma(fila: Pick<FilaDoProfessor, 'itens' | 'leituraPorTurma'>, turmaId: string): EsperaNaTurma {
  const dela = fila.itens.filter((item) => item.turmaId === turmaId && item.tipo !== 'confirme-sua-turma')
  const n = dela.reduce((soma, item) => soma + (item.tipo === 'pedidos-de-nome' ? (item.contador?.n ?? 0) : 1), 0)
  const leitura = fila.leituraPorTurma.get(turmaId) ?? 'nao-lida'
  return { n, ouMais: leitura !== 'lida' || dela.some((item) => item.haMais === true), leitura }
}

/** Um cartão de "Esperando você", na Home: a função que fez, o que foi feito e de que turma. */
export interface ItemEsperando {
  readonly id: string
  readonly funcao: ChaveDeFuncao
  /** O nome da função do Assistente: "Adaptação", "Correção de objetiva". */
  readonly nomeDaFuncao: string
  /** O que espera a professora: "Versão adaptada", "Correção da turma". */
  readonly titulo: string
  /** De quê e de que turma: "Atividade de estequiometria · 2ºB". */
  readonly detalhe: string
  /** A atividade aplicada do lote de correção: é por ela que "Revisar" chega à tela de aprovar. Nula na versão adaptada. */
  readonly atividadeAplicadaId: string | null
}

/**
 * O que aparece em "Esperando você" no Início (`docs/interface.md` 11.2): **só as entregas pendentes**, da mais antiga para a
 * mais nova, que é a ordem em que a professora deve olhar. A aprovada e a rejeitada não esperam ninguém, e sem pendência a
 * lista é vazia: a tela não põe nada no lugar. Veio de `areas/professor/artefatos/entregas.ts` (X3, 1.0); o Início deixa de usá-la na 3.0.
 */
export function esperandoVoce(entregas: readonly Entrega[], nomesDasTurmasPorId: Readonly<Record<string, string>>): ItemEsperando[] {
  return entregas
    .filter((entrega) => entrega.estado === 'pendente')
    .sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))
    .map((entrega) => {
      const turma = nomesDasTurmasPorId[entrega.turmaId]
      return {
        id: entrega.id,
        funcao: entrega.funcao,
        nomeDaFuncao: FUNCOES[entrega.funcao].nome,
        titulo: NOME_DO_TIPO_DE_ENTREGA[entrega.tipo],
        detalhe: turma === undefined ? entrega.titulo : `${entrega.titulo} · ${turma}`,
        atividadeAplicadaId: entrega.tipo === 'lote_de_correcao' ? entrega.atividadeAplicadaId : null,
      }
    })
}

export interface FilaLidaDoProfessor extends FilaDoProfessor {
  readonly tentarDeNovo: () => void
  readonly tentandoDeNovo: boolean
  readonly atualizar: () => void
  readonly atualizando: boolean
  /** Quando a fila ficou pronta pela primeira vez e a cada "Atualizar" que terminou. Sem relógio: só muda por clique. */
  readonly atualizadoEm: Date | undefined
}

function leituraDasEntregas(consulta: UseQueryResult<ListaDeEntregasResponse>): LeituraDaFila<readonly Entrega[]> {
  if (consulta.isError) return { estado: 'erro', erro: consulta.error }
  if (consulta.data === undefined) return { estado: 'carregando' }
  return { estado: 'lida', dado: consulta.data.itens, completa: consulta.data.proxima === undefined }
}

function leituraDosVinculos(consulta: UseInfiniteQueryResult<InfiniteData<MeusVinculosResponse>>): LeituraDaFila<readonly Vinculo[]> {
  if (consulta.isError) return { estado: 'erro', erro: consulta.error }
  if (consulta.data === undefined) return { estado: 'carregando' }
  return { estado: 'lida', dado: consulta.data.pages.flatMap((pagina) => pagina.itens), completa: !consulta.hasNextPage }
}

/** A recusa por limite (`LIMITE_EXCEDIDO`): repetir é o que ela pede para não fazer, e o sino para de ler as turmas. */
function foiRecusadaPorLimite(erro: unknown): boolean {
  return erro instanceof ErroDaApi && erro.codigo === ErrorCode.LIMITE_EXCEDIDO
}

/**
 * Lê a fila: as entregas pendentes, os vínculos e, **uma turma por vez**, a contagem de pedidos das turmas confirmadas (as 12
 * primeiras por nome). A leitura seguinte só sai quando a anterior respondeu, e **para na primeira recusa por limite**: as que
 * ficaram sem ler aparecem como não lidas. Todas com `LEITURA_DA_FILA`: nenhuma leitura por tempo, foco ou rede, e abrir a lista
 * não lê. Sem ano letivo em curso (`meus-vinculos` responde como inexistente) nenhuma turma é lida.
 *
 * "Tentar de novo" relê só o que falhou ou veio truncado, e "Atualizar" relê as leituras do sino, cada uma por `refetchQueries`
 * com a chave **exata** da consulta: nunca por prefixo, que alcançaria a lista nominal de pedidos, com o nome dos alunos.
 */
export function useFilaDoProfessor(): FilaLidaDoProfessor {
  const consultaDeEntregas = useQuery({ ...consultaEntregasPendentes, ...LEITURA_DA_FILA })
  const consultaDeVinculos = useInfiniteQuery({ ...consultaMeusVinculos, ...LEITURA_DA_FILA })
  const entregas = leituraDasEntregas(consultaDeEntregas)
  const vinculos = leituraDosVinculos(consultaDeVinculos)

  // As turmas a ler, em ordem de nome e até o teto. Quantas já foram liberadas para leitura é estado (a série): a seguinte só
  // é liberada quando todas as anteriores responderam e nenhuma foi recusada por limite. A série pertence ao conjunto de turmas
  // que ela lê: quando ele muda (sessão nova, troca de escola, vínculo novo), recomeça na primeira. É o padrão de ajustar o
  // estado durante a renderização, como a hora de "Atualizado às" abaixo.
  const cliente = useQueryClient()
  const turmasAoLer = turmasConfirmadas(lida(vinculos) ?? []).slice(0, TETO_DE_TURMAS_LIDAS)
  const conjuntoDeTurmas = turmasAoLer.map((turma) => turma.turmaId).join(' ')
  const [serie, definirSerie] = useState({ conjunto: '', liberadas: 1 })
  const liberadas = serie.conjunto === conjuntoDeTurmas ? serie.liberadas : 1
  if (serie.conjunto !== conjuntoDeTurmas) definirSerie({ conjunto: conjuntoDeTurmas, liberadas: 1 })
  const emLeitura = turmasAoLer.slice(0, liberadas)
  // Só a contagem que ainda não respondeu fica ligada. A que respondeu (com dado ou com erro) é desligada: o reset da sessão e a
  // invalidação global (`main.tsx`) só relêem consulta ligada, e com todas ligadas elas sairiam juntas, sem a série e sem a parada
  // no limite. Quem relê uma contagem lida é o clique ("Atualizar", "Tentar de novo") e a decisão de um pedido, uma de cada vez.
  const leiturasDasTurmas = useQueries({
    queries: emLeitura.map((turma) => {
      const consulta = consultaContagemDePedidos(turma.turmaId)
      const estado = cliente.getQueryState(consulta.queryKey)
      return { ...consulta, ...LEITURA_DA_FILA, enabled: estado === undefined || estado.status === 'pending' }
    }),
  })
  const recusada = leiturasDasTurmas.some((leitura) => leitura.isError && foiRecusadaPorLimite(leitura.error))
  if (!recusada && liberadas < turmasAoLer.length && leiturasDasTurmas.every((leitura) => leitura.status !== 'pending'))
    definirSerie({ conjunto: conjuntoDeTurmas, liberadas: liberadas + 1 })

  const contagens = new Map<string, LeituraDaContagem>()
  emLeitura.forEach((turma, indice) => {
    const leitura = leiturasDasTurmas[indice]
    if (leitura === undefined) return
    if (leitura.isError) contagens.set(turma.turmaId, { estado: 'erro', erro: leitura.error })
    else contagens.set(turma.turmaId, leitura.data === undefined ? { estado: 'carregando' } : { estado: 'lida', dado: leitura.data })
  })
  // As que esperam a vez ainda estão por ler; depois de uma recusa, não vão ser lidas até o "Tentar de novo".
  for (const turma of turmasAoLer.slice(liberadas)) contagens.set(turma.turmaId, recusada ? { estado: 'nao-lida' } : { estado: 'carregando' })

  const fila = filaDoProfessor({ entregas, vinculos, contagens })

  const [tentandoDeNovo, definirTentando] = useState(false)
  const [atualizando, definirAtualizando] = useState(false)
  const [atualizadoEm, definirAtualizadoEm] = useState<Date | undefined>(undefined)
  // A primeira vez que a fila deixa de carregar marca o "Atualizado às": o relógio não anda sozinho depois disso. Quando ela
  // volta a carregar (recomeço da sessão, troca de escola), a hora da leitura anterior sai: era de outra escola ou pessoa.
  if (atualizadoEm === undefined && fila.situacao !== 'carregando') definirAtualizadoEm(new Date())
  if (atualizadoEm !== undefined && fila.situacao === 'carregando') definirAtualizadoEm(undefined)

  const reler = (consulta: { readonly queryKey: readonly unknown[] }): Promise<unknown> => cliente.refetchQueries({ queryKey: consulta.queryKey, exact: true })

  /** As turmas, uma por vez, parando na primeira recusa por limite: a série da primeira leitura vale também para a releitura. */
  async function relerEmSerie(turmaIds: readonly string[]): Promise<void> {
    for (const turmaId of turmaIds) {
      const consulta = consultaContagemDePedidos(turmaId)
      // A contagem lida está desligada (ver acima), e `refetchQueries` não relê consulta desligada: a leitura é pedida direto.
      await cliente.fetchQuery({ ...consulta, staleTime: 0 }).catch(() => undefined)
      const estado = cliente.getQueryState(consulta.queryKey)
      if (estado?.status === 'error' && foiRecusadaPorLimite(estado.error)) return
    }
  }

  /** Só o que falhou ou veio truncado: reler o que já está inteiro seria leitura à toa. */
  function tentarDeNovo(): void {
    const entregasAReler = consultaDeEntregas.isError || (entregas.estado === 'lida' && !entregas.completa)
    const vinculosAReler = consultaDeVinculos.isError || consultaDeVinculos.hasNextPage
    const turmasComFalha = emLeitura.filter((_, indice) => leiturasDasTurmas[indice]?.isError === true).map((turma) => turma.turmaId)
    definirTentando(true)
    void (async () => {
      await Promise.allSettled([...(entregasAReler ? [reler(consultaEntregasPendentes)] : []), ...(vinculosAReler ? [reler(consultaMeusVinculos)] : [])])
      await relerEmSerie(turmasComFalha)
    })().finally(() => definirTentando(false))
  }

  function atualizar(): void {
    definirAtualizando(true)
    void (async () => {
      await Promise.allSettled([reler(consultaEntregasPendentes), reler(consultaMeusVinculos)])
      await relerEmSerie(emLeitura.map((turma) => turma.turmaId))
    })().finally(() => {
      definirAtualizando(false)
      definirAtualizadoEm(new Date())
    })
  }

  return { ...fila, tentarDeNovo, tentandoDeNovo, atualizar, atualizando, atualizadoEm }
}
