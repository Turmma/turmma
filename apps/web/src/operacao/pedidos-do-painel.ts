import {
  conviteDaCoordenacaoRequestSchema,
  criarEscolaRequestSchema,
  criarRedeRequestSchema,
  type ConviteDaCoordenacaoRequest,
  type CriarEscolaRequest,
  type CriarRedeRequest,
  type TipoDeRede,
} from '@educa/shared'
import { pedidoDeConvitePelo, TEXTO_DO_NOME_INVALIDO, type ValidacaoDoConvite } from '../componentes/pedido-de-convite'
import { REGRA_DO_ENDERECO } from './textos'

/**
 * O id do pedido de rede ou de escola (Tech Spec da A0b, seção 5, "Idempotência"). Mora em `componentes/id-do-pedido.ts`, porque o
 * pedido do titular da escola (F3, 16.0) sorteia a chave do mesmo jeito e não pode importar de `operacao/` (B2).
 */
export { sortearIdDoPedido } from '../componentes/id-do-pedido'

/** O pedido pronto para enviar, ou o texto de cada campo que não passa no contrato. */
export type Validacao<Pedido, Campo extends string> = { readonly ok: true; readonly pedido: Pedido } | { readonly ok: false; readonly erros: Readonly<Partial<Record<Campo, string>>> }

export type CampoDaRede = 'nome'
export type CampoDaEscola = 'redeId' | 'nome' | 'slug'

const TEXTO_DO_CAMPO_DA_REDE: Readonly<Record<CampoDaRede, string>> = { nome: TEXTO_DO_NOME_INVALIDO }

const TEXTO_DO_CAMPO_DA_ESCOLA: Readonly<Record<CampoDaEscola, string>> = {
  redeId: 'Escolha a rede da escola.',
  nome: TEXTO_DO_NOME_INVALIDO,
  slug: REGRA_DO_ENDERECO,
}

/**
 * Os campos que o contrato recusou, com o texto de cada um. Só os campos digitados têm texto: o id e o tipo vêm da tela,
 * nunca do que se digitou.
 */
function errosDos<Campo extends string>(caminhos: readonly (readonly PropertyKey[])[], textos: Readonly<Record<Campo, string>>): Partial<Record<Campo, string>> {
  const erros: Partial<Record<Campo, string>> = {}
  const campos = Object.keys(textos) as Campo[]
  for (const caminho of caminhos) {
    const campo = campos.find((nome) => nome === caminho[0])
    if (campo !== undefined) erros[campo] = textos[campo]
  }
  return erros
}

/**
 * O pedido de `POST /v1/operacao/redes`, lido pelo **mesmo** contrato estrito que a API usa: o que sai daqui é o que o
 * servidor aceita, e o nome vai sem os espaços das pontas. É isso que faz a nova tentativa mandar os mesmos dados com o
 * mesmo id — com o nome cru, " Rede X" e "Rede X" seriam dois pedidos diferentes para o mesmo id, e a segunda tentativa
 * voltaria `CONFLITO`.
 */
export function pedidoDeRede(id: string, campos: { readonly nome: string; readonly tipo: TipoDeRede }): Validacao<CriarRedeRequest, CampoDaRede> {
  const lido = criarRedeRequestSchema.safeParse({ id, nome: campos.nome, tipo: campos.tipo })
  if (lido.success) return { ok: true, pedido: lido.data }
  return { ok: false, erros: errosDos(lido.error.issues.map((problema) => problema.path), TEXTO_DO_CAMPO_DA_REDE) }
}

/** O pedido de `POST /v1/operacao/escolas`, pelo mesmo contrato da API, como o da rede. */
export function pedidoDeEscola(id: string, campos: { readonly redeId: string; readonly nome: string; readonly slug: string }): Validacao<CriarEscolaRequest, CampoDaEscola> {
  const lido = criarEscolaRequestSchema.safeParse({ id, redeId: campos.redeId, nome: campos.nome, slug: campos.slug.trim() })
  if (lido.success) return { ok: true, pedido: lido.data }
  return { ok: false, erros: errosDos(lido.error.issues.map((problema) => problema.path), TEXTO_DO_CAMPO_DA_ESCOLA) }
}

/**
 * O pedido de `POST /v1/operacao/escolas/:id/convite-coordenacao` (tarefa 7.0), pelo mesmo contrato estrito da API: o
 * nome sem os espaços das pontas e o e-mail em minúsculas, como o login o procura. O resumo antes de gerar mostra o que
 * sai daqui, e não o que foi digitado. A leitura é a do diálogo de convite, que a escola também usa (A1, 14.0).
 */
export function pedidoDeConvite(campos: { readonly nome: string; readonly email: string }): ValidacaoDoConvite<ConviteDaCoordenacaoRequest> {
  return pedidoDeConvitePelo(conviteDaCoordenacaoRequestSchema, campos)
}
