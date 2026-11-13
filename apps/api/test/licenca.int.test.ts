import { runInContext, type Clock } from '@educa/core'
import { CicloDeVidaService } from '@educa/core/ciclo-de-vida'
import { ErrorCode, licencaSchema, listaDeLicencasResponseSchema, type Licenca } from '@educa/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { LicencaRepository } from '../src/material/licenca.repository.js'
import { apagarMateriais, auditoriaDa } from './material.fixture.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { TEST_APP_OPTIONS } from './test-config.js'
import { esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'

/**
 * A licença do material de terceiro (ingestao-do-material, 5.0; PRD, RF16, RF17 e RF20; Tech Spec, seções 3, 4 e 6): registrar, listar com a situação do dia e a contagem de materiais, e alterar a
 * vigência, a cobertura e a referência, só pela coordenação. A retenção e o arquivo do titular estão em `apps/worker/test/expurgo-da-escola.int.test.ts` e em `arquivo-do-titular.int.test.ts`, e o
 * backfill, em `packages/core/src/db/migracao-f4.int.test.ts`.
 */
describe('licença do material', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  /** O dia de São Paulo da situação: o teste o avança. */
  const relogio: Clock & { atual: Date } = { atual: new Date('2026-11-12T12:00:00-03:00'), agora: () => relogio.atual }
  let api: TestApi
  const escolasDoTeste: string[] = []

  interface Escola {
    readonly coordenacao: TestSessao
    readonly disciplinaId: string
  }

  const get = (sessao: TestSessao, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, sessao.token)
  const post = (sessao: TestSessao, caminho: string, corpo?: unknown): Promise<RespostaHttp> => chamar(api.url, 'POST', caminho, sessao.token, corpo)
  const patch = (sessao: TestSessao, caminho: string, corpo?: unknown): Promise<RespostaHttp> => chamar(api.url, 'PATCH', caminho, sessao.token, corpo)
  const del = (sessao: TestSessao, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'DELETE', caminho, sessao.token)
  const erroDe = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  /** A resposta sem o id da requisição, que muda a cada chamada: o resto precisa ser idêntico. */
  const semRequisicao = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo, mensagem: (resposta.corpo.erro as { mensagem?: string } | undefined)?.mensagem })

  const LICENCA = { licenciante: 'Editora Exemplo', cobertura: 'Coleção de Química, 2º ano', referencia: 'Contrato 123/2026', vigenteDesde: '2026-02-01' }

  /** Uma escola com a coordenação e uma disciplina (o material precisa dela), e **sem ano letivo**: as rotas da licença não dependem dele. */
  async function escolaNova(): Promise<Escola> {
    const coordenacao = await bancada.escolaComSessao('coordenador')
    escolasDoTeste.push(coordenacao.escolaId)
    const disciplina = await post(coordenacao, '/v1/disciplinas', { nome: 'Química' })
    expect(disciplina.status).toBe(201)
    return { coordenacao, disciplinaId: disciplina.corpo['id'] as string }
  }

  async function registrar(sessao: TestSessao, corpo: Record<string, unknown> = {}): Promise<Licenca> {
    const resposta = await post(sessao, '/v1/licencas', { ...LICENCA, ...corpo })
    expect(resposta.status).toBe(201)
    return licencaSchema.parse(resposta.corpo)
  }

  async function lista(sessao: TestSessao, consulta = ''): Promise<Licenca[]> {
    const resposta = await get(sessao, `/v1/licencas${consulta}`)
    expect(resposta.status).toBe(200)
    return listaDeLicencasResponseSchema.parse(resposta.corpo).itens
  }

  /** Um material de terceiro, gravado direto no banco, que aponta a licença. */
  async function materialDaLicenca(escola: Escola, licencaId: string, { excluido = false }: { excluido?: boolean } = {}): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenciante, licenca, licenca_id, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_por, excluido_em)
       values ($1, $2, 'Material sintético', 'terceiro_com_licenca', 'Editora Exemplo', 'licenca_comercial_autorizada', $3, true, $4, 10, 'pronto', 1, $5, case when $6::boolean then now() end)
       returning id`,
      [escola.coordenacao.escolaId, escola.disciplinaId, licencaId, randomBytes(32).toString('hex'), escola.coordenacao.usuarioId, excluido],
    )
    return rows[0]?.id ?? ''
  }

  async function linhaDaLicenca(id: string) {
    const { rows } = await bancada.pool.query<{ registrada_por: string | null; vigente_desde: string; vigente_ate: string | null; cobertura: string; referencia: string; licenciante: string; alterada_em: Date; registrada_em: Date }>(
      `select registrada_por, vigente_desde::text, vigente_ate::text, cobertura, referencia, licenciante, alterada_em, registrada_em from licenca_de_material where id = $1`,
      [id],
    )
    return rows[0]
  }

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog, { ...TEST_APP_OPTIONS, relogioDasLicencas: relogio })
  })

  afterAll(async () => {
    await api.app.close()
    await apagarMateriais(bancada, escolasDoTeste)
    await bancada.pool.query('delete from licenca_de_material where escola_id = any($1::uuid[])', [escolasDoTeste])
    await bancada.fechar()
    await medidor.encerrar()
  })

  describe('registrar, listar e alterar', () => {
    it('a coordenação registra, lista e altera; a linha guarda quem registrou, e a resposta nunca o diz', async () => {
      const escola = await escolaNova()
      const criada = await post(escola.coordenacao, '/v1/licencas', LICENCA)
      expect(criada.status).toBe(201)
      const licenca = licencaSchema.parse(criada.corpo)
      expect(licenca).toMatchObject({ ...LICENCA, vigenteAte: null, situacao: 'vigente', materiais: 0 })
      expect(Object.keys(criada.corpo)).not.toContain('registradaPor')
      expect(await linhaDaLicenca(licenca.id)).toMatchObject({ registrada_por: escola.coordenacao.usuarioId, vigente_desde: '2026-02-01', vigente_ate: null, licenciante: LICENCA.licenciante })

      expect((await lista(escola.coordenacao)).map((item) => item.id)).toEqual([licenca.id])

      const alterada = await patch(escola.coordenacao, `/v1/licencas/${licenca.id}`, { cobertura: 'Só o 2º ano', vigenteAte: '2027-01-31' })
      expect(alterada.status).toBe(200)
      expect(licencaSchema.parse(alterada.corpo)).toMatchObject({ id: licenca.id, licenciante: LICENCA.licenciante, cobertura: 'Só o 2º ano', referencia: LICENCA.referencia, vigenteDesde: '2026-02-01', vigenteAte: '2027-01-31' })
      const linha = await linhaDaLicenca(licenca.id)
      expect(linha).toMatchObject({ cobertura: 'Só o 2º ano', vigente_ate: '2027-01-31', referencia: LICENCA.referencia })
      expect(linha?.alterada_em.getTime()).toBeGreaterThan(linha?.registrada_em.getTime() ?? Infinity)

      // `vigenteAte: null` tira o fim; o campo que não veio não muda.
      const semFim = await patch(escola.coordenacao, `/v1/licencas/${licenca.id}`, { vigenteAte: null })
      expect(licencaSchema.parse(semFim.corpo)).toMatchObject({ vigenteAte: null, cobertura: 'Só o 2º ano' })

      const registrada = await auditoriaDa(bancada, escola.coordenacao.escolaId, 'licenca.registrada')
      expect(registrada).toEqual([{ entidade: 'licenca', entidade_id: licenca.id, autor_usuario_id: escola.coordenacao.usuarioId, antes: null, depois: { vigenteDesde: '2026-02-01', vigenteAte: null } }])
      const alteradas = await auditoriaDa(bancada, escola.coordenacao.escolaId, 'licenca.alterada')
      expect(alteradas.map(({ antes, depois }) => ({ antes, depois }))).toEqual([
        { antes: { vigenteDesde: '2026-02-01', vigenteAte: null }, depois: { vigenteDesde: '2026-02-01', vigenteAte: '2027-01-31' } },
        { antes: { vigenteDesde: '2026-02-01', vigenteAte: '2027-01-31' }, depois: { vigenteDesde: '2026-02-01', vigenteAte: null } },
      ])
    })

    it('`PATCH` muda cada campo que veio, e só ele: a referência e o começo também, e o que não veio fica', async () => {
      const escola = await escolaNova()
      const licenca = await registrar(escola.coordenacao, { vigenteDesde: '2026-02-01', vigenteAte: '2026-12-31' })
      const resposta = await patch(escola.coordenacao, `/v1/licencas/${licenca.id}`, { referencia: 'Contrato novo', vigenteDesde: '2026-03-01' })
      expect(resposta.status).toBe(200)
      expect(await linhaDaLicenca(licenca.id)).toMatchObject({ referencia: 'Contrato novo', vigente_desde: '2026-03-01', vigente_ate: '2026-12-31', cobertura: LICENCA.cobertura, licenciante: LICENCA.licenciante })
      const soACobertura = await patch(escola.coordenacao, `/v1/licencas/${licenca.id}`, { cobertura: 'Outra cobertura' })
      expect(soACobertura.status).toBe(200)
      expect(await linhaDaLicenca(licenca.id)).toMatchObject({ referencia: 'Contrato novo', vigente_desde: '2026-03-01', vigente_ate: '2026-12-31', cobertura: 'Outra cobertura' })
      // A auditoria leva a vigência que ficou, com o começo novo no `depois`, e nunca o texto da referência nem da cobertura.
      const alteradas = await auditoriaDa(bancada, escola.coordenacao.escolaId, 'licenca.alterada')
      expect(alteradas.map(({ antes, depois }) => ({ antes, depois }))).toEqual([
        { antes: { vigenteDesde: '2026-02-01', vigenteAte: '2026-12-31' }, depois: { vigenteDesde: '2026-03-01', vigenteAte: '2026-12-31' } },
        { antes: { vigenteDesde: '2026-03-01', vigenteAte: '2026-12-31' }, depois: { vigenteDesde: '2026-03-01', vigenteAte: '2026-12-31' } },
      ])
    })

    it('a licença não se exclui: não há `DELETE`', async () => {
      const escola = await escolaNova()
      const licenca = await registrar(escola.coordenacao)
      expect(erroDe(await del(escola.coordenacao, `/v1/licencas/${licenca.id}`))).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(await linhaDaLicenca(licenca.id)).toBeDefined()
    })

    it('a lista é paginada em ordem de id, e a página seguinte começa depois da última', async () => {
      const escola = await escolaNova()
      const criadas = [await registrar(escola.coordenacao), await registrar(escola.coordenacao), await registrar(escola.coordenacao)]
      const primeira = await get(escola.coordenacao, '/v1/licencas?limite=2')
      const pagina = listaDeLicencasResponseSchema.parse(primeira.corpo)
      expect(pagina.itens.map((item) => item.id)).toEqual([criadas[0]?.id, criadas[1]?.id])
      expect(pagina.proxima).toBe(criadas[1]?.id)
      expect((await lista(escola.coordenacao, `?limite=2&pagina=${pagina.proxima ?? ''}`)).map((item) => item.id)).toEqual([criadas[2]?.id])
    })
  })

  describe('situação, pelo dia de São Paulo (RF17)', () => {
    it('uma de cada: `vigente`, `vence_em_30_dias`, `vencida` e `futura`, com o relógio falso em 12/11/2026', async () => {
      relogio.atual = new Date('2026-11-12T12:00:00-03:00')
      const escola = await escolaNova()
      const semFim = await registrar(escola.coordenacao, { vigenteDesde: '2026-01-01' })
      const longe = await registrar(escola.coordenacao, { vigenteDesde: '2026-01-01', vigenteAte: '2026-12-13' })
      const em30 = await registrar(escola.coordenacao, { vigenteDesde: '2026-01-01', vigenteAte: '2026-12-12' })
      const hoje = await registrar(escola.coordenacao, { vigenteDesde: '2026-01-01', vigenteAte: '2026-11-12' })
      const ontem = await registrar(escola.coordenacao, { vigenteDesde: '2026-01-01', vigenteAte: '2026-11-11' })
      const amanha = await registrar(escola.coordenacao, { vigenteDesde: '2026-11-13' })
      const diaDeHoje = await registrar(escola.coordenacao, { vigenteDesde: '2026-11-12' })
      const situacoes = Object.fromEntries((await lista(escola.coordenacao)).map((item) => [item.id, item.situacao]))
      expect(situacoes).toEqual({
        [semFim.id]: 'vigente',
        [longe.id]: 'vigente',
        [em30.id]: 'vence_em_30_dias',
        [hoje.id]: 'vence_em_30_dias',
        [ontem.id]: 'vencida',
        [amanha.id]: 'futura',
        [diaDeHoje.id]: 'vigente',
      })
    })

    it('às 23h de São Paulo do último dia a licença ainda vale, às 0h01 do dia seguinte já venceu, e o `PATCH` que estende a devolve', async () => {
      const escola = await escolaNova()
      const licenca = await registrar(escola.coordenacao, { vigenteDesde: '2026-01-01', vigenteAte: '2026-11-12' })
      // 23h em São Paulo já é o dia seguinte em UTC: quem lê o dia pelo relógio do servidor erra aqui.
      relogio.atual = new Date('2026-11-12T23:00:00-03:00')
      expect((await lista(escola.coordenacao)).find((item) => item.id === licenca.id)?.situacao).toBe('vence_em_30_dias')
      relogio.atual = new Date('2026-11-13T00:01:00-03:00')
      expect((await lista(escola.coordenacao)).find((item) => item.id === licenca.id)?.situacao).toBe('vencida')
      const estendida = await patch(escola.coordenacao, `/v1/licencas/${licenca.id}`, { vigenteAte: '2027-12-31' })
      expect(licencaSchema.parse(estendida.corpo).situacao).toBe('vigente')
      relogio.atual = new Date('2026-11-12T12:00:00-03:00')
    })
  })

  describe('contagem de materiais', () => {
    it('`materiais` conta os da licença que não foram excluídos, e não os de outra licença nem os da outra escola', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const daA1 = await registrar(a.coordenacao)
      const daA2 = await registrar(a.coordenacao)
      const semMaterial = await registrar(a.coordenacao)
      const daB = await registrar(b.coordenacao)
      await materialDaLicenca(a, daA1.id)
      await materialDaLicenca(a, daA1.id)
      await materialDaLicenca(a, daA1.id, { excluido: true })
      await materialDaLicenca(a, daA2.id)
      for (let n = 0; n < 4; n += 1) await materialDaLicenca(b, daB.id)

      const daAEmId = Object.fromEntries((await lista(a.coordenacao)).map((item) => [item.id, item.materiais]))
      expect(daAEmId).toEqual({ [daA1.id]: 2, [daA2.id]: 1, [semMaterial.id]: 0 })
      expect((await lista(b.coordenacao)).map((item) => [item.id, item.materiais])).toEqual([[daB.id, 4]])
    })
  })

  describe('entrada inválida', () => {
    it('o fim antes do começo, os textos fora do tamanho, a data que não existe e o campo de fora: `ENTRADA_INVALIDA`, e nada é gravado', async () => {
      const escola = await escolaNova()
      const invalidos: Array<Record<string, unknown>> = [
        { vigenteDesde: '2026-05-01', vigenteAte: '2026-04-30' },
        { licenciante: '' },
        { licenciante: 'a'.repeat(121) },
        { cobertura: 'a'.repeat(301) },
        { referencia: 'a'.repeat(201) },
        { cobertura: '   ' },
        { vigenteDesde: '2026-02-30' },
        { escolaId: randomUUID() },
        { registradaPor: randomUUID() },
      ]
      for (const invalido of invalidos) expect(erroDe(await post(escola.coordenacao, '/v1/licencas', { ...LICENCA, ...invalido })), JSON.stringify(Object.keys(invalido))).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(await lista(escola.coordenacao)).toEqual([])
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'licenca.registrada')).toEqual([])
    })

    it('`PATCH`: o corpo vazio, o licenciante, o fim antes do começo gravado e o começo depois do fim gravado são `ENTRADA_INVALIDA`, e a linha e a auditoria não mudam', async () => {
      const escola = await escolaNova()
      const licenca = await registrar(escola.coordenacao, { vigenteDesde: '2026-02-01', vigenteAte: '2026-12-31' })
      const antes = await linhaDaLicenca(licenca.id)
      const invalidos: Array<Record<string, unknown>> = [{}, { licenciante: 'Outra editora' }, { vigenteAte: '2026-01-31' }, { vigenteDesde: '2027-01-01' }, { vigenteDesde: '2026-05-01', vigenteAte: '2026-04-30' }, { referencia: '' }]
      for (const invalido of invalidos) expect(erroDe(await patch(escola.coordenacao, `/v1/licencas/${licenca.id}`, invalido)), JSON.stringify(invalido)).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(await linhaDaLicenca(licenca.id)).toEqual(antes)
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'licenca.alterada')).toEqual([])
      // O fim no mesmo dia do começo é válido.
      expect((await patch(escola.coordenacao, `/v1/licencas/${licenca.id}`, { vigenteAte: '2026-02-01' })).status).toBe(200)
    })
  })

  describe('dois `PATCH` da mesma licença', () => {
    it('[P] passam um depois do outro: a auditoria tem dois "antes" diferentes, o do segundo é o "depois" do primeiro', async () => {
      const escola = await escolaNova()
      const licenca = await registrar(escola.coordenacao, { vigenteDesde: '2026-01-01', vigenteAte: '2026-06-30' })
      const outra = await bancada.sessao(escola.coordenacao.escolaId, 'coordenador')
      // O primeiro `update` para depois de gravar, com a linha travada; o segundo espera na trava dela, antes de ler a vigência.
      const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'licenca_de_material', evento: 'update', quando: `new.id = '${licenca.id}'` })
      await gatilho.armar()
      let primeiro: RespostaHttp | undefined
      let segundo: RespostaHttp | undefined
      try {
        const promessaPrimeiro = patch(escola.coordenacao, `/v1/licencas/${licenca.id}`, { vigenteAte: '2026-09-30' })
        await gatilho.esperarParadas()
        const promessaSegundo = patch(outra, `/v1/licencas/${licenca.id}`, { vigenteAte: '2026-12-31' })
        // Dois esperando na trava: o primeiro, parado no gatilho, e o segundo, na linha que o primeiro segura.
        await esperarNaTrava(bancada.pool, '%licenca_de_material%', 2)
        await gatilho.soltar()
        primeiro = await promessaPrimeiro
        segundo = await promessaSegundo
      } finally {
        await gatilho.desarmar()
      }
      expect([primeiro?.status, segundo?.status]).toEqual([200, 200])
      const alteradas = await auditoriaDa(bancada, escola.coordenacao.escolaId, 'licenca.alterada')
      expect(alteradas.map(({ antes, depois }) => ({ antes, depois }))).toEqual([
        { antes: { vigenteDesde: '2026-01-01', vigenteAte: '2026-06-30' }, depois: { vigenteDesde: '2026-01-01', vigenteAte: '2026-09-30' } },
        { antes: { vigenteDesde: '2026-01-01', vigenteAte: '2026-09-30' }, depois: { vigenteDesde: '2026-01-01', vigenteAte: '2026-12-31' } },
      ])
      expect((await linhaDaLicenca(licenca.id))?.vigente_ate).toBe('2026-12-31')
    })
  })

  describe('o que sai em auditoria e em log (regra 20, itens 9 e 10)', () => {
    it('a auditoria e o log nunca levam o licenciante, a cobertura nem a referência', async () => {
      const escola = await escolaNova()
      const sentinela = randomUUID()
      const textos = { licenciante: `Licenciante ${sentinela}`, cobertura: `Cobertura ${sentinela}`, referencia: `Referencia ${sentinela}` }
      const licenca = await registrar(escola.coordenacao, textos)
      await patch(escola.coordenacao, `/v1/licencas/${licenca.id}`, { cobertura: `Outra cobertura ${sentinela}`, referencia: `Outra referencia ${sentinela}`, vigenteAte: '2027-03-31' })
      const { rows } = await bancada.pool.query<{ linha: string }>('select a::text as linha from auditoria a where escola_id = $1 and acao like $2', [escola.coordenacao.escolaId, 'licenca.%'])
      expect(rows).toHaveLength(2)
      for (const { linha } of rows) expect(linha).not.toContain(sentinela)
      expect(linhasDeLog.filter((linha) => linha.includes(sentinela))).toEqual([])
    })
  })

  describe('a eliminação de quem registrou', () => {
    it('apagar o coordenador deixa `registrada_por` nulo, e a licença e a auditoria ficam', async () => {
      const escola = await escolaNova()
      const outra = await bancada.sessao(escola.coordenacao.escolaId, 'coordenador')
      const licenca = await registrar(outra)
      expect((await linhaDaLicenca(licenca.id))?.registrada_por).toBe(outra.usuarioId)
      await runInContext({ requisicaoId: randomUUID(), escolaId: escola.coordenacao.escolaId, usuarioId: escola.coordenacao.usuarioId, papel: 'coordenador' }, () => new CicloDeVidaService(bancada.banco).eliminar(outra.usuarioId))
      expect(await linhaDaLicenca(licenca.id)).toMatchObject({ registrada_por: null, licenciante: LICENCA.licenciante })
      expect((await auditoriaDa(bancada, escola.coordenacao.escolaId, 'licenca.registrada')).map((linha) => linha.autor_usuario_id)).toEqual([outra.usuarioId])
    })
  })

  describe('permissão, e a escola sem ano letivo', () => {
    it('o professor e o aluno recebem o mesmo `NAO_ENCONTRADO` do inexistente, na coleção e no objeto, e nada é gravado', async () => {
      const escola = await escolaNova()
      const licenca = await registrar(escola.coordenacao)
      const professor = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
      const aluno = await bancada.sessao(escola.coordenacao.escolaId, 'aluno')
      for (const [quem, sessao] of [['professor', professor], ['aluno', aluno]] as const) {
        expect(erroDe(await get(sessao, '/v1/licencas')), `${quem} lista`).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
        expect(erroDe(await post(sessao, '/v1/licencas', LICENCA)), `${quem} registra`).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
        const doObjeto = await patch(sessao, `/v1/licencas/${licenca.id}`, { cobertura: 'Alterada' })
        const doInexistente = await patch(sessao, `/v1/licencas/${randomUUID()}`, { cobertura: 'Alterada' })
        expect(semRequisicao(doObjeto), `${quem} altera`).toEqual(semRequisicao(doInexistente))
        expect(erroDe(doObjeto)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      }
      expect(await lista(escola.coordenacao)).toHaveLength(1)
      expect((await linhaDaLicenca(licenca.id))?.cobertura).toBe(LICENCA.cobertura)
      expect(await auditoriaDa(bancada, escola.coordenacao.escolaId, 'licenca.alterada')).toEqual([])
    })

    it('a escola sem ano letivo em curso: a coordenação usa as três rotas', async () => {
      const escola = await escolaNova()
      expect((await bancada.pool.query('select 1 from ano_letivo where escola_id = $1', [escola.coordenacao.escolaId])).rowCount).toBe(0)
      const licenca = await registrar(escola.coordenacao)
      expect((await lista(escola.coordenacao)).map((item) => item.id)).toEqual([licenca.id])
      expect((await patch(escola.coordenacao, `/v1/licencas/${licenca.id}`, { referencia: 'Contrato novo' })).status).toBe(200)
    })
  })

  describe('isolamento entre escolas (regra 10, itens 3 a 6)', () => {
    it('a lista da A não traz as licenças da B nem conta o material da B, e o `PATCH` da licença da B é o mesmo `NAO_ENCONTRADO` do inexistente, sem mudar nada', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const daA = await registrar(a.coordenacao)
      const daB = await registrar(b.coordenacao, { licenciante: 'Editora da B' })
      await materialDaLicenca(b, daB.id)
      await materialDaLicenca(b, daB.id)

      expect((await lista(a.coordenacao)).map((item) => [item.id, item.materiais])).toEqual([[daA.id, 0]])
      expect((await lista(b.coordenacao)).map((item) => [item.id, item.materiais])).toEqual([[daB.id, 2]])

      const antes = await linhaDaLicenca(daB.id)
      const daAPatchandoB = await patch(a.coordenacao, `/v1/licencas/${daB.id}`, { cobertura: 'Invadida', vigenteAte: '2020-01-01' })
      const inexistente = await patch(a.coordenacao, `/v1/licencas/${randomUUID()}`, { cobertura: 'Invadida', vigenteAte: '2020-01-01' })
      expect(erroDe(daAPatchandoB)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(semRequisicao(daAPatchandoB)).toEqual(semRequisicao(inexistente))
      expect(await linhaDaLicenca(daB.id)).toEqual(antes)
      expect(await auditoriaDa(bancada, b.coordenacao.escolaId, 'licenca.alterada')).toEqual([])
      expect(await auditoriaDa(bancada, a.coordenacao.escolaId, 'licenca.alterada')).toEqual([])
    })

    it('o repository com o id da B no contexto da A não acha a licença, e no da B acha', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const daB = await registrar(b.coordenacao)
      const noContexto = <T>(escola: Escola, acao: () => Promise<T>): Promise<T> =>
        runInContext({ requisicaoId: randomUUID(), escolaId: escola.coordenacao.escolaId, usuarioId: escola.coordenacao.usuarioId, papel: 'coordenador' }, acao)
      const repository = new LicencaRepository(bancada.banco)
      expect(await noContexto(a, () => repository.porId(daB.id))).toBeUndefined()
      expect(await noContexto(a, () => repository.travarVigencia(daB.id))).toBeUndefined()
      expect(await noContexto(a, () => repository.alterar(daB.id, { cobertura: 'Invadida' }))).toBe(false)
      expect((await noContexto(b, () => repository.porId(daB.id)))?.id).toBe(daB.id)
      expect(await noContexto(b, () => repository.travarVigencia(daB.id))).toEqual({ vigenteDesde: '2026-02-01', vigenteAte: null })
    })
  })
})
