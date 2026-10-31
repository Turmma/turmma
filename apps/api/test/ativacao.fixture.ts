import { createDatabase, createPool, estadoDaCoordenacao, runInContext, type Database, type DatabasePool } from '@educa/core'
import type { EstadoDaCoordenacao, PapelDeUsuario } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { Secret, TOTP } from 'otpauth'
import { expect } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { CifraDoSegredo, CLIENTE_REDIS_LOGIN, ContadorDeTentativas, gerarSegredo, HashDeSenha } from '../src/credencial/index.js'
import { ConviteRepository, criarConviteDeCoordenador } from '../src/sessao/index.js'
import { configuracaoDeTeste } from './test-config.js'
import { pedir, PRAZO_DAS_CONSULTAS_MS, subirApiDoPainel, type Resposta } from './painel.fixture.js'
import { autorDaBancada, BancadaDeSessoes } from './sessao.fixture.js'

/**
 * O que os testes da ativação por convite (A0b, tarefa 4.0: cenários E6 de login, E15 e E16) têm em comum: a API inteira
 * com o log capturado, a conta que já tem senha (com ou sem MFA) e que recebe o convite da coordenação de uma escola, o
 * aceite que devolve o bilhete, o login e o segundo fator pela API, e a leitura dos dois contadores de tentativas e do
 * registro de acesso. Tudo sintético, com e-mail no domínio `.invalid`.
 */

/** A senha que a conta já tinha antes do convite. */
export const SENHA_DA_CONTA = 'senha-que-a-conta-ja-tinha-1'
/** A senha que a conta nova define no aceite. */
export const SENHA_NOVA = 'senha-nova-do-convite-1'
export const SENHA_ERRADA = 'senha-sintetica-errada-9'
const NOME = 'Coordenação Sintética Convidada'

export interface ContaDeTeste {
  readonly email: string
  readonly contaId: string
  /** O segredo do app autenticador, quando a conta tem MFA ativo. */
  readonly base32: string | undefined
}

export interface ConviteDeTeste {
  readonly escolaId: string
  readonly conviteId: string
  readonly token: string
  readonly usuarioId: string
}

export class CenarioDeAtivacao {
  readonly escolas = new BancadaDeSessoes()
  readonly linhasDeLog: string[] = []
  readonly #cifra: CifraDoSegredo
  pool!: DatabasePool
  banco!: Database
  app!: INestApplication
  url!: string
  #hash!: HashDeSenha
  #contador!: ContadorDeTentativas
  #redis!: Redis

  constructor() {
    const configuracao = configuracaoDeTeste()
    this.#cifra = new CifraDoSegredo(configuracao.login.mfa.versaoCifra, configuracao.login.mfa.chavesCifra)
  }

  async subir(): Promise<void> {
    // Conexões de sobra para a trava segura pelo teste, o gatilho de parada e as leituras, ao mesmo tempo.
    this.pool = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 8, timeoutConexaoMs: 5_000, timeoutConsultaMs: PRAZO_DAS_CONSULTAS_MS }, () => undefined)
    this.banco = createDatabase(this.pool)
    ;({ app: this.app, url: this.url } = await subirApiDoPainel(this.linhasDeLog))
    this.#hash = this.app.get(HashDeSenha, { strict: false })
    this.#contador = this.app.get(ContadorDeTentativas, { strict: false })
    this.#redis = this.app.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false })
    const prazo = performance.now() + 15_000
    while (this.#redis.status !== 'ready') {
      if (performance.now() > prazo) throw new Error('o cliente do Redis de fila do login não conectou')
      await new Promise((pronto) => setTimeout(pronto, 20))
    }
  }

  /** Fecha a API, o pool e a bancada, mesmo se um deles falhar: nada fica aberto no banco de teste. */
  async fechar(): Promise<void> {
    try {
      await this.app.close()
    } finally {
      try {
        await this.pool.end()
      } finally {
        await this.escolas.fechar()
      }
    }
  }

  /** A conta que já existe, com senha e, se pedido, com MFA ativo; sem usuário em escola nenhuma. */
  async conta({ mfa }: { mfa: boolean }): Promise<ContaDeTeste> {
    const email = `convidada-${randomUUID()}@escola.invalid`
    const { rows } = await this.pool.query<{ id: string }>('insert into conta (email, senha_hash) values ($1, $2) returning id', [email, await this.#hash.gerar(SENHA_DA_CONTA)])
    const contaId = rows[0]?.id ?? ''
    if (!mfa) return { email, contaId, base32: undefined }
    const novo = gerarSegredo()
    const { cifrado, versao } = this.#cifra.cifrar(novo.bytes, contaId)
    await this.pool.query('update conta set mfa_segredo_cifrado = $1, mfa_chave_versao = $2, mfa_ativado_em = now() where id = $3', [cifrado, versao, contaId])
    return { email, contaId, base32: novo.base32 }
  }

  /** Um usuário ativo da conta numa escola nova (a pessoa que já trabalha em outra escola cliente). */
  async usuarioAtivoEmOutraEscola(contaId: string, papel: PapelDeUsuario = 'professor'): Promise<{ escolaId: string; usuarioId: string }> {
    const escolaId = await this.escolas.escola()
    const { rows } = await this.pool.query<{ id: string }>("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, 'Pessoa sintética') returning id", [escolaId, contaId, papel])
    return { escolaId, usuarioId: rows[0]?.id ?? '' }
  }

  /** O gerar do operador, pelo caso de uso que o painel e o comando chamam. */
  async convidar(escolaId: string, email: string): Promise<ConviteDeTeste> {
    const { conviteId, token } = await criarConviteDeCoordenador(this.banco, autorDaBancada, { escolaId, email, nome: NOME })
    const { rows } = await this.pool.query<{ usuario_id: string }>('select usuario_id from convite where id = $1', [conviteId])
    return { escolaId, conviteId, token, usuarioId: rows[0]?.usuario_id ?? '' }
  }

  aceitar(token: string, senha?: string, url = this.url): Promise<Resposta> {
    return pedir(url, 'POST', '/v1/convites/aceitar', undefined, senha === undefined ? { token } : { token, senha })
  }

  /** Aceita o convite de quem já tem conta com senha e devolve o bilhete que liga o link ao login. */
  async bilheteDoAceite(token: string): Promise<string> {
    const aceite = await this.aceitar(token)
    expect(aceite.corpo).toEqual({ etapa: 'entrar', bilhete: expect.any(String) })
    return String((aceite.corpo as { bilhete: string }).bilhete)
  }

  /** Uma escola nova em `aceito`: o convite da conta foi aceito, e o usuário espera o login com o bilhete. */
  async aceito(conta: ContaDeTeste): Promise<ConviteDeTeste & { bilhete: string }> {
    const convite = await this.convidar(await this.escolas.escola(), conta.email)
    const bilhete = await this.bilheteDoAceite(convite.token)
    expect(await this.estado(convite.escolaId)).toBe('aceito')
    return { ...convite, bilhete }
  }

  entrar(email: string, senha: string, bilhete?: string, url = this.url): Promise<Resposta> {
    return pedir(url, 'POST', '/v1/sessao/email', undefined, bilhete === undefined ? { email, senha } : { email, senha, bilhete })
  }

  /** O código do segundo fator, com o desafio `mfa` da resposta do login. */
  codigo(desafio: string, codigo: string, url = this.url): Promise<Resposta> {
    return pedir(url, 'POST', '/v1/sessao/mfa', desafio, { codigo })
  }

  /** O código que o app autenticador mostra, `adiante` passos depois do de agora (a janela aceita o seguinte). */
  codigoDoApp(base32: string | undefined, adiante = 0): string {
    if (base32 === undefined) throw new Error('conta sem MFA')
    return TOTP.generate({ secret: Secret.fromBase32(base32), algorithm: 'SHA1', digits: 6, period: 30, timestamp: Date.now() + adiante * 30_000 })
  }

  /** Um código de seis dígitos que não é o de nenhum passo que a janela aceita agora. */
  codigoErrado(base32: string | undefined): string {
    const aceitos = new Set([-2, -1, 0, 1, 2].map((passo) => this.codigoDoApp(base32, passo)))
    for (let valor = 0; ; valor++) {
      const candidato = String(valor).padStart(6, '0')
      if (!aceitos.has(candidato)) return candidato
    }
  }

  /** O desafio `mfa` de uma resposta de login. */
  desafio(resposta: Resposta): string {
    expect(resposta.corpo).toEqual({ etapa: 'mfa', desafio: expect.any(String) })
    return String((resposta.corpo as { desafio: string }).desafio)
  }

  /** As falhas contadas no contador da senha do e-mail (origem `outro`, sem o cookie do dispositivo). */
  async falhasDaSenha(email: string): Promise<number> {
    return Number((await this.#redis.hget(this.#contador.chaveDe(email.toLowerCase(), 'outro'), 'falhas')) ?? 0)
  }

  /** As falhas contadas no contador do código da conta (origem `outro`). */
  async falhasDoCodigo(contaId: string): Promise<number> {
    return Number((await this.#redis.hget(this.#contador.chaveDe(contaId, 'outro'), 'falhas')) ?? 0)
  }

  /** Quantas linhas o registro de acesso tem, por evento: os arquivos de integração rodam um por vez. */
  async registrosDeAcesso(): Promise<{ login: number; loginFalho: number }> {
    const { rows } = await this.pool.query<{ login: number; login_falho: number }>(
      "select count(*) filter (where evento = 'login')::int as login, count(*) filter (where evento = 'login_falho')::int as login_falho from registro_acesso",
    )
    return { login: rows[0]?.login ?? 0, loginFalho: rows[0]?.login_falho ?? 0 }
  }

  async ativo(usuarioId: string): Promise<boolean> {
    const { rows } = await this.pool.query<{ ativo: boolean }>('select desativado_em is null as ativo from usuario where id = $1', [usuarioId])
    return rows[0]?.ativo ?? false
  }

  async sessoesDaConta(contaId: string): Promise<number> {
    const { rows } = await this.pool.query<{ total: number }>('select count(*)::int as total from sessao where conta_id = $1', [contaId])
    return rows[0]?.total ?? 0
  }

  async ativacoes(escolaId: string): Promise<unknown[]> {
    const { rows } = await this.pool.query("select entidade_id, depois from auditoria where escola_id = $1 and acao = 'usuario.ativado_por_convite' order by em, id", [escolaId])
    return rows
  }

  /** O estado da coordenação da escola, pela mesma função e pela mesma leitura da escrita. */
  estado(escolaId: string): Promise<EstadoDaCoordenacao> {
    return runInContext({ requisicaoId: randomUUID(), escolaId }, async () => {
      const dados = await new ConviteRepository(this.banco).dadosDaCoordenacao()
      if (dados === undefined) throw new Error('escola de teste não encontrada')
      return estadoDaCoordenacao(dados)
    })
  }
}
