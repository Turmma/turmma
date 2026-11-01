import { runInContext } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { EscolaSessaoRepository } from '../src/estrutura/escola-sessao/escola-sessao.repository.js'
import { chamar, subirApi, type TestApi } from './test-api.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'

describe('PUT /v1/escola/sessao: a coordenação configura a inatividade da própria escola', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  async function inatividadeDa(escolaId: string): Promise<{ aluno: number; equipe: number }> {
    const { rows } = await bancada.pool.query<{ aluno: number; equipe: number }>('select inatividade_aluno_min as aluno, inatividade_equipe_min as equipe from escola where id = $1', [escolaId])
    const [linha] = rows
    if (linha === undefined) throw new Error('escola de teste não encontrada')
    return linha
  }

  async function auditoriasDa(escolaId: string): Promise<Array<{ autor_usuario_id: string; entidade: string; entidade_id: string; antes: unknown; depois: unknown; finalidade: string | null }>> {
    const { rows } = await bancada.pool.query<{ autor_usuario_id: string; entidade: string; entidade_id: string; antes: unknown; depois: unknown; finalidade: string | null }>(
      "select autor_usuario_id, entidade, entidade_id, antes, depois, finalidade from auditoria where escola_id = $1 and acao = 'escola.sessao_alterada' order by em, id",
      [escolaId],
    )
    return rows
  }

  const alterar = (sessao: TestSessao, corpo: unknown) => chamar(api.url, 'PUT', '/v1/escola/sessao', sessao.token, corpo)
  const ultimoUsoHa = (sessao: TestSessao, minutos: number) =>
    bancada.pool.query('update sessao set ultimo_uso_em = now() - make_interval(mins => $3) where escola_id = $1 and id = $2', [sessao.escolaId, sessao.sessaoId, minutos])

  it('permissão: professor e aluno recebem o mesmo 404 de rota inexistente, e nada muda nem entra na auditoria', async () => {
    const escola = await bancada.escola()
    for (const papel of ['professor', 'aluno'] as const) {
      const sessao = await bancada.sessao(escola, papel)
      // A guarda responde antes do pipe: o corpo fora do esquema (4 min, e a escola de outra) não muda a resposta.
      for (const corpo of [{ inatividadeAlunoMin: 15, inatividadeEquipeMin: 60 }, { inatividadeAlunoMin: 4, inatividadeEquipeMin: 60 }, { inatividadeAlunoMin: 15, inatividadeEquipeMin: 60, escolaId: randomUUID() }]) {
        const resposta = await alterar(sessao, corpo)
        expect(resposta.status, papel).toBe(404)
        expect(resposta.corpo.erro?.codigo, papel).toBe(ErrorCode.NAO_ENCONTRADO)
      }
    }
    expect(await inatividadeDa(escola)).toEqual({ aluno: 30, equipe: 120 })
    expect(await auditoriasDa(escola)).toEqual([])
  })

  it('caminho feliz e isolamento: o coordenador de A muda para 15 min, grava a auditoria só com os números, e 15 min em A não muda B', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const coordenador = await bancada.sessao(escolaA, 'coordenador')
    const alunoDeA = await bancada.sessao(escolaA)
    const alunoDeB = await bancada.sessao(escolaB)

    const resposta = await alterar(coordenador, { inatividadeAlunoMin: 15, inatividadeEquipeMin: 60 })

    expect(resposta.status).toBe(200)
    expect(resposta.corpo).toEqual({ inatividadeAlunoMin: 15, inatividadeEquipeMin: 60 })
    expect(await inatividadeDa(escolaA)).toEqual({ aluno: 15, equipe: 60 })
    expect(await inatividadeDa(escolaB)).toEqual({ aluno: 30, equipe: 120 })
    expect(await auditoriasDa(escolaA)).toEqual([
      {
        autor_usuario_id: coordenador.usuarioId,
        entidade: 'escola',
        entidade_id: escolaA,
        antes: { inatividadeAlunoMin: 30, inatividadeEquipeMin: 120 },
        depois: { inatividadeAlunoMin: 15, inatividadeEquipeMin: 60 },
        finalidade: null,
      },
    ])
    expect(await auditoriasDa(escolaB)).toEqual([])
    // Vale na requisição seguinte: 21 min sem uso passam de 15 + 5 em A, e ficam dentro de 30 + 5 em B.
    await ultimoUsoHa(alunoDeA, 21)
    await ultimoUsoHa(alunoDeB, 21)
    expect((await chamar(api.url, 'GET', '/v1/eu', alunoDeA.token)).status).toBe(401)
    expect((await chamar(api.url, 'GET', '/v1/eu', alunoDeB.token)).status).toBe(200)
    // E a equipe de A passa a vencer em 60 + 5.
    const professorDeA = await bancada.sessao(escolaA, 'professor')
    await ultimoUsoHa(professorDeA, 66)
    expect((await chamar(api.url, 'GET', '/v1/eu', professorDeA.token)).status).toBe(401)
  })

  it('borda: fora de 5 a 480 minutos, número quebrado, campo a mais (a escola, por exemplo) ou faltando dão ENTRADA_INVALIDA, sem mudar nada', async () => {
    const escola = await bancada.escola()
    const coordenador = await bancada.sessao(escola, 'coordenador')
    const outra = await bancada.escola()
    for (const corpo of [
      { inatividadeAlunoMin: 4, inatividadeEquipeMin: 120 },
      { inatividadeAlunoMin: 30, inatividadeEquipeMin: 481 },
      { inatividadeAlunoMin: 30.5, inatividadeEquipeMin: 120 },
      { inatividadeAlunoMin: '30', inatividadeEquipeMin: 120 },
      { inatividadeAlunoMin: 30 },
      { inatividadeAlunoMin: 30, inatividadeEquipeMin: 120, escolaId: outra },
    ]) {
      const resposta = await alterar(coordenador, corpo)
      expect(resposta.status, JSON.stringify(corpo)).toBe(400)
      expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
    }
    expect(await inatividadeDa(escola)).toEqual({ aluno: 30, equipe: 120 })
    expect(await inatividadeDa(outra)).toEqual({ aluno: 30, equipe: 120 })
    // Os limites em si valem.
    expect((await alterar(coordenador, { inatividadeAlunoMin: 5, inatividadeEquipeMin: 480 })).status).toBe(200)
  })

  it('concorrência: duas alterações ao mesmo tempo gravam as duas em ordem, e o antes de uma é o depois da outra', async () => {
    const escola = await bancada.escola()
    const [primeiro, segundo] = await bancada.sessoes(escola, { papel: 'coordenador', quantidade: 2 })
    if (primeiro === undefined || segundo === undefined) throw new Error('sessões de teste não criadas')

    const respostas = await Promise.all([alterar(primeiro, { inatividadeAlunoMin: 10, inatividadeEquipeMin: 90 }), alterar(segundo, { inatividadeAlunoMin: 20, inatividadeEquipeMin: 100 })])

    expect(respostas.map((resposta) => resposta.status)).toEqual([200, 200])
    const auditorias = await auditoriasDa(escola)
    expect(auditorias).toHaveLength(2)
    expect(auditorias[0]?.antes).toEqual({ inatividadeAlunoMin: 30, inatividadeEquipeMin: 120 })
    expect(auditorias[1]?.antes).toEqual(auditorias[0]?.depois)
    const final = await inatividadeDa(escola)
    expect({ inatividadeAlunoMin: final.aluno, inatividadeEquipeMin: final.equipe }).toEqual(auditorias[1]?.depois)
  })

  it('repository: lê e altera só a escola do contexto, cada uma com o seu valor, e sem escola no contexto falha fechado', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    await bancada.pool.query('update escola set inatividade_aluno_min = 10, inatividade_equipe_min = 50 where id = $1', [escolaA])
    await bancada.pool.query('update escola set inatividade_aluno_min = 20, inatividade_equipe_min = 70 where id = $1', [escolaB])
    const naEscola = <T>(escolaId: string, funcao: (repositorio: EscolaSessaoRepository) => Promise<T>) =>
      runInContext({ requisicaoId: randomUUID(), escolaId }, () => bancada.banco.transaction((tx) => funcao(new EscolaSessaoRepository(tx))))

    expect(await naEscola(escolaA, (repositorio) => repositorio.lerParaAlterar())).toEqual({ inatividadeAlunoMin: 10, inatividadeEquipeMin: 50 })
    expect(await naEscola(escolaB, (repositorio) => repositorio.lerParaAlterar())).toEqual({ inatividadeAlunoMin: 20, inatividadeEquipeMin: 70 })

    expect(await naEscola(escolaA, (repositorio) => repositorio.alterar({ inatividadeAlunoMin: 15, inatividadeEquipeMin: 60 }))).toEqual({ inatividadeAlunoMin: 15, inatividadeEquipeMin: 60 })
    expect(await inatividadeDa(escolaA)).toEqual({ aluno: 15, equipe: 60 })
    expect(await inatividadeDa(escolaB)).toEqual({ aluno: 20, equipe: 70 })

    const semEscola = <T>(funcao: (repositorio: EscolaSessaoRepository) => Promise<T>) =>
      runInContext({ requisicaoId: randomUUID() }, () => bancada.banco.transaction((tx) => funcao(new EscolaSessaoRepository(tx))))
    await expect(semEscola((repositorio) => repositorio.lerParaAlterar())).rejects.toThrow('consulta com escopo sem escola no contexto')
    await expect(semEscola((repositorio) => repositorio.alterar({ inatividadeAlunoMin: 5, inatividadeEquipeMin: 5 }))).rejects.toThrow('consulta com escopo sem escola no contexto')
    expect(await inatividadeDa(escolaB)).toEqual({ aluno: 20, equipe: 70 })
  })
})
