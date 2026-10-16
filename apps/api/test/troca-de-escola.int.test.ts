import 'reflect-metadata'
import { criarLogger, EmissorDeToken } from '@educa/nucleo'
import { CodigoDeErro, type PapelDeUsuario } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { Redis } from 'ioredis'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { SignJWT } from 'jose'
import { Secret, TOTP } from 'otpauth'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { travarRedis } from '../../../tools/testes/redis-travado.ts'
import { AppModule } from '../src/app.module.js'
import { configurarAplicacao } from '../src/configurar-app.js'
import { CifraDoSegredo } from '../src/sessao/cifra-do-segredo.js'
import { AUDIENCIA_DESAFIO, EmissorDeDesafio, TIPO_DESAFIO, VALIDADE_DESAFIO_SEGUNDOS } from '../src/sessao/desafio.js'
import { gerarSegredo } from '../src/sessao/segundo-fator.js'
import { HashDeSenha } from '../src/sessao/hash-de-senha.js'
import { CLIENTE_REDIS_LOGIN } from '../src/sessao/sessao.module.js'
import { configuracaoDeTeste, MONTAGEM_DE_TESTE } from './configuracao-de-teste.js'
import { montarEscolaComTurma } from './escola-com-turma.js'
import { BancadaDeSessoes } from './sessao-de-teste.js'

/** Senha sintética das contas deste teste: nenhuma é de pessoa real. */
const SENHA_SINTETICA = 'senha-sintetica-correta-1'
const PERIODO_MS = 30_000
/**
 * Quanto o Redis de fila fica conectado e sem responder no teste do prazo do login: dez vezes os 100 ms do cliente de
 * produção, e metade dos 2 s do cliente da fila. É o que o runner carregado da esteira produz sozinho. A folga para
 * cima é de propósito: com margem curta, o `conferirLivre` que saísse depois da pausa deixaria o teste verde sem ter
 * provado nada, justamente na máquina para a qual ele foi escrito.
 */
const PAUSA_DO_RUNNER_CARREGADO_MS = 1_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

interface Resposta {
  status: number
  corpo: Record<string, unknown> & { erro?: { codigo?: string; requisicaoId?: string } }
  setCookie: string[]
}

interface Pessoa {
  email: string
  contaId: string
  usuarioId: string
  escolaId: string
}

interface LinhaDeSessao {
  id: string
  familia: string
  metodo: string
  conta_id: string | null
  encerrada_em: Date | null
  motivo: string | null
}

async function clientePronto(cliente: Redis): Promise<void> {
  const prazo = performance.now() + 15_000
  while (cliente.status !== 'ready') {
    if (performance.now() > prazo) throw new Error('o cliente do Redis de fila do login não conectou')
    await new Promise((resolver) => setTimeout(resolver, 20))
  }
}

function codigoDeAgora(base32: string): string {
  return TOTP.generate({ secret: Secret.fromBase32(base32), algorithm: 'SHA1', digits: 6, period: 30, timestamp: Math.floor(Date.now() / PERIODO_MS) * PERIODO_MS })
}

/** O corpo de erro sem o `requisicaoId`, que muda a cada requisição. */
function semRequisicao(corpo: Resposta['corpo']): unknown {
  return { ...corpo, erro: { ...corpo.erro, requisicaoId: undefined } }
}

function nomesDosCookies(resposta: Resposta): string[] {
  return resposta.setCookie.map((linha) => linha.split('=')[0] ?? '').sort()
}

describe('POST /v1/sessao/escola e /v1/eu.acessos: quem trabalha em mais de uma escola escolhe e troca', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const configuracao = configuracaoDeTeste()
  const cifra = new CifraDoSegredo(configuracao.login.mfa.versaoCifra, configuracao.login.mfa.chavesCifra)
  const linhasDeLog: string[] = []
  /** Tudo que foi mandado ou recebido e não pode aparecer no log: e-mails, desafios, tokens e cookies. */
  const segredosVistos = new Set<string>([SENHA_SINTETICA])
  let app: INestApplication
  let url: string
  let hash: HashDeSenha

  beforeAll(async () => {
    app = await NestFactory.create(AppModule.com(configuracao, { medidor: medidor.medidor, ...MONTAGEM_DE_TESTE }), { logger: false })
    configurarAplicacao(app, criarLogger({ servico: 'api-teste', nivel: 'trace', destino: { write: (linha: string) => linhasDeLog.push(linha) } }), medidor.medidor)
    await app.listen(0, '127.0.0.1')
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
    hash = app.get(HashDeSenha)
    await clientePronto(app.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false }))
  })

  afterAll(async () => {
    await app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  /**
   * Escola nova, cada uma na sua rede, com nome próprio na escola e na rede (o `acessos` mostra os dois, 12.0 da A1) e a
   * inatividade da equipe pedida. Duas escolas nunca dividem o nome da rede: é o que deixa o teste provar que cada acesso
   * traz a rede da própria escola.
   */
  async function escola(prefixo: string, inatividadeEquipeMin = 120): Promise<{ id: string; nome: string; redeId: string; redeNome: string }> {
    const id = await bancada.escola()
    const marca = randomUUID().slice(0, 8)
    const nome = `${prefixo} ${marca}`
    const redeNome = `Rede de ${prefixo} ${marca}`
    await bancada.pool.query('update escola set nome = $1, inatividade_equipe_min = $2 where id = $3', [nome, inatividadeEquipeMin, id])
    const { rows } = await bancada.pool.query<{ id: string }>('update rede set nome = $1 where id = (select rede_id from escola where id = $2) returning id', [redeNome, id])
    return { id, nome, redeId: rows[0]?.id ?? '', redeNome }
  }

  /** Uma conta com senha e um usuário ativo na escola, com o papel pedido. */
  async function pessoa(escolaId: string, papel: PapelDeUsuario = 'professor'): Promise<Pessoa> {
    const email = `equipe-${randomUUID()}@escola.invalid`
    segredosVistos.add(email)
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email, senha_hash) values ($1, $2) returning id', [email, await hash.gerar(SENHA_SINTETICA)])
    const contaId = contas[0]?.id ?? ''
    const { rows } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, 'Pessoa sintética') returning id", [escolaId, contaId, papel])
    return { email, contaId, usuarioId: rows[0]?.id ?? '', escolaId }
  }

  /** O usuário da mesma conta em outra escola: a professora que dá aula em duas. */
  async function naOutraEscola(quem: Pessoa, escolaId: string, papel: PapelDeUsuario = 'professor'): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, 'Pessoa sintética') returning id", [escolaId, quem.contaId, papel])
    return rows[0]?.id ?? ''
  }

  /** Liga o MFA da conta direto no banco, com a cifra de produção: é o estado depois do `ativar`. Devolve o segredo. */
  async function comMfaAtivo(quem: Pessoa): Promise<string> {
    const novo = gerarSegredo()
    segredosVistos.add(novo.base32)
    const { cifrado, versao } = cifra.cifrar(novo.bytes, quem.contaId)
    await bancada.pool.query('update conta set mfa_segredo_cifrado = $1, mfa_chave_versao = $2, mfa_ativado_em = now(), mfa_ultimo_passo = null where id = $3', [cifrado, versao, quem.contaId])
    return novo.base32
  }

  async function lerResposta(resposta: Response): Promise<Resposta> {
    const texto = await resposta.text()
    const setCookie = resposta.headers.getSetCookie()
    for (const linha of setCookie) segredosVistos.add(linha.split(';')[0]?.split('=').slice(1).join('=') ?? '')
    const corpo = texto === '' ? {} : (JSON.parse(texto) as Resposta['corpo'])
    for (const campo of ['desafio', 'token'] as const) if (typeof corpo[campo] === 'string') segredosVistos.add(corpo[campo])
    return { status: resposta.status, corpo, setCookie }
  }

  async function entrar(email: string): Promise<Resposta> {
    return lerResposta(await fetch(`${url}/v1/sessao/email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha: SENHA_SINTETICA }) }))
  }

  /** `POST /v1/sessao/escola` com o desafio `escolher` ou o token de acesso no `Authorization`. */
  async function escolherEscola(credencial: string, usuarioId: string): Promise<Resposta> {
    return lerResposta(
      await fetch(`${url}/v1/sessao/escola`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${credencial}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId }),
      }),
    )
  }

  async function segundoFator(desafio: string, codigo: string): Promise<Resposta> {
    return lerResposta(
      await fetch(`${url}/v1/sessao/mfa`, { method: 'POST', headers: { Authorization: `Bearer ${desafio}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo }) }),
    )
  }

  async function obter(caminho: string, token: string): Promise<Resposta> {
    return lerResposta(await fetch(`${url}${caminho}`, { headers: { Authorization: `Bearer ${token}` } }))
  }

  async function sair(token: string): Promise<Resposta> {
    return lerResposta(await fetch(`${url}/v1/sessao`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }))
  }

  const texto = (valor: unknown) => (typeof valor === 'string' ? valor : '')

  /** A pessoa entra por e-mail e escolhe o usuário (ou entra direto, se só tem um): devolve o token de acesso. */
  async function entrarComo(quem: Pessoa, usuarioId: string): Promise<string> {
    const login = await entrar(quem.email)
    expect(login.status).toBe(200)
    if (login.corpo['etapa'] === 'pronta') return texto(login.corpo['token'])
    expect(login.corpo['etapa']).toBe('escolher')
    const escolhido = await escolherEscola(texto(login.corpo['desafio']), usuarioId)
    expect(escolhido.corpo['etapa']).toBe('pronta')
    return texto(escolhido.corpo['token'])
  }

  async function sessoesDe(escolaId: string, usuarioId: string): Promise<LinhaDeSessao[]> {
    const { rows } = await bancada.pool.query<LinhaDeSessao>(
      'select id, familia, metodo, conta_id, encerrada_em, motivo from sessao where escola_id = $1 and usuario_id = $2 order by id',
      [escolaId, usuarioId],
    )
    return rows
  }

  async function sessaoUnica(escolaId: string, usuarioId: string): Promise<LinhaDeSessao> {
    const sessoes = await sessoesDe(escolaId, usuarioId)
    expect(sessoes).toHaveLength(1)
    const [unica] = sessoes
    if (unica === undefined) throw new Error('sessão não achada')
    return unica
  }

  /** O registro de acesso da escola, em ordem: só evento e usuário. */
  async function registroDe(escolaId: string): Promise<Array<{ evento: string; usuario_id: string | null }>> {
    const { rows } = await bancada.pool.query<{ evento: string; usuario_id: string | null }>('select evento, usuario_id from registro_acesso where escola_id = $1 order by em, id', [escolaId])
    return rows
  }

  function esperarNaoEncontrado(resposta: Resposta): void {
    expect(resposta.status).toBe(404)
    expect(resposta.corpo.erro?.codigo).toBe(CodigoDeErro.NAO_ENCONTRADO)
    expect(resposta.setCookie).toEqual([])
  }

  it('caminho feliz (RF14): entra por e-mail, recebe escolher, escolhe A e troca para B; a sessão de A fica encerrada com troca_de_escola, e o login fica no registro de B', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const emB = await naOutraEscola(professora, b.id)
    // Outra conta, com usuário ativo nas mesmas duas escolas: nada dela pode entrar na lista da professora.
    const outra = await pessoa(a.id)
    await naOutraEscola(outra, b.id)

    const login = await entrar(professora.email)
    // A tela da escolha não tem outra fonte para a lista: o desafio é opaco para o cliente (20.0). Vêm as duas
    // escolas da conta, com nome e papel, em ordem de nome, e nada mais de nenhuma delas.
    expect(login.corpo).toEqual({
      etapa: 'escolher',
      desafio: expect.any(String),
      acessos: [
        { usuarioId: professora.usuarioId, escolaNome: a.nome, redeNome: a.redeNome, papel: 'professor' },
        { usuarioId: emB, escolaNome: b.nome, redeNome: b.redeNome, papel: 'professor' },
      ].sort((um, outro) => um.escolaNome.localeCompare(outro.escolaNome)),
    })
    expect(login.setCookie).toEqual([])
    expect(await sessoesDe(a.id, professora.usuarioId)).toEqual([])

    // A escolha conclui o login: grava a sessão e, só agora, os dois cookies (o que a 4.0 deixou para esta etapa).
    const desafio = texto(login.corpo['desafio'])
    const escolhaDeA = await escolherEscola(desafio, professora.usuarioId)
    expect(escolhaDeA.status).toBe(200)
    expect(escolhaDeA.corpo).toEqual({ etapa: 'pronta', token: expect.any(String), expiraEm: expect.any(String) })
    expect(nomesDosCookies(escolhaDeA)).toEqual(['educa_dispositivo', 'educa_sessao'])
    // O desafio foi consumido na conclusão: não abre uma segunda sessão.
    expect((await escolherEscola(desafio, emB)).status).toBe(401)
    const tokenA = texto(escolhaDeA.corpo['token'])
    const sessaoA = await sessaoUnica(a.id, professora.usuarioId)
    expect(sessaoA).toMatchObject({ metodo: 'email', conta_id: professora.contaId, encerrada_em: null })
    expect((await obter('/v1/eu', tokenA)).corpo).toMatchObject({ usuarioId: professora.usuarioId, escola: { id: a.id } })

    const troca = await escolherEscola(tokenA, emB)
    expect(troca.status).toBe(200)
    expect(troca.corpo).toEqual({ etapa: 'pronta', token: expect.any(String), expiraEm: expect.any(String) })
    expect(nomesDosCookies(troca)).toEqual(['educa_dispositivo', 'educa_sessao'])
    const tokenB = texto(troca.corpo['token'])

    const eu = await obter('/v1/eu', tokenB)
    expect(eu.status).toBe(200)
    expect(eu.corpo).toMatchObject({ usuarioId: emB, papel: 'professor', escola: { id: b.id, nome: b.nome } })

    const encerradaA = await sessaoUnica(a.id, professora.usuarioId)
    expect(encerradaA).toMatchObject({ id: sessaoA.id, motivo: 'troca_de_escola' })
    expect(encerradaA.encerrada_em).not.toBeNull()
    const sessaoB = await sessaoUnica(b.id, emB)
    expect(sessaoB).toMatchObject({ metodo: 'email', conta_id: professora.contaId, encerrada_em: null })
    expect(sessaoB.familia).not.toBe(sessaoA.familia)
    // O cookie de renovação da resposta é o da sessão nova, e não o da origem.
    const refresh = troca.setCookie.find((linha) => linha.startsWith('educa_sessao='))?.split(';')[0]?.slice('educa_sessao='.length) ?? ''
    const { rows: comHash } = await bancada.pool.query<{ id: string }>('select id from sessao where refresh_hash = $1', [createHash('sha256').update(refresh).digest('hex')])
    expect(comHash).toEqual([{ id: sessaoB.id }])

    const { rows: registroB } = await bancada.pool.query<{ evento: string; usuario_id: string }>('select evento, usuario_id from registro_acesso where escola_id = $1', [b.id])
    expect(registroB).toEqual([{ evento: 'login', usuario_id: emB }])
    // A saída de A fica no registro de acesso de A (17.5), só com o usuário de A: a sessão sai em 30 dias, o registro fica 6 meses.
    expect(await registroDe(a.id)).toEqual([
      { evento: 'login', usuario_id: professora.usuarioId },
      { evento: 'saida', usuario_id: professora.usuarioId },
    ])

    // Nada do fluxo foi para o log: nem o e-mail, nem o desafio, nem os tokens, nem os cookies.
    const log = linhasDeLog.join('\n')
    for (const segredo of segredosVistos) if (segredo.length > 0) expect(log.includes(segredo), 'um segredo do fluxo foi ao log').toBe(false)
  })

  it('a data da introdução vista não vai na lista da etapa escolher: com a data gravada nas duas escolas, o corpo é o mesmo de antes', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const emB = await naOutraEscola(professora, b.id)
    await bancada.pool.query("update usuario set introducao_vista_em = '2020-01-02T03:04:05.678Z' where id = any($1::uuid[])", [[professora.usuarioId, emB]])

    const login = await entrar(professora.email)

    expect(login.corpo).toEqual({
      etapa: 'escolher',
      desafio: expect.any(String),
      acessos: [
        { usuarioId: professora.usuarioId, escolaNome: a.nome, redeNome: a.redeNome, papel: 'professor' },
        { usuarioId: emB, escolaNome: b.nome, redeNome: b.redeNome, papel: 'professor' },
      ].sort((um, outro) => um.escolaNome.localeCompare(outro.escolaNome)),
    })
    expect(JSON.stringify(login.corpo)).not.toContain('2020')
  })

  it('isolamento: o token antigo de A, depois da troca, recebe 401 na requisição seguinte', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const emB = await naOutraEscola(professora, b.id)
    const tokenA = await entrarComo(professora, professora.usuarioId)
    expect((await obter('/v1/eu', tokenA)).status).toBe(200)

    expect((await escolherEscola(tokenA, emB)).status).toBe(200)

    const depois = await obter('/v1/eu', tokenA)
    expect(depois.status).toBe(401)
    expect(depois.corpo.erro?.codigo).toBe(CodigoDeErro.NAO_AUTENTICADO)
    // E a sessão encerrada não troca de novo.
    expect((await escolherEscola(tokenA, professora.usuarioId)).status).toBe(401)
  })

  it('isolamento: depois da troca para B, a turma do vínculo em A com o token novo responde 404, igual a turma inexistente', async () => {
    const api = { app, url }
    const escolaA = await montarEscolaComTurma(api, bancada)
    const b = await escola('Escola da rede')
    const professora = await pessoa(escolaA.coordenacao.escolaId)
    await bancada.pool.query(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'professor', 'confirmado', $6, now())`,
      [escolaA.coordenacao.escolaId, escolaA.anoLetivoId, professora.usuarioId, escolaA.turma, escolaA.quimica, escolaA.coordenacao.usuarioId],
    )
    const emB = await naOutraEscola(professora, b.id)
    const tokenA = await entrarComo(professora, professora.usuarioId)
    // Com A ativa, a turma do vínculo confirmado responde: o 404 de depois é da sessão presa a B, e não do vínculo.
    expect((await obter(`/v1/turmas/${escolaA.turma}`, tokenA)).status).toBe(200)

    const tokenB = texto((await escolherEscola(tokenA, emB)).corpo['token'])
    const daTurmaDeA = await obter(`/v1/turmas/${escolaA.turma}`, tokenB)
    const inexistente = await obter(`/v1/turmas/${randomUUID()}`, tokenB)
    expect(daTurmaDeA.status).toBe(404)
    expect(semRequisicao(daTurmaDeA.corpo)).toEqual(semRequisicao(inexistente.corpo))
    expect(JSON.stringify(daTurmaDeA.corpo)).not.toContain(escolaA.turma)
  })

  it('isolamento: escolher e trocar com o usuarioId de outra conta, real e ativo em B, dão 404 igual a inexistente, e o desafio recusado continua valendo', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const emB = await naOutraEscola(professora, b.id)
    const deOutraConta = await pessoa(b.id)

    const login = await entrar(professora.email)
    const desafio = texto(login.corpo['desafio'])
    const outraConta = await escolherEscola(desafio, deOutraConta.usuarioId)
    const inexistente = await escolherEscola(desafio, randomUUID())
    esperarNaoEncontrado(outraConta)
    expect(semRequisicao(outraConta.corpo)).toEqual(semRequisicao(inexistente.corpo))
    expect(await sessoesDe(b.id, deOutraConta.usuarioId)).toEqual([])

    // O 404 não consome o desafio: a escolha certa ainda conclui.
    const certa = await escolherEscola(desafio, professora.usuarioId)
    expect(certa.corpo['etapa']).toBe('pronta')
    const tokenA = texto(certa.corpo['token'])

    const trocaOutraConta = await escolherEscola(tokenA, deOutraConta.usuarioId)
    const trocaInexistente = await escolherEscola(tokenA, randomUUID())
    esperarNaoEncontrado(trocaOutraConta)
    expect(semRequisicao(trocaOutraConta.corpo)).toEqual(semRequisicao(trocaInexistente.corpo))
    expect(await sessoesDe(b.id, deOutraConta.usuarioId)).toEqual([])
    expect(await sessoesDe(b.id, emB)).toEqual([])
    // A sessão de origem segue aberta: o pedido recusado não encerra nada.
    expect((await obter('/v1/eu', tokenA)).status).toBe(200)
  })

  it('permissão: o typ desafio+jwt no cabeçalho não é confiado; desafio escolher de outra chave, vencido ou com outro aud dá 401, sem cookie e sem sessão', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const emB = await naOutraEscola(professora, b.id)
    const { chaveAssinatura } = configuracao.identidade
    const pedido = { contaId: professora.contaId, etapa: 'escolher', mfaCumprido: true } as const

    const deOutraChave = await new EmissorDeDesafio(new TextEncoder().encode('outra-chave-sintetica-de-assinatura-32b')).emitir(pedido)
    const vencido = await new EmissorDeDesafio(chaveAssinatura, { agora: () => new Date(Date.now() - (VALIDADE_DESAFIO_SEGUNDOS + 5) * 1_000) }).emitir(pedido)
    const deOutroAud = await new SignJWT({ conta_id: professora.contaId, etapa: 'escolher', mfa_cumprido: true })
      .setProtectedHeader({ alg: 'HS256', typ: TIPO_DESAFIO })
      .setIssuer('educa')
      .setAudience(`${AUDIENCIA_DESAFIO}-outra`)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(chaveAssinatura)

    for (const falso of [deOutraChave, vencido, deOutroAud]) {
      for (const usuarioId of [professora.usuarioId, emB]) {
        const resposta = await escolherEscola(falso, usuarioId)
        expect(resposta.status).toBe(401)
        expect(resposta.corpo.erro?.codigo).toBe(CodigoDeErro.NAO_AUTENTICADO)
        expect(resposta.setCookie).toEqual([])
      }
    }
    expect(await sessoesDe(a.id, professora.usuarioId)).toEqual([])
    expect(await sessoesDe(b.id, emB)).toEqual([])
    // O controle: o desafio verdadeiro, da mesma conta, passa.
    expect((await escolherEscola(texto((await entrar(professora.email)).corpo['desafio']), emB)).corpo['etapa']).toBe('pronta')
  })

  it('borda: professora em A e coordenadora em B; ir para B pede o MFA, e sem concluí-lo a sessão de A continua e nenhuma de B existe; com o código, entra em B e encerra A', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const coordenadoraEmB = await naOutraEscola(professora, b.id, 'coordenador')
    const segredo = await comMfaAtivo(professora)
    const tokenA = await entrarComo(professora, professora.usuarioId)

    const troca = await escolherEscola(tokenA, coordenadoraEmB)
    expect(troca.status).toBe(200)
    expect(troca.corpo).toEqual({ etapa: 'mfa', desafio: expect.any(String) })
    expect(troca.setCookie).toEqual([])
    expect(await sessoesDe(b.id, coordenadoraEmB)).toEqual([])
    expect((await obter('/v1/eu', tokenA)).status).toBe(200)
    expect((await sessaoUnica(a.id, professora.usuarioId)).encerrada_em).toBeNull()
    // O desafio do MFA não serve de token de acesso nem como escolha.
    expect((await obter('/v1/eu', texto(troca.corpo['desafio']))).status).toBe(401)
    expect((await escolherEscola(texto(troca.corpo['desafio']), coordenadoraEmB)).status).toBe(401)

    const comCodigo = await segundoFator(texto(troca.corpo['desafio']), codigoDeAgora(segredo))
    expect(comCodigo.status).toBe(200)
    expect(comCodigo.corpo).toEqual({ etapa: 'pronta', token: expect.any(String), expiraEm: expect.any(String) })
    expect(nomesDosCookies(comCodigo)).toEqual(['educa_dispositivo', 'educa_sessao'])
    expect((await obter('/v1/eu', texto(comCodigo.corpo['token']))).corpo).toMatchObject({ usuarioId: coordenadoraEmB, papel: 'coordenador', escola: { id: b.id } })
    expect((await obter('/v1/eu', tokenA)).status).toBe(401)
    expect(await sessaoUnica(a.id, professora.usuarioId)).toMatchObject({ motivo: 'troca_de_escola' })
    expect(await sessaoUnica(b.id, coordenadoraEmB)).toMatchObject({ metodo: 'email', encerrada_em: null })
    const { rows: registroB } = await bancada.pool.query<{ evento: string; usuario_id: string }>('select evento, usuario_id from registro_acesso where escola_id = $1', [b.id])
    expect(registroB).toEqual([{ evento: 'login', usuario_id: coordenadoraEmB }])
  })

  it('borda (17.5): com o código do MFA recusado na troca para a coordenação de B, nada é gravado em A nem em B; com o código certo, saida em A e login em B, cada um só com o usuário da própria escola', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const coordenadoraEmB = await naOutraEscola(professora, b.id, 'coordenador')
    const segredo = await comMfaAtivo(professora)
    const tokenA = await entrarComo(professora, professora.usuarioId)
    const antesDaTroca = await registroDe(a.id)
    expect(antesDaTroca).toEqual([{ evento: 'login', usuario_id: professora.usuarioId }])

    const troca = await escolherEscola(tokenA, coordenadoraEmB)
    expect(troca.corpo['etapa']).toBe('mfa')
    const codigoCerto = codigoDeAgora(segredo)
    const recusado = await segundoFator(texto(troca.corpo['desafio']), codigoCerto === '000000' ? '111111' : '000000')
    expect(recusado.status).toBe(401)
    expect(await registroDe(a.id)).toEqual(antesDaTroca)
    expect(await registroDe(b.id)).toEqual([])
    expect((await sessaoUnica(a.id, professora.usuarioId)).encerrada_em).toBeNull()

    expect((await segundoFator(texto(troca.corpo['desafio']), codigoCerto)).corpo['etapa']).toBe('pronta')
    expect(await registroDe(a.id)).toEqual([...antesDaTroca, { evento: 'saida', usuario_id: professora.usuarioId }])
    expect(await registroDe(b.id)).toEqual([{ evento: 'login', usuario_id: coordenadoraEmB }])
  })

  it('borda: coordenadora em A trocando para a coordenação de B também informa o código; sem MFA configurado, a troca leva a configurar_mfa e não encerra A', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const coordenadora = await pessoa(a.id, 'coordenador')
    const emB = await naOutraEscola(coordenadora, b.id, 'coordenador')

    // Sem MFA na conta: o login da coordenação de A já pede a configuração, então a sessão de A vem do banco.
    const semMfa = await bancada.pool.query<{ id: string }>(
      "insert into sessao (escola_id, conta_id, usuario_id, metodo, familia, refresh_hash, expira_em) values ($1, $2, $3, 'email', uuidv7(), $4, now() + interval '12 hours') returning id",
      [a.id, coordenadora.contaId, coordenadora.usuarioId, randomBytes(32).toString('hex')],
    )
    const sessaoA = semMfa.rows[0]?.id ?? ''
    const { token: tokenSemMfa } = await new EmissorDeToken(configuracao.identidade.chaveAssinatura).emitir({ escolaId: a.id, usuarioId: coordenadora.usuarioId, sessaoId: sessaoA })
    const configurar = await escolherEscola(tokenSemMfa, emB)
    expect(configurar.corpo).toEqual({ etapa: 'configurar_mfa', desafio: expect.any(String) })
    expect(configurar.setCookie).toEqual([])
    expect(await sessoesDe(b.id, emB)).toEqual([])
    expect((await obter('/v1/eu', tokenSemMfa)).status).toBe(200)

    const segredo = await comMfaAtivo(coordenadora)
    const login = await entrar(coordenadora.email)
    const escolhaDeA = await escolherEscola(texto(login.corpo['desafio']), coordenadora.usuarioId)
    expect(escolhaDeA.corpo['etapa']).toBe('mfa')
    const tokenA = texto((await segundoFator(texto(escolhaDeA.corpo['desafio']), codigoDeAgora(segredo))).corpo['token'])
    expect((await obter('/v1/eu', tokenA)).corpo).toMatchObject({ papel: 'coordenador', escola: { id: a.id } })

    // Coordenação em A não dispensa o código para a coordenação de B.
    const troca = await escolherEscola(tokenA, emB)
    expect(troca.corpo).toEqual({ etapa: 'mfa', desafio: expect.any(String) })
    expect(await sessoesDe(b.id, emB)).toEqual([])
    expect((await obter('/v1/eu', tokenA)).status).toBe(200)
  })

  it('borda: o destino desativado entre a troca e o código faz o código não abrir a sessão de B, e a origem continua aberta', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const coordenadoraEmB = await naOutraEscola(professora, b.id, 'coordenador')
    const segredo = await comMfaAtivo(professora)
    const tokenA = await entrarComo(professora, professora.usuarioId)
    const troca = await escolherEscola(tokenA, coordenadoraEmB)
    expect(troca.corpo['etapa']).toBe('mfa')

    await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [b.id, coordenadoraEmB])
    const comCodigo = await segundoFator(texto(troca.corpo['desafio']), codigoDeAgora(segredo))
    expect(comCodigo.status).toBe(401)
    expect(comCodigo.setCookie).toEqual([])
    expect(await sessoesDe(b.id, coordenadoraEmB)).toEqual([])
    expect((await obter('/v1/eu', tokenA)).status).toBe(200)
  })

  it('borda: trocar para o próprio usuário da sessão abre outra sessão na mesma escola e encerra a anterior', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    await naOutraEscola(professora, b.id)
    const tokenA = await entrarComo(professora, professora.usuarioId)

    const mesma = await escolherEscola(tokenA, professora.usuarioId)
    expect(mesma.corpo['etapa']).toBe('pronta')
    const sessoes = await sessoesDe(a.id, professora.usuarioId)
    expect(sessoes.map((sessao) => sessao.motivo)).toEqual(['troca_de_escola', null])
    expect((await obter('/v1/eu', tokenA)).status).toBe(401)
    expect((await obter('/v1/eu', texto(mesma.corpo['token']))).status).toBe(200)
  })

  it('borda: com o MFA pedido na troca, a saída de A antes do código faz o código não abrir a sessão de B', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const coordenadoraEmB = await naOutraEscola(professora, b.id, 'coordenador')
    const segredo = await comMfaAtivo(professora)
    const tokenA = await entrarComo(professora, professora.usuarioId)
    const troca = await escolherEscola(tokenA, coordenadoraEmB)
    expect(troca.corpo['etapa']).toBe('mfa')

    expect((await sair(tokenA)).status).toBe(204)
    const comCodigo = await segundoFator(texto(troca.corpo['desafio']), codigoDeAgora(segredo))
    expect(comCodigo.status).toBe(401)
    expect(comCodigo.setCookie).toEqual([])
    expect(await sessoesDe(b.id, coordenadoraEmB)).toEqual([])
    expect(await sessaoUnica(a.id, professora.usuarioId)).toMatchObject({ motivo: 'saida' })
  })

  it('borda: escolher a coordenação no login pede o MFA e o código entra direto nela, sem voltar a escolher; sem MFA configurado, leva a configurar_mfa', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const coordenadoraEmB = await naOutraEscola(professora, b.id, 'coordenador')

    // Sem MFA configurado: a escolha da coordenação leva a configurá-lo, sem sessão.
    const semMfa = await escolherEscola(texto((await entrar(professora.email)).corpo['desafio']), coordenadoraEmB)
    expect(semMfa.corpo).toEqual({ etapa: 'configurar_mfa', desafio: expect.any(String) })
    expect(semMfa.setCookie).toEqual([])
    expect(await sessoesDe(b.id, coordenadoraEmB)).toEqual([])

    const segredo = await comMfaAtivo(professora)
    const escolha = await escolherEscola(texto((await entrar(professora.email)).corpo['desafio']), coordenadoraEmB)
    expect(escolha.corpo).toEqual({ etapa: 'mfa', desafio: expect.any(String) })
    expect(escolha.setCookie).toEqual([])
    expect(await sessoesDe(b.id, coordenadoraEmB)).toEqual([])

    const comCodigo = await segundoFator(texto(escolha.corpo['desafio']), codigoDeAgora(segredo))
    expect(comCodigo.corpo).toEqual({ etapa: 'pronta', token: expect.any(String), expiraEm: expect.any(String) })
    expect(nomesDosCookies(comCodigo)).toEqual(['educa_dispositivo', 'educa_sessao'])
    expect((await obter('/v1/eu', texto(comCodigo.corpo['token']))).corpo).toMatchObject({ usuarioId: coordenadoraEmB, papel: 'coordenador', escola: { id: b.id } })
    expect(await sessoesDe(a.id, professora.usuarioId)).toEqual([])
  })

  it('borda: destino com inatividade de 60 min e origem com 120; a sessão nova vence pela regra do destino', async () => {
    const a = await escola('Colégio', 120)
    const b = await escola('Escola da rede', 60)
    const professora = await pessoa(a.id)
    const emB = await naOutraEscola(professora, b.id)
    const tokenA = await entrarComo(professora, professora.usuarioId)

    // Em A, 70 min sem uso ainda estão dentro dos 120 da origem.
    await bancada.pool.query("update sessao set ultimo_uso_em = now() - interval '70 minutes' where escola_id = $1 and usuario_id = $2", [a.id, professora.usuarioId])
    const emA = await obter('/v1/eu', tokenA)
    expect(emA.status).toBe(200)
    expect(emA.corpo['inatividadeMin']).toBe(120)

    const tokenB = texto((await escolherEscola(tokenA, emB)).corpo['token'])
    expect((await obter('/v1/eu', tokenB)).corpo['inatividadeMin']).toBe(60)
    await bancada.pool.query("update sessao set ultimo_uso_em = now() - interval '70 minutes' where escola_id = $1 and usuario_id = $2", [b.id, emB])
    const vencida = await obter('/v1/eu', tokenB)
    expect(vencida.status).toBe(401)
    expect(vencida.corpo.erro?.codigo).toBe(CodigoDeErro.NAO_AUTENTICADO)
  })

  it('permissão: a sessão de matrícula do aluno e as sessões externa e de matrícula de quem é da equipe não trocam: 404, e nada é gravado', async () => {
    const aluno = await bancada.escolaComSessao('aluno')
    const doAluno = await escolherEscola(aluno.token, randomUUID())
    esperarNaoEncontrado(doAluno)

    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const emB = await naOutraEscola(professora, b.id)
    const tokenA = await entrarComo(professora, professora.usuarioId)
    for (const metodo of ['externo', 'matricula'] as const) {
      await bancada.pool.query('update sessao set metodo = $1 where escola_id = $2 and usuario_id = $3', [metodo, a.id, professora.usuarioId])
      esperarNaoEncontrado(await escolherEscola(tokenA, emB))
      expect(await sessoesDe(b.id, emB)).toEqual([])
      expect((await sessaoUnica(a.id, professora.usuarioId)).encerrada_em).toBeNull()
    }
    // De volta ao e-mail, a mesma troca passa: o 404 acima era do método.
    await bancada.pool.query("update sessao set metodo = 'email' where escola_id = $1 and usuario_id = $2", [a.id, professora.usuarioId])
    expect((await escolherEscola(tokenA, emB)).status).toBe(200)
  })

  it('borda: a professora que saiu de B em março some de acessos, e a troca para B dá 404; o acesso a A continua', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const emB = await naOutraEscola(professora, b.id)
    const tokenA = await entrarComo(professora, professora.usuarioId)
    expect((await obter('/v1/eu', tokenA)).corpo['acessos']).toHaveLength(2)

    await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [b.id, emB])

    const eu = await obter('/v1/eu', tokenA)
    expect(eu.status).toBe(200)
    expect(eu.corpo['acessos']).toEqual([{ usuarioId: professora.usuarioId, escolaNome: a.nome, redeNome: a.redeNome, papel: 'professor' }])
    esperarNaoEncontrado(await escolherEscola(tokenA, emB))
    expect(await sessoesDe(b.id, emB)).toEqual([])
    expect((await obter('/v1/eu', tokenA)).status).toBe(200)
    // E o login seguinte vai direto a A, sem escolher.
    expect((await entrar(professora.email)).corpo['etapa']).toBe('pronta')
  })

  it('borda: a coordenadora que espera o convite aceito em B (7.0) não aparece em acessos antes do login que a ativa, e a troca para B dá 404', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    // O usuário do convite nasce inativo, e o aceite (usado_em) vem depois: só o login com o bilhete o ativa.
    const { rows } = await bancada.pool.query<{ id: string }>(
      "insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'coordenador', 'Pessoa sintética', now() - interval '1 minute') returning id",
      [b.id, professora.contaId],
    )
    const esperando = rows[0]?.id ?? ''
    await bancada.pool.query("insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, usado_em) values ($1, $2, 'coordenador', $3, now() + interval '72 hours', now())", [
      b.id,
      randomBytes(32).toString('hex'),
      esperando,
    ])

    const tokenA = await entrarComo(professora, professora.usuarioId)
    expect((await obter('/v1/eu', tokenA)).corpo['acessos']).toEqual([{ usuarioId: professora.usuarioId, escolaNome: a.nome, redeNome: a.redeNome, papel: 'professor' }])
    esperarNaoEncontrado(await escolherEscola(tokenA, esperando))
    expect(await sessoesDe(b.id, esperando)).toEqual([])
    expect((await obter('/v1/eu', tokenA)).status).toBe(200)
  })

  it('concorrência: duas trocas em paralelo com o mesmo token para B criam uma sessão de B e encerram A uma vez', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const emB = await naOutraEscola(professora, b.id)
    const tokenA = await entrarComo(professora, professora.usuarioId)

    const respostas = await Promise.all([escolherEscola(tokenA, emB), escolherEscola(tokenA, emB)])
    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 401])

    const sessoesB = await sessoesDe(b.id, emB)
    expect(sessoesB).toHaveLength(1)
    const origem = await sessaoUnica(a.id, professora.usuarioId)
    expect(origem.motivo).toBe('troca_de_escola')
    const { rows } = await bancada.pool.query<{ total: string }>("select count(*) as total from registro_acesso where escola_id = $1 and evento = 'login'", [b.id])
    expect(Number(rows[0]?.total)).toBe(1)
    // A saída da origem também uma vez só (17.5): a troca que perdeu a corrida desfaz tudo o que gravou.
    expect((await registroDe(a.id)).filter((linha) => linha.evento === 'saida')).toEqual([{ evento: 'saida', usuario_id: professora.usuarioId }])
  })

  it('concorrência: duas escolhas em paralelo com o mesmo desafio escolher abrem uma sessão só', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const emB = await naOutraEscola(professora, b.id)
    const desafio = texto((await entrar(professora.email)).corpo['desafio'])

    const respostas = await Promise.all([escolherEscola(desafio, professora.usuarioId), escolherEscola(desafio, emB)])
    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 401])
    const abertas = [...(await sessoesDe(a.id, professora.usuarioId)), ...(await sessoesDe(b.id, emB))]
    expect(abertas).toHaveLength(1)
  })

  it('contrato (A1, 12.0; RF18 do F1): /v1/eu.acessos traz só usuarioId, escolaNome, redeNome e papel dos usuários ativos da conta, cada um com a rede da própria escola; nada de id, turma, número de turmas ou vínculo da outra escola, e o aluno recebe a lista vazia', async () => {
    const a = await escola('Colégio')
    const b = await escola('Escola da rede')
    const professora = await pessoa(a.id)
    const coordenadoraEmB = await naOutraEscola(professora, b.id, 'coordenador')
    // Outra conta na mesma escola B: não é acesso desta.
    await pessoa(b.id)
    // B tem turmas no ano em curso: nem o nome, nem o id, nem a quantidade delas pode sair no acesso da outra escola.
    const { rows: anos } = await bancada.pool.query<{ id: string }>(
      "insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-18', 'em_curso') returning id",
      [b.id],
    )
    const { rows: series } = await bancada.pool.query<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [b.id])
    const turmasDeB: Array<{ id: string; nome: string }> = []
    for (const nome of [`2ºB de B ${randomUUID().slice(0, 8)}`, `2ºC de B ${randomUUID().slice(0, 8)}`]) {
      const { rows } = await bancada.pool.query<{ id: string }>('insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4) returning id', [
        b.id,
        anos[0]?.id,
        series[0]?.id,
        nome,
      ])
      turmasDeB.push({ id: rows[0]?.id ?? '', nome })
    }
    const tokenA = await entrarComo(professora, professora.usuarioId)

    const eu = await obter('/v1/eu', tokenA)
    expect(eu.status).toBe(200)
    const acessos = eu.corpo['acessos'] as Array<Record<string, unknown>>
    // Em ordem de nome de escola: "Colégio …" vem antes de "Escola …". Cada rede é a da própria escola.
    expect(acessos).toEqual([
      { usuarioId: professora.usuarioId, escolaNome: a.nome, redeNome: a.redeNome, papel: 'professor' },
      { usuarioId: coordenadoraEmB, escolaNome: b.nome, redeNome: b.redeNome, papel: 'coordenador' },
    ])
    for (const acesso of acessos) expect(Object.keys(acesso).sort()).toEqual(['escolaNome', 'papel', 'redeNome', 'usuarioId'])
    const corpo = JSON.stringify(eu.corpo)
    for (const proibido of [b.id, a.redeId, b.redeId, professora.email, ...turmasDeB.flatMap((turma) => [turma.id, turma.nome])]) expect(corpo).not.toContain(proibido)
    expect(corpo).not.toMatch(/email|conta/i)

    const aluno = await bancada.escolaComSessao('aluno')
    const doAluno = await obter('/v1/eu', aluno.token)
    expect(doAluno.status).toBe(200)
    expect(doAluno.corpo['acessos']).toEqual([])
    expect(typeof doAluno.corpo['usuarioId'] === 'string' && UUID.test(doAluno.corpo['usuarioId'])).toBe(true)
  })

  it('esteira: com o Redis de fila respondendo acima dos 100 ms, a escolha da escola continua entrando (correção 2026-09-22-corte-de-100-ms-do-redis-recusa-o-desafio-no-e2e)', async () => {
    // Esta instância monta **sem** `MONTAGEM_DE_TESTE`, de propósito: é a API como o contêiner do compose a sobe, com
    // o prazo do cliente Redis do login vindo só da configuração. É a montagem que o e2e usa, e a única que tinha
    // ficado presa aos 100 ms de produção.
    const medidorDoCompose = new MedidorDeTeste()
    const logDoCompose: string[] = []
    const instancia = await NestFactory.create(AppModule.com(configuracaoDeTeste(), { medidor: medidorDoCompose.medidor }), { logger: false })
    configurarAplicacao(instancia, criarLogger({ servico: 'api-teste', nivel: 'trace', destino: { write: (linha: string) => logDoCompose.push(linha) } }), medidorDoCompose.medidor)
    await instancia.listen(0, '127.0.0.1')
    const urlDoCompose = `http://127.0.0.1:${String((instancia.getHttpServer().address() as AddressInfo).port)}`
    let travado: Awaited<ReturnType<typeof travarRedis>> | undefined
    try {
      const cliente = instancia.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false })
      await clientePronto(cliente)
      const a = await escola('Colégio')
      const b = await escola('Escola da rede')
      const professora = await pessoa(a.id)
      await naOutraEscola(professora, b.id)
      const login = await lerResposta(
        await fetch(`${urlDoCompose}/v1/sessao/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: professora.email, senha: SENHA_SINTETICA }),
        }),
      )
      expect(login.corpo['etapa']).toBe('escolher')

      travado = await travarRedis(configuracao.redisFilaUrl, PAUSA_DO_RUNNER_CARREGADO_MS)
      const escolhido = await lerResposta(
        await fetch(`${urlDoCompose}/v1/sessao/escola`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${texto(login.corpo['desafio'])}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuarioId: professora.usuarioId }),
        }),
      )
      // Com o corte de 100 ms nesta montagem, era 401 `NAO_AUTENTICADO` e `login.desafio_sem_redis` no log: a recusa
      // que derrubou `e2e/escola-e-vinculos.spec.ts:185` na esteira, com a conexão do Redis aberta o tempo todo.
      expect(cliente.status).toBe('ready')
      expect(escolhido.status).toBe(200)
      expect(escolhido.corpo['etapa']).toBe('pronta')
      expect(logDoCompose.join('\n')).not.toContain('login.desafio_sem_redis')
    } finally {
      // No `finally`: com uma asserção vermelha acima, a pausa seguiria viva para o arquivo seguinte.
      await travado?.fim
      await instancia.close()
      await medidorDoCompose.encerrar()
    }
  })
})
