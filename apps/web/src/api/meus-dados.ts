import { arquivoResponseSchema, meusDadosResponseSchema, type ArquivoResponse } from '@educa/shared'
import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { buscarComSessao, chamarComSessao } from './sessao'

/**
 * "Meus dados" do aluno e do professor (F3, 18.0; RF12 e RF20; Tech Spec do F3, seções 4 e 9): os pedidos de cópia dos
 * dados da própria pessoa na escola ativa, com o estado, a validade do arquivo e o que a escola guarda dela por categoria.
 * O que a pessoa lê aqui é dela sobre ela mesma: a API não leva o id (vem da sessão, regra 10, item 4) e a leitura não é
 * auditada, o que deixa a tela reler sozinha enquanto o arquivo é montado sem encher o registro da escola.
 */

/**
 * O começo de toda chave de "Meus dados": a troca de sessão ou de escola esvazia o cache inteiro (`main.tsx`,
 * `resetQueries`), e a pessoa seguinte, ou a mesma na outra escola, não lê os pedidos da anterior.
 */
export const CHAVE_DE_MEUS_DADOS = ['meus-dados'] as const

/**
 * Os pedidos da pessoa e o resumo por categoria. **Fora da tela a resposta não fica guardada** (`gcTime: 0`): o que a
 * escola guarda de uma pessoa e o estado do arquivo dela não ficam na memória do computador compartilhado depois de ela
 * sair da tela, e a abertura seguinte lê de novo (a coordenação pode ter registrado ou concluído um pedido desde então).
 */
export const consultaMeusDados = queryOptions({
  queryKey: CHAVE_DE_MEUS_DADOS,
  queryFn: ({ signal }) => buscarComSessao('/v1/meus-dados', meusDadosResponseSchema, signal),
  gcTime: 0,
})

/**
 * `POST /v1/meus-dados/:id/baixar`: a URL de 5 minutos da versão completa do arquivo da própria pessoa. É `POST` e não
 * consulta: cada clique é um download registrado na auditoria da escola, e a resposta, que dá o arquivo de uma pessoa, nunca
 * é guardada. O id vai escapado no caminho: o que vier de fora não muda a rota da API.
 */
export function baixarMeuArquivo(pedidoId: string): Promise<ArquivoResponse> {
  return chamarComSessao(`/v1/meus-dados/${encodeURIComponent(pedidoId)}/baixar`, arquivoResponseSchema, { metodo: 'POST', corpo: {} })
}

/** Relê os pedidos, e só então o que a tela mostra é o do servidor: a falha que diz que o arquivo saiu usa isto. */
export function relerMeusDados(cliente: QueryClient): Promise<void> {
  return cliente.invalidateQueries({ queryKey: CHAVE_DE_MEUS_DADOS })
}
