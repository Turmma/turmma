import { PROVEDORES_EXTERNOS, type Environment, type ProvedorExterno } from '@educa/core'
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
  /** O acesso vigente da sala, só no `iniciar` com `intencao=reivindicar` (14.0): é ele que o cookie da conta provada prende. */
  readonly acessoDaSalaId?: string | undefined
  /**
   * O aluno com sessão que liga a conta da escola em "Eu" (`intencao=ligar`, 15.0): o usuário e a sessão que o `iniciar` achou pelo cookie de renovação. O retorno
   * volta de outro site, e o `educa_sessao` (`SameSite=Strict`) não vai nele: é por aqui que ele sabe quem liga, e confere de novo que a sessão vale.
   */
  readonly ligarAoAluno?: { readonly usuarioId: string; readonly sessaoId: string } | undefined
}

const aleatorio = z.string().regex(/^[\w-]{16,128}$/)

const conteudoSchema = z
  .object({
    escolaId: z.uuid(),
    slug: z.string().min(1).max(64),
    provedor: z.enum(PROVEDORES_EXTERNOS),
    state: aleatorio,
    nonce: aleatorio,
    verificador: aleatorio,
    acessoDaSalaId: z.uuid().optional(),
    ligarAoAluno: z.strictObject({ usuarioId: z.uuid(), sessaoId: z.uuid() }).optional(),
    emitidoEm: z.number().int().nonnegative(),
  })
  .strict()

/** Cifra o conteúdo em AES-256-GCM: `iv | etiqueta | texto`, em base64url, com o dado autenticado que separa um cookie do outro. */
function cifrar(chave: Uint8Array, dadoAutenticado: Buffer, conteudo: object): string {
  const iv = randomBytes(BYTES_DO_IV)
  const cifra = createCipheriv('aes-256-gcm', chave, iv, { authTagLength: BYTES_DA_ETIQUETA })
  cifra.setAAD(dadoAutenticado)
  const texto = Buffer.concat([cifra.update(JSON.stringify(conteudo), 'utf8'), cifra.final()])
  return Buffer.concat([iv, cifra.getAuthTag(), texto]).toString('base64url')
}

/** O conteúdo decifrado, ou `undefined` se o valor falta, não decifra (byte alterado, chave de outra instalação, dado autenticado de outro cookie) ou não é JSON. */
function decifrar(chave: Uint8Array, dadoAutenticado: Buffer, valor: string | undefined): unknown {
  if (valor === undefined || valor === '') return undefined
  const bytes = Buffer.from(valor, 'base64url')
  if (bytes.length <= BYTES_DO_IV + BYTES_DA_ETIQUETA) return undefined
  try {
    const decifra = createDecipheriv('aes-256-gcm', chave, bytes.subarray(0, BYTES_DO_IV), { authTagLength: BYTES_DA_ETIQUETA })
    decifra.setAAD(dadoAutenticado)
    decifra.setAuthTag(bytes.subarray(BYTES_DO_IV, BYTES_DO_IV + BYTES_DA_ETIQUETA))
    return JSON.parse(Buffer.concat([decifra.update(bytes.subarray(BYTES_DO_IV + BYTES_DA_ETIQUETA)), decifra.final()]).toString('utf8'))
  } catch {
    return undefined
  }
}

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
    private readonly ambiente: Environment,
    private readonly agora: () => number = Date.now,
  ) {
    if (chave.length !== 32) throw new InvariantException('a chave do cookie do login externo precisa de 256 bits')
  }

  /** O `Set-Cookie` com o login em andamento cifrado. */
  gravar(emAndamento: LoginExternoEmAndamento): string {
    const valor = cifrar(this.chave, DADO_AUTENTICADO, { ...emAndamento, emitidoEm: this.agora() })
    return serializarCookie(COOKIE_OIDC, valor, { ambiente: this.ambiente, maxAgeSegundos: VALIDADE_DO_COOKIE_OIDC_SEGUNDOS, sameSite: 'Lax', caminho: CAMINHO_DO_COOKIE_OIDC })
  }

  /** O `Set-Cookie` que apaga o cookie no navegador. */
  apagar(): string {
    return serializarCookie(COOKIE_OIDC, '', { ambiente: this.ambiente, maxAgeSegundos: 0, sameSite: 'Lax', caminho: CAMINHO_DO_COOKIE_OIDC })
  }

  /** O login em andamento, ou `undefined` se o cookie não existe, não decifra, está fora do formato ou venceu. */
  ler(valor: string | undefined): LoginExternoEmAndamento | undefined {
    const conteudo = decifrar(this.chave, DADO_AUTENTICADO, valor)
    if (conteudo === undefined) return undefined
    const lido = conteudoSchema.safeParse(conteudo)
    if (!lido.success) return undefined
    const { emitidoEm, ...emAndamento } = lido.data
    const idade = this.agora() - emitidoEm
    if (idade > VALIDADE_DO_COOKIE_OIDC_SEGUNDOS * 1_000 || idade < -TOLERANCIA_DE_RELOGIO_MS) return undefined
    return emAndamento
  }
}

/** O cookie da conta da escola que o aluno provou na sala (14.0): do retorno do login até o pedido do nome. */
export const COOKIE_CONTA_PROVADA = 'educa_conta_provada'
/** Só as rotas da sala recebem o cookie: o pedido do nome é `POST /v1/salas/reivindicar`. */
export const CAMINHO_DO_COOKIE_CONTA_PROVADA = '/v1/salas'
/** Quanto tempo o aluno tem, depois de provar a conta, para escolher o nome e enviar o pedido. */
export const VALIDADE_DO_COOKIE_CONTA_PROVADA_SEGUNDOS = 900
const DADO_AUTENTICADO_CONTA_PROVADA = Buffer.from('educa_conta_provada|v1', 'utf8')

/**
 * A conta que o aluno provou: a escola e o acesso da sala a que ela vale, e o identificador opaco da conta no provedor. Nunca o
 * e-mail, o nome nem a foto (regra 20, item 2). O pedido confere a escola e o acesso contra os da sala em que chega.
 */
export interface ContaProvada {
  readonly escolaId: string
  readonly acessoId: string
  readonly provedor: ProvedorExterno
  readonly tenant: string | null
  readonly sujeito: string
}

const contaProvadaSchema = z
  .object({
    escolaId: z.uuid(),
    acessoId: z.uuid(),
    provedor: z.enum(PROVEDORES_EXTERNOS),
    tenant: z.string().min(1).max(255).nullable(),
    sujeito: z.string().min(1).max(255),
    emitidoEm: z.number().int().nonnegative(),
  })
  .strict()

/**
 * O cookie `educa_conta_provada` (Tech Spec, seção 5, "Conta da escola do aluno"): como o `educa_oidc` (AES-256-GCM, a data de
 * emissão dentro, `HttpOnly`, `SameSite=Lax`, `Secure` fora do local), mas com dado autenticado próprio — um não vale como o
 * outro, mesmo com a mesma chave —, só para `/v1/salas` e por 15 minutos. O pedido do nome o apaga ao gravar.
 */
export class CookieContaProvada {
  constructor(
    private readonly chave: Uint8Array,
    private readonly ambiente: Environment,
    private readonly agora: () => number = Date.now,
  ) {
    if (chave.length !== 32) throw new InvariantException('a chave do cookie da conta provada precisa de 256 bits')
  }

  /** O `Set-Cookie` com a conta provada cifrada. */
  gravar(conta: ContaProvada): string {
    const valor = cifrar(this.chave, DADO_AUTENTICADO_CONTA_PROVADA, { ...conta, emitidoEm: this.agora() })
    return serializarCookie(COOKIE_CONTA_PROVADA, valor, { ambiente: this.ambiente, maxAgeSegundos: VALIDADE_DO_COOKIE_CONTA_PROVADA_SEGUNDOS, sameSite: 'Lax', caminho: CAMINHO_DO_COOKIE_CONTA_PROVADA })
  }

  /** O `Set-Cookie` que apaga o cookie no navegador. */
  apagar(): string {
    return serializarCookie(COOKIE_CONTA_PROVADA, '', { ambiente: this.ambiente, maxAgeSegundos: 0, sameSite: 'Lax', caminho: CAMINHO_DO_COOKIE_CONTA_PROVADA })
  }

  /** A conta provada, ou `undefined` se o cookie não existe, não decifra, está fora do formato ou venceu. */
  ler(valor: string | undefined): ContaProvada | undefined {
    const conteudo = decifrar(this.chave, DADO_AUTENTICADO_CONTA_PROVADA, valor)
    if (conteudo === undefined) return undefined
    const lido = contaProvadaSchema.safeParse(conteudo)
    if (!lido.success) return undefined
    const { emitidoEm, ...conta } = lido.data
    const idade = this.agora() - emitidoEm
    if (idade > VALIDADE_DO_COOKIE_CONTA_PROVADA_SEGUNDOS * 1_000 || idade < -TOLERANCIA_DE_RELOGIO_MS) return undefined
    return conta
  }
}
