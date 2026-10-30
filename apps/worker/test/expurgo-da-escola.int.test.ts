import 'reflect-metadata'
import {
  InMemoryFileStorage,
  ArquivoDoTitularRepository,
  CATEGORIAS_DO_EXPURGO,
  OperationalSettings,
  currentContext,
  OperationalSettingsRepository,
  CronEscolasRepository,
  runInContext,
  ExpurgoDaEscolaRepository,
  expurgoDeactivatedPeopleStatement,
  expurgoSchoolBatchStatement,
  expurgoRecordStatement,
  LIMITE_DE_ELIMINACOES_ENFILEIRADAS_POR_NOITE,
  LOTE_DO_EXPURGO,
  resolverJanela,
  RetencaoDaEscolaRepository,
  type AlvoDoExpurgoDaEscola,
  type FileStorage,
  type CategoriaDoExpurgo,
  type JanelaLetiva,
  type PrazoDoLote,
  type Clock,
} from '@educa/nucleo'
import { AUTOR_DA_ROTINA, CATEGORIAS_DE_RETENCAO, CHAVES_DE_RETENCAO, JobFailureCode, TIPO_EXPURGAR_ESCOLA } from '@educa/shared'
import { PgDialect } from 'drizzle-orm/pg-core'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { esperarNaTrava, GatilhoDeParada } from '../../api/test/gatilho-de-parada.js'
import type { ConfiguracaoStorage } from '../src/config.js'
import type { Processador } from '../src/executor.js'
import { MedicaoDoExpurgo } from '../src/medicao-do-expurgo.js'
import { GovernancaRepository } from '../../api/src/governanca/governanca.repository.js'
import { montarWorker } from '../src/montagem.js'
import { chaveDaNoite, criarRotinaDeExpurgo } from '../src/processadores/expurgar-dado-pessoal.js'
import { criarExpurgoDaEscola } from '../src/processadores/expurgar-escola.js'
import { BancadaDeFila, configuracaoDoBanco, janelaPadraoDoAmbiente, LogEmMemoria, urlRedisDeFila, vagasPadraoDoAmbiente } from './fila-de-teste.js'
import { execucaoDoJob } from './execucao-do-job.js'

// O expurgo noturno da escola (F3, tarefas 3.0 a 5.0), contra o Postgres do compose de teste: a conversa do Tutor, os
// sinais e a conversa do professor, que saem; a execução de agente, o texto do modelo, o consumo por aluno e a autoria
// de artefato, que ficam sem a pessoa; e o trabalho do aluno, a reivindicação decidida, o material excluído, o vínculo
// encerrado e a pessoa desativada, que saem pelo ciclo de vida, de escolas sintéticas, dos dois lados de cada prazo,
// contados de um relógio injetado. A escola
// usa o horário letivo padrão (São Paulo, de segunda a sexta, das 7h às 18h): quarta, 7/10/2026, à 1h está fora da
// janela, e às 8h, dentro.

const ambiente = lerAmbienteDeTeste()
const STORAGE: ConfiguracaoStorage = {
  url: `http://127.0.0.1:${valorObrigatorio(ambiente, 'STORAGE_PORTA_HOST')}`,
  regiao: valorObrigatorio(ambiente, 'STORAGE_REGIAO'),
  bucket: valorObrigatorio(ambiente, 'STORAGE_BUCKET'),
  chaveAcesso: valorObrigatorio(ambiente, 'STORAGE_CHAVE_ACESSO'),
  chaveSecreta: valorObrigatorio(ambiente, 'STORAGE_CHAVE_SECRETA'),
}

const QUARTA_1H = new Date('2026-10-07T01:00:00-03:00')
const QUARTA_8H = new Date('2026-10-07T08:00:00-03:00')
const QUINTA_1H = new Date('2026-10-08T01:00:00-03:00')
/** O fuso do horário letivo padrão do teste, que o job passa ao lote. */
const FUSO = 'America/Sao_Paulo'

/** Um relógio que o teste avança. */
function relogioEm(inicio: Date): Clock & { atual: Date } {
  const relogio = { atual: inicio, agora: () => relogio.atual }
  return relogio
}

/** As chaves que uma linha de log desta tarefa pode ter: as do logger e as contagens. Nunca texto de pessoa. */
const CHAVES_DO_LOG = new Set([
  'level',
  'time',
  'servico',
  'requisicaoId',
  'escolaId',
  'evento',
  'tipo',
  'linhasDaCategoriaTotal',
  'linhasTotal',
  'registroApagadoTotal',
  'arquivosApagadosTotal',
  'arquivosNaoApagadosTotal',
  'eliminacoesTotal',
  'eliminacoesJaEnfileiradasTotal',
  'categoriasTotal',
  'escolasTotal',
  'enfileiradosTotal',
  'jaEnfileiradosTotal',
  'falhasTotal',
  'erro',
])

beforeAll(() => {
  // Worker do compose de pé poderia executar o job de expurgo que o teste grava, e apagar no meio da contagem.
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('retencao.expurgar-escola e sistema.expurgar-dado-pessoal', () => {
  const bancada = new BancadaDeFila()
  const log = new LogEmMemoria('worker-teste')
  const escolas: string[] = []

  afterAll(async () => {
    await bancada.pool.query('delete from job_registro where escola_id = any($1::uuid[])', [escolas])
    await bancada.fechar()
  })

  /** Uma escola nova, com ano em curso, série, turma, aluno e o primeiro professor. */
  async function escolaNova(): Promise<{ escolaId: string; anoId: string; turmaId: string; alunoId: string }> {
    const escolaId = await bancada.escola()
    escolas.push(escolaId)
    const um = async (texto: string, valores: unknown[]): Promise<string> => {
      const { rows } = await bancada.pool.query<{ id: string }>(texto, valores)
      const id = rows[0]?.id
      if (id === undefined) throw new Error('linha de teste não criada')
      return id
    }
    const anoId = await um("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaId])
    const serieId = await um("insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [escolaId])
    const turmaId = await um("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºB sintética') returning id", [escolaId, anoId, serieId])
    const alunoId = await um("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', 'Aluno sintético do expurgo') returning id", [escolaId])
    return { escolaId, anoId, turmaId, alunoId }
  }
  type Escola = Awaited<ReturnType<typeof escolaNova>>

  /** Uma execução pendente da escola, que a mensagem e o sinal apontam. */
  async function execucao(escola: Escola, tarefa: 'turno_do_tutor' | 'propor_ferramenta', solicitadaPor: string): Promise<string> {
    const funcao = tarefa === 'turno_do_tutor' ? 'tutor_com_o_aluno' : 'conversa_e_ferramentas'
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [escola.escolaId, escola.anoId, funcao, tarefa, solicitadaPor, randomUUID(), JSON.stringify({ tarefa })],
    )
    return rows[0]?.id ?? ''
  }

  async function mensagemTutor(escola: Escola, agora: Date, ha: string): Promise<string> {
    const execucaoId = await execucao(escola, 'turno_do_tutor', escola.alunoId)
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto, criada_em)
       values ($1, $2, $3, $4, $5, 'aluno', 'Pergunta sintética do expurgo', $6::timestamptz - $7::interval) returning id`,
      [escola.escolaId, escola.anoId, escola.turmaId, escola.alunoId, execucaoId, agora.toISOString(), ha],
    )
    return rows[0]?.id ?? ''
  }

  async function sinal(escola: Escola, agora: Date, ha: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into sinal_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, tipo, criado_em) values ($1, $2, $3, $4, 'travou', $5::timestamptz - $6::interval) returning id`,
      [escola.escolaId, escola.anoId, escola.turmaId, escola.alunoId, agora.toISOString(), ha],
    )
    return rows[0]?.id ?? ''
  }

  /** A thread de um professor novo com o Assistente, criada `criadaHa` antes do `agora`. */
  async function thread(escola: Escola, agora: Date, criadaHa: string): Promise<{ threadId: string; professorId: string }> {
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`professora-${randomUUID()}@expurgo.invalid`])
    const { rows: professores } = await bancada.pool.query<{ id: string }>(
      "insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'professor', 'Professora sintética', $2) returning id",
      [escola.escolaId, contas[0]?.id],
    )
    const professorId = professores[0]?.id ?? ''
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into thread_agente (escola_id, ano_letivo_id, usuario_id, agente, criada_em) values ($1, $2, $3, 'assistente_de_ensino', $4::timestamptz - $5::interval) returning id`,
      [escola.escolaId, escola.anoId, professorId, agora.toISOString(), criadaHa],
    )
    return { threadId: rows[0]?.id ?? '', professorId }
  }

  async function mensagemAgente(escola: Escola, alvo: { threadId: string; professorId: string }, agora: Date, ha: string): Promise<string> {
    const execucaoId = await execucao(escola, 'propor_ferramenta', alvo.professorId)
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into mensagem_agente (escola_id, ano_letivo_id, thread_id, execucao_id, autor, conteudo, criada_em)
       values ($1, $2, $3, $4, 'agente', '{"tipo":"texto","texto":"Resposta sintética do expurgo"}', $5::timestamptz - $6::interval) returning id`,
      [escola.escolaId, escola.anoId, alvo.threadId, execucaoId, agora.toISOString(), ha],
    )
    return rows[0]?.id ?? ''
  }

  /** Um professor novo da escola, com conta. */
  async function professorNovo(escola: { escolaId: string }): Promise<string> {
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`professor-${randomUUID()}@expurgo.invalid`])
    const { rows } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'professor', 'Professor sintético', $2) returning id", [
      escola.escolaId,
      contas[0]?.id,
    ])
    return rows[0]?.id ?? ''
  }

  /** O tema que o professor escreveu no pedido: é texto livre dele, e é o que a anonimização tira. */
  const TEMA = 'Frações com a turma da Ana Sintética'

  /**
   * Uma execução de ferramenta do professor, criada `ha` antes do `agora`, com o tema na `entrada`, no estado pedido (cada
   * um com o que os checks da 0022 exigem dele).
   */
  async function execucaoComTema(escola: Escola, agora: Date, ha: string, estado: 'pendente' | 'rodando' | 'concluida' | 'falhou' = 'concluida', solicitadaPor?: string): Promise<string> {
    const quem = solicitadaPor ?? (await professorNovo(escola))
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, estado, entrada, resultado, erro, criada_em, iniciada_em, concluida_em)
       values ($1, $2, 'conversa_e_ferramentas', 'gerar_plano_de_aula', $3, $4, $5, $6, $7, $8,
         $9::timestamptz - $10::interval,
         case when $5 = 'pendente' then null else $9::timestamptz - $10::interval end,
         case when $5 in ('concluida', 'falhou') then $9::timestamptz - $10::interval end)
       returning id`,
      [
        escola.escolaId,
        escola.anoId,
        quem,
        randomUUID(),
        estado,
        JSON.stringify({ tarefa: 'gerar_plano_de_aula', parametros: { tema: TEMA } }),
        estado === 'concluida' ? JSON.stringify({ tipo: 'artefato', artefatoId: randomUUID() }) : null,
        estado === 'falhou' ? 'IA_INDISPONIVEL' : null,
        agora.toISOString(),
        ha,
      ],
    )
    return rows[0]?.id ?? ''
  }

  /** Uma execução do Tutor, pedida pelo aluno da escola, criada `ha` antes do `agora`: é a que tem o aluno em `solicitada_por`. */
  async function execucaoDoTutor(escola: Escola, agora: Date, ha: string, entrada: Record<string, unknown> = { tarefa: 'turno_do_tutor' }): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, criada_em)
       values ($1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $3, $4, $7, $5::timestamptz - $6::interval) returning id`,
      [escola.escolaId, escola.anoId, escola.alunoId, randomUUID(), agora.toISOString(), ha, JSON.stringify(entrada)],
    )
    return rows[0]?.id ?? ''
  }

  /**
   * Uma chamada ao modelo, gravada `ha` antes do `agora`. Na ferramenta do professor, com o tema na `entrada` e o texto do
   * modelo na `saida` (cada um pode faltar); no Tutor, com o aluno e sem texto, como o check `consumo_ia_sem_conversa_de_pessoa`
   * exige, e ligada à execução do Tutor da mesma hora, como o gateway grava.
   */
  async function consumo(
    escola: Escola,
    agora: Date,
    ha: string,
    tipo: { de: 'ferramenta'; entrada?: boolean; saida?: boolean; execucaoId?: string } | { de: 'tutor' },
  ): Promise<string> {
    const ferramenta = tipo.de === 'ferramenta'
    const execucaoId = ferramenta ? (tipo.execucaoId ?? null) : await execucaoDoTutor(escola, agora, ha)
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into consumo_ia (escola_id, aluno_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida,
         custo_micros, duracao_ms, envio_externo, tentativas, estado, entrada, saida, em)
       values ($1, $2, $3, $4, $5, 'padrao', 'falso', 'modelo-falso', 'v1', 120, 80, 7, 900, false, 1, 'concluida', $6, $7, $8::timestamptz - $9::interval)
       returning id`,
      [
        escola.escolaId,
        ferramenta ? null : escola.alunoId,
        execucaoId,
        ferramenta ? 'gerar_plano_de_aula' : 'turno_do_tutor',
        ferramenta ? 'conversa_e_ferramentas' : 'tutor_com_o_aluno',
        ferramenta && tipo.entrada !== false ? JSON.stringify({ tema: TEMA }) : null,
        ferramenta && tipo.saida !== false ? JSON.stringify({ texto: `Plano sobre ${TEMA}` }) : null,
        agora.toISOString(),
        ha,
      ],
    )
    return rows[0]?.id ?? ''
  }

  /** O ano seguinte livre de cada escola: `ano_letivo` é único por escola e ano. */
  const proximoAno = new Map<string, number>()

  /**
   * Um ano letivo da escola, na situação pedida, cujo `fim` é o dia (de UTC) de `fimHa` antes do `agora`, com uma turma e
   * uma disciplina. O ano só serve de dono: o número dele não tem relação com as datas. O dia de UTC só é o da escola
   * porque os relógios destes testes são da madrugada (`QUARTA_1H` é 4h em UTC): perto da meia-noite, use
   * `anoQueTerminouEm` com a data.
   */
  async function anoQueTerminou(escola: { escolaId: string }, agora: Date, fimHa: string, situacao: 'planejado' | 'em_curso' | 'encerrado' = 'encerrado'): Promise<{ anoId: string; turmaId: string; disciplinaId: string }> {
    const { rows } = await bancada.pool.query<{ dia: string }>("select ((($1::timestamptz - $2::interval) at time zone 'UTC')::date)::text as dia", [agora.toISOString(), fimHa])
    return anoQueTerminouEm(escola, rows[0]?.dia ?? '', situacao)
  }

  /** Um ano letivo da escola, na situação pedida, que terminou no `dia` (`AAAA-MM-DD`), com uma turma e uma disciplina. */
  async function anoQueTerminouEm(escola: { escolaId: string }, dia: string, situacao: 'planejado' | 'em_curso' | 'encerrado' = 'encerrado'): Promise<{ anoId: string; turmaId: string; disciplinaId: string }> {
    const ano = proximoAno.get(escola.escolaId) ?? 2001
    proximoAno.set(escola.escolaId, ano + 1)
    const { rows: anos } = await bancada.pool.query<{ id: string }>(
      'insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, $2, $3::date - 200, $3::date, $4) returning id',
      [escola.escolaId, ano, dia, situacao],
    )
    const anoId = anos[0]?.id ?? ''
    const { rows: series } = await bancada.pool.query<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'em', 1) on conflict do nothing returning id", [escola.escolaId])
    const serieId = series[0]?.id ?? (await bancada.pool.query<{ id: string }>("select id from serie where escola_id = $1 and etapa = 'em' and ano = 1", [escola.escolaId])).rows[0]?.id
    const { rows: turmas } = await bancada.pool.query<{ id: string }>("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '1ºA sintética') returning id", [
      escola.escolaId,
      anoId,
      serieId,
    ])
    return { anoId, turmaId: turmas[0]?.id ?? '', disciplinaId: await disciplinaDa(escola.escolaId) }
  }

  /** A disciplina da escola (uma por escola basta). */
  async function disciplinaDa(escolaId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      "insert into disciplina (escola_id, nome) values ($1, 'Matemática') on conflict do nothing returning id",
      [escolaId],
    )
    return rows[0]?.id ?? (await bancada.pool.query<{ id: string }>("select id from disciplina where escola_id = $1 and nome = 'Matemática'", [escolaId])).rows[0]?.id ?? ''
  }

  /** Um artefato do professor no ano e na turma dados. */
  async function artefatoDe(escolaId: string, ano: { anoId: string; turmaId: string; disciplinaId: string }, criadoPor: string, execucaoId: string | null = null): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, execucao_id, criado_por)
       values ($1, $2, $3, $4, 'plano_de_aula', 'Plano sintético', '{"tipo":"plano_de_aula","titulo":"Plano sintético"}', $5, $6) returning id`,
      [escolaId, ano.anoId, ano.turmaId, ano.disciplinaId, execucaoId, criadoPor],
    )
    return rows[0]?.id ?? ''
  }

  /**
   * O trabalho de um aluno numa atividade objetiva já corrigida, no ano dado: a atividade aplicada (encerrada), o lote de
   * correção, a tentativa do aluno, duas respostas e a correção dele. É o que o `trabalho_do_aluno` apaga em cascata, e o
   * que ele deixa: a atividade e o lote ficam (registro de decisão).
   */
  async function trabalhoDoAluno(
    escola: { escolaId: string },
    ano: { anoId: string; turmaId: string; disciplinaId: string },
    alunoId: string,
  ): Promise<{ tentativaId: string; atividadeAplicadaId: string; entregaId: string }> {
    const professorId = await professorNovo(escola)
    const um = async (texto: string, valores: unknown[]): Promise<string> => {
      const { rows } = await bancada.pool.query<{ id: string }>(texto, valores)
      return rows[0]?.id ?? ''
    }
    const artefatoId = await um(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por)
       values ($1, $2, $3, $4, 'atividade_objetiva', 'Atividade sintética', '{"tipo":"atividade_objetiva","titulo":"Atividade sintética"}', $5) returning id`,
      [escola.escolaId, ano.anoId, ano.turmaId, ano.disciplinaId, professorId],
    )
    const atividadeAplicadaId = await um(
      `insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, estado, aplicada_por, encerrada_em) values ($1, $2, $3, $4, false, 'encerrada', $5, now()) returning id`,
      [escola.escolaId, ano.anoId, ano.turmaId, artefatoId, professorId],
    )
    const entregaId = await um(
      `insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, atividade_aplicada_id) values ($1, $2, $3, 'correcao_de_objetiva', 'lote_de_correcao', $4) returning id`,
      [escola.escolaId, ano.anoId, ano.turmaId, atividadeAplicadaId],
    )
    const tentativaId = await um(
      'insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, enviada_em) values ($1, $2, $3, $4, now()) returning id',
      [escola.escolaId, ano.anoId, atividadeAplicadaId, alunoId],
    )
    await bancada.pool.query(
      'insert into resposta_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao, alternativa) select $1, $2, $3, $4, questao, 0 from generate_series(1, 2) as questao',
      [escola.escolaId, ano.anoId, atividadeAplicadaId, alunoId],
    )
    await bancada.pool.query(
      `insert into correcao (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, aluno_id, acertos, total, em_branco, por_habilidade) values ($1, $2, $3, $4, $5, 1, 2, 0, '[]')`,
      [escola.escolaId, ano.anoId, entregaId, atividadeAplicadaId, alunoId],
    )
    return { tentativaId, atividadeAplicadaId, entregaId }
  }

  /** Quantas respostas e correções do aluno na atividade aplicada ainda existem. */
  async function restoDoTrabalho(atividadeAplicadaId: string): Promise<{ respostas: number; correcoes: number }> {
    const { rows } = await bancada.pool.query<{ respostas: number; correcoes: number }>(
      `select (select count(*)::int from resposta_atividade where atividade_aplicada_id = $1) as respostas, (select count(*)::int from correcao where atividade_aplicada_id = $1) as correcoes`,
      [atividadeAplicadaId],
    )
    return rows[0] ?? { respostas: -1, correcoes: -1 }
  }

  /**
   * Um pedido de reivindicação já fechado: a decisão, ou o encerramento sem decisão (`encerrada`, a virada do ano). A
   * solicitação é 30 dias mais velha que a decisão, para o teste do prazo provar que ele conta da decisão.
   */
  async function reivindicacaoFechada(escola: Escola, agora: Date, ha: string, opcoes: { estado?: 'aprovada' | 'recusada' | 'encerrada'; como?: 'professor' | 'coordenacao' } = {}): Promise<string> {
    const estado = opcoes.estado ?? 'aprovada'
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into reivindicacao (escola_id, ano_letivo_id, turma_id, estado, solicitada_em, decidida_em, decidida_como)
       values ($1, $2, $3, $4, $5::timestamptz - $6::interval - interval '30 days', case when $4 = 'encerrada' then null else $5::timestamptz - $6::interval end, case when $4 = 'encerrada' then null else $7 end) returning id`,
      [escola.escolaId, escola.anoId, escola.turmaId, estado, agora.toISOString(), ha, opcoes.como ?? 'professor'],
    )
    return rows[0]?.id ?? ''
  }

  /** O pedido de reivindicação que ainda espera decisão, com o nome da lista, a senha e a chave que o estado `pendente` exige. */
  async function reivindicacaoPendente(escola: Escola, agora: Date, ha: string): Promise<string> {
    const { rows: nomes } = await bancada.pool.query<{ id: string }>(
      "insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, estado) values ($1, $2, $3, 'Nome sintético da lista', $4, 'reivindicado') returning id",
      [escola.escolaId, escola.anoId, escola.turmaId, `m-${randomUUID().slice(0, 8)}`],
    )
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into reivindicacao (escola_id, ano_letivo_id, turma_id, lista_nome_id, chave_envio, senha_hash, teve_matricula_errada, estado, solicitada_em)
       values ($1, $2, $3, $4, $5, 'hash-sintetico', false, 'pendente', $6::timestamptz - $7::interval) returning id`,
      [escola.escolaId, escola.anoId, escola.turmaId, nomes[0]?.id, randomUUID(), agora.toISOString(), ha],
    )
    return rows[0]?.id ?? ''
  }

  /** Um material da escola; `excluidoHa` o marca excluído há tanto tempo, e sem ele o material é vigente. */
  async function materialDa(escola: { escolaId: string }, agora: Date, excluidoHa?: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, paginas, estado, excluido_em)
       values ($1, $2, 'Apostila sintética', 'escola', 'autoria_da_escola', true, md5(random()::text) || md5(random()::text), 1000, 1, 'pronto', case when $4::text is null then null else $3::timestamptz - $4::interval end) returning id`,
      [escola.escolaId, await disciplinaDa(escola.escolaId), agora.toISOString(), excluidoHa ?? null],
    )
    return rows[0]?.id ?? ''
  }

  /** O vínculo do aluno com a turma, no estado pedido; o encerrado tem o motivo e a data, `ha` antes do `agora`. */
  async function vinculoDe(escola: Escola, estado: 'pendente' | 'confirmado' | 'contestado' | 'encerrado', agora: Date, ha: string, usuarioId = escola.alunoId): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, contestacao, motivo_encerramento, criado_por, encerrado_em)
       values ($1, $2, $3, $4, 'aluno', $5, case when $5 = 'contestado' then 'turma_errada' end, case when $5 = 'encerrado' then 'fim_do_ano' end, $3, case when $5 = 'encerrado' then $6::timestamptz - $7::interval end) returning id`,
      [escola.escolaId, escola.anoId, usuarioId, escola.turmaId, estado, agora.toISOString(), ha],
    )
    return rows[0]?.id ?? ''
  }

  /** Um aluno da escola desativado `ha` antes do `agora`. */
  async function alunoDesativado(escola: { escolaId: string }, agora: Date, ha: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      "insert into usuario (escola_id, papel, nome, desativado_em) values ($1, 'aluno', 'Aluno desativado sintético', $2::timestamptz - $3::interval) returning id",
      [escola.escolaId, agora.toISOString(), ha],
    )
    return rows[0]?.id ?? ''
  }

  /** Um aluno sem turma, só para dar dono ao trabalho. */
  async function alunoNovo(escolaId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', 'Aluno sintético do trabalho') returning id", [escolaId])
    return rows[0]?.id ?? ''
  }

  /**
   * Uma linha da categoria com a idade pedida, na tabela que o expurgo dela alcança. Objeto com o tipo declarado: categoria
   * nova sem semeadura é erro de compilação, e o `it.each` do prazo a cobre sozinho. Na autoria, a idade é a do `fim` do ano
   * encerrado do artefato.
   */
  const SEMEAR: Record<CategoriaDoExpurgo, (escola: Escola, agora: Date, ha: string) => Promise<{ tabela: string; id: string }>> = {
    conversa_tutor: async (escola, agora, ha) => ({ tabela: 'mensagem_tutor', id: await mensagemTutor(escola, agora, ha) }),
    sinal_tutor: async (escola, agora, ha) => ({ tabela: 'sinal_tutor', id: await sinal(escola, agora, ha) }),
    // Uma thread velha por escola, com todas as mensagens: só a idade da mensagem decide, e a thread fica com a que fica.
    conversa_professor: async (escola, agora, ha) => {
      const daEscola = threadsSemeadas.get(escola.escolaId) ?? (await thread(escola, agora, '30 months'))
      threadsSemeadas.set(escola.escolaId, daEscola)
      return { tabela: 'mensagem_agente', id: await mensagemAgente(escola, daEscola, agora, ha) }
    },
    execucao_agente: async (escola, agora, ha) => ({ tabela: 'execucao_agente', id: await execucaoComTema(escola, agora, ha) }),
    texto_do_modelo: async (escola, agora, ha) => ({ tabela: 'consumo_ia', id: await consumo(escola, agora, ha, { de: 'ferramenta' }) }),
    consumo_por_aluno: async (escola, agora, ha) => ({ tabela: 'consumo_ia', id: await consumo(escola, agora, ha, { de: 'tutor' }) }),
    autoria_de_artefato: async (escola, agora, ha) => ({ tabela: 'artefato', id: await artefatoDe(escola.escolaId, await anoQueTerminou(escola, agora, ha), await professorNovo(escola)) }),
    // A idade do trabalho é a do `fim` do ano encerrado da atividade, como a da autoria.
    trabalho_do_aluno: async (escola, agora, ha) => ({ tabela: 'tentativa_atividade', id: (await trabalhoDoAluno(escola, await anoQueTerminou(escola, agora, ha), escola.alunoId)).tentativaId }),
    reivindicacao_decidida: async (escola, agora, ha) => ({ tabela: 'reivindicacao', id: await reivindicacaoFechada(escola, agora, ha) }),
    material_excluido: async (escola, agora, ha) => ({ tabela: 'material', id: await materialDa(escola, agora, ha) }),
    vinculo_encerrado: async (escola, agora, ha) => ({ tabela: 'vinculo', id: await vinculoDe(escola, 'encerrado', agora, ha, await alunoDesativado(escola, agora, '1 day')) }),
    pessoa_desativada: async (escola, agora, ha) => ({ tabela: 'usuario', id: await alunoDesativado(escola, agora, ha) }),
  }
  const threadsSemeadas = new Map<string, { threadId: string; professorId: string }>()

  /** Uma linha de anonimização: lida, ela tem de existir. Se sumiu, o expurgo apagou o que devia só anonimizar. */
  async function lida<T extends Record<string, unknown>>(texto: string, id: string): Promise<T> {
    const { rows } = await bancada.pool.query<T>(texto, [id])
    const linha = rows[0]
    if (linha === undefined) throw new Error(`a linha ${id} sumiu: a anonimização mantém a linha`)
    return linha
  }

  /**
   * Se a linha semeada já passou pelo expurgo da categoria: as que apagam, se ela sumiu; as que anonimizam, se a linha
   * continua lá e perdeu a pessoa (e só a pessoa, como diz o catálogo).
   */
  const EXPURGADA: Record<CategoriaDoExpurgo, (linha: { tabela: string; id: string }) => Promise<boolean>> = {
    conversa_tutor: async ({ tabela, id }) => !(await existe(tabela, id)),
    sinal_tutor: async ({ tabela, id }) => !(await existe(tabela, id)),
    conversa_professor: async ({ tabela, id }) => !(await existe(tabela, id)),
    execucao_agente: async ({ id }) => {
      const linha = await lida<{ entrada: unknown; solicitadaPor: string | null; anonimizadaEm: Date | null }>(
        'select entrada, solicitada_por as "solicitadaPor", anonimizada_em as "anonimizadaEm" from execucao_agente where id = $1',
        id,
      )
      const anonimizada = linha.anonimizadaEm !== null
      // As três mudam juntas, ou nenhuma muda.
      expect({ entrada: linha.entrada, solicitadaPor: linha.solicitadaPor === null }).toEqual(
        anonimizada ? { entrada: { tarefa: 'gerar_plano_de_aula' }, solicitadaPor: true } : { entrada: { tarefa: 'gerar_plano_de_aula', parametros: { tema: TEMA } }, solicitadaPor: false },
      )
      return anonimizada
    },
    texto_do_modelo: async ({ id }) => {
      const linha = await lida<{ entrada: unknown; saida: unknown; tokens: number }>('select entrada, saida, tokens_de_entrada as tokens from consumo_ia where id = $1', id)
      expect(linha.tokens).toBe(120)
      expect(linha.entrada === null).toBe(linha.saida === null)
      return linha.entrada === null
    },
    // O aluno sai do consumo e da execução do Tutor a que o consumo aponta: pela junção, ele também não volta.
    consumo_por_aluno: async ({ id }) => {
      const linha = await lida<{ alunoId: string | null; tokens: number; pelaExecucao: string | null }>(
        `select c.aluno_id as "alunoId", c.tokens_de_entrada as tokens, e.solicitada_por as "pelaExecucao"
         from consumo_ia c join execucao_agente e on e.escola_id = c.escola_id and e.id = c.execucao_id where c.id = $1`,
        id,
      )
      expect(linha.tokens).toBe(120)
      expect(linha.pelaExecucao === null).toBe(linha.alunoId === null)
      return linha.alunoId === null
    },
    autoria_de_artefato: async ({ id }) => (await lida<{ criadoPor: string | null }>('select criado_por as "criadoPor" from artefato where id = $1', id)).criadoPor === null,
    // As cinco da tarefa 5.0 saem de verdade: a linha some.
    trabalho_do_aluno: async ({ tabela, id }) => !(await existe(tabela, id)),
    reivindicacao_decidida: async ({ tabela, id }) => !(await existe(tabela, id)),
    material_excluido: async ({ tabela, id }) => !(await existe(tabela, id)),
    vinculo_encerrado: async ({ tabela, id }) => !(await existe(tabela, id)),
    pessoa_desativada: async ({ tabela, id }) => !(await existe(tabela, id)),
  }

  async function existe(tabela: string, id: string): Promise<boolean> {
    return ((await bancada.pool.query(`select 1 from ${tabela} where id = $1`, [id])).rowCount ?? 0) > 0
  }

  async function quantas(tabela: string, escolaId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ total: number }>(`select count(*)::int as total from ${tabela} where escola_id = $1`, [escolaId])
    return rows[0]?.total ?? 0
  }

  async function execucoes(escolaId: string): Promise<Array<{ categoria: string; linhas: number; concluida: boolean }>> {
    const { rows } = await bancada.pool.query<{ categoria: string; linhas: number; concluida: boolean }>(
      'select categoria, linhas, concluida from expurgo_execucao where escola_id = $1 order by em, id',
      [escolaId],
    )
    return rows
  }

  /** O horário letivo da escola do contexto, lido como o worker-lote lê. */
  const janelaDaEscola = () => new OperationalSettings<JanelaLetiva>(new OperationalSettingsRepository(bancada.banco), (linha) => resolverJanela(janelaPadraoDoAmbiente(), linha))

  function expurgo(relogio: Clock, opcoes: { lote?: number; repositorio?: ExpurgoDaEscolaRepository; armazem?: FileStorage } = {}): Processador {
    return criarExpurgoDaEscola({
      repositorio: opcoes.repositorio ?? new ExpurgoDaEscolaRepository(bancada.banco),
      arquivos: new ArquivoDoTitularRepository(bancada.banco),
      armazem: opcoes.armazem ?? new InMemoryFileStorage(),
      retencao: new RetencaoDaEscolaRepository(bancada.banco),
      janelaDaEscola: janelaDaEscola(),
      enfileirador: bancada.enfileirador,
      relogio,
      logger: log.logger,
      ...(opcoes.lote === undefined ? {} : { lote: opcoes.lote }),
    })
  }

  function rodar(escolaId: string, processador: Processador): Promise<void> {
    const jobId = randomUUID()
    return runInContext({ requisicaoId: randomUUID(), escolaId }, () => processador({}, execucaoDoJob(jobId)))
  }

  function rotina(relogio: Clock, ids: readonly string[]): Processador {
    return criarRotinaDeExpurgo({
      escolas: { listarIds: () => Promise.resolve([...ids]) },
      banco: bancada.banco,
      enfileirador: bancada.enfileirador,
      janelaDaEscola: janelaDaEscola(),
      relogio,
      logger: log.logger,
    })
  }

  function rodarRotina(processador: Processador): Promise<void> {
    const jobId = randomUUID()
    return runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => processador({}, execucaoDoJob(jobId)))
  }

  async function jobsDoExpurgo(escolaId: string): Promise<Array<{ id: string; chave: string; fila: string; prioridade: number; naoUrgente: boolean; estado: string }>> {
    const { rows } = await bancada.pool.query<{ id: string; chave: string; fila: string; prioridade: number; naoUrgente: boolean; estado: string }>(
      `select id, chave_idempotencia as chave, fila, prioridade, nao_urgente as "naoUrgente", estado from job_registro where escola_id = $1 and tipo = $2 order by criado_em, id`,
      [escolaId, TIPO_EXPURGAR_ESCOLA],
    )
    return rows
  }

  async function ajustar(escolaId: string, categoria: string, meses: number): Promise<void> {
    await bancada.pool.query(
      `insert into retencao_escola (escola_id, categoria, meses, referencia_contrato, alterada_por) values ($1, $2, $3, 1, 'teste-expurgo')
       on conflict (escola_id, categoria) do update set meses = excluded.meses`,
      [escolaId, categoria, meses],
    )
  }

  describe('prazo por categoria', () => {
    it.each(CATEGORIAS_DO_EXPURGO)('%s: um dia antes do prazo a linha fica, um dia depois sai (ou perde a pessoa), a de outra escola com a mesma idade fica, e reexecutar não mexe em mais nada', async (categoria) => {
      const a = await escolaNova()
      const b = await escolaNova()
      const meses = CATEGORIAS_DE_RETENCAO[categoria].padrao
      const fica = await SEMEAR[categoria](a, QUARTA_1H, `${String(meses)} months - 1 day`)
      const sai = await SEMEAR[categoria](a, QUARTA_1H, `${String(meses)} months 1 day`)
      const deB = await SEMEAR[categoria](b, QUARTA_1H, `${String(meses)} months 1 day`)

      expect(await EXPURGADA[categoria](sai)).toBe(false)
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect(await EXPURGADA[categoria](sai)).toBe(true)
      expect(await EXPURGADA[categoria](fica)).toBe(false)
      // O job de A nunca alcança B (regra 10), nem com a linha vencida.
      expect(await EXPURGADA[categoria](deB)).toBe(false)
      expect((await execucoes(a.escolaId)).find((linha) => linha.categoria === categoria)).toEqual({ categoria, linhas: 1, concluida: true })
      expect(await execucoes(b.escolaId)).toEqual([])

      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect(await EXPURGADA[categoria](sai)).toBe(true)
      expect(await EXPURGADA[categoria](fica)).toBe(false)
      expect((await execucoes(a.escolaId)).filter((linha) => linha.categoria === categoria)).toEqual([
        { categoria, linhas: 1, concluida: true },
        { categoria, linhas: 0, concluida: true },
      ])
    })

    it('toda categoria percorrida grava a sua linha, mesmo com zero, na ordem do catálogo', async () => {
      const a = await escolaNova()
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect(await execucoes(a.escolaId)).toEqual(CATEGORIAS_DO_EXPURGO.map((categoria) => ({ categoria, linhas: 0, concluida: true })))
    })
  })

  describe('ajuste da escola', () => {
    it('encurtar o prazo em A tira a linha de A e mantém a de B, com a mesma idade; aumentar depois não devolve nada', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      await ajustar(a.escolaId, 'conversa_tutor', 6)
      const deA = await mensagemTutor(a, QUARTA_1H, '7 months')
      const deB = await mensagemTutor(b, QUARTA_1H, '7 months')
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      await rodar(b.escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect(await existe('mensagem_tutor', deA)).toBe(false)
      expect(await existe('mensagem_tutor', deB)).toBe(true)

      await ajustar(a.escolaId, 'conversa_tutor', 24)
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect(await existe('mensagem_tutor', deA)).toBe(false)
      expect(await quantas('mensagem_tutor', a.escolaId)).toBe(0)
      expect(await existe('mensagem_tutor', deB)).toBe(true)
    })
  })

  describe('thread do professor', () => {
    it('a thread com mensagem no prazo fica; a vazia criada antes do corte sai; a vazia recém-aberta fica; a vazia antiga de outra escola fica', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const vaziaAntigaDeB = await thread(b, QUARTA_1H, '13 months')
      const comMensagemNoPrazo = await thread(a, QUARTA_1H, '30 months')
      const velha = await mensagemAgente(a, comMensagemNoPrazo, QUARTA_1H, '13 months')
      const nova = await mensagemAgente(a, comMensagemNoPrazo, QUARTA_1H, '1 month')
      const soVencidas = await thread(a, QUARTA_1H, '30 months')
      await mensagemAgente(a, soVencidas, QUARTA_1H, '13 months')
      const vaziaAntiga = await thread(a, QUARTA_1H, '13 months')
      const vaziaRecente = await thread(a, QUARTA_1H, '1 day')

      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect(await existe('mensagem_agente', velha)).toBe(false)
      expect(await existe('mensagem_agente', nova)).toBe(true)
      expect(await existe('thread_agente', comMensagemNoPrazo.threadId)).toBe(true)
      expect(await existe('thread_agente', soVencidas.threadId)).toBe(false)
      expect(await existe('thread_agente', vaziaAntiga.threadId)).toBe(false)
      expect(await existe('thread_agente', vaziaRecente.threadId)).toBe(true)
      expect(await existe('thread_agente', vaziaAntigaDeB.threadId)).toBe(true)
      // A linha da conversa do professor conta as duas mensagens e as duas threads que saíram.
      expect((await execucoes(a.escolaId)).find((linha) => linha.categoria === 'conversa_professor')).toEqual({ categoria: 'conversa_professor', linhas: 4, concluida: true })
    })

    it('a thread que ganhou mensagem entre a visão da escolha e a trava não sai: a segunda instrução confere de novo', async () => {
      const a = await escolaNova()
      const alvo = await thread(a, QUARTA_1H, '13 months')
      const execucaoId = await execucao(a, 'propor_ferramenta', alvo.professorId)
      const repositorio = new ExpurgoDaEscolaRepository(bancada.banco)
      // A corrida que a reconferência fecha: a mensagem confirmada depois de a primeira instrução tirar a visão dela e antes
      // de ela travar a thread. Com a trava tomada, toda mensagem nova espera o fim do lote pela FK; o teste reproduz o
      // estado da corrida gravando a mensagem na janela entre a trava e a reconferência, com a FK desligada só nessa
      // conexão (`session_replication_role`), que é o que a mensagem confirmada antes da trava deixa no banco.
      const gravarNaJanela = async () => {
        const cliente = await bancada.pool.connect()
        try {
          await cliente.query("set session_replication_role = 'replica'")
          await cliente.query(
            `insert into mensagem_agente (escola_id, ano_letivo_id, thread_id, execucao_id, autor, conteudo, criada_em)
             values ($1, $2, $3, $4, 'agente', '{"tipo":"texto","texto":"Resposta sintética na janela"}', $5)`,
            [a.escolaId, a.anoId, alvo.threadId, execucaoId, QUARTA_1H.toISOString()],
          )
        } finally {
          await cliente.query("set session_replication_role = 'origin'")
          cliente.release()
        }
      }
      const lote = await runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () => repositorio.expurgarLote('thread_agente', { agora: QUARTA_1H, meses: 12, fuso: FUSO }, LOTE_DO_EXPURGO, gravarNaJanela))
      expect(lote).toEqual({ linhas: 0, cheio: false })
      expect(await existe('thread_agente', alvo.threadId)).toBe(true)
      expect(await quantas('mensagem_agente', a.escolaId)).toBe(1)
    })
  })

  describe('janela letiva', () => {
    it('a janela abre no meio: a categoria interrompida grava `false` com a contagem parcial, as anteriores `true`, a seguinte nem começa; a noite seguinte começa pela pendente, dá a volta e grava `true`', async () => {
      const a = await escolaNova()
      for (let indice = 0; indice < 5; indice += 1) await sinal(a, QUARTA_1H, '13 months')
      await mensagemTutor(a, QUARTA_1H, '13 months')
      const relogio = relogioEm(QUARTA_1H)
      // A janela abre logo depois do primeiro lote de sinais: o lote seguinte já a vê aberta.
      const real = new ExpurgoDaEscolaRepository(bancada.banco)
      const abreDepoisDoPrimeiroSinal = Object.assign(Object.create(real) as ExpurgoDaEscolaRepository, {
        expurgarLote: async (alvo: AlvoDoExpurgoDaEscola, prazo: PrazoDoLote, limite: number) => {
          const lote = await real.expurgarLote(alvo, prazo, limite)
          if (alvo === 'sinal_tutor') relogio.atual = QUARTA_8H
          return lote
        },
      })
      await rodar(a.escolaId, expurgo(relogio, { lote: 2, repositorio: abreDepoisDoPrimeiroSinal }))
      expect(await execucoes(a.escolaId)).toEqual([
        { categoria: 'conversa_tutor', linhas: 1, concluida: true },
        { categoria: 'sinal_tutor', linhas: 2, concluida: false },
      ])
      expect(await quantas('sinal_tutor', a.escolaId)).toBe(3)

      // Na noite seguinte, uma mensagem nova vencida: se a noite começasse pelo catálogo, a conversa do Tutor viria antes.
      await mensagemTutor(a, QUINTA_1H, '13 months')
      await rodar(a.escolaId, expurgo(relogioEm(QUINTA_1H), { lote: 2 }))
      expect((await execucoes(a.escolaId)).slice(2)).toEqual([
        { categoria: 'sinal_tutor', linhas: 3, concluida: true },
        { categoria: 'conversa_professor', linhas: 0, concluida: true },
        { categoria: 'execucao_agente', linhas: 0, concluida: true },
        { categoria: 'texto_do_modelo', linhas: 0, concluida: true },
        { categoria: 'consumo_por_aluno', linhas: 0, concluida: true },
        { categoria: 'trabalho_do_aluno', linhas: 0, concluida: true },
        { categoria: 'reivindicacao_decidida', linhas: 0, concluida: true },
        { categoria: 'autoria_de_artefato', linhas: 0, concluida: true },
        { categoria: 'material_excluido', linhas: 0, concluida: true },
        { categoria: 'vinculo_encerrado', linhas: 0, concluida: true },
        { categoria: 'pessoa_desativada', linhas: 0, concluida: true },
        { categoria: 'conversa_tutor', linhas: 1, concluida: true },
      ])
      expect(await quantas('sinal_tutor', a.escolaId)).toBe(0)
      expect(log.doEvento('retencao.expurgo_interrompido').some((linha) => linha['escolaId'] === a.escolaId && linha['tipo'] === 'sinal_tutor' && linha['linhasDaCategoriaTotal'] === 2 && linha['linhasTotal'] === 3)).toBe(true)
    })

    it('o lote que falha numa categoria do meio grava ela como não concluída e o erro sobe; a noite seguinte começa por ela', async () => {
      const a = await escolaNova()
      const real = new ExpurgoDaEscolaRepository(bancada.banco)
      const falhaNoSinal = Object.assign(Object.create(real) as ExpurgoDaEscolaRepository, {
        expurgarLote: (alvo: AlvoDoExpurgoDaEscola, prazo: PrazoDoLote, limite: number) =>
          alvo === 'sinal_tutor' ? Promise.reject(new Error('canceling statement due to statement timeout')) : real.expurgarLote(alvo, prazo, limite),
      })
      const segunda = new Date('2026-10-05T01:00:00-03:00')
      const terca = new Date('2026-10-06T01:00:00-03:00')
      await expect(rodar(a.escolaId, expurgo(relogioEm(segunda), { repositorio: falhaNoSinal }))).rejects.toThrow('statement timeout')
      expect(await execucoes(a.escolaId)).toEqual([
        { categoria: 'conversa_tutor', linhas: 0, concluida: true },
        { categoria: 'sinal_tutor', linhas: 0, concluida: false },
      ])
      // Na terça, a noite começa pela pendente e falha de novo nela.
      await expect(rodar(a.escolaId, expurgo(relogioEm(terca), { repositorio: falhaNoSinal }))).rejects.toThrow('statement timeout')
      expect((await execucoes(a.escolaId)).slice(2)).toEqual([{ categoria: 'sinal_tutor', linhas: 0, concluida: false }])
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())
      await new MedicaoDoExpurgo({
        escolas: { listarIds: () => Promise.resolve([a.escolaId]) },
        repositorio: real,
        janelaDaEscola: janelaDaEscola(),
        relogio: relogioEm(new Date('2026-10-07T12:00:00-03:00')),
        logger: log.logger,
        medidor: medidor.medidor,
      }).medir()
      expect((await medidor.pontos('expurgo.noites_incompletas')).map(({ valor }) => valor)).toEqual([2])
    })

    it('a escola cujo expurgo falha no primeiro lote desde a primeira noite ganha a linha `false` em cada noite, e a série chega a 2', async () => {
      const a = await escolaNova()
      const real = new ExpurgoDaEscolaRepository(bancada.banco)
      const falhaSempre = Object.assign(Object.create(real) as ExpurgoDaEscolaRepository, {
        expurgarLote: () => Promise.reject(new Error('erro de SQL')),
      })
      // Segunda e terça, as duas primeiras noites da escola: nenhuma categoria termina, e só a linha do `catch` fica.
      for (const noite of [new Date('2026-10-05T01:00:00-03:00'), new Date('2026-10-06T01:00:00-03:00')]) {
        await expect(rodar(a.escolaId, expurgo(relogioEm(noite), { repositorio: falhaSempre }))).rejects.toThrow('erro de SQL')
      }
      expect(await execucoes(a.escolaId)).toEqual([
        { categoria: 'conversa_tutor', linhas: 0, concluida: false },
        { categoria: 'conversa_tutor', linhas: 0, concluida: false },
      ])
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())
      await new MedicaoDoExpurgo({
        escolas: { listarIds: () => Promise.resolve([a.escolaId]) },
        repositorio: real,
        janelaDaEscola: janelaDaEscola(),
        relogio: relogioEm(new Date('2026-10-07T12:00:00-03:00')),
        logger: log.logger,
        medidor: medidor.medidor,
      }).medir()
      expect((await medidor.pontos('expurgo.noites_incompletas')).map(({ valor }) => valor)).toEqual([2])
    })

    it('se nem a linha `false` grava, fica o aviso e sobe o erro do lote, e não o da gravação', async () => {
      const a = await escolaNova()
      const real = new ExpurgoDaEscolaRepository(bancada.banco)
      const tudoFalha = Object.assign(Object.create(real) as ExpurgoDaEscolaRepository, {
        expurgarLote: () => Promise.reject(new Error('erro do lote')),
        registrar: () => Promise.reject(new Error('banco fora')),
      })
      await expect(rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { repositorio: tudoFalha }))).rejects.toThrow('erro do lote')
      expect(log.doEvento('retencao.registro_nao_gravado').filter((linha) => linha['escolaId'] === a.escolaId)).toEqual([
        expect.objectContaining({ tipo: 'conversa_tutor', erro: expect.objectContaining({ tipo: 'Error' }) }),
      ])
      expect(await execucoes(a.escolaId)).toEqual([])
    })

    it('o corte é contado do `agora` do começo do job, mesmo com o relógio andando entre os lotes', async () => {
      const a = await escolaNova()
      // Meia hora antes de vencer, contado do começo: fica. Contado de qualquer leitura seguinte do relógio, venceria.
      const quaseVencida = await mensagemTutor(a, QUARTA_1H, '12 months - 30 minutes')
      let leituras = 0
      const andando: Clock = { agora: () => new Date(QUARTA_1H.getTime() + leituras++ * 60 * 60_000) }
      await rodar(a.escolaId, expurgo(andando))
      expect(await existe('mensagem_tutor', quaseVencida)).toBe(true)
      expect(leituras).toBeGreaterThan(2)
    })

    it('com a janela aberta desde o começo, nada sai: a primeira categoria grava zero e `false`', async () => {
      const a = await escolaNova()
      const vencida = await mensagemTutor(a, QUARTA_8H, '13 months')
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_8H)))
      expect(await existe('mensagem_tutor', vencida)).toBe(true)
      expect(await execucoes(a.escolaId)).toEqual([{ categoria: 'conversa_tutor', linhas: 0, concluida: false }])
    })

    it('o horário letivo é o da escola: a escola que configurou o dia inteiro fora de aula expurga às 8h de quarta', async () => {
      const a = await escolaNova()
      await bancada.configurarEscola(a.escolaId, { diasLetivos: [6] })
      const vencida = await mensagemTutor(a, QUARTA_8H, '13 months')
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_8H)))
      expect(await existe('mensagem_tutor', vencida)).toBe(false)
      expect((await execucoes(a.escolaId))[0]).toEqual({ categoria: 'conversa_tutor', linhas: 1, concluida: true })
    })
  })

  describe('lotes', () => {
    it('5.001 linhas vencidas saem em dois lotes de até 5.000, com uma linha só de execução; a categoria vazia grava zero', async () => {
      const a = await escolaNova()
      // 2.501 execuções, cada uma com a pergunta e a resposta do Tutor, menos uma resposta: 5.001 mensagens vencidas.
      await bancada.semear(
        `with execucoes as (
           insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada)
           select $1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $3, gen_random_uuid(), '{"tarefa":"turno_do_tutor"}' from generate_series(1, 2501)
           returning id
         ), numeradas as (select id, row_number() over () as n from execucoes)
         insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto, criada_em)
         select $1, $2, $4, $3, numeradas.id, autor, 'Mensagem sintética em volume', $5::timestamptz - interval '13 months'
         from numeradas cross join (values ('aluno'), ('tutor')) as autores(autor)
         where not (numeradas.n = 1 and autor = 'tutor')`,
        [a.escolaId, a.anoId, a.alunoId, a.turmaId, QUARTA_1H.toISOString()],
      )
      expect(await quantas('mensagem_tutor', a.escolaId)).toBe(5_001)
      const real = new ExpurgoDaEscolaRepository(bancada.banco)
      const lotes: Array<{ alvo: AlvoDoExpurgoDaEscola; linhas: number }> = []
      const contando = Object.assign(Object.create(real) as ExpurgoDaEscolaRepository, {
        expurgarLote: async (alvo: AlvoDoExpurgoDaEscola, prazo: PrazoDoLote, limite: number) => {
          const lote = await real.expurgarLote(alvo, prazo, limite)
          lotes.push({ alvo, linhas: lote.linhas })
          return lote
        },
      })
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { repositorio: contando }))
      expect(lotes.filter(({ alvo }) => alvo === 'mensagem_tutor').map(({ linhas }) => linhas)).toEqual([5_000, 1])
      expect(log.doEvento('retencao.expurgada').filter((linha) => linha['escolaId'] === a.escolaId)).toEqual([expect.objectContaining({ categoriasTotal: CATEGORIAS_DO_EXPURGO.length, linhasTotal: 5_001 })])
      expect(await quantas('mensagem_tutor', a.escolaId)).toBe(0)
      expect(await execucoes(a.escolaId)).toEqual(CATEGORIAS_DO_EXPURGO.map((categoria) => ({ categoria, linhas: categoria === 'conversa_tutor' ? 5_001 : 0, concluida: true })))
    })

    it('o lote de cada alvo desce pelo índice dele, que começa pela escola, sem varrer a tabela', async () => {
      const a = await escolaNova()
      const cliente = await bancada.pool.connect()
      try {
        await cliente.query('begin')
        // O volume da escola, só nesta transação: 40 alunos, e execuções e chamadas de dois anos, metade do Tutor (com um dos
        // alunos) e metade de ferramenta (com o tema). Sem ele, o plano dependeria do que os outros testes deixaram no banco, e
        // com um aluno só o índice antigo `(escola_id, aluno_id, em)` daria a mesma ordem do lote.
        const { rows: alunos } = await cliente.query<{ id: string }>(
          "insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno sintético ' || n from generate_series(1, 40) as n returning id",
          [a.escolaId],
        )
        const idsDosAlunos = `{${alunos.map(({ id }) => id).join(',')}}`
        await cliente.query(
          `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, criada_em)
           select $1, $2, case when n % 2 = 0 then 'tutor_com_o_aluno' else 'conversa_e_ferramentas' end,
             case when n % 2 = 0 then 'turno_do_tutor' else 'gerar_plano_de_aula' end, case when n % 2 = 0 then $3::uuid end, gen_random_uuid(),
             jsonb_build_object('tarefa', case when n % 2 = 0 then 'turno_do_tutor' else 'gerar_plano_de_aula' end), $4::timestamptz - (n % 730) * interval '1 day'
           from generate_series(1, 4000) as n`,
          [a.escolaId, a.anoId, a.alunoId, QUARTA_1H.toISOString()],
        )
        await cliente.query(
          `insert into consumo_ia (escola_id, aluno_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, entrada, saida, em)
           select $1, case when n % 2 = 0 then ($2::uuid[])[1 + n % 40] end, case when n % 2 = 0 then 'turno_do_tutor' else 'gerar_plano_de_aula' end,
             case when n % 2 = 0 then 'tutor_com_o_aluno' else 'conversa_e_ferramentas' end, 'padrao', 'falso', 'modelo-falso', 'v1', 1, 1, 1, false, 1, 'concluida',
             case when n % 2 = 1 then '{"tema":"Tema sintético"}'::jsonb end, case when n % 2 = 1 then '{"texto":"Plano sintético"}'::jsonb end,
             $3::timestamptz - (n % 730) * interval '1 day'
           from generate_series(1, 8000) as n`,
          [a.escolaId, idsDosAlunos, QUARTA_1H.toISOString()],
        )
        // As pessoas da escola: 2.000 ativas e 30 desativadas há mais de 12 meses. Sem elas, com a escola estimada em uma linha, o
        // índice parcial `usuario_desativado_idx` e a chave única `(escola_id, conta_id, papel)` empatam no custo, e quem ganha é a
        // estatística que o banco tinha de `usuario`: tabela nunca analisada ou com `reltuples` velho trocava o índice do lote.
        // Com o volume e o `analyze`, ler as ativas pela chave única custa muito mais que ler só as 30 desativadas pelo parcial.
        await cliente.query("insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno ativo sintético ' || n from generate_series(1, 2000) as n", [a.escolaId])
        await cliente.query(
          "insert into usuario (escola_id, papel, nome, desativado_em) select $1, 'aluno', 'Aluno desativado sintético ' || n, $2::timestamptz - interval '13 months' - n * interval '1 day' from generate_series(1, 30) as n",
          [a.escolaId, QUARTA_1H.toISOString()],
        )
        for (const tabela of ['usuario', 'mensagem_tutor', 'sinal_tutor', 'mensagem_agente', 'execucao_agente', 'consumo_ia', 'artefato']) await cliente.query(`analyze ${tabela}`)
        // O teste afirma que o índice SERVE ao lote (predicado e ordem), e não que o planejador o prefere pelo custo. Com a
        // varredura sequencial, a ordenação e o bitmap desligados, o único plano sem nó desabilitado é o que desce pelo índice
        // cuja chave é `(escola_id, <data>)`: nos alvos com `order by`, só o índice do lote dá essa ordem. Sem isso a escolha
        // era por custo, e com a escola estimada em uma linha quem desempatava era o tamanho físico do índice que as outras
        // execuções deixaram (12 linhas em 20 páginas custam uma página a mais); na `reivindicacao` nem o volume resolve,
        // porque o planejador não lê estatística de índice parcial de expressão. `enable_sort` não desliga a ordenação
        // incremental, que é a do lote de pessoas (`order by desativado_em, id`). `enable_bitmapscan` protege os alvos sem
        // `order by`, onde o bitmap seria o outro caminho; não o tire por parecer redundante. O que fica fora do teste é a
        // escolha real do índice em produção, com a estatística de uma escola grande: aqui só se prova que ele serve.
        await cliente.query('set local enable_seqscan = off')
        await cliente.query('set local enable_sort = off')
        await cliente.query('set local enable_bitmapscan = off')
        const prazo: PrazoDoLote = { agora: QUARTA_1H, meses: 12, fuso: FUSO }
        const doLote = (alvo: Parameters<typeof expurgoSchoolBatchStatement>[0]) => expurgoSchoolBatchStatement(alvo, a.escolaId, prazo, LOTE_DO_EXPURGO)
        for (const [alvo, indice, instrucao] of [
          ['mensagem_tutor', 'mensagem_tutor_criada_em_idx', doLote('mensagem_tutor')],
          ['sinal_tutor', 'sinal_tutor_criado_em_idx', doLote('sinal_tutor')],
          ['mensagem_agente', 'mensagem_agente_criada_em_idx', doLote('mensagem_agente')],
          // Os de anonimização (tarefa 4.0), cada um pelo índice parcial da 0026.
          ['execucao_agente', 'execucao_agente_a_anonimizar_idx', doLote('execucao_agente')],
          ['execucao_agente_do_tutor', 'execucao_agente_do_tutor_a_anonimizar_idx', doLote('execucao_agente_do_tutor')],
          ['consumo_ia_texto', 'consumo_ia_texto_a_anular_idx', doLote('consumo_ia_texto')],
          ['consumo_ia_aluno', 'consumo_ia_aluno_a_anular_idx', doLote('consumo_ia_aluno')],
          ['artefato_autoria', 'artefato_autoria_idx', doLote('artefato_autoria')],
          // Os da tarefa 5.0, cada um pelo índice parcial da 0027: o registro do expurgo desce pelo `(escola_id, em)` da 0025, e o
          // trabalho do aluno, que desce pelo ano letivo, tem o teste dele logo abaixo, com volume.
          ['reivindicacao', 'reivindicacao_decidida_idx', doLote('reivindicacao')],
          ['material', 'material_excluido_idx', doLote('material')],
          ['vinculo', 'vinculo_encerrado_idx', doLote('vinculo')],
          ['usuario', 'usuario_desativado_idx', expurgoDeactivatedPeopleStatement(a.escolaId, prazo, 100)],
          ['expurgo_execucao', 'expurgo_execucao_escola_em_idx', expurgoRecordStatement(a.escolaId, QUARTA_1H, LOTE_DO_EXPURGO)],
        ] as const) {
          const { sql: texto, params } = new PgDialect({ casing: 'snake_case' }).sqlToQuery(instrucao)
          const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: NoDoPlano }> }>(`explain (format json) ${texto}`, params)
          const nos = nosDoPlano(rows[0]?.['QUERY PLAN'][0]?.Plan)
          // O plano resumido vai na mensagem: a falha que não repete precisa deixar o plano que falhou.
          const resumo = `${alvo}: ${nos.map((no) => `${no['Node Type'] ?? '?'} ${no['Index Name'] ?? '-'} (custo ${String(no['Total Cost'])}, ${String(no['Plan Rows'])} linhas)`).join(' > ')}`
          const tipos = nos.map((no) => no['Node Type'])
          expect(nos.map((no) => no['Index Name']).filter(Boolean), resumo).toContain(indice)
          expect(tipos, resumo).not.toContain('Seq Scan')
          // O lote desce pelo índice já na ordem e para no limite: ordenar depois de ler é ler a escola inteira. A comparação é
          // pelo tipo exato do nó, então `Incremental Sort` passa: é a ordenação do lote de pessoas (`usuario`), e só dele; nos
          // outros alvos o nome do índice, exigido acima, é o que fecha esse furo.
          expect(tipos, resumo).not.toContain('Sort')
        }
      } finally {
        await cliente.query('rollback')
        cliente.release()
      }
    })

    it('o lote do trabalho do aluno desce pelo ano letivo encerrado, pela chave única da tentativa, e não varre as tentativas da escola', async () => {
      const a = await escolaNova()
      const professorId = await professorNovo(a)
      // Dois anos letivos da escola, um encerrado há 13 meses e o outro há 1, cada um com 30 atividades aplicadas e a tentativa
      // de 40 alunos em todas (2.400 no total). Sem o volume, o plano de uma tabela vazia varreria as tentativas pelo índice do
      // aluno, e não mostraria o caminho de uma escola com dados.
      const anos = [await anoQueTerminou(a, QUARTA_1H, '13 months'), await anoQueTerminou(a, QUARTA_1H, '1 month')]
      const alunos = (
        await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno sintético ' || n from generate_series(1, 40) as n returning id", [a.escolaId])
      ).rows.map(({ id }) => id)
      const cliente = await bancada.pool.connect()
      try {
        await cliente.query('begin')
        for (const ano of anos) {
          await cliente.query(
            `with atividade as (
               insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo)
               values ($1, $2, $3, $4, 'atividade_objetiva', 'Atividade sintética', '{"tipo":"atividade_objetiva","titulo":"Atividade sintética"}') returning id
             ), aplicadas as (
               insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, estado, aplicada_por, encerrada_em)
               select $1, $2, $3, atividade.id, false, 'encerrada', $5, now() from atividade cross join generate_series(1, 30) returning id
             )
             insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, enviada_em)
             select $1, $2, aplicadas.id, aluno, now() from aplicadas cross join unnest($6::uuid[]) as aluno`,
            [a.escolaId, ano.anoId, ano.turmaId, ano.disciplinaId, professorId, alunos],
          )
        }
        for (const tabela of ['tentativa_atividade', 'ano_letivo', 'atividade_aplicada']) await cliente.query(`analyze ${tabela}`)
        await cliente.query('set local enable_seqscan = off')
        const { sql: texto, params } = new PgDialect({ casing: 'snake_case' }).sqlToQuery(
          expurgoSchoolBatchStatement('tentativa_atividade', a.escolaId, { agora: QUARTA_1H, meses: 12, fuso: FUSO }, LOTE_DO_EXPURGO),
        )
        const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: NoDoPlano }> }>(`explain (format json) ${texto}`, params)
        const nos = nosDoPlano(rows[0]?.['QUERY PLAN'][0]?.Plan)
        const indices = nos.map((no) => no['Index Name']).filter(Boolean)
        expect(indices).toContain('tentativa_atividade_uma_por_aluno')
        expect(indices).not.toContain('tentativa_atividade_aluno_idx')
        expect(nos.map((no) => no['Node Type'])).not.toContain('Seq Scan')

        // A FK do aluno (`on delete cascade`) acha as tentativas dele por `(escola_id, aluno_id)`: é a consulta que a eliminação
        // do aluno dispara por pessoa. Com o volume, ela desce pelo índice próprio, e não pela chave única do ano.
        const { rows: porAluno } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: NoDoPlano }> }>(
          'explain (format json) delete from only tentativa_atividade where escola_id = $1 and aluno_id = $2',
          [a.escolaId, alunos[0]],
        )
        const nosDoAluno = nosDoPlano(porAluno[0]?.['QUERY PLAN'][0]?.Plan)
        expect(nosDoAluno.map((no) => no['Index Name']).filter(Boolean)).toContain('tentativa_atividade_aluno_idx')
        expect(nosDoAluno.map((no) => no['Node Type'])).not.toContain('Seq Scan')
      } finally {
        await cliente.query('rollback')
        cliente.release()
      }
    })

    it('as FKs `set null` da pessoa (execucao_agente.solicitada_por e artefato.criado_por) descem pelo índice próprio, e não leem todas as linhas da escola', async () => {
      const a = await escolaNova()
      const professorId = await professorNovo(a)
      const outroProfessorId = await professorNovo(a)
      const { anoId, turmaId, disciplinaId } = await anoQueTerminou(a, QUARTA_1H, '1 month')
      const cliente = await bancada.pool.connect()
      try {
        await cliente.query('begin')
        // Uma linha por turno do Tutor e um artefato por geração: as duas tabelas crescem com o uso, e sem o volume o plano de uma
        // tabela vazia não mostraria o caminho de uma escola com dados. O outro professor tem quatro vezes mais: se todas as linhas
        // da escola fossem da pessoa eliminada, o índice por escola e ano (`artefato_autoria_idx`) devolveria as mesmas linhas
        // e, sendo menor, ganharia do índice por pessoa sem que ele fizesse falta.
        await cliente.query(
          `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por)
           select $1, $2, $3, $4, 'plano_de_aula', 'Plano sintético', '{"tipo":"plano_de_aula","titulo":"Plano sintético"}', case when n <= 2000 then $5::uuid else $6::uuid end from generate_series(1, 10000) as n`,
          [a.escolaId, anoId, turmaId, disciplinaId, professorId, outroProfessorId],
        )
        await cliente.query(
          `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada)
           select $1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', case when n <= 2000 then $3::uuid else $4::uuid end, gen_random_uuid(), '{"tarefa":"turno_do_tutor"}'::jsonb from generate_series(1, 10000) as n`,
          [a.escolaId, anoId, professorId, outroProfessorId],
        )
        for (const tabela of ['artefato', 'execucao_agente']) await cliente.query(`analyze ${tabela}`)
        // O `enable_seqscan = off` é intencional: quem prova a regra é o nome do índice no plano; a ausência de Seq Scan é só reforço. A escolha sem esse empurrão está no EXPLAIN do 5_task.md.
        await cliente.query('set local enable_seqscan = off')
        const consultas = [
          { texto: 'update only execucao_agente set solicitada_por = null where escola_id = $1 and solicitada_por = $2', indice: 'execucao_agente_solicitada_por_idx' },
          { texto: 'update only artefato set criado_por = null where escola_id = $1 and criado_por = $2', indice: 'artefato_criado_por_idx' },
        ]
        for (const { texto, indice } of consultas) {
          const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: NoDoPlano }> }>(`explain (format json) ${texto}`, [a.escolaId, professorId])
          const nos = nosDoPlano(rows[0]?.['QUERY PLAN'][0]?.Plan)
          expect(nos.map((no) => no['Index Name']).filter(Boolean), texto).toContain(indice)
          expect(nos.map((no) => no['Node Type']), texto).not.toContain('Seq Scan')
        }
      } finally {
        await cliente.query('rollback')
        cliente.release()
      }
    })
  })

  describe('concorrência', () => {
    it('[P] dois jobs da mesma escola ao mesmo tempo apagam linhas diferentes, e as contagens somam o que saiu', async () => {
      const a = await escolaNova()
      for (let indice = 0; indice < 30; indice += 1) await mensagemTutor(a, QUARTA_1H, '13 months')
      await Promise.all([rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { lote: 5 })), rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { lote: 5 }))])
      expect(await quantas('mensagem_tutor', a.escolaId)).toBe(0)
      const linhas = (await execucoes(a.escolaId)).filter((linha) => linha.categoria === 'conversa_tutor')
      expect(linhas).toHaveLength(2)
      expect(linhas.reduce((soma, linha) => soma + linha.linhas, 0)).toBe(30)
    })

    it('[P] a mesma chave ao mesmo tempo dá um job só, e as duas gravações devolvem o mesmo id', async () => {
      const a = await escolaNova()
      const chave = `chave-${randomUUID()}`
      const gravar = () => runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () => bancada.banco.transaction((tx) => bancada.enfileirador.enfileirarUmaVez(tx, TIPO_EXPURGAR_ESCOLA, {}, chave)))
      // A primeira para depois de inserir, sem confirmar; a segunda chega e espera no índice único; só então a primeira segue.
      const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'job_registro', evento: 'insert', quando: `new.chave_idempotencia = '${chave}'` })
      await gatilho.armar()
      onTestFinished(() => gatilho.desarmar())
      const primeira = gravar()
      await gatilho.esperarParadas(1)
      const segunda = gravar()
      await esperarNaTrava(bancada.pool, '%insert into "job_registro"%', 2)
      await gatilho.soltar()
      const [um, dois] = await Promise.all([primeira, segunda])
      expect(um.situacao).toBe('enfileirado')
      expect(dois).toEqual({ situacao: 'ja_enfileirado', id: um.id })
      expect((await jobsDoExpurgo(a.escolaId)).map(({ id }) => id)).toEqual([um.id])
    })

    it('a colisão com um job que terminou entre a colisão e a leitura devolve nulo; e, terminado, a mesma chave grava outro job', async () => {
      const a = await escolaNova()
      const chave = `chave-${randomUUID()}`
      const linha = { tipo: TIPO_EXPURGAR_ESCOLA, fila: 'lote' as const, prioridade: 3, naoUrgente: true, dados: {} }
      const noContexto = <T>(funcao: () => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, funcao)
      // Três jobs pendentes que só diferem do da chave numa coisa: a chave, o tipo ou a escola. A leitura da colisão não
      // pode devolver nenhum deles.
      const b = await escolaNova()
      await noContexto(() => bancada.banco.transaction((tx) => bancada.registro.inserirUmaVez(tx, linha, `outra-${chave}`)))
      await noContexto(() => bancada.banco.transaction((tx) => bancada.registro.inserirUmaVez(tx, { ...linha, tipo: 'retencao.outro-tipo' }, chave)))
      await runInContext({ requisicaoId: randomUUID(), escolaId: b.escolaId }, () => bancada.banco.transaction((tx) => bancada.registro.inserirUmaVez(tx, linha, chave)))
      const primeiro = await noContexto(() => bancada.banco.transaction((tx) => bancada.registro.inserirUmaVez(tx, linha, chave)))
      if (primeiro.situacao !== 'enfileirado') throw new Error('o primeiro job deveria ter entrado')
      const terminarOPrimeiro = async () => {
        await bancada.pool.query("update job_registro set estado = 'concluido', concluido_em = now() where id = $1", [primeiro.id])
      }
      const colisao = await noContexto(() => bancada.banco.transaction((tx) => bancada.registro.inserirUmaVez(tx, linha, chave, terminarOPrimeiro)))
      expect(colisao).toEqual({ situacao: 'ja_enfileirado', id: null })
      const depois = await noContexto(() => bancada.banco.transaction((tx) => bancada.registro.inserirUmaVez(tx, linha, chave)))
      expect(depois.situacao).toBe('enfileirado')
      expect((await jobsDoExpurgo(a.escolaId)).filter((job) => job.chave === chave)).toHaveLength(2)
      expect(await jobsDoExpurgo(b.escolaId)).toHaveLength(1)
    })

    it('o despachante é acordado quando o job da chave entra, e não na colisão', async () => {
      const a = await escolaNova()
      const chave = `chave-${randomUUID()}`
      const ouvinte = await bancada.pool.connect()
      let avisos = 0
      ouvinte.on('notification', ({ channel }) => {
        if (channel === 'job') avisos += 1
      })
      try {
        await ouvinte.query('listen job')
        const gravar = () => runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () => bancada.banco.transaction((tx) => bancada.enfileirador.enfileirarUmaVez(tx, TIPO_EXPURGAR_ESCOLA, {}, chave)))
        await gravar()
        await expect.poll(() => avisos, { timeout: 5_000, interval: 20 }).toBe(1)
        expect((await gravar()).situacao).toBe('ja_enfileirado')
        // O aviso sai no commit: meio segundo depois do da colisão, nenhum chegou.
        await new Promise((resolver) => setTimeout(resolver, 500))
        expect(avisos).toBe(1)
      } finally {
        await ouvinte.query('unlisten job')
        ouvinte.release()
      }
    })

    it('a chave sem escola é recusada: pelo código, na rotina do sistema, e pelo banco, no insert direto', async () => {
      const linha = { tipo: 'sistema.qualquer-rotina', fila: 'lote' as const, prioridade: 3, naoUrgente: true, dados: {} }
      await expect(
        runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => bancada.banco.transaction((tx) => bancada.registro.inserirUmaVez(tx, linha, 'sem-escola'))),
      ).rejects.toThrow('chave de idempotência só em job de escola')
      // O job de escola, pedido sem escola no contexto, também é recusado pelo código, antes do banco.
      await expect(
        runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () =>
          bancada.banco.transaction((tx) => bancada.registro.inserirUmaVez(tx, { ...linha, tipo: TIPO_EXPURGAR_ESCOLA }, 'sem-escola')),
        ),
      ).rejects.toThrow('chave de idempotência só em job de escola')
      const a = await escolaNova()
      await expect(
        runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () => bancada.banco.transaction((tx) => bancada.registro.inserirUmaVez(tx, linha, 'tipo-de-sistema'))),
      ).rejects.toThrow('chave de idempotência só em job de escola')
      await expect(
        bancada.pool.query("insert into job_registro (fila, prioridade, tipo, chave_idempotencia) values ('lote', 3, 'sistema.qualquer-rotina', 'sem-escola')"),
      ).rejects.toMatchObject({ code: '23514', constraint: 'job_registro_chave_so_com_escola' })
    })
  })

  describe('rotina sistema.expurgar-dado-pessoal', () => {
    it('grava um `retencao.expurgar-escola` por escola, na fila de lote, não urgente, com a data local da escola como chave; o log só tem contagens', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      await bancada.configurarEscola(b.escolaId, { fuso: 'America/Rio_Branco' })
      // Meia-noite e meia de quarta em São Paulo é 22h30 de terça em Rio Branco.
      await rodarRotina(rotina(relogioEm(new Date('2026-10-07T00:30:00-03:00')), [a.escolaId, b.escolaId]))
      expect((await jobsDoExpurgo(a.escolaId)).map(({ chave, fila, prioridade, naoUrgente, estado }) => ({ chave, fila, prioridade, naoUrgente, estado }))).toEqual([
        { chave: '2026-10-07', fila: 'lote', prioridade: 3, naoUrgente: true, estado: 'aguardando' },
      ])
      expect((await jobsDoExpurgo(b.escolaId)).map(({ chave }) => chave)).toEqual(['2026-10-06'])
      const disparos = log.doEvento('retencao.rotina_disparada')
      expect(disparos.at(-1)).toMatchObject({ escolasTotal: 2, enfileiradosTotal: 2, jaEnfileiradosTotal: 0, falhasTotal: 0 })
      const daRetencao = log.registros().filter((linha) => String(linha['evento']).startsWith('retencao.'))
      expect(daRetencao.length).toBeGreaterThan(0)
      for (const linha of daRetencao) for (const chave of Object.keys(linha)) expect(CHAVES_DO_LOG.has(chave), chave).toBe(true)
      expect(log.linhas.join('\n')).not.toContain('sintética')
    })

    it('às 23h59 e às 0h01 locais as chaves são diferentes; rodar de novo às 23h59 não cria outro job', async () => {
      const a = await escolaNova()
      await rodarRotina(rotina(relogioEm(new Date('2026-10-06T23:59:00-03:00')), [a.escolaId]))
      await rodarRotina(rotina(relogioEm(new Date('2026-10-06T23:59:00-03:00')), [a.escolaId]))
      expect((await jobsDoExpurgo(a.escolaId)).map(({ chave }) => chave)).toEqual(['2026-10-06'])
      await rodarRotina(rotina(relogioEm(new Date('2026-10-07T00:01:00-03:00')), [a.escolaId]))
      expect((await jobsDoExpurgo(a.escolaId)).map(({ chave }) => chave)).toEqual(['2026-10-06', '2026-10-07'])
      expect(chaveDaNoite('America/Sao_Paulo', new Date('2026-10-06T23:59:00-03:00'))).not.toBe(chaveDaNoite('America/Sao_Paulo', new Date('2026-10-07T00:01:00-03:00')))
    })

    it('[P] duas rotinas ao mesmo tempo criam um job por escola', async () => {
      const ids = [(await escolaNova()).escolaId, (await escolaNova()).escolaId, (await escolaNova()).escolaId]
      const relogio = relogioEm(QUARTA_1H)
      await Promise.all([rodarRotina(rotina(relogio, ids)), rodarRotina(rotina(relogio, ids))])
      for (const escolaId of ids) expect(await jobsDoExpurgo(escolaId), escolaId).toHaveLength(1)
      const disparos = log.doEvento('retencao.rotina_disparada').slice(-2)
      expect(disparos.reduce((soma, linha) => soma + Number(linha['enfileiradosTotal']), 0)).toBe(3)
      expect(disparos.reduce((soma, linha) => soma + Number(linha['jaEnfileiradosTotal']), 0)).toBe(3)
    })

    it('uma escola que falha não segura as outras, e o job falha no fim para a fila tentar de novo', async () => {
      const a = await escolaNova()
      // Uma escola que não existe no banco: a FK de `job_registro` recusa o job dela.
      const inexistente = randomUUID()
      await expect(rodarRotina(rotina(relogioEm(QUARTA_1H), [inexistente, a.escolaId]))).rejects.toThrow('expurgo não enfileirado em alguma escola')
      expect(await jobsDoExpurgo(a.escolaId)).toHaveLength(1)
      expect(log.doEvento('retencao.escola_nao_enfileirada').some((linha) => linha['escolaId'] === inexistente)).toBe(true)
    })

    it('permissão: a rotina só roda como rotina do sistema, e o job da escola só no contexto de uma escola', async () => {
      const a = await escolaNova()
      await expect(runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () => rotina(relogioEm(QUARTA_1H), [a.escolaId])({}, execucaoDoJob('x')))).rejects.toMatchObject({
        name: 'FalhaDeJob',
        codigo: JobFailureCode.DADOS_INVALIDOS,
      })
      expect(await jobsDoExpurgo(a.escolaId)).toEqual([])
      const vencida = await mensagemTutor(a, QUARTA_1H, '13 months')
      await expect(rodarRotina(expurgo(relogioEm(QUARTA_1H)))).rejects.toMatchObject({ name: 'FalhaDeJob', codigo: JobFailureCode.DADOS_INVALIDOS })
      expect(await existe('mensagem_tutor', vencida)).toBe(true)
    })

    it('a lista de escolas da rotina traz as escolas do banco, só pelo id', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const ids = await new CronEscolasRepository(bancada.banco).listarIds()
      expect(ids).toEqual(expect.arrayContaining([a.escolaId, b.escolaId]))
      expect(ids.every((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id))).toBe(true)
    })
  })

  describe('lote por tabela', () => {
    it.each(['mensagem_tutor', 'sinal_tutor', 'mensagem_agente'] as const)('%s: o lote leva primeiro a mais antiga, e pula, sem esperar, a linha que outra transação travou', async (alvo) => {
      const a = await escolaNova()
      const semear = async (idade: string): Promise<string> => {
        if (alvo === 'mensagem_tutor') return mensagemTutor(a, QUARTA_1H, idade)
        if (alvo === 'sinal_tutor') return sinal(a, QUARTA_1H, idade)
        return mensagemAgente(a, await thread(a, QUARTA_1H, '1 day'), QUARTA_1H, idade)
      }
      // Gravadas fora da ordem da idade: entre as que não estão travadas, a mais antiga não é a primeira nem a última por id
      // (nem na ordem do heap). Sem o `order by` da data, ou com qualquer ordem por id, sairia uma das recentes.
      const recente = await semear('13 months')
      const antiga = await semear('20 months')
      const outraRecente = await semear('14 months')
      const travada = await semear('30 months')
      const repositorio = new ExpurgoDaEscolaRepository(bancada.banco)
      const lote = () => runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () => repositorio.expurgarLote(alvo, { agora: QUARTA_1H, meses: 12, fuso: FUSO }, 1))
      // Outra transação segura a mais antiga de todas: sem `skip locked`, o lote esperaria por ela até o prazo da instrução.
      const outra = await bancada.pool.connect()
      try {
        await outra.query('begin')
        await outra.query(`select 1 from ${alvo} where id = $1 for update`, [travada])
        expect(await lote()).toEqual({ linhas: 1, cheio: true })
        expect(await existe(alvo, antiga)).toBe(false)
        expect(await existe(alvo, recente)).toBe(true)
        expect(await existe(alvo, outraRecente)).toBe(true)
        expect(await existe(alvo, travada)).toBe(true)
      } finally {
        await outra.query('rollback')
        outra.release()
      }
    })

    it.each(['mensagem_tutor', 'sinal_tutor', 'mensagem_agente', 'thread_agente'] as const)('%s: o lote apaga no máximo o limite, diz que veio cheio, e o seguinte leva o resto', async (alvo) => {
      const a = await escolaNova()
      const b = await escolaNova()
      const semear = async (escola: Escola, idade: string) => {
        if (alvo === 'mensagem_tutor') await mensagemTutor(escola, QUARTA_1H, idade)
        if (alvo === 'sinal_tutor') await sinal(escola, QUARTA_1H, idade)
        if (alvo === 'mensagem_agente') await mensagemAgente(escola, await thread(escola, QUARTA_1H, '1 day'), QUARTA_1H, idade)
        if (alvo === 'thread_agente') await thread(escola, QUARTA_1H, idade)
      }
      for (let indice = 0; indice < 3; indice += 1) await semear(a, '13 months')
      // B tem linhas vencidas mais antigas que as de A: o lote de A, que desce pela idade, não pode escolhê-las.
      for (let indice = 0; indice < 3; indice += 1) await semear(b, '20 months')
      const repositorio = new ExpurgoDaEscolaRepository(bancada.banco)
      const lote = () => runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () => repositorio.expurgarLote(alvo, { agora: QUARTA_1H, meses: 12, fuso: FUSO }, 2))
      expect(await lote()).toEqual({ linhas: 2, cheio: true })
      expect(await lote()).toEqual({ linhas: 1, cheio: false })
      expect(await lote()).toEqual({ linhas: 0, cheio: false })
      expect(await quantas(alvo, b.escolaId)).toBe(3)
    })
  })

  describe('lote por tabela (tarefa 5.0)', () => {
    const PRAZO = { agora: QUARTA_1H, meses: 12, fuso: FUSO } satisfies PrazoDoLote
    const lote = (escolaId: string, alvo: Exclude<AlvoDoExpurgoDaEscola, 'thread_agente'>, limite: number) =>
      runInContext({ requisicaoId: randomUUID(), escolaId }, () => new ExpurgoDaEscolaRepository(bancada.banco).expurgarLote(alvo, PRAZO, limite))

    /** Uma linha vencida do alvo, na idade pedida (para os alvos de data; o trabalho vai pelo `fim` do ano). */
    async function semear(alvo: 'tentativa_atividade' | 'reivindicacao' | 'material' | 'vinculo', escola: Escola, idade: string): Promise<string> {
      if (alvo === 'reivindicacao') return reivindicacaoFechada(escola, QUARTA_1H, idade)
      if (alvo === 'material') return materialDa(escola, QUARTA_1H, idade)
      if (alvo === 'vinculo') return vinculoDe(escola, 'encerrado', QUARTA_1H, idade)
      return (await trabalhoDoAluno(escola, await anoQueTerminou(escola, QUARTA_1H, idade), await alunoDesativado(escola, QUARTA_1H, '1 day'))).tentativaId
    }

    it.each(['reivindicacao', 'material', 'vinculo'] as const)('%s: o lote leva primeiro a mais antiga, e pula, sem esperar, a linha que outra transação travou', async (alvo) => {
      const a = await escolaNova()
      // Fora da ordem da idade: entre as que não estão travadas, a mais antiga não é a primeira nem a última por id.
      const recente = await semear(alvo, a, '13 months')
      const antiga = await semear(alvo, a, '20 months')
      const outraRecente = await semear(alvo, a, '14 months')
      const travada = await semear(alvo, a, '30 months')
      const outra = await bancada.pool.connect()
      try {
        await outra.query('begin')
        await outra.query(`select 1 from ${alvo} where id = $1 for update`, [travada])
        expect(await lote(a.escolaId, alvo, 1)).toEqual({ linhas: 1, cheio: true })
        expect(await existe(alvo, antiga)).toBe(false)
        for (const id of [recente, outraRecente, travada]) expect(await existe(alvo, id), id).toBe(true)
      } finally {
        await outra.query('rollback')
        outra.release()
      }
    })

    it('tentativa_atividade: o lote pula, sem esperar, a tentativa que outra transação travou, e leva a outra', async () => {
      const a = await escolaNova()
      const ano = await anoQueTerminou(a, QUARTA_1H, '13 months')
      const livre = await trabalhoDoAluno(a, ano, await alunoNovo(a.escolaId))
      const travada = await trabalhoDoAluno(a, ano, await alunoNovo(a.escolaId))
      const outra = await bancada.pool.connect()
      try {
        await outra.query('begin')
        await outra.query('select 1 from tentativa_atividade where id = $1 for update', [travada.tentativaId])
        // Com limite 2 e duas candidatas, uma travada: sem `skip locked` o lote esperaria a trava até o prazo da instrução.
        expect(await lote(a.escolaId, 'tentativa_atividade', 2)).toEqual({ linhas: 1, cheio: false })
        expect(await existe('tentativa_atividade', livre.tentativaId)).toBe(false)
        expect(await existe('tentativa_atividade', travada.tentativaId)).toBe(true)
      } finally {
        await outra.query('rollback')
        outra.release()
      }
    })

    it.each(['tentativa_atividade', 'reivindicacao', 'material', 'vinculo'] as const)('%s: o lote apaga no máximo o limite, diz que veio cheio, o seguinte leva o resto, e o de outra escola, mais antigo, não é tocado', async (alvo) => {
      const a = await escolaNova()
      const b = await escolaNova()
      for (let indice = 0; indice < 3; indice += 1) await semear(alvo, a, '13 months')
      const deB: string[] = []
      for (let indice = 0; indice < 3; indice += 1) deB.push(await semear(alvo, b, '20 months'))
      expect(await lote(a.escolaId, alvo, 2)).toEqual({ linhas: 2, cheio: true })
      expect(await lote(a.escolaId, alvo, 2)).toEqual({ linhas: 1, cheio: false })
      expect(await lote(a.escolaId, alvo, 2)).toEqual({ linhas: 0, cheio: false })
      const tabela = alvo
      for (const id of deB) expect(await existe(tabela, id), id).toBe(true)
    })

    it('[P] dois jobs da mesma escola ao mesmo tempo levam, nos quatro alvos que apagam, cada linha uma vez, e as contagens somam o total', async () => {
      const a = await escolaNova()
      const categorias = { tentativa_atividade: 'trabalho_do_aluno', reivindicacao: 'reivindicacao_decidida', material: 'material_excluido', vinculo: 'vinculo_encerrado' } as const
      for (const alvo of Object.keys(categorias) as Array<keyof typeof categorias>) for (let indice = 0; indice < 8; indice += 1) await semear(alvo, a, '61 months')
      await Promise.all([rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { lote: 3 })), rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { lote: 3 }))])
      for (const [alvo, categoria] of Object.entries(categorias)) {
        expect(await quantas(alvo, a.escolaId), alvo).toBe(0)
        const linhas = (await execucoes(a.escolaId)).filter((linha) => linha.categoria === categoria)
        expect(linhas, categoria).toHaveLength(2)
        expect(
          linhas.reduce((soma, linha) => soma + linha.linhas, 0),
          categoria,
        ).toBe(8)
      }
    })
  })

  describe('anonimização (tarefa 4.0)', () => {
    /** O estado de pessoa de cada alvo de anonimização: o que a linha ainda tem de quem. */
    const LER_PESSOA: Record<
      'execucao_agente' | 'execucao_agente_do_tutor' | 'consumo_ia_texto' | 'consumo_ia_aluno' | 'artefato_autoria',
      { tabela: string; temPessoa: string; doAlvo?: string }
    > = {
      execucao_agente: { tabela: 'execucao_agente', temPessoa: 'anonimizada_em is null' },
      execucao_agente_do_tutor: { tabela: 'execucao_agente', temPessoa: 'anonimizada_em is null', doAlvo: "funcao = 'tutor_com_o_aluno'" },
      consumo_ia_texto: { tabela: 'consumo_ia', temPessoa: 'entrada is not null or saida is not null' },
      consumo_ia_aluno: { tabela: 'consumo_ia', temPessoa: 'aluno_id is not null' },
      artefato_autoria: { tabela: 'artefato', temPessoa: 'criado_por is not null' },
    }
    type AlvoDeAnonimizacao = keyof typeof LER_PESSOA

    async function temPessoa(alvo: AlvoDeAnonimizacao, id: string): Promise<boolean> {
      const { tabela, temPessoa: condicao } = LER_PESSOA[alvo]
      const { rows } = await bancada.pool.query<{ tem: boolean }>(`select (${condicao}) as tem from ${tabela} where id = $1`, [id])
      const linha = rows[0]
      if (linha === undefined) throw new Error(`a linha ${id} sumiu: a anonimização mantém a linha`)
      return linha.tem
    }

    async function comPessoa(alvo: AlvoDeAnonimizacao, escolaId: string): Promise<number> {
      const { tabela, temPessoa: condicao, doAlvo = 'true' } = LER_PESSOA[alvo]
      const { rows } = await bancada.pool.query<{ total: number }>(`select count(*)::int as total from ${tabela} where escola_id = $1 and (${condicao}) and (${doAlvo})`, [escolaId])
      return rows[0]?.total ?? 0
    }

    /** Uma linha do alvo, com a idade pedida (a do `fim` do ano encerrado, na autoria). */
    async function semearAlvo(alvo: AlvoDeAnonimizacao, escola: Escola, idade: string): Promise<string> {
      if (alvo === 'execucao_agente') return execucaoComTema(escola, QUARTA_1H, idade)
      if (alvo === 'execucao_agente_do_tutor') return execucaoDoTutor(escola, QUARTA_1H, idade)
      if (alvo === 'consumo_ia_texto') return consumo(escola, QUARTA_1H, idade, { de: 'ferramenta' })
      if (alvo === 'consumo_ia_aluno') return consumo(escola, QUARTA_1H, idade, { de: 'tutor' })
      return artefatoDe(escola.escolaId, await anoQueTerminou(escola, QUARTA_1H, idade), await professorNovo(escola))
    }

    const lote = (repositorio: ExpurgoDaEscolaRepository, escolaId: string, alvo: AlvoDoExpurgoDaEscola, limite: number, agora = QUARTA_1H) =>
      runInContext({ requisicaoId: randomUUID(), escolaId }, () => repositorio.expurgarLote(alvo, { agora, meses: 12, fuso: FUSO }, limite))

    it.each(Object.keys(LER_PESSOA) as AlvoDeAnonimizacao[])(
      '%s: o lote alcança no máximo o limite, diz que veio cheio, o seguinte leva o resto, o que já perdeu a pessoa não é relido, e o de outra escola, mais antigo, fica',
      async (alvo) => {
        const a = await escolaNova()
        const b = await escolaNova()
        const deA = [await semearAlvo(alvo, a, '13 months'), await semearAlvo(alvo, a, '14 months'), await semearAlvo(alvo, a, '15 months')]
        // B tem linhas vencidas mais antigas que as de A: o lote de A, que desce pela idade, não pode escolhê-las.
        for (let indice = 0; indice < 3; indice += 1) await semearAlvo(alvo, b, '20 months')
        const repositorio = new ExpurgoDaEscolaRepository(bancada.banco)
        expect(await lote(repositorio, a.escolaId, alvo, 2)).toEqual({ linhas: 2, cheio: true })
        expect(await lote(repositorio, a.escolaId, alvo, 2)).toEqual({ linhas: 1, cheio: false })
        // Toda linha de A já perdeu a pessoa e continua lá: o terceiro lote não acha nada.
        expect(await lote(repositorio, a.escolaId, alvo, 2)).toEqual({ linhas: 0, cheio: false })
        for (const id of deA) expect(await temPessoa(alvo, id), id).toBe(false)
        expect(await comPessoa(alvo, b.escolaId)).toBe(3)
      },
    )

    it.each(['execucao_agente', 'execucao_agente_do_tutor', 'consumo_ia_texto', 'consumo_ia_aluno'] as const)(
      '%s: o lote leva primeiro a mais antiga, pula sem esperar a linha que outra transação travou para mudar, e não pula a que só tem a trava de FK de quem aponta para ela',
      async (alvo) => {
        const a = await escolaNova()
        // Gravadas fora da ordem da idade: sem o `order by` da data, ou com qualquer ordem por id, sairia uma das recentes.
        const recente = await semearAlvo(alvo, a, '13 months')
        const antiga = await semearAlvo(alvo, a, '20 months')
        const outraRecente = await semearAlvo(alvo, a, '14 months')
        const travada = await semearAlvo(alvo, a, '30 months')
        const comFk = await semearAlvo(alvo, a, '40 months')
        const tabela = LER_PESSOA[alvo].tabela
        const repositorio = new ExpurgoDaEscolaRepository(bancada.banco)
        const outra = await bancada.pool.connect()
        try {
          await outra.query('begin')
          // A mais antiga de todas só tem a trava que a conferência de uma FK toma (a mensagem nova apontando para a
          // execução): ela não impede o lote. A seguinte está travada para mudar: o lote a pula, sem esperar.
          await outra.query(`select 1 from ${tabela} where id = $1 for key share`, [comFk])
          await outra.query(`select 1 from ${tabela} where id = $1 for update`, [travada])
          expect(await lote(repositorio, a.escolaId, alvo, 1)).toEqual({ linhas: 1, cheio: true })
          expect(await temPessoa(alvo, comFk)).toBe(false)
          expect(await lote(repositorio, a.escolaId, alvo, 1)).toEqual({ linhas: 1, cheio: true })
          expect(await temPessoa(alvo, antiga)).toBe(false)
          expect(await temPessoa(alvo, travada)).toBe(true)
          expect(await temPessoa(alvo, recente)).toBe(true)
          expect(await temPessoa(alvo, outraRecente)).toBe(true)
        } finally {
          await outra.query('rollback')
          outra.release()
        }
      },
    )

    it('artefato_autoria: o lote pula sem esperar o artefato travado para mudar, e não pula o que só tem a trava de FK (a entrega nova que aponta para ele) nem o do ano que está sendo mudado', async () => {
      const a = await escolaNova()
      const travado = await semearAlvo('artefato_autoria', a, '61 months')
      const comFk = await semearAlvo('artefato_autoria', a, '62 months')
      const livre = await semearAlvo('artefato_autoria', a, '63 months')
      const repositorio = new ExpurgoDaEscolaRepository(bancada.banco)
      const outra = await bancada.pool.connect()
      try {
        await outra.query('begin')
        await outra.query('select 1 from artefato where id = $1 for update', [travado])
        await outra.query('select 1 from artefato where id = $1 for key share', [comFk])
        // O ano do artefato livre está sendo mudado pela coordenação: o lote trava só o artefato, e não o pula por isso.
        await outra.query('select 1 from ano_letivo where id = (select ano_letivo_id from artefato where id = $1) for no key update', [livre])
        expect(await lote(repositorio, a.escolaId, 'artefato_autoria', 5)).toEqual({ linhas: 2, cheio: false })
        expect(await temPessoa('artefato_autoria', comFk)).toBe(false)
        expect(await temPessoa('artefato_autoria', livre)).toBe(false)
        expect(await temPessoa('artefato_autoria', travado)).toBe(true)
      } finally {
        await outra.query('rollback')
        outra.release()
      }
    })

    it('travas: com a conversa do professor em 3 meses, o tema da execução e o texto do modelo saem em 3; com a conversa do Tutor em 6, o aluno do consumo de 7 meses é anulado; a escola sem ajuste fica com os 12', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      await ajustar(a.escolaId, 'conversa_professor', 3)
      await ajustar(a.escolaId, 'conversa_tutor', 6)
      const semear = async (escola: Escola, idade: string) => ({
        execucao: await execucaoComTema(escola, QUARTA_1H, idade),
        texto: await consumo(escola, QUARTA_1H, idade, { de: 'ferramenta' }),
        aluno: await consumo(escola, QUARTA_1H, idade, { de: 'tutor' }),
      })
      const quatroMeses = await semear(a, '4 months')
      const doisMeses = await semear(a, '2 months')
      const seteMeses = await consumo(a, QUARTA_1H, '7 months', { de: 'tutor' })
      const cincoMeses = await consumo(a, QUARTA_1H, '5 months', { de: 'tutor' })
      const deB = await semear(b, '7 months')
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      await rodar(b.escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect(await temPessoa('execucao_agente', quatroMeses.execucao)).toBe(false)
      expect(await temPessoa('consumo_ia_texto', quatroMeses.texto)).toBe(false)
      expect(await temPessoa('execucao_agente', doisMeses.execucao)).toBe(true)
      expect(await temPessoa('consumo_ia_texto', doisMeses.texto)).toBe(true)
      // O aluno do consumo segue a conversa do Tutor (6), não a conversa do professor (3): o de 5 meses fica.
      expect(await temPessoa('consumo_ia_aluno', seteMeses)).toBe(false)
      expect(await temPessoa('consumo_ia_aluno', cincoMeses)).toBe(true)
      expect(await temPessoa('consumo_ia_aluno', quatroMeses.aluno)).toBe(true)
      // O menor dos dois prazos vale nos dois sentidos: a execução do Tutor de 4 meses a que esse consumo aponta já saiu pela
      // execução (3, pela conversa do professor), embora o consumo fique com o aluno (6).
      const { rows: daExecucao } = await bancada.pool.query<{ solicitadaPor: string | null }>(
        'select e.solicitada_por as "solicitadaPor" from consumo_ia c join execucao_agente e on e.escola_id = c.escola_id and e.id = c.execucao_id where c.id = $1',
        [quatroMeses.aluno],
      )
      expect(daExecucao).toEqual([{ solicitadaPor: null }])
      // Em B, sem ajuste, valem os 12 meses do catálogo.
      expect(await temPessoa('execucao_agente', deB.execucao)).toBe(true)
      expect(await temPessoa('consumo_ia_texto', deB.texto)).toBe(true)
      expect(await temPessoa('consumo_ia_aluno', deB.aluno)).toBe(true)
    })

    it('checks: as execuções `pendente`, `rodando`, `concluida` e `falhou` anonimizadas passam nos checks da 0022 e da 0023, com o estado, o resultado, o erro e as datas como estavam', async () => {
      const a = await escolaNova()
      const estados = ['pendente', 'rodando', 'concluida', 'falhou'] as const
      const ids = Object.fromEntries(await Promise.all(estados.map(async (estado) => [estado, await execucaoComTema(a, QUARTA_1H, '13 months', estado)] as const)))
      const ler = () =>
        bancada.pool.query<{ id: string; estado: string; resultado: unknown; erro: string | null; iniciadaEm: Date | null; concluidaEm: Date | null }>(
          `select id, estado, resultado, erro, iniciada_em as "iniciadaEm", concluida_em as "concluidaEm" from execucao_agente where escola_id = $1 order by id`,
          [a.escolaId],
        )
      const antes = (await ler()).rows
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect((await ler()).rows).toEqual(antes)
      for (const estado of estados) {
        const { rows } = await bancada.pool.query<{ entrada: unknown; solicitadaPor: string | null; anonimizadaEm: Date | null }>(
          'select entrada, solicitada_por as "solicitadaPor", anonimizada_em as "anonimizadaEm" from execucao_agente where id = $1',
          [ids[estado]],
        )
        expect(rows[0], estado).toEqual({ entrada: { tarefa: 'gerar_plano_de_aula' }, solicitadaPor: null, anonimizadaEm: QUARTA_1H })
      }
      expect((await execucoes(a.escolaId)).find((linha) => linha.categoria === 'execucao_agente')).toEqual({ categoria: 'execucao_agente', linhas: 4, concluida: true })
    })

    it('reexecutar não mexe na execução já anonimizada: `anonimizada_em` fica com a data da primeira noite', async () => {
      const a = await escolaNova()
      const id = await execucaoComTema(a, QUARTA_1H, '13 months')
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      await rodar(a.escolaId, expurgo(relogioEm(QUINTA_1H)))
      const { rows } = await bancada.pool.query<{ anonimizadaEm: Date }>('select anonimizada_em as "anonimizadaEm" from execucao_agente where id = $1', [id])
      expect(rows[0]?.anonimizadaEm).toEqual(QUARTA_1H)
      expect((await execucoes(a.escolaId)).filter((linha) => linha.categoria === 'execucao_agente').map(({ linhas }) => linhas)).toEqual([1, 0])
    })

    it('o consumo do Tutor, que nasce sem texto, só perde o aluno: o texto do modelo conta só as chamadas que tinham texto, com entrada ou só com saída', async () => {
      const a = await escolaNova()
      const doTutor = await consumo(a, QUARTA_1H, '13 months', { de: 'tutor' })
      const soEntrada = await consumo(a, QUARTA_1H, '13 months', { de: 'ferramenta', saida: false })
      const soSaida = await consumo(a, QUARTA_1H, '13 months', { de: 'ferramenta', entrada: false })
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      const linhas = Object.fromEntries((await execucoes(a.escolaId)).map(({ categoria, linhas: total }) => [categoria, total]))
      // A execução do Tutor, com 13 meses, já perdeu o aluno na categoria `execucao_agente`, que vem antes: o consumo por aluno
      // conta só o consumo.
      expect({ texto: linhas['texto_do_modelo'], aluno: linhas['consumo_por_aluno'] }).toEqual({ texto: 2, aluno: 1 })
      const { rows } = await bancada.pool.query<{ id: string; alunoId: string | null; entrada: unknown; saida: unknown }>(
        'select id, aluno_id as "alunoId", entrada, saida from consumo_ia where escola_id = $1',
        [a.escolaId],
      )
      expect(rows.map(({ id, alunoId, entrada, saida }) => ({ id, alunoId, entrada, saida })).sort((x, y) => x.id.localeCompare(y.id))).toEqual(
        [doTutor, soEntrada, soSaida].map((id) => ({ id, alunoId: null, entrada: null, saida: null })).sort((x, y) => x.id.localeCompare(y.id)),
      )
    })

    it('a linha antiga do consumo (envio externo e sem `provedor`, de antes da migration 0031) passa pelo expurgo sem esbarrar no check, e a linha fica', async () => {
      const a = await escolaNova()
      const antiga = await consumo(a, QUARTA_1H, '13 months', { de: 'ferramenta' })
      await bancada.pool.query('update consumo_ia set envio_externo = true, provedor = null where id = $1', [antiga])
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      const { rows } = await bancada.pool.query<{ entrada: unknown; saida: unknown; envioExterno: boolean; provedor: string | null }>(
        'select entrada, saida, envio_externo as "envioExterno", provedor from consumo_ia where id = $1',
        [antiga],
      )
      expect(rows[0]).toEqual({ entrada: null, saida: null, envioExterno: true, provedor: null })
    })

    it('o que fica: a execução, as sete FKs que apontam para ela e a soma da governança são as mesmas depois da anonimização', async () => {
      const a = await escolaNova()
      const professorId = await professorNovo(a)
      const execucaoId = await execucaoComTema(a, QUARTA_1H, '13 months', 'concluida', professorId)
      // Uma linha em cada tabela que aponta para a execução, recente: a conversa dela fica, e só a execução vence.
      const doAno = { anoId: a.anoId, turmaId: a.turmaId, disciplinaId: await disciplinaDa(a.escolaId) }
      const artefatoId = await artefatoDe(a.escolaId, doAno, professorId, execucaoId)
      const umaThread = await thread(a, QUARTA_1H, '1 day')
      await bancada.semear(
        `with mensagem as (
           insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto, criada_em)
           values ($1, $2, $3, $4, $5, 'aluno', 'Pergunta sintética', $6::timestamptz - interval '1 day') returning id
         ), sinal as (
           insert into sinal_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, tipo, criado_em) values ($1, $2, $3, $4, $5, 'travou', $6::timestamptz - interval '1 day') returning id
         ), resposta as (
           insert into mensagem_agente (escola_id, ano_letivo_id, thread_id, execucao_id, autor, conteudo, criada_em)
           values ($1, $2, $7, $5, 'agente', '{"tipo":"texto","texto":"Resposta sintética"}', $6::timestamptz - interval '1 day') returning id
         ), lote as (
           insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, artefato_id, execucao_id, estado, decidida_por, decidida_em)
           values ($1, $2, $3, 'adaptacao', 'versao_adaptada', $8, $5, 'aprovada', $9, $6::timestamptz - interval '1 day') returning id
         )
         insert into resumo_do_analista (escola_id, ano_letivo_id, execucao_id, conteudo) values ($1, $2, $5, '{"recortes":[],"alertas":[]}')`,
        [a.escolaId, a.anoId, a.turmaId, a.alunoId, execucaoId, QUARTA_1H.toISOString(), umaThread.threadId, artefatoId, professorId],
      )
      // Quem aprovou e quando (regra 70, item 6): a entrega da execução fica igual.
      const aprovacao = () =>
        bancada.pool.query<{ estado: string; decididaPor: string | null; decididaEm: Date | null }>(
          'select estado, decidida_por as "decididaPor", decidida_em as "decididaEm" from entrega where escola_id = $1 and execucao_id = $2',
          [a.escolaId, execucaoId],
        )
      const aprovacaoAntes = (await aprovacao()).rows
      expect(aprovacaoAntes).toEqual([{ estado: 'aprovada', decididaPor: professorId, decididaEm: expect.any(Date) }])
      await consumo(a, QUARTA_1H, '13 months', { de: 'ferramenta', execucaoId })
      await consumo(a, QUARTA_1H, '13 months', { de: 'tutor' })

      const { rows: fks } = await bancada.pool.query<{ tabela: string; nome: string }>(
        "select conrelid::regclass::text as tabela, conname as nome from pg_constraint where confrelid = 'execucao_agente'::regclass and contype = 'f' order by 1",
      )
      expect(fks.map(({ tabela }) => tabela)).toEqual(['artefato', 'consumo_ia', 'entrega', 'mensagem_agente', 'mensagem_tutor', 'resumo_do_analista', 'sinal_tutor'])
      const apontando = async () =>
        Object.fromEntries(
          await Promise.all(
            fks.map(async ({ tabela }) => {
              const { rows } = await bancada.pool.query<{ total: number }>(
                `select count(*)::int as total from ${tabela} t join execucao_agente e on e.escola_id = t.escola_id and e.id = t.execucao_id where t.escola_id = $1 and e.id = $2`,
                [a.escolaId, execucaoId],
              )
              return [tabela, rows[0]?.total ?? 0] as const
            }),
          ),
        )
      const governanca = new GovernancaRepository(bancada.banco)
      const soma = () =>
        runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId, anoLetivoId: a.anoId }, async () => ({
          numeros: await governanca.numeros(),
          consumo: await governanca.consumoPorFuncao('2020-01-01', '2030-01-01'),
          trocas: await governanca.trocasComOTutor('2020-01-01', '2030-01-01'),
        }))
      const antes = { apontando: await apontando(), soma: await soma() }
      expect(Object.values(antes.apontando)).toEqual(fks.map(() => 1))
      expect(antes.soma.numeros.geradoPorIa).toBe(1)
      expect(antes.soma.trocas).toBe(1)

      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect(await temPessoa('execucao_agente', execucaoId)).toBe(false)
      expect(await comPessoa('consumo_ia_texto', a.escolaId)).toBe(0)
      expect(await comPessoa('consumo_ia_aluno', a.escolaId)).toBe(0)
      expect({ apontando: await apontando(), soma: await soma() }).toEqual(antes)
      expect((await aprovacao()).rows).toEqual(aprovacaoAntes)
    })

    it('autoria: o ano com o `fim` vencido além do prazo, mas em curso ou planejado, não perde nada; o mesmo ano encerrado perde', async () => {
      const escolaId = await bancada.escola()
      escolas.push(escolaId)
      const emCurso = await anoQueTerminou({ escolaId }, QUARTA_1H, '6 years', 'em_curso')
      const planejado = await anoQueTerminou({ escolaId }, QUARTA_1H, '7 years', 'planejado')
      const professorId = await professorNovo({ escolaId })
      const doEmCurso = await artefatoDe(escolaId, emCurso, professorId)
      const doPlanejado = await artefatoDe(escolaId, planejado, professorId)
      await rodar(escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect(await temPessoa('artefato_autoria', doEmCurso)).toBe(true)
      expect(await temPessoa('artefato_autoria', doPlanejado)).toBe(true)
      expect((await execucoes(escolaId)).find((linha) => linha.categoria === 'autoria_de_artefato')).toEqual({ categoria: 'autoria_de_artefato', linhas: 0, concluida: true })

      await bancada.pool.query("update ano_letivo set situacao = 'encerrado' where id = $1", [emCurso.anoId])
      await rodar(escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect(await temPessoa('artefato_autoria', doEmCurso)).toBe(false)
      expect(await temPessoa('artefato_autoria', doPlanejado)).toBe(true)
    })

    it('a execução do Tutor perde o aluno no prazo do consumo por aluno: com a conversa do Tutor em 6, aos 7 meses nem o consumo nem a execução a que ele aponta alcançam o aluno, aos 5 ficam, e a execução do professor de 7 meses fica', async () => {
      const a = await escolaNova()
      await ajustar(a.escolaId, 'conversa_tutor', 6)
      const seteMeses = await consumo(a, QUARTA_1H, '7 months', { de: 'tutor' })
      const cincoMeses = await consumo(a, QUARTA_1H, '5 months', { de: 'tutor' })
      const doProfessor = await execucaoComTema(a, QUARTA_1H, '7 months')
      // O banco aceita a entrada com mais que a tarefa (o check só exige a tarefa): a anonimização a deixa só com ela.
      const comMaisQueATarefa = await execucaoDoTutor(a, QUARTA_1H, '7 months', { tarefa: 'turno_do_tutor', pergunta: 'Texto sintético' })
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      const { rows: entradas } = await bancada.pool.query<{ entrada: unknown }>('select entrada from execucao_agente where id = $1', [comMaisQueATarefa])
      expect(entradas[0]?.entrada).toEqual({ tarefa: 'turno_do_tutor' })
      const aluno = async (consumoId: string) => {
        const { rows } = await bancada.pool.query<{ noConsumo: string | null; pelaExecucao: string | null }>(
          `select c.aluno_id as "noConsumo", e.solicitada_por as "pelaExecucao"
           from consumo_ia c join execucao_agente e on e.escola_id = c.escola_id and e.id = c.execucao_id where c.id = $1`,
          [consumoId],
        )
        return rows[0]
      }
      expect(await aluno(seteMeses)).toEqual({ noConsumo: null, pelaExecucao: null })
      expect(await aluno(cincoMeses)).toEqual({ noConsumo: a.alunoId, pelaExecucao: a.alunoId })
      expect(await temPessoa('execucao_agente', doProfessor)).toBe(true)
      // Três linhas no consumo por aluno: o consumo de 7 meses, a execução dele e a outra execução do Tutor de 7 meses.
      expect((await execucoes(a.escolaId)).find((linha) => linha.categoria === 'consumo_por_aluno')).toEqual({ categoria: 'consumo_por_aluno', linhas: 3, concluida: true })
    })

    it('[P] dois jobs da mesma escola ao mesmo tempo anonimizam linhas diferentes em cada alvo, inclusive a execução do Tutor que as duas categorias alcançam, e as contagens somam o total, cada linha uma vez', async () => {
      const a = await escolaNova()
      // Conversa do Tutor em 6: a execução do Tutor de 7 meses só o alvo novo pega; a de 13 meses, as duas categorias.
      await ajustar(a.escolaId, 'conversa_tutor', 6)
      const encerrado = await anoQueTerminou(a, QUARTA_1H, '61 months')
      const professorId = await professorNovo(a)
      await bancada.semear(
        `with execucoes as (
           insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, chave_envio, entrada, criada_em)
           select $1, $2, 'conversa_e_ferramentas', 'gerar_plano_de_aula', gen_random_uuid(), $3::jsonb, $4::timestamptz - interval '13 months' - n * interval '1 minute'
           from generate_series(1, 30) as n returning id
         ), do_tutor as (
           insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, criada_em)
           select $1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $5, gen_random_uuid(), '{"tarefa":"turno_do_tutor"}',
             $4::timestamptz - case when n % 2 = 0 then interval '7 months' else interval '13 months' end - n * interval '1 minute'
           from generate_series(1, 30) as n returning id, criada_em
         ), consumos_do_tutor as (
           insert into consumo_ia (escola_id, aluno_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, em)
           select $1, $5, id, 'turno_do_tutor', 'tutor_com_o_aluno', 'padrao', 'falso', 'modelo-falso', 'v1', 1, 1, 1, false, 1, 'concluida', criada_em from do_tutor
           returning id
         ), consumos_com_texto as (
           insert into consumo_ia (escola_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, entrada, em)
           select $1, 'gerar_plano_de_aula', 'conversa_e_ferramentas', 'padrao', 'falso', 'modelo-falso', 'v1', 1, 1, 1, false, 1, 'concluida', $3::jsonb, $4::timestamptz - interval '13 months' - n * interval '1 minute'
           from generate_series(1, 30) as n returning id
         )
         insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por)
         select $1, $6, $7, $8, 'plano_de_aula', 'Plano sintético', '{"tipo":"plano_de_aula","titulo":"Plano sintético"}', $9 from generate_series(1, 30)`,
        [
          a.escolaId,
          a.anoId,
          JSON.stringify({ tarefa: 'gerar_plano_de_aula', parametros: { tema: TEMA } }),
          QUARTA_1H.toISOString(),
          a.alunoId,
          encerrado.anoId,
          encerrado.turmaId,
          encerrado.disciplinaId,
          professorId,
        ],
      )
      await Promise.all([rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { lote: 5 })), rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { lote: 5 }))])
      for (const alvo of Object.keys(LER_PESSOA) as AlvoDeAnonimizacao[]) expect(await comPessoa(alvo, a.escolaId), alvo).toBe(0)
      const { rows: peloConsumo } = await bancada.pool.query<{ total: number; comAluno: number }>(
        `select count(*)::int as total, count(*) filter (where c.aluno_id is not null or e.solicitada_por is not null or e.anonimizada_em is null)::int as "comAluno"
         from consumo_ia c join execucao_agente e on e.escola_id = c.escola_id and e.id = c.execucao_id where c.escola_id = $1 and e.funcao = 'tutor_com_o_aluno'`,
        [a.escolaId],
      )
      expect(peloConsumo[0]).toEqual({ total: 30, comAluno: 0 })
      const linhas = await execucoes(a.escolaId)
      const soma = (categoria: string) => {
        const daCategoria = linhas.filter((linha) => linha.categoria === categoria)
        expect(daCategoria, categoria).toHaveLength(2)
        return daCategoria.reduce((total, linha) => total + linha.linhas, 0)
      }
      expect({ texto: soma('texto_do_modelo'), autoria: soma('autoria_de_artefato') }).toEqual({ texto: 30, autoria: 30 })
      // As execuções de ferramenta (30) e do Tutor (30), e os consumos do Tutor (30): cada uma uma vez só, numa das duas
      // categorias, e as do Tutor de 7 meses só no consumo por aluno.
      const execucaoEAluno = soma('execucao_agente') + soma('consumo_por_aluno')
      expect(execucaoEAluno).toBe(90)
      expect(soma('consumo_por_aluno')).toBeGreaterThanOrEqual(30 + 15)
    })

    it('o ajuste da própria categoria vale, sem mexer na que a trava: execução em 3, texto do modelo em 2, aluno do consumo em 4, autoria em 12', async () => {
      const a = await escolaNova()
      await ajustar(a.escolaId, 'execucao_agente', 3)
      await ajustar(a.escolaId, 'texto_do_modelo', 2)
      await ajustar(a.escolaId, 'consumo_por_aluno', 4)
      await ajustar(a.escolaId, 'autoria_de_artefato', 12)
      const execucaoSai = await execucaoComTema(a, QUARTA_1H, '4 months')
      const execucaoFica = await execucaoComTema(a, QUARTA_1H, '2 months')
      const textoSai = await consumo(a, QUARTA_1H, '3 months', { de: 'ferramenta' })
      const textoFica = await consumo(a, QUARTA_1H, '1 month', { de: 'ferramenta' })
      const alunoSai = await consumo(a, QUARTA_1H, '5 months', { de: 'tutor' })
      const alunoFica = await consumo(a, QUARTA_1H, '3 months', { de: 'tutor' })
      const professorId = await professorNovo(a)
      const autoriaSai = await artefatoDe(a.escolaId, await anoQueTerminou(a, QUARTA_1H, '13 months'), professorId)
      const autoriaFica = await artefatoDe(a.escolaId, await anoQueTerminou(a, QUARTA_1H, '11 months'), professorId)
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect({
        execucao: [await temPessoa('execucao_agente', execucaoSai), await temPessoa('execucao_agente', execucaoFica)],
        texto: [await temPessoa('consumo_ia_texto', textoSai), await temPessoa('consumo_ia_texto', textoFica)],
        aluno: [await temPessoa('consumo_ia_aluno', alunoSai), await temPessoa('consumo_ia_aluno', alunoFica)],
        autoria: [await temPessoa('artefato_autoria', autoriaSai), await temPessoa('artefato_autoria', autoriaFica)],
      }).toEqual({ execucao: [false, true], texto: [false, true], aluno: [false, true], autoria: [false, true] })
    })

    it('autoria: o dia do prazo é o da escola, e não o de UTC, o da sessão nem um fuso fixo: às 22h de quarta em São Paulo (quinta em UTC), e às 22h30 de quarta em Rio Branco, o `fim` que com o prazo cai na quarta fica, e o que cai na terça sai', async () => {
      const a = await escolaNova()
      const QUARTA_22H = new Date('2026-10-07T22:00:00-03:00')
      const professorId = await professorNovo(a)
      // 60 meses do padrão: o `fim` de 07/10/2021 vence ao fim de 07/10/2026, e o de 06/10/2021 já venceu.
      const caiHoje = await artefatoDe(a.escolaId, await anoQueTerminouEm(a, '2021-10-07'), professorId)
      const caiOntem = await artefatoDe(a.escolaId, await anoQueTerminouEm(a, '2021-10-06'), professorId)
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_22H)))
      expect(await temPessoa('artefato_autoria', caiOntem)).toBe(false)
      expect(await temPessoa('artefato_autoria', caiHoje)).toBe(true)

      // Uma escola de Rio Branco à 0h30 de quinta em São Paulo, 22h30 de quarta lá: o dia é o do fuso dela, e não um fixo.
      const b = await escolaNova()
      await bancada.configurarEscola(b.escolaId, { fuso: 'America/Rio_Branco' })
      const professorDeB = await professorNovo(b)
      const caiHojeEmB = await artefatoDe(b.escolaId, await anoQueTerminouEm(b, '2021-10-07'), professorDeB)
      const caiOntemEmB = await artefatoDe(b.escolaId, await anoQueTerminouEm(b, '2021-10-06'), professorDeB)
      await rodar(b.escolaId, expurgo(relogioEm(new Date('2026-10-08T00:30:00-03:00'))))
      expect(await temPessoa('artefato_autoria', caiOntemEmB)).toBe(false)
      expect(await temPessoa('artefato_autoria', caiHojeEmB)).toBe(true)
    })
  })

  describe('trabalho do aluno e cadastro (tarefa 5.0)', () => {
    /** O que a escola tem de uma categoria depois do job: a linha que ele gravou. */
    async function linhaDaCategoria(escolaId: string, categoria: string): Promise<{ categoria: string; linhas: number; concluida: boolean } | undefined> {
      return (await execucoes(escolaId)).findLast((linha) => linha.categoria === categoria)
    }

    describe('trabalho_do_aluno', () => {
      it('o ano em curso ou planejado com o `fim` vencido não perde nada; o mesmo ano encerrado perde a tentativa, as respostas e a correção, e a atividade aplicada e o lote ficam', async () => {
        const escolaId = await bancada.escola()
        escolas.push(escolaId)
        const alunoId = await alunoNovo(escolaId)
        const emCurso = await anoQueTerminou({ escolaId }, QUARTA_1H, '6 years', 'em_curso')
        const planejado = await anoQueTerminou({ escolaId }, QUARTA_1H, '7 years', 'planejado')
        const doEmCurso = await trabalhoDoAluno({ escolaId }, emCurso, alunoId)
        const doPlanejado = await trabalhoDoAluno({ escolaId }, planejado, alunoId)

        await rodar(escolaId, expurgo(relogioEm(QUARTA_1H)))
        expect(await existe('tentativa_atividade', doEmCurso.tentativaId)).toBe(true)
        expect(await existe('tentativa_atividade', doPlanejado.tentativaId)).toBe(true)
        expect(await restoDoTrabalho(doEmCurso.atividadeAplicadaId)).toEqual({ respostas: 2, correcoes: 1 })
        expect(await linhaDaCategoria(escolaId, 'trabalho_do_aluno')).toEqual({ categoria: 'trabalho_do_aluno', linhas: 0, concluida: true })

        await bancada.pool.query("update ano_letivo set situacao = 'encerrado' where id = $1", [emCurso.anoId])
        await rodar(escolaId, expurgo(relogioEm(QUARTA_1H)))
        expect(await existe('tentativa_atividade', doEmCurso.tentativaId)).toBe(false)
        // Em cascata: a resposta e a correção do aluno saem com a tentativa.
        expect(await restoDoTrabalho(doEmCurso.atividadeAplicadaId)).toEqual({ respostas: 0, correcoes: 0 })
        // A atividade aplicada e o lote de correção são registro de decisão (5 anos, F12): ficam, sem o aluno.
        expect(await existe('atividade_aplicada', doEmCurso.atividadeAplicadaId)).toBe(true)
        expect(await existe('entrega', doEmCurso.entregaId)).toBe(true)
        expect(await linhaDaCategoria(escolaId, 'trabalho_do_aluno')).toEqual({ categoria: 'trabalho_do_aluno', linhas: 1, concluida: true })
        // O planejado continua inteiro.
        expect(await existe('tentativa_atividade', doPlanejado.tentativaId)).toBe(true)
        expect(await restoDoTrabalho(doPlanejado.atividadeAplicadaId)).toEqual({ respostas: 2, correcoes: 1 })
      })

      it('aluno transferido: o trabalho dele em A sai pelo ano de A, o de um ano mais novo na mesma escola fica, e o dele em B (outra escola, mesma idade) não é tocado', async () => {
        const a = await escolaNova()
        const b = await escolaNova()
        const velhoEmA = await trabalhoDoAluno(a, await anoQueTerminou(a, QUARTA_1H, '13 months'), a.alunoId)
        const novoEmA = await trabalhoDoAluno(a, await anoQueTerminou(a, QUARTA_1H, '2 months'), a.alunoId)
        const velhoEmB = await trabalhoDoAluno(b, await anoQueTerminou(b, QUARTA_1H, '13 months'), b.alunoId)

        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
        expect(await existe('tentativa_atividade', velhoEmA.tentativaId)).toBe(false)
        expect(await restoDoTrabalho(velhoEmA.atividadeAplicadaId)).toEqual({ respostas: 0, correcoes: 0 })
        expect(await existe('tentativa_atividade', novoEmA.tentativaId)).toBe(true)
        expect(await restoDoTrabalho(novoEmA.atividadeAplicadaId)).toEqual({ respostas: 2, correcoes: 1 })
        expect(await existe('tentativa_atividade', velhoEmB.tentativaId)).toBe(true)
        expect(await restoDoTrabalho(velhoEmB.atividadeAplicadaId)).toEqual({ respostas: 2, correcoes: 1 })
      })

      it('o ajuste da escola vale: com 6 meses, o ano encerrado há 7 meses perde o trabalho, e com os 12 do padrão ele ficava', async () => {
        const a = await escolaNova()
        const trabalho = await trabalhoDoAluno(a, await anoQueTerminou(a, QUARTA_1H, '7 months'), a.alunoId)
        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
        expect(await existe('tentativa_atividade', trabalho.tentativaId)).toBe(true)
        await ajustar(a.escolaId, 'trabalho_do_aluno', 6)
        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
        expect(await existe('tentativa_atividade', trabalho.tentativaId)).toBe(false)
      })

      it('o lote de trabalho com a cascata (20 respostas e a correção por tentativa) sai dentro dos 2 s do `statement_timeout`, no tamanho que o expurgo usa', async () => {
        const escolaId = await bancada.escola()
        escolas.push(escolaId)
        // O lote inteiro do job: se a cascata passasse dos 2 s, o lote deste alvo teria de ser menor (`LOTE_MAXIMO_DO_ALVO`).
        const lote = LOTE_DO_EXPURGO
        const ano = await anoQueTerminou({ escolaId }, QUARTA_1H, '13 months')
        // A estrutura (artefato, atividade aplicada e lote) de um aluno, e as `lote` tentativas a mais, de alunos novos, na mesma atividade.
        const primeiro = await trabalhoDoAluno({ escolaId }, ano, await alunoNovo(escolaId))
        await bancada.semear(
          `with alunos as (
             insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno sintético ' || n from generate_series(1, $5::int) as n returning id
           ), tentativas as (
             insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, enviada_em) select $1, $2, $3, id, now() from alunos returning aluno_id
           ), respostas as (
             insert into resposta_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao, alternativa)
             select $1, $2, $3, aluno_id, questao, 0 from tentativas cross join generate_series(1, 20) as questao returning 1
           )
           insert into correcao (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, aluno_id, acertos, total, em_branco, por_habilidade)
           select $1, $2, $4, $3, aluno_id, 10, 20, 0, '[]' from tentativas`,
          [escolaId, ano.anoId, primeiro.atividadeAplicadaId, primeiro.entregaId, lote],
        )
        expect(await quantas('tentativa_atividade', escolaId)).toBe(lote + 1)
        expect(await quantas('resposta_atividade', escolaId)).toBe(2 + 20 * lote)
        const repositorio = new ExpurgoDaEscolaRepository(bancada.banco)
        const inicio = performance.now()
        const doLote = await runInContext({ requisicaoId: randomUUID(), escolaId }, () => repositorio.expurgarLote('tentativa_atividade', { agora: QUARTA_1H, meses: 12, fuso: FUSO }, lote))
        const duracaoMs = performance.now() - inicio
        expect(doLote).toEqual({ linhas: lote, cheio: true })
        expect(duracaoMs).toBeLessThan(2_000)
        // Sobra uma tentativa, a que o lote não levou (sem `order by`, qualquer uma), com as respostas e a correção dela.
        expect(await quantas('tentativa_atividade', escolaId)).toBe(1)
        expect(await quantas('resposta_atividade', escolaId)).toBe((await existe('tentativa_atividade', primeiro.tentativaId)) ? 2 : 20)
        expect(await quantas('correcao', escolaId)).toBe(1)
      })
    })

    describe('reivindicacao_decidida', () => {
      it('sai a decidida por qualquer decisor e a encerrada sem decisão, pela data da decisão; a pendente nunca sai, e a de outra escola fica', async () => {
        const a = await escolaNova()
        const b = await escolaNova()
        const peloProfessor = await reivindicacaoFechada(a, QUARTA_1H, '61 months', { estado: 'aprovada', como: 'professor' })
        const pelaCoordenacao = await reivindicacaoFechada(a, QUARTA_1H, '61 months', { estado: 'recusada', como: 'coordenacao' })
        const encerrada = await reivindicacaoFechada(a, QUARTA_1H, '61 months', { estado: 'encerrada' })
        const encerradaRecente = await reivindicacaoFechada(a, QUARTA_1H, '59 months', { estado: 'encerrada' })
        const decididaRecente = await reivindicacaoFechada(a, QUARTA_1H, '59 months', { estado: 'aprovada' })
        const pendente = await reivindicacaoPendente(a, QUARTA_1H, '61 months')
        const deB = await reivindicacaoFechada(b, QUARTA_1H, '61 months', { como: 'coordenacao' })

        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
        expect(await existe('reivindicacao', peloProfessor)).toBe(false)
        expect(await existe('reivindicacao', pelaCoordenacao)).toBe(false)
        expect(await existe('reivindicacao', encerrada)).toBe(false)
        expect(await existe('reivindicacao', encerradaRecente)).toBe(true)
        expect(await existe('reivindicacao', decididaRecente)).toBe(true)
        expect(await existe('reivindicacao', pendente)).toBe(true)
        expect(await existe('reivindicacao', deB)).toBe(true)
        expect(await linhaDaCategoria(a.escolaId, 'reivindicacao_decidida')).toEqual({ categoria: 'reivindicacao_decidida', linhas: 3, concluida: true })
      })

      it('o ajuste da escola vale: com 12 meses, a decidida há 13 sai e a de 11 fica', async () => {
        const a = await escolaNova()
        const velha = await reivindicacaoFechada(a, QUARTA_1H, '13 months')
        const nova = await reivindicacaoFechada(a, QUARTA_1H, '11 months')
        await ajustar(a.escolaId, 'reivindicacao_decidida', 12)
        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
        expect(await existe('reivindicacao', velha)).toBe(false)
        expect(await existe('reivindicacao', nova)).toBe(true)
      })
    })

    describe('material_excluido', () => {
      /** Uma pergunta do aluno que cita a página 1 do material. */
      async function perguntaSobreOMaterial(escola: Escola, agora: Date, ha: string, materialId: string): Promise<string> {
        const execucaoId = await execucao(escola, 'turno_do_tutor', escola.alunoId)
        const { rows } = await bancada.pool.query<{ id: string }>(
          `insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, material_id, pagina, texto, criada_em)
           values ($1, $2, $3, $4, $5, 'aluno', $6, 1, 'Pergunta sintética sobre a página', $7::timestamptz - $8::interval) returning id`,
          [escola.escolaId, escola.anoId, escola.turmaId, escola.alunoId, execucaoId, materialId, agora.toISOString(), ha],
        )
        return rows[0]?.id ?? ''
      }

      /** Um sinal do Tutor que aponta para a página 1 do material. */
      async function sinalSobreOMaterial(escola: Escola, agora: Date, ha: string, materialId: string): Promise<string> {
        const { rows } = await bancada.pool.query<{ id: string }>(
          `insert into sinal_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, tipo, material_id, pagina, criado_em)
           values ($1, $2, $3, $4, 'travou', $5, 1, $6::timestamptz - $7::interval) returning id`,
          [escola.escolaId, escola.anoId, escola.turmaId, escola.alunoId, materialId, agora.toISOString(), ha],
        )
        return rows[0]?.id ?? ''
      }

      it('o vigente fica, mesmo velho; o excluído antes do prazo fica; o excluído além do prazo sai, com os trechos; o que uma pergunta ou um sinal do Tutor ainda cita fica até a conversa sair; a outra escola fica', async () => {
        const a = await escolaNova()
        const b = await escolaNova()
        const vigente = await materialDa(a, QUARTA_1H)
        await bancada.pool.query("update material set enviado_em = $2::timestamptz - interval '7 years' where id = $1", [vigente, QUARTA_1H.toISOString()])
        const recente = await materialDa(a, QUARTA_1H, '59 months')
        const vencido = await materialDa(a, QUARTA_1H, '61 months')
        await bancada.pool.query("insert into trecho (escola_id, disciplina_id, material_id, pagina, texto) select escola_id, disciplina_id, id, 1, 'Página sintética.' from material where id = $1", [vencido])
        const citadoPelaConversa = await materialDa(a, QUARTA_1H, '61 months')
        const pergunta = await perguntaSobreOMaterial(a, QUARTA_1H, '1 day', citadoPelaConversa)
        const citadoPeloSinal = await materialDa(a, QUARTA_1H, '61 months')
        const sinalDele = await sinalSobreOMaterial(a, QUARTA_1H, '1 day', citadoPeloSinal)
        const deB = await materialDa(b, QUARTA_1H, '61 months')

        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
        expect(await existe('material', vencido)).toBe(false)
        expect((await bancada.pool.query('select 1 from trecho where material_id = $1', [vencido])).rowCount).toBe(0)
        for (const id of [vigente, recente, citadoPelaConversa, citadoPeloSinal, deB]) expect(await existe('material', id), id).toBe(true)
        expect(await linhaDaCategoria(a.escolaId, 'material_excluido')).toEqual({ categoria: 'material_excluido', linhas: 1, concluida: true })

        // A conversa passa do prazo (a pergunta e o sinal têm 13 meses): ela sai primeiro, e o material que só ela citava sai na mesma noite.
        await bancada.pool.query("update mensagem_tutor set criada_em = $2::timestamptz - interval '13 months' where id = $1", [pergunta, QUARTA_1H.toISOString()])
        await bancada.pool.query("update sinal_tutor set criado_em = $2::timestamptz - interval '13 months' where id = $1", [sinalDele, QUARTA_1H.toISOString()])
        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
        expect(await existe('mensagem_tutor', pergunta)).toBe(false)
        expect(await existe('sinal_tutor', sinalDele)).toBe(false)
        expect(await existe('material', citadoPelaConversa)).toBe(false)
        expect(await existe('material', citadoPeloSinal)).toBe(false)
        expect(await existe('material', recente)).toBe(true)
        expect(await existe('material', vigente)).toBe(true)
        expect(await existe('material', deB)).toBe(true)
        expect(await linhaDaCategoria(a.escolaId, 'material_excluido')).toEqual({ categoria: 'material_excluido', linhas: 2, concluida: true })
      })
    })

    describe('vinculo_encerrado', () => {
      it('só o vínculo encerrado além do prazo sai: o ativo, o pendente, o contestado e o encerrado recente ficam, mesmo velhos, e o de outra escola fica', async () => {
        const a = await escolaNova()
        const b = await escolaNova()
        const encerradoVelho = await vinculoDe(a, 'encerrado', QUARTA_1H, '61 months', await alunoNovo(a.escolaId))
        const encerradoRecente = await vinculoDe(a, 'encerrado', QUARTA_1H, '59 months', await alunoNovo(a.escolaId))
        const confirmado = await vinculoDe(a, 'confirmado', QUARTA_1H, '61 months', await alunoNovo(a.escolaId))
        const pendente = await vinculoDe(a, 'pendente', QUARTA_1H, '61 months', await alunoNovo(a.escolaId))
        const contestado = await vinculoDe(a, 'contestado', QUARTA_1H, '61 months', await alunoNovo(a.escolaId))
        const deB = await vinculoDe(b, 'encerrado', QUARTA_1H, '61 months', await alunoNovo(b.escolaId))
        // O vínculo que a coordenação criou há anos continua o mesmo: a data do prazo é a do encerramento.
        await bancada.pool.query("update vinculo set criado_em = $2::timestamptz - interval '10 years' where id = any($1::uuid[])", [[encerradoRecente, confirmado, pendente, contestado], QUARTA_1H.toISOString()])

        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
        expect(await existe('vinculo', encerradoVelho)).toBe(false)
        for (const id of [encerradoRecente, confirmado, pendente, contestado, deB]) expect(await existe('vinculo', id), id).toBe(true)
        expect(await linhaDaCategoria(a.escolaId, 'vinculo_encerrado')).toEqual({ categoria: 'vinculo_encerrado', linhas: 1, concluida: true })
      })
    })

    describe('pessoa_desativada', () => {
      /** A auditoria `usuario.eliminado` do usuário: quem assinou. */
      async function auditoriaDaEliminacao(usuarioId: string): Promise<Array<{ autorUsuarioId: string | null; autorOperador: string | null; escolaId: string; entidade: string }>> {
        const { rows } = await bancada.pool.query<{ autorUsuarioId: string | null; autorOperador: string | null; escolaId: string; entidade: string }>(
          `select autor_usuario_id as "autorUsuarioId", autor_operador as "autorOperador", escola_id as "escolaId", entidade from auditoria where acao = 'usuario.eliminado' and entidade_id = $1`,
          [usuarioId],
        )
        return rows
      }

      it('o desativado além do prazo é eliminado pelo ciclo de vida (vínculo e credencial saem com ele), com a auditoria assinada pela rotina; o ativo e o desativado dentro do prazo ficam', async () => {
        const a = await escolaNova()
        const b = await escolaNova()
        const desativado = await alunoDesativado(a, QUARTA_1H, '61 months')
        await vinculoDe(a, 'confirmado', QUARTA_1H, '1 day', desativado)
        await bancada.pool.query("insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, 'm-expurgo-1', 'hash-sintetico')", [a.escolaId, desativado])
        const dentroDoPrazo = await alunoDesativado(a, QUARTA_1H, '59 months')
        const ativo = await alunoNovo(a.escolaId)
        const deB = await alunoDesativado(b, QUARTA_1H, '61 months')
        await bancada.pool.query("insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, 'm-expurgo-1', 'hash-sintetico')", [b.escolaId, deB])

        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
        expect(await existe('usuario', desativado)).toBe(false)
        expect((await bancada.pool.query('select 1 from vinculo where usuario_id = $1', [desativado])).rowCount).toBe(0)
        expect((await bancada.pool.query('select 1 from credencial_matricula where usuario_id = $1', [desativado])).rowCount).toBe(0)
        // A mesma matrícula na escola B é de outra pessoa (a matrícula é única por escola) e continua.
        expect((await bancada.pool.query('select 1 from credencial_matricula where usuario_id = $1', [deB])).rowCount).toBe(1)
        for (const id of [dentroDoPrazo, ativo, deB]) expect(await existe('usuario', id), id).toBe(true)
        expect(await auditoriaDaEliminacao(desativado)).toEqual([{ autorUsuarioId: null, autorOperador: AUTOR_DA_ROTINA, escolaId: a.escolaId, entidade: 'usuario' }])
        expect(await auditoriaDaEliminacao(deB)).toEqual([])
        expect(await linhaDaCategoria(a.escolaId, 'pessoa_desativada')).toEqual({ categoria: 'pessoa_desativada', linhas: 1, concluida: true })
      })

      it('o aluno desativado que ainda tem trabalho, conversa do Tutor e consumo de IA é eliminado pela rotina sem quebrar o lote: o trabalho e a conversa saem em cascata e o consumo perde só o aluno', async () => {
        const a = await escolaNova()
        const ano = await anoQueTerminou(a, QUARTA_1H, '1 month')
        const { tentativaId } = await trabalhoDoAluno(a, ano, a.alunoId)
        const mensagemId = await mensagemTutor(a, QUARTA_1H, '1 month')
        const sinalId = await sinal(a, QUARTA_1H, '1 month')
        const consumoId = await consumo(a, QUARTA_1H, '1 month', { de: 'tutor' })
        await bancada.pool.query("update usuario set desativado_em = $2::timestamptz - interval '61 months' where id = $1", [a.alunoId, QUARTA_1H.toISOString()])
        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
        expect(await existe('usuario', a.alunoId)).toBe(false)
        expect(await existe('tentativa_atividade', tentativaId)).toBe(false)
        expect(await existe('mensagem_tutor', mensagemId)).toBe(false)
        expect(await existe('sinal_tutor', sinalId)).toBe(false)
        expect(await existe('consumo_ia', consumoId)).toBe(true)
        expect((await bancada.pool.query('select aluno_id from consumo_ia where id = $1', [consumoId])).rows[0]?.aluno_id).toBeNull()
        expect(await linhaDaCategoria(a.escolaId, 'pessoa_desativada')).toEqual({ categoria: 'pessoa_desativada', linhas: 1, concluida: true })
      })

      it('a conta global continua quando o professor está ativo em outra escola, e é limpa quando a escola eliminada era a última', async () => {
        const a = await escolaNova()
        const b = await escolaNova()
        const contaEmDuas = (await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`dupla-${randomUUID()}@expurgo.invalid`])).rows[0]?.id ?? ''
        const contaSo = (await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`so-${randomUUID()}@expurgo.invalid`])).rows[0]?.id ?? ''
        const inserir = async (escolaId: string, contaId: string, desativadoHa: string | null): Promise<string> =>
          (
            await bancada.pool.query<{ id: string }>(
              "insert into usuario (escola_id, papel, nome, conta_id, desativado_em) values ($1, 'professor', 'Professor sintético', $2, case when $3::text is null then null else $4::timestamptz - $3::interval end) returning id",
              [escolaId, contaId, desativadoHa, QUARTA_1H.toISOString()],
            )
          ).rows[0]?.id ?? ''
        const emA = await inserir(a.escolaId, contaEmDuas, '61 months')
        const emB = await inserir(b.escolaId, contaEmDuas, null)
        const soEmA = await inserir(a.escolaId, contaSo, '61 months')
        const email = async (contaId: string) => (await bancada.pool.query<{ email: string | null }>('select email from conta where id = $1', [contaId])).rows[0]?.email

        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
        expect(await existe('usuario', emA)).toBe(false)
        expect(await existe('usuario', soEmA)).toBe(false)
        expect(await existe('usuario', emB)).toBe(true)
        expect(await email(contaEmDuas)).not.toBeNull()
        expect(await email(contaSo)).toBeNull()
      })

      it('a pessoa que sumiu entre a escolha do lote e a trava é pulada sem erro, a seguinte sai, e a contagem é só do que este job eliminou', async () => {
        const a = await escolaNova()
        const maisAntiga = await alunoDesativado(a, QUARTA_1H, '62 months')
        const outra = await alunoDesativado(a, QUARTA_1H, '61 months')
        const cliente = await bancada.pool.connect()
        try {
          // A mais antiga é a primeira do lote: o job para na trava dela até o teste a eliminar por fora.
          await cliente.query('begin')
          await cliente.query('select 1 from usuario where id = $1 for update', [maisAntiga])
          const job = rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
          await esperarNaTrava(bancada.pool, '%"desativado_em" from "usuario"%no key update%')
          await cliente.query('delete from usuario where id = $1', [maisAntiga])
          await cliente.query('commit')
          await job
        } finally {
          cliente.release()
        }
        expect(await existe('usuario', maisAntiga)).toBe(false)
        expect(await existe('usuario', outra)).toBe(false)
        expect(await auditoriaDaEliminacao(maisAntiga)).toEqual([])
        expect(await auditoriaDaEliminacao(outra)).toHaveLength(1)
        expect(await linhaDaCategoria(a.escolaId, 'pessoa_desativada')).toEqual({ categoria: 'pessoa_desativada', linhas: 1, concluida: true })
      })

      it('a pessoa reativada entre a escolha do lote e a trava não é eliminada: fica, sem auditoria, e a contagem é só das outras', async () => {
        const a = await escolaNova()
        const reativada = await alunoDesativado(a, QUARTA_1H, '62 months')
        const outra = await alunoDesativado(a, QUARTA_1H, '61 months')
        const cliente = await bancada.pool.connect()
        try {
          // A mais antiga é a primeira do lote: o job para na trava dela até o teste reativá-la por fora (convite aceito).
          await cliente.query('begin')
          await cliente.query('select 1 from usuario where id = $1 for update', [reativada])
          const job = rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
          await esperarNaTrava(bancada.pool, '%"desativado_em" from "usuario"%no key update%')
          await cliente.query('update usuario set desativado_em = null where id = $1', [reativada])
          await cliente.query('commit')
          await job
        } finally {
          cliente.release()
        }
        expect(await existe('usuario', reativada)).toBe(true)
        expect(await existe('usuario', outra)).toBe(false)
        expect(await auditoriaDaEliminacao(reativada)).toEqual([])
        expect(await auditoriaDaEliminacao(outra)).toHaveLength(1)
        expect(await linhaDaCategoria(a.escolaId, 'pessoa_desativada')).toEqual({ categoria: 'pessoa_desativada', linhas: 1, concluida: true })
      })

      /** O pedido de eliminação `agendado` do titular, como o registro o grava (14.0), com o autor sendo outra pessoa da escola. */
      async function eliminacaoAgendada(escolaId: string, titularId: string, { marcar }: { marcar: boolean }): Promise<void> {
        const autor = await alunoNovo(escolaId)
        await bancada.pool.query(
          `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, eliminar_em, compartilhamento, registrado_por, chave_envio)
           values ($1, $2, 'aluno', 'eliminacao', 'titular', current_date, 'agendado', now() + interval '7 days', '[]'::jsonb, $3, $4)`,
          [escolaId, titularId, autor, randomUUID()],
        )
        if (marcar) await bancada.pool.query('update usuario set eliminacao_agendada_em = now() where id = $1', [titularId])
      }

      it('a pessoa com a eliminação agendada não entra no lote, pelo pedido `agendado` ou pela marca do usuário, e a do mesmo lote sem agendamento sai', async () => {
        const a = await escolaNova()
        const soOPedido = await alunoDesativado(a, QUARTA_1H, '63 months')
        const soAMarca = await alunoDesativado(a, QUARTA_1H, '62 months')
        const outra = await alunoDesativado(a, QUARTA_1H, '61 months')
        await eliminacaoAgendada(a.escolaId, soOPedido, { marcar: false })
        await bancada.pool.query('update usuario set eliminacao_agendada_em = now() where id = $1', [soAMarca])
        // O pedido de outra pessoa não protege `outra`: é por titular.
        await eliminacaoAgendada(a.escolaId, a.alunoId, { marcar: true })

        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))

        expect(await existe('usuario', soOPedido)).toBe(true)
        expect(await existe('usuario', soAMarca)).toBe(true)
        expect(await existe('usuario', outra)).toBe(false)
        expect(await auditoriaDaEliminacao(soOPedido)).toEqual([])
        expect(await auditoriaDaEliminacao(soAMarca)).toEqual([])
        expect(await auditoriaDaEliminacao(outra)).toHaveLength(1)
        // A contagem é só do que o job eliminou, e o lote não fica "cheio" pelas duas que ficaram.
        expect(await linhaDaCategoria(a.escolaId, 'pessoa_desativada')).toEqual({ categoria: 'pessoa_desativada', linhas: 1, concluida: true })
      })

      it('a pessoa agendada não ocupa o lote: com o limite de 1 e a mais antiga agendada, pelo pedido ou pela marca, quem sai é a seguinte', async () => {
        for (const { marcar } of [{ marcar: false }, { marcar: true }]) {
          const a = await escolaNova()
          const agendada = await alunoDesativado(a, QUARTA_1H, '63 months')
          const outra = await alunoDesativado(a, QUARTA_1H, '61 months')
          // No primeiro giro, só o pedido `agendado`; no segundo, só a marca do usuário.
          if (marcar) await bancada.pool.query('update usuario set eliminacao_agendada_em = now() where id = $1', [agendada])
          else await eliminacaoAgendada(a.escolaId, agendada, { marcar: false })

          const doLote = await runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () =>
            new ExpurgoDaEscolaRepository(bancada.banco).expurgarLote('usuario', { agora: QUARTA_1H, meses: 60, fuso: FUSO }, 1),
          )

          expect(doLote).toEqual({ linhas: 1, cheio: true })
          expect(await existe('usuario', agendada)).toBe(true)
          expect(await existe('usuario', outra)).toBe(false)
        }
      })

      it('a eliminação agendada entre a escolha do lote e a trava também protege: a pessoa fica, sem auditoria, e a seguinte sai', async () => {
        const a = await escolaNova()
        const agendada = await alunoDesativado(a, QUARTA_1H, '62 months')
        const outra = await alunoDesativado(a, QUARTA_1H, '61 months')
        const cliente = await bancada.pool.connect()
        try {
          // A mais antiga é a primeira do lote: o job para na trava dela até o teste registrar a eliminação por fora (14.0).
          await cliente.query('begin')
          await cliente.query('select 1 from usuario where id = $1 for update', [agendada])
          const job = rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
          await esperarNaTrava(bancada.pool, '%"desativado_em" from "usuario"%no key update%')
          await cliente.query('update usuario set eliminacao_agendada_em = now() where id = $1', [agendada])
          await cliente.query('commit')
          await job
        } finally {
          cliente.release()
        }
        expect(await existe('usuario', agendada)).toBe(true)
        expect(await existe('usuario', outra)).toBe(false)
        expect(await auditoriaDaEliminacao(agendada)).toEqual([])
        expect(await linhaDaCategoria(a.escolaId, 'pessoa_desativada')).toEqual({ categoria: 'pessoa_desativada', linhas: 1, concluida: true })
      })

      it('o pedido agendado registrado depois da escolha do lote, e antes da trava da própria pessoa, também a protege: a trava relê o pedido', async () => {
        const a = await escolaNova()
        const primeira = await alunoDesativado(a, QUARTA_1H, '63 months')
        const agendada = await alunoDesativado(a, QUARTA_1H, '62 months')
        const outra = await alunoDesativado(a, QUARTA_1H, '61 months')
        const cliente = await bancada.pool.connect()
        try {
          // A mais antiga segura o job na trava dela; enquanto isso o pedido da segunda é registrado e confirmado, sem a marca.
          await cliente.query('begin')
          await cliente.query('select 1 from usuario where id = $1 for update', [primeira])
          const job = rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
          await esperarNaTrava(bancada.pool, '%"desativado_em" from "usuario"%no key update%')
          await eliminacaoAgendada(a.escolaId, agendada, { marcar: false })
          await cliente.query('commit')
          await job
        } finally {
          cliente.release()
        }
        expect(await existe('usuario', primeira)).toBe(false)
        expect(await existe('usuario', agendada)).toBe(true)
        expect(await existe('usuario', outra)).toBe(false)
        expect(await auditoriaDaEliminacao(agendada)).toEqual([])
        expect(await linhaDaCategoria(a.escolaId, 'pessoa_desativada')).toEqual({ categoria: 'pessoa_desativada', linhas: 2, concluida: true })
      })

      it('a pessoa reativada e desativada de novo dentro do prazo, entre a escolha do lote e a trava, também não é eliminada', async () => {
        const a = await escolaNova()
        const reativada = await alunoDesativado(a, QUARTA_1H, '62 months')
        const outra = await alunoDesativado(a, QUARTA_1H, '61 months')
        const cliente = await bancada.pool.connect()
        try {
          // A mais antiga é a primeira do lote: o job para na trava dela até o teste reativá-la e desativá-la de novo agora, por fora (dentro do prazo).
          await cliente.query('begin')
          await cliente.query('select 1 from usuario where id = $1 for update', [reativada])
          const job = rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
          await esperarNaTrava(bancada.pool, '%"desativado_em" from "usuario"%no key update%')
          await cliente.query('update usuario set desativado_em = $2::timestamptz where id = $1', [reativada, QUARTA_1H.toISOString()])
          await cliente.query('commit')
          await job
        } finally {
          cliente.release()
        }
        expect(await existe('usuario', reativada)).toBe(true)
        expect(await existe('usuario', outra)).toBe(false)
        expect(await auditoriaDaEliminacao(reativada)).toEqual([])
        expect(await auditoriaDaEliminacao(outra)).toHaveLength(1)
        expect(await linhaDaCategoria(a.escolaId, 'pessoa_desativada')).toEqual({ categoria: 'pessoa_desativada', linhas: 1, concluida: true })
      })

      it('o lote leva as mais antigas primeiro: com 101 desativadas e o limite de 100, sobra a mais recente', async () => {
        const a = await escolaNova()
        await bancada.semear(
          "insert into usuario (escola_id, papel, nome, desativado_em) select $1, 'aluno', 'Aluno desativado ' || n, $2::timestamptz - interval '61 months' - n * interval '1 day' from generate_series(1, 101) as n",
          [a.escolaId, QUARTA_1H.toISOString()],
        )
        const doLote = await runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () =>
          new ExpurgoDaEscolaRepository(bancada.banco).expurgarLote('usuario', { agora: QUARTA_1H, meses: 60, fuso: FUSO }, 1_000),
        )
        expect(doLote).toEqual({ linhas: 100, cheio: true })
        const { rows } = await bancada.pool.query<{ nome: string }>('select nome from usuario where escola_id = $1 and desativado_em is not null', [a.escolaId])
        // O n = 1 é o que foi desativado há menos tempo.
        expect(rows).toEqual([{ nome: 'Aluno desativado 1' }])
      })

      it('o lote de A não escolhe a pessoa de B, mesmo a mais antiga: com o limite de 1, é a de A que sai', async () => {
        const a = await escolaNova()
        const b = await escolaNova()
        const deB = await alunoDesativado(b, QUARTA_1H, '70 months')
        const deA = await alunoDesativado(a, QUARTA_1H, '61 months')
        const doLote = await runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () =>
          new ExpurgoDaEscolaRepository(bancada.banco).expurgarLote('usuario', { agora: QUARTA_1H, meses: 60, fuso: FUSO }, 1),
        )
        expect(doLote).toEqual({ linhas: 1, cheio: true })
        expect(await existe('usuario', deA)).toBe(false)
        expect(await existe('usuario', deB)).toBe(true)
      })

      it('o lote diz `cheio` pelo número de pessoas que escolheu, e não pelo que eliminou: a que sumiu na trava não faz a noite parar com a fila ainda cheia', async () => {
        const a = await escolaNova()
        const maisAntiga = await alunoDesativado(a, QUARTA_1H, '63 months')
        await alunoDesativado(a, QUARTA_1H, '62 months')
        await alunoDesativado(a, QUARTA_1H, '61 months')
        const cliente = await bancada.pool.connect()
        try {
          await cliente.query('begin')
          await cliente.query('select 1 from usuario where id = $1 for update', [maisAntiga])
          const doLote = runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () =>
            new ExpurgoDaEscolaRepository(bancada.banco).expurgarLote('usuario', { agora: QUARTA_1H, meses: 60, fuso: FUSO }, 2),
          )
          await esperarNaTrava(bancada.pool, '%"desativado_em" from "usuario"%no key update%')
          await cliente.query('delete from usuario where id = $1', [maisAntiga])
          await cliente.query('commit')
          // Escolheu duas (a que sumiu e a seguinte), eliminou uma: o lote veio cheio, e sobra mais uma para o seguinte.
          expect(await doLote).toEqual({ linhas: 1, cheio: true })
        } finally {
          cliente.release()
        }
        expect((await bancada.pool.query('select 1 from usuario where escola_id = $1 and desativado_em is not null', [a.escolaId])).rowCount).toBe(1)
      })

      it('o erro que não é de pessoa que sumiu sobe: a categoria grava `false`, as eliminadas antes ficam eliminadas, e a noite seguinte começa por ela', async () => {
        const a = await escolaNova()
        const primeira = await alunoDesativado(a, QUARTA_1H, '63 months')
        const quebra = await alunoDesativado(a, QUARTA_1H, '62 months')
        const ultima = await alunoDesativado(a, QUARTA_1H, '61 months')
        // Um gatilho só do banco de teste, que falha ao apagar a segunda pessoa: erro de SQL, e não `NAO_ENCONTRADO`.
        const nome = `teste_falha_${randomUUID().replaceAll('-', '').slice(0, 12)}`
        await bancada.pool.query(`create function ${nome}() returns trigger language plpgsql as $$ begin raise exception 'falha de teste'; end $$`)
        await bancada.pool.query(`create trigger ${nome} before delete on usuario for each row when (old.id = '${quebra}') execute function ${nome}()`)
        try {
          await expect(rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))).rejects.toThrow()
          expect(await existe('usuario', primeira)).toBe(false)
          expect(await existe('usuario', quebra)).toBe(true)
          expect(await existe('usuario', ultima)).toBe(true)
          expect(await linhaDaCategoria(a.escolaId, 'pessoa_desativada')).toEqual({ categoria: 'pessoa_desativada', linhas: 0, concluida: false })
        } finally {
          await bancada.pool.query(`drop trigger ${nome} on usuario`)
          await bancada.pool.query(`drop function ${nome}()`)
        }
        // Sem o gatilho, a noite seguinte começa pela categoria pendente e elimina as duas que sobraram.
        await rodar(a.escolaId, expurgo(relogioEm(QUINTA_1H)))
        expect(await existe('usuario', quebra)).toBe(false)
        expect(await existe('usuario', ultima)).toBe(false)
        expect((await execucoes(a.escolaId)).filter((linha) => linha.categoria === 'pessoa_desativada').at(-1)).toEqual({ categoria: 'pessoa_desativada', linhas: 2, concluida: true })
      })

      it('[P] dois jobs da mesma escola ao mesmo tempo eliminam cada pessoa uma vez, sem erro, e as contagens somam o total', async () => {
        // Não garante que os dois jobs se cruzem na mesma pessoa; quem prova a corrida na trava é o teste de «sumiu entre a escolha do lote e a trava».
        const a = await escolaNova()
        const ids: string[] = []
        for (let indice = 0; indice < 12; indice += 1) ids.push(await alunoDesativado(a, QUARTA_1H, '61 months'))
        await Promise.all([rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H))), rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))])
        for (const id of ids) {
          expect(await existe('usuario', id), id).toBe(false)
          expect(await auditoriaDaEliminacao(id), id).toHaveLength(1)
        }
        const linhas = (await execucoes(a.escolaId)).filter((linha) => linha.categoria === 'pessoa_desativada')
        expect(linhas).toHaveLength(2)
        expect(linhas.reduce((soma, linha) => soma + linha.linhas, 0)).toBe(12)
      })

      it('o lote da eliminação é de no máximo 100 pessoas, e o seguinte leva o resto', async () => {
        const a = await escolaNova()
        await bancada.semear(
          "insert into usuario (escola_id, papel, nome, desativado_em) select $1, 'aluno', 'Aluno desativado ' || n, $2::timestamptz - interval '61 months' from generate_series(1, 101) as n",
          [a.escolaId, QUARTA_1H.toISOString()],
        )
        const real = new ExpurgoDaEscolaRepository(bancada.banco)
        const lotes: number[] = []
        const contando = Object.assign(Object.create(real) as ExpurgoDaEscolaRepository, {
          expurgarLote: async (alvo: AlvoDoExpurgoDaEscola, prazo: PrazoDoLote, limite: number) => {
            const lote = await real.expurgarLote(alvo, prazo, limite)
            if (alvo === 'usuario') lotes.push(lote.linhas)
            return lote
          },
        })
        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { repositorio: contando }))
        expect(lotes).toEqual([100, 1])
        expect((await bancada.pool.query("select 1 from usuario where escola_id = $1 and desativado_em is not null", [a.escolaId])).rowCount).toBe(0)
        expect(await linhaDaCategoria(a.escolaId, 'pessoa_desativada')).toEqual({ categoria: 'pessoa_desativada', linhas: 101, concluida: true })
      })
    })

    describe('expurgo_execucao', () => {
      /** Uma linha do registro do expurgo, com `linhas` como marca para o teste achá-la. */
      async function registro(escolaId: string, marca: number, ha: string): Promise<void> {
        await bancada.pool.query("insert into expurgo_execucao (escola_id, categoria, linhas, concluida, em) values ($1, 'conversa_tutor', $2, true, $3::timestamptz - $4::interval)", [escolaId, marca, QUARTA_1H.toISOString(), ha])
      }
      const marcas = async (escolaId: string): Promise<number[]> =>
        (await bancada.pool.query<{ linhas: number }>('select linhas from expurgo_execucao where escola_id = $1 and linhas >= 7000 order by linhas', [escolaId])).rows.map((linha) => linha.linhas)

      it('com 5 anos e um dia o registro sai, com 5 anos menos um dia fica, o de outra escola fica, e as linhas desta noite não saem; vários lotes levam tudo', async () => {
        const a = await escolaNova()
        const b = await escolaNova()
        for (let marca = 7001; marca <= 7005; marca += 1) await registro(a.escolaId, marca, '60 months 1 day')
        await registro(a.escolaId, 7101, '60 months - 1 day')
        await registro(b.escolaId, 7001, '60 months 1 day')

        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { lote: 2 }))
        expect(await marcas(a.escolaId)).toEqual([7101])
        expect(await marcas(b.escolaId)).toEqual([7001])
        // As doze linhas da noite que acabou de rodar ficam: o registro só apaga o que passou de 5 anos.
        expect((await execucoes(a.escolaId)).filter((linha) => linha.linhas < 7000)).toHaveLength(CATEGORIAS_DO_EXPURGO.length)
        expect(log.doEvento('retencao.expurgada').filter((linha) => linha['escolaId'] === a.escolaId)).toEqual([expect.objectContaining({ registroApagadoTotal: 5 })])
      })

      it('o lote do registro apaga no máximo o limite e diz se veio cheio, leva primeiro o mais antigo, e pula, sem esperar, a linha que outra transação travou', async () => {
        const a = await escolaNova()
        const b = await escolaNova()
        for (let marca = 7001; marca <= 7005; marca += 1) await registro(a.escolaId, marca, `${String(60 + marca - 7000)} months`)
        await registro(b.escolaId, 7001, '70 months')
        const lote = (limite: number) => runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () => new ExpurgoDaEscolaRepository(bancada.banco).expurgarRegistroDoExpurgo(QUARTA_1H, limite))
        // A 7005 é a mais antiga (65 meses), a 7001, a mais recente (61): o lote de 2 leva a 7005 e a 7004, e pula a travada.
        const outra = await bancada.pool.connect()
        try {
          await outra.query('begin')
          await outra.query('select 1 from expurgo_execucao where escola_id = $1 and linhas = 7004 for update', [a.escolaId])
          expect(await lote(2)).toEqual({ linhas: 2, cheio: true })
          expect(await marcas(a.escolaId)).toEqual([7001, 7002, 7004])
        } finally {
          await outra.query('rollback')
          outra.release()
        }
        expect(await lote(2)).toEqual({ linhas: 2, cheio: true })
        expect(await lote(2)).toEqual({ linhas: 1, cheio: false })
        expect(await lote(2)).toEqual({ linhas: 0, cheio: false })
        expect(await marcas(b.escolaId)).toEqual([7001])
      })

      it('se a janela letiva abre depois da última categoria, a noite fica completa e o registro vencido sai na noite seguinte', async () => {
        const a = await escolaNova()
        await registro(a.escolaId, 7001, '60 months 1 day')
        const relogio = relogioEm(QUARTA_1H)
        const real = new ExpurgoDaEscolaRepository(bancada.banco)
        const abreDepoisDaUltima = Object.assign(Object.create(real) as ExpurgoDaEscolaRepository, {
          expurgarLote: async (alvo: AlvoDoExpurgoDaEscola, prazo: PrazoDoLote, limite: number) => {
            const lote = await real.expurgarLote(alvo, prazo, limite)
            if (alvo === 'usuario') relogio.atual = QUARTA_8H
            return lote
          },
        })
        await rodar(a.escolaId, expurgo(relogio, { repositorio: abreDepoisDaUltima }))
        expect(await marcas(a.escolaId)).toEqual([7001])
        expect((await execucoes(a.escolaId)).filter((linha) => linha.linhas < 7000).every((linha) => linha.concluida)).toBe(true)
        expect(log.doEvento('retencao.expurgo_interrompido').some((linha) => linha['escolaId'] === a.escolaId && linha['tipo'] === 'expurgo_execucao')).toBe(true)

        await rodar(a.escolaId, expurgo(relogioEm(QUINTA_1H)))
        expect(await marcas(a.escolaId)).toEqual([])
      })
    })
  })

  describe('banco', () => {
    it('`expurgo_execucao` recusa categoria fora do catálogo e contagem negativa, e o check de categoria tem exatamente o catálogo', async () => {
      const a = await escolaNova()
      const inserir = (categoria: string, linhas: number) =>
        bancada.pool.query('insert into expurgo_execucao (escola_id, categoria, linhas, concluida, em) values ($1, $2, $3, true, now())', [a.escolaId, categoria, linhas])
      await expect(inserir('registro_acesso', 0)).rejects.toMatchObject({ code: '23514', constraint: 'expurgo_execucao_categoria_valida' })
      await expect(inserir('conversa_tutor', -1)).rejects.toMatchObject({ code: '23514', constraint: 'expurgo_execucao_linhas_nao_negativas' })
      await inserir('conversa_tutor', 0)
      const { rows } = await bancada.pool.query<{ definicao: string }>("select pg_get_constraintdef(oid) as definicao from pg_constraint where conname = 'expurgo_execucao_categoria_valida'")
      expect(rows).toHaveLength(1)
      expect([...(rows[0]?.definicao ?? '').matchAll(/'(\w+)'/g)].map((literal) => literal[1]).toSorted()).toEqual([...CHAVES_DE_RETENCAO].toSorted())
    })
  })

  describe('índices da migration 0027', () => {
    it('os nove existem, começam pelo escopo e têm o predicado que o lote ou a conferência da FK usa', async () => {
      const { rows } = await bancada.pool.query<{ indexname: string; indexdef: string }>(
        `select indexname, indexdef from pg_indexes where schemaname = 'public' and indexname = any($1::text[]) order by indexname`,
        [['artefato_criado_por_idx', 'execucao_agente_solicitada_por_idx', 'material_excluido_idx', 'mensagem_tutor_material_idx', 'reivindicacao_decidida_idx', 'sinal_tutor_material_idx', 'tentativa_atividade_aluno_idx', 'usuario_desativado_idx', 'vinculo_encerrado_idx']],
      )
      const definicao = Object.fromEntries(rows.map((linha) => [linha.indexname, linha.indexdef.replace(/^.* USING btree /, '')]))
      expect(definicao).toEqual({
        artefato_criado_por_idx: '(escola_id, criado_por) WHERE (criado_por IS NOT NULL)',
        execucao_agente_solicitada_por_idx: '(escola_id, solicitada_por) WHERE (solicitada_por IS NOT NULL)',
        material_excluido_idx: '(escola_id, excluido_em) WHERE (excluido_em IS NOT NULL)',
        mensagem_tutor_material_idx: '(escola_id, material_id) WHERE (material_id IS NOT NULL)',
        reivindicacao_decidida_idx: "(escola_id, COALESCE(decidida_em, solicitada_em)) WHERE (estado <> 'pendente'::text)",
        sinal_tutor_material_idx: '(escola_id, material_id) WHERE (material_id IS NOT NULL)',
        tentativa_atividade_aluno_idx: '(escola_id, aluno_id)',
        usuario_desativado_idx: '(escola_id, desativado_em) WHERE (desativado_em IS NOT NULL)',
        vinculo_encerrado_idx: "(escola_id, encerrado_em) WHERE (estado = 'encerrado'::text)",
      })
    })
  })

  describe('isolamento', () => {
    it('duas linhas no mesmo instante: a última gravada decide a categoria pendente', async () => {
      const a = await escolaNova()
      const inserir = (categoria: string, concluida: boolean) =>
        bancada.pool.query('insert into expurgo_execucao (escola_id, categoria, linhas, concluida, em) values ($1, $2, 0, $3, $4)', [a.escolaId, categoria, concluida, QUARTA_1H.toISOString()])
      await inserir('conversa_tutor', true)
      await inserir('sinal_tutor', false)
      const repositorio = new ExpurgoDaEscolaRepository(bancada.banco)
      const pendente = () => runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () => repositorio.categoriaPendente())
      expect(await pendente()).toBe('sinal_tutor')
      // A noite seguinte terminou a pendente: a última linha é `true`, e não há mais pendente.
      await bancada.pool.query("insert into expurgo_execucao (escola_id, categoria, linhas, concluida, em) values ($1, 'sinal_tutor', 0, true, $2)", [a.escolaId, QUINTA_1H.toISOString()])
      expect(await pendente()).toBeUndefined()
    })

    it('a categoria pendente e as noites de uma escola não leem as linhas de execução de outra', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      // B parou na conversa do professor; A nunca rodou.
      await bancada.pool.query("insert into expurgo_execucao (escola_id, categoria, linhas, concluida, em) values ($1, 'conversa_professor', 3, false, $2)", [b.escolaId, QUARTA_1H.toISOString()])
      const repositorio = new ExpurgoDaEscolaRepository(bancada.banco)
      const emA = <T>(funcao: () => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, funcao)
      expect(await emA(() => repositorio.categoriaPendente())).toBeUndefined()
      expect(await emA(() => repositorio.noitesDoAlerta('America/Sao_Paulo', QUINTA_1H, CATEGORIAS_DO_EXPURGO))).toBeUndefined()
      await rodar(a.escolaId, expurgo(relogioEm(QUINTA_1H)))
      expect((await execucoes(a.escolaId)).map(({ categoria }) => categoria)).toEqual([...CATEGORIAS_DO_EXPURGO])
    })
  })

  describe('medição do alerta de duas noites', () => {
    /** Uma linha de execução da escola, gravada direto, na data e hora locais de São Paulo. */
    async function noite(escolaId: string, em: string, linhas: ReadonlyArray<readonly [string, boolean]>): Promise<void> {
      for (const [categoria, concluida] of linhas) {
        await bancada.pool.query('insert into expurgo_execucao (escola_id, categoria, linhas, concluida, em) values ($1, $2, 0, $3, $4)', [escolaId, categoria, concluida, `${em}-03:00`])
      }
    }
    const completa = CATEGORIAS_DO_EXPURGO.map((categoria) => [categoria, true] as const)
    const parcial = [
      ['conversa_tutor', true],
      ['sinal_tutor', false],
    ] as const
    /** Quarta ao meio-dia: as noites contadas são terça (ontem) e segunda. */
    const QUARTA_12H = new Date('2026-10-07T12:00:00-03:00')

    function medicaoDe(ids: readonly string[], medidor: MedidorDeTeste, repositorio: Pick<ExpurgoDaEscolaRepository, 'noitesDoAlerta'> = new ExpurgoDaEscolaRepository(bancada.banco), listar?: () => Promise<string[]>): MedicaoDoExpurgo {
      return new MedicaoDoExpurgo({
        escolas: { listarIds: listar ?? (() => Promise.resolve([...ids])) },
        repositorio,
        janelaDaEscola: janelaDaEscola(),
        relogio: relogioEm(QUARTA_12H),
        logger: log.logger,
        medidor: medidor.medidor,
      })
    }

    async function porEscola(medidor: MedidorDeTeste): Promise<Record<string, unknown>> {
      return Object.fromEntries((await medidor.pontos('expurgo.noites_incompletas')).map(({ atributos, valor }) => [String(atributos['escola_id']), valor]))
    }

    it('duas noites parciais dão 2; parcial seguida de completa dá 0; categoria sem linha conta como não concluída; escola sem execução não tem série; a noite anterior à primeira não conta', async () => {
      const [a, b, c, d, e] = [await escolaNova(), await escolaNova(), await escolaNova(), await escolaNova(), await escolaNova()]
      await noite(a.escolaId, '2026-10-05T02:00:00', parcial)
      await noite(a.escolaId, '2026-10-06T02:00:00', parcial)
      await noite(b.escolaId, '2026-10-05T02:00:00', parcial)
      await noite(b.escolaId, '2026-10-06T02:00:00', completa)
      // C terminou as duas que percorreu na terça, mas não tem linha da conversa do professor nem das seguintes.
      await noite(c.escolaId, '2026-10-05T02:00:00', parcial)
      await noite(c.escolaId, '2026-10-06T02:00:00', [
        ['conversa_tutor', true],
        ['sinal_tutor', true],
      ])
      // E rodou pela primeira vez na terça, e parou.
      await noite(e.escolaId, '2026-10-06T02:00:00', parcial)
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())
      const medicao = new MedicaoDoExpurgo({
        escolas: { listarIds: () => Promise.resolve([a.escolaId, b.escolaId, c.escolaId, d.escolaId, e.escolaId]) },
        repositorio: new ExpurgoDaEscolaRepository(bancada.banco),
        janelaDaEscola: janelaDaEscola(),
        // Quarta ao meio-dia: as noites contadas são terça (ontem) e segunda.
        relogio: relogioEm(new Date('2026-10-07T12:00:00-03:00')),
        logger: log.logger,
        medidor: medidor.medidor,
      })
      const avisosAntes = log.doEvento('worker.medicao_do_expurgo_indisponivel').length
      await medicao.medir()
      // A escola sem execução não é falha: fica sem série, sem aviso.
      expect(log.doEvento('worker.medicao_do_expurgo_indisponivel')).toHaveLength(avisosAntes)
      const pontos = await medidor.pontos('expurgo.noites_incompletas')
      const porEscola = Object.fromEntries(pontos.map(({ atributos, valor }) => [String(atributos['escola_id']), valor]))
      expect(porEscola).toEqual({ [a.escolaId]: 2, [b.escolaId]: 0, [c.escolaId]: 2, [e.escolaId]: 1 })
      for (const { atributos } of pontos) expect(Object.keys(atributos)).toEqual(['escola_id'])
    })

    it('a noite só é completa com uma linha concluída de cada categoria do expurgo, naquele dia local e naquela escola', async () => {
      const [f, g, h, i, j] = [await escolaNova(), await escolaNova(), await escolaNova(), await escolaNova(), await escolaNova()]
      // F: todas as categorias têm linha na terça, mas a última parou pela janela.
      await noite(f.escolaId, '2026-10-05T02:00:00', parcial)
      await noite(f.escolaId, '2026-10-06T02:00:00', [
        ...CATEGORIAS_DO_EXPURGO.slice(0, -1).map((categoria) => [categoria, true] as const),
        [CATEGORIAS_DO_EXPURGO[CATEGORIAS_DO_EXPURGO.length - 1] ?? '', false] as const,
      ])
      // G: na terça, todas do expurgo menos uma, e no lugar dela uma categoria que ele ainda não percorre: não a completa.
      await noite(g.escolaId, '2026-10-05T02:00:00', parcial)
      await noite(g.escolaId, '2026-10-06T02:00:00', [...CATEGORIAS_DO_EXPURGO.slice(0, -1).map((categoria) => [categoria, true] as const), ['trabalho_do_aluno', true] as const])
      // H: na terça, todas menos uma, e a primeira concluída duas vezes (dois jobs): conta uma vez só, e a noite não fecha.
      await noite(h.escolaId, '2026-10-05T02:00:00', parcial)
      await noite(h.escolaId, '2026-10-06T02:00:00', [...CATEGORIAS_DO_EXPURGO.slice(0, -1).map((categoria) => [categoria, true] as const), ['conversa_tutor', true] as const])
      // I: nada na terça, e a noite de hoje (quarta) completa não vale por ela.
      await noite(i.escolaId, '2026-10-05T02:00:00', parcial)
      await noite(i.escolaId, '2026-10-07T02:00:00', completa)
      // J: nada na terça, segunda completa (e domingo parcial): a segunda não vale pela terça, e para a contagem.
      await noite(j.escolaId, '2026-10-04T02:00:00', parcial)
      await noite(j.escolaId, '2026-10-05T02:00:00', completa)
      // A escola B tem a terça completa: as linhas dela não completam a terça de nenhuma das outras.
      const b = await escolaNova()
      await noite(b.escolaId, '2026-10-06T02:00:00', completa)
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())
      await medicaoDe([f.escolaId, g.escolaId, h.escolaId, i.escolaId, j.escolaId, b.escolaId], medidor).medir()
      expect(await porEscola(medidor)).toEqual({ [f.escolaId]: 2, [g.escolaId]: 2, [h.escolaId]: 2, [i.escolaId]: 2, [j.escolaId]: 1, [b.escolaId]: 0 })
    })

    it('a escola que falha fica sem série nesta volta, e as outras são medidas; a lista que falha tira toda a exportação', async () => {
      const [a, b] = [await escolaNova(), await escolaNova()]
      await noite(a.escolaId, '2026-10-05T02:00:00', parcial)
      await noite(a.escolaId, '2026-10-06T02:00:00', parcial)
      await noite(b.escolaId, '2026-10-06T02:00:00', completa)
      const real = new ExpurgoDaEscolaRepository(bancada.banco)
      // A leitura da escola B falha (o Postgres recusou a consulta dela); a de A segue.
      const falhaEmB: Pick<ExpurgoDaEscolaRepository, 'noitesDoAlerta'> = {
        noitesDoAlerta: (fuso, agora, categorias) => (currentContext()?.escolaId === b.escolaId ? Promise.reject(new Error('banco lento')) : real.noitesDoAlerta(fuso, agora, categorias)),
      }
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())
      let listaFalha = false
      const medicao = medicaoDe([a.escolaId, b.escolaId], medidor, falhaEmB, () => (listaFalha ? Promise.reject(new Error('banco fora')) : Promise.resolve([a.escolaId, b.escolaId])))
      await medicao.medir()
      expect(await porEscola(medidor)).toEqual({ [a.escolaId]: 2 })
      listaFalha = true
      await medicao.medir()
      expect(await porEscola(medidor)).toEqual({})
    })

    it('o encerramento no meio de uma volta para na escola seguinte, sem trocar as séries', async () => {
      const [a, b] = [await escolaNova(), await escolaNova()]
      await noite(a.escolaId, '2026-10-06T02:00:00', parcial)
      await noite(b.escolaId, '2026-10-06T02:00:00', parcial)
      const real = new ExpurgoDaEscolaRepository(bancada.banco)
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())
      const montada: { medicao?: MedicaoDoExpurgo } = {}
      const encerraNaPrimeira: Pick<ExpurgoDaEscolaRepository, 'noitesDoAlerta'> = {
        noitesDoAlerta: async (fuso, agora, categorias) => {
          await montada.medicao?.encerrar()
          return real.noitesDoAlerta(fuso, agora, categorias)
        },
      }
      montada.medicao = medicaoDe([a.escolaId, b.escolaId], medidor, encerraNaPrimeira)
      await montada.medicao.medir()
      expect(await porEscola(medidor)).toEqual({})
    })

    it('o "ontem" é o do fuso da escola: à 1h de quarta em São Paulo, Rio Branco ainda está na terça', async () => {
      const a = await escolaNova()
      await bancada.configurarEscola(a.escolaId, { fuso: 'America/Rio_Branco' })
      // Em Rio Branco: domingo parcial e segunda completa (23h30 de segunda lá é 1h30 de terça em São Paulo).
      await noite(a.escolaId, '2026-10-04T23:00:00', parcial)
      await noite(a.escolaId, '2026-10-06T01:30:00', completa)
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())
      const medicao = new MedicaoDoExpurgo({
        escolas: { listarIds: () => Promise.resolve([a.escolaId]) },
        repositorio: new ExpurgoDaEscolaRepository(bancada.banco),
        janelaDaEscola: janelaDaEscola(),
        // 1h de quarta em São Paulo é 23h de terça em Rio Branco: ontem é segunda, completa. Com o dia de São Paulo, ontem
        // seria terça, sem linha, e o valor seria 1.
        relogio: relogioEm(new Date('2026-10-07T01:00:00-03:00')),
        logger: log.logger,
        medidor: medidor.medidor,
      })
      await medicao.medir()
      expect((await medidor.pontos('expurgo.noites_incompletas')).map(({ valor }) => valor)).toEqual([0])
    })

    it('a noite é contada no fuso da escola: 23h30 de terça em Rio Branco é 1h30 de quarta em São Paulo', async () => {
      const a = await escolaNova()
      await bancada.configurarEscola(a.escolaId, { fuso: 'America/Rio_Branco' })
      // Segunda parcial e terça completa no fuso de Rio Branco; a de terça foi gravada à 1h30 de quarta em São Paulo. Contada
      // no fuso de São Paulo, a terça ficaria sem linha e o valor seria 2.
      await noite(a.escolaId, '2026-10-05T23:30:00', parcial)
      await noite(a.escolaId, '2026-10-07T01:30:00', completa)
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())
      const medicao = new MedicaoDoExpurgo({
        escolas: { listarIds: () => Promise.resolve([a.escolaId]) },
        repositorio: new ExpurgoDaEscolaRepository(bancada.banco),
        janelaDaEscola: janelaDaEscola(),
        relogio: relogioEm(new Date('2026-10-07T12:00:00-03:00')),
        logger: log.logger,
        medidor: medidor.medidor,
      })
      await medicao.medir()
      expect((await medidor.pontos('expurgo.noites_incompletas')).map(({ valor }) => valor)).toEqual([0])
    })
  })

  describe('arquivo do titular (F3, tarefa 13.0): o objeto sai do storage e só então a linha', () => {
    /**
     * Um pedido de acesso do aluno da escola e a versão do arquivo dele, pronta `ha` antes do `agora` (a validade é de 7 dias
     * dessa data), com o objeto gravado no armazém falso. `apagadoEm` marca o que a eliminação do titular marcaria (15.0).
     */
    async function arquivoPronto(
      escola: Escola,
      armazem: InMemoryFileStorage,
      agora: Date,
      ha: string,
      opcoes: { versao?: 'completa' | 'coordenacao'; apagadoEm?: Date; pedidoId?: string } = {},
    ): Promise<{ pedidoId: string; chave: string; arquivoId: string }> {
      const versao = opcoes.versao ?? 'completa'
      let pedidoId = opcoes.pedidoId
      if (pedidoId === undefined) {
        const registrador = await professorNovo(escola)
        const { rows } = await bancada.pool.query<{ id: string }>(
          `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio)
           values ($1, $2, 'aluno', 'acesso', 'titular', current_date, 'pronto', '[]'::jsonb, $3, $4) returning id`,
          [escola.escolaId, escola.alunoId, registrador, randomUUID()],
        )
        pedidoId = rows[0]?.id ?? ''
      }
      const chave = `titular/${escola.escolaId}/${pedidoId}/${versao}.json`
      const { rows } = await bancada.pool.query<{ id: string }>(
        `insert into arquivo_titular (escola_id, pedido_id, versao, chave_objeto, bytes, pronto_em, expira_em, apagado_em)
         values ($1, $2, $3, $4, 100, $5::timestamptz - $6::interval, $5::timestamptz - $6::interval + interval '7 days', $7) returning id`,
        [escola.escolaId, pedidoId, versao, chave, agora.toISOString(), ha, opcoes.apagadoEm ?? null],
      )
      await armazem.guardar(chave, '{}')
      return { pedidoId, chave, arquivoId: rows[0]?.id ?? '' }
    }

    it('com 7 dias o arquivo fica; com 8 saem o objeto e a linha; o de B, com a mesma idade, não é tocado', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const armazem = new InMemoryFileStorage()
      const seteDias = await arquivoPronto(a, armazem, QUARTA_1H, '7 days')
      const oitoDias = await arquivoPronto(a, armazem, QUARTA_1H, '8 days')
      const oitoDiasEmB = await arquivoPronto(b, armazem, QUARTA_1H, '8 days')

      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { armazem }))

      expect(await existe('arquivo_titular', seteDias.arquivoId)).toBe(true)
      expect(armazem.objetos.has(seteDias.chave)).toBe(true)
      expect(await existe('arquivo_titular', oitoDias.arquivoId)).toBe(false)
      expect(armazem.objetos.has(oitoDias.chave)).toBe(false)
      expect(await existe('arquivo_titular', oitoDiasEmB.arquivoId)).toBe(true)
      expect(armazem.objetos.has(oitoDiasEmB.chave)).toBe(true)
      // O arquivo vencido de B sai no job de B, e só no dele.
      await rodar(b.escolaId, expurgo(relogioEm(QUARTA_1H), { armazem }))
      expect(await existe('arquivo_titular', oitoDiasEmB.arquivoId)).toBe(false)
      expect(armazem.objetos.has(oitoDiasEmB.chave)).toBe(false)
    })

    it('o arquivo marcado `apagado_em` sai mesmo dentro dos 7 dias, e o que falha ao apagar fica com a linha para a noite seguinte', async () => {
      const a = await escolaNova()
      const armazem = new InMemoryFileStorage()
      const marcado = await arquivoPronto(a, armazem, QUARTA_1H, '1 day', { apagadoEm: QUARTA_1H })
      const intacto = await arquivoPronto(a, armazem, QUARTA_1H, '1 day')
      armazem.falhaAoApagar = true
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { armazem }))
      // O storage recusou: o objeto e a linha ficam, o job termina e as categorias do expurgo rodaram.
      expect(armazem.objetos.has(marcado.chave)).toBe(true)
      expect(await existe('arquivo_titular', marcado.arquivoId)).toBe(true)
      expect((await execucoes(a.escolaId)).every(({ concluida }) => concluida)).toBe(true)
      expect(log.registros().some((linha) => linha['evento'] === 'retencao.arquivo_nao_apagado')).toBe(true)

      armazem.falhaAoApagar = false
      await rodar(a.escolaId, expurgo(relogioEm(QUINTA_1H), { armazem }))
      expect(armazem.objetos.has(marcado.chave)).toBe(false)
      expect(await existe('arquivo_titular', marcado.arquivoId)).toBe(false)
      // O que não venceu nem foi marcado fica.
      expect(armazem.objetos.has(intacto.chave)).toBe(true)
      expect(await existe('arquivo_titular', intacto.arquivoId)).toBe(true)
    })

    it('com o storage fora de vez, nenhum arquivo sai, e o job não falha por causa disso', async () => {
      const a = await escolaNova()
      const armazem = new InMemoryFileStorage()
      const vencido = await arquivoPronto(a, armazem, QUARTA_1H, '9 days')
      armazem.fora = true
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { armazem }))
      expect(await existe('arquivo_titular', vencido.arquivoId)).toBe(true)
      armazem.fora = false
      expect(armazem.objetos.has(vencido.chave)).toBe(true)
    })

    it('com a janela letiva aberta nenhum arquivo é apagado: o lote não urgente espera a noite', async () => {
      const a = await escolaNova()
      const armazem = new InMemoryFileStorage()
      const vencido = await arquivoPronto(a, armazem, QUARTA_8H, '9 days')
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_8H), { armazem }))
      expect(await existe('arquivo_titular', vencido.arquivoId)).toBe(true)
      expect(armazem.objetos.has(vencido.chave)).toBe(true)
    })

    it('mais de um lote de arquivos vencidos: 205 saem na mesma noite, em lotes de 100, e o recente fica', async () => {
      const a = await escolaNova()
      const armazem = new InMemoryFileStorage()
      const registrador = await professorNovo(a)
      const { rows: pedidos } = await bancada.pool.query<{ id: string }>(
        `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio)
         select $1, $2, 'aluno', 'acesso', 'titular', current_date, 'pronto', '[]'::jsonb, $3, gen_random_uuid() from generate_series(1, 206) returning id`,
        [a.escolaId, a.alunoId, registrador],
      )
      const ids = pedidos.map(({ id }) => id)
      // 205 vencidos (9 dias) e o último com 1 dia.
      await bancada.pool.query(
        `insert into arquivo_titular (escola_id, pedido_id, versao, chave_objeto, bytes, pronto_em, expira_em)
         select $1::uuid, p, 'completa', 'titular/' || $1::text || '/' || p::text || '/completa.json', 100,
                $2::timestamptz - case when n <= 205 then interval '9 days' else interval '1 day' end,
                $2::timestamptz - case when n <= 205 then interval '9 days' else interval '1 day' end + interval '7 days'
         from unnest($3::uuid[]) with ordinality as t(p, n)`,
        [a.escolaId, QUARTA_1H.toISOString(), ids],
      )
      for (const id of ids) await armazem.guardar(`titular/${a.escolaId}/${id}/completa.json`, '{}')
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { armazem }))
      expect(await quantas('arquivo_titular', a.escolaId)).toBe(1)
      expect(armazem.objetos.size).toBe(1)
    })

    it('[P] dois jobs da mesma escola ao mesmo tempo apagam cada arquivo uma vez, sem erro', async () => {
      const a = await escolaNova()
      const armazem = new InMemoryFileStorage()
      const vencidos = await Promise.all([1, 2, 3].map(() => arquivoPronto(a, armazem, QUARTA_1H, '10 days')))
      await Promise.all([rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { armazem })), rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H), { armazem }))])
      for (const { arquivoId, chave } of vencidos) {
        expect(await existe('arquivo_titular', arquivoId)).toBe(false)
        expect(armazem.objetos.has(chave)).toBe(false)
      }
    })
  })

  describe('eliminações vencidas (F3, tarefa 15.0): o job `titular.eliminar` de cada pedido, uma vez por noite e a cada 20 h', () => {
    /** O pedido de eliminação `agendado` de um aluno novo da escola, com o `eliminar_em` e a marca de enfileiramento dados (SQL de intervalo). */
    async function pedidoAgendado(escolaId: string, opcoes: { eliminarEm?: string; enfileiradaHa?: string } = {}): Promise<{ pedidoId: string; titularId: string }> {
      const titularId = await alunoNovo(escolaId)
      const registrador = await alunoNovo(escolaId)
      const { rows } = await bancada.pool.query<{ id: string }>(
        `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, eliminar_em, eliminacao_enfileirada_em, compartilhamento, registrado_por, chave_envio)
         values ($1, $2, 'aluno', 'eliminacao', 'titular', current_date, 'agendado', ${opcoes.eliminarEm ?? "now() - interval '1 hour'"},
           ${opcoes.enfileiradaHa === undefined ? 'null' : `now() - interval '${opcoes.enfileiradaHa}'`}, '[]'::jsonb, $3, $4) returning id`,
        [escolaId, titularId, registrador, randomUUID()],
      )
      return { pedidoId: rows[0]?.id ?? '', titularId }
    }

    async function jobsDeEliminacao(escolaId: string): Promise<Array<{ chave: string; fila: string; naoUrgente: boolean; dados: unknown; estado: string }>> {
      const { rows } = await bancada.pool.query<{ chave: string; fila: string; naoUrgente: boolean; dados: unknown; estado: string }>(
        `select chave_idempotencia as chave, fila, nao_urgente as "naoUrgente", dados, estado from job_registro where escola_id = $1 and tipo = 'titular.eliminar' order by criado_em, id`,
        [escolaId],
      )
      return rows
    }

    async function marca(pedidoId: string): Promise<Date | null> {
      return (await bancada.pool.query<{ marca: Date | null }>('select eliminacao_enfileirada_em as marca from pedido_titular where id = $1', [pedidoId])).rows[0]?.marca ?? null
    }

    it('o pedido vencido vira um job na fila de lote, não urgente, só com o id do pedido, e ganha a marca; o ainda no prazo, o cancelado e o concluído não', async () => {
      const a = await escolaNova()
      const vencido = await pedidoAgendado(a.escolaId)
      const noPrazo = await pedidoAgendado(a.escolaId, { eliminarEm: "now() + interval '1 day'" })
      const cancelado = await pedidoAgendado(a.escolaId)
      await bancada.pool.query("update pedido_titular set estado = 'cancelado', cancelado_em = now(), cancelado_por = registrado_por where id = $1", [cancelado.pedidoId])
      const concluido = await pedidoAgendado(a.escolaId)
      await bancada.pool.query("update pedido_titular set estado = 'concluido', concluido_em = now(), concluido_por = registrado_por where id = $1", [concluido.pedidoId])

      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))

      expect(await jobsDeEliminacao(a.escolaId)).toEqual([
        { chave: `eliminacao:${vencido.pedidoId}`, fila: 'lote', naoUrgente: true, dados: { pedidoId: vencido.pedidoId }, estado: 'aguardando' },
      ])
      expect(await marca(vencido.pedidoId)).not.toBeNull()
      expect(await marca(noPrazo.pedidoId)).toBeNull()
      expect(await marca(cancelado.pedidoId)).toBeNull()
      expect(await marca(concluido.pedidoId)).toBeNull()
    })

    it('enfileirado há menos de 20 h espera; há mais de 20 h entra de novo, com a marca renovada', async () => {
      const a = await escolaNova()
      const recente = await pedidoAgendado(a.escolaId, { enfileiradaHa: '19 hours' })
      const velho = await pedidoAgendado(a.escolaId, { enfileiradaHa: '21 hours' })
      const marcaDoRecente = await marca(recente.pedidoId)

      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))

      expect((await jobsDeEliminacao(a.escolaId)).map(({ chave }) => chave)).toEqual([`eliminacao:${velho.pedidoId}`])
      expect(await marca(recente.pedidoId)).toEqual(marcaDoRecente)
      expect((await marca(velho.pedidoId))?.getTime()).toBeGreaterThan(Date.now() - 60_000)
    })

    it('o job ainda não terminado do mesmo pedido conta como já enfileirado: a noite seguinte não grava outro', async () => {
      const a = await escolaNova()
      const { pedidoId } = await pedidoAgendado(a.escolaId)
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      // A marca de 21 h atrás, com o job ainda `enfileirado`: reenfileira a marca, e a chave devolve o mesmo job.
      await bancada.pool.query("update pedido_titular set eliminacao_enfileirada_em = now() - interval '21 hours' where id = $1", [pedidoId])
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect(await jobsDeEliminacao(a.escolaId)).toHaveLength(1)
      expect((await marca(pedidoId))?.getTime()).toBeGreaterThan(Date.now() - 60_000)
    })

    it('o job que terminou pela janela (`concluido`) e o pedido ainda `agendado` 21 h depois: a mesma chave grava um job novo', async () => {
      const a = await escolaNova()
      const { pedidoId } = await pedidoAgendado(a.escolaId)
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      // O job terminou (a troca parou na janela, o pedido segue `agendado`), e a marca já tem mais de 20 h.
      await bancada.pool.query("update job_registro set estado = 'concluido', concluido_em = now() where escola_id = $1 and tipo = 'titular.eliminar'", [a.escolaId])
      await bancada.pool.query("update pedido_titular set eliminacao_enfileirada_em = now() - interval '21 hours' where id = $1", [pedidoId])

      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))

      const jobs = await jobsDeEliminacao(a.escolaId)
      expect(jobs.map(({ chave, estado }) => ({ chave, estado }))).toEqual([
        { chave: `eliminacao:${pedidoId}`, estado: 'concluido' },
        { chave: `eliminacao:${pedidoId}`, estado: 'aguardando' },
      ])
    })

    it('a noite leva no máximo 500 pedidos, os de prazo mais antigo primeiro; os que sobram entram na seguinte', async () => {
      const a = await escolaNova()
      const registrador = await alunoNovo(a.escolaId)
      const total = LIMITE_DE_ELIMINACOES_ENFILEIRADAS_POR_NOITE + 1
      await bancada.pool.query(
        `with novos as (
           insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno em massa ' || g from generate_series(1, $2::int) g returning id
         ), numerados as (select id, row_number() over (order by id) as n from novos)
         insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, eliminar_em, compartilhamento, registrado_por, chave_envio)
         select $1, id, 'aluno', 'eliminacao', 'titular', current_date, 'agendado', now() - interval '2 days' - n * interval '1 second', '[]'::jsonb, $3, gen_random_uuid() from numerados`,
        [a.escolaId, total, registrador],
      )
      const { rows: mais } = await bancada.pool.query<{ id: string }>("select id from pedido_titular where escola_id = $1 order by eliminar_em desc limit 1", [a.escolaId])

      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect(await jobsDeEliminacao(a.escolaId)).toHaveLength(LIMITE_DE_ELIMINACOES_ENFILEIRADAS_POR_NOITE)
      expect(await marca(mais[0]?.id ?? '')).toBeNull()

      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      // Os 500 já têm a marca de agora (menos de 20 h): só o que sobrou entra.
      expect(await jobsDeEliminacao(a.escolaId)).toHaveLength(total)
      expect(await marca(mais[0]?.id ?? '')).not.toBeNull()
    })

    it('o expurgo de A não enfileira o pedido de B, e o log leva só as contagens', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      await pedidoAgendado(a.escolaId)
      const deB = await pedidoAgendado(b.escolaId)
      const antes = log.linhas.length
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect(await jobsDeEliminacao(b.escolaId)).toEqual([])
      expect(await marca(deB.pedidoId)).toBeNull()
      const final = log.linhas.slice(antes).map((linha) => JSON.parse(linha) as Record<string, unknown>).find((linha) => linha['evento'] === 'retencao.expurgada')
      expect(final).toMatchObject({ eliminacoesTotal: 1, eliminacoesJaEnfileiradasTotal: 0 })
    })

    it('[P] dois jobs da mesma escola ao mesmo tempo levam pedidos diferentes: um job de eliminação por pedido', async () => {
      const a = await escolaNova()
      const pedidos = await Promise.all([1, 2, 3, 4, 5, 6].map(() => pedidoAgendado(a.escolaId)))
      await Promise.all([rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H))), rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))])
      const chaves = (await jobsDeEliminacao(a.escolaId)).map(({ chave }) => chave).sort()
      expect(chaves).toEqual(pedidos.map(({ pedidoId }) => `eliminacao:${pedidoId}`).sort())
    })

    it('[P] o pedido que o cancelamento está tocando fica para a noite seguinte; cancelado, nunca vira job', async () => {
      const a = await escolaNova()
      const { pedidoId } = await pedidoAgendado(a.escolaId)
      const cliente = await bancada.pool.connect()
      try {
        // O cancelamento, como o repository o faz, segura a linha no meio da transação.
        await cliente.query('begin')
        await cliente.query("update pedido_titular set estado = 'cancelado', cancelado_em = now(), cancelado_por = registrado_por where id = $1", [pedidoId])
        // Com a linha presa, o enfileiramento não espera por ela: termina agora, sem levar o pedido.
        await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
        await cliente.query('commit')
      } finally {
        cliente.release()
      }
      expect(await jobsDeEliminacao(a.escolaId)).toEqual([])
      expect(await marca(pedidoId)).toBeNull()
      await rodar(a.escolaId, expurgo(relogioEm(QUARTA_1H)))
      expect(await jobsDeEliminacao(a.escolaId)).toEqual([])
    })
  })

  describe('log', () => {
    it('toda linha `retencao.*` que este arquivo produziu, de todos os testes acima, só tem as chaves permitidas: ids e contagens', () => {
      const daRetencao = log.registros().filter((linha) => String(linha['evento']).startsWith('retencao.'))
      const eventos = new Set(daRetencao.map((linha) => String(linha['evento'])))
      expect([...eventos].sort()).toEqual([
        'retencao.arquivo_nao_apagado',
        'retencao.escola_nao_enfileirada',
        'retencao.expurgada',
        'retencao.expurgo_interrompido',
        'retencao.registro_nao_gravado',
        'retencao.rotina_disparada',
      ])
      for (const linha of daRetencao) for (const chave of Object.keys(linha)) expect(CHAVES_DO_LOG.has(chave), `${String(linha['evento'])}: ${chave}`).toBe(true)
      expect(log.linhas.join('\n')).not.toMatch(/sintétic|Pergunta|Resposta/)
    })
  })

  describe('trilha', () => {
    it('o job da escola sai pelo despachante fora do horário letivo e roda no worker de lote montado, que apaga o vencido e grava a execução', async () => {
      const a = await escolaNova()
      const vencida = await mensagemTutor(a, QUARTA_1H, '13 months')
      const relogio = relogioEm(QUARTA_1H)
      const worker = montarWorker(
        { banco: configuracaoDoBanco(), redisFilaUrl: urlRedisDeFila(), pools: { lote: 2 }, vagasPadrao: vagasPadraoDoAmbiente(), threadsMaximo: 1, storage: STORAGE, janelaPadrao: janelaPadraoDoAmbiente() },
        log.logger,
        { prefixo: bancada.prefixo, relogio, agendamentos: [] },
      )
      onTestFinished(() => worker.encerrar())
      bancada.despachante(log, { relogio }).iniciar()
      const enfileirado = await runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () =>
        bancada.banco.transaction((tx) => bancada.enfileirador.enfileirarUmaVez(tx, TIPO_EXPURGAR_ESCOLA, {}, chaveDaNoite('America/Sao_Paulo', QUARTA_1H))),
      )
      await expect.poll(async () => (await bancada.estado(enfileirado.id ?? ''))?.estado, { timeout: 20_000, interval: 100 }).toBe('concluido')
      expect(await existe('mensagem_tutor', vencida)).toBe(false)
      expect((await execucoes(a.escolaId)).map(({ categoria }) => categoria)).toEqual([...CATEGORIAS_DO_EXPURGO])
    })
  })
})

interface NoDoPlano {
  'Index Name'?: string
  'Node Type'?: string
  'Total Cost'?: number
  'Plan Rows'?: number
  Plans?: NoDoPlano[]
}

function nosDoPlano(no: NoDoPlano | undefined): NoDoPlano[] {
  return no === undefined ? [] : [no, ...(no.Plans ?? []).flatMap(nosDoPlano)]
}
