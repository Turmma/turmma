import { ErrorCode, registrarSaidaDaAbaRequestSchema, type QuestaoSalvaResponse } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/client'
import { createFilaDeRespostas } from './fila-de-respostas'
import { createFilaDeSaidas, filaDeSaidasDaProva, vigiarASaidaDaAba, type AlvoDaVigia } from './fila-de-saidas'

/**
 * A fila das saídas da aba durante a prova (D70; Tech Spec §5.8), sem rede e sem relógio: o envio e o agendamento são dublês que o teste dispara. A fila de respostas é a de verdade, ao lado, para provar que
 * as duas não são uma só.
 */

interface EnvioFeito {
  readonly chave: string
  readonly aceitar: () => void
  readonly recusar: (codigo: ErrorCode) => void
}

function servidorDeSaidas() {
  const envios: EnvioFeito[] = []
  const send = (chave: string): Promise<void> =>
    new Promise((resolver, rejeitar) => {
      envios.push({ chave, aceitar: () => resolver(), recusar: (codigo) => rejeitar(new ApiError(codigo)) })
    })
  return { envios, send }
}

function relogioDeMentira() {
  const agendados: { funcao: () => void; esperaMs: number; cancelado: boolean }[] = []
  const agendar = (funcao: () => void, esperaMs: number) => {
    const item = { funcao, esperaMs, cancelado: false }
    agendados.push(item)
    return () => {
      item.cancelado = true
    }
  }
  return { agendados, agendar }
}

const assentar = () => new Promise<void>((resolver) => setTimeout(resolver, 0))

/** Uma janela e um documento de mentira: o teste dispara `blur`, `focus` e `visibilitychange` na ordem que o navegador os manda. */
function abaDeMentira() {
  const janela = new EventTarget()
  const documento = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState })
  const alvo: AlvoDaVigia = { janela, documento }
  return {
    alvo,
    perderOFoco: () => {
      documento.visibilityState = 'hidden'
      janela.dispatchEvent(new Event('blur'))
      documento.dispatchEvent(new Event('visibilitychange'))
    },
    voltar: () => {
      documento.visibilityState = 'visible'
      documento.dispatchEvent(new Event('visibilitychange'))
      janela.dispatchEvent(new Event('focus'))
    },
    soBlur: () => janela.dispatchEvent(new Event('blur')),
  }
}

describe('a saída da aba na tela: uma por saída', () => {
  it('`visibilitychange` e `blur` seguidos somam 1; só depois de o foco voltar a próxima soma', () => {
    const aba = abaDeMentira()
    let saidas = 0
    vigiarASaidaDaAba(() => (saidas += 1), aba.alvo)

    aba.perderOFoco()
    expect(saidas).toBe(1)
    // Mais um evento de saída, sem o foco ter voltado: é a mesma saída.
    aba.soBlur()
    expect(saidas).toBe(1)

    aba.voltar()
    aba.perderOFoco()
    expect(saidas).toBe(2)
  })

  it('o `blur` sozinho (a janela sem foco, a aba à vista) é uma saída, e quem a desliga não conta mais', () => {
    const aba = abaDeMentira()
    let saidas = 0
    const parar = vigiarASaidaDaAba(() => (saidas += 1), aba.alvo)
    aba.soBlur()
    expect(saidas).toBe(1)
    parar()
    aba.voltar()
    aba.perderOFoco()
    expect(saidas).toBe(1)
  })
})

describe('a fila das saídas', () => {
  it('cada saída leva a chave dela (uuid v4, sem horário) e sai em série: a segunda espera a primeira ser confirmada', async () => {
    const servidor = servidorDeSaidas()
    const fila = createFilaDeSaidas({ send: servidor.send })
    fila.registrar()
    fila.registrar()
    expect(servidor.envios).toHaveLength(1)
    expect(registrarSaidaDaAbaRequestSchema.safeParse({ chave: servidor.envios[0]?.chave }).success).toBe(true)
    servidor.envios[0]?.aceitar()
    await assentar()
    expect(servidor.envios).toHaveLength(2)
    expect(servidor.envios[1]?.chave).not.toBe(servidor.envios[0]?.chave)
    servidor.envios[1]?.aceitar()
    await assentar()
    expect(fila.pendentes()).toBe(0)
  })

  it('A, a queda, B, A de novo: a que não chegou volta com a mesma chave, na frente, e nenhuma é descartada nem mandada em paralelo', async () => {
    const servidor = servidorDeSaidas()
    const relogio = relogioDeMentira()
    const chaves = ['a', 'b', 'c']
    const fila = createFilaDeSaidas({ send: servidor.send, novaChave: () => chaves.shift() ?? 'x', agendar: relogio.agendar })

    fila.registrar()
    servidor.envios[0]?.recusar(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    await assentar()
    // A queda: duas saídas novas entram atrás da primeira, e nada sai enquanto ela não chega.
    fila.registrar()
    fila.registrar()
    expect(fila.pendentes()).toBe(3)
    expect(servidor.envios).toHaveLength(1)

    relogio.agendados.at(-1)?.funcao()
    expect(servidor.envios.map((envio) => envio.chave)).toEqual(['a', 'a'])
    servidor.envios[1]?.aceitar()
    await assentar()
    servidor.envios[2]?.aceitar()
    await assentar()
    servidor.envios[3]?.aceitar()
    await assentar()
    expect(servidor.envios.map((envio) => envio.chave)).toEqual(['a', 'a', 'b', 'c'])
    expect(fila.pendentes()).toBe(0)
  })

  it('o 429 espera o recuo e a saída fica; a fila das respostas, ao lado, segue gravando', async () => {
    const servidor = servidorDeSaidas()
    const relogio = relogioDeMentira()
    const saidas = createFilaDeSaidas({ send: servidor.send, agendar: relogio.agendar })
    const gravadas: number[] = []
    const respostas = createFilaDeRespostas({
      save: (questao, alternativa, sequencia): Promise<QuestaoSalvaResponse> => Promise.resolve({ questao, alternativa, sequencia, respondidaEm: '2026-11-28T13:00:00.000Z' }),
      aoSalvar: (salva) => gravadas.push(salva.questao),
      agendar: relogio.agendar,
    })

    saidas.registrar()
    servidor.envios[0]?.recusar(ErrorCode.LIMITE_EXCEDIDO)
    await assentar()
    expect(saidas.pendentes()).toBe(1)

    respostas.escolher(1, 2)
    await assentar()
    expect(gravadas).toEqual([1])
    expect(respostas.read().pendentes).toEqual([])
  })

  it('a prova que o servidor diz não estar em andamento (`NAO_ENCONTRADO`) ou a chave que ele não aceita descarta a saída, e a seguinte sai', async () => {
    const servidor = servidorDeSaidas()
    const fila = createFilaDeSaidas({ send: servidor.send })
    fila.registrar()
    fila.registrar()
    servidor.envios[0]?.recusar(ErrorCode.NAO_ENCONTRADO)
    await assentar()
    expect(servidor.envios).toHaveLength(2)
    servidor.envios[1]?.recusar(ErrorCode.ENTRADA_INVALIDA)
    await assentar()
    expect(fila.pendentes()).toBe(0)
  })

  it('a rede que volta espera o sorteio, e a sessão que volta manda na hora', async () => {
    const servidor = servidorDeSaidas()
    const relogio = relogioDeMentira()
    const fila = createFilaDeSaidas({ send: servidor.send, agendar: relogio.agendar, sortear: () => 0.4 })
    fila.registrar()
    servidor.envios[0]?.recusar(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    await assentar()

    fila.redeVoltou()
    expect(relogio.agendados.at(-1)?.esperaMs).toBe(2_000)
    expect(servidor.envios).toHaveLength(1)
    fila.tryAgora()
    expect(servidor.envios).toHaveLength(2)
  })

  it('com uma saída no ar, nada sai em paralelo: nem o `tryAgora`, nem a rede que volta; e a fila vazia não agenda sorteio', async () => {
    const servidor = servidorDeSaidas()
    const relogio = relogioDeMentira()
    const fila = createFilaDeSaidas({ send: servidor.send, agendar: relogio.agendar })
    // Sem nada a mandar, nem o `tryAgora` envia, nem a rede que volta marca hora nenhuma.
    fila.tryAgora()
    fila.redeVoltou()
    expect(servidor.envios).toHaveLength(0)
    expect(relogio.agendados).toHaveLength(0)

    fila.registrar()
    fila.tryAgora()
    fila.redeVoltou()
    expect(servidor.envios).toHaveLength(1)
    expect(relogio.agendados).toHaveLength(0)
    servidor.envios[0]?.aceitar()
    await assentar()
    expect(fila.pendentes()).toBe(0)
  })

  it('parada com uma saída no ar, a falha que chega depois não marca recuo nenhum', async () => {
    const servidor = servidorDeSaidas()
    const relogio = relogioDeMentira()
    const fila = createFilaDeSaidas({ send: servidor.send, agendar: relogio.agendar })
    fila.registrar()
    fila.stop()
    servidor.envios[0]?.recusar(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    await assentar()
    expect(relogio.agendados).toHaveLength(0)
    expect(fila.pendentes()).toBe(0)
  })

  it('parada, a fila não manda mais nada (a sessão acabou)', async () => {
    const servidor = servidorDeSaidas()
    const fila = createFilaDeSaidas({ send: servidor.send })
    fila.registrar()
    fila.stop()
    servidor.envios[0]?.aceitar()
    await assentar()
    fila.registrar()
    expect(servidor.envios).toHaveLength(1)
    expect(fila.pendentes()).toBe(0)
  })
})

describe('a fila das saídas é uma por prova', () => {
  it('pedir a da mesma prova devolve a mesma fila, e outra prova tem a sua', () => {
    const a = '0197a1c0-0000-7000-8000-00000000000a'
    const b = '0197a1c0-0000-7000-8000-00000000000b'
    expect(filaDeSaidasDaProva(a)).toBe(filaDeSaidasDaProva(a))
    expect(filaDeSaidasDaProva(a)).not.toBe(filaDeSaidasDaProva(b))
  })
})
