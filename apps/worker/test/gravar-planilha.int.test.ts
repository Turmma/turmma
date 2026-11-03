import 'reflect-metadata'
import { ImportacaoRepository, MotorDePlanilha, runInContext, TENTATIVAS_DO_JOB } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { esperarNaTrava, WriteBlockTrigger } from '../../api/test/write-block-trigger.js'
import { JobFailureError } from '../src/job-failure.error.js'
import { criarGravacaoDaPlanilha } from '../src/processors/gravar-planilha.js'
import { jobExecution } from './job-execution.fixture.js'
import { InMemoryLog, QueueFixtures } from './queue.fixture.js'

beforeAll(() => {
  // Worker do compose de pé poderia executar o job que o teste grava, e disputar a importação com o processador do próprio teste.
  compose('stop', ...PROCESSOS_DA_FILA)
})

/**
 * O job `estrutura.gravar-planilha` (F2, tarefa 4.0; Tech Spec do onboarding, seção 5, "O job") pelo processador do worker, uma
 * tentativa por chamada (`jobExecution(id, n)`), contra o Postgres do compose de teste: o que cada tentativa deixa no banco, a
 * métrica por resultado, o log, e o que duas execuções ao mesmo tempo e as travas fazem. O motor pela API, a prévia e as regras
 * do calendário estão em `apps/api/test/importacao.int.test.ts`.
 */

const PREFIXO = `grv${randomUUID().slice(0, 6)}`
const CABECALHO = 'inicio;fim;tipo;descricao'
const SEM_MARCAS = { transferir: [], desligar: [], encerrar: [] }
/** O fim da lista: o job desiste na última tentativa. */
const ULTIMA = TENTATIVAS_DO_JOB

interface Escola {
  readonly escolaId: string
  readonly anoId: string
  readonly coordenadorId: string
}

describe('estrutura.gravar-planilha', () => {
  const bancada = new QueueFixtures()
  const log = new InMemoryLog('worker-teste')
  const medidor = new MedidorDeTeste()
  const gravacao = criarGravacaoDaPlanilha({ banco: bancada.banco, logger: log.logger, medidor: medidor.medidor })

  afterAll(async () => {
    await medidor.encerrar()
    await bancada.fechar()
  })

  /** A escola com o ano de 2026 em curso e a coordenação que grava. */
  async function escolaNova(): Promise<Escola> {
    const escolaId = await bancada.escola()
    const { rows: ano } = await bancada.pool.query<{ id: string }>("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaId])
    const { rows: conta } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`coordenacao-${randomUUID()}@planilha.invalid`])
    const { rows: pessoa } = await bancada.pool.query<{ id: string }>(
      "insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'coordenador', 'Coordenação sintética da planilha', $2) returning id",
      [escolaId, conta[0]?.id],
    )
    return { escolaId, anoId: ano[0]?.id ?? '', coordenadorId: pessoa[0]?.id ?? '' }
  }

  /** `quantos` eventos de um dia, de `Evento 1` a `Evento n`; o `marcador` entra na descrição do que o teste quer achar. */
  function planilha(quantos: number, marcador = ''): string {
    const linhas = Array.from({ length: quantos }, (_, posicao) => `2026-06-01;2026-06-01;evento;${PREFIXO} Evento ${String(posicao + 1)}${posicao + 1 === 600 ? marcador : ''}`)
    return [CABECALHO, ...linhas].join('\n')
  }

  /** O gravar da coordenação, pelo motor (sem fila): devolve o id da importação `na_fila`. */
  function gravar(escola: Escola, texto: string): Promise<string> {
    const motor = new MotorDePlanilha(bancada.banco, { enfileirar: () => Promise.resolve(randomUUID()) })
    const contexto = { requisicaoId: randomUUID(), escolaId: escola.escolaId, usuarioId: escola.coordenadorId, papel: 'coordenador' as const, sessaoId: randomUUID(), anoLetivoId: escola.anoId }
    return runInContext(contexto, async () => (await motor.gravar('calendario', { texto, marcas: SEM_MARCAS })).id)
  }

  /** Uma tentativa do job, como o executor a entrega: no contexto da escola da linha do outbox, com o payload dado. */
  function tentar(escolaId: string, importacaoId: string, tentativa = 1): Promise<void> {
    return runInContext({ requisicaoId: randomUUID(), escolaId }, () => gravacao({ importacaoId }, jobExecution(randomUUID(), tentativa)))
  }

  async function importacao(importacaoId: string): Promise<{ estado: string; erro: string | null; linhas: unknown; marcas: unknown }> {
    const { rows } = await bancada.pool.query<{ estado: string; erro: string | null; linhas: unknown; marcas: unknown }>('select estado, erro, linhas, marcas from importacao_planilha where id = $1', [importacaoId])
    return rows[0] ?? { estado: 'sumiu', erro: null, linhas: undefined, marcas: undefined }
  }

  async function eventosDe(escola: Escola): Promise<number> {
    const { rows } = await bancada.pool.query<{ total: number }>('select count(*)::int as total from evento_calendario where ano_letivo_id = $1', [escola.anoId])
    return rows[0]?.total ?? 0
  }

  /** O que o job contou, por resultado, desde a última leitura (o medidor de teste acumula por ponto). */
  async function resultados(): Promise<Record<string, number>> {
    const pontos = await medidor.pontos('importacao.job')
    return Object.fromEntries(pontos.map(({ atributos, valor }) => [String(atributos['resultado']), valor as number]))
  }

  /** Um gatilho só do banco de teste: recusa o evento cuja descrição tem o marcador. */
  async function falharNoEventoCom(marcador: string, sqlstate?: string): Promise<void> {
    const nome = `teste_falha_${randomUUID().slice(0, 8).replaceAll('-', '')}`
    await bancada.pool.query(`create function ${nome}() returns trigger language plpgsql as $$ begin raise exception 'falha de teste'${sqlstate === undefined ? '' : ` using errcode = '${sqlstate}'`}; end $$`)
    await bancada.pool.query(`create trigger ${nome} before insert on evento_calendario for each row when (new.descricao like '%${marcador}%') execute function ${nome}()`)
    onTestFinished(async () => {
      await bancada.pool.query(`drop trigger if exists ${nome} on evento_calendario`)
      await bancada.pool.query(`drop function if exists ${nome}()`)
    })
  }

  it('o job conclui: grava na escola da linha, apaga as linhas e as marcas, mede o passo (3) e conta uma `concluida`', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, planilha(3))

    await tentar(escola.escolaId, id)

    expect(await importacao(id)).toEqual({ estado: 'concluida', erro: null, linhas: null, marcas: null })
    expect(await eventosDe(escola)).toBe(3)
    expect((await resultados())['concluida']).toBeGreaterThanOrEqual(1)
    const [duracao] = await medidor.pontos('importacao.passo3.duracao')
    expect(duracao?.valor).toMatchObject({ contagem: expect.any(Number) as number })
  })

  it('com o payload adulterado (o id da importação de outra escola), o job usa a escola da linha: `ignorada`, e a de lá segue `na_fila`', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const idDaA = await gravar(a, planilha(2))
    const antes = (await resultados())['ignorada'] ?? 0

    await tentar(b.escolaId, idDaA)

    expect((await importacao(idDaA)).estado).toBe('na_fila')
    expect(await eventosDe(a)).toBe(0)
    expect(await eventosDe(b)).toBe(0)
    expect((await resultados())['ignorada']).toBe(antes + 1)
    await tentar(a.escolaId, idDaA)
    expect(await eventosDe(a)).toBe(2)
  })

  it('[P] duas execuções do mesmo job, a segunda depois de classificar e antes de gravar: um conjunto de eventos, uma `concluida` e uma `ignorada`', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, planilha(4))
    const antes = await resultados()
    const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'evento_calendario', evento: 'insert', quando: `new.escola_id = '${escola.escolaId}'` })
    await parada.armar()
    try {
      const primeira = tentar(escola.escolaId, id)
      await parada.esperarParadas()
      // A segunda lê a importação ainda `na_fila`, classifica e espera a trava `for update` que a primeira segura.
      const segunda = tentar(escola.escolaId, id)
      await esperarNaTrava(bancada.pool, '%importacao_planilha%for update%')
      await parada.soltar()
      await Promise.all([primeira, segunda])
    } finally {
      await parada.desarmar()
    }

    expect(await eventosDe(escola)).toBe(4)
    const depois = await resultados()
    expect((depois['concluida'] ?? 0) - (antes['concluida'] ?? 0)).toBe(1)
    expect((depois['ignorada'] ?? 0) - (antes['ignorada'] ?? 0)).toBe(1)
    const { rows } = await bancada.pool.query<{ total: number }>("select count(*)::int as total from auditoria where escola_id = $1 and acao = 'planilha.gravada'", [escola.escolaId])
    expect(rows[0]?.total).toBe(1)
  })

  it('falha no segundo lote de 1.200 eventos, sempre: entre as tentativas segue `na_fila` com zero eventos, e na última sai `falhou`', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, planilha(1_200, ' BOOM'))
    await falharNoEventoCom(' BOOM')
    const antes = await resultados()

    for (let tentativa = 1; tentativa < ULTIMA; tentativa++) {
      await expect(tentar(escola.escolaId, id, tentativa)).rejects.toThrow()
      expect((await importacao(id)).estado).toBe('na_fila')
      // O primeiro lote (500) foi escrito e voltou com a transação: nada parcial.
      expect(await eventosDe(escola)).toBe(0)
    }
    await expect(tentar(escola.escolaId, id, ULTIMA)).rejects.toThrow()

    expect(await importacao(id)).toEqual({ estado: 'falhou', erro: 'erro_interno', linhas: null, marcas: null })
    expect(await eventosDe(escola)).toBe(0)
    const depois = await resultados()
    expect((depois['nova_tentativa'] ?? 0) - (antes['nova_tentativa'] ?? 0)).toBe(ULTIMA - 1)
    expect((depois['falhou'] ?? 0) - (antes['falhou'] ?? 0)).toBe(1)
    // Fechada, o job repetido não faz nada.
    await tentar(escola.escolaId, id, 1)
    expect((await importacao(id)).estado).toBe('falhou')
  })

  it('único violado no passo (3): a transação volta inteira e a importação sai `desatualizada`, sem repetir e sem evento', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, planilha(1_200, ' BOOM'))
    await falharNoEventoCom(' BOOM', '23505')

    await tentar(escola.escolaId, id, 1)

    expect(await importacao(id)).toEqual({ estado: 'desatualizada', erro: null, linhas: null, marcas: null })
    expect(await eventosDe(escola)).toBe(0)
  })

  it('ano travado por mais de 1 s no passo (3): nada parcial e `na_fila`; solto, a tentativa seguinte conclui', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, planilha(3))
    const segurador = await bancada.pool.connect()
    try {
      await segurador.query('begin')
      await segurador.query('select id from ano_letivo where id = $1 for update', [escola.anoId])
      const inicio = Date.now()
      await expect(tentar(escola.escolaId, id, 1)).rejects.toThrow()
      expect(Date.now() - inicio).toBeGreaterThanOrEqual(900)
    } finally {
      await segurador.query('rollback')
      segurador.release()
    }

    expect((await importacao(id)).estado).toBe('na_fila')
    expect(await eventosDe(escola)).toBe(0)
    await tentar(escola.escolaId, id, 2)
    expect((await importacao(id)).estado).toBe('concluida')
    expect(await eventosDe(escola)).toBe(3)
  })

  it('ano sempre travado: na última tentativa a importação sai `falhou` com `trava_esgotada`, sem evento', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, planilha(3))
    const segurador = await bancada.pool.connect()
    try {
      await segurador.query('begin')
      await segurador.query('select id from ano_letivo where id = $1 for update', [escola.anoId])
      await expect(tentar(escola.escolaId, id, ULTIMA)).rejects.toThrow()
    } finally {
      await segurador.query('rollback')
      segurador.release()
    }
    expect(await importacao(id)).toEqual({ estado: 'falhou', erro: 'trava_esgotada', linhas: null, marcas: null })
    expect(await eventosDe(escola)).toBe(0)
  })

  it('falha definitiva (a importação guardada não tem a forma do tipo): já na primeira tentativa `falhou`, e o job falha sem repetir', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, planilha(2))
    await bancada.pool.query('update importacao_planilha set linhas = $2::jsonb where id = $1', [id, JSON.stringify([{ tipo: 'inventado' }])])

    await expect(tentar(escola.escolaId, id, 1)).rejects.toBeInstanceOf(JobFailureError)

    expect(await importacao(id)).toEqual({ estado: 'falhou', erro: 'erro_interno', linhas: null, marcas: null })
    expect(await eventosDe(escola)).toBe(0)
  })

  it('falha definitiva também quando o tipo não é um que o motor grava (o `professores`, sem ano): `falhou` na primeira tentativa', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, planilha(2))
    await bancada.pool.query("update importacao_planilha set tipo = 'professores', ano_letivo_id = null where id = $1", [id])

    await expect(tentar(escola.escolaId, id, 1)).rejects.toBeInstanceOf(JobFailureError)

    expect(await importacao(id)).toEqual({ estado: 'falhou', erro: 'erro_interno', linhas: null, marcas: null })
  })

  /** Quantas vezes o passo (3) foi medido, em qualquer escola: só a execução que chega a ele mede. */
  async function passosMedidos(): Promise<number> {
    const [duracao] = await medidor.pontos('importacao.passo3.duracao')
    return typeof duracao?.valor === 'object' ? duracao.valor.contagem : 0
  }

  it('assinatura diferente antes do job: sai `desatualizada` já no passo (2), sem chegar à trava do (3), com as linhas e as marcas apagadas', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, planilha(2))
    await bancada.pool.query("insert into evento_calendario (escola_id, ano_letivo_id, tipo, inicio, fim, descricao) values ($1, $2, 'evento', '2026-08-01', '2026-08-01', $3)", [escola.escolaId, escola.anoId, `${PREFIXO} à mão`])
    const antes = (await resultados())['desatualizada'] ?? 0
    const medidos = await passosMedidos()

    await tentar(escola.escolaId, id)

    expect(await importacao(id)).toEqual({ estado: 'desatualizada', erro: null, linhas: null, marcas: null })
    expect(await eventosDe(escola)).toBe(1)
    expect((await resultados())['desatualizada']).toBe(antes + 1)
    expect(await passosMedidos()).toBe(medidos)
  })

  it('ano encerrado antes do job: sai `desatualizada` no passo (2), sem chegar à trava do (3) e sem evento no ano encerrado', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, planilha(2))
    await bancada.pool.query("update ano_letivo set situacao = 'encerrado' where id = $1", [escola.anoId])
    const medidos = await passosMedidos()

    await tentar(escola.escolaId, id)

    expect(await importacao(id)).toEqual({ estado: 'desatualizada', erro: null, linhas: null, marcas: null })
    expect(await eventosDe(escola)).toBe(0)
    expect(await passosMedidos()).toBe(medidos)
  })

  it('assinatura que muda entre o passo (2) e o (3): o job que esperava a trava da importação relê, vê a diferença e sai `desatualizada`, sem gravar', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, planilha(2))
    const segurador = await bancada.pool.connect()
    let job: Promise<void>
    try {
      await segurador.query('begin')
      await segurador.query('select id from importacao_planilha where id = $1 for update', [id])
      job = tentar(escola.escolaId, id)
      // O job classificou (2) e espera a trava do (3): a mão põe um evento agora.
      await esperarNaTrava(bancada.pool, '%importacao_planilha%for update%')
      await bancada.pool.query("insert into evento_calendario (escola_id, ano_letivo_id, tipo, inicio, fim, descricao) values ($1, $2, 'evento', '2026-08-01', '2026-08-01', $3)", [escola.escolaId, escola.anoId, `${PREFIXO} à mão`])
    } finally {
      await segurador.query('rollback')
      segurador.release()
    }
    await job

    expect(await importacao(id)).toEqual({ estado: 'desatualizada', erro: null, linhas: null, marcas: null })
    expect(await eventosDe(escola)).toBe(1)
  })

  it('o repository: as trocas de estado só valem para a `na_fila` e na escola do contexto, e o calendário só é lido e apagado na escola e no ano certos', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const idDaA = await gravar(a, planilha(2))
    const noContexto = <T>(escola: Escola, corpo: (repositorio: ImportacaoRepository) => Promise<T>): Promise<T> =>
      runInContext({ requisicaoId: randomUUID(), escolaId: escola.escolaId }, () => corpo(new ImportacaoRepository(bancada.banco)))

    // Na escola de B, a importação de A não é trocada.
    expect(await noContexto(b, (repositorio) => repositorio.concluir(idDaA, { entram: 0, ja_existem: 0, eventos_removidos: 0 }))).toBe(false)
    expect(await noContexto(b, (repositorio) => repositorio.desatualizar(idDaA))).toBe(false)
    expect(await noContexto(b, (repositorio) => repositorio.falhar(idDaA, 'erro_interno'))).toBe(false)
    expect((await importacao(idDaA)).estado).toBe('na_fila')

    // A leitura, com e sem trava, é da escola do contexto: na de B, a importação de A não é achada.
    expect(await noContexto(b, (repositorio) => repositorio.paraExecutar(idDaA))).toBeUndefined()
    expect(await noContexto(a, (repositorio) => repositorio.paraExecutar(idDaA))).toMatchObject({ id: idDaA, estado: 'na_fila' })
    // O ano pelo id, com e sem a trava `FOR SHARE`, é da escola do contexto: o ano de B, no contexto de A, não é achado.
    expect(await noContexto(a, (repositorio) => repositorio.anoPorId(b.anoId))).toBeUndefined()
    expect(await noContexto(a, (repositorio) => repositorio.anoPorId(b.anoId, true))).toBeUndefined()
    expect(await noContexto(b, (repositorio) => repositorio.anoPorId(b.anoId))).toMatchObject({ id: b.anoId })
    expect(await noContexto(b, (repositorio) => repositorio.anoPorId(b.anoId, true))).toMatchObject({ id: b.anoId })

    // Fechada, nenhuma troca a reabre nem a troca por outra.
    expect(await noContexto(a, (repositorio) => repositorio.concluir(idDaA, { entram: 2, ja_existem: 0, eventos_removidos: 0 }))).toBe(true)
    expect(await noContexto(a, (repositorio) => repositorio.concluir(idDaA, { entram: 9, ja_existem: 0, eventos_removidos: 0 }))).toBe(false)
    expect(await noContexto(a, (repositorio) => repositorio.desatualizar(idDaA))).toBe(false)
    expect(await noContexto(a, (repositorio) => repositorio.falhar(idDaA, 'erro_interno'))).toBe(false)
    expect(await importacao(idDaA)).toEqual({ estado: 'concluida', erro: null, linhas: null, marcas: null })
    const { rows: resumo } = await bancada.pool.query<{ resumo: unknown }>('select resumo from importacao_planilha where id = $1', [idDaA])
    expect(resumo[0]?.resumo).toEqual({ entram: 2, ja_existem: 0, eventos_removidos: 0 })

    // O calendário: o ano de B, lido e apagado no contexto de A, não aparece nem sai; o ano de A, com os ids de outro ano, também não.
    await noContexto(b, (repositorio) => repositorio.inserirEventos(b.anoId, [{ tipo: 'evento', inicio: '2026-06-01', fim: '2026-06-01', descricao: `${PREFIXO} da B` }]))
    const daB = await noContexto(b, (repositorio) => repositorio.eventosDoAno(b.anoId))
    expect(daB).toHaveLength(1)
    expect(await noContexto(a, (repositorio) => repositorio.eventosDoAno(b.anoId))).toEqual([])
    await noContexto(a, (repositorio) => repositorio.apagarEventos(b.anoId, daB.map((evento) => evento.id)))
    expect(await eventosDe(b)).toBe(1)
    // Inserir no ano de B com o contexto de A é recusado (a FK composta do evento prende o ano à escola) e nada entra em nenhuma das duas.
    await expect(noContexto(a, (repositorio) => repositorio.inserirEventos(b.anoId, [{ tipo: 'evento', inicio: '2026-06-03', fim: '2026-06-03', descricao: `${PREFIXO} de A no ano de B` }]))).rejects.toThrow()
    expect(await eventosDe(b)).toBe(1)
    expect(await eventosDe(a)).toBe(0)
    // O mesmo na escola de A: o evento de outro ano dela, pedido com o ano em curso, não sai.
    const { rows: outroAno } = await bancada.pool.query<{ id: string }>("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2027, '2027-02-01', '2027-12-15', 'planejado') returning id", [a.escolaId])
    await noContexto(a, (repositorio) => repositorio.inserirEventos(outroAno[0]?.id ?? '', [{ tipo: 'evento', inicio: '2027-06-02', fim: '2027-06-02', descricao: `${PREFIXO} de 2027` }]))
    const de2027 = await noContexto(a, (repositorio) => repositorio.eventosDoAno(outroAno[0]?.id ?? ''))
    await noContexto(a, (repositorio) => repositorio.apagarEventos(a.anoId, de2027.map((evento) => evento.id)))
    expect(await noContexto(a, (repositorio) => repositorio.eventosDoAno(outroAno[0]?.id ?? ''))).toHaveLength(1)
    // Na escola e no ano certos, apaga.
    await noContexto(b, (repositorio) => repositorio.apagarEventos(b.anoId, daB.map((evento) => evento.id)))
    expect(await eventosDe(b)).toBe(0)
  })

  it('o log do job traz só ids, contagem de tentativa, estado e código: nunca a descrição do evento nem o texto do erro do banco', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, planilha(2))
    await tentar(escola.escolaId, id)
    const falha = await gravar(await escolaNova(), planilha(1_200, ' BOOM'))
    await falharNoEventoCom(' BOOM')
    const escolaDaFalha = (await bancada.pool.query<{ escola_id: string }>('select escola_id from importacao_planilha where id = $1', [falha])).rows[0]?.escola_id ?? ''
    await expect(tentar(escolaDaFalha, falha, 1)).rejects.toThrow()
    await expect(tentar(escolaDaFalha, falha, ULTIMA)).rejects.toThrow()

    const registros = log.registros().filter((registro) => String(registro['evento']).startsWith('importacao.'))
    expect(registros.map((registro) => registro['evento'])).toEqual(expect.arrayContaining(['importacao.job_terminou', 'importacao.job_repetira', 'importacao.job_falhou']))
    const CHAVES_PERMITIDAS = new Set(['evento', 'importacaoId', 'estado', 'tentativa', 'erro', 'codigo', 'servico', 'nivel', 'level', 'time', 'tempo', 'requisicaoId', 'escolaId', 'msg', 'mensagem', 'hostname', 'pid', 'v'])
    for (const registro of registros) {
      for (const chave of Object.keys(registro)) expect(CHAVES_PERMITIDAS.has(chave), `chave de log ${chave}`).toBe(true)
    }
    const tudo = log.linhas.join('\n')
    expect(tudo).not.toContain(PREFIXO)
    expect(tudo).not.toContain('falha de teste')
    expect(registros.find((registro) => registro['evento'] === 'importacao.job_falhou' && registro['importacaoId'] === falha)).toMatchObject({ importacaoId: falha, codigo: 'erro_interno', estado: 'falhou', tentativa: ULTIMA })
  })
})
