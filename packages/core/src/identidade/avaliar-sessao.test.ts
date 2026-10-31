import { describe, expect, it } from 'vitest'
import { avaliarSessao, sessaoAindaVale, tokenDaUltimaRenovacao, TOLERANCIA_DE_INATIVIDADE_MIN } from './avaliar-sessao.js'
import type { SessaoRow } from './sessao.repository.js'
import type { VerifiedToken } from './verify-token.js'

const token = {
  escolaId: '0190f5a0-0000-7000-8000-00000000000a',
  usuarioId: '0190f5a0-0000-7000-8000-0000000000a1',
  sessaoId: '0190f5a0-0000-7000-8000-0000000000d1',
} as VerifiedToken

const AGORA = new Date('2026-09-15T10:00:00-03:00')
const minutosAntes = (minutos: number) => new Date(AGORA.getTime() - minutos * 60_000)

function linha(ajuste: Partial<SessaoRow> = {}): SessaoRow {
  return {
    usuarioId: token.usuarioId,
    papel: 'aluno',
    desativadoEm: null,
    eliminacaoAgendadaEm: null,
    encerradaEm: null,
    expiraEm: new Date(AGORA.getTime() + 3_600_000),
    ultimoUsoEm: minutosAntes(1),
    inatividadeAlunoMin: 30,
    inatividadeEquipeMin: 120,
    anoLetivoId: '0190f5a0-0000-7000-8000-0000000000e1',
    rotacionadoEm: null,
    atualApresentado: false,
    agora: AGORA,
    ...ajuste,
  }
}

describe('avaliarSessao', () => {
  it('sessão válida vira o que vai para o contexto: escola, usuário e sessão do token, papel e ano da linha', () => {
    expect(avaliarSessao(token, linha({ papel: 'professor' }))).toEqual({ ...token, papel: 'professor', anoLetivoId: '0190f5a0-0000-7000-8000-0000000000e1' })
  })

  it('escola sem ano em curso autentica, com o ano nulo', () => {
    expect(avaliarSessao(token, linha({ anoLetivoId: null }))?.anoLetivoId).toBeNull()
  })

  it.each<[string, SessaoRow | undefined]>([
    ['sessão inexistente para (esc, sid)', undefined],
    ['sessão de outro usuário (sessao.usuario_id ≠ sub)', linha({ usuarioId: '0190f5a0-0000-7000-8000-0000000000a2' })],
    ['sessão encerrada', linha({ encerradaEm: minutosAntes(1) })],
    ['usuário desativado', linha({ desativadoEm: minutosAntes(1) })],
    // A eliminação agendada (F3, 14.0) tira o acesso mesmo com a sessão aberta: o registro encerra as sessões, e a guarda
    // não confia só nisso para a sessão que nascesse no meio.
    ['usuário com a eliminação agendada, sessão ainda aberta', linha({ eliminacaoAgendadaEm: minutosAntes(1) })],
    ['sessão expirada', linha({ expiraEm: minutosAntes(1) })],
    ['sessão expirando neste instante', linha({ expiraEm: AGORA })],
  ])('recusa %s', (_caso, lida) => {
    expect(avaliarSessao(token, lida)).toBeUndefined()
  })

  it('inatividade do aluno: vale até 30 min + 5 de tolerância, e vence nos 35', () => {
    expect(TOLERANCIA_DE_INATIVIDADE_MIN).toBe(5)
    expect(avaliarSessao(token, linha({ ultimoUsoEm: minutosAntes(34) }))).toBeDefined()
    expect(avaliarSessao(token, linha({ ultimoUsoEm: minutosAntes(35) }))).toBeUndefined()
  })

  it('inatividade da equipe usa a coluna da equipe, não a do aluno', () => {
    for (const papel of ['professor', 'coordenador'] as const) {
      expect(avaliarSessao(token, linha({ papel, ultimoUsoEm: minutosAntes(124) })), papel).toBeDefined()
      expect(avaliarSessao(token, linha({ papel, ultimoUsoEm: minutosAntes(125) })), papel).toBeUndefined()
    }
    // A mesma inatividade de 40 min vence o aluno e não vence o professor.
    expect(avaliarSessao(token, linha({ papel: 'aluno', ultimoUsoEm: minutosAntes(40) }))).toBeUndefined()
    expect(avaliarSessao(token, linha({ papel: 'professor', ultimoUsoEm: minutosAntes(40) }))).toBeDefined()
  })

  it('a inatividade configurada pela escola vale: com 10 min, o aluno vence nos 15', () => {
    expect(avaliarSessao(token, linha({ inatividadeAlunoMin: 10, ultimoUsoEm: minutosAntes(14) }))).toBeDefined()
    expect(avaliarSessao(token, linha({ inatividadeAlunoMin: 10, ultimoUsoEm: minutosAntes(15) }))).toBeUndefined()
  })

  it('compara com a hora do banco, não com a da máquina: uma linha lida de outro relógio segue a hora dela', () => {
    const noFuturo = new Date(AGORA.getTime() + 36 * 60_000)
    expect(avaliarSessao(token, linha({ ultimoUsoEm: AGORA, agora: noFuturo, expiraEm: new Date(noFuturo.getTime() + 60_000) }))).toBeUndefined()
  })
})

describe('sessaoAindaVale: o que a renovação confere, igual à guarda', () => {
  it('vale com uso recente; não vale encerrada, desativada, depois das 12 h ou além da inatividade do papel mais a tolerância', () => {
    expect(sessaoAindaVale(linha())).toBe(true)
    expect(sessaoAindaVale(linha({ encerradaEm: minutosAntes(1) }))).toBe(false)
    expect(sessaoAindaVale(linha({ desativadoEm: minutosAntes(1) }))).toBe(false)
    expect(sessaoAindaVale(linha({ eliminacaoAgendadaEm: minutosAntes(1) }))).toBe(false)
    expect(sessaoAindaVale(linha({ expiraEm: AGORA }))).toBe(false)
    expect(sessaoAindaVale(linha({ ultimoUsoEm: minutosAntes(30 + TOLERANCIA_DE_INATIVIDADE_MIN - 1) }))).toBe(true)
    expect(sessaoAindaVale(linha({ ultimoUsoEm: minutosAntes(30 + TOLERANCIA_DE_INATIVIDADE_MIN) }))).toBe(false)
    expect(sessaoAindaVale(linha({ papel: 'professor', ultimoUsoEm: minutosAntes(120 + TOLERANCIA_DE_INATIVIDADE_MIN - 1) }))).toBe(true)
  })
})

describe('tokenDaUltimaRenovacao: só o token emitido depois da rotação marca a sessão', () => {
  const rotacionadoEm = new Date('2026-09-15T10:00:00.400-03:00')
  const iat = (data: Date) => ({ ...token, emitidoEm: Math.floor(data.getTime() / 1_000) }) as VerifiedToken

  it('o token do segundo seguinte à rotação marca; o de antes dela, do mesmo segundo arredondado para baixo, não', () => {
    expect(tokenDaUltimaRenovacao(iat(new Date(rotacionadoEm.getTime() + 1_000)), linha({ rotacionadoEm }))).toBe(true)
    expect(tokenDaUltimaRenovacao(iat(new Date(rotacionadoEm.getTime() - 100)), linha({ rotacionadoEm }))).toBe(false)
  })

  it('sessão nunca renovada, já marcada, ou token sem iat: nada a marcar', () => {
    const depois = iat(new Date(rotacionadoEm.getTime() + 5_000))
    expect(tokenDaUltimaRenovacao(depois, linha({ rotacionadoEm: null }))).toBe(false)
    expect(tokenDaUltimaRenovacao(depois, linha({ rotacionadoEm, atualApresentado: true }))).toBe(false)
    expect(tokenDaUltimaRenovacao(token, linha({ rotacionadoEm }))).toBe(false)
  })
})
