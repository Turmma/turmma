import { describe, expect, it } from 'vitest'
import { AMOSTRAS_DE_CAPITULOS, montarPdfDaAmostra } from '../../../../tools/demonstracao/amostra-de-capitulos.ts'
import { CASAMENTOS_QUE_FAZEM_UM_SUMARIO, ChapterReader, LINHAS_DO_TOPO_DA_PAGINA, MAXIMO_DE_CAPITULOS_POR_MATERIAL, type DocumentoComMarcadores } from './chapter-reader.js'
import { PdfExtractor } from './pdf-extractor.js'

const leitor = new ChapterReader()

interface MarcadorFalso {
  title: string
  dest?: unknown
}

/** O destino direto do PDF: a referência da página e o jeito de mostrá-la. No falso, a referência de página `n` é `{ num: n }`, e o índice dela é `n - 1`. */
const paraAPagina = (pagina: number): unknown[] => [{ num: pagina, gen: 0 }, { name: 'Fit' }]
const marcador = (title: string, pagina: number, extra: Partial<MarcadorFalso> = {}): MarcadorFalso => ({ title, dest: paraAPagina(pagina), ...extra })

interface DocumentoFalsoOptions {
  readonly arvore: MarcadorFalso[] | null
  readonly destinos?: Readonly<Record<string, unknown[] | null>>
  readonly quebraEm?: 'getOutline' | 'getDestination' | 'getPageIndex'
}

/** O PDF aberto, sem PDF: o `getOutline()` devolve o que o caso quer, e a referência `{ num }` vira o índice `num - 1`. */
function documentoFalso({ arvore, destinos = {}, quebraEm }: DocumentoFalsoOptions): DocumentoComMarcadores {
  const quebrar = (onde: NonNullable<DocumentoFalsoOptions['quebraEm']>): void => {
    if (quebraEm === onde) throw new Error(`${onde} quebrou`)
  }
  return {
    getOutline: () => {
      quebrar('getOutline')
      return Promise.resolve(arvore)
    },
    getDestination: (nome) => {
      quebrar('getDestination')
      return Promise.resolve(destinos[nome] ?? null)
    },
    getPageIndex: (referencia) => {
      quebrar('getPageIndex')
      return Promise.resolve((referencia as unknown as { num: number }).num - 1)
    },
  }
}

/** Um PDF de `total` páginas sem nenhuma linha de capítulo: o texto corrido de cada uma. */
const semLinhas = (total: number): string[][] => Array.from({ length: total }, (_, indice) => [`texto da página ${String(indice + 1)}`])

const lerComMarcadores = (arvore: MarcadorFalso[], total = 6) => leitor.ler(documentoFalso({ arvore }), semLinhas(total))
const lerPelasLinhas = (linhasPorPagina: string[][]) => leitor.ler(documentoFalso({ arvore: null }), linhasPorPagina)

describe('ChapterReader: o marcador de primeiro nível', () => {
  it('cada marcador de primeiro nível vira um capítulo, do começo dele até a página antes do seguinte; o último vai até o fim do PDF e a página antes do primeiro fica fora', async () => {
    const capitulos = await lerComMarcadores([marcador('Capítulo 1: Mol', 2), marcador('Capítulo 2: Reações', 4)])
    expect(capitulos).toEqual([
      { ordem: 1, numero: 1, titulo: 'Capítulo 1: Mol', paginaInicial: 2, paginaFinal: 3 },
      { ordem: 2, numero: 2, titulo: 'Capítulo 2: Reações', paginaInicial: 4, paginaFinal: 6 },
    ])
  })

  it('o marcador de segundo nível não vira capítulo: só a lista de primeiro nível é lida', async () => {
    const arvore = [{ ...marcador('Capítulo 1: Mol', 1), items: [marcador('1.1 Massa molar', 2)] }, marcador('Capítulo 2: Reações', 3)]
    const capitulos = await lerComMarcadores(arvore)
    expect(capitulos.map(({ titulo, paginaInicial, paginaFinal }) => [titulo, paginaInicial, paginaFinal])).toEqual([
      ['Capítulo 1: Mol', 1, 2],
      ['Capítulo 2: Reações', 3, 6],
    ])
  })

  it('dois marcadores na mesma página: fica o primeiro, na ordem do PDF', async () => {
    const capitulos = await lerComMarcadores([marcador('Primeiro da página 3', 3), marcador('Segundo da página 3', 3), marcador('Da página 5', 5)])
    expect(capitulos.map(({ titulo, paginaInicial }) => [titulo, paginaInicial])).toEqual([
      ['Primeiro da página 3', 3],
      ['Da página 5', 5],
    ])
  })

  it('marcadores fora de ordem saem ordenados pela página, e a ordem do capítulo é a da página', async () => {
    const capitulos = await lerComMarcadores([marcador('C', 5), marcador('A', 1), marcador('B', 3)])
    expect(capitulos.map(({ ordem, titulo, paginaInicial, paginaFinal }) => [ordem, titulo, paginaInicial, paginaFinal])).toEqual([
      [1, 'A', 1, 2],
      [2, 'B', 3, 4],
      [3, 'C', 5, 6],
    ])
  })

  it('título vazio vira "Capítulo N", com N a ordem, e o número fica nulo', async () => {
    const capitulos = await lerComMarcadores([marcador('Capítulo 1: Mol', 1), marcador('', 3), marcador('   ', 5)])
    expect(capitulos.map(({ ordem, numero, titulo }) => [ordem, numero, titulo])).toEqual([
      [1, 1, 'Capítulo 1: Mol'],
      [2, null, 'Capítulo 2'],
      [3, null, 'Capítulo 3'],
    ])
  })

  it('título de 300 caracteres é cortado em 200, e o corte não deixa espaço no fim', async () => {
    const [longo] = await lerComMarcadores([marcador('a'.repeat(300), 1)])
    expect(longo?.titulo).toBe('a'.repeat(200))
    const [cortadoNoEspaco] = await lerComMarcadores([marcador(`${'a'.repeat(199)} ${'b'.repeat(100)}`, 1)])
    expect(cortadoNoEspaco?.titulo).toBe('a'.repeat(199))
  })

  it('o título sai limpo: caractere de controle (o NUL que o Postgres não guarda) vira espaço', async () => {
    const [capitulo] = await lerComMarcadores([marcador('Capítulo\u0000 1:\u0007  Mol', 1)])
    expect(capitulo?.titulo).toBe('Capítulo 1: Mol')
    // Sem espaço nas pontas: com um na frente a regra do número não casaria.
    const [comEspaco] = await lerComMarcadores([marcador('   Capítulo 5: Soluções   ', 1)])
    expect(comEspaco).toMatchObject({ numero: 5, titulo: 'Capítulo 5: Soluções' })
  })

  it('o número do capítulo é o que o título escreve; acima do maior `int` fica nulo, e no limite cabe', async () => {
    const capitulos = await lerComMarcadores([marcador('Capítulo 2147483647', 1), marcador('Capítulo 2147483648', 2), marcador('Capítulo 99999999999999999999 sem fim', 3), marcador('Unidade 04: Soluções', 4), marcador('Soluções', 5)])
    expect(capitulos.map(({ numero }) => numero)).toEqual([2_147_483_647, null, null, 4, null])
  })

  it('o destino nomeado é resolvido pelo documento até a página; o nome que não resolve, ou o marcador sem destino, é pulado', async () => {
    const documento = documentoFalso({
      arvore: [
        { title: 'Capítulo 1: Mol', dest: 'inicio-do-1' },
        { title: 'Capítulo 2: Sem destino', dest: 'nome-que-nao-existe' },
        { title: 'Link para fora' },
        { title: 'Capítulo 3: Soluções', dest: 'inicio-do-3' },
      ],
      destinos: { 'inicio-do-1': paraAPagina(1), 'inicio-do-3': paraAPagina(4) },
    })
    expect((await leitor.ler(documento, semLinhas(6))).map(({ titulo, paginaInicial, paginaFinal }) => [titulo, paginaInicial, paginaFinal])).toEqual([
      ['Capítulo 1: Mol', 1, 3],
      ['Capítulo 3: Soluções', 4, 6],
    ])
  })

  it('destino que não é página (o primeiro item não é referência, ou não há array) é pulado', async () => {
    // Os pulados ficam entre dois válidos: um que fosse mantido apareceria no meio, e não só no começo da lista.
    const capitulos = await lerComMarcadores([
      marcador('Válido', 2),
      { title: 'Número no lugar da referência', dest: [3, 'Fit'] },
      { title: 'Vazio', dest: [] },
      { title: 'Nulo', dest: null },
      { title: 'Referência nula', dest: [null] },
      marcador('Outro válido', 4),
    ])
    expect(capitulos.map(({ titulo }) => titulo)).toEqual(['Válido', 'Outro válido'])
  })

  it('a página fora do PDF não vira capítulo: depois da última, e antes da primeira', async () => {
    const capitulos = await lerComMarcadores([marcador('Antes', 0), marcador('Dentro', 2), marcador('Depois', 7)], 6)
    expect(capitulos.map(({ titulo, paginaInicial, paginaFinal }) => [titulo, paginaInicial, paginaFinal])).toEqual([['Dentro', 2, 6]])
  })

  it('a última página do PDF ainda é página de capítulo', async () => {
    expect(await lerComMarcadores([marcador('Só na última', 6)], 6)).toEqual([{ ordem: 1, numero: null, titulo: 'Só na última', paginaInicial: 6, paginaFinal: 6 }])
  })

  it('o número vem da palavra e do número no começo do título, em qualquer caixa: "Capítulo", "Unidade" e "Módulo", com ou sem acento', async () => {
    const titulos = ['CAPÍTULO 2', 'Capitulo 3', 'unidade 4', 'Módulo 5', 'modulo 6']
    const capitulos = await lerComMarcadores(titulos.map((titulo, indice) => marcador(titulo, indice + 1)), 5)
    expect(capitulos.map(({ numero }) => numero)).toEqual([2, 3, 4, 5, 6])
  })

  it('o número só conta no começo do título e separado da palavra: "Veja o Capítulo 3" e "Capítulo3" ficam sem número', async () => {
    const capitulos = await lerComMarcadores([marcador('Veja o Capítulo 3', 1), marcador('Capítulo3', 2), marcador('Parte 4', 3)], 3)
    expect(capitulos.map(({ numero }) => numero)).toEqual([null, null, null])
  })

  it('marcador que não resolve nenhuma página, ou outline nulo, cai na linha do topo da página', async () => {
    const linhas = [['Capítulo 1: Mol', 'texto'], ['texto'], ['Capítulo 2: Reações', 'texto']]
    const semPagina = documentoFalso({ arvore: [{ title: 'Link', dest: null }] })
    expect((await leitor.ler(semPagina, linhas)).map(({ titulo }) => titulo)).toEqual(['Capítulo 1: Mol', 'Capítulo 2: Reações'])
    expect((await lerPelasLinhas(linhas)).map(({ titulo }) => titulo)).toEqual(['Capítulo 1: Mol', 'Capítulo 2: Reações'])
  })

  it('com marcador, a linha do topo não é lida: o marcador manda', async () => {
    const linhas = [['Capítulo 9: Da linha', 'texto'], ['texto'], ['texto']]
    const capitulos = await leitor.ler(documentoFalso({ arvore: [marcador('Do marcador', 2)] }), linhas)
    expect(capitulos.map(({ titulo, paginaInicial }) => [titulo, paginaInicial])).toEqual([['Do marcador', 2]])
  })

  it(`mais de ${String(MAXIMO_DE_CAPITULOS_POR_MATERIAL)} capítulos não é livro dividido em capítulos: zero capítulos; no teto, ficam todos`, async () => {
    const paginas = MAXIMO_DE_CAPITULOS_POR_MATERIAL + 1
    const marcadores = Array.from({ length: paginas }, (_, indice) => marcador(`Marcador ${String(indice + 1)}`, indice + 1))
    expect(await lerComMarcadores(marcadores, paginas)).toEqual([])
    expect(await lerComMarcadores(marcadores.slice(0, MAXIMO_DE_CAPITULOS_POR_MATERIAL), paginas)).toHaveLength(MAXIMO_DE_CAPITULOS_POR_MATERIAL)
  })

  it(`pela linha do topo, mais de ${String(MAXIMO_DE_CAPITULOS_POR_MATERIAL)} capítulos também dão zero; no teto, ficam todos`, async () => {
    const umPorPagina = (paginas: number): string[][] => Array.from({ length: paginas }, (_, indice) => [`Capítulo ${String(indice + 1)}`, 'texto'])
    expect(await lerPelasLinhas(umPorPagina(MAXIMO_DE_CAPITULOS_POR_MATERIAL + 1))).toEqual([])
    expect(await lerPelasLinhas(umPorPagina(MAXIMO_DE_CAPITULOS_POR_MATERIAL))).toHaveLength(MAXIMO_DE_CAPITULOS_POR_MATERIAL)
  })

  it('acima do teto, o leitor para de resolver destinos na página que estoura: a extração não segura a vaga da escola por um marcador por página', async () => {
    const paginas = MAXIMO_DE_CAPITULOS_POR_MATERIAL * 5
    const marcadores = Array.from({ length: paginas }, (_, indice) => marcador(`Marcador ${String(indice + 1)}`, indice + 1))
    const falso = documentoFalso({ arvore: marcadores })
    let resolvidos = 0
    const documento: DocumentoComMarcadores = {
      ...falso,
      getPageIndex: (referencia) => {
        resolvidos += 1
        return falso.getPageIndex(referencia)
      },
    }
    expect(await leitor.ler(documento, semLinhas(paginas))).toEqual([])
    expect(resolvidos).toBe(MAXIMO_DE_CAPITULOS_POR_MATERIAL + 1)
  })

  it('acima do teto de marcadores, o leitor não cai na linha do topo: o PDF com um marcador por página e "Capítulo 1" na primeira página dá zero capítulos', async () => {
    const paginas = MAXIMO_DE_CAPITULOS_POR_MATERIAL + 1
    const marcadores = Array.from({ length: paginas }, (_, indice) => marcador(`Marcador ${String(indice + 1)}`, indice + 1))
    const linhas = semLinhas(paginas).map((pagina, indice) => (indice === 0 ? ['Capítulo 1', ...pagina] : pagina))
    expect(await leitor.ler(documentoFalso({ arvore: marcadores }), linhas)).toEqual([])
  })

  it('o teto conta páginas distintas: marcadores repetidos na mesma página e os que não resolvem não o estouram', async () => {
    const repetidos = Array.from({ length: MAXIMO_DE_CAPITULOS_POR_MATERIAL }, (_, indice) => marcador(`Marcador ${String(indice + 1)}`, indice + 1))
    const arvore = [...repetidos, marcador('Repetido da página 1', 1), { title: 'Sem destino' }, marcador('Fora do PDF', MAXIMO_DE_CAPITULOS_POR_MATERIAL + 50)]
    expect(await lerComMarcadores(arvore, MAXIMO_DE_CAPITULOS_POR_MATERIAL)).toHaveLength(MAXIMO_DE_CAPITULOS_POR_MATERIAL)
  })

  it.each(['getOutline', 'getDestination', 'getPageIndex'] as const)('o erro do leitor (%s) dá zero capítulos, sem falhar', async (quebraEm) => {
    const documento = documentoFalso({ arvore: [{ title: 'Capítulo 1', dest: 'destino' }, marcador('Capítulo 2', 3)], destinos: { destino: paraAPagina(1) }, quebraEm })
    await expect(leitor.ler(documento, semLinhas(6))).resolves.toEqual([])
  })
})

describe('ChapterReader: a linha "Capítulo N" no topo da página', () => {
  const pagina = (...linhas: string[]): string[] => [...linhas, 'texto corrido da página']

  it('a linha cria o capítulo na página em que aparece, com o título que ela escreve e o número dela', async () => {
    const capitulos = await lerPelasLinhas([pagina(), pagina('Capítulo 1: Mol'), pagina(), pagina('Unidade 2 — Reações'), pagina()])
    expect(capitulos).toEqual([
      { ordem: 1, numero: 1, titulo: 'Capítulo 1: Mol', paginaInicial: 2, paginaFinal: 3 },
      { ordem: 2, numero: 2, titulo: 'Unidade 2 — Reações', paginaInicial: 4, paginaFinal: 5 },
    ])
  })

  it('o cabeçalho corrido ("Capítulo 3" em toda página do capítulo) cria um capítulo só, e o número que muda cria o seguinte', async () => {
    const capitulos = await lerPelasLinhas([pagina('Capítulo 3'), pagina('Capítulo 3'), pagina('Capítulo 3'), pagina('Capítulo 4'), pagina('Capítulo 4')])
    expect(capitulos.map(({ numero, paginaInicial, paginaFinal }) => [numero, paginaInicial, paginaFinal])).toEqual([
      [3, 1, 3],
      [4, 4, 5],
    ])
  })

  it('o mesmo número escrito de outro jeito ("03") é o mesmo capítulo; o que volta a um número anterior é capítulo novo', async () => {
    const capitulos = await lerPelasLinhas([pagina('Capítulo 3'), pagina('Capítulo 03'), pagina('Capítulo 4'), pagina('Capítulo 3')])
    expect(capitulos.map(({ numero, paginaInicial }) => [numero, paginaInicial])).toEqual([
      [3, 1],
      [4, 3],
      [3, 4],
    ])
  })

  it('o número acima de `int` na linha fica nulo, e a mesma linha repetida continua sendo um capítulo só', async () => {
    const capitulos = await lerPelasLinhas([pagina('Capítulo 99999999999'), pagina('Capítulo 99999999999')])
    expect(capitulos.map(({ numero, paginaInicial, paginaFinal }) => [numero, paginaInicial, paginaFinal])).toEqual([[null, 1, 2]])
  })

  it(`a página com ${String(CASAMENTOS_QUE_FAZEM_UM_SUMARIO)} linhas que casam, em qualquer lugar dela, é sumário e não começa capítulo; com uma a menos, começa`, async () => {
    const sumario = ['Sumário', 'Capítulo 1: Mol ... 2', 'Capítulo 2: Reações ... 3', 'Capítulo 3: Soluções ... 4']
    const quaseSumario = ['Capítulo 1: Mol ... 2', 'Capítulo 2: Reações ... 3', 'texto']
    expect((await lerPelasLinhas([sumario, pagina('Capítulo 1: Mol'), pagina('Capítulo 2: Reações')])).map(({ numero, paginaInicial }) => [numero, paginaInicial])).toEqual([
      [1, 2],
      [2, 3],
    ])
    expect((await lerPelasLinhas([quaseSumario, pagina()])).map(({ numero, paginaInicial }) => [numero, paginaInicial])).toEqual([[1, 1]])
  })

  it('o sumário não muda o capítulo em curso: o cabeçalho corrido segue depois dele sem criar outro', async () => {
    const sumario = ['Capítulo 3 ... 1', 'Capítulo 4 ... 2', 'Capítulo 5 ... 3', 'texto']
    const capitulos = await lerPelasLinhas([pagina('Capítulo 3'), sumario, pagina('Capítulo 3')])
    expect(capitulos.map(({ numero, paginaInicial, paginaFinal }) => [numero, paginaInicial, paginaFinal])).toEqual([[3, 1, 3]])
  })

  it(`só as ${String(LINHAS_DO_TOPO_DA_PAGINA)} primeiras linhas contam como topo: a linha mais abaixo é texto`, async () => {
    const capitulos = await lerPelasLinhas([['Colégio sintético', 'Capítulo 1: Mol', 'texto'], ['a', 'b', 'Capítulo 2: no meio da página', 'texto']])
    expect(capitulos.map(({ numero }) => numero)).toEqual([1])
  })

  it('a linha só conta no começo: "Veja o Capítulo 3" e "Capítulo3" não criam capítulo', async () => {
    expect(await lerPelasLinhas([['Veja o Capítulo 3'], ['Capítulo3: sem espaço']])).toEqual([])
  })

  it('a palavra vale em qualquer caixa e com ou sem acento', async () => {
    const capitulos = await lerPelasLinhas([['CAPÍTULO 1'], ['Capitulo 2'], ['unidade 3'], ['Módulo 4'], ['modulo 5']])
    expect(capitulos.map(({ numero }) => numero)).toEqual([1, 2, 3, 4, 5])
  })

  it('sem marcador e sem linha, zero capítulos; PDF sem página também', async () => {
    expect(await lerPelasLinhas(semLinhas(5))).toEqual([])
    expect(await lerPelasLinhas([])).toEqual([])
  })
})

describe('ChapterReader: a amostra fixa, com o pdfjs de verdade (Tech Spec, seção 12)', () => {
  /** O capítulo (a ordem) de cada página, como o leitor a vê: a página fora de todo capítulo é `null`. */
  const capituloDeCadaPagina = (capitulos: readonly { ordem: number; paginaInicial: number; paginaFinal: number }[], total: number): (number | null)[] =>
    Array.from({ length: total }, (_, indice) => capitulos.find(({ paginaInicial, paginaFinal }) => paginaInicial <= indice + 1 && indice + 1 <= paginaFinal)?.ordem ?? null)

  it.each(AMOSTRAS_DE_CAPITULOS.map((amostra) => [amostra.nome, amostra] as const))('%s: 100% das páginas no capítulo certo, e o número de cada capítulo', async (_nome, amostra) => {
    const resultado = await new PdfExtractor().extrair(new Uint8Array(montarPdfDaAmostra(amostra)))
    if (resultado.falha !== null) throw new Error(`a extração falhou: ${resultado.falha}`)

    expect(capituloDeCadaPagina(resultado.capitulos, resultado.paginas)).toEqual(amostra.capituloDaPagina)
    expect(resultado.capitulos.map(({ numero }) => numero)).toEqual(amostra.numeros)
  })

  it('o cabeçalho corrido some do trecho e continua sendo lido como capítulo: o dado da linha está nas linhas de antes da limpeza', async () => {
    const amostra = AMOSTRAS_DE_CAPITULOS.find(({ nome }) => nome === 'cabeçalho corrido')
    if (amostra === undefined) throw new Error('a amostra do cabeçalho corrido sumiu')
    const resultado = await new PdfExtractor().extrair(new Uint8Array(montarPdfDaAmostra(amostra)))
    if (resultado.falha !== null) throw new Error(`a extração falhou: ${resultado.falha}`)

    expect(resultado.trechos.map(({ texto }) => texto).join('\n')).not.toMatch(/Capítulo/)
    expect(resultado.capitulos).toHaveLength(2)
  })

  it('o destino nomeado e o direto dão o mesmo resultado, com o título e a faixa de páginas', async () => {
    const [direto, nomeado] = await Promise.all(
      ['marcador', 'destino nomeado'].map(async (nome) => {
        const amostra = AMOSTRAS_DE_CAPITULOS.find((candidata) => candidata.nome === nome)
        if (amostra === undefined) throw new Error(`a amostra ${nome} sumiu`)
        const resultado = await new PdfExtractor().extrair(new Uint8Array(montarPdfDaAmostra(amostra)))
        return resultado.falha === null ? resultado.capitulos : undefined
      }),
    )
    expect(direto).toEqual([
      { ordem: 1, numero: 1, titulo: 'Capítulo 1: Mol e massa molar', paginaInicial: 1, paginaFinal: 2 },
      { ordem: 2, numero: 2, titulo: 'Capítulo 2: Reações químicas', paginaInicial: 3, paginaFinal: 4 },
      { ordem: 3, numero: null, titulo: 'Soluções', paginaInicial: 5, paginaFinal: 6 },
    ])
    expect(nomeado).toEqual(direto)
  })
})
