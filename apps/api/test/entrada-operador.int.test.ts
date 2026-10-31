import 'reflect-metadata'
import { createLogger, METRICS, systemClock, type Database } from '@educa/core'
import { ErrorCode, entradaDeOperadorResponseSchema, MENSAGENS_DE_ERRO } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { Redis } from 'ioredis'
import { randomBytes, randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { AppModule } from '../src/app.module.js'
import { DB } from '../src/database.module.js'
import type { ApiConfig } from '../src/config.js'
import { configureApp } from '../src/configure-app.js'
import { verifyOperadorChallenge } from '../src/operacao/operador-challenge.js'
import { OPERADOR_DEVICE_COOKIE, operadorDeviceCookie } from '../src/operacao/operador-device-cookie.js'
import { PREFIXO_DO_CONTADOR_DA_OPERACAO } from '../src/operacao/entrada/entrada.service.js'
import { gerarConviteDeOperador } from '../src/ops/operador.js'
import { REDIS_LOGIN_CLIENT, LoginLockout, DEVICE_COOKIE, DeviceCookie, PasswordHasher, HashBulkhead } from '../src/credencial/index.js'
import { configuracaoDeTeste, MONTAGEM_DE_TESTE } from './test-config.js'
import { BancadaDeOperadores } from './operador-session.fixture.js'
import { BancadaDeSessoes } from './sessao.fixture.js'

const SENHA = 'senha-do-operador-sintetica-1'
const SENHA_ERRADA = 'senha-do-operador-errada-9'
const SENHA_DA_COORDENACAO = 'senha-da-coordenacao-sintetica-1'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const CAMINHO = '/v1/operacao/sessao/email'

interface Resposta {
  readonly status: number
  readonly corpo: unknown
  readonly cacheControl: string | null
  readonly retryAfter: string | null
  readonly setCookie: string[]
}

type Cabecalhos = Record<string, string>

async function pedir(url: string, caminho: string, corpo: unknown, cabecalhos: Cabecalhos = {}): Promise<Resposta> {
  const resposta = await fetch(`${url}${caminho}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...cabecalhos }, body: JSON.stringify(corpo) })
  const texto = await resposta.text()
  return {
    status: resposta.status,
    corpo: texto === '' ? undefined : (JSON.parse(texto) as unknown),
    cacheControl: resposta.headers.get('cache-control'),
    retryAfter: resposta.headers.get('retry-after'),
    setCookie: resposta.headers.getSetCookie(),
  }
}

/** O corpo sem o `requisicaoId`, que muda a cada requisição: o resto tem de ser igual, byte a byte. */
function semRequisicaoId(corpo: unknown): unknown {
  if (typeof corpo !== 'object' || corpo === null || !('erro' in corpo)) return corpo
  const { requisicaoId: _id, ...erro } = (corpo as { erro: Record<string, unknown> }).erro
  return { erro }
}

/** Status, corpo (sem o `requisicaoId`) e cabeçalhos que diriam algo: o que precisa ser igual entre as recusas. */
const forma = (resposta: Resposta) => ({ status: resposta.status, corpo: semRequisicaoId(resposta.corpo), retryAfter: resposta.retryAfter, setCookie: resposta.setCookie })

function esperarErro(resposta: Resposta, status: number, codigo: ErrorCode): void {
  expect(resposta.status).toBe(status)
  expect(resposta.corpo).toEqual({ erro: { codigo, mensagem: MENSAGENS_DE_ERRO[codigo], requisicaoId: expect.stringMatching(UUID) } })
  expect(resposta.setCookie).toEqual([])
}

const esperarNaoAutenticado = (resposta: Resposta) => esperarErro(resposta, 401, ErrorCode.NAO_AUTENTICADO)

function esperarSegurada(resposta: Resposta, retryAfter?: number): void {
  esperarErro(resposta, 429, ErrorCode.CONTA_SEGURADA)
  if (retryAfter === undefined) expect(Number(resposta.retryAfter)).toBeGreaterThanOrEqual(1)
  else expect(Number(resposta.retryAfter)).toBe(retryAfter)
}

/**
 * Um IP sorteado entre 16 milhões, para cada teste ter o seu: os baldes de limite e o registro de acesso são filtrados
 * por ele, e um IP repetido herdaria a contagem de outro teste.
 */
const ipSorteado = () => `10.${[...randomBytes(3)].join('.')}`

async function subir(config: ApiConfig, opcoes: { medidor?: MedidorDeTeste; linhasDeLog?: string[] } = {}): Promise<{ app: INestApplication; url: string }> {
  const medidor = opcoes.medidor?.medidor
  const app = await NestFactory.create(AppModule.forRoot(config, { ...MONTAGEM_DE_TESTE, ...(medidor === undefined ? {} : { medidor }) }), { logger: false })
  const linhas = opcoes.linhasDeLog
  const logger = linhas === undefined ? createLogger({ servico: 'api-teste', nivel: 'silent' }) : createLogger({ servico: 'api-teste', nivel: 'trace', destino: { write: (linha: string) => linhas.push(linha) } })
  configureApp(app, logger, medidor)
  await app.listen(0, '127.0.0.1')
  return { app, url: `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}` }
}

/** O operador pronto para entrar: aceitou o convite (senha gravada pelo caminho de verdade) e tem o e-mail da bancada. */
interface OperadorComSenha {
  readonly operadorId: string
  readonly email: string
}

/** O que os dois `describe` precisam para criar operador com senha: a API, o banco da app e o autor dos comandos. */
function preparadorDeOperadores(operadores: BancadaDeOperadores, contexto: () => { url: string; banco: Database; autor: string }) {
  return async function operadorComSenha(): Promise<OperadorComSenha> {
    const { url, banco, autor } = contexto()
    const { operadorId, apelido } = await operadores.operador()
    const { token } = await gerarConviteDeOperador(banco, autor, apelido)
    const aceite = await pedir(url, '/v1/operacao/convite/aceitar', { token, senha: SENHA }, { 'X-Forwarded-For': ipSorteado() })
    if (aceite.status !== 200) throw new Error(`aceite do convite de teste falhou: ${String(aceite.status)}`)
    return { operadorId, email: `${apelido}@turmma.invalid` }
  }
}

describe('POST /v1/operacao/sessao/email: o operador entra por e-mail e senha (tarefa 6.0)', () => {
  const operadores = new BancadaDeOperadores()
  const escolas = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  const config = configuracaoDeTeste({ ambiente: { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' } })
  let app: INestApplication
  let url: string
  let banco: Database
  let hash: PasswordHasher
  let autor: string
  let verificacoes: ReturnType<typeof vi.spyOn>

  beforeAll(async () => {
    ;({ app, url } = await subir(config, { medidor, linhasDeLog }))
    banco = app.get<Database>(DB)
    hash = app.get(PasswordHasher)
    autor = (await operadores.operador()).apelido
    verificacoes = vi.spyOn(hash, 'verificar')
  })

  beforeEach(() => {
    verificacoes.mockClear()
  })

  afterAll(async () => {
    verificacoes.mockRestore()
    await app.close()
    await operadores.fechar()
    await escolas.fechar()
    await medidor.encerrar()
  })

  const operadorComSenha = preparadorDeOperadores(operadores, () => ({ url, banco, autor }))
  const doIp = (ip: string, cookie?: string): Cabecalhos => ({ 'X-Forwarded-For': ip, ...(cookie === undefined ? {} : { Cookie: cookie }) })
  const entrar = (email: string, senha: string, cabecalhos: Cabecalhos = doIp(ipSorteado())) => pedir(url, CAMINHO, { email, senha }, cabecalhos)

  /** Move o aceite do convite do operador para `horas` atrás, no relógio do banco, que é o que a regra das 72 h lê. */
  async function aceiteHa(operadorId: string, intervalo: string): Promise<void> {
    await operadores.pool.query(`update convite_operador set usado_em = now() - $2::interval where operador_id = $1 and usado_em is not null`, [operadorId, intervalo])
  }

  async function ativarSegundoFator(operadorId: string): Promise<void> {
    await operadores.pool.query(`update operador set mfa_segredo_cifrado = '\\x0102'::bytea, mfa_chave_versao = 1, mfa_versao = 1, mfa_ativado_em = now() where id = $1`, [operadorId])
  }

  async function registrosDoIp(ip: string): Promise<Array<{ operador_id: string | null; evento: string; linha: string }>> {
    const { rows } = await operadores.pool.query<{ operador_id: string | null; evento: string; linha: string }>('select operador_id, evento, row_to_json(a)::text as linha from acesso_operacao a where ip = $1::inet order by em', [ip])
    return rows
  }

  async function falhasNaMetrica(): Promise<number> {
    return (await medidor.pontos(METRICS.entradaFalhaDaOperacao)).reduce((soma, ponto) => soma + (typeof ponto.valor === 'number' ? ponto.valor : 0), 0)
  }

  describe('as etapas', () => {
    it('caminho feliz: logo depois do aceite, a senha certa devolve configurar_mfa com o desafio de operador, no-store e sem cookie; com o segundo fator ativo, mfa', async () => {
      const semSegundoFator = await operadorComSenha()
      const resposta = await entrar(semSegundoFator.email.toUpperCase(), SENHA)
      expect(resposta.status).toBe(200)
      expect(resposta.cacheControl).toBe('no-store')
      expect(resposta.setCookie).toEqual([])
      const corpo = entradaDeOperadorResponseSchema.parse(resposta.corpo)
      expect(corpo.etapa).toBe('configurar_mfa')
      expect(await verifyOperadorChallenge(corpo.desafio, config.identidade.chaveAssinatura, 'configurar_mfa')).toMatchObject({ operadorId: semSegundoFator.operadorId })

      const comSegundoFator = await operadorComSenha()
      await ativarSegundoFator(comSegundoFator.operadorId)
      const comMfa = entradaDeOperadorResponseSchema.parse((await entrar(comSegundoFator.email, SENHA)).corpo)
      expect(comMfa.etapa).toBe('mfa')
      expect(await verifyOperadorChallenge(comMfa.desafio, config.identidade.chaveAssinatura, 'mfa')).toMatchObject({ operadorId: comSegundoFator.operadorId })
      // Nenhuma sessão nasce na entrada: ela só existe depois do segundo fator (7.0).
      const { rows } = await operadores.pool.query<{ total: number }>('select count(*)::int as total from sessao_operador where operador_id = any($1::uuid[])', [[semSegundoFator.operadorId, comSegundoFator.operadorId]])
      expect(rows[0]?.total).toBe(0)
    })

    it('C15: às 71h59 do aceite devolve configurar_mfa; às 72h01 responde igual à senha errada, e conta como falha', async () => {
      const dentro = await operadorComSenha()
      await aceiteHa(dentro.operadorId, '71 hours 59 minutes')
      const noPrazo = await entrar(dentro.email, SENHA)
      expect(noPrazo.status).toBe(200)
      expect(entradaDeOperadorResponseSchema.parse(noPrazo.corpo).etapa).toBe('configurar_mfa')

      const fora = await operadorComSenha()
      await aceiteHa(fora.operadorId, '72 hours 1 minute')
      const ip = ipSorteado()
      const foraDoPrazo = await entrar(fora.email, SENHA, doIp(ip))
      const senhaErrada = await entrar(fora.email, SENHA_ERRADA, doIp(ip))
      esperarNaoAutenticado(foraDoPrazo)
      expect(forma(foraDoPrazo)).toEqual(forma(senhaErrada))
      expect((await registrosDoIp(ip)).map((registro) => registro.evento)).toEqual(['entrada_falha', 'entrada_falha'])
      // A senha certa fora do prazo não zera o contador: com mais três, a quinta falha segura a conta.
      for (let vez = 0; vez < 2; vez++) esperarNaoAutenticado(await entrar(fora.email, SENHA))
      esperarSegurada(await entrar(fora.email, SENHA), 30)
    })

    it('C15 (borda): com o segundo fator ativo, a entrada devolve mfa mesmo com o aceite fora das 72 h; sem ele e dentro do prazo, configurar_mfa, nunca mfa', async () => {
      const ativoAntigo = await operadorComSenha()
      await ativarSegundoFator(ativoAntigo.operadorId)
      await aceiteHa(ativoAntigo.operadorId, '30 days')
      expect(entradaDeOperadorResponseSchema.parse((await entrar(ativoAntigo.email, SENHA)).corpo).etapa).toBe('mfa')

      const recente = await operadorComSenha()
      await aceiteHa(recente.operadorId, '1 hour')
      expect(entradaDeOperadorResponseSchema.parse((await entrar(recente.email, SENHA)).corpo).etapa).toBe('configurar_mfa')
    })
  })

  describe('respostas iguais', () => {
    it('C22: e-mail inexistente e senha errada respondem igual, em status e corpo, com um hash cada', async () => {
      const operador = await operadorComSenha()
      const ip = ipSorteado()
      const errada = await entrar(operador.email, SENHA_ERRADA, doIp(ip))
      const inexistente = await entrar(`ninguem-${randomUUID()}@turmma.invalid`, SENHA, doIp(ip))
      esperarNaoAutenticado(errada)
      expect(forma(inexistente)).toEqual(forma(errada))
      expect(errada.cacheControl).toBe('no-store')
      expect(inexistente.cacheControl).toBe('no-store')
      expect(verificacoes).toHaveBeenCalledTimes(2)
    })

    it('borda: o e-mail do operador desativado responde igual ao inexistente, também com a senha certa, e o do operador que nunca aceitou o convite (sem senha) também', async () => {
      const operador = await operadorComSenha()
      await operadores.pool.query(
        `update operador set nome = null, email = null, senha_hash = null, mfa_segredo_cifrado = null, mfa_chave_versao = null,
                mfa_ativado_em = null, mfa_ultimo_passo = null, desativado_em = now() where id = $1`,
        [operador.operadorId],
      )
      const { apelido: semAceite } = await operadores.operador()
      const ip = ipSorteado()
      const desativado = await entrar(operador.email, SENHA, doIp(ip))
      const nuncaAceitou = await entrar(`${semAceite}@turmma.invalid`, SENHA, doIp(ip))
      const inexistente = await entrar(`ninguem-${randomUUID()}@turmma.invalid`, SENHA, doIp(ip))
      esperarNaoAutenticado(desativado)
      expect(forma(nuncaAceitou)).toEqual(forma(desativado))
      expect(forma(inexistente)).toEqual(forma(desativado))
      expect(verificacoes).toHaveBeenCalledTimes(3)
    })

    it('contrato: campo a mais, e-mail curto e senha vazia são ENTRADA_INVALIDA antes de qualquer hash', async () => {
      const operador = await operadorComSenha()
      for (const corpo of [
        { email: operador.email, senha: SENHA, bilhete: 'x' },
        { email: 'a', senha: SENHA },
        { email: operador.email, senha: '' },
        { email: operador.email },
      ]) {
        esperarErro(await pedir(url, CAMINHO, corpo, doIp(ipSorteado())), 400, ErrorCode.ENTRADA_INVALIDA)
      }
      expect(verificacoes).not.toHaveBeenCalled()
      expect(() => entradaDeOperadorResponseSchema.parse({ etapa: 'mfa', desafio: 'x', operadorId: operador.operadorId })).toThrow()
    })
  })

  describe('o contador por conta', () => {
    it('C23: dez erros na conta X seguram X com espera crescente (30 s, 60 s, … até 15 min); a conta Y, do mesmo IP, entra', async () => {
      const [x, y] = [await operadorComSenha(), await operadorComSenha()]
      const ip = ipSorteado()
      let deslocamentoMs = 0
      const relogio = vi.spyOn(systemClock, 'agora').mockImplementation(() => new Date(Date.now() + deslocamentoMs))
      try {
        for (let falha = 1; falha <= 4; falha++) esperarNaoAutenticado(await entrar(x.email, SENHA_ERRADA, doIp(ip)))
        for (const esperaS of [30, 60, 120, 240, 480, 900]) {
          esperarSegurada(await entrar(x.email, SENHA_ERRADA, doIp(ip)), esperaS)
          // Ainda dentro da espera: nem a senha certa passa, e a tentativa não conta.
          esperarSegurada(await entrar(x.email, SENHA, doIp(ip)))
          deslocamentoMs += esperaS * 1_000
        }
      } finally {
        relogio.mockRestore()
      }
      // Dez falhas contadas (4 + 6) e seis tentativas seguradas que não chegaram ao hash.
      expect(verificacoes).toHaveBeenCalledTimes(10)
      // X continua segurada no relógio de verdade; Y, do mesmo IP, entra.
      esperarSegurada(await entrar(x.email, SENHA, doIp(ip)))
      const doY = await entrar(y.email, SENHA, doIp(ip))
      expect(doY.status).toBe(200)
      expect(entradaDeOperadorResponseSchema.parse(doY.corpo).etapa).toBe('configurar_mfa')
    })

    it('C24: o mesmo e-mail como operador e como coordenador: errar num não segura o outro, nos dois sentidos', async () => {
      const escolaId = await escolas.escola()
      const ip = ipSorteado()

      // Sentido 1: o operador segurado, o coordenador com o mesmo e-mail entra na escola.
      const operador = await operadorComSenha()
      const { contaId } = await escolas.equipeComEmail(escolaId, operador.email, 'coordenador')
      await escolas.pool.query('update conta set senha_hash = $2 where id = $1', [contaId, await hash.gerar(SENHA_DA_COORDENACAO)])
      for (let falha = 1; falha <= 4; falha++) esperarNaoAutenticado(await entrar(operador.email, SENHA_ERRADA, doIp(ip)))
      esperarSegurada(await entrar(operador.email, SENHA_ERRADA, doIp(ip)), 30)
      const daEscola = await pedir(url, '/v1/sessao/email', { email: operador.email, senha: SENHA_DA_COORDENACAO }, doIp(ip))
      expect(daEscola.status).toBe(200)
      expect(daEscola.corpo).toMatchObject({ etapa: 'configurar_mfa' })
      esperarSegurada(await entrar(operador.email, SENHA, doIp(ip)))

      // Sentido 2: o coordenador segurado, o operador com o mesmo e-mail entra na operação.
      const outro = await operadorComSenha()
      const { contaId: outraConta } = await escolas.equipeComEmail(escolaId, outro.email, 'coordenador')
      await escolas.pool.query('update conta set senha_hash = $2 where id = $1', [outraConta, await hash.gerar(SENHA_DA_COORDENACAO)])
      for (let falha = 1; falha <= 4; falha++) esperarNaoAutenticado(await pedir(url, '/v1/sessao/email', { email: outro.email, senha: SENHA_ERRADA }, doIp(ip)))
      esperarSegurada(await pedir(url, '/v1/sessao/email', { email: outro.email, senha: SENHA_ERRADA }, doIp(ip)), 30)
      const daOperacao = await entrar(outro.email, SENHA, doIp(ip))
      expect(daOperacao.status).toBe(200)
      expect(entradaDeOperadorResponseSchema.parse(daOperacao.corpo).etapa).toBe('configurar_mfa')
      esperarSegurada(await pedir(url, '/v1/sessao/email', { email: outro.email, senha: SENHA_DA_COORDENACAO }, doIp(ip)))
    })

    it('borda (aparelho de sempre): com o cookie de dispositivo do operador, os erros de outro aparelho não seguram a conta; o cookie da escola, com a chave ou o nome dela, não serve', async () => {
      const operador = await operadorComSenha()
      const ip = ipSorteado()
      for (let falha = 1; falha <= 4; falha++) esperarNaoAutenticado(await entrar(operador.email, SENHA_ERRADA, doIp(ip)))
      esperarSegurada(await entrar(operador.email, SENHA_ERRADA, doIp(ip)), 30)

      const doOperador = operadorDeviceCookie(config.login.dispositivo).comEntrada(undefined, operador.email)
      const daEscola = new DeviceCookie(config.login.dispositivo.versao, config.login.dispositivo.chave).comEntrada(undefined, operador.email)
      // A entrada da escola para o mesmo e-mail, com o nome do cookie do operador: a chave é outra, e vale como vazio.
      esperarSegurada(await entrar(operador.email, SENHA, doIp(ip, `${OPERADOR_DEVICE_COOKIE}=${daEscola}`)))
      // A entrada do operador, com o nome do cookie da escola: não é lida.
      esperarSegurada(await entrar(operador.email, SENHA, doIp(ip, `${DEVICE_COOKIE}=${doOperador}`)))
      // O aparelho de sempre entra, do mesmo IP.
      const doAparelho = await entrar(operador.email, SENHA, doIp(ip, `${OPERADOR_DEVICE_COOKIE}=${doOperador}`))
      expect(doAparelho.status).toBe(200)
      expect(entradaDeOperadorResponseSchema.parse(doAparelho.corpo).etapa).toBe('configurar_mfa')
    })

    it('concorrência: 15 senhas erradas em paralelo na mesma conta contam todas: cinco hashes, quatro 401, onze 429, cinco entrada_falha (as que passaram pelo hash) e quinze na métrica; a 16ª está segurada', async () => {
      const operador = await operadorComSenha()
      const ip = ipSorteado()
      const antes = await falhasNaMetrica()
      const respostas = await Promise.all(Array.from({ length: 15 }, () => entrar(operador.email, SENHA_ERRADA, doIp(ip))))
      expect(respostas.filter((resposta) => resposta.status === 401)).toHaveLength(4)
      const seguradas = respostas.filter((resposta) => resposta.status === 429)
      expect(seguradas).toHaveLength(11)
      for (const segurada of seguradas) esperarSegurada(segurada)
      expect(verificacoes).toHaveBeenCalledTimes(5)
      expect(await registrosDoIp(ip)).toHaveLength(5)
      expect(await falhasNaMetrica()).toBe(antes + 15)
      esperarSegurada(await entrar(operador.email, SENHA, doIp(ip)))
    })

    it('carga (regra 80, item 3): com a conta segurada, 30 tentativas seguidas respondem 429 sem hash e sem gravar em acesso_operacao; só a métrica conta', async () => {
      const operador = await operadorComSenha()
      const ip = ipSorteado()
      for (let falha = 1; falha <= 4; falha++) esperarNaoAutenticado(await entrar(operador.email, SENHA_ERRADA, doIp(ip)))
      esperarSegurada(await entrar(operador.email, SENHA_ERRADA, doIp(ip)), 30)
      expect(await registrosDoIp(ip)).toHaveLength(5)
      verificacoes.mockClear()
      const antes = await falhasNaMetrica()
      for (let vez = 0; vez < 30; vez++) esperarSegurada(await entrar(operador.email, SENHA_ERRADA, doIp(ip)))
      expect(verificacoes).not.toHaveBeenCalled()
      expect(await registrosDoIp(ip)).toHaveLength(5)
      expect(await falhasNaMetrica()).toBe(antes + 30)
    })

    it('borda: a senha certa zera o contador do e-mail: quatro erros, uma entrada, e mais quatro erros ainda respondem 401', async () => {
      const operador = await operadorComSenha()
      const ip = ipSorteado()
      // O contador da conta, no Redis de fila (A0b, tarefa 9.0): a prova direta, além da resposta das tentativas seguintes.
      const chave = app.get(LoginLockout).chaveDe(operador.email, 'outro', PREFIXO_DO_CONTADOR_DA_OPERACAO)
      const falhasNoContador = () => app.get<Redis>(REDIS_LOGIN_CLIENT, { strict: false }).hget(chave, 'falhas')
      for (let falha = 1; falha <= 4; falha++) esperarNaoAutenticado(await entrar(operador.email, SENHA_ERRADA, doIp(ip)))
      expect(await falhasNoContador()).toBe('4')
      expect((await entrar(operador.email, SENHA, doIp(ip))).status).toBe(200)
      expect(await falhasNoContador()).toBeNull()
      for (let falha = 1; falha <= 4; falha++) esperarNaoAutenticado(await entrar(operador.email, SENHA_ERRADA, doIp(ip)))
      esperarSegurada(await entrar(operador.email, SENHA_ERRADA, doIp(ip)), 30)
    })
  })

  describe('o registro da falha', () => {
    it('C25: depois de uma entrada_falha com e-mail sentinela, o e-mail não está em acesso_operacao nem no log; o registro tem evento, IP e data, sem operador, e a métrica conta', async () => {
      const sentinela = `sentinela-${randomUUID()}@turmma.invalid`
      const operador = await operadorComSenha()
      const ip = ipSorteado()
      const antes = await falhasNaMetrica()
      const linhasAntes = linhasDeLog.length
      esperarNaoAutenticado(await entrar(sentinela, SENHA_ERRADA, doIp(ip)))
      esperarNaoAutenticado(await entrar(operador.email, SENHA_ERRADA, doIp(ip)))

      const registros = await registrosDoIp(ip)
      expect(registros.map(({ operador_id, evento }) => ({ operador_id, evento }))).toEqual([
        { operador_id: null, evento: 'entrada_falha' },
        { operador_id: null, evento: 'entrada_falha' },
      ])
      const { rows } = await operadores.pool.query<{ linha: string }>('select row_to_json(a)::text as linha from acesso_operacao a')
      for (const { linha } of rows) {
        expect(linha.toLowerCase()).not.toContain(sentinela.toLowerCase())
        expect(linha.toLowerCase()).not.toContain(operador.email.toLowerCase())
      }
      expect(await falhasNaMetrica()).toBe(antes + 2)
      // As duas falhas foram ao log (o `http.erro` do filtro), só com evento, status e código; nenhuma linha leva o
      // e-mail, a parte local dele nem a senha.
      const dasFalhas = linhasDeLog.slice(linhasAntes).map((linha) => JSON.parse(linha) as Record<string, unknown>)
      expect(dasFalhas.filter((linha) => linha['evento'] === 'http.erro' && linha['codigo'] === ErrorCode.NAO_AUTENTICADO)).toHaveLength(2)
      for (const linha of linhasDeLog) {
        for (const segredo of [sentinela, sentinela.split('@')[0] ?? sentinela, operador.email, SENHA_ERRADA, SENHA]) expect(linha.toLowerCase()).not.toContain(segredo.toLowerCase())
      }
    })
  })
})

describe('POST /v1/operacao/sessao/email: o limite por IP rebaixa, e quem recusa é o contador da conta (C33, parte)', () => {
  const LIMITE_POR_IP = 5
  const operadores = new BancadaDeOperadores()
  const config = configuracaoDeTeste({ ambiente: { LIMITE_REQ_IP_ANONIMO_MIN: String(LIMITE_POR_IP), LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' } })
  let app: INestApplication
  let url: string
  let banco: Database
  let autor: string

  beforeAll(async () => {
    ;({ app, url } = await subir(config))
    banco = app.get<Database>(DB)
    autor = (await operadores.operador()).apelido
  })

  afterAll(async () => {
    await app.close()
    await operadores.fechar()
  })

  const operadorComSenha = preparadorDeOperadores(operadores, () => ({ url, banco, autor }))
  const doIp = (ip: string, cookie?: string): Cabecalhos => ({ 'X-Forwarded-For': ip, ...(cookie === undefined ? {} : { Cookie: cookie }) })
  const entrar = (email: string, senha: string, cabecalhos: Cabecalhos) => pedir(url, CAMINHO, { email, senha }, cabecalhos)

  it('acima do limite do IP nada recebe 429 LIMITE_EXCEDIDO: a tentativa vai para o fim do balde; a conta é segurada pelo contador (CONTA_SEGURADA); quem traz o cookie do operador e o outro IP mantêm a vez', async () => {
    const [ip, outro] = [ipSorteado(), ipSorteado()]
    const [segurada, certa, comAparelho, deFora] = [await operadorComSenha(), await operadorComSenha(), await operadorComSenha(), await operadorComSenha()]
    const semaforo = app.get(HashBulkhead)
    const vezes = vi.spyOn(semaforo, 'executar')
    try {
      // O dobro do limite, com e-mails que não existem, cada um o seu: nenhum 429, todos 401.
      for (let vez = 0; vez < 2 * LIMITE_POR_IP; vez++) esperarNaoAutenticado(await entrar(`ninguem-${randomUUID()}@turmma.invalid`, SENHA_ERRADA, doIp(ip)))
      expect(vezes.mock.calls.slice(-1).map(([balde]) => balde)).toEqual([{ id: 'equipe', subfila: ip, rotulo: 'equipe', rebaixado: true }])

      // Quem recusa é o contador da conta: a quinta falha é CONTA_SEGURADA, nunca LIMITE_EXCEDIDO.
      for (let falha = 1; falha <= 4; falha++) esperarNaoAutenticado(await entrar(segurada.email, SENHA_ERRADA, doIp(ip)))
      esperarSegurada(await entrar(segurada.email, SENHA_ERRADA, doIp(ip)), 30)

      vezes.mockClear()
      const cookie = `${OPERADOR_DEVICE_COOKIE}=${operadorDeviceCookie(config.login.dispositivo).comEntrada(undefined, comAparelho.email)}`
      expect((await entrar(certa.email, SENHA, doIp(ip))).status).toBe(200)
      expect((await entrar(comAparelho.email, SENHA, doIp(ip, cookie))).status).toBe(200)
      expect((await entrar(deFora.email, SENHA, doIp(outro))).status).toBe(200)
      expect(vezes.mock.calls.map(([balde]) => balde)).toEqual([
        { id: 'equipe', subfila: ip, rotulo: 'equipe', rebaixado: true },
        { id: 'equipe', subfila: ip, rotulo: 'equipe', rebaixado: false },
        { id: 'equipe', subfila: outro, rotulo: 'equipe', rebaixado: false },
      ])
    } finally {
      vezes.mockRestore()
    }
  })
})
