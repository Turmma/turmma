import 'reflect-metadata'
import { currentContext, createLogger, OperadorTokenIssuer, OPERACAO_ROUTE_KEY, type Database } from '@educa/core'
import { ErrorCode, euDoOperadorResponseSchema, MENSAGENS_DE_ERRO } from '@educa/shared'
import { Controller, Get, Inject, Module, SetMetadata, type DynamicModule, type INestApplication, type Type } from '@nestjs/common'
import { DiscoveryService, NestFactory } from '@nestjs/core'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { isDeepStrictEqual } from 'node:util'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { aguardarSaudavel, compose, composeOuFalha } from '../../../tools/testes/compose.ts'
import { AppModule } from '../src/app.module.js'
import { BANCO } from '../src/database.module.js'
import { configurarAplicacao } from '../src/configure-app.js'
import { DisciplinaRepository } from '../src/estrutura/disciplina/disciplina.repository.js'
import { provedoresDaGuardaDeOperador, SESSOES_DE_OPERADOR, type LeituraDaSessaoDeOperador } from '../src/operacao/operador.guard.js'
import { RotaDeOperacao } from '../src/operacao/decorators.js'
import { executarOpsOperador } from '../src/ops/operador.js'
import { EmissorDeDesafio } from '../src/credencial/index.js'
import { cookieDeRenovacao } from './test-api.js'
import { configuracaoDeTeste } from './test-config.js'
import { caminhoConcreto, daOperacao, ROTAS_COM_SESSAO_DE_OPERADOR, rotasDe, rotasDeOperacaoSemGuarda, type RotaRegistrada } from './registered-routes.js'
import { BancadaDeOperadores, type SessaoDeOperadorDeTeste } from './operador-session.fixture.js'
import { BancadaDeSessoes } from './sessao.fixture.js'

const ambienteDeTeste = lerAmbienteDeTeste()
const CHAVE = new TextEncoder().encode(ambienteDeTeste['IDENTIDADE_CHAVE_ASSINATURA'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

interface Resposta {
  readonly status: number
  readonly corpo: unknown
  readonly retryAfter: string | null
  readonly cacheControl: string | null
}

type Cabecalhos = Record<string, string>

async function pedir(url: string, verbo: string, caminho: string, cabecalhos: Cabecalhos = {}): Promise<Resposta> {
  const resposta = await fetch(`${url}${caminho}`, { method: verbo, headers: cabecalhos })
  const texto = await resposta.text()
  return { status: resposta.status, corpo: texto === '' ? undefined : (JSON.parse(texto) as unknown), retryAfter: resposta.headers.get('retry-after'), cacheControl: resposta.headers.get('cache-control') }
}

const bearer = (token: string): Cabecalhos => ({ Authorization: `Bearer ${token}` })
const eu = (url: string, token: string) => pedir(url, 'GET', '/v1/operacao/eu', bearer(token))

/** O corpo sem o `requisicaoId`, que muda a cada requisição: o resto tem de ser igual, byte a byte. */
function semRequisicaoId(corpo: unknown): unknown {
  if (typeof corpo !== 'object' || corpo === null || !('erro' in corpo)) return corpo
  const { requisicaoId: _id, ...erro } = (corpo as { erro: Record<string, unknown> }).erro
  return { erro }
}

function esperarErro(resposta: Resposta, status: number, codigo: ErrorCode): void {
  expect(resposta.status).toBe(status)
  expect(resposta.corpo).toEqual({ erro: { codigo, mensagem: MENSAGENS_DE_ERRO[codigo], requisicaoId: expect.stringMatching(UUID) } })
}

/**
 * As rotas em que a credencial responde diferente de uma rota inexistente, em status ou corpo, como `VERBO caminho`.
 * Cada rota é comparada com uma inexistente do mesmo verbo, sob o mesmo prefixo, com a mesma credencial. Vazia é o
 * esperado; a inexistente precisa ser 404, senão a comparação não prova nada.
 */
async function diferentesDaInexistente(url: string, rotas: readonly RotaRegistrada[], cabecalhos: Cabecalhos, prefixo: string): Promise<string[]> {
  const diferentes: string[] = []
  for (const rota of rotas) {
    const [naRota, naInexistente] = await Promise.all([
      pedir(url, rota.verbo, caminhoConcreto(rota.caminho), cabecalhos),
      pedir(url, rota.verbo, `${prefixo}/nao-existe-${randomUUID()}`, cabecalhos),
    ])
    expect(naInexistente.status).toBe(404)
    if (naRota.status !== naInexistente.status || !isDeepStrictEqual(semRequisicaoId(naRota.corpo), semRequisicaoId(naInexistente.corpo))) diferentes.push(`${rota.verbo} ${rota.caminho}`)
  }
  return diferentes
}

async function subir(modulo: Type | DynamicModule): Promise<{ app: INestApplication; url: string }> {
  const app = await NestFactory.create(modulo, { logger: false })
  configurarAplicacao(app, createLogger({ servico: 'api-teste', nivel: 'silent' }))
  await app.listen(0, '127.0.0.1')
  return { app, url: `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}` }
}

/** As rotas que a aplicação montada registrou, pelo `DiscoveryService` dela: a lista não é escrita à mão. */
function rotasRegistradas(app: INestApplication): RotaRegistrada[] {
  const controladores = app
    .get(DiscoveryService)
    .getControllers()
    .map((embrulho) => embrulho.metatype)
    .filter((metatipo): metatipo is Type => typeof metatipo === 'function')
  return rotasDe(controladores)
}

/** A rota da operação com o marcador e sem a guarda: o que "tirar a guarda de um handler" deixa (C48). */
@Controller('v1/operacao/teste-sem-guarda')
class SemGuardaController {
  @Get()
  @SetMetadata(OPERACAO_ROUTE_KEY, true)
  obter(): { alcancou: true } {
    return { alcancou: true }
  }
}

/** Uma rota de operador que chama, por engano, um repository de escola (C49). Devolve o que o contexto tinha e o erro. */
@Controller('v1/operacao/teste-escola')
class EscolaNaOperacaoController {
  constructor(@Inject(BANCO) private readonly banco: Database) {}

  @Get()
  @RotaDeOperacao()
  async obter(): Promise<{ camposDoContexto: string[]; operadorId: string | undefined; erro: string | undefined }> {
    const contexto = currentContext()
    const camposDoContexto = Object.keys(contexto ?? {}).sort()
    try {
      await new DisciplinaRepository(this.banco).listar({ limite: 1 })
      return { camposDoContexto, operadorId: contexto?.operadorId, erro: undefined }
    } catch (erro) {
      return { camposDoContexto, operadorId: contexto?.operadorId, erro: erro instanceof Error ? erro.message : 'erro sem mensagem' }
    }
  }
}

describe('área da operação: as cercas entre a operação e a escola (tarefa 4.0)', () => {
  const escolas = new BancadaDeSessoes()
  const operadores = new BancadaDeOperadores()
  let app: INestApplication
  let url: string
  let rotas: RotaRegistrada[]

  beforeAll(async () => {
    ;({ app, url } = await subir(AppModule.com(configuracaoDeTeste())))
    rotas = rotasRegistradas(app)
  })

  afterAll(async () => {
    await app.close()
    await operadores.fechar()
    await escolas.fechar()
  })

  describe('GET /v1/operacao/eu', () => {
    it('devolve o apelido e o nome do operador da sessão, só eles, com no-store', async () => {
      const sessao = await operadores.operadorComSessao()
      const resposta = await eu(url, sessao.token)
      expect(resposta.status).toBe(200)
      expect(resposta.corpo).toStrictEqual({ apelido: sessao.apelido, nome: sessao.nome })
      expect(euDoOperadorResponseSchema.safeParse(resposta.corpo).success).toBe(true)
      expect(resposta.cacheControl).toBe('no-store')
    })

    it('o contrato é estrito: campo a mais não passa', () => {
      expect(euDoOperadorResponseSchema.safeParse({ apelido: 'ana-ops', nome: 'Ana', email: 'ana@turmma.invalid' }).success).toBe(false)
      expect(euDoOperadorResponseSchema.safeParse({ apelido: 'ana-ops', nome: 'Ana', id: randomUUID() }).success).toBe(false)
    })
  })

  describe('C46: nenhuma credencial de escola alcança rota da operação com sessão', () => {
    it('sessão de coordenador, professor e aluno, desafio, cookie de escola e nenhuma credencial: toda rota @RotaDeOperacao responde igual a rota inexistente', async () => {
      const daOperacaoComSessao = rotas.filter((rota) => rota.marcador === 'rota')
      // I3 (A0b): a varredura enxerga exatamente o `/eu` e as oito rotas do painel, com o corpo que for: a guarda responde
      // antes dele.
      expect(daOperacaoComSessao.map((rota) => `${rota.verbo} ${rota.caminho}`).toSorted()).toEqual(ROTAS_COM_SESSAO_DE_OPERADOR)
      expect(daOperacaoComSessao.every(daOperacao)).toBe(true)

      const escolaId = await escolas.escola()
      const coordenador = await escolas.sessao(escolaId, 'coordenador')
      const professor = await escolas.sessao(escolaId, 'professor')
      const aluno = await escolas.sessao(escolaId, 'aluno')
      // Os três são sessões válidas: sem isso, o 404 poderia ser só de token recusado.
      for (const sessao of [coordenador, professor, aluno]) expect((await pedir(url, 'GET', '/v1/eu', bearer(sessao.token))).status).toBe(200)
      const desafio = await new EmissorDeDesafio(CHAVE).emitir({ contaId: randomUUID(), etapa: 'mfa', mfaCumprido: false })
      const cookie = await cookieDeRenovacao(escolas, coordenador)

      const credenciais: Record<string, Cabecalhos> = {
        coordenador: bearer(coordenador.token),
        professor: bearer(professor.token),
        aluno: bearer(aluno.token),
        desafio: bearer(desafio),
        cookie: { Cookie: cookie },
        nenhuma: {},
      }
      for (const [nome, cabecalhos] of Object.entries(credenciais)) {
        expect(await diferentesDaInexistente(url, daOperacaoComSessao, cabecalhos, '/v1/operacao'), nome).toEqual([])
      }
    })
  })

  describe('C46 (entradas): nenhuma credencial de escola produz sessão de operador pelas sete rotas de entrada', () => {
    /** O corpo que cada entrada aceita, com a credencial de escola no lugar do token, do desafio e da senha. */
    function corpoCom(caminho: string, valor: string): unknown {
      switch (caminho) {
        case '/v1/operacao/convite/consultar':
          return { token: valor }
        case '/v1/operacao/convite/aceitar':
          return { token: valor, senha: `senha-${valor.slice(0, 20)}` }
        case '/v1/operacao/sessao/email':
          return { email: 'coordenacao@escola-sintetica.invalid', senha: valor.slice(0, 100) }
        case '/v1/operacao/sessao/mfa/configurar':
          return { desafio: valor }
        case '/v1/operacao/sessao/mfa':
          return { desafio: valor, codigo: '123456' }
        default:
          return undefined
      }
    }

    it('sessão de coordenador, professor e aluno, desafio e cookie de escola, no cabeçalho e no corpo: nenhuma resposta traz acesso, desafio ou cookie de operador, e nenhuma sessão de operador nasce', async () => {
      const entradas = rotas.filter((rota) => rota.marcador === 'entrada')
      // A lista é a gerada das rotas registradas, e tem as sete de entrada.
      expect(entradas.map((rota) => `${rota.verbo} ${rota.caminho}`).sort()).toEqual(
        [
          'POST /v1/operacao/convite/aceitar',
          'POST /v1/operacao/convite/consultar',
          'POST /v1/operacao/sessao/email',
          'POST /v1/operacao/sessao/mfa',
          'POST /v1/operacao/sessao/mfa/configurar',
          'POST /v1/operacao/sessao/renovar',
          'POST /v1/operacao/sessao/sair',
        ].sort(),
      )
      const escolaId = await escolas.escola()
      const [coordenador, professor, aluno] = await Promise.all([escolas.sessao(escolaId, 'coordenador'), escolas.sessao(escolaId, 'professor'), escolas.sessao(escolaId, 'aluno')])
      if (coordenador === undefined || professor === undefined || aluno === undefined) throw new Error('sessões não criadas')
      const desafio = await new EmissorDeDesafio(CHAVE).emitir({ contaId: randomUUID(), etapa: 'mfa', mfaCumprido: false })
      const cookie = await cookieDeRenovacao(escolas, coordenador)
      const valorDoCookieDeEscola = cookie.slice(cookie.indexOf('=') + 1)
      const credenciais: Array<{ nome: string; valor: string; cabecalhos: Cabecalhos }> = [
        { nome: 'coordenador', valor: coordenador.token, cabecalhos: bearer(coordenador.token) },
        { nome: 'professor', valor: professor.token, cabecalhos: bearer(professor.token) },
        { nome: 'aluno', valor: aluno.token, cabecalhos: bearer(aluno.token) },
        { nome: 'desafio', valor: desafio, cabecalhos: bearer(desafio) },
        { nome: 'cookie', valor: valorDoCookieDeEscola, cabecalhos: { Cookie: cookie } },
        // O refresh da escola com o nome do cookie do operador: o hash não casa com sessão de operador nenhuma.
        { nome: 'cookie como operador', valor: valorDoCookieDeEscola, cabecalhos: { Cookie: `turmma_operacao=${valorDoCookieDeEscola}` } },
      ]
      const sessoesDeOperador = async () => (await operadores.pool.query<{ total: number }>('select count(*)::int as total from sessao_operador')).rows[0]?.total
      const antes = await sessoesDeOperador()

      const produziram: string[] = []
      for (const credencial of credenciais) {
        for (const rota of entradas) {
          const corpo = corpoCom(rota.caminho, credencial.valor)
          const resposta = await fetch(`${url}${rota.caminho}`, {
            method: rota.verbo,
            headers: { ...credencial.cabecalhos, ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
            ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
          })
          const texto = await resposta.text()
          const cookieDeOperador = resposta.headers.getSetCookie().some((linha) => /^turmma_operacao=[^;]/.test(linha))
          if (resposta.ok && resposta.status !== 204) produziram.push(`${credencial.nome} ${rota.caminho} ${String(resposta.status)}`)
          if (/"(?:token|desafio)"/.test(texto) || cookieDeOperador) produziram.push(`${credencial.nome} ${rota.caminho}: ${texto}`)
        }
      }
      expect(produziram).toEqual([])
      expect(await sessoesDeOperador()).toBe(antes)
      // A sessão de escola cujo cookie foi usado continua viva: a saída do operador não a encerra.
      expect((await pedir(url, 'GET', '/v1/eu', bearer(coordenador.token))).status).toBe(200)
    })
  })

  describe('C47: credencial de operador não alcança rota de escola com sessão', () => {
    it('o token de operador, em toda rota de escola que exige sessão, responde igual a rota inexistente', async () => {
      const sessao = await operadores.operadorComSessao()
      expect((await eu(url, sessao.token)).status).toBe(200)
      const daEscolaComSessao = rotas.filter((rota) => rota.marcador === undefined && !rota.anonima)
      // A lista é a das rotas registradas, e alcança as do F1 que um operador mais cobiçaria.
      expect(daEscolaComSessao.map((rota) => `${rota.verbo} ${rota.caminho}`)).toEqual(expect.arrayContaining(['GET /v1/eu', 'GET /v1/turmas', 'POST /v1/sessao/escola']))
      expect(await diferentesDaInexistente(url, daEscolaComSessao, bearer(sessao.token), '/v1')).toEqual([])
    })
  })

  describe('a conferência da sessão de operador', () => {
    it('C6 (parte): depois de `ops:operador desativar`, a sessão aberta recebe SESSAO_ENCERRADA na requisição seguinte, e a do outro operador segue', async () => {
      const quemDesativa = await operadores.operadorComSessao()
      const desativado = await operadores.operadorComSessao()
      expect((await eu(url, desativado.token)).status).toBe(200)
      let erro = ''
      const codigo = await executarOpsOperador(['desativar', '--apelido', desativado.apelido], { ...ambienteDeTeste, OPERADOR: quemDesativa.apelido }, { saida: () => undefined, erro: (texto) => (erro += texto) })
      expect({ codigo, erro }).toEqual({ codigo: 0, erro: '' })
      esperarErro(await eu(url, desativado.token), 401, ErrorCode.SESSAO_ENCERRADA)
      expect((await eu(url, quemDesativa.token)).status).toBe(200)
    })

    it('sessão encerrada, 8 h vencidas e 30 min parada dão SESSAO_ENCERRADA; 29 min parada ainda entra', async () => {
      const [encerrada, oitoHoras, parada, quase] = await Promise.all([1, 2, 3, 4].map(() => operadores.operadorComSessao()))
      if (encerrada === undefined || oitoHoras === undefined || parada === undefined || quase === undefined) throw new Error('sessões não criadas')
      await operadores.pool.query(`update sessao_operador set encerrada_em = now(), motivo = 'saida' where id = $1`, [encerrada.sessaoId])
      await operadores.pool.query(`update sessao_operador set criada_em = now() - interval '9 hours', expira_em = now() - interval '1 second' where id = $1`, [oitoHoras.sessaoId])
      await operadores.pool.query(`update sessao_operador set ultimo_uso_em = now() - interval '31 minutes' where id = $1`, [parada.sessaoId])
      await operadores.pool.query(`update sessao_operador set ultimo_uso_em = now() - interval '29 minutes' where id = $1`, [quase.sessaoId])
      for (const sessao of [encerrada, oitoHoras, parada]) esperarErro(await eu(url, sessao.token), 401, ErrorCode.SESSAO_ENCERRADA)
      expect((await eu(url, quase.token)).status).toBe(200)
    })

    it('o token só vale para a sessão do próprio operador: o `sid` de outro operador dá SESSAO_ENCERRADA, e não a sessão dele', async () => {
      // As duas sessões e os dois operadores valem: só a cláusula do operador na leitura da sessão recusa a mistura.
      const [dono, outro] = await Promise.all([operadores.operadorComSessao(), operadores.operadorComSessao()])
      expect((await eu(url, dono.token)).status).toBe(200)
      expect((await eu(url, outro.token)).status).toBe(200)
      // Mesmo emissor e mesma chave, com o `sub` de um operador e o `sid` do outro.
      const misturado = (await new OperadorTokenIssuer(CHAVE).emitir({ operadorId: outro.operadorId, sessaoId: dono.sessaoId })).token
      esperarErro(await eu(url, misturado), 401, ErrorCode.SESSAO_ENCERRADA)
    })

    it('borda: acesso de 10 min vencido com a sessão viva dá ACESSO_VENCIDO, e não SESSAO_ENCERRADA; com a sessão encerrada, SESSAO_ENCERRADA', async () => {
      const sessao = await operadores.operadorComSessao()
      const vencido = await sessao.tokenEm(new Date(Date.now() - 11 * 60_000))
      esperarErro(await eu(url, vencido), 401, ErrorCode.ACESSO_VENCIDO)
      // A sessão continua viva: o token novo entra.
      expect((await eu(url, sessao.token)).status).toBe(200)
      await operadores.pool.query(`update sessao_operador set encerrada_em = now(), motivo = 'saida' where id = $1`, [sessao.sessaoId])
      esperarErro(await eu(url, vencido), 401, ErrorCode.SESSAO_ENCERRADA)
    })

    it('concorrência: 20 requisições juntas na mesma sessão gravam `ultimoUsoEm` uma vez só no minuto, e o minuto seguinte grava de novo', async () => {
      const sessao = await operadores.operadorComSessao()
      const leitura = app.get<LeituraDaSessaoDeOperador>(SESSOES_DE_OPERADOR)
      const marcacoes = vi.spyOn(leitura, 'marcarUsoDaSessao')
      try {
        const gravadas = async (): Promise<boolean[]> => Promise.all(marcacoes.mock.results.map((resultado) => resultado.value as Promise<boolean>))
        await operadores.pool.query(`update sessao_operador set ultimo_uso_em = now() - interval '2 minutes' where id = $1`, [sessao.sessaoId])
        const respostas = await Promise.all(Array.from({ length: 20 }, () => eu(url, sessao.token)))
        expect(respostas.map((resposta) => resposta.status)).toEqual(Array.from({ length: 20 }, () => 200))
        expect(marcacoes).toHaveBeenCalledTimes(20)
        expect((await gravadas()).filter(Boolean)).toHaveLength(1)
        const { rows } = await operadores.pool.query<{ recente: boolean }>(`select ultimo_uso_em > now() - interval '30 seconds' as recente from sessao_operador where id = $1`, [sessao.sessaoId])
        expect(rows[0]?.recente).toBe(true)

        // Mais 20 no mesmo minuto: nenhuma grava.
        marcacoes.mockClear()
        await Promise.all(Array.from({ length: 20 }, () => eu(url, sessao.token)))
        expect(marcacoes).toHaveBeenCalledTimes(20)
        expect((await gravadas()).filter(Boolean)).toHaveLength(0)

        // Passado o minuto, a próxima grava.
        marcacoes.mockClear()
        await operadores.pool.query(`update sessao_operador set ultimo_uso_em = now() - interval '61 seconds' where id = $1`, [sessao.sessaoId])
        await Promise.all(Array.from({ length: 5 }, () => eu(url, sessao.token)))
        expect((await gravadas()).filter(Boolean)).toHaveLength(1)
      } finally {
        marcacoes.mockRestore()
      }
    })

    it('borda: Postgres parado na conferência dá 503 INDISPONIVEL_TENTE_DE_NOVO com Retry-After, nunca 401 nem 404, e a sessão volta a entrar', async () => {
      const sessao = await operadores.operadorComSessao()
      expect((await eu(url, sessao.token)).status).toBe(200)
      composeOuFalha('pause', 'postgres')
      try {
        const respostas = await Promise.all([eu(url, sessao.token), eu(url, sessao.token)])
        for (const resposta of respostas) {
          esperarErro(resposta, 503, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
          expect(Number(resposta.retryAfter)).toBeGreaterThanOrEqual(1)
        }
      } finally {
        compose('unpause', 'postgres')
        await aguardarSaudavel('postgres')
      }
      await expect.poll(async () => (await eu(url, sessao.token)).status, { timeout: 30_000, interval: 500 }).toBe(200)
    })
  })
})

describe('C48 e C49: a guarda no handler é o que segura a rota da operação', () => {
  const escolas = new BancadaDeSessoes()
  const operadores = new BancadaDeOperadores()
  let app: INestApplication
  let url: string

  beforeAll(async () => {
    const config = configuracaoDeTeste()
    @Module({ imports: [AppModule.com(config)], controllers: [SemGuardaController, EscolaNaOperacaoController], providers: provedoresDaGuardaDeOperador(config.identidade) })
    class ModuloComRotasDeTeste {}
    ;({ app, url } = await subir(ModuloComRotasDeTeste))
  })

  afterAll(async () => {
    await app.close()
    await operadores.fechar()
    await escolas.fechar()
  })

  it('C48: tirar a guarda de um handler deixa o C41 e o C46 vermelhos, e só nessa rota', async () => {
    const rotas = rotasRegistradas(app).filter((rota) => rota.marcador === 'rota')
    expect(rotasDeOperacaoSemGuarda(rotas)).toEqual(['SemGuardaController.obter'])
    const professor = await escolas.escolaComSessao('professor')
    expect(await diferentesDaInexistente(url, rotas, bearer(professor.token), '/v1/operacao')).toEqual(['GET /v1/operacao/teste-sem-guarda'])
    // O vermelho é de verdade: a sessão de escola alcançou o handler.
    expect((await pedir(url, 'GET', '/v1/operacao/teste-sem-guarda', bearer(professor.token))).corpo).toEqual({ alcancou: true })
  })

  it('C49: repository de escola chamado numa rota de operador falha com erro, porque o contexto só leva o operadorId', async () => {
    const sessao: SessaoDeOperadorDeTeste = await operadores.operadorComSessao()
    const resposta = await pedir(url, 'GET', '/v1/operacao/teste-escola', bearer(sessao.token))
    expect(resposta.status).toBe(200)
    expect(resposta.corpo).toEqual({ camposDoContexto: ['operadorId', 'requisicaoId'], operadorId: sessao.operadorId, erro: 'consulta com escopo sem escola no contexto' })
  })
})

describe('C35: o limite do operador é por operador, não por IP', () => {
  const LIMITE_DO_OPERADOR = 3
  const operadores = new BancadaDeOperadores()
  let app: INestApplication
  let url: string

  beforeAll(async () => {
    ;({ app, url } = await subir(AppModule.com(configuracaoDeTeste({ ambiente: { LIMITE_REQ_OPERADOR_MIN: String(LIMITE_DO_OPERADOR) } }))))
  })

  afterAll(async () => {
    await app.close()
    await operadores.fechar()
  })

  it('dois operadores atrás do mesmo IP: `rl:op` recusa um em /eu com 429 e Retry-After, e o outro continua', async () => {
    const [um, outro] = await Promise.all([operadores.operadorComSessao(), operadores.operadorComSessao()])
    for (let vez = 0; vez < LIMITE_DO_OPERADOR; vez++) expect((await eu(url, um.token)).status).toBe(200)
    const recusada = await eu(url, um.token)
    esperarErro(recusada, 429, ErrorCode.LIMITE_EXCEDIDO)
    expect(Number(recusada.retryAfter)).toBeGreaterThanOrEqual(1)
    // Mesmo IP (127.0.0.1), outro operador: o balde dele está cheio.
    expect((await eu(url, outro.token)).status).toBe(200)
  })

  it('sem token de operador que confira, o limite não conta: a rajada de sessão de escola continua dando o 404 da rota inexistente', async () => {
    const escolas = new BancadaDeSessoes()
    try {
      const professor = await escolas.escolaComSessao('professor')
      const respostas = await Promise.all(Array.from({ length: LIMITE_DO_OPERADOR * 3 }, () => pedir(url, 'GET', '/v1/operacao/eu', bearer(professor.token))))
      expect(respostas.map((resposta) => resposta.status)).toEqual(Array.from({ length: LIMITE_DO_OPERADOR * 3 }, () => 404))
    } finally {
      await escolas.fechar()
    }
  })
})
