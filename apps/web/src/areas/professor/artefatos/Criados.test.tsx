// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarClienteDeConsultas } from '../../../api/query-client'
import { formatarDataHora } from '../../../format'
import { prepararTela, redeFalsa, type RedeFalsa, type RespostaFalsa } from '../../../__fixtures__/render-screen'
import Criados from './Criados'

/**
 * "Criados" da professora (telas do professor, 5.0; RF12, RF22): os quatro estados, o filtro que não acha nada com e sem mais
 * páginas, o filtro de turma que vai ao servidor e o de tipo e estado que não vão, e o botão "Filtrar" do celular. A rede é
 * falsa e responde **por caminho**; a tela, o cliente de consultas e o endereço (`memoryLocation`) são de verdade. O
 * `jsdom` não tem `matchMedia`, `ResizeObserver` nem o `dialog` modal: o teste os põe, e são API do navegador, e não peça
 * nossa. A lista com o navegador de verdade — o voltar do histórico, a troca de escola, a segunda pessoa — é do e2e.
 */
prepararTela()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const TURMA_A = { id: id(101), nome: '7ºA' }
const TURMA_B = { id: id(102), nome: '8ºB' }
const QUIMICA = { id: id(500), nome: 'Química' }
const FISICA = { id: id(501), nome: 'Física' }

const vinculo = (n: number, turma: { id: string; nome: string }, disciplina: { id: string; nome: string }) => ({ id: id(400 + n), turma, disciplina, estado: 'confirmado' })
const VINCULOS = [vinculo(1, TURMA_A, QUIMICA), vinculo(2, TURMA_A, FISICA), vinculo(3, TURMA_B, QUIMICA)]

function artefato(n: number, titulo: string, turma: { id: string }, disciplina: { id: string }, campos: Record<string, unknown> = {}) {
  return {
    id: id(n),
    tipo: 'atividade_objetiva',
    titulo,
    turmaId: turma.id,
    disciplinaId: disciplina.id,
    origemId: null,
    adaptacao: null,
    entrega: null,
    criadoEm: '2026-10-05T09:00:00.000Z',
    ...campos,
  }
}
const adaptada = (n: number, titulo: string, turma: { id: string }, disciplina: { id: string }, estado: 'pendente' | 'aprovada' | 'rejeitada') =>
  artefato(n, titulo, turma, disciplina, { origemId: id(1), adaptacao: { tipos: ['fonte_ampliada'] }, entrega: { id: id(900 + n), estado, decididaEm: null } })

const ATIVIDADE = artefato(1, 'Atividade de estequiometria', TURMA_A, QUIMICA)
const VERSAO = adaptada(2, 'Atividade de estequiometria (versão adaptada)', TURMA_A, QUIMICA, 'pendente')
const PLANO = artefato(3, 'Plano de ondas', TURMA_B, QUIMICA, { tipo: 'plano_de_aula' })
const DE_FISICA = artefato(4, 'Lista de cinemática', TURMA_A, FISICA)
const TODOS = [VERSAO, PLANO, DE_FISICA, ATIVIDADE]

const ok = (itens: readonly unknown[], extra: Record<string, unknown> = {}): RespostaFalsa => ({ status: 200, corpo: { itens, ...extra } })
const erro = (status: number, codigo: string): RespostaFalsa => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })

type Resposta = RespostaFalsa | (() => RespostaFalsa | Promise<RespostaFalsa>)
/** A lista de artefatos: com `turmaId` na consulta, só os dessa turma, como o servidor faz; sem, todos. */
function instalar(rede: RedeFalsa, quem: { artefatos?: Resposta | readonly unknown[]; vinculos?: Resposta } = {}): void {
  const lista = quem.artefatos ?? TODOS
  rede.responderPor(/^\/v1\/artefatos(\?|$)/, (caminho) => {
    if (!Array.isArray(lista)) return typeof lista === 'function' ? (lista as () => RespostaFalsa | Promise<RespostaFalsa>)() : (lista as RespostaFalsa)
    const turma = new URL(caminho, 'http://x').searchParams.get('turmaId')
    return ok((lista as readonly { turmaId: string }[]).filter((item) => turma === null || item.turmaId === turma))
  })
  rede.responderPor('/v1/meus-vinculos', quem.vinculos ?? ok(VINCULOS))
}

const consultasDeArtefatos = (rede: RedeFalsa) => rede.chamadas.filter((chamada) => chamada.caminho.startsWith('/v1/artefatos')).map((chamada) => chamada.caminho)
const nuncaResponde = () => new Promise<RespostaFalsa>(() => undefined)

/** A largura da janela, para a consulta `(min-width: 768px)` que decide entre os três menus e o botão "Filtrar". */
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

function montar(endereco = '/criados') {
  const [caminho = '/criados', busca = ''] = endereco.split('?')
  const localizacao = memoryLocation({ path: caminho, searchPath: busca, record: true })
  const cliente = criarClienteDeConsultas()
  render(
    <QueryClientProvider client={cliente}>
      <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
        <Criados />
      </Router>
    </QueryClientProvider>,
  )
  return Object.assign(localizacao, { cliente })
}

const grupo = (nome: string) => screen.getByRole('region', { name: nome })
const titulosDasLinhas = () => screen.queryAllByRole('link').map((link) => link.textContent ?? '')

describe('Criados: os quatro estados', () => {
  it('carregando: o título visível, o texto de espera e nem o vazio nem o erro', async () => {
    const rede = redeFalsa()
    instalar(rede, { artefatos: nuncaResponde })
    montar()
    expect(screen.getByRole('heading', { level: 1, name: 'Criados' })).toBeTruthy()
    expect(await screen.findByText('Carregando o que você já gerou…')).toBeTruthy()
    expect(screen.queryByText('Nada gerado ainda')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('erro: a mensagem do catálogo, sem código nem vazio, e "Tentar de novo" lê de novo e mostra a lista', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let falhar = true
    // Limite excedido não é repetido sozinho: o erro chega na hora, sem esperar a nova tentativa.
    instalar(rede, { artefatos: () => (falhar ? erro(429, 'LIMITE_EXCEDIDO') : ok([ATIVIDADE])) })
    montar()
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).not.toMatch(/LIMITE_EXCEDIDO|429/)
    expect(screen.queryByText('Nada gerado ainda')).toBeNull()
    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Atividade de estequiometria')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('vazio: "Nada gerado ainda" com o caminho para Ferramentas, e nenhum "Limpar filtros", que só existe com filtro', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede, { artefatos: [] })
    const localizacao = montar()
    expect(await screen.findByText('Nada gerado ainda')).toBeTruthy()
    // A onça do mockup aponta para o convite, parada e assinada pela função de quem gera (D58; D80, item 3).
    const onca = document.querySelector('[data-onca]')
    expect(onca?.getAttribute('data-pose')).toBe('apontando')
    expect(onca?.querySelector('figcaption')?.textContent).toMatch(/^Assistente de ensino/)
    expect(onca?.querySelector('[data-selo-ia]')).not.toBeNull()
    expect(onca?.querySelector('svg')?.getAttribute('class')).not.toContain('onca-animada')
    expect(screen.queryByText(/Nada com estes filtros/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull()
    await usuario.click(screen.getByRole('button', { name: 'Ir para Ferramentas' }))
    expect(localizacao.history?.at(-1)).toBe('/ferramentas')
  })

  it('com dado: um grupo por turma e disciplina, com o número, e em cada linha o tipo, a turma para o leitor de tela e o estado só na versão adaptada', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar()
    await screen.findByText('Plano de ondas')
    // A mesma turma com duas disciplinas: dois grupos. Na ordem em que a lista veio, do mais novo para o mais antigo.
    expect(screen.getAllByRole('heading', { level: 2 }).map((titulo) => titulo.textContent)).toEqual(['7ºA · Química', '8ºB · Química', '7ºA · Física'])
    expect(within(grupo('7ºA · Química')).getAllByRole('listitem')).toHaveLength(2)
    expect(within(grupo('7ºA · Química')).getByText('2 documentos')).toBeTruthy()
    expect(within(grupo('8ºB · Química')).getByText('1 documento')).toBeTruthy()

    const adaptadaNaTela = within(grupo('7ºA · Química')).getByRole('link', { name: /versão adaptada/ })
    expect(adaptadaNaTela.getAttribute('href')).toBe(`/artefatos/${VERSAO.id}`)
    expect(adaptadaNaTela.textContent).toContain('Versão adaptada · Fonte ampliada')
    expect(adaptadaNaTela.textContent).toContain('7ºA')
    expect(adaptadaNaTela.textContent).toContain('Esperando você')
    // O original não passa por aprovação: não tem selo de decisão.
    const original = within(grupo('7ºA · Química')).getByRole('link', { name: (nome) => nome.startsWith('Atividade de estequiometria') && !nome.includes('adaptada') })
    expect(original.textContent).toContain('Atividade objetiva')
    expect(original.textContent).not.toMatch(/Esperando você|Aprovada|Rejeitada/)
    expect(within(grupo('8ºB · Química')).getByRole('link').textContent).toContain('Plano de aula')
    // O id nunca aparece como nome de turma.
    expect(document.body.textContent).not.toContain('0197a1c0')
  })

  it('cada linha mostra a data e a hora de quando o documento foi criado, a do próprio documento e não a de outro', async () => {
    const rede = redeFalsa()
    // Um mês de distância: a data é outra em qualquer fuso do computador que roda o teste.
    const DO_NOVO = '2026-10-07T15:00:00.000Z'
    const DO_ANTIGO = '2026-09-03T15:00:00.000Z'
    const ANTIGO = artefato(5, 'Plano de ondas antigo', TURMA_B, QUIMICA, { tipo: 'plano_de_aula', criadoEm: DO_ANTIGO })
    const NOVO = artefato(6, 'Lista de óptica', TURMA_B, QUIMICA, { criadoEm: DO_NOVO })
    instalar(rede, { artefatos: [NOVO, ANTIGO] })
    montar()
    await screen.findByText('Lista de óptica')
    const linhaDoNovo = screen.getByRole('link', { name: /Lista de óptica/ })
    const linhaDoAntigo = screen.getByRole('link', { name: /Plano de ondas antigo/ })
    expect(linhaDoNovo.textContent).toContain(formatarDataHora(DO_NOVO))
    expect(linhaDoNovo.textContent).not.toContain(formatarDataHora(DO_ANTIGO))
    expect(linhaDoAntigo.textContent).toContain(formatarDataHora(DO_ANTIGO))
    expect(linhaDoAntigo.textContent).not.toContain(formatarDataHora(DO_NOVO))
  })
})

describe('Criados: filtros no endereço', () => {
  it('valor desconhecido no endereço cai em "todos": a lista inteira, e nenhum `turmaId` na leitura', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar('/criados?tipo=prova&estado=para_aprovar&turma=7a')
    await screen.findByText('Plano de ondas')
    expect(titulosDasLinhas()).toHaveLength(4)
    expect(consultasDeArtefatos(rede)).toEqual(['/v1/artefatos'])
  })

  it('o tipo e o estado do endereço filtram o que já foi lido, sem nova leitura; o estado é o da versão adaptada, e o original não passa com ele ligado', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar('/criados?estado=pendente')
    await screen.findByText(/versão adaptada/)
    expect(titulosDasLinhas()).toHaveLength(1)
    expect(screen.queryByText('Plano de ondas')).toBeNull()
    expect(screen.queryByText('Lista de cinemática')).toBeNull()
    expect(consultasDeArtefatos(rede)).toEqual(['/v1/artefatos'])
  })

  it('trocar o tipo no menu muda a lista e o endereço com `replace`, e não faz leitura nenhuma', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede)
    const localizacao = montar()
    await screen.findByText('Plano de ondas')
    const antes = localizacao.history?.length

    await usuario.click(screen.getByRole('button', { name: 'Tipo' }))
    await usuario.click(screen.getByRole('menuitemradio', { name: 'Plano de aula' }))

    expect(localizacao.history?.at(-1)).toBe('/criados?tipo=plano_de_aula')
    expect(localizacao.history?.length).toBe(antes)
    await waitFor(() => expect(titulosDasLinhas()).toHaveLength(1))
    expect(screen.getByText('Plano de ondas')).toBeTruthy()
    // O botão diz o que está escolhido; o nome do filtro continua na frente, para o leitor de tela.
    expect(screen.getByRole('button', { name: /^Tipo:\s*Plano de aula$/ })).toBeTruthy()
    expect(consultasDeArtefatos(rede)).toEqual(['/v1/artefatos'])
  })

  it('trocar a turma faz uma leitura com `turmaId`, e só com os documentos dela; voltar a "todas" não relê o que já tem', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede)
    const localizacao = montar()
    await screen.findByText('Plano de ondas')

    await usuario.click(screen.getByRole('button', { name: 'Turma' }))
    await usuario.click(screen.getByRole('menuitemradio', { name: '8ºB' }))

    await waitFor(() => expect(consultasDeArtefatos(rede)).toEqual(['/v1/artefatos', `/v1/artefatos?turmaId=${TURMA_B.id}`]))
    expect(localizacao.history?.at(-1)).toBe(`/criados?turma=${TURMA_B.id}`)
    await waitFor(() => expect(titulosDasLinhas()).toEqual([expect.stringContaining('Plano de ondas')]))
    // Uma turma só no filtro, mesmo com duas disciplinas nela: "7ºA" aparece uma vez.
    await usuario.click(screen.getByRole('button', { name: /^Turma:\s*8ºB$/ }))
    expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual(['Todas as turmas', '7ºA', '8ºB'])
    await usuario.click(screen.getByRole('menuitemradio', { name: 'Todas as turmas' }))
    await waitFor(() => expect(titulosDasLinhas()).toHaveLength(4))
    expect(localizacao.history?.at(-1)).toBe('/criados')
    // A lista de todas as turmas já estava no cache e não foi lida de novo.
    expect(consultasDeArtefatos(rede)).toEqual(['/v1/artefatos', `/v1/artefatos?turmaId=${TURMA_B.id}`])
  })

  it('a turma do endereço que a professora não tem vai ao servidor do mesmo jeito, e o botão não a chama pelo id', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar(`/criados?turma=${id(777)}`)
    expect(await screen.findByText('Nada com estes filtros')).toBeTruthy()
    // Com filtro ligado e a leitura vazia, o vazio de quem nunca gerou nada não aparece junto: o convite a gerar seria o errado.
    expect(screen.queryByText('Nada gerado ainda')).toBeNull()
    expect(consultasDeArtefatos(rede)).toEqual([`/v1/artefatos?turmaId=${id(777)}`])
    expect(screen.getByRole('button', { name: /^Turma:\s*Outra turma$/ })).toBeTruthy()
    expect(document.body.textContent).not.toContain('0197a1c0')
  })
})

describe('Criados: a lista espera os vínculos', () => {
  it('com a lista já lida e os vínculos sem resposta, continua carregando: nenhum grupo "Outra turma" aparece antes de o nome da turma chegar', async () => {
    const rede = redeFalsa()
    instalar(rede, { vinculos: nuncaResponde })
    montar()
    await waitFor(() => expect(consultasDeArtefatos(rede)).toEqual(['/v1/artefatos']))
    // A lista responde na hora; dá o tempo de ela chegar à tela antes de afirmar o que não aparece.
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(screen.getByText('Carregando o que você já gerou…')).toBeTruthy()
    expect(screen.queryByText('Outra turma')).toBeNull()
    expect(titulosDasLinhas()).toEqual([])
  })

  it('com a lista com erro e os vínculos sem resposta, mostra só o erro: o texto de espera não fica junto dele', async () => {
    const rede = redeFalsa()
    instalar(rede, { artefatos: () => erro(429, 'LIMITE_EXCEDIDO'), vinculos: nuncaResponde })
    montar()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('Carregando o que você já gerou…')).toBeNull()
  })

  it('a turma do endereço, enquanto os vínculos carregam, aparece como "Turma", e não como "Outra turma"', async () => {
    const rede = redeFalsa()
    instalar(rede, { vinculos: nuncaResponde })
    montar(`/criados?turma=${TURMA_A.id}`)
    expect(await screen.findByRole('button', { name: /^Turma:\s*Turma$/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Outra turma/ })).toBeNull()
  })
})

describe('Criados: o recomeço da sessão', () => {
  it('a sessão que troca esvazia a lista: a leitura da pessoa anterior, que chega depois, não entra na tela', async () => {
    const rede = redeFalsa()
    let liberarPrimeira: (resposta: RespostaFalsa) => void = () => undefined
    const primeira = new Promise<RespostaFalsa>((resolver) => (liberarPrimeira = resolver))
    let leituras = 0
    // A primeira leitura (da pessoa anterior) fica no ar; a seguinte, depois do recomeço, é da pessoa nova e não tem documento nenhum.
    instalar(rede, {
      artefatos: () => {
        leituras += 1
        return leituras === 1 ? primeira : ok([])
      },
    })
    const { cliente } = montar()
    await waitFor(() => expect(leituras).toBe(1))

    // É o que `main.tsx` faz em toda sessão nova: `resetQueries`. A resposta que ainda vinha a caminho é da pessoa anterior.
    void cliente.resetQueries()
    expect(await screen.findByText('Nada gerado ainda')).toBeTruthy()
    liberarPrimeira(ok([ATIVIDADE, PLANO]))
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(screen.queryByText('Atividade de estequiometria')).toBeNull()
    expect(screen.queryByText('Plano de ondas')).toBeNull()
    expect(screen.getByText('Nada gerado ainda')).toBeTruthy()
  })
})

describe('Criados: filtro sem resultado', () => {
  it('com mais páginas por ler, diz "até aqui" e mantém "Ver mais"; a página seguinte entra e o foco vai ao primeiro documento novo', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let pagina = 0
    instalar(rede, {
      artefatos: () => {
        pagina += 1
        return pagina === 1 ? ok([ATIVIDADE, PLANO], { proxima: PLANO.id }) : ok([VERSAO])
      },
    })
    montar('/criados?estado=pendente')
    expect(await screen.findByText('Nada com estes filtros até aqui')).toBeTruthy()
    expect(screen.queryByText('Nada com estes filtros')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull()

    await usuario.click(screen.getByRole('button', { name: 'Ver mais' }))
    const nova = await screen.findByRole('link', { name: /versão adaptada/ })
    expect(consultasDeArtefatos(rede)).toEqual(['/v1/artefatos', `/v1/artefatos?pagina=${PLANO.id}`])
    expect(screen.queryByText(/Nada com estes filtros/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ver mais' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(nova))
  })

  it('"Ver mais" que não traz documento visível leva o foco ao título, porque o botão saiu da tela', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let pagina = 0
    instalar(rede, {
      artefatos: () => {
        pagina += 1
        return pagina === 1 ? ok([ATIVIDADE, PLANO], { proxima: PLANO.id }) : ok([DE_FISICA])
      },
    })
    montar('/criados?estado=pendente')
    await usuario.click(await screen.findByRole('button', { name: 'Ver mais' }))
    // A página nova não tem versão pendente: nada entra na lista, e o botão que tinha o foco já não existe.
    expect(await screen.findByText('Nada com estes filtros')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Criados' })))
  })

  it('"Ver mais" com a turma filtrada pede a página seguinte da mesma turma', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let pagina = 0
    instalar(rede, {
      artefatos: () => {
        pagina += 1
        return pagina === 1 ? ok([ATIVIDADE], { proxima: ATIVIDADE.id }) : ok([DE_FISICA])
      },
    })
    montar(`/criados?turma=${TURMA_A.id}`)
    await usuario.click(await screen.findByRole('button', { name: 'Ver mais' }))
    await screen.findByText('Lista de cinemática')
    expect(consultasDeArtefatos(rede)).toEqual([`/v1/artefatos?turmaId=${TURMA_A.id}`, `/v1/artefatos?turmaId=${TURMA_A.id}&pagina=${ATIVIDADE.id}`])
  })

  it('sem mais páginas, diz "Nada com estes filtros" com "Limpar filtros", que tira os três e leva o foco ao título', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede)
    const localizacao = montar('/criados?tipo=plano_de_aula&estado=aprovada')
    expect(await screen.findByText('Nada com estes filtros')).toBeTruthy()
    expect(screen.queryByText(/até aqui/)).toBeNull()
    expect(screen.queryByText('Nada gerado ainda')).toBeNull()
    // Só o vazio de verdade leva a onça: o vazio de um filtro que não achou nada não.
    expect(document.querySelector('[data-onca]')).toBeNull()

    await usuario.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(localizacao.history?.at(-1)).toBe('/criados')
    expect(await screen.findByText('Plano de ondas')).toBeTruthy()
    expect(titulosDasLinhas()).toHaveLength(4)
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Criados' }))
  })

  it('a lista com mais páginas e filtro que passa o que já veio mostra o que passou, e mantém "Ver mais"', async () => {
    const rede = redeFalsa()
    instalar(rede, { artefatos: ok([ATIVIDADE, VERSAO], { proxima: VERSAO.id }) })
    montar('/criados?estado=pendente')
    expect(await screen.findByText(/versão adaptada/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ver mais' })).toBeTruthy()
    expect(screen.queryByText(/Nada com estes filtros/)).toBeNull()
  })
})

describe('Criados: no celular', () => {
  beforeEach(() => janelaDe(360))

  it('os três menus viram o botão "Filtrar", que diz quantos filtros estão ligados', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar('/criados?tipo=atividade_objetiva&estado=pendente')
    await screen.findByText(/versão adaptada/)
    expect(screen.getByRole('button', { name: 'Filtrar (2)' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tipo' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Turma/ })).toBeNull()
  })

  it('o diálogo "Filtrar" tem os três grupos em toques; escolher um troca o filtro com `replace`, escolher de novo o tira, e "Ver N documentos" fecha', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede)
    const localizacao = montar()
    await screen.findByText('Plano de ondas')
    const antes = localizacao.history?.length

    await usuario.click(screen.getByRole('button', { name: 'Filtrar' }))
    const dialogo = screen.getByRole('dialog', { name: 'Filtrar' })
    expect(within(dialogo).getByRole('group', { name: 'Tipo' })).toBeTruthy()
    expect(within(dialogo).getByRole('group', { name: 'Turma' })).toBeTruthy()
    expect(within(dialogo).getByRole('group', { name: 'Estado' })).toBeTruthy()

    const planoDeAula = within(within(dialogo).getByRole('group', { name: 'Tipo' })).getByRole('button', { name: 'Plano de aula' })
    expect(planoDeAula.getAttribute('aria-pressed')).toBe('false')
    await usuario.click(planoDeAula)
    expect(localizacao.history?.at(-1)).toBe('/criados?tipo=plano_de_aula')
    expect(localizacao.history?.length).toBe(antes)
    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Ver 1 documento' })).toBeTruthy())
    expect(planoDeAula.getAttribute('aria-pressed')).toBe('true')

    await usuario.click(planoDeAula)
    expect(localizacao.history?.at(-1)).toBe('/criados')
    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Ver 4 documentos' })).toBeTruthy())

    await usuario.click(within(dialogo).getByRole('button', { name: 'Ver 4 documentos' }))
    expect(screen.queryByRole('dialog', { name: 'Filtrar' })).toBeNull()
  })

  it('"Limpar filtros" do diálogo fica desligado sem filtro, e com filtro tira todos', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede)
    const localizacao = montar('/criados?tipo=plano_de_aula&estado=aprovada')
    await screen.findByText('Nada com estes filtros')
    await usuario.click(screen.getByRole('button', { name: 'Filtrar (2)' }))
    const dialogo = screen.getByRole('dialog', { name: 'Filtrar' })
    const limpar = within(dialogo).getByRole('button', { name: 'Limpar filtros' }) as HTMLButtonElement
    expect(limpar.disabled).toBe(false)
    await usuario.click(limpar)
    expect(localizacao.history?.at(-1)).toBe('/criados')
    await waitFor(() => expect((within(dialogo).getByRole('button', { name: 'Limpar filtros' }) as HTMLButtonElement).disabled).toBe(true))
  })
})
