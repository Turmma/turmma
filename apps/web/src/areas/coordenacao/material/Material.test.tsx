// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { prepararTela, redeFalsa, renderizarTela, type RedeFalsa, type RespostaFalsa } from '../../../__fixtures__/render-screen'
import type * as Sessao from '../../../api/sessao'
import { classesDoBotao } from '../../../components/ui/button-variants'
import Escola from '../Escola'
import Material from './Material'

/**
 * Escola › Material (telas da coordenação, 8.0; RF15 e RF22): os estados da tela, a tabela com o que falhou primeiro, o painel do
 * material no endereço com "Tentar de novo" e "Excluir material", o diálogo "Enviar material" com o formulário de sempre, a recusa por
 * licença que fica na tabela, e o foco depois de enviar e de excluir. A rede é falsa e responde por caminho; a tela, o cliente de
 * consultas e a sessão são os da aba. O que só o navegador mede (a linha inteira como alvo, a página que não rola, o celular de 360 px,
 * o arrastar do arquivo, a lista que se relê sozinha enquanto há `processando`, o PDF de verdade, o banco e a auditoria) é do e2e
 * `material`. O `jsdom` não tem `matchMedia`, `ResizeObserver` nem o `dialog` modal: o teste os põe, e são API do navegador.
 */
prepararTela()

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
const QUIMICA = { id: id(500), nome: 'Química', area: null }
const FISICA = { id: id(501), nome: 'Física', area: null }
const material = (n: number, parte: Record<string, unknown> = {}) => ({
  id: id(n),
  titulo: `Material ${String(n)}`,
  disciplinaId: QUIMICA.id,
  titularidade: 'escola',
  licenciante: null,
  licenca: 'autoria_da_escola',
  estado: 'pronto',
  falha: null,
  paginas: 6,
  trechos: 6,
  enviadoEm: '2026-10-04T12:00:00.000Z',
  ...parte,
})
const PRONTO = material(1, { titulo: 'Capítulo pronto', paginas: 12, trechos: 12 })
const SEM_TEXTO = material(2, {
  titulo: 'Capítulo sem texto',
  disciplinaId: FISICA.id,
  titularidade: 'terceiro_com_licenca',
  licenciante: 'Editora Sintética',
  licenca: 'licenca_comercial_autorizada',
  estado: 'falhou',
  falha: 'sem_texto',
  paginas: null,
  trechos: 0,
})
const LENDO = material(3, { titulo: 'Capítulo em leitura', estado: 'processando', paginas: null, trechos: 0 })
const MAIS_NOVO = material(4, { titulo: 'Capítulo mais novo', paginas: 3, trechos: 3 })

const ERRO = (codigo: string, status: number): RespostaFalsa => ({
  status,
  corpo: { erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } },
})
/** Um erro que a leitura não repete sozinha: a tela mostra o erro na hora, e não depois da nova tentativa de um segundo. */
const FALHA = ERRO('LIMITE_EXCEDIDO', 429)
const ok = (itens: readonly unknown[], extra: Record<string, unknown> = {}): RespostaFalsa => ({ status: 200, corpo: { itens, ...extra } })
const nuncaResponde = () => new Promise<RespostaFalsa>(() => undefined)

type Resposta = RespostaFalsa | (() => RespostaFalsa | Promise<RespostaFalsa>)
interface Respostas {
  materiais: Resposta
  disciplinas: Resposta
}
const PADRAO: Respostas = {
  // Na ordem de envio da API: o mais antigo primeiro.
  materiais: ok([PRONTO, SEM_TEXTO, MAIS_NOVO]),
  disciplinas: ok([QUIMICA, FISICA]),
}

function instalar(rede: RedeFalsa, parcial: Partial<Respostas> = {}): void {
  const respostas = { ...PADRAO, ...parcial }
  rede.responderPor('/v1/materiais', respostas.materiais)
  rede.responderPor('/v1/disciplinas', respostas.disciplinas)
}

/** Os pedidos que a tela fez, sem a consulta: `GET /v1/materiais`, `POST /v1/materiais`, `DELETE /v1/materiais/<id>`. */
const pedidosDe = (rede: RedeFalsa) => rede.chamadas.map((chamada) => `${chamada.metodo} ${chamada.caminho.split('?')[0] ?? ''}`)
const quantos = (rede: RedeFalsa, pedido: string) => pedidosDe(rede).filter((feito) => feito === pedido).length

/** A largura da janela, para a consulta `(min-width: 768px)` que a `Tabela` lê. */
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

function montar(endereco = '/material', comMoldura = false) {
  const [caminho = '/material', busca = ''] = endereco.split('?')
  const localizacao = memoryLocation({ path: caminho, searchPath: busca, record: true })
  renderizarTela(
    <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
      {comMoldura ? (
        <Escola aba="material">
          <Material />
        </Escola>
      ) : (
        <Material />
      )}
    </Router>,
  )
  return localizacao
}

/** A tela com a tabela lida. */
async function montarEEsperar(endereco = '/material') {
  const localizacao = montar(endereco)
  await screen.findByRole('table', { name: 'Lista de materiais' })
  return localizacao
}

const tabela = () => within(screen.getByRole('table', { name: 'Lista de materiais' }))
/** As linhas do corpo da tabela, na ordem da tela. */
const linhas = () => tabela().getAllByRole('row').filter((linha) => within(linha).queryAllByRole('columnheader').length === 0)
const linhaDe = (titulo: string) => {
  const linha = linhas().find((candidata) => candidata.textContent?.includes(titulo))
  if (linha === undefined) throw new Error(`sem a linha de ${titulo}`)
  return linha
}
const botaoDe = (titulo: string) => tabela().getByRole('button', { name: titulo })
const painelDe = (titulo: string) => screen.findByRole('dialog', { name: titulo })
const dialogoDeEnvio = () => screen.findByRole('dialog', { name: 'Enviar material' })
/** Os botões da face cheia da ação primária: as classes são as que o próprio `Botao` dá, e não um nome de cor escrito aqui. */
const cheios = () =>
  screen
    .getAllByRole('button')
    .filter((botao) => botao.className.startsWith(classesDoBotao({ variante: 'primario', tamanho: 'principal' })))
    .map((botao) => botao.textContent)

const PDF = () => new File(['%PDF-1.4 sintético'], 'capitulo-novo.pdf', { type: 'application/pdf' })

/** O corpo (multipart) do `POST /v1/materiais` que a tela mandou: é nele que se vê se o arquivo saiu do computador. */
function corpoDoEnvio(): FormData {
  const chamadas = (fetch as unknown as Mock).mock.calls as Array<[string, RequestInit | undefined]>
  const corpo = chamadas.find(([, opcoes]) => opcoes?.method === 'POST')?.[1]?.body
  if (!(corpo instanceof FormData)) throw new Error('o envio não saiu como multipart')
  return corpo
}

describe('os quatro estados da tela', () => {
  it('carregando: a leitura da lista no ar', async () => {
    instalar(redeFalsa(), { materiais: nuncaResponde })
    montar()
    expect(await screen.findByText('Carregando os materiais…')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Enviar material' })).toBeNull()
  })

  it('erro: a mensagem curta e "Tentar de novo", que lê a lista de novo', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let falhar = true
    instalar(rede, { materiais: () => (falhar ? FALHA : ok([PRONTO])) })
    montar()
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Enviar material' })).toBeNull()
    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await screen.findByRole('table', { name: 'Lista de materiais' })
    expect(quantos(rede, 'GET /v1/materiais')).toBe(2)
  })

  it('vazio: "Nenhum material ainda", com "Enviar material" — o único botão da tela — e nenhuma tabela', async () => {
    instalar(redeFalsa(), { materiais: ok([]) })
    montar()
    expect(await screen.findByText('Nenhum material ainda')).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(cheios()).toEqual(['Enviar material'])
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('com dado: a tabela em português, o que não carregou primeiro e depois o mais novo, cada situação em texto', async () => {
    instalar(redeFalsa())
    await montarEEsperar()
    expect(tabela().getAllByRole('columnheader').map((coluna) => coluna.textContent)).toEqual(['Material', 'Disciplina', 'Licença', 'Situação'])
    expect(linhas().map((linha) => linha.children[0]?.textContent)).toEqual(['Capítulo sem texto', 'Capítulo mais novo', 'Capítulo pronto'])
    const celulas = (titulo: string) => Array.from(linhaDe(titulo).children).map((celula) => celula.textContent)
    expect(celulas('Capítulo sem texto')).toEqual(['Capítulo sem texto', 'Física', 'Licença comercial que autoriza este uso', 'Não carregou'])
    expect(celulas('Capítulo mais novo')).toEqual(['Capítulo mais novo', 'Química', 'Autoria da escola ou de professor dela', 'Pronto · 3 páginas'])
    expect(celulas('Capítulo pronto')[3]).toBe('Pronto · 12 páginas')
    expect(screen.getByRole('heading', { name: 'Materiais da escola' })).toBeTruthy()
  })

  it('um material processando é dito em texto, e o leitor de tela ouve quantos estão sendo lidos', async () => {
    instalar(redeFalsa(), { materiais: ok([PRONTO, LENDO]) })
    await montarEEsperar()
    expect(Array.from(linhaDe('Capítulo em leitura').children)[3]?.textContent).toBe('Processando')
    expect(screen.getByText('Um material está sendo lido.')).toBeTruthy()
  })

  it('com dois materiais processando, o leitor de tela ouve o número', async () => {
    instalar(redeFalsa(), { materiais: ok([PRONTO, LENDO, material(6, { titulo: 'Outro em leitura', estado: 'processando', paginas: null, trechos: 0 })]) })
    await montarEEsperar()
    expect(screen.getByText('2 materiais estão sendo lidos.')).toBeTruthy()
  })

  it('a lista que passou do teto de páginas avisa que mostra só os primeiros', async () => {
    // Toda página diz que há outra: a tela lê até o teto e para.
    instalar(redeFalsa(), { materiais: () => ok([PRONTO], { proxima: id(999) }) })
    montar()
    expect(await screen.findByText('A lista é maior do que esta tela mostra: aparecem só os primeiros.')).toBeTruthy()
  })

  it('"Enviar material" é o único botão cheio da tela, com a tabela e com o painel aberto', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa())
    await montarEEsperar()
    expect(cheios()).toEqual(['Enviar material'])
    await usuario.click(botaoDe('Capítulo sem texto'))
    const painel = await painelDe('Capítulo sem texto')
    expect(within(painel).getAllByRole('button').filter((botao) => botao.className.includes('bg-laranja'))).toEqual([])
  })

  it('a 360 px a tabela vira lista, e o título continua sendo o botão que abre o painel', async () => {
    const usuario = userEvent.setup()
    janelaDe(360)
    instalar(redeFalsa())
    montar()
    const lista = await screen.findByRole('list', { name: 'Lista de materiais' })
    expect(screen.queryByRole('table')).toBeNull()
    expect(within(lista).getAllByRole('listitem')).toHaveLength(3)
    expect(within(lista).getAllByText('Situação').length).toBeGreaterThan(0)
    await usuario.click(within(lista).getByRole('button', { name: 'Capítulo pronto' }))
    expect(await painelDe('Capítulo pronto')).toBeTruthy()
  })
})


describe('o painel do material', () => {
  it('a linha abre o painel no endereço, só com o id, com o que foi declarado e o motivo da falha; o "Fechar" tira o parâmetro', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa())
    const localizacao = await montarEEsperar()
    await usuario.click(botaoDe('Capítulo sem texto'))
    const painel = await painelDe('Capítulo sem texto')
    // O endereço leva só o id do material, nunca o título (regra 20, item 9).
    expect(localizacao.history?.at(-1)).toBe(`/material?material=${SEM_TEXTO.id}`)
    const dentro = within(painel)
    expect(dentro.getByText('Não carregou')).toBeTruthy()
    expect(dentro.getByText('O PDF não tem texto para ler: parece ser só imagem. Envie a versão com texto.')).toBeTruthy()
    const dados = Object.fromEntries(Array.from(painel.querySelectorAll('dt')).map((rotulo) => [rotulo.textContent, rotulo.nextElementSibling?.textContent]))
    expect(dados).toEqual({
      Disciplina: 'Física',
      'De quem é o material': 'Material de terceiro, com licença',
      'Quem deu a licença': 'Editora Sintética',
      'Licença de uso': 'Licença comercial que autoriza este uso',
      Páginas: '—',
    })
    expect(dentro.getAllByRole('button').map((botao) => botao.getAttribute('aria-label') ?? botao.textContent)).toEqual(['Fechar', 'Tentar de novo', 'Excluir material'])

    await usuario.click(dentro.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog', { name: 'Capítulo sem texto' })).toBeNull()
    // Fechar troca o endereço, sem passo novo no histórico: o Voltar não reabre o painel.
    expect(localizacao.history).toEqual(['/material', '/material'])
  })

  it('o material pronto mostra as páginas, não tem "Quem deu a licença" quando a escola é a dona, e só oferece "Excluir material"', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa())
    await montarEEsperar()
    await usuario.click(botaoDe('Capítulo pronto'))
    const painel = await painelDe('Capítulo pronto')
    const rotulos = Array.from(painel.querySelectorAll('dt')).map((rotulo) => rotulo.textContent)
    expect(rotulos).toEqual(['Disciplina', 'De quem é o material', 'Licença de uso', 'Páginas'])
    expect(within(painel).getByText('12')).toBeTruthy()
    expect(within(painel).getByText('Pronto · 12 páginas')).toBeTruthy()
    expect(within(painel).queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(within(painel).getByRole('button', { name: 'Excluir material' })).toBeTruthy()
  })

  it('o painel aberto pelo endereço (o link do sino) já nasce aberto, sem clique, e ao fechar o foco vai ao título da lista', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa())
    await montarEEsperar(`/material?material=${SEM_TEXTO.id}`)
    const painel = await painelDe('Capítulo sem texto')
    await usuario.click(within(painel).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    // Não havia botão que o tivesse aberto: o foco não fica no `body`.
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Materiais da escola' }))
  })

  it('o id que a lista da escola não tem — o de outra escola, na sessão de outra pessoa — não abre painel nem aparece na tela', async () => {
    const rede = redeFalsa()
    instalar(rede, { materiais: ok([PRONTO]) })
    const localizacao = await montarEEsperar(`/material?material=${SEM_TEXTO.id}`)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.textContent).not.toContain('Capítulo sem texto')
    // Nenhum pedido por id: o painel acha o material na lista que a escola já carregou.
    expect(pedidosDe(rede).filter((pedido) => pedido.includes(SEM_TEXTO.id))).toEqual([])
    expect(localizacao.history?.at(-1)).toBe(`/material?material=${SEM_TEXTO.id}`)
  })

  it('"Tentar de novo" abre o envio com o que o material declarava e sem a declaração, e o foco vai a "Escolher arquivo"', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa())
    await montarEEsperar()
    await usuario.click(botaoDe('Capítulo sem texto'))
    await usuario.click(within(await painelDe('Capítulo sem texto')).getByRole('button', { name: 'Tentar de novo' }))
    const dialogo = within(await dialogoDeEnvio())
    expect((dialogo.getByLabelText('Título') as HTMLInputElement).value).toBe('Capítulo sem texto')
    expect((dialogo.getByLabelText('Disciplina') as HTMLSelectElement).value).toBe(FISICA.id)
    expect((dialogo.getByLabelText('De quem é o material') as HTMLSelectElement).value).toBe('terceiro_com_licenca')
    expect((dialogo.getByLabelText('Quem deu a licença') as HTMLInputElement).value).toBe('Editora Sintética')
    expect((dialogo.getByLabelText('Licença de uso (obrigatória)') as HTMLSelectElement).value).toBe('licenca_comercial_autorizada')
    expect((dialogo.getByLabelText(/^Declaro que a escola pode usar/) as HTMLInputElement).checked).toBe(false)
    expect(dialogo.getByText('Escolha o arquivo de novo, marque a declaração e envie. O material que falhou sai da lista quando o novo entrar.')).toBeTruthy()
    expect(document.activeElement).toBe(dialogo.getByRole('button', { name: 'Escolher arquivo' }))
  })

  it('o envio novo de um material que falhou o troca: o antigo é excluído, o painel sai do endereço e o diálogo fecha', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let trocado = false
    const novo = material(5, { titulo: 'Capítulo sem texto', disciplinaId: FISICA.id, estado: 'processando', paginas: null, trechos: 0 })
    rede.responderPor('/v1/disciplinas', ok([QUIMICA, FISICA]))
    rede.responderPor('/v1/materiais', () => {
      if (rede.chamadas.at(-1)?.metodo === 'POST') {
        trocado = true
        return { status: 201, corpo: novo }
      }
      return ok(trocado ? [PRONTO, novo] : [PRONTO, SEM_TEXTO])
    })
    rede.responderPor(/^\/v1\/materiais\/.+/, { status: 204 })
    const localizacao = await montarEEsperar()
    await usuario.click(botaoDe('Capítulo sem texto'))
    expect(localizacao.history?.at(-1)).toBe(`/material?material=${SEM_TEXTO.id}`)
    await usuario.click(within(await painelDe('Capítulo sem texto')).getByRole('button', { name: 'Tentar de novo' }))
    const dialogo = within(await dialogoDeEnvio())
    await usuario.upload(dialogo.getByTestId('arquivo-do-material'), PDF())
    await dialogo.findByText(/^capitulo-novo\.pdf/)
    await usuario.click(dialogo.getByLabelText(/^Declaro que a escola pode usar/))
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Enviar material' })).toBeNull())
    expect(pedidosDe(rede)).toContain(`DELETE /v1/materiais/${SEM_TEXTO.id}`)
    // O que falhou saiu da lista e do endereço; o painel dele não fica aberto sobre um material que não existe mais.
    expect(localizacao.history?.at(-1)).toBe('/material')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(linhas().map((linha) => linha.children[0]?.textContent)).toEqual(['Capítulo sem texto', 'Capítulo pronto'])
    expect(screen.getByText('Material enviado. A leitura das páginas começa agora e leva alguns instantes.')).toBeTruthy()
  })
})

describe('excluir pelo painel', () => {
  it('a confirmação diz o que acontece; cancelar não exclui nada', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede)
    await montarEEsperar()
    await usuario.click(botaoDe('Capítulo sem texto'))
    await usuario.click(within(await painelDe('Capítulo sem texto')).getByRole('button', { name: 'Excluir material' }))
    const confirmacao = await screen.findByRole('alertdialog')
    expect(within(confirmacao).getByRole('heading', { name: 'Excluir material' })).toBeTruthy()
    expect(confirmacao.textContent).toContain('Capítulo sem texto')
    expect(confirmacao.textContent).toContain('Física')
    expect(confirmacao.textContent).toContain('Não carregou')
    expect(confirmacao.textContent).toContain('As atividades e os planos já gerados continuam citando a página deste material.')

    await usuario.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(pedidosDe(rede).filter((pedido) => pedido.startsWith('DELETE'))).toEqual([])
    expect(await painelDe('Capítulo sem texto')).toBeTruthy()
    expect(linhas()).toHaveLength(3)
  })

  it('confirmar tira o material da lista e do endereço, anuncia, e o foco vai ao título da lista — e não ao body', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let excluido = false
    rede.responderPor('/v1/disciplinas', ok([QUIMICA, FISICA]))
    rede.responderPor('/v1/materiais', () => ok(excluido ? [PRONTO, MAIS_NOVO] : [PRONTO, SEM_TEXTO, MAIS_NOVO]))
    rede.responderPor(/^\/v1\/materiais\/.+/, () => {
      excluido = true
      return { status: 204 }
    })
    const localizacao = await montarEEsperar()
    await usuario.click(botaoDe('Capítulo sem texto'))
    await usuario.click(within(await painelDe('Capítulo sem texto')).getByRole('button', { name: 'Excluir material' }))
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir material' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(pedidosDe(rede)).toContain(`DELETE /v1/materiais/${SEM_TEXTO.id}`)
    expect(linhas().map((linha) => linha.children[0]?.textContent)).toEqual(['Capítulo mais novo', 'Capítulo pronto'])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localizacao.history?.at(-1)).toBe('/material')
    expect(screen.getByText('Material excluído. A busca do Assistente e do Tutor deixou de achá-lo.')).toBeTruthy()
    // O botão que abriu a confirmação saiu da tela com o painel: o foco fica no título da lista.
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Materiais da escola' }))
  })

  it('o material que outra pessoa já excluiu: a confirmação diz que a lista foi atualizada, e a lista é relida', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede)
    rede.responderPor(/^\/v1\/materiais\/.+/, ERRO('NAO_ENCONTRADO', 404))
    await montarEEsperar()
    await usuario.click(botaoDe('Capítulo pronto'))
    await usuario.click(within(await painelDe('Capítulo pronto')).getByRole('button', { name: 'Excluir material' }))
    const lidasAntes = quantos(rede, 'GET /v1/materiais')
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir material' }))
    expect(await screen.findByText('Este material já não está na lista. A lista foi atualizada.')).toBeTruthy()
    await waitFor(() => expect(quantos(rede, 'GET /v1/materiais')).toBe(lidasAntes + 1))
  })
})

describe('a releitura que falha com a lista na tela', () => {
  it('o aviso fica sobre a tabela, com "Tentar de novo" que não é cheio, e a lista de antes continua à vista', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let falhar = false
    rede.responderPor('/v1/disciplinas', ok([QUIMICA, FISICA]))
    rede.responderPor('/v1/materiais', () => (falhar ? FALHA : ok([PRONTO])))
    rede.responderPor(/^\/v1\/materiais\/.+/, ERRO('NAO_ENCONTRADO', 404))
    await montarEEsperar()
    await usuario.click(botaoDe('Capítulo pronto'))
    await usuario.click(within(await painelDe('Capítulo pronto')).getByRole('button', { name: 'Excluir material' }))
    falhar = true
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir material' }))
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }))
    await usuario.click(within(await painelDe('Capítulo pronto')).getByRole('button', { name: 'Fechar' }))

    // A tabela de antes continua à vista, com o aviso em cima, e o "Tentar de novo" dele não é um segundo botão cheio.
    const tentar = await screen.findByRole('button', { name: 'Tentar de novo' })
    expect(tentar.parentElement?.querySelector('[role="alert"]')).toBeTruthy()
    expect(linhas()).toHaveLength(1)
    expect(cheios()).toEqual(['Enviar material'])
    falhar = false
    await usuario.click(tentar)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull())
    expect(linhas()).toHaveLength(1)
  })
})

describe('o diálogo "Enviar material"', () => {
  it('o botão do alto abre o formulário de sempre, com os rótulos de sempre e o arquivo escolhido pelo botão', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa())
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    expect(dialogo.getByRole('heading', { name: 'Enviar material' })).toBeTruthy()
    for (const rotulo of ['Título', 'Disciplina', 'De quem é o material', 'Licença de uso (obrigatória)', /^Declaro que a escola pode usar este material/]) expect(dialogo.getByLabelText(rotulo)).toBeTruthy()
    expect(dialogo.queryByLabelText('Quem deu a licença')).toBeNull()
    expect(dialogo.getByText('Arraste o PDF para cá, ou escolha o arquivo. Um por vez, com até 20 MB.')).toBeTruthy()
    expect(dialogo.getByTestId('arquivo-do-material').getAttribute('accept')).toBe('application/pdf,.pdf')
    expect(document.activeElement).toBe(dialogo.getByRole('button', { name: 'Escolher arquivo' }))
    // De terceiro, pede quem deu a licença.
    await usuario.selectOptions(dialogo.getByLabelText('De quem é o material'), 'Material de terceiro, com licença')
    expect(dialogo.getByLabelText('Quem deu a licença')).toBeTruthy()
  })

  it('o formulário incompleto diz o que falta em cada campo, e nada vai à API', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede)
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))
    for (const texto of [
      'Escolha o PDF do material.',
      'Dê um título ao material, como ele aparece no livro ou na apostila.',
      'Escolha a disciplina do material.',
      'Diga de quem é o material.',
      'Escolha a licença de uso. Sem licença declarada, o material não entra.',
    ])
      expect(dialogo.getByText(texto)).toBeTruthy()
    expect(document.activeElement).toBe(dialogo.getByRole('button', { name: 'Escolher arquivo' }))
    expect(pedidosDe(rede).filter((pedido) => pedido.startsWith('POST'))).toEqual([])
  })

  it('o arquivo que não é PDF é recusado na tela, sem pedido à API; dois de uma vez, também', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede)
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    await usuario.upload(dialogo.getByTestId('arquivo-do-material'), new File(['nome;turma\nAluno sintético;7A\n'], 'apostila.pdf', { type: 'application/pdf' }))
    expect(await dialogo.findByText('O arquivo não é um PDF que conseguimos abrir. Confira o arquivo e envie de novo.')).toBeTruthy()
    expect(dialogo.getByRole('button', { name: 'Escolher arquivo' })).toBeTruthy()
    // Dois arquivos soltos de uma vez na área: um por vez.
    const zona = dialogo.getByText(/^Arraste o PDF/).parentElement
    if (zona === null) throw new Error('sem a área de soltar o arquivo')
    fireEvent.drop(zona, { dataTransfer: { files: [PDF(), PDF()] } })
    expect(await dialogo.findByText('Envie um arquivo por vez. Escolha só o PDF deste material.')).toBeTruthy()
    expect(pedidosDe(rede).filter((pedido) => pedido.startsWith('POST'))).toEqual([])
  })

  it('o envio com licença: o PDF sobe, o diálogo fecha, a lista mostra o novo, o anúncio diz e o foco volta ao botão que abriu', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let enviado = false
    const novo = material(5, { titulo: 'capitulo novo', estado: 'processando', paginas: null, trechos: 0 })
    rede.responderPor('/v1/disciplinas', ok([QUIMICA, FISICA]))
    rede.responderPor('/v1/materiais', () => {
      if (rede.chamadas.at(-1)?.metodo === 'POST') {
        enviado = true
        return { status: 201, corpo: novo }
      }
      return ok(enviado ? [PRONTO, novo] : [PRONTO])
    })
    await montarEEsperar()
    const abrir = screen.getByRole('button', { name: 'Enviar material' })
    await usuario.click(abrir)
    const dialogo = within(await dialogoDeEnvio())
    await usuario.upload(dialogo.getByTestId('arquivo-do-material'), PDF())
    await dialogo.findByText(/^capitulo-novo\.pdf/)
    // O título é sugerido pelo nome do arquivo.
    expect((dialogo.getByLabelText('Título') as HTMLInputElement).value).toBe('capitulo novo')
    await usuario.selectOptions(dialogo.getByLabelText('Disciplina'), 'Química')
    await usuario.selectOptions(dialogo.getByLabelText('De quem é o material'), 'Material próprio da escola')
    await usuario.selectOptions(dialogo.getByLabelText('Licença de uso (obrigatória)'), 'Autoria da escola ou de professor dela')
    await usuario.click(dialogo.getByLabelText(/^Declaro que a escola pode usar/))
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Enviar material' })).toBeNull())
    expect(quantos(rede, 'POST /v1/materiais')).toBe(1)
    expect(linhas().map((linha) => linha.children[0]?.textContent)).toEqual(['capitulo novo', 'Capítulo pronto'])
    expect(Array.from(linhaDe('capitulo novo').children)[3]?.textContent).toBe('Processando')
    expect(screen.getByText('Material enviado. A leitura das páginas começa agora e leva alguns instantes.')).toBeTruthy()
    expect(document.activeElement).toBe(abrir)
  })

  it('o primeiro envio, do vazio: o botão que abriu saiu da tela, e o foco vai ao título da lista', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let enviado = false
    const novo = material(5, { titulo: 'capitulo novo', estado: 'processando', paginas: null, trechos: 0 })
    rede.responderPor('/v1/disciplinas', ok([QUIMICA]))
    rede.responderPor('/v1/materiais', () => {
      if (rede.chamadas.at(-1)?.metodo === 'POST') {
        enviado = true
        return { status: 201, corpo: novo }
      }
      return ok(enviado ? [novo] : [])
    })
    montar()
    await usuario.click(await screen.findByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    await usuario.upload(dialogo.getByTestId('arquivo-do-material'), PDF())
    await dialogo.findByText(/^capitulo-novo\.pdf/)
    await usuario.selectOptions(dialogo.getByLabelText('Disciplina'), 'Química')
    await usuario.selectOptions(dialogo.getByLabelText('De quem é o material'), 'Material próprio da escola')
    await usuario.selectOptions(dialogo.getByLabelText('Licença de uso (obrigatória)'), 'Autoria da escola ou de professor dela')
    await usuario.click(dialogo.getByLabelText(/^Declaro que a escola pode usar/))
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))

    await screen.findByRole('table', { name: 'Lista de materiais' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Enviar material' })).toBeNull())
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Materiais da escola' }))
  })

  it('o primeiro envio que dá certo e cuja releitura cai não afirma o vazio: a tela diz o erro, e não "Nenhum material ainda"', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let enviado = false
    rede.responderPor('/v1/disciplinas', ok([QUIMICA]))
    rede.responderPor('/v1/materiais', () => {
      if (rede.chamadas.at(-1)?.metodo === 'POST') {
        enviado = true
        return { status: 201, corpo: material(5, { titulo: 'capitulo novo', estado: 'processando', paginas: null, trechos: 0 }) }
      }
      // A leitura antes do envio (`?limite=1`) responde; a releitura depois dele cai.
      return enviado ? FALHA : ok([])
    })
    montar('/material', true)
    await usuario.click(await screen.findByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    await usuario.upload(dialogo.getByTestId('arquivo-do-material'), PDF())
    await dialogo.findByText(/^capitulo-novo\.pdf/)
    await usuario.selectOptions(dialogo.getByLabelText('Disciplina'), 'Química')
    await usuario.selectOptions(dialogo.getByLabelText('De quem é o material'), 'Material próprio da escola')
    await usuario.selectOptions(dialogo.getByLabelText('Licença de uso (obrigatória)'), 'Autoria da escola ou de professor dela')
    await usuario.click(dialogo.getByLabelText(/^Declaro que a escola pode usar/))
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('Nenhum material ainda')).toBeNull()
    // Sem a lista na tela, o botão que abriu o diálogo e o título da lista não existem: o foco vai ao título da moldura, e não ao `body`.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Escola' })))
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })

  it('a falha do envio que não é recusa fica no diálogo, com o que foi digitado, e o conflito relê a lista', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let falha = ERRO('INDISPONIVEL_TENTE_DE_NOVO', 503)
    rede.responderPor('/v1/disciplinas', ok([QUIMICA]))
    rede.responderPor('/v1/materiais', () => (rede.chamadas.at(-1)?.metodo === 'POST' ? falha : ok([PRONTO])))
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    await usuario.upload(dialogo.getByTestId('arquivo-do-material'), PDF())
    await dialogo.findByText(/^capitulo-novo\.pdf/)
    await usuario.selectOptions(dialogo.getByLabelText('Disciplina'), 'Química')
    await usuario.selectOptions(dialogo.getByLabelText('De quem é o material'), 'Material próprio da escola')
    await usuario.selectOptions(dialogo.getByLabelText('Licença de uso (obrigatória)'), 'Autoria da escola ou de professor dela')
    await usuario.click(dialogo.getByLabelText(/^Declaro que a escola pode usar/))
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))

    const alerta = await dialogo.findByText('O sistema está indisponível no momento. Tente de novo em instantes.')
    expect(document.activeElement).toBe(alerta)
    expect((dialogo.getByLabelText('Título') as HTMLInputElement).value).toBe('capitulo novo')
    expect(linhas()).toHaveLength(1)
    // O erro de rede não relê a lista: só a leitura antes do envio e a de entrada.
    expect(quantos(rede, 'GET /v1/materiais')).toBe(2)

    falha = ERRO('CONFLITO', 409)
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))
    expect(await dialogo.findByText('Este arquivo já foi enviado nesta escola. Procure o material na lista abaixo.')).toBeTruthy()
    // Conflito: a leitura antes do envio e, depois, a releitura que mostra o que a escola já tem.
    await waitFor(() => expect(quantos(rede, 'GET /v1/materiais')).toBe(4))
  })
})

describe('a recusa por licença', () => {
  const RECUSADO = ERRO('MATERIAL_SEM_LICENCA', 422)
  const SEM_LICENCA = 'Não tenho a licença, ou não sei'

  async function enviarSemLicenca(usuario: ReturnType<typeof userEvent.setup>, titulo: string) {
    const dialogo = within(await dialogoDeEnvio())
    await usuario.type(dialogo.getByLabelText('Título'), titulo)
    await usuario.selectOptions(dialogo.getByLabelText('Disciplina'), 'Química')
    await usuario.selectOptions(dialogo.getByLabelText('De quem é o material'), 'Material próprio da escola')
    await usuario.selectOptions(dialogo.getByLabelText('Licença de uso (obrigatória)'), SEM_LICENCA)
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))
    return dialogo
  }

  it('sem licença o diálogo diz "Envio recusado" e por quê, com o foco no aviso; a recusa vira a primeira linha da tabela, sem abrir painel', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    rede.responderPor('/v1/disciplinas', ok([QUIMICA]))
    rede.responderPor('/v1/materiais', () => (rede.chamadas.at(-1)?.metodo === 'POST' ? RECUSADO : ok([PRONTO, SEM_TEXTO])))
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    // Antes de enviar, a tela já diz o que vai acontecer.
    await usuario.selectOptions(dialogo.getByLabelText('Licença de uso (obrigatória)'), SEM_LICENCA)
    expect(dialogo.getByText('Sem licença, o envio é recusado: o arquivo não é enviado nem lido, e a tentativa fica registrada na auditoria da escola.')).toBeTruthy()
    await enviarSemLicenca(usuario, 'Apostila sem dono')

    const textoDaRecusa = 'Sem uma licença que permita o uso, o material não entra na base da escola. O arquivo não foi enviado nem lido. Peça a autorização ao dono do conteúdo e envie de novo com a licença.'
    const alerta = await dialogo.findByText(`Envio recusado. ${textoDaRecusa}`)
    expect(document.activeElement).toBe(alerta)
    // O diálogo fica aberto, com o que foi digitado, para a pessoa corrigir e enviar de novo.
    expect((dialogo.getByLabelText('Título') as HTMLInputElement).value).toBe('Apostila sem dono')
    // A recusa é a primeira linha: falha vem antes, e não é material (sem botão que abre painel).
    expect(linhas().map((linha) => linha.children[0]?.textContent)).toEqual(['Apostila sem dono', 'Capítulo sem texto', 'Capítulo pronto'])
    const recusada = linhaDe('Apostila sem dono')
    expect(Array.from(recusada.children).map((celula) => celula.querySelector('[data-estado]')?.textContent ?? celula.textContent?.slice(0, 20))).toContain('Envio recusado · sem licença')
    expect(recusada.textContent).toContain(textoDaRecusa)
    // O leitor de tela lê qual aviso o "Dispensar" tira: o título vai no nome do botão.
    expect(within(recusada).getByRole('button', { name: 'Dispensar o aviso de Apostila sem dono' }).textContent).toBe('Dispensar o aviso de Apostila sem dono')
    expect(within(recusada).queryByRole('button', { name: 'Apostila sem dono' })).toBeNull()
    expect(Array.from(recusada.children)[1]?.textContent).toBe('Química')
    expect(Array.from(recusada.children)[2]?.textContent).toBe(SEM_LICENCA)
    expect(pedidosDe(rede).filter((pedido) => pedido.includes('/v1/materiais/'))).toEqual([])
  })

  it('com licença e sem a declaração, o motivo é o outro', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    rede.responderPor('/v1/disciplinas', ok([QUIMICA]))
    rede.responderPor('/v1/materiais', () => (rede.chamadas.at(-1)?.metodo === 'POST' ? RECUSADO : ok([PRONTO])))
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    await usuario.type(dialogo.getByLabelText('Título'), 'Outro capítulo')
    await usuario.selectOptions(dialogo.getByLabelText('Disciplina'), 'Química')
    await usuario.selectOptions(dialogo.getByLabelText('De quem é o material'), 'Material próprio da escola')
    await usuario.selectOptions(dialogo.getByLabelText('Licença de uso (obrigatória)'), 'Licença aberta (Creative Commons e semelhantes)')
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))
    expect(await dialogo.findByText('Envio recusado. Falta a declaração de que a escola pode usar este material. O arquivo não foi enviado nem lido. Marque a declaração e envie de novo.')).toBeTruthy()
    expect(Array.from(linhaDe('Outro capítulo').children)[3]?.textContent).toContain('Envio recusado · sem declaração')
  })

  it('reabrir o diálogo começa de um formulário novo, sem o rascunho nem o aviso da tentativa anterior; "Dispensar" tira a linha e volta ao vazio', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    rede.responderPor('/v1/disciplinas', ok([QUIMICA]))
    rede.responderPor('/v1/materiais', () => (rede.chamadas.at(-1)?.metodo === 'POST' ? RECUSADO : ok([])))
    montar()
    await usuario.click(await screen.findByRole('button', { name: 'Enviar material' }))
    const dialogo = await enviarSemLicenca(usuario, 'Apostila sem dono')
    await dialogo.findByText(/^Envio recusado\./)
    await usuario.click(dialogo.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog', { name: 'Enviar material' })).toBeNull()

    // A recusa continua à vista, na tabela, mesmo com a lista de materiais vazia.
    expect(linhas().map((linha) => linha.children[0]?.textContent)).toEqual(['Apostila sem dono'])
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const reaberto = within(await dialogoDeEnvio())
    expect((reaberto.getByLabelText('Título') as HTMLInputElement).value).toBe('')
    expect((reaberto.getByLabelText('Licença de uso (obrigatória)') as HTMLSelectElement).value).toBe('')
    expect(reaberto.queryByText(/^Envio recusado\./)).toBeNull()
    await usuario.click(reaberto.getByRole('button', { name: 'Cancelar' }))

    await usuario.click(screen.getByRole('button', { name: 'Dispensar o aviso de Apostila sem dono' }))
    expect(await screen.findByText('Nenhum material ainda')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('o que o diálogo e a tabela guardam entre uma tentativa e outra', () => {
  const RECUSADO = ERRO('MATERIAL_SEM_LICENCA', 422)
  const SEM_LICENCA = 'Não tenho a licença, ou não sei'
  const TEXTO_DO_ENVIO = 'Material enviado. A leitura das páginas começa agora e leva alguns instantes.'

  async function preencherComLicenca(usuario: ReturnType<typeof userEvent.setup>, dialogo: ReturnType<typeof within>) {
    await usuario.upload(dialogo.getByTestId('arquivo-do-material'), PDF())
    await dialogo.findByText(/^capitulo-novo\.pdf/)
    await usuario.selectOptions(dialogo.getByLabelText('Disciplina'), 'Química')
    await usuario.selectOptions(dialogo.getByLabelText('De quem é o material'), 'Material próprio da escola')
    await usuario.selectOptions(dialogo.getByLabelText('Licença de uso (obrigatória)'), 'Autoria da escola ou de professor dela')
    await usuario.click(dialogo.getByLabelText(/^Declaro que a escola pode usar/))
  }

  it('duas recusas: a mais nova vem primeiro, e "Dispensar" tira só a que a pessoa escolheu', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    rede.responderPor('/v1/disciplinas', ok([QUIMICA]))
    rede.responderPor('/v1/materiais', () => (rede.chamadas.at(-1)?.metodo === 'POST' ? RECUSADO : ok([PRONTO])))
    await montarEEsperar()
    for (const titulo of ['Primeira apostila', 'Segunda apostila']) {
      await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
      const dialogo = within(await dialogoDeEnvio())
      await usuario.type(dialogo.getByLabelText('Título'), titulo)
      await usuario.selectOptions(dialogo.getByLabelText('Disciplina'), 'Química')
      await usuario.selectOptions(dialogo.getByLabelText('De quem é o material'), 'Material próprio da escola')
      await usuario.selectOptions(dialogo.getByLabelText('Licença de uso (obrigatória)'), SEM_LICENCA)
      await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))
      await dialogo.findByText(/^Envio recusado\./)
      await usuario.click(dialogo.getByRole('button', { name: 'Cancelar' }))
    }
    expect(linhas().map((linha) => linha.children[0]?.textContent)).toEqual(['Segunda apostila', 'Primeira apostila', 'Capítulo pronto'])

    await usuario.click(screen.getByRole('button', { name: 'Dispensar o aviso de Segunda apostila' }))
    expect(linhas().map((linha) => linha.children[0]?.textContent)).toEqual(['Primeira apostila', 'Capítulo pronto'])
  })

  it('o pedido: a recusa sai sem o arquivo; o envio com licença leva o arquivo e o que foi declarado', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let recusar = true
    rede.responderPor('/v1/disciplinas', ok([QUIMICA]))
    rede.responderPor('/v1/materiais', () => {
      if (rede.chamadas.at(-1)?.metodo !== 'POST') return ok([PRONTO])
      return recusar ? RECUSADO : { status: 201, corpo: material(5, { titulo: 'capitulo novo', estado: 'processando', paginas: null, trechos: 0 }) }
    })
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    await usuario.upload(dialogo.getByTestId('arquivo-do-material'), PDF())
    await dialogo.findByText(/^capitulo-novo\.pdf/)
    await usuario.selectOptions(dialogo.getByLabelText('Disciplina'), 'Química')
    await usuario.selectOptions(dialogo.getByLabelText('De quem é o material'), 'Material próprio da escola')
    await usuario.selectOptions(dialogo.getByLabelText('Licença de uso (obrigatória)'), SEM_LICENCA)
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))
    await dialogo.findByText(/^Envio recusado\./)
    // O arquivo estava escolhido, e mesmo assim não saiu do computador.
    expect(corpoDoEnvio().get('arquivo')).toBeNull()
    expect(corpoDoEnvio().get('licenca')).toBe('sem_licenca')

    recusar = false
    await usuario.selectOptions(dialogo.getByLabelText('Licença de uso (obrigatória)'), 'Autoria da escola ou de professor dela')
    await usuario.click(dialogo.getByLabelText(/^Declaro que a escola pode usar/))
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Enviar material' })).toBeNull())
    const posts = ((fetch as unknown as Mock).mock.calls as Array<[string, RequestInit | undefined]>).filter(([, opcoes]) => opcoes?.method === 'POST')
    const enviado = posts.at(-1)?.[1]?.body
    expect(enviado).toBeInstanceOf(FormData)
    expect((enviado as FormData).get('arquivo')).toBeInstanceOf(File)
    expect((enviado as FormData).get('declaracao')).toBe('true')
  })

  it('abrir o diálogo apaga o anúncio do envio anterior', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    rede.responderPor('/v1/disciplinas', ok([QUIMICA]))
    rede.responderPor('/v1/materiais', () =>
      rede.chamadas.at(-1)?.metodo === 'POST' ? { status: 201, corpo: material(5, { titulo: 'capitulo novo', estado: 'processando', paginas: null, trechos: 0 }) } : ok([PRONTO]),
    )
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    await preencherComLicenca(usuario, dialogo)
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))
    expect(await screen.findByText(TEXTO_DO_ENVIO)).toBeTruthy()

    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    await dialogoDeEnvio()
    expect(screen.queryByText(TEXTO_DO_ENVIO)).toBeNull()
  })

  it('a falha do envio some quando a pessoa escolhe outro arquivo', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    rede.responderPor('/v1/disciplinas', ok([QUIMICA]))
    rede.responderPor('/v1/materiais', () => (rede.chamadas.at(-1)?.metodo === 'POST' ? ERRO('INDISPONIVEL_TENTE_DE_NOVO', 503) : ok([PRONTO])))
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    await preencherComLicenca(usuario, dialogo)
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))
    await dialogo.findByText('O sistema está indisponível no momento. Tente de novo em instantes.')

    await usuario.upload(dialogo.getByTestId('arquivo-do-material'), new File(['%PDF-1.4 outro'], 'outro.pdf', { type: 'application/pdf' }))
    await dialogo.findByText(/^outro\.pdf/)
    expect(dialogo.queryByText('O sistema está indisponível no momento. Tente de novo em instantes.')).toBeNull()
  })

  it('o seletor de arquivo fechado sem escolha não fecha o diálogo nem apaga o formulário: o `cancel` do input não é o Esc do diálogo', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa())
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    await usuario.type(dialogo.getByLabelText('Título'), 'Capítulo que ficou pela metade')
    // O navegador manda `cancel` ao input quando o seletor se fecha sem escolha (ou com o mesmo arquivo), e o evento sobe.
    fireEvent(dialogo.getByTestId('arquivo-do-material'), new Event('cancel', { bubbles: true, cancelable: true }))
    expect(screen.queryByRole('dialog', { name: 'Enviar material' })).not.toBeNull()
    expect((dialogo.getByLabelText('Título') as HTMLInputElement).value).toBe('Capítulo que ficou pela metade')
    // O Esc de verdade, no próprio diálogo, continua fechando.
    fireEvent(screen.getByRole('dialog', { name: 'Enviar material' }), new Event('cancel', { cancelable: true }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Enviar material' })).toBeNull())
  })

  it('sem disciplina na escola, o diálogo diz onde criá-las, não tem formulário e só se fecha', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa(), { disciplinas: ok([]) })
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    expect(dialogo.getByText(/^Antes de enviar material, crie as disciplinas da escola/)).toBeTruthy()
    expect(dialogo.queryByLabelText('Título')).toBeNull()
    await usuario.click(dialogo.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog', { name: 'Enviar material' })).toBeNull()
  })

  it('a dica do "Tentar de novo" só aparece no envio que troca um material que falhou', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa())
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const novo = within(await dialogoDeEnvio())
    expect(novo.queryByText(/^Escolha o arquivo de novo/)).toBeNull()
    await usuario.click(novo.getByRole('button', { name: 'Cancelar' }))

    await usuario.click(botaoDe('Capítulo sem texto'))
    await usuario.click(within(await painelDe('Capítulo sem texto')).getByRole('button', { name: 'Tentar de novo' }))
    const troca = within(await dialogoDeEnvio())
    expect(troca.getByText(/^Escolha o arquivo de novo, marque a declaração e envie\./)).toBeTruthy()
  })

  it('enquanto o envio está no ar o botão diz "Enviando…" e não aceita outro clique', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    rede.responderPor('/v1/disciplinas', ok([QUIMICA]))
    rede.responderPor('/v1/materiais', () => (rede.chamadas.at(-1)?.metodo === 'POST' ? nuncaResponde() : ok([PRONTO])))
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    await preencherComLicenca(usuario, dialogo)
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))
    const enviando = await dialogo.findByRole('button', { name: 'Enviando…' })
    expect((enviando as HTMLButtonElement).disabled).toBe(true)
    expect(quantos(rede, 'POST /v1/materiais')).toBe(1)
  })
  it('a resposta que chega com o diálogo já fechado não fecha o diálogo reaberto; a recusa atrasada entra na tabela mesmo assim', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let soltar: (resposta: RespostaFalsa) => void = () => undefined
    rede.responderPor('/v1/disciplinas', ok([QUIMICA]))
    rede.responderPor('/v1/materiais', () => {
      if (rede.chamadas.at(-1)?.metodo !== 'POST') return ok([PRONTO])
      return new Promise<RespostaFalsa>((resolver) => {
        soltar = resolver
      })
    })
    await montarEEsperar()
    // 1. O envio sai e fica no ar; a pessoa desiste e fecha o diálogo.
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const primeiro = within(await dialogoDeEnvio())
    await preencherComLicenca(usuario, primeiro)
    await usuario.click(primeiro.getByRole('button', { name: 'Enviar material' }))
    await waitFor(() => expect(quantos(rede, 'POST /v1/materiais')).toBe(1))
    await usuario.click(primeiro.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog', { name: 'Enviar material' })).toBeNull()

    // 2. Ela reabre o diálogo e digita um título; a resposta atrasada chega agora.
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const reaberto = within(await dialogoDeEnvio())
    await usuario.type(reaberto.getByLabelText('Título'), 'Outro capítulo')
    soltar({ status: 201, corpo: material(5, { titulo: 'capitulo novo', estado: 'processando', paginas: null, trechos: 0 }) })
    await waitFor(() => expect(screen.getByText(TEXTO_DO_ENVIO)).toBeTruthy())
    // O diálogo reaberto é de outra abertura: continua aberto, com o que foi digitado.
    expect(screen.queryByRole('dialog', { name: 'Enviar material' })).not.toBeNull()
    expect((reaberto.getByLabelText('Título') as HTMLInputElement).value).toBe('Outro capítulo')
    await usuario.click(reaberto.getByRole('button', { name: 'Cancelar' }))

    // 3. A recusa que chega com o diálogo fechado também vai à tabela.
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const terceiro = within(await dialogoDeEnvio())
    await usuario.type(terceiro.getByLabelText('Título'), 'Apostila atrasada')
    await usuario.selectOptions(terceiro.getByLabelText('Disciplina'), 'Química')
    await usuario.selectOptions(terceiro.getByLabelText('De quem é o material'), 'Material próprio da escola')
    await usuario.selectOptions(terceiro.getByLabelText('Licença de uso (obrigatória)'), SEM_LICENCA)
    await usuario.click(terceiro.getByRole('button', { name: 'Enviar material' }))
    await waitFor(() => expect(quantos(rede, 'POST /v1/materiais')).toBe(2))
    await usuario.click(terceiro.getByRole('button', { name: 'Cancelar' }))
    soltar(RECUSADO)
    await waitFor(() => expect(linhas().map((linha) => linha.children[0]?.textContent)).toContain('Apostila atrasada'))
    expect(Array.from(linhaDe('Apostila atrasada').children)[3]?.textContent).toContain('Envio recusado · sem licença')
  })

  it('a sessão que muda de dono fecha o diálogo e leva as recusas da tabela', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    rede.responderPor('/v1/disciplinas', ok([QUIMICA]))
    rede.responderPor('/v1/materiais', () => (rede.chamadas.at(-1)?.metodo === 'POST' ? RECUSADO : ok([PRONTO])))
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    await usuario.type(dialogo.getByLabelText('Título'), 'Apostila sem dono')
    await usuario.selectOptions(dialogo.getByLabelText('Disciplina'), 'Química')
    await usuario.selectOptions(dialogo.getByLabelText('De quem é o material'), 'Material próprio da escola')
    await usuario.selectOptions(dialogo.getByLabelText('Licença de uso (obrigatória)'), SEM_LICENCA)
    await usuario.click(dialogo.getByRole('button', { name: 'Enviar material' }))
    await dialogo.findByText(/^Envio recusado\./)
    await usuario.click(dialogo.getByRole('button', { name: 'Cancelar' }))
    expect(linhas().map((linha) => linha.children[0]?.textContent)).toEqual(['Apostila sem dono', 'Capítulo pronto'])
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    await dialogoDeEnvio()

    act(() => {
      for (const ouvinte of ouvintesDeTroca) ouvinte()
    })
    expect(screen.queryByRole('dialog', { name: 'Enviar material' })).toBeNull()
    expect(linhas().map((linha) => linha.children[0]?.textContent)).toEqual(['Capítulo pronto'])
  })

  it('o segundo clique em "Enviar material" com o pedido no ar não manda outro pedido', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    rede.responderPor('/v1/disciplinas', ok([QUIMICA]))
    rede.responderPor('/v1/materiais', () => (rede.chamadas.at(-1)?.metodo === 'POST' ? nuncaResponde() : ok([PRONTO])))
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar material' }))
    const dialogo = within(await dialogoDeEnvio())
    await preencherComLicenca(usuario, dialogo)
    const botao = dialogo.getByRole('button', { name: 'Enviar material' })
    // Dois envios do formulário no mesmo instante, como o clique duplo e o Enter: só o primeiro sai.
    const formulario = botao.closest('form') as HTMLFormElement
    fireEvent.submit(formulario)
    fireEvent.submit(formulario)
    await waitFor(() => expect(quantos(rede, 'POST /v1/materiais')).toBe(1))
    await usuario.click(await dialogo.findByRole('button', { name: 'Enviando…' }))
    expect(quantos(rede, 'POST /v1/materiais')).toBe(1)
  })
})
