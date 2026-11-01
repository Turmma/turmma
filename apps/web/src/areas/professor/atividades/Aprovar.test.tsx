// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buttonVariants } from '../../../components/ui/button-variants'
import { prepararTela, redeFalsa, renderizarTela, type RedeFalsa, type RespostaFalsa } from '../../../__fixtures__/render-screen'
import Aprovar from './Aprovar'

/**
 * "Revisar a correção" na pele nova (telas do professor, 14.0; RF20, RF21): os estados, o botão oficial que só a API liga, a abertura
 * do destaque que registra uma vez, as abas e o painel no endereço. A rede é falsa e responde **por caminho**; a tela, o cliente de
 * consultas e o `wouter` são os da aba (a localização é a de memória, que guarda o histórico). O fluxo da aprovação, do registro e
 * do recomeço é do e2e (`e2e/professor-aprovar.spec.ts`).
 */
prepararTela()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const ATIVIDADE = id(1)
const ENTREGA = id(2)
const ANA = id(11)
const BRUNO = id(12)
const HABILIDADE = { codigo: 'QUI.EM.04', descricao: 'Usar a proporção da equação balanceada.' }
const ABERTO_EM = '2026-10-05T13:38:00.000Z'

/** O lote como a API o devolve: dois destaques (Ana em branco, Bruno fora do histórico) e três outras correções, fora da ordem de nome. */
function lote(mudanca: Partial<{ abertos: readonly string[]; podeAprovar: boolean; estado: 'pendente' | 'aprovada' }> = {}) {
  const { abertos = [], podeAprovar = false, estado = 'pendente' } = mudanca
  const abertoEm = (alunoId: string) => (abertos.includes(alunoId) ? ABERTO_EM : null)
  return {
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
}

const abertura = (alunoId: string, nome: string) => ({
  destaque: { alunoId, nome, acertos: 0, total: 2, emBranco: 2, motivos: ['em_branco'], abertoEm: ABERTO_EM },
  respostas: [
    { questao: 1, alternativa: null, gabarito: 1, correta: false },
    { questao: 2, alternativa: 2, gabarito: 2, correta: true },
  ],
  historico: [{ titulo: 'Atividade de balanceamento', acertos: 4, total: 5 }],
})

const ok = (corpo: unknown): RespostaFalsa => ({ status: 200, corpo })
const erro = (status: number, codigo: string): RespostaFalsa => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
const caminhoDaAbertura = (alunoId: string) => `/v1/atividades-aplicadas/${ATIVIDADE}/correcao/destaques/${alunoId}/abrir`

type Resposta = RespostaFalsa | (() => RespostaFalsa | Promise<RespostaFalsa>)
function instalar(rede: RedeFalsa, doLote: Resposta = () => ok(lote()), aberturas: Partial<Record<string, Resposta>> = {}): void {
  rede.responderPor(`/v1/atividades-aplicadas/${ATIVIDADE}/correcao`, doLote)
  rede.responderPor('/v1/entregas', ok({ itens: [] }))
  rede.responderPor('/v1/meus-vinculos', ok({ itens: [] }))
  rede.responderPor(caminhoDaAbertura(ANA), aberturas[ANA] ?? (() => ok(abertura(ANA, 'Ana Sintética'))))
  rede.responderPor(caminhoDaAbertura(BRUNO), aberturas[BRUNO] ?? (() => ok(abertura(BRUNO, 'Bruno Sintético'))))
}

const aberturasPedidas = (rede: RedeFalsa) => rede.chamadas.filter((chamada) => chamada.metodo === 'POST' && chamada.caminho.endsWith('/abrir')).map((chamada) => chamada.caminho)

function montar(busca = '', { estrito = false }: { estrito?: boolean } = {}) {
  const localizacao = memoryLocation({ path: `/aprovar/${ATIVIDADE}`, searchPath: busca, record: true })
  const tela = (
    <Router hook={localizacao.hook}>
      <Aprovar atividadeAplicadaId={ATIVIDADE} />
    </Router>
  )
  renderizarTela(estrito ? <StrictMode>{tela}</StrictMode> : tela)
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
    const rede = redeFalsa()
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
    const rede = redeFalsa()
    let falha = true
    // Limite excedido não é repetido sozinho (`deveTentarDeNovo`): o erro chega na hora, sem esperar a nova tentativa.
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
    const rede = redeFalsa()
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
    const rede = redeFalsa()
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
    const rede = redeFalsa()
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
    const rede = redeFalsa()
    instalar(rede, () => ok(lote({ abertos: [ANA, BRUNO], podeAprovar: false })))
    montar()
    await screen.findByRole('group', { name: 'Aprovação do lote' })
    expect((botaoDeAprovar() as HTMLButtonElement).disabled).toBe(true)
    expect(barra().textContent).toContain('A aprovação ainda não foi liberada. Atualize a tela.')
  })

  it('com `podeAprovar` verdadeiro o botão liga, e o contador diz que está tudo aberto', async () => {
    const rede = redeFalsa()
    instalar(rede, () => ok(lote({ abertos: [ANA, BRUNO], podeAprovar: true })))
    montar()
    await screen.findByRole('group', { name: 'Aprovação do lote' })
    expect((botaoDeAprovar() as HTMLButtonElement).disabled).toBe(false)
    expect(barra().textContent).toContain('Tudo aberto: a aprovação está liberada.')
  })

  it('o lote já decidido não tem barra, e o destaque que ficou fechado não se abre mais', async () => {
    const rede = redeFalsa()
    instalar(rede, () => ok(lote({ abertos: [ANA], estado: 'aprovada' })))
    montar()
    await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })
    expect(screen.queryByRole('group', { name: 'Aprovação do lote' })).toBeNull()
    const itens = screen.getAllByRole('listitem').filter((item) => item.hasAttribute('data-destaque'))
    expect(within(itens[0] as HTMLElement).getByRole('button')).toBeTruthy()
    expect(within(itens[1] as HTMLElement).queryByRole('button')).toBeNull()
  })

  it('um único botão oficial e nenhum primário; "Rejeitar a correção" é o `perigo` de contorno, e o oficial não é laranja', async () => {
    const rede = redeFalsa()
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
    const rede = redeFalsa()
    let liberar: (resposta: RespostaFalsa) => void = () => undefined
    instalar(rede, undefined, { [ANA]: () => new Promise<RespostaFalsa>((resolver) => (liberar = resolver)) })
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
    const rede = redeFalsa()
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
    const rede = redeFalsa()
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
    const rede = redeFalsa()
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
    const rede = redeFalsa()
    instalar(rede, () => ok(lote({ abertos: [ANA] })))
    montar(`ver=${ANA}`, { estrito: true })
    expect(await screen.findByRole('dialog', { name: 'Correção de Ana Sintética' })).toBeTruthy()
    expect(await screen.findByRole('table', { name: 'Respostas de Ana Sintética' })).toBeTruthy()
    expect(aberturasPedidas(rede)).toEqual([caminhoDaAbertura(ANA)])
  })

  it('com uma abertura no ar, o endereço de outro destaque já aberto não manda uma segunda leitura por cima dela', async () => {
    const rede = redeFalsa()
    let liberar: (resposta: RespostaFalsa) => void = () => undefined
    instalar(rede, () => ok(lote({ abertos: [ANA] })), { [BRUNO]: () => new Promise<RespostaFalsa>((resolver) => (liberar = resolver)) })
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
    const rede = redeFalsa()
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
    const rede = redeFalsa()
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
    const rede = redeFalsa()
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

  it('um valor que não é aba cai em Destaques', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar('aba=todas')
    expect(await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Destaques' }).getAttribute('aria-selected')).toBe('true')
  })

  it('trocar de aba usa `replace`: o histórico não ganha passo, e o `?ver=` que estivesse no endereço fica', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede)
    const localizacao = montar(`ver=${id(99)}`)
    await screen.findByRole('region', { name: 'Abra estes 2 antes de aprovar' })
    await usuario.click(screen.getByRole('tab', { name: 'Outras' }))
    expect(localizacao.history).toEqual([`/aprovar/${ATIVIDADE}?ver=${id(99)}&aba=outras`])
    await usuario.click(screen.getByRole('tab', { name: 'Resumo' }))
    expect(localizacao.history).toEqual([`/aprovar/${ATIVIDADE}?ver=${id(99)}&aba=resumo`])
  })

  it('as outras correções saem em ordem de nome, e não na ordem da API nem na de acerto', async () => {
    const rede = redeFalsa()
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
