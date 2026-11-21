import {
  conviteDaCoordenacaoRequestSchema,
  criarEscolaRequestSchema,
  criarRedeRequestSchema,
  orcamentoDeIaRequestSchema,
  type ConviteDaCoordenacaoRequest,
  type CriarEscolaRequest,
  type CriarRedeRequest,
  type OrcamentoDeIaRequest,
  type TipoDeRede,
} from '@educa/shared'
import { pedidoDeConvitePelo, TEXTO_DO_NOME_INVALIDO, type ValidacaoDoConvite } from '../components/pedido-de-convite'
import { REGRA_DO_ENDERECO, TEXTO_DO_TETO_FORA_DO_INTERVALO, TEXTO_DO_VALOR_FORA_DO_INTERVALO } from './textos'

/**
 * O id do pedido de rede ou de escola (Tech Spec da A0b, seção 5, "Idempotência"). Mora em `components/request-id.ts`, porque o
 * pedido do titular da escola (F3, 16.0) sorteia a chave do mesmo jeito e não pode importar de `operacao/` (B2).
 */
export { newRequestId } from '../components/request-id'

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

/** Os dois campos do `PUT` do orçamento de IA, com o nome que o contrato dá a cada um: é por ele que o texto de cada recusa se acha. */
export type CampoDoOrcamento = keyof OrcamentoDeIaRequest

const TEXTO_DO_CAMPO_DO_ORCAMENTO: Readonly<Record<CampoDoOrcamento, string>> = {
  valorPorAlunoCentavos: TEXTO_DO_VALOR_FORA_DO_INTERVALO,
  tetoDeSegurancaPercentual: TEXTO_DO_TETO_FORA_DO_INTERVALO,
}

/** O valor digitado em reais, com vírgula ou ponto e até duas casas: `4`, `4,5`, `4,00`, `100.00`. */
const FORMATO_DO_VALOR_EM_REAIS = /^\d+(?:[.,]\d{1,2})?$/
const FORMATO_DO_TETO_EM_PERCENTUAL = /^\d+$/

/**
 * O pedido de `PUT /v1/operacao/{escolas|redes}/:id/orcamento-ia` (camada-ia, 7.0), pelo **mesmo** contrato estrito da
 * API: o operador digita reais, e o pedido sai em centavos. `semValor` é a decisão da tela (a escola que usa o valor da
 * rede, a rede que deixou o campo em branco) e manda `null`, sem ler o que está no campo; o teto em branco também é
 * `null`. O que não é número nesse formato vira `NaN`, que o contrato recusa, e o texto é o do campo.
 */
export function pedidoDeOrcamento(campos: { readonly valor: string; readonly teto: string; readonly semValor: boolean }): Validacao<OrcamentoDeIaRequest, CampoDoOrcamento> {
  const valor = campos.valor.trim()
  const teto = campos.teto.trim()
  const centavos = campos.semValor ? null : FORMATO_DO_VALOR_EM_REAIS.test(valor) ? Math.round(Number(valor.replace(',', '.')) * 100) : Number.NaN
  const percentual = teto === '' ? null : FORMATO_DO_TETO_EM_PERCENTUAL.test(teto) ? Number(teto) : Number.NaN
  const lido = orcamentoDeIaRequestSchema.safeParse({ valorPorAlunoCentavos: centavos, tetoDeSegurancaPercentual: percentual })
  if (lido.success) return { ok: true, pedido: lido.data }
  return { ok: false, erros: errosDos(lido.error.issues.map((problema) => problema.path), TEXTO_DO_CAMPO_DO_ORCAMENTO) }
}
