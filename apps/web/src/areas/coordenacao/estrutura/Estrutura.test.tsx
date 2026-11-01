// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import Estrutura from './Estrutura'

/**
 * Escola › Turmas (telas da coordenação, 5.0; RF11, RF12, RF22 e RF23): os estados da tela, a tabela por série com o professor
 * e a situação de cada turma, o filtro "Sem professor" no endereço, o painel que abre pelo endereço, **as leituras que a tela
 * faz** — a lista de nomes nunca — e o foco depois de criar, renomear e excluir. A rede é falsa e responde por caminho; a tela,
 * o cliente de consultas e a sessão são os da aba. O que só o navegador mede (a página que não rola, o celular de 360 px, o clique
 * em qualquer ponto da linha e o diálogo sobre o painel, com dois `<dialog>` empilhados) é do e2e `estrutura`. O `jsdom` não tem
 * `matchMedia`, `ResizeObserver` nem o `dialog` modal: o teste os põe, e são API do navegador, e não peça nossa.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const ANO = { id: id(1), ano: 2026, inicio: '2026-02-02', fim: '2026-12-18', situacao: 'em_curso' }
const ANO_PLANEJADO = { ...ANO, id: id(2), situacao: 'planejado' }
const SERIE_7 = { id: id(207), etapa: 'ef_anos_finais', ano: 7 }
const SERIE_8 = { id: id(208), etapa: 'ef_anos_finais', ano: 8 }
const SERIE_1_EM = { id: id(301), etapa: 'em', ano: 1 }
const TURMA_7A = { id: id(101), anoLetivoId: ANO.id, nome: '7ºA', turno: 'manha', serie: SERIE_7 }
const TURMA_7B = { id: id(102), anoLetivoId: ANO.id, nome: '7ºB', turno: null, serie: SERIE_7 }
const TURMA_8A = { id: id(103), anoLetivoId: ANO.id, nome: '8ºA', turno: 'tarde', serie: SERIE_8 }
const TURMA_1EM = { id: id(104), anoLetivoId: ANO.id, nome: '1ºA', turno: 'integral', serie: SERIE_1_EM }
const MATEMATICA = { id: id(500), nome: 'Matemática', area: null }
const FISICA = { id: id(501), nome: 'Física', area: null }
const BEATRIZ = { usuarioId: id(301), nome: 'Beatriz Sintética', estado: 'ativo' }
const CAMILA = { usuarioId: id(302), nome: 'Camila Sintética', estado: 'ativo' }
const RAFAEL = { usuarioId: id(303), nome: 'Rafael Sintético', estado: 'ativo' }
const VINCULO = (n: number, professor: { usuarioId: string }, turma: { id: string; nome: string }, disciplina: { id: string; nome: string }, estado: string) => ({
  id: id(400 + n),
  usuarioId: professor.usuarioId,
  papel: 'professor',
  turma: { id: turma.id, nome: turma.nome },
  disciplina: { id: disciplina.id, nome: disciplina.nome },
  estado,
})
/**
 * A 7ºA tem três professores (a Camila em duas disciplinas), a 7ºB só um vínculo contestado, a 8ºA nenhum, e a 1ºA um pendente.
 * A 7ºB e a 8ºA estão sem professor.
 */
const VINCULOS = [
  VINCULO(1, CAMILA, TURMA_7A, MATEMATICA, 'confirmado'),
  VINCULO(2, CAMILA, TURMA_7A, FISICA, 'pendente'),
  VINCULO(3, RAFAEL, TURMA_7A, MATEMATICA, 'confirmado'),
  VINCULO(4, BEATRIZ, TURMA_7A, FISICA, 'confirmado'),
  VINCULO(5, RAFAEL, TURMA_7B, MATEMATICA, 'contestado'),
  VINCULO(6, BEATRIZ, TURMA_1EM, MATEMATICA, 'pendente'),
]

const ERRO = (codigo: string, status: number): FakeResponse => ({
  status,
  corpo: { erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } },
})
/** Um erro que a leitura não repete sozinha: a tela mostra o erro na hora, e não depois da nova tentativa de um segundo. */
const FALHA = ERRO('LIMITE_EXCEDIDO', 429)
const ok = (itens: readonly unknown[], extra: Record<string, unknown> = {}): FakeResponse => ({ status: 200, corpo: { itens, ...extra } })
const nuncaResponde = () => new Promise<FakeResponse>(() => undefined)

type Resposta = FakeResponse | (() => FakeResponse | Promise<FakeResponse>)
interface Respostas {
  anos: Resposta
  series: Resposta
  disciplinas: Resposta
  turmas: Resposta
  professores: Resposta
  vinculos: Resposta
}
const PADRAO: Respostas = {
  anos: ok([ANO]),
  series: ok([SERIE_8, SERIE_1_EM, SERIE_7]),
  disciplinas: ok([MATEMATICA, FISICA]),
  // Fora da ordem da escola: a tela é que põe cada turma na sua série.
  turmas: ok([TURMA_1EM, TURMA_8A, TURMA_7B, TURMA_7A]),
  professores: ok([BEATRIZ, CAMILA, RAFAEL]),
  vinculos: ok(VINCULOS),
}

function instalar(rede: FakeNetwork, parcial: Partial<Respostas> = {}): void {
  const respostas = { ...PADRAO, ...parcial }
  rede.responderPor(/^\/v1\/anos-letivos\?/, respostas.anos)
  rede.responderPor('/v1/series', respostas.series)
  rede.responderPor('/v1/disciplinas', respostas.disciplinas)
  // Só a leitura (com a consulta): criar é `POST` no mesmo caminho, sem consulta, e renomear e excluir são o `PATCH` e o `DELETE` do id.
  rede.responderPor(/^\/v1\/turmas\?/, respostas.turmas)
  rede.responderPor('/v1/professores', respostas.professores)
  rede.responderPor('/v1/vinculos', respostas.vinculos)
}

/** Os caminhos pedidos, sem a consulta, na ordem. */
const caminhosDe = (rede: FakeNetwork) => rede.chamadas.map((chamada) => chamada.caminho.split('?')[0])
const chamouAlgumaLista = (rede: FakeNetwork) => rede.chamadas.some((chamada) => /\/lista|\/alunos|\/reivindicacoes/.test(chamada.caminho))

/** A largura da janela, para a consulta `(min-width: 768px)` que a `Table` e o miolo leem. */
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

function montar(endereco = '/estrutura') {
  const [caminho = '/estrutura', busca = ''] = endereco.split('?')
  const localizacao = memoryLocation({ path: caminho, searchPath: busca, record: true })
  renderScreen(
    <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
      <Estrutura />
    </Router>,
  )
  return localizacao
}

/** A tela com as turmas do ano lidas. */
async function montarEEsperar(endereco = '/estrutura') {
  const localizacao = montar(endereco)
  await screen.findByRole('region', { name: 'Turmas de 2026' })
  return localizacao
}

const turmas = () => within(screen.getByRole('region', { name: 'Turmas de 2026' }))
/** As linhas do corpo de todas as tabelas da região das turmas, na ordem da tela. */
const linhas = () =>
  turmas()
    .getAllByRole('row')
    .filter((linha) => within(linha).queryAllByRole('columnheader').length === 0)
/** O que a linha da turma diz, célula por célula. */
const celulasDe = (nome: string) => {
  const linha = linhas().find((candidata) => within(candidata).queryByRole('link', { name: new RegExp(`Lista de nomes da turma ${nome}$`) }) !== null)
  if (linha === undefined) throw new Error(`sem a linha da turma ${nome}`)
  return Array.from(linha.children).map((celula) => celula.textContent)
}

describe('os quatro estados da tela', () => {
  it('carregando: a leitura dos anos no ar', async () => {
    instalar(fakeNetwork(), { anos: nuncaResponde })
    montar()
    expect(await screen.findByText('Carregando a estrutura da escola…')).toBeTruthy()
    // O vazio só vem com a leitura terminada e sem erro (RF22): durante a leitura, nem o convite do ano nem o das turmas.
    expect(screen.queryByText('Comece pelo ano letivo')).toBeNull()
    expect(screen.queryByText('Nenhuma turma ainda')).toBeNull()
  })

  it('erro: a mensagem curta e "Tentar de novo", que lê só os anos de novo', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhar = true
    instalar(rede, { anos: () => (falhar ? FALHA : ok([ANO])) })
    montar()
    await screen.findByRole('alert')
    // A leitura que falhou não afirma o vazio: nem "Comece pelo ano letivo" nem "Nenhuma turma ainda" ao lado do erro (RF22).
    expect(screen.queryByText('Comece pelo ano letivo')).toBeNull()
    expect(screen.queryByText('Nenhuma turma ainda')).toBeNull()
    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await screen.findByRole('region', { name: 'Turmas de 2026' })
    expect(caminhosDe(rede).filter((caminho) => caminho === '/v1/anos-letivos')).toHaveLength(2)
  })

  it('vazio, a escola sem ano letivo: "Comece pelo ano letivo", o botão do primeiro passo e o roteiro sem marca', async () => {
    const rede = fakeNetwork()
    instalar(rede, { anos: ok([]) })
    montar()
    expect(await screen.findByText('Comece pelo ano letivo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Criar o ano letivo' })).toBeTruthy()
    const roteiro = within(screen.getByRole('region', { name: 'O roteiro até a alocação' }))
    expect(roteiro.getAllByRole('listitem')).toHaveLength(7)
    expect(roteiro.queryByText(/falta|feito/)).toBeNull()
    // Sem ano letivo não há turma nem vínculo a ler, e nem aviso "Para terminar a escola" nem botão do painel.
    expect(caminhosDe(rede).filter((caminho) => caminho === '/v1/turmas' || caminho === '/v1/vinculos')).toEqual([])
    expect(screen.queryByRole('button', { name: 'Ano letivo e disciplinas' })).toBeNull()
  })

  it('sem ano em curso: o texto de hoje, o botão do painel, sem "Nova turma", e turmas e vínculos nem são chamados', async () => {
    const rede = fakeNetwork()
    instalar(rede, { anos: ok([ANO_PLANEJADO]) })
    montar()
    const regiao = await screen.findByRole('region', { name: 'Turmas' })
    expect(within(regiao).getByText(/As turmas nascem no ano letivo em curso/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ano letivo e disciplinas' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nova turma' })).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Situação' })).toBeNull()
    expect(caminhosDe(rede).filter((caminho) => caminho === '/v1/turmas' || caminho === '/v1/vinculos')).toEqual([])
  })

  it('o ano sem turma: o vazio das turmas, sem tabela', async () => {
    instalar(fakeNetwork(), { turmas: ok([]), vinculos: ok([]) })
    montar()
    const regiao = await screen.findByRole('region', { name: 'Turmas de 2026' })
    expect(await within(regiao).findByText('Nenhuma turma ainda')).toBeTruthy()
    expect(within(regiao).queryByRole('table')).toBeNull()
    expect(screen.getByRole('button', { name: 'Nova turma' })).toBeTruthy()
  })

  it('as turmas carregando e a falha delas: cada seção tem o seu estado, e a tela continua em pé', async () => {
    const usuario = userEvent.setup()
    let falhar = true
    instalar(fakeNetwork(), { turmas: () => (falhar ? FALHA : ok([TURMA_7A])), vinculos: ok([]) })
    montar()
    const regiao = await screen.findByRole('region', { name: 'Turmas de 2026' })
    await within(regiao).findByRole('alert')
    // O resto da tela não cai com ela: a alocação e o botão do painel estão lá.
    expect(screen.getByRole('button', { name: 'Ano letivo e disciplinas' })).toBeTruthy()
    falhar = false
    await usuario.click(within(regiao).getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(within(regiao).queryByRole('alert')).toBeNull())
    expect(await within(regiao).findByRole('link', { name: /Lista de nomes da turma 7ºA$/ })).toBeTruthy()
  })

  it('com dado: uma tabela por série, na ordem da escola, e cada linha com a turma, o turno, os professores e a situação', async () => {
    instalar(fakeNetwork())
    await montarEEsperar()
    await within(screen.getByRole('region', { name: 'Turmas de 2026' })).findAllByText('Com professor')
    expect(
      turmas()
        .getAllByRole('heading', { level: 3 })
        .map((titulo) => titulo.textContent),
    ).toEqual(['7º ano do Ensino Fundamental', '8º ano do Ensino Fundamental', '1º ano do Ensino Médio'])
    expect(
      turmas()
        .getAllByRole('table')
        .map((tabela) =>
          within(tabela)
            .getAllByRole('columnheader')
            .map((coluna) => coluna.textContent),
        ),
    ).toEqual([
      ['Turma', 'Turno', 'Professores', 'Situação', 'Ações'],
      ['Turma', 'Turno', 'Professores', 'Situação', 'Ações'],
      ['Turma', 'Turno', 'Professores', 'Situação', 'Ações'],
    ])
    // Até dois nomes e "+N"; o professor com duas disciplinas conta uma vez; o contestado não dá professor; o pendente dá.
    expect(celulasDe('7ºA')).toEqual(['7ºA', 'manhã', 'Beatriz Sintética, Camila Sintética +1', 'Com professor', 'Mais ações da turma 7ºA'])
    expect(celulasDe('7ºB')).toEqual(['7ºB', '—', '—', 'Sem professor', 'Mais ações da turma 7ºB'])
    expect(celulasDe('8ºA')).toEqual(['8ºA', 'tarde', '—', 'Sem professor', 'Mais ações da turma 8ºA'])
    expect(celulasDe('1ºA')).toEqual(['1ºA', 'integral', 'Beatriz Sintética', 'Com professor', 'Mais ações da turma 1ºA'])
  })

  it('a linha é um link para a lista da turma, com o nome acessível "Lista de nomes da turma <nome>", e o menu é irmão dele', async () => {
    instalar(fakeNetwork())
    await montarEEsperar()
    const ligacao = await turmas().findByRole('link', { name: 'Lista de nomes da turma 7ºA' })
    expect(ligacao.getAttribute('href')).toBe(`/estrutura/turmas/${TURMA_7A.id}`)
    const linha = ligacao.closest('tr')
    if (linha === null) throw new Error('o link fora da linha')
    const menu = within(linha).getByRole('button', { name: 'Mais ações da turma 7ºA' })
    expect(ligacao.contains(menu)).toBe(false)
    expect(menu.getAttribute('aria-haspopup')).toBe('menu')
    // A linha inteira abre a turma: o link se estende sobre a linha, que é a referência dele, e o menu vem depois dele em um contêiner `relative`, sem `z-index`
    // (que prenderia a lista do menu aberto dentro da linha), para ainda receber o próprio clique. As classes são aproximação do jsdom, que não pinta: a prova
    // do clique que abre a turma e do clique que abre o menu é a do e2e (`estrutura.spec.ts`), e este teste não a substitui.
    expect(linha.className).toContain('relative')
    expect(ligacao.className).toContain('after:inset-0')
    const embrulho = menu.closest('span.relative')
    expect(embrulho).not.toBeNull()
    expect(embrulho?.className).not.toMatch(/\bz-/)
  })

  it('a 360 px a tabela vira lista, com o título de cada coluna ao lado do valor, e o link e o menu continuam', async () => {
    janelaDe(360)
    instalar(fakeNetwork())
    await montarEEsperar()
    await turmas().findByRole('link', { name: 'Lista de nomes da turma 7ºA' })
    expect(turmas().queryByRole('table')).toBeNull()
    const lista = turmas().getAllByRole('list', { name: /^Turmas do / })
    expect(lista).toHaveLength(3)
    const item = within(lista[0] as HTMLElement).getAllByRole('listitem')[0] as HTMLElement
    expect(within(item).getByText('Professores')).toBeTruthy()
    expect(within(item).getByRole('button', { name: 'Mais ações da turma 7ºA' })).toBeTruthy()
    // O cartão também é a referência do link estendido.
    expect(item.className).toContain('relative')
  })

  it.each([1366, 360])('o link da linha é um alvo de toque de 44 px, na tabela e na lista de 360 px (%i px)', async (largura) => {
    // O jsdom não mede altura: as classes são a aproximação, e a medida é a do W12 (`estrutura.spec.ts`). Sem `inline-flex` o `min-h-11` não vale num `<a>` inline.
    janelaDe(largura)
    instalar(fakeNetwork())
    await montarEEsperar()
    const classes = (await turmas().findByRole('link', { name: 'Lista de nomes da turma 7ºA' })).className.split(/\s+/)
    expect(classes).toContain('inline-flex')
    expect(classes).toContain('min-h-11')
    expect(classes).toContain('items-center')
    // Em `inline-flex` o nome comprido e sem espaço não quebra sozinho: sem isto o cartão de 360 px estoura (o W12 mediu 13 px).
    expect(classes).toContain('wrap-anywhere')
  })

  it('"Nova turma" é o único botão cheio da aba, e a alocação já não mora nela: sem a seção e sem o "Alocar" (ela é o "Acrescentar turma" do painel do professor, 7.0)', async () => {
    instalar(fakeNetwork())
    await montarEEsperar()
    // Espera as leituras que a alocação pedia (professores, disciplinas, vínculos): com elas lidas, a ausência da seção não é falta de leitura.
    await waitFor(() => expect(celulasDe('7ºA').slice(2, 4)).toEqual(['Beatriz Sintética, Camila Sintética +1', 'Com professor']))
    const cheios = within(document.body)
      .getAllByRole('button')
      .filter((botao) => botao.className.includes('bg-laranja'))
    expect(cheios.map((botao) => botao.textContent)).toEqual(['Nova turma'])
    expect(screen.queryByRole('region', { name: 'Alocação' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Alocar' })).toBeNull()
  })
})

describe('"Para terminar a escola"', () => {
  it('enquanto falta passo: o aviso diz o que falta e "Ver o que falta" abre o painel no endereço', async () => {
    const usuario = userEvent.setup()
    // Sem professor alocável e sem vínculo: faltam Professores e Alocação.
    instalar(fakeNetwork(), { professores: ok([]), vinculos: ok([]) })
    const localizacao = await montarEEsperar()
    const aviso = await screen.findByText('Para terminar a escola')
    expect(aviso.closest('[data-aviso]')?.textContent).toContain('Falta: Professores, Alocação.')
    await usuario.click(screen.getByRole('button', { name: 'Ver o que falta' }))
    expect(localizacao.history?.at(-1)).toBe('/estrutura?painel=falta')
    const painel = await screen.findByRole('dialog', { name: 'O que falta' })
    const roteiro = within(painel).getByRole('region', { name: 'O que falta para a escola começar' })
    expect(within(roteiro).getAllByRole('listitem')).toHaveLength(7)
    // A lista de nomes não tem marca, e a onça não entra.
    expect(roteiro.textContent).toContain('Lista de nomes')
    expect(roteiro.textContent).not.toMatch(/Lista de nomes · (falta|feito)/)
    expect(painel.querySelector('img, [data-onca]')).toBeNull()
  })

  it('com a escola montada, o aviso não existe', async () => {
    instalar(fakeNetwork(), { vinculos: ok([VINCULO(1, CAMILA, TURMA_7A, MATEMATICA, 'confirmado')]) })
    // O painel do ano mostra as séries e as disciplinas, e por isso só tem o que mostrar quando as duas foram lidas.
    await montarEEsperar('/estrutura?painel=ano')
    await turmas().findByRole('link', { name: 'Lista de nomes da turma 7ºA' })
    // Espera as leituras de que o "falta" depende: o aviso ausente precisa vir da escola montada, e não de a leitura não ter terminado.
    await waitFor(() => expect(celulasDe('7ºA').slice(2, 4)).toEqual(['Camila Sintética', 'Com professor']))
    const painelDoAno = await screen.findByRole('dialog', { name: 'Ano letivo e disciplinas' })
    await within(painelDoAno).findByText('Matemática')
    await within(painelDoAno).findByText('7º ano do Ensino Fundamental')
    expect(screen.queryByText('Para terminar a escola')).toBeNull()
  })

  it('"falta" só com a leitura terminada: o que ainda não foi lido não vira passo que falta', async () => {
    // As séries, as disciplinas e os professores nunca respondem; as turmas e os vínculos, sim.
    instalar(fakeNetwork(), { series: nuncaResponde, disciplinas: nuncaResponde, professores: nuncaResponde, turmas: ok([]), vinculos: ok([]) })
    await montarEEsperar()
    const aviso = (await screen.findByText('Para terminar a escola')).closest('[data-aviso]')
    expect(aviso?.textContent).toContain('Falta: Turmas, Alocação.')
    expect(aviso?.textContent).not.toMatch(/Séries|Disciplinas|Professores/)
  })
})

describe('o filtro "Situação"', () => {
  it('"Sem professor" deixa as turmas sem professor, grava no endereço e a escolha de volta tira do endereço', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork())
    const localizacao = await montarEEsperar()
    await turmas().findByRole('link', { name: 'Lista de nomes da turma 7ºA' })
    expect(screen.getByRole('radio', { name: 'Todas' }).getAttribute('aria-checked')).toBe('true')
    await usuario.click(screen.getByRole('radio', { name: 'Sem professor' }))
    expect(localizacao.history?.at(-1)).toBe('/estrutura?situacao=sem-professor')
    // Filtrar troca o endereço, e não empilha um passo no histórico a cada escolha.
    expect(localizacao.history).toHaveLength(1)
    await waitFor(() => expect(turmas().queryByRole('link', { name: 'Lista de nomes da turma 7ºA' })).toBeNull())
    expect(
      turmas()
        .getAllByRole('link')
        .map((ligacao) => ligacao.textContent),
    ).toEqual(['7ºB', '8ºA'])
    // A 1ºA, com vínculo só pendente, tem professor: não entra.
    expect(turmas().queryByRole('link', { name: 'Lista de nomes da turma 1ºA' })).toBeNull()
    await usuario.click(screen.getByRole('radio', { name: 'Todas' }))
    expect(localizacao.history?.at(-1)).toBe('/estrutura')
    expect(await turmas().findByRole('link', { name: 'Lista de nomes da turma 7ºA' })).toBeTruthy()
  })

  it('o endereço com a situação abre já filtrado, e valor desconhecido são todas', async () => {
    instalar(fakeNetwork())
    await montarEEsperar('/estrutura?situacao=sem-professor')
    await turmas().findByRole('link', { name: 'Lista de nomes da turma 7ºB' })
    expect(screen.getByRole('radio', { name: 'Sem professor' }).getAttribute('aria-checked')).toBe('true')
    expect(turmas().getAllByRole('link')).toHaveLength(2)
    cleanup()
    instalar(fakeNetwork())
    await montarEEsperar('/estrutura?situacao=sem-lista')
    expect((await turmas().findAllByRole('link')).length).toBe(4)
    expect(screen.getByRole('radio', { name: 'Todas' }).getAttribute('aria-checked')).toBe('true')
  })

  it('o filtro que não acha nada diz "Nenhuma turma sem professor"', async () => {
    instalar(fakeNetwork(), { vinculos: ok([...VINCULOS, VINCULO(7, RAFAEL, TURMA_7B, MATEMATICA, 'confirmado'), VINCULO(8, CAMILA, TURMA_8A, FISICA, 'pendente')]) })
    await montarEEsperar('/estrutura?situacao=sem-professor')
    expect(await turmas().findByText('Nenhuma turma sem professor')).toBeTruthy()
    expect(turmas().queryByRole('table')).toBeNull()
  })

  it('os vínculos ainda não lidos: o filtro espera por eles, e não mostra lista que pode estar errada', async () => {
    instalar(fakeNetwork(), { vinculos: nuncaResponde })
    await montarEEsperar('/estrutura?situacao=sem-professor')
    expect(await within(screen.getByRole('region', { name: 'Turmas de 2026' })).findByText('Carregando os professores das turmas…')).toBeTruthy()
    expect(turmas().queryByRole('link')).toBeNull()
  })

  it('os vínculos que falharam: o filtro mostra o erro com "Tentar de novo"; sem filtro a tabela fica e o aviso diz que os professores não carregaram', async () => {
    instalar(fakeNetwork(), { vinculos: FALHA })
    await montarEEsperar('/estrutura?situacao=sem-professor')
    await turmas().findByRole('alert')
    expect(turmas().queryByRole('link')).toBeNull()
    cleanup()
    instalar(fakeNetwork(), { vinculos: FALHA })
    await montarEEsperar()
    expect(await turmas().findByText('Os professores das turmas não carregaram')).toBeTruthy()
    expect(celulasDe('7ºA').slice(2, 4)).toEqual(['—', '—'])
  })

  it('os vínculos que vieram só em parte: a turma sem professor à vista não é dada como sem professor, e o filtro diz que não consegue afirmar', async () => {
    instalar(fakeNetwork(), { vinculos: ok([VINCULOS[0]], { proxima: id(900) }) })
    await montarEEsperar()
    await turmas().findByText('Com professor')
    expect(celulasDe('7ºA')[3]).toBe('Com professor')
    expect(celulasDe('8ºA')[3]).toBe('—')
    // O "Sem professor" que sobra é a opção do filtro: nenhuma linha leva a marca.
    expect(
      turmas()
        .queryAllByText('Sem professor')
        .filter((marca) => marca.getAttribute('role') !== 'radio'),
    ).toEqual([])
    // E o filtro não afirma: diz que a tela não lê todos os vínculos, em vez de mostrar uma lista que pode estar errada.
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Sem professor' }))
    expect(await turmas().findByText(/A escola tem mais vínculos do que esta tela lê/)).toBeTruthy()
    expect(turmas().queryByRole('table')).toBeNull()
  })
})

describe('as leituras da tela', () => {
  it('nenhuma é a lista de nomes: a tabela não tem contagem de nomes, "sem lista" nem chamada à lista', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    await montarEEsperar()
    await turmas().findByRole('link', { name: 'Lista de nomes da turma 7ºA' })
    expect(chamouAlgumaLista(rede)).toBe(false)
    expect(screen.queryByText(/sem lista/i)).toBeNull()
    expect(turmas().queryByRole('columnheader', { name: /nomes/i })).toBeNull()
  })

  it('a tela lê os anos, as séries, as disciplinas, as turmas, os professores e os vínculos, e só eles', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    await montarEEsperar()
    await turmas().findByRole('link', { name: 'Lista de nomes da turma 7ºA' })
    expect([...new Set(caminhosDe(rede))].sort()).toEqual(['/v1/anos-letivos', '/v1/disciplinas', '/v1/professores', '/v1/series', '/v1/turmas', '/v1/vinculos'])
  })
})

describe('o painel "Ano letivo e disciplinas"', () => {
  it('"Ano letivo e disciplinas" abre o painel no endereço, com as regiões de hoje, e "Fechar" tira o parâmetro', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork())
    const localizacao = await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Ano letivo e disciplinas' }))
    expect(localizacao.history?.at(-1)).toBe('/estrutura?painel=ano')
    const painel = await screen.findByRole('dialog', { name: 'Ano letivo e disciplinas' })
    for (const nome of ['Ano letivo', 'Séries', 'Disciplinas']) expect(within(painel).getByRole('region', { name: nome })).toBeTruthy()
    expect(within(painel).getByRole('button', { name: 'Novo ano letivo' })).toBeTruthy()
    expect(within(painel).getByRole('button', { name: 'Nova série' })).toBeTruthy()
    expect(within(painel).getByRole('button', { name: 'Nova disciplina' })).toBeTruthy()
    expect(
      within(within(painel).getByRole('region', { name: 'Disciplinas' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['FísicaRenomear a disciplina FísicaExcluir a disciplina Física', 'MatemáticaRenomear a disciplina MatemáticaExcluir a disciplina Matemática'])
    await usuario.click(within(painel).getByRole('button', { name: 'Fechar' }))
    expect(localizacao.history?.at(-1)).toBe('/estrutura')
    expect(screen.queryByRole('dialog', { name: 'Ano letivo e disciplinas' })).toBeNull()
    // Abrir é um passo no histórico; fechar troca o endereço, sem passo novo: o Voltar não reabre o painel.
    expect(localizacao.history).toEqual(['/estrutura', '/estrutura'])
  })

  it('pelo endereço, abre já com o painel; parâmetro desconhecido não abre nada', async () => {
    instalar(fakeNetwork())
    await montarEEsperar('/estrutura?painel=ano')
    expect(await screen.findByRole('dialog', { name: 'Ano letivo e disciplinas' })).toBeTruthy()
    cleanup()
    instalar(fakeNetwork())
    await montarEEsperar('/estrutura?painel=roteiro')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('aberto já pelo endereço, sem botão que o tenha aberto, o painel fecha com o foco no título das turmas', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork())
    const localizacao = await montarEEsperar('/estrutura?painel=ano')
    const painel = await screen.findByRole('dialog', { name: 'Ano letivo e disciplinas' })
    expect(document.activeElement).not.toBe(screen.getByRole('heading', { name: 'Turmas de 2026' }))
    await usuario.click(within(painel).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(localizacao.history?.at(-1)).toBe('/estrutura')
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Turmas de 2026' }))
  })

  it('o painel pelo endereço só desenha depois dos anos: com a leitura no ar, nada dele aparece', async () => {
    instalar(fakeNetwork(), { anos: nuncaResponde })
    montar('/estrutura?painel=ano')
    await screen.findByText('Carregando a estrutura da escola…')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Séries' })).toBeNull()
  })

  it('o ano criado a partir do vazio abre o painel dele, onde o anúncio e o "Abrir o ano" moram', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let criado = false
    instalar(rede, { anos: () => ok(criado ? [ANO_PLANEJADO] : []) })
    rede.responderPor(/^\/v1\/anos-letivos$/, () => {
      criado = true
      return { status: 201, corpo: ANO_PLANEJADO }
    })
    const localizacao = montar()
    await usuario.click(await screen.findByRole('button', { name: 'Criar o ano letivo' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Novo ano letivo' })
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar ano letivo' }))
    await waitFor(() => expect(localizacao.history?.at(-1)).toBe('/estrutura?painel=ano'))
    const painel = await screen.findByRole('dialog', { name: 'Ano letivo e disciplinas' })
    expect(await within(painel).findByText(/Ano letivo \d{4} criado\. Abra o ano para criar as turmas\./)).toBeTruthy()
    expect(within(painel).getByRole('button', { name: /Abrir o ano letivo/ })).toBeTruthy()
  })
})

describe('o ano criado de dentro do painel', () => {
  it('o painel já está aberto: criar o ano outro não empilha mais um passo no histórico', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    const ANO_2099 = { ...ANO, id: id(3), ano: 2099, inicio: '2099-02-01', fim: '2099-12-15', situacao: 'planejado' }
    rede.responderPor(/^\/v1\/anos-letivos$/, { status: 201, corpo: ANO_2099 })
    const localizacao = montar('/estrutura?painel=ano')
    const painel = await screen.findByRole('dialog', { name: 'Ano letivo e disciplinas' })
    await usuario.click(within(painel).getByRole('button', { name: 'Novo ano letivo' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Novo ano letivo' })
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar ano letivo' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Novo ano letivo' })).toBeNull())
    expect(localizacao.history).toEqual(['/estrutura?painel=ano'])
  })
})

describe('o foco depois de cada ação', () => {
  /** A lista de turmas que a rede devolve, mudada pela escrita que o caso fez. */
  function turmasQueMudam(inicial: readonly object[]) {
    let atuais = inicial
    return {
      resposta: () => ok(atuais),
      trocar: (novas: readonly object[]) => {
        atuais = novas
      },
    }
  }

  it('criar: o diálogo fecha com a lista recarregada, a turma nova está na tabela, e o foco volta ao "Nova turma"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const lista = turmasQueMudam([TURMA_7A])
    instalar(rede, { turmas: lista.resposta, vinculos: ok([]) })
    const nova = { ...TURMA_7B, nome: '7ºC' }
    rede.responderPor(/^\/v1\/turmas$/, () => {
      lista.trocar([TURMA_7A, nova])
      return { status: 201, corpo: nova }
    })
    await montarEEsperar()
    const botao = await screen.findByRole('button', { name: 'Nova turma' })
    await usuario.click(botao)
    const dialogo = await screen.findByRole('dialog', { name: 'Nova turma em 2026' })
    await usuario.type(within(dialogo).getByLabelText('Nome da turma'), '7ºC')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar turma' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nova turma em 2026' })).toBeNull())
    expect(await turmas().findByRole('link', { name: 'Lista de nomes da turma 7ºC' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Turmas de 2026' })).getByRole('status').textContent).toBe('Turma 7ºC criada. Abra a turma para subir a lista de nomes.')
    expect(document.activeElement).toBe(botao)
  })

  it('renomear pelo menu da linha: o nome muda na linha, o anúncio fica na seção e o foco volta ao menu da própria linha', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const lista = turmasQueMudam([TURMA_7A, TURMA_8A])
    instalar(rede, { turmas: lista.resposta, vinculos: ok([]) })
    rede.responderPor(new RegExp(`^/v1/turmas/${TURMA_7A.id}$`), () => {
      lista.trocar([{ ...TURMA_7A, nome: '7ºA nova' }, TURMA_8A])
      return { status: 200, corpo: { ...TURMA_7A, nome: '7ºA nova' } }
    })
    await montarEEsperar()
    await usuario.click(await screen.findByRole('button', { name: 'Mais ações da turma 7ºA' }))
    await usuario.click(await screen.findByRole('menuitem', { name: 'Renomear' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Renomear a turma' })
    const campo = within(dialogo).getByLabelText('Nome da turma')
    await usuario.clear(campo)
    await usuario.type(campo, '7ºA nova')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar nome' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Renomear a turma' })).toBeNull())
    expect(await turmas().findByRole('link', { name: 'Lista de nomes da turma 7ºA nova' })).toBeTruthy()
    expect(turmas().getByRole('status').textContent).toBe('Turma renomeada para 7ºA nova.')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mais ações da turma 7ºA nova' })))
  })

  it('excluir pelo menu da linha: a turma sai da tabela e o foco vai ao título das turmas, porque o menu saiu com a linha', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const lista = turmasQueMudam([TURMA_7A, TURMA_8A])
    instalar(rede, { turmas: lista.resposta, vinculos: ok([]) })
    rede.responderPor(new RegExp(`^/v1/turmas/${TURMA_8A.id}$`), () => {
      lista.trocar([TURMA_7A])
      return { status: 204 }
    })
    await montarEEsperar()
    await usuario.click(await screen.findByRole('button', { name: 'Mais ações da turma 8ºA' }))
    await usuario.click(await screen.findByRole('menuitem', { name: 'Excluir' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Excluir a turma' })
    expect(dialogo.textContent).toContain('8ºA')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Excluir turma' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Excluir a turma' })).toBeNull())
    await waitFor(() => expect(turmas().queryByRole('link', { name: 'Lista de nomes da turma 8ºA' })).toBeNull())
    expect(turmas().getByRole('status').textContent).toBe('Turma 8ºA excluída.')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Turmas de 2026' })))
  })

  it('o menu da linha tem Renomear e Excluir, e o Excluir é a ação de perigo', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork())
    await montarEEsperar()
    await usuario.click(await screen.findByRole('button', { name: 'Mais ações da turma 7ºA' }))
    const itens = await screen.findAllByRole('menuitem')
    expect(itens.map((item) => item.textContent)).toEqual(['Renomear', 'Excluir'])
    expect(itens[1]?.className).toContain('text-vermelho-texto')
    expect(itens[0]?.className).not.toContain('text-vermelho-texto')
  })
})
