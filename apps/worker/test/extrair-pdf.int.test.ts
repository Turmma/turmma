import 'reflect-metadata'
import { chaveDoTemporario, ExtracaoDoMaterialRepository, InMemoryFileStorage, jobOptions, METRICS, runInContext, WORKER_POOL_OPTIONS_BY_QUEUE } from '@educa/core'
import { PdfExtractor, type ResultadoDaExtracao } from '@educa/core/material'
import { JOB_DEFINITIONS, JobFailureCode, TIPO_EXTRAIR_PDF, type JobRegistry } from '@educa/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { PoolClient } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AMOSTRAS_DE_CAPITULOS, montarPdfDaAmostra } from '../../../tools/demonstracao/amostra-de-capitulos.ts'
import { CAMINHO_DO_MATERIAL } from '../../../tools/demonstracao/gerar-material.ts'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import type { JobProcessors } from '../src/job-executor.js'
import { criarExtracaoDoPdf } from '../src/processors/extrair-pdf.js'
import { jobExecution } from './job-execution.fixture.js'
import { InMemoryLog, QueueFixtures } from './queue.fixture.js'

// O job `material.extrair-pdf` (ingestao-do-material, tarefa 1.0; Tech Spec, seção 5, "Extração") contra o Postgres e o Redis de fila do
// compose de teste, com o armazém falso. A maior parte dos casos chama o processador direto, no contexto da escola, como o executor o
// chama; o prazo, o desligamento e a vaga por escola passam pelo worker de verdade, que é quem os aplica.

const PDF_DE_DEMONSTRACAO = readFileSync(CAMINHO_DO_MATERIAL)
const TENTATIVAS = JOB_DEFINITIONS[TIPO_EXTRAIR_PDF].retentativa.tentativas
const MIGRATION_DOS_CAPITULOS = readFileSync(new URL('../../../packages/core/drizzle/0051_capitulo_do_material.sql', import.meta.url), 'utf8')

function pdfDaAmostra(nome: string): Buffer {
  const amostra = AMOSTRAS_DE_CAPITULOS.find((candidata) => candidata.nome === nome)
  if (amostra === undefined) throw new Error(`a amostra ${nome} sumiu`)
  return montarPdfDaAmostra(amostra)
}

/** Um PDF de verdade, com uma página e nenhum texto: o que um scanner entrega sem OCR, menos a imagem. */
function pdfSemTexto(): Buffer {
  return Buffer.from(['%PDF-1.4', `% ${randomUUID()}`, '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj', '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj', '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj', 'trailer<</Root 1 0 R>>', '%%EOF', ''].join('\n'), 'latin1')
}

/** A assinatura de PDF e o resto lixo: o que um envio corrompido deixa. */
function pdfCorrompido(): Buffer {
  return Buffer.concat([Buffer.from('%PDF-1.7\n', 'latin1'), randomBytes(2048)])
}

beforeAll(() => {
  // Worker do compose de pé executaria o job que o teste grava, com o armazém dele, e o daria por perdido.
  compose('stop', ...PROCESSOS_DA_FILA)
})

interface Cenario {
  readonly escolaId: string
  readonly disciplinaId: string
}

interface MaterialRow {
  readonly estado: string
  readonly falha: string | null
  readonly paginas: number | null
  readonly processado_em: Date | null
  readonly objeto_apagado_em: Date | null
  readonly excluido_em: Date | null
}

describe('material.extrair-pdf', () => {
  const bancada = new QueueFixtures()
  const log = new InMemoryLog('worker-teste')
  const armazem = new InMemoryFileStorage()
  const extrator = new PdfExtractor()

  afterAll(async () => {
    await bancada.fechar()
  })

  async function escolaNova(): Promise<Cenario> {
    const escolaId = await bancada.escola()
    const { rows } = await bancada.pool.query<{ id: string }>("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [escolaId])
    return { escolaId, disciplinaId: rows[0]?.id ?? '' }
  }

  const naEscola = <T>(escolaId: string, funcao: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)

  /** O material `processando` da escola, com o PDF no armazém (se `bytes` vier): o que o envio da API deixa. */
  async function materialComObjeto(c: Cenario, bytes: Uint8Array | null = PDF_DE_DEMONSTRACAO, opcoes: { estado?: string; excluido?: boolean; armazemDoObjeto?: InMemoryFileStorage } = {}): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, excluido_em)
       values ($1, $2, 'Título que nunca vai ao log', 'escola', 'autoria_da_escola', true, md5(random()::text) || md5(random()::text), 1000, $3, case when $3 = 'pronto' then 1 else null end, case when $4::boolean then now() else null end) returning id`,
      [c.escolaId, c.disciplinaId, opcoes.estado ?? 'processando', opcoes.excluido ?? false],
    )
    const id = rows[0]?.id ?? ''
    if (bytes !== null) await naEscola(c.escolaId, () => (opcoes.armazemDoObjeto ?? armazem).guardarBytes(chaveDoTemporario(id), bytes, { prazoMs: 5_000 }))
    return id
  }

  async function linha(id: string): Promise<MaterialRow> {
    const { rows } = await bancada.pool.query<MaterialRow>('select estado, falha, paginas, processado_em, objeto_apagado_em, excluido_em from material where id = $1', [id])
    const lida = rows[0]
    if (lida === undefined) throw new Error('material sumiu')
    return lida
  }

  async function trechos(id: string): Promise<number[]> {
    const { rows } = await bancada.pool.query<{ pagina: number }>('select pagina from trecho where material_id = $1 order by pagina', [id])
    return rows.map(({ pagina }) => pagina)
  }

  interface CapituloRow {
    readonly escola_id: string
    readonly ordem: number
    readonly numero: number | null
    readonly titulo: string
    readonly pagina_inicial: number
    readonly pagina_final: number
  }

  async function capitulos(id: string): Promise<CapituloRow[]> {
    const { rows } = await bancada.pool.query<CapituloRow>('select escola_id, ordem, numero, titulo, pagina_inicial, pagina_final from capitulo_do_material where material_id = $1 order by ordem', [id])
    return rows
  }

  const temObjeto = (escolaId: string, id: string, onde: InMemoryFileStorage = armazem): Promise<boolean> => naEscola(escolaId, () => onde.existe(chaveDoTemporario(id)))

  interface Opcoes {
    readonly tentativa?: number
    readonly extratorDoCaso?: Pick<PdfExtractor, 'extrair'>
    readonly armazemDoCaso?: InMemoryFileStorage
    readonly medidor?: MedidorDeTeste
    readonly sinal?: AbortSignal
  }

  /** O job, como o executor o chama: no contexto da escola, com a tentativa e o sinal. */
  function rodar(escolaId: string, materialId: string, opcoes: Opcoes = {}): Promise<void> {
    const processador = criarExtracaoDoPdf({
      banco: bancada.banco,
      armazem: opcoes.armazemDoCaso ?? armazem,
      extrator: opcoes.extratorDoCaso ?? extrator,
      logger: log.logger,
      medidor: opcoes.medidor?.medidor,
    })
    return naEscola(escolaId, () => processador({ materialId }, jobExecution(randomUUID(), opcoes.tentativa ?? 1), opcoes.sinal ?? new AbortController().signal))
  }

  /** Um ponto de espera: o teste solta quando quiser. */
  function barreira(): { espera: Promise<void>; soltar: () => void } {
    let soltar: () => void = () => undefined
    const espera = new Promise<void>((resolver) => {
      soltar = resolver
    })
    return { espera, soltar }
  }

  describe('o caminho feliz', () => {
    it('`pronto`, um trecho por página, as duas colunas; o objeto só sai depois do commit', async () => {
      const c = await escolaNova()
      const id = await materialComObjeto(c)
      const apagar = armazem.apagar.bind(armazem)
      const vistoNoApagar: Array<{ estado: string; trechos: number }> = []
      armazem.apagar = async (chave) => {
        // Outra conexão: só enxerga o que já deu commit.
        vistoNoApagar.push({ estado: (await linha(id)).estado, trechos: (await trechos(id)).length })
        return apagar(chave)
      }
      try {
        await rodar(c.escolaId, id)
      } finally {
        armazem.apagar = apagar
      }

      expect(vistoNoApagar).toEqual([{ estado: 'pronto', trechos: 6 }])
      expect(await linha(id)).toMatchObject({ estado: 'pronto', falha: null, paginas: 6 })
      expect((await linha(id)).processado_em).toBeInstanceOf(Date)
      expect((await linha(id)).objeto_apagado_em).toBeInstanceOf(Date)
      expect(await trechos(id)).toEqual([1, 2, 3, 4, 5, 6])
      expect(await temObjeto(c.escolaId, id)).toBe(false)
    })

    it('o storage recusando apagar: o material fica `pronto`, o job conclui, e `objeto_apagado_em` fica nulo para a varredura', async () => {
      const c = await escolaNova()
      const dele = new InMemoryFileStorage()
      const id = await materialComObjeto(c, PDF_DE_DEMONSTRACAO, { armazemDoObjeto: dele })
      dele.falhaAoApagar = true

      await rodar(c.escolaId, id, { armazemDoCaso: dele })

      expect(await linha(id)).toMatchObject({ estado: 'pronto', objeto_apagado_em: null })
      expect(await trechos(id)).toHaveLength(6)
      expect(await temObjeto(c.escolaId, id, dele)).toBe(true)
      expect(log.registros().some((linhaDoLog) => linhaDoLog['evento'] === 'material.objeto_nao_apagado' && linhaDoLog['materialId'] === id)).toBe(true)
    })
  })

  describe('falha numa tentativa só', () => {
    it.each([
      { caso: 'PDF sem texto', arquivo: pdfSemTexto, falha: 'sem_texto' },
      { caso: 'PDF corrompido', arquivo: pdfCorrompido, falha: 'arquivo_invalido' },
    ])('$caso: `falhou` com o motivo, o objeto apagado, a tentativa 1 conclui sem lançar (vaga liberada)', async ({ arquivo, falha }) => {
      const c = await escolaNova()
      const id = await materialComObjeto(c, arquivo())

      await expect(rodar(c.escolaId, id, { tentativa: 1 })).resolves.toBeUndefined()

      expect(await linha(id)).toMatchObject({ estado: 'falhou', falha, paginas: null })
      expect((await linha(id)).objeto_apagado_em).toBeInstanceOf(Date)
      expect(await temObjeto(c.escolaId, id)).toBe(false)
      expect(await trechos(id)).toEqual([])
    })

    it('objeto ausente de material `processando`: `extracao_falhou`, sem valor novo em `falha`, `arquivo_ausente` no log à parte de `extracao_falhou`, e na métrica', async () => {
      const c = await escolaNova()
      const id = await materialComObjeto(c, null)
      const medidor = new MedidorDeTeste()
      const inicio = log.registros().length

      try {
        await expect(rodar(c.escolaId, id, { medidor })).resolves.toBeUndefined()
        expect(await medidor.pontos(METRICS.extracaoDoMaterial)).toEqual([{ atributos: { resultado: 'arquivo_ausente' }, valor: 1 }])
      } finally {
        await medidor.encerrar()
      }

      expect(await linha(id)).toMatchObject({ estado: 'falhou', falha: 'extracao_falhou' })
      const novas = log.registros().slice(inicio)
      expect(novas.filter((registro) => registro['evento'] === 'material.arquivo_ausente')).toEqual([expect.objectContaining({ materialId: id, codigo: 'extracao_falhou', tentativa: 1 })])
      expect(novas.filter((registro) => registro['evento'] === 'material.extracao_falhou')).toEqual([])
    })

    it('objeto ausente de material que já saiu de `processando` (extraído por outro job, excluído): conclui sem efeito, sem falha, sem `arquivo_ausente`', async () => {
      const c = await escolaNova()
      const pronto = await materialComObjeto(c, null, { estado: 'pronto' })
      const excluido = await materialComObjeto(c, null, { excluido: true })
      const medidor = new MedidorDeTeste()
      const inicio = log.registros().length

      try {
        await rodar(c.escolaId, pronto, { medidor })
        await rodar(c.escolaId, excluido, { medidor })
        expect(await medidor.pontos(METRICS.extracaoDoMaterial)).toEqual([{ atributos: { resultado: 'sem_efeito' }, valor: 2 }])
      } finally {
        await medidor.encerrar()
      }

      expect(await linha(pronto)).toMatchObject({ estado: 'pronto', falha: null })
      expect(await linha(excluido)).toMatchObject({ estado: 'processando', falha: null })
      expect(log.registros().slice(inicio).filter((registro) => registro['evento'] === 'material.arquivo_ausente' || registro['evento'] === 'material.extracao_falhou')).toEqual([])
      expect(log.registros().slice(inicio).filter((registro) => registro['evento'] === 'material.extracao_sem_efeito')).toHaveLength(2)
    })

    it('material que já saiu de `processando` ou foi excluído, com o objeto ainda no storage: o job nem lê o objeto, e ele fica', async () => {
      const c = await escolaNova()
      const dele = new InMemoryFileStorage()
      const pronto = await materialComObjeto(c, PDF_DE_DEMONSTRACAO, { estado: 'pronto', armazemDoObjeto: dele })
      const excluido = await materialComObjeto(c, PDF_DE_DEMONSTRACAO, { excluido: true, armazemDoObjeto: dele })
      const falhou = await materialComObjeto(c, PDF_DE_DEMONSTRACAO, { armazemDoObjeto: dele })
      await bancada.pool.query("update material set estado = 'falhou', falha = 'sem_texto' where id = $1", [falhou])
      let leituras = 0
      dele.aoLerBytes = () => {
        leituras += 1
        return Promise.resolve()
      }

      await rodar(c.escolaId, pronto, { armazemDoCaso: dele })
      await rodar(c.escolaId, excluido, { armazemDoCaso: dele })
      await rodar(c.escolaId, falhou, { armazemDoCaso: dele })

      expect(leituras).toBe(0)
      expect(await temObjeto(c.escolaId, pronto, dele)).toBe(true)
      expect(await temObjeto(c.escolaId, excluido, dele)).toBe(true)
      expect(await trechos(excluido)).toEqual([])
    })
  })

  describe('erro de extração: repete até a última tentativa', () => {
    const quebrado: Pick<PdfExtractor, 'extrair'> = { extrair: () => Promise.resolve({ falha: 'extracao_falhou' } satisfies ResultadoDaExtracao) }

    it('com tentativa sobrando o erro sobe, o material continua `processando` e o objeto fica para a próxima', async () => {
      const c = await escolaNova()
      const id = await materialComObjeto(c)

      await expect(rodar(c.escolaId, id, { tentativa: TENTATIVAS - 1, extratorDoCaso: quebrado })).rejects.toThrow()

      expect(await linha(id)).toMatchObject({ estado: 'processando', falha: null, objeto_apagado_em: null })
      expect(await temObjeto(c.escolaId, id)).toBe(true)
    })

    it('na última tentativa o material vira `falhou`, o objeto sai e o erro sobe para o job terminar `falhou`', async () => {
      const c = await escolaNova()
      const id = await materialComObjeto(c)
      const medidor = new MedidorDeTeste()

      try {
        await expect(rodar(c.escolaId, id, { tentativa: TENTATIVAS, extratorDoCaso: quebrado, medidor })).rejects.toThrow()
        expect(await medidor.pontos(METRICS.extracaoDoMaterial)).toEqual([{ atributos: { resultado: 'falhou' }, valor: 1 }])
      } finally {
        await medidor.encerrar()
      }

      expect(await linha(id)).toMatchObject({ estado: 'falhou', falha: 'extracao_falhou' })
      expect((await linha(id)).objeto_apagado_em).toBeInstanceOf(Date)
      expect(await temObjeto(c.escolaId, id)).toBe(false)
    })

    it('o desligamento além da graça ou o prazo (o sinal aborta) com o extrator que o ignora: na última tentativa o material fecha em `falhou` e o objeto sai; com tentativa sobrando, ele fica', async () => {
      const ignoraOSinal: Pick<PdfExtractor, 'extrair'> = { extrair: () => new Promise<ResultadoDaExtracao>(() => undefined) }
      const c = await escolaNova()
      const [ultima, sobrando] = [await materialComObjeto(c, variacaoDoPdf()), await materialComObjeto(c, variacaoDoPdf())]

      const jaAbortada = await materialComObjeto(c, variacaoDoPdf())
      for (const { id, tentativa, antes } of [
        { id: ultima, tentativa: TENTATIVAS, antes: false },
        { id: sobrando, tentativa: 1, antes: false },
        // O prazo venceu antes de o processador chegar ao extrator (na leitura do objeto, por exemplo): o sinal já veio abortado.
        { id: jaAbortada, tentativa: TENTATIVAS, antes: true },
      ]) {
        const controle = new AbortController()
        if (antes) controle.abort()
        const rodando = rodar(c.escolaId, id, { tentativa, extratorDoCaso: ignoraOSinal, sinal: controle.signal }).then(
          () => 'devolveu',
          () => 'rejeitou',
        )
        // O processador já está esperando o extrator: o sinal é o que o tira de lá. Preso mais de 2 s, o caso falha sem esperar o teto do teste.
        await new Promise((resolver) => setTimeout(resolver, 100))
        controle.abort()
        const desfecho = await Promise.race([rodando, new Promise<string>((resolver) => setTimeout(() => resolver('preso'), 2_000))])
        expect(desfecho, id).toBe('rejeitou')
      }

      for (const id of [ultima, jaAbortada]) {
        expect(await linha(id), id).toMatchObject({ estado: 'falhou', falha: 'extracao_falhou' })
        expect((await linha(id)).objeto_apagado_em, id).toBeInstanceOf(Date)
        expect(await temObjeto(c.escolaId, id), id).toBe(false)
      }
      expect(await linha(sobrando)).toMatchObject({ estado: 'processando', falha: null, objeto_apagado_em: null })
      expect(await temObjeto(c.escolaId, sobrando)).toBe(true)
    })

    it('o storage fora na leitura é erro da tentativa, e não objeto ausente: o material não vira `falhou` com tentativa sobrando', async () => {
      const c = await escolaNova()
      const dele = new InMemoryFileStorage()
      const id = await materialComObjeto(c, PDF_DE_DEMONSTRACAO, { armazemDoObjeto: dele })
      dele.fora = true

      await expect(rodar(c.escolaId, id, { tentativa: 1, armazemDoCaso: dele })).rejects.toThrow()

      expect(await linha(id)).toMatchObject({ estado: 'processando', falha: null })
      dele.fora = false
      expect(await temObjeto(c.escolaId, id, dele)).toBe(true)
    })
  })

  describe('concorrência (D49: o job repetido e o segundo job do mesmo material)', () => {
    it('[P] excluído entre `lerParaExtrair` e `lerBytes`: sem efeito, sem `falhou`, sem falha de job; a métrica diz `sem_efeito`', async () => {
      const c = await escolaNova()
      const dele = new InMemoryFileStorage()
      const id = await materialComObjeto(c, PDF_DE_DEMONSTRACAO, { armazemDoObjeto: dele })
      // O job leu a linha e vai ler o objeto; a coordenação exclui entre as duas coisas (e a API apaga o objeto).
      dele.aoLerBytes = async (chave) => {
        await bancada.pool.query('update material set excluido_em = now() where id = $1', [id])
        await dele.apagar(chave)
      }
      const medidor = new MedidorDeTeste()

      try {
        await expect(rodar(c.escolaId, id, { armazemDoCaso: dele, medidor })).resolves.toBeUndefined()
        expect(await medidor.pontos(METRICS.extracaoDoMaterial)).toEqual([{ atributos: { resultado: 'sem_efeito' }, valor: 1 }])
      } finally {
        await medidor.encerrar()
      }

      expect(await linha(id)).toMatchObject({ estado: 'processando', falha: null })
      expect((await linha(id)).excluido_em).toBeInstanceOf(Date)
      expect(await trechos(id)).toEqual([])
    })

    it('[P] o segundo job do mesmo material, parado até o primeiro dar commit: o material segue `pronto`, os trechos uma vez, e o segundo conclui sem efeito', async () => {
      const c = await escolaNova()
      const dele = new InMemoryFileStorage()
      const id = await materialComObjeto(c, PDF_DE_DEMONSTRACAO, { armazemDoObjeto: dele })
      const segundoParado = barreira()
      const segundoChegou = barreira()
      let leituras = 0
      dele.aoLerBytes = async () => {
        leituras += 1
        if (leituras === 1) {
          // O que chegou primeiro espera o outro chegar: nenhum dos dois depende de ter lido a linha antes do commit do outro.
          await segundoChegou.espera
          return
        }
        segundoChegou.soltar()
        await segundoParado.espera
      }
      const medidor = new MedidorDeTeste()

      try {
        // Os dois leram a linha `processando`; a barreira segura o segundo a ler o objeto até o primeiro dar commit e apagá-lo.
        const jobs = [rodar(c.escolaId, id, { armazemDoCaso: dele, medidor }), rodar(c.escolaId, id, { armazemDoCaso: dele, medidor })]
        await segundoChegou.espera
        // Só o que não está parado pode terminar: é o primeiro.
        await Promise.race(jobs)
        segundoParado.soltar()
        await Promise.all(jobs)
        const pontos = await medidor.pontos(METRICS.extracaoDoMaterial)
        expect(pontos).toEqual(expect.arrayContaining([{ atributos: { resultado: 'pronto' }, valor: 1 }, { atributos: { resultado: 'sem_efeito' }, valor: 1 }]))
      } finally {
        await medidor.encerrar()
      }

      expect(await linha(id)).toMatchObject({ estado: 'pronto', falha: null, paginas: 6 })
      expect(await trechos(id)).toEqual([1, 2, 3, 4, 5, 6])
    })

    it('[P] dois jobs do mesmo material em `Promise.all`, os dois com os bytes na mão: os trechos entram uma vez e o material fica `pronto`', async () => {
      const c = await escolaNova()
      const dele = new InMemoryFileStorage()
      const id = await materialComObjeto(c, PDF_DE_DEMONSTRACAO, { armazemDoObjeto: dele })
      // Os dois só leem o objeto quando os dois chegaram: nenhum dos dois o vê ausente.
      const juntos = barreira()
      let chegaram = 0
      dele.aoLerBytes = async () => {
        chegaram += 1
        if (chegaram === 2) juntos.soltar()
        await juntos.espera
      }

      const medidor = new MedidorDeTeste()

      try {
        await Promise.all([rodar(c.escolaId, id, { armazemDoCaso: dele, medidor }), rodar(c.escolaId, id, { armazemDoCaso: dele, medidor })])
        // Um dos dois saiu de `processando`; o outro, com os bytes na mão, chega à transição e não a acha.
        expect(await medidor.pontos(METRICS.extracaoDoMaterial)).toEqual(expect.arrayContaining([{ atributos: { resultado: 'pronto' }, valor: 1 }, { atributos: { resultado: 'sem_efeito' }, valor: 1 }]))
      } finally {
        await medidor.encerrar()
      }

      expect(await linha(id)).toMatchObject({ estado: 'pronto', falha: null, paginas: 6 })
      expect(await trechos(id)).toEqual([1, 2, 3, 4, 5, 6])
    })

    it.each([
      { caso: 'extração com texto', resultado: { falha: null, paginas: 2, trechos: [{ pagina: 1, texto: 'a' }, { pagina: 2, texto: 'b' }], capitulos: [{ ordem: 1, numero: 1, titulo: 'Capítulo 1', paginaInicial: 1, paginaFinal: 2 }] } satisfies ResultadoDaExtracao },
      { caso: 'extração sem texto', resultado: { falha: 'sem_texto' } satisfies ResultadoDaExtracao },
    ])('[P] excluído enquanto o PDF é extraído ($caso): sem trecho, sem capítulo, sem `falhou`, sem falha de job, a métrica diz `sem_efeito`', async ({ resultado }) => {
      const c = await escolaNova()
      const id = await materialComObjeto(c)
      const medidor = new MedidorDeTeste()
      // O job leu a linha e o objeto; a coordenação exclui antes de o job gravar o resultado.
      const extratorQueEExcluido: Pick<PdfExtractor, 'extrair'> = {
        extrair: async () => {
          await bancada.pool.query('update material set excluido_em = now() where id = $1', [id])
          return resultado
        },
      }

      try {
        await expect(rodar(c.escolaId, id, { extratorDoCaso: extratorQueEExcluido, medidor })).resolves.toBeUndefined()
        expect(await medidor.pontos(METRICS.extracaoDoMaterial)).toEqual([{ atributos: { resultado: 'sem_efeito' }, valor: 1 }])
      } finally {
        await medidor.encerrar()
      }

      expect(await linha(id)).toMatchObject({ estado: 'processando', falha: null, paginas: null })
      expect(await trechos(id)).toEqual([])
      expect(await capitulos(id)).toEqual([])
      expect(await temObjeto(c.escolaId, id)).toBe(true)
    })

    it('o job repetido depois de `pronto` não faz nada: nem trecho a mais, nem muda o instante do processamento', async () => {
      const c = await escolaNova()
      const id = await materialComObjeto(c)
      await rodar(c.escolaId, id)
      const antes = await linha(id)

      await bancada.pool.query('select pg_sleep(0.05)')
      await rodar(c.escolaId, id)

      expect(await linha(id)).toEqual(antes)
      expect(await trechos(id)).toHaveLength(6)
    })
  })

  describe('isolamento entre escolas (regra 10)', () => {
    it('o repository: `lerParaExtrair` com o id da B no contexto da A não acha nada, e o da A acha', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const deB = await materialComObjeto(b)
      const deA = await materialComObjeto(a)

      expect(await naEscola(a.escolaId, () => new ExtracaoDoMaterialRepository(bancada.banco).lerParaExtrair(deB))).toBeUndefined()
      expect(await naEscola(a.escolaId, () => new ExtracaoDoMaterialRepository(bancada.banco).lerParaExtrair(deA))).toEqual({ id: deA, disciplinaId: a.disciplinaId })
      // Sem escola no contexto, falha fechado.
      await expect(runInContext({ requisicaoId: randomUUID() }, () => new ExtracaoDoMaterialRepository(bancada.banco).lerParaExtrair(deA))).rejects.toThrow()
    })

    it('o repository: marcar pronto, falhou ou objeto apagado, e listar os excluídos, com a escola A no contexto, não alcançam o material da B', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const processandoDeB = await materialComObjeto(b)
      const excluidoDeB = await materialComObjeto(b, PDF_DE_DEMONSTRACAO, { excluido: true })
      const repositorioDaA = (): ExtracaoDoMaterialRepository => new ExtracaoDoMaterialRepository(bancada.banco)

      expect(await naEscola(a.escolaId, () => repositorioDaA().marcarPronto(processandoDeB, 3))).toBeUndefined()
      expect(await naEscola(a.escolaId, () => repositorioDaA().marcarFalhou(processandoDeB, 'sem_texto'))).toBe(false)
      await naEscola(a.escolaId, () => repositorioDaA().marcarObjetoApagado(excluidoDeB))
      expect(await naEscola(a.escolaId, () => repositorioDaA().excluidosComObjeto(undefined, 100))).toEqual([])

      expect(await linha(processandoDeB)).toMatchObject({ estado: 'processando', falha: null, paginas: null, processado_em: null })
      expect((await linha(excluidoDeB)).objeto_apagado_em).toBeNull()
      expect(await naEscola(b.escolaId, () => new ExtracaoDoMaterialRepository(bancada.banco).excluidosComObjeto(undefined, 100))).toEqual([excluidoDeB])
    })

    it('o repository: `objeto_apagado_em` guarda o primeiro instante, o cursor do expurgo segue o id, e o lote precisa de tamanho', async () => {
      const c = await escolaNova()
      const primeiro = await materialComObjeto(c, PDF_DE_DEMONSTRACAO, { excluido: true })
      const segundo = await materialComObjeto(c, PDF_DE_DEMONSTRACAO, { excluido: true })
      const [menor, maior] = [primeiro, segundo].sort()
      const repositorio = (): ExtracaoDoMaterialRepository => new ExtracaoDoMaterialRepository(bancada.banco)

      expect(await naEscola(c.escolaId, () => repositorio().excluidosComObjeto(undefined, 100))).toEqual([menor, maior])
      expect(await naEscola(c.escolaId, () => repositorio().excluidosComObjeto(menor, 100))).toEqual([maior])
      expect(await naEscola(c.escolaId, () => repositorio().excluidosComObjeto(undefined, 1))).toEqual([menor])
      await expect(naEscola(c.escolaId, () => repositorio().excluidosComObjeto(undefined, 0))).rejects.toThrow()

      await naEscola(c.escolaId, () => repositorio().marcarObjetoApagado(primeiro))
      const instante = (await linha(primeiro)).objeto_apagado_em
      expect(instante).toBeInstanceOf(Date)
      await bancada.pool.query('select pg_sleep(0.05)')
      await naEscola(c.escolaId, () => repositorio().marcarObjetoApagado(primeiro))
      expect((await linha(primeiro)).objeto_apagado_em).toEqual(instante)
      expect(await naEscola(c.escolaId, () => repositorio().excluidosComObjeto(undefined, 100))).toEqual([segundo])
    })

    it('o job da A com o id de um material da B: nada é lido, gravado nem apagado, e o material da B segue `processando` com o objeto', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const dele = new InMemoryFileStorage()
      const deB = await materialComObjeto(b, PDF_DE_DEMONSTRACAO, { armazemDoObjeto: dele })
      let leituras = 0
      dele.aoLerBytes = () => {
        leituras += 1
        return Promise.resolve()
      }

      await expect(rodar(a.escolaId, deB, { armazemDoCaso: dele })).resolves.toBeUndefined()

      expect(leituras).toBe(0)
      expect(await linha(deB)).toMatchObject({ estado: 'processando', falha: null, objeto_apagado_em: null, processado_em: null })
      expect(await trechos(deB)).toEqual([])
      expect(await temObjeto(b.escolaId, deB, dele)).toBe(true)
    })
  })

  describe('log e métrica (regra 20, itens 7 e 9)', () => {
    it('as linhas levam ids, tentativa, códigos e contagens: nunca título, nome de arquivo, licenciante nem texto do PDF', async () => {
      const c = await escolaNova()
      const id = await materialComObjeto(c)
      const semTexto = await materialComObjeto(c, pdfSemTexto())
      const inicio = log.registros().length

      await rodar(c.escolaId, id)
      await rodar(c.escolaId, semTexto)

      const novas = log.registros().slice(inicio)
      expect(novas.find((registro) => registro['evento'] === 'material.extraido')).toMatchObject({ materialId: id, paginasTotal: 6, trechosTotal: 6, tentativa: 1, escolaId: c.escolaId })
      expect(novas.find((registro) => registro['evento'] === 'material.extracao_falhou')).toMatchObject({ materialId: semTexto, codigo: 'sem_texto' })
      const todo = JSON.stringify(novas)
      for (const sentinela of ['Título que nunca vai ao log', 'Estequiometria', 'estequiometria', 'reagente']) expect(todo, sentinela).not.toContain(sentinela)
    })

    it('a métrica leva só o resultado, nunca a escola nem o material', async () => {
      const c = await escolaNova()
      const id = await materialComObjeto(c)
      const medidor = new MedidorDeTeste()
      try {
        await rodar(c.escolaId, id, { medidor })
        const todas = await medidor.atributosDeTodas()
        expect(todas.filter(({ nome }) => nome === 'material_extracao' || nome === 'material.extracao' || nome === 'material.extracao.duracao').length).toBeGreaterThan(0)
        for (const { atributos } of todas) expect(Object.keys(atributos)).toEqual(['resultado'])
        expect(await medidor.pontos(METRICS.duracaoDaExtracaoDoMaterial)).toEqual([{ atributos: { resultado: 'pronto' }, valor: { contagem: 1, soma: expect.any(Number) as number } }])
      } finally {
        await medidor.encerrar()
      }
    })
  })

  describe('a migration (checks de fila e de vagas)', () => {
    it('o check da fila de `job_registro` aceita `pdf` e continua recusando fila que não existe', async () => {
      const c = await escolaNova()
      const gravar = (fila: string) =>
        bancada.pool.query(
          "insert into job_registro (escola_id, tipo, fila, prioridade, nao_urgente, dados) values ($1, 'material.extrair-pdf', $2, 4, false, '{}'::jsonb)",
          [c.escolaId, fila],
        )
      await expect(gravar('pdf')).resolves.toBeDefined()
      await expect(gravar('prioritaria')).rejects.toThrow(/check/)
    })

    it('o check das vagas da escola aceita `pdf` e continua recusando fila que não existe e vaga que não é inteiro positivo', async () => {
      const c = await escolaNova()
      const configurar = (vagas: Record<string, unknown>) =>
        bancada.pool.query('insert into configuracao_operacional_escola (escola_id, vagas) values ($1, $2) on conflict (escola_id) do update set vagas = excluded.vagas', [c.escolaId, JSON.stringify(vagas)])
      await expect(configurar({ pdf: 1 })).resolves.toBeDefined()
      await expect(configurar({ prioritaria: 1 })).rejects.toThrow(/check/)
      await expect(configurar({ pdf: 0 })).rejects.toThrow(/check/)
    })

    it('os `UPDATE` da migration tiram todo material antigo da varredura do objeto e fecham o `processando` que a API anterior deixou, que passa a poder ser enviado de novo', async () => {
      const c = await escolaNova()
      const outra = await escolaNova()
      const antigoProcessando = await materialComObjeto(c, null)
      const antigoExcluido = await materialComObjeto(c, null, { excluido: true })
      const antigoPronto = await materialComObjeto(c, null, { estado: 'pronto' })
      const deOutraEscola = await materialComObjeto(outra, null)
      const texto = readFileSync(new URL('../../../packages/core/drizzle/0049_material_extracao_no_worker.sql', import.meta.url), 'utf8')
      const atualizacoes = texto
        .split('--> statement-breakpoint')
        .map((comando) => comando.replace(/^--.*$/gm, '').trim().replace(/;$/, ''))
        .filter((comando) => comando.startsWith('UPDATE "material"'))
      expect(atualizacoes).toHaveLength(2)

      // Só a escola do caso: o banco de teste tem o material de todas as outras execuções.
      for (const atualizacao of atualizacoes) await bancada.pool.query(atualizacao.replace(' WHERE ', ' WHERE "escola_id" = $1 AND '), [c.escolaId])

      for (const id of [antigoProcessando, antigoExcluido, antigoPronto]) expect((await linha(id)).objeto_apagado_em, id).toBeInstanceOf(Date)
      expect(await linha(antigoProcessando)).toMatchObject({ estado: 'falhou', falha: 'extracao_falhou' })
      expect((await linha(antigoProcessando)).processado_em).toBeInstanceOf(Date)
      expect(await linha(antigoExcluido)).toMatchObject({ estado: 'falhou', falha: 'extracao_falhou' })
      expect(await linha(antigoPronto)).toMatchObject({ estado: 'pronto', falha: null })
      expect(await linha(deOutraEscola)).toMatchObject({ estado: 'processando', falha: null, objeto_apagado_em: null })
    })

    it('o material tem as duas colunas novas, nulas ao nascer, e o índice parcial do objeto a apagar', async () => {
      const c = await escolaNova()
      const id = await materialComObjeto(c, null)
      expect(await linha(id)).toMatchObject({ processado_em: null, objeto_apagado_em: null })
      const { rows } = await bancada.pool.query<{ indexdef: string }>("select indexdef from pg_indexes where indexname = 'material_objeto_a_apagar_idx'")
      expect(rows[0]?.indexdef).toMatch(/objeto_apagado_em IS NULL/)
    })
  })

  describe('pelo worker de verdade (prazo, desligamento, vaga por escola)', () => {
    /** A definição de produção com o prazo e o recuo curtos, para o corte acontecer em décimos de segundo. */
    const definicoesCurtas = (prazoMs: number): JobRegistry => ({
      ...JOB_DEFINITIONS,
      [TIPO_EXTRAIR_PDF]: { ...JOB_DEFINITIONS[TIPO_EXTRAIR_PDF], prazoMs, retentativa: { ...JOB_DEFINITIONS[TIPO_EXTRAIR_PDF].retentativa, recuoMs: 50, jitter: 0 } },
    })

    /** Um extrator que só termina quando o sinal manda, como a leitura de um PDF que passou do prazo: devolve `extracao_falhou`. */
    const extratorQueEspera: Pick<PdfExtractor, 'extrair'> = {
      extrair: (_bytes, sinal) => new Promise<ResultadoDaExtracao>((resolver) => sinal?.addEventListener('abort', () => resolver({ falha: 'extracao_falhou' }), { once: true })),
    }

    /** Publica como o despachante: reserva, põe na fila `pdf` com as opções do tipo (e as tentativas pedidas) e marca publicado. */
    async function publicado(bancadaDoCaso: QueueFixtures, c: Cenario, materialId: string, tentativas = TENTATIVAS): Promise<string> {
      const id = await bancadaDoCaso.enfileirar(c.escolaId, { tipo: TIPO_EXTRAIR_PDF, fila: 'pdf', dados: { materialId } })
      await bancadaDoCaso.reservar(c.escolaId, 'pdf')
      await bancadaDoCaso.filas.pdf.add(TIPO_EXTRAIR_PDF, { escolaId: c.escolaId, requisicaoId: null }, { ...jobOptions(TIPO_EXTRAIR_PDF), attempts: tentativas, backoff: { type: 'fixed', delay: 50 }, jobId: id })
      await naEscola(c.escolaId, () => bancadaDoCaso.despacho.marcarPublicados([id]))
      return id
    }

    async function aguardarEstado(bancadaDoCaso: QueueFixtures, id: string, estado: string, limiteMs = 30_000): Promise<void> {
      await expect.poll(async () => (await bancadaDoCaso.estado(id))?.estado, { timeout: limiteMs, interval: 50 }).toBe(estado)
    }

    function workerDoPdf(bancadaDoCaso: QueueFixtures, extratorDoCaso: Pick<PdfExtractor, 'extrair'>, opcoes: { graca?: number; processadorDoCaso?: JobProcessors[typeof TIPO_EXTRAIR_PDF] } = {}) {
      const logDoWorker = new InMemoryLog('worker-pdf')
      const { processadorDoCaso, ...doWorker } = opcoes
      const montado = bancadaDoCaso.worker(logDoWorker, {
        pools: { pdf: 1 },
        ...doWorker,
        processadores: { [TIPO_EXTRAIR_PDF]: processadorDoCaso ?? criarExtracaoDoPdf({ banco: bancadaDoCaso.banco, armazem, extrator: extratorDoCaso, logger: logDoWorker.logger }) },
      })
      return { montado, logDoWorker }
    }

    it('a réplica da fila `pdf` sobe com um PDF por vez, o lock de 60 s e a verificação de stalled de 20 s, os de `WORKER_POOL_OPTIONS_BY_QUEUE`, e o lock vale mais que a verificação', () => {
      const bancadaDoCaso = new QueueFixtures()
      const { montado } = workerDoPdf(bancadaDoCaso, extrator)
      try {
        const worker = montado.workers.get('pdf')
        expect(worker?.opts).toMatchObject({ concurrency: 1, lockDuration: 60_000, stalledInterval: 20_000 })
        expect(WORKER_POOL_OPTIONS_BY_QUEUE.pdf).toEqual({ lockDurationMs: 60_000, stalledIntervalMs: 20_000 })
        // O lock maior que a verificação: a extração que só renova o lock entre uma página e outra não é dada por parada e repetida.
        expect(WORKER_POOL_OPTIONS_BY_QUEUE.pdf.lockDurationMs).toBeGreaterThan(WORKER_POOL_OPTIONS_BY_QUEUE.pdf.stalledIntervalMs)
        expect([...montado.workers.keys()]).toEqual(['pdf'])
      } finally {
        void montado.encerrar().then(() => bancadaDoCaso.fechar())
      }
    })

    it('prazo: cada tentativa estoura em `TEMPO_ESGOTADO` e a vaga sai; na 3ª o job e o material ficam `falhou` e o objeto é apagado', async () => {
      const bancadaDoCaso = new QueueFixtures(definicoesCurtas(300))
      try {
        const c = { escolaId: await bancadaDoCaso.escola(), disciplinaId: '' }
        const { rows } = await bancadaDoCaso.pool.query<{ id: string }>("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [c.escolaId])
        const cenario = { ...c, disciplinaId: rows[0]?.id ?? '' }
        const materialId = await materialComObjeto(cenario)
        const id = await publicado(bancadaDoCaso, cenario, materialId)
        const { montado, logDoWorker } = workerDoPdf(bancadaDoCaso, extratorQueEspera)

        try {
          await aguardarEstado(bancadaDoCaso, id, 'falhou')
          expect(await bancadaDoCaso.estado(id)).toEqual({ estado: 'falhou', escolaId: c.escolaId, codigoFalha: JobFailureCode.TEMPO_ESGOTADO })
          expect(logDoWorker.doEvento('job.tempo_esgotado')).toHaveLength(TENTATIVAS)
          await expect.poll(() => bancadaDoCaso.vagas.membros('pdf', c.escolaId), { timeout: 5_000, interval: 50 }).toEqual([])
          // A última tentativa recebeu o sinal, gravou a falha do material e apagou o objeto.
          await expect.poll(async () => (await linha(materialId)).estado, { timeout: 10_000, interval: 50 }).toBe('falhou')
          expect(await linha(materialId)).toMatchObject({ falha: 'extracao_falhou' })
          await expect.poll(() => temObjeto(c.escolaId, materialId), { timeout: 10_000, interval: 50 }).toBe(false)
        } finally {
          await montado.encerrar()
        }
      } finally {
        await bancadaDoCaso.fechar()
      }
    }, 60_000)

    /** Um extrator que nunca devolve, como o PDF que o desligamento pega no meio: só a graça encerra o worker. */
    const extratorQueNaoTermina: Pick<PdfExtractor, 'extrair'> = { extrair: () => new Promise<ResultadoDaExtracao>(() => undefined) }
    /** O processador que nunca devolve: o processo que o desligamento pega no meio e que não chega a fechar o material. */
    const processadorQueNaoTermina: JobProcessors[typeof TIPO_EXTRAIR_PDF] = () => new Promise<void>(() => undefined)

    it('SIGTERM além da graça: com tentativa sobrando o job segue `ativo` e o objeto fica; na última, o job termina `falhou/EXECUCAO_INTERROMPIDA` e a vaga sai', async () => {
      const bancadaDoCaso = new QueueFixtures()
      try {
        const escolaId = await bancadaDoCaso.escola()
        const { rows } = await bancadaDoCaso.pool.query<{ id: string }>("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [escolaId])
        const cenario = { escolaId, disciplinaId: rows[0]?.id ?? '' }

        // Com tentativa sobrando: nada é dado como perdido. A linha segue ativa para outra réplica retomar (D49), e o objeto fica com ela.
        const sobrando = await materialComObjeto(cenario)
        const idSobrando = await publicado(bancadaDoCaso, cenario, sobrando, TENTATIVAS)
        const primeiro = workerDoPdf(bancadaDoCaso, extratorQueNaoTermina, { graca: 500, processadorDoCaso: processadorQueNaoTermina })
        await aguardarEstado(bancadaDoCaso, idSobrando, 'ativo')
        await primeiro.montado.encerrar()
        expect(await bancadaDoCaso.estado(idSobrando)).toEqual({ estado: 'ativo', escolaId, codigoFalha: null })
        expect(primeiro.logDoWorker.doEvento('job.falhou')).toEqual([])
        expect(await linha(sobrando)).toMatchObject({ estado: 'processando', falha: null })
        expect(await temObjeto(escolaId, sobrando)).toBe(true)

        // Na última tentativa o job não tem outra: termina `falhou` e a vaga sai. O processador deste caso não devolve nunca (o processo que morreu
        // no meio): o material fica `processando` e o objeto fica, e quem os fecha é o "Descartar" da 3.0, que o alerta de job falhou de vez chama.
        // Com o processo vivo, o processador fecha o material sozinho: o caso "o desligamento além da graça…", abaixo.
        const ultimo = await materialComObjeto(cenario, variacaoDoPdf())
        const idUltimo = await publicado(bancadaDoCaso, cenario, ultimo, 1)
        const segundo = workerDoPdf(bancadaDoCaso, extratorQueNaoTermina, { graca: 500, processadorDoCaso: processadorQueNaoTermina })
        await aguardarEstado(bancadaDoCaso, idUltimo, 'ativo')
        await segundo.montado.encerrar()
        expect(await bancadaDoCaso.estado(idUltimo)).toEqual({ estado: 'falhou', escolaId, codigoFalha: JobFailureCode.EXECUCAO_INTERROMPIDA })
        expect(await bancadaDoCaso.vagas.membros('pdf', escolaId)).not.toContain(idUltimo)
        expect(segundo.logDoWorker.doEvento('job.falhou')).toEqual([expect.objectContaining({ jobId: idUltimo, codigo: JobFailureCode.EXECUCAO_INTERROMPIDA })])
        expect(await linha(ultimo)).toMatchObject({ estado: 'processando', falha: null })
        expect(await temObjeto(escolaId, ultimo)).toBe(true)
      } finally {
        await bancadaDoCaso.fechar()
      }
    }, 60_000)

    it('a vaga da escola: A com 10 PDFs pendentes e vaga 2 não segura a B, que conclui antes do último de A', async () => {
      const bancadaDoCaso = new QueueFixtures()
      try {
        const a = { escolaId: await bancadaDoCaso.escola(), disciplinaId: '' }
        const b = { escolaId: await bancadaDoCaso.escola(), disciplinaId: '' }
        const disciplinas = await Promise.all(
          [a, b].map(async (escola) => (await bancadaDoCaso.pool.query<{ id: string }>("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [escola.escolaId])).rows[0]?.id ?? ''),
        )
        const [cenarioA, cenarioB] = [{ ...a, disciplinaId: disciplinas[0] ?? '' }, { ...b, disciplinaId: disciplinas[1] ?? '' }]
        // O PDF de A demora: cada extração segura a vaga por 400 ms, e o da B é imediato.
        const concluidos: Array<{ escola: string; material: string }> = []
        const lento: Pick<PdfExtractor, 'extrair'> = {
          extrair: async (bytes, sinal) => {
            await new Promise((resolver) => setTimeout(resolver, 400))
            return extrator.extrair(bytes, sinal)
          },
        }
        const idsDeA: string[] = []
        for (let indice = 0; indice < 10; indice += 1) {
          const material = await materialComObjeto(cenarioA, variacaoDoPdf())
          idsDeA.push(await publicado(bancadaDoCaso, cenarioA, material))
        }
        const materialDeB = await materialComObjeto(cenarioB, variacaoDoPdf())
        const idDeB = await publicado(bancadaDoCaso, cenarioB, materialDeB)
        const logDoWorker = new InMemoryLog('worker-pdf')
        const montado = bancadaDoCaso.worker(logDoWorker, {
          pools: { pdf: 6 },
          processadores: { [TIPO_EXTRAIR_PDF]: criarExtracaoDoPdf({ banco: bancadaDoCaso.banco, armazem, extrator: lento, logger: logDoWorker.logger }) },
        })

        try {
          await aguardarEstado(bancadaDoCaso, idDeB, 'concluido')
          for (const id of idsDeA) {
            const estado = (await bancadaDoCaso.estado(id))?.estado
            if (estado === 'concluido') concluidos.push({ escola: 'A', material: id })
          }
          // A vaga é 2: com 6 de pool e 10 pendentes, A nunca tem mais de 2 ao mesmo tempo, e a B não espera A inteira.
          expect(concluidos.length).toBeLessThan(idsDeA.length)
          const { rows: ativosDeA } = await bancadaDoCaso.pool.query<{ total: number }>("select count(*)::int as total from job_registro where escola_id = $1 and estado = 'ativo'", [a.escolaId])
          expect(ativosDeA[0]?.total ?? 0).toBeLessThanOrEqual(2)
        } finally {
          await montado.encerrar()
        }
      } finally {
        await bancadaDoCaso.fechar()
      }
    }, 60_000)
  })

  describe('capítulos lidos do PDF (ingestao-do-material, tarefa 4.0; Tech Spec, seção 5, "Capítulos")', () => {
    const CAPITULOS_DO_MARCADOR = [
      { ordem: 1, numero: 1, titulo: 'Capítulo 1: Mol e massa molar', pagina_inicial: 1, pagina_final: 2 },
      { ordem: 2, numero: 2, titulo: 'Capítulo 2: Reações químicas', pagina_inicial: 3, pagina_final: 4 },
      { ordem: 3, numero: null, titulo: 'Soluções', pagina_inicial: 5, pagina_final: 6 },
    ]

    it('[I] caminho feliz com marcador: os capítulos entram com os trechos, na escola do material, e o material fica `pronto`', async () => {
      const c = await escolaNova()
      const id = await materialComObjeto(c, pdfDaAmostra('marcador'))

      await rodar(c.escolaId, id)

      expect(await linha(id)).toMatchObject({ estado: 'pronto', falha: null, paginas: 6 })
      expect(await trechos(id)).toEqual([1, 2, 3, 4, 5, 6])
      const gravados = await capitulos(id)
      expect(gravados.map(({ escola_id: escolaId }) => escolaId)).toEqual([c.escolaId, c.escolaId, c.escolaId])
      expect(gravados.map(({ escola_id: _escola, ...resto }) => resto)).toEqual(CAPITULOS_DO_MARCADOR)
    })

    it('[I] PDF sem capítulo (o material de demonstração e a amostra sem nada) termina `pronto`, com zero capítulos', async () => {
      const c = await escolaNova()
      for (const bytes of [PDF_DE_DEMONSTRACAO, pdfDaAmostra('sem capítulo')]) {
        const id = await materialComObjeto(c, bytes)
        await rodar(c.escolaId, id)
        expect(await linha(id)).toMatchObject({ estado: 'pronto', falha: null, paginas: 6 })
        expect(await trechos(id)).toHaveLength(6)
        expect(await capitulos(id)).toEqual([])
      }
    })

    it('[P] dois jobs da mesma extração em `Promise.all`, os dois com os bytes na mão: os capítulos entram uma vez: um job conclui `pronto` e o outro `sem_efeito`', async () => {
      const c = await escolaNova()
      const dele = new InMemoryFileStorage()
      const id = await materialComObjeto(c, pdfDaAmostra('marcador'), { armazemDoObjeto: dele })
      // Os dois só leem o objeto quando os dois chegaram: nenhum o vê ausente, e os dois chegam à transição com os capítulos na mão.
      const juntos = barreira()
      let chegaram = 0
      dele.aoLerBytes = async () => {
        chegaram += 1
        if (chegaram === 2) juntos.soltar()
        await juntos.espera
      }

      const medidor = new MedidorDeTeste()

      try {
        await Promise.all([rodar(c.escolaId, id, { armazemDoCaso: dele, medidor }), rodar(c.escolaId, id, { armazemDoCaso: dele, medidor })])
        // Um dos dois grava os capítulos e sai de `processando`; o outro, com os capítulos na mão, chega à transição, não a acha e não grava nada.
        expect(await medidor.pontos(METRICS.extracaoDoMaterial)).toEqual(expect.arrayContaining([{ atributos: { resultado: 'pronto' }, valor: 1 }, { atributos: { resultado: 'sem_efeito' }, valor: 1 }]))
      } finally {
        await medidor.encerrar()
      }

      expect(await linha(id)).toMatchObject({ estado: 'pronto', falha: null, paginas: 6 })
      expect((await capitulos(id)).map(({ escola_id: _escola, ...resto }) => resto)).toEqual(CAPITULOS_DO_MARCADOR)
    })

    it('o repository: `gravarCapitulos` sem capítulo não grava nada e não falha; com o id da B no contexto da A, a FK composta o recusa e nada é gravado', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const deB = await materialComObjeto(b, null)
      const deA = await materialComObjeto(a, null)
      const umCapitulo = [{ ordem: 1, numero: 1, titulo: 'Capítulo 1', paginaInicial: 1, paginaFinal: 2 }]
      const naA = (funcao: (repositorio: ExtracaoDoMaterialRepository) => Promise<void>): Promise<void> => naEscola(a.escolaId, () => funcao(new ExtracaoDoMaterialRepository(bancada.banco)))

      await expect(naA((repositorio) => repositorio.gravarCapitulos(deA, []))).resolves.toBeUndefined()
      expect(await capitulos(deA)).toEqual([])
      await expect(naA((repositorio) => repositorio.gravarCapitulos(deB, umCapitulo))).rejects.toMatchObject({ cause: { constraint: 'capitulo_do_material_da_escola_fk' } })
      expect(await capitulos(deB)).toEqual([])
      await naA((repositorio) => repositorio.gravarCapitulos(deA, umCapitulo))
      expect(await capitulos(deA)).toHaveLength(1)
    })

    /**
     * A tabela da migration `0051`, provada de duas formas: **a que a migration cria** (o arquivo `.sql` é lido e aplicado num esquema de teste, e o teste roda sobre
     * essa tabela) e **a migrada** do banco de teste. A primeira deixa o teste ficar vermelho quando o SQL perde uma restrição; a segunda confere que o banco
     * migrado a tem. Os dois apontam para o `material` e o `escola` reais: a FK composta e a cascata são exercidas de verdade.
     */
    describe.each([{ origem: 'a tabela que a migration 0051 cria' as const }, { origem: 'a tabela migrada' as const }])('restrições do banco: $origem', ({ origem }) => {
      const esquema = origem === 'a tabela migrada' ? 'public' : `capitulo_teste_${randomUUID().replaceAll('-', '')}`
      const tabela = `"${esquema}"."capitulo_do_material"`

      beforeAll(async () => {
        if (esquema === 'public') return
        const cliente: PoolClient = await bancada.pool.connect()
        try {
          await cliente.query(`create schema "${esquema}"`)
          await cliente.query(`set search_path = "${esquema}", public`)
          for (const instrucao of MIGRATION_DOS_CAPITULOS.split('--> statement-breakpoint')) await cliente.query(instrucao)
        } finally {
          await cliente.query('reset search_path')
          cliente.release()
        }
      })

      afterAll(async () => {
        if (esquema !== 'public') await bancada.pool.query(`drop schema "${esquema}" cascade`)
      })

      const inserir = (escolaId: string, materialId: string, campos: { ordem?: number; numero?: number | null; titulo?: string; inicial?: number; final?: number } = {}): Promise<unknown> =>
        bancada.pool.query(`insert into ${tabela} (escola_id, material_id, ordem, numero, titulo, pagina_inicial, pagina_final) values ($1, $2, $3, $4, $5, $6, $7)`, [
          escolaId,
          materialId,
          campos.ordem ?? 1,
          campos.numero === undefined ? 1 : campos.numero,
          campos.titulo ?? 'Capítulo 1',
          campos.inicial ?? 1,
          campos.final ?? 2,
        ])
      const quantos = async (materialId: string): Promise<number> => (await bancada.pool.query<{ total: number }>(`select count(*)::int as total from ${tabela} where material_id = $1`, [materialId])).rows[0]?.total ?? -1

      it('guarda o capítulo sem número, com título de 200 caracteres e de uma página só', async () => {
        const c = await escolaNova()
        const id = await materialComObjeto(c, null)
        await inserir(c.escolaId, id, { numero: null, titulo: 'a'.repeat(200), inicial: 3, final: 3 })
        expect(await quantos(id)).toBe(1)
      })

      it('o título vazio e o de 201 caracteres são recusados pelo check', async () => {
        const c = await escolaNova()
        const id = await materialComObjeto(c, null)
        await expect(inserir(c.escolaId, id, { titulo: '' })).rejects.toMatchObject({ constraint: 'capitulo_do_material_titulo_preenchido' })
        await expect(inserir(c.escolaId, id, { titulo: 'a'.repeat(201) })).rejects.toMatchObject({ constraint: 'capitulo_do_material_titulo_preenchido' })
      })

      it('a página final antes da inicial é recusada pelo check', async () => {
        const c = await escolaNova()
        const id = await materialComObjeto(c, null)
        await expect(inserir(c.escolaId, id, { inicial: 5, final: 4 })).rejects.toMatchObject({ constraint: 'capitulo_do_material_paginas_validas' })
      })

      it('a ordem é única por material: repetida no mesmo é recusada, e a mesma ordem em outro material da escola entra', async () => {
        const c = await escolaNova()
        const primeiro = await materialComObjeto(c, null)
        const segundo = await materialComObjeto(c, null)
        await inserir(c.escolaId, primeiro, { ordem: 1 })
        await expect(inserir(c.escolaId, primeiro, { ordem: 1 })).rejects.toMatchObject({ constraint: 'capitulo_do_material_ordem_unica' })
        await inserir(c.escolaId, segundo, { ordem: 1 })
        expect(await quantos(segundo)).toBe(1)
      })

      it('a FK composta com a escola: o capítulo da escola A não aponta para o material da B', async () => {
        const a = await escolaNova()
        const b = await escolaNova()
        const deB = await materialComObjeto(b, null)
        await expect(inserir(a.escolaId, deB)).rejects.toMatchObject({ constraint: 'capitulo_do_material_da_escola_fk' })
        await inserir(b.escolaId, deB)
        expect(await quantos(deB)).toBe(1)
      })

      it('o material expurgado leva os capítulos dele em cascata, e os do outro material ficam', async () => {
        const c = await escolaNova()
        const expurgado = await materialComObjeto(c, null)
        const vizinho = await materialComObjeto(c, null)
        await inserir(c.escolaId, expurgado, { ordem: 1 })
        await inserir(c.escolaId, expurgado, { ordem: 2, inicial: 3, final: 4 })
        await inserir(c.escolaId, vizinho, { ordem: 1 })

        await bancada.pool.query('delete from material where escola_id = $1 and id = $2', [c.escolaId, expurgado])

        expect(await quantos(expurgado)).toBe(0)
        expect(await quantos(vizinho)).toBe(1)
      })
    })
  })
})

/** O PDF de demonstração com um comentário no fim: o mesmo texto, com outro conteúdo. */
function variacaoDoPdf(): Buffer {
  return Buffer.concat([PDF_DE_DEMONSTRACAO, Buffer.from(`\n% ${randomUUID()}\n`, 'latin1')])
}
