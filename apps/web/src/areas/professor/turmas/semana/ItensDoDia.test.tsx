// @vitest-environment jsdom
import { ROTULOS_DA_SEMANA, type ItemDoDia } from '@educa/shared'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { ItensDoDia } from './ItensDoDia'

/**
 * Os itens do dia (F2b, 8.0; RF7, T6): o rótulo vem da tabela de `packages/shared`, cada item é um link com nome acessível e o endereço do
 * lugar dele, e nenhuma palavra de nota nem nome de aluno chega à tela (regra 70, item 7).
 */

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const item = (extra: Partial<ItemDoDia>): ItemDoDia => ({ tipo: 'aplicada', turmaId: id(2), disciplinaId: id(3), atividadeAplicadaId: id(40), titulo: 'Atividade de estequiometria', ...extra })

function montar(itens: readonly ItemDoDia[]) {
  const localizacao = memoryLocation({ path: '/turmas', static: false })
  render(
    <Router hook={localizacao.hook}>
      <ItensDoDia itens={itens} />
    </Router>,
  )
}

afterEach(cleanup)

describe('ItensDoDia', () => {
  it('cada tipo e cada estado de correção mostram o rótulo da tabela de `packages/shared`, e o título da atividade', () => {
    const itens = [
      item({ tipo: 'aplicada', atividadeAplicadaId: id(41), titulo: 'Aplicada de frações' }),
      item({ tipo: 'encerrada', atividadeAplicadaId: id(42), titulo: 'Encerrada de frações' }),
      item({ tipo: 'correcao', estado: 'pendente', atividadeAplicadaId: id(43), titulo: 'Correção pendente' }),
      item({ tipo: 'correcao', estado: 'aprovada', atividadeAplicadaId: id(44), titulo: 'Correção aprovada' }),
      item({ tipo: 'correcao', estado: 'rejeitada', atividadeAplicadaId: id(45), titulo: 'Correção rejeitada' }),
    ]
    montar(itens)
    const lista = screen.getByRole('list', { name: 'O que aconteceu neste dia' })
    const textos = within(lista)
      .getAllByRole('listitem')
      // O selo "IA" da correção tem caso próprio: aqui se lê só o rótulo e o título.
      .map((linha) => (linha.textContent ?? '').replace(linha.querySelector('[data-selo-ia]')?.textContent ?? '', ''))
    expect(textos).toEqual([
      `${ROTULOS_DA_SEMANA.item.aplicada}Aplicada de frações`,
      `${ROTULOS_DA_SEMANA.item.encerrada}Encerrada de frações`,
      `${ROTULOS_DA_SEMANA.item.correcao} · ${ROTULOS_DA_SEMANA.estado.pendente}Correção pendente`,
      `${ROTULOS_DA_SEMANA.item.correcao} · ${ROTULOS_DA_SEMANA.estado.aprovada}Correção aprovada`,
      `${ROTULOS_DA_SEMANA.item.correcao} · ${ROTULOS_DA_SEMANA.estado.rejeitada}Correção rejeitada`,
    ])
  })

  it('só a correção do Assistente leva o selo "IA"; a atividade aplicada e a encerrada, não', () => {
    montar([item({ tipo: 'aplicada', atividadeAplicadaId: id(41) }), item({ tipo: 'encerrada', atividadeAplicadaId: id(42) }), item({ tipo: 'correcao', estado: 'pendente', atividadeAplicadaId: id(43) })])
    const linhas = within(screen.getByRole('list', { name: 'O que aconteceu neste dia' })).getAllByRole('listitem')
    expect(linhas.map((linha) => linha.querySelectorAll('[data-selo-ia]').length)).toEqual([0, 0, 1])
  })

  it('cada item é um link com o nome "tipo · estado: título", e a correção diz também que é gerada por IA; o endereço é o do painel da atividade ou o da revisão', () => {
    montar([item({ tipo: 'encerrada', titulo: 'Atividade de estequiometria' }), item({ tipo: 'correcao', estado: 'pendente', atividadeAplicadaId: id(43), titulo: 'Atividade de estequiometria' })])
    const encerrada = screen.getByRole('link', { name: `${ROTULOS_DA_SEMANA.item.encerrada}: Atividade de estequiometria` })
    expect(encerrada.getAttribute('href')).toBe(`/turmas/${id(2)}?aba=atividades&atividade=${id(40)}`)
    const correcao = screen.getByRole('link', { name: `${ROTULOS_DA_SEMANA.item.correcao} · ${ROTULOS_DA_SEMANA.estado.pendente}, gerado por inteligência artificial: Atividade de estequiometria` })
    expect(correcao.getAttribute('href')).toBe(`/aprovar/${id(43)}`)
  })

  it('guarda de regressão da regra 70, item 7: o texto dos itens (o rótulo da tabela e o título) não diz nota, conceito, pontuação, média nem acerto', () => {
    montar([item({ tipo: 'correcao', estado: 'aprovada', titulo: 'Atividade de estequiometria' }), item({ tipo: 'aplicada', atividadeAplicadaId: id(41) })])
    const texto = screen.getByRole('list', { name: 'O que aconteceu neste dia' }).textContent ?? ''
    expect(texto).not.toMatch(/\bnotas?\b|\bconceitos?\b|pontuaç|média|acert|\d+ de \d+|%/i)
  })
})
