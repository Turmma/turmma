import { DomainException, type DatabasePool } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarConviteDeCoordenador, refazerConviteDaCoordenacao, revogarConvitePeloOperador } from '../src/sessao/index.js'
import { CenarioDeAtivacao, SENHA_DA_CONTA, SENHA_ERRADA, SENHA_NOVA, type ContaDeTeste, type ConviteDeTeste } from './ativacao-de-teste.js'
import { aguardar, GatilhoDeParada } from './gatilho-de-parada.js'
import { esperarErro, subirApiDoPainel, type Resposta } from './painel-de-teste.js'
import { autorDaBancada } from './sessao-de-teste.js'
import { esperarNaTravaDaEscola, segurarTravaDaEscola } from './trava-da-escola.js'

/**
 * A ativação por convite sob a trava da escola (A0b, tarefa 4.0; Tech Spec, seções 5 e 7c, "Ativação por convite"):
 * cenário E15 de `tasks/prd-apresentacao-painel/cenarios.md`. A ativação é o aceite, o login com o bilhete sem MFA e o
 * código do segundo fator com o convite no desafio; a primeira instrução da transação dela é a trava do convite da
 * escola, a mesma do gerar, do refazer e do revogar do operador. A ordem é forçada pela trava segura pelo teste e pelo
 * gatilho de parada, que só existe no banco de teste; nenhum gancho no código de produção, nenhum `sleep`. A resposta de
 * quem perde, fora de corrida, é a E16 (`login-convite-revogado.int.test.ts`). Postgres e Redis reais do compose de teste.
 */

/** O prazo das consultas da API da E15(e), que deixa o `statement_timeout` estourar na trava segura pelo teste. */
const PRAZO_CURTO_MS = 1_000

/** Os dois logins que ativam pelo bilhete: sem MFA, logo depois da senha; com MFA, depois do código. */
const LOGINS = ['sem MFA', 'com MFA'] as const
type Login = (typeof LOGINS)[number]

/** Uma chamada em andamento e se ela já terminou, para o teste afirmar que ela ainda espera. */
function emAndamento<T>(promessa: Promise<T>): { promessa: Promise<T>; terminou: () => boolean } {
  let terminou = false
  void promessa.then(
    () => (terminou = true),
    () => (terminou = true),
  )
  return { promessa, terminou: () => terminou }
}

/** Espera alguma transação parada numa trava (de linha ou consultiva) com a consulta que casa um dos padrões. */
async function esperarParadaEm(pool: DatabasePool, ...padroes: string[]): Promise<void> {
  await aguardar(async () => {
    const { rows } = await pool.query<{ total: number }>(
      `select count(*)::int as total from pg_stat_activity
        where datname = current_database() and pid <> pg_backend_pid() and wait_event_type = 'Lock' and query ilike any($1::text[])`,
      [padroes],
    )
    return (rows[0]?.total ?? 0) >= 1
  }, `uma transação parada em ${padroes.join(' ou ')}`)
}

describe('ativação por convite sob a trava da escola (E15)', () => {
  const cenario = new CenarioDeAtivacao()

  beforeAll(async () => {
    await cenario.subir()
  })

  afterAll(async () => {
    await cenario.fechar()
  })

  /** A conta com senha, com ou sem MFA, e o convite dela aceito numa escola nova (`aceito`). */
  async function contaEmAceito(login: Login): Promise<{ conta: ContaDeTeste; convite: ConviteDeTeste & { bilhete: string } }> {
    const conta = await cenario.conta({ mfa: login === 'com MFA' })
    return { conta, convite: await cenario.aceito(conta) }
  }

  /**
   * A chamada que ativa, pronta para disparar: sem MFA, o login com o bilhete; com MFA, o login já foi feito (o desafio
   * leva o convite) e a chamada é o código. Devolve também o contador que ela gasta.
   */
  async function ativacaoPeloLogin(
    login: Login,
    conta: ContaDeTeste,
    bilhete: string,
    url = cenario.url,
    passo = 0,
  ): Promise<{ disparar: () => Promise<Resposta>; falhas: () => Promise<number>; repetir: () => Promise<Resposta> }> {
    if (login === 'sem MFA') {
      const disparar = () => cenario.entrar(conta.email, SENHA_DA_CONTA, bilhete, url)
      return { disparar, falhas: () => cenario.falhasDaSenha(conta.email), repetir: () => cenario.entrar(conta.email, SENHA_DA_CONTA, bilhete) }
    }
    const desafio = cenario.desafio(await cenario.entrar(conta.email, SENHA_DA_CONTA, bilhete))
    // `passo`: o código de um passo adiante, quando outro código certo já gastou o passo de agora (`mfa_ultimo_passo`).
    // `repetir` é a mesma chamada na API de sempre, com o mesmo desafio e o código do passo seguinte.
    return {
      disparar: () => cenario.codigo(desafio, cenario.codigoDoApp(conta.base32, passo), url),
      falhas: () => cenario.falhasDoCodigo(conta.contaId),
      repetir: () => cenario.codigo(desafio, cenario.codigoDoApp(conta.base32, passo + 1)),
    }
  }

  /** A etapa de quem ativou a única coordenação da conta: sem MFA, configurar o MFA; com MFA, já cumprido, pronta. */
  function esperarAtivou(resposta: Resposta, login: Login): void {
    expect(resposta.status).toBe(200)
    expect((resposta.corpo as { etapa: string }).etapa).toBe(login === 'sem MFA' ? 'configurar_mfa' : 'pronta')
  }

  /** Tenta prender, sem esperar, as linhas que a ativação escreve: só passa se ela ainda não as prendeu. */
  async function linhasLivres(tabelas: ReadonlyArray<readonly [string, string]>): Promise<void> {
    const conexao = await cenario.pool.connect()
    try {
      await conexao.query('begin')
      for (const [tabela, id] of tabelas) await conexao.query(`select 1 from ${tabela} where id = $1 for update nowait`, [id])
    } finally {
      await conexao.query('rollback')
      conexao.release()
    }
  }

  describe('(a) com a trava da escola segura pelo teste, a ativação espera nela, antes de prender qualquer linha', () => {
    it.each(LOGINS)('login %s', async (login) => {
      const { conta, convite } = await contaEmAceito(login)
      const ativacao = await ativacaoPeloLogin(login, conta, convite.bilhete)
      const soltar = await segurarTravaDaEscola(cenario.pool, convite.escolaId)
      try {
        const chamada = emAndamento(ativacao.disparar())
        await esperarNaTravaDaEscola(cenario.pool, convite.escolaId, 1)
        expect(chamada.terminou()).toBe(false)
        await linhasLivres([
          ['usuario', convite.usuarioId],
          ['convite', convite.conviteId],
        ])
        expect(await cenario.ativo(convite.usuarioId)).toBe(false)
        await soltar()
        esperarAtivou(await chamada.promessa, login)
      } finally {
        await soltar()
      }
      expect(await cenario.ativo(convite.usuarioId)).toBe(true)
    })

    it('aceite da conta nova: espera a trava antes de marcar o convite como usado e de gravar a senha', async () => {
      const convite = await cenario.convidar(await cenario.escolas.escola(), `nova-${randomUUID()}@escola.invalid`)
      const { rows } = await cenario.pool.query<{ conta_id: string }>('select conta_id from usuario where id = $1', [convite.usuarioId])
      const contaId = rows[0]?.conta_id ?? ''
      const soltar = await segurarTravaDaEscola(cenario.pool, convite.escolaId)
      try {
        const chamada = emAndamento(cenario.aceitar(convite.token, SENHA_NOVA))
        await esperarNaTravaDaEscola(cenario.pool, convite.escolaId, 1)
        expect(chamada.terminou()).toBe(false)
        // Se o aceite prendesse a linha do convite antes da trava, o `nowait` falharia aqui (55P03): é a ordem que evita
        // o 40P01 com o refazer, que prende a trava e depois a linha.
        await linhasLivres([
          ['convite', convite.conviteId],
          ['conta', contaId],
          ['usuario', convite.usuarioId],
        ])
        await soltar()
        const resposta = await chamada.promessa
        expect(resposta.corpo).toEqual({ etapa: 'configurar_mfa', desafio: expect.any(String) })
      } finally {
        await soltar()
      }
      expect(await cenario.ativo(convite.usuarioId)).toBe(true)
    })
  })

  describe('(b) o gerar em aceito primeiro, parado depois de revogar e antes do commit: a ativação espera, não ativa, e responde como a E16', () => {
    it.each(LOGINS)('login %s, com outro e-mail', async (login) => {
      const { conta, convite } = await contaEmAceito(login)
      const ativacao = await ativacaoPeloLogin(login, conta, convite.bilhete)
      const falhasAntes = await ativacao.falhas()
      const gatilho = new GatilhoDeParada(cenario.pool, { tabela: 'convite', evento: 'update', quando: `new.id = '${convite.conviteId}'::uuid and new.revogado_em is not null` })
      await gatilho.armar()
      try {
        const gerar = criarConviteDeCoordenador(cenario.banco, autorDaBancada, { escolaId: convite.escolaId, email: `outra-${randomUUID()}@escola.invalid`, nome: 'Outra Pessoa' })
        await gatilho.esperarParadas()
        const registrosAntes = await cenario.registrosDeAcesso()
        const chamada = ativacao.disparar()
        await esperarNaTravaDaEscola(cenario.pool, convite.escolaId, 1)
        await gatilho.soltar()
        expect(await gerar).toEqual({ conviteId: expect.any(String), token: expect.any(String) })
        esperarErro(await chamada, 404, ErrorCode.NAO_ENCONTRADO)
        expect(await cenario.registrosDeAcesso()).toEqual(registrosAntes)
      } finally {
        await gatilho.desarmar()
      }
      expect(await ativacao.falhas()).toBe(falhasAntes)
      expect(await cenario.ativo(convite.usuarioId)).toBe(false)
      expect(await cenario.ativacoes(convite.escolaId)).toEqual([])
      expect(await cenario.estado(convite.escolaId)).toBe('pendente')
    })

    it.each(LOGINS)('login %s, com o mesmo e-mail: o bilhete antigo não ativa o usuário reaproveitado, e só o convite novo o ativa', async (login) => {
      const { conta, convite } = await contaEmAceito(login)
      const ativacao = await ativacaoPeloLogin(login, conta, convite.bilhete)
      const gatilho = new GatilhoDeParada(cenario.pool, { tabela: 'convite', evento: 'update', quando: `new.id = '${convite.conviteId}'::uuid and new.revogado_em is not null` })
      await gatilho.armar()
      let novo: { conviteId: string; token: string }
      try {
        const gerar = criarConviteDeCoordenador(cenario.banco, autorDaBancada, { escolaId: convite.escolaId, email: conta.email, nome: 'Mesma Pessoa' })
        await gatilho.esperarParadas()
        const chamada = ativacao.disparar()
        await esperarNaTravaDaEscola(cenario.pool, convite.escolaId, 1)
        await gatilho.soltar()
        novo = await gerar
        esperarErro(await chamada, 404, ErrorCode.NAO_ENCONTRADO)
      } finally {
        await gatilho.desarmar()
      }
      expect(await cenario.ativo(convite.usuarioId)).toBe(false)
      const bilheteNovo = await cenario.bilheteDoAceite(novo.token)
      const pelaNova = await ativacaoPeloLogin(login, conta, bilheteNovo, cenario.url, 1)
      esperarAtivou(await pelaNova.disparar(), login)
      expect(await cenario.ativo(convite.usuarioId)).toBe(true)
      expect(await cenario.ativacoes(convite.escolaId)).toEqual([{ entidade_id: convite.usuarioId, depois: { conviteId: novo.conviteId } }])
    })
  })

  describe('(c) a ativação primeiro, já na fila da trava, e o gerar esperando atrás dela: ela ativa, e o gerar lê ativa e recebe CONFLITO', () => {
    it.each(LOGINS)('login %s', async (login) => {
      const { conta, convite } = await contaEmAceito(login)
      const ativacao = await ativacaoPeloLogin(login, conta, convite.bilhete)
      const soltar = await segurarTravaDaEscola(cenario.pool, convite.escolaId)
      try {
        const chamada = ativacao.disparar()
        await esperarNaTravaDaEscola(cenario.pool, convite.escolaId, 1)
        const gerar = criarConviteDeCoordenador(cenario.banco, autorDaBancada, { escolaId: convite.escolaId, email: `outra-${randomUUID()}@escola.invalid`, nome: 'Outra Pessoa' }).catch(
          (erro: unknown) => erro,
        )
        await esperarNaTravaDaEscola(cenario.pool, convite.escolaId, 2)
        await soltar()
        esperarAtivou(await chamada, login)
        expect(await gerar).toBeInstanceOf(DomainException)
        expect(await gerar).toMatchObject({ codigo: ErrorCode.CONFLITO })
      } finally {
        await soltar()
      }
      expect(await cenario.ativo(convite.usuarioId)).toBe(true)
      expect(await cenario.estado(convite.escolaId)).toBe('ativa')
      const { rows } = await cenario.pool.query('select id from convite where escola_id = $1', [convite.escolaId])
      expect(rows).toEqual([{ id: convite.conviteId }])
    })
  })

  describe('(d) o aceite em pendente contra o refazer e o revogar, nas duas ordens: nunca 500 nem 40P01', () => {
    const operacoes = {
      refazer: (conviteId: string) => refazerConviteDaCoordenacao(cenario.banco, autorDaBancada, conviteId),
      revogar: (conviteId: string) => revogarConvitePeloOperador(cenario.banco, autorDaBancada, conviteId),
    } as const
    const CASOS = [
      ['refazer', 'aceite primeiro'],
      ['refazer', 'operador primeiro'],
      ['revogar', 'aceite primeiro'],
      ['revogar', 'operador primeiro'],
    ] as const

    it.each(CASOS)('%s, %s', async (operacao, ordem) => {
      const convite = await cenario.convidar(await cenario.escolas.escola(), `nova-${randomUUID()}@escola.invalid`)
      expect(await cenario.estado(convite.escolaId)).toBe('pendente')
      const quem = ordem === 'aceite primeiro' ? 'new.usado_em is not null' : 'new.revogado_em is not null'
      const gatilho = new GatilhoDeParada(cenario.pool, { tabela: 'convite', evento: 'update', quando: `new.id = '${convite.conviteId}'::uuid and ${quem}` })
      await gatilho.armar()
      let doAceite: Resposta
      let doOperador: unknown
      try {
        if (ordem === 'aceite primeiro') {
          // O aceite para no gatilho com a trava e a linha do convite presas; o operador espera atrás dele. Com a trava
          // depois do `usarConvitePorHash`, o operador prenderia a trava e esperaria a linha, e o aceite, soltando,
          // esperaria a trava: 40P01.
          const aceite = cenario.aceitar(convite.token, SENHA_NOVA)
          await gatilho.esperarParadas()
          const doPainel = operacoes[operacao](convite.conviteId).catch((erro: unknown) => erro)
          await esperarParadaEm(cenario.pool, '%pg_advisory_xact_lock%', '%set "revogado_em"%')
          await gatilho.soltar()
          ;[doAceite, doOperador] = await Promise.all([aceite, doPainel])
        } else {
          // O operador para no gatilho depois de revogar, com a trava e a linha presas; o aceite espera atrás dele.
          const doPainel = operacoes[operacao](convite.conviteId).catch((erro: unknown) => erro)
          await gatilho.esperarParadas()
          const aceite = cenario.aceitar(convite.token, SENHA_NOVA)
          await esperarParadaEm(cenario.pool, '%pg_advisory_xact_lock%', '%set "usado_em"%')
          await gatilho.soltar()
          ;[doAceite, doOperador] = await Promise.all([aceite, doPainel])
        }
      } finally {
        await gatilho.desarmar()
      }

      if (ordem === 'aceite primeiro') {
        // O aceite vence e ativa; o operador lê `ativa` e recebe o CONFLITO da matriz.
        expect(doAceite.corpo).toEqual({ etapa: 'configurar_mfa', desafio: expect.any(String) })
        expect(doOperador).toBeInstanceOf(DomainException)
        expect(doOperador).toMatchObject({ codigo: ErrorCode.CONFLITO })
        expect(await cenario.estado(convite.escolaId)).toBe('ativa')
        expect(await cenario.ativo(convite.usuarioId)).toBe(true)
      } else {
        // O operador vence; o aceite não acha o convite e responde como convite inválido, sem gravar senha.
        expect(doOperador).not.toBeInstanceOf(Error)
        esperarErro(doAceite, 404, ErrorCode.NAO_ENCONTRADO)
        expect(await cenario.estado(convite.escolaId)).toBe(operacao === 'refazer' ? 'pendente' : 'revogado')
        expect(await cenario.ativo(convite.usuarioId)).toBe(false)
        const { rows } = await cenario.pool.query<{ senha: boolean }>('select c.senha_hash is not null as senha from conta c join usuario u on u.conta_id = c.id where u.id = $1', [
          convite.usuarioId,
        ])
        expect(rows).toEqual([{ senha: false }])
      }
    })
  })

  describe('(e) a espera da trava além do statement_timeout: 503 TEMPO_ESGOTADO com Retry-After, nada gravado, a tentativa não conta, e repetir ativa', () => {
    it.each(LOGINS)('login %s', async (login) => {
      const { conta, convite } = await contaEmAceito(login)
      const curta = await subirApiDoPainel(cenario.linhasDeLog, {}, PRAZO_CURTO_MS)
      try {
        const ativacao = await ativacaoPeloLogin(login, conta, convite.bilhete, curta.url)
        // Uma falha antes, para o contador ter o que mostrar: sem desfazer a reserva, ficariam duas.
        if (login === 'sem MFA') esperarErro(await cenario.entrar(conta.email, SENHA_ERRADA, convite.bilhete), 401, ErrorCode.NAO_AUTENTICADO)
        else esperarErro(await cenario.codigo(await desafioNovo(conta, convite.bilhete), cenario.codigoErrado(conta.base32)), 401, ErrorCode.NAO_AUTENTICADO)
        const falhasAntes = await ativacao.falhas()
        expect(falhasAntes).toBe(1)
        const registrosAntes = await cenario.registrosDeAcesso()
        const soltar = await segurarTravaDaEscola(cenario.pool, convite.escolaId)
        try {
          const esgotado = await ativacao.disparar()
          esperarErro(esgotado, 503, ErrorCode.TEMPO_ESGOTADO)
          expect(esgotado.retryAfter).not.toBeNull()
        } finally {
          await soltar()
        }
        expect(await ativacao.falhas()).toBe(falhasAntes)
        expect(await cenario.registrosDeAcesso()).toEqual(registrosAntes)
        expect(await cenario.ativo(convite.usuarioId)).toBe(false)
        // Repetindo, como o `Retry-After` manda, com a trava já solta: ativa. Com MFA, o desafio não foi gasto pelo 503.
        esperarAtivou(await ativacao.repetir(), login)
        expect(await cenario.ativo(convite.usuarioId)).toBe(true)
      } finally {
        await curta.app.close()
      }
    })

    it('aceite da conta nova: 503, e o convite continua valendo, sem senha gravada', async () => {
      const convite = await cenario.convidar(await cenario.escolas.escola(), `nova-${randomUUID()}@escola.invalid`)
      const curta = await subirApiDoPainel(cenario.linhasDeLog, {}, PRAZO_CURTO_MS)
      try {
        const soltar = await segurarTravaDaEscola(cenario.pool, convite.escolaId)
        try {
          const esgotado = await cenario.aceitar(convite.token, SENHA_NOVA, curta.url)
          esperarErro(esgotado, 503, ErrorCode.TEMPO_ESGOTADO)
          expect(esgotado.retryAfter).not.toBeNull()
        } finally {
          await soltar()
        }
      } finally {
        await curta.app.close()
      }
      const { rows } = await cenario.pool.query<{ usado: boolean }>('select usado_em is not null as usado from convite where id = $1', [convite.conviteId])
      expect(rows).toEqual([{ usado: false }])
      expect(await cenario.ativo(convite.usuarioId)).toBe(false)
      expect((await cenario.aceitar(convite.token, SENHA_NOVA)).corpo).toEqual({ etapa: 'configurar_mfa', desafio: expect.any(String) })
    })
  })

  describe('4.1: o aceite que não ativa o usuário responde como convite inválido, nunca 500', () => {
    it('com o usuário do convite desativado depois do aceite (dado fora do caminho normal), nada é gravado: nem o uso do convite, nem a senha, nem a auditoria', async () => {
      const convite = await cenario.convidar(await cenario.escolas.escola(), `nova-${randomUUID()}@escola.invalid`)
      // O `usado_em` do aceite fica antes do `desativado_em`: `ativarPorConvite` não ativa.
      await cenario.pool.query("update usuario set desativado_em = now() + interval '1 hour' where id = $1", [convite.usuarioId])
      esperarErro(await cenario.aceitar(convite.token, SENHA_NOVA), 404, ErrorCode.NAO_ENCONTRADO)
      const { rows } = await cenario.pool.query<{ usado: boolean; senha: boolean }>(
        'select c.usado_em is not null as usado, co.senha_hash is not null as senha from convite c join usuario u on u.id = c.usuario_id join conta co on co.id = u.conta_id where c.id = $1',
        [convite.conviteId],
      )
      expect(rows).toEqual([{ usado: false, senha: false }])
      const { rows: auditoria } = await cenario.pool.query("select 1 from auditoria where escola_id = $1 and acao = 'convite.aceito'", [convite.escolaId])
      expect(auditoria).toEqual([])
    })
  })

  /** Um desafio `mfa` novo, com o bilhete, para errar o código sem gastar o desafio da tentativa sob teste. */
  async function desafioNovo(conta: ContaDeTeste, bilhete: string): Promise<string> {
    return cenario.desafio(await cenario.entrar(conta.email, SENHA_DA_CONTA, bilhete))
  }
})
