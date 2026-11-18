// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, type Mock } from 'vitest'
import { fakeNetwork, renderScreen, setupScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import { ClassificacaoDoMaterial } from './ClassificacaoDoMaterial'
import { TEXTO_DA_SUSPENSAO, TEXTO_DO_RECLASSIFICAR_SEM_O_QUE_REFAZER, TEXTO_DO_VAZIO_DA_CLASSIFICACAO } from './classificacao'

/**
 * A seção "Habilidades da BNCC" do painel do material (classificacao-bncc, 8.0; RF6, RF12; `cenarios.md`, "Telas"): os quatro estados da leitura, os cinco rótulos, a origem e o código com a descrição, o seletor de 0 a 5, a correção
 * e as falhas dela, o "Reclassificar" com a confirmação do que refaz, e os dois avisos (sem componente, função suspensa). A rede é falsa e responde por caminho; o que só o navegador mede (o painel inteiro, o foco do Esc dentro do
 * `<dialog>`, o 1366 × 768, o celular, o recomeço de um material para outro) é do e2e `material-classificacao`.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const MATERIAL_ID = id(1)
const MATERIAL = {
  id: MATERIAL_ID,
  titulo: 'Apostila de Ciências',
  disciplinaId: id(500),
  titularidade: 'escola',
  licenciante: null,
  licencaId: null,
  edicao: null,
  substitui: null,
  serieIds: [id(600)],
  licenca: 'autoria_da_escola',
  estado: 'pronto',
  falha: null,
  paginas: 40,
  trechos: 40,
  enviadoEm: '2026-10-04T12:00:00.000Z',
}
const habilidade = (n: number, origem: 'ia' | 'coordenacao' = 'ia') => ({ codigo: `EF06CI0${String(n)}`, descricao: `Descrição da habilidade ${String(n)}`, origem })
const candidata = (n: number) => ({ codigo: `EF06CI0${String(n)}`, descricao: `Descrição da habilidade ${String(n)}` })
const CANDIDATAS = [1, 2, 3, 4, 5, 6, 7].map(candidata)

type Secao = ReturnType<typeof secao>
function secao(n: number, parte: Record<string, unknown> = {}) {
  return {
    id: id(100 + n),
    ordem: n,
    paginaInicial: n * 10 - 9,
    paginaFinal: n * 10,
    capitulo: { numero: null, titulo: `Título ${String(n)}` } as { numero: number | null; titulo: string } | null,
    situacao: 'classificada',
    habilidades: [] as ReturnType<typeof habilidade>[],
    corrigida: false,
    ...parte,
  }
}

const ERRO = (codigo: string, status: number, cabecalhos?: Record<string, string>): FakeResponse => ({
  status,
  corpo: { erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } },
  ...(cabecalhos === undefined ? {} : { cabecalhos }),
})
const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })

interface Cenario {
  /** As seções que o `GET` devolve: o teste as muda para dizer o que a API passa a devolver. */
  readonly secoes: Secao[]
  readonly suspensa?: boolean
  readonly detalhe?: () => FakeResponse | Promise<FakeResponse>
  readonly candidatas?: () => FakeResponse | Promise<FakeResponse>
  readonly correcao?: () => FakeResponse | Promise<FakeResponse>
  readonly reclassificar?: () => FakeResponse | Promise<FakeResponse>
}

function instalar(rede: FakeNetwork, cenario: Cenario): void {
  rede.responderPor('/v1/habilidades-bncc', () => cenario.candidatas?.() ?? ok({ itens: CANDIDATAS, semComponente: false }))
  rede.responderPor(new RegExp(`^/v1/materiais/${MATERIAL_ID}/secoes/[0-9a-f-]{36}/habilidades$`), () => cenario.correcao?.() ?? ok(cenario.secoes[0]))
  rede.responderPor(`/v1/materiais/${MATERIAL_ID}/reclassificar`, () => cenario.reclassificar?.() ?? { status: 202, corpo: { secoes: 2, preservadas: 1 } })
  rede.responderPor(`/v1/materiais/${MATERIAL_ID}`, () => cenario.detalhe?.() ?? ok({ ...MATERIAL, capitulos: [], secoes: cenario.secoes, classificacaoSuspensa: cenario.suspensa ?? false }))
}

interface Opcoes {
  readonly semComponente?: boolean | undefined
}

function montar(opcoes: Opcoes = {}) {
  const semComponente = 'semComponente' in opcoes ? opcoes.semComponente : false
  renderScreen(<ClassificacaoDoMaterial material={{ id: MATERIAL_ID, estado: 'pronto' }} disciplina="Ciências" semComponente={semComponente} />)
  return within(screen.getByRole('region', { name: 'Habilidades da BNCC' }))
}

const pedidosDe = (rede: FakeNetwork) => rede.chamadas.map((chamada) => `${chamada.metodo} ${chamada.caminho.split('?')[0] ?? ''}`)
const quantos = (rede: FakeNetwork, pedido: string) => pedidosDe(rede).filter((feito) => feito === pedido).length
const LEITURA = `GET /v1/materiais/${MATERIAL_ID}`
const RECLASSIFICAR = `POST /v1/materiais/${MATERIAL_ID}/reclassificar`

/** O corpo do último pedido com o método dado. */
function corpoDo(metodo: string): unknown {
  const chamadas = (fetch as unknown as Mock).mock.calls as Array<[string, RequestInit | undefined]>
  const corpo = chamadas.findLast(([, opcoes]) => opcoes?.method === metodo)?.[1]?.body
  return typeof corpo === 'string' ? JSON.parse(corpo) : undefined
}

/** A linha de um capítulo pelo nome que ela mostra. */
async function linhaDe(secoes: ReturnType<typeof within>, titulo: string) {
  const itens: HTMLElement[] = await secoes.findAllByRole('listitem')
  const achado = itens.find((item) => item.textContent?.startsWith(titulo))
  if (achado === undefined) throw new Error(`o capítulo "${titulo}" não está na lista`)
  return within(achado)
}

describe('os quatro estados da leitura', () => {
  it('carregando: diz que carrega, sem o vazio nem o erro', async () => {
    instalar(fakeNetwork(), { secoes: [], detalhe: () => new Promise<FakeResponse>(() => undefined) as unknown as FakeResponse })
    const secao = montar()
    expect((await secao.findByRole('status')).textContent).toBe('Carregando as habilidades…')
    expect(secao.queryByText(TEXTO_DO_VAZIO_DA_CLASSIFICACAO)).toBeNull()
    expect(secao.queryByRole('alert')).toBeNull()
  })

  it('erro: diz o que aconteceu, "Tentar de novo" lê de novo, e o vazio não aparece enquanto a leitura não terminou', async () => {
    const usuario = userEvent.setup()
    let falha = true
    const secoes = [secao(1, { habilidades: [habilidade(1)] })]
    instalar(fakeNetwork(), { secoes, detalhe: () => (falha ? ERRO('LIMITE_EXCEDIDO', 429) : ok({ ...MATERIAL, capitulos: [], secoes, classificacaoSuspensa: false })) })
    const lida = montar()
    expect((await lida.findByRole('alert')).textContent).toBe('Não foi possível ler as habilidades.')
    expect(lida.queryByText(TEXTO_DO_VAZIO_DA_CLASSIFICACAO)).toBeNull()
    falha = false
    await usuario.click(lida.getByRole('button', { name: /Tentar de novo/ }))
    expect(await lida.findByText('Título 1')).toBeTruthy()
    expect(lida.queryByRole('alert')).toBeNull()
  })

  it('vazio: só com a leitura terminada, convida a esperar a noite e não oferece o que não há (nem "Reclassificar")', async () => {
    instalar(fakeNetwork(), { secoes: [] })
    const lida = montar()
    expect(await lida.findByText(TEXTO_DO_VAZIO_DA_CLASSIFICACAO)).toBeTruthy()
    expect(TEXTO_DO_VAZIO_DA_CLASSIFICACAO).toBe('Nenhum capítulo classificado ainda. A classificação roda à noite.')
    expect(lida.queryByRole('button', { name: 'Reclassificar' })).toBeNull()
    expect(lida.queryByRole('status')).toBeNull()
  })

  it('com dado: uma linha por capítulo, na ordem da API', async () => {
    instalar(fakeNetwork(), { secoes: [secao(1, { habilidades: [habilidade(1)] }), secao(2, { habilidades: [habilidade(2)] })] })
    const lida = montar()
    const itens = await lida.findAllByRole('listitem')
    expect(itens.filter((item) => item.textContent?.startsWith('Título')).map((item) => item.textContent?.slice(0, 8))).toEqual(['Título 1', 'Título 2'])
    // Abrir o painel não leva o foco a nenhum botão da seção (depois de os efeitos da montagem assentarem): quem o move é a pessoa.
    await act(async () => undefined)
    expect(document.activeElement).toBe(document.body)
  })
})

describe('o que cada capítulo diz', () => {
  it('os cinco rótulos, em texto, um por situação; a classificada só mostra as habilidades', async () => {
    instalar(fakeNetwork(), {
      secoes: [
        secao(1, { situacao: 'nao_agendada' }),
        secao(2, { situacao: 'aguardando' }),
        secao(3, { situacao: 'classificada', habilidades: [habilidade(3)] }),
        secao(4, { situacao: 'sem_habilidade' }),
        secao(5, { situacao: 'nao_classificada' }),
      ],
    })
    const lida = montar()
    const [um, dois, tres, quatro, cinco] = await Promise.all([1, 2, 3, 4, 5].map((n) => linhaDe(lida, `Título ${String(n)}`)))
    expect(um?.getByText('Ainda não classificado')).toBeTruthy()
    expect(dois?.getByText('Classificação à noite')).toBeTruthy()
    expect(quatro?.getByText('A IA não achou habilidade neste capítulo')).toBeTruthy()
    expect(cinco?.getByText('A classificação não terminou.')).toBeTruthy()
    // A classificada não tem selo de situação: as habilidades são o que ela mostra.
    expect(tres?.getByText(/EF06CI03/)).toBeTruthy()
    expect(lida.getAllByText(/Ainda não classificado|Classificação à noite|A IA não achou|A classificação não terminou/)).toHaveLength(4)
    // O "Reclassificar" da linha é só do capítulo que não terminou; a linha sem habilidade não tem lista.
    expect(lida.getAllByRole('button', { name: 'Reclassificar o material' })).toHaveLength(1)
    expect(quatro?.queryByRole('list')).toBeNull()
  })

  it('o capítulo que a coordenação deixou sem habilidade diz isso, e não "a IA não achou"', async () => {
    instalar(fakeNetwork(), { secoes: [secao(1, { situacao: 'sem_habilidade', corrigida: true })] })
    const lida = montar()
    expect(await lida.findByText('Sem habilidade neste capítulo, como a coordenação corrigiu')).toBeTruthy()
    expect(lida.queryByText('A IA não achou habilidade neste capítulo')).toBeNull()
  })

  it('o nome é "Capítulo N · título", o título sem número, ou "Páginas X a Y"; as habilidades levam código, descrição e origem; nunca "trecho" nem "seção"', async () => {
    instalar(fakeNetwork(), {
      secoes: [
        secao(3, { capitulo: { numero: 3, titulo: 'Frações' }, paginaInicial: 21, paginaFinal: 30, habilidades: [habilidade(1, 'ia')] }),
        secao(4, { capitulo: { numero: null, titulo: 'Apêndice' }, paginaInicial: 31, paginaFinal: 32, habilidades: [habilidade(2, 'coordenacao')], corrigida: true }),
        secao(5, { capitulo: null, paginaInicial: 41, paginaFinal: 50, situacao: 'nao_agendada' }),
      ],
    })
    const lida = montar()
    const frações = await linhaDe(lida, 'Capítulo 3 · Frações')
    expect(frações.getByText('Páginas 21 a 30')).toBeTruthy()
    expect(frações.getByText('Descrição da habilidade 1', { exact: false }).textContent).toBe('EF06CI01 Descrição da habilidade 1')
    expect(frações.getByText('Sugerida pela IA')).toBeTruthy()
    const apendice = await linhaDe(lida, 'Apêndice')
    expect(apendice.getByText('Corrigida pela coordenação')).toBeTruthy()
    expect(apendice.queryByText('Sugerida pela IA')).toBeNull()
    expect(await linhaDe(lida, 'Páginas 41 a 50')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Habilidades da BNCC' }).textContent).not.toMatch(/\btrechos?\b|\bse[cç][oõ][ae]s?\b/i)
  })
})

describe('os avisos', () => {
  it('sem componente: o aviso nomeia a disciplina, e "Corrigir" e "Reclassificar" ficam desligados', async () => {
    instalar(fakeNetwork(), { secoes: [secao(1, { situacao: 'nao_classificada' })] })
    const lida = montar({ semComponente: true })
    expect(await lida.findByText('Defina o componente da BNCC de Ciências na Estrutura para classificar este material')).toBeTruthy()
    expect((lida.getByRole('button', { name: /^Corrigir/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((lida.getByRole('button', { name: 'Reclassificar' }) as HTMLButtonElement).disabled).toBe(true)
    expect((lida.getByRole('button', { name: 'Reclassificar o material' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('com a disciplina ainda não lida, nada se corrige nem se reclassifica, e o aviso do componente não aparece', async () => {
    instalar(fakeNetwork(), { secoes: [secao(1, { habilidades: [habilidade(1)] })] })
    const lida = montar({ semComponente: undefined })
    expect(await lida.findByText('Título 1')).toBeTruthy()
    expect((lida.getByRole('button', { name: /^Corrigir/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(lida.queryByText(/Defina o componente/)).toBeNull()
  })

  it('função suspensa: o aviso diz que valem só as corrigidas, o capítulo que a IA não terminou fica só com o aviso, e não há "Reclassificar"', async () => {
    instalar(fakeNetwork(), { suspensa: true, secoes: [secao(1, { situacao: 'nao_classificada' }), secao(2, { habilidades: [habilidade(2, 'ia')] })] })
    const lida = montar()
    expect(await lida.findByText(TEXTO_DA_SUSPENSAO)).toBeTruthy()
    expect(TEXTO_DA_SUSPENSAO).toBe('A classificação pela IA está suspensa na escola. Valem só as habilidades corrigidas pela coordenação.')
    expect(lida.queryByRole('button', { name: /^Reclassificar/ })).toBeNull()
    expect(lida.queryByText('A classificação não terminou.')).toBeNull()
    // A sugestão da IA aparece, dizendo que não vale; corrigir continua possível.
    expect(lida.getByText('Sugerida pela IA (não vale enquanto a classificação está suspensa)')).toBeTruthy()
    expect((lida.getAllByRole('button', { name: /^Corrigir/ })[0] as HTMLButtonElement).disabled).toBe(false)
  })

  it('sem a suspensão, o aviso dela não aparece', async () => {
    instalar(fakeNetwork(), { secoes: [secao(1, { habilidades: [habilidade(1)] })] })
    const lida = montar()
    expect(await lida.findByText('Título 1')).toBeTruthy()
    expect(lida.queryByText(TEXTO_DA_SUSPENSAO)).toBeNull()
  })
})

describe('corrigir com o seletor', () => {
  it('abre com o que o capítulo já tem, lê as candidatas ao abrir, e "Salvar correção" manda os códigos; fecha e devolve o foco ao "Corrigir"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const secoes = [secao(1, { habilidades: [habilidade(1)] })]
    instalar(rede, {
      secoes,
      correcao: () => {
        secoes[0] = secao(1, { habilidades: [habilidade(1, 'coordenacao'), habilidade(2, 'coordenacao')], corrigida: true })
        return ok(secoes[0])
      },
    })
    const lida = montar()
    const linha = await linhaDe(lida, 'Título 1')
    expect(quantos(rede, 'GET /v1/habilidades-bncc')).toBe(0)
    await usuario.click(linha.getByRole('button', { name: /^Corrigir/ }))
    const seletor = await linha.findByRole('group', { name: 'Habilidades de Título 1' })
    await within(seletor).findByRole('checkbox', { name: /^EF06CI02/ })
    expect(quantos(rede, 'GET /v1/habilidades-bncc')).toBe(1)
    // A busca leva o material de que se trata: o recorte é o dele (componente da disciplina e séries).
    expect(rede.chamadas.map((chamada) => chamada.caminho)).toContain(`/v1/habilidades-bncc?materialId=${MATERIAL_ID}`)
    expect((within(seletor).getByRole('checkbox', { name: /^EF06CI01/ }) as HTMLInputElement).checked).toBe(true)
    expect(linha.getByText(/A correção vale no lugar da IA e não é refeita ao reclassificar/)).toBeTruthy()
    await usuario.click(within(seletor).getByRole('checkbox', { name: /^EF06CI02/ }))
    const antes = quantos(rede, LEITURA)
    await usuario.click(linha.getByRole('button', { name: 'Salvar correção' }))
    await waitFor(() => expect(quantos(rede, 'PUT /v1/materiais/' + MATERIAL_ID + '/secoes/' + id(101) + '/habilidades')).toBe(1))
    expect(corpoDo('PUT')).toEqual({ codigos: ['EF06CI01', 'EF06CI02'] })
    // A lista é lida de novo, o editor fecha e o foco volta ao botão de onde a pessoa veio.
    await waitFor(() => expect(linha.queryByRole('group', { name: 'Habilidades de Título 1' })).toBeNull())
    expect(quantos(rede, LEITURA)).toBeGreaterThan(antes)
    await waitFor(() => expect(document.activeElement).toBe(linha.getByRole('button', { name: /^Corrigir/ })))
    expect(await linha.findAllByText('Corrigida pela coordenação')).toHaveLength(2)
  })

  it('de 0 a 5: tirar tudo manda zero códigos (é uma correção), e o sexto fica bloqueado', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { secoes: [secao(1, { habilidades: [habilidade(1)] })] })
    const lida = montar()
    const linha = await linhaDe(lida, 'Título 1')
    await usuario.click(linha.getByRole('button', { name: /^Corrigir/ }))
    const seletor = within(await linha.findByRole('group', { name: 'Habilidades de Título 1' }))
    await usuario.click(await seletor.findByRole('checkbox', { name: /^EF06CI01/ }))
    for (const n of [2, 3, 4, 5, 6]) await usuario.click(seletor.getByRole('checkbox', { name: new RegExp(`^EF06CI0${String(n)}`) }))
    expect((seletor.getByRole('checkbox', { name: /^EF06CI07/ }) as HTMLInputElement).disabled).toBe(true)
    expect(seletor.getByRole('status').textContent).toBe('5 de 5 escolhidas. Tire uma para escolher outra.')
    for (const n of [2, 3, 4, 5, 6]) await usuario.click(seletor.getByRole('checkbox', { name: new RegExp(`^EF06CI0${String(n)}`) }))
    await usuario.click(linha.getByRole('button', { name: 'Salvar correção' }))
    await waitFor(() => expect(corpoDo('PUT')).toEqual({ codigos: [] }))
  })

  it('"Salvar correção" só liga com as candidatas lidas: com a leitura caída, diz o erro e não manda nada', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { secoes: [secao(1, { habilidades: [habilidade(1)] })], candidatas: () => ERRO('LIMITE_EXCEDIDO', 429) })
    const lida = montar()
    const linha = await linhaDe(lida, 'Título 1')
    await usuario.click(linha.getByRole('button', { name: /^Corrigir/ }))
    expect((await linha.findByRole('alert')).textContent).toBe('Não foi possível ler as habilidades da BNCC.')
    expect((linha.getByRole('button', { name: 'Salvar correção' }) as HTMLButtonElement).disabled).toBe(true)
    expect(quantos(rede, 'PUT /v1/materiais/' + MATERIAL_ID + '/secoes/' + id(101) + '/habilidades')).toBe(0)
  })

  it('o clique duplo em "Salvar correção" manda um `PUT` só, e "Cancelar" fecha sem mandar nada', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { secoes: [secao(1), secao(2)], correcao: () => new Promise<FakeResponse>(() => undefined) as unknown as FakeResponse })
    const lida = montar()
    const linha = await linhaDe(lida, 'Título 1')
    await usuario.click(linha.getByRole('button', { name: /^Corrigir/ }))
    await linha.findByRole('checkbox', { name: /^EF06CI01/ })
    const salvar = linha.getByRole('button', { name: 'Salvar correção' })
    await usuario.dblClick(salvar)
    expect(quantos(rede, 'PUT /v1/materiais/' + MATERIAL_ID + '/secoes/' + id(101) + '/habilidades')).toBe(1)
    expect((await linha.findByRole('button', { name: 'Salvando…' })) as HTMLButtonElement).toHaveProperty('disabled', true)
    // Com o pedido no ar, o "Cancelar" do editor também fica desligado.
    expect((linha.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true)
    // O outro capítulo, de mesma situação e mesmas habilidades (a mesma marca), não abre junto: o editor é de quem a pessoa abriu.
    const outra = await linhaDe(lida, 'Título 2')
    expect(outra.queryByRole('group')).toBeNull()
    expect(outra.getByRole('button', { name: /^Corrigir/ }).getAttribute('aria-expanded')).toBe('false')
    // Ele abre o editor dele e "Cancelar" o fecha sem pedido.
    await usuario.click(outra.getByRole('button', { name: /^Corrigir/ }))
    await outra.findByRole('checkbox', { name: /^EF06CI01/ })
    await usuario.click(outra.getByRole('button', { name: 'Cancelar' }))
    expect(outra.queryByRole('group')).toBeNull()
    expect(quantos(rede, 'PUT /v1/materiais/' + MATERIAL_ID + '/secoes/' + id(102) + '/habilidades')).toBe(0)
    await waitFor(() => expect(document.activeElement).toBe(outra.getByRole('button', { name: /^Corrigir/ })))
  })

  it('Esc fecha o editor e devolve o foco ao "Corrigir"', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork(), { secoes: [secao(1, { habilidades: [habilidade(1)] })] })
    const lida = montar()
    const linha = await linhaDe(lida, 'Título 1')
    await usuario.click(linha.getByRole('button', { name: /^Corrigir/ }))
    await linha.findByRole('checkbox', { name: /^EF06CI01/ })
    await usuario.keyboard('{Escape}')
    expect(linha.queryByRole('group')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(linha.getByRole('button', { name: /^Corrigir/ })))
  })

  it('com a função suspensa, o editor não parte da sugestão da IA: só o que a coordenação corrigiu vem marcado', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork(), { suspensa: true, secoes: [secao(1, { habilidades: [habilidade(1, 'ia')] })] })
    const lida = montar()
    const linha = await linhaDe(lida, 'Título 1')
    await usuario.click(linha.getByRole('button', { name: /^Corrigir/ }))
    const caixaDaIa = await linha.findByRole('checkbox', { name: /^EF06CI01/ })
    expect((caixaDaIa as HTMLInputElement).checked).toBe(false)
  })

  it('o `CONFLITO` do `PUT` diz que o material ainda não terminou, lê de novo, e a falha sai quando o capítulo muda por fora', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const secoes = [secao(1, { habilidades: [habilidade(1)] })]
    instalar(rede, { secoes, correcao: () => ERRO('CONFLITO', 409) })
    const lida = montar()
    const linha = await linhaDe(lida, 'Título 1')
    await usuario.click(linha.getByRole('button', { name: /^Corrigir/ }))
    await linha.findByRole('checkbox', { name: /^EF06CI01/ })
    const antes = quantos(rede, LEITURA)
    // A leitura que vem depois da falha já traz o capítulo corrigido por outra pessoa.
    secoes[0] = secao(1, { habilidades: [habilidade(3, 'coordenacao')], corrigida: true })
    await usuario.click(linha.getByRole('button', { name: 'Salvar correção' }))
    await waitFor(() => expect(quantos(rede, LEITURA)).toBeGreaterThan(antes))
    // O editor deixou de valer: ele, o erro dele e o rascunho saem, e o foco volta ao "Corrigir".
    await waitFor(() => expect(linha.queryByRole('group')).toBeNull())
    expect(linha.queryByRole('alert')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(linha.getByRole('button', { name: /^Corrigir/ })))
    expect(await linha.findByText(/Descrição da habilidade 3/)).toBeTruthy()
  })

  it('o `CONFLITO` sem mudança nenhuma no capítulo deixa o editor aberto, com o texto da tela e o foco na falha; escolher de novo tira o aviso', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork(), { secoes: [secao(1, { habilidades: [habilidade(1)] })], correcao: () => ERRO('CONFLITO', 409) })
    const lida = montar()
    const linha = await linhaDe(lida, 'Título 1')
    await usuario.click(linha.getByRole('button', { name: /^Corrigir/ }))
    await linha.findByRole('checkbox', { name: /^EF06CI01/ })
    await usuario.click(linha.getByRole('button', { name: 'Salvar correção' }))
    const alerta = await linha.findByRole('alert')
    expect(alerta.textContent).toBe('Este material ainda não terminou de processar. Corrija as habilidades quando ele estiver pronto.')
    await waitFor(() => expect(document.activeElement).toBe(alerta))
    await usuario.click(linha.getByRole('checkbox', { name: /^EF06CI02/ }))
    expect(linha.queryByRole('alert')).toBeNull()
  })

  it('o 429 do `PUT` diz em quantos minutos tentar de novo, e o editor continua aberto com o que a pessoa escolheu', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { secoes: [secao(1, { habilidades: [habilidade(1)] })], correcao: () => ERRO('LIMITE_EXCEDIDO', 429, { 'Retry-After': '600' }) })
    const lida = montar()
    const linha = await linhaDe(lida, 'Título 1')
    await usuario.click(linha.getByRole('button', { name: /^Corrigir/ }))
    await usuario.click(await linha.findByRole('checkbox', { name: /^EF06CI02/ }))
    const antes = quantos(rede, LEITURA)
    await usuario.click(linha.getByRole('button', { name: 'Salvar correção' }))
    const alerta = await linha.findByRole('alert')
    expect(alerta.textContent).toBe('Muitas alterações seguidas. Tente de novo em 10 minutos.')
    expect((linha.getByRole('checkbox', { name: /^EF06CI02/ }) as HTMLInputElement).checked).toBe(true)
    // O 429 não muda o que a tela sabe: a lista não é lida de novo.
    expect(quantos(rede, LEITURA)).toBe(antes)
  })
})

describe('reclassificar', () => {
  const tres = () => [secao(1, { habilidades: [habilidade(1)] }), secao(2, { situacao: 'nao_classificada' }), secao(3, { habilidades: [habilidade(3, 'coordenacao')], corrigida: true })]

  it('mostra quantos capítulos refaz e quantos ficam como estão antes de pedir, e "Cancelar" não manda nada e devolve o foco', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { secoes: tres() })
    const lida = montar()
    await lida.findByText('Título 1')
    expect(lida.queryByText(TEXTO_DO_RECLASSIFICAR_SEM_O_QUE_REFAZER)).toBeNull()
    await usuario.click(lida.getByRole('button', { name: 'Reclassificar' }))
    const confirmacao = await lida.findByText('2 capítulos serão classificados de novo à noite; 1 corrigido fica como está.')
    await waitFor(() => expect(document.activeElement).toBe(confirmacao))
    // Com a confirmação à vista, o botão de pedir fica desligado: o pedido é o "Confirmar".
    expect((lida.getByRole('button', { name: 'Reclassificar' }) as HTMLButtonElement).disabled).toBe(true)
    // O do capítulo que não terminou também: a confirmação aberta não se refaz por outro botão.
    expect((lida.getByRole('button', { name: 'Reclassificar o material' }) as HTMLButtonElement).disabled).toBe(true)
    expect(quantos(rede, RECLASSIFICAR)).toBe(0)
    await usuario.click(lida.getByRole('button', { name: 'Cancelar' }))
    expect(lida.queryByText(/serão classificados de novo/)).toBeNull()
    expect(quantos(rede, RECLASSIFICAR)).toBe(0)
    await waitFor(() => expect(document.activeElement).toBe(lida.getByRole('button', { name: 'Reclassificar' })))
  })

  it('"Confirmar" manda o pedido uma vez, fica desligado enquanto ele está no ar, e depois diz o que a API aceitou, com o foco no aviso', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let aceitar: (resposta: FakeResponse) => void = () => undefined
    const secoes = tres()
    instalar(rede, { secoes, reclassificar: () => new Promise<FakeResponse>((resolver) => (aceitar = resolver)) })
    const lida = montar()
    await lida.findByText('Título 1')
    await usuario.click(lida.getByRole('button', { name: 'Reclassificar' }))
    await usuario.dblClick(await lida.findByRole('button', { name: 'Confirmar' }))
    const pedindo = (await lida.findByRole('button', { name: 'Pedindo…' })) as HTMLButtonElement
    expect(pedindo.disabled).toBe(true)
    expect(lida.queryByText(/Pedido feito/)).toBeNull()
    expect((lida.getByRole('button', { name: 'Reclassificar' }) as HTMLButtonElement).disabled).toBe(true)
    expect((lida.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(quantos(rede, RECLASSIFICAR)).toBe(1)
    // O "Reclassificar" do capítulo que não terminou fica desligado com o pedido no ar: clicar nele não solta o pedido de quem o observa.
    const doCapitulo = lida.getByRole('button', { name: 'Reclassificar o material' }) as HTMLButtonElement
    expect(doCapitulo.disabled).toBe(true)
    await usuario.click(doCapitulo)
    expect(lida.getByRole('button', { name: 'Pedindo…' })).toBeTruthy()
    // A leitura que vem depois já traz o capítulo à espera da noite.
    secoes[1] = secao(2, { situacao: 'aguardando' })
    aceitar({ status: 202, corpo: { secoes: 2, preservadas: 1 } })
    const aviso = await lida.findByText('Pedido feito. 2 capítulos serão classificados de novo à noite; 1 corrigido fica como está.')
    await waitFor(() => expect(document.activeElement).toBe(aviso))
    expect(aviso.className).toContain('text-ok')
    expect(lida.queryByRole('group', { name: 'Confirmar a classificação de novo' })).toBeNull()
    expect(await lida.findByText('Classificação à noite')).toBeTruthy()
    expect((lida.getByRole('button', { name: 'Reclassificar' }) as HTMLButtonElement).disabled).toBe(false)
    expect(quantos(rede, RECLASSIFICAR)).toBe(1)
  })

  it('o "Reclassificar" do capítulo que não terminou abre a mesma confirmação, e some do que terminou', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork(), { secoes: tres() })
    const lida = montar()
    const incompleto = await linhaDe(lida, 'Título 2')
    expect(incompleto.getByText('A classificação não terminou.')).toBeTruthy()
    await usuario.click(incompleto.getByRole('button', { name: 'Reclassificar o material' }))
    expect(await lida.findByText('2 capítulos serão classificados de novo à noite; 1 corrigido fica como está.')).toBeTruthy()
    expect((await linhaDe(lida, 'Título 1')).queryByRole('button', { name: /^Reclassificar/ })).toBeNull()
  })

  it('com todos os capítulos corrigidos, não há o que refazer: o botão fica desligado e a tela diz por quê', async () => {
    instalar(fakeNetwork(), { secoes: [secao(1, { habilidades: [habilidade(1, 'coordenacao')], corrigida: true })] })
    const lida = montar()
    expect(await lida.findByText('Todos os capítulos já foram corrigidos pela coordenação: não há o que classificar de novo.')).toBeTruthy()
    expect((lida.getByRole('button', { name: 'Reclassificar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('o 429 diz em quantos minutos; a suspensão que veio depois de a tela abrir diz o aviso e relê o material', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let resposta: FakeResponse = ERRO('LIMITE_EXCEDIDO', 429, { 'Retry-After': '300' })
    instalar(rede, { secoes: tres(), reclassificar: () => resposta })
    const lida = montar()
    await lida.findByText('Título 1')
    const lidaAntes = quantos(rede, LEITURA)
    await usuario.click(lida.getByRole('button', { name: 'Reclassificar' }))
    await usuario.click(await lida.findByRole('button', { name: 'Confirmar' }))
    const falha = await lida.findByRole('alert')
    expect(falha.textContent).toBe('Muitas alterações seguidas. Tente de novo em 5 minutos.')
    expect(falha.className).toContain('text-erro')
    expect(lida.queryByRole('group', { name: 'Confirmar a classificação de novo' })).toBeNull()
    // O 429 não muda o que a tela sabe: a lista não é lida de novo.
    expect(quantos(rede, LEITURA)).toBe(lidaAntes)

    resposta = ERRO('FUNCAO_SUSPENSA', 409)
    const antes = quantos(rede, LEITURA)
    await usuario.click(lida.getByRole('button', { name: 'Reclassificar' }))
    expect(lida.queryByRole('alert')).toBeNull()
    await usuario.click(await lida.findByRole('button', { name: 'Confirmar' }))
    expect((await lida.findByRole('alert')).textContent).toBe(TEXTO_DA_SUSPENSAO)
    await waitFor(() => expect(quantos(rede, LEITURA)).toBeGreaterThan(antes))
  })
})

describe('o material que não está pronto', () => {
  it('não pede nada à API e não desenha a seção', () => {
    const rede = fakeNetwork()
    instalar(rede, { secoes: [] })
    renderScreen(<ClassificacaoDoMaterial material={{ id: MATERIAL_ID, estado: 'processando' }} disciplina="Ciências" semComponente={false} />)
    expect(screen.queryByRole('region', { name: 'Habilidades da BNCC' })).toBeNull()
    expect(rede.chamadas).toHaveLength(0)
  })
})
