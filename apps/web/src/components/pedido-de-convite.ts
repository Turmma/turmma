/**
 * O pedido de um convite — o nome e o e-mail de quem é convidado —, lido pelo contrato estrito da API antes de sair da
 * tela. Serve ao convite da coordenação, que a operação gera (A0b, tarefa 7.0), e ao do professor, que a coordenação gera
 * (A1, tarefa 14.0): os dois diálogos são o mesmo (`DialogoDoConvite.tsx`), e cada um passa o contrato dele.
 */

/** Os campos que a pessoa digita no convite. */
export type CampoDoConvite = 'nome' | 'email'

/** O nome que não passa no contrato: vazio depois de tirar os espaços, ou longo demais. */
export const TEXTO_DO_NOME_INVALIDO = 'Escreva o nome, com até 200 caracteres.'

/** O e-mail que não passa no contrato do convite (`emailConvidadoSchema`). */
export const TEXTO_DO_EMAIL_INVALIDO = 'Escreva o e-mail inteiro, com @ e o domínio, com até 254 caracteres.'

const TEXTO_DO_CAMPO: Readonly<Record<CampoDoConvite, string>> = { nome: TEXTO_DO_NOME_INVALIDO, email: TEXTO_DO_EMAIL_INVALIDO }

/** O pedido pronto para enviar, ou o texto de cada campo que não passa no contrato. */
export type ValidacaoDoConvite<Pedido> = { readonly ok: true; readonly pedido: Pedido } | { readonly ok: false; readonly erros: Readonly<Partial<Record<CampoDoConvite, string>>> }

/** O mínimo de um esquema zod de `packages/shared` que a validação usa, sem a web depender do zod. */
export interface EsquemaDoPedidoDeConvite<Pedido> {
  safeParse(valor: unknown): { readonly success: true; readonly data: Pedido } | { readonly success: false; readonly error: { readonly issues: ReadonlyArray<{ readonly path: readonly PropertyKey[] }> } }
}

/**
 * O pedido do convite pelo **mesmo** contrato estrito que a API usa: o nome sai sem os espaços das pontas e o e-mail em
 * minúsculas, como o login o procura. O resumo antes de enviar mostra o que sai daqui, e não o que foi digitado. O que o
 * contrato recusa volta com o texto do campo, os dois de uma vez.
 */
export function pedidoDeConvitePelo<Pedido>(esquema: EsquemaDoPedidoDeConvite<Pedido>, campos: { readonly nome: string; readonly email: string }): ValidacaoDoConvite<Pedido> {
  const lido = esquema.safeParse({ nome: campos.nome, email: campos.email })
  if (lido.success) return { ok: true, pedido: lido.data }
  const erros: Partial<Record<CampoDoConvite, string>> = {}
  for (const { path } of lido.error.issues) {
    if (path[0] === 'nome' || path[0] === 'email') erros[path[0]] = TEXTO_DO_CAMPO[path[0]]
  }
  return { ok: false, erros }
}
