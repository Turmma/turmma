import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'

/**
 * Guarda "o ponto de entrada da avaliação" (reserva-e-avaliacao, 11.0; RF14; regra 30, item 3): `tools/ia/avaliar-modelos.ts` roda à mão contra um provedor pago, e por isso não alcança, por nenhum
 * caminho de `import`, o que é de teste ou de banco, e nenhum teste o executa. Quatro cláusulas, todas lidas no **código-fonte** (sem os comentários), e não no `dist`:
 *
 * 1. **Nada de teste nem de fixture**, direto ou indireto: o arquivo e tudo o que ele importa (`from`, `import()`, `export … from`, `import 'x'`; `import type` não conta, porque some na execução) fora de
 *    `*.test.ts`, `*.spec.ts`, `*.fixture.ts`, pasta `test/`, `__fixtures__/` e o `golden.ts` (a medida e o corpus do `ouro` moram em fixture, e a ferramenta não os importa).
 * 2. **Nada de banco**: nenhum arquivo de `db/`, de `db/schema`, `*.repository` ou `repositories/`, direto ou indireto, e nenhum caminho de `db/schema` ou de repository escrito como texto (o `import()` por
 *    caminho em variável). A ferramenta carrega o núcleo pelo `dist`: a guarda segue todo caminho `packages/<pacote>/dist/<x>.js` até `packages/<pacote>/src/<x>.ts` (e `@educa/<pacote>`, pelo `exports` do
 *    `package.json`), e daí os imports relativos (`./y.js` vale `./y.ts`). O barril (o `index.js` do `dist` do núcleo, `@educa/core`) **reprova pelo grafo**, porque alcança `db/` e repository: a ferramenta carrega
 *    o núcleo módulo a módulo. No texto do próprio ponto de entrada, o uso das portas de banco do núcleo (`createPool`, `createDatabase`, `loadDatabaseConfig`, `migrate`, `*Repository`) também reprova: pega o
 *    caminho montado em variável, que o grafo não vê.
 * 3. **Sem a URL do banco**: nem `BANCO_URL` (a de `packages/core/src/db/database.ts`) nem `DATABASE_URL`; a ferramenta não abre o banco de teste nem o de ninguém.
 * 4. **Não roda quando importada** e **nenhum teste a executa**: o ponto de entrada só chama `principal` se `import.meta.url` é o `process.argv[1]`, e nenhum arquivo de teste a abre por
 *    `child_process` (o teste dela importa as funções e injeta o adaptador).
 *
 * E a guarda falha quando o alvo some: a lista vazia nunca é "nada a cobrar". Ela confere o código-fonte do que o `dist` compila: se o `dist` estiver velho, quem o carrega vê o que o `src` já não tem.
 */

export const CAMINHO_DA_FERRAMENTA = 'tools/ia/avaliar-modelos.ts'

export interface Violacao {
  readonly arquivo: string
  readonly motivo: string
}

const semOsComentarios = (texto: string): string => texto.replace(/\/\*[\s\S]*?\*\/|(^|[^:'"`])\/\/.*$/gm, '$1')

/** Arquivo de teste ou de apoio de teste: o que a ferramenta não pode alcançar. */
const DE_TESTE = /\.(?:test|spec|fixture)\.tsx?$|(?:^|\/)(?:test|e2e|__fixtures__)\//u
const GOLDEN = /(?:^|[/.])golden(?:[.-]|$)/u
const DE_BANCO = /(?:^|\/)db\/|\.repository(?:\.|\/|$)|\/repositories?\//u

const SPECIFICADORES = [/\bfrom\s+['"`]([^'"`]+)['"`]/gu, /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu, /\bimport\s+['"`]([^'"`]+)['"`]/gu, /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu]

const EXTENSOES = ['', '.ts', '.tsx', '.mts', '.js', '/index.ts']
/** No `src` o import escreve `./y.js` e o arquivo é `./y.ts` (a convenção do ESM com TypeScript). */
const DO_JS_PARA_O_TS = ['.ts', '.tsx', '/index.ts']

const comoCaminhoDaRaiz = (raiz: string, caminho: string): string => relative(raiz, caminho).split(sep).join('/')

function resolverImport(deArquivo: string, especificador: string, raiz: string): string | undefined {
  const base = resolve(raiz, dirname(deArquivo), especificador)
  const semJs = base.replace(/\.js$/u, '')
  const candidatos = [...EXTENSOES.map((extensao) => `${base}${extensao}`), ...DO_JS_PARA_O_TS.map((extensao) => `${semJs}${extensao}`)]
  const achado = candidatos.find((candidato) => existsSync(candidato) && /\.[a-z]+$/u.test(candidato))
  return achado === undefined ? undefined : comoCaminhoDaRaiz(raiz, achado)
}

/** O `src` de um pacote do repositório que o `dist` compila: `@educa/<pacote>` é o barril (`exports["."]`), `@educa/<pacote>/<sub>` o que o `exports` do `package.json` diz. `null`: não é pacote nosso. */
function resolverPacote(especificador: string, raiz: string): string | null | undefined {
  const [, pacote = '', sub] = /^@educa\/([\w-]+)(?:\/(.+))?$/u.exec(especificador) ?? []
  const manifesto = join(raiz, 'packages', pacote, 'package.json')
  if (!existsSync(manifesto)) return null
  const exportacoes = (JSON.parse(readFileSync(manifesto, 'utf8')) as { exports?: Record<string, { source?: string } | undefined> }).exports ?? {}
  const fonte = exportacoes[sub === undefined ? '.' : `./${sub}`]?.source
  return fonte === undefined ? undefined : comoCaminhoDaRaiz(raiz, resolve(raiz, 'packages', pacote, fonte))
}

/** `packages/<pacote>/dist/<x>.js` escrito no texto (o caminho que `importar(...)` recebe): é o `packages/<pacote>/src/<x>.ts` que a guarda lê. */
const CAMINHO_DO_DIST = /packages\/([\w-]+)\/dist\/([^'"`\s]+?)\.js/gu

function proibidoPeloCaminho(caminho: string): string | undefined {
  if (DE_TESTE.test(caminho)) return 'teste ou fixture'
  if (GOLDEN.test(caminho)) return 'o `golden` do `ouro`'
  if (DE_BANCO.test(caminho)) return 'banco (`db/` ou repository)'
  return undefined
}

/** O texto sem o especificador dos imports: o caminho do import já é conferido pelo arquivo que ele resolve, e o que sobra é o caminho que alguém escreveu em outro lugar (uma variável). */
function semOsEspecificadores(texto: string): string {
  return SPECIFICADORES.reduce((resto, modelo) => resto.replace(modelo, (trecho, especificador: string) => trecho.replace(especificador, '')), texto)
}

/** As portas de banco do núcleo, pelo nome: o caminho que o grafo não vê (o `import()` do módulo montado em variável) ainda deixa o nome da porta no texto. */
const PORTA_DE_BANCO = /\b(?:createPool|createDatabase|loadDatabaseConfig|migrate)\b|\b\w+Repository\b/u

/** `import type` e `export type … from` somem na execução: não entram no grafo. Só a declaração inteira: `{ … }` (em várias linhas), `* as X` ou `X`, seguida de `from`. O `export type X = Y` não casa e não engole o import da linha seguinte. */
const semImportDeTipo = (texto: string): string => texto.replace(/\b(?:import|export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s+from\s+['"`][^'"`]+['"`]/gu, '')

function violacoesDoTexto(arquivo: string, textoCompleto: string, ehOPontoDeEntrada: boolean): Violacao[] {
  const violacoes: Violacao[] = []
  const texto = semOsEspecificadores(textoCompleto)
  if (/\b(?:BANCO_URL|DATABASE_URL)\b/u.test(texto)) violacoes.push({ arquivo, motivo: 'lê `BANCO_URL` ou `DATABASE_URL`: a ferramenta não abre banco' })
  if (ehOPontoDeEntrada && PORTA_DE_BANCO.test(texto)) violacoes.push({ arquivo, motivo: 'usa uma porta de banco do núcleo (`createPool`, `createDatabase`, `loadDatabaseConfig`, `migrate` ou um `*Repository`)' })
  if (/['"`][^'"`\n]*(?:db\/schema|\.repository)[^'"`\n]*['"`]/u.test(texto)) violacoes.push({ arquivo, motivo: 'cita caminho de banco (`db/schema` ou repository) como texto: o `import()` por variável também conta' })
  if (/['"`][^'"`\n]*__fixtures__[^'"`\n]*['"`]/u.test(texto)) violacoes.push({ arquivo, motivo: 'cita caminho de `__fixtures__` como texto' })
  return violacoes
}

type Achados = { achados: string[]; violacoes: Violacao[] }

/** O que um especificador de import leva à fila: o relativo (`./y.js` vale `./y.ts`), o `@educa/<pacote>` (pelo `exports` do pacote) ou nada (um pacote de terceiros). */
function destinoDoEspecificador(arquivo: string, especificador: string, raiz: string): { achado?: string; violacao?: Violacao } {
  const naoSeResolve = { violacao: { arquivo, motivo: `o import ${especificador} não se resolve: a guarda não olha o que não acha` } }
  if (especificador.startsWith('@educa/')) {
    const fonte = resolverPacote(especificador, raiz)
    if (fonte === undefined) return naoSeResolve
    return fonte === null ? {} : { achado: fonte }
  }
  if (!especificador.startsWith('.')) return {}
  const caminho = resolverImport(arquivo, especificador, raiz)
  return caminho === undefined ? naoSeResolve : { achado: caminho }
}

/** Os caminhos que um arquivo importa e que existem; o import que não se resolve é violação (a guarda não pode deixar de olhar um arquivo). */
function importsDe(arquivo: string, texto: string, raiz: string): Achados {
  const resultado: Achados = { achados: [], violacoes: [] }
  const doTexto = semImportDeTipo(texto)
  for (const modelo of SPECIFICADORES) {
    for (const [, especificador = ''] of doTexto.matchAll(modelo)) {
      const { achado, violacao } = destinoDoEspecificador(arquivo, especificador, raiz)
      if (achado !== undefined) resultado.achados.push(achado)
      if (violacao !== undefined) resultado.violacoes.push(violacao)
    }
  }
  for (const [caminhoDoDist, pacote = '', modulo = ''] of texto.matchAll(CAMINHO_DO_DIST)) {
    const fonte = `packages/${pacote}/src/${modulo}.ts`
    if (existsSync(join(raiz, fonte))) resultado.achados.push(fonte)
    else resultado.violacoes.push({ arquivo, motivo: `o caminho ${caminhoDoDist} não tem o ${fonte} que o compila: a guarda não olha o que não acha` })
  }
  return resultado
}

export interface Alcance {
  readonly violacoes: Violacao[]
  /** Todo arquivo lido, o ponto de entrada incluído, na ordem em que a fila chegou a ele. */
  readonly arquivos: string[]
}

/** Todo arquivo que o ponto de entrada alcança, nele incluído, e o que há de errado em cada um. */
export function alcancarPontoDeEntrada(raiz: string, entrada: string = CAMINHO_DA_FERRAMENTA): Alcance {
  if (!existsSync(join(raiz, entrada))) return { violacoes: [{ arquivo: entrada, motivo: 'a ferramenta não existe: a guarda não passa em branco' }], arquivos: [] }
  const violacoes: Violacao[] = []
  const vistos = new Set<string>()
  // O `for … of` de um array percorre também o que se acrescenta a ele no meio do caminho: é a fila.
  const fila = [entrada]
  for (const arquivo of fila) {
    if (vistos.has(arquivo)) continue
    vistos.add(arquivo)
    const texto = semOsComentarios(readFileSync(join(raiz, arquivo), 'utf8'))
    const proibido = proibidoPeloCaminho(arquivo)
    if (proibido !== undefined) violacoes.push({ arquivo, motivo: `o ponto de entrada alcança ${proibido}` })
    violacoes.push(...violacoesDoTexto(arquivo, texto, arquivo === entrada))
    const { achados, violacoes: soltas } = importsDe(arquivo, texto, raiz)
    violacoes.push(...soltas)
    fila.push(...achados)
  }
  return { violacoes, arquivos: [...vistos] }
}

export const verificarPontoDeEntrada = (raiz: string, entrada: string = CAMINHO_DA_FERRAMENTA): Violacao[] => alcancarPontoDeEntrada(raiz, entrada).violacoes

/** O ponto de entrada só roda quando é o arquivo executado: importado por um teste, não chama o provedor. */
export function rodaSoQuandoExecutado(raiz: string, entrada: string = CAMINHO_DA_FERRAMENTA): Violacao[] {
  if (!existsSync(join(raiz, entrada))) return [{ arquivo: entrada, motivo: 'a ferramenta não existe: a guarda não passa em branco' }]
  const texto = semOsComentarios(readFileSync(join(raiz, entrada), 'utf8'))
  return /import\.meta\.url\s*===\s*pathToFileURL\(\s*process\.argv\[1\]\s*\)\.href/u.test(texto) ? [] : [{ arquivo: entrada, motivo: 'a ferramenta roda ao ser importada: falta a guarda `import.meta.url === pathToFileURL(process.argv[1]).href`' }]
}

/** O teste desta guarda cita a ferramenta e `child_process` nos nomes dos casos: não é um teste que a executa. */
const TESTE_DESTA_GUARDA = 'tools/guardas/ponto-de-entrada-da-avaliacao.test.ts'

export interface ArquivoLido {
  /** Caminho a partir da raiz, com `/`. */
  readonly caminho: string
  readonly texto: string
}

/** Todo jeito de abrir processo no Node passa por `child_process`. */
const ABRE_PROCESSO = /child_process/u

/** Teste que executa a ferramenta (por processo filho, ou pelo script do `package.json`): é o caminho para ela chamar o provedor de verdade. */
export function testesQueExecutamAFerramenta(arquivos: readonly ArquivoLido[], entrada: string = CAMINHO_DA_FERRAMENTA): Violacao[] {
  const nome = basename(entrada, '.ts')
  return arquivos
    .filter((arquivo) => DE_TESTE.test(arquivo.caminho) && arquivo.caminho !== TESTE_DESTA_GUARDA)
    .filter((arquivo) => {
      const texto = semOsComentarios(arquivo.texto)
      return texto.includes(nome) && ABRE_PROCESSO.test(texto)
    })
    .map((arquivo) => ({ arquivo: arquivo.caminho, motivo: 'um teste abre a ferramenta da avaliação por processo: ela chamaria o provedor pago' }))
}

const PASTAS_IGNORADAS = new Set(['node_modules', 'dist', '.git', 'build', 'coverage', '.processo', '.maestri'])

/** Todo `.ts` e `.tsx` de teste do repositório, fora as fixtures das guardas (que têm a violação de propósito). */
export function lerArquivosDeTeste(raiz: string): ArquivoLido[] {
  const lidos: ArquivoLido[] = []
  const percorrer = (pasta: string): void => {
    for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
      if (PASTAS_IGNORADAS.has(entrada.name)) continue
      const completo = join(pasta, entrada.name)
      const caminho = relative(raiz, completo).split(sep).join('/')
      if (caminho.startsWith('tools/guardas/__fixtures__')) continue
      if (entrada.isDirectory()) percorrer(completo)
      else if (/\.tsx?$/u.test(entrada.name) && DE_TESTE.test(caminho)) lidos.push({ caminho, texto: readFileSync(completo, 'utf8') })
    }
  }
  for (const base of ['apps', 'packages', 'tools', 'infra', 'e2e']) if (existsSync(join(raiz, base))) percorrer(join(raiz, base))
  return lidos
}
