import { DomainException, METRICS, runInContext } from '@educa/core'
import { DecisaoRepository } from '@educa/core/estrutura'
import { ErrorCode, MENSAGENS_DE_ERRO, decisaoResponseSchema, type ResultadoDaDecisao } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { loadExternalLoginConfig, PasswordHasher } from '../src/credencial/index.js'
import { sortearCodigoDaTurma } from '../src/sala/codigo-da-sala.js'
import { CAMINHO_DO_COOKIE_OIDC, COOKIE_CONTA_PROVADA, COOKIE_OIDC, ContaExternalRepository, CookieContaProvada, CookieOidc, ExternalLoginService } from '../src/sessao/index.js'
import { chamar, renovar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { FerramentasDaSala, pedidoDaSala, SENHA_DA_SALA, semRequisicao, type NomeDaLista, type TestSala } from './sala.fixture.js'
import { SessaoFixtures } from './sessao.fixture.js'
import { adulterarPenultimo } from './tampered-text.js'

/**
 * A conta da escola no pedido do nome (acesso-e-convites, tarefa 14.0; `tasks/prd-acesso-e-convites/cenarios.md`, "Conta da escola do aluno" e
 * "Corridas"): o aluno prova a conta no `externa/iniciar?intencao=reivindicar`, o cookie `educa_conta_provada` leva a prova ao `POST
 * /v1/salas/reivindicar` sem senha, e a aprovação humana liga a conta ao aluno novo. Contra o `oidc-falso`, o Postgres e o Redis do compose de
 * teste. A aluna do `oidc-falso` é uma só (`google-aluna-a`); cada caso monta a sua escola, e a ligação é da escola.
 */

const AMBIENTE = { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' }
const ALUNA_A = 'google-aluna-a'
const SUJEITO_DA_ALUNA = 'google-sub-aluna-a'
const PROFESSOR_ESCOLA_B = 'google-professor-escola-b'
const CONTA_PESSOAL_GOOGLE = 'google-conta-pessoal'
const PROFESSORA_A = 'google-professora-a'
const EMAIL_PROFESSORA_A = 'professora.a@escola-a.educa-sintetica.test'
const DOMINIO_A = 'escola-a.educa-sintetica.test'
/** O que o `oidc-falso` devolve sobre a aluna e nunca pode chegar ao banco, ao log nem à resposta (regra 20, itens 2 e 9). */
const DADOS_DA_ALUNA_NO_PROVEDOR = ['aluna.ficticia.a@escola-a.educa-sintetica.test', 'Aluna Ficticia Sintetica', 'Aluna Ficticia', 'fotos.educa-sintetica.test/aluna-ficticia-a.png']
const RECUSA = 'falha=conta_externa_nao_ligada'
const CONTA_DA_ALUNA = { provedor: 'google', tenant: null, sujeito: SUJEITO_DA_ALUNA }

const erro = (codigo: ErrorCode, status: number) => ({ status, texto: JSON.stringify({ erro: { codigo, mensagem: MENSAGENS_DE_ERRO[codigo], requisicaoId: '-' } }) })
const RECUSADA = erro(ErrorCode.REIVINDICACAO_RECUSADA, 409)
const ENTRADA_INVALIDA = erro(ErrorCode.ENTRADA_INVALIDA, 400)
const ENVIADO = { status: 200, texto: JSON.stringify({ resultado: 'enviado' }) }

interface Redirect {
  status: number
  location: string
  setCookie: string[]
}

interface Inicio extends Redirect {
  /** O `Cookie` que o navegador mandaria de volta no retorno. */
  cookie: string
}

interface PedidoNoBanco {
  estado: string
  senha_hash: string | null
  conta_externa: unknown
  chave_envio: string | null
  teve_matricula_errada: boolean | null
  decidida_em: Date | null
  decidida_por: string | null
  decidida_como: string | null
}

async function redirecionamento(resposta: Response): Promise<Redirect> {
  await resposta.arrayBuffer()
  return { status: resposta.status, location: resposta.headers.get('location') ?? '', setCookie: resposta.headers.getSetCookie() }
}

describe('a conta da escola no pedido do nome (14.0): prova na sala, pedido sem senha, ligação só com a aprovação', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: TestApi
  let sala: FerramentasDaSala
  let hashes: MockInstance<PasswordHasher['gerar']>

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: AMBIENTE }, linhasDeLog)
    sala = new FerramentasDaSala(api, bancada)
    hashes = vi.spyOn(api.app.get(PasswordHasher), 'gerar')
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const post = (sessao: { token: string }, caminho: string, corpo?: unknown) => chamar(api.url, 'POST', caminho, sessao.token, corpo)
  const decidir = (sessao: { token: string }, ids: readonly string[], decisao: 'aprovar' | 'recusar' = 'aprovar') => post(sessao, '/v1/reivindicacoes/decidir', { ids, decisao })
  const naEscola = <T>(escolaId: string, funcao: () => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)

  /** Uma sala nova (escola, turma, professor e acesso) com o domínio da escola A liberado para o Google. */
  async function montar(): Promise<TestSala> {
    const s = await sala.montar()
    await bancada.pool.query('insert into provedor_escola (escola_id, provedor, valor) values ($1, $2, $3)', [s.escolaId, 'google', DOMINIO_A])
    return s
  }

  async function iniciar(consulta: Record<string, string>, provedor = 'google'): Promise<Inicio> {
    const resposta = await redirecionamento(await fetch(`${api.url}${CAMINHO_DO_COOKIE_OIDC}/${provedor}/iniciar?${new URLSearchParams(consulta).toString()}`, { redirect: 'manual' }))
    const linha = resposta.setCookie.find((valor) => valor.startsWith(`${COOKIE_OIDC}=`))
    return { ...resposta, cookie: linha?.split(';')[0] ?? '' }
  }

  /** A pessoa entra no formulário do oidc-falso como `sujeito`; ele devolve o navegador ao retorno com o código. */
  async function autorizar(inicio: Inicio, sujeito: string): Promise<string> {
    const resposta = await fetch(inicio.location, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: sujeito, claims: '' }).toString(),
    })
    await resposta.arrayBuffer()
    const destino = new URL(resposta.headers.get('location') ?? '')
    expect(destino.pathname).toBe(`${CAMINHO_DO_COOKIE_OIDC}/retorno`)
    return destino.search
  }

  async function retorno(consulta: string, cookie: string): Promise<Redirect> {
    return redirecionamento(await fetch(`${api.url}${CAMINHO_DO_COOKIE_OIDC}/retorno${consulta}`, { redirect: 'manual', headers: { Cookie: cookie } }))
  }

  /** O aluno prova a conta pelo link (ou pelo código) da sala: o retorno e o cookie `educa_conta_provada`, no formato do `Cookie` do navegador. */
  async function provar(s: TestSala, via: 'token' | 'codigo' = 'token', sujeito = ALUNA_A): Promise<Redirect & { cookie: string }> {
    const inicio = await iniciar({ slug: s.slug, intencao: 'reivindicar', [via]: s[via] })
    expect(inicio.status).toBe(302)
    const resposta = await retorno(await autorizar(inicio, sujeito), inicio.cookie)
    const linha = resposta.setCookie.find((valor) => valor.startsWith(`${COOKIE_CONTA_PROVADA}=`))
    return { ...resposta, cookie: linha?.split(';')[0] ?? '' }
  }

  /** O corpo do pedido sem senha: a conta vem do cookie. */
  function semSenha(s: TestSala, nome: NomeDaLista, via: 'token' | 'codigo' = 'token', extra: Record<string, unknown> = {}) {
    const { senha: _senha, ...corpo } = pedidoDaSala(s, nome, extra, via)
    return corpo
  }

  async function pedirComConta(s: TestSala, nome: NomeDaLista, via: 'token' | 'codigo' = 'token') {
    const provada = await provar(s, via)
    expect(provada.cookie).not.toBe('')
    const resposta = await sala.reivindicar(semSenha(s, nome, via), { cabecalhos: { Cookie: provada.cookie } })
    return { provada, resposta }
  }

  async function pedidosDe(nomeId: string): Promise<PedidoNoBanco[]> {
    const { rows } = await bancada.pool.query<PedidoNoBanco>(
      'select estado, senha_hash, conta_externa, chave_envio, teve_matricula_errada, decidida_em, decidida_por, decidida_como from reivindicacao where lista_nome_id = $1 order by solicitada_em',
      [nomeId],
    )
    return rows
  }

  async function pedidoId(nomeId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(`select id from reivindicacao where lista_nome_id = $1 and estado = 'pendente'`, [nomeId])
    const id = rows[0]?.id
    if (id === undefined) throw new Error('pedido pendente não encontrado')
    return id
  }

  async function contar(tabela: 'usuario' | 'conta_externa' | 'sessao' | 'reivindicacao' | 'credencial_matricula', escolaId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ n: number }>(`select count(*)::int as n from ${tabela} where escola_id = $1`, [escolaId])
    return rows[0]?.n ?? 0
  }

  async function retornosComResultado(resultado: string): Promise<number> {
    const pontos = await medidor.pontos(METRICS.loginExterno)
    return pontos.filter((ponto) => ponto.atributos['resultado'] === resultado).reduce((soma, ponto) => soma + (typeof ponto.valor === 'number' ? ponto.valor : 0), 0)
  }

  /** Quantos pedidos a métrica `sala.reivindicacao` contou com o resultado, desde o começo do arquivo (contador cumulativo). */
  async function pedidosComResultado(resultado: string): Promise<number> {
    const pontos = await medidor.pontos(METRICS.reivindicacaoNaSala)
    return pontos.filter((ponto) => ponto.atributos['resultado'] === resultado).reduce((soma, ponto) => soma + (typeof ponto.valor === 'number' ? ponto.valor : 0), 0)
  }

  async function estadoDoNome(nomeId: string): Promise<string | undefined> {
    return (await bancada.pool.query<{ estado: string }>('select estado from lista_nome where id = $1', [nomeId])).rows[0]?.estado
  }

  function resultados(resposta: RespostaHttp): ResultadoDaDecisao[] {
    expect(resposta.status).toBe(200)
    return decisaoResponseSchema.parse(resposta.corpo).resultados.map((linha) => linha.resultado)
  }

  /** O login pela conta da escola, sem `intencao`: o de sempre. */
  async function entrarPelaConta(s: TestSala, sujeito = ALUNA_A): Promise<Redirect> {
    const inicio = await iniciar({ slug: s.slug })
    expect(inicio.status).toBe(302)
    return retorno(await autorizar(inicio, sujeito), inicio.cookie)
  }

  async function eu(resposta: Redirect): Promise<Record<string, unknown>> {
    const linha = resposta.setCookie.find((valor) => valor.startsWith('educa_sessao='))
    expect(linha, 'o retorno não deixou educa_sessao').toBeDefined()
    const renovada = await renovar(api.url, linha?.split(';')[0])
    expect(renovada.status).toBe(200)
    const lida = await chamar(api.url, 'GET', '/v1/eu', String(renovada.corpo['token']))
    expect(lida.status).toBe(200)
    return lida.corpo
  }

  function cookieForjado(conta: { escolaId: string; acessoId: string }, agora: () => number = Date.now, chave?: Uint8Array): string {
    const { chaveDoCookie } = loadExternalLoginConfig(lerAmbienteDeTeste())
    const usada = chave ?? chaveDoCookie
    if (usada === undefined) throw new Error('ambiente de teste sem chave do cookie')
    const gravado = new CookieContaProvada(usada, 'local', agora).gravar({ ...conta, provedor: 'google', tenant: null, sujeito: SUJEITO_DA_ALUNA })
    return gravado.split(';')[0] ?? ''
  }

  describe('o início e o retorno: a prova da conta', () => {
    it('caminho feliz, pelo link e pelo código: domínio liberado e conta sem ligação voltam à sala com o cookie da conta (Path=/v1/salas, 15 min), sem ligar nem criar ninguém', async () => {
      const s = await montar()
      // A escola já nasce com a coordenação e o professor, cada um com a sessão da fixture.
      const antes = await Promise.all([contar('usuario', s.escolaId), contar('conta_externa', s.escolaId), contar('sessao', s.escolaId)])
      const provadasAntes = await retornosComResultado('conta_provada')
      for (const via of ['token', 'codigo'] as const) {
        const provada = await provar(s, via)
        expect(provada.status).toBe(302)
        expect(provada.location).toBe(`/e/${s.slug}/turma?conta=provada`)
        expect(provada.setCookie).toHaveLength(2)
        expect(provada.setCookie[0]).toBe(`educa_oidc=; Path=${CAMINHO_DO_COOKIE_OIDC}; HttpOnly; SameSite=Lax; Max-Age=0`)
        expect(provada.setCookie[1]).toMatch(/^educa_conta_provada=[\w-]{40,}; Path=\/v1\/salas; HttpOnly; SameSite=Lax; Max-Age=900$/)
        expect(provada.setCookie.some((valor) => valor.startsWith('educa_sessao='))).toBe(false)
      }
      expect(await Promise.all([contar('usuario', s.escolaId), contar('conta_externa', s.escolaId), contar('sessao', s.escolaId)])).toEqual(antes)
      expect((await retornosComResultado('conta_provada')) - provadasAntes).toBe(2)
    })

    it('o professor da escola, com a conta e o e-mail certos, não é ligado pela intenção de reivindicar: volta com o cookie, e nenhuma ligação nasce', async () => {
      const s = await montar()
      await bancada.equipeComEmail(s.escolaId, EMAIL_PROFESSORA_A)
      const provada = await provar(s, 'token', PROFESSORA_A)
      expect(provada.location).toBe(`/e/${s.slug}/turma?conta=provada`)
      expect(await contar('conta_externa', s.escolaId)).toBe(0)
    })

    it('domínio não liberado e conta pessoal sem domínio: recusados como sempre, sem cookie da conta e sem pedido', async () => {
      const s = await montar()
      for (const sujeito of [PROFESSOR_ESCOLA_B, CONTA_PESSOAL_GOOGLE]) {
        const resposta = await provar(s, 'token', sujeito)
        expect(resposta.location, sujeito).toBe(`/e/${s.slug}?${RECUSA}`)
        expect(resposta.setCookie, sujeito).toEqual([expect.stringMatching(/^educa_oidc=; /)])
      }
      expect(await contar('reivindicacao', s.escolaId)).toBe(0)
    })

    it('isolamento: o token e o código da sala da B sob o slug da A, e o formato errado, são recusados já no início, sem cookie e sem ir ao provedor', async () => {
      const [a, b] = [await montar(), await montar()]
      const respostas = [
        await iniciar({ slug: a.slug, intencao: 'reivindicar', token: b.token }),
        await iniciar({ slug: a.slug, intencao: 'reivindicar', codigo: b.codigo }),
        await iniciar({ slug: a.slug, intencao: 'reivindicar', token: 'token-que-nao-existe' }),
        await iniciar({ slug: a.slug, intencao: 'reivindicar' }),
        await iniciar({ slug: a.slug, intencao: 'reivindicar', token: a.token, codigo: a.codigo }),
        await iniciar({ slug: a.slug, intencao: 'ligar', token: a.token }),
        await iniciar({ slug: a.slug, token: a.token }),
        await iniciar({ slug: a.slug, codigo: a.codigo }),
        await iniciar({ slug: `${a.slug}-nao-existe`, intencao: 'reivindicar', token: a.token }),
      ]
      for (const resposta of respostas) {
        expect(resposta.status).toBe(404)
        expect(resposta.setCookie).toEqual([])
        expect(resposta.location).toBe('')
      }
      // A do slug certo vai ao provedor, com o cookie do início.
      const boa = await iniciar({ slug: a.slug, intencao: 'reivindicar', token: a.token })
      expect(boa.status).toBe(302)
      expect(new URL(boa.location).searchParams.get('code_challenge_method')).toBe('S256')
      expect(boa.cookie).not.toBe('')
    })

    it('o código errado pelo início soma no limite de código errado da escola, como o salas/abrir: N códigos errados somam N, o certo segue ao provedor sem somar, e o link errado e o slug que não existe não somam', async () => {
      const [a, b] = [await montar(), await montar()]
      const antes = await sala.contadores(a, a.turma)
      const antesDeB = await sala.contadores(b, b.turma)
      for (let vez = 0; vez < 3; vez++) {
        const errada = await iniciar({ slug: a.slug, intencao: 'reivindicar', codigo: sortearCodigoDaTurma() })
        expect([errada.status, errada.location, errada.setCookie]).toEqual([404, '', []])
      }
      expect((await sala.contadores(a, a.turma)).escola - antes.escola).toBe(3)
      const certa = await iniciar({ slug: a.slug, intencao: 'reivindicar', codigo: a.codigo })
      expect(certa.status).toBe(302)
      expect((await sala.contadores(a, a.turma)).escola - antes.escola).toBe(3)
      // O link errado e o slug que não existe não somam em nada; a escola B, que nada pediu, segue como estava.
      await iniciar({ slug: a.slug, intencao: 'reivindicar', token: 'token-que-nao-existe' })
      await iniciar({ slug: `${a.slug}-nao-existe`, intencao: 'reivindicar', codigo: sortearCodigoDaTurma() })
      expect((await sala.contadores(a, a.turma)).escola - antes.escola).toBe(3)
      expect(await sala.contadores(b, b.turma)).toEqual(antesDeB)
    })

    it('o serviço também confere: o acesso de outra escola que o do slug dá o NAO_ENCONTRADO, e o do slug segue ao provedor', async () => {
      const [a, b] = [await montar(), await montar()]
      const login = api.app.get(ExternalLoginService)
      const acessoDeB = { escolaId: b.escolaId, acessoId: await sala.acessoVigente(b.turma) }
      await expect(login.iniciar('google', a.slug, acessoDeB)).rejects.toMatchObject({ codigo: ErrorCode.NAO_ENCONTRADO })
      await expect(login.iniciar('google', a.slug, acessoDeB)).rejects.toBeInstanceOf(DomainException)
      const doSlug = await login.iniciar('google', a.slug, { escolaId: a.escolaId, acessoId: await sala.acessoVigente(a.turma) })
      expect(new URL(doSlug.endereco).searchParams.get('code_challenge_method')).toBe('S256')
    })

    it('a conta ligada a aluno ativo entra como sempre, com a intenção de reivindicar também; a ligada a aluno desativado é recusada; sem cookie da conta nos dois', async () => {
      const s = await montar()
      const [alunoId] = await bancada.alunosComMatricula(s.escolaId, [{ matricula: `RA${randomUUID().slice(0, 8)}`, senhaHash: await api.app.get(PasswordHasher).gerar(SENHA_DA_SALA) }])
      if (alunoId === undefined) throw new Error('aluno não criado')
      await naEscola(s.escolaId, () => new ContaExternalRepository(bancada.banco).ligar(alunoId, { provedor: 'google', tenant: null, sujeito: SUJEITO_DA_ALUNA }))

      const entrou = await provar(s)
      expect(entrou.location).toBe('/')
      expect(entrou.setCookie.some((valor) => valor.startsWith(`${COOKIE_CONTA_PROVADA}=`))).toBe(false)
      expect(await eu(entrou)).toMatchObject({ usuarioId: alunoId, papel: 'aluno' })

      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [alunoId])
      const desligado = await provar(s)
      expect(desligado.location).toBe(`/e/${s.slug}?${RECUSA}`)
      expect(desligado.setCookie.some((valor) => valor.startsWith(`${COOKIE_CONTA_PROVADA}=`))).toBe(false)
      const semIntencao = await entrarPelaConta(s)
      expect(semIntencao.location).toBe(`/e/${s.slug}?${RECUSA}`)
    })

    it('ano sem curso: o início sem intenção responde como hoje (vai ao provedor), com a intenção de reivindicar é recusado, e nenhum pedido se abre', async () => {
      const s = await montar()
      expect((await post(s.coordenacao, `/v1/anos-letivos/${s.anoLetivoId}/encerrar`)).status).toBe(200)

      const comoHoje = await iniciar({ slug: s.slug })
      expect(comoHoje.status).toBe(302)
      expect(comoHoje.cookie).not.toBe('')
      const reivindicar = await iniciar({ slug: s.slug, intencao: 'reivindicar', token: s.token })
      expect(reivindicar.status).toBe(404)
      expect(reivindicar.setCookie).toEqual([])
      expect(await contar('reivindicacao', s.escolaId)).toBe(0)
    })
  })

  describe('o pedido do nome com a conta provada', () => {
    it('o pedido pendente guarda a conta (provedor, tenant e sujeito) no lugar do hash, sem rodar o argon2; o cookie é apagado ao gravar; o nome sai da sala', async () => {
      const s = await montar()
      const nome = await sala.umNome(s)
      hashes.mockClear()

      const { resposta } = await pedirComConta(s, nome)

      expect(semRequisicao(resposta)).toEqual(ENVIADO)
      expect(resposta.setCookie).toEqual(['educa_conta_provada=; Path=/v1/salas; HttpOnly; SameSite=Lax; Max-Age=0'])
      expect(hashes).not.toHaveBeenCalled()
      expect(await pedidosDe(nome.id)).toEqual([
        { estado: 'pendente', senha_hash: null, conta_externa: CONTA_DA_ALUNA, chave_envio: expect.any(String), teve_matricula_errada: false, decidida_em: null, decidida_por: null, decidida_como: null },
      ])
      expect(await estadoDoNome(nome.id)).toBe('reivindicado')
    })

    it('o reenvio com a mesma chave responde enviado sem pedido novo e apaga o cookie de novo', async () => {
      const s = await montar()
      const nome = await sala.umNome(s)
      const provada = await provar(s)
      const corpo = semSenha(s, nome)
      const primeira = await sala.reivindicar(corpo, { cabecalhos: { Cookie: provada.cookie } })
      const segunda = await sala.reivindicar(corpo, { cabecalhos: { Cookie: provada.cookie } })
      expect([semRequisicao(primeira), semRequisicao(segunda)]).toEqual([ENVIADO, ENVIADO])
      expect(segunda.setCookie).toEqual(['educa_conta_provada=; Path=/v1/salas; HttpOnly; SameSite=Lax; Max-Age=0'])
      expect(await pedidosDe(nome.id)).toHaveLength(1)
    })

    it('o reenvio sem cookie, depois que o primeiro envio já o apagou (clique duplo, queda de rede), responde enviado e não pede a prova de novo; o nome de outro pedido, sem cookie, é a ENTRADA_INVALIDA', async () => {
      const s = await montar()
      const [nome, outro] = [await sala.umNome(s), await sala.umNome(s)]
      const provada = await provar(s)
      const corpo = semSenha(s, nome)
      expect(semRequisicao(await sala.reivindicar(corpo, { cabecalhos: { Cookie: provada.cookie } }))).toEqual(ENVIADO)
      const reenvio = await sala.reivindicar(corpo)
      expect(semRequisicao(reenvio)).toEqual(ENVIADO)
      expect(reenvio.setCookie).toEqual(['educa_conta_provada=; Path=/v1/salas; HttpOnly; SameSite=Lax; Max-Age=0'])
      expect(await pedidosDe(nome.id)).toHaveLength(1)
      // O pedido novo, de outro nome, sem cookie, não é reenvio: pede a prova.
      expect((await sala.reivindicar(semSenha(s, outro))).status).toBe(400)
      expect(await pedidosDe(outro.id)).toEqual([])
    })

    it('o cookie não serve a um segundo pedido: outro nome, com o mesmo cookie e a mesma conta, é recusado, e o nome segue livre', async () => {
      const s = await montar()
      const [primeiro, segundo] = await sala.nomes(s, s.turma, 2)
      if (primeiro === undefined || segundo === undefined) throw new Error('nomes não gravados')
      const provada = await provar(s)
      expect(semRequisicao(await sala.reivindicar(semSenha(s, primeiro), { cabecalhos: { Cookie: provada.cookie } }))).toEqual(ENVIADO)

      expect(semRequisicao(await sala.reivindicar(semSenha(s, segundo), { cabecalhos: { Cookie: provada.cookie } }))).toEqual(RECUSADA)
      expect(await pedidosDe(segundo.id)).toEqual([])
      expect(await estadoDoNome(segundo.id)).toBe('livre')
    })

    it('o cookie que não vale dá a mesma ENTRADA_INVALIDA, sem pedido: ausente, vencido, adulterado, de outra chave, do educa_oidc, de outra escola e de outro acesso', async () => {
      const [a, b] = [await montar(), await montar()]
      const nome = await sala.umNome(a)
      const acessoDeA = await sala.acessoVigente(a.turma)
      await sala.gerar(a, a.outraTurma)
      const acessoDaOutraTurma = await sala.acessoVigente(a.outraTurma)
      const acessoDeB = await sala.acessoVigente(b.turma)
      const { chaveDoCookie } = loadExternalLoginConfig(lerAmbienteDeTeste())
      if (chaveDoCookie === undefined) throw new Error('ambiente de teste sem chave do cookie')
      const valido = { escolaId: a.escolaId, acessoId: acessoDeA }
      const doOidc = new CookieOidc(chaveDoCookie, 'local')
        .gravar({ escolaId: a.escolaId, slug: a.slug, provedor: 'google', state: 'state-sintetico-0123456789', nonce: 'nonce-sintetico-0123456789', verificador: 'verificador-sintetico-0123456789' })
        .split(';')[0]
        ?.replace(`${COOKIE_OIDC}=`, '')
      const bom = cookieForjado(valido)
      const casos: ReadonlyArray<readonly [string, string | undefined]> = [
        ['sem cookie', undefined],
        ['vencido', cookieForjado(valido, () => Date.now() - 901_000)],
        ['adulterado', adulterarPenultimo(bom)],
        ['de outra chave', cookieForjado(valido, Date.now, new Uint8Array(32).fill(7))],
        ['do educa_oidc', `${COOKIE_CONTA_PROVADA}=${doOidc ?? ''}`],
        // Só a escola difere (o acesso é o da sala da A), e só o acesso difere (a escola é a da A): cada conferência cai sozinha.
        ['de outra escola, com o acesso da A', cookieForjado({ escolaId: b.escolaId, acessoId: acessoDeA })],
        ['de outro acesso da mesma escola', cookieForjado({ escolaId: a.escolaId, acessoId: acessoDaOutraTurma })],
        ['da sala da B', cookieForjado({ escolaId: b.escolaId, acessoId: acessoDeB })],
      ]
      const invalidasAntes = await pedidosComResultado('conta_invalida')
      for (const [caso, cookie] of casos) {
        const cabecalhos = cookie === undefined ? {} : { Cookie: cookie }
        const resposta = await sala.reivindicar(semSenha(a, nome), { cabecalhos })
        expect(semRequisicao(resposta), caso).toEqual(ENTRADA_INVALIDA)
        expect(resposta.setCookie, caso).toEqual([])
      }
      expect((await pedidosComResultado('conta_invalida')) - invalidasAntes).toBe(casos.length)
      expect(await pedidosDe(nome.id)).toEqual([])
      expect(await estadoDoNome(nome.id)).toBe('livre')
      // O controle: o cookie bom da mesma sala, com o mesmo corpo, grava.
      expect(semRequisicao(await sala.reivindicar(semSenha(a, nome), { cabecalhos: { Cookie: bom } }))).toEqual(ENVIADO)
    })

    it('com senha no corpo o cookie da conta não é lido nem apagado: o pedido sai com o hash, a conta nula, e a resposta não mexe no cookie', async () => {
      const s = await montar()
      const nome = await sala.umNome(s)
      const provada = await provar(s)
      hashes.mockClear()
      const resposta = await sala.reivindicar(pedidoDaSala(s, nome, {}, 'token'), { cabecalhos: { Cookie: provada.cookie } })
      expect(semRequisicao(resposta)).toEqual(ENVIADO)
      expect(resposta.setCookie).toEqual([])
      expect(hashes).toHaveBeenCalledTimes(1)
      expect(await pedidosDe(nome.id)).toEqual([expect.objectContaining({ estado: 'pendente', senha_hash: expect.stringMatching(/^\$argon2id\$/), conta_externa: null })])
    })

    it('o pedido de conta recusado (o nome já tomado, com a matrícula certa) não roda hash e não conta no teto de hashes da turma', async () => {
      const s = await montar()
      const nome = await sala.umNome(s)
      expect(semRequisicao(await sala.reivindicar(pedidoDaSala(s, nome, {}, 'token')))).toEqual(ENVIADO)
      const antes = await sala.contadores(s, s.turma)
      hashes.mockClear()

      const { resposta } = await pedirComConta(s, nome)

      expect(semRequisicao(resposta)).toEqual(RECUSADA)
      expect(hashes).not.toHaveBeenCalled()
      expect((await sala.contadores(s, s.turma)).turma).toBe(antes.turma)
    })

    it('[P] mesma conta em dois pedidos ao mesmo tempo, em dois nomes: um pendente, o outro recusado (nunca 5xx), e o nome do perdedor segue livre', async () => {
      const s = await montar()
      const [um, dois] = await sala.nomes(s, s.turma, 2)
      if (um === undefined || dois === undefined) throw new Error('nomes não gravados')
      const provada = await provar(s)

      const respostas = await Promise.all([um, dois].map((nome) => sala.reivindicar(semSenha(s, nome), { cabecalhos: { Cookie: provada.cookie } })))

      expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 409])
      const { rows } = await bancada.pool.query<{ n: number }>(`select count(*)::int as n from reivindicacao where escola_id = $1 and estado = 'pendente'`, [s.escolaId])
      expect(rows[0]?.n).toBe(1)
      expect((await Promise.all([um, dois].map((nome) => estadoDoNome(nome.id)))).sort()).toEqual(['livre', 'reivindicado'])
    })
  })

  describe('a decisão: aprovar liga a conta, recusar a descarta', () => {
    it('pedido pendente: o login pela conta é a credencial inválida (recusa), sem usuário novo nem sessão; aprovar liga, o aluno entra pela conta, e contaExterna fica nula', async () => {
      const s = await montar()
      const nome = await sala.umNome(s)
      await pedirComConta(s, nome)
      const id = await pedidoId(nome.id)
      const antes = await Promise.all([contar('usuario', s.escolaId), contar('conta_externa', s.escolaId), contar('sessao', s.escolaId)])

      const enquantoPendente = await entrarPelaConta(s)
      expect(enquantoPendente.location).toBe(`/e/${s.slug}?${RECUSA}`)
      expect(await Promise.all([contar('usuario', s.escolaId), contar('conta_externa', s.escolaId), contar('sessao', s.escolaId)])).toEqual(antes)

      expect(resultados(await decidir(s.professor, [id]))).toEqual(['decidida'])

      const { rows: alunos } = await bancada.pool.query<{ id: string; nome: string; conta_id: string | null }>(`select id, nome, conta_id from usuario where escola_id = $1 and papel = 'aluno'`, [s.escolaId])
      expect(alunos).toEqual([{ id: expect.any(String), nome: nome.nome, conta_id: null }])
      const alunoId = alunos[0]?.id ?? ''
      const { rows: credenciais } = await bancada.pool.query('select usuario_id, matricula, senha_hash from credencial_matricula where escola_id = $1', [s.escolaId])
      expect(credenciais).toEqual([{ usuario_id: alunoId, matricula: nome.matricula, senha_hash: null }])
      const { rows: ligacoes } = await bancada.pool.query('select usuario_id, provedor, tenant, sujeito from conta_externa where escola_id = $1', [s.escolaId])
      expect(ligacoes).toEqual([{ usuario_id: alunoId, ...CONTA_DA_ALUNA }])
      expect(await pedidosDe(nome.id)).toEqual([
        { estado: 'aprovada', senha_hash: null, conta_externa: null, chave_envio: null, teve_matricula_errada: null, decidida_em: expect.any(Date), decidida_por: s.professor.usuarioId, decidida_como: 'professor' },
      ])

      const entrou = await entrarPelaConta(s)
      expect(entrou.location).toBe('/')
      expect(await eu(entrou)).toMatchObject({ usuarioId: alunoId, papel: 'aluno', escola: { id: s.escolaId } })
      // Sem senha, o login por matrícula é a mesma credencial inválida.
      const porMatricula = await chamar(api.url, 'POST', '/v1/sessao/matricula', undefined, { slug: s.slug, matricula: nome.matricula, senha: SENHA_DA_SALA })
      expect(porMatricula.status).toBe(401)
      expect(porMatricula.corpo.erro?.codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    })

    it('conta_externa.ligada: um registro na aprovação, de quem decidiu, só com o id e o provedor; nenhum na recusa', async () => {
      const s = await montar()
      const nome = await sala.umNome(s)
      await pedirComConta(s, nome)
      expect(resultados(await decidir(s.professor, [await pedidoId(nome.id)]))).toEqual(['decidida'])
      const { rows } = await bancada.pool.query<{ autor_usuario_id: string; depois: unknown; entidade_id: string }>(
        `select autor_usuario_id, depois, entidade_id from auditoria where escola_id = $1 and acao = 'conta_externa.ligada'`,
        [s.escolaId],
      )
      const { rows: ligacao } = await bancada.pool.query<{ id: string; usuario_id: string }>('select id, usuario_id from conta_externa where escola_id = $1', [s.escolaId])
      expect(rows).toEqual([{ autor_usuario_id: s.professor.usuarioId, entidade_id: ligacao[0]?.id, depois: { usuarioId: ligacao[0]?.usuario_id, provedor: 'google' } }])

      const outra = await montar()
      const outroNome = await sala.umNome(outra)
      await pedirComConta(outra, outroNome)
      expect(resultados(await decidir(outra.professor, [await pedidoId(outroNome.id)], 'recusar'))).toEqual(['decidida'])
      const { rows: nenhuma } = await bancada.pool.query(`select 1 from auditoria where escola_id = $1 and acao = 'conta_externa.ligada'`, [outra.escolaId])
      expect(nenhuma).toEqual([])
    })

    it('recusar descarta a conta: contaExterna nula, estado recusada, o nome volta a livre, nenhum usuário nem ligação, e a mesma conta pode pedir de novo', async () => {
      const s = await montar()
      const nome = await sala.umNome(s)
      await pedirComConta(s, nome)

      expect(resultados(await decidir(s.coordenacao, [await pedidoId(nome.id)], 'recusar'))).toEqual(['decidida'])

      expect(await pedidosDe(nome.id)).toEqual([
        { estado: 'recusada', senha_hash: null, conta_externa: null, chave_envio: null, teve_matricula_errada: null, decidida_em: expect.any(Date), decidida_por: s.coordenacao.usuarioId, decidida_como: 'coordenacao' },
      ])
      expect(await estadoDoNome(nome.id)).toBe('livre')
      expect(await Promise.all([contar('conta_externa', s.escolaId), contar('credencial_matricula', s.escolaId)])).toEqual([0, 0])
      expect(semRequisicao((await pedirComConta(s, nome)).resposta)).toEqual(ENVIADO)
    })

    it('aprovar com a conta já ligada a outro aluno (ligou enquanto o pedido esperava): CONFLITO sem nome nem id, nenhum usuário novo, o pedido segue pendente com a conta e o nome reivindicado', async () => {
      const s = await montar()
      const nome = await sala.umNome(s)
      await pedirComConta(s, nome)
      const id = await pedidoId(nome.id)
      const [outroAluno] = await bancada.alunosComMatricula(s.escolaId, [{ matricula: `RA${randomUUID().slice(0, 8)}`, senhaHash: await api.app.get(PasswordHasher).gerar(SENHA_DA_SALA) }])
      if (outroAluno === undefined) throw new Error('aluno não criado')
      await naEscola(s.escolaId, () => new ContaExternalRepository(bancada.banco).ligar(outroAluno, { provedor: 'google', tenant: null, sujeito: SUJEITO_DA_ALUNA }))
      const usuariosAntes = await contar('usuario', s.escolaId)

      const resposta = await decidir(s.professor, [id])

      expect(resposta.status).toBe(409)
      expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
      const texto = JSON.stringify(resposta.corpo)
      expect(texto).not.toContain(outroAluno)
      expect(texto).not.toContain(nome.nome)
      expect(texto).not.toContain(nome.matricula)
      expect(await contar('usuario', s.escolaId)).toBe(usuariosAntes)
      expect(await contar('credencial_matricula', s.escolaId)).toBe(1)
      expect(await contar('conta_externa', s.escolaId)).toBe(1)
      expect(await pedidosDe(nome.id)).toEqual([expect.objectContaining({ estado: 'pendente', conta_externa: CONTA_DA_ALUNA, decidida_em: null })])
      expect(await estadoDoNome(nome.id)).toBe('reivindicado')
      const { rows: auditoria } = await bancada.pool.query(`select 1 from auditoria where escola_id = $1 and acao in ('conta_externa.ligada', 'reivindicacao.decidida')`, [s.escolaId])
      expect(auditoria).toEqual([])
    })

    it('o lote [ok, conflito, ok]: o CONFLITO para o lote no segundo; o primeiro fica decidido, o terceiro nem é lido, e a resposta é o 409 sem dizer quem ficou (a tela relê os pedidos)', async () => {
      const s = await montar()
      const [primeiro, segundo, terceiro] = [await sala.umNome(s), await sala.umNome(s), await sala.umNome(s)]
      expect(semRequisicao(await sala.reivindicar(pedidoDaSala(s, primeiro)))).toEqual(ENVIADO)
      await pedirComConta(s, segundo)
      expect(semRequisicao(await sala.reivindicar(pedidoDaSala(s, terceiro)))).toEqual(ENVIADO)
      const ids = [await pedidoId(primeiro.id), await pedidoId(segundo.id), await pedidoId(terceiro.id)]
      const [outroAluno] = await bancada.alunosComMatricula(s.escolaId, [{ matricula: `RA${randomUUID().slice(0, 8)}`, senhaHash: await api.app.get(PasswordHasher).gerar(SENHA_DA_SALA) }])
      if (outroAluno === undefined) throw new Error('aluno não criado')
      await naEscola(s.escolaId, () => new ContaExternalRepository(bancada.banco).ligar(outroAluno, { provedor: 'google', tenant: null, sujeito: SUJEITO_DA_ALUNA }))

      const resposta = await decidir(s.professor, ids)

      expect(resposta.status).toBe(409)
      expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
      const texto = JSON.stringify(resposta.corpo)
      for (const id of ids) expect(texto).not.toContain(id)
      expect((await pedidosDe(primeiro.id)).map((p) => p.estado)).toEqual(['aprovada'])
      expect((await pedidosDe(segundo.id)).map((p) => p.estado)).toEqual(['pendente'])
      expect((await pedidosDe(terceiro.id)).map((p) => p.estado)).toEqual(['pendente'])
      expect(await estadoDoNome(primeiro.id)).toBe('aprovado')
      expect(await estadoDoNome(terceiro.id)).toBe('reivindicado')
    })

    it('[P] clique duplo em aprovar (professor × coordenação): uma decisão, uma conta_externa, um usuário e um registro conta_externa.ligada', async () => {
      const s = await montar()
      const nome = await sala.umNome(s)
      await pedirComConta(s, nome)
      const id = await pedidoId(nome.id)

      const respostas = await Promise.all([decidir(s.professor, [id]), decidir(s.coordenacao, [id])])

      expect(respostas.flatMap(resultados).sort()).toEqual(['decidida', 'ja_decidida'])
      expect(await Promise.all([contar('conta_externa', s.escolaId), contar('credencial_matricula', s.escolaId)])).toEqual([1, 1])
      const { rows } = await bancada.pool.query<{ n: number }>(`select count(*)::int as n from auditoria where escola_id = $1 and acao = 'conta_externa.ligada'`, [s.escolaId])
      expect(rows[0]?.n).toBe(1)
    })
  })

  describe('o encerramento sem decisão e o banco', () => {
    it('a transferência no job (fechar encerrada pelos nomes) e a virada do ano deixam a contaExterna nula, sem decididaEm, decididaPor nem decididaComo', async () => {
      const porTransferencia = await montar()
      const nomeDaTransferencia = await sala.umNome(porTransferencia)
      await pedirComConta(porTransferencia, nomeDaTransferencia)
      const fechados = await naEscola(porTransferencia.escolaId, () => new DecisaoRepository(bancada.banco).fechar({ listaNomeIds: [nomeDaTransferencia.id] }, 'encerrada'))
      expect(fechados).toHaveLength(1)
      expect(await pedidosDe(nomeDaTransferencia.id)).toEqual([
        { estado: 'encerrada', senha_hash: null, conta_externa: null, chave_envio: null, teve_matricula_errada: null, decidida_em: null, decidida_por: null, decidida_como: null },
      ])

      const porVirada = await montar()
      const nomeDaVirada = await sala.umNome(porVirada)
      await pedirComConta(porVirada, nomeDaVirada)
      expect((await post(porVirada.coordenacao, `/v1/anos-letivos/${porVirada.anoLetivoId}/encerrar`)).status).toBe(200)
      // A virada tira o nome da lista, e o pedido encerrado fica sem ele: acha-se pela escola.
      const { rows } = await bancada.pool.query<PedidoNoBanco>(
        'select estado, senha_hash, conta_externa, chave_envio, teve_matricula_errada, decidida_em, decidida_por, decidida_como from reivindicacao where escola_id = $1',
        [porVirada.escolaId],
      )
      expect(rows).toEqual([{ estado: 'encerrada', senha_hash: null, conta_externa: null, chave_envio: null, teve_matricula_errada: null, decidida_em: null, decidida_por: null, decidida_como: null }])
    })

    it('o check direto no banco: recusa o pendente com senha e conta juntas ou com nenhuma das duas, e o decidido ou encerrado com conta; aceita o pendente com uma só', async () => {
      const s = await montar()
      const [um, dois, tres] = await sala.nomes(s, s.turma, 3)
      if (um === undefined || dois === undefined || tres === undefined) throw new Error('nomes não gravados')
      const inserir = (nomeId: string, colunas: Record<string, unknown>) => {
        const todas = { escola_id: s.escolaId, ano_letivo_id: s.anoLetivoId, turma_id: s.turma, lista_nome_id: nomeId, ...colunas }
        const nomes = Object.keys(todas)
        return bancada.pool.query(`insert into reivindicacao (${nomes.join(', ')}) values (${nomes.map((_, posicao) => `$${String(posicao + 1)}`).join(', ')})`, Object.values(todas))
      }
      const conta = JSON.stringify(CONTA_DA_ALUNA)
      const marcas = { chave_envio: randomUUID(), teve_matricula_errada: false }
      const violacoes: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
        ['pendente com senha e conta', { ...marcas, senha_hash: '$argon2id$sintetico', conta_externa: conta }],
        ['pendente sem senha nem conta', { ...marcas }],
        ['pendente com conta, sem chave', { teve_matricula_errada: false, conta_externa: conta }],
        ['pendente com conta, sem teve_matricula_errada', { chave_envio: randomUUID(), conta_externa: conta }],
        ['aprovada com conta', { estado: 'aprovada', conta_externa: conta }],
        ['recusada com conta', { estado: 'recusada', decidida_como: 'professor', conta_externa: conta }],
        ['encerrada com conta', { estado: 'encerrada', conta_externa: conta }],
      ]
      for (const [caso, colunas] of violacoes) await expect(inserir(um.id, colunas), caso).rejects.toMatchObject({ code: '23514', constraint: 'reivindicacao_segredo_so_pendente' })
      await inserir(um.id, { ...marcas, conta_externa: conta })
      await inserir(dois.id, { chave_envio: randomUUID(), teve_matricula_errada: true, senha_hash: '$argon2id$sintetico' })
      // A mesma conta em outro pendente da escola: o único parcial. Fora do pendente, a conta repete (as quatro nulas).
      await expect(inserir(tres.id, { chave_envio: randomUUID(), teve_matricula_errada: false, conta_externa: conta })).rejects.toMatchObject({ code: '23505', constraint: 'reivindicacao_conta_pendente_unica' })
      await inserir(tres.id, { estado: 'recusada', decidida_como: 'professor' })
    })

    it('o check novo valida as linhas de antes da migration: o pendente com hash e o fechado sem nada, no formato antigo, passam pela definição do check do banco; o pendente sem nada, não', async () => {
      const cliente = await bancada.pool.connect()
      try {
        const { rows } = await cliente.query<{ definicao: string }>(
          `select pg_get_constraintdef(oid) as definicao from pg_constraint where conname = 'reivindicacao_segredo_so_pendente' and conrelid = 'reivindicacao'::regclass`,
        )
        const definicao = rows[0]?.definicao
        if (definicao === undefined) throw new Error('check não encontrado')
        // Uma cópia da tabela sem restrição, com as linhas no formato de antes (sem `conta_externa`), e a definição do check do banco posta nela como a migration a põe.
        const validar = async (tabela: string, linhas: ReadonlyArray<readonly [string, string | null, string | null, boolean | null]>): Promise<void> => {
          await cliente.query(`create temp table ${tabela} (like reivindicacao including defaults)`)
          for (const [estado, senhaHash, chave, marca] of linhas) {
            await cliente.query(`insert into ${tabela} (escola_id, ano_letivo_id, turma_id, estado, senha_hash, chave_envio, teve_matricula_errada) values ($1, $1, $1, $2, $3, $4, $5)`, [randomUUID(), estado, senhaHash, chave, marca])
          }
          await cliente.query(`alter table ${tabela} add constraint check_novo ${definicao} not valid`)
          await cliente.query(`alter table ${tabela} validate constraint check_novo`)
        }
        await expect(
          validar('reivindicacao_de_antes', [
            ['pendente', '$argon2id$antigo', randomUUID(), false],
            ['aprovada', null, null, null],
            ['recusada', null, null, null],
            ['encerrada', null, null, null],
          ]),
        ).resolves.toBeUndefined()
        // O controle: a linha que o check novo não aceita (pendente sem senha nem conta) derruba o `validate`.
        await expect(validar('reivindicacao_sem_nada', [['pendente', null, randomUUID(), false]])).rejects.toMatchObject({ code: '23514' })
      } finally {
        cliente.release()
      }
    })

    it('o banco não guarda e-mail, nome nem foto do provedor: as colunas de conta_externa e a conta do pedido são só o identificador opaco, e nada disso vai ao log', async () => {
      const s = await montar()
      const nome = await sala.umNome(s)
      linhasDeLog.length = 0
      await pedirComConta(s, nome)
      const colunas = async (tabela: string) =>
        (await bancada.pool.query<{ column_name: string }>('select column_name from information_schema.columns where table_name = $1 order by ordinal_position', [tabela])).rows.map((linha) => linha.column_name)
      expect(await colunas('conta_externa')).toEqual(['id', 'escola_id', 'usuario_id', 'provedor', 'tenant', 'sujeito', 'ligada_em'])
      const { rows: pendente } = await bancada.pool.query<{ chaves: string[] }>(`select array(select jsonb_object_keys(conta_externa) order by 1) as chaves from reivindicacao where lista_nome_id = $1`, [nome.id])
      expect(pendente[0]?.chaves).toEqual(['provedor', 'sujeito', 'tenant'])

      expect(resultados(await decidir(s.professor, [await pedidoId(nome.id)]))).toEqual(['decidida'])
      const { rows: tudo } = await bancada.pool.query<{ linha: string }>(
        `select to_jsonb(r)::text as linha from reivindicacao r where escola_id = $1 union all select to_jsonb(c)::text from conta_externa c where escola_id = $1 union all select to_jsonb(u)::text from usuario u where escola_id = $1 union all select to_jsonb(a)::text from auditoria a where escola_id = $1`,
        [s.escolaId],
      )
      const guardado = tudo.map((linha) => linha.linha).join('\n')
      for (const dado of DADOS_DA_ALUNA_NO_PROVEDOR) {
        expect(guardado, dado).not.toContain(dado)
        expect(linhasDeLog.join('\n'), dado).not.toContain(dado)
      }
      expect(linhasDeLog.join('\n')).not.toContain(SUJEITO_DA_ALUNA)
    })
  })
})
