import type { LoggerBase } from '@educa/core'
import { describe, expect, it } from 'vitest'
import { INTERVALO_DO_PULSO_MS, PulsoService, ouvirDepoisDoPrimeiroPulso, type Tique } from './pulso.service.js'

/**
 * O serviço do pulso, sem banco (avaliacao-e-correcao, 2.0): o repositório, o relógio e o tique são injetados à mão, e nenhum caso dorme. O que o banco faz com o pulso
 * (a lacuna, a corrida, a reconexão) está em `pulso.int.test.ts`.
 */

/** O repositório de mentira: conta os pulsos, falha quando mandado, e pode parar um pulso até ser solto. */
function repositorioDeTeste() {
  const estado = { pulsos: 0, encerrados: 0, falha: undefined as Error | undefined, segurar: undefined as Promise<void> | undefined }
  const repositorio = {
    async pulsar(): Promise<void> {
      estado.pulsos += 1
      if (estado.segurar !== undefined) await estado.segurar
      if (estado.falha !== undefined) throw estado.falha
    },
    async encerrar(): Promise<void> {
      estado.encerrados += 1
    },
  }
  return { estado, repositorio }
}

function loggerDeTeste() {
  const avisos: unknown[] = []
  const logger = { warn: (linha: unknown) => avisos.push(linha) } as unknown as LoggerBase
  return { avisos, logger }
}

/** O tique que o teste dispara à mão, e que diz se está ligado. */
function tiqueDeTeste() {
  const estado = { ligado: false, registros: 0, intervaloMs: 0, acao: undefined as (() => Promise<void>) | undefined }
  const tique: Tique = (acao, intervaloMs) => {
    estado.registros += 1
    estado.intervaloMs = intervaloMs
    estado.ligado = true
    estado.acao = acao
    return () => {
      estado.ligado = false
    }
  }
  return { estado, tique }
}

function montar() {
  const instante = { agora: new Date('2026-12-01T10:00:00.000Z') }
  const relogio = { agora: () => instante.agora }
  const adiante = (ms: number) => {
    instante.agora = new Date(instante.agora.getTime() + ms)
  }
  const repo = repositorioDeTeste()
  const log = loggerDeTeste()
  const tique = tiqueDeTeste()
  const servico = new PulsoService({ repositorio: repo.repositorio, relogio, tique: tique.tique, logger: log.logger })
  return { servico, adiante, repo: repo.estado, log, tique: tique.estado }
}

describe('PulsoService', () => {
  it('o pulso é de 10 s: o tique é ligado com esse intervalo', async () => {
    const { servico, tique } = montar()
    await servico.start()
    expect(tique.intervaloMs).toBe(10_000)
    expect(INTERVALO_DO_PULSO_MS).toBe(10_000)
  })

  it('antes de `start` a instância não mede nada: aceita a prova, sem idade, e o tique não está ligado', () => {
    const { servico, adiante, tique } = montar()
    adiante(60 * 60_000)
    expect(servico.aceitaProva()).toBe(true)
    expect(servico.idadeEmSegundos()).toBeUndefined()
    expect(tique.registros).toBe(0)
  })

  it('o primeiro pulso é esperado e a falha dele sobe: a instância não arma, não liga o tique e segue aceitando', async () => {
    const { servico, repo, tique, adiante } = montar()
    repo.falha = new Error('banco fora')
    await expect(servico.start()).rejects.toThrow('banco fora')
    expect(tique.registros).toBe(0)
    adiante(5 * 60_000)
    expect(servico.aceitaProva()).toBe(true)
    expect(servico.idadeEmSegundos()).toBeUndefined()
  })

  it('`start` duas vezes liga um tique e dá um pulso só', async () => {
    const { servico, repo, tique } = montar()
    await servico.start()
    await servico.start()
    expect(repo.pulsos).toBe(1)
    expect(tique.registros).toBe(1)
  })

  it('aceita a prova até 30 s do último pulso, inclusive; com 30 s e 1 ms recusa; a idade anda em segundos', async () => {
    const { servico, adiante } = montar()
    await servico.start()
    expect(servico.idadeEmSegundos()).toBe(0)
    adiante(29_999)
    expect(servico.aceitaProva()).toBe(true)
    adiante(1)
    expect(servico.aceitaProva()).toBe(true)
    expect(servico.idadeEmSegundos()).toBe(30)
    adiante(1)
    expect(servico.aceitaProva()).toBe(false)
    expect(servico.idadeEmSegundos()).toBe(30.001)
  })

  it('o tique que pulsa zera a idade e volta a aceitar', async () => {
    const { servico, adiante, tique, repo } = montar()
    await servico.start()
    adiante(45_000)
    expect(servico.aceitaProva()).toBe(false)
    await tique.acao?.()
    expect(repo.pulsos).toBe(2)
    expect(servico.aceitaProva()).toBe(true)
    expect(servico.idadeEmSegundos()).toBe(0)
  })

  it('o pulso que falha no tique não conta como feito, não derruba o tique e avisa só com o resumo do erro', async () => {
    const { servico, adiante, tique, repo, log } = montar()
    await servico.start()
    repo.falha = Object.assign(new Error('insert into indisponibilidade values (1234)'), { code: '57014', severity: 'ERROR' })
    adiante(31_000)
    await expect(tique.acao?.()).resolves.toBeUndefined()
    expect(servico.aceitaProva()).toBe(false)
    expect(servico.idadeEmSegundos()).toBe(31)
    expect(tique.ligado).toBe(true)
    expect(log.avisos).toHaveLength(1)
    expect(log.avisos[0]).toMatchObject({ evento: 'pulso.falhou', erro: expect.objectContaining({ sqlstate: '57014' }) })
    // A mensagem do erro pode repetir a instrução e o que ela leva: nunca vai ao log (o erro cru a traria em `erro.message`).
    expect(log.avisos[0]).not.toHaveProperty('erro.message')
    repo.falha = undefined
    await tique.acao?.()
    expect(servico.aceitaProva()).toBe(true)
  })

  it('um pulso por vez: o tique que chega com o pulso anterior ainda parado não dá outro', async () => {
    const { servico, tique, repo } = montar()
    await servico.start()
    let soltar: () => void = () => undefined
    repo.segurar = new Promise<void>((resolver) => {
      soltar = resolver
    })
    const primeiro = tique.acao?.()
    const segundo = tique.acao?.()
    // Conferido com o primeiro ainda parado: o segundo tique não chegou ao repositório.
    await new Promise((resolver) => setImmediate(resolver))
    expect(repo.pulsos).toBe(2)
    soltar()
    await primeiro
    await segundo
    // Solto o primeiro, o tique seguinte volta a pulsar.
    repo.segurar = undefined
    await tique.acao?.()
    expect(repo.pulsos).toBe(3)
  })

  it('ao desligar, o tique para e a conexão do pulso é devolvida', async () => {
    const { servico, tique, repo } = montar()
    await servico.start()
    await servico.beforeApplicationShutdown()
    expect(tique.ligado).toBe(false)
    expect(repo.encerrados).toBe(1)
  })

  it('`ouvirDepoisDoPrimeiroPulso`: o primeiro pulso vem antes da porta, e a falha dele impede a porta', async () => {
    const { servico, repo } = montar()
    const ordem: string[] = []
    const app = {
      get: () => ({ start: async () => (ordem.push('pulso'), servico.start()) }),
      listen: async () => void ordem.push('porta'),
    } as unknown as Parameters<typeof ouvirDepoisDoPrimeiroPulso>[0]
    await ouvirDepoisDoPrimeiroPulso(app, 3000, '0.0.0.0')
    expect(ordem).toEqual(['pulso', 'porta'])
    expect(repo.pulsos).toBe(1)

    const falho = montar()
    falho.repo.falha = new Error('banco fora')
    const portas: string[] = []
    const appFalho = {
      get: () => falho.servico,
      listen: async () => void portas.push('porta'),
    } as unknown as Parameters<typeof ouvirDepoisDoPrimeiroPulso>[0]
    await expect(ouvirDepoisDoPrimeiroPulso(appFalho, 3000, '0.0.0.0')).rejects.toThrow('banco fora')
    expect(portas).toEqual([])
  })
})
