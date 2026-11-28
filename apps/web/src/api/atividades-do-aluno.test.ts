import { ErrorCode } from '@educa/shared'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A prova do aluno na API da web (avaliacao-e-correcao, 12.0): a web **tolera o campo a mais** que a API ganhar, mas continua a conferir por inteiro o que o contrato conhece, e a tela de foco
 * **só lê**: a prova que ainda não começou é `ProvaNaoComecou`, e repetir a leitura não a faz começar. A rede é falsa; a regra sob teste é a da web. O módulo é recarregado em cada teste.
 */
const ID = '0197a1c0-0000-7000-8000-000000000001'
let fila: { status: number; corpo?: unknown }[] = []
const importar = async () => ({ api: await import('./atividades-do-aluno'), sessao: await import('./sessao'), client: await import('./client') })
let modulos: Awaited<ReturnType<typeof importar>>

const questao = (numero: number) => ({ numero, enunciado: `Enunciado ${String(numero)}`, alternativas: ['Quatro', 'Cinco', 'Seis', 'Sete'], ordemDasAlternativas: [0, 1, 2, 3] })
const emAndamento = (extra: Record<string, unknown> = {}) => ({
  comecou: true,
  atividadeAplicadaId: ID,
  titulo: 'Prova sintética',
  avaliativa: true,
  estado: 'aberta',
  adaptacao: null,
  questoes: [questao(1), questao(2)],
  respostas: [{ questao: 1, alternativa: 2, sequencia: 1 }],
  enviadaEm: null,
  tempo: { limiteEm: '2026-11-28T14:00:00.000Z', agora: '2026-11-28T13:00:00.000Z', envio: null },
  ...extra,
})

beforeEach(async () => {
  fila = []
  vi.resetModules()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const preparada = fila.shift()
      if (preparada === undefined) throw new Error('chamada sem resposta preparada')
      return new Response(preparada.corpo === undefined ? null : JSON.stringify(preparada.corpo), { status: preparada.status })
    }),
  )
  modulos = await importar()
  fila.push({ status: 200, corpo: { token: 'token-de-acesso', expiraEm: new Date(Date.now() + 600_000).toISOString() } })
  await modulos.sessao.openSessaoPeloCookie()
})

afterEach(() => {
  vi.unstubAllGlobals()
  expect(fila, 'resposta preparada que nenhuma chamada consumiu').toHaveLength(0)
})

const ler = (): Promise<unknown> => new QueryClient().fetchQuery({ ...modulos.api.provaEmFocoQueryOptions(ID), retry: false })

describe('a prova da tela de foco só lê, e tolera o campo a mais', () => {
  it('o campo a mais da API (na prova, na questão, na resposta e no tempo) não derruba a prova', async () => {
    fila.push({
      status: 200,
      corpo: emAndamento({
        campoNovo: 'x',
        questoes: [{ ...questao(1), dicaNova: 1 }, questao(2)],
        respostas: [{ questao: 1, alternativa: 2, sequencia: 1, outroCampo: true }],
        tempo: { limiteEm: null, agora: '2026-11-28T13:00:00.000Z', envio: null, maisUm: 1 },
      }),
    })

    const lida = (await ler()) as { questoes: unknown[]; respostas: unknown[]; titulo: string }

    expect(lida.titulo).toBe('Prova sintética')
    expect(lida.questoes).toEqual([questao(1), questao(2)])
    expect(lida.respostas).toEqual([{ questao: 1, alternativa: 2, sequencia: 1 }])
  })

  it('o que o contrato conhece continua conferido por inteiro: campo que falta ou de tipo errado, e corpo que não é objeto, são recusados', async () => {
    const recusadas: unknown[] = [
      emAndamento({ titulo: 7 }),
      emAndamento({ questoes: [{ numero: 1 }] }),
      emAndamento({ questoes: 'x' }),
      emAndamento({ questoes: [null] }),
      emAndamento({ respostas: [{ questao: 'a' }] }),
      emAndamento({ respostas: 'x' }),
      emAndamento({ tempo: 'x' }),
      emAndamento({ tempo: null }),
      'x',
      [],
      null,
    ]
    for (const corpo of recusadas) {
      fila.push({ status: 200, corpo })
      await expect(ler()).rejects.toMatchObject({ name: 'ApiError', codigo: ErrorCode.ERRO_INTERNO })
    }
  })

  it('o tempo tolera o campo a mais, e o desvio é o `agora` do servidor menos o instante em que a resposta chegou', async () => {
    fila.push({ status: 200, corpo: { limiteEm: '2026-11-28T14:00:00.000Z', agora: '2026-11-28T13:00:00.000Z', envio: null, novo: 1 } })

    const lido = await new QueryClient().fetchQuery(modulos.api.tempoDaProvaQueryOptions(ID))

    expect(lido).toMatchObject({ limiteEm: '2026-11-28T14:00:00.000Z', envio: null })
    // O desvio é pequeno em módulo e igual a (agora do servidor) - (agora do computador): 2026-11-28 13:00 UTC é no passado ou futuro conforme o relógio da máquina, e basta conferir a conta.
    expect(lido.desvioMs + Date.now()).toBeGreaterThan(Date.parse('2026-11-28T13:00:00.000Z') - 5_000)
    expect(lido.desvioMs + Date.now()).toBeLessThan(Date.parse('2026-11-28T13:00:00.000Z') + 5_000)
    expect(modulos.api.tempoLido({ limiteEm: null, agora: '2026-11-28T13:00:10.000Z', envio: null }, Date.parse('2026-11-28T13:00:00.000Z')).desvioMs).toBe(10_000)
  })

  it('a prova que ainda não começou é ProvaNaoComecou: a tela de foco não a começa, e a leitura não se repete', async () => {
    fila.push({ status: 200, corpo: { comecou: false, atividadeAplicadaId: ID, titulo: 'Prova sintética', janela: { abreEm: '2026-11-28T12:00:00.000Z', fechaEm: '2026-11-28T15:00:00.000Z' }, duracaoMin: 60 } })

    const erro = await ler().catch((falha: unknown) => falha)
    const opcoes = modulos.api.provaEmFocoQueryOptions(ID)
    const repetir = opcoes.retry as (falhas: number, erro: unknown) => boolean

    expect(erro).toBeInstanceOf(modulos.api.ProvaNaoComecou)
    expect(repetir(0, erro)).toBe(false)
    // O 503 de verdade segue a regra do cliente de consultas: tenta de novo.
    expect(repetir(0, new modulos.client.ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toBe(true)
    expect(repetir(0, new modulos.client.ApiError(ErrorCode.NAO_ENCONTRADO))).toBe(false)
  })
})
