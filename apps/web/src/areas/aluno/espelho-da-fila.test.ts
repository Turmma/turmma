// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import type { EuResponse, QuestaoSalvaResponse } from '@educa/shared'
import type * as ModuloDaSessao from '../../api/sessao'
import type * as ModuloDasAtividades from '../../api/atividades-do-aluno'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { esquecerEspelhosDeOutroDono, esquecerTodosOsEspelhos, gravarEspelho, lerEspelho } from '../../api/espelho-da-fila'
import { euQueryOptions } from '../../api/eu'
import { criarFilaDeRespostas, filaDaAtividade } from './fila-de-respostas'

/**
 * O espelho da fila de respostas (53.0, RF21): a escolha que o servidor ainda não confirmou sobrevive ao F5, à aba
 * reaberta e à sessão que vence com o mesmo aluno, guardada só com ids em `sessionStorage`, e outra pessoa no mesmo
 * Chromebook nunca a vê. A sessão e o `PUT` são falsos; a fila, o espelho e o cache de consultas são os de verdade.
 */

// A sessão falsa: o teste decide em que estado ela está e dispara a troca, como `encerrarLocalmente` faz.
const sessaoFalsa = vi.hoisted(() => ({ estado: 'aberta' as string, aoTrocar: [] as (() => void)[] }))
vi.mock('../../api/sessao', async (original) => ({
  ...(await original<typeof ModuloDaSessao>()),
  aoTrocarDeSessao: (ouvinte: () => void) => {
    sessaoFalsa.aoTrocar.push(ouvinte)
    return () => undefined
  },
  estadoDaSessao: () => sessaoFalsa.estado,
}))

// O `PUT` da resposta, segurado: o teste diz quando o servidor aceita.
interface Envio {
  readonly atividade: string
  readonly questao: number
  readonly alternativa: number
  readonly sequencia: number
  readonly aceitar: () => void
}
const servidor = vi.hoisted(() => ({ envios: [] as unknown[] }))
vi.mock('../../api/atividades-do-aluno', async (original) => ({
  ...(await original<typeof ModuloDasAtividades>()),
  responderQuestao: (atividade: string, questao: number, alternativa: number, sequencia: number) =>
    new Promise<QuestaoSalvaResponse>((resolver) => {
      servidor.envios.push({ atividade, questao, alternativa, sequencia, aceitar: () => resolver({ questao, alternativa, sequencia, respondidaEm: '2026-10-22T13:10:00.000Z' }) })
    }),
}))
const envios = () => servidor.envios as Envio[]

const ALUNA = '0197a1c0-0000-7000-8000-00000000a001'
const OUTRO_ALUNO = '0197a1c0-0000-7000-8000-00000000a002'
const ATIVIDADE = '0197a1c0-0000-7000-8000-00000000b001'
const OUTRA_ATIVIDADE = '0197a1c0-0000-7000-8000-00000000b002'

const chaveDe = (atividade: string) => `educa.escolhas-pendentes.${atividade}`
const guardado = (atividade: string) => window.sessionStorage.getItem(chaveDe(atividade))
const assentar = () => new Promise<void>((resolver) => setTimeout(resolver, 0))

/** O cache da aba com o `/v1/eu` de quem está na sessão: é dele que a fila lê o dono. */
function abaDe(usuarioId: string | undefined): QueryClient {
  const cliente = new QueryClient()
  if (usuarioId !== undefined) {
    const eu: EuResponse = { usuarioId, papel: 'aluno', nome: 'Aluna Sintética', escola: { id: '0197a1c0-0000-7000-8000-00000000c001', nome: 'Escola Sintética', slug: 'escola-sintetica' }, inatividadeMin: 30, introducaoVistaEm: '2026-02-01T10:00:00.000Z', acessos: [] }
    cliente.setQueryData(euQueryOptions.queryKey, eu)
  }
  return cliente
}

/** O fim (ou a troca) da sessão desta aba, no estado dado. */
function trocarDeSessao(estado: string): void {
  sessaoFalsa.estado = estado
  for (const ouvinte of sessaoFalsa.aoTrocar) ouvinte()
}

beforeEach(() => {
  // As filas são uma por atividade e vivem no módulo, como na aba: a sessão vencida as para e as esquece, sem tocar no espelho.
  trocarDeSessao('vencida')
  window.sessionStorage.clear()
  servidor.envios.length = 0
  sessaoFalsa.estado = 'aberta'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a fila acompanha o espelho', () => {
  it('o próprio acesso ao sessionStorage que lança (modo restrito) também não derruba nada', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('negado', 'SecurityError')
    })
    const fila = criarFilaDeRespostas({ salvar: () => new Promise(() => undefined), aoSalvar: () => undefined, espelho: { atividade: ATIVIDADE, dono: () => ALUNA } })
    expect(() => fila.hidratar()).not.toThrow()
    expect(() => fila.escolher(1, 2)).not.toThrow()
    expect(fila.ler().pendentes).toEqual([{ questao: 1, alternativa: 2, sequencia: 1 }])
    expect(lerEspelho(ALUNA, ATIVIDADE)).toEqual([])
    expect(() => esquecerEspelhosDeOutroDono(ALUNA)).not.toThrow()
    expect(() => esquecerTodosOsEspelhos()).not.toThrow()
  })

  it('o armazenamento que lança (cota cheia, modo restrito) não derruba a fila: ela segue em memória, sem erro', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cota', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('negado', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('negado', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new DOMException('negado', 'SecurityError')
    })
    const fila = criarFilaDeRespostas({
      salvar: (questao, alternativa, sequencia) => new Promise((resolver) => resolver({ questao, alternativa, sequencia, respondidaEm: '2026-10-22T13:10:00.000Z' })),
      aoSalvar: () => undefined,
      espelho: { atividade: ATIVIDADE, dono: () => ALUNA },
    })
    expect(() => fila.hidratar()).not.toThrow()
    expect(() => fila.escolher(1, 2)).not.toThrow()
    expect(fila.ler().pendentes).toEqual([{ questao: 1, alternativa: 2, sequencia: 1 }])
    await assentar()
    expect(fila.ler()).toMatchObject({ pendentes: [], falha: undefined })
    expect(lerEspelho(ALUNA, ATIVIDADE)).toEqual([])
    expect(() => esquecerEspelhosDeOutroDono(ALUNA)).not.toThrow()
  })

  it('cada mudança das pendentes vai para o espelho, e a confirmação do servidor tira a pendente dele', async () => {
    const cliente = abaDe(ALUNA)
    const fila = filaDaAtividade(cliente, ATIVIDADE)
    fila.escolher(1, 2)
    fila.escolher(2, 0)
    expect(lerEspelho(ALUNA, ATIVIDADE)).toEqual([
      { questao: 1, alternativa: 2, sequencia: 1 },
      { questao: 2, alternativa: 0, sequencia: 1 },
    ])
    envios()[0]?.aceitar()
    await assentar()
    // A primeira foi confirmada: sai do espelho. A segunda, no ar, continua nele.
    expect(lerEspelho(ALUNA, ATIVIDADE)).toEqual([{ questao: 2, alternativa: 0, sequencia: 1 }])
    envios()[1]?.aceitar()
    await assentar()
    expect(guardado(ATIVIDADE)).toBeNull()
  })

  it('só grava quando as pendentes mudam: mandar a escolha não regrava o espelho', () => {
    const gravacoes = vi.spyOn(Storage.prototype, 'setItem')
    const fila = filaDaAtividade(abaDe(ALUNA), ATIVIDADE)
    fila.escolher(1, 2)
    // A escolha entrou (uma gravação) e saiu para o servidor (o `noAr` muda a fila, mas não as pendentes).
    expect(envios()).toHaveLength(1)
    expect(gravacoes).toHaveBeenCalledTimes(1)
  })

  it('a fila parada não hidrata nem manda, e a sem espelho não faz nada ao hidratar', () => {
    gravarEspelho(ALUNA, ATIVIDADE, [{ questao: 3, alternativa: 1, sequencia: 4 }])
    const parada = criarFilaDeRespostas({ salvar: () => new Promise(() => undefined), aoSalvar: () => undefined, espelho: { atividade: ATIVIDADE, dono: () => ALUNA } })
    parada.parar()
    parada.hidratar()
    expect(parada.ler().pendentes).toEqual([])
    // O espelho continua intacto: parar não é apagar.
    expect(lerEspelho(ALUNA, ATIVIDADE)).toHaveLength(1)
    gravarEspelho(ALUNA, ATIVIDADE, [{ questao: 3, alternativa: 1, sequencia: 4 }])
    const semEspelho = criarFilaDeRespostas({ salvar: () => new Promise(() => undefined), aoSalvar: () => undefined })
    expect(() => semEspelho.hidratar()).not.toThrow()
    expect(semEspelho.ler().pendentes).toEqual([])
  })

  it('sem saber quem é o aluno, nada é gravado; ao saber, o que ele já marcou entra no espelho', () => {
    const cliente = abaDe(undefined)
    const fila = filaDaAtividade(cliente, ATIVIDADE)
    fila.escolher(1, 2)
    expect(guardado(ATIVIDADE)).toBeNull()
    cliente.setQueryData(euQueryOptions.queryKey, { usuarioId: ALUNA, papel: 'aluno', nome: 'Aluna Sintética', escola: { id: '0197a1c0-0000-7000-8000-00000000c001', nome: 'Escola Sintética', slug: 'escola-sintetica' }, inatividadeMin: 30, introducaoVistaEm: '2026-02-01T10:00:00.000Z', acessos: [] })
    fila.hidratar()
    expect(lerEspelho(ALUNA, ATIVIDADE)).toEqual([{ questao: 1, alternativa: 2, sequencia: 1 }])
  })

  it('F5 com duas pendentes: a fila nova hidrata as duas, com a sequência, e as manda', async () => {
    gravarEspelho(ALUNA, ATIVIDADE, [
      { questao: 3, alternativa: 1, sequencia: 4 },
      { questao: 5, alternativa: 0, sequencia: 2 },
    ])
    const fila = filaDaAtividade(abaDe(ALUNA), ATIVIDADE)
    expect(fila.ler().pendentes).toEqual([])
    fila.hidratar()
    expect(fila.ler().pendentes).toEqual([
      { questao: 3, alternativa: 1, sequencia: 4 },
      { questao: 5, alternativa: 0, sequencia: 2 },
    ])
    expect(envios()[0]).toMatchObject({ atividade: ATIVIDADE, questao: 3, alternativa: 1, sequencia: 4 })
    envios()[0]?.aceitar()
    await assentar()
    expect(envios()[1]).toMatchObject({ atividade: ATIVIDADE, questao: 5, alternativa: 0, sequencia: 2 })
    // O clique seguinte sai uma acima da hidratada.
    fila.escolher(3, 2)
    expect(fila.ler().pendentes.find((pendente) => pendente.questao === 3)).toEqual({ questao: 3, alternativa: 2, sequencia: 5 })
  })

  it('outro dono, também na aba reaberta, em que o navegador devolve o armazenamento: descarta, nada é mandado nem mostrado', () => {
    gravarEspelho(OUTRO_ALUNO, ATIVIDADE, [{ questao: 3, alternativa: 1, sequencia: 4 }])
    gravarEspelho(OUTRO_ALUNO, OUTRA_ATIVIDADE, [{ questao: 1, alternativa: 0, sequencia: 1 }])
    const fila = filaDaAtividade(abaDe(ALUNA), ATIVIDADE)
    fila.hidratar()
    expect(fila.ler().pendentes).toEqual([])
    expect(envios()).toEqual([])
    // As da pessoa anterior saem inteiras, também as de atividades que esta aluna ainda nem abriu.
    expect(guardado(ATIVIDADE)).toBeNull()
    expect(guardado(OUTRA_ATIVIDADE)).toBeNull()
  })

  it('sem saber quem é o aluno, não hidrata nem apaga: o espelho espera', () => {
    gravarEspelho(ALUNA, ATIVIDADE, [{ questao: 3, alternativa: 1, sequencia: 4 }])
    const fila = filaDaAtividade(abaDe(undefined), ATIVIDADE)
    fila.hidratar()
    expect(fila.ler().pendentes).toEqual([])
    expect(envios()).toEqual([])
    expect(guardado(ATIVIDADE)).not.toBeNull()
  })

  it('duas atividades: cada fila hidrata a sua', () => {
    gravarEspelho(ALUNA, ATIVIDADE, [{ questao: 1, alternativa: 0, sequencia: 1 }])
    gravarEspelho(ALUNA, OUTRA_ATIVIDADE, [{ questao: 2, alternativa: 3, sequencia: 6 }])
    const cliente = abaDe(ALUNA)
    const primeira = filaDaAtividade(cliente, ATIVIDADE)
    const segunda = filaDaAtividade(cliente, OUTRA_ATIVIDADE)
    primeira.hidratar()
    segunda.hidratar()
    expect(primeira.ler().pendentes).toEqual([{ questao: 1, alternativa: 0, sequencia: 1 }])
    expect(segunda.ler().pendentes).toEqual([{ questao: 2, alternativa: 3, sequencia: 6 }])
    expect(envios().map(({ atividade, questao }) => [atividade, questao])).toEqual([
      [ATIVIDADE, 1],
      [OUTRA_ATIVIDADE, 2],
    ])
  })
})

describe('o que acontece com o espelho quando a sessão acaba', () => {
  it('sessão vencida e o mesmo aluno volta: as pendentes ficam e saem', async () => {
    const primeira = filaDaAtividade(abaDe(ALUNA), ATIVIDADE)
    primeira.escolher(1, 2)
    primeira.escolher(2, 0)
    // A rede caiu e a sessão venceu: a fila da memória para, o espelho fica.
    trocarDeSessao('vencida')
    expect(primeira.ler().pendentes).toEqual([])
    expect(lerEspelho(ALUNA, ATIVIDADE)).toEqual([
      { questao: 1, alternativa: 2, sequencia: 1 },
      { questao: 2, alternativa: 0, sequencia: 1 },
    ])
    // A resposta atrasada da fila parada não mexe em nada, nem no espelho.
    envios()[0]?.aceitar()
    await assentar()
    expect(lerEspelho(ALUNA, ATIVIDADE)).toHaveLength(2)

    // O mesmo aluno entra por cima: a fila nova, do mesmo aluno, hidrata e manda as duas.
    trocarDeSessao('aberta')
    const segunda = filaDaAtividade(abaDe(ALUNA), ATIVIDADE)
    expect(segunda).not.toBe(primeira)
    segunda.hidratar()
    expect(segunda.ler().pendentes).toEqual([
      { questao: 1, alternativa: 2, sequencia: 1 },
      { questao: 2, alternativa: 0, sequencia: 1 },
    ])
    expect(envios()[1]).toMatchObject({ atividade: ATIVIDADE, questao: 1, alternativa: 2, sequencia: 1 })
  })

  it('sessão vencida e entra outra pessoa: nada da anterior é mandado nem mostrado, e o espelho dela sai', () => {
    const primeira = filaDaAtividade(abaDe(ALUNA), ATIVIDADE)
    primeira.escolher(1, 2)
    trocarDeSessao('vencida')
    trocarDeSessao('aberta')
    const outra = filaDaAtividade(abaDe(OUTRO_ALUNO), ATIVIDADE)
    outra.hidratar()
    expect(outra.ler().pendentes).toEqual([])
    expect(envios()).toHaveLength(1)
    expect(guardado(ATIVIDADE)).toBeNull()
  })
})
