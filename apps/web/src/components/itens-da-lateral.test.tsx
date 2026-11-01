// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { MENU_DA_PESSOA, NAVEGACAO, RODAPE_DA_LATERAL } from '../areas/navigation'
import { classesDo, contraste, corDoToken, TEMAS } from '../__fixtures__/class-colors'
import { ItemDaLateral, ListaDeItens } from './itens-da-lateral'

/**
 * O lugar da lateral (`docs/interface.md` 11.1; D80, 12.0): o ícone de cada item, o aceso e o apagado e o trilho.
 * A cor que o navegador calcula, a medida de 52 px e a dica que aparece são do e2e (`e2e/casca.spec.ts`, `e2e/areas.spec.ts`);
 * aqui está o que o `jsdom` sabe: o nome acessível, o ícone decorativo, a família e as classes que carregam a regra.
 */
afterEach(cleanup)

const PAPEIS = ['professor', 'aluno', 'coordenador'] as const

function noEndereco(caminho: string, filho: React.ReactNode): React.ReactElement {
  return <Router hook={memoryLocation({ path: caminho }).hook}>{filho}</Router>
}

describe('ItemDaLateral', () => {
  it.each(PAPEIS)('todo item de %s tem o ícone decorativo e o rótulo por nome, aberto e no trilho', (papel) => {
    const itens = [...NAVEGACAO[papel], ...RODAPE_DA_LATERAL[papel], ...MENU_DA_PESSOA[papel]]
    for (const trilho of [false, true]) {
      const { unmount } = render(
        noEndereco(
          '/',
          <ul>
            {itens.map((item) => (
              <ItemDaLateral key={item.caminho} item={item} trilho={trilho} />
            ))}
          </ul>,
        ),
      )
      for (const item of itens) {
        const link = screen.getByRole('link', { name: item.rotulo })
        // Um ícone só, que o leitor de tela não lê: o nome é o rótulo, e dizê-lo duas vezes seria ruído.
        const icones = link.querySelectorAll('[data-icone], [data-ladrilho]')
        expect(icones, `${item.rotulo} (trilho: ${String(trilho)})`).toHaveLength(1)
        const [icone] = icones
        const decorativo = icone?.getAttribute('aria-hidden') === 'true' || icone?.closest('[aria-hidden="true"]') !== null
        expect(decorativo, `${item.rotulo}: o ícone é decoração`).toBe(true)
        expect(within(link).queryByRole('img')).toBeNull()
      }
      unmount()
    }
  })

  it('o ícone ilustrado é de Início, Ferramentas, Turmas, Tarefas e dos quatro lugares da coordenação, e o `lucide` num ladrilho é dos outros', () => {
    const ilustrados = new Map<string, string>()
    const ladrilhos = new Map<string, string>()
    const porPapel = new Map<string, string>()
    for (const papel of PAPEIS) {
      for (const item of [...NAVEGACAO[papel], ...RODAPE_DA_LATERAL[papel], ...MENU_DA_PESSOA[papel]]) {
        if ('lugar' in item.icone) ilustrados.set(item.rotulo, item.icone.lugar)
        else {
          ladrilhos.set(item.rotulo, item.icone.familia)
          porPapel.set(`${papel}: ${item.rotulo}`, item.icone.familia)
        }
      }
    }
    expect([...ilustrados]).toEqual([
      ['Início', 'inicio'],
      ['Turmas', 'turmas'],
      ['Ferramentas', 'ferramentas'],
      ['Criados', 'criados'],
      ['Tarefas', 'tarefas'],
      ['Painel', 'painel'],
      ['Analista', 'ia'],
      ['Escola', 'escola'],
      ['Registros', 'registros'],
    ])
    // A família de cada um (a divergência de `12_task.md`): por função, nunca a cor do estado (`ok`, `erro`, `pendente`).
    expect(Object.fromEntries([...porPapel].sort(([a], [b]) => a.localeCompare(b)))).toEqual({
      'aluno: Eu': 'turquesa',
      'coordenador: Rever a introdução': 'lima',
      'professor: Meus dados': 'verde',
      'professor: Rever a introdução': 'lima',
    })
    // Cada um dos outros tem a família dele, e a do ladrilho chega ao DOM.
    expect([...ladrilhos.keys()].sort()).toEqual(['Eu', 'Meus dados', 'Rever a introdução'].sort())
    const eu = NAVEGACAO.aluno.find((item) => item.rotulo === 'Eu')
    if (eu === undefined) throw new Error('faltou o Eu')
    render(noEndereco('/', <ul><ItemDaLateral item={eu} trilho={false} /></ul>))
    expect(screen.getByRole('link', { name: 'Eu' }).querySelector('[data-ladrilho]')?.getAttribute('data-ladrilho')).toBe('turquesa')
    // E o ilustrado chega ao DOM pelo mesmo caminho, sem ladrilho: o ramo do `lugar` é o que desenha o `Icon`.
    cleanup()
    const inicio = NAVEGACAO.professor.find((item) => item.rotulo === 'Início')
    if (inicio === undefined) throw new Error('faltou o Início')
    render(noEndereco('/', <ul><ItemDaLateral item={inicio} trilho={false} /></ul>))
    const link = screen.getByRole('link', { name: 'Início' })
    expect(link.querySelector('svg[data-icone="inicio"]')).not.toBeNull()
    expect(link.querySelector('[data-ladrilho]')).toBeNull()
  })

  it('aceso: `aria-current`, fundo `azul-claro`, borda `azul-borda` e texto `azul-texto`; apagado: nenhuma das três, e a borda transparente', () => {
    const inicio = NAVEGACAO.professor.find((item) => item.rotulo === 'Início')
    const ferramentas = NAVEGACAO.professor.find((item) => item.rotulo === 'Ferramentas')
    if (inicio === undefined || ferramentas === undefined) throw new Error('faltou item')
    render(
      noEndereco(
        '/professor/nova-conversa',
        <ul>
          <ItemDaLateral item={inicio} trilho={false} />
          <ItemDaLateral item={ferramentas} trilho={false} />
        </ul>,
      ),
    )
    const aceso = screen.getByRole('link', { name: 'Início' })
    const apagado = screen.getByRole('link', { name: 'Ferramentas' })
    expect(aceso.getAttribute('aria-current')).toBe('page')
    expect(apagado.getAttribute('aria-current')).toBeNull()
    expect([...classesDo(aceso)].filter((classe) => ['bg-azul-claro', 'border-azul-borda', 'text-azul-texto', 'border-2'].includes(classe)).sort()).toEqual(['bg-azul-claro', 'border-2', 'border-azul-borda', 'text-azul-texto'])
    // A negativa (A24): o apagado não tem nenhuma das pistas, e guarda a borda de 2 px, transparente, para acender não mexer em nada.
    const doApagado = classesDo(apagado)
    for (const classe of ['bg-azul-claro', 'border-azul-borda', 'text-azul-texto']) expect(doApagado.has(classe), classe).toBe(false)
    expect(doApagado.has('border-2')).toBe(true)
    expect(doApagado.has('border-transparent')).toBe(true)
    expect(doApagado.has('text-sutil')).toBe(true)
    // O peso não é pista: os dois são `t-rotulo` (700), e o filete de antes saiu.
    expect(classesDo(aceso).has('t-rotulo')).toBe(true)
    expect(doApagado.has('t-rotulo')).toBe(true)
    expect(document.querySelector('[data-filete]')).toBeNull()
  })

  it.each(TEMAS)('o texto do aceso e o do apagado têm 4,5:1 sobre o chão deles no tema %s', (tema) => {
    expect(contraste(corDoToken(tema, 'azul-texto'), corDoToken(tema, 'azul-claro'))).toBeGreaterThanOrEqual(4.5)
    expect(contraste(corDoToken(tema, 'sutil'), corDoToken(tema, 'lateral'))).toBeGreaterThanOrEqual(4.5)
    expect(contraste(corDoToken(tema, 'tinta'), corDoToken(tema, 'fundo-suave'))).toBeGreaterThanOrEqual(4.5)
    // A borda do aceso contra o chão da lateral é o que a distingue sem a cor do fundo: precisa existir no tema.
    expect(corDoToken(tema, 'azul-borda')).not.toBe(corDoToken(tema, 'lateral'))
  })

  it('de 768 a 1023 px o item é um quadrado de 52 px com o rótulo só para o leitor de tela, e aberto tem 52 px de altura', () => {
    const turmas = NAVEGACAO.professor.find((item) => item.rotulo === 'Turmas')
    if (turmas === undefined) throw new Error('faltou Turmas')
    const { unmount } = render(noEndereco('/', <ul><ItemDaLateral item={turmas} trilho /></ul>))
    const noTrilho = screen.getByRole('link', { name: 'Turmas' })
    expect(classesDo(noTrilho).has('size-13')).toBe(true)
    // O texto visível não existe: só o do leitor de tela e o da dica, que é decoração.
    expect(noTrilho.querySelector('.sr-only')?.textContent).toBe('Turmas')
    expect(noTrilho.querySelector('[aria-hidden="true"].shadow-flutua')?.textContent).toBe('Turmas')
    unmount()
    render(noEndereco('/', <ul><ItemDaLateral item={turmas} trilho={false} /></ul>))
    const aberto = screen.getByRole('link', { name: 'Turmas' })
    expect(classesDo(aberto).has('min-h-13')).toBe(true)
    expect(aberto.querySelector('.sr-only')).toBeNull()
  })
})

describe('ListaDeItens', () => {
  it('sem item não desenha nem a região', () => {
    const { container } = render(noEndereco('/', <ListaDeItens itens={[]} rotulo="Rodapé" trilho={false} />))
    expect(container.innerHTML).toBe('')
  })
})
