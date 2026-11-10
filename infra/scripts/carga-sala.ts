import { randomBytes, randomUUID } from 'node:crypto'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { Redis } from 'ioredis'
import pg from 'pg'
import type { criarEscola, criarRede } from '../../apps/api/src/operacao/escola/escola.ts'
import type { PasswordHasher } from '../../apps/api/src/credencial/password-hasher.ts'
import type { criarAlunosComMatricula, createSyntheticSessions } from '../../apps/api/src/sessao/tenant/synthetic-sessions.ts'
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

export const FASES_DO_CENARIO = ['k1', 'k2', 'k2_conta', 'k2_redis_lento'] as const
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
  /** Quem prova a conta da escola: 1 em 20 na escola sem Workspace, ou quase todos na escola da D48 (a conta da escola, quando ela existe). */
  readonly pelaConta: 'um_em_vinte' | 'quase_todos'
  /** Se é o primeiro dia da escola: a conferência cobra que nenhum pedido seja segurado pelo teto de códigos errados dela (`conferir-carga-sala.ts`). */
  readonly primeiroDia: boolean
}

/**
 * K1: seis turmas de 35 em 5 min (RF19). K2: o primeiro dia da escola inteira, 2.100 em 5 min. O `k2_conta` é o K2 da escola que
 * liberou a conta Google ou Microsoft (D48, acesso-e-convites, 16.0): quase todos pedem o nome pela conta, e o aprovado entra pela conta,
 * o que põe `iniciar`, `retorno` e `renovar` no balde anônimo do IP da escola. O K2 com o Redis de fila lento é menor (12 turmas em
 * 2 min): ele mede o `decidir`, e não a rajada, que o K2 já mediu.
 */
export const ESCALA: Record<FaseDaSala, EscalaDaFase> = {
  k1: { turmas: 6, chegadaS: 300, esperaDosProfessoresS: 90, comOutraEscola: true, prefixo: 'K1', pelaConta: 'um_em_vinte', primeiroDia: false },
  k2: { turmas: 60, chegadaS: 300, esperaDosProfessoresS: 90, comOutraEscola: true, prefixo: 'K2', pelaConta: 'um_em_vinte', primeiroDia: true },
  k2_conta: { turmas: 60, chegadaS: 300, esperaDosProfessoresS: 90, comOutraEscola: true, prefixo: 'KC', pelaConta: 'quase_todos', primeiroDia: true },
  k2_redis_lento: { turmas: 12, chegadaS: 120, esperaDosProfessoresS: 90, comOutraEscola: false, prefixo: 'KL', pelaConta: 'um_em_vinte', primeiroDia: false },
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
  /** Prova a conta da escola no `oidc-falso` e manda o pedido sem senha (acesso-e-convites, 16.0), fora a disputa. Não tem senha: depois de aprovado, entra pela conta, e não por matrícula. */
  readonly viaConta: boolean
}

/** De quantos em quantos alunos, um prova a conta da escola em vez de criar senha, na escola sem Workspace. */
export const UM_EM_CADA_VIA_CONTA = 20

/**
 * Quem pede o nome pela conta da escola. Na escola sem Workspace, 1 em cada 20 (fora a disputa). Na escola da D48, todos, menos quem disputa
 * o nome (a disputa mede a corrida do nome, e não o balde) e quem erra a matrícula (o erro é de quem digita a matrícula).
 */
export function pedePelaConta(modo: EscalaDaFase['pelaConta'], chegada: number, ordem: number, disputa: boolean): boolean {
  if (disputa) return false
  return modo === 'quase_todos' ? ordem !== 2 : chegada % UM_EM_CADA_VIA_CONTA === 9
}

/** O domínio da escola de cada fase no provedor falso (`infra/oidc-falso/config.json`, o `hd` do mapeamento `google-aluna-carga-.*`). */
export const DOMINIO_DA_CONTA_NA_CARGA = 'escola-a.educa-sintetica.test'

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
 * chegada, 2 em cada 10 erram o código, 1 em cada 10 erra a matrícula e 6 em cada 10 entram pelo código; quem prova a conta da escola
 * é o que `pedePelaConta` diz.
 */
export function montarAlunos(escala: Pick<EscalaDaFase, 'turmas' | 'prefixo' | 'pelaConta'>): AlunoDoCenario[] {
  const alunos: AlunoDoCenario[] = []
  for (let posicao = 0; posicao < ALUNOS_POR_TURMA; posicao++) {
    for (let turma = 0; turma < escala.turmas; turma++) {
      const ordem = alunos.length % 10
      const disputa = (POSICOES_EM_DISPUTA as readonly number[]).includes(posicao)
      alunos.push({
        turma,
        nome: nomeSintetico(turma, posicao),
        matricula: matriculaDaSala(escala.prefixo, turma, posicao),
        erraCodigo: ordem < 2,
        erraMatricula: ordem === 2,
        peloCodigo: ordem < 6,
        disputa,
        viaConta: pedePelaConta(escala.pelaConta, alunos.length, ordem, disputa),
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

/** O pico do balde anônimo por IP (`rl:ip:<ip>`) que a fase atingiu, e o teto que a API da carga recebeu. */
export interface PicoDoBalde {
  readonly pico: number
  readonly teto: number
}

/** Até quanto do `LIMITE_REQ_IP_ANONIMO_MIN` o pico do balde pode chegar: acima disso, a escola do primeiro dia fica a um minuto mais cheio de levar `LIMITE_EXCEDIDO`. */
export const FRACAO_DO_TETO_DO_BALDE = 0.8

/**
 * As chaves do balde anônimo por IP: `rl:ip:<ip>`, e não o da entrada da operação (`rl:ip:op:`), o do "esqueci a senha" (`rl:ip:senha:`) nem o do
 * login (`rl:ip-login:`), que não se somam ao anônimo.
 */
export function chavesDoBaldeAnonimo(chaves: readonly string[]): string[] {
  return chaves.filter((chave) => chave.startsWith('rl:ip:') && !chave.startsWith('rl:ip:op:') && !chave.startsWith('rl:ip:senha:'))
}

/**
 * O pico das leituras do balde: o maior valor visto, ou `undefined` quando nenhuma leitura achou a chave. Sem leitura o pico não foi medido,
 * e "não medido" não é 0%: o veredito reprova na fase da escola com Workspace.
 */
export function reduzirLeiturasDoBalde(leituras: readonly number[]): number | undefined {
  return leituras.length === 0 ? undefined : leituras.reduce((maior, leitura) => Math.max(maior, leitura))
}

/** Reprova o pico acima de 80% do teto. */
export function julgarPicoDoBalde(fase: string, { pico, teto }: PicoDoBalde): string | undefined {
  if (pico <= teto * FRACAO_DO_TETO_DO_BALDE) return undefined
  return `${fase}: o balde anônimo por IP chegou a ${String(pico)} de ${String(teto)} por minuto (acima de ${String(FRACAO_DO_TETO_DO_BALDE * 100)}% do teto)`
}

export interface Reprovacao {
  readonly criterio: string
  readonly detalhe: string
}

export interface VereditoDaSala {
  readonly passou: boolean
  readonly reprovacoes: readonly Reprovacao[]
}

function julgarFase(fase: FaseDaSala, resumo: ResumoDaFase, doBalde: PicoDoBalde | undefined): Reprovacao[] {
  const reprovacoes: Reprovacao[] = resumo.cruzados.map(({ metrica, criterio }) => ({ criterio: `${fase}:${metrica}`, detalhe: `${fase}: ${metrica} ${criterio}` }))
  const saidaEsperada = resumo.cruzados.length > 0 ? CODIGO_THRESHOLD_CRUZADO : 0
  if (resumo.codigo !== saidaEsperada) reprovacoes.push({ criterio: `${fase}:k6`, detalhe: `${fase}: k6 saiu com ${resumo.codigo}, e o resumo pedia ${saidaEsperada}` })
  if (ESCALA[fase].comOutraEscola && resumo.valores['outra_escola:login_duracao{grupo:outra_escola} p(95)'] === undefined) {
    reprovacoes.push({ criterio: `${fase}:outra_escola`, detalhe: `${fase}: o login da outra escola não foi medido` })
  }
  // Pico 0 também é "não medido" na fase que passa quase todo mundo pelo balde: o k6 mandou milhares de pedidos, e um balde vazio é leitura que falhou.
  const medido = doBalde !== undefined && doBalde.pico > 0
  if (!medido && ESCALA[fase].pelaConta === 'quase_todos') reprovacoes.push({ criterio: `${fase}:balde`, detalhe: `${fase}: o pico do balde anônimo por IP não foi medido` })
  if (doBalde === undefined) return reprovacoes
  const acima = julgarPicoDoBalde(fase, doBalde)
  if (acima !== undefined) reprovacoes.push({ criterio: `${fase}:balde`, detalhe: acima })
  return reprovacoes
}

/**
 * Junta o k6 de cada fase e a conferência. Fase pedida que não rodou reprova; o código de saída do k6 e o resumo precisam
 * concordar (99 com threshold cruzado, 0 sem), e a outra escola precisa ter rodado nas fases que a têm. O pico do balde anônimo por IP,
 * medido no Redis, reprova acima de 80% do teto; na fase da escola com Workspace (`k2_conta`), pico não medido (sem leitura, ou 0) também reprova.
 */
export function julgarCenarioDaSala(
  fases: readonly FaseDaSala[],
  resumos: ReadonlyMap<FaseDaSala, ResumoDaFase>,
  conferencia: ConferenciaDaSala | undefined,
  picos: ReadonlyMap<FaseDaSala, PicoDoBalde> = new Map(),
): VereditoDaSala {
  const reprovacoes: Reprovacao[] = []
  for (const fase of fases) {
    const resumo = resumos.get(fase)
    if (resumo === undefined) reprovacoes.push({ criterio: `${fase}:k6`, detalhe: `${fase}: a fase não rodou` })
    else reprovacoes.push(...julgarFase(fase, resumo, picos.get(fase)))
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
      /^(outra_escola:)?((login_duracao\{grupo:[a-z_]+\}|decidir_duracao|sala_duracao|autenticada_duracao\{grupo:[a-z_]+\}) (p\(95\)|max)|decidir_lote max|(respostas_5xx|respostas_503|respostas_429|respostas_inesperadas|pedidos_enviados|disputa_sem_um_vencedor|aprovados|aprovado_entrou|aprovado_entrou_pela_conta|login_erro_final|contas_que_entraram|contas_provadas)(\{grupo:[a-z_]+\})? count|dropped_iterations count)$/.test(chave),
    )
    .map(([chave, valor]) => `  ${fase}: ${chave} = ${Math.round(valor)}`)
  return [`\n${fase}:`, ...linhas]
}

// ---------------------------------------------------------------------------------------------------------------------
// A montagem da escola, pela API
// ---------------------------------------------------------------------------------------------------------------------

export interface ModulosDaApi {
  nucleo: { createDatabase: typeof createDatabase; createPool: typeof createPool }
  escolas: { criarRede: typeof criarRede; criarEscola: typeof criarEscola }
  sessoes: { criarAlunosComMatricula: typeof criarAlunosComMatricula; createSyntheticSessions: typeof createSyntheticSessions }
  hash: { PasswordHasher: typeof PasswordHasher }
}

/** Os módulos já compilados da API (o `npm run carga:sala` compila antes), como o `carga:login`. */
export async function importarDaApi(): Promise<ModulosDaApi> {
  const importar = <T>(caminho: string) => import(pathToFileURL(join(raizRepositorio, caminho)).href) as Promise<T>
  return {
    nucleo: await importar('packages/core/dist/index.js'),
    escolas: await importar('apps/api/dist/operacao/escola/escola.js'),
    sessoes: await importar('apps/api/dist/sessao/tenant/synthetic-sessions.js'),
    hash: await importar('apps/api/dist/credencial/password-hasher.js'),
  }
}

/** Uma chamada à API pela borda, com o token; no 429, espera o `Retry-After` e repete. Devolve o corpo, ou falha. */
export async function callApi(url: string, token: string, metodo: 'POST' | 'GET', caminho: string, corpo?: unknown): Promise<Record<string, unknown>> {
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

/** Quanto a montagem espera uma importação de lista terminar: o job normal de 40 nomes leva segundos, e 60 s é só o prazo da espera: passado ele, a montagem falha. */
const ESPERA_MAXIMA_DA_LISTA_MS = 60_000

/**
 * Grava a lista da turma (A1, F2 8.0: a gravação responde 202 e o job `estrutura.gravar-planilha` grava) e espera a importação
 * terminar, porque o vínculo e o acesso da turma, que vêm logo depois, e a reivindicação da carga precisam do nome na lista. A
 * escola só tem uma importação na fila por vez, então a montagem grava uma turma e espera.
 */
async function gravarListaEEsperar(coordenacao: (metodo: 'POST' | 'GET', caminho: string, corpo?: unknown) => Promise<Record<string, unknown>>, turmaId: string, texto: string): Promise<void> {
  const { id } = await coordenacao('POST', `/v1/turmas/${turmaId}/lista`, { texto })
  const limite = Date.now() + ESPERA_MAXIMA_DA_LISTA_MS
  while (Date.now() < limite) {
    const { estado } = await coordenacao('GET', `/v1/importacoes/${String(id)}`)
    if (estado === 'concluida') return
    if (estado !== 'na_fila') throw new Error(`a lista de uma turma terminou ${String(estado)}`)
    await esperar(250)
  }
  throw new Error('a lista de uma turma não terminou no prazo')
}

export interface TurmaMontada {
  readonly id: string
  readonly token: string
  readonly codigo: string
  /** A matrícula de cada nome da lista: é o que o professor usa para o aluno aprovado entrar. */
  readonly matriculas: Record<string, string>
  /**
   * Os nomes que pedem pela conta da escola, cada um com o número do aluno na fase: é o sujeito dele no provedor falso
   * (`google-aluna-carga-<fase>-<número>`), o mesmo da prova e da entrada depois de aprovado. Não têm senha, e por isso não entram por matrícula.
   */
  readonly viaConta: Readonly<Record<string, number>>
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
  const coordenacoes = await modulos.sessoes.createSyntheticSessions(banco, doArquivo, { escolaId, papel: 'coordenador', quantidade: COORDENACOES_DA_MONTAGEM })
  const turmasDeCada = turmasDosProfessores(ESCALA[fase].turmas)
  const professores = await modulos.sessoes.createSyntheticSessions(banco, doArquivo, { escolaId, papel: 'professor', quantidade: turmasDeCada.length })
  let vez = 0
  const coordenacao = (metodo: 'POST' | 'GET', caminho: string, corpo?: unknown) => callApi(url, coordenacoes[vez++ % coordenacoes.length]?.token ?? '', metodo, caminho, corpo)

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
      await gravarListaEEsperar(coordenacao, turmaId, textoDaLista(alunos, indice))
      const vinculo = await coordenacao('POST', '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId, disciplinaId: disciplina['id'], papel: 'professor' })
      await callApi(url, professor.token, 'POST', `/v1/vinculos/${String(vinculo['id'])}/confirmar`)
      const acesso = await callApi(url, professor.token, 'POST', `/v1/turmas/${turmaId}/acesso`, { validadeDias: 7 })
      const matriculas = Object.fromEntries(alunos.filter((aluno) => aluno.turma === indice).map((aluno) => [aluno.nome, aluno.matricula]))
      const viaConta = Object.fromEntries(alunos.flatMap((aluno, numero) => (aluno.turma === indice && aluno.viaConta ? [[aluno.nome, numero] as const] : [])))
      turmas[indice] = { id: turmaId, token: String(acesso['token']), codigo: String(acesso['codigo']), matriculas, viaConta }
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

/** Os valores do balde anônimo achados numa leitura: o `SCAN` percorre o cursor até voltar a `'0'`, porque o `MATCH` filtra depois de recolher cada página e o Redis de cache tem milhares de outras chaves. */
async function valoresDoBaldeAnonimo(cliente: Redis): Promise<number[]> {
  const valores: number[] = []
  let cursor = '0'
  do {
    const [proximo, chaves] = await cliente.scan(cursor, 'MATCH', 'rl:ip:*', 'COUNT', 1_000)
    cursor = proximo
    for (const chave of chavesDoBaldeAnonimo(chaves)) {
      // `null`: a janela de 60 s expirou entre o `SCAN` e o `GET`, e a chave não conta como lida.
      const valor = await cliente.get(chave)
      if (valor !== null && Number.isFinite(Number(valor))) valores.push(Number(valor))
    }
  } while (cursor !== '0')
  return valores
}

/**
 * O pico do balde anônimo por IP, lido do Redis de cache (o do rate limit) a cada segundo enquanto o k6 roda: a chave `rl:ip:<ip>` é o consumo da
 * janela fixa de 60 s daquele IP, o número que dá `LIMITE_EXCEDIDO` quando passa do teto. O maior valor visto é o pico, e `undefined` quando nenhuma
 * leitura achou a chave (Redis fora do ar, porta errada): o veredito trata isso como "não medido", e não como 0%. Só o valor sai daqui: a chave, que
 * leva o IP, nunca é impressa nem guardada (regra 20). É só a rota anônima sem rebaixamento; o login por matrícula (`rl:ip-login`), a entrada da
 * operação (`rl:ip:op`) e o "esqueci a senha" (`rl:ip:senha`) ficam de fora.
 */
function medirOBaldeAnonimo(porta: string): { parar: () => Promise<number | undefined> } {
  const cliente = new Redis({ host: '127.0.0.1', port: Number(porta), lazyConnect: false, maxRetriesPerRequest: 1 })
  cliente.on('error', () => undefined)
  let ativo = true
  const leituras: number[] = []
  const laco = (async () => {
    while (ativo) {
      try {
        leituras.push(...(await valoresDoBaldeAnonimo(cliente)))
      } catch {
        // A leitura seguinte tenta de novo; sem nenhuma leitura no fim, `parar()` devolve `undefined`, e o veredito reprova na fase da conta.
      }
      await esperar(1_000)
    }
  })()
  return {
    parar: async () => {
      ativo = false
      await laco
      cliente.disconnect()
      return reduzirLeiturasDoBalde(leituras)
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
    const picos = new Map<FaseDaSala, PicoDoBalde>()
    const janelas: JanelaDaFase[] = []
    const escolas: EscolaDaFase[] = []
    try {
      escrever('\n▶ a outra escola e a senha sintética')
      const senha = randomBytes(18).toString('base64url')
      const senhaHash = await (await modulos.hash.PasswordHasher.criar({ memoriaKib: Number(doArquivo['LOGIN_ARGON2_MEMORIA_KIB']), iteracoes: Number(doArquivo['LOGIN_ARGON2_ITERACOES']) })).gerar(senha)
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
        // A escola libera o Google para o domínio do `oidc-falso`: é o que a coordenação faz uma vez, e o que põe o botão da conta na sala.
        await pool.query('insert into provedor_escola (escola_id, provedor, valor) values ($1, $2, $3)', [escola.escolaId, 'google', DOMINIO_DA_CONTA_NA_CARGA])
        escolas.push({ fase, slug: escola.slug, esperados: alunos.length, viaConta: alunos.filter((aluno) => aluno.viaConta).length, primeiroDia: escala.primeiroDia })
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
        const baldeAnonimo = medirOBaldeAnonimo(doArquivo['REDIS_CACHE_PORTA_HOST'] ?? '')
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
        const teto = Number(doArquivo['LIMITE_REQ_IP_ANONIMO_MIN'])
        const pico = await baldeAnonimo.parar()
        if (pico === undefined) escrever(`  ${fase}: o balde anônimo por IP não foi lido nenhuma vez`)
        else {
          picos.set(fase, { pico, teto })
          escrever(`  ${fase}: o balde anônimo por IP chegou a ${String(pico)} por minuto, de ${String(teto)} (${String(Math.round((pico / teto) * 100))}%)`)
        }
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
    veredito = julgarCenarioDaSala(fases, resumos, conferencia, picos)
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
