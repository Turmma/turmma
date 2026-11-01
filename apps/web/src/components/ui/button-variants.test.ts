import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  buttonVariants,
  OFFICIAL_BUTTON_CLASSES,
  DANGER_BUTTON_CLASSES,
  DANGER_SOLID_BUTTON_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  SECONDARY_LINK_CLASSES,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
} from './button-variants'

const classes = (texto: string): Set<string> => new Set(texto.split(/\s+/).filter((classe) => classe !== ''))

/**
 * A cor de cada classe do botão, resolvida pelo CSS de verdade e por tema: o teste lê `index.css`, e não uma cópia da
 * tabela aqui. Sem isso, trocar `disabled:text-apoio` por `disabled:text-sutil` deixaria tudo verde no claro, e o
 * escuro, onde `sutil` não chega a 4,5:1, só apareceria com o botão na tela.
 */
const raizDaWeb = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

type Tema = 'claro' | 'escuro'
type Estado = 'ligado' | 'hover' | 'apertado' | 'desligado'

function miolo(texto: string, inicio: number): string {
  const abertura = texto.indexOf('{', inicio)
  let profundidade = 0
  for (let posicao = abertura; posicao < texto.length; posicao++) {
    if (texto[posicao] === '{') profundidade++
    else if (texto[posicao] === '}' && --profundidade === 0) return texto.slice(abertura + 1, posicao)
  }
  throw new Error('bloco de CSS sem fechamento')
}

const css = readFileSync(join(raizDaWeb, 'index.css'), 'utf8')

function paleta(bloco: string): Map<string, string> {
  return new Map([...bloco.matchAll(/--color-([a-z]+(?:-[a-z0-9]+)*)\s*:\s*(#[0-9a-fA-F]{6})\b/g)].map(([, nome = '', hex = '']) => [nome, hex.toLowerCase()]))
}

const CORES: Record<Tema, Map<string, string>> = {
  claro: paleta(miolo(css, css.indexOf('@theme static'))),
  escuro: paleta(miolo(css, css.search(/:root\[data-tema='escuro'\]\s*\{/))),
}

/** O que a classe `degrau-<x>` põe em `--lado`: o nome do token da cor do degrau. */
function ladoDoDegrau(classe: string): string {
  const regra = new RegExp(String.raw`\.${classe}\s*\{\s*--lado:\s*var\(--color-([a-z-]+)\)`).exec(css)
  if (regra?.[1] === undefined) throw new Error(`a classe ${classe} não declara --lado em index.css`)
  return regra[1]
}

const PREFIXO_DO_ESTADO: Record<Estado, string> = { ligado: '', hover: 'enabled:hover:', apertado: 'enabled:active:', desligado: 'disabled:' }

/** O token da propriedade (`bg` ou `text`) no estado, caindo no do estado normal quando o estado não troca. */
function tokenDe(lista: Set<string>, propriedade: 'bg' | 'text', estado: Estado): string | undefined {
  // O tamanho da letra (`text-[14px]`) também começa por `text-`: só o nome de token, que começa por letra, é cor.
  const eToken = (classe: string, prefixo: string) => new RegExp(`^${prefixo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${propriedade}-[a-z]`).test(classe)
  const prefixo = PREFIXO_DO_ESTADO[estado]
  const dele = [...lista].find((classe) => eToken(classe, prefixo))
  if (dele !== undefined) return dele.slice(prefixo.length + propriedade.length + 1)
  // Só o estado normal e o desligado têm de dizer tudo: hover e apertado sem classe própria ficam como estão.
  if (estado === 'ligado') return undefined
  return estado === 'desligado' ? undefined : tokenDe(lista, propriedade, 'ligado')
}

interface CoresDoEstado {
  readonly face: string
  readonly texto: string
}

/** A face e o texto de um botão, em hex, no estado e no tema. Sem face, a do botão é o chão (`fundo`): é o `discreto`. */
function coresDoBotao(lista: string, estado: Estado, tema: Tema): CoresDoEstado {
  const conjunto = classes(lista)
  const face = tokenDe(conjunto, 'bg', estado) ?? (estado === 'desligado' ? undefined : 'fundo')
  const texto = tokenDe(conjunto, 'text', estado)
  if (face === undefined || texto === undefined) throw new Error(`o botão não diz a face e o texto do estado ${estado}: ${lista}`)
  const hexDaFace = CORES[tema].get(face)
  const hexDoTexto = CORES[tema].get(texto)
  if (hexDaFace === undefined || hexDoTexto === undefined) throw new Error(`token fora do ${tema}: ${face} ou ${texto}`)
  return { face: hexDaFace, texto: hexDoTexto }
}

/** O degrau do botão em hex, ou `null` quando ele não tem (o `discreto`, e todo botão desligado). */
function degrauDoBotao(lista: string, estado: Estado, tema: Tema): string | null {
  if (estado === 'desligado') return null
  const classeDoDegrau = [...classes(lista)].find((classe) => /^degrau-[a-z-]+$/.test(classe))
  if (classeDoDegrau === undefined) return null
  return CORES[tema].get(ladoDoDegrau(classeDoDegrau)) ?? null
}

function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((posicao) => {
    const canal = Number.parseInt(hex.slice(posicao, posicao + 2), 16) / 255
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (canais[0] ?? 0) + 0.7152 * (canais[1] ?? 0) + 0.0722 * (canais[2] ?? 0)
}

function contraste(uma: string, outra: string): number {
  const [clara = 0, escura = 0] = [luminancia(uma), luminancia(outra)].sort((a, b) => b - a)
  return (clara + 0.05) / (escura + 0.05)
}

const TEMAS: readonly Tema[] = ['claro', 'escuro']
const ESTADOS: readonly Estado[] = ['ligado', 'hover', 'apertado', 'desligado']

/** Os seis desenhos: as cinco variantes e o `perigo` cheio, com o nome para a mensagem. */
const DESENHOS: readonly { readonly nome: string; readonly lista: string }[] = [
  ...BUTTON_VARIANTS.map((variante) => ({ nome: variante, lista: buttonVariants({ variante }) })),
  { nome: 'perigo cheio', lista: buttonVariants({ variante: 'perigo', cheio: true }) },
]

describe('os desenhos de botão da 10.2', () => {
  it('são cinco variantes, e o sexto desenho é o perigo cheio', () => {
    expect([...BUTTON_VARIANTS]).toEqual(['primario', 'oficial', 'secundario', 'discreto', 'perigo'])
    expect(DESENHOS).toHaveLength(6)
  })

  it('só o oficial é grafite: a face e o degrau dele não são os de nenhuma outra variante, nos dois temas (RF6)', () => {
    for (const tema of TEMAS) {
      const oficial = buttonVariants({ variante: 'oficial' })
      // Os valores são lidos do CSS: o oficial é grafite no claro e o claro do tema no escuro, e nenhum outro botão repete.
      const faceDoOficial = coresDoBotao(oficial, 'ligado', tema).face
      const degrauDoOficial = degrauDoBotao(oficial, 'ligado', tema)
      expect(faceDoOficial, `${tema}: face do oficial`).toBe(CORES[tema].get('grafite'))
      expect(degrauDoOficial, `${tema}: degrau do oficial`).toBe(CORES[tema].get('grafite-degrau'))
      const outros = DESENHOS.filter(({ nome }) => nome !== 'oficial')
      for (const { nome, lista } of outros) {
        for (const estado of ESTADOS) {
          expect(coresDoBotao(lista, estado, tema).face, `${tema}: face de ${nome} (${estado}) repete a do oficial`).not.toBe(faceDoOficial)
          expect(degrauDoBotao(lista, estado, tema), `${tema}: degrau de ${nome} (${estado}) repete o do oficial`).not.toBe(degrauDoOficial)
        }
      }
    }
    // E na classe: só o oficial pede a face `grafite`, e o texto é `sobre-grafite`, que acompanha a face nos dois temas.
    const comGrafite = BUTTON_VARIANTS.filter((variante) => classes(buttonVariants({ variante })).has('bg-grafite'))
    expect(comGrafite).toEqual(['oficial'])
    expect(classes(buttonVariants({ variante: 'oficial' })).has('text-sobre-grafite')).toBe(true)
    expect(classes(buttonVariants({ variante: 'oficial' })).has('text-white')).toBe(false)
    expect(classes(buttonVariants({ variante: 'oficial' })).has('bg-noite')).toBe(false)
  })

  it('todo estado de todo desenho passa de 4,5:1 nos dois temas, com as classes de verdade', () => {
    const abaixo: string[] = []
    for (const tema of TEMAS) {
      for (const { nome, lista } of DESENHOS) {
        for (const estado of ESTADOS) {
          const { face, texto } = coresDoBotao(lista, estado, tema)
          const razao = contraste(face, texto)
          if (razao < 4.5) abaixo.push(`${tema} · ${nome} (${estado}): ${texto} sobre ${face} dá ${razao.toFixed(2)}`)
        }
      }
    }
    expect(abaixo).toEqual([])
  })

  it('a conta do contraste reprova o desligado em sutil: 3,7:1 no escuro', () => {
    // O modo de falhar do caso acima é passar sempre; aqui a mesma conta recebe o desenho que ela existe para barrar.
    const comSutil = buttonVariants({ variante: 'secundario' }).replace('disabled:text-apoio', 'disabled:text-sutil')
    const { face, texto } = coresDoBotao(comSutil, 'desligado', 'escuro')
    expect(contraste(face, texto)).toBeLessThan(4.5)
    const { face: faceDoClaro, texto: textoDoClaro } = coresDoBotao(comSutil, 'desligado', 'claro')
    expect(contraste(faceDoClaro, textoDoClaro)).toBeGreaterThanOrEqual(4.5)
  })

  it('só a primária pinta de laranja, e com texto escuro: branco sobre o laranja dá 3,0:1 e reprova (9.1)', () => {
    const comOLaranja = BUTTON_VARIANTS.filter((variante) => classes(buttonVariants({ variante })).has('bg-laranja'))
    expect(comOLaranja).toEqual(['primario'])
    // A face `laranja` e o hover `caramelo-claro` da 10.2; nenhuma outra variante traz `caramelo` nem `laranja` na face.
    expect(classes(buttonVariants()).has('enabled:hover:bg-caramelo-claro')).toBe(true)
    // `sobre-cor` é escuro nos dois temas. `text-tinta` clarearia no escuro, e daria o mesmo 3:1 do branco.
    expect(classes(buttonVariants()).has('text-sobre-cor')).toBe(true)
    expect(classes(buttonVariants()).has('text-sobre-grafite')).toBe(false)
    expect(classes(buttonVariants()).has('text-tinta')).toBe(false)
    expect(classes(buttonVariants()).has('text-white')).toBe(false)
    // O degrau do primário é o `laranja-degrau`, da própria família.
    expect(classes(buttonVariants()).has('degrau-laranja')).toBe(true)
  })

  it('o perigo cheio leva a face vermelha, o texto que acompanha e o degrau da família', () => {
    const cheio = classes(buttonVariants({ variante: 'perigo', cheio: true }))
    expect(cheio.has('bg-vermelho')).toBe(true)
    expect(cheio.has('text-sobre-cor')).toBe(true)
    expect(cheio.has('degrau-vermelho')).toBe(true)
    expect(cheio.has('text-white')).toBe(false)
    expect(cheio.has('text-sobre-grafite')).toBe(false)
    // O hover do cheio não muda a face: ele já é o botão que confirma, e escurecer mais empurra o clique reflexo.
    expect([...cheio].filter((classe) => classe.includes('hover:'))).toEqual([])
  })

  it('o perigo só é cheio quando pedido: fora do diálogo de confirmação ele é texto e borda vermelhos, sem face vermelha', () => {
    const fora = classes(buttonVariants({ variante: 'perigo' }))
    expect(fora.has('bg-vermelho')).toBe(false)
    expect(fora.has('bg-erro')).toBe(false)
    expect(fora.has('text-vermelho-texto')).toBe(true)
    expect(fora.has('border-vermelho-borda')).toBe(true)
    expect(fora.has('degrau-vermelho-borda')).toBe(true)
    expect(classes(buttonVariants({ variante: 'perigo', cheio: true })).has('bg-vermelho')).toBe(true)
    // `cheio` não muda as outras variantes: a primária não vira botão de erro por engano.
    expect(buttonVariants({ variante: 'primario', cheio: true })).toBe(buttonVariants({ variante: 'primario' }))
    // Nenhuma outra variante tem a face vermelha, ligada ou não.
    const comOVermelho = BUTTON_VARIANTS.filter((variante) => classes(buttonVariants({ variante })).has('bg-vermelho'))
    expect(comOVermelho).toEqual([])
  })

  it('todos têm o canto de 12 px, menos o botão só de ícone, que é círculo', () => {
    for (const variante of BUTTON_VARIANTS) {
      for (const tamanho of ['principal', 'compacto'] as const) {
        const lista = classes(buttonVariants({ variante, tamanho }))
        expect(lista.has('rounded-botao'), `${variante} ${tamanho}`).toBe(true)
        expect(lista.has('rounded-full'), `${variante} ${tamanho}`).toBe(false)
      }
      const icone = classes(buttonVariants({ variante, tamanho: 'icone' }))
      expect(icone.has('rounded-full'), variante).toBe(true)
      expect(icone.has('rounded-botao'), variante).toBe(false)
    }
    // O rótulo é `t-rotulo`: caixa-alta, 700, uma linha, em todos.
    for (const { nome, lista } of DESENHOS) expect(classes(lista).has('t-rotulo'), nome).toBe(true)
    // E o `<button>` e o `<a>` escritos à mão, que as telas de antes usam: o canto e o rótulo são os mesmos.
    for (const constante of [SECONDARY_BUTTON_CLASSES, DANGER_BUTTON_CLASSES, DANGER_SOLID_BUTTON_CLASSES, OFFICIAL_BUTTON_CLASSES, SECONDARY_LINK_CLASSES]) {
      expect(classes(constante).has('rounded-botao'), constante).toBe(true)
      expect(classes(constante).has('rounded-full'), constante).toBe(false)
      expect(classes(constante).has('t-rotulo'), constante).toBe(true)
    }
  })

  it('a face tem 44 px no principal; o compacto tem 36 px só a partir de 768 px, e 44 px no celular; o ícone é de 44', () => {
    for (const variante of BUTTON_VARIANTS) {
      const principal = classes(buttonVariants({ variante }))
      expect(principal.has('min-h-11') && principal.has('min-w-11'), variante).toBe(true)
      const compacto = classes(buttonVariants({ variante, tamanho: 'compacto' }))
      expect(compacto.has('md:min-h-9') && compacto.has('md:min-w-9'), variante).toBe(true)
      // Sem prefixo de largura, vale o de 44 px: é o que o celular recebe (regra 50, item 2a).
      expect(compacto.has('min-h-11') && compacto.has('min-w-11'), variante).toBe(true)
      expect(compacto.has('min-h-9'), variante).toBe(false)
      // A letra do compacto é de 14 px (10.2), e a do principal fica a do `t-rotulo`, de 15.
      expect(compacto.has('text-[14px]'), variante).toBe(true)
      expect(principal.has('text-[14px]'), variante).toBe(false)
      // O botão só de ícone é o círculo de 44 px, sem enchimento lateral, que o deixaria mais largo que alto, e com o
      // degrau de 3 px da 9.3.
      const icone = classes(buttonVariants({ variante, tamanho: 'icone' }))
      expect(icone.has('size-11'), variante).toBe(true)
      expect(icone.has('[--altura-degrau:3px]'), variante).toBe(true)
      expect([...icone].filter((classe) => classe.startsWith('px-')), variante).toEqual([])
    }
    expect([...BUTTON_SIZES]).toEqual(['principal', 'compacto', 'icone'])
  })

  it('o discreto não tem degrau nem face; todos os outros têm degrau, e é ele que o desligado perde', () => {
    const comDegrau = BUTTON_VARIANTS.filter((variante) => classes(buttonVariants({ variante })).has('degrau'))
    expect(comDegrau).toEqual(['primario', 'oficial', 'secundario', 'perigo'])
    const discreto = classes(buttonVariants({ variante: 'discreto' }))
    expect([...discreto].some((classe) => /^bg-/.test(classe) || /^degrau/.test(classe))).toBe(false)
    expect(discreto.has('text-azul-texto')).toBe(true)
    // Todo botão com degrau tem a classe da cor do degrau ao lado: sem ela a sombra cai na `borda` por omissão.
    for (const { nome, lista } of DESENHOS.filter(({ nome: n }) => n !== 'discreto')) {
      expect([...classes(lista)].filter((classe) => /^degrau-/.test(classe)), nome).toHaveLength(1)
    }
  })

  it('toda variante tem desenho de desligado: face borda e texto apoio, que o ligado não tem', () => {
    for (const { nome, lista } of DESENHOS) {
      const conjunto = classes(lista)
      // Desligado é face e texto próprios: o que se vê de longe, e não só a borda ou o cursor.
      expect(conjunto.has('disabled:bg-borda'), nome).toBe(true)
      expect(conjunto.has('disabled:text-apoio'), nome).toBe(true)
      for (const tema of TEMAS) {
        const ligado = coresDoBotao(lista, 'ligado', tema)
        const desligado = coresDoBotao(lista, 'desligado', tema)
        expect(desligado.face !== ligado.face || desligado.texto !== ligado.texto, `${tema} · ${nome}`).toBe(true)
        // O desligado nunca fica com a cor de ação: nem a laranja, nem a do oficial, nem a vermelha.
        const cores = [CORES[tema].get('laranja'), CORES[tema].get('grafite'), CORES[tema].get('vermelho')]
        expect(cores, `${tema} · ${nome}`).not.toContain(desligado.face)
      }
    }
    // E as constantes escritas à mão, que as telas da A0 e da A1 usam num `<button>` solto, também.
    for (const constante of [SECONDARY_BUTTON_CLASSES, DANGER_BUTTON_CLASSES, DANGER_SOLID_BUTTON_CLASSES, OFFICIAL_BUTTON_CLASSES]) {
      expect(classes(constante).has('disabled:bg-borda'), constante).toBe(true)
      expect(classes(constante).has('disabled:text-apoio'), constante).toBe(true)
    }
  })

  it('a variante do Botao e a constante escrita à mão dizem o mesmo botão', () => {
    // As telas da A0 e da A1 usam as constantes num `<button>` solto; se uma das duas mudar sozinha, a tela nova e a
    // antiga passam a ter dois "secundários". A tabela acrescenta só o vão do ícone.
    const comOVao = (constante: string) => new Set([...classes(constante), 'gap-2'])
    expect(classes(buttonVariants({ variante: 'secundario' }))).toEqual(comOVao(SECONDARY_BUTTON_CLASSES))
    expect(classes(buttonVariants({ variante: 'oficial' }))).toEqual(comOVao(OFFICIAL_BUTTON_CLASSES))
    expect(classes(buttonVariants({ variante: 'perigo' }))).toEqual(comOVao(DANGER_BUTTON_CLASSES))
    expect(classes(buttonVariants({ variante: 'perigo', cheio: true }))).toEqual(comOVao(DANGER_SOLID_BUTTON_CLASSES))
  })

  it('o link secundário é o secundário sem o desligado, com o hover valendo sempre', () => {
    const link = classes(SECONDARY_LINK_CLASSES)
    const botao = classes(SECONDARY_BUTTON_CLASSES)
    expect([...link].filter((classe) => classe.startsWith('disabled:'))).toEqual([])
    expect(link.has('hover:bg-fundo-suave')).toBe(true)
    // O resto do desenho é o mesmo: a face, a borda, o degrau e o texto.
    for (const classe of ['border-2', 'border-borda', 'bg-superficie', 'text-apoio', 'degrau', 'degrau-borda', 'rounded-botao', 't-rotulo']) {
      expect(link.has(classe), classe).toBe(true)
      expect(botao.has(classe), classe).toBe(true)
    }
  })
})
