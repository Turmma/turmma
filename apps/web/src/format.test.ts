import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatDayOfInstant, formatDayAndTime, formatQuantity } from './format'

describe('formatação pt-BR', () => {
  it('data sem hora não volta um dia por causa do fuso', () => {
    expect(formatDate('2026-09-13')).toBe('13 de setembro de 2026')
    expect(formatDate('2026-01-01')).toBe('1 de janeiro de 2026')
  })

  it('o dia de um instante, sem hora, no formato brasileiro e no fuso do navegador', () => {
    // Meio-dia de UTC cai no mesmo dia em qualquer fuso de -12 a +11, então o dia não depende da máquina do teste.
    expect(formatDayOfInstant('2026-10-09T12:00:00.000Z')).toBe('09/10/2026')
    expect(formatDayOfInstant('2026-01-05T12:00:00.000Z')).toBe('05/01/2026')
  })

  it('data e hora no formato brasileiro', () => {
    expect(formatDateTime('2026-09-14T13:05:00.000Z')).toMatch(/^14\/09\/2026, \d{2}:05$/)
  })

  it('dia e hora da linha de aprovação: dia/mês, vírgula e a hora com "h", no fuso de quem lê', () => {
    const agora = new Date('2026-09-21T12:00:00.000Z')
    expect(formatDayAndTime('2026-09-19T13:42:00.000Z', { fuso: 'America/Sao_Paulo', agora })).toBe('19/09, 10h42')
    // Perto da meia-noite o fuso muda o dia: 01h30 em UTC ainda é a noite do dia 18 em São Paulo.
    expect(formatDayAndTime('2026-09-19T01:30:00.000Z', { fuso: 'America/Sao_Paulo', agora })).toBe('18/09, 22h30')
    // Meia-noite é 00h, e não 24h.
    expect(formatDayAndTime('2026-09-19T03:05:00.000Z', { fuso: 'America/Sao_Paulo', agora })).toBe('19/09, 00h05')
  })

  it('dia e hora de outro ano levam o ano: na auditoria, a data sem ele diria o dia errado', () => {
    const agora = new Date('2027-02-03T12:00:00.000Z')
    expect(formatDayAndTime('2026-09-19T13:42:00.000Z', { fuso: 'America/Sao_Paulo', agora })).toBe('19/09/2026, 10h42')
    // A virada do ano é a do fuso: 01h de 1º de janeiro em UTC ainda é 31 de dezembro em São Paulo.
    expect(formatDayAndTime('2027-01-01T01:00:00.000Z', { fuso: 'America/Sao_Paulo', agora: new Date('2027-01-01T01:30:00.000Z') })).toBe('31/12, 22h00')
  })

  it('quantidade com separador de milhar e plural', () => {
    expect(formatQuantity(0, 'aviso', 'avisos')).toBe('0 avisos')
    expect(formatQuantity(1, 'aviso', 'avisos')).toBe('1 aviso')
    expect(formatQuantity(1234, 'aviso', 'avisos')).toBe('1.234 avisos')
  })
})
