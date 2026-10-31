import { ErrorCode } from '@educa/shared'
import { decodeProtectedHeader, errors, jwtVerify } from 'jose'
import { z } from 'zod'
import { EMISSOR_TOKEN, type AuthConfig } from '../config/validate-config.js'
import { DomainException } from '../error/domain.exception.js'

/** Quem fez a requisição. Só ids: o token não carrega nome, papel nem nada da pessoa (regra 20). */
export interface Identity {
  readonly escolaId: string
  readonly usuarioId: string
}

// Marca só de tipo, sem valor em execução: o objeto tem só os três ids.
declare const MARCA_DO_TOKEN_VERIFICADO: unique symbol

/**
 * O que um JWT com assinatura, emissor, tipo e prazo conferidos diz: a escola, o usuário e a sessão. Só o
 * `verifyToken` produz este tipo, e é só com ele que a guarda lê a sessão: nenhum id que o cliente mande em
 * query, corpo ou cabeçalho vira escopo (regra 10, item 3).
 *
 * Verificado não quer dizer válido: a sessão ainda pode estar encerrada, ou o usuário desativado. Quem decide é a
 * `SessaoGuard`, que lê a sessão por `(escolaId, sessaoId)`.
 */
export interface VerifiedToken extends Identity {
  readonly sessaoId: string
  /**
   * O `iat` do token, em segundos. A `SessaoGuard` o compara com `sessao.rotacionado_em` para saber se o token é o
   * que a última renovação emitiu (Tech Spec, seção 5, "Renovar"). Ausente num token sem `iat`, que nunca conta.
   */
  readonly emitidoEm?: number
  readonly [MARCA_DO_TOKEN_VERIFICADO]: true
}

export const ALGORITMO_TOKEN = 'HS256'
export const TIPO_TOKEN = 'JWT'
/**
 * O `typ` do desafio de login (Tech Spec, seção 4): o JWT de 5 min que leva de uma etapa do login à seguinte, sem
 * sessão. A verificação deste arquivo o recusa; só as rotas de etapa, na API, o aceitam.
 */
export const TIPO_DESAFIO = 'desafio+jwt'

/**
 * Prazo máximo que um token pode ter pela frente. Vale na verificação, e não só no emissor: um
 * token assinado com validade de anos é recusado mesmo com assinatura certa.
 */
export const VALIDADE_MAXIMA_TOKEN_SEGUNDOS = 24 * 60 * 60

const esquemaClaims = z.object({
  sub: z.uuid(),
  esc: z.uuid(),
  sid: z.uuid(),
  exp: z.number(),
  iat: z.number().optional(),
})

/** Toda recusa é a mesma: quem manda um token meio válido não descobre qual parte falhou. */
function naoAutenticado(): DomainException {
  return new DomainException(ErrorCode.NAO_AUTENTICADO)
}

/**
 * Verifica o JWT de acesso e devolve a escola, o usuário e a sessão dele. Recusa com `NAO_AUTENTICADO` o token
 * com assinatura que não confere, algoritmo diferente de HS256, `typ` diferente de `JWT` (o desafio de login,
 * `desafio+jwt`, não passa por aqui), sem `exp`, vencido ou com mais de 24 h pela frente, de emissor diferente
 * de `educa`, ou com `sub`, `esc` e `sid` ausentes ou fora do formato UUID.
 *
 * O emissor é constante, não configuração: não há variável de ambiente que faça a API aceitar um segundo
 * emissor. Token assinado com a mesma chave e outro `iss` é recusado em qualquer ambiente.
 *
 * Os ids saem em minúsculas: a mesma escola escrita com letra maiúscula não pode virar outra
 * chave de limite, de sessão ou de sala mais adiante.
 */
export async function verifyToken(token: string, config: AuthConfig): Promise<VerifiedToken> {
  let claims: unknown
  try {
    const verificado = await jwtVerify(token, config.chaveAssinatura, {
      algorithms: [ALGORITMO_TOKEN],
      typ: TIPO_TOKEN,
      issuer: EMISSOR_TOKEN,
      requiredClaims: ['exp', 'sub', 'esc', 'sid'],
    })
    claims = verificado.payload
  } catch (erro) {
    if (erro instanceof errors.JOSEError) throw naoAutenticado()
    throw erro
  }
  const resultado = esquemaClaims.safeParse(claims)
  if (!resultado.success) throw naoAutenticado()
  if (resultado.data.exp - Date.now() / 1000 > VALIDADE_MAXIMA_TOKEN_SEGUNDOS) throw naoAutenticado()
  const ids = {
    escolaId: resultado.data.esc.toLowerCase(),
    usuarioId: resultado.data.sub.toLowerCase(),
    sessaoId: resultado.data.sid.toLowerCase(),
    ...(resultado.data.iat === undefined ? {} : { emitidoEm: resultado.data.iat }),
  }
  return ids as VerifiedToken
}

// Três partes base64url. Nada além disso é lido do cabeçalho.
const FORMATO_BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i

/** Tira o token do cabeçalho `Authorization: Bearer <token>`, ou recusa com `NAO_AUTENTICADO`. */
export function extractBearerToken(cabecalho: string | string[] | undefined): string {
  const token = typeof cabecalho === 'string' ? FORMATO_BEARER.exec(cabecalho)?.[1] : undefined
  if (token === undefined) throw naoAutenticado()
  return token
}

/**
 * O `typ` do token de acesso do operador Turmma (Tech Spec da A0, seção 1): o JWT de 10 min da área da operação, sem
 * `esc`. O `verifyToken` da escola o recusa pelo `typ`, e a `AuthGuard` responde a ele, numa rota de
 * escola, igual a uma rota inexistente.
 */
export const TIPO_TOKEN_DE_OPERADOR = 'operador+jwt'

/**
 * O `typ` do desafio do operador (Tech Spec da A0, seção 4): o JWT de 5 min que leva do aceite do convite, e da entrada
 * por e-mail, ao segundo fator, sem sessão. Só as rotas de entrada da operação o aceitam, e só no corpo da etapa dela;
 * como bearer, ele não vale em rota nenhuma: o `verifyToken` da escola e o `verifyOperadorToken` o recusam pelo
 * `typ`, e a `AuthGuard` responde a ele, numa rota de escola, igual a uma rota inexistente (C21, C47).
 */
export const TIPO_DESAFIO_DE_OPERADOR = 'desafio-operador+jwt'

// Marca só de tipo, como a do token da escola.
declare const MARCA_DO_TOKEN_DE_OPERADOR: unique symbol

/**
 * O que um token de operador com assinatura, emissor, `typ` e claims conferidos diz: o operador e a sessão dele, e se
 * o prazo de 10 min já passou. Só o `verifyOperadorToken` produz este tipo.
 *
 * Vencido não quer dizer recusado: a `GuardaDeOperador` lê a sessão e responde `ACESSO_VENCIDO` quando ela está viva
 * (a web renova) e `SESSAO_ENCERRADA` quando não está. O limite `rl:op` também conta o vencido, porque ele também
 * chega ao Postgres.
 */
export interface VerifiedOperadorToken {
  readonly operadorId: string
  readonly sessaoId: string
  readonly vencido: boolean
  readonly [MARCA_DO_TOKEN_DE_OPERADOR]: true
}

const claimsDeOperadorSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  exp: z.number(),
  iat: z.number().optional(),
  // Token de operador não tem escola: um `esc` nele é token forjado ou de outro emissor, e é recusado.
  esc: z.never().optional(),
})

async function claimsDeOperador(token: string, config: AuthConfig, currentDate?: Date): Promise<unknown> {
  const verificado = await jwtVerify(token, config.chaveAssinatura, {
    algorithms: [ALGORITMO_TOKEN],
    typ: TIPO_TOKEN_DE_OPERADOR,
    issuer: EMISSOR_TOKEN,
    requiredClaims: ['exp', 'sub', 'sid'],
    ...(currentDate === undefined ? {} : { currentDate }),
  })
  return verificado.payload
}

/**
 * Verifica o token de acesso do operador e devolve o operador e a sessão, com `vencido` quando só o prazo passou.
 * Recusa com `NAO_AUTENTICADO` o token com assinatura que não confere, algoritmo diferente de HS256, `typ` diferente
 * de `operador+jwt` (o da escola, `JWT`, e os desafios não passam), sem `exp`, com mais de 24 h pela frente, de
 * emissor diferente de `educa`, com `esc`, ou com `sub` e `sid` ausentes ou fora do formato UUID.
 *
 * O vencido é conferido de novo inteiro na véspera do `exp`: só é "vencido" o token em que **tudo o mais** confere, e
 * nenhuma outra falha se esconde atrás do prazo.
 */
export async function verifyOperadorToken(token: string, config: AuthConfig): Promise<VerifiedOperadorToken> {
  let claims: unknown
  let vencido = false
  try {
    claims = await claimsDeOperador(token, config)
  } catch (erro) {
    if (erro instanceof errors.JWTExpired && typeof erro.payload.exp === 'number') {
      try {
        claims = await claimsDeOperador(token, config, new Date((erro.payload.exp - 1) * 1_000))
        vencido = true
      } catch (novoErro) {
        if (novoErro instanceof errors.JOSEError) throw naoAutenticado()
        throw novoErro
      }
    } else if (erro instanceof errors.JOSEError) {
      throw naoAutenticado()
    } else {
      throw erro
    }
  }
  const resultado = claimsDeOperadorSchema.safeParse(claims)
  if (!resultado.success) throw naoAutenticado()
  if (resultado.data.exp - Date.now() / 1000 > VALIDADE_MAXIMA_TOKEN_SEGUNDOS) throw naoAutenticado()
  const verificado = { operadorId: resultado.data.sub.toLowerCase(), sessaoId: resultado.data.sid.toLowerCase(), vencido }
  return verificado as VerifiedOperadorToken
}

/** Os `typ` da área da operação: o token de acesso e o desafio do operador. */
const TIPOS_DA_OPERACAO: readonly unknown[] = [TIPO_TOKEN_DE_OPERADOR, TIPO_DESAFIO_DE_OPERADOR]

/**
 * Se o bearer do cabeçalho diz, no cabeçalho do JWT, ser uma credencial da operação: o token de acesso ou o desafio do
 * operador. Não verifica nada: só separa o caminho.
 */
export function operadorBearer(cabecalho: string | string[] | undefined): boolean {
  try {
    return TIPOS_DA_OPERACAO.includes(decodeProtectedHeader(extractBearerToken(cabecalho)).typ)
  } catch {
    return false
  }
}

/**
 * O cookie de renovação da sessão do operador Turmma (Tech Spec da A0, seção 4). Ele vive em `/v1/operacao/sessao`, e
 * o navegador não o manda a rota de escola; quem o manda assim montou a requisição à mão.
 */
export const COOKIE_SESSAO_DE_OPERADOR = 'turmma_operacao'

/**
 * Se o cabeçalho `Cookie` traz o cookie de sessão do operador. Não confere o valor: só separa o caminho, como o
 * `operadorBearer`. O cookie de dispositivo do operador (`turmma_operacao_dispositivo`) não conta: ele não é
 * credencial de nada.
 */
export function operadorCookie(cabecalho: string | undefined): boolean {
  if (cabecalho === undefined) return false
  return cabecalho.split(';').some((parte) => {
    const igual = parte.indexOf('=')
    return igual >= 0 && parte.slice(0, igual).trim() === COOKIE_SESSAO_DE_OPERADOR
  })
}
