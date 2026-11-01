import { runInContext } from '@educa/core'
import { ErrorCode, buscaDeMaterialResponseSchema, listaDeMateriaisResponseSchema, materialResponseSchema, MAXIMO_DE_BYTES_DO_MATERIAL, TAMANHO_MAXIMO_DO_TRECHO_CITADO } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { linhasDoBloco, normalizarTexto, paginaDoMaterial, PAGINAS_DO_MATERIAL } from '../../../tools/demonstracao/conteudo-estequiometria.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { TrechoSearch } from '../src/material/trecho-search.js'
import { PdfExtractor, type ResultadoDaExtracao } from '../src/material/pdf-extraction.js'
import { ENVIOS_POR_ESCOLA_NA_JANELA, ENVIOS_POR_USUARIO_NA_JANELA, IDADE_DO_MATERIAL_PARADO_MS, MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA, MaterialService } from '../src/material/material.service.js'
import { chamar, subirApi, type TestApi, type RespostaHttp } from './test-api.js'
import { montarEscolaComTurma as montarEscola, type EscolaComTurma } from './escola-turma.fixture.js'
import {
  apagarMateriais,
  auditoriaDa,
  enviarMaterial,
  esperarExtracao,
  materiaisDa,
  materiaisJaEnviados,
  PDF_DE_DEMONSTRACAO,
  pdfCorrompido,
  pdfSemTexto,
  trechosDa,
  variacaoDoPdf,
} from './material.fixture.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'

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

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog)
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
      expect(resposta).toMatchObject({ titulo: 'Química 2 — Capítulo 7', disciplinaId: escola.quimica, titularidade: 'escola', licenciante: null, licenca: 'autoria_da_escola', estado: 'processando', falha: null, paginas: null, trechos: 0 })

      await esperarExtracao(api)
      const lido = materialResponseSchema.parse((await get(escola.coordenacao, `/v1/materiais/${resposta.id}`)).corpo)
      expect(lido).toMatchObject({ id: resposta.id, estado: 'pronto', falha: null, paginas: 6, trechos: 6 })

      const trechos = await trechosDa(bancada, escola.coordenacao.escolaId)
      expect(trechos.map((trecho) => trecho.pagina)).toEqual([1, 2, 3, 4, 5, 6])
      for (const { numero } of PAGINAS_DO_MATERIAL) {
        const trecho = trechos[numero - 1]
        expect(trecho).toMatchObject({ material_id: resposta.id, disciplina_id: escola.quimica })
        expect(normalizarTexto(trecho?.texto ?? ''), `página ${String(numero)}`).toBe(conteudoDaPagina(numero))
      }

      // O arquivo não é guardado: fica o resumo dele, o tamanho e quem declarou.
      const [linha] = await materiaisDa(bancada, escola.coordenacao.escolaId)
      expect(linha).toMatchObject({ id: resposta.id, declaracao: true, tamanho_bytes: PDF_DE_DEMONSTRACAO.byteLength, enviado_por: escola.coordenacao.usuarioId, excluido_em: null })
      expect(linha?.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.enviado')).toEqual([
        { entidade: 'material', entidade_id: resposta.id, autor_usuario_id: escola.coordenacao.usuarioId, antes: null, depois: { disciplinaId: escola.quimica, titularidade: 'escola', licenca: 'autoria_da_escola', declaracao: true } },
      ])
    })

    it('material de terceiro guarda o licenciante; sem ele, ou com ele em material próprio, é `ENTRADA_INVALIDA` e nada é gravado', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const deTerceiro = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licenca: 'licenca_comercial_autorizada', licenciante: 'Editora sintética' })
      expect(deTerceiro.status).toBe(201)
      expect(deTerceiro.corpo).toMatchObject({ titularidade: 'terceiro_com_licenca', licenciante: 'Editora sintética', licenca: 'licenca_comercial_autorizada' })
      await esperarExtracao(api)

      const semLicenciante = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licenca: 'licenca_aberta' }, { arquivo: variacaoDoPdf() })
      const licencianteAMais = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'escola', licenciante: 'Editora sintética' }, { arquivo: variacaoDoPdf() })
      // Nada de escola vem do cliente: o contrato é estrito.
      const comEscola = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, extra: { escolaId: escola.coordenacao.escolaId } }, { arquivo: variacaoDoPdf() })
      for (const resposta of [semLicenciante, licencianteAMais, comEscola]) expect(erroDe(resposta)).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toHaveLength(1)
    })

    it('os campos ao lado do arquivo passam pelo ZodValidationPipe: o PDF válido com campo fora do contrato é `ENTRADA_INVALIDA`, e o arquivo nem chega à leitura nem vira material (17.0)', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const extrair = vi.spyOn(api.app.get(PdfExtractor), 'extrair')
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
      const deTerceiro = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licenca: 'licenca_comercial_autorizada', licenciante: 'Editora sintética' })
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

  describe('recusa por licença, antes de abrir o arquivo (D5, D75)', () => {
    it.each([
      { caso: 'sem licença', campos: { licenca: 'sem_licenca', declaracao: 'true' }, motivo: 'sem_licenca', declaracao: true },
      { caso: 'sem a declaração', campos: { licenca: 'autoria_da_escola', declaracao: 'false' }, motivo: 'sem_declaracao', declaracao: false },
    ])('$caso: `MATERIAL_SEM_LICENCA`, a extração não é chamada, nenhuma linha em `material`, e a auditoria fica', async ({ campos, motivo, declaracao }) => {
      const escola = await montarEscolaComTurma(api, bancada)
      const extrair = vi.spyOn(api.app.get(PdfExtractor), 'extrair')

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
        expect(recusa).toEqual({ entidade: 'disciplina', entidade_id: escola.quimica, autor_usuario_id: escola.coordenacao.usuarioId, antes: null, depois: { titularidade: 'escola', licenca: campos.licenca, declaracao, motivo } })
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
      const extrair = vi.spyOn(api.app.get(PdfExtractor), 'extrair')
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

      const lidos = await Promise.all([primeiro, segundo].map(async (enviado) => materialResponseSchema.parse((await get(escola.coordenacao, `/v1/materiais/${enviado.corpo['id'] as string}`)).corpo)))
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
      const extrair = vi.spyOn(api.app.get(PdfExtractor), 'extrair')
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
     * - dez campos: o pedido com exatamente as `parts` passa pelo recebimento, e quem recusa é o contrato estrito;
     * - onze campos e o campo grande: o `fields` (com o `parts`, que pega a 12ª parte se só o `fields` sair) e o
     *   `fieldSize` param o pedido no campo, antes do arquivo. O arquivo vai acima do teto de tamanho: sem esses tetos,
     *   o contrato recusaria do mesmo jeito, mas só depois de o arquivo chegar, e a resposta seria 413.
     */
    it.each([
      { caso: 'o arquivo em outro campo que não `arquivo`', campos: {}, opcoes: { campoDoArquivo: 'outro' } },
      { caso: 'dois arquivos no campo `arquivo`', campos: {}, opcoes: { copias: 2 } },
      // O teto de arquivos vale antes da licença: o `fileFilter` que descarta o arquivo não o tira da contagem.
      { caso: 'dois arquivos num pedido que seria recusado por licença', campos: { licenca: 'sem_licenca' }, opcoes: { copias: 2 } },
      // Os cinco campos que o pedido manda, mais cinco: dez campos e o arquivo, exatamente as `parts` do recebimento.
      { caso: 'dez campos e o arquivo (no limite de partes; o contrato estrito recusa)', campos: { extra: camposAMais(5) }, opcoes: {} },
      { caso: 'onze campos e o arquivo acima do teto (para nos campos, antes do arquivo)', campos: { extra: camposAMais(6) }, opcoes: { arquivo: PDF_ACIMA_DO_TETO } },
      { caso: 'um campo de texto acima de 2 KiB e o arquivo acima do teto (para no campo, antes do arquivo)', campos: { titulo: 'a'.repeat(2 * 1024 + 1) }, opcoes: { arquivo: PDF_ACIMA_DO_TETO } },
    ])('$caso: `ENTRADA_INVALIDA` no recebimento, e nada é gravado nem lido', async ({ campos, opcoes }) => {
      const escola = await montarEscolaComTurma(api, bancada)
      const extrair = vi.spyOn(api.app.get(PdfExtractor), 'extrair')

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
      await esperarExtracao(api)

      expect(respostas.map((resposta) => resposta.status).toSorted()).toEqual([201, 409, 409, 409])
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
      const extrator = api.app.get(PdfExtractor)
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
      expect((await get(escola.coordenacao, `/v1/materiais/${id}`)).corpo).toMatchObject({ estado: 'processando', paginas: null, trechos: 0 })
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
      const extrator = api.app.get(PdfExtractor)
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
      const id = enviado.corpo['id'] as string

      expect((await del(escola.coordenacao, `/v1/materiais/${id}`)).status).toBe(204)
      liberar()
      await esperarExtracao(api)

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
      const extrair = vi.spyOn(api.app.get(PdfExtractor), 'extrair')
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

  describe('nenhum material fica preso em `processando`', () => {
    it('a varredura dá por falho o que ficou `processando` além do prazo, e não toca no que acabou de chegar', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const [parado] = await materiaisJaEnviados(bancada, escola.coordenacao, escola.quimica, 1, { estado: 'processando', enviadoHaMs: IDADE_DO_MATERIAL_PARADO_MS + 5_000 })
      const [recente] = await materiaisJaEnviados(bancada, escola.coordenacao, escola.quimica, 1, { estado: 'processando', enviadoHaMs: IDADE_DO_MATERIAL_PARADO_MS - 30_000 })

      expect(await api.app.get(MaterialService).varrerParados()).toBeGreaterThanOrEqual(1)

      const estados = new Map((await materiaisDa(bancada, escola.coordenacao.escolaId)).map((linha) => [linha.id, { estado: linha.estado, falha: linha.falha }]))
      expect(estados.get(parado ?? '')).toEqual({ estado: 'falhou', falha: 'extracao_falhou' })
      expect(estados.get(recente ?? '')).toEqual({ estado: 'processando', falha: null })
      expect((await get(escola.coordenacao, `/v1/materiais/${parado ?? ''}`)).corpo).toMatchObject({ estado: 'falhou', falha: 'extracao_falhou' })
    })

    it('a subida do processo já varre: a API que sobe encontra o material parado e o encerra', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const [parado] = await materiaisJaEnviados(bancada, escola.coordenacao, escola.quimica, 1, { estado: 'processando', enviadoHaMs: IDADE_DO_MATERIAL_PARADO_MS + 5_000 })
      const outra = await subirApi(new MedidorDeTeste().medidor)
      try {
        expect((await materiaisDa(bancada, escola.coordenacao.escolaId)).find((linha) => linha.id === parado)).toMatchObject({ estado: 'falhou', falha: 'extracao_falhou' })
      } finally {
        await outra.app.close()
      }
    })

    it('o desligamento da instância que estava lendo grava a falha na hora, sem esperar a varredura', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const outra = await subirApi(new MedidorDeTeste().medidor)
      // Uma leitura que só termina quando o prazo, ou o desligamento, a aborta; aí devolve uma falha que só ela devolve.
      vi.spyOn(outra.app.get(PdfExtractor), 'extrair').mockImplementation(
        (_bytes, sinal) => new Promise<ResultadoDaExtracao>((resolver) => sinal?.addEventListener('abort', () => resolver({ falha: 'sem_texto' }), { once: true })),
      )
      const emLeitura = await enviarMaterial(outra, escola.coordenacao, { disciplinaId: escola.quimica })
      const naFila = await enviarMaterial(outra, escola.coordenacao, { disciplinaId: escola.quimica }, { arquivo: variacaoDoPdf() })
      expect([emLeitura.status, naFila.status]).toEqual([201, 201])
      await new Promise((resolver) => setTimeout(resolver, 50))

      await outra.app.close()

      // O que estava sendo lido recebeu o sinal (a falha é a que a leitura abortada devolveu aqui); o que esperava a
      // vez nem chegou a ser lido.
      expect((await materiaisDa(bancada, escola.coordenacao.escolaId)).map(({ id, estado, falha }) => ({ id, estado, falha }))).toEqual([
        { id: emLeitura.corpo['id'], estado: 'falhou', falha: 'sem_texto' },
        { id: naFila.corpo['id'], estado: 'falhou', falha: 'extracao_falhou' },
      ])
      expect(await trechosDa(bancada, escola.coordenacao.escolaId)).toEqual([])
    })
  })

  describe('log (regra 20, item 9)', () => {
    it('nenhuma linha leva título, licenciante, nome de arquivo, texto da busca nem texto de trecho; leva id, tamanho, páginas e código', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const TITULO = `Sentinela-título-${randomUUID().slice(0, 8)}`
      const LICENCIANTE = `Sentinela-licenciante-${randomUUID().slice(0, 8)}`
      const ARQUIVO = `sentinela-arquivo-${randomUUID().slice(0, 8)}.pdf`
      const campos = { titulo: TITULO, disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licenciante: LICENCIANTE, licenca: 'licenca_comercial_autorizada' }
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
