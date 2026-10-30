import { executarNoContexto } from '@educa/nucleo'
import { ErrorCode, TENANT_DE_CONTA_PESSOAL_MICROSOFT } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { ProvedoresLiberadosRepository } from '../src/estrutura/provedores-da-escola/provedores-liberados.repository.js'
import { chamar, subirApi, type ApiDeTeste } from './api-com-sessao.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

const DOMINIO_A = 'escola-a.educa-sintetica.test'
const SEGUNDO_DOMINIO_A = 'segundo-dominio-a.educa-sintetica.test'
const TENANT_A = 'aaaaaaaa-0000-4000-8000-00000000000a'
const DOMINIO_B = 'escola-b.educa-sintetica.test'

interface LinhaDeProvedor {
  id: string
  provedor: string
  valor: string
  removido_em: Date | null
}

interface AuditoriaDeProvedores {
  autor_usuario_id: string
  entidade_id: string
  antes: { google: string[]; microsoft: string[] }
  depois: { google: string[]; microsoft: string[] }
}

describe('PUT /v1/escola/provedores: a coordenação libera os domínios Google e os tenants Microsoft da própria escola', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  let api: ApiDeTeste

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const alterar = (sessao: SessaoDeTeste, corpo: unknown) => chamar(api.url, 'PUT', '/v1/escola/provedores', sessao.token, corpo)

  async function linhasDa(escolaId: string): Promise<LinhaDeProvedor[]> {
    const { rows } = await bancada.pool.query<LinhaDeProvedor>('select id, provedor, valor, removido_em from provedor_escola where escola_id = $1 order by id', [escolaId])
    return rows
  }

  const ativas = async (escolaId: string) => (await linhasDa(escolaId)).filter((linha) => linha.removido_em === null).map(({ provedor, valor }) => ({ provedor, valor }))

  async function auditoriasDa(escolaId: string): Promise<AuditoriaDeProvedores[]> {
    const { rows } = await bancada.pool.query<AuditoriaDeProvedores>(
      "select autor_usuario_id, entidade_id, antes, depois from auditoria where escola_id = $1 and acao = 'escola.provedores_alterados' order by em, id",
      [escolaId],
    )
    return rows
  }

  async function acessoDa(escolaId: string): Promise<unknown> {
    const resposta = await fetch(`${api.url}/v1/escolas/${await bancada.slugDe(escolaId)}/acesso`)
    return ((await resposta.json()) as { provedores: unknown }).provedores
  }

  it('caminho feliz: grava normalizado, responde só provedor e valor, audita os ids, e a tela da escola passa a oferecer os dois botões', async () => {
    const escola = await bancada.escola()
    const coordenador = await bancada.sessao(escola, 'coordenador')
    expect(await acessoDa(escola)).toEqual([])

    const resposta = await alterar(coordenador, {
      provedores: [
        { provedor: 'microsoft', valor: TENANT_A.toUpperCase() },
        { provedor: 'google', valor: ` ${DOMINIO_A.toUpperCase()} ` },
      ],
    })

    expect(resposta.status).toBe(200)
    expect(resposta.corpo).toEqual({ provedores: expect.arrayContaining([{ provedor: 'google', valor: DOMINIO_A }, { provedor: 'microsoft', valor: TENANT_A }]) })
    expect((resposta.corpo['provedores'] as unknown[]).length).toBe(2)
    const linhas = await linhasDa(escola)
    expect(linhas.map(({ provedor, valor, removido_em }) => ({ provedor, valor, removido_em })).sort((a, b) => a.provedor.localeCompare(b.provedor))).toEqual([
      { provedor: 'google', valor: DOMINIO_A, removido_em: null },
      { provedor: 'microsoft', valor: TENANT_A, removido_em: null },
    ])
    const idDe = (provedor: string) => linhas.find((linha) => linha.provedor === provedor)?.id
    expect(await auditoriasDa(escola)).toEqual([
      { autor_usuario_id: coordenador.usuarioId, entidade_id: escola, antes: { google: [], microsoft: [] }, depois: { google: [idDe('google')], microsoft: [idDe('microsoft')] } },
    ])
    // Na ordem fixa do contrato, e nunca o domínio nem o tenant.
    expect(await acessoDa(escola)).toEqual(['google', 'microsoft'])
  })

  it('trocar a lista mantém o id do que ficou, retira (sem apagar) o que saiu, e a auditoria diz os ids de antes e de depois; lista vazia desliga os botões', async () => {
    const escola = await bancada.escola()
    const coordenador = await bancada.sessao(escola, 'coordenador')
    await alterar(coordenador, { provedores: [{ provedor: 'google', valor: DOMINIO_A }, { provedor: 'microsoft', valor: TENANT_A }] })
    const primeiras = await linhasDa(escola)
    const idGoogle = primeiras.find((linha) => linha.provedor === 'google')?.id
    const idMicrosoft = primeiras.find((linha) => linha.provedor === 'microsoft')?.id

    const resposta = await alterar(coordenador, { provedores: [{ provedor: 'google', valor: DOMINIO_A }, { provedor: 'google', valor: SEGUNDO_DOMINIO_A }] })

    expect(resposta.status).toBe(200)
    const linhas = await linhasDa(escola)
    expect(linhas).toHaveLength(3)
    expect(linhas.find((linha) => linha.id === idGoogle)?.removido_em).toBeNull()
    expect(linhas.find((linha) => linha.id === idMicrosoft)?.removido_em).toBeInstanceOf(Date)
    const idNovo = linhas.find((linha) => linha.valor === SEGUNDO_DOMINIO_A)?.id
    expect((await auditoriasDa(escola))[1]).toMatchObject({ antes: { google: [idGoogle], microsoft: [idMicrosoft] }, depois: { google: [idGoogle, idNovo], microsoft: [] } })
    expect(await acessoDa(escola)).toEqual(['google'])

    expect((await alterar(coordenador, { provedores: [] })).corpo).toEqual({ provedores: [] })
    expect(await ativas(escola)).toEqual([])
    expect(await acessoDa(escola)).toEqual([])
    expect((await auditoriasDa(escola))[2]).toMatchObject({ antes: { google: [idGoogle, idNovo], microsoft: [] }, depois: { google: [], microsoft: [] } })
  })

  it('permissão: professor e aluno recebem o mesmo 404 de rota inexistente, e nada muda nem entra na auditoria', async () => {
    const escola = await bancada.escola()
    for (const papel of ['professor', 'aluno'] as const) {
      const resposta = await alterar(await bancada.sessao(escola, papel), { provedores: [{ provedor: 'google', valor: DOMINIO_A }] })
      expect(resposta.status, papel).toBe(404)
      expect(resposta.corpo.erro?.codigo, papel).toBe(ErrorCode.NAO_ENCONTRADO)
    }
    expect(await linhasDa(escola)).toEqual([])
    expect(await auditoriasDa(escola)).toEqual([])
  })

  it('isolamento: o coordenador de A troca só a lista de A; a de B, e a auditoria de B, não mudam', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const coordenadorDeA = await bancada.sessao(escolaA, 'coordenador')
    const coordenadorDeB = await bancada.sessao(escolaB, 'coordenador')
    await alterar(coordenadorDeB, { provedores: [{ provedor: 'google', valor: DOMINIO_B }] })
    const linhasDeB = await linhasDa(escolaB)

    // A lista vazia de A, se valesse para outra escola, retiraria o domínio de B.
    expect((await alterar(coordenadorDeA, { provedores: [] })).status).toBe(200)
    expect((await alterar(coordenadorDeA, { provedores: [{ provedor: 'google', valor: DOMINIO_A }] })).status).toBe(200)

    expect(await linhasDa(escolaB)).toEqual(linhasDeB)
    expect(await auditoriasDa(escolaB)).toHaveLength(1)
    expect(await ativas(escolaA)).toEqual([{ provedor: 'google', valor: DOMINIO_A }])
  })

  it('isolamento: o repository no contexto de A não lê a lista de B nem retira, pelo id, o domínio de B', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    await bancada.pool.query("insert into provedor_escola (escola_id, provedor, valor) values ($1, 'google', $2)", [escolaB, DOMINIO_B])
    const [linhaDeB] = await linhasDa(escolaB)
    if (linhaDeB === undefined) throw new Error('domínio de B não gravado')
    await executarNoContexto({ requisicaoId: randomUUID(), escolaId: escolaA }, () =>
      bancada.banco.transaction(async (tx) => {
        const repositorio = new ProvedoresLiberadosRepository(tx)
        expect(await repositorio.liberados()).toEqual([])
        await repositorio.retirar([linhaDeB.id])
      }),
    )
    expect((await linhasDa(escolaB))[0]?.removido_em).toBeNull()
  })

  it('entrada inválida: tenant de conta pessoal, gmail.com, repetido e campo a mais dão 400, e nada muda', async () => {
    const escola = await bancada.escola()
    const coordenador = await bancada.sessao(escola, 'coordenador')
    for (const corpo of [
      { provedores: [{ provedor: 'microsoft', valor: TENANT_DE_CONTA_PESSOAL_MICROSOFT }] },
      { provedores: [{ provedor: 'google', valor: 'gmail.com' }] },
      { provedores: [{ provedor: 'google', valor: DOMINIO_A }, { provedor: 'google', valor: DOMINIO_A.toUpperCase() }] },
      { provedores: [], escolaId: escola },
      { provedores: [{ provedor: 'google', valor: DOMINIO_A, escolaId: escola }] },
    ]) {
      const resposta = await alterar(coordenador, corpo)
      expect(resposta.status, JSON.stringify(corpo)).toBe(400)
      expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
    }
    expect(await linhasDa(escola)).toEqual([])
    expect(await auditoriasDa(escola)).toEqual([])
  })

  it('concorrência: duas trocas em paralelo passam uma depois da outra: nenhum domínio fica duas vezes, e o antes da segunda é o depois da primeira', async () => {
    const escola = await bancada.escola()
    const coordenador = await bancada.sessao(escola, 'coordenador')
    const [primeira, segunda] = await Promise.all([
      alterar(coordenador, { provedores: [{ provedor: 'google', valor: DOMINIO_A }] }),
      alterar(coordenador, { provedores: [{ provedor: 'google', valor: DOMINIO_A }, { provedor: 'microsoft', valor: TENANT_A }] }),
    ])
    expect([primeira.status, segunda.status]).toEqual([200, 200])
    const ativasAgora = (await linhasDa(escola)).filter((linha) => linha.removido_em === null)
    expect(ativasAgora.filter((linha) => linha.valor === DOMINIO_A)).toHaveLength(1)
    const [antes, depois] = await auditoriasDa(escola)
    expect(antes?.antes).toEqual({ google: [], microsoft: [] })
    expect(depois?.antes).toEqual(antes?.depois)
  })
})
