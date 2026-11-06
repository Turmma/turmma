// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../../api/query-client'
import { fakeNetwork, renderScreen, setupScreen, type FakeNetwork } from '../../../__fixtures__/render-screen'
import { rotasDaPlanilha } from './api/importacao'
import { ImportarPlanilha, type PlanilhaConfig } from './ImportarPlanilha'
import { TEXTO_DA_CONFERENCIA } from './previa-da-planilha'

/**
 * A peça de subir a planilha (F2, 13.0), na tela e com a rede falsa: o que a prévia mostra primeiro, a marca que chega desmarcada, o
 * gravar que manda só ids e um pedido só, a resposta de uma prévia antiga que não aparece e nada de nome no armazenamento do
 * navegador. O que só o navegador mede (largura, alvo de toque, o XLSX carregado sob demanda, o prazo) é do e2e `importar-alunos`.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const CONFIGURACAO: PlanilhaConfig = {
  rotas: rotasDaPlanilha('alunos'),
  cabecalhos: ['turma', 'nome', 'matricula'],
  nomeDoModelo: 'modelo-alunos.csv',
  instrucao: 'Uma linha por aluno.',
  vazio: { titulo: 'Nenhuma planilha escolhida', descricao: 'Baixe o modelo e escolha o arquivo.' },
  rotuloDoGravar: 'Gravar planilha',
}
const CONCLUIDA = {
  id: id(900),
  tipo: 'alunos',
  estado: 'concluida',
  resumo: { entram: 2 },
  erro: null,
  criadoEm: '2026-11-04T10:00:00-03:00',
  concluidaEm: '2026-11-04T10:00:01-03:00',
}
const CSV = 'turma;nome;matricula\n8º A;Ana Souza;2026001\n8º A;Bia Lima;2026002\n'
const CANDIDATOS = [
  { id: id(1), acao: 'transferir', rotulo: 'Caio Pires (2026010)' },
  { id: id(2), acao: 'transferir', rotulo: 'Duda Alves (2026011)' },
  { id: id(3), acao: 'desligar', rotulo: 'Eva Mota (2026012)' },
]

afterEach(() => cleanup())

function montar(aoConcluir: () => unknown = () => undefined) {
  renderScreen(<ImportarPlanilha configuracao={CONFIGURACAO} aoConcluir={aoConcluir} />)
}

async function escolher(usuario: ReturnType<typeof userEvent.setup>, texto = CSV, nome = 'alunos.csv'): Promise<void> {
  await usuario.upload(screen.getByLabelText('Arquivo da planilha (Excel ou CSV)'), new File([texto], nome, { type: 'text/csv' }))
}

/** Os corpos dos POST que a peça mandou, em objeto. */
function corposEnviados(): { caminho: string; corpo: Record<string, unknown> }[] {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([, opcoes]) => opcoes?.method === 'POST')
    .map(([caminho, opcoes]) => ({ caminho: String(caminho), corpo: JSON.parse(String(opcoes?.body)) as Record<string, unknown> }))
}

function prepararGravar(rede: FakeNetwork): void {
  rede.responderPor('/v1/importacoes/alunos', { status: 202, corpo: { id: id(900) } })
  rede.responderPor(`/v1/importacoes/${id(900)}`, { status: 200, corpo: CONCLUIDA })
}

describe('a prévia: o que vem primeiro e o que segura a gravação', () => {
  it('antes de escolher o arquivo, há o convite para baixar o modelo e nenhuma prévia', () => {
    fakeNetwork()
    montar()
    expect(screen.getByText('Nenhuma planilha escolhida')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Baixar modelo' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Prévia' })).toBeNull()
  })

  it('com erro: as linhas com erro em frase, o foco na prévia, e nenhum botão de gravar — o motivo está no lugar dele', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor('/v1/importacoes/alunos/previa', {
      status: 200,
      corpo: {
        linhas: [{ linha: 2, resultado: 'entra' }, { linha: 3, resultado: 'erro', erro: 'turma_invalida' }, { linha: 4, resultado: 'erro', erro: 'sem_matricula' }],
        contagens: { entram: 1 },
        candidatos: [],
      },
    })
    montar()
    await escolher(usuario)

    const titulo = await screen.findByRole('heading', { name: 'Prévia' })
    await waitFor(() => expect(document.activeElement).toBe(titulo))
    const erros = within(screen.getByRole('region', { name: 'Linhas com erro (2)' }))
    expect(erros.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Linha 3: Não achei esta turma.'),
      expect.stringContaining('Linha 4: Falta a matrícula.'),
    ])
    expect(screen.getByText('1 linha entra')).toBeTruthy()
    expect(screen.getByText('Arquivo lido: alunos.csv.')).toBeTruthy()
    // Sem candidato, não há "Você decide".
    expect(screen.queryByRole('heading', { name: 'Você decide' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Gravar planilha' })).toBeNull()
    expect(screen.getByText(/nada é gravado enquanto houver erro/)).toBeTruthy()
    expect(corposEnviados().filter(({ caminho }) => caminho === '/v1/importacoes/alunos')).toEqual([])
  })

  it('a prévia que falha diz o que fazer, leva o foco ao alerta, e "Tentar de novo" manda o mesmo texto', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let tentativas = 0
    rede.responderPor('/v1/importacoes/alunos/previa', () => {
      tentativas += 1
      return tentativas === 1
        ? { status: 503, corpo: { erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }
        : { status: 200, corpo: { linhas: [{ linha: 2, resultado: 'entra' }], contagens: { entram: 1 }, candidatos: [] } }
    })
    montar()
    await escolher(usuario)

    const alerta = await screen.findByRole('alert')
    await waitFor(() => expect(document.activeElement).toBe(alerta))
    // A prévia que falhou não deixa o "carregando" na tela, junto com o alerta.
    expect(screen.queryByText('Conferindo a planilha com a escola…')).toBeNull()
    expect(screen.queryByText('Nenhuma planilha escolhida')).toBeNull()
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await screen.findByRole('heading', { name: 'Prévia' })
    expect(screen.queryByRole('alert')).toBeNull()
    const [primeira, segunda] = corposEnviados()
    expect(segunda?.corpo).toEqual(primeira?.corpo)
  })

  it('a planilha grande demais ou ilegível é recusada na tela, sem pedir nada à API', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    montar()
    const linhas = Array.from({ length: 3_001 }, (_, posicao) => `8º A;Aluno ${String(posicao)};${String(posicao)}`)
    await escolher(usuario, ['turma;nome;matricula', ...linhas].join('\n'))
    expect((await screen.findByRole('alert')).textContent).toContain('passa de 3.000 linhas')
    // A recusa pede outro arquivo: não há o que tentar de novo.
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(rede.chamadas).toEqual([])
  })
})

describe('as marcas são da coordenação (regra 70, item 2)', () => {
  function prepararComMarcas(rede: FakeNetwork): void {
    rede.responderPor('/v1/importacoes/alunos/previa', {
      status: 200,
      corpo: { linhas: [{ linha: 2, resultado: 'entra' }, { linha: 3, resultado: 'muda_de_turma' }], contagens: { entram: 1 }, candidatos: CANDIDATOS },
    })
    prepararGravar(rede)
  }

  it('chegam todas desmarcadas, com nome e matrícula só dentro da marca, e o texto diz que é conferência', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    prepararComMarcas(rede)
    montar()
    await escolher(usuario)

    await screen.findByRole('heading', { name: 'Você decide' })
    expect(screen.getByText(TEXTO_DA_CONFERENCIA)).toBeTruthy()
    // Só os grupos que têm candidato aparecem: ninguém sai da grade nesta planilha.
    expect(screen.getByRole('group', { name: 'Aparecem em outra turma na planilha (2)' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Estão nas turmas da planilha, mas não aparecem nela (1)' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: /Saem da grade nova/ })).toBeNull()
    for (const caixa of screen.getAllByRole('checkbox')) expect((caixa as HTMLInputElement).checked, caixa.getAttribute('id') ?? '').toBe(false)
    expect(screen.getByRole('checkbox', { name: 'Caio Pires (2026010)' })).toBeTruthy()
    // O resto da planilha é contagem: nenhum nome fora das marcas.
    expect(within(screen.getByRole('region', { name: 'O resto da planilha' })).queryByText(/Caio|Ana|2026/)).toBeNull()
  })

  it('gravar sem marcar ninguém manda as três listas vazias', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    prepararComMarcas(rede)
    montar()
    await escolher(usuario)
    await usuario.click(await screen.findByRole('button', { name: 'Gravar planilha' }))

    await screen.findByRole('heading', { name: 'Planilha gravada' })
    const gravar = corposEnviados().find(({ caminho }) => caminho === '/v1/importacoes/alunos')
    expect(gravar?.corpo).toEqual({ texto: CSV, marcas: { transferir: [], desligar: [], encerrar: [] } })
  })

  it('"marcar todos" marca só o grupo dele, e o gravar manda os ids, nunca nome nem matrícula', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    prepararComMarcas(rede)
    montar()
    await escolher(usuario)
    await usuario.click(await screen.findByRole('checkbox', { name: 'Marcar todos para transferir' }))
    expect((screen.getByRole('checkbox', { name: 'Eva Mota (2026012)' }) as HTMLInputElement).checked).toBe(false)
    await usuario.click(screen.getByRole('checkbox', { name: 'Eva Mota (2026012)' }))
    await usuario.click(screen.getByRole('button', { name: 'Gravar planilha' }))

    await screen.findByRole('heading', { name: 'Planilha gravada' })
    const marcas = corposEnviados().find(({ caminho }) => caminho === '/v1/importacoes/alunos')?.corpo.marcas
    expect(marcas).toEqual({ transferir: [id(1), id(2)], desligar: [id(3)], encerrar: [] })
    expect(JSON.stringify(marcas)).not.toMatch(/Caio|Eva|2026010/)
  })

  it('"marcar todos" aparece marcado quando todos do grupo estão marcados (também um a um) e desmarca todos ao ser desmarcado', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    prepararComMarcas(rede)
    montar()
    await escolher(usuario)
    const todos = async () => (await screen.findByRole('checkbox', { name: 'Marcar todos para transferir' })) as HTMLInputElement
    const caio = () => screen.getByRole('checkbox', { name: 'Caio Pires (2026010)' }) as HTMLInputElement
    const duda = () => screen.getByRole('checkbox', { name: 'Duda Alves (2026011)' }) as HTMLInputElement

    expect((await todos()).checked).toBe(false)
    await usuario.click(caio())
    expect((await todos()).checked).toBe(false)
    await usuario.click(duda())
    expect((await todos()).checked).toBe(true)
    await usuario.click(await todos())
    expect([(await todos()).checked, caio().checked, duda().checked]).toEqual([false, false, false])
    await usuario.click(await todos())
    expect([(await todos()).checked, caio().checked, duda().checked]).toEqual([true, true, true])
    // O "marcar todos" de outro grupo não marca este, nem o contrário.
    expect((screen.getByRole('checkbox', { name: 'Marcar todos para desligar' }) as HTMLInputElement).checked).toBe(false)
  })

  it('com mais gente a desligar do que cabe num gravar, "marcar todos" marca só o teto, o resto fica travado e a tela diz por quê (16.0)', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const sairam = Array.from({ length: 105 }, (_, i) => ({ id: id(1000 + i), acao: 'desligar', rotulo: `Aluno ${String(i)} (${String(2027000 + i)})` }))
    rede.responderPor('/v1/importacoes/alunos/previa', { status: 200, corpo: { linhas: [{ linha: 2, resultado: 'entra' }], contagens: { entram: 1 }, candidatos: sairam } })
    prepararGravar(rede)
    montar()
    await escolher(usuario)

    const grupo = await screen.findByRole('group', { name: /Estão nas turmas da planilha, mas não aparecem nela \(105\)/ })
    expect(within(grupo).getByText(/Cada gravação desliga até 100 pessoas/)).toBeTruthy()
    await usuario.click(within(grupo).getByRole('checkbox', { name: 'Marcar os primeiros 100 para desligar' }))
    expect(screen.getByText('Ao gravar, com as suas marcas: 100 alunos serão desligados e perdem o acesso.')).toBeTruthy()
    expect(within(grupo).getByText(/Você marcou 100, o máximo de cada gravação/)).toBeTruthy()
    // Os que ficaram de fora não se marcam: a API recusaria o gravar com 101.
    expect((within(grupo).getByRole('checkbox', { name: 'Aluno 0 (2027000)' }) as HTMLInputElement).checked).toBe(true)
    await usuario.click(await within(grupo).findByRole('button', { name: /Ver mais/ }))
    expect((within(grupo).getByRole('checkbox', { name: 'Aluno 104 (2027104)' }) as HTMLInputElement).disabled).toBe(true)
    // Desmarcar um abre a vaga.
    await usuario.click(within(grupo).getByRole('checkbox', { name: 'Aluno 0 (2027000)' }))
    expect(within(grupo).queryByText(/Você marcou 100/)).toBeNull()
    expect((within(grupo).getByRole('checkbox', { name: 'Aluno 104 (2027104)' }) as HTMLInputElement).disabled).toBe(false)

    await usuario.click(within(grupo).getByRole('checkbox', { name: 'Aluno 104 (2027104)' }))
    await usuario.click(await screen.findByRole('button', { name: 'Gravar planilha' }))
    await screen.findByRole('heading', { name: 'Planilha gravada' })
    const gravar = corposEnviados().find(({ caminho }) => caminho === '/v1/importacoes/alunos')
    expect((gravar?.corpo as { marcas: { desligar: string[] } }).marcas.desligar).toHaveLength(100)
  })

  it('perto do "Gravar planilha" a tela diz o que as marcas vão fazer, e some sem marca', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    prepararComMarcas(rede)
    montar()
    await escolher(usuario)
    await screen.findByRole('button', { name: 'Gravar planilha' })
    expect(screen.queryByText(/Ao gravar, com as suas marcas/)).toBeNull()

    await usuario.click(screen.getByRole('checkbox', { name: 'Marcar todos para transferir' }))
    expect(screen.getByText('Ao gravar, com as suas marcas: 2 alunos mudarão de turma.')).toBeTruthy()
    await usuario.click(screen.getByRole('checkbox', { name: 'Eva Mota (2026012)' }))
    expect(screen.getByText('Ao gravar, com as suas marcas: 2 alunos mudarão de turma; 1 aluno será desligado e perde o acesso.')).toBeTruthy()
    await usuario.click(screen.getByRole('checkbox', { name: 'Marcar todos para transferir' }))
    await usuario.click(screen.getByRole('checkbox', { name: 'Eva Mota (2026012)' }))
    expect(screen.queryByText(/Ao gravar, com as suas marcas/)).toBeNull()
  })
})

describe('o gravar', () => {
  it('o clique duplo manda um pedido só, e ao fim a peça avisa quem a usa e leva o foco ao resultado', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor('/v1/importacoes/alunos/previa', { status: 200, corpo: { linhas: [{ linha: 2, resultado: 'entra' }], contagens: { entram: 1 }, candidatos: [] } })
    prepararGravar(rede)
    const aoConcluir = vi.fn()
    montar(aoConcluir)
    await escolher(usuario)
    const botao = await screen.findByRole('button', { name: 'Gravar planilha' })
    await usuario.dblClick(botao)

    const resultado = await screen.findByRole('heading', { name: 'Planilha gravada' })
    await waitFor(() => expect(document.activeElement).toBe(resultado))
    expect(corposEnviados().filter(({ caminho }) => caminho === '/v1/importacoes/alunos')).toHaveLength(1)
    expect(aoConcluir).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Gravar planilha' })).toBeNull()
  })

  it('em StrictMode (como o app roda) a gravação que vai concluir não vira alerta de falha: a tela acompanha até "Planilha gravada"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor('/v1/importacoes/alunos/previa', { status: 200, corpo: { linhas: [{ linha: 2, resultado: 'entra' }], contagens: { entram: 1 }, candidatos: [] } })
    prepararGravar(rede)
    const aoConcluir = vi.fn()
    // Como o `main.tsx`: o `StrictMode` por fora de tudo. Dentro do `QueryClientProvider` (o `renderScreen`) o React não monta, desmonta e
    // monta de novo, e o caso não reproduziria o defeito.
    render(
      <StrictMode>
        <QueryClientProvider client={createQueryClient()}>
          <ImportarPlanilha configuracao={CONFIGURACAO} aoConcluir={aoConcluir} />
        </QueryClientProvider>
      </StrictMode>,
    )
    await escolher(usuario)
    await usuario.click(await screen.findByRole('button', { name: 'Gravar planilha' }))

    await screen.findByRole('heading', { name: 'Planilha gravada' })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(aoConcluir).toHaveBeenCalledTimes(1)
  })

  it('a escola que mudou desde a prévia: diz que nada foi gravado, tira a prévia e o botão', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor('/v1/importacoes/alunos/previa', { status: 200, corpo: { linhas: [{ linha: 2, resultado: 'entra' }], contagens: { entram: 1 }, candidatos: [] } })
    rede.responderPor('/v1/importacoes/alunos', { status: 202, corpo: { id: id(900) } })
    rede.responderPor(`/v1/importacoes/${id(900)}`, { status: 200, corpo: { ...CONCLUIDA, estado: 'desatualizada', resumo: null, concluidaEm: null } })
    montar()
    await escolher(usuario)
    await usuario.click(await screen.findByRole('button', { name: 'Gravar planilha' }))

    expect((await screen.findByRole('alert')).textContent).toContain('A escola mudou desde a prévia')
    expect(screen.queryByRole('heading', { name: 'Prévia' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Gravar planilha' })).toBeNull()
  })

  it('outra importação em andamento (CONFLITO) é outro texto, e a prévia continua valendo para gravar de novo', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor('/v1/importacoes/alunos/previa', { status: 200, corpo: { linhas: [{ linha: 2, resultado: 'entra' }], contagens: { entram: 1 }, candidatos: [] } })
    rede.responderPor('/v1/importacoes/alunos', { status: 409, corpo: { erro: { codigo: 'CONFLITO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
    montar()
    await escolher(usuario)
    await usuario.click(await screen.findByRole('button', { name: 'Gravar planilha' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Outra importação desta escola ainda está em andamento')
    expect(screen.getByRole('button', { name: 'Gravar planilha' })).toBeTruthy()
  })
})

describe('recomeçar', () => {
  it('a resposta da prévia do arquivo antigo, que chega depois, não aparece no lugar da do arquivo novo', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const primeira = rede.segurar()
    montar()
    await escolher(usuario, CSV, 'velho.csv')
    await waitFor(() => expect(rede.chamadas).toHaveLength(1))
    rede.responder({ status: 200, corpo: { linhas: [{ linha: 2, resultado: 'entra' }, { linha: 3, resultado: 'entra' }, { linha: 4, resultado: 'entra' }], contagens: { entram: 3 }, candidatos: [] } })
    await escolher(usuario, 'turma;nome;matricula\n8º B;Caio;7\n', 'novo.csv')
    await screen.findByText('3 linhas entram')

    primeira.liberar({ status: 200, corpo: { linhas: [{ linha: 2, resultado: 'ja_existe' }], contagens: { ja_existem: 1 }, candidatos: [] } })
    await new Promise((resolver) => setTimeout(resolver, 30))
    expect(screen.getByText('3 linhas entram')).toBeTruthy()
    expect(screen.queryByText('1 linha já existe, e nada muda')).toBeNull()
  })

  it('escolher o mesmo arquivo de novo (depois de corrigido) pede outra prévia, e a anterior sai', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responder({ status: 200, corpo: { linhas: [{ linha: 2, resultado: 'erro', erro: 'sem_nome' }], contagens: {}, candidatos: [] } })
    rede.responder({ status: 200, corpo: { linhas: [{ linha: 2, resultado: 'entra' }], contagens: { entram: 1 }, candidatos: [] } })
    montar()
    await escolher(usuario)
    await screen.findByRole('region', { name: 'Linhas com erro (1)' })
    await escolher(usuario)
    await screen.findByRole('button', { name: 'Gravar planilha' })
    expect(screen.queryByRole('region', { name: /Linhas com erro/ })).toBeNull()
    expect(corposEnviados()).toHaveLength(2)
  })
})

describe('regra 20: nome e matrícula só na memória da página', () => {
  it('depois de um fluxo inteiro, nada foi para o localStorage nem para o sessionStorage, e o endereço não mudou', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor('/v1/importacoes/alunos/previa', { status: 200, corpo: { linhas: [{ linha: 2, resultado: 'entra' }], contagens: { entram: 1 }, candidatos: CANDIDATOS } })
    prepararGravar(rede)
    const endereco = window.location.href
    montar()
    await escolher(usuario)
    await usuario.click(await screen.findByRole('checkbox', { name: 'Caio Pires (2026010)' }))
    await usuario.click(screen.getByRole('button', { name: 'Gravar planilha' }))
    await screen.findByRole('heading', { name: 'Planilha gravada' })

    const guardado = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })
    expect(guardado).not.toMatch(/Caio|Ana|Bia|Eva|2026/)
    expect(window.location.href).toBe(endereco)
  })
})

const PREVIA_QUE_ENTRA = { status: 200, corpo: { linhas: [{ linha: 2, resultado: 'entra' }], contagens: { entram: 1 }, candidatos: [] } }
const ERRO_503 = { status: 503, corpo: { erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }

describe('os estados da tela, um de cada vez', () => {
  it('o convite do começo, o carregando, a prévia, a recusa e o resultado se revezam, e o nome do arquivo lido aparece', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const previa = rede.segurar()
    prepararGravar(rede)
    montar()
    expect(screen.getByText('Nenhuma planilha escolhida')).toBeTruthy()
    expect(screen.queryByText(/Arquivo lido/)).toBeNull()
    await escolher(usuario)

    await screen.findByText('Conferindo a planilha com a escola…')
    expect(screen.queryByText('Nenhuma planilha escolhida')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Prévia' })).toBeNull()
    previa.liberar(PREVIA_QUE_ENTRA)
    await screen.findByRole('heading', { name: 'Prévia' })
    expect(screen.queryByText('Conferindo a planilha com a escola…')).toBeNull()
    expect(screen.queryByText('Nenhuma planilha escolhida')).toBeNull()
    expect(screen.getByText('Arquivo lido: alunos.csv.')).toBeTruthy()

    await usuario.click(screen.getByRole('button', { name: 'Gravar planilha' }))
    await screen.findByRole('heading', { name: 'Planilha gravada' })
    expect(screen.queryByText('Nenhuma planilha escolhida')).toBeNull()

    const linhas = Array.from({ length: 3_001 }, (_, posicao) => `8º A;Aluno ${String(posicao)};${String(posicao)}`)
    await escolher(usuario, ['turma;nome;matricula', ...linhas].join('\n'))
    await screen.findByRole('alert')
    expect(screen.queryByText('Nenhuma planilha escolhida')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Planilha gravada' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Prévia' })).toBeNull()
  })

  it('o seletor de arquivo é um botão em português que abre o campo escondido: "Escolher arquivo", "Nenhum arquivo escolhido", e depois "Trocar arquivo"', async () => {
    const usuario = userEvent.setup()
    fakeNetwork().responderPor('/v1/importacoes/alunos/previa', PREVIA_QUE_ENTRA)
    montar()
    const campo = screen.getByLabelText('Arquivo da planilha (Excel ou CSV)') as HTMLInputElement
    // O campo do navegador ("Choose File" / "No file chosen", no idioma dele) não aparece: quem aparece é o botão do produto.
    expect(campo.hidden).toBe(true)
    expect(screen.getByText('Nenhum arquivo escolhido.')).toBeTruthy()
    const abrir = vi.spyOn(campo, 'click')
    await usuario.click(screen.getByRole('button', { name: 'Escolher arquivo' }))
    expect(abrir).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Escolher arquivo' }).getAttribute('aria-describedby')).toBe(campo.labels?.[0]?.id)

    await escolher(usuario)
    await screen.findByRole('heading', { name: 'Prévia' })
    expect(screen.queryByText('Nenhum arquivo escolhido.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Escolher arquivo' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Trocar arquivo' })).toBeTruthy()
  })

  it('enquanto grava, o botão diz "Gravando…" e fica desligado, o campo do arquivo também, e a tela explica', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor('/v1/importacoes/alunos/previa', PREVIA_QUE_ENTRA)
    let liberar: (resposta: { status: number; corpo: unknown }) => void = () => undefined
    rede.responderPor('/v1/importacoes/alunos', () => new Promise((resolver) => (liberar = resolver)))
    rede.responderPor(`/v1/importacoes/${id(900)}`, { status: 200, corpo: CONCLUIDA })
    montar()
    await escolher(usuario)
    const gravar = await screen.findByRole('button', { name: 'Gravar planilha' })
    // Antes do clique, nada de "gravando".
    expect(screen.queryByText(/Gravando a planilha/)).toBeNull()
    await usuario.click(gravar)

    const gravando = await screen.findByRole('button', { name: 'Gravando…' })
    expect((gravando as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Gravando a planilha\. Pode levar alguns segundos\./)).toBeTruthy()
    expect((screen.getByLabelText('Arquivo da planilha (Excel ou CSV)') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Trocar arquivo' }) as HTMLButtonElement).disabled).toBe(true)
    // Ainda não passou o prazo da fila lenta: o aviso dela não aparece.
    expect(screen.queryByText(/A fila está mais cheia que o normal/)).toBeNull()
    liberar({ status: 202, corpo: { id: id(900) } })
    await screen.findByRole('heading', { name: 'Planilha gravada' })
  })

  it('fechar a janela de escolha sem arquivo não apaga a prévia que está na tela, e dois arquivos em seguida pedem uma prévia só, a do último', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responder(PREVIA_QUE_ENTRA)
    montar()
    await escolher(usuario)
    await screen.findByRole('heading', { name: 'Prévia' })
    const campo = screen.getByLabelText('Arquivo da planilha (Excel ou CSV)')
    fireEvent.change(campo, { target: { files: [] } })
    await new Promise((resolver) => setTimeout(resolver, 30))
    expect(screen.getByRole('heading', { name: 'Prévia' })).toBeTruthy()
    expect(corposEnviados()).toHaveLength(1)

    const outro = 'turma;nome;matricula\n8º B;Caio;7\n'
    rede.responder(PREVIA_QUE_ENTRA)
    fireEvent.change(campo, { target: { files: [new File([CSV], 'a.csv', { type: 'text/csv' })] } })
    fireEvent.change(campo, { target: { files: [new File([outro], 'b.csv', { type: 'text/csv' })] } })
    await waitFor(() => expect(corposEnviados()).toHaveLength(2))
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(corposEnviados()).toHaveLength(2)
    expect(corposEnviados()[1]?.corpo.texto).toBe(outro)
  })

  it('a falha da prévia do arquivo antigo, que chega depois, não aparece nem tira o foco da prévia nova', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const primeira = rede.segurar()
    montar()
    await escolher(usuario, CSV, 'velho.csv')
    await waitFor(() => expect(rede.chamadas).toHaveLength(1))
    rede.responder(PREVIA_QUE_ENTRA)
    await escolher(usuario, 'turma;nome;matricula\n8º B;Caio;7\n', 'novo.csv')
    const titulo = await screen.findByRole('heading', { name: 'Prévia' })
    await waitFor(() => expect(document.activeElement).toBe(titulo))

    primeira.liberar(ERRO_503)
    await new Promise((resolver) => setTimeout(resolver, 30))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.activeElement).toBe(titulo)
  })
})

describe('a prévia longa e as faixas que só aparecem com o que mostrar', () => {
  const linhasDe = (quantas: number, resultado: string, extra: Record<string, unknown> = {}) => Array.from({ length: quantas }, (_, posicao) => ({ linha: posicao + 2, resultado, ...extra }))

  it('os erros vêm de cem em cem, e "Ver mais" diz quantos faltam', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responder({ status: 200, corpo: { linhas: linhasDe(120, 'erro', { erro: 'sem_nome' }), contagens: {}, candidatos: [] } })
    montar()
    await escolher(usuario)

    const erros = await screen.findByRole('region', { name: 'Linhas com erro (120)' })
    expect(within(erros).getAllByRole('listitem')).toHaveLength(100)
    await usuario.click(within(erros).getByRole('button', { name: 'Ver mais (20 restantes)' }))
    expect(within(erros).getAllByRole('listitem')).toHaveLength(120)
    expect(within(erros).queryByRole('button', { name: /Ver mais/ })).toBeNull()
  })

  it('as marcas de um grupo vêm de cem em cem, e "marcar todos" marca todos, também os que a tela ainda não abriu', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const candidatos = Array.from({ length: 150 }, (_, posicao) => ({ id: id(1_000 + posicao), acao: 'transferir', rotulo: `Aluno ${String(posicao)} (${String(2_000 + posicao)})` }))
    rede.responderPor('/v1/importacoes/alunos/previa', { status: 200, corpo: { linhas: linhasDe(1, 'entra'), contagens: { entram: 1 }, candidatos } })
    prepararGravar(rede)
    montar()
    await escolher(usuario)

    const grupo = await screen.findByRole('group', { name: 'Aparecem em outra turma na planilha (150)' })
    // O "marcar todos" mais as cem marcas da primeira página.
    expect(within(grupo).getAllByRole('checkbox')).toHaveLength(101)
    await usuario.click(within(grupo).getByRole('button', { name: 'Ver mais (50 restantes)' }))
    expect(within(grupo).getAllByRole('checkbox')).toHaveLength(151)
    expect(within(grupo).queryByRole('button', { name: /Ver mais/ })).toBeNull()
    await usuario.click(within(grupo).getByRole('checkbox', { name: 'Marcar todos para transferir' }))
    await usuario.click(screen.getByRole('button', { name: 'Gravar planilha' }))
    await screen.findByRole('heading', { name: 'Planilha gravada' })
    const marcas = corposEnviados().find(({ caminho }) => caminho === '/v1/importacoes/alunos')?.corpo.marcas as { transferir: string[] }
    expect(marcas.transferir).toHaveLength(150)
  })

  it('o aviso, as turmas novas e o resto só aparecem quando há o que dizer', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responder({ status: 200, corpo: { linhas: [{ linha: 2, resultado: 'entra' }, { linha: 3, resultado: 'ja_existe', aviso: 'x' }], contagens: { entram: 1, turmas_novas: 2 }, candidatos: [] } })
    rede.responder({ status: 200, corpo: { linhas: linhasDe(1, 'erro', { erro: 'sem_nome' }), contagens: {}, candidatos: [] } })
    rede.responder({ status: 200, corpo: { linhas: linhasDe(1, 'erro', { erro: 'sem_nome' }), contagens: { turmas_novas: 1 }, candidatos: [] } })
    rede.responder(PREVIA_QUE_ENTRA)
    montar()
    await escolher(usuario)

    const avisos = await screen.findByRole('region', { name: 'Linhas com aviso (1)' })
    expect(within(avisos).getByRole('listitem').textContent).toContain('Linha 3: Confira esta linha')
    expect(screen.getByText('2 turmas novas serão criadas.')).toBeTruthy()
    const resto = screen.getByRole('region', { name: 'O resto da planilha' })
    expect(within(resto).getByText('1 linha entra · 1 linha já existe, e nada muda')).toBeTruthy()

    // Só erro: não há aviso, nem resto, nem turma nova.
    await escolher(usuario)
    await screen.findByRole('region', { name: 'Linhas com erro (1)' })
    expect(screen.queryByRole('region', { name: /Linhas com aviso/ })).toBeNull()
    expect(screen.queryByRole('region', { name: 'O resto da planilha' })).toBeNull()
    expect(screen.queryByText(/turma nova será criada|turmas novas serão criadas/)).toBeNull()

    // Sem linha para contar, mas com turma nova: só a frase da turma, sem parágrafo vazio.
    await escolher(usuario)
    await screen.findByText('1 turma nova será criada.')
    expect(screen.getByRole('region', { name: 'O resto da planilha' }).querySelectorAll('p')).toHaveLength(1)

    // Sem turma nova, o resto não fala de turma.
    await escolher(usuario)
    await screen.findByRole('button', { name: 'Gravar planilha' })
    expect(within(screen.getByRole('region', { name: 'O resto da planilha' })).getByText('1 linha entra')).toBeTruthy()
    expect(screen.queryByText(/turma nova será criada|turmas novas serão criadas/)).toBeNull()
  })

  it('14.0: a grade que só tira aula pode ser gravada, a prévia diz o que sai, e ao terminar vale o texto que a tela da grade dá, e não o dos alunos', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor('/v1/importacoes/grade/previa', {
      status: 200,
      corpo: { linhas: [{ linha: 2, resultado: 'ja_existe', aviso: 'professor_em_duas_turmas' }], contagens: { ja_existem: 1, aulas_removidas: 2, disciplinas_novas: 1 }, candidatos: [] },
    })
    rede.responderPor('/v1/importacoes/grade', { status: 202, corpo: { id: id(901) } })
    rede.responderPor(`/v1/importacoes/${id(901)}`, { status: 200, corpo: { ...CONCLUIDA, id: id(901), tipo: 'grade', resumo: { aulas: 0, aulas_removidas: 2 } } })
    const grade: PlanilhaConfig = { ...CONFIGURACAO, rotas: rotasDaPlanilha('grade'), rotuloDoGravar: 'Gravar grade', textoDaConclusao: (resumo) => `${String(resumo?.aulas_removidas ?? 0)} aulas saíram da grade.` }
    renderScreen(<ImportarPlanilha configuracao={grade} />)
    await escolher(usuario)

    const avisos = await screen.findByRole('region', { name: 'Linhas com aviso (1)' })
    expect(within(avisos).getByRole('listitem').textContent).toContain('aula conjunta')
    expect(screen.getByText('2 aulas já gravadas saem do ano, porque a planilha não as traz.')).toBeTruthy()
    expect(screen.getByText('1 disciplina nova será criada.')).toBeTruthy()
    await usuario.click(screen.getByRole('button', { name: 'Gravar grade' }))
    await screen.findByRole('heading', { name: 'Planilha gravada' })
    expect(screen.getByText('2 aulas saíram da grade.')).toBeTruthy()
    expect(screen.queryByText(/alunos? (entrou|entraram)/)).toBeNull()
  })

  it('14.0: o erro que a planilha diz do jeito dela usa o texto dela, e os outros seguem os gerais', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor('/v1/importacoes/calendario/previa', {
      status: 200,
      corpo: { linhas: [{ linha: 2, resultado: 'erro', erro: 'fim_antes_do_inicio' }, { linha: 3, resultado: 'erro', erro: 'turma_invalida' }], contagens: {}, candidatos: [] },
    })
    const calendario: PlanilhaConfig = { ...CONFIGURACAO, rotas: rotasDaPlanilha('calendario'), textosDoErroDaLinha: { fim_antes_do_inicio: 'Texto do calendário.' } }
    renderScreen(<ImportarPlanilha configuracao={calendario} />)
    await escolher(usuario)

    const erros = within(await screen.findByRole('region', { name: 'Linhas com erro (2)' }))
    expect(erros.getAllByRole('listitem').map((item) => item.textContent)).toEqual([expect.stringContaining('Linha 2: Texto do calendário.'), expect.stringContaining('Linha 3: Não achei esta turma.')])
  })
  it('15.0: a planilha que diz as marcas do jeito dela usa os textos dela no grupo e no resumo, e o rótulo é o que a API mandou, sem e-mail', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor('/v1/importacoes/professores/previa', {
      status: 200,
      corpo: { linhas: [{ linha: 2, resultado: 'entra' }], contagens: { entram: 1 }, candidatos: [{ id: id(7), acao: 'desligar', rotulo: 'Helena Prado' }] },
    })
    const professores: PlanilhaConfig = {
      ...CONFIGURACAO,
      rotas: rotasDaPlanilha('professores'),
      rotuloDoGravar: 'Gravar professores',
      textosDosGruposDeMarca: { desligar: { titulo: 'Estão na escola, mas não aparecem na planilha', explicacao: 'Marque só quem saiu.', rotuloDoTodos: 'Marcar todos para desligar' } },
      frasesDoResumoDeMarcas: { desligar: ['professor será desligado e perde o acesso', 'professores serão desligados e perdem o acesso'] },
    }
    renderScreen(<ImportarPlanilha configuracao={professores} />)
    await escolher(usuario)

    const grupo = await screen.findByRole('group', { name: 'Estão na escola, mas não aparecem na planilha (1)' })
    expect(screen.queryByRole('group', { name: /Estão nas turmas da planilha/ })).toBeNull()
    expect(within(grupo).getByText('Marque só quem saiu.')).toBeTruthy()
    const marca = within(grupo).getByRole('checkbox', { name: 'Helena Prado' }) as HTMLInputElement
    expect(marca.checked).toBe(false)
    expect(screen.queryByText(/Ao gravar, com as suas marcas/)).toBeNull()
    await usuario.click(marca)
    expect(screen.getByText('Ao gravar, com as suas marcas: 1 professor será desligado e perde o acesso.')).toBeTruthy()
  })
})
