import { InMemoryFileStorage, runInContext, type Clock, type Database } from '@educa/core'
import type { ResultadoDaExtracao } from '@educa/core/material'
import { ErrorCode, buscaDeMaterialResponseSchema, listaDeMateriaisResponseSchema, materialComCapitulosResponseSchema, materialResponseSchema, MAXIMO_DE_BYTES_DO_MATERIAL, TAMANHO_MAXIMO_DO_TRECHO_CITADO } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { linhasDoBloco, normalizarTexto, paginaDoMaterial, PAGINAS_DO_MATERIAL } from '../../../tools/demonstracao/conteudo-estequiometria.ts'
import { AMOSTRAS_DE_CAPITULOS, montarPdfDaAmostra } from '../../../tools/demonstracao/amostra-de-capitulos.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { DB } from '../src/database.module.js'
import { MaterialRepository } from '../src/material/material.repository.js'
import { TrechoSearch } from '../src/material/trecho-search.js'
import { ENVIOS_POR_ESCOLA_NA_JANELA, ENVIOS_POR_USUARIO_NA_JANELA, MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA } from '../src/material/material.service.js'
import { chamar, subirApi, type TestApi, type RespostaHttp } from './test-api.js'
import { montarEscolaComTurma as montarEscola, type EscolaComTurma } from './escola-turma.fixture.js'
import {
  apagarMateriais,
  auditoriaDa,
  enviarMaterial,
  esperarExtracao,
  extrairMaterial,
  extratorDe,
  materiaisDa,
  materiaisJaEnviados,
  PDF_DE_DEMONSTRACAO,
  pdfCorrompido,
  pdfSemTexto,
  registrarLicencaDeTeste,
  trechosDa,
  variacaoDoPdf,
} from './material.fixture.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { TEST_APP_OPTIONS } from './test-config.js'

/** O armazém em memória que `subirApi` deu a esta API. */
function armazemDe(api: TestApi): InMemoryFileStorage {
  if (!(api.armazem instanceof InMemoryFileStorage)) throw new Error('a API do teste não tem o armazém em memória')
  return api.armazem
}

/** A chave do PDF que espera a extração no storage (`chaveDoTemporario`). */
const chaveDe = (escolaId: string, id: string): string => `material-temporario/${escolaId}/${id}`

/** As chaves dos PDFs da escola que ainda estão no armazém desta API. */
const objetosDaEscola = (api: TestApi, escolaId: string): string[] => [...armazemDe(api).bytes.keys()].filter((chave) => chave.startsWith(`material-temporario/${escolaId}/`))

/** `quantidade` campos de texto que o contrato não tem, para encher o multipart. */
function camposAMais(quantidade: number): Record<string, string> {
  return Object.fromEntries(Array.from({ length: quantidade }, (_, indice) => [`a_mais_${indice}`, 'x']))
}

/**
 * Um PDF um byte acima do teto de tamanho. No pedido que um teto de campo deve parar, ele distingue os dois caminhos:
 * com o teto, o recebimento para no campo, antes do arquivo, e responde 400; sem ele, o arquivo chega ao `fileSize` e
 * a resposta vira 413.
 */
const PDF_ACIMA_DO_TETO = Buffer.concat([PDF_DE_DEMONSTRACAO, Buffer.alloc(MAXIMO_DE_BYTES_DO_MATERIAL + 1 - PDF_DE_DEMONSTRACAO.byteLength, 0x20)])

/**
 * As regras do material da escola (MVP, A2; D5, D22, D75; `docs/mvp-contratos.md`, seção 3 e linha M da seção 6): a
 * recusa por licença antes de abrir o arquivo, a extração por página, a busca, a exclusão, os tetos e o alcance do
 * professor. O isolamento entre escolas está em `material-isolamento.int.test.ts`.
 */
describe('material da escola', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: TestApi
  /** As escolas que o teste montou: o material delas sai antes de a bancada apagar as disciplinas. */
  const escolasDoTeste: string[] = []

  async function montarEscolaComTurma(daApi: TestApi, daBancada: SessaoFixtures): Promise<EscolaComTurma> {
    const escola = await montarEscola(daApi, daBancada)
    escolasDoTeste.push(escola.coordenacao.escolaId)
    return escola
  }

  const get = (sessao: TestSessao, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, sessao.token)
  const del = (sessao: TestSessao, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'DELETE', caminho, sessao.token)
  const post = (sessao: TestSessao, caminho: string, corpo?: unknown): Promise<RespostaHttp> => chamar(api.url, 'POST', caminho, sessao.token, corpo)
  const erroDe = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const buscar = (sessao: TestSessao, q: string, resto = '') => get(sessao, `/v1/materiais/busca?q=${encodeURIComponent(q)}${resto}`)
  const itensDe = (resposta: RespostaHttp) => buscaDeMaterialResponseSchema.parse(resposta.corpo).itens

  /** O conteúdo da página como o material o escreve, sem o rodapé corrido. */
  const conteudoDaPagina = (numero: number): string => normalizarTexto(paginaDoMaterial(numero).blocos.flatMap(linhasDoBloco).join('\n'))

  /** Envia o PDF de demonstração e espera a extração: devolve o id do material `pronto`. */
  async function materialPronto(escola: EscolaComTurma, disciplinaId = escola.quimica, arquivo: Buffer = PDF_DE_DEMONSTRACAO): Promise<string> {
    const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId }, { arquivo })
    expect(enviado.status).toBe(201)
    await esperarExtracao(api)
    return enviado.corpo['id'] as string
  }

  /** Um professor da escola com vínculo na turma e na disciplina, `confirmado` ou ainda `pendente`. */
  async function professorCom(escola: EscolaComTurma, disciplinaId: string, confirmar: boolean): Promise<TestSessao> {
    const professor = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
    const criado = await post(escola.coordenacao, '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId: escola.turma, disciplinaId, papel: 'professor' })
    expect(criado.status).toBe(201)
    if (confirmar) expect((await post(professor, `/v1/vinculos/${criado.corpo['id'] as string}/confirmar`)).status).toBe(200)
    return professor
  }

  /** O relógio da vigência da licença: o do sistema, até o teste fixar um dia (`fixo`). */
  const relogio: Clock & { fixo: Date | undefined } = { fixo: undefined, agora: () => relogio.fixo ?? new Date() }

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog, { ...TEST_APP_OPTIONS, relogioDasLicencas: relogio })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await api.app.close()
    await apagarMateriais(bancada, escolasDoTeste)
    await bancada.fechar()
    await medidor.encerrar()
  })

  describe('envio com licença', () => {
    it('responde 201 com o material `processando`, sem esperar a leitura, e o PDF de demonstração vira seis trechos com o texto de cada página', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const enviado = await enviarMaterial(api, escola.coordenacao, { titulo: '  Química 2 — Capítulo 7  ', disciplinaId: escola.quimica })

      expect(enviado.status).toBe(201)
      // O contrato é estrito: a resposta não leva o resumo do arquivo, quem enviou nem a declaração.
      const resposta = materialResponseSchema.parse(enviado.corpo)
      expect(resposta).toMatchObject({ titulo: 'Química 2 — Capítulo 7', disciplinaId: escola.quimica, titularidade: 'escola', licenciante: null, licencaId: null, serieIds: [escola.serieId], licenca: 'autoria_da_escola', estado: 'processando', falha: null, paginas: null, trechos: 0 })

      await esperarExtracao(api)
      const lido = materialComCapitulosResponseSchema.parse((await get(escola.coordenacao, `/v1/materiais/${resposta.id}`)).corpo)
      expect(lido).toMatchObject({ id: resposta.id, estado: 'pronto', falha: null, paginas: 6, trechos: 6, capitulos: [] })

      const trechos = await trechosDa(bancada, escola.coordenacao.escolaId)
      expect(trechos.map((trecho) => trecho.pagina)).toEqual([1, 2, 3, 4, 5, 6])
      for (const { numero } of PAGINAS_DO_MATERIAL) {
        const trecho = trechos[numero - 1]
        expect(trecho).toMatchObject({ material_id: resposta.id, disciplina_id: escola.quimica })
        expect(normalizarTexto(trecho?.texto ?? ''), `página ${String(numero)}`).toBe(conteudoDaPagina(numero))
      }

      // O arquivo não fica depois da extração: fica o resumo dele, o tamanho e quem declarou.
      const [linha] = await materiaisDa(bancada, escola.coordenacao.escolaId)
      expect(linha).toMatchObject({ id: resposta.id, declaracao: true, tamanho_bytes: PDF_DE_DEMONSTRACAO.byteLength, enviado_por: escola.coordenacao.usuarioId, excluido_em: null })
      expect(linha?.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.enviado')).toEqual([
        { entidade: 'material', entidade_id: resposta.id, autor_usuario_id: escola.coordenacao.usuarioId, antes: null, depois: { disciplinaId: escola.quimica, titularidade: 'escola', licenca: 'autoria_da_escola', declaracao: true } },
      ])
    })

    it('material de terceiro cita a licença registrada e copia o licenciante dela; o pedido não traz nome, e `licencaId` em material próprio é `ENTRADA_INVALIDA` e nada é gravado', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao)
      const deTerceiro = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licenca: 'licenca_comercial_autorizada', licencaId })
      expect(deTerceiro.status).toBe(201)
      expect(deTerceiro.corpo).toMatchObject({ titularidade: 'terceiro_com_licenca', licenciante: 'Editora sintética', licencaId, licenca: 'licenca_comercial_autorizada' })
      await esperarExtracao(api)

      const licencaIdEmProprio = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'escola', licencaId }, { arquivo: variacaoDoPdf() })
      // O nome de quem licenciou vem da licença: o campo `licenciante` do pedido deixou de existir.
      const comLicenciante = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licencaId, extra: { licenciante: 'Outra editora' } }, { arquivo: variacaoDoPdf() })
      // Nada de escola vem do cliente: o contrato é estrito.
      const comEscola = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, extra: { escolaId: escola.coordenacao.escolaId } }, { arquivo: variacaoDoPdf() })
      for (const resposta of [licencaIdEmProprio, comLicenciante, comEscola]) expect(erroDe(resposta)).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toHaveLength(1)
      const [linha] = await bancada.pool.query<{ licenciante: string; licenca_id: string }>('select licenciante, licenca_id from material where escola_id = $1', [escola.coordenacao.escolaId]).then((r) => r.rows)
      expect(linha).toEqual({ licenciante: 'Editora sintética', licenca_id: licencaId })
    })

    it('os campos ao lado do arquivo passam pelo ZodValidationPipe: o PDF válido com campo fora do contrato é `ENTRADA_INVALIDA`, e o arquivo nem chega à leitura nem vira material (17.0)', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const extrair = vi.spyOn(extratorDe(api), 'extrair')
      const foraDoContrato = [
        { disciplinaId: escola.quimica, extra: { escolaId: escola.coordenacao.escolaId } },
        { disciplinaId: escola.quimica, extra: { titularidade: 'ninguem' } },
        { disciplinaId: 'nao-e-uuid' },
      ]
      for (const campos of foraDoContrato) {
        const resposta = await enviarMaterial(api, escola.coordenacao, campos, { arquivo: variacaoDoPdf() })
        expect(erroDe(resposta), JSON.stringify(campos)).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      }
      await esperarExtracao(api)
      expect(extrair).not.toHaveBeenCalled()
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toEqual([])
    })

    it('o licenciante é da coordenação: o professor da disciplina lê o material sem ele, na lista e por id', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao)
      const deTerceiro = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licenca: 'licenca_comercial_autorizada', licencaId })
      expect(deTerceiro.status).toBe(201)
      await esperarExtracao(api)
      const id = deTerceiro.corpo['id'] as string
      const professor = await professorCom(escola, escola.quimica, true)

      const lidoPelaCoordenacao = await get(escola.coordenacao, `/v1/materiais/${id}`)
      expect(lidoPelaCoordenacao.corpo).toMatchObject({ id, licenciante: 'Editora sintética' })
      const listadoPelaCoordenacao = await get(escola.coordenacao, '/v1/materiais')
      expect(listadoPelaCoordenacao.corpo['itens']).toEqual([expect.objectContaining({ id, licenciante: 'Editora sintética' })])

      const lidoPeloProfessor = await get(professor, `/v1/materiais/${id}`)
      expect(lidoPeloProfessor.status).toBe(200)
      // O resto do material ele lê: é a titularidade e a licença que dizem que a escola pode usar.
      expect(lidoPeloProfessor.corpo).toMatchObject({ id, titularidade: 'terceiro_com_licenca', licenca: 'licenca_comercial_autorizada', licenciante: null })
      const listadoPeloProfessor = await get(professor, '/v1/materiais')
      expect(listadoPeloProfessor.corpo['itens']).toEqual([expect.objectContaining({ id, licenciante: null })])
      expect(JSON.stringify([lidoPeloProfessor.corpo, listadoPeloProfessor.corpo])).not.toContain('Editora sintética')
    })
  })

  describe('capítulos lidos do PDF (ingestao-do-material, tarefa 4.0; RF4)', () => {
    const pdfDaAmostra = (nome: string): Buffer => {
      const amostra = AMOSTRAS_DE_CAPITULOS.find((candidata) => candidata.nome === nome)
      if (amostra === undefined) throw new Error(`a amostra ${nome} sumiu`)
      return montarPdfDaAmostra(amostra)
    }
    const capitulosDe = async (sessao: TestSessao, id: string) => materialComCapitulosResponseSchema.parse((await get(sessao, `/v1/materiais/${id}`)).corpo).capitulos

    const CAPITULOS_DO_MARCADOR = [
      { ordem: 1, numero: 1, titulo: 'Capítulo 1: Mol e massa molar', paginaInicial: 1, paginaFinal: 2 },
      { ordem: 2, numero: 2, titulo: 'Capítulo 2: Reações químicas', paginaInicial: 3, paginaFinal: 4 },
      { ordem: 3, numero: null, titulo: 'Soluções', paginaInicial: 5, paginaFinal: 6 },
    ]
    const CAPITULOS_DA_LINHA = [
      { ordem: 1, numero: 1, titulo: 'Capítulo 1: Mol e massa molar', paginaInicial: 1, paginaFinal: 3 },
      { ordem: 2, numero: 2, titulo: 'Capítulo 2: Reações químicas', paginaInicial: 4, paginaFinal: 6 },
    ]

    it('o PDF com marcador termina `pronto` e devolve os capítulos em `GET /:id`, em ordem, à coordenação e ao professor da disciplina; a lista não os leva, e outro material da mesma escola tem os dele', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const comMarcador = await materialPronto(escola, escola.quimica, pdfDaAmostra('marcador'))
      const comLinha = await materialPronto(escola, escola.quimica, pdfDaAmostra('linha no topo'))
      const professor = await professorCom(escola, escola.quimica, true)

      const lido = materialComCapitulosResponseSchema.parse((await get(escola.coordenacao, `/v1/materiais/${comMarcador}`)).corpo)
      expect(lido).toMatchObject({ id: comMarcador, estado: 'pronto', paginas: 6, trechos: 6 })
      expect(lido.capitulos).toEqual(CAPITULOS_DO_MARCADOR)
      expect(await capitulosDe(escola.coordenacao, comLinha)).toEqual(CAPITULOS_DA_LINHA)
      expect(await capitulosDe(professor, comMarcador)).toEqual(CAPITULOS_DO_MARCADOR)

      const lista = listaDeMateriaisResponseSchema.parse((await get(escola.coordenacao, '/v1/materiais')).corpo).itens
      expect(lista.map(({ id }) => id)).toEqual([comMarcador, comLinha])
      for (const item of lista) expect(item).not.toHaveProperty('capitulos')
    })

    it('PDF sem capítulo termina `pronto`, com zero capítulos; o que ainda está `processando` também devolve zero', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const semCapitulo = await materialPronto(escola, escola.quimica, pdfDaAmostra('sem capítulo'))
      expect(materialComCapitulosResponseSchema.parse((await get(escola.coordenacao, `/v1/materiais/${semCapitulo}`)).corpo)).toMatchObject({ estado: 'pronto', paginas: 6, trechos: 6, capitulos: [] })
      expect(await capitulosDe(escola.coordenacao, await materialPronto(escola))).toEqual([])

      const aindaProcessando = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: pdfDaAmostra('marcador') })
      expect(aindaProcessando.status).toBe(201)
      expect(await capitulosDe(escola.coordenacao, aindaProcessando.corpo['id'] as string)).toEqual([])
    })

    it('isolamento: o material da B, lido pela coordenação da A, é `NAO_ENCONTRADO` sem capítulo nenhum; o repository com o id da B no contexto da A não acha capítulo, e no da B acha', async () => {
      const a = await montarEscolaComTurma(api, bancada)
      const b = await montarEscolaComTurma(api, bancada)
      const deB = await materialPronto(b, b.quimica, pdfDaAmostra('marcador'))
      expect(await capitulosDe(b.coordenacao, deB)).toEqual(CAPITULOS_DO_MARCADOR)

      const daA = await get(a.coordenacao, `/v1/materiais/${deB}`)
      expect(erroDe(daA)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(daA.corpo).not.toHaveProperty('capitulos')
      expect(JSON.stringify(daA.corpo)).not.toContain('Mol e massa molar')

      const banco = api.app.get<Database>(DB)
      const noContextoDa = (escolaId: string) => runInContext({ requisicaoId: randomUUID(), escolaId }, () => new MaterialRepository(banco).capitulos(deB))
      expect(await noContextoDa(a.coordenacao.escolaId)).toEqual([])
      expect(await noContextoDa(b.coordenacao.escolaId)).toHaveLength(3)
    })

    it('material excluído: `GET /:id` responde como o que não existe, sem capítulo, mesmo com os capítulos ainda gravados', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const id = await materialPronto(escola, escola.quimica, pdfDaAmostra('marcador'))
      expect(await capitulosDe(escola.coordenacao, id)).toEqual(CAPITULOS_DO_MARCADOR)

      expect((await del(escola.coordenacao, `/v1/materiais/${id}`)).status).toBe(204)

      const resposta = await get(escola.coordenacao, `/v1/materiais/${id}`)
      const inexistente = await get(escola.coordenacao, `/v1/materiais/${randomUUID()}`)
      expect(erroDe(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect({ ...resposta.corpo.erro, requisicaoId: undefined }).toEqual({ ...inexistente.corpo.erro, requisicaoId: undefined })
      expect(resposta.corpo).not.toHaveProperty('capitulos')
      expect(JSON.stringify(resposta.corpo)).not.toContain('Mol e massa molar')
      // A exclusão é lógica: os capítulos continuam na tabela, e é o `porId` que não deixa a rota chegar neles.
      const banco = api.app.get<Database>(DB)
      const gravados = await runInContext({ requisicaoId: randomUUID(), escolaId: escola.coordenacao.escolaId }, () => new MaterialRepository(banco).capitulos(id))
      expect(gravados).toHaveLength(3)
    })

    it('permissão: o aluno, o professor sem vínculo e o de outra disciplina recebem o mesmo 404 do material que não existe, sem capítulo', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const id = await materialPronto(escola, escola.quimica, pdfDaAmostra('marcador'))
      const aluno = await bancada.sessao(escola.coordenacao.escolaId, 'aluno')
      const semVinculo = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
      const deFisica = await professorCom(escola, escola.fisica, true)
      const inexistente = await get(escola.coordenacao, `/v1/materiais/${randomUUID()}`)

      for (const quem of [aluno, semVinculo, deFisica]) {
        const resposta = await get(quem, `/v1/materiais/${id}`)
        expect(erroDe(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
        expect({ ...resposta.corpo.erro, requisicaoId: undefined }).toEqual({ ...inexistente.corpo.erro, requisicaoId: undefined })
        expect(resposta.corpo).not.toHaveProperty('capitulos')
      }
    })
  })

  describe('recusa por licença, antes de abrir o arquivo (D5, D75)', () => {
    it.each([
      { caso: 'sem licença', campos: { licenca: 'sem_licenca', declaracao: 'true' }, motivo: 'sem_licenca', declaracao: true },
      { caso: 'sem a declaração', campos: { licenca: 'autoria_da_escola', declaracao: 'false' }, motivo: 'sem_declaracao', declaracao: false },
    ])('$caso: `MATERIAL_SEM_LICENCA`, a extração não é chamada, nenhuma linha em `material`, e a auditoria fica', async ({ campos, motivo, declaracao }) => {
      const escola = await montarEscolaComTurma(api, bancada)
      const extrair = vi.spyOn(extratorDe(api), 'extrair')

      // O arquivo é lixo de propósito: se alguém o abrisse antes da licença, a resposta seria a do arquivo inválido.
      const lixo = Buffer.from('isto não é um PDF')
      const respostas = [
        await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, ...campos }),
        await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, ...campos }, { arquivo: lixo }),
        // Os bytes chegam antes dos campos: o arquivo é recebido, e mesmo assim não é aberto.
        await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, ...campos }, { arquivo: lixo, arquivoPrimeiro: true }),
        // Recusado, o pedido nem precisa trazer arquivo.
        await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, ...campos }, { arquivo: null }),
      ]
      await esperarExtracao(api)

      for (const resposta of respostas) expect(erroDe(resposta)).toEqual({ status: 422, codigo: ErrorCode.MATERIAL_SEM_LICENCA })
      expect(extrair).not.toHaveBeenCalled()
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toEqual([])
      expect(await trechosDa(bancada, escola.coordenacao.escolaId)).toEqual([])
      const recusas = await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.recusado')
      expect(recusas).toHaveLength(respostas.length)
      // Sem linha em `material`, a entidade da auditoria é a disciplina para a qual o material ia.
      for (const recusa of recusas) {
        expect(recusa).toEqual({ entidade: 'disciplina', entidade_id: escola.quimica, autor_usuario_id: escola.coordenacao.usuarioId, antes: null, depois: { titularidade: 'escola', licenca: campos.licenca, declaracao, serieIds: [escola.serieId], motivo } })
      }
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.enviado')).toEqual([])
    })

    it('a disciplina é conferida antes da recusa: disciplina inexistente responde `NAO_ENCONTRADO`, sem auditoria de recusa', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const semLicenca = await enviarMaterial(api, escola.coordenacao, { disciplinaId: randomUUID(), licenca: 'sem_licenca' })
      const comLicenca = await enviarMaterial(api, escola.coordenacao, { disciplinaId: randomUUID() })
      expect(erroDe(semLicenca)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(erroDe(comLicenca)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.recusado')).toEqual([])
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toEqual([])
    })

    it('com licença, o pedido sem arquivo é `ENTRADA_INVALIDA`: só a recusa dispensa o arquivo', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      expect(erroDe(await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: null }))).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toEqual([])
    })
  })

  describe('o arquivo', () => {
    it('o que não é PDF no conteúdo é `ENTRADA_INVALIDA`, mesmo com nome e tipo de PDF, e não vira material', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const extrair = vi.spyOn(extratorDe(api), 'extrair')
      const planilha = Buffer.from('nome;turma\nAluno sintético;2B\n')
      const comNomeDePdf = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: planilha, nomeDoArquivo: 'apostila.pdf', tipo: 'application/pdf' })
      const vazio = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: Buffer.alloc(0) })
      expect(erroDe(comNomeDePdf)).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(erroDe(vazio)).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(extrair).not.toHaveBeenCalled()
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toEqual([])
    })

    it('o PDF é reconhecido pelo conteúdo: entra mesmo com outro nome e outro tipo declarado', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { nomeDoArquivo: 'capitulo.bin', tipo: 'application/octet-stream' })
      expect(enviado.status).toBe(201)
      await esperarExtracao(api)
      expect((await materiaisDa(bancada, escola.coordenacao.escolaId))[0]).toMatchObject({ estado: 'pronto', paginas: 6 })
    })

    it('PDF sem texto (só imagem) e PDF corrompido viram `falhou`, com o motivo da lista fechada, e nunca `pronto`; o que falhou pode ser enviado de novo', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const semTexto = pdfSemTexto()
      const primeiro = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: semTexto })
      await esperarExtracao(api)
      const segundo = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: pdfCorrompido() })
      await esperarExtracao(api)
      expect([primeiro.status, segundo.status]).toEqual([201, 201])

      const lidos = await Promise.all([primeiro, segundo].map(async (enviado) => materialComCapitulosResponseSchema.parse((await get(escola.coordenacao, `/v1/materiais/${enviado.corpo['id'] as string}`)).corpo)))
      expect(lidos.map(({ estado, falha, paginas, trechos }) => ({ estado, falha, paginas, trechos }))).toEqual([
        { estado: 'falhou', falha: 'sem_texto', paginas: null, trechos: 0 },
        { estado: 'falhou', falha: 'arquivo_invalido', paginas: null, trechos: 0 },
      ])
      expect(await trechosDa(bancada, escola.coordenacao.escolaId)).toEqual([])

      // O mesmo arquivo que falhou não é `CONFLITO`: o índice único deixa de fora o que falhou.
      const deNovo = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: semTexto })
      expect(deNovo.status).toBe(201)
      await esperarExtracao(api)
    })

    it('acima do tamanho máximo o envio é recusado no recebimento, e nada é gravado nem lido', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const extrair = vi.spyOn(extratorDe(api), 'extrair')
      const grande = Buffer.concat([PDF_DE_DEMONSTRACAO, Buffer.alloc(MAXIMO_DE_BYTES_DO_MATERIAL + 1 - PDF_DE_DEMONSTRACAO.byteLength, 0x20)])
      expect(grande.byteLength).toBe(MAXIMO_DE_BYTES_DO_MATERIAL + 1)

      const recusado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: grande })

      expect(erroDe(recusado)).toEqual({ status: 413, codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(extrair).not.toHaveBeenCalled()
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toEqual([])
    })

    /**
     * Os tetos de quantidade do recebimento (`material-upload.ts`), na rota de verdade. Fixados quando o `multer` foi para a
     * 2.4.0 (correção 2026-10-06-audit-proxy-addr-e-multer), que mudou a contagem de `parts`, o `maxCount` diante do
     * `fileFilter` e a mensagem do arquivo em campo inesperado. O que cada caso prova:
     * - outro campo: o erro do `multer` traduzido pelo código (com o `@nestjs/platform-express` 12.0.1, que traduzia pela
     *   mensagem, saía 500 `ERRO_INTERNO`);
     * - dois arquivos: um arquivo só por pedido (o `single` do interceptor);
     * - dois arquivos sem licença: o `files: 1`, porque o arquivo que o `fileFilter` descarta não conta no `maxCount`, e
     *   sem o teto o pedido chegaria à recusa por licença, com auditoria;
     * - dezessete campos: o pedido com exatamente as `parts` passa pelo recebimento, e quem recusa é o contrato estrito;
     * - dezoito campos e o campo grande: o `fields` (com o `parts`, que pega a 19ª parte se só o `fields` sair) e o
     *   `fieldSize` param o pedido no campo, antes do arquivo. O arquivo vai acima do teto de tamanho: sem esses tetos,
     *   o contrato recusaria do mesmo jeito, mas só depois de o arquivo chegar, e a resposta seria 413.
     */
    it.each([
      { caso: 'o arquivo em outro campo que não `arquivo`', campos: {}, opcoes: { campoDoArquivo: 'outro' } },
      { caso: 'dois arquivos no campo `arquivo`', campos: {}, opcoes: { copias: 2 } },
      // O teto de arquivos vale antes da licença: o `fileFilter` que descarta o arquivo não o tira da contagem.
      { caso: 'dois arquivos num pedido que seria recusado por licença', campos: { licenca: 'sem_licenca' }, opcoes: { copias: 2 } },
      // Os cinco campos de texto e a única série da escola, mais onze: dezessete campos e o arquivo, exatamente as `parts` do recebimento (6 + 7 séries + 4 de folga).
      { caso: 'dezessete campos e o arquivo (no limite de partes; o contrato estrito recusa)', campos: { extra: camposAMais(11) }, opcoes: {} },
      { caso: 'dezoito campos e o arquivo acima do teto (para nos campos, antes do arquivo)', campos: { extra: camposAMais(12) }, opcoes: { arquivo: PDF_ACIMA_DO_TETO } },
      { caso: 'um campo de texto acima de 2 KiB e o arquivo acima do teto (para no campo, antes do arquivo)', campos: { titulo: 'a'.repeat(2 * 1024 + 1) }, opcoes: { arquivo: PDF_ACIMA_DO_TETO } },
    ])('$caso: `ENTRADA_INVALIDA` no recebimento, e nada é gravado nem lido', async ({ campos, opcoes }) => {
      const escola = await montarEscolaComTurma(api, bancada)
      const extrair = vi.spyOn(extratorDe(api), 'extrair')

      const recusado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, ...campos }, opcoes)
      await esperarExtracao(api)

      expect(erroDe(recusado)).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(extrair).not.toHaveBeenCalled()
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toEqual([])
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.enviado')).toEqual([])
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.recusado')).toEqual([])
    })

    it('exatamente no tamanho máximo o arquivo é recebido', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const noLimite = Buffer.concat([PDF_DE_DEMONSTRACAO, Buffer.alloc(MAXIMO_DE_BYTES_DO_MATERIAL - PDF_DE_DEMONSTRACAO.byteLength, 0x20)])
      const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: noLimite })
      expect(enviado.status).toBe(201)
      await esperarExtracao(api)
      expect((await materiaisDa(bancada, escola.coordenacao.escolaId))[0]).toMatchObject({ tamanho_bytes: MAXIMO_DE_BYTES_DO_MATERIAL })
    })
  })

  describe('o mesmo arquivo de novo', () => {
    it('na mesma escola é `CONFLITO`, e continua um material só; em outra escola é outro material', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const outra = await montarEscolaComTurma(api, bancada)
      await materialPronto(escola)

      const repetido = await enviarMaterial(api, escola.coordenacao, { titulo: 'Outro título', disciplinaId: escola.fisica })
      expect(erroDe(repetido)).toEqual({ status: 409, codigo: ErrorCode.CONFLITO })
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toHaveLength(1)
      expect(await trechosDa(bancada, escola.coordenacao.escolaId)).toHaveLength(6)

      await materialPronto(outra)
      expect(await materiaisDa(bancada, outra.coordenacao.escolaId)).toHaveLength(1)
    })

    it('dois envios do mesmo arquivo ao mesmo tempo gravam um', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const respostas = await Promise.all([1, 2, 3, 4].map(() => enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })))

      expect(respostas.map((resposta) => resposta.status).toSorted()).toEqual([201, 409, 409, 409])
      // Os três que a transação recusou apagaram o objeto que tinham guardado: sobra o do que ficou, e um job só.
      expect(objetosDaEscola(api, escola.coordenacao.escolaId)).toEqual([chaveDe(escola.coordenacao.escolaId, respostas.find((resposta) => resposta.status === 201)?.corpo['id'] as string)])
      const { rows: jobs } = await bancada.pool.query<{ total: string }>(`select count(*) as total from job_registro where escola_id = $1 and tipo = 'material.extrair-pdf'`, [escola.coordenacao.escolaId])
      expect(Number(jobs[0]?.total)).toBe(1)
      await esperarExtracao(api)
      const materiais = await materiaisDa(bancada, escola.coordenacao.escolaId)
      expect(materiais).toHaveLength(1)
      expect(materiais[0]).toMatchObject({ estado: 'pronto', paginas: 6 })
      expect(await trechosDa(bancada, escola.coordenacao.escolaId)).toHaveLength(6)
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.enviado')).toHaveLength(1)
    })
  })

  describe('busca', () => {
    let escola: EscolaComTurma
    let materialId: string

    beforeAll(async () => {
      escola = await montarEscolaComTurma(api, bancada)
      materialId = await materialPronto(escola)
    })

    it('acha "reagente limitante" na página 4, com o material, o título e um pedaço curto da página', async () => {
      const resposta = await buscar(escola.coordenacao, 'reagente limitante')
      expect(resposta.status).toBe(200)
      const itens = itensDe(resposta)
      expect(itens[0]).toMatchObject({ materialId, titulo: 'Material sintético de teste', pagina: 4 })
      expect(itens[0]?.trecho.length).toBeLessThanOrEqual(TAMANHO_MAXIMO_DO_TRECHO_CITADO)
      expect(itens[0]?.trecho.toLowerCase()).toContain('reagente limitante')
      // A página 1, que apresenta o capítulo sem falar de reagente limitante, não vem.
      expect(normalizarTexto(conteudoDaPagina(1)).toLowerCase()).not.toContain('limitante')
      expect(itens.map((item) => item.pagina)).not.toContain(1)
    })

    it('acha pela palavra flexionada: "reagentes limitantes" acha a página que escreve "reagente limitante"', async () => {
      const itens = itensDe(await buscar(escola.coordenacao, 'reagentes limitantes'))
      expect(itens[0]).toMatchObject({ materialId, pagina: 4 })
      // "purezas" acha exatamente as páginas que escrevem "pureza".
      const comPureza = PAGINAS_DO_MATERIAL.map((pagina) => pagina.numero).filter((numero) => conteudoDaPagina(numero).toLowerCase().includes('pureza'))
      expect(comPureza.length).toBeGreaterThan(0)
      expect(itensDe(await buscar(escola.coordenacao, 'purezas')).map((item) => item.pagina).toSorted()).toEqual(comPureza)
    })

    it('o rodapé corrido não entra na busca: o que só ele dizia não acha página nenhuma, e o trecho continua achável pelo conteúdo', async () => {
      // "demonstração" só aparece no rodapé das páginas 2 a 6; na página 1 está na nota de titularidade, que é conteúdo.
      expect(itensDe(await buscar(escola.coordenacao, 'demonstração Turmma')).map((item) => item.pagina)).toEqual([1])
      expect(itensDe(await buscar(escola.coordenacao, 'pureza')).length).toBeGreaterThan(0)
    })

    it('a rota exige todas as palavras; palavra que o material não tem não acha nada', async () => {
      expect(itensDe(await buscar(escola.coordenacao, 'reagente limitante fotossíntese'))).toEqual([])
      expect(itensDe(await buscar(escola.coordenacao, 'fotossíntese'))).toEqual([])
    })

    it('filtra pela disciplina, e respeita o limite', async () => {
      expect(itensDe(await buscar(escola.coordenacao, 'reagente', `&disciplinaId=${escola.fisica}`))).toEqual([])
      expect(itensDe(await buscar(escola.coordenacao, 'reagente', `&disciplinaId=${escola.quimica}`)).length).toBeGreaterThan(1)
      expect(itensDe(await buscar(escola.coordenacao, 'reagente', '&limite=1'))).toHaveLength(1)
    })

    it('busca fora do contrato é `ENTRADA_INVALIDA`: sem texto, com uma letra, com limite acima do teto ou com escola na consulta', async () => {
      for (const consulta of ['', '?q=a', '?q=mol&limite=21', `?q=mol&escolaId=${escola.coordenacao.escolaId}`]) {
        expect(erroDe(await get(escola.coordenacao, `/v1/materiais/busca${consulta}`)), consulta).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      }
    })

    it('`BuscaDeTrechos`, a porta do Assistente e do Tutor: a frase inteira de uma pessoa acha a página, com o texto inteiro dela', async () => {
      const pergunta = 'como eu descubro qual é o reagente limitante?'
      // Pela rota, que exige todas as palavras, a frase inteira não acha nada.
      expect(itensDe(await buscar(escola.coordenacao, pergunta))).toEqual([])

      const trechos = api.app.get(TrechoSearch)
      const noContexto = <T>(funcao: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), escolaId: escola.coordenacao.escolaId }, funcao)
      const achados = await noContexto(() => trechos.buscar({ texto: pergunta, disciplinaId: escola.quimica, limite: 3 }))
      expect(achados).toHaveLength(3)
      expect(achados[0]).toMatchObject({ materialId, disciplinaId: escola.quimica, titulo: 'Material sintético de teste', pagina: 4 })
      expect(normalizarTexto(achados[0]?.texto ?? '')).toBe(conteudoDaPagina(4))

      // Só da disciplina pedida, só do material pedido, e nada para a busca sem palavra aproveitável.
      expect(await noContexto(() => trechos.buscar({ texto: pergunta, disciplinaId: escola.fisica }))).toEqual([])
      expect(await noContexto(() => trechos.buscar({ texto: pergunta, disciplinaId: escola.quimica, materialId: randomUUID() }))).toEqual([])
      expect(await noContexto(() => trechos.buscar({ texto: 'de a o', disciplinaId: escola.quimica }))).toEqual([])
      expect(await noContexto(() => trechos.buscar({ texto: '   ', disciplinaId: escola.quimica }))).toEqual([])

      const doMaterial = await noContexto(() => trechos.doMaterial(materialId, escola.quimica))
      expect(doMaterial.map((trecho) => trecho.pagina)).toEqual([1, 2, 3, 4, 5, 6])
      expect((await noContexto(() => trechos.doMaterial(materialId, escola.quimica, 2))).map((trecho) => trecho.pagina)).toEqual([1, 2])
      expect(await noContexto(() => trechos.doMaterial(randomUUID(), escola.quimica))).toEqual([])
      // A disciplina é filtro, e não enfeite: o material de Química pedido com a disciplina de Física, que existe na
      // mesma escola, não devolve página nenhuma, nem com uma disciplina que não existe.
      expect(await noContexto(() => trechos.doMaterial(materialId, escola.fisica))).toEqual([])
      expect(await noContexto(() => trechos.doMaterial(materialId, randomUUID()))).toEqual([])
      // Sem escola no contexto, a porta falha fechada em vez de buscar em todas as escolas.
      await expect(trechos.buscar({ texto: pergunta, disciplinaId: escola.quimica })).rejects.toThrow()
    })
  })

  describe('enquanto processa, e depois de excluído', () => {
    it('material em `processando` não aparece na busca; pronto, aparece', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const extrator = extratorDe(api)
      const original = extrator.extrair.bind(extrator)
      let liberar: () => void = () => undefined
      const liberado = new Promise<void>((resolver) => {
        liberar = resolver
      })
      vi.spyOn(extrator, 'extrair').mockImplementation(async (bytes, sinal): Promise<ResultadoDaExtracao> => {
        await liberado
        return original(bytes, sinal)
      })

      const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
      expect(enviado.status).toBe(201)
      const id = enviado.corpo['id'] as string
      expect((await get(escola.coordenacao, `/v1/materiais/${id}`)).corpo).toMatchObject({ estado: 'processando', paginas: null, trechos: 0, capitulos: [] })
      expect(itensDe(await buscar(escola.coordenacao, 'reagente limitante'))).toEqual([])

      liberar()
      await esperarExtracao(api)
      expect(itensDe(await buscar(escola.coordenacao, 'reagente limitante'))[0]).toMatchObject({ materialId: id, pagina: 4 })
    })

    it('excluir é lógico, apaga os trechos na mesma hora, audita, e o material some da leitura, da lista e da busca', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const id = await materialPronto(escola)
      expect(await trechosDa(bancada, escola.coordenacao.escolaId)).toHaveLength(6)

      expect((await del(escola.coordenacao, `/v1/materiais/${id}`)).status).toBe(204)

      expect(await trechosDa(bancada, escola.coordenacao.escolaId)).toEqual([])
      const [linha] = await materiaisDa(bancada, escola.coordenacao.escolaId)
      expect(linha).toMatchObject({ id, estado: 'pronto', excluido_por: escola.coordenacao.usuarioId })
      expect(linha?.excluido_em).toBeInstanceOf(Date)
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.excluido')).toEqual([
        { entidade: 'material', entidade_id: id, autor_usuario_id: escola.coordenacao.usuarioId, antes: { disciplinaId: escola.quimica, estado: 'pronto' }, depois: { trechosApagados: 6 } },
      ])
      expect(erroDe(await get(escola.coordenacao, `/v1/materiais/${id}`))).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(listaDeMateriaisResponseSchema.parse((await get(escola.coordenacao, '/v1/materiais')).corpo).itens).toEqual([])
      expect(itensDe(await buscar(escola.coordenacao, 'reagente limitante'))).toEqual([])
      const porta = api.app.get(TrechoSearch)
      expect(await runInContext({ requisicaoId: randomUUID(), escolaId: escola.coordenacao.escolaId }, () => porta.doMaterial(id, escola.quimica))).toEqual([])

      // Excluir de novo é como excluir o que não existe, e não grava segunda auditoria.
      expect(erroDe(await del(escola.coordenacao, `/v1/materiais/${id}`))).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.excluido')).toHaveLength(1)

      // O arquivo excluído pode voltar: o índice único deixa de fora o excluído.
      const deNovo = await materialPronto(escola)
      expect(deNovo).not.toBe(id)
      expect(await trechosDa(bancada, escola.coordenacao.escolaId)).toHaveLength(6)
    })

    it('excluído enquanto era lido, o material não ganha trecho quando a leitura termina', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const extrator = extratorDe(api)
      const original = extrator.extrair.bind(extrator)
      let liberar: () => void = () => undefined
      const liberado = new Promise<void>((resolver) => {
        liberar = resolver
      })
      vi.spyOn(extrator, 'extrair').mockImplementation(async (bytes, sinal): Promise<ResultadoDaExtracao> => {
        await liberado
        return original(bytes, sinal)
      })
      const extrair = vi.spyOn(extrator, 'extrair')
      const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
      const id = enviado.corpo['id'] as string

      // O job já leu o objeto e está no meio da extração quando a coordenação exclui.
      const rodando = esperarExtracao(api)
      await vi.waitFor(() => expect(extrair).toHaveBeenCalled())
      expect((await del(escola.coordenacao, `/v1/materiais/${id}`)).status).toBe(204)
      liberar()
      await rodando

      expect(await trechosDa(bancada, escola.coordenacao.escolaId)).toEqual([])
      expect(itensDe(await buscar(escola.coordenacao, 'reagente limitante'))).toEqual([])
      expect((await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.excluido'))[0]).toMatchObject({ antes: { estado: 'processando' }, depois: { trechosApagados: 0 } })
    })
  })

  describe('lista', () => {
    it('em ordem de envio, paginada, com filtro por disciplina, sem os excluídos; consulta fora do contrato é `ENTRADA_INVALIDA`', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const deQuimica = await materialPronto(escola, escola.quimica)
      const deFisica = await materialPronto(escola, escola.fisica, variacaoDoPdf())
      const excluido = await materialPronto(escola, escola.quimica, variacaoDoPdf())
      expect((await del(escola.coordenacao, `/v1/materiais/${excluido}`)).status).toBe(204)

      const lista = async (consulta = '') => listaDeMateriaisResponseSchema.parse((await get(escola.coordenacao, `/v1/materiais${consulta}`)).corpo)
      expect((await lista()).itens.map((item) => item.id)).toEqual([deQuimica, deFisica])
      expect((await lista(`?disciplinaId=${escola.fisica}`)).itens.map((item) => item.id)).toEqual([deFisica])

      const paginaUm = await lista('?limite=1')
      expect(paginaUm.itens.map((item) => item.id)).toEqual([deQuimica])
      expect(paginaUm.proxima).toBe(deQuimica)
      const paginaDois = await lista(`?limite=1&pagina=${deQuimica}`)
      expect(paginaDois).toMatchObject({ itens: [{ id: deFisica, estado: 'pronto', paginas: 6, trechos: 6 }] })
      expect(paginaDois.proxima).toBeUndefined()

      for (const consulta of ['?limite=101', '?pagina=nao-e-um-id', `?escolaId=${escola.coordenacao.escolaId}`, '?disciplinaId=x']) {
        expect(erroDe(await get(escola.coordenacao, `/v1/materiais${consulta}`)), consulta).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      }
    })
  })

  describe('quem alcança (D75; célula `material` da MATRIZ)', () => {
    it('o professor só alcança material de disciplina com vínculo confirmado dele: lista, lê e busca; o pendente não abre nada', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const deQuimica = await materialPronto(escola, escola.quimica)
      const deFisica = await materialPronto(escola, escola.fisica, variacaoDoPdf())
      const confirmado = await professorCom(escola, escola.quimica, true)
      const pendente = await professorCom(escola, escola.quimica, false)
      const semVinculo = await bancada.sessao(escola.coordenacao.escolaId, 'professor')

      const lista = async (sessao: TestSessao, consulta = '') => listaDeMateriaisResponseSchema.parse((await get(sessao, `/v1/materiais${consulta}`)).corpo).itens.map((item) => item.id)
      expect(await lista(confirmado)).toEqual([deQuimica])
      // O filtro do cliente só restringe: pedir a disciplina sem vínculo não a abre.
      expect(await lista(confirmado, `?disciplinaId=${escola.fisica}`)).toEqual([])
      expect((await get(confirmado, `/v1/materiais/${deQuimica}`)).corpo).toMatchObject({ id: deQuimica, estado: 'pronto' })
      const deOutraDisciplina = await get(confirmado, `/v1/materiais/${deFisica}`)
      const inexistente = await get(confirmado, `/v1/materiais/${randomUUID()}`)
      expect(erroDe(deOutraDisciplina)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect({ ...deOutraDisciplina.corpo.erro, requisicaoId: undefined }).toEqual({ ...inexistente.corpo.erro, requisicaoId: undefined })
      expect(new Set(itensDe(await buscar(confirmado, 'reagente limitante')).map((item) => item.materialId))).toEqual(new Set([deQuimica]))
      expect(itensDe(await buscar(confirmado, 'reagente limitante', `&disciplinaId=${escola.fisica}`))).toEqual([])

      for (const professor of [pendente, semVinculo]) {
        expect(await lista(professor)).toEqual([])
        expect(erroDe(await get(professor, `/v1/materiais/${deQuimica}`))).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
        expect(itensDe(await buscar(professor, 'reagente limitante'))).toEqual([])
      }

      // A coordenação vê a unidade inteira.
      expect(await lista(escola.coordenacao)).toEqual([deQuimica, deFisica])
    })

    it('o vínculo encerrado deixa de abrir o material na requisição seguinte', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const id = await materialPronto(escola)
      const professor = await professorCom(escola, escola.quimica, true)
      expect((await get(professor, `/v1/materiais/${id}`)).status).toBe(200)

      const { rows } = await bancada.pool.query<{ id: string }>('select id from vinculo where escola_id = $1 and usuario_id = $2', [escola.coordenacao.escolaId, professor.usuarioId])
      expect((await post(escola.coordenacao, `/v1/vinculos/${rows[0]?.id ?? ''}/encerrar`, { motivo: 'realocacao' })).status).toBe(200)

      expect(erroDe(await get(professor, `/v1/materiais/${id}`))).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(itensDe(await buscar(professor, 'reagente limitante'))).toEqual([])
    })

    it('o professor não envia nem exclui, e o aluno não alcança nenhuma rota: o mesmo 404 da rota inexistente, e nada muda', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const id = await materialPronto(escola)
      const professor = await professorCom(escola, escola.quimica, true)
      const aluno = await bancada.sessao(escola.coordenacao.escolaId, 'aluno')
      const extrair = vi.spyOn(extratorDe(api), 'extrair')
      const rotaInexistente = await get(aluno, '/v1/rota-que-nao-existe')
      const igualAoInexistente = (resposta: RespostaHttp): void => {
        expect(erroDe(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
        expect({ ...resposta.corpo.erro, requisicaoId: undefined }).toEqual({ ...rotaInexistente.corpo.erro, requisicaoId: undefined })
      }

      igualAoInexistente(await enviarMaterial(api, professor, { disciplinaId: escola.quimica }, { arquivo: variacaoDoPdf() }))
      igualAoInexistente(await del(professor, `/v1/materiais/${id}`))
      igualAoInexistente(await enviarMaterial(api, aluno, { disciplinaId: escola.quimica }, { arquivo: variacaoDoPdf() }))
      igualAoInexistente(await get(aluno, '/v1/materiais'))
      igualAoInexistente(await get(aluno, `/v1/materiais/${id}`))
      igualAoInexistente(await buscar(aluno, 'reagente limitante'))
      igualAoInexistente(await del(aluno, `/v1/materiais/${id}`))
      await esperarExtracao(api)

      expect(extrair).not.toHaveBeenCalled()
      const materiais = await materiaisDa(bancada, escola.coordenacao.escolaId)
      expect(materiais).toHaveLength(1)
      expect(materiais[0]).toMatchObject({ id, excluido_em: null })
      expect(await trechosDa(bancada, escola.coordenacao.escolaId)).toHaveLength(6)
    })
  })

  describe('séries e licença registrada no envio (ingestao-do-material, tarefa 7.0; RF3, RF14, RF16)', () => {
    /** Uma escola com a série do EM 2 e uma segunda, a do EM 1, e o `GET /v1/materiais?serieId=` de quem lê. */
    async function escolaComDuasSeries(): Promise<{ escola: EscolaComTurma; outraSerie: string }> {
      const escola = await montarEscolaComTurma(api, bancada)
      const criada = await post(escola.coordenacao, '/v1/series', { etapa: 'em', ano: 1 })
      expect(criada.status).toBe(201)
      return { escola, outraSerie: criada.corpo['id'] as string }
    }
    const idsDaLista = (resposta: RespostaHttp): string[] => (listaDeMateriaisResponseSchema.parse(resposta.corpo).itens).map((item) => item.id)
    const objetosEnviados = (escolaId: string): string[] => objetosDaEscola(api, escolaId)
    const linhasDoEnvio = async (escolaId: string): Promise<number> => Number((await bancada.pool.query<{ total: string }>('select count(*) as total from envio_de_material where escola_id = $1', [escolaId])).rows[0]?.total)

    it('com duas séries o material aparece no filtro de cada uma e não no de uma terceira; o professor com vínculo confirmado o lê pela série, e o vínculo encerrado não entra', async () => {
      const { escola, outraSerie } = await escolaComDuasSeries()
      const terceiraSerie = (await post(escola.coordenacao, '/v1/series', { etapa: 'em', ano: 3 })).corpo['id'] as string
      const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: [escola.serieId, outraSerie] })
      expect(enviado.status).toBe(201)
      const id = enviado.corpo['id'] as string
      // A resposta e a lista levam as séries em ordem de id, como o banco as devolve.
      expect(enviado.corpo['serieIds']).toEqual([escola.serieId, outraSerie].toSorted())

      expect(idsDaLista(await get(escola.coordenacao, `/v1/materiais?serieId=${escola.serieId}`))).toEqual([id])
      expect(idsDaLista(await get(escola.coordenacao, `/v1/materiais?serieId=${outraSerie}`))).toEqual([id])
      expect(idsDaLista(await get(escola.coordenacao, `/v1/materiais?serieId=${terceiraSerie}`))).toEqual([])
      expect(listaDeMateriaisResponseSchema.parse((await get(escola.coordenacao, '/v1/materiais')).corpo).itens[0]?.serieIds).toEqual([escola.serieId, outraSerie].toSorted())
      await esperarExtracao(api)

      // Vínculo encerrado em Química e aberto em Física: `GET ?serieId` só traz o material de Física.
      const deFisica = (await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.fisica, serieIds: [escola.serieId] }, { arquivo: variacaoDoPdf() })).corpo['id'] as string
      await esperarExtracao(api)
      // O de Física não declara a `outraSerie`: o filtro dela continua trazendo só o de Química (o filtro é por material, não por "alguma linha da série").
      expect(idsDaLista(await get(escola.coordenacao, `/v1/materiais?serieId=${outraSerie}`))).toEqual([id])
      const professor = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
      const emQuimica = await post(escola.coordenacao, '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId: escola.turma, disciplinaId: escola.quimica, papel: 'professor' })
      const emFisica = await post(escola.coordenacao, '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId: escola.turma, disciplinaId: escola.fisica, papel: 'professor' })
      for (const vinculo of [emQuimica, emFisica]) expect((await post(professor, `/v1/vinculos/${vinculo.corpo['id'] as string}/confirmar`)).status).toBe(200)
      expect(idsDaLista(await get(professor, `/v1/materiais?serieId=${escola.serieId}`)).toSorted()).toEqual([id, deFisica].toSorted())
      expect((await post(escola.coordenacao, `/v1/vinculos/${emQuimica.corpo['id'] as string}/encerrar`, { motivo: 'desligamento' })).status).toBe(200)
      expect(idsDaLista(await get(professor, `/v1/materiais?serieId=${escola.serieId}`))).toEqual([deFisica])
    })

    it('sem série, `serieIds` vazio, repetida (também em maiúsculas) ou com oito: `ENTRADA_INVALIDA`, nada lido nem gravado; a série em maiúsculas vira minúsculas', async () => {
      const { escola } = await escolaComDuasSeries()
      const extrair = vi.spyOn(extratorDe(api), 'extrair')
      const semSerie = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: [] }, { arquivo: variacaoDoPdf() })
      const repetida = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: [escola.serieId, escola.serieId] }, { arquivo: variacaoDoPdf() })
      const repetidaEmMaiusculas = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: [escola.serieId, escola.serieId.toUpperCase()] }, { arquivo: variacaoDoPdf() })
      const oito = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: Array.from({ length: 8 }, () => randomUUID()) }, { arquivo: variacaoDoPdf() })
      for (const resposta of [semSerie, repetida, repetidaEmMaiusculas, oito]) expect(erroDe(resposta)).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(extrair).not.toHaveBeenCalled()
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toEqual([])
      expect(objetosEnviados(escola.coordenacao.escolaId)).toEqual([])
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.recusado')).toEqual([])

      const emMaiusculas = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: [escola.serieId.toUpperCase()] }, { arquivo: variacaoDoPdf() })
      expect(emMaiusculas.status).toBe(201)
      expect(emMaiusculas.corpo['serieIds']).toEqual([escola.serieId])
      expect(idsDaLista(await get(escola.coordenacao, `/v1/materiais?serieId=${escola.serieId}`))).toEqual([emMaiusculas.corpo['id'] as string])
      await esperarExtracao(api)
    })

    it('série inexistente e série da escola B: o mesmo `NAO_ENCONTRADO`, nenhum byte lido, nada no storage, em `material` nem em `envio_de_material`, e a auditoria nunca leva o id da B', async () => {
      const { escola } = await escolaComDuasSeries()
      const outraEscola = await montarEscolaComTurma(api, bancada)
      const extrair = vi.spyOn(extratorDe(api), 'extrair')
      const inexistente = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: [randomUUID()] }, { arquivo: variacaoDoPdf() })
      const daB = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: [outraEscola.serieId] }, { arquivo: variacaoDoPdf() })
      // A boa junto da da B não salva o pedido: a da B derruba o pedido inteiro.
      const umaBoaEUmaDaB = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: [escola.serieId, outraEscola.serieId] }, { arquivo: variacaoDoPdf() })
      // A recusa por licença também só conta com as séries conferidas.
      const semLicencaComSerieDaB = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: [outraEscola.serieId], licenca: 'sem_licenca' }, { arquivo: variacaoDoPdf() })
      for (const resposta of [inexistente, daB, umaBoaEUmaDaB, semLicencaComSerieDaB]) {
        expect(erroDe(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
        expect({ ...resposta.corpo.erro, requisicaoId: undefined }).toEqual({ ...inexistente.corpo.erro, requisicaoId: undefined })
      }
      expect(extrair).not.toHaveBeenCalled()
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toEqual([])
      expect(objetosEnviados(escola.coordenacao.escolaId)).toEqual([])
      expect(await linhasDoEnvio(escola.coordenacao.escolaId)).toBe(0)
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.recusado')).toEqual([])
      expect(JSON.stringify(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.recusado'))).not.toContain(outraEscola.serieId)
    })

    it('`GET /v1/materiais?serieId` com a série da B responde como a que não existe: lista vazia, mesmo com material da B nessa série', async () => {
      const { escola } = await escolaComDuasSeries()
      const outraEscola = await montarEscolaComTurma(api, bancada)
      await enviarMaterial(api, outraEscola.coordenacao, { disciplinaId: outraEscola.quimica })
      await esperarExtracao(api)
      await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
      await esperarExtracao(api)

      // A garantia de que a série da A nunca leva material da B é a FK composta de `material_serie` (`escola_id` + `serie_id`, e `escola_id` + `material_id`): o banco não aceita a linha cruzada.
      // O que este caso prova é o filtro da lista, que repete o escopo da escola e trata a série da B como a que não existe.
      const daB = await get(escola.coordenacao, `/v1/materiais?serieId=${outraEscola.serieId}`)
      const inexistente = await get(escola.coordenacao, `/v1/materiais?serieId=${randomUUID()}`)
      expect(daB.status).toBe(200)
      expect(daB.corpo).toEqual(inexistente.corpo)
      expect(idsDaLista(daB)).toEqual([])
    })

    it('terceiro sem `licencaId`: `MATERIAL_SEM_LICENCA` antes de abrir o arquivo, gravado com o motivo e as séries', async () => {
      const { escola } = await escolaComDuasSeries()
      const extrair = vi.spyOn(extratorDe(api), 'extrair')
      const resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: [escola.serieId], titularidade: 'terceiro_com_licenca', licenca: 'licenca_aberta' }, { arquivo: Buffer.from('isto não é um PDF') })
      expect(erroDe(resposta)).toEqual({ status: 422, codigo: ErrorCode.MATERIAL_SEM_LICENCA })
      expect(extrair).not.toHaveBeenCalled()
      expect(objetosEnviados(escola.coordenacao.escolaId)).toEqual([])
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toEqual([])
      const [recusa] = await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.recusado')
      expect(recusa?.depois).toMatchObject({ titularidade: 'terceiro_com_licenca', motivo: 'sem_licenca', serieIds: [escola.serieId] })
    })

    it.each([
      { caso: 'vencida', vigenteDesde: '2020-01-01', vigenteAte: '2020-12-31', status: 422, codigo: ErrorCode.LICENCA_VENCIDA, motivo: 'licenca_vencida' },
      { caso: 'que só começa no futuro', vigenteDesde: '2999-01-01', vigenteAte: null, status: 422, codigo: ErrorCode.LICENCA_VENCIDA, motivo: 'licenca_vencida' },
    ])('licença $caso: $codigo antes de abrir o arquivo, gravado com o motivo e as séries; nada no storage nem em `material`', async ({ vigenteDesde, vigenteAte, status, codigo, motivo }) => {
      const { escola } = await escolaComDuasSeries()
      const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao, { vigenteDesde, vigenteAte })
      const extrair = vi.spyOn(extratorDe(api), 'extrair')
      const resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: [escola.serieId], titularidade: 'terceiro_com_licenca', licencaId }, { arquivo: Buffer.from('isto não é um PDF') })
      expect(erroDe(resposta)).toEqual({ status, codigo })
      expect(extrair).not.toHaveBeenCalled()
      expect(objetosEnviados(escola.coordenacao.escolaId)).toEqual([])
      expect(await linhasDoEnvio(escola.coordenacao.escolaId)).toBe(0)
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toEqual([])
      const [recusa] = await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.recusado')
      expect(recusa).toMatchObject({ entidade: 'disciplina', entidade_id: escola.quimica, depois: { titularidade: 'terceiro_com_licenca', motivo, serieIds: [escola.serieId] } })
    })

    it('licença inexistente e licença da escola B: o mesmo `NAO_ENCONTRADO`, antes de abrir o arquivo, gravado com o motivo e sem o id da B', async () => {
      const { escola } = await escolaComDuasSeries()
      const outraEscola = await montarEscolaComTurma(api, bancada)
      const licencaDaB = await registrarLicencaDeTeste(api, outraEscola.coordenacao)
      const extrair = vi.spyOn(extratorDe(api), 'extrair')
      const inexistente = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licencaId: randomUUID() }, { arquivo: Buffer.from('lixo') })
      const daB = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licencaId: licencaDaB }, { arquivo: Buffer.from('lixo') })
      for (const resposta of [inexistente, daB]) {
        expect(erroDe(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
        expect({ ...resposta.corpo.erro, requisicaoId: undefined }).toEqual({ ...inexistente.corpo.erro, requisicaoId: undefined })
      }
      expect(extrair).not.toHaveBeenCalled()
      expect(objetosEnviados(escola.coordenacao.escolaId)).toEqual([])
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toEqual([])
      const recusas = await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.recusado')
      expect(recusas.map((recusa) => (recusa.depois as { motivo: string }).motivo)).toEqual(['licenca_inexistente', 'licenca_inexistente'])
      expect(JSON.stringify(recusas)).not.toContain(licencaDaB)
    })

    it('o último dia da licença ainda vale, e o material de terceiro sai com o `licenciante` da licença', async () => {
      const { escola } = await escolaComDuasSeries()
      try {
        relogio.fixo = new Date('2026-11-12T23:30:00-03:00')
        const noUltimoDia = await registrarLicencaDeTeste(api, escola.coordenacao, { licenciante: 'Editora do último dia', vigenteAte: '2026-11-12' })
        const resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licencaId: noUltimoDia, licenca: 'licenca_aberta' })
        expect(resposta.status).toBe(201)
        expect(resposta.corpo).toMatchObject({ licenciante: 'Editora do último dia', licencaId: noUltimoDia })
        await esperarExtracao(api)
      } finally {
        relogio.fixo = undefined
      }
    })

    it('a licença citada em maiúsculas vale como a de minúsculas: o material sai com o id dela em minúsculas', async () => {
      const { escola } = await escolaComDuasSeries()
      const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao, { licenciante: 'Editora das maiúsculas' })
      const resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licencaId: licencaId.toUpperCase(), licenca: 'licenca_aberta' })
      expect(resposta.status).toBe(201)
      expect(resposta.corpo).toMatchObject({ licenciante: 'Editora das maiúsculas', licencaId })
      await esperarExtracao(api)
    })

    it('as sete séries do teto com uma licença registrada: o recebimento aceita os treze campos do pedido e o material sai com as sete', async () => {
      const { escola, outraSerie } = await escolaComDuasSeries()
      const outras = [
        outraSerie,
        (await post(escola.coordenacao, '/v1/series', { etapa: 'em', ano: 3 })).corpo['id'] as string,
        ...(await Promise.all([6, 7, 8, 9].map(async (ano) => (await post(escola.coordenacao, '/v1/series', { etapa: 'ef_anos_finais', ano })).corpo['id'] as string))),
      ]
      const serieIds = [escola.serieId, ...outras]
      expect(new Set(serieIds).size).toBe(7)
      const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao, { licenciante: 'Editora das sete séries' })
      const resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds, titularidade: 'terceiro_com_licenca', licencaId, licenca: 'licenca_aberta' })
      expect(resposta.status).toBe(201)
      expect(resposta.corpo['serieIds']).toEqual(serieIds.toSorted())
      expect(resposta.corpo).toMatchObject({ licenciante: 'Editora das sete séries', licencaId })
      await esperarExtracao(api)
    })

    it('a vigência da licença é conferida pelo relógio injetado, não pelo do sistema: vale no dia dentro do prazo e deixa de valer no seguinte', async () => {
      const { escola } = await escolaComDuasSeries()
      const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao, { licenciante: 'Editora de 2020', vigenteDesde: '2020-01-01', vigenteAte: '2020-12-31' })
      const pedido = { disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licencaId, licenca: 'licenca_aberta' } as const
      try {
        relogio.fixo = new Date('2020-12-31T23:00:00-03:00')
        const noUltimoDia = await enviarMaterial(api, escola.coordenacao, pedido)
        expect(noUltimoDia.status).toBe(201)
        await esperarExtracao(api)
        relogio.fixo = new Date('2021-01-01T00:01:00-03:00')
        const noDiaSeguinte = await enviarMaterial(api, escola.coordenacao, pedido, { arquivo: variacaoDoPdf() })
        expect(erroDe(noDiaSeguinte)).toEqual({ status: 422, codigo: ErrorCode.LICENCA_VENCIDA })
      } finally {
        relogio.fixo = undefined
      }
    })

    it('escola sem ano letivo em curso: o envio com séries funciona', async () => {
      const coordenacao = await bancada.escolaComSessao('coordenador')
      escolasDoTeste.push(coordenacao.escolaId)
      const serie = (await post(coordenacao, '/v1/series', { etapa: 'em', ano: 2 })).corpo['id'] as string
      const disciplina = (await post(coordenacao, '/v1/disciplinas', { nome: 'Química' })).corpo['id'] as string
      const resposta = await enviarMaterial(api, coordenacao, { disciplinaId: disciplina, serieIds: [serie] })
      expect(resposta.status).toBe(201)
      expect(resposta.corpo['serieIds']).toEqual([serie])
      await esperarExtracao(api)
    })
  })

  describe('tetos de envio, por pessoa e por escola (regra 80, itens 1 e 3)', () => {
    it('a pessoa no teto recebe `LIMITE_EXCEDIDO` com a espera; outra pessoa da mesma escola ainda envia; a escola no teto segura todos, e só ela', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const outraEscola = await montarEscolaComTurma(api, bancada)
      const segunda = await bancada.sessao(escola.coordenacao.escolaId, 'coordenador')
      const terceira = await bancada.sessao(escola.coordenacao.escolaId, 'coordenador')

      await materiaisJaEnviados(bancada, escola.coordenacao, escola.quimica, ENVIOS_POR_USUARIO_NA_JANELA - 1)
      const ultimoDaPessoa = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: variacaoDoPdf() })
      expect(ultimoDaPessoa.status).toBe(201)
      await esperarExtracao(api)

      const acimaDoTeto = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: variacaoDoPdf() })
      expect(erroDe(acimaDoTeto)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
      expect(Number(acimaDoTeto.retryAfter)).toBeGreaterThan(0)
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toHaveLength(ENVIOS_POR_USUARIO_NA_JANELA)

      // O teto é da pessoa: a segunda coordenadora, atrás do mesmo IP, envia.
      const daSegunda = await enviarMaterial(api, segunda, { disciplinaId: escola.quimica }, { arquivo: variacaoDoPdf() })
      expect(daSegunda.status).toBe(201)
      await esperarExtracao(api)

      // O envio antigo, de fora da janela, não conta.
      await materiaisJaEnviados(bancada, terceira, escola.quimica, 5, { enviadoHaMs: 2 * 60 * 60_000 })
      await materiaisJaEnviados(bancada, segunda, escola.quimica, ENVIOS_POR_ESCOLA_NA_JANELA - ENVIOS_POR_USUARIO_NA_JANELA - 2)
      const ultimoDaEscola = await enviarMaterial(api, terceira, { disciplinaId: escola.quimica }, { arquivo: variacaoDoPdf() })
      expect(ultimoDaEscola.status).toBe(201)
      await esperarExtracao(api)

      // A escola chegou ao teto dela: a terceira pessoa, que quase não enviou, também é segurada.
      const comAEscolaNoTeto = await enviarMaterial(api, terceira, { disciplinaId: escola.quimica }, { arquivo: variacaoDoPdf() })
      expect(erroDe(comAEscolaNoTeto)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })

      // Uma escola não degrada outra.
      expect((await enviarMaterial(api, outraEscola.coordenacao, { disciplinaId: outraEscola.quimica }, { arquivo: variacaoDoPdf() })).status).toBe(201)
      await esperarExtracao(api)
    })

    it('a recusa por licença não depende do teto: quem está acima dele ouve o teto, e nada é auditado como recusa', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      await materiaisJaEnviados(bancada, escola.coordenacao, escola.quimica, ENVIOS_POR_USUARIO_NA_JANELA)
      const resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, licenca: 'sem_licenca' })
      expect(erroDe(resposta)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.recusado')).toEqual([])
    })

    it('com o teto de materiais em leitura da escola cheio, o envio espera a vez com `LIMITE_EXCEDIDO`; os de outra escola passam', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const outraEscola = await montarEscolaComTurma(api, bancada)
      const emLeitura = await materiaisJaEnviados(bancada, escola.coordenacao, escola.quimica, MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA, { estado: 'processando' })

      const segurado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
      expect(erroDe(segurado)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
      expect(Number(segurado.retryAfter)).toBeGreaterThan(0)
      expect((await enviarMaterial(api, outraEscola.coordenacao, { disciplinaId: outraEscola.quimica })).status).toBe(201)
      await esperarExtracao(api)

      // Um deles sai de `processando`: a vaga volta.
      await bancada.pool.query(`update material set estado = 'falhou', falha = 'extracao_falhou' where id = $1`, [emLeitura[0]])
      expect((await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })).status).toBe(201)
      await esperarExtracao(api)
    })
  })

  describe('o PDF espera no storage e sai dele em todo caminho (1.0; D49)', () => {
    it('o envio guarda o PDF no storage e pede o job `material.extrair-pdf` na fila `pdf`, com o id do material como chave de idempotência; depois da extração, o objeto sai', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
      expect(enviado.status).toBe(201)
      const id = enviado.corpo['id'] as string
      const chave = chaveDe(escola.coordenacao.escolaId, id)

      expect(await armazemDe(api).existe(chave)).toBe(true)
      const { rows: jobs } = await bancada.pool.query<{ fila: string; estado: string; dados: unknown; chave_idempotencia: string | null }>(
        "select fila, estado, dados, chave_idempotencia from job_registro where escola_id = $1 and tipo = 'material.extrair-pdf'",
        [escola.coordenacao.escolaId],
      )
      expect(jobs).toEqual([{ fila: 'pdf', estado: 'aguardando', dados: { materialId: id }, chave_idempotencia: id }])
      expect((await materiaisDa(bancada, escola.coordenacao.escolaId))[0]).toMatchObject({ id, estado: 'processando', processado_em: null, objeto_apagado_em: null })

      await esperarExtracao(api)
      expect(await armazemDe(api).existe(chave)).toBe(false)
      const [linha] = await materiaisDa(bancada, escola.coordenacao.escolaId)
      expect(linha).toMatchObject({ id, estado: 'pronto' })
      expect(linha?.processado_em).toBeInstanceOf(Date)
      expect(linha?.objeto_apagado_em).toBeInstanceOf(Date)
    })

    it('PDF sem texto ou corrompido também sai do storage, na falha', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const semTexto = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: pdfSemTexto() })
      const corrompido = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: pdfCorrompido() })
      await esperarExtracao(api)
      for (const enviado of [semTexto, corrompido]) expect(await armazemDe(api).existe(chaveDe(escola.coordenacao.escolaId, enviado.corpo['id'] as string))).toBe(false)
      for (const linha of await materiaisDa(bancada, escola.coordenacao.escolaId)) {
        expect(linha.estado).toBe('falhou')
        expect(linha.objeto_apagado_em).toBeInstanceOf(Date)
      }
    })

    it('storage fora do ar no envio: 503 `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`, nenhuma linha, nenhum job, nenhuma auditoria de envio', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const armazem = armazemDe(api)
      armazem.fora = true
      try {
        const resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
        expect(erroDe(resposta)).toEqual({ status: 503, codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO })
        expect(Number(resposta.retryAfter)).toBeGreaterThan(0)
      } finally {
        armazem.fora = false
      }
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toEqual([])
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.enviado')).toEqual([])
      const { rows } = await bancada.pool.query("select 1 from job_registro where escola_id = $1 and tipo = 'material.extrair-pdf'", [escola.coordenacao.escolaId])
      expect(rows).toEqual([])
    })

    it('o envio que a transação recusa pelo teto de materiais em leitura, vencido na corrida, não deixa o objeto para trás', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const envios = Array.from({ length: MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA + 2 }, () => enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: variacaoDoPdf() }))

      const respostas = await Promise.all(envios)

      // Tanto faz quem chegou primeiro: três ficam, e os dois que passaram pela conferência da entrada mas perderam na transação, ou nela, não guardam nada.
      expect(respostas.map((resposta) => resposta.status).toSorted()).toEqual([201, 201, 201, 429, 429])
      const ficaram = respostas.filter((resposta) => resposta.status === 201).map((resposta) => chaveDe(escola.coordenacao.escolaId, resposta.corpo['id'] as string))
      expect(objetosDaEscola(api, escola.coordenacao.escolaId).toSorted()).toEqual(ficaram.toSorted())
      await esperarExtracao(api)
    })

    it('o envio recusado pela transação, com o storage recusando apagar o objeto: a recusa chega, o objeto que sobrou aparece no log só pelo id, e a varredura o acha', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      await materialPronto(escola)
      const armazem = armazemDe(api)
      linhasDeLog.length = 0
      armazem.falhaAoApagar = true
      let resposta: RespostaHttp
      try {
        resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
      } finally {
        armazem.falhaAoApagar = false
      }

      expect(erroDe(resposta)).toEqual({ status: 409, codigo: ErrorCode.CONFLITO })
      const sobrou = objetosDaEscola(api, escola.coordenacao.escolaId)
      expect(sobrou).toHaveLength(1)
      const avisos = linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>).filter((linha) => linha['evento'] === 'material.objeto_nao_apagado')
      expect(avisos).toEqual([expect.objectContaining({ materialId: sobrou[0]?.split('/')[2] })])
      expect(Object.keys(avisos[0] ?? {}).toSorted()).toEqual(expect.arrayContaining(['evento', 'materialId', 'erro']))
      expect(JSON.stringify(avisos)).not.toContain('material-temporario')
      await armazem.apagar(sobrou[0] ?? '')
    })

    it('o envio que a transação recusa pelo duplicado não deixa o objeto para trás', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      await materialPronto(escola)
      const antes = armazemDe(api).bytes.size
      expect(erroDe(await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica }))).toEqual({ status: 409, codigo: ErrorCode.CONFLITO })
      expect(armazemDe(api).bytes.size).toBe(antes)
      expect((await trechosDa(bancada, escola.coordenacao.escolaId)).length).toBe(6)
    })

    it('excluir um material `processando` apaga o objeto e registra', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
      const id = enviado.corpo['id'] as string
      expect(await armazemDe(api).existe(chaveDe(escola.coordenacao.escolaId, id))).toBe(true)

      expect((await del(escola.coordenacao, `/v1/materiais/${id}`)).status).toBe(204)

      expect(await armazemDe(api).existe(chaveDe(escola.coordenacao.escolaId, id))).toBe(false)
      expect((await materiaisDa(bancada, escola.coordenacao.escolaId))[0]).toMatchObject({ id, estado: 'processando' })
      expect((await materiaisDa(bancada, escola.coordenacao.escolaId))[0]?.objeto_apagado_em).toBeInstanceOf(Date)
    })

    it('o job que chega depois da exclusão de um material `processando` não extrai nem grava nada, mesmo com o objeto de volta no storage', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
      const id = enviado.corpo['id'] as string
      const chave = chaveDe(escola.coordenacao.escolaId, id)
      const bytes = armazemDe(api).bytes.get(chave)
      if (bytes === undefined) throw new Error('o envio não guardou o PDF')
      expect((await del(escola.coordenacao, `/v1/materiais/${id}`)).status).toBe(204)
      // O objeto volta (a exclusão o apagou): sem a conferência da exclusão, o job o extrairia.
      armazemDe(api).bytes.set(chave, bytes)
      const extrair = vi.spyOn(extratorDe(api), 'extrair')

      try {
        await expect(extrairMaterial(api, escola.coordenacao.escolaId, id)).resolves.toBeUndefined()
        expect(extrair).not.toHaveBeenCalled()
      } finally {
        extrair.mockRestore()
        armazemDe(api).bytes.delete(chave)
      }

      expect(await trechosDa(bancada, escola.coordenacao.escolaId)).toEqual([])
      expect((await materiaisDa(bancada, escola.coordenacao.escolaId))[0]).toMatchObject({ id, estado: 'processando', falha: null })
    })

    it('a coordenação da A que exclui o id de um material `processando` da B recebe o mesmo `NAO_ENCONTRADO`, e o objeto e a linha da B ficam', async () => {
      const a = await montarEscolaComTurma(api, bancada)
      const b = await montarEscolaComTurma(api, bancada)
      const deB = (await enviarMaterial(api, b.coordenacao, { disciplinaId: b.quimica })).corpo['id'] as string
      const inexistente = await del(a.coordenacao, `/v1/materiais/${randomUUID()}`)

      const resposta = await del(a.coordenacao, `/v1/materiais/${deB}`)

      expect(erroDe(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(erroDe(inexistente)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(armazemDe(api).bytes.has(chaveDe(b.coordenacao.escolaId, deB))).toBe(true)
      expect((await materiaisDa(bancada, b.coordenacao.escolaId))[0]).toMatchObject({ id: deB, estado: 'processando', excluido_em: null, objeto_apagado_em: null })
      await esperarExtracao(api)
    })

    it('excluir com o storage fora deixa o objeto e `objeto_apagado_em` nulo, para o expurgo; a exclusão vale', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
      const id = enviado.corpo['id'] as string
      const armazem = armazemDe(api)
      armazem.falhaAoApagar = true
      try {
        expect((await del(escola.coordenacao, `/v1/materiais/${id}`)).status).toBe(204)
      } finally {
        armazem.falhaAoApagar = false
      }
      expect(await armazemDe(api).existe(chaveDe(escola.coordenacao.escolaId, id))).toBe(true)
      const [linha] = await materiaisDa(bancada, escola.coordenacao.escolaId)
      expect(linha?.excluido_em).toBeInstanceOf(Date)
      expect(linha?.objeto_apagado_em).toBeNull()
      await armazem.apagar(chaveDe(escola.coordenacao.escolaId, id))
    })
  })

  describe('log (regra 20, item 9)', () => {
    it('nenhuma linha leva título, licenciante, nome de arquivo, texto da busca nem texto de trecho; leva id, tamanho, páginas e código', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const TITULO = `Sentinela-título-${randomUUID().slice(0, 8)}`
      const LICENCIANTE = `Sentinela-licenciante-${randomUUID().slice(0, 8)}`
      const ARQUIVO = `sentinela-arquivo-${randomUUID().slice(0, 8)}.pdf`
      const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao, { licenciante: LICENCIANTE })
      const campos = { titulo: TITULO, disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licencaId, licenca: 'licenca_comercial_autorizada' }
      linhasDeLog.length = 0

      const enviado = await enviarMaterial(api, escola.coordenacao, campos, { nomeDoArquivo: ARQUIVO })
      await esperarExtracao(api)
      const id = enviado.corpo['id'] as string
      const respostas = [
        enviado,
        await enviarMaterial(api, escola.coordenacao, campos, { nomeDoArquivo: ARQUIVO }),
        await enviarMaterial(api, escola.coordenacao, { ...campos, licenca: 'sem_licenca' }, { nomeDoArquivo: ARQUIVO }),
        await enviarMaterial(api, escola.coordenacao, campos, { nomeDoArquivo: ARQUIVO, arquivo: Buffer.from('não é PDF') }),
        await enviarMaterial(api, escola.coordenacao, campos, { nomeDoArquivo: ARQUIVO, arquivo: pdfSemTexto() }),
        await get(escola.coordenacao, '/v1/materiais'),
        await get(escola.coordenacao, `/v1/materiais/${id}`),
        await buscar(escola.coordenacao, 'reagente limitante'),
        await del(escola.coordenacao, `/v1/materiais/${id}`),
      ]
      await esperarExtracao(api)
      expect(respostas.map((resposta) => resposta.status)).toEqual([201, 409, 422, 400, 201, 200, 200, 200, 204])

      const linhas = linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>)
      // O log está sendo lido: as linhas do módulo estão lá, com o que elas podem levar.
      expect(linhas.find((linha) => linha['evento'] === 'material.enviado')).toMatchObject({ materialId: id, tamanho: PDF_DE_DEMONSTRACAO.byteLength, escolaId: escola.coordenacao.escolaId })
      expect(linhas.find((linha) => linha['evento'] === 'material.extraido')).toMatchObject({ materialId: id, paginasTotal: 6, trechosTotal: 6, escolaId: escola.coordenacao.escolaId })
      expect(linhas.find((linha) => linha['evento'] === 'material.recusado')).toMatchObject({ disciplinaId: escola.quimica, codigo: 'sem_licenca' })
      expect(linhas.find((linha) => linha['evento'] === 'material.extracao_falhou')).toMatchObject({ codigo: 'sem_texto' })
      expect(linhas.find((linha) => linha['evento'] === 'material.excluido')).toMatchObject({ materialId: id, trechosTotal: 6 })

      const todoOLog = linhasDeLog.join('\n')
      for (const sentinela of [TITULO, LICENCIANTE, ARQUIVO, 'Sentinela', 'sentinela-arquivo', 'reagente limitante', 'Reagente limitante', 'estequiometria', 'Estequiometria']) {
        expect(todoOLog, sentinela).not.toContain(sentinela)
      }
    })
  })
})
