import 'reflect-metadata'
import { type Database } from '@educa/nucleo'
import {
  ErrorCode,
  aceitarConviteDeOperadorResponseSchema,
  configurarSegundoFatorDeOperadorResponseSchema,
  entradaDeOperadorResponseSchema,
  segundoFatorDeOperadorResponseSchema,
} from '@educa/shared'
import type { INestApplication, Type } from '@nestjs/common'
import { DiscoveryService } from '@nestjs/core'
import type { Redis } from 'ioredis'
import { createHash, randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { BANCO } from '../src/banco.module.js'
import { COOKIE_SESSAO_DE_OPERADOR } from '../src/operacao/cookie-de-operador.js'
import { verificarDesafioDeOperador } from '../src/operacao/desafio-de-operador.js'
import { COOKIE_DISPOSITIVO_DE_OPERADOR, cookieDeDispositivoDeOperador } from '../src/operacao/dispositivo-de-operador.js'
import { PREFIXO_DO_CONTADOR_DA_OPERACAO } from '../src/operacao/entrada/entrada.service.js'
import { SegundoFatorDoOperadorService } from '../src/operacao/segundo-fator/segundo-fator.service.js'
import { gerarConviteDeOperador } from '../src/ops/operador.js'
import { CLIENTE_REDIS_LOGIN, ContadorDeTentativas, COOKIE_SESSAO, type OrigemDaTentativa } from '../src/credencial/index.js'
import { configuracaoDeTeste } from './configuracao-de-teste.js'
import { caminhoConcreto, rotasDe } from './rotas-registradas.js'
import {
  ativarNoBanco,
  base32DoGravado,
  codigoDoPasso,
  configurar,
  CONFIGURAR,
  desafio,
  desafioInvalido,
  doIp,
  entrar,
  ENTRAR,
  esperarErro,
  estadoDoOperador,
  forma,
  hmacDoCodigo,
  ipSorteado,
  passoAtual,
  pedir,
  subir,
  valorDoCookie,
  UUID,
  type Cabecalhos,
  type Resposta,
} from './segundo-fator-de-operador.js'
import { BancadaDeOperadores } from './sessao-de-operador.js'

const SENHA = 'senha-nova-do-operador-1'
const configuracao = configuracaoDeTeste()

/** Um operador com o segundo fator ativo pela API (configurar e o primeiro código), com a sessão que isso abriu. */
interface OperadorAtivo {
  readonly operadorId: string
  readonly apelido: string
  readonly base32: string
  readonly codigos: readonly string[]
  readonly token: string
  readonly setCookie: readonly string[]
}

describe('segundo fator do operador: configurar e entrar com código (tarefa 7.0)', () => {
  const operadores = new BancadaDeOperadores()
  const linhasDeLog: string[] = []
  /** Tudo que foi recebido e não pode aparecer no log: segredos, URIs, códigos, desafios, tokens e cookies. */
  const segredosVistos = new Set<string>([SENHA])
  let app: INestApplication
  let url: string
  let banco: Database
  let autor: string

  beforeAll(async () => {
    ;({ app, url } = await subir(undefined, linhasDeLog))
    banco = app.get<Database>(BANCO)
    autor = (await operadores.operador()).apelido
  })

  afterAll(async () => {
    await app.close()
    await operadores.fechar()
  })

  function guardar(resposta: Resposta): Resposta {
    const corpo = resposta.corpo as Record<string, unknown> | undefined
    for (const valor of Object.values(corpo ?? {})) {
      if (typeof valor === 'string') segredosVistos.add(valor)
      if (Array.isArray(valor)) for (const item of valor) if (typeof item === 'string') segredosVistos.add(item)
    }
    for (const linha of resposta.setCookie) segredosVistos.add(linha.split(';')[0]?.split('=').slice(1).join('=') ?? '')
    return resposta
  }

  /** A referência de "desafio inválido" da rota: um desafio assinado com outra chave. */
  async function comoDesafioInvalido(caminho: typeof CONFIGURAR | typeof ENTRAR, operadorId: string): Promise<ReturnType<typeof forma>> {
    if (caminho === CONFIGURAR) return forma((await configurar(url, await desafioInvalido(operadorId, 'configurar_mfa'))).resposta)
    return forma(await entrar(url, { desafio: await desafioInvalido(operadorId, 'mfa'), codigo: '123456' }))
  }

  async function operadorAtivo(): Promise<OperadorAtivo> {
    const { operadorId, apelido } = await operadores.operador()
    const { corpo } = await configurar(url, await desafio(operadorId, 'configurar_mfa'))
    if (corpo === undefined) throw new Error('configurar recusado')
    const resposta = guardar(await entrar(url, { desafio: corpo.desafio, codigo: codigoDoPasso(corpo.segredo, passoAtual()) }))
    expect(resposta.status).toBe(200)
    const { token } = segundoFatorDeOperadorResponseSchema.parse(resposta.corpo)
    return { operadorId, apelido, base32: corpo.segredo, codigos: corpo.codigosRecuperacao, token, setCookie: resposta.setCookie }
  }

  const eu = (token: string) => pedir(url, 'GET', '/v1/operacao/eu', undefined, { Authorization: `Bearer ${token}` })

  describe('o caminho feliz, do convite à casca', () => {
    it('aceitar, configurar (segredo, códigos e desafio `mfa` com a versão, sem ativar), o primeiro código ativa e abre a sessão com os dois cookies; depois, e-mail, senha e código entram de novo', async () => {
      const { operadorId, apelido } = await operadores.operador()
      const convite = await gerarConviteDeOperador(banco, autor, apelido)
      const aceite = aceitarConviteDeOperadorResponseSchema.parse(guardar(await pedir(url, 'POST', '/v1/operacao/convite/aceitar', { token: convite.token, senha: SENHA }, doIp())).corpo)

      const { resposta: configurado, corpo } = await configurar(url, aceite.desafio)
      guardar(configurado)
      if (corpo === undefined) throw new Error('configurar recusado')
      expect(configurado.cacheControl).toBe('no-store')
      expect(configurado.setCookie).toEqual([])
      expect(Object.keys(configurado.corpo as object).sort()).toEqual(['codigosRecuperacao', 'desafio', 'etapa', 'segredo', 'uri'])
      expect(corpo.uri).toContain(`secret=${corpo.segredo}`)
      expect(new Set(corpo.codigosRecuperacao).size).toBe(10)
      const configurada = await estadoDoOperador(operadores.pool, operadorId)
      // O segredo gravado é o que a pessoa recebeu (cifrado com o `operador.id`), os códigos são os HMACs dos dela, e nada está ativo.
      expect(configurada.segredoCifrado).not.toBeNull()
      expect(base32DoGravado(operadorId, configurada.segredoCifrado ?? Buffer.alloc(0), configurada.chaveVersao ?? 0)).toBe(corpo.segredo)
      expect(configurada.hmacs).toEqual(corpo.codigosRecuperacao.map(hmacDoCodigo).sort())
      expect(configurada.ativadoEm).toBeNull()
      expect(await verificarDesafioDeOperador(corpo.desafio, configuracao.identidade.chaveAssinatura, 'mfa')).toMatchObject({ operadorId, etapa: 'mfa', versao: configurada.mfaVersao })

      const passo = passoAtual()
      const entrada = guardar(await entrar(url, { desafio: corpo.desafio, codigo: codigoDoPasso(corpo.segredo, passo) }))
      expect(entrada.status).toBe(200)
      expect(entrada.cacheControl).toBe('no-store')
      expect(Object.keys(entrada.corpo as object).sort()).toEqual(['expiraEm', 'token'])
      const { token } = segundoFatorDeOperadorResponseSchema.parse(entrada.corpo)
      // Os dois cookies, só em `/v1/operacao/sessao`, `HttpOnly` e `SameSite=Strict`.
      const cookies = Object.fromEntries(entrada.setCookie.map((linha) => [linha.split('=')[0], linha]))
      expect(Object.keys(cookies).sort()).toEqual([COOKIE_SESSAO_DE_OPERADOR, COOKIE_DISPOSITIVO_DE_OPERADOR].sort())
      for (const linha of Object.values(cookies)) {
        expect(linha).toContain('Path=/v1/operacao/sessao')
        expect(linha).toContain('HttpOnly')
        expect(linha).toContain('SameSite=Strict')
      }
      expect(cookies[COOKIE_SESSAO_DE_OPERADOR]).toContain('Max-Age=28800')
      const refresh = valorDoCookie(entrada.setCookie, COOKIE_SESSAO_DE_OPERADOR) ?? ''
      const { rows: sessoes } = await operadores.pool.query<{ refresh_hash: string; horas: number }>(
        `select refresh_hash, (extract(epoch from (expira_em - criada_em)) / 3600)::float8 as horas from sessao_operador where operador_id = $1`,
        [operadorId],
      )
      expect(sessoes).toEqual([{ refresh_hash: createHash('sha256').update(refresh).digest('hex'), horas: 8 }])
      const ativa = await estadoDoOperador(operadores.pool, operadorId)
      expect(ativa.ativadoEm).toBeInstanceOf(Date)
      expect(Number(ativa.ultimoPasso)).toBeGreaterThanOrEqual(passo - 1)
      // O cookie de dispositivo gravado aqui é o que a entrada por e-mail lê: ele conhece este e-mail.
      const dispositivo = valorDoCookie(entrada.setCookie, COOKIE_DISPOSITIVO_DE_OPERADOR)
      expect(cookieDeDispositivoDeOperador(configuracao.login.dispositivo).conhece(dispositivo, `${apelido}@turmma.invalid`)).toBe(true)
      expect((await eu(token)).corpo).toEqual({ apelido, nome: 'Pessoa Sintética da Operação' })

      // De novo, pela entrada por e-mail: `mfa` sem versão, e o código do passo seguinte.
      const deNovo = entradaDeOperadorResponseSchema.parse(guardar(await pedir(url, 'POST', '/v1/operacao/sessao/email', { email: `${apelido}@turmma.invalid`, senha: SENHA }, doIp())).corpo)
      expect(deNovo.etapa).toBe('mfa')
      const segunda = guardar(await entrar(url, { desafio: deNovo.desafio, codigo: codigoDoPasso(corpo.segredo, passoAtual() + 1) }, { ...doIp(), Cookie: `${COOKIE_DISPOSITIVO_DE_OPERADOR}=${dispositivo ?? ''}` }))
      expect(segunda.status).toBe(200)
      // A ativação é a do primeiro código: a segunda entrada não a regrava.
      expect((await estadoDoOperador(operadores.pool, operadorId)).ativadoEm).toEqual(ativa.ativadoEm)
      expect((await estadoDoOperador(operadores.pool, operadorId)).sessoes).toBe(2)
    })
  })

  describe('C12: o desafio vale uma vez', () => {
    it('o mesmo desafio em duas `/sessao/mfa` paralelas, com dois códigos válidos (o do app e um de recuperação), cria uma sessão só e gasta um código só; reenviado depois do sucesso, é recusado', async () => {
      const ativo = await operadorAtivo()
      const antes = await estadoDoOperador(operadores.pool, ativo.operadorId)
      const unico = await desafio(ativo.operadorId, 'mfa')
      const [codigo, recuperacao] = [codigoDoPasso(ativo.base32, passoAtual() + 1), ativo.codigos[0] ?? '']
      const respostas = await Promise.all([entrar(url, { desafio: unico, codigo }), entrar(url, { desafio: unico, recuperacao })])
      expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 401])
      for (const recusada of respostas.filter((resposta) => resposta.status !== 200)) esperarErro(recusada, 401, ErrorCode.NAO_AUTENTICADO)
      const depois = await estadoDoOperador(operadores.pool, ativo.operadorId)
      expect(depois.sessoes).toBe(antes.sessoes + 1)
      // Só o vencedor gastou o dele: ou o passo andou, ou o código de recuperação saiu — nunca os dois.
      const passoAndou = depois.ultimoPasso !== antes.ultimoPasso
      const recuperacaoSaiu = depois.hmacs.length === antes.hmacs.length - 1
      expect([passoAndou, recuperacaoSaiu].filter(Boolean)).toHaveLength(1)

      const reenviado = await entrar(url, { desafio: unico, recuperacao: ativo.codigos[1] ?? '' })
      esperarErro(reenviado, 401, ErrorCode.NAO_AUTENTICADO)
      expect((await estadoDoOperador(operadores.pool, ativo.operadorId)).sessoes).toBe(antes.sessoes + 1)
    })
  })

  describe('C14: cada rota só aceita o desafio da sua etapa', () => {
    it('`configurar_mfa` em `/sessao/mfa` e `mfa` em `/mfa/configurar` são recusados como desafio inválido, sem gastar o desafio: cada um vale depois na rota certa', async () => {
      const { operadorId } = await operadores.operador()
      const paraConfigurar = await desafio(operadorId, 'configurar_mfa')
      esperarErro(await entrar(url, { desafio: paraConfigurar, codigo: '123456' }), 401, ErrorCode.NAO_AUTENTICADO)
      expect(forma(await entrar(url, { desafio: paraConfigurar, codigo: '123456' }))).toEqual(await comoDesafioInvalido(ENTRAR, operadorId))
      const { corpo } = await configurar(url, paraConfigurar)
      if (corpo === undefined) throw new Error('configurar recusado')

      const { resposta: trocado } = await configurar(url, corpo.desafio)
      expect(forma(trocado)).toEqual(await comoDesafioInvalido(CONFIGURAR, operadorId))
      // O segredo não mudou, e o desafio `mfa` continua valendo onde ele vale.
      const gravado = await estadoDoOperador(operadores.pool, operadorId)
      expect(base32DoGravado(operadorId, gravado.segredoCifrado ?? Buffer.alloc(0), gravado.chaveVersao ?? 0)).toBe(corpo.segredo)
      expect((await entrar(url, { desafio: corpo.desafio, codigo: codigoDoPasso(corpo.segredo, passoAtual()) })).status).toBe(200)
    })
  })

  describe('C16: com o segundo fator ativo, configurar não muda nada', () => {
    it('um desafio `configurar_mfa` válido é recusado como desafio inválido, e o segredo, a versão e os códigos ficam os mesmos', async () => {
      const ativo = await operadorAtivo()
      const antes = await estadoDoOperador(operadores.pool, ativo.operadorId)
      const { resposta } = await configurar(url, await desafio(ativo.operadorId, 'configurar_mfa'))
      esperarErro(resposta, 401, ErrorCode.NAO_AUTENTICADO)
      expect(forma(resposta)).toEqual(await comoDesafioInvalido(CONFIGURAR, ativo.operadorId))
      const depois = await estadoDoOperador(operadores.pool, ativo.operadorId)
      expect({ segredo: depois.segredoCifrado, versao: depois.mfaVersao, hmacs: depois.hmacs, ativadoEm: depois.ativadoEm }).toEqual({
        segredo: antes.segredoCifrado,
        versao: antes.mfaVersao,
        hmacs: antes.hmacs,
        ativadoEm: antes.ativadoEm,
      })
    })
  })

  describe('C17: configurar consome o desafio, e só o primeiro código válido ativa', () => {
    it('o desafio do configurar não vale duas vezes; o código errado não ativa e queima o desafio `mfa`; o desafio novo da mesma versão com o código certo ativa', async () => {
      const { operadorId } = await operadores.operador()
      const paraConfigurar = await desafio(operadorId, 'configurar_mfa')
      const { corpo } = await configurar(url, paraConfigurar)
      if (corpo === undefined) throw new Error('configurar recusado')
      const versao = (await estadoDoOperador(operadores.pool, operadorId)).mfaVersao
      const { resposta: repetido } = await configurar(url, paraConfigurar)
      expect(forma(repetido)).toEqual(await comoDesafioInvalido(CONFIGURAR, operadorId))
      // O segundo configurar não gravou nada: a versão e o segredo são os do primeiro.
      expect((await estadoDoOperador(operadores.pool, operadorId)).mfaVersao).toBe(versao)

      const errado = codigoDoPasso(corpo.segredo, passoAtual() - 10)
      esperarErro(await entrar(url, { desafio: corpo.desafio, codigo: errado }), 401, ErrorCode.NAO_AUTENTICADO)
      expect((await estadoDoOperador(operadores.pool, operadorId)).ativadoEm).toBeNull()
      // Queimado não volta: nem com o código certo.
      esperarErro(await entrar(url, { desafio: corpo.desafio, codigo: codigoDoPasso(corpo.segredo, passoAtual()) }), 401, ErrorCode.NAO_AUTENTICADO)
      expect((await estadoDoOperador(operadores.pool, operadorId)).ativadoEm).toBeNull()

      const certo = await entrar(url, { desafio: await desafio(operadorId, 'mfa', versao), codigo: codigoDoPasso(corpo.segredo, passoAtual()) })
      expect(certo.status).toBe(200)
      const ativa = await estadoDoOperador(operadores.pool, operadorId)
      expect(ativa.ativadoEm).toBeInstanceOf(Date)
      expect(ativa.sessoes).toBe(1)
    })

    it('borda: o desafio `mfa` sem versão (da entrada por e-mail) não ativa o segredo configurado e ainda inativo', async () => {
      const { operadorId } = await operadores.operador()
      const { corpo } = await configurar(url, await desafio(operadorId, 'configurar_mfa'))
      if (corpo === undefined) throw new Error('configurar recusado')
      const semVersao = await entrar(url, { desafio: await desafio(operadorId, 'mfa'), codigo: codigoDoPasso(corpo.segredo, passoAtual()) })
      expect(forma(semVersao)).toEqual(await comoDesafioInvalido(ENTRAR, operadorId))
      expect(await estadoDoOperador(operadores.pool, operadorId)).toMatchObject({ ativadoEm: null, ultimoPasso: null, sessoes: 0 })
    })
  })

  describe('C19: o mesmo código do app vale uma vez', () => {
    it('em sequência: o segundo uso, com outro desafio, é recusado, e não abre sessão', async () => {
      const ativo = await operadorAtivo()
      const codigo = codigoDoPasso(ativo.base32, passoAtual() + 1)
      expect((await entrar(url, { desafio: await desafio(ativo.operadorId, 'mfa'), codigo })).status).toBe(200)
      esperarErro(await entrar(url, { desafio: await desafio(ativo.operadorId, 'mfa'), codigo }), 401, ErrorCode.NAO_AUTENTICADO)
      expect((await estadoDoOperador(operadores.pool, ativo.operadorId)).sessoes).toBe(2)
    })

    it('em paralelo, com dois desafios: um entra, o outro é recusado, e há uma sessão nova só', async () => {
      const ativo = await operadorAtivo()
      const codigo = codigoDoPasso(ativo.base32, passoAtual() + 1)
      const [um, outro] = await Promise.all([desafio(ativo.operadorId, 'mfa'), desafio(ativo.operadorId, 'mfa')])
      const respostas = await Promise.all([entrar(url, { desafio: um, codigo }), entrar(url, { desafio: outro, codigo })])
      expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 401])
      expect((await estadoDoOperador(operadores.pool, ativo.operadorId)).sessoes).toBe(2)
    })
  })

  describe('C20: o mesmo código de recuperação vale uma vez, e só depois da ativação', () => {
    it('em sequência e em paralelo, o segundo uso é recusado; cada um sai do banco uma vez', async () => {
      const ativo = await operadorAtivo()
      const [primeiro, segundo] = [ativo.codigos[0] ?? '', ativo.codigos[1] ?? '']
      // Copiado do papel: minúsculas e hífen valem.
      const copiado = `${primeiro.slice(0, 6).toLowerCase()}-${primeiro.slice(6)}`
      expect((await entrar(url, { desafio: await desafio(ativo.operadorId, 'mfa'), recuperacao: copiado })).status).toBe(200)
      esperarErro(await entrar(url, { desafio: await desafio(ativo.operadorId, 'mfa'), recuperacao: primeiro }), 401, ErrorCode.NAO_AUTENTICADO)

      const [um, outro] = await Promise.all([desafio(ativo.operadorId, 'mfa'), desafio(ativo.operadorId, 'mfa')])
      const respostas = await Promise.all([entrar(url, { desafio: um, recuperacao: segundo }), entrar(url, { desafio: outro, recuperacao: segundo })])
      expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 401])
      const depois = await estadoDoOperador(operadores.pool, ativo.operadorId)
      expect(depois.hmacs).toHaveLength(8)
      expect(depois.hmacs).not.toContain(hmacDoCodigo(primeiro))
      expect(depois.hmacs).not.toContain(hmacDoCodigo(segundo))
      expect(depois.sessoes).toBe(3)
    })

    it('isolamento: o código de recuperação de um operador não vale para outro, e continua valendo para o dono', async () => {
      const [dono, outro] = [await operadorAtivo(), await operadorAtivo()]
      const codigo = dono.codigos[0] ?? ''
      esperarErro(await entrar(url, { desafio: await desafio(outro.operadorId, 'mfa'), recuperacao: codigo }), 401, ErrorCode.NAO_AUTENTICADO)
      expect((await estadoDoOperador(operadores.pool, dono.operadorId)).hmacs).toContain(hmacDoCodigo(codigo))
      expect((await estadoDoOperador(operadores.pool, outro.operadorId)).sessoes).toBe(1)
      expect((await entrar(url, { desafio: await desafio(dono.operadorId, 'mfa'), recuperacao: codigo })).status).toBe(200)
    })

    it('antes da ativação, o código de recuperação do configurar é recusado, conta como tentativa e continua no banco; o código do app ativa depois', async () => {
      const { operadorId } = await operadores.operador()
      const { corpo } = await configurar(url, await desafio(operadorId, 'configurar_mfa'))
      if (corpo === undefined) throw new Error('configurar recusado')
      const versao = (await estadoDoOperador(operadores.pool, operadorId)).mfaVersao
      esperarErro(await entrar(url, { desafio: corpo.desafio, recuperacao: corpo.codigosRecuperacao[0] ?? '' }), 401, ErrorCode.NAO_AUTENTICADO)
      const recusada = await estadoDoOperador(operadores.pool, operadorId)
      expect(recusada).toMatchObject({ ativadoEm: null, sessoes: 0 })
      expect(recusada.hmacs).toHaveLength(10)
      expect(await falhasNoContador(operadorId, 'outro')).toBe('1')
      expect((await entrar(url, { desafio: await desafio(operadorId, 'mfa', versao), codigo: codigoDoPasso(corpo.segredo, passoAtual()) })).status).toBe(200)
      expect(await falhasNoContador(operadorId, 'outro')).toBeNull()
    })
  })

  async function falhasNoContador(operadorId: string, origem: OrigemDaTentativa): Promise<string | null> {
    const chave = app.get(ContadorDeTentativas).chaveDe(operadorId, origem, PREFIXO_DO_CONTADOR_DA_OPERACAO)
    return app.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false }).hget(chave, 'falhas')
  }

  describe('o contador que o Redis não zera depois do commit da sessão (A0b, tarefa 9.0)', () => {
    it('`zerar` que falha: a sessão abre, a resposta é 200 com os dois cookies, e a linha `operacao.contador_nao_zerado` leva só ids, nada da pessoa', async () => {
      const { operadorId, apelido, nome } = await operadores.operador()
      const { base32 } = await ativarNoBanco(operadores.pool, operadorId)
      // Uma falha antes: o contador tem o que zerar.
      esperarErro(await entrar(url, { desafio: await desafio(operadorId, 'mfa'), codigo: codigoDoPasso(base32, passoAtual() - 10) }), 401, ErrorCode.NAO_AUTENTICADO)
      expect(await falhasNoContador(operadorId, 'outro')).toBe('1')

      // O Redis de fila recusa o `del` do contador, e só ele: a reserva e a marca do desafio passam.
      const cliente = app.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false })
      const recusa = vi.spyOn(cliente, 'del').mockRejectedValue(new Error('recusado pelo teste'))
      const antes = linhasDeLog.length
      let resposta: Resposta
      try {
        resposta = guardar(await entrar(url, { desafio: await desafio(operadorId, 'mfa'), codigo: codigoDoPasso(base32, passoAtual()) }))
        expect(recusa).toHaveBeenCalledTimes(1)
      } finally {
        recusa.mockRestore()
      }
      expect(resposta.status).toBe(200)
      expect(segundoFatorDeOperadorResponseSchema.safeParse(resposta.corpo).success).toBe(true)
      expect(resposta.setCookie.map((linha) => linha.split('=')[0]).sort()).toEqual([COOKIE_SESSAO_DE_OPERADOR, COOKIE_DISPOSITIVO_DE_OPERADOR].sort())
      expect((await estadoDoOperador(operadores.pool, operadorId)).sessoesAbertas).toBe(1)
      // O contador não foi zerado: ficou com a falha de antes e a reserva desta entrada, e quem o zera agora é o
      // vencimento de 15 min.
      expect(await falhasNoContador(operadorId, 'outro')).toBe('2')

      const linhas = linhasDeLog
        .slice(antes)
        .map((linha) => JSON.parse(linha) as Record<string, unknown>)
        .filter((linha) => linha['msg'] === 'operacao.contador_nao_zerado')
      expect(linhas).toEqual([expect.objectContaining({ level: 'warn', origem: 'operacao', operadorId, requisicaoId: expect.stringMatching(UUID) })])
      const chave = app.get(ContadorDeTentativas).chaveDe(operadorId, 'outro', PREFIXO_DO_CONTADOR_DA_OPERACAO)
      const texto = JSON.stringify(linhas[0])
      for (const daPessoa of [apelido, nome, `${apelido}@turmma.invalid`, chave, chave.split(':')[1] ?? chave]) expect(texto).not.toContain(daPessoa)
      expect(Object.keys(linhas[0] ?? {}).sort()).toEqual(['level', 'msg', 'operadorId', 'origem', 'requisicaoId', 'servico', 'time'])
    })

    it('fora do contexto da requisição (falha de montagem), `entrar` recusa com ERRO_INTERNO antes de tudo: o desafio não é gasto e nenhuma sessão abre', async () => {
      const { operadorId } = await operadores.operador()
      const { base32 } = await ativarNoBanco(operadores.pool, operadorId)
      const pedido = { desafio: await desafio(operadorId, 'mfa'), codigo: codigoDoPasso(base32, passoAtual()) }
      // O middleware abre o contexto em toda requisição HTTP; chamado direto, sem ele, o serviço não inventa um.
      const servico = app.get(SegundoFatorDoOperadorService)
      await expect(servico.entrar(pedido, { cabecalhoCookie: undefined, ip: '203.0.113.9' })).rejects.toMatchObject({ codigo: ErrorCode.ERRO_INTERNO })
      expect((await estadoDoOperador(operadores.pool, operadorId)).sessoesAbertas).toBe(0)
      // O desafio não foi gasto: a mesma entrada, pela rota, abre a sessão.
      expect((await entrar(url, pedido)).status).toBe(200)
    })

    it('com o Redis zerando, a mesma entrada não escreve a linha', async () => {
      const { operadorId } = await operadores.operador()
      const { base32 } = await ativarNoBanco(operadores.pool, operadorId)
      const antes = linhasDeLog.length
      expect((await entrar(url, { desafio: await desafio(operadorId, 'mfa'), codigo: codigoDoPasso(base32, passoAtual()) })).status).toBe(200)
      expect(linhasDeLog.slice(antes).filter((linha) => linha.includes('operacao.contador_nao_zerado'))).toEqual([])
    })
  })

  describe('C39 (MFA): contrato estrito e no-store', () => {
    it('campo a mais, os dois códigos juntos, código fora do formato e desafio ausente: ENTRADA_INVALIDA com no-store, e o desafio não é gasto', async () => {
      const { operadorId } = await operadores.operador()
      const paraConfigurar = await desafio(operadorId, 'configurar_mfa')
      for (const corpo of [{ desafio: paraConfigurar, operadorId }, {}, { desafio: '' }]) {
        const resposta = await pedir(url, 'POST', CONFIGURAR, corpo, doIp())
        esperarErro(resposta, 400, ErrorCode.ENTRADA_INVALIDA)
        expect(resposta.cacheControl).toBe('no-store')
      }
      const { corpo } = await configurar(url, paraConfigurar)
      if (corpo === undefined) throw new Error('configurar recusado')
      const codigo = codigoDoPasso(corpo.segredo, passoAtual())
      for (const invalido of [
        { desafio: corpo.desafio, codigo, operadorId },
        { desafio: corpo.desafio, codigo, recuperacao: corpo.codigosRecuperacao[0] },
        { desafio: corpo.desafio, codigo: '12345' },
        { desafio: corpo.desafio, recuperacao: 'curto' },
        { codigo },
      ]) {
        const resposta = await pedir(url, 'POST', ENTRAR, invalido, doIp())
        esperarErro(resposta, 400, ErrorCode.ENTRADA_INVALIDA)
        expect(resposta.cacheControl).toBe('no-store')
        expect(resposta.setCookie).toEqual([])
      }
      // Recusas do service também saem com no-store.
      const recusada = await entrar(url, { desafio: await desafioInvalido(operadorId, 'mfa'), codigo })
      expect(recusada.cacheControl).toBe('no-store')
      expect((await entrar(url, { desafio: corpo.desafio, codigo })).status).toBe(200)

      // A saída não deixa passar campo a mais.
      const configurado = { uri: corpo.uri, segredo: corpo.segredo, codigosRecuperacao: corpo.codigosRecuperacao, etapa: 'mfa', desafio: corpo.desafio }
      expect(configurarSegundoFatorDeOperadorResponseSchema.safeParse(configurado).success).toBe(true)
      expect(configurarSegundoFatorDeOperadorResponseSchema.safeParse({ ...configurado, operadorId }).success).toBe(false)
      expect(configurarSegundoFatorDeOperadorResponseSchema.safeParse({ ...configurado, versao: 1 }).success).toBe(false)
      const entrada = { token: 'x', expiraEm: new Date().toISOString() }
      expect(segundoFatorDeOperadorResponseSchema.safeParse(entrada).success).toBe(true)
      expect(segundoFatorDeOperadorResponseSchema.safeParse({ ...entrada, refresh: 'x' }).success).toBe(false)
      expect(segundoFatorDeOperadorResponseSchema.safeParse({ ...entrada, sessaoId: randomUUID() }).success).toBe(false)
    })
  })

  describe('C47 (cookie real): o cookie de operador emitido aqui não alcança a escola', () => {
    it('o `turmma_operacao` e o dispositivo, com e sem o token de operador, em toda rota de escola com sessão, respondem igual a rota inexistente; e a renovação da escola não os aceita', async () => {
      const ativo = await operadorAtivo()
      const cookieDoOperador = ativo.setCookie.map((linha) => linha.split(';')[0]).join('; ')
      expect(cookieDoOperador).toContain(`${COOKIE_SESSAO_DE_OPERADOR}=`)
      const rotas = rotasDe(
        app
          .get(DiscoveryService)
          .getControllers()
          .map((embrulho) => embrulho.metatype)
          .filter((metatipo): metatipo is Type => typeof metatipo === 'function'),
      )
      const daEscolaComSessao = rotas.filter((rota) => rota.marcador === undefined && !rota.anonima)
      expect(daEscolaComSessao.map((rota) => `${rota.verbo} ${rota.caminho}`)).toEqual(expect.arrayContaining(['GET /v1/eu', 'GET /v1/turmas', 'POST /v1/sessao/escola']))
      const sessaoDoOperador = `${COOKIE_SESSAO_DE_OPERADOR}=${valorDoCookie(ativo.setCookie, COOKIE_SESSAO_DE_OPERADOR) ?? ''}`
      for (const cabecalhos of [{ Cookie: sessaoDoOperador }, { Cookie: cookieDoOperador }, { Cookie: cookieDoOperador, Authorization: `Bearer ${ativo.token}` }] satisfies Cabecalhos[]) {
        const diferentes: string[] = []
        for (const rota of daEscolaComSessao) {
          const [naRota, naInexistente] = await Promise.all([
            pedir(url, rota.verbo, caminhoConcreto(rota.caminho), undefined, cabecalhos),
            pedir(url, rota.verbo, `/v1/nao-existe-${randomUUID()}`, undefined, cabecalhos),
          ])
          expect(naInexistente.status).toBe(404)
          if (!isDeepStrictEqual(forma(naRota), forma(naInexistente))) diferentes.push(`${rota.verbo} ${rota.caminho}`)
        }
        expect(diferentes).toEqual([])
      }
      // O de dispositivo sozinho não é credencial de nada: a rota de escola responde como a qualquer um sem credencial.
      const soDispositivo = `${COOKIE_DISPOSITIVO_DE_OPERADOR}=${valorDoCookie(ativo.setCookie, COOKIE_DISPOSITIVO_DE_OPERADOR) ?? ''}`
      expect(forma(await pedir(url, 'GET', '/v1/eu', undefined, { Cookie: soDispositivo }))).toEqual(forma(await pedir(url, 'GET', '/v1/eu')))
      // A renovação da escola procura o `educa_sessao`: com o do operador, não renova nada nem grava sessão de escola.
      const renovacao = await pedir(url, 'POST', '/v1/sessao/renovar', undefined, { Cookie: cookieDoOperador })
      esperarErro(renovacao, 401, ErrorCode.NAO_AUTENTICADO)
      expect(renovacao.setCookie.filter((linha) => linha.startsWith(`${COOKIE_SESSAO}=`) && !linha.startsWith(`${COOKIE_SESSAO}=;`))).toEqual([])
      // E o operador continua com a sessão dele.
      expect((await eu(ativo.token)).status).toBe(200)
    })
  })

  it('privacidade: o log do fluxo inteiro, com as recusas, não tem segredo, URI, código, desafio, token, cookie nem senha', () => {
    const log = linhasDeLog.join('\n')
    expect(log).toContain('http.erro')
    expect(segredosVistos.size).toBeGreaterThan(30)
    const vazados = [...segredosVistos].filter((segredo) => segredo.length >= 6 && log.includes(segredo))
    expect(vazados).toEqual([])
  })
})

describe('segundo fator do operador com o Redis de fila fora (C13)', () => {
  const operadores = new BancadaDeOperadores()
  let app: INestApplication
  let url: string
  let cliente: Redis

  beforeAll(async () => {
    ;({ app, url } = await subir())
    cliente = app.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false })
    const prazo = performance.now() + 10_000
    while (cliente.status !== 'ready' && performance.now() < prazo) await new Promise((resolver) => setTimeout(resolver, 20))
  })

  afterAll(async () => {
    await app.close()
    await operadores.fechar()
  })

  it('configurar e `/sessao/mfa` respondem 503 INDISPONIVEL_TENTE_DE_NOVO, nunca aceitam, e o desafio não fica gasto: com o Redis de volta, os mesmos desafios valem', async () => {
    // A: configurado, com o desafio `mfa` na mão. B: ainda sem nada, com o desafio `configurar_mfa` na mão.
    const a = await operadores.operador()
    const { corpo } = await configurar(url, await desafio(a.operadorId, 'configurar_mfa'))
    if (corpo === undefined) throw new Error('configurar recusado')
    const b = await operadores.operador()
    const paraConfigurar = await desafio(b.operadorId, 'configurar_mfa')
    const [antesDeA, antesDeB] = [await estadoDoOperador(operadores.pool, a.operadorId), await estadoDoOperador(operadores.pool, b.operadorId)]

    // Esta instância perde o Redis de fila do login (as outras suítes seguem com o delas): o `jti` não tem onde marcar.
    cliente.disconnect()
    try {
      await expect.poll(() => cliente.status, { timeout: 5_000, interval: 10 }).toBe('end')
      const { resposta: semConfigurar } = await configurar(url, paraConfigurar)
      esperarErro(semConfigurar, 503, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
      expect(Number(semConfigurar.retryAfter)).toBeGreaterThanOrEqual(1)
      expect(semConfigurar.cacheControl).toBe('no-store')
      const semEntrar = await entrar(url, { desafio: corpo.desafio, codigo: codigoDoPasso(corpo.segredo, passoAtual()) })
      esperarErro(semEntrar, 503, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
      expect(semEntrar.setCookie).toEqual([])
      // Nada mudou: nem o segredo, nem os códigos, nem a ativação, nem o passo, nem sessão.
      expect(await estadoDoOperador(operadores.pool, a.operadorId)).toEqual(antesDeA)
      expect(await estadoDoOperador(operadores.pool, b.operadorId)).toEqual(antesDeB)
    } finally {
      await cliente.connect()
    }
    expect(cliente.status).toBe('ready')
    expect((await entrar(url, { desafio: corpo.desafio, codigo: codigoDoPasso(corpo.segredo, passoAtual()) })).status).toBe(200)
    expect((await configurar(url, paraConfigurar)).resposta.status).toBe(200)
  })
})

describe('segundo fator do operador: o limite (C32 e C34)', () => {
  const LIMITE_POR_IP = 3
  const operadores = new BancadaDeOperadores()
  let app: INestApplication
  let url: string

  beforeAll(async () => {
    ;({ app, url } = await subir(configuracaoDeTeste({ ambiente: { LIMITE_REQ_IP_ANONIMO_MIN: String(LIMITE_POR_IP), LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' } })))
  })

  afterAll(async () => {
    await app.close()
    await operadores.fechar()
  })

  it('C32: `mfa/configurar` acima do `rl:ip:op` responde 429 LIMITE_EXCEDIDO com Retry-After; outro IP segue', async () => {
    const { operadorId } = await operadores.operador()
    const [ip, outro] = [ipSorteado(), ipSorteado()]
    const invalido = await desafioInvalido(operadorId, 'configurar_mfa')
    for (let vez = 0; vez < LIMITE_POR_IP; vez++) esperarErro((await configurar(url, invalido, doIp(ip))).resposta, 401, ErrorCode.NAO_AUTENTICADO)
    const { resposta: recusada } = await configurar(url, invalido, doIp(ip))
    esperarErro(recusada, 429, ErrorCode.LIMITE_EXCEDIDO)
    expect(Number(recusada.retryAfter)).toBeGreaterThanOrEqual(1)
    expect(recusada.cacheControl).toBe('no-store')
    esperarErro((await configurar(url, invalido, doIp(outro))).resposta, 401, ErrorCode.NAO_AUTENTICADO)
  })

  it('C34: `/sessao/mfa` é recusado pelo contador do `operador.id`, nunca pelo IP: X errando do IP segura só X (e só a origem `outro`), e Y entra pelo mesmo IP', async () => {
    const ip = ipSorteado()
    // X e Y com o segundo fator ativo, cada um pelo seu primeiro código; X guarda o cookie de dispositivo dessa entrada.
    const ativar = async () => {
      const { operadorId } = await operadores.operador()
      const { corpo } = await configurar(url, await desafio(operadorId, 'configurar_mfa'))
      if (corpo === undefined) throw new Error('configurar recusado')
      const resposta = await entrar(url, { desafio: corpo.desafio, codigo: codigoDoPasso(corpo.segredo, passoAtual()) })
      expect(resposta.status).toBe(200)
      return { operadorId, base32: corpo.segredo, dispositivo: valorDoCookie(resposta.setCookie, COOKIE_DISPOSITIVO_DE_OPERADOR) ?? '' }
    }
    const [x, y] = [await ativar(), await ativar()]
    const errado = codigoDoPasso(x.base32, passoAtual() - 10)

    // Cinco erros de X, cada um com um desafio novo, do mesmo IP e acima do `rl:ip:op`: nenhum 429 LIMITE_EXCEDIDO.
    const erros: Resposta[] = []
    for (let vez = 0; vez < 5; vez++) erros.push(await entrar(url, { desafio: await desafio(x.operadorId, 'mfa'), codigo: errado }, doIp(ip)))
    for (const resposta of erros.slice(0, 4)) esperarErro(resposta, 401, ErrorCode.NAO_AUTENTICADO)
    const quinto = erros[4]
    if (quinto === undefined) throw new Error('quinto erro ausente')
    esperarErro(quinto, 429, ErrorCode.CONTA_SEGURADA)
    expect(Number(quinto.retryAfter)).toBeGreaterThanOrEqual(1)

    // Segurado, X não entra nem com o código certo, e o código não é gasto.
    const passoAntes = (await estadoDoOperador(operadores.pool, x.operadorId)).ultimoPasso
    esperarErro(await entrar(url, { desafio: await desafio(x.operadorId, 'mfa'), codigo: codigoDoPasso(x.base32, passoAtual() + 1) }, doIp(ip)), 429, ErrorCode.CONTA_SEGURADA)
    expect((await estadoDoOperador(operadores.pool, x.operadorId)).ultimoPasso).toBe(passoAntes)

    // Y, do mesmo IP, entra: o contador é o do operador, não o do IP.
    expect((await entrar(url, { desafio: await desafio(y.operadorId, 'mfa'), codigo: codigoDoPasso(y.base32, passoAtual() + 1) }, doIp(ip))).status).toBe(200)
    // X, do navegador que já entrou (o cookie de dispositivo que o `/sessao/mfa` gravou), conta na origem `conhecido`, que o script não segurou.
    const conhecido = await entrar(url, { desafio: await desafio(x.operadorId, 'mfa'), codigo: codigoDoPasso(x.base32, passoAtual() + 1) }, { ...doIp(ip), Cookie: `${COOKIE_DISPOSITIVO_DE_OPERADOR}=${x.dispositivo}` })
    expect(conhecido.status).toBe(200)
  })
})
