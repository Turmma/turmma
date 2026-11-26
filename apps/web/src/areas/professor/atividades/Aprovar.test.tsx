// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buttonVariants } from '../../../components/ui/button-variants'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import Aprovar from './Aprovar'

/**
 * "Revisar a correção" na pele nova (telas do professor, 14.0; RF20, RF21): os estados, o botão oficial que só a API liga, a abertura
 * do destaque que registra uma vez, as abas e o painel no endereço. A rede é falsa e responde **por caminho**; a tela, o cliente de
 * consultas e o `wouter` são os da aba (a localização é a de memória, que guarda o histórico). O fluxo da aprovação, do registro e
 * do recomeço é do e2e (`e2e/professor-aprovar.spec.ts`).
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const ATIVIDADE = id(1)
const ENTREGA = id(2)
const ANA = id(11)
const BRUNO = id(12)
const HABILIDADE = { codigo: 'QUI.EM.04', descricao: 'Usar a proporção da equação balanceada.' }
const ABERTO_EM = '2026-10-05T13:38:00.000Z'

/** O lote como a API o devolve: dois destaques (Ana em branco, Bruno fora do histórico) e três outras correções, fora da ordem de nome. */
function lote(mudanca: Partial<{ abertos: readonly string[]; podeAprovar: boolean; estado: 'pendente' | 'aprovada'; saidas: Readonly<Record<string, number>> }> = {}) {
  const { abertos = [], podeAprovar = false, estado = 'pendente', saidas } = mudanca
  const abertoEm = (alunoId: string) => (abertos.includes(alunoId) ? ABERTO_EM : null)
  // O lote da avaliativa traz `saidasDaAba` de todo aluno (0 para quem não saiu); o da atividade sem prova não traz o campo.
  const comSaidas = <A extends { readonly alunoId: string }>(aluno: A) => (saidas === undefined ? aluno : { ...aluno, saidasDaAba: saidas[aluno.alunoId] ?? 0 })
  const doLote = {
    atividadeAplicadaId: ATIVIDADE,
    titulo: 'Atividade de estequiometria',
    entrega: { id: ENTREGA, estado },
    resumo: {
      alunosDaTurma: 30,
      corrigidos: 28,
      questoes: 2,
      mediaDeAcertos: 1.25,
      distribuicao: [{ de: 0, ate: 2, alunos: 28 }],
      porHabilidade: [{ habilidade: HABILIDADE, acertos: 20, total: 28 }],
      porQuestao: [{ numero: 1, habilidade: HABILIDADE, gabarito: 1, acertos: 20, porAlternativa: [3, 20, 2, 2], emBranco: 1 }],
    },
    destaques: [
      { alunoId: ANA, nome: 'Ana Sintética', acertos: 0, total: 2, emBranco: 2, motivos: ['em_branco'], abertoEm: abertoEm(ANA) },
      { alunoId: BRUNO, nome: 'Bruno Sintético', acertos: 0, total: 2, emBranco: 0, motivos: ['fora_do_historico'], abertoEm: abertoEm(BRUNO) },
    ],
    outras: [
      { alunoId: id(21), nome: 'Clara Sintética', acertos: 1, total: 2, emBranco: 0 },
      { alunoId: id(22), nome: 'Dora Sintética', acertos: 2, total: 2, emBranco: 0 },
      { alunoId: id(23), nome: 'Caio Sintético', acertos: 0, total: 2, emBranco: 0 },
    ],
    destaquesAbertos: abertos.length,
    podeAprovar,
    validacao: null,
  }
  return { ...doLote, destaques: doLote.destaques.map(comSaidas), outras: doLote.outras.map(comSaidas) }
}

const abertura = (alunoId: string, nome: string) => ({
  destaque: { alunoId, nome, acertos: 0, total: 2, emBranco: 2, motivos: ['em_branco'], abertoEm: ABERTO_EM },
  respostas: [
    { questao: 1, alternativa: null, gabarito: 1, correta: false },
    { questao: 2, alternativa: 2, gabarito: 2, correta: true },
  ],
  historico: [{ titulo: 'Atividade de balanceamento', acertos: 4, total: 5 }],
})

const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
const caminhoDaAbertura = (alunoId: string) => `/v1/atividades-aplicadas/${ATIVIDADE}/correcao/destaques/${alunoId}/abrir`

type Resposta = FakeResponse | (() => FakeResponse | Promise<FakeResponse>)
function instalar(rede: FakeNetwork, doLote: Resposta = () => ok(lote()), aberturas: Partial<Record<string, Resposta>> = {}): void {
  rede.responderPor(`/v1/atividades-aplicadas/${ATIVIDADE}/correcao`, doLote)
  rede.responderPor('/v1/entregas', ok({ itens: [] }))
  rede.responderPor('/v1/meus-vinculos', ok({ itens: [] }))
  rede.responderPor(caminhoDaAbertura(ANA), aberturas[ANA] ?? (() => ok(abertura(ANA, 'Ana Sintética'))))
  rede.responderPor(caminhoDaAbertura(BRUNO), aberturas[BRUNO] ?? (() => ok(abertura(BRUNO, 'Bruno Sintético'))))
}

const aberturasPedidas = (rede: FakeNetwork) => rede.chamadas.filter((chamada) => chamada.metodo === 'POST' && chamada.caminho.endsWith('/abrir')).map((chamada) => chamada.caminho)

function montar(busca = '', { estrito = false }: { estrito?: boolean } = {}) {
  const localizacao = memoryLocation({ path: `/aprovar/${ATIVIDADE}`, searchPath: busca, record: true })
  const tela = (
    <Router hook={localizacao.hook}>
      <Aprovar atividadeAplicadaId={ATIVIDADE} />
    </Router>
  )
  renderScreen(estrito ? <StrictMode>{tela}</StrictMode> : tela)
  return localizacao
}

const barra = () => screen.getByRole('group', { name: 'Aprovação do lote' })
const botaoDeAprovar = () => within(barra()).getByRole('button', { name: 'Aprovar 28 correções' })
const painel = () => screen.queryByRole('dialog', { name: /^Correção de / })

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  // A tabela é tabela a partir de 768 px (`useMediaQuery`): o `jsdom` não tem `matchMedia`, e a janela do teste é a larga.
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }))
  // A barra presa mede a si mesma para reservar o lugar do foco: o `jsdom` não tem `ResizeObserver`.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('Revisar a correção: os estados', () => {
  it('carregando, com o título e o caminho de volta; depois, com dado', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    const leitura = rede.segurar()
    montar()
    expect(screen.getByRole('heading', { level: 1, name: 'Revisar a correção' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar para a turma' })).toBeTruthy()
    expect(await screen.findByText('Carregando a correção…')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Aprovação do lote' })).toBeNull()
    await act(async () => leitura.liberar(ok(lote())))
    expect(await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })).toBeTruthy()
    expect(screen.queryByText('Carregando a correção…')).toBeNull()
  })

  it('erro: a mensagem do catálogo e "Tentar de novo", que lê de novo e mostra a correção', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falha = true
    // Limite excedido não é repetido sozinho (`shouldRetry`): o erro chega na hora, sem esperar a nova tentativa.
    instalar(rede, () => (falha ? erro(429, 'LIMITE_EXCEDIDO') : ok(lote())))
    montar()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Aprovação do lote' })).toBeNull()
    falha = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a correção que não existe diz "não está disponível", e é a mesma frase para a de outra turma e a de outra escola', async () => {
    const rede = fakeNetwork()
    instalar(rede, () => erro(404, 'NAO_ENCONTRADO'))
    montar()
    expect(await screen.findByText('Esta correção não está disponível')).toBeTruthy()
    const principal = document.body.textContent
    // A API responde igual ao id inexistente, ao de outra turma da escola e ao de outra escola (regra 10, item 6): a tela não distingue.
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/outra escola|sem permissão|proibid/i)).toBeNull()
    expect(principal).not.toContain('Tentar de novo')
    expect(screen.queryByRole('group', { name: 'Aprovação do lote' })).toBeNull()
  })

  it('com dado: a faixa de números, as três abas e a barra presa', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    const faixa = await screen.findByRole('group', { name: 'Números da correção' })
    expect(within(faixa).getByText('Corrigidas')).toBeTruthy()
    expect(within(faixa).getByText('28')).toBeTruthy()
    expect(within(faixa).getByText('0 de 2')).toBeTruthy()
    expect(within(faixa).getByText('1,3 de 2 questões')).toBeTruthy()
    expect(screen.getAllByRole('tab').map((aba) => aba.textContent)).toEqual(['Destaques', 'Outras', 'Resumo'])
    expect(screen.getByRole('tab', { name: 'Destaques' }).getAttribute('aria-selected')).toBe('true')
    expect(barra()).toBeTruthy()
  })
})

describe('Revisar a correção: o botão oficial', () => {
  it('desligado com destaque fechado, nas três abas, com o contador dizendo por quê; a barra não sai da tela ao trocar de aba', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })
    for (const aba of ['Destaques', 'Outras', 'Resumo']) {
      await usuario.click(screen.getByRole('tab', { name: aba }))
      expect(screen.getByRole('tab', { name: aba }).getAttribute('aria-selected')).toBe('true')
      const aprovar = botaoDeAprovar()
      expect((aprovar as HTMLButtonElement).disabled).toBe(true)
      expect(aprovar.getAttribute('aria-describedby')).not.toBeNull()
      expect(barra().textContent).toContain('0 de 2 destaques abertos.')
      expect(barra().textContent).toContain('Abra os 2 destaques que faltam para liberar a aprovação.')
    }
  })

  it('quem liga o botão é a API: com todos abertos e `podeAprovar` falso ele segue desligado e manda atualizar; com `podeAprovar` verdadeiro, liga', async () => {
    const rede = fakeNetwork()
    instalar(rede, () => ok(lote({ abertos: [ANA, BRUNO], podeAprovar: false })))
    montar()
    await screen.findByRole('group', { name: 'Aprovação do lote' })
    expect((botaoDeAprovar() as HTMLButtonElement).disabled).toBe(true)
    expect(barra().textContent).toContain('A aprovação ainda não foi liberada. Atualize a tela.')
  })

  it('com `podeAprovar` verdadeiro o botão liga, e o contador diz que está tudo aberto', async () => {
    const rede = fakeNetwork()
    instalar(rede, () => ok(lote({ abertos: [ANA, BRUNO], podeAprovar: true })))
    montar()
    await screen.findByRole('group', { name: 'Aprovação do lote' })
    expect((botaoDeAprovar() as HTMLButtonElement).disabled).toBe(false)
    expect(barra().textContent).toContain('Tudo aberto: a aprovação está liberada.')
  })

  it('o lote já decidido não tem barra, e o destaque que ficou fechado não se abre mais', async () => {
    const rede = fakeNetwork()
    instalar(rede, () => ok(lote({ abertos: [ANA], estado: 'aprovada' })))
    montar()
    await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })
    expect(screen.queryByRole('group', { name: 'Aprovação do lote' })).toBeNull()
    const itens = screen.getAllByRole('listitem').filter((item) => item.hasAttribute('data-destaque'))
    expect(within(itens[0] as HTMLElement).getByRole('button')).toBeTruthy()
    expect(within(itens[1] as HTMLElement).queryByRole('button')).toBeNull()
  })

  it('um único botão oficial e nenhum primário; "Rejeitar a correção" é o `perigo` de contorno, e o oficial não é laranja', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await screen.findByRole('group', { name: 'Aprovação do lote' })
    const botoes = screen.getAllByRole('button')
    const classes = (botao: HTMLElement) => botao.className.trim()
    expect(botoes.filter((botao) => classes(botao) === buttonVariants({ variante: 'oficial' }))).toHaveLength(1)
    expect(botoes.filter((botao) => botao.className.includes('bg-laranja'))).toHaveLength(0)
    expect(botoes.filter((botao) => classes(botao) === buttonVariants({ variante: 'primario' }))).toHaveLength(0)
    const rejeitar = within(barra()).getByRole('button', { name: 'Rejeitar a correção' })
    expect(classes(rejeitar)).toBe(buttonVariants({ variante: 'perigo' }))
    expect(classes(rejeitar)).not.toBe(buttonVariants({ variante: 'perigo', cheio: true }))
    expect(classes(botaoDeAprovar())).toBe(buttonVariants({ variante: 'oficial' }))
  })
})

describe('Revisar a correção: abrir o destaque registra uma vez', () => {
  it('dois cliques seguidos no mesmo destaque mandam uma abertura só, e o painel abre com as respostas e o endereço leva o id', async () => {
    const rede = fakeNetwork()
    let liberar: (resposta: FakeResponse) => void = () => undefined
    instalar(rede, undefined, { [ANA]: () => new Promise<FakeResponse>((resolver) => (liberar = resolver)) })
    const localizacao = montar()
    const linha = within(await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })).getByRole('button', { name: /Ana Sintética/ })
    // Os dois cliques no mesmo instante, antes de a tela se redesenhar com a abertura em espera.
    await act(async () => {
      fireEvent.click(linha)
      fireEvent.click(linha)
    })
    expect(aberturasPedidas(rede)).toEqual([caminhoDaAbertura(ANA)])
    await act(async () => liberar(ok(abertura(ANA, 'Ana Sintética'))))
    expect(await screen.findByRole('dialog', { name: 'Correção de Ana Sintética' })).toBeTruthy()
    expect(within(screen.getByRole('dialog', { name: 'Correção de Ana Sintética' })).getByRole('table', { name: 'Respostas de Ana Sintética' })).toBeTruthy()
    expect(aberturasPedidas(rede)).toEqual([caminhoDaAbertura(ANA)])
    expect(localizacao.history?.at(-1)).toBe(`/aprovar/${ATIVIDADE}?ver=${ANA}`)
  })

  it('a abertura que falha não abre o painel: o erro fica na linha, e o destaque continua fechado', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, undefined, { [BRUNO]: () => erro(503, 'INDISPONIVEL_TENTE_DE_NOVO') })
    const localizacao = montar()
    await usuario.click(within(await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })).getByRole('button', { name: /Bruno Sintético/ }))
    const alerta = await screen.findByRole('alert')
    expect(painel()).toBeNull()
    expect(localizacao.history).toEqual([`/aprovar/${ATIVIDADE}`])
    // O erro está na linha do Bruno, e o destaque dele continua fechado: sem hora de abertura, e a linha ainda diz que falta abrir.
    const linhaDoBruno = alerta.closest('[data-destaque]')
    expect(linhaDoBruno?.getAttribute('data-destaque')).toBe('fechado')
    expect(linhaDoBruno?.textContent).toContain('Bruno Sintético')
    expect(linhaDoBruno?.textContent).toContain('Falta abrir')
  })

  it('recarregar com `?ver=` de destaque ainda fechado não abre o painel nem registra abertura', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar(`ver=${ANA}`)
    await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })
    // Dá tempo de qualquer leitura sair: a tela já está montada, o lote já foi lido.
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 30))
    })
    expect(painel()).toBeNull()
    expect(aberturasPedidas(rede)).toEqual([])
  })

  it('`?ver=` de um id que o lote não tem (outra turma, outra escola) não abre nada nem pergunta à API', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar(`ver=${id(99)}`)
    await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 30))
    })
    expect(painel()).toBeNull()
    expect(aberturasPedidas(rede)).toEqual([])
  })

  it('recarregar com `?ver=` de destaque já aberto lê as respostas uma vez só', async () => {
    const rede = fakeNetwork()
    instalar(rede, () => ok(lote({ abertos: [ANA] })))
    montar(`ver=${ANA}`, { estrito: true })
    expect(await screen.findByRole('dialog', { name: 'Correção de Ana Sintética' })).toBeTruthy()
    expect(await screen.findByRole('table', { name: 'Respostas de Ana Sintética' })).toBeTruthy()
    expect(aberturasPedidas(rede)).toEqual([caminhoDaAbertura(ANA)])
  })

  it('com uma abertura no ar, o endereço de outro destaque já aberto não manda uma segunda leitura por cima dela', async () => {
    const rede = fakeNetwork()
    let liberar: (resposta: FakeResponse) => void = () => undefined
    instalar(rede, () => ok(lote({ abertos: [ANA] })), { [BRUNO]: () => new Promise<FakeResponse>((resolver) => (liberar = resolver)) })
    const localizacao = montar()
    await userEvent.setup().click(within(await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })).getByRole('button', { name: /Bruno Sintético/ }))
    await waitFor(() => expect(aberturasPedidas(rede)).toEqual([caminhoDaAbertura(BRUNO)]))
    // A professora cola o endereço do destaque da Ana, já aberto, enquanto a abertura do Bruno está na rede.
    await act(async () => localizacao.navigate(`/aprovar/${ATIVIDADE}?ver=${ANA}`))
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 30))
    })
    expect(aberturasPedidas(rede)).toEqual([caminhoDaAbertura(BRUNO)])
    // A abertura do Bruno termina e leva o painel dele: nenhuma leitura da Ana saiu por cima.
    await act(async () => liberar(ok(abertura(BRUNO, 'Bruno Sintético'))))
    expect(await screen.findByRole('dialog', { name: 'Correção de Bruno Sintético' })).toBeTruthy()
    expect(aberturasPedidas(rede)).toEqual([caminhoDaAbertura(BRUNO)])
  })

  it('a leitura do painel que falha mostra o erro no painel, e "Tentar de novo" lê e mostra as respostas sem outro passo no histórico', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falha = true
    instalar(rede, () => ok(lote({ abertos: [ANA] })), { [ANA]: () => (falha ? erro(503, 'INDISPONIVEL_TENTE_DE_NOVO') : ok(abertura(ANA, 'Ana Sintética'))) })
    const localizacao = montar(`ver=${ANA}`)
    const dialogo = await screen.findByRole('dialog', { name: 'Correção de Ana Sintética' })
    expect(await within(dialogo).findByRole('alert')).toBeTruthy()
    // O erro é do painel: a linha do destaque não repete o mesmo aviso.
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(aberturasPedidas(rede)).toHaveLength(1)
    falha = false
    await usuario.click(within(dialogo).getByRole('button', { name: 'Tentar de novo' }))
    expect(await within(dialogo).findByRole('table', { name: 'Respostas de Ana Sintética' })).toBeTruthy()
    expect(aberturasPedidas(rede)).toHaveLength(2)
    expect(localizacao.history).toEqual([`/aprovar/${ATIVIDADE}?ver=${ANA}`])
  })

  it('fechar o painel troca o endereço sem passo novo; abrir de novo o mesmo destaque não chama a API outra vez', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    const localizacao = montar()
    const lista = await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })
    await usuario.click(within(lista).getByRole('button', { name: /Ana Sintética/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Correção de Ana Sintética' })
    expect(localizacao.history).toEqual([`/aprovar/${ATIVIDADE}`, `/aprovar/${ATIVIDADE}?ver=${ANA}`])
    // Abertura que deu certo não deixa aviso de erro em linha nenhuma.
    expect(screen.queryByRole('alert')).toBeNull()

    await usuario.click(within(dialogo).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(painel()).toBeNull())
    // O fechar troca o último passo, e não acrescenta outro.
    expect(localizacao.history).toEqual([`/aprovar/${ATIVIDADE}`, `/aprovar/${ATIVIDADE}`])

    await usuario.click(within(screen.getByRole('region', { name: 'Abra estes 2 antes de aprovar' })).getByRole('button', { name: /Ana Sintética/ }))
    expect(await screen.findByRole('dialog', { name: 'Correção de Ana Sintética' })).toBeTruthy()
    expect(aberturasPedidas(rede)).toEqual([caminhoDaAbertura(ANA)])
  })
})

describe('Revisar a correção: a aba pelo endereço', () => {
  it('`?aba=resumo` abre o Resumo, e a barra continua', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar('aba=resumo')
    expect(await screen.findByRole('region', { name: 'Distribuição dos acertos' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Acerto por habilidade' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Por questão' })).toBeTruthy()
    expect(screen.getByText(/pode ter o gabarito errado/)).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Resumo' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByRole('region', { name: 'Abra estes 2 antes de aprovar' })).toBeNull()
    expect(barra()).toBeTruthy()
  })

  it('a questão sem habilidade (classificacao-bncc, 10.0) aparece no Resumo como "Sem habilidade", no acerto por habilidade e na tabela por questão, sem código inventado', async () => {
    const rede = fakeNetwork()
    const doLote = lote()
    instalar(rede, () => ok({ ...doLote, resumo: { ...doLote.resumo, porHabilidade: [{ habilidade: null, acertos: 20, total: 28 }], porQuestao: [{ ...doLote.resumo.porQuestao[0], habilidade: null }] } }))
    montar('aba=resumo')
    const porHabilidade = await screen.findByRole('region', { name: 'Acerto por habilidade' })
    expect(within(porHabilidade).getByText('Sem habilidade')).toBeTruthy()
    expect(within(porHabilidade).queryByText(/QUI\.EM/)).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Por questão' })).getByText('Sem habilidade')).toBeTruthy()
  })

  it('um valor que não é aba cai em Destaques', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar('aba=todas')
    expect(await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Destaques' }).getAttribute('aria-selected')).toBe('true')
  })

  it('trocar de aba usa `replace`: o histórico não ganha passo, e o `?ver=` que estivesse no endereço fica', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    const localizacao = montar(`ver=${id(99)}`)
    await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })
    await usuario.click(screen.getByRole('tab', { name: 'Outras' }))
    expect(localizacao.history).toEqual([`/aprovar/${ATIVIDADE}?ver=${id(99)}&aba=outras`])
    await usuario.click(screen.getByRole('tab', { name: 'Resumo' }))
    expect(localizacao.history).toEqual([`/aprovar/${ATIVIDADE}?ver=${id(99)}&aba=resumo`])
  })

  it('as outras correções saem em ordem de nome, e não na ordem da API nem na de acerto', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar('aba=outras')
    const tabela = await screen.findByRole('table', { name: 'As outras correções' })
    const nomes = within(tabela)
      .getAllByRole('row')
      .slice(1)
      .map((linha) => within(linha).getByRole('rowheader').textContent)
    // A API as entrega Clara (1 acerto), Dora (2) e Caio (0): só o nome produz Caio, Clara, Dora.
    expect(nomes).toEqual(['Caio Sintético', 'Clara Sintética', 'Dora Sintética'])
    expect(screen.getByRole('region', { name: 'As outras 3 correções' })).toBeTruthy()
  })
})

describe('Revisar a correção: a decisão que o prazo do cliente interrompe (RF11, 52.0; regra 70, item 1)', () => {
  afterEach(() => vi.useRealTimers())

  const AVISO_DO_PRAZO = 'Não foi possível confirmar a decisão. Confira a situação da correção na tela antes de tentar de novo.'

  // A decisão passa dos 20 s da leitura (`aprovarLote` e `decidirEntrega` não pedem `tipo`): o servidor pode ter gravado, e a tela
  // não afirma que "nada foi aprovado". Só a chamada da decisão pendura, e obedece ao sinal, como o `fetch` do navegador; o resto
  // é a rede falsa de sempre.
  it.each([
    ['a aprovação do lote', '/aprovar-lote', async (usuario: ReturnType<typeof userEvent.setup>) => {
      await usuario.click(botaoDeAprovar())
      await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Aprovar 28 correções' }))
    }],
    ['a rejeição do lote', '/decidir', async (usuario: ReturnType<typeof userEvent.setup>) => {
      await usuario.click(within(barra()).getByRole('button', { name: 'Rejeitar a correção' }))
      const dialogo = await screen.findByRole('alertdialog')
      await usuario.type(within(dialogo).getByRole('textbox', { name: /Por que você está rejeitando\?/ }), 'O gabarito da questão 2 está errado.')
      await usuario.click(within(dialogo).getByRole('button', { name: 'Rejeitar a correção' }))
    }],
  ])('%s que passa de 20 s diz que não foi possível confirmar, manda conferir a correção, e lê a correção de novo', async (_nome, caminhoDaDecisao, decidir) => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const usuario = userEvent.setup({ advanceTimers: (ms) => void vi.advanceTimersByTime(ms) })
    const rede = fakeNetwork()
    instalar(rede, () => ok(lote({ abertos: [ANA, BRUNO], podeAprovar: true })))
    const daRede = vi.mocked(fetch)
    const sinais: AbortSignal[] = []
    vi.stubGlobal('fetch', (caminho: string, opcoes: RequestInit = {}) => {
      if (!caminho.endsWith(caminhoDaDecisao)) return daRede(caminho, opcoes)
      return new Promise<Response>((_resolver, rejeitar) => {
        const { signal } = opcoes
        if (signal === undefined || signal === null) return
        sinais.push(signal)
        signal.addEventListener('abort', () => rejeitar(new DOMException('abortada', 'AbortError')))
      })
    })
    const leituras = () => rede.chamadas.filter((chamada) => chamada.metodo === 'GET' && chamada.caminho.endsWith('/correcao')).length
    montar()
    await screen.findByRole('group', { name: 'Aprovação do lote' })
    await decidir(usuario)
    const lidasAntes = leituras()
    await vi.advanceTimersByTimeAsync(19_900)
    // Até aos 19,9 s a tela espera: nenhum aviso, e o diálogo segue aberto.
    expect(sinais).toHaveLength(1)
    expect(screen.queryByText(AVISO_DO_PRAZO)).toBeNull()
    await vi.advanceTimersByTimeAsync(100)
    expect(await screen.findByText(AVISO_DO_PRAZO)).toBeTruthy()
    // Não afirma o resultado: a decisão pode ter sido gravada, e a tela manda conferir.
    expect(document.body.textContent).not.toContain('nada foi aprovado')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.body.textContent).not.toContain('TEMPO_ESGOTADO')
    await waitFor(() => expect(leituras()).toBeGreaterThan(lidasAntes))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

/** A frase do aviso fixo da D88 (`cenarios.md` §4), inteira: a coluna não existe sem ela. */
const AVISO_DA_SAIDA = 'Conta as vezes em que a aba da prova perdeu o foco. Leitor de tela, teclado virtual e avisos do sistema também contam. Sozinho, não indica cola.'
const SAIDAS = { [BRUNO]: 3, [id(21)]: 5, [id(23)]: 9 }

describe('Revisar a correção: a coluna "Saiu da aba" (D70, D88; RF9)', () => {
  it('na avaliativa, a tabela das outras ganha a coluna "Saiu da aba" com a contagem de cada aluno, e o aviso fixo vem acima dela, pela frase inteira', async () => {
    const rede = fakeNetwork()
    instalar(rede, () => ok(lote({ saidas: SAIDAS })))
    montar('aba=outras')
    const tabela = await screen.findByRole('table', { name: 'As outras correções' })
    expect(within(tabela).getByRole('columnheader', { name: 'Saiu da aba' })).toBeTruthy()
    const contagens = Object.fromEntries(
      within(tabela)
        .getAllByRole('row')
        .slice(1)
        .map((linha) => [within(linha).getByRole('rowheader').textContent, within(linha).getAllByRole('cell').at(-1)?.textContent]),
    )
    expect(contagens).toEqual({ 'Caio Sintético': '9', 'Clara Sintética': '5', 'Dora Sintética': '0' })
    const aviso = screen.getByText(AVISO_DA_SAIDA)
    // O aviso vem acima da tabela, no documento.
    expect(aviso.compareDocumentPosition(tabela) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // A coluna não muda a ordem: segue a de nome, e não a de contagem (Caio, com 9, continua primeiro só pelo nome).
    expect(Object.keys(contagens)).toEqual(['Caio Sintético', 'Clara Sintética', 'Dora Sintética'])
  })

  it('na aba Destaques, a contagem vem na linha de cada destaque, com o aviso acima da lista; a saída não vira destaque nem muda o contador', async () => {
    const rede = fakeNetwork()
    // Clara e Caio saem muitas vezes e seguem fora dos destaques: a saída não destaca ninguém.
    instalar(rede, () => ok(lote({ saidas: SAIDAS })))
    montar()
    const destaques = await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })
    expect(within(destaques).getByText(AVISO_DA_SAIDA)).toBeTruthy()
    const linhas = within(destaques).getAllByRole('listitem')
    expect(linhas.map((linha) => linha.textContent)).toEqual([expect.stringContaining('Saiu da aba: 0'), expect.stringContaining('Saiu da aba: 3')])
    expect(screen.queryByText(/Clara Sintética/)).toBeNull()
    // O contador fala só dos destaques por abrir: nunca de saída da aba.
    expect(document.querySelector('[data-contador-dos-destaques]')?.textContent).not.toMatch(/saiu|saída/i)
  })

  it('com 9 saídas e nenhum destaque por abrir, o botão de aprovar liga como sempre: a saída não trava a aprovação', async () => {
    const rede = fakeNetwork()
    instalar(rede, () => ok(lote({ abertos: [ANA, BRUNO], podeAprovar: true, saidas: { ...SAIDAS, [ANA]: 9 } })))
    montar()
    await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })
    expect(botaoDeAprovar().hasAttribute('disabled')).toBe(false)
  })

  it('o aviso só vem com lista abaixo dele: sem destaque, a aba Destaques mostra o vazio sem o aviso; sem outras, a aba Outras também', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const doLote = lote({ saidas: SAIDAS })
    // Só as outras correções, nenhum destaque; e depois só os destaques, nenhuma outra.
    instalar(rede, () => ok({ ...doLote, destaques: [], destaquesAbertos: 0, podeAprovar: true }))
    montar()
    const semDestaques = await screen.findByRole('region', { name: 'Nenhuma correção para abrir antes de aprovar' })
    expect(within(semDestaques).queryByText(AVISO_DA_SAIDA)).toBeNull()
    await usuario.click(screen.getByRole('tab', { name: 'Outras' }))
    expect(await screen.findByText(AVISO_DA_SAIDA)).toBeTruthy()
  })

  it('só com destaques, a aba Outras, vazia, não mostra o aviso, e a de Destaques mostra', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const doLote = lote({ saidas: SAIDAS })
    instalar(rede, () => ok({ ...doLote, outras: [] }))
    montar('aba=outras')
    expect(await screen.findByRole('region', { name: 'As outras 0 correções' })).toBeTruthy()
    expect(screen.queryByText(AVISO_DA_SAIDA)).toBeNull()
    await usuario.click(screen.getByRole('tab', { name: 'Destaques' }))
    expect(await screen.findByText(AVISO_DA_SAIDA)).toBeTruthy()
  })

  it('a atividade sem prova não tem a coluna nem o aviso, em nenhuma das duas abas', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar('aba=outras')
    const tabela = await screen.findByRole('table', { name: 'As outras correções' })
    expect(within(tabela).queryByRole('columnheader', { name: 'Saiu da aba' })).toBeNull()
    expect(screen.queryByText(AVISO_DA_SAIDA)).toBeNull()
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Destaques' }))
    const destaques = await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })
    expect(within(destaques).queryByText(AVISO_DA_SAIDA)).toBeNull()
    expect(destaques.textContent).not.toContain('Saiu da aba')
  })

  it('a 360 px (a tabela vira lista), a contagem vai dentro do cartão do aluno, com o rótulo, e o aviso segue acima', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }))
    const rede = fakeNetwork()
    instalar(rede, () => ok(lote({ saidas: SAIDAS })))
    montar('aba=outras')
    const lista = await screen.findByRole('list', { name: 'As outras correções' })
    const cartoes = within(lista).getAllByRole('listitem')
    const doCaio = cartoes.find((cartao) => cartao.textContent?.includes('Caio Sintético'))
    expect(doCaio).toBeTruthy()
    expect(within(doCaio as HTMLElement).getByText('Saiu da aba')).toBeTruthy()
    expect((doCaio as HTMLElement).textContent).toContain('9')
    const aviso = screen.getByText(AVISO_DA_SAIDA)
    expect(aviso.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
