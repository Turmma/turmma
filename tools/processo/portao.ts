// O portão do commit: o que a tarefa e a correção exigem do carimbo e dos revisores, e a decisão do hook sobre o
// `git commit` e o `git push` (`portao`, chamado por `hook-revisoes.ts`).
//
// `portao` (PreToolUse do Bash): bloqueia `git commit ... (tarefa N.0)` e `git commit ... (correção
// <slug>)` enquanto algum revisor obrigatório não tiver uma rodada que ainda valha para o código
// atual, com APROVADO quando o revisor tem veto, enquanto o portão local (typecheck, lint, testes)
// não tiver passado depois da última alteração, ou enquanto a mensagem não trouxer a linha
// "Revisões:". Bloqueia também commit que leva código sem nenhuma das duas marcas.
//
// Não há terceira marca: o `(mvp: <resumo>)` da fatia do MVP de apresentação (D77) saiu na tarefa 14.0 da X7 (RF18), e o commit
// marcado com ele é código sem tarefa como qualquer outro.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  alteracaoQueCaduca,
  alteracoesDeCodigo,
  arquivosAlterados,
  arquivosQueMudaram,
  CHAVE_DO_PORTAO,
  chaveDaRodada,
  chaveSemComentarios,
  gravarInstantaneo,
  instantaneoDe,
  lerInstantaneos,
  mudouDeVerdade,
  type Alteracao,
  type Instantaneos,
} from './caducidade.ts'
import {
  antesDoCommit,
  arquivosDoCommit,
  arquivosPreparados,
  arvoreDoCommit,
  conteudoDoHead,
  desvioDoHook,
  documentoDaMensagem,
  ehCommit,
  ehPapelDoTime,
  pastaDoCommit,
  pushDoTime,
  textoDosArquivosDeMensagem,
} from './comando-git.ts'
import {
  formatarHora,
  lerRevisoes,
  REVISORES_COM_VETO,
  revisoresObrigatorios,
  tipoDoDocumento,
  type EntradaHook,
  type Revisao,
  type TipoDocumento,
} from './documento-de-revisao.ts'
import { guardioesDoCaminho, type ConteudoDe } from './guardioes-por-caminho.ts'

export { PAPEIS_DO_TIME } from './comando-git.ts'

// Código só entra por tarefa ou por correção, as duas com revisores. Em sessão de papel, o código de processo (`ehCodigoParaAEsteira`)
// também (RF16).
export const PASTAS_DE_CODIGO = ['apps/', 'packages/', 'infra/', 'e2e/']

export const CAMINHO_CARIMBO = '.processo/portao.json'

export interface Carimbo {
  inicio: string
  suites: string[]
  /** Só no portão da tarefa: o documento da tarefa ou da correção que ele achou. É o que diz de quem é o carimbo (RF17). */
  documento?: string
  /** Só no portão da tarefa: os arquivos de teste que ele rodou, além da unidade inteira. */
  alvos?: string[]
  /** As mutações que o portão da tarefa conferiu, e de que documento (`tools/processo/mutacoes.ts`). */
  mutacoes?: { documento: string; impressao: string; total: number }
}

/**
 * Conferência a mais sobre o documento do commit, que quem chama o portão entrega. Existe para este módulo não importar
 * o `mutacoes.ts`, que roda processo. O módulo que roda sozinho, antes do `npm ci`, é o `caducidade.ts`
 * (`impressaoSemComentarios`, e o teste que o copia para fora do repositório). Hoje é a das mutações (`avaliarMutacoes`),
 * entregue por `hook-revisoes.ts` e `portao-local.ts`. Recebe também os arquivos alterados da árvore, porque a exigência
 * do RF17 (produção sem mutação não recebe carimbo) depende de haver produção, e é por aqui, e não dentro do
 * `avaliarPortao`, que ela chega ao commit: o `avaliarPortao` não pode importar o `mutacoes.ts`.
 */
export type ConferenciaDoDocumento = (carimbo: Carimbo | null, documento: string, conteudo: string, alterados: string[]) => string | null

/** O portão completo: tudo, como a esteira. Roda uma vez por spec, antes da validação (D78 revista em 09/10/2026). */
export const SUITES_DO_PORTAO_COMPLETO = ['typecheck', 'lint', 'segredo', 'dependencias', 'test', 'e2e', 'infra']
/**
 * O portão da tarefa: tipos, lint, a unidade inteira e os testes de integração, de infra e de e2e que a árvore alterou.
 * `alvo` é a suíte desses arquivos; com `unidade`, vale por `test` no commit de tarefa e de correção.
 */
export const SUITES_DO_PORTAO_DA_TAREFA = ['typecheck', 'lint', 'segredo', 'dependencias', 'unidade', 'alvo']

export interface AlvosDoPortao {
  integracao: string[]
  e2e: string[]
  infra: string[]
  /** Os testes de `tools/processo/` que rodam contra um git de verdade, sem o compose (projeto `processo`, `vitest.config.ts`). */
  processo: string[]
}

/** O teste do git hook (RF14): ele entra nos alvos sempre que algo de `tools/processo/` mudou, mesmo que ele próprio não tenha mudado. */
export const TESTE_DO_GIT_HOOK = 'tools/processo/hook-git.int.test.ts'

/**
 * Os testes que o portão da tarefa roda, tirados do que está alterado na árvore: o teste novo ou mexido é o que prova a
 * regra da tarefa. O resto do sistema fica para o portão completo, no fim da spec.
 *
 * Os testes de `tools/processo/` (`*.int.test.ts`) não são de integração com o compose: vão para o projeto `processo`. E o do
 * git hook roda sempre que `tools/processo/` muda, porque ali moram o hook, o `PreToolUse` e as peças que os dois leem, e quem
 * mexe numa delas quebra o outro sem alterar o teste dele (a 11.0 da X7).
 *
 * Na noite de 08/10/2026 o portão inteiro levou de 30 a 40 minutos e foi de 70% a quase 100% do tempo de cada tarefa:
 * a 6.0 foi escrita em 6 minutos e passou cinco horas rodando o portão inteiro a cada tentativa de acertar um e2e.
 */
export function alvosDoPortao(arquivos: string[]): AlvosDoPortao {
  const fora = /(^|\/)(node_modules|dist)\/|^tools\/ci\/fixtures\//
  const validos = [...new Set(arquivos)].filter((arquivo) => !fora.test(arquivo)).sort()
  return {
    integracao: validos.filter((arquivo) => /\.int\.test\.ts$/.test(arquivo) && !arquivo.startsWith('infra/') && !arquivo.startsWith('e2e/') && !ehDoProcesso(arquivo)),
    e2e: validos.filter((arquivo) => /^e2e\/.*\.spec\.ts$/.test(arquivo)),
    infra: validos.filter((arquivo) => /^infra\/.*\.int\.test\.ts$/.test(arquivo)),
    processo: alvosDoProcesso(validos),
  }
}

const ehDoProcesso = (arquivo: string): boolean => arquivo.startsWith('tools/processo/')

/** Os testes de `tools/processo/` que mudaram, mais o do git hook quando qualquer arquivo da pasta mudou. */
function alvosDoProcesso(arquivos: string[]): string[] {
  const doProcesso = arquivos.filter(ehDoProcesso)
  const alterados = doProcesso.filter((arquivo) => /\.int\.test\.ts$/.test(arquivo))
  return [...new Set([...alterados, ...(doProcesso.length > 0 ? [TESTE_DO_GIT_HOOK] : [])])].sort()
}

/**
 * O que o commit de tarefa e de correção exige do carimbo. Até 08/10/2026 a tarefa com `frontend-reviewer` exigia o e2e
 * inteiro, e a com `infra-guardian`, a suíte de infra inteira. Agora os dois rodam inteiros uma vez, no portão completo
 * do fim da spec, e na tarefa rodam só os arquivos que ela alterou (`alvosDoPortao`).
 *
 * `segredo` (gitleaks) e `dependencias` (`npm audit`) são as duas guardas da esteira que não são teste. Levam segundos,
 * e sem elas a surpresa ficava para o fim da spec: em 09/10/2026 o gitleaks já reprovava a branch da F3, por uma linha
 * `Sort Key:` de um `EXPLAIN` colado no documento da 5.0, e ninguém saberia até a esteira do pouso.
 */
export function suitesExigidas(): string[] {
  return ['typecheck', 'lint', 'segredo', 'dependencias', 'test']
}

/** `test` vale pela suíte inteira ou, no portão da tarefa, pela unidade inteira mais os alvos. */
function carimboCobre(carimbo: Carimbo, suite: string): boolean {
  if (carimbo.suites.includes(suite)) return true
  return suite === 'test' && carimbo.suites.includes('unidade') && carimbo.suites.includes('alvo')
}

export function avaliarCarimbo(carimbo: Carimbo | null, exigidas: string[], alteracoes: Alteracao[], instantaneo?: Record<string, string>): string | null {
  const completo = exigidas.includes('e2e') || exigidas.includes('infra')
  const comando = completo ? 'node tools/processo/portao-local.ts --e2e --infra' : 'node tools/processo/portao-local.ts --tarefa'
  if (!carimbo) return `portão local: nunca passou nesta árvore. Rode \`${comando}\`.`
  const faltando = exigidas.filter((suite) => !carimboCobre(carimbo, suite))
  if (faltando.length > 0) return `portão local: o último não rodou ${faltando.join(', ')}. Rode \`${comando}\`.`
  // Em milissegundos, não em segundo inteiro: o carimbo guarda o instante com precisão de ms, e
  // truncar fazia o arquivo salvo no mesmo segundo — inclusive 39 ms **antes** do portão começar —
  // contar como alteração posterior. Custou duas rodadas de revisão no F1 (tarefas 7.0 e 16.0).
  const inicio = new Date(carimbo.inicio).getTime()
  const depois = alteracoes
    .filter((alteracao) => alteracao.quando >= inicio)
    // Sem a exceção de comentário, de propósito: comentário muda lint (`no-irregular-whitespace`) e teste que varre o
    // texto do fonte (`guardas.test.ts`, `arquitetura.test.ts`, `porta-unica.test.ts`). O carimbo só vale para o que as
    // suítes viram (`test-engineer`, retrospectiva da A0b).
    .filter((alteracao) => mudouDeVerdade(alteracao, instantaneo))
    .sort((a, b) => b.quando - a.quando)[0]
  if (depois) {
    return `portão local: ${depois.arquivo} mudou em ${formatarHora(new Date(depois.quando))}, depois do início do último (${formatarHora(new Date(carimbo.inicio))}). Rode \`${comando}\` de novo.`
  }
  return null
}

export interface ResultadoPortao {
  bloqueios: string[]
  linhaResumo: string
}

const ordinal = (n: number) => `${n}ª rodada`

/**
 * O veredito do portão do commit. Recebe os instantâneos de conteúdo (`.processo/conteudo.json`) porque a alteração
 * que interessa é a de conteúdo, não a de `mtime`: os revisores provam a guarda mutando o arquivo e restaurando, e sem
 * eles o commit ficava bloqueado para sempre depois do primeiro teste de mutação — a guarda empurrava para a revisão
 * pior (correção `2026-09-22-hook-do-commit-ignora-o-instantaneo-de-conteudo`). Sem instantâneo, de rodada antiga,
 * vale o `mtime`, que é a leitura restrita e caduca na primeira rodada nova.
 */
export function avaliarPortao(entrada: {
  obrigatorios: string[]
  revisoes: Revisao[]
  alteracoes: Alteracao[]
  carimbo: Carimbo | null
  mensagemCommit: string
  /** O documento da tarefa ou da correção, relativo à raiz: é ele que dá a chave do instantâneo de cada rodada. */
  documento: string
  /** Obrigatório de propósito: foi o parâmetro opcional, esquecido na chamada, que criou o defeito que esta assinatura fecha. */
  instantaneos: Instantaneos
}): ResultadoPortao {
  const bloqueios: string[] = []
  const resumo: string[] = []
  for (const revisor of entrada.obrigatorios) {
    const ultima = entrada.revisoes.filter((revisao) => revisao.revisor === revisor).at(-1)
    if (!ultima) {
      bloqueios.push(`${revisor}: nenhuma rodada registrada. Peça a rodada à Mesa de revisão; o prompt do revisor começa com a linha "Tarefa: <caminho do documento>".`)
      continue
    }
    resumo.push(`${revisor} ${ultima.veredito} (${ordinal(ultima.rodada)})`)
    const temVeto = REVISORES_COM_VETO.includes(revisor)
    if (temVeto && ultima.veredito !== 'APROVADO') {
      bloqueios.push(`${revisor}: a última rodada (${ultima.rodada}ª, ${ultima.fim}) terminou ${ultima.veredito}. Corrija e chame uma rodada nova.`)
      continue
    }
    const chave = chaveDaRodada(entrada.documento, revisor, ultima.rodada)
    const alteracao = alteracaoQueCaduca(revisor, ultima.inicio, entrada.alteracoes, entrada.instantaneos[chave], entrada.instantaneos[chaveSemComentarios(chave)])
    if (alteracao) {
      bloqueios.push(
        `${revisor}: ${alteracao.arquivo} mudou em ${formatarHora(new Date(alteracao.quando))}, depois do início da ${ultima.rodada}ª rodada (${ultima.inicio}). ` +
          'A revisão vale para o código que o revisor viu: chame uma rodada nova, com o diff desde a rodada aprovada.',
      )
    }
  }
  const carimbo = avaliarCarimbo(entrada.carimbo, suitesExigidas(), entrada.alteracoes, entrada.instantaneos[CHAVE_DO_PORTAO])
  if (carimbo) bloqueios.push(carimbo)
  const linhaResumo = `Revisões: ${resumo.join(', ')}`
  // A linha só é cobrada com os revisores em ordem: antes disso, o exemplo sairia incompleto.
  if (bloqueios.length === 0 && entrada.obrigatorios.length > 0 && !/^Revisões:/m.test(entrada.mensagemCommit)) {
    bloqueios.push(`A mensagem do commit precisa da linha de revisões, por exemplo:\n${linhaResumo}`)
  }
  return { bloqueios, linhaResumo }
}

/**
 * O fim do portão local: carimba, ou recusa dizendo o que mudou. Devolve o motivo da recusa, ou `null` quando
 * carimbou.
 *
 * A recusa é o que fecha a classe "valida sem prova": o instantâneo guarda o conteúdo do **início**, que é o que as
 * suítes rodaram, e arquivo editado no meio da corrida não pode entrar nele como testado. A decisão mora aqui para
 * ter teste de unidade; **onde** o conteúdo é lido é do `portao-local.ts`, e está provado pelo caso que roda o script
 * como processo contra um repositório de fixture ("o portão local, rodado como processo…", em `revisoes.test.ts`).
 */
export function carimbarSeNadaMudou(raiz: string, carimbo: Carimbo, noInicio: Alteracao[]): string | null {
  const mudaram = arquivosQueMudaram(instantaneoDe(noInicio), instantaneoDe(alteracoesDeCodigo(raiz, arquivosAlterados(raiz))))
  if (mudaram.length > 0) return `${mudaram.join(', ')} mudou enquanto o portão rodava: as suítes não provaram este conteúdo. Nenhum carimbo gravado.`
  gravarCarimbo(raiz, carimbo)
  gravarInstantaneo(raiz, CHAVE_DO_PORTAO, noInicio)
  return null
}

export function lerCarimbo(raiz: string): Carimbo | null {
  const caminho = join(raiz, CAMINHO_CARIMBO)
  if (!existsSync(caminho)) return null
  try {
    return JSON.parse(readFileSync(caminho, 'utf8')) as Carimbo
  } catch {
    return null
  }
}

export function gravarCarimbo(raiz: string, carimbo: Carimbo): void {
  mkdirSync(join(raiz, dirname(CAMINHO_CARIMBO)), { recursive: true })
  writeFileSync(join(raiz, CAMINHO_CARIMBO), `${JSON.stringify(carimbo, null, 2)}\n`)
}

/** O bloqueio do que o comando faz antes do `git commit`, ou de a árvore do commit não ser conhecida; `null` quando nenhum dos dois acontece. */
function bloqueioAntesDaArvore(comando: string, raizDaSessao: string, cwd: string | undefined): string | null {
  const estranho = antesDoCommit(comando)
  if (estranho !== null) {
    return (
      `Commit bloqueado: o comando faz outra coisa antes do \`git commit\` (${estranho}). O hook confere a árvore antes de o comando rodar, e o que ` +
      'este comando criar ou alterar entraria no commit sem ter sido conferido. Faça as alterações num comando, e o `git add` com o `git commit` em ' +
      'outro. Se o `git commit` está só dentro de um texto (uma mensagem para outro agente, o conteúdo de um arquivo), grave o texto num arquivo em ' +
      'vez de escrevê-lo no comando.'
    )
  }
  const onde = pastaDoCommit(comando, raizDaSessao, cwd)
  if (onde && 'indeterminado' in onde) {
    return (
      `Commit bloqueado: o hook não sabe em que árvore este commit acontece, porque o caminho ${onde.indeterminado} depende de uma variável que o ` +
      'comando não define. Escreva o caminho por extenso, ou atribua a variável no próprio comando (`F=/caminho; git -C "$F" commit …`).'
    )
  }
  return null
}

/** O que a decisão do commit precisa saber dele. É a mesma para as duas entradas: o `PreToolUse` do Bash e o git hook nativo. */
export interface EntradaDoCommit {
  /** O texto inteiro do commit. No `PreToolUse`, o comando mais o arquivo de `-F`; no git hook, a mensagem. */
  mensagem: string
  /** Os arquivos que o commit leva: é por eles que se vê se ele leva código. */
  arquivos: string[]
  /**
   * Os arquivos alterados da árvore: são eles que caducam as rodadas e entram na conferência das mutações. O `PreToolUse`
   * os lê do `git status`, mais largo que o commit; sem eles, valem os que o commit leva, que é o caso do git hook.
   */
  alterados?: string[]
  /**
   * O conteúdo de um arquivo no HEAD ou no índice, ou `null` quando ele não existe lá. O documento da tarefa e o texto que o
   * guardião do caminho procura (`guardioes-por-caminho.ts`) saem daqui. No `PreToolUse` o índice é o disco; o git hook entrega o índice.
   */
  conteudoDe: ConteudoDe
  /** A raiz da árvore: dela vêm o carimbo, os instantâneos (`.processo/`), as pastas de `tasks/` e a hora dos arquivos. */
  raiz: string
  /** O papel da sessão (`CLAUDE_CODE_AGENT`). As pastas de processo (RF16) só contam como código em sessão de papel (`arquivosDeCodigo`). */
  papel: string | undefined
}

/**
 * O que o commit leva de código. As pastas de produto contam em toda sessão; em sessão de papel contam também as de processo e as
 * configurações do portão (RF16), pela mesma `ehCodigoParaAEsteira` que a esteira usa: uma lista só, sem cópia (§5a, 12.0). Sem
 * papel (o Orquestrador e o Joaquim) o processo é documento, como sempre foi.
 */
const arquivosDeCodigo = (arquivos: string[], papel: string | undefined): string[] =>
  arquivos.filter((arquivo) => (ehPapelDoTime(papel) ? ehCodigoParaAEsteira(arquivo) : PASTAS_DE_CODIGO.some((pasta) => arquivo.startsWith(pasta))))

/** O commit que não cita documento: passa quando não leva código, e bloqueia quando leva. */
function bloqueioDoCommitSemDocumento(arquivos: string[], papel: string | undefined): string | null {
  const codigo = arquivosDeCodigo(arquivos, papel)
  if (codigo.length === 0) return null
  return (
    `Commit bloqueado: ele leva código (${codigo.slice(0, 3).join(', ')}${codigo.length > 3 ? ', …' : ''}) sem "(tarefa N.0)" nem "(correção <slug>)". ` +
    'Código entra por tarefa ou por correção, que passam pelos revisores (o Orquestrador conduz, com /seguir).'
  )
}

/** Código de processo (RF16): o que a esteira conta como código e não é de produto. O de produto tem a regra dele (a correção o cobra por tamanho). */
const ehCodigoDeProcesso = (arquivo: string): boolean => ehCodigoParaAEsteira(arquivo) && !PASTAS_DE_CODIGO.some((pasta) => arquivo.startsWith(pasta))

/**
 * Quem é obrigatório (RF15, RF16): a união dos marcados no documento, dos que toda tarefa e toda correção têm, dos que o caminho dos
 * `arquivos` pede e, na correção que leva código de processo, do `revisor-geral`, que a tarefa já tem sempre (a correção só o tem
 * quando o documento o marca). A exceção da tabela nunca tira quem o Arquiteto marcou. Os marcados vêm primeiro, e o portão imprime
 * esta lista. Vale em qualquer sessão: o que depende do papel é só o que conta como código sem tarefa (`arquivosDeCodigo`).
 */
export function obrigatoriosDoCommit(conteudo: string, tipo: TipoDocumento, arquivos: readonly string[], conteudoDe: ConteudoDe): string[] {
  const doProcesso = tipo === 'correcao' && arquivos.some(ehCodigoDeProcesso) ? ['revisor-geral'] : []
  return [...new Set([...revisoresObrigatorios(conteudo, tipo), ...doProcesso, ...guardioesDoCaminho(arquivos, conteudoDe)])]
}

/** A linha que o portão local imprime com os obrigatórios já unidos ao caminho. */
export function linhaDosObrigatorios(obrigatorios: readonly string[]): string {
  return `Revisores obrigatórios: ${obrigatorios.join(', ')}`
}

/** As revisões, o portão carimbado e a conferência a mais do documento que o commit cita. */
function bloqueioDoDocumento(entrada: EntradaDoCommit, alterados: string[], caminho: string, conferencia: ConferenciaDoDocumento): string | null {
  const conteudo = entrada.conteudoDe(caminho, 'indice')
  if (conteudo === null) return `Commit bloqueado: não achei ${caminho} para conferir as revisões.`
  const { bloqueios } = avaliarPortao({
    obrigatorios: obrigatoriosDoCommit(conteudo, tipoDoDocumento(caminho), entrada.arquivos, entrada.conteudoDe),
    revisoes: lerRevisoes(conteudo),
    alteracoes: alteracoesDeCodigo(entrada.raiz, alterados),
    carimbo: lerCarimbo(entrada.raiz),
    mensagemCommit: entrada.mensagem,
    documento: caminho,
    instantaneos: lerInstantaneos(entrada.raiz),
  })
  const aMais = conferencia(lerCarimbo(entrada.raiz), caminho, conteudo, alterados)
  if (aMais !== null) bloqueios.push(aMais)
  if (bloqueios.length === 0) return null
  return `Commit bloqueado: revisões de ${caminho} incompletas.\n- ${bloqueios.join('\n- ')}`
}

/**
 * A decisão do commit, inteira e sem rodar git: a marca, o documento que ela cita, os revisores obrigatórios, as pastas de
 * código, o portão carimbado e a conferência a mais do documento (a das mutações, que quem chama entrega porque este
 * módulo não importa o `mutacoes.ts`). Devolve o motivo do bloqueio, ou `null` quando o commit passa.
 *
 * O `PreToolUse` (`portao`) a chama com o que o comando e a árvore dizem; o git hook nativo a chamará com o índice (11.0).
 * Lê o disco da `raiz` em três pontos, e é divergência declarada (`10_task.md`, `techspec.md` §5a): o que o processo guarda
 * (`.processo/`, a pasta `tasks/`, o documento de correção citado); e a caducidade (`alteracoesDeCodigo`), que compara bytes
 * e hora dos arquivos de código com o carimbo, e por isso não passa por `conteudoDe`, que devolve texto: os bytes dos
 * arquivos alterados saem do disco. O `conteudoDe` lê o documento da tarefa e, dos arquivos que o commit leva, o índice e o HEAD:
 * é o texto de onde `guardioesDoCaminho` tira o `@Unscoped(` e a citação de regra.
 */
export function decidirCommit(entrada: EntradaDoCommit, conferencia: ConferenciaDoDocumento = () => null): string | null {
  const alterados = entrada.alterados ?? entrada.arquivos
  const documento = documentoDaMensagem(entrada.mensagem, entrada.raiz, alterados)
  if (!documento) return bloqueioDoCommitSemDocumento(entrada.arquivos, entrada.papel)
  if ('erro' in documento) return documento.erro
  return bloqueioDoDocumento(entrada, alterados, documento.caminho, conferencia)
}

/**
 * O conteúdo de um arquivo da árvore: o disco, que no `PreToolUse` é o que o commit vai levar, e o HEAD quando pedido; `null` quando não
 * existe ou não é arquivo (uma pasta). É o `conteudoDe` do `PreToolUse`.
 */
export function conteudoDoDisco(raiz: string): ConteudoDe {
  const doHead = conteudoDoHead(raiz)
  return (arquivo, onde) => {
    if (onde === 'head') return doHead(arquivo)
    const caminho = join(raiz, arquivo)
    return existsSync(caminho) && statSync(caminho).isFile() ? readFileSync(caminho, 'utf8') : null
  }
}

export const TERMO_FORA_DO_PROCESSO = 'Fora do processo:'
/** A linha da mensagem que dispensa a marca no commit do Joaquim (`techspec.md` §5a). */
export const LINHA_FORA_DO_PROCESSO = /^Fora do processo:/im

/**
 * Além de `PASTAS_DE_CODIGO`, o que o §5(e) da Tech Spec conta como código de processo: pastas, e os arquivos de
 * configuração do portão. A esteira (`tools/ci/conferir-entregas.ts`) não sabe se quem commitou era papel, e por isso conta
 * estes em todo commit; a `decidirCommit` os cobra só em sessão de papel (`arquivosDeCodigo`, 14.0).
 */
export const PASTAS_DE_PROCESSO = [
  'tools/',
  '.github/',
  '.claude/hooks/',
  'docs/aia/ouro/',
  'docs/aia/ouro-retido/',
]
/** Os arquivos de configuração da raiz do §5(e), pelo nome inteiro. `.claude/settings*.json` e `tsconfig*.json` são `PADROES_DE_PROCESSO`. */
export const ARQUIVOS_DE_PROCESSO = [
  'package.json',
  'compose.yaml',
  '.env.example',
  'eslint.config.mjs',
  'eslint-suppressions.json',
  'vitest.config.ts',
  'playwright.config.ts',
  'knip.json',
  '.gitleaks.toml',
  '.size-limit.json',
]
export const PADROES_DE_PROCESSO = [
  /^\.claude\/settings[^/]*\.json$/,
  /^tsconfig[^/]*\.json$/,
]

/** O arquivo é código para a esteira: de produto (`PASTAS_DE_CODIGO`) ou de processo (§5e), em qualquer sessão. */
export function ehCodigoParaAEsteira(arquivo: string): boolean {
  return (
    PASTAS_DE_CODIGO.some((pasta) => arquivo.startsWith(pasta)) ||
    PASTAS_DE_PROCESSO.some((pasta) => arquivo.startsWith(pasta)) ||
    ARQUIVOS_DE_PROCESSO.includes(arquivo) ||
    PADROES_DE_PROCESSO.some((padrao) => padrao.test(arquivo))
  )
}

/**
 * O bloqueio da linha `Fora do processo:` em qualquer sessão do Claude Code, o Orquestrador inclusive: ela é só do
 * terminal do Joaquim. No arquivo de `-F` vale a linha que começa pelo termo; no comando, o termo em qualquer lugar,
 * porque dentro de `-m "…"` o hook não separa linha de menção, e a dica é gravar a mensagem num arquivo.
 */
export function bloqueioDoForaDoProcesso(comando: string, doArquivo: string): string | null {
  const noArquivo = LINHA_FORA_DO_PROCESSO.test(doArquivo)
  if (!noArquivo && !comando.toLowerCase().includes(TERMO_FORA_DO_PROCESSO.toLowerCase())) return null
  const dica = noArquivo
    ? ''
    : ' Se o termo está na mensagem só como menção, grave a mensagem num arquivo e use `git commit -F <arquivo>`: no arquivo, só vale a linha que começa por ele.'
  return (
    `Commit bloqueado: a mensagem traz "${TERMO_FORA_DO_PROCESSO}", e essa linha é só do Joaquim, no terminal dele (D53). Sessão do Claude Code, ` +
    `o Orquestrador inclusive, não a escreve: o commit de código leva "(tarefa N.0)" ou "(correção <slug>)" e os revisores.${dica}`
  )
}

/** O bloqueio de o papel pular o git hook ou trocar o ambiente em que ele julga. */
function bloqueioDoDesvio(comando: string, papel: string | undefined): string | null {
  const desvio = ehPapelDoTime(papel) ? desvioDoHook(comando) : null
  if (desvio === null) return null
  return (
    `Comando bloqueado: ele ${desvio}. O papel \`${papel ?? ''}\` commita pelo git hook e pelo portão do commit (D53), e os dois só ` +
    'julgam o que o ambiente diz. Se um deles atrapalha, o caminho é `/seguir DIVERGÊNCIA` com `Motivo: portão`, e não o de fora dele.'
  )
}

/** O commit do `PreToolUse`: lê o comando e a árvore, monta a entrada da decisão e a chama. */
function bloqueioDoCommit(comando: string, raizDaSessao: string, cwd: string | undefined, papel: string | undefined, conferencia: ConferenciaDoDocumento): string | null {
  const raiz = arvoreDoCommit(comando, raizDaSessao, cwd)
  const onde = pastaDoCommit(comando, raizDaSessao, cwd)
  const doArquivo = textoDosArquivosDeMensagem(comando, onde && 'pasta' in onde ? onde.pasta : raiz)
  const fora = bloqueioDoForaDoProcesso(comando, doArquivo)
  if (fora !== null) return fora
  const alterados = arquivosAlterados(raiz)
  const entrada: EntradaDoCommit = {
    mensagem: `${comando}\n${doArquivo}`,
    arquivos: arquivosDoCommit(comando, raiz, alterados, arquivosPreparados(raiz)),
    alterados,
    conteudoDe: conteudoDoDisco(raiz),
    raiz,
    papel,
  }
  return decidirCommit(entrada, conferencia)
}

export function portao(
  entrada: EntradaHook,
  raizDaSessao: string,
  papel: string | undefined = process.env['CLAUDE_CODE_AGENT'],
  conferencia: ConferenciaDoDocumento = () => null,
): string | null {
  const comando = entrada.tool_input?.command ?? ''
  const desvio = bloqueioDoDesvio(comando, papel)
  if (desvio !== null) return desvio
  const push = pushDoTime(comando, raizDaSessao, entrada.cwd, papel)
  if (push !== null) return push
  if (!ehCommit(comando)) return null
  const antes = bloqueioAntesDaArvore(comando, raizDaSessao, entrada.cwd)
  if (antes !== null) return antes
  return bloqueioDoCommit(comando, raizDaSessao, entrada.cwd, papel, conferencia)
}
