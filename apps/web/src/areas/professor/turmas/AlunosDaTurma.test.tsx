// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../../api/query-client'
import { TEST_AUTHORIZATION, setupScreen, fakeNetwork, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import { buttonVariants } from '../../../components/ui/button-variants'
import AlunosDaTurma from './AlunosDaTurma'

/**
 * A aba Alunos da turma aberta (telas do professor, 12.0; RF18, RF21): a lista de nomes em ordem de nome, com os acertos das
 * correções aprovadas, e os pedidos de nome no alto. A rede é falsa e responde **por caminho**; a aba, os pedidos, o acesso, a
 * tabela e o cliente de consultas são os de verdade. O fluxo de decidir um pedido (o diálogo) fica para o e2e.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const TURMA = id(100)
const ESCOLA = { id: id(2), nome: 'Escola sintética', slug: 'escola-sintetica' }
const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })

const aluno = (n: number, nome: string) => ({ usuarioId: id(n), nome })
const HABILIDADE = { codigo: 'QUI.EM.04', descricao: 'Estequiometria' }
const desempenhoDe = (n: number, nome: string, acertos: number, total: number) => ({
  alunoId: id(n),
  nome,
  acertos,
  total,
  porHabilidade: total === 0 ? [] : [{ habilidade: HABILIDADE, acertos, total }],
})
const desempenho = (alunos: readonly unknown[], lotesAprovados = 1) => ok({ turmaId: TURMA, lotesAprovados, porHabilidade: [], alunos })

// Em ordem de id, como a API entrega: a ordem de nome é outra (Ana, Bruno, Caio), e a de acerto, outra ainda.
const BRUNO = aluno(1, 'Bruno Sintético')
const CAIO = aluno(2, 'Caio Sintético')
const ANA = aluno(3, 'Ana Sintética')

const SEM_PEDIDOS = ok({ itens: [] })
const MENSAGEM_DO_FIM = 'Todos os alunos da turma estão na lista.'

interface Leituras {
  alunos?: FakeResponse | ((caminho: string) => FakeResponse | Promise<FakeResponse>)
  desempenho?: FakeResponse | (() => FakeResponse | Promise<FakeResponse>)
  /** O acesso da turma. `'na-fila'` não registra caminho: o teste responde na ordem dos pedidos (a leitura e o gerar são o mesmo caminho). */
  acesso?: FakeResponse | (() => FakeResponse | Promise<FakeResponse>) | 'na-fila'
}

function instalar(rede: FakeNetwork, { alunos = ok({ itens: [BRUNO, CAIO, ANA] }), desempenho: acertos = desempenho([]), acesso = ok({ expiraEm: null }) }: Leituras = {}): void {
  rede.responderPor(`/v1/turmas/${TURMA}/alunos`, alunos)
  rede.responderPor(`/v1/turmas/${TURMA}/desempenho`, acertos)
  rede.responderPor(`/v1/turmas/${TURMA}/reivindicacoes`, SEM_PEDIDOS)
  if (acesso !== 'na-fila') rede.responderPor(`/v1/turmas/${TURMA}/acesso`, acesso)
}

function montar(aoPerderATurma: () => void = () => undefined) {
  const cliente = createQueryClient()
  const tela = render(
    <QueryClientProvider client={cliente}>
      <AlunosDaTurma turmaId={TURMA} turmaNome="7º A" escola={ESCOLA} aoPerderATurma={aoPerderATurma} />
    </QueryClientProvider>,
  )
  return { cliente, ...tela }
}

/** Os nomes da tabela, na ordem em que a tela os mostra. */
const nomesNaTela = () => screen.getAllByRole('rowheader').map((celula) => celula.textContent)
const linhaDe = (nome: string) => screen.getByRole('rowheader', { name: nome }).closest('tr') as HTMLElement
const doAluno = (nome: string) => within(linhaDe(nome))

const chamadasA = (rede: FakeNetwork, caminho: string) => rede.chamadas.filter((chamada) => chamada.caminho.split('?')[0] === `/v1/turmas/${TURMA}/${caminho}`)

/** Uma resposta que só sai quando o teste manda. */
function segurada(): { resposta: Promise<FakeResponse>; liberar: (resposta: FakeResponse) => void } {
  let liberar: (resposta: FakeResponse) => void = () => undefined
  const resposta = new Promise<FakeResponse>((resolver) => (liberar = resolver))
  return { resposta, liberar }
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(min-width: 768px)', media: consulta, addEventListener: () => undefined, removeEventListener: () => undefined }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
})

describe('Alunos: a lista de nomes da turma', () => {
  it('com dado: os alunos em ordem de nome, e não na de id que a API entrega, cada um com os seus acertos', async () => {
    const rede = fakeNetwork()
    instalar(rede, { desempenho: desempenho([desempenhoDe(1, BRUNO.nome, 1, 2), desempenhoDe(2, CAIO.nome, 2, 2), desempenhoDe(3, ANA.nome, 0, 2)]) })
    montar()

    expect(await screen.findByRole('region', { name: 'Por aluno' })).toBeTruthy()
    await waitFor(() => expect(doAluno(ANA.nome).getByText('0 de 2')).toBeTruthy())
    expect(nomesNaTela()).toEqual([ANA.nome, BRUNO.nome, CAIO.nome])
    expect(doAluno(BRUNO.nome).getByText('1 de 2')).toBeTruthy()
    expect(doAluno(CAIO.nome).getByText('2 de 2')).toBeTruthy()
    expect(doAluno(CAIO.nome).getByText('QUI.EM.04: 2 de 2')).toBeTruthy()
    expect(screen.getByText('3 alunos, em ordem de nome. Os acertos são os das correções aprovadas.')).toBeTruthy()
    expect(screen.getByText(MENSAGEM_DO_FIM)).toBeTruthy()
    // Com alunos na lista e ninguém que saiu, nem o vazio nem o aviso de quem saiu aparecem.
    expect(screen.queryByText('A lista ainda não chegou')).toBeNull()
    expect(screen.queryByText(/Quem saiu da turma/)).toBeNull()
  })

  it('a web lê a lista de cem em cem, sem `?anoLetivoId` e sem finalidade, e os acertos de lote aprovado: nenhuma outra rota de aluno', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await screen.findByRole('region', { name: 'Por aluno' })

    expect(chamadasA(rede, 'alunos')).toEqual([{ caminho: `/v1/turmas/${TURMA}/alunos?limite=100`, metodo: 'GET', autorizacao: TEST_AUTHORIZATION }])
    expect(rede.chamadas.filter((chamada) => /anoLetivoId|finalidade/.test(chamada.caminho))).toEqual([])
    // Só a lista, os acertos aprovados, os pedidos e o acesso: a aba não lê correção, sinal nem conversa. Correção pendente ou
    // rejeitada nem chega à web, e por isso não entra na conta.
    expect([...new Set(rede.chamadas.map((chamada) => chamada.caminho.split('?')[0]))].sort()).toEqual(
      [`/v1/turmas/${TURMA}/acesso`, `/v1/turmas/${TURMA}/alunos`, `/v1/turmas/${TURMA}/desempenho`, `/v1/turmas/${TURMA}/reivindicacoes`].sort(),
    )
  })

  it('aluno sem correção aprovada: aparece com "Sem correção aprovada", e não some nem vira "0 de 0"', async () => {
    const rede = fakeNetwork()
    // Bruno tem total zero no desempenho; Caio nem consta nele; Ana tem um acerto.
    instalar(rede, { desempenho: desempenho([desempenhoDe(1, BRUNO.nome, 0, 0), desempenhoDe(3, ANA.nome, 1, 2)]) })
    montar()
    await screen.findByRole('region', { name: 'Por aluno' })
    await waitFor(() => expect(doAluno(ANA.nome).getByText('1 de 2')).toBeTruthy())

    expect(nomesNaTela()).toEqual([ANA.nome, BRUNO.nome, CAIO.nome])
    expect(doAluno(BRUNO.nome).getByText('Sem correção aprovada')).toBeTruthy()
    expect(doAluno(CAIO.nome).getByText('Sem correção aprovada')).toBeTruthy()
    expect(screen.queryByText('0 de 0')).toBeNull()
  })

  it('turma sem nenhuma correção aprovada: todos aparecem, todos "Sem correção aprovada"', async () => {
    const rede = fakeNetwork()
    instalar(rede, { desempenho: desempenho([], 0) })
    montar()
    await screen.findByRole('region', { name: 'Por aluno' })

    await waitFor(() => expect(screen.getAllByText('Sem correção aprovada')).toHaveLength(3))
    expect(nomesNaTela()).toEqual([ANA.nome, BRUNO.nome, CAIO.nome])
  })

  it('aluno transferido ou com o acesso desativado: o desempenho o traz e a lista não, e ele aparece com o estado próprio, sem número', async () => {
    const rede = fakeNetwork()
    const dora = aluno(9, 'Dora Sintética')
    instalar(rede, { alunos: ok({ itens: [BRUNO, ANA] }), desempenho: desempenho([desempenhoDe(1, BRUNO.nome, 1, 2), desempenhoDe(3, ANA.nome, 2, 2), desempenhoDe(9, dora.nome, 2, 2)]) })
    montar()
    await screen.findByRole('region', { name: 'Por aluno' })

    await waitFor(() => expect(doAluno(dora.nome).getByText('Saiu da turma')).toBeTruthy())
    expect(nomesNaTela()).toEqual([ANA.nome, BRUNO.nome, dora.nome])
    expect(within(linhaDe(dora.nome)).queryByText(/\d de \d/)).toBeNull()
    expect(screen.getByText('Quem saiu da turma (transferido, ou com o acesso desativado) aparece sem acertos.')).toBeTruthy()
    // Quem está na turma não ganha o estado.
    expect(screen.getAllByText('Saiu da turma')).toHaveLength(1)
  })

  it('com páginas por ler, o aluno que o desempenho traz e a lista ainda não trouxe não é dado como quem saiu da turma', async () => {
    const rede = fakeNetwork()
    const dora = aluno(9, 'Dora Sintética')
    instalar(rede, {
      alunos: ok({ itens: [BRUNO, ANA], proxima: ANA.usuarioId }),
      desempenho: desempenho([desempenhoDe(1, BRUNO.nome, 1, 2), desempenhoDe(3, ANA.nome, 2, 2), desempenhoDe(9, dora.nome, 2, 2)]),
    })
    montar()
    await screen.findByRole('region', { name: 'Por aluno' })
    await waitFor(() => expect(doAluno(ANA.nome).getByText('2 de 2')).toBeTruthy())

    expect(nomesNaTela()).toEqual([ANA.nome, BRUNO.nome])
    expect(screen.queryByText('Saiu da turma')).toBeNull()
    expect(screen.queryByText(/Quem saiu da turma/)).toBeNull()
  })

  it('nenhum controle ordena por acerto, nem busca por nome, nem mostra situação, média, selo de adaptação ou a conversa do aluno', async () => {
    const rede = fakeNetwork()
    // O aluno de mais acerto é o último do alfabeto, e o de menos, o primeiro: a ordem de acerto seria a inversa da de nome.
    instalar(rede, { desempenho: desempenho([desempenhoDe(1, BRUNO.nome, 1, 2), desempenhoDe(2, CAIO.nome, 2, 2), desempenhoDe(3, ANA.nome, 0, 2)]) })
    montar()
    await screen.findByRole('region', { name: 'Por aluno' })
    await waitFor(() => expect(doAluno(CAIO.nome).getByText('2 de 2')).toBeTruthy())

    expect(nomesNaTela()).toEqual([ANA.nome, BRUNO.nome, CAIO.nome])
    const secao = screen.getByRole('region', { name: 'Por aluno' })
    expect(within(secao).queryAllByRole('button').map((botao) => botao.textContent)).toEqual([])
    expect(within(secao).queryAllByRole('columnheader').map((cabecalho) => cabecalho.querySelector('button'))).toEqual([null, null, null])
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    const texto = document.body.textContent ?? ''
    expect(texto).not.toMatch(/\bnotas?\b|\bconceitos?\b|pontua|m[ée]dia|ranking|p[óo]dio|posi[çc]|atenção:|adaptação|abrir a conversa|em dia/i)
  })

  it('o vazio diz "A lista ainda não chegou" e o caminho: a coordenação monta a lista; e não aparece com acertos ainda por ler', async () => {
    const rede = fakeNetwork()
    const acertos = segurada()
    instalar(rede, { alunos: ok({ itens: [] }), desempenho: () => acertos.resposta })
    const { cliente } = montar()

    // A lista veio vazia, mas os acertos ainda não: o vazio espera, porque o desempenho pode trazer quem a lista não traz.
    await waitFor(() => expect(cliente.getQueryState(['alunos-da-turma', TURMA])?.status).toBe('success'))
    await waitFor(() => expect(chamadasA(rede, 'desempenho')).toHaveLength(1))
    expect(screen.queryByText('A lista ainda não chegou')).toBeNull()
    acertos.liberar(desempenho([], 0))

    expect(await screen.findByText('A lista ainda não chegou')).toBeTruthy()
    expect(screen.getByText(/peça a ela/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Por aluno' })).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('Alunos: os estados da leitura', () => {
  it('carregando: a lista diz que carrega, e os acertos de cada aluno dizem que carregam; nada afirma "Sem correção aprovada" antes da hora', async () => {
    const rede = fakeNetwork()
    const lista = segurada()
    const acertos = segurada()
    instalar(rede, { alunos: () => lista.resposta, desempenho: () => acertos.resposta })
    montar()

    expect(await screen.findByText('Carregando os alunos da turma…')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Por aluno' })).toBeNull()
    lista.liberar(ok({ itens: [BRUNO, ANA] }))
    await screen.findByRole('region', { name: 'Por aluno' })
    expect(screen.queryByText('Carregando os alunos da turma…')).toBeNull()
    expect(screen.getAllByText('Carregando os acertos…')).toHaveLength(2)
    expect(screen.queryByText('Sem correção aprovada')).toBeNull()
    acertos.liberar(desempenho([desempenhoDe(1, BRUNO.nome, 1, 2)]))
    await waitFor(() => expect(screen.queryByText('Carregando os acertos…')).toBeNull())
    expect(doAluno(BRUNO.nome).getByText('1 de 2')).toBeTruthy()
    expect(doAluno(ANA.nome).getByText('Sem correção aprovada')).toBeTruthy()
  })

  it('a lista ainda carrega e os acertos já chegaram: nada de "A lista ainda não chegou" antes da hora', async () => {
    const rede = fakeNetwork()
    const lista = segurada()
    instalar(rede, { alunos: () => lista.resposta, desempenho: desempenho([], 0) })
    const { cliente } = montar()

    expect(await screen.findByText('Carregando os alunos da turma…')).toBeTruthy()
    await waitFor(() => expect(cliente.getQueryState(['desempenho', TURMA])?.status).toBe('success'))
    expect(screen.getByText('Carregando os alunos da turma…')).toBeTruthy()
    expect(screen.queryByText('A lista ainda não chegou')).toBeNull()
    lista.liberar(ok({ itens: [] }))
    expect(await screen.findByText('A lista ainda não chegou')).toBeTruthy()
  })

  it('erro da lista: a mensagem e "Tentar de novo", e a tabela não aparece; tentar de novo lê outra vez e mostra os alunos', async () => {
    const rede = fakeNetwork()
    let falhar = true
    instalar(rede, { alunos: () => (falhar ? erro(500, 'ERRO_INTERNO') : ok({ itens: [BRUNO, ANA] })) })
    const usuario = userEvent.setup()
    montar()

    // O erro de rede tem uma nova tentativa automática, um segundo depois.
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' }, { timeout: 4000 })
    expect(screen.queryByRole('region', { name: 'Por aluno' })).toBeNull()
    expect(screen.queryByText('A lista ainda não chegou')).toBeNull()
    falhar = false
    await usuario.click(botao)

    expect(await screen.findByRole('region', { name: 'Por aluno' })).toBeTruthy()
    expect(nomesNaTela()).toEqual([ANA.nome, BRUNO.nome])
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  }, 10_000)

  it('erro dos acertos: os nomes continuam na tela, com "Acertos não lidos" e o próprio "Tentar de novo", que lê só os acertos', async () => {
    const rede = fakeNetwork()
    let falhar = true
    instalar(rede, { desempenho: () => (falhar ? erro(500, 'ERRO_INTERNO') : desempenho([desempenhoDe(1, BRUNO.nome, 1, 2)])) })
    const usuario = userEvent.setup()
    montar()

    const botao = await screen.findByRole('button', { name: 'Tentar de novo' }, { timeout: 4000 })
    expect(nomesNaTela()).toEqual([ANA.nome, BRUNO.nome, CAIO.nome])
    expect(screen.getAllByText('Acertos não lidos')).toHaveLength(3)
    expect(screen.queryByText('Sem correção aprovada')).toBeNull()
    const listaAntes = chamadasA(rede, 'alunos').length
    falhar = false
    await usuario.click(botao)

    await waitFor(() => expect(doAluno(BRUNO.nome).getByText('1 de 2')).toBeTruthy())
    expect(screen.queryByText('Acertos não lidos')).toBeNull()
    expect(chamadasA(rede, 'alunos')).toHaveLength(listaAntes)
  }, 10_000)

  it('a releitura dos acertos que falha com o dado já na tela não tira os acertos nem põe o erro no lugar', async () => {
    const rede = fakeNetwork()
    let falhar = false
    instalar(rede, { desempenho: () => (falhar ? erro(500, 'ERRO_INTERNO') : desempenho([desempenhoDe(1, BRUNO.nome, 1, 2)])) })
    const { cliente } = montar()
    await screen.findByRole('region', { name: 'Por aluno' })
    await waitFor(() => expect(doAluno(BRUNO.nome).getByText('1 de 2')).toBeTruthy())

    falhar = true
    await cliente.refetchQueries({ queryKey: ['desempenho', TURMA] })
    await waitFor(() => expect(cliente.getQueryState(['desempenho', TURMA])?.status).toBe('error'))
    expect(doAluno(BRUNO.nome).getByText('1 de 2')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(screen.queryByText('Acertos não lidos')).toBeNull()
  }, 10_000)

  it('mais de uma página: "Ver mais" lê a seguinte com a `pagina` da anterior, e os nomes das duas voltam juntos em ordem de nome', async () => {
    const rede = fakeNetwork()
    const dora = aluno(4, 'Dora Sintética')
    const aninha = aluno(5, 'Aninha Sintética')
    instalar(rede, { alunos: (caminho) => (caminho.includes('pagina=') ? ok({ itens: [dora, aninha] }) : ok({ itens: [BRUNO, CAIO, ANA], proxima: ANA.usuarioId })) })
    const usuario = userEvent.setup()
    montar()
    await screen.findByRole('region', { name: 'Por aluno' })

    expect(nomesNaTela()).toEqual([ANA.nome, BRUNO.nome, CAIO.nome])
    expect(screen.getByText('3 alunos até aqui, em ordem de nome. Os acertos são os das correções aprovadas.')).toBeTruthy()
    expect(screen.queryByText(MENSAGEM_DO_FIM)).toBeNull()

    await usuario.click(screen.getByRole('button', { name: 'Ver mais' }))
    await waitFor(() => expect(nomesNaTela()).toHaveLength(5))
    // "Aninha" da segunda página fica entre "Ana" e "Bruno" da primeira: reordena tudo o que já foi lido.
    expect(nomesNaTela()).toEqual([ANA.nome, aninha.nome, BRUNO.nome, CAIO.nome, dora.nome])
    expect(chamadasA(rede, 'alunos').map((chamada) => chamada.caminho)).toEqual([`/v1/turmas/${TURMA}/alunos?limite=100`, `/v1/turmas/${TURMA}/alunos?limite=100&pagina=${ANA.usuarioId}`])
    expect(screen.queryByRole('button', { name: 'Ver mais' })).toBeNull()
    expect(screen.getByText('5 alunos, em ordem de nome. Os acertos são os das correções aprovadas.')).toBeTruthy()
  })

  it('dois cliques no mesmo instante em "Ver mais" pedem a página seguinte uma vez só', async () => {
    const rede = fakeNetwork()
    const segunda = segurada()
    instalar(rede, { alunos: (caminho) => (caminho.includes('pagina=') ? segunda.resposta : ok({ itens: [BRUNO, ANA], proxima: ANA.usuarioId })) })
    montar()
    await screen.findByRole('region', { name: 'Por aluno' })

    const botao = screen.getByRole('button', { name: 'Ver mais' })
    botao.click()
    botao.click()
    await waitFor(() => expect(chamadasA(rede, 'alunos')).toHaveLength(2))
    // Enquanto a página não chega, o botão diz que carrega e não aceita outro toque.
    const carregando = await screen.findByRole('button', { name: 'Carregando…' })
    expect((carregando as HTMLButtonElement).disabled).toBe(true)
    segunda.liberar(ok({ itens: [CAIO] }))
    await waitFor(() => expect(nomesNaTela()).toHaveLength(3))
    expect(chamadasA(rede, 'alunos')).toHaveLength(2)
  })

  it('o foco depois de "Ver mais": fica no botão enquanto há mais, e vai à frase do fim quando o botão sai da tela', async () => {
    const rede = fakeNetwork()
    instalar(rede, {
      alunos: (caminho) => {
        if (caminho.includes(`pagina=${CAIO.usuarioId}`)) return ok({ itens: [ANA] })
        if (caminho.includes(`pagina=${BRUNO.usuarioId}`)) return ok({ itens: [CAIO], proxima: CAIO.usuarioId })
        return ok({ itens: [BRUNO], proxima: BRUNO.usuarioId })
      },
    })
    const usuario = userEvent.setup()
    montar()
    await screen.findByRole('region', { name: 'Por aluno' })
    // Abrir a aba não leva o foco a lugar nenhum: ele só se mexe depois de "Ver mais".
    expect(document.activeElement).toBe(document.body)

    await usuario.click(screen.getByRole('button', { name: 'Ver mais' }))
    await waitFor(() => expect(nomesNaTela()).toHaveLength(2))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ver mais' }))

    await usuario.click(screen.getByRole('button', { name: 'Ver mais' }))
    await waitFor(() => expect(nomesNaTela()).toHaveLength(3))
    expect(screen.queryByRole('button', { name: 'Ver mais' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByText(MENSAGEM_DO_FIM))
  })

  it('o foco que a professora levou a outro lugar enquanto a página chega não é tomado de volta', async () => {
    const rede = fakeNetwork()
    const segunda = segurada()
    instalar(rede, { alunos: (caminho) => (caminho.includes('pagina=') ? segunda.resposta : ok({ itens: [BRUNO], proxima: BRUNO.usuarioId })) })
    const usuario = userEvent.setup()
    montar()
    await screen.findByRole('region', { name: 'Por aluno' })

    await usuario.click(screen.getByRole('button', { name: 'Ver mais' }))
    await waitFor(() => expect(chamadasA(rede, 'alunos')).toHaveLength(2))
    const outro = await screen.findByRole('button', { name: 'Convidar alunos' })
    outro.focus()
    segunda.liberar(ok({ itens: [CAIO] }))
    await waitFor(() => expect(nomesNaTela()).toHaveLength(2))
    expect(document.activeElement).toBe(outro)
  })

  it('a falha de "Ver mais" mantém os nomes já lidos e oferece tentar de novo, que lê a mesma página', async () => {
    const rede = fakeNetwork()
    let falhar = true
    instalar(rede, { alunos: (caminho) => (caminho.includes('pagina=') ? (falhar ? erro(500, 'ERRO_INTERNO') : ok({ itens: [CAIO] })) : ok({ itens: [BRUNO, ANA], proxima: ANA.usuarioId })) })
    const usuario = userEvent.setup()
    montar()
    await screen.findByRole('region', { name: 'Por aluno' })

    await usuario.click(screen.getByRole('button', { name: 'Ver mais' }))
    const tentar = await screen.findByRole('button', { name: 'Tentar de novo' }, { timeout: 4000 })
    expect(nomesNaTela()).toEqual([ANA.nome, BRUNO.nome])
    falhar = false
    await usuario.click(tentar)

    await waitFor(() => expect(nomesNaTela()).toEqual([ANA.nome, BRUNO.nome, CAIO.nome]))
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  }, 10_000)
})

describe('Alunos: a turma, o cache e os pedidos de nome', () => {
  it('a lista não fica no cache: ao sair da aba e voltar, ela é lida de novo; os nomes não ficam em localStorage, sessionStorage nem no endereço', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    const primeira = montar()
    await screen.findByRole('region', { name: 'Por aluno' })
    expect(chamadasA(rede, 'alunos')).toHaveLength(1)

    primeira.unmount()
    await waitFor(() => expect(primeira.cliente.getQueryCache().findAll({ queryKey: ['alunos-da-turma'] })).toHaveLength(0))
    expect(JSON.stringify(primeira.cliente.getQueryCache().getAll().map((consulta) => consulta.state.data))).not.toContain('Sintético')

    montar()
    await screen.findByRole('region', { name: 'Por aluno' })
    expect(chamadasA(rede, 'alunos')).toHaveLength(2)
    for (const guardado of [window.localStorage, window.sessionStorage]) expect(JSON.stringify(Object.entries(guardado))).not.toMatch(/Sintético|Ana|Bruno|Caio/)
    expect(`${window.location.href}${window.location.search}${window.location.hash}`).not.toMatch(/Sintético|Ana|Bruno|Caio|%C3%A9/)
  })

  it('a turma que a API deixou de achar tira a página: a lista que responde `NAO_ENCONTRADO` avisa quem desenha a turma, uma vez', async () => {
    const rede = fakeNetwork()
    instalar(rede, { alunos: erro(404, 'NAO_ENCONTRADO') })
    const aoPerder = vi.fn()
    montar(aoPerder)

    await waitFor(() => expect(aoPerder).toHaveBeenCalledTimes(1))
    // O 404 da turma não se repete sozinho (não vale a pena tentar de novo), e a tela não mostra a tabela nem o vazio.
    expect(screen.queryByRole('region', { name: 'Por aluno' })).toBeNull()
    expect(screen.queryByText('A lista ainda não chegou')).toBeNull()
  })

  it('outro erro da lista não tira a turma da página', async () => {
    const rede = fakeNetwork()
    instalar(rede, { alunos: erro(400, 'ENTRADA_INVALIDA') })
    const aoPerder = vi.fn()
    montar(aoPerder)

    await screen.findByRole('button', { name: 'Tentar de novo' })
    expect(aoPerder).not.toHaveBeenCalled()
  })

  it('os pedidos de nome ficam no alto da aba, antes dos alunos, com as regras de hoje: a seção e o vazio, sem ação', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await screen.findByRole('region', { name: 'Por aluno' })

    const pedidos = await screen.findByRole('region', { name: 'Pedidos de nome' })
    const porAluno = screen.getByRole('region', { name: 'Por aluno' })
    // Ordem no documento: o acesso, os pedidos, os alunos.
    expect(pedidos.compareDocumentPosition(porAluno) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(pedidos).getByText('Nenhum pedido esperando')).toBeTruthy()
    // O acesso dos alunos já está à vista logo acima, e a ação do vazio não repete o caminho até ele.
    expect(within(pedidos).queryByRole('button')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Acesso dos alunos' })).toBeTruthy()
  })

  it('a aba tem um só botão cheio, o "Convidar alunos" (docs/interface.md, R4): o vazio dos pedidos não leva outro', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await screen.findByRole('region', { name: 'Por aluno' })
    await screen.findByRole('button', { name: 'Convidar alunos' })
    await within(screen.getByRole('region', { name: 'Pedidos de nome' })).findByText('Nenhum pedido esperando')

    // O cheio é o botão de face laranja (R4), de qualquer tamanho (`principal`, `compacto` ou `icone`): a classe da face, e não a combinação inteira.
    expect(buttonVariants().split(' ')).toContain('bg-laranja')
    const cheios = screen.getAllByRole('button').filter((botao) => botao.classList.contains('bg-laranja'))
    expect(cheios.map((botao) => botao.textContent)).toEqual(['Convidar alunos'])
  })
})

describe('AlunosDaTurma: o acesso é um resumo, e "Convidar alunos" abre o diálogo', () => {
  const secao = () => screen.getByRole('region', { name: 'Acesso dos alunos' })
  const botoesDaSecao = () => within(secao()).queryAllByRole('button').map((botao) => botao.textContent)
  const dialogo = () => screen.getByRole('dialog')
  const VIGENTE = { expiraEm: '2026-10-20T15:30:00.000Z' }
  const GERADO = { token: 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde', codigo: 'ABCD2345', expiraEm: '2026-10-09T12:00:00.000Z' }

  afterEach(() => window.history.replaceState(null, '', '/'))

  it('sem acesso: "Sem acesso ativo" e um botão só, "Convidar alunos"; o gerar não está mais na seção', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()

    await within(await screen.findByRole('region', { name: 'Acesso dos alunos' })).findByText('Sem acesso ativo')
    expect(botoesDaSecao()).toEqual(['Convidar alunos'])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('com acesso: "Acesso ativo", até quando vale e o mesmo botão; "Gerar novo" e "Revogar" moram no diálogo, e o link e o código não voltam', async () => {
    const rede = fakeNetwork()
    instalar(rede, { acesso: ok(VIGENTE) })
    montar()

    await within(await screen.findByRole('region', { name: 'Acesso dos alunos' })).findByText('Acesso ativo')
    expect(secao().textContent).toContain('Vale até')
    expect(botoesDaSecao()).toEqual(['Convidar alunos'])
    expect(within(secao()).queryByRole('textbox')).toBeNull()
  })

  it('a leitura do acesso em erro tira o botão e deixa "Tentar de novo"; relida, o botão volta', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falha = true
    instalar(rede, { acesso: () => (falha ? erro(503, 'INDISPONIVEL_TENTE_DE_NOVO') : ok(VIGENTE)) })
    montar()

    await within(await screen.findByRole('region', { name: 'Acesso dos alunos' })).findByRole('alert', {}, { timeout: 5_000 })
    expect(botoesDaSecao()).toEqual(['Tentar de novo'])
    falha = false
    await usuario.click(within(secao()).getByRole('button', { name: 'Tentar de novo' }))
    await within(secao()).findByText('Acesso ativo')
    expect(botoesDaSecao()).toEqual(['Convidar alunos'])
  })

  it('o botão abre o diálogo sem mexer no endereço; "Cancelar" o fecha, e o foco volta para o botão que o abriu', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    window.history.replaceState(null, '', '/professor/turmas/x?aba=alunos')
    // Nem uma troca de endereço: fechar o diálogo que o botão abriu não tem pedido para tirar dele.
    const trocas = vi.spyOn(window.history, 'replaceState')

    const botao = await within(await screen.findByRole('region', { name: 'Acesso dos alunos' })).findByRole('button', { name: 'Convidar alunos' })
    await usuario.click(botao)
    expect(await screen.findByRole('heading', { name: 'Gerar acesso' })).toBeTruthy()
    expect(window.location.search).toBe('?aba=alunos')
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(window.location.search).toBe('?aba=alunos')
    expect(trocas).not.toHaveBeenCalled()
    trocas.mockRestore()
    expect(document.activeElement).toBe(botao)
  })

  it('`?convidar=1` abre o diálogo sozinho; fechar tira só o pedido do endereço (`replace`: nenhum passo no histórico) e a aba fica; o diálogo não volta', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    window.history.replaceState(null, '', '/professor/turmas/x?aba=alunos&convidar=1')
    const passos = window.history.length
    montar()

    expect(await screen.findByRole('heading', { name: 'Gerar acesso' })).toBeTruthy()
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(window.location.search).toBe('?aba=alunos'))
    expect(window.history.length).toBe(passos)
    expect(screen.queryByRole('dialog')).toBeNull()
    // Sem o pedido no endereço, o botão abre de novo e fechar não mexe mais no endereço.
    await usuario.click(within(secao()).getByRole('button', { name: 'Convidar alunos' }))
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    expect(window.location.search).toBe('?aba=alunos')
  })

  it('só `convidar=1` abre: outro valor no endereço deixa a aba como está, sem diálogo', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    window.history.replaceState(null, '', '/professor/turmas/x?aba=alunos&convidar=0')
    montar()

    await within(await screen.findByRole('region', { name: 'Acesso dos alunos' })).findByText('Sem acesso ativo')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(window.location.search).toBe('?aba=alunos&convidar=0')
  })

  it('gerar pelo endereço pedido: o endereço nunca ganha token, link nem código, e o diálogo fechado o deixa só com a aba', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { acesso: 'na-fila' })
    rede.responder(ok({ expiraEm: null }))
    rede.responder(ok(GERADO))
    rede.responder(ok(VIGENTE))
    window.history.replaceState(null, '', '/professor/turmas/x?aba=alunos&convidar=1')
    montar()

    await usuario.click(await screen.findByRole('button', { name: 'Gerar acesso' }))
    await screen.findByRole('heading', { name: 'Acesso gerado' })
    for (const segredo of [GERADO.token, GERADO.codigo, 'ABCD 2345']) expect(window.location.href).not.toContain(segredo)
    expect(window.location.search).toBe('?aba=alunos&convidar=1')
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Fechar' }))
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Fechar sem copiar' }))
    await waitFor(() => expect(window.location.search).toBe('?aba=alunos'))
    for (const segredo of [GERADO.token, GERADO.codigo, 'ABCD 2345']) expect(document.body.innerHTML).not.toContain(segredo)
    // A seção lê o acesso novo: só até quando vale.
    await within(secao()).findByText('Acesso ativo')
  })

  it('revogar pelo diálogo pedido pelo endereço: a seção anuncia, o diálogo fecha, o pedido sai do endereço, e abrir outro diálogo apaga o anúncio', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { acesso: 'na-fila' })
    rede.responder(ok(VIGENTE))
    window.history.replaceState(null, '', '/professor/turmas/x?aba=alunos&convidar=1')
    montar()

    await usuario.click(await screen.findByRole('button', { name: 'Revogar o acesso' }))
    rede.responder({ status: 204 })
    rede.responder(ok({ expiraEm: null }))
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Revogar acesso' }))

    expect(await within(secao()).findByText('Acesso revogado. O link e o código não valem mais.')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(window.location.search).toBe('?aba=alunos'))
    await within(secao()).findByText('Sem acesso ativo')

    rede.responder(ok({ expiraEm: null }))
    await usuario.click(within(secao()).getByRole('button', { name: 'Convidar alunos' }))
    expect(within(secao()).queryByText('Acesso revogado. O link e o código não valem mais.')).toBeNull()
  })
})
