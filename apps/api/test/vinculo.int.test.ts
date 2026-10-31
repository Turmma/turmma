import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from './test-api.js'
import { alunosNaTurma, montarEscolaComTurma, type EscolaComTurma } from './escola-turma.fixture.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao.fixture.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Texto que o professor escreve no complemento: o teste procura por ele na auditoria e no log. */
const COMPLEMENTO_MARCADO = `dou só a eletiva ${randomUUID()}`

interface AuditoriaGravada {
  readonly acao: string
  readonly entidade: string
  readonly entidade_id: string
  readonly autor_usuario_id: string | null
  readonly antes: unknown
  readonly depois: unknown
  readonly finalidade: string | null
}

describe('vínculo: a coordenação cria, o professor confirma ou contesta, a coordenação encerra (RF3, RF4, RF19)', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: ApiDeTeste

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const post = (sessao: SessaoDeTeste, caminho: string, corpo?: unknown): Promise<RespostaHttp> => chamar(api.url, 'POST', caminho, sessao.token, corpo)
  const get = (sessao: SessaoDeTeste, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, sessao.token)

  async function professorDe(escola: EscolaComTurma): Promise<SessaoDeTeste> {
    return bancada.sessao(escola.coordenacao.escolaId, 'professor')
  }

  async function vincular(escola: EscolaComTurma, professor: SessaoDeTeste, disciplinaId?: string, turmaId = escola.turma): Promise<string> {
    const resposta = await post(escola.coordenacao, '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId, papel: 'professor', ...(disciplinaId === undefined ? {} : { disciplinaId }) })
    expect(resposta.status).toBe(201)
    return resposta.corpo['id'] as string
  }

  async function linhaDoVinculo(id: string): Promise<Record<string, unknown>> {
    const { rows } = await bancada.pool.query<Record<string, unknown>>(
      'select estado, contestacao, complemento, criado_por, decidido_em, motivo_encerramento, encerrado_em from vinculo where id = $1',
      [id],
    )
    const [linha] = rows
    if (linha === undefined) throw new Error('vínculo não encontrado')
    return linha
  }

  async function auditoriaDe(entidadeId: string): Promise<AuditoriaGravada[]> {
    const { rows } = await bancada.pool.query<AuditoriaGravada>(
      'select acao, entidade, entidade_id, autor_usuario_id, antes, depois, finalidade from auditoria where entidade_id = $1 order by em, id',
      [entidadeId],
    )
    return rows
  }

  async function contarVinculos(escolaId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ total: string }>('select count(*) as total from vinculo where escola_id = $1', [escolaId])
    return Number(rows[0]?.total)
  }

  it('caminho feliz: professor com Química e Física no 2ºB confirma uma e contesta a outra; cada vínculo fica no seu estado, com autor e data', async () => {
    const escola = await montarEscolaComTurma(api, bancada)
    const professor = await professorDe(escola)

    const criado = await post(escola.coordenacao, '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId: escola.turma, disciplinaId: escola.quimica, papel: 'professor' })
    expect(criado.status).toBe(201)
    expect(criado.corpo).toEqual({
      id: expect.stringMatching(UUID),
      usuarioId: professor.usuarioId,
      papel: 'professor',
      turma: { id: escola.turma, nome: '2ºB' },
      disciplina: { id: escola.quimica, nome: 'Química' },
      estado: 'pendente',
    })
    const quimica = criado.corpo['id'] as string
    const fisica = await vincular(escola, professor, escola.fisica)

    for (const id of [quimica, fisica]) {
      expect(await linhaDoVinculo(id)).toMatchObject({ estado: 'pendente', criado_por: escola.coordenacao.usuarioId, decidido_em: null })
      expect(await auditoriaDe(id)).toEqual([
        {
          acao: 'vinculo.criado',
          entidade: 'vinculo',
          entidade_id: id,
          autor_usuario_id: escola.coordenacao.usuarioId,
          antes: null,
          depois: { usuarioId: professor.usuarioId, turmaId: escola.turma, disciplinaId: id === quimica ? escola.quimica : escola.fisica, papel: 'professor', estado: 'pendente' },
          finalidade: null,
        },
      ])
    }

    const confirmado = await post(professor, `/v1/vinculos/${quimica}/confirmar`)
    expect(confirmado.status).toBe(200)
    expect(confirmado.corpo).toEqual({ id: quimica, turma: { id: escola.turma, nome: '2ºB' }, disciplina: { id: escola.quimica, nome: 'Química' }, estado: 'confirmado', decididoEm: expect.any(String) })

    const contestado = await post(professor, `/v1/vinculos/${fisica}/contestar`, { contestacao: 'disciplina_errada', complemento: COMPLEMENTO_MARCADO })
    expect(contestado.status).toBe(200)
    expect(contestado.corpo).toEqual({
      id: fisica,
      turma: { id: escola.turma, nome: '2ºB' },
      disciplina: { id: escola.fisica, nome: 'Física' },
      estado: 'contestado',
      contestacao: 'disciplina_errada',
      decididoEm: expect.any(String),
    })

    expect(await linhaDoVinculo(quimica)).toMatchObject({ estado: 'confirmado', contestacao: null, complemento: null, decidido_em: expect.any(Date) })
    expect(await linhaDoVinculo(fisica)).toMatchObject({ estado: 'contestado', contestacao: 'disciplina_errada', complemento: COMPLEMENTO_MARCADO, decidido_em: expect.any(Date) })
    expect((await auditoriaDe(quimica)).at(-1)).toEqual({
      acao: 'vinculo.confirmado',
      entidade: 'vinculo',
      entidade_id: quimica,
      autor_usuario_id: professor.usuarioId,
      antes: { estado: 'pendente' },
      depois: { estado: 'confirmado' },
      finalidade: null,
    })
    expect((await auditoriaDe(fisica)).at(-1)).toEqual({
      acao: 'vinculo.contestado',
      entidade: 'vinculo',
      entidade_id: fisica,
      autor_usuario_id: professor.usuarioId,
      antes: { estado: 'pendente' },
      depois: { estado: 'contestado', contestacao: 'disciplina_errada' },
      finalidade: null,
    })

    // A coordenação acha a contestação pelo estado, com o complemento; a Química confirmada não vem no filtro.
    const contestados = await get(escola.coordenacao, '/v1/vinculos?estado=contestado')
    expect(contestados.status).toBe(200)
    expect(contestados.corpo).toEqual({
      itens: [
        {
          id: fisica,
          usuarioId: professor.usuarioId,
          papel: 'professor',
          turma: { id: escola.turma, nome: '2ºB' },
          disciplina: { id: escola.fisica, nome: 'Física' },
          estado: 'contestado',
          contestacao: 'disciplina_errada',
          complemento: COMPLEMENTO_MARCADO,
          decididoEm: expect.any(String),
        },
      ],
    })
    expect(((await get(escola.coordenacao, '/v1/vinculos')).corpo['itens'] as Array<{ id: string }>).map((item) => item.id)).toEqual([quimica, fisica])
  })

  it('o professor vê os dois vínculos em `meus-vinculos`, sem o complemento; e confirmar depois de contestar apaga o código e o complemento', async () => {
    const escola = await montarEscolaComTurma(api, bancada)
    const professor = await professorDe(escola)
    const colega = await professorDe(escola)
    const quimica = await vincular(escola, professor, escola.quimica)
    const fisica = await vincular(escola, professor, escola.fisica)
    await vincular(escola, colega, escola.quimica, escola.outraTurma)
    expect((await post(professor, `/v1/vinculos/${fisica}/contestar`, { contestacao: 'outro', complemento: COMPLEMENTO_MARCADO })).status).toBe(200)

    const meus = await get(professor, '/v1/meus-vinculos')
    expect(meus.status).toBe(200)
    expect(meus.corpo).toEqual({
      itens: [
        { id: quimica, turma: { id: escola.turma, nome: '2ºB' }, disciplina: { id: escola.quimica, nome: 'Química' }, estado: 'pendente' },
        { id: fisica, turma: { id: escola.turma, nome: '2ºB' }, disciplina: { id: escola.fisica, nome: 'Física' }, estado: 'contestado', contestacao: 'outro', decididoEm: expect.any(String) },
      ],
    })
    expect(JSON.stringify(meus.corpo)).not.toContain(COMPLEMENTO_MARCADO)

    const paginaUm = await get(professor, '/v1/meus-vinculos?limite=1')
    expect(paginaUm.corpo).toEqual({ itens: [expect.objectContaining({ id: quimica })], proxima: quimica })
    expect((await get(professor, `/v1/meus-vinculos?limite=1&pagina=${quimica}`)).corpo).toEqual({ itens: [expect.objectContaining({ id: fisica })] })

    const reconsiderado = await post(professor, `/v1/vinculos/${fisica}/confirmar`)
    expect(reconsiderado.status).toBe(200)
    expect(reconsiderado.corpo['estado']).toBe('confirmado')
    expect(reconsiderado.corpo).not.toHaveProperty('contestacao')
    expect(await linhaDoVinculo(fisica)).toMatchObject({ estado: 'confirmado', contestacao: null, complemento: null })
    expect((await auditoriaDe(fisica)).at(-1)).toMatchObject({ acao: 'vinculo.confirmado', antes: { estado: 'contestado' } })
  })

  it('concorrência: clique duplo em confirmar (dois POST paralelos) faz um `update` e uma auditoria', async () => {
    const escola = await montarEscolaComTurma(api, bancada)
    const professor = await professorDe(escola)
    const id = await vincular(escola, professor, escola.quimica)

    const respostas = await Promise.all([post(professor, `/v1/vinculos/${id}/confirmar`), post(professor, `/v1/vinculos/${id}/confirmar`)])

    expect(respostas.map((resposta) => resposta.status)).toEqual([200, 200])
    expect(respostas.map((resposta) => resposta.corpo['estado'])).toEqual(['confirmado', 'confirmado'])
    // O segundo devolve o que o primeiro gravou: a mesma data de decisão, sem um segundo `update`.
    expect(respostas[0]?.corpo['decididoEm']).toBe(respostas[1]?.corpo['decididoEm'])
    expect((await auditoriaDe(id)).map((registro) => registro.acao)).toEqual(['vinculo.criado', 'vinculo.confirmado'])
  })

  it('concorrência: o mesmo vínculo criado duas vezes em paralelo resulta em um só, com e sem disciplina', async () => {
    const escola = await montarEscolaComTurma(api, bancada)
    const professor = await professorDe(escola)
    const antes = await contarVinculos(escola.coordenacao.escolaId)

    for (const disciplina of [{ disciplinaId: escola.quimica }, {}]) {
      const corpo = { usuarioId: professor.usuarioId, turmaId: escola.turma, papel: 'professor', ...disciplina }
      const respostas = await Promise.all([post(escola.coordenacao, '/v1/vinculos', corpo), post(escola.coordenacao, '/v1/vinculos', corpo)])
      expect(respostas.map((resposta) => resposta.status).sort()).toEqual([201, 409])
      expect(respostas.find((resposta) => resposta.status === 409)?.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
    }

    expect(await contarVinculos(escola.coordenacao.escolaId)).toBe(antes + 2)
    const { rows } = await bancada.pool.query<{ total: string }>("select count(*) as total from auditoria where escola_id = $1 and acao = 'vinculo.criado'", [escola.coordenacao.escolaId])
    expect(Number(rows[0]?.total)).toBe(2)
  })

  it('o vínculo encerrado libera a mesma alocação de novo: o índice único vale só fora do encerrado', async () => {
    const escola = await montarEscolaComTurma(api, bancada)
    const professor = await professorDe(escola)
    const primeiro = await vincular(escola, professor, escola.quimica)
    expect((await post(escola.coordenacao, `/v1/vinculos/${primeiro}/encerrar`, { motivo: 'realocacao' })).status).toBe(200)
    expect(await vincular(escola, professor, escola.quimica)).not.toBe(primeiro)
  })

  describe('estados', () => {
    it('contestar um confirmado e decidir um encerrado dão CONFLITO, sem mudar nada', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const professor = await professorDe(escola)
      const confirmado = await vincular(escola, professor, escola.quimica)
      const encerrado = await vincular(escola, professor, escola.fisica)
      expect((await post(professor, `/v1/vinculos/${confirmado}/confirmar`)).status).toBe(200)
      expect((await post(escola.coordenacao, `/v1/vinculos/${encerrado}/encerrar`, { motivo: 'realocacao' })).status).toBe(200)

      const tentativas = [
        await post(professor, `/v1/vinculos/${confirmado}/contestar`, { contestacao: 'nao_leciono' }),
        await post(professor, `/v1/vinculos/${encerrado}/confirmar`),
        await post(professor, `/v1/vinculos/${encerrado}/contestar`, { contestacao: 'nao_leciono' }),
      ]
      for (const tentativa of tentativas) {
        expect(tentativa.status).toBe(409)
        expect(tentativa.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
      }
      expect(await linhaDoVinculo(confirmado)).toMatchObject({ estado: 'confirmado', contestacao: null })
      expect(await linhaDoVinculo(encerrado)).toMatchObject({ estado: 'encerrado', motivo_encerramento: 'realocacao', decidido_em: null })
    })

    it('encerrar: `desligamento` e `realocacao` valem, `fim_do_ano` é só da virada; o segundo clique responde o vínculo como está, com uma auditoria', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const professor = await professorDe(escola)
      const id = await vincular(escola, professor, escola.quimica)
      expect((await post(professor, `/v1/vinculos/${id}/confirmar`)).status).toBe(200)

      for (const invalido of [{ motivo: 'fim_do_ano' }, { motivo: 'desligamento', escolaId: randomUUID() }, {}]) {
        const resposta = await post(escola.coordenacao, `/v1/vinculos/${id}/encerrar`, invalido)
        expect(resposta.status, JSON.stringify(invalido)).toBe(400)
        expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
      }

      const [primeiro, segundo] = await Promise.all([
        post(escola.coordenacao, `/v1/vinculos/${id}/encerrar`, { motivo: 'desligamento' }),
        post(escola.coordenacao, `/v1/vinculos/${id}/encerrar`, { motivo: 'desligamento' }),
      ])
      expect([primeiro?.status, segundo?.status]).toEqual([200, 200])
      expect(primeiro?.corpo).toMatchObject({ id, estado: 'encerrado', motivoEncerramento: 'desligamento' })
      expect(await linhaDoVinculo(id)).toMatchObject({ estado: 'encerrado', motivo_encerramento: 'desligamento', encerrado_em: expect.any(Date) })
      const registros = await auditoriaDe(id)
      expect(registros.map((registro) => registro.acao)).toEqual(['vinculo.criado', 'vinculo.confirmado', 'vinculo.encerrado'])
      expect(registros.at(-1)).toMatchObject({ autor_usuario_id: escola.coordenacao.usuarioId, antes: { estado: 'confirmado' }, depois: { estado: 'encerrado', motivo: 'desligamento' } })
    })

    it('criar: a pessoa precisa ser professor alocável da escola (13.0); coordenador, aluno, desativado sem convite e papel de aluno dão 404 ou 400, e nada nasce', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const aluno = await bancada.sessao(escola.coordenacao.escolaId, 'aluno')
      const desativado = await professorDe(escola)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [desativado.usuarioId])
      const antes = await contarVinculos(escola.coordenacao.escolaId)

      for (const usuarioId of [escola.coordenacao.usuarioId, aluno.usuarioId, desativado.usuarioId, randomUUID()]) {
        const resposta = await post(escola.coordenacao, '/v1/vinculos', { usuarioId, turmaId: escola.turma, papel: 'professor' })
        expect(resposta.status).toBe(404)
        expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)
      }
      for (const invalido of [
        { usuarioId: aluno.usuarioId, turmaId: escola.turma, papel: 'aluno' },
        { usuarioId: aluno.usuarioId, turmaId: escola.turma, papel: 'professor', estado: 'confirmado' },
        { usuarioId: aluno.usuarioId, turmaId: escola.turma, papel: 'professor', anoLetivoId: escola.anoLetivoId },
      ]) {
        const resposta = await post(escola.coordenacao, '/v1/vinculos', invalido)
        expect(resposta.status).toBe(400)
        expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
      }
      expect(await contarVinculos(escola.coordenacao.escolaId)).toBe(antes)
    })

    it('sem ano letivo em curso, o vínculo falha fechado: criar, listar e `meus-vinculos` respondem como inexistente', async () => {
      const coordenacao = await bancada.escolaComSessao('coordenador')
      const professor = await bancada.sessao(coordenacao.escolaId, 'professor')
      const respostas = [
        await post(coordenacao, '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId: randomUUID(), papel: 'professor' }),
        await get(coordenacao, '/v1/vinculos'),
        await get(professor, '/v1/meus-vinculos'),
      ]
      for (const resposta of respostas) {
        expect(resposta.status).toBe(404)
        expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)
      }
    })

    it('`GET /v1/vinculos` pagina: `limite` corta e `proxima` continua, sem repetir nem pular', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const professor = await professorDe(escola)
      const ids = [await vincular(escola, professor, escola.quimica), await vincular(escola, professor, escola.fisica), await vincular(escola, professor, escola.quimica, escola.outraTurma)]
      const primeira = await get(escola.coordenacao, '/v1/vinculos?limite=2')
      expect((primeira.corpo['itens'] as Array<{ id: string }>).map((item) => item.id)).toEqual(ids.slice(0, 2))
      expect(primeira.corpo['proxima']).toBe(ids[1])
      const segunda = await get(escola.coordenacao, `/v1/vinculos?limite=2&pagina=${String(primeira.corpo['proxima'])}`)
      expect(segunda.corpo).toEqual({ itens: [expect.objectContaining({ id: ids[2] })] })
      expect((await get(escola.coordenacao, '/v1/vinculos?estado=nenhum')).status).toBe(400)
    })

    it('`GET /v1/vinculos` traz só vínculo de professor; o de aluno da mesma turma não aparece e, por id, é o 404 do inexistente (10.4)', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const [aluno] = await alunosNaTurma(bancada, escola, escola.turma, 1)
      const professor = await professorDe(escola)
      const doProfessor = await vincular(escola, professor, escola.quimica)
      expect((await post(professor, `/v1/vinculos/${doProfessor}/confirmar`)).status).toBe(200)
      const { rows } = await bancada.pool.query<{ id: string }>("select id from vinculo where usuario_id = $1 and papel = 'aluno'", [aluno])
      const doAluno = rows[0]?.id ?? ''
      expect(doAluno).toMatch(UUID)

      for (const consulta of ['', '?estado=confirmado']) {
        const lista = await get(escola.coordenacao, `/v1/vinculos${consulta}`)
        expect(lista.status).toBe(200)
        expect((lista.corpo['itens'] as Array<{ id: string; usuarioId: string }>).map((item) => item.id), consulta).toEqual([doProfessor])
        expect(JSON.stringify(lista.corpo)).not.toContain(aluno)
      }
      const statusECodigo = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
      const encerrarDoAluno = await post(escola.coordenacao, `/v1/vinculos/${doAluno}/encerrar`, { motivo: 'realocacao' })
      expect(statusECodigo(encerrarDoAluno)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(statusECodigo(encerrarDoAluno)).toEqual(statusECodigo(await post(escola.coordenacao, `/v1/vinculos/${randomUUID()}/encerrar`, { motivo: 'realocacao' })))
      expect(await linhaDoVinculo(doAluno)).toEqual(expect.objectContaining({ estado: 'confirmado', motivo_encerramento: null }))
      expect(await auditoriaDe(doAluno)).toEqual([])
    })
  })

  describe('permissão: o vínculo é da escola, e o professor só confirma o próprio', () => {
    it('professor não cria, não lista e não encerra vínculo; coordenação não confirma nem contesta; aluno não alcança nada', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const professor = await professorDe(escola)
      const aluno = await bancada.sessao(escola.coordenacao.escolaId, 'aluno')
      const id = await vincular(escola, professor, escola.quimica)
      const antes = await contarVinculos(escola.coordenacao.escolaId)

      const recusadas = [
        await post(professor, '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId: escola.outraTurma, papel: 'professor' }),
        await get(professor, '/v1/vinculos'),
        await post(professor, `/v1/vinculos/${id}/encerrar`, { motivo: 'realocacao' }),
        await post(escola.coordenacao, `/v1/vinculos/${id}/confirmar`),
        await post(escola.coordenacao, `/v1/vinculos/${id}/contestar`, { contestacao: 'outro' }),
        await get(escola.coordenacao, '/v1/meus-vinculos'),
        await get(aluno, '/v1/meus-vinculos'),
        await post(aluno, `/v1/vinculos/${id}/confirmar`),
      ]
      for (const recusada of recusadas) {
        expect(recusada.status).toBe(404)
        expect(recusada.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)
      }
      expect(await contarVinculos(escola.coordenacao.escolaId)).toBe(antes)
      expect(await linhaDoVinculo(id)).toMatchObject({ estado: 'pendente', decidido_em: null })
    })

    it('o professor que confirma ou contesta o vínculo de um colega recebe o mesmo 404 do inexistente, e nada muda', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const dono = await professorDe(escola)
      const colega = await professorDe(escola)
      const id = await vincular(escola, dono, escola.quimica)
      const semRequisicao = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })

      const doColega = [await post(colega, `/v1/vinculos/${id}/confirmar`), await post(colega, `/v1/vinculos/${id}/contestar`, { contestacao: 'nao_leciono' })]
      const inexistente = await post(colega, `/v1/vinculos/${randomUUID()}/confirmar`)
      for (const resposta of doColega) expect(semRequisicao(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(semRequisicao(inexistente)).toEqual(semRequisicao(doColega[0] as RespostaHttp))
      expect(await linhaDoVinculo(id)).toMatchObject({ estado: 'pendente', decidido_em: null })
      expect((await get(colega, '/v1/meus-vinculos')).corpo).toEqual({ itens: [] })
    })
  })

  describe('privacidade do complemento (regra 20, itens 4 e 9)', () => {
    it('o complemento vai só à coordenação: nunca à auditoria, nunca ao log, e passa de 140 caracteres dá ENTRADA_INVALIDA', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const professor = await professorDe(escola)
      const id = await vincular(escola, professor, escola.quimica)

      for (const invalido of [
        { contestacao: 'outro', complemento: 'x'.repeat(141) },
        { contestacao: 'outro', complemento: '   ' },
        { contestacao: 'nao_sei' },
        { complemento: 'sem código' },
      ]) {
        const resposta = await post(professor, `/v1/vinculos/${id}/contestar`, invalido)
        expect(resposta.status).toBe(400)
        expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
      }
      expect((await post(professor, `/v1/vinculos/${id}/contestar`, { contestacao: 'outro', complemento: 'y'.repeat(140) })).status).toBe(200)

      linhasDeLog.length = 0
      expect((await post(professor, `/v1/vinculos/${id}/contestar`, { contestacao: 'turma_errada', complemento: COMPLEMENTO_MARCADO })).status).toBe(200)
      expect((await get(escola.coordenacao, '/v1/vinculos?estado=contestado')).corpo['itens']).toEqual([expect.objectContaining({ id, complemento: COMPLEMENTO_MARCADO })])

      expect(linhasDeLog.length).toBeGreaterThan(0)
      expect(linhasDeLog.join('\n')).not.toContain(COMPLEMENTO_MARCADO)
      const { rows } = await bancada.pool.query<{ texto: string }>('select row_to_json(a)::text as texto from auditoria a where escola_id = $1', [escola.coordenacao.escolaId])
      expect(rows.length).toBeGreaterThan(0)
      for (const { texto } of rows) {
        expect(texto).not.toContain(COMPLEMENTO_MARCADO)
        expect(texto).not.toContain('y'.repeat(140))
      }
    })
  })
})
