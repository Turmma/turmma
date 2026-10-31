import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * Onde abre o que flutua preso a um botão — o menu, o cartão do chip de fonte —, sem biblioteca de posicionamento: o
 * `@floating-ui` que o Radix traz é a maior parte dos 30 kB do menu dele (regra 50, item 1). A conta que importa cabe
 * aqui e tem teste: para que lado abrir, e onde ficar para **não passar da largura da janela a 360 px** (regra 50,
 * item 2a).
 *
 * A posição é **fixa na janela**, e não absoluta no fluxo: dentro de um contêiner que rola ou corta (a tabela que rola
 * de lado, o `Dialogo`, a lista da conversa) o que flutua sairia cortado. Fixo, ele fica por cima de tudo. **Quando a
 * rolagem tira o botão do lugar, ele fecha**, em vez de correr atrás do botão: remedir a cada quadro de rolagem é um
 * ouvinte contínuo, e no Chromebook de entrada o menu andaria um quadro atrás do botão (regra 50, item 1). O que decide
 * é o botão ter saído de onde estava na abertura, e não o evento de rolagem em si: o navegador entrega o evento um
 * quadro depois da rolagem, e o de uma rolagem que acabou antes do clique chegaria com o menu recém-aberto e o fecharia
 * na cara de quem abriu (`botaoSaiuDoLugar`). Quando a janela muda
 * de tamanho, é medido de novo. O que isso não cobre: um ancestral com `transform` ou `filter` vira a referência do que
 * é fixo, e a posição sai errada. O produto não tem nenhum (9.5: sem animação que desloca).
 */

/** O respiro entre o que flutua e a borda da janela: a margem da página no celular (9.3). */
export const MARGEM_DA_JANELA = 16

/** A largura do que flutua: 320 px (11.2), ou a janela menos as duas margens quando ela é mais estreita que isso. */
export const LARGURA_MAXIMA_DO_FLUTUANTE = 320

/** O vão entre o botão e o que flutua. */
export const VAO_DO_FLUTUANTE = 8

/** A altura abaixo da qual não vale encolher: com menos que isso, é melhor passar da janela e rolar a página. */
const ALTURA_MINIMA_DO_FLUTUANTE = 132

export interface CaixaNaJanela {
  readonly esquerda: number
  readonly direita: number
  readonly topo: number
  readonly base: number
}

export interface PosicaoDoFlutuante {
  readonly lado: 'acima' | 'abaixo'
  /** A borda esquerda, em px da janela. Nunca a menos de uma margem das bordas dela. */
  readonly esquerda: number
  /** Em px da janela: a distância do topo dela quando abre `abaixo`, e a do pé dela quando abre `acima`. */
  readonly distancia: number
  /** Até onde ele pode crescer antes de rolar por dentro: a altura pedida, ou o espaço que há daquele lado. */
  readonly alturaMaxima: number
}

export interface PedidoDePosicao {
  /** Onde está o botão, em px da janela (`getBoundingClientRect`). */
  readonly gatilho: CaixaNaJanela
  readonly janela: { readonly largura: number; readonly altura: number }
  /** `inicio` alinha a borda esquerda com a do botão; `fim`, a direita. */
  readonly alinhamento: 'inicio' | 'fim'
  /** `auto` abre para baixo, e vira para cima quando a janela é baixa (11.2). */
  readonly lado: 'auto' | 'acima' | 'abaixo'
  /** A altura que o flutuante pode chegar a ter. */
  readonly altura: number
}

export function larguraDoFlutuante(larguraDaJanela: number): number {
  return Math.max(0, Math.min(LARGURA_MAXIMA_DO_FLUTUANTE, larguraDaJanela - 2 * MARGEM_DA_JANELA))
}

export function posicaoDoFlutuante({ gatilho, janela, alinhamento, lado, altura }: PedidoDePosicao): PosicaoDoFlutuante {
  const largura = larguraDoFlutuante(janela.largura)
  const abaixo = janela.altura - gatilho.base
  const acima = gatilho.topo
  // Cabe embaixo, fica embaixo. Não cabe: vai para o lado que tem mais espaço, e lá rola por dentro.
  const ladoEscolhido = lado !== 'auto' ? lado : abaixo >= altura + VAO_DO_FLUTUANTE + MARGEM_DA_JANELA || abaixo >= acima ? 'abaixo' : 'acima'
  // Alinhado ao botão, e puxado para dentro quando passaria de uma das bordas da janela.
  const alinhada = alinhamento === 'inicio' ? gatilho.esquerda : gatilho.direita - largura
  const esquerda = Math.round(Math.max(MARGEM_DA_JANELA, Math.min(alinhada, janela.largura - MARGEM_DA_JANELA - largura)))
  const espaco = (ladoEscolhido === 'abaixo' ? abaixo : acima) - VAO_DO_FLUTUANTE - MARGEM_DA_JANELA
  return {
    lado: ladoEscolhido,
    esquerda,
    distancia: Math.round((ladoEscolhido === 'abaixo' ? gatilho.base : janela.altura - gatilho.topo) + VAO_DO_FLUTUANTE),
    alturaMaxima: Math.round(Math.min(altura, Math.max(espaco, ALTURA_MINIMA_DO_FLUTUANTE))),
  }
}

/** Quanto o botão pode mexer sem contar como "saiu do lugar": arredondamento de meio pixel não fecha menu. */
const FOLGA_DO_BOTAO = 1

/**
 * O botão saiu de onde estava quando o flutuante foi medido? É a pergunta que o evento de rolagem faz antes de fechar.
 * O evento que chega atrasado, de uma rolagem que terminou antes da abertura, encontra o botão no mesmo lugar.
 */
export function botaoSaiuDoLugar(naAbertura: Pick<CaixaNaJanela, 'esquerda' | 'topo'>, agora: Pick<CaixaNaJanela, 'esquerda' | 'topo'>): boolean {
  return Math.abs(agora.esquerda - naAbertura.esquerda) > FOLGA_DO_BOTAO || Math.abs(agora.topo - naAbertura.topo) > FOLGA_DO_BOTAO
}

/** O `style` do que flutua: só o que foi medido. O resto do desenho, e o `position: fixed`, é classe. */
export function estiloDoFlutuante(posicao: PosicaoDoFlutuante | undefined): { left: number; top?: number; bottom?: number; visibility?: 'hidden' } {
  // Antes da medida ele existe, para o foco e a medida terem onde cair, e não aparece: não pisca num canto.
  if (posicao === undefined) return { left: 0, top: 0, visibility: 'hidden' }
  return posicao.lado === 'abaixo' ? { left: posicao.esquerda, top: posicao.distancia } : { left: posicao.esquerda, bottom: posicao.distancia }
}

export interface OpcoesDoFlutuante {
  readonly aberto: boolean
  /**
   * O toque ou o clique fora, e a rolagem por fora, pedem para fechar. Quem desenha decide para onde o foco vai: o que
   * flutua some com o foco dentro, e ele não pode cair no `body`. O Esc também é de quem desenha.
   */
  readonly aoFechar: () => void
  readonly alinhamento: 'inicio' | 'fim'
  readonly lado: 'auto' | 'acima' | 'abaixo'
  readonly altura: number
}

/**
 * A âncora (o elemento que envolve o botão e o que flutua) e a posição medida. Mede antes de pintar
 * (`useLayoutEffect`), para o flutuante não aparecer num lugar e pular para outro, e de novo quando a janela muda de
 * tamanho. Fecha no `pointerdown` fora da âncora, que vale para mouse, toque e caneta, e **quando a rolagem tira o botão
 * de onde ele estava na medida**. `posicao` é `undefined` até a primeira medida.
 */
export function useFlutuante<Ancora extends HTMLElement>({ aberto, aoFechar, alinhamento, lado, altura }: OpcoesDoFlutuante): {
  readonly ancora: RefObject<Ancora | null>
  readonly posicao: PosicaoDoFlutuante | undefined
} {
  const ancora = useRef<Ancora>(null)
  const [posicao, definirPosicao] = useState<PosicaoDoFlutuante | undefined>(undefined)
  // Onde o botão estava na última medida: é contra isto que a rolagem é conferida.
  const naMedida = useRef<{ esquerda: number; topo: number } | undefined>(undefined)
  // O `aoFechar` da última renderização, para o ouvinte do documento não ser trocado a cada render de quem usa.
  const fechar = useRef(aoFechar)
  useEffect(() => {
    fechar.current = aoFechar
  }, [aoFechar])

  useLayoutEffect(() => {
    if (!aberto) return
    function medir(): void {
      const elemento = ancora.current
      if (elemento === null) return
      // O botão é o primeiro filho da âncora: é ele que se mede, e não a âncora, que pode quebrar de linha no meio do texto.
      const caixa = (elemento.firstElementChild ?? elemento).getBoundingClientRect()
      naMedida.current = { esquerda: caixa.left, topo: caixa.top }
      const nova = posicaoDoFlutuante({
        gatilho: { esquerda: caixa.left, direita: caixa.right, topo: caixa.top, base: caixa.bottom },
        janela: { largura: document.documentElement.clientWidth, altura: document.documentElement.clientHeight },
        alinhamento,
        lado,
        altura,
      })
      definirPosicao((atual) =>
        atual !== undefined && atual.lado === nova.lado && atual.esquerda === nova.esquerda && atual.distancia === nova.distancia && atual.alturaMaxima === nova.alturaMaxima ? atual : nova,
      )
    }
    medir()
    window.addEventListener('resize', medir)
    return () => {
      window.removeEventListener('resize', medir)
      definirPosicao(undefined)
    }
  }, [aberto, alinhamento, lado, altura])

  useEffect(() => {
    if (!aberto) return
    function aoApontar(evento: PointerEvent): void {
      if (evento.target instanceof Node && ancora.current?.contains(evento.target) === false) fechar.current()
    }
    function aoRolar(evento: Event): void {
      const elemento = ancora.current
      // A rolagem de dentro do próprio flutuante (o menu comprido) não o tira do lugar.
      if (elemento === null || naMedida.current === undefined || (evento.target instanceof Node && elemento.contains(evento.target))) return
      const caixa = (elemento.firstElementChild ?? elemento).getBoundingClientRect()
      // Só fecha se o botão saiu de onde estava: o evento atrasado de uma rolagem anterior à abertura não fecha nada.
      if (botaoSaiuDoLugar(naMedida.current, { esquerda: caixa.left, topo: caixa.top })) fechar.current()
    }
    document.addEventListener('pointerdown', aoApontar)
    // Na captura: a rolagem de um contêiner não sobe até a janela, e é justamente ela que tira o botão do lugar.
    window.addEventListener('scroll', aoRolar, true)
    return () => {
      document.removeEventListener('pointerdown', aoApontar)
      window.removeEventListener('scroll', aoRolar, true)
    }
  }, [aberto])

  return { ancora, posicao }
}

/**
 * Enquanto o menu está aberto, **o resto da página fica inerte**: tudo que não é a âncora nem um ancestral dela. É o que
 * faz do menu aberto a única coisa com que se interage — o leitor de tela não sai dele para o que está por baixo, e o
 * controle que o menu cobriu pela metade deixa de ser alvo de toque, em vez de sobrar com uma fresta de 10 px (regra
 * 50, item 2a). Ao fechar, cada elemento volta a ser o que era: só o que este gancho deixou inerte é solto.
 */
export function useRestoInerte(ativo: boolean, ancora: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const inicio = ancora.current
    if (!ativo || inicio === null) return
    const postos: HTMLElement[] = []
    for (let no: HTMLElement | null = inicio; no !== null && no !== document.body; no = no.parentElement) {
      for (const irmao of Array.from(no.parentElement?.children ?? [])) {
        if (irmao === no || !(irmao instanceof HTMLElement) || irmao.inert) continue
        irmao.inert = true
        postos.push(irmao)
      }
    }
    return () => {
      for (const elemento of postos) elemento.inert = false
    }
  }, [ativo, ancora])
}
