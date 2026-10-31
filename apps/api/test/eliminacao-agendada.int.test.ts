import { diaDeUso, runInContext } from '@educa/core'
import { CicloDeVidaRepository, CicloDeVidaService } from '@educa/core/ciclo-de-vida'
import { ErrorCode, MENSAGENS_DE_ERRO, PRAZO_DA_ELIMINACAO_DIAS } from '@educa/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { PedidosRepository } from '../src/privacidade/pedidos.repository.js'
import { PasswordHasher } from '../src/credencial/index.js'
import { chamar, renovar, subirApi, type ApiDeTeste } from './test-api.js'
import { montarEscolaComTurma } from './escola-turma.fixture.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao.fixture.js'

/**
 * A eliminação agendada por 7 dias, com o acesso suspenso e o cancelamento (F3, tarefa 14.0;
 * `tasks/prd-lgpd-e-titular/cenarios.md`, RF14): registrar a eliminação suspende o acesso na requisição seguinte, sem
 * revelar nada a quem não tem a credencial, e cancelar devolve o acesso com a mesma senha. O aluno entra pelo login real
 * por matrícula (o teste do login em si é `sessao-matricula.int.test.ts`), de modo que as sessões, os tokens e os cookies de
 * renovação são os que o produto emite. Matrículas e nomes são gerados e sintéticos (regra 20, item 17).
 */

const SENHA = 'senha-sintetica-do-aluno-14'
const SENHA_ERRADA = 'senha-sintetica-errada-14'
const HOJE = (): string => diaDeUso(new Date())
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

interface Entrada {
  readonly status: number
  readonly corpo: Record<string, unknown> & { erro?: { codigo?: string; mensagem?: string; requisicaoId?: string } }
  readonly setCookie: string[]
}

/** A resposta sem o `requisicaoId`, que muda a cada chamada: o resto precisa ser idêntico. */
function semRequisicao(entrada: Pick<Entrada, 'status' | 'corpo'>): unknown {
  if (entrada.corpo.erro === undefined) return { status: entrada.status, corpo: entrada.corpo }
  const { requisicaoId: _requisicaoId, ...erro } = entrada.corpo.erro
  return { status: entrada.status, corpo: { ...entrada.corpo, erro } }
}

const ACESSO_SUSPENSO = {
  status: 403,
  corpo: { erro: { codigo: ErrorCode.ACESSO_SUSPENSO, mensagem: MENSAGENS_DE_ERRO.ACESSO_SUSPENSO } },
}
const NAO_AUTENTICADO = {
  status: 401,
  corpo: { erro: { codigo: ErrorCode.NAO_AUTENTICADO, mensagem: MENSAGENS_DE_ERRO.NAO_AUTENTICADO } },
}
const NAO_ENCONTRADO = {
  status: 404,
  corpo: { erro: { codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO } },
}
const ESTADO_INVALIDO = {
  status: 409,
  corpo: { erro: { codigo: ErrorCode.PEDIDO_EM_ESTADO_INVALIDO, mensagem: MENSAGENS_DE_ERRO.PEDIDO_EM_ESTADO_INVALIDO } },
}

describe('eliminação agendada (F3, tarefa 14.0): suspende o acesso, não revela e o cancelamento devolve', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: ApiDeTeste
  let hash: PasswordHasher
  let hashDaSenha: string
  let verificacoes: ReturnType<typeof vi.spyOn>

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_USUARIO_MIN: '1000', LIMITE_REQ_ESCOLA_MIN: '1000', LOGIN_HASH_CONCORRENCIA: '4' } }, linhasDeLog)
    hash = api.app.get(PasswordHasher)
    verificacoes = vi.spyOn(hash, 'verificar')
    hashDaSenha = await hash.gerar(SENHA)
  })

  beforeEach(() => {
    verificacoes.mockClear()
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  // ─── montagem ──────────────────────────────────────────────────────────────────────────────────────────────────────

  interface EscolaDeTeste {
    readonly escolaId: string
    readonly slug: string
    readonly coordenacao: SessaoDeTeste
  }

  interface AlunoDeTeste {
    readonly usuarioId: string
    readonly matricula: string
  }

  /** Uma escola com o ano letivo em curso (o pedido do titular calcula o homônimo e o compartilhamento dentro dele). */
  async function escolaNova(): Promise<EscolaDeTeste> {
    const { coordenacao } = await montarEscolaComTurma(api, bancada)
    return { escolaId: coordenacao.escolaId, slug: await bancada.slugDe(coordenacao.escolaId), coordenacao }
  }

  async function aluno(escolaId: string): Promise<AlunoDeTeste> {
    const matricula = `RA${randomBytes(6).toString('hex').toUpperCase()}`
    const [usuarioId] = await bancada.alunosComMatricula(escolaId, [{ matricula, senhaHash: hashDaSenha }])
    if (usuarioId === undefined) throw new Error('aluno de teste não criado')
    return { usuarioId, matricula }
  }

  async function entrar(slug: string, matricula: string, senha = SENHA): Promise<Entrada> {
    const resposta = await fetch(`${api.url}/v1/sessao/matricula`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, matricula, senha }),
    })
    return { status: resposta.status, corpo: (await resposta.json()) as Entrada['corpo'], setCookie: resposta.headers.getSetCookie() }
  }

  /** O `Cookie` de renovação que o navegador guardou depois deste login. */
  function cookieDeRenovacao(entrada: Entrada): string {
    const linha = entrada.setCookie.find((valor) => valor.startsWith('educa_sessao='))
    if (linha === undefined) throw new Error('o login não trouxe educa_sessao')
    return linha.split(';')[0] ?? ''
  }

  const tokenDe = (entrada: Entrada): string => String(entrada.corpo['token'])
  const eu = (token: string) => chamar(api.url, 'GET', '/v1/eu', token)

  const registrarEliminacao = (coordenacao: SessaoDeTeste, titularId: string, extras: Record<string, unknown> = {}) =>
    chamar(api.url, 'POST', '/v1/privacidade/pedidos', coordenacao.token, { titularId, tipo: 'eliminacao', solicitante: 'titular', chegouEm: HOJE(), chaveEnvio: randomUUID(), ...extras })
  const cancelar = (coordenacao: SessaoDeTeste, pedidoId: string) => chamar(api.url, 'POST', `/v1/privacidade/pedidos/${pedidoId}/cancelar`, coordenacao.token, {})

  /** O pedido de eliminação registrado: confere o 201 e devolve o id. */
  async function agendar(coordenacao: SessaoDeTeste, titularId: string): Promise<string> {
    const registrado = await registrarEliminacao(coordenacao, titularId)
    expect(registrado.status).toBe(201)
    return String(registrado.corpo['id'])
  }

  async function agendadaEm(usuarioId: string): Promise<Date | null> {
    const { rows } = await bancada.pool.query<{ eliminacao_agendada_em: Date | null }>('select eliminacao_agendada_em from usuario where id = $1', [usuarioId])
    return rows[0]?.eliminacao_agendada_em ?? null
  }

  async function sessoesDe(usuarioId: string): Promise<Array<{ motivo: string | null; encerrada: boolean }>> {
    const { rows } = await bancada.pool.query<{ motivo: string | null; encerrada: boolean }>('select motivo, encerrada_em is not null as encerrada from sessao where usuario_id = $1 order by id', [usuarioId])
    return rows
  }

  interface PedidoNoBanco {
    readonly estado: string
    readonly tipo: string
    readonly eliminar_em: Date | null
    readonly cancelado_em: Date | null
    readonly cancelado_por: string | null
    readonly segundos_ate_eliminar: number | null
  }

  async function pedidoNoBanco(id: string): Promise<PedidoNoBanco> {
    const { rows } = await bancada.pool.query<PedidoNoBanco>(
      `select estado, tipo, eliminar_em, cancelado_em, cancelado_por, extract(epoch from (eliminar_em - registrado_em))::float8 as segundos_ate_eliminar from pedido_titular where id = $1`,
      [id],
    )
    const [linha] = rows
    if (linha === undefined) throw new Error('pedido de teste não encontrado')
    return linha
  }

  async function auditoriasDa(escolaId: string, acao: string): Promise<Array<{ entidade: string; entidade_id: string; autor_usuario_id: string | null; antes: unknown; depois: unknown }>> {
    const { rows } = await bancada.pool.query('select entidade, entidade_id, autor_usuario_id, antes, depois from auditoria where escola_id = $1 and acao = $2 order by id', [escolaId, acao])
    return rows
  }

  async function falhasDeLogin(escolaId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ total: number }>(`select count(*)::int as total from registro_acesso where escola_id = $1 and evento = 'login_falho'`, [escolaId])
    return rows[0]?.total ?? 0
  }

  async function sessoesAbertasDaEscola(escolaId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ total: number }>('select count(*)::int as total from sessao where escola_id = $1', [escolaId])
    return rows[0]?.total ?? 0
  }

  // ─── registro ──────────────────────────────────────────────────────────────────────────────────────────────────────

  describe('registrar a eliminação', () => {
    it('agenda o pedido para 7 dias, suspende o acesso e encerra as sessões da pessoa com o motivo, sem tocar nas dos colegas', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      const colega = await aluno(escolaId)
      const primeira = await entrar(slug, titular.matricula)
      const segunda = await entrar(slug, titular.matricula)
      const doColega = await entrar(slug, colega.matricula)
      for (const entrada of [primeira, segunda, doColega]) expect((await eu(tokenDe(entrada))).status).toBe(200)
      expect(await agendadaEm(titular.usuarioId)).toBeNull()

      const registrado = await registrarEliminacao(coordenacao, titular.usuarioId)

      expect(registrado.status).toBe(201)
      expect(registrado.corpo).toMatchObject({ tipo: 'eliminacao', estado: 'agendado' })
      const id = String(registrado.corpo['id'])
      // O instante da eliminação é o do registro mais os 7 dias, pelo relógio do banco (um só, o da transação).
      const pedido = await pedidoNoBanco(id)
      expect(pedido).toMatchObject({ estado: 'agendado', tipo: 'eliminacao' })
      expect(pedido.segundos_ate_eliminar).toBe(PRAZO_DA_ELIMINACAO_DIAS * 86_400)
      expect(await agendadaEm(titular.usuarioId)).not.toBeNull()
      // As duas sessões abertas da pessoa terminam com o motivo; a do colega continua aberta.
      expect(await sessoesDe(titular.usuarioId)).toEqual([
        { motivo: 'eliminacao_agendada', encerrada: true },
        { motivo: 'eliminacao_agendada', encerrada: true },
      ])
      expect(await sessoesDe(colega.usuarioId)).toEqual([{ motivo: null, encerrada: false }])
      // Na requisição seguinte, o token que valia até agora não vale mais; o do colega segue valendo.
      expect(semRequisicao(await eu(tokenDe(primeira)))).toEqual(semRequisicao({ status: 401, corpo: NAO_AUTENTICADO.corpo }))
      expect((await eu(tokenDe(segunda))).status).toBe(401)
      expect((await eu(tokenDe(doColega))).status).toBe(200)
      expect(await agendadaEm(colega.usuarioId)).toBeNull()
    })

    it('audita o registro e o agendamento, na ordem, sem nome nem matrícula: o instante e quantas sessões foram encerradas', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      await entrar(slug, titular.matricula)
      await entrar(slug, titular.matricula)

      const id = await agendar(coordenacao, titular.usuarioId)

      const registrados = await auditoriasDa(escolaId, 'pedido.registrado')
      const agendados = await auditoriasDa(escolaId, 'pedido.agendado')
      expect(registrados).toHaveLength(1)
      expect(agendados).toHaveLength(1)
      expect(agendados[0]).toMatchObject({ entidade: 'pedido_titular', entidade_id: id, autor_usuario_id: coordenacao.usuarioId, antes: null })
      const { eliminar_em: eliminarEm } = await pedidoNoBanco(id)
      expect(agendados[0]?.depois).toEqual({ eliminarEm: eliminarEm?.toISOString(), sessoesEncerradas: 3 })
      expect(JSON.stringify([registrados, agendados])).not.toContain(titular.matricula)
    })

    it('uma segunda eliminação do mesmo titular, com outra chave, é recusada sem gravar nada: o pedido agendado é um só', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      const primeiro = await agendar(coordenacao, titular.usuarioId)
      const agendadaAntes = await agendadaEm(titular.usuarioId)

      const segunda = await registrarEliminacao(coordenacao, titular.usuarioId)

      expect(semRequisicao(segunda)).toEqual(ESTADO_INVALIDO)
      const { rows } = await bancada.pool.query<{ id: string }>(`select id from pedido_titular where escola_id = $1 and tipo = 'eliminacao'`, [escolaId])
      expect(rows.map((linha) => linha.id)).toEqual([primeiro])
      expect(await auditoriasDa(escolaId, 'pedido.agendado')).toHaveLength(1)
      // A data da suspensão não anda: a segunda tentativa não reagenda.
      expect(await agendadaEm(titular.usuarioId)).toEqual(agendadaAntes)
    })

    it('[P] duas eliminações do mesmo titular ao mesmo tempo, com chaves diferentes: uma agenda e a outra recebe PEDIDO_EM_ESTADO_INVALIDO', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)

      const respostas = await Promise.all([registrarEliminacao(coordenacao, titular.usuarioId), registrarEliminacao(coordenacao, titular.usuarioId)])

      expect(respostas.map((resposta) => resposta.status).sort()).toEqual([201, 409])
      const recusada = respostas.find((resposta) => resposta.status === 409)
      expect(recusada && semRequisicao(recusada)).toEqual(ESTADO_INVALIDO)
      const { rows } = await bancada.pool.query<{ total: number }>(`select count(*)::int as total from pedido_titular where escola_id = $1 and estado = 'agendado'`, [escolaId])
      expect(rows[0]?.total).toBe(1)
      expect(await auditoriasDa(escolaId, 'pedido.agendado')).toHaveLength(1)
      expect(await sessoesDe(titular.usuarioId)).toEqual([{ motivo: 'eliminacao_agendada', encerrada: true }])
    })

    it('a mesma chave de envio duas vezes devolve o mesmo pedido e agenda uma vez só: o reenvio não encerra de novo nem audita de novo', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      const chaveEnvio = randomUUID()

      const primeira = await registrarEliminacao(coordenacao, titular.usuarioId, { chaveEnvio })
      const reenvio = await registrarEliminacao(coordenacao, titular.usuarioId, { chaveEnvio })

      expect([primeira.status, reenvio.status]).toEqual([201, 201])
      expect(reenvio.corpo['id']).toBe(primeira.corpo['id'])
      expect(await auditoriasDa(escolaId, 'pedido.agendado')).toHaveLength(1)
    })

    it('os outros tipos de pedido não suspendem ninguém: o acesso e a portabilidade seguem com a pessoa entrando', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      const entrada = await entrar(slug, titular.matricula)

      const acesso = await registrarEliminacao(coordenacao, titular.usuarioId, { tipo: 'acesso' })

      expect(acesso.status).toBe(201)
      expect(acesso.corpo['estado']).not.toBe('agendado')
      expect(await agendadaEm(titular.usuarioId)).toBeNull()
      expect((await eu(tokenDe(entrada))).status).toBe(200)
      expect((await entrar(slug, titular.matricula)).status).toBe(200)
      expect(await auditoriasDa(escolaId, 'pedido.agendado')).toHaveLength(0)
    })
  })

  // ─── suspensão ─────────────────────────────────────────────────────────────────────────────────────────────────────

  describe('o acesso suspenso: só quem tem a credencial ouve ACESSO_SUSPENSO', () => {
    it('login por matrícula: a senha certa dá ACESSO_SUSPENSO, sem cookie e sem sessão nova; a senha errada é a de sempre', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await agendar(coordenacao, titular.usuarioId)
      const sessoesAntes = await sessoesAbertasDaEscola(escolaId)
      const falhasAntes = await falhasDeLogin(escolaId)

      const certa = await entrar(slug, titular.matricula)
      // A tentativa que não entrou deixa o registro de acesso de falha, como a recusada.
      expect(await falhasDeLogin(escolaId)).toBe(falhasAntes + 1)
      const errada = await entrar(slug, titular.matricula, SENHA_ERRADA)

      expect(semRequisicao(certa)).toEqual(ACESSO_SUSPENSO)
      expect(certa.corpo.erro?.requisicaoId).toMatch(UUID)
      expect(certa.setCookie).toEqual([])
      expect(await sessoesAbertasDaEscola(escolaId)).toBe(sessoesAntes)
      expect(semRequisicao(errada)).toEqual(NAO_AUTENTICADO)
      expect(errada.setCookie).toEqual([])
    })

    it('não revela: a senha errada na conta suspensa é igual à de uma matrícula que não existe (status, corpo, hash e falha registrada)', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const suspensa = await aluno(escolaId)
      await agendar(coordenacao, suspensa.usuarioId)
      const naoExiste = `RA${randomBytes(6).toString('hex').toUpperCase()}`

      verificacoes.mockClear()
      const falhasAntes = await falhasDeLogin(escolaId)
      const daSuspensa = await entrar(slug, suspensa.matricula, SENHA_ERRADA)
      const hashesDaSuspensa = verificacoes.mock.calls.length
      const falhasDaSuspensa = (await falhasDeLogin(escolaId)) - falhasAntes

      verificacoes.mockClear()
      const falhasAntesDaInexistente = await falhasDeLogin(escolaId)
      const daInexistente = await entrar(slug, naoExiste, SENHA_ERRADA)
      const hashesDaInexistente = verificacoes.mock.calls.length
      const falhasDaInexistente = (await falhasDeLogin(escolaId)) - falhasAntesDaInexistente

      expect(semRequisicao(daSuspensa)).toEqual(semRequisicao(daInexistente))
      expect(semRequisicao(daSuspensa)).toEqual(NAO_AUTENTICADO)
      expect(hashesDaSuspensa).toBe(1)
      expect(hashesDaInexistente).toBe(hashesDaSuspensa)
      expect(falhasDaSuspensa).toBe(1)
      expect(falhasDaInexistente).toBe(falhasDaSuspensa)
    })

    it('não revela: a conta suspensa segura no mesmo número de erros que a matrícula que não existe, e segurada não diz que está suspensa', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const suspensa = await aluno(escolaId)
      await agendar(coordenacao, suspensa.usuarioId)
      const naoExiste = `RA${randomBytes(6).toString('hex').toUpperCase()}`

      const daSuspensa: number[] = []
      const daInexistente: number[] = []
      for (let tentativa = 0; tentativa < 7; tentativa++) {
        daSuspensa.push((await entrar(slug, suspensa.matricula, SENHA_ERRADA)).status)
        daInexistente.push((await entrar(slug, naoExiste, SENHA_ERRADA)).status)
      }

      expect(daSuspensa).toEqual(daInexistente)
      expect(daSuspensa).toContain(429)
      // Segurada, nem a senha certa diz que o acesso está suspenso: a credencial nem é lida.
      const certa = await entrar(slug, suspensa.matricula)
      expect(certa.status).toBe(429)
      expect(certa.corpo.erro?.codigo).toBe(ErrorCode.CONTA_SEGURADA)
    })

    it('a mesma matrícula em outra escola segue entrando: a suspensão é da pessoa naquela escola', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const matricula = `RA${randomBytes(6).toString('hex').toUpperCase()}`
      const [daA] = await bancada.alunosComMatricula(a.escolaId, [{ matricula, senhaHash: hashDaSenha }])
      await bancada.alunosComMatricula(b.escolaId, [{ matricula, senhaHash: hashDaSenha }])
      await agendar(a.coordenacao, String(daA))

      expect(semRequisicao(await entrar(a.slug, matricula))).toEqual(ACESSO_SUSPENSO)
      expect((await entrar(b.slug, matricula)).status).toBe(200)
    })

    it('renovação: o cookie de quem tem a eliminação agendada dá ACESSO_SUSPENSO e é apagado; o do colega renova; o cookie qualquer dá 401', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      const colega = await aluno(escolaId)
      const cookieDoTitular = cookieDeRenovacao(await entrar(slug, titular.matricula))
      const cookieDoColega = cookieDeRenovacao(await entrar(slug, colega.matricula))
      await agendar(coordenacao, titular.usuarioId)

      const suspenso = await renovar(api.url, cookieDoTitular)
      const doColega = await renovar(api.url, cookieDoColega)
      const desconhecido = await renovar(api.url, `educa_sessao=${randomBytes(32).toString('base64url')}`)

      expect(suspenso.status).toBe(403)
      expect(suspenso.corpo.erro?.codigo).toBe(ErrorCode.ACESSO_SUSPENSO)
      expect(suspenso.setCookie).toEqual([expect.stringMatching(/^educa_sessao=; Path=\/v1\/sessao; HttpOnly; SameSite=Strict; Max-Age=0$/)])
      expect(doColega.status).toBe(200)
      expect(desconhecido.status).toBe(401)
      expect(desconhecido.corpo.erro?.codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    })

    it('renovação: o cookie vencido por inatividade ou pelas 12 h, encerrado por saída ou já rotacionado, de quem tem a eliminação agendada, responde 401 e apaga o cookie, como o desconhecido: nunca ACESSO_SUSPENSO', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const desconhecido = await renovar(api.url, `educa_sessao=${randomBytes(32).toString('base64url')}`)
      const preparos: Array<[string, string]> = [
        ['inatividade', "update sessao set ultimo_uso_em = now() - interval '1 day' where usuario_id = $1"],
        ['12 h', "update sessao set expira_em = now() - interval '1 second' where usuario_id = $1"],
        ['saída', "update sessao set encerrada_em = now(), motivo = 'saida' where usuario_id = $1"],
      ]
      for (const [caso, sql] of preparos) {
        const titular = await aluno(escolaId)
        const cookie = cookieDeRenovacao(await entrar(slug, titular.matricula))
        await bancada.pool.query(sql, [titular.usuarioId])
        await agendar(coordenacao, titular.usuarioId)
        const recusada = await renovar(api.url, cookie)
        expect(semRequisicao(recusada), caso).toEqual(semRequisicao(desconhecido))
        expect(recusada.setCookie, caso).toEqual(desconhecido.setCookie)
      }
      // O cookie anterior, depois de uma rotação:
      const rotacionado = await aluno(escolaId)
      const cookieAnterior = cookieDeRenovacao(await entrar(slug, rotacionado.matricula))
      expect((await renovar(api.url, cookieAnterior)).status).toBe(200)
      await agendar(coordenacao, rotacionado.usuarioId)
      const doAnterior = await renovar(api.url, cookieAnterior)
      expect(semRequisicao(doAnterior)).toEqual(semRequisicao(desconhecido))
      expect(doAnterior.setCookie).toEqual(desconhecido.setCookie)
    })

    it('o aluno transferido (desativado) com a eliminação registrada: o pedido agenda sem sessão a encerrar, e nem a renovação nem a senha certa revelam o pedido', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      const cookie = cookieDeRenovacao(await entrar(slug, titular.matricula))
      const desconhecido = await renovar(api.url, `educa_sessao=${randomBytes(32).toString('base64url')}`)
      await runInContext({ requisicaoId: randomUUID(), escolaId, usuarioId: coordenacao.usuarioId, papel: 'coordenador' }, () =>
        new CicloDeVidaService(bancada.banco).desativar(titular.usuarioId),
      )

      const id = await agendar(coordenacao, titular.usuarioId)

      expect((await pedidoNoBanco(id)).estado).toBe('agendado')
      expect(await agendadaEm(titular.usuarioId)).not.toBeNull()
      const auditoria = (await auditoriasDa(escolaId, 'pedido.agendado')).find((linha) => linha.entidade_id === id)
      expect(auditoria?.depois).toMatchObject({ sessoesEncerradas: 0 })
      const renovacao = await renovar(api.url, cookie)
      expect(semRequisicao(renovacao)).toEqual(semRequisicao(desconhecido))
      expect(renovacao.status).toBe(401)
      expect(semRequisicao(await entrar(slug, titular.matricula))).toEqual(NAO_AUTENTICADO)
    })

    it('a guarda e a renovação recusam pela marca do usuário, mesmo com a sessão ainda aberta: a recusa não depende de o registro ter encerrado a sessão', async () => {
      const { escolaId, slug } = await escolaNova()
      const titular = await aluno(escolaId)
      const entrada = await entrar(slug, titular.matricula)
      expect((await eu(tokenDe(entrada))).status).toBe(200)

      // A marca posta por fora, sem o registro: nada encerrou a sessão, e a pessoa é recusada na requisição seguinte.
      await bancada.pool.query('update usuario set eliminacao_agendada_em = now() where id = $1', [titular.usuarioId])

      expect((await sessoesDe(titular.usuarioId))[0]).toEqual({ motivo: null, encerrada: false })
      expect((await eu(tokenDe(entrada))).status).toBe(401)
      const renovacao = await renovar(api.url, cookieDeRenovacao(entrada))
      expect(renovacao.status).toBe(403)
      expect(renovacao.corpo.erro?.codigo).toBe(ErrorCode.ACESSO_SUSPENSO)
    })

    it('cancelar devolve o acesso com a mesma senha, e o que foi encerrado não volta: token e cookie de antes seguem recusados', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      const antes = await entrar(slug, titular.matricula)
      const id = await agendar(coordenacao, titular.usuarioId)
      expect(semRequisicao(await entrar(slug, titular.matricula))).toEqual(ACESSO_SUSPENSO)

      const cancelado = await cancelar(coordenacao, id)

      expect(cancelado.status).toBe(204)
      expect(await agendadaEm(titular.usuarioId)).toBeNull()
      const depois = await entrar(slug, titular.matricula)
      expect(depois.status).toBe(200)
      expect(depois.corpo['etapa']).toBe('pronta')
      expect((await eu(tokenDe(depois))).status).toBe(200)
      expect((await eu(tokenDe(antes))).status).toBe(401)
      const renovacaoAntiga = await renovar(api.url, cookieDeRenovacao(antes))
      expect(renovacaoAntiga.status).toBe(401)
      expect(renovacaoAntiga.corpo.erro?.codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    })
  })

  describe('a equipe: a escola agendada some do e-mail e do seletor, e a outra continua entrando', () => {
    /** Uma conta com e-mail e senha, e um usuário ativo (professor) em cada escola pedida. */
    async function professoraEm(escolas: readonly string[]): Promise<{ email: string; usuarios: string[] }> {
      const email = `equipe-${randomUUID()}@escola.invalid`
      const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email, senha_hash) values ($1, $2) returning id', [email, hashDaSenha])
      const contaId = contas[0]?.id ?? ''
      const usuarios: string[] = []
      for (const escolaId of escolas) {
        const { rows } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'professor', 'Pessoa sintética') returning id", [escolaId, contaId])
        usuarios.push(rows[0]?.id ?? '')
      }
      return { email, usuarios }
    }

    const entrarPorEmail = async (email: string, senha = SENHA): Promise<Entrada> => {
      const resposta = await fetch(`${api.url}/v1/sessao/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      })
      return { status: resposta.status, corpo: (await resposta.json()) as Entrada['corpo'], setCookie: resposta.headers.getSetCookie() }
    }

    it('com a eliminação agendada em A, o login por e-mail não oferece A e entra direto em B; antes, a pessoa escolhia', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const { email, usuarios } = await professoraEm([a.escolaId, b.escolaId])
      const [daA, daB] = usuarios
      const antes = await entrarPorEmail(email)
      expect(antes.corpo['etapa']).toBe('escolher')

      await agendar(a.coordenacao, String(daA))
      const depois = await entrarPorEmail(email)

      expect(depois.status).toBe(200)
      expect(depois.corpo['etapa']).toBe('pronta')
      expect((await eu(tokenDe(depois))).corpo).toMatchObject({ usuarioId: daB })
    })

    it('o seletor (acessos do /v1/eu) deixa de listar a escola agendada, e a lista volta quando a eliminação é cancelada', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const { usuarios } = await professoraEm([a.escolaId])
      const daA = String(usuarios[0])
      // O mesmo e-mail dá aula também em B: a sessão de B é de outro usuário da mesma conta.
      const tokenDeB = await bancada.sessaoDaMesmaConta(daA, b.escolaId)
      const acessos = async (): Promise<string[]> => ((await eu(tokenDeB)).corpo['acessos'] as Array<{ usuarioId: string }>).map((acesso) => acesso.usuarioId)
      expect(await acessos()).toHaveLength(2)
      expect(await acessos()).toContain(daA)

      const id = await agendar(a.coordenacao, daA)
      const durante = await acessos()
      expect(durante).toHaveLength(1)
      expect(durante).not.toContain(daA)
      // Trocar o id: escolher a escola agendada pelo `usuarioId` dela responde como o id de ninguém (regra 10, item 4).
      const paraA = await chamar(api.url, 'POST', '/v1/sessao/escola', tokenDeB, { usuarioId: daA })
      const paraNinguem = await chamar(api.url, 'POST', '/v1/sessao/escola', tokenDeB, { usuarioId: randomUUID() })
      expect(paraA.status).not.toBe(200)
      expect(semRequisicao(paraA)).toEqual(semRequisicao(paraNinguem))

      await cancelar(a.coordenacao, id)
      const depois = await acessos()
      expect(depois).toHaveLength(2)
      expect(depois).toContain(daA)
    })

    it('a conta só com A agendada: a senha certa recebe ACESSO_SUSPENSO e a errada, a resposta de sempre', async () => {
      const a = await escolaNova()
      const { email, usuarios } = await professoraEm([a.escolaId])
      await agendar(a.coordenacao, String(usuarios[0]))
      // A senha certa não é falha: seis vezes (a quinta falha segura a conta, `login-email.int.test.ts`) e nenhuma é CONTA_SEGURADA.
      for (let tentativa = 0; tentativa < 6; tentativa += 1) {
        expect(semRequisicao(await entrarPorEmail(email)), String(tentativa)).toEqual(ACESSO_SUSPENSO)
      }

      const certa = await entrarPorEmail(email)
      const errada = await entrarPorEmail(email, SENHA_ERRADA)

      expect(semRequisicao(certa)).toEqual(ACESSO_SUSPENSO)
      expect(certa.setCookie).toEqual([])
      expect(semRequisicao(errada)).toEqual(NAO_AUTENTICADO)
    })
  })

  // ─── cancelar ──────────────────────────────────────────────────────────────────────────────────────────────────────

  describe('cancelar a eliminação', () => {
    it('cancela o pedido com quem e quando, devolve o acesso e audita sem dado de pessoa; o clique duplo não cancela nem audita de novo', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      const id = await agendar(coordenacao, titular.usuarioId)

      const primeira = await cancelar(coordenacao, id)
      const segunda = await cancelar(coordenacao, id)

      expect(primeira.status).toBe(204)
      expect(semRequisicao(segunda)).toEqual(ESTADO_INVALIDO)
      const pedido = await pedidoNoBanco(id)
      expect(pedido).toMatchObject({ estado: 'cancelado', cancelado_por: coordenacao.usuarioId })
      expect(pedido.cancelado_em).not.toBeNull()
      expect(await agendadaEm(titular.usuarioId)).toBeNull()
      const cancelados = await auditoriasDa(escolaId, 'pedido.cancelado')
      expect(cancelados).toHaveLength(1)
      expect(cancelados[0]).toMatchObject({
        entidade: 'pedido_titular',
        entidade_id: id,
        autor_usuario_id: coordenacao.usuarioId,
        antes: { estado: 'agendado' },
        depois: { estado: 'cancelado', acessoDevolvido: true },
      })
    })

    it('depois do cancelamento, a pessoa pode ter outra eliminação agendada: o único é do que está agendado, não do que já foi', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      await cancelar(coordenacao, await agendar(coordenacao, titular.usuarioId))

      const outro = await registrarEliminacao(coordenacao, titular.usuarioId)

      expect(outro.status).toBe(201)
      expect(await agendadaEm(titular.usuarioId)).not.toBeNull()
    })

    it('depois de eliminar_em o cancelamento é recusado, e a pessoa segue suspensa: o prazo é do pedido, não do clique', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      const id = await agendar(coordenacao, titular.usuarioId)
      await bancada.pool.query(`update pedido_titular set eliminar_em = now() - interval '1 minute' where id = $1`, [id])

      const cancelado = await cancelar(coordenacao, id)

      expect(semRequisicao(cancelado)).toEqual(ESTADO_INVALIDO)
      expect((await pedidoNoBanco(id)).estado).toBe('agendado')
      expect(await agendadaEm(titular.usuarioId)).not.toBeNull()
      expect(semRequisicao(await entrar(slug, titular.matricula))).toEqual(ACESSO_SUSPENSO)
      expect(await auditoriasDa(escolaId, 'pedido.cancelado')).toHaveLength(0)
    })

    it('com a eliminação já enfileirada o cancelamento é recusado, mesmo dentro do prazo', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      const id = await agendar(coordenacao, titular.usuarioId)
      await bancada.pool.query('update pedido_titular set eliminacao_enfileirada_em = now() where id = $1', [id])

      const cancelado = await cancelar(coordenacao, id)

      expect(semRequisicao(cancelado)).toEqual(ESTADO_INVALIDO)
      expect((await pedidoNoBanco(id)).estado).toBe('agendado')
      expect(await agendadaEm(titular.usuarioId)).not.toBeNull()
    })

    it('só a eliminação agendada se cancela: o pedido de outro tipo e o já concluído respondem PEDIDO_EM_ESTADO_INVALIDO e nada muda', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      const deCorrecao = String((await registrarEliminacao(coordenacao, titular.usuarioId, { tipo: 'correcao' })).corpo['id'])
      const concluido = String((await registrarEliminacao(coordenacao, titular.usuarioId, { tipo: 'compartilhamento' })).corpo['id'])
      expect((await chamar(api.url, 'POST', `/v1/privacidade/pedidos/${concluido}/concluir`, coordenacao.token, {})).status).toBe(204)

      for (const id of [deCorrecao, concluido]) expect(semRequisicao(await cancelar(coordenacao, id)), id).toEqual(ESTADO_INVALIDO)

      expect((await pedidoNoBanco(deCorrecao)).estado).toBe('recebido')
      expect((await pedidoNoBanco(concluido)).estado).toBe('concluido')
      expect(await auditoriasDa(escolaId, 'pedido.cancelado')).toHaveLength(0)
    })

    it('a eliminação já concluída não se cancela, mesmo com o instante ainda no futuro', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      const id = await agendar(coordenacao, titular.usuarioId)
      await bancada.pool.query(`update pedido_titular set estado = 'concluido', concluido_em = now(), concluido_por = $2 where id = $1`, [id, coordenacao.usuarioId])

      const cancelado = await cancelar(coordenacao, id)

      expect(semRequisicao(cancelado)).toEqual(ESTADO_INVALIDO)
      expect((await pedidoNoBanco(id)).estado).toBe('concluido')
      expect(await auditoriasDa(escolaId, 'pedido.cancelado')).toHaveLength(0)
    })

    it('a pessoa que já não está na escola (eliminada por outro caminho) não tem a quem devolver: o pedido cancela, e a auditoria diz que o acesso não foi devolvido', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      const id = await agendar(coordenacao, titular.usuarioId)
      await runInContext({ requisicaoId: randomUUID(), escolaId, usuarioId: coordenacao.usuarioId, papel: 'coordenador' }, () =>
        new CicloDeVidaService(bancada.banco).eliminar(titular.usuarioId),
      )

      const cancelado = await cancelar(coordenacao, id)

      expect(cancelado.status).toBe(204)
      expect((await pedidoNoBanco(id)).estado).toBe('cancelado')
      expect((await auditoriasDa(escolaId, 'pedido.cancelado'))[0]?.depois).toEqual({ estado: 'cancelado', acessoDevolvido: false })
    })

    it('a marca sem pedido agendado, que o registro nunca deixa, é recusada como PEDIDO_EM_ESTADO_INVALIDO e não deixa pedido pela metade', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      await bancada.pool.query(`update usuario set eliminacao_agendada_em = now() - interval '1 day' where id = $1`, [titular.usuarioId])
      const antes = await agendadaEm(titular.usuarioId)

      const registrado = await registrarEliminacao(coordenacao, titular.usuarioId)

      expect(semRequisicao(registrado)).toEqual(ESTADO_INVALIDO)
      const { rows } = await bancada.pool.query<{ total: number }>(`select count(*)::int as total from pedido_titular where escola_id = $1`, [escolaId])
      expect(rows[0]?.total).toBe(0)
      expect(await agendadaEm(titular.usuarioId)).toEqual(antes)
      expect(await auditoriasDa(escolaId, 'pedido.registrado')).toHaveLength(0)
    })

    it('o pedido agendado cuja marca já foi apagada cancela, e a auditoria diz que não havia acesso a devolver', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      const id = await agendar(coordenacao, titular.usuarioId)
      await bancada.pool.query('update usuario set eliminacao_agendada_em = null where id = $1', [titular.usuarioId])

      const cancelado = await cancelar(coordenacao, id)

      expect(cancelado.status).toBe(204)
      expect((await pedidoNoBanco(id)).estado).toBe('cancelado')
      expect((await auditoriasDa(escolaId, 'pedido.cancelado'))[0]?.depois).toEqual({ estado: 'cancelado', acessoDevolvido: false })
    })

    it('[P] dois cancelamentos ao mesmo tempo: um cancela e o outro recebe PEDIDO_EM_ESTADO_INVALIDO, com uma auditoria só', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      const id = await agendar(coordenacao, titular.usuarioId)

      const respostas = await Promise.all([cancelar(coordenacao, id), cancelar(coordenacao, id)])

      expect(respostas.map((resposta) => resposta.status).sort()).toEqual([204, 409])
      const recusada = respostas.find((resposta) => resposta.status === 409)
      expect(recusada && semRequisicao(recusada)).toEqual(ESTADO_INVALIDO)
      expect(await auditoriasDa(escolaId, 'pedido.cancelado')).toHaveLength(1)
      expect(await agendadaEm(titular.usuarioId)).toBeNull()
    })

    it('[P] cancelar e registrar de novo ao mesmo tempo nunca deixa a pessoa agendada sem pedido agendado, nem o contrário', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      const id = await agendar(coordenacao, titular.usuarioId)

      const [cancelado, novo] = await Promise.all([cancelar(coordenacao, id), registrarEliminacao(coordenacao, titular.usuarioId)])

      // Ou o cancelamento vem primeiro e a nova eliminação agenda, ou a nova eliminação perde o único e é recusada.
      // Em qualquer ordem, o usuário e o pedido agendado concordam.
      expect([204, 409]).toContain(cancelado.status)
      expect([201, 409]).toContain(novo.status)
      const { rows } = await bancada.pool.query<{ total: number }>(`select count(*)::int as total from pedido_titular where escola_id = $1 and titular_id = $2 and estado = 'agendado'`, [escolaId, titular.usuarioId])
      const agendada = (await agendadaEm(titular.usuarioId)) !== null
      expect(agendada).toBe(rows[0]?.total === 1)
    })

    it('isolamento: o pedido de B, visto pela coordenação de A, responde como o id de ninguém, e nada de B muda', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const doB = await aluno(b.escolaId)
      const pedidoDeB = await agendar(b.coordenacao, doB.usuarioId)

      const deB = await cancelar(a.coordenacao, pedidoDeB)
      const deNinguem = await cancelar(a.coordenacao, randomUUID())

      expect(semRequisicao(deB)).toEqual(semRequisicao(deNinguem))
      expect(semRequisicao(deB)).toEqual(NAO_ENCONTRADO)
      expect((await pedidoNoBanco(pedidoDeB)).estado).toBe('agendado')
      expect(await agendadaEm(doB.usuarioId)).not.toBeNull()
      expect(await auditoriasDa(b.escolaId, 'pedido.cancelado')).toHaveLength(0)
    })

    it('o pedido sobre a própria coordenação responde como inexistente: quem atende não cancela o próprio', async () => {
      const { escolaId, coordenacao } = await escolaNova()
      const [outra] = await bancada.sessoes(escolaId, { papel: 'coordenador', quantidade: 1 })
      const { rows } = await bancada.pool.query<{ id: string }>(
        `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, eliminar_em, compartilhamento, registrado_por, chave_envio)
         values ($1, $2, 'professor', 'eliminacao', 'titular', $3, 'agendado', now() + interval '7 days', '[]'::jsonb, $4, $5) returning id`,
        [escolaId, coordenacao.usuarioId, HOJE(), outra?.usuarioId, randomUUID()],
      )

      const proprio = await cancelar(coordenacao, String(rows[0]?.id))

      expect(semRequisicao(proprio)).toEqual(NAO_ENCONTRADO)
      expect((await pedidoNoBanco(String(rows[0]?.id))).estado).toBe('agendado')
    })

    it('só a coordenação cancela: o professor e o aluno são recusados, e o pedido não muda', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await entrar(slug, titular.matricula)
      const id = await agendar(coordenacao, titular.usuarioId)
      const professor = await bancada.sessao(escolaId, 'professor')
      const outroAluno = await bancada.sessao(escolaId, 'aluno')

      for (const sessao of [professor, outroAluno]) {
        const resposta = await cancelar(sessao, id)
        expect([403, 404], String(sessao.usuarioId)).toContain(resposta.status)
      }

      expect((await pedidoNoBanco(id)).estado).toBe('agendado')
    })
  })

  // ─── isolamento no repository ──────────────────────────────────────────────────────────────────────────────────────

  describe('isolamento no repository (regra 10, itens 3 e 5): o id certo, no contexto da escola errada, não alcança nada', () => {
    it('cancelar, suspender e devolver o acesso, com o contexto de A e o id de B, não encontram a linha nem mudam nada', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const agendadoDeB = await aluno(b.escolaId)
      const livreDeB = await aluno(b.escolaId)
      const pedidoDeB = await agendar(b.coordenacao, agendadoDeB.usuarioId)
      const naEscolaA = <T>(acao: () => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId, usuarioId: a.coordenacao.usuarioId }, acao)

      const cancelado = await naEscolaA(() => new PedidosRepository(bancada.banco).cancelar(pedidoDeB))
      const suspensa = await naEscolaA(() => bancada.banco.transaction((tx) => new CicloDeVidaRepository(tx).suspender(livreDeB.usuarioId)))
      const devolvido = await naEscolaA(() => bancada.banco.transaction((tx) => new CicloDeVidaRepository(tx).devolverAcesso(agendadoDeB.usuarioId)))

      expect(cancelado).toBeUndefined()
      expect(suspensa).toBeUndefined()
      expect(devolvido).toBe(false)
      expect((await pedidoNoBanco(pedidoDeB)).estado).toBe('agendado')
      expect(await agendadaEm(livreDeB.usuarioId)).toBeNull()
      expect(await agendadaEm(agendadoDeB.usuarioId)).not.toBeNull()
    })
  })

  // ─── o corpo da resposta não é o de ninguém ────────────────────────────────────────────────────────────────────────

  describe('o que a resposta diz', () => {
    it('ACESSO_SUSPENSO tem status 403 e a mensagem fixa, sem nome, sem data e sem o prazo restante', async () => {
      const { escolaId, slug, coordenacao } = await escolaNova()
      const titular = await aluno(escolaId)
      await agendar(coordenacao, titular.usuarioId)

      const resposta = await entrar(slug, titular.matricula)

      expect(resposta.status).toBe(403)
      expect(resposta.corpo.erro?.mensagem).toBe(MENSAGENS_DE_ERRO.ACESSO_SUSPENSO)
      expect(Object.keys(resposta.corpo.erro ?? {}).sort()).toEqual(['codigo', 'mensagem', 'requisicaoId'])
      expect(JSON.stringify(resposta.corpo)).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    })
  })
})
