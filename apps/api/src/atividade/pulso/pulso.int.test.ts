import 'reflect-metadata'
import { createLogger, createPool, InMemoryFileStorage, type DatabasePool } from '@educa/core'
import { limiteDaTentativa } from '@educa/shared'
import { NestFactory } from '@nestjs/core'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { raizRepositorio } from '../../../../../tools/ci/executar.ts'
import { urlDoBancoDeTeste } from '../../../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../../../tools/testes/metricas.ts'
import { AppModule } from '../../app.module.js'
import { configureApp } from '../../configure-app.js'
import { alunosComSessao, aplicarAtividade, criarAtividade, rotasDaAtividade, type RotasDaAtividade } from '../../../test/atividade.fixture.js'
import { montarEscolaComAssistente, type EscolaComAssistente } from '../../../test/escola-assistente.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../../test/sessao.fixture.js'
import { subirApi, type TestApi } from '../../../test/test-api.js'
import { testConfig, TEST_APP_OPTIONS } from '../../../test/test-config.js'
import { esperarNaTrava, WriteBlockTrigger } from '../../../test/write-block-trigger.js'
import { INTERVALO_DO_PULSO_MS, ouvirDepoisDoPrimeiroPulso, PulsoService, type Tique } from './pulso.service.js'
import { PulsoRepository, QuedasDaApiRepository } from './pulso.repository.js'

/**
 * O pulso da API (avaliacao-e-correcao, 2.0; Tech Spec §5.7; regra 80, item 6): a lacuna entre dois pulsos acima de 30 s vira indisponibilidade, e a instância que não pulsa
 * há mais de 30 s recusa as rotas de prova. O teste não dorme: o instante do último pulso é posto no banco, o tique e o relógio da recusa são injetados.
 *
 * `pulso_da_api` e `indisponibilidade` são globais, sem escola: o teste devolve as duas ao que eram no `afterAll`, e a corrida do banco compartilhado não os lê de outro arquivo (os
 * arquivos de integração rodam um por vez).
 */
describe('o pulso da API', () => {
  const bancada = new SessaoFixtures()
  const sql = async <Registro extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Registro[]> => (await bancada.pool.query(texto, valores)).rows as Registro[]
  const pools: DatabasePool[] = []
  const repositorios: PulsoRepository[] = []
  let idsAntes: string[] = []
  let ultimoEmAntes: Date | undefined

  /** Um pool e um repositório de pulso só deste caso: a conexão retida do pulso é de quem o criou. */
  function novoRepositorio(): { pool: DatabasePool; repositorio: PulsoRepository } {
    const pool = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 20, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    const repositorio = new PulsoRepository(pool)
    pools.push(pool)
    repositorios.push(repositorio)
    return { pool, repositorio }
  }

  /** Põe o último pulso `segundos` atrás, pelo relógio do banco. */
  const pulsouHa = (segundos: number) => sql('update pulso_da_api set ultimo_em = now() - make_interval(secs => $1::double precision)', [segundos])
  const ultimoEm = async (): Promise<Date> => {
    const [linha] = await sql<{ ultimo_em: Date }>('select ultimo_em from pulso_da_api')
    if (linha === undefined) throw new Error('a linha única do pulso não existe')
    return linha.ultimo_em
  }
  /** As indisponibilidades gravadas por este arquivo: as que não existiam antes dele. */
  const gravadas = () => sql<{ inicio: Date; fim: Date }>('select inicio, fim from indisponibilidade where id <> all($1::uuid[]) order by inicio', [idsAntes])
  const apagarGravadas = () => sql('delete from indisponibilidade where id <> all($1::uuid[])', [idsAntes])

  beforeAll(async () => {
    idsAntes = (await sql<{ id: string }>('select id from indisponibilidade')).map(({ id }) => id)
    ultimoEmAntes = (await sql<{ ultimo_em: Date }>('select ultimo_em from pulso_da_api'))[0]?.ultimo_em
  })

  afterEach(async () => {
    await Promise.all(repositorios.splice(0).map((repositorio) => repositorio.encerrar()))
    // Uma conexão que o repositório não devolveu seguraria o `end` para sempre: o limite de 3 s deixa o caso falhar pela asserção, e não pelo desligamento.
    await Promise.all(pools.splice(0).map((pool) => Promise.race([pool.end(), new Promise((resolver) => setTimeout(resolver, 3_000))])))
    await apagarGravadas()
  })

  afterAll(async () => {
    await sql('delete from pulso_da_api')
    await sql('insert into pulso_da_api (ultimo_em) values ($1)', [ultimoEmAntes ?? new Date()])
    await bancada.fechar()
  })

  describe('a instrução do pulso', () => {
    it('lacuna acima de 30 s grava uma indisponibilidade do último pulso até o novo; abaixo de 30 s, nenhuma, e o pulso anda do mesmo jeito', async () => {
      const { repositorio } = novoRepositorio()
      for (const segundos of [20, 29]) {
        await pulsouHa(segundos)
        const antes = await ultimoEm()
        await repositorio.pulsar()
        expect((await ultimoEm()).getTime(), `${String(segundos)} s: o pulso andou`).toBeGreaterThan(antes.getTime())
        expect(await gravadas(), `${String(segundos)} s: nenhuma indisponibilidade`).toEqual([])
      }
      for (const segundos of [31, 40]) {
        await apagarGravadas()
        await pulsouHa(segundos)
        const antes = await ultimoEm()
        await repositorio.pulsar()
        const depois = await ultimoEm()
        // Uma indisponibilidade, do pulso que havia até o `now()` do pulso novo: as duas pontas são o que o banco leu e gravou na mesma instrução.
        expect(await gravadas(), `${String(segundos)} s`).toEqual([{ inicio: antes, fim: depois }])
      }
    })

    it('tabela vazia: nenhuma indisponibilidade, e a linha única volta com o pulso de agora', async () => {
      const { repositorio } = novoRepositorio()
      await sql('delete from pulso_da_api')
      // Sem linha do pulso, a leitura do limite diz que não há pulso, e não inventa indisponibilidade.
      expect(await new QuedasDaApiRepository(bancada.banco).leituraDesde(new Date(0))).toEqual({ pulso: null, indisponibilidades: [] })
      await repositorio.pulsar()
      expect(await gravadas()).toEqual([])
      expect(await sql('select ultimo_em from pulso_da_api')).toHaveLength(1)
      // Voltou como linha de verdade: o pulso seguinte a atualiza, e não cria outra.
      const antes = await ultimoEm()
      await repositorio.pulsar()
      expect(await sql('select ultimo_em from pulso_da_api')).toHaveLength(1)
      expect((await ultimoEm()).getTime()).toBeGreaterThan(antes.getTime())
    })

    it('parado 40 min e de volta: grava 40 min sem teto, e o limite da tentativa anda os mesmos 40 min com a lacuna aberta e com a fechada', async () => {
      const { repositorio } = novoRepositorio()
      await pulsouHa(40 * 60)
      const parou = await ultimoEm()
      const base = new Date(parou.getTime() + 60 * 60_000)
      const iniciadaEm = new Date(parou.getTime() - 10 * 60_000)
      const leitor = bancada.banco
      const entrada = (leitura: Awaited<ReturnType<QuedasDaApiRepository['leituraDesde']>>) => ({ alunoId: randomUUID(), iniciadaEm, limiteBase: base, extensoes: [], ...leitura })

      // Antes do pulso de volta, é a lacuna aberta que conta.
      const aberta = limiteDaTentativa(entrada(await new QuedasDaApiRepository(leitor).leituraDesde(iniciadaEm)))
      await repositorio.pulsar()
      const [queda] = await gravadas()
      const fechada = limiteDaTentativa(entrada(await new QuedasDaApiRepository(leitor).leituraDesde(iniciadaEm)))
      if (queda === undefined || aberta === null || fechada === null) throw new Error('a queda de 40 min não foi gravada ou o limite não veio')

      expect(queda.inicio).toEqual(parou)
      const duracao = queda.fim.getTime() - parou.getTime()
      // 40 min cheios, e nem um segundo a menos por teto: o pulso que volta demora milissegundos, não minutos.
      expect(duracao).toBeGreaterThanOrEqual(40 * 60_000)
      expect(duracao).toBeLessThan(41 * 60_000)
      expect(fechada.getTime()).toBe(base.getTime() + duracao)
      expect(aberta.getTime() - base.getTime()).toBeGreaterThanOrEqual(40 * 60_000)
      // A aberta e a fechada são a mesma queda, lida em dois instantes: diferem pelo tempo entre as duas leituras.
      expect(Math.abs(aberta.getTime() - fechada.getTime())).toBeLessThan(10_000)
    })

    it('falha forçada depois do `update`: nada grava, nem o pulso, e a lacuna aparece inteira no pulso seguinte', async () => {
      const { repositorio } = novoRepositorio()
      const funcao = `falha_forcada_${randomUUID().replaceAll('-', '').slice(0, 12)}`
      await pulsouHa(40)
      const parou = await ultimoEm()
      // A sequência não desfaz com a transação: cada tentativa da instrução avança uma vez, e o teste conta quantas foram.
      await sql(`create sequence ${funcao}`)
      await sql(`create function ${funcao}() returns trigger language plpgsql as $$ begin perform nextval('${funcao}'); raise exception 'falha forçada do teste'; end $$`)
      await sql(`create trigger ${funcao} before insert on indisponibilidade for each row execute function ${funcao}()`)
      try {
        await expect(repositorio.pulsar()).rejects.toThrow('falha forçada do teste')
        // Erro que não é de conexão não se repete: uma tentativa só.
        expect((await sql<{ last_value: string }>(`select last_value from ${funcao}`))[0]?.last_value).toBe('1')
        // O `update` e o `insert` são uma instrução só: o que falhou no segundo desfez o primeiro, e o pulso continua onde estava.
        expect(await ultimoEm()).toEqual(parou)
        expect(await gravadas()).toEqual([])
      } finally {
        await sql(`drop trigger ${funcao} on indisponibilidade`)
        await sql(`drop function ${funcao}()`)
        await sql(`drop sequence ${funcao}`)
      }
      await repositorio.pulsar()
      expect(await gravadas()).toMatchObject([{ inicio: parou }])
    })

    it('`encerrar` devolve a conexão retida ao pool: o `end` do pool termina sem esperar, e a conexão não fica emprestada', async () => {
      const pool = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 4, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
      const repositorio = new PulsoRepository(pool)
      await repositorio.pulsar()
      await repositorio.encerrar()
      // Sem a devolução, o `end` espera a conexão do pulso para sempre.
      const fim = await Promise.race([pool.end().then(() => 'fechado'), new Promise<string>((resolver) => setTimeout(() => resolver('preso'), 3_000))])
      expect(fim).toBe('fechado')
    })

    it('erro de conexão: a conexão que falhou volta ao pool como descartada (com erro), e o pulso repete numa conexão nova, sem indisponibilidade', async () => {
      const { pool } = novoRepositorio()
      const devolucoes: unknown[] = []
      let conexoes = 0
      // A primeira conexão é uma de mentira, que falha como a que o servidor derrubou; as seguintes são as do pool.
      const quebrada = {
        on: () => quebrada,
        query: () => Promise.reject(new Error('conexão encerrada')),
        release: (erro?: unknown) => void devolucoes.push(erro),
      }
      const poolComUmaQuebrada = { connect: () => (conexoes++ === 0 ? Promise.resolve(quebrada) : pool.connect()) } as unknown as DatabasePool
      const repositorio = new PulsoRepository(poolComUmaQuebrada)
      repositorios.push(repositorio)
      await pulsouHa(5)
      const antes = await ultimoEm()
      await repositorio.pulsar()
      expect(conexoes).toBe(2)
      expect(devolucoes).toHaveLength(1)
      expect(devolucoes[0], 'devolvida com erro: o pool a descarta em vez de reaproveitá-la').toBeTruthy()
      expect((await ultimoEm()).getTime()).toBeGreaterThan(antes.getTime())
      expect(await gravadas()).toEqual([])
    })

    it('conexão do pulso derrubada com `pg_terminate_backend`: o pulso seguinte reconecta, numa conexão nova, sem indisponibilidade', async () => {
      const { repositorio } = novoRepositorio()
      const doPulso = async (): Promise<number[]> =>
        (await sql<{ pid: number }>(`select pid from pg_stat_activity where datname = current_database() and query ilike '%with antes as (select ultimo_em from pulso_da_api for update)%'`)).map(({ pid }) => pid)
      const antes = await doPulso()
      await pulsouHa(5)
      await repositorio.pulsar()
      const [conexao] = (await doPulso()).filter((pid) => !antes.includes(pid))
      expect(conexao, 'a conexão retida do pulso').toBeDefined()
      // Retida: o pulso seguinte usa a mesma conexão, e o pool não empresta uma nova a cada pulso.
      await repositorio.pulsar()
      expect((await doPulso()).filter((pid) => !antes.includes(pid))).toEqual([conexao])
      await sql('select pg_terminate_backend($1)', [conexao])

      const parou = await ultimoEm()
      await repositorio.pulsar()
      expect((await ultimoEm()).getTime()).toBeGreaterThan(parou.getTime())
      expect(await gravadas()).toEqual([])
      // Foi outra conexão que pulsou: a derrubada não voltou.
      const [nova] = (await doPulso()).filter((pid) => !antes.includes(pid) && pid !== conexao)
      expect(nova, 'a conexão nova do pulso').toBeDefined()
    })
  })

  describe('a leitura do pulso e das indisponibilidades', () => {
    it('numa consulta só: o pulso e o `now()` do banco vêm juntos, numa instrução', async () => {
      await pulsouHa(5)
      let selects = 0
      const contado = new Proxy(bancada.banco, {
        get(alvo, propriedade, receptor) {
          if (propriedade === 'select') selects += 1
          return Reflect.get(alvo, propriedade, receptor) as unknown
        },
      })
      const { pulso } = await new QuedasDaApiRepository(contado).leituraDesde(new Date(Date.now() - 60 * 60_000))
      expect(selects).toBe(1)
      if (pulso === null) throw new Error('a linha do pulso existe')
      // 5 s de idade, com a folga do que passou entre a escrita e a leitura; `agora` é o `now()` do banco.
      expect(pulso.agora.getTime() - pulso.ultimoEm.getTime()).toBeGreaterThanOrEqual(5_000)
      expect(pulso.agora.getTime() - pulso.ultimoEm.getTime()).toBeLessThan(30_000)
      expect(Math.abs(pulso.agora.getTime() - Date.now())).toBeLessThan(60_000)
    })

    it('só entram as que terminam depois de `desde`: a de 125 min atrás fica fora da leitura de uma hora, a de 35 min entra, e sem nenhuma a lista vem vazia, não com uma linha de nulos', async () => {
      const [recente] = await sql<{ fim: Date }>(`insert into indisponibilidade (inicio, fim) values (now() - interval '40 minutes', now() - interval '35 minutes') returning fim`)
      const [antiga] = await sql<{ fim: Date }>(`insert into indisponibilidade (inicio, fim) values (now() - interval '130 minutes', now() - interval '125 minutes') returning fim`)
      if (recente === undefined || antiga === undefined) throw new Error('as duas indisponibilidades foram gravadas')
      const repositorio = new QuedasDaApiRepository(bancada.banco)
      const daUltimaHora = (await repositorio.leituraDesde(new Date(Date.now() - 60 * 60_000))).indisponibilidades.map(({ fim }) => fim.getTime())
      expect(daUltimaHora).toContain(recente.fim.getTime())
      expect(daUltimaHora).not.toContain(antiga.fim.getTime())
      // Sem nenhuma depois de `desde`: o pulso vem, e a lista vem vazia.
      const doFuturo = await repositorio.leituraDesde(new Date(Date.now() + 60 * 60_000))
      expect(doFuturo.pulso).not.toBeNull()
      expect(doFuturo.indisponibilidades).toEqual([])
    })
  })

  describe('corrida (g): pulso × pulso', () => {
    it('as duas instâncias com a lacuna de 40 s à frente: a primeira, segurada no `insert` da indisponibilidade, grava a lacuna; a segunda lê o pulso novo e não grava outra', async () => {
      const primeira = novoRepositorio()
      const segunda = novoRepositorio()
      await pulsouHa(40)
      const parou = await ultimoEm()
      // A primeira fica parada no `insert` da indisponibilidade, já com a linha do pulso travada e atualizada.
      const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'indisponibilidade', evento: 'insert', quando: 'true' })
      await gatilho.armar()
      try {
        const doPrimeira = primeira.repositorio.pulsar()
        await gatilho.esperarParadas(1)
        // A segunda chega com a linha travada pela primeira e espera na trava: a primeira, no gatilho, e a segunda, na linha. O padrão é o do começo da instrução, e não o do `for update`:
        // sem a cláusula a segunda também espera (no `update`), e o caso cai pela asserção da lacuna, e não por não achar a espera.
        const daSegunda = segunda.repositorio.pulsar()
        await esperarNaTrava(bancada.pool, '%with antes as (select ultimo_em from pulso_da_api%', 2)
        await gatilho.soltar()
        await Promise.all([doPrimeira, daSegunda])
      } finally {
        await gatilho.desarmar()
      }
      expect(await gravadas()).toMatchObject([{ inicio: parou }])
    })
  })

  describe('a recusa das rotas de prova com o pulso parado', () => {
    const medidor = new MedidorDeTeste()
    let api: TestApi
    let rotas: RotasDaAtividade
    let a: EscolaComAssistente
    let ana: TestSessao
    let bia: TestSessao
    let cris: TestSessao
    let dani: TestSessao
    let outraEscolaAplicacaoId: string
    let aplicacaoId: string
    /** O que a instância lê como "agora" para a recusa, deslocado à mão. */
    let deslocamentoMs = 0
    const instanteBase = Date.now()
    const relogio = { agora: () => new Date(instanteBase + deslocamentoMs) }
    /** O tique que o teste dispara: guarda a ação que o serviço registrou. */
    let acaoDoTique: (() => Promise<void>) | undefined
    const tique: Tique = (acao, intervaloMs) => {
      expect(intervaloMs).toBe(INTERVALO_DO_PULSO_MS)
      acaoDoTique = acao
      return () => {
        acaoDoTique = undefined
      }
    }
    const dispararOTique = async () => acaoDoTique?.()
    const status = async (chamada: Promise<{ status: number; corpo: { erro?: { codigo?: string } } }>) => {
      const resposta = await chamada
      return { status: resposta.status, codigo: resposta.corpo.erro?.codigo }
    }
    const INDISPONIVEL = { status: 503, codigo: 'INDISPONIVEL_TENTE_DE_NOVO' }
    const contar = async (tabela: string, aluno: TestSessao): Promise<number> => Number((await sql<{ total: string }>(`select count(*) as total from ${tabela} where aluno_id = $1`, [aluno.usuarioId]))[0]?.total)

    beforeAll(async () => {
      api = await subirApi(medidor.medidor, {}, undefined, { ...TEST_APP_OPTIONS, relogioDoPulso: relogio, tiqueDoPulso: tique })
      rotas = rotasDaAtividade(api)
      a = await montarEscolaComAssistente(api, bancada)
      ;[ana, bia, cris, dani] = (await alunosComSessao(bancada, a, a.turma, ['Aluna Sintética Ana', 'Aluna Sintética Bia', 'Aluna Sintética Cris', 'Aluna Sintética Dani'])) as [TestSessao, TestSessao, TestSessao, TestSessao]
      aplicacaoId = await aplicarAtividade(rotas, a.professora, await criarAtividade(bancada, a), a.turma)
      // Uma aplicação de outra escola: o 503 não pode dizer se o id existe.
      const outra = await montarEscolaComAssistente(api, bancada)
      outraEscolaAplicacaoId = await aplicarAtividade(rotas, outra.professora, await criarAtividade(bancada, outra), outra.turma)
      // A Ana já começou a prova antes do pulso existir: os casos abaixo não dependem uns dos outros.
      expect((await rotas.comecar(ana, aplicacaoId)).status).toBe(200)
    })

    afterAll(async () => {
      await api.app.close()
    })

    it('antes de o pulso ser iniciado a instância não mede nada: com o relógio uma hora adiante, a prova começa', async () => {
      deslocamentoMs = 60 * 60_000
      expect((await rotas.comecar(cris, aplicacaoId)).status).toBe(200)
      deslocamentoMs = 0
    })

    it('+29 s e +30 s aceitam `comecar`, `prova`, `tempo`, PUT e envio; +31 s recusa as cinco com 503, antes de ler e de gravar, e `minhas-atividades` segue; o tique volta e as cinco aceitam', async () => {
      await api.app.get(PulsoService).start()
      expect(acaoDoTique, 'o tique foi registrado').toBeDefined()

      // A fronteira é de 30 s inclusive, nas três rotas: cada uma das duas alunas abre a prova, responde e envia, com o relógio em +29 s (a Cris) e em +30 s (a Dani).
      for (const [adiante, aluna] of [
        [29_000, cris],
        [30_000, dani],
      ] as const) {
        deslocamentoMs = adiante
        expect((await rotas.comecar(aluna, aplicacaoId)).status, `+${String(adiante)} ms: comecar`).toBe(200)
        expect((await rotas.prova(aluna, aplicacaoId)).status, `+${String(adiante)} ms: prova`).toBe(200)
        expect((await rotas.tempo(aluna, aplicacaoId)).status, `+${String(adiante)} ms: tempo`).toBe(200)
        expect((await rotas.responder(aluna, aplicacaoId, 1, 0)).status, `+${String(adiante)} ms: PUT da resposta`).toBe(200)
        expect((await rotas.enviar(aluna, aplicacaoId)).status, `+${String(adiante)} ms: envio`).toBe(200)
        expect(await contar('resposta_atividade', aluna), `+${String(adiante)} ms: a resposta gravou`).toBe(1)
      }

      deslocamentoMs = 31_000
      expect(await status(rotas.comecar(bia, aplicacaoId))).toEqual(INDISPONIVEL)
      expect(await status(rotas.prova(bia, aplicacaoId))).toEqual(INDISPONIVEL)
      expect(await status(rotas.tempo(ana, aplicacaoId))).toEqual(INDISPONIVEL)
      expect(await status(rotas.responder(ana, aplicacaoId, 1, 0))).toEqual(INDISPONIVEL)
      expect(await status(rotas.enviar(ana, aplicacaoId))).toEqual(INDISPONIVEL)
      // O 503 vem antes de qualquer leitura: o mesmo para o id de uma aplicação de outra escola e para um id que não existe (regra 10, item 6; regra 20, item 6).
      for (const id of [outraEscolaAplicacaoId, randomUUID()]) {
        expect(await status(rotas.comecar(bia, id)), 'comecar').toEqual(INDISPONIVEL)
        expect(await status(rotas.prova(bia, id)), 'prova').toEqual(INDISPONIVEL)
        expect(await status(rotas.tempo(bia, id)), 'tempo').toEqual(INDISPONIVEL)
        expect(await status(rotas.responder(bia, id, 1, 0)), 'PUT').toEqual(INDISPONIVEL)
        expect(await status(rotas.enviar(bia, id)), 'envio').toEqual(INDISPONIVEL)
      }
      // Recusou antes de ler e de gravar: a Bia segue sem tentativa (só `comecar` cria uma), a Ana sem resposta e sem envio.
      expect(await contar('tentativa_atividade', bia)).toBe(0)
      expect(await contar('resposta_atividade', ana)).toBe(0)
      expect((await sql<{ enviada_em: Date | null }>('select enviada_em from tentativa_atividade where aluno_id = $1', [ana.usuarioId]))[0]?.enviada_em).toBeNull()
      // O resto da API segue com o pulso parado.
      expect((await rotas.minhas(ana)).status).toBe(200)

      // O tique volta: o pulso grava, a instância volta a aceitar, e a recusa não fica presa.
      await dispararOTique()
      expect((await rotas.comecar(bia, aplicacaoId)).status).toBe(200)
      expect((await rotas.prova(bia, aplicacaoId)).status).toBe(200)
      expect((await rotas.tempo(bia, aplicacaoId)).status).toBe(200)
      expect((await rotas.responder(ana, aplicacaoId, 1, 0)).status).toBe(200)
      expect((await rotas.enviar(ana, aplicacaoId)).status).toBe(200)
    })

    it('o pulso que falha não conta como feito: com o `update` do pulso falhando e o relógio 31 s adiante a instância recusa, e volta a aceitar quando o pulso volta', async () => {
      await api.app.get(PulsoService).start()
      const funcao = `falha_do_pulso_${randomUUID().replaceAll('-', '').slice(0, 12)}`
      const antesDaFalha = await sql<{ ultimo_em: Date }>('select ultimo_em from pulso_da_api')
      await sql(`create function ${funcao}() returns trigger language plpgsql as $$ begin raise exception 'pulso fora'; end $$`)
      await sql(`create trigger ${funcao} before update on pulso_da_api for each row execute function ${funcao}()`)
      try {
        deslocamentoMs += 31_000
        await dispararOTique()
        expect(await status(rotas.prova(bia, aplicacaoId))).toEqual(INDISPONIVEL)
        expect((await sql<{ ultimo_em: Date }>('select ultimo_em from pulso_da_api'))[0]?.ultimo_em).toEqual(antesDaFalha[0]?.ultimo_em)
      } finally {
        await sql(`drop trigger ${funcao} on pulso_da_api`)
        await sql(`drop function ${funcao}()`)
      }
      await dispararOTique()
      expect((await rotas.prova(bia, aplicacaoId)).status).toBe(200)
    })
  })

  describe('o primeiro pulso antes de aceitar tráfego', () => {
    it('com o primeiro pulso segurado no banco, a porta não abre; solto o pulso, ela abre', async () => {
      const logger = createLogger({ servico: 'api-teste', nivel: 'silent' })
      const medidor = new MedidorDeTeste()
      const app = await NestFactory.create(AppModule.forRoot(testConfig(), { ...TEST_APP_OPTIONS, armazemDeArquivos: new InMemoryFileStorage(), medidor: medidor.medidor, logger }), { logger: false })
      configureApp(app, logger, medidor.medidor)
      const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'pulso_da_api', evento: 'update', quando: 'true' })
      await gatilho.armar()
      try {
        const subida = ouvirDepoisDoPrimeiroPulso(app, 0, '127.0.0.1')
        await gatilho.esperarParadas(1)
        // O primeiro pulso está parado no banco: sem tráfego antes dele.
        expect(app.getHttpServer().listening).toBe(false)
        await gatilho.soltar()
        await subida
        expect(app.getHttpServer().listening).toBe(true)
      } finally {
        await gatilho.desarmar()
        await app.close()
      }
    })

    it('o `main.ts` abre a porta pelo `ouvirDepoisDoPrimeiroPulso`, e não pelo `listen` direto', () => {
      const principal = readFileSync(join(raizRepositorio, 'apps/api/src/main.ts'), 'utf8')
      expect(principal).toContain('await ouvirDepoisDoPrimeiroPulso(app, config.porta')
      // A métrica que o alerta lê sai da instância que pulsa.
      expect(principal).toContain('observePulsoDaApi(medidor, () => app.get(PulsoService).idadeEmSegundos())')
      expect(principal.split('\n').filter((linha) => /^\s*await app\.listen\(/.test(linha))).toEqual([])
    })
  })
})
