import { runInContext } from '@educa/nucleo'
import { ErrorCode, decisaoResponseSchema, loginResponseSchema, minhaTurmaResponseSchema, MENSAGENS_DE_ERRO } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { MinhaTurmaRepository } from '../src/sala/minha-turma/minha-turma.repository.js'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from './api-com-sessao.js'
import { FerramentasDaSala, pedidoDaSala, SENHA_DA_SALA, type SalaDeTeste } from './sala-de-teste.js'
import { BancadaDeSessoes } from './sessao-de-teste.js'

/**
 * A turma do aluno aprovado (A1, tarefa 8.0; `tasks/prd-apresentacao-escola/cenarios.md`): `GET /v1/minha-turma`, só do
 * aluno, pelo vínculo de aluno confirmado dele no ano em curso. Cobre I8 e a parte de `minha-turma` do P4. O aluno nasce
 * como a A1 o faz nascer, pela sala e pela aprovação do professor, e entra por matrícula e senha. O A3 e o A4 da rota
 * moram na varredura de `escola-montada.int.test.ts`.
 */

const AMBIENTE = { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' }
const NAO_ENCONTRADO = { status: 404, erro: { codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO } }

describe('minha-turma (A1, tarefa 8.0): o aluno aprovado vê a própria turma, e só ela', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  let api: ApiDeTeste
  let sala: FerramentasDaSala

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: AMBIENTE })
    sala = new FerramentasDaSala(api, bancada)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const minhaTurma = (token: string) => chamar(api.url, 'GET', '/v1/minha-turma', token)
  const semRequisicao = (resposta: RespostaHttp) => ({ status: resposta.status, erro: { codigo: resposta.corpo.erro?.codigo, mensagem: (resposta.corpo.erro as { mensagem?: string } | undefined)?.mensagem } })

  /** Um aluno aprovado na turma pelo professor, que entra por matrícula e senha: o id dele e o token da sessão. */
  async function alunoAprovado(s: SalaDeTeste, turmaId: string): Promise<{ usuarioId: string; token: string }> {
    const nome = await sala.umNome(s, turmaId)
    const acesso = turmaId === s.turma ? s : { ...s, ...(await sala.gerar(s, turmaId)) }
    expect((await sala.reivindicar(pedidoDaSala(acesso, nome))).status).toBe(200)
    const { rows } = await bancada.pool.query<{ id: string }>(`select id from reivindicacao where lista_nome_id = $1 and estado = 'pendente'`, [nome.id])
    const decidida = await chamar(api.url, 'POST', '/v1/reivindicacoes/decidir', s.professor.token, { ids: [rows[0]?.id], decisao: 'aprovar' })
    expect(decisaoResponseSchema.parse(decidida.corpo).resultados.map((linha) => linha.resultado)).toEqual(['decidida'])
    const entrada = await chamar(api.url, 'POST', '/v1/sessao/matricula', undefined, { slug: s.slug, matricula: nome.matricula, senha: SENHA_DA_SALA })
    const { token } = loginResponseSchema.parse(entrada.corpo) as { token: string }
    const { rows: usuarios } = await bancada.pool.query<{ usuario_id: string }>('select usuario_id from lista_nome where id = $1', [nome.id])
    const usuarioId = usuarios[0]?.usuario_id
    if (usuarioId === undefined) throw new Error('aluno não aprovado')
    return { usuarioId, token }
  }

  it('I8: dois alunos aprovados em T1 e T2 veem cada um a sua, com a escola e a série, sem colegas', async () => {
    const s = await sala.montar()
    const [deT1, deT2] = [await alunoAprovado(s, s.turma), await alunoAprovado(s, s.outraTurma)]
    const { rows } = await bancada.pool.query<{ nome: string }>('select nome from escola where id = $1', [s.escolaId])
    const serie = { id: s.serieId, etapa: 'em', ano: 2 }
    for (const [aluno, turma] of [
      [deT1, { id: s.turma, nome: '2ºB' }],
      [deT2, { id: s.outraTurma, nome: '2ºC' }],
    ] as const) {
      const resposta = await minhaTurma(aluno.token)
      expect(resposta.status).toBe(200)
      expect(minhaTurmaResponseSchema.parse(resposta.corpo)).toEqual({ escola: { nome: rows[0]?.nome }, turma, serie })
    }
  })

  it('I8: o aluno pedindo GET turmas/:id da própria turma, de outra turma e de uma turma de B recebe 404 nas três; P4: professor e coordenação em minha-turma recebem 404', async () => {
    const s = await sala.montar()
    const b = await sala.montar()
    const aluno = await alunoAprovado(s, s.turma)
    for (const turmaId of [s.turma, s.outraTurma, b.turma]) expect(semRequisicao(await chamar(api.url, 'GET', `/v1/turmas/${turmaId}`, aluno.token)), turmaId).toEqual(NAO_ENCONTRADO)
    for (const [quem, token] of [
      ['professor', s.professor.token],
      ['coordenação', s.coordenacao.token],
    ] as const) {
      expect(semRequisicao(await minhaTurma(token)), quem).toEqual(NAO_ENCONTRADO)
    }
    expect((await minhaTurma(aluno.token)).status).toBe(200)
  })

  it('I8: com o ano encerrado e outro em curso, o aluno com vínculo só no encerrado recebe NAO_ENCONTRADO; o aluno ainda sem aprovação também', async () => {
    const s = await sala.montar()
    const aluno = await alunoAprovado(s, s.turma)
    const semAprovacao = await bancada.sessao(s.escolaId, 'aluno')
    expect(semRequisicao(await minhaTurma(semAprovacao.token))).toEqual(NAO_ENCONTRADO)
    await bancada.pool.query(`update ano_letivo set situacao = 'encerrado' where id = $1`, [s.anoLetivoId])
    await bancada.pool.query(`insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2027, '2027-02-01', '2027-12-15', 'em_curso')`, [s.escolaId])
    expect(semRequisicao(await minhaTurma(aluno.token))).toEqual(NAO_ENCONTRADO)
  })

  it('o vínculo encerrado no ano em curso não dá turma; com dois confirmados, a do mais novo', async () => {
    const s = await sala.montar()
    const aluno = await alunoAprovado(s, s.turma)
    await bancada.pool.query(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`,
      [s.escolaId, s.anoLetivoId, aluno.usuarioId, s.outraTurma, s.coordenacao.usuarioId],
    )
    expect(minhaTurmaResponseSchema.parse((await minhaTurma(aluno.token)).corpo).turma.id).toBe(s.outraTurma)
    await bancada.pool.query(`update vinculo set estado = 'encerrado', motivo_encerramento = 'desligamento', encerrado_em = now() where usuario_id = $1 and papel = 'aluno'`, [aluno.usuarioId])
    expect(semRequisicao(await minhaTurma(aluno.token))).toEqual(NAO_ENCONTRADO)
  })

  it('segunda camada: no contexto de outra escola, o usuário e o ano do aluno de A não acham a turma dele', async () => {
    const s = await sala.montar()
    const b = await sala.montar()
    const aluno = await alunoAprovado(s, s.turma)
    const contexto = { requisicaoId: randomUUID(), escolaId: b.escolaId, anoLetivoId: s.anoLetivoId, usuarioId: aluno.usuarioId, papel: 'aluno' as const, sessaoId: randomUUID() }
    expect(await runInContext(contexto, () => new MinhaTurmaRepository(bancada.banco).daSessao())).toBeUndefined()
    expect(await runInContext({ ...contexto, escolaId: s.escolaId }, () => new MinhaTurmaRepository(bancada.banco).daSessao())).toMatchObject({ turma: { id: s.turma } })
  })
})
