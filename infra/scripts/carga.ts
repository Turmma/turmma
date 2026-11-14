import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
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
export type FaseDoK6 = 'base' | 'expurgo' | 'carga'

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
}

/** Lê o `--summary-export` do k6, em que `true` num threshold quer dizer cruzado. */
export function lerResumoDoK6(codigo: number, resumo: unknown): ResumoDoK6 {
  const metricas = typeof resumo === 'object' && resumo !== null && 'metrics' in resumo ? (resumo.metrics as Record<string, Record<string, unknown>>) : {}
  const cruzados = Object.entries(metricas).flatMap(([metrica, valores]) =>
    Object.entries((valores['thresholds'] ?? {}) as Record<string, boolean>)
      .filter(([, cruzado]) => cruzado)
      .map(([criterio]) => ({ metrica, criterio })),
  )
  const p95 = metricas['espera_b']?.['p(95)']
  const turno = metricas['turno_b']?.['p(95)']
  return { codigo, cruzados, esperaBP95Ms: typeof p95 === 'number' ? p95 : undefined, turnoBP95Ms: typeof turno === 'number' ? turno : undefined }
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

/** Uma sessão real por token de cada grupo, pelo `ops:sessao-sintetica`: não existe mais token sem sessão gravada. */
async function gerarTokens(ambiente: NodeJS.ProcessEnv, escolas: EscolasDoCenario): Promise<Record<string, string[]>> {
  const tokens: Record<string, string[]> = {}
  for (const [grupo, { escola, papel, quantidade }] of Object.entries(TOKENS_POR_GRUPO)) {
    const argumentos = ['run', '-s', 'ops:sessao-sintetica', '--', '--escola', escolas[escola], '--papel', papel, '--quantidade', String(quantidade)]
    const { codigo, saida } = await rodar('npm', argumentos, ambiente, true)
    const linhas = saida.split('\n').filter((linha) => linha.startsWith('ey'))
    if (codigo !== 0 || linhas.length !== quantidade) throw new Error(`ops:sessao-sintetica não criou as ${quantidade} sessões do grupo ${grupo}`)
    tokens[grupo] = linhas
  }
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

async function executar(controleNegativo: boolean): Promise<number> {
  const pasta = mkdtempSync(join(tmpdir(), 'educa-carga-'))
  // O k6 do container roda com outro usuário: ele lê os tokens e grava o resumo nesta pasta.
  chmodSync(pasta, 0o777)
  // As variáveis dos arquivos de ambiente não vêm do shell: no compose, o shell passaria na frente do arquivo, e
  // uma porta exportada para o ambiente de desenvolvimento faria o cenário disputar a porta dele.
  const doArquivo = lerAmbienteDeCarga()
  const ambiente: NodeJS.ProcessEnv = {
    ...Object.fromEntries(Object.entries(process.env).filter(([chave]) => !(chave in doArquivo))),
    CARGA_PASTA_DA_EXECUCAO: pasta,
    VAGAS_POR_ESCOLA_DESLIGADAS: controleNegativo ? 'true' : 'false',
  }
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

  const duracao = Math.round((Date.now() - inicio.getTime()) / 60_000)
  if (veredito === undefined) return 1
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

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executar(process.argv.includes('--controle-negativo'))
}
