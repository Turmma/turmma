import { describe, expect, it } from 'vitest'
import { motivoDaRejeicao, textoDaAprovacao } from './approval'

const OPCOES = { fuso: 'America/Sao_Paulo', agora: new Date('2026-09-21T12:00:00.000Z') }
const QUANDO = '2026-09-19T13:42:00.000Z'

describe('linha de aprovação', () => {
  it('a aprovada diz quem aprovou e quando, no formato brasileiro', () => {
    expect(textoDaAprovacao({ estado: 'aprovada', por: 'Camila Souza', quando: QUANDO }, OPCOES)).toBe('Aprovado por Camila Souza · 19/09, 10h42')
  })

  it('o verbo acompanha o que foi aprovado', () => {
    expect(textoDaAprovacao({ estado: 'aprovada', por: 'Camila Souza', quando: QUANDO }, { ...OPCOES, verbo: 'Validação registrada por' })).toBe(
      'Validação registrada por Camila Souza · 19/09, 10h42',
    )
  })

  it('a pendente diz que espera, sem autor nem hora, e o verbo da aprovação não aparece nela', () => {
    expect(textoDaAprovacao({ estado: 'pendente' }, OPCOES)).toBe('Esperando você')
    expect(textoDaAprovacao({ estado: 'pendente' }, { ...OPCOES, espera: 'Esperando o professor', verbo: 'Aprovada por' })).toBe('Esperando o professor')
  })

  it('a rejeitada diz quem rejeitou e quando, e o motivo vem numa linha própria', () => {
    const rejeitada = { estado: 'rejeitada', por: 'Camila Souza', quando: QUANDO, motivo: '  A questão 3 não é do capítulo.  ' } as const
    // O verbo é o da aprovação: a rejeição nunca sai escrita como "Aprovada por". E a frase não muda com o gênero de
    // quem rejeitou nem do que foi rejeitado.
    expect(textoDaAprovacao(rejeitada, { ...OPCOES, verbo: 'Aprovada por' })).toBe('Camila Souza rejeitou · 19/09, 10h42')
    expect(textoDaAprovacao({ ...rejeitada, por: 'Rafael Lima' }, OPCOES)).toBe('Rafael Lima rejeitou · 19/09, 10h42')
    expect(motivoDaRejeicao(rejeitada)).toBe('Motivo: A questão 3 não é do capítulo.')
  })

  it('só a rejeitada tem motivo, e motivo em branco não vira linha vazia', () => {
    expect(motivoDaRejeicao({ estado: 'pendente' })).toBeUndefined()
    expect(motivoDaRejeicao({ estado: 'aprovada', por: 'Camila Souza', quando: QUANDO })).toBeUndefined()
    expect(motivoDaRejeicao({ estado: 'rejeitada', por: 'Camila Souza', quando: QUANDO, motivo: '   ' })).toBeUndefined()
  })
})
