import { conviteDeProfessorResponseSchema, listaDeProfessoresResponseSchema, type CadastrarProfessorRequest, type ProfessorDaEscola, type ConviteDeProfessorResponse } from '@educa/shared'
import { mutationOptions, queryOptions } from '@tanstack/react-query'
import { SEM_CORPO } from '../../../../api/client'
import { CHAVE_DA_ESTRUTURA, lerPaginas } from '../../../../api/estrutura'
import { chamarComSessao } from '../../../../api/sessao'

export const CAMINHO_DOS_PROFESSORES = '/v1/professores'

/**
 * Os professores da escola da sessão, com o estado do convite (`GET /v1/professores`; A1, 3.0): usuário, nome e estado,
 * sem e-mail, sem link e sem nada que diga se a conta do e-mail já existia (E11). A alocação da Estrutura (13.0) oferece
 * só os de `ESTADOS_DO_PROFESSOR_ALOCAVEIS`; a tela Professores (14.0) cadastra, refaz e revoga.
 */
export const consultaProfessores = queryOptions({
  queryKey: [...CHAVE_DA_ESTRUTURA, 'professores'],
  queryFn: ({ signal }) => lerPaginas<ProfessorDaEscola>(CAMINHO_DOS_PROFESSORES, listaDeProfessoresResponseSchema, signal),
})

/** `POST /v1/professores`: cadastra o professor na escola da sessão; o token do convite só existe nesta resposta. */
export function cadastrarProfessor(pedido: CadastrarProfessorRequest): Promise<ConviteDeProfessorResponse> {
  return chamarComSessao(CAMINHO_DOS_PROFESSORES, conviteDeProfessorResponseSchema, { metodo: 'POST', corpo: pedido })
}

/**
 * `POST /v1/professores/:usuarioId/convite/refazer`, pelo usuário do professor que a lista trouxe: o convite anterior
 * deixa de valer, e o token do novo só existe nesta resposta.
 */
export function refazerConviteDoProfessor(usuarioId: string): Promise<ConviteDeProfessorResponse> {
  return chamarComSessao(`${CAMINHO_DOS_PROFESSORES}/${encodeURIComponent(usuarioId)}/convite/refazer`, conviteDeProfessorResponseSchema, { metodo: 'POST', corpo: {} })
}

/** `POST /v1/professores/:usuarioId/convite/revogar`: 204, sem corpo. */
export function revogarConviteDoProfessor(usuarioId: string): Promise<void> {
  return chamarComSessao(`${CAMINHO_DOS_PROFESSORES}/${encodeURIComponent(usuarioId)}/convite/revogar`, SEM_CORPO, { metodo: 'POST', corpo: {} })
}

/**
 * As mutações que trazem o token do convite do professor (cadastrar e refazer; A1, 14.0). O token é credencial: ele vive
 * só no diálogo que o pediu (regra 20, item 8). O `MutationCache` guardaria a resposta — e, no cadastro, o nome e o
 * e-mail do pedido — por cinco minutos depois de o diálogo fechar (o `gcTime` padrão das mutações); com `gcTime: 0` ela
 * sai do cache assim que nenhum diálogo a observa, inclusive quando a resposta chega depois de o diálogo fechar. O diálogo
 * ainda chama `reset()` ao fechar, que solta a mutação na hora, e usa estas opções como estão: `aoTerminar` (recarregar a
 * lista, dê certo ou não) é o único acréscimo, e nada nele leva o token.
 */
export function mutacaoDoCadastroDeProfessor(aoTerminar?: () => Promise<void>) {
  return mutationOptions({
    mutationFn: cadastrarProfessor,
    gcTime: 0,
    ...(aoTerminar === undefined ? {} : { onSettled: aoTerminar }),
  })
}

/** O refazer, com a mesma regra do cadastro para o token (`mutacaoDoCadastroDeProfessor`). */
export function mutacaoDoRefazerConviteDoProfessor(usuarioId: string, aoTerminar?: () => Promise<void>) {
  return mutationOptions({
    mutationFn: () => refazerConviteDoProfessor(usuarioId),
    gcTime: 0,
    ...(aoTerminar === undefined ? {} : { onSettled: aoTerminar }),
  })
}
