import { randomUUID } from 'node:crypto'
import { setTimeout as esperar } from 'node:timers/promises'
import { CHAVES_DE_RETENCAO } from '@educa/shared'
import type pg from 'pg'

/**
 * A fase "expurgo e troca de nome" do cenário de carga "justiça entre escolas" (F3, tarefa 19.0; Tech Spec do F3, seção
 * 7c, última linha; RF5): uma escola, a A, expurga **1 milhão de linhas** e troca um nome, de verdade, pelos jobs do
 * worker de lote (`retencao.expurgar-escola` e o `titular.eliminar` que ele enfileira), enquanto a B usa a fila
 * interativa como no resto do cenário. O k6 mede a espera da B contra a base mais a margem; aqui fica o que o k6 não vê:
 *
 * 1. a semente da A, por SQL, no banco do projeto de carga (dado 100% sintético, com o nome inventado de um titular);
 * 2. o job do expurgo, gravado em `job_registro` como a rotina da noite o grava;
 * 3. a conferência do que saiu e do que ficou, e a leitura do `pg_stat_statements` (cada statement abaixo de 2 s).
 *
 * Fala com o Postgres do projeto de carga e com mais nada: é rotina nossa de teste, sem contexto de requisição, e por isso
 * consulta as tabelas direto, sem repository (regra 10, item 9), só nas escolas sintéticas que o cenário criou.
 */

/** O volume da A, em linhas. Só o teste troca (por um pequeno): o cenário usa `VOLUME_DA_A`. */
export interface VolumeDaA {
  /** `execucao_agente` do Tutor, de 13 meses: anonimizadas por `execucao_agente`, cada uma com a pergunta e a resposta. */
  readonly execucoesDoTutor: number
  /** `consumo_ia` com texto de ferramenta, de 13 meses: esvaziadas por `texto_do_modelo`. */
  readonly consumosComTexto: number
  /** Quantos alunos pediram as execuções do Tutor: o titular é um deles, com algumas centenas de trocas, e não com todas. */
  readonly alunosDoTutor: number
  /** Trocas do titular com o Tutor nos últimos 12 meses (o pacote é de 300 por mês): o que a eliminação dele tem de apagar. */
  readonly trocasRecentesDoTitular: number
  /** Execuções recentes do professor que citam o titular: é o que a troca de nome encontra e troca. */
  readonly execucoesComONome: number
  /** Artefatos recentes do professor que citam o titular. */
  readonly artefatosComONome: number
}

export const VOLUME_DA_A: VolumeDaA = {
  execucoesDoTutor: 250_000,
  consumosComTexto: 250_000,
  alunosDoTutor: 100,
  trocasRecentesDoTitular: 3_600,
  execucoesComONome: 3_000,
  artefatosComONome: 1_000,
}

/** O que o expurgo anonimiza, apaga ou esvazia: a execução, as duas mensagens dela e o consumo. A soma do cenário é o milhão da Tech Spec. */
export function linhasVencidas(volume: VolumeDaA): number {
  return volume.execucoesDoTutor * 3 + volume.consumosComTexto
}
export const LINHAS_VENCIDAS_DA_A = linhasVencidas(VOLUME_DA_A)

/** Nome inventado, sem relação com ninguém: a troca o procura nas colunas de texto livre. */
export const NOME_DO_TITULAR = 'Eliane Carga Sintética'

/** O teto de um statement no Postgres (`BANCO_TIMEOUT_CONSULTA_MS`, `.env.example`): acima dele a instrução é cancelada. */
export const LIMITE_DO_STATEMENT_MS = 2_000
/**
 * O teto da **medida**, abaixo do `statement_timeout`: o statement que passa dos 2 s é cancelado em 2.000 ms e não entra
 * no `max_exec_time` do `pg_stat_statements`, então o máximo medido nunca chega ao teto do banco. Um statement a 1,5 s já
 * está a um quarto do corte, e a primeira tentativa que o corta e a segunda que passa com o cache quente (o executor
 * repete, sem rastro em `job_registro`) é o caso que `contarStatementsCancelados` pega pelo log.
 */
export const TETO_DA_MEDIDA_MS = 1_500
/** Margem declarada sobre a espera da base (PRD, RF18): a mesma de `MARGEM_SOBRE_A_BASE_MS` em infra/k6/justica-entre-escolas.js. */
export const MARGEM_SOBRE_A_BASE_MS = 500
/**
 * Quantos jobs da B precisam ter nascido enquanto a A trabalhava, para a espera deles dizer alguma coisa: o expurgo de
 * um milhão de linhas dura segundos, e a B cria 2 por segundo. Menos que isto, a fase mediu a B parada, e o volume da A
 * tem de crescer.
 */
export const AMOSTRAS_MINIMAS_DA_B = 10
/**
 * O mesmo para os turnos do Tutor da B: o Tutor é limitado a 120 pedidos de IA por minuto por escola
 * (`TETO_DE_PEDIDOS_DE_IA_POR_ESCOLA`), então o cenário manda 1,5 por segundo, e em 9 s de trabalho da A nascem uns 13.
 * Menos que isto e o p95 do turno não diz nada sobre o expurgo.
 */
export const AMOSTRAS_MINIMAS_DO_TURNO = 5
/** As tabelas que o expurgo e a troca de nome tocam: cada uma precisa ter statement no `pg_stat_statements`. */
export const TABELAS_DO_EXPURGO = ['mensagem_tutor', 'execucao_agente', 'consumo_ia', 'pedido_titular', 'expurgo_execucao'] as const

export const TIPO_DO_EXPURGO = 'retencao.expurgar-escola'
export const TIPO_DA_ELIMINACAO = 'titular.eliminar'
/** O mesmo canal de `CANAL_NOTIFICACAO_JOB`: acorda o despachante logo depois do commit. */
const CANAL_DO_JOB = 'job'
/** A fila de lote tem prioridade 3 (`QUEUE_PRIORITY`). */
const PRIORIDADE_DO_LOTE = 3

type Consultavel = Pick<pg.ClientBase, 'query'>

/** Quantas categorias o catálogo tem: o expurgo grava uma linha de `expurgo_execucao` por categoria. */
export const CATEGORIAS_DO_CATALOGO = CHAVES_DE_RETENCAO.length

export interface SementeDaA {
  readonly anoId: string
  readonly alunoId: string
  readonly nome: string
}

/**
 * A escola A deixa de ter horário letivo (`dias_letivos` vazio: escola sem dia letivo, o lote não urgente nunca é
 * segurado), para o expurgo da noite rodar na hora da execução do cenário, e não só depois das 18h. É o mesmo caminho
 * da escola que configurou o dia inteiro fora de aula. Os jobs da A no resto do cenário são urgentes e não se importam.
 */
export async function liberarJanelaDaA(banco: Consultavel, escolaId: string): Promise<void> {
  await banco.query(
    `insert into configuracao_operacional_escola (escola_id, dias_letivos) values ($1, '{}')
     on conflict (escola_id) do update set dias_letivos = '{}'`,
    [escolaId],
  )
}

/**
 * Semeia a A: a estrutura mínima (ano em curso, turma, disciplina, coordenação, professor e o aluno que será o titular),
 * o volume vencido do Tutor, as linhas recentes que citam o aluno, e o pedido de eliminação `agendado` e vencido. Termina
 * com `analyze` e `checkpoint`: o plano do Postgres depende de estatística, e as páginas sujas da carga inicial não podem
 * ser escritas no meio da medição da B.
 */
export async function semearEscolaA(banco: Consultavel, escolaId: string, volume: VolumeDaA = VOLUME_DA_A): Promise<SementeDaA> {
  const um = async (texto: string, valores: unknown[]): Promise<string> => {
    const { rows } = await banco.query<{ id: string }>(texto, valores)
    const id = rows[0]?.id
    if (id === undefined) throw new Error('linha da semente não criada')
    return id
  }
  const pessoaDaEquipe = async (papel: 'coordenador' | 'professor', nome: string): Promise<string> => {
    const contaId = await um('insert into conta (email) values ($1) returning id', [`${papel}-${randomUUID()}@carga.invalid`])
    return um('insert into usuario (escola_id, papel, nome, conta_id) values ($1, $2, $3, $4) returning id', [escolaId, papel, nome, contaId])
  }

  await banco.query('set statement_timeout = 0')
  const anoId = await um("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaId])
  const serieId = await um("insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [escolaId])
  const turmaId = await um("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºB sintética') returning id", [escolaId, anoId, serieId])
  const disciplinaId = await um("insert into disciplina (escola_id, nome) values ($1, 'Matemática') returning id", [escolaId])
  const coordenadoraId = await pessoaDaEquipe('coordenador', 'Coordenação sintética da carga')
  const professorId = await pessoaDaEquipe('professor', 'Professora sintética da carga')
  const alunoId = await um("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', $2) returning id", [escolaId, NOME_DO_TITULAR])

  // Os alunos do Tutor: o titular é o primeiro, e cada um pediu uma fração das execuções (uma escola de verdade não tem um
  // aluno com 250 mil trocas, e a eliminação dele anonimiza só as que ele pediu).
  const { rows: alunos } = await banco.query<{ id: string }>(
    `insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno sintético da carga ' || n from generate_series(1, $2::int - 1) as n returning id`,
    [escolaId, volume.alunosDoTutor],
  )
  const idsDosAlunos = `{${[alunoId, ...alunos.map(({ id }) => id)].join(',')}}`
  // As execuções do Tutor de 13 meses atrás (o padrão é 12), cada uma com a pergunta e a resposta. **Concluídas**, como o Tutor as
  // deixa: com o estado padrão (`pendente`) a varredura da API (`falharInterrompidas`, a cada prazo de execução) tentaria falhar
  // as 250 mil de uma vez, estouraria o `statement_timeout` e mudaria o que a fase mede (achado da rodada 1 da 19.0).
  await banco.query(
    `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, criada_em, estado, iniciada_em, concluida_em, resultado)
     select $1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', ($3::uuid[])[1 + n % $5::int], gen_random_uuid(), '{"tarefa":"turno_do_tutor"}'::jsonb,
            t.criada_em, 'concluida', t.criada_em, t.criada_em + interval '1 second',
            jsonb_build_object('tipo', 'mensagem_do_tutor', 'mensagemId', gen_random_uuid())
       from generate_series(1, $4::int) as n
      cross join lateral (select now() - interval '13 months' - (n % 720) * interval '1 hour' as criada_em) as t`,
    [escolaId, anoId, idsDosAlunos, volume.execucoesDoTutor, volume.alunosDoTutor],
  )
  await banco.query(
    `insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto, criada_em)
     select $1, $2, $3, e.solicitada_por, e.id, autor, 'Mensagem sintética em volume', e.criada_em
       from execucao_agente e cross join (values ('aluno'), ('tutor')) as autores(autor)
      where e.escola_id = $1 and e.funcao = 'tutor_com_o_aluno'`,
    [escolaId, anoId, turmaId],
  )
  await banco.query(
    `insert into consumo_ia (escola_id, aluno_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, entrada, saida, em)
     select $1, null, 'gerar_plano_de_aula', 'conversa_e_ferramentas', 'padrao', 'falso', 'modelo-falso', 'v1', 1, 1, 1, false, 1, 'concluida',
            '{"tema":"Tema sintético"}'::jsonb, '{"texto":"Plano sintético"}'::jsonb, now() - interval '13 months' - (n % 720) * interval '1 hour'
       from generate_series(1, $2::int) as n`,
    [escolaId, volume.consumosComTexto],
  )

  // O ano de uso do titular, que o expurgo não alcança (menos de 12 meses): 300 trocas por mês, com a pergunta e a resposta.
  // É o que a eliminação dele anonimiza e apaga, e o pior caso de uma pessoa só.
  await banco.query(
    `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, criada_em, estado, iniciada_em, concluida_em, resultado)
     select $1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $3, gen_random_uuid(), '{"tarefa":"turno_do_tutor"}'::jsonb,
            t.criada_em, 'concluida', t.criada_em, t.criada_em + interval '1 second',
            jsonb_build_object('tipo', 'mensagem_do_tutor', 'mensagemId', gen_random_uuid())
       from generate_series(1, $4::int) as n
      cross join lateral (select now() - (n % 330) * interval '1 day' as criada_em) as t`,
    [escolaId, anoId, alunoId, volume.trocasRecentesDoTitular],
  )
  await banco.query(
    `insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto, criada_em)
     select $1, $2, $3, $4, e.id, autor, 'Mensagem recente do titular', e.criada_em
       from execucao_agente e cross join (values ('aluno'), ('tutor')) as autores(autor)
      where e.escola_id = $1 and e.solicitada_por = $4 and e.criada_em > now() - interval '12 months'`,
    [escolaId, anoId, turmaId, alunoId],
  )

  // O que cita o titular, recente: o expurgo não o alcança, a troca de nome sim.
  await banco.query(
    `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, estado, iniciada_em, concluida_em, resultado)
     select $1, $2, 'conversa_e_ferramentas', 'gerar_plano_de_aula', $3, gen_random_uuid(),
            jsonb_build_object('tarefa', 'gerar_plano_de_aula', 'parametros', jsonb_build_object('tema', 'Reforço para ' || $4::text)),
            'concluida', now(), now(), jsonb_build_object('tipo', 'artefato', 'artefatoId', gen_random_uuid())
       from generate_series(1, $5::int)`,
    [escolaId, anoId, professorId, NOME_DO_TITULAR, volume.execucoesComONome],
  )
  await banco.query(
    `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por)
     select $1, $2, $3, $4, 'plano_de_aula', 'Reforço para ' || $5::text,
            jsonb_build_object('tipo', 'plano_de_aula', 'titulo', 'Reforço para ' || $5::text), $6
       from generate_series(1, $7::int)`,
    [escolaId, anoId, turmaId, disciplinaId, NOME_DO_TITULAR, professorId, volume.artefatosComONome],
  )

  // O pedido de eliminação do aluno, agendado e vencido: o job do expurgo o enfileira como `titular.eliminar`.
  await banco.query(
    `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, eliminar_em, compartilhamento, registrado_por, chave_envio)
     values ($1, $2, 'aluno', 'eliminacao', 'titular', current_date, 'agendado', now() - interval '1 hour', '[]'::jsonb, $3, $4)`,
    [escolaId, alunoId, coordenadoraId, randomUUID()],
  )
  await banco.query("update usuario set eliminacao_agendada_em = now() - interval '8 days' where id = $1", [alunoId])

  await banco.query('analyze')
  await banco.query('checkpoint')
  return { anoId, alunoId, nome: NOME_DO_TITULAR }
}

/** Grava o job da noite da A, como a rotina o grava: lote, não urgente, com a chave "a data da noite". Devolve o id. */
export async function enfileirarExpurgoDaA(banco: Consultavel, escolaId: string, agora: Date = new Date()): Promise<string> {
  const { rows } = await banco.query<{ id: string }>(
    `insert into job_registro (escola_id, fila, prioridade, tipo, dados, nao_urgente, chave_idempotencia)
     values ($1, 'lote', $2, $3, '{}'::jsonb, true, $4) returning id`,
    [escolaId, PRIORIDADE_DO_LOTE, TIPO_DO_EXPURGO, agora.toISOString().slice(0, 10)],
  )
  await banco.query('select pg_notify($1, $2)', [CANAL_DO_JOB, ''])
  const id = rows[0]?.id
  if (id === undefined) throw new Error('o job do expurgo não foi gravado')
  return id
}

export interface TrabalhoDaA {
  /** Do começo do job do expurgo ao fim do último job da A (o expurgo ou a eliminação): em ms desde a época. */
  readonly inicioMs: number | null
  readonly fimMs: number | null
  readonly expurgos: number
  readonly eliminacoes: number
  readonly falhos: number
  /** Algum job do expurgo ou da eliminação ainda não terminou. */
  readonly emAndamento: number
}

/** Os dois jobs da A (o do expurgo e o `titular.eliminar` que ele enfileira), por estado e por horário. */
export async function lerTrabalhoDaA(banco: Consultavel, escolaId: string): Promise<TrabalhoDaA> {
  const { rows } = await banco.query<Record<string, unknown>>(
    `select count(*) filter (where tipo = $2) as expurgos,
            count(*) filter (where tipo = $3) as eliminacoes,
            count(*) filter (where estado = 'falhou') as falhos,
            count(*) filter (where estado not in ('concluido', 'falhou')) as "emAndamento",
            extract(epoch from min(iniciado_em)) * 1000 as "inicioMs",
            extract(epoch from max(concluido_em)) * 1000 as "fimMs"
       from job_registro
      where escola_id = $1 and tipo in ($2, $3)`,
    [escolaId, TIPO_DO_EXPURGO, TIPO_DA_ELIMINACAO],
  )
  const linha = rows[0] ?? {}
  const talvez = (valor: unknown): number | null => (valor === null || valor === undefined ? null : Math.round(Number(valor)))
  return {
    inicioMs: talvez(linha['inicioMs']),
    fimMs: talvez(linha['fimMs']),
    expurgos: Number(linha['expurgos'] ?? 0),
    eliminacoes: Number(linha['eliminacoes'] ?? 0),
    falhos: Number(linha['falhos'] ?? 0),
    emAndamento: Number(linha['emAndamento'] ?? 0),
  }
}

/** Espera os jobs da A terminarem (concluídos ou falhos), com o expurgo já gravado e a eliminação enfileirada por ele. */
export async function aguardarTrabalhoDaA(banco: Consultavel, escolaId: string, prazoMs: number): Promise<TrabalhoDaA> {
  const limite = Date.now() + prazoMs
  let trabalho = await lerTrabalhoDaA(banco, escolaId)
  while (Date.now() < limite) {
    // A eliminação só existe depois que o job do expurgo a enfileira: sem ela, o trabalho ainda não começou.
    if (trabalho.expurgos > 0 && trabalho.eliminacoes > 0 && trabalho.emAndamento === 0) return trabalho
    if (trabalho.falhos > 0) return trabalho
    await esperar(2_000)
    trabalho = await lerTrabalhoDaA(banco, escolaId)
  }
  return trabalho
}

export interface RestoDaA {
  /** `mensagem_tutor` da A: zero depois do expurgo. */
  readonly mensagensDoTutor: number
  /** Execuções do Tutor ainda com o texto e o aluno, de 12 meses para trás: zero. */
  readonly execucoesPorAnonimizar: number
  /** `consumo_ia` ainda com texto de ferramenta, de 12 meses para trás: zero. */
  readonly consumosComTexto: number
  /** Linhas das colunas da troca que ainda citam o nome: zero. */
  readonly linhasComONome: number
  readonly titularExiste: boolean
  readonly estadoDoPedido: string | null
  /** As categorias cuja última execução terminou, e quantas o catálogo tem. */
  readonly categoriasConcluidas: number
}

export async function lerRestoDaA(banco: Consultavel, escolaId: string, semente: SementeDaA): Promise<RestoDaA> {
  const contagem = async (texto: string, valores: unknown[]): Promise<number> => {
    const { rows } = await banco.query<{ n: string }>(texto, valores)
    return Number(rows[0]?.n ?? 0)
  }
  const padrao = `%${semente.nome}%`
  const linhasComONome =
    (await contagem('select count(*) as n from execucao_agente where escola_id = $1 and entrada::text like $2', [escolaId, padrao])) +
    (await contagem('select count(*) as n from artefato where escola_id = $1 and (titulo like $2 or conteudo::text like $2)', [escolaId, padrao]))
  const { rows: pedido } = await banco.query<{ estado: string }>('select estado from pedido_titular where escola_id = $1 and titular_id = $2', [escolaId, semente.alunoId])
  return {
    mensagensDoTutor: await contagem('select count(*) as n from mensagem_tutor where escola_id = $1', [escolaId]),
    execucoesPorAnonimizar: await contagem(
      "select count(*) as n from execucao_agente where escola_id = $1 and anonimizada_em is null and criada_em < now() - interval '12 months'",
      [escolaId],
    ),
    consumosComTexto: await contagem(
      "select count(*) as n from consumo_ia where escola_id = $1 and (entrada is not null or saida is not null) and em < now() - interval '12 months'",
      [escolaId],
    ),
    linhasComONome,
    titularExiste: (await contagem('select count(*) as n from usuario where escola_id = $1 and id = $2', [escolaId, semente.alunoId])) > 0,
    estadoDoPedido: pedido[0]?.estado ?? null,
    categoriasConcluidas: await contagem(
      `select count(*) as n from (
         select distinct on (categoria) concluida from expurgo_execucao where escola_id = $1 order by categoria, em desc
       ) ultimas where concluida`,
      [escolaId],
    ),
  }
}

/**
 * A espera dos jobs interativos da B criados entre o começo do trabalho da A (o primeiro `iniciado_em` do expurgo) e o fim
 * dele: é a espera que o expurgo e a troca de nome poderiam ter atrasado, e a única que prova alguma coisa, porque o
 * trabalho da A dura segundos e a janela do k6 dura minutos.
 */
export async function lerEsperaDaBNoTrabalho(banco: Consultavel, escolaB: string, trabalho: Pick<TrabalhoDaA, 'inicioMs' | 'fimMs'>): Promise<EsperaDaBNoTrabalho> {
  if (trabalho.inicioMs === null || trabalho.fimMs === null) return { amostras: 0, p95Ms: null, maximaMs: null }
  const { rows } = await banco.query<Record<string, unknown>>(
    `select count(*) as amostras,
            percentile_cont(0.95) within group (order by extract(epoch from iniciado_em - criado_em)::float8 * 1000) as "p95Ms",
            max(extract(epoch from iniciado_em - criado_em)::float8 * 1000) as "maximaMs"
       from job_registro
      where escola_id = $1 and fila = 'interativa' and iniciado_em is not null
        and criado_em between to_timestamp($2::float8 / 1000) and to_timestamp($3::float8 / 1000)`,
    [escolaB, trabalho.inicioMs, trabalho.fimMs],
  )
  const linha = rows[0] ?? {}
  const talvez = (valor: unknown): number | null => (valor === null || valor === undefined ? null : Math.round(Number(valor)))
  return { amostras: Number(linha['amostras'] ?? 0), p95Ms: talvez(linha['p95Ms']), maximaMs: talvez(linha['maximaMs']) }
}

/**
 * A estrutura mínima para os alunos da B usarem o Tutor pela rota: o ano em curso, uma série, uma turma e o vínculo de
 * aluno confirmado de **cada aluno da B que ainda não tem vínculo** (`TurmaDoAluno` exige o vínculo; sem atividade nem
 * material não há mais nada a montar: o Tutor recebe as disciplinas da turma, ou "estudo"). É o que
 * `apps/api/test/escola-assistente.fixture.ts` monta para os testes do Tutor, reduzido ao que o turno lê, e roda de novo a
 * cada fase, porque as sessões sintéticas de cada fase são alunos novos. Devolve quantos vínculos criou.
 */
export async function semearTutorDaB(banco: Consultavel, escolaId: string): Promise<number> {
  const primeiro = async (texto: string, valores: unknown[]): Promise<string | undefined> => (await banco.query<{ id: string }>(texto, valores)).rows[0]?.id
  const obrigatorio = (id: string | undefined): string => {
    if (id === undefined) throw new Error('linha da estrutura do Tutor da B não criada')
    return id
  }
  const anoId =
    (await primeiro("select id from ano_letivo where escola_id = $1 and situacao = 'em_curso' limit 1", [escolaId])) ??
    obrigatorio(
      await primeiro(
        `insert into ano_letivo (escola_id, ano, inicio, fim, situacao)
         values ($1, extract(year from now())::int, make_date(extract(year from now())::int, 2, 1), make_date(extract(year from now())::int, 12, 15), 'em_curso') returning id`,
        [escolaId],
      ),
    )
  let turmaId = await primeiro('select id from turma where escola_id = $1 and ano_letivo_id = $2 limit 1', [escolaId, anoId])
  if (turmaId === undefined) {
    const serieId = obrigatorio(await primeiro("insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [escolaId]))
    turmaId = obrigatorio(await primeiro("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºB sintética do Tutor') returning id", [escolaId, anoId, serieId]))
  }
  let autorId = await primeiro("select id from usuario where escola_id = $1 and papel in ('coordenador', 'professor') limit 1", [escolaId])
  if (autorId === undefined) {
    const contaId = obrigatorio(await primeiro('insert into conta (email) values ($1) returning id', [`coordenador-${randomUUID()}@carga.invalid`]))
    autorId = obrigatorio(await primeiro("insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'coordenador', 'Coordenação sintética da carga', $2) returning id", [escolaId, contaId]))
  }
  const { rowCount } = await banco.query(
    `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em)
     select $1, $2, u.id, $3, 'aluno', 'confirmado', $4, now()
       from usuario u
      where u.escola_id = $1 and u.papel = 'aluno'
        and not exists (select 1 from vinculo v where v.escola_id = u.escola_id and v.ano_letivo_id = $2 and v.usuario_id = u.id)`,
    [escolaId, anoId, turmaId, autorId],
  )
  return rowCount ?? 0
}

/**
 * O turno do Tutor da B nas execuções criadas entre `inicioMs` e `fimMs`, só as concluídas: de `criada_em` (a rota gravou a
 * pergunta e a execução) a `concluida_em` (a resposta do modelo, conferida e gravada). É o tempo que o aluno espera, sem o
 * polling do k6. Só a B (`escola_id`), só o Tutor (`funcao`), só a janela: é o que prova que o turno é da B e da hora certa.
 */
export async function lerTurnoDaBNaJanela(banco: Consultavel, escolaB: string, janela: { inicioMs: number | null; fimMs: number | null }): Promise<EsperaDaBNoTrabalho> {
  if (janela.inicioMs === null || janela.fimMs === null) return { amostras: 0, p95Ms: null, maximaMs: null }
  const { rows } = await banco.query<Record<string, unknown>>(
    `select count(*) as amostras,
            percentile_cont(0.95) within group (order by extract(epoch from concluida_em - criada_em)::float8 * 1000) as "p95Ms",
            max(extract(epoch from concluida_em - criada_em)::float8 * 1000) as "maximaMs"
       from execucao_agente
      where escola_id = $1 and funcao = 'tutor_com_o_aluno' and estado = 'concluida'
        and criada_em between to_timestamp($2::float8 / 1000) and to_timestamp($3::float8 / 1000)`,
    [escolaB, janela.inicioMs, janela.fimMs],
  )
  const linha = rows[0] ?? {}
  const talvez = (valor: unknown): number | null => (valor === null || valor === undefined ? null : Math.round(Number(valor)))
  return { amostras: Number(linha['amostras'] ?? 0), p95Ms: talvez(linha['p95Ms']), maximaMs: talvez(linha['maximaMs']) }
}

/** O relógio do Postgres do cenário, em ms desde a época: as janelas da fase usam o mesmo relógio que grava `criada_em`. */
export async function agoraDoBanco(banco: Consultavel): Promise<number> {
  const { rows } = await banco.query<{ ms: string }>('select (extract(epoch from clock_timestamp()) * 1000)::bigint as ms')
  return Number(rows[0]?.ms ?? Date.now())
}

/**
 * Quantas vezes o Postgres cortou um statement pelo `statement_timeout` no log dado. O worker roda com o teto de 2 s e o
 * executor repete o job que falha: a tentativa cortada não deixa rastro em `job_registro` nem no `max_exec_time`, e a
 * repetição passa com o cache quente. O Postgres registra o corte como erro, sem configuração nova, e a mensagem não leva dado.
 */
export function contarStatementsCancelados(log: string): number {
  return (log.match(/canceling statement due to statement timeout/g) ?? []).length
}

/**
 * A forma de cada statement cortado pelo `statement_timeout` no log: o `STATEMENT:` que o Postgres escreve logo depois do erro,
 * cortado em 160 caracteres (como `lerStatements`), para a saída dizer **qual** foi cortado. Só o texto do statement, que o
 * projeto de carga roda com dado sintético; sem a linha seguinte, a forma é "sem o texto do statement".
 */
export function formasDosStatementsCancelados(log: string): string[] {
  const linhas = log.split('\n')
  const formas: string[] = []
  linhas.forEach((linha, indice) => {
    if (!linha.includes('canceling statement due to statement timeout')) return
    const seguinte = linhas.slice(indice + 1, indice + 4).find((candidata) => /STATEMENT:\s/.test(candidata))
    const texto = seguinte?.replace(/^.*STATEMENT:\s+/, '').replace(/\s+/g, ' ').trim()
    formas.push(texto === undefined || texto === '' ? 'sem o texto do statement' : texto.length > 160 ? `${texto.slice(0, 160)}…` : texto)
  })
  return formas
}

export interface StatementMedido {
  /** O texto normalizado do `pg_stat_statements`, cortado: sem valor, só a forma do statement. */
  readonly forma: string
  readonly chamadas: number
  readonly maximoMs: number
  readonly mediaMs: number
}

export interface MedicaoDeStatements {
  /** Quantos statements o `pg_stat_statements` viu depois do `reset`, fora os do próprio comando. */
  readonly total: number
  /** Os mais lentos pelo máximo, do pior para o melhor. */
  readonly piores: readonly StatementMedido[]
  /** As tabelas do expurgo que apareceram em ao menos um statement. */
  readonly tabelasVistas: readonly string[]
}

/** Zera o `pg_stat_statements`: a medição da fase começa agora, e o que a semente fez fica de fora. */
export async function prepararMedicaoDeStatements(banco: Consultavel): Promise<void> {
  await banco.query('create extension if not exists pg_stat_statements')
  await banco.query('select pg_stat_statements_reset()')
}

/** Lê os statements da fase: os cinco mais lentos pelo máximo, e as tabelas do expurgo que a amostra cobre. */
export async function lerStatements(banco: Consultavel): Promise<MedicaoDeStatements> {
  const filtro = `dbid = (select oid from pg_database where datname = current_database())
                  and query not ilike '%pg_stat_statements%' and query not ilike 'analyze%' and query not ilike 'checkpoint%'
                  and query not ilike 'set statement_timeout%'`
  const { rows: piores } = await banco.query<{ forma: string; chamadas: string; maximoMs: number; mediaMs: number }>(
    `select left(regexp_replace(query, '\\s+', ' ', 'g'), 160) as forma, calls as chamadas, max_exec_time as "maximoMs", mean_exec_time as "mediaMs"
       from pg_stat_statements where ${filtro} order by max_exec_time desc limit 5`,
  )
  const { rows: total } = await banco.query<{ n: string }>(`select count(*) as n from pg_stat_statements where ${filtro}`)
  const tabelasVistas: string[] = []
  for (const tabela of TABELAS_DO_EXPURGO) {
    const { rows } = await banco.query<{ n: string }>(`select count(*) as n from pg_stat_statements where ${filtro} and calls > 0 and query ~* $1`, [`\\m${tabela}\\M`])
    if (Number(rows[0]?.n ?? 0) > 0) tabelasVistas.push(tabela)
  }
  return {
    total: Number(total[0]?.n ?? 0),
    piores: piores.map((linha) => ({ forma: linha.forma, chamadas: Number(linha.chamadas), maximoMs: Number(linha.maximoMs), mediaMs: Number(linha.mediaMs) })),
    tabelasVistas,
  }
}

/** A espera dos jobs da B que nasceram enquanto a A trabalhava (`criado_em` entre o começo e o fim do trabalho da A). */
export interface EsperaDaBNoTrabalho {
  readonly amostras: number
  readonly p95Ms: number | null
  readonly maximaMs: number | null
}

/** Tudo o que a fase leu do banco, para o veredito. `undefined` em `statements` é o `pg_stat_statements` que não respondeu. */
export interface ResultadoDoExpurgo {
  readonly volumeVencidoAntes: number
  readonly trabalho: TrabalhoDaA
  readonly resto: RestoDaA
  readonly statements: MedicaoDeStatements | undefined
  readonly esperaDaB: EsperaDaBNoTrabalho
  /** O p95 da espera da B na fase `base`, em ms: com a margem, é o teto da espera da B durante o trabalho da A. */
  readonly esperaBaseP95Ms: number
  /** Os turnos do Tutor da B (`execucao_agente`, de `criada_em` a `concluida_em`) criados durante o trabalho da A. */
  readonly turnoDaB: EsperaDaBNoTrabalho
  /** O p95 do mesmo turno na fase `base`, em ms: com a margem, é o teto do turno da B durante o trabalho da A. */
  readonly turnoBaseP95Ms: number
  /**
   * Quantos statements o Postgres cancelou pelo `statement_timeout` durante a fase (o log do Postgres do projeto de carga).
   * `undefined` é o log que não se conseguiu ler: sem ele não se sabe, e a fase reprova.
   */
  readonly statementsCancelados: number | undefined
  /** A forma de cada um deles, do log (`formasDosStatementsCancelados`): para a saída dizer qual lote cortou. */
  readonly formasDosCancelados?: readonly string[]
}

export interface ReprovacaoDoExpurgo {
  criterio: string
  detalhe: string
}

/**
 * O veredito do que o banco diz da fase. Cada critério existe para uma coisa que o k6 sozinho deixaria passar:
 *
 * - `expurgo_incompleto`: o que venceu ainda está lá, ou o pedido não concluiu, ou alguma categoria não terminou;
 * - `troca_de_nome_incompleta`: o nome ainda aparece, ou o titular ainda existe;
 * - `job_da_a`: um job falhou, não terminou, ou o expurgo nem enfileirou a eliminação;
 * - `statement_acima_de_2s`: o máximo de um statement passou do teto do banco;
 * - `statements_sem_amostra`: o `pg_stat_statements` não viu as tabelas do expurgo, e a medição seria vazia;
 * - `sem_amostra_da_b`: menos de `AMOSTRAS_MINIMAS_DA_B` jobs da B nasceram enquanto a A trabalhava, e a espera dela
 *   comparada com a base não diria nada sobre o expurgo;
 * - `espera_b_no_expurgo`: o p95 da espera da B **durante o trabalho da A** passou da base mais a margem. É a mesma regra
 *   do k6 (`espera_b`), aplicada só à janela em que o expurgo rodava: o trabalho dura segundos, e o p95 dos dois minutos
 *   do k6 o diluiria;
 * - `turno_b_no_expurgo`: o mesmo para o turno do Tutor da B (`POST /v1/tutor/mensagens` até a execução concluída), que
 *   lê e grava `execucao_agente`, `mensagem_tutor` e `consumo_ia`, as tabelas que o expurgo da A atualiza em lote. Sem
 *   `AMOSTRAS_MINIMAS_DO_TURNO` turnos na janela, é `sem_amostra_da_b`;
 * - `statement_acima_de_2s` também é o statement **cancelado** pelo `statement_timeout`: ele não chega ao
 *   `max_exec_time`, e o log do Postgres é a única prova (`contarStatementsCancelados`).
 */
export function julgarResultadoDoExpurgo(resultado: ResultadoDoExpurgo): ReprovacaoDoExpurgo[] {
  const reprovacoes: ReprovacaoDoExpurgo[] = []
  const { trabalho, resto, statements } = resultado

  if (trabalho.falhos > 0) reprovacoes.push({ criterio: 'job_da_a', detalhe: `expurgo: ${trabalho.falhos} job(s) da escola A falharam` })
  else if (trabalho.expurgos === 0) reprovacoes.push({ criterio: 'job_da_a', detalhe: 'expurgo: o job do expurgo da escola A não existe' })
  else if (trabalho.eliminacoes === 0) reprovacoes.push({ criterio: 'job_da_a', detalhe: 'expurgo: o expurgo não enfileirou a eliminação do titular' })
  else if (trabalho.emAndamento > 0) reprovacoes.push({ criterio: 'job_da_a', detalhe: `expurgo: ${trabalho.emAndamento} job(s) da escola A não terminaram no prazo` })

  const sobrando = [
    resto.mensagensDoTutor > 0 ? `${resto.mensagensDoTutor} mensagem(ns) do Tutor` : undefined,
    resto.execucoesPorAnonimizar > 0 ? `${resto.execucoesPorAnonimizar} execução(ões) sem anonimizar` : undefined,
    resto.consumosComTexto > 0 ? `${resto.consumosComTexto} consumo(s) com texto` : undefined,
    resto.estadoDoPedido !== 'concluido' ? `pedido ${resto.estadoDoPedido ?? 'ausente'}` : undefined,
    resto.categoriasConcluidas < CATEGORIAS_DO_CATALOGO ? `${resto.categoriasConcluidas} de ${CATEGORIAS_DO_CATALOGO} categorias concluídas` : undefined,
  ].filter((motivo): motivo is string => motivo !== undefined)
  if (sobrando.length > 0) reprovacoes.push({ criterio: 'expurgo_incompleto', detalhe: `expurgo: ficou ${sobrando.join(', ')}` })

  if (resto.linhasComONome > 0 || resto.titularExiste) {
    const motivos = [resto.linhasComONome > 0 ? `${resto.linhasComONome} linha(s) com o nome` : undefined, resto.titularExiste ? 'o titular ainda existe' : undefined]
    reprovacoes.push({ criterio: 'troca_de_nome_incompleta', detalhe: `expurgo: ${motivos.filter((motivo) => motivo !== undefined).join(', ')}` })
  }

  if (statements === undefined || statements.total === 0) {
    reprovacoes.push({ criterio: 'statements_sem_amostra', detalhe: 'expurgo: o pg_stat_statements não mediu nenhum statement' })
  } else {
    const ausentes = TABELAS_DO_EXPURGO.filter((tabela) => !statements.tabelasVistas.includes(tabela))
    if (ausentes.length > 0) reprovacoes.push({ criterio: 'statements_sem_amostra', detalhe: `expurgo: sem statement medido em ${ausentes.join(', ')}` })
    const lentos = statements.piores.filter((statement) => statement.maximoMs >= TETO_DA_MEDIDA_MS)
    for (const lento of lentos) {
      reprovacoes.push({
        criterio: 'statement_acima_de_2s',
        detalhe: `expurgo: statement de ${Math.round(lento.maximoMs)} ms, acima de ${TETO_DA_MEDIDA_MS} ms da medida (o corte do banco é ${LIMITE_DO_STATEMENT_MS} ms) (${lento.chamadas} chamadas): ${lento.forma}`,
      })
    }
  }

  // O statement cortado em 2 s não entra no `max_exec_time`, e o executor repete o job: só o log do Postgres o mostra.
  const { statementsCancelados } = resultado
  if (statementsCancelados === undefined) {
    reprovacoes.push({ criterio: 'statements_sem_amostra', detalhe: 'expurgo: o log do Postgres não foi lido, e não se sabe se algum statement foi cancelado' })
  } else if (statementsCancelados > 0) {
    reprovacoes.push({
      criterio: 'statement_acima_de_2s',
      detalhe: `expurgo: ${statementsCancelados} statement(s) cancelado(s) pelo statement_timeout durante a fase${
        resultado.formasDosCancelados === undefined || resultado.formasDosCancelados.length === 0 ? '' : `: ${resultado.formasDosCancelados.join(' | ')}`
      }`,
    })
  }

  const { esperaDaB } = resultado
  if (esperaDaB.amostras < AMOSTRAS_MINIMAS_DA_B) {
    reprovacoes.push({ criterio: 'sem_amostra_da_b', detalhe: `expurgo: só ${esperaDaB.amostras} job(s) da B nasceram durante o trabalho da A (mínimo ${AMOSTRAS_MINIMAS_DA_B})` })
  } else {
    const limite = Math.ceil(resultado.esperaBaseP95Ms) + MARGEM_SOBRE_A_BASE_MS
    if (esperaDaB.p95Ms === null || esperaDaB.p95Ms > limite) {
      reprovacoes.push({ criterio: 'espera_b_no_expurgo', detalhe: `expurgo: p95 da espera da B durante o trabalho da A em ${esperaDaB.p95Ms ?? '-'} ms, acima de ${limite} ms (base + margem)` })
    }
  }

  // O turno do Tutor da B, que lê e grava as tabelas que o expurgo da A atualiza em lote: é o que a aula sente.
  const { turnoDaB } = resultado
  if (turnoDaB.amostras < AMOSTRAS_MINIMAS_DO_TURNO) {
    reprovacoes.push({ criterio: 'sem_amostra_da_b', detalhe: `expurgo: só ${turnoDaB.amostras} turno(s) do Tutor da B concluíram durante o trabalho da A (mínimo ${AMOSTRAS_MINIMAS_DO_TURNO})` })
  } else {
    const limite = Math.ceil(resultado.turnoBaseP95Ms) + MARGEM_SOBRE_A_BASE_MS
    if (turnoDaB.p95Ms === null || turnoDaB.p95Ms > limite) {
      reprovacoes.push({ criterio: 'turno_b_no_expurgo', detalhe: `expurgo: p95 do turno do Tutor da B durante o trabalho da A em ${turnoDaB.p95Ms ?? '-'} ms, acima de ${limite} ms (base + margem)` })
    }
  }
  return reprovacoes
}

/** Uma linha medida da escrita a mais dos índices parciais de anonimização, por inserção de uma linha de turno do Tutor. */
export interface EscritaDosIndices {
  readonly tabela: 'execucao_agente' | 'consumo_ia'
  readonly indices: readonly string[]
  readonly linhas: number
  /** Microssegundos por linha inserida, com os índices e sem eles, na mesma transação, com o cache já quente. */
  readonly comIndicesUs: number
  readonly semIndicesUs: number
}

/** Linhas de cada inserção medida. */
export const LINHAS_DA_MEDIDA_DOS_INDICES = 20_000

/**
 * Mede a escrita a mais que os índices parciais da anonimização (F3, tarefa 4.0: `execucao_agente_a_anonimizar_idx`,
 * `execucao_agente_do_tutor_a_anonimizar_idx` e `consumo_ia_aluno_a_anular_idx`) põem em cada turno do Tutor: insere
 * `linhas` linhas de Tutor de um aluno da A, uma vez para aquecer o cache e outra para medir, depois
 * apaga os índices **na própria transação** e mede de novo. Tudo termina em `rollback`: nada fica, nem os índices.
 *
 * Roda com o banco parado (entre as fases), porque o `drop index` toma a trava exclusiva da tabela até o `rollback`. O número
 * é informativo: a Tech Spec não declara limite, e quem decide se o custo por turno importa é quem lê (`TODO.md`, "Escrita a
 * mais por troca do Tutor").
 */
export async function medirEscritaDosIndices(banco: Consultavel, escolaId: string, anoId: string, linhas: number = LINHAS_DA_MEDIDA_DOS_INDICES): Promise<EscritaDosIndices[]> {
  const { rows } = await banco.query<{ id: string }>("select id from usuario where escola_id = $1 and papel = 'aluno' limit 1", [escolaId])
  const alunoId = rows[0]?.id
  if (alunoId === undefined) throw new Error('a escola A não tem aluno para a medida dos índices')
  const medidas: Array<{ tabela: EscritaDosIndices['tabela']; indices: string[]; inserir: string; valores: unknown[] }> = [
    {
      tabela: 'execucao_agente',
      indices: ['execucao_agente_a_anonimizar_idx', 'execucao_agente_do_tutor_a_anonimizar_idx'],
      inserir: `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada)
                select $1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $3, gen_random_uuid(), '{"tarefa":"turno_do_tutor"}'::jsonb from generate_series(1, $4::int)`,
      valores: [escolaId, anoId, alunoId, linhas],
    },
    {
      tabela: 'consumo_ia',
      indices: ['consumo_ia_aluno_a_anular_idx'],
      inserir: `insert into consumo_ia (escola_id, aluno_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, em)
                select $1, $2, 'turno_do_tutor', 'tutor_com_o_aluno', 'padrao', 'falso', 'modelo-falso', 'v1', 1, 1, 1, false, 1, 'concluida', now() from generate_series(1, $3::int)`,
      valores: [escolaId, alunoId, linhas],
    },
  ]
  const resultado: EscritaDosIndices[] = []
  for (const medida of medidas) {
    const inserir = async (): Promise<number> => {
      const inicio = performance.now()
      await banco.query(medida.inserir, medida.valores)
      return ((performance.now() - inicio) * 1_000) / linhas
    }
    await banco.query('begin')
    try {
      // O `drop index` toma a trava exclusiva da tabela: com a sessão sem `statement_timeout` (a semente o zera), ele
      // esperaria sem fim atrás de qualquer transação aberta (regra 80, item 3).
      await banco.query("set local lock_timeout = '5s'")
      await inserir()
      const comIndicesUs = await inserir()
      for (const indice of medida.indices) await banco.query(`drop index ${indice}`)
      const semIndicesUs = await inserir()
      resultado.push({ tabela: medida.tabela, indices: medida.indices, linhas, comIndicesUs, semIndicesUs })
    } finally {
      await banco.query('rollback')
    }
  }
  return resultado
}

/** O que a fase imprime no resultado da execução, uma linha por item. */
export function descreverExpurgo(resultado: ResultadoDoExpurgo, escrita: readonly EscritaDosIndices[] = []): string[] {
  const { trabalho, resto, statements, esperaDaB } = resultado
  const duracao = trabalho.inicioMs !== null && trabalho.fimMs !== null ? `${((trabalho.fimMs - trabalho.inicioMs) / 1_000).toFixed(1)} s` : '-'
  const ms = (valor: number | null) => (valor === null ? '-' : `${valor} ms`)
  return [
    `expurgo da escola A: ${resultado.volumeVencidoAntes} linhas vencidas, trabalho de ${duracao}`,
    `  espera da B durante o trabalho: ${esperaDaB.amostras} jobs, p95 ${ms(esperaDaB.p95Ms)}, máxima ${ms(esperaDaB.maximaMs)} (base ${Math.round(resultado.esperaBaseP95Ms)} ms + margem ${MARGEM_SOBRE_A_BASE_MS} ms)`,
    `  ficou: ${resto.mensagensDoTutor} mensagens, ${resto.execucoesPorAnonimizar} execuções, ${resto.consumosComTexto} consumos, ${resto.linhasComONome} linhas com o nome; pedido ${resto.estadoDoPedido ?? 'ausente'}; ${resto.categoriasConcluidas} de ${CATEGORIAS_DO_CATALOGO} categorias concluídas`,
    `  turno do Tutor da B durante o trabalho: ${resultado.turnoDaB.amostras} turnos, p95 ${ms(resultado.turnoDaB.p95Ms)}, máxima ${ms(resultado.turnoDaB.maximaMs)} (base ${Math.round(resultado.turnoBaseP95Ms)} ms + margem ${MARGEM_SOBRE_A_BASE_MS} ms)`,
    `  statements cancelados pelo statement_timeout: ${resultado.statementsCancelados ?? 'log não lido'}`,
    ...(resultado.formasDosCancelados ?? []).map((forma) => `    cancelado: ${forma}`),
    ...(statements === undefined
      ? ['  statements: o pg_stat_statements não respondeu']
      : [
          `  statements: ${statements.total} medidos, tabelas vistas: ${statements.tabelasVistas.join(', ') || '-'}`,
          ...statements.piores.map((statement) => `  ${Math.round(statement.maximoMs)} ms máx., ${Math.round(statement.mediaMs)} ms médio, ${statement.chamadas} chamadas: ${statement.forma}`),
        ]),
    ...escrita.map(
      (medida) =>
        `  escrita a mais dos índices de anonimização em ${medida.tabela} (${medida.indices.length}): ${Math.round(medida.comIndicesUs)} µs por linha com, ${Math.round(medida.semIndicesUs)} µs sem, ` +
        `${Math.round(medida.comIndicesUs - medida.semIndicesUs)} µs a mais por turno do Tutor`,
    ),
  ]
}
