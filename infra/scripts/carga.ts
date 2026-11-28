import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import { parseEnv } from 'node:util'
import { pathToFileURL } from 'node:url'
import pg from 'pg'
import { ARQUIVOS_AMBIENTE_CARGA, lerAmbienteDeCarga } from '../../tools/ci/compose.ts'
import { raizRepositorio } from '../../tools/ci/executar.ts'
import { aguardarInterativosIniciados, conferirJobRegistro, descreverConferencia, urlDoBancoDoAmbiente, type ConferenciaDaCarga } from './conferir-carga.ts'
import {
  agoraDoBanco,
  aguardarTrabalhoDaA,
  contarStatementsCancelados,
  formasDosStatementsCancelados,
  descreverExpurgo,
  enfileirarExpurgoDaA,
  julgarResultadoDoExpurgo,
  lerEsperaDaBNoTrabalho,
  lerRestoDaA,
  lerStatements,
  lerTurnoDaBNaJanela,
  medirEscritaDosIndices,
  liberarJanelaDaA,
  LINHAS_VENCIDAS_DA_A,
  prepararMedicaoDeStatements,
  semearEscolaA,
  semearTutorDaB,
  type EsperaDaBNoTrabalho,
  type ReprovacaoDoExpurgo,
  type ResultadoDoExpurgo,
} from './expurgo-da-carga.ts'

/**
 * Cenário de carga "justiça entre escolas" (Tech Spec, seção 7c; PRD, RF18), local e manual:
 *
 *   npm run carga                    sobe o compose de carga, roda o cenário e reprova se um critério falhar
 *   npm run carga:controle-negativo  o mesmo, com VAGAS_POR_ESCOLA_DESLIGADAS=true, e reprova se o cenário passar
 *   npm run carga -- --so=base       só a fase `base` (a de RF6: o p95 do turno do Tutor, no build que estiver na árvore)
 *   npm run carga -- --so=sala       só a carga da manhã (X6, tarefa 11.0): `FASE=sala`, dez escolas, o `kill -9` do `worker-ia-1`; relatório, não portão
 *   npm run carga -- --so=reserva    só a carga da queda do principal (F5b, tarefa 9.0): `FASE=reserva`, as mesmas dez escolas, cinco janelas (controle, 5xx, prazo, 429 e balde cheio) e a reserva falsa; relatório, não portão
 *   npm run carga -- --so=reserva --controle-negativo   o mesmo, com a reserva sem modelo elegível (`falso-sem-aprovacao`): reprova se a queda não deixar aluno sem resposta
 *
 * 1. sobe o projeto `educa-carga` (infra/compose.yml com infra/compose.carga.yml, CPU fixa por serviço);
 * 2. cria a rede e as escolas sintéticas A, B e C com `ops:escola` e as sessões de cada grupo com
 *    `ops:sessao-sintetica --quantidade`, no banco do projeto que acabou de subir;
 * 3. roda o k6 na fase `base` (só a escola B) e lê o p95 da espera dela;
 * 4. roda a fase `expurgo` (F3, tarefa 19.0): semeia a escola A com 1 milhão de linhas vencidas e um pedido de
 *    eliminação, roda o k6 com a B e, poucos segundos depois de ele começar, grava o job do expurgo da A. O worker de
 *    lote expurga e troca o nome de verdade, e o `pg_stat_statements` mede cada statement (< 2 s);
 * 5. roda o k6 na fase `carga`, com o p95 da base no threshold de espera da B;
 * 6. espera os interativos começarem e confere `job_registro` (nenhum `falhou`, nenhum interativo acima de 30 s);
 * 7. derruba o projeto com os volumes, passe ou não.
 *
 * O controle negativo só passa se o cenário reprovar pela justiça entre escolas (espera da B ou interativo
 * acima de 30 s) com a base de pé: reprovar porque o ambiente nem subiu não prova que a vaga por escola importa. A fase
 * do expurgo não roda nele: ela não depende da vaga por escola, e o que a impede de passar vazia são as conferências
 * dela (volume que saiu, sobreposição com a janela da B, amostra do `pg_stat_statements`).
 */

export const PROJETO_CARGA = 'educa-carga'
export { ARQUIVOS_AMBIENTE_CARGA, lerAmbienteDeCarga }
export const ARQUIVOS_COMPOSE_CARGA = ['infra/compose.yml', 'infra/compose.carga.yml'] as const
export const SCRIPT_DO_K6 = '/cenario/justica-entre-escolas.js'
export type FaseDoK6 = 'base' | 'expurgo' | 'carga' | 'sala' | 'reserva'

/**
 * Escolas sintéticas do cenário: A enche a fila, B mede a espera, C prova o rate limit. Desde a tarefa 3.0 elas
 * são criadas de verdade pelo `ops:escola` antes do k6, porque `job_registro` tem FK para `escola` e não existe
 * mais token sem sessão gravada. O id sai do comando; aqui ficam só os nomes.
 */
export const NOMES_DAS_ESCOLAS = ['A', 'B', 'C'] as const
export type NomeDeEscola = (typeof NOMES_DAS_ESCOLAS)[number]
export type EscolasDoCenario = Record<NomeDeEscola, string>

/** Quem a auditoria da rede e das escolas do cenário registra como operador. */
export const OPERADOR_DA_CARGA = 'carga-justica'

/**
 * Sessões por grupo do k6. Na A, 50 jobs por usuário na rajada, abaixo dos 120 por minuto; na B, cada usuário cria
 * uns 4 jobs por minuto e consulta cada um algumas vezes; na C, um usuário por VU, e há mais tokens que VUs no teste
 * inteiro (400 da C e 2 do abusivo, 400 anônimos, 50 da A e até 60 da B); o abusivo é um usuário só.
 *
 * O papel vem da `MATRIZ`: `POST /v1/sistema/jobs-sinteticos` é da equipe (A e B são professores), e
 * `GET /v1/sistema/contexto` é `proprio` para todo papel (a C é a turma de alunos que o cenário simula).
 */
export const TOKENS_POR_GRUPO = {
  a_lote: { escola: 'A', papel: 'professor', quantidade: 40 },
  a_interativo: { escola: 'A', papel: 'professor', quantidade: 10 },
  b: { escola: 'B', papel: 'professor', quantidade: 30 },
  // Os alunos do Tutor da B (fases `base` e `expurgo`): 1,5 turno por segundo, e o teto de 12 pedidos de IA por minuto por
  // usuário (`TETO_DE_PEDIDOS_DE_IA_POR_USUARIO`) pede ao menos 8; trinta dão 3 por minuto cada um, longe do freio do dia.
  b_tutor: { escola: 'B', papel: 'aluno', quantidade: 30 },
  c: { escola: 'C', papel: 'aluno', quantidade: 1_000 },
  abusivo: { escola: 'C', papel: 'aluno', quantidade: 1 },
} as const satisfies Record<string, { escola: NomeDeEscola; papel: 'aluno' | 'professor' | 'coordenador'; quantidade: number }>

/** Os critérios que a vaga por escola sustenta: é por eles, e só por eles, que o controle negativo precisa reprovar. */
export const CRITERIOS_DE_JUSTICA = ['espera_b', 'interativo_acima_de_30s'] as const
/** Quanto a conferência espera os interativos começarem depois do k6, antes de contar quem passou de 30 s. */
const PRAZO_PARA_INTERATIVOS_MS = 60_000
/** Código de saída do k6 quando algum threshold foi cruzado. Qualquer outro diferente de zero é erro do k6. */
export const CODIGO_THRESHOLD_CRUZADO = 99

export interface Reprovacao {
  criterio: string
  detalhe: string
}

export interface ResumoDoK6 {
  codigo: number
  /** Métrica com o threshold cruzado, como `espera_b` ou `respostas_429{grupo:c}`, e o critério. */
  cruzados: Array<{ metrica: string; criterio: string }>
  esperaBP95Ms: number | undefined
  /** O p95 do turno do Tutor da B que o k6 mediu (`turno_b`, do `POST` à execução concluída); só nas fases `base` e `expurgo`. */
  turnoBP95Ms?: number | undefined
  /** As execuções que terminaram `EXECUCAO_INTERROMPIDA` (`execucoes_interrompidas`, só na `FASE=sala`); `undefined` sem nenhuma. */
  interrompidas?: number | undefined
  /** As execuções que terminaram `IA_TEMPO_ESGOTADO` (`tempos_esgotados_reserva`, só na `FASE=reserva`); `undefined` sem nenhuma. */
  temposEsgotados?: number | undefined
}

/** Lê o `--summary-export` do k6, em que `true` num threshold quer dizer cruzado. */
export function lerResumoDoK6(codigo: number, resumo: unknown): ResumoDoK6 {
  const metricas = typeof resumo === 'object' && resumo !== null && 'metrics' in resumo ? (resumo.metrics as Record<string, Record<string, unknown>>) : {}
  const cruzados = Object.entries(metricas).flatMap(([metrica, valores]) =>
    Object.entries((valores['thresholds'] ?? {}) as Record<string, boolean>)
      .filter(([, cruzado]) => cruzado)
      .map(([criterio]) => ({ metrica, criterio })),
  )
  return {
    codigo,
    cruzados,
    esperaBP95Ms: numeroDaMetrica(metricas, 'espera_b', 'p(95)'),
    turnoBP95Ms: numeroDaMetrica(metricas, 'turno_b', 'p(95)'),
    interrompidas: numeroDaMetrica(metricas, 'execucoes_interrompidas', 'count'),
    temposEsgotados: numeroDaMetrica(metricas, 'tempos_esgotados_reserva', 'count'),
  }
}

/** Um número do resumo do k6, ou `undefined` quando a métrica não existe (o k6 não a escreve sem nenhuma amostra). */
function numeroDaMetrica(metricas: Record<string, Record<string, unknown>>, nome: string, campo: string): number | undefined {
  const valor = metricas[nome]?.[campo]
  return typeof valor === 'number' ? valor : undefined
}

export interface Veredito {
  passou: boolean
  reprovacoes: Reprovacao[]
  /** Reprovou por um critério de justiça entre escolas, com a fase base limpa. */
  reprovadoPelaJustica: boolean
}

/**
 * A fase do expurgo e da troca de nome da escola A (F3, tarefa 19.0) no veredito: o k6 dela e o que o banco disse. É
 * `'dispensada'` só no controle negativo, que não a roda; `undefined` é a fase que não rodou, e reprova.
 */
export type FaseDoExpurgo = 'dispensada' | { k6: ResumoDoK6; reprovacoes: readonly ReprovacaoDoExpurgo[] } | undefined

/** Junta o k6 das fases e a conferência do banco num veredito. Sem fase de carga, o ambiente nem chegou lá. */
export function julgarCenario(base: ResumoDoK6, carga: ResumoDoK6 | undefined, conferencia: ConferenciaDaCarga | undefined, expurgo: FaseDoExpurgo): Veredito {
  const reprovacoes: Reprovacao[] = []
  const doK6 = (fase: FaseDoK6, resumo: ResumoDoK6) => {
    for (const { metrica, criterio } of resumo.cruzados) reprovacoes.push({ criterio: fase === 'carga' ? metrica : `${fase}:${metrica}`, detalhe: `${fase}: ${metrica} ${criterio}` })
    // O código de saída e o resumo precisam concordar: 99 é threshold cruzado, e qualquer outro diferente de zero é o
    // k6 que não rodou até o fim (script inválido, container que caiu), mesmo com resumo limpo.
    const saidaEsperada = resumo.cruzados.length > 0 ? CODIGO_THRESHOLD_CRUZADO : 0
    if (resumo.codigo !== saidaEsperada) reprovacoes.push({ criterio: `k6_${fase}`, detalhe: `${fase}: k6 saiu com ${resumo.codigo}, e o resumo pedia ${saidaEsperada}` })
  }
  doK6('base', base)
  if (base.esperaBP95Ms === undefined) reprovacoes.push({ criterio: 'base:espera_b', detalhe: 'base: sem p95 de espera da escola B' })
  if (expurgo === undefined) reprovacoes.push({ criterio: 'k6_expurgo', detalhe: 'expurgo: a fase não rodou' })
  else if (expurgo !== 'dispensada') {
    doK6('expurgo', expurgo.k6)
    reprovacoes.push(...expurgo.reprovacoes)
  }
  if (carga === undefined) reprovacoes.push({ criterio: 'k6_carga', detalhe: 'carga: a fase não rodou' })
  else doK6('carga', carga)
  if (conferencia === undefined) reprovacoes.push({ criterio: 'job_registro', detalhe: 'conferência de job_registro não rodou' })
  else {
    for (const motivo of conferencia.reprovacoes) {
      reprovacoes.push({ criterio: motivo.includes('interativo') ? 'interativo_acima_de_30s' : 'job_registro', detalhe: `job_registro: ${motivo}` })
    }
  }
  const baseLimpa = !reprovacoes.some((reprovacao) => reprovacao.criterio.startsWith('base:') || reprovacao.criterio === 'k6_base')
  const criteriosDeJustica: readonly string[] = CRITERIOS_DE_JUSTICA
  return {
    passou: reprovacoes.length === 0,
    reprovacoes,
    reprovadoPelaJustica: baseLimpa && carga !== undefined && reprovacoes.some((reprovacao) => criteriosDeJustica.includes(reprovacao.criterio)),
  }
}

/** Zero quando o cenário faz o que se espera dele: passar com a vaga por escola, e reprovar pela justiça sem ela. */
export function codigoDeSaida(veredito: Veredito, controleNegativo: boolean): number {
  if (controleNegativo) return veredito.reprovadoPelaJustica ? 0 : 1
  return veredito.passou ? 0 : 1
}

export function argumentosDoCompose(): string[] {
  return [
    'compose',
    '--project-name',
    PROJETO_CARGA,
    ...ARQUIVOS_AMBIENTE_CARGA.flatMap((arquivo) => ['--env-file', arquivo]),
    ...ARQUIVOS_COMPOSE_CARGA.flatMap((arquivo) => ['-f', arquivo]),
  ]
}

/** Os argumentos do `k6 run` de uma fase, dentro do container. */
export function argumentosDoK6(fase: FaseDoK6, esperaBaseP95Ms?: number, turnoBaseP95Ms?: number): string[] {
  return [
    'run',
    '--quiet',
    '--no-usage-report',
    '--summary-export',
    `/execucao/resumo-${fase}.json`,
    '--env',
    `FASE=${fase}`,
    '--env',
    'API_URL=http://borda:8080',
    '--env',
    'WEB_URL=http://web:4173',
    '--env',
    'ARQUIVO_DOS_TOKENS=/execucao/tokens.json',
    ...(esperaBaseP95Ms === undefined ? [] : ['--env', `ESPERA_BASE_P95_MS=${Math.ceil(esperaBaseP95Ms)}`]),
    ...(turnoBaseP95Ms === undefined ? [] : ['--env', `TURNO_BASE_P95_MS=${Math.ceil(turnoBaseP95Ms)}`]),
    SCRIPT_DO_K6,
  ]
}

export function rodar(comando: string, argumentos: readonly string[], ambiente: NodeJS.ProcessEnv, capturar = false): Promise<{ codigo: number; saida: string }> {
  return new Promise((resolver) => {
    const processo = spawn(comando, argumentos, { cwd: raizRepositorio, env: ambiente, stdio: ['ignore', capturar ? 'pipe' : 'inherit', 'inherit'] })
    let saida = ''
    processo.stdout?.on('data', (parte: Buffer) => (saida += parte.toString()))
    processo.on('error', () => resolver({ codigo: 127, saida }))
    processo.on('close', (codigo) => resolver({ codigo: codigo ?? 1, saida }))
  })
}

/** Roda o `ops:escola` e devolve o id que ele imprime em JSON, sem ecoar a saída (ela pode trazer o slug). */
async function idDoOpsEscola(argumentos: readonly string[], ambiente: NodeJS.ProcessEnv, campo: 'redeId' | 'escolaId'): Promise<string> {
  const { codigo, saida } = await rodar('npm', ['run', '-s', 'ops:escola', '--', ...argumentos], ambiente, true)
  const linha = saida.trim().split('\n').at(-1) ?? ''
  const valor = codigo === 0 ? (JSON.parse(linha) as Record<string, unknown>)[campo] : undefined
  if (typeof valor !== 'string') throw new Error(`ops:escola não devolveu ${campo}`)
  return valor
}

/**
 * Cria a rede e as três escolas do cenário no banco do projeto de carga, que já subiu com as migrations
 * aplicadas. Endereço sorteado a cada execução: o volume é derrubado no fim, mas duas execuções sobrepostas
 * não disputam o mesmo slug.
 */
export async function criarEscolasDoCenario(ambiente: NodeJS.ProcessEnv): Promise<EscolasDoCenario> {
  const comOperador = { ...ambiente, OPERADOR: OPERADOR_DA_CARGA }
  const redeId = await idDoOpsEscola(['rede', 'criar', '--nome', 'Rede sintética da carga', '--tipo', 'independente'], comOperador, 'redeId')
  const entradas: Array<[NomeDeEscola, string]> = []
  for (const nome of NOMES_DAS_ESCOLAS) {
    const slug = `carga-${nome.toLowerCase()}-${randomUUID()}`
    entradas.push([nome, await idDoOpsEscola(['escola', 'criar', '--rede', redeId, '--nome', `Escola sintética ${nome}`, '--slug', slug], comOperador, 'escolaId')])
  }
  return Object.fromEntries(entradas) as EscolasDoCenario
}

/**
 * Uma sessão real por token, pelo `ops:sessao-sintetica`: não existe mais token sem sessão gravada. Com `semBuild`, chama o `dist` direto (que o `escola criar` e o
 * script da fase já construíram): o `npm run ops:sessao-sintetica` reconstrói três pacotes a cada chamada, e dezenas delas em paralelo se pisariam no `dist`.
 */
export async function sessoesSinteticas(ambiente: NodeJS.ProcessEnv, escolaId: string, papel: string, quantidade: number, grupo: string, semBuild = false): Promise<string[]> {
  const pedido = ['--escola', escolaId, '--papel', papel, '--quantidade', String(quantidade)]
  const { codigo, saida } = semBuild
    ? await rodar('node', ['--env-file=.env.example', 'apps/api/dist/ops/sessao-sintetica.js', ...pedido], ambiente, true)
    : await rodar('npm', ['run', '-s', 'ops:sessao-sintetica', '--', ...pedido], ambiente, true)
  const linhas = saida.split('\n').filter((linha) => linha.startsWith('ey'))
  if (codigo !== 0 || linhas.length !== quantidade) throw new Error(`ops:sessao-sintetica não criou as ${quantidade} sessões do grupo ${grupo}`)
  return linhas
}

/** Uma sessão real por token de cada grupo. */
async function gerarTokens(ambiente: NodeJS.ProcessEnv, escolas: EscolasDoCenario): Promise<Record<string, string[]>> {
  const tokens: Record<string, string[]> = {}
  for (const [grupo, { escola, papel, quantidade }] of Object.entries(TOKENS_POR_GRUPO)) tokens[grupo] = await sessoesSinteticas(ambiente, escolas[escola], papel, quantidade, grupo)
  return tokens
}

function escrever(linha: string): void {
  process.stdout.write(`${linha}\n`)
}

/** Quanto depois de o k6 começar o job do expurgo da A é gravado: os VUs da B já estão no ritmo. */
const ATRASO_DO_JOB_DO_EXPURGO_MS = 10_000
/** Quanto o cenário espera o expurgo e a troca de nome da A terminarem depois do k6: acima disso, o job não terminou no prazo. */
const PRAZO_DO_TRABALHO_DA_A_MS = 15 * 60_000

interface MeiosDoK6 {
  escreverTokens: (fase: FaseDoK6) => Promise<void>
  executarK6: (fase: FaseDoK6, esperaBaseP95Ms?: number, turnoBaseP95Ms?: number) => Promise<ResumoDoK6>
  /** O log do serviço `postgres` do projeto de carga desde o instante dado (ISO), ou `undefined` se o `docker compose logs` falhou ou veio vazio. */
  lerLogDoPostgres: (desde: string) => Promise<string | undefined>
}

/** O que a fase `base` deixou: a espera da B (k6) e o turno do Tutor da B, pelo k6 (threshold da fase) e pelo banco (veredito). */
export interface BaseDaFase {
  readonly esperaP95Ms: number
  readonly turnoK6P95Ms: number | undefined
  readonly turnoDoBancoP95Ms: number | null
}

/**
 * Se a fase do expurgo roda e com quê: dispensada no controle negativo (ela não depende da vaga por escola, e ele existe
 * para provar que a justiça reprova sem ela); sem a base, nada a comparar e a fase não roda (o veredito a aponta como
 * "não rodou"); com a base, roda com o p95 dela.
 */
export function escolherFaseDoExpurgo(
  controleNegativo: boolean,
  esperaBaseP95Ms: number | undefined,
): { fase: 'dispensada' } | { fase: 'rodar'; esperaBaseP95Ms: number } | { fase: 'sem_base' } {
  if (controleNegativo) return { fase: 'dispensada' }
  if (esperaBaseP95Ms === undefined) return { fase: 'sem_base' }
  return { fase: 'rodar', esperaBaseP95Ms }
}

/**
 * A fase do expurgo e da troca de nome (F3, tarefa 19.0): semeia a A, zera o `pg_stat_statements`, sobe o k6 da B (o job
 * sintético e o turno do Tutor, com a base no threshold), grava o job do expurgo da A `ATRASO_DO_JOB_DO_EXPURGO_MS` depois
 * e, terminado o k6, espera os jobs da A acabarem e lê o que ficou: o banco, os statements e o log do Postgres (o
 * statement cortado pelo `statement_timeout` não chega ao `pg_stat_statements`). O k6 mede a B; o banco, o resto.
 */
async function faseDoExpurgo(banco: pg.Client, escolas: EscolasDoCenario, base: BaseDaFase, { escreverTokens, executarK6, lerLogDoPostgres }: MeiosDoK6): Promise<{ k6: ResumoDoK6; reprovacoes: ReprovacaoDoExpurgo[] }> {
  const escolaA = escolas.A
  // Antes da semente, e não só da medição: o log da fase nunca fica vazio (o checkpoint da semente entra nele).
  const inicioDaFase = new Date().toISOString()
  escrever(`\n▶ escola A: semente do expurgo (${LINHAS_VENCIDAS_DA_A} linhas vencidas e um pedido de eliminação)`)
  await liberarJanelaDaA(banco, escolaA)
  const semente = await semearEscolaA(banco, escolaA)
  await escreverTokens('expurgo')
  // Sem o módulo carregado, o `reset` falha: a medição vira "sem amostra" no veredito, e a fase segue para o k6.
  let medindo = true
  try {
    await prepararMedicaoDeStatements(banco)
  } catch (erro) {
    medindo = false
    escrever(`  medição de statements indisponível: ${erro instanceof Error ? erro.message : String(erro)}`)
  }
  const execucaoDoK6 = executarK6('expurgo', base.esperaP95Ms, base.turnoK6P95Ms)
  await esperar(ATRASO_DO_JOB_DO_EXPURGO_MS)
  await enfileirarExpurgoDaA(banco, escolaA)
  const k6 = await execucaoDoK6
  escrever('\n▶ expurgo da escola A: espera do trabalho e conferência')
  const trabalho = await aguardarTrabalhoDaA(banco, escolaA, PRAZO_DO_TRABALHO_DA_A_MS)
  // Os statements primeiro: as conferências abaixo também são statements, e não são do expurgo.
  const statements = medindo ? await lerStatements(banco).catch(() => undefined) : undefined
  const log = await lerLogDoPostgres(inicioDaFase)
  const turnoDaB: EsperaDaBNoTrabalho = await lerTurnoDaBNaJanela(banco, escolas.B, trabalho)
  const resultado: ResultadoDoExpurgo = {
    volumeVencidoAntes: LINHAS_VENCIDAS_DA_A,
    trabalho,
    resto: await lerRestoDaA(banco, escolaA, semente),
    statements,
    esperaDaB: await lerEsperaDaBNoTrabalho(banco, escolas.B, trabalho),
    esperaBaseP95Ms: base.esperaP95Ms,
    turnoDaB,
    // Sem a base medida no banco, o limite fica só na margem (0 + MARGEM_SOBRE_A_BASE_MS): o mais apertado que há. A medida
    // do k6 não entra no lugar dela: é outra medida (inclui as leituras de estado) e é maior. Sem a base do k6, o script
    // do k6 desta fase recusa subir ("a fase expurgo precisa de TURNO_BASE_P95_MS").
    turnoBaseP95Ms: base.turnoDoBancoP95Ms ?? 0,
    statementsCancelados: log === undefined ? undefined : contarStatementsCancelados(log),
    ...(log === undefined ? {} : { formasDosCancelados: formasDosStatementsCancelados(log) }),
  }
  // A escrita a mais dos índices de anonimização por turno do Tutor (TODO.md, F3 4.0): só informativa, com o banco parado.
  const escrita = await medirEscritaDosIndices(banco, escolaA, semente.anoId)
  for (const linha of descreverExpurgo(resultado, escrita)) escrever(linha)
  return { k6, reprovacoes: julgarResultadoDoExpurgo(resultado) }
}

// ---------------------------------------------------------------------------------------------------------------------
// A carga da manhã (X6, tarefa 11.0; RF6): `FASE=sala` de infra/k6/justica-entre-escolas.js
// ---------------------------------------------------------------------------------------------------------------------

/** O que o k6 da sala tem escrito nas constantes dele, e que `infra/test/carga.test.ts` confere contra estas: 10 escolas, 6 turmas, 60 alunos e 2 professoras em cada. */
export const ESCOLAS_DA_SALA = 10
export const TURMAS_POR_ESCOLA_DA_SALA = 6
export const ALUNOS_POR_ESCOLA_DA_SALA = 60
export const PROFESSORAS_POR_ESCOLA_DA_SALA = 2
export const DISCIPLINA_DA_SALA = 'Química'
/** RF6: a espera p95 do Tutor fica abaixo de 2 s, e a da ferramenta, abaixo de 10 s, em cada escola. */
export const ESPERA_P95_DO_TUTOR_MS = 2_000
export const ESPERA_P95_DA_FERRAMENTA_MS = 10_000
/** Menos amostras que isto numa escola e numa fila, e o p95 não diz nada: a fase reprova como "sem amostra". */
export const AMOSTRAS_MINIMAS_DA_SALA = 10
/** O `kill -9` do `worker-ia-1` no meio da fase: com a carga já no ritmo, e o que sobra da fase para a reentrega e a volta do worker. */
export const ATRASO_DO_KILL_MS = 75_000
export const ESPERA_ATE_A_VOLTA_DO_WORKER_MS = 5_000
/** O tempo que a telemetria leva para chegar ao Prometheus depois do fim do k6 (`TELEMETRIA_INTERVALO_MS` e a coleta). */
const PRAZO_DA_TELEMETRIA_MS = 20_000
const INTERVALO_DA_AMOSTRA_MS = 10_000
export const WORKERS_DE_IA = ['worker-ia-1', 'worker-ia-2'] as const

/**
 * O adaptador falso da carga da manhã: 6 s no `rapido` (o turno do Tutor e a proposta) e 50 s no `padrao` (a ferramenta), e os 3.000 + 250 tokens por
 * chamada de `docs/infra.md` 3.2, para o limite de tokens por minuto morder na escala do cenário. As outras fases ficam com a latência de `infra/carga.env`
 * (300 ms) e a estimativa pelo texto: é a mesma medida do build anterior, que a comparação do RF6 exige.
 */
export function ambienteDoFalso(fase: FaseDoK6): Record<string, string> {
  if (fase === 'sala' || fase === 'reserva') return { IA_LATENCIA_FALSA_MS: '6000', IA_LATENCIA_FALSA_MS_PADRAO: '50000', IA_TOKENS_FALSOS_ENTRADA: '3000', IA_TOKENS_FALSOS_SAIDA: '250' }
  return { IA_LATENCIA_FALSA_MS_PADRAO: '0', IA_TOKENS_FALSOS_ENTRADA: '0', IA_TOKENS_FALSOS_SAIDA: '0' }
}

/** A carga nunca chama provedor pago (regra 80, item 11; regra 30, item 3): o adaptador que o ambiente diz é o falso, ou o script não sobe nada. */
export function exigirAdaptadorFalso(variaveis: Readonly<Record<string, string | undefined>>): void {
  const adaptador = variaveis['IA_ADAPTADOR']
  if (adaptador !== 'falso') throw new Error(`a carga só roda com IA_ADAPTADOR=falso (veio ${adaptador ?? 'nada'}): ela nunca chama provedor pago`)
}

/** O adaptador do ambiente de carga: o de `infra/carga.env`, e na falta dele o do `.env.example`, a mesma ordem em que o compose os lê. */
export function adaptadorDoAmbienteDeCarga(doArquivo: Readonly<Record<string, string>>): Record<string, string | undefined> {
  const exemplo = parseEnv(readFileSync(join(raizRepositorio, '.env.example'), 'utf8'))
  return { IA_ADAPTADOR: doArquivo['IA_ADAPTADOR'] ?? exemplo['IA_ADAPTADOR'] }
}

export interface MedidaDaEscolaDaSala {
  /** `e1` a `e10`, o nome que o k6 e o relatório usam. */
  readonly escola: string
  readonly amostrasDoTutor: number
  /** A espera até o job começar, de `criado_em` a `iniciado_em`, na fila `interativa`. */
  readonly esperaDoTutorP95Ms: number | null
  readonly amostrasDaFerramenta: number
  /** O mesmo, na fila `ferramenta`. */
  readonly esperaDaFerramentaP95Ms: number | null
  /** O turno do Tutor, de `criada_em` a `concluida_em`, em `execucao_agente`: o que o aluno espera. */
  readonly turnoDoTutorP95Ms: number | null
}

export interface ResultadoDaSala {
  readonly k6: ResumoDoK6
  readonly escolas: readonly MedidaDaEscolaDaSala[]
  /** Os `EXECUCAO_INTERROMPIDA` que o k6 contou: o `kill -9` os produz, e só eles saem de `respostas_inesperadas`. */
  readonly interrompidas: number
  /** As execuções em `rodando` lidas **antes** do `kill -9`: o teto das interrompidas (os jobs ativos das réplicas, que a réplica morta nunca passa). */
  readonly tetoDeInterrompidas: number
  /** As execuções `falhou` no banco com qualquer erro que não seja `EXECUCAO_INTERROMPIDA`: a carga da manhã não pode ter nenhuma. */
  readonly falhasForaDoKill: number
  readonly indisponiveis: number
  /** `ia.degradacao{degrau="espera"}` na janela: as reservas que o balde recusou. `undefined`: o Prometheus não respondeu. */
  readonly reservasRecusadas: number | undefined
}

/** O que reprova a carga da manhã: os thresholds do k6, o contador do `kill -9`, as esperas de cada escola e o teto que não mordeu. Relatório, não portão: o código de saída é o que a corrida diz, e o relatório o registra. */
export function julgarSala(resultado: ResultadoDaSala): Reprovacao[] {
  const reprovacoes: Reprovacao[] = []
  for (const { metrica, criterio } of resultado.k6.cruzados) reprovacoes.push({ criterio: `sala:${metrica}`, detalhe: `sala: ${metrica} ${criterio}` })
  const saidaEsperada = resultado.k6.cruzados.length > 0 ? CODIGO_THRESHOLD_CRUZADO : 0
  if (resultado.k6.codigo !== saidaEsperada) reprovacoes.push({ criterio: 'k6_sala', detalhe: `sala: k6 saiu com ${resultado.k6.codigo}, e o resumo pedia ${saidaEsperada}` })
  if (resultado.interrompidas > resultado.tetoDeInterrompidas) {
    reprovacoes.push({ criterio: 'interrompidas_acima_do_teto', detalhe: `sala: ${resultado.interrompidas} execuções interrompidas, e os jobs ativos lidos antes do kill eram ${resultado.tetoDeInterrompidas}` })
  }
  if (resultado.interrompidas === 0) reprovacoes.push({ criterio: 'kill_sem_efeito', detalhe: 'sala: o kill -9 do worker-ia-1 não interrompeu nenhuma execução: a fase não provou a reentrega' })
  if (resultado.falhasForaDoKill > 0) reprovacoes.push({ criterio: 'falhas_fora_do_kill', detalhe: `sala: ${resultado.falhasForaDoKill} execuções falharam com outro erro que não EXECUCAO_INTERROMPIDA` })
  if (resultado.indisponiveis > 0) reprovacoes.push({ criterio: 'indisponivel', detalhe: `sala: ${resultado.indisponiveis} execuções terminaram IA_INDISPONIVEL` })
  for (const escola of resultado.escolas) {
    const julgar = (fila: string, amostras: number, p95: number | null, limite: number) => {
      if (amostras < AMOSTRAS_MINIMAS_DA_SALA || p95 === null) reprovacoes.push({ criterio: `sem_amostra_${fila}`, detalhe: `sala: ${escola.escola} tem ${amostras} jobs da fila ${fila}, e o p95 pede ao menos ${AMOSTRAS_MINIMAS_DA_SALA}` })
      else if (p95 >= limite) reprovacoes.push({ criterio: `espera_${fila}`, detalhe: `sala: ${escola.escola} espera p95 de ${Math.round(p95)} ms na fila ${fila}, e o limite é ${limite} ms` })
    }
    julgar('interativa', escola.amostrasDoTutor, escola.esperaDoTutorP95Ms, ESPERA_P95_DO_TUTOR_MS)
    julgar('ferramenta', escola.amostrasDaFerramenta, escola.esperaDaFerramentaP95Ms, ESPERA_P95_DA_FERRAMENTA_MS)
  }
  if (resultado.reservasRecusadas === 0) reprovacoes.push({ criterio: 'balde_nao_recusou', detalhe: 'sala: o balde de tokens não recusou nenhuma reserva: o LLM_TOKENS_POR_MINUTO da carga não mordeu, e o teto não foi provado' })
  return reprovacoes
}

/** A memória de `docker stats` ("123.4MiB / 15.5GiB"), em MiB. */
export function memoriaEmMiB(uso: string): number | undefined {
  const achado = /^\s*([\d.]+)\s*(B|KiB|MiB|GiB)\b/.exec(uso)
  if (achado === null) return undefined
  const valor = Number(achado[1])
  const fator = { B: 1 / 1_048_576, KiB: 1 / 1_024, MiB: 1, GiB: 1_024 }[achado[2] as 'B' | 'KiB' | 'MiB' | 'GiB']
  return Number.isFinite(valor) ? valor * fator : undefined
}

/** Os nomes das escolas da sala: `e1` a `e10`, o mesmo rótulo `escola` do k6. */
export function nomesDasEscolasDaSala(): string[] {
  return Array.from({ length: ESCOLAS_DA_SALA }, (_, indice) => `e${indice + 1}`)
}

/** A rede e as dez escolas da sala, pelo `ops:escola`, no banco do projeto de carga. */
export async function criarEscolasDaSala(ambiente: NodeJS.ProcessEnv): Promise<string[]> {
  const comOperador = { ...ambiente, OPERADOR: OPERADOR_DA_CARGA }
  const redeId = await idDoOpsEscola(['rede', 'criar', '--nome', 'Rede sintética da carga da manhã', '--tipo', 'independente'], comOperador, 'redeId')
  const escolas: string[] = []
  for (const nome of nomesDasEscolasDaSala()) {
    const slug = `carga-${nome}-${randomUUID()}`
    escolas.push(await idDoOpsEscola(['escola', 'criar', '--rede', redeId, '--nome', `Escola sintética ${nome}`, '--slug', slug], comOperador, 'escolaId'))
  }
  return escolas
}

/** O capítulo de Estequiometria da carga: seis páginas de frases definitórias, que o adaptador falso da atividade aproveita (com poucas frases ele recusa com `MATERIAL_INSUFICIENTE`). Sintético. */
const PAGINAS_DO_MATERIAL_DA_SALA = [
  'Contar átomos um a um é impossível: eles são pequenos demais e numerosos demais. Por isso a Química conta em mols, do mesmo jeito que o comércio conta ovos em dúzias. ' +
    'O mol é a unidade de quantidade de matéria do Sistema Internacional. A constante de Avogadro é o número de entidades elementares que existem em um mol de matéria. ' +
    'Um mol de qualquer substância contém 6,02 × 10²³ entidades elementares. A entidade elementar é o átomo, a molécula, o íon ou a fórmula unitária que compõe a substância.',
  'A massa molar é a massa, em gramas, de um mol de uma substância. A massa atômica é a massa de um átomo expressa em unidades de massa atômica. ' +
    'A massa molar da água é 18 g/mol. A massa molar do gás carbônico é 44 g/mol. A massa molar do gás oxigênio é 32 g/mol. A massa molar do cloreto de sódio é 58,5 g/mol. ' +
    'Para passar de massa para quantidade de matéria, divide-se a massa da amostra pela massa molar da substância. Assim, 36 g de água correspondem a 2 mol de água.',
  'A equação química é a representação de uma reação por meio de fórmulas e coeficientes. ' +
    'O coeficiente estequiométrico é o número que indica a proporção, em mols, de cada substância na equação balanceada. ' +
    'A lei da conservação da massa é o princípio segundo o qual a massa total dos reagentes se mantém nos produtos. ' +
    'Uma equação balanceada é aquela em que cada elemento tem o mesmo número de átomos nos dois lados. ' +
    'Antes de qualquer cálculo, confere-se o balanceamento: conta feita sobre equação desbalanceada sai errada.',
  'A proporção estequiométrica é a relação entre as quantidades de matéria de reagentes e produtos indicada pelos coeficientes. ' +
    'Na síntese da água, 2 mol de gás hidrogênio reagem com 1 mol de gás oxigênio e formam 2 mol de água. ' +
    'O cálculo estequiométrico é o procedimento que usa a proporção da equação para prever quantidades de reagentes e produtos. ' +
    'O caminho costuma ter três passos: converter a massa dada em mols, aplicar a proporção da equação e converter o resultado para a unidade pedida.',
  'Nem sempre os reagentes são misturados na proporção exata da equação. O reagente limitante é o reagente que acaba primeiro e determina a quantidade máxima de produto. ' +
    'O reagente em excesso é o reagente que sobra quando a reação termina. ' +
    'Para achar o limitante, compara-se a quantidade disponível de cada reagente, em mols, com a proporção da equação balanceada.',
  'O rendimento teórico é a quantidade máxima de produto prevista pela proporção estequiométrica. O rendimento real é a quantidade de produto obtida de fato no experimento. ' +
    'O rendimento percentual corresponde a cem vezes a razão entre o rendimento real e o rendimento teórico. A pureza é a porcentagem da amostra formada pela substância de interesse. ' +
    'Perdas no manuseio, reações paralelas e reagentes impuros explicam por que o rendimento real fica abaixo do teórico.',
]

/** O que as funções de banco da carga da manhã usam: o `Client` da corrida e o `Pool` do teste. */
type Consultavel = Pick<pg.ClientBase, 'query'>

/**
 * A estrutura de uma escola da sala, depois de as sessões criarem os usuários dela: o ano, uma série, seis turmas, a disciplina e o material `pronto` da série
 * (sem ele a ferramenta e a proposta respondem `SEM_MATERIAL_DA_SERIE`), os 60 alunos distribuídos nas turmas e as professoras com vínculo confirmado nas seis,
 * na disciplina. É o que o `semearTutorDaB` faz para uma turma, em escala, e o que a Tutor e a ferramenta leem. Devolve a turma e a disciplina que o k6 usa.
 */
export async function semearEscolaDaSala(banco: Consultavel, escolaId: string): Promise<{ turmaId: string; disciplinaId: string }> {
  const primeiro = async (texto: string, valores: unknown[]): Promise<string> => {
    const id = (await banco.query<{ id: string }>(texto, valores)).rows[0]?.id
    if (id === undefined) throw new Error('linha da estrutura da sala não criada')
    return id
  }
  const anoId = await primeiro(
    `insert into ano_letivo (escola_id, ano, inicio, fim, situacao)
     values ($1, extract(year from now())::int, make_date(extract(year from now())::int, 2, 1), make_date(extract(year from now())::int, 12, 15), 'em_curso') returning id`,
    [escolaId],
  )
  const serieId = await primeiro("insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [escolaId])
  const turmas: string[] = []
  for (let n = 1; n <= TURMAS_POR_ESCOLA_DA_SALA; n += 1) {
    turmas.push(await primeiro('insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4) returning id', [escolaId, anoId, serieId, `2ºS${n} sintética da sala`]))
  }
  const disciplinaId = await primeiro('insert into disciplina (escola_id, nome) values ($1, $2) returning id', [escolaId, DISCIPLINA_DA_SALA])
  const materialId = await primeiro(
    `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, paginas, estado)
     values ($1, $2, 'Química 2, capítulo 7: Estequiometria', 'escola', 'autoria_da_escola', true, $3, 48000, $4, 'pronto') returning id`,
    [escolaId, disciplinaId, randomBytes(32).toString('hex'), PAGINAS_DO_MATERIAL_DA_SALA.length],
  )
  await banco.query('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [escolaId, materialId, serieId])
  for (const [indice, texto] of PAGINAS_DO_MATERIAL_DA_SALA.entries()) {
    await banco.query('insert into trecho (escola_id, disciplina_id, material_id, pagina, texto) values ($1, $2, $3, $4, $5)', [escolaId, disciplinaId, materialId, indice + 1, texto])
  }
  // O autor dos vínculos é qualquer professora da escola: o `order by id limit 1` só o torna estável, e nenhuma é especial.
  const autorId = await primeiro("select id from usuario where escola_id = $1 and papel = 'professor' order by id limit 1", [escolaId])
  // Os alunos, em rodízio pelas seis turmas; as professoras, nas seis, na disciplina.
  // ATALHO SÓ DA CARGA, sintética: o vínculo do aluno entra `confirmado` direto no banco, com uma professora como `criado_por`. O caminho real é o da D4
  // (reivindicação do nome aprovada pelo professor, ou a conta da escola importada); não copie este padrão para seed nem para importação.
  await banco.query(
    `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em)
     select $1, $2, u.id, ($3::uuid[])[1 + ((row_number() over (order by u.id) - 1) % $5::int)::int], 'aluno', 'confirmado', $4, now()
       from usuario u where u.escola_id = $1 and u.papel = 'aluno'`,
    [escolaId, anoId, turmas, autorId, TURMAS_POR_ESCOLA_DA_SALA],
  )
  await banco.query(
    `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em)
     select $1, $2, u.id, t.turma_id, $4, 'professor', 'confirmado', $5, now()
       from usuario u cross join unnest($3::uuid[]) as t(turma_id) where u.escola_id = $1 and u.papel = 'professor'`,
    [escolaId, anoId, turmas, disciplinaId, autorId],
  )
  return { turmaId: turmas[0] ?? '', disciplinaId }
}

const MEDIDA_DA_SALA = `
  select e.id as "escolaId",
         (select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDoTutor",
         (select percentile_cont(0.95) within group (order by extract(epoch from j.iniciado_em - j.criado_em)::float8 * 1000) from job_registro j
           where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDoTutorP95Ms",
         (select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDaFerramenta",
         (select percentile_cont(0.95) within group (order by extract(epoch from j.iniciado_em - j.criado_em)::float8 * 1000) from job_registro j
           where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDaFerramentaP95Ms",
         (select percentile_cont(0.95) within group (order by extract(epoch from x.concluida_em - x.criada_em)::float8 * 1000) from execucao_agente x
           where x.escola_id = e.id and x.funcao = 'tutor_com_o_aluno' and x.estado = 'concluida' and x.criada_em >= $2) as "turnoDoTutorP95Ms"
    from escola e where e.id = any($1::uuid[])`

/** A espera e o turno de cada escola da sala depois de `desde` (o relógio do banco), pelo `job_registro` e pela `execucao_agente`. Rotina nossa de teste, sem contexto de requisição (regra 10, item 9). */
export async function medirEscolasDaSala(banco: Consultavel, escolas: readonly string[], desde: Date): Promise<MedidaDaEscolaDaSala[]> {
  const { rows } = await banco.query<Record<string, unknown>>(MEDIDA_DA_SALA, [escolas, desde])
  const nomes = nomesDasEscolasDaSala()
  const talvez = (valor: unknown): number | null => (valor === null || valor === undefined ? null : Number(valor))
  return escolas.map((id, indice) => {
    const linha = rows.find((candidata) => candidata['escolaId'] === id) ?? {}
    return {
      escola: nomes[indice] ?? id,
      amostrasDoTutor: Number(linha['amostrasDoTutor'] ?? 0),
      esperaDoTutorP95Ms: talvez(linha['esperaDoTutorP95Ms']),
      amostrasDaFerramenta: Number(linha['amostrasDaFerramenta'] ?? 0),
      esperaDaFerramentaP95Ms: talvez(linha['esperaDaFerramentaP95Ms']),
      turnoDoTutorP95Ms: talvez(linha['turnoDoTutorP95Ms']),
    }
  })
}

/** As execuções em `rodando` agora: o teto das interrompidas do `kill -9` (a réplica morta tem, no máximo, os jobs ativos que as duas réplicas têm juntas). */
export async function contarExecucoesRodando(banco: Consultavel, escolas: readonly string[]): Promise<number> {
  const { rows } = await banco.query<{ n: number }>("select count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'rodando'", [escolas])
  return rows[0]?.n ?? 0
}

/** O que falhou na janela, por erro: `EXECUCAO_INTERROMPIDA` é do `kill -9`; qualquer outro é falha da carga. */
export async function falhasDaSala(banco: Consultavel, escolas: readonly string[], desde: Date): Promise<Record<string, number>> {
  const { rows } = await banco.query<{ erro: string; n: number }>(
    "select erro, count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'falhou' and criada_em >= $2 group by erro",
    [escolas, desde],
  )
  return Object.fromEntries(rows.map((linha) => [linha.erro, linha.n]))
}

/** O consumo registrado na janela: chamadas, tokens e custo (o preço do adaptador falso), no que a professora pediu e no que o aluno pediu. */
export async function consumoDaSala(banco: Consultavel, escolas: readonly string[], desde: Date): Promise<{ funcao: string; chamadas: number; tokens: number; custoMicros: number }[]> {
  const { rows } = await banco.query<{ funcao: string; chamadas: number; tokens: string; custo: string }>(
    `select funcao, count(*)::int as chamadas, coalesce(sum(tokens_de_entrada + tokens_de_saida), 0) as tokens, coalesce(sum(custo_micros), 0) as custo
       from consumo_ia where escola_id = any($1::uuid[]) and em >= $2 group by funcao order by funcao`,
    [escolas, desde],
  )
  return rows.map((linha) => ({ funcao: linha.funcao, chamadas: linha.chamadas, tokens: Number(linha.tokens), custoMicros: Number(linha.custo) }))
}

async function consultarPrometheus(prometheus: string, expressao: string, instante: Date): Promise<number | undefined> {
  try {
    const resposta = await fetch(`${prometheus}/api/v1/query?${new URLSearchParams({ query: expressao, time: String(instante.getTime() / 1_000) })}`)
    if (!resposta.ok) return undefined
    const corpo = (await resposta.json()) as { data: { result: Array<{ value: [number, string] }> } }
    const valores = corpo.data.result.map((serie) => Number(serie.value[1]))
    return valores.length === 0 ? 0 : valores.reduce((soma, valor) => soma + valor, 0)
  } catch {
    return undefined
  }
}

/** O que a telemetria diz da janela: as reservas recusadas pelo balde (por degrau), o pico do balde geral e o pico de conexões do pool em uso. */
export async function telemetriaDaSala(
  prometheus: string,
  janela: { inicio: Date; fim: Date },
): Promise<{ espera: number | undefined; modeloMenor: number | undefined; indisponivel: number | undefined; picoDoBalde: number | undefined; picoDoPool: number | undefined }> {
  const segundos = Math.max(10, Math.ceil((janela.fim.getTime() - janela.inicio.getTime()) / 1_000))
  const degrau = (nome: string) => consultarPrometheus(prometheus, `sum(increase(ia_degradacao_total{degrau="${nome}"}[${String(segundos)}s]))`, janela.fim)
  return {
    espera: await degrau('espera'),
    modeloMenor: await degrau('modelo_menor'),
    indisponivel: await degrau('indisponivel'),
    picoDoBalde: await consultarPrometheus(prometheus, `max(max_over_time(ia_tokens_uso_do_teto[${String(segundos)}s]))`, janela.fim),
    picoDoPool: await consultarPrometheus(prometheus, `max(max_over_time(db_pool_em_uso[${String(segundos)}s]))`, janela.fim),
  }
}

export interface AmostrasDaSala {
  /** O maior RSS visto, em MiB, de cada `worker-ia`. */
  readonly rssMaximoMiB: Record<string, number>
  /** O maior número de conexões abertas no Postgres numa amostra. */
  readonly conexoesMaximas: number
}

/** Amostra, a cada 10 s, o RSS dos dois `worker-ia` (`docker stats`) e as conexões do Postgres, até `parar` ser chamado. */
export function amostrarASala(banco: pg.Client, ambiente: NodeJS.ProcessEnv): { parar: () => Promise<AmostrasDaSala> } {
  const rss: Record<string, number> = {}
  let conexoes = 0
  let ativo = true
  const laco = (async () => {
    while (ativo) {
      for (const worker of WORKERS_DE_IA) {
        const { codigo, saida } = await rodar('docker', ['stats', '--no-stream', '--format', '{{.MemUsage}}', `${PROJETO_CARGA}-${worker}-1`], ambiente, true)
        const miB = codigo === 0 ? memoriaEmMiB(saida) : undefined
        if (miB !== undefined) rss[worker] = Math.max(rss[worker] ?? 0, miB)
      }
      try {
        const { rows } = await banco.query<{ n: number }>('select count(*)::int as n from pg_stat_activity')
        conexoes = Math.max(conexoes, rows[0]?.n ?? 0)
      } catch {
        // A amostra que falha não derruba a fase: o relatório diz o maior valor visto.
      }
      await esperar(INTERVALO_DA_AMOSTRA_MS)
    }
  })()
  return {
    parar: async () => {
      ativo = false
      await laco
      return { rssMaximoMiB: rss, conexoesMaximas: conexoes }
    },
  }
}

/** O relatório da carga da manhã, linha a linha: é o que a seção "Divergências" do `11_task.md` e `docs/infra.md` 3.2 registram. */
export function descreverSala(resultado: ResultadoDaSala, extras: { amostras: AmostrasDaSala; telemetria: Awaited<ReturnType<typeof telemetriaDaSala>>; consumo: Awaited<ReturnType<typeof consumoDaSala>>; falhas: Record<string, number> }): string[] {
  const ms = (valor: number | null) => (valor === null ? '-' : `${Math.round(valor)} ms`)
  const numero = (valor: number | undefined) => (valor === undefined ? 'não lido' : String(Math.round(valor)))
  const linhas = ['', '▶ carga da manhã (FASE=sala): por escola', '  escola   espera Tutor p95 (jobs)   espera ferramenta p95 (jobs)   turno do Tutor p95']
  for (const escola of resultado.escolas) {
    linhas.push(`  ${escola.escola.padEnd(7)}  ${ms(escola.esperaDoTutorP95Ms).padEnd(10)} (${String(escola.amostrasDoTutor).padStart(4)})      ${ms(escola.esperaDaFerramentaP95Ms).padEnd(10)} (${String(escola.amostrasDaFerramenta).padStart(3)})           ${ms(escola.turnoDoTutorP95Ms)}`)
  }
  linhas.push(
    `  execuções interrompidas pelo kill -9: ${resultado.interrompidas} (teto lido antes: ${resultado.tetoDeInterrompidas}); outras falhas: ${resultado.falhasForaDoKill}; "indisponível": ${resultado.indisponiveis}`,
    `  falhas por erro no banco: ${Object.entries(extras.falhas).map(([erro, n]) => `${erro} ${n}`).join(', ') || 'nenhuma'}`,
    `  balde de tokens: reservas que esperaram ${numero(extras.telemetria.espera)}, foram ao modelo menor ${numero(extras.telemetria.modeloMenor)}, terminaram indisponíveis ${numero(extras.telemetria.indisponivel)}; pico do balde geral ${extras.telemetria.picoDoBalde === undefined ? 'não lido' : extras.telemetria.picoDoBalde.toFixed(2)} do contratado (0,80 é cheio)`,
    `  pool do banco: pico de conexões em uso ${numero(extras.telemetria.picoDoPool)} (a espera por conexão não tem métrica: só o em uso); conexões abertas no Postgres, no máximo ${extras.amostras.conexoesMaximas}`,
    `  RSS do worker-ia: ${Object.entries(extras.amostras.rssMaximoMiB).map(([nome, miB]) => `${nome} ${Math.round(miB)} MiB`).join(', ') || 'não lido'}`,
  )
  for (const linha of extras.consumo) {
    linhas.push(`  consumo ${linha.funcao}: ${linha.chamadas} chamadas, ${linha.tokens} tokens, ${linha.custoMicros} micros`)
  }
  return linhas
}

// ---------------------------------------------------------------------------------------------------------------------
// A queda do principal (F5b, tarefa 9.0; RF3): `FASE=reserva` de infra/k6/justica-entre-escolas.js
// ---------------------------------------------------------------------------------------------------------------------

export type NomeDaJanela = 'controle' | '5xx' | 'prazo' | '429' | 'balde'

export interface JanelaDaReserva {
  readonly nome: NomeDaJanela
  /** Quanto dura a carga da janela, em segundos: o k6 tem a mesma lista (`DURACOES_DAS_JANELAS_DA_RESERVA_S`), e `infra/test/carga.test.ts` as confere. */
  readonly duracaoS: number
  /** O `IA_FALHA_FALSA` do worker na janela: o principal falso falha de propósito. Ausente, ele atende. */
  readonly falha: string | undefined
  /** A reserva falsa ligada. Só o controle a tem desligada: é a configuração da `sala`, e o p95 dele é a referência das outras janelas. */
  readonly reserva: boolean
  /** O contratado do principal na janela, quando não é o de `infra/carga.env`: o do balde cheio é menor, para a carga do pico passar do balde e o transbordo acontecer. */
  readonly tokensPorMinuto: number | undefined
}

/** O intervalo sem carga entre duas janelas: o tempo de o worker parar (até 20 s com um job de 50 s em curso) e subir de novo com a configuração da janela seguinte. */
export const INTERVALO_ENTRE_AS_JANELAS_S = 70

/**
 * Quanto o script espera, depois do fim da carga de uma janela, antes de recriar os `worker-ia`: a ferramenta de 50 s que começou no último instante da carga precisa
 * terminar. O `stop_grace_period` do worker dá mais 20 s aos jobs em voo, e o intervalo cobre a espera, a graça e a subida do worker novo. Recriar logo (2 s) abortava a
 * ferramenta em voo, e o aluno via `sem_conclusao` (a primeira corrida da 9.0 perdeu uma ferramenta por escola em cada troca).
 */
export const DRENAGEM_ANTES_DE_TROCAR_O_WORKER_S = 45
/**
 * O contratado do principal na janela do balde cheio. O balde geral é 80 % dele (960 mil por minuto), e a carga do pico são 1,625 milhão por minuto (`ESCOLAS_DA_SALA` × 50 chamadas × 3.250 tokens):
 * o balde enche aos 35 s da janela de 60 s, e a chamada que chega depois espera os 8 s do degrau, sem modelo menor, e vai à reserva. O da `sala` (1,95 milhão) deixa o balde 4 % abaixo da carga, de propósito, para a espera bastar.
 */
export const LLM_TOKENS_POR_MINUTO_NO_BALDE_CHEIO = 1_200_000
/** RF3 e `cenarios.md` §5: o p95 do turno do Tutor na queda fica até 1 s acima do da janela de controle (a configuração da `sala`). */
export const ACRESCIMO_MAXIMO_DO_TURNO_NA_QUEDA_MS = 1_000
/** Menos turnos que isto numa janela e o p95 não diz nada: a janela reprova como "sem amostra". */
export const AMOSTRAS_MINIMAS_DA_JANELA = 30
/** O id do controle negativo: o provedor de reserva que o worker aceita na subida e que não tem entrada em `MODELOS_APROVADOS`, logo não é elegível para nenhuma tarefa. */
export const PROVEDOR_DA_RESERVA_SEM_APROVACAO = 'falso-sem-aprovacao'

export const JANELAS_DA_RESERVA: readonly JanelaDaReserva[] = [
  { nome: 'controle', duracaoS: 30, falha: undefined, reserva: false, tokensPorMinuto: undefined },
  { nome: '5xx', duracaoS: 30, falha: 'principal:5xx', reserva: true, tokensPorMinuto: undefined },
  { nome: 'prazo', duracaoS: 30, falha: 'principal:prazo', reserva: true, tokensPorMinuto: undefined },
  { nome: '429', duracaoS: 30, falha: 'principal:429', reserva: true, tokensPorMinuto: undefined },
  { nome: 'balde', duracaoS: 60, falha: undefined, reserva: true, tokensPorMinuto: LLM_TOKENS_POR_MINUTO_NO_BALDE_CHEIO },
]

/** O segundo, contado do começo da carga do k6, em que a janela `indice` começa (ou termina, com `fim`). */
export function limiteDaJanelaS(indice: number, fim = false): number {
  const antes = JANELAS_DA_RESERVA.slice(0, indice).reduce((soma, janela) => soma + janela.duracaoS + INTERVALO_ENTRE_AS_JANELAS_S, 0)
  return fim ? antes + (JANELAS_DA_RESERVA[indice]?.duracaoS ?? 0) : antes
}

/**
 * As variáveis do worker na janela. Sem janela (a `sala` e a subida do ambiente) a reserva e a falha ficam **vazias**, e vazio vale como ausente na configuração: o que o shell exportar não
 * passa na frente, e a `sala` segue comparável à X6. O adaptador e o contratado da reserva vêm de `infra/carga.env` (`RESERVA_DA_CARGA_*`), que não os dá a nenhuma outra fase; o controle negativo
 * troca só o id do provedor.
 */
export function variaveisDaReserva(janela: JanelaDaReserva | undefined, doArquivo: Readonly<Record<string, string>>, controleNegativo = false): Record<string, string> {
  const ligada = janela?.reserva === true
  const provedor = controleNegativo ? PROVEDOR_DA_RESERVA_SEM_APROVACAO : doArquivo['RESERVA_DA_CARGA_PROVEDOR_ID']
  return {
    IA_RESERVA_ADAPTADOR: daReserva(ligada, doArquivo['RESERVA_DA_CARGA_ADAPTADOR']),
    IA_RESERVA_PROVEDOR_ID: daReserva(ligada, provedor),
    LLM_RESERVA_TOKENS_POR_MINUTO: daReserva(ligada, doArquivo['RESERVA_DA_CARGA_TOKENS_POR_MINUTO']),
    IA_FALHA_FALSA: janela?.falha ?? '',
    ...(janela?.tokensPorMinuto === undefined ? {} : { LLM_TOKENS_POR_MINUTO: String(janela.tokensPorMinuto) }),
  }
}

/** O valor da reserva na janela: o que o arquivo diz quando ela está ligada, e vazio (ausente para o worker) quando não está. */
function daReserva(ligada: boolean, valor: string | undefined): string {
  return ligada ? (valor ?? '') : ''
}

/** A reserva da carga é sempre a falsa (regra 80, item 11; regra 30, item 3): o `infra/carga.env` que diga outra coisa derruba o script antes de subir. */
export function exigirReservaFalsa(doArquivo: Readonly<Record<string, string>>): void {
  const adaptador = doArquivo['RESERVA_DA_CARGA_ADAPTADOR']
  if (adaptador !== 'falso') throw new Error(`a carga só roda com RESERVA_DA_CARGA_ADAPTADOR=falso (veio ${adaptador ?? 'nada'}): ela nunca chama provedor pago`)
}

export interface MedidaDaJanela {
  readonly janela: NomeDaJanela
  /** Os turnos do Tutor concluídos, criados na janela, e o p95 de `criada_em` a `concluida_em`: o que o aluno espera. */
  readonly amostrasDoTutor: number
  readonly turnoDoTutorP95Ms: number | null
  /** As execuções criadas na janela que terminaram `IA_INDISPONIVEL`: o que a reserva existe para impedir. */
  readonly indisponiveis: number
  /** As que terminaram `IA_TEMPO_ESGOTADO`: tipado, e só a queda por prazo as produz. */
  readonly temposEsgotados: number
  /** As que terminaram `EXECUCAO_INTERROMPIDA`: a troca de worker no intervalo interrompe a ferramenta de 50 s que ainda corria. Contadas, não julgadas. */
  readonly interrompidas: number
  /** As que terminaram com outro erro: nenhuma janela pode ter. */
  readonly outrasFalhas: number
  /** `ia.degradacao{degrau="provedor_de_reserva"}` na janela: as chamadas que a reserva atendeu. `undefined`: o Prometheus não respondeu. */
  readonly degrauDaReserva: number | undefined
  /** `ia.degradacao{degrau="espera"}` na janela: as reservas que o balde do principal recusou. */
  readonly recusadasPeloBalde: number | undefined
}

export interface ResultadoDaReserva {
  readonly k6: ResumoDoK6
  readonly janelas: readonly MedidaDaJanela[]
  /** As janelas cuja troca de worker passou do intervalo: a carga delas começou com o worker ainda subindo. */
  readonly trocasAtrasadas: readonly NomeDaJanela[]
}

/** As falhas de uma janela, por erro do banco, separadas no que o veredito julga. */
export function montarMedidaDaJanela(
  janela: NomeDaJanela,
  tutor: { amostras: number; p95Ms: number | null },
  falhas: Readonly<Record<string, number>>,
  degrauDaReserva: number | undefined,
  recusadasPeloBalde: number | undefined,
): MedidaDaJanela {
  return {
    janela,
    amostrasDoTutor: tutor.amostras,
    turnoDoTutorP95Ms: tutor.p95Ms,
    indisponiveis: falhas['IA_INDISPONIVEL'] ?? 0,
    temposEsgotados: falhas['IA_TEMPO_ESGOTADO'] ?? 0,
    interrompidas: falhas['EXECUCAO_INTERROMPIDA'] ?? 0,
    outrasFalhas: Object.entries(falhas)
      .filter(([erro]) => erro !== 'IA_INDISPONIVEL' && erro !== 'IA_TEMPO_ESGOTADO' && erro !== 'EXECUCAO_INTERROMPIDA')
      .reduce((soma, [, n]) => soma + n, 0),
    degrauDaReserva,
    recusadasPeloBalde,
  }
}

/**
 * O que reprova a fase `reserva`: os thresholds do k6, a troca de worker atrasada e, por janela, o aluno sem resposta (`IA_INDISPONIVEL`), a falha que não é a esperada, o degrau da reserva que não
 * subiu e, na queda por servidor e por 429, o turno do Tutor acima do da janela de controle mais 1 s. Na queda por prazo o `IA_TEMPO_ESGOTADO` é permitido (tipado, com o número no relatório) e o
 * `IA_INDISPONIVEL` não. Relatório, não portão: o que a esteira roda é a unidade (`infra/test/carga.test.ts`).
 */
export function julgarReserva(resultado: ResultadoDaReserva): Reprovacao[] {
  const reprovacoes = reprovacoesDoK6(resultado)
  const controle = resultado.janelas.find((medida) => medida.janela === 'controle')
  for (const { nome } of JANELAS_DA_RESERVA) {
    const medida = resultado.janelas.find((candidata) => candidata.janela === nome)
    if (medida === undefined) {
      reprovacoes.push({ criterio: `sem_amostra_${nome}`, detalhe: `reserva: a janela ${nome} não foi medida` })
      continue
    }
    reprovacoes.push(...reprovacoesDasFalhas(nome, medida), ...reprovacoesDoTurno(nome, medida, controle), ...reprovacoesDaReserva(nome, medida))
  }
  return reprovacoes
}

/** O k6 da fase: os thresholds cruzados, o código de saída que não bate com o resumo e as trocas de worker que passaram do intervalo. */
function reprovacoesDoK6(resultado: ResultadoDaReserva): Reprovacao[] {
  const reprovacoes: Reprovacao[] = []
  for (const { metrica, criterio } of resultado.k6.cruzados) reprovacoes.push({ criterio: `reserva:${metrica}`, detalhe: `reserva: ${metrica} ${criterio}` })
  const saidaEsperada = resultado.k6.cruzados.length > 0 ? CODIGO_THRESHOLD_CRUZADO : 0
  if (resultado.k6.codigo !== saidaEsperada) reprovacoes.push({ criterio: 'k6_reserva', detalhe: `reserva: k6 saiu com ${resultado.k6.codigo}, e o resumo pedia ${saidaEsperada}` })
  for (const nome of resultado.trocasAtrasadas) reprovacoes.push({ criterio: `troca_atrasada_${nome}`, detalhe: `reserva: o worker da janela ${nome} não subiu dentro do intervalo de ${INTERVALO_ENTRE_AS_JANELAS_S} s` })
  return reprovacoes
}

/** As falhas de uma janela: o aluno sem resposta, o erro que ninguém previu e o prazo esgotado fora da queda por prazo. */
function reprovacoesDasFalhas(nome: NomeDaJanela, medida: MedidaDaJanela): Reprovacao[] {
  const reprovacoes: Reprovacao[] = []
  if (medida.indisponiveis > 0) reprovacoes.push({ criterio: `indisponivel_${nome}`, detalhe: `reserva: ${medida.indisponiveis} execuções terminaram IA_INDISPONIVEL na janela ${nome}` })
  if (medida.outrasFalhas > 0) reprovacoes.push({ criterio: `falhas_${nome}`, detalhe: `reserva: ${medida.outrasFalhas} execuções falharam na janela ${nome} com outro erro que não IA_INDISPONIVEL, IA_TEMPO_ESGOTADO nem EXECUCAO_INTERROMPIDA` })
  if (medida.temposEsgotados > 0 && nome !== 'prazo') reprovacoes.push({ criterio: `tempo_esgotado_${nome}`, detalhe: `reserva: ${medida.temposEsgotados} execuções terminaram IA_TEMPO_ESGOTADO na janela ${nome}, e só a queda por prazo as produz` })
  return reprovacoes
}

/** O p95 do controle, que é a referência da queda: só existe com p95 e com o mínimo de turnos (sem isso o limite não nasce, e a janela de queda não reprova por ele). */
function p95DoControle(controle: MedidaDaJanela | undefined): number | undefined {
  if (controle?.turnoDoTutorP95Ms == null || controle.amostrasDoTutor < AMOSTRAS_MINIMAS_DA_JANELA) return undefined
  return controle.turnoDoTutorP95Ms
}

/** O turno do Tutor: sem amostra a janela não passa em branco, e na queda por servidor e por 429 o p95 não passa do controle mais 1 s. */
function reprovacoesDoTurno(nome: NomeDaJanela, medida: MedidaDaJanela, controle: MedidaDaJanela | undefined): Reprovacao[] {
  const turnoMedido = medida.amostrasDoTutor >= AMOSTRAS_MINIMAS_DA_JANELA && medida.turnoDoTutorP95Ms !== null
  const referencia = p95DoControle(controle)
  if (!turnoMedido && (nome === 'controle' || nome === '5xx' || nome === '429')) {
    return [{ criterio: `sem_amostra_${nome}`, detalhe: `reserva: a janela ${nome} tem ${medida.amostrasDoTutor} turnos do Tutor, e o p95 pede ao menos ${AMOSTRAS_MINIMAS_DA_JANELA}` }]
  }
  if ((nome === '5xx' || nome === '429') && turnoMedido && referencia !== undefined) return reprovacaoDoLimiteDoTurno(nome, medida, referencia)
  return []
}

/** O p95 do turno acima do limite: o do controle mais 1 s. O limite exato passa. */
function reprovacaoDoLimiteDoTurno(nome: NomeDaJanela, medida: MedidaDaJanela, referencia: number): Reprovacao[] {
  const limite = referencia + ACRESCIMO_MAXIMO_DO_TURNO_NA_QUEDA_MS
  const turno = medida.turnoDoTutorP95Ms ?? 0
  if (turno > limite) {
    return [{ criterio: `turno_${nome}`, detalhe: `reserva: o turno do Tutor na janela ${nome} tem p95 de ${Math.round(turno)} ms, e o limite é ${Math.round(limite)} ms (o do controle ${Math.round(referencia)} ms mais ${ACRESCIMO_MAXIMO_DO_TURNO_NA_QUEDA_MS} ms)` }]
  }
  return []
}

/** A reserva atendeu (o degrau subiu) em toda janela de queda, e o balde do principal recusou na janela do balde cheio. */
function reprovacoesDaReserva(nome: NomeDaJanela, medida: MedidaDaJanela): Reprovacao[] {
  const reprovacoes: Reprovacao[] = []
  if (nome !== 'controle' && !((medida.degrauDaReserva ?? 0) > 0)) {
    reprovacoes.push({ criterio: `reserva_nao_atendeu_${nome}`, detalhe: `reserva: ia.degradacao{degrau="provedor_de_reserva"} não subiu na janela ${nome} (${medida.degrauDaReserva === undefined ? 'o Prometheus não respondeu' : medida.degrauDaReserva}): a reserva não atendeu` })
  }
  if (nome === 'balde' && !((medida.recusadasPeloBalde ?? 0) > 0)) {
    reprovacoes.push({ criterio: 'balde_nao_recusou', detalhe: 'reserva: o balde do principal não recusou nenhuma reserva na janela do balde cheio: o contratado da janela não mordeu, e o transbordo não foi provado' })
  }
  return reprovacoes
}

/** As janelas de queda em que o aluno sem resposta prova que a reserva faltou: é por elas, e só por elas, que o controle negativo precisa reprovar. */
export const JANELAS_DO_CONTROLE_NEGATIVO_DA_RESERVA = ['5xx', '429'] as const

/** Reprovou pelo aluno sem resposta numa janela de queda, e não pela subida: o worker subiu, atendeu a carga e a reserva é que não era elegível. */
export function reprovadoPeloIndisponivel(reprovacoes: readonly Reprovacao[]): boolean {
  return JANELAS_DO_CONTROLE_NEGATIVO_DA_RESERVA.every((nome) => reprovacoes.some((reprovacao) => reprovacao.criterio === `indisponivel_${nome}`))
}

/** Zero quando a fase faz o que se espera dela: passar com a reserva elegível, e reprovar pelo indisponível com a reserva sem modelo elegível. */
export function codigoDeSaidaDaReserva(reprovacoes: readonly Reprovacao[] | undefined, controleNegativo: boolean): number {
  // A fase que nem terminou (o compose não subiu, o worker não subiu na troca) não provou nada, nem como controle negativo.
  if (reprovacoes === undefined) return 1
  if (controleNegativo) return reprovadoPeloIndisponivel(reprovacoes) ? 0 : 1
  return reprovacoes.length === 0 ? 0 : 1
}

/** Os turnos do Tutor concluídos entre `de` e `ate` (o relógio do banco) e o p95 do turno, de `criada_em` a `concluida_em`. Rotina nossa de teste, sem contexto de requisição (regra 10, item 9). */
export async function medirTutorNaJanela(banco: Consultavel, escolas: readonly string[], de: Date, ate: Date): Promise<{ amostras: number; p95Ms: number | null }> {
  const { rows } = await banco.query<{ amostras: number; p95: number | null }>(
    `select count(*)::int as amostras, percentile_cont(0.95) within group (order by extract(epoch from concluida_em - criada_em)::float8 * 1000) as p95
       from execucao_agente where escola_id = any($1::uuid[]) and funcao = 'tutor_com_o_aluno' and estado = 'concluida' and criada_em >= $2 and criada_em < $3`,
    [escolas, de, ate],
  )
  const linha = rows[0]
  return { amostras: Number(linha?.amostras ?? 0), p95Ms: linha?.p95 === null || linha?.p95 === undefined ? null : Number(linha.p95) }
}

/** As execuções que falharam entre `de` e `ate`, por erro, das escolas da sala e **de qualquer função** (o Tutor, a ferramenta e a proposta): o `IA_INDISPONIVEL` de uma janela pode não ser do Tutor. */
export async function falhasNaJanela(banco: Consultavel, escolas: readonly string[], de: Date, ate: Date): Promise<Record<string, number>> {
  const { rows } = await banco.query<{ erro: string; n: number }>(
    "select erro, count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'falhou' and criada_em >= $2 and criada_em < $3 group by erro",
    [escolas, de, ate],
  )
  return Object.fromEntries(rows.map((linha) => [linha.erro, linha.n]))
}

/**
 * Um degrau de `ia.degradacao` somado na janela. Os dois `worker-ia` **nascem de novo no intervalo que antecede a janela**, e o contador deles começa em zero: o valor que ele tem no fim da janela é o que a
 * janela somou, e o `max_over_time` o lê mesmo quando a série nasce já com valor (o `increase` não conta o primeiro ponto de uma série nova). A janela de leitura começa depois da troca, e a do vizinho
 * termina antes dela, porque o contêiner antigo parou no intervalo e o Prometheus não o devolve.
 */
export async function degrauNaJanela(prometheus: string, degrau: string, janela: { inicio: Date; fim: Date }): Promise<number | undefined> {
  const segundos = Math.max(10, Math.ceil((janela.fim.getTime() - janela.inicio.getTime()) / 1_000))
  return consultarPrometheus(prometheus, `sum(max_over_time(ia_degradacao_total{degrau="${degrau}"}[${String(segundos)}s]))`, janela.fim)
}

/** O relatório da fase, janela a janela. */
export function descreverReserva(resultado: ResultadoDaReserva): string[] {
  const ms = (valor: number | null) => (valor === null ? '-' : `${Math.round(valor)} ms`)
  const numero = (valor: number | undefined) => (valor === undefined ? 'não lido' : String(Math.round(valor)))
  const linhas = ['', '▶ queda do principal (FASE=reserva): por janela', '  janela    turnos  p95 do turno   indisponível  prazo esgotado  outras  interrompidas  reserva atendeu  balde recusou']
  for (const medida of resultado.janelas) {
    linhas.push(
      `  ${medida.janela.padEnd(8)}  ${String(medida.amostrasDoTutor).padStart(6)}  ${ms(medida.turnoDoTutorP95Ms).padEnd(12)}  ${String(medida.indisponiveis).padStart(12)}  ${String(medida.temposEsgotados).padStart(14)}  ${String(medida.outrasFalhas).padStart(6)}  ${String(medida.interrompidas).padStart(13)}  ${numero(medida.degrauDaReserva).padStart(15)}  ${numero(medida.recusadasPeloBalde).padStart(13)}`,
    )
  }
  const controle = resultado.janelas.find((medida) => medida.janela === 'controle')
  linhas.push(
    `  referência (controle, a configuração da sala, sem reserva): p95 do turno ${ms(controle?.turnoDoTutorP95Ms ?? null)}; limite da queda ${controle?.turnoDoTutorP95Ms == null ? '-' : `${Math.round(controle.turnoDoTutorP95Ms + ACRESCIMO_MAXIMO_DO_TURNO_NA_QUEDA_MS)} ms`}`,
    '  indisponível, prazo esgotado, outras e interrompidas contam as execuções de qualquer função (Tutor, ferramenta e proposta) das escolas da sala; turnos e p95 são só do Tutor',
    `  k6: ${resultado.k6.temposEsgotados ?? 0} execuções com IA_TEMPO_ESGOTADO e ${resultado.k6.interrompidas ?? 0} interrompidas vistas pelo aluno; trocas de worker atrasadas: ${resultado.trocasAtrasadas.join(', ') || 'nenhuma'}`,
  )
  return linhas
}

/** Só a fase `base`: o veredito dela sozinha (os thresholds do k6 limpos, o código de saída coerente e o p95 da espera da B lido). */
export function julgarSoABase(base: ResumoDoK6): Veredito {
  const reprovacoes: Reprovacao[] = base.cruzados.map(({ metrica, criterio }) => ({ criterio: `base:${metrica}`, detalhe: `base: ${metrica} ${criterio}` }))
  const saidaEsperada = base.cruzados.length > 0 ? CODIGO_THRESHOLD_CRUZADO : 0
  if (base.codigo !== saidaEsperada) reprovacoes.push({ criterio: 'k6_base', detalhe: `base: k6 saiu com ${base.codigo}, e o resumo pedia ${saidaEsperada}` })
  if (base.esperaBP95Ms === undefined) reprovacoes.push({ criterio: 'base:espera_b', detalhe: 'base: sem p95 de espera da escola B' })
  return { passou: reprovacoes.length === 0, reprovacoes, reprovadoPelaJustica: false }
}

/**
 * O token de acesso vale 10 min (`VALIDADE_TOKEN_ACESSO_SEGUNDOS`) e a corrida inteira do k6 (carga e cauda) passa de 7 min: o token mais antigo, na hora em que o k6
 * começa, não pode ter mais que isto. Em série, dez escolas levavam mais que os 10 min, e as primeiras escolas passavam a receber 401 no meio da carga (corrida da 9.0).
 */
export const IDADE_MAXIMA_DO_TOKEN_NO_INICIO_DO_K6_S = 30

/**
 * As sessões, a estrutura e o material de cada escola da sala, e o arquivo dos tokens que o k6 lê (com a turma e a disciplina de cada escola). As dez escolas vão em
 * paralelo (cada uma: os alunos, as professoras, depois a estrutura que precisa deles) e sem reconstruir o `dist` a cada sessão. Devolve há quantos segundos o primeiro
 * token foi emitido; quem chama soma o tempo até o k6 e confere contra `IDADE_MAXIMA_DO_TOKEN_NO_INICIO_DO_K6_S`.
 */
async function prepararAsEscolasDaSala(banco: pg.Client, ambiente: NodeJS.ProcessEnv, escolas: readonly string[], arquivoDosTokens: string): Promise<number> {
  const comecou = Date.now()
  const tokens: Record<string, string[]> = {}
  await Promise.all(
    escolas.map(async (escolaId, indice) => {
      tokens[`sala_aluno_${indice}`] = await sessoesSinteticas(ambiente, escolaId, 'aluno', ALUNOS_POR_ESCOLA_DA_SALA, `sala_aluno_${indice}`, true)
      tokens[`sala_professora_${indice}`] = await sessoesSinteticas(ambiente, escolaId, 'professor', PROFESSORAS_POR_ESCOLA_DA_SALA, `sala_professora_${indice}`, true)
      const { turmaId, disciplinaId } = await semearEscolaDaSala(banco, escolaId)
      tokens[`sala_alvo_${indice}`] = [turmaId, disciplinaId]
    }),
  )
  writeFileSync(arquivoDosTokens, JSON.stringify(tokens))
  chmodSync(arquivoDosTokens, 0o644)
  return Math.round((Date.now() - comecou) / 1_000)
}

/** O `kill -9` do `worker-ia-1` com a carga no ritmo: lê as execuções em `rodando` (o teto das interrompidas) e o derruba; ele volta cinco segundos depois. */
async function matarOWorkerDeIa(banco: pg.Client, escolas: readonly string[], compose: (...argumentos: string[]) => Promise<unknown>): Promise<number> {
  await esperar(ATRASO_DO_KILL_MS)
  const teto = await contarExecucoesRodando(banco, escolas)
  escrever(`\n▶ kill -9 no worker-ia-1 (${teto} execuções em rodando, o teto das interrompidas)`)
  await compose('kill', '--signal', 'SIGKILL', 'worker-ia-1')
  await esperar(ESPERA_ATE_A_VOLTA_DO_WORKER_MS)
  await compose('start', 'worker-ia-1')
  return teto
}

function lerResumoDaSala(pasta: string, codigo: number, fase: 'sala' | 'reserva' = 'sala'): ResumoDoK6 {
  try {
    return lerResumoDoK6(codigo, JSON.parse(readFileSync(join(pasta, `resumo-${fase}.json`), 'utf8')))
  } catch {
    return lerResumoDoK6(codigo, undefined)
  }
}

/** As falhas do banco e o contador do k6, no que o veredito da sala lê: só o `EXECUCAO_INTERROMPIDA` (do `kill -9`) e o `IA_INDISPONIVEL` (que tem critério próprio) ficam fora das "outras falhas". */
export function montarResultadoDaSala(leitura: {
  k6: ResumoDoK6
  escolas: readonly MedidaDaEscolaDaSala[]
  teto: number
  falhas: Readonly<Record<string, number>>
  reservasRecusadas: number | undefined
}): ResultadoDaSala {
  const { k6, escolas, teto, falhas, reservasRecusadas } = leitura
  return {
    k6,
    escolas,
    interrompidas: k6.interrompidas ?? 0,
    tetoDeInterrompidas: teto,
    falhasForaDoKill: Object.entries(falhas)
      .filter(([erro]) => erro !== 'EXECUCAO_INTERROMPIDA' && erro !== 'IA_INDISPONIVEL')
      .reduce((soma, [, n]) => soma + n, 0),
    indisponiveis: falhas['IA_INDISPONIVEL'] ?? 0,
    reservasRecusadas,
  }
}

/** O que o banco e o Prometheus dizem da fase, depois do k6: a espera de cada escola, as falhas, o balde e o consumo. Escreve o relatório e devolve o resultado para o veredito. */
async function lerASala(banco: pg.Client, leitura: { escolas: readonly string[]; desde: Date; k6: ResumoDoK6; teto: number; amostras: AmostrasDaSala; prometheus: string }): Promise<ResultadoDaSala> {
  const { escolas, desde, k6, teto, amostras, prometheus } = leitura
  const fim = new Date(await agoraDoBanco(banco))
  await esperar(PRAZO_DA_TELEMETRIA_MS)
  const telemetria = await telemetriaDaSala(prometheus, { inicio: desde, fim: new Date(fim.getTime() + PRAZO_DA_TELEMETRIA_MS) })
  const falhas = await falhasDaSala(banco, escolas, desde)
  const consumo = await consumoDaSala(banco, escolas, desde)
  const resultado = montarResultadoDaSala({ k6, escolas: await medirEscolasDaSala(banco, escolas, desde), teto, falhas, reservasRecusadas: telemetria.espera })
  for (const linha of descreverSala(resultado, { amostras, telemetria, consumo, falhas })) escrever(linha)
  return resultado
}

/**
 * O ambiente da carga da manhã e o de partida da queda do principal: o do cenário de sempre (sem o que o shell exporta de `infra/carga.env`), o adaptador falso, a latência e os tokens da sala, e a
 * **reserva e a falha falsa desligadas** (vazias, que passam na frente do que o shell exportar): a `sala` não liga a reserva, para seguir comparável à X6.
 */
export function ambienteDaSala(pasta: string, doArquivo: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([chave]) => !(chave in doArquivo))),
    CARGA_PASTA_DA_EXECUCAO: pasta,
    VAGAS_POR_ESCOLA_DESLIGADAS: 'false',
    IA_ADAPTADOR: 'falso',
    ...ambienteDoFalso('sala'),
    ...variaveisDaReserva(undefined, doArquivo),
  }
}

/**
 * O ambiente das fases `base` e `carga`: o de sempre (sem o que o shell exporta de `infra/carga.env`), o adaptador falso com a latência e os tokens das fases de sempre (a da sala os troca) e a
 * **reserva e a falha falsa desligadas** (vazias, que passam na frente do que o shell exportar): um `IA_RESERVA_ADAPTADOR` ou um `IA_FALHA_FALSA` exportado não chega ao worker por `${...:-}` do compose.
 */
export function ambienteDaBase(pasta: string, doArquivo: Readonly<Record<string, string>>, controleNegativo: boolean): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([chave]) => !(chave in doArquivo))),
    CARGA_PASTA_DA_EXECUCAO: pasta,
    VAGAS_POR_ESCOLA_DESLIGADAS: controleNegativo ? 'true' : 'false',
    IA_ADAPTADOR: 'falso',
    ...ambienteDoFalso('base'),
    ...variaveisDaReserva(undefined, doArquivo),
  }
}

/**
 * A carga da manhã (X6, tarefa 11.0; RF6), `--so=sala`: sobe o compose de carga com o adaptador falso da sala (6 s e 50 s, 3.000 + 250 tokens), cria dez escolas
 * com a estrutura do Tutor e das ferramentas, roda o k6 da `FASE=sala` e, com a carga no ritmo, lê as execuções em `rodando` e dá `kill -9` no `worker-ia-1`, que
 * volta cinco segundos depois. Mede a espera de cada escola pelo banco, as reservas que o balde recusou, o RSS dos `worker-ia` e o consumo, e escreve o relatório.
 * Relatório, não portão: o que a esteira roda é a unidade (`infra/test/carga.test.ts`), e a corrida é por demanda.
 */
async function executarASala(): Promise<number> {
  const pasta = mkdtempSync(join(tmpdir(), 'educa-carga-'))
  chmodSync(pasta, 0o777)
  const doArquivo = lerAmbienteDeCarga()
  exigirAdaptadorFalso(adaptadorDoAmbienteDeCarga(doArquivo))
  const ambiente = ambienteDaSala(pasta, doArquivo)
  const compose = (...argumentos: string[]) => rodar('docker', [...argumentosDoCompose(), ...argumentos], ambiente)
  const inicio = new Date()
  let reprovacoes: Reprovacao[] | undefined
  let cliente: pg.Client | undefined
  try {
    escrever('\n▶ carga da manhã (FASE=sala), dez escolas')
    await compose('down', '--volumes', '--remove-orphans')
    if ((await compose('up', '--detach', '--build', '--wait')).codigo !== 0) throw new Error('o compose de carga não subiu')
    const ambienteDosOps: NodeJS.ProcessEnv = { ...ambiente, ...doArquivo }
    escrever('\n▶ escolas da sala')
    const escolas = await criarEscolasDaSala(ambienteDosOps)
    cliente = new pg.Client({ connectionString: urlDoBancoDoAmbiente(doArquivo) })
    await cliente.connect()
    escrever('\n▶ sessões, estrutura e material de cada escola')
    await prepararAsEscolasDaSala(cliente, ambienteDosOps, escolas, join(pasta, 'tokens.json'))

    const desde = new Date(await agoraDoBanco(cliente))
    const amostrador = amostrarASala(cliente, ambiente)
    escrever('\n▶ k6, fase sala')
    const execucaoDoK6 = compose('run', '--rm', '--no-deps', 'k6', ...argumentosDoK6('sala'))
    const teto = await matarOWorkerDeIa(cliente, escolas, compose)
    const k6 = lerResumoDaSala(pasta, (await execucaoDoK6).codigo)
    const amostras = await amostrador.parar()
    const prometheus = `http://127.0.0.1:${doArquivo['PROMETHEUS_PORTA_HOST'] ?? ''}`
    reprovacoes = julgarSala(await lerASala(cliente, { escolas, desde, k6, teto, amostras, prometheus }))
  } catch (erro) {
    escrever(`\n✖ a carga da manhã não terminou: ${erro instanceof Error ? erro.message : String(erro)}`)
    await compose('logs', '--no-color', '--tail', '100')
  } finally {
    await cliente?.end().catch(() => undefined)
    await compose('down', '--volumes', '--remove-orphans')
    rmSync(pasta, { recursive: true, force: true })
  }
  if (reprovacoes === undefined) return 1
  escrever(`\n■ carga da manhã em ${inicio.toISOString()} (${Math.round((Date.now() - inicio.getTime()) / 60_000)} min): ${reprovacoes.length === 0 ? 'passou' : 'reprovou'}`)
  for (const reprovacao of reprovacoes) escrever(`  reprovado: ${reprovacao.detalhe}`)
  return reprovacoes.length === 0 ? 0 : 1
}

/** Espera até o instante (relógio desta máquina), e volta na hora se ele já passou. */
async function esperarAte(instanteMs: number): Promise<void> {
  const falta = instanteMs - Date.now()
  if (falta > 0) await esperar(falta)
}

/** Quando a carga do k6 começou de fato: a primeira execução criada depois de `desde`, no relógio do banco e no desta máquina. Sem ela em 2 min, o k6 não subiu. */
async function aguardarOInicioDaCarga(banco: pg.Client, escolas: readonly string[], desde: Date): Promise<{ inicioDoBanco: Date; inicioLocalMs: number }> {
  const limite = Date.now() + 120_000
  while (Date.now() < limite) {
    const { rows } = await banco.query<{ primeira: Date | null }>('select min(criada_em) as primeira from execucao_agente where escola_id = any($1::uuid[]) and criada_em >= $2', [escolas, desde])
    const primeira = rows[0]?.primeira
    if (primeira !== null && primeira !== undefined) return { inicioDoBanco: new Date(primeira), inicioLocalMs: Date.now() }
    await esperar(500)
  }
  throw new Error('o k6 da fase reserva não criou nenhuma execução em 2 min')
}

type ComposeCom = (variaveis: NodeJS.ProcessEnv, ...argumentos: string[]) => ReturnType<typeof rodar>

/** O que a corrida da queda do principal leva de um passo ao outro: a pasta do k6, o ambiente e o compose (com a configuração de cada janela). */
interface CorridaDaReserva {
  readonly pasta: string
  readonly doArquivo: Readonly<Record<string, string>>
  readonly ambiente: NodeJS.ProcessEnv
  readonly composeCom: ComposeCom
  readonly comJanela: (janela: JanelaDaReserva) => NodeJS.ProcessEnv
}

/** No intervalo antes de cada janela, depois de a ferramenta em voo terminar, recria os `worker-ia` com a falha e a reserva dela. Devolve as trocas que passaram do começo da carga seguinte. */
async function trocarOsWorkersEntreAsJanelas(corrida: CorridaDaReserva, comeco: { inicioLocalMs: number }): Promise<{ trocasAtrasadas: NomeDaJanela[]; trocadasEmMs: Record<number, number> }> {
  const { composeCom, comJanela } = corrida
  const trocasAtrasadas: NomeDaJanela[] = []
  const trocadasEmMs: Record<number, number> = {}
  for (const [indice, janela] of JANELAS_DA_RESERVA.entries()) {
    if (indice === 0) continue
    // A carga da janela anterior terminou; o intervalo é do worker. A carga da janela seguinte começa no instante que o k6 marca, com ou sem o worker de pé.
    await esperarAte(comeco.inicioLocalMs + limiteDaJanelaS(indice - 1, true) * 1_000 + DRENAGEM_ANTES_DE_TROCAR_O_WORKER_S * 1_000)
    escrever(`\n▶ janela ${janela.nome}: ${janela.falha ?? 'principal atendendo'}, reserva ${janela.reserva ? 'ligada' : 'desligada'}${janela.tokensPorMinuto === undefined ? '' : `, contratado ${janela.tokensPorMinuto}`}`)
    const troca = await composeCom(comJanela(janela), 'up', '--detach', '--no-deps', '--force-recreate', '--wait', 'worker-ia-1', 'worker-ia-2')
    if (troca.codigo !== 0) throw new Error(`o worker-ia não subiu com a configuração da janela ${janela.nome}`)
    trocadasEmMs[indice] = Date.now()
    if (Date.now() > comeco.inicioLocalMs + limiteDaJanelaS(indice) * 1_000 - 1_000) trocasAtrasadas.push(janela.nome)
  }
  return { trocasAtrasadas, trocadasEmMs }
}

/**
 * Onde a leitura do Prometheus de uma janela começa: no instante em que a troca do worker voltou (o `--wait` do `up`), e não antes. O contêiner antigo parou no intervalo, e uma série dele raspada
 * antes disso somaria à janela o contador da janela vizinha (o `max_over_time` lê o valor mais alto da série no intervalo). A primeira janela não tem troca: começa 5 s antes da carga, como o banco.
 */
export function inicioDaLeituraDaJanela(indice: number, comeco: { inicioLocalMs: number }, trocadasEmMs: Readonly<Record<number, number | undefined>>): Date {
  const trocadaEm = trocadasEmMs[indice]
  return new Date(trocadaEm ?? comeco.inicioLocalMs + limiteDaJanelaS(indice) * 1_000 - 5_000)
}

/** Lê, de cada janela, o turno do Tutor e as falhas (no banco) e o degrau da reserva e o balde que recusou (no Prometheus). */
async function medirAsJanelas(
  banco: pg.Client,
  escolas: readonly string[],
  comeco: { inicioDoBanco: Date; inicioLocalMs: number },
  trocadasEmMs: Readonly<Record<number, number | undefined>>,
  prometheus: string,
): Promise<MedidaDaJanela[]> {
  const janelas: MedidaDaJanela[] = []
  for (const [indice, janela] of JANELAS_DA_RESERVA.entries()) {
    // A leitura começa um pouco antes da carga (a primeira execução nasce ~1 s depois do começo) e vai até a telemetria da janela chegar, bem antes da carga seguinte.
    const deNoBanco = new Date(comeco.inicioDoBanco.getTime() + limiteDaJanelaS(indice) * 1_000 - 5_000)
    const ateNoBanco = new Date(comeco.inicioDoBanco.getTime() + limiteDaJanelaS(indice, true) * 1_000 + 20_000)
    const leitura = {
      inicio: inicioDaLeituraDaJanela(indice, comeco, trocadasEmMs),
      fim: new Date(comeco.inicioLocalMs + limiteDaJanelaS(indice, true) * 1_000 + 20_000),
    }
    janelas.push(
      montarMedidaDaJanela(
        janela.nome,
        await medirTutorNaJanela(banco, escolas, deNoBanco, ateNoBanco),
        await falhasNaJanela(banco, escolas, deNoBanco, ateNoBanco),
        await degrauNaJanela(prometheus, 'provedor_de_reserva', leitura),
        await degrauNaJanela(prometheus, 'espera', leitura),
      ),
    )
  }
  return janelas
}

/** Sobe o compose na configuração do controle, cria as dez escolas e as sessões, e confere a idade dos tokens. Guarda a conexão em `conexao` para o `finally` de quem chama fechá-la. */
async function prepararAReserva(corrida: CorridaDaReserva, conexao: { cliente?: pg.Client }): Promise<{ cliente: pg.Client; escolas: string[] }> {
  const { pasta, doArquivo, ambiente, composeCom, comJanela } = corrida
  await composeCom(ambiente, 'down', '--volumes', '--remove-orphans')
  // Sobe com a configuração da primeira janela (o controle: reserva desligada, principal atendendo), que é a da `sala`.
  if ((await composeCom(comJanela(JANELAS_DA_RESERVA[0] as JanelaDaReserva), 'up', '--detach', '--build', '--wait')).codigo !== 0) throw new Error('o compose de carga não subiu')
  const ambienteDosOps: NodeJS.ProcessEnv = { ...ambiente, ...doArquivo }
  escrever('\n▶ escolas da sala')
  const escolas = await criarEscolasDaSala(ambienteDosOps)
  const cliente = new pg.Client({ connectionString: urlDoBancoDoAmbiente(doArquivo) })
  conexao.cliente = cliente
  await cliente.connect()
  escrever('\n▶ sessões, estrutura e material de cada escola')
  const idadeDosTokensS = await prepararAsEscolasDaSala(cliente, ambienteDosOps, escolas, join(pasta, 'tokens.json'))
  escrever(`  sessões e estrutura das dez escolas em ${idadeDosTokensS} s (o token mais antigo tem essa idade quando o k6 começa; o teto é ${IDADE_MAXIMA_DO_TOKEN_NO_INICIO_DO_K6_S} s)`)
  if (idadeDosTokensS > IDADE_MAXIMA_DO_TOKEN_NO_INICIO_DO_K6_S) throw new Error(`as sessões levaram ${idadeDosTokensS} s: o token mais antigo venceria no meio da carga`)
  return { cliente, escolas }
}

/** A corrida: prepara, roda o k6, troca os workers entre as janelas, lê cada janela, escreve o relatório e devolve o que reprova. */
async function correrAReserva(corrida: CorridaDaReserva, conexao: { cliente?: pg.Client }): Promise<Reprovacao[]> {
  const { pasta, doArquivo, ambiente, composeCom } = corrida
  const { cliente, escolas } = await prepararAReserva(corrida, conexao)
  const desde = new Date(await agoraDoBanco(cliente))
  escrever('\n▶ k6, fase reserva')
  const execucaoDoK6 = composeCom(ambiente, 'run', '--rm', '--no-deps', 'k6', ...argumentosDoK6('reserva'))
  const comeco = await aguardarOInicioDaCarga(cliente, escolas, desde)
  const { trocasAtrasadas, trocadasEmMs } = await trocarOsWorkersEntreAsJanelas(corrida, comeco)
  const k6 = lerResumoDaSala(pasta, (await execucaoDoK6).codigo, 'reserva')
  await esperar(PRAZO_DA_TELEMETRIA_MS)
  const prometheus = `http://127.0.0.1:${doArquivo['PROMETHEUS_PORTA_HOST'] ?? ''}`
  const resultado: ResultadoDaReserva = { k6, janelas: await medirAsJanelas(cliente, escolas, comeco, trocadasEmMs, prometheus), trocasAtrasadas }
  for (const linha of descreverReserva(resultado)) escrever(linha)
  return julgarReserva(resultado)
}

/** O fim da corrida: o veredito escrito e o código de saída (zero quando a fase faz o que se espera dela, no controle negativo ou fora dele). */
function encerrarAReserva(reprovacoes: Reprovacao[] | undefined, inicio: Date, controleNegativo: boolean): number {
  const codigo = codigoDeSaidaDaReserva(reprovacoes, controleNegativo)
  if (reprovacoes === undefined) return codigo
  escrever(`\n■ queda do principal em ${inicio.toISOString()} (${Math.round((Date.now() - inicio.getTime()) / 60_000)} min): ${reprovacoes.length === 0 ? 'passou' : 'reprovou'}`)
  for (const reprovacao of reprovacoes) escrever(`  reprovado: ${reprovacao.detalhe}`)
  if (controleNegativo) escrever(codigo === 0 ? '✔ controle negativo: com a reserva sem modelo elegível, a queda deixou aluno sem resposta, e a fase reprovou pelo indisponível' : '✖ controle negativo: a fase não reprovou pelo indisponível nas janelas de queda')
  else escrever(codigo === 0 ? '✔ fase passou' : '✖ fase reprovou')
  return codigo
}

/**
 * A queda do principal (F5b, tarefa 9.0; RF3), `--so=reserva`: sobe o compose de carga com a reserva desligada (a configuração da `sala`), cria as dez escolas e roda o k6 da `FASE=reserva`, que dá a carga da
 * manhã em cinco janelas com intervalo. No intervalo antes de cada janela, troca a falha do principal falso e liga a reserva nos dois `worker-ia` (`up --force-recreate`: o `IA_FALHA_FALSA` só se lê na subida).
 * Depois lê, de cada janela, o aluno sem resposta, o p95 do turno do Tutor, o degrau da reserva e o balde que recusou, e escreve o relatório. Relatório, não portão: a corrida é por demanda.
 */
async function executarAReserva(controleNegativo: boolean): Promise<number> {
  const pasta = mkdtempSync(join(tmpdir(), 'educa-carga-'))
  chmodSync(pasta, 0o777)
  const doArquivo = lerAmbienteDeCarga()
  exigirAdaptadorFalso(adaptadorDoAmbienteDeCarga(doArquivo))
  exigirReservaFalsa(doArquivo)
  const ambiente = ambienteDaSala(pasta, doArquivo)
  const comJanela = (janela: JanelaDaReserva): NodeJS.ProcessEnv => ({ ...ambiente, ...variaveisDaReserva(janela, doArquivo, controleNegativo) })
  const composeCom: ComposeCom = (variaveis, ...argumentos) => rodar('docker', [...argumentosDoCompose(), ...argumentos], variaveis)
  const inicio = new Date()
  const conexao: { cliente?: pg.Client } = {}
  let reprovacoes: Reprovacao[] | undefined
  try {
    escrever(`\n▶ queda do principal (FASE=reserva), dez escolas${controleNegativo ? `, controle negativo (reserva ${PROVEDOR_DA_RESERVA_SEM_APROVACAO})` : ''}`)
    reprovacoes = await correrAReserva({ pasta, doArquivo, ambiente, composeCom, comJanela }, conexao)
  } catch (erro) {
    escrever(`\n✖ a queda do principal não terminou: ${erro instanceof Error ? erro.message : String(erro)}`)
    await composeCom(ambiente, 'logs', '--no-color', '--tail', '100')
  } finally {
    await conexao.cliente?.end().catch(() => undefined)
    await composeCom(ambiente, 'down', '--volumes', '--remove-orphans')
    rmSync(pasta, { recursive: true, force: true })
  }
  return encerrarAReserva(reprovacoes, inicio, controleNegativo)
}

async function executar(controleNegativo: boolean, soABase = false): Promise<number> {
  const pasta = mkdtempSync(join(tmpdir(), 'educa-carga-'))
  // O k6 do container roda com outro usuário: ele lê os tokens e grava o resumo nesta pasta.
  chmodSync(pasta, 0o777)
  // As variáveis dos arquivos de ambiente não vêm do shell: no compose, o shell passaria na frente do arquivo, e
  // uma porta exportada para o ambiente de desenvolvimento faria o cenário disputar a porta dele.
  const doArquivo = lerAmbienteDeCarga()
  exigirAdaptadorFalso(adaptadorDoAmbienteDeCarga(doArquivo))
  const ambiente = ambienteDaBase(pasta, doArquivo, controleNegativo)
  const compose = (...argumentos: string[]) => rodar('docker', [...argumentosDoCompose(), ...argumentos], ambiente)
  const inicio = new Date()
  let veredito: Veredito | undefined
  let cliente: pg.Client | undefined
  try {
    escrever(`\n▶ cenário "justiça entre escolas"${controleNegativo ? ', controle negativo (VAGAS_POR_ESCOLA_DESLIGADAS=true)' : ''}`)

    // Começa do zero: um cenário interrompido antes deixaria jobs e vagas no volume.
    await compose('down', '--volumes', '--remove-orphans')
    const subida = await compose('up', '--detach', '--build', '--wait')
    if (subida.codigo !== 0) throw new Error('o compose de carga não subiu')

    // Só agora: as escolas e as sessões nascem no banco do projeto, já migrado pelo serviço `migrar`. Os
    // comandos falam com o Postgres do projeto de carga porque o ambiente deles leva o POSTGRES_PORTA_HOST
    // de `infra/carga.env`, que tem precedência sobre o `--env-file=.env.example` dos scripts `ops:*`.
    escrever('\n▶ escolas do cenário')
    const ambienteDosOps: NodeJS.ProcessEnv = { ...ambiente, ...doArquivo }
    const escolas = await criarEscolasDoCenario(ambienteDosOps)
    const arquivoDosTokens = join(pasta, 'tokens.json')

    // O banco do cenário, para a estrutura do Tutor da B, a semente da A, o job do expurgo e as conferências. Uma conexão
    // só, que as fases e a conferência final dividem.
    cliente = new pg.Client({ connectionString: urlDoBancoDoAmbiente(doArquivo) })
    await cliente.connect()
    const banco = cliente

    /**
     * Sessões novas antes de cada fase, e não uma vez no começo: o token de acesso vale 10 min
     * (`VALIDADE_TOKEN_ACESSO_SEGUNDOS`), e entre criar mil sessões e o fim da segunda fase passa mais que
     * isso. Cada fase lê o arquivo ao subir o k6, então recebe token recém-emitido. Os alunos novos da B, nas fases com o
     * Tutor, ganham o vínculo na turma antes do k6: sem ele o turno responde como o inexistente.
     */
    const escreverTokens = async (fase: FaseDoK6): Promise<void> => {
      escrever(`\n▶ sessões da fase ${fase}`)
      writeFileSync(arquivoDosTokens, JSON.stringify(await gerarTokens(ambienteDosOps, escolas)))
      chmodSync(arquivoDosTokens, 0o644)
      if (fase !== 'carga') await semearTutorDaB(banco, escolas.B)
    }

    /** O k6 de uma fase, já com os tokens escritos: devolve o resumo quando o container termina. */
    const executarK6 = async (fase: FaseDoK6, esperaBaseP95Ms?: number, turnoBaseP95Ms?: number): Promise<ResumoDoK6> => {
      escrever(`\n▶ k6, fase ${fase}`)
      const { codigo } = await compose('run', '--rm', '--no-deps', 'k6', ...argumentosDoK6(fase, esperaBaseP95Ms, turnoBaseP95Ms))
      let resumo: unknown
      try {
        resumo = JSON.parse(readFileSync(join(pasta, `resumo-${fase}.json`), 'utf8'))
      } catch {
        resumo = undefined
      }
      return lerResumoDoK6(codigo, resumo)
    }
    const k6 = async (fase: FaseDoK6, esperaBaseP95Ms?: number, turnoBaseP95Ms?: number): Promise<ResumoDoK6> => {
      await escreverTokens(fase)
      return executarK6(fase, esperaBaseP95Ms, turnoBaseP95Ms)
    }
    /** O log do Postgres do projeto desde o instante dado. Vazio vale como não lido: o Postgres sempre registra algo na fase. */
    const lerLogDoPostgres = async (desde: string): Promise<string | undefined> => {
      const { codigo, saida } = await rodar('docker', [...argumentosDoCompose(), 'logs', '--no-color', '--since', desde, 'postgres'], ambiente, true)
      return codigo === 0 && saida.trim() !== '' ? saida : undefined
    }

    const inicioDaBaseMs = await agoraDoBanco(banco)
    const base = await k6('base')
    const fimDaBaseMs = await agoraDoBanco(banco)
    escrever(`p95 da espera da escola B na base: ${base.esperaBP95Ms === undefined ? '-' : `${Math.round(base.esperaBP95Ms)} ms`}`)
    // O turno do Tutor da B na base, pelo banco (a mesma medida da fase do expurgo) e pelo k6 (o threshold dela).
    const turnoDaBase = await lerTurnoDaBNaJanela(banco, escolas.B, { inicioMs: inicioDaBaseMs, fimMs: fimDaBaseMs })
    escrever(`p95 do turno do Tutor da B na base: ${turnoDaBase.p95Ms === null ? '-' : `${turnoDaBase.p95Ms} ms`} (${turnoDaBase.amostras} turnos; k6 ${base.turnoBP95Ms === undefined ? '-' : `${Math.round(base.turnoBP95Ms)} ms`})`)

    // `--so=base`: o p95 do turno no build que está na árvore, para a comparação do RF6 (o do build anterior roda do mesmo jeito, na mesma sessão).
    if (soABase) return encerrar(julgarSoABase(base), inicio, false)

    let expurgo: FaseDoExpurgo = undefined
    const escolha = escolherFaseDoExpurgo(controleNegativo, base.esperaBP95Ms)
    if (escolha.fase === 'dispensada') expurgo = 'dispensada'
    else if (escolha.fase === 'rodar') {
      const daBase: BaseDaFase = { esperaP95Ms: escolha.esperaBaseP95Ms, turnoK6P95Ms: base.turnoBP95Ms, turnoDoBancoP95Ms: turnoDaBase.p95Ms }
      expurgo = await faseDoExpurgo(banco, escolas, daBase, { escreverTokens, executarK6, lerLogDoPostgres })
    }
    const carga = base.esperaBP95Ms === undefined ? undefined : await k6('carga', base.esperaBP95Ms)

    escrever('\n▶ conferência em job_registro')
    const ids = Object.values(escolas)
    await aguardarInterativosIniciados(banco, ids, PRAZO_PARA_INTERATIVOS_MS)
    const conferencia = await conferirJobRegistro(banco, ids)
    const nomes = Object.fromEntries(Object.entries(escolas).map(([nome, id]) => [id, nome]))
    for (const linha of descreverConferencia(conferencia, nomes)) escrever(linha)

    veredito = julgarCenario(base, carga, conferencia, expurgo)
  } catch (erro) {
    escrever(`\n✖ o cenário não terminou: ${erro instanceof Error ? erro.message : String(erro)}`)
    await compose('logs', '--no-color', '--tail', '100')
  } finally {
    await cliente?.end().catch(() => undefined)
    await compose('down', '--volumes', '--remove-orphans')
    rmSync(pasta, { recursive: true, force: true })
  }

  if (veredito === undefined) return 1
  return encerrar(veredito, inicio, controleNegativo)
}

/** O fim de `npm run carga`: o resultado, os motivos de reprovação e o código de saída. */
function encerrar(veredito: Veredito, inicio: Date, controleNegativo: boolean): number {
  const duracao = Math.round((Date.now() - inicio.getTime()) / 60_000)
  escrever(`\n■ resultado em ${inicio.toISOString()} (${duracao} min): ${veredito.passou ? 'passou' : 'reprovou'}`)
  for (const reprovacao of veredito.reprovacoes) escrever(`  reprovado: ${reprovacao.detalhe}`)
  const codigo = codigoDeSaida(veredito, controleNegativo)
  if (controleNegativo) {
    escrever(codigo === 0 ? '✔ controle negativo: sem a vaga por escola, o cenário reprovou pela justiça entre escolas' : '✖ controle negativo: sem a vaga por escola, o cenário não reprovou pela justiça entre escolas')
  } else {
    escrever(codigo === 0 ? '✔ cenário passou' : '✖ cenário reprovou')
  }
  return codigo
}

/** A fase que `--so=` pede (`base`, `sala` ou `reserva`), ou `undefined` sem ele; outro valor derruba o script antes de subir qualquer coisa. */
export function faseDaLinhaDeComando(argumentos: readonly string[]): 'base' | 'sala' | 'reserva' | undefined {
  const so = argumentos.find((argumento) => argumento.startsWith('--so='))?.slice('--so='.length)
  if (so !== undefined && so !== 'base' && so !== 'sala' && so !== 'reserva') throw new Error('--so aceita base, sala ou reserva')
  return so
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const so = faseDaLinhaDeComando(process.argv)
  const controleNegativo = process.argv.includes('--controle-negativo')
  if (so === 'reserva') process.exitCode = await executarAReserva(controleNegativo)
  else process.exitCode = so === 'sala' ? await executarASala() : await executar(controleNegativo, so === 'base')
}
