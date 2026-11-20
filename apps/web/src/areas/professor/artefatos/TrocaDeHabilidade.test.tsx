// @vitest-environment jsdom
import { MENSAGENS_DE_ERRO } from '@educa/shared'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { describe, expect, it, type Mock } from 'vitest'
import { createQueryClient } from '../../../api/query-client'
import { setupScreen, fakeNetwork, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import { TEXTO_CARREGANDO_DO_SELETOR, TEXTO_SEM_COMPONENTE_DO_SELETOR } from '../../../components/habilidades/SeletorDeHabilidades'
import Artefato from './Artefato'
import { candidatasEmOrdem, motivoDaTrocaFechada, TEXTO_DA_FALHA_DA_TROCA, TEXTO_DA_TROCA_DA_VERSAO_ADAPTADA, TEXTO_DA_TROCA_FECHADA } from './troca-de-habilidade'

/**
 * A troca da habilidade da questão no artefato aberto (classificacao-bncc, 11.0; RF9; `cenarios.md`, "Telas", artefato). A rede é falsa e responde **por caminho**; a tela, o seletor da 8.0, o cliente de consultas e o endereço
 * são os de verdade. O que só o navegador mostra (a largura, o teclado de ponta a ponta, o `PATCH` segurado) é do e2e.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const ARTEFATO = id(1)
const TURMA = id(100)
const DISCIPLINA = id(200)
const MATERIAL = id(300)
const HABILIDADE_ATUAL = { codigo: 'EM13CNT101', descricao: 'Usar a proporção da equação balanceada para calcular massa, volume ou quantidade de matéria.' }
const CANDIDATAS = [
  { codigo: 'EM13CNT101', descricao: 'Analisar e representar as transformações e conservações em sistemas.' },
  { codigo: 'EM13CNT102', descricao: 'Realizar previsões em situações cotidianas que envolvam transformações.' },
  { codigo: 'EM13CNT103', descricao: 'Utilizar o conhecimento sobre as radiações e suas origens.' },
  { codigo: 'EM13CNT104', descricao: 'Avaliar potenciais prejuízos de substâncias e radiações.' },
]
const CAPITULO = { capitulo: { numero: 3, titulo: 'Reações químicas' }, paginaInicial: 1, paginaFinal: 3, habilidades: [{ codigo: 'EM13CNT103', origem: 'ia' }, { codigo: 'EM13CNT104', origem: 'coordenacao' }] }
const BLOCO = { capitulo: null, paginaInicial: 4, paginaFinal: 6, habilidades: [] }

const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const erro = (status: number, codigo: string, cabecalhos?: Record<string, string>): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }, ...(cabecalhos === undefined ? {} : { cabecalhos }) })

function artefato(campos: Record<string, unknown> = {}, habilidade: { codigo: string; descricao: string } | null = HABILIDADE_ATUAL) {
  return {
    id: ARTEFATO,
    tipo: 'atividade_objetiva',
    titulo: 'Atividade 1',
    turmaId: TURMA,
    disciplinaId: DISCIPLINA,
    origemId: null,
    adaptacao: null,
    entrega: null,
    criadoEm: '2026-10-05T13:00:00.000Z',
    conteudo: {
      tipo: 'atividade_objetiva',
      titulo: 'Atividade 1',
      questoes: [
        { enunciado: 'Qual a massa de CO₂?', alternativas: ['44 g', '88 g', '24 g', '12 g'], gabarito: 1, habilidade, citacao: { materialId: MATERIAL, pagina: 2, trecho: 'Na combustão completa.' }, explicacao: 'Porque sim.' },
        { enunciado: 'Qual o reagente limitante?', alternativas: ['O2', 'H2O', 'H2', 'Nenhum'], gabarito: 2, habilidade: null, citacao: { materialId: MATERIAL, pagina: 5, trecho: 'O limitante acaba primeiro.' }, explicacao: 'Porque sim.' },
      ],
    },
    versoesAdaptadas: [],
    aplicacoes: [],
    fontes: [{ materialId: MATERIAL, titulo: 'Química 2', edicao: null, substituido: false }],
    secoesDasQuestoes: [CAPITULO, BLOCO],
    classificacaoSuspensa: false,
    ...campos,
  }
}

interface Mundo {
  /** O que `GET /v1/artefatos/:id` devolve, e muda quando a troca grava. */
  artefato: ReturnType<typeof artefato>
  /** Com ela, a leitura do artefato responde por ela, em vez de por `artefato`: o teste a segura para ver o que a tela mostra antes da releitura. */
  leitura?: () => FakeResponse | Promise<FakeResponse>
  candidatas?: () => FakeResponse | Promise<FakeResponse>
  troca?: (caminho: string) => FakeResponse | Promise<FakeResponse>
}

/** Os caminhos de cada `PATCH`, na ordem em que chegaram. */
function instalar(rede: FakeNetwork, mundo: Mundo): { trocas: string[] } {
  const trocas: string[] = []
  rede.responderPor(`/v1/artefatos/${ARTEFATO}/questoes/0/habilidade`, (caminho) => {
    trocas.push(caminho)
    return mundo.troca === undefined ? erro(500, 'ERRO_INTERNO') : mundo.troca(caminho)
  })
  rede.responderPor(`/v1/artefatos/${ARTEFATO}/questoes/1/habilidade`, (caminho) => {
    trocas.push(caminho)
    return mundo.troca === undefined ? erro(500, 'ERRO_INTERNO') : mundo.troca(caminho)
  })
  rede.responderPor(`/v1/habilidades-bncc?artefatoId=${ARTEFATO}`, () => (mundo.candidatas === undefined ? ok({ itens: CANDIDATAS, semComponente: false }) : mundo.candidatas()))
  rede.responderPor(`/v1/artefatos/${ARTEFATO}`, () => (mundo.leitura === undefined ? ok(mundo.artefato) : mundo.leitura()))
  rede.responderPor('/v1/meus-vinculos', ok({ itens: [{ id: id(450), turma: { id: TURMA, nome: '7ºA' }, disciplina: { id: DISCIPLINA, nome: 'Química' }, estado: 'confirmado' }] }))
  rede.responderPor('/v1/entregas', ok({ itens: [] }))
  rede.responderPor('/v1/atividades-aplicadas', ok({ itens: [] }))
  return { trocas }
}

function montar() {
  const localizacao = memoryLocation({ path: `/artefatos/${ARTEFATO}`, record: true })
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
        <Artefato artefatoId={ARTEFATO} />
      </Router>
    </QueryClientProvider>,
  )
}

const botaoDeTrocar = (questao: number) => screen.getByRole('button', { name: new RegExp(`^Trocar a habilidade da questão ${String(questao)}$`) })
const abrir = async (usuario: ReturnType<typeof userEvent.setup>, questao: number) => {
  await usuario.click(botaoDeTrocar(questao))
  return screen.findByRole('group', { name: `Habilidades para a questão ${String(questao)}` })
}
/** O corpo de cada `PATCH` que a tela mandou, na ordem: o `fetch` falso guarda o que recebeu. */
const corposEnviados = (): unknown[] =>
  (fetch as unknown as Mock).mock.calls
    .filter(([, opcoes]) => (opcoes as RequestInit | undefined)?.method === 'PATCH')
    .map(([, opcoes]) => JSON.parse(String((opcoes as RequestInit).body)) as unknown)
const codigosDaLista = (lista: HTMLElement) => within(lista).getAllByRole('checkbox').map((caixa) => caixa.closest('label')?.textContent?.split(' ')[0])

describe('a habilidade da questão com o capítulo', () => {
  it('diz o código, o texto e o capítulo da página que a questão cita, e o bloco de páginas pelas páginas', async () => {
    const rede = fakeNetwork()
    instalar(rede, { artefato: artefato() })
    montar()
    expect(await screen.findByText(/Habilidade EM13CNT101:/)).toBeTruthy()
    expect(screen.getByText(HABILIDADE_ATUAL.descricao, { exact: false })).toBeTruthy()
    expect(screen.getByText('Capítulo 3 · Reações químicas (Páginas 1 a 3)')).toBeTruthy()
    // Na tela é "capítulo" ou "páginas", nunca "seção" nem "trecho".
    expect(screen.getByText('Páginas 4 a 6')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/seção|trecho da/i)
    // Sem motivo (a troca está aberta), a linha não leva o parágrafo do motivo, nem vazio.
    expect(document.querySelector('p:empty')).toBeNull()
  })

  it('a questão sem habilidade diz "Sem habilidade", e sem seção não diz capítulo nenhum', async () => {
    const rede = fakeNetwork()
    instalar(rede, { artefato: artefato({ secoesDasQuestoes: [null, null] }, null) })
    montar()
    await screen.findByText('Qual a massa de CO₂?', { exact: false })
    expect(screen.getAllByText('Sem habilidade')).toHaveLength(2)
    expect(screen.queryByText(/Capítulo 3|Páginas 4 a 6/)).toBeNull()
  })

  it('o artefato aplicado (ou com versão adaptada) desliga o "Trocar" e diz por quê; a versão adaptada diz que repete a da origem', async () => {
    for (const [campos, texto] of [
      [{ aplicacoes: [{ id: id(500), turmaId: TURMA, estado: 'encerrada', aplicadaEm: '2026-10-06T10:00:00.000Z' }] }, TEXTO_DA_TROCA_FECHADA],
      [{ versoesAdaptadas: [{ id: id(2), tipo: 'atividade_objetiva', titulo: 'V', turmaId: TURMA, disciplinaId: DISCIPLINA, origemId: ARTEFATO, adaptacao: { tipos: ['fonte_ampliada'] }, entrega: null, criadoEm: '2026-10-05T13:00:00.000Z' }] }, TEXTO_DA_TROCA_FECHADA],
      [{ origemId: id(3), adaptacao: { tipos: ['fonte_ampliada'] } }, TEXTO_DA_TROCA_DA_VERSAO_ADAPTADA],
    ] as const) {
      const rede = fakeNetwork()
      instalar(rede, { artefato: artefato(campos) })
      const { unmount } = montar()
      await screen.findByText(/Habilidade EM13CNT101:/)
      const botao = botaoDeTrocar(1) as HTMLButtonElement
      expect(botao.disabled).toBe(true)
      expect(screen.getAllByText(texto).length).toBeGreaterThan(0)
      expect(botao.getAttribute('aria-describedby')).not.toBeNull()
      unmount()
    }
  })
})

describe('o seletor da troca', () => {
  it('carregando: o texto de espera enquanto as candidatas não chegam', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { artefato: artefato(), candidatas: () => new Promise<FakeResponse>(() => undefined) })
    montar()
    await screen.findByText(/Habilidade EM13CNT101:/)
    await abrir(usuario, 1)
    expect(screen.getByText(TEXTO_CARREGANDO_DO_SELETOR)).toBeTruthy()
  })

  it('sem componente na disciplina: o seletor diz que a questão fica sem habilidade, e "Deixar sem habilidade" segue possível', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const { trocas } = instalar(rede, { artefato: artefato(), candidatas: () => ok({ itens: [], semComponente: true }), troca: () => ok(artefato({}, null)) })
    montar()
    await screen.findByText(/Habilidade EM13CNT101:/)
    await abrir(usuario, 1)
    expect(await screen.findByText(TEXTO_SEM_COMPONENTE_DO_SELETOR)).toBeTruthy()
    expect(screen.queryByRole('checkbox')).toBeNull()
    await usuario.click(screen.getByRole('button', { name: 'Deixar sem habilidade' }))
    await waitFor(() => expect(trocas).toEqual([`/v1/artefatos/${ARTEFATO}/questoes/0/habilidade`]))
    // `null` é "nenhuma": o corpo é só o código, e o texto da habilidade nunca vai.
    expect(corposEnviados()).toEqual([{ codigo: null }])
  })

  it('a lista põe as habilidades do capítulo da questão primeiro, na ordem da API, e as outras depois', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { artefato: artefato() })
    montar()
    await screen.findByText(/Habilidade EM13CNT101:/)
    expect(codigosDaLista(await abrir(usuario, 1))).toEqual(['EM13CNT103', 'EM13CNT104', 'EM13CNT101', 'EM13CNT102'])
    // Aberto sem falha nenhuma, o seletor não traz o aviso de falha (a frase da falha qualquer não é o texto de repouso).
    expect(screen.queryByText(TEXTO_DA_FALHA_DA_TROCA)).toBeNull()
  })

  it('com a função suspensa, a sugestão da IA não tem prioridade: só a corrigida pela coordenação sobe', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { artefato: artefato({ classificacaoSuspensa: true }) })
    montar()
    await screen.findByText(/Habilidade EM13CNT101:/)
    expect(codigosDaLista(await abrir(usuario, 1))).toEqual(['EM13CNT104', 'EM13CNT101', 'EM13CNT102', 'EM13CNT103'])
  })

  it('escolher a habilidade troca na hora: o `PATCH` da questão certa, o texto novo na folha, o painel fechado e o foco de volta ao "Trocar"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const trocado = artefato({}, { codigo: 'EM13CNT104', descricao: 'Avaliar potenciais prejuízos de substâncias e radiações.' })
    // A releitura que a troca pede fica segurada até o fim do caso: o que a tela mostra enquanto isso é a resposta do `PATCH`, que já traz o artefato inteiro, e não um buraco até a leitura chegar.
    let soltarALeitura: () => void = () => undefined
    const mundo: Mundo = {
      artefato: artefato(),
      troca: () => {
        mundo.leitura = () => new Promise<FakeResponse>((resolver) => (soltarALeitura = () => resolver(ok(trocado))))
        return ok(trocado)
      },
    }
    const { trocas } = instalar(rede, mundo)
    montar()
    await screen.findByText(/Habilidade EM13CNT101:/)
    const lista = await abrir(usuario, 1)
    await usuario.click(within(lista).getByRole('checkbox', { name: /EM13CNT104/ }))
    expect(await screen.findByText(/Habilidade EM13CNT104:/)).toBeTruthy()
    expect(trocas).toEqual([`/v1/artefatos/${ARTEFATO}/questoes/0/habilidade`])
    expect(corposEnviados()).toEqual([{ codigo: 'EM13CNT104' }])
    expect(screen.queryByRole('group', { name: 'Habilidades para a questão 1' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(botaoDeTrocar(1)))
    soltarALeitura()
  })

  it('com o PATCH no ar, outra escolha no mesmo seletor e o "Deixar sem habilidade" não mandam um segundo pedido', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const trocado = artefato({}, { codigo: 'EM13CNT102', descricao: 'Realizar previsões em situações cotidianas que envolvam transformações.' })
    let soltar: () => void = () => undefined
    const mundo: Mundo = {
      artefato: artefato(),
      troca: () =>
        new Promise<FakeResponse>((resolver) => {
          soltar = () => {
            mundo.artefato = trocado
            resolver(ok(trocado))
          }
        }),
    }
    const { trocas } = instalar(rede, mundo)
    montar()
    await screen.findByText(/Habilidade EM13CNT101:/)
    const lista = await abrir(usuario, 1)
    await usuario.click(within(lista).getByRole('checkbox', { name: /EM13CNT102/ }))
    await waitFor(() => expect(trocas).toHaveLength(1))
    await usuario.click(within(lista).getByRole('checkbox', { name: /EM13CNT103/ }))
    // O "nenhuma" também espera: o clique duplo do lado do "Deixar sem habilidade" não manda outro pedido.
    const semHabilidade = screen.getByRole('button', { name: 'Deixar sem habilidade' }) as HTMLButtonElement
    expect(semHabilidade.disabled).toBe(true)
    await usuario.click(semHabilidade)
    // O pedido segue no ar; só a resposta o encerra. Depois dela, um pedido só foi mandado.
    soltar()
    expect(await screen.findByText(/Habilidade EM13CNT102:/)).toBeTruthy()
    expect(trocas).toHaveLength(1)
    expect(corposEnviados()).toEqual([{ codigo: 'EM13CNT102' }])
  })

  it('as candidatas são de cada artefato: com o mesmo cliente de consultas, o seletor de outro artefato espera a lista dele e não reaproveita a do primeiro', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const OUTRO = id(2)
    instalar(rede, { artefato: artefato() })
    rede.responderPor(`/v1/habilidades-bncc?artefatoId=${OUTRO}`, () => new Promise<FakeResponse>(() => undefined))
    rede.responderPor(`/v1/artefatos/${OUTRO}`, ok({ ...artefato(), id: OUTRO }))
    const cliente = createQueryClient()
    const arvore = (artefatoId: string) => {
      const localizacao = memoryLocation({ path: `/artefatos/${artefatoId}`, record: true })
      return (
        <QueryClientProvider client={cliente}>
          <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
            <Artefato artefatoId={artefatoId} />
          </Router>
        </QueryClientProvider>
      )
    }
    const primeiro = render(arvore(ARTEFATO))
    await screen.findByText(/Habilidade EM13CNT101:/)
    expect(codigosDaLista(await abrir(usuario, 1))).toHaveLength(4)
    primeiro.unmount()
    render(arvore(OUTRO))
    await screen.findByText(/Habilidade EM13CNT101:/)
    await abrir(usuario, 1)
    // A lista do outro artefato ainda não chegou: o seletor espera, e não mostra a do primeiro.
    expect(screen.getByText(TEXTO_CARREGANDO_DO_SELETOR)).toBeTruthy()
    expect(screen.queryAllByRole('checkbox')).toEqual([])
  })

  it('o Esc fecha o seletor sem trocar nada e devolve o foco ao "Trocar"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const { trocas } = instalar(rede, { artefato: artefato() })
    montar()
    await screen.findByText(/Habilidade EM13CNT101:/)
    await abrir(usuario, 2)
    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: 'Habilidades para a questão 2' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(botaoDeTrocar(2)))
    expect(trocas).toEqual([])
  })
})

describe('a troca que falha', () => {
  async function tentar(resposta: FakeResponse, depois?: (mundo: Mundo) => void) {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const mundo: Mundo = { artefato: artefato(), troca: () => resposta }
    depois?.(mundo)
    instalar(rede, mundo)
    montar()
    await screen.findByText(/Habilidade EM13CNT101:/)
    const lista = await abrir(usuario, 1)
    // O seletor abre sem o aviso de falha: a frase só aparece depois do clique que falha.
    expect(screen.queryByText(TEXTO_DA_FALHA_DA_TROCA)).toBeNull()
    await usuario.click(within(lista).getByRole('checkbox', { name: /EM13CNT102/ }))
    return { usuario }
  }

  it('erro da troca: a frase curta, o seletor continua aberto e a habilidade não mudou, e a leitura do artefato não é refeita', async () => {
    await tentar(erro(500, 'ERRO_INTERNO'))
    expect(await screen.findByText(TEXTO_DA_FALHA_DA_TROCA)).toBeTruthy()
    // Só o `CONFLITO` diz que a leitura que a tela tem está velha: a falha qualquer deixa o que já está na tela (a leitura da abertura é a única).
    const leituras = (fetch as unknown as Mock).mock.calls.filter(([url, opcoes]) => String(url).endsWith(`/v1/artefatos/${ARTEFATO}`) && ((opcoes as RequestInit | undefined)?.method ?? 'GET') === 'GET')
    expect(leituras).toHaveLength(1)
    expect(screen.getByRole('group', { name: 'Habilidades para a questão 1' })).toBeTruthy()
    expect(screen.getByText(/Habilidade EM13CNT101:/)).toBeTruthy()
  })

  it('cancelar depois de uma falha e abrir de novo: o seletor volta sem o aviso velho', async () => {
    const { usuario } = await tentar(erro(500, 'ERRO_INTERNO'))
    expect(await screen.findByText(TEXTO_DA_FALHA_DA_TROCA)).toBeTruthy()
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('group', { name: 'Habilidades para a questão 1' })).toBeNull()
    await abrir(usuario, 1)
    expect(screen.queryByText(TEXTO_DA_FALHA_DA_TROCA)).toBeNull()
  })

  it('`CONFLITO`: diz que a atividade já foi aplicada, e a leitura refeita desliga o "Trocar" com o motivo', async () => {
    const aplicacao = { id: id(500), turmaId: TURMA, estado: 'aberta', aplicadaEm: '2026-10-06T10:00:00.000Z' }
    await tentar(erro(409, 'CONFLITO'), (mundo) => {
      // Depois do `CONFLITO`, o artefato lido de novo já traz a aplicação.
      const original = mundo.troca
      mundo.troca = (caminho) => {
        mundo.artefato = artefato({ aplicacoes: [aplicacao] })
        return original?.(caminho) ?? erro(409, 'CONFLITO')
      }
    })
    await waitFor(() => expect((botaoDeTrocar(1) as HTMLButtonElement).disabled).toBe(true))
    expect(screen.getAllByText(TEXTO_DA_TROCA_FECHADA).length).toBeGreaterThan(0)
    // O painel fecha com a troca fechada: não há mais o que escolher.
    expect(screen.queryByRole('group', { name: 'Habilidades para a questão 1' })).toBeNull()
  })

  it('`CONFLITO` com a releitura ainda a caminho: o seletor aberto já diz que a atividade foi aplicada, com o texto da aplicação e não o da falha qualquer', async () => {
    let soltarALeitura: () => void = () => undefined
    await tentar(erro(409, 'CONFLITO'), (mundo) => {
      const resposta = erro(409, 'CONFLITO')
      mundo.troca = () => {
        mundo.leitura = () => new Promise<FakeResponse>((resolver) => (soltarALeitura = () => resolver(ok(artefato({ aplicacoes: [{ id: id(500), turmaId: TURMA, estado: 'aberta', aplicadaEm: '2026-10-06T10:00:00.000Z' }] })))))
        return resposta
      }
    })
    expect(await screen.findByText(TEXTO_DA_TROCA_FECHADA)).toBeTruthy()
    expect(screen.queryByText(TEXTO_DA_FALHA_DA_TROCA)).toBeNull()
    expect(screen.getByRole('group', { name: 'Habilidades para a questão 1' })).toBeTruthy()
    soltarALeitura()
    await waitFor(() => expect((botaoDeTrocar(1) as HTMLButtonElement).disabled).toBe(true))
  })

  it('`NAO_ENCONTRADO`: diz a frase do código, e não a da falha qualquer', async () => {
    await tentar(erro(404, 'NAO_ENCONTRADO'))
    expect(await screen.findByText(MENSAGENS_DE_ERRO.NAO_ENCONTRADO)).toBeTruthy()
    expect(screen.queryByText(TEXTO_DA_FALHA_DA_TROCA)).toBeNull()
  })

  it('429: diz em quantos minutos tentar de novo, pelo `Retry-After`', async () => {
    await tentar(erro(429, 'LIMITE_EXCEDIDO', { 'Retry-After': '600' }))
    expect(await screen.findByText('Muitas alterações seguidas. Tente de novo em 10 minutos.')).toBeTruthy()
  })
})

describe('as regras da troca, sem a tela', () => {
  const doCapitulo = { ...CAPITULO, habilidades: [{ codigo: 'EM13CNT103', origem: 'ia' as const }, { codigo: 'EM13CNT104', origem: 'coordenacao' as const }] }

  it('as do capítulo vão primeiro; sem seção, a ordem é a da API; suspensa, a da IA não sobe', () => {
    const codigos = (itens: ReturnType<typeof candidatasEmOrdem>) => itens.map((item) => item.codigo)
    expect(codigos(candidatasEmOrdem(CANDIDATAS, doCapitulo, false))).toEqual(['EM13CNT103', 'EM13CNT104', 'EM13CNT101', 'EM13CNT102'])
    expect(codigos(candidatasEmOrdem(CANDIDATAS, null, false))).toEqual(['EM13CNT101', 'EM13CNT102', 'EM13CNT103', 'EM13CNT104'])
    expect(codigos(candidatasEmOrdem(CANDIDATAS, doCapitulo, true))).toEqual(['EM13CNT104', 'EM13CNT101', 'EM13CNT102', 'EM13CNT103'])
    // O que o capítulo tem e o recorte não tem não entra: a lista é a das candidatas.
    expect(codigos(candidatasEmOrdem(CANDIDATAS.slice(0, 1), { ...doCapitulo, habilidades: [{ codigo: 'EM13CNT999', origem: 'coordenacao' }] }, false))).toEqual(['EM13CNT101'])
  })

  it('a troca fecha com a versão adaptada, com aplicação e com versão; o artefato solto fica aberto', () => {
    expect(motivoDaTrocaFechada({ origemId: id(3), aplicacoes: [], versoesAdaptadas: [] })).toBe(TEXTO_DA_TROCA_DA_VERSAO_ADAPTADA)
    expect(motivoDaTrocaFechada({ origemId: null, aplicacoes: [{ id: id(1), turmaId: TURMA, estado: 'aberta', aplicadaEm: '2026-10-06T10:00:00.000Z' }], versoesAdaptadas: [] })).toBe(TEXTO_DA_TROCA_FECHADA)
    expect(motivoDaTrocaFechada({ origemId: null, aplicacoes: [], versoesAdaptadas: [] })).toBeUndefined()
  })
})
