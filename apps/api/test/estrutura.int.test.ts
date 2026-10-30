import { ErrorCode } from '@educa/shared'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from './api-com-sessao.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('estrutura: a coordenação monta o ano letivo, as séries, as disciplinas e as turmas (RF2)', () => {
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
  const patch = (sessao: SessaoDeTeste, caminho: string, corpo: unknown): Promise<RespostaHttp> => chamar(api.url, 'PATCH', caminho, sessao.token, corpo)
  const excluir = (sessao: SessaoDeTeste, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'DELETE', caminho, sessao.token)

  const periodo = (ano: number) => ({ ano, inicio: `${ano}-02-01`, fim: `${ano}-12-15` })

  async function criarAno(coordenacao: SessaoDeTeste, ano: number): Promise<string> {
    const resposta = await post(coordenacao, '/v1/anos-letivos', periodo(ano))
    expect(resposta.status).toBe(201)
    return resposta.corpo['id'] as string
  }

  async function anoEmCurso(coordenacao: SessaoDeTeste, ano: number): Promise<string> {
    const id = await criarAno(coordenacao, ano)
    expect((await post(coordenacao, `/v1/anos-letivos/${id}/abrir`)).status).toBe(200)
    return id
  }

  async function criarSerie(coordenacao: SessaoDeTeste, etapa: string, ano: number): Promise<string> {
    const resposta = await post(coordenacao, '/v1/series', { etapa, ano })
    expect(resposta.status).toBe(201)
    return resposta.corpo['id'] as string
  }

  async function situacoes(escolaId: string): Promise<Record<number, string>> {
    const { rows } = await bancada.pool.query<{ ano: number; situacao: string }>('select ano, situacao from ano_letivo where escola_id = $1', [escolaId])
    return Object.fromEntries(rows.map((linha) => [linha.ano, linha.situacao]))
  }

  async function contar(tabela: 'turma' | 'serie' | 'disciplina' | 'ano_letivo', escolaId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ total: string }>(`select count(*) as total from ${tabela} where escola_id = $1`, [escolaId])
    return Number(rows[0]?.total)
  }

  const coordenacaoNova = () => bancada.escolaComSessao('coordenador')

  it('E1 (A1, RF3): caminho feliz: cria e abre o ano, cria "8º ano" e "1º EM", "Química" e a turma "2ºB", e cada listagem traz o seu', async () => {
    const coordenacao = await coordenacaoNova()

    const criado = await post(coordenacao, '/v1/anos-letivos', periodo(2026))
    expect(criado.status).toBe(201)
    expect(criado.corpo).toEqual({ id: expect.stringMatching(UUID), ano: 2026, inicio: '2026-02-01', fim: '2026-12-15', situacao: 'planejado' })
    const anoId = criado.corpo['id'] as string
    const aberto = await post(coordenacao, `/v1/anos-letivos/${anoId}/abrir`)
    expect(aberto.status).toBe(200)
    expect(aberto.corpo).toEqual({ ...criado.corpo, situacao: 'em_curso' })

    const oitavo = await post(coordenacao, '/v1/series', { etapa: 'ef_anos_finais', ano: 8 })
    expect(oitavo.status).toBe(201)
    expect(oitavo.corpo).toEqual({ id: expect.stringMatching(UUID), etapa: 'ef_anos_finais', ano: 8 })
    const primeiroEm = await post(coordenacao, '/v1/series', { etapa: 'em', ano: 1 })
    expect(primeiroEm.status).toBe(201)

    const quimica = await post(coordenacao, '/v1/disciplinas', { nome: '  Química ', area: 'ciencias_da_natureza' })
    expect(quimica.status).toBe(201)
    expect(quimica.corpo).toEqual({ id: expect.stringMatching(UUID), nome: 'Química', area: 'ciencias_da_natureza' })

    const turma = await post(coordenacao, '/v1/turmas', { serieId: primeiroEm.corpo['id'], nome: '2ºB', turno: 'manha' })
    expect(turma.status).toBe(201)
    expect(turma.corpo).toEqual({ id: expect.stringMatching(UUID), anoLetivoId: anoId, nome: '2ºB', turno: 'manha', serie: primeiroEm.corpo })

    expect((await get(coordenacao, '/v1/anos-letivos')).corpo).toEqual({ itens: [aberto.corpo] })
    expect((await get(coordenacao, '/v1/series')).corpo).toEqual({ itens: [oitavo.corpo, primeiroEm.corpo] })
    expect((await get(coordenacao, '/v1/disciplinas')).corpo).toEqual({ itens: [quimica.corpo] })
    expect((await get(coordenacao, '/v1/turmas')).corpo).toEqual({ itens: [turma.corpo] })
  })

  it('listagens paginadas: `limite` corta a página e `proxima` continua dela, sem repetir nem pular', async () => {
    const coordenacao = await coordenacaoNova()
    const nomes = ['Química', 'Física', 'Biologia']
    for (const nome of nomes) expect((await post(coordenacao, '/v1/disciplinas', { nome })).status).toBe(201)

    const primeira = await get(coordenacao, '/v1/disciplinas?limite=2')
    expect((primeira.corpo['itens'] as Array<{ nome: string }>).map((item) => item.nome)).toEqual(['Química', 'Física'])
    expect(primeira.corpo['proxima']).toEqual(expect.stringMatching(UUID))
    const segunda = await get(coordenacao, `/v1/disciplinas?limite=2&pagina=${String(primeira.corpo['proxima'])}`)
    expect(segunda.corpo).toEqual({ itens: [expect.objectContaining({ nome: 'Biologia' })] })

    for (const invalida of ['limite=101', 'limite=0', 'pagina=nao-e-uuid', 'escolaId=00000000-0000-7000-8000-000000000000']) {
      const resposta = await get(coordenacao, `/v1/disciplinas?${invalida}`)
      expect(resposta.status, invalida).toBe(400)
      expect(resposta.corpo.erro?.codigo, invalida).toBe(ErrorCode.ENTRADA_INVALIDA)
    }
    // O teto é 100: o limite 100 passa e traz as três, e o 101 acima não.
    const noTeto = await get(coordenacao, '/v1/disciplinas?limite=100')
    expect(noTeto.status).toBe(200)
    expect((noTeto.corpo['itens'] as unknown[]).length).toBe(3)
  })

  describe('borda: o recorte da D43', () => {
    it('E1 (A1, RF3): "5º ano" e "4º do EM" dão ENTRADA_INVALIDA, e o banco recusa os dois mesmo por fora da rota', async () => {
      const coordenacao = await coordenacaoNova()
      for (const fora of [
        { etapa: 'ef_anos_finais', ano: 5 },
        { etapa: 'ef_anos_finais', ano: 10 },
        { etapa: 'em', ano: 4 },
        { etapa: 'em', ano: 0 },
        { etapa: 'ef_anos_iniciais', ano: 5 },
      ]) {
        const resposta = await post(coordenacao, '/v1/series', fora)
        expect(resposta.status, JSON.stringify(fora)).toBe(400)
        expect(resposta.corpo.erro?.codigo, JSON.stringify(fora)).toBe(ErrorCode.ENTRADA_INVALIDA)
      }
      expect(await contar('serie', coordenacao.escolaId)).toBe(0)

      const cliente = new pg.Client({ connectionString: urlDoBancoDeTeste() })
      await cliente.connect()
      try {
        for (const [etapa, ano] of [
          ['ef_anos_finais', 5],
          ['em', 4],
        ] as const) {
          const erro = await cliente.query('insert into serie (escola_id, etapa, ano) values ($1, $2, $3)', [coordenacao.escolaId, etapa, ano]).then(
            () => undefined,
            (falha: { code?: string; constraint?: string }) => ({ codigo: falha.code, restricao: falha.constraint }),
          )
          expect(erro, `${etapa} ${ano}`).toEqual({ codigo: '23514', restricao: 'serie_no_recorte' })
        }
      } finally {
        await cliente.end()
      }
    })

    it('série repetida dá CONFLITO sem o valor na resposta; dois POST em paralelo criam uma só', async () => {
      const coordenacao = await coordenacaoNova()
      await criarSerie(coordenacao, 'ef_anos_finais', 8)

      const repetida = await post(coordenacao, '/v1/series', { etapa: 'ef_anos_finais', ano: 8 })
      expect(repetida.status).toBe(409)
      expect(repetida.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
      const texto = JSON.stringify(repetida.corpo)
      for (const vazamento of ['ef_anos_finais', 'serie_escola_etapa_ano_unico', 'etapa', 'escola_id', '(8)']) expect(texto).not.toContain(vazamento)

      const juntas = await Promise.all([post(coordenacao, '/v1/series', { etapa: 'em', ano: 2 }), post(coordenacao, '/v1/series', { etapa: 'em', ano: 2 })])
      expect(juntas.map((resposta) => resposta.status).sort()).toEqual([201, 409])
      expect(await contar('serie', coordenacao.escolaId)).toBe(2)
    })

    it('disciplina: "Química" e "química" conflitam na escola, também em paralelo', async () => {
      const coordenacao = await coordenacaoNova()
      expect((await post(coordenacao, '/v1/disciplinas', { nome: 'Química' })).status).toBe(201)
      const repetida = await post(coordenacao, '/v1/disciplinas', { nome: 'QUÍMICA' })
      expect(repetida.status).toBe(409)
      expect(JSON.stringify(repetida.corpo)).not.toContain('QUÍMICA')

      const juntas = await Promise.all([post(coordenacao, '/v1/disciplinas', { nome: 'História' }), post(coordenacao, '/v1/disciplinas', { nome: 'história' })])
      expect(juntas.map((resposta) => resposta.status).sort()).toEqual([201, 409])
      expect(await contar('disciplina', coordenacao.escolaId)).toBe(2)
    })
  })

  describe('ano letivo: abrir e encerrar', () => {
    it('concorrência: dois `abrir` em paralelo, em anos diferentes da mesma escola, deixam um só em curso', async () => {
      const coordenacao = await coordenacaoNova()
      const [de2026, de2027] = [await criarAno(coordenacao, 2026), await criarAno(coordenacao, 2027)]

      const juntas = await Promise.all([post(coordenacao, `/v1/anos-letivos/${de2026}/abrir`), post(coordenacao, `/v1/anos-letivos/${de2027}/abrir`)])

      expect(juntas.map((resposta) => resposta.status).sort()).toEqual([200, 409])
      expect(juntas.find((resposta) => resposta.status === 409)?.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
      expect(Object.values(await situacoes(coordenacao.escolaId)).sort()).toEqual(['em_curso', 'planejado'])
    })

    it('o segundo clique em `abrir` e em `encerrar` responde o ano como está, também em paralelo; encerrado não reabre e planejado não se encerra', async () => {
      const coordenacao = await coordenacaoNova()
      const anoId = await criarAno(coordenacao, 2026)

      const abrindo = await Promise.all([post(coordenacao, `/v1/anos-letivos/${anoId}/abrir`), post(coordenacao, `/v1/anos-letivos/${anoId}/abrir`)])
      expect(abrindo.map((resposta) => [resposta.status, resposta.corpo['situacao']])).toEqual([
        [200, 'em_curso'],
        [200, 'em_curso'],
      ])
      const encerrando = await Promise.all([post(coordenacao, `/v1/anos-letivos/${anoId}/encerrar`), post(coordenacao, `/v1/anos-letivos/${anoId}/encerrar`)])
      expect(encerrando.map((resposta) => [resposta.status, resposta.corpo['situacao']])).toEqual([
        [200, 'encerrado'],
        [200, 'encerrado'],
      ])

      const reabrir = await post(coordenacao, `/v1/anos-letivos/${anoId}/abrir`)
      expect(reabrir.status).toBe(409)
      expect(reabrir.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
      const planejado = await criarAno(coordenacao, 2027)
      expect((await post(coordenacao, `/v1/anos-letivos/${planejado}/encerrar`)).status).toBe(409)
      expect(await situacoes(coordenacao.escolaId)).toEqual({ 2026: 'encerrado', 2027: 'planejado' })
    })

    it('o mesmo ano duas vezes na escola dá CONFLITO, também em paralelo; período invertido, de outro ano ou sem fim à vista, e campo a mais, são ENTRADA_INVALIDA; o fim em janeiro do ano seguinte passa', async () => {
      const coordenacao = await coordenacaoNova()
      const juntas = await Promise.all([post(coordenacao, '/v1/anos-letivos', periodo(2026)), post(coordenacao, '/v1/anos-letivos', periodo(2026))])
      expect(juntas.map((resposta) => resposta.status).sort()).toEqual([201, 409])
      expect(await contar('ano_letivo', coordenacao.escolaId)).toBe(1)

      for (const invalido of [
        { ano: 2027, inicio: '2027-12-15', fim: '2027-02-01' },
        { ...periodo(2027), situacao: 'em_curso' },
        { ...periodo(2027), escolaId: coordenacao.escolaId },
        { ano: 1999, inicio: '1999-02-01', fim: '1999-12-15' },
        // O período não contradiz o ano (A1, 13.0): o ano letivo não se altera nem se exclui depois de criado.
        { ano: 2027, inicio: '2026-02-01', fim: '2026-12-15' },
        { ano: 2027, inicio: '2028-02-01', fim: '2028-12-15' },
        { ano: 2027, inicio: '2027-02-01', fim: '2207-12-15' },
      ]) {
        const resposta = await post(coordenacao, '/v1/anos-letivos', invalido)
        expect(resposta.status, JSON.stringify(invalido)).toBe(400)
        expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
      }
      expect(await contar('ano_letivo', coordenacao.escolaId)).toBe(1)
      // A rede que termina o ano letivo em janeiro do ano seguinte: passa.
      const comFimEmJaneiro = await post(coordenacao, '/v1/anos-letivos', { ano: 2027, inicio: '2027-02-01', fim: '2028-01-20' })
      expect(comFimEmJaneiro.status).toBe(201)
      expect(comFimEmJaneiro.corpo).toMatchObject({ ano: 2027, inicio: '2027-02-01', fim: '2028-01-20', situacao: 'planejado' })
      expect(await contar('ano_letivo', coordenacao.escolaId)).toBe(2)
    })
  })

  describe('turma: pertence ao ano letivo em curso', () => {
    it('"7ºA" de 2026 e de 2027 coexistem; "7ºA" e "7ºa" no mesmo ano conflitam, também em paralelo; a listagem é só do ano em curso', async () => {
      const coordenacao = await coordenacaoNova()
      const de2026 = await anoEmCurso(coordenacao, 2026)
      const setimo = await criarSerie(coordenacao, 'ef_anos_finais', 7)
      const setimoA2026 = await post(coordenacao, '/v1/turmas', { serieId: setimo, nome: '7ºA' })
      expect(setimoA2026.status).toBe(201)
      expect(setimoA2026.corpo['anoLetivoId']).toBe(de2026)

      // A turma escrita de outro jeito: maiúscula e espaço nas pontas conflitam. "7º A" e "7A" são outros nomes, e outras turmas.
      for (const nome of ['7ºa', ' 7ºA ']) {
        const repetida = await post(coordenacao, '/v1/turmas', { serieId: setimo, nome })
        expect(repetida.status, nome).toBe(409)
        expect(repetida.corpo.erro?.codigo, nome).toBe(ErrorCode.CONFLITO)
      }
      const juntas = await Promise.all([post(coordenacao, '/v1/turmas', { serieId: setimo, nome: '7ºB' }), post(coordenacao, '/v1/turmas', { serieId: setimo, nome: '7ºb' })])
      expect(juntas.map((resposta) => resposta.status).sort()).toEqual([201, 409])

      expect((await post(coordenacao, `/v1/anos-letivos/${de2026}/encerrar`)).status).toBe(200)
      const de2027 = await anoEmCurso(coordenacao, 2027)
      const setimoA2027 = await post(coordenacao, '/v1/turmas', { serieId: setimo, nome: '7ºA' })
      expect(setimoA2027.status).toBe(201)
      expect(setimoA2027.corpo['anoLetivoId']).toBe(de2027)
      expect(setimoA2027.corpo['id']).not.toBe(setimoA2026.corpo['id'])

      expect((await get(coordenacao, '/v1/turmas')).corpo).toEqual({ itens: [setimoA2027.corpo] })
      expect(await contar('turma', coordenacao.escolaId)).toBe(3)
    })

    it('turno e área fora da lista, e nome vazio, são ENTRADA_INVALIDA na rota e recusados pelo banco', async () => {
      const coordenacao = await coordenacaoNova()
      await anoEmCurso(coordenacao, 2026)
      const serie = await criarSerie(coordenacao, 'em', 2)
      for (const [caminho, corpo] of [
        ['/v1/turmas', { serieId: serie, nome: '2ºA', turno: 'madrugada' }],
        ['/v1/turmas', { serieId: serie, nome: '   ' }],
        ['/v1/disciplinas', { nome: 'Química', area: 'exatas' }],
        ['/v1/disciplinas', { nome: '' }],
      ] as const) {
        const resposta = await post(coordenacao, caminho, corpo)
        expect(resposta.status, JSON.stringify(corpo)).toBe(400)
        expect(resposta.corpo.erro?.codigo, JSON.stringify(corpo)).toBe(ErrorCode.ENTRADA_INVALIDA)
      }

      const cliente = new pg.Client({ connectionString: urlDoBancoDeTeste() })
      await cliente.connect()
      try {
        const restricao = (consulta: Promise<unknown>) =>
          consulta.then(
            () => undefined,
            (falha: { code?: string; constraint?: string }) => ({ codigo: falha.code, restricao: falha.constraint }),
          )
        const { rows } = await cliente.query<{ id: string }>("select id from ano_letivo where escola_id = $1 and situacao = 'em_curso'", [coordenacao.escolaId])
        const anoId = rows[0]?.id
        const turma = (nome: string, turno: string | null) =>
          restricao(cliente.query('insert into turma (escola_id, ano_letivo_id, serie_id, nome, turno) values ($1, $2, $3, $4, $5)', [coordenacao.escolaId, anoId, serie, nome, turno]))
        const disciplina = (nome: string, area: string | null) =>
          restricao(cliente.query('insert into disciplina (escola_id, nome, area) values ($1, $2, $3)', [coordenacao.escolaId, nome, area]))
        expect(await turma('2ºA', 'madrugada')).toEqual({ codigo: '23514', restricao: 'turma_turno_valido' })
        expect(await turma('  ', null)).toEqual({ codigo: '23514', restricao: 'turma_nome_preenchido' })
        expect(await disciplina('Química', 'exatas')).toEqual({ codigo: '23514', restricao: 'disciplina_area_valida' })
        expect(await disciplina(' ', null)).toEqual({ codigo: '23514', restricao: 'disciplina_nome_preenchido' })
      } finally {
        await cliente.end()
      }
      expect(await contar('turma', coordenacao.escolaId)).toBe(0)
      expect(await contar('disciplina', coordenacao.escolaId)).toBe(0)
    })

    it('escola do zero, sem ano em curso: turma falha fechada nas duas rotas, e criar e abrir o ano, série e disciplina funcionam', async () => {
      const coordenacao = await coordenacaoNova()
      const serie = await criarSerie(coordenacao, 'em', 3)
      expect((await post(coordenacao, '/v1/disciplinas', { nome: 'Sociologia' })).status).toBe(201)

      for (const resposta of [await get(coordenacao, '/v1/turmas'), await post(coordenacao, '/v1/turmas', { serieId: serie, nome: '3ºA' })]) {
        expect(resposta.status).toBe(404)
        expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)
      }

      const planejado = await criarAno(coordenacao, 2026)
      expect((await get(coordenacao, '/v1/anos-letivos')).corpo['itens']).toHaveLength(1)
      expect((await post(coordenacao, '/v1/turmas', { serieId: serie, nome: '3ºA' })).status).toBe(404)
      expect((await post(coordenacao, `/v1/anos-letivos/${planejado}/abrir`)).status).toBe(200)
      expect((await post(coordenacao, '/v1/turmas', { serieId: serie, nome: '3ºA' })).status).toBe(201)
    })

    it('ano encerrado não aceita turma nova: sem ano em curso, e com o id dele no corpo quando outro está em curso', async () => {
      const coordenacao = await coordenacaoNova()
      const serie = await criarSerie(coordenacao, 'ef_anos_finais', 9)
      const de2026 = await anoEmCurso(coordenacao, 2026)
      expect((await post(coordenacao, `/v1/anos-letivos/${de2026}/encerrar`)).status).toBe(200)

      const semAno = await post(coordenacao, '/v1/turmas', { serieId: serie, nome: '9ºA' })
      expect(semAno.status).toBe(404)
      expect(semAno.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)

      await anoEmCurso(coordenacao, 2027)
      const noEncerrado = await post(coordenacao, '/v1/turmas', { serieId: serie, nome: '9ºA', anoLetivoId: de2026 })
      expect(noEncerrado.status).toBe(404)
      expect(noEncerrado.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)
      const planejado = await criarAno(coordenacao, 2028)
      expect((await post(coordenacao, '/v1/turmas', { serieId: serie, nome: '9ºA', anoLetivoId: planejado })).status).toBe(404)
      expect(await contar('turma', coordenacao.escolaId)).toBe(0)
    })

    it('concorrência: a turma que chega enquanto o ano é encerrado espera o encerramento e é recusada, em vez de nascer no ano encerrado', async () => {
      const coordenacao = await coordenacaoNova()
      const serie = await criarSerie(coordenacao, 'ef_anos_finais', 6)
      const anoId = await anoEmCurso(coordenacao, 2026)

      const cliente = new pg.Client({ connectionString: urlDoBancoDeTeste() })
      await cliente.connect()
      try {
        await cliente.query('begin')
        await cliente.query(`update ano_letivo set situacao = 'encerrado' where escola_id = $1 and id = $2`, [coordenacao.escolaId, anoId])
        // A guarda ainda lê o ano em curso (o encerramento não foi confirmado), e a criação para no `FOR SHARE`.
        const criando = post(coordenacao, '/v1/turmas', { serieId: serie, nome: '6ºA' })
        await expect
          .poll(
            async () => {
              const { rows } = await bancada.pool.query<{ total: string }>(
                "select count(*) as total from pg_stat_activity where wait_event_type = 'Lock' and query ilike '%from \"ano_letivo\"%for share%'",
              )
              return Number(rows[0]?.total)
            },
            { timeout: 5_000 },
          )
          .toBe(1)
        await cliente.query('commit')

        const resposta = await criando
        expect(resposta.status).toBe(404)
        expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)
        expect(await contar('turma', coordenacao.escolaId)).toBe(0)
      } finally {
        await cliente.end()
      }
    })
  })

  describe('E2 (A1, RF3): a coordenação renomeia e exclui disciplina e turma', () => {
    async function criarDisciplina(coordenacao: SessaoDeTeste, nome: string): Promise<Record<string, unknown>> {
      const resposta = await post(coordenacao, '/v1/disciplinas', { nome, area: 'ciencias_da_natureza' })
      expect(resposta.status).toBe(201)
      return resposta.corpo
    }

    async function criarTurma(coordenacao: SessaoDeTeste, serieId: string, nome: string): Promise<Record<string, unknown>> {
      const resposta = await post(coordenacao, '/v1/turmas', { serieId, nome, turno: 'tarde' })
      expect(resposta.status).toBe(201)
      return resposta.corpo
    }

    async function nomesNoBanco(tabela: 'turma' | 'disciplina', escolaId: string): Promise<string[]> {
      const { rows } = await bancada.pool.query<{ nome: string }>(`select nome from ${tabela} where escola_id = $1 order by nome`, [escolaId])
      return rows.map((linha) => linha.nome)
    }

    it('renomear: a resposta e a listagem trazem o nome novo, com o resto como estava; o nome de outra, sem diferenciar maiúscula, dá CONFLITO sem o valor', async () => {
      const coordenacao = await coordenacaoNova()
      await anoEmCurso(coordenacao, 2026)
      const serie = await criarSerie(coordenacao, 'ef_anos_finais', 7)
      const quimica = await criarDisciplina(coordenacao, 'Química')
      const fisica = await criarDisciplina(coordenacao, 'Física')
      const setimoA = await criarTurma(coordenacao, serie, '7ºA')
      const setimoB = await criarTurma(coordenacao, serie, '7ºB')

      const disciplina = await patch(coordenacao, `/v1/disciplinas/${String(quimica['id'])}`, { nome: '  Química Orgânica ' })
      expect(disciplina.status).toBe(200)
      expect(disciplina.corpo).toEqual({ ...quimica, nome: 'Química Orgânica' })
      const turma = await patch(coordenacao, `/v1/turmas/${String(setimoA['id'])}`, { nome: '7ºC' })
      expect(turma.status).toBe(200)
      expect(turma.corpo).toEqual({ ...setimoA, nome: '7ºC' })
      expect((await get(coordenacao, '/v1/disciplinas')).corpo).toEqual({ itens: [disciplina.corpo, fisica] })
      expect((await get(coordenacao, '/v1/turmas')).corpo).toEqual({ itens: [turma.corpo, setimoB] })

      // O próprio nome com outra maiúscula não conflita com ele mesmo.
      expect((await patch(coordenacao, `/v1/turmas/${String(setimoA['id'])}`, { nome: '7ºc' })).corpo).toEqual({ ...setimoA, nome: '7ºc' })

      for (const [caminho, nome] of [
        [`/v1/disciplinas/${String(fisica['id'])}`, 'QUÍMICA ORGÂNICA'],
        [`/v1/turmas/${String(setimoB['id'])}`, '7ºC'],
      ] as const) {
        const repetido = await patch(coordenacao, caminho, { nome })
        expect(repetido.status, caminho).toBe(409)
        expect(repetido.corpo.erro?.codigo, caminho).toBe(ErrorCode.CONFLITO)
        const texto = JSON.stringify(repetido.corpo)
        for (const vazamento of [nome, 'unico', 'nome']) expect(texto, caminho).not.toContain(vazamento)
      }
      expect(await nomesNoBanco('disciplina', coordenacao.escolaId)).toEqual(['Física', 'Química Orgânica'])
      expect(await nomesNoBanco('turma', coordenacao.escolaId)).toEqual(['7ºB', '7ºc'])

      // O nome é único na escola, não entre escolas: a disciplina de outra escola ganha o mesmo nome.
      const outra = await coordenacaoNova()
      const daOutra = await criarDisciplina(outra, 'Física')
      expect((await patch(outra, `/v1/disciplinas/${String(daOutra['id'])}`, { nome: 'Química Orgânica' })).corpo).toEqual({ ...daOutra, nome: 'Química Orgânica' })
    })

    it('renomear: nome vazio, longo demais, campo a mais ou corpo vazio dão ENTRADA_INVALIDA, e nada muda', async () => {
      const coordenacao = await coordenacaoNova()
      await anoEmCurso(coordenacao, 2026)
      const serie = await criarSerie(coordenacao, 'em', 1)
      const quimica = await criarDisciplina(coordenacao, 'Química')
      const turma = await criarTurma(coordenacao, serie, '1ºA')

      for (const [caminho, corpo] of [
        [`/v1/disciplinas/${String(quimica['id'])}`, { nome: '   ' }],
        [`/v1/disciplinas/${String(quimica['id'])}`, { nome: 'x'.repeat(81) }],
        [`/v1/disciplinas/${String(quimica['id'])}`, { nome: 'Física', area: 'matematica' }],
        [`/v1/disciplinas/${String(quimica['id'])}`, { nome: 'Física', escolaId: coordenacao.escolaId }],
        [`/v1/disciplinas/${String(quimica['id'])}`, {}],
        [`/v1/turmas/${String(turma['id'])}`, { nome: '' }],
        [`/v1/turmas/${String(turma['id'])}`, { nome: 'x'.repeat(41) }],
        [`/v1/turmas/${String(turma['id'])}`, { nome: '1ºB', turno: 'manha' }],
        [`/v1/turmas/${String(turma['id'])}`, { nome: '1ºB', serieId: serie }],
        [`/v1/turmas/${String(turma['id'])}`, {}],
      ] as const) {
        const resposta = await patch(coordenacao, caminho, corpo)
        expect(resposta.status, JSON.stringify(corpo)).toBe(400)
        expect(resposta.corpo.erro?.codigo, JSON.stringify(corpo)).toBe(ErrorCode.ENTRADA_INVALIDA)
      }
      expect((await get(coordenacao, '/v1/disciplinas')).corpo).toEqual({ itens: [quimica] })
      expect((await get(coordenacao, '/v1/turmas')).corpo).toEqual({ itens: [turma] })
    })

    it('concorrência: duas turmas renomeadas para o mesmo nome em paralelo, e duas disciplinas também: uma fica com ele, a outra recebe CONFLITO', async () => {
      const coordenacao = await coordenacaoNova()
      await anoEmCurso(coordenacao, 2026)
      const serie = await criarSerie(coordenacao, 'em', 2)
      const [a, b] = [await criarTurma(coordenacao, serie, '2ºA'), await criarTurma(coordenacao, serie, '2ºB')]
      const [d1, d2] = [await criarDisciplina(coordenacao, 'Física'), await criarDisciplina(coordenacao, 'Química')]

      const turmas = await Promise.all([patch(coordenacao, `/v1/turmas/${String(a['id'])}`, { nome: '2ºZ' }), patch(coordenacao, `/v1/turmas/${String(b['id'])}`, { nome: '2ºz' })])
      const disciplinas = await Promise.all([
        patch(coordenacao, `/v1/disciplinas/${String(d1['id'])}`, { nome: 'Biologia' }),
        patch(coordenacao, `/v1/disciplinas/${String(d2['id'])}`, { nome: 'biologia' }),
      ])

      expect(turmas.map((resposta) => resposta.status).sort()).toEqual([200, 409])
      expect(disciplinas.map((resposta) => resposta.status).sort()).toEqual([200, 409])
      // A perdedora continua com o nome de antes: uma renomeada e uma intacta, em cada tabela.
      const minusculas = async (tabela: 'turma' | 'disciplina') => (await nomesNoBanco(tabela, coordenacao.escolaId)).map((nome) => nome.toLowerCase()).sort()
      expect([['2ºa', '2ºz'], ['2ºb', '2ºz']]).toContainEqual(await minusculas('turma'))
      expect([['biologia', 'física'], ['biologia', 'química']]).toContainEqual(await minusculas('disciplina'))
    })

    it('excluir disciplina com vínculo e turma com vínculo, também já encerrado: CONFLITO sem o nome da restrição, e nada é apagado; a turma vazia e a disciplina sem vínculo saem', async () => {
      const coordenacao = await coordenacaoNova()
      await anoEmCurso(coordenacao, 2026)
      const serie = await criarSerie(coordenacao, 'em', 3)
      const comVinculo = { disciplina: await criarDisciplina(coordenacao, 'Química'), turma: await criarTurma(coordenacao, serie, '3ºA') }
      const semVinculo = { disciplina: await criarDisciplina(coordenacao, 'Física'), turma: await criarTurma(coordenacao, serie, '3ºB') }
      const professor = await bancada.sessao(coordenacao.escolaId, 'professor')
      const vinculo = await post(coordenacao, '/v1/vinculos', {
        usuarioId: professor.usuarioId,
        turmaId: comVinculo.turma['id'],
        disciplinaId: comVinculo.disciplina['id'],
        papel: 'professor',
      })
      expect(vinculo.status).toBe(201)
      const vinculoId = vinculo.corpo['id'] as string

      const recusas = async () => {
        for (const caminho of [`/v1/disciplinas/${String(comVinculo.disciplina['id'])}`, `/v1/turmas/${String(comVinculo.turma['id'])}`]) {
          const resposta = await excluir(coordenacao, caminho)
          expect(resposta.status, caminho).toBe(409)
          expect(resposta.corpo.erro?.codigo, caminho).toBe(ErrorCode.CONFLITO)
          for (const vazamento of ['vinculo', '_fk', 'Química', '3ºA']) expect(JSON.stringify(resposta.corpo), caminho).not.toContain(vazamento)
        }
      }
      await recusas()
      // Confirmado pelo professor, o caso comum da escola, segura do mesmo jeito.
      expect((await post(professor, `/v1/vinculos/${vinculoId}/confirmar`)).status).toBe(200)
      await recusas()
      // O vínculo encerrado é histórico da turma e da disciplina: continua segurando as duas.
      expect((await post(coordenacao, `/v1/vinculos/${vinculoId}/encerrar`, { motivo: 'realocacao' })).status).toBe(200)
      await recusas()
      expect(await nomesNoBanco('disciplina', coordenacao.escolaId)).toEqual(['Física', 'Química'])
      expect(await nomesNoBanco('turma', coordenacao.escolaId)).toEqual(['3ºA', '3ºB'])
      const { rows } = await bancada.pool.query<{ total: string }>('select count(*) as total from vinculo where escola_id = $1 and id = $2', [coordenacao.escolaId, vinculoId])
      expect(Number(rows[0]?.total)).toBe(1)

      const turmaVazia = await excluir(coordenacao, `/v1/turmas/${String(semVinculo.turma['id'])}`)
      expect(turmaVazia.status).toBe(204)
      expect(turmaVazia.corpo).toEqual({})
      const disciplinaLivre = await excluir(coordenacao, `/v1/disciplinas/${String(semVinculo.disciplina['id'])}`)
      expect(disciplinaLivre.status).toBe(204)
      expect(disciplinaLivre.corpo).toEqual({})
      expect(await nomesNoBanco('disciplina', coordenacao.escolaId)).toEqual(['Química'])
      expect(await nomesNoBanco('turma', coordenacao.escolaId)).toEqual(['3ºA'])
      expect((await get(coordenacao, '/v1/turmas')).corpo).toEqual({ itens: [comVinculo.turma] })
      expect((await get(coordenacao, '/v1/disciplinas')).corpo).toEqual({ itens: [comVinculo.disciplina] })

      // A que já saiu responde como inexistente.
      for (const caminho of [`/v1/turmas/${String(semVinculo.turma['id'])}`, `/v1/disciplinas/${String(semVinculo.disciplina['id'])}`]) {
        const denovo = await excluir(coordenacao, caminho)
        expect(denovo.status, caminho).toBe(404)
        expect(denovo.corpo.erro?.codigo, caminho).toBe(ErrorCode.NAO_ENCONTRADO)
      }
    })

    it('concorrência: dois DELETE da mesma turma vazia em paralelo, e da mesma disciplina: um apaga, o outro recebe NAO_ENCONTRADO', async () => {
      const coordenacao = await coordenacaoNova()
      await anoEmCurso(coordenacao, 2026)
      const serie = await criarSerie(coordenacao, 'ef_anos_finais', 9)
      const turma = await criarTurma(coordenacao, serie, '9ºA')
      const disciplina = await criarDisciplina(coordenacao, 'Geografia')

      const turmas = await Promise.all([excluir(coordenacao, `/v1/turmas/${String(turma['id'])}`), excluir(coordenacao, `/v1/turmas/${String(turma['id'])}`)])
      const disciplinas = await Promise.all([
        excluir(coordenacao, `/v1/disciplinas/${String(disciplina['id'])}`),
        excluir(coordenacao, `/v1/disciplinas/${String(disciplina['id'])}`),
      ])

      expect(turmas.map((resposta) => resposta.status).sort()).toEqual([204, 404])
      expect(disciplinas.map((resposta) => resposta.status).sort()).toEqual([204, 404])
      expect(await contar('turma', coordenacao.escolaId)).toBe(0)
      expect(await contar('disciplina', coordenacao.escolaId)).toBe(0)
    })

    it('a turma de um ano encerrado não se renomeia nem se exclui, mesmo vazia: NAO_ENCONTRADO sem ano em curso e com outro em curso, e ela fica como estava; a do ano em curso, sim, até com o nome da antiga', async () => {
      const coordenacao = await coordenacaoNova()
      const serie = await criarSerie(coordenacao, 'ef_anos_finais', 6)
      const de2026 = await anoEmCurso(coordenacao, 2026)
      const antiga = await criarTurma(coordenacao, serie, '6ºA')
      expect((await post(coordenacao, `/v1/anos-letivos/${de2026}/encerrar`)).status).toBe(200)

      const recusadas = async () => {
        for (const resposta of [
          await patch(coordenacao, `/v1/turmas/${String(antiga['id'])}`, { nome: '6ºZ' }),
          await excluir(coordenacao, `/v1/turmas/${String(antiga['id'])}`),
        ]) {
          expect(resposta.status).toBe(404)
          expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)
        }
      }
      // Entre encerrar um ano e abrir o outro, a escola não tem ano em curso: as duas rotas falham fechadas.
      await recusadas()
      await anoEmCurso(coordenacao, 2027)
      const atual = await criarTurma(coordenacao, serie, '6ºB')
      await recusadas()
      expect(await nomesNoBanco('turma', coordenacao.escolaId)).toEqual(['6ºA', '6ºB'])

      // O 404 veio do ano: a turma do ano em curso muda, e o nome da turma do ano encerrado não conflita com ela.
      expect((await patch(coordenacao, `/v1/turmas/${String(atual['id'])}`, { nome: '6ºa' })).status).toBe(200)
      expect((await nomesNoBanco('turma', coordenacao.escolaId)).sort()).toEqual(['6ºA', '6ºa'])
      expect((await excluir(coordenacao, `/v1/turmas/${String(atual['id'])}`)).status).toBe(204)
      expect(await nomesNoBanco('turma', coordenacao.escolaId)).toEqual(['6ºA'])
    })
  })

  describe('permissão: só a coordenação', () => {
    it('professor e aluno recebem o 404 de rota inexistente em toda rota de estrutura, e nada é criado nem mudado', async () => {
      const coordenacao = await coordenacaoNova()
      const escolaId = coordenacao.escolaId
      const serie = await criarSerie(coordenacao, 'ef_anos_finais', 8)
      const planejado = await criarAno(coordenacao, 2027)
      const emCurso = await anoEmCurso(coordenacao, 2026)

      for (const papel of ['professor', 'aluno'] as const) {
        const sessao = await bancada.sessao(escolaId, papel)
        const tentativas = [
          ['POST /v1/turmas', await post(sessao, '/v1/turmas', { serieId: serie, nome: '8ºZ' })],
          ['POST /v1/series', await post(sessao, '/v1/series', { etapa: 'em', ano: 1 })],
          ['POST /v1/disciplinas', await post(sessao, '/v1/disciplinas', { nome: 'Artes' })],
          ['POST /v1/anos-letivos', await post(sessao, '/v1/anos-letivos', periodo(2028))],
          ['POST abrir', await post(sessao, `/v1/anos-letivos/${planejado}/abrir`)],
          ['POST encerrar', await post(sessao, `/v1/anos-letivos/${emCurso}/encerrar`)],
          ['GET /v1/turmas', await get(sessao, '/v1/turmas')],
          ['GET /v1/series', await get(sessao, '/v1/series')],
          ['GET /v1/disciplinas', await get(sessao, '/v1/disciplinas')],
          ['GET /v1/anos-letivos', await get(sessao, '/v1/anos-letivos')],
        ] as const
        for (const [rota, resposta] of tentativas) {
          expect(resposta.status, `${papel} ${rota}`).toBe(404)
          expect(resposta.corpo.erro?.codigo, `${papel} ${rota}`).toBe(ErrorCode.NAO_ENCONTRADO)
        }
      }

      expect(await contar('turma', escolaId)).toBe(0)
      expect(await contar('serie', escolaId)).toBe(1)
      expect(await contar('disciplina', escolaId)).toBe(0)
      expect(await situacoes(escolaId)).toEqual({ 2026: 'em_curso', 2027: 'planejado' })
    })
  })
})
