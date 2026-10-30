import { PROVEDORES_EXTERNOS, type Ambiente, type ProvedorExterno } from '@educa/nucleo'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { InvariantException } from '@educa/shared'
import { serializarCookie } from '../../credencial/cookies.js'

/** O cookie do login pela conta da escola em andamento, do `iniciar` ao `retorno`. */
export const COOKIE_OIDC = 'educa_oidc'
/** Só as rotas do login externo recebem o cookie. */
export const CAMINHO_DO_COOKIE_OIDC = '/v1/sessao/externa'
/** Quanto tempo a pessoa tem para entrar no Google ou na Microsoft e voltar. */
export const VALIDADE_DO_COOKIE_OIDC_SEGUNDOS = 300
/** Relógio de outra instância um pouco adiantado não invalida o cookie que ela acabou de emitir. */
const TOLERANCIA_DE_RELOGIO_MS = 30_000

const BYTES_DO_IV = 12
const BYTES_DA_ETIQUETA = 16
/** Dado autenticado da cifra: o mesmo texto cifrado não vale como outra coisa, e a versão troca junto com o formato. */
const DADO_AUTENTICADO = Buffer.from('educa_oidc|v1', 'utf8')

/**
 * O que o `iniciar` guarda para o `retorno` conferir (Tech Spec, seção 5, "Externo"). A escola vem daqui, e nunca da
 * query do retorno (regra 10, item 3). Nada de pessoa: a escola, o endereço dela e os valores aleatórios do OAuth.
 */
export interface LoginExternoEmAndamento {
  readonly escolaId: string
  readonly slug: string
  readonly provedor: ProvedorExterno
  readonly state: string
  readonly nonce: string
  readonly verificador: string
}

const aleatorio = z.string().regex(/^[\w-]{16,128}$/)

const esquemaDoConteudo = z
  .object({
    escolaId: z.uuid(),
    slug: z.string().min(1).max(64),
    provedor: z.enum(PROVEDORES_EXTERNOS),
    state: aleatorio,
    nonce: aleatorio,
    verificador: aleatorio,
    emitidoEm: z.number().int().nonnegative(),
  })
  .strict()

/**
 * O cookie `educa_oidc` (Tech Spec, seção 5): AES-256-GCM, com a data de emissão dentro, e por isso vale só 5 minutos
 * mesmo que o navegador o guarde mais (o `Max-Age` é do navegador, e quem manda o cookie é o cliente). Qualquer byte
 * alterado, chave de outra instalação, formato estranho ou prazo vencido dão `undefined`, e o retorno responde como
 * falha do provedor.
 *
 * - **`SameSite=Lax`:** a volta do Google ou da Microsoft é uma navegação iniciada por outro site, e só o `Lax` vai nela.
 *   `HttpOnly`, e `Secure` fora do local, como os outros cookies de sessão.
 * - **Uso único:** o retorno sempre o apaga, entrando ou não.
 */
export class CookieOidc {
  constructor(
    private readonly chave: Uint8Array,
    private readonly ambiente: Ambiente,
    private readonly agora: () => number = Date.now,
  ) {
    if (chave.length !== 32) throw new InvariantException('a chave do cookie do login externo precisa de 256 bits')
  }

  /** O `Set-Cookie` com o login em andamento cifrado. */
  gravar(emAndamento: LoginExternoEmAndamento): string {
    const iv = randomBytes(BYTES_DO_IV)
    const cifra = createCipheriv('aes-256-gcm', this.chave, iv, { authTagLength: BYTES_DA_ETIQUETA })
    cifra.setAAD(DADO_AUTENTICADO)
    const conteudo = JSON.stringify({ ...emAndamento, emitidoEm: this.agora() })
    const texto = Buffer.concat([cifra.update(conteudo, 'utf8'), cifra.final()])
    const valor = Buffer.concat([iv, cifra.getAuthTag(), texto]).toString('base64url')
    return serializarCookie(COOKIE_OIDC, valor, { ambiente: this.ambiente, maxAgeSegundos: VALIDADE_DO_COOKIE_OIDC_SEGUNDOS, sameSite: 'Lax', caminho: CAMINHO_DO_COOKIE_OIDC })
  }

  /** O `Set-Cookie` que apaga o cookie no navegador. */
  apagar(): string {
    return serializarCookie(COOKIE_OIDC, '', { ambiente: this.ambiente, maxAgeSegundos: 0, sameSite: 'Lax', caminho: CAMINHO_DO_COOKIE_OIDC })
  }

  /** O login em andamento, ou `undefined` se o cookie não existe, não decifra, está fora do formato ou venceu. */
  ler(valor: string | undefined): LoginExternoEmAndamento | undefined {
    if (valor === undefined || valor === '') return undefined
    const bytes = Buffer.from(valor, 'base64url')
    if (bytes.length <= BYTES_DO_IV + BYTES_DA_ETIQUETA) return undefined
    let conteudo: unknown
    try {
      const decifra = createDecipheriv('aes-256-gcm', this.chave, bytes.subarray(0, BYTES_DO_IV), { authTagLength: BYTES_DA_ETIQUETA })
      decifra.setAAD(DADO_AUTENTICADO)
      decifra.setAuthTag(bytes.subarray(BYTES_DO_IV, BYTES_DO_IV + BYTES_DA_ETIQUETA))
      const texto = Buffer.concat([decifra.update(bytes.subarray(BYTES_DO_IV + BYTES_DA_ETIQUETA)), decifra.final()])
      conteudo = JSON.parse(texto.toString('utf8'))
    } catch {
      return undefined
    }
    const lido = esquemaDoConteudo.safeParse(conteudo)
    if (!lido.success) return undefined
    const { emitidoEm, ...emAndamento } = lido.data
    const idade = this.agora() - emitidoEm
    if (idade > VALIDADE_DO_COOKIE_OIDC_SEGUNDOS * 1_000 || idade < -TOLERANCIA_DE_RELOGIO_MS) return undefined
    return emAndamento
  }
}
