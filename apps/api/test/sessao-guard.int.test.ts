import 'reflect-metadata'
import { createLogger, TokenIssuer, requireAnoEmCurso, RequirePermissao, SessaoRepository } from '@educa/core'
import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import { Controller, Get, Module, type INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { raizRepositorio } from '../../../tools/ci/executar.ts'
import { aguardarSaudavel, compose, composeOuFalha } from '../../../tools/testes/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { AppModule } from '../src/app.module.js'
import { configureApp } from '../src/configure-app.js'
import { executarOpsSessaoSintetica, type CommandDatabase } from '../src/ops/sessao-sintetica.js'
import { MOTIVO_SESSAO_SINTETICA_FORA_DO_LOCAL } from '../src/sessao/index.js'
import { testConfig } from './test-config.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'

const ambienteDeTeste = lerAmbienteDeTeste()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const emissor = new TokenIssuer(new TextEncoder().encode(ambienteDeTeste['IDENTIDADE_CHAVE_ASSINATURA']))
/** Limite de usuário baixo neste arquivo, para a rajada acima dele caber num teste. */
const LIMITE_DO_USUARIO = 8

/** Rota de turma, que o professor alcança e o aluno não, e que exige o ano letivo em curso. */
@Controller('teste-sessao')
class ControladorDoAno {
  @Get('ano')
  @RequirePermissao('turma', 'ler')
  ano(): { anoLetivoId: string } {
    return { anoLetivoId: requireAnoEmCurso() }
  }
}

interface Resposta {
  status: number
  corpo: { erro?: { codigo?: string; mensagem?: string; requisicaoId?: string } } & Record<string, unknown>
  retryAfter: string | null
}

describe('GuardaDeSessao: toda requisição autenticada é conferida contra a sessão gravada', () => {
  const bancada = new SessaoFixtures()
  let app: INestApplication
  let url: string
  let leituras: ReturnType<typeof vi.spyOn>

  async function pedir(rota: string, token?: string): Promise<Resposta> {
    const resposta = await fetch(`${url}${rota}`, token === undefined ? {} : { headers: { Authorization: `Bearer ${token}` } })
    return { status: resposta.status, corpo: (await resposta.json()) as Resposta['corpo'], retryAfter: resposta.headers.get('retry-after') }
  }

  const contexto = (token: string) => pedir('/v1/sistema/contexto', token)

  function esperarNaoAutenticado(resposta: Resposta): void {
    expect(resposta.status).toBe(401)
    expect(resposta.corpo).toEqual({ erro: { codigo: ErrorCode.NAO_AUTENTICADO, mensagem: MENSAGENS_DE_ERRO.NAO_AUTENTICADO, requisicaoId: expect.stringMatching(UUID) } })
  }

  const tokenCom = async (claims: { escolaId: string; usuarioId: string; sessaoId: string }) => (await emissor.emitir(claims)).token

  beforeAll(async () => {
    @Module({ imports: [AppModule.forRoot(testConfig({ ambiente: { LIMITE_REQ_USUARIO_MIN: String(LIMITE_DO_USUARIO) } }))], controllers: [ControladorDoAno] })
    class ModuloDeTeste {}
    app = await NestFactory.create(ModuloDeTeste, { logger: false })
    configureApp(app, createLogger({ servico: 'api-teste', nivel: 'silent' }))
    await app.listen(0, '127.0.0.1')
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
    leituras = vi.spyOn(app.get(SessaoRepository), 'lerParaGuarda')
  })

  afterAll(async () => {
    await app.close()
    await bancada.fechar()
  })

  describe('caminho feliz pelo comando ops:sessao-sintetica', () => {
    let escolaId: string
    let token: string

    beforeAll(async () => {
      escolaId = await bancada.escola()
      // O comando que o desenvolvedor e o cenário de carga usam, apontado para o banco de teste.
      const resultado = spawnSync('npm', ['run', '-s', 'ops:sessao-sintetica', '--', '--escola', escolaId, '--papel', 'professor'], {
        cwd: raizRepositorio,
        encoding: 'utf8',
        env: { ...process.env, BANCO_URL: urlDoBancoDeTeste() },
      })
      if (resultado.status !== 0) throw new Error(`ops:sessao-sintetica falhou (código ${String(resultado.status)})`)
      const linhas = resultado.stdout.trim().split('\n')
      expect(linhas).toHaveLength(1)
      token = linhas[0] ?? ''
    }, 180_000)

    it('o token do comando alcança GET /v1/sistema/contexto, e o contexto traz usuário, escola, papel e sessão da linha gravada', async () => {
      const resposta = await contexto(token)
      expect(resposta.status).toBe(200)
      const { rows } = await bancada.pool.query<{ sessao_id: string; usuario_id: string; papel: string }>(
        'select s.id as sessao_id, s.usuario_id, u.papel from sessao s join usuario u on u.escola_id = s.escola_id and u.id = s.usuario_id where s.escola_id = $1',
        [escolaId],
      )
      expect(rows).toHaveLength(1)
      expect(resposta.corpo).toEqual({ escolaId, usuarioId: rows[0]?.usuario_id, papel: 'professor', sessaoId: rows[0]?.sessao_id, anoLetivoId: null })
    })
  })

  describe('corte na requisição seguinte (RF5)', () => {
    it('borda: sessão encerrada no banco com o JWT ainda válido dá 401 na requisição seguinte', async () => {
      const sessao = await bancada.escolaComSessao('professor')
      expect((await contexto(sessao.token)).status).toBe(200)
      await bancada.pool.query("update sessao set encerrada_em = now(), motivo = 'saida' where escola_id = $1 and id = $2", [sessao.escolaId, sessao.sessaoId])
      esperarNaoAutenticado(await contexto(sessao.token))
      esperarNaoAutenticado(await contexto(await sessao.tokenNovo()))
    })

    it('borda: usuário desativado dá 401 na requisição seguinte, e o colega da mesma escola segue entrando', async () => {
      const escolaId = await bancada.escola()
      const [desativado, colega] = await bancada.sessoes(escolaId, { quantidade: 2 })
      if (desativado === undefined || colega === undefined) throw new Error('sessões não criadas')
      expect((await contexto(desativado.token)).status).toBe(200)
      await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [escolaId, desativado.usuarioId])
      esperarNaoAutenticado(await contexto(desativado.token))
      expect((await contexto(colega.token)).status).toBe(200)
    })

    it('borda: sessão expirada e sessão inativa além da inatividade da escola mais a tolerância dão 401', async () => {
      const escolaId = await bancada.escola()
      const [expirada, inativa, quase] = await bancada.sessoes(escolaId, { quantidade: 3 })
      if (expirada === undefined || inativa === undefined || quase === undefined) throw new Error('sessões não criadas')
      await bancada.pool.query("update sessao set expira_em = now() - interval '1 second' where id = $1", [expirada.sessaoId])
      // Aluno com inatividade padrão de 30 min: 35 min sem uso vence, 34 min ainda não.
      await bancada.pool.query("update sessao set ultimo_uso_em = now() - interval '35 minutes' where id = $1", [inativa.sessaoId])
      await bancada.pool.query("update sessao set ultimo_uso_em = now() - interval '34 minutes' where id = $1", [quase.sessaoId])
      esperarNaoAutenticado(await contexto(expirada.token))
      esperarNaoAutenticado(await contexto(inativa.token))
      expect((await contexto(quase.token)).status).toBe(200)
    })
  })

  describe('isolamento: a sessão é lida por (esc, sid), e o usuário dela precisa ser o sub', () => {
    let a: TestSessao
    let b: TestSessao

    beforeAll(async () => {
      a = await bancada.escolaComSessao('coordenador')
      b = await bancada.escolaComSessao('coordenador')
    })

    it('os tokens legítimos das duas escolas entram, cada um na própria escola', async () => {
      expect((await contexto(a.token)).corpo).toMatchObject({ escolaId: a.escolaId, usuarioId: a.usuarioId, sessaoId: a.sessaoId })
      expect((await contexto(b.token)).corpo).toMatchObject({ escolaId: b.escolaId, usuarioId: b.usuarioId, sessaoId: b.sessaoId })
    })

    it('JWT assinado à mão pelo EmissorDeToken com sub de A e esc de B é recusado, com linhas existentes nas duas escolas', async () => {
      // Com a sessão de A: quebraria se a leitura fosse só pelo sid, sem a escola.
      esperarNaoAutenticado(await contexto(await tokenCom({ escolaId: b.escolaId, usuarioId: a.usuarioId, sessaoId: a.sessaoId })))
      // Com a sessão de B: quebraria sem conferir que o usuário da sessão é o sub.
      esperarNaoAutenticado(await contexto(await tokenCom({ escolaId: b.escolaId, usuarioId: a.usuarioId, sessaoId: b.sessaoId })))
      // E o inverso, sub de B com esc de A.
      esperarNaoAutenticado(await contexto(await tokenCom({ escolaId: a.escolaId, usuarioId: b.usuarioId, sessaoId: b.sessaoId })))
      esperarNaoAutenticado(await contexto(await tokenCom({ escolaId: a.escolaId, usuarioId: b.usuarioId, sessaoId: a.sessaoId })))
    })

    it('borda: sid de outro usuário da mesma escola é recusado', async () => {
      const [primeiro, segundo] = await bancada.sessoes(a.escolaId, { papel: 'professor', quantidade: 2 })
      if (primeiro === undefined || segundo === undefined) throw new Error('sessões não criadas')
      esperarNaoAutenticado(await contexto(await tokenCom({ escolaId: a.escolaId, usuarioId: primeiro.usuarioId, sessaoId: segundo.sessaoId })))
      expect((await contexto(primeiro.token)).status).toBe(200)
    })

    it('sid que não existe em escola nenhuma dá o mesmo 401', async () => {
      esperarNaoAutenticado(await contexto(await tokenCom({ escolaId: a.escolaId, usuarioId: a.usuarioId, sessaoId: randomUUID() })))
    })
  })

  describe('carga: a ordem JWT → limite → sessão poupa o Postgres (regra 80)', () => {
    it('JWT inválido não gera leitura de sessão', async () => {
      const sessao = await bancada.escolaComSessao()
      const [cabecalho, corpo] = sessao.token.split('.')
      const invalidos = [`${sessao.token}x`, `${cabecalho}.${corpo}.assinatura-trocada`, 'a.b.c']
      leituras.mockClear()
      const respostas = await Promise.all(invalidos.flatMap((token) => [contexto(token), pedir('/teste-sessao/ano', token)]))
      for (const resposta of respostas) esperarNaoAutenticado(resposta)
      expect(leituras).toHaveBeenCalledTimes(0)
    })

    it('rajada acima do limite do usuário: só as requisições dentro do limite leem a sessão, e as recusadas com 429 não', async () => {
      const sessao = await bancada.escolaComSessao()
      leituras.mockClear()
      const respostas: Resposta[] = []
      for (let pedido = 0; pedido < LIMITE_DO_USUARIO + 12; pedido++) respostas.push(await contexto(sessao.token))
      expect(respostas.filter((resposta) => resposta.status === 200)).toHaveLength(LIMITE_DO_USUARIO)
      expect(respostas.filter((resposta) => resposta.status === 429)).toHaveLength(12)
      expect(leituras).toHaveBeenCalledTimes(LIMITE_DO_USUARIO)
    })
  })

  describe('escola sem ano letivo em curso', () => {
    it('autentica com o ano nulo, e exigirAnoEmCurso() falha fechado com 404; o ano em curso de outra escola não vaza', async () => {
      const semAno = await bancada.escolaComSessao('professor')
      const comAno = await bancada.escolaComSessao('professor')
      const { rows } = await bancada.pool.query<{ id: string }>(
        "insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id",
        [comAno.escolaId],
      )
      const anoDaOutra = rows[0]?.id

      const doContexto = await contexto(semAno.token)
      expect(doContexto.status).toBe(200)
      expect(doContexto.corpo['anoLetivoId']).toBeNull()
      const semAnoEmCurso = await pedir('/teste-sessao/ano', semAno.token)
      expect(semAnoEmCurso.status).toBe(404)
      expect(semAnoEmCurso.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)

      expect((await contexto(comAno.token)).corpo['anoLetivoId']).toBe(anoDaOutra)
      expect((await pedir('/teste-sessao/ano', comAno.token)).corpo).toEqual({ anoLetivoId: anoDaOutra })
    })

    it('virada de ano: só o ano em_curso vale; escola só com ano encerrado e planejado fica sem ano, e com encerrado e em curso fica com o em curso', async () => {
      const inserirAno = (escolaId: string, ano: number, situacao: string) =>
        bancada.pool.query<{ id: string }>("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, $2::smallint, make_date($2::int, 2, 1), make_date($2::int, 12, 15), $3) returning id", [escolaId, ano, situacao])

      const entreAnos = await bancada.escolaComSessao('professor')
      await inserirAno(entreAnos.escolaId, 2025, 'encerrado')
      await inserirAno(entreAnos.escolaId, 2027, 'planejado')
      expect((await contexto(entreAnos.token)).corpo['anoLetivoId']).toBeNull()
      const semAnoEmCurso = await pedir('/teste-sessao/ano', entreAnos.token)
      expect(semAnoEmCurso.status).toBe(404)
      expect(semAnoEmCurso.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)

      const virada = await bancada.escolaComSessao('professor')
      await inserirAno(virada.escolaId, 2025, 'encerrado')
      const { rows } = await inserirAno(virada.escolaId, 2026, 'em_curso')
      const emCurso = rows[0]?.id
      expect(emCurso).toMatch(UUID)
      expect((await contexto(virada.token)).corpo['anoLetivoId']).toBe(emCurso)
      expect((await pedir('/teste-sessao/ano', virada.token)).corpo).toEqual({ anoLetivoId: emCurso })
    })

    it('permissão: o aluno na rota de turma recebe o mesmo 404 de rota inexistente', async () => {
      const aluno = await bancada.escolaComSessao('aluno')
      const semPermissao = await pedir('/teste-sessao/ano', aluno.token)
      const inexistente = await pedir('/teste-sessao/nao-existe', aluno.token)
      expect(semPermissao.status).toBe(404)
      expect({ ...semPermissao.corpo.erro, requisicaoId: undefined }).toEqual({ ...inexistente.corpo.erro, requisicaoId: undefined })
    })
  })

  describe('falha: o Postgres fora não desloga ninguém', () => {
    it('Postgres pausado responde 503 INDISPONIVEL_TENTE_DE_NOVO com Retry-After, nunca 401, e a mesma sessão volta a entrar', async () => {
      const escolaId = await bancada.escola()
      // Duas sessões da escola: a da queda, e a que espera o pool reconectar sem gastar o limite de usuário da primeira.
      const [sessao, espera] = await bancada.sessoes(escolaId, { quantidade: 2 })
      if (sessao === undefined || espera === undefined) throw new Error('sessões não criadas')
      // A configuração de limites da escola fica guardada: a espera medida é só a da leitura de sessão.
      expect((await contexto(sessao.token)).status).toBe(200)
      composeOuFalha('pause', 'postgres')
      try {
        const respostas = await Promise.all([contexto(sessao.token), contexto(sessao.token)])
        for (const resposta of respostas) {
          expect(resposta.status).toBe(503)
          expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
          expect(Number(resposta.retryAfter)).toBeGreaterThanOrEqual(1)
        }
      } finally {
        compose('unpause', 'postgres')
        await aguardarSaudavel('postgres')
      }
      await expect.poll(async () => (await contexto(espera.token)).status, { timeout: 30_000, interval: 500 }).toBe(200)
      // A sessão que recebeu o 503 não foi deslogada: o mesmo token entra.
      expect((await contexto(sessao.token)).status).toBe(200)
    })
  })
})

describe('ops:sessao-sintetica', () => {
  const bancada = new SessaoFixtures()

  afterAll(async () => {
    await bancada.fechar()
  })

  async function rodar(argumentos: string[], ambiente: Record<string, string | undefined>, abrirBanco?: (ambiente: Record<string, string | undefined>) => CommandDatabase) {
    let saida = ''
    let erro = ''
    const codigo = await executarOpsSessaoSintetica(argumentos, ambiente, { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) }, abrirBanco)
    return { codigo, saida, erro }
  }

  const bancoDaBancada = (): CommandDatabase => ({ banco: bancada.banco, fechar: async () => undefined })

  it.each([
    ['AMBIENTE=staging', { ...ambienteDeTeste, AMBIENTE: 'staging' }],
    ['AMBIENTE=producao', { ...ambienteDeTeste, AMBIENTE: 'producao' }],
    ['AMBIENTE ausente', { ...ambienteDeTeste, AMBIENTE: undefined }],
  ])('borda: com %s, sai com erro antes de abrir o banco, e nenhuma sessão é criada', async (_caso, ambiente) => {
    const escolaId = await bancada.escola()
    const abrirBanco = vi.fn(bancoDaBancada)
    const resultado = await rodar(['--escola', escolaId, '--papel', 'coordenador'], ambiente, abrirBanco)
    expect(resultado.codigo).toBe(2)
    expect(resultado.saida).toBe('')
    expect(resultado.erro).toContain('AMBIENTE')
    expect(resultado.erro).toContain(MOTIVO_SESSAO_SINTETICA_FORA_DO_LOCAL)
    expect(abrirBanco).not.toHaveBeenCalled()
    const { rows } = await bancada.pool.query('select 1 from sessao where escola_id = $1', [escolaId])
    expect(rows).toEqual([])
  })

  it('borda: o comando de verdade, com AMBIENTE=producao no ambiente, sai com código 2 e sem token', () => {
    const resultado = spawnSync('npm', ['run', '-s', 'ops:sessao-sintetica', '--', '--escola', randomUUID(), '--papel', 'aluno'], {
      cwd: raizRepositorio,
      encoding: 'utf8',
      env: { ...process.env, AMBIENTE: 'producao', BANCO_URL: urlDoBancoDeTeste() },
    })
    expect(resultado.status).toBe(2)
    expect(resultado.stdout).toBe('')
    expect(resultado.stderr).toContain(MOTIVO_SESSAO_SINTETICA_FORA_DO_LOCAL)
  }, 180_000)

  it('--quantidade cria usuários distintos na escola pedida; aluno sem conta, professor com conta sintética; só os tokens saem', async () => {
    const escolaId = await bancada.escola()
    const alunos = await rodar(['--escola', escolaId, '--papel', 'aluno', '--quantidade', '3'], ambienteDeTeste, bancoDaBancada)
    const professores = await rodar(['--escola', escolaId.toUpperCase(), '--papel', 'professor', '--quantidade', '2'], ambienteDeTeste, bancoDaBancada)
    expect([alunos.codigo, professores.codigo]).toEqual([0, 0])
    expect(alunos.saida.trim().split('\n')).toHaveLength(3)
    expect(professores.saida.trim().split('\n')).toHaveLength(2)
    for (const linha of [...alunos.saida.trim().split('\n'), ...professores.saida.trim().split('\n')]) expect(linha).toMatch(/^ey[\w-]+\.[\w-]+\.[\w-]+$/)

    const { rows } = await bancada.pool.query<{ papel: string; com_conta: boolean; metodo: string; nome: string }>(
      'select u.papel, u.conta_id is not null as com_conta, s.metodo, u.nome from usuario u join sessao s on s.escola_id = u.escola_id and s.usuario_id = u.id where u.escola_id = $1 order by u.papel',
      [escolaId],
    )
    expect(rows).toEqual([
      ...Array.from({ length: 3 }, () => ({ papel: 'aluno', com_conta: false, metodo: 'matricula', nome: 'Pessoa sintética' })),
      ...Array.from({ length: 2 }, () => ({ papel: 'professor', com_conta: true, metodo: 'email', nome: 'Pessoa sintética' })),
    ])
  })

  it('borda: escola inexistente sai com NAO_ENCONTRADO, sem o id na mensagem', async () => {
    const escolaId = randomUUID()
    const resultado = await rodar(['--escola', escolaId, '--papel', 'aluno'], ambienteDeTeste, bancoDaBancada)
    expect(resultado.codigo).toBe(1)
    expect(resultado.erro).toContain(ErrorCode.NAO_ENCONTRADO)
    expect(resultado.erro).not.toContain(escolaId)
  })

  it.each([
    ['sem --escola', ['--papel', 'aluno']],
    ['escola fora do formato', ['--escola', 'Colégio Exemplo', '--papel', 'aluno']],
    ['papel desconhecido', ['--escola', randomUUID(), '--papel', 'rede']],
    ['quantidade zero', ['--escola', randomUUID(), '--papel', 'aluno', '--quantidade', '0']],
    ['quantidade acima do máximo', ['--escola', randomUUID(), '--papel', 'aluno', '--quantidade', '5001']],
    ['opção desconhecida', ['--escola', randomUUID(), '--papel', 'aluno', '--nome', 'Enzo']],
  ])('recusa %s com código 2, citando a opção e não o valor', async (_caso, argumentos) => {
    const abrirBanco = vi.fn(bancoDaBancada)
    const resultado = await rodar(argumentos, ambienteDeTeste, abrirBanco)
    expect(resultado.codigo).toBe(2)
    expect(resultado.erro).toMatch(/^Opção inválida ou ausente: --/)
    expect(resultado.erro).not.toMatch(/Enzo|Colégio/)
    expect(abrirBanco).not.toHaveBeenCalled()
  })
})
