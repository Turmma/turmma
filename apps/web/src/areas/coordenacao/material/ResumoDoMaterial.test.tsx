// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../../api/query-client'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import { RESUMO_DO_MATERIAL_QUERY_KEY } from './api/resumo'
import { ResumoDoMaterial } from './ResumoDoMaterial'

/**
 * O resumo no topo da aba Material (ingestao-do-material, 11.0; RF18; `cenarios.md`, "Telas"): os quatro estados, a tabela do computador e a lista do celular, o aviso das séries da migração e a releitura que cai com o
 * número de antes na tela. A rede é falsa e responde por caminho; o que só o navegador mede (a página que não rola, o celular de 360 px de verdade, a segunda pessoa na aba) é do e2e `material`.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const QUIMICA = { id: id(500), nome: 'Química', area: null }
const FISICA = { id: id(501), nome: 'Física', area: null }
const SERIE_6 = { id: id(600), etapa: 'ef_anos_finais', ano: 6 }
const SERIE_9 = { id: id(603), etapa: 'ef_anos_finais', ano: 9 }
const SERIE_2EM = { id: id(610), etapa: 'em', ano: 2 }
const linha = (parte: Record<string, unknown>) => ({ disciplinaId: QUIMICA.id, serieId: SERIE_6.id, pronto: 0, processando: 0, falhou: 0, recusados30Dias: 0, ...parte })

const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const lista = (itens: readonly unknown[]): FakeResponse => ok({ itens })
const FALHA: FakeResponse = { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }

function instalar(rede: FakeNetwork, resumo: FakeResponse | (() => FakeResponse | Promise<FakeResponse>), series: readonly unknown[] = [SERIE_6, SERIE_9, SERIE_2EM]): void {
  rede.responderPor('/v1/materiais/resumo', resumo)
  rede.responderPor('/v1/disciplinas', lista([FISICA, QUIMICA]))
  rede.responderPor('/v1/series', lista(series))
}

/** A largura da janela, para a consulta `(min-width: 768px)` que a `Table` lê. */
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
})

const tabela = () => within(screen.getByRole('table', { name: 'Resumo do material por disciplina e série' }))
/** As linhas do corpo da tabela, com o texto de cada célula. */
const celulasDasLinhas = () =>
  tabela()
    .getAllByRole('row')
    .filter((linhaDaTabela) => within(linhaDaTabela).queryAllByRole('columnheader').length === 0)
    .map((linhaDaTabela) => Array.from(linhaDaTabela.children).map((celula) => celula.textContent))
const VAZIO = /Ainda não há material para resumir/
/** Um material pronto com as séries dadas, o que o aviso da migração lê da lista (o `id` é só o que a lista traz a mais). */
let seguinte = 900
const comSeries = (serieIds: string[]) => ({ id: id(seguinte++), estado: 'pronto' as const, serieIds })

describe('o resumo do material: os quatro estados', () => {
  it('carregando: o texto parado, sem tabela e sem o vazio; quando a leitura termina, o vazio aparece', async () => {
    const rede = fakeNetwork()
    instalar(rede, () => new Promise<FakeResponse>((resolver) => setTimeout(() => resolver(ok({ linhas: [], semSerie: 0 })), 50)))
    renderScreen(<ResumoDoMaterial materiais={undefined} />)

    expect(screen.getByText('Carregando o resumo…')).toBeTruthy()
    expect(screen.queryByText(VAZIO)).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    // O controle: a mesma tela, com a leitura terminada, diz o vazio, e o carregando sai.
    expect(await screen.findByText(VAZIO)).toBeTruthy()
    expect(screen.queryByText('Carregando o resumo…')).toBeNull()
  })

  it('erro: a mensagem e "Tentar de novo o resumo", que lê de novo e mostra o resumo; o vazio não é dito no lugar do erro', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhar = true
    instalar(rede, () => (falhar ? FALHA : ok({ linhas: [linha({ pronto: 3 })], semSerie: 0 })))
    renderScreen(<ResumoDoMaterial materiais={undefined} />)

    const tentar = await screen.findByRole('button', { name: 'Tentar de novo o resumo' })
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByText(VAZIO)).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    falhar = false
    await usuario.click(tentar)
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(celulasDasLinhas()).toEqual([['Química', '6º ano do Ensino Fundamental', '3', '0', '0', '0']])
  })

  it.each(['/v1/materiais/resumo', '/v1/disciplinas', '/v1/series'])('carregando enquanto só %s não chegou: o texto parado, sem erro, sem o vazio e sem tabela', async (caminho) => {
    const rede = fakeNetwork()
    // A rede falsa responde com a primeira resposta registrada por caminho: a do caso vem antes das de sempre.
    rede.responderPor(caminho, () => new Promise<FakeResponse>(() => undefined))
    instalar(rede, ok({ linhas: [linha({ pronto: 1 })], semSerie: 0 }))
    renderScreen(<ResumoDoMaterial materiais={undefined} />)

    await waitFor(() => expect(rede.chamadas.length).toBeGreaterThanOrEqual(3))
    // As outras duas leituras já responderam: o que segura o texto é só a que ficou no ar.
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(screen.getByText('Carregando o resumo…')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(VAZIO)).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it.each(['/v1/materiais/resumo', '/v1/disciplinas', '/v1/series'])('erro enquanto só %s falhou: a mensagem do erro dela, e "Tentar de novo o resumo", que lê as três de novo e mostra a tabela', async (caminho) => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhar = true
    rede.responderPor(caminho, () => (falhar ? FALHA : caminho === '/v1/materiais/resumo' ? ok({ linhas: [linha({ pronto: 1 })], semSerie: 0 }) : lista(caminho === '/v1/series' ? [SERIE_6] : [QUIMICA])))
    instalar(rede, ok({ linhas: [linha({ pronto: 1 })], semSerie: 0 }))
    renderScreen(<ResumoDoMaterial materiais={undefined} />)

    expect((await screen.findByRole('alert')).textContent).toBe('Muitas tentativas em pouco tempo. Aguarde um pouco e tente de novo.')
    const tentar = screen.getByRole('button', { name: 'Tentar de novo o resumo' })
    expect(screen.queryByRole('table')).toBeNull()
    // O botão é `secundario` e tem nome próprio: o "Tentar de novo" da lista, com as duas leituras caídas, é o outro.
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    falhar = false
    await usuario.click(tentar)
    expect(await screen.findByRole('table', { name: 'Resumo do material por disciplina e série' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('vazio: o convite a enviar o primeiro PDF, sem tabela e sem aviso', async () => {
    instalar(fakeNetwork(), ok({ linhas: [], semSerie: 0 }))
    renderScreen(<ResumoDoMaterial materiais={[]} />)

    expect(await screen.findByText(VAZIO)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('com dado: a tabela por disciplina e série, em ordem (Física antes de Química; 6º ao 9º antes do Médio; o sem série por último), cada número na sua coluna', async () => {
    instalar(
      fakeNetwork(),
      ok({
        linhas: [
          linha({ disciplinaId: QUIMICA.id, serieId: null, pronto: 1 }),
          linha({ disciplinaId: QUIMICA.id, serieId: SERIE_2EM.id, pronto: 4, processando: 1, falhou: 2, recusados30Dias: 5 }),
          linha({ disciplinaId: FISICA.id, serieId: SERIE_9.id, pronto: 1200 }),
          linha({ disciplinaId: QUIMICA.id, serieId: SERIE_6.id, processando: 7 }),
        ],
        semSerie: 1,
      }),
    )
    renderScreen(<ResumoDoMaterial materiais={[]} />)

    expect(await screen.findByRole('table', { name: 'Resumo do material por disciplina e série' })).toBeTruthy()
    expect(tabela().getAllByRole('columnheader').map((coluna) => coluna.textContent)).toEqual(['Disciplina', 'Série', 'Prontos', 'Processando', 'Com falha', 'Recusados em 30 dias'])
    expect(celulasDasLinhas()).toEqual([
      ['Física', '9º ano do Ensino Fundamental', '1.200', '0', '0', '0'],
      ['Química', '6º ano do Ensino Fundamental', '0', '7', '0', '0'],
      ['Química', '2º ano do Ensino Médio', '4', '1', '2', '5'],
      ['Química', 'Sem série', '1', '0', '0', '0'],
    ])
    expect(screen.getByRole('heading', { name: 'Resumo do material' })).toBeTruthy()
    // Com linhas, o convite do vazio não é dito.
    expect(screen.queryByText(VAZIO)).toBeNull()
  })
})

describe('o resumo do material: tabela no computador, lista no celular', () => {
  const COM_DADO = ok({ linhas: [linha({ pronto: 3, processando: 1, falhou: 2, recusados30Dias: 4 })], semSerie: 0 })

  it('a 1366 px é tabela, e não lista', async () => {
    instalar(fakeNetwork(), COM_DADO)
    renderScreen(<ResumoDoMaterial materiais={[]} />)

    expect(await screen.findByRole('table', { name: 'Resumo do material por disciplina e série' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Resumo do material por disciplina e série' })).toBeNull()
  })

  it('a 360 px é lista, com o nome de cada número ao lado dele, e não tabela', async () => {
    janelaDe(360)
    instalar(fakeNetwork(), COM_DADO)
    renderScreen(<ResumoDoMaterial materiais={[]} />)

    const itens = await screen.findByRole('list', { name: 'Resumo do material por disciplina e série' })
    expect(screen.queryByRole('table')).toBeNull()
    const item = within(itens).getByRole('listitem')
    expect(item.textContent).toContain('Química')
    expect(Array.from(item.querySelectorAll('dt')).map((nome) => nome.textContent)).toEqual(['Série', 'Prontos', 'Processando', 'Com falha', 'Recusados em 30 dias'])
    expect(Array.from(item.querySelectorAll('dd')).map((valor) => valor.textContent)).toEqual(['6º ano do Ensino Fundamental', '3', '1', '2', '4'])
  })
})

describe('o resumo do material: o aviso das séries atribuídas na migração', () => {
  it('com material sem série: o aviso diz quantos, e no singular com um só', async () => {
    instalar(fakeNetwork(), ok({ linhas: [linha({ serieId: null, pronto: 2 })], semSerie: 2 }))
    renderScreen(<ResumoDoMaterial materiais={[comSeries([]), comSeries([])]} />)

    expect((await screen.findByRole('note')).textContent).toBe('Séries atribuídas na migração: 2 materiais estão sem série e não aparecem para nenhuma turma. Confira a série de cada um.')
  })

  it('com um só material sem série: o aviso no singular', async () => {
    instalar(fakeNetwork(), ok({ linhas: [linha({ serieId: null, pronto: 1 })], semSerie: 1 }))
    renderScreen(<ResumoDoMaterial materiais={[comSeries([])]} />)

    expect((await screen.findByRole('note')).textContent).toBe('Séries atribuídas na migração: 1 material está sem série e não aparece para nenhuma turma. Confira a série de cada um.')
  })

  it('com material de todas as séries da escola: o aviso aparece, mesmo sem material sem série', async () => {
    instalar(fakeNetwork(), ok({ linhas: [linha({ pronto: 1 })], semSerie: 0 }))
    renderScreen(<ResumoDoMaterial materiais={[comSeries([SERIE_6.id]), comSeries([SERIE_6.id, SERIE_9.id, SERIE_2EM.id])]} />)

    expect((await screen.findByRole('note')).textContent).toMatch(/^Séries atribuídas na migração: o material enviado antes da declaração de séries vale para todas as séries da escola/)
  })

  it('sem material sem série e sem material de todas as séries, não há aviso; escola de uma série só não o dispara com todas', async () => {
    instalar(fakeNetwork(), ok({ linhas: [linha({ pronto: 1 })], semSerie: 0 }))
    renderScreen(<ResumoDoMaterial materiais={[comSeries([SERIE_6.id]), comSeries([SERIE_9.id, SERIE_2EM.id])]} />)

    // A tabela é o controle: com ela na tela, a leitura terminou e o aviso, se viesse, já estaria aqui.
    expect(await screen.findByRole('table', { name: 'Resumo do material por disciplina e série' })).toBeTruthy()
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('escola de uma série só: o material dela, que tem "todas", não dispara o aviso', async () => {
    instalar(fakeNetwork(), ok({ linhas: [linha({ pronto: 1 })], semSerie: 0 }), [SERIE_6])
    renderScreen(<ResumoDoMaterial materiais={[comSeries([SERIE_6.id])]} />)

    expect(await screen.findByRole('table', { name: 'Resumo do material por disciplina e série' })).toBeTruthy()
    expect(screen.queryByRole('note')).toBeNull()
  })
})

describe('o resumo do material: a releitura', () => {
  const material = (n: number, estado: 'processando' | 'pronto' | 'falhou') => ({ id: id(n), estado, serieIds: [SERIE_6.id] })
  const doResumo = (rede: FakeNetwork) => rede.chamadas.filter((chamada) => chamada.caminho === '/v1/materiais/resumo').length

  /** A aba: o resumo dentro de um cliente que o caso guarda, para a lista "relida" ser outra renderização do mesmo cliente. */
  function montar(cliente: ReturnType<typeof createQueryClient>, materiais: Parameters<typeof ResumoDoMaterial>[0]['materiais']) {
    return (
      <QueryClientProvider client={cliente}>
        <ResumoDoMaterial materiais={materiais} />
      </QueryClientProvider>
    )
  }

  it('a releitura que falha, com o resumo já na tela, diz o erro ao lado dele, e o número de antes fica', async () => {
    const rede = fakeNetwork()
    let chamadas = 0
    instalar(rede, () => {
      chamadas += 1
      if (chamadas === 1) return ok({ linhas: [linha({ pronto: 5, processando: 1 })], semSerie: 0 })
      // A segunda leitura, a que o estado que mudou na lista pede, cai; a terceira (o "Tentar de novo o resumo") fica no ar.
      return chamadas === 2 ? FALHA : new Promise<FakeResponse>(() => undefined)
    })
    const cliente = createQueryClient()
    const { rerender } = render(montar(cliente, [material(1, 'processando')]))

    expect(await screen.findByRole('table', { name: 'Resumo do material por disciplina e série' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    rerender(montar(cliente, [material(1, 'pronto')]))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(celulasDasLinhas()).toEqual([['Química', '6º ano do Ensino Fundamental', '5', '1', '0', '0']])
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar de novo o resumo' }))
    // Enquanto a leitura seguinte corre, ao lado do erro, a tela diz que está tentando.
    expect(await screen.findByText('Tentando de novo…')).toBeTruthy()
  })

  it('o resumo se relê quando a lista mostra que um estado mudou, e não quando ela é lida de novo igual', async () => {
    const rede = fakeNetwork()
    // O resumo não conta `processando` (o material 1 já terminou lá): só a assinatura da lista, e não o resumo atrasado, pode pedir a releitura.
    instalar(rede, ok({ linhas: [linha({ pronto: 2 })], semSerie: 0 }))
    const cliente = createQueryClient()
    const { rerender } = render(montar(cliente, [material(1, 'processando'), material(2, 'pronto')]))
    await screen.findByRole('table', { name: 'Resumo do material por disciplina e série' })
    expect(doResumo(rede)).toBe(1)

    // A lista lida de novo, com os mesmos estados (até em outra ordem): nenhum pedido a mais.
    rerender(montar(cliente, [material(2, 'pronto'), material(1, 'processando')]))
    await new Promise((resolver) => setTimeout(resolver, 100))
    expect(doResumo(rede)).toBe(1)

    // Um material que terminou: o resumo se relê, uma vez.
    rerender(montar(cliente, [material(2, 'pronto'), material(1, 'pronto')]))
    await waitFor(() => expect(doResumo(rede)).toBe(2))
    await new Promise((resolver) => setTimeout(resolver, 100))
    expect(doResumo(rede)).toBe(2)
  })

  it('o resumo não se relê sozinho, mesmo contando material `processando`: o laço de 1,5 s é só da lista', async () => {
    const rede = fakeNetwork()
    instalar(rede, ok({ linhas: [linha({ processando: 2 })], semSerie: 0 }))
    renderScreen(<ResumoDoMaterial materiais={[material(1, 'processando'), material(2, 'processando')]} />)
    await screen.findByRole('table', { name: 'Resumo do material por disciplina e série' })

    await new Promise((resolver) => setTimeout(resolver, 1_800))
    expect(doResumo(rede)).toBe(1)
  })

  it('o material que terminou entre a primeira leitura do resumo e a da lista: o resumo, que ainda conta `processando`, se relê', async () => {
    const rede = fakeNetwork()
    let chamadas = 0
    instalar(rede, () => {
      chamadas += 1
      return ok({ linhas: [chamadas === 1 ? linha({ processando: 1 }) : linha({ pronto: 1 })], semSerie: 0 })
    })
    const cliente = createQueryClient()
    const { rerender } = render(montar(cliente, undefined))
    expect(await screen.findByRole('table', { name: 'Resumo do material por disciplina e série' })).toBeTruthy()
    expect(celulasDasLinhas()).toEqual([['Química', '6º ano do Ensino Fundamental', '0', '1', '0', '0']])

    // A lista chega depois, e já sem material `processando`: não há assinatura anterior para comparar, e o resumo ficou para trás.
    rerender(montar(cliente, [material(1, 'pronto')]))
    await waitFor(() => expect(celulasDasLinhas()).toEqual([['Química', '6º ano do Ensino Fundamental', '1', '0', '0', '0']]))
    expect(doResumo(rede)).toBe(2)
  })

  it('o resumo que chega depois da lista, ainda contando `processando`, se relê: a lista chegou antes e já não tem material processando', async () => {
    const rede = fakeNetwork()
    let chamadas = 0
    let liberar: ((resposta: FakeResponse) => void) | undefined
    instalar(rede, () => {
      chamadas += 1
      if (chamadas > 1) return ok({ linhas: [linha({ pronto: 1 })], semSerie: 0 })
      return new Promise<FakeResponse>((resolver) => {
        liberar = resolver
      })
    })
    // A lista já está lida, sem `processando`, e a leitura do resumo ainda está no ar.
    renderScreen(<ResumoDoMaterial materiais={[material(1, 'pronto')]} />)
    await waitFor(() => expect(liberar).toBeDefined())

    // O material terminou depois de o banco responder o resumo: ele chega contando `processando`.
    liberar?.(ok({ linhas: [linha({ processando: 1 })], semSerie: 0 }))

    await waitFor(() => expect(celulasDasLinhas()).toEqual([['Química', '6º ano do Ensino Fundamental', '1', '0', '0', '0']]))
    expect(doResumo(rede)).toBe(2)
  })

  it('o resumo relido que ainda conta `processando`, com a lista sem nenhum, não se relê de novo: uma releitura só, sem laço', async () => {
    const rede = fakeNetwork()
    // O descompasso que não se desfaz: a escola acima do teto de páginas da lista, ou a releitura que caiu com o resumo antigo no cache.
    instalar(rede, ok({ linhas: [linha({ processando: 1 })], semSerie: 0 }))
    renderScreen(<ResumoDoMaterial materiais={[material(1, 'pronto')]} />)

    // A primeira leitura, e a releitura que o resumo atrasado pede.
    await waitFor(() => expect(doResumo(rede)).toBeGreaterThanOrEqual(2))
    await new Promise((resolver) => setTimeout(resolver, 100))
    expect(doResumo(rede)).toBe(2)
  })

  it('a primeira lista lida, em dia com o resumo, não o relê', async () => {
    const rede = fakeNetwork()
    instalar(rede, ok({ linhas: [linha({ pronto: 1 })], semSerie: 0 }))
    const cliente = createQueryClient()
    const { rerender } = render(montar(cliente, undefined))
    await screen.findByRole('table', { name: 'Resumo do material por disciplina e série' })
    rerender(montar(cliente, [material(1, 'pronto')]))
    await new Promise((resolver) => setTimeout(resolver, 100))
    expect(doResumo(rede)).toBe(1)
  })

  it('a releitura que falha com o resumo vazio na tela diz o erro, e não diz que não há material: o que a escola tem, a tela não sabe', async () => {
    const rede = fakeNetwork()
    let chamadas = 0
    instalar(rede, () => {
      chamadas += 1
      return chamadas === 1 ? ok({ linhas: [], semSerie: 0 }) : FALHA
    })
    const cliente = createQueryClient()
    render(
      <QueryClientProvider client={cliente}>
        <ResumoDoMaterial materiais={[]} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText(VAZIO)).toBeTruthy()
    await cliente.refetchQueries({ queryKey: RESUMO_DO_MATERIAL_QUERY_KEY })

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText(VAZIO)).toBeNull()
    expect(screen.queryByRole('table', { name: 'Resumo do material por disciplina e série' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Tentar de novo o resumo' })).toBeTruthy()
  })
})
