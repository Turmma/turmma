// @vitest-environment jsdom
import { conteudoDeAtividadeSchema } from '@educa/shared'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setupScreen } from '../../../__fixtures__/render-screen'
import { ConteudoDoArtefato } from './ConteudoDoArtefato'

/**
 * A linha da habilidade da questão no documento aberto sem quem a desenhe (classificacao-bncc, 11.0): o artefato aberto passa a troca (`habilidadeDaQuestao`), e o conteúdo usado sem ela, fora da conversa, diz a habilidade
 * ou "Sem habilidade", como a 10.0 decidiu. O que a tela do artefato faz com a troca é de `TrocaDeHabilidade.test.tsx`.
 */
setupScreen()

const MATERIAL = '0197a1c0-0000-7000-8000-000000000300'
const conteudo = conteudoDeAtividadeSchema.parse({
  tipo: 'atividade_objetiva',
  titulo: 'Atividade 1',
  questoes: [
    { enunciado: 'Qual a massa de CO₂?', alternativas: ['44 g', '88 g', '24 g', '12 g'], gabarito: 1, habilidade: { codigo: 'EM13CNT101', descricao: 'Analisar as transformações em sistemas.' }, citacao: { materialId: MATERIAL, pagina: 2, trecho: 'Na combustão completa.' }, explicacao: 'Porque sim.' },
    { enunciado: 'Qual o reagente limitante?', alternativas: ['O2', 'H2O', 'H2', 'Nenhum'], gabarito: 2, habilidade: null, citacao: { materialId: MATERIAL, pagina: 5, trecho: 'O limitante acaba primeiro.' }, explicacao: 'Porque sim.' },
  ],
})

describe('a habilidade da questão no conteúdo sem a troca', () => {
  it('diz o código e o texto da habilidade, e "Sem habilidade" na questão que não tem', () => {
    render(<ConteudoDoArtefato conteudo={conteudo} materiais={{}} />)
    expect(screen.getByText(/Habilidade EM13CNT101:/)).toBeTruthy()
    expect(screen.getByText('Analisar as transformações em sistemas.', { exact: false })).toBeTruthy()
    expect(screen.getAllByText('Sem habilidade')).toHaveLength(1)
  })

  it('com quem desenhe a linha, é ele que a desenha e a linha simples não aparece', () => {
    render(<ConteudoDoArtefato conteudo={conteudo} materiais={{}} habilidadeDaQuestao={(_, indice) => <p>Troca da questão {indice + 1}</p>} />)
    expect(screen.getByText('Troca da questão 1')).toBeTruthy()
    expect(screen.getByText('Troca da questão 2')).toBeTruthy()
    expect(screen.queryByText(/Habilidade EM13CNT101:/)).toBeNull()
    expect(screen.queryByText('Sem habilidade')).toBeNull()
  })
})
