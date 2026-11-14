// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import Material from './Material'

/**
 * O painel do material com os capítulos, a correção de título e séries e a edição nova (ingestao-do-material, 12.0; RF4, RF6, RF10; `cenarios.md`, "Telas"): os capítulos e o "sem capítulo", o `PATCH` só do que mudou, o clique
 * duplo que manda um pedido só, o painel sem o que a edição em leitura recusa, e o texto de cada falha. A rede é falsa e responde por caminho; o que só o navegador mede (o recomeço de um material para outro com a resposta
 * atrasada, o professor que não vê nada disso, o 1366 × 768 que não rola, o PDF e o banco de verdade) é do e2e `material-painel`.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const QUIMICA = { id: id(500), nome: 'Química', area: null }
const SERIE_6 = { id: id(600), etapa: 'ef_anos_finais', ano: 6 }
const SERIE_7 = { id: id(601), etapa: 'ef_anos_finais', ano: 7 }
const material = (n: number, parte: Record<string, unknown> = {}) => ({
  id: id(n),
  titulo: `Material ${String(n)}`,
  disciplinaId: QUIMICA.id,
  titularidade: 'escola',
  licenciante: null,
  licencaId: null,
  edicao: null,
  substitui: null,
  serieIds: [SERIE_6.id],
  licenca: 'autoria_da_escola',
  estado: 'pronto',
  falha: null,
  paginas: 12,
  trechos: 12,
  enviadoEm: '2026-10-04T12:00:00.000Z',
  ...parte,
})
const PRONTO = material(1, { titulo: 'Apostila de Química' })
const CAPITULOS = [
  { ordem: 1, numero: 1, titulo: 'Substâncias e misturas', paginaInicial: 1, paginaFinal: 5 },
  { ordem: 2, numero: null, titulo: 'Apêndice', paginaInicial: 6, paginaFinal: 6 },
]

const ERRO = (codigo: string, status: number, cabecalhos?: Record<string, string>): FakeResponse => ({
  status,
  corpo: { erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } },
  ...(cabecalhos === undefined ? {} : { cabecalhos }),
})
const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const lista = (itens: readonly unknown[]): FakeResponse => ok({ itens })

interface Cenario {
  readonly materiais?: readonly unknown[]
  /** Os capítulos do `GET /v1/materiais/<id>`; `ERRO` quando a leitura cai. */
  readonly detalhe?: (alvo: string) => FakeResponse
  /** A resposta do `PATCH` e do `POST /v1/materiais/<id>/edicoes`, por chamada. */
  readonly escrita?: (metodo: string) => FakeResponse | Promise<FakeResponse>
}

function instalar(rede: FakeNetwork, { materiais = [PRONTO], detalhe, escrita }: Cenario = {}): void {
  rede.responderPor('/v1/series', lista([SERIE_6, SERIE_7]))
  rede.responderPor('/v1/licencas', lista([]))
  rede.responderPor('/v1/materiais/resumo', ok({ linhas: [], semSerie: 0 }))
  rede.responderPor('/v1/disciplinas', lista([QUIMICA]))
  rede.responderPor('/v1/materiais', () => lista(materiais))
  rede.responderPor(/^\/v1\/materiais\/[0-9a-f-]{36}\/edicoes$/, () => escrita?.('POST') ?? { status: 201, corpo: material(9, { estado: 'processando', substitui: PRONTO.id, paginas: null, trechos: 0 }) })
  rede.responderPor(/^\/v1\/materiais\/[0-9a-f-]{36}$/, (caminho) => {
    const metodo = rede.chamadas.at(-1)?.metodo ?? 'GET'
    if (metodo === 'PATCH') return escrita?.('PATCH') ?? ok({ ...PRONTO, titulo: 'Novo título' })
    const alvo = caminho.split('/').at(-1) ?? ''
    return detalhe?.(alvo) ?? ok({ ...(materiais.find((candidato) => (candidato as { id: string }).id === alvo) ?? PRONTO), capitulos: CAPITULOS })
  })
}

function janelaDe(largura: number): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta === '(min-width: 768px)' ? largura >= 768 : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

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

function montar(endereco: string) {
  const [caminho = '/material', busca = ''] = endereco.split('?')
  const localizacao = memoryLocation({ path: caminho, searchPath: busca, record: true })
  renderScreen(
    <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
      <Material />
    </Router>,
  )
  return localizacao
}

/** O painel do material, aberto pelo endereço. */
async function painelAberto(titulo: string, material: { readonly id: string }) {
  montar(`/material?material=${material.id}`)
  return within(await screen.findByRole('dialog', { name: titulo }))
}

const pedidosDe = (rede: FakeNetwork) => rede.chamadas.map((chamada) => `${chamada.metodo} ${chamada.caminho.split('?')[0] ?? ''}`)
const quantos = (rede: FakeNetwork, pedido: string) => pedidosDe(rede).filter((feito) => feito === pedido).length

/** O corpo do `PATCH` que a tela mandou. */
function corpoDoPatch(): unknown {
  const chamadas = (fetch as unknown as Mock).mock.calls as Array<[string, RequestInit | undefined]>
  const corpo = chamadas.find(([, opcoes]) => opcoes?.method === 'PATCH')?.[1]?.body
  return typeof corpo === 'string' ? JSON.parse(corpo) : undefined
}

describe('os capítulos', () => {
  it('o material pronto lista os capítulos em ordem, com o número que o PDF escreve e as páginas', async () => {
    instalar(fakeNetwork())
    const painel = await painelAberto('Apostila de Química', PRONTO)
    const secao = within(await painel.findByRole('region', { name: 'Capítulos' }))
    const itens = await secao.findAllByRole('listitem')
    expect(itens.map((item) => item.textContent)).toEqual(['Capítulo 1 · Substâncias e misturasPáginas 1 a 5', 'ApêndicePágina 6'])
  })

  it('o PDF sem capítulo diz isso, em vez de uma lista vazia', async () => {
    instalar(fakeNetwork(), { detalhe: () => ok({ ...PRONTO, capitulos: [] }) })
    const painel = await painelAberto('Apostila de Química', PRONTO)
    const secao = within(await painel.findByRole('region', { name: 'Capítulos' }))
    expect(await secao.findByText(/não tem capítulos que a leitura reconheça/)).toBeTruthy()
    expect(secao.queryByRole('list')).toBeNull()
  })

  it('a leitura dos capítulos que cai diz o que aconteceu, e "Tentar de novo" lê de novo', async () => {
    const usuario = userEvent.setup()
    let falha = true
    const rede = fakeNetwork()
    instalar(rede, { detalhe: () => (falha ? ERRO('LIMITE_EXCEDIDO', 429) : ok({ ...PRONTO, capitulos: CAPITULOS })) })
    const painel = await painelAberto('Apostila de Química', PRONTO)
    const secao = within(await painel.findByRole('region', { name: 'Capítulos' }))
    expect((await secao.findByRole('alert')).textContent).toBe('Não foi possível ler os capítulos.')
    falha = false
    await usuario.click(secao.getByRole('button', { name: /Tentar de novo/ }))
    expect((await secao.findAllByRole('listitem')).length).toBe(2)
  })

  it('enquanto os capítulos são lidos, a seção diz que está carregando', async () => {
    instalar(fakeNetwork(), { detalhe: () => new Promise<FakeResponse>(() => undefined) as unknown as FakeResponse })
    const painel = await painelAberto('Apostila de Química', PRONTO)
    const secao = within(await painel.findByRole('region', { name: 'Capítulos' }))
    expect((await secao.findByRole('status')).textContent).toBe('Carregando os capítulos…')
  })

  it('o material ainda sendo lido não pede capítulos à API e diz que eles aparecem quando a leitura terminar', async () => {
    const lendo = material(3, { titulo: 'Em leitura', estado: 'processando', paginas: null, trechos: 0 })
    const rede = fakeNetwork()
    instalar(rede, { materiais: [lendo] })
    const painel = await painelAberto('Em leitura', lendo)
    expect(within(await painel.findByRole('region', { name: 'Capítulos' })).getByText('Os capítulos aparecem quando a leitura terminar.')).toBeTruthy()
    expect(quantos(rede, `GET /v1/materiais/${lendo.id}`)).toBe(0)
  })

  it('o material que falhou não tem a seção de capítulos', async () => {
    const falhou = material(4, { titulo: 'Sem texto', estado: 'falhou', falha: 'sem_texto', paginas: null, trechos: 0 })
    instalar(fakeNetwork(), { materiais: [falhou] })
    const painel = await painelAberto('Sem texto', falhou)
    expect(painel.queryByRole('region', { name: 'Capítulos' })).toBeNull()
  })
})

describe('corrigir título e séries', () => {
  it('"Salvar alterações" só liga com alguma mudança, e o `PATCH` leva só o que mudou', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    const painel = await painelAberto('Apostila de Química', PRONTO)
    const salvar = painel.getByRole('button', { name: 'Salvar alterações' }) as HTMLButtonElement
    expect(salvar.disabled).toBe(true)
    const campo = painel.getByLabelText('Título')
    await usuario.clear(campo)
    await usuario.type(campo, '  Novo título ')
    expect(salvar.disabled).toBe(false)
    await usuario.click(salvar)
    await waitFor(() => expect(quantos(rede, `PATCH /v1/materiais/${PRONTO.id}`)).toBe(1))
    // Só o título mudou: as séries não vão no pedido, e o título vai sem os espaços das pontas.
    expect(corpoDoPatch()).toEqual({ titulo: 'Novo título' })
    expect(await painel.findByText('Alterações salvas. A busca do Assistente e do Tutor já usa as séries novas.')).toBeTruthy()
  })

  it('marcar outra série manda só as séries, e a mensagem de salvo recebe o foco', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { escrita: () => ok({ ...PRONTO, serieIds: [SERIE_6.id, SERIE_7.id] }) })
    const painel = await painelAberto('Apostila de Química', PRONTO)
    await usuario.click(await painel.findByLabelText(/^7º ano/))
    await usuario.click(painel.getByRole('button', { name: 'Salvar alterações' }))
    const aviso = await painel.findByText('Alterações salvas. A busca do Assistente e do Tutor já usa as séries novas.')
    expect(corpoDoPatch()).toEqual({ serieIds: [SERIE_6.id, SERIE_7.id] })
    await waitFor(() => expect(document.activeElement).toBe(aviso))
  })

  it('sem nenhuma série ou com o título vazio, a tela diz o que fazer e nenhum pedido sai', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    const painel = await painelAberto('Apostila de Química', PRONTO)
    await usuario.click(await painel.findByLabelText(/^6º ano/))
    await usuario.clear(painel.getByLabelText('Título'))
    // O erro só aparece depois de a pessoa tentar salvar: antes disso o formulário não a repreende.
    expect(painel.queryByText(/Marque ao menos uma série/)).toBeNull()
    expect(painel.queryByText(/Dê um título ao material/)).toBeNull()
    await usuario.click(painel.getByRole('button', { name: 'Salvar alterações' }))
    expect(painel.getByText(/Marque ao menos uma série/)).toBeTruthy()
    expect(painel.getByText(/Dê um título ao material/)).toBeTruthy()
    expect(quantos(rede, `PATCH /v1/materiais/${PRONTO.id}`)).toBe(0)
  })

  it('o clique duplo em "Salvar alterações" manda um `PATCH` só', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { escrita: () => new Promise<FakeResponse>(() => undefined) })
    const painel = await painelAberto('Apostila de Química', PRONTO)
    const campo = painel.getByLabelText('Título')
    await usuario.clear(campo)
    await usuario.type(campo, 'Outro título')
    const formulario = painel.getByRole('form', { name: 'Corrigir título e séries' })
    // Dois envios do formulário no mesmo instante, como o clique duplo e o Enter: só o primeiro sai.
    fireEvent.submit(formulario)
    fireEvent.submit(formulario)
    await waitFor(() => expect(quantos(rede, `PATCH /v1/materiais/${PRONTO.id}`)).toBe(1))
    const botao = await painel.findByRole('button', { name: 'Salvando…' })
    expect((botao as HTMLButtonElement).disabled).toBe(true)
    expect(quantos(rede, `PATCH /v1/materiais/${PRONTO.id}`)).toBe(1)
  })

  it('o material com edição em leitura não se corrige nem recebe outra edição, e a tela diz por quê', async () => {
    const edicao = material(2, { titulo: 'Apostila 2027', estado: 'processando', substitui: PRONTO.id, paginas: null, trechos: 0 })
    instalar(fakeNetwork(), { materiais: [PRONTO, edicao] })
    const painel = await painelAberto('Apostila de Química', PRONTO)
    const motivo = await painel.findByText('Espere a edição em processamento terminar.')
    expect(motivo).toBeTruthy()
    // O motivo vem **antes** dos campos desligados (no celular, a pessoa o lê sem rolar até depois deles).
    expect(motivo.compareDocumentPosition(painel.getByLabelText('Título')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect((painel.getByRole('button', { name: 'Salvar alterações' }) as HTMLButtonElement).disabled).toBe(true)
    // O `fieldset` desligado desliga o campo: `:disabled`, e não a propriedade do próprio campo.
    expect(painel.getByLabelText('Título').matches(':disabled')).toBe(true)
    expect(painel.queryByRole('button', { name: 'Enviar edição nova' })).toBeNull()
  })

  it('a edição que ainda está sendo lida também não se corrige: ela é a edição em leitura', async () => {
    const edicao = material(2, { titulo: 'Apostila 2027', estado: 'processando', substitui: PRONTO.id, paginas: null, trechos: 0 })
    instalar(fakeNetwork(), { materiais: [PRONTO, edicao] })
    const painel = await painelAberto('Apostila 2027', edicao)
    expect(await painel.findByText('Espere a edição em processamento terminar.')).toBeTruthy()
    // O `fieldset` desligado desliga o campo: `:disabled`, e não a propriedade do próprio campo.
    expect(painel.getByLabelText('Título').matches(':disabled')).toBe(true)
  })

  it('o `PATCH` recusado por `EDICAO_EM_ANDAMENTO` diz o texto da tela e relê a lista', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const materiais: unknown[] = [PRONTO]
    // A edição começa enquanto a pessoa digita: o `PATCH` é recusado e a lista relida já a traz.
    instalar(rede, {
      materiais,
      escrita: () => {
        materiais.push(material(2, { titulo: 'Apostila 2027', estado: 'processando', substitui: PRONTO.id, paginas: null, trechos: 0 }))
        return ERRO('EDICAO_EM_ANDAMENTO', 409)
      },
    })
    const painel = await painelAberto('Apostila de Química', PRONTO)
    const campo = painel.getByLabelText('Título')
    await usuario.clear(campo)
    await usuario.type(campo, 'Outro título')
    const antes = quantos(rede, 'GET /v1/materiais')
    await usuario.click(painel.getByRole('button', { name: 'Salvar alterações' }))
    const alerta = await painel.findByRole('alert')
    expect(alerta.textContent).toBe('Espere a edição em processamento terminar.')
    await waitFor(() => expect(quantos(rede, 'GET /v1/materiais')).toBeGreaterThan(antes))
    // O que a pessoa digitou continua no campo, mas salvar já não se oferece: há edição em leitura, e só ela desliga o botão com o rascunho mudado.
    expect((painel.getByLabelText('Título') as HTMLInputElement).value).toBe('Outro título')
    await waitFor(() => expect((painel.getByRole('button', { name: 'Salvar alterações' }) as HTMLButtonElement).disabled).toBe(true))
  })

  it('o 429 do `PATCH` diz a hora em que dá para tentar de novo', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork(), { escrita: () => ERRO('LIMITE_EXCEDIDO', 429, { 'Retry-After': '600' }) })
    const painel = await painelAberto('Apostila de Química', PRONTO)
    const campo = painel.getByLabelText('Título')
    await usuario.clear(campo)
    await usuario.type(campo, 'Outro título')
    await usuario.click(painel.getByRole('button', { name: 'Salvar alterações' }))
    expect((await painel.findByRole('alert')).textContent).toMatch(/^Muitas alterações por agora\. Tente de novo às \d{2}:\d{2}\.$/)
  })

  it('o 503 do `PATCH` diz que não foi salvo; escrever de novo tira o aviso', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork(), { escrita: () => ERRO('INDISPONIVEL_TENTE_DE_NOVO', 503) })
    const painel = await painelAberto('Apostila de Química', PRONTO)
    const campo = painel.getByLabelText('Título')
    await usuario.clear(campo)
    await usuario.type(campo, 'Outro título')
    await usuario.click(painel.getByRole('button', { name: 'Salvar alterações' }))
    expect((await painel.findByRole('alert')).textContent).toBe('As alterações não foram salvas. Tente de novo em instantes.')
    await usuario.type(campo, '!')
    expect(painel.queryByRole('alert')).toBeNull()
  })
})

describe('a edição nova', () => {
  const PDF = () => new File(['%PDF-1.4 sintético'], 'apostila-2027.pdf', { type: 'application/pdf' })

  async function abrirADaEdicao(usuario: ReturnType<typeof userEvent.setup>) {
    const painel = await painelAberto('Apostila de Química', PRONTO)
    await usuario.click(await painel.findByRole('button', { name: 'Enviar edição nova' }))
    return within(await screen.findByRole('dialog', { name: 'Enviar edição nova' }))
  }

  it('só o material pronto oferece "Enviar edição nova"', async () => {
    const falhou = material(4, { titulo: 'Sem texto', estado: 'falhou', falha: 'sem_texto', paginas: null, trechos: 0 })
    instalar(fakeNetwork(), { materiais: [falhou] })
    const painel = await painelAberto('Sem texto', falhou)
    expect(painel.queryByRole('button', { name: 'Enviar edição nova' })).toBeNull()
  })

  it('o diálogo diz o que a edição herda e que a anterior sai da busca quando a nova ficar pronta', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork())
    const dialogo = await abrirADaEdicao(usuario)
    expect(dialogo.getByText(/A disciplina, as séries, de quem é o material e a licença seguem os do material atual/)).toBeTruthy()
    expect(dialogo.getByText('A edição anterior sai da busca quando a nova ficar pronta. Até lá, ela continua valendo.')).toBeTruthy()
  })

  it('sem o PDF o diálogo diz o que fazer e nada vai à API; o arquivo que não é PDF é recusado na tela', async () => {
    // O `accept` do campo já filtra no navegador; aqui o arquivo errado chega ao campo mesmo assim, e a tela o confere pelo conteúdo.
    const usuario = userEvent.setup({ applyAccept: false })
    const rede = fakeNetwork()
    instalar(rede)
    const dialogo = await abrirADaEdicao(usuario)
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar edição nova' }))
    expect(dialogo.getByText('Escolha o PDF da edição nova.')).toBeTruthy()
    // O foco vai ao botão que escolhe o arquivo: é o campo que falta.
    expect(document.activeElement).toBe(dialogo.getByRole('button', { name: 'Escolher o PDF' }))
    await usuario.upload(dialogo.getByTestId('arquivo-da-edicao'), new File(['texto'], 'notas.txt', { type: 'text/plain' }))
    await waitFor(() => expect(document.getElementById('erro-do-arquivo-da-edicao')?.textContent ?? '').toMatch(/PDF/))
    // O arquivo recusado não é dito como escolhido: só o erro aparece.
    expect(dialogo.queryByText(/^PDF escolhido, com /)).toBeNull()
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar edição nova' }))
    expect(quantos(rede, `POST /v1/materiais/${PRONTO.id}/edicoes`)).toBe(0)
  })

  it('o envio leva o PDF e o nome da edição, fecha o painel e o diálogo, e a tela anuncia', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    const dialogo = await abrirADaEdicao(usuario)
    await usuario.upload(dialogo.getByTestId('arquivo-da-edicao'), PDF())
    // O arquivo escolhido aparece, e o botão passa a oferecer a troca.
    expect(await dialogo.findByText(/^PDF escolhido, com /)).toBeTruthy()
    expect(dialogo.getByRole('button', { name: 'Trocar o PDF' })).toBeTruthy()
    await usuario.type(dialogo.getByLabelText(/Nome da edição/), '2ª edição')
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar edição nova' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(quantos(rede, `POST /v1/materiais/${PRONTO.id}/edicoes`)).toBe(1)
    const chamadas = (fetch as unknown as Mock).mock.calls as Array<[string, RequestInit | undefined]>
    const corpo = chamadas.find(([caminho, opcoes]) => caminho.endsWith('/edicoes') && opcoes?.method === 'POST')?.[1]?.body
    expect(corpo).toBeInstanceOf(FormData)
    const campos = corpo as FormData
    expect(campos.get('edicao')).toBe('2ª edição')
    expect(campos.get('arquivo')).toBeInstanceOf(File)
    // Nada que a edição herda vai no pedido: a API lê do material que ela substitui.
    expect([...campos.keys()].sort()).toEqual(['arquivo', 'edicao'])
    expect(screen.getByText('Edição enviada. A leitura das páginas começa agora; a anterior sai da busca quando a nova ficar pronta.')).toBeTruthy()
  })

  it.each([
    ['EDICAO_EM_ANDAMENTO', 409, 'Espere a edição em processamento terminar.'],
    ['LICENCA_VENCIDA', 409, 'A licença deste material não está vigente. Atualize a vigência em Licenças e envie de novo.'],
    ['INDISPONIVEL_TENTE_DE_NOVO', 503, 'O envio não foi concluído. Tente de novo em instantes.'],
  ])('a falha %s do envio da edição diz o texto da tela e deixa o diálogo aberto', async (codigo, status, texto) => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork(), { escrita: () => ERRO(codigo, status) })
    const dialogo = await abrirADaEdicao(usuario)
    await usuario.upload(dialogo.getByTestId('arquivo-da-edicao'), PDF())
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar edição nova' }))
    expect((await dialogo.findByRole('alert')).textContent).toBe(texto)
    expect(screen.getByRole('dialog', { name: 'Enviar edição nova' })).toBeTruthy()
  })

  it('a edição recusada por `EDICAO_EM_ANDAMENTO` relê a lista e o diálogo só oferece "Fechar"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { escrita: () => ERRO('EDICAO_EM_ANDAMENTO', 409) })
    const dialogo = await abrirADaEdicao(usuario)
    await usuario.upload(dialogo.getByTestId('arquivo-da-edicao'), PDF())
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar edição nova' }))
    expect((await dialogo.findByRole('alert')).textContent).toBe('Espere a edição em processamento terminar.')
    // O envio lê `?limite=1` antes do POST, para renovar o token: só a leitura **depois** dele é a lista relida pela falha.
    await waitFor(() => expect(pedidosDe(rede).slice(pedidosDe(rede).findIndex((pedido) => pedido.startsWith('POST '))).includes('GET /v1/materiais')).toBe(true))
    expect(dialogo.queryByRole('button', { name: 'Enviar edição nova' })).toBeNull()
    expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeTruthy()
  })

  it('o clique duplo em "Enviar edição nova" manda um pedido só', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { escrita: () => new Promise<FakeResponse>(() => undefined) })
    const dialogo = await abrirADaEdicao(usuario)
    await usuario.upload(dialogo.getByTestId('arquivo-da-edicao'), PDF())
    const formulario = dialogo.getByRole('button', { name: 'Enviar edição nova' }).closest('form') as HTMLFormElement
    fireEvent.submit(formulario)
    fireEvent.submit(formulario)
    await waitFor(() => expect(quantos(rede, `POST /v1/materiais/${PRONTO.id}/edicoes`)).toBe(1))
    expect(quantos(rede, `POST /v1/materiais/${PRONTO.id}/edicoes`)).toBe(1)
  })
})
