// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { classesDo, tokenDe } from '../../../__fixtures__/class-colors'
import { Conversa, MensagemIA, MensagemPessoa, Pensando } from './Message'

/**
 * A mensagem da conversa na pele da D80 (`docs/interface.md` 9.3 e 11.3): a pessoa em bolha, a IA sem bolha na coluna, e
 * no balão do Seu time a assinatura em cima e o balão logo abaixo. A cor resolvida e a largura do balão são do e2e
 * (`e2e/components-ai.spec.ts`); o que o `jsdom` prova é a estrutura, a ordem e o que a mensagem não faz.
 */
afterEach(cleanup)

const FONTE = readFileSync(join(import.meta.dirname, 'Message.tsx'), 'utf8')

/** `a` vem antes de `b` na ordem do documento, que é a de leitura e a do foco. */
const vemAntes = (a: Element, b: Element): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

describe('MensagemPessoa', () => {
  it('é a bolha da pessoa, à direita, com a borda de 2 px, e as quebras de linha que ela escreveu ficam', () => {
    const { container } = render(<MensagemPessoa>{'monta uma atividade\nde estequiometria'}</MensagemPessoa>)
    const bolha = container.querySelector('p') as HTMLElement
    const classes = classesDo(bolha)
    expect(tokenDe(bolha, 'bg')).toBe('fundo-suave')
    expect(classes.has('border-2')).toBe(true)
    expect(tokenDe(bolha, 'border')).toBe('borda')
    expect(classes.has('rounded-cartao')).toBe(true)
    // Até 85% da coluna, e o texto como foi escrito.
    expect(classes.has('max-w-[85%]')).toBe(true)
    expect(classes.has('whitespace-pre-wrap')).toBe(true)
    // O leitor de tela ouve de quem é a fala; a bolha à direita é só desenho.
    expect(bolha.textContent).toBe('Você: monta uma atividade\nde estequiometria')
    expect(container.querySelector('.sr-only')?.textContent).toBe('Você: ')
    // A bolha é a única face com fundo da conversa: ela se alinha à direita do artigo.
    expect(classesDo(bolha.parentElement as HTMLElement).has('justify-end')).toBe(true)
  })
})

describe('MensagemIA', () => {
  it('na coluna, a IA não tem bolha: sem fundo e sem borda, com a assinatura em cima do texto', () => {
    const { container } = render(<MensagemIA agente="assistente_de_ensino">Aqui está a lista.</MensagemIA>)
    const texto = screen.getByText('Aqui está a lista.')
    expect(classesDo(texto).has('border-2')).toBe(false)
    expect([...classesDo(texto)].filter((classe) => classe.startsWith('bg-') || classe.startsWith('border'))).toEqual([])
    const assinatura = container.querySelector('[data-assinatura]') as HTMLElement
    expect(container.querySelectorAll('[data-assinatura]')).toHaveLength(1)
    expect(vemAntes(assinatura, texto)).toBe(true)
  })

  it('no balão, a assinatura é o cabeçalho e o balão vem logo abaixo, com a borda de 2 px; o avatar é um só, o da assinatura', () => {
    const { container } = render(
      <MensagemIA variante="balao" funcao="correcao_de_objetiva">
        Corrigi as 32 atividades.
      </MensagemIA>,
    )
    const balao = screen.getByText('Corrigi as 32 atividades.')
    const assinatura = container.querySelector('[data-assinatura]') as HTMLElement
    expect(vemAntes(assinatura, balao)).toBe(true)
    // A assinatura não está dentro do balão: é o cabeçalho, e o balão só leva a fala.
    expect(balao.contains(assinatura)).toBe(false)
    expect(classesDo(balao).has('border-2')).toBe(true)
    expect(tokenDe(balao, 'border')).toBe('borda')
    expect(classesDo(balao).has('rounded-cartao')).toBe(true)
    // Avatar, nome e selo no mesmo bloco, e nenhum avatar ao lado do balão (RF10).
    expect(container.querySelectorAll('[data-agente]')).toHaveLength(1)
    expect(assinatura.querySelectorAll('[data-agente]')).toHaveLength(1)
    expect(assinatura.querySelectorAll('[data-selo-ia]')).toHaveLength(1)
    expect(assinatura.textContent).toContain('Assistente · correção de objetiva')
  })

  it('a aprovação tem lugar fixo, depois do conteúdo e antes das ações, nas duas variantes', () => {
    for (const variante of ['coluna', 'balao'] as const) {
      const { unmount } = render(
        <MensagemIA agente="assistente_de_ensino" variante={variante} aprovacao={{ aprovacao: { estado: 'pendente' } }} acoes={<button type="button">Copiar</button>}>
          O conteúdo.
        </MensagemIA>,
      )
      const conteudo = screen.getByText('O conteúdo.')
      const aprovacao = screen.getByText('Esperando você').closest('[data-aprovacao]') as HTMLElement
      const acao = screen.getByRole('button', { name: 'Copiar' })
      expect(vemAntes(conteudo, aprovacao), variante).toBe(true)
      expect(vemAntes(aprovacao, acao), variante).toBe(true)
      unmount()
    }
  })

  it('a mensagem não importa o avatar: ele chega só pela assinatura, e o desenho do balão não o põe ao lado', () => {
    expect(FONTE).not.toMatch(/from '\.\/AvatarAgente'/)
    expect(FONTE).not.toMatch(/from '\.\.\/onca/)
  })
})

describe('Pensando', () => {
  it('é a assinatura e um texto parado: nenhuma classe de animação ou de laço, e a demora só troca o texto', () => {
    const { container, rerender } = render(<Pensando agente="tutor" />)
    const raiz = container.querySelector('[data-pensando]') as HTMLElement
    const texto = screen.getByText('Preparando a resposta…')
    expect(texto.getAttribute('aria-live')).toBe('polite')
    // Sem três pontos, sem brilho, sem pulso: o elemento e tudo dentro dele sem classe de animação nem de transição.
    for (const no of [raiz, ...raiz.querySelectorAll('*')]) {
      const movimento = [...classesDo(no)].filter((classe) => /(^|:)(animate-|transition|duration-|motion-)/.test(classe))
      expect(movimento, no.tagName).toEqual([])
    }
    expect(raiz.querySelectorAll('[data-assinatura]')).toHaveLength(1)

    rerender(<Pensando agente="tutor" demorando />)
    expect(screen.getByText('Ainda preparando a resposta. Você não precisa pedir de novo.').getAttribute('aria-live')).toBe('polite')
    expect(screen.queryByText('Preparando a resposta…')).toBeNull()
  })
})

describe('Conversa', () => {
  it('é um registro que anuncia só o que entra, e `ocupada` liga o `aria-busy` enquanto a resposta chega', () => {
    const { rerender } = render(<Conversa rotulo="Conversa com o Tutor">{null}</Conversa>)
    const registro = screen.getByRole('log', { name: 'Conversa com o Tutor' })
    expect(registro.getAttribute('aria-relevant')).toBe('additions')
    expect(registro.getAttribute('aria-busy')).toBe('false')
    rerender(
      <Conversa rotulo="Conversa com o Tutor" ocupada>
        {null}
      </Conversa>,
    )
    expect(screen.getByRole('log').getAttribute('aria-busy')).toBe('true')
  })
})
