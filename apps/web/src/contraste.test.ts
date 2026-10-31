import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * O contraste de cada par de texto e fundo que a pele usa, **nos dois temas** (RF2 da X1; regra 50, item 11).
 *
 * A lista de pares mora no `docs/interface.md` 9.1, na tabela "Pares de contraste", e os valores, no `index.css`: o
 * teste lê os dois e faz a conta da WCAG 2.1. Par usado e não declarado passaria calado, e por isso a tabela tem número
 * fixo de linhas: quem acrescenta um par acrescenta a linha, e o número aqui, na mesma tarefa.
 *
 * O axe do e2e confere o contraste do que a tela desenha no tema claro. Este teste é o que alcança o escuro e os pares
 * que nenhuma tela de hoje mostra ainda (as dez famílias, o desligado, a borda de campo).
 */
const raizDaWeb = dirname(fileURLToPath(import.meta.url))
const raizDoRepositorio = join(raizDaWeb, '..', '..', '..')

/** Quantas linhas a tabela de pares tem. Outro número é tabela lida pela metade, ou par novo sem a conta. */
const PARES_DA_TABELA = 88

type Tema = 'claro' | 'escuro'

interface Par {
  readonly nome: string
  readonly texto: string
  readonly fundo: string
  readonly minimo: number
}

/** As linhas da tabela "Pares de contraste" da 9.1: o nome do par, os dois tokens e o mínimo (4,5 ou 3). */
function paresDoDocumento(): Par[] {
  const documento = readFileSync(join(raizDoRepositorio, 'docs', 'interface.md'), 'utf8')
  const inicio = documento.indexOf('#### Pares de contraste')
  if (inicio === -1) throw new Error('docs/interface.md sem a tabela "Pares de contraste"')
  const fim = documento.indexOf('\n### ', inicio)
  const secao = documento.slice(inicio, fim === -1 ? undefined : fim)
  return [...secao.matchAll(/^\|\s*([^|`]+?)\s*\|\s*`([a-z0-9-]+)`\s*\|\s*`([a-z0-9-]+)`\s*\|\s*(\d+(?:,\d+)?)\s*\|$/gm)].map(([, nome = '', texto = '', fundo = '', minimo = '']) => ({
    nome,
    texto,
    fundo,
    minimo: Number(minimo.replace(',', '.')),
  }))
}

/** O miolo do bloco que abre na primeira `{` depois de `inicio`, até a `}` que o fecha. */
function miolo(texto: string, inicio: number): string {
  const abertura = texto.indexOf('{', inicio)
  let profundidade = 0
  for (let posicao = abertura; posicao < texto.length; posicao++) {
    if (texto[posicao] === '{') profundidade++
    else if (texto[posicao] === '}' && --profundidade === 0) return texto.slice(abertura + 1, posicao)
  }
  throw new Error('bloco de CSS sem fechamento')
}

/** As cores de `index.css` em cada tema, do bloco `@theme static` e do bloco `:root[data-tema='escuro']`. */
function coresDoProduto(): Record<Tema, Map<string, string>> {
  const css = readFileSync(join(raizDaWeb, 'index.css'), 'utf8')
  const ler = (bloco: string) => new Map([...bloco.matchAll(/--color-([a-z]+(?:-[a-z0-9]+)*)\s*:\s*(#[0-9a-fA-F]{6})\b/g)].map(([, nome, hex]) => [nome ?? '', (hex ?? '').toLowerCase()]))
  return { claro: ler(miolo(css, css.indexOf('@theme static'))), escuro: ler(miolo(css, css.search(/:root\[data-tema='escuro'\]\s*\{/))) }
}

/** Luminância relativa da WCAG 2.1 de um hex de seis dígitos. */
function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((posicao) => {
    const canal = Number.parseInt(hex.slice(posicao, posicao + 2), 16) / 255
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (canais[0] ?? 0) + 0.7152 * (canais[1] ?? 0) + 0.0722 * (canais[2] ?? 0)
}

/** A razão de contraste entre duas cores, de 1 a 21. */
function contraste(uma: string, outra: string): number {
  const [clara = 0, escura = 0] = [luminancia(uma), luminancia(outra)].sort((a, b) => b - a)
  return (clara + 0.05) / (escura + 0.05)
}

/** Os pares de um tema abaixo do mínimo, e os que citam token que o tema não tem, como texto para a mensagem do teste. */
function reprovados(pares: readonly Par[], cores: Map<string, string>, tema: Tema): string[] {
  return pares.flatMap(({ nome, texto, fundo, minimo }) => {
    const corDoTexto = cores.get(texto)
    const corDoFundo = cores.get(fundo)
    if (corDoTexto === undefined || corDoFundo === undefined) return [`${tema} · ${nome}: ${corDoTexto === undefined ? texto : fundo} não existe em index.css`]
    const razao = contraste(corDoTexto, corDoFundo)
    return razao >= minimo ? [] : [`${tema} · ${nome}: ${texto} (${corDoTexto}) sobre ${fundo} (${corDoFundo}) dá ${razao.toFixed(2)}, e o mínimo é ${String(minimo)}`]
  })
}

describe('contraste dos pares da pele (docs/interface.md 9.1)', () => {
  it('a conta é a da WCAG 2.1: preto no branco dá 21, e o cinza do piso, 6,6', () => {
    // Sem esta âncora, um erro na fórmula deixaria todo par passando, ou nenhum.
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contraste('#5d5d5d', '#ffffff')).toBeCloseTo(6.59, 1)
    expect(contraste('#777777', '#777777')).toBe(1)
  })

  it('a tabela de pares é lida inteira, com o mínimo de cada linha', () => {
    const pares = paresDoDocumento()
    expect(pares.length).toBe(PARES_DA_TABELA)
    // Só existem dois mínimos: 4,5 para texto e 3 para a borda e o anel que são a única pista de um controle.
    expect([...new Set(pares.map(({ minimo }) => minimo))].sort()).toEqual([3, 4.5])
    // O piso de texto, a borda de campo e o anel de foco estão na tabela: sem eles a conta deixa de fora o que mais importa.
    expect(pares).toContainEqual({ nome: 'sutil, chão', texto: 'sutil', fundo: 'fundo', minimo: 4.5 })
    expect(pares.some(({ texto, minimo }) => texto === 'borda-campo' && minimo === 3)).toBe(true)
    expect(pares.some(({ texto, minimo }) => texto === 'foco' && minimo === 3)).toBe(true)
  })

  it.each(['claro', 'escuro'] as const)('no tema %s, todo par passa do mínimo dele', (tema) => {
    expect(reprovados(paresDoDocumento(), coresDoProduto()[tema], tema)).toEqual([])
  })

  it('a conferência reprova o par abaixo do mínimo e o token que não existe, com o nome e o número', () => {
    // O modo de falhar deste arquivo é passar sempre: aqui a mesma função recebe um par que não passa.
    const cores = new Map([
      ['sutil', '#afafaf'],
      ['fundo', '#ffffff'],
    ])
    expect(
      reprovados(
        [
          { nome: 'Texto apagado no chão', texto: 'sutil', fundo: 'fundo', minimo: 4.5 },
          { nome: 'Borda apagada no chão', texto: 'sutil', fundo: 'fundo', minimo: 3 },
          { nome: 'Par com token que saiu', texto: 'sumiu', fundo: 'fundo', minimo: 4.5 },
        ],
        cores,
        'claro',
      ),
    ).toEqual([
      'claro · Texto apagado no chão: sutil (#afafaf) sobre fundo (#ffffff) dá 2.19, e o mínimo é 4.5',
      'claro · Borda apagada no chão: sutil (#afafaf) sobre fundo (#ffffff) dá 2.19, e o mínimo é 3',
      'claro · Par com token que saiu: sumiu não existe em index.css',
    ])
  })
})
