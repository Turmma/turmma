// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { Suspense } from 'react'
import { describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { setupScreen, fakeNetwork, renderScreen } from '../../__fixtures__/render-screen'
import RotasDoAluno from './routes'

/**
 * Os endereços da área do aluno (telas do aluno e primeiro acesso, 2.0; RF2): o de "Minha turma" não é mais tela e leva a
 * Eu **trocando** a entrada do histórico, e o que a área não conhece responde "não encontrada". A navegação e o selecionado
 * são de `navigation.test.ts`; o que cada lugar mostra, dos testes de cada tela.
 */
setupScreen()

const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const NAO_ACHADA = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'x', requisicaoId: REQUISICAO } } } as const
/** O `/v1/eu` que o Início lê para a saudação: o desvio da entrada já o leu, e aqui a rota abre direto. */
const EU_DE_TESTE = {
  usuarioId: '0192a4c0-5b1e-7c3d-8e4f-0000000000e1',
  papel: 'aluno',
  nome: 'Ana Sintética',
  escola: { id: '0192a4c0-5b1e-7c3d-8e4f-0000000000e2', nome: 'Escola sintética', slug: 'escola-sintetica' },
  inatividadeMin: 20,
  introducaoVistaEm: '2026-10-01T12:00:00.000Z',
  acessos: [],
}

function abrir(caminho: string) {
  const localizacao = memoryLocation({ path: caminho, record: true })
  renderScreen(
    <Router base="/aluno" hook={localizacao.hook}>
      <Suspense fallback={null}>
        <RotasDoAluno />
      </Suspense>
    </Router>,
  )
  return localizacao
}

describe('os endereços do aluno', () => {
  it('"/aluno/minha-turma" abre Eu e some do histórico: o "voltar" não devolve o endereço que já não é tela', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', NAO_ACHADA)
    const localizacao = abrir('/aluno/minha-turma')

    expect(await screen.findByRole('heading', { level: 1, name: 'Eu' })).toBeTruthy()
    expect(localizacao.history).toEqual(['/aluno/eu'])
  })

  it('"/aluno/inicio" abre o Início', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/eu', { status: 200, corpo: EU_DE_TESTE })
    rede.responderPor('/v1/minhas-atividades', { status: 200, corpo: { itens: [] } })
    abrir('/aluno/inicio')
    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeTruthy()
    // A leitura que o Início faz foi respondida de verdade: o vazio, e não o erro de uma chamada sem resposta preparada.
    expect(await screen.findByText('Nenhuma tarefa por agora')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('"/aluno/bem-vindo" abre a introdução, com a fala do passo 1 como título', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/eu', { status: 200, corpo: { ...EU_DE_TESTE, introducaoVistaEm: null } })
    abrir('/aluno/bem-vindo')
    expect((await screen.findByRole('heading', { level: 1, name: 'Oi! Eu sou o Tutor, um programa da escola.' })).textContent).toBe('Oi! Eu sou o Tutor, um programa da escola.')
    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
  })

  it('um endereço que a área não tem responde "não encontrada"', async () => {
    abrir('/aluno/desempenho')
    expect(await screen.findByText(/não encontrada/i)).toBeTruthy()
  })
})
