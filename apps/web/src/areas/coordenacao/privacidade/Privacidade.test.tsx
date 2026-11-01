// @vitest-environment jsdom
import { focusManager, onlineManager } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { setupScreen, fakeNetwork, renderScreen, type FakeResponse } from '../../../__fixtures__/render-screen'
import { COORDENACAO_ROUTES } from '../../../paths'
import Privacidade from './Privacidade'

/**
 * As três telas da aba Privacidade de Registros, no seletor (telas da coordenação, 13.0; RF17 e RF22): o título por extenso de
 * cada uma, o endereço que guarda a escolha, e os estados de cada tela. A rede é falsa; o seletor, as tabelas, os cartões e o
 * cliente de consultas são os da aba. Os caminhos de ponta a ponta (a escola de verdade, a troca de escola, duas coordenadoras,
 * os 360 px e o teclado) são do e2e (`e2e/privacidade.spec.ts` e `e2e/incidentes.spec.ts`).
 */
setupScreen()

const RETENCAO = '/v1/privacidade/retencao'
const SUBOPERADORES = '/v1/privacidade/suboperadores'
const INCIDENTES = '/v1/privacidade/incidentes'
const CONFIRMAR = /^\/v1\/privacidade\/incidentes\/[^/]+\/confirmar$/

/** Uma resposta que a tela não repete sozinha (o 503 o cliente de consultas tenta de novo antes de dar erro): a falha chega de uma vez. */
const FORA: FakeResponse = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }

const DA_RETENCAO = {
  categorias: [
    { categoria: 'conversa_tutor', descricao: 'Conversa do aluno com o Tutor', contaDe: 'cada mensagem', meses: 6, origem: 'ajustada', limitadaPor: null },
    { categoria: 'conversa_professor', descricao: 'Conversa do professor com o Assistente de ensino', contaDe: 'cada mensagem', meses: 12, origem: 'padrao', limitadaPor: null },
  ],
  prazosFixos: [{ chave: 'registro_acesso', descricao: 'Registro de acesso', prazo: '6 meses' }],
}

function empresa(chave: string, parcial: Record<string, unknown> = {}) {
  return { chave, nome: `Empresa ${chave}`, finalidade: `Faz o que ${chave} faz`, pais: 'BR', categorias: ['conversa_do_aluno'], vedaTreinamento: true, inicio: '2026-01-05T15:00:00.000Z', fim: null, ...parcial }
}

const idDoIncidente = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
function incidente(n: number, parcial: Record<string, unknown> = {}) {
  return {
    id: idDoIncidente(n),
    conhecidoEm: `2026-10-0${String(n)}T15:00:00.000Z`,
    circunstancias: `Circunstância ${String(n)}`,
    categorias: ['conversa_do_aluno'],
    titularesEstimados: 40,
    risco: 'relevante',
    contencao: 'Contenção feita',
    correcao: 'Correção em curso',
    avisadoEm: `2026-10-0${String(n)}T16:00:00.000Z`,
    confirmadoEm: null,
    ...parcial,
  }
}
const PRAZO_LEGAL = 'A escola comunica a ANPD e os titulares em até 3 dias úteis do conhecimento do incidente.'
const dosIncidentes = (incidentes: readonly unknown[]) => ({ status: 200, corpo: { incidentes, prazoLegal: PRAZO_LEGAL } })

/** O `jsdom` não tem `matchMedia` nem `ResizeObserver`: o teste os põe, que são API do navegador e não peça nossa. */
beforeEach(() => {
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(min-width: 768px)', addEventListener: () => undefined, removeEventListener: () => undefined }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
})

afterEach(() => {
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
})

function montar(aba: string) {
  const localizacao = memoryLocation({ path: `/privacidade/${aba}`, record: true })
  const tela = renderScreen(
    <Router hook={localizacao.hook}>
      <Privacidade aba={aba} />
    </Router>,
  )
  return { localizacao, ...tela }
}

/** As três leituras com dado, para o caso que só olha o título e a escolha. */
function lerTudo(): void {
  const rede = fakeNetwork()
  rede.responderPor(RETENCAO, { status: 200, corpo: DA_RETENCAO })
  rede.responderPor(SUBOPERADORES, { status: 200, corpo: { suboperadores: [empresa('alfa')] } })
  rede.responderPor(INCIDENTES, dosIncidentes([incidente(1)]))
}

describe('Privacidade: o título por extenso e a escolha no endereço', () => {
  it.each([
    { aba: 'retencao', opcao: 'Prazos de guarda', titulo: 'Por quanto tempo guardamos' },
    { aba: 'suboperadores', opcao: 'Empresas', titulo: 'Empresas que recebem dados' },
    { aba: 'incidentes', opcao: 'Incidentes', titulo: 'Incidentes' },
  ])('o endereço /$aba marca "$opcao" e abre a tela com o título "$titulo", e só ele', async ({ aba, opcao, titulo }) => {
    lerTudo()
    montar(aba)
    expect(screen.getByRole('radio', { name: opcao }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1)
    // O título é o `h2` da tela e está à vista antes de a leitura chegar; os dos outros não.
    expect(screen.getByRole('heading', { level: 2, name: titulo })).toBeTruthy()
    for (const outro of ['Por quanto tempo guardamos', 'Empresas que recebem dados'].filter((nome) => nome !== titulo)) {
      expect(screen.queryByRole('heading', { name: outro })).toBeNull()
    }
    await waitFor(() => expect(screen.queryByText(/^Carregando/)).toBeNull())
  })

  it('o título dos incidentes leva a frase de apoio', async () => {
    lerTudo()
    montar('incidentes')
    expect(screen.getByText(/Aqui a coordenação confirma que recebeu cada aviso/)).toBeTruthy()
    await screen.findAllByRole('region', { name: /^Incidente conhecido em/ })
  })

  it('um endereço com uma tela que não existe abre a aba dos pedidos, pela troca, e não mostra o seletor', () => {
    lerTudo()
    const { localizacao } = montar('nao-existe')
    expect(localizacao.history?.at(-1)).toBe(COORDENACAO_ROUTES.pedidos)
    expect(localizacao.history).toHaveLength(1)
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('escolher outra opção navega para o endereço dela', async () => {
    const usuario = userEvent.setup()
    lerTudo()
    const { localizacao } = montar('retencao')
    await usuario.click(screen.getByRole('radio', { name: 'Incidentes' }))
    expect(localizacao.history?.at(-1)).toBe('/privacidade/incidentes')
    await usuario.click(screen.getByRole('radio', { name: 'Empresas' }))
    expect(localizacao.history?.at(-1)).toBe('/privacidade/suboperadores')
  })
})

describe('Prazos de guarda: os estados', () => {
  it('carregando: o título já está à vista, a leitura ainda não chegou e a tabela não existe', async () => {
    const rede = fakeNetwork()
    const lida = rede.segurar()
    montar('retencao')
    expect(await screen.findByText('Carregando os prazos de guarda…')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Por quanto tempo guardamos' })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    lida.liberar({ status: 200, corpo: DA_RETENCAO })
    await screen.findByRole('table', { name: 'O que a escola guarda, e por quanto tempo' })
  })

  it('erro: diz o que fazer, e "Tentar de novo" lê outra vez e mostra as tabelas', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let respostas = 0
    rede.responderPor(RETENCAO, () => (++respostas === 1 ? FORA : { status: 200, corpo: DA_RETENCAO }))
    montar('retencao')
    await screen.findByRole('alert')
    expect(screen.queryByRole('table')).toBeNull()
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await screen.findByRole('table', { name: 'O que a escola guarda, e por quanto tempo' })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('com dado: o prazo que vale, de onde ele vem e os prazos fixos, cada seção um `h3` abaixo do título da tela', async () => {
    const rede = fakeNetwork()
    rede.responderPor(RETENCAO, { status: 200, corpo: DA_RETENCAO })
    montar('retencao')
    const categorias = await screen.findByRole('table', { name: 'O que a escola guarda, e por quanto tempo' })
    const doAluno = within(categorias).getByRole('row', { name: /Conversa do aluno com o Tutor/ })
    expect(within(doAluno).getByText('6 meses')).toBeTruthy()
    expect(within(doAluno).getByText('Ajustado pela escola')).toBeTruthy()
    expect(within(doAluno).getByText('cada mensagem')).toBeTruthy()
    const doProfessor = within(categorias).getByRole('row', { name: /Conversa do professor/ })
    expect(within(doProfessor).getByText('1 ano')).toBeTruthy()
    expect(within(doProfessor).getByText('Padrão do sistema')).toBeTruthy()
    const fixos = screen.getByRole('table', { name: 'Prazos que não mudam' })
    expect(within(fixos).getByText('Registro de acesso')).toBeTruthy()
    // A ordem dos títulos não pula: o `h2` da tela, e as duas seções em `h3`.
    expect(screen.getByRole('heading', { level: 3, name: 'O que a escola guarda, e por quanto tempo' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Prazos que não mudam' })).toBeTruthy()
  })
})

describe('Empresas: os estados', () => {
  it('carregando: o título já está à vista, e a leitura ainda não chegou', async () => {
    const rede = fakeNetwork()
    const lida = rede.segurar()
    montar('suboperadores')
    expect(await screen.findByText('Carregando as empresas que recebem dados…')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Empresas que recebem dados' })).toBeTruthy()
    expect(screen.queryByText('Nenhuma empresa recebe dado desta escola')).toBeNull()
    lida.liberar({ status: 200, corpo: { suboperadores: [empresa('alfa')] } })
    await screen.findByRole('table', { name: 'Empresas que recebem dado da escola hoje' })
  })

  it('erro: "Tentar de novo" lê outra vez', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let respostas = 0
    rede.responderPor(SUBOPERADORES, () => (++respostas === 1 ? FORA : { status: 200, corpo: { suboperadores: [empresa('alfa')] } }))
    montar('suboperadores')
    await screen.findByRole('alert')
    expect(screen.queryByText('Nenhuma empresa recebe dado desta escola')).toBeNull()
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await screen.findByRole('table', { name: 'Empresas que recebem dado da escola hoje' })
  })

  it('vazio: só com a leitura terminada, sem a seção das passadas', async () => {
    const rede = fakeNetwork()
    rede.responderPor(SUBOPERADORES, { status: 200, corpo: { suboperadores: [] } })
    montar('suboperadores')
    expect(screen.queryByText('Nenhuma empresa recebe dado desta escola')).toBeNull()
    await screen.findByText('Nenhuma empresa recebe dado desta escola')
    expect(screen.queryByRole('heading', { name: 'Empresas que já receberam dado da escola' })).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('com dado: as vigentes e as passadas em tabelas separadas, cada seção um `h3`, com o que cada empresa faz, recebe e onde processa', async () => {
    const rede = fakeNetwork()
    rede.responderPor(SUBOPERADORES, {
      status: 200,
      corpo: { suboperadores: [empresa('vigente', { pais: 'US' }), empresa('antiga', { fim: '2026-06-01T15:00:00.000Z', vedaTreinamento: false })] },
    })
    montar('suboperadores')
    const vigentes = await screen.findByRole('table', { name: 'Empresas que recebem dado da escola hoje' })
    expect(within(vigentes).getByText('Empresa vigente')).toBeTruthy()
    expect(within(vigentes).queryByText('Empresa antiga')).toBeNull()
    expect(within(vigentes).getByText('Faz o que vigente faz')).toBeTruthy()
    expect(within(vigentes).getByText('Estados Unidos')).toBeTruthy()
    const passadas = screen.getByRole('table', { name: 'Empresas que já receberam dado da escola' })
    expect(within(passadas).getByText('Empresa antiga')).toBeTruthy()
    expect(within(passadas).getByText('O contrato não proíbe usar o dado para treinar IA')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Empresas que recebem dado da escola hoje' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Empresas que já receberam dado da escola' })).toBeTruthy()
  })

  it('só passadas: as vigentes dizem que nenhuma empresa recebe dado hoje, e as passadas continuam à vista', async () => {
    const rede = fakeNetwork()
    rede.responderPor(SUBOPERADORES, { status: 200, corpo: { suboperadores: [empresa('antiga', { fim: '2026-06-01T15:00:00.000Z' })] } })
    montar('suboperadores')
    await screen.findByText('Nenhuma empresa recebe dado desta escola')
    const passadas = screen.getByRole('table', { name: 'Empresas que já receberam dado da escola' })
    expect(within(passadas).getByText('Empresa antiga')).toBeTruthy()
    expect(screen.queryByRole('table', { name: 'Empresas que recebem dado da escola hoje' })).toBeNull()
  })
})

/** O cartão de um incidente, achado pela circunstância dele: a região se chama "Incidente conhecido em <dia>". */
function cartaoDo(n: number): HTMLElement {
  const achado = screen.getAllByRole('region', { name: /^Incidente conhecido em/ }).find((regiao) => regiao.textContent?.includes(`Circunstância ${String(n)}`))
  if (achado === undefined) throw new Error(`nenhum cartão do incidente ${String(n)}`)
  return achado
}

describe('Incidentes: os estados', () => {
  it('carregando: o título já está à vista, e o vazio só aparece com a leitura terminada', async () => {
    const rede = fakeNetwork()
    const lida = rede.segurar()
    montar('incidentes')
    expect(await screen.findByText('Carregando os incidentes…')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Incidentes' })).toBeTruthy()
    expect(screen.queryByText('Nenhum incidente afetou esta escola')).toBeNull()
    lida.liberar(dosIncidentes([]))
    await screen.findByText('Nenhum incidente afetou esta escola')
  })

  it('erro: "Tentar de novo" lê outra vez', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let respostas = 0
    rede.responderPor(INCIDENTES, () => (++respostas === 1 ? FORA : dosIncidentes([incidente(1)])))
    montar('incidentes')
    await screen.findByRole('alert')
    expect(screen.queryByText('Nenhum incidente afetou esta escola')).toBeNull()
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await screen.findAllByRole('region', { name: /^Incidente conhecido em/ })
  })

  it('vazio: o prazo legal continua à vista e não há cartão', async () => {
    const rede = fakeNetwork()
    rede.responderPor(INCIDENTES, dosIncidentes([]))
    montar('incidentes')
    await screen.findByText('Nenhum incidente afetou esta escola')
    expect(screen.getByRole('note').textContent).toContain(PRAZO_LEGAL)
    expect(screen.queryByRole('region', { name: /^Incidente conhecido em/ })).toBeNull()
  })

  it('com dado: cada aviso é um cartão com todos os campos, o que espera vem com o botão oficial e o confirmado não tem botão', async () => {
    const rede = fakeNetwork()
    rede.responderPor(
      INCIDENTES,
      dosIncidentes([incidente(2, { contencao: 'Primeira linha\nSegunda linha' }), incidente(1, { confirmadoEm: '2026-10-02T18:00:00.000Z' })]),
    )
    montar('incidentes')
    await screen.findAllByRole('region', { name: /^Incidente conhecido em/ })
    const regioes = screen.getAllByRole('region', { name: /^Incidente conhecido em/ })
    // Na ordem em que a API entregou: o que espera a confirmação primeiro.
    expect(regioes.map((regiao) => regiao.textContent?.includes('Circunstância 2'))).toEqual([true, false])
    const esperando = cartaoDo(2)
    expect(within(esperando).getByRole('heading', { level: 3 }).textContent).toMatch(/^Incidente conhecido em /)
    // O estado não é só texto: o selo leva a família dele, pendente enquanto espera e ok depois de confirmado.
    expect(within(esperando).getByText('Aguardando a confirmação da coordenação').closest('[data-estado]')?.getAttribute('data-estado')).toBe('pendente')
    for (const rotulo of ['O que aconteceu', 'Dados alcançados', 'Pessoas alcançadas', 'Risco para as pessoas', 'O que a Turmma fez para conter', 'O que a Turmma faz para corrigir', 'Quando a Turmma soube', 'Quando o aviso chegou à escola']) {
      expect(within(esperando).getByText(rotulo)).toBeTruthy()
    }
    // O texto da operação respeita a quebra de linha que trouxe.
    expect(within(esperando).getByText(/Primeira linha/).className).toContain('whitespace-pre-line')
    expect(within(esperando).getByRole('button', { name: 'Confirmo que recebi' })).toBeTruthy()
    const confirmado = cartaoDo(1)
    expect(within(confirmado).getByText(/^Recebimento confirmado em /).closest('[data-estado]')?.getAttribute('data-estado')).toBe('ok')
    expect(within(confirmado).queryByRole('button')).toBeNull()
  })

  it('confirmar: o botão desliga os dos outros, o cartão passa a confirmado e o foco vai para o título dele', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let confirmados: readonly number[] = []
    // O pedido fica no ar até o teste soltá-lo: é o que mostra os botões esperando.
    let soltar: () => void = () => undefined
    const noAr = new Promise<void>((resolver) => (soltar = resolver))
    rede.responderPor(INCIDENTES, () => dosIncidentes([2, 1].map((n) => incidente(n, confirmados.includes(n) ? { confirmadoEm: '2026-10-09T18:00:00.000Z' } : {}))))
    rede.responderPor(CONFIRMAR, async () => {
      await noAr
      confirmados = [1]
      return { status: 204 }
    })
    montar('incidentes')
    await screen.findAllByRole('region', { name: /^Incidente conhecido em/ })
    await usuario.click(within(cartaoDo(1)).getByRole('button', { name: 'Confirmo que recebi' }))
    // Com o pedido de um no ar, o botão dele diz que está confirmando e o do outro espera: o clique duplo não manda dois pedidos.
    const doQueConfirma = await within(cartaoDo(1)).findByRole('button', { name: 'Confirmando…' })
    expect((doQueConfirma as HTMLButtonElement).disabled).toBe(true)
    expect((within(cartaoDo(2)).getByRole('button', { name: 'Confirmo que recebi' }) as HTMLButtonElement).disabled).toBe(true)
    soltar()
    await waitFor(() => expect(within(cartaoDo(1)).getByText(/^Recebimento confirmado em /)).toBeTruthy())
    expect(within(cartaoDo(1)).queryByRole('button')).toBeNull()
    expect(document.activeElement).toBe(within(cartaoDo(1)).getByRole('heading', { level: 3 }))
    // O outro continua esperando, com o botão de volta.
    expect(within(cartaoDo(2)).getByRole('button', { name: 'Confirmo que recebi' })).toBeTruthy()
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toHaveLength(1)
  })

  it('a falha da confirmação aparece só no cartão que falhou, e o botão dele volta', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor(INCIDENTES, dosIncidentes([incidente(2), incidente(1)]))
    rede.responderPor(CONFIRMAR, FORA)
    montar('incidentes')
    await screen.findAllByRole('region', { name: /^Incidente conhecido em/ })
    await usuario.click(within(cartaoDo(1)).getByRole('button', { name: 'Confirmo que recebi' }))
    await waitFor(() => expect(within(cartaoDo(1)).getByRole('alert').textContent).not.toBe(''))
    expect(within(cartaoDo(2)).getByRole('alert').textContent).toBe('')
    // O cartão que falhou continua esperando, e o botão está de volta para tentar de novo.
    const botao = within(cartaoDo(1)).getByRole('button', { name: 'Confirmo que recebi' })
    expect((botao as HTMLButtonElement).disabled).toBe(false)
    expect(within(cartaoDo(1)).getByText('Aguardando a confirmação da coordenação')).toBeTruthy()
  })
})
