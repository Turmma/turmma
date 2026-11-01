// @vitest-environment jsdom
import type { ConteudoDoArtefato as Conteudo } from '@educa/shared'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { describe, expect, it } from 'vitest'
import { createQueryClient } from '../../../api/query-client'
import { setupScreen, fakeNetwork, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import Artefato from './Artefato'
import { ConteudoDoArtefato } from './ConteudoDoArtefato'
import { TEXTO_DA_REJEITADA_SEM_PDF, TEXTO_DO_RASCUNHO_EM_PDF } from './entregas'

/**
 * O documento aberto em folha (telas do professor, 6.0; RF13, RF22): os quatro estados, a aba pelo endereço, o que cada
 * situação da versão adaptada deixa fazer (exportar, aplicar, renomear) e o interruptor "Gabarito". A rede é falsa e responde
 * **por caminho**; a tela, as abas, o cliente de consultas e o endereço (`memoryLocation`) são os de verdade. O que só o
 * navegador mostra — a largura da folha, a barra de baixo, o foco depois de renomear, a segunda pessoa na mesma aba — é do e2e.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const TURMA = id(100)
const DISCIPLINA = id(200)
const MATERIAL = id(300)
const QUEM_DECIDE = { id: id(400), nome: 'Camila Souza sintética' }
const ENUNCIADO = 'Qual a massa de CO₂ formada na queima completa de 24 g de carbono?'
const EXPLICACAO = '24 g de carbono são 2 mol, que formam 2 mol de CO₂, ou 88 g.'

const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })

const questao = {
  enunciado: ENUNCIADO,
  alternativas: ['44 g', '88 g', '24 g', '12 g'],
  gabarito: 1,
  habilidade: { codigo: 'QUI.EM.04', descricao: 'Usar a proporção da equação balanceada.' },
  citacao: { materialId: MATERIAL, pagina: 142, trecho: 'Na combustão completa, cada mol de carbono forma um mol de dióxido de carbono.' },
  explicacao: EXPLICACAO,
}

type Entrega = { id: string; estado: 'pendente' | 'aprovada' | 'rejeitada'; decididaEm: string | null }

function atividade(n: number, campos: Record<string, unknown> = {}) {
  return {
    id: id(n),
    tipo: 'atividade_objetiva',
    titulo: `Atividade ${String(n)}`,
    turmaId: TURMA,
    disciplinaId: DISCIPLINA,
    origemId: null,
    adaptacao: null,
    entrega: null,
    criadoEm: '2026-10-05T13:00:00.000Z',
    conteudo: { tipo: 'atividade_objetiva', titulo: `Atividade ${String(n)}`, questoes: [questao] },
    versoesAdaptadas: [],
    aplicacoes: [],
    ...campos,
  }
}

/** A versão adaptada de uma atividade, com a entrega no estado dado. */
function versao(n: number, origem: { id: string }, entrega: Entrega) {
  return atividade(n, { titulo: `Versão ${String(n)}`, origemId: origem.id, adaptacao: { tipos: ['fonte_ampliada'] }, entrega: { id: entrega.id, estado: entrega.estado, decididaEm: entrega.decididaEm } })
}
const resumo = ({ conteudo: _conteudo, versoesAdaptadas: _versoes, aplicacoes: _aplicacoes, ...resumido }: ReturnType<typeof atividade>) => resumido

const entregaDe = (n: number, estado: Entrega['estado']): Entrega => ({ id: id(900 + n), estado, decididaEm: estado === 'pendente' ? null : '2026-10-05T13:42:00.000Z' })
const entregaCompleta = (artefato: { id: string; titulo: string }, entrega: Entrega) => ({
  id: entrega.id,
  tipo: 'versao_adaptada',
  funcao: 'adaptacao',
  estado: entrega.estado,
  turmaId: TURMA,
  titulo: artefato.titulo,
  artefatoId: artefato.id,
  atividadeAplicadaId: null,
  criadaEm: '2026-10-05T13:40:00.000Z',
  decididaEm: entrega.decididaEm,
  decididaPor: entrega.estado === 'pendente' ? null : QUEM_DECIDE,
  justificativa: entrega.estado === 'rejeitada' ? 'A questão 1 perdeu o enunciado.' : null,
})

const PLANO = {
  ...atividade(5, { tipo: 'plano_de_aula', titulo: 'Plano de ondas' }),
  conteudo: {
    tipo: 'plano_de_aula',
    titulo: 'Plano de ondas',
    duracaoMinutos: 50,
    objetivos: ['Reconhecer a onda'],
    etapas: [{ titulo: 'Abertura', minutos: 10, descricao: 'Mostrar a onda na corda.' }],
    avaliacao: 'Pela participação.',
    habilidades: [{ codigo: 'FIS.EM.01', descricao: 'Reconhecer ondas.' }],
    citacoes: [questao.citacao],
  },
}

interface Mundo {
  readonly artefatos: readonly (Record<string, unknown> & { readonly id: string })[]
  readonly entregas?: readonly unknown[]
  readonly aplicadas?: readonly unknown[]
}

/** O que a tela lê: o artefato pelo id (404 para o que o mundo não tem), os materiais, os vínculos, as entregas e as aplicações. */
function instalar(rede: FakeNetwork, { artefatos, entregas = [], aplicadas = [] }: Mundo): void {
  rede.responderPor(/^\/v1\/artefatos\/[^/?]+(\?|$)/, (caminho) => {
    const pedido = caminho.split('?')[0]?.split('/').at(-1)
    const achado = artefatos.find((artefato) => artefato.id === pedido)
    return achado === undefined ? erro(404, 'NAO_ENCONTRADO') : ok(achado)
  })
  rede.responderPor('/v1/materiais', ok({ itens: [{ id: MATERIAL, titulo: 'Química 2, cap. 7', disciplinaId: DISCIPLINA }] }))
  rede.responderPor('/v1/meus-vinculos', ok({ itens: [{ id: id(450), turma: { id: TURMA, nome: '7ºA' }, disciplina: { id: DISCIPLINA, nome: 'Química' }, estado: 'confirmado' }] }))
  rede.responderPor('/v1/entregas', ok({ itens: entregas }))
  rede.responderPor('/v1/atividades-aplicadas', ok({ itens: aplicadas }))
}

function montar(artefatoId: string, busca = '') {
  const localizacao = memoryLocation({ path: `/artefatos/${artefatoId}`, searchPath: busca, record: true })
  const tela = render(
    <QueryClientProvider client={createQueryClient()}>
      <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
        <Artefato artefatoId={artefatoId} />
      </Router>
    </QueryClientProvider>,
  )
  return { localizacao, ...tela }
}

const abaSelecionada = () => screen.getByRole('tab', { selected: true }).textContent
const nomesDasAbas = () => screen.getAllByRole('tab').map((aba) => aba.textContent)
const nuncaResponde = () => new Promise<FakeResponse>(() => undefined)

describe('o documento: os quatro estados', () => {
  it('carregando: o voltar para Criados e o texto de espera, sem o vazio nem o erro', async () => {
    const rede = fakeNetwork()
    instalar(rede, { artefatos: [] })
    rede.responderPor(`/v1/artefatos/${id(1)}`, nuncaResponde)
    montar(id(1))
    expect(await screen.findByText('Carregando o artefato…')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar para Criados' }).getAttribute('href')).toBe('/criados')
    expect(screen.queryByText('Este artefato não está disponível')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('erro: a mensagem do catálogo, sem código, e "Tentar de novo" lê de novo e abre o documento', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhar = true
    // Limite excedido não é repetido sozinho: o erro chega na hora, sem esperar a nova tentativa.
    rede.responderPor(`/v1/artefatos/${id(1)}`, () => (falhar ? erro(429, 'LIMITE_EXCEDIDO') : ok(atividade(1))))
    instalar(rede, { artefatos: [] })
    montar(id(1))
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).not.toMatch(/LIMITE_EXCEDIDO|429/)
    expect(screen.queryByText('Este artefato não está disponível')).toBeNull()
    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Atividade 1' })).toBeTruthy()
  })

  it('o documento de outra turma, o de outra escola e o que não existe respondem com a mesma tela (regra 10, item 6)', async () => {
    // A API responde as três coisas com o mesmo `NAO_ENCONTRADO`; a tela não tem outro caminho para distingui-las. Que a API responde assim
    // para o documento da colega de outra turma e o de outra escola, quem prova é o teste de integração
    // `apps/api/src/artefato/artefato.int.test.ts` ("o artefato de A não é lido, renomeado, exportado nem adaptado pela professora de B,
    // pela colega de outra turma… igual ao inexistente"); este só prova o que a tela faz com a resposta.
    const telas: string[] = []
    for (const outro of [id(11), id(12), id(13)]) {
      const rede = fakeNetwork()
      instalar(rede, { artefatos: [atividade(1)] })
      const { container, unmount } = montar(outro)
      await screen.findByText('Este artefato não está disponível')
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByRole('tab')).toBeNull()
      expect(screen.queryByText(ENUNCIADO)).toBeNull()
      expect(screen.getByRole('link', { name: 'Voltar para Criados' })).toBeTruthy()
      telas.push(container.innerHTML)
      unmount()
    }
    expect(new Set(telas).size).toBe(1)
  })

  it('com dado: o título, a linha de dados, a assinatura da IA e a folha com a questão, a página de origem e o gabarito', async () => {
    const rede = fakeNetwork()
    instalar(rede, { artefatos: [atividade(1)] })
    montar(id(1))
    expect(await screen.findByRole('heading', { level: 1, name: 'Atividade 1' })).toBeTruthy()
    expect(screen.getByText(/Atividade objetiva · 7ºA · Química · gerado em/)).toBeTruthy()
    expect(screen.getByText('Assistente · conversa e ferramentas')).toBeTruthy()
    const folha = await screen.findByRole('article', { name: 'Atividade 1' })
    expect(within(folha).getByText(ENUNCIADO)).toBeTruthy()
    expect(within(folha).getByText(/Página 142/)).toBeTruthy()
    expect(within(folha).getByText(EXPLICACAO)).toBeTruthy()
    expect(within(folha).getByText('Gabarito', { exact: true })).toBeTruthy()
  })
})

describe('o documento: a aba pelo endereço', () => {
  const comVersao = () => {
    const origem = atividade(1)
    const pendente = versao(2, origem, entregaDe(2, 'pendente'))
    return { origem: { ...origem, versoesAdaptadas: [resumo(pendente)] }, pendente }
  }

  it('o documento com versão tem as três abas, Conteúdo, Versões adaptadas e Na turma, nessa ordem, e abre em Conteúdo', async () => {
    const { origem, pendente } = comVersao()
    instalar(fakeNetwork(), { artefatos: [origem, pendente] })
    montar(origem.id)
    await screen.findByRole('tab', { name: 'Conteúdo' })
    expect(nomesDasAbas()).toEqual(['Conteúdo', 'Versões adaptadas', 'Na turma'])
    expect(abaSelecionada()).toBe('Conteúdo')
  })

  it('sem versão, a aba das versões não existe: são Conteúdo e Na turma, e `?aba=versoes` cai em Conteúdo', async () => {
    instalar(fakeNetwork(), { artefatos: [atividade(1)] })
    montar(id(1), 'aba=versoes')
    await screen.findByRole('tab', { name: 'Conteúdo' })
    expect(nomesDasAbas()).toEqual(['Conteúdo', 'Na turma'])
    expect(abaSelecionada()).toBe('Conteúdo')
    expect(screen.queryByRole('region', { name: 'Versões adaptadas' })).toBeNull()
  })

  it('o plano de aula não tem o que aplicar: só Conteúdo, e `?aba=turma` cai nela', async () => {
    instalar(fakeNetwork(), { artefatos: [PLANO] })
    montar(PLANO.id, 'aba=turma')
    await screen.findByRole('tab', { name: 'Conteúdo' })
    expect(nomesDasAbas()).toEqual(['Conteúdo'])
    expect(abaSelecionada()).toBe('Conteúdo')
    expect(screen.queryByText('Esta atividade ainda não foi aplicada.')).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Gabarito' })).toBeNull()
  })

  it('`?aba=turma` abre Na turma, com a seção de aplicar; `?aba=versoes`, as versões; valor que não existe, Conteúdo', async () => {
    const { origem, pendente } = comVersao()
    const mundo = { artefatos: [origem, pendente], entregas: [entregaCompleta(pendente, entregaDe(2, 'pendente'))] }

    instalar(fakeNetwork(), mundo)
    const turma = montar(origem.id, 'aba=turma')
    expect(await screen.findByText('Esta atividade ainda não foi aplicada.')).toBeTruthy()
    expect(abaSelecionada()).toBe('Na turma')
    expect(screen.queryByRole('article')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Versões adaptadas' })).toBeNull()
    turma.unmount()

    instalar(fakeNetwork(), mundo)
    const versoes = montar(origem.id, 'aba=versoes')
    expect(await screen.findByRole('region', { name: 'Versões adaptadas' })).toBeTruthy()
    expect(abaSelecionada()).toBe('Versões adaptadas')
    expect(screen.queryByRole('article')).toBeNull()
    expect(screen.queryByText('Esta atividade ainda não foi aplicada.')).toBeNull()
    // A seção existe desde o primeiro quadro (a frase só vem com a lista lida): é ela que prova que a aba não a monta.
    expect(screen.queryByRole('region', { name: 'Na turma' })).toBeNull()
    versoes.unmount()

    for (const busca of ['', 'aba=xyz', 'aba=', 'aba=Turma']) {
      instalar(fakeNetwork(), mundo)
      const { unmount } = montar(origem.id, busca)
      await screen.findByRole('article', { name: origem.titulo })
      expect(abaSelecionada(), busca).toBe('Conteúdo')
      expect(screen.queryByRole('region', { name: 'Na turma' }), busca).toBeNull()
      unmount()
    }
  })

  it('trocar de aba troca o endereço com `replace`: a aba nova no endereço e o histórico com o mesmo tamanho', async () => {
    const usuario = userEvent.setup()
    const { origem, pendente } = comVersao()
    instalar(fakeNetwork(), { artefatos: [origem, pendente] })
    const { localizacao } = montar(origem.id)
    await screen.findByRole('article', { name: origem.titulo })
    const antes = localizacao.history.length

    await usuario.click(screen.getByRole('tab', { name: 'Na turma' }))
    expect(localizacao.history.length).toBe(antes)
    expect(localizacao.history.at(-1)).toBe(`/artefatos/${origem.id}?aba=turma`)
    expect(abaSelecionada()).toBe('Na turma')

    await usuario.click(screen.getByRole('tab', { name: 'Versões adaptadas' }))
    expect(localizacao.history.length).toBe(antes)
    expect(localizacao.history.at(-1)).toBe(`/artefatos/${origem.id}?aba=versoes`)
  })
})

describe('o documento: a versão adaptada e o que cada situação deixa fazer', () => {
  it('a rejeitada não exporta: sem "Exportar em PDF", com o texto de hoje, e quem rejeitou e por quê; ela também não muda de nome', async () => {
    const origem = atividade(1)
    const rejeitada = versao(2, origem, entregaDe(2, 'rejeitada'))
    instalar(fakeNetwork(), { artefatos: [origem, rejeitada], entregas: [entregaCompleta(rejeitada, entregaDe(2, 'rejeitada'))] })
    montar(rejeitada.id)
    await screen.findByRole('heading', { level: 1, name: 'Versão 2' })
    expect(screen.queryByRole('button', { name: /Exportar/ })).toBeNull()
    expect(document.querySelector('[data-sem-pdf]')?.textContent).toBe(TEXTO_DA_REJEITADA_SEM_PDF)
    expect(screen.queryByRole('button', { name: 'Renomear' })).toBeNull()
    await waitFor(() => expect(document.querySelector('[data-aprovacao="rejeitada"]')?.textContent).toContain(`${QUEM_DECIDE.nome} rejeitou`))
    expect(document.querySelector('[data-aprovacao="rejeitada"]')?.textContent).toContain('A questão 1 perdeu o enunciado.')
  })

  it('a pendente exporta como rascunho, diz isso antes do clique e leva a decidir; a aprovada exporta limpa e diz quem aprovou', async () => {
    const origem = atividade(1)
    const pendente = versao(2, origem, entregaDe(2, 'pendente'))
    instalar(fakeNetwork(), { artefatos: [origem, pendente], entregas: [entregaCompleta(pendente, entregaDe(2, 'pendente'))] })
    const primeira = montar(pendente.id)
    await screen.findByRole('heading', { level: 1, name: 'Versão 2' })
    expect(screen.getByRole('button', { name: 'Exportar rascunho em PDF' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Exportar em PDF' })).toBeNull()
    expect(screen.getByText(TEXTO_DO_RASCUNHO_EM_PDF)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver e decidir' }).getAttribute('href')).toBe('/time/assistente')
    primeira.unmount()

    const aprovada = versao(3, origem, entregaDe(3, 'aprovada'))
    instalar(fakeNetwork(), { artefatos: [origem, aprovada], entregas: [entregaCompleta(aprovada, entregaDe(3, 'aprovada'))] })
    montar(aprovada.id)
    await screen.findByRole('heading', { level: 1, name: 'Versão 3' })
    expect(screen.getByRole('button', { name: 'Exportar em PDF' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Exportar rascunho em PDF' })).toBeNull()
    await waitFor(() => expect(document.querySelector('[data-aprovacao="aprovada"]')?.textContent).toContain(`Aprovada por ${QUEM_DECIDE.nome}`))
  })

  it('a versão adaptada nasce pendente: a decisão fica à vista também na aba Na turma da própria versão, não há "Aplicar à turma", e o original ao lado continua aplicável', async () => {
    const origem = atividade(1)
    const pendente = versao(2, origem, entregaDe(2, 'pendente'))
    const mundo = { artefatos: [{ ...origem, versoesAdaptadas: [resumo(pendente)] }, pendente], entregas: [entregaCompleta(pendente, entregaDe(2, 'pendente'))] }

    instalar(fakeNetwork(), mundo)
    const daVersao = montar(pendente.id, 'aba=turma')
    expect(await screen.findByText('Esta versão adaptada só pode ser aplicada à turma depois que você aprovar.')).toBeTruthy()
    expect(document.querySelector('[data-aprovacao="pendente"]')?.textContent).toBe('Esperando você')
    expect(screen.queryByRole('button', { name: 'Aplicar à turma' })).toBeNull()
    daVersao.unmount()

    instalar(fakeNetwork(), mundo)
    montar(origem.id, 'aba=turma')
    expect(await screen.findByRole('button', { name: 'Aplicar à turma' })).toBeTruthy()
    expect(screen.queryByText('Esta versão adaptada só pode ser aplicada à turma depois que você aprovar.')).toBeNull()
  })

  it('na aba das versões, cada uma diz a situação dela: a pendente espera a professora e a aprovada diz quem aprovou', async () => {
    const origem = atividade(1)
    const pendente = versao(2, origem, entregaDe(2, 'pendente'))
    const aprovada = versao(3, origem, entregaDe(3, 'aprovada'))
    const entregas = [entregaCompleta(pendente, entregaDe(2, 'pendente')), entregaCompleta(aprovada, entregaDe(3, 'aprovada'))]
    instalar(fakeNetwork(), { artefatos: [{ ...origem, versoesAdaptadas: [resumo(pendente), resumo(aprovada)] }, pendente, aprovada], entregas })
    montar(origem.id, 'aba=versoes')
    const regiao = await screen.findByRole('region', { name: 'Versões adaptadas' })
    expect(within(regiao).getAllByRole('link')).toHaveLength(2)
    await waitFor(() => expect(regiao.querySelector('[data-aprovacao="aprovada"]')?.textContent).toContain(`Aprovada por ${QUEM_DECIDE.nome}`))
    expect(regiao.querySelector('[data-aprovacao="pendente"]')?.textContent).toBe('Esperando você')
  })
})

describe('o documento: o interruptor "Gabarito"', () => {
  it('começa ligado, como o artefato sempre foi; desligado, a alternativa certa deixa de ser marcada e a explicação some, e a página de origem fica', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork(), { artefatos: [atividade(1)] })
    montar(id(1))
    const folha = await screen.findByRole('article', { name: 'Atividade 1' })
    const interruptor = screen.getByRole('switch', { name: 'Gabarito' })
    expect(interruptor.getAttribute('aria-checked')).toBe('true')
    expect(within(folha).getByText('Gabarito', { exact: true })).toBeTruthy()
    expect(within(folha).getByText(EXPLICACAO)).toBeTruthy()

    await usuario.click(interruptor)
    expect(interruptor.getAttribute('aria-checked')).toBe('false')
    expect(within(folha).queryByText('Gabarito', { exact: true })).toBeNull()
    expect(within(folha).queryByText(EXPLICACAO)).toBeNull()
    expect(within(folha).getByText('88 g')).toBeTruthy()
    expect(within(folha).getByText(/Página 142/)).toBeTruthy()

    await usuario.click(interruptor)
    expect(within(folha).getByText('Gabarito', { exact: true })).toBeTruthy()
    expect(within(folha).getByText(EXPLICACAO)).toBeTruthy()
  })
})

describe('ConteudoDoArtefato: o gabarito sem a prop', () => {
  it('quem não passa `comGabarito` (a conversa e o formulário) continua vendo a alternativa certa marcada e a explicação', () => {
    render(<ConteudoDoArtefato conteudo={atividade(1).conteudo as Conteudo} materiais={{}} />)
    expect(screen.getByText('Gabarito', { exact: true })).toBeTruthy()
    expect(screen.getByText(EXPLICACAO)).toBeTruthy()
  })
})

describe('o documento: renomear', () => {
  it('o foco volta ao botão "Renomear" ao salvar e ao cancelar, e não se perde no `body` (regra 50, item 11)', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const origem = atividade(1)
    // Registrada antes de `instalar`: a primeira que casa responde. O PATCH devolve o artefato renomeado, e o resto, o de antes.
    rede.responderPor(/^\/v1\/artefatos\/[^/?]+(\?|$)/, () => ok(rede.chamadas.at(-1)?.metodo === 'PATCH' ? { ...origem, titulo: 'Lista 3 revisada' } : origem))
    instalar(rede, { artefatos: [origem] })
    montar(origem.id)
    const botao = await screen.findByRole('button', { name: 'Renomear' })

    // Cancelar: o formulário some com o foco dentro dele, e o botão volta a ser o foco.
    await usuario.click(botao)
    expect(await screen.findByLabelText('Novo título')).toBeTruthy()
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Renomear' })))
    expect(screen.queryByLabelText('Novo título')).toBeNull()

    // Salvar: o pedido sai com só o título, e o foco volta depois que o formulário fechou.
    await usuario.click(screen.getByRole('button', { name: 'Renomear' }))
    const campo = await screen.findByLabelText('Novo título')
    await usuario.clear(campo)
    await usuario.type(campo, 'Lista 3 revisada')
    await usuario.click(screen.getByRole('button', { name: 'Salvar o título' }))
    await waitFor(() => expect(screen.queryByLabelText('Novo título')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Renomear' })))
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'PATCH')).toHaveLength(1)
  })
})
