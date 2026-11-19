import 'reflect-metadata'
import { ClassificacaoAtrasadaRepository, currentContext, OperationalSettings, OperationalSettingsRepository, QUEUE_PRIORITY, resolverJanela, runInContext, ultimaNoite, type Clock, type JanelaLetiva, type JobProcessor } from '@educa/core'
import { JobFailureCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import type { StorageConfig } from '../src/config.js'
import { ClassificacaoGauge } from '../src/classificacao-gauge.js'
import { createWorker } from '../src/composition.js'
import { createRotinaDaClassificacao } from '../src/processors/agendar-classificacao.js'
import { chaveDaNoite } from '../src/processors/expurgar-dado-pessoal.js'
import { jobExecution } from './job-execution.fixture.js'
import { configuracaoDoBanco, InMemoryLog, janelaPadraoDoAmbiente, QueueFixtures, urlRedisDeFila, vagasPadraoDoAmbiente } from './queue.fixture.js'

// A rotina das 19h e a medição do alerta da classificação do material (classificacao-bncc, tarefa 5.0; Tech Spec, seções 5 "Agendar" (a) e 7c "Alerta") contra o Postgres e o Redis de fila do compose de teste. O agendamento
// em si (as execuções, o teto de três noites, os lotes) é `apps/api/src/material/agendamento.int.test.ts`; o alerta com o Prometheus e o Grafana, `infra/test/alerta-de-classificacao-atrasada.int.test.ts`.

const ambiente = lerAmbienteDeTeste()
const STORAGE: StorageConfig = {
  url: `http://127.0.0.1:${valorObrigatorio(ambiente, 'STORAGE_PORTA_HOST')}`,
  regiao: valorObrigatorio(ambiente, 'STORAGE_REGIAO'),
  bucket: valorObrigatorio(ambiente, 'STORAGE_BUCKET'),
  chaveAcesso: valorObrigatorio(ambiente, 'STORAGE_CHAVE_ACESSO'),
  chaveSecreta: valorObrigatorio(ambiente, 'STORAGE_CHAVE_SECRETA'),
}
const TIPO_DO_JOB_DA_ESCOLA = 'material.agendar-classificacao'
const METRICA = 'classificacao.execucoes_atrasadas'
const QUARTA_19H = new Date('2026-10-07T19:00:00-03:00')
const QUINTA_8H = new Date('2026-10-08T08:00:00-03:00')

const relogioEm = (inicio: Date): Clock => ({ agora: () => inicio })

beforeAll(() => {
  // Worker do compose de pé executaria o job que o teste grava.
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('a rotina das 19h e o alerta da classificação do material', () => {
  const bancada = new QueueFixtures()
  const log = new InMemoryLog('worker-teste')

  afterAll(async () => {
    await bancada.fechar()
  })

  const janelaDaEscola = () => new OperationalSettings<JanelaLetiva>(new OperationalSettingsRepository(bancada.banco), (linha) => resolverJanela(janelaPadraoDoAmbiente(), linha))

  function rotina(relogio: Clock, ids: readonly string[]): JobProcessor {
    return createRotinaDaClassificacao({
      escolas: { listIds: () => Promise.resolve([...ids]) },
      banco: bancada.banco,
      enfileirador: bancada.enfileirador,
      janelaDaEscola: janelaDaEscola(),
      relogio,
      logger: log.logger,
    })
  }

  const rodarRotina = (processador: JobProcessor): Promise<void> => runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => processador({}, jobExecution(randomUUID())))

  async function jobsDaEscola(escolaId: string): Promise<Array<{ chave: string; fila: string; prioridade: number; naoUrgente: boolean; estado: string }>> {
    const { rows } = await bancada.pool.query<{ chave: string; fila: string; prioridade: number; naoUrgente: boolean; estado: string }>(
      'select chave_idempotencia as chave, fila, prioridade, nao_urgente as "naoUrgente", estado from job_registro where escola_id = $1 and tipo = $2 order by criado_em, id',
      [escolaId, TIPO_DO_JOB_DA_ESCOLA],
    )
    return rows
  }

  describe('rotina sistema.agendar-classificacao', () => {
    it('grava um `material.agendar-classificacao` por escola, na fila de lote, não urgente, com a data local da escola como chave; o log só tem contagens e ids', async () => {
      const a = await bancada.escola()
      const b = await bancada.escola()
      await bancada.configurarEscola(b, { fuso: 'America/Rio_Branco' })
      // 1h30 de quinta em São Paulo é 23h30 de quarta em Rio Branco.
      await rodarRotina(rotina(relogioEm(new Date('2026-10-08T01:30:00-03:00')), [a, b]))
      expect(await jobsDaEscola(a)).toEqual([{ chave: '2026-10-08', fila: 'lote', prioridade: QUEUE_PRIORITY.lote, naoUrgente: true, estado: 'aguardando' }])
      expect((await jobsDaEscola(b)).map(({ chave }) => chave)).toEqual(['2026-10-07'])
      expect(log.doEvento('classificacao.rotina_disparada').at(-1)).toEqual(expect.objectContaining({ escolasTotal: 2, enfileiradosTotal: 2, jaEnfileiradosTotal: 0, falhasTotal: 0 }))
      expect(log.linhas.join('\n')).not.toContain('sintética')
    })

    it('rodar de novo na mesma noite não cria outro job; a noite seguinte cria', async () => {
      const a = await bancada.escola()
      await rodarRotina(rotina(relogioEm(QUARTA_19H), [a]))
      await rodarRotina(rotina(relogioEm(QUARTA_19H), [a]))
      expect((await jobsDaEscola(a)).map(({ chave }) => chave)).toEqual(['2026-10-07'])
      await rodarRotina(rotina(relogioEm(new Date('2026-10-08T19:00:00-03:00')), [a]))
      expect((await jobsDaEscola(a)).map(({ chave }) => chave)).toEqual(['2026-10-07', '2026-10-08'])
      expect(chaveDaNoite('America/Sao_Paulo', QUARTA_19H)).toBe('2026-10-07')
    })

    it('[P] duas rotinas ao mesmo tempo criam um job por escola', async () => {
      const ids = [await bancada.escola(), await bancada.escola(), await bancada.escola()]
      const relogio = relogioEm(QUARTA_19H)
      await Promise.all([rodarRotina(rotina(relogio, ids)), rodarRotina(rotina(relogio, ids))])
      for (const escolaId of ids) expect(await jobsDaEscola(escolaId), escolaId).toHaveLength(1)
      const disparos = log.doEvento('classificacao.rotina_disparada').slice(-2)
      expect(disparos.reduce((soma, linha) => soma + Number(linha['enfileiradosTotal']), 0)).toBe(3)
      expect(disparos.reduce((soma, linha) => soma + Number(linha['jaEnfileiradosTotal']), 0)).toBe(3)
    })

    it('uma escola que falha não segura as outras, e o job falha no fim para a fila tentar de novo', async () => {
      const a = await bancada.escola()
      // Uma escola que não existe no banco: a FK de `job_registro` recusa o job dela.
      const inexistente = randomUUID()
      await expect(rodarRotina(rotina(relogioEm(QUARTA_19H), [inexistente, a]))).rejects.toThrow('classificação não enfileirada em alguma escola')
      expect(await jobsDaEscola(a)).toHaveLength(1)
      expect(log.doEvento('classificacao.escola_nao_enfileirada').some((linha) => linha['escolaId'] === inexistente)).toBe(true)
    })

    it('permissão: a rotina só roda como rotina do sistema', async () => {
      const a = await bancada.escola()
      await expect(runInContext({ requisicaoId: randomUUID(), escolaId: a }, () => rotina(relogioEm(QUARTA_19H), [a])({}, jobExecution('x')))).rejects.toMatchObject({
        name: 'JobFailureError',
        codigo: JobFailureCode.DADOS_INVALIDOS,
      })
      expect(await jobsDaEscola(a)).toEqual([])
    })
  })

  describe('medição classificacao.execucoes_atrasadas', () => {
    /** A noite que acabou de passar para a escola de janela padrão, às 8h de quinta: o que a medição julga. */
    const noite = ultimaNoite(janelaPadraoDoAmbiente(), QUINTA_8H)

    async function execucao(escolaId: string, estado: 'pendente' | 'rodando' | 'concluida' | 'falhou', opcoes: { criadaEm: Date; concluidaEm?: Date }): Promise<void> {
      await bancada.pool.query(
        `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, estado, erro, resultado, criada_em, concluida_em, iniciada_em)
         values ($1, null, 'classificacao_do_material', 'classificar_secoes', null, $2, '{"tarefa":"classificar_secoes"}'::jsonb, $3::text, case when $3::text = 'falhou' then 'IA_SAIDA_INVALIDA' end,
                 case when $3::text = 'concluida' then '{"tipo":"classificacao_do_material","secoes":1}'::jsonb end, $4::timestamptz, $5::timestamptz, case when $3::text <> 'pendente' then $4::timestamptz end)`,
        [escolaId, randomUUID(), estado, opcoes.criadaEm, opcoes.concluidaEm ?? null],
      )
    }

    it('a consulta da medição tem o índice parcial da classificação: começa pela escola e pelo estado, com o fim da execução, só da função dela (0064; EXPLAIN registrado no `5_task.md`)', async () => {
      const { rows } = await bancada.pool.query<{ indexdef: string }>("select indexdef from pg_indexes where tablename = 'execucao_agente' and indexname = 'execucao_agente_classificacao_idx'")

      expect(rows).toHaveLength(1)
      expect(rows[0]?.indexdef).toContain('(escola_id, estado, concluida_em)')
      expect(rows[0]?.indexdef).toContain("WHERE (funcao = 'classificacao_do_material'::text)")
    })

    const antesDe = (instante: Date, horas: number): Date => new Date(instante.getTime() - horas * 3_600_000)

    function medicaoDe(ids: readonly string[], medidor: MedidorDeTeste, agora: Date = QUINTA_8H, repositorio: Pick<ClassificacaoAtrasadaRepository, 'atrasadas'> = new ClassificacaoAtrasadaRepository(bancada.banco)): ClassificacaoGauge {
      return new ClassificacaoGauge({
        escolas: { listIds: () => Promise.resolve([...ids]) },
        repositorio,
        janelaDaEscola: janelaDaEscola(),
        relogio: { agora: () => agora },
        logger: log.logger,
        medidor: medidor.medidor,
      })
    }

    async function porEscola(medidor: MedidorDeTeste): Promise<Record<string, unknown>> {
      return Object.fromEntries((await medidor.pontos(METRICA)).map(({ atributos, valor }) => [String(atributos['escola_id']), valor]))
    }

    it('a janela padrão fecha às 18h e abre às 7h: a noite que se julga às 8h de quinta é a de quarta para quinta', () => {
      expect(noite).toBeDefined()
      expect(noite?.abriuEm.toISOString()).toBe(new Date('2026-10-08T07:00:00-03:00').toISOString())
    })

    it('conta a `falhou` na noite e a `pendente` de antes dela; a `pendente` da própria noite, a `concluida`, a `rodando`, a falha de antes da noite e a de depois da abertura ficam fora', async () => {
      if (noite === undefined) throw new Error('a janela padrão tem noite')
      const a = await bancada.escola()
      const meio = new Date((noite.fechouEm.getTime() + noite.abriuEm.getTime()) / 2)
      await execucao(a, 'falhou', { criadaEm: antesDe(meio, 1), concluidaEm: meio })
      await execucao(a, 'falhou', { criadaEm: antesDe(meio, 3), concluidaEm: antesDe(noite.fechouEm, 2) })
      await execucao(a, 'pendente', { criadaEm: antesDe(noite.fechouEm, 2) })
      await execucao(a, 'pendente', { criadaEm: meio })
      await execucao(a, 'concluida', { criadaEm: antesDe(meio, 1), concluidaEm: meio })
      await execucao(a, 'rodando', { criadaEm: antesDe(noite.fechouEm, 2) })
      // A que falhou depois de a escola abrir não é da noite: o lote não roda dentro do horário letivo, e a medição a deixa para a noite que vem.
      await execucao(a, 'falhou', { criadaEm: antesDe(meio, 1), concluidaEm: new Date(noite.abriuEm.getTime() + 30 * 60_000) })
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())

      await medicaoDe([a], medidor).medir()

      expect(await porEscola(medidor)).toEqual({ [a]: 2 })
      for (const { atributos } of await medidor.pontos(METRICA)) expect(Object.keys(atributos)).toEqual(['escola_id'])
    })

    it('só a classificação conta: a execução de outra função que falhou na noite ou ficou pendente antes dela fica fora', async () => {
      if (noite === undefined) throw new Error('a janela padrão tem noite')
      const a = await bancada.escola()
      const meio = new Date((noite.fechouEm.getTime() + noite.abriuEm.getTime()) / 2)
      const ano = await bancada.pool.query<{ id: string }>("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [a])
      await bancada.pool.query(
        `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, chave_envio, entrada, estado, erro, criada_em, concluida_em, iniciada_em)
         values ($1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $3, '{"tarefa":"turno_do_tutor"}'::jsonb, 'falhou', 'IA_SAIDA_INVALIDA', $4::timestamptz, $4::timestamptz, $4::timestamptz),
                ($1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $5, '{"tarefa":"turno_do_tutor"}'::jsonb, 'pendente', null, $6::timestamptz, null, null)`,
        [a, ano.rows[0]?.id, randomUUID(), meio, randomUUID(), antesDe(noite.fechouEm, 2)],
      )
      await execucao(a, 'falhou', { criadaEm: antesDe(meio, 1), concluidaEm: meio })
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())

      await medicaoDe([a], medidor).medir()

      expect(await porEscola(medidor)).toEqual({ [a]: 1 })
    })

    it('a escola sem execução atrasada fica sem série, e a atrasada de B não aparece na A', async () => {
      if (noite === undefined) throw new Error('a janela padrão tem noite')
      const [a, b, c] = [await bancada.escola(), await bancada.escola(), await bancada.escola()]
      await execucao(b, 'pendente', { criadaEm: antesDe(noite.fechouEm, 5) })
      await execucao(c, 'pendente', { criadaEm: new Date((noite.fechouEm.getTime() + noite.abriuEm.getTime()) / 2) })
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())

      await medicaoDe([a, b, c], medidor).medir()

      expect(await porEscola(medidor)).toEqual({ [b]: 1 })
    })

    it('a janela é a da escola: a que fecha às 22h e abre às 5h tem a noite dela, e a `falhou` das 19h não conta lá, mas conta na padrão', async () => {
      if (noite === undefined) throw new Error('a janela padrão tem noite')
      const tarde = await bancada.escola()
      const padrao = await bancada.escola()
      await bancada.configurarEscola(tarde, { inicio: '05:00', fim: '22:00' })
      // 19h de quarta: dentro da noite da padrão (fecha às 18h), mas ainda dentro do horário letivo da escola que fecha às 22h.
      const dezenoveDeQuarta = new Date('2026-10-07T19:00:00-03:00')
      await execucao(tarde, 'falhou', { criadaEm: antesDe(dezenoveDeQuarta, 1), concluidaEm: dezenoveDeQuarta })
      await execucao(padrao, 'falhou', { criadaEm: antesDe(dezenoveDeQuarta, 1), concluidaEm: dezenoveDeQuarta })
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())

      await medicaoDe([tarde, padrao], medidor).medir()

      expect(await porEscola(medidor)).toEqual({ [padrao]: 1 })
    })

    it('a escola que falha fica sem série nesta volta, e as outras são medidas', async () => {
      if (noite === undefined) throw new Error('a janela padrão tem noite')
      const [a, b] = [await bancada.escola(), await bancada.escola()]
      await execucao(a, 'pendente', { criadaEm: antesDe(noite.fechouEm, 2) })
      await execucao(b, 'pendente', { criadaEm: antesDe(noite.fechouEm, 2) })
      const real = new ClassificacaoAtrasadaRepository(bancada.banco)
      const falhaEmB: Pick<ClassificacaoAtrasadaRepository, 'atrasadas'> = {
        atrasadas: (fechouEm, abriuEm) => (currentContext()?.escolaId === b ? Promise.reject(new Error('banco lento')) : real.atrasadas(fechouEm, abriuEm)),
      }
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())
      const avisosAntes = log.doEvento('worker.medicao_da_classificacao_indisponivel').length

      await medicaoDe([a, b], medidor, QUINTA_8H, falhaEmB).medir()

      expect(await porEscola(medidor)).toEqual({ [a]: 1 })
      expect(log.doEvento('worker.medicao_da_classificacao_indisponivel').length).toBeGreaterThan(avisosAntes)
    })

    it('terminar a execução tira a série na volta seguinte', async () => {
      if (noite === undefined) throw new Error('a janela padrão tem noite')
      const a = await bancada.escola()
      await execucao(a, 'pendente', { criadaEm: antesDe(noite.fechouEm, 2) })
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())
      const medicao = medicaoDe([a], medidor)
      await medicao.medir()
      expect(await porEscola(medidor)).toEqual({ [a]: 1 })

      await bancada.pool.query("update execucao_agente set estado = 'concluida', concluida_em = now(), resultado = '{\"tipo\":\"classificacao_do_material\",\"secoes\":1}'::jsonb where escola_id = $1", [a])
      await medicao.medir()

      expect(await porEscola(medidor)).toEqual({})
    })

    it('montada no worker de lote: mede no boot as escolas do banco e para com o worker', async () => {
      if (noite === undefined) throw new Error('a janela padrão tem noite')
      const a = await bancada.escola()
      await execucao(a, 'pendente', { criadaEm: antesDe(noite.fechouEm, 2) })
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())
      const worker = createWorker(
        { banco: configuracaoDoBanco(), redisFilaUrl: urlRedisDeFila(), pools: { lote: 2 }, vagasPadrao: vagasPadraoDoAmbiente(), threadsMaximo: 1, storage: STORAGE, janelaPadrao: janelaPadraoDoAmbiente() },
        log.logger,
        { prefixo: bancada.prefixo, relogio: { agora: () => QUINTA_8H }, agendamentos: [], medidor: medidor.medidor },
      )
      let encerrado = false
      onTestFinished(async () => {
        if (!encerrado) await worker.encerrar()
      })
      await expect.poll(async () => (await porEscola(medidor))[a], { timeout: 20_000, interval: 100 }).toBe(1)
      await worker.encerrar()
      encerrado = true
    })
  })
})
