import { InMemoryConsumo, LLMError, LLMGateway, PRAZO_DA_EXECUCAO_MS, gerarAtividadeObjetiva, runInContext, turnoDoTutor, InMemorySuspensoes, type FilaDeTokens, type LimiteDeTokens, type ModeloAprovado, type ResultadoDaReserva } from '@educa/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResilientAdapter } from '../../../../packages/core/src/ia/resilient-adapter.js'
import type { ModelAdapter, ModelCall, ModelResponse } from '../../../../packages/core/src/ia/adapter.js'
import type { Perfil } from '../../../../packages/core/src/ia/perfis.js'
import { SEM_ENVIO_EXTERNO } from '../../../../packages/core/src/ia/port.js'
import { ALUNO_1, atividadeDeEstequiometria, entradaDeAtividade, entradaDoTutor, ESCOLA_A } from '../../../../packages/core/src/ia/__fixtures__/inputs.js'
import { tokensDoPedido } from '../../../../packages/core/src/ia/teto-de-entrada.js'
import { prazoPorTemporizador } from './prazo-por-temporizador.js'

/**
 * O prazo único da execução cobre a espera pela vaga de tokens (49.0; RF7, `cenarios.md` §4): o sinal do prazo (`PRAZO_DA_EXECUCAO_MS`, o do `prazoPorTemporizador` que o
 * `ExecucaoProcessor` usa) vai ao gateway como `pedido.sinal`, e a espera, o modelo menor e a repetição terminam todos nele. O relógio é o falso do Vitest, e é um só: o do prazo, o da espera
 * e o da chamada ao modelo (`ResilientAdapter`, de verdade, com o `cockatiel`). Nenhum Redis nem banco: o que se prova é a conta de tempo; o balde, no Redis, é de `token-limiter.int.test.ts`.
 */
const PRAZO_DO_PERFIL_MS = 1_000_000
const POLITICA = { prazosMs: { rapido: PRAZO_DO_PERFIL_MS, padrao: PRAZO_DO_PERFIL_MS, complexo: PRAZO_DO_PERFIL_MS, visao: PRAZO_DO_PERFIL_MS }, recuoMs: 100, aleatorio: () => 1 } as const
const SEMPRE = { check: async () => ({ permitido: true as const }) }
const MENORES = { padrao: 'menor-padrao', rapido: 'menor-rapido' } as const

/** O modelo de mentira: cada chamada dura o que o roteiro diz (relógio falso) e devolve o texto dela, ou aborta com o sinal, como o `fetch` abortado. */
class LentoAdapter implements ModelAdapter {
  readonly origem = 'falso'
  readonly envio = SEM_ENVIO_EXTERNO
  readonly chamadasDe: { modelo: string; em: number }[] = []

  /** `identidade` e `prefixoDoModelo` fazem do segundo adaptador a reserva: outro provedor e outro modelo por perfil (`reserva-<perfil>`). Um passo com `queda` falha depois da duração, como o servidor que cai. */
  constructor(
    private readonly inicio: number,
    private readonly roteiro: readonly { duracaoMs: number; texto: string; queda?: true }[],
    readonly identidade = 'falso',
    private readonly prefixoDoModelo = 'principal',
  ) {}

  modeloDoPerfil(perfil: Perfil): string {
    return `${this.prefixoDoModelo}-${perfil}`
  }

  chamar<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
    const passo = this.roteiro[Math.min(this.chamadasDe.length, this.roteiro.length - 1)]
    const modelo = chamada.modelo ?? this.modeloDoPerfil(chamada.tarefa.perfil)
    this.chamadasDe.push({ modelo, em: Date.now() - this.inicio })
    return new Promise((resolver, rejeitar) => {
      if (passo === undefined) return rejeitar(new Error('sem roteiro'))
      const temporizador = setTimeout(() => (passo.queda === true ? rejeitar(new LLMError('IA_INDISPONIVEL')) : resolver({ texto: passo.texto, modelo, tokensDeEntrada: 100, tokensDeSaida: 20 })), passo.duracaoMs)
      chamada.sinal.addEventListener('abort', () => {
        clearTimeout(temporizador)
        rejeitar(new LLMError('IA_TEMPO_ESGOTADO'))
      }, { once: true })
    })
  }
}

/** O limitador de mentira: cada modelo abre num instante (ms desde o começo do teste, no relógio falso), e `fechaDepoisDe` fecha tudo depois de n reservas concedidas. */
class LimiteNoRelogio implements LimiteDeTokens {
  readonly reservas: { modelo: string; em: number; concedida: boolean }[] = []
  #concedidas = 0
  readonly #abreEm = new Map<string, number>()
  #fechaDepoisDe = Number.POSITIVE_INFINITY

  constructor(private readonly inicio: number) {}

  abreEm(modelo: string, aposMs: number): this {
    this.#abreEm.set(modelo, aposMs)
    return this
  }

  fechaDepoisDe(concedidas: number): this {
    this.#fechaDepoisDe = concedidas
    return this
  }

  async reservar(modelo: string, _estimativa: number, _fila: FilaDeTokens): Promise<ResultadoDaReserva> {
    const agora = Date.now() - this.inicio
    const aberto = agora >= (this.#abreEm.get(modelo) ?? Number.POSITIVE_INFINITY) && this.#concedidas < this.#fechaDepoisDe
    this.reservas.push({ modelo, em: agora, concedida: aberto })
    if (!aberto) return { concedida: false, msAteLiberar: 1_000 }
    this.#concedidas += 1
    return { concedida: true, usoDoTeto: 0.1, reserva: { acertar: async () => undefined } }
  }
}

const respostaValida = (): string => JSON.stringify(atividadeDeEstequiometria())
const PRINCIPAL_DO_PADRAO = 'falso:principal-padrao'
const PRINCIPAL_DO_RAPIDO = 'falso:principal-rapido'
const MENOR_DO_PADRAO = 'falso:menor-padrao'

type Roteiro = readonly { duracaoMs: number; texto: string; queda?: true }[]
const RESERVA = 'falso-reserva'
const aprovada = (tarefa: ModeloAprovado['tarefa'], modelo: string): ModeloAprovado => ({ tarefa, provedorId: RESERVA, modelo, relatorio: 'docs/avaliacao/teste/relatorio.md', sha256: 'sha-do-teste', aprovadoPor: 'teste', aprovadoEm: '2026-11-22' })
/** A reserva elegível para a ferramenta (`padrao`) e para o Tutor (`rapido`): conferida na D62 e aprovada por tarefa, provedor e modelo. */
const APROVADAS_DA_RESERVA = [aprovada('gerar_atividade_objetiva', 'reserva-padrao'), aprovada('turno_do_tutor', 'reserva-rapido')]

function montar(roteiro: Roteiro, roteiroDaReserva?: Roteiro) {
  const inicio = Date.now()
  const adaptador = new LentoAdapter(inicio, roteiro)
  const reserva = roteiroDaReserva === undefined ? undefined : new LentoAdapter(inicio, roteiroDaReserva, RESERVA, 'reserva')
  const consumo = new InMemoryConsumo()
  const limite = new LimiteNoRelogio(inicio)
  const gateway = new LLMGateway({
    adaptador: new ResilientAdapter(adaptador, POLITICA),
    registro: consumo,
    orcamento: SEMPRE,
    suspensao: new InMemorySuspensoes(),
    limiteDeTokens: limite,
    modelosMenores: MENORES,
    ...(reserva === undefined ? {} : { reserva: { adaptador: new ResilientAdapter(reserva, POLITICA), ambiente: 'local' as const, aprovados: APROVADAS_DA_RESERVA }, soberaniaDaReserva: { conferida: true as const } }),
  })
  /** O pedido como o `ExecucaoProcessor` o faz: o prazo do perfil começa agora, e o sinal dele vai no pedido. */
  const pedir = (tarefa: 'ferramenta' | 'tutor') => {
    const prazo = prazoPorTemporizador(PRAZO_DA_EXECUCAO_MS[tarefa === 'tutor' ? 'rapido' : 'padrao'])
    const base = { escolaId: ESCOLA_A, execucaoId: '1d2e3f4a-5b6c-4d7e-8f90-a1b2c3d4e5f6', sinal: prazo.sinal }
    return runInContext({ requisicaoId: 'teste-de-prazo', escolaId: ESCOLA_A }, () =>
      tarefa === 'tutor'
        ? gateway.generate({ ...base, tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi'), alunoId: ALUNO_1, fila: 'interativa' })
        : gateway.generate({ ...base, tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), fila: 'ferramenta' }),
    )
  }
  return { adaptador, reserva, consumo, limite, pedir, inicio }
}

/** Acompanha a promessa: em que instante (relógio falso, desde o começo) ela terminou, e como. */
function acompanhar(promessa: Promise<unknown>, inicio: number) {
  const estado: { fimEm?: number; codigo?: string; ok?: boolean } = {}
  promessa.then(
    () => Object.assign(estado, { fimEm: Date.now() - inicio, ok: true }),
    (erro: unknown) => Object.assign(estado, { fimEm: Date.now() - inicio, ok: false, ...(erro instanceof LLMError ? { codigo: erro.codigoDeIa } : {}) }),
  )
  return estado
}

describe('o prazo único cobre a espera pela vaga de tokens (49.0)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('os prazos são os do perfil, abaixo dos 150 s do job: 60 s no Tutor, 140 s na ferramenta', () => {
    expect(PRAZO_DA_EXECUCAO_MS).toMatchObject({ rapido: 60_000, padrao: 140_000 })
  })

  it('espera dentro do prazo: a vaga abre aos 7 s e o principal pendura; a execução termina aos 140 s, e não aos 147 s', async () => {
    vi.useFakeTimers()
    const { limite, pedir, inicio, adaptador } = montar([{ duracaoMs: 600_000, texto: respostaValida() }])
    limite.abreEm(PRINCIPAL_DO_PADRAO, 7_000)
    const estado = acompanhar(pedir('ferramenta'), inicio)
    await vi.advanceTimersByTimeAsync(139_999)
    expect(estado.fimEm).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(estado).toMatchObject({ fimEm: 140_000, ok: false, codigo: 'IA_TEMPO_ESGOTADO' })
    expect(adaptador.chamadasDe).toEqual([{ modelo: 'principal-padrao', em: 7_000 }])
  })

  it('o Tutor, com a vaga aos 7 s e o principal pendurado, termina aos 60 s', async () => {
    vi.useFakeTimers()
    const { limite, pedir, inicio } = montar([{ duracaoMs: 600_000, texto: '{}' }])
    limite.abreEm(PRINCIPAL_DO_RAPIDO, 7_000)
    const estado = acompanhar(pedir('tutor'), inicio)
    await vi.advanceTimersByTimeAsync(59_999)
    expect(estado.fimEm).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(estado).toMatchObject({ fimEm: 60_000, ok: false, codigo: 'IA_TEMPO_ESGOTADO' })
  })

  it('o menor pendurado: 8 s sem vaga no principal e o menor com chamada de 600 s terminam aos 140 s (a espera é de dentro do prazo, e não 148 s)', async () => {
    vi.useFakeTimers()
    const { limite, pedir, inicio, adaptador } = montar([{ duracaoMs: 600_000, texto: respostaValida() }])
    limite.abreEm(MENOR_DO_PADRAO, 0)
    const estado = acompanhar(pedir('ferramenta'), inicio)
    await vi.advanceTimersByTimeAsync(139_999)
    expect(estado.fimEm).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(estado).toMatchObject({ fimEm: 140_000, ok: false, codigo: 'IA_TEMPO_ESGOTADO' })
    expect(adaptador.chamadasDe).toEqual([{ modelo: 'menor-padrao', em: 8_000 }])
  })

  it('o menor de 100 s: a chamada de 100 s depois dos 8 s de espera termina aos 108 s, com a resposta; o prazo não é encurtado "só pelo que sobra"; o consumo grava o menor', async () => {
    vi.useFakeTimers()
    const { limite, pedir, inicio, consumo } = montar([{ duracaoMs: 100_000, texto: respostaValida() }])
    limite.abreEm(MENOR_DO_PADRAO, 0)
    const estado = acompanhar(pedir('ferramenta'), inicio)
    await vi.advanceTimersByTimeAsync(107_999)
    expect(estado.fimEm).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(estado).toMatchObject({ fimEm: 108_000, ok: true })
    expect(consumo.registros).toMatchObject([{ modelo: 'menor-padrao', estado: 'concluida', tentativas: 1 }])
  })

  it('a 2.ª reserva: a 1.ª resposta inválida aos 135 s e sem vaga para a 2.ª termina aos 140 s com IA_TEMPO_ESGOTADO, e não aos 143 s', async () => {
    vi.useFakeTimers()
    const { limite, pedir, inicio, adaptador, consumo } = montar([{ duracaoMs: 135_000, texto: 'não é json' }])
    limite.abreEm(PRINCIPAL_DO_PADRAO, 0).fechaDepoisDe(1)
    const estado = acompanhar(pedir('ferramenta'), inicio)
    await vi.advanceTimersByTimeAsync(134_999)
    expect(adaptador.chamadasDe).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(estado.fimEm).toBeUndefined()
    await vi.advanceTimersByTimeAsync(4_999)
    expect(estado.fimEm).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(estado).toMatchObject({ fimEm: 140_000, ok: false, codigo: 'IA_TEMPO_ESGOTADO' })
    // A 2.ª chamada não saiu, e não é chamada (camada-ia 1.0): o consumo tem só a linha da que saiu, e ela falhou pela saída inválida; o prazo esgotado é do erro que sobe, e não de uma linha.
    expect(adaptador.chamadasDe).toHaveLength(1)
    expect(consumo.registros).toMatchObject([{ estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA', tentativas: 1 }])
    expect(consumo.registros).toHaveLength(1)
  })

  describe('a quarta chamada, na reserva, estoura o prazo da execução (reserva-e-avaliacao, 6.0; RF3; §7c)', () => {
    /** O principal responde inválido e depois cai; a reserva responde inválido e a quarta chamada pendura 600 s: só o prazo único a corta. O "reserva" do nome é o provedor, e não a vaga de tokens. */
    const casos = [
      { perfil: 'padrao', tarefa: 'ferramenta', prazoMs: 140_000, principal: [{ duracaoMs: 10_000, texto: 'não é json' }, { duracaoMs: 10_000, texto: '', queda: true as const }], reserva: [{ duracaoMs: 30_000, texto: 'não é json' }, { duracaoMs: 600_000, texto: respostaValida() }], quartaEm: 50_000, tokensMinimosDeEntrada: () => tokensDoPedido(gerarAtividadeObjetiva, entradaDeAtividade()), tetoDeSaida: gerarAtividadeObjetiva.maximoDeTokensDeSaida },
      { perfil: 'rapido', tarefa: 'tutor', prazoMs: 60_000, principal: [{ duracaoMs: 5_000, texto: '{}' }, { duracaoMs: 5_000, texto: '', queda: true as const }], reserva: [{ duracaoMs: 10_000, texto: '{}' }, { duracaoMs: 600_000, texto: '{}' }], quartaEm: 20_000, tokensMinimosDeEntrada: () => tokensDoPedido(turnoDoTutor, entradaDoTutor('não entendi')), tetoDeSaida: turnoDoTutor.maximoDeTokensDeSaida },
    ] as const

    for (const caso of casos) {
      it(`${caso.perfil}: a quarta chamada pendurada termina aos ${caso.prazoMs.toLocaleString('pt-BR')} ms com IA_TEMPO_ESGOTADO, a execução falhou, e a reserva só tem o que sobrou do prazo`, async () => {
        vi.useFakeTimers()
        const { limite, pedir, inicio, adaptador, reserva, consumo } = montar(caso.principal, caso.reserva)
        // Só o balde do principal abre: a reserva ainda não reserva vaga no dele (a 7.0 a põe no balde dela).
        limite.abreEm(caso.perfil === 'padrao' ? PRINCIPAL_DO_PADRAO : PRINCIPAL_DO_RAPIDO, 0)
        const estado = acompanhar(pedir(caso.tarefa), inicio)
        await vi.advanceTimersByTimeAsync(caso.prazoMs - 1)
        expect(estado.fimEm).toBeUndefined()
        expect(adaptador.chamadasDe.map((chamada) => chamada.modelo)).toEqual([`principal-${caso.perfil}`, `principal-${caso.perfil}`])
        expect(reserva?.chamadasDe.map((chamada) => chamada.modelo)).toEqual([`reserva-${caso.perfil}`, `reserva-${caso.perfil}`])
        expect(reserva?.chamadasDe[1]?.em).toBe(caso.quartaEm)
        await vi.advanceTimersByTimeAsync(1)
        expect(estado).toMatchObject({ fimEm: caso.prazoMs, ok: false, codigo: 'IA_TEMPO_ESGOTADO' })
        // Nenhuma quinta chamada, nem ao principal: o limite é de quatro e o prazo é o da execução, e não o da reserva.
        expect([adaptador.chamadasDe.length, reserva?.chamadasDe.length]).toEqual([2, 2])
        // A última linha é a da quarta chamada, que saiu e não voltou: leva o modelo da reserva e a estimativa da D14 (a entrada contada, com a correção da resposta inválida anterior, e a saída no teto da tarefa).
        // `provedorId: null` é do harness: o `LentoAdapter` não tem envio externo, e não o que a reserva grava em produção (o caso "a reserva que falha depois de sair" da 4.0 prova o `provedorId` dela).
        const ultima = consumo.registros.at(-1)
        expect(ultima).toMatchObject({ estado: 'falhou', codigoDeErro: 'IA_TEMPO_ESGOTADO', peloProvedorDeReserva: true, modelo: `reserva-${caso.perfil}`, provedorId: null, tokensDeSaida: caso.tetoDeSaida })
        expect(ultima?.tokensDeEntrada).toBeGreaterThan(caso.tokensMinimosDeEntrada())
      })
    }
  })

  it('sem o prazo apertado, a espera acaba sozinha aos 8 s: o degrau de IA_INDISPONIVEL cabe dentro dos 140 s, sem erro cru', async () => {
    vi.useFakeTimers()
    const { pedir, inicio, adaptador } = montar([{ duracaoMs: 1_000, texto: respostaValida() }])
    // Nenhum modelo abre: nem o principal nem o menor.
    const estado = acompanhar(pedir('ferramenta'), inicio)
    await vi.advanceTimersByTimeAsync(8_000)
    expect(estado).toMatchObject({ fimEm: 8_000, ok: false, codigo: 'IA_INDISPONIVEL' })
    expect(adaptador.chamadasDe).toEqual([])
  })
})
