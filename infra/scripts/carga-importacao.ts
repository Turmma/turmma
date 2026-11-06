import { randomBytes, randomUUID } from 'node:crypto'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import pg from 'pg'
import { CABECALHOS_DA_PLANILHA } from '../../packages/shared/src/importacao/modelos.ts'
import { argumentosDoCompose, CODIGO_THRESHOLD_CRUZADO, lerAmbienteDeCarga, rodar } from './carga.ts'
import { argumentosDoK6DeLogin, lerResumoDaFase, semearContas, type ResumoDaFase } from './carga-login.ts'
import { callApi, importarDaApi, type ModulosDaApi } from './carga-sala.ts'
import { urlDoBancoDoAmbiente } from './conferir-carga.ts'
import {
  conferirCenarioDaImportacao,
  descreverConferenciaDaImportacao,
  type ConferenciaDaImportacao,
  type EscolaDaImportacao,
  type JanelaDaImportacao,
} from './conferir-carga-importacao.ts'

/**
 * Cenário de carga "a escola inteira entra de uma vez" (F2, tarefa 16.0; Tech Spec do onboarding, seções 7c e 13; PRD, RF15), local e
 * manual, no padrão do "login às 7h30" do F1 e da "reivindicação em sala" da A1:
 *
 *   npm run carga:importacao                         sobe o compose de carga, roda as cinco fases e reprova se um critério falhar
 *   npm run carga:importacao -- --fases transferencias   só as fases pedidas, para depurar (o resultado parcial não vale como registro)
 *
 * 1. sobe o projeto `educa-carga` (infra/compose.yml com infra/compose.carga.yml: duas APIs com 1 CPU cada e o argon2 calibrado);
 * 2. a cada fase, monta pela API (e pelo banco, só o que a API não faz: o aluno já aprovado, a conta que ganha senha) a escola que a fase
 *    pede, roda o k6 e confere no Prometheus e no banco;
 * 3. derruba o projeto com os volumes, passe ou não.
 *
 * As fases (infra/k6/importacao-7h30.js tem o detalhe de cada uma):
 *   `previa_e_gravar`         3.000 linhas, prévia e gravar de duas coordenações, junto da rajada de login do F1 (2.100 contas): p95 até 2 s
 *   `transferencias_base`     a professora gera o acesso e decide, sem job: a régua da espera de trava
 *   `transferencias`          o mesmo, com o job de 300 transferências, de ida e de volta: a espera de trava abaixo de +300 ms sobre a
 *                             base, passo (3) abaixo de 1 s, zero 503 (o critério [C], seção 13)
 *   `desligamentos_e_virada`  100 e 300 desligamentos (o de 300 em três gravares de 100, o teto por gravar) e a virada de 900 alunos:
 *                             passo (3) abaixo de 1 s em cada job
 *   `professores`             300 professores contra o login dos que já têm conta: zero 503 no login
 *
 * **A espera de trava** não tem métrica própria (o `lock_timeout` do passo (3) corta em 300 ms, mas quem espera é o gerar acesso e a
 * decisão): é a diferença entre o p95 do gerar acesso e o da decisão **com o job** e o p95 **sem ele**, na mesma carga. A diferença
 * precisa ficar abaixo de `LIMITE_DA_ESPERA_DE_TRAVA_MS`.
 *
 * Nada de pessoa: nomes, matrículas, e-mails (`.invalid`), tokens e senha sintéticos, que só existem na pasta temporária da execução
 * (regra 20, item 17). Nenhuma chamada a provedor de IA (regra 80, item 11).
 */

export const SCRIPT_DO_K6_DA_IMPORTACAO = '/cenario/importacao-7h30.js'
export const OPERADOR_DA_CARGA_DA_IMPORTACAO = 'carga-importacao'

export const FASES_DO_CENARIO = ['previa_e_gravar', 'transferencias_base', 'transferencias', 'desligamentos_e_virada', 'professores'] as const
export type FaseDaImportacao = (typeof FASES_DO_CENARIO)[number]

/** O nome que a conta sintética de aluno tem (`NOME_SINTETICO`, `synthetic-sessions.ts`): a linha da planilha que o repete é "já existe". */
export const NOME_DO_ALUNO_SINTETICO = 'Pessoa sintética'

/** Quantas linhas tem a planilha da carga: o teto do contrato (`MAXIMO_DE_LINHAS_DA_PLANILHA`). */
export const LINHAS_DA_PLANILHA = 3_000
export const ALUNOS_POR_TURMA = 30
export const TURMAS_DA_PLANILHA = LINHAS_DA_PLANILHA / ALUNOS_POR_TURMA
/** Uma linha em cada dez, em cada turma, vai para a turma seguinte na planilha "movida": 300 transferências. */
export const UMA_EM_CADA = 10
export const TRANSFERENCIAS_POR_VOLTA = LINHAS_DA_PLANILHA / UMA_EM_CADA
/** As turmas que têm professora (a que gera o acesso e decide), e quantas cada uma tem. */
export const TURMAS_COM_PROFESSORA = 60
export const TURMAS_POR_PROFESSORA = 6
export const PROFESSORAS = TURMAS_COM_PROFESSORA / TURMAS_POR_PROFESSORA
/** Pedidos pendentes por turma de professora: nomes que a planilha da carga não cita, para a decisão não "desatualizar" o job. */
export const PEDIDOS_POR_TURMA = 3
export const PEDIDOS_POR_LOTE = 5
/**
 * O teto de desligamentos por gravar: o mesmo de `MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR` (`packages/shared`), que o teste do cenário confere.
 * Fica aqui porque o driver roda direto no Node, sem a compilação do pacote.
 */
export const DESLIGAMENTOS_POR_GRAVAR = 100
/** Os desligamentos de cada escola da fase (`cenarios.md`; tarefa 10.0): a de 300 sai em três gravares de 100. A medida de 16.0 mostrou 200 e 300 acima do alerta de 1 s do passo (3) num gravar só. */
export const DESLIGAMENTOS = [100, 300] as const
/** Quantos gravares uma escola precisa para desligar todos, no teto de cada um. */
export const gravaresParaDesligar = (desligamentos: number): number => Math.ceil(desligamentos / DESLIGAMENTOS_POR_GRAVAR)
export const TURMAS_DOS_DESLIGAMENTOS = 10
export const ALUNOS_DA_VIRADA = 900
export const TURMAS_DA_VIRADA = 30
/** Os professores que já têm conta e entram pelo login durante o job, e os que cada volta do job cria. */
export const PROFESSORES_QUE_JA_EXISTEM = 200
export const PROFESSORES_NOVOS_POR_VOLTA = 100
export const COORDENACOES_DA_MONTAGEM = 4

/** A espera de trava que o job pode acrescentar ao p95 do gerar acesso e da decisão (Tech Spec, 13; `cenarios.md`, RF2): 300 ms. */
export const LIMITE_DA_ESPERA_DE_TRAVA_MS = 300

/** Duração de cada fase no k6, em segundos, e o ritmo da professora. A rajada do F1 dura 5 min; a prévia e o gravar ficam dentro dela. */
export const DURACAO_DA_FASE_S: Record<FaseDaImportacao, number> = { previa_e_gravar: 240, transferencias_base: 90, transferencias: 90, desligamentos_e_virada: 0, professores: 90 }
export const ACESSOS_POR_SEGUNDO = 8
export const SEGUNDOS_ENTRE_LOTES = 2
export const LOGINS_POR_SEGUNDO = 2

// ---------------------------------------------------------------------------------------------------------------------
// As planilhas do cenário (texto puro, sem pessoa)
// ---------------------------------------------------------------------------------------------------------------------

/** O nome da turma i da planilha: "6º A" a "9º Y", 25 turmas por ano (`nomeDaTurma` lê "6º A" como a 6º ano, turma A). */
export function turmaDaCarga(indice: number): string {
  return `${String(6 + Math.floor(indice / 25))}º ${String.fromCharCode(65 + (indice % 25))}`
}

export const matriculaDaCarga = (prefixo: string, numero: number): string => `${prefixo}${String(numero).padStart(5, '0')}`

const cabecalho = (tipo: keyof typeof CABECALHOS_DA_PLANILHA): string => CABECALHOS_DA_PLANILHA[tipo].join(';')
const juntar = (tipo: keyof typeof CABECALHOS_DA_PLANILHA, linhas: readonly string[]): string => `${[cabecalho(tipo), ...linhas].join('\r\n')}\r\n`

export interface PlanilhasDeAlunos {
  /** As 3.000 linhas: 30 alunos em cada uma das 100 turmas. */
  readonly base: string
  /** As mesmas 3.000, com 300 (a posição 0, 10 e 20 de cada turma) na turma seguinte. */
  readonly movida: string
  /** As linhas que a segunda planilha põe em outra turma. */
  readonly transferidas: number
}

/** A planilha de alunos da carga e a sua versão com as transferências: a mesma matrícula e o mesmo nome, em outra turma. */
export function montarPlanilhasDeAlunos(): PlanilhasDeAlunos {
  const base: string[] = []
  const movida: string[] = []
  let transferidas = 0
  for (let numero = 1; numero <= LINHAS_DA_PLANILHA; numero++) {
    const turma = Math.floor((numero - 1) / ALUNOS_POR_TURMA)
    const posicao = (numero - 1) % ALUNOS_POR_TURMA
    const resto = `Aluno ${String(numero)};${matriculaDaCarga('C', numero)}`
    base.push(`${turmaDaCarga(turma)};${resto}`)
    const vai = posicao % UMA_EM_CADA === 0
    if (vai) transferidas++
    movida.push(`${turmaDaCarga(vai ? (turma + 1) % TURMAS_DA_PLANILHA : turma)};${resto}`)
  }
  return { base: juntar('alunos', base), movida: juntar('alunos', movida), transferidas }
}

/** Os nomes que só a lista tem (os pedidos pendentes): `PEDIDOS_POR_TURMA` em cada turma de professora, que a planilha da carga não cita. */
export function montarPlanilhaDosPedidos(): string {
  const linhas: string[] = []
  for (let turma = 0; turma < TURMAS_COM_PROFESSORA; turma++) {
    for (let pedido = 0; pedido < PEDIDOS_POR_TURMA; pedido++) linhas.push(`${turmaDaCarga(turma)};Pedido ${String(turma)}-${String(pedido)};${matriculaDaPedido(turma, pedido)}`)
  }
  return juntar('alunos', linhas)
}

export const matriculaDaPedido = (turma: number, pedido: number): string => `P${String(turma).padStart(3, '0')}${String(pedido)}`
export const nomeDoPedido = (turma: number, pedido: number): string => `Pedido ${String(turma)}-${String(pedido)}`

/** A turma do professor `indice` e as de cada professora: seis turmas seguidas. */
export function turmasDaProfessora(professora: number): number[] {
  return Array.from({ length: TURMAS_POR_PROFESSORA }, (_, posicao) => professora * TURMAS_POR_PROFESSORA + posicao)
}

/** Os alunos que vão ficar aprovados (e, menos um por turma, serão desligados) numa escola de `desligamentos`. */
export function montarPlanilhaParaAprovar(desligamentos: number): { texto: string; matriculas: string[]; quemFica: string } {
  const total = desligamentos + TURMAS_DOS_DESLIGAMENTOS
  const matriculas = Array.from({ length: total }, (_, posicao) => matriculaDaCarga('D', posicao + 1))
  const turmaDe = (posicao: number) => turmaDaCarga(posicao % TURMAS_DOS_DESLIGAMENTOS)
  const linhas = matriculas.map((matricula, posicao) => `${turmaDe(posicao)};Aluno ${String(posicao + 1)};${matricula}`)
  // A planilha que desliga cita as dez turmas com um aluno em cada (os dez primeiros, já aprovados, com o nome do cadastro dele): os outros saem.
  const quemFica = juntar(
    'alunos',
    matriculas.slice(0, TURMAS_DOS_DESLIGAMENTOS).map((matricula, posicao) => `${turmaDe(posicao)};${NOME_DO_ALUNO_SINTETICO};${matricula}`),
  )
  return { texto: juntar('alunos', linhas), matriculas, quemFica }
}

/** A planilha da virada: 900 alunos que já têm conta na escola, para o ano planejado, em 30 turmas novas. */
export function montarPlanilhaDaVirada(): { texto: string; matriculas: string[] } {
  const matriculas = Array.from({ length: ALUNOS_DA_VIRADA }, (_, posicao) => matriculaDaCarga('V', posicao + 1))
  const linhas = matriculas.map((matricula, posicao) => `${turmaDaCarga(posicao % TURMAS_DA_VIRADA)};${NOME_DO_ALUNO_SINTETICO};${matricula}`)
  return { texto: juntar('alunos', linhas), matriculas }
}

/** A planilha de professores: os que já têm conta (cada um com o e-mail da conta dele). A volta do k6 acrescenta os novos. */
export function montarPlanilhaDaEquipe(emails: readonly string[]): string {
  return juntar(
    'professores',
    emails.map((email) => `${NOME_DO_ALUNO_SINTETICO};${email}`),
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// O k6 e o veredito
// ---------------------------------------------------------------------------------------------------------------------

/** O `k6 run` de uma fase, dentro do container. */
export function argumentosDoK6DaImportacao(fase: FaseDaImportacao): string[] {
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
    `ARQUIVO_DAS_CONTAS=/execucao/contas-${fase}.json`,
    SCRIPT_DO_K6_DA_IMPORTACAO,
  ]
}

export interface Reprovacao {
  readonly criterio: string
  readonly detalhe: string
}

export interface VereditoDaImportacao {
  readonly passou: boolean
  readonly reprovacoes: readonly Reprovacao[]
  /** Os p95 que o veredito comparou, para o registro da tarefa: o gerar acesso e a decisão, sem e com o job. */
  readonly espera: ReadonlyArray<{ rota: string; base: number; comJob: number; diferenca: number }>
}

const METRICAS_DA_ESPERA = [
  ['gerar acesso', 'gerar_acesso_duracao p(95)'],
  ['decidir', 'decidir_duracao p(95)'],
] as const

/**
 * A espera de trava que o job acrescenta: o p95 da rota **com o job** menos o p95 dela **sem o job**, na mesma carga. Sem a medida de um
 * dos lados, reprova: a fase que não mediu não passa por não ter medido.
 */
export function julgarEsperaDeTrava(base: ResumoDaFase | undefined, comJob: ResumoDaFase | undefined): { reprovacoes: Reprovacao[]; espera: VereditoDaImportacao['espera'] } {
  const reprovacoes: Reprovacao[] = []
  const espera: Array<VereditoDaImportacao['espera'][number]> = []
  for (const [rota, chave] of METRICAS_DA_ESPERA) {
    const semJob = base?.valores[chave]
    const comOJob = comJob?.valores[chave]
    if (semJob === undefined || comOJob === undefined) {
      reprovacoes.push({ criterio: `espera:${rota}`, detalhe: `a espera de trava de ${rota} não foi medida (base ${String(semJob)}, com o job ${String(comOJob)})` })
      continue
    }
    const diferenca = comOJob - semJob
    espera.push({ rota, base: semJob, comJob: comOJob, diferenca })
    if (diferenca >= LIMITE_DA_ESPERA_DE_TRAVA_MS) reprovacoes.push({ criterio: `espera:${rota}`, detalhe: `${rota}: o p95 sobe ${String(Math.round(diferenca))} ms com o job (${String(Math.round(semJob))} → ${String(Math.round(comOJob))}), e o teto é ${String(LIMITE_DA_ESPERA_DE_TRAVA_MS)} ms` })
  }
  return { reprovacoes, espera }
}

/** O que cada fase precisa ter rodado no k6: a fase em si e, na primeira, a rajada de login do F1 que corre ao lado. */
export function resumosDaFase(fase: FaseDaImportacao): readonly string[] {
  return fase === 'previa_e_gravar' ? [fase, 'rajada'] : [fase]
}

/** O que reprova num resumo do k6: a fase que não rodou, o threshold cruzado, e o código de saída que não concorda com o resumo. */
export function julgarResumo(chave: string, resumo: ResumoDaFase | undefined): Reprovacao[] {
  if (resumo === undefined) return [{ criterio: `${chave}:k6`, detalhe: `${chave}: a fase não rodou` }]
  const reprovacoes: Reprovacao[] = resumo.cruzados.map(({ metrica, criterio }) => ({ criterio: `${chave}:${metrica}`, detalhe: `${chave}: ${metrica} ${criterio}` }))
  const saidaEsperada = resumo.cruzados.length > 0 ? CODIGO_THRESHOLD_CRUZADO : 0
  if (resumo.codigo !== saidaEsperada) reprovacoes.push({ criterio: `${chave}:k6`, detalhe: `${chave}: k6 saiu com ${String(resumo.codigo)}, e o resumo pedia ${String(saidaEsperada)}` })
  return reprovacoes
}

/**
 * Junta o k6 de cada fase e a conferência num veredito. Fase pedida que não rodou reprova; o código de saída do k6 e o resumo precisam
 * concordar (99 com threshold cruzado, 0 sem). A espera de trava só se julga com as duas fases (base e com job) pedidas.
 */
export function julgarCenarioDaImportacao(fases: readonly FaseDaImportacao[], resumos: ReadonlyMap<string, ResumoDaFase>, conferencia: ConferenciaDaImportacao | undefined): VereditoDaImportacao {
  const reprovacoes: Reprovacao[] = fases.flatMap((fase) => resumosDaFase(fase).flatMap((chave) => julgarResumo(chave, resumos.get(chave))))
  const julgada = julgarEsperaDeTrava(resumos.get('transferencias_base'), resumos.get('transferencias'))
  const comEspera = fases.includes('transferencias') || fases.includes('transferencias_base')
  if (comEspera) reprovacoes.push(...julgada.reprovacoes)
  if (conferencia === undefined) reprovacoes.push({ criterio: 'conferencia', detalhe: 'a conferência no banco e no Prometheus não rodou' })
  else reprovacoes.push(...conferencia.reprovacoes.map((motivo) => ({ criterio: 'conferencia', detalhe: `conferência: ${motivo}` })))
  return { passou: reprovacoes.length === 0, reprovacoes, espera: comEspera ? julgada.espera : [] }
}

/** As fases pedidas (`--fases a,b`), na ordem do cenário; sem a opção, todas. A `transferencias` leva a base junto, que é a régua dela. */
export function fasesPedidas(argumentos: readonly string[]): readonly FaseDaImportacao[] {
  const indice = argumentos.indexOf('--fases')
  if (indice < 0) return FASES_DO_CENARIO
  const pedidas = (argumentos[indice + 1] ?? '').split(',').filter((fase) => fase !== '')
  const desconhecida = pedidas.find((fase) => !FASES_DO_CENARIO.some((aceita) => aceita === fase))
  if (pedidas.length === 0 || desconhecida !== undefined) throw new Error(`--fases aceita só: ${FASES_DO_CENARIO.join(', ')}`)
  return FASES_DO_CENARIO.filter((fase) => pedidas.includes(fase) || (fase === 'transferencias_base' && pedidas.includes('transferencias')))
}

/** As linhas do registro de uma fase: p95 do que ela mede, o máximo do job e as contagens. */
export function descreverFase(fase: string, resumo: ResumoDaFase): string[] {
  const linhas = Object.entries(resumo.valores)
    .filter(([chave]) =>
      /^((previa_duracao|gravar_duracao|gerar_acesso_duracao|decidir_duracao|login_duracao|job_duracao(\{trabalho:[a-z_0-9]+\})?) (p\(95\)|max)|(respostas_5xx|respostas_503|respostas_inesperadas|previas_com_3000_linhas|gravares_aceitos|jobs_concluidos|jobs_desatualizados|jobs_nao_concluidos|acessos_gerados|decisoes_feitas|logins_feitos|marcas_fora_do_esperado|dropped_iterations) count|login_duracao\{grupo:[a-z_]+\} p\(95\))$/.test(chave),
    )
    .map(([chave, valor]) => `  ${fase}: ${chave} = ${String(Math.round(valor))}`)
  return [`\n${fase}:`, ...linhas]
}

/** Os trabalhos que o k6 da fase lê do arquivo: o que cada job faz e quantas marcas a prévia dele precisa oferecer. */
export interface TrabalhoDoK6 {
  readonly nome: string
  readonly tipo: 'alunos' | 'professores'
  readonly token: string
  readonly marcar: readonly ('transferir' | 'desligar' | 'encerrar')[]
  readonly esperadas?: number
  /** Quantas marcas cada gravar leva, no máximo (o teto do desligamento). */
  readonly marcarAte?: number
  /** Quantas vezes o trabalho se repete, cada uma com a prévia nova (a que desliga em gravares de 100). */
  readonly rodadas?: number
  readonly anoLetivoId?: string
  readonly texto?: string
}

// ---------------------------------------------------------------------------------------------------------------------
// A montagem das escolas, pela API
// ---------------------------------------------------------------------------------------------------------------------

type Chamar = (metodo: 'POST' | 'GET', caminho: string, corpo?: unknown) => Promise<Record<string, unknown>>

const PRAZO_DO_JOB_MS = 120_000

/** Uma chamada anônima (a sala do aluno), repetindo no 429 e no 503 pelo `Retry-After`. */
async function chamarSemToken(url: string, caminho: string, corpo: unknown): Promise<Record<string, unknown>> {
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const resposta = await fetch(`${url}${caminho}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    if (resposta.status === 429 || resposta.status === 503) {
      await esperar(Number(resposta.headers.get('retry-after') ?? '2') * 1_000)
      continue
    }
    if (!resposta.ok) throw new Error(`POST ${caminho} respondeu ${String(resposta.status)}`)
    return (await resposta.json()) as Record<string, unknown>
  }
  throw new Error(`POST ${caminho}: sem resposta depois de 10 tentativas`)
}

/** Grava a planilha pela rota de verdade e espera o job terminar `concluida`: o seed nunca segue com o mundo pela metade. */
async function gravarEEsperar(chamar: Chamar, tipo: string, texto: string, anoLetivoId?: string): Promise<void> {
  const { id } = await chamar('POST', `/v1/importacoes/${tipo}`, { texto, ...(anoLetivoId === undefined ? {} : { anoLetivoId }) })
  const limite = Date.now() + PRAZO_DO_JOB_MS
  while (Date.now() < limite) {
    const { estado } = await chamar('GET', `/v1/importacoes/${String(id)}`)
    if (estado === 'concluida') return
    if (estado !== 'na_fila') throw new Error(`a importação de ${tipo} do seed terminou ${String(estado)}`)
    await esperar(250)
  }
  throw new Error(`a importação de ${tipo} do seed não terminou no prazo`)
}

interface LoadSession {
  readonly usuarioId: string
  readonly token: string
}

interface EscolaBase {
  readonly escolaId: string
  readonly slug: string
  readonly coordenacoes: readonly LoadSession[]
  /** Uma chamada da coordenação, em rodízio entre as sessões (cada uma fica abaixo do limite por usuário). */
  readonly coordenacao: Chamar
  readonly url: string
  readonly anoEmCursoId: string
}

interface Contexto {
  readonly modulos: ModulosDaApi
  readonly banco: ReturnType<ModulosDaApi['nucleo']['createDatabase']>
  readonly pool: pg.Pool
  readonly doArquivo: Record<string, string>
  readonly redeId: string
  readonly senha: string
  readonly senhaHash: string
}

/** Cria a escola, as sessões de coordenação e o ano em curso aberto, como a coordenação faria. */
async function criarEscola(contexto: Contexto, rotulo: string, comAno = true): Promise<EscolaBase> {
  const autor = async () => OPERADOR_DA_CARGA_DA_IMPORTACAO
  const slug = `imp-${rotulo}-${randomUUID()}`
  const { id: escolaId } = await contexto.modulos.escolas.criarEscola(contexto.banco, autor, { id: randomUUID(), redeId: contexto.redeId, nome: `Escola sintética da importação ${rotulo}`, slug })
  const url = `http://127.0.0.1:${contexto.doArquivo['BORDA_PORTA_HOST'] ?? ''}`
  const coordenacoes = await contexto.modulos.sessoes.createSyntheticSessions(contexto.banco, contexto.doArquivo, { escolaId, papel: 'coordenador', quantidade: COORDENACOES_DA_MONTAGEM })
  let vez = 0
  const coordenacao: Chamar = (metodo, caminho, corpo) => callApi(url, coordenacoes[vez++ % coordenacoes.length]?.token ?? '', metodo, caminho, corpo)
  let anoEmCursoId = ''
  if (comAno) {
    const ano = await coordenacao('POST', '/v1/anos-letivos', { ano: 2026, inicio: '2026-02-01', fim: '2026-12-15' })
    anoEmCursoId = String(ano['id'])
    await coordenacao('POST', `/v1/anos-letivos/${anoEmCursoId}/abrir`)
  }
  return { escolaId, slug, coordenacoes, coordenacao, url, anoEmCursoId }
}

/** As turmas da escola pelo nome (a planilha de alunos as criou pela chave do nome). */
async function turmasPorNome(pool: pg.Pool, escolaId: string): Promise<Map<string, string>> {
  const { rows } = await pool.query<{ id: string; nome: string }>('select id, nome from turma where escola_id = $1', [escolaId])
  return new Map(rows.map((linha) => [linha.nome, linha.id]))
}

export interface EscolaMontada {
  readonly escola: EscolaDaImportacao
  /** O que o k6 da fase lê, além da senha e do ritmo. */
  readonly arquivo: Record<string, unknown>
}

const ritmo = (fase: FaseDaImportacao) => ({
  duracaoS: DURACAO_DA_FASE_S[fase],
  taxaDeAcessosPorSegundo: ACESSOS_POR_SEGUNDO,
  intervaloDoLoteS: SEGUNDOS_ENTRE_LOTES,
  taxaDeLoginsPorSegundo: LOGINS_POR_SEGUNDO,
})

/** A fase `previa_e_gravar`: a escola só com o ano, e a planilha de 3.000 linhas para as duas coordenações repetirem. */
async function montarPreviaEGravar(contexto: Contexto): Promise<EscolaMontada> {
  const escola = await criarEscola(contexto, 'previa')
  const { base } = montarPlanilhasDeAlunos()
  return {
    escola: { fase: 'previa_e_gravar', slug: escola.slug, concluidasMinimas: 3 },
    arquivo: { senha: contexto.senha, ...ritmo('previa_e_gravar'), coordenacoes: escola.coordenacoes.slice(0, 2).map(({ token }) => ({ token })), planilhas: { base } },
  }
}

/**
 * A fase das transferências (a base e a com job usam uma escola cada, iguais): as 3.000 linhas gravadas, os pedidos pendentes de cada
 * turma de professora, o vínculo confirmado e o acesso de cada turma. É nas turmas dessas professoras que o gerar acesso e a decisão rodam
 * enquanto o job move 300 alunos entre as turmas.
 */
async function montarTransferencias(contexto: Contexto, fase: 'transferencias_base' | 'transferencias'): Promise<EscolaMontada> {
  const escola = await criarEscola(contexto, fase.replace(/_/g, '-'))
  const { base, movida } = montarPlanilhasDeAlunos()
  await gravarEEsperar(escola.coordenacao, 'alunos', base)
  await gravarEEsperar(escola.coordenacao, 'alunos', montarPlanilhaDosPedidos())
  const turmas = await turmasPorNome(contexto.pool, escola.escolaId)
  const professoras = await contexto.modulos.sessoes.createSyntheticSessions(contexto.banco, contexto.doArquivo, { escolaId: escola.escolaId, papel: 'professor', quantidade: PROFESSORAS })
  const disciplina = await escola.coordenacao('POST', '/v1/disciplinas', { nome: 'Química' })

  const turmasComAcesso: Array<{ id: string; token: string }> = []
  const lotesDeDecisao: Array<{ token: string; ids: string[] }> = []
  for (const [indice, professora] of professoras.entries()) {
    const pendentes: string[] = []
    for (const turma of turmasDaProfessora(indice)) {
      const turmaId = turmas.get(turmaDaCarga(turma))
      if (turmaId === undefined) throw new Error('a turma da professora da carga não foi criada pela planilha')
      pendentes.push(...(await prepararTurmaDaProfessora(contexto, escola, professora, String(disciplina['id']), turma, turmaId)))
      turmasComAcesso.push({ id: turmaId, token: professora.token })
    }
    for (let inicio = 0; inicio < pendentes.length; inicio += PEDIDOS_POR_LOTE) lotesDeDecisao.push({ token: professora.token, ids: pendentes.slice(inicio, inicio + PEDIDOS_POR_LOTE) })
  }
  const trabalhos: TrabalhoDoK6[] = [{ nome: 'transferencias', tipo: 'alunos', token: escola.coordenacoes[0]?.token ?? '', marcar: ['transferir'], esperadas: TRANSFERENCIAS_POR_VOLTA }]
  return {
    escola: { fase, slug: escola.slug, concluidasMinimas: fase === 'transferencias' ? 2 + 3 : 2 },
    arquivo: { senha: contexto.senha, ...ritmo(fase), coordenacoes: escola.coordenacoes.map(({ token }) => ({ token })), planilhas: { base, movida }, turmasComAcesso, lotesDeDecisao, trabalhos },
  }
}

/**
 * Uma turma da professora: o vínculo que a coordenação define e ela confirma, o acesso da turma e os pedidos pendentes (os nomes que a
 * planilha da carga não cita, reivindicados como os alunos fazem, pelo link da turma). Devolve os ids dos pedidos que a professora vai decidir.
 */
async function prepararTurmaDaProfessora(contexto: Contexto, escola: EscolaBase, professora: LoadSession, disciplinaId: string, turma: number, turmaId: string): Promise<string[]> {
  const vinculo = await escola.coordenacao('POST', '/v1/vinculos', { usuarioId: professora.usuarioId, turmaId, disciplinaId, papel: 'professor' })
  await callApi(escola.url, professora.token, 'POST', `/v1/vinculos/${String(vinculo['id'])}/confirmar`)
  const acesso = await callApi(escola.url, professora.token, 'POST', `/v1/turmas/${turmaId}/acesso`, { validadeDias: 7 })
  const aberta = await chamarSemToken(escola.url, '/v1/salas/abrir', { slug: escola.slug, token: acesso['token'] })
  const nomes = new Map(((aberta['nomes'] ?? []) as Array<{ id: string; nome: string }>).map((item) => [item.nome, item.id]))
  for (let pedido = 0; pedido < PEDIDOS_POR_TURMA; pedido++) {
    const listaNomeId = nomes.get(nomeDoPedido(turma, pedido))
    if (listaNomeId === undefined) throw new Error('o nome do pedido não está na lista da turma')
    await chamarSemToken(escola.url, '/v1/salas/reivindicar', { slug: escola.slug, token: acesso['token'], listaNomeId, matricula: matriculaDaPedido(turma, pedido), senha: contexto.senha, chaveEnvio: randomUUID() })
  }
  const lista = await callApi(escola.url, professora.token, 'GET', `/v1/turmas/${turmaId}/reivindicacoes?limite=100`)
  return ((lista['itens'] ?? []) as Array<{ id: string }>).map((item) => item.id)
}

/** Dá a lista de uma escola aos alunos já aprovados: usuário e credencial por matrícula, a linha da lista `aprovado` e o vínculo `confirmado`. */
async function aprovarNaLista(contexto: Contexto, escola: EscolaBase, matriculas: readonly string[], anoLetivoId: string): Promise<void> {
  const usuarios = await contexto.modulos.sessoes.criarAlunosComMatricula(contexto.banco, contexto.doArquivo, escola.escolaId, matriculas.map((matricula) => ({ matricula, senhaHash: contexto.senhaHash })))
  const { rows } = await contexto.pool.query<{ turma_id: string; usuario_id: string }>(
    `with par as (select * from unnest($3::text[], $4::uuid[]) as p(matricula, usuario_id))
     update lista_nome l set usuario_id = par.usuario_id, nome = null, matricula = null, estado = 'aprovado'
       from par
      where l.escola_id = $1 and l.ano_letivo_id = $2 and l.matricula = par.matricula
  returning l.turma_id, l.usuario_id`,
    [escola.escolaId, anoLetivoId, matriculas, usuarios],
  )
  if (rows.length !== matriculas.length) throw new Error('a lista da carga não tinha todos os nomes a aprovar')
  await contexto.pool.query(
    `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em)
     select $1, $2, usuario_id, turma_id, 'aluno', 'confirmado', $3, now() from unnest($4::uuid[], $5::uuid[]) as v(turma_id, usuario_id)`,
    [escola.escolaId, anoLetivoId, escola.coordenacoes[0]?.usuarioId, rows.map((linha) => linha.turma_id), rows.map((linha) => linha.usuario_id)],
  )
}

/** A fase dos desligamentos e da virada: uma escola para cada job, todas prontas antes de o k6 começar. */
async function montarDesligamentosEVirada(contexto: Contexto): Promise<EscolaMontada[]> {
  const montadas: EscolaMontada[] = []
  const trabalhos: TrabalhoDoK6[] = []
  for (const desligamentos of DESLIGAMENTOS) {
    const escola = await criarEscola(contexto, `desliga-${String(desligamentos)}`)
    const { texto, matriculas, quemFica } = montarPlanilhaParaAprovar(desligamentos)
    await gravarEEsperar(escola.coordenacao, 'alunos', texto)
    await aprovarNaLista(contexto, escola, matriculas, escola.anoEmCursoId)
    trabalhos.push({ nome: `desligamentos_${String(desligamentos)}`, tipo: 'alunos', token: escola.coordenacoes[0]?.token ?? '', marcar: ['desligar'], esperadas: Math.min(desligamentos, DESLIGAMENTOS_POR_GRAVAR), marcarAte: DESLIGAMENTOS_POR_GRAVAR, rodadas: gravaresParaDesligar(desligamentos), texto: quemFica })
    montadas.push({ escola: { fase: `desligamentos_e_virada:${String(desligamentos)}`, slug: escola.slug, concluidasMinimas: 1 + gravaresParaDesligar(desligamentos) }, arquivo: {} })
  }
  const escola = await criarEscola(contexto, 'virada')
  const { texto, matriculas } = montarPlanilhaDaVirada()
  const planejado = await escola.coordenacao('POST', '/v1/anos-letivos', { ano: 2027, inicio: '2027-02-01', fim: '2027-12-15' })
  await contexto.modulos.sessoes.criarAlunosComMatricula(contexto.banco, contexto.doArquivo, escola.escolaId, matriculas.map((matricula) => ({ matricula, senhaHash: contexto.senhaHash })))
  trabalhos.push({ nome: 'virada', tipo: 'alunos', token: escola.coordenacoes[0]?.token ?? '', marcar: [], esperadas: 0, anoLetivoId: String(planejado['id']), texto })
  montadas.push({ escola: { fase: 'desligamentos_e_virada:virada', slug: escola.slug, concluidasMinimas: 1 }, arquivo: {} })
  const [primeira] = montadas
  if (primeira === undefined) throw new Error('nenhuma escola montada para os desligamentos')
  // O arquivo é um só: o k6 lê os três trabalhos de uma vez.
  montadas[0] = { ...primeira, arquivo: { senha: contexto.senha, ...ritmo('desligamentos_e_virada'), trabalhos } }
  return montadas
}

/** A fase dos professores: a equipe que já tem conta e senha (o login do k6) e a planilha dela, que cada volta acrescenta de novos. */
async function montarProfessores(contexto: Contexto): Promise<EscolaMontada> {
  const escola = await criarEscola(contexto, 'professores', false)
  const equipe = await contexto.modulos.sessoes.createSyntheticSessions(contexto.banco, contexto.doArquivo, { escolaId: escola.escolaId, papel: 'professor', quantidade: PROFESSORES_QUE_JA_EXISTEM })
  // O professor sintético nasce com conta sem senha: a senha da carga entra aqui, e o e-mail (`.invalid`) sai para o k6.
  const { rows } = await contexto.pool.query<{ email: string }>(
    `update conta set senha_hash = $1 from usuario where usuario.conta_id = conta.id and usuario.id = any($2::uuid[]) returning conta.email`,
    [contexto.senhaHash, equipe.map((professor) => professor.usuarioId)],
  )
  const emails = rows.map((linha) => linha.email).sort()
  const trabalhos: TrabalhoDoK6[] = [{ nome: 'professores', tipo: 'professores', token: escola.coordenacoes[0]?.token ?? '', marcar: [] }]
  return {
    escola: { fase: 'professores', slug: escola.slug, concluidasMinimas: 3 },
    arquivo: {
      senha: contexto.senha,
      ...ritmo('professores'),
      coordenacoes: escola.coordenacoes.map(({ token }) => ({ token })),
      planilhas: { professores: montarPlanilhaDaEquipe(emails), novosPorVolta: PROFESSORES_NOVOS_POR_VOLTA },
      trabalhos,
      logins: emails.map((email) => ({ email })),
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// A execução
// ---------------------------------------------------------------------------------------------------------------------

function escrever(linha: string): void {
  process.stdout.write(`${linha}\n`)
}

/** Quantas vezes o passo (3) precisa ter rodado em cada fase: o que o k6 conta como job concluído, no mínimo. */
export const PASSO_3_MINIMO: Record<FaseDaImportacao, number> = { previa_e_gravar: 1, transferencias_base: 0, transferencias: 3, desligamentos_e_virada: DESLIGAMENTOS.reduce((soma, desligamentos) => soma + gravaresParaDesligar(desligamentos), 0) + 1, professores: 3 }

type Compose = (...argumentos: string[]) => Promise<{ codigo: number }>

/** O que as fases deixam para a conferência e para o veredito. */
interface RegistroDasFases {
  readonly resumos: Map<string, ResumoDaFase>
  readonly janelas: JanelaDaImportacao[]
  readonly escolas: EscolaDaImportacao[]
}

/** Monta, pela API, a escola (ou as escolas) que a fase pede. */
async function montarDaFase(contexto: Contexto, fase: FaseDaImportacao): Promise<EscolaMontada[]> {
  if (fase === 'previa_e_gravar') return [await montarPreviaEGravar(contexto)]
  if (fase === 'transferencias_base' || fase === 'transferencias') return [await montarTransferencias(contexto, fase)]
  if (fase === 'desligamentos_e_virada') return montarDesligamentosEVirada(contexto)
  return [await montarProfessores(contexto)]
}

/** Roda um k6 num container do compose e lê o resumo que ele gravou na pasta da execução. */
async function rodarK6(compose: Compose, pasta: string, servico: 'k6' | 'k6-atacante', argumentos: string[], resumo: string): Promise<ResumoDaFase> {
  const { codigo } = await compose('run', '--rm', '--no-deps', servico, ...argumentos)
  let lido: unknown
  try {
    lido = JSON.parse(readFileSync(join(pasta, `${resumo}.json`), 'utf8'))
  } catch {
    lido = undefined
  }
  return lerResumoDaFase(codigo, lido)
}

/**
 * A rajada do F1 corre ao lado da prévia e do gravar: 2.100 contas de três escolas, do container do k6 da escola, e a importação sai do
 * outro, com IP próprio, como a coordenação de uma escola que não é uma das três.
 */
async function prepararARajada(pasta: string, doArquivo: Record<string, string>): Promise<void> {
  escrever('  as 2.100 contas da rajada de login')
  const contas = await semearContas(doArquivo)
  const arquivo = join(pasta, 'contas.json')
  writeFileSync(arquivo, JSON.stringify(contas))
  chmodSync(arquivo, 0o644)
}

function iniciarARajada(compose: Compose, pasta: string): Promise<ResumoDaFase> {
  escrever('  a rajada de login entra ao mesmo tempo')
  return rodarK6(compose, pasta, 'k6', argumentosDoK6DeLogin('rajada'), 'resumo-rajada')
}

/** Uma fase: monta as escolas, escreve o arquivo do k6, roda o k6 (com a rajada ao lado, na primeira) e registra a janela. */
async function rodarFase(contexto: Contexto, compose: Compose, pasta: string, fase: FaseDaImportacao, registro: RegistroDasFases): Promise<void> {
  // As contas da rajada primeiro: semear 2.100 contas leva minutos, e o token de acesso de quem monta a escola vale 10 min
  // (`VALIDADE_TOKEN_ACESSO_SEGUNDOS`). Semeadas depois da montagem, as sessões da coordenação venciam no fim dos 240 s da fase.
  if (fase === 'previa_e_gravar') await prepararARajada(pasta, contexto.doArquivo)
  escrever(`\n▶ ${fase}: a escola montada pela API`)
  const montadas = await montarDaFase(contexto, fase)
  const [primeira] = montadas
  if (primeira === undefined) throw new Error('a fase não montou escola')
  registro.escolas.push(...montadas.map(({ escola }) => escola))
  const arquivo = join(pasta, `contas-${fase}.json`)
  writeFileSync(arquivo, JSON.stringify(primeira.arquivo))
  chmodSync(arquivo, 0o644)

  const rajada = fase === 'previa_e_gravar' ? iniciarARajada(compose, pasta) : undefined
  // A montagem também grava planilha: a última exportação das métricas dela chega antes de a janela abrir, para não entrar nela.
  await esperar(3 * Number(contexto.doArquivo['TELEMETRIA_INTERVALO_MS'] ?? '5000'))
  escrever(`\n▶ k6, fase ${fase}`)
  const comeco = new Date()
  registro.resumos.set(fase, await rodarK6(compose, pasta, fase === 'previa_e_gravar' ? 'k6-atacante' : 'k6', argumentosDoK6DaImportacao(fase), `resumo-${fase}`))
  if (rajada !== undefined) registro.resumos.set('rajada', await rajada)
  // A última exportação das métricas chega até `TELEMETRIA_INTERVALO_MS` depois do último job: a janela só fecha depois dela, e a montagem da
  // fase seguinte (que também grava planilha) só começa depois, para as observações dela não entrarem nesta janela.
  await esperar(3 * Number(contexto.doArquivo['TELEMETRIA_INTERVALO_MS'] ?? '5000'))
  registro.janelas.push({ fase, inicio: comeco, fim: new Date(), passo3Minimo: PASSO_3_MINIMO[fase] })
}

/** Confere no banco e no Prometheus, depois da última exportação de métricas. */
async function conferirTudo(doArquivo: Record<string, string>, registro: RegistroDasFases): Promise<ConferenciaDaImportacao> {
  escrever('\n▶ conferência no banco e no Prometheus')
  // As métricas saem a cada TELEMETRIA_INTERVALO_MS: espera a última exportação de cada instância chegar.
  await esperar(3 * Number(doArquivo['TELEMETRIA_INTERVALO_MS'] ?? '5000'))
  const cliente = new pg.Client({ connectionString: urlDoBancoDoAmbiente(doArquivo) })
  await cliente.connect()
  try {
    return await conferirCenarioDaImportacao({ banco: cliente, prometheus: `http://127.0.0.1:${doArquivo['PROMETHEUS_PORTA_HOST'] ?? ''}`, janelas: registro.janelas, escolas: registro.escolas })
  } finally {
    await cliente.end()
  }
}

/** A senha da carga, o hash dela (gerado uma vez, com os parâmetros calibrados) e a rede das escolas. */
async function prepararContexto(modulos: ModulosDaApi, pool: pg.Pool, doArquivo: Record<string, string>): Promise<Contexto> {
  const banco = modulos.nucleo.createDatabase(pool as unknown as Parameters<ModulosDaApi['nucleo']['createDatabase']>[0])
  const senha = randomBytes(18).toString('base64url')
  const hasher = await modulos.hash.PasswordHasher.criar({ memoriaKib: Number(doArquivo['LOGIN_ARGON2_MEMORIA_KIB']), iteracoes: Number(doArquivo['LOGIN_ARGON2_ITERACOES']) })
  const autor = async () => OPERADOR_DA_CARGA_DA_IMPORTACAO
  const { id: redeId } = await modulos.escolas.criarRede(banco, autor, { id: randomUUID(), nome: 'Rede sintética da importação', tipo: 'independente' })
  return { modulos, banco, pool, doArquivo, redeId, senha, senhaHash: await hasher.gerar(senha) }
}

async function rodarFases(compose: Compose, pasta: string, doArquivo: Record<string, string>, fases: readonly FaseDaImportacao[]): Promise<VereditoDaImportacao> {
  const subida = await compose('up', '--detach', '--build', '--wait')
  if (subida.codigo !== 0) throw new Error('o compose de carga não subiu')
  const modulos = await importarDaApi()
  const pool = modulos.nucleo.createPool({ url: urlDoBancoDoAmbiente(doArquivo), maximoConexoes: 4, timeoutConexaoMs: 5_000, timeoutConsultaMs: 120_000 }, () => undefined) as unknown as pg.Pool
  const registro: RegistroDasFases = { resumos: new Map(), janelas: [], escolas: [] }
  try {
    const contexto = await prepararContexto(modulos, pool, doArquivo)
    for (const fase of fases) await rodarFase(contexto, compose, pasta, fase, registro)
  } finally {
    await pool.end()
  }
  const conferencia = await conferirTudo(doArquivo, registro)
  for (const linha of descreverConferenciaDaImportacao(conferencia)) escrever(linha)
  for (const [fase, resumo] of registro.resumos) for (const linha of descreverFase(fase, resumo)) escrever(linha)
  const veredito = julgarCenarioDaImportacao(fases, registro.resumos, conferencia)
  for (const { rota, base, comJob, diferenca } of veredito.espera) escrever(`  espera de trava, ${rota}: p95 sem o job ${String(Math.round(base))} ms, com o job ${String(Math.round(comJob))} ms, diferença ${String(Math.round(diferenca))} ms`)
  return veredito
}

async function executar(fases: readonly FaseDaImportacao[]): Promise<number> {
  const pasta = mkdtempSync(join(tmpdir(), 'educa-carga-importacao-'))
  // O k6 do container roda com outro usuário: ele lê as contas e grava o resumo nesta pasta. A pasta aberta e o arquivo legível por todos
  // só servem porque tudo aqui é sintético e sai no fim da execução: não copie o padrão para dado real.
  chmodSync(pasta, 0o777)
  const doArquivo = lerAmbienteDeCarga()
  const ambiente: NodeJS.ProcessEnv = {
    ...Object.fromEntries(Object.entries(process.env).filter(([chave]) => !(chave in doArquivo))),
    CARGA_PASTA_DA_EXECUCAO: pasta,
    LOGIN_PROTECAO_DESLIGADA: 'false',
  }
  const compose: Compose = (...argumentos) => rodar('docker', [...argumentosDoCompose(), ...argumentos], ambiente)
  const inicio = new Date()
  let veredito: VereditoDaImportacao | undefined
  try {
    escrever(`\n▶ cenário "a escola inteira entra de uma vez": ${fases.join(', ')}`)
    await compose('down', '--volumes', '--remove-orphans')
    veredito = await rodarFases(compose, pasta, doArquivo, fases)
  } catch (erro) {
    escrever(`\n✖ o cenário não terminou: ${erro instanceof Error ? erro.message : String(erro)}`)
    await compose('logs', '--no-color', '--tail', '100', 'api-1', 'api-2', 'worker-lote-1', 'worker-lote-2')
  } finally {
    await compose('down', '--volumes', '--remove-orphans')
    rmSync(pasta, { recursive: true, force: true })
  }

  const duracao = Math.round((Date.now() - inicio.getTime()) / 60_000)
  if (veredito === undefined) return 1
  escrever(`\n■ resultado em ${inicio.toISOString()} (${String(duracao)} min): ${veredito.passou ? 'passou' : 'reprovou'}`)
  for (const reprovacao of veredito.reprovacoes) escrever(`  reprovado: ${reprovacao.detalhe}`)
  escrever(veredito.passou ? '✔ cenário passou' : '✖ cenário reprovou')
  return veredito.passou ? 0 : 1
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executar(fasesPedidas(process.argv.slice(2)))
}
