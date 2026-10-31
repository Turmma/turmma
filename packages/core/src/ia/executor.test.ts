import { setTimeout as esperar } from 'node:timers/promises'
import { describe, expect, it, vi } from 'vitest'
import { currentContext, runInContext } from '../context/context.js'
import { DomainException } from '../error/domain.exception.js'
import { ESCOLA_A, ESCOLA_B } from './__fixtures__/inputs.js'
import { LLMError } from './errors.js'
import { InMemoryExecucoes, InProcessAgenteExecutor, EXECUCAO_INTERROMPIDA, type ExecucaoAgendada, type ExecucaoRepository } from './executor.js'

/** Uma promessa que o teste resolve quando quiser: é o "trabalho que ainda está rodando". */
function adiada<Valor = void>(): { promessa: Promise<Valor>; resolver: (valor: Valor) => void; rejeitar: (erro: unknown) => void } {
  let resolver!: (valor: Valor) => void
  let rejeitar!: (erro: unknown) => void
  const promessa = new Promise<Valor>((aceitar, recusar) => {
    resolver = aceitar
    rejeitar = recusar
  })
  return { promessa, resolver, rejeitar }
}

let sequencia = 0
function execucao(escolaId: string, chave?: string): ExecucaoAgendada {
  sequencia += 1
  return { id: `00000000-0000-4000-8000-${String(sequencia).padStart(12, '0')}`, escolaId, chave: chave ?? `chave-${sequencia}` }
}

function montar(opcoes: { vagasPorEscola?: number; vagasNoTotal?: number; timeoutMs?: number; repositorio?: ExecucaoRepository; agora?: () => Date } = {}) {
  const relogio = { agora: opcoes.agora ?? (() => new Date('2026-10-05T13:00:00Z')) }
  const memoria = new InMemoryExecucoes(relogio)
  const logger = { info: vi.fn(), warn: vi.fn() }
  const executor = new InProcessAgenteExecutor({
    repositorio: opcoes.repositorio ?? memoria,
    config: { vagasPorEscola: opcoes.vagasPorEscola ?? 2, vagasNoTotal: opcoes.vagasNoTotal ?? 8, timeoutMs: opcoes.timeoutMs ?? 5_000 },
    logger,
    relogio,
  })
  const pendente = (escolaId: string, chave?: string): ExecucaoAgendada => {
    const nova = execucao(escolaId, chave)
    memoria.criarPendente(nova)
    return nova
  }
  return { executor, memoria, logger, pendente }
}

/** Deixa as microtarefas e os temporizadores já vencidos rodarem, sem depender de quanto o trabalho demora. */
const respirar = (): Promise<void> => esperar(5)

describe('ExecutorNoProcesso: roda depois de responder', () => {
  it('agendar devolve na hora, com a execução ainda pendente; depois ela conclui com o resultado do trabalho', async () => {
    const { executor, memoria, pendente } = montar()
    const feita = pendente(ESCOLA_A)
    const trabalho = vi.fn(async () => ({ artefatoId: 'artefato-1' }))
    executor.agendar(feita, trabalho)
    expect(memoria.ler(feita.id)?.estado).toBe('pendente')
    expect(trabalho).not.toHaveBeenCalled()
    await executor.ociosa()
    expect(memoria.ler(feita.id)).toMatchObject({ estado: 'concluida', resultado: { artefatoId: 'artefato-1' } })
    expect(trabalho).toHaveBeenCalledTimes(1)
  })

  it('enquanto o trabalho roda, a execução está "rodando"', async () => {
    const { executor, memoria, pendente } = montar()
    const feita = pendente(ESCOLA_A)
    const trava = adiada<string>()
    executor.agendar(feita, () => trava.promessa)
    await respirar()
    expect(memoria.ler(feita.id)?.estado).toBe('rodando')
    trava.resolver('pronto')
    await executor.ociosa()
    expect(memoria.ler(feita.id)).toMatchObject({ estado: 'concluida', resultado: 'pronto' })
  })
})

describe('ExecutorNoProcesso: idempotente por chave', () => {
  it('duas chamadas com a mesma chave, ao mesmo tempo, rodam o trabalho uma vez só', async () => {
    const { executor, memoria, pendente } = montar()
    const feita = pendente(ESCOLA_A, 'gerar-atividade-turma-2b')
    const trabalho = vi.fn(async () => 'resultado')
    executor.agendar(feita, trabalho)
    executor.agendar({ ...feita }, trabalho)
    await executor.ociosa()
    expect(trabalho).toHaveBeenCalledTimes(1)
    expect(memoria.ler(feita.id)?.estado).toBe('concluida')
  })

  it('a mesma chave agendada de novo depois de concluída não roda outra vez: quem decide é o estado gravado', async () => {
    const { executor, memoria, pendente } = montar()
    const feita = pendente(ESCOLA_A)
    const trabalho = vi.fn(async () => 'primeiro')
    executor.agendar(feita, trabalho)
    await executor.ociosa()
    executor.agendar(feita, async () => 'segundo')
    await executor.ociosa()
    expect(trabalho).toHaveBeenCalledTimes(1)
    expect(memoria.ler(feita.id)?.resultado).toBe('primeiro')
  })

  it('execução que outra instância já pegou (não está mais pendente) não roda aqui', async () => {
    const { executor, memoria, pendente } = montar()
    const feita = pendente(ESCOLA_A)
    await memoria.marcarRodando(feita)
    const trabalho = vi.fn(async () => 'duplicado')
    executor.agendar(feita, trabalho)
    await executor.ociosa()
    expect(trabalho).not.toHaveBeenCalled()
    expect(memoria.ler(feita.id)?.estado).toBe('rodando')
  })

  it('a mesma chave em escolas diferentes são execuções diferentes: as duas rodam', async () => {
    const { executor, pendente } = montar()
    const trabalho = vi.fn(async () => 'ok')
    executor.agendar(pendente(ESCOLA_A, 'mesma-chave'), trabalho)
    executor.agendar(pendente(ESCOLA_B, 'mesma-chave'), trabalho)
    await executor.ociosa()
    expect(trabalho).toHaveBeenCalledTimes(2)
  })
})

describe('ExecutorNoProcesso: vagas por escola e no total (regra 80, item 3)', () => {
  it('a escola A no limite não segura a escola B: a de B roda e conclui com as de A ainda rodando', async () => {
    const { executor, memoria, pendente } = montar({ vagasPorEscola: 1, vagasNoTotal: 4 })
    const [a1, a2, b1] = [pendente(ESCOLA_A), pendente(ESCOLA_A), pendente(ESCOLA_B)]
    const travaDeA = adiada<string>()
    const segundoDeA = vi.fn(async () => 'a2')
    executor.agendar(a1, () => travaDeA.promessa)
    executor.agendar(a2, segundoDeA)
    executor.agendar(b1, async () => 'b1')
    await respirar()
    expect(memoria.ler(b1.id)?.estado).toBe('concluida')
    expect(memoria.ler(a1.id)?.estado).toBe('rodando')
    // A segunda de A espera a vaga da própria escola, mesmo com vaga sobrando no total.
    expect(memoria.ler(a2.id)?.estado).toBe('pendente')
    expect(segundoDeA).not.toHaveBeenCalled()
    travaDeA.resolver('a1')
    await executor.ociosa()
    expect(memoria.ler(a2.id)?.estado).toBe('concluida')
  })

  it('nunca roda mais execuções ao mesmo tempo que o total, nem mais de uma escola que o limite dela', async () => {
    const { executor, pendente } = montar({ vagasPorEscola: 2, vagasNoTotal: 3 })
    let juntas = 0
    let maximoJuntas = 0
    const porEscola = new Map<string, number>()
    let maximoPorEscola = 0
    const trabalho = (escolaId: string) => async (): Promise<string> => {
      juntas += 1
      porEscola.set(escolaId, (porEscola.get(escolaId) ?? 0) + 1)
      maximoJuntas = Math.max(maximoJuntas, juntas)
      maximoPorEscola = Math.max(maximoPorEscola, porEscola.get(escolaId) ?? 0)
      await esperar(10)
      juntas -= 1
      porEscola.set(escolaId, (porEscola.get(escolaId) ?? 1) - 1)
      return 'ok'
    }
    for (let rodada = 0; rodada < 6; rodada += 1) {
      executor.agendar(pendente(ESCOLA_A), trabalho(ESCOLA_A))
      executor.agendar(pendente(ESCOLA_B), trabalho(ESCOLA_B))
    }
    await executor.ociosa()
    expect(maximoJuntas).toBe(3)
    expect(maximoPorEscola).toBe(2)
  })
})

describe('ExecutorNoProcesso: cada execução roda no contexto da escola dela', () => {
  it('a execução de B, despachada quando a de A termina dentro da requisição de A, não herda a escola nem o usuário de A', async () => {
    const { executor, pendente } = montar({ vagasNoTotal: 1 })
    const [deA, deB] = [pendente(ESCOLA_A), pendente(ESCOLA_B)]
    const vistos: (ReturnType<typeof currentContext> | undefined)[] = []
    const requisicaoDeA = { requisicaoId: 'requisicao-de-a', escolaId: ESCOLA_A, usuarioId: 'usuario-de-a' }
    // As duas são agendadas de dentro da requisição de A; com uma vaga só, a de B começa no fim da de A.
    runInContext(requisicaoDeA, () => {
      executor.agendar(deA, async () => void vistos.push(currentContext()))
      executor.agendar(deB, async () => void vistos.push(currentContext()))
    })
    await executor.ociosa()
    expect(vistos.map((contexto) => contexto?.escolaId)).toEqual([ESCOLA_A, ESCOLA_B])
    for (const contexto of vistos) {
      expect(contexto?.usuarioId).toBeUndefined()
      expect(contexto?.requisicaoId).not.toBe('requisicao-de-a')
    }
  })
})

describe('ExecutorNoProcesso: falha vira estado com código, nunca exceção solta', () => {
  it.each([
    ['erro de IA', new LLMError('IA_SAIDA_INVALIDA'), 'IA_SAIDA_INVALIDA'],
    ['erro de domínio', new DomainException('NAO_ENCONTRADO'), 'NAO_ENCONTRADO'],
    ['erro qualquer', new Error('mensagem com o texto do aluno'), 'ERRO_INTERNO'],
  ])('%s: a execução fica "falhou" com o código, sem a mensagem do erro', async (_caso, erro, codigo) => {
    const { executor, memoria, logger, pendente } = montar()
    const feita = pendente(ESCOLA_A)
    executor.agendar(feita, async () => Promise.reject(erro))
    await executor.ociosa()
    expect(memoria.ler(feita.id)).toMatchObject({ estado: 'falhou', codigo })
    expect(memoria.ler(feita.id)).not.toHaveProperty('resultado')
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('texto do aluno')
  })

  it('trabalho que lança na hora, sem promessa, também vira "falhou"; e o executor segue atendendo', async () => {
    const { executor, memoria, pendente } = montar({ vagasPorEscola: 1 })
    const [quebrada, seguinte] = [pendente(ESCOLA_A), pendente(ESCOLA_A)]
    executor.agendar(quebrada, () => {
      throw new Error('defeito')
    })
    executor.agendar(seguinte, async () => 'ok')
    await executor.ociosa()
    expect(memoria.ler(quebrada.id)).toMatchObject({ estado: 'falhou', codigo: 'ERRO_INTERNO' })
    expect(memoria.ler(seguinte.id)?.estado).toBe('concluida')
  })

  it('banco fora ao gravar a falha não derruba o processo: nenhuma promessa fica rejeitada sem dono', async () => {
    const repositorio: ExecucaoRepository = {
      marcarRodando: async () => true,
      marcarConcluida: async () => Promise.reject(new Error('banco fora')),
      marcarFalhou: async () => Promise.reject(new Error('banco fora')),
      falharInterrompidas: async () => Promise.reject(new Error('banco fora')),
    }
    const { executor } = montar({ repositorio })
    executor.agendar(execucao(ESCOLA_A), async () => 'ok')
    await expect(executor.ociosa()).resolves.toBeUndefined()
    await expect(executor.varrer()).resolves.toBe(0)
  })

  it('o log da execução leva ids, código e duração; o resultado não aparece', async () => {
    const { executor, logger, pendente } = montar()
    const feita = pendente(ESCOLA_A)
    executor.agendar(feita, async () => ({ texto: 'conteúdo que não vai para o log' }))
    await executor.ociosa()
    expect(logger.info.mock.calls).toEqual([[{ evento: 'ia.execucao.concluida', execucaoId: feita.id, escolaId: ESCOLA_A, duracaoMs: expect.any(Number) as number }]])
  })
})

describe('ExecutorNoProcesso: prazo por execução', () => {
  it('passou do prazo: "falhou" com tempo esgotado, o sinal é abortado e a vaga é liberada para a próxima', async () => {
    const { executor, memoria, pendente } = montar({ vagasPorEscola: 1, timeoutMs: 40 })
    const [lenta, seguinte] = [pendente(ESCOLA_A), pendente(ESCOLA_A)]
    let sinalDaLenta: AbortSignal | undefined
    executor.agendar(lenta, (sinal) => {
      sinalDaLenta = sinal
      return adiada<string>().promessa
    })
    executor.agendar(seguinte, async () => 'ok')
    await executor.ociosa()
    expect(memoria.ler(lenta.id)).toMatchObject({ estado: 'falhou', codigo: 'IA_TEMPO_ESGOTADO' })
    expect(sinalDaLenta?.aborted).toBe(true)
    expect(memoria.ler(seguinte.id)?.estado).toBe('concluida')
  })

  it('resultado que chega depois do prazo é descartado: a execução continua "falhou"', async () => {
    const { executor, memoria, pendente } = montar({ timeoutMs: 30 })
    const lenta = pendente(ESCOLA_A)
    const trava = adiada<string>()
    executor.agendar(lenta, () => trava.promessa)
    await executor.ociosa()
    trava.resolver('atrasado')
    await respirar()
    expect(memoria.ler(lenta.id)).toMatchObject({ estado: 'falhou', codigo: 'IA_TEMPO_ESGOTADO' })
    expect(memoria.ler(lenta.id)).not.toHaveProperty('resultado')
  })
})

describe('ExecutorNoProcesso: nada fica preso em "rodando" quando o processo sobe de novo', () => {
  it('a varredura da subida encerra o que ficou rodando ou pendente além de dois prazos, e não toca no que é recente', async () => {
    let agora = new Date('2026-10-05T13:00:00Z')
    const { executor, memoria, pendente } = montar({ timeoutMs: 60_000, agora: () => agora })
    const [presaRodando, presaPendente] = [pendente(ESCOLA_A), pendente(ESCOLA_B)]
    await memoria.marcarRodando(presaRodando)
    // O processo caiu aqui. Três minutos depois ele sobe, e outra instância tem uma execução viva, recém-iniciada.
    agora = new Date('2026-10-05T13:03:00Z')
    const viva = pendente(ESCOLA_A)
    await memoria.marcarRodando(viva)
    const recemCriada = pendente(ESCOLA_B)

    await executor.iniciar()
    executor.encerrar()

    expect(memoria.ler(presaRodando.id)).toMatchObject({ estado: 'falhou', codigo: EXECUCAO_INTERROMPIDA })
    expect(memoria.ler(presaPendente.id)).toMatchObject({ estado: 'falhou', codigo: EXECUCAO_INTERROMPIDA })
    expect(memoria.ler(viva.id)?.estado).toBe('rodando')
    expect(memoria.ler(recemCriada.id)?.estado).toBe('pendente')
  })

  it('execução que a varredura já encerrou não roda mais, mesmo que ainda esteja na fila deste processo', async () => {
    let agora = new Date('2026-10-05T13:00:00Z')
    const { executor, memoria, pendente } = montar({ vagasPorEscola: 1, timeoutMs: 60_000, agora: () => agora })
    const [primeira, esperando] = [pendente(ESCOLA_A), pendente(ESCOLA_A)]
    const trava = adiada<string>()
    const tardio = vi.fn(async () => 'tarde demais')
    executor.agendar(primeira, () => trava.promessa)
    executor.agendar(esperando, tardio)
    await respirar()
    agora = new Date('2026-10-05T13:05:00Z')
    expect(await executor.varrer()).toBe(2)
    trava.resolver('ok')
    await executor.ociosa()
    expect(tardio).not.toHaveBeenCalled()
    expect(memoria.ler(esperando.id)).toMatchObject({ estado: 'falhou', codigo: EXECUCAO_INTERROMPIDA })
    // A que estava rodando foi encerrada pela varredura: o resultado atrasado não a ressuscita.
    expect(memoria.ler(primeira.id)).toMatchObject({ estado: 'falhou', codigo: EXECUCAO_INTERROMPIDA })
  })
})

describe('ExecucoesEmMemoria: o escopo acompanha a execução', () => {
  it('com o id certo e a escola errada, nada muda', async () => {
    const memoria = new InMemoryExecucoes()
    const daEscolaA = execucao(ESCOLA_A)
    memoria.criarPendente(daEscolaA)
    expect(await memoria.marcarRodando({ ...daEscolaA, escolaId: ESCOLA_B })).toBe(false)
    expect(memoria.ler(daEscolaA.id)?.estado).toBe('pendente')
  })
})
