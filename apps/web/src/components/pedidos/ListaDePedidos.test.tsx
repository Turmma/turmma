// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { formatarDataHora } from '../../format'
import { AUTORIZACAO_DE_TESTE, prepararTela, redeFalsa, renderizarTela } from '../../__fixtures__/render-screen'
import { ListaDePedidos } from './ListaDePedidos'
import { TEXTO_ANTES_DA_LEITURA, TEXTO_DA_ATUALIZACAO_SOZINHA, TEXTO_DA_AUDITORIA_DA_LEITURA, TEXTO_DA_MATRICULA_ERRADA, TEXTO_DE_COMO_DECIDIR } from './textos'

/**
 * A lista dos pedidos de nome, vista como o professor e a coordenação a veem (A1, 16.0; RF12; W4): o estado de cada
 * momento, o rótulo do que se decide e o que muda de um papel para o outro. A API é falsa; a peça, o cliente de consultas
 * e a sessão são os da aba. O diálogo da decisão e a gravação dela ficam para o e2e (`e2e/`): este arquivo prova a
 * condição da tela, e o fluxo inteiro não precisa subir o compose para isso.
 */
prepararTela()

const TURMA = { id: '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5', nome: '7º A' }
const pedido = (final: string, nome: string, teveMatriculaErrada = false) => ({
  id: `0192a4c0-5b1e-7c3d-8e4f-0000000000${final}`,
  nome,
  solicitadaEm: '2026-10-02T15:00:00.000Z',
  teveMatriculaErrada,
})
const ANA = pedido('01', 'Ana sintética')
const BRUNO = pedido('02', 'Bruno sintético', true)
const CAIO = pedido('03', 'Caio sintético')
const VAZIO = { titulo: 'Nenhum pedido esperando', descricao: 'Quando um aluno pedir o nome dele, o pedido aparece aqui.' }

/** O texto do cartão de um pedido (o rótulo da caixa de marcar): nome, hora e, se houve, a marca da matrícula errada. */
const cartaoDe = (nome: string) => screen.getByRole('checkbox', { name: new RegExp(nome) }).closest('label')?.textContent ?? ''

function tela(quem: 'professor' | 'coordenacao', vazio: ComponentProps<typeof ListaDePedidos>['vazio'] = VAZIO) {
  return renderizarTela(<ListaDePedidos turma={TURMA} quem={quem} vazio={vazio} aoPerderATurma={() => undefined} />)
}

describe('ListaDePedidos', () => {
  it('professor: a lista é lida ao abrir, sem clique, carregando e depois com os pedidos; ele não tem "Atualizar", porque a lista se atualiza sozinha', async () => {
    const rede = redeFalsa()
    const leitura = rede.segurar()
    tela('professor')

    expect(await screen.findByText('Carregando os pedidos…')).toBeTruthy()
    expect(rede.chamadas).toEqual([{ caminho: `/v1/turmas/${TURMA.id}/reivindicacoes?limite=100`, metodo: 'GET', autorizacao: AUTORIZACAO_DE_TESTE }])
    expect(screen.queryByText(TEXTO_ANTES_DA_LEITURA)).toBeNull()

    leitura.liberar({ status: 200, corpo: { itens: [ANA, BRUNO] } })
    expect(await screen.findByText('2 pedidos esperando a decisão')).toBeTruthy()
    expect(screen.queryByText('Carregando os pedidos…')).toBeNull()
    expect(cartaoDe('Ana')).toContain(`Pediu em ${formatarDataHora(ANA.solicitadaEm)}`)
    expect(screen.getByText(TEXTO_DA_ATUALIZACAO_SOZINHA)).toBeTruthy()
    expect(screen.queryByText(TEXTO_DA_AUDITORIA_DA_LEITURA)).toBeNull()
    expect(screen.queryByRole('button', { name: /Atualizar/ })).toBeNull()
  })

  it('coordenação: nada é lido ao abrir; a tela diz que falta o clique e que cada leitura fica na auditoria, e só o "Atualizar" lê, com a finalidade', async () => {
    const rede = redeFalsa()
    const usuario = userEvent.setup()
    tela('coordenacao')

    expect(screen.getByText(TEXTO_ANTES_DA_LEITURA)).toBeTruthy()
    expect(screen.getByText(TEXTO_DA_AUDITORIA_DA_LEITURA)).toBeTruthy()
    expect(screen.queryByText(TEXTO_DA_ATUALIZACAO_SOZINHA)).toBeNull()
    expect(screen.queryByText('Carregando os pedidos…')).toBeNull()
    // Sem espera: a leitura que saísse sozinha sairia dentro da montagem (o efeito da consulta roda no `act` do `render`, e a
    // chamada à rede é síncrona a partir dele), e a rede falsa a registraria antes de o `render` devolver.
    expect(rede.chamadas).toEqual([])

    rede.responder({ status: 200, corpo: { itens: [ANA] } })
    // O nome acessível é "Atualizar os pedidos" no navegador; o `jsdom` perde o espaço antes do trecho `sr-only`, e o
    // caso não depende disso.
    await usuario.click(screen.getByRole('button', { name: /^Atualizar/ }))

    expect(await screen.findByText('1 pedido esperando a decisão')).toBeTruthy()
    expect(rede.chamadas).toEqual([
      { caminho: `/v1/turmas/${TURMA.id}/reivindicacoes?limite=100&finalidade=conferencia_de_cadastro`, metodo: 'GET', autorizacao: AUTORIZACAO_DE_TESTE },
    ])
    expect(screen.queryByText(TEXTO_ANTES_DA_LEITURA)).toBeNull()
  })

  it('o rótulo da decisão diz quantos pedidos ela alcança, nenhum botão sai antes de marcar, e a marca da matrícula errada fica só no pedido que a teve', async () => {
    const rede = redeFalsa()
    rede.responder({ status: 200, corpo: { itens: [ANA, BRUNO, CAIO] } })
    const usuario = userEvent.setup()
    tela('professor')
    await screen.findByText('3 pedidos esperando a decisão')

    // Sem marca: o texto de como decidir, e nenhuma decisão, nem "todos".
    expect(screen.getByText(TEXTO_DE_COMO_DECIDIR)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Aprovar/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Recusar/ })).toBeNull()

    await usuario.click(screen.getByRole('checkbox', { name: /Ana/ }))
    expect(screen.getByRole('button', { name: 'Aprovar 1 pedido' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recusar 1 pedido' })).toBeTruthy()
    expect(screen.queryByText(TEXTO_DE_COMO_DECIDIR)).toBeNull()

    await usuario.click(screen.getByRole('checkbox', { name: /Bruno/ }))
    expect(screen.getByRole('button', { name: 'Aprovar 2 pedidos' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recusar 2 pedidos' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /todos/i })).toBeNull()

    expect(cartaoDe('Bruno')).toContain(TEXTO_DA_MATRICULA_ERRADA)
    expect(cartaoDe('Ana')).not.toContain(TEXTO_DA_MATRICULA_ERRADA)
    expect(cartaoDe('Caio')).not.toContain(TEXTO_DA_MATRICULA_ERRADA)
  })

  it('lista lida e vazia: mostra o vazio que a tela deu, com o próximo passo, e nenhuma decisão', async () => {
    const rede = redeFalsa()
    rede.responder({ status: 200, corpo: { itens: [] } })
    const usuario = userEvent.setup()
    const aoAcionar = vi.fn()
    tela('professor', { ...VAZIO, acao: { rotulo: 'Mostrar o link da sala', aoAcionar } })

    expect(await screen.findByText(VAZIO.titulo)).toBeTruthy()
    expect(screen.getByText(VAZIO.descricao)).toBeTruthy()
    expect(screen.queryByText(/esperando a decisão/)).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()

    await usuario.click(screen.getByRole('button', { name: 'Mostrar o link da sala' }))
    expect(aoAcionar).toHaveBeenCalledTimes(1)
  })

  it('leitura que falha antes de haver lista mostra o erro e o "Tentar de novo", e não afirma que não há pedidos; o novo clique lê e mostra a lista', async () => {
    const rede = redeFalsa()
    // Limite excedido não é repetido sozinho (`deveTentarDeNovo`): o erro chega na hora, sem esperar a nova tentativa.
    rede.responder({ status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
    const usuario = userEvent.setup()
    tela('professor')

    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(screen.queryByText(VAZIO.titulo)).toBeNull()
    expect(screen.queryByText(TEXTO_ANTES_DA_LEITURA)).toBeNull()

    rede.responder({ status: 200, corpo: { itens: [CAIO] } })
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByText('1 pedido esperando a decisão')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(rede.chamadas).toHaveLength(2)
  })
})
