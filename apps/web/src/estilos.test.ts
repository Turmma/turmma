import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `estilos.css` zera a paleta do Tailwind (`--color-*: initial`) e devolve em hex só as cores usadas, porque a paleta
 * padrão da versão 4 é em `oklch()`, que o Chrome anterior ao 111 não entende — e laboratório de escola tem navegador
 * velho (regra 50, item 1).
 *
 * O efeito colateral é silencioso e foi ao ar uma vez: classe com cor fora da lista **não gera CSS nenhum**. A caixa
 * continua na tela, com o texto certo, sem fundo e sem borda — e o axe não reclama, porque o texto herda o contraste
 * da página. É exatamente o aviso de atenção ("este convite não vale mais", "guarde estes códigos agora") que some.
 *
 * Por isso a lista é conferida por teste, e não por atenção. A pele é a da D80 (`docs/interface.md` 9.10), em dois
 * blocos, o claro e o escuro, com os mesmos nomes. A guarda é estrita desde a tarefa 2.0 da A0: toda classe que pinta,
 * em qualquer arquivo de `apps/web/src`, pede um nome da 9.10 e nenhum outro, e sem modificador de opacidade
 * (`bg-tinta/40`), que vira `color-mix()` e é descartado pelo Chrome 109 (9.9, "Modificador de opacidade em cor não
 * entra"). Desde a X1 ela reprova também o que faria uma tela ficar errada no escuro sem ninguém ver: `white` e `black`
 * em classe, a variante `dark:` e a cor escrita à mão num atributo.
 */
const raizDaWeb = dirname(fileURLToPath(import.meta.url))
const raizDoRepositorio = join(raizDaWeb, '..', '..', '..')

/** Quantas cores cada bloco declara, `white` e `black` incluídas. Outro número é bloco lido pela metade, ou cor nova sem o par. */
const CORES_POR_BLOCO = 98

/** Os únicos tokens que não são hex de seis dígitos: o véu e a sombra do chão da onça são hex de oito, com a transparência nos dois últimos. */
const CORES_COM_TRANSPARENCIA = ['veu', 'onca-chao']

type Tema = 'claro' | 'escuro'
type Paleta = Map<string, string>

const DECLARACAO_DE_COR = /--color-([a-z]+(?:-[a-z0-9]+)*)\s*:\s*([^;]+);/g

/** As declarações de cor de um trecho de CSS, nome e valor em minúsculas. O nome pode ter hífen: `caramelo-texto`. */
function coresDe(css: string): Paleta {
  return new Map([...css.matchAll(DECLARACAO_DE_COR)].map(([, cor, valor]) => [cor ?? '', (valor ?? '').trim().toLowerCase()]))
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

const ABERTURA_DO_CLARO = '@theme static'
const ABERTURA_DO_ESCURO = ":root[data-tema='escuro']"

/** Os dois blocos de cor de um CSS: o do `@theme static` e o de `:root[data-tema='escuro']`. */
function blocosDe(css: string): Record<Tema, Paleta> {
  const claro = css.indexOf(ABERTURA_DO_CLARO)
  // O bloco de tokens do escuro é o que abre com `{` logo depois do seletor, sem nada entre os dois.
  const escuro = css.search(/:root\[data-tema='escuro'\]\s*\{/)
  if (claro === -1 || escuro === -1) throw new Error('o CSS não tem os dois blocos de cor')
  return { claro: coresDe(miolo(css, claro)), escuro: coresDe(miolo(css, escuro)) }
}

/**
 * Os tokens de cor dos dois blocos `css` da 9.10 do `docs/interface.md`, com o valor de cada um. O documento é a fonte: o
 * teste lê de lá, e não de uma cópia aqui, para que um hex trocado em qualquer um dos dois lados deixe vermelho.
 */
function tokensDoDocumento(): Record<Tema, Paleta> {
  const documento = readFileSync(join(raizDoRepositorio, 'docs', 'interface.md'), 'utf8')
  const inicio = documento.indexOf('### 9.10')
  if (inicio === -1) throw new Error('docs/interface.md sem a seção 9.10')
  const proxima = documento.indexOf('\n## ', inicio)
  const secao = documento.slice(inicio, proxima === -1 ? undefined : proxima)
  const blocos = [...secao.matchAll(/```css\n([\s\S]*?)```/g)].map(([, bloco]) => bloco ?? '')
  const claro = blocos.find((bloco) => bloco.includes(ABERTURA_DO_CLARO))
  const escuro = blocos.find((bloco) => bloco.includes(ABERTURA_DO_ESCURO))
  if (claro === undefined || escuro === undefined) throw new Error('a 9.10 não tem os dois blocos css, o claro e o escuro')
  return { claro: coresDe(claro), escuro: coresDe(escuro) }
}

function cssDoProduto(): string {
  return readFileSync(join(raizDaWeb, 'estilos.css'), 'utf8')
}

/** Os nomes de cor da 9.10: os únicos que uma classe de cor pode pedir. */
const NOMES_DE_COR = new Set(blocosDe(cssDoProduto()).claro.keys())

/**
 * `white` e `black` não mudam com o tema: classe com eles fica errada no escuro. Só o QR, que precisa ficar claro, e o cenário da
 * onça da marca, cujo giz e cujas páginas de livro são brancos nos dois temas (`docs/interface.md` 9.7, tabela do cenário: o giz
 * sobre a lousa verde e a página dentro da lombada, sobre cores que também não invertem), podem.
 */
const ARQUIVOS_COM_BRANCO_FIXO = ['componentes/CodigoQr.tsx', 'componentes/ui/onca/CenaDaOnca.tsx']

/**
 * Os arquivos que podem escrever cor à mão: o QR, que precisa de preto e branco, e a cabeça da onça, cujas nove cores são
 * fixas nos dois temas (`docs/interface.md` 9.7). A lista é **esses dois, e só eles**: o ícone ilustrado lê token e não
 * entra, e a onça de corpo inteiro, quando vier, ou lê as cores da cabeça ou entra aqui com parecer.
 */
const ARQUIVOS_COM_COR_EM_LINHA = ['componentes/CodigoQr.tsx', 'componentes/ui/onca/CabecaOnca.tsx']

/** As sombras do `@theme` (`shadow-caixa`, `shadow-flutua`): `shadow-<nome>` com elas é sombra, não cor. */
function sombrasDeclaradas(): Set<string> {
  return new Set([...cssDoProduto().matchAll(/--shadow-([a-z]+(?:-[a-z0-9]+)*)\s*:/g)].map(([, nome]) => nome ?? ''))
}

/**
 * O que, em cada propriedade que pinta, **não** é cor: tamanho de texto, alinhamento, largura e lado de borda, estilo
 * de linha, sombra de fábrica e do `@theme`. Qualquer outro valor é lido como cor e precisa ser um nome da 9.10. É a
 * lista que falta, e não a que sobra, que decide: um valor novo que ninguém previu reprova até alguém dizer o que ele é.
 */
const NAO_E_COR: Record<string, RegExp> = {
  text: /^(?:xs|sm|base|lg|[2-9]?xl|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip)$/,
  // `transparent` é a borda do item apagado da lateral, que guarda o espaço da borda do aceso (12.0): não é cor que deixe de
  // virar com o tema, e é só na borda. `bg-transparent` e `text-transparent` continuam reprovando.
  border: /^(?:\d+|[xytblrse](?:-\d+)?|solid|dashed|dotted|double|hidden|none|collapse|separate|transparent)$/,
  outline: /^(?:\d+|none|hidden|solid|dashed|dotted|double|offset-\d+)$/,
  ring: /^(?:\d+|inset|offset-\d+)$/,
  shadow: /^(?:2xs|xs|sm|md|lg|xl|2xl|none|inner)$/,
  decoration: /^(?:\d+|solid|double|dotted|dashed|wavy|auto|from-font|clone|slice)$/,
  bg: /^(?:none|fixed|local|scroll|repeat|no-repeat|repeat-[xy]|repeat-round|repeat-space|cover|contain|auto|center|top|bottom|left|right|(?:left|right)-(?:top|bottom)|clip-\w+|origin-\w+|blend-[\w-]+)$/,
  fill: /^none$/,
  stroke: /^(?:\d+|none)$/,
  divide: /^(?:[xy](?:-\d+|-reverse)?|solid|dashed|dotted|double|none)$/,
  accent: /^auto$/,
  caret: /^$/,
  placeholder: /^$/,
  from: /^$/,
  via: /^$/,
  to: /^$/,
}

/**
 * Toda classe de propriedade que pinta, com a variante (`hover:`, `enabled:`, `sm:`) que vier antes, o valor e o
 * modificador depois da barra (`bg-tinta/40`, `text-sm/6`). O valor entre colchetes é o arbitrário (`bg-[#1d4ed8]`).
 */
const CLASSE_QUE_PINTA = new RegExp(
  String.raw`(?:^|[\s"'\`:\[])(${Object.keys(NAO_E_COR).join('|')})-(\[[^\]\s]+\]|[a-z0-9][a-z0-9-]*)(\/(?:\d+|\[[^\]\s]+\]))?(?![\w-])`,
  'g',
)

/** Valor arbitrário que é cor: hex, função de cor ou variável de cor. Pinta sem passar pelo `@theme`. */
const ARBITRARIO_DE_COR = /^\[(?:#|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|hwb\(|color-mix\(|color:|var\(--color)/i

/** A variante `dark:` antes de qualquer classe. O escuro é o atributo `data-tema`, e a variante do Tailwind não o enxerga. */
const VARIANTE_DARK = /(?:^|[\s"'`])((?:[a-z-]+:)*dark:[\w[\]/.#-]+)/g

/**
 * Cor escrita à mão, que não muda com o tema: hex ou função de cor. A guarda a procura **em qualquer lugar do
 * arquivo**, e não só em `fill`, `stroke` e `style`: atributo com valor condicional, a segunda camada de uma sombra,
 * o segundo hex de um gradiente e o objeto de estilo guardado numa constante escapam de toda regra que dependa da
 * posição. Nem a cor entre colchetes de uma classe fica de fora: `inset-shadow-[#fff]` não é classe que a guarda de
 * classes conheça, e o Tailwind a transforma em cor fixa do mesmo jeito.
 *
 * O preço são os falsos positivos, todos de texto que parece cor: o hex num comentário (quem comenta diz o nome do
 * token), a âncora `href="#cafe"`, o `url(#fade)` cujo nome só tem letras de `a` a `f`, e o texto entre aspas que é
 * exatamente um nome de cor do CSS, em qualquer caixa (`'tan'`, `'gold'`, `'navy'`). Quem cair num deles troca o nome.
 *
 * O que a guarda **não** pega: a cor pelo nome dentro de um valor composto (`'0 1px white'`) e a cor montada em tempo
 * de execução; para essas, o que há é o axe com o tema escuro, no e2e.
 */
const COR_ESCRITA = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi

/** O nome à esquerda da cor, na mesma linha, só para a mensagem: o atributo ou a propriedade que a recebe. */
const NOME_A_ESQUERDA = /([A-Za-z]+)\s*[=:](?!.*[A-Za-z]\s*[=:])/

/** Os nomes de cor do CSS. `transparent`, `currentColor` e `none` não entram: não são cor que deixe de virar com o tema. */
const NOMES_DE_COR_DO_CSS =
  'aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgr[ae]y|darkgreen|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategr[ae]y|darkturquoise|darkviolet|deeppink|deepskyblue|dimgr[ae]y|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gr[ae]y|green|greenyellow|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgr[ae]y|lightgreen|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategr[ae]y|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategr[ae]y|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen'

/**
 * A cor pelo nome, quando ela é o texto inteiro entre aspas: `fill="white"`, `fill={aberto ? 'white' : 'none'}`,
 * `style={{ color: 'red' }}`. Também não vira com o tema, e vale em qualquer lugar do arquivo, como a cor escrita.
 */
const COR_PELO_NOME = new RegExp(String.raw`(["'\`])(${NOMES_DE_COR_DO_CSS})\1`, 'gi')

/** A classe inteira em volta de uma cor entre colchetes (`sm:bg-[#1d4ed8]`), para a mensagem; `null` fora de colchete. */
function classeArbitraria(conteudo: string, posicao: number): string | null {
  if (conteudo[posicao - 1] !== '[') return null
  const inicio = Math.max(...[' ', '\n', '"', "'", '`'].map((limite) => conteudo.lastIndexOf(limite, posicao))) + 1
  const fim = conteudo.indexOf(']', posicao)
  return fim === -1 ? null : conteudo.slice(inicio, fim + 1)
}

/**
 * As faces fortes, que viram com o tema ou que levam texto escuro de propósito: o texto em cima delas é `sobre-cor` ou
 * `sobre-grafite`, nunca `tinta` nem branco. Entram aqui as que o botão da 3.0 cria (`laranja`, a face do primário;
 * `grafite`, a do oficial; `vermelho`, a do `perigo` cheio) e as de antes (`noite`, `erro` e as três do `caramelo`).
 */
const FACE_FORTE = /^bg-(?:noite|erro|caramelo|caramelo-claro|caramelo-fundo|laranja|grafite|vermelho)$/

/** O texto que não acompanha a face forte: `tinta` vira clara no escuro, e `white` não vira. */
const TEXTO_QUE_NAO_ACOMPANHA = /^text-(?:tinta|white)$/

/** Cada texto entre aspas ou crases de uma linha só: é onde mora uma lista de classes. */
const TEXTO_ENTRE_ASPAS = /(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g

/**
 * O texto que não acompanha a face forte, na mesma lista de classes: com a mesma variante dela (`bg-caramelo
 * text-tinta` reprova, e `disabled:bg-inativo disabled:text-tinta`, ao lado de um `bg-caramelo` sem variante, passa), e
 * também quando é a **face** que troca sob uma variante e o texto é o do estado normal, sem texto da mesma variante que
 * o acompanhe: `bg-superficie text-tinta hover:bg-laranja` fica com `tinta` sobre o laranja no hover, que no escuro dá
 * 2,2:1. Com o texto da variante (`hover:text-sobre-cor`), passa.
 */
function textosSobreFaceForte(conteudo: string): string[] {
  const achados: string[] = []
  for (const [, , lista = ''] of conteudo.matchAll(TEXTO_ENTRE_ASPAS)) {
    const classes = lista.split(/\s+/).map((classe) => {
      const corte = classe.lastIndexOf(':') + 1
      return { variante: classe.slice(0, corte), nome: classe.slice(corte) }
    })
    for (const face of classes.filter(({ nome }) => FACE_FORTE.test(nome))) {
      const textoDaVariante = classes.some(({ variante, nome }) => variante === face.variante && nome.startsWith('text-'))
      for (const texto of classes.filter(({ nome }) => TEXTO_QUE_NAO_ACOMPANHA.test(nome))) {
        const mesmaVariante = texto.variante === face.variante
        const faceTrocaSemTexto = face.variante !== '' && texto.variante === '' && !textoDaVariante
        if (mesmaVariante || faceTrocaSemTexto) achados.push(`${texto.variante}${texto.nome} com ${face.variante}${face.nome}`)
      }
    }
  }
  return achados
}

/** Cada cor escrita à mão de `conteudo`, como `propriedade cor`, na ordem em que aparece e uma vez só. */
function coresEmLinha(conteudo: string): string[] {
  const achados = new Map<number, string>()
  const nomeDe = (posicao: number) => NOME_A_ESQUERDA.exec(conteudo.slice(conteudo.lastIndexOf('\n', posicao) + 1, posicao))?.[1] ?? 'texto'
  for (const achado of conteudo.matchAll(COR_ESCRITA)) {
    achados.set(achado.index, classeArbitraria(conteudo, achado.index) ?? `${nomeDe(achado.index)} ${achado[0]}`)
  }
  for (const achado of conteudo.matchAll(COR_PELO_NOME)) {
    achados.set(achado.index, `${nomeDe(achado.index)} ${achado[2] ?? ''}`)
  }
  return [...achados].sort(([a], [b]) => a - b).map(([, achado]) => achado)
}

/**
 * As classes e os atributos de `conteudo` que a guarda reprova, como `arquivo: o quê (motivo)`: a cor com nome fora da
 * 9.10 (a paleta de fábrica, que a `--color-*: initial` apaga, ou um nome que ninguém declarou), a cor arbitrária, o
 * modificador de opacidade em cor, que vira `color-mix()` e some no Chrome 109, e o que não vira com o tema.
 */
function classesReprovadas(arquivo: string, conteudo: string): string[] {
  const sombras = sombrasDeclaradas()
  const reprovadas: string[] = []
  for (const [, propriedade = '', valor = '', modificador] of conteudo.matchAll(CLASSE_QUE_PINTA)) {
    const classe = `${propriedade}-${valor}${modificador ?? ''}`
    if (valor.startsWith('[')) {
      if (ARBITRARIO_DE_COR.test(valor)) reprovadas.push(`${arquivo}: ${classe} (cor fora do @theme)`)
      continue
    }
    if (NAO_E_COR[propriedade]?.test(valor) || (propriedade === 'shadow' && sombras.has(valor))) continue
    if (!NOMES_DE_COR.has(valor)) reprovadas.push(`${arquivo}: ${classe} (cor fora do @theme)`)
    else if (modificador !== undefined) reprovadas.push(`${arquivo}: ${classe} (modificador de opacidade)`)
    else if ((valor === 'white' || valor === 'black') && !ARQUIVOS_COM_BRANCO_FIXO.includes(arquivo)) reprovadas.push(`${arquivo}: ${classe} (não muda com o tema)`)
  }
  for (const [, classe = ''] of conteudo.matchAll(VARIANTE_DARK)) reprovadas.push(`${arquivo}: ${classe} (variante dark:)`)
  for (const par of textosSobreFaceForte(conteudo)) reprovadas.push(`${arquivo}: ${par} (texto que não acompanha a face)`)
  if (!ARQUIVOS_COM_COR_EM_LINHA.includes(arquivo)) {
    for (const cor of coresEmLinha(conteudo)) reprovadas.push(`${arquivo}: ${cor} (cor em linha)`)
  }
  return reprovadas
}

/** Um uso de `bg-grafite` ou `bg-noite` fora do oficial que ainda existe: o que ele pinta, por quê, e quem o tira. */
interface UsoDaFaceDoOficial {
  /** As classes, com a variante (`enabled:hover:`), que o arquivo pode escrever. Qualquer outra reprova. */
  readonly classes: readonly string[]
  readonly justificativa: string
  /** A tarefa ou a spec que tira o uso da lista: `8.0`, `X3`; ou `não sai`, só no arquivo do oficial. */
  readonly sai: string
}

/**
 * RF6: a face do oficial (`grafite`, e a `noite` com `-alto` e `-baixo`, que no escuro vale o mesmo `#f1f7fb`) é do
 * botão `oficial` e de mais nada. A lista é **fechada e só encolhe**: o arquivo que não está nela reprova, a classe que
 * a entrada dele não cita reprova, e a entrada cuja classe já não está no arquivo reprova também, para a tarefa que
 * tira o uso tirar a linha. O teto de `TETO_DA_LISTA_DO_OFICIAL` não sobe.
 *
 * A primeira entrada é o oficial. As outras duas são usos de antes da D80, que a `noite` pintava de preto no claro; no
 * escuro a face deles é a mesma do oficial. Isso já acontece na tela da atividade, onde a questão aberta do mapa e o
 * botão "Enviar a atividade" têm a mesma face (achado da 1ª rodada da 3.0, `conformidade-reviewer`).
 */
const FACE_DO_OFICIAL: Readonly<Record<string, UsoDaFaceDoOficial>> = {
  'componentes/ui/botao-secundario.ts': {
    classes: ['bg-grafite', 'enabled:hover:bg-noite-alto'],
    justificativa: 'é o oficial: a face das constantes e da tabela do Botao; o hover `noite-alto` só vale nas duas linhas dele',
    sai: 'não sai: é o oficial. O hover passa a token próprio de grafite quando a `noite` sair, na 15.0',
  },
  'areas/aluno/Atividade.tsx': {
    classes: ['bg-noite'],
    justificativa: 'a questão aberta do mapa da atividade; no escuro tem a mesma face do botão oficial da mesma tela',
    sai: 'X4 (telas-do-aluno-e-primeiro-acesso), que reveste o mapa de questões',
  },
  'operacao/componentes/NavegacaoDaLista.tsx': {
    classes: ['bg-noite'],
    justificativa: 'a opção de ordenação marcada, na lista das escolas da operação',
    sai: 'X2 (a operação recomposta em página de painel; a 15.0 só trocou a barra de topo)',
  },
}

/** Sobe só com decisão: a lista do oficial é a de hoje, e cada tarefa que tira um uso a faz encolher. */
const TETO_DA_LISTA_DO_OFICIAL = 3

function listaDoOficialCresceu(lista: Readonly<Record<string, UsoDaFaceDoOficial>>): boolean {
  return Object.keys(lista).length > TETO_DA_LISTA_DO_OFICIAL
}

/** A classe inteira, com a variante antes: `bg-grafite`, `bg-noite`, `bg-noite-alto`, `enabled:hover:bg-noite-baixo`. */
const FACE_DO_OFICIAL_NA_CLASSE = /(?:^|[\s"'`:[])((?:[a-z-]+:)*bg-(?:grafite|noite)(?:-[a-z]+)?)(?![\w-])/g

/** As faces do oficial que `arquivo` escreve e que a entrada dele na lista não cita, como `arquivo: classe (motivo)`. */
function facesDoOficialForaDaLista(arquivo: string, conteudo: string, lista: Readonly<Record<string, UsoDaFaceDoOficial>> = FACE_DO_OFICIAL): string[] {
  const permitidas = new Set(lista[arquivo]?.classes ?? [])
  return [...conteudo.matchAll(FACE_DO_OFICIAL_NA_CLASSE)]
    .map(([, classe = '']) => classe)
    .filter((classe) => !permitidas.has(classe))
    .map((classe) => `${arquivo}: ${classe} (face do oficial fora da lista)`)
}

function arquivosDeCodigo(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name)
    if (entrada.isDirectory()) return arquivosDeCodigo(caminho)
    return /\.tsx?$/.test(entrada.name) && !entrada.name.endsWith('.test.ts') && !entrada.name.endsWith('.test.tsx') ? [caminho] : []
  })
}

/** O que diverge entre duas paletas, nos dois sentidos, como `nome: um lado diz X, o outro diz Y`. */
function divergencias(documento: Paleta, codigo: Paleta): string[] {
  const nomes = [...new Set([...documento.keys(), ...codigo.keys()])].sort()
  return nomes.filter((nome) => documento.get(nome) !== codigo.get(nome)).map((nome) => `${nome}: a 9.10 diz ${documento.get(nome) ?? 'nada'}, estilos.css diz ${codigo.get(nome) ?? 'nada'}`)
}

describe('paleta de estilos.css', () => {
  it('a paleta é zerada e toda cor devolvida é hex, nunca oklch()', () => {
    const css = cssDoProduto()
    // Sem o `initial`, a paleta em oklch() volta inteira e o Chrome 109 do laboratório perde as cores caladamente.
    expect(css).toContain('--color-*: initial')
    const { claro, escuro } = blocosDe(css)
    // Os nomes com hífen (`caramelo-texto`) contam: sem eles a conferência deixaria de fora metade da pele.
    expect(claro.get('caramelo-texto')).toBeDefined()
    for (const [tema, paleta] of [['claro', claro], ['escuro', escuro]] as const) {
      const foraDoHex = [...paleta]
        .filter(([cor, valor]) => !(CORES_COM_TRANSPARENCIA.includes(cor) ? /^#[0-9a-f]{8}$/ : /^#[0-9a-f]{6}$/).test(valor))
        .map(([cor, valor]) => `${tema} · ${cor}: ${valor}`)
      expect(foraDoHex).toEqual([])
    }
  })

  it.each(['claro', 'escuro'] as const)('o bloco %s de estilos.css declara exatamente as cores da 9.10, com o mesmo hex, e nenhuma outra', (tema) => {
    const documento = tokensDoDocumento()[tema]
    // `white` e `black` incluídas; outro número é o bloco do documento lido pela metade, e o teste passaria vazio.
    expect(documento.size).toBe(CORES_POR_BLOCO)
    expect(divergencias(documento, blocosDe(cssDoProduto())[tema])).toEqual([])
  })

  it('o claro e o escuro têm o mesmo conjunto de nomes: cor sem par herdaria o valor do outro tema', () => {
    const { claro, escuro } = blocosDe(cssDoProduto())
    expect(claro.size).toBe(CORES_POR_BLOCO)
    expect([...claro.keys()].sort()).toEqual([...escuro.keys()].sort())
  })

  it('o escuro fica fora de camada, para vencer o bloco do Tailwind', () => {
    const css = cssDoProduto()
    const escuro = css.search(/:root\[data-tema='escuro'\]\s*\{/)
    // Dentro de `@layer`, o bloco perderia para o `@layer theme` em que o Tailwind põe o `@theme`, pela ordem das camadas.
    const camadasAbertasAntes = [...css.slice(0, escuro).matchAll(/@layer\s+[a-z]+\s*\{/g)].length
    expect(camadasAbertasAntes).toBe(0)
  })
})

describe('guarda de cor em apps/web/src (U3)', () => {
  it('nenhum arquivo da web pede cor fora do @theme da 9.10, modificador de opacidade, nem cor que não vira com o tema', () => {
    const arquivos = arquivosDeCodigo(raizDaWeb)
    const conteudos = arquivos.map((arquivo) => ({ nome: arquivo.slice(raizDaWeb.length + 1), conteudo: readFileSync(arquivo, 'utf8') }))
    // Sem estas âncoras o caso passaria vazio no dia em que a varredura deixasse de achar arquivo — uma mudança na
    // pasta ou no filtro de extensão —, e `[].flatMap(...)` é `[]`. O botão primário é a cor da marca (9.1), e as
    // telas de `paginas/` são as que a tarefa 2.0 da A0 migrou; a de vínculos foi para `areas/professor/` na 11.0 da A1.
    const nomes = conteudos.map(({ nome }) => nome)
    expect(nomes, 'a varredura não está achando os arquivos da web').toContain('componentes/ui/Botao.tsx')
    expect(nomes.filter((nome) => nome.startsWith('paginas/') || nome.startsWith('areas/')).length).toBeGreaterThanOrEqual(10)
    // As classes do botão moraram em `Botao.tsx` até o MVP de apresentação; com as variantes da 10.2, a tabela que o
    // `Botao` lê fica em `botao-secundario.ts`, e é lá que a face laranja da ação primária precisa estar.
    expect(conteudos.find(({ nome }) => nome === 'componentes/ui/botao-secundario.ts')?.conteudo).toMatch(/\bbg-laranja\b/)
    // As peças do MVP de apresentação (`docs/mvp-rapido.md`, 9.3) também são varridas: o selo "IA" pinta com a família
    // `ia`, e a pasta inteira das peças de IA entra na conta.
    expect(conteudos.find(({ nome }) => nome === 'componentes/ui/ia/AssinaturaIA.tsx')?.conteudo).toMatch(/\bbg-ia-cx\b/)
    expect(nomes.filter((nome) => nome.startsWith('componentes/ui/ia/') && nome.endsWith('.tsx')).length).toBeGreaterThanOrEqual(10)
    // As duas listas fechadas apontam arquivo que existe: lista com nome velho deixaria a exceção valendo para ninguém.
    for (const arquivo of [...ARQUIVOS_COM_BRANCO_FIXO, ...ARQUIVOS_COM_COR_EM_LINHA]) expect(nomes, `${arquivo} saiu do lugar`).toContain(arquivo)
    const reprovadas = conteudos.flatMap(({ nome, conteudo }) => classesReprovadas(nome, conteudo))
    expect(reprovadas, 'troque pelo token da D80 (docs/interface.md 9.1 e 9.10)').toEqual([])
  })

  it('a guarda reprova a cor fora do @theme e o modificador de opacidade, com o arquivo e a classe', () => {
    // Sem isto, um erro no regex deixaria o caso acima passando sempre, que é o modo de falhar deste arquivo.
    const fixture = [
      '<p className="rounded-cartao border border-amber-300 bg-amber-50 p-4 text-amber-900">',
      '<p className="hover:bg-blue-700 bg-neutral-200 text-foo sm:bg-[#1d4ed8]">',
      '<p className="bg-tinta/80 text-apoio/50 enabled:hover:border-linha/[.4]">',
      // `transparent` só passa na borda (a do item apagado da lateral): na face e no texto continua reprovando.
      '<p className="bg-transparent text-transparent">',
      // O que passa: token da 9.10, antigo ou novo, e o que não é cor na mesma propriedade.
      '<p className="bg-caramelo text-sobre-cor bg-laranja-claro text-azul-texto border-borda border-b border-2 text-sm/6 text-base shadow-flutua outline-offset-2 bg-[url(x.svg)] border-transparent">',
    ].join('\n')
    expect(classesReprovadas('paginas/Fixture.tsx', fixture)).toEqual([
      'paginas/Fixture.tsx: border-amber-300 (cor fora do @theme)',
      'paginas/Fixture.tsx: bg-amber-50 (cor fora do @theme)',
      'paginas/Fixture.tsx: text-amber-900 (cor fora do @theme)',
      'paginas/Fixture.tsx: bg-blue-700 (cor fora do @theme)',
      'paginas/Fixture.tsx: bg-neutral-200 (cor fora do @theme)',
      'paginas/Fixture.tsx: text-foo (cor fora do @theme)',
      'paginas/Fixture.tsx: bg-[#1d4ed8] (cor fora do @theme)',
      'paginas/Fixture.tsx: bg-tinta/80 (modificador de opacidade)',
      'paginas/Fixture.tsx: text-apoio/50 (modificador de opacidade)',
      'paginas/Fixture.tsx: border-linha/[.4] (modificador de opacidade)',
      'paginas/Fixture.tsx: bg-transparent (cor fora do @theme)',
      'paginas/Fixture.tsx: text-transparent (cor fora do @theme)',
      // A cor entre colchetes reprova duas vezes: como classe fora do `@theme` e como cor escrita à mão.
      'paginas/Fixture.tsx: sm:bg-[#1d4ed8] (cor em linha)',
    ])
  })

  it('a guarda reprova o que não vira com o tema: branco e preto fixos, a variante dark: e a cor escrita à mão', () => {
    // No escuro, `text-white` sobre uma face que virou clara some, e `dark:` nunca liga: o tema é `data-tema`.
    const fixture = [
      '<p className="bg-fundo text-white hover:bg-black">',
      '<p className="dark:bg-tinta md:dark:text-fundo">',
      '<path d="M0 0" fill="#333333" stroke="rgb(1, 2, 3)" />',
      '<div style={{ backgroundColor: \'#fff\', color: "hsl(0 0% 0%)" }} />',
      '<div style={{ background: "#fff", boxShadow: "0 0 0 2px #123456", borderTopColor: aberto ? \'#123\' : undefined, outlineColor: "rgb(1,2,3)" }} />',
      // A cor em qualquer posição: a segunda camada da sombra, os dois hex do gradiente, o valor condicional do
      // atributo, o objeto de estilo guardado numa constante, a função de cor nova e a cor pelo nome.
      '<div style={{ boxShadow: "0 0 0 2px var(--color-borda), 0 1px #fff", backgroundImage: "linear-gradient(#fff, #000)" }} />',
      "<path d=\"M0 0\" fill={aberto ? '#fff' : '#000'} />",
      "const estilo = { accentColor: 'oklch(70% 0.1 200)' }",
      '<circle r="2" fill="white" stroke=\'red\' />',
      // A cor entre colchetes de uma classe que a guarda de classes não conhece, a função em maiúscula e a cor pelo
      // nome fora do atributo literal.
      '<p className="inset-shadow-[#fff] drop-shadow-[#123456] inset-ring-[rgb(1,2,3)]">',
      '<div style={{ color: "RGB(1, 2, 3)", outlineColor: \'White\' }} />',
      "<path d=\"M2 2\" fill={aberto ? 'white' : 'none'} floodColor = \"red\" />",
      // O que passa: o token no objeto de estilo e no atributo.
      '<div style={{ boxShadow: "0 0 0 2px var(--color-borda)", width: 3 }} />',
      '<path d="M1 1" fill="var(--color-laranja)" stroke="url(#desenho)" />',
      // O que passa: o token no atributo (`currentColor`, `none`) e a classe de cor do `@theme`.
      '<path d="M0 0" fill="currentColor" stroke="none" className="fill-tinta" />',
    ].join('\n')
    expect(classesReprovadas('paginas/Fixture.tsx', fixture)).toEqual([
      'paginas/Fixture.tsx: text-white (não muda com o tema)',
      'paginas/Fixture.tsx: bg-black (não muda com o tema)',
      'paginas/Fixture.tsx: dark:bg-tinta (variante dark:)',
      'paginas/Fixture.tsx: md:dark:text-fundo (variante dark:)',
      'paginas/Fixture.tsx: fill #333333 (cor em linha)',
      'paginas/Fixture.tsx: stroke rgb( (cor em linha)',
      'paginas/Fixture.tsx: backgroundColor #fff (cor em linha)',
      'paginas/Fixture.tsx: color hsl( (cor em linha)',
      'paginas/Fixture.tsx: background #fff (cor em linha)',
      'paginas/Fixture.tsx: boxShadow #123456 (cor em linha)',
      'paginas/Fixture.tsx: borderTopColor #123 (cor em linha)',
      'paginas/Fixture.tsx: outlineColor rgb( (cor em linha)',
      'paginas/Fixture.tsx: boxShadow #fff (cor em linha)',
      'paginas/Fixture.tsx: backgroundImage #fff (cor em linha)',
      'paginas/Fixture.tsx: backgroundImage #000 (cor em linha)',
      'paginas/Fixture.tsx: fill #fff (cor em linha)',
      'paginas/Fixture.tsx: fill #000 (cor em linha)',
      'paginas/Fixture.tsx: accentColor oklch( (cor em linha)',
      'paginas/Fixture.tsx: fill white (cor em linha)',
      'paginas/Fixture.tsx: stroke red (cor em linha)',
      'paginas/Fixture.tsx: inset-shadow-[#fff] (cor em linha)',
      'paginas/Fixture.tsx: drop-shadow-[#123456] (cor em linha)',
      'paginas/Fixture.tsx: inset-ring-[rgb(1,2,3)] (cor em linha)',
      'paginas/Fixture.tsx: color RGB( (cor em linha)',
      'paginas/Fixture.tsx: outlineColor White (cor em linha)',
      'paginas/Fixture.tsx: fill white (cor em linha)',
      'paginas/Fixture.tsx: floodColor red (cor em linha)',
    ])
  })

  it('a guarda reprova o texto que não acompanha a face forte, na mesma lista de classes e com a mesma variante', () => {
    // No escuro a face forte clareia ou fica, e `tinta` clareia junto: `tinta` sobre o laranja dá 2,2:1, e sobre o
    // oficial some. O par certo é `sobre-cor` na face colorida e `sobre-grafite` na escura.
    const fixture = [
      '<p className="bg-caramelo text-tinta">',
      '<p className="rounded-full bg-noite px-3 text-tinta">',
      "const perigo = 'bg-erro text-white hover:bg-caramelo-claro hover:text-tinta'",
      // As faces que a 3.0 cria: a laranja do primário, a grafite do oficial e a vermelha do perigo cheio.
      '<p className="bg-laranja text-tinta">',
      '<p className="bg-grafite text-white">',
      '<p className="bg-vermelho text-tinta">',
      // O que passa: o texto que acompanha, e o `tinta` de outra variante que não a da face (o desligado do primário).
      "const primario = 'bg-caramelo text-sobre-cor enabled:active:bg-caramelo-fundo disabled:bg-inativo disabled:text-tinta'",
      "const novo = 'bg-laranja text-sobre-cor enabled:hover:bg-caramelo-claro disabled:bg-borda disabled:text-apoio'",
      "const oficial = 'bg-grafite text-sobre-grafite enabled:hover:bg-noite-alto'",
      '<p className="bg-noite text-sobre-grafite">',
      '<p className="bg-fundo text-tinta">',
    ].join('\n')
    expect(classesReprovadas('paginas/Fixture.tsx', fixture)).toEqual([
      'paginas/Fixture.tsx: text-white (não muda com o tema)',
      'paginas/Fixture.tsx: text-white (não muda com o tema)',
      'paginas/Fixture.tsx: text-tinta com bg-caramelo (texto que não acompanha a face)',
      'paginas/Fixture.tsx: text-tinta com bg-noite (texto que não acompanha a face)',
      'paginas/Fixture.tsx: text-white com bg-erro (texto que não acompanha a face)',
      'paginas/Fixture.tsx: hover:text-tinta com hover:bg-caramelo-claro (texto que não acompanha a face)',
      'paginas/Fixture.tsx: text-tinta com bg-laranja (texto que não acompanha a face)',
      'paginas/Fixture.tsx: text-white com bg-grafite (texto que não acompanha a face)',
      'paginas/Fixture.tsx: text-tinta com bg-vermelho (texto que não acompanha a face)',
    ])
  })

  it('a guarda reprova a face que troca sob uma variante com o texto do estado normal em tinta ou branco', () => {
    // A recomendação da 2ª rodada da 1.0: `bg-superficie text-tinta hover:bg-caramelo` passava, e no hover o texto ficava
    // `tinta` sobre o laranja. Com o texto da mesma variante (`hover:text-sobre-cor`), a face que troca passa.
    const fixture = [
      '<p className="bg-superficie text-tinta hover:bg-laranja">',
      '<p className="bg-superficie text-white enabled:hover:bg-grafite">',
      '<p className="bg-superficie text-tinta hover:bg-laranja hover:text-sobre-cor">',
      '<p className="bg-fundo text-apoio hover:bg-fundo-suave">',
    ].join('\n')
    expect(classesReprovadas('paginas/Fixture.tsx', fixture)).toEqual([
      'paginas/Fixture.tsx: text-white (não muda com o tema)',
      'paginas/Fixture.tsx: text-tinta com hover:bg-laranja (texto que não acompanha a face)',
      'paginas/Fixture.tsx: text-white com enabled:hover:bg-grafite (texto que não acompanha a face)',
    ])
  })

  it('o que a guarda não vê fica dito: a lista quebrada em linhas e a face e o texto em textos diferentes do mesmo template', () => {
    // `TEXTO_ENTRE_ASPAS` lê um texto de uma linha só. Estes dois casos passam na guarda e erram no escuro; quem os
    // pega é o axe com o tema escuro (e2e/aparencia.spec.ts). O caso existe para que o limite seja decisão, e não surpresa.
    const fixture = [
      '<p className={`bg-laranja ${aberto ? \'text-tinta\' : \'\'}`}>',
      '<p className={[',
      "  'bg-laranja',",
      "  'text-tinta',",
      '].join(\' \')}>',
    ].join('\n')
    expect(classesReprovadas('paginas/Fixture.tsx', fixture)).toEqual([])
  })

  it('grafite e noite só são face onde a lista fechada do oficial diz, e a lista só encolhe', () => {
    const conteudos = arquivosDeCodigo(raizDaWeb).map((arquivo) => ({ nome: arquivo.slice(raizDaWeb.length + 1), conteudo: readFileSync(arquivo, 'utf8') }))
    const nomes = conteudos.map(({ nome }) => nome)
    expect(conteudos.flatMap(({ nome, conteudo }) => facesDoOficialForaDaLista(nome, conteudo)), 'só o oficial é grafite (RF6)').toEqual([])
    // A lista não guarda o que já saiu: entrada de arquivo que não existe, ou de classe que o arquivo já não escreve.
    for (const [arquivo, uso] of Object.entries(FACE_DO_OFICIAL)) {
      expect(nomes, `${arquivo} saiu do lugar: tire a entrada`).toContain(arquivo)
      const escritas = new Set([...(conteudos.find(({ nome }) => nome === arquivo)?.conteudo ?? '').matchAll(FACE_DO_OFICIAL_NA_CLASSE)].map(([, classe]) => classe))
      for (const classe of uso.classes) expect(escritas.has(classe), `${arquivo} já não escreve ${classe}: tire da lista`).toBe(true)
      expect(uso.justificativa.length, `${arquivo} sem justificativa`).toBeGreaterThan(20)
      expect(uso.sai, `${arquivo} sem a tarefa ou a spec que o tira`).toMatch(/^(?:não sai\b|\d+\.0 |X[2-4] )/)
    }
    // O oficial é o único que fica: nenhum uso de antes diz "não sai".
    expect(Object.entries(FACE_DO_OFICIAL).filter(([, { sai }]) => sai.startsWith('não sai')).map(([arquivo]) => arquivo)).toEqual(['componentes/ui/botao-secundario.ts'])
    expect(listaDoOficialCresceu(FACE_DO_OFICIAL), 'a lista fechada do oficial só encolhe').toBe(false)
    // O teto é o tamanho de hoje: quem tira um uso (a 8.0 tirou o avatar, a 12.0 a dica e o avatar da lateral) baixa o teto
    // junto, e a lista não ganha folga.
    expect(TETO_DA_LISTA_DO_OFICIAL).toBe(Object.keys(FACE_DO_OFICIAL).length)
  })

  it('a cor escrita à mão é de duas peças só: o QR e a cabeça da onça', () => {
    expect([...ARQUIVOS_COM_COR_EM_LINHA].sort()).toEqual(['componentes/CodigoQr.tsx', 'componentes/ui/onca/CabecaOnca.tsx'])
  })

  it('a guarda da face do oficial reprova o arquivo novo e a classe que a entrada não cita, e aceita só o que a lista diz', () => {
    const fixture = [
      '<p className="rounded-controle bg-grafite text-sobre-grafite">',
      '<p className="bg-noite text-sobre-grafite">',
      '<p className="enabled:hover:bg-noite-alto enabled:active:bg-noite-baixo">',
    ].join('\n')
    // Arquivo novo: nenhuma das faces passa, com o hover e o apertado também.
    expect(facesDoOficialForaDaLista('paginas/Nova.tsx', fixture)).toEqual([
      'paginas/Nova.tsx: bg-grafite (face do oficial fora da lista)',
      'paginas/Nova.tsx: bg-noite (face do oficial fora da lista)',
      'paginas/Nova.tsx: enabled:hover:bg-noite-alto (face do oficial fora da lista)',
      'paginas/Nova.tsx: enabled:active:bg-noite-baixo (face do oficial fora da lista)',
    ])
    // O arquivo do oficial aceita a face e o hover dele, e não a `noite`: a entrada diz as classes, e não o arquivo.
    expect(facesDoOficialForaDaLista('componentes/ui/botao-secundario.ts', fixture)).toEqual([
      'componentes/ui/botao-secundario.ts: bg-noite (face do oficial fora da lista)',
      'componentes/ui/botao-secundario.ts: enabled:active:bg-noite-baixo (face do oficial fora da lista)',
    ])
    // O uso de antes aceita a `noite` e não a `grafite`: sair do oficial para outro arquivo não vale.
    expect(facesDoOficialForaDaLista('areas/aluno/Atividade.tsx', fixture)).toEqual([
      'areas/aluno/Atividade.tsx: bg-grafite (face do oficial fora da lista)',
      'areas/aluno/Atividade.tsx: enabled:hover:bg-noite-alto (face do oficial fora da lista)',
      'areas/aluno/Atividade.tsx: enabled:active:bg-noite-baixo (face do oficial fora da lista)',
    ])
    // O que não é face do oficial passa em qualquer arquivo: a borda, o texto, o degrau, outra família.
    const passa = '<p className="border-noite text-sobre-grafite degrau-grafite bg-caramelo-noite bg-fundo bg-noite-ia">'
    expect(facesDoOficialForaDaLista('paginas/Nova.tsx', passa)).toEqual(['paginas/Nova.tsx: bg-noite-ia (face do oficial fora da lista)'])
    // A lista com uma entrada a mais cresceu, e o teto é o que a diz.
    expect(listaDoOficialCresceu({ ...FACE_DO_OFICIAL, 'paginas/Nova.tsx': { classes: ['bg-noite'], justificativa: 'x', sai: 'x' } })).toBe(true)
  })

  it('a seleção de texto pinta com token, nos dois temas: fundo laranja-borda e texto tinta', () => {
    // Sem a regra, o navegador pinta a seleção com o azul do sistema, que no escuro apaga o texto claro; e com hex
    // escrito à mão a cor ficaria fora da 9.10 e não viraria com o tema (RF1).
    const selecao = /::selection\s*\{([^}]*)\}/.exec(cssDoProduto())?.[1] ?? ''
    expect(selecao).toMatch(/background-color:\s*var\(--color-laranja-borda\)/)
    expect(selecao).toMatch(/(?:^|[\s;])color:\s*var\(--color-tinta\)/)
    expect([...cssDoProduto().matchAll(/::selection\s*\{/g)]).toHaveLength(1)
  })

  it('fora dos dois blocos de token, o estilos.css escreve cor só no véu do diálogo: o `veu` de cada tema e o forte do login por cima', () => {
    // Toda regra do CSS pinta por variável, e é isso que a faz virar com o tema. O véu é a exceção: antes do Chrome
    // 122 o `::backdrop` não herda variável, e a regra ficaria sem cor nenhuma. Por isso o valor é escrito por extenso, e
    // o teste o confere contra o `veu` do bloco do tema dele: trocar o token sem trocar a regra reprova.
    const css = cssDoProduto()
    const claro = css.indexOf(ABERTURA_DO_CLARO)
    const escuro = css.search(/:root\[data-tema='escuro'\]\s*\{/)
    const semTokens = [miolo(css, claro), miolo(css, escuro)].reduce((resto, bloco) => resto.replace(bloco, ''), css)
    const semComentario = semTokens.replace(/\/\*[\s\S]*?\*\//g, '')
    expect([...semComentario.matchAll(COR_ESCRITA)].map(([cor]) => cor)).toEqual(['rgba(', 'rgba(', 'rgba('])

    const veus = veusDoBackdrop(semComentario)
    const { claro: paletaClara, escuro: paletaEscura } = blocosDe(css)
    expect([...veus.keys()].sort()).toEqual([':root dialog[data-sessao-vencida]::backdrop', ":root[data-tema='escuro'] dialog::backdrop", 'dialog::backdrop'])
    expect(veus.get('dialog::backdrop')).toBe(rgbaDoHexDeOito(paletaClara.get('veu') ?? ''))
    expect(veus.get(":root[data-tema='escuro'] dialog::backdrop")).toBe(rgbaDoHexDeOito(paletaEscura.get('veu') ?? ''))
    expect(veus.get(':root dialog[data-sessao-vencida]::backdrop')).toBe('rgba(13, 13, 13, 0.75)')
  })

  it('o QR é a única exceção, e só nele: branco fixo e cor em linha passam no arquivo da lista', () => {
    const qr = '<svg className="bg-white"><path fill="#0d0d0d" /></svg>'
    expect(classesReprovadas('componentes/CodigoQr.tsx', qr)).toEqual([])
    expect(classesReprovadas('componentes/Outro.tsx', qr)).toEqual(['componentes/Outro.tsx: bg-white (não muda com o tema)', 'componentes/Outro.tsx: fill #0d0d0d (cor em linha)'])
  })
})

/** `#rrggbbaa` como o `rgba(r, g, b, a)` que `estilos.css` escreve no `::backdrop`, com a transparência em duas casas. */
function rgbaDoHexDeOito(hex: string): string {
  if (!/^#[0-9a-f]{8}$/.test(hex)) throw new Error(`o véu não é hex de oito dígitos: ${hex}`)
  const canais = [1, 3, 5].map((posicao) => Number.parseInt(hex.slice(posicao, posicao + 2), 16))
  const alfa = Number((Number.parseInt(hex.slice(7, 9), 16) / 255).toFixed(2))
  return `rgba(${canais.join(', ')}, ${String(alfa)})`
}

/** Cada regra de `::backdrop` do CSS (sem comentário): o seletor, com o espaço em branco normalizado, e o `background-color`. */
function veusDoBackdrop(css: string): Map<string, string> {
  const veus = new Map<string, string>()
  for (const [, seletor = '', corpo = ''] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!seletor.includes('::backdrop')) continue
    const cor = /background-color\s*:\s*([^;]+);/.exec(corpo)?.[1]
    veus.set(seletor.trim().replace(/\s+/g, ' '), (cor ?? '').trim())
  }
  return veus
}

/** O CSS sem os comentários, para a conferência não ler a explicação como se fosse regra. */
function cssSemComentario(): string {
  return cssDoProduto().replace(/\/\*[\s\S]*?\*\//g, '')
}

/** As declarações da regra de `seletor` (o texto exato antes da `{`), como `propriedade → valor`; vazio se a regra não existe. */
function declaracoesDe(seletor: string, css = cssSemComentario()): Map<string, string> {
  // O espaço em branco do seletor não conta: a quebra de linha e o recuo do CSS, ou uma vírgula sem espaço depois,
  // não podem quebrar a busca. Entre partes de um seletor composto continua sendo um ou mais espaços.
  const escapado = seletor
    .trim()
    .split(/\s+/)
    .map((parte) => parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+')
    .replace(/,\\s\+/g, ',\\s*')
  const regra = new RegExp(`(?:^|[}\\s])${escapado}\\s*\\{([^}]*)\\}`, 'm').exec(css)
  return new Map([...(regra?.[1] ?? '').matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)].map(([, propriedade = '', valor = '']) => [propriedade, valor.trim()]))
}

interface LinhaDaTipografia {
  readonly classe: string
  readonly tamanho: number
  readonly altura: number
  readonly peso: number
  readonly caixa: string
}

/** As linhas da tabela da 9.2 do `docs/interface.md`: o documento é a fonte, e o CSS é conferido contra ele. */
function tipografiaDoDocumento(): LinhaDaTipografia[] {
  const documento = readFileSync(join(raizDoRepositorio, 'docs', 'interface.md'), 'utf8')
  const inicio = documento.indexOf('### 9.2 Tipografia')
  if (inicio === -1) throw new Error('docs/interface.md sem a seção 9.2')
  const fim = documento.indexOf('\n### ', inicio + 5)
  const secao = documento.slice(inicio, fim === -1 ? undefined : fim)
  return [...secao.matchAll(/^\|\s*`(t-[a-z-]+)`\s*\|\s*(\d+)\s*\/\s*(\d+)\s*px\s*\|\s*(\d+)\s*\|([^|]*)\|/gm)].map(([, classe = '', tamanho = '', altura = '', peso = '', caixa = '']) => ({
    classe,
    tamanho: Number(tamanho),
    altura: Number(altura),
    peso: Number(peso),
    caixa: caixa.trim(),
  }))
}

describe('a tipografia t-* do estilos.css (9.2 do docs/interface.md)', () => {
  it('a tabela do documento é lida inteira: dez classes', () => {
    // Sem a âncora o caso abaixo passaria vazio no dia em que a tabela mudasse de forma e o regex não achasse linha.
    expect(tipografiaDoDocumento().map(({ classe }) => classe)).toEqual([
      't-titulo',
      't-secao',
      't-balao',
      't-cartao',
      't-corpo',
      't-apoio',
      't-rotulo',
      't-selo',
      't-numero',
      't-numero-g',
    ])
  })

  it.each(tipografiaDoDocumento())('$classe tem o tamanho, a altura, o peso e a caixa do documento', ({ classe, tamanho, altura, peso, caixa }) => {
    const regra = declaracoesDe(`.${classe}`)
    // O documento diz px e o CSS diz `rem`: nos 16 px de fábrica são o mesmo número, e é a `rem` que faz o texto acompanhar o
    // tamanho da letra do aluno (8.0). O 17 px de `t-corpo` é 1.0625rem, e o `rem` de 16 px não pode voltar a ser px.
    expect(regra.get('font-size')).toBe(`${String(tamanho / 16)}rem`)
    expect(regra.get('line-height')).toBe(`${String(altura / 16)}rem`)
    expect(regra.get('font-weight')).toBe(String(peso))
    const espacamento = /([−-]?\d+,\d+)em/.exec(caixa)?.[1]
    expect(regra.get('letter-spacing')).toBe(espacamento === undefined ? undefined : `${espacamento.replace('−', '-').replace(',', '.').replace(/^(-?)0\./, '$10.')}em`)
    expect(regra.get('text-transform')).toBe(caixa.includes('caixa-alta') ? 'uppercase' : undefined)
    expect(regra.get('font-variant-numeric')).toBe(caixa.includes('tabular-nums') ? 'tabular-nums' : undefined)
  })

  it('o tamanho da letra do aluno (8.0): Grande é 112,5% e Maior 125% no <html>, só com o atributo, e a tipografia é em rem para acompanhar', () => {
    expect(declaracoesDe(":root[data-letra='grande']").get('font-size')).toBe('112.5%')
    expect(declaracoesDe(":root[data-letra='maior']").get('font-size')).toBe('125%')
    // Sem o atributo, nenhuma regra mexe no tamanho do <html>: Padrão são os 16 px de fábrica.
    expect(declaracoesDe(':root').get('font-size')).toBeUndefined()
    expect(declaracoesDe('html').get('font-size')).toBeUndefined()
    // Texto em px não acompanha o <html>: nenhuma classe t-* o escreve.
    for (const { classe } of tipografiaDoDocumento()) {
      const regra = declaracoesDe(`.${classe}`)
      expect(regra.get('font-size'), classe).toMatch(/rem$/)
      expect(regra.get('line-height'), classe).toMatch(/rem$/)
    }
  })

  it('o piso é 14 px: nenhuma classe t-* desce de 13 px, e só o t-selo tem 13', () => {
    // Em `rem`: nos 16 px de fábrica, vezes 16 são os px do documento.
    const tamanhos = tipografiaDoDocumento().map(({ classe }) => [classe, Number.parseFloat(declaracoesDe(`.${classe}`).get('font-size') ?? '0') * 16] as const)
    expect(tamanhos.filter(([, tamanho]) => tamanho < 13)).toEqual([])
    expect(tamanhos.filter(([, tamanho]) => tamanho < 15).map(([classe]) => classe)).toEqual(['t-selo'])
  })
})

describe('o degrau, o foco e o movimento do estilos.css (RF5, RF7 e RF8)', () => {
  it('o degrau é sombra sólida e margem do mesmo tamanho, sem desfoque', () => {
    const degrau = declaracoesDe('.degrau')
    // Sombra sólida: deslocamento vertical, nenhum desfoque nem espalhamento (9.3: "nenhuma sombra com desfoque").
    expect(degrau.get('box-shadow')).toBe('0 var(--altura-degrau, 4px) 0 0 var(--lado, var(--color-borda))')
    // A margem de baixo é a mesma altura, para a peça apertada não mexer em nada em volta.
    expect(degrau.get('margin-bottom')).toBe('var(--altura-degrau, 4px)')
  })

  it('só o transform anima, em --t-toque, sem curva; e --t-toque vale 100 ms', () => {
    expect(declaracoesDe('.degrau').get('transition')).toBe('transform var(--t-toque) linear')
    expect(cssDoProduto()).toMatch(/--t-toque:\s*100ms;/)
  })

  it('apertado, a peça desce o degrau e a sombra encolhe o que ela desceu; a peça desligada não aperta', () => {
    const apertado = declaracoesDe(".degrau:active:not(:disabled):not([aria-disabled='true'])")
    expect(apertado.get('transform')).toBe('translateY(var(--afunda, var(--altura-degrau, 4px)))')
    expect(apertado.get('box-shadow')).toBe('0 calc(var(--altura-degrau, 4px) - var(--afunda, var(--altura-degrau, 4px))) 0 0 var(--lado, var(--color-borda))')
  })

  it('desligado perde a sombra e guarda a margem: a altura total não muda', () => {
    const desligado = declaracoesDe(".degrau:disabled,\n  .degrau[aria-disabled='true']")
    expect(desligado.get('box-shadow')).toBe('none')
    expect(desligado.has('margin-bottom')).toBe(false)
  })

  it('cada classe de cor do degrau resolve para um token que existe nos dois temas', () => {
    const { claro, escuro } = blocosDe(cssDoProduto())
    const esperadas: Record<string, string> = {
      'degrau-laranja': 'laranja-degrau',
      'degrau-grafite': 'grafite-degrau',
      'degrau-borda': 'borda',
      'degrau-vermelho': 'vermelho-degrau',
      'degrau-vermelho-borda': 'vermelho-borda',
      'degrau-azul': 'azul-degrau',
    }
    for (const [classe, token] of Object.entries(esperadas)) {
      expect(declaracoesDe(`.${classe}`).get('--lado'), classe).toBe(`var(--color-${token})`)
      expect(claro.has(token), `${classe} no claro`).toBe(true)
      expect(escuro.has(token), `${classe} no escuro`).toBe(true)
    }
    // Nenhuma outra classe de degrau escondida: a lista acima é a que o teste do botão resolve por tema.
    const declaradas = [...cssSemComentario().matchAll(/\.(degrau-[a-z-]+)\s*\{/g)].map(([, classe]) => classe)
    expect(declaradas.sort()).toEqual(Object.keys(esperadas).sort())
  })

  it('o anel de foco é contorno sólido de 3 px em foco, afastado 2 px, e a classe do degrau não o apaga', () => {
    const anel = declaracoesDe(':focus-visible')
    expect(anel.get('outline')).toBe('3px solid var(--color-foco)')
    expect(anel.get('outline-offset')).toBe('2px')
    expect(declaracoesDe('.degrau').has('outline')).toBe(false)
  })

  it('sobre a face noite do escuro, onde ela é clara, o anel é o texto da face; o chão próprio dentro dela volta ao foco', () => {
    expect(declaracoesDe(":root[data-tema='escuro'] .bg-noite :focus-visible").get('outline-color')).toBe('var(--color-sobre-grafite)')
    // O grupo da `Aparencia` na faixa da operação tem chão próprio, e o anel é desenhado sobre ele.
    const chaoProprio = declaracoesDe(":root[data-tema='escuro'] .bg-noite .bg-fundo :focus-visible,\n  :root[data-tema='escuro'] .bg-noite .bg-superficie :focus-visible")
    expect(chaoProprio.get('outline-color')).toBe('var(--color-foco)')
    // O `caramelo-noite` deixou de ser a cor do anel: ele ficava a menos de 2:1 da face `noite` do escuro.
    expect(cssSemComentario()).not.toMatch(/outline-color:\s*var\(--color-caramelo-noite\)/)
  })

  it('movimento reduzido desliga a transição e a animação de tudo, e a peça apertada não desce', () => {
    const css = cssSemComentario()
    const media = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(media.startsWith('@media (prefers-reduced-motion: reduce)')).toBe(true)
    const global = declaracoesDe('*,\n  ::before,\n  ::after', media)
    expect(global.get('transition-duration')).toBe('0.01ms !important')
    expect(global.get('animation-duration')).toBe('0.01ms !important')
    expect(global.get('animation-iteration-count')).toBe('1 !important')
    // A rolagem suave também é movimento: o âncora e o `scrollIntoView` saltam.
    expect(global.get('scroll-behavior')).toBe('auto !important')
    expect(declaracoesDe(".degrau:active:not(:disabled):not([aria-disabled='true'])", media).get('transform')).toBe('none')
  })

  it('o CSS do produto só anima transform e opacity, e nenhum laço', () => {
    const css = cssSemComentario()
    const propriedadesAnimadas = [...css.matchAll(/transition(?:-property)?\s*:\s*([^;}]+)[;}]/g)].flatMap(([, valor = '']) =>
      valor.split(',').map((parte) => parte.trim().split(/\s+/)[0] ?? ''),
    )
    expect(propriedadesAnimadas.length).toBeGreaterThan(0)
    expect(propriedadesAnimadas.filter((propriedade) => !['transform', 'opacity'].includes(propriedade))).toEqual([])
    expect(css).not.toContain('infinite')
  })

  it('nenhum CSS de `apps/web/src`, o `Onca.css` incluído, tem laço (`infinite`): o `estilos.css` não é o único', () => {
    const arquivos = (pasta: string): string[] =>
      readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => (entrada.isDirectory() ? arquivos(join(pasta, entrada.name)) : entrada.name.endsWith('.css') ? [join(pasta, entrada.name)] : []))
    const todos = arquivos(join(raizDaWeb))
    expect(todos.some((arquivo) => arquivo.endsWith('Onca.css')), 'o css da onça está na lista').toBe(true)
    for (const arquivo of todos) expect(readFileSync(arquivo, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), arquivo).not.toContain('infinite')
  })
})
