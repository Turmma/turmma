import { runInContext } from '@educa/core'
import { ErrorCode, buscaDeMaterialResponseSchema, listaDeMateriaisResponseSchema } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { BuscaDeTrechos } from '../src/material/trecho-search.js'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from './test-api.js'
import { montarEscolaComTurma as montarEscola, type EscolaComTurma } from './escola-turma.fixture.js'
import { apagarMateriais, auditoriaDa, enviarMaterial, esperarExtracao, materiaisDa, trechosDa } from './material.fixture.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao.fixture.js'

/**
 * Isolamento do material entre escolas (regra 10, itens 3 a 6; regra 60, item 10): a escola A não lista, não lê, não
 * busca e não exclui nada da escola B, e a resposta é a mesma do inexistente. As duas escolas têm **o mesmo PDF**, com
 * as mesmas palavras: cada caso tem linhas de B que a consulta alcançaria se a cláusula de escola saísse do repository.
 */
describe('material: isolamento entre escolas', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  let api: ApiDeTeste
  /** As escolas que o teste montou: o material delas sai antes de a bancada apagar as disciplinas. */
  const escolasDoTeste: string[] = []

  async function montarEscolaComTurma(daApi: ApiDeTeste, daBancada: BancadaDeSessoes): Promise<EscolaComTurma> {
    const escola = await montarEscola(daApi, daBancada)
    escolasDoTeste.push(escola.coordenacao.escolaId)
    return escola
  }

  interface EscolaComMaterial extends EscolaComTurma {
    readonly materialId: string
    readonly professor: SessaoDeTeste
  }

  let a: EscolaComMaterial
  let b: EscolaComMaterial

  const get = (sessao: SessaoDeTeste, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, sessao.token)
  const del = (sessao: SessaoDeTeste, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'DELETE', caminho, sessao.token)
  const post = (sessao: SessaoDeTeste, caminho: string, corpo?: unknown): Promise<RespostaHttp> => chamar(api.url, 'POST', caminho, sessao.token, corpo)
  /** A resposta sem o id da requisição, que muda a cada chamada: o resto precisa ser idêntico. */
  const semRequisicao = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo, mensagem: (resposta.corpo.erro as { mensagem?: string } | undefined)?.mensagem })
  const idsDaLista = async (sessao: SessaoDeTeste, consulta = '') => listaDeMateriaisResponseSchema.parse((await get(sessao, `/v1/materiais${consulta}`)).corpo).itens.map((item) => item.id)
  const materiaisDaBusca = async (sessao: SessaoDeTeste, consulta: string) => buscaDeMaterialResponseSchema.parse((await get(sessao, `/v1/materiais/busca?${consulta}`)).corpo).itens.map((item) => item.materialId)

  /** Uma escola com o PDF de demonstração `pronto` em Química e um professor com vínculo confirmado em Química. */
  async function montar(): Promise<EscolaComMaterial> {
    const escola = await montarEscolaComTurma(api, bancada)
    const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
    expect(enviado.status).toBe(201)
    await esperarExtracao(api)
    const professor = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
    const vinculo = await post(escola.coordenacao, '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId: escola.turma, disciplinaId: escola.quimica, papel: 'professor' })
    expect((await post(professor, `/v1/vinculos/${vinculo.corpo['id'] as string}/confirmar`)).status).toBe(200)
    return { ...escola, materialId: enviado.corpo['id'] as string, professor }
  }

  const estadoDe = async (escola: EscolaComMaterial) => ({
    materiais: await materiaisDa(bancada, escola.coordenacao.escolaId),
    trechos: (await trechosDa(bancada, escola.coordenacao.escolaId)).map(({ material_id, pagina }) => ({ material_id, pagina })),
    excluidos: await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.excluido'),
    recusados: await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.recusado'),
  })

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
    a = await montar()
    b = await montar()
  })

  afterAll(async () => {
    await api.app.close()
    await apagarMateriais(bancada, escolasDoTeste)
    await bancada.fechar()
    await medidor.encerrar()
  })

  it('as duas escolas têm o mesmo arquivo, cada uma com o seu material e os seus seis trechos', async () => {
    const [deA] = await materiaisDa(bancada, a.coordenacao.escolaId)
    const [deB] = await materiaisDa(bancada, b.coordenacao.escolaId)
    expect(deA?.sha256).toBe(deB?.sha256)
    expect(deA?.id).not.toBe(deB?.id)
    expect(await trechosDa(bancada, b.coordenacao.escolaId)).toHaveLength(6)
  })

  it('a lista de A só traz material de A, com ou sem o filtro pela disciplina de B', async () => {
    for (const sessao of [a.coordenacao, a.professor]) {
      expect(await idsDaLista(sessao)).toEqual([a.materialId])
      expect(await idsDaLista(sessao, `?disciplinaId=${b.quimica}`)).toEqual([])
      // A página que começa no id de B continua dentro de A.
      expect(await idsDaLista(sessao, `?pagina=${b.materialId}`)).not.toContain(b.materialId)
    }
  })

  it('ler material de B responde o mesmo 404 do inexistente e do id fora do formato, para a coordenação e para o professor de A', async () => {
    for (const sessao of [a.coordenacao, a.professor]) {
      const deB = await get(sessao, `/v1/materiais/${b.materialId}`)
      const inexistente = await get(sessao, `/v1/materiais/${randomUUID()}`)
      const foraDoFormato = await get(sessao, '/v1/materiais/nao-e-um-id')
      expect(semRequisicao(deB)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO, mensagem: expect.any(String) })
      expect(semRequisicao(inexistente)).toEqual(semRequisicao(deB))
      expect(semRequisicao(foraDoFormato)).toEqual(semRequisicao(deB))
      // O controle: o de A, ele lê.
      expect((await get(sessao, `/v1/materiais/${a.materialId}`)).corpo).toMatchObject({ id: a.materialId })
    }
  })

  it('a busca de A não acha trecho de B com a mesma palavra, nem pedindo a disciplina de B', async () => {
    for (const sessao of [a.coordenacao, a.professor]) {
      const achados = await materiaisDaBusca(sessao, 'q=reagente%20limitante&limite=20')
      expect(achados.length).toBeGreaterThan(0)
      expect(new Set(achados)).toEqual(new Set([a.materialId]))
      expect(await materiaisDaBusca(sessao, `q=reagente%20limitante&disciplinaId=${b.quimica}`)).toEqual([])
    }
    // E a de B acha os dela: os trechos estão lá, só não para A.
    expect(new Set(await materiaisDaBusca(b.coordenacao, 'q=reagente%20limitante&limite=20'))).toEqual(new Set([b.materialId]))
  })

  it('excluir material de B por A responde o mesmo 404 do inexistente, e nada muda em B: material, trechos e auditoria', async () => {
    const antesEmB = await estadoDe(b)
    const deB = await del(a.coordenacao, `/v1/materiais/${b.materialId}`)
    const inexistente = await del(a.coordenacao, `/v1/materiais/${randomUUID()}`)
    const foraDoFormato = await del(a.coordenacao, '/v1/materiais/nao-e-um-id')
    expect(semRequisicao(deB)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO, mensagem: expect.any(String) })
    expect(semRequisicao(inexistente)).toEqual(semRequisicao(deB))
    expect(semRequisicao(foraDoFormato)).toEqual(semRequisicao(deB))
    expect(await estadoDe(b)).toEqual(antesEmB)
    expect(antesEmB.trechos).toHaveLength(6)
    expect(await auditoriaDa(bancada, a.coordenacao.escolaId, 'material.excluido')).toEqual([])
  })

  it('enviar para a disciplina de B responde como disciplina inexistente, com e sem licença, e nada é gravado em nenhuma das duas', async () => {
    const antesEmA = await estadoDe(a)
    const antesEmB = await estadoDe(b)
    const comLicenca = await enviarMaterial(api, a.coordenacao, { disciplinaId: b.quimica })
    const semLicenca = await enviarMaterial(api, a.coordenacao, { disciplinaId: b.quimica, licenca: 'sem_licenca' })
    const inexistente = await enviarMaterial(api, a.coordenacao, { disciplinaId: randomUUID() })
    expect(semRequisicao(comLicenca)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO, mensagem: expect.any(String) })
    expect(semRequisicao(semLicenca)).toEqual(semRequisicao(comLicenca))
    expect(semRequisicao(inexistente)).toEqual(semRequisicao(comLicenca))
    await esperarExtracao(api)
    expect(await estadoDe(a)).toEqual(antesEmA)
    expect(await estadoDe(b)).toEqual(antesEmB)
  })

  it('os tetos de envio são por escola: o que B enviou não conta para A', async () => {
    // B com o teto de materiais em leitura cheio; A continua enviando.
    const c = await montarEscolaComTurma(api, bancada)
    for (let indice = 0; indice < 3; indice += 1) {
      await bancada.pool.query(
        `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, enviado_por) values ($1, $2, 'Sintético', 'escola', 'autoria_da_escola', true, $3, 10, 'processando', $4)`,
        [c.coordenacao.escolaId, c.quimica, randomUUID().replaceAll('-', '').padEnd(64, '0'), c.coordenacao.usuarioId],
      )
    }
    expect((await enviarMaterial(api, c.coordenacao, { disciplinaId: c.quimica })).status).toBe(429)
    const d = await montarEscolaComTurma(api, bancada)
    expect((await enviarMaterial(api, d.coordenacao, { disciplinaId: d.quimica })).status).toBe(201)
    await esperarExtracao(api)
  })

  it('`BuscaDeTrechos`, a porta do Assistente e do Tutor, só lê a escola do contexto', async () => {
    const porta = api.app.get(BuscaDeTrechos)
    const naEscolaA = <T>(funcao: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), escolaId: a.coordenacao.escolaId }, funcao)

    const achados = await naEscolaA(() => porta.buscar({ texto: 'reagente limitante', disciplinaId: a.quimica, limite: 20 }))
    expect(achados.length).toBeGreaterThan(0)
    expect(new Set(achados.map((trecho) => trecho.materialId))).toEqual(new Set([a.materialId]))
    // Com a disciplina de B, com o material de B, ou pedindo as páginas do material de B: nada.
    expect(await naEscolaA(() => porta.buscar({ texto: 'reagente limitante', disciplinaId: b.quimica }))).toEqual([])
    expect(await naEscolaA(() => porta.buscar({ texto: 'reagente limitante', disciplinaId: a.quimica, materialId: b.materialId }))).toEqual([])
    expect(await naEscolaA(() => porta.doMaterial(b.materialId, b.quimica))).toEqual([])
    expect(await naEscolaA(() => porta.doMaterial(b.materialId, a.quimica))).toEqual([])
    expect((await naEscolaA(() => porta.doMaterial(a.materialId, a.quimica))).map((trecho) => trecho.pagina)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('a extração em segundo plano grava na escola de quem enviou, mesmo quando a vaga foi liberada pela extração de outra escola', async () => {
    // Três escolas enviam ao mesmo tempo, com duas vagas: a terceira leitura começa na cadeia assíncrona de outra escola.
    const escolas = [await montarEscolaComTurma(api, bancada), await montarEscolaComTurma(api, bancada), await montarEscolaComTurma(api, bancada)]
    const enviados = await Promise.all(escolas.map((escola) => enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })))
    expect(enviados.map((enviado) => enviado.status)).toEqual([201, 201, 201])
    await esperarExtracao(api)

    for (const [indice, escola] of escolas.entries()) {
      const id = enviados[indice]?.corpo['id'] as string
      const materiais = await materiaisDa(bancada, escola.coordenacao.escolaId)
      expect(materiais.map(({ id: materialId, estado, paginas }) => ({ materialId, estado, paginas }))).toEqual([{ materialId: id, estado: 'pronto', paginas: 6 }])
      const trechos = await trechosDa(bancada, escola.coordenacao.escolaId)
      expect(trechos.map((trecho) => trecho.material_id)).toEqual(Array.from({ length: 6 }, () => id))
    }
  })
})
