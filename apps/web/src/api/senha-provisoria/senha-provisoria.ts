import {
  alvoDaSenhaProvisoriaResponseSchema,
  ErrorCode,
  senhaProvisoriaResponseSchema,
  type AlvoDaSenhaProvisoriaResponse,
  type SenhaProvisoriaResponse,
} from '@educa/shared'
import { authedRequest } from '../sessao'

/**
 * A senha provisória pela tela do professor e da coordenação (acesso-e-convites, tarefa 12.0; RF13, RF18; Tech Spec, seções 5, "O alvo da provisória", e 9).
 *
 * As duas chamadas **não passam pelo cache de consultas**: a leitura do alvo traz a matrícula, e a geração traz a senha, que só existe em claro nessa resposta. Cada uma é uma função
 * com o `AbortSignal` de quem a chamou (o diálogo que as pediu), e o resultado vive só no estado desse diálogo: fechar o diálogo o descarta, e nada fica em `localStorage`, `sessionStorage`,
 * endereço ou cache (regra 20, itens 4 e 8; regra 50, item 7). O servidor responde as duas com `Cache-Control: no-store`, e o `apiRequest` pede `no-store`.
 */

function caminhoDaProvisoria(usuarioId: string): string {
  return `/v1/usuarios/${encodeURIComponent(usuarioId)}/senha-provisoria`
}

/**
 * `GET /v1/usuarios/:usuarioId/senha-provisoria`: o aluno que a confirmação mostra antes de gerar, `{ nome, turma, matricula, entraPelaContaDaEscola }`. Um aluno por vez, lido ao abrir a
 * confirmação e descartado ao fechar. Quem não alcança o aluno recebe `NAO_ENCONTRADO`, igual ao aluno que não existe.
 */
export function lerOAlvoDaSenhaProvisoria(usuarioId: string, sinal?: AbortSignal): Promise<AlvoDaSenhaProvisoriaResponse> {
  return authedRequest(caminhoDaProvisoria(usuarioId), alvoDaSenhaProvisoriaResponseSchema, { sinal })
}

/** `POST /v1/usuarios/:usuarioId/senha-provisoria`: gera a senha, em dois grupos (`ABCD-EFGH`), com a validade. Sem corpo: o aluno é o do caminho. */
export function gerarASenhaProvisoria(usuarioId: string): Promise<SenhaProvisoriaResponse> {
  return authedRequest(caminhoDaProvisoria(usuarioId), senhaProvisoriaResponseSchema, { metodo: 'POST' })
}

/** O aviso que a confirmação dá do aluno que já não está na turma, nas duas telas. A lista é lida de novo junto. */
export const TEXTO_DO_ALUNO_QUE_SAIU_DA_TURMA = 'Este aluno não está mais na turma. A lista foi atualizada.'

/** O aluno que entra pela conta da escola não tem senha: o aviso vale na leitura do alvo e na resposta da geração. */
export const TEXTO_DO_ALUNO_DA_CONTA_DA_ESCOLA = 'Este aluno entra pela conta da escola. Não precisa de senha.'

/** O texto de cada falha da geração e da leitura do alvo, pelo código. O que não está aqui cai no texto do catálogo (`errorText`). */
export const TEXTOS_DA_FALHA_DA_PROVISORIA = {
  [ErrorCode.ENTRA_PELA_CONTA_DA_ESCOLA]: TEXTO_DO_ALUNO_DA_CONTA_DA_ESCOLA,
  [ErrorCode.NAO_ENCONTRADO]: TEXTO_DO_ALUNO_QUE_SAIU_DA_TURMA,
  [ErrorCode.CONFLITO]: 'Esta senha acabou de ser gerada. Espere alguns segundos para gerar outra.',
  [ErrorCode.LIMITE_EXCEDIDO]: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
} as const satisfies Partial<Record<ErrorCode, string>>

/** A senha para o leitor de tela, caractere a caractere, com a pausa entre os dois grupos: `ABCD-2345` → "A B C D, 2 3 4 5". */
export function senhaSoletrada(senha: string): string {
  return senha
    .split('-')
    .map((grupo) => [...grupo].join(' '))
    .join(', ')
}
