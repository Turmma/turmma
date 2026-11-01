import {
  decisaoResponseSchema,
  pedidosDaTurmaResponseSchema,
  TAMANHO_MAXIMO_DA_PAGINA,
  type DecisorDaReivindicacao,
  type FinalidadeDaLeituraDeAlunos,
  type DecidirReivindicacoesRequest,
  type DecisaoResponse,
  type PedidosDaTurmaResponse,
} from '@educa/shared'
import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { ALUNOS_DA_TURMA_QUERY_KEY } from './alunos-da-turma'
import { authedGet, authedRequest } from './sessao'

/**
 * Os pedidos de reivindicação da turma, por quem decide (A1, 16.0; RF12; as rotas são da 8.0): o professor com vínculo
 * confirmado e a coordenação leem os pendentes e aprovam ou recusam os marcados. A escola, o ano e o vínculo vêm do
 * token e do servidor: o que vai no pedido é a turma, no caminho, e os ids dos pedidos.
 *
 * O nome do aluno só passa pela resposta da leitura e pela memória da página: nunca no endereço, em `localStorage` nem
 * em `sessionStorage` (regra 20; regra 50, item 7).
 */

/**
 * Por que a coordenação lê os pedidos de dentro da turma (regra 20, item 10): conferir o cadastro que ela está montando,
 * a mesma finalidade da lista de nomes da mesma tela. Cada leitura dela fica na auditoria (`turma.reivindicacoes_lidas`).
 */
export const FINALIDADE_DOS_PEDIDOS_NA_ESTRUTURA: FinalidadeDaLeituraDeAlunos = 'conferencia_de_cadastro'

/** Uma leitura traz até uma página, a maior que a API entrega: havendo mais, a tela diz, e eles vêm depois da decisão. */
export const PEDIDOS_POR_LEITURA = TAMANHO_MAXIMO_DA_PAGINA

/** O começo da chave das leituras dos pedidos: a troca de escola e a pessoa seguinte esvaziam tudo junto (`main.tsx`). */
const PEDIDOS_QUERY_KEY = ['pedidos-da-turma'] as const

/**
 * Os pedidos pendentes da turma (`GET /v1/turmas/:id/reivindicacoes`), como quem decide os lê.
 *
 * - **O professor** lê ao abrir a turma, sem finalidade, e a tela relê sozinha (`atualizacao-dos-pedidos.ts`).
 * - **A coordenação** manda a finalidade, e a leitura só sai quando ela pede (`enabled: false`, e o "Atualizar" chama o
 *   `refetch`): cada leitura grava um registro de auditoria em nome dela, e nenhuma sai sozinha, nem ao abrir a turma,
 *   nem ao voltar para a aba, nem quando a sessão volta a valer.
 *
 * Fora da tela a lista não fica guardada, nos dois papéis (`gcTime: 0`): os nomes não ficam na memória da aba do
 * computador compartilhado, e voltar à turma não mostra uma leitura antiga.
 *
 * Quem decide entra na chave: a lista que o professor leu nunca é a que a coordenação vê sem a leitura dela.
 */
export function pedidosDaTurmaQueryOptions(turmaId: string, quem: DecisorDaReivindicacao) {
  const daCoordenacao = quem === 'coordenacao'
  return queryOptions({
    queryKey: [...PEDIDOS_QUERY_KEY, turmaId, quem],
    queryFn: ({ signal }) => {
      const consulta = new URLSearchParams({ limite: String(PEDIDOS_POR_LEITURA) })
      if (daCoordenacao) consulta.set('finalidade', FINALIDADE_DOS_PEDIDOS_NA_ESTRUTURA)
      return authedGet(`/v1/turmas/${encodeURIComponent(turmaId)}/reivindicacoes?${consulta.toString()}`, pedidosDaTurmaResponseSchema, signal)
    },
    enabled: !daCoordenacao,
    gcTime: 0,
  })
}

/** A chave da contagem de pedidos de uma turma, a do sino do professor: **outra** que a da lista nominal, e nunca a mesma por prefixo. */
const CONTAGEM_DE_PEDIDOS_QUERY_KEY = [...PEDIDOS_QUERY_KEY, 'contagem'] as const

/** O que o sino do professor guarda dos pedidos de uma turma: quantos esperam e se há mais que a página trouxe. Nenhum nome. */
export interface ContagemDePedidos {
  readonly quantidade: number
  /** A página veio cheia e há outra: o sino diz "100 ou mais", e não um número que não sabe. */
  readonly haMais: boolean
}

/**
 * Só a contagem dos pedidos pendentes da turma, para o sino "Esperando você" do professor (telas do professor, 1.0; Tech Spec,
 * seções 5 e 7). É a mesma rota da lista nominal (`GET /v1/turmas/:id/reivindicacoes`), mas **a lista é descartada na própria
 * leitura, antes do cache**: o que fica guardado é `{ quantidade, haMais }`, sem o nome de nenhum aluno (regra 20; D34). O
 * `select` não serviria: ele roda depois de o cache guardar o dado inteiro.
 *
 * `gcTime: 0`, como nas nominais, por outro motivo: a chave leva o id da turma, e a consulta que sobrasse depois da troca de
 * escola ou da pessoa seguinte deixaria no cache da aba o id de uma turma de quem saiu (W3). Sem observador, ela some.
 *
 * A chave (`['pedidos-da-turma', 'contagem', turmaId]`) é distinta da lista nominal (`[...PEDIDOS_QUERY_KEY, turmaId, quem]`):
 * decidir um pedido a invalida por chave exata (`aplicarDecisao`), e a releitura do sino nunca alcança a lista aberta na tela.
 * Só o professor lê assim: a leitura da coordenação é auditada e pede finalidade (`pedidosDaTurmaQueryOptions`).
 */
export function contagemDePedidosQueryOptions(turmaId: string) {
  return queryOptions({
    queryKey: [...CONTAGEM_DE_PEDIDOS_QUERY_KEY, turmaId],
    queryFn: async ({ signal }): Promise<ContagemDePedidos> => {
      const lista = await authedGet(`/v1/turmas/${encodeURIComponent(turmaId)}/reivindicacoes?limite=${String(PEDIDOS_POR_LEITURA)}`, pedidosDaTurmaResponseSchema, signal)
      return { quantidade: lista.itens.length, haMais: lista.proxima !== undefined }
    },
    gcTime: 0,
  })
}

/** `POST /v1/reivindicacoes/decidir`: aprova ou recusa os pedidos dados, e diz o que aconteceu com cada um. */
export function decidirPedidos(pedido: DecidirReivindicacoesRequest): Promise<DecisaoResponse> {
  return authedRequest('/v1/reivindicacoes/decidir', decisaoResponseSchema, { metodo: 'POST', corpo: pedido })
}

/**
 * A lista depois da decisão. Todo id da resposta deixou de esperar por esta pessoa (`decidida`, `ja_decidida` ou
 * `nao_encontrada`), e sai da lista na hora, sem leitura nova. A leitura que estava no ar é descartada antes: ela foi
 * feita antes da decisão, e traria de volta o pedido decidido. Depois a lista é marcada como velha: a do professor, que
 * está ligada, é relida em seguida; a da coordenação, desligada (`enabled: false`), não é: leitura dela só no "Atualizar".
 */
export async function aplicarDecisao(cliente: QueryClient, turmaId: string, quem: DecisorDaReivindicacao, resposta: DecisaoResponse): Promise<void> {
  const { queryKey } = pedidosDaTurmaQueryOptions(turmaId, quem)
  await cliente.cancelQueries({ queryKey })
  const fechados = new Set(resposta.resultados.map((resultado) => resultado.id))
  cliente.setQueryData<PedidosDaTurmaResponse>(queryKey, (lista) => (lista === undefined ? undefined : { ...lista, itens: lista.itens.filter((pedido) => !fechados.has(pedido.id)) }))
  void cliente.invalidateQueries({ queryKey })
  invalidarAContagem(cliente, turmaId, quem)
  invalidarOsAlunos(cliente, turmaId)
}

/**
 * A lista de nomes da turma, depois de uma decisão (telas do professor, 12.0): aprovar um pedido põe o aluno na turma, e a lista
 * da aba Alunos, aberta ao lado dos pedidos, deixou de valer. **Só a da turma**, pela chave (`['alunos-da-turma', turmaId]`): a
 * decisão não alcança as listas de outras turmas. Sem observador ela só fica velha, e a leitura seguinte a refaz.
 */
function invalidarOsAlunos(cliente: QueryClient, turmaId: string): void {
  void cliente.invalidateQueries({ queryKey: [...ALUNOS_DA_TURMA_QUERY_KEY, turmaId] })
}

/**
 * A contagem do sino do professor, depois de uma decisão dele: ela fica velha, e o sino a relê (o item some quando os pedidos
 * acabam). **Só a da turma, por chave exata, e só com `quem === 'professor'`**: a coordenação não tem contagem (o sino dela
 * não lê pedidos, e a leitura dela é auditada), e as outras turmas e a lista nominal não são tocadas.
 */
function invalidarAContagem(cliente: QueryClient, turmaId: string, quem: DecisorDaReivindicacao): void {
  if (quem !== 'professor') return
  const consulta = contagemDePedidosQueryOptions(turmaId)
  void cliente.invalidateQueries({ queryKey: consulta.queryKey, exact: true, refetchType: 'none' })
  // A invalidação só marca a contagem velha, para o `fetchQuery` abaixo não devolver o dado guardado (o `staleTime` do cliente);
  // quem lê é ele, por isso `refetchType: 'none'`. Só relê se o sino observa a turma: a contagem lida fica desligada, mas o
  // observador continua inscrito. Sem observador (turma além do teto, ou sem ler depois de um 429) nada é lido, e com
  // `gcTime: 0` não há o que guardar: o teto e a parada no limite valem também aqui (regra 80).
  if ((cliente.getQueryCache().find({ queryKey: consulta.queryKey, exact: true })?.getObserversCount() ?? 0) > 0) void cliente.fetchQuery(consulta).catch(() => undefined)
}

/**
 * A lista depois da decisão que falhou. Um erro no meio do lote não desfaz os pedidos já decididos, e a resposta não diz
 * quais foram (nota da 8.0): a lista na tela deixou de valer. A do professor é relida, e fica na tela enquanto a releitura
 * não volta (o diálogo aberto continua com os nomes); a da coordenação é esvaziada, e volta ao estado de antes da primeira
 * leitura, até ela pedir de novo.
 */
export async function descartarListaDepoisDaFalha(cliente: QueryClient, turmaId: string, quem: DecisorDaReivindicacao): Promise<void> {
  const { queryKey } = pedidosDaTurmaQueryOptions(turmaId, quem)
  invalidarAContagem(cliente, turmaId, quem)
  invalidarOsAlunos(cliente, turmaId)
  if (quem === 'professor') await cliente.invalidateQueries({ queryKey })
  else await cliente.resetQueries({ queryKey, exact: true })
}
