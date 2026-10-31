// A duração dos casos de e2e que o portão da tarefa roda (retrospectiva da X1, M1; da X2, M1).
//
// O prazo de um caso sem prazo próprio é 30 s no runner da esteira, que leva perto do dobro da máquina de quem implementa. Um
// caso desses que passa de 15 s aqui estoura lá. Na X1 os casos que caíram na esteira levavam de 19 a 29 s na máquina; na X2, quatro dos sete casos
// de prazo já passavam de 15 s aqui (`material:180` a 18 s, `areas:316` a 22, `agentes:164` a 22 e `agentes:186` a 21). Cada
// um custou uma correção e uma rodada de validação depois da validação aprovada, porque o portão da tarefa só olhava se o
// caso passava, e nunca em quanto tempo.
//
// Como funciona: o portão da tarefa liga a variável `EDUCA_RELATORIO_DO_E2E` na corrida do e2e; o `playwright.config.ts`
// então acrescenta o repórter `json` (`relatoriosDoPlaywright`), que grava a duração e o prazo de cada caso em cada projeto.
// Com a corrida verde, o portão lê o relatório (`motivoDaDuracaoDoE2e`) e reprova o caso **alterado** que passou da metade
// do prazo dele.
//
// O prazo do caso é o que ele declara (`test.slow()` dá 90 s; `test.setTimeout(n)` dá n) e, sem declarar nada, 30 s: a metade
// é 15 s, o limite de antes. Caso que declara prazo próprio é caso que sabe que é longo (o roteiro da demonstração, o fluxo de
// ponta a ponta da A2 e da A3-A4), e medi-lo contra 15 s o obrigaria a deixar de ser de ponta a ponta (correção
// `2026-10-18-duracao-do-e2e-le-o-prazo-declarado`). Mas só vale o prazo que **já estava no HEAD**: `test.slow()` posto agora num caso
// que estourou a régua seria a saída mais curta para escapar dela, e o que o prazo maior encobre é justamente o caso que se tornou lento.
// O prazo do HEAD se acha pelo título do caso, em qualquer spec (o caso movido para outro arquivo leva o prazo que tinha); o caso que
// só mudou de título leva o do caso de corpo idêntico (`prazosDosRetitulados`); caso que não existia, ou cujo título o HEAD não escreve
// por extenso, conta 30 s.
//
// O que a leitura do HEAD não faz, e por isso o caso conta 30 s (cobra mais, nunca menos): ler `test.slow(condição)`, `describe.configure`
// e `test.setTimeout(ident)` cuja constante não é só números e `*` no mesmo arquivo; e distinguir dois casos de mesmo título em specs
// diferentes (vale o de menor prazo, mas um caso novo que repete o título de um lento herda o prazo dele). `test.slow()` posto no nível
// do `describe`, fora do corpo de qualquer caso, não é lido: se um dia aparecer, é um corte a mais em `FIM_DE_CASO`. A constante só é
// lida na coluna 0, fora de função, e terminada sem `;`; e `test.setTimeout( n )`, com espaço dentro dos parênteses, não é lido (o
// prettier não o escreve): nos dois o caso conta 30 s.
//
// O leitor de comentários (`semComentarios`) usa o parser do TypeScript, e por isso sabe o que é expressão regular literal, com aspa,
// crase ou `\/` dentro. Com o leitor à mão que havia, a regex de `e2e/tokens.spec.ts:61` e `:80` desalinhava o spec e deixava o
// comentário do corpo do caso no trecho (`2026-10-31-duracao-do-e2e-regex-literal`).
//
// "Alterado" é o caso cujas linhas o diff tocou, e não todo caso do arquivo: quem altera um caso do `material.spec.ts` não
// herda os casos lentos que já estavam lá (cada um tem a sua correção). O caso vai da linha do `test(` até a linha antes
// do `test(` seguinte; linha alterada antes do primeiro caso (importação, ajudante do alto do arquivo) não é de caso
// nenhum. Arquivo novo, ainda fora do git, tem todos os casos alterados. A exceção é o caso cujo trecho sem comentário (do título
// ao próximo `test(`, com o gancho que vier depois dele) é igual ao do HEAD, no mesmo arquivo e com o mesmo título: trocar só um
// comentário não faz o caso crescer, e o `restos` da onda de nomes cobra a troca (`2026-10-31-duracao-do-e2e-so-comentario`).
// Título de modelo (`${}`), título repetido no spec e título novo continuam alterados.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { ReporterDescription } from '@playwright/test'
import type * as TS from 'typescript'

/** O prazo de um caso que não declara nenhum: o `timeout` padrão do Playwright, que o `playwright.config.ts` não muda. */
export const PRAZO_PADRAO_DO_CASO_DE_E2E_MS = 30_000
/** O runner leva perto do dobro da máquina: aqui, o caso sem prazo próprio que passa de 15 s (metade dos 30 s) fica vermelho. */
export const LIMITE_DO_CASO_DE_E2E_MS = PRAZO_PADRAO_DO_CASO_DE_E2E_MS / 2
/** Quando posta, o Playwright grava o relatório de duração neste arquivo. Só o portão da tarefa a posta. */
export const VARIAVEL_DO_RELATORIO_DO_E2E = 'EDUCA_RELATORIO_DO_E2E'
export const CAMINHO_DO_RELATORIO_DO_E2E = '.processo/e2e-duracao.json'
/**
 * O censo (`node tools/processo/esteira.ts --censo`): na esteira, cada fatia do e2e grava o mesmo relatório neste arquivo e o
 * publica como artefato `censo-do-e2e-<fatia>`, também no verde. Só o arquivo JSON, sem `test-results/`, mas o repórter `json`
 * grava nele também `errors`, `stdout`, `stderr` e os metadados dos anexos de cada resultado, e o artefato é público: a garantia
 * é todo dado do e2e ser sintético (regra 20, item 17), e `tools/ci/esteira.test.ts` fixa que nenhum spec anexa corpo.
 */
export const ARQUIVO_DO_CENSO_DO_E2E = 'censo-do-e2e.json'
export const PREFIXO_DO_ARTEFATO_DO_CENSO = 'censo-do-e2e-'

/**
 * Os repórteres do Playwright: a lista de sempre (a esteira anota as falhas no GitHub) e, só com o arquivo do relatório,
 * o `json` que mede os casos. `reporter` na linha de comando trocaria a lista inteira; por isso é a configuração que o
 * acrescenta.
 */
export function relatoriosDoPlaywright(naEsteira: boolean, arquivoDoRelatorio: string | undefined): ReporterDescription[] {
  return [
    ['list'],
    ...(naEsteira ? [['github'] as ReporterDescription] : []),
    ...(arquivoDoRelatorio ? [['json', { outputFile: arquivoDoRelatorio }] as ReporterDescription] : []),
  ]
}

interface ResultadoDoRelatorio {
  duration?: number
}
interface TesteDoRelatorio {
  /** O prazo do caso, com `test.slow()` e `test.setTimeout()` já aplicados. */
  timeout?: number
  projectName?: string
  status?: string
  results?: ResultadoDoRelatorio[]
}
interface CasoDoRelatorio {
  title?: string
  file?: string
  line?: number
  tests?: TesteDoRelatorio[]
}
interface SuiteDoRelatorio {
  title?: string
  specs?: CasoDoRelatorio[]
  suites?: SuiteDoRelatorio[]
}
export interface RelatorioDoPlaywright {
  suites?: SuiteDoRelatorio[]
}

export interface CasoMedido {
  /** Como o repositório o chama: `e2e/<arquivo>.spec.ts`. */
  arquivo: string
  /** A linha do `test(` do caso. */
  linha: number
  titulo: string
  projeto: string
  duracaoMs: number
  /** O prazo que a corrida deu ao caso: 30 s, ou o que ele declarou. */
  prazoMs: number
}

function caminhoDoSpec(arquivo: string): string {
  return arquivo.startsWith('e2e/') ? arquivo : `e2e/${arquivo}`
}

/** Cada caso em cada projeto, com o tempo que levou. Caso pulado não tem tempo e fica de fora. */
export function casosMedidos(relatorio: RelatorioDoPlaywright): CasoMedido[] {
  const casos: CasoMedido[] = []
  const percorrer = (suite: SuiteDoRelatorio, titulos: string[]) => {
    const caminho = suite.title && !suite.title.endsWith('.ts') ? [...titulos, suite.title] : titulos
    for (const caso of suite.specs ?? []) {
      if (caso.file === undefined || caso.line === undefined) continue
      for (const teste of caso.tests ?? []) {
        if (teste.status === 'skipped') continue
        // Soma as tentativas do caso. Com `retries: 0` (`playwright.config.ts`) é uma só; se um dia o retry for ligado, o caso que
        // falhou uma vez e passou na segunda passa a parecer lento, e aqui é preciso medir só a última tentativa.
        const duracaoMs = (teste.results ?? []).reduce((soma, resultado) => soma + (resultado.duration ?? 0), 0)
        casos.push({
          arquivo: caminhoDoSpec(caso.file),
          linha: caso.line,
          titulo: [...caminho, caso.title ?? ''].join(' › '),
          projeto: teste.projectName ?? '',
          duracaoMs,
          prazoMs: teste.timeout ?? PRAZO_PADRAO_DO_CASO_DE_E2E_MS,
        })
      }
    }
    for (const filha of suite.suites ?? []) percorrer(filha, caminho)
  }
  for (const suite of relatorio.suites ?? []) percorrer(suite, [])
  return casos
}

/** O que o diff mudou num arquivo: as linhas dele, ou `tudo` quando o arquivo é novo. */
export type Alteracao = 'tudo' | ReadonlySet<number>

/**
 * As linhas do arquivo novo que um `git diff -U0` toca. Remoção pura (`+c,0`) conta como a linha `c`, a que ficou antes
 * dela: a que o caso de cima ainda contém.
 */
export function linhasDoDiff(diff: string): Set<number> {
  const linhas = new Set<number>()
  for (const cabecalho of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const inicio = Number(cabecalho[1])
    const quantas = cabecalho[2] === undefined ? 1 : Number(cabecalho[2])
    if (quantas === 0) linhas.add(Math.max(inicio, 1))
    for (let linha = inicio; linha < inicio + quantas; linha++) linhas.add(linha)
  }
  return linhas
}

/** O que a árvore alterou no arquivo em relação ao HEAD. Fora do git, o arquivo é novo e tudo nele é alteração. */
export function alteracoesDoArquivo(raiz: string, arquivo: string): Alteracao {
  const versionado = execFileSync('git', ['ls-files', '--', arquivo], { cwd: raiz, encoding: 'utf8' }).trim() !== ''
  if (!versionado) return 'tudo'
  return linhasDoDiff(execFileSync('git', ['diff', '-U0', 'HEAD', '--', arquivo], { cwd: raiz, encoding: 'utf8' }))
}

/** Os casos que o diff tocou: do `test(` deles até a linha antes do `test(` seguinte do mesmo arquivo. */
export function casosAlterados(casos: readonly CasoMedido[], alteracaoDe: (arquivo: string) => Alteracao): CasoMedido[] {
  const alteracoes = new Map<string, Alteracao>()
  const linhasDe = new Map<string, number[]>()
  for (const caso of casos) {
    if (!alteracoes.has(caso.arquivo)) alteracoes.set(caso.arquivo, alteracaoDe(caso.arquivo))
    linhasDe.set(caso.arquivo, [...new Set([...(linhasDe.get(caso.arquivo) ?? []), caso.linha])].sort((a, b) => a - b))
  }
  return casos.filter((caso) => {
    const alteracao = alteracoes.get(caso.arquivo)
    if (alteracao === undefined) return false
    if (alteracao === 'tudo') return true
    const seguinte = (linhasDe.get(caso.arquivo) ?? []).find((linha) => linha > caso.linha) ?? Number.POSITIVE_INFINITY
    return [...alteracao].some((linha) => linha >= caso.linha && linha < seguinte)
  })
}

/**
 * O título que o spec escreve por extenso, sem as barras de escape. `null` quando é um modelo com `${}`: o título só existe
 * quando o código roda, e o HEAD não o diz.
 */
function tituloLiteral(corpo: string): string | null {
  return corpo.includes('${') ? null : corpo.replace(/\\(.)/g, '$1')
}

/**
 * O texto sem os comentários de linha e de bloco, deixando intacto o que não é comentário (`'http://…'`, uma crase ou uma aspa dentro de
 * uma expressão regular literal). Quem lê o prazo não pode tomar por declaração um `test.slow()` citado num comentário
 * (`e2e/lista-da-turma.spec.ts` tem um).
 *
 * Pelo parser do TypeScript, e não por um leitor à mão: só a árvore sabe se uma `/` abre expressão regular ou divide, e o leitor à mão
 * lia a aspa e a crase de uma regex literal como abertura de texto, desalinhava o resto do spec e deixava comentário no corpo do caso
 * (`e2e/tokens.spec.ts:61` e `:80`, correção `2026-10-31-duracao-do-e2e-regex-literal`). O texto entre dois tokens é só espaço e
 * comentário, e é só nele que se tira o comentário (o espaço e a quebra de linha ficam). Texto que o parser deixa fora da árvore num erro
 * de sintaxe fica como está, comentário e tudo: o que sobrar só faz o caso parecer alterado, que cobra mais.
 */
export function semComentarios(texto: string): string {
  const ts = carregarTypescript()
  const fonte = ts.createSourceFile(
    'spec.ts',
    texto,
    { languageVersion: ts.ScriptTarget.Latest, jsDocParsingMode: ts.JSDocParsingMode.ParseNone },
    true,
    ts.ScriptKind.TS,
  )
  const comentarios: [number, number][] = []
  const visitar = (no: TS.Node): void => {
    const filhos = no.getChildren(fonte)
    if (filhos.length > 0) {
      filhos.forEach(visitar)
      return
    }
    comentarios.push(...comentariosDaTrivia(texto, no.pos, no.getStart(fonte)))
  }
  visitar(fonte)
  let saida = ''
  let desde = 0
  for (const [inicio, fim] of comentarios) {
    saida += texto.slice(desde, inicio)
    desde = fim
  }
  return saida + texto.slice(desde)
}

/**
 * O `typescript` só se carrega quando um spec é lido: o `playwright.config.ts` importa este módulo, e não precisa dele. Sem `import.meta`,
 * que o Playwright não aceita neste arquivo (ele o lê como CommonJS); o portão e a esteira rodam na raiz do repositório.
 */
function carregarTypescript(): typeof TS {
  typescript ??= createRequire(join(process.cwd(), 'package.json'))('typescript') as typeof TS
  return typescript
}
let typescript: typeof TS | undefined

/**
 * Onde há comentário na trivia (o que fica entre dois tokens, de `de` a `ate`), como faixas `[início, fim)` do texto inteiro. Na trivia não
 * há texto entre aspas, então `//` e `/*` são sempre comentário. O de linha acaba antes da quebra, que fica.
 */
function comentariosDaTrivia(texto: string, de: number, ate: number): [number, number][] {
  const faixas: [number, number][] = []
  let i = de
  while (i < ate) {
    if (texto.startsWith('//', i)) {
      const quebra = texto.indexOf('\n', i + 2)
      const fim = quebra === -1 ? ate : quebra
      faixas.push([i, fim])
      i = fim
    } else if (texto.startsWith('/*', i)) {
      const fechamento = texto.indexOf('*/', i + 2)
      const fim = fechamento === -1 ? ate : fechamento + 2
      faixas.push([i, fim])
      i = fim
    } else {
      i++
    }
  }
  return faixas
}

/** As constantes do spec que são só números e `*` (`const PRAZO_DO_ROTEIRO_MS = 8 * 60_000`), para o `test.setTimeout(PRAZO_DO_ROTEIRO_MS)`. */
function constantesNumericas(texto: string): Map<string, number> {
  const constantes = new Map<string, number>()
  for (const declaracao of texto.matchAll(/^(?:export\s+)?const\s+(\w+)\s*=\s*([\d_]+(?:\s*\*\s*[\d_]+)*)\s*$/gm)) {
    const fatores = (declaracao[2] ?? '').split('*').map((fator) => Number(fator.replaceAll('_', '')))
    constantes.set(declaracao[1] ?? '', fatores.reduce((produto, fator) => produto * fator, 1))
  }
  return constantes
}

/** Onde começa um caso (`test('título'`, com o título na mesma linha ou na seguinte) e o que, além dele, encerra o texto do caso anterior. */
const INICIO_DE_CASO = /\btest(?:\.(?:only|fixme))?\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g
const FIM_DE_CASO = /\btest\.(?:describe|beforeEach|afterEach|beforeAll|afterAll|use)\b/

/**
 * O prazo que cada caso de um spec declara no corpo, na ordem em que o Playwright o aplica: `test.setTimeout(n)` troca o prazo
 * por `n` e `test.slow()` o triplica (`setTimeout(100_000)` e depois `slow()` dá 300 s; `slow()` e depois `setTimeout(100_000)`, 100 s).
 * O `n` é um número ou uma constante do mesmo arquivo feita só de números e `*`, escrita na coluna 0, fora de função, sem `;`. Comentário
 * não conta (`semComentarios`).
 * Só estas duas formas: `test.slow(condição)`, `describe.configure({ timeout })` e `test.setTimeout( n )` com espaço dentro dos
 * parênteses não são lidos, e o caso conta 30 s, que erra para o lado de cobrar mais.
 */
export function prazosDosCasos(textoBruto: string): { titulo: string; prazoMs: number }[] {
  return casosDoSpec(textoBruto).map(({ titulo, prazoMs }) => ({ titulo, prazoMs }))
}

/** Um caso do spec: o título, o prazo que o corpo declara e o corpo sem o título (para achar o caso que só mudou de nome). */
export interface CasoDoSpec {
  titulo: string
  prazoMs: number
  corpo: string
  /**
   * Tudo do fim do título até o próximo `test(`, sem comentário e sem as pontas em branco: é o trecho que `casosAlterados` atribui ao caso,
   * e por isso inclui o que o `corpo` corta em `FIM_DE_CASO` (um `test.beforeEach` ou um `test.use` depois do caso).
   * No último caso, vai até o fim do arquivo, com o `})` do `describe` e o que vier depois: mexer ali põe o caso de volta na régua,
   * o que só cobra mais.
   */
  trecho: string
}

/** Os casos de um spec, na ordem do arquivo, com o que `prazosDosCasos` documenta. O corpo vai sem comentário e sem as pontas em branco. */
export function casosDoSpec(textoBruto: string): CasoDoSpec[] {
  const texto = semComentarios(textoBruto)
  const constantes = constantesNumericas(texto)
  const inicios = [...texto.matchAll(INICIO_DE_CASO)]
  const casos: CasoDoSpec[] = []
  for (const [indice, inicio] of inicios.entries()) {
    const titulo = tituloLiteral(inicio[2] ?? '')
    if (titulo === null) continue
    const comeco = (inicio.index ?? 0) + inicio[0].length
    const proximo = inicios[indice + 1]?.index ?? texto.length
    const corpo = texto.slice(comeco, proximo)
    const fim = corpo.search(FIM_DE_CASO)
    const doCaso = fim === -1 ? corpo : corpo.slice(0, fim)
    let prazoMs = PRAZO_PADRAO_DO_CASO_DE_E2E_MS
    for (const declaracao of doCaso.matchAll(/\btest\.setTimeout\((\w+)\)|\btest\.slow\(\)/g)) {
      if (declaracao[1] === undefined) {
        prazoMs *= 3
        continue
      }
      const declarado = /^\d/.test(declaracao[1]) ? Number(declaracao[1].replaceAll('_', '')) : constantes.get(declaracao[1])
      if (declarado !== undefined) prazoMs = declarado
    }
    casos.push({ titulo, prazoMs, corpo: doCaso.trim(), trecho: corpo.trim() })
  }
  return casos
}

/** Os casos dos specs de `e2e/` no HEAD. Sem HEAD (repositório sem commit), nenhum. */
function casosDoHead(raiz: string): CasoDoSpec[] {
  try {
    const arquivos = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', '--', 'e2e/'], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .filter((arquivo) => arquivo.endsWith('.spec.ts'))
    return arquivos.flatMap((arquivo) =>
      casosDoSpec(execFileSync('git', ['show', `HEAD:${arquivo}`], { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })),
    )
  } catch {
    return []
  }
}

/** Os casos dos specs de `e2e/` na árvore de trabalho: os versionados que ainda existem e os novos, fora do git. */
function casosDaArvore(raiz: string): CasoDoSpec[] {
  try {
    const arquivos = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'e2e/'], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .filter((arquivo) => arquivo.endsWith('.spec.ts') && existsSync(join(raiz, arquivo)))
    return arquivos.flatMap((arquivo) => casosDoSpec(readFileSync(join(raiz, arquivo), 'utf8')))
  } catch {
    return []
  }
}

/**
 * O prazo que um caso com título novo herda do caso que só mudou de nome (RF11): o HEAD tinha um único caso com aquele
 * corpo (sem o título) e só um caso da árvore tem esse corpo. Corpo mudado, dois corpos iguais no HEAD, ou o corpo copiado
 * para outro caso (o título velho continua, e são dois na árvore): ninguém herda, e o caso conta 30 s. O corpo é lido até o
 * próximo `test(` ou `test.describe`, ou até o fim do arquivo no último caso, que leva junto o `})` de fechamento do `describe` e o
 * que vier depois: o caso que muda de lugar dentro do spec e passa a terminar em outro `})` conta como corpo mudado, e mexer no
 * código depois do último caso já basta para ele perder o prazo herdado. Os dois erram para o lado de cobrar mais.
 */
export function prazosDosRetitulados(doHead: readonly CasoDoSpec[], daArvore: readonly CasoDoSpec[]): Map<string, number> {
  const titulosDoHead = new Set(doHead.map((caso) => caso.titulo))
  const herdados = new Map<string, number>()
  for (const novo of daArvore) {
    if (titulosDoHead.has(novo.titulo)) continue
    const [velho, ...outrosVelhos] = doHead.filter((caso) => caso.corpo === novo.corpo)
    const iguaisNaArvore = daArvore.filter((caso) => caso.corpo === novo.corpo)
    if (velho === undefined || outrosVelhos.length > 0 || iguaisNaArvore.length !== 1) continue
    herdados.set(novo.titulo, velho.prazoMs)
  }
  return herdados
}

/**
 * O prazo que cada título de caso declarava no HEAD, em qualquer spec de `e2e/`. Título repetido em dois specs fica com o menor
 * prazo. O título novo de um caso que só mudou de nome leva o prazo do que ele tinha (`prazosDosRetitulados`). Sem HEAD
 * (repositório sem commit), vazio: nenhum caso tem prazo próprio.
 */
export function prazosDoHead(raiz: string): Map<string, number> {
  const doHead = casosDoHead(raiz)
  const prazos = new Map<string, number>()
  for (const { titulo, prazoMs } of doHead) prazos.set(titulo, Math.min(prazos.get(titulo) ?? prazoMs, prazoMs))
  for (const [titulo, prazoMs] of prazosDosRetitulados(doHead, casosDaArvore(raiz))) prazos.set(titulo, prazoMs)
  return prazos
}

/**
 * O prazo com que o caso é medido: o que a corrida lhe deu, mas, acima dos 30 s, nunca mais que o declarado no HEAD. O prazo posto
 * agora não conta, só o que o caso já tinha; e um prazo de 30 s ou menos vale como está, porque não há o que escapar. Declaração
 * menor que 30 s no HEAD não aperta o caso que a tirou: o piso é o prazo padrão.
 */
export function prazoContado(caso: CasoMedido, prazosDoHeadPorTitulo: ReadonlyMap<string, number>): number {
  const titulo = caso.titulo.split(' › ').at(-1) ?? caso.titulo
  const doHead = prazosDoHeadPorTitulo.get(titulo) ?? PRAZO_PADRAO_DO_CASO_DE_E2E_MS
  return Math.min(caso.prazoMs, Math.max(PRAZO_PADRAO_DO_CASO_DE_E2E_MS, doHead))
}

/** O limite do caso: metade do prazo com que é medido, porque o runner leva perto do dobro. */
export function limiteDoCaso(caso: CasoMedido, prazosDoHeadPorTitulo: ReadonlyMap<string, number>): number {
  return prazoContado(caso, prazosDoHeadPorTitulo) / 2
}

/** Os que passaram do limite, do mais lento para o mais rápido. Exatamente no limite ainda cabe. */
export function casosLentos(casos: readonly CasoMedido[], limiteDe: (caso: CasoMedido) => number = () => LIMITE_DO_CASO_DE_E2E_MS): CasoMedido[] {
  return casos.filter((caso) => caso.duracaoMs > limiteDe(caso)).sort((a, b) => b.duracaoMs - a.duracaoMs)
}

function segundos(ms: number): string {
  return (ms / 1000).toFixed(1).replace('.', ',')
}

export function avisoDosCasosLentos(lentos: readonly CasoMedido[], limiteDe: (caso: CasoMedido) => number): string {
  const linhas = lentos.map(
    (caso) => `  ${caso.arquivo}:${String(caso.linha)} (${caso.projeto}) levou ${segundos(caso.duracaoMs)} s (limite ${segundos(limiteDe(caso))} s) — ${caso.titulo}`,
  )
  return (
    `${String(lentos.length)} caso(s) de e2e alterado(s) acima da metade do prazo nesta máquina; no runner da esteira ` +
    `eles levam perto do dobro, e o prazo é de 30 s no caso sem prazo próprio:\n${linhas.join('\n')}\n` +
    'Encurte o caso (semeie o dado pela API em vez de pela tela, tire a espera que não prova nada) ou divida-o em dois. ' +
    'O prazo declarado só vale se já estava no HEAD: `test.slow()` posto agora não aumenta o limite.'
  )
}

/**
 * Dos casos que o diff tocou, os que só mudaram de comentário: o trecho sem comentário (`casosDoSpec`: do título ao próximo `test(`, o
 * mesmo que `casosAlterados` atribui ao caso, com o `beforeEach` ou o `test.use` que vem depois dele) é igual ao do mesmo caso no HEAD,
 * no mesmo arquivo. O par se acha pelo título, e só quando é único dos dois lados; sem par (arquivo novo, título novo, título de modelo
 * que o `casosDoSpec` pula, título repetido) o caso fica de fora daqui e continua alterado: cobra mais, nunca menos.
 */
function casosSoComComentarioAlterado(raiz: string, casos: readonly CasoMedido[]): Set<CasoMedido> {
  const textosDe = (arquivo: string): { arvore: CasoDoSpec[]; head: CasoDoSpec[] } => {
    try {
      const head = execFileSync('git', ['show', `HEAD:${arquivo}`], { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
      return { arvore: casosDoSpec(readFileSync(join(raiz, arquivo), 'utf8')), head: casosDoSpec(head) }
    } catch {
      // Arquivo sem `HEAD:<arquivo>` (novo, ou movido para cá) ou que a árvore não lê: sem par, e o caso fica na régua.
      return { arvore: [], head: [] }
    }
  }
  const iguais = new Set<CasoMedido>()
  // Um arquivo por vez: o `git show` e a leitura rodam uma vez por spec, e não uma vez por caso tocado.
  for (const arquivo of new Set(casos.map((medido) => medido.arquivo))) {
    const textos = textosDe(arquivo)
    for (const medido of casos.filter((outro) => outro.arquivo === arquivo)) {
      // O título medido leva o do `describe` na frente (`suite › caso`); o do spec é o último pedaço, e pode ter ` › ` dentro dele.
      const [daArvore, ...outrosDaArvore] = textos.arvore.filter((c) => medido.titulo === c.titulo || medido.titulo.endsWith(` › ${c.titulo}`))
      if (daArvore === undefined || outrosDaArvore.length > 0) continue
      const [doHead, ...outrosDoHead] = textos.head.filter((c) => c.titulo === daArvore.titulo)
      if (doHead === undefined || outrosDoHead.length > 0) continue
      if (doHead.trecho === daArvore.trecho) iguais.add(medido)
    }
  }
  return iguais
}

/**
 * O motivo de o portão da tarefa reprovar a duração do e2e que rodou, ou `null` se coube. Relatório ausente também
 * reprova: com a corrida verde ele tem de existir, e sem ele o portão não mediu nada.
 */
export function motivoDaDuracaoDoE2e(raiz: string, caminhoDoRelatorio: string): string | null {
  if (!existsSync(caminhoDoRelatorio)) {
    return `o Playwright não deixou o relatório de duração em ${caminhoDoRelatorio}: o portão não mediu os casos de e2e.`
  }
  let relatorio: RelatorioDoPlaywright
  try {
    relatorio = JSON.parse(readFileSync(caminhoDoRelatorio, 'utf8')) as RelatorioDoPlaywright
  } catch {
    return `o relatório de duração ${caminhoDoRelatorio} não é um JSON legível: o portão não mediu os casos de e2e.`
  }
  const tocados = casosAlterados(casosMedidos(relatorio), (arquivo) => alteracoesDoArquivo(raiz, arquivo))
  const soComentario = casosSoComComentarioAlterado(raiz, tocados)
  const alterados = tocados.filter((caso) => !soComentario.has(caso))
  // O HEAD só se lê quando algum caso alterado tem prazo declarado: sem isso todos medem 15 s e não há o que procurar.
  const doHead = alterados.some((caso) => caso.prazoMs > PRAZO_PADRAO_DO_CASO_DE_E2E_MS) ? prazosDoHead(raiz) : new Map<string, number>()
  const limiteDe = (caso: CasoMedido) => limiteDoCaso(caso, doHead)
  const lentos = casosLentos(alterados, limiteDe)
  return lentos.length === 0 ? null : avisoDosCasosLentos(lentos, limiteDe)
}

/** O arquivo do relatório que o portão passa ao Playwright, dentro da árvore dele. */
export function arquivoDoRelatorioDoE2e(raiz: string): string {
  return join(raiz, CAMINHO_DO_RELATORIO_DO_E2E)
}
