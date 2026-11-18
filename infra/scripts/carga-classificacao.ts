import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import pg from 'pg'
import { argumentosDoK6DaIngestao, DURACAO_DA_BASE, DURACAO_DO_K6_DA_INGESTAO } from './carga-ingestao.ts'
import { adaptadorDoAmbienteDeCarga, argumentosDoCompose, criarEscolasDoCenario, exigirAdaptadorFalso, lerAmbienteDeCarga, rodar, type EscolasDoCenario } from './carga.ts'
import {
  aguardarClassificacaoDaA,
  codigoDeSaidaDaClassificacao,
  contarConcluidasDaA,
  EXECUCOES_ESPERADAS,
  FRACAO_ANTES_DA_PARADA,
  julgarClassificacao,
  lerAgendamentoDaA,
  lerTurnoDaB,
  medirPlano,
  PARADA_DO_PROVEDOR_EM_MINUTOS,
  SECOES_POR_MATERIAL,
  TOTAL_DE_MATERIAIS,
  type AgendamentoDaA,
  type ConfiguracaoDoCenario,
  type MedidaDaClassificacao,
  type ParadaDoProvedor,
  type PlanoMedido,
} from './conferir-carga-classificacao.ts'
import { urlDoBancoDoAmbiente } from './conferir-carga.ts'
import { agoraDoBanco, liberarJanelaDaA, PRIORIDADE_DO_LOTE, semearTutorDaB } from './expurgo-da-carga.ts'

/**
 * Cenário "300 apostilas, classificadas numa noite" (classificacao-bncc, tarefa 5.0; Tech Spec, seção 7c; PRD, RF5 e RF15), local e manual:
 *
 *   npm run carga:classificacao      sobe o compose de carga, roda o cenário e reprova se um critério falhar
 *
 * 1. sobe o projeto `educa-carga` (infra/compose.yml com infra/compose.carga.yml) com o **adaptador falso** na latência do perfil `rapido` (6 s por chamada) e nos tokens de uma execução do recorte maior (30.400 de entrada e 600
 *    de saída: ~31 mil, a conta da Tech Spec §7c), e o contratado de produção (2,5 milhões por minuto: o balde do `lote` é 5 %, 125 mil por minuto); nenhuma chamada a provedor pago (regra 80, item 11);
 * 2. cria a rede e as escolas sintéticas pelo `ops:escola`; a A deixa de ter horário letivo (o lote não urgente roda na hora, como numa noite) e recebe **300 apostilas** `prontas`, de 25 seções cada, por SQL
 *    (a extração é da 9.0 da ingestão; aqui o que importa é o lote), e a B recebe os alunos do Tutor;
 * 3. fase `base`: o k6 só com o Tutor da B (1,5 turno por segundo), e o p95 do turno que o banco registrou;
 * 4. fase `lote`: o job `material.agendar-classificacao` da A, gravado como a rotina das 19h o grava, e o mesmo k6 da B por três minutos. Quando 20 % das execuções terminaram, o driver **para os `worker-ia` por
 *    10 min** (o provedor fora) e os religa: o que esperava na fila volta a andar sozinho. Depois espera o fim;
 * 5. o veredito (`conferir-carga-classificacao.ts`): as 7.500 seções em 630 execuções, nenhuma seção sem classificação, as 630 projetadas dentro das 10 h, a retomada depois da parada, o p95 do turno da B até 500 ms
 *    acima da base e o plano da cobertura e do join da busca com o volume do cenário;
 * 6. derruba o projeto com os volumes, passe ou não.
 *
 * `--materiais=N` ensaia o driver com menos apostilas e **não vale como veredito** (o agendamento reprova pela contagem).
 *
 * Nada de pessoa: escolas, alunos e texto sintéticos (regra 20, item 17).
 */

export const OPERADOR_DA_CARGA_DA_CLASSIFICACAO = 'carga-classificacao'
/** A chave do job da noite da A: a data local, como a rotina a grava. */
export const TIPO_DO_AGENDAMENTO = 'material.agendar-classificacao'
/** As 630 execuções a ~4 por minuto levam ~2,6 h: o prazo dá folga sem esperar a noite inteira. */
export const PRAZO_DA_CLASSIFICACAO_MS = 6 * 3_600_000
/** A espera de cada chamada ao modelo no cenário: a do `rapido` (a Tech Spec §7c conta ~6 s). */
export const LATENCIA_DO_MODELO_MS = 6_000
/**
 * Os tokens que o falso informa por chamada: o **recorte maior** de `classificar_secoes`, que a Tech Spec §7c manda a 5.0 usar (LP do 6º ao 9º com o Médio, 267 habilidades, 12 seções cheias: ~31 mil, medidos na 3.0),
 * e não os ~12 mil do recorte comum: é a conta que dá ~4 execuções por minuto no balde do lote, e a que a noite precisa aguentar.
 */
export const TOKENS_FALSOS_DA_ENTRADA = 30_400
export const TOKENS_FALSOS_DA_SAIDA = 600
/** O contratado de produção, em tokens por minuto (`docs/infra.md` 5.3): o balde do lote é 5 % dele. */
export const TOKENS_POR_MINUTO_DO_CONTRATO = 2_500_000
export const PARTE_DO_BALDE_DO_LOTE = 0.05
export const TEXTO_DA_PAGINA = 'A massa molar relaciona a quantidade de matéria e a massa de uma amostra: o mol conta entidades, e a estequiometria usa essa relação para prever as reações químicas. '

/** O ambiente do cenário: o falso na latência e nos tokens de uma execução, e o contratado de produção. Sem o que o shell exporta de `infra/carga.env`. */
export function ambienteDoFalsoDoLote(): Record<string, string> {
  return {
    IA_ADAPTADOR: 'falso',
    IA_LATENCIA_FALSA_MS: String(LATENCIA_DO_MODELO_MS),
    IA_LATENCIA_FALSA_MS_PADRAO: '0',
    IA_TOKENS_FALSOS_ENTRADA: String(TOKENS_FALSOS_DA_ENTRADA),
    IA_TOKENS_FALSOS_SAIDA: String(TOKENS_FALSOS_DA_SAIDA),
    LLM_TOKENS_POR_MINUTO: String(TOKENS_POR_MINUTO_DO_CONTRATO),
  }
}

/** O compose de carga em números, para o relatório: as réplicas, o pool, a vaga da escola e o balde do lote. */
export function configuracaoDoCenario(doArquivo: Readonly<Record<string, string>>): ConfiguracaoDoCenario {
  return {
    replicasDaIa: Number(doArquivo['IA_REPLICAS'] ?? 2),
    poolLotePorReplica: Number(doArquivo['WORKER_IA_POOL_LOTE'] ?? 1),
    vagasDaEscolaNoLote: Number(doArquivo['VAGAS_ESCOLA_LOTE'] ?? 2),
    tokensPorMinuto: TOKENS_POR_MINUTO_DO_CONTRATO,
    baldeDoLotePorMinuto: Math.floor(TOKENS_POR_MINUTO_DO_CONTRATO * PARTE_DO_BALDE_DO_LOTE),
    tokensPorExecucao: TOKENS_FALSOS_DA_ENTRADA + TOKENS_FALSOS_DA_SAIDA,
    latenciaDoModeloMs: LATENCIA_DO_MODELO_MS,
  }
}

function escrever(linha: string): void {
  process.stdout.write(`${linha}\n`)
}

type Compose = (...argumentos: string[]) => Promise<{ codigo: number }>
type Consultavel = Pick<pg.ClientBase, 'query'>

/**
 * Os alunos da B: o k6 consulta a execução a cada 0,1 s, e com 6 s por turno são ~60 leituras por turno. O limite geral é de 120 requisições por minuto por pessoa
 * (`LIMITE_REQ_USUARIO_MIN`): com 30 alunos, cada um fazia 3 turnos por minuto e passava dele (233 respostas 429 no ensaio). Com 60 alunos e um turno a cada 2 s, cada um faz meio turno por minuto.
 */
export const ALUNOS_DA_B = 60

/**
 * O Tutor da B em 1 turno a cada 2 s (30 por minuto), e não nos 3 a cada 2 s do cenário da ingestão: o falso dá a todo turno os ~31 mil tokens da classificação (§7c), e 90 turnos por minuto de 31 mil são 2,8 milhões,
 * mais que o balde interativo de 2,375 milhões. A conta real do Tutor é de ~3 mil por turno; aqui são 30 turnos de 31 mil (930 mil por minuto), o balde interativo a 39 %.
 */
export const TURNOS_DA_B_POR_2S = 1

/** Os argumentos do k6 da ingestão com o ritmo do Tutor deste cenário: a variável entra antes do script, que é o último argumento. */
export function argumentosDoK6DaClassificacao(fase: 'base' | 'ingestao', duracao: string, turnoBaseP95Ms?: number): string[] {
  const argumentos = argumentosDoK6DaIngestao(fase, duracao, turnoBaseP95Ms)
  return [...argumentos.slice(0, -1), '--env', `TURNOS_DA_B_POR_2S=${String(TURNOS_DA_B_POR_2S)}`, argumentos.at(-1) ?? '']
}

/** Uma sessão de aluno por token da B, pelo `ops:sessao-sintetica`: o token vale 10 min, e os alunos novos precisam do vínculo antes do k6. */
async function gerarSessoesDoTutor(ambiente: NodeJS.ProcessEnv, escolaB: string): Promise<string[]> {
  const quantidade = ALUNOS_DA_B
  const argumentos = ['run', '-s', 'ops:sessao-sintetica', '--', '--escola', escolaB, '--papel', 'aluno', '--quantidade', String(quantidade)]
  const { codigo, saida } = await rodar('npm', argumentos, ambiente, true)
  const linhas = saida.split('\n').filter((linha) => linha.startsWith('ey'))
  if (codigo !== 0 || linhas.length !== quantidade) throw new Error(`ops:sessao-sintetica não criou as ${String(quantidade)} sessões do Tutor da B`)
  return linhas
}

/**
 * A A recebe `materiais` apostilas `prontas` de 25 seções de uma página cada, com a disciplina de Química (componente `quimica`) e a série do Médio: tudo por SQL, sem execução, como a extração as deixaria antes da
 * rotina. Termina com `analyze` e `checkpoint`: o plano do Postgres depende de estatística, e as páginas sujas da carga inicial não podem ser escritas no meio da medição da B.
 */
export async function semearAsApostilas(banco: Consultavel, escolaId: string, materiais: number): Promise<{ disciplinaId: string; serieId: string }> {
  await semearTutorDaB(banco, escolaId)
  const serie = await banco.query<{ id: string }>('select id from serie where escola_id = $1 limit 1', [escolaId])
  const disciplina = await banco.query<{ id: string }>(
    `insert into disciplina (escola_id, nome, componente_bncc) values ($1, 'Química', 'quimica')
     on conflict (escola_id, lower(nome)) do update set componente_bncc = excluded.componente_bncc returning id`,
    [escolaId],
  )
  const serieId = serie.rows[0]?.id
  const disciplinaId = disciplina.rows[0]?.id
  if (serieId === undefined || disciplinaId === undefined) throw new Error('a série ou a disciplina da escola A não foi criada')
  await banco.query(
    `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_em)
     select $1, $2, 'Apostila ' || n, 'escola', 'autoria_da_escola', true, md5(random()::text || n::text) || md5(n::text), 1000, 'pronto', $3, now() - interval '3 hours'
       from generate_series(1, $4::int) n`,
    [escolaId, disciplinaId, SECOES_POR_MATERIAL, materiais],
  )
  await banco.query('insert into material_serie (escola_id, material_id, serie_id) select escola_id, id, $2 from material where escola_id = $1', [escolaId, serieId])
  await banco.query(
    `insert into trecho (escola_id, disciplina_id, material_id, pagina, texto)
     select m.escola_id, m.disciplina_id, m.id, p, repeat($2::text, 5) || 'Página ' || p
       from material m cross join generate_series(1, $3::int) p where m.escola_id = $1`,
    [escolaId, TEXTO_DA_PAGINA, SECOES_POR_MATERIAL],
  )
  await banco.query(
    `insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final)
     select m.escola_id, m.id, p::smallint, p, p from material m cross join generate_series(1, $2::int) p where m.escola_id = $1`,
    [escolaId, SECOES_POR_MATERIAL],
  )
  await banco.query('analyze')
  await banco.query('checkpoint')
  return { disciplinaId, serieId }
}

/** Grava o job da noite da A, como a rotina das 19h o grava: lote, não urgente, com a chave "a data da noite". */
export async function enfileirarAgendamentoDaA(banco: Consultavel, escolaId: string, agora: Date = new Date()): Promise<string> {
  const { rows } = await banco.query<{ id: string }>(
    `insert into job_registro (escola_id, fila, prioridade, tipo, dados, nao_urgente, chave_idempotencia)
     values ($1, 'lote', $2, $3, '{}'::jsonb, true, $4) returning id`,
    [escolaId, PRIORIDADE_DO_LOTE, TIPO_DO_AGENDAMENTO, agora.toISOString().slice(0, 10)],
  )
  await banco.query('select pg_notify($1, $2)', ['job', ''])
  const id = rows[0]?.id
  if (id === undefined) throw new Error('o job do agendamento não foi gravado')
  return id
}

/** Os thresholds que o k6 cruzou, do resumo que ele gravou; sem o arquivo, a falta dele é a reprovação. */
function lerThresholdsCruzados(pasta: string, resumo: string): string[] {
  try {
    const metricas = (JSON.parse(readFileSync(join(pasta, `${resumo}.json`), 'utf8')) as { metrics?: Record<string, { thresholds?: Record<string, boolean> }> }).metrics ?? {}
    return Object.entries(metricas).flatMap(([metrica, valores]) =>
      Object.entries(valores.thresholds ?? {})
        .filter(([, cruzado]) => cruzado)
        .map(([criterio]) => `${metrica} ${criterio}`),
    )
  } catch {
    return ['sem resumo do k6']
  }
}

async function rodarK6(compose: Compose, pasta: string, argumentos: string[], resumo: string): Promise<{ codigo: number; cruzados: string[] }> {
  const { codigo } = await compose('run', '--rm', '--no-deps', 'k6', ...argumentos)
  return { codigo, cruzados: lerThresholdsCruzados(pasta, resumo) }
}

/** Espera o job da noite da A acabar: o número de execuções para de crescer por três leituras seguidas, cinco segundos uma da outra (as 7.500 seções saem em 15 lotes de 500, cada um numa transação). */
async function aguardarOAgendamento(banco: Consultavel, escolaA: string): Promise<AgendamentoDaA> {
  let anterior = -1
  let paradas = 0
  for (;;) {
    const lido = await lerAgendamentoDaA(banco, escolaA)
    paradas = lido.execucoes > 0 && lido.execucoes === anterior ? paradas + 1 : 0
    if (paradas >= 3) return lido
    anterior = lido.execucoes
    await esperar(5_000)
  }
}

/**
 * Espera 20 % das execuções terminarem, para os `worker-ia` por 10 min (o provedor fora: o que está na fila fica, e o que rodava termina dentro dos 20 s de graça) e os religa. Devolve o que mediu da parada. As execuções
 * que o balde e a vaga seguravam voltam a andar sozinhas, pelo mesmo caminho de sempre.
 */
async function pararOProvedor(banco: Consultavel, compose: Compose, escolaA: string, execucoes: number, minutos: number, acabou: { valor: boolean }): Promise<ParadaDoProvedor> {
  const meta = Math.ceil(execucoes * FRACAO_ANTES_DA_PARADA)
  while ((await contarConcluidasDaA(banco, escolaA)) < meta) {
    // O lote acabou (ou reprovou) sem chegar à fração: não há o que parar, e o critério da parada reprova.
    if (acabou.valor) return { minutos, inicioMs: null, fimMs: null, concluidasAntes: 0, concluidasNaParada: 0 }
    await esperar(5_000)
  }
  escrever(`\n▶ ${String(meta)} execuções concluídas: os worker-ia ficam fora por ${String(minutos)} min`)
  await compose('stop', 'worker-ia-1', 'worker-ia-2')
  const inicioMs = await agoraDoBanco(banco)
  const concluidasAntes = await contarConcluidasDaA(banco, escolaA)
  await esperar(minutos * 60_000)
  const concluidasNaParada = (await contarConcluidasDaA(banco, escolaA)) - concluidasAntes
  const fimMs = await agoraDoBanco(banco)
  await compose('start', 'worker-ia-1', 'worker-ia-2')
  escrever(`▶ os worker-ia voltaram (${String(concluidasNaParada)} execuções concluídas durante a parada)`)
  return { minutos, inicioMs, fimMs, concluidasAntes, concluidasNaParada }
}

/**
 * O plano da cobertura e do join da busca com o volume do cenário. A cobertura e a busca da geração são das tarefas 7.0 e seguintes: aqui fica a forma que a Tech Spec dá (§4 e §7c), sobre os índices
 * `secao_do_material (escola_id, material_id, pagina_inicial)` e `habilidade_da_secao (escola_id, codigo)`, que as migrations desta funcionalidade criaram.
 */
async function medirOsPlanos(banco: Consultavel, escolaA: string, disciplinaId: string, serieId: string): Promise<PlanoMedido[]> {
  await banco.query('analyze')
  const cobertura = await medirPlano(
    banco,
    'cobertura da série (seções sem classificação, por material)',
    `select m.id, count(*) as secoes, count(*) filter (where s.classificada_em is null and s.corrigida_em is null) as sem_classificacao
       from material m join material_serie ms on ms.escola_id = m.escola_id and ms.material_id = m.id join secao_do_material s on s.escola_id = m.escola_id and s.material_id = m.id
      where m.escola_id = $1 and ms.serie_id = $2 and m.estado = 'pronto' and m.excluido_em is null group by m.id`,
    [escolaA, serieId],
  )
  const busca = await medirPlano(
    banco,
    'join da busca (trecho → seção da página → habilidades)',
    `select t.pagina, h.codigo from trecho t
       join secao_do_material s on s.escola_id = t.escola_id and s.material_id = t.material_id and t.pagina between s.pagina_inicial and s.pagina_final
       left join habilidade_da_secao h on h.escola_id = s.escola_id and h.secao_id = s.id
      where t.escola_id = $1 and t.disciplina_id = $2 and t.busca @@ plainto_tsquery('portuguese', 'massa molar') order by t.pagina limit 20`,
    [escolaA, disciplinaId],
  )
  return [cobertura, busca]
}

interface Resultado {
  readonly reprovacoes: ReturnType<typeof julgarClassificacao>['reprovacoes']
  readonly k6Reprovou: string[]
}

async function rodarCenario(compose: Compose, pasta: string, doArquivo: Record<string, string>, ambienteDosOps: NodeJS.ProcessEnv, materiais: number): Promise<Resultado> {
  const subida = await compose('up', '--detach', '--build', '--wait')
  if (subida.codigo !== 0) throw new Error('o compose de carga não subiu')
  escrever('\n▶ escolas do cenário')
  const escolas: EscolasDoCenario = await criarEscolasDoCenario(ambienteDosOps)
  const banco = new pg.Client({ connectionString: urlDoBancoDoAmbiente(doArquivo) })
  await banco.connect()
  try {
    await liberarJanelaDaA(banco, escolas.A)
    escrever(`\n▶ ${String(materiais)} apostilas de ${String(SECOES_POR_MATERIAL)} seções na escola A`)
    const { disciplinaId, serieId } = await semearAsApostilas(banco, escolas.A, materiais)
    const arquivoDosTokens = join(pasta, 'tokens.json')

    /** Sessões novas antes de cada fase: o token de acesso vale 10 min. */
    const sessoes = async (fase: string): Promise<void> => {
      escrever(`\n▶ sessões do Tutor da B, fase ${fase}`)
      const tokens = await gerarSessoesDoTutor(ambienteDosOps, escolas.B)
      writeFileSync(arquivoDosTokens, JSON.stringify({ b_tutor: tokens }))
      chmodSync(arquivoDosTokens, 0o644)
      await semearTutorDaB(banco, escolas.B)
    }

    await sessoes('base')
    escrever(`\n▶ k6, fase base (${DURACAO_DA_BASE})`)
    const inicioDaBase = await agoraDoBanco(banco)
    const daBase = await rodarK6(compose, pasta, argumentosDoK6DaClassificacao('base', DURACAO_DA_BASE), 'resumo-base')
    const fimDaBase = await agoraDoBanco(banco)
    const turnoDaBase = await lerTurnoDaB(banco, escolas.B, { inicioMs: inicioDaBase, fimMs: fimDaBase })
    escrever(`p95 do turno do Tutor da B na base: ${turnoDaBase.p95Ms === null ? '-' : `${String(turnoDaBase.p95Ms)} ms`} (${String(turnoDaBase.amostras)} turnos)`)

    await sessoes('lote')
    escrever(`\n▶ job do agendamento da A, e o k6 da B (${DURACAO_DO_K6_DA_INGESTAO}) com o lote andando`)
    const inicioDoLote = await agoraDoBanco(banco)
    const k6 = rodarK6(compose, pasta, argumentosDoK6DaClassificacao('ingestao', DURACAO_DO_K6_DA_INGESTAO, turnoDaBase.p95Ms ?? 0), 'resumo-ingestao')
    await enfileirarAgendamentoDaA(banco, escolas.A)
    const agendamento = await aguardarOAgendamento(banco, escolas.A)
    escrever(`  ${String(agendamento.secoes)} seções em ${String(agendamento.execucoes)} execuções, ${String(agendamento.jobs)} jobs`)
    const acabou = { valor: false }
    const parada = pararOProvedor(banco, compose, escolas.A, agendamento.execucoes, PARADA_DO_PROVEDOR_EM_MINUTOS, acabou)
    escrever('\n▶ espera da classificação')
    let ultimaLinha = 0
    const classificacao = await aguardarClassificacaoDaA(
      banco,
      escolas.A,
      PRAZO_DA_CLASSIFICACAO_MS,
      () => esperar(30_000),
      (lida) => {
        if (Date.now() - ultimaLinha < 5 * 60_000) return
        ultimaLinha = Date.now()
        escrever(`  ${String(lida.concluidas)} concluídas, ${String(lida.pendentes)} pendentes, ${String(lida.falhas)} falhas`)
      },
    )
    acabou.valor = true
    const resultadoDaParada = await parada
    const resultadoDoK6 = await k6
    const turnoNoLote = await lerTurnoDaB(banco, escolas.B, { inicioMs: inicioDoLote, fimMs: inicioDoLote + 3 * 60_000 })
    const planos = await medirOsPlanos(banco, escolas.A, disciplinaId, serieId)
    const medida: MedidaDaClassificacao = {
      configuracao: configuracaoDoCenario(doArquivo),
      agendamento,
      classificacao,
      parada: resultadoDaParada,
      turnoDaBNaBase: turnoDaBase,
      turnoDaBNoLote: turnoNoLote,
      planos,
    }
    const veredito = julgarClassificacao(medida)
    for (const linha of veredito.linhas) escrever(linha)
    return {
      reprovacoes: veredito.reprovacoes,
      k6Reprovou: [...daBase.cruzados.map((c) => `base: ${c}`), ...resultadoDoK6.cruzados.map((c) => `lote: ${c}`)],
    }
  } finally {
    await banco.end().catch(() => undefined)
  }
}

function relatar(resultado: Resultado, inicio: Date, inicioMonotonico: number): number {
  const duracao = Math.round((performance.now() - inicioMonotonico) / 60_000)
  const passou = resultado.reprovacoes.length === 0 && resultado.k6Reprovou.length === 0
  escrever(`\n■ resultado em ${inicio.toISOString()} (${String(duracao)} min): ${passou ? 'passou' : 'reprovou'}`)
  for (const reprovacao of resultado.reprovacoes) escrever(`  reprovado: ${reprovacao.detalhe}`)
  for (const cruzado of resultado.k6Reprovou) escrever(`  k6 reprovou: ${cruzado}`)
  escrever(passou ? '✔ cenário passou' : '✖ cenário reprovou')
  return codigoDeSaidaDaClassificacao(resultado.reprovacoes) === 0 && resultado.k6Reprovou.length === 0 ? 0 : 1
}

/** `--materiais=N`: só para ensaiar o driver. Sem ele, as 300. */
export function materiaisDoArgumento(argumentos: readonly string[]): number {
  const dado = argumentos.find((argumento) => argumento.startsWith('--materiais='))
  const numero = dado === undefined ? TOTAL_DE_MATERIAIS : Number(dado.slice('--materiais='.length))
  if (!Number.isInteger(numero) || numero < 1 || numero > TOTAL_DE_MATERIAIS) throw new Error(`--materiais precisa de um inteiro de 1 a ${String(TOTAL_DE_MATERIAIS)}`)
  return numero
}

async function executar(materiais: number): Promise<number> {
  const pasta = mkdtempSync(join(tmpdir(), 'educa-carga-classificacao-'))
  // O k6 do container roda com outro usuário: ele lê os tokens e grava o resumo nesta pasta. A pasta aberta só serve porque tudo aqui é sintético e sai no fim.
  // Não reaproveite este padrão: pasta `0o777` com token só vale num compose descartável, com sessão sintética, apagada no `finally`; com credencial real ou fora da carga, é arquivo aberto (regra 20, itens 7 e 17).
  chmodSync(pasta, 0o777)
  const doArquivo = lerAmbienteDeCarga()
  exigirAdaptadorFalso(adaptadorDoAmbienteDeCarga(doArquivo))
  const ambiente: NodeJS.ProcessEnv = {
    ...Object.fromEntries(Object.entries(process.env).filter(([chave]) => !(chave in doArquivo))),
    CARGA_PASTA_DA_EXECUCAO: pasta,
    VAGAS_POR_ESCOLA_DESLIGADAS: 'false',
    ...ambienteDoFalsoDoLote(),
  }
  const compose: Compose = (...argumentos) => rodar('docker', [...argumentosDoCompose(), ...argumentos], ambiente)
  const inicio = new Date()
  const inicioMonotonico = performance.now()
  let resultado: Resultado | undefined
  try {
    escrever(`\n▶ cenário "${String(materiais)} apostilas classificadas numa noite" (${String(EXECUCOES_ESPERADAS)} execuções com as 300)`)
    await compose('down', '--volumes', '--remove-orphans')
    resultado = await rodarCenario(compose, pasta, doArquivo, { ...ambiente, ...doArquivo, ...ambienteDoFalsoDoLote(), OPERADOR: OPERADOR_DA_CARGA_DA_CLASSIFICACAO }, materiais)
  } catch (erro) {
    escrever(`\n✖ o cenário não terminou: ${erro instanceof Error ? erro.message : String(erro)}`)
    await compose('logs', '--no-color', '--tail', '100', 'api-1', 'worker-ia-1', 'worker-lote-1', 'despachante-1')
  } finally {
    await compose('down', '--volumes', '--remove-orphans')
    rmSync(pasta, { recursive: true, force: true })
  }
  if (resultado === undefined) return 1
  return relatar(resultado, inicio, inicioMonotonico)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executar(materiaisDoArgumento(process.argv.slice(2)))
}
