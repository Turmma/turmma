import { executarNoContexto } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { DisciplinaRepository } from '../src/estrutura/disciplina/disciplina.repository.js'
import { TurmaRepository } from '../src/estrutura/turma/turma.repository.js'
import { VinculoRepository } from '../src/estrutura/vinculo/vinculo.repository.js'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from './api-com-sessao.js'
import { alunosNaTurma, montarEscolaComTurma, type EscolaComTurma } from './escola-com-turma.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/** O status e o código do erro: o `requisicaoId` muda a cada chamada, e o resto precisa ser idêntico. */
const semRequisicao = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo, mensagem: (resposta.corpo.erro as { mensagem?: string } | undefined)?.mensagem })

const NAO_ENCONTRADO = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO, mensagem: expect.any(String) }

const FINALIDADE = 'acompanhamento_pedagogico'

describe('acesso à turma: só o vínculo confirmado abre a turma e os alunos (RF5, RF15)', () => {
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

  const post = (sessao: SessaoDeTeste | string, caminho: string, corpo?: unknown): Promise<RespostaHttp> =>
    chamar(api.url, 'POST', caminho, typeof sessao === 'string' ? sessao : sessao.token, corpo)
  const get = (sessao: SessaoDeTeste | string, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, typeof sessao === 'string' ? sessao : sessao.token)

  async function vincular(escola: EscolaComTurma, usuarioId: string, turmaId = escola.turma, disciplinaId = escola.quimica): Promise<string> {
    const resposta = await post(escola.coordenacao, '/v1/vinculos', { usuarioId, turmaId, disciplinaId, papel: 'professor' })
    expect(resposta.status).toBe(201)
    return resposta.corpo['id'] as string
  }

  async function confirmar(professor: SessaoDeTeste | string, id: string): Promise<void> {
    expect((await post(professor, `/v1/vinculos/${id}/confirmar`)).status).toBe(200)
  }

  async function leiturasDeAlunos(escolaId: string): Promise<Array<{ entidade_id: string; autor_usuario_id: string; depois: unknown; finalidade: string }>> {
    const { rows } = await bancada.pool.query<{ entidade_id: string; autor_usuario_id: string; depois: unknown; finalidade: string }>(
      "select entidade_id, autor_usuario_id, depois, finalidade from auditoria where escola_id = $1 and acao = 'turma.alunos_lidos' order by em, id",
      [escolaId],
    )
    return rows
  }

  it('borda: com vínculo pendente e contestado, `/turmas/:id` e `/alunos` dão o 404 da turma inexistente; confirmado, respondem com o dado', async () => {
    const escola = await montarEscolaComTurma(api, bancada)
    const alunos = await alunosNaTurma(bancada, escola, escola.turma, 2)
    const pendente = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
    const contestando = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
    await vincular(escola, pendente.usuarioId)
    const contestado = await vincular(escola, contestando.usuarioId)
    expect((await post(contestando, `/v1/vinculos/${contestado}/contestar`, { contestacao: 'nao_leciono' })).status).toBe(200)

    const inexistente = randomUUID()
    for (const professor of [pendente, contestando]) {
      for (const sufixo of ['', '/alunos']) {
        const daTurma = await get(professor, `/v1/turmas/${escola.turma}${sufixo}`)
        expect(semRequisicao(daTurma)).toEqual(NAO_ENCONTRADO)
        expect(semRequisicao(daTurma)).toEqual(semRequisicao(await get(professor, `/v1/turmas/${inexistente}${sufixo}`)))
      }
    }

    await confirmar(contestando, contestado)
    const turma = await get(contestando, `/v1/turmas/${escola.turma}`)
    expect(turma.status).toBe(200)
    expect(turma.corpo).toEqual({ id: escola.turma, nome: '2ºB', serie: { id: escola.serieId, etapa: 'em', ano: 2 } })
    const lista = await get(contestando, `/v1/turmas/${escola.turma}/alunos`)
    expect(lista.status).toBe(200)
    expect(lista.corpo).toEqual({ itens: alunos.map((usuarioId, posicao) => ({ usuarioId, nome: `Aluno sintético ${String(posicao + 1)}` })) })
    // O vínculo confirmado de um não abre a turma para o outro, que continua pendente.
    expect(semRequisicao(await get(pendente, `/v1/turmas/${escola.turma}`))).toEqual(NAO_ENCONTRADO)
    // O professor lê a própria turma sem finalidade e sem registro: a auditoria é da leitura da coordenação.
    expect(await leiturasDeAlunos(escola.coordenacao.escolaId)).toEqual([])
  })

  it('borda: vínculo encerrado com a sessão aberta; a requisição seguinte a `/turmas/:id` já dá 404', async () => {
    const escola = await montarEscolaComTurma(api, bancada)
    await alunosNaTurma(bancada, escola, escola.turma, 1)
    const professor = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
    const id = await vincular(escola, professor.usuarioId)
    await confirmar(professor, id)
    expect((await get(professor, `/v1/turmas/${escola.turma}`)).status).toBe(200)
    expect((await get(professor, `/v1/turmas/${escola.turma}/alunos`)).status).toBe(200)

    expect((await post(escola.coordenacao, `/v1/vinculos/${id}/encerrar`, { motivo: 'realocacao' })).status).toBe(200)

    // O mesmo token, a mesma sessão: nada venceu, e mesmo assim a turma sumiu.
    expect(semRequisicao(await get(professor, `/v1/turmas/${escola.turma}`))).toEqual(NAO_ENCONTRADO)
    expect(semRequisicao(await get(professor, `/v1/turmas/${escola.turma}/alunos`))).toEqual(NAO_ENCONTRADO)
    expect((await get(professor, '/v1/meus-vinculos')).status).toBe(200)
  })

  it('o vínculo de aluno e o confirmado em outra turma não abrem a turma para o professor', async () => {
    const escola = await montarEscolaComTurma(api, bancada)
    const professor = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
    await confirmar(professor, await vincular(escola, professor.usuarioId, escola.outraTurma))
    // Um vínculo de aluno confirmado do professor na turma, que nenhuma rota cria, também não serve de passe.
    await bancada.pool.query(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5)`,
      [escola.coordenacao.escolaId, escola.anoLetivoId, professor.usuarioId, escola.turma, escola.coordenacao.usuarioId],
    )
    expect(semRequisicao(await get(professor, `/v1/turmas/${escola.turma}`))).toEqual(NAO_ENCONTRADO)
    expect((await get(professor, `/v1/turmas/${escola.outraTurma}`)).status).toBe(200)
  })

  it('`/alunos` traz só os alunos confirmados daquela turma: nem os da outra turma, nem o transferido (encerrado), nem o pendente', async () => {
    const escola = await montarEscolaComTurma(api, bancada)
    const doB = await alunosNaTurma(bancada, escola, escola.turma, 2)
    const doC = await alunosNaTurma(bancada, escola, escola.outraTurma, 2)
    // O transferido no meio do bimestre continua ativo na escola, com o vínculo do 2ºB encerrado; o pendente ainda não foi aceito.
    const [transferido, pendente] = (await bancada.sessoes(escola.coordenacao.escolaId, { papel: 'aluno', quantidade: 2 })).map((aluno) => aluno.usuarioId)
    await bancada.pool.query(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, motivo_encerramento, encerrado_em, criado_por)
       values ($1, $2, $3, $4, 'aluno', 'encerrado', 'realocacao', now(), $5), ($1, $2, $6, $4, 'aluno', 'pendente', null, null, $5)`,
      [escola.coordenacao.escolaId, escola.anoLetivoId, transferido, escola.turma, escola.coordenacao.usuarioId, pendente],
    )
    const professor = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
    await confirmar(professor, await vincular(escola, professor.usuarioId))
    const ids = (resposta: RespostaHttp) => (resposta.corpo['itens'] as Array<{ usuarioId: string }>).map((aluno) => aluno.usuarioId)

    expect(ids(await get(professor, `/v1/turmas/${escola.turma}/alunos`))).toEqual(doB)
    expect(ids(await get(escola.coordenacao, `/v1/turmas/${escola.turma}/alunos?finalidade=${FINALIDADE}`))).toEqual(doB)
    expect(ids(await get(escola.coordenacao, `/v1/turmas/${escola.outraTurma}/alunos?finalidade=${FINALIDADE}`))).toEqual(doC)
  })

  it('professor com duas disciplinas na turma: encerrada uma, a outra confirmada continua abrindo a turma', async () => {
    const escola = await montarEscolaComTurma(api, bancada)
    const professor = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
    const quimica = await vincular(escola, professor.usuarioId, escola.turma, escola.quimica)
    const fisica = await vincular(escola, professor.usuarioId, escola.turma, escola.fisica)
    await confirmar(professor, quimica)
    await confirmar(professor, fisica)

    expect((await post(escola.coordenacao, `/v1/vinculos/${fisica}/encerrar`, { motivo: 'realocacao' })).status).toBe(200)
    expect((await get(professor, `/v1/turmas/${escola.turma}`)).status).toBe(200)
    expect((await post(escola.coordenacao, `/v1/vinculos/${quimica}/encerrar`, { motivo: 'realocacao' })).status).toBe(200)
    expect(semRequisicao(await get(professor, `/v1/turmas/${escola.turma}`))).toEqual(NAO_ENCONTRADO)
  })

  it('sem ano letivo em curso, a turma, os alunos e as decisões do vínculo falham fechados com o 404', async () => {
    const escola = await montarEscolaComTurma(api, bancada)
    const professor = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
    const id = await vincular(escola, professor.usuarioId)
    await confirmar(professor, id)
    expect((await post(escola.coordenacao, `/v1/anos-letivos/${escola.anoLetivoId}/encerrar`)).status).toBe(200)

    const respostas = [
      await get(escola.coordenacao, `/v1/turmas/${escola.turma}`),
      await get(escola.coordenacao, `/v1/turmas/${escola.turma}/alunos?finalidade=${FINALIDADE}`),
      await get(professor, `/v1/turmas/${escola.turma}`),
      await get(professor, `/v1/turmas/${escola.turma}/alunos`),
      await post(professor, `/v1/vinculos/${id}/confirmar`),
      await post(professor, `/v1/vinculos/${id}/contestar`, { contestacao: 'outro' }),
      await post(escola.coordenacao, `/v1/vinculos/${id}/encerrar`, { motivo: 'desligamento' }),
    ]
    for (const resposta of respostas) expect(semRequisicao(resposta)).toEqual(NAO_ENCONTRADO)
    expect(await leiturasDeAlunos(escola.coordenacao.escolaId)).toEqual([])
  })

  describe('permissão', () => {
    it('turma sem professor: a coordenação lê; o professor de outra turma e o aluno dão 404', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const alunos = await alunosNaTurma(bancada, escola, escola.outraTurma, 1)
      const professor = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
      const aluno = await bancada.sessao(escola.coordenacao.escolaId, 'aluno')
      await confirmar(professor, await vincular(escola, professor.usuarioId))

      expect((await get(escola.coordenacao, `/v1/turmas/${escola.outraTurma}`)).corpo).toEqual({ id: escola.outraTurma, nome: '2ºC', serie: expect.objectContaining({ id: escola.serieId }) })
      expect((await get(escola.coordenacao, `/v1/turmas/${escola.outraTurma}/alunos?finalidade=${FINALIDADE}`)).corpo).toEqual({
        itens: [{ usuarioId: alunos[0], nome: 'Aluno sintético 1' }],
      })
      for (const sessao of [professor, aluno]) {
        for (const sufixo of ['', '/alunos', `/alunos?finalidade=${FINALIDADE}`]) {
          expect(semRequisicao(await get(sessao, `/v1/turmas/${escola.outraTurma}${sufixo}`))).toEqual(NAO_ENCONTRADO)
        }
      }
    })
  })

  describe('privacidade da lista de alunos (regra 20, itens 4, 5 e 10)', () => {
    it('`/alunos` da coordenação sem `finalidade` dá ENTRADA_INVALIDA sem registro; com ela, grava a auditoria e pagina', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const alunos = await alunosNaTurma(bancada, escola, escola.turma, 3)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [alunos[1]])
      const ativos = [alunos[0], alunos[2]]

      for (const consulta of ['', '?finalidade=curiosidade', `?finalidade=${FINALIDADE}&escolaId=${randomUUID()}`]) {
        const resposta = await get(escola.coordenacao, `/v1/turmas/${escola.turma}/alunos${consulta}`)
        expect(resposta.status, consulta).toBe(400)
        expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
      }
      expect(await leiturasDeAlunos(escola.coordenacao.escolaId)).toEqual([])

      const primeira = await get(escola.coordenacao, `/v1/turmas/${escola.turma}/alunos?finalidade=${FINALIDADE}&limite=1`)
      expect(primeira.status).toBe(200)
      expect(primeira.corpo).toEqual({ itens: [{ usuarioId: ativos[0], nome: 'Aluno sintético 1' }], proxima: ativos[0] })
      const segunda = await get(escola.coordenacao, `/v1/turmas/${escola.turma}/alunos?finalidade=atendimento_a_familia&limite=1&pagina=${String(primeira.corpo['proxima'])}`)
      // O desativado não aparece: fim de vínculo corta o acesso e a listagem (regra 20, item 18).
      expect(segunda.corpo).toEqual({ itens: [{ usuarioId: ativos[1], nome: 'Aluno sintético 3' }] })

      expect(await leiturasDeAlunos(escola.coordenacao.escolaId)).toEqual([
        { entidade_id: escola.turma, autor_usuario_id: escola.coordenacao.usuarioId, depois: { quantidade: 1 }, finalidade: FINALIDADE },
        { entidade_id: escola.turma, autor_usuario_id: escola.coordenacao.usuarioId, depois: { quantidade: 1 }, finalidade: 'atendimento_a_familia' },
      ])
      // A leitura de uma turma inexistente não grava nada, e responde como inexistente.
      expect(semRequisicao(await get(escola.coordenacao, `/v1/turmas/${randomUUID()}/alunos?finalidade=${FINALIDADE}`))).toEqual(NAO_ENCONTRADO)
      expect(await leiturasDeAlunos(escola.coordenacao.escolaId)).toHaveLength(2)
    })
  })

  describe('isolamento entre escolas (regra 10; Tech Spec, seção 6)', () => {
    interface EscolaComVinculo extends EscolaComTurma {
      readonly professor: SessaoDeTeste
      readonly vinculo: string
      readonly pendente: string
      readonly alunos: readonly string[]
    }

    let a: EscolaComVinculo
    let b: EscolaComVinculo

    /** Uma escola com o professor confirmado em Química no 2ºB, um vínculo pendente em Física e dois alunos. */
    async function montar(): Promise<EscolaComVinculo> {
      const escola = await montarEscolaComTurma(api, bancada)
      const alunos = await alunosNaTurma(bancada, escola, escola.turma, 2)
      const professor = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
      const vinculo = await vincular(escola, professor.usuarioId)
      await confirmar(professor, vinculo)
      const pendente = await vincular(escola, professor.usuarioId, escola.turma, escola.fisica)
      return { ...escola, professor, vinculo, pendente, alunos }
    }

    async function estadoDe(escola: EscolaComTurma): Promise<unknown> {
      const { rows } = await bancada.pool.query('select id, usuario_id, turma_id, disciplina_id, estado, contestacao, motivo_encerramento from vinculo where escola_id = $1 order by id', [
        escola.coordenacao.escolaId,
      ])
      return rows
    }

    beforeAll(async () => {
      a = await montar()
      b = await montar()
    })

    it('criar vínculo com `turma_id`, `usuario_id` ou `disciplina_id` de B dá o mesmo 404 do inexistente, e nada nasce em A nem em B', async () => {
      const antesEmA = await estadoDe(a)
      const antesEmB = await estadoDe(b)
      const professorDeA = await bancada.sessao(a.coordenacao.escolaId, 'professor')
      const base = { usuarioId: professorDeA.usuarioId, turmaId: a.turma, disciplinaId: a.fisica, papel: 'professor' }

      const comB = [
        await post(a.coordenacao, '/v1/vinculos', { ...base, turmaId: b.turma }),
        await post(a.coordenacao, '/v1/vinculos', { ...base, usuarioId: b.professor.usuarioId }),
        await post(a.coordenacao, '/v1/vinculos', { ...base, disciplinaId: b.fisica }),
      ]
      const inexistentes = [
        await post(a.coordenacao, '/v1/vinculos', { ...base, turmaId: randomUUID() }),
        await post(a.coordenacao, '/v1/vinculos', { ...base, usuarioId: randomUUID() }),
        await post(a.coordenacao, '/v1/vinculos', { ...base, disciplinaId: randomUUID() }),
      ]
      for (const [posicao, resposta] of comB.entries()) {
        expect(semRequisicao(resposta)).toEqual(NAO_ENCONTRADO)
        expect(semRequisicao(resposta)).toEqual(semRequisicao(inexistentes[posicao] as RespostaHttp))
      }
      expect(await estadoDe(a)).toEqual(antesEmA)
      expect(await estadoDe(b)).toEqual(antesEmB)
      // O mesmo pedido só com ids de A cria: o 404 veio do id de B.
      expect((await post(a.coordenacao, '/v1/vinculos', base)).status).toBe(201)
    })

    it('`vinculos/:id/*` e `turmas/:id` com id de B dão o mesmo 404 do inexistente, e nada muda em B', async () => {
      const antesEmB = await estadoDe(b)
      const inexistente = randomUUID()
      const pedidos: Array<[SessaoDeTeste, 'GET' | 'POST', (id: string) => string, unknown]> = [
        [a.coordenacao, 'POST', (id) => `/v1/vinculos/${id}/encerrar`, { motivo: 'desligamento' }],
        [a.professor, 'POST', (id) => `/v1/vinculos/${id}/confirmar`, undefined],
        [a.professor, 'POST', (id) => `/v1/vinculos/${id}/contestar`, { contestacao: 'outro' }],
      ]
      for (const [sessao, metodo, caminho, corpo] of pedidos) {
        const comB = await chamar(api.url, metodo, caminho(b.pendente), sessao.token, corpo)
        expect(semRequisicao(comB), caminho('B')).toEqual(NAO_ENCONTRADO)
        expect(semRequisicao(comB)).toEqual(semRequisicao(await chamar(api.url, metodo, caminho(inexistente), sessao.token, corpo)))
      }
      for (const sessao of [a.coordenacao, a.professor]) {
        for (const sufixo of ['', `/alunos?finalidade=${FINALIDADE}`]) {
          const comB = await get(sessao, `/v1/turmas/${b.turma}${sufixo}`)
          expect(semRequisicao(comB)).toEqual(NAO_ENCONTRADO)
          expect(semRequisicao(comB)).toEqual(semRequisicao(await get(sessao, `/v1/turmas/${inexistente}${sufixo}`)))
        }
      }
      expect(await estadoDe(b)).toEqual(antesEmB)
      expect(await leiturasDeAlunos(a.coordenacao.escolaId)).toEqual([])
    })

    it('com as linhas de B existindo, `GET /v1/vinculos` de A e `meus-vinculos` do professor de A não trazem nada de B', async () => {
      const deA = ((await get(a.coordenacao, '/v1/vinculos')).corpo['itens'] as Array<{ id: string; turma: { id: string } }>) ?? []
      const meus = ((await get(a.professor, '/v1/meus-vinculos')).corpo['itens'] as Array<{ id: string }>) ?? []
      expect(deA.map((item) => item.id)).toEqual(expect.arrayContaining([a.vinculo, a.pendente]))
      expect(meus.map((item) => item.id)).toEqual([a.vinculo, a.pendente])
      for (const deB of [b.vinculo, b.pendente]) expect([...deA, ...meus].map((item) => item.id)).not.toContain(deB)
      expect(deA.every((item) => item.turma.id === a.turma || item.turma.id === a.outraTurma)).toBe(true)
    })

    it('o escopo de escola vale sozinho: com o ano e o usuário de B num contexto de A, nenhum repository alcança B', async () => {
      // Contexto forjado: escola A com o ano letivo e o professor de B. Só a cláusula de escola separa as duas; sem ela,
      // cada consulta abaixo traria a linha de B.
      const forjado = { requisicaoId: randomUUID(), escolaId: a.coordenacao.escolaId, usuarioId: b.professor.usuarioId, papel: 'professor' as const, sessaoId: randomUUID(), anoLetivoId: b.anoLetivoId }
      const antesEmB = await estadoDe(b)
      const resultado = await executarNoContexto(forjado, async () => {
        const turmas = new TurmaRepository(bancada.banco)
        const vinculos = new VinculoRepository(bancada.banco)
        const naTransacao = await bancada.banco.transaction(async (tx) => {
          const escrita = new VinculoRepository(tx)
          return {
            travado: await escrita.travar(b.pendente, { doUsuario: true }),
            travadoPelaCoordenacao: await escrita.travar(b.pendente, { doUsuario: false }),
            decidido: await escrita.decidir(b.pendente, { estado: 'confirmado' }),
            encerrado: await escrita.encerrar(b.pendente, 'desligamento'),
          }
        })
        return {
          turmaDaCoordenacao: await turmas.aberta(b.turma, 'unidade'),
          turmaDoProfessor: await turmas.aberta(b.turma, 'turma_vinculada'),
          alunos: await turmas.alunos(b.turma, { limite: 50 }),
          lista: await vinculos.listar({ limite: 50 }),
          meus: await vinculos.listarDoUsuario({ limite: 50 }),
          porId: await vinculos.porId(b.vinculo),
          porIdDoUsuario: await vinculos.porIdDoUsuario(b.vinculo),
          professor: await vinculos.professorAlocavel(b.professor.usuarioId),
          disciplina: await new DisciplinaRepository(bancada.banco).porId(b.quimica),
          ...naTransacao,
        }
      })
      expect(resultado).toEqual({
        turmaDaCoordenacao: undefined,
        turmaDoProfessor: undefined,
        alunos: [],
        lista: [],
        meus: [],
        porId: undefined,
        porIdDoUsuario: undefined,
        professor: false,
        disciplina: undefined,
        travado: undefined,
        travadoPelaCoordenacao: undefined,
        decidido: false,
        encerrado: false,
      })
      expect(await estadoDe(b)).toEqual(antesEmB)

      // O controle: o mesmo contexto com a escola de B alcança tudo isso, então o vazio acima veio da escola.
      const deB = await executarNoContexto({ ...forjado, escolaId: b.coordenacao.escolaId }, async () => ({
        turma: await new TurmaRepository(bancada.banco).aberta(b.turma, 'turma_vinculada'),
        alunos: (await new TurmaRepository(bancada.banco).alunos(b.turma, { limite: 50 })).length,
        meus: (await new VinculoRepository(bancada.banco).listarDoUsuario({ limite: 50 })).length,
        professor: await new VinculoRepository(bancada.banco).professorAlocavel(b.professor.usuarioId),
      }))
      expect(deB).toEqual({ turma: expect.objectContaining({ id: b.turma }), alunos: 2, meus: 2, professor: true })
    })

    it('o banco recusa o vínculo de A com a turma, o usuário ou a disciplina de B, e com a turma de outro ano: as FKs compostas são a segunda camada', async () => {
      const cliente = new pg.Client({ connectionString: urlDoBancoDeTeste() })
      await cliente.connect()
      const planejado = await post(a.coordenacao, '/v1/anos-letivos', { ano: 2027, inicio: '2027-02-01', fim: '2027-12-15' })
      expect(planejado.status).toBe(201)
      try {
        const inserir = (anoLetivoId: string, turmaId: string, usuarioId: string, disciplinaId: string | null) =>
          cliente
            .query(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, criado_por) values ($1, $2, $3, $4, $5, 'professor', $6)`, [
              a.coordenacao.escolaId,
              anoLetivoId,
              usuarioId,
              turmaId,
              disciplinaId,
              a.coordenacao.usuarioId,
            ])
            .then(
              () => undefined,
              (falha: { code?: string; constraint?: string }) => ({ codigo: falha.code, restricao: falha.constraint }),
            )
        const professorDeA = await bancada.sessao(a.coordenacao.escolaId, 'professor')
        expect(await inserir(b.anoLetivoId, b.turma, professorDeA.usuarioId, a.quimica)).toEqual({ codigo: '23503', restricao: 'vinculo_turma_do_ano_da_escola_fk' })
        expect(await inserir(a.anoLetivoId, a.turma, b.professor.usuarioId, a.quimica)).toEqual({ codigo: '23503', restricao: 'vinculo_usuario_da_escola_fk' })
        expect(await inserir(a.anoLetivoId, a.turma, professorDeA.usuarioId, b.quimica)).toEqual({ codigo: '23503', restricao: 'vinculo_disciplina_da_escola_fk' })
        expect(await inserir(planejado.corpo['id'] as string, a.turma, professorDeA.usuarioId, a.quimica)).toEqual({ codigo: '23503', restricao: 'vinculo_turma_do_ano_da_escola_fk' })
        // O controle: com tudo de A, a linha entra.
        expect(await inserir(a.anoLetivoId, a.outraTurma, professorDeA.usuarioId, a.quimica)).toBeUndefined()
      } finally {
        await cliente.end()
      }
    })

    it('professor que sai em março da escola A (vínculo `desligamento`) perde a turma de A e continua lendo a turma de B, onde tem vínculo confirmado', async () => {
      const deA = await bancada.sessao(a.coordenacao.escolaId, 'professor')
      const tokenEmB = await bancada.sessaoDaMesmaConta(deA.usuarioId, b.coordenacao.escolaId)
      const { rows } = await bancada.pool.query<{ id: string }>(
        "select u.id from usuario u join usuario origem on origem.conta_id = u.conta_id where origem.id = $1 and u.escola_id = $2 and u.papel = 'professor'",
        [deA.usuarioId, b.coordenacao.escolaId],
      )
      const emB = rows[0]?.id ?? ''
      const vinculoEmA = await vincular(a, deA.usuarioId, a.outraTurma)
      await confirmar(deA, vinculoEmA)
      await confirmar(tokenEmB, await vincular(b, emB, b.outraTurma))
      expect((await get(deA, `/v1/turmas/${a.outraTurma}`)).status).toBe(200)
      expect((await get(tokenEmB, `/v1/turmas/${b.outraTurma}`)).status).toBe(200)

      expect((await post(a.coordenacao, `/v1/vinculos/${vinculoEmA}/encerrar`, { motivo: 'desligamento' })).status).toBe(200)

      expect(semRequisicao(await get(deA, `/v1/turmas/${a.outraTurma}`))).toEqual(NAO_ENCONTRADO)
      expect(semRequisicao(await get(deA, `/v1/turmas/${a.outraTurma}/alunos`))).toEqual(NAO_ENCONTRADO)
      const emBDepois = await get(tokenEmB, `/v1/turmas/${b.outraTurma}`)
      expect(emBDepois.status).toBe(200)
      expect(emBDepois.corpo['id']).toBe(b.outraTurma)
      // Da sessão de B, a turma de A continua inexistente, e vice-versa.
      expect(semRequisicao(await get(tokenEmB, `/v1/turmas/${a.outraTurma}`))).toEqual(NAO_ENCONTRADO)
      expect(semRequisicao(await get(deA, `/v1/turmas/${b.outraTurma}`))).toEqual(NAO_ENCONTRADO)
    })
  })
})
