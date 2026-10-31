import { describe, expect, it } from 'vitest'
import { estaNaJanela, fusoValido, msDoHorario, proximaAbertura, type JanelaLetiva } from './janela-letiva.js'

/** O padrão do `.env.example`: São Paulo, de segunda a sexta, das 07:00 às 18:00. */
const PADRAO: JanelaLetiva = { fuso: 'America/Sao_Paulo', diasLetivos: [1, 2, 3, 4, 5], inicio: '07:00', fim: '18:00' }

/** Um instante escrito com o deslocamento explícito, para o teste não depender do fuso da máquina. */
const em = (iso: string): Date => new Date(iso)

describe('estaNaJanela e proximaAbertura, com o padrão', () => {
  it('caminho feliz: terça às 10h em São Paulo está na janela, e o lote não urgente sai às 18h do mesmo dia', () => {
    const terca10h = em('2026-09-15T10:00:00-03:00')
    expect(estaNaJanela(PADRAO, terca10h)).toBe(true)
    expect(proximaAbertura(PADRAO, terca10h)).toEqual(em('2026-09-15T18:00:00-03:00'))
  })

  it('sábado às 10h está fora, e a abertura é agora: o lote não urgente sai na hora', () => {
    const sabado10h = em('2026-09-19T10:00:00-03:00')
    expect(estaNaJanela(PADRAO, sabado10h)).toBe(false)
    expect(proximaAbertura(PADRAO, sabado10h)).toEqual(sabado10h)
  })

  it('limites: 07:00 já está dentro, 06:59:59.999 fora; 17:59:59.999 dentro, 18:00 em ponto fora', () => {
    expect(estaNaJanela(PADRAO, em('2026-09-15T06:59:59.999-03:00'))).toBe(false)
    expect(estaNaJanela(PADRAO, em('2026-09-15T07:00:00-03:00'))).toBe(true)
    expect(estaNaJanela(PADRAO, em('2026-09-15T17:59:59.999-03:00'))).toBe(true)
    expect(estaNaJanela(PADRAO, em('2026-09-15T18:00:00-03:00'))).toBe(false)
  })

  it('antes das 7h de uma terça está fora: a madrugada é de lote', () => {
    const terca3h = em('2026-09-15T03:00:00-03:00')
    expect(estaNaJanela(PADRAO, terca3h)).toBe(false)
    expect(proximaAbertura(PADRAO, terca3h)).toEqual(terca3h)
  })

  it('borda: feriado numa quarta (Tiradentes, 21/04/2027) é tratado como dia letivo: segura até as 18h, sem erro', () => {
    const tiradentes10h = em('2027-04-21T10:00:00-03:00')
    expect(estaNaJanela(PADRAO, tiradentes10h)).toBe(true)
    expect(proximaAbertura(PADRAO, tiradentes10h)).toEqual(em('2027-04-21T18:00:00-03:00'))
  })

  it('a hora é a da parede da escola, não a do UTC: terça 20h UTC é 17h em São Paulo, dentro', () => {
    // Em UTC seriam 20h, fora do horário; e 10h UTC (7h em São Paulo) está dentro, não "antes das 7h".
    expect(estaNaJanela(PADRAO, em('2026-09-15T20:00:00Z'))).toBe(true)
    expect(estaNaJanela(PADRAO, em('2026-09-15T09:59:59Z'))).toBe(false)
    // Sexta 23h em São Paulo é sábado 02h em UTC: o dia da semana também é o da escola.
    expect(estaNaJanela({ ...PADRAO, inicio: '22:00', fim: '23:30' }, em('2026-09-18T23:00:00-03:00'))).toBe(true)
  })
})

describe('estaNaJanela com a configuração da escola', () => {
  it('borda: escola com aula aos sábados segura sábado às 10h; a do padrão, não', () => {
    const comSabado: JanelaLetiva = { ...PADRAO, diasLetivos: [1, 2, 3, 4, 5, 6] }
    const sabado10h = em('2026-09-19T10:00:00-03:00')
    expect(estaNaJanela(comSabado, sabado10h)).toBe(true)
    expect(proximaAbertura(comSabado, sabado10h)).toEqual(em('2026-09-19T18:00:00-03:00'))
    expect(estaNaJanela(PADRAO, sabado10h)).toBe(false)
    // O domingo continua fora para as duas.
    expect(estaNaJanela(comSabado, em('2026-09-20T10:00:00-03:00'))).toBe(false)
  })

  it('borda: escola em Manaus (UTC-4) — 17h59 de lá segura e 18h00 de lá libera, enquanto em São Paulo já são 19h', () => {
    const manaus: JanelaLetiva = { ...PADRAO, fuso: 'America/Manaus' }
    const manaus17h59 = em('2026-09-15T17:59:00-04:00')
    const manaus18h = em('2026-09-15T18:00:00-04:00')
    expect(estaNaJanela(manaus, manaus17h59)).toBe(true)
    expect(estaNaJanela(manaus, manaus18h)).toBe(false)
    expect(proximaAbertura(manaus, manaus17h59)).toEqual(manaus18h)
    // O mesmo instante com o fuso padrão já estaria fora: é o fuso da escola que decide.
    expect(estaNaJanela(PADRAO, manaus17h59)).toBe(false)
    // E às 06h30 de Manaus (07h30 em São Paulo) a escola de lá ainda não começou.
    expect(estaNaJanela(manaus, em('2026-09-15T06:30:00-04:00'))).toBe(false)
  })

  it('horário lido do Postgres (`HH:MM:SS`) vale igual a `HH:MM`', () => {
    const doBanco: JanelaLetiva = { ...PADRAO, inicio: '07:00:00', fim: '12:30:00' }
    expect(estaNaJanela(doBanco, em('2026-09-15T12:29:59-03:00'))).toBe(true)
    expect(estaNaJanela(doBanco, em('2026-09-15T12:30:00-03:00'))).toBe(false)
  })

  it('escola sem dia letivo nunca segura', () => {
    expect(estaNaJanela({ ...PADRAO, diasLetivos: [] }, em('2026-09-15T10:00:00-03:00'))).toBe(false)
  })

  it('fim às 24:00 emendado com o dia seguinte inteiro: a abertura pula para o fim do último dia seguido', () => {
    const fimDeSemanaInteiro: JanelaLetiva = { fuso: 'America/Sao_Paulo', diasLetivos: [6, 7], inicio: '00:00', fim: '24:00' }
    const sabado10h = em('2026-09-19T10:00:00-03:00')
    expect(estaNaJanela(fimDeSemanaInteiro, sabado10h)).toBe(true)
    expect(proximaAbertura(fimDeSemanaInteiro, sabado10h)).toEqual(em('2026-09-21T00:00:00-03:00'))
  })

  it('fuso com horário de verão: a abertura conta a hora que a virada pula', () => {
    // Nova York, 08/03/2026: às 2h de EST o relógio pula para 3h de EDT.
    const domingo: JanelaLetiva = { fuso: 'America/New_York', diasLetivos: [7], inicio: '00:00', fim: '24:00' }
    const antesDaVirada = em('2026-03-08T01:00:00-05:00')
    expect(estaNaJanela(domingo, antesDaVirada)).toBe(true)
    expect(estaNaJanela(domingo, em('2026-03-08T03:30:00-04:00'))).toBe(true)
    const abertura = proximaAbertura(domingo, antesDaVirada)
    expect(abertura).toEqual(em('2026-03-09T00:00:00-04:00'))
    expect(abertura.getTime() - antesDaVirada.getTime()).toBe(22 * 3_600_000)
  })

  it('fuso desconhecido lança, em vez de decidir com um fuso que ninguém configurou', () => {
    expect(() => estaNaJanela({ ...PADRAO, fuso: 'Brasil/Joinville' }, em('2026-09-15T10:00:00-03:00'))).toThrow(RangeError)
  })
})

describe('msDoHorario e fusoValido', () => {
  it('lê HH:MM, HH:MM:SS e a fração do Postgres; 24:00 é o fim do dia', () => {
    expect(msDoHorario('07:00')).toBe(7 * 3_600_000)
    expect(msDoHorario('17:59:59')).toBe(18 * 3_600_000 - 1_000)
    expect(msDoHorario('17:59:59.999')).toBe(18 * 3_600_000 - 1)
    expect(msDoHorario('24:00')).toBe(24 * 3_600_000)
  })

  it.each(['7:00', '07h00', '07:60', '07:00:60', '24:01', '25:00', '', '07:00Z'])('recusa %j', (horario) => {
    expect(msDoHorario(horario)).toBeUndefined()
  })

  it('conhece os fusos IANA e recusa o resto', () => {
    expect(fusoValido('America/Sao_Paulo')).toBe(true)
    expect(fusoValido('America/Noronha')).toBe(true)
    expect(fusoValido('Brasil/Joinville')).toBe(false)
    expect(fusoValido('')).toBe(false)
  })
})
