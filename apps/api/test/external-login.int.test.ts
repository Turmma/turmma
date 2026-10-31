import { ErrorCode } from '@educa/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { aguardarSaudavel, composeAssincronoOuFalha } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { runInContext, METRICS } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { HashDeSenha, lerConfiguracaoLoginExterno } from '../src/credencial/index.js'
import { ContaExternaRepository, COOKIE_OIDC, CookieOidc } from '../src/sessao/index.js'
import { chamar, renovar, subirApi, type ApiDeTeste } from './test-api.js'
import { BancadaDeSessoes } from './sessao.fixture.js'
import { adulterarPenultimo } from './tampered-text.js'

// Os usuários sintéticos do oidc-falso (infra/oidc-falso/config.json), escolhidos pelo nome digitado no login dele.
const PROFESSORA_A = 'google-professora-a'
const PROFESSORA_A_RECRIADA = 'google-professora-a-recriada'
const PROFESSOR_NAO_VERIFICADO = 'google-professor-nao-verificado'
const PROFESSOR_SEGUNDO_DOMINIO = 'google-professor-segundo-dominio'
const ALUNA_A = 'google-aluna-a'
const PROFESSOR_ESCOLA_B = 'google-professor-escola-b'
const CONTA_PESSOAL_GOOGLE = 'google-conta-pessoal'
/** Conta Google pessoal (sem `hd`) criada com o e-mail institucional da professora, e verificado: o ataque real. */
const PESSOAL_COM_EMAIL_DA_PROFESSORA = 'google-pessoal-com-email-da-professora'
const MS_PROFESSORA_TENANT_A = 'microsoft-professora-tenant-a'
const MS_CONTA_PESSOAL = 'microsoft-conta-pessoal'
const MS_PROFESSOR_TENANT_B = 'microsoft-professor-tenant-b'

const DOMINIO_A = 'escola-a.educa-sintetica.test'
const SEGUNDO_DOMINIO_A = 'segundo-dominio-a.educa-sintetica.test'
const TENANT_A = 'aaaaaaaa-0000-4000-8000-00000000000a'
const EMAIL_PROFESSORA_A = 'professora.a@escola-a.educa-sintetica.test'
const EMAIL_NAO_VERIFICADO = 'professor.nao.verificado@escola-a.educa-sintetica.test'
const EMAIL_SEGUNDO_DOMINIO = 'professor.segundo@segundo-dominio-a.educa-sintetica.test'
const EMAIL_PROFESSOR_B = 'professor.b@escola-b.educa-sintetica.test'
const EMAIL_PROFESSORA_MS = 'professora.ms@escola-a.educa-sintetica.test'
const OID_PROFESSORA_MS = '0a0a0a0a-1111-4111-8111-00000000000a'

/** O que o oidc-falso devolve sobre a aluna e nunca pode chegar ao banco nem ao log (regra 20, itens 2 e 9). */
const DADOS_DA_ALUNA_NO_PROVEDOR = ['aluna.ficticia.a@escola-a.educa-sintetica.test', 'Aluna Ficticia Sintetica', 'Aluna Ficticia', 'fotos.educa-sintetica.test/aluna-ficticia-a.png']

const FALHA_DO_PROVEDOR = 'falha=provedor'
const RECUSA = 'falha=conta_externa_nao_ligada'
/** A eliminação agendada (14.0): a conta do provedor está certa, e a falha é outra que a da conta não ligada. */
const SUSPENSO = 'falha=acesso_suspenso'
/** Senha sintética do aluno do login por matrícula, que tem de continuar entrando com o provedor fora. */
const SENHA_SINTETICA_DO_ALUNO = 'senha-sintetica-do-aluno-13'

interface Redirecionamento {
  status: number
  location: string
  setCookie: string[]
}

interface Inicio extends Redirecionamento {
  /** O `Cookie` que o navegador mandaria de volta no retorno. */
  cookie: string
}

async function redirecionamento(resposta: Response): Promise<Redirecionamento> {
  await resposta.arrayBuffer()
  return { status: resposta.status, location: resposta.headers.get('location') ?? '', setCookie: resposta.headers.getSetCookie() }
}

describe('login pela conta Google ou Microsoft da escola, contra o oidc-falso do compose', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: ApiDeTeste
  let hashDoAluno: string

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog)
    hashDoAluno = await api.app.get(HashDeSenha).gerar(SENHA_SINTETICA_DO_ALUNO)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  /** Escola nova com os domínios e tenants liberados, e o endereço dela. */
  async function escola(liberados: ReadonlyArray<{ provedor: 'google' | 'microsoft'; valor: string }> = [{ provedor: 'google', valor: DOMINIO_A }]): Promise<{ escolaId: string; slug: string }> {
    const escolaId = await bancada.escola()
    for (const { provedor, valor } of liberados) await bancada.pool.query('insert into provedor_escola (escola_id, provedor, valor) values ($1, $2, $3)', [escolaId, provedor, valor])
    return { escolaId, slug: await bancada.slugDe(escolaId) }
  }

  async function iniciar(slug: string, provedor = 'google', url = api.url): Promise<Inicio> {
    const resposta = await redirecionamento(await fetch(`${url}/v1/sessao/externa/${provedor}/iniciar?slug=${encodeURIComponent(slug)}`, { redirect: 'manual' }))
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
    expect(destino.pathname).toBe('/v1/sessao/externa/retorno')
    return destino.search
  }

  async function retorno(consulta: string, cookie: string | undefined, url = api.url): Promise<Redirecionamento> {
    return redirecionamento(await fetch(`${url}/v1/sessao/externa/retorno${consulta}`, { redirect: 'manual', headers: cookie === undefined ? {} : { Cookie: cookie } }))
  }

  async function entrar(slug: string, sujeito: string, provedor = 'google'): Promise<Redirecionamento> {
    const inicio = await iniciar(slug, provedor)
    expect(inicio.status).toBe(302)
    return retorno(await autorizar(inicio, sujeito), inicio.cookie)
  }

  /** A web renova pelo cookie `educa_sessao` que o retorno deixou e lê `/v1/eu`. */
  async function eu(resposta: Redirecionamento): Promise<Record<string, unknown>> {
    const linha = resposta.setCookie.find((valor) => valor.startsWith('educa_sessao='))
    expect(linha, 'o retorno não deixou educa_sessao').toBeDefined()
    const renovada = await renovar(api.url, linha?.split(';')[0])
    expect(renovada.status).toBe(200)
    const lida = await chamar(api.url, 'GET', '/v1/eu', String(renovada.corpo['token']))
    expect(lida.status).toBe(200)
    return lida.corpo
  }

  async function contar(tabela: 'usuario' | 'conta_externa' | 'sessao', escolaId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ n: number }>(`select count(*)::int as n from ${tabela} where escola_id = $1`, [escolaId])
    return rows[0]?.n ?? 0
  }

  async function ligacoesDa(escolaId: string): Promise<Array<{ usuario_id: string; provedor: string; tenant: string | null; sujeito: string }>> {
    const { rows } = await bancada.pool.query<{ usuario_id: string; provedor: string; tenant: string | null; sujeito: string }>(
      'select usuario_id, provedor, tenant, sujeito from conta_externa where escola_id = $1',
      [escolaId],
    )
    return rows
  }

  async function auditoriasDeLigacao(escolaId: string): Promise<Array<{ autor_usuario_id: string; depois: unknown }>> {
    const { rows } = await bancada.pool.query<{ autor_usuario_id: string; depois: unknown }>(
      "select autor_usuario_id, depois from auditoria where escola_id = $1 and acao = 'conta_externa.ligada' order by em, id",
      [escolaId],
    )
    return rows
  }

  async function sessoesDe(usuarioId: string): Promise<Array<{ metodo: string; conta_id: string | null }>> {
    const { rows } = await bancada.pool.query<{ metodo: string; conta_id: string | null }>('select metodo, conta_id from sessao where usuario_id = $1', [usuarioId])
    return rows
  }

  const naEscola = <T>(escolaId: string, funcao: () => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)

  /** Quantos retornos a métrica `login.externo` contou com o resultado, desde o começo do arquivo (contador cumulativo). */
  async function retornosContados(resultado: 'entrou' | 'recusado' | 'provedor'): Promise<number> {
    const pontos = await medidor.pontos(METRICS.loginExterno)
    return pontos.filter((ponto) => ponto.atributos['resultado'] === resultado).reduce((soma, ponto) => soma + (typeof ponto.valor === 'number' ? ponto.valor : 0), 0)
  }

  /** A aluna com matrícula, ligada à conta Google do oidc-falso (a ligação de aluno é do F2: aqui, pelo repository). */
  async function alunaLigada(escolaId: string): Promise<{ usuarioId: string; matricula: string }> {
    const matricula = `RA${randomUUID().slice(0, 8).toUpperCase()}`
    const [usuarioId] = await bancada.alunosComMatricula(escolaId, [{ matricula, senhaHash: hashDoAluno }])
    if (usuarioId === undefined) throw new Error('aluna não criada')
    await naEscola(escolaId, () => new ContaExternaRepository(bancada.banco).ligar(usuarioId, { provedor: 'google', tenant: null, sujeito: 'google-sub-aluna-a' }))
    return { usuarioId, matricula }
  }

  function esperarRecusa(resposta: Redirecionamento, slug: string): void {
    expect(resposta.status).toBe(302)
    expect(resposta.location).toBe(`/e/${slug}?${RECUSA}`)
    expect(resposta.setCookie).toEqual([expect.stringMatching(/^educa_oidc=; Path=\/v1\/sessao\/externa; HttpOnly; SameSite=Lax; Max-Age=0$/)])
  }

  it('caminho feliz (RF9): a professora de A entra a primeira vez e fica ligada, com auditoria; na segunda, entra pela ligação, sem ligar de novo', async () => {
    const { escolaId, slug } = await escola()
    const professora = await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_A)

    const entradasAntes = await retornosContados('entrou')
    const inicio = await iniciar(slug)
    expect(inicio.status).toBe(302)
    expect(new URL(inicio.location).searchParams.get('scope')).toBe('openid email')
    expect(new URL(inicio.location).searchParams.get('code_challenge_method')).toBe('S256')
    const primeira = await retorno(await autorizar(inicio, PROFESSORA_A), inicio.cookie)

    expect(primeira.status).toBe(302)
    expect(primeira.location).toBe('/')
    expect(primeira.setCookie[0]).toMatch(/^educa_oidc=; /)
    expect(primeira.setCookie.some((valor) => valor.startsWith('educa_dispositivo='))).toBe(false)
    expect(await eu(primeira)).toMatchObject({ usuarioId: professora.usuarioId, papel: 'professor', escola: { id: escolaId } })
    expect(await ligacoesDa(escolaId)).toEqual([{ usuario_id: professora.usuarioId, provedor: 'google', tenant: null, sujeito: 'google-sub-professora-a' }])
    expect(await auditoriasDeLigacao(escolaId)).toEqual([{ autor_usuario_id: professora.usuarioId, depois: { usuarioId: professora.usuarioId, provedor: 'google' } }])
    expect(await sessoesDe(professora.usuarioId)).toEqual([{ metodo: 'externo', conta_id: professora.contaId }])
    expect((await retornosContados('entrou')) - entradasAntes).toBe(1)

    const segunda = await entrar(slug, PROFESSORA_A)
    expect(segunda.location).toBe('/')
    expect(await eu(segunda)).toMatchObject({ usuarioId: professora.usuarioId })
    expect(await ligacoesDa(escolaId)).toHaveLength(1)
    expect(await auditoriasDeLigacao(escolaId)).toHaveLength(1)
    const { rows } = await bancada.pool.query<{ n: number }>("select count(*)::int as n from registro_acesso where escola_id = $1 and usuario_id = $2 and evento = 'login'", [escolaId, professora.usuarioId])
    expect(rows[0]?.n).toBe(2)
  })

  it('Microsoft: a professora do tenant liberado é ligada pelo oid e pelo tid (sem email_verified, o tenant conferido vale), com escopo profile', async () => {
    const { escolaId, slug } = await escola([{ provedor: 'microsoft', valor: TENANT_A }])
    const professora = await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_MS)
    const inicio = await iniciar(slug, 'microsoft')
    expect(new URL(inicio.location).searchParams.get('scope')).toBe('openid email profile')
    const resposta = await retorno(await autorizar(inicio, MS_PROFESSORA_TENANT_A), inicio.cookie)
    expect(resposta.location).toBe('/')
    expect(await eu(resposta)).toMatchObject({ usuarioId: professora.usuarioId })
    expect(await ligacoesDa(escolaId)).toEqual([{ usuario_id: professora.usuarioId, provedor: 'microsoft', tenant: TENANT_A, sujeito: OID_PROFESSORA_MS }])
  })

  it('borda (RF8): conta pessoal sem hd, hd de outra escola, tenant de conta pessoal e tenant não cadastrado dão a mesma recusa, e ninguém entra', async () => {
    const { escolaId, slug } = await escola([
      { provedor: 'google', valor: DOMINIO_A },
      { provedor: 'microsoft', valor: TENANT_A },
    ])
    // Cada uma dessas contas, menos a pessoal do Gmail, traz o e-mail verificado de um professor desta escola: só o
    // domínio ou o tenant as barra.
    await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_A)
    await bancada.equipeComEmail(escolaId, EMAIL_PROFESSOR_B)
    await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_MS)
    const usuariosAntes = await contar('usuario', escolaId)
    const recusadosAntes = await retornosContados('recusado')

    const respostas = [
      await entrar(slug, CONTA_PESSOAL_GOOGLE),
      await entrar(slug, PESSOAL_COM_EMAIL_DA_PROFESSORA),
      await entrar(slug, PROFESSOR_ESCOLA_B),
      await entrar(slug, MS_CONTA_PESSOAL, 'microsoft'),
      await entrar(slug, MS_PROFESSOR_TENANT_B, 'microsoft'),
    ]

    for (const resposta of respostas) esperarRecusa(resposta, slug)
    expect(new Set(respostas.map((resposta) => JSON.stringify(resposta))).size).toBe(1)
    expect(await contar('sessao', escolaId)).toBe(0)
    expect(await contar('conta_externa', escolaId)).toBe(0)
    expect(await contar('usuario', escolaId)).toBe(usuariosAntes)
    const { rows } = await bancada.pool.query<{ n: number }>("select count(*)::int as n from registro_acesso where escola_id = $1 and evento = 'login_falho' and usuario_id is null", [escolaId])
    expect(rows[0]?.n).toBe(5)
    // A métrica conta a recusa sem dizer qual foi o motivo.
    expect((await retornosContados('recusado')) - recusadosAntes).toBe(5)
  })

  it('borda: o tenant de conta pessoal da Microsoft, mesmo gravado na lista da escola por fora do contrato, não abre a escola', async () => {
    const { escolaId, slug } = await escola([{ provedor: 'microsoft', valor: '9188040d-6c67-4c5b-b112-36a304b66dad' }])
    await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_MS)
    esperarRecusa(await entrar(slug, MS_CONTA_PESSOAL, 'microsoft'), slug)
    expect(await contar('conta_externa', escolaId)).toBe(0)
    expect(await contar('sessao', escolaId)).toBe(0)
  })

  it('borda (a escola revoga): a conta já ligada deixa de entrar quando a coordenação retira o domínio, no login seguinte', async () => {
    const { escolaId, slug } = await escola()
    const professora = await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_A)
    const aluna = await alunaLigada(escolaId)
    expect((await entrar(slug, PROFESSORA_A)).location).toBe('/')
    expect((await entrar(slug, ALUNA_A)).location).toBe('/')
    const coordenador = await bancada.sessao(escolaId, 'coordenador')

    // Fica outro domínio da escola: o botão continua, e é a conferência do domínio no retorno que barra quem já estava ligado.
    expect((await chamar(api.url, 'PUT', '/v1/escola/provedores', coordenador.token, { provedores: [{ provedor: 'google', valor: SEGUNDO_DOMINIO_A }] })).status).toBe(200)

    esperarRecusa(await entrar(slug, PROFESSORA_A), slug)
    esperarRecusa(await entrar(slug, ALUNA_A), slug)
    expect(await sessoesDe(professora.usuarioId)).toHaveLength(1)
    expect(await sessoesDe(aluna.usuarioId)).toHaveLength(1)
    // As ligações ficam: a escola que liberar o domínio de novo não obriga ninguém a ligar outra vez.
    expect(await contar('conta_externa', escolaId)).toBe(2)
    // Sem nenhum domínio, o botão some: o início responde como escola que não oferece o provedor.
    expect((await chamar(api.url, 'PUT', '/v1/escola/provedores', coordenador.token, { provedores: [] })).status).toBe(200)
    expect((await iniciar(slug)).status).toBe(404)
  })

  it('borda (RF10): a aluna de A com domínio válido e sem ligação é recusada, e nenhuma linha nova aparece em usuario, conta_externa nem sessao', async () => {
    const { escolaId, slug } = await escola()
    await bancada.alunosComMatricula(escolaId, [{ matricula: `RA${randomUUID().slice(0, 8)}`, senhaHash: hashDoAluno }])
    const antes = await Promise.all([contar('usuario', escolaId), contar('conta_externa', escolaId), contar('sessao', escolaId)])

    esperarRecusa(await entrar(slug, ALUNA_A), slug)

    expect(await Promise.all([contar('usuario', escolaId), contar('conta_externa', escolaId), contar('sessao', escolaId)])).toEqual(antes)
  })

  it('borda: professor sem email_verified é recusado; a coordenadora com o e-mail certo também (só o professor é ligado pelo e-mail)', async () => {
    const { escolaId, slug } = await escola()
    await bancada.equipeComEmail(escolaId, EMAIL_NAO_VERIFICADO)
    esperarRecusa(await entrar(slug, PROFESSOR_NAO_VERIFICADO), slug)

    const outra = await escola()
    await bancada.equipeComEmail(outra.escolaId, EMAIL_PROFESSORA_A, 'coordenador')
    esperarRecusa(await entrar(outra.slug, PROFESSORA_A), outra.slug)
    expect(await contar('conta_externa', escolaId)).toBe(0)
    expect(await contar('conta_externa', outra.escolaId)).toBe(0)
  })

  it('borda: o e-mail da professora recriado para outra pessoa (outro sujeito, mesmo e-mail) é recusado depois da primeira ligação', async () => {
    const { escolaId, slug } = await escola()
    const professora = await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_A)
    expect((await entrar(slug, PROFESSORA_A)).location).toBe('/')

    esperarRecusa(await entrar(slug, PROFESSORA_A_RECRIADA), slug)

    expect(await ligacoesDa(escolaId)).toEqual([{ usuario_id: professora.usuarioId, provedor: 'google', tenant: null, sujeito: 'google-sub-professora-a' }])
    expect(await sessoesDe(professora.usuarioId)).toHaveLength(1)
  })

  it('borda: a professora ligada e depois desativada não entra mais pela conta', async () => {
    const { escolaId, slug } = await escola()
    const professora = await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_A)
    expect((await entrar(slug, PROFESSORA_A)).location).toBe('/')
    await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [escolaId, professora.usuarioId])
    esperarRecusa(await entrar(slug, PROFESSORA_A), slug)
    expect(await sessoesDe(professora.usuarioId)).toHaveLength(1)
  })

  /** A eliminação agendada, como o registro a deixa: a coluna do usuário (o pedido e as sessões são da 14.0, em outro teste). */
  const agendarEliminacao = (escolaId: string, usuarioId: string) =>
    bancada.pool.query('update usuario set eliminacao_agendada_em = now() where escola_id = $1 and id = $2', [escolaId, usuarioId])
  const cancelarEliminacao = (escolaId: string, usuarioId: string) =>
    bancada.pool.query('update usuario set eliminacao_agendada_em = null where escola_id = $1 and id = $2', [escolaId, usuarioId])

  function esperarSuspenso(resposta: Redirecionamento, slug: string): void {
    expect(resposta.status).toBe(302)
    expect(resposta.location).toBe(`/e/${slug}?${SUSPENSO}`)
    // O cookie do provedor é apagado e nenhum cookie de sessão sai.
    expect(resposta.setCookie).toEqual([expect.stringMatching(/^educa_oidc=; Path=\/v1\/sessao\/externa; HttpOnly; SameSite=Lax; Max-Age=0$/)])
  }

  it('eliminação agendada: a professora ligada, com a conta do provedor certa, recebe a falha acesso_suspenso e nenhuma sessão nasce; cancelada, entra', async () => {
    const { escolaId, slug } = await escola()
    const professora = await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_A)
    expect((await entrar(slug, PROFESSORA_A)).location).toBe('/')
    const sessoesAntes = (await sessoesDe(professora.usuarioId)).length
    await agendarEliminacao(escolaId, professora.usuarioId)
    const recusadosAntes = await retornosContados('recusado')

    const suspensa = await entrar(slug, PROFESSORA_A)

    esperarSuspenso(suspensa, slug)
    expect(await sessoesDe(professora.usuarioId)).toHaveLength(sessoesAntes)
    expect((await retornosContados('recusado')) - recusadosAntes).toBe(1)
    // A conta que não é dela continua com a falha de sempre: o suspenso não vaza para quem não provou a conta.
    esperarRecusa(await entrar(slug, PESSOAL_COM_EMAIL_DA_PROFESSORA), slug)

    await cancelarEliminacao(escolaId, professora.usuarioId)
    expect((await entrar(slug, PROFESSORA_A)).location).toBe('/')
    expect(await sessoesDe(professora.usuarioId)).toHaveLength(sessoesAntes + 1)
  })

  it('eliminação agendada: a professora ainda sem ligação não é ligada, e o login dela diz acesso_suspenso', async () => {
    const { escolaId, slug } = await escola()
    const professora = await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_A)
    await agendarEliminacao(escolaId, professora.usuarioId)

    esperarSuspenso(await entrar(slug, PROFESSORA_A), slug)

    expect(await ligacoesDa(escolaId)).toEqual([])
    expect(await auditoriasDeLigacao(escolaId)).toEqual([])
    expect(await sessoesDe(professora.usuarioId)).toEqual([])
  })

  it('eliminação agendada: a aluna ligada à conta da escola também recebe acesso_suspenso, e o login dela por matrícula diz o mesmo', async () => {
    const { escolaId, slug } = await escola()
    const aluna = await alunaLigada(escolaId)
    await agendarEliminacao(escolaId, aluna.usuarioId)

    esperarSuspenso(await entrar(slug, ALUNA_A), slug)

    expect(await sessoesDe(aluna.usuarioId)).toEqual([])
    const porMatricula = await fetch(`${api.url}/v1/sessao/matricula`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, matricula: aluna.matricula, senha: SENHA_SINTETICA_DO_ALUNO }),
    })
    expect(porMatricula.status).toBe(403)
    expect(((await porMatricula.json()) as { erro: { codigo: string } }).erro.codigo).toBe(ErrorCode.ACESSO_SUSPENSO)
  })

  it('borda: a escola com dois domínios Google aceita conta de qualquer um deles', async () => {
    const { escolaId, slug } = await escola([
      { provedor: 'google', valor: DOMINIO_A },
      { provedor: 'google', valor: SEGUNDO_DOMINIO_A },
    ])
    const professora = await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_A)
    const professor = await bancada.equipeComEmail(escolaId, EMAIL_SEGUNDO_DOMINIO)
    expect(await eu(await entrar(slug, PROFESSORA_A))).toMatchObject({ usuarioId: professora.usuarioId })
    expect(await eu(await entrar(slug, PROFESSOR_SEGUNDO_DOMINIO))).toMatchObject({ usuarioId: professor.usuarioId })

    // Com só o primeiro domínio, o do segundo é recusado: é a lista da escola que decide.
    const soUm = await escola()
    await bancada.equipeComEmail(soUm.escolaId, EMAIL_SEGUNDO_DOMINIO)
    esperarRecusa(await entrar(soUm.slug, PROFESSOR_SEGUNDO_DOMINIO), soUm.slug)
  })

  it('concorrência: dois retornos em paralelo no primeiro login da mesma professora criam uma ligação só, e os dois entram', async () => {
    const { escolaId, slug } = await escola()
    const professora = await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_A)
    const [primeiro, segundo] = await Promise.all([iniciar(slug), iniciar(slug)])
    if (primeiro === undefined || segundo === undefined) throw new Error('início não feito')
    const [consultaUm, consultaDois] = await Promise.all([autorizar(primeiro, PROFESSORA_A), autorizar(segundo, PROFESSORA_A)])

    const respostas = await Promise.all([retorno(consultaUm, primeiro.cookie), retorno(consultaDois, segundo.cookie)])

    expect(respostas.map((resposta) => resposta.location)).toEqual(['/', '/'])
    expect(await ligacoesDa(escolaId)).toHaveLength(1)
    expect(await auditoriasDeLigacao(escolaId)).toHaveLength(1)
    expect(await sessoesDe(professora.usuarioId)).toHaveLength(2)
  })

  it('concorrência: a professora e a pessoa com o e-mail recriado chegando juntas ligam uma conta só, e só uma entra', async () => {
    const { escolaId, slug } = await escola()
    const professora = await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_A)
    const [primeiro, segundo] = await Promise.all([iniciar(slug), iniciar(slug)])
    if (primeiro === undefined || segundo === undefined) throw new Error('início não feito')
    const [consultaUm, consultaDois] = await Promise.all([autorizar(primeiro, PROFESSORA_A), autorizar(segundo, PROFESSORA_A_RECRIADA)])

    const respostas = await Promise.all([retorno(consultaUm, primeiro.cookie), retorno(consultaDois, segundo.cookie)])

    expect(respostas.map((resposta) => resposta.location).sort()).toEqual(['/', `/e/${slug}?${RECUSA}`])
    expect(await ligacoesDa(escolaId)).toHaveLength(1)
    expect(await sessoesDe(professora.usuarioId)).toHaveLength(1)
  })

  it('privacidade (regra 20, itens 2 e 9): depois do login da aluna ligada, nem o log nem nenhuma tabela têm o e-mail, o nome ou a foto que o provedor mandou', async () => {
    const { escolaId, slug } = await escola()
    const aluna = await alunaLigada(escolaId)
    const inicio = await iniciar(slug)
    const consulta = await autorizar(inicio, ALUNA_A)
    const resposta = await retorno(consulta, inicio.cookie)

    expect(resposta.location).toBe('/')
    expect(await eu(resposta)).toMatchObject({ usuarioId: aluna.usuarioId, papel: 'aluno' })
    expect(await sessoesDe(aluna.usuarioId)).toEqual([{ metodo: 'externo', conta_id: null }])

    const parametros = new URLSearchParams(consulta)
    const procurados = [...DADOS_DA_ALUNA_NO_PROVEDOR, parametros.get('code') ?? 'sem-codigo', parametros.get('state') ?? 'sem-state']
    const log = linhasDeLog.join('\n')
    for (const valor of procurados) expect(log, valor).not.toContain(valor)
    expect(log).not.toMatch(/eyJ[\w-]+\.eyJ/)

    const { rows: tabelas } = await bancada.pool.query<{ nome: string }>(
      "select quote_ident(table_schema) || '.' || quote_ident(table_name) as nome from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema') and table_type = 'BASE TABLE'",
    )
    expect(tabelas.length).toBeGreaterThan(10)
    for (const { nome } of tabelas) {
      for (const valor of DADOS_DA_ALUNA_NO_PROVEDOR) {
        const { rows } = await bancada.pool.query<{ n: number }>(`select count(*)::int as n from ${nome} as linha where linha::text ilike $1`, [`%${valor}%`])
        expect(rows[0]?.n, `${nome}: ${valor}`).toBe(0)
      }
    }
  })

  it('isolamento: o cookie de A com ?slug= de B no retorno entra só em A, mesmo com a professora também em B e B com o domínio de A', async () => {
    const escolaA = await escola()
    const escolaB = await escola()
    const professoraEmA = await bancada.equipeComEmail(escolaA.escolaId, EMAIL_PROFESSORA_A)
    await bancada.equipeComEmail(escolaB.escolaId, EMAIL_PROFESSORA_A)

    const inicio = await iniciar(escolaA.slug)
    const consulta = await autorizar(inicio, PROFESSORA_A)
    const resposta = await retorno(`${consulta}&slug=${escolaB.slug}`, inicio.cookie)

    expect(resposta.location).toBe('/')
    expect(await eu(resposta)).toMatchObject({ usuarioId: professoraEmA.usuarioId, escola: { id: escolaA.escolaId } })
    expect(await contar('conta_externa', escolaB.escolaId)).toBe(0)
    expect(await contar('sessao', escolaB.escolaId)).toBe(0)
  })

  it('isolamento: B cadastrando o hd de A não recebe a aluna ligada em A: recusa, e nada novo em B', async () => {
    const escolaA = await escola()
    const escolaB = await escola()
    await alunaLigada(escolaA.escolaId)
    const antes = await Promise.all([contar('usuario', escolaB.escolaId), contar('conta_externa', escolaB.escolaId), contar('sessao', escolaB.escolaId)])

    esperarRecusa(await entrar(escolaB.slug, ALUNA_A), escolaB.slug)

    expect(await Promise.all([contar('usuario', escolaB.escolaId), contar('conta_externa', escolaB.escolaId), contar('sessao', escolaB.escolaId)])).toEqual(antes)
    // Em A, a mesma conta entra.
    expect((await entrar(escolaA.slug, ALUNA_A)).location).toBe('/')
  })

  it('cookie: sem ele, alterado, de outra chave, vencido ou de outro início, o retorno é falha do provedor e ninguém entra', async () => {
    const { escolaId, slug } = await escola()
    const professora = await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_A)
    const [bom, outro] = await Promise.all([iniciar(slug), iniciar(slug)])
    if (bom === undefined || outro === undefined) throw new Error('início não feito')
    const consulta = await autorizar(bom, PROFESSORA_A)
    const valor = bom.cookie.slice(`${COOKIE_OIDC}=`.length)
    const alterado = adulterarPenultimo(valor)
    expect(alterado).not.toBe(valor)
    const { chaveDoCookie } = lerConfiguracaoLoginExterno(lerAmbienteDeTeste())
    if (chaveDoCookie === undefined) throw new Error('ambiente de teste sem chave do cookie')
    const emAndamento = { escolaId, slug, provedor: 'google' as const, state: new URL(bom.location).searchParams.get('state') ?? '', nonce: 'nonce-sintetico-0123456789', verificador: 'verificador-sintetico-0123456789' }
    const vencido = new CookieOidc(chaveDoCookie, 'local', () => Date.now() - 301_000).gravar(emAndamento).split(';')[0]
    const deOutraChave = new CookieOidc(new Uint8Array(32).fill(7), 'local').gravar(emAndamento).split(';')[0]

    const semCookie = await retorno(consulta, undefined)
    expect(semCookie.location).toBe(`/?${FALHA_DO_PROVEDOR}`)
    for (const cookie of [`${COOKIE_OIDC}=${alterado}`, vencido, deOutraChave]) {
      expect((await retorno(consulta, cookie)).location, cookie).toBe(`/?${FALHA_DO_PROVEDOR}`)
    }
    // O cookie de outro início, válido, não confere o state do código: falha do provedor, na escola do cookie.
    expect((await retorno(consulta, outro.cookie)).location).toBe(`/e/${slug}?${FALHA_DO_PROVEDOR}`)
    expect(await sessoesDe(professora.usuarioId)).toEqual([])
    expect(await contar('conta_externa', escolaId)).toBe(0)
  })

  it('iniciar: provedor desconhecido, escola inexistente e escola que não liberou o provedor respondem 404, sem cookie', async () => {
    const soGoogle = await escola()
    for (const caminho of [`/v1/sessao/externa/github/iniciar?slug=${soGoogle.slug}`, '/v1/sessao/externa/google/iniciar?slug=escola-que-nao-existe', '/v1/sessao/externa/google/iniciar', `/v1/sessao/externa/microsoft/iniciar?slug=${soGoogle.slug}`]) {
      const resposta = await fetch(`${api.url}${caminho}`, { redirect: 'manual' })
      const corpo = (await resposta.json()) as { erro?: { codigo?: string } }
      expect(resposta.status, caminho).toBe(404)
      expect(corpo.erro?.codigo, caminho).toBe(ErrorCode.NAO_ENCONTRADO)
      expect(resposta.headers.getSetCookie(), caminho).toEqual([])
    }
  })

  it('iniciar: o provedor e o slug fora do formato respondem o mesmo 404, também o byte nulo que o Postgres recusaria e o slug repetido na consulta', async () => {
    const { slug } = await escola()
    // O byte nulo prova o `ZodValidationPipe` do parâmetro: se ele chegasse à consulta, o Postgres o recusaria (22021, 500).
    for (const caminho of [
      `/v1/sessao/externa/github%00/iniciar?slug=${slug}`,
      '/v1/sessao/externa/google/iniciar?slug=escola%00x',
      '/v1/sessao/externa/google/iniciar?slug=Escola-Maiuscula',
      `/v1/sessao/externa/google/iniciar?slug=${slug}&slug=${slug}`,
      '/v1/sessao/externa/google/iniciar?slug=',
    ]) {
      const resposta = await fetch(`${api.url}${caminho}`, { redirect: 'manual' })
      const corpo = (await resposta.json()) as { erro?: { codigo?: string } }
      expect(resposta.status, caminho).toBe(404)
      expect(corpo.erro?.codigo, caminho).toBe(ErrorCode.NAO_ENCONTRADO)
      expect(resposta.headers.getSetCookie(), caminho).toEqual([])
    }
  })

  it('iniciar: o slug com espaços em volta é cortado, como o navegador o digitou: a escola que libera o provedor inicia', async () => {
    const { slug } = await escola()
    const inicio = await iniciar(`  ${slug}\t`)
    expect(inicio.status).toBe(302)
    expect(inicio.cookie).toMatch(new RegExp(`^${COOKIE_OIDC}=`))
  })

  it('falha: error=access_denied no retorno (a escola não liberou o app) vira ?falha=provedor na tela da escola, o cookie é apagado, e a matrícula segue entrando', async () => {
    const { escolaId, slug } = await escola()
    const aluna = await alunaLigada(escolaId)
    const falhasAntes = await retornosContados('provedor')
    const inicio = await iniciar(slug)
    const state = new URL(inicio.location).searchParams.get('state') ?? ''
    const resposta = await retorno(`?error=access_denied&state=${state}`, inicio.cookie)
    expect(resposta.status).toBe(302)
    expect(resposta.location).toBe(`/e/${slug}?${FALHA_DO_PROVEDOR}`)
    expect(resposta.setCookie).toEqual([expect.stringMatching(/^educa_oidc=; .*Max-Age=0/)])
    expect(await sessoesDe(aluna.usuarioId)).toEqual([])
    expect((await retornosContados('provedor')) - falhasAntes).toBe(1)

    const matricula = await fetch(`${api.url}/v1/sessao/matricula`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, matricula: aluna.matricula, senha: SENHA_SINTETICA_DO_ALUNO }),
    })
    expect(matricula.status).toBe(200)
  })

  it('configuração: o provedor desligado no ambiente não aparece na tela da escola nem inicia, mesmo liberado por ela', async () => {
    const { slug } = await escola([
      { provedor: 'google', valor: DOMINIO_A },
      { provedor: 'microsoft', valor: TENANT_A },
    ])
    const soGoogle = await subirApi(medidor.medidor, { ambiente: { LOGIN_EXTERNO_MICROSOFT_EMISSOR: '', LOGIN_EXTERNO_MICROSOFT_CLIENTE: '', LOGIN_EXTERNO_MICROSOFT_SEGREDO: '' } })
    try {
      const acesso = (await (await fetch(`${soGoogle.url}/v1/escolas/${slug}/acesso`)).json()) as { provedores: unknown }
      expect(acesso.provedores).toEqual(['google'])
      expect((await iniciar(slug, 'microsoft', soGoogle.url)).status).toBe(404)
      expect((await iniciar(slug, 'google', soGoogle.url)).status).toBe(302)
      const completo = (await (await fetch(`${api.url}/v1/escolas/${slug}/acesso`)).json()) as { provedores: unknown }
      expect(completo.provedores).toEqual(['google', 'microsoft'])
    } finally {
      await soGoogle.app.close()
    }
  })

  it('falha: oidc-falso parado no meio do retorno esgota os 5 s e vira ?falha=provedor; o login por matrícula da mesma escola continua respondendo', async () => {
    const { escolaId, slug } = await escola()
    await bancada.equipeComEmail(escolaId, EMAIL_PROFESSORA_A)
    const aluna = await alunaLigada(escolaId)
    const inicio = await iniciar(slug)
    const consulta = await autorizar(inicio, PROFESSORA_A)

    await composeAssincronoOuFalha('pause', 'oidc-falso')
    try {
      const comeco = performance.now()
      const pendente = retorno(consulta, inicio.cookie)
      const matricula = await fetch(`${api.url}/v1/sessao/matricula`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, matricula: aluna.matricula, senha: SENHA_SINTETICA_DO_ALUNO }),
      })
      const tempoDaMatricula = performance.now() - comeco
      expect(matricula.status).toBe(200)
      expect(tempoDaMatricula).toBeLessThan(3_000)
      const resposta = await pendente
      const duracao = performance.now() - comeco
      expect(resposta.location).toBe(`/e/${slug}?${FALHA_DO_PROVEDOR}`)
      expect(duracao).toBeGreaterThanOrEqual(4_900)
      expect(duracao).toBeLessThan(8_000)
    } finally {
      await composeAssincronoOuFalha('unpause', 'oidc-falso')
      await aguardarSaudavel('oidc-falso')
    }
  })

  it('falha: discovery que falhou uma vez não fica em cache; com o oidc-falso de volta, a chamada seguinte funciona', async () => {
    const { slug } = await escola()
    // API nova: o discovery ainda não foi feito, e é a primeira busca que encontra o provedor parado.
    const nova = await subirApi(medidor.medidor)
    try {
      await composeAssincronoOuFalha('pause', 'oidc-falso')
      let parado: Inicio
      try {
        const comeco = performance.now()
        parado = await iniciar(slug, 'google', nova.url)
        expect(performance.now() - comeco).toBeLessThan(8_000)
      } finally {
        await composeAssincronoOuFalha('unpause', 'oidc-falso')
        await aguardarSaudavel('oidc-falso')
      }
      expect(parado.status).toBe(302)
      expect(parado.location).toBe(`/e/${slug}?${FALHA_DO_PROVEDOR}`)
      expect(parado.setCookie).toEqual([])

      const devolta = await iniciar(slug, 'google', nova.url)
      expect(devolta.status).toBe(302)
      expect(new URL(devolta.location).pathname).toBe('/google/authorize')
      expect(devolta.cookie).toMatch(/^educa_oidc=.+/)
    } finally {
      await nova.app.close()
    }
  })
})
