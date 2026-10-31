// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { ROTAS } from '../paths'
import { prepararTela, redeFalsa, renderizarTela } from '../__fixtures__/render-screen'
import { Inicio } from './Inicio'

/**
 * A raiz de quem entrou (telas do aluno e primeiro acesso, 2.0; RF1): cada papel é levado à tela em que abre, trocando a
 * entrada do histórico. O aluno abre no Início dele, e não na lista de tarefas nem na conversa.
 */
prepararTela()

const ESCOLA = { id: '0197a1c0-0000-7000-8000-0000000000e1', nome: 'Colégio Vista Alegre', slug: 'vista-alegre' }
const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const FALHA = { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: REQUISICAO } } } as const
const eu = (papel: 'aluno' | 'professor' | 'coordenador', introducaoVistaEm: string | null) => ({
  status: 200,
  corpo: { usuarioId: '0197a1c0-0000-7000-8000-0000000000a1', papel, nome: 'Camila Souza', escola: ESCOLA, inatividadeMin: 30, introducaoVistaEm, acessos: [] },
})

function abrirARaiz() {
  const localizacao = memoryLocation({ path: ROTAS.inicio, record: true })
  renderizarTela(
    <Router hook={localizacao.hook}>
      <Inicio />
    </Router>,
  )
  return localizacao
}

describe('a raiz de quem entrou', () => {
  it('o aluno abre em /aluno/inicio, e a raiz não fica no histórico', async () => {
    const rede = redeFalsa()
    rede.responder({
      status: 200,
      corpo: { usuarioId: '0197a1c0-0000-7000-8000-0000000000a1', papel: 'aluno', nome: 'Camila Souza', escola: ESCOLA, inatividadeMin: 30, introducaoVistaEm: '2026-02-01T10:00:00.000Z', acessos: [] },
    })
    const localizacao = memoryLocation({ path: ROTAS.inicio, record: true })
    renderizarTela(
      <Router hook={localizacao.hook}>
        <Inicio />
      </Router>,
    )

    await waitFor(() => expect(localizacao.history).toEqual([ROTAS.inicioDoAluno]))
  })

  it('o aluno que ainda não viu a introdução (data nula) é levado a ela, e a raiz não fica no histórico', async () => {
    const rede = redeFalsa()
    rede.responder(eu('aluno', null))
    const localizacao = abrirARaiz()

    await waitFor(() => expect(localizacao.history).toEqual([ROTAS.bemVindoDoAluno]))
  })

  it('enquanto o `/v1/eu` não chegou, a raiz não desvia para lugar nenhum: não pisca o Início nem a introdução', async () => {
    const rede = redeFalsa()
    const leitura = rede.segurar()
    const localizacao = abrirARaiz()

    expect(screen.getByText('Carregando a sua escola…')).toBeTruthy()
    expect(localizacao.history).toEqual([ROTAS.inicio])

    leitura.liberar(eu('aluno', null))
    await waitFor(() => expect(localizacao.history).toEqual([ROTAS.bemVindoDoAluno]))
  })

  it('o `/v1/eu` que falha mantém a tela em pé com "Tentar de novo", sem desvio', async () => {
    const rede = redeFalsa()
    rede.responder(FALHA)
    const localizacao = abrirARaiz()

    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(localizacao.history).toEqual([ROTAS.inicio])
  })

  it('o professor que ainda não viu a introdução (data nula) é levado a ela, e a raiz não fica no histórico', async () => {
    const rede = redeFalsa()
    rede.responder(eu('professor', null))
    const localizacao = abrirARaiz()

    await waitFor(() => expect(localizacao.history).toEqual([ROTAS.bemVindoDoProfessor]))
  })

  it('o professor que já viu a introdução abre em "Início" (/professor/nova-conversa), e a raiz não fica no histórico', async () => {
    const rede = redeFalsa()
    rede.responder(eu('professor', '2026-02-01T10:00:00.000Z'))
    const localizacao = abrirARaiz()

    await waitFor(() => expect(localizacao.history).toEqual([ROTAS.novaConversa]))
  })

  it('a coordenação que ainda não viu a introdução (data nula) é levada a ela, e a raiz não fica no histórico', async () => {
    const rede = redeFalsa()
    rede.responder(eu('coordenador', null))
    const localizacao = abrirARaiz()

    await waitFor(() => expect(localizacao.history).toEqual([ROTAS.bemVindoDaCoordenacao]))
  })

  it('a coordenação que já viu a introdução abre no Painel (/coordenacao/painel), e a raiz não fica no histórico', async () => {
    const rede = redeFalsa()
    rede.responder(eu('coordenador', '2026-02-01T10:00:00.000Z'))
    const localizacao = abrirARaiz()

    await waitFor(() => expect(localizacao.history).toEqual([ROTAS.painel]))
  })
})
