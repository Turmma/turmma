import { unscopedJustification, TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO } from '@educa/nucleo'
import { describe, expect, it } from 'vitest'
import { ConviteRepository } from '../convite/convite.repository.js'
import { CriacaoDeSessaoRepository } from '../../credencial/criacao-de-sessao.repository.js'
import { EuRepository } from '../eu/eu.repository.js'
import { RegistroDeAcessoRepository } from '../../credencial/registro-de-acesso.repository.js'
import { EscritaDeSessaoRepository } from '../../credencial/escrita-de-sessao.repository.js'
import { RedefinicaoDeMfaRepository } from '../mfa/redefinicao-de-mfa.repository.js'
import { SessaoDeOrigemRepository } from '../../credencial/sessao-de-origem.repository.js'
import { ResolucaoDeTenantRepository } from './resolucao-de-tenant.repository.js'

const metodosDe = (classe: { prototype: object }) => Object.getOwnPropertyNames(classe.prototype).filter((nome) => nome !== 'constructor').sort()

describe('ResolucaoDeTenantRepository: toda operação sem escopo é marcada e justificada', () => {
  it('nasce só com os métodos da tabela da seção 6 que a tarefa usa, cada um com @SemEscopo e a justificativa dele', () => {
    expect(metodosDe(ResolucaoDeTenantRepository)).toEqual([
      'acessoDaSalaPorCodigo',
      'acessoDaSalaPorToken',
      'acessosDaConta',
      'apagarMfa',
      'ativarMfa',
      'avancarPassoDoMfa',
      'contaParaConvite',
      'contaPorEmail',
      'conviteValidoPorHash',
      'criarContas',
      'definirSenhaNoAceite',
      'escolaDoConviteParaOperador',
      'escolaDoUsuarioParaOperador',
      'escolaPorSlug',
      'escolasDaRedeDoIpDeSaida',
      'gravarFalhaDeLoginPorEmail',
      'gravarSegredoDeMfa',
      'introducaoMaisAntigaDaConta',
      'mfaDaConta',
      'sessaoParaRenovar',
      'temAcessoSuspenso',
      'travarContaParaRedefinir',
      'usarCodigoDeRecuperacao',
      'usarConvitePorHash',
      'usuarioComConviteAceito',
      'usuariosAtivosDaConta',
    ])
    const justificativas = Object.fromEntries(metodosDe(ResolucaoDeTenantRepository).map((metodo) => [metodo, unscopedJustification(ResolucaoDeTenantRepository, metodo)]))
    for (const [metodo, justificativa] of Object.entries(justificativas)) {
      expect(justificativa?.length ?? 0, metodo).toBeGreaterThanOrEqual(TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO)
    }
    expect(justificativas['sessaoParaRenovar']).toMatch(/cookie de renovação não diz a escola/)
    expect(justificativas['usuariosAtivosDaConta']).toMatch(/credencial da equipe é global/)
    expect(justificativas['acessosDaConta']).toMatch(/credencial da equipe é global/)
    // Telas do aluno, 1.0: a data da introdução entre as escolas da conta, no mesmo papel, que não sai em `acessos` nem no login.
    expect(justificativas['introducaoMaisAntigaDaConta']).toMatch(/credencial da equipe é global.*data mais antiga.*mesmo papel.*viu a introdução.*não sai em acessos nem no login/)
    expect(justificativas['criarContas']).toMatch(/conta é global/)
    expect(justificativas['contaPorEmail']).toMatch(/credencial da equipe é global/)
    expect(justificativas['gravarFalhaDeLoginPorEmail']).toMatch(/antes de haver escola/)
    for (const metodo of [
      'mfaDaConta',
      'gravarSegredoDeMfa',
      'ativarMfa',
      'avancarPassoDoMfa',
      'usarCodigoDeRecuperacao',
      'travarContaParaRedefinir',
      'apagarMfa',
    ]) {
      expect(justificativas[metodo], metodo).toMatch(/credencial da equipe é global/)
    }
    expect(justificativas['escolaDoUsuarioParaOperador']).toMatch(/rotina do operador/)
    // Tech Spec da A0b, seção 6: as duas que o painel também alcança dizem "comando ou painel".
    expect(justificativas['escolaDoConviteParaOperador']).toMatch(/rotina do operador, pelo comando ou pelo painel/)
    for (const metodo of ['conviteValidoPorHash', 'usarConvitePorHash']) expect(justificativas[metodo], metodo).toMatch(/link do convite não diz a escola/)
    for (const metodo of ['definirSenhaNoAceite', 'usuarioComConviteAceito']) expect(justificativas[metodo], metodo).toMatch(/credencial da equipe é global/)
    expect(justificativas['contaParaConvite']).toMatch(/conta é global.*pelo comando ou pelo painel/)
    expect(justificativas['escolaPorSlug']).toMatch(/slug é o que dá a escola/)
    expect(justificativas['escolasDaRedeDoIpDeSaida']).toMatch(/antes de haver escola/)
    // A1, tarefa 5.0 (I2): a página pública da sala acha o acesso pelo link ou pelo código, sem sessão.
    for (const metodo of ['acessoDaSalaPorToken', 'acessoDaSalaPorCodigo']) expect(justificativas[metodo], metodo).toMatch(/link e o código da sala não dizem a escola/)
  })

  it('a criação de usuário e sessão, o registro de acesso, o /v1/eu, as escritas da renovação, da atividade e da saída, o alvo da redefinição do MFA, o convite na escola e a sessão de origem da troca não saem sem escopo: usam a escola do contexto', () => {
    for (const classe of [
      CriacaoDeSessaoRepository,
      RegistroDeAcessoRepository,
      EuRepository,
      EscritaDeSessaoRepository,
      RedefinicaoDeMfaRepository,
      ConviteRepository,
      SessaoDeOrigemRepository,
    ]) {
      const metodos = metodosDe(classe)
      expect(metodos.length).toBeGreaterThan(0)
      for (const metodo of metodos) expect(unscopedJustification(classe, metodo), metodo).toBeUndefined()
    }
  })
})
