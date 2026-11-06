// A esteira da branch, lida sem esperar por ela. Desde 11/10/2026 a esteira roda em todo push de `spec/**` e de
// `correcao/**` (D79): é o portão completo de cada commit de tarefa, rodando no GitHub enquanto a linha segue. Este
// script responde às duas perguntas que o Orquestrador faz, sem que ele precise montar `gh` e `git` à mão.
//
//   node tools/processo/esteira.ts                 ao fechar uma tarefa: a esteira de algum commit desta branch ficou vermelha?
//   node tools/processo/esteira.ts --fechamento    no fim da spec: a esteira está verde no último commit que alterou código?
//   node tools/processo/esteira.ts --censo [branch]   algum caso de e2e passa de dois terços do prazo na última esteira verde?
//
// Sai com 0 quando dá para seguir (verde, rodando ou ainda sem execução, na pergunta da tarefa; verde, no fechamento)
// e com 1 quando não dá, dizendo o commit, a execução e os jobs que caíram. O censo sai com 0 sem nenhum caso acima de dois
// terços, com 1 listando os casos (o Orquestrador abre correção), e com 2 quando não há o que ler: sem execução verde, ou
// com fatia faltando ou de artefato expirado (diz qual).
//
// Execução cancelada: se um push mais novo da mesma branch a cancelou (o `concurrency` do `ci.yml`), ela está superada e
// não conta; sem esse push (o `timeout-minutes` de um job, um cancelamento à mão), é vermelha e o relatório cita o job.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ARQUIVO_DO_CENSO_DO_E2E, casosMedidos, PREFIXO_DO_ARTEFATO_DO_CENSO, type CasoMedido, type RelatorioDoPlaywright } from '../ci/duracao-do-e2e.ts'
import { DOCUMENTO_QUE_UMA_SUITE_LE } from './caducidade.ts'

/** `cancelada` é o que o GitHub diz; se ela é vermelha ou superada só se sabe vendo as outras (`execucoesQueValem`). */
export type EstadoDaExecucao = 'verde' | 'vermelha' | 'cancelada' | 'rodando'

export interface Execucao {
  id: number
  sha: string
  estado: EstadoDaExecucao
  criadaEm: string
  /** A branch da execução e o evento que a disparou (`push`, `pull_request`, `workflow_dispatch`). */
  branch: string
  evento: string
}

/** Um commit da branch, do mais novo para o mais antigo. `soDocumento`: nada nele roda em suíte nenhuma. */
export interface Commit {
  sha: string
  assunto: string
  soDocumento: boolean
}

export type Situacao =
  | { tipo: 'verde'; commit: Commit; execucao: Execucao }
  | { tipo: 'vermelha'; commit: Commit; execucao: Execucao; rodandoDepois?: Commit }
  | { tipo: 'rodando'; commit: Commit; execucao: Execucao }
  | { tipo: 'sem-execucao'; commit: Commit | null }

/** Arquivo que nenhuma suíte lê: documento, menos o runbook, que a guarda `alerta-tem-runbook` confere. */
export function ehSoDocumento(arquivos: readonly string[]): boolean {
  return arquivos.every((arquivo) => arquivo.endsWith('.md') && arquivo !== DOCUMENTO_QUE_UMA_SUITE_LE)
}

/** A execução que vale para um commit é a mais nova dele: reexecutar um vermelho intermitente troca o veredito. */
export function execucaoDe(sha: string, execucoes: readonly Execucao[]): Execucao | undefined {
  return execucoes.filter((execucao) => execucao.sha === sha).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))[0]
}

/**
 * Cancelada porque um push mais novo da mesma branch tomou o lugar dela (o `concurrency` do `ci.yml`, RF1): não diz
 * nada sobre o código, e o veredito é o do push que a superou. Só `push` supera: o `workflow_dispatch` e o
 * `pull_request` têm grupo próprio e nunca cancelam a execução da branch, e outra branch é outro assunto.
 */
function foiSuperada(execucao: Execucao, todas: readonly Execucao[]): boolean {
  return (
    execucao.estado === 'cancelada' &&
    todas.some(
      (outra) =>
        outra.evento === 'push' &&
        outra.branch === execucao.branch &&
        outra.criadaEm.localeCompare(execucao.criadaEm) > 0,
    )
  )
}

/**
 * As execuções que dizem alguma coisa sobre o código: a superada sai, e a cancelada que ninguém superou é vermelha.
 * Sem push novo que a explique, ela foi o `timeout-minutes` de um job (a suíte travou ou passou do teto) ou um
 * cancelamento à mão, e nos dois casos a esteira não provou o commit.
 */
export function execucoesQueValem(execucoes: readonly Execucao[]): Execucao[] {
  return execucoes
    .filter((execucao) => !foiSuperada(execucao, execucoes))
    .map((execucao): Execucao => (execucao.estado === 'cancelada' ? { ...execucao, estado: 'vermelha' } : execucao))
}

/**
 * A pergunta de quem fecha uma tarefa. O que decide é a execução terminada mais nova: vermelha, a linha para e
 * corrige antes da tarefa seguinte; verde, segue. Execução ainda rodando não segura ninguém, e é por isso que a
 * esteira por push não custa espera: o veredito dela chega uma tarefa depois, no máximo.
 */
export function situacaoDaTarefa(commits: readonly Commit[], todas: readonly Execucao[]): Situacao {
  const execucoes = execucoesQueValem(todas)
  let rodando: Extract<Situacao, { tipo: 'rodando' }> | null = null
  for (const commit of commits) {
    const execucao = execucaoDe(commit.sha, execucoes)
    if (!execucao) continue
    if (execucao.estado === 'rodando') {
      rodando ??= { tipo: 'rodando', commit, execucao }
      continue
    }
    // Com uma execução mais nova no ar, o vermelho pode já ter correção commitada: quem lê decide, e o relatório diz.
    if (execucao.estado === 'vermelha') return { tipo: 'vermelha', commit, execucao, ...(rodando ? { rodandoDepois: rodando.commit } : {}) }
    return rodando ?? { tipo: 'verde', commit, execucao }
  }
  return rodando ?? { tipo: 'sem-execucao', commit: commits[0] ?? null }
}

/**
 * A pergunta do fim da spec. O commit que precisa da esteira verde é o último que alterou código; os commits só de
 * documento que vieram depois dele (o estado antes da validação, o fechamento) não mudam o que as suítes rodam, e o
 * verde de qualquer um deles vale igual. Vermelho num commit mais antigo não conta: o código já é outro.
 */
export function situacaoDoFechamento(commits: readonly Commit[], todas: readonly Execucao[]): Situacao {
  const execucoes = execucoesQueValem(todas)
  const ateOCodigo = commits.findIndex((commit) => !commit.soDocumento)
  const candidatos = ateOCodigo === -1 ? commits : commits.slice(0, ateOCodigo + 1)
  const comExecucao = candidatos.flatMap((commit) => {
    const execucao = execucaoDe(commit.sha, execucoes)
    return execucao ? [{ commit, execucao }] : []
  })
  for (const estado of ['verde', 'rodando', 'vermelha'] as const) {
    const achado = comExecucao.find(({ execucao }) => execucao.estado === estado)
    if (achado) return { tipo: estado, ...achado }
  }
  return { tipo: 'sem-execucao', commit: candidatos.at(-1) ?? null }
}

function curto(sha: string): string {
  return sha.slice(0, 7)
}

/** O que o Orquestrador lê. Uma linha quando dá para seguir; o que fazer, quando não dá. */
export function relatorioDaEsteira(situacao: Situacao, branch: string, noFechamento: boolean, jobsVermelhos: readonly string[] = []): string {
  if (situacao.tipo === 'sem-execucao') {
    const onde = situacao.commit ? ` para ${curto(situacao.commit.sha)}` : ''
    return noFechamento
      ? `esteira de ${branch}: nenhuma execução${onde}. Confira o push; se ele foi feito, dispare: gh workflow run esteira --ref ${branch}`
      : `esteira de ${branch}: nenhuma execução ainda${onde}. Siga.`
  }
  const { commit, execucao } = situacao
  const alvo = `${curto(commit.sha)} (${commit.assunto}), execução ${String(execucao.id)}`
  if (situacao.tipo === 'verde') return `esteira de ${branch}: verde em ${alvo}.${noFechamento ? ' De lá à ponta só mudou documento.' : ' Siga.'}`
  if (situacao.tipo === 'rodando') {
    return noFechamento
      ? `esteira de ${branch}: ainda rodando em ${alvo}. Espere: gh run watch ${String(execucao.id)} --exit-status`
      : `esteira de ${branch}: rodando em ${alvo}. Siga; o veredito se lê ao fechar a próxima tarefa.`
  }
  const jobs = jobsVermelhos.length > 0 ? `\nJobs que caíram: ${jobsVermelhos.join('; ')}` : ''
  const depois =
    situacao.tipo === 'vermelha' && situacao.rodandoDepois
      ? `\nHá execução mais nova rodando, em ${curto(situacao.rodandoDepois.sha)} (${situacao.rodandoDepois.assunto}): se esse commit já é a correção deste vermelho, siga e leia de novo ao fechar a próxima tarefa.`
      : ''
  return (
    `esteira de ${branch}: VERMELHA em ${alvo}.${jobs}${depois}\n` +
    `É correção na branch, antes da tarefa seguinte; o documento dela diz de qual tarefa foi. Detalhe: gh run view ${String(execucao.id)} --log-failed`
  )
}

/** As fatias do e2e na matriz do `ci.yml` (`tools/ci/esteira.test.ts` confere que são as mesmas). */
export const FATIAS_DO_E2E = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

/** O caso do censo passa de dois terços do prazo que a esteira lhe deu: o runner oscila, e a folga que sobra é de um terço. */
export function acimaDeDoisTercos(caso: Pick<CasoMedido, 'duracaoMs' | 'prazoMs'>): boolean {
  return caso.duracaoMs * 3 > caso.prazoMs * 2
}

export interface CasoDoCenso extends CasoMedido {
  fatia: number
}

/** Os casos acima de dois terços do prazo em todas as fatias, do mais perto do prazo para o mais longe. */
export function casosDoCenso(fatias: readonly { fatia: number; relatorio: RelatorioDoPlaywright }[]): CasoDoCenso[] {
  return fatias
    .flatMap(({ fatia, relatorio }) => casosMedidos(relatorio).filter(acimaDeDoisTercos).map((caso) => ({ ...caso, fatia })))
    .sort((a, b) => b.duracaoMs / b.prazoMs - a.duracaoMs / a.prazoMs)
}

/** A execução verde mais nova: a vermelha que veio depois dela não muda o que o censo lê. */
export function ultimaVerde(execucoes: readonly Execucao[]): Execucao | undefined {
  return execucoes.filter((execucao) => execucao.estado === 'verde').sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))[0]
}

/** O que o GitHub diz de um artefato da execução. `expired`: passou do `retention-days` e não baixa mais. */
export interface ArtefatoDoGh {
  name: string
  expired: boolean
}

/** A saída de `gh api …/actions/runs/<id>/artifacts`. */
export function artefatosDoGh(saida: string): ArtefatoDoGh[] {
  return (JSON.parse(saida) as { artifacts: ArtefatoDoGh[] }).artifacts.map(({ name, expired }) => ({ name, expired }))
}

export function argumentosDosArtefatos(execucao: number): string[] {
  return ['api', `repos/{owner}/{repo}/actions/runs/${String(execucao)}/artifacts?per_page=100`]
}

export function nomeDoArtefatoDaFatia(fatia: number): string {
  return `${PREFIXO_DO_ARTEFATO_DO_CENSO}${String(fatia)}`
}

export function argumentosDoDownloadDaFatia(execucao: number, fatia: number, pasta: string): string[] {
  return ['run', 'download', String(execucao), '--name', nomeDoArtefatoDaFatia(fatia), '--dir', pasta]
}

/** As fatias sem relatório a ler: as que não têm artefato na execução, e as que têm, mas expirado. */
export function fatiasSemRelatorio(artefatos: readonly ArtefatoDoGh[]): { faltando: number[]; expiradas: number[] } {
  const faltando: number[] = []
  const expiradas: number[] = []
  for (const fatia of FATIAS_DO_E2E) {
    const artefato = artefatos.find((candidato) => candidato.name === nomeDoArtefatoDaFatia(fatia))
    if (artefato === undefined) faltando.push(fatia)
    else if (artefato.expired) expiradas.push(fatia)
  }
  return { faltando, expiradas }
}

export function relatorioDaFatia(texto: string, fatia: number): RelatorioDoPlaywright {
  try {
    return JSON.parse(texto) as RelatorioDoPlaywright
  } catch {
    throw new Error(`o relatório da fatia ${String(fatia)} não é um JSON legível`)
  }
}

export type Censo =
  | { tipo: 'sem-verde' }
  | { tipo: 'incompleto'; execucao: Execucao; faltando: number[]; expiradas: number[] }
  | { tipo: 'lista'; execucao: Execucao; casos: CasoDoCenso[] }

/**
 * O censo da última execução verde: com todas as fatias de `FATIAS_DO_E2E` a ler, a lista dos casos acima de dois terços do prazo; com fatia
 * faltando ou expirada, nada é lido, porque lista de uma parte da suíte passaria pela suíte inteira.
 */
export function fazerOCenso(
  execucoes: readonly Execucao[],
  artefatosDe: (execucao: number) => ArtefatoDoGh[],
  relatorioDe: (execucao: number, fatia: number) => RelatorioDoPlaywright,
): Censo {
  const execucao = ultimaVerde(execucoes)
  if (execucao === undefined) return { tipo: 'sem-verde' }
  const { faltando, expiradas } = fatiasSemRelatorio(artefatosDe(execucao.id))
  if (faltando.length > 0 || expiradas.length > 0) return { tipo: 'incompleto', execucao, faltando, expiradas }
  return { tipo: 'lista', execucao, casos: casosDoCenso(FATIAS_DO_E2E.map((fatia) => ({ fatia, relatorio: relatorioDe(execucao.id, fatia) }))) }
}

export function codigoDoCenso(censo: Censo): 0 | 1 | 2 {
  if (censo.tipo !== 'lista') return 2
  return censo.casos.length === 0 ? 0 : 1
}

function segundos(ms: number): string {
  return (ms / 1000).toFixed(1).replace('.', ',')
}

export function relatorioDoCenso(censo: Censo, branch: string): string {
  if (censo.tipo === 'sem-verde') return `censo do e2e de ${branch}: nenhuma execução verde da esteira para ler.`
  const alvo = `execução ${String(censo.execucao.id)} (${curto(censo.execucao.sha)})`
  if (censo.tipo === 'incompleto') {
    const faltando = censo.faltando.length > 0 ? ` Fatia(s) sem artefato: ${censo.faltando.join(', ')}.` : ''
    const expiradas = censo.expiradas.length > 0 ? ` Fatia(s) com artefato expirado: ${censo.expiradas.join(', ')}.` : ''
    return `censo do e2e de ${branch}: a ${alvo} não tem o relatório de todas as fatias.${faltando}${expiradas} Uma execução verde mais nova o tem: gh workflow run esteira --ref ${branch}`
  }
  if (censo.casos.length === 0) return `censo do e2e de ${branch}, ${alvo}: nenhum caso acima de dois terços do prazo.`
  const linhas = censo.casos.map(
    (caso) =>
      `  ${caso.arquivo}:${String(caso.linha)} (${caso.projeto}, fatia ${String(caso.fatia)}) levou ${segundos(caso.duracaoMs)} s de ${segundos(caso.prazoMs)} s — ${caso.titulo}`,
  )
  return `censo do e2e de ${branch}, ${alvo}: ${String(censo.casos.length)} caso(s) acima de dois terços do prazo.\n${linhas.join('\n')}`
}

/** A branch do `--censo [branch]`: o argumento que vem depois dele, ou a atual. */
export function branchDoCenso(argumentos: readonly string[], atual: string): string {
  const seguinte = argumentos[argumentos.indexOf('--censo') + 1]
  return seguinte === undefined || seguinte.startsWith('--') ? atual : seguinte
}

/**
 * Baixa o relatório de uma fatia numa pasta à parte, lê e apaga a pasta: nada do artefato fica na máquina. `baixar` roda o
 * `gh` com os argumentos que recebe; o artefato chega como o arquivo `ARQUIVO_DO_CENSO_DO_E2E` dentro de `--dir`.
 */
export function baixarORelatorio(execucao: number, fatia: number, baixar: (argumentos: string[]) => void): RelatorioDoPlaywright {
  const pasta = mkdtempSync(join(tmpdir(), 'censo-do-e2e-'))
  try {
    baixar(argumentosDoDownloadDaFatia(execucao, fatia, pasta))
    return relatorioDaFatia(readFileSync(join(pasta, ARQUIVO_DO_CENSO_DO_E2E), 'utf8'), fatia)
  } finally {
    rmSync(pasta, { recursive: true, force: true })
  }
}

function executar(comando: string, argumentos: string[], raiz: string): string {
  return execFileSync(comando, argumentos, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function lerCommits(raiz: string, quantos: number): Commit[] {
  return executar('git', ['log', `-${String(quantos)}`, '--format=%H%x09%s'], raiz)
    .split('\n')
    .filter((linha) => linha !== '')
    .map((linha) => {
      const [sha = '', assunto = ''] = linha.split('\t')
      // Contra o primeiro pai: o merge da `develop` na branch traz código, e `diff-tree` de merge não lista nada.
      const temPai = executar('git', ['rev-list', '--parents', '-n', '1', sha], raiz).trim().split(' ').length > 1
      const arquivos = temPai ? executar('git', ['diff', '--name-only', `${sha}^1`, sha], raiz).split('\n').filter((arquivo) => arquivo !== '') : ['raiz']
      return { sha, assunto, soDocumento: ehSoDocumento(arquivos) }
    })
}

interface ExecucaoDoGh {
  databaseId: number
  headSha: string
  status: string
  conclusion: string | null
  createdAt: string
  event: string
  headBranch: string
}

/**
 * Os campos que o `gh run list` devolve e este script lê; o fixture gravado tem exatamente estes. `actor` e
 * `displayTitle` ficam de fora de propósito: são o login de quem fez o push e o texto livre do commit (regra 20,
 * item 9), e nada aqui precisa deles. Quem ampliar a lista ou regravar o fixture mantém os dois fora.
 */
export const CAMPOS_DA_EXECUCAO = 'databaseId,headSha,status,conclusion,createdAt,event,headBranch'

/**
 * Os eventos cujo resultado é o veredito de um commit da branch: o `push` e a execução manual, que é o que o relatório
 * manda disparar quando o push não gerou execução. O `pull_request` fica de fora (RF19): ele roda a esteira para quem
 * revisa o PR, num grupo de `concurrency` próprio, e o resultado dele não é o do commit na branch da linha.
 */
export const EVENTOS_DO_VEREDITO = ['push', 'workflow_dispatch'] as const

/** Uma chamada por evento: o `gh run list` só filtra por um. */
export function argumentosDaListaDeExecucoes(branch: string, evento: (typeof EVENTOS_DO_VEREDITO)[number]): string[] {
  return ['run', 'list', '--workflow', 'esteira', '--branch', branch, '--event', evento, '--limit', '30', '--json', CAMPOS_DA_EXECUCAO]
}

export function estadoDaExecucao(execucao: Pick<ExecucaoDoGh, 'status' | 'conclusion'>): EstadoDaExecucao {
  if (execucao.status !== 'completed') return 'rodando'
  if (execucao.conclusion === 'cancelled') return 'cancelada'
  return execucao.conclusion === 'success' ? 'verde' : 'vermelha'
}

/** A saída do `gh run list --json`, já no formato que as situações leem. */
export function execucoesDoGh(saida: string): Execucao[] {
  return (JSON.parse(saida) as ExecucaoDoGh[]).map((execucao) => ({
    id: execucao.databaseId,
    sha: execucao.headSha,
    estado: estadoDaExecucao(execucao),
    criadaEm: execucao.createdAt,
    branch: execucao.headBranch,
    evento: execucao.event,
  }))
}

/** Os jobs de uma execução que não passaram: o cancelado por prazo entra, o pulado não. Saída do `gh run view --json jobs`. */
export function jobsQueNaoPassaram(saida: string): string[] {
  return (JSON.parse(saida) as { jobs: { name: string; conclusion: string | null }[] }).jobs
    .filter((job) => job.conclusion !== 'success' && job.conclusion !== 'skipped')
    .map((job) => job.name)
}

/** Só a execução que deu o veredito vermelho tem os jobs lidos: os da superada não aparecem, e nem são pedidos ao GitHub. */
export function jobsQueCairam(situacao: Situacao, lerJobs: (execucao: number) => string[]): string[] {
  return situacao.tipo === 'vermelha' ? lerJobs(situacao.execucao.id) : []
}

if (import.meta.filename === process.argv[1]) {
  const raiz = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd()
  const noFechamento = process.argv.includes('--fechamento')
  try {
    const atual = executar('git', ['rev-parse', '--abbrev-ref', 'HEAD'], raiz).trim()
    if (process.argv.includes('--censo')) {
      const alvo = branchDoCenso(process.argv, atual)
      const execucoes = EVENTOS_DO_VEREDITO.flatMap((evento) => execucoesDoGh(executar('gh', argumentosDaListaDeExecucoes(alvo, evento), raiz)))
      const censo = fazerOCenso(
        execucoes,
        (id) => artefatosDoGh(executar('gh', argumentosDosArtefatos(id), raiz)),
        (id, fatia) =>
          baixarORelatorio(id, fatia, (argumentos) => {
            executar('gh', argumentos, raiz)
          }),
      )
      process.stdout.write(`${relatorioDoCenso(censo, alvo)}\n`)
      process.exit(codigoDoCenso(censo))
    }
    const branch = atual
    const commits = lerCommits(raiz, 30)
    const execucoes = EVENTOS_DO_VEREDITO.flatMap((evento) => execucoesDoGh(executar('gh', argumentosDaListaDeExecucoes(branch, evento), raiz)))
    const situacao = noFechamento ? situacaoDoFechamento(commits, execucoes) : situacaoDaTarefa(commits, execucoes)
    const jobs = jobsQueCairam(situacao, (id) => jobsQueNaoPassaram(executar('gh', ['run', 'view', String(id), '--json', 'jobs'], raiz)))
    process.stdout.write(`${relatorioDaEsteira(situacao, branch, noFechamento, jobs)}\n`)
    const segue = noFechamento ? situacao.tipo === 'verde' : situacao.tipo !== 'vermelha'
    process.exit(segue ? 0 : 1)
  } catch (erro) {
    // Sem GitHub não há veredito, e isso não é verde. Quem decide o que fazer é quem chamou: no fechamento, o portão
    // completo local (`node tools/processo/portao-local.ts --e2e --infra`) vale no lugar.
    process.stdout.write(`esteira: não consegui ler o GitHub (${erro instanceof Error ? (erro.message.split('\n')[0] ?? '') : String(erro)}).\n`)
    process.exit(2)
  }
}
