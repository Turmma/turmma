import { METRICS } from '@educa/core'
import { ErrorCode, type PapelDeUsuario } from '@educa/shared'
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste } from './api-com-sessao.js'
import { esperarNaTrava } from './gatilho-de-parada.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/** Datas antigas e conhecidas, alinhadas ao milissegundo: o que o JavaScript lê do banco é o que o banco guardou. */
const DATA_ANTIGA = '2020-01-02T03:04:05.678Z'
const OUTRA_DATA = '2021-05-06T07:08:09.123Z'

describe('introdução vista: POST /v1/eu/introducao grava a data da própria pessoa, e GET /v1/eu a devolve', () => {
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

  const lerEu = (token: string) => chamar(api.url, 'GET', '/v1/eu', token)
  const concluir = (token: string | undefined, corpo?: unknown) => chamar(api.url, 'POST', '/v1/eu/introducao', token, corpo)
  const dataNoEu = async (token: string): Promise<unknown> => (await lerEu(token)).corpo['introducaoVistaEm']
  const dataDoPost = async (token: string): Promise<unknown> => (await concluir(token)).corpo['introducaoVistaEm']

  /** A data da linha, como o banco a guarda, no formato da resposta. */
  async function dataNoBanco(usuarioId: string): Promise<string | null> {
    const { rows } = await bancada.pool.query<{ introducao_vista_em: Date | null }>('select introducao_vista_em from usuario where id = $1', [usuarioId])
    if (rows[0] === undefined) throw new Error('usuário de teste não encontrado')
    return rows[0].introducao_vista_em?.toISOString() ?? null
  }

  const gravarNoBanco = (usuarioId: string, data: string) => bancada.pool.query('update usuario set introducao_vista_em = $2 where id = $1', [usuarioId, data])

  async function usuarioDaMesmaConta(origem: SessaoDeTeste, escolaId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>('select id from usuario where escola_id = $1 and conta_id = (select conta_id from usuario where id = $2)', [escolaId, origem.usuarioId])
    const id = rows[0]?.id
    if (id === undefined) throw new Error('o usuário da mesma conta não existe')
    return id
  }

  /** A professora que dá aula em duas escolas, A e B, sem ano letivo em nenhuma: a escola recém-criada. */
  async function professoraEmDuasEscolas() {
    const a = await bancada.escola()
    const b = await bancada.escola()
    const emA = await bancada.sessao(a, 'professor')
    const tokenB = await bancada.sessaoDaMesmaConta(emA.usuarioId, b)
    return { a, b, emA, tokenB, usuarioB: await usuarioDaMesmaConta(emA, b) }
  }

  const inserirAno = (escolaId: string, ano: number, situacao: 'planejado' | 'em_curso' | 'encerrado') =>
    bancada.pool.query('insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, $2::smallint, make_date($2::int, 2, 1), make_date($2::int, 12, 15), $3)', [escolaId, ano, situacao])

  /** Faz toda escrita na linha falhar no banco, até o `soltar`: a falha é do Postgres, e não de um mock do repository. */
  async function quebrarAEscritaDe(usuarioId: string): Promise<() => Promise<void>> {
    const nome = `falha_introducao_${randomBytes(6).toString('hex')}`
    await bancada.pool.query(`create function ${nome}() returns trigger language plpgsql as $$ begin raise exception 'falha forçada da gravação da introdução'; end $$`)
    await bancada.pool.query(`create trigger ${nome} before update on usuario for each row when (new.id = '${usuarioId}') execute function ${nome}()`)
    return async () => {
      await bancada.pool.query(`drop trigger ${nome} on usuario`)
      await bancada.pool.query(`drop function ${nome}()`)
    }
  }

  async function falhasContadas(): Promise<number> {
    const [ponto] = await medidor.pontos(METRICS.introducaoFalha)
    return typeof ponto?.valor === 'number' ? ponto.valor : 0
  }

  it.each(['coordenador', 'professor', 'aluno'] as const)('caminho feliz (%s): nulo antes do POST, a data depois, e o POST responde essa mesma data', async (papel: PapelDeUsuario) => {
    const sessao = await bancada.escolaComSessao(papel)
    expect(await dataNoEu(sessao.token)).toBeNull()

    const resposta = await concluir(sessao.token)

    expect(resposta.status).toBe(200)
    const data = resposta.corpo['introducaoVistaEm']
    expect(typeof data).toBe('string')
    expect(Object.keys(resposta.corpo)).toEqual(['introducaoVistaEm'])
    expect(await dataNoEu(sessao.token)).toBe(data)
    expect(await dataNoBanco(sessao.usuarioId)).toBe(data)
    // `chamar` não devolve cabeçalhos: o segundo POST, idempotente, confere o `no-store`.
    const bruta = await fetch(`${api.url}/v1/eu/introducao`, { method: 'POST', headers: { Authorization: `Bearer ${sessao.token}` } })
    expect(bruta.headers.get('cache-control')).toBe('no-store')
  })

  it('borda: o segundo POST devolve a primeira data, e a virada do ano letivo não a apaga', async () => {
    const sessao = await bancada.escolaComSessao('professor')
    await inserirAno(sessao.escolaId, 2026, 'em_curso')
    const primeira = await dataDoPost(sessao.token)

    await bancada.pool.query("update ano_letivo set situacao = 'encerrado' where escola_id = $1", [sessao.escolaId])
    await inserirAno(sessao.escolaId, 2027, 'em_curso')
    const segunda = await concluir(sessao.token, {})

    expect(segunda.status).toBe(200)
    expect(segunda.corpo['introducaoVistaEm']).toBe(primeira)
    expect(await dataNoEu(sessao.token)).toBe(primeira)
  })

  it('permissão: sem sessão é 401, e campo no corpo é ENTRADA_INVALIDA; em nenhum dos dois a linha é gravada', async () => {
    const sessao = await bancada.escolaComSessao('aluno')

    expect((await concluir(undefined)).status).toBe(401)
    for (const corpo of [{ introducaoVistaEm: DATA_ANTIGA }, { usuarioId: sessao.usuarioId }, { escolaId: sessao.escolaId }]) {
      const resposta = await concluir(sessao.token, corpo)
      expect(resposta.corpo.erro?.codigo, JSON.stringify(Object.keys(corpo))).toBe(ErrorCode.ENTRADA_INVALIDA)
    }
    expect(await dataNoBanco(sessao.usuarioId)).toBeNull()
  })

  it.each(['aluno', 'professor'] as const)('só a própria linha (%s): dois da mesma escola, um faz o POST e a linha do outro fica nula, com o /v1/eu dele nulo', async (papel: PapelDeUsuario) => {
    const escola = await bancada.escola()
    const [quemMarca, colega] = await bancada.sessoes(escola, { papel, quantidade: 2 })
    if (quemMarca === undefined || colega === undefined) throw new Error('sessões de teste não criadas')

    const resposta = await concluir(quemMarca.token)

    expect(resposta.status).toBe(200)
    expect(await dataNoBanco(quemMarca.usuarioId)).toBe(resposta.corpo['introducaoVistaEm'])
    expect(await dataNoBanco(colega.usuarioId)).toBeNull()
    expect(await dataNoEu(colega.token)).toBeNull()
  })

  it('escola sem ano em curso, e entre anos (um encerrado, um planejado): o POST dá 200 e o GET devolve a data', async () => {
    const semAno = await bancada.escolaComSessao('professor')
    const entreAnos = await bancada.escolaComSessao('professor')
    await inserirAno(entreAnos.escolaId, 2025, 'encerrado')
    await inserirAno(entreAnos.escolaId, 2027, 'planejado')

    for (const sessao of [semAno, entreAnos]) {
      const resposta = await concluir(sessao.token)
      expect(resposta.status, sessao.escolaId).toBe(200)
      expect(await dataNoEu(sessao.token), sessao.escolaId).toBe(resposta.corpo['introducaoVistaEm'])
    }
  })

  it('coalesce: com uma data antiga já gravada, o POST repetido e dois em paralelo devolvem exatamente ela', async () => {
    const sessao = await bancada.escolaComSessao('aluno')
    await gravarNoBanco(sessao.usuarioId, DATA_ANTIGA)

    const repetido = await concluir(sessao.token)
    const [um, dois] = await Promise.all([concluir(sessao.token), concluir(sessao.token)])

    expect([repetido.status, um.status, dois.status]).toEqual([200, 200, 200])
    expect([repetido.corpo['introducaoVistaEm'], um.corpo['introducaoVistaEm'], dois.corpo['introducaoVistaEm']]).toEqual([DATA_ANTIGA, DATA_ANTIGA, DATA_ANTIGA])
    expect(await dataNoBanco(sessao.usuarioId)).toBe(DATA_ANTIGA)
  })

  it('concorrência: dois POST juntos respondem 200 com a mesma data, e a linha guarda essa', async () => {
    const sessao = await bancada.escolaComSessao('professor')

    const [um, dois] = await Promise.all([concluir(sessao.token), concluir(sessao.token)])

    expect([um.status, dois.status]).toEqual([200, 200])
    expect(um.corpo['introducaoVistaEm']).toBe(dois.corpo['introducaoVistaEm'])
    expect(await dataNoBanco(sessao.usuarioId)).toBe(um.corpo['introducaoVistaEm'])
  })

  describe('a professora de duas escolas', () => {
    it('duas escolas: marca em A, o /v1/eu em B devolve a de A e grava now() em B, nunca a de A; com datas nas duas vale a mais antiga, e o POST responde essa', async () => {
      const { emA, tokenB, usuarioB } = await professoraEmDuasEscolas()
      await gravarNoBanco(emA.usuarioId, DATA_ANTIGA)
      expect(await dataNoBanco(usuarioB)).toBeNull()

      expect(await dataNoEu(tokenB)).toBe(DATA_ANTIGA)

      const gravadaEmB = await dataNoBanco(usuarioB)
      expect(gravadaEmB).not.toBeNull()
      expect(gravadaEmB).not.toBe(DATA_ANTIGA)
      expect(new Date(gravadaEmB ?? '').getTime()).toBeGreaterThan(new Date(DATA_ANTIGA).getTime())
      expect(await dataNoBanco(emA.usuarioId)).toBe(DATA_ANTIGA)
      expect(await dataNoEu(emA.token)).toBe(DATA_ANTIGA)
      expect(await dataDoPost(tokenB)).toBe(DATA_ANTIGA)
      expect(await dataNoBanco(usuarioB)).toBe(gravadaEmB)
    })

    it('com a data de B mais antiga que a de A, vale a de B, no GET e no POST', async () => {
      const { emA, tokenB, usuarioB } = await professoraEmDuasEscolas()
      await gravarNoBanco(emA.usuarioId, OUTRA_DATA)
      await gravarNoBanco(usuarioB, DATA_ANTIGA)

      expect(await dataNoEu(tokenB)).toBe(DATA_ANTIGA)
      expect(await dataNoEu(emA.token)).toBe(DATA_ANTIGA)
      expect(await dataDoPost(emA.token)).toBe(DATA_ANTIGA)
      expect(await dataNoBanco(usuarioB)).toBe(DATA_ANTIGA)
    })

    it('escrita do GET, só a própria linha: o colega de B sem data continua nulo, com o /v1/eu dele nulo', async () => {
      const { b, emA, tokenB, usuarioB } = await professoraEmDuasEscolas()
      const colegaDeB = await bancada.sessao(b, 'professor')
      await concluir(emA.token)

      expect(await dataNoEu(tokenB)).not.toBeNull()

      expect(await dataNoBanco(usuarioB)).not.toBeNull()
      expect(await dataNoBanco(colegaDeB.usuarioId)).toBeNull()
      expect(await dataNoEu(colegaDeB.token)).toBeNull()
    })

    it('vínculo encerrado (RF12): marca em A, lê em B, A é desativada, e B continua com a data', async () => {
      const { a, emA, tokenB, usuarioB } = await professoraEmDuasEscolas()
      const marcadaEmA = await dataDoPost(emA.token)
      expect(await dataNoEu(tokenB)).toBe(marcadaEmA)

      await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [a, emA.usuarioId])

      const depois = await dataNoEu(tokenB)
      expect(depois).not.toBeNull()
      expect(depois).toBe(await dataNoBanco(usuarioB))
    })

    it('sem GET intermediário: marca em A, A é desativada, e o primeiro /v1/eu em B devolve nulo (o desativado não empresta)', async () => {
      const { a, emA, tokenB } = await professoraEmDuasEscolas()
      await concluir(emA.token)
      await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [a, emA.usuarioId])

      expect(await dataNoEu(tokenB)).toBeNull()
    })

    it('B sem ano em curso, com A tendo ano e sem ter: o GET grava e responde, sem exigir ano', async () => {
      const comAnoEmA = await professoraEmDuasEscolas()
      await inserirAno(comAnoEmA.a, 2026, 'em_curso')
      await gravarNoBanco(comAnoEmA.emA.usuarioId, DATA_ANTIGA)
      const semAnoEmA = await professoraEmDuasEscolas()
      await gravarNoBanco(semAnoEmA.emA.usuarioId, DATA_ANTIGA)

      for (const { tokenB, usuarioB } of [comAnoEmA, semAnoEmA]) {
        const resposta = await lerEu(tokenB)
        expect(resposta.status).toBe(200)
        expect(resposta.corpo['introducaoVistaEm']).toBe(DATA_ANTIGA)
        expect(await dataNoBanco(usuarioB)).not.toBeNull()
      }
    })

    it('corrida do GET: dois GET juntos em B, e um GET com um POST, mantêm a primeira data gravada', async () => {
      const { emA, tokenB, usuarioB } = await professoraEmDuasEscolas()
      await gravarNoBanco(emA.usuarioId, DATA_ANTIGA)

      const [um, dois] = await Promise.all([lerEu(tokenB), lerEu(tokenB)])
      expect([um.status, dois.status]).toEqual([200, 200])
      expect([um.corpo['introducaoVistaEm'], dois.corpo['introducaoVistaEm']]).toEqual([DATA_ANTIGA, DATA_ANTIGA])
      const primeira = await dataNoBanco(usuarioB)
      expect(primeira).not.toBeNull()
      await lerEu(tokenB)
      expect(await dataNoBanco(usuarioB)).toBe(primeira)

      const outra = await professoraEmDuasEscolas()
      await gravarNoBanco(outra.emA.usuarioId, DATA_ANTIGA)
      const [leitura, escrita] = await Promise.all([lerEu(outra.tokenB), concluir(outra.tokenB)])
      expect([leitura.status, escrita.status]).toEqual([200, 200])
      expect(leitura.corpo['introducaoVistaEm']).toBe(DATA_ANTIGA)
      expect(escrita.corpo['introducaoVistaEm']).toBe(DATA_ANTIGA)
      const gravada = await dataNoBanco(outra.usuarioB)
      expect(gravada).not.toBeNull()
      await Promise.all([lerEu(outra.tokenB), concluir(outra.tokenB)])
      expect(await dataNoBanco(outra.usuarioB)).toBe(gravada)
    })

    it('corrida do GET, com um valor conhecido: dois GET parados na trava da linha de B, vale a gravação do primeiro', async () => {
      const { emA, tokenB, usuarioB } = await professoraEmDuasEscolas()
      await gravarNoBanco(emA.usuarioId, DATA_ANTIGA)
      const trava = await bancada.pool.connect()
      let respostas: Promise<unknown> = Promise.resolve()
      try {
        // Duas premissas do Postgres. A trava da linha é entregue na ordem de chegada, então o primeiro GET grava antes do
        // segundo. E o now() do update avulso de marcarIntroducaoVista é a hora do início da instrução, antes da espera na
        // trava. Com clock_timestamp() no repository, o primeiro GET gravaria a hora de depois do commit, e este caso ficaria
        // vermelho mesmo com o coalesce certo.
        await trava.query('begin')
        await trava.query('select id from usuario where id = $1 for update', [usuarioB])
        const primeiro = lerEu(tokenB)
        await esperarNaTrava(bancada.pool, '%update "usuario"%', 1)
        // Tudo o que o segundo GET escrever tem hora de depois deste instante; o que o primeiro escreveu, de antes.
        const { rows } = await bancada.pool.query<{ agora: string }>('select clock_timestamp()::text as agora')
        const aPartirDoSegundo = rows[0]?.agora
        if (aPartirDoSegundo === undefined) throw new Error('o banco não devolveu a hora')
        const segundo = lerEu(tokenB)
        await esperarNaTrava(bancada.pool, '%update "usuario"%', 2)
        await trava.query('commit')
        respostas = Promise.all([primeiro, segundo])
        const [um, dois] = (await respostas) as [Awaited<typeof primeiro>, Awaited<typeof segundo>]

        expect([um.status, dois.status]).toEqual([200, 200])
        const { rows: conferencia } = await bancada.pool.query<{ do_primeiro: boolean }>('select introducao_vista_em < $2::timestamptz as do_primeiro from usuario where id = $1', [usuarioB, aPartirDoSegundo])
        expect(conferencia[0]?.do_primeiro, 'a data da linha é a da gravação do primeiro GET, e o segundo não a sobrescreveu').toBe(true)
      } finally {
        await trava.query('rollback').catch(() => undefined)
        trava.release()
        await respostas.catch(() => undefined)
      }
    })

    it('gravação do GET que falha no banco: devolve a data lida, não grava, e a falha conta num contador sem rótulo', async () => {
      const { emA, tokenB, usuarioB } = await professoraEmDuasEscolas()
      await gravarNoBanco(emA.usuarioId, DATA_ANTIGA)
      const antes = await falhasContadas()
      const soltar = await quebrarAEscritaDe(usuarioB)
      try {
        const resposta = await lerEu(tokenB)

        expect(resposta.status).toBe(200)
        expect(resposta.corpo['introducaoVistaEm']).toBe(DATA_ANTIGA)
        expect(await dataNoBanco(usuarioB)).toBeNull()
        expect(await falhasContadas()).toBe(antes + 1)
        expect((await medidor.pontos(METRICS.introducaoFalha)).map((ponto) => ponto.atributos)).toEqual([{}])
      } finally {
        await soltar()
      }
      // Sem a falha, a leitura seguinte grava.
      expect(await dataNoEu(tokenB)).toBe(DATA_ANTIGA)
      expect(await dataNoBanco(usuarioB)).not.toBeNull()
    })

    it('dois papéis: professora em A e coordenadora em B não herdam uma da outra', async () => {
      const a = await bancada.escola()
      const b = await bancada.escola()
      const professoraEmA = await bancada.sessao(a, 'professor')
      const tokenEmB = await bancada.sessaoDaMesmaConta(professoraEmA.usuarioId, b)
      const usuarioEmB = await usuarioDaMesmaConta(professoraEmA, b)
      await bancada.pool.query("update usuario set papel = 'coordenador' where id = $1", [usuarioEmB])
      await concluir(professoraEmA.token)

      expect(await dataNoEu(tokenEmB)).toBeNull()
      expect(await dataNoBanco(usuarioEmB)).toBeNull()
      // E o contrário: a coordenadora marca em B, e a professora de A segue com a dela.
      expect(await dataDoPost(tokenEmB)).not.toBeNull()
      expect(await dataNoEu(professoraEmA.token)).toBe(await dataNoBanco(professoraEmA.usuarioId))
    })

    it('outra conta com a data gravada não empresta, e a eliminação agendada de A não empresta', async () => {
      const { a, emA, tokenB } = await professoraEmDuasEscolas()
      const outraConta = await bancada.escolaComSessao('professor')
      await concluir(outraConta.token)
      expect(await dataNoEu(tokenB)).toBeNull()

      await concluir(emA.token)
      await bancada.pool.query('update usuario set eliminacao_agendada_em = now() where escola_id = $1 and id = $2', [a, emA.usuarioId])
      expect(await dataNoEu(tokenB)).toBeNull()
    })

    it('a data não sai em acessos: o seletor segue com os quatro campos de sempre', async () => {
      const { emA, tokenB } = await professoraEmDuasEscolas()
      await gravarNoBanco(emA.usuarioId, DATA_ANTIGA)

      const acessos = (await lerEu(tokenB)).corpo['acessos'] as Array<Record<string, unknown>>
      expect(acessos).toHaveLength(2)
      for (const acesso of acessos) expect(Object.keys(acesso).sort()).toEqual(['escolaNome', 'papel', 'redeNome', 'usuarioId'])
    })
  })
})
