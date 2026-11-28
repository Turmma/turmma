import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import pg from 'pg'
import { argumentosDoCompose, criarEscolasDaSala, IDADE_MAXIMA_DO_TOKEN_NO_INICIO_DO_K6_S, lerAmbienteDeCarga, rodar, semearEscolaDaSala, sessoesSinteticas } from './carga.ts'
import {
  ALUNOS_POR_TURMA_DA_PROVA,
  codigoDeSaidaDaProva,
  type ControleNegativoDaProva,
  descreverProva,
  ESCOLAS_DA_PROVA,
  ITENS_DA_PROVA,
  julgarProva,
  lerResumoDaProva,
  QUEDA_DURACAO_S,
  QUEDA_INICIO_S,
  TURMAS_POR_ESCOLA_DA_PROVA,
  UM_ALUNO_EM_CADA_SEM_REDE,
  type CanarioDaQueda,
  type MedidaDaProva,
} from './conferir-carga-prova.ts'
import { urlDoBancoDoAmbiente } from './conferir-carga.ts'

/**
 * Cenário de carga "a prova da manhã" (avaliacao-e-correcao, tarefa 6.0; Tech Spec, seção 7c; `cenarios.md`, seção 5), local e manual, no padrão da "300 apostilas numa noite":
 *
 *   npm run carga:prova                    sobe o compose de carga, roda o cenário e reprova se um critério falhar
 *   npm run carga:prova:controle-negativo  o mesmo, com um gatilho que atrasa em 600 ms cada gravação de resposta: só passa se o cenário reprovar pelo p95 do fluxo normal
 *   npm run carga:prova:controle-da-volta  o mesmo, com as APIs fora por 150 s em vez de 90 (o k6 sem saber): só passa se o cenário reprovar pela fila da volta
 *
 * 1. sobe o projeto `educa-carga` (infra/compose.yml com infra/compose.carga.yml), como o `carga:ingestao`;
 * 2. cria a rede e as dez escolas pelo `ops:escola`; em cada uma, as professoras e a estrutura (`semearEscolaDaSala`: ano, seis turmas, disciplina, material), uma atividade
 *    objetiva de 20 questões por turma, aplicada como prova, aberta, com janela e duração de 40 min;
 * 3. só então as sessões dos 210 alunos de cada escola (o token de acesso vale 10 min, e a prova leva ~8): o vínculo de 35 em cada turma, e um aluno em dez com a rede caindo;
 * 4. o k6 (`infra/k6/prova-online.js`) põe os 2.100 alunos em prova. Aos 180 s o driver **pausa as duas APIs por 90 s** (`docker compose pause`) e, no começo da queda, cria uma prova
 *    que vence 40 s depois (a "canária": uma tentativa em andamento, sem resposta) e que a rotina não pode encerrar até o pulso voltar;
 * 5. o veredito (`conferir-carga-prova.ts`): p95 do PUT do fluxo normal abaixo de 500 ms, a fila de cada aluno que atravessou a queda vazia em até 60 s depois dela, respostas enviadas = linhas gravadas, a lacuna da queda gravada, nenhuma prova encerrada durante ela e o
 *    limite da canária andado pela queda e encerrada depois dela;
 * 6. derruba o projeto com os volumes, passe ou não.
 *
 * Os dois controles negativos só valem depois de uma rodada verde. O do PUT só passa se o cenário reprovar pelo p95 do fluxo normal: um gatilho de teste, só neste banco descartável, dorme 600 ms
 * em cada gravação de resposta. O da volta só passa se reprovar pela fila da volta: as APIs ficam fora por 150 s, e o k6 continua medindo a partir do fim previsto aos 90 s.
 *
 * Nada de pessoa: escolas e alunos sintéticos (regra 20, item 17). Nenhuma chamada a provedor de IA (regra 80, item 11): a prova não usa IA.
 */

export const SCRIPT_DO_K6_DA_PROVA = '/cenario/prova-online.js'
export const OPERADOR_DA_CARGA_DA_PROVA = 'carga-prova'
export const ATRASO_DO_CONTROLE_NEGATIVO_S = 0.6
/** A queda do controle da volta: mais longa que a de 90 s que o k6 conhece, para a fila levar mais de 60 s depois do fim previsto dela. */
export const QUEDA_DO_CONTROLE_DA_VOLTA_S = 150
/** A prova da canária vence assim que a queda começa: depois da primeira conferência do pulso, e dentro da queda. */
export const VENCE_NA_QUEDA_EM_S = 40
export const PRAZO_DA_CANARIA_MS = 4 * 60_000
const DESCRICAO_DO_CONTROLE: Record<ControleNegativoDaProva, string> = { put_p95: 'o PUT atrasado em 600 ms', fila_da_volta: `as APIs fora por ${String(QUEDA_DO_CONTROLE_DA_VOLTA_S)} s` }
const PROFESSORAS_POR_ESCOLA = 2
const ALUNOS_POR_ESCOLA = TURMAS_POR_ESCOLA_DA_PROVA * ALUNOS_POR_TURMA_DA_PROVA

/** Os argumentos do `k6 run`, dentro do container. */
export function argumentosDoK6DaProva(): string[] {
  return ['run', '--quiet', '--no-usage-report', '--summary-export', '/execucao/resumo-prova.json', '--env', 'API_URL=http://borda:8080', '--env', 'ARQUIVO_DOS_TOKENS=/execucao/tokens.json', SCRIPT_DO_K6_DA_PROVA]
}

/** O `sub` do token: o aluno. O token é do cenário, sintético, e o driver só o lê. */
export function usuarioDoToken(token: string): string {
  const carga = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { sub?: unknown }
  if (typeof carga.sub !== 'string') throw new Error('token sem sub')
  return carga.sub
}

/** A atividade objetiva de 20 questões, no formato do conteúdo do artefato, sem habilidade da BNCC: o cenário mede a gravação, não a classificação. */
export function conteudoDaProva(materialId: string, titulo: string): string {
  return JSON.stringify({
    tipo: 'atividade_objetiva',
    titulo,
    questoes: Array.from({ length: ITENS_DA_PROVA }, (_, indice) => ({
      enunciado: `Enunciado sintético da questão ${String(indice + 1)}`,
      alternativas: ['Alternativa A', 'Alternativa B', 'Alternativa C', 'Alternativa D'],
      gabarito: (indice + 1) % 4,
      habilidade: null,
      citacao: { materialId, pagina: 1, trecho: 'Trecho sintético do material' },
      explicacao: `Explicação sintética da questão ${String(indice + 1)}`,
    })),
  })
}

function escrever(linha: string): void {
  process.stdout.write(`${linha}\n`)
}

type Compose = (...argumentos: string[]) => Promise<{ codigo: number }>

/** Sessões reais pelo `ops:sessao-sintetica`, sem reconstruir o `dist` (o script do npm já o construiu): dez escolas em paralelo se pisariam nele. */
const gerarSessoes = (ambiente: NodeJS.ProcessEnv, escolaId: string, papel: 'aluno' | 'professor', quantidade: number): Promise<string[]> =>
  sessoesSinteticas(ambiente, escolaId, papel, quantidade, `${papel}-${escolaId}`, true)

interface EscolaDaProva {
  readonly escolaId: string
  readonly anoId: string
  readonly materialId: string
  readonly professorId: string
  readonly disciplinaId: string
  readonly turmas: readonly string[]
  readonly aplicacoes: readonly string[]
}

async function primeiro<Row extends Record<string, unknown>>(banco: pg.Client, texto: string, valores: unknown[]): Promise<Row> {
  const linha = (await banco.query<Row>(texto, valores)).rows[0]
  if (linha === undefined) throw new Error('linha da estrutura da prova não criada')
  return linha
}

/** Uma atividade objetiva aplicada como prova numa turma: aberta, com janela de 1 h à frente e duração de 40 min, ou com o fim em `fechaEmSql`. */
async function aplicarProva(banco: pg.Client, escola: Pick<EscolaDaProva, 'escolaId' | 'anoId' | 'materialId' | 'professorId' | 'disciplinaId'>, turmaId: string, titulo: string, fechaEmSql: string): Promise<string> {
  const { id: artefatoId } = await primeiro<{ id: string }>(
    banco,
    `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por) values ($1, $2, $3, $4, 'atividade_objetiva', $5, $6, $7) returning id`,
    [escola.escolaId, escola.anoId, turmaId, escola.disciplinaId, titulo, conteudoDaProva(escola.materialId, titulo), escola.professorId],
  )
  const { id } = await primeiro<{ id: string }>(
    banco,
    `insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, estado, aplicada_por, abre_em, fecha_em, duracao_min)
     values ($1, $2, $3, $4, true, 'aberta', $5, now() - interval '1 hour', ${fechaEmSql}, 40) returning id`,
    [escola.escolaId, escola.anoId, turmaId, artefatoId, escola.professorId],
  )
  return id
}

/** As professoras, a estrutura da escola (`semearEscolaDaSala`) e uma prova por turma. Os alunos vêm depois, para o token não vencer antes do k6. */
async function prepararEscola(banco: pg.Client, ambienteDosOps: NodeJS.ProcessEnv, escolaId: string): Promise<EscolaDaProva> {
  await gerarSessoes(ambienteDosOps, escolaId, 'professor', PROFESSORAS_POR_ESCOLA)
  const { disciplinaId } = await semearEscolaDaSala(banco, escolaId)
  const { id: anoId } = await primeiro<{ id: string }>(banco, "select id from ano_letivo where escola_id = $1 and situacao = 'em_curso'", [escolaId])
  const { id: materialId } = await primeiro<{ id: string }>(banco, 'select id from material where escola_id = $1 limit 1', [escolaId])
  const { id: professorId } = await primeiro<{ id: string }>(banco, "select id from usuario where escola_id = $1 and papel = 'professor' order by id limit 1", [escolaId])
  const turmas = (await banco.query<{ id: string }>('select id from turma where escola_id = $1 order by id', [escolaId])).rows.map(({ id }) => id)
  const base = { escolaId, anoId, materialId, professorId, disciplinaId }
  const aplicacoes: string[] = []
  for (const [indice, turmaId] of turmas.entries()) aplicacoes.push(await aplicarProva(banco, base, turmaId, `Prova sintética da turma ${String(indice + 1)}`, "now() + interval '1 hour'"))
  return { ...base, turmas, aplicacoes }
}

interface AlunoDaProva {
  readonly token: string
  readonly aplicacaoId: string
  readonly rede: boolean
}

/** As sessões dos 210 alunos da escola, o vínculo confirmado de 35 em cada turma (ATALHO SÓ DA CARGA, sintética: direto no banco, como o `semearEscolaDaSala`) e a prova de cada um. */
async function matricularAlunos(banco: pg.Client, ambienteDosOps: NodeJS.ProcessEnv, escola: EscolaDaProva, deslocamento: number, comCanaria: boolean): Promise<{ alunos: AlunoDaProva[]; canariaAlunoId: string | undefined }> {
  const todos = await gerarSessoes(ambienteDosOps, escola.escolaId, 'aluno', ALUNOS_POR_ESCOLA + (comCanaria ? 1 : 0))
  // O último, quando há canária, é o aluno dela: fica fora do rodízio das turmas e do arquivo do k6.
  const tokens = todos.slice(0, ALUNOS_POR_ESCOLA)
  const usuarios = tokens.map(usuarioDoToken)
  const canariaAlunoId = comCanaria ? usuarioDoToken(todos[ALUNOS_POR_ESCOLA] ?? '') : undefined
  const turmaDe = (posicao: number): number => posicao % TURMAS_POR_ESCOLA_DA_PROVA
  await banco.query(
    `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em)
     select $1, $2, u.usuario_id, ($3::uuid[])[1 + u.turma], 'aluno', 'confirmado', $4, now()
       from unnest($5::uuid[], $6::int[]) as u(usuario_id, turma)`,
    [escola.escolaId, escola.anoId, escola.turmas, escola.professorId, usuarios, usuarios.map((_, posicao) => turmaDe(posicao))],
  )
  const alunos = tokens.map((token, posicao) => ({ token, aplicacaoId: escola.aplicacoes[turmaDe(posicao)] ?? '', rede: (deslocamento + posicao) % UM_ALUNO_EM_CADA_SEM_REDE === 0 }))
  return { alunos, canariaAlunoId }
}

/** O gatilho do controle negativo: cada gravação de resposta dorme 600 ms, só neste banco descartável. */
async function atrasarOPut(banco: pg.Client): Promise<void> {
  await banco.query(`create function carga_atraso_do_put() returns trigger language plpgsql as $$ begin perform pg_sleep(${String(ATRASO_DO_CONTROLE_NEGATIVO_S)}); return new; end $$`)
  await banco.query('create trigger carga_atraso_do_put before insert or update on resposta_atividade for each row execute function carga_atraso_do_put()')
}

/** A prova que vence durante a queda: uma tentativa em andamento (sem resposta) cujo limite é o `fecha_em`, daqui a `VENCE_NA_QUEDA_EM_S`. */
async function criarCanaria(banco: pg.Client, escola: EscolaDaProva, alunoId: string): Promise<string> {
  const turmaId = escola.turmas[0] ?? ''
  const id = await aplicarProva(banco, escola, turmaId, 'Prova sintética que vence na queda', `now() + interval '${String(VENCE_NA_QUEDA_EM_S)} seconds'`)
  await banco.query(
    `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`,
    [escola.escolaId, escola.anoId, alunoId, turmaId, escola.professorId],
  )
  await banco.query(
    `insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, iniciada_em, limite_base_em)
     select $1, $2, a.id, $3, now() - interval '5 minutes', a.fecha_em from atividade_aplicada a where a.id = $4`,
    [escola.escolaId, escola.anoId, alunoId, id],
  )
  return id
}

/** O que o banco guardou da canária, esperando a rotina encerrá-la depois da queda: o instante do encerramento e o limite que a queda andou. */
async function lerCanaria(banco: pg.Client, id: string, prazoMs: number): Promise<CanarioDaQueda | undefined> {
  const limite = Date.now() + prazoMs
  while (Date.now() < limite) {
    const { rows } = await banco.query<{ fecha_em: Date; encerrada_em: Date | null; enviada_em: Date | null }>(
      `select a.fecha_em, a.encerrada_em, t.enviada_em from atividade_aplicada a left join tentativa_atividade t on t.atividade_aplicada_id = a.id where a.id = $1`,
      [id],
    )
    const linha = rows[0]
    if (linha?.encerrada_em != null) return { fechaEm: linha.fecha_em, encerradaEm: linha.encerrada_em, limiteGravadoEm: linha.enviada_em }
    await esperar(2_000)
  }
  const { rows } = await banco.query<{ fecha_em: Date }>('select fecha_em from atividade_aplicada where id = $1', [id])
  return rows[0] === undefined ? undefined : { fechaEm: rows[0].fecha_em, encerradaEm: null, limiteGravadoEm: null }
}

async function lerLacuna(banco: pg.Client, desde: Date): Promise<MedidaDaProva['lacuna']> {
  const { rows } = await banco.query<{ inicio: Date; fim: Date; duracao: number }>('select inicio, fim, extract(epoch from fim - inicio)::float8 as duracao from indisponibilidade where fim > $1 order by fim - inicio desc limit 1', [desde])
  const linha = rows[0]
  return linha === undefined ? undefined : { duracaoS: linha.duracao, inicio: linha.inicio, fim: linha.fim }
}

function lerResumo(pasta: string): ReturnType<typeof lerResumoDaProva> {
  try {
    return lerResumoDaProva(JSON.parse(readFileSync(join(pasta, 'resumo-prova.json'), 'utf8')))
  } catch {
    return undefined
  }
}

interface Resultado {
  readonly medida: MedidaDaProva
  readonly thresholds: string[]
}

/** O que o banco guardou, depois da queda e do k6: as respostas gravadas, a lacuna do pulso e as provas encerradas dentro dela. */
async function medirOBanco(banco: pg.Client, escolas: readonly string[], inicio: Date): Promise<Pick<MedidaDaProva, 'respostasGravadas' | 'lacuna' | 'encerradasNaQueda'>> {
  const lacuna = await lerLacuna(banco, inicio)
  const { rows: gravadas } = await banco.query<{ total: string }>('select count(*) as total from resposta_atividade where escola_id = any($1::uuid[])', [escolas])
  let encerradasNaQueda = 0
  if (lacuna !== undefined) {
    const { rows } = await banco.query<{ total: string }>('select count(*) as total from atividade_aplicada where escola_id = any($1::uuid[]) and encerrada_em > $2 and encerrada_em < $3', [escolas, lacuna.inicio, lacuna.fim])
    encerradasNaQueda = Number(rows[0]?.total ?? 0)
  }
  return { respostasGravadas: Number(gravadas[0]?.total ?? 0), lacuna, encerradasNaQueda }
}

interface CenarioPreparado {
  readonly escolas: readonly EscolaDaProva[]
  readonly canariaAlunoId: string
}

/**
 * As escolas, as provas e os 2.100 alunos com sessão, com o arquivo de tokens que o k6 lê. As dez escolas vão em paralelo e as sessões dos alunos saem por último: o token vale 10 min
 * e a corrida passa de 7, então o mais antigo, quando o k6 começa, não pode ter mais que `IDADE_MAXIMA_DO_TOKEN_NO_INICIO_DO_K6_S`.
 */
async function prepararOCenario(banco: pg.Client, pasta: string, ambienteDosOps: NodeJS.ProcessEnv, controleNegativo: ControleNegativoDaProva | undefined): Promise<CenarioPreparado> {
  escrever(`\n▶ ${String(ESCOLAS_DA_PROVA)} escolas, ${String(TURMAS_POR_ESCOLA_DA_PROVA)} turmas, uma prova por turma, e as sessões dos ${String(ESCOLAS_DA_PROVA * ALUNOS_POR_ESCOLA)} alunos`)
  const criadas = (await criarEscolasDaSala(ambienteDosOps)).slice(0, ESCOLAS_DA_PROVA)
  const comecouEm = Date.now()
  const preparadas = await Promise.all(
    criadas.map(async (escolaId, indice) => {
      const escola = await prepararEscola(banco, ambienteDosOps, escolaId)
      return { escola, ...(await matricularAlunos(banco, ambienteDosOps, escola, indice, indice === 0)) }
    }),
  )
  if (controleNegativo === 'put_p95') await atrasarOPut(banco)
  const canariaAlunoId = preparadas[0]?.canariaAlunoId
  if (canariaAlunoId === undefined) throw new Error('nenhuma escola criada')
  const arquivoDosTokens = join(pasta, 'tokens.json')
  writeFileSync(arquivoDosTokens, JSON.stringify({ alunos: preparadas.flatMap(({ alunos }) => alunos) }))
  chmodSync(arquivoDosTokens, 0o644)
  const idadeS = Math.round((Date.now() - comecouEm) / 1_000)
  if (idadeS > IDADE_MAXIMA_DO_TOKEN_NO_INICIO_DO_K6_S + 60) throw new Error(`o preparo levou ${String(idadeS)} s: os tokens chegariam velhos ao k6`)
  return { escolas: preparadas.map(({ escola }) => escola), canariaAlunoId }
}

async function rodarCenario(compose: Compose, pasta: string, doArquivo: Record<string, string>, ambienteDosOps: NodeJS.ProcessEnv, controleNegativo: ControleNegativoDaProva | undefined): Promise<Resultado> {
  const subida = await compose('up', '--detach', '--build', '--wait')
  if (subida.codigo !== 0) throw new Error('o compose de carga não subiu')
  const banco = new pg.Client({ connectionString: urlDoBancoDoAmbiente(doArquivo) })
  await banco.connect()
  try {
    const { escolas, canariaAlunoId } = await prepararOCenario(banco, pasta, ambienteDosOps, controleNegativo)
    const primeira = escolas[0]
    if (primeira === undefined) throw new Error('nenhuma escola criada')
    const inicio = new Date((await banco.query<{ agora: Date }>('select clock_timestamp() as agora')).rows[0]?.agora ?? Date.now())

    escrever('▶ o k6')
    const k6 = compose('run', '--rm', '--no-deps', 'k6', ...argumentosDoK6DaProva())
    await esperar(QUEDA_INICIO_S * 1_000)
    const quedaS = controleNegativo === 'fila_da_volta' ? QUEDA_DO_CONTROLE_DA_VOLTA_S : QUEDA_DURACAO_S
    escrever(`▶ as duas APIs fora por ${String(quedaS)} s`)
    const canaria = await criarCanaria(banco, primeira, canariaAlunoId)
    await compose('pause', 'api-1', 'api-2')
    await esperar(quedaS * 1_000)
    await compose('unpause', 'api-1', 'api-2')
    escrever('▶ as APIs de volta; esperando a rotina encerrar a prova que venceu na queda, e o k6 terminar')
    const [canario, resultadoDoK6] = await Promise.all([lerCanaria(banco, canaria, PRAZO_DA_CANARIA_MS), k6])

    const medida: MedidaDaProva = { k6: lerResumo(pasta), ...(await medirOBanco(banco, escolas.map(({ escolaId }) => escolaId), inicio)), canario }
    for (const linha of descreverProva(medida)) escrever(linha)
    return { medida, thresholds: resultadoDoK6.codigo === 0 ? [] : [`k6 saiu com ${String(resultadoDoK6.codigo)}`] }
  } finally {
    await banco.end().catch(() => undefined)
  }
}

function relatar(resultado: Resultado, controleNegativo: ControleNegativoDaProva | undefined, inicio: Date, inicioMonotonico: number): number {
  const duracao = Math.round((performance.now() - inicioMonotonico) / 60_000)
  const reprovacoes = julgarProva(resultado.medida)
  const passou = reprovacoes.length === 0
  escrever(`\n■ resultado em ${inicio.toISOString()} (${String(duracao)} min): ${passou ? 'passou' : 'reprovou'}`)
  for (const reprovacao of reprovacoes) escrever(`  reprovado: ${reprovacao.detalhe}`)
  for (const cruzado of resultado.thresholds) escrever(`  ${cruzado}`)
  const codigo = codigoDeSaidaDaProva(reprovacoes, controleNegativo)
  if (controleNegativo !== undefined) {
    escrever(`${codigo === 0 ? '✔' : '✖'} controle negativo (${DESCRICAO_DO_CONTROLE[controleNegativo]}): o cenário ${codigo === 0 ? 'reprovou' : 'não reprovou'} pelo critério ${controleNegativo}`)
    return codigo
  }
  escrever(passou ? '✔ cenário passou' : '✖ cenário reprovou')
  return codigo
}

async function executar(controleNegativo: ControleNegativoDaProva | undefined): Promise<number> {
  const pasta = mkdtempSync(join(tmpdir(), 'educa-carga-prova-'))
  // O k6 do container roda com outro usuário: ele lê os tokens e grava o resumo nesta pasta. A pasta aberta só serve porque tudo aqui é sintético e sai no fim.
  // Não reaproveite este padrão: pasta `0o777` com token só vale num compose descartável, com sessão sintética, apagada no `finally`; com credencial real ou fora da carga, é arquivo aberto (regra 20, itens 7 e 17).
  chmodSync(pasta, 0o777)
  const doArquivo = lerAmbienteDeCarga()
  const ambiente: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([chave]) => !(chave in doArquivo))), CARGA_PASTA_DA_EXECUCAO: pasta }
  const compose: Compose = (...argumentos) => rodar('docker', [...argumentosDoCompose(), ...argumentos], ambiente)
  const inicio = new Date()
  const inicioMonotonico = performance.now()
  let resultado: Resultado | undefined
  try {
    escrever(`\n▶ cenário "a prova da manhã"${controleNegativo === undefined ? '' : `, controle negativo (${DESCRICAO_DO_CONTROLE[controleNegativo]})`}`)
    await compose('down', '--volumes', '--remove-orphans')
    resultado = await rodarCenario(compose, pasta, doArquivo, { ...ambiente, ...doArquivo, OPERADOR: OPERADOR_DA_CARGA_DA_PROVA }, controleNegativo)
  } catch (erro) {
    escrever(`\n✖ o cenário não terminou: ${erro instanceof Error ? erro.message : String(erro)}`)
    await compose('unpause', 'api-1', 'api-2')
    await compose('logs', '--no-color', '--tail', '100', 'api-1', 'api-2', 'worker-lote-1')
  } finally {
    await compose('down', '--volumes', '--remove-orphans')
    rmSync(pasta, { recursive: true, force: true })
  }
  if (resultado === undefined) return 1
  return relatar(resultado, controleNegativo, inicio, inicioMonotonico)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executar(process.argv.includes('--controle-negativo') ? 'put_p95' : process.argv.includes('--controle-da-volta') ? 'fila_da_volta' : undefined)
}
