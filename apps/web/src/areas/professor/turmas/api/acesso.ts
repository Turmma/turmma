import { acessoDaTurmaResponseSchema, acessoGeradoResponseSchema, type GerarAcessoRequest, type AcessoGeradoResponse } from '@educa/shared'
import { mutationOptions, queryOptions } from '@tanstack/react-query'
import { EMPTY_BODY } from '../../../../api/client'
import { authedGet, authedRequest } from '../../../../api/sessao'

/**
 * O acesso da turma pelo professor (A1, 15.0; RF9; as rotas são da 4.0): o link da sala e o código da turma, que ele
 * gera, lê até quando valem e revoga. A escola, o ano e o vínculo confirmado vêm do token e do servidor, nunca da tela:
 * o que vai no pedido é só a turma, no caminho, e a validade.
 */

const caminhoDoAcesso = (turmaId: string) => `/v1/turmas/${encodeURIComponent(turmaId)}/acesso`

/** O começo da chave das leituras do acesso: a troca de escola e a pessoa seguinte esvaziam tudo junto (`main.tsx`). */
const ACESSO_QUERY_KEY = ['acesso-da-turma'] as const

/**
 * Até quando vale o acesso vigente da turma, ou `null` sem nenhum (`GET /v1/turmas/:id/acesso`). O link e o código não
 * voltam aqui: aparecem uma vez, na resposta que os cria.
 */
export function acessoDaTurmaQueryOptions(turmaId: string) {
  return queryOptions({
    queryKey: [...ACESSO_QUERY_KEY, turmaId],
    queryFn: ({ signal }) => authedGet(caminhoDoAcesso(turmaId), acessoDaTurmaResponseSchema, signal),
  })
}

/** `POST /v1/turmas/:id/acesso`: gera o link e o código, e derruba os anteriores da turma. Os dois só existem nesta resposta. */
export function gerarAcesso(turmaId: string, pedido: GerarAcessoRequest): Promise<AcessoGeradoResponse> {
  return authedRequest(caminhoDoAcesso(turmaId), acessoGeradoResponseSchema, { metodo: 'POST', corpo: pedido })
}

/** `POST /v1/turmas/:id/acesso/revogar`: 204, sem corpo. O link e o código vigentes deixam de valer na hora. */
export function revogarAcesso(turmaId: string): Promise<void> {
  return authedRequest(`${caminhoDoAcesso(turmaId)}/revogar`, EMPTY_BODY, { metodo: 'POST', corpo: {} })
}

/**
 * A mutação que traz o token do link e o código da turma. Os dois abrem a lista de nomes livres da turma: vivem só no
 * diálogo que os pediu (regra 20, item 8). O `MutationCache` guardaria a resposta por cinco minutos depois de o diálogo
 * fechar (o `gcTime` padrão das mutações); com `gcTime: 0` ela sai do cache assim que nenhum diálogo a observa, também
 * quando a resposta chega depois de o diálogo fechar. `aoTerminar` (reler até quando vale o acesso, dê certo ou não) é o
 * único acréscimo, e nada nele leva o token nem o código: a validade na tela vem sempre da leitura, nunca desta
 * resposta, para o gerar que responde atrasado não escrever por cima do que o servidor tem agora.
 */
export function mutacaoDoGerarAcesso(turmaId: string, aoTerminar?: () => Promise<void>) {
  return mutationOptions({
    mutationFn: (pedido: GerarAcessoRequest) => gerarAcesso(turmaId, pedido),
    gcTime: 0,
    ...(aoTerminar === undefined ? {} : { onSettled: aoTerminar }),
  })
}
