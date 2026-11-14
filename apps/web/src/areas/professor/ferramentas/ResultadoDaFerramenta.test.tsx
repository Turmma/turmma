// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { describe, expect, it } from 'vitest'
import { createQueryClient } from '../../../api/query-client'
import { fakeNetwork, setupScreen } from '../../../__fixtures__/render-screen'
import { ResultadoDaFerramenta } from './ResultadoDaFerramenta'

/**
 * O resultado da ferramenta, dentro da conversa e no formulário: o chip das questões diz o título e a edição **das `fontes` do
 * artefato** (ingestao-do-material, 10.0; RF11), sem ler a lista de materiais, que já não tem a edição anterior.
 */
setupScreen()

const ARTEFATO = '0197a1c0-0000-7000-8000-000000000001'
const MATERIAL = '0197a1c0-0000-7000-8000-000000000300'

const artefato = (fontes: unknown[]) => ({
  id: ARTEFATO,
  tipo: 'atividade_objetiva',
  titulo: 'Atividade 1',
  turmaId: '0197a1c0-0000-7000-8000-000000000100',
  disciplinaId: '0197a1c0-0000-7000-8000-000000000200',
  origemId: null,
  adaptacao: null,
  entrega: null,
  criadoEm: '2026-10-05T13:00:00.000Z',
  conteudo: {
    tipo: 'atividade_objetiva',
    titulo: 'Atividade 1',
    questoes: [
      {
        enunciado: 'Qual a massa de CO₂ formada na queima completa de 24 g de carbono?',
        alternativas: ['44 g', '88 g', '24 g', '12 g'],
        gabarito: 1,
        habilidade: { codigo: 'QUI.EM.04', descricao: 'Usar a proporção da equação balanceada.' },
        citacao: { materialId: MATERIAL, pagina: 142, trecho: 'Na combustão completa, cada mol de carbono forma um mol de dióxido de carbono.' },
        explicacao: '24 g de carbono são 2 mol.',
      },
    ],
  },
  versoesAdaptadas: [],
  aplicacoes: [],
  fontes,
})

function montar() {
  const localizacao = memoryLocation({ path: '/', record: true })
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <Router hook={localizacao.hook}>
        <ResultadoDaFerramenta artefatoId={ARTEFATO} entregaId={null} funcao="conversa_e_ferramentas" />
      </Router>
    </QueryClientProvider>,
  )
}

describe('o resultado da ferramenta lê o título e a edição das `fontes` do artefato', () => {
  it.each([
    ['com edição', { materialId: MATERIAL, titulo: 'Química 2', edicao: '2025', substituido: false }, /^Fonte: Química 2 \(2025\),\s?p\. 142$/],
    ['"edição anterior"', { materialId: MATERIAL, titulo: 'Química 2', edicao: '2024', substituido: true }, /^Fonte: Química 2 \(2024, edição anterior\),\s?p\. 142$/],
  ])('%s', async (_caso, fonte, nome) => {
    const rede = fakeNetwork()
    rede.responderPor(`/v1/artefatos/${ARTEFATO}`, { status: 200, corpo: artefato([fonte]) })
    montar()
    expect(await screen.findByRole('button', { name: nome })).toBeTruthy()
    expect(rede.chamadas.some((chamada) => chamada.caminho.startsWith('/v1/materiais'))).toBe(false)
  })
})
