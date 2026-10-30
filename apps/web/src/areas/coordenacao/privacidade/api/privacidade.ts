import {
  pedidoDoTitularSchema,
  buscaDeTitularesResponseSchema,
  arquivoResponseSchema,
  incidentesResponseSchema,
  pedidosResponseSchema,
  previaDoTitularResponseSchema,
  retencaoResponseSchema,
  suboperadoresResponseSchema,
  type FinalidadeDoArquivo,
  type PedidoDoTitular,
  type RegistroDePedido,
  type BuscaDeTitularesResponse,
  type ArquivoResponse,
} from '@educa/shared'
import { infiniteQueryOptions, queryOptions, type QueryClient } from '@tanstack/react-query'
import { SEM_CORPO } from '../../../../api/cliente'
import { buscarComSessao, chamarComSessao } from '../../../../api/sessao'

/**
 * A Privacidade da coordenação (F3, 6.0). A escola vem do token, nunca da tela (regra 10, item 3). Só a coordenação
 * alcança estas leituras: professor, aluno e a rede recebem a resposta do inexistente da guarda (`PrivacidadeController`).
 */

/**
 * O começo de toda chave da Privacidade: a troca de sessão ou de escola esvazia tudo junto (`main.tsx`, `resetQueries`),
 * e a pessoa seguinte não lê a retenção da anterior.
 */
export const CHAVE_DA_PRIVACIDADE = ['privacidade'] as const

/** Por quanto tempo a escola guarda cada dado: as categorias, com o prazo que vale e de onde ele vem, e os prazos fixos. */
export const consultaRetencao = queryOptions({
  queryKey: [...CHAVE_DA_PRIVACIDADE, 'retencao'],
  queryFn: ({ signal }) => buscarComSessao('/v1/privacidade/retencao', retencaoResponseSchema, signal),
})

/** As empresas que recebem dado da escola, vigentes e passadas (F3, 8.0). */
export const consultaSuboperadores = queryOptions({
  queryKey: [...CHAVE_DA_PRIVACIDADE, 'suboperadores'],
  queryFn: ({ signal }) => buscarComSessao('/v1/privacidade/suboperadores', suboperadoresResponseSchema, signal),
})

/**
 * Os incidentes de segurança que afetaram a escola, só a seção dela, com os sem confirmação primeiro (F3, 10.0; RF9). Duas
 * telas leem esta consulta: o aviso da área da coordenação, que a lê uma vez por sessão, e a aba Incidentes. A chave é uma só,
 * e por isso a confirmação numa delas atualiza a outra.
 */
export const consultaIncidentes = queryOptions({
  queryKey: [...CHAVE_DA_PRIVACIDADE, 'incidentes'],
  queryFn: ({ signal }) => buscarComSessao('/v1/privacidade/incidentes', incidentesResponseSchema, signal),
})

/**
 * `POST /v1/privacidade/incidentes/:id/confirmar`: a coordenação diz que recebeu o aviso. Quem e quando ficam registrados na
 * API; confirmar de novo responde igual, e o id de outra escola responde o do inexistente (regra 10, item 6).
 */
export function confirmarIncidente(id: string): Promise<void> {
  return chamarComSessao(`/v1/privacidade/incidentes/${encodeURIComponent(id)}/confirmar`, SEM_CORPO, { metodo: 'POST', corpo: {} })
}

/**
 * Depois de confirmar, a tela relê os incidentes e só então o pedido termina: o dado que aparece é o do servidor (a data de
 * confirmação é dele), e a faixa e o diálogo somem juntos com a aba. O `await` mantém o botão desligado até a leitura chegar.
 */
export function relerIncidentes(cliente: QueryClient): Promise<void> {
  return cliente.invalidateQueries({ queryKey: consultaIncidentes.queryKey })
}

const CAMINHO_DOS_PEDIDOS = '/v1/privacidade/pedidos'

/**
 * Os pedidos de titular da escola, a página de 50 como a API entrega (`?pagina=<id>`; F3, 16.0; RF16). Cada página lida é
 * auditada (`pedidos.listados`, com os ids), e por isso a aba relê ao abrir e não a cada foco da janela. Nenhuma leitura sai
 * sozinha: nem ao voltar para a aba, nem quando a rede volta (a mesma regra de `consultaPedidosDaTurma`, em `api/pedidos.ts`).
 *
 * Fora da tela a lista não fica guardada (`gcTime: 0`): nomes e turmas de titulares não ficam na memória do computador
 * compartilhado da secretaria; a troca de sessão já limpa o resto.
 */
export const consultaPedidosDoTitular = infiniteQueryOptions({
  queryKey: [...CHAVE_DA_PRIVACIDADE, 'pedidos'],
  queryFn: ({ pageParam, signal }) =>
    buscarComSessao(pageParam === undefined ? CAMINHO_DOS_PEDIDOS : `${CAMINHO_DOS_PEDIDOS}?pagina=${encodeURIComponent(pageParam)}`, pedidosResponseSchema, signal),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (ultima) => ultima.proxima,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  gcTime: 0,
})

/**
 * `POST /v1/privacidade/titulares/busca`: até 20 pessoas da escola pelo nome. O termo vai **no corpo**, e nunca na URL: nem
 * a API nem a web o guardam (regra 20, itens 9 e 10; RF17). É `POST` e não consulta, para o nome digitado e as pessoas
 * achadas ficarem só no estado da tela que as pediu, e não no cache de consultas.
 */
export function buscarTitulares(termo: string): Promise<BuscaDeTitularesResponse> {
  return chamarComSessao('/v1/privacidade/titulares/busca', buscaDeTitularesResponseSchema, { metodo: 'POST', corpo: { termo } })
}

/**
 * `GET /v1/privacidade/titulares/:id/previa`: o que a escola guarda da pessoa antes de registrar o pedido (aluno: a
 * contagem por categoria; professor: só cadastro e vínculo, sem contagem, D64) e se há homônimo. Cada leitura é auditada
 * (`titular.previa_lida`) e traz o que a escola guarda de uma pessoa: por isso a prévia **não fica no cache** depois que o
 * diálogo sai (`gcTime: 0`), e a abertura seguinte lê de novo, com o diálogo em "consultando" e o botão desligado.
 */
export function consultaPreviaDoTitular(titularId: string) {
  return queryOptions({
    queryKey: [...CHAVE_DA_PRIVACIDADE, 'previa', titularId],
    queryFn: ({ signal }) => buscarComSessao(`/v1/privacidade/titulares/${encodeURIComponent(titularId)}/previa`, previaDoTitularResponseSchema, signal),
    gcTime: 0,
  })
}

/**
 * `POST /v1/privacidade/pedidos`: registra o pedido. A `chaveEnvio` é sorteada por diálogo de confirmação, e a mesma chave
 * com o mesmo conteúdo devolve o mesmo pedido: o reenvio depois de uma queda de rede não duplica (Tech Spec do F3, seção 4).
 */
export function registrarPedidoDoTitular(registro: RegistroDePedido): Promise<PedidoDoTitular> {
  return chamarComSessao(CAMINHO_DOS_PEDIDOS, pedidoDoTitularSchema, { metodo: 'POST', corpo: registro })
}

/** Relê a lista de pedidos depois de um registro, e só então o diálogo termina: o que aparece é o que o servidor tem. */
export function relerPedidosDoTitular(cliente: QueryClient): Promise<void> {
  return cliente.invalidateQueries({ queryKey: consultaPedidosDoTitular.queryKey })
}

/**
 * O detalhe de um pedido: o prazo, a foto do compartilhamento e o que a eliminação fez com o nome (F3, 17.0; RF16). Cada
 * leitura é auditada em nome da coordenação (`pedido.lido`, regra 20, item 10), e por isso o detalhe não se relê sozinho:
 * nem ao voltar o foco da janela, nem quando a rede volta. Quem relê é a mutação que terminou, o botão "Atualizar" e, só com o
 * arquivo em preparação, o relógio de 10 s (`preparacao-do-arquivo.ts`).
 *
 * Fora da tela o pedido não fica guardado (`gcTime: 0`): nome e turma do titular não ficam na memória do computador
 * compartilhado da secretaria. A chave leva o id, e outro pedido é outra consulta.
 */
export function consultaPedidoDoTitular(pedidoId: string) {
  return queryOptions({
    queryKey: [...CHAVE_DA_PRIVACIDADE, 'pedido', pedidoId],
    queryFn: ({ signal }) => buscarComSessao(`${CAMINHO_DOS_PEDIDOS}/${encodeURIComponent(pedidoId)}`, pedidoDoTitularSchema, signal),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
  })
}

function caminhoDoPedido(pedidoId: string, acao: string): string {
  return `${CAMINHO_DOS_PEDIDOS}/${encodeURIComponent(pedidoId)}/${acao}`
}

/**
 * `POST pedidos/:id/concluir`: o fim do atendimento do pedido de acesso, portabilidade, compartilhamento ou correção. Quem
 * concluiu e quando ficam na API e na auditoria. O clique duplo decide no banco: o segundo recebe `PEDIDO_EM_ESTADO_INVALIDO`.
 */
export function concluirPedidoDoTitular(pedidoId: string): Promise<void> {
  return chamarComSessao(caminhoDoPedido(pedidoId, 'concluir'), SEM_CORPO, { metodo: 'POST', corpo: {} })
}

/** `POST pedidos/:id/cancelar`: só a eliminação agendada, antes dos 7 dias; o acesso da pessoa volta. */
export function cancelarPedidoDoTitular(pedidoId: string): Promise<void> {
  return chamarComSessao(caminhoDoPedido(pedidoId, 'cancelar'), SEM_CORPO, { metodo: 'POST', corpo: {} })
}

/** `POST pedidos/:id/corrigir-nome`: o nome novo vai **no corpo**, nunca na URL; o nome anterior não volta em resposta nenhuma. */
export function corrigirNomeDoTitular(pedidoId: string, nome: string): Promise<void> {
  return chamarComSessao(caminhoDoPedido(pedidoId, 'corrigir-nome'), SEM_CORPO, { metodo: 'POST', corpo: { nome } })
}

/**
 * `POST pedidos/:id/arquivo`: a URL de 5 minutos da versão da escola, com a finalidade, que a API grava na auditoria
 * (`titular.arquivo_baixado`). É `POST` e não consulta: cada clique é um download registrado, e a resposta nunca é guardada.
 */
export function pedirArquivoDaEscola(pedidoId: string, finalidade: Exclude<FinalidadeDoArquivo, 'acesso_do_proprio_titular'>): Promise<ArquivoResponse> {
  return chamarComSessao(caminhoDoPedido(pedidoId, 'arquivo'), arquivoResponseSchema, { metodo: 'POST', corpo: { finalidade } })
}

/**
 * Relê o detalhe depois de uma ação, e só então o diálogo termina: o estado que aparece é o do servidor, e a leitura que
 * estava no ar antes da ação é cancelada (`invalidateQueries`), para a resposta atrasada de antes não vencer. A lista não
 * entra: ela não está na tela (a página do pedido é outra rota) e não fica guardada (`gcTime: 0`), e a abertura seguinte lê de novo.
 */
export function relerPedidoDoTitular(cliente: QueryClient, pedidoId: string): Promise<void> {
  return cliente.invalidateQueries({ queryKey: consultaPedidoDoTitular(pedidoId).queryKey })
}
