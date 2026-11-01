// @vitest-environment jsdom
import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Inbox } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PECAS_FORA_DA_ENTRADA } from '../../../chunk-names'
import { classesOf } from '../../__fixtures__/class-colors'
import { ApiError } from '../../api/client'
import { LoadingState, ErrorState, EmptyState } from '.'

/**
 * Os três estados de tela (`docs/interface.md` 10.2; Tech Spec da X1, seções 7c e 9): carregando parado, vazio com a
 * ação, erro que diz o que fazer. A cor de cada um é do e2e da galeria (`e2e/components-states.spec.ts`); aqui está o que o
 * `jsdom` sabe, e a regra de que eles moram na entrada.
 */
afterEach(cleanup)

const ERRO = new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)

describe('EstadoErro', () => {
  it('o `alert` é só a mensagem do catálogo; o botão e o "tentando" ficam fora dele', async () => {
    const usuario = userEvent.setup()
    const aoTentarDeNovo = vi.fn()
    const { container } = render(<ErrorState erro={ERRO} aoTentarDeNovo={aoTentarDeNovo} />)
    const alerta = screen.getByRole('alert')
    expect(alerta.textContent).toBe(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    // O código e o status HTTP nunca aparecem.
    expect(container.textContent).not.toMatch(/INDISPONIVEL|503|ApiError/)
    const botao = screen.getByRole('button', { name: 'Tentar de novo' })
    expect(alerta.contains(botao)).toBe(false)
    expect(within(alerta).queryByRole('button')).toBeNull()

    await usuario.click(botao)
    expect(aoTentarDeNovo).toHaveBeenCalledTimes(1)
  })

  it('"Tentando de novo…" é `status`, e vazio quando não há nova tentativa', () => {
    const { rerender } = render(<ErrorState erro={ERRO} aoTentarDeNovo={() => undefined} />)
    expect(screen.getByRole('status').textContent).toBe('')
    rerender(<ErrorState erro={ERRO} aoTentarDeNovo={() => undefined} tentando />)
    expect(screen.getByRole('status').textContent).toBe('Tentando de novo…')
    // O `status` é irmão do alerta, e não o seu conteúdo.
    expect(screen.getByRole('alert').contains(screen.getByRole('status'))).toBe(false)
  })

  it('um erro que não é da API cai na mensagem de erro interno do catálogo, sem texto cru', () => {
    render(<ErrorState erro={new Error('boom: stack e código cru')} aoTentarDeNovo={() => undefined} />)
    expect(screen.getByRole('alert').textContent).toBe(MENSAGENS_DE_ERRO.ERRO_INTERNO)
    expect(document.body.textContent).not.toContain('boom')
  })

  it('a caixa é de 2 px, nas famílias `erro` de hoje', () => {
    const { container } = render(<ErrorState erro={ERRO} aoTentarDeNovo={() => undefined} />)
    const classes = classesOf(container.firstElementChild as Element)
    for (const classe of ['border-2', 'border-erro', 'bg-erro-cx', 'rounded-cartao']) expect(classes.has(classe), classe).toBe(true)
    expect(classes.has('border')).toBe(false)
  })
})

describe('EstadoCarregando', () => {
  it('é texto em `status`, parado: nenhum nó animado e nenhum glifo', () => {
    const { container } = render(<LoadingState rotulo="Carregando as atividades…" />)
    const estado = screen.getByRole('status')
    expect(estado.textContent).toBe('Carregando as atividades…')
    expect(container.querySelectorAll('*')).toHaveLength(1)
    expect(container.querySelector('svg')).toBeNull()
    for (const no of container.querySelectorAll('*')) {
      expect([...classesOf(no)].filter((classe) => /^(animate|transition|duration|motion)/.test(classe)), no.tagName).toEqual([])
    }
  })

  it('a caixa é de 2 px em `borda`', () => {
    const { container } = render(<LoadingState rotulo="Carregando…" />)
    const classes = classesOf(container.firstElementChild as Element)
    for (const classe of ['border-2', 'border-borda', 'rounded-cartao']) expect(classes.has(classe), classe).toBe(true)
  })
})

describe('EstadoVazio', () => {
  it('diz o que vai aparecer, e a ação aciona uma vez', async () => {
    const usuario = userEvent.setup()
    const aoAcionar = vi.fn()
    render(<EmptyState titulo="Nenhum material enviado" descricao="Envie o PDF da apostila." acao={{ rotulo: 'Verificar de novo', aoAcionar }} />)
    expect(screen.getByText('Nenhum material enviado')).toBeTruthy()
    expect(screen.getByText('Envie o PDF da apostila.')).toBeTruthy()
    await usuario.click(screen.getByRole('button', { name: 'Verificar de novo' }))
    expect(aoAcionar).toHaveBeenCalledTimes(1)
  })

  it('"Verificando…" é `status`, e só aparece com a ação em andamento', () => {
    const { rerender } = render(<EmptyState titulo="Vazio" descricao="Nada aqui." acao={{ rotulo: 'Verificar de novo', aoAcionar: () => undefined }} />)
    expect(screen.getByRole('status').textContent).toBe('')
    rerender(<EmptyState titulo="Vazio" descricao="Nada aqui." acao={{ rotulo: 'Verificar de novo', aoAcionar: () => undefined, emAndamento: true }} />)
    expect(screen.getByRole('status').textContent).toBe('Verificando…')
  })

  it('o espaço entre o botão e o "Verificando…" só existe quando há o que ler: a região vazia não desloca o botão', () => {
    const { rerender } = render(<EmptyState titulo="Vazio" descricao="Nada aqui." acao={{ rotulo: 'Verificar de novo', aoAcionar: () => undefined }} />)
    const linha = (): Element => screen.getByRole('status').parentElement as Element
    expect(classesOf(linha()).has('gap-3')).toBe(false)
    rerender(<EmptyState titulo="Vazio" descricao="Nada aqui." acao={{ rotulo: 'Verificar de novo', aoAcionar: () => undefined, emAndamento: true }} />)
    expect(classesOf(linha()).has('gap-3')).toBe(true)
  })

  it('com a ação desligada o botão não aciona: o pedido que ele fez ainda está no ar', async () => {
    const usuario = userEvent.setup()
    const aoAcionar = vi.fn()
    const { rerender } = render(<EmptyState titulo="Vazio" descricao="Nada aqui." acao={{ rotulo: 'Gerar resumo', aoAcionar }} />)
    expect((screen.getByRole('button', { name: 'Gerar resumo' }) as HTMLButtonElement).disabled).toBe(false)
    rerender(<EmptyState titulo="Vazio" descricao="Nada aqui." acao={{ rotulo: 'Gerando o resumo…', aoAcionar, desligada: true }} />)
    const botao = screen.getByRole('button', { name: 'Gerando o resumo…' }) as HTMLButtonElement
    expect(botao.disabled).toBe(true)
    await usuario.click(botao)
    expect(aoAcionar).not.toHaveBeenCalled()
  })

  it('sem ação não tem botão nem `status`; o título é `t-secao`', () => {
    render(<EmptyState titulo="Nenhuma atividade ainda" descricao="Aplique uma atividade à turma." />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(classesOf(screen.getByText('Nenhuma atividade ainda')).has('t-secao')).toBe(true)
  })

  it('a ilustração, quando a tela a passa, vem antes do título, e no tracejado ela toma o lugar do ícone; sem ela, nada muda', () => {
    const { container, rerender } = render(<EmptyState titulo="Vazio" descricao="Nada." />)
    expect(container.querySelector('[data-ilustracao-de-teste]')).toBeNull()
    const desenho = <svg data-ilustracao-de-teste="" />
    rerender(<EmptyState titulo="Vazio" descricao="Nada." ilustracao={desenho} />)
    const ilustracao = container.querySelector('[data-ilustracao-de-teste]') as Element
    const titulo = screen.getByText('Vazio')
    expect(ilustracao.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // A peça não alinha a ilustração no padrão: o texto fica à esquerda e a ilustração segue o fluxo. Quem quer o vazio centralizado
    // (a onça de Criados) usa o tracejado, e o alinhamento na tela é medido em `e2e/professor-criados.spec.ts`. O ícone cede o lugar à ilustração.
    expect(classesOf(ilustracao.parentElement as Element).has('justify-center')).toBe(false)
    rerender(<EmptyState variante="tracejado" titulo="Vazio" descricao="Nada." icone={Inbox} ilustracao={desenho} />)
    expect(classesOf(container.querySelector('[data-ilustracao-de-teste]')?.parentElement as Element).has('justify-center')).toBe(true)
    expect(container.querySelectorAll('svg')).toHaveLength(1)
  })

  it('o tracejado é de 2 px em `borda-campo`, nas duas variantes, e o ícone só aparece no tracejado', () => {
    const { container, rerender } = render(<EmptyState titulo="Vazio" descricao="Nada." icone={Inbox} />)
    let classes = classesOf(container.firstElementChild as Element)
    for (const classe of ['border-2', 'border-dashed', 'border-borda-campo']) expect(classes.has(classe), classe).toBe(true)
    // O ícone é enfeite do bloco inteiro: na variante padrão ele não é desenhado.
    expect(container.querySelector('svg')).toBeNull()

    rerender(<EmptyState variante="tracejado" titulo="Vazio" descricao="Nada." icone={Inbox} />)
    classes = classesOf(container.firstElementChild as Element)
    for (const classe of ['border-2', 'border-dashed', 'border-borda-campo']) expect(classes.has(classe), classe).toBe(true)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('os três moram na entrada', () => {
  const pasta = dirname(fileURLToPath(import.meta.url))

  /** Cada `import ... from '<caminho>'` do arquivo, com o nome do módulo sem a pasta nem a extensão. */
  function importadosDe(arquivo: string): string[] {
    const fonte = readFileSync(join(pasta, arquivo), 'utf8')
    return [...fonte.matchAll(/from\s+'([^']+)'/g)].map(([, caminho = '']) => caminho)
  }

  it('nenhum importa `Aviso`, `Contador`, `Toque` nem peça de `PECAS_FORA_DA_ENTRADA`', () => {
    const proibidas = new Set<string>([...PECAS_FORA_DA_ENTRADA, 'ui/Alert', 'ui/CountBadge', 'ui/Toggle'])
    for (const arquivo of ['LoadingState.tsx', 'ErrorState.tsx', 'EmptyState.tsx']) {
      for (const caminho of importadosDe(arquivo)) {
        // Só o que é do repositório: `lucide-react` e `@educa/shared` não são peça.
        if (!caminho.startsWith('.')) continue
        // A peça é o caminho a partir de `components/`, como a lista a escreve: `../ui/Alert` de `states/` é `ui/Alert`.
        const nome = posix.normalize(posix.join('states', caminho))
        expect(proibidas.has(nome), `${arquivo} importa ${caminho}`).toBe(false)
      }
    }
  })

  it('a lista fechada tem as três peças novas: elas ficam fora, e quem as usa as baixa com a tela', () => {
    for (const nova of ['ui/Alert', 'ui/CountBadge', 'ui/Toggle']) expect(PECAS_FORA_DA_ENTRADA as readonly string[], nova).toContain(nova)
  })
})
