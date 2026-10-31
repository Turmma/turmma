import { ESTADOS_DA_COORDENACAO } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { estadoDaCoordenacao, type UltimoConviteDaCoordenacao } from './estado-da-coordenacao.js'

/**
 * A4 (`tasks/prd-apresentacao-painel/cenarios.md`): os sete estados de `estadoDaCoordenacao`, com o convite na borda das
 * 72 h (um segundo antes e um depois) e o usuário desativado antes e depois do aceite.
 */

const HORA_MS = 60 * 60 * 1_000
const criadoEm = new Date('2026-09-20T12:00:00.000Z')
const expiraEm = new Date(criadoEm.getTime() + 72 * HORA_MS)
const aceitoEm = new Date(criadoEm.getTime() + HORA_MS)
const antesDoAceite = new Date(criadoEm.getTime() + 5_000)
const depoisDoAceite = new Date(aceitoEm.getTime() + 1_000)
const agora = new Date(criadoEm.getTime() + 2 * HORA_MS)

const convite = (campos: Partial<UltimoConviteDaCoordenacao> = {}): UltimoConviteDaCoordenacao => ({
  id: '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5',
  expiraEm,
  usadoEm: null,
  revogadoEm: null,
  usuarioDesativadoEm: antesDoAceite,
  ...campos,
})

describe('estadoDaCoordenacao (A4)', () => {
  it('sem coordenador ativo e sem convite: sem_convite', () => {
    expect(estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: undefined, agora })).toBe('sem_convite')
  })

  it('coordenador ativo vence qualquer convite: ativa', () => {
    for (const ultimoConvite of [undefined, convite(), convite({ revogadoEm: agora }), convite({ usadoEm: aceitoEm, usuarioDesativadoEm: depoisDoAceite })]) {
      expect(estadoDaCoordenacao({ coordenadorAtivo: true, ultimoConvite, agora })).toBe('ativa')
    }
  })

  it('não usado: pendente até um segundo antes das 72 h, vencido na hora e um segundo depois', () => {
    expect(estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: convite(), agora: new Date(expiraEm.getTime() - 1_000) })).toBe('pendente')
    expect(estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: convite(), agora: expiraEm })).toBe('vencido')
    expect(estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: convite(), agora: new Date(expiraEm.getTime() + 1_000) })).toBe('vencido')
  })

  it('revogado vem antes de vencido e de usado: revogado', () => {
    for (const ultimoConvite of [
      convite({ revogadoEm: agora }),
      convite({ revogadoEm: agora, expiraEm: new Date(agora.getTime() - 1_000) }),
      convite({ revogadoEm: agora, usadoEm: aceitoEm, usuarioDesativadoEm: depoisDoAceite }),
      convite({ revogadoEm: agora, usadoEm: aceitoEm, usuarioDesativadoEm: antesDoAceite }),
    ]) {
      expect(estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite, agora })).toBe('revogado')
    }
  })

  it('usado, com o usuário inativo desde antes do aceite (ou no mesmo instante): aceito, mesmo depois das 72 h', () => {
    expect(estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: convite({ usadoEm: aceitoEm }), agora })).toBe('aceito')
    expect(estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: convite({ usadoEm: aceitoEm, usuarioDesativadoEm: aceitoEm }), agora })).toBe('aceito')
    expect(estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: convite({ usadoEm: aceitoEm }), agora: new Date(expiraEm.getTime() + 1_000) })).toBe('aceito')
  })

  it('usado, com o usuário desativado depois do aceite: sem_coordenacao', () => {
    expect(estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: convite({ usadoEm: aceitoEm, usuarioDesativadoEm: depoisDoAceite }), agora })).toBe('sem_coordenacao')
  })

  it('usado, com o usuário do convite ativo: ativa, ainda que coordenadorAtivo venha falso', () => {
    expect(estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: convite({ usadoEm: aceitoEm, usuarioDesativadoEm: null }), agora })).toBe('ativa')
  })

  it('os sete estados do contrato são alcançados, e só eles', () => {
    const alcancados = new Set([
      estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: undefined, agora }),
      estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: convite(), agora }),
      estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: convite(), agora: expiraEm }),
      estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: convite({ revogadoEm: agora }), agora }),
      estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: convite({ usadoEm: aceitoEm }), agora }),
      estadoDaCoordenacao({ coordenadorAtivo: false, ultimoConvite: convite({ usadoEm: aceitoEm, usuarioDesativadoEm: depoisDoAceite }), agora }),
      estadoDaCoordenacao({ coordenadorAtivo: true, ultimoConvite: undefined, agora }),
    ])
    expect([...alcancados].sort()).toEqual([...ESTADOS_DA_COORDENACAO].sort())
  })
})
