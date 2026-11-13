// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import type * as Sessao from '../../../api/sessao'
import { STATUS_COLORS } from '../../../components/ui/StatusBadge'
import { dataDaLicenca, diaDeHojeEmSaoPaulo, TEXTO_DA_ENTRADA_INVALIDA_DA_LICENCA } from './licencas'
import Material from './Material'

/**
 * Escola › Material › Licenças (ingestao-do-material, 6.0; RF16 e RF17): os quatro estados, a situação em texto e em cor, as datas por
 * extenso, as licenças criadas automaticamente destacadas, o registro (um pedido só, `ENTRADA_INVALIDA` no campo, a resposta que chega com o diálogo
 * fechado, a falha que não passa à abertura seguinte) e a vigência, que diz quantos materiais saem da busca ou voltam a ela **antes** de
 * confirmar. A rede é falsa e responde por caminho. O que só o navegador mede (a página que não rola, o celular, a pessoa seguinte, o sino
 * com o banco de verdade) é do e2e `material-licencas`.
 */
setupScreen()

// Os ouvintes de troca de sessão que a tela registra, para o teste disparar a troca sem passar pelo login.
const ouvintesDeTroca = vi.hoisted(() => new Set<() => void>())
vi.mock('../../../api/sessao', async (importar) => {
  const real = await importar<typeof Sessao>()
  return {
    ...real,
    aoTrocarDeSessao: (ouvinte: () => void) => {
      ouvintesDeTroca.add(ouvinte)
      const cancelar = real.aoTrocarDeSessao(ouvinte)
      return () => {
        ouvintesDeTroca.delete(ouvinte)
        cancelar()
      }
    },
  }
})

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const licenca = (n: number, parte: Record<string, unknown> = {}) => ({
  id: id(800 + n),
  licenciante: `Editora ${String(n)} Sintética`,
  cobertura: `Coleção ${String(n)}`,
  referencia: `Contrato ${String(n)}`,
  vigenteDesde: '2026-03-01',
  vigenteAte: '2027-12-31',
  situacao: 'vigente',
  materiais: 3,
  registradaEm: '2026-03-01T12:00:00.000Z',
  alteradaEm: '2026-03-01T12:00:00.000Z',
  ...parte,
})
const VIGENTE = licenca(1)
const VENCENDO = licenca(2, { situacao: 'vence_em_30_dias', vigenteAte: '2026-12-14', materiais: 1 })
const VENCIDA = licenca(3, { situacao: 'vencida', vigenteDesde: '2025-01-01', vigenteAte: '2026-01-31', materiais: 5 })
const FUTURA = licenca(4, { situacao: 'futura', vigenteDesde: '2026-12-01', vigenteAte: null, materiais: 0 })
const DA_MIGRACAO = licenca(5, { referencia: 'registrada antes da F4', vigenteAte: null })

const ERRO = (codigo: string, status: number): FakeResponse => ({
  status,
  corpo: { erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } },
})
const FALHA = ERRO('LIMITE_EXCEDIDO', 429)
const ok = (itens: readonly unknown[], extra: Record<string, unknown> = {}): FakeResponse => ({ status: 200, corpo: { itens, ...extra } })
const nuncaResponde = () => new Promise<FakeResponse>(() => undefined)

type Resposta = FakeResponse | (() => FakeResponse | Promise<FakeResponse>)

/** `GET`, `POST` e `PATCH` respondem pelo mesmo prefixo: a resposta recebe o método da chamada que chegou. */
function instalar(rede: FakeNetwork, respostas: { leitura?: Resposta; registro?: Resposta; vigencia?: Resposta } = {}): void {
  const { leitura = ok([VIGENTE, VENCIDA]), registro = { status: 201, corpo: licenca(9) }, vigencia = { status: 200, corpo: licenca(1) } } = respostas
  const dar = (resposta: Resposta) => (typeof resposta === 'function' ? resposta() : resposta)
  rede.responderPor(/\/v1\/licencas/, () => {
    const metodo = rede.chamadas.at(-1)?.metodo
    return dar(metodo === 'POST' ? registro : metodo === 'PATCH' ? vigencia : leitura)
  })
}

const pedidosDe = (rede: FakeNetwork) => rede.chamadas.map((chamada) => `${chamada.metodo} ${chamada.caminho.split('?')[0] ?? ''}`)
const quantos = (rede: FakeNetwork, pedido: string) => pedidosDe(rede).filter((feito) => feito === pedido).length

/** O corpo JSON do último pedido com o método dado. */
function corpoDe(metodo: string): unknown {
  const chamadas = (fetch as unknown as Mock).mock.calls as Array<[string, RequestInit | undefined]>
  const corpo = chamadas.filter(([, opcoes]) => opcoes?.method === metodo).at(-1)?.[1]?.body
  return typeof corpo === 'string' ? JSON.parse(corpo) : undefined
}

function janelaDe(largura: number): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta === '(min-width: 768px)' ? largura >= 768 : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

afterEach(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  janelaDe(1366)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

function montar(endereco = '/material?aba=licencas') {
  const [caminho = '/material', busca = ''] = endereco.split('?')
  const localizacao = memoryLocation({ path: caminho, searchPath: busca, record: true })
  renderScreen(
    <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
      <Material />
    </Router>,
  )
  return localizacao
}

async function montarEEsperar() {
  const localizacao = montar()
  await screen.findByRole('table', { name: 'Lista de licenças' })
  return localizacao
}

const tabela = () => within(screen.getByRole('table', { name: 'Lista de licenças' }))
const linhas = () => tabela().getAllByRole('row').filter((linha) => within(linha).queryAllByRole('columnheader').length === 0)
const linhaDe = (licenciante: string) => {
  const linha = linhas().find((candidata) => candidata.textContent?.includes(licenciante))
  if (linha === undefined) throw new Error(`sem a linha de ${licenciante}`)
  return linha
}
const dialogo = (nome: string) => screen.findByRole('dialog', { name: nome })

/** O texto do que a vigência escrita faz com a busca: a região viva do diálogo (o `FormDialog` tem outra, só do "Salvando…"). */
const efeitoDe = (caixa: ReturnType<typeof within>) => caixa.getAllByRole('status').map((regiao: HTMLElement) => regiao.textContent).join('')

/** O dia de hoje em São Paulo e o de ontem: os dias da vigência que muda o que a busca acha, sem relógio falso (o token da sessão de teste vale pelo relógio real). */
const HOJE = diaDeHojeEmSaoPaulo()
const ONTEM = (() => {
  const dia = new Date(`${HOJE}T00:00:00Z`)
  dia.setUTCDate(dia.getUTCDate() - 1)
  return dia.toISOString().slice(0, 10)
})()

async function preencherORegistro(usuario: ReturnType<typeof userEvent.setup>, parte: { fim?: string; semFim?: boolean } = {}) {
  const caixa = within(await dialogo('Registrar licença'))
  await usuario.type(caixa.getByLabelText('Quem deu a licença'), 'Editora Nova')
  await usuario.type(caixa.getByLabelText('O que a licença cobre'), 'Coleção de Física')
  await usuario.type(caixa.getByLabelText('Documento da licença'), 'Termo 42')
  fireEvent.change(caixa.getByLabelText('Começa em'), { target: { value: '2026-03-01' } })
  if (parte.semFim !== true) fireEvent.change(caixa.getByLabelText('Termina em'), { target: { value: parte.fim ?? '2026-12-31' } })
  return caixa
}

describe('os quatro estados da tela', () => {
  it('carregando: a leitura no ar, sem tabela, sem botão e sem dizer que está vazio', async () => {
    instalar(fakeNetwork(), { leitura: nuncaResponde })
    montar()
    expect(await screen.findByText('Carregando as licenças…')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Registrar licença' })).toBeNull()
    expect(screen.queryByText('Nenhuma licença registrada')).toBeNull()
  })

  it('erro: a mensagem curta e "Tentar de novo", que lê a lista de novo; a falha não afirma o vazio', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhar = true
    instalar(rede, { leitura: () => (falhar ? FALHA : ok([VIGENTE])) })
    montar()
    await screen.findByRole('alert')
    expect(screen.queryByText('Nenhuma licença registrada')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Registrar licença' })).toBeNull()
    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await screen.findByRole('table', { name: 'Lista de licenças' })
    expect(quantos(rede, 'GET /v1/licencas')).toBe(2)
  })

  it('vazio: "Nenhuma licença registrada", com "Registrar licença" como único botão, e nenhuma tabela', async () => {
    instalar(fakeNetwork(), { leitura: ok([]) })
    montar()
    expect(await screen.findByText('Nenhuma licença registrada')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Licenças de material' })).getAllByRole('button').map((botao) => botao.textContent)).toEqual(['Registrar licença'])
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('a releitura que cai com a lista ainda vazia não afirma o vazio: o registro que falhou, com a leitura seguinte também falhando, mostra o erro e "Tentar de novo"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let leituraCai = false
    instalar(rede, { leitura: () => (leituraCai ? FALHA : ok([])), registro: ERRO('INDISPONIVEL_TENTE_DE_NOVO', 503) })
    montar()
    await screen.findByText('Nenhuma licença registrada')
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    await preencherORegistro(usuario)
    leituraCai = true
    await usuario.click(within(await dialogo('Registrar licença')).getByRole('button', { name: 'Registrar licença' }))
    await within(await dialogo('Registrar licença')).findByText('O registro não foi concluído. Confira a lista de licenças antes de tentar de novo.')
    await usuario.click(within(await dialogo('Registrar licença')).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar licença' })).toBeNull())
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(screen.queryByText('Nenhuma licença registrada')).toBeNull()
  })

  it('o primeiro registro, do vazio: o botão que abriu o diálogo sai da tela com o vazio, e o foco vai ao título da lista', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let registrada = false
    const registra = (): FakeResponse => {
      registrada = true
      return { status: 201, corpo: licenca(9, { licenciante: 'Editora Nova' }) }
    }
    instalar(rede, { leitura: () => ok(registrada ? [licenca(9, { licenciante: 'Editora Nova' })] : []), registro: registra })
    montar()
    await screen.findByText('Nenhuma licença registrada')
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    await preencherORegistro(usuario)
    await usuario.click(within(await dialogo('Registrar licença')).getByRole('button', { name: 'Registrar licença' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar licença' })).toBeNull())
    await screen.findByRole('table', { name: 'Lista de licenças' })
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Licenças de material' })))
  })

  it('o vazio com o pedido no ar: o botão do vazio fica desligado e diz que verifica', async () => {
    const usuario = userEvent.setup()
    let liberar: () => void = () => undefined
    const segurado = new Promise<void>((resolver) => (liberar = resolver))
    instalar(fakeNetwork(), { leitura: ok([]), registro: async () => {
        await segurado
        return { status: 201, corpo: licenca(9) }
      } })
    montar()
    await screen.findByText('Nenhuma licença registrada')
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    const caixa = await preencherORegistro(usuario)
    await usuario.click(caixa.getByRole('button', { name: 'Registrar licença' }))
    await usuario.click(caixa.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Registrar licença' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Verificando…')).toBeTruthy()
    liberar()
    await screen.findByText('Licença registrada. Ela já pode ser escolhida no envio de material de terceiro.')
  })

  it('com dado: a tabela em português, com a licença, a situação, a vigência e quantos materiais', async () => {
    instalar(fakeNetwork())
    await montarEEsperar()
    expect(tabela().getAllByRole('columnheader').map((coluna) => coluna.textContent)).toEqual(['Licença', 'Situação', 'Vigência', 'Materiais'])
    expect(screen.getByRole('heading', { name: 'Licenças de material' })).toBeTruthy()
    const celulas = Array.from(linhaDe('Editora 1 Sintética').children).map((celula) => celula.textContent)
    expect(celulas[0]).toContain('Editora 1 Sintética')
    expect(celulas[0]).toContain('Coleção 1')
    expect(celulas[0]).toContain('Documento: Contrato 1')
    expect(celulas[3]).toBe('3 materiais')
  })

  it('a lista que passou do teto de páginas avisa que mostra só as primeiras', async () => {
    instalar(fakeNetwork(), { leitura: () => ok([VIGENTE], { proxima: id(999) }) })
    montar()
    expect(await screen.findByText('A lista é maior do que esta tela mostra: aparecem só os primeiros.')).toBeTruthy()
  })

  it('a 360 px a tabela vira lista, e o botão da vigência continua ali', async () => {
    janelaDe(360)
    instalar(fakeNetwork(), { leitura: ok([VIGENTE]) })
    montar()
    await screen.findByRole('heading', { name: 'Licenças de material' })
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('button', { name: /Mudar a vigência/ })).toBeTruthy()
  })

  it('a releitura que falha com a lista já na tela: a lista fica, a falha é dita e "Tentar de novo" lê de novo', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhar = false
    let segura: Promise<void> = Promise.resolve()
    let liberar: () => void = () => undefined
    const registra = (): FakeResponse => {
      falhar = true
      return { status: 201, corpo: licenca(9) }
    }
    instalar(rede, { leitura: async () => (falhar ? FALHA : (await segura, ok([VIGENTE]))), registro: registra })
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    await preencherORegistro(usuario)
    await usuario.click(within(await dialogo('Registrar licença')).getByRole('button', { name: 'Registrar licença' }))
    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toMatch(/\S/)
    expect(screen.getByRole('table', { name: 'Lista de licenças' })).toBeTruthy()
    falhar = false
    segura = new Promise<void>((resolver) => (liberar = resolver))
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    // A leitura está no ar: a região viva diz que tenta de novo, e quando ela volta a região se esvazia.
    expect(await screen.findByText('Tentando de novo…')).toBeTruthy()
    liberar()
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.queryByText('Tentando de novo…')).toBeNull()
    expect(screen.getByRole('table', { name: 'Lista de licenças' })).toBeTruthy()
  })
})

describe('a situação e as datas', () => {
  it('uma de cada situação, em texto e na cor da família dela, e o que ela faz com a busca', async () => {
    instalar(fakeNetwork(), { leitura: ok([VIGENTE, VENCENDO, VENCIDA, FUTURA]) })
    await montarEEsperar()
    // O selo é o elemento que leva as classes da família: o texto está dentro dele, ao lado do glifo.
    const selo = (licenciante: string, texto: string, familia: keyof typeof STATUS_COLORS) => {
      const fundo = STATUS_COLORS[familia].split(' ')[0] ?? ''
      expect(within(linhaDe(licenciante)).getByText(texto).closest(`.${fundo}`), `${texto} na família ${familia}`).not.toBeNull()
    }
    selo('Editora 1', 'Vigente', 'ok')
    selo('Editora 2', 'Vence em 14/12/2026', 'pendente')
    selo('Editora 3', 'Vencida em 31/01/2026', 'erro')
    selo('Editora 4', 'Começa em 01/12/2026', 'info')
    expect(within(linhaDe('Editora 3')).getByText(/Os materiais dela saíram da busca/)).toBeTruthy()
    expect(within(linhaDe('Editora 1')).getByText('Os materiais dela estão na busca.')).toBeTruthy()
    expect(within(linhaDe('Editora 2')).getByText('Os materiais dela estão na busca.')).toBeTruthy()
  })

  it('as datas em dd/mm/aaaa, cada uma com o rótulo; sem fim, "Sem data de fim"', async () => {
    instalar(fakeNetwork(), { leitura: ok([VIGENTE, FUTURA]) })
    await montarEEsperar()
    const vigencia = (licenciante: string) => within(linhaDe(licenciante))
    expect(vigencia('Editora 1').getByText('Começa em').nextElementSibling?.textContent).toBe('01/03/2026')
    expect(vigencia('Editora 1').getByText('Termina em').nextElementSibling?.textContent).toBe('31/12/2027')
    expect(vigencia('Editora 4').getByText('Termina em').nextElementSibling?.textContent).toBe('Sem data de fim')
  })

  it('as criadas automaticamente são destacadas para revisão, e só elas; a faixa diz quantas', async () => {
    instalar(fakeNetwork(), { leitura: ok([VIGENTE, DA_MIGRACAO]) })
    await montarEEsperar()
    expect(within(linhaDe('Editora 5')).getByText('Criada automaticamente · revise')).toBeTruthy()
    expect(within(linhaDe('Editora 1')).queryByText(/Criada automaticamente/)).toBeNull()
    expect(screen.getByText('Uma licença foi criada a partir do nome da editora de cada material')).toBeTruthy()
  })

  it('a licença criada automaticamente diz "Documento: não informado", e a tela não mostra o nome de fase nem de migração', async () => {
    instalar(fakeNetwork(), { leitura: ok([VIGENTE, DA_MIGRACAO]) })
    await montarEEsperar()
    expect(within(linhaDe('Editora 5')).getByText('Documento: não informado')).toBeTruthy()
    expect(within(linhaDe('Editora 1')).getByText('Documento: Contrato 1')).toBeTruthy()
    expect(linhaDe('Editora 5').textContent).not.toMatch(/F4/)
    expect(document.body.textContent).not.toMatch(/F4|migra[cç]/i)
  })

  it('duas ou mais licenças criadas automaticamente: a faixa diz quantas, no plural', async () => {
    instalar(fakeNetwork(), { leitura: ok([VIGENTE, DA_MIGRACAO, licenca(6, { referencia: 'registrada antes da F4', vigenteAte: null })]) })
    await montarEEsperar()
    expect(screen.getByText('2 licenças foram criadas a partir do nome da editora de cada material')).toBeTruthy()
  })

  it('sem nenhuma licença criada automaticamente, sem a faixa', async () => {
    instalar(fakeNetwork(), { leitura: ok([VIGENTE]) })
    await montarEEsperar()
    expect(screen.queryByText(/criadas? a partir do nome da editora/)).toBeNull()
  })
})

describe('mudar a vigência', () => {
  it('mostra quantos materiais saem da busca antes de confirmar, e só então manda o PATCH, uma vez, com a vigência escrita', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let alterada = false
    const altera = (): FakeResponse => {
      alterada = true
      return { status: 200, corpo: licenca(3) }
    }
    instalar(rede, { leitura: () => ok([alterada ? licenca(3, { situacao: 'vencida', vigenteAte: ONTEM, materiais: 5 }) : licenca(3, { materiais: 5 })]), vigencia: altera })
    await montarEEsperar()
    await usuario.click(within(linhaDe('Editora 3')).getByRole('button', { name: /Mudar a vigência/ }))
    const caixa = within(await dialogo('Mudar a vigência'))
    expect((caixa.getByLabelText('Começa em') as HTMLInputElement).value).toBe('2026-03-01')
    expect((caixa.getByLabelText('Termina em') as HTMLInputElement).value).toBe('2027-12-31')
    expect(efeitoDe(caixa)).toMatch(/^5 materiais continuam onde estão na busca/)

    fireEvent.change(caixa.getByLabelText('Termina em'), { target: { value: ONTEM } })
    expect(efeitoDe(caixa)).toBe('5 materiais saem da busca do Assistente e do Tutor. O que já foi gerado continua citando a página.')
    // Ainda não confirmou: nenhum PATCH.
    expect(quantos(rede, 'PATCH /v1/licencas/' + id(803))).toBe(0)

    await usuario.dblClick(caixa.getByRole('button', { name: 'Salvar vigência' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mudar a vigência' })).toBeNull())
    expect(quantos(rede, 'PATCH /v1/licencas/' + id(803))).toBe(1)
    expect(corpoDe('PATCH')).toEqual({ vigenteDesde: '2026-03-01', vigenteAte: ONTEM })
    expect(screen.getByText('Vigência alterada. A busca do Assistente e do Tutor já segue a vigência nova.')).toBeTruthy()
    expect(within(linhaDe('Editora 3')).getByText(`Vencida em ${dataDaLicenca(ONTEM)}`)).toBeTruthy()
  })

  it('a licença vencida com o fim levado para frente: os materiais voltam, e o fim vazio vai como nulo', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { leitura: ok([VENCIDA]) })
    await montarEEsperar()
    await usuario.click(within(linhaDe('Editora 3')).getByRole('button', { name: /Mudar a vigência/ }))
    const caixa = within(await dialogo('Mudar a vigência'))
    expect(efeitoDe(caixa)).toMatch(/^5 materiais continuam onde estão/)
    fireEvent.change(caixa.getByLabelText('Termina em'), { target: { value: '' } })
    expect(efeitoDe(caixa)).toBe('5 materiais voltam à busca do Assistente e do Tutor, sem reenviar.')
    await usuario.click(caixa.getByRole('button', { name: 'Salvar vigência' }))
    await waitFor(() => expect(corpoDe('PATCH')).toEqual({ vigenteDesde: '2025-01-01', vigenteAte: null }))
  })

  it('o fim antes do começo: o erro no campo do fim, sem PATCH, e o texto do efeito some', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { leitura: ok([VIGENTE]) })
    await montarEEsperar()
    await usuario.click(within(linhaDe('Editora 1')).getByRole('button', { name: /Mudar a vigência/ }))
    const caixa = within(await dialogo('Mudar a vigência'))
    fireEvent.change(caixa.getByLabelText('Termina em'), { target: { value: '2026-01-01' } })
    expect(efeitoDe(caixa)).toBe('')
    // Antes de confirmar, o erro ainda não aparece: a pessoa não tentou salvar.
    expect(caixa.queryByText('O fim da vigência não pode vir antes do começo.')).toBeNull()
    await usuario.click(caixa.getByRole('button', { name: 'Salvar vigência' }))
    expect(caixa.getByText('O fim da vigência não pode vir antes do começo.')).toBeTruthy()
    expect(caixa.getByLabelText('Termina em').getAttribute('aria-invalid')).toBe('true')
    expect(quantos(rede, 'PATCH /v1/licencas/' + id(801))).toBe(0)
  })

  it('a licença sem fim abre com o fim vazio, e salvar sem mexer manda o fim nulo', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { leitura: ok([FUTURA]) })
    await montarEEsperar()
    await usuario.click(within(linhaDe('Editora 4')).getByRole('button', { name: /Mudar a vigência/ }))
    const caixa = within(await dialogo('Mudar a vigência'))
    expect((caixa.getByLabelText('Começa em') as HTMLInputElement).value).toBe('2026-12-01')
    expect((caixa.getByLabelText('Termina em') as HTMLInputElement).value).toBe('')
    await usuario.click(caixa.getByRole('button', { name: 'Salvar vigência' }))
    await waitFor(() => expect(corpoDe('PATCH')).toEqual({ vigenteDesde: '2026-12-01', vigenteAte: null }))
  })

  it('a falha que não é a da licença fora da lista: o aviso no alerta, e "Salvar vigência" continua para tentar de novo', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { leitura: ok([VIGENTE]), vigencia: ERRO('INDISPONIVEL_TENTE_DE_NOVO', 503) })
    await montarEEsperar()
    await usuario.click(within(linhaDe('Editora 1')).getByRole('button', { name: /Mudar a vigência/ }))
    const caixa = within(await dialogo('Mudar a vigência'))
    await usuario.click(caixa.getByRole('button', { name: 'Salvar vigência' }))
    expect((await caixa.findByRole('alert')).textContent).toMatch(/\S/)
    expect(caixa.getByRole('button', { name: 'Salvar vigência' })).toBeTruthy()
    expect(caixa.queryByText('Esta licença não está mais na lista. Nada foi alterado.')).toBeNull()
  })

  it('a licença que saiu da lista (NAO_ENCONTRADO): a falha diz, a lista é relida e só sobra "Fechar"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { leitura: ok([VIGENTE]), vigencia: ERRO('NAO_ENCONTRADO', 404) })
    await montarEEsperar()
    await usuario.click(within(linhaDe('Editora 1')).getByRole('button', { name: /Mudar a vigência/ }))
    const caixa = within(await dialogo('Mudar a vigência'))
    await usuario.click(caixa.getByRole('button', { name: 'Salvar vigência' }))
    expect(await caixa.findByText('Esta licença não está mais na lista. Nada foi alterado.')).toBeTruthy()
    expect(caixa.queryByRole('button', { name: 'Salvar vigência' })).toBeNull()
    expect(caixa.getByRole('button', { name: 'Fechar' })).toBeTruthy()
    await waitFor(() => expect(quantos(rede, 'GET /v1/licencas')).toBe(2))
  })
})

describe('registrar uma licença', () => {
  it('o formulário vazio: o erro de cada campo, o foco no primeiro, e nenhum pedido', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { leitura: ok([VIGENTE]) })
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    const caixa = within(await dialogo('Registrar licença'))
    // Antes de tentar registrar, nenhum erro: o formulário vazio é um convite, não uma bronca.
    expect(caixa.queryByText(/Diga quem deu a licença/)).toBeNull()
    expect(caixa.queryByText(TEXTO_DA_ENTRADA_INVALIDA_DA_LICENCA)).toBeNull()
    await usuario.click(caixa.getByRole('button', { name: 'Registrar licença' }))
    expect(caixa.getByText(/Diga quem deu a licença/)).toBeTruthy()
    expect(caixa.getByText('Diga o que a licença cobre.')).toBeTruthy()
    expect(caixa.getByText(/Indique o documento/)).toBeTruthy()
    expect(caixa.getByText('Escolha o dia em que a licença começa.')).toBeTruthy()
    expect(document.activeElement).toBe(caixa.getByLabelText('Quem deu a licença'))
    expect(quantos(rede, 'POST /v1/licencas')).toBe(0)
  })

  it('o caminho feliz: um POST com o que foi escrito (o fim vazio como nulo), o diálogo fecha, a lista é relida e o anúncio diz', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let registrada = false
    const registra = (): FakeResponse => {
      registrada = true
      return { status: 201, corpo: licenca(9, { licenciante: 'Editora Nova' }) }
    }
    instalar(rede, { leitura: () => ok(registrada ? [VIGENTE, licenca(9, { licenciante: 'Editora Nova' })] : [VIGENTE]), registro: registra })
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    await preencherORegistro(usuario, { semFim: true })
    await usuario.click(within(await dialogo('Registrar licença')).getByRole('button', { name: 'Registrar licença' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar licença' })).toBeNull())
    expect(quantos(rede, 'POST /v1/licencas')).toBe(1)
    expect(corpoDe('POST')).toEqual({ licenciante: 'Editora Nova', cobertura: 'Coleção de Física', referencia: 'Termo 42', vigenteDesde: '2026-03-01', vigenteAte: null })
    expect(screen.getByText('Licença registrada. Ela já pode ser escolhida no envio de material de terceiro.')).toBeTruthy()
    expect(within(linhaDe('Editora Nova')).getByText('3 materiais')).toBeTruthy()
  })

  it('clique duplo em registrar: um POST só, e o botão diz que está registrando e fica desligado', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let liberar: () => void = () => undefined
    const segurado = new Promise<void>((resolver) => (liberar = resolver))
    instalar(rede, { leitura: ok([VIGENTE]), registro: async () => {
        await segurado
        return { status: 201, corpo: licenca(9) }
      } })
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    const caixa = await preencherORegistro(usuario)
    await usuario.dblClick(caixa.getByRole('button', { name: 'Registrar licença' }))
    expect(quantos(rede, 'POST /v1/licencas')).toBe(1)
    expect(caixa.getByRole('button', { name: 'Registrando…' }).hasAttribute('disabled')).toBe(true)
    liberar()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar licença' })).toBeNull())
    expect(quantos(rede, 'POST /v1/licencas')).toBe(1)
  })

  it('o diálogo fechado com o pedido no ar: o botão da tela fica desligado, não sai um segundo POST, e a resposta atrasada só anuncia', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let liberar: () => void = () => undefined
    const segurado = new Promise<void>((resolver) => (liberar = resolver))
    instalar(rede, { leitura: ok([VIGENTE]), registro: async () => {
        await segurado
        return { status: 201, corpo: licenca(9) }
      } })
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    const caixa = await preencherORegistro(usuario)
    await usuario.click(caixa.getByRole('button', { name: 'Registrar licença' }))
    await usuario.click(caixa.getByRole('button', { name: 'Cancelar' }))
    const naTela = screen.getByRole('button', { name: 'Registrando…' })
    expect(naTela.hasAttribute('disabled')).toBe(true)
    await usuario.click(naTela)
    expect(screen.queryByRole('dialog', { name: 'Registrar licença' })).toBeNull()
    expect(quantos(rede, 'POST /v1/licencas')).toBe(1)
    liberar()
    expect(await screen.findByText('Licença registrada. Ela já pode ser escolhida no envio de material de terceiro.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Registrar licença' }).hasAttribute('disabled')).toBe(false)
  })

  it('a resposta atrasada não fecha o diálogo de outra abertura: o que a pessoa já digitou nele fica', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let liberar: () => void = () => undefined
    const segurado = new Promise<void>((resolver) => (liberar = resolver))
    instalar(rede, { leitura: ok([VIGENTE]), registro: async () => {
        await segurado
        return { status: 201, corpo: licenca(9) }
      } })
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    const primeira = await preencherORegistro(usuario)
    await usuario.click(primeira.getByRole('button', { name: 'Registrar licença' }))
    await usuario.click(primeira.getByRole('button', { name: 'Cancelar' }))
    // A vigência de outra licença abre por cima do que a tela tem: é uma abertura nova, com o que a pessoa escreve nela.
    await usuario.click(within(linhaDe('Editora 1')).getByRole('button', { name: /Mudar a vigência/ }))
    const outra = within(await dialogo('Mudar a vigência'))
    // Abrir outro diálogo com o pedido no ar não solta o pedido: a tela continua dizendo que registra.
    expect(screen.getByRole('button', { name: 'Registrando…' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(outra.getByLabelText('Termina em'), { target: { value: '2028-01-31' } })
    liberar()
    await screen.findByText('Licença registrada. Ela já pode ser escolhida no envio de material de terceiro.')
    expect(screen.getByRole('dialog', { name: 'Mudar a vigência' })).toBeTruthy()
    expect((outra.getByLabelText('Termina em') as HTMLInputElement).value).toBe('2028-01-31')
  })

  it('ENTRADA_INVALIDA da API: o erro no campo do fim, com o diálogo aberto e o que foi escrito mantido', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { leitura: ok([VIGENTE]), registro: ERRO('ENTRADA_INVALIDA', 400) })
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    const caixa = await preencherORegistro(usuario)
    expect(caixa.queryByText(TEXTO_DA_ENTRADA_INVALIDA_DA_LICENCA)).toBeNull()
    await usuario.click(caixa.getByRole('button', { name: 'Registrar licença' }))
    expect(await caixa.findByText(TEXTO_DA_ENTRADA_INVALIDA_DA_LICENCA)).toBeTruthy()
    expect(caixa.getByLabelText('Termina em').getAttribute('aria-invalid')).toBe('true')
    expect(caixa.queryByRole('alert')).toBeNull()
    expect((caixa.getByLabelText('Quem deu a licença') as HTMLInputElement).value).toBe('Editora Nova')
    expect(caixa.getByRole('button', { name: 'Registrar licença' }).hasAttribute('disabled')).toBe(false)
  })

  it('a falha com o diálogo aberto: o aviso no alerta; ao fechar e abrir de novo, o formulário é novo e o aviso da tentativa anterior sai', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { leitura: ok([VIGENTE]), registro: ERRO('INDISPONIVEL_TENTE_DE_NOVO', 503) })
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    const caixa = await preencherORegistro(usuario)
    await usuario.click(caixa.getByRole('button', { name: 'Registrar licença' }))
    const alerta = await caixa.findByRole('alert')
    expect(alerta.textContent).toBe('O registro não foi concluído. Confira a lista de licenças antes de tentar de novo.')
    expect(document.activeElement).toBe(alerta)
    // Uma falha, um aviso: a da tela (diálogo fechado) não repete a do diálogo aberto, e o campo do fim não leva o texto da entrada recusada.
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByText(/A licença não foi registrada/)).toBeNull()
    expect(caixa.queryByText(TEXTO_DA_ENTRADA_INVALIDA_DA_LICENCA)).toBeNull()
    await usuario.click(caixa.getByRole('button', { name: 'Cancelar' }))
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    const nova = within(await dialogo('Registrar licença'))
    expect(nova.queryByRole('alert')).toBeNull()
    expect((nova.getByLabelText('Quem deu a licença') as HTMLInputElement).value).toBe('')
    // A falha também mandou reler a lista: o pedido pode ter chegado.
    expect(quantos(rede, 'GET /v1/licencas')).toBe(2)
  })

  it('a falha que chega com o diálogo já fechado aparece na tela, e some ao abrir de novo', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhar: () => void = () => undefined
    const segurado = new Promise<void>((resolver) => (falhar = resolver))
    instalar(rede, { leitura: ok([VIGENTE]), registro: async () => {
        await segurado
        return ERRO('INDISPONIVEL_TENTE_DE_NOVO', 503)
      } })
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    const caixa = await preencherORegistro(usuario)
    await usuario.click(caixa.getByRole('button', { name: 'Registrar licença' }))
    await usuario.click(caixa.getByRole('button', { name: 'Cancelar' }))
    falhar()
    expect((await screen.findByRole('alert')).textContent).toBe('A licença não foi registrada. Confira a lista antes de tentar de novo: se o pedido chegou, ela já está aqui.')
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    await dialogo('Registrar licença')
    expect(screen.queryByText(/A licença não foi registrada/)).toBeNull()
  })
})

describe('a sessão que troca', () => {
  it('o diálogo aberto fecha, e o anúncio e a falha da pessoa anterior não passam à seguinte', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { leitura: ok([VIGENTE]) })
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    await dialogo('Registrar licença')
    act(() => {
      for (const ouvinte of ouvintesDeTroca) ouvinte()
    })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar licença' })).toBeNull())
  })

  it('a troca de sessão apaga o anúncio do registro da pessoa anterior', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork(), { leitura: ok([VIGENTE]) })
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    await preencherORegistro(usuario)
    await usuario.click(within(await dialogo('Registrar licença')).getByRole('button', { name: 'Registrar licença' }))
    expect(await screen.findByText('Licença registrada. Ela já pode ser escolhida no envio de material de terceiro.')).toBeTruthy()
    act(() => {
      for (const ouvinte of ouvintesDeTroca) ouvinte()
    })
    await waitFor(() => expect(screen.queryByText(/Licença registrada\./)).toBeNull())
  })

  it('a troca de sessão apaga a falha do registro da pessoa anterior, que chegou com o diálogo fechado', async () => {
    const usuario = userEvent.setup()
    let falhar: () => void = () => undefined
    const segurado = new Promise<void>((resolver) => (falhar = resolver))
    instalar(fakeNetwork(), { leitura: ok([VIGENTE]), registro: async () => {
        await segurado
        return ERRO('INDISPONIVEL_TENTE_DE_NOVO', 503)
      } })
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Registrar licença' }))
    const caixa = await preencherORegistro(usuario)
    await usuario.click(caixa.getByRole('button', { name: 'Registrar licença' }))
    await usuario.click(caixa.getByRole('button', { name: 'Cancelar' }))
    falhar()
    expect(await screen.findByText(/A licença não foi registrada/)).toBeTruthy()
    act(() => {
      for (const ouvinte of ouvintesDeTroca) ouvinte()
    })
    await waitFor(() => expect(screen.queryByText(/A licença não foi registrada/)).toBeNull())
  })
})

describe('a aba no endereço', () => {
  it('?aba=licencas abre a aba Licenças, selecionada; sem o parâmetro abre Materiais', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    rede.responderPor('/v1/materiais', ok([]))
    rede.responderPor('/v1/disciplinas', ok([]))
    montar('/material?aba=licencas')
    await screen.findByRole('heading', { name: 'Licenças de material' })
    expect(screen.getByRole('tab', { name: 'Licenças' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Materiais' }).getAttribute('aria-selected')).toBe('false')
  })

  it('trocar de aba troca só o parâmetro, e a aba Materiais não lê licenças', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    rede.responderPor('/v1/materiais', ok([]))
    rede.responderPor('/v1/disciplinas', ok([]))
    const localizacao = montar('/material')
    await screen.findByText('Nenhum material ainda')
    expect(quantos(rede, 'GET /v1/licencas')).toBe(0)
    await usuario.click(screen.getByRole('tab', { name: 'Licenças' }))
    await screen.findByRole('heading', { name: 'Licenças de material' })
    expect(localizacao.history?.at(-1)).toBe('/material?aba=licencas')
    await usuario.click(screen.getByRole('tab', { name: 'Materiais' }))
    await screen.findByText('Nenhum material ainda')
    expect(localizacao.history?.at(-1)).toBe('/material')
  })
})
