import 'reflect-metadata'
import { chaveDoTemporario, InMemoryFileStorage, JobOutboxRepository, runInContext, type FileStorage } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { InMemoryLog, QueueFixtures, urlRedisDeFila } from '../../worker/test/queue.fixture.js'
import { abrirArmazemDeOperacao } from '../src/ops/armazem-de-operacao.js'
import { abrirFilaDeOperacao, type FilaDeOperacao } from '../src/ops/fila-de-jobs.js'
import { executarOpsDescartarJob } from '../src/ops/descartar-job.js'
import { executarOpsJobsQueFalharam } from '../src/ops/jobs-que-falharam.js'
import { executarOpsReprocessarJob } from '../src/ops/reprocessar-job.js'
import { JobsQueFalharamRepository } from '../src/operacao/jobs-que-falharam.repository.js'

/**
 * `ops:jobs-que-falharam`, `ops:reprocessar-job` e `ops:descartar-job` (ingestao-do-material, tarefa 3.0; onda 3b, 46.0), rodando de verdade
 * contra o Postgres e o Redis de fila do compose de teste: o comando abre o banco de operação que ele mesmo abre, e a fila (com o prefixo da
 * bancada) e o storage (o armazém falso) vêm por injeção. Cada caso cria as escolas e os jobs que usa: o banco de teste guarda os de outras execuções.
 */

const OPERADOR = 'operador-teste'
const SENTINELA = 'SENTINELA-DO-DADOS-QUE-NAO-SAI'
const AMBIENTE = { ...lerAmbienteDeTeste(), OPERADOR }

interface Execucao {
  readonly codigo: number
  readonly saida: string
  readonly erro: string
}

interface JobRow {
  readonly estado: string
  readonly codigo_falha: string | null
  readonly concluido_em: Date | null
  readonly iniciado_em: Date | null
  readonly reservado_ate: Date | null
}

interface AuditoriaDoJob {
  readonly acao: string
  readonly escola_id: string | null
  readonly entidade: string
  readonly entidade_id: string
  readonly autor_operador: string | null
  readonly autor_usuario_id: string | null
  readonly antes: unknown
  readonly depois: unknown
}

/** A fila que o caso não pode tocar: a recusa vem antes dela. */
const FILA_PROIBIDA: FilaDeOperacao = {
  tirarCopiaDaFalha: () => Promise.reject(new Error('o comando tocou a fila antes de recusar')),
  fechar: () => Promise.resolve(),
}

beforeAll(() => {
  // Despachante ou worker do compose de pé disputaria as linhas deste arquivo.
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('ops:jobs-que-falharam, ops:reprocessar-job e ops:descartar-job (46.0)', () => {
  const bancada = new QueueFixtures()
  const armazem = new InMemoryFileStorage()
  let escolaA: string
  let escolaB: string
  let disciplinaA: string
  let disciplinaB: string

  beforeAll(async () => {
    escolaA = await bancada.escola()
    escolaB = await bancada.escola()
    const disciplinaDa = async (escolaId: string): Promise<string> => (await bancada.pool.query<{ id: string }>("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [escolaId])).rows[0]?.id ?? ''
    disciplinaA = await disciplinaDa(escolaA)
    disciplinaB = await disciplinaDa(escolaB)
  })

  beforeEach(async () => {
    // Cada caso começa sem job pendente de outro: o despachante e o worker da bancada só veem o que o caso grava.
    await bancada.limparRegistro()
  })

  afterAll(async () => {
    await bancada.fechar()
  })

  const naEscola = <T>(escolaId: string, funcao: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)

  /** O job de `job_registro` direto no estado dado, como o worker o deixaria; o `dados` leva uma sentinela que nenhuma saída pode repetir. */
  async function job(
    escolaId: string | null,
    tipo: string,
    opcoes: { estado?: string; dados?: Record<string, unknown>; fila?: string; chave?: string; semConcluido?: true } = {},
  ): Promise<string> {
    // O código e a data só existem no job que falhou; `semConcluido` tira a data, como a linha de um job antigo.
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into job_registro (escola_id, fila, prioridade, tipo, dados, estado, codigo_falha, concluido_em, chave_idempotencia)
       values ($1, $2, 2, $3, $4::jsonb, $5, case when $5 = 'falhou' then 'ERRO_INTERNO' end, case when $5 = 'falhou' and not $6::boolean then now() end, $7) returning id`,
      [escolaId, opcoes.fila ?? 'normal', tipo, JSON.stringify({ sentinela: SENTINELA, ...opcoes.dados }), opcoes.estado ?? 'falhou', opcoes.semConcluido === true, opcoes.chave ?? null],
    )
    return rows[0]?.id ?? ''
  }

  async function linhaDoJob(id: string): Promise<JobRow | undefined> {
    const { rows } = await bancada.pool.query<JobRow>('select estado, codigo_falha, concluido_em, iniciado_em, reservado_ate from job_registro where id = $1', [id])
    return rows[0]
  }

  async function auditoriaDoJob(id: string): Promise<AuditoriaDoJob[]> {
    const { rows } = await bancada.pool.query<AuditoriaDoJob>(
      `select acao, escola_id, entidade, entidade_id, autor_operador, autor_usuario_id, antes, depois from auditoria where entidade_id = $1 and acao in ('job.reprocessado', 'job.descartado') order by em`,
      [id],
    )
    return rows
  }

  /** O material `processando` da escola, com o PDF no armazém: o que o envio da API deixa. */
  async function material(escolaId: string, disciplinaId: string, opcoes: { estado?: string; objeto?: boolean; guardaEm?: FileStorage } = {}): Promise<string> {
    const estado = opcoes.estado ?? 'processando'
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas)
       values ($1, $2, 'Título que nunca sai', 'escola', 'autoria_da_escola', true, md5(random()::text) || md5(random()::text), 1000, $3, case when $3 = 'pronto' then 1 else null end) returning id`,
      [escolaId, disciplinaId, estado],
    )
    const id = rows[0]?.id ?? ''
    if (opcoes.objeto ?? true) await naEscola(escolaId, () => (opcoes.guardaEm ?? armazem).guardarBytes(chaveDoTemporario(id), new Uint8Array([1, 2, 3]), { prazoMs: 5_000 }))
    return id
  }

  const objetoExiste = (escolaId: string, materialId: string): Promise<boolean> => naEscola(escolaId, () => armazem.existe(chaveDoTemporario(materialId)))

  async function linhaDoMaterial(id: string): Promise<{ estado: string; falha: string | null; processado_em: Date | null; objeto_apagado_em: Date | null }> {
    const { rows } = await bancada.pool.query<{ estado: string; falha: string | null; processado_em: Date | null; objeto_apagado_em: Date | null }>('select estado, falha, processado_em, objeto_apagado_em from material where id = $1', [id])
    return rows[0] ?? { estado: 'inexistente', falha: null, processado_em: null, objeto_apagado_em: null }
  }

  const terminalEm = (execucao: { saida: string; erro: string }) => ({ saida: (texto: string) => (execucao.saida += texto), erro: (texto: string) => (execucao.erro += texto) })

  async function listar(argumentos: string[] = []): Promise<Execucao> {
    const execucao = { saida: '', erro: '' }
    const codigo = await executarOpsJobsQueFalharam(argumentos, AMBIENTE, terminalEm(execucao))
    return { codigo, ...execucao }
  }

  async function reprocessar(argumentos: string[], fila?: FilaDeOperacao): Promise<Execucao> {
    const execucao = { saida: '', erro: '' }
    const codigo = await executarOpsReprocessarJob(argumentos, AMBIENTE, terminalEm(execucao), undefined, () => fila ?? abrirFilaDeOperacao(urlRedisDeFila(), { prefixo: bancada.prefixo }))
    return { codigo, ...execucao }
  }

  async function descartar(argumentos: string[], doArmazem: FileStorage = armazem): Promise<Execucao> {
    const execucao = { saida: '', erro: '' }
    const codigo = await executarOpsDescartarJob(argumentos, AMBIENTE, terminalEm(execucao), undefined, () => ({ armazem: doArmazem, encerrar: () => undefined }))
    return { codigo, ...execucao }
  }

  describe('reprocessar', () => {
    it('um tipo aceito: a cópia failed sai, o job conclui, e a reconciliação não o republica nem o dá por falho', async () => {
      const id = await bancada.enfileirar(escolaA, { dados: { cpuMs: 0, falhar: false } })
      let falhar = true
      let liberar: () => void = () => undefined
      const processarAgora = new Promise<void>((resolver) => (liberar = resolver))
      const processadores = { sintetico: () => (falhar ? Promise.reject(new Error('falha do teste')) : processarAgora) }
      bancada.worker(new InMemoryLog('worker'), { processadores })
      // Publicado como o despachante faz, mas com uma tentativa só: a falha é definitiva e a fila guarda a cópia `failed`.
      await bancada.reservar(escolaA)
      await bancada.fila.add('sintetico', { escolaId: escolaA, requisicaoId: null }, { jobId: id, attempts: 1 })
      await expect.poll(async () => (await bancada.estado(id))?.estado, { timeout: 30_000, interval: 100 }).toBe('falhou')
      expect(await (await bancada.fila.getJob(id))?.getState()).toBe('failed')

      falhar = false
      const execucao = await reprocessar([id, '--chamado', '4711'])
      expect(execucao).toEqual({ codigo: 0, saida: `${JSON.stringify({ reprocessado: id, tipo: 'sintetico', chamado: 4711 })}\n`, erro: '' })

      // A linha voltou a pendente, sem a falha; a cópia `failed` saiu da fila.
      expect(await linhaDoJob(id)).toMatchObject({ estado: 'aguardando', codigo_falha: null, concluido_em: null, iniciado_em: null, reservado_ate: null })
      expect(await bancada.fila.getJob(id)).toBeUndefined()

      const montado = bancada.despachante(new InMemoryLog('despachante'))
      expect(await montado.despachante.rodada()).toBe(1)
      await expect.poll(async () => (await bancada.estado(id))?.estado, { timeout: 30_000, interval: 100 }).toBe('ativo')
      // O job está na fila, ativo, há tempo o bastante para a reconciliação o conferir: a fila o tem, e nada muda.
      await bancada.pool.query(`update job_registro set iniciado_em = now() - interval '5 minutes', reservado_ate = now() - interval '5 minutes' where id = $1`, [id])
      expect(await montado.reconciliacao.reconciliar()).toMatchObject({ republicados: [], falhasRegistradas: [], semConfirmacao: 0 })
      expect((await bancada.estado(id))?.estado).toBe('ativo')

      liberar()
      await expect.poll(async () => (await bancada.estado(id))?.estado, { timeout: 30_000, interval: 100 }).toBe('concluido')
      expect(await auditoriaDoJob(id)).toEqual([
        { acao: 'job.reprocessado', escola_id: escolaA, entidade: 'job', entidade_id: id, autor_operador: OPERADOR, autor_usuario_id: null, antes: null, depois: { tipo: 'sintetico', chamado: 4711 } },
      ])
    }, 90_000)

    it('concorrência: dois comandos sobre o mesmo job, em Promise.all, e só um reprocessa', async () => {
      const id = await job(escolaA, 'estrutura.gravar-planilha')
      const [primeiro, segundo] = await Promise.all([reprocessar([id, '--chamado', '1']), reprocessar([id, '--chamado', '2'])])
      const codigos = [primeiro.codigo, segundo.codigo].sort()
      expect(codigos).toEqual([0, 1])
      const recusado = primeiro.codigo === 1 ? primeiro : segundo
      expect(recusado).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO: job não encontrado entre os que falharam\n' })
      expect((await linhaDoJob(id))?.estado).toBe('aguardando')
      expect(await auditoriaDoJob(id)).toHaveLength(1)
    })

    it.each(['ia.gerar-atividade', 'ia.responder-tutor'])('recusa %s: o comando não toca a fila, e a linha segue falhou', async (tipo) => {
      const id = await job(escolaA, tipo)
      expect(await reprocessar([id, '--chamado', '9'], FILA_PROIBIDA)).toEqual({ codigo: 1, saida: '', erro: 'tipo de job que a operação não mexe: IA ou pedido do titular\n' })
      expect((await linhaDoJob(id))?.estado).toBe('falhou')
      expect(await auditoriaDoJob(id)).toEqual([])
    })

    it.each(['titular.montar-arquivo', 'titular.eliminar'])('recusa %s: o pedido do titular foi enfileirado uma vez só e tem o caminho dele', async (tipo) => {
      const id = await job(escolaA, tipo)
      expect(await reprocessar([id, '--chamado', '9'], FILA_PROIBIDA)).toEqual({ codigo: 1, saida: '', erro: 'tipo de job que a operação não mexe: IA ou pedido do titular\n' })
      expect((await linhaDoJob(id))?.estado).toBe('falhou')
      expect(await auditoriaDoJob(id)).toEqual([])
    })

    it('recusa material.extrair-pdf com "Tentar de novo é envio novo", e o material e o objeto ficam como estavam', async () => {
      const materialId = await material(escolaA, disciplinaA)
      const id = await job(escolaA, 'material.extrair-pdf', { dados: { materialId }, fila: 'pdf' })
      expect(await reprocessar([id, '--chamado', '9'], FILA_PROIBIDA)).toEqual({ codigo: 1, saida: '', erro: 'Tentar de novo é envio novo\n' })
      expect((await linhaDoJob(id))?.estado).toBe('falhou')
      expect((await linhaDoMaterial(materialId)).estado).toBe('processando')
      expect(await objetoExiste(escolaA, materialId)).toBe(true)
      expect(await auditoriaDoJob(id)).toEqual([])
    })

    it('job sem escola (sistema.*): recusado antes de tocar a linha, a fila e a auditoria', async () => {
      const id = await job(null, 'sistema.expurgar-jobs')
      expect(await reprocessar([id, '--chamado', '9'], FILA_PROIBIDA)).toEqual({ codigo: 1, saida: '', erro: 'o job não tem escola: reprocessar e descartar job de rotina do sistema ainda não existe\n' })
      expect((await linhaDoJob(id))?.estado).toBe('falhou')
      expect(await auditoriaDoJob(id)).toEqual([])
    })

    it.each(['aguardando', 'publicado', 'ativo', 'concluido'])('job %s: recusado, a fila não é tocada e a linha não muda', async (estado) => {
      const id = await job(escolaA, 'estrutura.gravar-planilha', { estado })
      const antes = await linhaDoJob(id)
      expect(await reprocessar([id, '--chamado', '9'], FILA_PROIBIDA)).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO: job não encontrado entre os que falharam\n' })
      expect(await linhaDoJob(id)).toEqual(antes)
      expect(await auditoriaDoJob(id)).toEqual([])
    })

    it('job que não existe e job que não falhou: a mesma resposta', async () => {
      const existente = await job(escolaB, 'estrutura.gravar-planilha', { estado: 'aguardando' })
      for (const id of [randomUUID(), existente]) {
        expect(await reprocessar([id, '--chamado', '9'], FILA_PROIBIDA)).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO: job não encontrado entre os que falharam\n' })
      }
    })

    it('o job falhou da escola B reprocessa no contexto da B: a linha volta a aguardando e a auditoria fica na escola B', async () => {
      const id = await job(escolaB, 'estrutura.gravar-planilha')
      expect((await reprocessar([id, '--chamado', '8'])).codigo).toBe(0)
      expect((await linhaDoJob(id))?.estado).toBe('aguardando')
      expect((await auditoriaDoJob(id)).map((registro) => [registro.acao, registro.escola_id])).toEqual([['job.reprocessado', escolaB]])
    })

    it('a chave de idempotência já tomada por outro job em andamento: CONFLITO, e a linha segue falhou', async () => {
      const chave = `expurgo:${randomUUID()}`
      const falho = await job(escolaA, 'retencao.expurgar-escola', { chave })
      const emAndamento = await job(escolaA, 'retencao.expurgar-escola', { estado: 'aguardando', chave })
      expect(await reprocessar([falho, '--chamado', '9'])).toEqual({ codigo: 1, saida: '', erro: 'CONFLITO: o job já existe em andamento, ou a fila ainda o tem como ativo\n' })
      expect((await linhaDoJob(falho))?.estado).toBe('falhou')
      expect((await linhaDoJob(emAndamento))?.estado).toBe('aguardando')
      expect(await auditoriaDoJob(falho)).toEqual([])
    })

    it('a fila ainda tem o job como ativo: CONFLITO, nada muda', async () => {
      const id = await bancada.enfileirar(escolaA, { dados: { cpuMs: 0, falhar: false } })
      await bancada.reservar(escolaA)
      // A linha diz `falhou`, mas a fila tem o job esperando: a linha está desatualizada.
      await bancada.fila.add('sintetico', { escolaId: escolaA, requisicaoId: null }, { jobId: id, attempts: 1, delay: 60_000 })
      await bancada.pool.query(`update job_registro set estado = 'falhou', codigo_falha = 'ERRO_INTERNO', concluido_em = now() where id = $1`, [id])
      expect(await reprocessar([id, '--chamado', '9'])).toEqual({ codigo: 1, saida: '', erro: 'CONFLITO: o job já existe em andamento, ou a fila ainda o tem como ativo\n' })
      expect((await linhaDoJob(id))?.estado).toBe('falhou')
      expect(await bancada.fila.getJob(id)).toBeDefined()
    })
  })

  describe('descartar', () => {
    it('o PDF: o material fecha em falhou, o objeto sai do storage, a linha sai e a auditoria guarda o chamado', async () => {
      const materialId = await material(escolaA, disciplinaA)
      const id = await job(escolaA, 'material.extrair-pdf', { dados: { materialId }, fila: 'pdf' })
      expect(await objetoExiste(escolaA, materialId)).toBe(true)

      const execucao = await descartar([id, '--chamado', '4712'])

      expect(execucao).toEqual({ codigo: 0, saida: `${JSON.stringify({ descartado: id, tipo: 'material.extrair-pdf', chamado: 4712, materialFechado: true, objetoApagado: true })}\n`, erro: '' })
      expect(await linhaDoMaterial(materialId)).toMatchObject({ estado: 'falhou', falha: 'extracao_falhou' })
      expect((await linhaDoMaterial(materialId)).processado_em).not.toBeNull()
      expect((await linhaDoMaterial(materialId)).objeto_apagado_em).not.toBeNull()
      expect(await objetoExiste(escolaA, materialId)).toBe(false)
      expect(await linhaDoJob(id)).toBeUndefined()
      expect(await auditoriaDoJob(id)).toEqual([
        { acao: 'job.descartado', escola_id: escolaA, entidade: 'job', entidade_id: id, autor_operador: OPERADOR, autor_usuario_id: null, antes: null, depois: { tipo: 'material.extrair-pdf', chamado: 4712 } },
      ])
    })

    it('o storage que recusa o apagar: o material fecha, o comando diz objetoApagado false, e o objeto fica para a varredura', async () => {
      const materialId = await material(escolaA, disciplinaA)
      const id = await job(escolaA, 'material.extrair-pdf', { dados: { materialId }, fila: 'pdf' })
      const semApagar: FileStorage = Object.assign(Object.create(armazem) as FileStorage, { apagar: () => Promise.reject(new Error('storage fora com a chave material-temporario/x')) })

      const execucao = await descartar([id, '--chamado', '4713'], semApagar)

      expect(execucao).toEqual({ codigo: 0, saida: `${JSON.stringify({ descartado: id, tipo: 'material.extrair-pdf', chamado: 4713, materialFechado: true, objetoApagado: false })}\n`, erro: '' })
      expect(await linhaDoMaterial(materialId)).toMatchObject({ estado: 'falhou', objeto_apagado_em: null })
      expect(await objetoExiste(escolaA, materialId)).toBe(true)
      expect(await linhaDoJob(id)).toBeUndefined()
    })

    it('o material que já saiu de processando não é tocado, e o objeto dele fica', async () => {
      const materialId = await material(escolaA, disciplinaA, { estado: 'pronto' })
      const id = await job(escolaA, 'material.extrair-pdf', { dados: { materialId }, fila: 'pdf' })
      const execucao = await descartar([id, '--chamado', '4714'])
      expect(JSON.parse(execucao.saida)).toMatchObject({ descartado: id, materialFechado: false, objetoApagado: false })
      expect((await linhaDoMaterial(materialId)).estado).toBe('pronto')
      expect(await objetoExiste(escolaA, materialId)).toBe(true)
      expect(await linhaDoJob(id)).toBeUndefined()
    })

    it('isolamento: o descarte marca só na escola do job, e o material da B com o mesmo id do dados não muda', async () => {
      // O job da A aponta, no dados, o id de um material que só a B tem: o comando age no contexto da A e não o alcança.
      const daB = await material(escolaB, disciplinaB)
      const id = await job(escolaA, 'material.extrair-pdf', { dados: { materialId: daB }, fila: 'pdf' })

      const execucao = await descartar([id, '--chamado', '4715'])

      expect(JSON.parse(execucao.saida)).toMatchObject({ descartado: id, materialFechado: false, objetoApagado: false })
      expect(await linhaDoMaterial(daB)).toMatchObject({ estado: 'processando', falha: null, processado_em: null })
      expect(await objetoExiste(escolaB, daB)).toBe(true)
      expect(await linhaDoJob(id)).toBeUndefined()
    })

    it('só o job de PDF mexe no material: um retencao.* com o materialId no dados descarta a linha e deixa o material e o objeto como estavam', async () => {
      const materialId = await material(escolaA, disciplinaA)
      const id = await job(escolaA, 'retencao.expurgar-escola', { dados: { materialId } })
      const execucao = await descartar([id, '--chamado', '6'])
      expect(JSON.parse(execucao.saida)).toMatchObject({ descartado: id, materialFechado: false, objetoApagado: false })
      expect((await linhaDoMaterial(materialId)).estado).toBe('processando')
      expect(await objetoExiste(escolaA, materialId)).toBe(true)
      expect(await linhaDoJob(id)).toBeUndefined()
    })

    it('o armazém de operação, com o ambiente de teste (só a porta do host), alcança o storage: guarda, lê e apaga o objeto do material', async () => {
      const materialId = randomUUID()
      const { armazem: doStorage, encerrar } = abrirArmazemDeOperacao(AMBIENTE)
      try {
        await naEscola(escolaA, async () => {
          await doStorage.guardarBytes(chaveDoTemporario(materialId), new Uint8Array([7, 8, 9]), { prazoMs: 10_000 })
          expect(await doStorage.existe(chaveDoTemporario(materialId))).toBe(true)
          await doStorage.apagar(chaveDoTemporario(materialId))
          expect(await doStorage.existe(chaveDoTemporario(materialId))).toBe(false)
        })
      } finally {
        encerrar()
      }
    })

    it.each(['retencao.expurgar-escola', 'estrutura.gravar-planilha'])('%s descarta: a linha sai, com a auditoria da escola', async (tipo) => {
      const id = await job(escolaA, tipo)
      expect(await descartar([id, '--chamado', '5'])).toEqual({
        codigo: 0,
        saida: `${JSON.stringify({ descartado: id, tipo, chamado: 5, materialFechado: false, objetoApagado: false })}\n`,
        erro: '',
      })
      expect(await linhaDoJob(id)).toBeUndefined()
      // A auditoria fica na escola da linha, e não sem escola.
      expect((await auditoriaDoJob(id)).map((registro) => [registro.acao, registro.escola_id])).toEqual([['job.descartado', escolaA]])
    })

    it('concorrência: dois descartar sobre o mesmo job de PDF, em Promise.all: só um descarta, uma auditoria, e o material fecha uma vez', async () => {
      const materialId = await material(escolaA, disciplinaA)
      const id = await job(escolaA, 'material.extrair-pdf', { dados: { materialId }, fila: 'pdf' })
      const [primeiro, segundo] = await Promise.all([descartar([id, '--chamado', '1']), descartar([id, '--chamado', '2'])])
      expect([primeiro.codigo, segundo.codigo].sort()).toEqual([0, 1])
      const recusado = primeiro.codigo === 1 ? primeiro : segundo
      expect(recusado).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO: job não encontrado entre os que falharam\n' })
      expect(await linhaDoJob(id)).toBeUndefined()
      expect((await linhaDoMaterial(materialId)).estado).toBe('falhou')
      expect(await objetoExiste(escolaA, materialId)).toBe(false)
      expect(await auditoriaDoJob(id)).toHaveLength(1)
    })

    it.each(['ia.gerar-atividade', 'titular.montar-arquivo', 'titular.eliminar'])('recusa %s: a linha segue falhou', async (tipo) => {
      const id = await job(escolaA, tipo)
      expect(await descartar([id, '--chamado', '9'])).toEqual({ codigo: 1, saida: '', erro: 'tipo de job que a operação não mexe: IA ou pedido do titular\n' })
      expect((await linhaDoJob(id))?.estado).toBe('falhou')
      expect(await auditoriaDoJob(id)).toEqual([])
    })

    it('job sem escola (sistema.*): recusado, a linha segue falhou', async () => {
      const id = await job(null, 'sistema.expurgar-acesso')
      expect(await descartar([id, '--chamado', '9'])).toEqual({ codigo: 1, saida: '', erro: 'o job não tem escola: reprocessar e descartar job de rotina do sistema ainda não existe\n' })
      expect((await linhaDoJob(id))?.estado).toBe('falhou')
      expect(await auditoriaDoJob(id)).toEqual([])
    })

    it.each(['aguardando', 'publicado', 'ativo'])('job %s: recusado; a linha, o material e o objeto ficam intactos', async (estado) => {
      const materialId = await material(escolaA, disciplinaA)
      const id = await job(escolaA, 'material.extrair-pdf', { estado, dados: { materialId }, fila: 'pdf' })
      expect(await descartar([id, '--chamado', '9'])).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO: job não encontrado entre os que falharam\n' })
      expect((await linhaDoJob(id))?.estado).toBe(estado)
      expect((await linhaDoMaterial(materialId)).estado).toBe('processando')
      expect(await objetoExiste(escolaA, materialId)).toBe(true)
      expect(await auditoriaDoJob(id)).toEqual([])
    })
  })

  describe('o repository: a condição do estado e o escopo, cada um por si', () => {
    const noContexto = <T>(escolaId: string, funcao: () => Promise<T>): Promise<T> => naEscola(escolaId, funcao)

    it('travarFalho só acha o job falhou, e devolve o id do material mas nunca o resto do dados', async () => {
      const materialId = randomUUID()
      const falho = await job(escolaA, 'material.extrair-pdf', { dados: { materialId }, fila: 'pdf' })
      const pendente = await job(escolaA, 'estrutura.gravar-planilha', { estado: 'aguardando' })
      const repository = new JobsQueFalharamRepository(bancada.banco)
      expect(await repository.travarFalho(pendente)).toBeUndefined()
      const achado = await repository.travarFalho(falho)
      expect(achado).toMatchObject({ id: falho, escolaId: escolaA, tipo: 'material.extrair-pdf', fila: 'pdf', materialId })
      expect(JSON.stringify(achado)).not.toContain(SENTINELA)
      expect(await repository.travarFalho(randomUUID())).toBeUndefined()
    })

    it('reabrirFalho e descartarFalho só mudam o job falhou da escola do contexto: o aguardando e o job de outra escola ficam como estavam', async () => {
      const pendente = await job(escolaA, 'estrutura.gravar-planilha', { estado: 'aguardando' })
      const falhoDaA = await job(escolaA, 'estrutura.gravar-planilha')
      // O que a tentativa anterior deixou: o início, a reserva e a criação de há dois dias.
      await bancada.pool.query(`update job_registro set criado_em = now() - interval '2 days', iniciado_em = now() - interval '2 days', reservado_ate = now() - interval '2 days' where id = $1`, [falhoDaA])
      const outro = new JobOutboxRepository(bancada.banco)
      // O job que não está falhou: nenhum dos dois o toca.
      expect(await noContexto(escolaA, () => outro.reabrirFalho(pendente))).toBe(false)
      expect(await noContexto(escolaA, () => outro.descartarFalho(pendente))).toBe(false)
      expect((await linhaDoJob(pendente))?.estado).toBe('aguardando')
      // O job falhou da A, com a escola B no contexto: nenhum dos dois o alcança.
      expect(await noContexto(escolaB, () => outro.reabrirFalho(falhoDaA))).toBe(false)
      expect(await noContexto(escolaB, () => outro.descartarFalho(falhoDaA))).toBe(false)
      expect((await linhaDoJob(falhoDaA))?.estado).toBe('falhou')
      // Na escola do job, passam.
      expect(await noContexto(escolaA, () => outro.reabrirFalho(falhoDaA))).toBe(true)
      expect(await linhaDoJob(falhoDaA)).toMatchObject({ estado: 'aguardando', codigo_falha: null, concluido_em: null, iniciado_em: null, reservado_ate: null })
      // O `criado_em` volta a ser agora: a espera do job reprocessado não conta os dias em que ele esteve falho.
      const { rows: idade } = await bancada.pool.query<{ segundos: number }>('select extract(epoch from now() - criado_em)::float as segundos from job_registro where id = $1', [falhoDaA])
      expect(idade[0]?.segundos).toBeLessThan(120)
      expect(await noContexto(escolaA, () => outro.descartarFalho(falhoDaA))).toBe(false)
      const paraApagar = await job(escolaA, 'estrutura.gravar-planilha')
      expect(await noContexto(escolaA, () => outro.descartarFalho(paraApagar))).toBe(true)
      expect(await linhaDoJob(paraApagar)).toBeUndefined()
    })
  })

  describe('--chamado', () => {
    it.each([
      ['0', ['--chamado', '0']],
      ['negativo', ['--chamado=-3']],
      ['texto', ['--chamado', 'abc']],
    ])('%s: recusado antes de tocar a linha, nos dois comandos', async (_caso, opcao) => {
      const id = await job(escolaA, 'estrutura.gravar-planilha')
      for (const comando of [reprocessar, descartar]) {
        const execucao = await (comando === reprocessar ? reprocessar([id, ...opcao], FILA_PROIBIDA) : descartar([id, ...opcao]))
        expect(execucao).toMatchObject({ codigo: 2, saida: '' })
        expect(execucao.erro).toBe('Opção inválida ou ausente: --chamado\n')
      }
      expect((await linhaDoJob(id))?.estado).toBe('falhou')
      expect(await auditoriaDoJob(id)).toEqual([])
    })
  })

  describe('a saída, a auditoria e o log', () => {
    it('uma sentinela em dados fica fora da saída, do erro e da auditoria, nos dois comandos', async () => {
      const paraReprocessar = await job(escolaA, 'estrutura.gravar-planilha', { dados: { importacaoId: randomUUID() } })
      const paraDescartar = await job(escolaA, 'estrutura.gravar-planilha', { dados: { importacaoId: randomUUID() } })
      const execucoes = [await reprocessar([paraReprocessar, '--chamado', '31']), await descartar([paraDescartar, '--chamado', '32']), await listar()]
      for (const execucao of execucoes) {
        expect(execucao.codigo).toBe(0)
        expect(`${execucao.saida}${execucao.erro}`).not.toContain(SENTINELA)
      }
      // A linha reprocessada ainda guarda o `dados` dela: é o banco, e só o que sai pelo terminal e pela auditoria vale.
      const auditoria = JSON.stringify([...(await auditoriaDoJob(paraReprocessar)), ...(await auditoriaDoJob(paraDescartar))])
      expect(auditoria).not.toContain(SENTINELA)
      expect(auditoria).toContain('"chamado":31')
      expect(auditoria).toContain('"chamado":32')
      // O terminal de cada comando traz só ids, tipo e chamado.
      expect(JSON.parse(execucoes[0]?.saida ?? '')).toEqual({ reprocessado: paraReprocessar, tipo: 'estrutura.gravar-planilha', chamado: 31 })
      expect(Object.keys(JSON.parse(execucoes[1]?.saida ?? '') as object).sort()).toEqual(['chamado', 'descartado', 'materialFechado', 'objetoApagado', 'tipo'])
    })
  })

  describe('a listagem', () => {
    it('traz id, escola, tipo, fila, código e data dos que falharam, de todas as escolas, e nunca o dados', async () => {
      const daA = await job(escolaA, 'estrutura.gravar-planilha', { dados: { importacaoId: randomUUID() } })
      const daB = await job(escolaB, 'retencao.expurgar-escola')
      const semEscola = await job(null, 'sistema.expurgar-jobs')
      const pendente = await job(escolaA, 'estrutura.gravar-planilha', { estado: 'aguardando' })
      const semData = await job(escolaB, 'retencao.expurgar-escola', { semConcluido: true })

      const execucao = await listar()

      expect(execucao).toMatchObject({ codigo: 0, erro: '' })
      expect(execucao.saida).not.toContain(SENTINELA)
      expect(execucao.saida).not.toContain('dados')
      const { jobs } = JSON.parse(execucao.saida) as { jobs: Array<Record<string, unknown>> }
      const nossos = jobs.filter((linha) => [daA, daB, semEscola, semData, pendente].includes(linha['id'] as string))
      expect(nossos.map((linha) => linha['id']).sort()).toEqual([daA, daB, semEscola, semData].sort())
      for (const linha of nossos) expect(Object.keys(linha).sort()).toEqual(['codigo', 'concluidoEm', 'escolaId', 'fila', 'id', 'tipo'])
      expect(nossos.find((linha) => linha['id'] === daA)).toMatchObject({ escolaId: escolaA, tipo: 'estrutura.gravar-planilha', fila: 'normal', codigo: 'ERRO_INTERNO' })
      expect(nossos.find((linha) => linha['id'] === semEscola)).toMatchObject({ escolaId: null, tipo: 'sistema.expurgar-jobs' })
      expect(typeof nossos.find((linha) => linha['id'] === daB)?.['concluidoEm']).toBe('string')
      expect(nossos.find((linha) => linha['id'] === semData)).toHaveProperty('concluidoEm', null)
    })
  })
})
