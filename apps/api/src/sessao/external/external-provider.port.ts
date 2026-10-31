import type { ProvedorExterno } from '@educa/core'

/** Os valores aleatórios do início, que o retorno confere: o `state`, o `nonce` e o verificador do PKCE. */
export interface ConferenciasDoRetorno {
  readonly state: string
  readonly nonce: string
  readonly verificador: string
}

/** O que o início gera e guarda no cookie, e o endereço do provedor para onde o navegador vai. */
export interface InicioNoProvedor extends ConferenciasDoRetorno {
  readonly endereco: URL
}

/**
 * O que o login precisa saber da conta, tirado do ID token assinado e conferido (Tech Spec, seção 5). Todo o resto das
 * claims, e os tokens, ficam dentro do adaptador e somem com ele.
 *
 * - `sujeito` e `tenant`: a chave da ligação. `sub` e nenhum tenant no Google; `oid` e `tid` na Microsoft.
 * - `dominio`: o que a escola cadastra. O `hd` no Google (conta gmail.com vem sem ele); o `tid` na Microsoft.
 * - `email`: só para ligar o professor no primeiro login, na memória desta requisição. Nunca vai ao banco, ao log nem
 *   a uma exceção. Com `emailVerificado`, que no Google é a claim `email_verified`; na Microsoft, o `tid` conferido
 *   contra a escola é o que o valida (Tech Spec, seção 5).
 */
export interface ContaNoProvedor {
  readonly provedor: ProvedorExterno
  readonly sujeito: string
  readonly tenant: string | null
  readonly dominio: string | undefined
  readonly email: string | undefined
  readonly emailVerificado: boolean
}

/** O provedor não respondeu a tempo, respondeu com erro, ou a resposta não conferiu. Sem detalhe: nada do provedor sai daqui. */
export class ExternalProviderError extends Error {
  constructor() {
    super('login externo: o provedor falhou ou a resposta não conferiu')
    this.name = 'ExternalProviderError'
  }
}

/**
 * A porta do login pela conta da escola (regra 00, item 7): o serviço de login não conhece a biblioteca de OAuth nem o
 * provedor. O adaptador de produção é o `openid-client`, contra o Google, a Microsoft ou o `oidc-falso` do compose.
 */
export interface ExternalProviderPort {
  /** Os provedores ligados na configuração. */
  readonly ligados: readonly ProvedorExterno[]
  /** Gera `state`, `nonce` e o verificador do PKCE e monta o endereço do provedor. Falha com `ExternalProviderError`. */
  iniciar(provedor: ProvedorExterno): Promise<InicioNoProvedor>
  /**
   * Troca o código do retorno pelos tokens, confere a assinatura, o emissor, o público, o `state`, o `nonce` e o PKCE, e
   * devolve só o que o login usa. Falha com `ExternalProviderError`.
   */
  concluir(provedor: ProvedorExterno, retorno: URL, conferencias: ConferenciasDoRetorno): Promise<ContaNoProvedor>
}
