import { randomBytes, randomUUID } from 'node:crypto'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { Redis } from 'ioredis'
import pg from 'pg'
import type { criarEscola, criarRede } from '../../apps/api/src/operacao/escola/escola.ts'
import type { HashDeSenha } from '../../apps/api/src/credencial/password-hasher.ts'
import type { criarAlunosComMatricula, criarSessoesSinteticas } from '../../apps/api/src/sessao/tenant/synthetic-sessions.ts'
import type { createDatabase, createPool } from '@educa/core'
import { raizRepositorio } from '../../tools/ci/executar.ts'
import { argumentosDoCompose, CODIGO_THRESHOLD_CRUZADO, lerAmbienteDeCarga, rodar } from './carga.ts'
import { lerResumoDaFase, matriculaSintetica, type ResumoDaFase } from './carga-login.ts'
import { urlDoBancoDoAmbiente } from './conferir-carga.ts'
import { conferirCenarioDaSala, descreverConferenciaDaSala, type ConferenciaDaSala, type EscolaDaFase, type JanelaDaFase } from './conferir-carga-sala.ts'

/**
 * Cenário de carga "reivindicação em sala" (A1, tarefa 9.0; Tech Spec da A1, seção 7c; cenarios.md, K1 e K2; PRD, RF19),
 * local e manual, no padrão do "login às 7h30" do F1:
 *
 *   npm run carga:sala                     sobe o compose de carga, roda as três fases e reprova se um critério falhar
 *   npm run carga:sala -- --fases k1       só as fases pedidas, para depurar (o resultado parcial não vale como registro)
 *
 * 1. sobe o projeto `educa-carga` (infra/compose.yml com infra/compose.carga.yml: duas APIs com 1 CPU cada e o argon2
 *    calibrado de infra/carga.env, o mesmo "adaptador de hash calibrado" do login);
 * 2. cria a outra escola, com 700 alunos que entram por matrícula, todos com a senha sintética gerada agora;
 * 3. a cada fase, monta pela API, como a coordenação e o professor fariam, uma escola nova: ano, série, disciplina, as
 *    turmas com a lista de 35 nomes gerados cada, o professor confirmado em seis turmas e o acesso de cada turma; e roda o
 *    k6 da fase, com a outra escola entrando ao mesmo tempo de outro container (o K1 e o K2);
 * 4. na fase `k2_redis_lento`, pausa os clientes do Redis de fila em ciclos enquanto o k6 roda: o Redis responde, devagar;
 * 5. confere no banco (zero duplicidade, todos aprovados) e no Prometheus (zero 5xx do lado da API, nenhum código errado
 *    acima do teto da escola no primeiro dia);
 * 6. derruba o projeto com os volumes, passe ou não.
 *
 * Nada de pessoa: nomes, matrículas e senha sintéticos, que só existem na pasta temporária da execução (regra 20, item 17).
 */

export const SCRIPT_DO_K6_DA_SALA = '/cenario/reivindicacao-em-sala.js'
export const OPERADOR_DA_CARGA_DA_SALA = 'carga-sala'
export const ALUNOS_POR_TURMA = 35
/** As turmas que cada professor tem: a do cenário é a de uma professora com seis turmas (`docs/visao-produto.md`). */
export const TURMAS_POR_PROFESSOR = 6
/** A outra escola, que só faz login: as contas que o k6 dela percorre. */
export const ALUNOS_DA_OUTRA_ESCOLA = 700

export const FASES_DO_CENARIO = ['k1', 'k2', 'k2_redis_lento'] as const
export type FaseDaSala = (typeof FASES_DO_CENARIO)[number]

export interface EscalaDaFase {
  /** Quantas turmas de 35 a escola da fase tem. */
  readonly turmas: number
  /** Em quantos segundos todos os alunos chegam. */
  readonly chegadaS: number
  /** Quanto os professores continuam decidindo depois da chegada do último aluno. */
  readonly esperaDosProfessoresS: number
  /** Se a outra escola entra ao mesmo tempo, do outro container. */
  readonly comOutraEscola: boolean
  /** O prefixo das matrículas da fase: cada fase é uma escola, e a matrícula não se repete dentro dela. */
  readonly prefixo: string
}

/**
 * K1: seis turmas de 35 em 5 min (RF19). K2: o primeiro dia da escola inteira, 2.100 em 5 min. O K2 com o Redis de fila
 * lento é menor (12 turmas em 2 min): ele mede o `decidir`, e não a rajada, que o K2 já mediu.
 */
export const ESCALA: Record<FaseDaSala, EscalaDaFase> = {
  k1: { turmas: 6, chegadaS: 300, esperaDosProfessoresS: 90, comOutraEscola: true, prefixo: 'K1' },
  k2: { turmas: 60, chegadaS: 300, esperaDosProfessoresS: 90, comOutraEscola: true, prefixo: 'K2' },
  k2_redis_lento: { turmas: 12, chegadaS: 120, esperaDosProfessoresS: 90, comOutraEscola: false, prefixo: 'KL' },
}

/** O Redis de fila "lento": os clientes dele pausados por 80 ms a cada 100 ms, perto do corte de 100 ms do cliente do login. */
export const PAUSA_DO_REDIS_MS = 80
export const CICLO_DO_REDIS_MS = 100

// ---------------------------------------------------------------------------------------------------------------------
// Os alunos do cenário
// ---------------------------------------------------------------------------------------------------------------------

export interface AlunoDoCenario {
  /** O índice da turma na lista de turmas da fase. */
  readonly turma: number
  readonly nome: string
  readonly matricula: string
  /** Um dos 20% que digita um código errado antes do certo. */
  readonly erraCodigo: boolean
  /** Um dos 10% que erra a matrícula antes da certa. */
  readonly erraMatricula: boolean
  /** Entra pelo código digitado (os que erram o código também); o resto, pelo link. */
  readonly peloCodigo: boolean
  /** Manda o pedido de dois computadores no mesmo segundo: a disputa pelo nome. */
  readonly disputa: boolean
}

/** As posições da turma que disputam o nome: dois alunos por turma. */
export const POSICOES_EM_DISPUTA = [7, 21] as const

/** O nome gerado de um aluno: a posição e a turma, sem nada de pessoa. */
export function nomeSintetico(turma: number, posicao: number): string {
  return `Aluno ${String(posicao + 1).padStart(2, '0')} da turma ${String(turma + 1).padStart(2, '0')}`
}

export function matriculaDaSala(prefixo: string, turma: number, posicao: number): string {
  return `${prefixo}T${String(turma + 1).padStart(2, '0')}A${String(posicao + 1).padStart(2, '0')}`
}

/**
 * Os alunos da fase na ordem de chegada: as turmas chegam juntas (a 1ª posição de cada turma, depois a 2ª...). Na ordem de
 * chegada, 2 em cada 10 erram o código, 1 em cada 10 erra a matrícula e 6 em cada 10 entram pelo código.
 */
export function montarAlunos(escala: Pick<EscalaDaFase, 'turmas' | 'prefixo'>): AlunoDoCenario[] {
  const alunos: AlunoDoCenario[] = []
  for (let posicao = 0; posicao < ALUNOS_POR_TURMA; posicao++) {
    for (let turma = 0; turma < escala.turmas; turma++) {
      const ordem = alunos.length % 10
      alunos.push({
        turma,
        nome: nomeSintetico(turma, posicao),
        matricula: matriculaDaSala(escala.prefixo, turma, posicao),
        erraCodigo: ordem < 2,
        erraMatricula: ordem === 2,
        peloCodigo: ordem < 6,
        disputa: (POSICOES_EM_DISPUTA as readonly number[]).includes(posicao),
      })
    }
  }
  return alunos
}

/** O texto da lista de uma turma, como a coordenação cola: `nome;matrícula`, uma linha por aluno. */
export function textoDaLista(alunos: readonly AlunoDoCenario[], turma: number): string {
  return alunos
    .filter((aluno) => aluno.turma === turma)
    .map((aluno) => `${aluno.nome};${aluno.matricula}`)
    .join('\n')
}

/** Os professores da fase: um a cada seis turmas, cada um com as turmas dele. */
export function turmasDosProfessores(turmas: number): number[][] {
  return Array.from({ length: Math.ceil(turmas / TURMAS_POR_PROFESSOR) }, (_, professor) =>
    Array.from({ length: Math.min(TURMAS_POR_PROFESSOR, turmas - professor * TURMAS_POR_PROFESSOR) }, (_, posicao) => professor * TURMAS_POR_PROFESSOR + posicao),
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// O k6 e o veredito
// ---------------------------------------------------------------------------------------------------------------------

/** O `k6 run` de uma fase, dentro do container. `outra` é o k6 da outra escola, no segundo container. */
export function argumentosDoK6DaSala(fase: FaseDaSala, outra = false): string[] {
  return [
    'run',
    '--quiet',
    '--no-usage-report',
    '--summary-export',
    `/execucao/resumo-${fase}${outra ? '-outra' : ''}.json`,
    '--env',
    `FASE=${outra ? 'outra_escola' : fase}`,
    '--env',
    'API_URL=http://borda:8080',
    '--env',
    `ARQUIVO_DAS_CONTAS=/execucao/contas-${fase}.json`,
    SCRIPT_DO_K6_DA_SALA,
  ]
}

/** O resumo da outra escola entra na fase, com o prefixo: o threshold dela reprova a fase como os outros. */
export function juntarOutraEscola(fase: ResumoDaFase, outra: ResumoDaFase): ResumoDaFase {
  return {
    codigo: fase.codigo !== 0 ? fase.codigo : outra.codigo,
    cruzados: [...fase.cruzados, ...outra.cruzados.map(({ metrica, criterio }) => ({ metrica: `outra_escola:${metrica}`, criterio }))],
    valores: { ...fase.valores, ...Object.fromEntries(Object.entries(outra.valores).map(([chave, valor]) => [`outra_escola:${chave}`, valor])) },
  }
}

export interface Reprovacao {
  readonly criterio: string
  readonly detalhe: string
}

export interface VereditoDaSala {
  readonly passou: boolean
  readonly reprovacoes: readonly Reprovacao[]
}

/**
 * Junta o k6 de cada fase e a conferência. Fase pedida que não rodou reprova; o código de saída do k6 e o resumo precisam
 * concordar (99 com threshold cruzado, 0 sem), e a outra escola precisa ter rodado nas fases que a têm.
 */
export function julgarCenarioDaSala(fases: readonly FaseDaSala[], resumos: ReadonlyMap<FaseDaSala, ResumoDaFase>, conferencia: ConferenciaDaSala | undefined): VereditoDaSala {
  const reprovacoes: Reprovacao[] = []
  for (const fase of fases) {
    const resumo = resumos.get(fase)
    if (resumo === undefined) {
      reprovacoes.push({ criterio: `${fase}:k6`, detalhe: `${fase}: a fase não rodou` })
      continue
    }
    for (const { metrica, criterio } of resumo.cruzados) reprovacoes.push({ criterio: `${fase}:${metrica}`, detalhe: `${fase}: ${metrica} ${criterio}` })
    const saidaEsperada = resumo.cruzados.length > 0 ? CODIGO_THRESHOLD_CRUZADO : 0
    if (resumo.codigo !== saidaEsperada) reprovacoes.push({ criterio: `${fase}:k6`, detalhe: `${fase}: k6 saiu com ${resumo.codigo}, e o resumo pedia ${saidaEsperada}` })
    if (ESCALA[fase].comOutraEscola && resumo.valores['outra_escola:login_duracao{grupo:outra_escola} p(95)'] === undefined) {
      reprovacoes.push({ criterio: `${fase}:outra_escola`, detalhe: `${fase}: o login da outra escola não foi medido` })
    }
  }
  if (conferencia === undefined) reprovacoes.push({ criterio: 'conferencia', detalhe: 'a conferência no banco e no Prometheus não rodou' })
  else for (const motivo of conferencia.reprovacoes) reprovacoes.push({ criterio: 'conferencia', detalhe: `conferência: ${motivo}` })
  return { passou: reprovacoes.length === 0, reprovacoes }
}

/** As fases pedidas (`--fases k1,k2`), na ordem do cenário; sem a opção, todas. */
export function fasesPedidas(argumentos: readonly string[]): readonly FaseDaSala[] {
  const indice = argumentos.indexOf('--fases')
  if (indice < 0) return FASES_DO_CENARIO
  const pedidas = (argumentos[indice + 1] ?? '').split(',').filter((fase) => fase !== '')
  const desconhecida = pedidas.find((fase) => !FASES_DO_CENARIO.some((aceita) => aceita === fase))
  if (pedidas.length === 0 || desconhecida !== undefined) throw new Error(`--fases aceita só: ${FASES_DO_CENARIO.join(', ')}`)
  return FASES_DO_CENARIO.filter((fase) => pedidas.includes(fase))
}

/** As linhas do registro de uma fase: p95 do login, do `decidir` e da sala, o maior lote, e as contagens. */
export function descreverFase(fase: FaseDaSala, resumo: ResumoDaFase): string[] {
  const linhas = Object.entries(resumo.valores)
    .filter(([chave]) =>
      /^(outra_escola:)?((login_duracao\{grupo:[a-z_]+\}|decidir_duracao|sala_duracao|autenticada_duracao\{grupo:[a-z_]+\}) (p\(95\)|max)|decidir_lote max|(respostas_5xx|respostas_503|respostas_inesperadas|pedidos_enviados|disputa_sem_um_vencedor|aprovados|aprovado_entrou|login_erro_final|contas_que_entraram)(\{grupo:[a-z_]+\})? count|dropped_iterations count)$/.test(chave),
    )
    .map(([chave, valor]) => `  ${fase}: ${chave} = ${Math.round(valor)}`)
  return [`\n${fase}:`, ...linhas]
}

// ---------------------------------------------------------------------------------------------------------------------
// A montagem da escola, pela API
// ---------------------------------------------------------------------------------------------------------------------

interface ModulosDaApi {
  nucleo: { createDatabase: typeof createDatabase; createPool: typeof createPool }
  escolas: { criarRede: typeof criarRede; criarEscola: typeof criarEscola }
  sessoes: { criarAlunosComMatricula: typeof criarAlunosComMatricula; criarSessoesSinteticas: typeof criarSessoesSinteticas }
  hash: { HashDeSenha: typeof HashDeSenha }
}

/** Os módulos já compilados da API (o `npm run carga:sala` compila antes), como o `carga:login`. */
async function importarDaApi(): Promise<ModulosDaApi> {
  const importar = <T>(caminho: string) => import(pathToFileURL(join(raizRepositorio, caminho)).href) as Promise<T>
  return {
    nucleo: await importar('packages/core/dist/index.js'),
    escolas: await importar('apps/api/dist/operacao/escola/escola.js'),
    sessoes: await importar('apps/api/dist/sessao/tenant/synthetic-sessions.js'),
    hash: await importar('apps/api/dist/credencial/password-hasher.js'),
  }
}

/** Uma chamada à API pela borda, com o token; no 429, espera o `Retry-After` e repete. Devolve o corpo, ou falha. */
async function chamarApi(url: string, token: string, metodo: 'POST' | 'GET', caminho: string, corpo?: unknown): Promise<Record<string, unknown>> {
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const resposta = await fetch(`${url}${caminho}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    })
    if (resposta.status === 429) {
      await esperar(Number(resposta.headers.get('retry-after') ?? '2') * 1_000)
      continue
    }
    const texto = await resposta.text()
    // Só o status e o código do erro: o corpo pode trazer o token do acesso.
    if (!resposta.ok) throw new Error(`${metodo} ${caminho.replace(/[0-9a-f-]{36}/g, ':id')} respondeu ${resposta.status}`)
    return texto === '' ? {} : (JSON.parse(texto) as Record<string, unknown>)
  }
  throw new Error(`${metodo} ${caminho.replace(/[0-9a-f-]{36}/g, ':id')}: 429 depois de 10 tentativas`)
}

export interface TurmaMontada {
  readonly id: string
  readonly token: string
  readonly codigo: string
  /** A matrícula de cada nome da lista: é o que o professor usa para o aluno aprovado entrar. */
  readonly matriculas: Record<string, string>
}

export interface EscolaMontada {
  readonly escolaId: string
  readonly slug: string
  readonly turmas: readonly TurmaMontada[]
  readonly professores: ReadonlyArray<{ token: string; turmas: number[] }>
}

/** Quantas sessões de coordenação montam a escola: cada uma fica abaixo do limite por usuário (120 por minuto). */
const COORDENACOES_DA_MONTAGEM = 4

/**
 * Monta a escola da fase pela API, como a coordenação e o professor fariam na tela: ano letivo aberto, série, disciplina,
 * as turmas com a lista, o vínculo de cada professor confirmado por ele, e o acesso de cada turma gerado pelo professor.
 */
async function montarEscola(modulos: ModulosDaApi, banco: ReturnType<typeof createDatabase>, doArquivo: Record<string, string>, redeId: string, fase: FaseDaSala, alunos: readonly AlunoDoCenario[]): Promise<EscolaMontada> {
  const autor = async () => OPERADOR_DA_CARGA_DA_SALA
  const slug = `sala-${fase.replace(/_/g, '-')}-${randomUUID()}`
  const { id: escolaId } = await modulos.escolas.criarEscola(banco, autor, { id: randomUUID(), redeId, nome: `Escola sintética da sala ${fase}`, slug })
  const url = `http://127.0.0.1:${doArquivo['BORDA_PORTA_HOST'] ?? ''}`
  const coordenacoes = await modulos.sessoes.criarSessoesSinteticas(banco, doArquivo, { escolaId, papel: 'coordenador', quantidade: COORDENACOES_DA_MONTAGEM })
  const turmasDeCada = turmasDosProfessores(ESCALA[fase].turmas)
  const professores = await modulos.sessoes.criarSessoesSinteticas(banco, doArquivo, { escolaId, papel: 'professor', quantidade: turmasDeCada.length })
  let vez = 0
  const coordenacao = (metodo: 'POST' | 'GET', caminho: string, corpo?: unknown) => chamarApi(url, coordenacoes[vez++ % coordenacoes.length]?.token ?? '', metodo, caminho, corpo)

  const ano = await coordenacao('POST', '/v1/anos-letivos', { ano: 2026, inicio: '2026-02-01', fim: '2026-12-15' })
  await coordenacao('POST', `/v1/anos-letivos/${String(ano['id'])}/abrir`)
  const serie = await coordenacao('POST', '/v1/series', { etapa: 'em', ano: 1 })
  const disciplina = await coordenacao('POST', '/v1/disciplinas', { nome: 'Química' })
  const turmas: TurmaMontada[] = []
  for (const [indiceDoProfessor, indices] of turmasDeCada.entries()) {
    const professor = professores[indiceDoProfessor]
    if (professor === undefined) throw new Error('professor da carga não criado')
    for (const indice of indices) {
      const turma = await coordenacao('POST', '/v1/turmas', { serieId: serie['id'], nome: `Turma ${String(indice + 1).padStart(2, '0')}` })
      const turmaId = String(turma['id'])
      await coordenacao('POST', `/v1/turmas/${turmaId}/lista`, { texto: textoDaLista(alunos, indice) })
      const vinculo = await coordenacao('POST', '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId, disciplinaId: disciplina['id'], papel: 'professor' })
      await chamarApi(url, professor.token, 'POST', `/v1/vinculos/${String(vinculo['id'])}/confirmar`)
      const acesso = await chamarApi(url, professor.token, 'POST', `/v1/turmas/${turmaId}/acesso`, { validadeDias: 7 })
      const matriculas = Object.fromEntries(alunos.filter((aluno) => aluno.turma === indice).map((aluno) => [aluno.nome, aluno.matricula]))
      turmas[indice] = { id: turmaId, token: String(acesso['token']), codigo: String(acesso['codigo']), matriculas }
    }
  }
  return { escolaId, slug, turmas, professores: professores.map((professor, indice) => ({ token: professor.token, turmas: turmasDeCada[indice] ?? [] })) }
}

// ---------------------------------------------------------------------------------------------------------------------
// A execução
// ---------------------------------------------------------------------------------------------------------------------

function escrever(linha: string): void {
  process.stdout.write(`${linha}\n`)
}

/**
 * O Redis de fila lento: pausa os clientes dele por `PAUSA_DO_REDIS_MS` a cada `CICLO_DO_REDIS_MS`, até `parar`. Cada
 * comando que chega espera até 80 ms, perto do corte de 100 ms do cliente do login (`LOGIN_REDIS_PRAZO_MS` da carga).
 */
function deixarRedisLento(porta: string): { parar: () => Promise<number> } {
  const cliente = new Redis({ host: '127.0.0.1', port: Number(porta), lazyConnect: false, maxRetriesPerRequest: 1 })
  let ativo = true
  let pausas = 0
  const laco = (async () => {
    while (ativo) {
      try {
        await cliente.call('CLIENT', 'PAUSE', String(PAUSA_DO_REDIS_MS), 'ALL')
        pausas++
      } catch {
        // O ciclo seguinte tenta de novo: a pausa perdida só deixa o Redis mais rápido naquele ciclo.
      }
      await esperar(CICLO_DO_REDIS_MS)
    }
  })()
  return {
    parar: async () => {
      ativo = false
      await laco
      cliente.disconnect()
      return pausas
    },
  }
}

async function executar(fases: readonly FaseDaSala[]): Promise<number> {
  const pasta = mkdtempSync(join(tmpdir(), 'educa-carga-sala-'))
  // O k6 do container roda com outro usuário: ele lê as contas e grava o resumo nesta pasta. A pasta aberta e o arquivo
  // legível por todos só servem porque tudo aqui é sintético e sai no fim da execução: não copie o padrão para dado real.
  chmodSync(pasta, 0o777)
  const doArquivo = lerAmbienteDeCarga()
  const ambiente: NodeJS.ProcessEnv = {
    ...Object.fromEntries(Object.entries(process.env).filter(([chave]) => !(chave in doArquivo))),
    CARGA_PASTA_DA_EXECUCAO: pasta,
    LOGIN_PROTECAO_DESLIGADA: 'false',
  }
  const compose = (...argumentos: string[]) => rodar('docker', [...argumentosDoCompose(), ...argumentos], ambiente)
  const inicio = new Date()
  let veredito: VereditoDaSala | undefined
  try {
    escrever(`\n▶ cenário "reivindicação em sala": ${fases.join(', ')}`)
    await compose('down', '--volumes', '--remove-orphans')
    const subida = await compose('up', '--detach', '--build', '--wait')
    if (subida.codigo !== 0) throw new Error('o compose de carga não subiu')

    const modulos = await importarDaApi()
    const pool = modulos.nucleo.createPool({ url: urlDoBancoDoAmbiente(doArquivo), maximoConexoes: 2, timeoutConexaoMs: 5_000, timeoutConsultaMs: 120_000 }, () => undefined)
    const banco = modulos.nucleo.createDatabase(pool)
    const resumos = new Map<FaseDaSala, ResumoDaFase>()
    const janelas: JanelaDaFase[] = []
    const escolas: EscolaDaFase[] = []
    try {
      escrever('\n▶ a outra escola e a senha sintética')
      const senha = randomBytes(18).toString('base64url')
      const senhaHash = await (await modulos.hash.HashDeSenha.criar({ memoriaKib: Number(doArquivo['LOGIN_ARGON2_MEMORIA_KIB']), iteracoes: Number(doArquivo['LOGIN_ARGON2_ITERACOES']) })).gerar(senha)
      const autor = async () => OPERADOR_DA_CARGA_DA_SALA
      const { id: redeId } = await modulos.escolas.criarRede(banco, autor, { id: randomUUID(), nome: 'Rede sintética da sala', tipo: 'independente' })
      const slugOutra = `sala-outra-${randomUUID()}`
      const { id: outraId } = await modulos.escolas.criarEscola(banco, autor, { id: randomUUID(), redeId, nome: 'Escola sintética vizinha', slug: slugOutra })
      const outraEscola = Array.from({ length: ALUNOS_DA_OUTRA_ESCOLA }, (_, posicao) => matriculaSintetica(posicao))
      await modulos.sessoes.criarAlunosComMatricula(banco, doArquivo, outraId, outraEscola.map((matricula) => ({ matricula, senhaHash })))

      for (const fase of fases) {
        const escala = ESCALA[fase]
        const alunos = montarAlunos(escala)
        escrever(`\n▶ ${fase}: a escola montada pela API (${String(escala.turmas)} turmas, ${String(alunos.length)} alunos)`)
        const escola = await montarEscola(modulos, banco, doArquivo, redeId, fase, alunos)
        escolas.push({ fase, slug: escola.slug, esperados: alunos.length, primeiroDia: fase === 'k2' })
        const arquivo = join(pasta, `contas-${fase}.json`)
        writeFileSync(
          arquivo,
          JSON.stringify({
            senha,
            slug: escola.slug,
            chegadaS: escala.chegadaS,
            esperaDosProfessoresS: escala.esperaDosProfessoresS,
            slugOutra,
            alunos,
            turmas: escola.turmas,
            professores: escola.professores,
            outraEscola,
          }),
        )
        chmodSync(arquivo, 0o644)

        escrever(`\n▶ k6, fase ${fase}`)
        const comeco = new Date()
        const lento = fase === 'k2_redis_lento' ? deixarRedisLento(doArquivo['REDIS_FILA_PORTA_HOST'] ?? '') : undefined
        const k6 = async (outra: boolean): Promise<ResumoDaFase> => {
          const { codigo } = await compose('run', '--rm', '--no-deps', outra ? 'k6-atacante' : 'k6', ...argumentosDoK6DaSala(fase, outra))
          let resumo: unknown
          try {
            resumo = JSON.parse(readFileSync(join(pasta, `resumo-${fase}${outra ? '-outra' : ''}.json`), 'utf8'))
          } catch {
            resumo = undefined
          }
          return lerResumoDaFase(codigo, resumo)
        }
        const [daFase, daOutra] = await Promise.all([k6(false), escala.comOutraEscola ? k6(true) : Promise.resolve(undefined)])
        if (lento !== undefined) escrever(`  Redis de fila pausado ${String(await lento.parar())} vezes`)
        resumos.set(fase, daOutra === undefined ? daFase : juntarOutraEscola(daFase, daOutra))
        janelas.push({ fase, inicio: comeco, fim: new Date() })
      }
    } finally {
      await pool.end()
    }

    escrever('\n▶ conferência no banco e no Prometheus')
    // As métricas saem a cada TELEMETRIA_INTERVALO_MS: espera a última exportação de cada instância chegar.
    await esperar(3 * Number(doArquivo['TELEMETRIA_INTERVALO_MS'] ?? '5000'))
    const cliente = new pg.Client({ connectionString: urlDoBancoDoAmbiente(doArquivo) })
    await cliente.connect()
    let conferencia: ConferenciaDaSala
    try {
      conferencia = await conferirCenarioDaSala({ banco: cliente, prometheus: `http://127.0.0.1:${doArquivo['PROMETHEUS_PORTA_HOST'] ?? ''}`, janelas, escolas })
    } finally {
      await cliente.end()
    }
    for (const linha of descreverConferenciaDaSala(conferencia)) escrever(linha)
    for (const [fase, resumo] of resumos) for (const linha of descreverFase(fase, resumo)) escrever(linha)
    veredito = julgarCenarioDaSala(fases, resumos, conferencia)
  } catch (erro) {
    escrever(`\n✖ o cenário não terminou: ${erro instanceof Error ? erro.message : String(erro)}`)
    await compose('logs', '--no-color', '--tail', '100', 'api-1', 'api-2')
  } finally {
    await compose('down', '--volumes', '--remove-orphans')
    rmSync(pasta, { recursive: true, force: true })
  }

  const duracao = Math.round((Date.now() - inicio.getTime()) / 60_000)
  if (veredito === undefined) return 1
  escrever(`\n■ resultado em ${inicio.toISOString()} (${duracao} min): ${veredito.passou ? 'passou' : 'reprovou'}`)
  for (const reprovacao of veredito.reprovacoes) escrever(`  reprovado: ${reprovacao.detalhe}`)
  escrever(veredito.passou ? '✔ cenário passou' : '✖ cenário reprovou')
  return veredito.passou ? 0 : 1
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executar(fasesPedidas(process.argv.slice(2)))
}
