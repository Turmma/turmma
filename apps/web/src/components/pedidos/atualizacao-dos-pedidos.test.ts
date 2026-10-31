import { MAXIMO_DE_PEDIDOS_POR_DECISAO, type PedidoDaTurma } from '@educa/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  agendarAtualizacao,
  alternarMarca,
  atualizaSozinha,
  INTERVALO_DA_ATUALIZACAO_MS,
  pedidosQueContinuam,
  podeMarcarMais,
  quantosNovos,
  semOsDecididos,
  type AbaDoNavegador,
} from './atualizacao-dos-pedidos'

/**
 * W15 (A1, 16.0; `tasks/prd-apresentacao-escola/cenarios.md`): a atualização da lista de pedidos, com relógio falso e
 * `visibilitychange`, e o que sobrevive a ela. O foco que fica onde está e o anúncio na região viva são do navegador, e
 * estão no e2e (`e2e/pedidos.spec.ts`): a web não tem ambiente de DOM na unidade.
 */

/** A aba do navegador, de mentira: o teste a esconde e a mostra, e ela avisa quem está ouvindo. */
function abaDeMentira(inicio: 'visible' | 'hidden' = 'visible') {
  const ouvintes = new Set<() => void>()
  const aba = {
    visibilityState: inicio,
    addEventListener: (_tipo: 'visibilitychange', ouvinte: () => void) => void ouvintes.add(ouvinte),
    removeEventListener: (_tipo: 'visibilitychange', ouvinte: () => void) => void ouvintes.delete(ouvinte),
  } satisfies AbaDoNavegador as { visibilityState: 'visible' | 'hidden' } & AbaDoNavegador
  return {
    aba,
    ouvintes,
    mudarPara(estado: 'visible' | 'hidden'): void {
      aba.visibilityState = estado
      for (const ouvinte of ouvintes) ouvinte()
    },
  }
}

const pedido = (id: string, nome = `Aluno ${id}`): PedidoDaTurma => ({ id, nome, solicitadaEm: '2026-10-02T13:00:00.000Z', teveMatriculaErrada: false })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('W15: a lista do professor se atualiza a cada 15 s, só com a aba à vista', () => {
  it('o intervalo é de 15 segundos', () => {
    expect(INTERVALO_DA_ATUALIZACAO_MS).toBe(15_000)
  })

  it('com a aba à vista, uma leitura a cada 15 s: nenhuma antes, quatro em um minuto', () => {
    const atualizar = vi.fn()
    const { aba } = abaDeMentira()
    agendarAtualizacao('professor', atualizar, aba)
    vi.advanceTimersByTime(14_999)
    expect(atualizar).toHaveBeenCalledTimes(0)
    vi.advanceTimersByTime(1)
    expect(atualizar).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(45_000)
    expect(atualizar).toHaveBeenCalledTimes(4)
  })

  it('com a aba escondida, para: nenhuma leitura enquanto ela não volta; de volta, relê na hora e recomeça a contagem', () => {
    const atualizar = vi.fn()
    const { aba, mudarPara } = abaDeMentira()
    agendarAtualizacao('professor', atualizar, aba)
    vi.advanceTimersByTime(20_000)
    expect(atualizar).toHaveBeenCalledTimes(1)

    mudarPara('hidden')
    vi.advanceTimersByTime(10 * 60_000)
    expect(atualizar).toHaveBeenCalledTimes(1)

    mudarPara('visible')
    expect(atualizar).toHaveBeenCalledTimes(2)
    // A contagem recomeça da volta: a leitura seguinte vem 15 s depois dela, e não nos 10 s que faltavam antes de esconder.
    vi.advanceTimersByTime(14_999)
    expect(atualizar).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(1)
    expect(atualizar).toHaveBeenCalledTimes(3)
  })

  it('a turma aberta com a aba já escondida não lê nada até a aba aparecer', () => {
    const atualizar = vi.fn()
    const { aba, mudarPara } = abaDeMentira('hidden')
    agendarAtualizacao('professor', atualizar, aba)
    vi.advanceTimersByTime(60_000)
    expect(atualizar).toHaveBeenCalledTimes(0)
    mudarPara('visible')
    expect(atualizar).toHaveBeenCalledTimes(1)
  })

  it('quando a lista sai da tela, a atualização para e deixa de ouvir a aba', () => {
    const atualizar = vi.fn()
    const { aba, ouvintes, mudarPara } = abaDeMentira()
    const parar = agendarAtualizacao('professor', atualizar, aba)
    expect(ouvintes.size).toBe(1)
    parar()
    expect(ouvintes.size).toBe(0)
    vi.advanceTimersByTime(60_000)
    mudarPara('hidden')
    mudarPara('visible')
    expect(atualizar).toHaveBeenCalledTimes(0)
  })
})

describe('W15: a coordenação não tem leitura sem o clique', () => {
  it('nenhuma leitura sai em 60 s com a aba à vista, nem quando a aba volta: nada é agendado e ninguém ouve a aba', () => {
    const atualizar = vi.fn()
    const { aba, ouvintes, mudarPara } = abaDeMentira()
    const parar = agendarAtualizacao('coordenacao', atualizar, aba)
    vi.advanceTimersByTime(60_000)
    mudarPara('hidden')
    mudarPara('visible')
    vi.advanceTimersByTime(60_000)
    expect(atualizar).toHaveBeenCalledTimes(0)
    expect(ouvintes.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    parar()
  })

  it('só a lista do professor se atualiza sozinha', () => {
    expect(atualizaSozinha('professor')).toBe(true)
    expect(atualizaSozinha('coordenacao')).toBe(false)
  })
})

describe('W15: o que a atualização mantém', () => {
  it('a marcação é por id: a lista que chega em outra ordem, com pedidos novos, mantém marcados os mesmos pedidos, e não os da mesma posição', () => {
    const antes = [pedido('a'), pedido('b'), pedido('c')]
    const marcados = ['b', 'c']
    expect(pedidosQueContinuam(marcados, antes).map(({ id }) => id)).toEqual(['b', 'c'])
    // A atualização traz um pedido novo na frente e outro no fim: as posições 1 e 2 agora são `a` e `b`.
    const depois = [pedido('novo-1'), pedido('a'), pedido('b'), pedido('c'), pedido('novo-2')]
    expect(pedidosQueContinuam(marcados, depois).map(({ id }) => id)).toEqual(['b', 'c'])
  })

  it('o pedido que outra pessoa decidiu sai da marcação e do diálogo aberto, e os outros ids do diálogo ficam', () => {
    const idsDoDialogo = ['a', 'b', 'c']
    const depois = [pedido('a'), pedido('c'), pedido('d')]
    expect(pedidosQueContinuam(idsDoDialogo, depois).map(({ id }) => id)).toEqual(['a', 'c'])
    expect(pedidosQueContinuam(idsDoDialogo, [])).toEqual([])
  })

  it('a resposta da decisão tira da marcação cada id dela, qualquer que seja o resultado, e deixa os outros', () => {
    const resposta = {
      resultados: [
        { id: '00000000-0000-4000-8000-00000000000a', resultado: 'decidida' as const },
        { id: '00000000-0000-4000-8000-00000000000b', resultado: 'ja_decidida' as const },
        { id: '00000000-0000-4000-8000-00000000000c', resultado: 'nao_encontrada' as const },
      ],
    }
    const marcados = ['00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000c', 'fora-da-decisao']
    expect(semOsDecididos(marcados, resposta)).toEqual(['fora-da-decisao'])
    // A lista velha que ainda traz os decididos não os marca de novo: a marcação é por id, e eles saíram dela.
    expect(pedidosQueContinuam(semOsDecididos(marcados, resposta), [pedido('00000000-0000-4000-8000-00000000000a')])).toEqual([])
    expect(semOsDecididos(marcados, { resultados: [] })).toEqual(marcados)
  })

  it('os pedidos novos são contados pelo id: o que já estava não é novo, e o que saiu não conta', () => {
    const anteriores = new Set(['a', 'b'])
    expect(quantosNovos(anteriores, [pedido('a'), pedido('b')])).toBe(0)
    expect(quantosNovos(anteriores, [pedido('b'), pedido('c'), pedido('d')])).toBe(2)
    expect(quantosNovos(anteriores, [])).toBe(0)
  })
})

describe('W6: até 40 pedidos por decisão', () => {
  const quarenta = Array.from({ length: MAXIMO_DE_PEDIDOS_POR_DECISAO }, (_, indice) => `id-${String(indice)}`)

  it('o limite é o do contrato: 40', () => {
    expect(MAXIMO_DE_PEDIDOS_POR_DECISAO).toBe(40)
    expect(podeMarcarMais(39)).toBe(true)
    expect(podeMarcarMais(40)).toBe(false)
  })

  it('marca o que não estava e desmarca o que estava', () => {
    expect(alternarMarca([], 'a')).toEqual(['a'])
    expect(alternarMarca(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('o 41º não é marcado; desmarcar um dos 40 continua valendo, e abre lugar para outro', () => {
    expect(alternarMarca(quarenta, 'o-41')).toEqual(quarenta)
    const trintaENove = alternarMarca(quarenta, 'id-0')
    expect(trintaENove).toHaveLength(39)
    expect(alternarMarca(trintaENove, 'o-41')).toContain('o-41')
  })
})
