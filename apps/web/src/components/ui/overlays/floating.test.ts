import { describe, expect, it } from 'vitest'
import { botaoSaiuDoLugar, estiloDoFlutuante, larguraDoFlutuante, posicaoDoFlutuante, type CaixaNaJanela } from './floating'

const CELULAR = { largura: 360, altura: 800 }
const CHROMEBOOK = { largura: 1366, altura: 768 }

function botao(esquerda: number, topo: number, largura = 120, altura = 44): CaixaNaJanela {
  return { esquerda, direita: esquerda + largura, topo, base: topo + altura }
}

const pedido = (gatilho: CaixaNaJanela, janela: typeof CELULAR, extra: { alinhamento?: 'inicio' | 'fim'; lado?: 'auto' | 'acima' | 'abaixo' } = {}) =>
  posicaoDoFlutuante({ gatilho, janela, alinhamento: extra.alinhamento ?? 'inicio', lado: extra.lado ?? 'auto', altura: 292 })

describe('largura do que flutua', () => {
  it('é 320 px, e a janela menos as duas margens quando ela é mais estreita', () => {
    expect(larguraDoFlutuante(1366)).toBe(320)
    expect(larguraDoFlutuante(360)).toBe(320)
    expect(larguraDoFlutuante(320)).toBe(288)
  })
})

describe('posição do que flutua', () => {
  it('a 360 px, o botão no meio da linha não deixa o flutuante passar da janela: ele fica a uma margem da borda', () => {
    // Borda esquerda em 150: 150 + 320 = 470, e o limite é 360 − 16 = 344. Sem puxar para dentro, a página ganharia
    // rolagem horizontal (regra 50, item 2a).
    const { esquerda } = pedido(botao(150, 100), CELULAR)
    expect(esquerda).toBe(24)
    expect(esquerda + larguraDoFlutuante(CELULAR.largura)).toBeLessThanOrEqual(CELULAR.largura - 16)
  })

  it('alinhado ao fim, perto da borda esquerda, fica a uma margem dela em vez de sair pela esquerda', () => {
    // Borda direita do botão em 200: o flutuante começaria em 200 − 320 = −120.
    expect(pedido(botao(80, 100), CELULAR, { alinhamento: 'fim' }).esquerda).toBe(16)
  })

  it('com espaço, fica alinhado ao botão: pela esquerda no início, pela direita no fim', () => {
    expect(pedido(botao(24, 100), CHROMEBOOK).esquerda).toBe(24)
    // O botão vai de 1200 a 1320: a borda direita do flutuante é 1320, e a esquerda, 1000.
    expect(pedido(botao(1200, 100), CHROMEBOOK, { alinhamento: 'fim' }).esquerda).toBe(1000)
  })

  it('abre para baixo quando cabe, a um vão do botão, e vira para cima quando o botão está no pé da janela', () => {
    expect(pedido(botao(24, 100), CHROMEBOOK)).toMatchObject({ lado: 'abaixo', distancia: 152, alturaMaxima: 292 })
    // A caixa de pedido presa embaixo: 768 − 700 − 44 = 24 px livres embaixo, 700 em cima. A distância é a do pé da
    // janela: 768 − 700 + 8.
    expect(pedido(botao(24, 700), CHROMEBOOK)).toMatchObject({ lado: 'acima', distancia: 76, alturaMaxima: 292 })
  })

  it('sem caber em nenhum dos dois, vai para o lado com mais espaço e encolhe até o que há, para rolar por dentro', () => {
    const baixa = { largura: 800, altura: 400 }
    // 400 − 164 = 236 embaixo: menos o vão e a margem, 212.
    expect(pedido(botao(24, 120), baixa)).toMatchObject({ lado: 'abaixo', alturaMaxima: 212 })
    // 260 em cima: menos o vão e a margem, 236.
    expect(pedido(botao(24, 260), baixa)).toMatchObject({ lado: 'acima', alturaMaxima: 236 })
  })

  it('o lado pedido por quem usa vale mesmo sem espaço, e a altura não encolhe abaixo do mínimo útil', () => {
    expect(pedido(botao(24, 700), CHROMEBOOK, { lado: 'abaixo' })).toMatchObject({ lado: 'abaixo', alturaMaxima: 132 })
    expect(pedido(botao(24, 10), CHROMEBOOK, { lado: 'acima' })).toMatchObject({ lado: 'acima', alturaMaxima: 132 })
  })

  it('o estilo põe a distância no topo quando abre para baixo e no pé quando abre para cima; sem medida, não aparece', () => {
    expect(estiloDoFlutuante({ lado: 'abaixo', esquerda: 24, distancia: 152, alturaMaxima: 292 })).toEqual({ left: 24, top: 152 })
    expect(estiloDoFlutuante({ lado: 'acima', esquerda: 16, distancia: 76, alturaMaxima: 292 })).toEqual({ left: 16, bottom: 76 })
    expect(estiloDoFlutuante(undefined)).toEqual({ left: 0, top: 0, visibility: 'hidden' })
  })
})

describe('fechar ao rolar', () => {
  it('o evento de rolagem que chega com o botão no mesmo lugar não fecha: é o que sobrou de uma rolagem anterior à abertura', () => {
    expect(botaoSaiuDoLugar({ esquerda: 24, topo: 300 }, { esquerda: 24, topo: 300 })).toBe(false)
    // Meio pixel de arredondamento não é o botão saindo do lugar.
    expect(botaoSaiuDoLugar({ esquerda: 24, topo: 300 }, { esquerda: 24.4, topo: 299.5 })).toBe(false)
  })

  it('o botão que andou com a rolagem, para cima, para baixo ou para o lado, fecha', () => {
    expect(botaoSaiuDoLugar({ esquerda: 24, topo: 300 }, { esquerda: 24, topo: 180 })).toBe(true)
    expect(botaoSaiuDoLugar({ esquerda: 24, topo: 300 }, { esquerda: 24, topo: 302 })).toBe(true)
    expect(botaoSaiuDoLugar({ esquerda: 24, topo: 300 }, { esquerda: -40, topo: 300 })).toBe(true)
  })
})
