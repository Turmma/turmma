import { InMemoryFileStorage, runInContext, type Clock, type Database } from '@educa/core'
import { ExtracaoDoMaterialRepository } from '@educa/core/material'
import { ErrorCode, buscaDeMaterialResponseSchema, materialResponseSchema } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { AMOSTRAS_DE_CAPITULOS, montarPdfDaAmostra } from '../../../tools/demonstracao/amostra-de-capitulos.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { DB } from '../src/database.module.js'
import { MaterialRepository } from '../src/material/material.repository.js'
import { chamar, subirApi, type TestApi, type RespostaHttp } from './test-api.js'
import { montarEscolaComTurma as montarEscola, type EscolaComTurma } from './escola-turma.fixture.js'
import {
  apagarMateriais,
  auditoriaDa,
  enviarEdicaoDeMaterial,
  enviarMaterial,
  esperarExtracao,
  extrairMaterial,
  extratorDe,
  pdfCorrompido,
  PDF_DE_DEMONSTRACAO,
  registrarLicencaDeTeste,
  trechosDa,
  variacaoDoPdf,
} from './material.fixture.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { TEST_APP_OPTIONS } from './test-config.js'
import { aguardar, esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'

/** O armazém em memória que `subirApi` deu a esta API. */
function armazemDe(api: TestApi): InMemoryFileStorage {
  if (!(api.armazem instanceof InMemoryFileStorage)) throw new Error('a API do teste não tem o armazém em memória')
  return api.armazem
}

/** Os PDFs da escola que ainda esperam a extração no armazém desta API. */
const objetosDaEscola = (api: TestApi, escolaId: string): string[] => [...armazemDe(api).bytes.keys()].filter((chave) => chave.startsWith(`material-temporario/${escolaId}/`))

interface EdicaoRow {
  readonly id: string
  readonly estado: string
  readonly edicao: string | null
  readonly substitui_id: string | null
  readonly substituido_por: string | null
  readonly excluido_em: Date | null
  readonly titulo: string
}

/**
 * A edição nova sobre um material `pronto` (ingestao-do-material, tarefa 8.0; Tech Spec, seções 3, 4 e 5; PRD, RF10, RF11 e RF20): herda o que é do material, espera ficar pronta
 * com a anterior ainda na busca, e a substitui na mesma transação da extração. As corridas ficam presas no banco (gatilho de teste) ou na leitura do objeto (`aoLerBytes`).
 */
describe('edição do material da escola', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  const escolasDoTeste: string[] = []

  async function montarEscolaComTurma(): Promise<EscolaComTurma> {
    const escola = await montarEscola(api, bancada)
    escolasDoTeste.push(escola.coordenacao.escolaId)
    return escola
  }

  const get = (sessao: TestSessao, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, sessao.token)
  const del = (sessao: TestSessao, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'DELETE', caminho, sessao.token)
  const post = (sessao: TestSessao, caminho: string, corpo?: unknown): Promise<RespostaHttp> => chamar(api.url, 'POST', caminho, sessao.token, corpo)
  const erroDe = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const idsDaBusca = async (sessao: TestSessao): Promise<string[]> => {
    const resposta = await get(sessao, `/v1/materiais/busca?q=${encodeURIComponent('reagente limitante')}`)
    return [...new Set(buscaDeMaterialResponseSchema.parse(resposta.corpo).itens.map((item) => item.materialId))]
  }
  const relogio: Clock & { fixo: Date | undefined } = { fixo: undefined, agora: () => relogio.fixo ?? new Date() }

  /** As colunas da edição, de todas as linhas da escola, em ordem de envio. */
  async function linhasDaEscola(escolaId: string): Promise<EdicaoRow[]> {
    const { rows } = await bancada.pool.query<EdicaoRow>('select id, estado, edicao, substitui_id, substituido_por, excluido_em, titulo from material where escola_id = $1 order by id', [escolaId])
    return rows
  }
  const linhaDe = async (escolaId: string, id: string): Promise<EdicaoRow> => {
    const linha = (await linhasDaEscola(escolaId)).find((candidata) => candidata.id === id)
    if (linha === undefined) throw new Error('material não achado')
    return linha
  }
  const seriesDe = async (escolaId: string, materialId: string): Promise<string[]> => {
    const { rows } = await bancada.pool.query<{ serie_id: string }>('select serie_id from material_serie where escola_id = $1 and material_id = $2 order by serie_id', [escolaId, materialId])
    return rows.map((linha) => linha.serie_id)
  }
  const linhasDoEnvio = async (escolaId: string): Promise<number> => {
    const { rows } = await bancada.pool.query<{ total: number }>('select count(*)::int as total from envio_de_material where escola_id = $1', [escolaId])
    return rows[0]?.total ?? 0
  }

  /** Envia o PDF de demonstração e espera a extração: o id do material `pronto`. */
  async function materialPronto(escola: EscolaComTurma, campos: Omit<Parameters<typeof enviarMaterial>[2], 'disciplinaId'> = {}, disciplinaId = escola.quimica, arquivo: Buffer = PDF_DE_DEMONSTRACAO): Promise<string> {
    const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId, ...campos }, { arquivo })
    expect(enviado.status).toBe(201)
    await esperarExtracao(api)
    return enviado.corpo['id'] as string
  }

  /** A edição enviada (201) sobre o alvo; ainda `processando`. */
  async function edicaoEnviada(escola: EscolaComTurma, alvoId: string, campos: Parameters<typeof enviarEdicaoDeMaterial>[3] = {}): Promise<string> {
    const resposta = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvoId, campos)
    expect(resposta.status).toBe(201)
    return resposta.corpo['id'] as string
  }

  /** Segura a leitura do objeto de `quantos` jobs: eles já leram a linha e ainda não leram os bytes. */
  function segurarALeitura(quantos = 1): { esperarChegadas: () => Promise<void>; liberar: () => void } {
    let chegaram = 0
    let liberar: () => void = () => undefined
    const liberado = new Promise<void>((pronto) => {
      liberar = pronto
    })
    armazemDe(api).aoLerBytes = async () => {
      chegaram += 1
      await liberado
    }
    return { esperarChegadas: () => aguardar(() => Promise.resolve(chegaram >= quantos), `${String(quantos)} job(s) na leitura do objeto`), liberar }
  }

  /** Segura o job depois de ele ter lido o objeto e o PDF ter sido extraído, e antes da transação que o marca `pronto`: o que muda a linha nesse intervalo é visto só pela transição. */
  function segurarDepoisDaLeitura(): { esperarChegada: () => Promise<void>; liberar: () => void } {
    const extrator = extratorDe(api)
    const original = extrator.extrair.bind(extrator)
    let chegou = false
    let liberar: () => void = () => undefined
    const liberado = new Promise<void>((pronto) => {
      liberar = pronto
    })
    vi.spyOn(extrator, 'extrair').mockImplementation(async (...argumentos: Parameters<typeof original>) => {
      const lido = await original(...argumentos)
      chegou = true
      await liberado
      return lido
    })
    return { esperarChegada: () => aguardar(() => Promise.resolve(chegou), 'o job na leitura do PDF'), liberar }
  }

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, [], { ...TEST_APP_OPTIONS, relogioDasLicencas: relogio })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    relogio.fixo = undefined
    armazemDe(api).aoLerBytes = undefined
  })

  afterAll(async () => {
    await api.app.close()
    await apagarMateriais(bancada, escolasDoTeste)
    await bancada.fechar()
    await medidor.encerrar()
  })

  describe('a anterior fica até a nova ficar pronta', () => {
    it('201 `processando` com o rótulo e a referência; a busca devolve a anterior antes, e só a nova depois; a anterior sai com `substituido_por` e sem trechos', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const alvo = await materialPronto(escola, { titulo: 'Química 2 — 1ª edição' })

      const enviada = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: '  2ª edição  ' })
      expect(enviada.status).toBe(201)
      const resposta = materialResponseSchema.parse(enviada.corpo)
      expect(resposta).toMatchObject({ estado: 'processando', titulo: 'Química 2 — 1ª edição', edicao: '2ª edição', substitui: alvo, disciplinaId: escola.quimica })

      // Antes de a nova ficar pronta: a anterior segue na busca e na lista.
      expect(await idsDaBusca(escola.coordenacao)).toEqual([alvo])
      expect(await linhaDe(escolaId, alvo)).toMatchObject({ estado: 'pronto', excluido_em: null, substituido_por: null })

      await esperarExtracao(api)

      // Depois: só a nova. A anterior sai da lista e da busca, apontando a nova, e os trechos dela saem.
      expect(await idsDaBusca(escola.coordenacao)).toEqual([resposta.id])
      expect(await linhaDe(escolaId, alvo)).toMatchObject({ substituido_por: resposta.id, excluido_em: expect.any(Date) as Date })
      expect(await linhaDe(escolaId, resposta.id)).toMatchObject({ estado: 'pronto', excluido_em: null, substitui_id: alvo, edicao: '2ª edição' })
      expect([...new Set((await trechosDa(bancada, escolaId)).map((trecho) => trecho.material_id))]).toEqual([resposta.id])
      expect(objetosDaEscola(api, escolaId)).toEqual([])
    })

    it('a nova com falha na leitura: a anterior segue pronta, na busca e com os trechos; a nova fica `falhou`, sem `substituido_por` na anterior', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const alvo = await materialPronto(escola)

      const enviada = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: 'quebrada' }, pdfCorrompido())
      expect(enviada.status).toBe(201)
      await esperarExtracao(api)

      expect(await linhaDe(escolaId, enviada.corpo['id'] as string)).toMatchObject({ estado: 'falhou', excluido_em: null })
      expect(await linhaDe(escolaId, alvo)).toMatchObject({ estado: 'pronto', excluido_em: null, substituido_por: null })
      expect(await idsDaBusca(escola.coordenacao)).toEqual([alvo])
      expect(await auditoriaDa(bancada, escolaId, 'material.substituido')).toEqual([])
      // `falhou` libera o lugar: a coordenação pode mandar outra edição.
      const outra = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: 'conserto' })
      expect(outra.status).toBe(201)
      await esperarExtracao(api)
    })
  })

  describe('a herança', () => {
    it('a edição herda disciplina, séries, titularidade e licença do alvo, e o título dele quando o pedido não traz; o `licenciante` é o da licença', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const outraSerie = (await post(escola.coordenacao, '/v1/series', { etapa: 'em', ano: 3 })).corpo['id'] as string
      const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao, { licenciante: 'Editora da herança', vigenteAte: '2026-12-31' })
      const alvo = await materialPronto(escola, { titularidade: 'terceiro_com_licenca', licenca: 'licenca_aberta', licencaId, serieIds: [escola.serieId, outraSerie], titulo: 'Apostila de Química' })
      // A coordenação corrigiu o nome na licença depois do envio: a edição copia o da licença, como o envio faz, e não o que ficou na linha do alvo.
      await bancada.pool.query("update licenca_de_material set licenciante = 'Editora renomeada' where escola_id = $1 and id = $2", [escolaId, licencaId])

      const enviada = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo)
      expect(enviada.status).toBe(201)
      const lida = materialResponseSchema.parse(enviada.corpo)
      const nova = lida.id
      expect(lida).toMatchObject({
        disciplinaId: escola.quimica,
        titulo: 'Apostila de Química',
        titularidade: 'terceiro_com_licenca',
        licenca: 'licenca_aberta',
        licencaId,
        licenciante: 'Editora renomeada',
        edicao: null,
        substitui: alvo,
      })
      expect(await seriesDe(escolaId, nova)).toEqual([escola.serieId, outraSerie].toSorted())
      expect(lida.serieIds).toEqual([escola.serieId, outraSerie].toSorted())
      await esperarExtracao(api)
    })

    it('o título do pedido vale no lugar do herdado', async () => {
      const escola = await montarEscolaComTurma()
      const alvo = await materialPronto(escola, { titulo: 'Título antigo' })
      const nova = await edicaoEnviada(escola, alvo, { titulo: '  Título da edição  ' })
      expect((await linhaDe(escola.coordenacao.escolaId, nova)).titulo).toBe('Título da edição')
      await esperarExtracao(api)
    })

    it('o arquivo da edição precisa ser PDF no conteúdo: texto, vazio ou sem arquivo é `ENTRADA_INVALIDA`, e nada é guardado', async () => {
      const escola = await montarEscolaComTurma()
      const alvo = await materialPronto(escola)
      const guardadasAntes = armazemDe(api).guardadas
      for (const arquivo of [Buffer.from('isto não é um PDF'), Buffer.alloc(0), null]) {
        const resposta = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, {}, arquivo)
        expect(erroDe(resposta), String(arquivo?.byteLength)).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      }
      expect(armazemDe(api).guardadas).toBe(guardadasAntes)
      expect(await linhasDaEscola(escola.coordenacao.escolaId)).toHaveLength(1)
      expect(await linhasDoEnvio(escola.coordenacao.escolaId)).toBe(0)
    })

    it('o pedido não escolhe o que é herdado: disciplina, séries, titularidade ou licença no corpo são `ENTRADA_INVALIDA`, e nada é lido nem gravado', async () => {
      const escola = await montarEscolaComTurma()
      const alvo = await materialPronto(escola)
      const extrair = vi.spyOn(extratorDe(api), 'extrair')
      for (const extra of [{ disciplinaId: escola.fisica }, { serieIds: escola.serieId }, { titularidade: 'escola' }, { licencaId: randomUUID() }, { escolaId: randomUUID() }]) {
        const resposta = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { extra })
        expect(erroDe(resposta), JSON.stringify(extra)).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      }
      const semArquivo = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, {}, null)
      expect(erroDe(semArquivo)).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(extrair).not.toHaveBeenCalled()
      expect(objetosDaEscola(api, escola.coordenacao.escolaId)).toEqual([])
      expect(await linhasDaEscola(escola.coordenacao.escolaId)).toHaveLength(1)
    })
  })

  describe('o que o alvo permite', () => {
    it('alvo `processando`: `EDICAO_EM_ANDAMENTO`, e o arquivo não vira nada', async () => {
      const escola = await montarEscolaComTurma()
      const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
      expect(enviado.status).toBe(201)

      const resposta = await enviarEdicaoDeMaterial(api, escola.coordenacao, enviado.corpo['id'] as string)
      expect(erroDe(resposta)).toEqual({ status: 409, codigo: ErrorCode.EDICAO_EM_ANDAMENTO })
      expect(objetosDaEscola(api, escola.coordenacao.escolaId)).toHaveLength(1)
      expect(await linhasDaEscola(escola.coordenacao.escolaId)).toHaveLength(1)
      await esperarExtracao(api)
    })

    it.each([
      { caso: 'excluído', preparar: async (escola: EscolaComTurma, alvo: string) => void expect((await del(escola.coordenacao, `/v1/materiais/${alvo}`)).status).toBe(204) },
      {
        caso: 'já substituído',
        preparar: async (escola: EscolaComTurma, alvo: string) => {
          await edicaoEnviada(escola, alvo)
          await esperarExtracao(api)
        },
      },
      {
        caso: 'que falhou',
        preparar: async (escola: EscolaComTurma) => {
          await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: pdfCorrompido() })
          await esperarExtracao(api)
        },
      },
    ])('alvo $caso: `NAO_ENCONTRADO`, igual ao inexistente, e nada é gravado', async ({ preparar }) => {
      const escola = await montarEscolaComTurma()
      const alvo = await materialPronto(escola)
      await preparar(escola, alvo)
      const antes = await linhasDaEscola(escola.coordenacao.escolaId)
      const alvoDoCaso = antes.find((linha) => linha.estado === 'falhou')?.id ?? alvo
      const extrair = vi.spyOn(extratorDe(api), 'extrair')
      const guardadasAntes = armazemDe(api).guardadas

      const resposta = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvoDoCaso)
      const inexistente = await enviarEdicaoDeMaterial(api, escola.coordenacao, randomUUID())
      expect(erroDe(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect({ ...resposta.corpo.erro, requisicaoId: undefined }).toEqual({ ...inexistente.corpo.erro, requisicaoId: undefined })
      expect(extrair).not.toHaveBeenCalled()
      // Nenhum byte chegou ao storage: o alvo é recusado antes de o arquivo ser guardado.
      expect(armazemDe(api).guardadas).toBe(guardadasAntes)
      expect(await linhasDaEscola(escola.coordenacao.escolaId)).toHaveLength(antes.length)
      expect(objetosDaEscola(api, escola.coordenacao.escolaId)).toEqual([])
      expect(await linhasDoEnvio(escola.coordenacao.escolaId)).toBe(0)
    })

    it('licença do alvo vencida: `LICENCA_VENCIDA` antes de ler o arquivo (um arquivo que não é PDF não muda a resposta), a recusa fica na auditoria e nada é gravado', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao, { vigenteAte: '2026-12-31' })
      const alvo = await materialPronto(escola, { titularidade: 'terceiro_com_licenca', licenca: 'licenca_aberta', licencaId })
      const extrair = vi.spyOn(extratorDe(api), 'extrair')

      relogio.fixo = new Date('2027-01-02T12:00:00-03:00')
      const resposta = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, {}, Buffer.from('isto não é um PDF'))
      expect(erroDe(resposta)).toEqual({ status: 422, codigo: ErrorCode.LICENCA_VENCIDA })
      expect(extrair).not.toHaveBeenCalled()
      expect(await linhasDaEscola(escolaId)).toHaveLength(1)
      expect(objetosDaEscola(api, escolaId)).toEqual([])
      expect(await linhasDoEnvio(escolaId)).toBe(0)
      const recusas = await auditoriaDa(bancada, escolaId, 'material.recusado')
      expect(recusas).toHaveLength(1)
      expect(recusas[0]).toMatchObject({ entidade: 'disciplina', entidade_id: escola.quimica, depois: { motivo: 'licenca_vencida', serieIds: [escola.serieId] } })
    })

    it('arquivo igual ao da edição atual: `CONFLITO`, o objeto e a linha do envio saem, e continua um material só', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const alvo = await materialPronto(escola)

      const resposta = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, {}, PDF_DE_DEMONSTRACAO)
      expect(erroDe(resposta)).toEqual({ status: 409, codigo: ErrorCode.CONFLITO })
      expect(objetosDaEscola(api, escolaId)).toEqual([])
      expect(await linhasDoEnvio(escolaId)).toBe(0)
      expect((await linhasDaEscola(escolaId)).map((linha) => linha.id)).toEqual([alvo])
    })

    it('o professor da disciplina não edita material: `NAO_ENCONTRADO`, nada lido', async () => {
      const escola = await montarEscolaComTurma()
      const alvo = await materialPronto(escola)
      const professor = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
      const criado = await post(escola.coordenacao, '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId: escola.turma, disciplinaId: escola.quimica, papel: 'professor' })
      expect((await post(professor, `/v1/vinculos/${criado.corpo['id'] as string}/confirmar`)).status).toBe(200)
      const extrair = vi.spyOn(extratorDe(api), 'extrair')

      const resposta = await enviarEdicaoDeMaterial(api, professor, alvo)
      expect(erroDe(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(extrair).not.toHaveBeenCalled()
      expect(await linhasDaEscola(escola.coordenacao.escolaId)).toHaveLength(1)
    })

    it('o aluno não edita material: `NAO_ENCONTRADO`, nada lido', async () => {
      const escola = await montarEscolaComTurma()
      const alvo = await materialPronto(escola)
      const aluno = await bancada.sessao(escola.coordenacao.escolaId, 'aluno')
      const extrair = vi.spyOn(extratorDe(api), 'extrair')
      const guardadasAntes = armazemDe(api).guardadas

      const resposta = await enviarEdicaoDeMaterial(api, aluno, alvo)
      expect(erroDe(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(extrair).not.toHaveBeenCalled()
      expect(armazemDe(api).guardadas).toBe(guardadasAntes)
      expect(await linhasDaEscola(escola.coordenacao.escolaId)).toHaveLength(1)
    })

    it('a edição `processando` que a coordenação exclui libera o lugar: a próxima edição é 201, e a que sobrou substitui o alvo', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const alvo = await materialPronto(escola)
      const presa = await edicaoEnviada(escola, alvo, { edicao: 'presa' })
      expect((await del(escola.coordenacao, `/v1/materiais/${presa}`)).status).toBe(204)

      const proxima = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: 'proxima' })
      expect(proxima.status).toBe(201)
      await esperarExtracao(api)
      expect(await linhaDe(escolaId, alvo)).toMatchObject({ substituido_por: proxima.corpo['id'] })
      expect(await idsDaBusca(escola.coordenacao)).toEqual([proxima.corpo['id']])
    })

    it('o material sem série (o de antes da F4 numa escola sem série): a edição é 201 e nasce sem série; com a licença vencida, `LICENCA_VENCIDA` e a recusa guarda `serieIds` vazio', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao, { vigenteAte: '2026-12-31' })
      const semLicenca = await materialPronto(escola)
      const comLicenca = await materialPronto(escola, { titularidade: 'terceiro_com_licenca', licenca: 'licenca_aberta', licencaId }, escola.fisica, variacaoDoPdf())
      await bancada.pool.query('delete from material_serie where escola_id = $1', [escolaId])

      const nova = await enviarEdicaoDeMaterial(api, escola.coordenacao, semLicenca)
      expect(nova.status).toBe(201)
      expect(nova.corpo['serieIds']).toEqual([])
      expect(await seriesDe(escolaId, nova.corpo['id'] as string)).toEqual([])

      relogio.fixo = new Date('2027-01-02T12:00:00-03:00')
      const vencida = await enviarEdicaoDeMaterial(api, escola.coordenacao, comLicenca)
      expect(erroDe(vencida)).toEqual({ status: 422, codigo: ErrorCode.LICENCA_VENCIDA })
      const recusas = await auditoriaDa(bancada, escolaId, 'material.recusado')
      expect(recusas).toHaveLength(1)
      expect(recusas[0]).toMatchObject({ entidade: 'disciplina', entidade_id: escola.fisica, depois: { motivo: 'licenca_vencida', serieIds: [] } })
      await esperarExtracao(api)
    })

    it('escola sem ano letivo em curso: a edição funciona', async () => {
      const coordenacao = await bancada.escolaComSessao('coordenador')
      escolasDoTeste.push(coordenacao.escolaId)
      const serie = (await post(coordenacao, '/v1/series', { etapa: 'em', ano: 2 })).corpo['id'] as string
      const disciplina = (await post(coordenacao, '/v1/disciplinas', { nome: 'Química' })).corpo['id'] as string
      const enviado = await enviarMaterial(api, coordenacao, { disciplinaId: disciplina, serieIds: [serie] })
      expect(enviado.status).toBe(201)
      await esperarExtracao(api)

      const edicao = await enviarEdicaoDeMaterial(api, coordenacao, enviado.corpo['id'] as string, { edicao: '2ª' })
      expect(edicao.status).toBe(201)
      expect(edicao.corpo['serieIds']).toEqual([serie])
      await esperarExtracao(api)
      expect(await idsDaBusca(coordenacao)).toEqual([edicao.corpo['id']])
    })
  })

  describe('isolamento entre escolas (regra 10)', () => {
    async function alvoDaB(caso: 'pronto' | 'processando' | 'licenca_vencida'): Promise<{ a: EscolaComTurma; b: EscolaComTurma; alvo: string }> {
      const a = await montarEscolaComTurma()
      const b = await montarEscolaComTurma()
      if (caso === 'processando') {
        const enviado = await enviarMaterial(api, b.coordenacao, { disciplinaId: b.quimica })
        return { a, b, alvo: enviado.corpo['id'] as string }
      }
      if (caso === 'licenca_vencida') {
        const licencaId = await registrarLicencaDeTeste(api, b.coordenacao, { vigenteAte: '2026-12-31' })
        return { a, b, alvo: await materialPronto(b, { titularidade: 'terceiro_com_licenca', licenca: 'licenca_aberta', licencaId }) }
      }
      return { a, b, alvo: await materialPronto(b) }
    }

    it.each(['pronto', 'processando', 'licenca_vencida'] as const)('alvo da outra escola %s: `NAO_ENCONTRADO` igual ao inexistente, nenhum byte lido, nada gravado em nenhuma das duas', async (caso) => {
      const { a, b, alvo } = await alvoDaB(caso)
      if (caso === 'licenca_vencida') relogio.fixo = new Date('2027-01-02T12:00:00-03:00')
      const extrair = vi.spyOn(extratorDe(api), 'extrair')
      const objetosDaB = objetosDaEscola(api, b.coordenacao.escolaId).length
      const linhasDaB = await linhasDaEscola(b.coordenacao.escolaId)
      const guardadasAntes = armazemDe(api).guardadas

      const resposta = await enviarEdicaoDeMaterial(api, a.coordenacao, alvo, {}, Buffer.from('isto não é um PDF'))
      const inexistente = await enviarEdicaoDeMaterial(api, a.coordenacao, randomUUID(), {}, Buffer.from('isto não é um PDF'))
      expect(erroDe(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect({ ...resposta.corpo.erro, requisicaoId: undefined }).toEqual({ ...inexistente.corpo.erro, requisicaoId: undefined })
      expect(extrair).not.toHaveBeenCalled()
      expect(armazemDe(api).guardadas).toBe(guardadasAntes)
      expect(objetosDaEscola(api, a.coordenacao.escolaId)).toEqual([])
      expect(objetosDaEscola(api, b.coordenacao.escolaId)).toHaveLength(objetosDaB)
      expect(await linhasDaEscola(a.coordenacao.escolaId)).toEqual([])
      expect(await linhasDaEscola(b.coordenacao.escolaId)).toEqual(linhasDaB)
      expect(await auditoriaDa(bancada, a.coordenacao.escolaId, 'material.recusado')).toEqual([])
      expect(await auditoriaDa(bancada, b.coordenacao.escolaId, 'material.recusado')).toEqual([])
      if (caso === 'processando') await esperarExtracao(api)
    })

    it('o repository, no contexto da escola A, não trava nem lê o alvo da B: a cláusula de escopo é a que responde', async () => {
      const { a, b, alvo } = await alvoDaB('pronto')
      // A escola B tem uma edição em andamento sobre o alvo dela: é o que a pergunta da A não pode enxergar.
      await edicaoEnviada(b, alvo)
      const banco = api.app.get<Database>(DB)
      const naEscolaA = <T>(funcao: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), escolaId: a.coordenacao.escolaId }, funcao)
      const naEscolaB = <T>(funcao: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), escolaId: b.coordenacao.escolaId }, funcao)

      expect(await naEscolaA(() => new MaterialRepository(banco).alvoDaEdicao(alvo))).toBeUndefined()
      expect(await naEscolaA(() => banco.transaction((tx) => new MaterialRepository(tx).travarAlvoDaEdicao(alvo)))).toBeUndefined()
      expect(await naEscolaA(() => new MaterialRepository(banco).edicaoEmAndamentoSobre(alvo))).toBe(false)
      expect(await naEscolaB(() => new MaterialRepository(banco).edicaoEmAndamentoSobre(alvo))).toBe(true)
      expect(await naEscolaA(() => new MaterialRepository(banco).seriesDoMaterial(alvo))).toEqual([])
      // Na escola dona, o mesmo id responde.
      expect(await naEscolaB(() => banco.transaction((tx) => new MaterialRepository(tx).travarAlvoDaEdicao(alvo)))).toMatchObject({ id: alvo })
      expect(await naEscolaB(() => new MaterialRepository(banco).seriesDoMaterial(alvo))).toEqual([b.serieId])
      await esperarExtracao(api)
    })

    it('a substituição, no contexto da escola A, não alcança o alvo da B: devolve `false`, e o alvo continua sem `excluido_em` nem `substituido_por`', async () => {
      const { a, b, alvo } = await alvoDaB('pronto')
      const nova = await edicaoEnviada(b, alvo)
      const banco = api.app.get<Database>(DB)
      const naEscola = <T>(escolaId: string, funcao: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)

      expect(await naEscola(a.coordenacao.escolaId, () => new ExtracaoDoMaterialRepository(banco).substituirAnterior(nova, alvo))).toBe(false)
      expect(await linhaDe(b.coordenacao.escolaId, alvo)).toMatchObject({ estado: 'pronto', excluido_em: null, substituido_por: null })
      // Na escola dona, a mesma chamada substitui.
      expect(await naEscola(b.coordenacao.escolaId, () => new ExtracaoDoMaterialRepository(banco).substituirAnterior(nova, alvo))).toBe(true)
      expect(await linhaDe(b.coordenacao.escolaId, alvo)).toMatchObject({ substituido_por: nova, excluido_em: expect.any(Date) as Date })
      await esperarExtracao(api)
    })
  })

  describe('auditoria', () => {
    it('`material.edicao_enviada` e `material.substituido` guardam ids e o que foi herdado, sem título, rótulo nem arquivo', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const alvo = await materialPronto(escola, { titulo: 'Título sigiloso do alvo' })
      const nova = await edicaoEnviada(escola, alvo, { edicao: 'Rótulo sigiloso', titulo: 'Título sigiloso da edição' })
      await esperarExtracao(api)

      const enviada = await auditoriaDa(bancada, escolaId, 'material.edicao_enviada')
      expect(enviada).toEqual([
        { entidade: 'material', entidade_id: nova, autor_usuario_id: escola.coordenacao.usuarioId, antes: null, depois: { substituiId: alvo, disciplinaId: escola.quimica, titularidade: 'escola', licenca: 'autoria_da_escola', declaracao: true } },
      ])
      const substituido = await auditoriaDa(bancada, escolaId, 'material.substituido')
      expect(substituido).toEqual([{ entidade: 'material', entidade_id: alvo, autor_usuario_id: null, antes: null, depois: { substituidoPor: nova } }])
      const texto = JSON.stringify([enviada, substituido])
      for (const proibido of ['sigiloso', 'edicao.pdf', 'sha256']) expect(texto).not.toContain(proibido)
      const { rows } = await bancada.pool.query<{ autor_operador: string | null }>("select autor_operador from auditoria where escola_id = $1 and acao = 'material.substituido'", [escolaId])
      expect(rows).toEqual([{ autor_operador: 'rotina' }])
    })
  })

  describe('a licença na transação da edição', () => {
    it('a licença que vence depois da conferência da entrada e antes do commit desfaz a edição: `LICENCA_VENCIDA`, a recusa fica na auditoria, e nada é gravado', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao, { vigenteAte: '2026-12-31' })
      const alvo = await materialPronto(escola, { titularidade: 'terceiro_com_licenca', licenca: 'licenca_aberta', licencaId })
      const armazem = armazemDe(api)
      const guardar = armazem.guardarBytes.bind(armazem)
      vi.spyOn(armazem, 'guardarBytes').mockImplementation(async (...argumentos) => {
        await guardar(...argumentos)
        // Depois de o arquivo estar no storage e antes da transação: a licença passa a terminar ontem.
        await bancada.pool.query("update licenca_de_material set vigente_ate = '2020-12-31' where escola_id = $1 and id = $2", [escolaId, licencaId])
      })

      const resposta = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo)
      vi.restoreAllMocks()

      expect(erroDe(resposta)).toEqual({ status: 422, codigo: ErrorCode.LICENCA_VENCIDA })
      expect(await linhasDaEscola(escolaId)).toHaveLength(1)
      expect(objetosDaEscola(api, escolaId)).toEqual([])
      expect(await linhasDoEnvio(escolaId)).toBe(0)
      const recusas = await auditoriaDa(bancada, escolaId, 'material.recusado')
      expect(recusas).toHaveLength(1)
      expect(recusas[0]).toMatchObject({ depois: { motivo: 'licenca_vencida', serieIds: [escola.serieId] } })
    })
  })

  describe('corridas', () => {
    it('[P] duas edições sobre o mesmo alvo, a primeira presa antes do commit: a segunda espera e recebe `EDICAO_EM_ANDAMENTO`, e fica uma edição só', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const alvo = await materialPronto(escola)
      const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'material', evento: 'insert', quando: `new.escola_id = '${escolaId}' and new.substitui_id is not null` })
      await gatilho.armar()
      const inserir = vi.spyOn(MaterialRepository.prototype, 'inserir')
      let primeira: RespostaHttp
      let segunda: RespostaHttp
      try {
        const envioDaPrimeira = enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: 'primeira' })
        await gatilho.esperarParadas()
        const envioDaSegunda = enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: 'segunda' })
        // A segunda passa pela leitura do alvo (ainda `pronto`) e para na trava de envios da escola, que a primeira segura até o commit.
        await esperarNaTrava(bancada.pool, '%pg_advisory_xact_lock%')
        await gatilho.soltar()
        ;[primeira, segunda] = await Promise.all([envioDaPrimeira, envioDaSegunda])
      } finally {
        await gatilho.desarmar()
      }

      expect(primeira.status).toBe(201)
      expect(erroDe(segunda)).toEqual({ status: 409, codigo: ErrorCode.EDICAO_EM_ANDAMENTO })
      // A checagem sob a trava recusa a segunda antes de ela tentar gravar: só a primeira chegou ao `insert` (o índice é a rede de baixo).
      expect(inserir).toHaveBeenCalledTimes(1)
      const emAndamento = (await linhasDaEscola(escolaId)).filter((linha) => linha.estado === 'processando')
      expect(emAndamento.map((linha) => linha.edicao)).toEqual(['primeira'])
      expect(objetosDaEscola(api, escolaId)).toHaveLength(1)
      // A linha do envio sai na transação que o confirma, e a da segunda saiu com a desistência dela.
      expect(await linhasDoEnvio(escolaId)).toBe(0)
      await esperarExtracao(api)
    })

    it('[P] o índice parcial responde sozinho quando a checagem sob a trava deixa passar: a segunda edição cai nele e também é `EDICAO_EM_ANDAMENTO`', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const alvo = await materialPronto(escola)
      await edicaoEnviada(escola, alvo, { edicao: 'primeira' })
      vi.spyOn(MaterialRepository.prototype, 'edicaoEmAndamentoSobre').mockResolvedValue(false)

      const segunda = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: 'segunda' })
      expect(erroDe(segunda)).toEqual({ status: 409, codigo: ErrorCode.EDICAO_EM_ANDAMENTO })
      expect((await linhasDaEscola(escolaId)).filter((linha) => linha.estado === 'processando')).toHaveLength(1)
      expect(objetosDaEscola(api, escolaId)).toHaveLength(1)
      expect(await linhasDoEnvio(escolaId)).toBe(0)
      vi.restoreAllMocks()
      await esperarExtracao(api)
    })

    it('[P] o índice parcial, no banco: duas linhas `processando` sobre o mesmo alvo violam `material_uma_edicao_em_andamento`; uma excluída ou `falhou` não conta, e outro alvo tem a sua', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const alvo = await materialPronto(escola)
      const outroAlvo = (await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.fisica }, { arquivo: variacaoDoPdf() })).corpo['id'] as string
      await esperarExtracao(api)
      const inserir = (substituiId: string, estado: string, excluida = false): Promise<unknown> =>
        bancada.pool.query(
          `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, falha, enviado_por, substitui_id, excluido_em)
           values ($1, $2, 'Edição sintética', 'escola', 'autoria_da_escola', true, $3, 1000, $4::text, case when $4::text = 'falhou' then 'extracao_falhou' end, $5, $6, ${excluida ? 'now()' : 'null'})`,
          [escolaId, escola.quimica, randomUUID().replaceAll('-', '').repeat(2), estado, escola.coordenacao.usuarioId, substituiId],
        )

      await inserir(alvo, 'processando')
      await expect(inserir(alvo, 'processando')).rejects.toMatchObject({ code: '23505', constraint: 'material_uma_edicao_em_andamento' })
      await expect(inserir(alvo, 'falhou')).resolves.toBeDefined()
      await expect(inserir(alvo, 'processando', true)).resolves.toBeDefined()
      await expect(inserir(outroAlvo, 'processando')).resolves.toBeDefined()
    })

    it('[P] edição C sobre A enquanto a substituição de B (também sobre A) está presa: C espera o `for update` do alvo e, quando B confirma, recebe `NAO_ENCONTRADO`', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const alvo = await materialPronto(escola)
      const b = await edicaoEnviada(escola, alvo, { edicao: 'B' })
      // A extração de B para depois de atualizar o alvo: a linha de A fica travada até o commit.
      const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'material', evento: 'update', quando: `new.id = '${alvo}' and new.excluido_em is not null` })
      await gatilho.armar()
      let resposta: RespostaHttp
      try {
        const extracao = extrairMaterial(api, escolaId, b)
        await gatilho.esperarParadas()
        const c = enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: 'C' })
        await esperarNaTrava(bancada.pool, '%for update%')
        await gatilho.soltar()
        await extracao
        resposta = await c
      } finally {
        await gatilho.desarmar()
      }

      expect(erroDe(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      const linhas = await linhasDaEscola(escolaId)
      expect(linhas).toHaveLength(2)
      expect(linhas.filter((linha) => linha.edicao !== null).map((linha) => linha.edicao)).toEqual(['B'])
      expect(await linhaDe(escolaId, alvo)).toMatchObject({ substituido_por: b })
      expect(objetosDaEscola(api, escolaId)).toEqual([])
      expect(await linhasDoEnvio(escolaId)).toBe(0)
    })

    it('[P] a nova excluída depois de lida e antes da transição: a anterior fica, a nova não ganha trechos e não há `material.substituido`', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const alvo = await materialPronto(escola)
      const nova = await edicaoEnviada(escola, alvo)
      const leitura = segurarDepoisDaLeitura()

      const extracao = extrairMaterial(api, escolaId, nova)
      await leitura.esperarChegada()
      expect((await del(escola.coordenacao, `/v1/materiais/${nova}`)).status).toBe(204)
      leitura.liberar()
      await extracao

      expect(await linhaDe(escolaId, alvo)).toMatchObject({ estado: 'pronto', excluido_em: null, substituido_por: null })
      expect(await linhaDe(escolaId, nova)).toMatchObject({ excluido_em: expect.any(Date) as Date })
      expect((await trechosDa(bancada, escolaId)).map((trecho) => trecho.material_id)).not.toContain(nova)
      expect(await auditoriaDa(bancada, escolaId, 'material.substituido')).toEqual([])
      expect(await idsDaBusca(escola.coordenacao)).toEqual([alvo])
    })

    it('[P] o alvo excluído antes de a substituição o atualizar: o `excluido_em` dele não muda, o `substituido_por` não é gravado e não há `material.substituido`; a nova fica pronta', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const alvo = await materialPronto(escola)
      const nova = await edicaoEnviada(escola, alvo)
      const leitura = segurarALeitura()

      const extracao = extrairMaterial(api, escolaId, nova)
      await leitura.esperarChegadas()
      expect((await del(escola.coordenacao, `/v1/materiais/${alvo}`)).status).toBe(204)
      const excluidoEm = (await linhaDe(escolaId, alvo)).excluido_em
      expect(excluidoEm).not.toBeNull()
      leitura.liberar()
      await extracao

      expect(await linhaDe(escolaId, alvo)).toMatchObject({ excluido_em: excluidoEm, substituido_por: null })
      expect(await linhaDe(escolaId, nova)).toMatchObject({ estado: 'pronto', excluido_em: null })
      expect(await auditoriaDa(bancada, escolaId, 'material.substituido')).toEqual([])
      expect(await idsDaBusca(escola.coordenacao)).toEqual([nova])
    })

    it('[P] dois jobs da mesma edição: os dois terminam sem erro, a substituição é auditada uma vez, e a nova tem os trechos e os capítulos uma vez', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const alvo = await materialPronto(escola)
      const amostra = AMOSTRAS_DE_CAPITULOS.find((candidata) => candidata.nome === 'marcador')
      if (amostra === undefined) throw new Error('a amostra marcador sumiu')
      const enviada = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, {}, montarPdfDaAmostra(amostra))
      expect(enviada.status).toBe(201)
      const nova = enviada.corpo['id'] as string
      const leitura = segurarALeitura(2)

      const jobs = Promise.all([extrairMaterial(api, escolaId, nova), extrairMaterial(api, escolaId, nova)])
      await leitura.esperarChegadas()
      leitura.liberar()
      await jobs

      expect(await auditoriaDa(bancada, escolaId, 'material.substituido')).toHaveLength(1)
      expect(await linhaDe(escolaId, alvo)).toMatchObject({ substituido_por: nova })
      expect(await linhaDe(escolaId, nova)).toMatchObject({ estado: 'pronto', excluido_em: null })
      const trechos = await trechosDa(bancada, escolaId)
      expect(trechos.filter((trecho) => trecho.material_id === nova)).toHaveLength(6)
      expect(trechos.filter((trecho) => trecho.material_id === alvo)).toEqual([])
      const { rows } = await bancada.pool.query<{ total: number }>('select count(*)::int as total from capitulo_do_material where escola_id = $1 and material_id = $2', [escolaId, nova])
      expect(rows[0]?.total).toBe(amostra.numeros.length)
    })

    it('[P] a edição parada depois de guardar o arquivo, com as séries do alvo mudadas por SQL: ela nasce com as séries de agora, lidas sob o `for update`', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const alvo = await materialPronto(escola)
      const outraSerie = (await post(escola.coordenacao, '/v1/series', { etapa: 'em', ano: 3 })).corpo['id'] as string
      expect(await seriesDe(escolaId, alvo)).toEqual([escola.serieId])

      const armazem = armazemDe(api)
      const guardar = armazem.guardarBytes.bind(armazem)
      let guardou: () => void = () => undefined
      const jaGuardou = new Promise<void>((pronto) => {
        guardou = pronto
      })
      let seguir: () => void = () => undefined
      const podeSeguir = new Promise<void>((pronto) => {
        seguir = pronto
      })
      vi.spyOn(armazem, 'guardarBytes').mockImplementation(async (...argumentos) => {
        await guardar(...argumentos)
        guardou()
        await podeSeguir
      })

      const envio = enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: 'com séries novas' })
      await jaGuardou
      await bancada.pool.query('delete from material_serie where escola_id = $1 and material_id = $2', [escolaId, alvo])
      await bancada.pool.query('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [escolaId, alvo, outraSerie])
      seguir()
      const resposta = await envio
      vi.restoreAllMocks()

      expect(resposta.status).toBe(201)
      expect(resposta.corpo['serieIds']).toEqual([outraSerie])
      expect(await seriesDe(escolaId, resposta.corpo['id'] as string)).toEqual([outraSerie])
      await esperarExtracao(api)
    })
  })
})
