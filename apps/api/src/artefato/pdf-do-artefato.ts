import { ROTULOS_DA_ADAPTACAO, type Citacao, type ConteudoDeAtividade, type ConteudoDePlanoDeAula, type ConteudoDoArtefato } from '@educa/shared'
import PDFDocument from 'pdfkit'

/**
 * O PDF de um artefato (MVP, A2; D63, D67), gerado na hora e devolvido em memória: nenhum arquivo é guardado.
 *
 * - **Sem dado de pessoa.** Entram o título, as questões com as alternativas e a página de origem, e o gabarito numa
 *   página à parte; ou o plano, com objetivos, etapas e fontes. Não entra nome de professor, de turma nem de aluno: a
 *   função recebe só o conteúdo do artefato e o título dos materiais citados, e não tem de onde tirar outro.
 * - **Com o aviso de IA** (regra 70, item 4a): o conteúdo foi gerado por inteligência artificial e revisado por quem o
 *   exporta. Vai na primeira página e na do gabarito. **No rascunho** (a versão adaptada ainda pendente), o aviso não
 *   diz "revisado", e toda página leva a marca de rascunho: quem decide se o PDF sai limpo, como rascunho ou não sai é
 *   o service, pelo estado da entrega.
 * - **A fonte é a padrão do PDF** (Helvetica), sem fonte embutida: o arquivo fica pequeno e sai rápido. Ela não tem
 *   seta, dígito subscrito nem letra grega, e o que o material escreve assim vira o equivalente que ela tem
 *   (`textoParaAFontePadrao`). Nada chega ao arquivo fora do que a fonte escreve.
 * - **A versão adaptada** sai com a fonte ampliada, se esse foi um dos tipos; os tipos de adaptação e o tempo adicional
 *   aparecem só na página do gabarito, que é a do professor, e nunca na folha que vai para a mesa do aluno. Não há
 *   onde escrever para quem é a adaptação (D35).
 */

export const AVISO_DE_IA_NO_PDF =
  'Conteúdo gerado por inteligência artificial (Assistente de ensino do Turmma) a partir do material da escola, e revisado pela professora ou pelo professor que o exportou.'
/** O aviso do rascunho: diz que é IA, e **não** diz que foi revisado, porque ainda não foi aprovado. */
export const AVISO_DE_IA_NO_RASCUNHO = 'Conteúdo gerado por inteligência artificial (Assistente de ensino do Turmma) a partir do material da escola. Ainda não foi aprovado: não entregue aos alunos.'
/** A marca de toda página da versão adaptada que ainda espera a decisão (regra 70, itens 3 e 6). */
export const MARCA_DE_RASCUNHO = 'Rascunho — aguardando a aprovação da professora'

export interface PdfOptions {
  /**
   * A versão adaptada com a entrega ainda `pendente`: sai com a marca de rascunho em toda página e sem a frase
   * "revisado". A professora precisa ver a fonte ampliada para decidir; o que ela não leva é um papel com cara de
   * aprovado.
   */
  readonly rascunho?: boolean
}

const MARGEM = 56
const COR_DO_TEXTO = '#0D0D0D'
const COR_DA_NOTA = '#5D5D5D'
const LETRAS = ['A', 'B', 'C', 'D'] as const

/** O que a fonte padrão escreve: ASCII imprimível, o Latin-1, os dois travessões, as aspas curvas, a reticência e o marcador. */
const ESCREVIVEL = /^[\n -~\u00A1-\u00FF–—‘’“”…•]*$/u
const NAO_ESCREVIVEL = /[^\n -~\u00A1-\u00FF–—‘’“”…•]/gu

const SUBSCRITOS: Readonly<Record<string, string>> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₊': '+', '₋': '-' }
const SOBRESCRITOS: Readonly<Record<string, string>> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-' }
/** Os três expoentes que a fonte padrão tem: `10²³` fica como está. */
const SOBRESCRITOS_DA_FONTE = /^[¹²³]+$/u
const EQUIVALENTES: Readonly<Record<string, string>> = {
  '→': '->',
  '⟶': '->',
  '➝': '->',
  '⇒': '=>',
  '←': '<-',
  '↔': '<->',
  '⇌': '<->',
  '⇄': '<->',
  '−': '-',
  '‐': '-',
  '‑': '-',
  '≥': '>=',
  '≤': '<=',
  '≠': '!=',
  '≈': '~',
  '⋅': '·',
  '∙': '·',
  '′': "'",
  '″': '"',
  'Δ': 'Delta ',
  'α': 'alfa',
  'β': 'beta',
  'γ': 'gama',
  'θ': 'teta',
  'λ': 'lambda',
  'μ': 'µ',
  'π': 'pi',
  'ρ': 'rho',
  'σ': 'sigma',
  'ω': 'omega',
  'Ω': 'ohm',
}

/**
 * O texto como a fonte padrão do PDF consegue escrevê-lo, sem caractere quebrado: `H₂O` vira `H2O`, `→` vira `->`,
 * `10⁻⁴` vira `10^-4`, e `10²³`, que a fonte tem, fica. O que sobra fora da fonte perde o acento que ela não conhece
 * e, em último caso, vira `?`: um sinal visível para quem revisa, em vez de um byte errado no arquivo.
 */
export function textoParaAFontePadrao(texto: string): string {
  const trocado = texto
    .replace(/\r/gu, '')
    .replace(/[\t\u00A0\u2000-\u200A\u202F\u205F\u3000]/gu, ' ')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/gu, '')
    .replace(/[₀-₉₊₋]/gu, (caractere) => SUBSCRITOS[caractere] ?? caractere)
    .replace(/[⁰¹²³⁴-⁹⁺⁻]+/gu, (sequencia) => {
      if (SOBRESCRITOS_DA_FONTE.test(sequencia)) return sequencia
      const simples = [...sequencia].map((caractere) => SOBRESCRITOS[caractere] ?? caractere).join('')
      // A carga de um íon (`Na⁺`) é só o sinal; o expoente com algarismo que a fonte não tem ganha o `^`.
      return /^[+-]$/u.test(simples) ? simples : `^${simples}`
    })
    .replace(/[^\n -~\u00A1-\u00FF]/gu, (caractere) => EQUIVALENTES[caractere] ?? caractere)
  if (ESCREVIVEL.test(trocado)) return trocado
  return trocado.replace(NAO_ESCREVIVEL, (caractere) => {
    const semAcento = caractere.normalize('NFKD').replace(/\p{M}/gu, '')
    return semAcento !== '' && ESCREVIVEL.test(semAcento) ? semAcento : '?'
  })
}

/** O nome do arquivo no `Content-Disposition`: só letras minúsculas, algarismos e hífen, tirados do título. Nunca texto cru no cabeçalho. */
export function nomeDoArquivoDoPdf(titulo: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 60)
    .replace(/-+$/u, '')
  return `${base === '' ? 'artefato' : base}.pdf`
}

type Documento = InstanceType<typeof PDFDocument>
type Fonte = 'Helvetica' | 'Helvetica-Bold' | 'Helvetica-Oblique'

interface Estilo {
  readonly fonte: Fonte
  readonly tamanho: number
  readonly cor?: string
  /** Espaço abaixo do bloco, em pontos. */
  readonly depois?: number
  /** Recuo da margem esquerda, em pontos. */
  readonly recuo?: number
}

/** A folha em que os blocos descem, um abaixo do outro, com quebra de página automática. */
class Folha {
  readonly #largura: number

  constructor(private readonly documento: Documento) {
    this.#largura = documento.page.width - 2 * MARGEM
  }

  #preparar(estilo: Estilo): { width: number } {
    this.documento.font(estilo.fonte).fontSize(estilo.tamanho).fillColor(estilo.cor ?? COR_DO_TEXTO)
    return { width: this.#largura - (estilo.recuo ?? 0) }
  }

  altura(texto: string, estilo: Estilo): number {
    const opcoes = this.#preparar(estilo)
    return this.documento.heightOfString(textoParaAFontePadrao(texto), opcoes) + (estilo.depois ?? 0)
  }

  escrever(texto: string, estilo: Estilo): void {
    const opcoes = this.#preparar(estilo)
    this.documento.text(textoParaAFontePadrao(texto), MARGEM + (estilo.recuo ?? 0), this.documento.y, opcoes)
    this.documento.y += estilo.depois ?? 0
  }

  /** Um grupo de blocos que não se separa: se não cabe no resto da página e cabe numa inteira, começa na seguinte. */
  junto(blocos: readonly (readonly [string, Estilo])[]): void {
    const altura = blocos.reduce((soma, [texto, estilo]) => soma + this.altura(texto, estilo), 0)
    const fundo = this.documento.page.height - MARGEM
    if (this.documento.y + altura > fundo && altura <= fundo - MARGEM) this.documento.addPage()
    for (const [texto, estilo] of blocos) this.escrever(texto, estilo)
  }

  novaPagina(): void {
    this.documento.addPage()
  }
}

interface Estilos {
  readonly titulo: Estilo
  readonly aviso: Estilo
  readonly secao: Estilo
  readonly corpo: Estilo
  readonly item: Estilo
  readonly fonteCitada: Estilo
}

function estilosDoPdf(ampliada: boolean): Estilos {
  const corpo = ampliada ? 16 : 11
  return {
    titulo: { fonte: 'Helvetica-Bold', tamanho: ampliada ? 22 : 18, depois: 8 },
    aviso: { fonte: 'Helvetica-Oblique', tamanho: 9, cor: COR_DA_NOTA, depois: 18 },
    secao: { fonte: 'Helvetica-Bold', tamanho: corpo + 2, depois: 6 },
    corpo: { fonte: 'Helvetica', tamanho: corpo, depois: 6 },
    item: { fonte: 'Helvetica', tamanho: corpo, depois: 4, recuo: 16 },
    fonteCitada: { fonte: 'Helvetica-Oblique', tamanho: ampliada ? 11 : 9, cor: COR_DA_NOTA, depois: 16, recuo: 16 },
  }
}

function fonteDaCitacao(citacao: Pick<Citacao, 'materialId' | 'pagina'>, titulos: ReadonlyMap<string, string>): string {
  return `Fonte: ${titulos.get(citacao.materialId) ?? 'material da escola'}, p. ${String(citacao.pagina)}`
}

function escreverAtividade(folha: Folha, conteudo: ConteudoDeAtividade, titulos: ReadonlyMap<string, string>, aviso: string): void {
  const estilos = estilosDoPdf(conteudo.adaptacao?.tipos.includes('fonte_ampliada') === true)
  folha.escrever(conteudo.titulo, estilos.titulo)
  folha.escrever(aviso, estilos.aviso)
  conteudo.questoes.forEach((questao, indice) => {
    folha.junto([
      [`${String(indice + 1)}. ${questao.enunciado}`, { ...estilos.corpo, depois: 8 }],
      ...questao.alternativas.map((alternativa, posicao) => [`${LETRAS[posicao] ?? '?'}) ${alternativa}`, estilos.item] as const),
      [fonteDaCitacao(questao.citacao, titulos), estilos.fonteCitada],
    ])
  })

  // O gabarito numa página à parte: é a do professor, e fica fora da folha que vai para o aluno.
  const doProfessor = estilosDoPdf(false)
  folha.novaPagina()
  folha.escrever(`Gabarito — ${conteudo.titulo}`, doProfessor.titulo)
  folha.escrever(aviso, doProfessor.aviso)
  if (conteudo.adaptacao !== undefined) {
    const { tipos, tempoExtraPercentual } = conteudo.adaptacao
    const rotulos = tipos.map((tipo) => (tipo === 'tempo_adicional' && tempoExtraPercentual !== undefined ? `${ROTULOS_DA_ADAPTACAO[tipo]} (+${String(tempoExtraPercentual)}%)` : ROTULOS_DA_ADAPTACAO[tipo]))
    folha.escrever(`Versão adaptada: ${rotulos.join(', ')}.`, { ...doProfessor.corpo, depois: 12 })
  }
  conteudo.questoes.forEach((questao, indice) => {
    folha.escrever(`${String(indice + 1)}. ${LETRAS[questao.gabarito] ?? '?'} — ${questao.habilidade.codigo}`, doProfessor.corpo)
  })
}

function escreverPlano(folha: Folha, conteudo: ConteudoDePlanoDeAula, titulos: ReadonlyMap<string, string>): void {
  const estilos = estilosDoPdf(false)
  folha.escrever(conteudo.titulo, estilos.titulo)
  folha.escrever(AVISO_DE_IA_NO_PDF, estilos.aviso)
  folha.escrever(`Duração: ${String(conteudo.duracaoMinutos)} minutos`, { ...estilos.corpo, depois: 14 })
  folha.escrever('Objetivos', estilos.secao)
  conteudo.objetivos.forEach((objetivo, indice) => folha.escrever(`• ${objetivo}`, { ...estilos.item, depois: indice === conteudo.objetivos.length - 1 ? 14 : 4 }))
  folha.escrever('Habilidades', estilos.secao)
  conteudo.habilidades.forEach((habilidade, indice) => folha.escrever(`• ${habilidade.codigo} — ${habilidade.descricao}`, { ...estilos.item, depois: indice === conteudo.habilidades.length - 1 ? 14 : 4 }))
  folha.escrever('Etapas', estilos.secao)
  conteudo.etapas.forEach((etapa, indice) => {
    folha.junto([
      [`${String(indice + 1)}. ${etapa.titulo} (${String(etapa.minutos)} min)`, { ...estilos.corpo, fonte: 'Helvetica-Bold', depois: 4 }],
      [etapa.descricao, { ...estilos.item, depois: etapa.citacao === undefined ? 14 : 4 }],
      ...(etapa.citacao === undefined ? [] : [[fonteDaCitacao(etapa.citacao, titulos), estilos.fonteCitada] as const]),
    ])
  })
  folha.junto([
    ['Avaliação', estilos.secao],
    [conteudo.avaliacao, { ...estilos.corpo, depois: 14 }],
  ])
  folha.escrever('Fontes', estilos.secao)
  for (const citacao of conteudo.citacoes) folha.escrever(`• ${fonteDaCitacao(citacao, titulos).replace(/^Fonte: /u, '')}`, estilos.item)
}

/**
 * O PDF do artefato, em memória. `titulos` é o título de cada material citado, lido pela escola do contexto; material
 * que não está no mapa sai como "material da escola".
 */
export function gerarPdfDoArtefato(conteudo: ConteudoDoArtefato, titulos: ReadonlyMap<string, string>, { rascunho = false }: PdfOptions = {}): Promise<Buffer> {
  return new Promise((resolver, rejeitar) => {
    const documento = new PDFDocument({
      size: 'A4',
      margin: MARGEM,
      // Só o título e o produto: os metadados do arquivo não levam autor.
      info: { Title: textoParaAFontePadrao(conteudo.titulo), Creator: 'Turmma', Producer: 'Turmma' },
      // As páginas ficam abertas até o fim, para a marca de rascunho entrar em todas, inclusive nas que a quebra criou.
      bufferPages: true,
    })
    const pedacos: Buffer[] = []
    documento.on('data', (pedaco: Buffer) => pedacos.push(pedaco))
    documento.on('end', () => resolver(Buffer.concat(pedacos)))
    documento.on('error', rejeitar)
    const folha = new Folha(documento)
    if (conteudo.tipo === 'atividade_objetiva') escreverAtividade(folha, conteudo, titulos, rascunho ? AVISO_DE_IA_NO_RASCUNHO : AVISO_DE_IA_NO_PDF)
    else escreverPlano(folha, conteudo, titulos)
    if (rascunho) {
      const { start, count } = documento.bufferedPageRange()
      for (let pagina = start; pagina < start + count; pagina += 1) {
        documento.switchToPage(pagina)
        // No alto da página, acima da margem: fora do fluxo do texto, e por isso não empurra nem quebra nada.
        documento.font('Helvetica-Bold').fontSize(10).fillColor(COR_DO_TEXTO).text(MARCA_DE_RASCUNHO, MARGEM, MARGEM / 2, { lineBreak: false })
      }
    }
    documento.end()
  })
}
