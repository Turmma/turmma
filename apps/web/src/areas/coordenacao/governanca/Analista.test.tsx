// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupScreen, fakeNetwork, renderScreen, type FakeResponse } from '../../../__fixtures__/render-screen'
import Analista from './Analista'

/**
 * O Analista (telas da coordenação, 4.0; RF8, RF9 e RF22): uma página de leitura, assinada por ele, com o resumo gerado a
 * pedido. A rede é falsa; o ciclo de execução, o cliente de consultas e a tela são os da aba. O pedido e o recomeço pela
 * pessoa seguinte são do e2e (`e2e/analista.spec.ts`).
 */
setupScreen()

/** A largura da janela, para a consulta `(min-width: 768px)` que o miolo lê; o `jsdom` não tem `matchMedia`. */
function janelaDe(largura: number): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta === '(min-width: 768px)' ? largura >= 768 : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

beforeEach(() => janelaDe(1366))

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const SERIE = { id: id(200), etapa: 'ef_anos_finais', ano: 7 }
const MATEMATICA = { id: id(500), nome: 'Matemática' }
const FISICA = { id: id(501), nome: 'Física' }
const HABILIDADE = { codigo: 'EF07MA01', descricao: 'Resolver problemas com números inteiros' }
const FORA = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }

const CONTEUDO = {
  periodo: { inicio: '2026-10-01', fim: '2026-10-16' },
  escola: { atividadesAplicadas: 4, lotesAprovados: 3, lotesEsperando: 1, versoesAdaptadasAprovadas: 2, trocasComOTutor: 12, sinais: { travou: 1, resposta_pronta: 1, duvida_repetida: 0, atencao_humana: 0 } },
  recortes: [{ serie: SERIE, disciplina: MATEMATICA, professores: 2, alunos: 30, lotesAprovados: 3, acertoPercentual: 50, porHabilidade: [{ habilidade: HABILIDADE, acertos: 15, total: 30 }] }],
  recortesNominais: [{ serie: SERIE, disciplina: FISICA }],
  alertas: [{ tipo: 'habilidade_com_acerto_baixo', serie: SERIE, disciplina: MATEMATICA, habilidade: HABILIDADE, valor: 50, referencia: 60, hipoteses: ['conteudo_recente'] }],
}
const SEM_NADA = { ...CONTEUDO, recortes: [], recortesNominais: [], alertas: [] }
const resumoComConteudo = (conteudo: unknown, resumoId = id(900)): FakeResponse => ({ status: 200, corpo: { resumo: { id: resumoId, geradoEm: '2026-10-16T12:00:00.000Z', conteudo } } })
const SEM_RESUMO: FakeResponse = { status: 200, corpo: { resumo: null } }

const botoes = (nome: string) => screen.queryAllByRole('button', { name: nome })

describe('o Analista: os estados', () => {
  it('carregando: só o aviso de leitura, e nenhum dos três vazios de dentro enquanto a leitura não terminou', async () => {
    const rede = fakeNetwork()
    const lida = rede.segurar()
    renderScreen(<Analista />)
    expect(await screen.findByText('Carregando o resumo…')).toBeTruthy()
    for (const vazio of ['Nenhum resumo gerado ainda', 'Nenhum alerta neste resumo', 'Ainda não há correção aprovada']) expect(screen.queryByText(vazio), vazio).toBeNull()
    lida.liberar(SEM_RESUMO)
    expect(await screen.findByText('Nenhum resumo gerado ainda')).toBeTruthy()
  })

  it('erro: diz o que fazer, "Tentar de novo" lê outra vez, e nenhum vazio aparece com a leitura falha', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let respostas = 0
    rede.responderPor('/v1/analista/resumo', () => (++respostas === 1 ? FORA : resumoComConteudo(CONTEUDO)))
    renderScreen(<Analista />)
    await screen.findByRole('alert')
    for (const vazio of ['Nenhum resumo gerado ainda', 'Nenhum alerta neste resumo', 'Ainda não há correção aprovada']) expect(screen.queryByText(vazio), vazio).toBeNull()
    // O "Gerar resumo" do alto continua, mas já não é o primário: o "Tentar de novo" é.
    expect(botoes('Gerar resumo')).toHaveLength(1)
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(document.querySelector('[data-resumo-do-analista]')).not.toBeNull()
  })

  it('vazio: "Nenhum resumo gerado ainda" com a ação de gerar, que é o único "Gerar resumo" da tela', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/analista/resumo', SEM_RESUMO)
    renderScreen(<Analista />)
    const titulo = await screen.findByText('Nenhum resumo gerado ainda')
    expect(botoes('Gerar resumo')).toHaveLength(1)
    expect(titulo.parentElement?.contains(botoes('Gerar resumo')[0] ?? null)).toBe(true)
    expect(document.querySelector('[data-resumo-do-analista]')).toBeNull()
    // Os vazios de dentro do resumo só existem com um resumo.
    expect(screen.queryByText('Nenhum alerta neste resumo')).toBeNull()
    expect(screen.queryByText('Ainda não há correção aprovada')).toBeNull()
  })

  it('com dado: assinatura do Analista com o selo "IA", o período numa linha, quatro números, o alerta com o selo "Hipótese", o acerto e o recorte sem número', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/analista/resumo', resumoComConteudo(CONTEUDO))
    renderScreen(<Analista />)
    const resumo = await waitFor(() => {
      const achado = document.querySelector<HTMLElement>('[data-resumo-do-analista]')
      expect(achado).not.toBeNull()
      return achado as HTMLElement
    })
    // A página de leitura: a coluna de 880 px (`docs/interface.md` 9.3).
    expect(document.querySelector('[data-tela]')?.getAttribute('data-tela')).toBe('leitura')
    const assinatura = document.querySelector('[data-assinatura]')
    expect(assinatura?.textContent).toContain('Analista de desempenho escolar')
    expect(assinatura?.querySelector('[data-selo-ia]')).not.toBeNull()
    expect(within(resumo).getByText(/^Resumo gerado em .* · de 1 de outubro de 2026 a 16 de outubro de 2026$/)).toBeTruthy()
    for (const rotulo of ['Atividades aplicadas', 'Correções aprovadas', 'Trocas com o Tutor', 'Versões adaptadas aprovadas']) expect(within(resumo).getByText(rotulo), rotulo).toBeTruthy()

    const alerta = resumo.querySelector('[data-alerta="habilidade_com_acerto_baixo"]') as HTMLElement
    expect(within(alerta).getByText('Hipótese').closest('[data-estado]')?.getAttribute('data-estado')).toBe('info')
    expect(alerta.textContent).toContain('ficou em 50%, abaixo de 60%, um limite provisório desta versão')
    expect(within(alerta).getByText('Hipóteses a conferir')).toBeTruthy()
    expect(within(resumo).getByRole('region', { name: /Matemática/ }).textContent).toContain('Resolver problemas com números inteiros')
    const semNumero = resumo.querySelectorAll('[data-recorte-nominal]')
    expect(semNumero).toHaveLength(1)
    expect(semNumero[0]?.textContent).toContain('Física')
    // O dado nominal é a última seção da página, depois do resumo.
    const secoes = Array.from(document.querySelectorAll('section'))
    expect(secoes.at(-1)?.getAttribute('aria-labelledby')).toBe('titulo-dado-nominal')
    expect(screen.getByRole('button', { name: 'Abrir dado nominal de uma turma' })).toBeTruthy()
  })

  it('o resumo sem nada dentro mostra os dois vazios de dentro, só depois da leitura', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/analista/resumo', resumoComConteudo(SEM_NADA))
    renderScreen(<Analista />)
    expect(await screen.findByText('Nenhum alerta neste resumo')).toBeTruthy()
    expect(screen.getByText('Ainda não há correção aprovada')).toBeTruthy()
    expect(screen.queryByText('Nenhum resumo gerado ainda')).toBeNull()
  })

  it('gerar: o pedido sai uma vez, o botão fica desligado e diz o que acontece enquanto ele está no ar, e o foco vai para o resumo que chegou', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let resumoLido = 0
    rede.responderPor('/v1/analista/resumo', () => (++resumoLido === 1 ? SEM_RESUMO : resumoComConteudo(CONTEUDO)))
    const execucao = id(800)
    const pedidos: string[] = []
    rede.responderPor('/v1/analista/gerar', () => {
      pedidos.push('gerar')
      return { status: 202, corpo: { execucaoId: execucao } }
    })
    // A execução só termina quando o teste solta: até lá o pedido está no ar.
    let soltar: () => void = () => undefined
    const solta = new Promise<void>((resolver) => (soltar = resolver))
    rede.responderPor(`/v1/execucoes/${execucao}`, async () => {
      await solta
      return { status: 200, corpo: { id: execucao, tarefa: 'resumo_do_analista', estado: 'concluida', resultado: { tipo: 'resumo_do_analista', resumoId: id(900) }, erro: null } }
    })
    renderScreen(<Analista />)
    // O botão do alto vale enquanto lê; o do vazio, depois: o clique é no que fica.
    await screen.findByText('Nenhum resumo gerado ainda')
    await usuario.click(screen.getByRole('button', { name: 'Gerar resumo' }))
    const gerando = await screen.findByRole('button', { name: 'Gerando o resumo…' })
    expect((gerando as HTMLButtonElement).disabled).toBe(true)
    await usuario.click(gerando)
    expect(pedidos).toEqual(['gerar'])
    expect(screen.getByText('O Analista está montando o resumo. Você pode continuar nesta tela.')).toBeTruthy()

    soltar()
    const chegou = await waitFor(() => {
      const achado = document.querySelector<HTMLElement>('[data-resumo-do-analista]')
      expect(achado).not.toBeNull()
      return achado as HTMLElement
    })
    await waitFor(() => expect(within(chegou).getByText(/^Resumo gerado em/)).toBe(document.activeElement))
    // Com o resumo na tela o botão está no alto, de novo "Gerar resumo", e ligado.
    expect((screen.getByRole('button', { name: 'Gerar resumo' }) as HTMLButtonElement).disabled).toBe(false)
    expect(pedidos).toEqual(['gerar'])
  })
})

/** Nada que faça da página uma conversa: nem campo, nem anexo, nem pergunta pronta, nem relatório, nem o que baixar. */
function conferirQueNaoEConversa(): void {
  expect(screen.queryAllByRole('textbox')).toEqual([])
  expect(screen.queryAllByRole('searchbox')).toEqual([])
  expect(document.body.querySelector('input[type="file"], textarea, [contenteditable="true"]')).toBeNull()
  expect(screen.queryAllByRole('link', { name: /baixar|relat[óo]rio/i })).toEqual([])
  expect(screen.queryAllByRole('button', { name: /baixar|relat[óo]rio|anexar|perguntar|enviar/i })).toEqual([])
  expect(document.body.textContent).not.toMatch(/Pergunte|Relatório do mês|Baixar/)
}

describe('o miolo da tela', () => {
  it('só o miolo rola a partir de 768 px, com o título de fora; ele recebe foco a 1366 px, e a 360 px rola a página e não há o que focar', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/analista/resumo', resumoComConteudo(CONTEUDO))
    renderScreen(<Analista />)
    await waitFor(() => expect(document.querySelector('[data-resumo-do-analista]')).not.toBeNull())

    const miolo = screen.getByRole('region', { name: 'Resumo do Analista' })
    // Na região estão a assinatura, o resumo e o dado nominal; o título da tela, não: ele fica parado em cima.
    expect(miolo.contains(document.querySelector('[data-resumo-do-analista]'))).toBe(true)
    expect(within(miolo).getByText('Analista de desempenho escolar')).toBeTruthy()
    expect(within(miolo).getByText('Dado nominal')).toBeTruthy()
    expect(within(miolo).queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Analista' })).toBeTruthy()
    const classes = miolo.className.split(' ')
    expect(classes).toContain('md:overflow-y-auto')
    expect(classes).toContain('md:relative')
    expect(classes.some((classe) => /^md:max-h-\[calc\(100dvh-/.test(classe))).toBe(true)
    // Nenhuma classe sem o prefixo `md:` prende a altura: abaixo de 768 px quem rola é a página.
    expect(classes.filter((classe) => /^(?:max-h|h|overflow-y)-/.test(classe))).toEqual([])
    expect(miolo.getAttribute('tabindex')).toBe('0')
    cleanup()

    janelaDe(360)
    renderScreen(<Analista />)
    await waitFor(() => expect(document.querySelector('[data-resumo-do-analista]')).not.toBeNull())
    expect(screen.getByRole('region', { name: 'Resumo do Analista' }).hasAttribute('tabindex')).toBe(false)
  })
})

describe('o miolo da tela, sem resumo', () => {
  it('o estado vazio também fica dentro do miolo que rola, e o título da tela fora dele', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/analista/resumo', SEM_RESUMO)
    renderScreen(<Analista />)
    await screen.findByText('Nenhum resumo gerado ainda')

    const miolo = screen.getByRole('region', { name: 'Resumo do Analista' })
    expect(within(miolo).getByText('Nenhum resumo gerado ainda')).toBeTruthy()
    expect(within(miolo).getByText('Dado nominal')).toBeTruthy()
    expect(within(miolo).queryByRole('heading', { level: 1 })).toBeNull()
    expect(miolo.className.split(' ')).toContain('md:overflow-y-auto')
  })
})

describe('o Analista não é conversa (RF8)', () => {
  it('sem resumo: sem campo de texto, de arquivo, pergunta pronta, relatório nem link de baixar', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/analista/resumo', SEM_RESUMO)
    renderScreen(<Analista />)
    await screen.findByText('Nenhum resumo gerado ainda')
    conferirQueNaoEConversa()
  })

  it('com resumo: o mesmo', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/analista/resumo', resumoComConteudo(CONTEUDO))
    renderScreen(<Analista />)
    await waitFor(() => expect(document.querySelector('[data-resumo-do-analista]')).not.toBeNull())
    conferirQueNaoEConversa()
  })
})
