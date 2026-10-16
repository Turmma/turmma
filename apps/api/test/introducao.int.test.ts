import { METRICAS } from '@educa/nucleo'
import { CodigoDeErro, type PapelDeUsuario } from '@educa/shared'
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste } from './api-com-sessao.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/** Uma data antiga e conhecida, alinhada ao milissegundo: o que o JavaScript lê do banco é o que o banco guardou. */
const DATA_ANTIGA = '2020-01-02T03:04:05.678Z'
const OUTRA_DATA_ANTIGA = '2021-05-06T07:08:09.123Z'

describe('POST /v1/eu/introducao e GET /v1/eu: a pessoa marca que viu a introdução, e a data é só dela', () => {
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
  const concluir = (token: string, corpo?: unknown) => chamar(api.url, 'POST', '/v1/eu/introducao', token, corpo)
  const vistaNoEu = async (token: string): Promise<unknown> => (await lerEu(token)).corpo['introducaoVistaEm']

  /** A data da linha, como o banco a guarda, no formato da resposta. */
  async function vistaNoBanco(usuarioId: string): Promise<string | null> {
    const { rows } = await bancada.pool.query<{ introducao_vista_em: Date | null }>('select introducao_vista_em from usuario where id = $1', [usuarioId])
    if (rows[0] === undefined) throw new Error('usuário de teste não encontrado')
    return rows[0].introducao_vista_em?.toISOString() ?? null
  }

  const gravarNoBanco = (usuarioId: string, data: string) => bancada.pool.query('update usuario set introducao_vista_em = $2 where id = $1', [usuarioId, data])

  /** O usuário da mesma conta que `origem`, na escola dada. */
  async function usuarioDaMesmaConta(origem: SessaoDeTeste, escolaId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>('select id from usuario where escola_id = $1 and conta_id = (select conta_id from usuario where id = $2)', [escolaId, origem.usuarioId])
    const id = rows[0]?.id
    if (id === undefined) throw new Error('o usuário da mesma conta não existe')
    return id
  }

  /** A professora que dá aula em duas escolas, A e B, sem ano letivo em nenhuma (a escola recém-criada). */
  async function professoraEmDuasEscolas() {
    const a = await bancada.escola()
    const b = await bancada.escola()
    const emA = await bancada.sessao(a, 'professor')
    const tokenB = await bancada.sessaoDaMesmaConta(emA.usuarioId, b)
    const usuarioB = await usuarioDaMesmaConta(emA, b)
    return { a, b, emA, tokenB, usuarioB }
  }

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

  async function naoGravadas(): Promise<number> {
    const [ponto] = await medidor.pontos(METRICAS.introducaoNaoGravada)
    return typeof ponto?.valor === 'number' ? ponto.valor : 0
  }

  it.each(['coordenador', 'professor', 'aluno'] as const)('caminho feliz (%s): o /v1/eu devolve nulo antes do POST e a data depois, e a resposta do POST é a mesma data', async (papel: PapelDeUsuario) => {
    const sessao = await bancada.escolaComSessao(papel)
    expect(await vistaNoEu(sessao.token)).toBeNull()

    const resposta = await concluir(sessao.token)

    expect(resposta.status).toBe(200)
    // `chamar` não devolve os cabeçalhos; o segundo POST é idempotente.
    const bruta = await fetch(`${api.url}/v1/eu/introducao`, { method: 'POST', headers: { Authorization: `Bearer ${sessao.token}` } })
    expect(bruta.headers.get('cache-control')).toBe('no-store')
    const data = resposta.corpo['introducaoVistaEm']
    expect(typeof data).toBe('string')
    expect(Object.keys(resposta.corpo)).toEqual(['introducaoVistaEm'])
    expect(await vistaNoEu(sessao.token)).toBe(data)
    expect(await vistaNoBanco(sessao.usuarioId)).toBe(data)
  })

  it('borda: o segundo POST devolve a primeira data, e a virada do ano letivo não a apaga', async () => {
    const sessao = await bancada.escolaComSessao('professor')
    const inserirAno = (ano: number, situacao: string) =>
      bancada.pool.query("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, $2::smallint, make_date($2::int, 2, 1), make_date($2::int, 12, 15), $3)", [sessao.escolaId, ano, situacao])
    await inserirAno(2026, 'em_curso')
    const primeira = (await concluir(sessao.token)).corpo['introducaoVistaEm']

    await bancada.pool.query("update ano_letivo set situacao = 'encerrado' where escola_id = $1", [sessao.escolaId])
    await inserirAno(2027, 'em_curso')
    const segunda = await concluir(sessao.token, {})

    expect(segunda.status).toBe(200)
    expect(segunda.corpo['introducaoVistaEm']).toBe(primeira)
    expect(await vistaNoEu(sessao.token)).toBe(primeira)
  })

  it('permissão: sem sessão é 401; campo no corpo é ENTRADA_INVALIDA; em nenhum dos dois a linha é gravada', async () => {
    const sessao = await bancada.escolaComSessao('aluno')

    const anonima = await concluir(undefined as unknown as string)
    expect(anonima.status).toBe(401)

    for (const corpo of [{ introducaoVistaEm: DATA_ANTIGA }, { usuarioId: sessao.usuarioId }, { escolaId: sessao.escolaId }]) {
      const resposta = await concluir(sessao.token, corpo)
      expect(resposta.corpo.erro?.codigo, JSON.stringify(Object.keys(corpo))).toBe(CodigoDeErro.ENTRADA_INVALIDA)
    }
    expect(await vistaNoBanco(sessao.usuarioId)).toBeNull()
  })

  it.each(['aluno', 'professor'] as const)('só a própria linha (%s): dois da mesma escola, um faz o POST e a linha do outro fica nula, com o /v1/eu dele nulo', async (papel: PapelDeUsuario) => {
    const escola = await bancada.escola()
    const [quemMarca, colega] = await bancada.sessoes(escola, { papel, quantidade: 2 })
    if (quemMarca === undefined || colega === undefined) throw new Error('sessões de teste não criadas')

    const resposta = await concluir(quemMarca.token)

    expect(resposta.status).toBe(200)
    expect(await vistaNoBanco(quemMarca.usuarioId)).toBe(resposta.corpo['introducaoVistaEm'])
    expect(await vistaNoBanco(colega.usuarioId)).toBeNull()
    expect(await vistaNoEu(colega.token)).toBeNull()
  })

  it('escola sem ano em curso, e entre anos (um encerrado, um planejado): o POST dá 200 e o GET devolve a data', async () => {
    const semAno = await bancada.escolaComSessao('professor')
    const entreAnos = await bancada.escolaComSessao('professor')
    for (const [ano, situacao] of [[2025, 'encerrado'], [2027, 'planejado']] as const) {
      await bancada.pool.query(
        'insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, $2::smallint, make_date($2::int, 2, 1), make_date($2::int, 12, 15), $3)',
        [entreAnos.escolaId, ano, situacao],
      )
    }

    for (const sessao of [semAno, entreAnos]) {
      const resposta = await concluir(sessao.token)
      expect(resposta.status, sessao.escolaId).toBe(200)
      expect(await vistaNoEu(sessao.token), sessao.escolaId).toBe(resposta.corpo['introducaoVistaEm'])
    }
  })

  describe('a professora de duas escolas', () => {
    it('marca em A, e o /v1/eu em B devolve a data de A e grava now() em B, não a de A; com datas nas duas, vale a mais antiga, e o POST responde essa', async () => {
      const { emA, tokenB, usuarioB } = await professoraEmDuasEscolas()
      await gravarNoBanco(emA.usuarioId, DATA_ANTIGA)
      expect(await vistaNoBanco(usuarioB)).toBeNull()

      expect(await vistaNoEu(tokenB)).toBe(DATA_ANTIGA)

      const gravadaEmB = await vistaNoBanco(usuarioB)
      expect(gravadaEmB).not.toBeNull()
      expect(gravadaEmB).not.toBe(DATA_ANTIGA)
      expect(new Date(gravadaEmB ?? '').getTime()).toBeGreaterThan(new Date(DATA_ANTIGA).getTime())
      // A de A fica como estava, e a mais antiga continua valendo nas duas.
      expect(await vistaNoBanco(emA.usuarioId)).toBe(DATA_ANTIGA)
      expect(await vistaNoEu(tokenB)).toBe(DATA_ANTIGA)
      expect(await vistaNoEu(emA.token)).toBe(DATA_ANTIGA)
      expect((await concluir(tokenB)).corpo['introducaoVistaEm']).toBe(DATA_ANTIGA)
      expect(await vistaNoBanco(usuarioB)).toBe(gravadaEmB)
    })

    it('com a data de B mais antiga que a de A, vale a de B', async () => {
      const { emA, tokenB, usuarioB } = await professoraEmDuasEscolas()
      await gravarNoBanco(emA.usuarioId, OUTRA_DATA_ANTIGA)
      await gravarNoBanco(usuarioB, DATA_ANTIGA)

      expect(await vistaNoEu(tokenB)).toBe(DATA_ANTIGA)
      expect(await vistaNoEu(emA.token)).toBe(DATA_ANTIGA)
      expect(await vistaNoBanco(usuarioB)).toBe(DATA_ANTIGA)
    })

    it('a escrita do GET é só da linha da sessão: um colega de B sem data continua nulo', async () => {
      const { b, emA, tokenB, usuarioB } = await professoraEmDuasEscolas()
      const colegaDeB = await bancada.sessao(b, 'professor')
      await concluir(emA.token)

      expect(await vistaNoEu(tokenB)).not.toBeNull()

      expect(await vistaNoBanco(usuarioB)).not.toBeNull()
      expect(await vistaNoBanco(colegaDeB.usuarioId)).toBeNull()
      expect(await vistaNoEu(colegaDeB.token)).toBeNull()
    })

    it('vínculo encerrado: marca em A, lê em B, A é desativada, e B continua com a data (a introdução não reabre)', async () => {
      const { a, emA, tokenB, usuarioB } = await professoraEmDuasEscolas()
      const marcadaEmA = (await concluir(emA.token)).corpo['introducaoVistaEm']
      expect(await vistaNoEu(tokenB)).toBe(marcadaEmA)

      await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [a, emA.usuarioId])

      const depois = await vistaNoEu(tokenB)
      expect(depois).not.toBeNull()
      expect(depois).toBe(await vistaNoBanco(usuarioB))
    })

    it('sem o GET no meio: marca em A, A é desativada, e o primeiro /v1/eu em B devolve nulo (o desativado não empresta)', async () => {
      const { a, emA, tokenB } = await professoraEmDuasEscolas()
      await concluir(emA.token)
      await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [a, emA.usuarioId])

      expect(await vistaNoEu(tokenB)).toBeNull()
    })

    it('B tem ano em curso e A não, e A tem e B não: o GET grava e responde, sem exigir ano', async () => {
      const { b, emA, tokenB, usuarioB } = await professoraEmDuasEscolas()
      await bancada.pool.query("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso')", [b])
      await gravarNoBanco(emA.usuarioId, DATA_ANTIGA)
      expect(await vistaNoEu(tokenB)).toBe(DATA_ANTIGA)
      expect(await vistaNoBanco(usuarioB)).not.toBeNull()

      const outra = await professoraEmDuasEscolas()
      await bancada.pool.query("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso')", [outra.a])
      await gravarNoBanco(outra.emA.usuarioId, DATA_ANTIGA)
      const respostaEmB = await lerEu(outra.tokenB)
      expect(respostaEmB.status).toBe(200)
      expect(respostaEmB.corpo['introducaoVistaEm']).toBe(DATA_ANTIGA)
      expect(await vistaNoBanco(outra.usuarioB)).not.toBeNull()
    })

    it('corrida: dois GET juntos em B, e um GET com um POST, mantêm a primeira data gravada', async () => {
      const { emA, tokenB, usuarioB } = await professoraEmDuasEscolas()
      await gravarNoBanco(emA.usuarioId, DATA_ANTIGA)

      const [um, dois] = await Promise.all([lerEu(tokenB), lerEu(tokenB)])
      expect([um.status, dois.status]).toEqual([200, 200])
      expect([um.corpo['introducaoVistaEm'], dois.corpo['introducaoVistaEm']]).toEqual([DATA_ANTIGA, DATA_ANTIGA])
      const primeira = await vistaNoBanco(usuarioB)
      expect(primeira).not.toBeNull()
      await lerEu(tokenB)
      expect(await vistaNoBanco(usuarioB)).toBe(primeira)

      const outra = await professoraEmDuasEscolas()
      await gravarNoBanco(outra.emA.usuarioId, DATA_ANTIGA)
      const [leitura, escrita] = await Promise.all([lerEu(outra.tokenB), concluir(outra.tokenB)])
      expect(leitura.status).toBe(200)
      expect(escrita.status).toBe(200)
      expect(leitura.corpo['introducaoVistaEm']).toBe(DATA_ANTIGA)
      expect(escrita.corpo['introducaoVistaEm']).toBe(DATA_ANTIGA)
      const gravada = await vistaNoBanco(outra.usuarioB)
      expect(gravada).not.toBeNull()
      await Promise.all([lerEu(outra.tokenB), concluir(outra.tokenB)])
      expect(await vistaNoBanco(outra.usuarioB)).toBe(gravada)
    })

    it('a gravação do GET que falha no banco: o GET devolve a data lida, não grava, e a falha conta num contador sem rótulo', async () => {
      const { emA, tokenB, usuarioB } = await professoraEmDuasEscolas()
      await gravarNoBanco(emA.usuarioId, DATA_ANTIGA)
      const antes = await naoGravadas()
      const soltar = await quebrarAEscritaDe(usuarioB)
      try {
        const resposta = await lerEu(tokenB)

        expect(resposta.status).toBe(200)
        expect(resposta.corpo['introducaoVistaEm']).toBe(DATA_ANTIGA)
        expect(await vistaNoBanco(usuarioB)).toBeNull()
        expect(await naoGravadas()).toBe(antes + 1)
        const pontos = await medidor.pontos(METRICAS.introducaoNaoGravada)
        expect(pontos.map((ponto) => ponto.atributos)).toEqual([{}])
      } finally {
        await soltar()
      }
      // Sem a falha, a próxima leitura grava.
      expect(await vistaNoEu(tokenB)).toBe(DATA_ANTIGA)
      expect(await vistaNoBanco(usuarioB)).not.toBeNull()
    })

    it('o mesmo papel é que empresta: professora em A e coordenadora em B não herdam uma da outra', async () => {
      const a = await bancada.escola()
      const b = await bancada.escola()
      const professoraEmA = await bancada.sessao(a, 'professor')
      const tokenEmB = await bancada.sessaoDaMesmaConta(professoraEmA.usuarioId, b)
      const usuarioEmB = await usuarioDaMesmaConta(professoraEmA, b)
      await bancada.pool.query("update usuario set papel = 'coordenador' where id = $1", [usuarioEmB])
      await concluir(professoraEmA.token)

      expect(await vistaNoEu(tokenEmB)).toBeNull()
      expect(await vistaNoBanco(usuarioEmB)).toBeNull()
      // E o contrário: a coordenadora marca em B, e a professora de A segue com a dela, sem emprestar a de B.
      const marcada = (await concluir(tokenEmB)).corpo['introducaoVistaEm']
      expect(marcada).not.toBeNull()
      expect(await vistaNoEu(professoraEmA.token)).toBe(await vistaNoBanco(professoraEmA.usuarioId))
    })

    it('outra conta com a data gravada não empresta, e a eliminação agendada de A não empresta', async () => {
      const { a, emA, tokenB } = await professoraEmDuasEscolas()
      const outraConta = await bancada.escolaComSessao('professor')
      await concluir(outraConta.token)
      expect(await vistaNoEu(tokenB)).toBeNull()

      await concluir(emA.token)
      await bancada.pool.query('update usuario set eliminacao_agendada_em = now() where escola_id = $1 and id = $2', [a, emA.usuarioId])
      expect(await vistaNoEu(tokenB)).toBeNull()
    })
  })

  it('coalesce: com uma data antiga já gravada, o POST repetido e dois em paralelo devolvem exatamente ela', async () => {
    const sessao = await bancada.escolaComSessao('aluno')
    await gravarNoBanco(sessao.usuarioId, DATA_ANTIGA)

    const [repetido] = [await concluir(sessao.token)]
    const [um, dois] = await Promise.all([concluir(sessao.token), concluir(sessao.token)])

    expect([repetido.status, um.status, dois.status]).toEqual([200, 200, 200])
    expect([repetido.corpo['introducaoVistaEm'], um.corpo['introducaoVistaEm'], dois.corpo['introducaoVistaEm']]).toEqual([DATA_ANTIGA, DATA_ANTIGA, DATA_ANTIGA])
    expect(await vistaNoBanco(sessao.usuarioId)).toBe(DATA_ANTIGA)
  })

  it('concorrência: dois POST juntos respondem 200 com a mesma data, e a linha guarda essa', async () => {
    const sessao = await bancada.escolaComSessao('professor')

    const [um, dois] = await Promise.all([concluir(sessao.token), concluir(sessao.token)])

    expect([um.status, dois.status]).toEqual([200, 200])
    expect(um.corpo['introducaoVistaEm']).toBe(dois.corpo['introducaoVistaEm'])
    expect(await vistaNoBanco(sessao.usuarioId)).toBe(um.corpo['introducaoVistaEm'])
  })

  it('a data não sai em acessos do /v1/eu', async () => {
    const { emA, tokenB } = await professoraEmDuasEscolas()
    await gravarNoBanco(emA.usuarioId, DATA_ANTIGA)

    const resposta = await lerEu(tokenB)
    const acessos = resposta.corpo['acessos'] as Array<Record<string, unknown>>
    expect(acessos).toHaveLength(2)
    for (const acesso of acessos) expect(Object.keys(acesso).sort()).toEqual(['escolaNome', 'papel', 'redeNome', 'usuarioId'])
  })
})
