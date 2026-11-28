import 'reflect-metadata'
import { createDatabase, createPool, currentContext, EncerramentoDaProvaRepository, encerrarPeloLimite, PRAZO_DO_ALERTA_DA_PROVA_ABERTA_MS, PREFIXO_LIMITE_COMECAR_PROVA, ProvasVencidasRepository, pulsoDaApi, QuedasDaApiRepository, requireEscolaId, runInContext, type Clock } from '@educa/core'
import { JOB_DEFINITIONS, TIPO_ENCERRAR_PROVAS_VENCIDAS, TIPO_ENCERRAR_PROVAS_VENCIDAS_DAS_ESCOLAS } from '@educa/shared'
import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { aplicarAtividade, alunosComSessao, criarAtividade, rotasDaAtividade, type RotasDaAtividade } from '../../api/test/atividade.fixture.js'
import { REDIS_CACHE_CLIENT } from '../../api/src/rate-limit.module.js'
import { montarEscolaComAssistente, type EscolaComAssistente } from '../../api/test/escola-assistente.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../api/test/sessao.fixture.js'
import { subirApi, type TestApi } from '../../api/test/test-api.js'
import { esperarNaTrava, WriteBlockTrigger } from '../../api/test/write-block-trigger.js'
import { ProvaAbertaGauge } from '../src/prova-aberta-gauge.js'
import { chaveDoMinuto, createEncerramentoDasProvasVencidas, createRotinaDasProvasVencidas } from '../src/processors/encerrar-provas-vencidas.js'
import { jobExecution } from './job-execution.fixture.js'
import { configuracaoDoBanco, InMemoryLog, QueueFixtures } from './queue.fixture.js'

/**
 * A rotina que encerra a prova vencida (avaliacao-e-correcao, 6.0; Tech Spec §5.5 a §5.7 e §7c) contra o Postgres do compose de teste: a rotina por minuto que grava um job por escola, o job de uma escola
 * (`encerrarPeloLimite`: o `for update`, o pulso conferido de novo, o fim efetivo, a vencida gravada no limite dela, a auditoria sem aluno e o lote pendente) e a medição do alerta da prova aberta.
 *
 * O relógio é o do banco, e o teste não dorme: a janela, o começo e o limite de cada aluno são postos por SQL em instantes que ele calcula. O pulso da API (`pulso_da_api`, global) é renovado antes de cada
 * caso e devolvido ao que era no fim; as indisponibilidades e as extensões que o arquivo grava são apagadas.
 */
interface NoDoPlano {
  'Node Type'?: string
  'Index Name'?: string
  'Rows Removed by Filter'?: number
  Plans?: NoDoPlano[]
}

const nosDoPlano = (no: NoDoPlano | undefined): NoDoPlano[] => (no === undefined ? [] : [no, ...(no.Plans ?? []).flatMap(nosDoPlano)])
const indicesDoPlano = (no: NoDoPlano | undefined): Array<string | undefined> => nosDoPlano(no).map((n) => n['Index Name'])
const removidasNoFiltro = (no: NoDoPlano | undefined): number => nosDoPlano(no).reduce((soma, n) => soma + (n['Rows Removed by Filter'] ?? 0), 0)

describe('a rotina que encerra a prova vencida', () => {
  const sessoes = new SessaoFixtures()
  const filas = new QueueFixtures()
  const log = new InMemoryLog('worker-teste')
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let rotas: RotasDaAtividade
  let a: EscolaComAssistente
  let b: EscolaComAssistente
  let ana: TestSessao
  let bia: TestSessao
  let caio: TestSessao
  let anaDeB: TestSessao
  let pulsoAntes: Date | undefined
  const indisponibilidades: string[] = []

  const MIN = 60_000
  const em = (minutos: number): Date => new Date(Date.now() + minutos * MIN)
  const sql = async <Registro extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Registro[]> => (await sessoes.pool.query(texto, valores)).rows as Registro[]
  const contar = async (tabela: string, filtro: string, valores: unknown[]): Promise<number> => Number((await sql<{ total: string }>(`select count(*) as total from ${tabela} where ${filtro}`, valores))[0]?.total)
  const instante = (data: Date | null | undefined): string | undefined => data?.toISOString()
  const pulsar = () => sql('update pulso_da_api set ultimo_em = now()')
  const pulsoComIdade = (segundos: number) => sql('update pulso_da_api set ultimo_em = now() - make_interval(secs => $1::double precision)', [segundos])
  const relogioDoMinuto: Clock = { agora: () => new Date('2026-11-26T10:15:30-03:00') }

  const rotina = () => createRotinaDasProvasVencidas({ provas: new ProvasVencidasRepository(filas.banco), banco: filas.banco, enfileirador: filas.enfileirador, relogio: relogioDoMinuto, logger: log.logger })
  const rodarRotina = () => runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => rotina()({}, jobExecution(randomUUID())))
  const rodarJob = (escolaId: string, sinal?: AbortSignal, requisicaoId = randomUUID()) =>
    runInContext({ requisicaoId, escolaId }, () => createEncerramentoDasProvasVencidas({ banco: filas.banco, logger: log.logger })({}, jobExecution(randomUUID()), sinal))

  /** A medição da escola do gauge de verdade, no contexto dela: o número que o alerta lê. */
  class Medida extends ProvaAbertaGauge {
    medirDaEscola(escolaId: string): Promise<number | undefined> {
      return runInContext({ requisicaoId: randomUUID(), escolaId }, () => this.medirEscola())
    }
  }
  const medida = () => new Medida({ escolas: { listIds: () => Promise.resolve([a.escolaId]) }, banco: filas.banco, relogio: relogioDoMinuto, logger: log.logger, medidor: medidor.medidor })

  const estadoDe = async (id: string) => (await sql<{ estado: string }>('select estado from atividade_aplicada where id = $1', [id]))[0]?.estado
  const lotes = (id: string) => contar('entrega', "atividade_aplicada_id = $1 and funcao = 'correcao_de_objetiva'", [id])
  const auditorias = (id: string) => contar('auditoria', "acao = 'atividade.encerrada_pelo_limite' and entidade_id = $1", [id])
  const tentativaDe = async (id: string, aluno: TestSessao) =>
    (await sql<{ limite_base_em: Date | null; enviada_em: Date | null; envio: string | null }>('select limite_base_em, enviada_em, envio from tentativa_atividade where atividade_aplicada_id = $1 and aluno_id = $2', [id, aluno.usuarioId]))[0]
  const jobsGravados = (escolaId: string) =>
    sql<{ fila: string; nao_urgente: boolean; chave: string }>('select fila, nao_urgente, chave_idempotencia as chave from job_registro where escola_id = $1 and tipo = $2', [escolaId, TIPO_ENCERRAR_PROVAS_VENCIDAS])
  const desfechoDoJob = () => log.doEvento('prova.encerradas_pelo_limite').at(-1)

  /**
   * Uma prova avaliativa da escola, **já vencida**: cada aluno começa e responde pela rota (dentro da janela, com o pulso de agora) e depois a janela fecha há `fechouHaMin` e o limite dele é posto em
   * `limiteMin` (negativo, já passou) por SQL. Nenhum aluno envia. `marcadas` são as alternativas das questões na ordem (`null` deixa em branco).
   */
  async function provaVencida(escola: EscolaComAssistente, alunos: Array<{ aluno: TestSessao; marcadas: Array<number | null>; limiteMin: number }>, fechouHaMin = 10): Promise<string> {
    await pulsar()
    const professora = escola.professora
    const id = await aplicarAtividade(rotas, professora, await criarAtividade(sessoes, escola), escola.turma, true, { janela: { abreEm: em(-60).toISOString(), fechaEm: em(60).toISOString() }, duracaoMin: 40 })
    for (const { aluno, marcadas } of alunos) {
      expect((await rotas.comecar(aluno, id)).status).toBe(200)
      for (const [indice, alternativa] of marcadas.entries()) if (alternativa !== null) expect((await rotas.responder(aluno, id, indice + 1, alternativa)).status).toBe(200)
    }
    await sql('update atividade_aplicada set abre_em = $2, fecha_em = $3 where id = $1', [id, em(-fechouHaMin - 60), em(-fechouHaMin)])
    for (const { aluno, limiteMin } of alunos) {
      await sql('update tentativa_atividade set iniciada_em = $3, limite_base_em = $4 where atividade_aplicada_id = $1 and aluno_id = $2', [id, aluno.usuarioId, em(limiteMin - 30), em(limiteMin)])
    }
    return id
  }

  /** Uma extensão de tempo posta por SQL: do aluno, ou da turma inteira com `alunoId` nulo. */
  const estender = (escola: EscolaComAssistente, id: string, alunoId: string | null, minutos: number) =>
    sql('insert into extensao_de_tempo (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, minutos, concedida_por, chave) values ($1, $2, $3, $4, $5, $6, $7) returning id', [
      escola.escolaId,
      escola.anoLetivoId,
      id,
      alunoId,
      minutos,
      escola.professora.usuarioId,
      randomUUID(),
    ])

  beforeAll(async () => {
    // O worker do compose, de pé, executaria o job que o teste grava.
    compose('stop', ...PROCESSOS_DA_FILA)
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_USUARIO_MIN: '2000', LIMITE_REQ_ESCOLA_MIN: '2000' } })
    rotas = rotasDaAtividade(api)
    a = await montarEscolaComAssistente(api, sessoes)
    b = await montarEscolaComAssistente(api, sessoes)
    ;[ana, bia, caio] = (await alunosComSessao(sessoes, a, a.turma, ['Aluna Sintética Ana', 'Aluna Sintética Bia', 'Aluno Sintético Caio'])) as [TestSessao, TestSessao, TestSessao]
    ;[anaDeB] = (await alunosComSessao(sessoes, b, b.turma, ['Aluna Sintética Ana de B'])) as [TestSessao]
    pulsoAntes = (await sql<{ ultimo_em: Date }>('select ultimo_em from pulso_da_api'))[0]?.ultimo_em
  })

  /** A queda que a API grava ao ver o pulso parado (os casos do pulso velho a provocam) anda o limite de quem está em prova: nenhum caso herda a do anterior, nem a de outro arquivo da mesma rodada. */
  const limparAsQuedas = () => sql("delete from indisponibilidade where fim > now() - interval '3 hours'")
  /**
   * O balde do `comecar` (`rl:comecar-prova`) é fixo, 30 por minuto por usuário, e não se sobe por configuração como o limite geral. Os casos deste arquivo
   * reusam a Ana, a Bia e o Caio e começam mais provas por minuto do que um aluno começaria: sem zerar, o 31º `comecar` do arquivo recebe 429 e o caso que cai é o que calhou de estar lá.
   */
  const zerarOComecar = async () => {
    const redis = api.app.get<Redis>(REDIS_CACHE_CLIENT)
    const chaves = await redis.keys(`${PREFIXO_LIMITE_COMECAR_PROVA}:*`)
    if (chaves.length > 0) await redis.del(...chaves)
  }
  beforeEach(async () => {
    await limparAsQuedas()
    await zerarOComecar()
  })

  afterAll(async () => {
    await limparAsQuedas()
    if (indisponibilidades.length > 0) await sql('delete from indisponibilidade where id = any($1::uuid[])', [indisponibilidades])
    if (pulsoAntes !== undefined) await sql('update pulso_da_api set ultimo_em = $1', [pulsoAntes])
    await api.app.close()
    await filas.fechar()
    await sessoes.fechar()
  })

  describe('o job de uma escola', () => {
    it('encerra a prova vencida da escola do job e deixa a de outra: nada de lote nem de auditoria na de B, e o id da prova não entra pelo payload', async () => {
      const daA = await provaVencida(a, [{ aluno: ana, marcadas: [0, 1, null, null, null], limiteMin: -5 }])
      const daB = await provaVencida(b, [{ aluno: anaDeB, marcadas: [0, 1, null, null, null], limiteMin: -5 }])
      await pulsar()
      await rodarJob(a.escolaId)
      expect(desfechoDoJob()?.['encerradasTotal']).toBeGreaterThanOrEqual(1)
      expect(await estadoDe(daA)).toBe('encerrada')
      expect(await lotes(daA)).toBe(1)
      expect(await auditorias(daA)).toBe(1)
      expect(await estadoDe(daB)).toBe('aberta')
      expect(await lotes(daB)).toBe(0)
      expect(await auditorias(daB)).toBe(0)
      expect((await tentativaDe(daB, anaDeB))?.enviada_em).toBeNull()
      // O payload do job é `{}` estrito: a chave extra, com o id da prova de B, é recusada ao gravar o job.
      await expect(
        runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () =>
          filas.banco.transaction((tx) => filas.enfileirador.enfileirarUmaVez(tx, TIPO_ENCERRAR_PROVAS_VENCIDAS, { atividadeAplicadaId: daB } as never, randomUUID())),
        ),
      ).rejects.toThrow()
      await rodarJob(b.escolaId)
      expect(await estadoDe(daB)).toBe('encerrada')
    })

    it('a vencida sem envio entra na correção com o que salvou, e o `enviada_em` é o limite dela, não o `now()` do encerramento', async () => {
      const id = await provaVencida(a, [
        { aluno: ana, marcadas: [0, 1, null, null, null], limiteMin: -7 },
        { aluno: bia, marcadas: [0, 3, null, null, null], limiteMin: -3 },
      ])
      await pulsar()
      const antes = (await sql<{ agora: Date }>('select now() as agora'))[0]?.agora.getTime() ?? 0
      await rodarJob(a.escolaId)
      for (const aluno of [ana, bia]) {
        const tentativa = await tentativaDe(id, aluno)
        expect(tentativa?.envio, aluno.usuarioId).toBe('limite')
        expect(instante(tentativa?.enviada_em)).toBe(instante(tentativa?.limite_base_em))
        expect(tentativa?.enviada_em?.getTime()).toBeLessThan(antes)
      }
      const correcoes = await sql<{ aluno_id: string; acertos: number; total: number; em_branco: number }>('select aluno_id, acertos, total, em_branco from correcao where atividade_aplicada_id = $1', [id])
      expect(correcoes).toHaveLength(2)
      expect(correcoes.find((c) => c.aluno_id === ana.usuarioId)).toEqual(expect.objectContaining({ acertos: 2, total: 5, em_branco: 3 }))
      expect(correcoes.find((c) => c.aluno_id === bia.usuarioId)).toEqual(expect.objectContaining({ acertos: 1, total: 5, em_branco: 3 }))
      // O lote nasce pendente, e é essa linha que a fila do professor (o sino) lê: nenhuma escrita a mais.
      expect((await sql<{ estado: string }>('select estado from entrega where atividade_aplicada_id = $1', [id]))[0]?.estado).toBe('pendente')
    })

    it('uma auditoria por aplicação, sem aluno: o `depois` tem a turma e quantas vencidas, e o autor é a rotina', async () => {
      const id = await provaVencida(a, [
        { aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 },
        { aluno: bia, marcadas: [0, null, null, null, null], limiteMin: -5 },
        { aluno: caio, marcadas: [0, null, null, null, null], limiteMin: -5 },
      ])
      await pulsar()
      const requisicaoId = randomUUID()
      await rodarJob(a.escolaId, undefined, requisicaoId)
      const linhas = await sql<{ depois: Record<string, unknown>; autor_operador: string | null; autor_usuario_id: string | null; antes: unknown; requisicao_id: string }>(
        "select depois, autor_operador, autor_usuario_id, antes, requisicao_id from auditoria where acao = 'atividade.encerrada_pelo_limite' and entidade_id = $1",
        [id],
      )
      expect(linhas).toHaveLength(1)
      // O id da requisição do job segue para a auditoria: o rastro de quem encerrou é o do job, e não um sorteado no meio.
      expect(linhas[0]).toEqual({ depois: { turmaId: a.turma, vencidas: 3 }, autor_operador: 'rotina', autor_usuario_id: null, antes: null, requisicao_id: requisicaoId })
      const texto = JSON.stringify(linhas)
      for (const aluno of [ana, bia, caio]) expect(texto).not.toContain(aluno.usuarioId)
    })

    it('não encerra enquanto o aluno estendido tem tempo: o `fecha_em` passou e o limite dele não', async () => {
      const comTempo = await provaVencida(a, [
        { aluno: ana, marcadas: [0, null, null, null, null], limiteMin: 30 },
        { aluno: bia, marcadas: [0, null, null, null, null], limiteMin: -5 },
      ])
      await rodarJob(a.escolaId)
      expect(await estadoDe(comTempo)).toBe('aberta')
      expect(desfechoDoJob()?.['naoVencidasTotal']).toBeGreaterThanOrEqual(1)
      expect((await tentativaDe(comTempo, bia))?.enviada_em).toBeNull()
      await sql('update tentativa_atividade set iniciada_em = $3, limite_base_em = $4 where atividade_aplicada_id = $1 and aluno_id = $2', [comTempo, ana.usuarioId, em(-31), em(-1)])
      await rodarJob(a.escolaId)
      expect(await estadoDe(comTempo)).toBe('encerrada')
    })

    it('a extensão da turma (aluno nulo) anda o fim efetivo e o limite de cada um: a prova segue aberta; sem ela, encerra', async () => {
      const daTurma = await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      const [extensao] = await estender(a, daTurma, null, 30)
      await rodarJob(a.escolaId)
      expect(await estadoDe(daTurma)).toBe('aberta')
      await sql('delete from extensao_de_tempo where id = $1', [extensao?.['id']])
      await rodarJob(a.escolaId)
      expect(await estadoDe(daTurma)).toBe('encerrada')
    })

    it('a queda da API que cobre parte do tempo do aluno devolve esse tempo: o limite anda e a prova segue aberta; sem a queda, encerra', async () => {
      const comQueda = await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      const [queda] = await sql<{ id: string }>('insert into indisponibilidade (inicio, fim) values ($1, $2) returning id', [em(-30), em(-18)])
      indisponibilidades.push(queda?.id ?? '')
      await pulsar()
      await rodarJob(a.escolaId)
      expect(await estadoDe(comQueda)).toBe('aberta')
      await sql('delete from indisponibilidade where id = $1', [queda?.id])
      await rodarJob(a.escolaId)
      expect(await estadoDe(comQueda)).toBe('encerrada')
    })

    it('com o pulso velho o job para sem encerrar; com o pulso de volta, encerra', async () => {
      const id = await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      await pulsoComIdade(60)
      await rodarJob(a.escolaId)
      expect(await estadoDe(id)).toBe('aberta')
      expect(desfechoDoJob()).toEqual(expect.objectContaining({ escolaId: a.escolaId, estado: 'pulso_velho', encerradasTotal: 0 }))
      await pulsar()
      await rodarJob(a.escolaId)
      expect(await estadoDe(id)).toBe('encerrada')
    })

    it('a prova que falha ao encerrar não segura as outras: o job encerra as demais, conta a falha pelo id da prova e falha no fim, para a fila tentar de novo', async () => {
      const quePrende = await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -25 }], 40)
      const quePassa = await provaVencida(a, [{ aluno: bia, marcadas: [1, null, null, null, null], limiteMin: -5 }], 10)
      await pulsar()
      // Um gatilho só neste banco de teste: a gravação da aplicação `quePrende` lança. A mais antiga vem primeiro no laço, então a que passa vem depois da que falha.
      await sql("create function falha_do_encerramento_6() returns trigger language plpgsql as $$ begin raise exception 'falha de teste'; end $$")
      await sql(`create trigger falha_do_encerramento_6 before update on atividade_aplicada for each row when (old.id = '${quePrende}') execute function falha_do_encerramento_6()`)
      try {
        await expect(rodarJob(a.escolaId)).rejects.toThrow()
      } finally {
        await sql('drop trigger falha_do_encerramento_6 on atividade_aplicada')
        await sql('drop function falha_do_encerramento_6()')
      }
      expect(await estadoDe(quePrende)).toBe('aberta')
      expect(await estadoDe(quePassa)).toBe('encerrada')
      expect(log.doEvento('prova.nao_encerrada').at(-1)).toEqual(expect.objectContaining({ escolaId: a.escolaId, atividadeAplicadaId: quePrende }))
      expect(desfechoDoJob()).toEqual(expect.objectContaining({ escolaId: a.escolaId, estado: 'fim', falhasTotal: 1 }))
      await rodarJob(a.escolaId)
      expect(await estadoDe(quePrende)).toBe('encerrada')
    })

    it('com o sinal de parada já dado o job não encerra nenhuma prova e diz que parou pelo sinal', async () => {
      const id = await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      await pulsar()
      const parada = new AbortController()
      parada.abort()
      await rodarJob(a.escolaId, parada.signal)
      expect(await estadoDe(id)).toBe('aberta')
      expect(desfechoDoJob()).toEqual(expect.objectContaining({ escolaId: a.escolaId, estado: 'sinal', encerradasTotal: 0 }))
      await rodarJob(a.escolaId)
      expect(await estadoDe(id)).toBe('encerrada')
    })

    it('a prova que sumiu entre a listagem e a trava não é falha: o job a pula e segue, sem encerrar nem contar falha', async () => {
      const sumida = await provaVencida(a, [])
      await pulsar()
      // O banco do job apaga a prova na hora de abrir a transação: a listagem já a viu, e a trava já não a acha.
      const bancoQueApaga = new Proxy(filas.banco, {
        get: (alvo, propriedade) => {
          if (propriedade !== 'transaction') return Reflect.get(alvo, propriedade) as unknown
          return async (...argumentos: unknown[]) => {
            await sql('delete from atividade_aplicada where id = $1', [sumida])
            return Reflect.apply(alvo.transaction, alvo, argumentos) as unknown
          }
        },
      })
      await runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () => createEncerramentoDasProvasVencidas({ banco: bancoQueApaga, logger: log.logger })({}, jobExecution(randomUUID())))
      expect(desfechoDoJob()).toEqual(expect.objectContaining({ escolaId: a.escolaId, estado: 'fim', falhasTotal: 0 }))
      expect(await estadoDe(sumida)).toBeUndefined()
    })

    it('a tentativa sem limite (a anterior à prova online) não segura a prova nem é gravada: a prova encerra e ela fica sem envio', async () => {
      const id = await provaVencida(a, [
        { aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 },
        { aluno: bia, marcadas: [0, null, null, null, null], limiteMin: -5 },
      ])
      await sql('update tentativa_atividade set limite_base_em = null where atividade_aplicada_id = $1 and aluno_id = $2', [id, bia.usuarioId])
      await pulsar()
      await rodarJob(a.escolaId)
      expect(await estadoDe(id)).toBe('encerrada')
      expect((await tentativaDe(id, ana))?.envio).toBe('limite')
      expect(await tentativaDe(id, bia)).toEqual({ limite_base_em: null, enviada_em: null, envio: null })
    })

    it('a vencida que ninguém abriu encerra sem lote: faltar não é ficar em branco', async () => {
      const id = await provaVencida(a, [])
      await pulsar()
      await rodarJob(a.escolaId)
      expect(await estadoDe(id)).toBe('encerrada')
      expect(await lotes(id)).toBe(0)
      expect(await auditorias(id)).toBe(1)
    })

    it('o que não é da rotina volta como não aplicável, sem ler nada: a já encerrada, a que não é avaliativa e a sem janela', async () => {
      await pulsar()
      const base: Parameters<typeof encerrarPeloLimite>[1] = { id: randomUUID(), turmaId: a.turma, estado: 'aberta', disciplinaId: a.quimica, conteudo: {}, avaliativa: true, fechaEm: em(60) }
      const desfecho = (mudanca: Partial<typeof base>) =>
        runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId, anoLetivoId: a.anoLetivoId }, () =>
          filas.banco.transaction((tx) => encerrarPeloLimite(tx, { ...base, ...mudanca }, () => Promise.resolve(false))),
        )
      expect(await desfecho({ estado: 'encerrada' })).toBe('nao_aplicavel')
      expect(await desfecho({ avaliativa: false })).toBe('nao_aplicavel')
      expect(await desfecho({ fechaEm: null })).toBe('nao_aplicavel')
      // O controle: uma aplicação aberta, avaliativa e com janela passa da porta e é julgada (a janela fecha daqui a 1 h, então ainda não venceu).
      expect(await desfecho({})).toBe('nao_vencida')
    })

    it('a função de correção suspensa na escola: encerra sem lote nem correção e não volta a listar; a outra escola corrige', async () => {
      const daA = await provaVencida(a, [{ aluno: ana, marcadas: [0, 1, null, null, null], limiteMin: -5 }])
      const daB = await provaVencida(b, [{ aluno: anaDeB, marcadas: [0, 1, null, null, null], limiteMin: -5 }])
      const [suspensao] = await sql<{ id: string }>("insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, 'correcao_de_objetiva', $2) returning id", [a.escolaId, a.coordenacao.usuarioId])
      try {
        await pulsar()
        await rodarJob(a.escolaId)
        await rodarJob(b.escolaId)
        expect(await estadoDe(daA)).toBe('encerrada')
        expect(await lotes(daA)).toBe(0)
        expect(await contar('correcao', 'atividade_aplicada_id = $1', [daA])).toBe(0)
        expect((await tentativaDe(daA, ana))?.envio).toBe('limite')
        expect(await lotes(daB)).toBe(1)
        await rodarJob(a.escolaId)
        expect(desfechoDoJob()).toEqual(expect.objectContaining({ escolaId: a.escolaId, vencidasTotal: 0 }))
      } finally {
        await sql('update suspensao_de_funcao set retomada_em = now(), retomada_por = $2 where id = $1', [suspensao?.id, a.coordenacao.usuarioId])
      }
    })

    it('cada aplicação é encerrada numa transação com `statement_timeout` de 20 s, que o gatilho de teste lê na hora de gravar o lote', async () => {
      const id = await provaVencida(a, [{ aluno: ana, marcadas: [0, 1, null, null, null], limiteMin: -5 }])
      await pulsar()
      await sql('create table if not exists teste_prazo_do_job (atividade_aplicada_id uuid, prazo text)')
      await sql(`create or replace function teste_prazo_do_job_fn() returns trigger language plpgsql as $$
        begin insert into teste_prazo_do_job values (new.atividade_aplicada_id, current_setting('statement_timeout')); return new; end $$`)
      await sql('create trigger teste_prazo_do_job_tg before insert on entrega for each row execute function teste_prazo_do_job_fn()')
      try {
        await rodarJob(a.escolaId)
        expect((await sql<{ prazo: string }>('select prazo from teste_prazo_do_job where atividade_aplicada_id = $1', [id])).map(({ prazo }) => prazo)).toEqual(['20s'])
      } finally {
        await sql('drop trigger if exists teste_prazo_do_job_tg on entrega')
        await sql('drop function if exists teste_prazo_do_job_fn()')
        await sql('drop table if exists teste_prazo_do_job')
      }
    })

    it('a professora encerrando lê as quedas a partir do começo da primeira tentativa, e não da época; sem tentativa, a partir de agora', async () => {
      const id = await provaVencida(a, [
        { aluno: ana, marcadas: [0, 1, null, null, null], limiteMin: -5 },
        { aluno: bia, marcadas: [0, null, null, null, null], limiteMin: 20 },
      ])
      // A da Bia começa um minuto antes: a primeira não é a da ordem em que as tentativas voltam, e o mais antigo vem de uma comparação, não do acaso.
      await sql("update tentativa_atividade set iniciada_em = iniciada_em - interval '1 minute' where atividade_aplicada_id = $1 and aluno_id = $2", [id, bia.usuarioId])
      const iniciadas = await sql<{ iniciada_em: Date }>('select iniciada_em from tentativa_atividade where atividade_aplicada_id = $1', [id])
      const primeira = Math.min(...iniciadas.map(({ iniciada_em }) => iniciada_em.getTime()))
      const leitura = vi.spyOn(QuedasDaApiRepository.prototype, 'leituraDesde')
      try {
        expect((await rotas.encerrar(a.professora, id)).status).toBe(200)
        expect(leitura.mock.calls.map(([desde]) => desde.getTime())).toEqual([primeira])
        leitura.mockClear()
        const vazia = await provaVencida(a, [])
        const antes = Date.now()
        expect((await rotas.encerrar(a.professora, vazia)).status).toBe(200)
        expect(leitura.mock.calls).toHaveLength(1)
        expect(leitura.mock.calls[0]?.[0].getTime() ?? 0).toBeGreaterThanOrEqual(antes)
      } finally {
        leitura.mockRestore()
      }
    })

    it('a professora encerrando: a vencida leva o limite dela; a que ainda tinha tempo fica sem envio e vai com o que salvou', async () => {
      const id = await provaVencida(a, [
        { aluno: ana, marcadas: [0, 1, null, null, null], limiteMin: -5 },
        { aluno: bia, marcadas: [0, null, null, null, null], limiteMin: 20 },
      ])
      await pulsar()
      expect((await rotas.encerrar(a.professora, id)).status).toBe(200)
      const daAna = await tentativaDe(id, ana)
      expect(daAna?.envio).toBe('limite')
      expect(instante(daAna?.enviada_em)).toBe(instante(daAna?.limite_base_em))
      const daBia = await tentativaDe(id, bia)
      expect(daBia?.enviada_em).toBeNull()
      expect(daBia?.envio).toBeNull()
      expect(await contar('correcao', 'atividade_aplicada_id = $1', [id])).toBe(2)
      // A professora não é a rotina: não grava a auditoria do limite.
      expect(await auditorias(id)).toBe(0)
    })
  })

  describe('a rotina por minuto', () => {
    it('grava um job por escola com prova vencida, urgente, na fila de lote, com o minuto por chave; rodar de novo no mesmo minuto, ou duas rotinas juntas, não cria outro', async () => {
      const daA = await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      await pulsar()
      await rodarRotina()
      expect(log.doEvento('prova.rotina_disparada').at(-1)?.['enfileiradosTotal']).toBeGreaterThanOrEqual(1)
      await rodarRotina()
      // A segunda rodada do mesmo minuto não grava nada: toda escola da lista já tem o job daquele minuto.
      const segunda = log.doEvento('prova.rotina_disparada').at(-1)
      expect(segunda).toEqual(expect.objectContaining({ enfileiradosTotal: 0, jaEnfileiradosTotal: segunda?.['escolasTotal'] }))
      // Duas rotinas disputando a primeira gravação do minuto: sem o job daquele minuto já gravado, a chave é o que deixa um só.
      await sql('delete from job_registro where escola_id = $1 and tipo = $2', [a.escolaId, TIPO_ENCERRAR_PROVAS_VENCIDAS])
      await Promise.all([rodarRotina(), rodarRotina()])
      const gravados = await jobsGravados(a.escolaId)
      expect(gravados).toEqual([{ fila: 'lote', nao_urgente: false, chave: chaveDoMinuto(relogioDoMinuto.agora()) }])
      expect(JOB_DEFINITIONS[TIPO_ENCERRAR_PROVAS_VENCIDAS].naoUrgente).toBe(false)
      expect(JOB_DEFINITIONS[TIPO_ENCERRAR_PROVAS_VENCIDAS_DAS_ESCOLAS].naoUrgente).toBe(false)
      expect(log.doEvento('prova.rotina_disparada').at(-1)).toEqual(expect.objectContaining({ falhasTotal: 0 }))
      expect(await estadoDe(daA)).toBe('aberta')
      await sql('delete from job_registro where escola_id = $1 and tipo = $2', [a.escolaId, TIPO_ENCERRAR_PROVAS_VENCIDAS])
      await rodarJob(a.escolaId)
    })

    it('exige o contexto da rotina do sistema', async () => {
      await expect(runInContext({ requisicaoId: randomUUID() }, () => rotina()({}, jobExecution(randomUUID())))).rejects.toThrow()
      expect(currentContext()).toBeUndefined()
    })

    it('a escola cujo job não foi gravado não segura as outras: a rotina grava o da seguinte, conta a falha pelo id da escola e falha no fim, para a fila tentar de novo', async () => {
      await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      await provaVencida(b, [{ aluno: anaDeB, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      await pulsar()
      await sql('delete from job_registro where escola_id = any($1::uuid[]) and tipo = $2', [[a.escolaId, b.escolaId], TIPO_ENCERRAR_PROVAS_VENCIDAS])
      // A rotina lista por id: a que falha é a primeira da lista, e a outra tem de ser gravada depois dela.
      const [quemFalha, quemSegue] = [a.escolaId, b.escolaId].sort() as [string, string]
      const enfileirador = {
        enfileirarUmaVez: ((...argumentos: unknown[]) =>
          requireEscolaId() === quemFalha ? Promise.reject(new Error('falha de teste')) : Reflect.apply(filas.enfileirador.enfileirarUmaVez, filas.enfileirador, argumentos)) as typeof filas.enfileirador.enfileirarUmaVez,
      }
      const comFalha = createRotinaDasProvasVencidas({ provas: new ProvasVencidasRepository(filas.banco), banco: filas.banco, enfileirador, relogio: relogioDoMinuto, logger: log.logger })
      await expect(runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => comFalha({}, jobExecution(randomUUID())))).rejects.toThrow()
      expect(await jobsGravados(quemFalha)).toHaveLength(0)
      expect(await jobsGravados(quemSegue)).toHaveLength(1)
      expect(log.doEvento('prova.escola_nao_enfileirada').map((linha) => linha['escolaId'])).toContain(quemFalha)
      const disparo = log.doEvento('prova.rotina_disparada').at(-1)
      expect(disparo?.['falhasTotal']).toBe(1)
      expect(disparo?.['enfileiradosTotal']).toBeGreaterThanOrEqual(1)
      // As duas provas seguem abertas: o job de cada escola as fecha, para não sobrar vencida aberta para os outros casos.
      await rodarJob(a.escolaId)
      await rodarJob(b.escolaId)
    })

    it('com o pulso parado há 1 min a rotina não lista a escola; com o pulso de 20 s, lista', async () => {
      await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      const provas = new ProvasVencidasRepository(filas.banco)
      await pulsoComIdade(60)
      expect(await provas.escolasComProvaVencida()).not.toContain(a.escolaId)
      await pulsoComIdade(20)
      expect(await provas.escolasComProvaVencida()).toContain(a.escolaId)
      await pulsar()
      await rodarJob(a.escolaId)
    })

    it('o job gravado antes da queda, rodado com o pulso velho, não encerra', async () => {
      const id = await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      await rodarRotina()
      expect((await jobsGravados(a.escolaId)).length).toBeGreaterThan(0)
      await pulsoComIdade(60)
      await rodarJob(a.escolaId)
      expect(await estadoDe(id)).toBe('aberta')
      await sql('delete from job_registro where escola_id = $1 and tipo = $2', [a.escolaId, TIPO_ENCERRAR_PROVAS_VENCIDAS])
      await pulsar()
      await rodarJob(a.escolaId)
    })

    it('o ano encerrado não lista e não é encerrado; o ano em curso da mesma escola lista', async () => {
      const id = await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      const provas = new ProvasVencidasRepository(filas.banco)
      expect(await provas.escolasComProvaVencida()).toContain(a.escolaId)
      await sql("update ano_letivo set situacao = 'encerrado' where id = $1", [a.anoLetivoId])
      try {
        expect(await provas.escolasComProvaVencida()).not.toContain(a.escolaId)
        // O alerta também não conta a prova de um ano encerrado: a escola sem ano em curso não tem série.
        expect(await medida().medirDaEscola(a.escolaId)).toBeUndefined()
        await rodarJob(a.escolaId)
        expect(log.doEvento('prova.encerramento_sem_ano_em_curso').at(-1)).toEqual(expect.objectContaining({ escolaId: a.escolaId }))
        expect(await estadoDe(id)).toBe('aberta')
      } finally {
        await sql("update ano_letivo set situacao = 'em_curso' where id = $1", [a.anoLetivoId])
      }
      expect(await provas.escolasComProvaVencida()).toContain(a.escolaId)
      expect(await medida().medirDaEscola(a.escolaId)).toBeGreaterThanOrEqual(1)
      await rodarJob(a.escolaId)
    })
  })

  describe('as corridas', () => {
    it('(c) a resposta que entrou antes do job entra na correção: o job espera o `for update` e conta o que foi gravado', async () => {
      const id = await provaVencida(a, [{ aluno: ana, marcadas: [0, 1, null, null, null], limiteMin: -5 }])
      await pulsar()
      const cliente = await sessoes.pool.connect()
      let job: Promise<void> | undefined
      try {
        await cliente.query('begin')
        await cliente.query('select id from atividade_aplicada where id = $1 for share', [id])
        await cliente.query('update resposta_atividade set alternativa = 2 where atividade_aplicada_id = $1 and aluno_id = $2 and questao = 3', [id, ana.usuarioId])
        await cliente.query('insert into resposta_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao, alternativa) values ($1, $2, $3, $4, 3, 2) on conflict do nothing', [a.escolaId, a.anoLetivoId, id, ana.usuarioId])
        job = rodarJob(a.escolaId)
        await esperarNaTrava(sessoes.pool, '%atividade_aplicada%for update%')
        await cliente.query('commit')
      } finally {
        cliente.release()
      }
      await job
      expect((await sql<{ acertos: number }>('select acertos from correcao where atividade_aplicada_id = $1', [id]))[0]?.acertos).toBe(3)
    })

    it('corrida e, professora × job: a professora segura a trava ao gravar o lote, o job espera, acha a aplicação encerrada e não grava a auditoria do limite nem encerra de novo', async () => {
      const id = await provaVencida(a, [{ aluno: ana, marcadas: [0, 1, null, null, null], limiteMin: -5 }])
      await pulsar()
      const parada = new WriteBlockTrigger(sessoes.pool, { tabela: 'entrega', evento: 'insert', quando: `new.atividade_aplicada_id = '${id}'` })
      await parada.armar()
      let professora: ReturnType<RotasDaAtividade['encerrar']> | undefined
      let job: Promise<void> | undefined
      try {
        professora = rotas.encerrar(a.professora, id)
        await parada.esperarParadas(1)
        job = rodarJob(a.escolaId)
        await esperarNaTrava(sessoes.pool, '%atividade_aplicada%for update%')
      } finally {
        await parada.desarmar()
      }
      const [resposta] = await Promise.all([professora, job])
      expect(resposta?.status).toBe(200)
      expect(await lotes(id)).toBe(1)
      expect(await contar('correcao', 'atividade_aplicada_id = $1', [id])).toBe(1)
      expect(await estadoDe(id)).toBe('encerrada')
      // O job leu a aplicação já encerrada pela professora: nada de `atividade.encerrada_pelo_limite` falsa, e nenhuma encerrada na conta dele.
      expect(await auditorias(id)).toBe(0)
      expect(desfechoDoJob()).toEqual(expect.objectContaining({ escolaId: a.escolaId, encerradasTotal: 0 }))
    })

    it('corrida e, job × professora: o job segura a trava ao gravar o lote, a professora espera e acha o lote vigente: um lote, uma auditoria, um 200', async () => {
      const id = await provaVencida(a, [{ aluno: ana, marcadas: [0, 1, null, null, null], limiteMin: -5 }])
      await pulsar()
      const parada = new WriteBlockTrigger(sessoes.pool, { tabela: 'entrega', evento: 'insert', quando: `new.atividade_aplicada_id = '${id}'` })
      await parada.armar()
      let professora: ReturnType<RotasDaAtividade['encerrar']> | undefined
      let job: Promise<void> | undefined
      try {
        job = rodarJob(a.escolaId)
        await parada.esperarParadas(1)
        professora = rotas.encerrar(a.professora, id)
        // O texto da consulta da professora passa do que o `pg_stat_activity` guarda: o `for update` do fim se perde, e a que espera se acha pelas colunas do começo.
        await esperarNaTrava(sessoes.pool, '%select "atividade_aplicada"."id", "atividade_aplicada"."turma_id"%')
      } finally {
        await parada.desarmar()
      }
      const [resposta] = await Promise.all([professora, job])
      expect(resposta?.status).toBe(200)
      expect(await lotes(id)).toBe(1)
      expect(await contar('correcao', 'atividade_aplicada_id = $1', [id])).toBe(1)
      expect(await estadoDe(id)).toBe('encerrada')
      expect(await auditorias(id)).toBe(1)
    })

    it('(f) job × job: o segundo espera o primeiro, que parou ao gravar o lote, e acha a aplicação encerrada: um lote, uma auditoria; o cron duplicado do minuto grava um job', async () => {
      const id = await provaVencida(a, [{ aluno: ana, marcadas: [0, 1, null, null, null], limiteMin: -5 }])
      await pulsar()
      const parada = new WriteBlockTrigger(sessoes.pool, { tabela: 'entrega', evento: 'insert', quando: `new.atividade_aplicada_id = '${id}'` })
      await parada.armar()
      let primeiro: Promise<void> | undefined
      let segundo: Promise<void> | undefined
      try {
        primeiro = rodarJob(a.escolaId)
        await parada.esperarParadas(1)
        segundo = rodarJob(a.escolaId)
        await esperarNaTrava(sessoes.pool, '%atividade_aplicada%for update%')
      } finally {
        await parada.desarmar()
      }
      await Promise.all([primeiro, segundo])
      expect(await lotes(id)).toBe(1)
      expect(await auditorias(id)).toBe(1)
      // O cron duplicado do minuto: com uma vencida aberta em A e nenhum job gravado, as duas rotinas disputam a primeira gravação e a chave do minuto deixa um job só.
      await provaVencida(a, [{ aluno: ana, marcadas: [0, 1, null, null, null], limiteMin: -5 }])
      await pulsar()
      await sql('delete from job_registro where escola_id = $1 and tipo = $2', [a.escolaId, TIPO_ENCERRAR_PROVAS_VENCIDAS])
      await Promise.all([rodarRotina(), rodarRotina()])
      expect(await jobsGravados(a.escolaId)).toEqual([{ fila: 'lote', nao_urgente: false, chave: chaveDoMinuto(relogioDoMinuto.agora()) }])
      await sql('delete from job_registro where escola_id = $1 and tipo = $2', [a.escolaId, TIPO_ENCERRAR_PROVAS_VENCIDAS])
      await rodarJob(a.escolaId)
    })

    it('(j) estender × rotina: a extensão da turma segura o `for share`, o job espera o `for update`, a extensão confirma e o job relê o fim e não encerra', async () => {
      const id = await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      await pulsar()
      const cliente = await sessoes.pool.connect()
      let job: Promise<void> | undefined
      try {
        await cliente.query('begin')
        await cliente.query('select id from atividade_aplicada where id = $1 for share', [id])
        await cliente.query('insert into extensao_de_tempo (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, minutos, concedida_por, chave) values ($1, $2, $3, null, 30, $4, $5)', [
          a.escolaId,
          a.anoLetivoId,
          id,
          a.professora.usuarioId,
          randomUUID(),
        ])
        job = rodarJob(a.escolaId)
        await esperarNaTrava(sessoes.pool, '%atividade_aplicada%for update%')
        await cliente.query('commit')
      } finally {
        cliente.release()
      }
      await job
      expect(await estadoDe(id)).toBe('aberta')
      expect((await tentativaDe(id, ana))?.enviada_em).toBeNull()
      expect(desfechoDoJob()).toEqual(expect.objectContaining({ escolaId: a.escolaId, encerradasTotal: 0, naoVencidasTotal: 1 }))
      await sql('delete from extensao_de_tempo where atividade_aplicada_id = $1', [id])
      await rodarJob(a.escolaId)
    })

    it('(l) pulso × rotina: o pulso que voltou e ainda não confirmou deixa o committed velho, e o job não encerra; confirmado, encerra', async () => {
      const id = await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      await pulsoComIdade(60)
      const cliente = await sessoes.pool.connect()
      try {
        await cliente.query('begin')
        await cliente.query('update pulso_da_api set ultimo_em = now()')
        await rodarJob(a.escolaId)
        expect(await estadoDe(id)).toBe('aberta')
        expect(desfechoDoJob()).toEqual(expect.objectContaining({ estado: 'pulso_velho' }))
        await cliente.query('commit')
      } finally {
        cliente.release()
      }
      await rodarJob(a.escolaId)
      expect(await estadoDe(id)).toBe('encerrada')
    })
  })

  describe('a medição do alerta da prova aberta', () => {
    it('conta a prova aberta 5 min além do fim efetivo; a do aluno estendido e a que passou há pouco não contam', async () => {
      await pulsar()
      const vencida = await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -10 }], 10)
      const recente = await provaVencida(a, [{ aluno: bia, marcadas: [0, null, null, null, null], limiteMin: -3 }], 3)
      const estendido = await provaVencida(a, [{ aluno: caio, marcadas: [0, null, null, null, null], limiteMin: 20 }], 10)
      // Só a primeira passou do prazo de 5 min além do fim efetivo: a segunda passou há 3 min, e a terceira tem o limite do aluno daqui a 20.
      expect(await medida().medirDaEscola(a.escolaId)).toBe(1)
      expect(PRAZO_DO_ALERTA_DA_PROVA_ABERTA_MS).toBe(5 * MIN)
      // A rotina encerra toda prova que passou do fim efetivo, também a de 3 min: os 5 min são só a tolerância do alerta. O aluno estendido segue com a prova aberta.
      await rodarJob(a.escolaId)
      expect([await estadoDe(vencida), await estadoDe(recente), await estadoDe(estendido)]).toEqual(['encerrada', 'encerrada', 'aberta'])
      // A escola sem prova nessa situação não tem série.
      expect(await medida().medirDaEscola(a.escolaId)).toBeUndefined()
      expect(await medida().medirDaEscola(b.escolaId)).toBeUndefined()
      for (const id of [recente, estendido]) await sql('update tentativa_atividade set iniciada_em = $2, limite_base_em = $3 where atividade_aplicada_id = $1', [id, em(-50), em(-20)])
      await rodarJob(a.escolaId)
    })
  })
  describe('os repositórios da rotina só alcançam a escola e o ano do contexto', () => {
    const noContexto = <Resultado>(escolaId: string, anoLetivoId: string, trabalho: () => Promise<Resultado>): Promise<Resultado> =>
      runInContext({ requisicaoId: randomUUID(), escolaId, anoLetivoId }, trabalho)

    it('a trava, as tentativas, as extensões e a gravação do contexto de A não alcançam a prova de B, e o ano de outro contexto não alcança a de A', async () => {
      const encerramentos = new EncerramentoDaProvaRepository(filas.banco)
      const daB = await provaVencida(b, [{ aluno: anaDeB, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      const daA = await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      await estender(b, daB, null, 10)
      await estender(a, daA, null, 10)
      const [tentativaDaB] = await sql<{ id: string }>('select id from tentativa_atividade where atividade_aplicada_id = $1', [daB])
      const [tentativaDaAna] = await sql<{ id: string }>('select id from tentativa_atividade where atividade_aplicada_id = $1', [daA])
      // Cada cláusula de escopo se prova sozinha: o contexto traz uma escola e um ano, e basta uma das duas metades não ser a da prova para ela não aparecer.
      const naoAlcanca = (escolaId: string, anoLetivoId: string, aplicacaoId: string, tentativaId: string | undefined) =>
        noContexto(escolaId, anoLetivoId, async () => {
          expect(await encerramentos.lockDaRotina(aplicacaoId)).toBeUndefined()
          expect(await encerramentos.tentativasEmAndamento(aplicacaoId)).toEqual([])
          expect(await encerramentos.extensoes(aplicacaoId)).toEqual([])
          await encerramentos.encerrar(aplicacaoId)
          await encerramentos.registrarVencidas(aplicacaoId, [{ id: tentativaId ?? '', limite: em(-5) }])
        })
      // A escola de A com o ano de A: a prova de B é de outra escola e de outro ano.
      await naoAlcanca(a.escolaId, a.anoLetivoId, daB, tentativaDaB?.id)
      // A escola de A com o ano de B: o ano é o da prova de B, mas a escola não é.
      await naoAlcanca(a.escolaId, b.anoLetivoId, daB, tentativaDaB?.id)
      // O ano de outro contexto (a escola de A, com um ano que não é o da prova) tampouco alcança a prova de A.
      await naoAlcanca(a.escolaId, randomUUID(), daA, tentativaDaAna?.id)
      // A escola de B com o ano de A: o ano é o da prova de A, mas a escola não é.
      await naoAlcanca(b.escolaId, a.anoLetivoId, daA, tentativaDaAna?.id)
      expect(await estadoDe(daB)).toBe('aberta')
      expect(await estadoDe(daA)).toBe('aberta')
      expect((await tentativaDe(daB, anaDeB))?.envio).toBeNull()
      expect((await tentativaDe(daA, ana))?.envio).toBeNull()
      // As extensões saem, e o job de cada escola fecha as duas provas: não sobra vencida aberta para os outros casos.
      await sql('delete from extensao_de_tempo where atividade_aplicada_id = any($1::uuid[])', [[daA, daB]])
      await rodarJob(a.escolaId)
      await rodarJob(b.escolaId)
    })

    it('a trava e a leitura do contexto certo alcançam a prova; encerrar de novo não muda a data; só a tentativa pedida e ainda sem envio recebe o limite', async () => {
      const encerramentos = new EncerramentoDaProvaRepository(filas.banco)
      const id = await provaVencida(a, [
        { aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 },
        { aluno: bia, marcadas: [0, null, null, null, null], limiteMin: -5 },
        { aluno: caio, marcadas: [0, null, null, null, null], limiteMin: -5 },
      ])
      const outra = await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      await sql("update tentativa_atividade set enviada_em = $3, envio = 'aluno' where atividade_aplicada_id = $1 and aluno_id = $2", [id, bia.usuarioId, em(-20)])
      await estender(a, id, null, 10)
      const tentativas = await sql<{ id: string; aluno_id: string }>('select id, aluno_id from tentativa_atividade where atividade_aplicada_id = $1', [id])
      const daAna = tentativas.find(({ aluno_id }) => aluno_id === ana.usuarioId)?.id ?? ''
      const daBia = tentativas.find(({ aluno_id }) => aluno_id === bia.usuarioId)?.id ?? ''
      await noContexto(a.escolaId, a.anoLetivoId, async () => {
        expect((await encerramentos.lockDaRotina(id))?.id).toBe(id)
        expect((await encerramentos.lockDaRotina(outra))?.id).toBe(outra)
        // A que o aluno já enviou não está mais em andamento, e as da outra aplicação não entram na lista desta.
        expect((await encerramentos.tentativasEmAndamento(id)).map(({ alunoId }) => alunoId).sort()).toEqual([ana.usuarioId, caio.usuarioId].sort())
        expect((await encerramentos.tentativasEmAndamento(outra)).map(({ alunoId }) => alunoId)).toEqual([ana.usuarioId])
        // A extensão é da aplicação pedida: a outra não a tem.
        expect(await encerramentos.extensoes(id)).toHaveLength(1)
        expect(await encerramentos.extensoes(outra)).toEqual([])
        // A tentativa de uma aplicação gravada com o id de outra aplicação da mesma escola não muda.
        await encerramentos.registrarVencidas(outra, [{ id: daAna, limite: em(-5) }])
      })
      expect((await tentativaDe(id, ana))?.envio).toBeNull()
      await noContexto(a.escolaId, a.anoLetivoId, () =>
        encerramentos.registrarVencidas(id, [
          { id: daAna, limite: em(-5) },
          { id: daBia, limite: em(-5) },
        ]),
      )
      // Só a pedida e ainda sem envio muda: a Bia segue `aluno`, e o Caio, que não foi pedido, segue sem envio.
      expect((await tentativaDe(id, ana))?.envio).toBe('limite')
      expect((await tentativaDe(id, bia))?.envio).toBe('aluno')
      expect((await tentativaDe(id, caio))?.envio).toBeNull()
      const primeira = await noContexto(a.escolaId, a.anoLetivoId, async () => {
        await encerramentos.encerrar(id)
        return (await sql<{ encerrada_em: Date }>('select encerrada_em from atividade_aplicada where id = $1', [id]))[0]?.encerrada_em
      })
      // Encerrar uma não encerra a outra da mesma escola, e encerrar de novo não muda a data do primeiro encerramento.
      expect(await estadoDe(outra)).toBe('aberta')
      await noContexto(a.escolaId, a.anoLetivoId, () => encerramentos.encerrar(id))
      expect((await sql<{ encerrada_em: Date }>('select encerrada_em from atividade_aplicada where id = $1', [id]))[0]?.encerrada_em).toEqual(primeira)
      await sql('delete from extensao_de_tempo where atividade_aplicada_id = $1', [id])
      await rodarJob(a.escolaId)
    })

    it('a lista de provas vencidas da escola do contexto só traz as abertas, avaliativas e vencidas da escola e do ano dela', async () => {
      const provas = new ProvasVencidasRepository(filas.banco)
      const daA = await provaVencida(a, [])
      const daB = await provaVencida(b, [])
      const encerrada = await provaVencida(a, [])
      await sql("update atividade_aplicada set estado = 'encerrada', encerrada_em = now() where id = $1", [encerrada])
      const futura = await provaVencida(a, [])
      await sql('update atividade_aplicada set abre_em = $2, fecha_em = $3 where id = $1', [futura, em(-10), em(60)])
      const ids = async (escola: EscolaComAssistente, ano = escola.anoLetivoId) => (await noContexto(escola.escolaId, ano, () => provas.vencidasDaEscola(200))).map(({ id }) => id)
      const daEscolaA = await ids(a)
      expect(daEscolaA).toContain(daA)
      expect(daEscolaA).not.toContain(daB)
      expect(daEscolaA).not.toContain(encerrada)
      expect(daEscolaA).not.toContain(futura)
      expect(await ids(b)).toContain(daB)
      // A escola de A com o ano de B: nenhuma das duas, nem a de B (que tem o ano mas não a escola) nem as de A (que têm a escola mas não o ano).
      expect(await ids(a, b.anoLetivoId)).toEqual([])
      // A de janela mais antiga vem primeiro, e o limite corta a lista.
      const maisAntiga = await provaVencida(a, [], 30)
      const ordenadas = await ids(a)
      expect(ordenadas.indexOf(maisAntiga)).toBeLessThan(ordenadas.indexOf(daA))
      expect(await noContexto(a.escolaId, a.anoLetivoId, () => provas.vencidasDaEscola(1))).toHaveLength(1)
      // Outro ano (o contexto da escola A com o ano que não é o das provas): nenhuma.
      expect(await ids(a, randomUUID())).toEqual([])
      // A janela que passou há mais de 5 min: a de 3 min fica de fora, e a de 10 min entra.
      const recente = await provaVencida(a, [], 3)
      const antigas = await noContexto(a.escolaId, a.anoLetivoId, () => provas.abertasComJanelaVencidaHa(PRAZO_DO_ALERTA_DA_PROVA_ABERTA_MS / 1000, 200))
      expect(antigas.map(({ id }) => id)).toContain(daA)
      expect(antigas.map(({ id }) => id)).not.toContain(recente)
      await sql('delete from atividade_aplicada where id = $1', [futura])
      await rodarJob(a.escolaId)
      await rodarJob(b.escolaId)
    })

    it('a escola entra na rotina só pelo que a prova dela é: a encerrada, a de janela futura e a de pulso velho ficam de fora', async () => {
      const provas = new ProvasVencidasRepository(filas.banco)
      const c = await montarEscolaComAssistente(api, sessoes)
      const daC = await provaVencida(c, [])
      await sql("update atividade_aplicada set estado = 'encerrada', encerrada_em = now() where id = $1", [daC])
      const futura = await provaVencida(c, [])
      await sql('update atividade_aplicada set abre_em = $2, fecha_em = $3 where id = $1', [futura, em(-10), em(60)])
      await pulsar()
      expect(await provas.escolasComProvaVencida()).not.toContain(c.escolaId)
      await sql("update atividade_aplicada set estado = 'aberta', encerrada_em = null, abre_em = $2, fecha_em = $3 where id = $1", [daC, em(-70), em(-10)])
      const escolas = await provas.escolasComProvaVencida()
      expect(escolas).toContain(c.escolaId)
      // A única leitura sem escopo devolve só o id de cada escola (um texto no formato do UUID), nunca outra coluna da prova, da turma ou do aluno.
      expect(escolas.every((escolaId) => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(escolaId))).toBe(true)
      await pulsoComIdade(60)
      expect(await provas.escolasComProvaVencida()).not.toContain(c.escolaId)
      await pulsar()
      await sql('delete from atividade_aplicada where id = $1', [futura])
      await rodarJob(c.escolaId)
    })

    it('cada escola acha o ano em curso dela, e a que tem um ano encerrado e outro em curso lista e encerra só pelo em curso', async () => {
      const provas = new ProvasVencidasRepository(filas.banco)
      expect(await noContexto(a.escolaId, a.anoLetivoId, () => provas.anoEmCursoDaEscola())).toBe(a.anoLetivoId)
      expect(await noContexto(b.escolaId, b.anoLetivoId, () => provas.anoEmCursoDaEscola())).toBe(b.anoLetivoId)
      const daAno = await provaVencida(a, [{ aluno: ana, marcadas: [0, null, null, null, null], limiteMin: -5 }])
      await sql("update ano_letivo set situacao = 'encerrado' where id = $1", [a.anoLetivoId])
      const [novo] = await sql<{ id: string }>(
        `insert into ano_letivo (escola_id, ano, inicio, fim, situacao)
         select $1, max(ano) + 1, make_date(max(ano) + 1, 2, 1), make_date(max(ano) + 1, 12, 15), 'em_curso' from ano_letivo where escola_id = $1 returning id`,
        [a.escolaId],
      )
      try {
        expect(await noContexto(a.escolaId, a.anoLetivoId, () => provas.anoEmCursoDaEscola())).toBe(novo?.id)
        // A prova do ano encerrado não conta, mesmo com a escola tendo um ano em curso.
        expect(await provas.escolasComProvaVencida()).not.toContain(a.escolaId)
        await rodarJob(a.escolaId)
        expect(await estadoDe(daAno)).toBe('aberta')
      } finally {
        await sql('delete from ano_letivo where id = $1', [novo?.id])
        await sql("update ano_letivo set situacao = 'em_curso' where id = $1", [a.anoLetivoId])
      }
      await rodarJob(a.escolaId)
      expect(await estadoDe(daAno)).toBe('encerrada')
    })

    it('a leitura das quedas traz só as que terminam depois do começo da tentativa, com o pulso na mesma leitura; sem queda depois, a lista é vazia', async () => {
      const quedas = new QuedasDaApiRepository(filas.banco)
      const gravadas = await sql<{ id: string; fim: Date }>('insert into indisponibilidade (inicio, fim) values ($1, $2), ($3, $4) returning id, fim', [em(-60), em(-50), em(-30), em(-20)])
      indisponibilidades.push(...gravadas.map(({ id }) => id))
      const [antiga, recente] = [...gravadas].sort((x, y) => x.fim.getTime() - y.fim.getTime())
      await pulsoComIdade(5)
      const leitura = await quedas.leituraDesde(em(-40))
      expect(leitura.indisponibilidades.map(({ fim }) => fim.getTime())).toContain(recente?.fim.getTime())
      expect(leitura.indisponibilidades.map(({ fim }) => fim.getTime())).not.toContain(antiga?.fim.getTime())
      // O pulso e o `now()` do banco vêm da mesma leitura: a diferença entre os dois é a idade que o pulso tem.
      expect((leitura.pulso?.agora.getTime() ?? 0) - (leitura.pulso?.ultimoEm.getTime() ?? 0)).toBeGreaterThanOrEqual(4000)
      const semQueda = await quedas.leituraDesde(em(10))
      expect(semQueda.indisponibilidades).toEqual([])
      expect(semQueda.pulso?.ultimoEm).toBeInstanceOf(Date)
      // Sem a linha do pulso (backup restaurado sem ela), a leitura devolve `pulso: null`, e a transação desfaz a exclusão.
      const desfazer = new Error('desfaz')
      await expect(
        filas.banco.transaction(async (tx) => {
          await tx.delete(pulsoDaApi)
          expect((await new QuedasDaApiRepository(tx).leituraDesde(em(-40))).pulso).toBeNull()
          throw desfazer
        }),
      ).rejects.toBe(desfazer)
      await pulsar()
    })
  })

  describe('os índices da rotina (EXPLAIN, §7c)', () => {
    const SEMEADAS = 5_000
    const ids: { aplicacoes: string[]; quedas: string[] } = { aplicacoes: [], quedas: [] }
    let encerradas: string[] = []

    /** As instruções que o repository manda ao banco, capturadas do pool com os valores à parte: o EXPLAIN é da consulta de verdade, e não de uma cópia dela. */
    async function capturar<Resultado>(usar: (banco: ReturnType<typeof createDatabase>) => Promise<Resultado>): Promise<Array<{ text: string; values: unknown[] }>> {
      const pool = createPool(configuracaoDoBanco(), () => undefined)
      const enviadas: Array<{ text: string; values: unknown[] }> = []
      const consultar = pool.query.bind(pool) as (...argumentos: unknown[]) => Promise<unknown>
      pool.query = ((...argumentos: unknown[]) => {
        const [instrucao, valores] = argumentos as [string | { text: string; values?: unknown[] }, unknown[] | undefined]
        enviadas.push(typeof instrucao === 'string' ? { text: instrucao, values: valores ?? [] } : { text: instrucao.text, values: instrucao.values ?? valores ?? [] })
        return consultar(...argumentos)
      }) as typeof pool.query
      try {
        await usar(createDatabase(pool))
      } finally {
        await pool.end()
      }
      return enviadas
    }

    const planoDe = async (consulta: { text: string; values: unknown[] } | undefined): Promise<NoDoPlano | undefined> => {
      if (consulta === undefined) throw new Error('o repository não consultou o banco')
      return filas.explicar<NoDoPlano>(consulta.text, consulta.values)
    }

    beforeAll(async () => {
      // 5.000 provas **encerradas** da escola A (histórico de um ano), uma aberta vencida entre elas, extensões e quedas em volume: o índice parcial da aberta e os de extensão e queda têm de achar o que importa sem varrer o resto.
      const artefatoId = await criarAtividade(sessoes, a)
      encerradas = (
        await filas.semear<{ id: string }>(
          `insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, estado, aplicada_por, encerrada_em, abre_em, fecha_em, duracao_min)
           select $1, $2, $3, $4, true, 'encerrada', $5, now() - make_interval(mins => n), now() - make_interval(mins => n + 60), now() - make_interval(mins => n + 5), 40 from generate_series(1, ${String(SEMEADAS)}) as n returning id`,
          [a.escolaId, a.anoLetivoId, a.turma, artefatoId, a.professora.usuarioId],
        )
      ).map(({ id }) => id)
      const aberta = await criarAtividade(sessoes, a)
      ids.aplicacoes = (
        await filas.semear<{ id: string }>(
          `insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, estado, aplicada_por, abre_em, fecha_em, duracao_min)
           values ($1, $2, $3, $4, true, 'aberta', $5, now() - interval '2 hours', now() - interval '1 hour', 40) returning id`,
          [a.escolaId, a.anoLetivoId, a.turma, aberta, a.professora.usuarioId],
        )
      ).map(({ id }) => id)
      await filas.semear(
        `insert into extensao_de_tempo (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, minutos, concedida_por, chave)
         select escola_id, ano_letivo_id, id, null, 10, aplicada_por, gen_random_uuid() from atividade_aplicada where escola_id = $1 and id = any($2::uuid[])`,
        [a.escolaId, encerradas],
      )
      // As quedas ficam em 2020: nenhuma outra prova, de nenhum arquivo, tem `iniciada_em` antes delas, e `fim > desde` nunca as alcança.
      ids.quedas = (
        await filas.semear<{ id: string }>(
          `insert into indisponibilidade (inicio, fim) select timestamptz '2020-01-01' + make_interval(mins => n * 2), timestamptz '2020-01-01' + make_interval(mins => n * 2 + 1) from generate_series(1, ${String(SEMEADAS)}) as n returning id`,
        )
      ).map(({ id }) => id)
      await filas.semear('analyze atividade_aplicada')
      await filas.semear('analyze extensao_de_tempo')
      await filas.semear('analyze indisponibilidade')
    }, 120_000)

    afterAll(async () => {
      await sql('delete from extensao_de_tempo where escola_id = $1 and atividade_aplicada_id = any($2::uuid[])', [a.escolaId, encerradas])
      await sql('delete from atividade_aplicada where escola_id = $1 and id = any($2::uuid[])', [a.escolaId, [...encerradas, ...ids.aplicacoes]])
      await sql('delete from indisponibilidade where id = any($1::uuid[])', [ids.quedas])
    })

    it('a escolha das escolas com prova vencida e a lista de uma escola descem pelo índice da prova aberta, sem varrer as encerradas', async () => {
      await pulsar()
      const global = await capturar((banco) => runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => new ProvasVencidasRepository(banco).escolasComProvaVencida()))
      const planoGlobal = await planoDe(global.find(({ text }) => text.includes('"atividade_aplicada"')))
      expect(indicesDoPlano(planoGlobal)).toContain('atividade_aplicada_prova_aberta_idx')
      expect(removidasNoFiltro(planoGlobal)).toBeLessThanOrEqual(1)

      const daEscola = await capturar((banco) => runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId, anoLetivoId: a.anoLetivoId }, () => new ProvasVencidasRepository(banco).vencidasDaEscola(200)))
      const planoDaEscola = await planoDe(daEscola.find(({ text }) => text.includes('"atividade_aplicada"')))
      expect(indicesDoPlano(planoDaEscola)).toContain('atividade_aplicada_prova_aberta_idx')
      expect(removidasNoFiltro(planoDaEscola)).toBeLessThanOrEqual(1)
    }, 60_000)

    it('as extensões de uma aplicação saem pelo índice da chave (escola, aplicação), e a leitura das quedas, pelo índice do fim', async () => {
      const extensoes = await capturar((banco) => runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId, anoLetivoId: a.anoLetivoId }, () => new EncerramentoDaProvaRepository(banco).extensoes(encerradas[0] ?? '')))
      const planoDasExtensoes = await planoDe(extensoes.find(({ text }) => text.includes('"extensao_de_tempo"')))
      expect(indicesDoPlano(planoDasExtensoes)).toContain('extensao_de_tempo_chave_por_aplicacao')
      expect(removidasNoFiltro(planoDasExtensoes)).toBeLessThanOrEqual(1)

      const quedas = await capturar((banco) => new QuedasDaApiRepository(banco).leituraDesde(new Date(Date.now() - 30_000)))
      const planoDasQuedas = await planoDe(quedas.find(({ text }) => text.includes('"indisponibilidade"')))
      expect(indicesDoPlano(planoDasQuedas)).toContain('indisponibilidade_fim_idx')
      expect(removidasNoFiltro(planoDasQuedas)).toBeLessThanOrEqual(1)
    }, 60_000)
  })
})
