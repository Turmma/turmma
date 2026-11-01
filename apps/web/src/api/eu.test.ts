import { ErrorCode } from '@educa/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `concluirIntroducao` (telas do aluno, 1.0): `POST /v1/eu/introducao` com corpo vazio, sem nada da pessoa nem da escola, e a
 * resposta passa pelo esquema do contrato. A rede é falsa; a regra sob teste é a da web. O módulo é recarregado em cada teste.
 */
const chamadas: { readonly caminho: string; readonly metodo: string; readonly corpo: string | undefined }[] = []
let fila: { status: number; corpo?: unknown }[] = []
const importar = async () => ({ eu: await import('./eu'), sessao: await import('./sessao') })
let modulos: Awaited<ReturnType<typeof importar>>

beforeEach(async () => {
  chamadas.length = 0
  fila = []
  vi.resetModules()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (caminho: string, opcoes?: RequestInit) => {
      chamadas.push({ caminho, metodo: opcoes?.method ?? 'GET', corpo: typeof opcoes?.body === 'string' ? opcoes.body : undefined })
      const preparada = fila.shift()
      if (preparada === undefined) throw new Error(`chamada sem resposta preparada: ${caminho}`)
      return new Response(preparada.corpo === undefined ? null : JSON.stringify(preparada.corpo), { status: preparada.status })
    }),
  )
  modulos = await importar()
  fila.push({ status: 200, corpo: { token: 'token-de-acesso', expiraEm: new Date(Date.now() + 600_000).toISOString() } })
  await modulos.sessao.abrirSessaoPeloCookie()
  chamadas.length = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
  expect(fila, 'resposta preparada que nenhuma chamada consumiu').toHaveLength(0)
})

describe('concluirIntroducao', () => {
  it('manda o POST com corpo vazio e devolve a data que a API respondeu', async () => {
    fila.push({ status: 200, corpo: { introducaoVistaEm: '2026-10-24T12:00:00.000Z' } })

    expect(await modulos.eu.concluirIntroducao()).toEqual({ introducaoVistaEm: '2026-10-24T12:00:00.000Z' })

    expect(chamadas).toHaveLength(1)
    expect(chamadas[0]).toMatchObject({ metodo: 'POST', corpo: '{}' })
    expect(chamadas[0]?.caminho).toMatch(/\/v1\/eu\/introducao$/)
  })

  it('resposta fora do contrato (sem a data, ou com campo a mais) é recusada', async () => {
    fila.push({ status: 200, corpo: { introducaoVistaEm: '2026-10-24T12:00:00.000Z', usuarioId: 'x' } })
    await expect(modulos.eu.concluirIntroducao()).rejects.toMatchObject({ name: 'ApiError', codigo: ErrorCode.ERRO_INTERNO })
    fila.push({ status: 200, corpo: {} })
    await expect(modulos.eu.concluirIntroducao()).rejects.toMatchObject({ name: 'ApiError', codigo: ErrorCode.ERRO_INTERNO })
  })
})
