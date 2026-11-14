import { runInContext, type Database } from '@educa/core'
import { ErrorCode, buscaDeMaterialResponseSchema, listaDeMateriaisResponseSchema, materialResponseSchema } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { DB } from '../src/database.module.js'
import { MaterialRepository } from '../src/material/material.repository.js'
import { TrechoSearch } from '../src/material/trecho-search.js'
import { ATUALIZACOES_POR_ESCOLA_NA_JANELA, ATUALIZACOES_POR_USUARIO_NA_JANELA, ENVIOS_POR_USUARIO_NA_JANELA, JANELA_DAS_ATUALIZACOES_MS } from '../src/material/material.service.js'
import { chamar, subirApi, type TestApi, type RespostaHttp } from './test-api.js'
import { montarEscolaComTurma as montarEscola, type EscolaComTurma } from './escola-turma.fixture.js'
import { apagarMateriais, auditoriaDa, enviarEdicaoDeMaterial, enviarMaterial, esperarExtracao, materiaisJaEnviados, pdfCorrompido, variacaoDoPdf } from './material.fixture.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { TEST_APP_OPTIONS } from './test-config.js'
import { esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'

/**
 * `PATCH /v1/materiais/:id` (ingestao-do-material, tarefa 12.0; Tech Spec, seções 4, 5 e 7c; PRD, RF6; `cenarios.md`, "Envio, séries e licença no envio", "Corridas", "Permissão…" e "Isolamento"): a coordenação corrige
 * o título e as séries de um material. A busca e a lista por série acompanham na hora; o `PATCH` espera a edição que está sendo gravada e recusa a que está em andamento; o teto é de 100 por hora por pessoa e 300 por
 * escola, à parte dos envios. As corridas ficam presas no banco (gatilho de teste) e a ordem delas é a que o teste força.
 */
describe('PATCH do material da escola', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: TestApi
  const escolasDoTeste: string[] = []

  async function montarEscolaComTurma(): Promise<EscolaComTurma> {
    const escola = await montarEscola(api, bancada)
    escolasDoTeste.push(escola.coordenacao.escolaId)
    return escola
  }

  const get = (sessao: TestSessao, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, sessao.token)
  const post = (sessao: TestSessao, caminho: string, corpo?: unknown): Promise<RespostaHttp> => chamar(api.url, 'POST', caminho, sessao.token, corpo)
  const del = (sessao: TestSessao, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'DELETE', caminho, sessao.token)
  const erroDe = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })

  /** `PATCH` como a tela o manda (JSON), com o `Retry-After` que o 429 traz. */
  async function patchar(sessao: Pick<TestSessao, 'token'>, id: string, corpo: unknown): Promise<RespostaHttp & { retryAfter: string | null }> {
    const resposta = await fetch(`${api.url}/v1/materiais/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${sessao.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    const texto = await resposta.text()
    return { status: resposta.status, corpo: texto === '' ? {} : (JSON.parse(texto) as RespostaHttp['corpo']), setCookie: resposta.headers.getSetCookie(), retryAfter: resposta.headers.get('Retry-After') }
  }

  /** Uma série a mais na escola. */
  async function novaSerie(escola: EscolaComTurma, ano: 1 | 3): Promise<string> {
    const criada = await post(escola.coordenacao, '/v1/series', { etapa: 'em', ano })
    expect(criada.status).toBe(201)
    return criada.corpo['id'] as string
  }

  /** O material `pronto`, enviado e extraído, com as séries dadas (por padrão, a da escola). */
  async function materialPronto(escola: EscolaComTurma, serieIds: readonly string[] = [escola.serieId]): Promise<string> {
    const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds }, { arquivo: variacaoDoPdf() })
    expect(enviado.status).toBe(201)
    await esperarExtracao(api)
    return enviado.corpo['id'] as string
  }

  /** Os ids que a lista da coordenação devolve para a série. */
  async function idsDaLista(sessao: TestSessao, serieId: string): Promise<string[]> {
    const resposta = await get(sessao, `/v1/materiais?serieId=${serieId}`)
    expect(resposta.status).toBe(200)
    return listaDeMateriaisResponseSchema.parse(resposta.corpo).itens.map((item) => item.id)
  }

  /** Os materiais que a busca acha para a série, pelo texto do PDF de demonstração. */
  async function idsDaBusca(sessao: TestSessao, serieId: string): Promise<string[]> {
    const resposta = await get(sessao, `/v1/materiais/busca?q=${encodeURIComponent('reagente limitante')}&serieId=${serieId}`)
    expect(resposta.status).toBe(200)
    return [...new Set(buscaDeMaterialResponseSchema.parse(resposta.corpo).itens.map((item) => item.materialId))]
  }

  /** Os materiais que a porta de leitura do Assistente e do Tutor (`TrechoSearch`) acha para a série da turma: é por ela que os dois agentes leem o PDF. */
  async function idsDaPortaDeLeitura(escola: EscolaComTurma, serieId: string): Promise<string[]> {
    const trechos = await runInContext({ requisicaoId: randomUUID(), escolaId: escola.coordenacao.escolaId }, () =>
      api.app.get(TrechoSearch).buscar({ texto: 'reagente limitante', disciplinaId: escola.quimica, serieId, limite: 20 }),
    )
    return [...new Set(trechos.map((trecho) => trecho.materialId))]
  }

  const seriesDe = async (escolaId: string, materialId: string): Promise<string[]> => {
    const { rows } = await bancada.pool.query<{ serie_id: string }>('select serie_id from material_serie where escola_id = $1 and material_id = $2 order by serie_id', [escolaId, materialId])
    return rows.map((linha) => linha.serie_id)
  }
  const tituloDe = async (escolaId: string, materialId: string): Promise<string | undefined> => {
    const { rows } = await bancada.pool.query<{ titulo: string }>('select titulo from material where escola_id = $1 and id = $2', [escolaId, materialId])
    return rows[0]?.titulo
  }

  /** Grava, direto na auditoria, `quantidade` registros da `acao` feitos por `sessao` (há `haMs` milissegundos): o que dezenas de `PATCH` deixariam, sem fazê-los. */
  async function registrosJaFeitos(sessao: Pick<TestSessao, 'escolaId' | 'usuarioId'>, quantidade: number, { acao = 'material.atualizado', haMs = 0 }: { acao?: string; haMs?: number } = {}): Promise<void> {
    await bancada.pool.query(
      `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id, em)
       select $1, $2, $3, 'material', gen_random_uuid(), gen_random_uuid(), now() - ($5::int * interval '1 millisecond') from generate_series(1, $4::int)`,
      [sessao.escolaId, sessao.usuarioId, acao, quantidade, haMs],
    )
  }

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog, TEST_APP_OPTIONS)
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

  describe('o que o PATCH muda', () => {
    it('título e séries: a resposta traz o material alterado, a lista e a busca da série tirada deixam de achá-lo, as da série nova passam a achar, e a auditoria leva as séries de antes e de depois, sem o título', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const terceiroAno = await novaSerie(escola, 3)
      const id = await materialPronto(escola)
      expect(await idsDaLista(escola.coordenacao, escola.serieId)).toEqual([id])
      expect(await idsDaBusca(escola.coordenacao, escola.serieId)).toEqual([id])
      expect(await idsDaPortaDeLeitura(escola, escola.serieId)).toEqual([id])

      const resposta = await patchar(escola.coordenacao, id, { titulo: '  Química 2, edição revisada  ', serieIds: [terceiroAno] })
      expect(resposta.status).toBe(200)
      expect(materialResponseSchema.parse(resposta.corpo)).toMatchObject({ id, titulo: 'Química 2, edição revisada', serieIds: [terceiroAno], estado: 'pronto' })

      expect(await seriesDe(escolaId, id)).toEqual([terceiroAno])
      expect(await tituloDe(escolaId, id)).toBe('Química 2, edição revisada')
      // A lista por série e a busca da turma da série tirada deixam de achar o material; a da série nova o acha.
      expect(await idsDaLista(escola.coordenacao, escola.serieId)).toEqual([])
      expect(await idsDaBusca(escola.coordenacao, escola.serieId)).toEqual([])
      expect(await idsDaLista(escola.coordenacao, terceiroAno)).toEqual([id])
      expect(await idsDaBusca(escola.coordenacao, terceiroAno)).toEqual([id])
      // O Assistente e o Tutor leem pela mesma porta: a turma da série tirada deixa de ler o material, a da série nova passa a lê-lo.
      expect(await idsDaPortaDeLeitura(escola, escola.serieId)).toEqual([])
      expect(await idsDaPortaDeLeitura(escola, terceiroAno)).toEqual([id])

      const registros = await auditoriaDa(bancada, escolaId, 'material.atualizado')
      expect(registros).toEqual([
        {
          entidade: 'material',
          entidade_id: id,
          autor_usuario_id: escola.coordenacao.usuarioId,
          antes: { serieIds: [escola.serieId] },
          depois: { serieIds: [terceiroAno], tituloAlterado: true },
        },
      ])
      expect(JSON.stringify(registros)).not.toContain('Química 2, edição revisada')
    })

    it('só o título: as séries seguem, a auditoria diz que o título mudou e leva as mesmas séries nos dois lados', async () => {
      const escola = await montarEscolaComTurma()
      const id = await materialPronto(escola)

      const resposta = await patchar(escola.coordenacao, id, { titulo: 'Só o título' })
      expect(resposta.status).toBe(200)
      expect(resposta.corpo['serieIds']).toEqual([escola.serieId])
      expect(await seriesDe(escola.coordenacao.escolaId, id)).toEqual([escola.serieId])
      expect(await tituloDe(escola.coordenacao.escolaId, id)).toBe('Só o título')
      expect((await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.atualizado'))[0]).toMatchObject({ antes: { serieIds: [escola.serieId] }, depois: { serieIds: [escola.serieId], tituloAlterado: true } })
      expect(await idsDaBusca(escola.coordenacao, escola.serieId)).toEqual([id])
    })

    it('só as séries, em qualquer ordem: o título segue, as séries saem em ordem de id, e a auditoria diz que o título não mudou', async () => {
      const escola = await montarEscolaComTurma()
      const primeiroAno = await novaSerie(escola, 1)
      const terceiroAno = await novaSerie(escola, 3)
      const id = await materialPronto(escola)
      const tituloAntes = await tituloDe(escola.coordenacao.escolaId, id)

      const resposta = await patchar(escola.coordenacao, id, { serieIds: [terceiroAno, escola.serieId, primeiroAno] })
      expect(resposta.status).toBe(200)
      const esperadas = [primeiroAno, escola.serieId, terceiroAno].toSorted()
      expect(resposta.corpo['serieIds']).toEqual(esperadas)
      expect(await seriesDe(escola.coordenacao.escolaId, id)).toEqual(esperadas)
      expect(await tituloDe(escola.coordenacao.escolaId, id)).toBe(tituloAntes)
      expect((await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.atualizado'))[0]).toMatchObject({
        antes: { serieIds: [escola.serieId] },
        depois: { serieIds: esperadas, tituloAlterado: false },
      })
    })

    it('o PATCH só toca no material pedido: o título e as séries dos outros da mesma escola seguem como estavam', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const terceiroAno = await novaSerie(escola, 3)
      const alterado = await materialPronto(escola)
      const vizinho = await materialPronto(escola, [escola.serieId, terceiroAno])
      const tituloDoVizinho = await tituloDe(escolaId, vizinho)

      expect((await patchar(escola.coordenacao, alterado, { titulo: 'Só este', serieIds: [terceiroAno] })).status).toBe(200)
      expect(await tituloDe(escolaId, alterado)).toBe('Só este')
      expect(await seriesDe(escolaId, alterado)).toEqual([terceiroAno])
      expect(await tituloDe(escolaId, vizinho)).toBe(tituloDoVizinho)
      expect(await seriesDe(escolaId, vizinho)).toEqual([escola.serieId, terceiroAno].toSorted())
    })

    it('escola sem ano letivo em curso: o PATCH funciona', async () => {
      const coordenacao = await bancada.escolaComSessao('coordenador')
      escolasDoTeste.push(coordenacao.escolaId)
      const serie = (await post(coordenacao, '/v1/series', { etapa: 'em', ano: 2 })).corpo['id'] as string
      const outra = (await post(coordenacao, '/v1/series', { etapa: 'em', ano: 3 })).corpo['id'] as string
      const disciplina = (await post(coordenacao, '/v1/disciplinas', { nome: 'Química' })).corpo['id'] as string
      const enviado = await enviarMaterial(api, coordenacao, { disciplinaId: disciplina, serieIds: [serie] })
      expect(enviado.status).toBe(201)
      await esperarExtracao(api)

      const resposta = await patchar(coordenacao, enviado.corpo['id'] as string, { serieIds: [outra] })
      expect(resposta.status).toBe(200)
      expect(resposta.corpo['serieIds']).toEqual([outra])
    })
  })

  describe('o pedido inválido', () => {
    it.each([
      ['sem série (`[]`)', { serieIds: [] }],
      ['com série repetida', (serie: string) => ({ serieIds: [serie, serie] })],
      ['sem nada a alterar (`{}`)', {}],
      ['com título vazio', { titulo: '   ' }],
      ['com campo que o contrato não tem (a disciplina)', { titulo: 'Outro', disciplinaId: randomUUID() }],
    ] as const)('%s: `ENTRADA_INVALIDA`, e o material não muda', async (_nome, pedido) => {
      const escola = await montarEscolaComTurma()
      const id = await materialPronto(escola)
      const corpo = typeof pedido === 'function' ? pedido(escola.serieId) : pedido

      expect(erroDe(await patchar(escola.coordenacao, id, corpo))).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(await seriesDe(escola.coordenacao.escolaId, id)).toEqual([escola.serieId])
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.atualizado')).toEqual([])
    })
  })

  describe('isolamento entre escolas (regra 10)', () => {
    it('`serieIds` da escola B: `NAO_ENCONTRADO`, igual à série que não existe; as séries do material não mudam e a auditoria não leva o id da B', async () => {
      const a = await montarEscolaComTurma()
      const b = await montarEscolaComTurma()
      const id = await materialPronto(a)

      const daB = await patchar(a.coordenacao, id, { serieIds: [b.serieId] })
      const inexistente = await patchar(a.coordenacao, id, { serieIds: [randomUUID()] })
      expect(erroDe(daB)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect({ ...daB.corpo.erro, requisicaoId: undefined }).toEqual({ ...inexistente.corpo.erro, requisicaoId: undefined })
      // Uma série da A junto com a da B também é recusada inteira: nada é gravado pela metade.
      expect(erroDe(await patchar(a.coordenacao, id, { serieIds: [a.serieId, b.serieId] }))).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(await seriesDe(a.coordenacao.escolaId, id)).toEqual([a.serieId])
      expect(await auditoriaDa(bancada, a.coordenacao.escolaId, 'material.atualizado')).toEqual([])
    })

    describe('o material da escola B, lido pela escola A', () => {
      async function alvoDaB(caso: 'pronto' | 'edicao_em_andamento' | 'a_propria_edicao'): Promise<{ a: EscolaComTurma; b: EscolaComTurma; alvo: string; titulo: string | undefined }> {
        const a = await montarEscolaComTurma()
        const b = await montarEscolaComTurma()
        const pronto = await materialPronto(b)
        if (caso === 'pronto') return { a, b, alvo: pronto, titulo: await tituloDe(b.coordenacao.escolaId, pronto) }
        // O que seria `EDICAO_EM_ANDAMENTO` na escola dona: a B tem uma edição `processando` sobre o material, e o `PATCH` da A tenta o material ou a própria edição.
        const edicao = await enviarEdicaoDeMaterial(api, b.coordenacao, pronto, { edicao: '2ª' })
        expect(edicao.status).toBe(201)
        const alvo = caso === 'edicao_em_andamento' ? pronto : (edicao.corpo['id'] as string)
        return { a, b, alvo, titulo: await tituloDe(b.coordenacao.escolaId, alvo) }
      }

      it.each(['pronto', 'edicao_em_andamento', 'a_propria_edicao'] as const)('%s: `NAO_ENCONTRADO` igual ao inexistente, antes de `EDICAO_EM_ANDAMENTO` (R6), e nada muda na B', async (caso) => {
        const { a, b, alvo, titulo } = await alvoDaB(caso)
        const seriesAntes = await seriesDe(b.coordenacao.escolaId, alvo)

        const resposta = await patchar(a.coordenacao, alvo, { titulo: 'Título da A', serieIds: [a.serieId] })
        const inexistente = await patchar(a.coordenacao, randomUUID(), { titulo: 'Título da A', serieIds: [a.serieId] })
        expect(erroDe(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
        expect({ ...resposta.corpo.erro, requisicaoId: undefined }).toEqual({ ...inexistente.corpo.erro, requisicaoId: undefined })
        expect(await tituloDe(b.coordenacao.escolaId, alvo)).toBe(titulo)
        expect(await seriesDe(b.coordenacao.escolaId, alvo)).toEqual(seriesAntes)
        expect(await seriesDe(a.coordenacao.escolaId, alvo)).toEqual([])
        expect(await auditoriaDa(bancada, a.coordenacao.escolaId, 'material.atualizado')).toEqual([])
        expect(await auditoriaDa(bancada, b.coordenacao.escolaId, 'material.atualizado')).toEqual([])
        await esperarExtracao(api)
      })

      it('o repository, no contexto da escola A, não trava, não renomeia nem troca as séries do material da B: a cláusula de escopo é a que responde', async () => {
        const { a, b, alvo, titulo } = await alvoDaB('pronto')
        const banco = api.app.get<Database>(DB)
        const naEscolaA = <T>(funcao: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), escolaId: a.coordenacao.escolaId }, funcao)
        const naEscolaB = <T>(funcao: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), escolaId: b.coordenacao.escolaId }, funcao)

        expect(await naEscolaA(() => banco.transaction((tx) => new MaterialRepository(tx).travarParaAtualizar(alvo)))).toBeUndefined()
        await naEscolaA(() => new MaterialRepository(banco).renomear(alvo, 'Título trocado pela A'))
        expect(await tituloDe(b.coordenacao.escolaId, alvo)).toBe(titulo)
        // O `delete` das séries sai antes do `insert`, que a própria FK da escola recusa: sem autocommit nem transação aqui, o que o `delete` apagasse da B ficaria apagado.
        await expect(naEscolaA(() => new MaterialRepository(banco).substituirSeries(alvo, [a.serieId]))).rejects.toThrow()
        expect(await seriesDe(b.coordenacao.escolaId, alvo)).toEqual([b.serieId])
        // Na escola dona, as mesmas chamadas valem.
        expect(await naEscolaB(() => banco.transaction((tx) => new MaterialRepository(tx).travarParaAtualizar(alvo)))).toMatchObject({ id: alvo, estado: 'pronto', substitui: null })
        await naEscolaB(() => new MaterialRepository(banco).renomear(alvo, 'Título trocado pela B'))
        expect(await tituloDe(b.coordenacao.escolaId, alvo)).toBe('Título trocado pela B')
      })
    })

    it('o material excluído e o substituído: `NAO_ENCONTRADO`, e nada muda neles', async () => {
      const escola = await montarEscolaComTurma()
      const excluido = await materialPronto(escola)
      expect((await del(escola.coordenacao, `/v1/materiais/${excluido}`)).status).toBe(204)
      const substituido = await materialPronto(escola)
      expect((await enviarEdicaoDeMaterial(api, escola.coordenacao, substituido, { edicao: '2ª' })).status).toBe(201)
      await esperarExtracao(api)

      for (const id of [excluido, substituido]) {
        expect(erroDe(await patchar(escola.coordenacao, id, { titulo: 'Depois de sair', serieIds: [escola.serieId] })), id).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
        expect(await tituloDe(escola.coordenacao.escolaId, id)).not.toBe('Depois de sair')
      }
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.atualizado')).toEqual([])
    })
  })

  describe('a edição em andamento', () => {
    it('o material com edição `processando` e a própria edição `processando`: `EDICAO_EM_ANDAMENTO`, e as séries não mudam', async () => {
      const escola = await montarEscolaComTurma()
      const terceiroAno = await novaSerie(escola, 3)
      const alvo = await materialPronto(escola)
      const edicao = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: '2ª' })
      expect(edicao.status).toBe(201)

      for (const id of [alvo, edicao.corpo['id'] as string]) {
        expect(erroDe(await patchar(escola.coordenacao, id, { serieIds: [terceiroAno] })), id).toEqual({ status: 409, codigo: ErrorCode.EDICAO_EM_ANDAMENTO })
        expect(await seriesDe(escola.coordenacao.escolaId, id), id).toEqual([escola.serieId])
      }
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.atualizado')).toEqual([])
      await esperarExtracao(api)
    })

    it('o material do envio inicial ainda `processando` não é edição: o PATCH vale', async () => {
      const escola = await montarEscolaComTurma()
      const terceiroAno = await novaSerie(escola, 3)
      const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: [escola.serieId] }, { arquivo: variacaoDoPdf() })
      expect(enviado.status).toBe(201)
      const id = enviado.corpo['id'] as string

      const resposta = await patchar(escola.coordenacao, id, { serieIds: [terceiroAno] })
      expect(resposta.status).toBe(200)
      expect(await seriesDe(escola.coordenacao.escolaId, id)).toEqual([terceiroAno])
      await esperarExtracao(api)
    })

    it('a edição que falhou na leitura não está em andamento: o PATCH vale, e a anterior, que seguiu pronta, também', async () => {
      const escola = await montarEscolaComTurma()
      const terceiroAno = await novaSerie(escola, 3)
      const alvo = await materialPronto(escola)
      const edicao = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: '2ª' }, pdfCorrompido())
      expect(edicao.status).toBe(201)
      await esperarExtracao(api)
      const { rows } = await bancada.pool.query<{ estado: string }>('select estado from material where id = $1', [edicao.corpo['id']])
      expect(rows[0]?.estado).toBe('falhou')

      expect((await patchar(escola.coordenacao, edicao.corpo['id'] as string, { serieIds: [terceiroAno] })).status).toBe(200)
      expect((await patchar(escola.coordenacao, alvo, { serieIds: [terceiroAno] })).status).toBe(200)
    })

    it('a sequência: edição B enviada sobre A, o PATCH em A recusado, B pronta com as séries de A, e o PATCH em B depois vale', async () => {
      const escola = await montarEscolaComTurma()
      const terceiroAno = await novaSerie(escola, 3)
      const a = await materialPronto(escola)
      const edicao = await enviarEdicaoDeMaterial(api, escola.coordenacao, a, { edicao: '2ª' })
      expect(edicao.status).toBe(201)
      const b = edicao.corpo['id'] as string

      expect(erroDe(await patchar(escola.coordenacao, a, { serieIds: [terceiroAno] }))).toEqual({ status: 409, codigo: ErrorCode.EDICAO_EM_ANDAMENTO })
      await esperarExtracao(api)
      expect(await seriesDe(escola.coordenacao.escolaId, b)).toEqual([escola.serieId])
      // A foi substituída: já não se altera. A B, pronta, sim.
      expect(erroDe(await patchar(escola.coordenacao, a, { serieIds: [terceiroAno] }))).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      const resposta = await patchar(escola.coordenacao, b, { serieIds: [terceiroAno] })
      expect(resposta.status).toBe(200)
      expect(await seriesDe(escola.coordenacao.escolaId, b)).toEqual([terceiroAno])
      expect(await idsDaBusca(escola.coordenacao, terceiroAno)).toEqual([b])
    })
  })

  describe('corridas', () => {
    it('[P] dois PATCH do mesmo material, o primeiro preso depois de gravar as séries: o segundo espera a linha, os dois dão 200, e termina com as séries do último, sem 500', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const primeiroAno = await novaSerie(escola, 1)
      const terceiroAno = await novaSerie(escola, 3)
      const id = await materialPronto(escola)
      const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'material_serie', evento: 'insert', quando: `new.escola_id = '${escolaId}' and new.serie_id = '${primeiroAno}'` })
      await gatilho.armar()
      let primeiro: RespostaHttp
      let segundo: RespostaHttp
      try {
        const doPrimeiro = patchar(escola.coordenacao, id, { serieIds: [primeiroAno] })
        await gatilho.esperarParadas()
        const doSegundo = patchar(escola.coordenacao, id, { serieIds: [terceiroAno] })
        // O segundo está parado na linha que o primeiro segura (`for update`), e não passou por ela.
        await esperarNaTrava(bancada.pool, '%from "material"%for update%')
        await gatilho.soltar()
        ;[primeiro, segundo] = await Promise.all([doPrimeiro, doSegundo])
      } finally {
        await gatilho.desarmar()
      }

      expect([primeiro.status, segundo.status]).toEqual([200, 200])
      expect(await seriesDe(escolaId, id)).toEqual([terceiroAno])
      // Cada registro leva o "antes" que de fato encontrou: o do segundo é o que o primeiro gravou.
      expect((await auditoriaDa(bancada, escolaId, 'material.atualizado')).map((registro) => registro.antes)).toEqual([{ serieIds: [escola.serieId] }, { serieIds: [primeiroAno] }])
    })

    it('[P] a edição parada depois de guardar o arquivo e o PATCH em A confirmado nesse meio: a edição nasce com as séries do PATCH', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const terceiroAno = await novaSerie(escola, 3)
      const alvo = await materialPronto(escola)

      const armazem = api.armazem
      if (armazem === undefined) throw new Error('a API do teste não tem o armazém')
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
      // A edição ainda não abriu a transação: o PATCH confirma sem esperá-la.
      expect((await patchar(escola.coordenacao, alvo, { serieIds: [terceiroAno] })).status).toBe(200)
      seguir()
      const resposta = await envio
      vi.restoreAllMocks()

      expect(resposta.status).toBe(201)
      expect(resposta.corpo['serieIds']).toEqual([terceiroAno])
      expect(await seriesDe(escolaId, resposta.corpo['id'] as string)).toEqual([terceiroAno])
      await esperarExtracao(api)
    })

    it('[P] a edição com a transação aberta sobre A e o PATCH em A: o PATCH espera a linha e, quando a edição confirma, recebe `EDICAO_EM_ANDAMENTO`; as séries não mudam', async () => {
      const escola = await montarEscolaComTurma()
      const escolaId = escola.coordenacao.escolaId
      const terceiroAno = await novaSerie(escola, 3)
      const alvo = await materialPronto(escola)
      const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'material', evento: 'insert', quando: `new.escola_id = '${escolaId}' and new.substitui_id is not null` })
      await gatilho.armar()
      let edicao: RespostaHttp
      let alteracao: RespostaHttp
      try {
        const envioDaEdicao = enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: '2ª' })
        await gatilho.esperarParadas()
        const patch = patchar(escola.coordenacao, alvo, { serieIds: [terceiroAno] })
        // A edição segura a linha do alvo (`for update`) desde antes do `insert`: o PATCH para nela, e não a atravessa.
        await esperarNaTrava(bancada.pool, '%from "material"%for update%')
        await gatilho.soltar()
        ;[edicao, alteracao] = await Promise.all([envioDaEdicao, patch])
      } finally {
        await gatilho.desarmar()
      }

      expect(edicao.status).toBe(201)
      expect(erroDe(alteracao)).toEqual({ status: 409, codigo: ErrorCode.EDICAO_EM_ANDAMENTO })
      expect(await seriesDe(escolaId, alvo)).toEqual([escola.serieId])
      expect(await auditoriaDa(bancada, escolaId, 'material.atualizado')).toEqual([])
      await esperarExtracao(api)
    })
  })

  describe('permissão: só a coordenação', () => {
    it.each(['professor', 'aluno'] as const)('%s: `NAO_ENCONTRADO` igual ao inexistente, mesmo com um pedido válido, e o material não muda', async (papel) => {
      const escola = await montarEscolaComTurma()
      const id = await materialPronto(escola)
      const pessoa = await bancada.sessao(escola.coordenacao.escolaId, papel)
      const tituloAntes = await tituloDe(escola.coordenacao.escolaId, id)

      const resposta = await patchar(pessoa, id, { titulo: 'Quem não pode', serieIds: [escola.serieId] })
      const inexistente = await patchar(pessoa, randomUUID(), { titulo: 'Quem não pode', serieIds: [escola.serieId] })
      expect(erroDe(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect({ ...resposta.corpo.erro, requisicaoId: undefined }).toEqual({ ...inexistente.corpo.erro, requisicaoId: undefined })
      expect(await tituloDe(escola.coordenacao.escolaId, id)).toBe(tituloAntes)
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.atualizado')).toEqual([])
    })
  })

  describe('o teto do PATCH, por pessoa e por escola, à parte dos envios (regra 80, itens 1 e 3)', () => {
    it('a pessoa no teto recebe 429 com `Retry-After`; outra da mesma escola ainda altera; o registro antigo, o de outra ação e o de outra escola não contam; e o envio segue livre', async () => {
      const escola = await montarEscolaComTurma()
      const outraEscola = await montarEscolaComTurma()
      const id = await materialPronto(escola)
      const outraPessoa = await bancada.sessao(escola.coordenacao.escolaId, 'coordenador')

      // O que não conta para esta pessoa nesta escola e nesta janela: o de duas horas atrás, o de outra ação e tudo o que a escola B fez (300, o teto dela).
      await registrosJaFeitos(escola.coordenacao, 150, { haMs: JANELA_DAS_ATUALIZACOES_MS + 60_000 })
      await registrosJaFeitos(escola.coordenacao, 150, { acao: 'material.excluido' })
      await registrosJaFeitos(outraEscola.coordenacao, ATUALIZACOES_POR_ESCOLA_NA_JANELA)
      await registrosJaFeitos(escola.coordenacao, ATUALIZACOES_POR_USUARIO_NA_JANELA - 1)
      const ultima = await patchar(escola.coordenacao, id, { titulo: 'A centésima' })
      expect(ultima.status).toBe(200)

      const acima = await patchar(escola.coordenacao, id, { titulo: 'A 101ª' })
      expect(erroDe(acima)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
      expect(acima.retryAfter).toBe(String(JANELA_DAS_ATUALIZACOES_MS / 1_000))
      expect(await tituloDe(escola.coordenacao.escolaId, id)).toBe('A centésima')

      // O teto é da pessoa: a segunda coordenadora, da mesma escola, altera.
      expect((await patchar(outraPessoa, id, { titulo: 'Da outra pessoa' })).status).toBe(200)
      // À parte dos envios: quem está no teto do PATCH ainda envia, e quem está no teto de envios ainda altera.
      expect((await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: [escola.serieId] }, { arquivo: variacaoDoPdf() })).status).toBe(201)
      await esperarExtracao(api)
      await materiaisJaEnviados(bancada, outraPessoa, escola.quimica, ENVIOS_POR_USUARIO_NA_JANELA)
      expect(erroDe(await enviarMaterial(api, outraPessoa, { disciplinaId: escola.quimica, serieIds: [escola.serieId] }, { arquivo: variacaoDoPdf() }))).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
      expect((await patchar(outraPessoa, id, { titulo: 'Com o envio no teto' })).status).toBe(200)
    })

    it('a escola no teto segura quem ainda não passou do próprio, e só a escola dela', async () => {
      const escola = await montarEscolaComTurma()
      const outraEscola = await montarEscolaComTurma()
      const id = await materialPronto(escola)
      const outrasPessoas = await Promise.all([1, 2, 3].map(() => bancada.sessao(escola.coordenacao.escolaId, 'coordenador')))

      // Três pessoas com 99 alterações cada (uma a menos que o teto de cada uma): a escola está em 297.
      for (const pessoa of outrasPessoas) await registrosJaFeitos(pessoa, ATUALIZACOES_POR_USUARIO_NA_JANELA - 1)
      // A quarta pessoa leva a escola a 300 em três alterações, todas aceitas (a escola só segura quando já está no teto)...
      for (const titulo of ['Primeira', 'Segunda', 'Terceira']) expect((await patchar(escola.coordenacao, id, { titulo })).status, titulo).toBe(200)
      // ...e a quarta é segurada pela escola, com três alterações só: o teto dela não foi o da pessoa.
      const daEscola = await patchar(escola.coordenacao, id, { titulo: 'A 301ª' })
      expect(erroDe(daEscola)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
      expect(daEscola.retryAfter).toBe(String(JANELA_DAS_ATUALIZACOES_MS / 1_000))
      expect(await tituloDe(escola.coordenacao.escolaId, id)).toBe('Terceira')
      // As outras pessoas, que estavam a uma alteração do próprio teto, também são seguradas pela escola.
      expect(erroDe(await patchar(outrasPessoas[0] ?? escola.coordenacao, id, { titulo: 'Da outra' }))).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
      // Uma escola não degrada outra.
      const doutroMaterial = await materialPronto(outraEscola)
      expect((await patchar(outraEscola.coordenacao, doutroMaterial, { titulo: 'Na escola B' })).status).toBe(200)
    })

    it('o 429 é antes de tudo: o pedido inválido e o material que não existe também o recebem, e o log do teto leva só o tipo', async () => {
      const escola = await montarEscolaComTurma()
      await registrosJaFeitos(escola.coordenacao, ATUALIZACOES_POR_USUARIO_NA_JANELA)

      expect(erroDe(await patchar(escola.coordenacao, randomUUID(), {}))).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
      const linhas = linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>).filter((linha) => linha['evento'] === 'material.teto_de_atualizacoes')
      expect(linhas.at(-1)).toMatchObject({ tipo: 'usuario' })
      expect(Object.keys(linhas.at(-1) ?? {}).filter((chave) => ['titulo', 'materialId', 'serieIds'].includes(chave))).toEqual([])
    })
  })

  describe('o que vai para o log', () => {
    it('`material.atualizado` leva só o id do material: nem o título, nem as séries', async () => {
      const escola = await montarEscolaComTurma()
      const id = await materialPronto(escola)
      const terceiroAno = await novaSerie(escola, 3)
      const antes = linhasDeLog.length

      expect((await patchar(escola.coordenacao, id, { titulo: 'Título Sentinela do PATCH', serieIds: [terceiroAno] })).status).toBe(200)
      const novas = linhasDeLog.slice(antes)
      expect(novas.map((linha) => JSON.parse(linha) as Record<string, unknown>).find((linha) => linha['evento'] === 'material.atualizado')).toMatchObject({ materialId: id, escolaId: escola.coordenacao.escolaId })
      const todoOLog = novas.join('\n')
      for (const sentinela of ['Sentinela', 'Título Sentinela do PATCH', terceiroAno]) expect(todoOLog, sentinela).not.toContain(sentinela)
    })
  })
})
