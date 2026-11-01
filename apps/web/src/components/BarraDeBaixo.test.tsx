// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { NAVIGATION, type NavItem } from '../areas/navigation'
import { ROUTES } from '../paths'
import { classesOf } from '../__fixtures__/class-colors'
import { BarraDeBaixo, MAXIMO_NA_BARRA, ondeFicamOsItens } from './BarraDeBaixo'

/**
 * A barra de baixo do celular (`docs/interface.md` 11.1; D80; RF14): onde os itens ficam, o que ela desenha e a reserva
 * que ela faz na página. O `jsdom` não tem `matchMedia`, e por isso a barra se testa sozinha, sem a casca. Aqui está o que a
 * peça declara (as classes, os atributos, a decisão de onde ficam os itens); o que o navegador mede (os 68 px, a pílula
 * de 48 × 36, o alvo de 44 px) e a reserva do `<main>`, da barra presa e do foco são de `e2e/casca-no-celular.spec.ts`.
 */
afterEach(cleanup)

function noEndereco(caminho: string, filho: React.ReactNode): React.ReactElement {
  return <Router hook={memoryLocation({ path: caminho }).hook}>{filho}</Router>
}

/** O elemento que o teste espera achar: sem ele, o caso é vermelho com o nome do que faltou, e não com um `null`. */
function existente(elemento: Element | null | undefined, o: string): Element {
  if (elemento === null || elemento === undefined) throw new Error(`não achei ${o}`)
  return elemento
}

/** Itens só com o que a regra olha: a quantidade. O ícone é qualquer um dos reais. */
function itensEmQuantidade(quantidade: number): readonly NavItem[] {
  const modelo = NAVIGATION.professor[0]
  if (modelo === undefined) throw new Error('o professor não tem item')
  return Array.from({ length: quantidade }, (_, indice) => ({ ...modelo, rotulo: `Item ${String(indice)}`, caminho: `/professor/item-${String(indice)}` }))
}

describe('ondeFicamOsItens', () => {
  it('quatro itens ficam na barra, e cinco na gaveta', () => {
    expect(MAXIMO_NA_BARRA).toBe(4)
    expect(ondeFicamOsItens(itensEmQuantidade(4))).toBe('barra')
    expect(ondeFicamOsItens(itensEmQuantidade(5))).toBe('gaveta')
    expect(ondeFicamOsItens(itensEmQuantidade(7))).toBe('gaveta')
  })

  it('um item fica na barra, e nenhum fica na gaveta: uma barra vazia seria uma faixa de 68 px sem nada', () => {
    expect(ondeFicamOsItens(itensEmQuantidade(1))).toBe('barra')
    expect(ondeFicamOsItens([])).toBe('gaveta')
  })

  it('professor, aluno e, desde a X2, a coordenação (quatro lugares) têm os itens na barra', () => {
    expect(ondeFicamOsItens(NAVIGATION.professor)).toBe('barra')
    expect(ondeFicamOsItens(NAVIGATION.aluno)).toBe('barra')
    expect(NAVIGATION.coordenador).toHaveLength(MAXIMO_NA_BARRA)
    expect(ondeFicamOsItens(NAVIGATION.coordenador)).toBe('barra')
  })
})

describe('BarraDeBaixo', () => {
  it('é a navegação "Seções", com um link por item, na ordem, e o rótulo por nome', () => {
    render(noEndereco(ROUTES.turmas, <BarraDeBaixo itens={NAVIGATION.professor} />))
    const secoes = screen.getByRole('navigation', { name: 'Seções' })
    const links = within(secoes).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(NAVIGATION.professor.map((item) => item.rotulo))
    expect(links.map((link) => link.getAttribute('href'))).toEqual(NAVIGATION.professor.map((item) => item.caminho))
    // O ícone é decoração: o nome do link é só o rótulo (9.4, "ícone sempre com rótulo").
    for (const item of NAVIGATION.professor) expect(within(secoes).getByRole('link', { name: item.rotulo })).toBeTruthy()
    expect(secoes.querySelectorAll('[role="img"]')).toHaveLength(0)
  })

  it('só o item da tela aberta tem o aria-current, e a pílula e o texto dele acendem', () => {
    render(noEndereco(ROUTES.turmas, <BarraDeBaixo itens={NAVIGATION.professor} />))
    const secoes = screen.getByRole('navigation', { name: 'Seções' })
    const atual = within(secoes).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')
    expect(atual.map((link) => link.textContent)).toEqual(['Turmas'])

    const pilula = (rotulo: string): Element => existente(within(secoes).getByRole('link', { name: rotulo }).querySelector('[data-pilula]'), `a pílula de ${rotulo}`)
    const texto = (rotulo: string): Element => existente(within(secoes).getByRole('link', { name: rotulo }).lastElementChild, `o texto de ${rotulo}`)
    // Aceso: borda `azul-borda`, fundo `azul-claro` e texto `azul-texto`. Apagado: a borda existe e é transparente, para
    // acender não deslocar nada, e o texto é `sutil`.
    for (const classe of ['border-2', 'border-azul-borda', 'bg-azul-claro']) expect(classesOf(pilula('Turmas')).has(classe), `aceso: ${classe}`).toBe(true)
    expect(classesOf(texto('Turmas')).has('text-azul-texto')).toBe(true)
    for (const apagado of ['Início', 'Ferramentas', 'Criados']) {
      expect(classesOf(pilula(apagado)).has('border-2'), `${apagado}: a borda de 2 px existe`).toBe(true)
      expect(classesOf(pilula(apagado)).has('border-transparent'), apagado).toBe(true)
      expect(classesOf(pilula(apagado)).has('bg-azul-claro'), apagado).toBe(false)
      expect(classesOf(pilula(apagado)).has('border-azul-borda'), apagado).toBe(false)
      expect(classesOf(texto(apagado)).has('text-sutil'), apagado).toBe(true)
      expect(classesOf(texto(apagado)).has('text-azul-texto'), apagado).toBe(false)
    }
  })

  it('a conversa aberta acende "Início", como na lateral (`tambemEm`)', () => {
    render(noEndereco(ROUTES.conversa, <BarraDeBaixo itens={NAVIGATION.professor} />))
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Turmas' }).getAttribute('aria-current')).toBeNull()
  })

  it('o aluno tem os três itens dele, com o ícone ilustrado em Início e Tarefas e o do `lucide` num ladrilho em Eu', () => {
    render(noEndereco(ROUTES.inicioDoAluno, <BarraDeBaixo itens={NAVIGATION.aluno} />))
    const secoes = screen.getByRole('navigation', { name: 'Seções' })
    expect(within(secoes).getAllByRole('link').map((link) => link.textContent)).toEqual(['Início', 'Tarefas', 'Eu'])
    expect(within(secoes).getByRole('link', { name: 'Eu' }).querySelectorAll('[data-ladrilho]')).toHaveLength(1)
    for (const ilustrado of ['Início', 'Tarefas']) {
      expect(within(secoes).getByRole('link', { name: ilustrado }).querySelectorAll('svg[data-icone]'), ilustrado).toHaveLength(1)
      expect(within(secoes).getByRole('link', { name: ilustrado }).querySelectorAll('[data-ladrilho]'), ilustrado).toHaveLength(0)
    }
    expect(within(secoes).getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBe('page')
  })

  it('o Tutor e Privacidade, que não são mais lugares, acendem Início e Eu na barra', () => {
    const { unmount } = render(noEndereco(ROUTES.tutor, <BarraDeBaixo itens={NAVIGATION.aluno} />))
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBe('page')
    unmount()
    render(noEndereco(ROUTES.privacidadeDoAluno, <BarraDeBaixo itens={NAVIGATION.aluno} />))
    expect(screen.getByRole('link', { name: 'Eu' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBeNull()
  })

  it('cada ícone tem 28 px: o ilustrado direto, e o do `lucide` no ladrilho de 32 px', () => {
    render(noEndereco(ROUTES.inicioDoAluno, <BarraDeBaixo itens={NAVIGATION.aluno} />))
    const ilustrado = existente(screen.getByRole('link', { name: 'Tarefas' }).querySelector('svg[data-icone]'), 'o ícone ilustrado de Tarefas')
    expect(ilustrado.getAttribute('width')).toBe('28')
    expect(ilustrado.getAttribute('height')).toBe('28')
    const ladrilho = existente(screen.getByRole('link', { name: 'Eu' }).querySelector('[data-ladrilho]'), 'o ladrilho de Eu')
    expect(classesOf(ladrilho).has('size-8')).toBe(true)
  })

  it('a pílula que segura o ícone é de 48 × 36, com a borda de 2 px nos dois estados', () => {
    render(noEndereco(ROUTES.turmas, <BarraDeBaixo itens={NAVIGATION.professor} />))
    for (const item of NAVIGATION.professor) {
      const pilula = existente(screen.getByRole('link', { name: item.rotulo }).querySelector('[data-pilula]'), `a pílula de ${item.rotulo}`)
      // 48 px de largura (`w-12`) por 36 de altura (`h-9`), com a borda dentro da caixa; o navegador mede o resultado
      // (`e2e/casca-no-celular.spec.ts`), e aqui a medida é a que a peça declara.
      for (const classe of ['h-9', 'w-12', 'shrink-0']) expect(classesOf(pilula).has(classe), `${item.rotulo}: ${classe}`).toBe(true)
    }
  })

  it('o rótulo é de 12 px e corta com reticências, e a barra é fixa no pé com a altura da reserva', () => {
    render(noEndereco(ROUTES.turmas, <BarraDeBaixo itens={NAVIGATION.professor} />))
    const barra = screen.getByRole('navigation', { name: 'Seções' })
    for (const classe of ['fixed', 'bottom-0', 'inset-x-0', 'border-t-2', 'border-borda', 'bg-lateral', 'h-[var(--barra-baixo)]']) expect(classesOf(barra).has(classe), classe).toBe(true)
    const rotulo = existente(screen.getByRole('link', { name: 'Turmas' }).lastElementChild, 'o rótulo de Turmas')
    for (const classe of ['text-xs', 'font-bold', 'uppercase', 'truncate']) expect(classesOf(rotulo).has(classe), classe).toBe(true)
  })

  it('enquanto está na página, marca o <html> com a reserva do lugar dela, e desmarca ao sair', () => {
    expect(document.documentElement.hasAttribute('data-barra-de-baixo')).toBe(false)
    const { unmount } = render(noEndereco(ROUTES.turmas, <BarraDeBaixo itens={NAVIGATION.professor} />))
    expect(document.documentElement.hasAttribute('data-barra-de-baixo')).toBe(true)
    unmount()
    expect(document.documentElement.hasAttribute('data-barra-de-baixo')).toBe(false)
  })
})
