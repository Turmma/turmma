import { METRICS, runInContext } from '@educa/core'
import { ErrorCode, MENSAGENS_DE_ERRO, TENANT_DE_CONTA_PESSOAL_MICROSOFT, decisaoResponseSchema, type ResultadoDaDecisao } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { loadExternalLoginConfig } from '../src/credencial/index.js'
import { CAMINHO_DO_COOKIE_OIDC, COOKIE_CONTA_PROVADA, COOKIE_OIDC, ContaExternalRepository, CookieOidc } from '../src/sessao/index.js'
import { FerramentasDaSala, pedidoDaSala, type NomeDaLista, type TestSala } from './sala.fixture.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, cookieDeRenovacao, renovar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'

/**
 * Ligar a conta da escola em "Eu" (acesso-e-convites, tarefa 15.0; `tasks/prd-acesso-e-convites/cenarios.md`, "Conta da escola do aluno", "Senha provisória" e
 * "Corridas"): o aluno com sessão vai ao `externa/iniciar?intencao=ligar`, o `educa_sessao` diz quem é, o cookie `educa_oidc` o leva ao retorno, e o retorno liga a conta na trava
 * da linha do usuário. Contra o `oidc-falso`, o Postgres e o Redis do compose de teste. A aluna do `oidc-falso` é uma só (`google-aluna-a`): cada caso monta a sua escola.
 */

const AMBIENTE = { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' }
const ALUNA_A = 'google-aluna-a'
const SUJEITO_DA_ALUNA = 'google-sub-aluna-a'
const PROFESSOR_ESCOLA_B = 'google-professor-escola-b'
const CONTA_PESSOAL_GOOGLE = 'google-conta-pessoal'
const DOMINIO_A = 'escola-a.educa-sintetica.test'
const TENANT_A = 'aaaaaaaa-0000-4000-8000-00000000000a'
const CONTA_PESSOAL_MICROSOFT = 'microsoft-conta-pessoal'
/** O que o `oidc-falso` devolve sobre a aluna e nunca pode chegar ao banco, ao log nem à resposta (regra 20, itens 2 e 9). */
const DADOS_DA_ALUNA_NO_PROVEDOR = ['aluna.ficticia.a@escola-a.educa-sintetica.test', 'Aluna Ficticia Sintetica', 'Aluna Ficticia', 'fotos.educa-sintetica.test/aluna-ficticia-a.png']
const SENHA_ANTIGA_HASH = '$argon2id$v=19$m=8192,t=1,p=1$c2FsdC1zaW50ZXRpY28$ZGlnZXN0by1zaW50ZXRpY28tZG8tdGVzdGU'

const LIGADA = '/aluno/eu?ligacao=ligada'
const CONFLITO = '/aluno/eu?ligacao=conflito'
const RECUSADA = '/aluno/eu?ligacao=recusada'
const PROVEDOR = '/aluno/eu?ligacao=provedor'

interface Redirect {
  status: number
  location: string
  setCookie: string[]
}

interface Inicio extends Redirect {
  /** O `Cookie` que o navegador mandaria de volta no retorno. */
  cookie: string
}

/** O que o navegador do aluno já tem, antes do retorno: a consulta que o provedor devolveu e o cookie do login em andamento. */
interface Preparada {
  consulta: string
  cookie: string
}

async function redirecionamento(resposta: Response): Promise<Redirect> {
  await resposta.arrayBuffer()
  return { status: resposta.status, location: resposta.headers.get('location') ?? '', setCookie: resposta.headers.getSetCookie() }
}

describe('ligar a conta da escola em "Eu" (15.0): o aluno com sessão liga a conta, uma conta por aluno, na trava da linha do usuário', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: TestApi
  let sala: FerramentasDaSala

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: AMBIENTE }, linhasDeLog)
    sala = new FerramentasDaSala(api, bancada)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const naEscola = <T>(escolaId: string, funcao: () => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)

  /** Escola nova, sem ano letivo, com o domínio da escola A liberado para o Google (mais os liberados que o caso pedir). */
  async function escola(dominios: readonly string[] = [DOMINIO_A]): Promise<{ escolaId: string; slug: string }> {
    const escolaId = await bancada.escola()
    for (const valor of dominios) await bancada.pool.query('insert into provedor_escola (escola_id, provedor, valor) values ($1, $2, $3)', [escolaId, 'google', valor])
    return { escolaId, slug: await bancada.slugDe(escolaId) }
  }

  interface AlunoComSessao {
    readonly sessao: TestSessao
    /** O `Cookie` de renovação que o navegador do aluno manda ao `iniciar`. */
    readonly cookie: string
  }

  /** Um aluno ativo, com a sessão aberta e o cookie de renovação que o teste conhece. */
  async function alunoComSessao(escolaId: string, papel: 'aluno' | 'professor' | 'coordenador' = 'aluno'): Promise<AlunoComSessao> {
    const sessao = await bancada.sessao(escolaId, papel)
    return { sessao, cookie: await cookieDeRenovacao(bancada, sessao) }
  }

  async function iniciar(slug: string, cookieDaSessao: string | undefined, consulta: Record<string, string> = {}, provedor = 'google', base = api.url): Promise<Inicio> {
    const parametros = new URLSearchParams({ slug, intencao: 'ligar', ...consulta })
    const resposta = await redirecionamento(
      await fetch(`${base}${CAMINHO_DO_COOKIE_OIDC}/${provedor}/iniciar?${parametros.toString()}`, { redirect: 'manual', headers: cookieDaSessao === undefined ? {} : { Cookie: cookieDaSessao } }),
    )
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

  async function retorno(consulta: string, cookie: string | undefined): Promise<Redirect> {
    return redirecionamento(await fetch(`${api.url}${CAMINHO_DO_COOKIE_OIDC}/retorno${consulta}`, { redirect: 'manual', headers: cookie === undefined ? {} : { Cookie: cookie } }))
  }

  /** Tudo até o retorno: o aluno vai ao provedor e volta com o código, mas o retorno ainda não chegou ao servidor. */
  async function preparar(slug: string, cookieDaSessao: string, sujeito = ALUNA_A): Promise<Preparada> {
    const inicio = await iniciar(slug, cookieDaSessao)
    expect(inicio.status, inicio.location).toBe(302)
    expect(inicio.cookie).not.toBe('')
    return { consulta: await autorizar(inicio, sujeito), cookie: inicio.cookie }
  }

  const concluir = ({ consulta, cookie }: Preparada) => retorno(consulta, cookie)

  /** O caminho inteiro de quem liga a conta em "Eu". */
  async function ligar(slug: string, cookieDaSessao: string, sujeito = ALUNA_A): Promise<Redirect> {
    return concluir(await preparar(slug, cookieDaSessao, sujeito))
  }

  /** O login pela conta da escola, sem `intencao`: o de sempre. */
  async function entrarPelaConta(slug: string, sujeito = ALUNA_A): Promise<Redirect> {
    const resposta = await redirecionamento(await fetch(`${api.url}${CAMINHO_DO_COOKIE_OIDC}/google/iniciar?slug=${encodeURIComponent(slug)}`, { redirect: 'manual' }))
    const inicio = { ...resposta, cookie: resposta.setCookie.find((valor) => valor.startsWith(`${COOKIE_OIDC}=`))?.split(';')[0] ?? '' }
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

  interface LigacaoNoBanco {
    usuario_id: string
    provedor: string
    tenant: string | null
    sujeito: string
  }

  async function ligacoesDa(escolaId: string): Promise<LigacaoNoBanco[]> {
    const { rows } = await bancada.pool.query<LigacaoNoBanco>('select usuario_id, provedor, tenant, sujeito from conta_externa where escola_id = $1 order by ligada_em', [escolaId])
    return rows
  }

  async function auditoriaDaLigacao(escolaId: string): Promise<Array<{ autor_usuario_id: string; entidade: string; antes: unknown; depois: Record<string, unknown>; linha: string }>> {
    const { rows } = await bancada.pool.query<{ autor_usuario_id: string; entidade: string; antes: unknown; depois: Record<string, unknown>; linha: string }>(
      "select autor_usuario_id, entidade, antes, depois, row_to_json(a)::text as linha from auditoria a where escola_id = $1 and acao = 'conta_externa.ligada' order by em",
      [escolaId],
    )
    return rows
  }

  async function contar(tabela: 'usuario' | 'conta_externa' | 'sessao' | 'ano_letivo', escolaId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ n: number }>(`select count(*)::int as n from ${tabela} where escola_id = $1`, [escolaId])
    return rows[0]?.n ?? 0
  }

  async function falhasDeLogin(escolaId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ n: number }>("select count(*)::int as n from registro_acesso where escola_id = $1 and evento = 'login_falho'", [escolaId])
    return rows[0]?.n ?? 0
  }

  async function sessoesDe(usuarioId: string): Promise<Array<{ metodo: string; encerrada: boolean }>> {
    const { rows } = await bancada.pool.query<{ metodo: string; encerrada: boolean }>('select metodo, encerrada_em is not null as encerrada from sessao where usuario_id = $1', [usuarioId])
    return rows
  }

  async function retornosComResultado(resultado: string): Promise<number> {
    const pontos = await medidor.pontos(METRICS.loginExterno)
    return pontos.filter((ponto) => ponto.atributos['resultado'] === resultado).reduce((soma, ponto) => soma + (typeof ponto.valor === 'number' ? ponto.valor : 0), 0)
  }

  /** O aluno com credencial por matrícula (a senha antiga) na escola: o que a geração da provisória exige. */
  async function comCredencial(escolaId: string, usuarioId: string): Promise<void> {
    await bancada.pool.query('insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, $4)', [escolaId, usuarioId, `lig-${randomUUID().slice(0, 18)}`, SENHA_ANTIGA_HASH])
  }

  /** A conta da aluna do `oidc-falso`, ligada a `alunoId` direto no banco: o "outro aluno" que já tem a conta. */
  async function ligarPorFora(escolaId: string, alunoId: string, sujeito = SUJEITO_DA_ALUNA): Promise<void> {
    await naEscola(escolaId, () => new ContaExternalRepository(bancada.banco).ligar(alunoId, { provedor: 'google', tenant: null, sujeito }))
  }

  describe('o caminho feliz', () => {
    it('o aluno que entrou por matrícula liga a conta, e passa a entrar por ela: um registro `conta_externa.ligada` do aluno, sem sessão nova, sem falha de login e sem dado do provedor, numa escola sem ano em curso', async () => {
      const { escolaId, slug } = await escola()
      const aluno = await alunoComSessao(escolaId)
      await comCredencial(escolaId, aluno.sessao.usuarioId)
      expect(await contar('ano_letivo', escolaId)).toBe(0)
      const ligadasAntes = await retornosComResultado('ligacao_ligada')

      const inicio = await iniciar(slug, aluno.cookie)
      expect(inicio.status).toBe(302)
      const resposta = await retorno(await autorizar(inicio, ALUNA_A), inicio.cookie)

      // Volta a "Eu", sem sessão nova (quem liga já está entrado) e só apagando o cookie do login em andamento.
      expect(resposta.status).toBe(302)
      expect(resposta.location).toBe(LIGADA)
      expect(resposta.setCookie).toHaveLength(1)
      expect(resposta.setCookie[0]).toMatch(new RegExp(`^${COOKIE_OIDC}=; .*Max-Age=0`))
      expect(await sessoesDe(aluno.sessao.usuarioId)).toEqual([{ metodo: expect.any(String), encerrada: false }])
      expect(await falhasDeLogin(escolaId)).toBe(0)
      expect(await retornosComResultado('ligacao_ligada')).toBe(ligadasAntes + 1)

      expect(await ligacoesDa(escolaId)).toEqual([{ usuario_id: aluno.sessao.usuarioId, provedor: 'google', tenant: null, sujeito: SUJEITO_DA_ALUNA }])
      const registros = await auditoriaDaLigacao(escolaId)
      expect(registros).toHaveLength(1)
      expect(registros[0]).toMatchObject({ autor_usuario_id: aluno.sessao.usuarioId, entidade: 'conta_externa', antes: null, depois: { usuarioId: aluno.sessao.usuarioId, provedor: 'google' } })

      // Passa a entrar pela conta: o login de sempre abre a sessão `externo` do mesmo aluno.
      const entrada = await entrarPelaConta(slug)
      expect(entrada.location).toBe('/')
      expect(await eu(entrada)).toMatchObject({ usuarioId: aluno.sessao.usuarioId, papel: 'aluno' })

      const log = linhasDeLog.join('\n')
      for (const valor of DADOS_DA_ALUNA_NO_PROVEDOR) {
        expect(log, valor).not.toContain(valor)
        for (const tabela of ['conta_externa', 'auditoria', 'registro_acesso']) {
          const { rows } = await bancada.pool.query<{ n: number }>(`select count(*)::int as n from ${tabela} as linha where linha::text ilike $1`, [`%${valor}%`])
          expect(rows[0]?.n, `${tabela}: ${valor}`).toBe(0)
        }
      }
    })

    it('ligar a mesma conta duas vezes seguidas: as duas voltam `ligada`, e fica uma ligação e um registro só', async () => {
      const { escolaId, slug } = await escola()
      const aluno = await alunoComSessao(escolaId)

      expect((await ligar(slug, aluno.cookie)).location).toBe(LIGADA)
      expect((await ligar(slug, aluno.cookie)).location).toBe(LIGADA)

      expect(await ligacoesDa(escolaId)).toHaveLength(1)
      expect(await auditoriaDaLigacao(escolaId)).toHaveLength(1)
    })
  })

  describe('uma conta por aluno, e a conta de um aluno não vira a de outro', () => {
    it('o aluno que já tem uma conta ligada tenta ligar outra: `conflito`, e a primeira fica', async () => {
      const { escolaId, slug } = await escola([DOMINIO_A, 'escola-b.educa-sintetica.test'])
      const aluno = await alunoComSessao(escolaId)
      await ligarPorFora(escolaId, aluno.sessao.usuarioId, 'google-sub-professor-escola-b')

      const resposta = await ligar(slug, aluno.cookie, ALUNA_A)

      expect(resposta.location).toBe(CONFLITO)
      expect(await ligacoesDa(escolaId)).toEqual([{ usuario_id: aluno.sessao.usuarioId, provedor: 'google', tenant: null, sujeito: 'google-sub-professor-escola-b' }])
      expect(await auditoriaDaLigacao(escolaId)).toEqual([])
    })

    it('a conta ligada a outro aluno: `conflito` sem nome nem id, nada ligado ao segundo, e o primeiro segue entrando por ela', async () => {
      const { escolaId, slug } = await escola()
      const dono = await alunoComSessao(escolaId)
      const outro = await alunoComSessao(escolaId)
      await ligarPorFora(escolaId, dono.sessao.usuarioId)

      const resposta = await ligar(slug, outro.cookie)

      expect(resposta.status).toBe(302)
      expect(resposta.location).toBe(CONFLITO)
      expect(resposta.location).not.toContain(dono.sessao.usuarioId)
      expect(JSON.stringify(resposta)).not.toContain(dono.sessao.usuarioId)
      expect(await ligacoesDa(escolaId)).toEqual([{ usuario_id: dono.sessao.usuarioId, provedor: 'google', tenant: null, sujeito: SUJEITO_DA_ALUNA }])
      expect(await auditoriaDaLigacao(escolaId)).toEqual([])
      expect(await eu(await entrarPelaConta(slug))).toMatchObject({ usuarioId: dono.sessao.usuarioId })
    })

    it('isolamento: a mesma conta do provedor liga em duas escolas, cada uma ao seu aluno, e a ligação de uma não é conflito na outra', async () => {
      const [a, b] = [await escola(), await escola()]
      const [alunoA, alunoB] = [await alunoComSessao(a.escolaId), await alunoComSessao(b.escolaId)]

      expect((await ligar(a.slug, alunoA.cookie)).location).toBe(LIGADA)
      expect((await ligar(b.slug, alunoB.cookie)).location).toBe(LIGADA)

      expect(await ligacoesDa(a.escolaId)).toEqual([expect.objectContaining({ usuario_id: alunoA.sessao.usuarioId })])
      expect(await ligacoesDa(b.escolaId)).toEqual([expect.objectContaining({ usuario_id: alunoB.sessao.usuarioId })])
    })
  })

  describe('quem pode ligar: só o aluno com a sessão aberta, na escola do endereço', () => {
    it.each([['professor'], ['coordenador']] as const)('sessão de %s: o `iniciar` responde como o inexistente, sem cookie e sem ir ao provedor, e nada é ligado', async (papel) => {
      const { escolaId, slug } = await escola()
      const equipe = await alunoComSessao(escolaId, papel)

      const resposta = await iniciar(slug, equipe.cookie)

      expect(resposta.status).toBe(404)
      expect(resposta.location).toBe('')
      expect(resposta.setCookie).toEqual([])
      expect(await ligacoesDa(escolaId)).toEqual([])
    })

    it('sem o cookie de renovação, com um cookie inventado, com o de uma sessão encerrada e com o de aluno de outra escola: 404 igual, sem cookie', async () => {
      const [a, b] = [await escola(), await escola()]
      const encerrada = await alunoComSessao(a.escolaId)
      await bancada.encerrar(encerrada.sessao.sessaoId)
      const deOutraEscola = await alunoComSessao(b.escolaId)

      for (const cookie of [undefined, 'educa_sessao=cookie-que-nao-existe', encerrada.cookie, deOutraEscola.cookie]) {
        const resposta = await iniciar(a.slug, cookie)
        expect(resposta.status, String(cookie)).toBe(404)
        expect(resposta.setCookie, String(cookie)).toEqual([])
      }
      expect(await ligacoesDa(a.escolaId)).toEqual([])
      expect(await ligacoesDa(b.escolaId)).toEqual([])
    })

    it('a escola que não existe, o provedor desconhecido e o provedor que a configuração desligou, mesmo liberado pela escola: 404 igual, sem cookie, com a sessão de aluno certa', async () => {
      const { escolaId, slug } = await escola()
      await bancada.pool.query('insert into provedor_escola (escola_id, provedor, valor) values ($1, $2, $3)', [escolaId, 'microsoft', TENANT_A])
      const aluno = await alunoComSessao(escolaId)
      const soGoogle = await subirApi(medidor.medidor, { ambiente: { LOGIN_EXTERNO_MICROSOFT_EMISSOR: '', LOGIN_EXTERNO_MICROSOFT_CLIENTE: '', LOGIN_EXTERNO_MICROSOFT_SEGREDO: '' } })
      try {
        const respostas = [
          await iniciar('escola-que-nao-existe', aluno.cookie),
          await iniciar(slug, aluno.cookie, {}, 'github'),
          await iniciar(slug, aluno.cookie, {}, 'microsoft', soGoogle.url),
        ]
        for (const resposta of respostas) {
          expect(resposta.status, resposta.location).toBe(404)
          expect(resposta.setCookie).toEqual([])
        }
        // O mesmo aluno, no mesmo endereço, com o provedor ligado: segue ao provedor.
        expect((await iniciar(slug, aluno.cookie, {}, 'google', soGoogle.url)).status).toBe(302)
      } finally {
        await soGoogle.app.close()
      }
      expect(await ligacoesDa(escolaId)).toEqual([])
    })

    it('o refresh anterior (de uma rotação) já não identifica o aluno', async () => {
      const { escolaId, slug } = await escola()
      const aluno = await alunoComSessao(escolaId)
      const renovada = await renovar(api.url, aluno.cookie)
      expect(renovada.status).toBe(200)

      expect((await iniciar(slug, aluno.cookie)).status).toBe(404)
    })

    it('um cookie inventado numa escola que tem uma sessão de aluno aberta: 404, sem cookie (só o refresh da sessão identifica quem liga, e nenhuma outra sessão aberta da escola vale)', async () => {
      const { escolaId, slug } = await escola()
      const aluno = await alunoComSessao(escolaId)

      const inventado = await iniciar(slug, 'educa_sessao=cookie-que-nao-existe')

      expect(inventado.status).toBe(404)
      expect(inventado.setCookie).toEqual([])
      // A sessão aberta da escola existe e é do aluno certo: com o cookie dela, segue ao provedor.
      expect((await iniciar(slug, aluno.cookie)).status).toBe(302)
    })

    it('`intencao=ligar` com `token` ou `codigo` (que são do pedido do nome): 404 como o inexistente, sem cookie e sem ir ao provedor, mesmo com a sessão de aluno certa', async () => {
      const { escolaId, slug } = await escola()
      const aluno = await alunoComSessao(escolaId)

      for (const consulta of [{ token: 'um-token-qualquer' }, { codigo: 'ABCD1234' }, { token: 'um-token-qualquer', codigo: 'ABCD1234' }]) {
        const resposta = await iniciar(slug, aluno.cookie, consulta)
        expect(resposta.status, JSON.stringify(consulta)).toBe(404)
        expect(resposta.location).toBe('')
        expect(resposta.setCookie).toEqual([])
      }
      expect(await ligacoesDa(escolaId)).toEqual([])
    })

    it('o aluno com duas sessões, e a do `iniciar` encerrada enquanto a outra segue aberta (a do celular, em casa): `recusada`, nada ligado (a sessão que vale é a que o `iniciar` achou)', async () => {
      const { escolaId, slug } = await escola()
      const aluno = await alunoComSessao(escolaId)
      await bancada.outraSessaoDoUsuario(escolaId, aluno.sessao.usuarioId)
      const preparada = await preparar(slug, aluno.cookie)
      await bancada.encerrar(aluno.sessao.sessaoId)

      expect((await concluir(preparada)).location).toBe(RECUSADA)

      expect(await ligacoesDa(escolaId)).toEqual([])
      expect((await sessoesDe(aluno.sessao.usuarioId)).filter((linha) => !linha.encerrada)).toHaveLength(1)
    })

    it.each([
      ['conta pessoal, sem domínio', CONTA_PESSOAL_GOOGLE],
      ['domínio que a escola não liberou', PROFESSOR_ESCOLA_B],
    ] as const)('%s: `recusada`, nada ligado', async (_nome, sujeito) => {
      const { escolaId, slug } = await escola()
      const aluno = await alunoComSessao(escolaId)

      const resposta = await ligar(slug, aluno.cookie, sujeito)

      expect(resposta.location).toBe(RECUSADA)
      expect(await ligacoesDa(escolaId)).toEqual([])
      expect(await falhasDeLogin(escolaId)).toBe(0)
    })

    it('a conta pessoal da Microsoft, mesmo com o tenant dela liberado pela escola: `recusada`, nada ligado', async () => {
      const { escolaId, slug } = await escola([])
      await bancada.pool.query('insert into provedor_escola (escola_id, provedor, valor) values ($1, $2, $3)', [escolaId, 'microsoft', TENANT_DE_CONTA_PESSOAL_MICROSOFT])
      const aluno = await alunoComSessao(escolaId)
      const inicio = await iniciar(slug, aluno.cookie, {}, 'microsoft')
      expect(inicio.status, inicio.location).toBe(302)

      const resposta = await retorno(await autorizar(inicio, CONTA_PESSOAL_MICROSOFT), inicio.cookie)

      expect(resposta.location).toBe(RECUSADA)
      expect(await ligacoesDa(escolaId)).toEqual([])
    })

    it('a sessão que acabou entre o `iniciar` e o retorno (saída, outra aba, vencida): `recusada`, nada ligado', async () => {
      const { escolaId, slug } = await escola()
      const aluno = await alunoComSessao(escolaId)
      const preparada = await preparar(slug, aluno.cookie)
      await bancada.encerrar(aluno.sessao.sessaoId)

      expect((await concluir(preparada)).location).toBe(RECUSADA)

      expect(await ligacoesDa(escolaId)).toEqual([])
    })

    it('o cookie do login em andamento com o aluno de uma escola e a escola de outra, ou com o aluno de uma sessão e a sessão de outro aluno: `recusada`, nada ligado em nenhuma', async () => {
      // As duas escolas liberam o domínio da aluna: a recusa de cada passo só pode ser a da sessão, nunca a do domínio.
      const [a, b] = [await escola([DOMINIO_A]), await escola([DOMINIO_A])]
      const [alunoA, outroDaA, alunoB] = [await alunoComSessao(a.escolaId), await alunoComSessao(a.escolaId), await alunoComSessao(b.escolaId)]
      const { chaveDoCookie } = loadExternalLoginConfig(lerAmbienteDeTeste())
      if (chaveDoCookie === undefined) throw new Error('ambiente de teste sem chave do cookie')
      const cookies = new CookieOidc(chaveDoCookie, 'local')
      /** O mesmo login em andamento que o `iniciar` gravou, com o que o teste troca. */
      const forjar = (preparada: Preparada, troca: Record<string, unknown>): Preparada => {
        const original = cookies.ler(preparada.cookie.slice(`${COOKIE_OIDC}=`.length))
        if (original === undefined) throw new Error('cookie do iniciar não decifra')
        return { consulta: preparada.consulta, cookie: cookies.gravar({ ...original, ...troca }).split(';')[0] ?? '' }
      }

      const doAlunoDaA = await preparar(a.slug, alunoA.cookie)
      const comEscolaDeOutra = forjar(doAlunoDaA, { escolaId: b.escolaId, slug: b.slug })
      expect((await concluir(comEscolaDeOutra)).location).toBe(RECUSADA)

      // O aluno `outroDaA` com a sessão (aberta) do `alunoA`: a sessão não é dele.
      await bancada.encerrar(outroDaA.sessao.sessaoId)
      const doAlunoDaA2 = await preparar(a.slug, alunoA.cookie)
      const comSessaoDeOutro = forjar(doAlunoDaA2, { ligarAoAluno: { usuarioId: outroDaA.sessao.usuarioId, sessaoId: alunoA.sessao.sessaoId } })
      expect((await concluir(comSessaoDeOutro)).location).toBe(RECUSADA)

      // O aluno da B com o cookie da A: a sessão que vale é a do cookie, e ela é de outra escola.
      const doAlunoDaB = await preparar(b.slug, alunoB.cookie)
      const comSessaoDaA = forjar(doAlunoDaB, { ligarAoAluno: { usuarioId: alunoA.sessao.usuarioId, sessaoId: alunoA.sessao.sessaoId } })
      expect((await concluir(comSessaoDaA)).location).toBe(RECUSADA)

      expect(await ligacoesDa(a.escolaId)).toEqual([])
      expect(await ligacoesDa(b.escolaId)).toEqual([])
    })
  })

  describe('a ligação pede a prova da conta de novo: a conta que o computador compartilhado deixou aberta não liga calada', () => {
    /** Os parâmetros do endereço do provedor para onde o `iniciar` manda o navegador. */
    const pedidoAoProvedor = (inicio: Redirect) => new URL(inicio.location).searchParams

    it('o `iniciar` da ligação leva `max_age=0` e o `prompt` do provedor (Google escolhe a conta, Microsoft pede a credencial); o login comum não leva nenhum dos dois', async () => {
      const { escolaId, slug } = await escola()
      await bancada.pool.query('insert into provedor_escola (escola_id, provedor, valor) values ($1, $2, $3)', [escolaId, 'microsoft', TENANT_A])
      const aluno = await alunoComSessao(escolaId)

      const noGoogle = pedidoAoProvedor(await iniciar(slug, aluno.cookie))
      expect([noGoogle.get('max_age'), noGoogle.get('prompt')]).toEqual(['0', 'select_account'])
      const naMicrosoft = pedidoAoProvedor(await iniciar(slug, aluno.cookie, {}, 'microsoft'))
      expect([naMicrosoft.get('max_age'), naMicrosoft.get('prompt')]).toEqual(['0', 'login'])

      for (const provedor of ['google', 'microsoft']) {
        const comum = await redirecionamento(await fetch(`${api.url}${CAMINHO_DO_COOKIE_OIDC}/${provedor}/iniciar?slug=${encodeURIComponent(slug)}`, { redirect: 'manual' }))
        expect(comum.status, provedor).toBe(302)
        const parametros = pedidoAoProvedor(comum)
        expect([parametros.has('max_age'), parametros.has('prompt')], provedor).toEqual([false, false])
      }
    })

    it('o retorno cuja autenticação é antiga (o `auth_time` do provedor de muito antes): `recusada`, nada ligado; com o `auth_time` de agora, liga', async () => {
      const { escolaId, slug } = await escola()
      const aluno = await alunoComSessao(escolaId)

      expect((await ligar(slug, aluno.cookie, 'google-aluna-a-sessao-antiga')).location).toBe(RECUSADA)
      expect(await ligacoesDa(escolaId)).toEqual([])

      expect((await ligar(slug, aluno.cookie, 'google-aluna-a-reautenticada')).location).toBe(LIGADA)
      expect((await ligacoesDa(escolaId)).map((linha) => linha.sujeito)).toEqual(['google-sub-aluna-a-reautenticada'])
    })
  })

  describe('a queda do provedor volta a "Eu", onde o aluno já está entrado', () => {
    it('`error` no retorno: `provedor`, nada ligado, e o cookie do login em andamento é apagado', async () => {
      const { escolaId, slug } = await escola()
      const aluno = await alunoComSessao(escolaId)
      const inicio = await iniciar(slug, aluno.cookie)
      expect(inicio.status).toBe(302)

      const resposta = await retorno('?error=access_denied', inicio.cookie)

      expect(resposta.location).toBe(PROVEDOR)
      expect(resposta.setCookie[0]).toMatch(new RegExp(`^${COOKIE_OIDC}=; .*Max-Age=0`))
      expect(await ligacoesDa(escolaId)).toEqual([])
    })

    it('o emissor que não responde no `iniciar`: o aluno volta a "Eu" com `provedor`, sem cookie do login em andamento e sem ir à tela de entrada', async () => {
      const { escolaId, slug } = await escola()
      const aluno = await alunoComSessao(escolaId)
      // Porta 9 (discard) recusa a conexão na hora: a descoberta do emissor falha sem esperar o prazo de 5 s.
      const semEmissor = await subirApi(medidor.medidor, { ambiente: { LOGIN_EXTERNO_GOOGLE_EMISSOR: 'http://127.0.0.1:9' } })
      try {
        const resposta = await iniciar(slug, aluno.cookie, {}, 'google', semEmissor.url)

        expect(resposta.status).toBe(302)
        expect(resposta.location).toBe(PROVEDOR)
        expect(resposta.setCookie).toEqual([])
      } finally {
        await semEmissor.app.close()
      }
      expect(await ligacoesDa(escolaId)).toEqual([])
    })

    it('o provedor que não responde ao `iniciar` (escola sem o provedor): 404 como o login, sem cookie', async () => {
      const escolaId = await bancada.escola()
      const slug = await bancada.slugDe(escolaId)
      const aluno = await alunoComSessao(escolaId)

      const resposta = await iniciar(slug, aluno.cookie)

      expect(resposta.status).toBe(404)
      expect(resposta.setCookie).toEqual([])
    })
  })

  describe('[P] gerar a provisória × ligar a conta, na trava da linha do usuário do aluno', () => {
    /** Escola com ano em curso e coordenação (`sala.montar()`), o domínio liberado e um aluno com credencial e sessão. */
    async function montarComAluno(): Promise<{ s: TestSala; aluno: AlunoComSessao }> {
      const s = await sala.montar()
      await bancada.pool.query('insert into provedor_escola (escola_id, provedor, valor) values ($1, $2, $3)', [s.escolaId, 'google', DOMINIO_A])
      const aluno = await alunoComSessao(s.escolaId)
      await comCredencial(s.escolaId, aluno.sessao.usuarioId)
      return { s, aluno }
    }

    const gerar = (quem: TestSessao, alunoId: string) => chamar(api.url, 'POST', `/v1/usuarios/${alunoId}/senha-provisoria`, quem.token)

    async function credencialDe(alunoId: string): Promise<{ senha_hash: string | null; provisoria_hash: string | null }> {
      const { rows } = await bancada.pool.query<{ senha_hash: string | null; provisoria_hash: string | null }>('select senha_hash, provisoria_hash from credencial_matricula where usuario_id = $1', [alunoId])
      const linha = rows[0]
      if (linha === undefined) throw new Error('credencial de teste não encontrada')
      return linha
    }

    it('a geração chega primeiro e encerra a sessão: a ligação que esperava a trava a vê encerrada e não liga; o aluno fica com a provisória e sem conta', async () => {
      const { s, aluno } = await montarComAluno()
      const preparada = await preparar(s.slug, aluno.cookie)
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'credencial_matricula', evento: 'update', quando: `new.escola_id = '${s.escolaId}'::uuid and new.provisoria_hash is not null` })
      await parada.armar()
      try {
        const geracao = gerar(s.coordenacao, aluno.sessao.usuarioId)
        await parada.esperarParadas(1)
        const ligacao = concluir(preparada)
        // A ligação espera a trava do usuário do aluno, que a geração segura: ainda não conferiu a sessão.
        await esperarNaTrava(bancada.pool, '%"usuario"%for no key update%')
        await parada.soltar()
        const [gerada, ligada] = await Promise.all([geracao, ligacao])

        expect(gerada.status, JSON.stringify(gerada.corpo)).toBe(200)
        expect(ligada.location).toBe(RECUSADA)
        expect(await ligacoesDa(s.escolaId)).toEqual([])
        const credencial = await credencialDe(aluno.sessao.usuarioId)
        expect(credencial.provisoria_hash).not.toBeNull()
        expect(credencial.senha_hash).toBeNull()
      } finally {
        await parada.desarmar()
      }
    })

    it('a ligação chega primeiro: a geração, que esperava a trava, vê a conta ligada e responde `ENTRA_PELA_CONTA_DA_ESCOLA`, e a senha dele não muda', async () => {
      const { s, aluno } = await montarComAluno()
      const preparada = await preparar(s.slug, aluno.cookie)
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'conta_externa', evento: 'insert', quando: `new.escola_id = '${s.escolaId}'::uuid` })
      await parada.armar()
      try {
        const ligacao = concluir(preparada)
        await parada.esperarParadas(1)
        const geracao = gerar(s.coordenacao, aluno.sessao.usuarioId)
        await esperarNaTrava(bancada.pool, '%"usuario"%for no key update%')
        await parada.soltar()
        const [ligada, gerada] = await Promise.all([ligacao, geracao])

        expect(ligada.location).toBe(LIGADA)
        expect(gerada.status).toBe(409)
        expect(gerada.corpo.erro?.codigo).toBe(ErrorCode.ENTRA_PELA_CONTA_DA_ESCOLA)
        expect(await ligacoesDa(s.escolaId)).toHaveLength(1)
        const credencial = await credencialDe(aluno.sessao.usuarioId)
        expect(credencial.provisoria_hash).toBeNull()
        expect(credencial.senha_hash).toBe(SENHA_ANTIGA_HASH)
      } finally {
        await parada.desarmar()
      }
    })
  })

  describe('[P] a mesma conta, ao mesmo tempo', () => {
    it('o mesmo aluno liga a conta duas vezes ao mesmo tempo: as duas voltam `ligada`, uma ligação e um registro', async () => {
      const { escolaId, slug } = await escola()
      const aluno = await alunoComSessao(escolaId)
      const [primeira, segunda] = [await preparar(slug, aluno.cookie), await preparar(slug, aluno.cookie)]

      const resultados = await Promise.all([concluir(primeira), concluir(segunda)])

      expect(resultados.map((r) => r.location)).toEqual([LIGADA, LIGADA])
      expect(await ligacoesDa(escolaId)).toHaveLength(1)
      expect(await auditoriaDaLigacao(escolaId)).toHaveLength(1)
    })

    it('dois alunos ligam a mesma conta ao mesmo tempo: um liga, o outro recebe `conflito`, nunca erro, e fica uma ligação', async () => {
      const { escolaId, slug } = await escola()
      const [um, outro] = [await alunoComSessao(escolaId), await alunoComSessao(escolaId)]
      const [doUm, doOutro] = [await preparar(slug, um.cookie), await preparar(slug, outro.cookie)]
      // O primeiro `insert` para dentro da transação, já no índice único; o segundo, de outro aluno e outra trava de usuário, só pode esperar atrás dele: as duas transações se cruzam.
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'conta_externa', evento: 'insert', quando: `new.escola_id = '${escolaId}'::uuid` })
      await parada.armar()
      try {
        const ligacaoDoUm = concluir(doUm)
        await parada.esperarParadas(1)
        const ligacaoDoOutro = concluir(doOutro)
        await esperarNaTrava(bancada.pool, '%insert into "conta_externa"%')
        await parada.soltar()
        const resultados = await Promise.all([ligacaoDoUm, ligacaoDoOutro])

        expect(resultados.map((r) => r.status)).toEqual([302, 302])
        expect(resultados.map((r) => r.location)).toEqual([LIGADA, CONFLITO])
        expect(await ligacoesDa(escolaId)).toHaveLength(1)
        expect((await ligacoesDa(escolaId))[0]?.usuario_id).toBe(um.sessao.usuarioId)
        expect(await auditoriaDaLigacao(escolaId)).toHaveLength(1)
      } finally {
        await parada.desarmar()
      }
    })
  })

  describe('[P] aprovar o pedido com a conta C × outro aluno liga C em "Eu"', () => {
    const erro = (codigo: ErrorCode) => ({ status: 409, codigo, texto: MENSAGENS_DE_ERRO[codigo] })

    const post = (quem: { token: string }, caminho: string, corpo?: unknown) => chamar(api.url, 'POST', caminho, quem.token, corpo)
    const decidir = (quem: { token: string }, ids: readonly string[]) => post(quem, '/v1/reivindicacoes/decidir', { ids, decisao: 'aprovar' })

    /** O pedido do nome com a conta da aluna provada no link da sala (14.0), pendente. */
    async function pedidoComConta(s: TestSala, nome: NomeDaLista): Promise<string> {
      const inicio = await redirecionamento(await fetch(`${api.url}${CAMINHO_DO_COOKIE_OIDC}/google/iniciar?${new URLSearchParams({ slug: s.slug, intencao: 'reivindicar', token: s.token }).toString()}`, { redirect: 'manual' }))
      const cookieOidc = inicio.setCookie.find((valor) => valor.startsWith(`${COOKIE_OIDC}=`))?.split(';')[0] ?? ''
      const consulta = await autorizar({ ...inicio, cookie: cookieOidc }, ALUNA_A)
      const provada = await retorno(consulta, cookieOidc)
      const cookieDaConta = provada.setCookie.find((valor) => valor.startsWith(`${COOKIE_CONTA_PROVADA}=`))?.split(';')[0] ?? ''
      expect(cookieDaConta).not.toBe('')
      const { senha: _senha, ...corpo } = pedidoDaSala(s, nome, {}, 'token')
      const resposta = await sala.reivindicar(corpo, { cabecalhos: { Cookie: cookieDaConta } })
      expect(resposta.status, resposta.texto).toBe(200)
      const { rows } = await bancada.pool.query<{ id: string }>("select id from reivindicacao where lista_nome_id = $1 and estado = 'pendente'", [nome.id])
      const id = rows[0]?.id
      if (id === undefined) throw new Error('pedido pendente não encontrado')
      return id
    }

    function resultados(resposta: RespostaHttp): ResultadoDaDecisao[] {
      expect(resposta.status, JSON.stringify(resposta.corpo)).toBe(200)
      return decisaoResponseSchema.parse(resposta.corpo).resultados.map((linha) => linha.resultado)
    }

    async function montarComPedido(): Promise<{ s: TestSala; pedidoId: string; outro: AlunoComSessao; nome: NomeDaLista }> {
      const s = await sala.montar()
      await bancada.pool.query('insert into provedor_escola (escola_id, provedor, valor) values ($1, $2, $3)', [s.escolaId, 'google', DOMINIO_A])
      const nome = await sala.umNome(s)
      const pedidoId = await pedidoComConta(s, nome)
      return { s, pedidoId, outro: await alunoComSessao(s.escolaId), nome }
    }

    function paradaNaLigacao(s: TestSala): WriteBlockTrigger {
      return new WriteBlockTrigger(bancada.pool, { tabela: 'conta_externa', evento: 'insert', quando: `new.escola_id = '${s.escolaId}'::uuid and new.sujeito = '${SUJEITO_DA_ALUNA}'` })
    }

    it('a aprovação chega primeiro: aprova e liga a conta ao aluno novo, e a ligação do outro aluno recebe `conflito`, nunca erro', async () => {
      const { s, pedidoId, outro } = await montarComPedido()
      const preparada = await preparar(s.slug, outro.cookie)
      const usuariosAntes = await contar('usuario', s.escolaId)
      const parada = paradaNaLigacao(s)
      await parada.armar()
      try {
        const aprovacao = decidir(s.professor, [pedidoId])
        await parada.esperarParadas(1)
        const ligacao = concluir(preparada)
        // A ligação espera, no índice único, a transação que aprovou: dois comandos de insert na trava.
        await esperarNaTrava(bancada.pool, '%insert into "conta_externa"%', 2)
        await parada.soltar()
        const [aprovada, ligada] = await Promise.all([aprovacao, ligacao])

        expect(resultados(aprovada)).toEqual(['decidida'])
        expect(ligada.location).toBe(CONFLITO)
        expect(await contar('usuario', s.escolaId)).toBe(usuariosAntes + 1)
        const ligacoes = await ligacoesDa(s.escolaId)
        expect(ligacoes).toHaveLength(1)
        expect(ligacoes[0]?.usuario_id).not.toBe(outro.sessao.usuarioId)
      } finally {
        await parada.desarmar()
      }
    })

    it('a ligação chega primeiro: liga, e a aprovação recebe `CONFLITO` sem nome, desfaz tudo (nenhum usuário novo) e o pedido segue pendente', async () => {
      const { s, pedidoId, outro, nome } = await montarComPedido()
      const preparada = await preparar(s.slug, outro.cookie)
      const usuariosAntes = await contar('usuario', s.escolaId)
      const parada = paradaNaLigacao(s)
      await parada.armar()
      try {
        const ligacao = concluir(preparada)
        await parada.esperarParadas(1)
        const aprovacao = decidir(s.professor, [pedidoId])
        await esperarNaTrava(bancada.pool, '%insert into "conta_externa"%', 2)
        await parada.soltar()
        const [ligada, aprovada] = await Promise.all([ligacao, aprovacao])

        expect(ligada.location).toBe(LIGADA)
        expect(aprovada.status).toBe(erro(ErrorCode.CONFLITO).status)
        expect(aprovada.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
        const texto = JSON.stringify(aprovada.corpo)
        expect(texto).not.toContain(outro.sessao.usuarioId)
        expect(texto).not.toContain(nome.nome)
        expect(await contar('usuario', s.escolaId)).toBe(usuariosAntes)
        expect(await ligacoesDa(s.escolaId)).toEqual([expect.objectContaining({ usuario_id: outro.sessao.usuarioId })])
        const { rows } = await bancada.pool.query<{ estado: string }>('select estado from reivindicacao where id = $1', [pedidoId])
        expect(rows[0]?.estado).toBe('pendente')
      } finally {
        await parada.desarmar()
      }
    })
  })
})
