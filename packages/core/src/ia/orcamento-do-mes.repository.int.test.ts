import { getTableConfig } from 'drizzle-orm/pg-core'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { runInContext } from '../context/context.js'
import { createDatabase, type Database } from '../db/database.js'
import { createPool, type DatabasePool } from '../db/pool.js'
import { configuracaoOperacionalEscola } from '../db/schema/configuracao-operacional-escola.js'
import { orcamentoIaDoMes } from '../db/schema/orcamento-ia-do-mes.js'
import { rede } from '../db/schema/rede.js'
import { OrcamentoDoMesRepository } from './orcamento-do-mes.repository.js'

/**
 * O orçamento de IA da escola do contexto (camada-ia, tarefa 2.0; Tech Spec, seções 3, 5 e 6; `cenarios.md`, RF7 a RF9 e seção 2) contra o Postgres do compose de teste: a soma do mês de São Paulo com o custo gravado de
 * cada linha, os alunos ativos pela regra da aba Escolas, a configuração da escola e da rede, o retrato do mês e o isolamento entre duas escolas de redes diferentes, cada leitura conferida nas **duas**. O `EXPLAIN` da soma mora em
 * `orcamento-do-mes.plano.int.test.ts`, num banco só dele (1,8 milhão de linhas não ficam no banco de teste).
 */

const REAIS = 1_000_000
const MARCO = '2026-03'
/** Dia 31 de março às 21h30 em São Paulo: o mês que acaba, e não o seguinte, mesmo já sendo abril em UTC. */
const FIM_DE_MARCO = new Date('2026-03-31T21:30:00-03:00')
const MEIO_DE_ABRIL = new Date('2026-04-15T12:00:00-03:00')

describe('OrcamentoDoMesRepository: o orçamento de IA da escola do contexto', () => {
  let pool: DatabasePool
  let banco: Database
  const redes: string[] = []

  beforeAll(() => {
    pool = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 4, timeoutConexaoMs: 5_000, timeoutConsultaMs: 120_000 }, () => undefined)
    banco = createDatabase(pool)
  })

  afterAll(async () => {
    await pool.end()
  })

  async function id(instrucao: string, valores: unknown[] = []): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(instrucao, valores)
    const linha = rows[0]
    if (linha === undefined) throw new Error('insert sem linha')
    return linha.id
  }

  interface Montagem {
    rede?: { valor?: number | null; teto?: number | null }
    escola?: { valor?: number | null; teto?: number | null }
    /** Sem ano em curso (montagem): o ano fica `planejado`. */
    semAnoEmCurso?: boolean
  }

  interface Escola {
    escolaId: string
    redeId: string
    anoLetivoId: string
    turmaId: string
    coordenadorId: string
    serieId: string
  }

  /** Uma escola sintética inteira, em rede própria: ano, série, turma e um coordenador, com o orçamento dado (micros) na rede e na escola. */
  async function escola({ rede, escola: propria, semAnoEmCurso }: Montagem = {}): Promise<Escola> {
    const redeId = await id('insert into rede (nome, tipo, ia_valor_por_aluno_micros, ia_teto_de_seguranca_percentual) values ($1, $2, $3, $4) returning id', [
      `Rede do orçamento ${randomUUID()}`,
      'independente',
      rede?.valor ?? null,
      rede?.teto ?? null,
    ])
    redes.push(redeId)
    const escolaId = await id('insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id', [redeId, 'Escola do orçamento', `orcamento-${randomUUID()}`])
    if (propria !== undefined) {
      await pool.query('insert into configuracao_operacional_escola (escola_id, ia_valor_por_aluno_micros, ia_teto_de_seguranca_percentual) values ($1, $2, $3)', [
        escolaId,
        propria.valor ?? null,
        propria.teto ?? null,
      ])
    }
    const anoLetivoId = await id("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', $2) returning id", [
      escolaId,
      semAnoEmCurso === true ? 'planejado' : 'em_curso',
    ])
    const serieId = await id("insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [escolaId])
    const turmaId = await id("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºB') returning id", [escolaId, anoLetivoId, serieId])
    const conta = await id('insert into conta (email) values ($1) returning id', [`orcamento-${randomUUID()}@educa.invalid`])
    const coordenadorId = await id("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'coordenador', 'Coordenação sintética') returning id", [escolaId, conta])
    return { escolaId, redeId, anoLetivoId, turmaId, coordenadorId, serieId }
  }

  /** `quantos` alunos ativos na turma do ano em curso, cada um com um vínculo de aluno não encerrado. */
  async function alunos(e: Escola, quantos: number, turmaId = e.turmaId): Promise<string[]> {
    const { rows } = await pool.query<{ id: string }>(
      `with novos as (
         insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno sintético' from generate_series(1, $2::int) returning id
       ), vinculos as (
         insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, criado_por) select $1, $3, id, $4, 'aluno', $5 from novos returning usuario_id
       ) select usuario_id as id from vinculos`,
      [e.escolaId, quantos, e.anoLetivoId, turmaId, e.coordenadorId],
    )
    return rows.map((linha) => linha.id)
  }

  /** Uma chamada da escola, com o custo gravado e o instante dado. */
  function consumo(escolaId: string, custoMicros: number, em: string, modelo = 'modelo-de-teste'): Promise<unknown> {
    return pool.query(
      `insert into consumo_ia (escola_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, custo_micros, em)
       values ($1, 'gerar_atividade_objetiva', 'conversa_e_ferramentas', 'padrao', 'openai_compat', $2, '2026-11-21.1', 100, 50, 10, false, 1, 'concluida', $3, $4::timestamptz)`,
      [escolaId, modelo, custoMicros, em],
    )
  }

  const naEscola = <T>(escolaId: string, corpo: (repositorio: OrcamentoDoMesRepository) => Promise<T>): Promise<T> =>
    runInContext({ requisicaoId: randomUUID(), escolaId }, () => corpo(new OrcamentoDoMesRepository(banco)))

  describe('a soma do mês de São Paulo', () => {
    it('a chamada de 31/03 às 23h30 (UTC-3) conta em março e não em abril, e a de 1º/04 às 00h conta em abril; as bordas do mês são exatas', async () => {
      const e = await escola()
      // 23h30 de São Paulo é 02h30 do dia seguinte em UTC.
      await consumo(e.escolaId, 7 * REAIS, '2026-03-31T23:30:00-03:00')
      await consumo(e.escolaId, 3 * REAIS, '2026-04-01T00:00:00-03:00')
      await consumo(e.escolaId, 2 * REAIS, '2026-03-01T00:00:00-03:00')
      // Um segundo antes de março, e a do mês seguinte ao de abril: de fora.
      await consumo(e.escolaId, 100 * REAIS, '2026-02-28T23:59:59-03:00')
      await consumo(e.escolaId, 200 * REAIS, '2026-05-01T00:00:00-03:00')
      expect(await naEscola(e.escolaId, (r) => r.custoDoMes('2026-03'))).toBe(9 * REAIS)
      expect(await naEscola(e.escolaId, (r) => r.custoDoMes('2026-04'))).toBe(3 * REAIS)
      expect(await naEscola(e.escolaId, (r) => r.custoDoMes('2026-06'))).toBe(0)
    })

    it('duas vigências de preço no mês: a soma usa o custo gravado de cada linha, sem recalcular pelo preço de hoje', async () => {
      const e = await escola()
      // O mesmo modelo, com o custo que cada chamada gravou no preço da época (1.300 e 2.000 micros por mil tokens de entrada).
      await consumo(e.escolaId, 130_000, '2026-03-10T10:00:00-03:00', 'modelo-m')
      await consumo(e.escolaId, 200_000, '2026-03-20T10:00:00-03:00', 'modelo-m')
      expect(await naEscola(e.escolaId, (r) => r.custoDoMes(MARCO))).toBe(330_000)
    })
  })

  describe('os alunos ativos, pela regra da aba Escolas', () => {
    it('o vínculo encerrado não conta, e o aluno que chegou agora conta', async () => {
      const e = await escola()
      const [saiu] = await alunos(e, 2)
      await pool.query("update vinculo set estado = 'encerrado', motivo_encerramento = 'desligamento', encerrado_em = now() where escola_id = $1 and usuario_id = $2", [e.escolaId, saiu])
      expect(await naEscola(e.escolaId, (r) => r.alunosAtivos())).toBe(1)
      await alunos(e, 1)
      expect(await naEscola(e.escolaId, (r) => r.alunosAtivos())).toBe(2)
    })

    it('o aluno em duas turmas do ano conta uma vez; o professor e o usuário desativado não contam', async () => {
      const e = await escola()
      const [dois] = await alunos(e, 3)
      const outraTurma = await id("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºC') returning id", [e.escolaId, e.anoLetivoId, e.serieId])
      await pool.query("insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, criado_por) values ($1, $2, $3, $4, 'aluno', $5)", [
        e.escolaId,
        e.anoLetivoId,
        dois,
        outraTurma,
        e.coordenadorId,
      ])
      const contaDoProfessor = await id('insert into conta (email) values ($1) returning id', [`professor-${randomUUID()}@educa.invalid`])
      const professor = await id("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'professor', 'Professor sintético') returning id", [e.escolaId, contaDoProfessor])
      await pool.query("insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, criado_por) values ($1, $2, $3, $4, 'professor', $5)", [
        e.escolaId,
        e.anoLetivoId,
        professor,
        e.turmaId,
        e.coordenadorId,
      ])
      expect(await naEscola(e.escolaId, (r) => r.alunosAtivos())).toBe(3)
      const [desativado] = await alunos(e, 1)
      await pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [e.escolaId, desativado])
      expect(await naEscola(e.escolaId, (r) => r.alunosAtivos())).toBe(3)
    })

    it('o vínculo não encerrado do ano anterior não conta; só o ano em curso vale', async () => {
      const e = await escola()
      await alunos(e, 2)
      const anoAnterior = await id("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2025, '2025-02-01', '2025-12-15', 'encerrado') returning id", [e.escolaId])
      const turmaAnterior = await id("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '1ºB') returning id", [e.escolaId, anoAnterior, e.serieId])
      // O vínculo do ano que acabou ficou sem encerrar: a virada do ano não o fechou.
      await alunos({ ...e, anoLetivoId: anoAnterior }, 5, turmaAnterior)
      expect(await naEscola(e.escolaId, (r) => r.alunosAtivos())).toBe(2)
    })

    it('sem ano em curso (montagem), zero alunos ativos', async () => {
      const e = await escola({ semAnoEmCurso: true })
      await alunos(e, 4)
      expect(await naEscola(e.escolaId, (r) => r.alunosAtivos())).toBe(0)
    })
  })

  describe('a configuração da escola e da rede', () => {
    it('lê o que cada uma define, nulo onde não definiu; escola sem linha de configuração lê tudo nulo', async () => {
      const sem = await escola({ rede: { valor: 5 * REAIS, teto: 300 } })
      expect(await naEscola(sem.escolaId, (r) => r.configuracaoDaEscola())).toEqual({ valorPorAlunoMicros: null, tetoPercentual: null })
      expect(await naEscola(sem.escolaId, (r) => r.configuracaoDaRede())).toEqual({ valorPorAlunoMicros: 5 * REAIS, tetoPercentual: 300 })
      const propria = await escola({ rede: { valor: 5 * REAIS }, escola: { teto: 150 } })
      expect(await naEscola(propria.escolaId, (r) => r.configuracaoDaEscola())).toEqual({ valorPorAlunoMicros: null, tetoPercentual: 150 })
      expect(await naEscola(propria.escolaId, (r) => r.vigente())).toEqual({ valorPorAlunoMicros: 5 * REAIS, origemDoValor: 'rede', tetoPercentual: 150, origemDoTeto: 'escola' })
      // A rede que não definiu nada: nulo nas duas colunas, e não zero.
      const nada = await escola()
      expect(await naEscola(nada.escolaId, (r) => r.configuracaoDaRede())).toEqual({ valorPorAlunoMicros: null, tetoPercentual: null })
      expect(await naEscola(nada.escolaId, (r) => r.vigente())).toEqual({ valorPorAlunoMicros: null, origemDoValor: 'nenhuma', tetoPercentual: 200, origemDoTeto: 'padrao' })
    })

    it('o schema declara os mesmos checks que a migration criou: um check que sai do `.ts` sem sair do banco, ou o contrário, é desvio', async () => {
      const doSchema = [configuracaoOperacionalEscola, rede, orcamentoIaDoMes].flatMap((tabela) => getTableConfig(tabela).checks.map((verificacao) => verificacao.name))
      const { rows } = await pool.query<{ nome: string }>(
        `select conname as nome from pg_constraint where contype = 'c' and (conname like 'configuracao_operacional_ia\\_%' or conname like 'rede\\_ia\\_%' or conname like 'orcamento\\_ia\\_do\\_mes\\_%')`,
      )
      const novos = (nome: string): boolean => /^(configuracao_operacional_ia_|rede_ia_|orcamento_ia_do_mes_)/u.test(nome)
      expect(doSchema.filter(novos).toSorted()).toEqual(rows.map((linha) => linha.nome).toSorted())
      expect(doSchema.filter(novos)).toHaveLength(10)
    })

    it('os checks: valor maior que zero e teto de 100 a 1000, na escola, na rede e no retrato', async () => {
      const e = await escola()
      const recusa = (instrucao: string, valores: unknown[]): Promise<string> => pool.query(instrucao, valores).then(() => 'aceitou', (erro: Error) => erro.message)
      const naConfiguracao = (coluna: string, valor: number) => recusa(`insert into configuracao_operacional_escola (escola_id, ${coluna}) values ($1, $2)`, [e.escolaId, valor])
      const naRede = (coluna: string, valor: number) => recusa(`update rede set ${coluna} = $2 where id = $1`, [e.redeId, valor])
      expect(await naConfiguracao('ia_valor_por_aluno_micros', 0)).toContain('configuracao_operacional_ia_valor_positivo')
      expect(await naConfiguracao('ia_teto_de_seguranca_percentual', 99)).toContain('configuracao_operacional_ia_teto_valido')
      expect(await naConfiguracao('ia_teto_de_seguranca_percentual', 1001)).toContain('configuracao_operacional_ia_teto_valido')
      expect(await naRede('ia_valor_por_aluno_micros', 0)).toContain('rede_ia_valor_positivo')
      expect(await naRede('ia_teto_de_seguranca_percentual', 99)).toContain('rede_ia_teto_valido')
      expect(await naRede('ia_teto_de_seguranca_percentual', 1001)).toContain('rede_ia_teto_valido')
      // As bordas passam.
      expect(await naRede('ia_teto_de_seguranca_percentual', 100)).toBe('aceitou')
      expect(await naRede('ia_teto_de_seguranca_percentual', 1000)).toBe('aceitou')
      expect(await naRede('ia_valor_por_aluno_micros', 1)).toBe('aceitou')
      expect(await naConfiguracao('ia_teto_de_seguranca_percentual', 100)).toBe('aceitou')

      const noRetrato = (mes: string, valor: number | null, teto: number, origem: string, alunosAtivos = 10) =>
        recusa('insert into orcamento_ia_do_mes (escola_id, mes, alunos_ativos, valor_por_aluno_micros, teto_percentual, origem_do_valor) values ($1, $2, $3, $4, $5, $6)', [
          e.escolaId,
          mes,
          alunosAtivos,
          valor,
          teto,
          origem,
        ])
      expect(await noRetrato('2026-03-02', 5 * REAIS, 200, 'escola')).toContain('orcamento_ia_do_mes_mes_e_dia_1')
      expect(await noRetrato('2026-03-01', 0, 200, 'escola')).toContain('orcamento_ia_do_mes_valor_positivo')
      expect(await noRetrato('2026-03-01', 5 * REAIS, 99, 'escola')).toContain('orcamento_ia_do_mes_teto_valido')
      expect(await noRetrato('2026-03-01', 5 * REAIS, 1001, 'escola')).toContain('orcamento_ia_do_mes_teto_valido')
      expect(await noRetrato('2026-03-01', 5 * REAIS, 200, 'inventada')).toContain('orcamento_ia_do_mes_origem_valida')
      expect(await noRetrato('2026-03-01', null, 200, 'escola')).toContain('orcamento_ia_do_mes_origem_diz_o_valor')
      expect(await noRetrato('2026-03-01', 5 * REAIS, 200, 'nenhuma')).toContain('orcamento_ia_do_mes_origem_diz_o_valor')
      expect(await noRetrato('2026-03-01', 5 * REAIS, 200, 'escola', -1)).toContain('orcamento_ia_do_mes_alunos_nao_negativo')
      expect(await noRetrato('2026-03-01', null, 1000, 'nenhuma', 0)).toBe('aceitou')
    })
  })

  describe('o retrato do mês', () => {
    it('regravar o mês corrente não duplica a linha e atualiza o instante; a medida grava o mês que acaba às 21h30 do último dia, e não o seguinte', async () => {
      const e = await escola({ escola: { valor: 5 * REAIS } })
      await alunos(e, 10)
      await naEscola(e.escolaId, (r) => r.regravarRetrato(FIM_DE_MARCO))
      // A primeira gravação leva o "agora" que o chamador deu, e não o relógio do banco.
      const { rows: primeira } = await pool.query<{ confere: boolean }>('select atualizado_em = $2::timestamptz as confere from orcamento_ia_do_mes where escola_id = $1', [e.escolaId, FIM_DE_MARCO.toISOString()])
      expect(primeira[0]?.confere).toBe(true)
      const depois = new Date('2026-03-31T21:35:00-03:00')
      await alunos(e, 5)
      const orcamento = await naEscola(e.escolaId, (r) => r.regravarRetrato(depois))
      expect(orcamento).toMatchObject({ situacao: 'definido', alunosAtivos: 15, orcamentoMicros: 75 * REAIS })
      const { rows } = await pool.query<{ mes: string; alunos: number; atualizado: string }>(
        "select mes::text, alunos_ativos as alunos, atualizado_em::text as atualizado from orcamento_ia_do_mes where escola_id = $1 order by mes",
        [e.escolaId],
      )
      expect(rows.map((linha) => [linha.mes, linha.alunos])).toEqual([['2026-03-01', 15]])
      const { rows: instante } = await pool.query<{ confere: boolean }>('select atualizado_em = $2::timestamptz as confere from orcamento_ia_do_mes where escola_id = $1', [e.escolaId, depois.toISOString()])
      expect(instante[0]?.confere).toBe(true)
    })

    it('o mês fechado guarda o último retrato, com os alunos e o valor dele, mesmo depois de o valor e os alunos mudarem; o corrente é calculado na hora', async () => {
      const e = await escola({ escola: { valor: 5 * REAIS } })
      await alunos(e, 100)
      await consumo(e.escolaId, 400 * REAIS, '2026-03-20T10:00:00-03:00')
      await naEscola(e.escolaId, (r) => r.regravarRetrato(FIM_DE_MARCO))
      // Abril: o valor muda, chegam alunos e o mês de março já fechou.
      await pool.query('update configuracao_operacional_escola set ia_valor_por_aluno_micros = $2 where escola_id = $1', [e.escolaId, 1 * REAIS])
      await alunos(e, 50)
      expect(await naEscola(e.escolaId, (r) => r.doMes(MARCO, MEIO_DE_ABRIL))).toMatchObject({
        situacao: 'definido',
        alunosAtivos: 100,
        valorPorAlunoMicros: 5 * REAIS,
        origemDoValor: 'escola',
        orcamentoMicros: 500 * REAIS,
        custoMicros: 400 * REAIS,
        porcentagem: 80,
        aviso: null,
      })
      // O mês corrente lê o de hoje: 150 alunos a R$ 1 e nenhum gasto.
      expect(await naEscola(e.escolaId, (r) => r.doMes('2026-04', MEIO_DE_ABRIL))).toMatchObject({ alunosAtivos: 150, valorPorAlunoMicros: 1 * REAIS, orcamentoMicros: 150 * REAIS, custoMicros: 0, porcentagem: 0, aviso: null })
    })

    it('duas réplicas da medida regravando o mesmo mês ao mesmo tempo deixam uma linha só (qual valor fica, a corrida forçada pela trava prova em `apps/worker/test/orcamento-gauge.int.test.ts`)', async () => {
      const e = await escola({ escola: { valor: 5 * REAIS } })
      await alunos(e, 10)
      const [primeira, segunda] = await Promise.all([naEscola(e.escolaId, (r) => r.regravarRetrato(FIM_DE_MARCO)), naEscola(e.escolaId, (r) => r.regravarRetrato(FIM_DE_MARCO))])
      expect([primeira, segunda]).toEqual([expect.objectContaining({ alunosAtivos: 10 }), expect.objectContaining({ alunosAtivos: 10 })])
      const { rows } = await pool.query<{ mes: string; alunos: number }>('select mes::text, alunos_ativos as alunos from orcamento_ia_do_mes where escola_id = $1', [e.escolaId])
      expect(rows).toEqual([{ mes: '2026-03-01', alunos: 10 }])
    })

    it('cada mês tem o seu retrato: o de março e o de abril, regravados em dias diferentes, são lidos cada um com os alunos do seu mês', async () => {
      const e = await escola({ escola: { valor: 5 * REAIS } })
      await alunos(e, 10)
      await naEscola(e.escolaId, (r) => r.regravarRetrato(FIM_DE_MARCO))
      await alunos(e, 10)
      await naEscola(e.escolaId, (r) => r.regravarRetrato(MEIO_DE_ABRIL))
      expect(await naEscola(e.escolaId, (r) => r.retrato(MARCO))).toMatchObject({ alunosAtivos: 10 })
      expect(await naEscola(e.escolaId, (r) => r.retrato('2026-04'))).toMatchObject({ alunosAtivos: 20 })
      expect(await naEscola(e.escolaId, (r) => r.doMes(MARCO, new Date('2026-05-10T12:00:00-03:00')))).toMatchObject({ alunosAtivos: 10 })
      expect(await naEscola(e.escolaId, (r) => r.doMes('2026-04', new Date('2026-05-10T12:00:00-03:00')))).toMatchObject({ alunosAtivos: 20 })
    })

    it('o mês fechado sem retrato é "sem_retrato", com o custo; o corrente a 80% traz o aviso de 80', async () => {
      const e = await escola({ escola: { valor: 5 * REAIS } })
      await alunos(e, 100)
      await consumo(e.escolaId, 9 * REAIS, '2026-02-10T10:00:00-03:00')
      expect(await naEscola(e.escolaId, (r) => r.doMes('2026-02', MEIO_DE_ABRIL))).toMatchObject({ situacao: 'sem_retrato', custoMicros: 9 * REAIS, porcentagem: null, aviso: null })
      await consumo(e.escolaId, 400 * REAIS, '2026-04-10T10:00:00-03:00')
      expect(await naEscola(e.escolaId, (r) => r.doMes('2026-04', MEIO_DE_ABRIL))).toMatchObject({ situacao: 'definido', porcentagem: 80, aviso: 80 })
    })
  })

  describe('isolamento: duas escolas de redes diferentes, cada leitura conferida nas duas', () => {
    // A: 100 alunos, R$ 5, teto 200%, R$ 100 gastos: orçamento R$ 500, 20%. B: 900 alunos, R$ 1, teto 100%, R$ 1.000 gastos: orçamento R$ 900, 111%.
    async function duas(modo: 'propria' | 'rede'): Promise<{ a: Escola; b: Escola }> {
      const a = await escola(modo === 'propria' ? { rede: { valor: 9 * REAIS, teto: 500 }, escola: { valor: 5 * REAIS, teto: 200 } } : { rede: { valor: 5 * REAIS, teto: 200 } })
      const b = await escola(modo === 'propria' ? { rede: { valor: 2 * REAIS, teto: 300 }, escola: { valor: 1 * REAIS, teto: 100 } } : { rede: { valor: 1 * REAIS, teto: 100 } })
      await alunos(a, 100)
      await alunos(b, 900)
      await consumo(a.escolaId, 100 * REAIS, '2026-03-15T10:00:00-03:00')
      await consumo(b.escolaId, 1000 * REAIS, '2026-03-15T10:00:00-03:00')
      return { a, b }
    }

    it('a soma do mês e os alunos ativos: A gastou R$ 100 com 100 alunos, e B R$ 1.000 com 900', async () => {
      const { a, b } = await duas('propria')
      expect(await naEscola(a.escolaId, (r) => r.custoDoMes(MARCO))).toBe(100 * REAIS)
      expect(await naEscola(b.escolaId, (r) => r.custoDoMes(MARCO))).toBe(1000 * REAIS)
      expect(await naEscola(a.escolaId, (r) => r.alunosAtivos())).toBe(100)
      expect(await naEscola(b.escolaId, (r) => r.alunosAtivos())).toBe(900)
      expect(await naEscola(a.escolaId, (r) => r.doMes(MARCO, new Date('2026-03-20T12:00:00-03:00')))).toMatchObject({ porcentagem: 20, aviso: null })
      expect(await naEscola(b.escolaId, (r) => r.doMes(MARCO, new Date('2026-03-20T12:00:00-03:00')))).toMatchObject({ porcentagem: 111, aviso: 100 })
    })

    it('variante 1, a configuração da escola: o valor e o teto próprios de cada uma, e os das redes (R$ 9 e R$ 2) não aparecem', async () => {
      const { a, b } = await duas('propria')
      expect(await naEscola(a.escolaId, (r) => r.configuracaoDaEscola())).toEqual({ valorPorAlunoMicros: 5 * REAIS, tetoPercentual: 200 })
      expect(await naEscola(b.escolaId, (r) => r.configuracaoDaEscola())).toEqual({ valorPorAlunoMicros: 1 * REAIS, tetoPercentual: 100 })
      expect(await naEscola(a.escolaId, (r) => r.doMes(MARCO, new Date('2026-03-20T12:00:00-03:00')))).toMatchObject({ porcentagem: 20, origemDoValor: 'escola', tetoPercentual: 200 })
      expect(await naEscola(b.escolaId, (r) => r.doMes(MARCO, new Date('2026-03-20T12:00:00-03:00')))).toMatchObject({ porcentagem: 111, origemDoValor: 'escola', tetoPercentual: 100 })
    })

    it('variante 2, a rede: as escolas sem valor próprio leem a rede delas (R$ 5 e 200%, R$ 1 e 100%), cada uma a sua', async () => {
      const { a, b } = await duas('rede')
      expect(await naEscola(a.escolaId, (r) => r.configuracaoDaRede())).toEqual({ valorPorAlunoMicros: 5 * REAIS, tetoPercentual: 200 })
      expect(await naEscola(b.escolaId, (r) => r.configuracaoDaRede())).toEqual({ valorPorAlunoMicros: 1 * REAIS, tetoPercentual: 100 })
      expect(await naEscola(a.escolaId, (r) => r.doMes(MARCO, new Date('2026-03-20T12:00:00-03:00')))).toMatchObject({ porcentagem: 20, origemDoValor: 'rede', tetoPercentual: 200 })
      expect(await naEscola(b.escolaId, (r) => r.doMes(MARCO, new Date('2026-03-20T12:00:00-03:00')))).toMatchObject({ porcentagem: 111, origemDoValor: 'rede', tetoPercentual: 100 })
    })

    it('o retrato: B com retrato num mês em que A não tem, e regravar o de A não mexe no de B', async () => {
      const { a, b } = await duas('propria')
      await naEscola(b.escolaId, (r) => r.regravarRetrato(new Date('2026-03-20T12:00:00-03:00')))
      expect(await naEscola(a.escolaId, (r) => r.retrato(MARCO))).toBeUndefined()
      expect(await naEscola(b.escolaId, (r) => r.retrato(MARCO))).toEqual({ alunosAtivos: 900, valorPorAlunoMicros: 1 * REAIS, tetoPercentual: 100, origemDoValor: 'escola' })
      expect(await naEscola(a.escolaId, (r) => r.doMes(MARCO, MEIO_DE_ABRIL))).toMatchObject({ situacao: 'sem_retrato', custoMicros: 100 * REAIS })
      await naEscola(a.escolaId, (r) => r.regravarRetrato(new Date('2026-03-21T12:00:00-03:00')))
      expect(await naEscola(a.escolaId, (r) => r.retrato(MARCO))).toEqual({ alunosAtivos: 100, valorPorAlunoMicros: 5 * REAIS, tetoPercentual: 200, origemDoValor: 'escola' })
      expect(await naEscola(b.escolaId, (r) => r.retrato(MARCO))).toEqual({ alunosAtivos: 900, valorPorAlunoMicros: 1 * REAIS, tetoPercentual: 100, origemDoValor: 'escola' })
    })

    it('sem escola no contexto a leitura falha fechada, e não soma o banco inteiro', async () => {
      await expect(new OrcamentoDoMesRepository(banco).custoDoMes(MARCO)).rejects.toThrow('sem escola no contexto')
      await expect(new OrcamentoDoMesRepository(banco).alunosAtivos()).rejects.toThrow('sem escola no contexto')
      await expect(new OrcamentoDoMesRepository(banco).configuracaoDaEscola()).rejects.toThrow('sem escola no contexto')
      await expect(new OrcamentoDoMesRepository(banco).configuracaoDaRede()).rejects.toThrow('sem escola no contexto')
      await expect(new OrcamentoDoMesRepository(banco).retrato('2026-03')).rejects.toThrow('sem escola no contexto')
      await expect(new OrcamentoDoMesRepository(banco).regravarRetrato(FIM_DE_MARCO)).rejects.toThrow('sem escola no contexto')
    })
  })
})
