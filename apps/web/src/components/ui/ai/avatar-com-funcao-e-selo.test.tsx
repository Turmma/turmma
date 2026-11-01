// @vitest-environment jsdom
import type { Agente } from '@educa/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { semIdsDoDesenho } from '../../../__fixtures__/svg-ids'
import { AgentSignature, AIBadge } from './AgentSignature'
import { AgentAvatar } from './AgentAvatar'
import { nomeDaAssinatura } from './signature'
import { Conversation, AIMessage, ThinkingIndicator } from './Message'

/**
 * O avatar da onça só aparece com o nome da função e o selo "IA" (RF10 da X1; `docs/interface.md` 9.7; regra 70, item
 * 4a; Decreto 12.880, art. 11): a assinatura é o bloco, e **todo `[data-agente]` tem, no `[data-assinatura]` mais próximo,
 * exatamente ele, o nome em texto visível e um `[data-selo-ia]`**. Aqui o `jsdom` prova o bloco em cada peça que desenha
 * o avatar; o e2e, nas telas de verdade (`e2e/support/avatar.ts`) e as cores calculadas, na galeria.
 */
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const AGENTES: readonly Agente[] = ['assistente_de_ensino', 'tutor', 'analista_de_desempenho_escolar']
const NOME_DO_AGENTE: Readonly<Record<Agente, string>> = {
  assistente_de_ensino: 'Assistente de ensino',
  tutor: 'Tutor',
  analista_de_desempenho_escolar: 'Analista de desempenho escolar',
}

/**
 * O texto que a pessoa **vê** num nó: o que só o leitor de tela lê (`sr-only`) não conta. A sigla "IA" do selo é vista e
 * `aria-hidden`, e por isso conta: o que ela quer dizer é o texto escondido, que o leitor de tela ouve no lugar dela.
 */
function textoVisivel(no: Element): string {
  const clone = no.cloneNode(true) as Element
  for (const escondido of clone.querySelectorAll('.sr-only')) escondido.remove()
  return (clone.textContent ?? '').trim()
}

/**
 * A prova do RF10 num pedaço da tela: todo avatar está num bloco de assinatura que tem só ele, o nome da função em texto
 * visível (o dele, e não um qualquer) e um selo "IA". Devolve quantos avatares conferiu, para o caso não passar vazio.
 */
function conferirAssinaturas(raiz: ParentNode, esperados: readonly (readonly [Agente, string])[]): number {
  const avatares = [...raiz.querySelectorAll('[data-agente]')]
  const nomes = esperados.map(([, nome]) => nome)
  expect(avatares.length, 'nenhum avatar na peça').toBeGreaterThan(0)
  expect(avatares).toHaveLength(esperados.length)
  avatares.forEach((avatar, indice) => {
    // O avatar é o do agente que assina: a cabeça com o anel de um, ao lado do nome de outro, é o erro que isto pega.
    expect(avatar.getAttribute('data-agente'), `o avatar #${String(indice)} não é do agente do nome`).toBe(esperados[indice]?.[0])
    const bloco = avatar.closest('[data-assinatura]')
    expect(bloco, 'o avatar está fora de uma assinatura').not.toBeNull()
    expect(bloco?.querySelectorAll('[data-agente]'), 'a assinatura tem mais de um avatar').toHaveLength(1)
    expect(bloco?.querySelectorAll('[data-selo-ia]'), 'a assinatura não tem o selo "IA", ou tem dois').toHaveLength(1)
    // O nome está escrito no bloco, em texto que se vê: nenhum outro texto além dele e da sigla.
    const textoDoNome = [...(bloco?.querySelectorAll('p, h2, h3') ?? [])].map((no) => textoVisivel(no))
    expect(textoDoNome, 'o bloco não diz o nome da função').toEqual([nomes[indice]])
    // O nome e o selo, em linha, com um espaço só entre eles.
    expect(textoVisivel(bloco as Element)).toBe(`${nomes[indice] ?? ''} IA`)
  })
  return avatares.length
}

describe('AvatarAgente', () => {
  it('é a cabeça da onça num círculo `fundo`, com o anel de 2 px na cor do agente, escondido da leitura e sem nome', () => {
    const aneis: Record<Agente, string> = { assistente_de_ensino: 'border-azul', tutor: 'border-laranja', analista_de_desempenho_escolar: 'border-anil' }
    for (const agente of AGENTES) {
      const { container, unmount } = render(<AgentAvatar agente={agente} tamanho={32} />)
      const avatar = container.querySelector('[data-agente]') as HTMLElement
      expect(avatar.getAttribute('data-agente')).toBe(agente)
      expect(avatar.getAttribute('aria-hidden')).toBe('true')
      const classes = new Set(avatar.className.split(' '))
      // Redondo, de fundo `fundo`, com borda de 2 px, que não encolhe numa linha apertada, e a cor é a do agente: a dele, e nenhuma das outras duas.
      for (const classe of ['inline-flex', 'shrink-0', 'rounded-full', 'bg-fundo', 'border-2', aneis[agente]]) expect(classes.has(classe), `${agente} ${classe}`).toBe(true)
      for (const [outro, anel] of Object.entries(aneis)) if (outro !== agente) expect(classes.has(anel), `${agente} não é ${outro}`).toBe(false)
      // A onça dentro: um SVG, e nenhuma imagem de pessoa.
      expect(avatar.querySelectorAll('svg')).toHaveLength(1)
      expect(avatar.querySelectorAll('img, image, picture')).toHaveLength(0)
      // Sem nome: nem texto, nem `title`, nem `aria-label`. "Onça" não é nome de agente.
      expect(avatar.textContent).toBe('')
      expect(avatar.hasAttribute('title')).toBe(false)
      expect(avatar.hasAttribute('aria-label')).toBe(false)
      unmount()
    }
  })

  it('o círculo é quadrado de 24, 32, 40 ou 48 px, e o padrão é o da linha da mensagem', () => {
    const caixas = new Map([[24, 'size-6'], [32, 'size-8'], [40, 'size-10'], [48, 'size-12']] as const)
    for (const [tamanho, classe] of caixas) {
      const { container, unmount } = render(<AgentAvatar agente="tutor" tamanho={tamanho} />)
      expect((container.firstElementChild as HTMLElement).className.split(' '), String(tamanho)).toContain(classe)
      unmount()
    }
    const { container } = render(<AgentAvatar agente="tutor" />)
    expect((container.firstElementChild as HTMLElement).className.split(' ')).toContain('size-6')
  })

  it('a cabeça recua do anel e desce 6% do tamanho, como no avatar do mockup: 2,44 · 3,92 · 4,4 · 4,88 px do topo do miolo', () => {
    // A conta: o miolo já descontou o anel de 2 px, e o topo é o recuo do mockup (3 px em 24, 4 px a partir de 32) menos 2, mais 6% do
    // tamanho. Os quatro números abaixo saem dela; quem protege o componente é a classe lida do `span`.
    for (const [tamanho, topo] of [[24, 2.44], [32, 3.92], [40, 4.4], [48, 4.88]] as const) {
      const { container } = render(<AgentAvatar agente="tutor" tamanho={tamanho} />)
      const cabeca = container.querySelector('[data-agente] > span')
      const classeDoTopo = [...(cabeca?.classList ?? [])].filter((classe) => classe.startsWith('top-'))
      expect(classeDoTopo, `${String(tamanho)} px: uma classe de topo só`).toHaveLength(1)
      expect(classeDoTopo[0], `${String(tamanho)} px`).toBe(`top-[${String(topo)}px]`)
      cleanup()
    }
  })

  it('um desenho por agente, igual em qualquer render, sem temporizador e sem estado', () => {
    vi.useFakeTimers()
    for (const agente of AGENTES) {
      const primeiro = render(<AgentAvatar agente={agente} tamanho={48} />)
      const html = primeiro.container.innerHTML
      primeiro.unmount()
      const segundo = render(<AgentAvatar agente={agente} tamanho={48} />)
      expect(semIdsDoDesenho(segundo.container.innerHTML), agente).toBe(semIdsDoDesenho(html))
      segundo.unmount()
    }
    expect(vi.getTimerCount()).toBe(0)
    // Os três agentes diferem só no anel: a cabeça, por dentro, é a mesma.
    const dentro = AGENTES.map((agente) => {
      const { container, unmount } = render(<AgentAvatar agente={agente} />)
      const svg = container.querySelector('svg')?.outerHTML
      unmount()
      return svg === undefined ? svg : semIdsDoDesenho(svg)
    })
    expect(new Set(dentro).size).toBe(1)
  })

  it('só tem as props `agente` e `tamanho`: nenhuma pose, nenhum "pensando", nenhum humor', () => {
    // @ts-expect-error o avatar é um desenho só: nenhuma pose
    render(<AgentAvatar agente="tutor" pose="acenando" />)
    // @ts-expect-error nenhum "pensando": o texto "Preparando a resposta…" é que diz isso, e a onça fica parada
    render(<AgentAvatar agente="tutor" pensando />)
    // @ts-expect-error nenhum humor que mude com quem usa (D57, D58)
    render(<AgentAvatar agente="tutor" humor="feliz" />)
    // @ts-expect-error nenhum ponto de "online" (D59)
    render(<AgentAvatar agente="tutor" online />)
    // @ts-expect-error o tamanho é um dos quatro
    render(<AgentAvatar agente="tutor" tamanho={36} />)
  })
})

describe('função e selo no mesmo bloco, em toda peça que desenha o avatar', () => {
  it('AssinaturaIA: os três agentes e uma função, em cada tamanho', () => {
    let conferidos = 0
    for (const tamanho of [24, 32, 40, 48] as const) {
      for (const agente of AGENTES) {
        const { container, unmount } = render(<AgentSignature agente={agente} tamanho={tamanho} />)
        conferidos += conferirAssinaturas(container, [[agente, NOME_DO_AGENTE[agente]]])
        unmount()
      }
      const { container, unmount } = render(<AgentSignature funcao="correcao_de_objetiva" tamanho={tamanho} />)
      conferidos += conferirAssinaturas(container, [['assistente_de_ensino', 'Assistente · correção de objetiva']])
      unmount()
    }
    expect(conferidos).toBe(16)
  })

  it('MensagemIA, nas duas variantes, com aprovação e com ações', () => {
    const { container } = render(
      <Conversation rotulo="Conversa de teste">
        <AIMessage agente="tutor">Vamos por partes.</AIMessage>
        <AIMessage variante="balao" funcao="sinais_para_o_professor">
          Oito alunos travaram na questão 3.
        </AIMessage>
        <AIMessage agente="assistente_de_ensino" aprovacao={{ aprovacao: { estado: 'pendente' } }} acoes={<button type="button">Copiar</button>}>
          Atividade pronta.
        </AIMessage>
      </Conversation>,
    )
    expect(
      conferirAssinaturas(container, [
        ['tutor', 'Tutor'],
        ['tutor', nomeDaAssinatura({ funcao: 'sinais_para_o_professor' })],
        ['assistente_de_ensino', 'Assistente de ensino'],
      ]),
    ).toBe(3)
    // Sem `tamanho`, o avatar da mensagem é o da linha: 24 px.
    for (const avatar of container.querySelectorAll('[data-agente]')) expect(avatar.className.split(' '), 'o avatar da mensagem tem 24 px').toContain('size-6')
    // No balão o bloco é o cabeçalho: o texto da mensagem fica fora dele, e o avatar não fica solto ao lado do balão.
    const balao = container.querySelectorAll('article')[1] as HTMLElement
    const cabecalho = balao.querySelector('[data-assinatura]') as HTMLElement
    expect(cabecalho.contains(balao.querySelector('[data-agente]'))).toBe(true)
    expect(cabecalho.textContent).not.toContain('Oito alunos')
  })

  it('Pensando: o avatar, o nome e o selo ficam junto do "Preparando a resposta…"', () => {
    const { container } = render(<ThinkingIndicator agente="tutor" />)
    expect(conferirAssinaturas(container, [['tutor', 'Tutor']])).toBe(1)
    expect(screen.getByText('Preparando a resposta…')).toBeTruthy()
  })

  it('o selo "IA" é um só: o texto da sigla está escondido da leitura, e o que ela quer dizer vai em texto', () => {
    const { container } = render(<AIBadge />)
    const selo = container.querySelector('[data-selo-ia]') as HTMLElement
    // O desenho do selo de estado (24 px, canto de 8, `t-selo`), na família neutra `ia`: o selo informa, não chama.
    // `shrink-0` e `px-2`: o selo não é espremido na linha estreita do celular e tem o respiro do selo de estado.
    for (const classe of ['t-selo', 'inline-flex', 'min-h-6', 'shrink-0', 'items-center', 'rounded-selo', 'bg-ia-cx', 'px-2', 'text-ia']) expect(selo.className.split(' '), classe).toContain(classe)
    expect(selo.querySelector('[aria-hidden="true"]')?.textContent).toBe('IA')
    expect(selo.textContent).toBe('IAgerado por inteligência artificial')
    expect(selo.hasAttribute('title')).toBe(false)
  })
})

describe('o nome da função é texto, e é título só quando a tela pede', () => {
  it('sem `titulo`, é um parágrafo; com `titulo={2}`, um `h2`; com `titulo={3}`, um `h3`', () => {
    const sem = render(<AgentSignature agente="tutor" />)
    expect(sem.container.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0)
    const nome = sem.container.querySelector('[data-assinatura] p') as HTMLElement
    expect(nome.textContent).toBe('Tutor')
    // O nome é 15 px em 700, em `tinta`, em linha com o selo e com `break-words`: o nome comprido quebra, e não passa da janela.
    for (const classe of ['inline', 'text-[15px]', 'leading-5', 'font-bold', 'break-words', 'text-tinta']) expect(nome.className.split(' '), classe).toContain(classe)
    // O nome e o selo são um bloco só, que pode encolher (`min-w-0`) na linha do avatar: o selo vai atrás do nome quando ele quebra.
    const bloco = nome.parentElement as HTMLElement
    expect(bloco.className.split(' '), 'o bloco do nome e do selo encolhe').toContain('min-w-0')
    expect(bloco.querySelector('[data-selo-ia]'), 'o selo está no mesmo bloco do nome').not.toBeNull()
    expect(bloco.parentElement?.hasAttribute('data-assinatura')).toBe(true)
    sem.unmount()

    const dois = render(<AgentSignature agente="tutor" titulo={2} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Tutor' })).toBeTruthy()
    // O título é o nome e só o nome: o selo e o avatar ficam ao lado dele, e não dentro.
    expect(dois.container.querySelector('h2')?.textContent).toBe('Tutor')
    expect(dois.container.querySelector('[data-assinatura] p')).toBeNull()
    expect(dois.container.querySelector('h2')?.className.split(' ')).toEqual(expect.arrayContaining(['inline', 'break-words']))
    dois.unmount()

    const tres = render(<AgentSignature agente="analista_de_desempenho_escolar" titulo={3} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Analista de desempenho escolar' })).toBeTruthy()
    expect(tres.container.querySelector('h2')).toBeNull()
  })

  it('nenhum nome acessível da assinatura, da mensagem ou da conversa casa "onça"', () => {
    const { container } = render(
      <Conversation rotulo="Conversa com o Tutor">
        <AIMessage agente="tutor">Vamos por partes.</AIMessage>
        <AgentSignature agente="assistente_de_ensino" titulo={2} />
        <ThinkingIndicator agente="analista_de_desempenho_escolar" />
      </Conversation>,
    )
    expect(container.textContent).not.toMatch(/onça/i)
    for (const no of container.querySelectorAll('[aria-label], [aria-labelledby], [title], [alt]')) {
      for (const atributo of ['aria-label', 'title', 'alt']) expect(no.getAttribute(atributo) ?? '', no.outerHTML).not.toMatch(/onça/i)
    }
    // Nem o leitor de tela acha um "img" com esse nome: o desenho não é imagem para ele.
    expect(screen.queryAllByRole('img')).toHaveLength(0)
    expect(screen.queryByRole('img', { name: /onça/i })).toBeNull()
  })
})
