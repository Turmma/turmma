import {
  CotaPorHora,
  ExpurgoDeAcessoRepository,
  LeituraDoTitular,
  LOTE_DO_EXPURGO,
  loadChaveDoTokenDeEmail,
  runInContext,
  SecretCipher,
  VALIDADE_DO_CONVITE_HORAS_POR_TIPO,
  VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL,
  type Clock,
} from '@educa/core'
import { CONVITES_POR_HORA_POR_ESCOLA, ErrorCode, conviteDeProfessorResponseSchema, enviarConvitesResponseSchema, listaDeProfessoresResponseSchema, MENSAGENS_DE_ERRO } from '@educa/shared'
import type { Redis } from 'ioredis'
import { createHash, randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { REDIS_LOGIN_CLIENT } from '../src/credencial/index.js'
import { ConviteRepository } from '../src/sessao/index.js'
import { montarEscolaComTurma } from './escola-turma.fixture.js'
import { emOrdemNaTrava } from './escola-lock.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { subirApi, type TestApi } from './test-api.js'
import { TEST_APP_OPTIONS } from './test-config.js'

/**
 * O "Corrigir o e-mail" do professor que nunca entrou (acesso-e-convites, tarefa 18.0; validação, maior 1, opção (b); `cenarios.md`, "Corrigir o e-mail", "Corridas" e "Auditoria (RF17)";
 * Tech Spec, seção 5): `POST /v1/professores/:usuarioId/email` liga o mesmo usuário à conta do e-mail certo e refaz o convite. Postgres e Redis reais do compose de teste; nomes e e-mails
 * gerados. O índice por alvo com as sete ações está em `auditoria-por-alvo.int.test.ts` e em `arquivo-do-titular.int.test.ts` ("D85: o índice parcial por alvo…").
 */

const PRAZO_DAS_CONSULTAS_MS = 15_000
const SENHA_NOVA = 'senha-nova-do-professor-1'
const DIA_MS = 24 * 60 * 60 * 1_000

interface Resposta {
  readonly status: number
  readonly corpo: Record<string, unknown> & { erro?: Record<string, unknown> }
  readonly texto: string
  readonly cacheControl: string | null
}

/** O relógio que a API usa para a validade do convite: o real, com um deslocamento que o teste avança. */
class RelogioDeslocavel implements Clock {
  #deslocamentoMs = 0
  agora(): Date {
    return new Date(Date.now() + this.#deslocamentoMs)
  }
  avancar(ms: number): void {
    this.#deslocamentoMs += ms
  }
  restaurar(): void {
    this.#deslocamentoMs = 0
  }
}

/** A resposta sem o `requisicaoId`, que muda a cada chamada: o resto precisa ser idêntico. */
function semRequisicao(resposta: Resposta): unknown {
  const { requisicaoId: _requisicaoId, ...erro } = resposta.corpo.erro ?? {}
  return { status: resposta.status, corpo: { ...resposta.corpo, ...(resposta.corpo.erro === undefined ? {} : { erro }) } }
}

const hashSorteado = (): string => createHash('sha256').update(randomUUID()).digest('hex')
const emailSorteado = (): string => `professor-${randomUUID()}@escola.invalid`

const NAO_ENCONTRADO = { status: 404, corpo: { erro: { codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO } } }
const CONFLITO = { status: 409, corpo: { erro: { codigo: ErrorCode.CONFLITO, mensagem: MENSAGENS_DE_ERRO.CONFLITO } } }
const ENTRADA_INVALIDA = { status: 400, corpo: { erro: { codigo: ErrorCode.ENTRADA_INVALIDA, mensagem: MENSAGENS_DE_ERRO.ENTRADA_INVALIDA } } }

type EstadoSemeado = 'pendente' | 'vencido' | 'revogado' | 'aceito' | 'ativo' | 'desativado'

describe('acesso-e-convites, 18.0: a coordenação corrige o e-mail do professor que nunca entrou', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const relogio = new RelogioDeslocavel()
  const cifraDoTeste = new SecretCipher(VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, new Map([[VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, loadChaveDoTokenDeEmail(lerAmbienteDeTeste())]]))
  const linhasDeLog: string[] = []
  let api: TestApi
  let cota: CotaPorHora

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { banco: { timeoutConsultaMs: PRAZO_DAS_CONSULTAS_MS } }, linhasDeLog, { ...TEST_APP_OPTIONS, relogioDosConvites: relogio })
    cota = api.app.get(CotaPorHora, { strict: false })
    const redis = api.app.get<Redis>(REDIS_LOGIN_CLIENT, { strict: false })
    const prazo = performance.now() + 15_000
    while (redis.status !== 'ready') {
      if (performance.now() > prazo) throw new Error('o cliente do Redis de fila do login não conectou')
      await new Promise((resolver) => setTimeout(resolver, 20))
    }
  })

  afterEach(() => relogio.restaurar())

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  async function pedir(metodo: string, caminho: string, token?: string, corpo?: unknown): Promise<Resposta> {
    const resposta = await fetch(`${api.url}${caminho}`, {
      method: metodo,
      headers: { ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }), ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    })
    const texto = await resposta.text()
    return { status: resposta.status, corpo: texto === '' ? {} : (JSON.parse(texto) as Resposta['corpo']), texto, cacheControl: resposta.headers.get('cache-control') }
  }

  const corrigir = (sessao: TestSessao, usuarioId: string, corpo: unknown) => pedir('POST', `/v1/professores/${usuarioId}/email`, sessao.token, corpo)
  const cadastrar = (coordenacao: TestSessao, corpo: unknown) => pedir('POST', '/v1/professores', coordenacao.token, corpo)
  const enviar = (coordenacao: TestSessao, usuarioIds?: string[]) => pedir('POST', '/v1/professores/convites/enviar', coordenacao.token, usuarioIds === undefined ? {} : { usuarioIds })
  const refazer = (coordenacao: TestSessao, usuarioId: string) => pedir('POST', `/v1/professores/${usuarioId}/convite/refazer`, coordenacao.token, {})
  const consultar = (token: string) => pedir('POST', '/v1/convites/consultar', undefined, { token })
  const aceitar = (token: string, senha?: string) => pedir('POST', '/v1/convites/aceitar', undefined, senha === undefined ? { token } : { token, senha })
  const listar = async (coordenacao: TestSessao) => listaDeProfessoresResponseSchema.parse((await pedir('GET', '/v1/professores?limite=100', coordenacao.token)).corpo).itens

  async function escolaComCoordenacao(): Promise<{ escolaId: string; coordenacao: TestSessao }> {
    const escolaId = await bancada.escola()
    return { escolaId, coordenacao: await bancada.sessao(escolaId, 'coordenador') }
  }

  /** Cadastra pelo caminho de verdade e devolve o link, o usuário e o e-mail digitado. */
  async function cadastrado(coordenacao: TestSessao, email = emailSorteado()) {
    const resposta = await cadastrar(coordenacao, { nome: `Professor Sintético ${randomUUID().slice(0, 8)}`, email })
    expect(resposta.status).toBe(201)
    return { ...conviteDeProfessorResponseSchema.parse(resposta.corpo), email }
  }

  /** Um professor no estado pedido, semeado direto no banco, com a conta própria (a do `email` devolvido) e o convite de canal `copiado`. */
  async function semear(escolaId: string, estado: EstadoSemeado, email = emailSorteado()): Promise<{ usuarioId: string; contaId: string; conviteId: string | undefined; email: string }> {
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [email])
    const contaId = contas[0]?.id ?? ''
    const desativado: Record<EstadoSemeado, string> = { pendente: 'now()', vencido: 'now()', revogado: 'now()', aceito: "now() - interval '1 hour'", ativo: 'null', desativado: 'now()' }
    const { rows: usuarios } = await bancada.pool.query<{ id: string }>(
      `insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'professor', 'Professor sintético', ${desativado[estado]}) returning id`,
      [escolaId, contaId],
    )
    const usuarioId = usuarios[0]?.id ?? ''
    const colunas: Record<EstadoSemeado, string> = {
      pendente: "now() + interval '7 days', null, null",
      vencido: "now() - interval '1 day', null, null",
      revogado: "now() + interval '7 days', null, now()",
      aceito: "now() + interval '7 days', now() - interval '30 minutes', null",
      ativo: "now() + interval '7 days', null, null",
      desativado: "now() + interval '7 days', now() - interval '1 hour', null",
    }
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, usado_em, revogado_em) values ($1, $2, 'professor', $3, ${colunas[estado]}) returning id`,
      [escolaId, hashSorteado(), usuarioId, ],
    )
    return { usuarioId, contaId, conviteId: rows[0]?.id, email }
  }

  const contaDe = async (usuarioId: string) => (await bancada.pool.query<{ conta_id: string }>('select conta_id from usuario where id = $1', [usuarioId])).rows[0]?.conta_id
  const contasComEmail = async (email: string) => (await bancada.pool.query<{ id: string }>('select id from conta where email = $1', [email])).rows.map((linha) => linha.id)
  const totalDeContas = async () => Number((await bancada.pool.query<{ total: string }>('select count(*) as total from conta')).rows[0]?.total)
  const convitesDe = async (usuarioId: string) =>
    (
      await bancada.pool.query<{ id: string; canal: string; envio: string | null; token_cifrado: Buffer | null; destino_cifrado: Buffer | null; aberto: boolean; expira_em: Date }>(
        'select id, canal, envio, token_cifrado, destino_cifrado, usado_em is null and revogado_em is null as aberto, expira_em from convite where usuario_id = $1 order by id',
        [usuarioId],
      )
    ).rows
  const emAberto = async (usuarioId: string) => (await convitesDe(usuarioId)).filter((convite) => convite.aberto)
  const auditoriaDe = async (escolaId: string, acao: string) =>
    (
      await bancada.pool.query<{ entidade: string; entidade_id: string; autor_usuario_id: string | null; antes: unknown; depois: unknown; finalidade: string | null }>(
        'select entidade, entidade_id, autor_usuario_id, antes, depois, finalidade from auditoria where escola_id = $1 and acao = $2 order by xmin::text::bigint, id',
        [escolaId, acao],
      )
    ).rows

  /** Tudo o que a rota pode gravar na escola: o que é recusado não muda nada disto. */
  async function retrato(escolaId: string) {
    const [convites, usuarios, auditoria] = await Promise.all([
      bancada.pool.query('select id, tipo, usuario_id, expira_em, usado_em, revogado_em, envio from convite where escola_id = $1 order by id', [escolaId]),
      bancada.pool.query('select id, conta_id, papel, nome, desativado_em from usuario where escola_id = $1 order by id', [escolaId]),
      bancada.pool.query('select id from auditoria where escola_id = $1 order by id', [escolaId]),
    ])
    return { convites: convites.rows, usuarios: usuarios.rows, auditoria: auditoria.rows }
  }

  /** O endereço em claro de um convite de canal `email`, decifrado como o worker o faz (o id da linha é o dado autenticado). */
  async function destinoDoEnvio(conviteId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ destino_cifrado: Buffer }>('select destino_cifrado from convite where id = $1', [conviteId])
    const cifrado = rows[0]?.destino_cifrado
    if (cifrado === undefined) throw new Error('convite sem endereço cifrado')
    return Buffer.from(cifraDoTeste.decifrar({ cifrado, versao: VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL }, conviteId)).toString('utf8')
  }

  async function tokenDoEnvio(conviteId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ token_cifrado: Buffer }>('select token_cifrado from convite where id = $1', [conviteId])
    const cifrado = rows[0]?.token_cifrado
    if (cifrado === undefined) throw new Error('convite sem token cifrado')
    return Buffer.from(cifraDoTeste.decifrar({ cifrado, versao: VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL }, conviteId)).toString('utf8')
  }

  describe('o caminho que vale', () => {
    it('caminho feliz: o professor da grade, com o envio `falhou`, fica com o mesmo id, o vínculo e a aula, e passa à conta do e-mail novo', async () => {
      const escola = await montarEscolaComTurma(api, bancada)
      const { coordenacao } = escola
      const escolaId = coordenacao.escolaId
      const antigo = await cadastrado(coordenacao)
      // O vínculo `pendente` e a aula que a grade deu a ele.
      const { rows: vinculos } = await bancada.pool.query<{ id: string }>(
        `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, origem, criado_por) values ($1, $2, $3, $4, $5, 'professor', 'pendente', 'grade', $6) returning id`,
        [escolaId, escola.anoLetivoId, antigo.usuarioId, escola.turma, escola.quimica, coordenacao.usuarioId],
      )
      const vinculoId = vinculos[0]?.id ?? ''
      const { rows: aulas } = await bancada.pool.query<{ id: string }>(
        `insert into alocacao (escola_id, ano_letivo_id, vinculo_id, dia_semana, inicio, fim, sala) values ($1, $2, $3, 3, '08:50', '09:40', 'Sala 12') returning id`,
        [escolaId, escola.anoLetivoId, vinculoId],
      )
      const aulaId = aulas[0]?.id ?? ''
      // O envio que falhou: o convite de canal e-mail, sem cifrados (o check os quer nulos fora do envio aberto).
      expect(await enviar(coordenacao, [antigo.usuarioId])).toMatchObject({ status: 200, corpo: { quantidade: 1 } })
      await bancada.pool.query("update convite set envio = 'falhou', token_cifrado = null, destino_cifrado = null where usuario_id = $1 and canal = 'email'", [antigo.usuarioId])
      expect((await listar(coordenacao)).find((item) => item.usuarioId === antigo.usuarioId)).toMatchObject({ estado: 'pendente', envio: 'falhou' })
      const contaAntiga = await contaDe(antigo.usuarioId)

      const certo = emailSorteado()
      const resposta = await corrigir(coordenacao, antigo.usuarioId, { email: certo })
      expect(resposta.status).toBe(201)
      expect(resposta.cacheControl).toBe('no-store')
      const gerado = conviteDeProfessorResponseSchema.parse(resposta.corpo)
      expect(gerado.usuarioId).toBe(antigo.usuarioId)

      const [contaNova] = await contasComEmail(certo)
      expect(contaNova).toBeDefined()
      expect(contaNova).not.toBe(contaAntiga)
      expect(await contaDe(antigo.usuarioId)).toBe(contaNova)
      // O vínculo e a aula são os mesmos, na mesma linha.
      expect((await bancada.pool.query('select id, usuario_id, estado, origem from vinculo where usuario_id = $1', [antigo.usuarioId])).rows).toEqual([{ id: vinculoId, usuario_id: antigo.usuarioId, estado: 'pendente', origem: 'grade' }])
      expect((await bancada.pool.query('select id, vinculo_id from alocacao where vinculo_id = $1', [vinculoId])).rows).toEqual([{ id: aulaId, vinculo_id: vinculoId }])
      // A lista mostra o mesmo id, `pendente`, sem envio; o convite novo é o único em aberto e de canal copiado.
      expect((await listar(coordenacao)).filter((item) => item.usuarioId === antigo.usuarioId)).toEqual([{ usuarioId: antigo.usuarioId, nome: expect.any(String), estado: 'pendente', envio: null, enviadoEm: null }])
      const abertos = await emAberto(antigo.usuarioId)
      expect(abertos.map((convite) => [convite.id, convite.canal, convite.envio])).toEqual([[gerado.conviteId, 'copiado', null]])
    })

    it('token: o link do convite anterior é recusado, o devolvido é aceito, e o aceite define a senha da conta nova', async () => {
      const { coordenacao } = await escolaComCoordenacao()
      const antigo = await cadastrado(coordenacao)
      const certo = emailSorteado()
      const gerado = conviteDeProfessorResponseSchema.parse((await corrigir(coordenacao, antigo.usuarioId, { email: certo })).corpo)
      expect(semRequisicao(await consultar(antigo.token))).toEqual(semRequisicao(await consultar(randomUUID())))
      expect(semRequisicao(await aceitar(antigo.token, SENHA_NOVA))).toEqual(NAO_ENCONTRADO)
      expect((await consultar(gerado.token)).status).toBe(200)
      expect((await aceitar(gerado.token, SENHA_NOVA)).status).toBe(200)
      expect((await bancada.pool.query<{ tem_senha: boolean }>('select senha_hash is not null as tem_senha from conta where email = $1', [certo])).rows).toEqual([{ tem_senha: true }])
      expect((await bancada.pool.query<{ ativo: boolean }>('select desativado_em is null as ativo from usuario where id = $1', [antigo.usuarioId])).rows).toEqual([{ ativo: true }])
    })

    it('`vencido`: corrige, e o convite novo vale os 7 dias do professor a partir do relógio falso', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      relogio.avancar(30 * DIA_MS)
      const vencido = await semear(escolaId, 'vencido')
      const certo = emailSorteado()
      const resposta = await corrigir(coordenacao, vencido.usuarioId, { email: certo })
      expect(resposta.status).toBe(201)
      const gerado = conviteDeProfessorResponseSchema.parse(resposta.corpo)
      expect(await contaDe(vencido.usuarioId)).toBe((await contasComEmail(certo))[0])
      const [aberto] = await emAberto(vencido.usuarioId)
      expect(aberto?.id).toBe(gerado.conviteId)
      const validadeMs = VALIDADE_DO_CONVITE_HORAS_POR_TIPO.professor * 60 * 60 * 1_000
      expect(Math.abs((aberto?.expira_em.getTime() ?? 0) - (relogio.agora().getTime() + validadeMs))).toBeLessThan(60_000)
      expect((await consultar(gerado.token)).status).toBe(200)
    })
  })

  describe('o envio do convite anterior e o "Enviar" depois', () => {
    it('envio antigo: o `na_fila` e o `enviando` terminam `cancelado`, sem cifrados, e o link que ia sair não vale', async () => {
      const { coordenacao } = await escolaComCoordenacao()
      const naFila = await cadastrado(coordenacao)
      const enviando = await cadastrado(coordenacao)
      expect(await enviar(coordenacao, [naFila.usuarioId, enviando.usuarioId])).toMatchObject({ status: 200, corpo: { quantidade: 2 } })
      const envioDe = async (usuarioId: string) => (await convitesDe(usuarioId)).filter((convite) => convite.canal === 'email')[0]?.id ?? ''
      const antigoNaFila = await envioDe(naFila.usuarioId)
      const antigoEnviando = await envioDe(enviando.usuarioId)
      const linkNaFila = await tokenDoEnvio(antigoNaFila)
      const linkEnviando = await tokenDoEnvio(antigoEnviando)
      await bancada.pool.query("update convite set envio = 'enviando', envio_reservado_em = now() where id = $1", [antigoEnviando])
      expect((await consultar(linkNaFila)).status).toBe(200)

      for (const professor of [naFila, enviando]) expect((await corrigir(coordenacao, professor.usuarioId, { email: emailSorteado() })).status).toBe(201)
      for (const [conviteId, link] of [
        [antigoNaFila, linkNaFila],
        [antigoEnviando, linkEnviando],
      ] as const) {
        const { rows } = await bancada.pool.query('select envio, token_cifrado is null as sem_token, destino_cifrado is null as sem_destino, envio_reservado_em is null as sem_reserva from convite where id = $1', [conviteId])
        expect(rows).toEqual([{ envio: 'cancelado', sem_token: true, sem_destino: true, sem_reserva: true }])
        expect((await consultar(link)).status).toBe(404)
      }
    })

    it('"Enviar" de um só logo depois: o destino decifrado é o e-mail novo, gastando 1 ponto da cota', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const errado = await cadastrado(coordenacao)
      const outro = await cadastrado(coordenacao)
      const certo = emailSorteado()
      expect((await corrigir(coordenacao, errado.usuarioId, { email: certo })).status).toBe(201)
      // Sobra 1 ponto na cota da escola: o "Enviar" do corrigido o gasta, e o seguinte já não cabe.
      expect((await cota.consumir(escolaId, CONVITES_POR_HORA_POR_ESCOLA - 1)).resultado).toBe('concedido')
      const resposta = await enviar(coordenacao, [errado.usuarioId])
      expect(enviarConvitesResponseSchema.parse(resposta.corpo)).toEqual({ quantidade: 1 })
      const [envio] = (await convitesDe(errado.usuarioId)).filter((convite) => convite.canal === 'email')
      expect(envio?.envio).toBe('na_fila')
      expect(await destinoDoEnvio(envio?.id ?? '')).toBe(certo)
      expect(await destinoDoEnvio(envio?.id ?? '')).not.toBe(errado.email)
      expect((await enviar(coordenacao, [outro.usuarioId])).status).toBe(429)
    })
  })

  describe('a conta antiga não é tocada', () => {
    const estadoDaConta = async (contaId: string) =>
      (await bancada.pool.query('select email, senha_hash, email_verificado_em from conta where id = $1', [contaId])).rows[0] as { email: string | null; senha_hash: string | null; email_verificado_em: Date | null }

    /** A limpeza da madrugada, até a conta sair do lote ou o lote acabar (o banco de teste guarda as contas de outros casos). */
    async function limparAMadrugada(contaId: string): Promise<void> {
      const repositorio = new ExpurgoDeAcessoRepository(bancada.banco)
      for (let rodada = 0; rodada < 200; rodada += 1) {
        if ((await estadoDaConta(contaId)).email === null) return
        if ((await repositorio.limparLoteDeContasSemUso(new Date(), LOTE_DO_EXPURGO)) === 0) return
      }
    }

    it('intacta: e-mail, senha e verificação ficam como estavam, também quando a conta tem usuário em outra escola', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const outraEscola = await bancada.escola()
      const professor = await semear(escolaId, 'pendente')
      await bancada.pool.query("update conta set senha_hash = 'hash-sintetico', email_verificado_em = now() - interval '1 day' where id = $1", [professor.contaId])
      await bancada.pool.query("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'professor', 'Pessoa sintética')", [outraEscola, professor.contaId])
      const antes = await estadoDaConta(professor.contaId)
      expect((await corrigir(coordenacao, professor.usuarioId, { email: emailSorteado() })).status).toBe(201)
      expect(await estadoDaConta(professor.contaId)).toEqual(antes)
    })

    it('sem usuário que a segure, a limpeza da madrugada a esvazia; com o usuário ativo da outra escola, não', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const outraEscola = await bancada.escola()
      const sozinha = await semear(escolaId, 'pendente')
      const compartilhada = await semear(escolaId, 'pendente')
      await bancada.pool.query("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'professor', 'Pessoa sintética')", [outraEscola, compartilhada.contaId])
      for (const professor of [sozinha, compartilhada]) expect((await corrigir(coordenacao, professor.usuarioId, { email: emailSorteado() })).status).toBe(201)
      // Antes da limpeza, as duas contas estão como estavam.
      for (const professor of [sozinha, compartilhada]) expect((await estadoDaConta(professor.contaId)).email).toBe(professor.email)
      await limparAMadrugada(sozinha.contaId)
      await limparAMadrugada(compartilhada.contaId)
      expect((await estadoDaConta(sozinha.contaId)).email).toBeNull()
      expect((await estadoDaConta(compartilhada.contaId)).email).toBe(compartilhada.email)
    })
  })

  describe('o que a regra recusa, sem gravar nada', () => {
    it.each(['revogado', 'aceito', 'ativo', 'desativado'] as const)('estados fora: `%s` responde CONFLITO, sem conta nova nem auditoria', async (estado) => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const professor = await semear(escolaId, estado)
      const certo = emailSorteado()
      const antes = await retrato(escolaId)
      expect(semRequisicao(await corrigir(coordenacao, professor.usuarioId, { email: certo }))).toEqual(CONFLITO)
      expect(await retrato(escolaId)).toEqual(antes)
      expect(await contasComEmail(certo)).toEqual([])
      expect(await contaDe(professor.usuarioId)).toBe(professor.contaId)
      expect(await auditoriaDe(escolaId, 'usuario.email_corrigido')).toEqual([])
    })

    it('quem já entrou: o professor desligado e chamado de volta (um convite usado atrás do aberto) é CONFLITO, e o `contaId` fica', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const chamado = await semear(escolaId, 'pendente')
      // O aceite de antes: o convite usado que a volta deixou para trás.
      await bancada.pool.query("insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, usado_em) values ($1, $2, 'professor', $3, now() - interval '30 days', now() - interval '31 days')", [
        escolaId,
        hashSorteado(),
        chamado.usuarioId,
      ])
      const certo = emailSorteado()
      const antes = await retrato(escolaId)
      expect(semRequisicao(await corrigir(coordenacao, chamado.usuarioId, { email: certo }))).toEqual(CONFLITO)
      expect(await retrato(escolaId)).toEqual(antes)
      expect(await contasComEmail(certo)).toEqual([])
      expect(await contaDe(chamado.usuarioId)).toBe(chamado.contaId)
    })

    it('e-mail de outro professor da escola, em `pendente`, `ativo` e `revogado`: CONFLITO, sem gravar nada e sem conta nova (a conta criada que a transação desfaz é a do `revogado` de "estados fora")', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const professor = await semear(escolaId, 'pendente')
      for (const estado of ['pendente', 'ativo', 'revogado'] as const) {
        const dono = await semear(escolaId, estado)
        const antes = await retrato(escolaId)
        const contasAntes = await totalDeContas()
        expect(semRequisicao(await corrigir(coordenacao, professor.usuarioId, { email: dono.email })), estado).toEqual(CONFLITO)
        expect(await retrato(escolaId), estado).toEqual(antes)
        expect(await totalDeContas(), estado).toBe(contasAntes)
        expect(await contaDe(professor.usuarioId), estado).toBe(professor.contaId)
      }
      // O controle: com um e-mail que ninguém tem, a mesma rota corrige.
      expect((await corrigir(coordenacao, professor.usuarioId, { email: emailSorteado() })).status).toBe(201)
    })

    it('o mesmo e-mail de hoje, também em outra caixa: CONFLITO, nada gravado', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const professor = await semear(escolaId, 'pendente', `Professor-${randomUUID()}@escola.invalid`.toLowerCase())
      const antes = await retrato(escolaId)
      for (const email of [professor.email, professor.email.toUpperCase(), `  ${professor.email}  `]) {
        expect(semRequisicao(await corrigir(coordenacao, professor.usuarioId, { email })), email).toEqual(CONFLITO)
      }
      expect(await retrato(escolaId)).toEqual(antes)
    })

    it('E11: o e-mail com conta só em outra escola corrige, a resposta tem o mesmo formato da conta nova, e o usuário da outra escola fica como estava', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const outraEscola = await bancada.escola()
      const deOutraEscola = await semear(outraEscola, 'ativo')
      const outroEstado = await retrato(outraEscola)
      const com = await semear(escolaId, 'pendente')
      const sem = await semear(escolaId, 'pendente')
      const respostaComConta = await corrigir(coordenacao, com.usuarioId, { email: deOutraEscola.email })
      const respostaContaNova = await corrigir(coordenacao, sem.usuarioId, { email: emailSorteado() })
      expect([respostaComConta.status, respostaContaNova.status]).toEqual([201, 201])
      expect(Object.keys(respostaComConta.corpo).sort()).toEqual(Object.keys(respostaContaNova.corpo).sort())
      expect(respostaComConta.cacheControl).toBe(respostaContaNova.cacheControl)
      expect(await contaDe(com.usuarioId)).toBe(deOutraEscola.contaId)
      expect(await retrato(outraEscola)).toEqual(outroEstado)
      // Nada na resposta diz que a conta já existia: nem o e-mail, nem o id dela.
      for (const proibido of [deOutraEscola.email, deOutraEscola.contaId]) expect(respostaComConta.texto).not.toContain(proibido)
    })
  })

  describe('quem pede, quem é alcançado e o que se manda', () => {
    it('permissão: o professor e o aluno são recusados como o inexistente, e nada muda', async () => {
      const { escolaId } = await escolaComCoordenacao()
      const professor = await semear(escolaId, 'pendente')
      // As sessões criam os usuários de quem pede: o retrato é tirado depois delas.
      const sessoes = { professor: await bancada.sessao(escolaId, 'professor'), aluno: await bancada.sessao(escolaId, 'aluno') }
      const antes = await retrato(escolaId)
      for (const papel of ['professor', 'aluno'] as const) {
        const sessao = sessoes[papel]
        const certo = emailSorteado()
        expect(semRequisicao(await corrigir(sessao, professor.usuarioId, { email: certo })), papel).toEqual(NAO_ENCONTRADO)
        expect(await contasComEmail(certo), papel).toEqual([])
      }
      expect(await pedir('POST', `/v1/professores/${professor.usuarioId}/email`, undefined, { email: emailSorteado() })).toMatchObject({ status: 401 })
      expect(await retrato(escolaId)).toEqual(antes)
    })

    it('isolamento: o id da outra escola, o de aluno, o de coordenador e o inexistente respondem o mesmo NAO_ENCONTRADO, sem conta criada e sem `update` no usuário da B', async () => {
      const a = await escolaComCoordenacao()
      const b = await escolaComCoordenacao()
      const daB = await semear(b.escolaId, 'pendente')
      const aluno = await bancada.sessao(a.escolaId, 'aluno')
      const antesA = await retrato(a.escolaId)
      const antesB = await retrato(b.escolaId)
      const contasAntes = await totalDeContas()
      for (const usuarioId of [daB.usuarioId, aluno.usuarioId, a.coordenacao.usuarioId, randomUUID()]) {
        expect(semRequisicao(await corrigir(a.coordenacao, usuarioId, { email: emailSorteado() })), usuarioId).toEqual(NAO_ENCONTRADO)
      }
      expect(await totalDeContas()).toBe(contasAntes)
      expect(await retrato(a.escolaId)).toEqual(antesA)
      expect(await retrato(b.escolaId)).toEqual(antesB)
      expect(await contaDe(daB.usuarioId)).toBe(daB.contaId)
      // O id fora do formato de UUID responde como o inexistente.
      expect(semRequisicao(await pedir('POST', '/v1/professores/nao-e-uuid/email', a.coordenacao.token, { email: emailSorteado() }))).toEqual(NAO_ENCONTRADO)
    })

    it('repository: `jaEntrou` e `trocarContaDoProfessor` só alcançam a escola do contexto, o papel professor, o usuário ainda inativo e a conta diferente', async () => {
      const a = await escolaComCoordenacao()
      const b = await escolaComCoordenacao()
      const daB = await semear(b.escolaId, 'pendente')
      await bancada.pool.query("insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, usado_em) values ($1, $2, 'professor', $3, now() - interval '30 days', now() - interval '31 days')", [b.escolaId, hashSorteado(), daB.usuarioId])
      const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [emailSorteado()])
      const contaNova = contas[0]?.id ?? ''
      const noContexto = <T,>(escolaId: string, corpo: (repositorio: ConviteRepository) => Promise<T>): Promise<T> =>
        runInContext({ requisicaoId: randomUUID(), escolaId }, () => corpo(new ConviteRepository(bancada.banco)))

      // A escola do contexto manda: o usuário da B, visto pela A, não entrou nem troca de conta.
      expect(await noContexto(a.escolaId, (repositorio) => repositorio.jaEntrou(daB.usuarioId))).toBe(false)
      expect(await noContexto(a.escolaId, (repositorio) => repositorio.trocarContaDoProfessor(daB.usuarioId, contaNova))).toBe(false)
      expect(await contaDe(daB.usuarioId)).toBe(daB.contaId)
      // Na escola dele, o convite usado conta.
      expect(await noContexto(b.escolaId, (repositorio) => repositorio.jaEntrou(daB.usuarioId))).toBe(true)

      // Só o professor: o coordenador inativo da escola não troca.
      const { rows: contasDoCoordenador } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [emailSorteado()])
      const { rows: coordenadores } = await bancada.pool.query<{ id: string }>(
        "insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'coordenador', 'Pessoa sintética', now()) returning id",
        [a.escolaId, contasDoCoordenador[0]?.id],
      )
      expect(await noContexto(a.escolaId, (repositorio) => repositorio.trocarContaDoProfessor(coordenadores[0]?.id ?? '', contaNova))).toBe(false)

      // Só o usuário ainda inativo: o professor ativo da escola não troca.
      const ativo = await semear(a.escolaId, 'ativo')
      expect(await noContexto(a.escolaId, (repositorio) => repositorio.trocarContaDoProfessor(ativo.usuarioId, contaNova))).toBe(false)
      expect(await contaDe(ativo.usuarioId)).toBe(ativo.contaId)

      // Só a conta diferente: a mesma conta é zero linhas; e o usuário pedido é o único que muda, os outros inativos da escola ficam.
      const inativo = await semear(a.escolaId, 'pendente')
      const outroInativo = await semear(a.escolaId, 'pendente')
      expect(await noContexto(a.escolaId, (repositorio) => repositorio.trocarContaDoProfessor(inativo.usuarioId, inativo.contaId))).toBe(false)
      expect(await noContexto(a.escolaId, (repositorio) => repositorio.trocarContaDoProfessor(inativo.usuarioId, contaNova))).toBe(true)
      expect(await contaDe(inativo.usuarioId)).toBe(contaNova)
      expect(await contaDe(outroInativo.usuarioId)).toBe(outroInativo.contaId)
    })

    it('entrada: campo a mais, e-mail fora do formato ou ausente são ENTRADA_INVALIDA, sem gravar nada', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const professor = await semear(escolaId, 'pendente')
      const antes = await retrato(escolaId)
      const contasAntes = await totalDeContas()
      const corpos = [{ email: emailSorteado(), escolaId }, { email: emailSorteado(), contaId: randomUUID() }, { email: 'sem-arroba' }, { email: '' }, { email: 42 }, {}, { Email: emailSorteado() }]
      for (const corpo of corpos) expect(semRequisicao(await corrigir(coordenacao, professor.usuarioId, corpo)), JSON.stringify(corpo)).toEqual(ENTRADA_INVALIDA)
      expect(await totalDeContas()).toBe(contasAntes)
      expect(await retrato(escolaId)).toEqual(antes)
    })
  })

  describe('auditoria e arquivo do titular (RF17)', () => {
    it('auditoria: um `usuario.email_corrigido` e um `convite.refeito`, autora a coordenação, sem e-mail, sem id de conta e sem nome', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const professor = await semear(escolaId, 'pendente')
      const certo = emailSorteado()
      const gerado = conviteDeProfessorResponseSchema.parse((await corrigir(coordenacao, professor.usuarioId, { email: certo })).corpo)
      expect(await auditoriaDe(escolaId, 'usuario.email_corrigido')).toEqual([
        { entidade: 'usuario', entidade_id: professor.usuarioId, autor_usuario_id: coordenacao.usuarioId, antes: null, depois: null, finalidade: null },
      ])
      expect(await auditoriaDe(escolaId, 'convite.refeito')).toEqual([
        {
          entidade: 'convite',
          entidade_id: gerado.conviteId,
          autor_usuario_id: coordenacao.usuarioId,
          antes: null,
          depois: { tipo: 'professor', origemId: professor.conviteId, usuarioId: professor.usuarioId, expiraEm: expect.any(String) },
          finalidade: null,
        },
      ])
      const { rows } = await bancada.pool.query<{ texto: string }>('select to_jsonb(a)::text as texto from auditoria a where escola_id = $1', [escolaId])
      const [contaNova] = await contasComEmail(certo)
      for (const { texto } of rows) for (const proibido of [certo, professor.email, professor.contaId, contaNova ?? '', gerado.token]) expect(texto).not.toContain(proibido)
    })

    it('arquivo do professor: o ato chega com o papel "coordenação", sem o autor, o antes nem o depois', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const professor = await semear(escolaId, 'pendente')
      await corrigir(coordenacao, professor.usuarioId, { email: emailSorteado() })
      const [ato] = await auditoriaDe(escolaId, 'usuario.email_corrigido')
      expect(ato).toBeDefined()
      const documento = await runInContext({ requisicaoId: randomUUID(), escolaId }, () =>
        new LeituraDoTitular(bancada.banco).montar({ titularId: professor.usuarioId, papel: 'professor', versao: 'completa', compartilhamento: [], geradoEm: new Date() }),
      )
      const linhas = (documento.tabelas['auditoria'] ?? []).filter((linha) => linha['acao'] === 'usuario.email_corrigido')
      expect(linhas).toEqual([{ id: expect.any(String), acao: 'usuario.email_corrigido', entidade: 'usuario', entidade_id: professor.usuarioId, finalidade: null, em: expect.anything(), papel: 'coordenação' }])
      expect(JSON.stringify(documento.tabelas)).not.toContain(coordenacao.usuarioId)
    })

    it('log novo: a rota só leva ids e código, nunca o e-mail velho, o novo nem o token', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const professor = await semear(escolaId, 'pendente')
      const outro = await semear(escolaId, 'revogado')
      const dono = await semear(escolaId, 'pendente')
      const aoLado = await semear(escolaId, 'pendente')
      linhasDeLog.length = 0
      const certo = emailSorteado()
      const gerado = conviteDeProfessorResponseSchema.parse((await corrigir(coordenacao, professor.usuarioId, { email: certo })).corpo)
      expect((await corrigir(coordenacao, outro.usuarioId, { email: emailSorteado() })).status).toBe(409)
      // O 23505 do `usuario_escola_conta_papel_unico`: o e-mail que já é de outro professor da escola.
      expect((await corrigir(coordenacao, aoLado.usuarioId, { email: dono.email })).status).toBe(409)
      expect(linhasDeLog.length).toBeGreaterThan(0)
      const registro = linhasDeLog.join('\n')
      for (const proibido of [certo, professor.email, outro.email, dono.email, aoLado.email, gerado.token, '@escola.invalid']) expect(registro).not.toContain(proibido)
    })
  })

  describe('corridas: tudo sob a trava do convite da escola', () => {
    it('correção × aceite do convite antigo, nas duas ordens: o aceite primeiro deixa a correção em CONFLITO; a correção primeiro deixa o aceite como o convite inexistente', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const aceitoAntes = await cadastrado(coordenacao)
      const certoA = emailSorteado()
      const [aceite, correcao] = await emOrdemNaTrava(
        bancada.pool,
        escolaId,
        () => aceitar(aceitoAntes.token, SENHA_NOVA),
        () => corrigir(coordenacao, aceitoAntes.usuarioId, { email: certoA }),
      )
      expect([aceite.status, semRequisicao(correcao)]).toEqual([200, CONFLITO])
      expect(await contasComEmail(certoA)).toEqual([])
      expect((await contasComEmail(aceitoAntes.email)).length).toBe(1)
      expect(await contaDe(aceitoAntes.usuarioId)).toBe((await contasComEmail(aceitoAntes.email))[0])

      const correcaoAntes = await cadastrado(coordenacao)
      const certoB = emailSorteado()
      const [corrigido, aceiteDepois] = await emOrdemNaTrava(
        bancada.pool,
        escolaId,
        () => corrigir(coordenacao, correcaoAntes.usuarioId, { email: certoB }),
        () => aceitar(correcaoAntes.token, SENHA_NOVA),
      )
      expect([corrigido.status, semRequisicao(aceiteDepois)]).toEqual([201, NAO_ENCONTRADO])
      expect(await contaDe(correcaoAntes.usuarioId)).toBe((await contasComEmail(certoB))[0])
      expect((await bancada.pool.query<{ ativo: boolean }>('select desativado_em is null as ativo from usuario where id = $1', [correcaoAntes.usuarioId])).rows).toEqual([{ ativo: false }])
    })

    it('duas correções do mesmo professor com e-mails diferentes, abertas juntas: sobra um convite em aberto, a conta é a de uma das duas, e nunca 500', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const professor = await semear(escolaId, 'pendente')
      const [um, dois] = [emailSorteado(), emailSorteado()]
      const respostas = await Promise.all([corrigir(coordenacao, professor.usuarioId, { email: um }), corrigir(coordenacao, professor.usuarioId, { email: dois })])
      for (const resposta of respostas) expect([201, 409]).toContain(resposta.status)
      expect(respostas.some((resposta) => resposta.status === 201)).toBe(true)
      expect(await emAberto(professor.usuarioId)).toHaveLength(1)
      expect([(await contasComEmail(um))[0], (await contasComEmail(dois))[0]]).toContain(await contaDe(professor.usuarioId))
      // Com a ordem forçada, as duas valem, uma depois da outra: o convite da segunda é o único em aberto.
      const forcado = await semear(escolaId, 'pendente')
      const [tres, quatro] = [emailSorteado(), emailSorteado()]
      const [primeira, segunda] = await emOrdemNaTrava(
        bancada.pool,
        escolaId,
        () => corrigir(coordenacao, forcado.usuarioId, { email: tres }),
        () => corrigir(coordenacao, forcado.usuarioId, { email: quatro }),
      )
      expect([primeira.status, segunda.status]).toEqual([201, 201])
      const doSegundo = conviteDeProfessorResponseSchema.parse(segunda.corpo)
      expect((await emAberto(forcado.usuarioId)).map((convite) => convite.id)).toEqual([doSegundo.conviteId])
      expect(await contaDe(forcado.usuarioId)).toBe((await contasComEmail(quatro))[0])
      expect((await consultar(conviteDeProfessorResponseSchema.parse(primeira.corpo).token)).status).toBe(404)
    })

    it('correção × "Enviar" do mesmo professor, nas duas ordens: um convite em aberto, e nunca dois `na_fila`', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const certo = emailSorteado()
      const correcaoPrimeiro = await semear(escolaId, 'pendente')
      const [corrigido, enviado] = await emOrdemNaTrava(
        bancada.pool,
        escolaId,
        () => corrigir(coordenacao, correcaoPrimeiro.usuarioId, { email: certo }),
        () => enviar(coordenacao, [correcaoPrimeiro.usuarioId]),
      )
      expect([corrigido.status, enviado.status]).toEqual([201, 200])
      // O "Enviar" depois da correção vai ao e-mail novo.
      const [envioDepois] = (await emAberto(correcaoPrimeiro.usuarioId)).filter((convite) => convite.envio === 'na_fila')
      expect(await destinoDoEnvio(envioDepois?.id ?? '')).toBe(certo)

      const enviarPrimeiro = await semear(escolaId, 'pendente')
      const [enviadoAntes, corrigidoDepois] = await emOrdemNaTrava(
        bancada.pool,
        escolaId,
        () => enviar(coordenacao, [enviarPrimeiro.usuarioId]),
        () => corrigir(coordenacao, enviarPrimeiro.usuarioId, { email: emailSorteado() }),
      )
      expect([enviadoAntes.status, corrigidoDepois.status]).toEqual([200, 201])
      // O envio que a correção encontrou na fila terminou `cancelado`, e o convite novo é o copiado.
      expect((await convitesDe(enviarPrimeiro.usuarioId)).filter((convite) => convite.envio === 'cancelado')).toHaveLength(1)

      for (const professor of [correcaoPrimeiro, enviarPrimeiro]) {
        expect(await emAberto(professor.usuarioId)).toHaveLength(1)
        expect((await convitesDe(professor.usuarioId)).filter((convite) => convite.envio === 'na_fila').length).toBeLessThanOrEqual(1)
      }
      // O refazer comum que sobra não muda a regra: o refazer depois da correção também deixa um só em aberto.
      expect((await refazer(coordenacao, enviarPrimeiro.usuarioId)).status).toBe(201)
      expect(await emAberto(enviarPrimeiro.usuarioId)).toHaveLength(1)
    })
  })
})
