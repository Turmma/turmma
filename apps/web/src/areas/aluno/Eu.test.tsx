// @vitest-environment jsdom
import { focusManager, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { MEMORIA_DO_TUTOR_QUERY_KEY } from '../../api/chaves-do-aluno'
import { createQueryClient } from '../../api/query-client'
import { setupScreen, fakeNetwork, renderScreen } from '../../__fixtures__/render-screen'
import { SignOutContext } from '../../components/sign-out-context'
import { escolherLetra } from '../../text-size'
import type { MemoriaDoTutorResponse } from '@educa/shared'
import { DESCRICAO_DO_VAZIO, ROTULO_DAS_HABILIDADES, ROTULO_DO_CARREGANDO, TEXTO_DA_CONTESTACAO, TITULO_DO_VAZIO } from './como-estou-indo'
import Eu from './Eu'

/**
 * "Eu" do aluno nos quatro estados (telas do aluno e primeiro acesso, 2.0 e 7.0; RF3, RF9, RF10, RF20): carregando, erro, o
 * aluno sem turma — que é o vazio dele, e só vale com a leitura terminada — e com dado. As linhas **Privacidade** e **Sair**
 * existem em todos: o "Sair" não pode depender de a turma nem de a memória terem chegado (D59). O "Sair" é o da casca, pelo
 * contexto. "Como estou indo" tem os quatro estados dele e não derruba o cartão da turma.
 */
setupScreen()

const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const FALHA = { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: REQUISICAO } } } as const
const NAO_ACHADA = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'x', requisicaoId: REQUISICAO } } } as const
const COM_TURMA = {
  status: 200,
  corpo: {
    escola: { nome: 'Escola sintética' },
    turma: { id: '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5', nome: '7º A' },
    serie: { id: '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f6', etapa: 'ef_anos_finais', ano: 7 },
  },
} as const
const SEM_TURMA_NO_ANO = 'Você ainda não está em uma turma neste ano letivo. Fale com quem dá a aula ou com a coordenação.'
const MEMORIA_VAZIA = { status: 200, corpo: { trabalhos: [], sinais: [] } } as const
const LIMITANTE = { codigo: 'EF09CI01', descricao: 'Reconhecer o reagente limitante' }
const MASSA_MOLAR = { codigo: 'EF09CI02', descricao: 'Calcular a massa molar' }
type TrabalhoNaMemoria = MemoriaDoTutorResponse['trabalhos'][number]
let contador = 0
/**
 * O trabalho da memória, sem correção aprovada (`resultado: null`) a menos que o caso diga. O mesmo contrato que
 * `e2e/support/tutor-memory.ts` monta para o e2e: o `tsc` da web não alcança `e2e/` (extensão `.ts` e `node:crypto`).
 */
function trabalhoNaMemoria(campos: Partial<TrabalhoNaMemoria> = {}): TrabalhoNaMemoria {
  contador += 1
  return { atividadeAplicadaId: `0192a4c0-5b1e-7c3d-8e4f-${String(contador).padStart(12, '0')}`, titulo: 'Lista sintética', enviadaEm: '2026-10-05T13:00:00.000Z', resultado: null, ...campos }
}
const resultadoAprovado = (campos: Partial<NonNullable<TrabalhoNaMemoria['resultado']>> = {}) => ({ acertos: 7, total: 8, aReforcar: [], ...campos })
/** A resposta inteira, com um sinal de trabalho que a tela não pode mostrar nem guardar. */
const memoriaDoAluno = (trabalhos: readonly TrabalhoNaMemoria[]): MemoriaDoTutorResponse => ({
  trabalhos: [...trabalhos],
  sinais: [{ tipo: 'resposta_pronta', atividadeAplicadaId: trabalhos[0]?.atividadeAplicadaId ?? null, questao: 3, criadoEm: '2026-10-05T13:30:00.000Z' }],
})
/** Uma leitura que nunca termina: o estado de carregando. */
const NUNCA = () => new Promise<never>(() => undefined)

/** A área do aluno monta as rotas sob `/aluno`; o `Router` com a mesma base dá ao link o endereço que o navegador teria. */
function montar(saida?: ComponentProps<typeof SignOutContext>['value']) {
  const eu = (
    <Router base="/aluno">
      <Eu />
    </Router>
  )
  return renderScreen(saida === undefined ? eu : <SignOutContext value={saida}>{eu}</SignOutContext>)
}

/** A linha de apoio do título de Eu: a turma, a série por extenso e a escola, sem cartão próprio (RF20; mockup 2.5). */
const TURMA_NO_CABECALHO = '7º A · 7º ano do Ensino Fundamental · Escola sintética'
const turmaNoCabecalho = () => screen.getByText(TURMA_NO_CABECALHO)
const esperarATurma = () => screen.findByText(TURMA_NO_CABECALHO)

/** As linhas Privacidade, Ajustes e Sair, que têm de estar em qualquer estado. */
function conferirAsLinhas(): { sair: HTMLElement; privacidade: HTMLElement; ajustes: HTMLElement } {
  const linhas = screen.getByRole('list', { name: 'Conta' })
  const privacidade = within(linhas).getByRole('link', { name: 'Privacidade' })
  expect(privacidade.getAttribute('href')).toBe('/aluno/privacidade')
  // "Rever a introdução" (9.0; RF9, RF17) é um link para o mesmo endereço da primeira entrada, entre Ajustes e Sair, em todo estado.
  expect(within(linhas).getByRole('link', { name: 'Rever a introdução' }).getAttribute('href')).toBe('/aluno/bem-vindo')
  expect(within(linhas).getAllByRole('listitem').map((linha) => linha.textContent)).toEqual(['Privacidade', 'Ajustes', 'Rever a introdução', 'Sair'])
  return { sair: within(linhas).getByRole('button', { name: 'Sair' }), privacidade, ajustes: within(linhas).getByRole('button', { name: 'Ajustes' }) }
}

/** A seção "Como estou indo", pelo título dela. */
const comoEstouIndo = () => screen.getByRole('region', { name: 'Como estou indo' })

describe('Eu', () => {
  it('carregando: o título, os dois rótulos do carregamento e as duas linhas, e nenhuma turma nem tarefa ainda', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', NUNCA)
    rede.responderPor('/v1/tutor/memoria', NUNCA)
    montar()

    const rotulos = (await screen.findAllByRole('status')).map((status) => status.textContent)
    expect(rotulos).toEqual(expect.arrayContaining(['Carregando a sua turma…', ROTULO_DO_CARREGANDO]))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Eu')
    expect(screen.queryByText(SEM_TURMA_NO_ANO)).toBeNull()
    expect(screen.queryByText(TITULO_DO_VAZIO)).toBeNull()
    conferirAsLinhas()
  })

  it('com dado: a turma, a série por extenso e a escola na linha de apoio do título, "Como estou indo" antes das linhas', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', COM_TURMA)
    rede.responderPor('/v1/tutor/memoria', MEMORIA_VAZIA)
    montar()

    expect(await esperarATurma()).toBeTruthy()
    const principal = document.body
    expect(principal.textContent).toContain('Escola sintética')
    expect(principal.textContent).toContain('7º ano do Ensino Fundamental')
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    const { sair } = conferirAsLinhas()
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((titulo) => titulo.textContent)
    expect(titulos).toEqual(['Como estou indo'])
    // A ordem na página: o título com a turma, "Como estou indo", linhas.
    const turma = turmaNoCabecalho()
    expect(turma.compareDocumentPosition(comoEstouIndo()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(comoEstouIndo().compareDocumentPosition(sair) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('o título "Rever a introdução" quebra em até duas linhas, e o dos outros fica em uma só com reticências (a 360 px ele não pode sair cortado)', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', COM_TURMA)
    rede.responderPor('/v1/tutor/memoria', MEMORIA_VAZIA)
    montar()
    await esperarATurma()
    const linhas = screen.getByRole('list', { name: 'Conta' })

    const rever = within(linhas).getByText('Rever a introdução').className
    expect(rever).toContain('line-clamp-2')
    expect(rever).not.toContain('truncate')
    expect(within(linhas).getByText('Privacidade').className).toContain('truncate')
  })

  it('o aluno sem turma no ano: o texto de hoje numa região de status, sem "Tentar de novo" nem erro de rede, e "Como estou indo" segue, vazio', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', NAO_ACHADA)
    rede.responderPor('/v1/tutor/memoria', NAO_ACHADA)
    montar()

    // O carregando também é uma região de status: o texto de quem está sem turma é o que prova que a leitura terminou.
    expect((await screen.findByText(SEM_TURMA_NO_ANO)).getAttribute('role')).toBe('status')
    expect(await within(comoEstouIndo()).findByText(TITULO_DO_VAZIO)).toBeTruthy()
    expect(screen.queryByText('Carregando a sua turma…')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    conferirAsLinhas()
  })

  it('com erro de rede na turma: o alerta com "Tentar de novo", e o "Sair" continua ao alcance', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', FALHA)
    rede.responderPor('/v1/tutor/memoria', MEMORIA_VAZIA)
    montar()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(screen.queryByText(SEM_TURMA_NO_ANO)).toBeNull()
    conferirAsLinhas()
  })

  it('"Sair" é a saída da casca: um clique chama a saída do contexto, uma vez, e nada mais é pedido à API pela linha', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', COM_TURMA)
    rede.responderPor('/v1/tutor/memoria', MEMORIA_VAZIA)
    const sair = vi.fn()
    montar({ sair, saindo: false })
    await esperarATurma()
    await within(comoEstouIndo()).findByText(TITULO_DO_VAZIO)
    const chamadasAntes = rede.chamadas.length

    await userEvent.setup().click(conferirAsLinhas().sair)

    expect(sair).toHaveBeenCalledTimes(1)
    expect(rede.chamadas).toHaveLength(chamadasAntes)
  })

  it('saindo: a linha diz "Saindo…" no lugar de "Sair"', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', COM_TURMA)
    rede.responderPor('/v1/tutor/memoria', MEMORIA_VAZIA)
    montar({ sair: () => undefined, saindo: true })
    await esperarATurma()

    expect(screen.getByRole('button', { name: 'Saindo…' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull()
  })
})

describe('Eu: "Como estou indo"', () => {
  it('só a correção aprovada: o trabalho sem resultado não aparece, nem a contagem dele', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', COM_TURMA)
    const pendente = trabalhoNaMemoria({ titulo: 'Lista que ainda espera a professora', resultado: null })
    const aprovado = trabalhoNaMemoria({ titulo: 'Lista aprovada', resultado: resultadoAprovado({ acertos: 7, total: 8 }) })
    rede.responderPor('/v1/tutor/memoria', { status: 200, corpo: memoriaDoAluno([pendente, aprovado]) })
    montar()

    const secao = comoEstouIndo()
    expect(await within(secao).findByText('7 de 8 certas')).toBeTruthy()
    expect(within(secao).getAllByRole('listitem')).toHaveLength(1)
    expect(within(secao).getByText('Lista aprovada')).toBeTruthy()
    expect(document.body.textContent).not.toContain('Lista que ainda espera a professora')
    expect(screen.queryByText(TITULO_DO_VAZIO)).toBeNull()
    // A contestação aparece junto do que o aluno pode contestar.
    expect(within(secao).getByText(TEXTO_DA_CONTESTACAO)).toBeTruthy()
    // A correção sem habilidade a rever (acertou tudo, ou nada ficou para reforçar) não ganha o rótulo "Para rever" vazio.
    expect(within(secao).queryByText(ROTULO_DAS_HABILIDADES)).toBeNull()
  })

  it('só trabalho sem aprovação: é o vazio, e não uma lista de tarefas pendentes', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', COM_TURMA)
    rede.responderPor('/v1/tutor/memoria', { status: 200, corpo: memoriaDoAluno([trabalhoNaMemoria({ titulo: 'Lista pendente' })]) })
    montar()

    const secao = comoEstouIndo()
    expect(await within(secao).findByText(TITULO_DO_VAZIO)).toBeTruthy()
    expect(within(secao).getByText(DESCRICAO_DO_VAZIO)).toBeTruthy()
    expect(within(secao).queryByRole('listitem')).toBeNull()
    expect(screen.queryByText('Lista pendente')).toBeNull()
    expect(screen.queryByText(TEXTO_DA_CONTESTACAO)).toBeNull()
  })

  it('as habilidades a rever vêm como a API mandou: código e descrição, na ordem dela', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', COM_TURMA)
    const trabalho = trabalhoNaMemoria({ titulo: 'Lista com habilidades', resultado: resultadoAprovado({ acertos: 2, total: 6, aReforcar: [MASSA_MOLAR, LIMITANTE] }) })
    rede.responderPor('/v1/tutor/memoria', { status: 200, corpo: memoriaDoAluno([trabalho]) })
    montar()

    const secao = comoEstouIndo()
    expect(await within(secao).findByText('2 de 6 certas')).toBeTruthy()
    const habilidades = within(secao)
      .getAllByRole('listitem')
      .filter((item) => item.textContent?.startsWith('EF09CI') === true)
      .map((item) => item.textContent)
    expect(habilidades).toEqual([`${MASSA_MOLAR.codigo} · ${MASSA_MOLAR.descricao}`, `${LIMITANTE.codigo} · ${LIMITANTE.descricao}`])
    // A web não calcula limiar nenhum: nem selo de "vale revisar" nem percentual.
    expect(secao.textContent).not.toMatch(/vale revisar|%/i)
  })

  it('os sinais do Tutor não vão à tela nem ao cache: a memória chega com eles, e o cache guarda só os trabalhos corrigidos', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', COM_TURMA)
    const aprovado = trabalhoNaMemoria({ titulo: 'Lista aprovada', resultado: resultadoAprovado() })
    const memoria = memoriaDoAluno([aprovado])
    expect(memoria.sinais).toHaveLength(1)
    rede.responderPor('/v1/tutor/memoria', { status: 200, corpo: memoria })
    const cliente = createQueryClient()
    render(
      <QueryClientProvider client={cliente}>
        <Router base="/aluno">
          <Eu />
        </Router>
      </QueryClientProvider>,
    )

    await within(comoEstouIndo()).findByText('Lista aprovada')
    expect(cliente.getQueryData(MEMORIA_DO_TUTOR_QUERY_KEY)).toEqual([aprovado])
    expect(JSON.stringify(cliente.getQueryCache().getAll().map((consulta) => consulta.state.data))).not.toContain('resposta_pronta')
    expect(document.body.textContent).not.toMatch(/resposta_pronta|travou|duvida_repetida|resposta pronta/i)
  })

  it('nada de colega, média, posição, sequência de dias, ponto ou meta (RF10), e a rede vê só a turma e a memória', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', COM_TURMA)
    rede.responderPor('/v1/tutor/memoria', { status: 200, corpo: memoriaDoAluno([trabalhoNaMemoria({ resultado: resultadoAprovado({ aReforcar: [LIMITANTE] }) })]) })
    montar()
    await esperarATurma()
    await within(comoEstouIndo()).findByText('7 de 8 certas')

    expect(document.body.textContent ?? '').not.toMatch(/colega|média|posição|ranking|sequência|pontos|meta\b|prêmio/i)
    expect(rede.chamadas.map((chamada) => chamada.caminho).sort()).toEqual(['/v1/minha-turma', '/v1/tutor/memoria'])
  })

  it('a leitura dura 5 minutos e não é refeita ao voltar para a aba, nem ao abrir Eu de novo', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', COM_TURMA)
    rede.responderPor('/v1/tutor/memoria', { status: 200, corpo: memoriaDoAluno([trabalhoNaMemoria({ titulo: 'Lista aprovada', resultado: resultadoAprovado() })]) })
    const cliente = createQueryClient()
    const eu = (
      <QueryClientProvider client={cliente}>
        <Router base="/aluno">
          <Eu />
        </Router>
      </QueryClientProvider>
    )
    const memorias = () => rede.chamadas.filter((chamada) => chamada.caminho === '/v1/tutor/memoria').length
    const primeira = render(eu)
    await within(comoEstouIndo()).findByText('Lista aprovada')
    primeira.unmount()
    render(eu)
    await within(comoEstouIndo()).findByText('Lista aprovada')
    expect(memorias()).toBe(1)

    // Passados mais de 5 minutos (e antes de o token de teste vencer, aos 10) a leitura está velha, mas voltar para a aba não a refaz: a correção só muda quando quem dá a aula aprova.
    // Só o `Date` é falso, e continua até o fim: o cliente decide se a leitura está velha depois de um turno (`resumePausedMutations`).
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(Date.now() + 6 * 60_000)
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      // Dá tempo de uma releitura sair, se a opção a mandasse: o cliente decide depois de alguns turnos, e a espera vem antes da conferência.
      await new Promise((resolver) => setTimeout(resolver, 50))
      // A leitura segue parada (nada em voo) e a rede não viu pedido novo: a primeira conferência não depende da rede responder.
      expect(cliente.getQueryState(MEMORIA_DO_TUTOR_QUERY_KEY)?.fetchStatus).toBe('idle')
      expect(memorias()).toBe(1)
    } finally {
      focusManager.setFocused(undefined)
      vi.useRealTimers()
    }
  })

  it('carregando: o rótulo dele, e o cartão da turma e as linhas já à vista', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', COM_TURMA)
    rede.responderPor('/v1/tutor/memoria', NUNCA)
    montar()

    await esperarATurma()
    expect(within(comoEstouIndo()).getByRole('status').textContent).toBe(ROTULO_DO_CARREGANDO)
    expect(screen.queryByText(TITULO_DO_VAZIO)).toBeNull()
    conferirAsLinhas()
  })

  it('erro: "Tentar de novo" na seção, sem derrubar o cartão da turma, e a lista volta quando a API volta', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', COM_TURMA)
    let falha = true
    rede.responderPor('/v1/tutor/memoria', () => (falha ? FALHA : { status: 200, corpo: memoriaDoAluno([trabalhoNaMemoria({ titulo: 'Lista aprovada', resultado: resultadoAprovado() })]) }))
    montar()

    const secao = comoEstouIndo()
    expect(await within(secao).findByRole('alert')).toBeTruthy()
    expect(turmaNoCabecalho()).toBeTruthy()
    expect(screen.queryByText(TITULO_DO_VAZIO)).toBeNull()
    conferirAsLinhas()

    falha = false
    await userEvent.setup().click(within(secao).getByRole('button', { name: 'Tentar de novo' }))
    expect(await within(secao).findByText('Lista aprovada')).toBeTruthy()
  })
})

describe('Eu: Ajustes', () => {
  // O `jsdom` não abre o `<dialog>` em modo modal: o mesmo dublê de `Atividade.test.tsx`. O Esc e o foco preso são do e2e.
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  })

  afterEach(() => {
    // Os espiões de `setItem` e `removeItem` não passam para o caso seguinte (e o `escolherLetra` abaixo grava de verdade).
    vi.restoreAllMocks()
    window.localStorage.clear()
    escolherLetra('padrao')
  })

  /** A turma e a memória respondem, para a tela estar parada com dado enquanto o diálogo abre. */
  function montarComDado() {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minha-turma', COM_TURMA)
    rede.responderPor('/v1/tutor/memoria', MEMORIA_VAZIA)
    return montar()
  }

  it('a linha "Ajustes" abre o diálogo com a aparência e o tamanho da letra, sem gravar nada, e o "Fechar" devolve o foco à linha', async () => {
    window.localStorage.clear()
    const gravar = vi.spyOn(Storage.prototype, 'setItem')
    const apagar = vi.spyOn(Storage.prototype, 'removeItem')
    const usuario = userEvent.setup()
    montarComDado()
    await esperarATurma()
    const { ajustes } = conferirAsLinhas()
    expect(screen.queryByRole('dialog')).toBeNull()

    await usuario.click(ajustes)
    const dialogo = await screen.findByRole('dialog', { name: 'Ajustes' })
    expect(within(dialogo).getByRole('radiogroup', { name: 'Aparência' })).toBeTruthy()
    expect(within(dialogo).getByRole('group', { name: 'Tamanho da letra' })).toBeTruthy()
    expect(within(dialogo).queryByText(/senha/i)).toBeNull()
    expect(gravar).not.toHaveBeenCalled()
    expect(apagar).not.toHaveBeenCalled()
    expect(Object.entries(window.localStorage)).toEqual([])

    await usuario.click(within(dialogo).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(ajustes)
    expect(Object.entries(window.localStorage)).toEqual([])
  })

  it('abrir de novo mostra a escolha que ficou, e o foco volta à linha ao fechar', async () => {
    const usuario = userEvent.setup()
    montarComDado()
    await esperarATurma()
    const { ajustes } = conferirAsLinhas()

    await usuario.click(ajustes)
    const dialogo = await screen.findByRole('dialog', { name: 'Ajustes' })
    await usuario.click(within(dialogo).getByRole('radio', { name: 'Grande' }))
    expect(Object.entries(window.localStorage)).toEqual([['educa.letra', 'grande']])

    await usuario.click(within(dialogo).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(ajustes)

    await usuario.click(ajustes)
    const reaberto = await screen.findByRole('dialog', { name: 'Ajustes' })
    expect((within(reaberto).getByRole('radio', { name: 'Grande' }) as HTMLInputElement).checked).toBe(true)
  })
})

