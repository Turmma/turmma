// Ler do comando do Bash o `git commit` e o `git push`: o commit, os arquivos que ele leva, a árvore em que roda (`-C`, `cd`),
// e o push do time.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

// `git commit` em posição de comando: início, ou depois de ; & | ( ou quebra de linha. Texto
// dentro de string (echo, grep no log) não é commit.
export function ehCommit(comando: string): boolean {
  return GIT_COMMIT.test(comando)
}

const semAspas = (token: string) => token.replace(/^["']|["']$/g, '')

// Os arquivos que o commit vai levar, pelo que o próprio comando prepara: `git add <caminhos>`,
// `git add -A`, `git commit -a`. O que já estava no índice entra por `preparados`.
export function arquivosDoCommit(comando: string, raiz: string, alterados: string[], preparados: string[]): string[] {
  const levados = new Set(preparados)
  for (const achado of comando.matchAll(/git(?:\s+-[Cc]\s+\S+)*\s+add\b([^;&|\n]*)/g)) levarOsDoAdd(achado[1] ?? '', raiz, alterados, levados)
  for (const achado of comando.matchAll(/git(?:\s+-[Cc]\s+\S+)*\s+commit\b([^;&|\n]*)/g)) levarTodosSeCommitA(achado[1] ?? '', alterados, levados)
  return [...levados]
}

/** Os caminhos de um `git add`: `-A`, `.` e afins levam tudo; uma pasta leva o que há debaixo dela. */
function levarOsDoAdd(argumentos: string, raiz: string, alterados: string[], levados: Set<string>): void {
  for (const bruto of argumentos.trim().split(/\s+/).filter(Boolean)) {
    const token = semAspas(bruto)
    if (['-A', '--all', '.', ':/', '-u', '--update'].includes(token)) alterados.forEach((arquivo) => levados.add(arquivo))
    if (token.startsWith('-')) continue
    const relativo = token.startsWith(`${raiz}/`) ? token.slice(raiz.length + 1) : token.replace(/^\.\//, '')
    const pasta = relativo.replace(/\/$/, '')
    alterados.filter((arquivo) => arquivo === pasta || arquivo.startsWith(`${pasta}/`)).forEach((arquivo) => levados.add(arquivo))
  }
}

/** As opções de um `git commit`, até a mensagem: `-a` e `--all` levam tudo o que está alterado. */
function levarTodosSeCommitA(argumentos: string, alterados: string[], levados: Set<string>): void {
  for (const token of argumentos.trim().split(/\s+/)) {
    if (!token.startsWith('-')) break
    if (token === '--all' || (/^-[a-zA-Z]+$/.test(token) && token.includes('a'))) alterados.forEach((arquivo) => levados.add(arquivo))
    if (/^-[a-zA-Z]*[mF]$/.test(token) || token === '--message' || token === '--file' || token.startsWith('--message=')) break
  }
}

/** As duas marcas que dizem que o commit é de tarefa ou de correção. Quem as lê (o hook, o `linhas.ts`, a esteira) lê estas. */
export const MARCA_DE_CORRECAO = /\(correção ([a-z0-9-]+)\)/
export const MARCA_DE_TAREFA = /\(tarefa (\d+)\.0\)/

/**
 * O documento que a marca da mensagem cita: `(correção <slug>)` ou `(tarefa N.0)`. A mensagem é o texto inteiro do commit,
 * o do comando mais o do arquivo de `-F`, e no git hook nativo é só a mensagem. `null` quando não há marca.
 */
export function documentoDaMensagem(mensagem: string, raiz: string, arquivos: string[]): { caminho: string } | { erro: string } | null {
  const correcao = MARCA_DE_CORRECAO.exec(mensagem)?.[1]
  if (correcao) {
    const caminho = join('tasks', 'correcoes', `${correcao}.md`)
    return existsSync(join(raiz, caminho)) ? { caminho } : { erro: `A correção ${correcao} não tem ${caminho}. Crie o documento com /corrigir.` }
  }
  const numero = MARCA_DE_TAREFA.exec(mensagem)?.[1]
  if (!numero) return null
  const pastaTasks = join(raiz, 'tasks')
  const candidatas = existsSync(pastaTasks)
    ? readdirSync(pastaTasks).filter((pasta) => pasta.startsWith('prd-') && existsSync(join(pastaTasks, pasta, `${numero}_task.md`)))
    : []
  const escolher = (filtro: (pasta: string) => boolean) => candidatas.filter(filtro)
  const escolhidas = [
    escolher((pasta) => mensagem.includes(`tasks/${pasta}/`)),
    candidatas,
    escolher((pasta) => arquivos.some((arquivo) => arquivo.startsWith(`tasks/${pasta}/`))),
  ].find((lista) => lista.length === 1)
  if (!escolhidas?.[0]) return { erro: `Não sei a qual funcionalidade pertence a tarefa ${numero}.0. Cite tasks/prd-<funcionalidade>/ no comando.` }
  return { caminho: join('tasks', escolhidas[0], `${numero}_task.md`) }
}

/** A branch em que a árvore está. Funciona em repositório sem commit; com o HEAD solto, devolve vazio. */
export function branchAtual(raiz: string): string {
  try {
    return execFileSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

/** O maior arquivo que `git show` devolve inteiro: acima do padrão do Node (1 MB), o arquivo que cita uma regra deixaria de ser lido e a citação se perderia. */
export const LIMITE_DE_LEITURA_DO_GIT = 64 * 1024 * 1024

/**
 * O conteúdo de um arquivo como está no HEAD, ou `null` quando ele não está lá (arquivo novo, ou repositório sem commit). `null`
 * é também o que o `git show` que falha produz (arquivo acima de `LIMITE_DE_LEITURA_DO_GIT`, erro do git): a citação de regra
 * dele não é vista, e o guardião que ela somaria só vem pelo índice.
 */
export function conteudoDoHead(raiz: string): (arquivo: string) => string | null {
  return (arquivo) => {
    try {
      return execFileSync('git', ['show', `HEAD:${arquivo}`], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: LIMITE_DE_LEITURA_DO_GIT })
    } catch {
      return null
    }
  }
}

/**
 * Há um merge em curso na árvore (`MERGE_HEAD` existe). Qualquer falha do `git rev-parse` conta como "sem merge", **de propósito**:
 * é a direção segura, porque `arquivosPreparados` passa a contar o índice inteiro contra o HEAD e o portão cobra mais revisores, e
 * nunca menos.
 */
export function mergeEmCurso(raiz: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] })
    return true
  } catch {
    return false
  }
}

/**
 * Os arquivos que o índice tem de diferente de `contra` (o HEAD, sem ele), sem detectar rename: o que sai e o que entra contam os dois.
 * O stderr do git é capturado (`pipe`) e não sai no terminal: se o git falha, a mensagem dele vai no erro lançado, como no helper que
 * o `hook-git.ts` tinha. O `ignore` de `conteudoDoHead` descartaria a mensagem.
 */
function diferencasDoIndice(raiz: string, contra: string[]): string[] {
  return execFileSync('git', ['diff', '--cached', '--name-only', '--no-renames', '-z', ...contra], {
    cwd: raiz,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: LIMITE_DE_LEITURA_DO_GIT,
  })
    .split('\0')
    .filter(Boolean)
}

/**
 * Os arquivos do índice, que o commit leva. Sem detectar rename (`--no-renames`): o caminho de origem de um arquivo movido conta, e
 * mover um repository para fora do padrão não esconde o guardião que ele pedia. Com um merge em curso, só o que diverge dos **dois**
 * lados: o conflito resolvido à mão e o arquivo que as duas linhas tocaram. O que veio do outro lado sem mudar já passou pelos
 * revisores na linha de onde veio.
 *
 * **A conta supõe essa premissa e não a prova**: um arquivo só do outro lado é tratado como já revisto. Ela vale para as linhas e a
 * spec do Maestri, cujos commits passam pelo git hook. Não vale para uma branch com commit do Joaquim ou do Orquestrador (o hook
 * não julga essas sessões) nem para commit feito com `--no-verify` fora de papel; o que cobre esse caso é a conferência de entrega
 * antes de a branch entrar na base (`conferirEntrega`, `tools/processo/linhas.ts`) e a terceira camada, a esteira. Por isso a
 * função não basta sozinha como garantia de revisão. É a conta única do `PreToolUse` (`portao.ts`) e do git hook (`hook-git.ts`): as duas camadas
 * têm de cobrar os mesmos guardiões pelo mesmo commit.
 */
export function arquivosPreparados(raiz: string): string[] {
  const doCommit = diferencasDoIndice(raiz, [])
  if (!mergeEmCurso(raiz)) return doCommit
  const doOutroLado = new Set(diferencasDoIndice(raiz, ['MERGE_HEAD']))
  return doCommit.filter((arquivo) => doOutroLado.has(arquivo))
}

const CAMINHO = String.raw`(?:"[^"]+"|'[^']+'|[^\s;&|()]+)`
const ATRIBUICOES = String.raw`(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*`
/** `git commit` em posição de comando, com as opções `-C`/`-c` que vêm antes dele no grupo 1. */
const GIT_COMMIT = new RegExp(String.raw`(?:^|[;&|(\n])\s*${ATRIBUICOES}git((?:\s+-[Cc]\s+${CAMINHO})*)\s+commit\b`)

/** O git que pode vir antes do commit no mesmo comando: o que prepara (inclusive a deleção, com `rm`) ou só lê, e não traz conteúdo novo para a árvore. */
const GIT_QUE_SO_PREPARA = ['add', 'rm', 'status', 'diff', 'log', 'show', 'rev-parse', 'fetch', 'branch']

/** Os comandos do shell que vêm antes do `git commit`, um por trecho, e as opções do próprio commit. */
function trechosAntesDoCommit(comando: string, padrao: RegExp = GIT_COMMIT): { trechos: string[]; opcoes: string } | null {
  const commit = padrao.exec(comando)
  if (!commit) return null
  const trechos = comando
    .slice(0, commit.index)
    .replace(/[;&|(\s]+$/, '')
    .split(/&&|\|\||;|\n/)
    .map((trecho) => trecho.trim().replace(/^\(+\s*/, ''))
    .filter((trecho) => trecho !== '' && !trecho.startsWith('#'))
  return { trechos, opcoes: commit[1] ?? '' }
}

/**
 * O trecho do comando que faz outra coisa antes do `git commit`, ou `null` quando ele só muda de pasta, guarda um
 * caminho numa variável e prepara.
 *
 * O hook roda ANTES do comando: lê a árvore como ela está, e é contra ela que confere a marca, as rodadas e o
 * carimbo. Arquivo criado ou alterado no mesmo comando do commit entra no commit sem ter sido visto. Na prova de
 * 08/10/2026, `echo … > apps/x && git add apps/x && git commit` levou código para a branch sem marca nenhuma, e o
 * mesmo vale para o commit marcado: o que o comando altera depois da última rodada não caduca ninguém. Por isso o
 * comando do commit não faz mais nada antes dele.
 */
export function antesDoCommit(comando: string): string | null {
  const antes = trechosAntesDoCommit(comando)
  if (!antes) return null
  const atribuicao = /^[A-Za-z_][A-Za-z0-9_]*=(?:"[^"$`]*"|'[^']*'|[^\s`$()<>|"']*)$/
  const cd = new RegExp(`^cd\\s+${CAMINHO}$`)
  // No resto do comando do git, `$VAR` passa e `$(…)` não: substituição de comando roda qualquer coisa.
  const git = new RegExp(String.raw`^${ATRIBUICOES}git(?:\s+--no-pager)?(?:\s+-[Cc]\s+${CAMINHO})*\s+([a-z-]+)\b(?:[^<>|$\x60]|\$(?!\())*$`)
  for (const trecho of antes.trechos) {
    if (atribuicao.test(trecho) || cd.test(trecho)) continue
    const subcomando = git.exec(trecho)?.[1]
    if (subcomando && GIT_QUE_SO_PREPARA.includes(subcomando)) continue
    return trecho.length > 90 ? `${trecho.slice(0, 87)}…` : trecho
  }
  return null
}

/** O caminho como o shell o entregaria: sem aspas, com `~` e as variáveis atribuídas no próprio comando. `null` quando depende de algo que o hook não sabe. */
function expandirCaminho(bruto: string, variaveis: Map<string, string>): string | null {
  const texto = semAspas(bruto)
    .replace(/^~(?=\/|$)/, homedir())
    .replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (tudo, nome: string) => variaveis.get(nome) ?? tudo)
  return /[$`]/.test(texto) ? null : texto
}

/** O que os trechos antes do commit atribuem a variáveis (`F=/x`) e os caminhos dos `cd`, na ordem em que aparecem. */
function variaveisECaminhosDosTrechos(trechos: string[]): { variaveis: Map<string, string>; caminhos: string[] } {
  const variaveis = new Map<string, string>()
  const caminhos: string[] = []
  for (const trecho of trechos) {
    const atribuicao = /^([A-Za-z_][A-Za-z0-9_]*)=(\S*)$/.exec(trecho)
    if (atribuicao?.[1]) variaveis.set(atribuicao[1], semAspas(atribuicao[2] ?? ''))
    const cd = new RegExp(`^cd\\s+(${CAMINHO})$`).exec(trecho)
    if (cd?.[1]) caminhos.push(cd[1])
  }
  return { variaveis, caminhos }
}

/**
 * A pasta em que o `git commit` roda: o diretório do comando, mais cada `cd` antes dele, mais o `-C` do próprio commit.
 * `indeterminado` quando um desses caminhos depende de variável que o comando não atribui: aí o hook não sabe em que
 * árvore o commit acontece, e avaliar a da sessão seria o furo que `arvoreDoCommit` fecha.
 */
export function pastaDoCommit(comando: string, raiz: string, cwd?: string, padrao: RegExp = GIT_COMMIT): { pasta: string } | { indeterminado: string } | null {
  const antes = trechosAntesDoCommit(comando, padrao)
  if (!antes) return null
  let pasta = cwd && existsSync(cwd) ? cwd : raiz
  const { variaveis, caminhos } = variaveisECaminhosDosTrechos(antes.trechos)
  for (const opcao of antes.opcoes.matchAll(new RegExp(String.raw`-C\s+(${CAMINHO})`, 'g'))) caminhos.push(opcao[1] ?? '')
  for (const bruto of caminhos) {
    const caminho = expandirCaminho(bruto, variaveis)
    if (caminho === null) return { indeterminado: bruto }
    pasta = resolve(pasta, caminho)
  }
  return { pasta }
}

function pastaDoGit(pasta: string, argumento: string): string | null {
  try {
    const saida = execFileSync('git', ['rev-parse', '--path-format=absolute', argumento], { cwd: pasta, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return saida || null
  } catch {
    return null
  }
}

/**
 * A árvore em que o commit vai acontecer, que nem sempre é a da sessão. O Orquestrador roda no térreo e fecha a spec
 * no andar dela, com `git -C <andar> commit` (D78); um agente pode ter dado `cd` para outro checkout. Avaliar esses
 * comandos contra a árvore da sessão deixaria passar código sem marca, sem revisor e sem carimbo: a sessão está limpa,
 * e é só ela que o hook veria (revisão de coerência de 08/10/2026).
 *
 * Só troca para outra árvore **do mesmo repositório**: commit em repositório alheio não é assunto deste portão.
 */
export function arvoreDoCommit(comando: string, raiz: string, cwd?: string): string {
  const onde = pastaDoCommit(comando, raiz, cwd)
  if (!onde || 'indeterminado' in onde || !existsSync(onde.pasta)) return raiz
  const arvore = pastaDoGit(onde.pasta, '--show-toplevel')
  if (!arvore || arvore === raiz) return raiz
  const repositorio = pastaDoGit(raiz, '--git-common-dir')
  return repositorio !== null && pastaDoGit(arvore, '--git-common-dir') === repositorio ? arvore : raiz
}

/** As branches que só recebem por pouso ou por merge do Joaquim (D23, D78). */
export const BRANCHES_PROTEGIDAS = ['develop', 'release', 'main']
/** Os papéis de terminal do time (`.claude/agents/`). O Orquestrador não tem papel: é o terminal Maestro do térreo. */
export const PAPEIS_DO_TIME = ['arquiteto', 'implementador', 'mesa-de-revisao', 'validador']
/** `git push` em posição de comando: as opções `-C` no grupo 1, e o resto do comando no grupo 2. */
const GIT_PUSH = new RegExp(String.raw`(?:^|[;&|(\n])\s*${ATRIBUICOES}git((?:\s+-[Cc]\s+${CAMINHO})*)\s+push\b([^;&|\n]*)`)

/**
 * A branch protegida que o `git push` do comando alcançaria, ou `null`. Sem branch escrita (`git push`, `git push origin`,
 * `HEAD`), o destino é a branch da árvore em que o push roda; `null` aí quer dizer que o hook não sabe qual é, e conta
 * como protegida: na dúvida, quem empurra é o Orquestrador.
 */
export function destinoProtegidoDoPush(comando: string, branchDaArvore: string | null): string | null {
  for (const push of comando.matchAll(new RegExp(GIT_PUSH.source, 'g'))) {
    const argumentos = [...(push[2] ?? '').matchAll(/"[^"]*"|'[^']*'|\S+/g)].map((achado) => semAspas(achado[0]))
    if (argumentos.some((argumento) => argumento === '--all' || argumento === '--mirror')) return 'todas as branches'
    const destinos = argumentos
      .filter((argumento) => !argumento.startsWith('-'))
      .slice(1)
      .map((referencia) => referencia.replace(/^\+/, '').split(':').pop() ?? '')
    for (const destino of destinos.length > 0 ? destinos : ['HEAD']) {
      const branch = destino === 'HEAD' || destino === '@' ? branchDaArvore : destino.replace(/^refs\/heads\//, '')
      if (branch === null) return 'uma branch que o hook não sabe qual é'
      if (BRANCHES_PROTEGIDAS.includes(branch)) return `\`${branch}\``
    }
  }
  return null
}

/**
 * O bloqueio do push de um agente do time numa branch protegida. A `develop` só recebe por pouso, com a palavra do
 * Joaquim, e quem executa é o Orquestrador (D78). Até 08/10/2026 isso era só regra escrita, e o time roda sozinho à
 * noite, sem pedir permissão para comando nenhum: a regra virou trava.
 *
 * O papel vem de `CLAUDE_CODE_AGENT`, que o Claude Code põe no ambiente da sessão iniciada com `--agent <papel>` e os
 * subagentes dela herdam. O Orquestrador e a sessão de uma pessoa não têm essa variável, e passam. Pousar e apagar
 * andar não entram aqui: o próprio Maestri recusa esses comandos a quem não é o terminal Maestro.
 */
export function pushDoTime(comando: string, raiz: string, cwd: string | undefined, papel: string | undefined): string | null {
  if (!ehPapelDoTime(papel) || !GIT_PUSH.test(comando)) return null
  const onde = pastaDoCommit(comando, raiz, cwd, GIT_PUSH)
  const pasta = onde && 'pasta' in onde && existsSync(onde.pasta) ? onde.pasta : null
  const destino = destinoProtegidoDoPush(comando, pasta ? branchAtual(pasta) || null : null)
  if (destino === null) return null
  return (
    `Push bloqueado: este comando empurra ${destino}, e as branches ${BRANCHES_PROTEGIDAS.join(', ')} só recebem por pouso, com a palavra do Joaquim ` +
    `(D78). Quem faz isso é o Orquestrador, não o papel \`${papel}\`. O seu push é o da branch do andar: \`git push -u origin HEAD\`, dentro do ` +
    'checkout do andar. Commit feito no térreo, na `develop`, fica sem push: o Orquestrador o leva.'
  )
}

/** O papel é de terminal do time (`.claude/agents/`): o Orquestrador e a sessão de uma pessoa não têm papel. */
export function ehPapelDoTime(papel: string | undefined): boolean {
  return papel !== undefined && PAPEIS_DO_TIME.includes(papel)
}

// Ler do comando do Bash o que ele faz com o git e com o ambiente do papel (RF14). A leitura é por palavras do shell, não
// por expressão regular sobre o texto: `--no-verify` dentro de uma mensagem para outro agente, ou `CLAUDE_CODE_AGENT` num
// `grep`, não é desvio. O que a leitura não alcança (script, `sh -c`, substituição de comando) é o limite declarado em
// `techspec.md` §5(a), e a terceira camada é a esteira.

/**
 * Um pedaço do comando: texto entre aspas duplas (`$"…"` vale o mesmo, no bash), entre aspas simples, entre `$'…'` (o texto
 * cru, sem decodificar o que há dentro), um caractere escapado por barra invertida, um separador, ou uma palavra solta. O `$`
 * só é da palavra solta quando não abre aspas: `--no-verif$'y'` são dois pedaços colados, e não `--no-verif$y`.
 */
const PEDACO_DO_SHELL = /\$?"((?:[^"\\]|\\.)*)"|'([^']*)'|\$'((?:[^'\\]|\\.)*)'|\\(.)|([;&|()\n]+)|((?:[^\s;&|()"'\\$]|\$(?!['"]))+)/g

/** O texto do pedaço: o do único grupo que casou (aspas duplas, simples, `$'…'`, o escapado ou a palavra solta). */
const textoDoPedaco = (pedaco: RegExpMatchArray): string => pedaco.slice(1).find((grupo) => grupo !== undefined) ?? ''

/**
 * Os comandos do shell de um comando do Bash, cada um em palavras. As aspas agrupam e saem do texto, e os pedaços colados
 * (`-m"x"`, `core."hooksPath"`) viram uma palavra só. `;`, `&`, `|`, parênteses e quebra de linha, fora das aspas,
 * separam um comando do outro. Fora das aspas, `\x` é `x` (como no shell) e a barra invertida antes da quebra de linha
 * some, juntando as duas linhas. O `$` só é da palavra quando não abre aspas (`$'…'`, `$"…"`).
 */
export function comandosDoShell(comando: string): string[][] {
  const comandos: string[][] = [[]]
  let fimDoPedaco = -1
  for (const pedaco of comando.replaceAll('\\\n', '').matchAll(PEDACO_DO_SHELL)) {
    if (pedaco[5] !== undefined) {
      comandos.push([])
      continue
    }
    const texto = textoDoPedaco(pedaco)
    const atual = comandos.at(-1) ?? []
    if (pedaco.index === fimDoPedaco) atual.push((atual.pop() ?? '') + texto)
    else atual.push(texto)
    fimDoPedaco = pedaco.index + pedaco[0].length
  }
  return comandos.filter((palavras) => palavras.length > 0)
}

const ATRIBUICAO = /^([A-Za-z_][A-Za-z0-9_]*)=/
const nomeAtribuido = (palavra: string): string | null => ATRIBUICAO.exec(palavra)?.[1] ?? null
const programaDe = (palavra: string): string => palavra.split('/').pop() ?? palavra
/** A variável que diz ao git hook e ao portão quem commita, e as que mudam o `core.hooksPath` sem tocar em arquivo. */
const ehVariavelDoHook = (nome: string): boolean => nome === 'CLAUDE_CODE_AGENT' || nome.startsWith('GIT_CONFIG_')
/** Os programas que só passam o comando adiante. O `env` tem leitura própria (`lerOEnv`). */
const ENVOLTORIOS = new Set(['command', 'exec', 'nohup', 'time', 'builtin'])

interface ComandoLido {
  /** As variáveis que o comando atribui, à frente dele ou pelo `env`. */
  definidos: string[]
  /** As que o `env -u` tira. */
  retirados: string[]
  programa: string
  args: string[]
}

/** As opções do `env` até o programa dele: o que atribui e o que tira. Devolve a posição do programa. */
function lerOEnv(palavras: string[], inicio: number, definidos: string[], retirados: string[]): number {
  let i = inicio
  for (; i < palavras.length; i++) {
    const palavra = palavras[i] ?? ''
    const nome = nomeAtribuido(palavra)
    if (nome !== null) definidos.push(nome)
    else if (palavra === '-u' || palavra === '--unset') retirados.push(palavras[++i] ?? '')
    else if (/^(?:-u|--unset=)./.test(palavra)) retirados.push(palavra.replace(/^(?:-u|--unset=)/, ''))
    else if (!palavra.startsWith('-')) break
  }
  return i
}

/** O comando sem o que vem antes do programa: atribuições, `env` e os envoltórios. */
function lerComando(palavras: string[]): ComandoLido {
  const definidos: string[] = []
  const retirados: string[] = []
  let i = 0
  while (i < palavras.length) {
    const palavra = palavras[i] ?? ''
    const nome = nomeAtribuido(palavra)
    const programa = programaDe(palavra)
    if (nome !== null) {
      definidos.push(nome)
      i++
    } else if (programa === 'env') i = lerOEnv(palavras, i + 1, definidos, retirados)
    else if (ENVOLTORIOS.has(programa)) i++
    else return { definidos, retirados, programa, args: palavras.slice(i + 1) }
  }
  return { definidos, retirados, programa: '', args: [] }
}

/** `VAR=`, `export VAR=`, `unset VAR` e `env -u VAR` com a variável do papel ou a do `core.hooksPath`. */
function desvioDoAmbiente(comando: ComandoLido): string | null {
  const nomes = [...comando.definidos, ...comando.retirados]
  if (comando.programa === 'unset') nomes.push(...comando.args)
  if (comando.programa === 'export') nomes.push(...comando.args.map((argumento) => nomeAtribuido(argumento) ?? argumento))
  const nome = nomes.find(ehVariavelDoHook)
  return nome === undefined ? null : `mexe em ${nome}, a variável pela qual o hook sabe quem commita e onde estão os hooks do git`
}

/**
 * As opções do git, antes do subcomando, que levam o argumento na palavra seguinte: as de `handle_options`, no `git.c`
 * (conferidas com `git --help` e uma a uma contra o git 2.56). `--super-prefix` é de git mais antigo; `--exec-path`,
 * `--list-cmds` e as que só imprimem não consomem a palavra seguinte, e a forma com `=` é uma palavra só.
 */
const OPCOES_DO_GIT_COM_ARGUMENTO = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--attr-source', '--shallow-file', '--super-prefix'])

interface ChamadaDoGit {
  /** As opções antes do subcomando, com os argumentos delas. */
  globais: string[]
  subcomando: string
  resto: string[]
}

function chamadaDoGit(comando: ComandoLido): ChamadaDoGit | null {
  if (comando.programa !== 'git') return null
  const globais: string[] = []
  let i = 0
  while ((comando.args[i] ?? '').startsWith('-')) {
    const opcao = comando.args[i] ?? ''
    const argumento = OPCOES_DO_GIT_COM_ARGUMENTO.has(opcao) ? comando.args[i + 1] : undefined
    globais.push(opcao, ...(argumento === undefined ? [] : [argumento]))
    i += argumento === undefined ? 1 : 2
  }
  return { globais, subcomando: comando.args[i] ?? '', resto: comando.args.slice(i + 1) }
}

const CAMINHO_DOS_HOOKS = /core\.hookspath/i
/** A definição de um alias do git (`-c alias.c=…`, `config alias.ci …`): é um jeito de chamar o `commit -n` sem que o comando o diga. */
const DEFINICAO_DE_ALIAS = /^(?:--config-env=)?alias\./i
/** `--no-verify` ou a abreviação que o git aceita: qualquer começo dele a partir de `--no-v`. */
const ehNoVerify = (palavra: string): boolean => palavra.length >= '--no-v'.length && '--no-verify'.startsWith(palavra)
/** As letras de `git commit` que levam argumento: o resto do bloco `-xyz` é o argumento delas, não opções. */
const LETRAS_DO_COMMIT_COM_ARGUMENTO = /[mFCctSu]/

/** `-n` de `git commit`, sozinho ou num bloco de opções (`-nm`, `-anm`); `-mn` é a mensagem "n". */
function ehNDoCommit(palavra: string): boolean {
  const letras = /^-([A-Za-z]+)$/.exec(palavra)?.[1] ?? ''
  return (letras.split(LETRAS_DO_COMMIT_COM_ARGUMENTO)[0] ?? '').includes('n')
}

/** As opções de `git config` que só dizem de onde ler ou o que mostrar: não mudam o que o comando faz com a chave. */
const ESCOPO_DE_LEITURA = new Set(['--local', '--global', '--system', '--worktree', '--show-origin', '--show-scope'])

/**
 * `git config --get core.hooksPath` (ou `--get-all`, com o escopo antes da chave): ler o caminho dos hooks não o troca, e o
 * `contexto-inicial.sh` e quem confere o checkout precisam lê-lo. Só passa a ação de leitura **primeiro** e a chave **por
 * último**: o `git config` para de ler opções na primeira palavra que não é opção, e `core.hooksPath --get` (ou
 * `core.hooksPath --local`) grava o valor `--get`. Um valor, ou outra ação junto (`--unset`, `--add`), também é a escrita.
 */
function leSoOCaminhoDosHooks(resto: readonly string[]): boolean {
  const palavras = resto.filter((palavra) => !ESCOPO_DE_LEITURA.has(palavra))
  const [acao, chave] = palavras
  return palavras.length === 2 && (acao === '--get' || acao === '--get-all') && /^core\.hookspath$/i.test(chave ?? '') && resto.at(-1) === chave
}

function defineAlias(chamada: ChamadaDoGit): boolean {
  const palavras = [...chamada.globais, ...(chamada.subcomando === 'config' ? chamada.resto : [])]
  return palavras.some((palavra) => DEFINICAO_DE_ALIAS.test(palavra))
}

function desvioDoGit(chamada: ChamadaDoGit): string | null {
  if (chamada.globais.some((opcao) => CAMINHO_DOS_HOOKS.test(opcao))) return 'troca o core.hooksPath do git, que é onde estão os hooks do processo'
  if (chamada.subcomando === 'config' && chamada.resto.some((argumento) => CAMINHO_DOS_HOOKS.test(argumento)) && !leSoOCaminhoDosHooks(chamada.resto)) {
    return 'mexe no core.hooksPath do git, que é onde estão os hooks do processo'
  }
  if (defineAlias(chamada)) return 'define um alias do git, que chama o commit sem que o comando diga se pula os hooks'
  if (chamada.resto.some(ehNoVerify)) return 'usa --no-verify, que pula os hooks do git'
  if (chamada.subcomando === 'commit' && chamada.resto.some(ehNDoCommit)) return 'usa -n, que é --no-verify no commit e pula os hooks do git'
  return null
}

/**
 * O que, no comando, desvia do hook do git em sessão de papel: `--no-verify` e abreviações, `-n` no commit, o
 * `core.hooksPath`, e tirar ou trocar `CLAUDE_CODE_AGENT` e `GIT_CONFIG_*`. `null` quando o comando não faz nada disso.
 * Quem chama decide se o papel é do time (`ehPapelDoTime`): fora dele, nada disso é desvio.
 */
export function desvioDoHook(comando: string): string | null {
  for (const palavras of comandosDoShell(comando)) {
    const lido = lerComando(palavras)
    const chamada = chamadaDoGit(lido)
    const desvio = desvioDoAmbiente(lido) ?? (chamada === null ? null : desvioDoGit(chamada))
    if (desvio !== null) return desvio
  }
  return null
}

/** `-F x` e `--file x`, com a letra sozinha ou depois de opções sem argumento (`-aF x`). */
const ARQUIVO_NA_PALAVRA_SEGUINTE = /^(?:-[aeinopqsvzN]*F|--file)$/
/** `-Fx`, `-aFx` e `--file=x`. */
const ARQUIVO_NA_MESMA_PALAVRA = /^(?:-[aeinopqsvzN]*F|--file=)(.+)$/

function arquivosDaMensagemEm(resto: string[]): string[] {
  return resto.flatMap((palavra, i) => {
    const colado = ARQUIVO_NA_MESMA_PALAVRA.exec(palavra)?.[1]
    if (colado !== undefined) return [colado]
    const proximo = resto[i + 1]
    return ARQUIVO_NA_PALAVRA_SEGUINTE.test(palavra) && proximo !== undefined ? [proximo] : []
  })
}

/** Os arquivos de mensagem dos `git commit` do comando, como estão escritos: `-F x`, `-Fx`, `--file=x`. */
export function arquivosDaMensagem(comando: string): string[] {
  return comandosDoShell(comando).flatMap((palavras) => {
    const chamada = chamadaDoGit(lerComando(palavras))
    return chamada?.subcomando === 'commit' ? arquivosDaMensagemEm(chamada.resto) : []
  })
}

/** O texto de um arquivo regular; vazio para o que não existe e para o que não é arquivo (pasta, `/dev/stdin`, fifo), que prenderia o hook. */
function lerOuVazio(caminho: string): string {
  try {
    if (!statSync(caminho).isFile()) return ''
    return readFileSync(caminho, 'utf8')
  } catch {
    return ''
  }
}

/** O texto dos arquivos de mensagem do comando, lidos a partir da pasta em que o commit roda. Arquivo que não existe é texto vazio. */
export function textoDosArquivosDeMensagem(comando: string, pasta: string): string {
  return arquivosDaMensagem(comando)
    .map((arquivo) => lerOuVazio(resolve(pasta, arquivo)))
    .join('\n')
}
