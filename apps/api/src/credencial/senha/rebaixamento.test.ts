import { METRICS } from '@educa/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../../../tools/testes/metricas.ts'
import type { ContagemNaJanela } from './contador-em-janela.js'
import { LimiteDoEmailPorIp } from './limite-email-ip.js'
import { LIMIAR_MINIMO_DE_FALHAS_POR_IP, limiarDeFalhas, RebaixamentoPorEscola, SERIE_REBAIXADA_ESQUECIDA_APOS_MS, VALIDADE_DO_TAMANHO_DA_ESCOLA_MS } from './rebaixamento.js'

const ESCOLA_A = '0190f5a0-0000-7000-8000-00000000000a'
const ESCOLA_B = '0190f5a0-0000-7000-8000-00000000000b'
const IP_DA_ESCOLA = '203.0.113.10'

/** Os contadores por IP em memória, com a marca de seguro que o teste escolhe: a regra de limiar é o que se prova aqui. */
class JanelaDeTeste {
  readonly valores = new Map<string, number>()
  doSeguro = false

  chaveDe(prefixo: string, identificador: string): string {
    return `${prefixo}:${identificador}`
  }

  ler(chave: string): Promise<ContagemNaJanela> {
    return Promise.resolve({ valor: this.valores.get(chave) ?? 0, doSeguro: this.doSeguro })
  }

  somar(chave: string): Promise<ContagemNaJanela> {
    const valor = (this.valores.get(chave) ?? 0) + 1
    this.valores.set(chave, valor)
    return Promise.resolve({ valor, doSeguro: this.doSeguro })
  }
}

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

describe('limiar de falhas por IP numa escola: max(100, 25% dos alunos ativos)', () => {
  it('escola pequena fica no piso de 100; a de 400 alunos também; a de 1.000 vai a 250; e a fração arredonda para cima', () => {
    expect([limiarDeFalhas(0), limiarDeFalhas(120), limiarDeFalhas(400), limiarDeFalhas(1_000), limiarDeFalhas(1_001)]).toEqual([100, 100, 100, 250, 251])
    expect(LIMIAR_MINIMO_DE_FALHAS_POR_IP).toBe(100)
  })
})

describe('RebaixamentoPorEscola', () => {
  function montar(alunos: Record<string, number>, instancias = 2) {
    const janela = new JanelaDeTeste()
    const relogio = relogioParado()
    let escolaDoContexto = ESCOLA_A
    const alunosAtivos = vi.fn(() => Promise.resolve(alunos[escolaDoContexto] ?? 0))
    const rebaixamento = new RebaixamentoPorEscola({ janela, alunosAtivos, instancias, medidor: medidor.medidor, relogio })
    const falhas = async (ip: string, escolaId: string, quantidade: number) => {
      escolaDoContexto = escolaId
      for (let falha = 0; falha < quantidade; falha++) await rebaixamento.contarFalha(ip, escolaId)
    }
    const rebaixar = (ip: string, escolaId: string, conhecido = false) => {
      escolaDoContexto = escolaId
      return rebaixamento.rebaixar(ip, escolaId, conhecido)
    }
    return { janela, relogio, alunosAtivos, falhas, rebaixar }
  }

  async function serieDa(escolaId: string): Promise<number | undefined> {
    const ponto = (await medidor.pontos(METRICS.prioridadeRebaixada)).find(({ atributos }) => atributos['escola_id'] === escolaId)
    return typeof ponto?.valor === 'number' ? ponto.valor : undefined
  }

  it('100 falhas de um IP na escola não rebaixam; a 101ª rebaixa, e a série da escola vai a 1', async () => {
    const { falhas, rebaixar } = montar({ [ESCOLA_A]: 30 })
    await falhas(IP_DA_ESCOLA, ESCOLA_A, 100)
    expect(await rebaixar(IP_DA_ESCOLA, ESCOLA_A)).toBe(false)
    expect(await serieDa(ESCOLA_A)).toBeUndefined()
    await falhas(IP_DA_ESCOLA, ESCOLA_A, 1)
    expect(await rebaixar(IP_DA_ESCOLA, ESCOLA_A)).toBe(true)
    expect(await serieDa(ESCOLA_A)).toBe(1)
  })

  it('escola de 1.000 alunos: 250 falhas de um IP ainda não rebaixam (25% dos alunos), a 251ª sim', async () => {
    const { falhas, rebaixar } = montar({ [ESCOLA_A]: 1_000 })
    await falhas(IP_DA_ESCOLA, ESCOLA_A, 250)
    expect(await rebaixar(IP_DA_ESCOLA, ESCOLA_A)).toBe(false)
    await falhas(IP_DA_ESCOLA, ESCOLA_A, 1)
    expect(await rebaixar(IP_DA_ESCOLA, ESCOLA_A)).toBe(true)
  })

  it('isolamento: a escola está na chave; falhas do IP na A não rebaixam o mesmo IP na B, e a série da B não nasce', async () => {
    const { falhas, rebaixar } = montar({ [ESCOLA_A]: 30, [ESCOLA_B]: 30 })
    await falhas(IP_DA_ESCOLA, ESCOLA_A, 150)
    expect(await rebaixar(IP_DA_ESCOLA, ESCOLA_A)).toBe(true)
    expect(await rebaixar(IP_DA_ESCOLA, ESCOLA_B)).toBe(false)
    expect([await serieDa(ESCOLA_A), await serieDa(ESCOLA_B)]).toEqual([1, undefined])
  })

  it('passagem: com o cookie de dispositivo daquela matrícula, não rebaixa, mesmo com o IP acima do limiar', async () => {
    const { falhas, rebaixar } = montar({ [ESCOLA_A]: 30 })
    await falhas(IP_DA_ESCOLA, ESCOLA_A, 150)
    expect(await rebaixar(IP_DA_ESCOLA, ESCOLA_A, true)).toBe(false)
    expect(await serieDa(ESCOLA_A)).toBeUndefined()
  })

  it('seguro (Redis de fila fora): a contagem é de uma instância, e o limiar é dividido pelas instâncias', async () => {
    const { janela, falhas, rebaixar } = montar({ [ESCOLA_A]: 30 }, 2)
    janela.doSeguro = true
    await falhas(IP_DA_ESCOLA, ESCOLA_A, 50)
    expect(await rebaixar(IP_DA_ESCOLA, ESCOLA_A)).toBe(false)
    await falhas(IP_DA_ESCOLA, ESCOLA_A, 1)
    expect(await rebaixar(IP_DA_ESCOLA, ESCOLA_A)).toBe(true)
  })

  it('o tamanho da escola só é lido acima de 100 falhas, e fica em cache por 1 min', async () => {
    const { falhas, rebaixar, alunosAtivos, relogio } = montar({ [ESCOLA_A]: 30 })
    await falhas(IP_DA_ESCOLA, ESCOLA_A, 100)
    await rebaixar(IP_DA_ESCOLA, ESCOLA_A)
    expect(alunosAtivos).not.toHaveBeenCalled()
    await falhas(IP_DA_ESCOLA, ESCOLA_A, 1)
    await rebaixar(IP_DA_ESCOLA, ESCOLA_A)
    await rebaixar(IP_DA_ESCOLA, ESCOLA_A)
    expect(alunosAtivos).toHaveBeenCalledTimes(1)
    relogio.avancar(VALIDADE_DO_TAMANHO_DA_ESCOLA_MS)
    await rebaixar(IP_DA_ESCOLA, ESCOLA_A)
    expect(alunosAtivos).toHaveBeenCalledTimes(2)
  })

  it('carga: com o cache vencido, os pedidos que chegam juntos fazem uma leitura só do tamanho da escola', async () => {
    const { falhas, rebaixar, alunosAtivos } = montar({ [ESCOLA_A]: 30 })
    await falhas(IP_DA_ESCOLA, ESCOLA_A, 101)
    expect(await Promise.all(Array.from({ length: 10 }, () => rebaixar(IP_DA_ESCOLA, ESCOLA_A)))).toEqual(Array.from({ length: 10 }, () => true))
    expect(alunosAtivos).toHaveBeenCalledTimes(1)
  })

  it('a série fica em 1 no minuto do último rebaixamento, cai a 0 depois, e é esquecida em 10 min', async () => {
    const { falhas, rebaixar, relogio } = montar({ [ESCOLA_A]: 30 })
    await falhas(IP_DA_ESCOLA, ESCOLA_A, 101)
    expect(await rebaixar(IP_DA_ESCOLA, ESCOLA_A)).toBe(true)
    relogio.avancar(59_000)
    expect(await serieDa(ESCOLA_A)).toBe(1)
    relogio.avancar(1_000)
    expect(await serieDa(ESCOLA_A)).toBe(0)
    relogio.avancar(SERIE_REBAIXADA_ESQUECIDA_APOS_MS)
    expect(await serieDa(ESCOLA_A)).toBeUndefined()
  })
})

describe('LimiteDoEmailPorIp', () => {
  function montar(escolasDaRede: Record<string, number>, limitePorMinuto = 60, instancias = 2) {
    const janela = new JanelaDeTeste()
    const consultaRede = vi.fn((ip: string) => Promise.resolve(escolasDaRede[ip] ?? 0))
    const limite = new LimiteDoEmailPorIp({ janela, limitePorMinuto, escolasDaRede: consultaRede, instancias, medidor: medidor.medidor, relogio: relogioParado() })
    const tentativas = async (ip: string, quantidade: number, conhecido = false) => {
      const resultados: boolean[] = []
      for (let tentativa = 0; tentativa < quantidade; tentativa++) resultados.push(await limite.rebaixar(ip, conhecido))
      return resultados
    }
    return { janela, consultaRede, tentativas }
  }

  async function rebaixadas(): Promise<number> {
    const [ponto] = await medidor.pontos(METRICS.limiteEmailIp)
    return typeof ponto?.valor === 'number' ? ponto.valor : Number.NaN
  }

  it('60 tentativas por minuto de um IP passam com a vez; a 61ª vai para o fim do balde, e a métrica conta só as rebaixadas; nasce em 0', async () => {
    const { tentativas, consultaRede } = montar({})
    expect(await rebaixadas()).toBe(0)
    expect((await tentativas(IP_DA_ESCOLA, 60)).every((rebaixada) => !rebaixada)).toBe(true)
    expect(consultaRede).not.toHaveBeenCalled()
    expect(await tentativas(IP_DA_ESCOLA, 2)).toEqual([true, true])
    expect(await rebaixadas()).toBe(2)
  })

  it('IP de saída de uma rede com três escolas: o limite vai a 180, e a rede é lida uma vez só no minuto', async () => {
    const { tentativas, consultaRede } = montar({ [IP_DA_ESCOLA]: 3 })
    expect((await tentativas(IP_DA_ESCOLA, 180)).filter(Boolean)).toEqual([])
    expect(await tentativas(IP_DA_ESCOLA, 1)).toEqual([true])
    expect(consultaRede).toHaveBeenCalledTimes(1)
  })

  it('passagem: quem traz a conta no cookie de dispositivo mantém a vez, mas a tentativa conta no minuto do IP', async () => {
    const { tentativas, janela } = montar({})
    expect((await tentativas(IP_DA_ESCOLA, 70, true)).filter(Boolean)).toEqual([])
    expect([...janela.valores.values()]).toEqual([70])
    expect(await tentativas(IP_DA_ESCOLA, 1)).toEqual([true])
  })

  it('seguro (Redis de fila fora): o limite é dividido pelas instâncias, também o da rede', async () => {
    const { tentativas, janela } = montar({ [IP_DA_ESCOLA]: 3 }, 60, 2)
    janela.doSeguro = true
    expect((await tentativas(IP_DA_ESCOLA, 90)).filter(Boolean)).toEqual([])
    expect(await tentativas(IP_DA_ESCOLA, 1)).toEqual([true])
  })

  it('falha: com o banco com erro na leitura da rede, o IP vale como de rede nenhuma (limite simples), sem 500 e sem guardar o erro', async () => {
    const janela = new JanelaDeTeste()
    const consultaRede = vi.fn(() => Promise.reject(new Error('banco fora')))
    const limite = new LimiteDoEmailPorIp({ janela, limitePorMinuto: 60, escolasDaRede: consultaRede, instancias: 2, medidor: medidor.medidor, relogio: relogioParado() })
    for (let tentativa = 0; tentativa < 60; tentativa++) expect(await limite.rebaixar(IP_DA_ESCOLA, false)).toBe(false)
    expect(await limite.rebaixar(IP_DA_ESCOLA, false)).toBe(true)
    expect(await limite.rebaixar(IP_DA_ESCOLA, false)).toBe(true)
    // O erro não ficou em cache: cada tentativa acima do limite pergunta de novo.
    expect(consultaRede).toHaveBeenCalledTimes(2)
  })

  it('o endereço que não foi lido não vai ao banco atrás de rede', async () => {
    const { tentativas, consultaRede } = montar({})
    await tentativas('desconhecido', 61)
    expect(consultaRede).not.toHaveBeenCalled()
  })
})
