import { ErroDeDominio } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { ContadorEmJanela } from '../credencial/index.js'
import {
  ESPERA_ACIMA_DO_TETO_DA_ESCOLA_MS,
  JANELA_DOS_LIMITES_DA_SALA_MS,
  LimitesDaSala,
  TETO_DE_CODIGOS_ERRADOS_POR_ESCOLA,
  TETO_DE_HASHES_SEM_PEDIDO_POR_TURMA,
  TETO_DE_MATRICULAS_ERRADAS_POR_NOME,
} from './limites-da-sala.js'

/**
 * Os limites da sala sem Redis (A1, tarefa 7.0; `tasks/prd-apresentacao-escola/cenarios.md`): o L7 (Redis fora: o seguro
 * em memória conta, e o teto cai para o dividido por `LIMITE_INSTANCIAS_API`), a linha `sala.limite_atingido` uma vez por
 * escola, tipo e janela, e a métrica só com o tipo. O cliente fora do ar leva toda contagem ao seguro, e o relógio parado
 * move a janela sem esperar. O caminho com o Redis, pela API, está em `apps/api/test/limites-da-sala.int.test.ts`.
 */

const CHAVE = new TextEncoder().encode('chave-de-teste-do-contador-com-32-bytes')
const FORA = { status: 'end' } as unknown as Redis
const INSTANCIAS = 2

function relogioParado(inicio = Date.parse('2026-09-21T07:30:00Z')) {
  let agora = inicio
  return { agora: () => new Date(agora), avancar: (ms: number) => (agora += ms) }
}

let medidor: MedidorDeTeste

beforeEach(() => {
  medidor = new MedidorDeTeste()
})

afterEach(async () => {
  await medidor.encerrar()
})

function montar({ instancias = INSTANCIAS } = {}) {
  const relogio = relogioParado()
  const linhas: unknown[] = []
  const esperas: number[] = []
  const janela = new ContadorEmJanela(FORA, CHAVE, { janelaMs: JANELA_DOS_LIMITES_DA_SALA_MS, relogio, avisarSeguro: () => undefined })
  const limites = new LimitesDaSala({
    janela,
    instancias,
    medidor: medidor.medidor,
    logger: { warn: (linha: unknown) => linhas.push(linha) } as never,
    esperar: async (ms) => {
      esperas.push(ms)
    },
  })
  return { limites, relogio, linhas, esperas }
}

/** Os pontos de `sala.limite_atingido`, por tipo. */
async function atingidos(): Promise<Record<string, number>> {
  return Object.fromEntries((await medidor.pontos('sala.limite_atingido')).map(({ atributos, valor }) => [String(atributos['tipo']), valor as number]))
}

const codigoDoErro = (promessa: Promise<unknown>) =>
  promessa.then(
    () => 'passou',
    (erro: unknown) => (erro instanceof ErroDeDominio ? erro.codigo : erro),
  )

describe('L7: com o Redis de fila fora, o seguro conta e o teto cai para o dividido pelas instâncias', () => {
  it('escola: a partir do teto dividido, a busca pelo código espera 1 s; abaixo dele, não', async () => {
    const { limites, esperas } = montar()
    const escolaId = randomUUID()
    const teto = Math.floor(TETO_DE_CODIGOS_ERRADOS_POR_ESCOLA / INSTANCIAS)
    for (let vez = 0; vez < teto - 1; vez++) await limites.codigoErrado(escolaId)
    await limites.antesDaBusca(escolaId)
    expect(esperas).toEqual([])
    await limites.codigoErrado(escolaId)
    await limites.antesDaBusca(escolaId)
    expect(esperas).toEqual([ESPERA_ACIMA_DO_TETO_DA_ESCOLA_MS])
    // A outra escola não sente.
    await limites.antesDaBusca(randomUUID())
    expect(esperas).toHaveLength(1)
  })

  it('nome: a partir do teto dividido, LIMITE_EXCEDIDO com o Retry-After do resto da janela; o outro nome e o mesmo nome por outro acesso seguem', async () => {
    const { limites, relogio } = montar()
    const nome = { acessoId: randomUUID(), listaNomeId: randomUUID() }
    const [turmaId, escolaId] = [randomUUID(), randomUUID()]
    const teto = Math.floor(TETO_DE_MATRICULAS_ERRADAS_POR_NOME / INSTANCIAS)
    // As erradas somam antes do hash e passam até o teto; a do teto em diante é segurada.
    for (let vez = 0; vez < teto; vez++) expect(await limites.antesDoHash(nome, turmaId, escolaId, true)).toEqual({ rebaixado: false })
    expect(await limites.teveMatriculaErrada(nome)).toBe(true)
    relogio.avancar(60_000)
    for (const errada of [true, false]) {
      const travado = await limites.antesDoHash(nome, turmaId, escolaId, errada).catch((erro: unknown) => erro)
      expect(travado).toBeInstanceOf(ErroDeDominio)
      expect(travado).toMatchObject({ codigo: ErrorCode.LIMITE_EXCEDIDO, status: 429, tenteDeNovoEmSegundos: (JANELA_DOS_LIMITES_DA_SALA_MS - 60_000) / 1_000 })
    }
    for (const outro of [{ ...nome, listaNomeId: randomUUID() }, { ...nome, acessoId: randomUUID() }]) {
      expect(await limites.antesDoHash(outro, turmaId, escolaId, false)).toEqual({ rebaixado: false })
      expect(await limites.teveMatriculaErrada(outro)).toBe(false)
    }
    // Passada a janela, o nome destrava sozinho.
    relogio.avancar(JANELA_DOS_LIMITES_DA_SALA_MS)
    expect(await limites.antesDoHash(nome, turmaId, escolaId, false)).toEqual({ rebaixado: false })
    expect(await limites.teveMatriculaErrada(nome)).toBe(false)
  })

  it('nome, em paralelo (regra 80, item 7): dez erradas ao mesmo tempo no mesmo nome passam só até o teto; as outras saem com LIMITE_EXCEDIDO', async () => {
    const { limites } = montar({ instancias: 1 })
    const nome = { acessoId: randomUUID(), listaNomeId: randomUUID() }
    const resultados = await Promise.all(Array.from({ length: 10 }, () => codigoDoErro(limites.antesDoHash(nome, randomUUID(), randomUUID(), true))))
    expect(resultados.filter((resultado) => resultado === 'passou')).toHaveLength(TETO_DE_MATRICULAS_ERRADAS_POR_NOME)
    expect(resultados.filter((resultado) => resultado === ErrorCode.LIMITE_EXCEDIDO)).toHaveLength(10 - TETO_DE_MATRICULAS_ERRADAS_POR_NOME)
  })

  it('turma: a partir do teto dividido, o hash vai rebaixado; nunca recusa', async () => {
    const { limites } = montar()
    const nome = { acessoId: randomUUID(), listaNomeId: randomUUID() }
    const [turmaId, escolaId] = [randomUUID(), randomUUID()]
    const teto = Math.floor(TETO_DE_HASHES_SEM_PEDIDO_POR_TURMA / INSTANCIAS)
    for (let vez = 0; vez < teto - 1; vez++) await limites.hashSemPedido(turmaId)
    expect((await limites.antesDoHash(nome, turmaId, escolaId, false)).rebaixado).toBe(false)
    await limites.hashSemPedido(turmaId)
    for (let vez = 0; vez < 3; vez++) expect(await limites.antesDoHash(nome, turmaId, escolaId, false)).toEqual({ rebaixado: true })
    expect((await limites.antesDoHash(nome, randomUUID(), escolaId, false)).rebaixado).toBe(false)
  })

  it('com uma instância só, o teto do seguro é o teto inteiro', async () => {
    const { limites } = montar({ instancias: 1 })
    const nome = { acessoId: randomUUID(), listaNomeId: randomUUID() }
    for (let vez = 0; vez < TETO_DE_MATRICULAS_ERRADAS_POR_NOME - 1; vez++) await limites.antesDoHash(nome, randomUUID(), randomUUID(), true)
    expect(await codigoDoErro(limites.antesDoHash(nome, randomUUID(), randomUUID(), false))).toBe('passou')
    expect(await codigoDoErro(limites.antesDoHash(nome, randomUUID(), randomUUID(), true))).toBe('passou')
    expect(await codigoDoErro(limites.antesDoHash(nome, randomUUID(), randomUUID(), false))).toBe(ErrorCode.LIMITE_EXCEDIDO)
  })
})

describe('o log sala.limite_atingido e a métrica sala.limite_atingido{tipo}', () => {
  it('uma linha por escola, tipo e janela, só com o evento, o tipo e o escolaId; a métrica soma cada vez, só com o tipo', async () => {
    const { limites, relogio, linhas } = montar({ instancias: 1 })
    const [escolaA, escolaB] = [randomUUID(), randomUUID()]
    const nomes = [0, 1, 2].map(() => ({ acessoId: randomUUID(), listaNomeId: randomUUID() }))
    const [primeiro] = nomes
    if (primeiro === undefined) throw new Error('sem nome')
    for (const nome of nomes) for (let vez = 0; vez < TETO_DE_MATRICULAS_ERRADAS_POR_NOME; vez++) await limites.antesDoHash(nome, randomUUID(), escolaA, true)
    expect(linhas).toEqual([])
    // Três nomes travados na A, duas vezes cada, e um na B: uma linha da A e uma da B.
    for (const nome of nomes) for (let vez = 0; vez < 2; vez++) expect(await codigoDoErro(limites.antesDoHash(nome, randomUUID(), escolaA, false))).toBe(ErrorCode.LIMITE_EXCEDIDO)
    expect(await codigoDoErro(limites.antesDoHash(primeiro, randomUUID(), escolaB, false))).toBe(ErrorCode.LIMITE_EXCEDIDO)
    // A escola da A no teto de códigos: outra linha, do tipo escola.
    for (let vez = 0; vez < TETO_DE_CODIGOS_ERRADOS_POR_ESCOLA; vez++) await limites.codigoErrado(escolaA)
    await limites.antesDaBusca(escolaA)
    await limites.antesDaBusca(escolaA)
    expect(linhas).toEqual([
      { evento: 'sala.limite_atingido', tipo: 'nome', escolaId: escolaA },
      { evento: 'sala.limite_atingido', tipo: 'nome', escolaId: escolaB },
      { evento: 'sala.limite_atingido', tipo: 'escola', escolaId: escolaA },
    ])
    expect(await atingidos()).toEqual({ escola: 2, nome: 7, turma: 0 })
    for (const { atributos } of await medidor.pontos('sala.limite_atingido')) expect(Object.keys(atributos)).toEqual(['tipo'])

    // Na janela seguinte, a mesma escola e o mesmo tipo escrevem de novo, uma vez.
    relogio.avancar(JANELA_DOS_LIMITES_DA_SALA_MS)
    for (let vez = 0; vez < TETO_DE_MATRICULAS_ERRADAS_POR_NOME; vez++) await limites.antesDoHash(primeiro, randomUUID(), escolaA, true)
    for (let vez = 0; vez < 2; vez++) expect(await codigoDoErro(limites.antesDoHash(primeiro, randomUUID(), escolaA, false))).toBe(ErrorCode.LIMITE_EXCEDIDO)
    expect(linhas.slice(3)).toEqual([{ evento: 'sala.limite_atingido', tipo: 'nome', escolaId: escolaA }])
  })

  it('as séries dos três tipos nascem em 0, antes do primeiro limite', async () => {
    montar()
    expect(await atingidos()).toEqual({ escola: 0, nome: 0, turma: 0 })
  })
})
