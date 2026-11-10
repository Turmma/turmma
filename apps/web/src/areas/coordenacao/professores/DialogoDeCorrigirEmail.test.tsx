// @vitest-environment jsdom
import { MENSAGENS_DE_ERRO, type EstadoDoProfessor } from '@educa/shared'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeNetwork, setupScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import { createQueryClient } from '../../../api/query-client'
import { TEXTO_DO_EMAIL_INVALIDO } from '../../../components/pedido-de-convite'
import { TEXTO_DO_CONVITE_QUE_MUDOU, TEXTO_DO_CONVITE_QUE_NAO_VALE } from '../../../components/textos-do-convite'
import { mutacaoDaCorrecaoDoEmail } from './api/professores'
import { TEXTO_DO_EMAIL_QUE_NAO_SERVE } from './convite-de-professor'
import { DialogoDeCorrigirEmail } from './DialogoDeCorrigirEmail'

/**
 * O diálogo "Corrigir o e-mail" (acesso-e-convites, 19.0; RF18; `cenarios.md`, "Telas", linha "Corrigir o e-mail"): o campo, o pedido, o link uma vez, "Enviar por
 * e-mail" e as falhas. O diálogo é o de verdade, com a mutação de `api/professores.ts` e a rede falsa; o que a tela decide com a lista relida (o `estadoAgora`) entra pela
 * prop, e a ligação com a tela e com o painel é de `Professores.test.tsx`. O que só o navegador mede (o foco no `<dialog>` modal, o celular de 360 px, o
 * clique duplo no navegador real, o e-mail que chega) é do e2e `professores-envio`.
 */
setupScreen()

const USUARIO = '0197a1c0-0000-7000-8000-000000000301'
const CONVITE = '0197a1c0-0000-7000-8000-000000000302'
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde'
const CORRIGIR = /^\/v1\/professores\/[^/]+\/email$/
const ERRO = (codigo: string, status: number): FakeResponse => ({
  status,
  corpo: { erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } },
})
const ACEITO: FakeResponse = { status: 200, corpo: { usuarioId: USUARIO, conviteId: CONVITE, token: TOKEN } }
/** O que a tela nunca diz: ela fala da conta e do convite, e não de quem usa ou deixa de usar a IA (D64; regra 70, item 9). */
const FALA_DO_USO = /\b(uso|usa|usar|usou|usam|usado|adoção|adesão|IA|inteligência)\b/i

beforeEach(() => {
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

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  window.localStorage.clear()
})

interface Opcoes {
  readonly estadoAgora?: EstadoDoProfessor | undefined
  readonly aoTerminar?: () => Promise<void>
}

/** O diálogo aberto, no cliente de consultas que o teste guarda para olhar o cache. */
function montar(opcoes: Opcoes = {}) {
  // `estadoAgora: undefined` é o professor que saiu da lista, e não o padrão.
  const estadoAgora = 'estadoAgora' in opcoes ? opcoes.estadoAgora : 'pendente'
  const { aoTerminar } = opcoes
  const cliente = createQueryClient()
  const aoFechar = vi.fn()
  const aoEnviarPorEmail = vi.fn()
  const focoDeReserva = vi.fn()
  const tela = (estado: EstadoDoProfessor | undefined) => (
    <QueryClientProvider client={cliente}>
      <DialogoDeCorrigirEmail
        nome="Bruno Sintético"
        estadoAgora={estado}
        mutacao={mutacaoDaCorrecaoDoEmail(USUARIO, aoTerminar)}
        aoEnviarPorEmail={aoEnviarPorEmail}
        aoFechar={aoFechar}
        focoDeReserva={focoDeReserva}
      />
    </QueryClientProvider>
  )
  const { rerender } = render(tela(estadoAgora))
  return { cliente, aoFechar, aoEnviarPorEmail, mudarEstado: (estado: EstadoDoProfessor | undefined) => rerender(tela(estado)) }
}

const dialogo = () => screen.getByRole('dialog', { name: 'Corrigir o e-mail' })
const campo = () => within(dialogo()).getByLabelText(/E-mail certo/)
const botao = (nome: string) => within(dialogo()).getByRole('button', { name: nome })
/** Os corpos dos pedidos de correção, na ordem. */
const corposDoPedido = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([caminho, opcoes]) => CORRIGIR.test(String(caminho)) && opcoes?.method === 'POST')
    .map(([, opcoes]) => JSON.parse(String(opcoes?.body)) as unknown)
const pedidos = (rede: FakeNetwork) => rede.chamadas.filter((chamada) => CORRIGIR.test(chamada.caminho))

async function digitarEEnviar(usuario: ReturnType<typeof userEvent.setup>, email: string, rotulo = 'Corrigir o e-mail') {
  await usuario.clear(campo())
  await usuario.type(campo(), email)
  await usuario.click(botao(rotulo))
}

describe('o campo do e-mail certo', () => {
  it('abre com o campo vazio, sem o e-mail de hoje, com a linha "O link anterior deixa de valer." e `autocomplete="off"`', () => {
    montar()
    expect(dialogo().textContent).toContain('O link anterior deixa de valer.')
    expect((campo() as HTMLInputElement).value).toBe('')
    expect(campo().getAttribute('autocomplete')).toBe('off')
    expect(campo().getAttribute('type')).toBe('email')
    expect(dialogo().textContent).not.toMatch(/@/)
    expect(within(dialogo()).getByText('Bruno Sintético')).toBeTruthy()
    // Antes de qualquer pedido não há falha: nem aviso, nem erro no campo.
    expect(within(dialogo()).queryByRole('alert')).toBeNull()
    expect(campo().getAttribute('aria-invalid')).not.toBe('true')
  })

  it('o texto da tela fala da conta e do convite, nunca do uso da IA (D64), nem no campo nem no aviso do e-mail que não serve', () => {
    montar()
    expect(dialogo().textContent).not.toMatch(FALA_DO_USO)
    expect(TEXTO_DO_EMAIL_QUE_NAO_SERVE).not.toMatch(FALA_DO_USO)
  })

  it('e-mail fora do formato: o texto do cadastro no campo, e nenhum pedido sai', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    montar()
    await digitarEEnviar(usuario, 'sem-arroba')
    expect(within(dialogo()).getByText(TEXTO_DO_EMAIL_INVALIDO)).toBeTruthy()
    expect(campo().getAttribute('aria-invalid')).toBe('true')
    expect(pedidos(rede)).toHaveLength(0)
    // Corrigir o que digitou apaga o aviso.
    await usuario.type(campo(), '@escola.invalid')
    expect(within(dialogo()).queryByText(TEXTO_DO_EMAIL_INVALIDO)).toBeNull()
  })
})

describe('o pedido', () => {
  it('sai com o e-mail sem as pontas e em minúsculas, para o professor do diálogo, e relê a lista depois (dê certo ou não)', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor(CORRIGIR, ACEITO)
    const aoTerminar = vi.fn(() => Promise.resolve())
    montar({ aoTerminar })
    await digitarEEnviar(usuario, '  Bruno.Certo@Escola.Invalid ')
    await screen.findByText('E-mail corrigido')
    expect(corposDoPedido()).toEqual([{ email: 'bruno.certo@escola.invalid' }])
    expect(pedidos(rede).map((chamada) => chamada.caminho)).toEqual([`/v1/professores/${USUARIO}/email`])
    expect(aoTerminar).toHaveBeenCalledTimes(1)
  })

  it('com o pedido no ar o botão fica ocupado e diz "Corrigindo…"; o clique duplo manda um pedido só', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const segurada = rede.segurar()
    montar()
    await usuario.type(campo(), 'certo@escola.invalid')
    await usuario.dblClick(botao('Corrigir o e-mail'))
    await waitFor(() => expect(within(dialogo()).getByRole('button', { name: 'Corrigindo…' }).hasAttribute('disabled')).toBe(true))
    expect(within(dialogo()).getByRole('status').textContent).toBe('Corrigindo o e-mail…')
    expect(pedidos(rede)).toHaveLength(1)
    segurada.liberar(ACEITO)
    await screen.findByText('E-mail corrigido')
    expect(pedidos(rede)).toHaveLength(1)
  })

  it('o segundo envio que chega antes de a tela desligar o botão (o mesmo quadro) não manda um segundo pedido: quem trava é o pedido no ar, e não o botão', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const segurada = rede.segurar()
    montar()
    await usuario.type(campo(), 'certo@escola.invalid')
    const formulario = campo().closest('form') as HTMLFormElement
    // Dentro de um `act` o React só redesenha ao sair: os dois envios veem o botão ainda ligado, como o clique duplo mais rápido que o quadro.
    act(() => {
      formulario.requestSubmit()
      formulario.requestSubmit()
    })
    await waitFor(() => expect(pedidos(rede)).toHaveLength(1))
    segurada.liberar(ACEITO)
    await screen.findByText('E-mail corrigido')
    expect(pedidos(rede)).toHaveLength(1)
  })

  it('fechar com o pedido no ar pergunta antes, dizendo que o link aparece uma vez só, e o pedido que volta com o diálogo fechado não deixa o link', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const segurada = rede.segurar()
    const { aoFechar, cliente } = montar()
    await usuario.type(campo(), 'certo@escola.invalid')
    await usuario.click(botao('Corrigir o e-mail'))
    await waitFor(() => expect(pedidos(rede)).toHaveLength(1))
    await usuario.click(botao('Cancelar'))
    expect(aoFechar).not.toHaveBeenCalled()
    expect(within(dialogo()).getByRole('heading', { name: 'Fechar sem copiar o link?' })).toBeTruthy()
    expect(dialogo().textContent).toContain('O e-mail ainda está sendo corrigido, e o link aparece uma vez só, aqui.')
    expect(document.activeElement).toBe(within(dialogo()).getByRole('heading', { name: 'Fechar sem copiar o link?' }))
    await usuario.click(botao('Fechar sem copiar'))
    expect(aoFechar).toHaveBeenCalledTimes(1)
    segurada.liberar(ACEITO)
    await waitFor(() => expect(cliente.getMutationCache().getAll()).toEqual([]))
  })
})

describe('o sucesso: o link, uma vez', () => {
  async function corrigido() {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor(CORRIGIR, ACEITO)
    const ambiente = montar()
    await usuario.type(campo(), 'certo@escola.invalid')
    await usuario.click(botao('Corrigir o e-mail'))
    await screen.findByText('E-mail corrigido')
    return { usuario, rede, ...ambiente }
  }

  it('diz "E-mail corrigido", a quem mandar e com que e-mail ela entra, e mostra o link do convite novo com "Copiar link"', async () => {
    await corrigido()
    expect(dialogo().textContent).toContain('Mande o link a Bruno Sintético, que passa a entrar com o e-mail certo@escola.invalid.')
    expect(dialogo().textContent).toContain('O link anterior deixou de valer.')
    const link = within(dialogo()).getByLabelText('Link do convite') as HTMLInputElement
    expect(link.readOnly).toBe(true)
    expect(link.value).toBe(`${window.location.origin}/convite#${TOKEN}`)
    expect(botao('Copiar link')).toBeTruthy()
    expect(botao('Enviar por e-mail')).toBeTruthy()
    // O foco acompanha a etapa: vai ao título do link. O campo do e-mail sai com a etapa dele: o diálogo mostra uma etapa só.
    expect(document.activeElement).toBe(within(dialogo()).getByRole('heading', { name: 'E-mail corrigido' }))
    expect(within(dialogo()).queryByLabelText(/E-mail certo/)).toBeNull()
  })

  it('o texto do link fala da conta e do convite, nunca do uso da IA (D64)', async () => {
    await corrigido()
    expect(dialogo().textContent).not.toMatch(FALA_DO_USO)
  })

  it('"Copiar link" copia o link inteiro e diz "Link copiado."', async () => {
    const { usuario } = await corrigido()
    await usuario.click(botao('Copiar link'))
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/convite#${TOKEN}`)
    expect(within(dialogo()).getByText('Link copiado.')).toBeTruthy()
  })

  it('o link não vai ao endereço nem ao armazenamento do navegador, e fechar o tira do diálogo e do cache de mutações', async () => {
    const { usuario, cliente, aoFechar } = await corrigido()
    expect(window.location.href).not.toContain(TOKEN)
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(TOKEN)
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain(TOKEN)
    // Nenhuma consulta guarda o link: ele só existe na mutação deste diálogo.
    expect(JSON.stringify(cliente.getQueryCache().getAll().map((consulta) => consulta.state))).not.toContain(TOKEN)
    expect(cliente.getMutationCache().getAll()).toHaveLength(1)
    await usuario.click(botao('Copiar link'))
    await usuario.click(botao('Fechar'))
    expect(aoFechar).toHaveBeenCalledTimes(1)
    // Fechar solta a mutação (`reset`), e com o `gcTime: 0` ela sai do cache: nem o link nem o e-mail novo ficam.
    await waitFor(() => expect(cliente.getMutationCache().getAll()).toEqual([]))
  })

  it('fechar com o link sem copiar pergunta antes; "Voltar ao e-mail" mantém o link, e "Fechar sem copiar" fecha', async () => {
    const { usuario, aoFechar } = await corrigido()
    await usuario.click(botao('Fechar'))
    expect(aoFechar).not.toHaveBeenCalled()
    expect(within(dialogo()).getByRole('heading', { name: 'Fechar sem copiar o link?' })).toBeTruthy()
    expect(dialogo().textContent).toContain('O link aparece uma vez só. Se fechar agora')
    // A pergunta é a etapa inteira: nem o link nem o campo ficam ao lado dela.
    expect(within(dialogo()).queryByLabelText('Link do convite')).toBeNull()
    expect(within(dialogo()).queryByLabelText(/E-mail certo/)).toBeNull()
    await usuario.click(botao('Voltar ao e-mail'))
    expect((within(dialogo()).getByLabelText('Link do convite') as HTMLInputElement).value).toContain(TOKEN)
    await usuario.click(botao('Fechar'))
    await usuario.click(botao('Fechar sem copiar'))
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('"Enviar por e-mail" entrega a tela ao "Reenviar" sem perguntar, e solta o link', async () => {
    const { usuario, cliente, aoEnviarPorEmail, aoFechar } = await corrigido()
    await usuario.click(botao('Enviar por e-mail'))
    expect(aoEnviarPorEmail).toHaveBeenCalledTimes(1)
    // Quem fecha este diálogo é a tela, ao abrir o outro: aqui só se solta o link.
    expect(aoFechar).not.toHaveBeenCalled()
    await waitFor(() => expect(cliente.getMutationCache().getAll()).toEqual([]))
  })
})

describe('as falhas ficam dentro do diálogo', () => {
  it('a rede: o aviso diz o que fazer, com o foco nele; o botão vira "Tentar de novo" e a tentativa seguinte apaga o aviso', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let vez = 0
    // A segunda resposta fica no ar até o caso a soltar: o aviso tem de sair com o pedido ainda pendente, e não só quando o link chega.
    let liberar: (resposta: FakeResponse) => void = () => undefined
    const segunda = new Promise<FakeResponse>((resolver) => (liberar = resolver))
    rede.responderPor(CORRIGIR, () => (++vez === 1 ? ERRO('INDISPONIVEL_TENTE_DE_NOVO', 503) : segunda))
    montar()
    await digitarEEnviar(usuario, 'certo@escola.invalid')
    const aviso = await within(dialogo()).findByRole('alert')
    expect(aviso.textContent).toBe(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    await waitFor(() => expect(document.activeElement).toBe(aviso))
    // O que foi digitado fica, e o botão tenta de novo.
    expect((campo() as HTMLInputElement).value).toBe('certo@escola.invalid')
    await usuario.click(botao('Tentar de novo'))
    await waitFor(() => expect(botao('Corrigindo…').hasAttribute('disabled')).toBe(true))
    // Com o pedido no ar e o diálogo ainda no campo, o aviso da tentativa anterior já saiu.
    expect(within(dialogo()).queryByRole('alert')).toBeNull()
    expect(campo()).toBeTruthy()
    liberar(ACEITO)
    await screen.findByText('E-mail corrigido')
    expect(within(dialogo()).queryByRole('alert')).toBeNull()
    expect(vez).toBe(2)
  })

  it('`CONFLITO` com o professor ainda esperando o convite: o texto do e-mail que não serve, no campo, que segue com o foco, e o botão segue "Corrigir o e-mail"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let vez = 0
    rede.responderPor(CORRIGIR, () => (++vez === 1 ? ERRO('CONFLITO', 409) : ACEITO))
    const aoTerminar = vi.fn(() => Promise.resolve())
    montar({ estadoAgora: 'pendente', aoTerminar })
    await digitarEEnviar(usuario, 'de-outro@escola.invalid')
    expect(await within(dialogo()).findByText(TEXTO_DO_EMAIL_QUE_NAO_SERVE)).toBeTruthy()
    expect(campo().getAttribute('aria-invalid')).toBe('true')
    await waitFor(() => expect(document.activeElement).toBe(campo()))
    expect(within(dialogo()).queryByRole('alert')).toBeNull()
    expect(botao('Corrigir o e-mail').hasAttribute('disabled')).toBe(false)
    expect(aoTerminar).toHaveBeenCalledTimes(1)
    // Outro e-mail, outra tentativa: o aviso sai ao enviar, e o pedido seguinte leva o e-mail novo.
    await digitarEEnviar(usuario, 'certo@escola.invalid')
    await screen.findByText('E-mail corrigido')
    expect(corposDoPedido()).toEqual([{ email: 'de-outro@escola.invalid' }, { email: 'certo@escola.invalid' }])
  })

  it.each<[string, EstadoDoProfessor | undefined]>([
    ['aceito', 'aceito'],
    ['ativo', 'ativo'],
    ['revogado', 'revogado'],
    ['desativado', 'desativado'],
    ['fora da lista', undefined],
  ])('`CONFLITO` com o professor %s na lista relida: o texto do convite que mudou, sem o campo nem o botão, e só "Fechar"', async (_nome, estadoAgora) => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor(CORRIGIR, ERRO('CONFLITO', 409))
    montar({ estadoAgora })
    await digitarEEnviar(usuario, 'certo@escola.invalid')
    expect((await within(dialogo()).findByRole('alert')).textContent).toBe(TEXTO_DO_CONVITE_QUE_MUDOU)
    expect(within(dialogo()).queryByLabelText(/E-mail certo/)).toBeNull()
    expect(within(dialogo()).queryByRole('button', { name: /Corrigir o e-mail|Tentar de novo/ })).toBeNull()
    expect(botao('Fechar')).toBeTruthy()
  })

  it('o estado que a lista relida traz decide depois da resposta: o mesmo `CONFLITO` vira o do convite que mudou quando o professor saiu de `pendente`', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor(CORRIGIR, ERRO('CONFLITO', 409))
    const { mudarEstado } = montar({ estadoAgora: 'pendente' })
    await digitarEEnviar(usuario, 'certo@escola.invalid')
    expect(await within(dialogo()).findByText(TEXTO_DO_EMAIL_QUE_NAO_SERVE)).toBeTruthy()
    mudarEstado('revogado')
    expect((await within(dialogo()).findByRole('alert')).textContent).toBe(TEXTO_DO_CONVITE_QUE_MUDOU)
  })

  it('`NAO_ENCONTRADO`: o texto do convite que não vale, qualquer que seja o estado da lista, e só "Fechar"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor(CORRIGIR, ERRO('NAO_ENCONTRADO', 404))
    montar({ estadoAgora: 'pendente' })
    await digitarEEnviar(usuario, 'certo@escola.invalid')
    expect((await within(dialogo()).findByRole('alert')).textContent).toBe(TEXTO_DO_CONVITE_QUE_NAO_VALE)
    expect(within(dialogo()).queryByLabelText(/E-mail certo/)).toBeNull()
    // Sem o botão que envia, com qualquer dos dois nomes: depois da falha ele passaria a "Tentar de novo".
    expect(within(dialogo()).queryByRole('button', { name: /^(Corrigir o e-mail|Tentar de novo)$/ })).toBeNull()
    expect(botao('Fechar')).toBeTruthy()
  })
})
