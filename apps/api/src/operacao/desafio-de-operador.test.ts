import { EMISSOR_TOKEN, ErroDeDominio, TIPO_DESAFIO_DE_OPERADOR, verificarToken, verificarTokenDeOperador } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { decodeJwt, decodeProtectedHeader, SignJWT, type JWTPayload } from 'jose'
import { randomUUID } from 'node:crypto'
import { Logger } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { describe, expect, it, vi } from 'vitest'
import { EmissorDeDesafio, verificarDesafio } from '../credencial/index.js'
import { AUDIENCIA_DESAFIO_DE_OPERADOR, ConsumoDeDesafioDeOperador, EmissorDeDesafioDeOperador, VALIDADE_DESAFIO_DE_OPERADOR_SEGUNDOS, verificarDesafioDeOperador } from './desafio-de-operador.js'

const OPERADOR = '0190f5a0-0000-7000-8000-0000000000e1'
const CHAVE = new TextEncoder().encode('chave_sintetica_de_teste_com_32_caracteres')
const OUTRA_CHAVE = new TextEncoder().encode('outra_chave_sintetica_com_32_caracteres')
const agora = () => Math.floor(Date.now() / 1_000)

async function recusa(promessa: Promise<unknown>): Promise<ErroDeDominio> {
  try {
    await promessa
  } catch (erro) {
    if (erro instanceof ErroDeDominio) return erro
    throw erro
  }
  throw new Error('o desafio deveria ter sido recusado')
}

/** Um desafio de operador assinado à mão, com um campo trocado de cada vez. */
async function assinar(opcoes: { claims?: JWTPayload; semClaims?: string[]; typ?: string; chave?: Uint8Array } = {}): Promise<string> {
  const todas: JWTPayload = { sub: OPERADOR, etapa: 'configurar_mfa', jti: randomUUID(), iss: EMISSOR_TOKEN, aud: AUDIENCIA_DESAFIO_DE_OPERADOR, iat: agora(), exp: agora() + 300, ...opcoes.claims }
  const claims = Object.fromEntries(Object.entries(todas).filter(([claim]) => !(opcoes.semClaims ?? []).includes(claim)))
  return new SignJWT(claims).setProtectedHeader({ alg: 'HS256', typ: opcoes.typ ?? TIPO_DESAFIO_DE_OPERADOR }).sign(opcoes.chave ?? CHAVE)
}

describe('desafio do operador (tarefa 5.0)', () => {
  it('leva só o operador, a etapa e o jti, com typ e audiência próprios e 5 min de validade', async () => {
    const desafio = await new EmissorDeDesafioDeOperador(CHAVE).emitir({ operadorId: OPERADOR, etapa: 'configurar_mfa' })
    expect(decodeProtectedHeader(desafio)).toEqual({ alg: 'HS256', typ: TIPO_DESAFIO_DE_OPERADOR })
    const claims = decodeJwt(desafio)
    expect(Object.keys(claims).sort()).toEqual(['aud', 'etapa', 'exp', 'iat', 'iss', 'jti', 'sub'])
    expect(claims).toMatchObject({ sub: OPERADOR, etapa: 'configurar_mfa', aud: AUDIENCIA_DESAFIO_DE_OPERADOR, iss: EMISSOR_TOKEN })
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(VALIDADE_DESAFIO_DE_OPERADOR_SEGUNDOS)
    const verificado = await verificarDesafioDeOperador(desafio, CHAVE, 'configurar_mfa')
    expect(verificado).toMatchObject({ operadorId: OPERADOR, etapa: 'configurar_mfa', jti: claims.jti })
  })

  it('cada emissão tem um jti novo', async () => {
    const emissor = new EmissorDeDesafioDeOperador(CHAVE)
    const [um, outro] = await Promise.all([emissor.emitir({ operadorId: OPERADOR, etapa: 'mfa' }), emissor.emitir({ operadorId: OPERADOR, etapa: 'mfa' })])
    expect(decodeJwt(um).jti).not.toBe(decodeJwt(outro).jti)
  })

  it('recusa, sempre com NAO_AUTENTICADO: outra etapa, outro typ, outra audiência, outro emissor, outra chave, vencido e sem jti', async () => {
    const recusados = {
      outraEtapa: await new EmissorDeDesafioDeOperador(CHAVE).emitir({ operadorId: OPERADOR, etapa: 'mfa' }),
      typDaEscola: await assinar({ typ: 'desafio+jwt' }),
      typDeAcesso: await assinar({ typ: 'operador+jwt' }),
      audDaEscola: await assinar({ claims: { aud: 'sessao' } }),
      outroEmissor: await assinar({ claims: { iss: 'outro' } }),
      outraChave: await assinar({ chave: OUTRA_CHAVE }),
      vencido: await assinar({ claims: { iat: agora() - 400, exp: agora() - 100 } }),
      semJti: await assinar({ semClaims: ['jti'] }),
      semSub: await assinar({ semClaims: ['sub'] }),
      etapaDesconhecida: await assinar({ claims: { etapa: 'escolher' } }),
    }
    // O desafio certo, com a mesma montagem, passa: a recusa vem do campo trocado.
    await expect(verificarDesafioDeOperador(await assinar(), CHAVE, 'configurar_mfa')).resolves.toMatchObject({ operadorId: OPERADOR })
    for (const [caso, desafio] of Object.entries(recusados)) {
      expect(await recusa(verificarDesafioDeOperador(desafio, CHAVE, 'configurar_mfa')), caso).toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
    }
  })

  it('não vale nas outras portas: nem como desafio da escola, nem como acesso da escola ou do operador; e o desafio da escola não vale aqui', async () => {
    const desafio = await new EmissorDeDesafioDeOperador(CHAVE).emitir({ operadorId: OPERADOR, etapa: 'configurar_mfa' })
    const config = { ambiente: 'local' as const, chaveAssinatura: CHAVE }
    expect(await recusa(verificarDesafio(desafio, CHAVE, ['configurar_mfa', 'mfa']))).toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
    expect(await recusa(verificarToken(desafio, config))).toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
    expect(await recusa(verificarTokenDeOperador(desafio, config))).toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
    const daEscola = await new EmissorDeDesafio(CHAVE).emitir({ contaId: OPERADOR, etapa: 'configurar_mfa', mfaCumprido: false })
    expect(await recusa(verificarDesafioDeOperador(daEscola, CHAVE, 'configurar_mfa'))).toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
  })

  it('o desafio `mfa` do configurar leva a versão do segredo (`ver`), e ela volta na verificação; o da entrada por e-mail não leva (tarefa 7.0)', async () => {
    const emissor = new EmissorDeDesafioDeOperador(CHAVE)
    const comVersao = await emissor.emitir({ operadorId: OPERADOR, etapa: 'mfa', versao: 3 })
    expect(decodeJwt(comVersao)).toMatchObject({ ver: 3, etapa: 'mfa' })
    expect(await verificarDesafioDeOperador(comVersao, CHAVE, 'mfa')).toMatchObject({ operadorId: OPERADOR, etapa: 'mfa', versao: 3 })
    const semVersao = await verificarDesafioDeOperador(await emissor.emitir({ operadorId: OPERADOR, etapa: 'mfa' }), CHAVE, 'mfa')
    expect('versao' in semVersao).toBe(false)
  })

  it('a versão só existe no desafio `mfa`: o emissor não a põe em outra etapa, e o `configurar_mfa` assinado com ela é recusado', async () => {
    await expect(new EmissorDeDesafioDeOperador(CHAVE).emitir({ operadorId: OPERADOR, etapa: 'configurar_mfa', versao: 1 })).rejects.toThrow()
    // A mesma montagem sem `ver` passa: a recusa vem da versão fora da etapa.
    await expect(verificarDesafioDeOperador(await assinar(), CHAVE, 'configurar_mfa')).resolves.toMatchObject({ etapa: 'configurar_mfa' })
    expect(await recusa(verificarDesafioDeOperador(await assinar({ claims: { ver: 1 } }), CHAVE, 'configurar_mfa'))).toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
    for (const ver of [0, -1, 1.5, '2']) {
      expect(await recusa(verificarDesafioDeOperador(await assinar({ claims: { etapa: 'mfa', ver } }), CHAVE, 'mfa')), String(ver)).toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
    }
  })
})

describe('ConsumoDeDesafioDeOperador com o Redis fora (tarefa 7.0, recomendação levada à 8.0)', () => {
  const desafio = { jti: randomUUID(), expiraEm: new Date(Date.now() + 60_000) }

  it('Redis desconectado e Redis que recusa o comando: 503 com Retry-After, e o aviso `operacao.desafio_sem_redis` sai uma vez só, sem nada do desafio', async () => {
    const avisos = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    try {
      const fora = new ConsumoDeDesafioDeOperador({ status: 'end' } as unknown as Redis)
      const travado = new ConsumoDeDesafioDeOperador({ status: 'ready', set: vi.fn(async () => Promise.reject(new Error('Command timed out'))) } as unknown as Redis)
      for (const consumo of [fora, travado]) {
        for (let vez = 0; vez < 2; vez++) {
          await expect(consumo.consumir(desafio)).rejects.toMatchObject({ codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, status: 503, tenteDeNovoEmSegundos: expect.any(Number) as number })
        }
      }
      // Uma linha por instância do consumo nas duas recusas seguidas, e só o evento.
      expect(avisos.mock.calls).toEqual([['operacao.desafio_sem_redis'], ['operacao.desafio_sem_redis']])
    } finally {
      avisos.mockRestore()
    }
  })

  it('com o Redis de pé, a marca já existente é NAO_AUTENTICADO, e nenhum aviso sai', async () => {
    const avisos = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    try {
      const usado = new ConsumoDeDesafioDeOperador({ status: 'ready', set: vi.fn(async () => null) } as unknown as Redis)
      await expect(usado.consumir(desafio)).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
      expect(avisos).not.toHaveBeenCalled()
    } finally {
      avisos.mockRestore()
    }
  })
})
