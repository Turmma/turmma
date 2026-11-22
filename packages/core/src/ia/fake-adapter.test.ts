import { describe, expect, it } from 'vitest'
import { LLMError } from './errors.js'
import { FakeAdapter } from './fake-adapter.js'
import { entradaDeAtividade, entradaDoTutor } from './__fixtures__/inputs.js'
import { gerarAtividadeObjetiva } from './tasks/gerar-atividade-objetiva.js'
import { turnoDoTutor } from './tasks/turno-do-tutor.js'

// O prazo do sinal é curto de propósito: a espera simulada que passa dele vira `IA_TEMPO_ESGOTADO`, e a que cabe termina. Prova a espera sem depender do relógio.
const ESPERA_QUE_NAO_CABE_MS = 5_000
const ESPERA_QUE_CABE_MS = 5
const PRAZO_DO_SINAL_MS = 150

const chamarTutor = (adaptador: FakeAdapter) => adaptador.chamar({ tarefa: turnoDoTutor, entrada: entradaDoTutor('Como acho o reagente limitante?'), sinal: AbortSignal.timeout(PRAZO_DO_SINAL_MS) })
const chamarFerramenta = (adaptador: FakeAdapter) => adaptador.chamar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), sinal: AbortSignal.timeout(PRAZO_DO_SINAL_MS) })

/** O código de IA com que a chamada terminou, ou `undefined` se ela terminou bem. */
async function terminouCom(chamada: Promise<unknown>): Promise<string | undefined> {
  const erro: unknown = await chamada.then(
    () => undefined,
    (motivo: unknown) => motivo,
  )
  if (erro === undefined) return undefined
  if (!(erro instanceof LLMError)) throw new Error('a chamada deveria terminar bem ou com erro de IA')
  return erro.codigoDeIa
}

describe('FakeAdapter: a identidade (reserva-e-avaliacao, 1.0)', () => {
  it('o principal é `falso`, e a reserva, que não envia nada como ele, assume a identidade que a configuração dá', () => {
    expect(new FakeAdapter().identidade).toBe('falso')
    expect(new FakeAdapter({ latenciaMs: 5 }).identidade).toBe('falso')
    expect(new FakeAdapter({ identidade: 'falso-reserva' }).identidade).toBe('falso-reserva')
    // As duas são falsas: nenhuma envia, e por isso o `envio` não as distingue. É a identidade que as distingue.
    expect(new FakeAdapter({ identidade: 'falso-reserva' }).envio).toEqual(new FakeAdapter().envio)
  })

  it('a identidade não muda o que o falso responde nem o modelo que ele diz', async () => {
    const principal = await chamarFerramenta(new FakeAdapter())
    const reserva = await chamarFerramenta(new FakeAdapter({ identidade: 'falso-reserva' }))
    expect(reserva).toEqual(principal)
  })
})

describe('FakeAdapter: a espera simulada por perfil (a carga da manhã, X6, 11.0)', () => {
  it('o `padrao` (a ferramenta) espera a latência do perfil dele, e o `rapido` (o turno do Tutor) a dos outros', async () => {
    expect(turnoDoTutor.perfil).toBe('rapido')
    expect(gerarAtividadeObjetiva.perfil).toBe('padrao')
    const adaptador = new FakeAdapter({ latenciaMs: ESPERA_QUE_CABE_MS, latenciaMsPadrao: ESPERA_QUE_NAO_CABE_MS })
    expect(await terminouCom(chamarTutor(adaptador))).toBeUndefined()
    expect(await terminouCom(chamarFerramenta(adaptador))).toBe('IA_TEMPO_ESGOTADO')
  })

  it('a latência do `padrao` não vale para o `rapido`, e o `padrao` com a sua própria menor espera menos que a de todos', async () => {
    expect(await terminouCom(chamarTutor(new FakeAdapter({ latenciaMsPadrao: ESPERA_QUE_NAO_CABE_MS })))).toBeUndefined()
    const soAsDosOutros = new FakeAdapter({ latenciaMs: ESPERA_QUE_NAO_CABE_MS, latenciaMsPadrao: ESPERA_QUE_CABE_MS })
    expect(await terminouCom(chamarFerramenta(soAsDosOutros))).toBeUndefined()
    expect(await terminouCom(chamarTutor(soAsDosOutros))).toBe('IA_TEMPO_ESGOTADO')
  })

  it('sem a latência do `padrao`, ele espera a de todos os perfis; e sem nenhuma das duas, ninguém espera', async () => {
    const soADeTodos = new FakeAdapter({ latenciaMs: ESPERA_QUE_NAO_CABE_MS })
    expect(await terminouCom(chamarFerramenta(soADeTodos))).toBe('IA_TEMPO_ESGOTADO')
    expect(await terminouCom(chamarTutor(soADeTodos))).toBe('IA_TEMPO_ESGOTADO')
    const semEspera = new FakeAdapter()
    expect(await terminouCom(chamarFerramenta(semEspera))).toBeUndefined()
    expect(await terminouCom(chamarTutor(semEspera))).toBeUndefined()
  })
})

describe('FakeAdapter: os tokens que ele informa (a carga da manhã, X6, 11.0)', () => {
  it('informa os 3.000 + 250 da carga em toda chamada, de qualquer perfil', async () => {
    const informando = new FakeAdapter({ tokens: { entrada: 3_000, saida: 250 } })
    for (const resposta of [await chamarTutor(informando), await chamarFerramenta(informando)]) {
      expect(resposta).toMatchObject({ tokensDeEntrada: 3_000, tokensDeSaida: 250 })
    }
  })

  it('sem eles estima pelo tamanho do texto, que é o que a medição sempre fez', async () => {
    const estimando = await chamarTutor(new FakeAdapter())
    expect(estimando.tokensDeEntrada).toBe(Math.ceil(JSON.stringify(entradaDoTutor('Como acho o reagente limitante?')).length / 4))
    expect(estimando.tokensDeSaida).toBe(Math.ceil(estimando.texto.length / 4))
  })
})
