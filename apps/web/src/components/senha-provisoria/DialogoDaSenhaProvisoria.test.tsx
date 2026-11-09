// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../api/query-client'
import { TEST_AUTHORIZATION, setupScreen, fakeNetwork, type FakeNetwork, type FakeResponse } from '../../__fixtures__/render-screen'
import type * as Sessao from '../../api/sessao'
import { DialogoDaSenhaProvisoria } from './DialogoDaSenhaProvisoria'

/**
 * O diálogo "Gerar senha provisória" (acesso-e-convites, 12.0; RF13, RF18): a confirmação que lê o aluno ao abrir, a senha que aparece uma vez, a pergunta de fechar sem copiar e o que fica
 * (nada) fora do diálogo. A rede é falsa e responde na ordem dos pedidos (a leitura do alvo, depois a geração); o diálogo, a mutação, o cliente de consultas e a sessão são os de verdade. A
 * troca de sessão é a do módulo `api/sessao`, com o `aoTrocarDeSessao` capturado para o caso a disparar sem encerrar a sessão do arquivo. O que só o navegador mede é do e2e `senha-provisoria`.
 */
setupScreen()

const ouvintesDaTrocaDeSessao: Array<() => void> = []
vi.mock('../../api/sessao', async (importarOriginal) => {
  const original = await importarOriginal<typeof Sessao>()
  return {
    ...original,
    aoTrocarDeSessao: (ouvinte: () => void) => {
      ouvintesDaTrocaDeSessao.push(ouvinte)
      return () => {
        ouvintesDaTrocaDeSessao.splice(ouvintesDaTrocaDeSessao.indexOf(ouvinte), 1)
      }
    },
  }
})

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const ALUNO = id(1)
const OUTRO_ALUNO = id(2)
const CAMINHO = (usuarioId: string) => `/v1/usuarios/${usuarioId}/senha-provisoria`
const ALVO = { nome: 'Ana Souza', turma: '7º A', matricula: '2026001', entraPelaContaDaEscola: false }
const SENHA = { senha: 'ABCD-2345', expiraEm: '2026-11-10T17:05:00.000Z' }
const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
const LIMITE = erro(429, 'LIMITE_EXCEDIDO')

beforeEach(() => {
  ouvintesDaTrocaDeSessao.length = 0
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

/** A área de transferência do navegador, que o `jsdom` não tem. */
function areaDeTransferencia(): ReturnType<typeof vi.fn> {
  const escrever = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true })
  return escrever
}

interface Pedido {
  readonly usuarioId?: string
  readonly aoFechar?: () => void
  readonly aoPerderOAluno?: () => void
}

function montar({ usuarioId = ALUNO, aoFechar = () => undefined, aoPerderOAluno = () => undefined }: Pedido = {}) {
  const cliente = createQueryClient()
  const tela = render(
    <QueryClientProvider client={cliente}>
      <DialogoDaSenhaProvisoria usuarioId={usuarioId} aoFechar={aoFechar} aoPerderOAluno={aoPerderOAluno} focoDeReserva={() => undefined} />
    </QueryClientProvider>,
  )
  return { cliente, ...tela }
}

const dialogo = () => within(screen.getByRole('dialog', { name: 'Gerar senha provisória' }))
const botaoGerar = () => dialogo().getByRole('button', { name: /^(Gerar senha provisória|Gerando…)$/ })
const posts = (rede: FakeNetwork) => rede.chamadas.filter((chamada) => chamada.metodo === 'POST')

/** Abre o diálogo com o aluno lido e espera a confirmação: o caso começa daqui, com a resposta da geração preparada por ele. */
async function abrirComAlvo(rede: FakeNetwork, alvo: Record<string, unknown> = ALVO, pedido: Pedido = {}) {
  rede.responder(ok(alvo))
  const tela = montar(pedido)
  await dialogo().findByText(String(alvo.nome))
  return tela
}

describe('a confirmação: o aluno lido ao abrir', () => {
  it('lê o aluno ao abrir, com a sessão, e mostra o nome, a turma e a matrícula; "Gerar" fica ocupado enquanto lê', async () => {
    const rede = fakeNetwork()
    const leitura = rede.segurar()
    montar()

    expect(await dialogo().findByText('Carregando…')).toBeTruthy()
    expect(botaoGerar().hasAttribute('disabled')).toBe(true)
    expect(botaoGerar().getAttribute('aria-busy')).toBe('true')
    expect(rede.chamadas).toEqual([{ caminho: CAMINHO(ALUNO), metodo: 'GET', autorizacao: TEST_AUTHORIZATION }])

    leitura.liberar(ok(ALVO))
    expect(await dialogo().findByText('Ana Souza')).toBeTruthy()
    expect(dialogo().getByText('7º A')).toBeTruthy()
    expect(dialogo().getByText('2026001')).toBeTruthy()
    expect(dialogo().queryByText('Carregando…')).toBeNull()
    expect(botaoGerar().hasAttribute('disabled')).toBe(false)
    expect(botaoGerar().getAttribute('aria-busy')).toBe('false')
  })

  it('diz a consequência antes de gerar: a senha atual deixa de valer e o aluno sai da conta em todo lugar', async () => {
    await abrirComAlvo(fakeNetwork())

    expect(dialogo().getByText('A senha atual deixa de valer, e o aluno sai da conta em todo lugar.')).toBeTruthy()
    expect(dialogo().getByText(/vale 24 horas, aparece uma vez só/)).toBeTruthy()
  })

  it('sem turma a linha da turma some, e sem matrícula a da matrícula', async () => {
    await abrirComAlvo(fakeNetwork(), { ...ALVO, turma: null, matricula: null })

    expect(dialogo().getByText('Aluno')).toBeTruthy()
    expect(dialogo().queryByText('Turma')).toBeNull()
    expect(dialogo().queryByText('Matrícula')).toBeNull()
  })

  it('o aluno que entra pela conta da escola: o aviso já na confirmação, sem "Gerar" e sem pedido de geração', async () => {
    const rede = fakeNetwork()
    await abrirComAlvo(rede, { ...ALVO, matricula: null, entraPelaContaDaEscola: true })

    expect(dialogo().getByText('Este aluno entra pela conta da escola. Não precisa de senha.')).toBeTruthy()
    expect(dialogo().queryByRole('button', { name: 'Gerar senha provisória' })).toBeNull()
    expect(dialogo().queryByText(/A senha atual deixa de valer/)).toBeNull()
    expect(dialogo().getByRole('button', { name: 'Fechar' })).toBeTruthy()
    expect(posts(rede)).toHaveLength(0)
  })

  it('a leitura que falhou: o erro com "Tentar de novo", sem "Gerar"; tentar de novo lê outra vez e mostra o aluno', async () => {
    const rede = fakeNetwork()
    rede.responder(LIMITE)
    montar()

    expect(await dialogo().findByRole('alert')).toBeTruthy()
    expect(dialogo().queryByRole('button', { name: 'Gerar senha provisória' })).toBeNull()
    rede.responder(ok(ALVO))
    await userEvent.click(dialogo().getByRole('button', { name: 'Tentar de novo' }))

    expect(await dialogo().findByText('Ana Souza')).toBeTruthy()
    expect(dialogo().queryByRole('alert')).toBeNull()
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'GET')).toHaveLength(2)
  })

  it('o aluno que sumiu na leitura (404): avisa quem abriu, e o diálogo não mostra erro nem aluno', async () => {
    const rede = fakeNetwork()
    rede.responder(erro(404, 'NAO_ENCONTRADO'))
    const aoPerderOAluno = vi.fn()
    montar({ aoPerderOAluno })

    await waitFor(() => expect(aoPerderOAluno).toHaveBeenCalledTimes(1))
    expect(dialogo().queryByRole('alert')).toBeNull()
    expect(dialogo().queryByRole('button', { name: 'Gerar senha provisória' })?.hasAttribute('disabled')).toBe(true)
  })

  it('o 404 da leitura que chega depois de o diálogo fechar não avisa a tela: o aviso é de quem ainda está com o aluno aberto', async () => {
    const rede = fakeNetwork()
    const leitura = rede.segurar()
    const aoPerderOAluno = vi.fn()
    const tela = montar({ aoPerderOAluno })
    await waitFor(() => expect(rede.chamadas).toHaveLength(1))
    tela.unmount()

    await act(async () => {
      leitura.liberar(erro(404, 'NAO_ENCONTRADO'))
      await Promise.resolve()
    })

    expect(aoPerderOAluno).not.toHaveBeenCalled()
  })

  it('a leitura que falha por outro motivo não conta como aluno que sumiu: o erro com "Tentar de novo", e a tela não é avisada', async () => {
    const rede = fakeNetwork()
    rede.responder(erro(500, 'ERRO_INTERNO'))
    const aoPerderOAluno = vi.fn()
    montar({ aoPerderOAluno })

    expect(await dialogo().findByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(aoPerderOAluno).not.toHaveBeenCalled()
  })
})

describe('a geração: a senha, uma vez', () => {
  it('manda o POST do aluno, sem corpo, e mostra a senha em dois grupos, com a validade e o texto soletrado para o leitor de tela', async () => {
    const rede = fakeNetwork()
    await abrirComAlvo(rede)
    rede.responder(ok(SENHA))
    await userEvent.click(botaoGerar())

    expect(await dialogo().findByText('ABCD-2345')).toBeTruthy()
    expect(posts(rede)).toEqual([{ caminho: CAMINHO(ALUNO), metodo: 'POST', autorizacao: TEST_AUTHORIZATION }])
    expect(dialogo().getByText('ABCD-2345').closest('[aria-hidden="true"]')).toBeTruthy()
    // O leitor de tela ouve a senha grupo a grupo, caractere a caractere.
    expect(dialogo().getByText('A B C D, 2 3 4 5')).toBeTruthy()
    expect(dialogo().getByText(/Ela vale até \d{2}\/\d{2}\/2026 às \d{2}:\d{2} e aparece uma vez só/)).toBeTruthy()
    expect(dialogo().getByRole('heading', { name: 'Senha provisória de Ana Souza' })).toBeTruthy()
    expect(dialogo().queryByText(/Confira quem é o aluno/)).toBeNull()
  })

  it('"Copiar" copia a senha como a tela a mostra e diz "Senha copiada."', async () => {
    const escrever = areaDeTransferencia()
    const rede = fakeNetwork()
    await abrirComAlvo(rede)
    rede.responder(ok(SENHA))
    await userEvent.click(botaoGerar())
    await dialogo().findByText('ABCD-2345')
    await userEvent.click(dialogo().getByRole('button', { name: 'Copiar' }))

    expect(await dialogo().findByText('Senha copiada.')).toBeTruthy()
    expect(escrever).toHaveBeenCalledWith('ABCD-2345')
  })

  it('sem área de transferência: pede para anotar, não diz que copiou, e fechar ainda pergunta', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const rede = fakeNetwork()
    await abrirComAlvo(rede)
    rede.responder(ok(SENHA))
    await userEvent.click(botaoGerar())
    await dialogo().findByText('ABCD-2345')
    await userEvent.click(dialogo().getByRole('button', { name: 'Copiar' }))

    expect(await dialogo().findByText('Não foi possível copiar. Anote a senha que está na tela.')).toBeTruthy()
    expect(dialogo().queryByText('Senha copiada.')).toBeNull()
    await userEvent.click(dialogo().getByRole('button', { name: 'Fechar' }))
    expect(dialogo().getByRole('heading', { name: 'Fechar sem copiar a senha?' })).toBeTruthy()
  })

  it('o clique duplo em "Gerar" manda uma geração só', async () => {
    const rede = fakeNetwork()
    await abrirComAlvo(rede)
    const geracao = rede.segurar()
    const gerar = botaoGerar()
    // Os dois cliques chegam antes de a tela se redesenhar com o botão ocupado: só o `noAr` da geração os distingue.
    await act(async () => {
      gerar.click()
      gerar.click()
    })

    await waitFor(() => expect(botaoGerar().textContent).toBe('Gerando…'))
    expect(botaoGerar().hasAttribute('disabled')).toBe(true)
    expect(dialogo().getByRole('status').textContent).toBe('Gerando a senha provisória…')
    geracao.liberar(ok(SENHA))
    await dialogo().findByText('ABCD-2345')
    expect(posts(rede)).toHaveLength(1)
  })
})

describe('as falhas da geração', () => {
  it('CONFLITO diz para esperar alguns segundos, e a confirmação continua com "Gerar"', async () => {
    const rede = fakeNetwork()
    await abrirComAlvo(rede)
    rede.responder(erro(409, 'CONFLITO'))
    await userEvent.click(botaoGerar())

    expect((await dialogo().findByRole('alert')).textContent).toBe('Esta senha acabou de ser gerada. Espere alguns segundos para gerar outra.')
    expect(botaoGerar().hasAttribute('disabled')).toBe(false)
  })

  it('429 diz para esperar alguns minutos; o aviso sai na nova tentativa', async () => {
    const rede = fakeNetwork()
    await abrirComAlvo(rede)
    rede.responder(LIMITE)
    await userEvent.click(botaoGerar())
    expect((await dialogo().findByRole('alert')).textContent).toBe('Muitas tentativas. Espere alguns minutos e tente de novo.')

    const nova = rede.segurar()
    await userEvent.click(botaoGerar())
    await waitFor(() => expect(dialogo().queryByRole('alert')).toBeNull())
    nova.liberar(ok(SENHA))
    expect(await dialogo().findByText('ABCD-2345')).toBeTruthy()
  })

  it('ENTRA_PELA_CONTA_DA_ESCOLA na geração (outra pessoa ligou a conta depois da leitura): o aviso e sem "Gerar", não o erro vermelho', async () => {
    const rede = fakeNetwork()
    await abrirComAlvo(rede)
    rede.responder(erro(409, 'ENTRA_PELA_CONTA_DA_ESCOLA'))
    await userEvent.click(botaoGerar())

    expect(await dialogo().findByText('Este aluno entra pela conta da escola. Não precisa de senha.')).toBeTruthy()
    expect(dialogo().queryByRole('alert')).toBeNull()
    expect(dialogo().queryByRole('button', { name: 'Gerar senha provisória' })).toBeNull()
  })

  it('o aluno que sumiu na geração (404): avisa quem abriu', async () => {
    const rede = fakeNetwork()
    const aoPerderOAluno = vi.fn()
    await abrirComAlvo(rede, ALVO, { aoPerderOAluno })
    rede.responder(erro(404, 'NAO_ENCONTRADO'))
    await userEvent.click(botaoGerar())

    await waitFor(() => expect(aoPerderOAluno).toHaveBeenCalledTimes(1))
  })
})

describe('fechar com a senha na tela', () => {
  it('sem copiar, pergunta antes: "Voltar à senha" volta à senha, e "Fechar sem copiar" fecha de vez', async () => {
    const rede = fakeNetwork()
    const aoFechar = vi.fn()
    await abrirComAlvo(rede, ALVO, { aoFechar })
    rede.responder(ok(SENHA))
    await userEvent.click(botaoGerar())
    await dialogo().findByText('ABCD-2345')

    await userEvent.click(dialogo().getByRole('button', { name: 'Fechar' }))
    expect(aoFechar).not.toHaveBeenCalled()
    expect(dialogo().getByRole('heading', { name: 'Fechar sem copiar a senha?' })).toBeTruthy()
    expect(dialogo().getByText(/ela não aparece de novo, e será preciso gerar outra: a atual deixa de valer/)).toBeTruthy()
    await userEvent.click(dialogo().getByRole('button', { name: 'Voltar à senha' }))
    expect(dialogo().getByText('ABCD-2345')).toBeTruthy()
    expect(aoFechar).not.toHaveBeenCalled()

    await userEvent.click(dialogo().getByRole('button', { name: 'Fechar' }))
    await userEvent.click(dialogo().getByRole('button', { name: 'Fechar sem copiar' }))
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('o Esc e o toque fora da caixa pedem a mesma pergunta do botão "Fechar", e só "Fechar sem copiar" fecha', async () => {
    const rede = fakeNetwork()
    const aoFechar = vi.fn()
    await abrirComAlvo(rede, ALVO, { aoFechar })
    rede.responder(ok(SENHA))
    await userEvent.click(botaoGerar())
    await dialogo().findByText('ABCD-2345')
    const caixa = screen.getByRole('dialog', { name: 'Gerar senha provisória' })

    fireEvent(caixa, new Event('cancel', { cancelable: true }))
    expect(dialogo().getByRole('heading', { name: 'Fechar sem copiar a senha?' })).toBeTruthy()
    expect(aoFechar).not.toHaveBeenCalled()
    await userEvent.click(dialogo().getByRole('button', { name: 'Voltar à senha' }))
    expect(dialogo().getByText('ABCD-2345')).toBeTruthy()

    // O toque fora da caixa: o jsdom não tem layout, e todo ponto com coordenada positiva está fora da caixa de 0 × 0 do `dialog`.
    fireEvent.mouseDown(caixa, { clientX: 5, clientY: 5 })
    fireEvent.click(caixa, { clientX: 5, clientY: 5 })
    expect(dialogo().getByRole('heading', { name: 'Fechar sem copiar a senha?' })).toBeTruthy()
    expect(aoFechar).not.toHaveBeenCalled()
    await userEvent.click(dialogo().getByRole('button', { name: 'Fechar sem copiar' }))
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('na confirmação, sem senha em jogo, o Esc fecha na hora, sem perguntar', async () => {
    const rede = fakeNetwork()
    const aoFechar = vi.fn()
    await abrirComAlvo(rede, ALVO, { aoFechar })

    fireEvent(screen.getByRole('dialog', { name: 'Gerar senha provisória' }), new Event('cancel', { cancelable: true }))

    expect(aoFechar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('heading', { name: 'Fechar sem copiar a senha?' })).toBeNull()
  })

  it('depois de copiar, fecha na hora, sem perguntar', async () => {
    areaDeTransferencia()
    const rede = fakeNetwork()
    const aoFechar = vi.fn()
    await abrirComAlvo(rede, ALVO, { aoFechar })
    rede.responder(ok(SENHA))
    await userEvent.click(botaoGerar())
    await dialogo().findByText('ABCD-2345')
    await userEvent.click(dialogo().getByRole('button', { name: 'Copiar' }))
    await dialogo().findByText('Senha copiada.')
    await userEvent.click(dialogo().getByRole('button', { name: 'Fechar' }))

    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('com a geração no ar, fechar também pergunta, e a pergunta diz que a senha ainda não chegou', async () => {
    const rede = fakeNetwork()
    const aoFechar = vi.fn()
    await abrirComAlvo(rede, ALVO, { aoFechar })
    rede.segurar()
    await userEvent.click(botaoGerar())
    await userEvent.click(dialogo().getByRole('button', { name: 'Cancelar' }))

    expect(aoFechar).not.toHaveBeenCalled()
    expect(dialogo().getByText(/A senha ainda está sendo gerada/)).toBeTruthy()
  })

  it('cancelar a confirmação, sem gerar nada, fecha na hora e não manda geração', async () => {
    const rede = fakeNetwork()
    const aoFechar = vi.fn()
    await abrirComAlvo(rede, ALVO, { aoFechar })
    await userEvent.click(dialogo().getByRole('button', { name: 'Cancelar' }))

    expect(aoFechar).toHaveBeenCalledTimes(1)
    expect(posts(rede)).toHaveLength(0)
  })
})

describe('o que fica fora do diálogo', () => {
  it('a senha e o aluno não ficam no cache de consultas, no armazenamento, no endereço nem na mutação depois de fechar', async () => {
    const rede = fakeNetwork()
    const { cliente, unmount } = await abrirComAlvo(rede)
    rede.responder(ok(SENHA))
    await userEvent.click(botaoGerar())
    await dialogo().findByText('ABCD-2345')

    // O controle: a senha está na tela, e é só lá que ela está.
    const fora = () => JSON.stringify({ consultas: cliente.getQueryCache().getAll().map((consulta) => ({ chave: consulta.queryKey, dado: consulta.state.data })), local: { ...window.localStorage }, sessao: { ...window.sessionStorage }, endereco: window.location.href })
    for (const segredo of ['ABCD-2345', 'ABCD2345', 'Ana Souza', '2026001']) expect(fora()).not.toContain(segredo)
    expect(cliente.getMutationCache().getAll().length).toBe(1)

    unmount()
    // O `gcTime: 0` tira a mutação do cache num turno do relógio, não na mesma linha.
    await waitFor(() => expect(cliente.getMutationCache().getAll()).toHaveLength(0))
  })

  it('a pessoa seguinte na mesma aba: a troca de sessão fecha o diálogo e solta a senha', async () => {
    const rede = fakeNetwork()
    const aoFechar = vi.fn()
    await abrirComAlvo(rede, ALVO, { aoFechar })
    rede.responder(ok(SENHA))
    await userEvent.click(botaoGerar())
    await dialogo().findByText('ABCD-2345')
    expect(ouvintesDaTrocaDeSessao).toHaveLength(1)

    act(() => ouvintesDaTrocaDeSessao.forEach((ouvinte) => ouvinte()))

    expect(aoFechar).toHaveBeenCalledTimes(1)
    // A mutação foi solta: a senha não está mais no estado do diálogo, mesmo que ele continue montado.
    await waitFor(() => expect(screen.queryByText('ABCD-2345')).toBeNull())
  })

  it('reabrir o diálogo: confirmação de novo, sem a senha velha, com outra leitura do aluno', async () => {
    const rede = fakeNetwork()
    function Cena() {
      const [abertura, definirAbertura] = useState(1)
      return (
        <>
          <button type="button" onClick={() => definirAbertura((n) => n + 1)}>
            reabrir
          </button>
          <DialogoDaSenhaProvisoria key={abertura} usuarioId={ALUNO} aoFechar={() => undefined} aoPerderOAluno={() => undefined} focoDeReserva={() => undefined} />
        </>
      )
    }
    rede.responder(ok(ALVO))
    render(
      <QueryClientProvider client={createQueryClient()}>
        <Cena />
      </QueryClientProvider>,
    )
    await dialogo().findByText('Ana Souza')
    rede.responder(ok(SENHA))
    await userEvent.click(botaoGerar())
    await dialogo().findByText('ABCD-2345')

    rede.responder(ok(ALVO))
    await userEvent.click(screen.getByRole('button', { name: 'reabrir' }))

    expect(await dialogo().findByText('Confira quem é o aluno antes de gerar a senha provisória.')).toBeTruthy()
    expect(screen.queryByText('ABCD-2345')).toBeNull()
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'GET')).toHaveLength(2)
  })

  it('a resposta atrasada da geração do primeiro aluno, que chega depois de fechar, não aparece no diálogo de outro aluno', async () => {
    const rede = fakeNetwork()
    const aoPerderOAluno = vi.fn()
    function Cena() {
      const [alvo, definirAlvo] = useState(ALUNO)
      return <DialogoDaSenhaProvisoria key={alvo} usuarioId={alvo} aoFechar={() => definirAlvo(OUTRO_ALUNO)} aoPerderOAluno={aoPerderOAluno} focoDeReserva={() => undefined} />
    }
    rede.responder(ok(ALVO))
    render(
      <QueryClientProvider client={createQueryClient()}>
        <Cena />
      </QueryClientProvider>,
    )
    await dialogo().findByText('Ana Souza')
    const geracaoDaPrimeira = rede.segurar()
    await userEvent.click(botaoGerar())
    // Fecha de vez com a geração no ar: a pergunta, e "Fechar sem copiar". O aluno seguinte é lido (Bruno).
    rede.responder(ok({ ...ALVO, nome: 'Bruno Lima', matricula: '2026002' }))
    await userEvent.click(dialogo().getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(dialogo().getByRole('button', { name: 'Fechar sem copiar' }))
    await dialogo().findByText('Bruno Lima')

    await act(async () => {
      geracaoDaPrimeira.liberar(ok(SENHA))
      await new Promise((resolver) => setTimeout(resolver, 0))
    })

    expect(screen.queryByText('ABCD-2345')).toBeNull()
    expect(dialogo().getByText('Bruno Lima')).toBeTruthy()
    expect(dialogo().getByText('Confira quem é o aluno antes de gerar a senha provisória.')).toBeTruthy()
    expect(rede.chamadas.map((chamada) => `${chamada.metodo} ${chamada.caminho}`)).toEqual([`GET ${CAMINHO(ALUNO)}`, `POST ${CAMINHO(ALUNO)}`, `GET ${CAMINHO(OUTRO_ALUNO)}`])
    expect(aoPerderOAluno).not.toHaveBeenCalled()
  })

  it('o 404 atrasado da geração do primeiro aluno, depois de fechar, não fecha o diálogo do aluno seguinte', async () => {
    const rede = fakeNetwork()
    const aoPerderOAluno = vi.fn()
    function Cena() {
      const [alvo, definirAlvo] = useState(ALUNO)
      return <DialogoDaSenhaProvisoria key={alvo} usuarioId={alvo} aoFechar={() => definirAlvo(OUTRO_ALUNO)} aoPerderOAluno={aoPerderOAluno} focoDeReserva={() => undefined} />
    }
    rede.responder(ok(ALVO))
    render(
      <QueryClientProvider client={createQueryClient()}>
        <Cena />
      </QueryClientProvider>,
    )
    await dialogo().findByText('Ana Souza')
    const geracaoDaPrimeira = rede.segurar()
    await userEvent.click(botaoGerar())
    rede.responder(ok({ ...ALVO, nome: 'Bruno Lima' }))
    await userEvent.click(dialogo().getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(dialogo().getByRole('button', { name: 'Fechar sem copiar' }))
    await dialogo().findByText('Bruno Lima')

    await act(async () => {
      geracaoDaPrimeira.liberar(erro(404, 'NAO_ENCONTRADO'))
      await new Promise((resolver) => setTimeout(resolver, 0))
    })

    expect(aoPerderOAluno).not.toHaveBeenCalled()
    expect(dialogo().getByText('Bruno Lima')).toBeTruthy()
  })
})
