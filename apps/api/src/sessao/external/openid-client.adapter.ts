import type { ProvedorExterno } from '@educa/core'
import * as oidc from 'openid-client'
import type { ConfiguracaoLoginExterno, ProvedorConfigurado } from '../../credencial/external-login-config.js'
import { ProvedorExternoFalhou, type ContaNoProvedor, type ConferenciasDoRetorno, type InicioNoProvedor, type ProvedorExternoPort } from './external-provider.port.js'

/** Prazo de cada operação com o provedor, somando discovery, token e chaves: o login não fica pendurado nele (regra 80). */
export const PRAZO_DO_PROVEDOR_MS = 5_000

/**
 * Escopos pedidos (Tech Spec, seção 5): o Google dá `hd` e o e-mail com `openid email`; a Microsoft só dá o `oid` com
 * `profile`. Sem `offline_access`: não guardamos token do provedor, nem para renovar.
 */
const ESCOPOS: Readonly<Record<ProvedorExterno, string>> = {
  google: 'openid email',
  microsoft: 'openid email profile',
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor !== '' ? valor : undefined
}

/** Recusa a operação que passa do prazo; a requisição por baixo é abortada pelo `timeout` da própria biblioteca. */
async function comPrazo<T>(operacao: Promise<T>, prazoMs: number): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined
  const prazo = new Promise<never>((_, rejeitar) => {
    temporizador = setTimeout(() => rejeitar(new ProvedorExternoFalhou()), prazoMs)
  })
  try {
    return await Promise.race([operacao, prazo])
  } finally {
    clearTimeout(temporizador)
  }
}

/**
 * O adaptador `openid-client` da porta do login externo, contra o Google, a Microsoft ou o `oidc-falso` do compose.
 *
 * - **Discovery e chaves preguiçosos:** buscados na primeira chamada de cada provedor, e não no boot: o provedor fora do
 *   ar não impede a API de subir. Uma busca por vez por provedor (as chamadas juntas esperam a mesma promessa), e falha
 *   nunca fica guardada: a promessa que falhou sai, e a próxima chamada busca de novo.
 * - **Prazo:** 5 s por operação e por requisição da biblioteca (`timeout`). Passou, é falha do provedor, e a pessoa
 *   volta à tela da escola com a matrícula e o e-mail de pé (regra 80, item 4, por analogia).
 * - **Conferência:** assinatura, emissor, público e validade do ID token, `state`, `nonce` e PKCE, pela biblioteca.
 *   Na Microsoft, a biblioteca aceita o emissor de qualquer tenant (`{tenantid}`); a lista de tenants aceitos é da escola,
 *   conferida no serviço.
 * - **Nada sai daqui:** tokens e claims ficam neste método. O erro da biblioteca, que pode trazer o corpo da resposta,
 *   vira `ProvedorExternoFalhou`, sem causa e sem mensagem do provedor.
 */
export class OpenIdClientAdapter implements ProvedorExternoPort {
  readonly ligados: readonly ProvedorExterno[]
  readonly #configuracoes = new Map<ProvedorExterno, Promise<oidc.Configuration>>()

  constructor(
    private readonly configuracao: ConfiguracaoLoginExterno,
    private readonly prazoMs: number = PRAZO_DO_PROVEDOR_MS,
  ) {
    this.ligados = [...configuracao.provedores.keys()]
  }

  async iniciar(provedor: ProvedorExterno): Promise<InicioNoProvedor> {
    const { retorno } = this.configuracao
    if (retorno === undefined) throw new ProvedorExternoFalhou()
    return comPrazo(
      (async () => {
        const configuracao = await this.#configuracaoDe(provedor)
        const verificador = oidc.randomPKCECodeVerifier()
        const state = oidc.randomState()
        const nonce = oidc.randomNonce()
        const endereco = oidc.buildAuthorizationUrl(configuracao, {
          redirect_uri: retorno.href,
          scope: ESCOPOS[provedor],
          response_type: 'code',
          code_challenge: await oidc.calculatePKCECodeChallenge(verificador),
          code_challenge_method: 'S256',
          state,
          nonce,
        })
        return { endereco, state, nonce, verificador }
      })().catch(() => {
        throw new ProvedorExternoFalhou()
      }),
      this.prazoMs,
    )
  }

  async concluir(provedor: ProvedorExterno, retorno: URL, conferencias: ConferenciasDoRetorno): Promise<ContaNoProvedor> {
    return comPrazo(
      (async () => {
        const configuracao = await this.#configuracaoDe(provedor)
        const tokens = await oidc.authorizationCodeGrant(configuracao, retorno, {
          pkceCodeVerifier: conferencias.verificador,
          expectedState: conferencias.state,
          expectedNonce: conferencias.nonce,
          idTokenExpected: true,
        })
        return this.#conta(provedor, tokens.claims())
      })().catch(() => {
        throw new ProvedorExternoFalhou()
      }),
      this.prazoMs,
    )
  }

  /** Só o que o login usa. Sem identificador estável, a conta não serve, e é falha. */
  #conta(provedor: ProvedorExterno, claims: oidc.IDToken | undefined): ContaNoProvedor {
    if (claims === undefined) throw new ProvedorExternoFalhou()
    const email = texto(claims['email'])
    if (provedor === 'google') {
      const sujeito = texto(claims.sub)
      if (sujeito === undefined) throw new ProvedorExternoFalhou()
      return { provedor, sujeito, tenant: null, dominio: texto(claims['hd'])?.toLowerCase(), email, emailVerificado: claims['email_verified'] === true }
    }
    const sujeito = texto(claims['oid'])?.toLowerCase()
    const tenant = texto(claims['tid'])?.toLowerCase()
    if (sujeito === undefined || tenant === undefined) throw new ProvedorExternoFalhou()
    // Na Microsoft não há `email_verified`: o que valida o e-mail é o tenant conferido contra a lista da escola.
    return { provedor, sujeito, tenant, dominio: tenant, email, emailVerificado: false }
  }

  #configuracaoDe(provedor: ProvedorExterno): Promise<oidc.Configuration> {
    const guardada = this.#configuracoes.get(provedor)
    if (guardada !== undefined) return guardada
    const dados = this.configuracao.provedores.get(provedor)
    if (dados === undefined) return Promise.reject(new ProvedorExternoFalhou())
    const busca = this.#descobrir(dados)
    this.#configuracoes.set(provedor, busca)
    // Falha não fica em cache: a promessa sai, e a próxima chamada busca de novo.
    busca.catch(() => {
      if (this.#configuracoes.get(provedor) === busca) this.#configuracoes.delete(provedor)
    })
    return busca
  }

  #descobrir(dados: ProvedorConfigurado): Promise<oidc.Configuration> {
    return oidc.discovery(dados.emissor, dados.clienteId, dados.segredoCliente, undefined, {
      timeout: Math.ceil(this.prazoMs / 1_000),
      execute: this.configuracao.aceitaEmissorSemTls && dados.emissor.protocol === 'http:' ? [oidc.allowInsecureRequests] : [],
    })
  }
}
