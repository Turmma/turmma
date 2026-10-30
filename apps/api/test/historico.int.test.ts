import { executarNoContexto } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { TurmaRepository } from '../src/estrutura/turma/turma.repository.js'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from './api-com-sessao.js'
import { alunosNaTurma, montarEscolaComTurma, type EscolaComTurma } from './escola-com-turma.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

const semRequisicao = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo, mensagem: (resposta.corpo.erro as { mensagem?: string } | undefined)?.mensagem })

const NAO_ENCONTRADO = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO, mensagem: expect.any(String) }

const FINALIDADE = 'acompanhamento_pedagogico'

/**
 * Uma escola que viveu 2026 e o encerrou, com 2027 ainda por abrir:
 * - no 2ºB, dois alunos que chegaram ao fim do ano e um transferido em maio (`realocacao`); no 2ºC, um aluno;
 * - o professor que continua (confirmado no 2ºB, virou `fim_do_ano`), o desligado em março, o realocado, o que nunca
 *   confirmou (pendente) e o que contestou, os três últimos também no 2ºB;
 * - o professor com duas disciplinas no 2ºB: Física desligada em março, Química até o fim do ano.
 */
interface EscolaComHistorico extends EscolaComTurma {
  readonly alunosDoB: readonly string[]
  readonly alunosDoC: readonly string[]
  readonly continua: SessaoDeTeste
  readonly vinculoQueContinua: string
  readonly desligado: SessaoDeTeste
  readonly realocado: SessaoDeTeste
  readonly nuncaConfirmou: SessaoDeTeste
  readonly contestou: SessaoDeTeste
  readonly duasDisciplinas: SessaoDeTeste
  readonly aluno: SessaoDeTeste
}

describe('histórico: o ano encerrado fica só em leitura, para a coordenação e para o professor que tinha a turma (10.0, RF16)', () => {
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

  const post = (sessao: SessaoDeTeste, caminho: string, corpo?: unknown): Promise<RespostaHttp> => chamar(api.url, 'POST', caminho, sessao.token, corpo)
  const get = (sessao: SessaoDeTeste, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, sessao.token)
  const ids = (resposta: RespostaHttp) => (resposta.corpo['itens'] as Array<{ usuarioId: string }>).map((aluno) => aluno.usuarioId)

  async function vincular(escola: EscolaComTurma, professor: SessaoDeTeste, turmaId = escola.turma, disciplinaId = escola.quimica): Promise<string> {
    const resposta = await post(escola.coordenacao, '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId, disciplinaId, papel: 'professor' })
    expect(resposta.status).toBe(201)
    return resposta.corpo['id'] as string
  }

  async function confirmar(professor: SessaoDeTeste, id: string): Promise<void> {
    expect((await post(professor, `/v1/vinculos/${id}/confirmar`)).status).toBe(200)
  }

  async function montar(): Promise<EscolaComHistorico> {
    const escola = await montarEscolaComTurma(api, bancada)
    const alunosDoB = await alunosNaTurma(bancada, escola, escola.turma, 2)
    const alunosDoC = await alunosNaTurma(bancada, escola, escola.outraTurma, 1)
    const [transferido] = await alunosNaTurma(bancada, escola, escola.turma, 1)
    await bancada.pool.query(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where usuario_id = $1`, [transferido])

    const [continua, desligado, realocado, nuncaConfirmou, contestou, duasDisciplinas] = await bancada.sessoes(escola.coordenacao.escolaId, { papel: 'professor', quantidade: 6 })
    if (continua === undefined || desligado === undefined || realocado === undefined || nuncaConfirmou === undefined || contestou === undefined || duasDisciplinas === undefined) {
      throw new Error('professores')
    }
    const vinculoQueContinua = await vincular(escola, continua)
    await confirmar(continua, vinculoQueContinua)
    for (const [professor, motivo] of [
      [desligado, 'desligamento'],
      [realocado, 'realocacao'],
    ] as const) {
      const id = await vincular(escola, professor)
      await confirmar(professor, id)
      expect((await post(escola.coordenacao, `/v1/vinculos/${id}/encerrar`, { motivo })).status).toBe(200)
    }
    const quimicaAteOFim = await vincular(escola, duasDisciplinas, escola.turma, escola.quimica)
    const fisicaDesligada = await vincular(escola, duasDisciplinas, escola.turma, escola.fisica)
    await confirmar(duasDisciplinas, quimicaAteOFim)
    await confirmar(duasDisciplinas, fisicaDesligada)
    expect((await post(escola.coordenacao, `/v1/vinculos/${fisicaDesligada}/encerrar`, { motivo: 'desligamento' })).status).toBe(200)
    await vincular(escola, nuncaConfirmou)
    const contestado = await vincular(escola, contestou)
    expect((await post(contestou, `/v1/vinculos/${contestado}/contestar`, { contestacao: 'nao_leciono' })).status).toBe(200)

    // O professor que continua lê a turma no ano em curso; o desligado em março já não lê, antes mesmo da virada.
    expect((await get(continua, `/v1/turmas/${escola.turma}`)).status).toBe(200)
    expect(semRequisicao(await get(desligado, `/v1/turmas/${escola.turma}`))).toEqual(NAO_ENCONTRADO)

    expect((await post(escola.coordenacao, `/v1/anos-letivos/${escola.anoLetivoId}/encerrar`)).status).toBe(200)
    const aluno = await bancada.sessao(escola.coordenacao.escolaId, 'aluno')
    return { ...escola, alunosDoB, alunosDoC, continua, vinculoQueContinua, desligado, realocado, nuncaConfirmou, contestou, duasDisciplinas, aluno }
  }

  async function leiturasDeAlunos(escolaId: string): Promise<Array<{ entidade_id: string; autor_usuario_id: string; depois: unknown; finalidade: string }>> {
    const { rows } = await bancada.pool.query<{ entidade_id: string; autor_usuario_id: string; depois: unknown; finalidade: string }>(
      "select entidade_id, autor_usuario_id, depois, finalidade from auditoria where escola_id = $1 and acao = 'turma.alunos_lidos' order by em, id",
      [escolaId],
    )
    return rows
  }

  async function contagens(escolaId: string): Promise<{ turmas: number; vinculos: number; auditorias: number }> {
    const { rows } = await bancada.pool.query<{ turmas: string; vinculos: string; auditorias: string }>(
      `select (select count(*) from turma where escola_id = $1) as turmas, (select count(*) from vinculo where escola_id = $1) as vinculos,
              (select count(*) from auditoria where escola_id = $1) as auditorias`,
      [escolaId],
    )
    const [linha] = rows
    return { turmas: Number(linha?.turmas), vinculos: Number(linha?.vinculos), auditorias: Number(linha?.auditorias) }
  }

  let escola: EscolaComHistorico

  beforeAll(async () => {
    escola = await montar()
  })

  it('caminho feliz: o professor que continua lê a turma de 2026 e os alunos que chegaram ao fim do ano, sem finalidade e sem registro', async () => {
    const turma = await get(escola.continua, `/v1/turmas/${escola.turma}?anoLetivoId=${escola.anoLetivoId}`)
    expect(turma.status).toBe(200)
    expect(turma.corpo).toEqual({ id: escola.turma, nome: '2ºB', serie: { id: escola.serieId, etapa: 'em', ano: 2 } })
    const alunos = await get(escola.continua, `/v1/turmas/${escola.turma}/alunos?anoLetivoId=${escola.anoLetivoId}`)
    expect(alunos.status).toBe(200)
    // Nem o transferido em maio, nem o aluno do 2ºC.
    expect(ids(alunos)).toEqual(escola.alunosDoB)
    // Sem o filtro, a leitura é do ano em curso, que a escola não tem: a turma de 2026 não aparece.
    expect(semRequisicao(await get(escola.continua, `/v1/turmas/${escola.turma}`))).toEqual(NAO_ENCONTRADO)
    expect(await leiturasDeAlunos(escola.coordenacao.escolaId)).toEqual([])
  })

  it('só leitura: em janeiro, com 2027 já em curso, toda escrita sobre 2026 é recusada, e nada muda no banco', async () => {
    // Um estado próprio: com 2027 aberto, a escrita passa por `exigirAnoEmCurso` e só a regra do ano a recusa.
    const propria = await montar()
    const ano = propria.anoLetivoId
    const de2027 = await post(propria.coordenacao, '/v1/anos-letivos', { ano: 2027, inicio: '2027-02-01', fim: '2027-12-15' })
    expect((await post(propria.coordenacao, `/v1/anos-letivos/${de2027.corpo['id'] as string}/abrir`)).status).toBe(200)
    const antes = await contagens(propria.coordenacao.escolaId)

    const recusas: Array<[string, RespostaHttp]> = [
      // A única escrita que recebe `anoLetivoId`: sem a conferência, a turma nasceria em 2027.
      ['turma com o ano de 2026', await post(propria.coordenacao, '/v1/turmas', { serieId: propria.serieId, nome: '2ºD', anoLetivoId: ano })],
      // As outras não o aceitam: a turma e o vínculo de 2026 não são do ano em curso, nem com `?anoLetivoId`.
      ['vínculo na turma de 2026', await post(propria.coordenacao, `/v1/vinculos?anoLetivoId=${ano}`, { usuarioId: propria.continua.usuarioId, turmaId: propria.outraTurma, disciplinaId: propria.quimica, papel: 'professor' })],
      ['confirmar', await post(propria.continua, `/v1/vinculos/${propria.vinculoQueContinua}/confirmar?anoLetivoId=${ano}`)],
      ['contestar', await post(propria.continua, `/v1/vinculos/${propria.vinculoQueContinua}/contestar?anoLetivoId=${ano}`, { contestacao: 'outro' })],
      ['encerrar', await post(propria.coordenacao, `/v1/vinculos/${propria.vinculoQueContinua}/encerrar?anoLetivoId=${ano}`, { motivo: 'desligamento' })],
    ]
    for (const [caso, resposta] of recusas) expect(semRequisicao(resposta), caso).toEqual(NAO_ENCONTRADO)
    // No corpo do vínculo o campo nem existe: recusado como entrada inválida, antes de qualquer consulta.
    const comAnoNoCorpo = await post(propria.coordenacao, '/v1/vinculos', { usuarioId: propria.continua.usuarioId, turmaId: propria.turma, papel: 'professor', anoLetivoId: ano })
    expect(comAnoNoCorpo.status).toBe(400)
    expect(comAnoNoCorpo.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
    // E reabrir o ano encerrado não existe.
    expect((await post(propria.coordenacao, `/v1/anos-letivos/${ano}/abrir`)).status).toBe(409)
    expect(await contagens(propria.coordenacao.escolaId)).toEqual(antes)
    // O controle: a mesma turma, sem o ano de 2026, nasce em 2027; e o histórico continua lido.
    expect((await post(propria.coordenacao, '/v1/turmas', { serieId: propria.serieId, nome: '2ºD' })).status).toBe(201)
    expect((await get(propria.continua, `/v1/turmas/${propria.turma}?anoLetivoId=${ano}`)).status).toBe(200)
  })

  it('borda: professor com duas disciplinas no 2ºB, uma desligada em março e outra até o fim do ano, lê a turma e os alunos', async () => {
    const turma = await get(escola.duasDisciplinas, `/v1/turmas/${escola.turma}?anoLetivoId=${escola.anoLetivoId}`)
    expect(turma.status).toBe(200)
    expect(turma.corpo['id']).toBe(escola.turma)
    expect(ids(await get(escola.duasDisciplinas, `/v1/turmas/${escola.turma}/alunos?anoLetivoId=${escola.anoLetivoId}`))).toEqual(escola.alunosDoB)
  })

  it('borda: o professor desligado em março e o realocado dão o 404 da turma inexistente em outubro, na turma e nos alunos', async () => {
    const inexistente = randomUUID()
    for (const professor of [escola.desligado, escola.realocado]) {
      for (const sufixo of ['', '/alunos']) {
        const daTurma = await get(professor, `/v1/turmas/${escola.turma}${sufixo}?anoLetivoId=${escola.anoLetivoId}`)
        expect(semRequisicao(daTurma)).toEqual(NAO_ENCONTRADO)
        expect(semRequisicao(daTurma)).toEqual(semRequisicao(await get(professor, `/v1/turmas/${inexistente}${sufixo}?anoLetivoId=${escola.anoLetivoId}`)))
      }
    }
  })

  it('borda: o vínculo que nunca foi aceito (pendente ou contestado) virou `fim_do_ano` na virada e não abre a turma', async () => {
    for (const professor of [escola.nuncaConfirmou, escola.contestou]) {
      for (const sufixo of ['', '/alunos']) {
        expect(semRequisicao(await get(professor, `/v1/turmas/${escola.turma}${sufixo}?anoLetivoId=${escola.anoLetivoId}`))).toEqual(NAO_ENCONTRADO)
      }
    }
  })

  it('borda: `fim_do_ano` no 2ºB não abre o 2ºC do mesmo ano, onde ele nunca teve vínculo', async () => {
    for (const sufixo of ['', '/alunos']) {
      expect(semRequisicao(await get(escola.continua, `/v1/turmas/${escola.outraTurma}${sufixo}?anoLetivoId=${escola.anoLetivoId}`))).toEqual(NAO_ENCONTRADO)
    }
  })

  it('permissão: a coordenação lê a turma de 2026 sem vínculo, e os alunos só com finalidade e auditoria; o aluno com `?anoLetivoId` é recusado', async () => {
    const auditoriasAntes = (await leiturasDeAlunos(escola.coordenacao.escolaId)).length
    const turma = await get(escola.coordenacao, `/v1/turmas/${escola.outraTurma}?anoLetivoId=${escola.anoLetivoId}`)
    expect(turma.status).toBe(200)
    expect(turma.corpo).toEqual({ id: escola.outraTurma, nome: '2ºC', serie: expect.objectContaining({ id: escola.serieId }) })

    const semFinalidade = await get(escola.coordenacao, `/v1/turmas/${escola.outraTurma}/alunos?anoLetivoId=${escola.anoLetivoId}`)
    expect(semFinalidade.status).toBe(400)
    expect(semFinalidade.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
    expect(await leiturasDeAlunos(escola.coordenacao.escolaId)).toHaveLength(auditoriasAntes)

    const alunos = await get(escola.coordenacao, `/v1/turmas/${escola.outraTurma}/alunos?anoLetivoId=${escola.anoLetivoId}&finalidade=${FINALIDADE}`)
    expect(alunos.status).toBe(200)
    expect(ids(alunos)).toEqual(escola.alunosDoC)
    expect((await leiturasDeAlunos(escola.coordenacao.escolaId)).slice(auditoriasAntes)).toEqual([
      { entidade_id: escola.outraTurma, autor_usuario_id: escola.coordenacao.usuarioId, depois: { quantidade: 1 }, finalidade: FINALIDADE },
    ])

    for (const sufixo of ['', '/alunos', `/alunos?finalidade=${FINALIDADE}&`]) {
      const separador = sufixo.endsWith('&') ? '' : '?'
      expect(semRequisicao(await get(escola.aluno, `/v1/turmas/${escola.turma}${sufixo}${separador}anoLetivoId=${escola.anoLetivoId}`))).toEqual(NAO_ENCONTRADO)
    }
  })

  it('o filtro só aceita ano encerrado: um ano em curso, planejado ou encerrado mas de outra turma não abre a turma', async () => {
    // Um 2025 encerrado da mesma escola: a turma de 2026 não é dele.
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2025, '2025-02-01', '2025-12-15', 'encerrado') returning id`,
      [escola.coordenacao.escolaId],
    )
    const de2025 = rows[0]?.id ?? ''
    expect(semRequisicao(await get(escola.coordenacao, `/v1/turmas/${escola.turma}?anoLetivoId=${de2025}`))).toEqual(NAO_ENCONTRADO)

    // 2027 aberto, com uma turma: lida sem filtro, e não com o id do ano em curso, nem com o de um planejado.
    const de2027 = await post(escola.coordenacao, '/v1/anos-letivos', { ano: 2027, inicio: '2027-02-01', fim: '2027-12-15' })
    const de2028 = await post(escola.coordenacao, '/v1/anos-letivos', { ano: 2028, inicio: '2028-02-01', fim: '2028-12-15' })
    const emCurso = de2027.corpo['id'] as string
    expect((await post(escola.coordenacao, `/v1/anos-letivos/${emCurso}/abrir`)).status).toBe(200)
    const nova = await post(escola.coordenacao, '/v1/turmas', { serieId: escola.serieId, nome: '3ºB' })
    expect(nova.status).toBe(201)
    const turmaNova = nova.corpo['id'] as string
    expect((await get(escola.coordenacao, `/v1/turmas/${turmaNova}`)).status).toBe(200)
    for (const ano of [emCurso, de2028.corpo['id'] as string]) {
      expect(semRequisicao(await get(escola.coordenacao, `/v1/turmas/${turmaNova}?anoLetivoId=${ano}`))).toEqual(NAO_ENCONTRADO)
      expect(semRequisicao(await get(escola.coordenacao, `/v1/turmas/${turmaNova}/alunos?finalidade=${FINALIDADE}&anoLetivoId=${ano}`))).toEqual(NAO_ENCONTRADO)
    }
    // Com 2027 em curso, o histórico de 2026 continua lido do mesmo jeito.
    expect((await get(escola.continua, `/v1/turmas/${escola.turma}?anoLetivoId=${escola.anoLetivoId}`)).status).toBe(200)
    expect(ids(await get(escola.continua, `/v1/turmas/${escola.turma}/alunos?anoLetivoId=${escola.anoLetivoId}`))).toEqual(escola.alunosDoB)
  })

  describe('isolamento entre escolas (regra 10; Tech Spec, seção 6)', () => {
    let b: EscolaComHistorico

    beforeAll(async () => {
      b = await montar()
    })

    it('`anoLetivoId` de B, com a turma de B existindo, dá o 404 do inexistente, na turma de B e na de A', async () => {
      const inexistente = randomUUID()
      for (const sessao of [escola.coordenacao, escola.continua]) {
        for (const sufixo of ['', `/alunos?finalidade=${FINALIDADE}&`]) {
          const separador = sufixo.endsWith('&') ? '' : '?'
          const turmaDeB = await get(sessao, `/v1/turmas/${b.turma}${sufixo}${separador}anoLetivoId=${b.anoLetivoId}`)
          expect(semRequisicao(turmaDeB)).toEqual(NAO_ENCONTRADO)
          expect(semRequisicao(turmaDeB)).toEqual(semRequisicao(await get(sessao, `/v1/turmas/${inexistente}${sufixo}${separador}anoLetivoId=${b.anoLetivoId}`)))
          expect(semRequisicao(await get(sessao, `/v1/turmas/${escola.turma}${sufixo}${separador}anoLetivoId=${b.anoLetivoId}`))).toEqual(NAO_ENCONTRADO)
          expect(semRequisicao(await get(sessao, `/v1/turmas/${b.turma}${sufixo}${separador}anoLetivoId=${inexistente}`))).toEqual(NAO_ENCONTRADO)
        }
      }
      // B lê o próprio histórico: o 404 acima veio da escola.
      expect((await get(b.continua, `/v1/turmas/${b.turma}?anoLetivoId=${b.anoLetivoId}`)).status).toBe(200)
      expect(await leiturasDeAlunos(escola.coordenacao.escolaId)).not.toContainEqual(expect.objectContaining({ entidade_id: b.turma }))
    })

    it('o escopo de escola vale sozinho no histórico: com o ano, a turma e o professor de B num contexto de A, o repository não alcança B', async () => {
      // Contexto forjado: escola A com o professor de B. Só a cláusula de escola separa as duas; sem ela, a turma e os
      // alunos de 2026 de B voltariam.
      const forjado = { requisicaoId: randomUUID(), escolaId: escola.coordenacao.escolaId, usuarioId: b.continua.usuarioId, papel: 'professor' as const, sessaoId: randomUUID(), anoLetivoId: null }
      const consultar = () => {
        const turmas = new TurmaRepository(bancada.banco)
        return Promise.all([
          turmas.aberta(b.turma, 'unidade', b.anoLetivoId),
          turmas.aberta(b.turma, 'turma_vinculada', b.anoLetivoId),
          turmas.alunos(b.turma, { limite: 50 }, b.anoLetivoId),
        ])
      }
      expect(await executarNoContexto(forjado, consultar)).toEqual([undefined, undefined, []])

      // O controle: o mesmo contexto com a escola de B alcança a turma e os alunos, então o vazio acima veio da escola.
      const [daCoordenacao, doProfessor, alunos] = await executarNoContexto({ ...forjado, escolaId: b.coordenacao.escolaId }, consultar)
      expect(daCoordenacao).toEqual(expect.objectContaining({ id: b.turma }))
      expect(doProfessor).toEqual(expect.objectContaining({ id: b.turma }))
      expect(alunos.map((aluno) => aluno.usuarioId)).toEqual(b.alunosDoB)
    })
  })
})
