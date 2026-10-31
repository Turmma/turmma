import { ESTADOS_DO_PROFESSOR } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { estadoDoProfessor, type UltimoConviteDoProfessor } from './estado-do-professor.js'

/**
 * Os seis estados de `estadoDoProfessor` (A1, tarefa 3.0), com o convite na borda dos 7 dias (um segundo antes e na hora)
 * e o usuário desativado antes e depois do aceite. O E11 mora no `aceito`: o professor ativo pelo convite (conta nova,
 * ativada no aceite) e o que espera a primeira entrada (conta que já existia) têm o mesmo estado.
 */

const HORA_MS = 60 * 60 * 1_000
const criadoEm = new Date('2026-09-20T12:00:00.000Z')
const expiraEm = new Date(criadoEm.getTime() + 7 * 24 * HORA_MS)
const aceitoEm = new Date(criadoEm.getTime() + HORA_MS)
const antesDoAceite = new Date(criadoEm.getTime() + 5_000)
const depoisDoAceite = new Date(aceitoEm.getTime() + 1_000)
const agora = new Date(criadoEm.getTime() + 2 * HORA_MS)

const convite = (campos: Partial<UltimoConviteDoProfessor> = {}): UltimoConviteDoProfessor => ({
  id: '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5',
  expiraEm,
  usadoEm: null,
  revogadoEm: null,
  ...campos,
})

describe('estadoDoProfessor (A1, tarefa 3.0)', () => {
  it('não usado: pendente até um segundo antes dos 7 dias, vencido na hora e depois', () => {
    expect(estadoDoProfessor({ desativadoEm: antesDoAceite, ultimoConvite: convite(), agora: new Date(expiraEm.getTime() - 1_000) })).toBe('pendente')
    expect(estadoDoProfessor({ desativadoEm: antesDoAceite, ultimoConvite: convite(), agora: expiraEm })).toBe('vencido')
    expect(estadoDoProfessor({ desativadoEm: antesDoAceite, ultimoConvite: convite(), agora: new Date(expiraEm.getTime() + 1_000) })).toBe('vencido')
  })

  it('revogado vem antes de vencido e de usado, com o professor inativo', () => {
    for (const ultimoConvite of [convite({ revogadoEm: agora }), convite({ revogadoEm: agora, expiraEm: new Date(agora.getTime() - 1_000) }), convite({ revogadoEm: agora, usadoEm: aceitoEm })]) {
      expect(estadoDoProfessor({ desativadoEm: antesDoAceite, ultimoConvite, agora })).toBe('revogado')
    }
  })

  it('E11: aceito é o mesmo para o ativo pelo convite (conta nova) e para o que espera a primeira entrada (conta que já existia)', () => {
    const usado = convite({ usadoEm: aceitoEm })
    expect(estadoDoProfessor({ desativadoEm: null, ultimoConvite: usado, agora })).toBe('aceito')
    expect(estadoDoProfessor({ desativadoEm: antesDoAceite, ultimoConvite: usado, agora })).toBe('aceito')
    expect(estadoDoProfessor({ desativadoEm: aceitoEm, ultimoConvite: usado, agora })).toBe('aceito')
    // Depois dos 7 dias continua aceito: o prazo valeu no aceite.
    expect(estadoDoProfessor({ desativadoEm: antesDoAceite, ultimoConvite: usado, agora: new Date(expiraEm.getTime() + 1_000) })).toBe('aceito')
  })

  it('desativado depois do aceite, ou inativo sem convite de professor: desativado', () => {
    expect(estadoDoProfessor({ desativadoEm: depoisDoAceite, ultimoConvite: convite({ usadoEm: aceitoEm }), agora })).toBe('desativado')
    expect(estadoDoProfessor({ desativadoEm: antesDoAceite, ultimoConvite: undefined, agora })).toBe('desativado')
  })

  it('ativo sem convite de professor usado: ativo, com convite nenhum ou em aberto', () => {
    expect(estadoDoProfessor({ desativadoEm: null, ultimoConvite: undefined, agora })).toBe('ativo')
    expect(estadoDoProfessor({ desativadoEm: null, ultimoConvite: convite(), agora })).toBe('ativo')
  })

  it('os seis estados do contrato são alcançados, e só eles', () => {
    const alcancados = new Set([
      estadoDoProfessor({ desativadoEm: antesDoAceite, ultimoConvite: convite(), agora }),
      estadoDoProfessor({ desativadoEm: antesDoAceite, ultimoConvite: convite(), agora: expiraEm }),
      estadoDoProfessor({ desativadoEm: antesDoAceite, ultimoConvite: convite({ revogadoEm: agora }), agora }),
      estadoDoProfessor({ desativadoEm: null, ultimoConvite: convite({ usadoEm: aceitoEm }), agora }),
      estadoDoProfessor({ desativadoEm: null, ultimoConvite: undefined, agora }),
      estadoDoProfessor({ desativadoEm: antesDoAceite, ultimoConvite: undefined, agora }),
    ])
    expect([...alcancados].sort()).toEqual([...ESTADOS_DO_PROFESSOR].sort())
  })
})
