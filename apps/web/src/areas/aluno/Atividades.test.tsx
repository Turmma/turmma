// @vitest-environment jsdom
import { minhaAtividadeSchema } from '@educa/shared'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { setupScreen, fakeNetwork, renderScreen } from '../../__fixtures__/render-screen'
import Atividades from './Atividades'
import { AVISO_DA_AVALIACAO, TEXTO_DA_ESPERA_PELA_CORRECAO, VAZIO_DE_CADA_GRUPO } from './atividades'

/**
 * "Tarefas" do aluno nos quatro estados e nos três grupos (telas do aluno e primeiro acesso, 4.0; RF6, RF10, RF20):
 * carregando, erro, vazio total e com dado, com o vazio de cada grupo sozinho. A rede é falsa; a tela, o cliente de
 * consultas e a sessão são os da aba.
 */
setupScreen()

const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const PAGINA_SEGUINTE = '0192a4c0-5b1e-7c3d-8e4f-0000000000aa'
const FALHA = { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: REQUISICAO } } } as const
const MATEMATICA = { id: '0192a4c0-5b1e-7c3d-8e4f-0000000000fe', nome: 'Matemática' }
const atividade = (final: string, campos: Record<string, unknown> = {}) => ({
  id: `0192a4c0-5b1e-7c3d-8e4f-0000000000${final}`,
  titulo: `Lista sintética ${final}`,
  disciplina: { id: '0192a4c0-5b1e-7c3d-8e4f-0000000000ff', nome: 'Química' },
  avaliativa: false,
  situacao: 'para_fazer',
  questoes: 3,
  respondidas: 0,
  aplicadaEm: '2026-10-05T13:00:00.000Z',
  enviadaEm: null,
  ...campos,
})

function montar() {
  return renderScreen(
    <Router base="/aluno">
      <Atividades />
    </Router>,
  )
}

/** A região de um grupo, pelo nome do título dele. */
const grupo = (nome: string) => screen.getByRole('region', { name: nome })

describe('Tarefas do aluno', () => {
  it('carregando: o rótulo na tela e nenhum grupo, nenhum vazio', async () => {
    const rede = fakeNetwork()
    rede.segurar()
    montar()

    expect(await screen.findByText('Carregando as suas atividades…')).toBeTruthy()
    expect(screen.queryAllByRole('region')).toHaveLength(0)
    expect(screen.queryByText('Nada para fazer agora')).toBeNull()
    for (const texto of Object.values(VAZIO_DE_CADA_GRUPO)) expect(screen.queryByText(texto), texto).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tarefas')
  })

  it('com erro: o alerta com "Tentar de novo", e nem grupo nem vazio', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minhas-atividades', FALHA)
    montar()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(screen.queryAllByRole('region')).toHaveLength(0)
    expect(screen.queryByText('Nada para fazer agora')).toBeNull()
    for (const texto of Object.values(VAZIO_DE_CADA_GRUPO)) expect(screen.queryByText(texto), texto).toBeNull()
  })

  it('vazio total, com a leitura terminada: diz que não há tarefa e não desenha grupo', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minhas-atividades', { status: 200, corpo: { itens: [] } })
    montar()

    expect(await screen.findByText('Nada para fazer agora')).toBeTruthy()
    expect(screen.queryByText('Carregando as suas atividades…')).toBeNull()
    expect(screen.queryAllByRole('region')).toHaveLength(0)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('com dado: três grupos, cada tarefa no seu, na ordem da API, com o estado em texto e a linha inteira como link', async () => {
    const rede = fakeNetwork()
    const itens = [
      atividade('01', { situacao: 'com_diagnostico', respondidas: 3 }),
      atividade('02', { disciplina: MATEMATICA }),
      atividade('03', { situacao: 'enviada', respondidas: 3, avaliativa: true }),
      atividade('04', { situacao: 'em_andamento', respondidas: 1, avaliativa: true }),
      atividade('05', { situacao: 'encerrada', respondidas: 1 }),
    ]
    rede.responderPor('/v1/minhas-atividades', { status: 200, corpo: { itens } })
    montar()

    await screen.findByRole('region', { name: 'Para fazer' })
    const titulos = (nome: string) => within(grupo(nome)).getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(titulos('Para fazer')).toEqual([`/aluno/atividades/${itens[1]?.id}`, `/aluno/atividades/${itens[3]?.id}`])
    expect(titulos('Entregues')).toEqual([`/aluno/atividades/${itens[2]?.id}`, `/aluno/atividades/${itens[4]?.id}`])
    expect(titulos('Corrigidas')).toEqual([`/aluno/atividades/${itens[0]?.id}`])

    const linha = (nome: string, final: string) => within(grupo(nome)).getByRole('link', { name: new RegExp(`Lista sintética ${final}`) })
    expect(linha('Para fazer', '02').textContent).toContain('Matemática · 3 questões')
    expect(linha('Para fazer', '02').textContent).toContain('Para fazer')
    expect(linha('Entregues', '03').textContent).toContain('Entregue')
    expect(linha('Entregues', '05').textContent).toContain('Encerrada')
    expect(linha('Corrigidas', '01').textContent).toContain('Corrigida')
    // A avaliação que ainda espera resposta leva o aviso; as outras, não.
    expect(linha('Para fazer', '04').textContent).toContain(AVISO_DA_AVALIACAO)
    expect(linha('Para fazer', '02').textContent).not.toContain(AVISO_DA_AVALIACAO)
    // A avaliação já entregue não espera mais resposta: sem aviso.
    expect(linha('Entregues', '03').textContent).not.toContain(AVISO_DA_AVALIACAO)
    // O selo é verde só na corrigida; o ladrilho leva a cor da matéria de cada uma.
    const selo = (nome: string, final: string) => linha(nome, final).querySelector('[data-estado]')?.getAttribute('data-estado')
    expect([selo('Para fazer', '02'), selo('Entregues', '03'), selo('Entregues', '05'), selo('Corrigidas', '01')]).toEqual(['info', 'info', 'info', 'ok'])
    const ladrilho = (nome: string, final: string) => linha(nome, final).querySelector('[data-ladrilho]')?.getAttribute('data-ladrilho')
    expect([ladrilho('Para fazer', '02'), ladrilho('Corrigidas', '01')]).toEqual(['azul', 'turquesa'])
    // O `data-atividade` de cada linha é a situação dela.
    expect(Array.from(document.querySelectorAll('[data-atividade]')).map((item) => item.getAttribute('data-atividade'))).toEqual(['para_fazer', 'em_andamento', 'enviada', 'encerrada', 'com_diagnostico'])
    // Há dado em todos os grupos: nenhum vazio aparece.
    for (const texto of Object.values(VAZIO_DE_CADA_GRUPO)) expect(screen.queryByText(texto)).toBeNull()
  })

  it('"Corrigida" só com a correção aprovada: enviada e encerrada ficam em "Entregues", com o texto de espera, e nunca dizem acerto', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minhas-atividades', {
      status: 200,
      corpo: { itens: [atividade('01', { situacao: 'enviada', respondidas: 3 }), atividade('02', { situacao: 'encerrada', respondidas: 1 })] },
    })
    montar()

    const entregues = await screen.findByRole('region', { name: 'Entregues' })
    expect(within(entregues).getAllByRole('link')).toHaveLength(2)
    expect(entregues.textContent).toContain(TEXTO_DA_ESPERA_PELA_CORRECAO)
    expect(entregues.textContent).not.toMatch(/corrigid|resultado|acert/i)
    // Nada corrigido: o grupo existe, vazio, e o resto da tela também não diz "Corrigida".
    expect(within(grupo('Corrigidas')).queryByRole('link')).toBeNull()
    expect(within(grupo('Corrigidas')).getByText(VAZIO_DE_CADA_GRUPO.corrigidas)).toBeTruthy()
    expect(screen.queryAllByText('Corrigida')).toHaveLength(0)
  })

  it('o vazio de cada grupo aparece sozinho, no grupo certo, e os outros grupos seguem com as suas linhas', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minhas-atividades', { status: 200, corpo: { itens: [atividade('01', { situacao: 'com_diagnostico', respondidas: 3 })] } })
    montar()

    await screen.findByRole('region', { name: 'Corrigidas' })
    expect(within(grupo('Para fazer')).getByText(VAZIO_DE_CADA_GRUPO.paraFazer)).toBeTruthy()
    expect(within(grupo('Entregues')).getByText(VAZIO_DE_CADA_GRUPO.entregues)).toBeTruthy()
    expect(within(grupo('Corrigidas')).queryByText(VAZIO_DE_CADA_GRUPO.corrigidas)).toBeNull()
    expect(within(grupo('Corrigidas')).getAllByRole('link')).toHaveLength(1)
  })

  it('nada de colega (RF10): a varredura do texto da tela não acha ranking, média, posição, pontos nem sequência', async () => {
    const rede = fakeNetwork()
    const itens = [
      atividade('01'),
      atividade('02', { situacao: 'em_andamento', respondidas: 1, avaliativa: true }),
      atividade('03', { situacao: 'enviada', respondidas: 3 }),
      atividade('04', { situacao: 'encerrada', respondidas: 1 }),
      atividade('05', { situacao: 'com_diagnostico', respondidas: 3 }),
    ]
    rede.responderPor('/v1/minhas-atividades', { status: 200, corpo: { itens } })
    montar()

    await screen.findByRole('region', { name: 'Corrigidas' })
    const texto = document.body.textContent ?? ''
    expect(texto).not.toMatch(/ranking|m[ée]dia|posi[cç][aã]o|pontos?\b|sequ[eê]ncia|colegas?\b|\bnotas?\b|conceito|atrasad|!/i)
    // Sem professor, prazo, barra de progresso, "NOVO" nem filtro por matéria: o contrato não traz (D80, item 7c).
    expect(texto).not.toMatch(/Prof\.|até (segunda|terça|quarta|quinta|sexta)|\bNOVO\b|todas as matérias/i)
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('só o que o contrato traz chega à tela: com um campo a mais (o professor) a lista não é desenhada, e o nome dele não aparece', async () => {
    const rede = fakeNetwork()
    const comProfessor = atividade('01', { nomeDoProfessor: 'Camila Souza sintética' })
    // O contrato é estrito: o campo a mais não é ignorado em silêncio, e portanto não chega a ser desenhado.
    expect(minhaAtividadeSchema.safeParse(comProfessor).success).toBe(false)
    expect(minhaAtividadeSchema.safeParse(atividade('01')).success).toBe(true)
    rede.responderPor('/v1/minhas-atividades', { status: 200, corpo: { itens: [comProfessor] } })
    montar()

    // A resposta foi lida e recusada: a consulta tenta de novo uma vez, um segundo depois, e só então a tela mostra o erro. O
    // alerta é o sinal de que a leitura terminou; antes dele, "nada de lista" seria dito ainda no carregando.
    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toBeTruthy()
    expect(rede.chamadas.filter((chamada) => chamada.caminho.startsWith('/v1/minhas-atividades')).length).toBe(2)
    expect(document.body.textContent).not.toMatch(/Camila|Souza|nomeDoProfessor/)
    expect(screen.queryAllByRole('region')).toHaveLength(0)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('"Ver mais tarefas" só aparece quando a API aponta a página seguinte, e nada rola sem o aluno pedir', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minhas-atividades', { status: 200, corpo: { itens: [atividade('01')], proxima: PAGINA_SEGUINTE } })
    montar()

    expect(await screen.findByRole('button', { name: 'Ver mais tarefas' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ver mais atividades' })).toBeNull()
    expect(rede.chamadas.filter((chamada) => chamada.caminho.startsWith('/v1/minhas-atividades'))).toHaveLength(1)
  })

  it('sem página seguinte, não há botão de ver mais', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/minhas-atividades', { status: 200, corpo: { itens: [atividade('01')] } })
    montar()

    await screen.findByRole('region', { name: 'Para fazer' })
    expect(screen.queryByRole('button', { name: /Ver mais|Carregando…/ })).toBeNull()
  })

  it('"Ver mais tarefas" pede a segunda página só ao clicar, mostra "Carregando…" sem aceitar outro clique, e põe a tarefa nova no grupo dela', async () => {
    const rede = fakeNetwork()
    let liberar: (resposta: { status: number; corpo: unknown }) => void = () => undefined
    let chamadas = 0
    rede.responderPor('/v1/minhas-atividades', () => {
      chamadas += 1
      if (chamadas === 1) return { status: 200, corpo: { itens: [atividade('01')], proxima: PAGINA_SEGUINTE } }
      return new Promise((resolver) => (liberar = resolver))
    })
    montar()

    fireEvent.click(await screen.findByRole('button', { name: 'Ver mais tarefas' }))
    const carregando = await screen.findByRole('button', { name: 'Carregando…' })
    expect((carregando as HTMLButtonElement).disabled).toBe(true)

    await waitFor(() => expect(chamadas).toBe(2))
    liberar({ status: 200, corpo: { itens: [atividade('02', { situacao: 'com_diagnostico', respondidas: 3 })] } })
    expect(await within(grupo('Corrigidas')).findByText('Lista sintética 02')).toBeTruthy()
    expect(within(grupo('Para fazer')).getByText('Lista sintética 01')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Ver mais tarefas|Carregando…/ })).toBeNull()
  })
})
