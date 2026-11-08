import { EMISSOR_TOKEN, TokenIssuer, verifyToken } from '@educa/core'
import { VALIDADE_DO_BILHETE_DA_TROCA_MINUTOS } from '@educa/shared'
import { decodeJwt, decodeProtectedHeader, SignJWT } from 'jose'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ConviteTicket, TICKET_AUDIENCE, TICKET_TYPE } from '../sessao/convite/convite-ticket.js'
import { AUDIENCIA_DO_BILHETE_DA_TROCA, BilheteDaTroca, TIPO_DO_BILHETE_DA_TROCA, VALIDADE_DO_BILHETE_DA_TROCA_SEGUNDOS } from './bilhete-da-troca.js'
import { CHALLENGE_AUDIENCE, ChallengeIssuer, TIPO_DESAFIO, verifyChallenge } from './challenge.js'

const CHAVE = new TextEncoder().encode('chave-de-teste-da-assinatura-com-32-bytes')
const ESCOLA = '0190f5a0-0000-7000-8000-0000000000e1'
const ALUNO = '0190f5a0-0000-7000-8000-0000000000a1'
const VALIDADE_DA_PROVISORIA = '2026-11-09T10:00:00.123456Z'
const DADOS = { escolaId: ESCOLA, usuarioId: ALUNO, provisoriaExpiraEm: VALIDADE_DA_PROVISORIA }

/** Um JWT assinado com a nossa chave, com o `typ`, a `aud` e o emissor que o teste escolhe, e os claims do bilhete (com ou sem `exp`). */
function assinar(opcoes: { typ?: string; aud?: string; iss?: string; semExp?: boolean; claims?: Record<string, unknown>; emitidoEm?: Date; segundosDeVida?: number }): Promise<string> {
  const iat = Math.floor((opcoes.emitidoEm ?? new Date()).getTime() / 1_000)
  const jwt = new SignJWT({ escola_id: ESCOLA, usuario_id: ALUNO, provisoria_expira_em: VALIDADE_DA_PROVISORIA, ...opcoes.claims })
    .setProtectedHeader({ alg: 'HS256', typ: opcoes.typ ?? TIPO_DO_BILHETE_DA_TROCA })
    .setIssuer(opcoes.iss ?? EMISSOR_TOKEN)
    .setAudience(opcoes.aud ?? AUDIENCIA_DO_BILHETE_DA_TROCA)
    .setIssuedAt(iat)
  if (opcoes.semExp !== true) jwt.setExpirationTime(iat + (opcoes.segundosDeVida ?? VALIDADE_DO_BILHETE_DA_TROCA_SEGUNDOS))
  return jwt.sign(CHAVE)
}

describe('bilhete da troca da senha provisória (acesso-e-convites, tarefa 10.0)', () => {
  it('leva a escola, o aluno e o vencimento da provisória, typ e aud próprios, vence em 10 min, e nada da pessoa nem da senha', async () => {
    const bilhete = await new BilheteDaTroca(CHAVE).emitir(DADOS)
    expect(decodeProtectedHeader(bilhete)).toEqual({ alg: 'HS256', typ: TIPO_DO_BILHETE_DA_TROCA })
    const claims = decodeJwt(bilhete)
    expect(Object.keys(claims).sort()).toEqual(['aud', 'escola_id', 'exp', 'iat', 'iss', 'provisoria_expira_em', 'usuario_id'])
    expect(claims).toMatchObject({ aud: AUDIENCIA_DO_BILHETE_DA_TROCA, escola_id: ESCOLA, usuario_id: ALUNO, provisoria_expira_em: VALIDADE_DA_PROVISORIA })
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(VALIDADE_DO_BILHETE_DA_TROCA_MINUTOS * 60)
    expect(await new BilheteDaTroca(CHAVE).verificar(bilhete)).toEqual(DADOS)
  })

  it('borda: adulterado, de outra chave, quebrado ou com o conteúdo fora do formato não vale, sem erro', async () => {
    const bilhetes = new BilheteDaTroca(CHAVE)
    const bilhete = await bilhetes.emitir(DADOS)
    const [cabecalho, , assinatura] = bilhete.split('.')
    const corpoAdulterado = Buffer.from(JSON.stringify({ ...decodeJwt(bilhete), usuario_id: randomUUID() })).toString('base64url')
    expect(await bilhetes.verificar(`${cabecalho}.${corpoAdulterado}.${assinatura}`)).toBeUndefined()
    expect(await new BilheteDaTroca(new TextEncoder().encode('outra-chave-de-teste-com-32-bytes-xx')).verificar(bilhete)).toBeUndefined()
    expect(await bilhetes.verificar('nao-e-um-jwt')).toBeUndefined()
    // Assinado com a nossa chave e com os dois campos certos, mas com o conteúdo fora do formato: o vencimento sem os microssegundos do banco, ou o aluno que não é UUID.
    expect(await bilhetes.verificar(await assinar({ claims: { provisoria_expira_em: '2026-11-09T10:00:00.123Z' } }))).toBeUndefined()
    expect(await bilhetes.verificar(await assinar({ claims: { usuario_id: 'nao-e-uuid' } }))).toBeUndefined()
    expect(await bilhetes.verificar(await assinar({ claims: { escola_id: undefined } }))).toBeUndefined()
  })

  it('borda: vale até 10 min depois de emitido e não vale um segundo depois; o `exp` maior que o prazo não alonga a vida; o relógio que recua tem a folga do desafio', async () => {
    const emitidoEm = new Date('2026-11-08T10:00:00Z')
    const bilhete = await new BilheteDaTroca(CHAVE, { agora: () => emitidoEm }).emitir(DADOS)
    const aos = (segundos: number) => new BilheteDaTroca(CHAVE, { agora: () => new Date(emitidoEm.getTime() + segundos * 1_000) })
    expect(await aos(VALIDADE_DO_BILHETE_DA_TROCA_SEGUNDOS - 1).verificar(bilhete)).toEqual(DADOS)
    expect(await aos(VALIDADE_DO_BILHETE_DA_TROCA_SEGUNDOS).verificar(bilhete)).toBeUndefined()
    expect(await aos(-1).verificar(bilhete)).toEqual(DADOS)
    expect(await aos(-300).verificar(bilhete)).toBeUndefined()
    // Assinado por nós, com o `exp` de uma hora: a idade pelo `iat` ainda corta aos 10 min.
    const longo = await assinar({ emitidoEm, segundosDeVida: 3_600 })
    expect(await aos(VALIDADE_DO_BILHETE_DA_TROCA_SEGUNDOS - 1).verificar(longo)).toEqual(DADOS)
    expect(await aos(VALIDADE_DO_BILHETE_DA_TROCA_SEGUNDOS + 1).verificar(longo)).toBeUndefined()
  })

  it('permissão: o `typ` do bilhete com a `aud` do desafio, e a `aud` do bilhete com o `typ` do desafio, não valem, um campo de cada vez', async () => {
    const bilhetes = new BilheteDaTroca(CHAVE)
    expect(await bilhetes.verificar(await assinar({}))).toEqual(DADOS)
    expect(await bilhetes.verificar(await assinar({ aud: CHALLENGE_AUDIENCE }))).toBeUndefined()
    expect(await bilhetes.verificar(await assinar({ typ: TIPO_DESAFIO }))).toBeUndefined()
    expect(await bilhetes.verificar(await assinar({ typ: TICKET_TYPE }))).toBeUndefined()
    expect(await bilhetes.verificar(await assinar({ aud: TICKET_AUDIENCE }))).toBeUndefined()
  })

  it('permissão: assinado por nós mas de outro emissor, ou sem `exp`, não vale', async () => {
    const bilhetes = new BilheteDaTroca(CHAVE)
    expect(await bilhetes.verificar(await assinar({ iss: 'outro-emissor' }))).toBeUndefined()
    // Sem `exp` o bilhete não teria validade própria: o `requiredClaims` o recusa mesmo dentro dos 10 min do `iat`.
    expect(await bilhetes.verificar(await assinar({ semExp: true }))).toBeUndefined()
  })

  it('permissão: o desafio de login, o bilhete do convite e o token de acesso não servem de bilhete, e o bilhete não serve de nenhum deles', async () => {
    const bilhetes = new BilheteDaTroca(CHAVE)
    const desafio = await new ChallengeIssuer(CHAVE).emitir({ contaId: randomUUID(), etapa: 'mfa', mfaCumprido: false })
    const doConvite = await new ConviteTicket(CHAVE).emitir({ contaId: randomUUID(), conviteId: randomUUID() })
    const { token } = await new TokenIssuer(CHAVE).emitir({ escolaId: ESCOLA, usuarioId: ALUNO, sessaoId: randomUUID() })
    for (const alheio of [desafio, doConvite, token]) expect(await bilhetes.verificar(alheio)).toBeUndefined()

    const bilhete = await bilhetes.emitir(DADOS)
    await expect(verifyChallenge(bilhete, CHAVE, ['mfa', 'escolher', 'configurar_mfa'])).rejects.toMatchObject({ codigo: 'NAO_AUTENTICADO' })
    expect(await new ConviteTicket(CHAVE).verificar(bilhete)).toBeUndefined()
    await expect(verifyToken(bilhete, { ambiente: 'local', chaveAssinatura: CHAVE })).rejects.toMatchObject({ codigo: 'NAO_AUTENTICADO' })
  })
})
