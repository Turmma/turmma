import { AuditoriaRepository, DomainException, runInContext } from '@educa/core'
import { ErrorCode, InvariantException, trocasDaProvisoriaResponseSchema, type TrocasDaProvisoriaResponse } from '@educa/shared'
import { hash, verify } from '@node-rs/argon2'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { BilheteDaTroca, CredencialMatriculaRepository, HashBulkhead, PasswordHasher, escolaBucket } from '../src/credencial/index.js'
import { FerramentasDaSala, type TestSala } from './sala.fixture.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'

/**
 * O aluno entra com a senha provisória e troca a senha (acesso-e-convites, tarefa 10.0; `tasks/prd-acesso-e-convites/cenarios.md`, RF13, "Corridas" e "Limites"):
 * `POST /v1/sessao/matricula` com a provisória, `GET /v1/sessao/matricula/trocas` e `POST /v1/sessao/matricula/trocar-senha`, os dois últimos com o bilhete no `Authorization`.
 * Postgres e Redis reais do compose de teste. A provisória nasce pela rota de verdade (`POST /v1/usuarios/:id/senha-provisoria`, da 9.0), e o "tempo" se atravessa pelo banco
 * (`vencer`, `recuar`), nunca esperando.
 */

const AMBIENTE = { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' }
const SENHA_ANTIGA = 'senha-antiga-sintetica-1'
const SENHA_NOVA = 'senha-nova-sintetica-do-aluno-1'
const OUTRA_SENHA_NOVA = 'outra-senha-nova-sintetica-2'
const SENHA_ERRADA = 'senha-errada-sintetica-9'

interface AlunoDeTeste {
  readonly usuarioId: string
  readonly matricula: string
  readonly escolaId: string
  readonly slug: string
}

interface BrutoHttp {
  readonly status: number
  readonly cabecalhos: Headers
  readonly corpo: Record<string, unknown>
  readonly setCookie: string[]
}

describe('o aluno entra com a senha provisória e troca a senha (acesso-e-convites, tarefa 10.0)', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let sala: FerramentasDaSala
  let hashAntigo: string
  let hasher: PasswordHasher
  let bilhetes: BilheteDaTroca

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: AMBIENTE })
    sala = new FerramentasDaSala(api, bancada)
    hashAntigo = await hash(SENHA_ANTIGA, { memoryCost: 8192, timeCost: 1 })
    hasher = api.app.get(PasswordHasher)
    bilhetes = api.app.get(BilheteDaTroca)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  // ---------------------------------------------------------------------------------------------------------------------
  // Apoio
  // ---------------------------------------------------------------------------------------------------------------------

  /** Um aluno da escola, com credencial por matrícula (a senha antiga) e, se `turmaId`, vínculo `confirmado` nela. */
  async function novoAluno(s: Pick<TestSala, 'escolaId' | 'anoLetivoId' | 'coordenacao' | 'slug'> & { turma?: string }, matricula = `tp-${randomUUID().slice(0, 18)}`, naTurma = false): Promise<AlunoDeTeste> {
    const aluno = await bancada.sessao(s.escolaId, 'aluno')
    if (naTurma && s.turma !== undefined) {
      await bancada.pool.query(
        `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`,
        [s.escolaId, s.anoLetivoId, aluno.usuarioId, s.turma, s.coordenacao.usuarioId],
      )
    }
    await bancada.pool.query('insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, $4)', [s.escolaId, aluno.usuarioId, matricula, hashAntigo])
    return { usuarioId: aluno.usuarioId, matricula, escolaId: s.escolaId, slug: s.slug }
  }

  const gerar = (quem: TestSessao, alunoId: string) => chamar(api.url, 'POST', `/v1/usuarios/${alunoId}/senha-provisoria`, quem.token)

  /** A senha provisória como a tela a mostra (`ABCD-EFGH`), gerada pela rota de verdade. */
  async function gerarSenha(quem: TestSessao, alunoId: string): Promise<string> {
    const r = await gerar(quem, alunoId)
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    return String(r.corpo['senha'])
  }

  /** Recua em 11 s a hora da geração, para o `CONFLITO` de 10 s não valer mais. */
  async function recuar(alunoId: string): Promise<void> {
    await bancada.pool.query("update credencial_matricula set provisoria_expira_em = provisoria_expira_em - interval '11 seconds' where usuario_id = $1 and provisoria_expira_em is not null", [alunoId])
  }

  /** Faz a provisória vencer: a validade vai para um minuto atrás, e o texto novo dela volta, como o bilhete a leva. */
  async function vencer(alunoId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ texto: string }>(
      `update credencial_matricula set provisoria_expira_em = now() - interval '1 minute' where usuario_id = $1
       returning to_char(provisoria_expira_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as texto`,
      [alunoId],
    )
    return rows[0]?.texto ?? ''
  }

  /** Devolve a provisória a uma hora de validade, e o texto novo dela: o que o bilhete leva. */
  async function valerPorMais(alunoId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ texto: string }>(
      `update credencial_matricula set provisoria_expira_em = now() + interval '1 hour' where usuario_id = $1
       returning to_char(provisoria_expira_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as texto`,
      [alunoId],
    )
    return rows[0]?.texto ?? ''
  }

  const entrar = (slug: string, matricula: string, senha: string, cabecalhos: Record<string, string> = {}) =>
    chamar(api.url, 'POST', '/v1/sessao/matricula', undefined, { slug, matricula, senha }, cabecalhos)

  /** O login com a provisória, que devolve o bilhete. */
  async function bilheteDe(aluno: AlunoDeTeste, senha: string): Promise<string> {
    const r = await entrar(aluno.slug, aluno.matricula, senha)
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    expect(r.corpo['etapa']).toBe('trocar_senha')
    return String(r.corpo['bilhete'])
  }

  async function bruto(metodo: 'GET' | 'POST', caminho: string, bilhete: string | undefined, corpo?: unknown, cabecalhos: Record<string, string> = {}): Promise<BrutoHttp> {
    const resposta = await fetch(`${api.url}${caminho}`, {
      method: metodo,
      headers: { ...(bilhete === undefined ? {} : { Authorization: `Bearer ${bilhete}` }), ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }), ...cabecalhos },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    })
    const texto = await resposta.text()
    return { status: resposta.status, cabecalhos: resposta.headers, corpo: texto === '' ? {} : (JSON.parse(texto) as Record<string, unknown>), setCookie: resposta.headers.getSetCookie() }
  }

  const trocar = (bilhete: string | undefined, senha: string = SENHA_NOVA, cabecalhos: Record<string, string> = {}) => bruto('POST', '/v1/sessao/matricula/trocar-senha', bilhete, { senha }, cabecalhos)
  const trocas = (bilhete: string | undefined) => bruto('GET', '/v1/sessao/matricula/trocas', bilhete)

  function lista(r: BrutoHttp): TrocasDaProvisoriaResponse['anteriores'] {
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    return trocasDaProvisoriaResponseSchema.parse(r.corpo).anteriores
  }

  interface CredencialNoBanco {
    readonly senha_hash: string | null
    readonly provisoria_hash: string | null
    readonly provisoria_expira_em: Date | null
    readonly provisoria_gerada_por: string | null
  }

  async function credencialDe(alunoId: string): Promise<CredencialNoBanco> {
    const { rows } = await bancada.pool.query<CredencialNoBanco>('select senha_hash, provisoria_hash, provisoria_expira_em, provisoria_gerada_por from credencial_matricula where usuario_id = $1', [alunoId])
    const linha = rows[0]
    if (linha === undefined) throw new Error('credencial de teste não encontrada')
    return linha
  }

  async function auditoriasDe(alunoId: string, acao: string): Promise<Array<{ autor_usuario_id: string; entidade: string; depois: unknown; antes: unknown; finalidade: unknown }>> {
    const { rows } = await bancada.pool.query<{ autor_usuario_id: string; entidade: string; depois: unknown; antes: unknown; finalidade: unknown }>(
      'select autor_usuario_id, entidade, depois, antes, finalidade from auditoria where acao = $2 and entidade_id = $1 order by em',
      [alunoId, acao],
    )
    return rows
  }

  async function sessoesAbertasDe(alunoId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ total: number }>('select count(*)::int as total from sessao where usuario_id = $1 and encerrada_em is null', [alunoId])
    return rows[0]?.total ?? 0
  }

  /** O aluno com a provisória recém-gerada pela coordenação, e a senha como a tela a mostra. */
  async function alunoComProvisoria(s: TestSala): Promise<{ aluno: AlunoDeTeste; senha: string }> {
    const aluno = await novoAluno(s)
    return { aluno, senha: await gerarSenha(s.coordenacao, aluno.usuarioId) }
  }

  const semRequisicao = (r: RespostaHttp) => ({ status: r.status, corpo: JSON.stringify({ ...r.corpo, erro: { ...r.corpo.erro, requisicaoId: '-' } }) })

  // ---------------------------------------------------------------------------------------------------------------------
  // O login com a provisória
  // ---------------------------------------------------------------------------------------------------------------------

  describe('o login com a provisória', () => {
    it('devolve o bilhete e nenhuma sessão: sem cookie, sem sessão aberta nem registro de acesso, e o bilhete não abre outra rota', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      const sessoesDepoisDeGerar = await sessoesAbertasDe(aluno.usuarioId)

      const r = await entrar(aluno.slug, aluno.matricula, senha)
      expect(r.status).toBe(200)
      expect(Object.keys(r.corpo).sort()).toEqual(['bilhete', 'etapa'])
      expect(r.corpo['etapa']).toBe('trocar_senha')
      expect(r.setCookie).toEqual([])
      expect(await sessoesAbertasDe(aluno.usuarioId)).toBe(sessoesDepoisDeGerar)
      const { rows } = await bancada.pool.query<{ total: number }>("select count(*)::int as total from registro_acesso where usuario_id = $1 and evento = 'login'", [aluno.usuarioId])
      expect(rows[0]?.total).toBe(0)

      // O bilhete não é token de acesso: a guarda de sessão o recusa em qualquer rota autenticada.
      const bilhete = String(r.corpo['bilhete'])
      for (const caminho of ['/v1/eu', '/v1/minhas-atividades']) expect((await chamar(api.url, 'GET', caminho, bilhete)).status, caminho).toBe(401)
      // E o token de acesso não é bilhete: a troca e a lista recusam o de quem já tem sessão.
      const comSessao = await bancada.sessao(s.escolaId, 'aluno')
      expect((await trocar(comSessao.token)).status).toBe(401)
      expect((await trocas(comSessao.token)).status).toBe(401)
      expect(await sessoesAbertasDe(aluno.usuarioId)).toBe(sessoesDepoisDeGerar)
    })

    it('a eliminação agendada vem antes do bilhete: a provisória certa de um aluno suspenso é ACESSO_SUSPENSO, sem bilhete, sem cookie e sem sessão', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      await bancada.pool.query("update usuario set eliminacao_agendada_em = now() + interval '7 days' where id = $1", [aluno.usuarioId])
      const sessoes = await sessoesAbertasDe(aluno.usuarioId)

      const r = await entrar(aluno.slug, aluno.matricula, senha)
      expect(r.corpo.erro?.codigo).toBe(ErrorCode.ACESSO_SUSPENSO)
      expect(r.corpo['bilhete']).toBeUndefined()
      expect(r.setCookie).toEqual([])
      expect(await sessoesAbertasDe(aluno.usuarioId)).toBe(sessoes)
    })

    it('a provisória vale como a tela a mostra: com o hífen, em minúsculas, com espaços; a senha antiga, que gerar apagou, e uma letra trocada não valem', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)

      expect((await entrar(aluno.slug, aluno.matricula, SENHA_ANTIGA)).status).toBe(401)
      const trocada = `${senha.slice(0, 7)}${senha.endsWith('2') ? '3' : '2'}`
      expect((await entrar(aluno.slug, aluno.matricula, trocada)).status).toBe(401)
      for (const digitada of [senha, senha.toLowerCase(), senha.replace('-', ''), ` ${senha.replace('-', ' ').toLowerCase()} `]) {
        const r = await entrar(aluno.slug, aluno.matricula, digitada)
        expect(r.corpo['etapa'], digitada).toBe('trocar_senha')
      }
    })

    it('a provisória vence em 24 h: a de 23 h59 entra, a de 24 h01 é recusada como senha errada', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)

      await bancada.pool.query("update credencial_matricula set provisoria_expira_em = now() + interval '1 minute' where usuario_id = $1", [aluno.usuarioId])
      expect((await entrar(aluno.slug, aluno.matricula, senha)).corpo['etapa']).toBe('trocar_senha')

      await vencer(aluno.usuarioId)
      const vencida = await entrar(aluno.slug, aluno.matricula, senha)
      const errada = await entrar(aluno.slug, aluno.matricula, SENHA_ERRADA)
      expect(semRequisicao(vencida)).toEqual(semRequisicao(errada))
      expect(vencida.status).toBe(401)
      // Sem o hífen a vencida é a própria senha guardada: se o hash dela vazasse da consulta, a conferência a aceitaria como senha comum.
      const semHifen = await entrar(aluno.slug, aluno.matricula, senha.replace('-', ''))
      expect(semRequisicao(semHifen)).toEqual(semRequisicao(errada))
      expect(semHifen.status).toBe(401)
      expect(semHifen.setCookie).toEqual([])
    })

    it('privacidade: matrícula inexistente, aluno só com a conta da escola e senha errada dão a mesma resposta, e o sem senha passa pelo hash fixo (espião), como a matrícula que não existe', async () => {
      const s = await sala.montar()
      const { aluno } = await alunoComProvisoria(s)
      const soComConta = await novoAluno(s)
      await bancada.pool.query('update credencial_matricula set senha_hash = null where usuario_id = $1', [soComConta.usuarioId])
      await bancada.pool.query("insert into conta_externa (escola_id, usuario_id, provedor, sujeito) values ($1, $2, 'google', $3)", [s.escolaId, soComConta.usuarioId, `sujeito-${randomUUID()}`])
      const verificar = vi.spyOn(hasher, 'verificar')

      const inexistente = await entrar(s.slug, `nao-existe-${randomUUID().slice(0, 8)}`, SENHA_ERRADA)
      const semSenha = await entrar(s.slug, soComConta.matricula, SENHA_ERRADA)
      const errada = await entrar(s.slug, aluno.matricula, SENHA_ERRADA)

      expect(inexistente.status).toBe(401)
      expect(semSenha.status).toBe(401)
      expect(semSenha.setCookie).toEqual([])
      expect(semRequisicao(semSenha)).toEqual(semRequisicao(inexistente))
      expect(semRequisicao(errada)).toEqual(semRequisicao(inexistente))
      // Um hash por tentativa: o inexistente e o sem senha vão ao hash fixo (sem hash guardado); a provisória errada, ao hash dela.
      expect(verificar.mock.calls.map(([guardado]) => (guardado == null ? 'fixo' : 'guardado'))).toEqual(['fixo', 'fixo', 'guardado'])
      // Nem a conta da escola, ligada e sem senha, entra pela senha digitada: nunca vira bilhete nem sessão.
      expect(await sessoesAbertasDe(soComConta.usuarioId)).toBe(1)
    })

    it('a senha do aluno vale sozinha: com a senha e uma provisória vigente gravadas juntas, a senha entra direto e a provisória não vale', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      await bancada.pool.query('update credencial_matricula set senha_hash = $2 where usuario_id = $1', [aluno.usuarioId, hashAntigo])

      const comASenha = await entrar(aluno.slug, aluno.matricula, SENHA_ANTIGA)
      expect(comASenha.corpo['etapa']).toBe('pronta')
      expect(comASenha.corpo['bilhete']).toBeUndefined()
      const comAProvisoria = await entrar(aluno.slug, aluno.matricula, senha)
      expect(comAProvisoria.status).toBe(401)
    })

    it('isolamento: a matrícula é a mesma em A e em B, e a provisória da A não abre a da B (que segue com a senha dela)', async () => {
      const a = await sala.montar()
      const b = await sala.montar()
      const matricula = `igual-${randomUUID().slice(0, 12)}`
      const doA = await novoAluno(a, matricula)
      const doB = await novoAluno(b, matricula)
      const senhaDoA = await gerarSenha(a.coordenacao, doA.usuarioId)

      const noB = await entrar(b.slug, matricula, senhaDoA)
      expect(noB.status).toBe(401)
      expect(noB.setCookie).toEqual([])
      expect((await credencialDe(doB.usuarioId)).senha_hash).toBe(hashAntigo)
      expect((await entrar(b.slug, matricula, SENHA_ANTIGA)).corpo['etapa']).toBe('pronta')
      expect((await entrar(a.slug, matricula, senhaDoA)).corpo['etapa']).toBe('trocar_senha')
    })
  })

  // ---------------------------------------------------------------------------------------------------------------------
  // trocar-senha
  // ---------------------------------------------------------------------------------------------------------------------

  describe('trocar-senha', () => {
    it('a troca grava a senha nova, anula as três colunas da provisória, abre a sessão do aluno, sai com no-store, e a senha nova entra no login seguinte', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      const bilhete = await bilheteDe(aluno, senha)
      const antes = await sessoesAbertasDe(aluno.usuarioId)

      const r = await trocar(bilhete)
      expect(r.status, JSON.stringify(r.corpo)).toBe(200)
      expect(r.cabecalhos.get('cache-control')).toBe('no-store')
      expect(r.corpo['etapa']).toBe('pronta')
      expect(r.setCookie.some((linha) => linha.startsWith('educa_sessao='))).toBe(true)
      expect(await sessoesAbertasDe(aluno.usuarioId)).toBe(antes + 1)

      const credencial = await credencialDe(aluno.usuarioId)
      expect(credencial).toMatchObject({ provisoria_hash: null, provisoria_expira_em: null, provisoria_gerada_por: null })
      expect(await verify(credencial.senha_hash ?? '', SENHA_NOVA)).toBe(true)
      expect(JSON.stringify(credencial)).not.toContain(SENHA_NOVA)
      const eu = await chamar(api.url, 'GET', '/v1/eu', String(r.corpo['token']))
      expect(eu.status).toBe(200)

      // A provisória foi gasta: não entra de novo, e o bilhete já usado não troca outra vez. A senha nova entra.
      expect((await entrar(aluno.slug, aluno.matricula, senha)).status).toBe(401)
      expect((await trocar(bilhete, OUTRA_SENHA_NOVA)).status).toBe(401)
      expect((await entrar(aluno.slug, aluno.matricula, SENHA_NOVA)).corpo['etapa']).toBe('pronta')
    })

    it('senha_provisoria.usada: um registro, com o aluno por autor e por alvo, sem senha nem hash, e o gerada fica', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      expect((await trocar(await bilheteDe(aluno, senha))).status).toBe(200)

      expect(await auditoriasDe(aluno.usuarioId, 'senha_provisoria.usada')).toEqual([{ autor_usuario_id: aluno.usuarioId, entidade: 'usuario', depois: null, antes: null, finalidade: null }])
      expect(await auditoriasDe(aluno.usuarioId, 'senha_provisoria.gerada')).toHaveLength(1)
      const { rows } = await bancada.pool.query<{ texto: string }>("select row_to_json(a)::text as texto from auditoria a where acao = 'senha_provisoria.usada' and entidade_id = $1", [aluno.usuarioId])
      expect(rows[0]?.texto).not.toContain(SENHA_NOVA)
      expect(rows[0]?.texto).not.toContain(senha.replace('-', ''))
    })

    it('o `.usada` vai na mesma transação da troca: se o registro não grava, a senha não muda, nenhuma sessão nasce, e a mesma troca vale depois', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      const bilhete = await bilheteDe(aluno, senha)
      const antes = await credencialDe(aluno.usuarioId)
      const sessoes = await sessoesAbertasDe(aluno.usuarioId)
      // Um gatilho que só recusa o `.usada` desta escola (o banco de teste é compartilhado com outros arquivos).
      const sufixo = randomUUID().replaceAll('-', '').slice(0, 12)
      await bancada.pool.query(`create function recusa_usada_${sufixo}() returns trigger language plpgsql as $$ begin raise exception 'recusado pelo teste'; end $$`)
      await bancada.pool.query(
        `create trigger recusa_usada_${sufixo} before insert on auditoria for each row when (new.acao = 'senha_provisoria.usada' and new.escola_id = '${s.escolaId}') execute function recusa_usada_${sufixo}()`,
      )
      try {
        expect((await trocar(bilhete)).status).toBeGreaterThanOrEqual(500)
        expect(await credencialDe(aluno.usuarioId)).toEqual(antes)
        expect(await sessoesAbertasDe(aluno.usuarioId)).toBe(sessoes)
        expect(await auditoriasDe(aluno.usuarioId, 'senha_provisoria.usada')).toEqual([])
      } finally {
        await bancada.pool.query(`drop trigger recusa_usada_${sufixo} on auditoria`)
        await bancada.pool.query(`drop function recusa_usada_${sufixo}()`)
      }
      // A troca desfeita não gastou a provisória: a mesma, sem o gatilho, vale.
      expect((await trocar(bilhete)).status).toBe(200)
      expect(await auditoriasDe(aluno.usuarioId, 'senha_provisoria.usada')).toHaveLength(1)
    })

    it('a senha nova abaixo do mínimo, ou fora do contrato, é 400 antes do 401 e não gasta tentativa da conta', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      const bilhete = await bilheteDe(aluno, senha)

      for (const corpo of [{ senha: 'curta' }, { senha: SENHA_NOVA, escolaId: s.escolaId }, {}, { senha: 1 }]) {
        expect((await bruto('POST', '/v1/sessao/matricula/trocar-senha', undefined, corpo)).status).toBe(400)
        expect((await bruto('POST', '/v1/sessao/matricula/trocar-senha', bilhete, corpo)).status).toBe(400)
      }
      // Quatro falhas de verdade ainda não seguram a conta: os pedidos inválidos acima não contaram.
      const substituida = await bilheteDe(aluno, senha)
      await bancada.pool.query("update credencial_matricula set provisoria_expira_em = provisoria_expira_em - interval '11 seconds' where usuario_id = $1", [aluno.usuarioId])
      await gerarSenha(s.coordenacao, aluno.usuarioId)
      for (let vez = 0; vez < 4; vez++) expect((await trocar(substituida)).status).toBe(401)
      expect((await trocar(substituida)).status).toBe(429)
    })

    it('permissão: sem o bilhete, com o bilhete só na query, ou com texto que não é bilhete, é 401 e nada muda', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      const bilhete = await bilheteDe(aluno, senha)
      const antes = await credencialDe(aluno.usuarioId)

      expect((await trocar(undefined)).status).toBe(401)
      expect((await bruto('POST', `/v1/sessao/matricula/trocar-senha?bilhete=${bilhete}`, undefined, { senha: SENHA_NOVA })).status).toBe(401)
      expect((await bruto('GET', `/v1/sessao/matricula/trocas?bilhete=${bilhete}`, undefined)).status).toBe(401)
      expect((await trocar('nao-e-um-jwt')).status).toBe(401)
      expect(await credencialDe(aluno.usuarioId)).toEqual(antes)
    })

    it('borda: bilhete emitido 5 min antes de a provisória vencer, troca 1 min depois do vencimento: recusada, a senha não muda e nenhum `.usada` nasce', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      await bilheteDe(aluno, senha)
      // A provisória venceu há um minuto; o bilhete é novo (10 min de vida) e leva exatamente a validade gravada: só o `> agora` da troca a recusa.
      const venceu = await vencer(aluno.usuarioId)
      const bilhete = await bilhetes.emitir({ escolaId: aluno.escolaId, usuarioId: aluno.usuarioId, provisoriaExpiraEm: venceu })
      const antes = await credencialDe(aluno.usuarioId)
      const sessoes = await sessoesAbertasDe(aluno.usuarioId)

      expect((await trocar(bilhete)).status).toBe(401)
      expect(await credencialDe(aluno.usuarioId)).toEqual(antes)
      expect(antes.senha_hash).toBeNull()
      expect(await auditoriasDe(aluno.usuarioId, 'senha_provisoria.usada')).toEqual([])
      expect(await sessoesAbertasDe(aluno.usuarioId)).toBe(sessoes)
      expect((await trocas(bilhete)).status).toBe(401)
    })

    it('borda: bilhete de uma provisória que outra geração substituiu é recusado na troca e na lista, e a senha da geração nova segue de pé', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      const velho = await bilheteDe(aluno, senha)
      await recuar(aluno.usuarioId)
      const senhaNova = await gerarSenha(s.coordenacao, aluno.usuarioId)

      // Bilhete que não vale não gasta a vez no semáforo do argon2: o hash da senha nova só se faz para quem pode trocar.
      const gerarHash = vi.spyOn(hasher, 'gerar')
      expect((await trocar(velho)).status).toBe(401)
      expect(gerarHash).not.toHaveBeenCalled()
      expect((await trocas(velho)).status).toBe(401)
      expect((await credencialDe(aluno.usuarioId)).provisoria_hash).not.toBeNull()
      expect((await trocar(await bilheteDe(aluno, senhaNova))).status).toBe(200)
    })

    it('borda: o aluno desativado depois do login não troca nem lista, mesmo com a provisória ainda de pé', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      const bilhete = await bilheteDe(aluno, senha)
      // Só o `desativado_em`, com a provisória ainda de pé: a recusa tem de vir do aluno desativado, e não da provisória que o `desativar` já teria anulado.
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [aluno.usuarioId])

      expect((await trocar(bilhete)).status).toBe(401)
      expect((await trocas(bilhete)).status).toBe(401)
    })

    it('borda: a eliminação do aluno agendada depois do login: o bilhete não troca nem lista, e nenhuma sessão nasce', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      const bilhete = await bilheteDe(aluno, senha)
      await bancada.pool.query("update usuario set eliminacao_agendada_em = now() + interval '7 days' where id = $1", [aluno.usuarioId])
      const sessoes = await sessoesAbertasDe(aluno.usuarioId)
      const gerarHash = vi.spyOn(hasher, 'gerar')
      const gravar = vi.spyOn(CredencialMatriculaRepository.prototype, 'trocarProvisoria')

      expect((await trocar(bilhete)).status).toBe(401)
      // A recusa vem antes do hash e antes do `update`: o `exists` do repository é a rede de baixo, não a decisão (regra 80, item 5).
      expect(gerarHash).not.toHaveBeenCalled()
      expect(gravar).not.toHaveBeenCalled()
      expect((await trocas(bilhete)).status).toBe(401)
      expect((await credencialDe(aluno.usuarioId)).provisoria_hash).not.toBeNull()
      expect(await sessoesAbertasDe(aluno.usuarioId)).toBe(sessoes)
    })

    it('borda: a credencial de matrícula de quem não é aluno não troca nem lista, mesmo com o bilhete assinado por nós', async () => {
      const s = await sala.montar()
      const professor = await bancada.sessao(s.escolaId, 'professor')
      const { rows } = await bancada.pool.query<{ texto: string }>(
        `insert into credencial_matricula (escola_id, usuario_id, matricula, provisoria_hash, provisoria_expira_em)
         values ($1, $2, $3, $4, now() + interval '1 hour')
         returning to_char(provisoria_expira_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as texto`,
        [s.escolaId, professor.usuarioId, `prof-${randomUUID().slice(0, 12)}`, hashAntigo],
      )
      const bilhete = await bilhetes.emitir({ escolaId: s.escolaId, usuarioId: professor.usuarioId, provisoriaExpiraEm: rows[0]?.texto ?? '' })

      expect((await trocar(bilhete)).status).toBe(401)
      expect((await trocas(bilhete)).status).toBe(401)
      expect((await credencialDe(professor.usuarioId)).senha_hash).toBeNull()
    })

    it('duas provisórias com o mesmo vencimento: a troca de um aluno não toca a credencial do outro', async () => {
      const s = await sala.montar()
      const { aluno: a, senha } = await alunoComProvisoria(s)
      const { aluno: b } = await alunoComProvisoria(s)
      const bilheteDoA = await bilheteDe(a, senha)
      await bancada.pool.query('update credencial_matricula set provisoria_expira_em = (select provisoria_expira_em from credencial_matricula where usuario_id = $1) where usuario_id = $2', [a.usuarioId, b.usuarioId])

      expect((await trocar(bilheteDoA)).status).toBe(200)
      const doB = await credencialDe(b.usuarioId)
      expect(doB.provisoria_hash).not.toBeNull()
      expect(doB.senha_hash).toBeNull()
    })

    it('contador por dispositivo (regra 80, item 1): a conta segurada para quem não tem o cookie ainda troca para o aluno que já entrou naquele navegador', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s)
      // O aluno já entrou neste navegador: o login com a senha dele grava o `educa_dispositivo`.
      const cookie = (await entrar(aluno.slug, aluno.matricula, SENHA_ANTIGA)).setCookie.find((linha) => linha.startsWith('educa_dispositivo='))?.split(';')[0] ?? ''
      expect(cookie).not.toBe('')
      const velho = await bilheteDe(aluno, await gerarSenha(s.coordenacao, aluno.usuarioId))
      await recuar(aluno.usuarioId)
      const atual = await bilheteDe(aluno, await gerarSenha(s.coordenacao, aluno.usuarioId))

      // Quatro falhas sem o cookie e a quinta seguram o contador `outro`: a troca certa, sem o cookie, também fica segurada.
      for (let vez = 0; vez < 4; vez++) expect((await trocar(velho)).status).toBe(401)
      expect((await trocar(velho)).status).toBe(429)
      expect((await trocar(atual)).status).toBe(429)
      // Com o cookie do navegador conhecido, o contador é o `conhecido`, que ninguém gastou.
      const r = await trocar(atual, SENHA_NOVA, { Cookie: cookie })
      expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    })

    it('contador (regra 80, item 1): a troca com falha conta no contador da conta, que o login também usa; a troca certa o zera', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      const primeiro = await bilheteDe(aluno, senha)
      await recuar(aluno.usuarioId)
      const senha2 = await gerarSenha(s.coordenacao, aluno.usuarioId)
      const atual = await bilheteDe(aluno, senha2)

      // Três falhas com o bilhete da provisória substituída; a troca certa vem a seguir (a quarta contada) e zera.
      for (let vez = 0; vez < 3; vez++) expect((await trocar(primeiro)).status).toBe(401)
      expect((await trocar(atual)).status).toBe(200)
      // Zerado: quatro senhas erradas seguidas ainda dão 401, e é a quinta que seguraria. Sem o zero, a primeira já seria a quinta contada.
      for (let vez = 0; vez < 4; vez++) expect((await entrar(aluno.slug, aluno.matricula, SENHA_ERRADA)).status, `senha errada ${String(vez + 1)}`).toBe(401)

      // E a falha da troca segura o login: cinco falhas na troca e a senha certa no login responde CONTA_SEGURADA.
      const { aluno: outro, senha: senhaDoOutro } = await alunoComProvisoria(s)
      const substituido = await bilheteDe(outro, senhaDoOutro)
      await recuar(outro.usuarioId)
      const senhaVigente = await gerarSenha(s.coordenacao, outro.usuarioId)
      for (let vez = 0; vez < 4; vez++) expect((await trocar(substituido)).status).toBe(401)
      const quinta = await trocar(substituido)
      expect(quinta.status).toBe(429)
      expect(quinta.corpo['erro']).toMatchObject({ codigo: ErrorCode.CONTA_SEGURADA })
      expect(Number(quinta.cabecalhos.get('retry-after'))).toBeGreaterThan(0)
      const login = await entrar(outro.slug, outro.matricula, senhaVigente)
      expect(login.status).toBe(429)
      expect(login.corpo.erro?.codigo).toBe(ErrorCode.CONTA_SEGURADA)
    })

    it('o hash da senha nova passa pelo semáforo do argon2, com o balde da escola do bilhete', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      const bilhete = await bilheteDe(aluno, senha)
      const espiao = vi.spyOn(api.app.get(HashBulkhead, { strict: false }), 'executar')

      expect((await trocar(bilhete)).status).toBe(200)
      expect(espiao).toHaveBeenCalledTimes(1)
      expect(espiao.mock.calls[0]?.[0]).toEqual(escolaBucket(s.escolaId))
    })

    it('o 503 de quem esperou demais pelo semáforo não conta como tentativa: depois de seis recusas, ainda são precisas cinco falhas inteiras para segurar a conta', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      const primeiro = await bilheteDe(aluno, senha)
      await recuar(aluno.usuarioId)
      await gerarSenha(s.coordenacao, aluno.usuarioId)
      // A recusa do semáforo cheio, simulada (o erro é o que o `HashBulkhead` lança na espera esgotada): o que se prova é a ordem, a tentativa só conta depois da vez.
      const espiao = vi.spyOn(api.app.get(HashBulkhead, { strict: false }), 'executar').mockRejectedValue(new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))

      for (let vez = 0; vez < 6; vez++) {
        const recusada = await trocar(primeiro)
        expect(recusada.status, 'recusa do semáforo').toBe(503)
        expect(recusada.corpo['erro']).toMatchObject({ codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO })
      }
      espiao.mockRestore()

      for (let vez = 0; vez < 4; vez++) expect((await trocar(primeiro)).status, 'depois do 503').toBe(401)
      const quinta = await trocar(primeiro)
      expect(quinta.status).toBe(429)
      expect(quinta.corpo['erro']).toMatchObject({ codigo: ErrorCode.CONTA_SEGURADA })
    })

    it('escola sem ano em curso: o login com a provisória, a lista e a troca funcionam (a credencial é da escola)', async () => {
      const escolaId = await bancada.escola()
      const slug = await bancada.slugDe(escolaId)
      const coordenacao = await bancada.sessao(escolaId, 'coordenador')
      const matricula = `sa-${randomUUID().slice(0, 12)}`
      const [usuarioId] = await bancada.alunosComMatricula(escolaId, [{ matricula, senhaHash: hashAntigo }])
      if (usuarioId === undefined) throw new Error('aluno não criado')
      const aluno = { usuarioId, matricula, escolaId, slug }
      const senha = await gerarSenha(coordenacao, usuarioId)

      const bilhete = await bilheteDe(aluno, senha)
      expect(lista(await trocas(bilhete))).toEqual([])
      expect((await trocar(bilhete)).status).toBe(200)
      expect((await entrar(slug, matricula, SENHA_NOVA)).corpo['etapa']).toBe('pronta')
    })
  })

  // ---------------------------------------------------------------------------------------------------------------------
  // /trocas
  // ---------------------------------------------------------------------------------------------------------------------

  describe('trocas: as provisórias de antes', () => {
    it('lista as geradas antes da de agora, da mais nova à mais antiga, com a data, o papel de quem gerou e se foi usada; a de agora fica de fora, e a resposta é no-store', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, undefined, true)
      // 1ª: coordenação, usada. 2ª: professor, nunca usada. 3ª: coordenação, é a de agora.
      const primeira = await gerarSenha(s.coordenacao, aluno.usuarioId)
      expect((await trocar(await bilheteDe(aluno, primeira))).status).toBe(200)
      await gerarSenha(s.professor, aluno.usuarioId)
      await recuar(aluno.usuarioId)
      const atual = await gerarSenha(s.coordenacao, aluno.usuarioId)
      const { rows: geradas } = await bancada.pool.query<{ em: Date; papel: string }>("select em, depois->>'papel' as papel from auditoria where acao = 'senha_provisoria.gerada' and entidade_id = $1 order by em", [aluno.usuarioId])

      const r = await trocas(await bilheteDe(aluno, atual))
      expect(r.cabecalhos.get('cache-control')).toBe('no-store')
      expect(lista(r)).toEqual([
        { geradaEm: geradas[1]?.em.toISOString(), papel: 'professor', usada: false },
        { geradaEm: geradas[0]?.em.toISOString(), papel: 'coordenador', usada: true },
      ])
    })

    it('a provisória gerada por professor e usada por outra geração: o uso vale só para a geração dele, e o autor eliminado não muda o papel', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s)
      const professor = await bancada.sessao(s.escolaId, 'professor')
      // Primeira, do professor, sem uso; segunda, da coordenação, usada; terceira, a de agora.
      await bancada.pool.query(
        `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id, depois, em) values
           ($1, $2, 'senha_provisoria.gerada', 'usuario', $3, gen_random_uuid(), jsonb_build_object('papel', 'professor'), now() - interval '3 days'),
           ($1, $4, 'senha_provisoria.gerada', 'usuario', $3, gen_random_uuid(), jsonb_build_object('papel', 'coordenador'), now() - interval '2 days'),
           ($1, $3, 'senha_provisoria.usada', 'usuario', $3, gen_random_uuid(), null, now() - interval '1 day'),
           ($1, $3, 'senha_provisoria.usada', 'usuario', $3, gen_random_uuid(), null, now() - interval '4 days')`,
        [s.escolaId, professor.usuarioId, aluno.usuarioId, s.coordenacao.usuarioId],
      )
      // O autor da primeira some (a eliminação de quem gerou apaga o usuário e a auditoria fica pela retenção): a lista continua dizendo `professor`, que está no `depois`.
      await bancada.pool.query('delete from sessao where usuario_id = $1', [professor.usuarioId])
      await bancada.pool.query('delete from usuario where id = $1', [professor.usuarioId])
      const atual = await gerarSenha(s.coordenacao, aluno.usuarioId)

      const anteriores = lista(await trocas(await bilheteDe(aluno, atual)))
      expect(anteriores.map(({ papel, usada }) => ({ papel, usada }))).toEqual([
        { papel: 'coordenador', usada: true },
        { papel: 'professor', usada: false },
      ])
    })

    it('registros de outras ações do aluno não gastam a janela de leitura: as anteriores aparecem mesmo com dezenas de registros mais novos', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s)
      await bancada.pool.query(
        `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id, depois, em)
         select $1, $2, 'senha_provisoria.gerada', 'usuario', $3, gen_random_uuid(), jsonb_build_object('papel', 'coordenador'), now() - n * interval '1 day' from generate_series(2, 3) n`,
        [s.escolaId, s.coordenacao.usuarioId, aluno.usuarioId],
      )
      const atual = await gerarSenha(s.coordenacao, aluno.usuarioId)
      await bancada.pool.query(
        `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id, em)
         select $1, $2, 'senha.redefinida', 'usuario', $2, gen_random_uuid(), now() + n * interval '1 second' from generate_series(1, 70) n`,
        [s.escolaId, aluno.usuarioId],
      )

      expect(lista(await trocas(await bilheteDe(aluno, atual)))).toHaveLength(2)
    })

    it('com 12 anteriores, traz as 10 mais recentes', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s)
      await bancada.pool.query(
        `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id, depois, em)
         select $1, $2, 'senha_provisoria.gerada', 'usuario', $3, gen_random_uuid(), jsonb_build_object('papel', 'coordenador'), now() - n * interval '1 hour' from generate_series(1, 12) n`,
        [s.escolaId, s.coordenacao.usuarioId, aluno.usuarioId],
      )
      const atual = await gerarSenha(s.coordenacao, aluno.usuarioId)

      const anteriores = lista(await trocas(await bilheteDe(aluno, atual)))
      expect(anteriores).toHaveLength(10)
      // As dez mais novas das doze: de 1 h atrás a 10 h atrás; as de 11 h e 12 h ficaram de fora.
      const horas = anteriores.map((anterior) => Math.round((Date.now() - new Date(anterior.geradaEm).getTime()) / 3_600_000))
      expect(horas).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })

    it('não alcança outro aluno: cada bilhete lista só o histórico do próprio aluno, mesmo na mesma escola', async () => {
      const s = await sala.montar()
      const { aluno: a, senha: senhaA } = await alunoComProvisoria(s)
      const { aluno: b, senha: senhaB } = await alunoComProvisoria(s)
      await bancada.pool.query(
        `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id, depois, em)
         values ($1, $2, 'senha_provisoria.gerada', 'usuario', $3, gen_random_uuid(), jsonb_build_object('papel', 'professor'), now() - interval '2 days')`,
        [s.escolaId, s.professor.usuarioId, b.usuarioId],
      )

      expect(lista(await trocas(await bilheteDe(a, senhaA)))).toEqual([])
      expect(lista(await trocas(await bilheteDe(b, senhaB)))).toEqual([expect.objectContaining({ papel: 'professor', usada: false })])
    })
  })

  // ---------------------------------------------------------------------------------------------------------------------
  // Isolamento entre escolas (regra 10)
  // ---------------------------------------------------------------------------------------------------------------------

  describe('isolamento', () => {
    it('com o contexto da escola A, a credencial e a auditoria do aluno da B: a troca atualiza zero linhas, o aluno não é achado e a lista lê zero', async () => {
      const a = await sala.montar()
      const b = await sala.montar()
      const { aluno: doB, senha } = await alunoComProvisoria(b)
      const bilheteDoB = await bilheteDe(doB, senha)
      const dadosDoB = await bilhetes.verificar(bilheteDoB)
      if (dadosDoB === undefined) throw new Error('o bilhete de teste não confere')
      const antes = await credencialDe(doB.usuarioId)
      // O histórico da B existe: no contexto da B a lista acha, no da A não.
      await bancada.pool.query(
        `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id, depois, em)
         values ($1, $2, 'senha_provisoria.gerada', 'usuario', $3, gen_random_uuid(), jsonb_build_object('papel', 'professor'), now() - interval '2 days')`,
        [b.escolaId, b.professor.usuarioId, doB.usuarioId],
      )
      const lerNaEscola = <T>(escolaId: string, leitura: () => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId }, leitura)

      // No contexto da A, com todo id e a validade da B.
      expect(await lerNaEscola(a.escolaId, () => new CredencialMatriculaRepository(bancada.banco).paraATroca(doB.usuarioId, dadosDoB.provisoriaExpiraEm))).toBeUndefined()
      expect(await lerNaEscola(a.escolaId, () => bancada.banco.transaction((tx) => new CredencialMatriculaRepository(tx).trocarProvisoria(doB.usuarioId, dadosDoB.provisoriaExpiraEm, hashAntigo)))).toBe(false)
      expect(await lerNaEscola(a.escolaId, () => new AuditoriaRepository(bancada.banco).provisoriasAnterioresDoAluno(doB.usuarioId))).toEqual([])
      expect(await credencialDe(doB.usuarioId)).toEqual(antes)

      // Controle: no contexto da B, as mesmas três chamadas alcançam o aluno.
      expect(await lerNaEscola(b.escolaId, () => new CredencialMatriculaRepository(bancada.banco).paraATroca(doB.usuarioId, dadosDoB.provisoriaExpiraEm))).toMatchObject({ matricula: doB.matricula, provisoriaVale: true })
      expect(await lerNaEscola(b.escolaId, () => new AuditoriaRepository(bancada.banco).provisoriasAnterioresDoAluno(doB.usuarioId))).toHaveLength(1)
    })

    it('repository: a troca só grava a provisória do bilhete e só enquanto vale: a substituída e a vencida dão zero linhas, a vigente grava', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      const velha = (await bilhetes.verificar(await bilheteDe(aluno, senha)))?.provisoriaExpiraEm ?? ''
      const noRepository = (doBilhete: string) =>
        runInContext({ requisicaoId: randomUUID(), escolaId: s.escolaId }, () => bancada.banco.transaction((tx) => new CredencialMatriculaRepository(tx).trocarProvisoria(aluno.usuarioId, doBilhete, hashAntigo)))

      // Substituída: outra geração gravou outro vencimento, e o texto do bilhete antigo não é mais o da coluna.
      await recuar(aluno.usuarioId)
      await gerarSenha(s.coordenacao, aluno.usuarioId)
      expect(await noRepository(velha)).toBe(false)
      // Vencida: o texto é o da coluna, mas o vencimento já passou.
      expect(await noRepository(await vencer(aluno.usuarioId))).toBe(false)
      expect((await credencialDe(aluno.usuarioId)).senha_hash).toBeNull()
      // Vigente e igual à coluna: grava.
      expect(await noRepository(await valerPorMais(aluno.usuarioId))).toBe(true)
      expect((await credencialDe(aluno.usuarioId)).senha_hash).toBe(hashAntigo)
    })

    it('repository: a troca não grava se o aluno foi desativado, teve a eliminação agendada ou não é aluno, mesmo com a provisória do bilhete vigente', async () => {
      const s = await sala.montar()
      const { aluno } = await alunoComProvisoria(s)
      // Outro aluno ativo na escola: sem o filtro por aluno, o `exists` o enxergaria.
      await novoAluno(s)
      const doBilhete = await valerPorMais(aluno.usuarioId)
      const noRepository = (alunoId: string, vencimento: string) =>
        runInContext({ requisicaoId: randomUUID(), escolaId: s.escolaId }, () => bancada.banco.transaction((tx) => new CredencialMatriculaRepository(tx).trocarProvisoria(alunoId, vencimento, hashAntigo)))

      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [aluno.usuarioId])
      expect(await noRepository(aluno.usuarioId, doBilhete), 'desativado').toBe(false)
      await bancada.pool.query('update usuario set desativado_em = null where id = $1', [aluno.usuarioId])
      await bancada.pool.query("update usuario set eliminacao_agendada_em = now() + interval '7 days' where id = $1", [aluno.usuarioId])
      expect(await noRepository(aluno.usuarioId, doBilhete), 'eliminação agendada').toBe(false)
      await bancada.pool.query('update usuario set eliminacao_agendada_em = null where id = $1', [aluno.usuarioId])
      expect((await credencialDe(aluno.usuarioId)).senha_hash).toBeNull()

      const professor = await bancada.sessao(s.escolaId, 'professor')
      const { rows } = await bancada.pool.query<{ texto: string }>(
        `insert into credencial_matricula (escola_id, usuario_id, matricula, provisoria_hash, provisoria_expira_em)
         values ($1, $2, $3, $4, now() + interval '1 hour')
         returning to_char(provisoria_expira_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as texto`,
        [s.escolaId, professor.usuarioId, `prof-${randomUUID().slice(0, 12)}`, hashAntigo],
      )
      expect(await noRepository(professor.usuarioId, rows[0]?.texto ?? ''), 'não é aluno').toBe(false)

      // E o aluno de pé, sem nenhum dos três, grava.
      expect(await noRepository(aluno.usuarioId, doBilhete), 'aluno ativo').toBe(true)
    })

    it('a leitura das provisórias anteriores recusa sem escola no contexto, e o registro com papel fora do formato nunca vira o papel de outro', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s)
      await expect(new AuditoriaRepository(bancada.banco).provisoriasAnterioresDoAluno(aluno.usuarioId)).rejects.toBeInstanceOf(InvariantException)

      await bancada.pool.query(
        `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id, depois, em) values
           ($1, $2, 'senha_provisoria.gerada', 'usuario', $3, gen_random_uuid(), jsonb_build_object('papel', 'aluno'), now() - interval '3 days'),
           ($1, $2, 'senha_provisoria.gerada', 'usuario', $3, gen_random_uuid(), jsonb_build_object('papel', 'coordenador'), now() - interval '2 days')`,
        [s.escolaId, s.coordenacao.usuarioId, aluno.usuarioId],
      )
      await expect(runInContext({ requisicaoId: randomUUID(), escolaId: s.escolaId }, () => new AuditoriaRepository(bancada.banco).provisoriasAnterioresDoAluno(aluno.usuarioId))).rejects.toMatchObject({ motivo: 'dados_fora_do_schema' })
    })

    it('o bilhete da escola A com o aluno da B, assinado por nós: a troca e a lista o tratam como aluno inexistente', async () => {
      const a = await sala.montar()
      const b = await sala.montar()
      const { aluno: doB, senha } = await alunoComProvisoria(b)
      const dadosDoB = await bilhetes.verificar(await bilheteDe(doB, senha))
      if (dadosDoB === undefined) throw new Error('o bilhete de teste não confere')
      const cruzado = await bilhetes.emitir({ ...dadosDoB, escolaId: a.escolaId })

      expect((await trocar(cruzado)).status).toBe(401)
      expect((await trocas(cruzado)).status).toBe(401)
      expect((await credencialDe(doB.usuarioId)).provisoria_hash).not.toBeNull()
    })
  })

  // ---------------------------------------------------------------------------------------------------------------------
  // Corrida
  // ---------------------------------------------------------------------------------------------------------------------

  describe('corridas', () => {
    it('[P] duas trocas com o mesmo bilhete, as duas já na linha da credencial: uma grava e abre a sessão, a outra tem zero linhas e é recusada; um `.usada`', async () => {
      const s = await sala.montar()
      const { aluno, senha } = await alunoComProvisoria(s)
      const bilhete = await bilheteDe(aluno, senha)
      const sessoes = await sessoesAbertasDe(aluno.usuarioId)
      const parada = new WriteBlockTrigger(bancada.pool, {
        tabela: 'credencial_matricula',
        evento: 'update',
        quando: `new.usuario_id = '${aluno.usuarioId}'::uuid and old.provisoria_hash is not null and new.provisoria_hash is null`,
      })
      await parada.armar()
      try {
        const primeira = trocar(bilhete, SENHA_NOVA)
        await parada.esperarParadas(1)
        const segunda = trocar(bilhete, OUTRA_SENHA_NOVA)
        // A segunda também chegou ao `update` da credencial e espera a linha que a primeira segura; a primeira espera a parada do gatilho. Duas esperas de trava.
        await esperarNaTrava(bancada.pool, 'update "credencial_matricula"%', 2)
        await parada.soltar()
        const respostas = await Promise.all([primeira, segunda])

        expect(respostas.map((r) => r.status).sort()).toEqual([200, 401])
        const vencedora = respostas.find((r) => r.status === 200)
        expect(vencedora?.corpo['etapa']).toBe('pronta')
        expect(await sessoesAbertasDe(aluno.usuarioId)).toBe(sessoes + 1)
        expect(await auditoriasDe(aluno.usuarioId, 'senha_provisoria.usada')).toHaveLength(1)
        // A senha gravada é a da troca que ganhou, e só ela.
        const gravada = (await credencialDe(aluno.usuarioId)).senha_hash ?? ''
        const venceu = vencedora === respostas[0] ? SENHA_NOVA : OUTRA_SENHA_NOVA
        const perdeu = vencedora === respostas[0] ? OUTRA_SENHA_NOVA : SENHA_NOVA
        expect(await verify(gravada, venceu)).toBe(true)
        expect(await verify(gravada, perdeu)).toBe(false)
      } finally {
        await parada.desarmar()
      }
    })
  })
})
