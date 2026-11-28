// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { setupScreen, fakeNetwork, renderScreen } from '../../__fixtures__/render-screen'
import { AVISO_DA_AVALIACAO, AVISO_DA_PROVA } from './atividades'
import { EscolhaDaAtividade } from './EscolhaDaAtividade'

/**
 * A escolha da atividade em que o aluno quer ajuda do Tutor: a avaliação que ainda espera resposta é avisada antes de abrir, com o texto da prova
 * (o Tutor pausa só durante ela) quando tem janela e o de antes da F6 quando não tem; a atividade comum e a avaliação já entregue não levam aviso.
 */
setupScreen()

const atividade = (final: string, campos: Record<string, unknown> = {}) => ({
  id: `0192a4c0-5b1e-7c3d-8e4f-0000000000${final}`,
  titulo: `Lista sintética ${final}`,
  disciplina: { id: '0192a4c0-5b1e-7c3d-8e4f-0000000000ff', nome: 'Química' },
  avaliativa: false,
  situacao: 'para_fazer',
  questoes: 3,
  respondidas: 0,
  aplicadaEm: '2026-10-05T13:00:00.000Z',
  enviadaEm: null,
  janela: null,
  duracaoMin: null,
  ...campos,
})

describe('a escolha da atividade do Tutor', () => {
  it('a avaliação que espera resposta leva o aviso certo (da prova com janela, de antes sem ela); a comum e a já entregue não levam aviso', async () => {
    const janela = { abreEm: '2030-03-12T13:00:00.000Z', fechaEm: '2030-03-12T14:40:00.000Z' }
    const rede = fakeNetwork()
    rede.responderPor('/v1/minhas-atividades', {
      status: 200,
      corpo: {
        itens: [
          atividade('01', { avaliativa: true, janela, duracaoMin: 40 }),
          atividade('02', { avaliativa: true }),
          atividade('03'),
          atividade('04', { avaliativa: true, situacao: 'enviada', respondidas: 3, enviadaEm: '2026-10-06T13:00:00.000Z' }),
        ],
      },
    })
    renderScreen(
      <Router base="/aluno">
        <EscolhaDaAtividade />
      </Router>,
    )

    const linhas = within(await screen.findByRole('list')).getAllByRole('listitem') as [HTMLElement, HTMLElement, HTMLElement, HTMLElement]
    const [prova, antiga, comum, entregue] = linhas
    expect(prova.textContent).toContain(AVISO_DA_PROVA)
    expect(prova.textContent).not.toContain(AVISO_DA_AVALIACAO)
    expect(antiga.textContent).toContain(AVISO_DA_AVALIACAO)
    expect(antiga.textContent).not.toContain(AVISO_DA_PROVA)
    for (const linha of [comum, entregue]) {
      expect(linha.textContent).not.toContain(AVISO_DA_AVALIACAO)
      expect(linha.textContent).not.toContain(AVISO_DA_PROVA)
    }
  })
})
