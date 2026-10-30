import 'reflect-metadata'
import { DeleteObjectCommand, DeleteObjectsCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { UsageMeter, currentContext, runInContext, UsageRepository, VALIDADE_DO_CONTADOR_SEGUNDOS, type UsagePeriod } from '@educa/nucleo'
import { JobFailureCode, TIPO_CONSOLIDAR_USO, TIPO_EXPURGAR_ACESSO, TIPO_EXPURGAR_DADO_PESSOAL, TIPO_EXPURGAR_JOBS } from '@educa/shared'
import { Queue } from 'bullmq'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { AGENDAMENTOS, criarDisparoDeAgendamento, FILA_DOS_AGENDAMENTOS, FUSO_DOS_AGENDAMENTOS, registrarAgendamentos } from '../src/agendamentos.js'
import type { ConfiguracaoStorage } from '../src/config.js'
import { FalhaDeJob } from '../src/falha-de-job.js'
import { montarWorker, type WorkerMontado } from '../src/montagem.js'
import { criarConsolidacaoDeUso, FALHAS_DE_STORAGE_SEGUIDAS_ATE_DESISTIR } from '../src/processadores/consolidar-uso.js'
import { criarClienteS3, MedidorDeStorage } from '../src/storage/medidor-de-storage.js'
import { BancadaDeFila, configuracaoDoBanco, janelaPadraoDoAmbiente, LogEmMemoria, urlRedisDeFila, vagasPadraoDoAmbiente } from './fila-de-teste.js'
import { execucaoDoJob } from './execucao-do-job.js'

// Contadores no Redis de fila, `uso_infra_diario` no Postgres e bytes no storage, todos do compose de
// teste. Só o relógio é falso: é ele que marca às 23h59 de 31/12 e consolida às 2h do dia seguinte.

const ambiente = lerAmbienteDeTeste()
const STORAGE: ConfiguracaoStorage = {
  url: `http://127.0.0.1:${valorObrigatorio(ambiente, 'STORAGE_PORTA_HOST')}`,
  regiao: valorObrigatorio(ambiente, 'STORAGE_REGIAO'),
  bucket: valorObrigatorio(ambiente, 'STORAGE_BUCKET'),
  chaveAcesso: valorObrigatorio(ambiente, 'STORAGE_CHAVE_ACESSO'),
  chaveSecreta: valorObrigatorio(ambiente, 'STORAGE_CHAVE_SECRETA'),
}

const TERCA_10H = new Date('2026-09-15T10:00:00-03:00')
const QUARTA_2H = new Date('2026-09-16T02:00:00-03:00')
const SEM_USO: UsagePeriod = { requisicoes: 0, jobs: 0, bytesStorage: 0 }

beforeAll(() => {
  // Despachante ou worker do compose de pé disputaria as linhas com os deste arquivo.
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('uso por escola: contagem, consolidação e bytes', () => {
  let bancada: BancadaDeFila
  let agora: Date
  const relogio = { agora: () => agora }
  let contador: UsageMeter
  let repositorio: UsageRepository
  let s3: S3Client
  const escolasDoTeste: string[] = []
  const objetosDoTeste: string[] = []
  /** Pastas que o teste quer fora do storage no fim: o SeaweedFS guarda a pasta vazia depois que os objetos saem. */
  const pastasDoTeste = new Set<string>()
  const montados: WorkerMontado[] = []
  const log = new LogEmMemoria('worker-teste')

  // Escola real: desde a tarefa 3.0 `uso_infra_diario` tem FK para `escola`, e a consolidação de um id
  // inventado seria recusada pelo banco.
  const novaEscola = async (): Promise<string> => {
    const escolaId = await bancada.escola()
    escolasDoTeste.push(escolaId)
    return escolaId
  }

  /** Marca como a API marca: dentro do contexto da escola do token. */
  const marcarRequisicoes = (escolaId: string, quantidade: number) =>
    runInContext({ requisicaoId: randomUUID(), escolaId }, () => {
      for (let indice = 0; indice < quantidade; indice++) contador.marcar('req')
    })

  /** O incremento sai sem espera: a leitura espera ele chegar. */
  const aguardarContador = (escolaId: string, dia: string, metrica: 'req' | 'jobs', valor: number) =>
    expect.poll(() => bancada.redis.get(`${bancada.prefixo}:uso:${dia}:${escolaId}:${metrica}`), { timeout: 5_000, interval: 50 }).toBe(String(valor))

  const consolidacao = () =>
    criarConsolidacaoDeUso({ contador, repositorio, storage: new MedidorDeStorage(s3, STORAGE.bucket), relogio, logger: log.logger })

  /** Roda como o worker roda um job `sistema.*`: no contexto da rotina do sistema, sem escola. */
  const consolidar = (processador = consolidacao()) => {
    const jobId = randomUUID()
    return runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => processador({}, execucaoDoJob(jobId)))
  }

  const usoDoDia = (escolaId: string, dia: string) => runInContext({ requisicaoId: randomUUID(), escolaId }, () => repositorio.doDia(dia))
  const usoDoMes = (escolaId: string, mes: string) => runInContext({ requisicaoId: randomUUID(), escolaId }, () => repositorio.doMes(mes))

  const guardar = async (chave: string, bytes: number) => {
    objetosDoTeste.push(chave)
    // Toda pasta do caminho sai no fim: vazia, ela continuaria listada e viraria escola inexistente depois que o banco de
    // teste fosse recriado.
    const partes = chave.split('/')
    for (let fim = 2; fim < partes.length; fim++) pastasDoTeste.add(`${partes.slice(0, fim).join('/')}/`)
    await s3.send(new PutObjectCommand({ Bucket: STORAGE.bucket, Key: chave, Body: Buffer.alloc(bytes, 1) }))
  }

  beforeEach(async () => {
    bancada = new BancadaDeFila()
    await bancada.limparRegistro()
    agora = TERCA_10H
    contador = new UsageMeter(bancada.redis, { relogio, prefixo: bancada.prefixo })
    repositorio = new UsageRepository(bancada.banco)
    s3 = criarClienteS3(STORAGE)
    log.linhas.length = 0
  })

  afterEach(async () => {
    await Promise.all(montados.splice(0).map((montado) => montado.encerrar()))
    if (objetosDoTeste.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket: STORAGE.bucket, Delete: { Objects: objetosDoTeste.splice(0).map((Key) => ({ Key })) } }))
    }
    // A mais funda primeiro: a pasta só sai da listagem vazia.
    const pastas = [...pastasDoTeste].sort((a, b) => b.length - a.length)
    pastasDoTeste.clear()
    for (const pasta of pastas) await s3.send(new DeleteObjectCommand({ Bucket: STORAGE.bucket, Key: pasta }))
    await bancada.pool.query('delete from uso_infra_diario where escola_id = any($1::uuid[])', [escolasDoTeste.splice(0)])
    const chaves = await bancada.redis.keys(`${bancada.prefixo}:*`)
    if (chaves.length > 0) await bancada.redis.del(...chaves)
    s3.destroy()
    await bancada.fechar()
  }, 60_000)

  it('caminho feliz: N requisições e M jobs da escola A, executados pelo worker de verdade, aparecem no dia e no mês', async () => {
    const [escolaA, escolaB] = await Promise.all([novaEscola(), novaEscola()])
    marcarRequisicoes(escolaA, 5)
    const worker = montarWorker({ banco: configuracaoDoBanco(), redisFilaUrl: urlRedisDeFila(), pools: { interativa: 3 }, vagasPadrao: vagasPadraoDoAmbiente(), threadsMaximo: 1 }, log.logger, {
      prefixo: bancada.prefixo,
      relogio,
    })
    montados.push(worker)
    bancada.despachante(log, { relogio }).iniciar()
    const jobs = await Promise.all([1, 2, 3].map(() => bancada.enfileirar(escolaA)))
    await expect.poll(async () => Promise.all(jobs.map(async (id) => (await bancada.estado(id))?.estado)), { timeout: 20_000, interval: 100 }).toEqual([
      'concluido',
      'concluido',
      'concluido',
    ])
    await aguardarContador(escolaA, '2026-09-15', 'req', 5)
    await aguardarContador(escolaA, '2026-09-15', 'jobs', 3)

    agora = QUARTA_2H
    await consolidar()

    expect(await usoDoDia(escolaA, '2026-09-15')).toEqual({ requisicoes: 5, jobs: 3, bytesStorage: 0 })
    expect(await usoDoMes(escolaA, '2026-09')).toEqual({ requisicoes: 5, jobs: 3, bytesStorage: 0 })
    // Isolamento: a chave leva a escola, e nada de A soma na B.
    expect(await usoDoDia(escolaB, '2026-09-15')).toEqual(SEM_USO)
    expect(await usoDoMes(escolaB, '2026-09')).toEqual(SEM_USO)
    // Depois de gravado, o contador sai do Redis.
    expect(await bancada.redis.keys(`${bancada.prefixo}:uso:*`)).toEqual([])
  })

  it('isolamento: duas escolas no mesmo dia, cada uma com a própria contagem, e a consulta de uma não enxerga a outra', async () => {
    const [escolaA, escolaB] = await Promise.all([novaEscola(), novaEscola()])
    marcarRequisicoes(escolaA, 4)
    marcarRequisicoes(escolaB, 9)
    await aguardarContador(escolaA, '2026-09-15', 'req', 4)
    await aguardarContador(escolaB, '2026-09-15', 'req', 9)
    agora = QUARTA_2H
    await consolidar()
    expect((await usoDoDia(escolaA, '2026-09-15')).requisicoes).toBe(4)
    expect((await usoDoDia(escolaB, '2026-09-15')).requisicoes).toBe(9)
    expect((await usoDoMes(escolaA, '2026-09')).requisicoes).toBe(4)
  })

  it('repository: sem escola no contexto nada é lido nem gravado, e duas escolas gravando o mesmo dia ao mesmo tempo, na mesma instância, cada uma na sua', async () => {
    const [escolaA, escolaB] = await Promise.all([novaEscola(), novaEscola()])
    const naEscola = <T>(escolaId: string, funcao: () => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)
    const semEscola = <T>(funcao: () => Promise<T>) => runInContext({ requisicaoId: randomUUID() }, funcao)

    await expect(semEscola(() => repositorio.gravarDia('2026-09-15', { requisicoes: 1 }))).rejects.toThrow('consulta com escopo sem escola no contexto')
    await expect(semEscola(() => repositorio.doDia('2026-09-15'))).rejects.toThrow('consulta com escopo sem escola no contexto')
    await expect(semEscola(() => repositorio.doMes('2026-09'))).rejects.toThrow('consulta com escopo sem escola no contexto')

    // As duas chamadas começam juntas na mesma instância: a escola é a de cada contexto, lida a cada chamada.
    await Promise.all([naEscola(escolaA, () => repositorio.gravarDia('2026-09-15', { requisicoes: 3, jobs: 1 })), naEscola(escolaB, () => repositorio.gravarDia('2026-09-15', { requisicoes: 8, jobs: 2 }))])

    expect(await usoDoDia(escolaA, '2026-09-15')).toEqual({ requisicoes: 3, jobs: 1, bytesStorage: 0 })
    expect(await usoDoDia(escolaB, '2026-09-15')).toEqual({ requisicoes: 8, jobs: 2, bytesStorage: 0 })
    expect(await usoDoMes(escolaA, '2026-09')).toEqual({ requisicoes: 3, jobs: 1, bytesStorage: 0 })
    expect(await usoDoMes(escolaB, '2026-09')).toEqual({ requisicoes: 8, jobs: 2, bytesStorage: 0 })
  })

  it('concorrência: duas consolidações em paralelo, e uma terceira depois, não dobram o valor', async () => {
    const escolaA = await novaEscola()
    marcarRequisicoes(escolaA, 7)
    await aguardarContador(escolaA, '2026-09-15', 'req', 7)
    agora = QUARTA_2H
    const processador = consolidacao()
    await Promise.all([consolidar(processador), consolidar(processador)])
    expect(await usoDoDia(escolaA, '2026-09-15')).toEqual({ requisicoes: 7, jobs: 0, bytesStorage: 0 })
    await consolidar(processador)
    expect((await usoDoMes(escolaA, '2026-09')).requisicoes).toBe(7)
  })

  it('reexecução depois de gravar e antes de apagar (worker morto): regrava o mesmo valor, sem somar', async () => {
    const escolaA = await novaEscola()
    marcarRequisicoes(escolaA, 6)
    await aguardarContador(escolaA, '2026-09-15', 'req', 6)
    agora = QUARTA_2H
    // A primeira execução grava e morre antes do DEL.
    const morreAntesDeApagar = criarConsolidacaoDeUso({
      contador: {
        lerDiasFechados: (hoje) => contador.lerDiasFechados(hoje),
        apagarConsolidado: () => Promise.reject(new Error('worker morto')),
      },
      repositorio,
      storage: new MedidorDeStorage(s3, STORAGE.bucket),
      relogio,
      logger: log.logger,
    })
    await expect(consolidar(morreAntesDeApagar)).rejects.toThrow('worker morto')
    expect((await usoDoDia(escolaA, '2026-09-15')).requisicoes).toBe(6)
    await consolidar()
    expect((await usoDoDia(escolaA, '2026-09-15')).requisicoes).toBe(6)
    expect(await bancada.redis.keys(`${bancada.prefixo}:uso:*`)).toEqual([])
  })

  it('incremento que chega entre a leitura e a remoção não se perde: a chave fica, e a próxima consolidação grava o valor novo', async () => {
    const escolaA = await novaEscola()
    marcarRequisicoes(escolaA, 2)
    await aguardarContador(escolaA, '2026-09-15', 'req', 2)
    await runInContext({ requisicaoId: randomUUID(), escolaId: escolaA }, async () => {
      await bancada.redis.incr(`${bancada.prefixo}:uso:2026-09-15:${escolaA}:req`)
      // A consolidação leu 2; o contador já está em 3.
      expect(await contador.apagarConsolidado('2026-09-15', 'req', 2)).toBe(false)
    })
    agora = QUARTA_2H
    await consolidar()
    expect((await usoDoDia(escolaA, '2026-09-15')).requisicoes).toBe(3)
  })

  it('incremento atrasado que faz renascer a chave de um dia já consolidado não troca o total do dia pelo valor pequeno', async () => {
    const escolaA = await novaEscola()
    marcarRequisicoes(escolaA, 6)
    await aguardarContador(escolaA, '2026-09-15', 'req', 6)
    agora = QUARTA_2H
    await consolidar()
    // Um cliente com relógio atrasado marca terça depois de a terça ter sido consolidada e apagada.
    agora = TERCA_10H
    marcarRequisicoes(escolaA, 1)
    await aguardarContador(escolaA, '2026-09-15', 'req', 1)
    agora = new Date('2026-09-17T02:00:00-03:00')
    await consolidar()
    expect((await usoDoDia(escolaA, '2026-09-15')).requisicoes).toBe(6)
  })

  it('borda: 23h59 e 00h01 de São Paulo caem em dias diferentes, 31/12 fecha dezembro, e o dia aberto não é consolidado', async () => {
    const escolaA = await novaEscola()
    agora = new Date('2026-12-31T23:59:00-03:00')
    marcarRequisicoes(escolaA, 1)
    agora = new Date('2027-01-01T00:01:00-03:00')
    marcarRequisicoes(escolaA, 1)
    await aguardarContador(escolaA, '2026-12-31', 'req', 1)
    await aguardarContador(escolaA, '2027-01-01', 'req', 1)

    // 02h de 01/01 em São Paulo: dezembro fechou, 01/01 ainda está aberto (em UTC já seria 05h de 01/01).
    agora = new Date('2027-01-01T02:00:00-03:00')
    await consolidar()
    expect((await usoDoMes(escolaA, '2026-12')).requisicoes).toBe(1)
    expect((await usoDoDia(escolaA, '2026-12-31')).requisicoes).toBe(1)
    expect((await usoDoMes(escolaA, '2027-01')).requisicoes).toBe(0)
    expect(await bancada.redis.get(`${bancada.prefixo}:uso:2027-01-01:${escolaA}:req`)).toBe('1')

    agora = new Date('2027-01-02T02:00:00-03:00')
    await consolidar()
    expect((await usoDoMes(escolaA, '2027-01')).requisicoes).toBe(1)
    expect((await usoDoMes(escolaA, '2026-12')).requisicoes).toBe(1)
  })

  it('borda: os bytes de escolas/{a}/ não somam escolas/{a}x/, e os de B ficam na B, no dia que fechou', async () => {
    const [escolaA, escolaB] = await Promise.all([novaEscola(), novaEscola()])
    await guardar(`escolas/${escolaA}/apostila.pdf`, 100)
    await guardar(`escolas/${escolaA}/provas/2026/p1.png`, 50)
    await guardar(`escolas/${escolaA}x/intruso.pdf`, 1_000)
    await guardar(`escolas/${escolaB}/apostila.pdf`, 7)

    agora = QUARTA_2H
    await consolidar()
    expect(await usoDoDia(escolaA, '2026-09-15')).toEqual({ requisicoes: 0, jobs: 0, bytesStorage: 150 })
    expect((await usoDoDia(escolaB, '2026-09-15')).bytesStorage).toBe(7)
    // Os bytes do mês são o pico medido, e não a soma dos dias.
    agora = new Date('2026-09-17T02:00:00-03:00')
    await consolidar()
    expect((await usoDoMes(escolaA, '2026-09')).bytesStorage).toBe(150)
    // A medição não apaga a contagem já gravada no mesmo dia.
    marcarRequisicoes(escolaA, 3)
    await aguardarContador(escolaA, '2026-09-17', 'req', 3)
    agora = new Date('2026-09-18T02:00:00-03:00')
    await consolidar()
    expect(await usoDoDia(escolaA, '2026-09-17')).toEqual({ requisicoes: 3, jobs: 0, bytesStorage: 150 })
    // Nem a contagem gravada depois da medição (um job atrasado do dia 17) apaga os bytes dele.
    agora = new Date('2026-09-17T23:00:00-03:00')
    await runInContext({ requisicaoId: randomUUID(), escolaId: escolaA }, async () => contador.marcar('jobs'))
    await aguardarContador(escolaA, '2026-09-17', 'jobs', 1)
    agora = new Date('2026-09-19T02:00:00-03:00')
    await consolidar()
    expect(await usoDoDia(escolaA, '2026-09-17')).toEqual({ requisicoes: 3, jobs: 1, bytesStorage: 150 })
  })

  it('só a rotina do sistema consolida: um job de escola com o tipo da consolidação falha sem tocar em nada', async () => {
    const escolaA = await novaEscola()
    marcarRequisicoes(escolaA, 2)
    await aguardarContador(escolaA, '2026-09-15', 'req', 2)
    agora = QUARTA_2H
    const jobId = randomUUID()
    await expect(runInContext({ requisicaoId: randomUUID(), escolaId: escolaA }, () => consolidacao()({}, execucaoDoJob(jobId)))).rejects.toThrow()
    expect(await usoDoDia(escolaA, '2026-09-15')).toEqual(SEM_USO)
  })

  describe('uma escola não para a consolidação das outras (regra 80, item 3)', () => {
    let medidor: MedidorDeTeste

    beforeEach(() => {
      medidor = new MedidorDeTeste()
    })

    afterEach(async () => {
      await medidor.encerrar()
    })

    /**
     * O contador com as escolas de `primeiro` na frente, na ordem dada: o `SCAN` devolve em ordem arbitrária, e o teste
     * precisa da escola recusada antes da boa para provar que o laço segue depois da recusa.
     */
    const contadorComPrimeiro = (...primeiro: string[]) => ({
      lerDiasFechados: async (hoje: string) => {
        const posicao = (escolaId: string) => (primeiro.includes(escolaId) ? primeiro.indexOf(escolaId) : primeiro.length)
        return (await contador.lerDiasFechados(hoje)).sort((a, b) => posicao(a.escolaId) - posicao(b.escolaId))
      },
      apagarConsolidado: (dia: string, metrica: 'req' | 'jobs', valor: number) => contador.apagarConsolidado(dia, metrica, valor),
    })

    const consolidacaoMedida = (sobrepor: Partial<Parameters<typeof criarConsolidacaoDeUso>[0]> = {}) =>
      criarConsolidacaoDeUso({ contador, repositorio, storage: new MedidorDeStorage(s3, STORAGE.bucket), relogio, logger: log.logger, medidor: medidor.medidor, ...sobrepor })

    /** A métrica por origem e causa. Ela não leva escola: o teste a confere contra os avisos do log. */
    const ignoradas = async () =>
      Object.fromEntries((await medidor.pontos('uso.escola_ignorada')).map(({ atributos, valor }) => [`${String(atributos['origem'])}/${String(atributos['causa'])}`, valor]))

    /** Os avisos do log, e a mesma contagem por origem e causa, que a métrica tem de repetir. */
    const avisosDoLog = () => {
      const avisos = log.doEvento('uso.escola_ignorada')
      const porCausa: Record<string, number> = {}
      for (const { origem, causa } of avisos) porCausa[`${String(origem)}/${String(causa)}`] = (porCausa[`${String(origem)}/${String(causa)}`] ?? 0) + 1
      return { avisos, porCausa }
    }

    /** Só os avisos das escolas deste teste: o bucket de teste pode ter pasta de outra execução. */
    const avisosDas = (escolas: string[]) =>
      log
        .doEvento('uso.escola_ignorada')
        .filter(({ escolaId }) => escolas.includes(String(escolaId)))
        .map(({ escolaId, origem, causa }) => ({ escolaId, origem, causa }))

    /**
     * Uma pasta com um objeto, de uma escola que não está no banco: a escola eliminada que deixou a pasta vazia no
     * SeaweedFS. O id começa com zeros para vir antes de qualquer escola real na listagem do storage.
     */
    const pastaOrfa = async (bytes: number): Promise<string> => {
      const escolaId = `00000000-0000-4000-8000-${randomUUID().slice(-12)}`
      await guardar(`escolas/${escolaId}/sobra.bin`, bytes)
      return escolaId
    }

    it('reprodução: pasta e contador de uma escola que não existe no banco, antes de uma escola real; a real é consolidada, a órfã é pulada, contada e logada só por id', async () => {
      const escolaReal = await novaEscola()
      const orfa = await pastaOrfa(9)
      await guardar(`escolas/${escolaReal}/apostila.pdf`, 10)
      marcarRequisicoes(escolaReal, 4)
      // O contador da órfã nasce como a API o criaria: pelo `marcar`, no contexto de uma escola que o banco não tem.
      marcarRequisicoes(orfa, 5)
      await aguardarContador(escolaReal, '2026-09-15', 'req', 4)
      await aguardarContador(orfa, '2026-09-15', 'req', 5)
      const processador = consolidacaoMedida({ contador: contadorComPrimeiro(orfa) })

      agora = QUARTA_2H
      await consolidar(processador)

      expect(await usoDoDia(escolaReal, '2026-09-15')).toEqual({ requisicoes: 4, jobs: 0, bytesStorage: 10 })
      expect((await bancada.pool.query('select 1 from uso_infra_diario where escola_id = $1', [orfa])).rowCount).toBe(0)
      expect(avisosDas([orfa, escolaReal])).toEqual([
        { escolaId: orfa, origem: 'contador', causa: 'escola_inexistente' },
        { escolaId: orfa, origem: 'storage', causa: 'escola_inexistente' },
      ])
      const { avisos, porCausa } = avisosDoLog()
      expect(await ignoradas()).toEqual(porCausa)
      // Só ids, origem, causa e o erro resumido: nenhum valor de linha, nenhuma mensagem do banco. A requisição vem do contexto do job.
      for (const aviso of avisos) {
        const campos = Object.keys(aviso).filter((campo) => !['level', 'time', 'servico', 'msg', 'pid', 'hostname'].includes(campo))
        expect(campos.sort()).toEqual(['causa', 'erro', 'escolaId', 'evento', 'origem', 'requisicaoId'])
        expect(aviso['erro']).toEqual({ tipo: 'ErroDoPostgres', sqlstate: '23503', constraint: 'uso_infra_diario_escola_id_escola_id_fk' })
      }
      expect(JSON.stringify(avisos)).not.toContain('is not present')
      expect(log.doEvento('uso.consolidado')).toEqual([expect.objectContaining({ diasTotal: 2, ignoradasTotal: avisos.length })])
      // O contador da órfã fica, com o prazo que o `marcar` deu, e vence sozinho: nada que não pôde ser gravado é apagado.
      const chaveOrfa = `${bancada.prefixo}:uso:2026-09-15:${orfa}:req`
      expect(await bancada.redis.get(chaveOrfa)).toBe('5')
      const prazo = await bancada.redis.ttl(chaveOrfa)
      expect(prazo).toBeGreaterThan(0)
      expect(prazo).toBeLessThanOrEqual(VALIDADE_DO_CONTADOR_SEGUNDOS)
      expect(await bancada.redis.exists(`${bancada.prefixo}:uso:2026-09-15:${escolaReal}:req`)).toBe(0)

      // Reexecução (D49): a real fica igual, a órfã é pulada de novo, e o contador dela segue igual.
      await consolidar(processador)
      expect(await usoDoDia(escolaReal, '2026-09-15')).toEqual({ requisicoes: 4, jobs: 0, bytesStorage: 10 })
      expect(await bancada.redis.get(chaveOrfa)).toBe('5')
      expect(avisosDas([orfa])).toHaveLength(4)
    })

    it('todas as escolas encontradas inexistentes no banco (o worker apontado para outro banco): pula cada uma, e o job falha no fim, para aparecer como job falho e a fila tentar de novo', async () => {
      const orfaA = `00000000-0000-4000-8000-${randomUUID().slice(-12)}`
      const orfaB = `00000000-0000-4000-8000-${randomUUID().slice(-12)}`
      const orfaC = `00000000-0000-4000-8000-${randomUUID().slice(-12)}`
      // A órfã A no contador e no storage, a B só no storage, a C só no contador: três encontradas, duas pastas. O bucket de
      // teste pode ter pasta de escola real de outro teste, e por isso a listagem é só a destas.
      marcarRequisicoes(orfaA, 5)
      marcarRequisicoes(orfaC, 1)
      await aguardarContador(orfaA, '2026-09-15', 'req', 5)
      await aguardarContador(orfaC, '2026-09-15', 'req', 1)
      const storage = { listarEscolas: () => Promise.resolve([orfaA, orfaB]), bytesDaEscola: () => Promise.resolve(3) }

      agora = QUARTA_2H
      const falha = await consolidar(consolidacaoMedida({ storage })).then(
        () => undefined,
        (erro: unknown) => erro,
      )

      expect(falha).toBeInstanceOf(FalhaDeJob)
      expect(falha).toMatchObject({ codigo: JobFailureCode.ERRO_INTERNO, definitiva: false })
      // Cada uma foi pulada e contada como antes, e nada foi gravado nem apagado.
      expect(avisosDas([orfaA, orfaB, orfaC]).filter(({ origem }) => origem === 'storage')).toEqual([
        { escolaId: orfaA, origem: 'storage', causa: 'escola_inexistente' },
        { escolaId: orfaB, origem: 'storage', causa: 'escola_inexistente' },
      ])
      // O `SCAN` do contador devolve em ordem arbitrária: as duas do contador, em qualquer ordem.
      expect(avisosDas([orfaA, orfaB, orfaC]).filter(({ origem }) => origem === 'contador')).toEqual(
        expect.arrayContaining([
          { escolaId: orfaA, origem: 'contador', causa: 'escola_inexistente' },
          { escolaId: orfaC, origem: 'contador', causa: 'escola_inexistente' },
        ]),
      )
      expect(await ignoradas()).toEqual({ 'contador/escola_inexistente': 2, 'storage/escola_inexistente': 2 })
      expect(await bancada.redis.get(`${bancada.prefixo}:uso:2026-09-15:${orfaA}:req`)).toBe('5')
      expect(await bancada.redis.get(`${bancada.prefixo}:uso:2026-09-15:${orfaC}:req`)).toBe('1')
      // A linha que diz por que o job falhou: só a contagem das encontradas (contador e storage juntos), nenhum id.
      const linhas = log.doEvento('uso.nenhuma_escola_no_banco')
      expect(linhas).toEqual([expect.objectContaining({ encontradasTotal: 3 })])
      for (const orfa of [orfaA, orfaB, orfaC]) expect(JSON.stringify(linhas)).not.toContain(orfa)
    })

    it('a escola real conta de onde vier: só no contador (com a órfã só no storage), ou só no storage (com a órfã só no contador), o job termina', async () => {
      const [real, orfaDoStorage, orfaDoContador] = [await novaEscola(), `00000000-0000-4000-8000-${randomUUID().slice(-12)}`, `00000000-0000-4000-8000-${randomUUID().slice(-12)}`]
      marcarRequisicoes(real, 2)
      await aguardarContador(real, '2026-09-15', 'req', 2)
      agora = QUARTA_2H
      await consolidar(consolidacaoMedida({ storage: { listarEscolas: () => Promise.resolve([orfaDoStorage]), bytesDaEscola: () => Promise.resolve(3) } }))
      expect((await usoDoDia(real, '2026-09-15')).requisicoes).toBe(2)

      agora = TERCA_10H
      marcarRequisicoes(orfaDoContador, 4)
      await aguardarContador(orfaDoContador, '2026-09-15', 'req', 4)
      agora = QUARTA_2H
      await consolidar(consolidacaoMedida({ storage: { listarEscolas: () => Promise.resolve([real]), bytesDaEscola: () => Promise.resolve(8) } }))
      expect((await usoDoDia(real, '2026-09-15')).bytesStorage).toBe(8)
      expect(avisosDas([orfaDoStorage, orfaDoContador])).toEqual([
        { escolaId: orfaDoStorage, origem: 'storage', causa: 'escola_inexistente' },
        { escolaId: orfaDoContador, origem: 'contador', causa: 'escola_inexistente' },
      ])
      expect(log.doEvento('uso.nenhuma_escola_no_banco')).toEqual([])
    })

    it('sem escola nenhuma encontrada (nenhum contador, storage vazio), a consolidação termina sem falha', async () => {
      agora = QUARTA_2H
      await consolidar(consolidacaoMedida({ contador: { lerDiasFechados: () => Promise.resolve([]), apagarConsolidado: () => Promise.resolve(true) }, storage: { listarEscolas: () => Promise.resolve([]), bytesDaEscola: () => Promise.resolve(0) } }))
      expect(log.doEvento('uso.nenhuma_escola_no_banco')).toEqual([])
      expect(log.doEvento('uso.consolidado')).toEqual([expect.objectContaining({ diasTotal: 0, escolasTotal: 0, ignoradasTotal: 0 })])
    })

    it('valor inválido num contador (texto, dia que não existe, negativo) pula só aquele dia daquela escola, e a escola seguinte é consolidada', async () => {
      const [escolaA, escolaB] = await Promise.all([novaEscola(), novaEscola()])
      marcarRequisicoes(escolaB, 2)
      await aguardarContador(escolaB, '2026-09-15', 'req', 2)
      // Nada no sistema escreve assim; é o que sobra de um `SET` à mão ou de uma chave corrompida.
      await bancada.redis.set(`${bancada.prefixo}:uso:2026-09-15:${escolaA}:jobs`, 'abc', 'EX', 60)
      await bancada.redis.set(`${bancada.prefixo}:uso:2026-02-30:${escolaA}:req`, '3', 'EX', 60)
      // O `Number` da leitura aceita; quem recusa é a checagem de não negativo da tabela (23514).
      await bancada.redis.set(`${bancada.prefixo}:uso:2026-09-14:${escolaA}:req`, '-3', 'EX', 60)

      agora = QUARTA_2H
      await consolidar(consolidacaoMedida({ contador: contadorComPrimeiro(escolaA) }))

      expect((await usoDoDia(escolaB, '2026-09-15')).requisicoes).toBe(2)
      expect(await usoDoDia(escolaA, '2026-09-15')).toEqual(SEM_USO)
      expect(await usoDoDia(escolaA, '2026-09-14')).toEqual(SEM_USO)
      expect(avisosDas([escolaA, escolaB])).toEqual([1, 2, 3].map(() => ({ escolaId: escolaA, origem: 'contador', causa: 'valor_invalido' })))
      expect(log.doEvento('uso.escola_ignorada').filter(({ escolaId }) => escolaId === escolaA).map(({ erro }) => (erro as { sqlstate: string }).sqlstate).sort()).toEqual(
        ['22008', '22P02', '23514'].sort(),
      )
      expect(await ignoradas()).toEqual(avisosDoLog().porCausa)
    })

    it('banco fora, ou recusa que não é da escola, não vira escola pulada: o job falha para a fila tentar de novo', async () => {
      const escolaA = await novaEscola()
      marcarRequisicoes(escolaA, 3)
      await aguardarContador(escolaA, '2026-09-15', 'req', 3)
      agora = QUARTA_2H
      const bancoFora = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' })
      // O servidor derrubando a conexão (57P01) também é do banco, não da escola.
      const conexaoDerrubada = Object.assign(new Error('terminating connection due to administrator command'), { code: '57P01', severity: 'FATAL' })
      // 23503 de outra restrição não é "a escola não existe": só a FK da escola libera o pulo.
      const outraFk = Object.assign(new Error('insert or update violates foreign key constraint'), { code: '23503', severity: 'ERROR', constraint: 'outra_tabela_fk' })
      for (const erro of [bancoFora, conexaoDerrubada, outraFk]) {
        await expect(consolidar(consolidacaoMedida({ repositorio: { gravarDia: () => Promise.reject(erro) } }))).rejects.toBe(erro)
      }
      expect(log.doEvento('uso.escola_ignorada')).toEqual([])
      expect(await ignoradas()).toEqual({})
      // O contador fica para a próxima tentativa.
      expect(await bancada.redis.get(`${bancada.prefixo}:uso:2026-09-15:${escolaA}:req`)).toBe('3')
    })

    it('erro de storage numa pasta: a escola seguinte tem os bytes gravados, e o job falha no fim para a fila tentar de novo', async () => {
      const [escolaA, escolaB, escolaC] = await Promise.all([novaEscola(), novaEscola(), novaEscola()])
      const real = new MedidorDeStorage(s3, STORAGE.bucket)
      const pastaQuebrada = Object.assign(new Error('AccessDenied'), { name: 'AccessDenied' })
      const storage = {
        listarEscolas: () => Promise.resolve([escolaA, escolaB, escolaC]),
        bytesDaEscola: () => (currentContext()?.escolaId === escolaB ? Promise.reject(pastaQuebrada) : real.bytesDaEscola()),
      }
      await guardar(`escolas/${escolaA}/a.pdf`, 11)
      await guardar(`escolas/${escolaC}/c.pdf`, 13)

      agora = QUARTA_2H
      await expect(consolidar(consolidacaoMedida({ storage }))).rejects.toBe(pastaQuebrada)

      expect((await usoDoDia(escolaA, '2026-09-15')).bytesStorage).toBe(11)
      expect((await usoDoDia(escolaC, '2026-09-15')).bytesStorage).toBe(13)
      expect(await ignoradas()).toEqual({ 'storage/erro_de_storage': 1 })
      expect(log.doEvento('uso.escola_ignorada')).toEqual([expect.objectContaining({ escolaId: escolaB, origem: 'storage', causa: 'erro_de_storage', erro: expect.objectContaining({ tipo: 'AccessDenied' }) })])
    })

    it('pastas com erro espalhadas (erro, ok, erro, ok, erro) não são storage fora: as cinco são medidas, as boas gravadas, e o job falha no fim com o primeiro erro', async () => {
      const escolas = await Promise.all([1, 2, 3, 4, 5].map(() => novaEscola()))
      const comErro = [escolas[0], escolas[2], escolas[4]]
      const erros = new Map(comErro.map((escolaId, indice) => [escolaId, Object.assign(new Error(`AccessDenied ${indice}`), { name: 'AccessDenied' })]))
      const medidas: string[] = []
      const storage = {
        listarEscolas: () => Promise.resolve(escolas),
        bytesDaEscola: () => {
          const escolaId = currentContext()?.escolaId ?? ''
          medidas.push(escolaId)
          const erro = erros.get(escolaId)
          return erro === undefined ? Promise.resolve(7) : Promise.reject(erro)
        },
      }
      agora = QUARTA_2H
      await expect(consolidar(consolidacaoMedida({ storage }))).rejects.toBe(erros.get(escolas[0] ?? ''))
      expect(medidas).toEqual(escolas)
      expect((await usoDoDia(escolas[1] ?? '', '2026-09-15')).bytesStorage).toBe(7)
      expect((await usoDoDia(escolas[3] ?? '', '2026-09-15')).bytesStorage).toBe(7)
      expect(await ignoradas()).toEqual({ 'storage/erro_de_storage': 3 })
    })

    it(`storage fora no meio da medição: desiste depois de ${FALHAS_DE_STORAGE_SEGUIDAS_ATE_DESISTIR} pastas seguidas com erro, sem esperar o prazo de cada escola`, async () => {
      const escolas = await Promise.all([1, 2, 3, 4, 5].map(() => novaEscola()))
      const storageFora = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
      let medicoes = 0
      const storage = {
        listarEscolas: () => Promise.resolve(escolas),
        bytesDaEscola: () => {
          medicoes++
          return Promise.reject(storageFora)
        },
      }
      agora = QUARTA_2H
      await expect(consolidar(consolidacaoMedida({ storage }))).rejects.toBe(storageFora)
      expect(medicoes).toBe(FALHAS_DE_STORAGE_SEGUIDAS_ATE_DESISTIR)
      expect(log.doEvento('uso.escola_ignorada').map(({ causa }) => causa)).toEqual(Array(FALHAS_DE_STORAGE_SEGUIDAS_ATE_DESISTIR).fill('erro_de_storage'))
      expect((await bancada.pool.query('select 1 from uso_infra_diario where escola_id = any($1::uuid[])', [escolas])).rowCount).toBe(0)
    })
  })

  describe('agendamento', () => {
    let fila: Queue

    beforeEach(() => {
      fila = new Queue(FILA_DOS_AGENDAMENTOS, { connection: bancada.redis, prefix: bancada.prefixo })
    })

    afterEach(async () => {
      await fila.obliterate({ force: true })
      await fila.close()
    })

    it('as rotinas são agendadas à 1h, às 2h, às 3h30 e às 4h30 de São Paulo, e registrar de novo (a outra réplica) não duplica o agendador', async () => {
      await registrarAgendamentos(fila)
      await registrarAgendamentos(fila)
      const agendadores = await fila.getJobSchedulers()
      expect(agendadores.map(({ key, pattern, tz }) => ({ key, pattern, tz })).sort((a, b) => a.key.localeCompare(b.key))).toEqual([
        { key: TIPO_CONSOLIDAR_USO, pattern: '0 2 * * *', tz: FUSO_DOS_AGENDAMENTOS },
        { key: TIPO_EXPURGAR_ACESSO, pattern: '30 4 * * *', tz: FUSO_DOS_AGENDAMENTOS },
        { key: TIPO_EXPURGAR_DADO_PESSOAL, pattern: '0 1 * * *', tz: FUSO_DOS_AGENDAMENTOS },
        { key: TIPO_EXPURGAR_JOBS, pattern: '30 3 * * *', tz: FUSO_DOS_AGENDAMENTOS },
      ])
      const proximaConsolidacao = agendadores.find(({ key }) => key === TIPO_CONSOLIDAR_USO)?.next
      const horaEmSaoPaulo = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(proximaConsolidacao ?? 0))
      expect(horaEmSaoPaulo).toBe('02:00')
    })

    it('o disparo grava o job da rotina em job_registro pelo Enfileirador: lote, não urgente, sem escola, com requisição', async () => {
      const disparar = criarDisparoDeAgendamento(bancada.banco, bancada.enfileirador, log.logger)
      const jobId = await disparar({ name: TIPO_CONSOLIDAR_USO })
      const { rows } = await bancada.pool.query<Record<string, unknown>>(
        'select tipo, fila, nao_urgente as "naoUrgente", escola_id as "escolaId", requisicao_id is not null as "comRequisicao", estado from job_registro where id = $1',
        [jobId],
      )
      expect(rows).toEqual([{ tipo: TIPO_CONSOLIDAR_USO, fila: 'lote', naoUrgente: true, escolaId: null, comRequisicao: true, estado: 'aguardando' }])
      await expect(disparar({ name: 'sistema.qualquer-coisa' })).rejects.toThrow('agendamento desconhecido')
      expect((await bancada.pool.query('select 1 from job_registro')).rowCount).toBe(1)
    })

    it('trilha completa: disparo na fila de agendamentos → job_registro → despachante → worker de lote → uso consolidado e job concluido, com a pasta órfã na métrica do worker montado', async () => {
      const escolaA = await novaEscola()
      marcarRequisicoes(escolaA, 8)
      await aguardarContador(escolaA, '2026-09-15', 'req', 8)
      // Uma pasta de escola que o banco não tem: o worker montado pula e mede, pelo medidor que a montagem recebeu.
      await guardar(`escolas/00000000-0000-4000-8000-${randomUUID().slice(-12)}/sobra.bin`, 1)
      const medidor = new MedidorDeTeste()
      onTestFinished(() => medidor.encerrar())
      agora = QUARTA_2H
      const worker = montarWorker(
        { banco: configuracaoDoBanco(), redisFilaUrl: urlRedisDeFila(), pools: { lote: 2 }, vagasPadrao: vagasPadraoDoAmbiente(), threadsMaximo: 1, storage: STORAGE, janelaPadrao: janelaPadraoDoAmbiente() },
        log.logger,
        { prefixo: bancada.prefixo, relogio, agendamentos: AGENDAMENTOS, medidor: medidor.medidor },
      )
      montados.push(worker)
      expect(worker.agendamentos).toBeDefined()
      bancada.despachante(log, { relogio }).iniciar()

      await fila.add(TIPO_CONSOLIDAR_USO, {})
      await expect.poll(() => usoDoDia(escolaA, '2026-09-15'), { timeout: 20_000, interval: 100 }).toEqual({ requisicoes: 8, jobs: 0, bytesStorage: 0 })
      await expect
        .poll(async () => (await bancada.pool.query<{ estado: string }>("select estado from job_registro where tipo = 'sistema.consolidar-uso'")).rows.map(({ estado }) => estado), {
          timeout: 20_000,
          interval: 100,
        })
        .toEqual(['concluido'])
      const pulos = (await medidor.pontos('uso.escola_ignorada')).find(({ atributos }) => atributos['origem'] === 'storage' && atributos['causa'] === 'escola_inexistente')
      expect(pulos?.valor).toBeGreaterThanOrEqual(1)
    })
  })
})
