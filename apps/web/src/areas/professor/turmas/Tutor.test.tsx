// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { criarClienteDeConsultas } from '../../../api/query-client'
import { prepararTela, redeFalsa, type RespostaFalsa } from '../../../__fixtures__/render-screen'
import Tutor from './Tutor'

/**
 * O endereço de antes do Tutor leva à aba Hoje da turma (telas do professor, 10.0; RF2): uma turma confirmada, à turma; mais de
 * uma, ou nenhuma, a Turmas. A rede é falsa; a rota, o cliente de consultas e a tela são os de verdade.
 */
prepararTela()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const QUIMICA = { id: id(500), nome: 'Química' }
const FISICA = { id: id(501), nome: 'Física' }
const TURMA_A = { id: id(101), nome: '1º A' }
const TURMA_B = { id: id(102), nome: '2º B' }

const vinculo = (n: number, turma: { id: string; nome: string }, disciplina = QUIMICA, estado = 'confirmado') => ({ id: id(400 + n), turma, disciplina, estado })
const vinculos = (...itens: readonly unknown[]): RespostaFalsa => ({ status: 200, corpo: { itens } })
const LIMITE: RespostaFalsa = { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }

function montar(resposta: RespostaFalsa | (() => RespostaFalsa)) {
  const rede = redeFalsa()
  rede.responderPor('/v1/meus-vinculos', resposta)
  const localizacao = memoryLocation({ path: '/time/tutor', record: true })
  render(
    <QueryClientProvider client={criarClienteDeConsultas()}>
      <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
        <Tutor />
      </Router>
    </QueryClientProvider>,
  )
  return localizacao
}

describe('/professor/time/tutor leva à aba Hoje', () => {
  it('uma turma confirmada leva a Hoje dela, com `replace`: o endereço antigo não fica no histórico', async () => {
    const localizacao = montar(vinculos(vinculo(1, TURMA_A)))
    await waitFor(() => expect(localizacao.history.at(-1)).toBe(`/turmas/${TURMA_A.id}?aba=hoje`))
    expect(localizacao.history).toEqual([`/turmas/${TURMA_A.id}?aba=hoje`])
  })

  it('duas disciplinas na mesma turma são uma turma só, e levam a ela', async () => {
    const localizacao = montar(vinculos(vinculo(1, TURMA_A), vinculo(2, TURMA_A, FISICA)))
    await waitFor(() => expect(localizacao.history.at(-1)).toBe(`/turmas/${TURMA_A.id}?aba=hoje`))
  })

  it('mais de uma turma leva a Turmas, onde ela escolhe', async () => {
    const localizacao = montar(vinculos(vinculo(1, TURMA_A), vinculo(2, TURMA_B)))
    await waitFor(() => expect(localizacao.history.at(-1)).toBe('/turmas'))
  })

  it('sem turma confirmada leva a Turmas; o vínculo pendente ou contestado não conta como turma', async () => {
    const semNada = montar(vinculos())
    await waitFor(() => expect(semNada.history.at(-1)).toBe('/turmas'))
    const soPendente = montar(vinculos(vinculo(1, TURMA_A, QUIMICA, 'pendente'), vinculo(2, TURMA_B, QUIMICA, 'contestado')))
    await waitFor(() => expect(soPendente.history.at(-1)).toBe('/turmas'))
    // Uma turma só, e pendente: não é turma dela ainda, e a página não a abre.
    const umaPendente = montar(vinculos(vinculo(1, TURMA_A, QUIMICA, 'pendente')))
    await waitFor(() => expect(umaPendente.history.at(-1)).toBe('/turmas'))
  })

  it('com mais vínculos na página seguinte, a turma "única" pode não ser: vai a Turmas, e não escolhe uma turma sem ter lido todas', async () => {
    const localizacao = montar({ status: 200, corpo: { itens: [vinculo(1, TURMA_A)], proxima: id(999) } })
    await waitFor(() => expect(localizacao.history.at(-1)).toBe('/turmas'))
    expect(localizacao.history).toEqual(['/turmas'])
  })

  it('enquanto os vínculos não chegam a tela diz que está abrindo, e não escolhe turma; se falham, mostra o erro e relê no "Tentar de novo"', async () => {
    const usuario = userEvent.setup()
    let falhando = true
    const localizacao = montar(() => (falhando ? LIMITE : vinculos(vinculo(1, TURMA_A))))
    await screen.findByRole('alert')
    expect(localizacao.history).toEqual(['/time/tutor'])
    falhando = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(localizacao.history.at(-1)).toBe(`/turmas/${TURMA_A.id}?aba=hoje`))
  })
})
