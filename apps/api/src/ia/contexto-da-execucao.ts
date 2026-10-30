import { contextoAtual, exigirEscolaDoContexto, type ContextoDaRequisicao } from '@educa/nucleo'
import { InvariantException } from '@educa/shared'

/**
 * A pessoa da sessão, gravada no contexto pela `GuardaDeSessao`. É quem pede a execução e quem pode lê-la. Sem pessoa
 * no contexto, falha fechada, como a escola: é erro de programação (rota sem guarda), nunca consulta sem a cláusula.
 */
export function exigirUsuarioDoContexto(): string {
  const usuarioId = contextoAtual()?.usuarioId
  if (usuarioId === undefined) throw new InvariantException('consulta da própria pessoa sem usuário no contexto')
  return usuarioId
}

/**
 * Uma cópia do contexto de quem pediu, para o trabalho da execução rodar nela depois que a requisição acabou: a mesma
 * escola, a mesma pessoa, o mesmo ano letivo. É cópia, e não o contexto herdado: o executor despacha a próxima da fila
 * de dentro da execução que terminou, que pode ser de outra pessoa.
 */
export function copiarContextoDeQuemPede(): ContextoDaRequisicao {
  exigirEscolaDoContexto()
  exigirUsuarioDoContexto()
  return { ...(contextoAtual() as ContextoDaRequisicao) }
}
