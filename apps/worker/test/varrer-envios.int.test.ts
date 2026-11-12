import 'reflect-metadata'
import {
  chaveDoTemporario,
  EnvioDeMaterialRepository,
  ExtracaoDoMaterialRepository,
  FileStorageUnavailableError,
  InMemoryFileStorage,
  runInContext,
  unscopedJustification,
  VarreduraDoMaterialRepository,
  type Clock,
} from '@educa/core'
import { PdfExtractor } from '@educa/core/material'
import { JobFailureCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { criarExtracaoDoPdf } from '../src/processors/extrair-pdf.js'
import { criarVarreduraDeTemporarios, FALHAS_SEGUIDAS_DO_STORAGE_FORA, FOLGA_DA_LINHA_DO_ENVIO_MS, FOLGA_DO_OBJETO_QUE_SOBROU_MS } from '../src/processors/varrer-envios.js'
import { jobExecution } from './job-execution.fixture.js'
import { InMemoryLog, QueueFixtures } from './queue.fixture.js'

// A varredura horária do PDF que sobrou no storage (ingestao-do-material, tarefa 2.0; Tech Spec, seção 5), contra o Postgres do compose de teste, com o armazém falso:
// o envio que não chegou ao commit (59 e 61 min do mesmo `Clock`), a linha travada por um envio lento, o objeto que sobrou depois do commit (23 e 25 h), o contexto de
// cada escola e a falha de uma que não segura as outras. O envio de verdade, com a API, está em `apps/api/test/material-envio-orfao.int.test.ts`.

const MINUTO_MS = 60_000
const HORA_MS = 60 * MINUTO_MS

/** Um relógio que o teste move: a linha nasce no instante dele, e a varredura roda 59 ou 61 min depois, do mesmo relógio. */
class RelogioMovel implements Clock {
  constructor(public emMs: number) {}
  agora(): Date {
    return new Date(this.emMs)
  }
}

/** A assinatura de PDF, uma página e nenhum texto: o extrator a dá como `sem_texto`. */
function pdfSemTexto(): Buffer {
  return Buffer.from(['%PDF-1.4', `% ${randomUUID()}`, '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj', '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj', '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj', 'trailer<</Root 1 0 R>>', '%%EOF', ''].join('\n'), 'latin1')
}

beforeAll(() => {
  // Worker do compose de pé executaria o job de expurgo que outro teste grava, com o armazém dele.
  compose('stop', ...PROCESSOS_DA_FILA)
})

interface Cenario {
  readonly escolaId: string
  readonly disciplinaId: string
}

describe('sistema.varrer-temporarios-de-material', () => {
  const bancada = new QueueFixtures()
  const log = new InMemoryLog('worker-teste')
  const armazem = new InMemoryFileStorage()

  beforeEach(async () => {
    // A varredura olha todas as escolas: a linha e o objeto que outro caso (ou outro arquivo) deixou não entram nas contas deste. Isto, e as contagens
    // do resumo, só valem porque o projeto `integracao` roda um arquivo por vez (`fileParallelism: false`): com arquivos em paralelo, outro teste
    // criaria material ou linha no meio de um caso, e este `update` apagaria a marca do que o outro espera ver.
    await bancada.pool.query('delete from envio_de_material')
    await bancada.pool.query('update material set objeto_apagado_em = now() where objeto_apagado_em is null')
  })

  afterAll(async () => {
    await bancada.pool.query('delete from envio_de_material')
    await bancada.fechar()
  })

  async function escolaNova(): Promise<Cenario> {
    const escolaId = await bancada.escola()
    const { rows } = await bancada.pool.query<{ id: string }>("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [escolaId])
    return { escolaId, disciplinaId: rows[0]?.id ?? '' }
  }

  const naEscola = <T>(escolaId: string, funcao: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)

  /** A linha do envio, criada no instante do relógio do teste, e o objeto no armazém (se `comObjeto`): o que a API deixa quando cai antes do commit. */
  async function envio(c: Cenario, relogio: Clock, { comObjeto = true, onde = armazem }: { comObjeto?: boolean; onde?: InMemoryFileStorage } = {}): Promise<string> {
    const id = randomUUID()
    await bancada.pool.query('insert into envio_de_material (escola_id, material_id, criado_em) values ($1, $2, $3)', [c.escolaId, id, relogio.agora()])
    if (comObjeto) await naEscola(c.escolaId, () => onde.guardarBytes(chaveDoTemporario(id), Buffer.from('%PDF-1.4\n'), { prazoMs: 5_000 }))
    return id
  }

  const temLinha = async (escolaId: string, id: string): Promise<boolean> => {
    const { rows } = await bancada.pool.query('select 1 from envio_de_material where escola_id = $1 and material_id = $2', [escolaId, id])
    return rows.length > 0
  }

  const temObjeto = (escolaId: string, id: string, onde: InMemoryFileStorage = armazem): Promise<boolean> => naEscola(escolaId, () => onde.existe(chaveDoTemporario(id)))

  interface MaterialRow {
    readonly estado: string
    readonly processado_em: Date | null
    readonly objeto_apagado_em: Date | null
  }

  interface DadosDoMaterial {
    readonly estado: 'processando' | 'pronto' | 'falhou'
    readonly processadoHaHoras: number | null
    readonly excluidoHaHoras: number | null
    readonly objetoApagado: boolean
    readonly comObjeto: boolean
    readonly onde: InMemoryFileStorage
  }

  /** Um material com o estado e as datas que o teste diz, em horas antes do banco agora, e o objeto no armazém (se `comObjeto`). */
  async function material(c: Cenario, ajuste: Partial<DadosDoMaterial> = {}): Promise<string> {
    const dados: DadosDoMaterial = { estado: 'pronto', processadoHaHoras: null, excluidoHaHoras: null, objetoApagado: false, comObjeto: true, onde: armazem, ...ajuste }
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, falha, processado_em, excluido_em, objeto_apagado_em)
       values ($1, $2, 'Título que nunca vai ao log', 'escola', 'autoria_da_escola', true, md5(random()::text) || md5(random()::text), 1000, $3,
         case when $3 = 'pronto' then 1 else null end, case when $3 = 'falhou' then 'extracao_falhou' else null end,
         case when $4::float8 is null then null else now() - make_interval(hours => 0, secs => $4::float8 * 3600) end,
         case when $5::float8 is null then null else now() - make_interval(hours => 0, secs => $5::float8 * 3600) end,
         case when $6::boolean then now() else null end) returning id`,
      [c.escolaId, c.disciplinaId, dados.estado, dados.processadoHaHoras, dados.excluidoHaHoras, dados.objetoApagado],
    )
    const id = rows[0]?.id ?? ''
    if (dados.comObjeto) await naEscola(c.escolaId, () => dados.onde.guardarBytes(chaveDoTemporario(id), Buffer.from('%PDF-1.4\n'), { prazoMs: 5_000 }))
    return id
  }

  async function linhaDoMaterial(id: string): Promise<MaterialRow> {
    const { rows } = await bancada.pool.query<MaterialRow>('select estado, processado_em, objeto_apagado_em from material where id = $1', [id])
    const lida = rows[0]
    if (lida === undefined) throw new Error('material sumiu')
    return lida
  }

  interface Opcoes {
    readonly armazemDoCaso?: Pick<InMemoryFileStorage, 'apagar'>
    readonly lote?: number
    readonly prazoDoApagarMs?: number
    /** `false` roda a rotina fora do contexto do sistema, como um job de escola a chamaria. */
    readonly doSistema?: boolean
    /** O `sinal` que o executor entrega: aborta quando o prazo do job passa. Sem ele, o que nunca aborta. */
    readonly sinal?: AbortSignal
  }

  /** O job, como o executor o chama: rotina do sistema, sem escola, no instante do relógio. */
  function rodar(relogio: Clock, opcoes: Opcoes = {}): Promise<void> {
    const processador = criarVarreduraDeTemporarios({
      banco: bancada.banco,
      armazem: opcoes.armazemDoCaso ?? armazem,
      relogio,
      logger: log.logger,
      ...(opcoes.lote === undefined ? {} : { lote: opcoes.lote }),
      ...(opcoes.prazoDoApagarMs === undefined ? {} : { prazoDoApagarMs: opcoes.prazoDoApagarMs }),
    })
    const contexto = opcoes.doSistema === false ? { requisicaoId: randomUUID(), escolaId: randomUUID() } : { requisicaoId: randomUUID(), rotinaDoSistema: true as const }
    return runInContext(contexto, () => processador({}, jobExecution(randomUUID()), opcoes.sinal))
  }

  /** A linha do log de resumo da execução que acabou de rodar. */
  const ultimoResumo = (): Record<string, unknown> | undefined => log.doEvento('material.varredura').at(-1)

  describe('o envio que não chegou ao commit', () => {
    it('com 59 min a linha e o objeto ficam, com 61 min saem: a linha e a varredura leem o mesmo `Clock`', async () => {
      const c = await escolaNova()
      const relogio = new RelogioMovel(Date.now())
      const id = await envio(c, relogio)

      relogio.emMs += 59 * MINUTO_MS
      await rodar(relogio)
      expect(await temLinha(c.escolaId, id)).toBe(true)
      expect(await temObjeto(c.escolaId, id)).toBe(true)
      // Nem a leitura a trouxe: a linha de 59 min não é "parada", e não conta como pulada.
      expect(ultimoResumo()).toMatchObject({ enviosApagadosTotal: 0, enviosPuladosTotal: 0 })

      relogio.emMs += 2 * MINUTO_MS
      await rodar(relogio)
      expect(await temLinha(c.escolaId, id)).toBe(false)
      expect(await temObjeto(c.escolaId, id)).toBe(false)
    })

    it('linha sem objeto (a queda foi antes do upload): sai sem erro', async () => {
      const c = await escolaNova()
      const relogio = new RelogioMovel(Date.now())
      const id = await envio(c, relogio, { comObjeto: false })

      relogio.emMs += 61 * MINUTO_MS
      await expect(rodar(relogio)).resolves.toBeUndefined()

      expect(await temLinha(c.escolaId, id)).toBe(false)
    })

    it('o `apagar` falhando uma vez: a linha e o objeto ficam, o job falha para a fila repetir, e na hora seguinte saem', async () => {
      const c = await escolaNova()
      const dele = new InMemoryFileStorage()
      const relogio = new RelogioMovel(Date.now())
      const id = await envio(c, relogio, { onde: dele })
      relogio.emMs += 61 * MINUTO_MS
      dele.falhaAoApagar = true

      await expect(rodar(relogio, { armazemDoCaso: dele })).rejects.toThrow('objeto de material não apagado')
      expect(await temLinha(c.escolaId, id)).toBe(true)
      expect(await temObjeto(c.escolaId, id, dele)).toBe(true)

      dele.falhaAoApagar = false
      relogio.emMs += HORA_MS
      await rodar(relogio, { armazemDoCaso: dele })
      expect(await temLinha(c.escolaId, id)).toBe(false)
      expect(await temObjeto(c.escolaId, id, dele)).toBe(false)
    })

    it('o `apagar` que não responde estoura o prazo curto: a linha fica, e o job não espera o armazém', async () => {
      const c = await escolaNova()
      const relogio = new RelogioMovel(Date.now())
      const id = await envio(c, relogio)
      relogio.emMs += 61 * MINUTO_MS
      const mudo = { apagar: () => new Promise<void>(() => undefined) }

      // O prazo curto é o que solta o job: sem ele o armazém mudo o seguraria para sempre, e o caso cairia aqui, em 5 s, em vez de pelo tempo do teste.
      let relogioDaEspera: NodeJS.Timeout | undefined
      const espera = new Promise<never>((_, rejeitar) => {
        relogioDaEspera = setTimeout(() => rejeitar(new Error('o job esperou o armazém mudo')), 5_000)
      })
      await expect(Promise.race([rodar(relogio, { armazemDoCaso: mudo, prazoDoApagarMs: 50 }), espera]).finally(() => clearTimeout(relogioDaEspera))).rejects.toThrow('objeto de material não apagado')

      expect(await temLinha(c.escolaId, id)).toBe(true)
      expect(await temObjeto(c.escolaId, id)).toBe(true)
    })

    it('[P] a linha que um envio lento já travou é pulada: o objeto fica, a varredura não espera, e o envio confirma', async () => {
      const c = await escolaNova()
      const relogio = new RelogioMovel(Date.now())
      const id = await envio(c, relogio)
      relogio.emMs += 61 * MINUTO_MS
      // O envio lento: a transação dele já apagou a linha (é o que o envio faz no fim) e ainda não deu commit.
      const lento = await bancada.pool.connect()
      try {
        await lento.query('begin')
        await lento.query('delete from envio_de_material where escola_id = $1 and material_id = $2', [c.escolaId, id])

        const espera = new Promise<never>((_, rejeitar) => setTimeout(() => rejeitar(new Error('a varredura esperou a linha travada')), 5_000))
        await Promise.race([rodar(relogio), espera])

        expect(await temObjeto(c.escolaId, id)).toBe(true)
        expect(await temLinha(c.escolaId, id)).toBe(true)
        expect(ultimoResumo()).toMatchObject({ enviosApagadosTotal: 0, enviosPuladosTotal: 1 })
        await lento.query('commit')
      } finally {
        // Quando o caso falha antes do `commit`, a transação do envio lento não fica aberta na conexão devolvida ao pool.
        await lento.query('rollback').catch(() => undefined)
        lento.release()
      }
      expect(await temLinha(c.escolaId, id)).toBe(false)
      expect(await temObjeto(c.escolaId, id)).toBe(true)
    })

    it('duas escolas: cada `apagar` roda no contexto da sua, com a chave dela', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const relogio = new RelogioMovel(Date.now())
      const idA = await envio(a, relogio)
      const idB = await envio(b, relogio)
      relogio.emMs += 61 * MINUTO_MS
      const apagadas: string[] = []
      const registrando = { apagar: (chave: string) => (apagadas.push(chave), armazem.apagar(chave)) }

      await rodar(relogio, { armazemDoCaso: registrando })

      expect(apagadas.toSorted()).toEqual([chaveDe(a.escolaId, idA), chaveDe(b.escolaId, idB)].toSorted())
      expect(await temObjeto(a.escolaId, idA)).toBe(false)
      expect(await temObjeto(b.escolaId, idB)).toBe(false)
      expect(await temLinha(a.escolaId, idA)).toBe(false)
      expect(await temLinha(b.escolaId, idB)).toBe(false)
    })

    it('a falha numa escola não segura as outras: a da B sai, a da A fica, e o job falha no fim', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const relogio = new RelogioMovel(Date.now())
      const idA = await envio(a, relogio)
      const idB = await envio(b, relogio)
      relogio.emMs += 61 * MINUTO_MS
      const recusaA = {
        apagar: (chave: string) => (chave.includes(a.escolaId) ? Promise.reject(new FileStorageUnavailableError()) : armazem.apagar(chave)),
      }

      await expect(rodar(relogio, { armazemDoCaso: recusaA })).rejects.toThrow('objeto de material não apagado')

      expect(await temLinha(a.escolaId, idA)).toBe(true)
      expect(await temObjeto(a.escolaId, idA)).toBe(true)
      expect(await temLinha(b.escolaId, idB)).toBe(false)
      expect(await temObjeto(b.escolaId, idB)).toBe(false)
    })

    it('o lote limita o que cada execução trata, do mais antigo: o resto sai na hora seguinte', async () => {
      const c = await escolaNova()
      const relogio = new RelogioMovel(Date.now())
      // O mais novo entra primeiro no banco: a ordem da linha na tabela não é a ordem de criação.
      const maisNovo = await envio(c, new RelogioMovel(relogio.emMs + 1_000))
      const maisAntigo = await envio(c, relogio)
      relogio.emMs += 62 * MINUTO_MS

      await rodar(relogio, { lote: 1 })
      expect(await temLinha(c.escolaId, maisAntigo)).toBe(false)
      expect(await temLinha(c.escolaId, maisNovo)).toBe(true)

      await rodar(relogio, { lote: 1 })
      expect(await temLinha(c.escolaId, maisNovo)).toBe(false)
    })
  })

  describe('o objeto que sobrou depois do commit', () => {
    it('`pronto` há 25 h sai e fica registrado; há 23 h, não', async () => {
      const c = await escolaNova()
      const velho = await material(c, { estado: 'pronto', processadoHaHoras: 25 })
      const novo = await material(c, { estado: 'pronto', processadoHaHoras: 23 })

      await rodar(new RelogioMovel(Date.now()))

      expect(await temObjeto(c.escolaId, velho)).toBe(false)
      expect((await linhaDoMaterial(velho)).objeto_apagado_em).toBeInstanceOf(Date)
      expect(await temObjeto(c.escolaId, novo)).toBe(true)
      expect((await linhaDoMaterial(novo)).objeto_apagado_em).toBeNull()
    })

    it('`falhou` há 25 h com o `apagar` da extração caído: o `processado_em` da falha o leva à varredura, que apaga', async () => {
      const c = await escolaNova()
      const dele = new InMemoryFileStorage()
      const id = await material(c, { estado: 'processando', onde: dele, comObjeto: false })
      await naEscola(c.escolaId, () => dele.guardarBytes(chaveDoTemporario(id), pdfSemTexto(), { prazoMs: 5_000 }))
      dele.falhaAoApagar = true
      const extracao = criarExtracaoDoPdf({ banco: bancada.banco, armazem: dele, extrator: new PdfExtractor(), logger: log.logger })
      await naEscola(c.escolaId, () => extracao({ materialId: id }, jobExecution(randomUUID(), 1), new AbortController().signal))
      expect(await linhaDoMaterial(id)).toMatchObject({ estado: 'falhou', objeto_apagado_em: null })
      expect(await temObjeto(c.escolaId, id, dele)).toBe(true)
      dele.falhaAoApagar = false

      await rodar(new RelogioMovel(Date.now() + 25 * HORA_MS + MINUTO_MS), { armazemDoCaso: dele })

      expect(await temObjeto(c.escolaId, id, dele)).toBe(false)
      expect((await linhaDoMaterial(id)).objeto_apagado_em).toBeInstanceOf(Date)
    })

    it('excluído há 25 h sai; `processando` há 25 h mantém o objeto; o de antes da migration (`objeto_apagado_em` preenchido) não entra', async () => {
      const c = await escolaNova()
      const excluido = await material(c, { estado: 'pronto', excluidoHaHoras: 25 })
      const processando = await material(c, { estado: 'processando', processadoHaHoras: null })
      await bancada.pool.query("update material set enviado_em = now() - interval '25 hours' where id = $1", [processando])
      const antigo = await material(c, { estado: 'pronto', processadoHaHoras: 100, objetoApagado: true })
      const apagadas: string[] = []
      const registrando = { apagar: (chave: string) => (apagadas.push(chave), armazem.apagar(chave)) }

      await rodar(new RelogioMovel(Date.now()), { armazemDoCaso: registrando })

      expect(apagadas).toContain(chaveDe(c.escolaId, excluido))
      expect(await temObjeto(c.escolaId, excluido)).toBe(false)
      expect(await temObjeto(c.escolaId, processando)).toBe(true)
      expect((await linhaDoMaterial(processando)).objeto_apagado_em).toBeNull()
      expect(apagadas).not.toContain(chaveDe(c.escolaId, antigo))
      expect(apagadas).not.toContain(chaveDe(c.escolaId, processando))
    })

    it('duas escolas: cada `apagar` roda no contexto da sua e a marca vai só para a linha dela', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const daA = await material(a, { estado: 'pronto', processadoHaHoras: 26 })
      const daB = await material(b, { estado: 'falhou', processadoHaHoras: 26 })
      const apagadas: string[] = []
      const registrando = { apagar: (chave: string) => (apagadas.push(chave), armazem.apagar(chave)) }

      await rodar(new RelogioMovel(Date.now()), { armazemDoCaso: registrando })

      // O banco de teste tem objeto de outras escolas, e a varredura olha todas: só as chaves das duas escolas deste caso contam, e são estas duas, cada uma com a sua.
      const dasDuas = apagadas.filter((chave) => chave.includes(a.escolaId) || chave.includes(b.escolaId))
      expect(dasDuas.toSorted()).toEqual([chaveDe(a.escolaId, daA), chaveDe(b.escolaId, daB)].toSorted())
      expect(await temObjeto(a.escolaId, daA)).toBe(false)
      expect(await temObjeto(b.escolaId, daB)).toBe(false)
      expect((await linhaDoMaterial(daA)).objeto_apagado_em).toBeInstanceOf(Date)
      expect((await linhaDoMaterial(daB)).objeto_apagado_em).toBeInstanceOf(Date)
    })

    it('o lote limita também os objetos que sobraram: o resto sai na hora seguinte', async () => {
      const c = await escolaNova()
      const primeiro = await material(c, { estado: 'pronto', processadoHaHoras: 30 })
      const segundo = await material(c, { estado: 'pronto', processadoHaHoras: 30 })

      await rodar(new RelogioMovel(Date.now()), { lote: 1 })
      expect([(await linhaDoMaterial(primeiro)).objeto_apagado_em, (await linhaDoMaterial(segundo)).objeto_apagado_em].filter((marca) => marca !== null)).toHaveLength(1)

      await rodar(new RelogioMovel(Date.now()), { lote: 1 })
      expect((await linhaDoMaterial(primeiro)).objeto_apagado_em).toBeInstanceOf(Date)
      expect((await linhaDoMaterial(segundo)).objeto_apagado_em).toBeInstanceOf(Date)
    })

    it('o `apagar` que falha deixa a marca nula, e a hora seguinte o tenta de novo', async () => {
      const c = await escolaNova()
      const dele = new InMemoryFileStorage()
      const id = await material(c, { estado: 'pronto', processadoHaHoras: 30, onde: dele })
      dele.falhaAoApagar = true

      await expect(rodar(new RelogioMovel(Date.now()), { armazemDoCaso: dele })).rejects.toThrow('objeto de material não apagado')
      expect((await linhaDoMaterial(id)).objeto_apagado_em).toBeNull()
      expect(await temObjeto(c.escolaId, id, dele)).toBe(true)

      dele.falhaAoApagar = false
      await rodar(new RelogioMovel(Date.now()), { armazemDoCaso: dele })
      expect((await linhaDoMaterial(id)).objeto_apagado_em).toBeInstanceOf(Date)
      expect(await temObjeto(c.escolaId, id, dele)).toBe(false)
    })
  })

  describe('o corte do job e o storage fora do ar', () => {
    /** Um armazém que conta os `apagar` e responde como o caso manda: o que o corte ou o storage fora do ar impede de chamar não conta. */
    function armazemQueConta(responde: (chave: string) => Promise<void>): { readonly armazemDoCaso: Pick<InMemoryFileStorage, 'apagar'>; readonly chamadas: () => number } {
      let total = 0
      return {
        armazemDoCaso: {
          apagar: (chave: string) => {
            total += 1
            return responde(chave)
          },
        },
        chamadas: () => total,
      }
    }

    /** A linha do envio está livre: nenhuma transação da varredura a segura (o `for update nowait` de outra conexão a trava na hora, ou falha). */
    async function linhaLivre(escolaId: string, id: string): Promise<boolean> {
      const conexao = await bancada.pool.connect()
      try {
        await conexao.query('begin')
        await conexao.query('select 1 from envio_de_material where escola_id = $1 and material_id = $2 for update nowait', [escolaId, id])
        return true
      } catch {
        return false
      } finally {
        await conexao.query('rollback').catch(() => undefined)
        conexao.release()
      }
    }

    it('o `sinal` já abortado: nenhum `apagar` é chamado, nas duas passadas, e tudo fica para a hora seguinte', async () => {
      const c = await escolaNova()
      const relogio = new RelogioMovel(Date.now())
      const id = await envio(c, relogio)
      const velho = await material(c, { estado: 'pronto', processadoHaHoras: 30 })
      relogio.emMs += 61 * MINUTO_MS
      const { armazemDoCaso, chamadas } = armazemQueConta(() => Promise.resolve())
      const controle = new AbortController()
      controle.abort()

      await rodar(relogio, { armazemDoCaso, sinal: controle.signal })

      expect(chamadas()).toBe(0)
      expect(await temLinha(c.escolaId, id)).toBe(true)
      expect((await linhaDoMaterial(velho)).objeto_apagado_em).toBeNull()
      expect(ultimoResumo()).toMatchObject({ estado: 'cortada', falhasTotal: 0, enviosApagadosTotal: 0, objetosApagadosTotal: 0 })
    })

    it('o `sinal` aborta com o armazém mudo: o `apagar` para, o job volta, a transação desfaz e nenhum outro alvo é tentado', async () => {
      const c = await escolaNova()
      const relogio = new RelogioMovel(Date.now())
      const ids = [await envio(c, relogio), await envio(c, relogio), await envio(c, relogio)]
      relogio.emMs += 61 * MINUTO_MS
      // O armazém nunca responde, e o prazo curto do `apagar` é longo de propósito: só o `sinal` solta o job.
      const { armazemDoCaso, chamadas } = armazemQueConta(() => new Promise<void>(() => undefined))
      const controle = new AbortController()
      const execucao = rodar(relogio, { armazemDoCaso, prazoDoApagarMs: 60_000, sinal: controle.signal })

      await vi.waitFor(() => expect(chamadas()).toBe(1), { timeout: 5_000 })
      controle.abort()
      let relogioDaEspera: NodeJS.Timeout | undefined
      const espera = new Promise<never>((_, rejeitar) => {
        relogioDaEspera = setTimeout(() => rejeitar(new Error('o job não voltou depois do corte')), 5_000)
      })
      await Promise.race([execucao, espera]).finally(() => clearTimeout(relogioDaEspera))

      expect(chamadas()).toBe(1)
      expect(ultimoResumo()).toMatchObject({ estado: 'cortada', falhasTotal: 0, enviosApagadosTotal: 0 })
      for (const id of ids) {
        expect(await temLinha(c.escolaId, id)).toBe(true)
        expect(await linhaLivre(c.escolaId, id)).toBe(true)
      }
    })

    /** Um envio por escola da lista, na ordem dela: os `criado_em` crescem de segundo em segundo, e a varredura lê por `criado_em`, então a ordem do caso é a da leitura. */
    async function enviosNaOrdem(escolas: readonly Cenario[], base: number): Promise<string[]> {
      const ids: string[] = []
      for (const [posicao, escola] of escolas.entries()) ids.push(await envio(escola, new RelogioMovel(base + posicao * 1_000)))
      return ids
    }

    /** O erro que o `S3FileStorage` lança de fato: toda falha do `DeleteObject` (403 numa chave, 5xx, prazo do SDK) vira esse erro. */
    const recusa = (): Promise<void> => Promise.reject(new FileStorageUnavailableError())

    it('o storage fora do ar (3 falhas seguidas, em duas escolas) para a passada, e a do objeto que sobrou nem começa', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const base = Date.now()
      const escolas = [a, b, a, b]
      const ids = (await enviosNaOrdem(escolas, base)).map((id, posicao) => ({ c: escolas[posicao] ?? a, id }))
      const velho = await material(a, { estado: 'pronto', processadoHaHoras: 30 })
      const relogio = new RelogioMovel(base + 61 * MINUTO_MS)
      const { armazemDoCaso, chamadas } = armazemQueConta(recusa)

      await expect(rodar(relogio, { armazemDoCaso })).rejects.toThrow('objeto de material não apagado')

      // A leitura vai a, b, a, b: as duas primeiras falhas já são de duas escolas, e a terceira fecha a conta. A quarta nunca é tentada.
      expect(chamadas()).toBe(FALHAS_SEGUIDAS_DO_STORAGE_FORA)
      expect(ultimoResumo()).toMatchObject({ estado: 'storage_fora', falhasTotal: 3, enviosApagadosTotal: 0, objetosApagadosTotal: 0 })
      for (const { c, id } of ids) expect(await temLinha(c.escolaId, id)).toBe(true)
      expect((await linhaDoMaterial(velho)).objeto_apagado_em).toBeNull()
    })

    it('o storage fora do ar também para a passada do objeto que sobrou: três `apagar` e a marca fica nula', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const velhos = [
        await material(a, { estado: 'pronto', processadoHaHoras: 30 }),
        await material(a, { estado: 'pronto', processadoHaHoras: 31 }),
        await material(b, { estado: 'pronto', processadoHaHoras: 32 }),
        await material(b, { estado: 'pronto', processadoHaHoras: 33 }),
      ]
      const { armazemDoCaso, chamadas } = armazemQueConta(recusa)

      await expect(rodar(new RelogioMovel(Date.now()), { armazemDoCaso })).rejects.toThrow('objeto de material não apagado')

      expect(chamadas()).toBe(FALHAS_SEGUIDAS_DO_STORAGE_FORA)
      expect(ultimoResumo()).toMatchObject({ estado: 'storage_fora', falhasTotal: 3, enviosApagadosTotal: 0, objetosApagadosTotal: 0 })
      for (const id of velhos) expect((await linhaDoMaterial(id)).objeto_apagado_em).toBeNull()
    })

    it('uma chave que falha sempre, mesmo em vários alvos de uma escola só, não para as outras: a da B sai e o job falha no fim', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const base = Date.now()
      // A leitura vai a, a, a, b: a da B é a última, e só chega a ser tentada se as três falhas da A não pararam a execução.
      const [idA1 = '', idA2 = '', idA3 = '', idB = ''] = await enviosNaOrdem([a, a, a, b], base)
      const idsA = [idA1, idA2, idA3]
      const relogio = new RelogioMovel(base + 61 * MINUTO_MS)
      const { armazemDoCaso, chamadas } = armazemQueConta((chave) => (chave.includes(a.escolaId) ? recusa() : armazem.apagar(chave)))

      await expect(rodar(relogio, { armazemDoCaso })).rejects.toThrow('objeto de material não apagado')

      expect(chamadas()).toBe(4)
      expect(await temLinha(b.escolaId, idB)).toBe(false)
      expect(await temObjeto(b.escolaId, idB)).toBe(false)
      for (const id of idsA) expect(await temLinha(a.escolaId, id)).toBe(true)
      expect(ultimoResumo()).toMatchObject({ estado: 'completa', falhasTotal: 3, enviosApagadosTotal: 1 })
    })

    it('falha que não é do storage não conta como storage fora: três seguidas em duas escolas, e todos os alvos são tentados', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const relogio = new RelogioMovel(Date.now())
      for (const escola of [a, a, b, b]) await envio(escola, relogio)
      relogio.emMs += 61 * MINUTO_MS
      const { armazemDoCaso, chamadas } = armazemQueConta(() => Promise.reject(new Error('erro que o storage não lança')))

      await expect(rodar(relogio, { armazemDoCaso })).rejects.toThrow('objeto de material não apagado')

      expect(chamadas()).toBe(4)
      expect(ultimoResumo()).toMatchObject({ estado: 'completa', falhasTotal: 4 })
    })

    it('o alvo que passa zera a conta: falha, passa, falha, falha em duas escolas não é storage fora', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const c = await escolaNova()
      const base = Date.now()
      // A ordem da leitura é a do `criado_em`: a, c, b, a.
      const ordem = [a, c, b, a]
      const ids: string[] = []
      for (const [posicao, escola] of ordem.entries()) ids.push(await envio(escola, new RelogioMovel(base + posicao * 1_000)))
      const relogio = new RelogioMovel(base + 61 * MINUTO_MS)
      // O storage recusa as chaves da A e da B e aceita as da C.
      const { armazemDoCaso, chamadas } = armazemQueConta((chave) => (chave.includes(c.escolaId) ? armazem.apagar(chave) : recusa()))

      await expect(rodar(relogio, { armazemDoCaso })).rejects.toThrow('objeto de material não apagado')

      expect(chamadas()).toBe(4)
      expect(await temLinha(c.escolaId, ids[1] ?? '')).toBe(false)
      expect(ultimoResumo()).toMatchObject({ estado: 'completa', falhasTotal: 3, enviosApagadosTotal: 1 })
    })
  })

  describe('a rotina', () => {
    it('só roda como rotina do sistema: o job de escola a recebe com `DADOS_INVALIDOS`, e nada é apagado', async () => {
      const c = await escolaNova()
      const relogio = new RelogioMovel(Date.now())
      const id = await envio(c, relogio)
      relogio.emMs += 61 * MINUTO_MS

      await expect(rodar(relogio, { doSistema: false })).rejects.toMatchObject({ codigo: JobFailureCode.DADOS_INVALIDOS })

      expect(await temLinha(c.escolaId, id)).toBe(true)
      expect(await temObjeto(c.escolaId, id)).toBe(true)
    })

    it('as folgas são 1 h e 25 h', () => {
      expect([FOLGA_DA_LINHA_DO_ENVIO_MS, FOLGA_DO_OBJETO_QUE_SOBROU_MS]).toEqual([HORA_MS, 25 * HORA_MS])
    })

    it('o log leva só ids e contagens: nunca título, arquivo, licenciante nem a chave do objeto', async () => {
      const c = await escolaNova()
      const relogio = new RelogioMovel(Date.now())
      const id = await envio(c, relogio)
      const velho = await material(c, { estado: 'pronto', processadoHaHoras: 30 })
      relogio.emMs += 61 * MINUTO_MS
      // O erro que o storage lança de fato: uma falha por passada não chega a 3 seguidas, então as duas passadas rodam, e cada uma falha no seu alvo.
      const recusa = { apagar: () => Promise.reject(new FileStorageUnavailableError()) }
      const inicio = log.linhas.length

      await rodar(relogio, { armazemDoCaso: recusa }).catch(() => undefined)

      const novas = log.linhas.slice(inicio).map((linha) => JSON.parse(linha) as Record<string, unknown>)
      // As chaves que o log próprio do processo põe em toda linha não contam: o resto é o que a varredura escolheu dizer, e é só isso.
      const doProcesso = new Set(['level', 'time', 'servico', 'requisicaoId'])
      const chaves = (linha: Record<string, unknown> | undefined): string[] => Object.keys(linha ?? {}).filter((chave) => !doProcesso.has(chave)).toSorted()
      const avisos = novas.filter((linha) => linha['evento'] === 'material.varredura_nao_apagou')
      const resumo = novas.find((linha) => linha['evento'] === 'material.varredura')
      expect(avisos.map((linha) => linha['materialId']).toSorted()).toEqual([id, velho].toSorted())
      for (const aviso of avisos) expect(chaves(aviso)).toEqual(['erro', 'escolaId', 'evento', 'materialId', 'origem'])
      expect(avisos.map((linha) => linha['origem']).toSorted()).toEqual(['envio', 'objeto'])
      expect(chaves(resumo)).toEqual(['enviosApagadosTotal', 'enviosPuladosTotal', 'estado', 'evento', 'falhasTotal', 'objetosApagadosTotal'])
      expect(resumo).toMatchObject({ enviosApagadosTotal: 0, enviosPuladosTotal: 0, objetosApagadosTotal: 0, falhasTotal: 2, estado: 'completa' })
      const texto = novas.map((linha) => JSON.stringify(linha)).join('\n')
      for (const proibido of ['material-temporario', 'Título que nunca vai ao log', 'licenciante', '.pdf']) expect(texto).not.toContain(proibido)
    })
  })

  describe('o que a varredura enxerga entre escolas (regra 10, item 9)', () => {
    it('as duas leituras `@Unscoped` têm a justificativa escrita e devolvem só a escola e o id', async () => {
      for (const metodo of ['enviosParados', 'objetosQueSobraram']) {
        expect(unscopedJustification(VarreduraDoMaterialRepository, metodo)?.length ?? 0, metodo).toBeGreaterThanOrEqual(30)
        expect(unscopedJustification(VarreduraDoMaterialRepository, metodo), metodo).toContain('só a escola e o id')
      }
      const c = await escolaNova()
      const relogio = new RelogioMovel(Date.now())
      const id = await envio(c, relogio, { comObjeto: false })
      const velho = await material(c, { estado: 'pronto', processadoHaHoras: 30, comObjeto: false })
      const varredura = new VarreduraDoMaterialRepository(bancada.banco)

      const envios = await varredura.enviosParados(new Date(relogio.emMs + HORA_MS), 1_000)
      const objetos = await varredura.objetosQueSobraram(new Date(Date.now() - 25 * HORA_MS), 1_000)

      expect(envios.filter((alvo) => alvo.materialId === id)).toEqual([{ escolaId: c.escolaId, materialId: id }])
      expect(objetos.filter((alvo) => alvo.materialId === velho)).toEqual([{ escolaId: c.escolaId, materialId: velho }])
      for (const alvo of [...envios, ...objetos]) expect(Object.keys(alvo).toSorted()).toEqual(['escolaId', 'materialId'])
    })

    it('o repository da linha, com a escola A no contexto, não alcança a linha da B: nem trava, nem apaga, nem o `apagarNoEnvio`', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const relogio = new RelogioMovel(Date.now())
      const idB = await envio(b, relogio, { comObjeto: false })
      const depois = new Date(relogio.emMs + 2 * HORA_MS)

      await naEscola(a.escolaId, async () => {
        const repositorio = new EnvioDeMaterialRepository(bancada.banco)
        await bancada.banco.transaction(async (tx) => {
          const dentro = new EnvioDeMaterialRepository(tx)
          expect(await dentro.travarParada(idB, depois)).toBe(false)
          expect(await dentro.apagarNoEnvio(idB)).toBe(false)
        })
        await repositorio.apagar(idB)
      })

      expect(await temLinha(b.escolaId, idB)).toBe(true)
      // E com a escola dela no contexto, a mesma linha é achada, travada e apagada.
      await naEscola(b.escolaId, () => bancada.banco.transaction(async (tx) => {
        const dentro = new EnvioDeMaterialRepository(tx)
        expect(await dentro.travarParada(idB, depois)).toBe(true)
        expect(await dentro.apagarNoEnvio(idB)).toBe(true)
      }))
      expect(await temLinha(b.escolaId, idB)).toBe(false)
    })

    it('`apagarNoEnvio` e `apagar` tiram só a linha do id, e `apagarNoEnvio` diz se havia a linha', async () => {
      const c = await escolaNova()
      const um = randomUUID()
      const dois = randomUUID()
      for (const id of [um, dois]) await naEscola(c.escolaId, () => new EnvioDeMaterialRepository(bancada.banco).registrar(id))

      const respostas = await naEscola(c.escolaId, () =>
        bancada.banco.transaction(async (tx) => {
          const dentro = new EnvioDeMaterialRepository(tx)
          return [await dentro.apagarNoEnvio(um), await dentro.apagarNoEnvio(um)]
        }),
      )

      expect(respostas).toEqual([true, false])
      expect(await temLinha(c.escolaId, um)).toBe(false)
      expect(await temLinha(c.escolaId, dois)).toBe(true)
      await naEscola(c.escolaId, () => new EnvioDeMaterialRepository(bancada.banco).apagar(um))
      expect(await temLinha(c.escolaId, dois)).toBe(true)
      await naEscola(c.escolaId, () => new EnvioDeMaterialRepository(bancada.banco).apagar(dois))
      expect(await temLinha(c.escolaId, dois)).toBe(false)
    })

    it('`registrar` grava a escola do contexto, e `travarParada` só alcança a linha com mais de 1 h', async () => {
      const c = await escolaNova()
      const id = randomUUID()
      await naEscola(c.escolaId, () => new EnvioDeMaterialRepository(bancada.banco).registrar(id))
      const { rows } = await bancada.pool.query<{ escola_id: string }>('select escola_id from envio_de_material where material_id = $1', [id])
      expect(rows).toEqual([{ escola_id: c.escolaId }])

      await naEscola(c.escolaId, () =>
        bancada.banco.transaction(async (tx) => {
          const dentro = new EnvioDeMaterialRepository(tx)
          expect(await dentro.travarParada(id, new Date(Date.now() - HORA_MS))).toBe(false)
          // Outro id da mesma escola, que a escola não tem na tabela de envios: nem a linha de um vizinho o responde.
          expect(await dentro.travarParada(randomUUID(), new Date(Date.now() + HORA_MS))).toBe(false)
          expect(await dentro.travarParada(id, new Date(Date.now() + HORA_MS))).toBe(true)
        }),
      )
    })

    it('o repository da extração, com a escola A no contexto, não marca o objeto da B como apagado', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const daB = await material(b, { estado: 'pronto', processadoHaHoras: 30 })

      await naEscola(a.escolaId, () => new ExtracaoDoMaterialRepository(bancada.banco).marcarObjetoApagado(daB))

      expect((await linhaDoMaterial(daB)).objeto_apagado_em).toBeNull()
    })
  })
})

/** A chave do objeto, como `chaveDoTemporario` a monta no contexto da escola. */
function chaveDe(escolaId: string, id: string): string {
  return `material-temporario/${escolaId}/${id}`
}
