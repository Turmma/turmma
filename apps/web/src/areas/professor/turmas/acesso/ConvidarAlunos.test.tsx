// @vitest-environment jsdom
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { acessoDaTurmaQueryOptions } from '../api/acesso'
import { createQueryClient } from '../../../../api/query-client'
import { setupScreen, fakeNetwork, type FakeNetwork, type FakeResponse } from '../../../../__fixtures__/render-screen'
import { formatDateTime } from '../../../../format'
import { TEXTO_DO_ACESSO_NOVO, TEXTO_DO_ACESSO_QUE_CAI, TEXTO_DO_REVOGAR } from './acesso-da-turma'
import { ConvidarAlunos } from './ConvidarAlunos'

/**
 * O diálogo "Convidar alunos" (telas do professor, 13.0; RF19): os passos que trocam o conteúdo de um diálogo só, o link e o
 * código uma vez, o envio único e a pergunta de fechar sem copiar. A rede é falsa e responde **na ordem dos pedidos**: a leitura
 * e o gerar são o mesmo caminho, com métodos diferentes; a peça, o cliente de consultas e a sessão são os de verdade. O `jsdom`
 * não implementa o `dialog` modal: o teste instala o `showModal` e o `close`, e o Esc é o evento `cancel` que o navegador dispararia.
 * A janela inteira de verdade (a caixa e o fundo calculados nos dois temas) e o fluxo pela turma aberta ficam para o e2e.
 */
setupScreen()

const TURMA = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5'
const ESCOLA = { nome: 'Escola sintética', slug: 'escola-sintetica' }
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde'
const CODIGO = 'ABCD2345'
const GERADO = { token: TOKEN, codigo: CODIGO, expiraEm: '2026-10-09T12:00:00.000Z' }
const VIGENTE = { expiraEm: '2026-10-20T15:30:00.000Z' }
const SEM_ACESSO = { expiraEm: null }

const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
const SEM_CORPO: FakeResponse = { status: 204 }

interface Espioes {
  readonly aoFechar: Mock<() => void>
  readonly aoRevogar: Mock<() => void>
}

/** A tela que desenha o diálogo enquanto ele está aberto: fechar o tira, como a seção da aba o tira. */
function Hospedeiro({ cliente, espioes }: { cliente: QueryClient; espioes: Espioes }) {
  const [aberto, definirAberto] = useState(true)
  if (!aberto) return <p>diálogo fechado</p>
  return (
    <ConvidarAlunos
      turmaId={TURMA}
      escola={ESCOLA}
      aoTerminar={() => cliente.invalidateQueries({ queryKey: acessoDaTurmaQueryOptions(TURMA).queryKey })}
      aoFechar={() => {
        espioes.aoFechar()
        definirAberto(false)
      }}
      aoRevogar={() => {
        espioes.aoRevogar()
        definirAberto(false)
      }}
      focoDeReserva={() => undefined}
    />
  )
}

function montar(cliente = createQueryClient()) {
  const espioes: Espioes = { aoFechar: vi.fn(), aoRevogar: vi.fn() }
  const tela = render(
    <QueryClientProvider client={cliente}>
      <Hospedeiro cliente={cliente} espioes={espioes} />
    </QueryClientProvider>,
  )
  return { cliente, espioes, ...tela }
}

const dialogo = () => screen.getByRole('dialog')
/** O título do diálogo: o `h2` que o nomeia. */
const titulo = () => within(dialogo()).getByRole('heading', { level: 2 })
const radios = () => within(dialogo()).queryAllByRole('radio')

/** Os pedidos de gravação que saíram, com o corpo: o gerar e o revogar. */
function gravacoes(): { caminho: string; corpo: unknown }[] {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([, opcoes]) => opcoes?.method === 'POST')
    .map(([caminho, opcoes]) => ({ caminho: String(caminho), corpo: typeof opcoes?.body === 'string' ? (JSON.parse(opcoes.body) as unknown) : undefined }))
}
const gerares = () => gravacoes().filter((gravacao) => gravacao.caminho === `/v1/turmas/${TURMA}/acesso`)

/** Abre sem acesso, escolhe a validade e gera: o diálogo fica no passo "Acesso gerado". */
async function gerarPrimeiro(rede: FakeNetwork, usuario: ReturnType<typeof userEvent.setup>, acesso: typeof GERADO = GERADO) {
  rede.responder(ok(SEM_ACESSO))
  rede.responder(ok(acesso))
  rede.responder(ok(VIGENTE))
  const tela = montar()
  await usuario.click(await screen.findByRole('button', { name: 'Gerar acesso' }))
  await screen.findByRole('heading', { name: 'Acesso gerado' })
  return tela
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
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('Convidar alunos: os estados', () => {
  it('carregando: o diálogo abre dizendo que lê o acesso, com "Fechar"; a leitura sem acesso leva ao passo "Gerar acesso", com 7 dias escolhidos e o foco no texto', async () => {
    const rede = fakeNetwork()
    const leitura = rede.segurar()
    montar()

    expect(titulo().textContent).toBe('Convidar alunos')
    expect(within(dialogo()).getByText('Carregando o acesso da turma…')).toBeTruthy()
    expect(within(dialogo()).getByRole('button', { name: 'Fechar' })).toBeTruthy()
    expect(radios()).toHaveLength(0)

    await act(async () => leitura.liberar(ok(SEM_ACESSO)))
    await waitFor(() => expect(titulo().textContent).toBe('Gerar acesso'))
    expect(radios().map((radio) => (radio as HTMLInputElement).checked)).toEqual([false, true, false])
    expect(within(dialogo()).getByText(TEXTO_DO_ACESSO_NOVO)).toBe(document.activeElement)
    expect(within(dialogo()).getByRole('button', { name: 'Gerar acesso' })).toBeTruthy()
    expect(within(dialogo()).queryByText(/deixam de valer/)).toBeNull()
  })

  it('erro: a mensagem do catálogo e "Tentar de novo", que lê de novo e leva ao passo certo', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falha = true
    rede.responderPor(`/v1/turmas/${TURMA}/acesso`, () => (falha ? erro(503, 'INDISPONIVEL_TENTE_DE_NOVO') : ok(VIGENTE)))
    montar()

    // O cliente repete uma vez, um segundo depois, antes de mostrar o erro.
    expect(await within(dialogo()).findByRole('alert', {}, { timeout: 5_000 })).toBeTruthy()
    expect(within(dialogo()).queryByText(/INDISPONIVEL/)).toBeNull()
    expect(titulo().textContent).toBe('Convidar alunos')
    expect(within(dialogo()).getByRole('button', { name: 'Fechar' })).toBeTruthy()
    falha = false
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Tentar de novo' }))
    expect(await within(dialogo()).findByText(`Vale até ${formatDateTime(VIGENTE.expiraEm)}.`)).toBeTruthy()
  })

  it('a turma que saiu do alcance diz a quem recorrer, sem "Tentar de novo"', async () => {
    const rede = fakeNetwork()
    rede.responder(erro(404, 'NAO_ENCONTRADO'))
    montar()

    expect(await within(dialogo()).findByText(/Esta turma não está disponível para você agora/)).toBeTruthy()
    expect(within(dialogo()).queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(within(dialogo()).getByRole('button', { name: 'Fechar' })).toBeTruthy()
  })

  it('com acesso vigente: só até quando vale e as duas ações, sem link, sem código e sem campo; o foco está no "Vale até"', async () => {
    const rede = fakeNetwork()
    rede.responder(ok(VIGENTE))
    montar()

    const vale = await within(dialogo()).findByText(`Vale até ${formatDateTime(VIGENTE.expiraEm)}.`)
    expect(titulo().textContent).toBe('Convidar alunos')
    expect(vale).toBe(document.activeElement)
    expect(within(dialogo()).getAllByRole('button').map((botao) => botao.textContent)).toEqual(['Gerar novo acesso', 'Revogar o acesso', 'Fechar'])
    expect(within(dialogo()).queryByRole('textbox')).toBeNull()
    expect(radios()).toHaveLength(0)
    expect(within(dialogo()).queryByRole('group', { name: 'Código da turma' })).toBeNull()
    expect(gravacoes()).toEqual([])
  })

  it('com a leitura já na memória, o diálogo abre direto no passo, com o foco no texto dele e sem esperar nenhuma mudança de etapa', () => {
    const rede = fakeNetwork()
    rede.responder(ok(VIGENTE))
    const cliente = createQueryClient()
    cliente.setQueryData(acessoDaTurmaQueryOptions(TURMA).queryKey, VIGENTE)
    montar(cliente)

    expect(titulo().textContent).toBe('Convidar alunos')
    expect(document.activeElement).toBe(within(dialogo()).getByText(`Vale até ${formatDateTime(VIGENTE.expiraEm)}.`))
    expect(gravacoes()).toEqual([])
  })

  it('gerando: o botão diz "Gerando…" e fica desligado, a validade não muda mais, e dois cliques no mesmo instante mandam um pedido só', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responder(ok(SEM_ACESSO))
    const gerar = rede.segurar()
    montar()

    await usuario.click(await screen.findByRole('radio', { name: '30 dias' }))
    const botao = within(dialogo()).getByRole('button', { name: 'Gerar acesso' })
    // Os dois cliques antes de a tela desligar o botão: só a trava do pedido no ar segura o segundo.
    act(() => {
      botao.click()
      botao.click()
    })
    await waitFor(() => expect(within(dialogo()).getByRole('button', { name: 'Gerando…' })).toHaveProperty('disabled', true))
    expect(within(dialogo()).getAllByRole('status').some((estado) => estado.textContent === 'Gerando o acesso…')).toBe(true)
    expect(radios().every((radio) => radio.matches(':disabled'))).toBe(true)
    expect(gerares()).toEqual([{ caminho: `/v1/turmas/${TURMA}/acesso`, corpo: { validadeDias: 30 } }])
    // Cancelar com o pedido no ar pergunta, na caixa de sempre: ainda não há acesso, e portanto nada na página de trás a esconder.
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByRole('heading', { name: 'Fechar sem copiar o link?' })).toBeTruthy()
    expect(dialogo().className).not.toContain('bg-fundo')
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Voltar ao acesso' }))

    rede.responder(ok(VIGENTE))
    await act(async () => gerar.liberar(ok(GERADO)))
    expect(await screen.findByRole('heading', { name: 'Acesso gerado' })).toBeTruthy()
    expect(gerares()).toHaveLength(1)
  })
})

describe('Convidar alunos: o acesso gerado, uma vez', () => {
  it('gerar leva ao passo "Acesso gerado" com o código em dois grupos, soletrado para o leitor de tela, e o link da sala; a janela passa a ser a inteira só nele', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responder(ok(SEM_ACESSO))
    rede.responder(ok(GERADO))
    rede.responder(ok(VIGENTE))
    montar()

    await usuario.click(await screen.findByRole('radio', { name: '1 dia' }))
    // O passo "Gerar" fica na caixa de sempre: o fundo é o da superfície, e não o da página.
    expect(dialogo().className).toContain('bg-superficie')
    expect(dialogo().className).not.toContain('bg-fundo')
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Gerar acesso' }))

    const acesso = await screen.findByRole('heading', { name: 'Acesso gerado' })
    expect(acesso).toBe(document.activeElement)
    expect(gerares()).toEqual([{ caminho: `/v1/turmas/${TURMA}/acesso`, corpo: { validadeDias: 1 } }])
    // O passo é projetado: a janela inteira, com o fundo da página por classe de token, sem o degrau da caixa.
    expect(dialogo().className).toContain('bg-fundo')
    expect(dialogo().className).toContain('w-full')
    expect(dialogo().className).toContain('h-full')
    expect(dialogo().className).not.toContain('bg-superficie')
    expect(dialogo().className).not.toContain('shadow-flutua')
    // O título do diálogo continua o do passo que gerou.
    expect(titulo().textContent).toBe('Gerar acesso')
    const codigo = within(dialogo()).getByRole('group', { name: 'Código da turma' })
    expect(codigo.querySelector('p[aria-hidden="true"]')?.textContent).toBe('ABCD 2345')
    expect(codigo.querySelector('p.sr-only')?.textContent).toBe('A B C D, 2 3 4 5')
    expect((within(dialogo()).getByLabelText('Link da sala') as HTMLInputElement).value).toBe(`${window.location.origin}/e/escola-sintetica/turma#${TOKEN}`)
    expect(within(dialogo()).getByText(`Vale até ${formatDateTime(GERADO.expiraEm)}. Depois de fechar, o link e o código não aparecem de novo.`)).toBeTruthy()
  })

  it('fechar sem ter copiado pergunta antes, pelo botão e pelo Esc, e "Voltar ao acesso" devolve o mesmo link e código; o segundo pedido de fechar fecha', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const { espioes } = await gerarPrimeiro(rede, usuario)

    await usuario.click(within(dialogo()).getByRole('button', { name: 'Fechar' }))
    const pergunta = await screen.findByRole('heading', { name: 'Fechar sem copiar o link?' })
    expect(pergunta).toBe(document.activeElement)
    expect(espioes.aoFechar).not.toHaveBeenCalled()
    // Atrás da pergunta não fica a página: a janela continua inteira, e o código não está na tela.
    expect(dialogo().className).toContain('bg-fundo')
    expect(within(dialogo()).queryByRole('group', { name: 'Código da turma' })).toBeNull()
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Voltar ao acesso' }))
    expect(await screen.findByRole('heading', { name: 'Acesso gerado' })).toBeTruthy()
    expect(within(dialogo()).getByRole('group', { name: 'Código da turma' }).querySelector('p[aria-hidden="true"]')?.textContent).toBe('ABCD 2345')

    // O Esc é o evento `cancel`: o primeiro pergunta, o segundo (na pergunta) fecha.
    fireEvent(dialogo(), new Event('cancel', { cancelable: true }))
    await screen.findByRole('heading', { name: 'Fechar sem copiar o link?' })
    expect(espioes.aoFechar).not.toHaveBeenCalled()
    fireEvent(dialogo(), new Event('cancel', { cancelable: true }))
    expect(espioes.aoFechar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('copiado o link, fechar já não pergunta; sem área de transferência, nada foi copiado e fechar ainda pergunta', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const escrever = vi.fn().mockResolvedValue(undefined)
    const { espioes } = await gerarPrimeiro(rede, usuario)

    // Sem `navigator.clipboard` (o `user-event` instala um): o campo é selecionado, o texto pede a cópia à mão, e o pedido de fechar ainda pergunta.
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Copiar link' }))
    expect(await within(dialogo()).findByText(/O link está selecionado no campo/)).toBeTruthy()
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Fechar' }))
    await screen.findByRole('heading', { name: 'Fechar sem copiar o link?' })
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Voltar ao acesso' }))

    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true })
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Copiar link' }))
    expect(escrever).toHaveBeenCalledWith(`${window.location.origin}/e/escola-sintetica/turma#${TOKEN}`)
    expect(await within(dialogo()).findByText('Link copiado.')).toBeTruthy()
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Fechar' }))
    expect(espioes.aoFechar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('heading', { name: 'Fechar sem copiar o link?' })).toBeNull()
  })

  it('o link e o código aparecem uma vez: o diálogo aberto de novo mostra só a validade, e nada deles fica na página', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const primeira = await gerarPrimeiro(rede, usuario)
    expect((within(dialogo()).getByLabelText('Link da sala') as HTMLInputElement).value).toContain(TOKEN)

    await usuario.click(within(dialogo()).getByRole('button', { name: 'Fechar' }))
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Fechar sem copiar' }))
    expect(primeira.espioes.aoFechar).toHaveBeenCalledTimes(1)
    for (const segredo of [TOKEN, CODIGO, 'ABCD 2345']) expect(document.body.innerHTML).not.toContain(segredo)

    // Outra abertura é outra instância, com a leitura do acesso que o servidor tem: só até quando vale.
    primeira.unmount()
    rede.responder(ok(VIGENTE))
    montar(primeira.cliente)
    expect(await within(dialogo()).findByText(`Vale até ${formatDateTime(VIGENTE.expiraEm)}.`)).toBeTruthy()
    for (const segredo of [TOKEN, CODIGO, 'ABCD 2345']) expect(document.body.innerHTML).not.toContain(segredo)
    expect(within(dialogo()).queryByRole('textbox')).toBeNull()
    expect(within(dialogo()).queryByRole('heading', { name: 'Acesso gerado' })).toBeNull()
  })

  it('o CONFLITO do gerar diz que outro acesso passou a valer, com o foco no aviso, e deixa só "Fechar": a validade não se escolhe mais', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responder(ok(SEM_ACESSO))
    rede.responder(erro(409, 'CONFLITO'))
    rede.responder(ok(VIGENTE))
    montar()

    await usuario.click(await screen.findByRole('button', { name: 'Gerar acesso' }))
    const aviso = await within(dialogo()).findByRole('alert')
    expect(aviso.textContent).toBe(
      'Outro acesso para esta turma acabou de ser gerado, por outra pessoa ou em outra aba, e é ele que vale. A tela foi atualizada: se o link e o código não estão com você, gere um novo.',
    )
    expect(aviso).toBe(document.activeElement)
    expect(within(dialogo()).getAllByRole('button').map((botao) => botao.textContent)).toEqual(['Fechar'])
    expect(radios().every((radio) => radio.matches(':disabled'))).toBe(true)
    expect(within(dialogo()).queryByText(/CONFLITO/)).toBeNull()
    // O passo não troca debaixo da recusa: a leitura trouxe o acesso do outro, e o diálogo continua em "Gerar acesso".
    expect(titulo().textContent).toBe('Gerar acesso')
  })
})

describe('Convidar alunos: gerar novo e revogar, cada um com a pergunta de hoje', () => {
  it('"Gerar novo acesso" leva ao passo que diz o que cai, com o título do passo e o foco no texto; nada sai antes de confirmar', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responder(ok(VIGENTE))
    montar()

    await usuario.click(await within(dialogo()).findByRole('button', { name: 'Gerar novo acesso' }))
    expect(titulo().textContent).toBe('Gerar novo acesso')
    expect(within(dialogo()).getByText(TEXTO_DO_ACESSO_QUE_CAI)).toBe(document.activeElement)
    expect(radios().map((radio) => (radio as HTMLInputElement).checked)).toEqual([false, true, false])
    expect(within(dialogo()).getAllByRole('button').map((botao) => botao.textContent)).toEqual(['Gerar novo acesso', 'Cancelar'])
    expect(gravacoes()).toEqual([])

    rede.responder(ok(GERADO))
    rede.responder(ok({ expiraEm: GERADO.expiraEm }))
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Gerar novo acesso' }))
    expect(await screen.findByRole('heading', { name: 'Acesso gerado' })).toBeTruthy()
    expect(titulo().textContent).toBe('Gerar novo acesso')
    expect(gerares()).toHaveLength(1)
  })

  it('"Cancelar" no passo de gerar novo fecha o diálogo, e nada é gravado', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responder(ok(VIGENTE))
    const { espioes } = montar()

    await usuario.click(await within(dialogo()).findByRole('button', { name: 'Gerar novo acesso' }))
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    expect(espioes.aoFechar).toHaveBeenCalledTimes(1)
    expect(gravacoes()).toEqual([])
  })

  it('"Revogar o acesso" leva ao passo que diz o que acontece, com o foco no texto; confirmar revoga uma vez e avisa a seção', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responder(ok(VIGENTE))
    const { espioes } = montar()

    await usuario.click(await within(dialogo()).findByRole('button', { name: 'Revogar o acesso' }))
    expect(titulo().textContent).toBe('Revogar o acesso')
    expect(within(dialogo()).getByText(TEXTO_DO_REVOGAR)).toBe(document.activeElement)
    expect(gravacoes()).toEqual([])

    rede.responder(SEM_CORPO)
    rede.responder(ok(SEM_ACESSO))
    const confirmar = within(dialogo()).getByRole('button', { name: 'Revogar acesso' })
    act(() => {
      confirmar.click()
      confirmar.click()
    })
    await waitFor(() => expect(espioes.aoRevogar).toHaveBeenCalledTimes(1))
    expect(gravacoes()).toEqual([{ caminho: `/v1/turmas/${TURMA}/acesso/revogar`, corpo: {} }])
    expect(espioes.aoFechar).not.toHaveBeenCalled()
  })

  it('o revogar do acesso que já não vale diz que a turma não tem acesso ativo, com o foco no aviso, e deixa só "Fechar"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responder(ok(VIGENTE))
    const { espioes } = montar()

    await usuario.click(await within(dialogo()).findByRole('button', { name: 'Revogar o acesso' }))
    rede.responder(erro(404, 'NAO_ENCONTRADO'))
    rede.responder(ok(SEM_ACESSO))
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Revogar acesso' }))

    const aviso = await within(dialogo()).findByRole('alert')
    expect(aviso.textContent).toBe('Esta turma já não tem acesso ativo. A tela foi atualizada.')
    expect(aviso).toBe(document.activeElement)
    expect(within(dialogo()).getAllByRole('button').map((botao) => botao.textContent)).toEqual(['Fechar'])
    expect(espioes.aoRevogar).not.toHaveBeenCalled()
    // O acesso foi relido sem nada vigente, e o diálogo continua no passo do revogar, dizendo o que houve.
    expect(titulo().textContent).toBe('Revogar o acesso')
  })

  it('o acesso que outra pessoa revogou com o passo "Vigente" na tela vira "Gerar acesso" quando a leitura se atualiza', async () => {
    const rede = fakeNetwork()
    rede.responder(ok(VIGENTE))
    const { cliente } = montar()
    await within(dialogo()).findByText(`Vale até ${formatDateTime(VIGENTE.expiraEm)}.`)

    rede.responder(ok(SEM_ACESSO))
    await act(async () => {
      await cliente.invalidateQueries({ queryKey: acessoDaTurmaQueryOptions(TURMA).queryKey })
    })
    await waitFor(() => expect(titulo().textContent).toBe('Gerar acesso'))
    expect(within(dialogo()).queryByRole('button', { name: 'Revogar o acesso' })).toBeNull()
    expect(within(dialogo()).getByRole('button', { name: 'Gerar acesso' })).toBeTruthy()
  })
})
