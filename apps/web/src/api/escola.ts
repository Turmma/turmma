import { acessoDaEscolaResponseSchema, type ProvedorDeContaDaEscola } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { apiGet } from './client'

/** `GET /v1/escolas/:slug/acesso`, anônima: o nome da escola do endereço e os provedores que ela liberou (11.0, 13.0). */
export function caminhoDoAcessoDaEscola(slug: string): string {
  return `/v1/escolas/${encodeURIComponent(slug)}/acesso`
}

/**
 * O que a tela `/e/:slug` mostra antes do login. É consulta de servidor, e por isso mora no TanStack Query (regra 50,
 * item 3): a resposta não tem nada de pessoa, só o nome da escola, que é público como o próprio endereço.
 *
 * Endereço que não existe responde `NAO_ENCONTRADO`, que o cliente de consultas não repete sozinho: insistir não faz
 * um endereço passar a existir, e às 7h30 a escola inteira está atrás do mesmo IP.
 */
export function acessoDaEscolaQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ['acesso-da-escola', slug],
    queryFn: ({ signal }) => apiGet(caminhoDoAcessoDaEscola(slug), acessoDaEscolaResponseSchema, signal),
  })
}

/**
 * Para onde o botão da conta da escola leva (13.0). É navegação do navegador, e não chamada em segundo plano: o
 * `iniciar` responde 302 para o Google ou a Microsoft, com o cookie do login em andamento.
 */
export function enderecoDoLoginExterno(provedor: ProvedorDeContaDaEscola, slug: string): string {
  return `/v1/sessao/externa/${provedor}/iniciar?slug=${encodeURIComponent(slug)}`
}

/** O nome de cada provedor como a escola o chama, para o rótulo do botão. */
export const NOME_DO_PROVEDOR: Readonly<Record<ProvedorDeContaDaEscola, string>> = {
  google: 'Google',
  microsoft: 'Microsoft',
}
