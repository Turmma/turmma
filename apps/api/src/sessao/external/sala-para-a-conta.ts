import type { SalaDoLogin } from './external-login.service.js'

/**
 * Como o `iniciar` com `intencao=reivindicar` chegou à sala (acesso-e-convites, 14.0): o endereço da escola e o token do link **ou** o
 * código digitado, nunca os dois. Quem resolve é o `sala`, que tem a chave do código e o limite de código errado por escola; o `sessao`
 * só conhece esta porta, e nada de escola, ano ou turma vem do cliente.
 */
export type EntradaDaSalaParaAConta = { readonly slug: string; readonly token: string } | { readonly slug: string; readonly codigo: string }

/**
 * A porta do `sessao` para a sala: acha o acesso vigente (na escola do slug, no ano em curso) pelo link ou pelo código. Acesso que não
 * vale, de outra escola, vencido, revogado, de ano encerrado ou slug inexistente: `NAO_ENCONTRADO`, o mesmo de sempre (regra 10, item 6).
 */
export interface SalaParaAConta {
  achar(entrada: EntradaDaSalaParaAConta): Promise<SalaDoLogin>
}

/** O token de injeção da porta: o `SalaModule` a fornece, e o controller do login externo a usa. */
export const SALA_PARA_A_CONTA = Symbol('SALA_PARA_A_CONTA')
