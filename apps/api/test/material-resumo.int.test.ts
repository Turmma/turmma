import { AuditoriaRepository, runInContext, type Clock } from '@educa/core'
import { ErrorCode, MOTIVOS_DA_RECUSA_QUE_O_RESUMO_CONTA, resumoDoMaterialResponseSchema, type ResumoDoMaterialResponse } from '@educa/shared'
import { type SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { chamar, subirApi, type TestApi, type RespostaHttp } from './test-api.js'
import { montarEscolaComTurma as montarEscola, type EscolaComTurma } from './escola-turma.fixture.js'
import { apagarMateriais, auditoriaDa, enviarEdicaoDeMaterial, enviarMaterial, esperarExtracao, pdfCorrompido, registrarLicencaDeTeste, variacaoDoPdf } from './material.fixture.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { TEST_APP_OPTIONS } from './test-config.js'

const DIA_MS = 24 * 60 * 60_000

/**
 * O resumo do material (ingestao-do-material, tarefa 11.0; Tech Spec, seções 4, 7 e 7c; PRD, RF18 e RF20; `cenarios.md`, "Resumo", "Permissão…" e "Isolamento"): por disciplina e série, quantos materiais estão prontos,
 * processando e com falha, quantos envios foram recusados nos últimos 30 dias e quantos materiais estão sem série. As recusas vêm da auditoria (`material.recusado`) e a janela é contada do mesmo `Clock` do serviço (o
 * `relogioDasLicencas`), que o teste adianta; o `em` da recusa é o do banco, e a folga de um dia para cada lado do corte (29 e 31 dias) é o que não depende de a máquina estar calma.
 */
describe('resumo do material da escola', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  const escolasDoTeste: string[] = []
  const relogio: Clock & { fixo: Date | undefined } = { fixo: undefined, agora: () => relogio.fixo ?? new Date() }

  async function montarEscolaComTurma(): Promise<EscolaComTurma> {
    const escola = await montarEscola(api, bancada)
    escolasDoTeste.push(escola.coordenacao.escolaId)
    return escola
  }

  const get = (sessao: TestSessao, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, sessao.token)
  const post = (sessao: TestSessao, caminho: string, corpo?: unknown): Promise<RespostaHttp> => chamar(api.url, 'POST', caminho, sessao.token, corpo)
  const del = (sessao: TestSessao, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'DELETE', caminho, sessao.token)
  const erroDe = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })

  /** O resumo como a coordenação o lê: 200 e o contrato inteiro, que é estrito. */
  async function resumoDe(sessao: TestSessao): Promise<ResumoDoMaterialResponse> {
    const resposta = await get(sessao, '/v1/materiais/resumo')
    expect(resposta.status).toBe(200)
    return resumoDoMaterialResponseSchema.parse(resposta.corpo)
  }

  /** A linha da disciplina e da série (nula: a linha sem série), ou `undefined` se a escola não tem nada nela. */
  const linhaDe = (resumo: ResumoDoMaterialResponse, disciplinaId: string, serieId: string | null) => resumo.linhas.find((linha) => linha.disciplinaId === disciplinaId && linha.serieId === serieId)

  /** Uma série a mais na escola: o 3º ano do EM. */
  async function novaSerie(escola: EscolaComTurma): Promise<string> {
    const criada = await post(escola.coordenacao, '/v1/series', { etapa: 'em', ano: 3 })
    expect(criada.status).toBe(201)
    return criada.corpo['id'] as string
  }

  /** Envia um PDF diferente a cada vez (o mesmo arquivo na escola é `CONFLITO`) e devolve o id. A extração é de quem chama. */
  async function enviar(escola: EscolaComTurma, disciplinaId: string, serieIds: readonly string[], arquivo: Buffer = variacaoDoPdf()): Promise<string> {
    const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId, serieIds }, { arquivo })
    expect(enviado.status).toBe(201)
    return enviado.corpo['id'] as string
  }

  /** Um material `pronto`: enviado e extraído. */
  async function materialPronto(escola: EscolaComTurma, disciplinaId: string, serieIds: readonly string[]): Promise<string> {
    const id = await enviar(escola, disciplinaId, serieIds)
    await esperarExtracao(api)
    return id
  }

  /** Uma recusa pela licença: sem a licença que o formulário exige (`MATERIAL_SEM_LICENCA`), sem arquivo. */
  async function recusaSemLicenca(escola: EscolaComTurma, disciplinaId: string, serieIds: readonly string[]): Promise<void> {
    const resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId, serieIds, licenca: 'sem_licenca' }, { arquivo: null })
    expect(erroDe(resposta)).toEqual({ status: 422, codigo: ErrorCode.MATERIAL_SEM_LICENCA })
  }

  /** O dia (UTC) a tantos dias de agora, como a coluna `date` da licença o recebe. */
  const diaDaquiA = (dias: number): string => new Date(Date.now() + dias * DIA_MS).toISOString().slice(0, 10)

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, [], { ...TEST_APP_OPTIONS, relogioDasLicencas: relogio })
  })

  afterEach(() => {
    relogio.fixo = undefined
  })

  afterAll(async () => {
    await api.app.close()
    await apagarMateriais(bancada, escolasDoTeste)
    await bancada.fechar()
    await medidor.encerrar()
  })

  describe('os materiais por disciplina e série', () => {
    it('o material com duas séries conta nas duas, e cada disciplina fica na sua linha', async () => {
      const escola = await montarEscolaComTurma()
      const terceiroAno = await novaSerie(escola)
      await materialPronto(escola, escola.quimica, [escola.serieId, terceiroAno])
      await materialPronto(escola, escola.fisica, [escola.serieId])

      const resumo = await resumoDe(escola.coordenacao)
      expect(linhaDe(resumo, escola.quimica, escola.serieId)).toMatchObject({ pronto: 1, processando: 0, falhou: 0, recusados30Dias: 0 })
      expect(linhaDe(resumo, escola.quimica, terceiroAno)).toMatchObject({ pronto: 1, processando: 0, falhou: 0, recusados30Dias: 0 })
      // A Física tem um só, na série dela: a de Química, que cobre a mesma série, não entra na conta.
      expect(linhaDe(resumo, escola.fisica, escola.serieId)).toMatchObject({ pronto: 1 })
      expect(linhaDe(resumo, escola.fisica, terceiroAno)).toBeUndefined()
      expect(resumo.linhas).toHaveLength(3)
      expect(resumo.semSerie).toBe(0)
    })

    it('cada estado conta na sua coluna: pronto, processando e falhou', async () => {
      const escola = await montarEscolaComTurma()
      await materialPronto(escola, escola.quimica, [escola.serieId])
      await enviar(escola, escola.quimica, [escola.serieId], pdfCorrompido())
      await esperarExtracao(api)
      // O terceiro fica `processando`: o worker não rodou depois do envio dele.
      await enviar(escola, escola.quimica, [escola.serieId])

      expect(linhaDe(await resumoDe(escola.coordenacao), escola.quimica, escola.serieId)).toMatchObject({ pronto: 1, processando: 1, falhou: 1 })
      await esperarExtracao(api)
    })

    it('o material excluído não conta', async () => {
      const escola = await montarEscolaComTurma()
      const ficou = await materialPronto(escola, escola.quimica, [escola.serieId])
      const saiu = await materialPronto(escola, escola.quimica, [escola.serieId])
      expect(linhaDe(await resumoDe(escola.coordenacao), escola.quimica, escola.serieId)).toMatchObject({ pronto: 2 })

      expect((await del(escola.coordenacao, `/v1/materiais/${saiu}`)).status).toBe(204)
      expect(linhaDe(await resumoDe(escola.coordenacao), escola.quimica, escola.serieId)).toMatchObject({ pronto: 1 })
      expect(ficou).not.toBe(saiu)
    })

    it('o material substituído não conta: a anterior segue até a edição ficar pronta, e a edição em andamento é `processando`', async () => {
      const escola = await montarEscolaComTurma()
      const anterior = await materialPronto(escola, escola.quimica, [escola.serieId])
      const edicao = await enviarEdicaoDeMaterial(api, escola.coordenacao, anterior, { edicao: '2ª edição' }, variacaoDoPdf())
      expect(edicao.status).toBe(201)
      expect(linhaDe(await resumoDe(escola.coordenacao), escola.quimica, escola.serieId)).toMatchObject({ pronto: 1, processando: 1 })

      await esperarExtracao(api)
      // A extração da edição marcou a anterior como substituída: sobra a nova, pronta.
      expect(linhaDe(await resumoDe(escola.coordenacao), escola.quimica, escola.serieId)).toMatchObject({ pronto: 1, processando: 0, falhou: 0 })
    })

    it('o material sem série conta em `semSerie`, na linha sem série da disciplina: a soma é a de todos, e não um por linha', async () => {
      const escola = await montarEscolaComTurma()
      await materialPronto(escola, escola.fisica, [escola.serieId])
      const semSerie = [await materialPronto(escola, escola.quimica, [escola.serieId]), await materialPronto(escola, escola.quimica, [escola.serieId])]
      const daFisica = await materialPronto(escola, escola.fisica, [escola.serieId])
      // Como a migração deixou o material da escola que ainda não tinha série: dois da Química (uma linha com total 2) e um da Física (outra linha), de modo que a soma de `semSerie` (3) não é a de linhas (2) nem a de um material.
      for (const id of [...semSerie, daFisica]) await bancada.pool.query('delete from material_serie where escola_id = $1 and material_id = $2', [escola.coordenacao.escolaId, id])

      const resumo = await resumoDe(escola.coordenacao)
      expect(resumo.semSerie).toBe(3)
      expect(linhaDe(resumo, escola.quimica, null)).toMatchObject({ pronto: 2, processando: 0, falhou: 0, recusados30Dias: 0 })
      expect(linhaDe(resumo, escola.fisica, null)).toMatchObject({ pronto: 1 })
      expect(linhaDe(resumo, escola.quimica, escola.serieId)).toBeUndefined()
      expect(linhaDe(resumo, escola.fisica, escola.serieId)).toMatchObject({ pronto: 1 })
    })
  })

  describe('os envios recusados em 30 dias', () => {
    it('a recusa de 29 dias atrás conta e a de 31 não, pelo mesmo `Clock` do serviço', async () => {
      const escola = await montarEscolaComTurma()
      await recusaSemLicenca(escola, escola.quimica, [escola.serieId])

      expect(linhaDe(await resumoDe(escola.coordenacao), escola.quimica, escola.serieId)).toMatchObject({ pronto: 0, recusados30Dias: 1 })
      relogio.fixo = new Date(Date.now() + 29 * DIA_MS)
      expect(linhaDe(await resumoDe(escola.coordenacao), escola.quimica, escola.serieId)).toMatchObject({ recusados30Dias: 1 })
      relogio.fixo = new Date(Date.now() + 31 * DIA_MS)
      const depois = await resumoDe(escola.coordenacao)
      // Sem material nem recusa na janela, a linha deixa de existir: o resumo só lista onde há o que contar.
      expect(linhaDe(depois, escola.quimica, escola.serieId)).toBeUndefined()
    })

    it('`MATERIAL_SEM_LICENCA` (sem licença e sem declaração) e `LICENCA_VENCIDA` contam; a licença inexistente, que responde `NAO_ENCONTRADO`, não', async () => {
      const escola = await montarEscolaComTurma()
      const { quimica, fisica, coordenacao } = escola
      const biologia = ((await post(coordenacao, '/v1/disciplinas', { nome: 'Biologia' })).corpo['id'] as string)
      const geografia = ((await post(coordenacao, '/v1/disciplinas', { nome: 'Geografia' })).corpo['id'] as string)
      const historia = ((await post(coordenacao, '/v1/disciplinas', { nome: 'História' })).corpo['id'] as string)
      const serieIds = [escola.serieId]

      // Uma disciplina por motivo: a que deixasse de contar o motivo ficaria sem linha.
      await recusaSemLicenca(escola, quimica, serieIds)
      const semDeclaracao = await enviarMaterial(api, coordenacao, { disciplinaId: fisica, serieIds, declaracao: 'false' }, { arquivo: null })
      expect(erroDe(semDeclaracao)).toEqual({ status: 422, codigo: ErrorCode.MATERIAL_SEM_LICENCA })
      const licencaId = await registrarLicencaDeTeste(api, coordenacao, { vigenteAte: diaDaquiA(10) })
      relogio.fixo = new Date(Date.now() + 12 * DIA_MS)
      const vencida = await enviarMaterial(api, coordenacao, { disciplinaId: biologia, serieIds, titularidade: 'terceiro_com_licenca', licenca: 'licenca_aberta', licencaId })
      expect(erroDe(vencida)).toEqual({ status: 422, codigo: ErrorCode.LICENCA_VENCIDA })
      const inexistente = await enviarMaterial(api, coordenacao, { disciplinaId: geografia, serieIds, titularidade: 'terceiro_com_licenca', licenca: 'licenca_aberta', licencaId: randomUUID() })
      expect(erroDe(inexistente)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      // A auditoria guardou as quatro, e o resumo só conta as três que a coordenação entende como "recusado por licença".
      expect((await auditoriaDa(bancada, coordenacao.escolaId, 'material.recusado')).map((registro) => (registro.depois as { motivo: string }).motivo).sort()).toEqual(['licenca_inexistente', 'licenca_vencida', 'sem_declaracao', 'sem_licenca'])

      const resumo = await resumoDe(coordenacao)
      expect(linhaDe(resumo, quimica, escola.serieId)).toMatchObject({ recusados30Dias: 1 })
      expect(linhaDe(resumo, fisica, escola.serieId)).toMatchObject({ recusados30Dias: 1 })
      expect(linhaDe(resumo, biologia, escola.serieId)).toMatchObject({ recusados30Dias: 1 })
      expect(linhaDe(resumo, geografia, escola.serieId)).toBeUndefined()
      expect(linhaDe(resumo, historia, escola.serieId)).toBeUndefined()
      expect(resumo.linhas).toHaveLength(3)
    })

    it('a recusa cai na série que ela conferiu: uma série, só nela; duas, em cada uma', async () => {
      const escola = await montarEscolaComTurma()
      const terceiroAno = await novaSerie(escola)
      await recusaSemLicenca(escola, escola.quimica, [terceiroAno])
      await recusaSemLicenca(escola, escola.fisica, [escola.serieId, terceiroAno])

      const resumo = await resumoDe(escola.coordenacao)
      expect(linhaDe(resumo, escola.quimica, terceiroAno)).toMatchObject({ recusados30Dias: 1 })
      expect(linhaDe(resumo, escola.quimica, escola.serieId)).toBeUndefined()
      expect(linhaDe(resumo, escola.fisica, escola.serieId)).toMatchObject({ recusados30Dias: 1 })
      expect(linhaDe(resumo, escola.fisica, terceiroAno)).toMatchObject({ recusados30Dias: 1 })
    })

    it('a recusa sem série, da edição de um material que a migração deixou sem nenhuma, conta na linha sem série', async () => {
      const escola = await montarEscolaComTurma()
      const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao, { vigenteAte: diaDaquiA(10) })
      const enviado = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, serieIds: [escola.serieId], titularidade: 'terceiro_com_licenca', licenca: 'licenca_aberta', licencaId }, { arquivo: variacaoDoPdf() })
      expect(enviado.status).toBe(201)
      const alvo = enviado.corpo['id'] as string
      await esperarExtracao(api)
      await bancada.pool.query('delete from material_serie where escola_id = $1 and material_id = $2', [escola.coordenacao.escolaId, alvo])
      relogio.fixo = new Date(Date.now() + 12 * DIA_MS)

      const edicao = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, {}, variacaoDoPdf())
      expect(erroDe(edicao)).toEqual({ status: 422, codigo: ErrorCode.LICENCA_VENCIDA })
      expect((await auditoriaDa(bancada, escola.coordenacao.escolaId, 'material.recusado')).map((registro) => (registro.depois as { serieIds: string[] }).serieIds)).toEqual([[]])

      expect(linhaDe(await resumoDe(escola.coordenacao), escola.quimica, null)).toMatchObject({ pronto: 1, recusados30Dias: 1 })
    })

    it('só conta o registro `material.recusado`: outra ação com o mesmo formato de `depois` não entra', async () => {
      const escola = await montarEscolaComTurma()
      await bancada.pool.query(
        `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, depois, requisicao_id)
         values ($1, $2, 'material.enviado', 'disciplina', $3, $4::jsonb, $5)`,
        [escola.coordenacao.escolaId, escola.coordenacao.usuarioId, escola.quimica, JSON.stringify({ motivo: 'sem_licenca', serieIds: [escola.serieId] }), randomUUID()],
      )
      await recusaSemLicenca(escola, escola.fisica, [escola.serieId])

      const resumo = await resumoDe(escola.coordenacao)
      expect(linhaDe(resumo, escola.fisica, escola.serieId)).toMatchObject({ recusados30Dias: 1 })
      expect(linhaDe(resumo, escola.quimica, escola.serieId)).toBeUndefined()
    })

    /** O SQL que `recusasDeMaterialDesde` manda ao banco (texto e parâmetros), capturado no executor: é a consulta de produção, e não uma parecida escrita aqui. */
    async function sqlDaConsultaDeProducao(escolaId: string, desde: Date, motivos: readonly string[]): Promise<{ sql: string; params: unknown[] }> {
      const capturadas: SQL[] = []
      const executor = {
        execute: (consulta: SQL) => {
          capturadas.push(consulta)
          return bancada.banco.execute(consulta)
        },
      } as unknown as ConstructorParameters<typeof AuditoriaRepository>[0]
      await runInContext({ requisicaoId: randomUUID(), escolaId }, () => new AuditoriaRepository(executor).recusasDeMaterialDesde(desde, motivos))
      const [consulta] = capturadas
      if (capturadas.length !== 1 || consulta === undefined) throw new Error('o repository devia mandar uma consulta só')
      return new PgDialect().sqlToQuery(consulta)
    }

    it('o índice parcial da recusa serve à consulta que o resumo manda ao banco: com a varredura da tabela desligada, o plano o usa', async () => {
      const escola = await montarEscolaComTurma()
      await recusaSemLicenca(escola, escola.quimica, [escola.serieId])
      const consulta = await sqlDaConsultaDeProducao(escola.coordenacao.escolaId, new Date(Date.now() - 30 * DIA_MS), MOTIVOS_DA_RECUSA_QUE_O_RESUMO_CONTA)
      const cliente = await bancada.pool.connect()
      try {
        await cliente.query('begin')
        await cliente.query('set local enable_seqscan = off')
        const plano = await cliente.query<{ 'QUERY PLAN': string }>(`explain ${consulta.sql}`, consulta.params)
        expect(plano.rows.map((linha) => linha['QUERY PLAN']).join('\n')).toContain('auditoria_material_recusado_idx')
        // E ele é parcial, na ação que o resumo lê: um índice da escola e do instante de toda a auditoria seria usado do mesmo jeito, e custaria o tamanho da tabela.
        const definicao = await cliente.query<{ indexdef: string }>("select indexdef from pg_indexes where indexname = 'auditoria_material_recusado_idx'")
        expect(definicao.rows[0]?.indexdef).toMatch(/\(escola_id, em\) WHERE .*material\.recusado/)
        await cliente.query('rollback')
      } finally {
        cliente.release()
      }
    })

    it('sem nenhum motivo a contar, a resposta é vazia, sem consulta ao banco', async () => {
      const escola = await montarEscolaComTurma()
      await recusaSemLicenca(escola, escola.quimica, [escola.serieId])
      let consultas = 0
      const executor = {
        execute: () => {
          consultas += 1
          return Promise.reject(new Error('a consulta não devia sair'))
        },
      } as unknown as ConstructorParameters<typeof AuditoriaRepository>[0]

      const contadas = await runInContext({ requisicaoId: randomUUID(), escolaId: escola.coordenacao.escolaId }, () => new AuditoriaRepository(executor).recusasDeMaterialDesde(new Date(0), []))

      expect(contadas).toEqual([])
      expect(consultas).toBe(0)
    })

    it('só conta o registro cuja entidade é a disciplina: um `material.recusado` de outra entidade não entra no resumo', async () => {
      const escola = await montarEscolaComTurma()
      await recusaSemLicenca(escola, escola.quimica, [escola.serieId])
      const naoDisciplina = randomUUID()
      // Pela porta única nada grava essa linha (a ação fixa a entidade `disciplina`): é o registro que um dia gravasse outra coisa com o mesmo nome de ação.
      await bancada.pool.query(
        `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, depois, requisicao_id)
         values ($1, $2, 'material.recusado', 'material', $3, $4::jsonb, $5)`,
        [escola.coordenacao.escolaId, escola.coordenacao.usuarioId, naoDisciplina, JSON.stringify({ serieIds: [escola.serieId], motivo: 'sem_licenca' }), randomUUID()],
      )

      const resumo = await resumoDe(escola.coordenacao)
      expect(resumo.linhas.some((linha) => linha.disciplinaId === naoDisciplina)).toBe(false)
      expect(linhaDe(resumo, escola.quimica, escola.serieId)).toMatchObject({ recusados30Dias: 1 })
    })
  })

  describe('isolamento e permissão', () => {
    it('o resumo da A não leva material, recusa nem material sem série da B', async () => {
      const a = await montarEscolaComTurma()
      const b = await montarEscolaComTurma()
      await materialPronto(a, a.quimica, [a.serieId])
      await recusaSemLicenca(a, a.fisica, [a.serieId])
      const daB = await materialPronto(b, b.quimica, [b.serieId])
      await recusaSemLicenca(b, b.fisica, [b.serieId])
      await recusaSemLicenca(b, b.quimica, [b.serieId])
      await bancada.pool.query('delete from material_serie where escola_id = $1 and material_id = $2', [b.coordenacao.escolaId, daB])

      const resumoA = await resumoDe(a.coordenacao)
      expect(resumoA.semSerie).toBe(0)
      expect(resumoA.linhas.map((linha) => linha.disciplinaId).sort()).toEqual([a.quimica, a.fisica].sort())
      expect(linhaDe(resumoA, a.quimica, a.serieId)).toMatchObject({ pronto: 1, recusados30Dias: 0 })
      expect(linhaDe(resumoA, a.fisica, a.serieId)).toMatchObject({ pronto: 0, recusados30Dias: 1 })
      const resumoB = await resumoDe(b.coordenacao)
      expect(resumoB.semSerie).toBe(1)
      expect(linhaDe(resumoB, b.quimica, null)).toMatchObject({ pronto: 1, recusados30Dias: 0 })
      expect(linhaDe(resumoB, b.quimica, b.serieId)).toMatchObject({ pronto: 0, recusados30Dias: 1 })
    })

    it('o professor e o aluno recebem o 404 de `NAO_ENCONTRADO`, o mesmo de uma rota que não existe, e o resumo não é lido', async () => {
      const escola = await montarEscolaComTurma()
      await materialPronto(escola, escola.quimica, [escola.serieId])
      const professor = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
      const aluno = await bancada.sessao(escola.coordenacao.escolaId, 'aluno')
      const inexistente = await get(escola.coordenacao, '/v1/rota-que-nao-existe')
      expect(erroDe(inexistente)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })

      for (const quem of [professor, aluno]) {
        const resposta = await get(quem, '/v1/materiais/resumo')
        expect(erroDe(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
        expect(resposta.corpo).not.toHaveProperty('linhas')
        expect({ ...resposta.corpo.erro, requisicaoId: undefined }).toEqual({ ...inexistente.corpo.erro, requisicaoId: undefined })
      }
    })

    it('a coordenação de escola sem ano letivo em curso vê o resumo, vazio', async () => {
      const coordenacao = await bancada.escolaComSessao('coordenador')
      escolasDoTeste.push(coordenacao.escolaId)

      const resumo = await resumoDe(coordenacao)
      expect(resumo).toEqual({ linhas: [], semSerie: 0 })
    })

    it('a resposta só traz ids e contagens: nenhum título, licenciante nem autor', async () => {
      const escola = await montarEscolaComTurma()
      await materialPronto(escola, escola.quimica, [escola.serieId])
      await recusaSemLicenca(escola, escola.quimica, [escola.serieId])

      const resposta = await get(escola.coordenacao, '/v1/materiais/resumo')
      expect(Object.keys(resposta.corpo).sort()).toEqual(['linhas', 'semSerie'])
      const linhas = resposta.corpo['linhas'] as Array<Record<string, unknown>>
      for (const linha of linhas) expect(Object.keys(linha).sort()).toEqual(['disciplinaId', 'falhou', 'processando', 'pronto', 'recusados30Dias', 'serieId'])
    })
  })
})
