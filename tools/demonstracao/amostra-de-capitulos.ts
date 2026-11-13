/**
 * A amostra fixa dos capítulos (ingestao-do-material, tarefa 4.0; Tech Spec, seção 12, "o `getOutline()` acha a página de todo marcador"): PDFs sintéticos
 * montados à mão, byte a byte, que o `ChapterReader` lê com o `pdfjs` de verdade. São seis, um por jeito de o PDF dizer onde um capítulo começa (ou de não
 * dizer): o marcador, o marcador de destino nomeado, a linha no topo, a linha repetida como cabeçalho corrido, o sumário que lista os capítulos e o PDF
 * sem nada. Cada amostra traz o que se espera: o capítulo de cada página, e a taxa mínima é 100%.
 *
 * - **Montado aqui, e não commitado**: o PDF é função do conteúdo e determinístico (nada depende do relógio nem da máquina), e as variações da amostra
 *   (um marcador a mais, uma linha a menos) nascem de uma linha de código, não de um arquivo binário novo.
 * - **Texto de verdade, na fonte padrão do PDF** (Helvetica), uma linha por posição, como o `gerar-material.ts` escreve. Só caractere do latim-1: é a
 *   codificação que o PDF usa nos títulos dos marcadores e na fonte.
 * - O número da página de um marcador é de 1 em diante, como o do contrato.
 */

/** Onde um capítulo começa, no marcador do PDF. `nivel` 2 é o marcador filho, que não é capítulo. */
export interface MarcadorDaAmostra {
  readonly titulo: string
  readonly pagina: number
  readonly nivel?: 1 | 2
  /** `nomeado`: o marcador aponta para um destino nomeado da árvore de nomes do PDF, que o leitor resolve até a página. */
  readonly destino?: 'direto' | 'nomeado'
}

export interface AmostraDeCapitulos {
  readonly nome: string
  /** As linhas de cada página, de cima para baixo. */
  readonly paginas: readonly (readonly string[])[]
  readonly marcadores: readonly MarcadorDaAmostra[]
  /** O que o leitor tem de achar: a ordem do capítulo de cada página (`null`: página fora de capítulo) e o número de cada capítulo. */
  readonly capituloDaPagina: readonly (number | null)[]
  readonly numeros: readonly (number | null)[]
}

const escapar = (texto: string): string => texto.replace(/[\\()]/g, (caractere) => `\\${caractere}`)

/**
 * Monta o PDF: as páginas com o texto de cada uma, e o marcador (`/Outlines`) e a árvore de nomes (`/Names`) quando a amostra os tem. O objeto 1 é o
 * catálogo, o 2 a árvore de páginas, o 3 a fonte; depois, uma página e o conteúdo dela, a raiz dos marcadores e um objeto por marcador.
 */
export function montarPdfDaAmostra({ paginas, marcadores }: Pick<AmostraDeCapitulos, 'paginas' | 'marcadores'>): Buffer {
  const total = paginas.length
  const objetoDaPagina = (indice: number): number => 4 + 2 * indice
  const raizDosMarcadores = 4 + 2 * total
  const objetoDoMarcador = (indice: number): number => raizDosMarcadores + 1 + indice
  const nomeDoDestino = (indice: number): string => `destino-${String(indice).padStart(3, '0')}`
  const destinoDe = (marcador: MarcadorDaAmostra, indice: number): string =>
    marcador.destino === 'nomeado' ? `(${nomeDoDestino(indice)})` : `[${String(objetoDaPagina(marcador.pagina - 1))} 0 R /Fit]`

  const objetos: string[] = []
  const nomeados = marcadores.flatMap((marcador, indice) => (marcador.destino === 'nomeado' ? [`(${nomeDoDestino(indice)}) [${String(objetoDaPagina(marcador.pagina - 1))} 0 R /Fit]`] : []))
  const arvoreDeNomes = nomeados.length === 0 ? '' : ` /Names << /Dests << /Names [${nomeados.join(' ')}] >> >>`
  const comMarcadores = marcadores.length > 0
  objetos.push(`<< /Type /Catalog /Pages 2 0 R${comMarcadores ? ` /Outlines ${String(raizDosMarcadores)} 0 R` : ''}${arvoreDeNomes} >>`)
  objetos.push(`<< /Type /Pages /Kids [${paginas.map((_, indice) => `${String(objetoDaPagina(indice))} 0 R`).join(' ')}] /Count ${String(total)} >>`)
  objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  paginas.forEach((linhas, indice) => {
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${String(objetoDaPagina(indice) + 1)} 0 R >>`)
    const conteudo = linhas.map((linha, posicao) => `BT /F1 12 Tf 72 ${String(780 - 24 * posicao)} Td (${escapar(linha)}) Tj ET`).join('\n')
    objetos.push(`<< /Length ${String(conteudo.length)} >>\nstream\n${conteudo}\nendstream`)
  })

  if (comMarcadores) {
    // Os de primeiro nível ligam-se entre si; cada filho (nivel 2) liga-se ao último de primeiro nível que o antecede.
    const topos = marcadores.flatMap((marcador, indice) => ((marcador.nivel ?? 1) === 1 ? [indice] : []))
    const filhosDe = (pai: number): number[] => {
      const seguinte = topos.find((topo) => topo > pai) ?? marcadores.length
      return marcadores.flatMap((marcador, indice) => (indice > pai && indice < seguinte && marcador.nivel === 2 ? [indice] : []))
    }
    const ligacao = (chave: string, indice: number | undefined): string => (indice === undefined ? '' : `/${chave} ${String(objetoDoMarcador(indice))} 0 R`)
    const primeiro = topos[0] ?? 0
    const ultimo = topos.at(-1) ?? 0
    objetos.push(`<< /Type /Outlines /First ${String(objetoDoMarcador(primeiro))} 0 R /Last ${String(objetoDoMarcador(ultimo))} 0 R /Count ${String(topos.length)} >>`)
    marcadores.forEach((marcador, indice) => {
      const nivel = marcador.nivel ?? 1
      const irmaos = nivel === 1 ? topos : filhosDe(topos.filter((topo) => topo < indice).at(-1) ?? 0)
      const posicao = irmaos.indexOf(indice)
      const pai = nivel === 1 ? raizDosMarcadores : objetoDoMarcador(topos.filter((topo) => topo < indice).at(-1) ?? 0)
      const anterior = irmaos[posicao - 1]
      const proximo = irmaos[posicao + 1]
      const filhos = nivel === 1 ? filhosDe(indice) : []
      objetos.push(
        [
          `<< /Title (${escapar(marcador.titulo)}) /Parent ${String(pai)} 0 R`,
          ligacao('Prev', anterior),
          ligacao('Next', proximo),
          ligacao('First', filhos[0]),
          ligacao('Last', filhos.at(-1)),
          filhos.length === 0 ? '' : `/Count ${String(filhos.length)}`,
          `/Dest ${destinoDe(marcador, indice)} >>`,
        ]
          .filter((parte) => parte !== '')
          .join(' '),
      )
    })
  }

  let corpo = '%PDF-1.4\n'
  const deslocamentos = objetos.map((objeto, indice) => {
    const deslocamento = corpo.length
    corpo += `${String(indice + 1)} 0 obj\n${objeto}\nendobj\n`
    return deslocamento
  })
  const tabela = [`0000000000 65535 f `, ...deslocamentos.map((deslocamento) => `${String(deslocamento).padStart(10, '0')} 00000 n `)].join('\n')
  const fim = `xref\n0 ${String(objetos.length + 1)}\n${tabela}\ntrailer\n<< /Size ${String(objetos.length + 1)} /Root 1 0 R >>\nstartxref\n${String(corpo.length)}\n%%EOF\n`
  return Buffer.from(corpo + fim, 'latin1')
}

const FRASES = [
  'O mol conta entidades como a dúzia conta ovos.',
  'A massa molar da água é de dezoito gramas por mol.',
  'Toda reação conserva a massa dos átomos que entram.',
  'O reagente limitante acaba primeiro e decide o rendimento.',
  'A concentração diz quantos mols cabem em cada litro.',
  'A diluição muda o volume e mantém a quantidade de soluto.',
] as const

/** O texto corrido de uma página que não é começo de capítulo: nenhuma linha dele casa com "Capítulo N", e nenhuma se repete em todas as páginas (o que `tirarLinhasRepetidas` tiraria). */
const corpoDaPagina = (pagina: number): string[] => [`Página ${String(pagina)}, ${FRASES[pagina - 1] ?? ''}`, `Anotação ${FRASES[(pagina % FRASES.length)] ?? ''}`]

const seisPaginas = (primeiraLinhaDe: (pagina: number) => string | undefined): string[][] =>
  Array.from({ length: 6 }, (_, indice) => {
    const primeira = primeiraLinhaDe(indice + 1)
    return primeira === undefined ? corpoDaPagina(indice + 1) : [primeira, ...corpoDaPagina(indice + 1)]
  })

const MARCADORES: readonly MarcadorDaAmostra[] = [
  { titulo: 'Capítulo 1: Mol e massa molar', pagina: 1 },
  { titulo: '1.1 Massa molar', pagina: 2, nivel: 2 },
  { titulo: 'Capítulo 2: Reações químicas', pagina: 3 },
  { titulo: 'Soluções', pagina: 5 },
]

const CAPITULOS_DOS_MARCADORES = { capituloDaPagina: [1, 1, 2, 2, 3, 3], numeros: [1, 2, null] } as const
const CAPITULOS_DA_LINHA = { capituloDaPagina: [1, 1, 1, 2, 2, 2], numeros: [1, 2] } as const

export const AMOSTRAS_DE_CAPITULOS: readonly AmostraDeCapitulos[] = [
  { nome: 'marcador', paginas: seisPaginas(() => undefined), marcadores: MARCADORES, ...CAPITULOS_DOS_MARCADORES },
  { nome: 'destino nomeado', paginas: seisPaginas(() => undefined), marcadores: MARCADORES.map((marcador) => ({ ...marcador, destino: 'nomeado' as const })), ...CAPITULOS_DOS_MARCADORES },
  {
    nome: 'linha no topo',
    paginas: seisPaginas((pagina) => (pagina === 1 ? 'Capítulo 1: Mol e massa molar' : pagina === 4 ? 'Capítulo 2: Reações químicas' : undefined)),
    marcadores: [],
    ...CAPITULOS_DA_LINHA,
  },
  {
    // A linha se repete em toda página do capítulo, como o cabeçalho de um livro: o capítulo é um só até o número mudar.
    nome: 'cabeçalho corrido',
    paginas: seisPaginas((pagina) => (pagina <= 3 ? 'Capítulo 1' : 'Capítulo 2')),
    marcadores: [],
    ...CAPITULOS_DA_LINHA,
  },
  {
    // A página 1 lista os capítulos: três linhas casam, e ela não começa o capítulo 1, que começa na página 2.
    nome: 'sumário',
    paginas: seisPaginas((pagina) => (pagina === 2 ? 'Capítulo 1: Mol e massa molar' : pagina === 4 ? 'Capítulo 2: Reações químicas' : pagina === 6 ? 'Capítulo 3: Soluções' : undefined)).map((linhas, indice) =>
      indice === 0 ? ['Sumário', 'Capítulo 1: Mol e massa molar ... 2', 'Capítulo 2: Reações químicas ... 4', 'Capítulo 3: Soluções ... 6'] : linhas,
    ),
    marcadores: [],
    capituloDaPagina: [null, 1, 1, 2, 2, 3],
    numeros: [1, 2, 3],
  },
  { nome: 'sem capítulo', paginas: seisPaginas(() => undefined), marcadores: [], capituloDaPagina: [null, null, null, null, null, null], numeros: [] },
]
