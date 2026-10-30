// Linhas: tarefas da mesma spec correndo ao mesmo tempo (D79, revista em 11/10/2026).
//
//   node tools/processo/linhas.ts                          o quadro: quem faz o quê, o que está livre e o que parte agora
//   node tools/processo/linhas.ts abrir <n> <checkout>     registra a linha n, no checkout do andar dela
//   node tools/processo/linhas.ts abandonar <n>            solta a linha n: o que ela fazia deixa de ser dela
//   node tools/processo/linhas.ts partida <n> <N>          leva a linha à ponta da spec e anota a tarefa N nela
//   node tools/processo/linhas.ts partida <n> correcao:<slug>
//   node tools/processo/linhas.ts encontro <n>             traz a spec para a linha, avança a spec e faz o push
//   node tools/processo/linhas.ts fechar                   confere que tudo se encontrou e desfaz o quadro
//   node tools/processo/linhas.ts conferir [--em-curso]    no andar de uma correção avulsa: marca, revisões, árvore e push
//
// Roda sempre no andar da spec, que é onde as linhas se encontram. Uma linha é um andar com a branch
// `spec/<func>--l<n>`, o ambiente de teste `n` (`tools/ci/compose.ts`) e um par de terminais (`Implementador n` e
// `Mesa n`). O que cada linha faz fica em `.processo/linhas.json`, e não no `estado.md`: o Orquestrador limpa o
// contexto a cada tarefa, as tarefas fecham intercaladas, e o que corre junto é conta, não memória.
//
// O quadro só muda sob uma trava (`flock` em `.processo/linhas.lock`, do andar da spec). Quem muda relê o quadro depois
// de pegar a trava e grava só a própria linha: dois comandos de linhas diferentes, ao mesmo tempo, não se desfazem. O
// `abrir` é o único que larga a trava no meio: ele grava a linha como ocupada, solta a trava para o `npm ci` (minutos) e
// pega de novo para gravá-la livre.
//
// O encontro verifica antes de avançar a spec (RF3): depois do merge da spec na linha, `npm run typecheck` e `npm run lint`
// no checkout dela (com `npm ci` antes, se o lock mudou), com prazo e em grupo de processo próprio. Vermelho ou prazo: o
// grupo morre, a linha volta ao commit de antes do merge e só então a trava se solta; a spec não anda e não há push.
//
// Existe porque uma spec de 16 tarefas levou 55 horas com uma tarefa por vez (F3), e o Joaquim pediu que as tarefas
// que não se tocam corram juntas, quantas a máquina aguentar.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { MARCA_DE_CORRECAO, MARCA_DE_TAREFA } from './comando-git.ts'
import { lerDependencias, lerParalelismo, lerTarefas, PREFIXO_DA_BRANCH_DE_SPEC } from './estado.ts'

/**
 * Quantas linhas cabem na máquina: uma por ambiente de teste que não é o 0, o do térreo e da esteira
 * (`ULTIMO_AMBIENTE_DE_TESTE`, em `tools/ci/compose.ts`; o teste confere que os dois andam juntos). Não é importado
 * de lá porque aquele módulo decide o ambiente e grava arquivo ao ser carregado.
 */
export const MAXIMO_DE_LINHAS = 3
export const CAMINHO_DO_QUADRO = '.processo/linhas.json'
export const CAMINHO_DA_TRAVA = '.processo/linhas.lock'
/** Quanto quem espera a trava espera antes de desistir com "encontro em curso". */
export const PRAZO_DA_TRAVA_MS = 7 * 60 * 1000
/** O que o encontro roda no checkout da linha, depois do merge e antes de avançar a spec. */
export const COMANDO_DA_VERIFICACAO = 'npm run typecheck && npm run lint'
export const COMANDO_DE_INSTALACAO = 'npm ci'
/** O prazo da verificação, e o dela com o `npm ci` na frente (o lock mudou). Quem espera a trava espera mais que isto. */
export const PRAZO_DA_VERIFICACAO_MS = 3 * 60 * 1000
export const PRAZO_DA_VERIFICACAO_COM_NPM_CI_MS = 6 * 60 * 1000
/** Do SIGTERM ao SIGKILL no grupo da verificação. */
export const ESPERA_ATE_SIGKILL_MS = 5_000
/** Depois do SIGKILL, quanto esperar o grupo sumir antes de mexer na árvore: o sinal chega, e o processo morre um instante depois. */
const ESPERA_DEPOIS_DO_SIGKILL_MS = 1_000
/** O código de saída do encontro cuja verificação ficou vermelha ou passou do prazo: nada avançou. */
export const CODIGO_DA_VERIFICACAO = 5
const SUFIXO_DA_LINHA = '--l'

export function branchDaLinha(spec: string, numero: number): string {
  return `${spec}${SUFIXO_DA_LINHA}${String(numero)}`
}

export interface TarefaDoPlano {
  numero: number
  titulo: string
  feita: boolean
  dependeDe: number[]
  /** O que o Arquiteto autorizou, já nos dois sentidos. */
  paralelaCom: number[]
  /** Os caminhos de "Arquivos previstos" do documento. Sem nenhum, a tarefa não corre em paralelo. */
  arquivos: string[]
}

/**
 * Caminho de verdade, e não prosa: `a/b/c.ts`, a pasta de primeiro nível (`apps/`, com a barra) e o arquivo da raiz
 * (`package.json`, com extensão que tem letra: `1.0` e `v1.2` são versão, e não arquivo). A palavra solta (`e2e`) é descrição.
 */
function ehCaminhoPrevisto(candidato: string): boolean {
  return /^[\w.@-]+(\/[\w.@*[\]-]+)+\/?$/.test(candidato) || /^[\w.@-]+\/$/.test(candidato) || /^[\w@-][\w.@-]*\.[A-Za-z0-9]*[A-Za-z][A-Za-z0-9]*$/.test(candidato)
}

/**
 * Os caminhos da tabela "Arquivos previstos" de um `N_task.md`. Só o que é caminho: `apps/web/src/x.tsx`, entre
 * crases ou solto. "A casca do aluno" não diz que arquivo é, e por isso não prova que duas tarefas não se tocam.
 */
export function lerArquivosPrevistos(conteudoTask: string): string[] {
  const inicio = conteudoTask.indexOf('\n## Arquivos previstos')
  if (inicio === -1) return []
  const fim = conteudoTask.indexOf('\n## ', inicio + 1)
  const caminhos = new Set<string>()
  for (const linha of conteudoTask.slice(inicio, fim === -1 ? undefined : fim).split('\n')) {
    if (!linha.startsWith('|')) continue
    const celula = linha.split('|')[1] ?? ''
    const entreCrases = [...celula.matchAll(/`([^`]+)`/g)].map((achado) => achado[1] ?? '')
    for (const candidato of entreCrases.length > 0 ? entreCrases : [celula.trim()]) {
      if (ehCaminhoPrevisto(candidato)) caminhos.add(candidato)
    }
  }
  return [...caminhos]
}

/** Migration, schema e contrato compartilhado: o diário de migrations e os índices conflitam sempre. */
const TRONCO = [/(^|\/)drizzle\//, /\/db\/schema(\/|\.ts$)/, /^packages\/shared\//]

export function ehDoTronco(arquivo: string): boolean {
  return TRONCO.some((padrao) => padrao.test(arquivo))
}

/** `apps/web/src/areas/x/` cobre o que está dentro dela; `**` e `*` no fim valem a pasta. */
function comoPrefixo(caminho: string): string {
  return caminho.replace(/\/?\*+.*$/, '/')
}

export function seSobrepoem(um: string, outro: string): boolean {
  const [a, b] = [comoPrefixo(um), comoPrefixo(outro)]
  return a === b || (a.endsWith('/') && b.startsWith(a)) || (b.endsWith('/') && a.startsWith(b))
}

/** Por que duas tarefas não correm juntas; `null` quando correm. */
export function porQueNaoJuntas(uma: TarefaDoPlano, outra: TarefaDoPlano): string | null {
  const [a, b] = [`${String(uma.numero)}.0`, `${String(outra.numero)}.0`]
  if (!uma.paralelaCom.includes(outra.numero) && !outra.paralelaCom.includes(uma.numero)) return `o tasks.md não autoriza a ${a} em paralelo com a ${b}`
  for (const tarefa of [uma, outra]) {
    if (tarefa.arquivos.length === 0) return `a ${String(tarefa.numero)}.0 não declara caminho em "Arquivos previstos"`
  }
  for (const arquivo of uma.arquivos) {
    const comum = outra.arquivos.find((candidato) => seSobrepoem(arquivo, candidato))
    if (comum !== undefined) return `a ${a} e a ${b} preveem ${arquivo.length <= comum.length ? arquivo : comum}`
  }
  if (uma.arquivos.some(ehDoTronco) && outra.arquivos.some(ehDoTronco)) {
    return `a ${a} e a ${b} mexem em migration, schema ou contrato compartilhado`
  }
  return null
}

export interface Pendentes {
  /** Pendentes com as dependências concluídas e que correm junto com tudo o que está em curso. */
  livres: TarefaDoPlano[]
  presas: { numero: number; motivo: string }[]
}

export function situacaoDasPendentes(plano: readonly TarefaDoPlano[], emCurso: readonly number[]): Pendentes {
  const feitas = new Set(plano.filter((tarefa) => tarefa.feita).map((tarefa) => tarefa.numero))
  const correndo = plano.filter((tarefa) => emCurso.includes(tarefa.numero))
  const pendentes: Pendentes = { livres: [], presas: [] }
  for (const tarefa of plano) {
    if (tarefa.feita || emCurso.includes(tarefa.numero)) continue
    const falta = tarefa.dependeDe.filter((numero) => !feitas.has(numero))
    const motivo =
      falta.length > 0
        ? `espera ${falta.map((numero) => `${String(numero)}.0`).join(', ')}`
        : correndo.map((outra) => porQueNaoJuntas(tarefa, outra)).find((achado) => achado !== null)
    if (motivo === undefined || motivo === null) pendentes.livres.push(tarefa)
    else pendentes.presas.push({ numero: tarefa.numero, motivo })
  }
  return pendentes
}

export interface Distribuicao {
  partidas: { linha: number; tarefa: number }[]
  /** Livres que correm junto com as que partem, mas não têm linha ociosa: é o que pede abrir mais uma. */
  semLinha: number[]
}

/** Quem parte agora, na ordem da lista: cada escolhida corre junto com as em curso e com as já escolhidas. */
export function distribuir(plano: readonly TarefaDoPlano[], emCurso: readonly number[], ociosas: readonly number[]): Distribuicao {
  const distribuicao: Distribuicao = { partidas: [], semLinha: [] }
  const filaDeLinhas = [...ociosas].sort((a, b) => a - b)
  const escolhidas: TarefaDoPlano[] = []
  for (const tarefa of situacaoDasPendentes(plano, emCurso).livres) {
    if (escolhidas.some((outra) => porQueNaoJuntas(tarefa, outra) !== null)) continue
    escolhidas.push(tarefa)
    const linha = filaDeLinhas.shift()
    if (linha === undefined) distribuicao.semLinha.push(tarefa.numero)
    else distribuicao.partidas.push({ linha, tarefa: tarefa.numero })
  }
  return distribuicao
}

/**
 * O `tasks.md` com a tarefa e as subtarefas dela marcadas. É o que o encontro escreve quando o único conflito é o
 * próprio `tasks.md`: duas linhas marcaram tarefas vizinhas, e a resposta é sempre a mesma, a lista da spec com a
 * tarefa desta linha concluída.
 */
export function marcarTarefaFeita(conteudoTasks: string, numero: number): string {
  const n = String(numero)
  return conteudoTasks
    .replace(new RegExp(`^- \\[ \\] (\\*\\*${n}\\.0 — )`, 'm'), '- [x] $1')
    .replace(new RegExp(`^(\\s+)- \\[ \\] (${n}\\.\\d+\\b)`, 'gm'), '$1- [x] $2')
}

export interface Linha {
  numero: number
  checkout: string
  tarefa: number | null
  correcao: string | null
  /** Quando a linha partiu, em ISO: é o que a vigia compara com o porte da tarefa. */
  desde: string | null
  /** A branch de onde a linha parte (a da spec), gravada ao abrir: é com ela que o `conferir` compara. */
  base?: string
  /** O `abrir` gravou a linha e o `npm ci` ainda roda: a linha está em uso, mas ainda não tem onde trabalhar. */
  abrindo?: boolean
  /** De qual `abrir` é a abertura em curso: a volta dele só mexe na linha se a marca do quadro for a dele. */
  abertura?: string
}

export interface Quadro {
  spec: string
  linhas: Linha[]
}

export function lerQuadro(raiz: string): Quadro | null {
  const caminho = join(raiz, CAMINHO_DO_QUADRO)
  return existsSync(caminho) ? (JSON.parse(readFileSync(caminho, 'utf8')) as Quadro) : null
}

/** Grava por renomeação: quem lê o quadro sem a trava (o comando que só o mostra) nunca vê metade dele. */
function gravarQuadro(raiz: string, quadro: Quadro): void {
  const caminho = join(raiz, CAMINHO_DO_QUADRO)
  mkdirSync(dirname(caminho), { recursive: true })
  const provisorio = `${caminho}.${String(process.pid)}.tmp`
  writeFileSync(provisorio, `${JSON.stringify({ ...quadro, linhas: [...quadro.linhas].sort((a, b) => a.numero - b.numero) }, null, 2)}\n`)
  renameSync(provisorio, caminho)
}

/**
 * Muda uma linha, e só ela: relê o quadro do disco, entrega a linha que está lá a `mudar` e grava o que ele devolve
 * (`null` tira a linha). Só se chama sob a trava; o quadro que o comando leu no começo pode ter mudado enquanto ele
 * esperava a trava, e é o do disco que vale.
 */
function gravarLinha(raiz: string, spec: string, numero: number, mudar: (atual: Linha | undefined) => Linha | null): void {
  const quadroDoDisco = lerQuadro(raiz) ?? { spec, linhas: [] }
  const nova = mudar(quadroDoDisco.linhas.find((linha) => linha.numero === numero))
  gravarQuadro(raiz, { spec, linhas: [...quadroDoDisco.linhas.filter((linha) => linha.numero !== numero), ...(nova === null ? [] : [nova])] })
}

export function lerPlano(raiz: string, funcionalidade: string): TarefaDoPlano[] {
  const pasta = join(raiz, 'tasks', `prd-${funcionalidade}`)
  const caminho = join(pasta, 'tasks.md')
  if (!existsSync(caminho)) return []
  const conteudo = readFileSync(caminho, 'utf8')
  const dependencias = lerDependencias(conteudo)
  const declarado = lerParalelismo(conteudo)
  const paralelas = (numero: number) =>
    new Set([...(declarado.get(numero) ?? []), ...[...declarado].filter(([, outras]) => outras.includes(numero)).map(([outra]) => outra)])
  return lerTarefas(conteudo).map((tarefa) => {
    const documento = join(pasta, `${String(tarefa.numero)}_task.md`)
    return {
      ...tarefa,
      dependeDe: dependencias.get(tarefa.numero) ?? [],
      paralelaCom: [...paralelas(tarefa.numero)].filter((outra) => outra !== tarefa.numero),
      arquivos: existsSync(documento) ? lerArquivosPrevistos(readFileSync(documento, 'utf8')) : [],
    }
  })
}

function git(raiz: string, ...argumentos: string[]): string {
  // Só o fim: a primeira coluna do `git status --porcelain` é um espaço que diz alguma coisa.
  return execFileSync('git', argumentos, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd()
}

function tenta(raiz: string, ...argumentos: string[]): { ok: boolean; saida: string } {
  try {
    return { ok: true, saida: git(raiz, ...argumentos) }
  } catch (erro) {
    const { stdout, stderr } = erro as { stdout?: string; stderr?: string }
    return { ok: false, saida: `${stdout ?? ''}${stderr ?? ''}`.trim() }
  }
}

const sujeira = (raiz: string) => git(raiz, 'status', '--porcelain').split('\n').filter((linha) => linha !== '')
const branchDe = (raiz: string) => tenta(raiz, 'symbolic-ref', '--short', '-q', 'HEAD').saida

export interface Resultado {
  /**
   * 0 feito; 1 recusado, nada mudou; 3 feito, mas o push falhou; 4 conflito no encontro, nada mudou; 5 a verificação do
   * encontro ficou vermelha ou passou do prazo: a spec não andou e a linha voltou ao commit de antes do merge.
   */
  codigo: number
  texto: string
}

const recusa = (texto: string): Resultado => ({ codigo: 1, texto: `RECUSADO: ${texto}` })

interface Contexto {
  spec: string
  funcionalidade: string
  quadro: Quadro
}

/** O andar da spec e o quadro dele. Texto, quando o comando não roda no andar da spec. */
function contextoDe(raiz: string): Contexto | string {
  const spec = branchDe(raiz)
  if (!spec.startsWith(PREFIXO_DA_BRANCH_DE_SPEC) || spec.includes(SUFIXO_DA_LINHA)) {
    return `este comando roda no andar da spec, na branch ${PREFIXO_DA_BRANCH_DE_SPEC}<funcionalidade>; aqui a branch é "${spec || 'HEAD solto'}"`
  }
  const quadro = lerQuadro(raiz)
  if (quadro && quadro.spec !== spec) return `o quadro em ${CAMINHO_DO_QUADRO} é de ${quadro.spec}, e este andar é de ${spec}`
  return { spec, funcionalidade: spec.slice(PREFIXO_DA_BRANCH_DE_SPEC.length), quadro: quadro ?? { spec, linhas: [] } }
}

const emCursoNo = (quadro: Quadro) => quadro.linhas.flatMap((linha) => (linha.tarefa === null ? [] : [linha.tarefa]))
const comTrabalho = (linha: Linha) => linha.tarefa !== null || linha.correcao !== null
const ocupada = (linha: Linha) => comTrabalho(linha) || linha.abrindo === true
/** O slug da correção que conserta o encontro da linha: a tarefa dela, ou a correção que ela fazia. */
const slugDoEncontro = (linha: Linha) => `encontro-${String(linha.tarefa ?? linha.correcao)}`
/** A linha 1 usa o par que o térreo sempre teve; as outras, um par com o número dela. */
export const terminaisDa = (numero: number) => (numero === 1 ? 'Implementador e Mesa' : `Implementador ${String(numero)} e Mesa ${String(numero)}`)
const oQueFaz = (linha: Linha) =>
  linha.tarefa !== null ? `tarefa ${String(linha.tarefa)}.0` : linha.correcao !== null ? `correção ${linha.correcao}` : linha.abrindo === true ? 'abertura em curso' : 'ociosa'
/** Por que a linha ocupada não aceita outro comando. A abertura não tem encontro a esperar: ela acaba sozinha, ou se abandona. */
const recusaPorUso = (linha: Linha, depois: string) =>
  linha.abrindo === true
    ? `a linha ${String(linha.numero)} está em uso: a abertura dela ainda roda (npm ci). Se o abrir morreu, rode \`node tools/processo/linhas.ts abandonar ${String(linha.numero)}\` e abra de novo`
    : `a linha ${String(linha.numero)} está com a ${oQueFaz(linha)}; ${depois}`

export interface Opcoes {
  /** `npm ci` no checkout da linha, ao abrir. Desligado só no teste. */
  instalar?: boolean
  /** O que roda no lugar do `npm ci`, por `sh -c` no checkout da linha. Só o teste o troca. */
  comandoDeInstalacao?: string
  /** O push da branch da spec no encontro, e o da remoção das branches de linha ao fechar. Desligado só no teste. */
  push?: boolean
  agora?: Date
  /** Quanto esperar a trava do quadro; o padrão é `PRAZO_DA_TRAVA_MS`. Só o teste o encurta. */
  prazoDaTravaMs?: number
  /**
   * O que o encontro roda no lugar de `COMANDO_DA_VERIFICACAO`: por `sh -c` no checkout da linha, com a trava na mão,
   * depois do merge da spec e antes de ela avançar. Saída diferente de 0 é vermelho. A saída do encontro diz qual comando
   * rodou, para que a troca não passe calada.
   */
  comandoSobATrava?: string
  /** Quanto a verificação pode durar; o padrão é `PRAZO_DA_VERIFICACAO_MS`, ou o dele com o `npm ci`. Só o teste o troca. */
  prazoDaVerificacaoMs?: number
  /** Do SIGTERM ao SIGKILL no grupo da verificação; o padrão é `ESPERA_ATE_SIGKILL_MS`. Só o teste o encurta. */
  esperaAteSigkillMs?: number
}

const numeroPositivo = (valor: string | undefined): number | null => {
  const numero = Number(valor)
  return Number.isFinite(numero) && numero > 0 ? numero : null
}

/** As opções que o teste de processo passa pelo ambiente, porque ali o comando é outro processo. */
export function opcoesDoAmbiente(ambiente: NodeJS.ProcessEnv): Opcoes {
  const prazoDaTrava = numeroPositivo(ambiente['EDUCA_QUADRO_PRAZO_DA_TRAVA_MS'])
  const prazoDaVerificacao = numeroPositivo(ambiente['EDUCA_ENCONTRO_PRAZO_DA_VERIFICACAO_MS'])
  const esperaAteSigkill = numeroPositivo(ambiente['EDUCA_ENCONTRO_ESPERA_ATE_SIGKILL_MS'])
  return {
    ...(prazoDaTrava === null ? {} : { prazoDaTravaMs: prazoDaTrava }),
    ...(prazoDaVerificacao === null ? {} : { prazoDaVerificacaoMs: prazoDaVerificacao }),
    ...(esperaAteSigkill === null ? {} : { esperaAteSigkillMs: esperaAteSigkill }),
    ...(ambiente['EDUCA_COMANDO_DE_INSTALACAO'] === undefined ? {} : { comandoDeInstalacao: ambiente['EDUCA_COMANDO_DE_INSTALACAO'] }),
    ...(ambiente['EDUCA_ENCONTRO_SOB_A_TRAVA'] === undefined ? {} : { comandoSobATrava: ambiente['EDUCA_ENCONTRO_SOB_A_TRAVA'] }),
  }
}

/**
 * Os pontos de injeção do teste trocam o que o comando faz de verdade (o `npm ci` do `abrir`, a verificação do encontro). Ligados
 * por engano no ambiente de quem opera, o encontro passaria sem verificar nada: o CLI diz, uma linha por variável, e `null`
 * quando nenhuma está definida (M5 da retro da X7).
 */
export function avisoDoAmbiente(ambiente: NodeJS.ProcessEnv): string | null {
  const avisos = [
    ambiente['EDUCA_ENCONTRO_SOB_A_TRAVA'] === undefined ? null : 'aviso: EDUCA_ENCONTRO_SOB_A_TRAVA está ligada neste ambiente: o encontro roda esse comando no lugar da verificação de verdade. Fora de teste, desligue-a (unset).',
    ambiente['EDUCA_COMANDO_DE_INSTALACAO'] === undefined ? null : 'aviso: EDUCA_COMANDO_DE_INSTALACAO está ligada neste ambiente: o abrir roda esse comando no lugar do npm ci. Fora de teste, desligue-a (unset).',
  ].filter((aviso) => aviso !== null)
  return avisos.length === 0 ? null : avisos.join('\n')
}

const SAIDA_DE_PRAZO_DO_FLOCK = 99
const ENCONTRO_EM_CURSO = `encontro em curso: outro comando de linhas está com o quadro (a trava ${CAMINHO_DA_TRAVA}). Tente de novo quando ele terminar.`

const SEM_FLOCK = 'o flock não rodou nesta máquina, e sem ele o quadro não tem trava: instale o util-linux'

interface Trava {
  soltar: () => Promise<void>
}

/**
 * A trava é um `flock` que fica de pé segurando o arquivo enquanto o `cat` espera a entrada padrão: soltar é fechá-la, e
 * morrer (até com SIGKILL) fecha também, o que solta a trava sem ninguém limpar nada. O `flock` do kernel é o que o Node
 * não tem. O arquivo da trava mora no `.processo/` da raiz do andar, que o git ignora.
 */
async function pegarTrava(raiz: string, prazoMs: number): Promise<Trava | 'prazo' | 'falhou'> {
  const caminho = join(raiz, CAMINHO_DA_TRAVA)
  mkdirSync(dirname(caminho), { recursive: true })
  const filho = spawn('flock', ['-w', String(prazoMs / 1000), '-E', String(SAIDA_DE_PRAZO_DO_FLOCK), caminho, 'sh', '-c', 'echo travado; cat >/dev/null'], {
    // O `flock` lê o prazo com a vírgula do idioma da máquina: "0.3" é inválido em português. Em C é sempre o ponto.
    env: { ...process.env, LC_ALL: 'C' },
    stdio: ['pipe', 'pipe', 'ignore'],
  })
  filho.stdin.on('error', () => undefined)
  const acabou = new Promise<number | null>((fim) => filho.once('close', fim))
  return new Promise((resolver) => {
    filho.once('error', () => resolver('falhou'))
    filho.stdout.once('data', () => resolver({ soltar: async () => { filho.stdin.end(); await acabou } }))
    void acabou.then((codigo) => resolver(codigo === SAIDA_DE_PRAZO_DO_FLOCK ? 'prazo' : 'falhou'))
  })
}

/** O texto de quem não conseguiu a trava, que é o mesmo em toda recusa. */
const semATrava = (trava: 'prazo' | 'falhou'): Resultado => recusa(trava === 'prazo' ? ENCONTRO_EM_CURSO : SEM_FLOCK)

/** Roda `corpo` com a trava do quadro na mão; quem não a consegue no prazo recebe a recusa "encontro em curso". */
async function sobATrava<T>(raiz: string, opcoes: Opcoes, corpo: () => T | Promise<T>): Promise<T | Resultado> {
  const trava = await pegarTrava(raiz, opcoes.prazoDaTravaMs ?? PRAZO_DA_TRAVA_MS)
  if (typeof trava === 'string') return semATrava(trava)
  try {
    return await corpo()
  } finally {
    await trava.soltar()
  }
}

/** Um comando de shell no checkout; o que ele escreve no erro sai no erro deste comando. `true` quando sai 0. */
function rodarNoCheckout(checkout: string, comando: string): Promise<boolean> {
  const filho = spawn('sh', ['-c', comando], { cwd: checkout, stdio: ['ignore', 'ignore', 'inherit'] })
  return new Promise((resolver) => {
    filho.once('error', () => resolver(false))
    filho.once('close', (codigo) => resolver(codigo === 0))
  })
}

const dormir = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms))

/** Manda o sinal ao grupo de processo inteiro. `false`: o grupo não existe mais (ou o sinal 0 não achou ninguém). */
function sinalAoGrupo(grupo: number, sinal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(-grupo, sinal)
    return true
  } catch {
    return false
  }
}

/**
 * Acaba com o grupo: SIGTERM e, se ele ainda existe `esperaMs` depois, SIGKILL; e espera o SIGKILL fazer efeito, porque o
 * que o grupo escreve na árvore até morrer tem de acabar antes de o encontro mexer nela. Grupo que já não existe não espera.
 */
async function matarGrupo(grupo: number, esperaMs: number): Promise<void> {
  if (!sinalAoGrupo(grupo, 'SIGTERM')) return
  const limite = Date.now() + esperaMs
  while (sinalAoGrupo(grupo, 0) && Date.now() < limite) await dormir(25)
  sinalAoGrupo(grupo, 'SIGKILL')
  const fim = Date.now() + ESPERA_DEPOIS_DO_SIGKILL_MS
  while (sinalAoGrupo(grupo, 0) && Date.now() < fim) await dormir(25)
}

type Veredito = 'passou' | 'vermelha' | 'prazo' | 'interrompida'

/**
 * Roda o comando por `sh -c` no checkout, em grupo de processo próprio (`detached` é um `setsid`: o pgid é o do filho), e
 * não deixa nada dele de pé: o grupo inteiro morre quando o comando acaba, passa do prazo ou o encontro é interrompido, e
 * não só o `sh`, porque o `npx`, o `tsc` e o `eslint` são netos e seguem segurando a árvore e o `node_modules`. A saída do
 * comando vai para o erro deste, para quem lê o encontro ver o que quebrou.
 */
export async function rodarEmGrupo(checkout: string, comando: string, prazoMs: number, esperaMs: number): Promise<Veredito> {
  const desligar: (() => void)[] = []
  // Os ouvintes sobem ANTES de o filho nascer: ele roda em outro processo e, em poucos ms, já fez o que o chamador espera
  // ver antes de mandar o sinal. Com o ouvinte depois do `spawn`, um encontro tirado da CPU nesse intervalo morria pela
  // ação padrão do sinal, sem matar o grupo nem voltar a linha. O `finally` desliga relógio e ouvintes também quando o
  // `spawn` lança: ouvinte solto engoliria o Ctrl-C do encontro, e o relógio o seguraria vivo até o fim do prazo.
  const interrompido = new Promise<'prazo' | 'interrompida'>((resolver) => {
    const relogio = setTimeout(() => resolver('prazo'), prazoMs)
    desligar.push(() => clearTimeout(relogio))
    // Ctrl-C ou kill no encontro não alcança o grupo (outra sessão): o encontro o leva junto, e só depois volta a linha.
    for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      const aoSinal = () => resolver('interrompida')
      process.on(sinal, aoSinal)
      desligar.push(() => process.off(sinal, aoSinal))
    }
  })
  let filho: ChildProcess
  let veredito: Veredito
  try {
    filho = spawn('sh', ['-c', comando], { cwd: checkout, detached: true, stdio: ['ignore', 2, 2] })
    const nascido = filho
    const saiu = new Promise<'passou' | 'vermelha'>((resolver) => {
      nascido.once('error', () => resolver('vermelha'))
      nascido.once('exit', (codigo) => resolver(codigo === 0 ? 'passou' : 'vermelha'))
    })
    veredito = await Promise.race([saiu, interrompido])
  } finally {
    for (const fechar of desligar) fechar()
  }
  if (filho.pid !== undefined) await matarGrupo(filho.pid, esperaMs)
  return veredito
}

interface Abertura {
  spec: string
  checkout: string
  branch: string
  /** A marca desta execução do `abrir` na linha do quadro. */
  abertura: string
}

/** O começo do `abrir`, sob a trava: confere, prepara o checkout e grava a linha como em uso, com a base. */
function prepararAbertura(raiz: string, numero: number, checkoutDado: string, opcoes: Opcoes): Resultado | Abertura {
  const contexto = contextoDe(raiz)
  if (typeof contexto === 'string') return recusa(contexto)
  const { spec, quadro } = contexto
  if (!Number.isInteger(numero) || numero < 1 || numero > MAXIMO_DE_LINHAS) return recusa(`a linha é um inteiro de 1 a ${String(MAXIMO_DE_LINHAS)}`)
  const checkout = resolve(raiz, checkoutDado)
  const branch = branchDaLinha(spec, numero)
  if (!existsSync(checkout)) return recusa(`${checkout} não existe. Crie o andar da linha: git -C ${raiz} branch ${branch} ${spec} && maestri floor create "<andar> L${String(numero)}" --branch ${branch} --existing-branch`)
  if (branchDe(checkout) !== branch) return recusa(`${checkout} está na branch "${branchDe(checkout)}", e a linha ${String(numero)} é a ${branch}`)
  const comum = (pasta: string) => tenta(pasta, 'rev-parse', '--path-format=absolute', '--git-common-dir').saida
  if (comum(checkout) !== comum(raiz)) return recusa(`${checkout} não é um checkout deste repositório`)
  const emUso = quadro.linhas.find((linha) => linha.numero === numero && ocupada(linha))
  if (emUso) return recusa(recusaPorUso(emUso, 'o encontro dela vem antes'))
  if (sujeira(checkout).length > 0) return recusa(`${checkout} tem alteração na árvore:\n${sujeira(checkout).join('\n')}`)
  const ponta = tenta(checkout, 'merge', '--ff-only', spec)
  if (!ponta.ok) return recusa(`a branch ${branch} tem commit que a ${spec} não tem:\n${ponta.saida}`)
  // O Maestri copia o que o git ignora do andar de onde a linha nasceu: o carimbo e o quadro de lá não valem aqui.
  mkdirSync(join(checkout, '.processo'), { recursive: true })
  for (const copiado of ['portao.json', 'conteudo.json', 'linhas.json']) rmSync(join(checkout, '.processo', copiado), { force: true })
  writeFileSync(join(checkout, '.processo', 'ambiente'), `${String(numero)}\n`)
  const desde = (opcoes.agora ?? new Date()).toISOString()
  const abertura = randomUUID()
  gravarLinha(raiz, spec, numero, () => ({ numero, checkout, tarefa: null, correcao: null, desde, base: spec, abrindo: true, abertura }))
  return { spec, checkout, branch, abertura }
}

/** O fim do `abrir`, com a trava de novo: a linha fica livre, ou sai do quadro se o `npm ci` falhou. */
async function concluirAbertura(raiz: string, numero: number, aberta: Abertura, instalou: boolean, opcoes: Opcoes): Promise<Resultado> {
  const trava = await pegarTrava(raiz, opcoes.prazoDaTravaMs ?? PRAZO_DA_TRAVA_MS)
  if (typeof trava === 'string') {
    const motivo = trava === 'prazo' ? ENCONTRO_EM_CURSO : SEM_FLOCK
    return recusa([`${instalou ? '' : 'o npm ci falhou, e '}a linha ${String(numero)} ficou em uso: ${motivo}`, `Rode \`node tools/processo/linhas.ts abandonar ${String(numero)}\` e abra a linha de novo.`].join('\n'))
  }
  try {
    let aindaAbrindo = true
    gravarLinha(raiz, aberta.spec, numero, (atual) => {
      aindaAbrindo = atual?.abertura === aberta.abertura
      if (!aindaAbrindo) return atual ?? null
      if (!instalou || atual === undefined) return null
      // A marca é da abertura em curso: a linha livre não a leva, e a próxima abertura grava a sua.
      const livre: Linha = { ...atual, abrindo: false, desde: null }
      delete livre.abertura
      return livre
    })
    if (!aindaAbrindo) return recusa(`a linha ${String(numero)} foi abandonada enquanto o npm ci rodava. Abra de novo.`)
  } finally {
    await trava.soltar()
  }
  if (!instalou) return recusa(`o npm ci falhou em ${aberta.checkout}; a linha ${String(numero)} saiu do quadro. Abra de novo.`)
  return { codigo: 0, texto: `Linha ${String(numero)} aberta em ${aberta.checkout}, na ${aberta.branch}, com o ambiente de teste ${String(numero)}. Terminais: ${terminaisDa(numero)}.` }
}

export async function abrir(raiz: string, numero: number, checkoutDado: string, opcoes: Opcoes = {}): Promise<Resultado> {
  const aberta = await sobATrava(raiz, opcoes, () => prepararAbertura(raiz, numero, checkoutDado, opcoes))
  if ('codigo' in aberta) return aberta
  const instalou = (opcoes.instalar ?? true) ? await rodarNoCheckout(aberta.checkout, opcoes.comandoDeInstalacao ?? COMANDO_DE_INSTALACAO) : true
  return concluirAbertura(raiz, numero, aberta, instalou, opcoes)
}

function partidaSobATrava(raiz: string, numero: number, alvo: string, opcoes: Opcoes): Resultado {
  const contexto = contextoDe(raiz)
  if (typeof contexto === 'string') return recusa(contexto)
  const { spec, funcionalidade, quadro } = contexto
  const linha = quadro.linhas.find((candidata) => candidata.numero === numero)
  if (!linha) return recusa(`a linha ${String(numero)} não está aberta (linhas.ts abrir)`)
  if (ocupada(linha)) return recusa(recusaPorUso(linha, 'o encontro dela vem antes'))
  const correcao = /^correcao:([a-z0-9-]+)$/.exec(alvo)?.[1] ?? null
  const tarefa = correcao === null && /^\d+(\.0)?$/.test(alvo) ? Number.parseInt(alvo, 10) : null
  if (correcao === null && tarefa === null) return recusa(`"${alvo}" não é tarefa (5 ou 5.0) nem correção (correcao:<slug>)`)
  let titulo = ''
  if (tarefa !== null) {
    const plano = lerPlano(raiz, funcionalidade)
    const doPlano = plano.find((candidata) => candidata.numero === tarefa)
    if (!doPlano) return recusa(`a ${String(tarefa)}.0 não está no tasks.md`)
    if (doPlano.feita) return recusa(`a ${String(tarefa)}.0 já está concluída`)
    if (emCursoNo(quadro).includes(tarefa)) return recusa(`a ${String(tarefa)}.0 já corre em outra linha`)
    const presa = situacaoDasPendentes(plano, emCursoNo(quadro)).presas.find((candidata) => candidata.numero === tarefa)
    if (presa) return recusa(`a ${String(tarefa)}.0 não parte agora: ${presa.motivo}`)
    titulo = doPlano.titulo
  }
  if (sujeira(linha.checkout).length > 0) return recusa(`${linha.checkout} tem alteração na árvore:\n${sujeira(linha.checkout).join('\n')}`)
  const ponta = tenta(linha.checkout, 'merge', '--ff-only', spec)
  if (!ponta.ok) return recusa(`a linha ${String(numero)} tem commit que a ${spec} não tem: falta o encontro dela.\n${ponta.saida}`)
  const desde = (opcoes.agora ?? new Date()).toISOString()
  gravarLinha(raiz, spec, numero, (atual) => (atual === undefined ? null : { ...atual, tarefa, correcao, desde }))
  const oQue = tarefa !== null ? `tarefa ${String(tarefa)}.0 — ${titulo}\n  documento: tasks/prd-${funcionalidade}/${String(tarefa)}_task.md` : `correção ${correcao ?? ''}`
  return { codigo: 0, texto: `Linha ${String(numero)}: ${oQue}\n  checkout: ${linha.checkout}\n  terminais: ${terminaisDa(numero)}` }
}

export async function partida(raiz: string, numero: number, alvo: string, opcoes: Opcoes = {}): Promise<Resultado> {
  return sobATrava(raiz, opcoes, () => partidaSobATrava(raiz, numero, alvo, opcoes))
}

/** Solta a linha: o que ela fazia deixa de ser dela. A branch e o checkout ficam como estão (RF6). */
function abandonarSobATrava(raiz: string, numero: number): Resultado {
  const contexto = contextoDe(raiz)
  if (typeof contexto === 'string') return recusa(contexto)
  const { spec, quadro } = contexto
  const linha = quadro.linhas.find((candidata) => candidata.numero === numero)
  if (!linha) return recusa(`a linha ${String(numero)} não está aberta (linhas.ts abrir)`)
  if (!ocupada(linha)) return recusa(`a linha ${String(numero)} já está livre`)
  const naAbertura = linha.abrindo === true
  gravarLinha(raiz, spec, numero, (atual) => (atual === undefined || naAbertura ? null : { ...atual, tarefa: null, correcao: null, desde: null }))
  if (naAbertura) return { codigo: 0, texto: `Linha ${String(numero)} tirada do quadro: a abertura dela não terminou. Abra de novo: linhas.ts abrir ${String(numero)} <checkout>.` }
  return {
    codigo: 0,
    texto: [
      `Linha ${String(numero)} solta: a ${oQueFaz(linha)} deixou de ser dela e volta a ser pendente.`,
      `A branch ${branchDaLinha(spec, numero)} e o checkout ficam como estão: a próxima partida exige a árvore limpa e nenhum commit que a ${spec} não tenha.`,
    ].join('\n'),
  }
}

export async function abandonar(raiz: string, numero: number, opcoes: Opcoes = {}): Promise<Resultado> {
  return sobATrava(raiz, opcoes, () => abandonarSobATrava(raiz, numero))
}

const soDocumento = (arquivos: string[]) => arquivos.every((arquivo) => arquivo.startsWith('tasks/') || arquivo.endsWith('.md'))

/**
 * Os arquivos que um commit traz. Na correção avulsa, o diff contra o primeiro pai, como sempre. Na spec e na linha, o
 * que o commit mesmo fez: num commit comum dá o mesmo; num merge, `--remerge-diff` compara o que ele gravou com o que o
 * git juntaria sozinho, e sobra só a resolução de conflito, inclusive a que ficou com um lado só. O merge limpo não traz
 * nada: o código que ele trouxe está nos commits do outro lado, e cada um deles está no intervalo e se confere sozinho.
 * Na linha, é o merge de outra linha que o Orquestrador manda fazer quando uma tarefa precisa do que a outra entregou
 * (R61).
 */
function arquivosDoCommit(checkout: string, sha: string, peloQueResolveu: boolean): string[] {
  const saida = peloQueResolveu
    ? git(checkout, 'show', '--remerge-diff', '--format=', '--name-only', sha)
    : git(checkout, 'diff', '--name-only', `${sha}^1`, sha)
  return saida.split('\n').filter((arquivo) => arquivo !== '')
}

/**
 * O que os commits que a `base` não tem precisam ter para entrar nela: todo commit que leva código com a marca de
 * tarefa ou de correção no título e a linha `Revisões:` no corpo, e, numa tarefa, o commit dela entre eles. Vale para
 * mais de um commit: a correção no meio da tarefa, e o merge que conserta um conflito de encontro. `null` quando tudo
 * confere. O hook já barrou cada um ao nascer; isto barra o que chegou à linha sem passar por ele.
 *
 * `naSpec`: a conferência de uma correção feita na branch da spec. Contra a `develop`, ali estão também os commits das
 * tarefas já feitas, que o encontro de cada linha conferiu: a marca `(tarefa N.0)` de qualquer uma vale (e a linha
 * `Revisões:` continua cobrada), o merge do encontro só é cobrado pelo que ele mesmo resolveu, e o último commit com código
 * tem de ser o da correção, que é o que se confere.
 *
 * `naLinha`: a conferência do encontro. O merge que traz outra linha só é cobrado pelo que ele mesmo resolveu, como o da
 * spec; a marca continua a da tarefa ou a de correção, e só elas.
 */
export function conferirEntrega(checkout: string, base: string, tarefa: number | null, opcoes: { naSpec?: boolean; naLinha?: boolean } = {}): string | null {
  const naSpec = opcoes.naSpec ?? false
  const peloQueResolveu = naSpec || (opcoes.naLinha ?? false)
  const novos = git(checkout, 'rev-list', '--reverse', `${base}..HEAD`).split('\n').filter((sha) => sha !== '')
  if (novos.length === 0) return 'nenhum commit novo'
  const marcaDaTarefa = tarefa === null ? null : `(tarefa ${String(tarefa)}.0)`
  let temADaTarefa = false
  let temMarca = false
  let ultimoCorrige = false
  for (const sha of novos) {
    const [titulo = '', ...corpo] = git(checkout, 'log', '-1', '--format=%B', sha).split('\n')
    const curto = sha.slice(0, 7)
    const daTarefa = marcaDaTarefa !== null && titulo.includes(marcaDaTarefa)
    const corrige = MARCA_DE_CORRECAO.test(titulo)
    const marcado = daTarefa || corrige || (naSpec && MARCA_DE_TAREFA.test(titulo))
    temADaTarefa ||= daTarefa
    temMarca ||= marcado
    if (soDocumento(arquivosDoCommit(checkout, sha, peloQueResolveu))) continue
    if (!marcado) return `o commit ${curto} leva código sem ${marcaDaTarefa ?? (naSpec ? '(tarefa N.0) nem (correção <slug>)' : '(correção <slug>)')} no título: "${titulo}"`
    if (!corpo.some((linha) => linha.startsWith('Revisões: '))) return `o commit ${curto} não tem a linha "Revisões:"`
    ultimoCorrige = corrige
  }
  if (marcaDaTarefa !== null && !temADaTarefa) return `falta o commit com ${marcaDaTarefa} no título`
  if (naSpec ? !ultimoCorrige : !temMarca) return `falta o commit com (correção <slug>) no título${naSpec ? ', e ele tem de ser o último com código' : ''}`
  return null
}

/**
 * Com o que o `conferir` compara: a base que o quadro gravou ao abrir as linhas (a branch da spec), e não sempre a
 * `develop`. O andar de uma correção que nasceu da spec traz o quadro dela (o Maestri copia o que o git ignora), e é a
 * spec que ele já tem a mais que a `develop`; o que nasceu da `develop` não tem quadro. No andar da própria spec, a base
 * seria ela mesma, e o que se confere ali é o que a `develop` ainda não tem.
 */
function baseDoConferir(raiz: string, branch: string): string {
  const quadro = lerQuadro(raiz)
  if (quadro === null || quadro.spec === branch) return 'develop'
  return quadro.linhas.find((linha) => linha.base !== undefined)?.base ?? quadro.spec
}

/**
 * A conferência de um checkout que não é linha: a correção avulsa, no andar dela, ou a correção feita na branch da spec.
 * O mesmo que o encontro confere, contra a branch do GitHub: os commits que a `develop` não tem, a árvore limpa e o push
 * feito.
 */
export function conferir(raiz: string, opcoes: { emCurso?: boolean } = {}): Resultado {
  const branch = branchDe(raiz)
  const entrega = conferirEntrega(raiz, baseDoConferir(raiz, branch), null, { naSpec: branch.startsWith(PREFIXO_DA_BRANCH_DE_SPEC) })
  if (entrega !== null) return recusa(entrega)
  const alterados = sujeira(raiz)
  if (alterados.length > 0 && !(opcoes.emCurso ?? false)) return recusa(`a árvore não está limpa: o commit não levou tudo.\n${alterados.join('\n')}`)
  const porEnviar = tenta(raiz, 'rev-list', '--count', `origin/${branch}..HEAD`)
  if (!porEnviar.ok || porEnviar.saida !== '0') return recusa(`o push não foi feito: a ${branch} do GitHub não tem o último commit`)
  return { codigo: 0, texto: `Conferido em ${branch}: marca e revisões em todo commit com código, ${alterados.length === 0 ? 'árvore limpa' : `árvore com ${String(alterados.length)} arquivo(s) da tarefa em curso`} e push feito.` }
}

/** O prazo da verificação: o padrão é um, e o `npm ci` na frente (o lock mudou) dobra; o teste põe o seu. */
export function prazoDaVerificacao(comNpmCi: boolean, opcoes: Opcoes = {}): number {
  return opcoes.prazoDaVerificacaoMs ?? (comNpmCi ? PRAZO_DA_VERIFICACAO_COM_NPM_CI_MS : PRAZO_DA_VERIFICACAO_MS)
}

interface Verificacao<V extends Veredito = Veredito> {
  veredito: V
  comando: string
  prazoMs: number
}

/**
 * A verificação do encontro, no checkout da linha, com o merge da spec já feito: `npm ci` se o lock mudou entre antes do
 * merge e agora, e depois a tipagem e o lint. Tudo num só grupo de processo e sob um só prazo: o `&&` faz o `npm ci` que
 * falha valer vermelho sem rodar o resto. Quando devolve, o grupo já morreu.
 */
async function verificarOMerge(checkout: string, antes: string, opcoes: Opcoes): Promise<Verificacao> {
  const lockMudou = git(checkout, 'diff', '--name-only', antes, 'HEAD', '--', 'package-lock.json') !== ''
  const verificar = opcoes.comandoSobATrava ?? COMANDO_DA_VERIFICACAO
  const comando = lockMudou ? `(${opcoes.comandoDeInstalacao ?? COMANDO_DE_INSTALACAO}) && (${verificar})` : verificar
  const prazoMs = prazoDaVerificacao(lockMudou, opcoes)
  const veredito = await rodarEmGrupo(checkout, comando, prazoMs, opcoes.esperaAteSigkillMs ?? ESPERA_ATE_SIGKILL_MS)
  return { veredito, comando, prazoMs }
}

/** A linha volta ao commit de antes do merge. Só se chama com o grupo da verificação morto. Texto do erro, ou `null` quando voltou. */
function desfazerOMerge(checkout: string, antes: string): string | null {
  const volta = tenta(checkout, 'reset', '--hard', antes)
  return volta.ok ? null : volta.saida
}

function recusaDaVerificacao(linha: Linha, spec: string, antes: string, verificacao: Verificacao<Exclude<Veredito, 'passou'>>, erroDoReset: string | null): Resultado {
  const [numero, curto] = [String(linha.numero), antes.slice(0, 7)]
  const motivo = {
    vermelha: `a tipagem ou o lint (ou o npm ci, se o lock mudou) falhou com a ${spec} junto; a saída está acima.`,
    prazo: `a verificação passou de ${String(verificacao.prazoMs / 1000)} s e foi morta: vale como vermelha.`,
    interrompida: 'o encontro recebeu um sinal de fim enquanto verificava: a verificação foi morta e vale como vermelha.',
  }[verificacao.veredito]
  return {
    codigo: CODIGO_DA_VERIFICACAO,
    texto: [
      `VERIFICAÇÃO RECUSADA no encontro da linha ${numero} (${oQueFaz(linha)}): ${motivo}`,
      `Comando: ${verificacao.comando}`,
      erroDoReset === null
        ? `Nada avançou: a linha ${numero} voltou ao commit ${curto}, de antes do merge; a ${spec} não andou e não houve push. A linha continua com a ${oQueFaz(linha)}.`
        : `A LINHA NÃO VOLTOU: o reset para ${curto} falhou (${erroDoReset}). Rode \`git reset --hard ${antes}\` na linha ${numero} antes de qualquer outro comando. A ${spec} não andou e não houve push.`,
      `É correção na própria linha, com o slug ${slugDoEncontro(linha)}: o Implementador ${numero} roda \`git merge ${spec}\`, conserta o que quebrou, passa o portão e a Mesa,`,
      'e fecha o conserto com o commit da correção. Depois, este comando de novo.',
    ].join('\n'),
  }
}

async function encontroSobATrava(raiz: string, numero: number, opcoes: Opcoes): Promise<Resultado> {
  const contexto = contextoDe(raiz)
  if (typeof contexto === 'string') return recusa(contexto)
  const { spec, funcionalidade, quadro } = contexto
  const linha = quadro.linhas.find((candidata) => candidata.numero === numero)
  if (!linha || !comTrabalho(linha)) return recusa(`a linha ${String(numero)} não tem trabalho em curso`)
  const { checkout } = linha
  const branch = branchDaLinha(spec, numero)
  if (branchDe(checkout) !== branch) return recusa(`${checkout} está na branch "${branchDe(checkout)}", e não na ${branch}`)
  if (sujeira(checkout).length > 0) return recusa(`a árvore da linha ${String(numero)} não está limpa: o commit não levou tudo.\n${sujeira(checkout).join('\n')}`)
  const entrega = conferirEntrega(checkout, spec, linha.tarefa, { naLinha: true })
  if (entrega !== null) return recusa(`linha ${String(numero)}, ${oQueFaz(linha)}: ${entrega}`)
  const diario = `tasks/prd-${funcionalidade}/estado.md`
  // Documento a meio no andar da spec (o Arquiteto aplicando uma decisão) não impede o encontro; código, sim.
  const codigoNoAndar = sujeira(raiz).filter((item) => !soDocumento([item.slice(3)]))
  if (codigoNoAndar.length > 0) return recusa(`o andar da spec tem código alterado, e nele ninguém implementa:\n${codigoNoAndar.join('\n')}`)
  const commit = git(checkout, 'rev-parse', '--short', 'HEAD')
  const antes = git(checkout, 'rev-parse', 'HEAD')

  const juncao = tenta(checkout, 'merge', '--no-edit', spec)
  if (!juncao.ok) {
    const emConflito = git(checkout, 'diff', '--name-only', '--diff-filter=U').split('\n').filter((arquivo) => arquivo !== '')
    const lista = `tasks/prd-${funcionalidade}/tasks.md`
    if (linha.tarefa !== null && emConflito.length === 1 && emConflito[0] === lista) {
      writeFileSync(join(checkout, lista), marcarTarefaFeita(git(checkout, 'show', `:3:${lista}`) + '\n', linha.tarefa))
      git(checkout, 'add', lista)
      git(checkout, 'commit', '--no-edit')
    } else {
      tenta(checkout, 'merge', '--abort')
      if (emConflito.length === 0) return recusa(`o merge da ${spec} na linha ${String(numero)} falhou sem conflito:\n${juncao.saida}`)
      return {
        codigo: 4,
        texto: [
          `CONFLITO no encontro da linha ${String(numero)} (${oQueFaz(linha)}): ${emConflito.join(', ')}`,
          `Nada mudou. É correção na própria linha, com o slug ${slugDoEncontro(linha)}: o Implementador ${String(numero)} roda \`git merge ${spec}\`, resolve,`,
          'passa o portão e a Mesa, e fecha o merge com o commit da correção. Depois, este comando de novo.',
        ].join('\n'),
      }
    }
  }
  const { veredito, comando, prazoMs } = await verificarOMerge(checkout, antes, opcoes)
  if (veredito !== 'passou') return recusaDaVerificacao(linha, spec, antes, { veredito, comando, prazoMs }, desfazerOMerge(checkout, antes))
  const avanco = tenta(raiz, 'merge', '--ff-only', branch)
  if (!avanco.ok) return recusa(`a ${spec} não avança até a ${branch}:\n${avanco.saida}`)
  if (sujeira(raiz).some((item) => item.slice(3) === diario)) {
    // Só o diário, pelo caminho: o que mais estiver a meio no andar continua como está.
    git(raiz, 'add', diario)
    git(raiz, 'commit', '-m', `Registra o estado de ${funcionalidade} depois da ${oQueFaz(linha)}`, '--', diario)
  }
  const enviado = (opcoes.push ?? true) ? tenta(raiz, 'push', 'origin', spec) : { ok: true, saida: '' }
  gravarLinha(raiz, spec, numero, (atual) => (atual === undefined ? null : { ...atual, tarefa: null, correcao: null, desde: null }))
  return {
    codigo: enviado.ok ? 0 : 3,
    texto: [
      `Encontro da linha ${String(numero)}: ${oQueFaz(linha)} em ${commit}; a ${spec} está em ${git(raiz, 'rev-parse', '--short', 'HEAD')}.`,
      `Verificação do merge: passou (${comando}), com prazo de ${String(prazoMs / 1000)} s.`,
      enviado.ok ? ((opcoes.push ?? true) ? 'Push feito: a esteira roda sobre a soma das linhas.' : 'Sem push.') : `O PUSH FALHOU, e a esteira não rodou:\n${enviado.saida}`,
      '',
      textoDoQuadro(raiz),
    ].join('\n'),
  }
}

export async function encontro(raiz: string, numero: number, opcoes: Opcoes = {}): Promise<Resultado> {
  return sobATrava(raiz, opcoes, () => encontroSobATrava(raiz, numero, opcoes))
}

function fecharSobATrava(raiz: string, opcoes: Opcoes): Resultado {
  const contexto = contextoDe(raiz)
  if (typeof contexto === 'string') return recusa(contexto)
  const { spec, quadro } = contexto
  const ocupadas = quadro.linhas.filter(ocupada)
  if (ocupadas.length > 0) return recusa(ocupadas.map((linha) => `a linha ${String(linha.numero)} está com a ${oQueFaz(linha)}`).join('; '))
  const linhas = [`Linhas de ${spec} fechadas.`]
  for (const linha of quadro.linhas) {
    const branch = branchDaLinha(spec, linha.numero)
    if (!tenta(raiz, 'merge-base', '--is-ancestor', branch, spec).ok) return recusa(`a ${branch} tem commit que a ${spec} não tem: falta um encontro`)
    if ((opcoes.push ?? true) && tenta(raiz, 'ls-remote', '--exit-code', '--heads', 'origin', branch).ok) tenta(raiz, 'push', 'origin', '--delete', branch)
    linhas.push(`  linha ${String(linha.numero)}: tudo na ${spec}. O andar em ${linha.checkout} pode ser desfeito (maestri floor delete).`)
  }
  rmSync(join(raiz, CAMINHO_DO_QUADRO), { force: true })
  return { codigo: 0, texto: linhas.join('\n') }
}

export async function fechar(raiz: string, opcoes: Opcoes = {}): Promise<Resultado> {
  return sobATrava(raiz, opcoes, () => fecharSobATrava(raiz, opcoes))
}

const hora = (iso: string | null) => (iso === null ? '' : new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))

/** O quadro: o que cada linha faz, o que está livre e o que parte agora. É o que o Orquestrador lê a cada relatório. */
export function textoDoQuadro(raiz: string): string {
  const contexto = contextoDe(raiz)
  if (typeof contexto === 'string') return `RECUSADO: ${contexto}`
  const { spec, funcionalidade, quadro } = contexto
  const plano = lerPlano(raiz, funcionalidade)
  const texto = [`Linhas de ${funcionalidade} (${spec}): ${String(plano.filter((tarefa) => tarefa.feita).length)} de ${String(plano.length)} tarefas concluídas`]
  for (const linha of quadro.linhas) texto.push(`  linha ${String(linha.numero)}: ${oQueFaz(linha)}${ocupada(linha) ? ` desde ${hora(linha.desde)}` : ''} — ${linha.checkout}`)
  if (quadro.linhas.length === 0) texto.push('  nenhuma linha aberta')
  const emCurso = emCursoNo(quadro)
  const { presas } = situacaoDasPendentes(plano, emCurso)
  const { partidas, semLinha } = distribuir(plano, emCurso, quadro.linhas.filter((linha) => !ocupada(linha)).map((linha) => linha.numero))
  if (partidas.length > 0) texto.push(`Partem agora: ${partidas.map(({ linha, tarefa }) => `linha ${String(linha)} → ${String(tarefa)}.0`).join('; ')}`)
  const cabem = Math.min(semLinha.length, MAXIMO_DE_LINHAS - quadro.linhas.length)
  if (cabem > 0) texto.push(`Sem linha: ${semLinha.slice(0, cabem).map((numero) => `${String(numero)}.0`).join(', ')}. Abra ${cabem === 1 ? 'mais uma linha' : `mais ${String(cabem)} linhas`}.`)
  if (presas.length > 0) texto.push(`Presas: ${presas.map(({ numero, motivo }) => `${String(numero)}.0 (${motivo})`).join('; ')}`)
  if (partidas.length === 0 && semLinha.length === 0 && emCurso.length === 0 && plano.some((tarefa) => !tarefa.feita)) {
    texto.push('NENHUMA TAREFA LIBERADA, e nada em curso: pare e reporte.')
  }
  if (plano.length > 0 && plano.every((tarefa) => tarefa.feita)) texto.push('Todas as tarefas concluídas: `linhas.ts fechar`, e a validação.')
  return texto.join('\n')
}

/** O quadro como comando: fora do andar da spec é recusa, com saída de erro, e não um quadro vazio. */
export function quadro(raiz: string): Resultado {
  const texto = textoDoQuadro(raiz)
  return { codigo: texto.startsWith('RECUSADO') ? 1 : 0, texto }
}

/** Os comandos que mudam o quadro rodam sob a trava, e por isso esperam; os outros respondem na hora. */
async function executar(raiz: string, comando: string | undefined, primeiro: string, segundo: string): Promise<Resultado> {
  const opcoes = opcoesDoAmbiente(process.env)
  const numero = Number(primeiro)
  if (comando === undefined) return quadro(raiz)
  if (comando === 'abrir') return abrir(raiz, numero, segundo, opcoes)
  if (comando === 'partida') return partida(raiz, numero, segundo, opcoes)
  if (comando === 'abandonar') return abandonar(raiz, numero, opcoes)
  if (comando === 'encontro') return encontro(raiz, numero, opcoes)
  if (comando === 'fechar') return fechar(raiz, opcoes)
  if (comando === 'conferir') return conferir(raiz, { emCurso: primeiro === '--em-curso' })
  return recusa(`comando desconhecido: ${comando}`)
}

if (import.meta.filename === process.argv[1]) {
  const [comando, primeiro = '', segundo = ''] = process.argv.slice(2)
  const aviso = avisoDoAmbiente(process.env)
  if (aviso !== null) process.stderr.write(`${aviso}\n`)
  const resultado = await executar(process.cwd(), comando, primeiro, segundo)
  process.stdout.write(`${resultado.texto}\n`)
  process.exitCode = resultado.codigo
}
