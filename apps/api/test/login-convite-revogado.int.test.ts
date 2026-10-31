import { ErrorCode } from '@educa/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { revogarConvitePeloOperador } from '../src/sessao/index.js'
import { CenarioDeAtivacao, SENHA_DA_CONTA, SENHA_ERRADA, type ContaDeTeste, type ConviteDeTeste } from './ativacao.fixture.js'
import { esperarErro, pedir, type Resposta } from './painel.fixture.js'
import { autorDaBancada } from './sessao.fixture.js'

/**
 * O login com o bilhete de um convite que já não ativa (A0b, tarefa 4.0; Tech Spec, seção 5, a **Decisão**), fora de
 * corrida: cenários E16 e as partes de login da E6, de `tasks/prd-apresentacao-painel/cenarios.md`. A corrida com o
 * gerar do operador é a E15, em `ativacao-under-lock.int.test.ts`. Postgres e Redis reais do compose de teste.
 *
 * A regra: com a senha (e o código, no MFA) certos e o bilhete desta conta, cujo convite foi revogado (pelo operador, ou
 * trocado por um gerar), entra no outro usuário ativo da conta, ou vai a `escolher` sem a escola do convite; sem outro,
 * `NAO_ENCONTRADO`, sem `login` nem `login_falho` no registro de acesso e com o contador igual ao de antes. Senha ou
 * código errados contam como sempre.
 */

/** Como o convite aceito deixa de ativar, fora de corrida. */
const COMO_DEIXA_DE_ATIVAR = ['revogado pelo operador', 'trocado por um gerar'] as const
type ComoDeixaDeAtivar = (typeof COMO_DEIXA_DE_ATIVAR)[number]

describe('login com o bilhete de um convite que já não ativa (E16, E6 de login)', () => {
  const cenario = new CenarioDeAtivacao()

  beforeAll(async () => {
    await cenario.subir()
  })

  afterAll(async () => {
    await cenario.fechar()
  })

  /** O convite aceito deixa de ativar: o operador revoga (em `aceito`), ou gera outro para outra pessoa. */
  async function deixarDeAtivar(convite: ConviteDeTeste, como: ComoDeixaDeAtivar): Promise<void> {
    if (como === 'revogado pelo operador') await revogarConvitePeloOperador(cenario.banco, autorDaBancada, convite.conviteId)
    else await cenario.convidar(convite.escolaId, `outra-pessoa-${convite.conviteId}@escola.invalid`)
    expect(await cenario.estado(convite.escolaId)).toBe(como === 'revogado pelo operador' ? 'revogado' : 'pendente')
  }

  /** Nada do que a senha certa com o convite perdido não pode trazer: o token de acesso, o desafio, a escola do convite. */
  function semNadaDoConvite(resposta: Resposta, convite: ConviteDeTeste): void {
    for (const proibido of [convite.escolaId, convite.usuarioId, convite.conviteId]) expect(resposta.texto).not.toContain(proibido)
  }

  /** O log da API não leva nada de pessoa nem de credencial desta tentativa (regra 20, item 9). */
  function logSemSegredos(conta: ContaDeTeste, ...segredos: string[]): void {
    const log = cenario.linhasDeLog.join('\n')
    for (const proibido of [conta.email, SENHA_DA_CONTA, SENHA_ERRADA, ...segredos]) expect(log.includes(proibido), 'segredo da tentativa no log').toBe(false)
  }

  describe('sem MFA, conta sem outro usuário ativo', () => {
    it.each(COMO_DEIXA_DE_ATIVAR)('convite %s: senha errada conta como sempre; a senha certa responde NAO_ENCONTRADO, sem login nem login_falho, e o contador volta ao de antes', async (como) => {
      const conta = await cenario.conta({ mfa: false })
      const convite = await cenario.aceito(conta)
      await deixarDeAtivar(convite, como)

      // Senha errada com o mesmo bilhete: `login_falho` e o contador somado, uma vez cada tentativa.
      for (let falha = 1; falha <= 2; falha++) {
        const antes = await cenario.registrosDeAcesso()
        esperarErro(await cenario.entrar(conta.email, SENHA_ERRADA, convite.bilhete), 401, ErrorCode.NAO_AUTENTICADO)
        expect(await cenario.falhasDaSenha(conta.email)).toBe(falha)
        expect(await cenario.registrosDeAcesso()).toEqual({ ...antes, loginFalho: antes.loginFalho + 1 })
      }

      // A senha certa: convite inválido. O contador fica nas duas falhas de antes: nem a reserva desta tentativa (três),
      // nem zerado como no acerto (zero).
      const antes = await cenario.registrosDeAcesso()
      const resposta = await cenario.entrar(conta.email, SENHA_DA_CONTA, convite.bilhete)
      esperarErro(resposta, 404, ErrorCode.NAO_ENCONTRADO)
      semNadaDoConvite(resposta, convite)
      expect(await cenario.falhasDaSenha(conta.email)).toBe(2)
      expect(await cenario.registrosDeAcesso()).toEqual(antes)
      expect(await cenario.ativo(convite.usuarioId)).toBe(false)
      expect(await cenario.sessoesDaConta(conta.contaId)).toBe(0)
      expect(await cenario.ativacoes(convite.escolaId)).toEqual([])
      logSemSegredos(conta, convite.bilhete)
    })

    it.each(['sem MFA', 'com MFA'] as const)('permissão: o bilhete válido de outra conta, com a senha certa da conta sem usuário ativo (%s), é a recusa única do RF6, nunca NAO_ENCONTRADO', async (comoEntra) => {
      const mfa = comoEntra === 'com MFA'
      // X aceitou o convite dele e teve o convite revogado: o bilhete de X é válido e aponta um convite que já não ativa.
      const contaX = await cenario.conta({ mfa: false })
      const deX = await cenario.aceito(contaX)
      await deixarDeAtivar(deX, 'revogado pelo operador')
      // Y não tem usuário ativo. Sem a conferência da conta do bilhete, a senha certa de Y com o bilhete de X daria 404
      // e desfaria a reserva, enquanto a errada daria 401: a diferença entregaria quando a senha de Y acertou.
      const contaY = await cenario.conta({ mfa })
      const forjado = `${deX.bilhete.slice(0, -4)}${deX.bilhete.endsWith('AAAA') ? 'BBBB' : 'AAAA'}`
      expect(forjado).not.toBe(deX.bilhete)
      let falhas = 0
      for (const bilhete of [deX.bilhete, forjado, 'nao-e-um-jwt']) {
        const antes = await cenario.registrosDeAcesso()
        const resposta = await cenario.entrar(contaY.email, SENHA_DA_CONTA, bilhete)
        esperarErro(resposta, 401, ErrorCode.NAO_AUTENTICADO)
        expect(await cenario.falhasDaSenha(contaY.email)).toBe(++falhas)
        expect(await cenario.registrosDeAcesso()).toEqual({ ...antes, loginFalho: antes.loginFalho + 1 })
      }
    })

    it('clique duplo: duas entradas com a senha certa ao mesmo tempo respondem NAO_ENCONTRADO, e o contador fica no de antes', async () => {
      const conta = await cenario.conta({ mfa: false })
      const convite = await cenario.aceito(conta)
      await deixarDeAtivar(convite, 'revogado pelo operador')
      esperarErro(await cenario.entrar(conta.email, SENHA_ERRADA, convite.bilhete), 401, ErrorCode.NAO_AUTENTICADO)
      const antes = await cenario.registrosDeAcesso()
      const respostas = await Promise.all([cenario.entrar(conta.email, SENHA_DA_CONTA, convite.bilhete), cenario.entrar(conta.email, SENHA_DA_CONTA, convite.bilhete)])
      for (const resposta of respostas) esperarErro(resposta, 404, ErrorCode.NAO_ENCONTRADO)
      expect(await cenario.falhasDaSenha(conta.email)).toBe(1)
      expect(await cenario.registrosDeAcesso()).toEqual(antes)
    })

    it('sem o bilhete, a mesma senha certa na conta sem usuário ativo continua sendo a resposta única do RF6, com login_falho', async () => {
      const conta = await cenario.conta({ mfa: false })
      const convite = await cenario.aceito(conta)
      await deixarDeAtivar(convite, 'revogado pelo operador')
      const antes = await cenario.registrosDeAcesso()
      esperarErro(await cenario.entrar(conta.email, SENHA_DA_CONTA), 401, ErrorCode.NAO_AUTENTICADO)
      expect(await cenario.falhasDaSenha(conta.email)).toBe(1)
      expect(await cenario.registrosDeAcesso()).toEqual({ ...antes, loginFalho: antes.loginFalho + 1 })
    })
  })

  describe('sem MFA, conta com usuário ativo em outra escola', () => {
    it.each(COMO_DEIXA_DE_ATIVAR)('convite %s: entra no outro usuário, sem ativar o do convite, e nada da escola do convite na resposta', async (como) => {
      const conta = await cenario.conta({ mfa: false })
      const outra = await cenario.usuarioAtivoEmOutraEscola(conta.contaId)
      const convite = await cenario.aceito(conta)
      await deixarDeAtivar(convite, como)

      const resposta = await cenario.entrar(conta.email, SENHA_DA_CONTA, convite.bilhete)
      expect(resposta.status).toBe(200)
      expect(resposta.corpo).toEqual({ etapa: 'pronta', token: expect.any(String), expiraEm: expect.any(String) })
      semNadaDoConvite(resposta, convite)
      const eu = await pedir(cenario.url, 'GET', '/v1/eu', String((resposta.corpo as { token: string }).token))
      expect((eu.corpo as { escola: { id: string } }).escola.id).toBe(outra.escolaId)
      semNadaDoConvite(eu, convite)
      expect(await cenario.ativo(convite.usuarioId)).toBe(false)
      expect(await cenario.ativacoes(convite.escolaId)).toEqual([])
    })

    it('com dois outros usuários ativos, vai a escolher só com eles, sem a escola do convite', async () => {
      const conta = await cenario.conta({ mfa: false })
      const [primeira, segunda] = [await cenario.usuarioAtivoEmOutraEscola(conta.contaId), await cenario.usuarioAtivoEmOutraEscola(conta.contaId)]
      const convite = await cenario.aceito(conta)
      await deixarDeAtivar(convite, 'revogado pelo operador')

      const resposta = await cenario.entrar(conta.email, SENHA_DA_CONTA, convite.bilhete)
      expect(resposta.corpo).toEqual({ etapa: 'escolher', desafio: expect.any(String), acessos: expect.any(Array) })
      const acessos = (resposta.corpo as { acessos: Array<{ usuarioId: string }> }).acessos
      expect(acessos.map((acesso) => acesso.usuarioId).sort()).toEqual([primeira?.usuarioId, segunda?.usuarioId].sort())
      semNadaDoConvite(resposta, convite)
      expect(await cenario.ativo(convite.usuarioId)).toBe(false)
    })
  })

  describe('com MFA', () => {
    it.each(COMO_DEIXA_DE_ATIVAR)('convite %s, sem outro usuário: a senha certa leva ao código; código errado conta; o certo responde NAO_ENCONTRADO, e os dois contadores ficam nos de antes', async (como) => {
      const conta = await cenario.conta({ mfa: true })
      const convite = await cenario.aceito(conta)
      await deixarDeAtivar(convite, como)

      esperarErro(await cenario.entrar(conta.email, SENHA_ERRADA, convite.bilhete), 401, ErrorCode.NAO_AUTENTICADO)
      esperarErro(await cenario.entrar(conta.email, SENHA_ERRADA, convite.bilhete), 401, ErrorCode.NAO_AUTENTICADO)
      expect(await cenario.falhasDaSenha(conta.email)).toBe(2)

      // A senha certa: o código vem antes da resposta, e a tentativa da senha não conta (nem zera as de antes).
      const desafio = cenario.desafio(await cenario.entrar(conta.email, SENHA_DA_CONTA, convite.bilhete))
      expect(await cenario.falhasDaSenha(conta.email)).toBe(2)

      // Código errado com o mesmo desafio: conta, com `login_falho`, como sempre.
      for (let falha = 1; falha <= 2; falha++) {
        const antes = await cenario.registrosDeAcesso()
        esperarErro(await cenario.codigo(desafio, cenario.codigoErrado(conta.base32)), 401, ErrorCode.NAO_AUTENTICADO)
        expect(await cenario.falhasDoCodigo(conta.contaId)).toBe(falha)
        expect(await cenario.registrosDeAcesso()).toEqual({ ...antes, loginFalho: antes.loginFalho + 1 })
      }

      const antes = await cenario.registrosDeAcesso()
      const resposta = await cenario.codigo(desafio, cenario.codigoDoApp(conta.base32))
      esperarErro(resposta, 404, ErrorCode.NAO_ENCONTRADO)
      semNadaDoConvite(resposta, convite)
      expect(await cenario.falhasDoCodigo(conta.contaId)).toBe(2)
      expect(await cenario.falhasDaSenha(conta.email)).toBe(2)
      expect(await cenario.registrosDeAcesso()).toEqual(antes)
      expect(await cenario.ativo(convite.usuarioId)).toBe(false)
      expect(await cenario.sessoesDaConta(conta.contaId)).toBe(0)
      logSemSegredos(conta, convite.bilhete, desafio)
    })

    it('convite revogado antes do login, com outro usuário ativo: segue o login dele, e o código entra nele sem ativar o do convite', async () => {
      const conta = await cenario.conta({ mfa: true })
      const outra = await cenario.usuarioAtivoEmOutraEscola(conta.contaId, 'coordenador')
      const convite = await cenario.aceito(conta)
      await deixarDeAtivar(convite, 'revogado pelo operador')
      const desafio = cenario.desafio(await cenario.entrar(conta.email, SENHA_DA_CONTA, convite.bilhete))
      const resposta = await cenario.codigo(desafio, cenario.codigoDoApp(conta.base32))
      expect(resposta.corpo).toEqual({ etapa: 'pronta', token: expect.any(String), expiraEm: expect.any(String) })
      semNadaDoConvite(resposta, convite)
      const eu = await pedir(cenario.url, 'GET', '/v1/eu', String((resposta.corpo as { token: string }).token))
      expect((eu.corpo as { escola: { id: string } }).escola.id).toBe(outra.escolaId)
      expect(await cenario.ativo(convite.usuarioId)).toBe(false)
    })

    it.each([0, 1])('entre as etapas, com %i outro(s) usuário(s) ativo(s): a senha certa com o convite ainda válido leva ao código, o operador revoga antes do código, e o código certo não ativa', async (outros) => {
      const conta = await cenario.conta({ mfa: true })
      const outra = outros === 1 ? await cenario.usuarioAtivoEmOutraEscola(conta.contaId) : undefined
      const convite = await cenario.aceito(conta)
      const desafio = cenario.desafio(await cenario.entrar(conta.email, SENHA_DA_CONTA, convite.bilhete))
      await deixarDeAtivar(convite, 'revogado pelo operador')

      const resposta = await cenario.codigo(desafio, cenario.codigoDoApp(conta.base32))
      semNadaDoConvite(resposta, convite)
      expect(await cenario.ativo(convite.usuarioId)).toBe(false)
      expect(await cenario.falhasDoCodigo(conta.contaId)).toBe(0)
      if (outra === undefined) {
        esperarErro(resposta, 404, ErrorCode.NAO_ENCONTRADO)
        return
      }
      // Com o outro usuário, o código cumprido entra nele.
      expect(resposta.corpo).toEqual({ etapa: 'pronta', token: expect.any(String), expiraEm: expect.any(String) })
      const eu = await pedir(cenario.url, 'GET', '/v1/eu', String((resposta.corpo as { token: string }).token))
      expect((eu.corpo as { escola: { id: string } }).escola.id).toBe(outra.escolaId)
    })
  })

  describe('E6 (login): gerar em aceito e em sem_coordenacao', () => {
    it('gerar em aceito com o mesmo e-mail reusa o usuário: o bilhete do aceite antigo não o ativa, e o do convite novo ativa', async () => {
      const conta = await cenario.conta({ mfa: false })
      const antigo = await cenario.aceito(conta)
      const novo = await cenario.convidar(antigo.escolaId, conta.email)
      expect(novo.usuarioId).toBe(antigo.usuarioId)

      esperarErro(await cenario.entrar(conta.email, SENHA_DA_CONTA, antigo.bilhete), 404, ErrorCode.NAO_ENCONTRADO)
      expect(await cenario.ativo(antigo.usuarioId)).toBe(false)

      const bilheteNovo = await cenario.bilheteDoAceite(novo.token)
      const resposta = await cenario.entrar(conta.email, SENHA_DA_CONTA, bilheteNovo)
      expect(resposta.corpo).toEqual({ etapa: 'configurar_mfa', desafio: expect.any(String) })
      expect(await cenario.ativo(novo.usuarioId)).toBe(true)
      expect(await cenario.ativacoes(novo.escolaId)).toEqual([{ entidade_id: novo.usuarioId, depois: { conviteId: novo.conviteId } }])
      expect(await cenario.estado(novo.escolaId)).toBe('ativa')
    })

    it('gerar em sem_coordenacao com o e-mail da coordenadora desativada reusa o usuário; o convite usado fica revogado só como registro, e o aceite novo o reativa', async () => {
      const conta = await cenario.conta({ mfa: false })
      const primeiro = await cenario.aceito(conta)
      expect((await cenario.entrar(conta.email, SENHA_DA_CONTA, primeiro.bilhete)).corpo).toEqual({ etapa: 'configurar_mfa', desafio: expect.any(String) })
      expect(await cenario.ativo(primeiro.usuarioId)).toBe(true)
      await cenario.pool.query('update usuario set desativado_em = now() where id = $1', [primeiro.usuarioId])
      expect(await cenario.estado(primeiro.escolaId)).toBe('sem_coordenacao')

      const novo = await cenario.convidar(primeiro.escolaId, conta.email)
      expect(novo.usuarioId).toBe(primeiro.usuarioId)
      // O convite já usado ganha `revogado_em`, e nada mais muda nele: o estado passa a ser o do convite novo.
      const { rows } = await cenario.pool.query<{ usado: boolean; revogado: boolean }>('select usado_em is not null as usado, revogado_em is not null as revogado from convite where id = $1', [
        primeiro.conviteId,
      ])
      expect(rows).toEqual([{ usado: true, revogado: true }])
      expect(await cenario.estado(primeiro.escolaId)).toBe('pendente')

      const bilheteNovo = await cenario.bilheteDoAceite(novo.token)
      expect((await cenario.entrar(conta.email, SENHA_DA_CONTA, bilheteNovo)).corpo).toEqual({ etapa: 'configurar_mfa', desafio: expect.any(String) })
      expect(await cenario.ativo(primeiro.usuarioId)).toBe(true)
      expect(await cenario.ativacoes(primeiro.escolaId)).toEqual([
        { entidade_id: primeiro.usuarioId, depois: { conviteId: primeiro.conviteId } },
        { entidade_id: primeiro.usuarioId, depois: { conviteId: novo.conviteId } },
      ])
      expect(await cenario.estado(primeiro.escolaId)).toBe('ativa')
    })
  })
})
