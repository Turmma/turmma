import { BrokenCircuitError, TaskCancelledError } from 'cockatiel'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withEscolaContextOfRequest } from './__fixtures__/escola-context.js'
import { ScriptedAdapter } from './__fixtures__/scripted-adapter.js'
import { entradaDeAtividade, ESCOLA_A } from './__fixtures__/inputs.js'
import type { ModelAdapter, ModelCall, ModelResponse } from './adapter.js'
import { ResilientAdapter, type ResiliencePolicy } from './resilient-adapter.js'
import { InMemoryConsumo, InMemoryOrcamento } from './consumo.js'
import { LLMError, ProviderError, type LLMErrorCode, type ProviderFailure } from './errors.js'
import type { Perfil } from './perfis.js'
import type { EnvioDaChamada } from './port.js'
import { LLMGateway } from './llm-gateway.js'
import { InMemorySuspensoes } from './suspensao.js'
import { gerarAtividadeObjetiva } from './tasks/gerar-atividade-objetiva.js'
import type { TaskDefinition } from './task.js'
import { turnoDoTutor } from './tasks/turno-do-tutor.js'

// Cada teste daqui cai em tempo limitado, com ou sem a cláusula que ele prova (um teste que uma mutação deixa
// pendurado seguraria a trava de carga das linhas): o relógio é falso e só anda por `avancar(ms)`, que é finito, nunca
// por `runAllTimers`; e o desfecho se lê do estado, nunca por um `await` numa promessa que pode nunca terminar.
const LIMITE_DO_TESTE_MS = 5_000

// Os números da spec, escritos aqui e não importados: o teste prende o valor, e não a constante que o código nomeia.
const FALHAS_PARA_ABRIR_O_DISJUNTOR = 5
const MEIO_ABRE_O_DISJUNTOR_EM_MS = 30_000

const PRAZOS = { rapido: 20_000, padrao: 60_000, complexo: 60_000, visao: 60_000 } as const
const RECUO_MS = 500
const RESPOSTA: ModelResponse = { texto: '{}', modelo: 'modelo-unico', tokensDeEntrada: 10, tokensDeSaida: 5 }

const complexa: TaskDefinition<unknown, unknown> = { ...(gerarAtividadeObjetiva as TaskDefinition<unknown, unknown>), perfil: 'complexo' }
const tarefaDo = (perfil: Perfil): TaskDefinition<unknown, unknown> =>
  perfil === 'rapido' ? (turnoDoTutor as TaskDefinition<unknown, unknown>) : perfil === 'padrao' ? (gerarAtividadeObjetiva as TaskDefinition<unknown, unknown>) : complexa

type Comportamento = (numero: number, sinal: AbortSignal, perfil: Perfil) => Promise<ModelResponse>

const responde: Comportamento = async () => RESPOSTA
const falha =
  (motivo: ProviderFailure, tenteDeNovoEmSegundos?: number): Comportamento =>
  async () => {
    throw new ProviderError(motivo, tenteDeNovoEmSegundos)
  }
const erroDeIa =
  (codigo: LLMErrorCode): Comportamento =>
  async () => {
    throw new LLMError(codigo)
  }
/** O provedor que demora `ms` para responder. Cortado pelo sinal, o `fetch` volta como "tempo esgotado", como o adaptador de verdade faz. */
const demora =
  (ms: number): Comportamento =>
  (_numero, sinal) =>
    new Promise((resolve, reject) => {
      const espera = setTimeout(() => resolve(RESPOSTA), ms)
      const cortar = (): void => {
        clearTimeout(espera)
        reject(new ProviderError('tempo'))
      }
      if (sinal.aborted) cortar()
      else sinal.addEventListener('abort', cortar, { once: true })
    })

/** O adaptador de dentro: um modelo só para os quatro perfis (o `LLM_MODELO` do ensaio) e o comportamento de cada chamada. */
class RoteiroAdapter implements ModelAdapter {
  readonly origem = 'openai_compat'
  readonly envio: EnvioDaChamada = { envioExterno: true, provedorId: 'provedor-de-teste' }
  readonly chamadasPorPerfil: Perfil[] = []
  modelo = 'modelo-unico'

  constructor(public comportamento: Comportamento) {}

  get chamadas(): number {
    return this.chamadasPorPerfil.length
  }

  modeloDoPerfil(_perfil: Perfil): string {
    return this.modelo
  }

  async chamar<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
    this.chamadasPorPerfil.push(chamada.tarefa.perfil)
    return this.comportamento(this.chamadasPorPerfil.length, chamada.sinal, chamada.tarefa.perfil)
  }
}

function montar(comportamento: Comportamento, politica: Partial<ResiliencePolicy> = {}) {
  const interno = new RoteiroAdapter(comportamento)
  const adaptador = new ResilientAdapter(interno, { prazosMs: PRAZOS, recuoMs: RECUO_MS, aleatorio: () => 1, ...politica })
  const chamar = (perfil: Perfil = 'padrao', sinal: AbortSignal = new AbortController().signal) =>
    adaptador.chamar({ tarefa: tarefaDo(perfil), entrada: entradaDeAtividade(), sinal })
  return { adaptador, interno, chamar }
}

/** O desfecho de uma chamada lido do estado: nunca espera o que pode não chegar. */
interface Desfecho {
  pendente: boolean
  valor?: ModelResponse
  erro?: unknown
}
function acompanhar(promessa: Promise<ModelResponse>): Desfecho {
  const desfecho: Desfecho = { pendente: true }
  promessa.then(
    (valor) => Object.assign(desfecho, { pendente: false, valor }),
    (erro: unknown) => Object.assign(desfecho, { pendente: false, erro }),
  )
  return desfecho
}
const avancar = (ms: number) => vi.advanceTimersByTimeAsync(ms)

/** Chama, deixa o relógio andar `ms` e devolve o desfecho. */
async function chamarEEsperar(chamada: Promise<ModelResponse>, ms: number): Promise<Desfecho> {
  const desfecho = acompanhar(chamada)
  await avancar(ms)
  return desfecho
}

/** O código do erro que a chamada deu, ou `undefined` se ela ainda não terminou ou deu certo. */
const codigoDe = (desfecho: Desfecho): unknown => (desfecho.erro instanceof LLMError ? desfecho.erro.codigoDeIa : undefined)

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('AdaptadorResiliente: o prazo', { timeout: LIMITE_DO_TESTE_MS }, () => {
  it('provedor além do prazo do perfil: tempo esgotado no prazo, e uma chamada só, sem repetir', async () => {
    const { interno, chamar } = montar(demora(200_000))
    const desfecho = acompanhar(chamar('padrao'))
    await avancar(PRAZOS.padrao - 1)
    expect(desfecho.pendente).toBe(true)
    await avancar(1)
    expect(codigoDe(desfecho)).toBe('IA_TEMPO_ESGOTADO')
    // O prazo abortou o `fetch`: dali ninguém repete, e a espera da repetição não volta a chamar.
    await avancar(120_000)
    expect(interno.chamadas).toBe(1)
  })

  it('cada perfil tem o seu prazo: o `rapido` corta aos 20 s a chamada que o `padrao` ainda espera', async () => {
    const { chamar } = montar(demora(200_000))
    const rapido = acompanhar(chamar('rapido'))
    const padrao = acompanhar(chamar('padrao'))
    await avancar(PRAZOS.rapido)
    expect(codigoDe(rapido)).toBe('IA_TEMPO_ESGOTADO')
    expect(padrao.pendente).toBe(true)
    await avancar(PRAZOS.padrao - PRAZOS.rapido)
    expect(codigoDe(padrao)).toBe('IA_TEMPO_ESGOTADO')
  })

  it('o prazo cobre a chamada e a repetição: contado desde o primeiro pedido, e não de novo a cada tentativa', async () => {
    // A primeira tentativa dá 429 na hora, a repetição entra após o recuo e demora além do prazo.
    const { interno, chamar } = montar((numero, sinal, perfil) => (numero === 1 ? falha('limite')(numero, sinal, perfil) : demora(200_000)(numero, sinal, perfil)))
    const desfecho = acompanhar(chamar('padrao'))
    await avancar(RECUO_MS)
    expect(interno.chamadas).toBe(2)
    await avancar(PRAZOS.padrao - RECUO_MS)
    expect(codigoDe(desfecho)).toBe('IA_TEMPO_ESGOTADO')
  })

  it('o prazo que acaba durante a espera da repetição a cancela: nenhum pedido sai depois dele', async () => {
    // Prazo de 400 ms e recuo de 500 ms (a subida recusaria; aqui basta para o prazo acabar durante a espera).
    const { interno, chamar } = montar(falha('limite'), { prazosMs: { ...PRAZOS, padrao: 400 } })
    const desfecho = await chamarEEsperar(chamar('padrao'), 400)
    expect(codigoDe(desfecho)).toBe('IA_TEMPO_ESGOTADO')
    await avancar(2_000)
    expect(interno.chamadas).toBe(1)
  })

  it('quem chamou cancela: tempo esgotado na hora, sem pedido novo, e não pesa no disjuntor', async () => {
    const { interno, chamar } = montar(demora(200_000))
    for (let cancelada = 0; cancelada < FALHAS_PARA_ABRIR_O_DISJUNTOR; cancelada += 1) {
      const controle = new AbortController()
      const desfecho = acompanhar(chamar('padrao', controle.signal))
      await avancar(10)
      controle.abort()
      await avancar(0)
      expect(codigoDe(desfecho)).toBe('IA_TEMPO_ESGOTADO')
    }
    // Cinco desistências de aluno não são cinco falhas do provedor: a próxima chamada sai.
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR)
    const proxima = acompanhar(chamar('padrao'))
    await avancar(0)
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR + 1)
    expect(proxima.pendente).toBe(true)
  })

  it('sinal que já chegou cancelado: nada sai para o provedor', async () => {
    const { interno, chamar } = montar(responde)
    const controle = new AbortController()
    controle.abort()
    const desfecho = await chamarEEsperar(chamar('padrao', controle.signal), 10)
    expect(codigoDe(desfecho)).toBe('IA_TEMPO_ESGOTADO')
    expect(interno.chamadas).toBe(0)
  })
})

describe('AdaptadorResiliente: a repetição', { timeout: LIMITE_DO_TESTE_MS }, () => {
  it('5xx: uma chamada só, sem repetição, porque pode ter cobrado', async () => {
    const { interno, chamar } = montar(falha('servidor'))
    const desfecho = await chamarEEsperar(chamar('padrao'), 10_000)
    expect(codigoDe(desfecho)).toBe('IA_INDISPONIVEL')
    expect(interno.chamadas).toBe(1)
  })

  it('outro 4xx: uma chamada só, sem repetição, porque repetir daria o mesmo', async () => {
    const { interno, chamar } = montar(falha('rejeitada'))
    const desfecho = await chamarEEsperar(chamar('padrao'), 10_000)
    expect(codigoDe(desfecho)).toBe('IA_INDISPONIVEL')
    expect(interno.chamadas).toBe(1)
  })

  it('timeout: não se repete, a chamada é uma só', async () => {
    const { interno, chamar } = montar(falha('tempo'))
    const desfecho = await chamarEEsperar(chamar('padrao'), 10_000)
    expect(codigoDe(desfecho)).toBe('IA_TEMPO_ESGOTADO')
    expect(interno.chamadas).toBe(1)
  })

  it('429: uma repetição, depois do recuo, e a resposta da repetição é a que vale', async () => {
    const { interno, chamar } = montar((numero, sinal, perfil) => (numero === 1 ? falha('limite')(numero, sinal, perfil) : responde(numero, sinal, perfil)))
    const desfecho = acompanhar(chamar('padrao'))
    await avancar(RECUO_MS - 1)
    expect(interno.chamadas).toBe(1)
    await avancar(1)
    expect(interno.chamadas).toBe(2)
    expect(desfecho.valor).toEqual(RESPOSTA)
  })

  it('429 duas vezes: nunca uma terceira, e o erro é o de indisponível', async () => {
    const { interno, chamar } = montar(falha('limite'))
    const desfecho = await chamarEEsperar(chamar('padrao'), 30_000)
    expect(codigoDe(desfecho)).toBe('IA_INDISPONIVEL')
    expect(interno.chamadas).toBe(2)
  })

  it('o jitter: a espera fica entre metade do recuo e o recuo inteiro, conforme o sorteio', async () => {
    const baixo = montar((numero, sinal, perfil) => (numero === 1 ? falha('limite')(numero, sinal, perfil) : responde(numero, sinal, perfil)), { aleatorio: () => 0 })
    acompanhar(baixo.chamar('padrao'))
    await avancar(RECUO_MS / 2 - 1)
    expect(baixo.interno.chamadas).toBe(1)
    await avancar(1)
    expect(baixo.interno.chamadas).toBe(2)
    const alto = montar((numero, sinal, perfil) => (numero === 1 ? falha('limite')(numero, sinal, perfil) : responde(numero, sinal, perfil)), { aleatorio: () => 1 })
    acompanhar(alto.chamar('padrao'))
    await avancar(RECUO_MS - 1)
    expect(alto.interno.chamadas).toBe(1)
    await avancar(1)
    expect(alto.interno.chamadas).toBe(2)
  })

  it('429 com Retry-After dentro do prazo: espera o que o provedor pediu, e não o recuo', async () => {
    const { interno, chamar } = montar((numero, sinal, perfil) => (numero === 1 ? falha('limite', 3)(numero, sinal, perfil) : responde(numero, sinal, perfil)))
    acompanhar(chamar('padrao'))
    await avancar(2_999)
    expect(interno.chamadas).toBe(1)
    await avancar(1)
    expect(interno.chamadas).toBe(2)
  })

  it('429 com Retry-After além do prazo: nenhuma repetição, e a espera sugerida vai para quem chamou', async () => {
    const { interno, chamar } = montar(falha('limite', 90))
    const desfecho = await chamarEEsperar(chamar('padrao'), 120_000)
    expect(desfecho.erro).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', tenteDeNovoEmSegundos: 90 })
    expect(interno.chamadas).toBe(1)
  })

  it('o Retry-After é medido contra o prazo do perfil: 30 s cabem no `padrao` e não cabem no `rapido`', async () => {
    // As chamadas 1 (`padrao`) e 3 (`rapido`) dão 429 com 30 s; a 2 é a repetição do `padrao`.
    const { interno, chamar } = montar((numero, sinal, perfil) => (numero === 1 || numero === 3 ? falha('limite', 30)(numero, sinal, perfil) : responde(numero, sinal, perfil)))
    const padrao = acompanhar(chamar('padrao'))
    await avancar(30_000)
    expect(interno.chamadasPorPerfil).toEqual(['padrao', 'padrao'])
    expect(padrao.valor).toEqual(RESPOSTA)
    const rapido = await chamarEEsperar(chamar('rapido'), 60_000)
    expect(rapido.erro).toMatchObject({ tenteDeNovoEmSegundos: 30 })
    expect(interno.chamadasPorPerfil).toEqual(['padrao', 'padrao', 'rapido'])
  })

  it('conexão recusada: uma repetição, porque a chamada nem chegou ao provedor', async () => {
    const { interno, chamar } = montar(falha('recusada'))
    const desfecho = await chamarEEsperar(chamar('padrao'), 10_000)
    expect(codigoDe(desfecho)).toBe('IA_INDISPONIVEL')
    expect(interno.chamadas).toBe(2)
  })
})

describe('AdaptadorResiliente: o disjuntor', { timeout: LIMITE_DO_TESTE_MS }, () => {
  /** Faz `quantas` chamadas em fila, deixando o relógio andar `ms` depois de cada uma, e devolve o desfecho da última. */
  async function chamarEmFila(chamar: () => Promise<ModelResponse>, quantas: number, ms = 10): Promise<Desfecho> {
    let ultimo: Desfecho = { pendente: true }
    for (let vez = 0; vez < quantas; vez += 1) ultimo = await chamarEEsperar(chamar(), ms)
    return ultimo
  }

  it('cinco falhas abrem; a sexta sai sem pedido ao provedor, com o erro tipado', async () => {
    const { interno, chamar } = montar(falha('servidor'))
    await chamarEmFila(() => chamar('padrao'), FALHAS_PARA_ABRIR_O_DISJUNTOR - 1)
    // Com quatro, ainda fechado: a quinta chega ao provedor.
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR - 1)
    await chamarEmFila(() => chamar('padrao'), 1)
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR)
    const sexta = await chamarEEsperar(chamar('padrao'), 10)
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR)
    expect(sexta.erro).toBeInstanceOf(LLMError)
    expect(codigoDe(sexta)).toBe('IA_INDISPONIVEL')
  })

  it('meio-abre aos 30 s: uma chamada de teste passa; se der certo, fecha; se falhar, abre de novo', async () => {
    const { interno, chamar } = montar(falha('servidor'))
    await chamarEmFila(() => chamar('padrao'), FALHAS_PARA_ABRIR_O_DISJUNTOR)
    await avancar(MEIO_ABRE_O_DISJUNTOR_EM_MS - 100)
    await chamarEmFila(() => chamar('padrao'), 1)
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR)
    await avancar(100)
    // A chamada de teste sai, e falha: abre de novo, por outros 30 s.
    await chamarEmFila(() => chamar('padrao'), 1)
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR + 1)
    await chamarEmFila(() => chamar('padrao'), 1)
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR + 1)
    // O provedor volta: depois dos 30 s a de teste dá certo e o disjuntor fecha, deixando passar as seguintes.
    interno.comportamento = responde
    await avancar(MEIO_ABRE_O_DISJUNTOR_EM_MS)
    const teste = await chamarEmFila(() => chamar('padrao'), 1)
    expect(teste.valor).toEqual(RESPOSTA)
    await chamarEmFila(() => chamar('padrao'), 2)
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR + 4)
  })

  it('meio-aberto com a escola inteira chamando junto: só a de teste chega ao provedor, e as outras saem com o erro tipado', async () => {
    // O provedor segue fora: a chamada de teste leva 2 s para falhar, e as outras chegam enquanto ela está no ar.
    const { interno, chamar } = montar(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2_000))
      throw new ProviderError('servidor')
    })
    for (let vez = 0; vez < FALHAS_PARA_ABRIR_O_DISJUNTOR; vez += 1) await chamarEEsperar(chamar('padrao'), 3_000)
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR)
    await avancar(MEIO_ABRE_O_DISJUNTOR_EM_MS)

    const juntas = Array.from({ length: 6 }, () => acompanhar(chamar('padrao')))
    await avancar(10)
    // Só a de teste saiu para o provedor.
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR + 1)
    await avancar(3_000)
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR + 1)
    expect(juntas.every((desfecho) => !desfecho.pendente)).toBe(true)
    // A de teste falhou, e nenhuma delas deixou passar o erro do cockatiel: todas saem como IA_INDISPONIVEL.
    expect(juntas.map(codigoDe)).toEqual(Array(6).fill('IA_INDISPONIVEL'))
    juntas.forEach((desfecho) => expect(desfecho.erro).toBeInstanceOf(LLMError))
  })

  it('conexão recusada pesa: cinco chamadas abrem, e a sexta não sai (cada uma já tinha repetido uma vez)', async () => {
    const { interno, chamar } = montar(falha('recusada'))
    await chamarEmFila(() => chamar('padrao'), 5, 1_000)
    expect(interno.chamadas).toBe(10)
    const sexta = await chamarEEsperar(chamar('padrao'), 10_000)
    expect(codigoDe(sexta)).toBe('IA_INDISPONIVEL')
    expect(interno.chamadas).toBe(10)
  })

  it('timeout pesa: cinco chamadas que estouram o prazo abrem o disjuntor', async () => {
    const { interno, chamar } = montar(demora(200_000))
    for (let vez = 0; vez < FALHAS_PARA_ABRIR_O_DISJUNTOR; vez += 1) await chamarEEsperar(chamar('padrao'), PRAZOS.padrao)
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR)
    await chamarEEsperar(chamar('padrao'), 10)
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR)
  })

  it('cinco 429 não abrem: o provedor está de pé, só recusou', async () => {
    const { interno, chamar } = montar(falha('limite'))
    await chamarEmFila(() => chamar('padrao'), 5, 1_000)
    // Cada uma chamou duas vezes (a repetição do 429), e a sexta ainda chega ao provedor.
    expect(interno.chamadas).toBe(10)
    await chamarEmFila(() => chamar('padrao'), 1, 1_000)
    expect(interno.chamadas).toBe(12)
  })

  it('outro 4xx e erro de IA que não é do provedor também não pesam', async () => {
    const rejeitada = montar(falha('rejeitada'))
    await chamarEmFila(() => rejeitada.chamar('padrao'), 6)
    expect(rejeitada.interno.chamadas).toBe(6)
    const material = montar(erroDeIa('MATERIAL_INSUFICIENTE'))
    const ultimo = await chamarEmFila(() => material.chamar('padrao'), 6)
    expect(material.interno.chamadas).toBe(6)
    // O erro que não é do provedor passa como veio.
    expect(codigoDe(ultimo)).toBe('MATERIAL_INSUFICIENTE')
  })

  it('o `IA_INDISPONIVEL` de um adaptador sem classificação pesa como falha de servidor', async () => {
    const { interno, chamar } = montar(erroDeIa('IA_INDISPONIVEL'))
    await chamarEmFila(() => chamar('padrao'), FALHAS_PARA_ABRIR_O_DISJUNTOR)
    await chamarEmFila(() => chamar('padrao'), 1)
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR)
  })

  it('o `IA_TEMPO_ESGOTADO` de um adaptador sem classificação pesa como timeout', async () => {
    const { interno, chamar } = montar(erroDeIa('IA_TEMPO_ESGOTADO'))
    await chamarEmFila(() => chamar('padrao'), FALHAS_PARA_ABRIR_O_DISJUNTOR)
    await chamarEmFila(() => chamar('padrao'), 1)
    expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR)
  })

  it('é um disjuntor por perfil: o do `padrao` aberto não fecha o `rapido`, e o Tutor não cai com as ferramentas', async () => {
    const { interno, chamar } = montar((numero, sinal, perfil) => (perfil === 'padrao' ? falha('servidor')(numero, sinal, perfil) : responde(numero, sinal, perfil)))
    await chamarEmFila(() => chamar('padrao'), FALHAS_PARA_ABRIR_O_DISJUNTOR)
    await chamarEmFila(() => chamar('padrao'), 1)
    expect(interno.chamadasPorPerfil.filter((perfil) => perfil === 'padrao')).toHaveLength(FALHAS_PARA_ABRIR_O_DISJUNTOR)
    const rapido = await chamarEEsperar(chamar('rapido'), 10)
    expect(rapido.valor).toEqual(RESPOSTA)
    // E o contrário: o `rapido` segue fechado depois de uma chamada boa, e o `complexo` tem o seu.
    const complexo = await chamarEEsperar(chamar('complexo'), 10)
    expect(complexo.valor).toEqual(RESPOSTA)
  })

  it('é um disjuntor por modelo: o modelo menor tem o seu, no mesmo perfil', async () => {
    const { interno, chamar } = montar(falha('servidor'))
    await chamarEmFila(() => chamar('padrao'), FALHAS_PARA_ABRIR_O_DISJUNTOR)
    interno.modelo = 'modelo-menor'
    interno.comportamento = responde
    const doMenor = await chamarEEsperar(chamar('padrao'), 10)
    expect(doMenor.valor).toEqual(RESPOSTA)
  })

  describe('a chamada lenta', () => {
    it('no `rapido`, entre metade do prazo e o prazo a chamada vale e pesa: cinco delas abrem o disjuntor', async () => {
      const { interno, chamar } = montar(demora(12_000))
      for (let vez = 0; vez < FALHAS_PARA_ABRIR_O_DISJUNTOR; vez += 1) {
        const lenta = await chamarEEsperar(chamar('rapido'), 12_000)
        expect(lenta.valor).toEqual(RESPOSTA)
      }
      const sexta = await chamarEEsperar(chamar('rapido'), 10)
      expect(codigoDe(sexta)).toBe('IA_INDISPONIVEL')
      expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR)
    })

    it('exatamente a metade do prazo ainda não é lenta', async () => {
      const { interno, chamar } = montar(demora(PRAZOS.rapido / 2))
      for (let vez = 0; vez < FALHAS_PARA_ABRIR_O_DISJUNTOR + 1; vez += 1) await chamarEEsperar(chamar('rapido'), PRAZOS.rapido / 2)
      expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR + 1)
    })

    it('no `padrao`, a ferramenta normal de 50 s dos 60 não pesa: só o timeout conta', async () => {
      const { interno, chamar } = montar(demora(50_000))
      for (let vez = 0; vez < FALHAS_PARA_ABRIR_O_DISJUNTOR + 1; vez += 1) {
        const normal = await chamarEEsperar(chamar('padrao'), 50_000)
        expect(normal.valor).toEqual(RESPOSTA)
      }
      expect(interno.chamadas).toBe(FALHAS_PARA_ABRIR_O_DISJUNTOR + 1)
    })

    it('uma boa no meio zera a contagem: quatro lentas, uma rápida e quatro lentas não abrem', async () => {
      const { interno, chamar } = montar((numero, sinal, perfil) => (numero === 5 ? responde(numero, sinal, perfil) : demora(12_000)(numero, sinal, perfil)))
      for (let vez = 0; vez < 9; vez += 1) await chamarEEsperar(chamar('rapido'), 12_000)
      expect(interno.chamadas).toBe(9)
    })
  })
})

describe('AdaptadorResiliente: o que sobe', { timeout: LIMITE_DO_TESTE_MS }, () => {
  /** O erro que sobe é um `LLMError` simples: sem a classificação de dentro e sem erro do `cockatiel`. */
  function esperarErroDeIaSimples(desfecho: Desfecho, codigo: LLMErrorCode): void {
    const erro = desfecho.erro
    expect(erro).toBeInstanceOf(LLMError)
    expect(erro).not.toBeInstanceOf(ProviderError)
    expect(erro).not.toBeInstanceOf(TaskCancelledError)
    expect(erro).not.toBeInstanceOf(BrokenCircuitError)
    expect(erro).not.toHaveProperty('falha')
    expect(erro).toMatchObject({ codigoDeIa: codigo, codigo })
    expect((erro as LLMError).message).toBe(codigo)
  }

  it('o prazo, o disjuntor aberto, a desistência e a falha do provedor saem como erro tipado, nunca o do cockatiel ou o de dentro', async () => {
    const prazo = montar(demora(200_000))
    esperarErroDeIaSimples(await chamarEEsperar(prazo.chamar('padrao'), PRAZOS.padrao), 'IA_TEMPO_ESGOTADO')

    const aberto = montar(falha('servidor'))
    for (let vez = 0; vez < FALHAS_PARA_ABRIR_O_DISJUNTOR; vez += 1) await chamarEEsperar(aberto.chamar('padrao'), 10)
    esperarErroDeIaSimples(await chamarEEsperar(aberto.chamar('padrao'), 10), 'IA_INDISPONIVEL')

    const controle = new AbortController()
    const desistencia = acompanhar(montar(demora(200_000)).chamar('padrao', controle.signal))
    await avancar(10)
    controle.abort()
    await avancar(0)
    esperarErroDeIaSimples(desistencia, 'IA_TEMPO_ESGOTADO')

    esperarErroDeIaSimples(await chamarEEsperar(montar(falha('servidor')).chamar('padrao'), 10), 'IA_INDISPONIVEL')
  })

  it('o erro de dentro leva a espera sugerida adiante, e só ela', async () => {
    const { chamar } = montar(falha('limite', 90))
    const desfecho = await chamarEEsperar(chamar('padrao'), 10)
    esperarErroDeIaSimples(desfecho, 'IA_INDISPONIVEL')
    expect(desfecho.erro).toMatchObject({ tenteDeNovoEmSegundos: 90 })
  })

  it('a resposta boa passa inteira, e o adaptador diz a origem, o envio e o modelo do de dentro', async () => {
    const { adaptador, interno, chamar } = montar(responde)
    const desfecho = await chamarEEsperar(chamar('padrao'), 10)
    expect(desfecho.valor).toEqual(RESPOSTA)
    expect(adaptador.origem).toBe(interno.origem)
    expect(adaptador.envio).toBe(interno.envio)
    interno.modelo = 'outro'
    expect(adaptador.modeloDoPerfil('visao')).toBe('outro')
  })
})

describe('AdaptadorResiliente: saída inválida não é falha do provedor', { timeout: LIMITE_DO_TESTE_MS }, () => {
  it('cinco gerações com saída inválida não abrem o disjuntor: a sexta ainda chega ao modelo', async () => {
    // O provedor respondeu, na forma errada: quem barra é a validação da porta, que está acima do adaptador.
    const interno = new ScriptedAdapter(Array.from({ length: 12 }, () => 'isto não é um JSON'))
    const consumo = new InMemoryConsumo()
    const ia = withEscolaContextOfRequest(
      new LLMGateway({
        adaptador: new ResilientAdapter(interno, { prazosMs: PRAZOS, recuoMs: RECUO_MS, aleatorio: () => 1 }),
        registro: consumo,
        orcamento: new InMemoryOrcamento(consumo),
        suspensao: new InMemorySuspensoes(),
      }),
    )
    const gerar = () => ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    for (let vez = 0; vez < FALHAS_PARA_ABRIR_O_DISJUNTOR; vez += 1) {
      await expect(gerar()).rejects.toMatchObject({ codigoDeIa: 'IA_SAIDA_INVALIDA' })
    }
    expect(interno.chamadas).toBe(2 * FALHAS_PARA_ABRIR_O_DISJUNTOR)
    await expect(gerar()).rejects.toMatchObject({ codigoDeIa: 'IA_SAIDA_INVALIDA' })
    expect(interno.chamadas).toBe(2 * (FALHAS_PARA_ABRIR_O_DISJUNTOR + 1))
  })
})
