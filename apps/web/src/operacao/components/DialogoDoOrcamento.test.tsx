// @vitest-environment jsdom
import type { OrcamentoDeIaDoPainel, RedeDoPainel } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { escolaDoPainel, fakeNetwork, janelaDe, redeDoPainel, renderOperacaoScreen, REDE_DE_TESTE_ID, setupOperacaoScreen, type FakeNetwork, type FakeResponse } from '../__fixtures__/render-operacao-screen'
import { CONSULTA_PADRAO, dasEscolasQueryOptions, doUsoQueryOptions } from '../api/painel'
import { DialogoDoOrcamento, type AlvoDoOrcamento } from './DialogoDoOrcamento'

/**
 * O diálogo Orçamento de IA da Operação (camada-ia, 7.0; RF7): os rótulos, o que vale hoje, o antes e o depois, os limites
 * dos dois campos com o erro anunciado, o clique duplo, o 429 e os estados do carregamento. A rede é falsa e tudo o mais
 * é o código de verdade. A medida a 360 px, o foco preso e o teclado de verdade são do e2e (`e2e/operacao-escolas.spec.ts`).
 */
setupOperacaoScreen()

const ESCOLA_ID = '0197a1c0-0000-7000-8000-000000001001'
const SEM_VALOR_PROPRIO: OrcamentoDeIaDoPainel = {
  proprio: { valorPorAlunoMicros: null, tetoDeSegurancaPercentual: null },
  vigente: { valorPorAlunoMicros: 5_000_000, origemDoValor: 'rede', tetoDeSegurancaPercentual: 200, origemDoTeto: 'padrao' },
}
const COM_VALOR_PROPRIO: OrcamentoDeIaDoPainel = {
  proprio: { valorPorAlunoMicros: 3_000_000, tetoDeSegurancaPercentual: 300 },
  vigente: { valorPorAlunoMicros: 3_000_000, origemDoValor: 'escola', tetoDeSegurancaPercentual: 300, origemDoTeto: 'escola' },
}
const escola = (orcamento: OrcamentoDeIaDoPainel = SEM_VALOR_PROPRIO): AlvoDoOrcamento => ({ tipo: 'escola', id: ESCOLA_ID, nome: 'Escola Sintética 1', redeId: REDE_DE_TESTE_ID, orcamento })
const REDE: AlvoDoOrcamento = { tipo: 'rede', id: REDE_DE_TESTE_ID, nome: 'Rede Sintética' }
const SALVO: FakeResponse = { status: 200, corpo: SEM_VALOR_PROPRIO }
const DA_REDE = (itens: readonly RedeDoPainel[]): FakeResponse => ({ status: 200, corpo: { itens } })
const ERRO_500: FakeResponse = { status: 500, corpo: { erro: { codigo: 'ERRO_INTERNO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }

/** Lê a lista de escolas e o Uso, como a tela Escolas e a aba Uso fazem: é o que o salvar tem de marcar para ler de novo. */
function Sondas() {
  useQuery(dasEscolasQueryOptions(CONSULTA_PADRAO))
  useQuery(doUsoQueryOptions(CONSULTA_PADRAO))
  return null
}

type Resposta = FakeResponse | (() => FakeResponse | Promise<FakeResponse>)

interface Preparo {
  readonly redes?: Resposta
  readonly put?: Resposta
  readonly focoDeReserva?: () => void
}

interface Montagem {
  readonly rede: FakeNetwork
  /** O corpo de cada `PUT` que saiu, na ordem, com o caminho. */
  readonly puts: { caminho: string; corpo: unknown }[]
  readonly aoFechar: ReturnType<typeof vi.fn>
  readonly aoSalvar: ReturnType<typeof vi.fn>
  /** Tira o diálogo da tela, como a tela Escolas faz ao fechar. */
  readonly desmontar: () => void
}

function montar(alvo: AlvoDoOrcamento, { redes = DA_REDE([redeDoPainel()]), put = SALVO, focoDeReserva }: Preparo = {}): Montagem {
  const rede = fakeNetwork()
  rede.responderPor('/v1/operacao/redes', redes)
  rede.responderPor(/\/orcamento-ia$/, put)
  rede.responderPor('/v1/operacao/escolas', { status: 200, corpo: { itens: [escolaDoPainel(1)], pagina: 1, total: 1 } })
  rede.responderPor('/v1/operacao/uso', { status: 200, corpo: { itens: [], pagina: 1, total: 0, dia: '2026-09-23', mes: '2026-09' } })
  const puts: Montagem['puts'] = []
  const pedir = globalThis.fetch
  vi.stubGlobal('fetch', (caminho: string, opcoes?: RequestInit) => {
    if (opcoes?.method === 'PUT') puts.push({ caminho, corpo: JSON.parse(String(opcoes.body)) })
    return pedir(caminho, opcoes)
  })
  const aoFechar = vi.fn()
  const aoSalvar = vi.fn()
  const tela = renderOperacaoScreen(
    <>
      <Sondas />
      <DialogoDoOrcamento alvo={alvo} aoFechar={aoFechar} aoSalvar={aoSalvar} {...(focoDeReserva === undefined ? {} : { focoDeReserva })} />
    </>,
  )
  return { rede, puts, aoFechar, aoSalvar, desmontar: tela.unmount }
}

beforeEach(() => {
  janelaDe(1366)
  // O `jsdom` não implementa o `dialog` modal: o teste instala o `showModal` e o `close`.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const campoDoValor = () => screen.findByLabelText('Valor por aluno por mês (R$)') as Promise<HTMLInputElement>
const campoDoTeto = () => screen.findByLabelText('Teto de segurança (% do orçamento)') as Promise<HTMLInputElement>
const caixaDaRede = () => screen.findByRole('checkbox', { name: 'Usar o valor da rede' }) as Promise<HTMLInputElement>
const salvar = () => screen.getByRole('button', { name: 'Salvar orçamento' })

async function digitar(campo: HTMLInputElement, texto: string): Promise<void> {
  await userEvent.clear(campo)
  if (texto !== '') await userEvent.type(campo, texto)
}

/** O texto que o leitor de tela lê junto do campo: o de cada elemento que o `aria-describedby` aponta. */
function descricaoDe(campo: HTMLElement): string {
  return (campo.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
}

/** Quantas vezes a tela leu aquele caminho (só `GET`). */
const leituras = (rede: FakeNetwork, caminho: string) => rede.chamadas.filter((chamada) => chamada.metodo === 'GET' && chamada.caminho.startsWith(caminho)).length

describe('o diálogo Orçamento de IA: os campos e o que vale hoje', () => {
  it('cada campo tem o seu rótulo, e a escola sem valor próprio abre com "Usar o valor da rede" marcada e o valor desligado', async () => {
    montar(escola())
    expect(await campoDoValor()).toBeTruthy()
    expect(await campoDoTeto()).toBeTruthy()
    const caixa = screen.getByRole('checkbox', { name: 'Usar o valor da rede' }) as HTMLInputElement
    expect(caixa.checked).toBe(true)
    expect((await campoDoValor()).disabled).toBe(true)
    expect((await campoDoValor()).value).toBe('')
    expect((await campoDoTeto()).disabled).toBe(false)
    expect((await campoDoTeto()).value).toBe('')
    expect(screen.getByRole('heading', { name: 'Orçamento de IA' })).toBeTruthy()
    expect(screen.getByText('Escola Sintética 1')).toBeTruthy()
    // O diálogo diz se o orçamento é de uma escola ou de uma rede.
    expect(screen.getByText('Escola', { selector: 'p' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Salvar orçamento' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy()
  })

  it('a escola com valor próprio abre com o valor e o teto dela, e a caixa desmarcada', async () => {
    montar(escola(COM_VALOR_PROPRIO))
    expect((await campoDoValor()).value).toBe('3,00')
    expect((await campoDoValor()).disabled).toBe(false)
    expect((await campoDoTeto()).value).toBe('300')
    expect((screen.getByRole('checkbox', { name: 'Usar o valor da rede' }) as HTMLInputElement).checked).toBe(false)
  })

  it('a rede não tem a caixa, abre com o valor e o teto dela, e o teto em branco fica em branco', async () => {
    montar(REDE)
    expect((await campoDoValor()).value).toBe('5,00')
    expect((await campoDoValor()).disabled).toBe(false)
    expect((await campoDoTeto()).value).toBe('')
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByText('Rede Sintética')).toBeTruthy()
    expect(screen.getByText('Rede', { selector: 'p' })).toBeTruthy()
  })

  it('"Vale hoje" diz o valor e de quem ele é: da rede, da escola ou nenhum', async () => {
    montar(escola())
    expect(await screen.findByText('Vale hoje: R$ 5,00 por aluno, da rede.')).toBeTruthy()
  })

  it('"Vale hoje" da escola com valor próprio diz que é da escola', async () => {
    montar(escola(COM_VALOR_PROPRIO))
    expect(await screen.findByText('Vale hoje: R$ 3,00 por aluno, da escola.')).toBeTruthy()
  })

  it('"Vale hoje" da rede sem valor diz que não há', async () => {
    const semValor = redeDoPainel({
      orcamento: {
        proprio: { valorPorAlunoMicros: null, tetoDeSegurancaPercentual: null },
        vigente: { valorPorAlunoMicros: null, origemDoValor: 'nenhuma', tetoDeSegurancaPercentual: 200, origemDoTeto: 'padrao' },
      },
    })
    montar(REDE, { redes: DA_REDE([semValor]) })
    expect(await screen.findByText('Vale hoje: sem valor por aluno.')).toBeTruthy()
    // A rede não tem a caixa: o campo do valor continua livre, mesmo sem valor.
    expect((await campoDoValor()).disabled).toBe(false)
    expect((await campoDoValor()).value).toBe('')
  })

  it('o teto traz uma frase de ajuda em português comum, ligada ao campo, diferente na escola e na rede', async () => {
    montar(escola())
    expect(descricaoDe(await campoDoTeto())).toContain('só o trabalho em lote espera')
    expect(descricaoDe(await campoDoTeto())).toContain('vale o da rede')
    expect(descricaoDe(await campoDoValor())).toContain('Em reais, por aluno ativo.')
  })

  it('o teto da rede diz que em branco vale 200%, e o valor da rede, que em branco é "não define"', async () => {
    montar(REDE)
    expect(descricaoDe(await campoDoTeto())).toContain('Em branco: vale 200%.')
    expect(descricaoDe(await campoDoTeto())).not.toContain('vale o da rede')
    expect(descricaoDe(await campoDoValor())).toContain('a rede não define valor')
  })
})

describe('o diálogo Orçamento de IA: o antes e o depois, antes de salvar', () => {
  it('a escola que passa de R$ 5,00 da rede para R$ 4,00 próprios vê o antes e o depois, e o botão a descreve', async () => {
    montar(escola())
    await userEvent.click(await caixaDaRede())
    // Antes de o valor ser digitado, o campo em branco não é pedido válido: nada de "Depois", e o botão não aponta para ele.
    expect(screen.queryByText(/^Antes:/)).toBeNull()
    expect(salvar().getAttribute('aria-describedby')).toBeNull()
    await digitar(await campoDoValor(), '4,00')
    const texto = await screen.findByText('Antes: R$ 5,00 por aluno, teto 200%. Depois: R$ 4,00 por aluno, teto 200%.')
    expect(descricaoDe(salvar())).toBe(texto.parentElement?.textContent)
    expect(salvar().getAttribute('aria-describedby')).toBe(texto.parentElement?.id)
    // A escola não diz quantas escolas mudam: só a rede.
    expect(screen.queryByText(/Muda o orçamento/)).toBeNull()
  })

  it('"Usar o valor da rede" mostra o valor da rede no "Depois", e o teto novo vale sobre o da rede', async () => {
    montar(escola(COM_VALOR_PROPRIO))
    await userEvent.click(await caixaDaRede())
    await digitar(await campoDoTeto(), '')
    expect(await screen.findByText('Antes: R$ 3,00 por aluno, teto 300%. Depois: R$ 5,00 por aluno, teto 200%.')).toBeTruthy()
  })

  it('na rede, "Muda o orçamento de 3 escolas que usam o valor da rede." junto do antes e depois', async () => {
    montar(REDE)
    await digitar(await campoDoValor(), '4,00')
    expect(await screen.findByText('Antes: R$ 5,00 por aluno, teto 200%. Depois: R$ 4,00 por aluno, teto 200%.')).toBeTruthy()
    expect(screen.getByText('Muda o orçamento de 3 escolas que usam o valor da rede.')).toBeTruthy()
  })

  it('na rede, só o teto muda: o valor é o mesmo e a frase de quem muda aparece, porque as escolas usam o teto da rede também', async () => {
    montar(REDE)
    await digitar(await campoDoTeto(), '300')
    expect(await screen.findByText('Antes: R$ 5,00 por aluno, teto 200%. Depois: R$ 5,00 por aluno, teto 300%.')).toBeTruthy()
    expect(screen.getByText('Muda o orçamento de 3 escolas que usam o valor da rede.')).toBeTruthy()
  })

  it('na rede, uma escola só diz "1 escola que usa"; nenhuma escola, ou nada que mude, não diz "Muda"', async () => {
    montar(REDE, { redes: DA_REDE([redeDoPainel({ escolasQueUsamOValorDaRede: 1 })]) })
    await digitar(await campoDoValor(), '4,00')
    expect(await screen.findByText('Muda o orçamento de 1 escola que usa o valor da rede.')).toBeTruthy()
    // Voltando ao valor de antes, o vigente é o mesmo: o antes e o depois continuam, a frase de quem muda some.
    await digitar(await campoDoValor(), '5,00')
    expect(await screen.findByText('Antes: R$ 5,00 por aluno, teto 200%. Depois: R$ 5,00 por aluno, teto 200%.')).toBeTruthy()
    expect(screen.queryByText(/Muda o orçamento/)).toBeNull()
  })

  it('na rede sem escola que use o valor dela, o antes e o depois aparecem e a frase de quem muda não', async () => {
    montar(REDE, { redes: DA_REDE([redeDoPainel({ escolasQueUsamOValorDaRede: 0 })]) })
    await digitar(await campoDoValor(), '4,00')
    expect(await screen.findByText('Antes: R$ 5,00 por aluno, teto 200%. Depois: R$ 4,00 por aluno, teto 200%.')).toBeTruthy()
    expect(screen.queryByText(/Muda o orçamento/)).toBeNull()
  })

  it('na rede, o valor em branco é "sem valor": o depois diz que não há valor, e o pedido leva null', async () => {
    const { puts } = montar(REDE)
    await digitar(await campoDoValor(), '')
    expect(await screen.findByText('Antes: R$ 5,00 por aluno, teto 200%. Depois: sem valor por aluno, teto 200%.')).toBeTruthy()
    await userEvent.click(salvar())
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({ caminho: `/v1/operacao/redes/${REDE_DE_TESTE_ID}/orcamento-ia`, corpo: { valorPorAlunoCentavos: null, tetoDeSegurancaPercentual: null } })
  })
})

describe('o diálogo Orçamento de IA: a rede certa da lista', () => {
  // Duas redes na lista, e o alvo é a segunda: a que vem primeiro tem outro valor, outro teto e outra contagem.
  const OUTRA_REDE = redeDoPainel({
    id: '0197a1c0-0000-7000-8000-000000002999',
    nome: 'Outra Rede',
    orcamento: {
      proprio: { valorPorAlunoMicros: 9_000_000, tetoDeSegurancaPercentual: 400 },
      vigente: { valorPorAlunoMicros: 9_000_000, origemDoValor: 'rede', tetoDeSegurancaPercentual: 400, origemDoTeto: 'rede' },
    },
    escolasQueUsamOValorDaRede: 7,
  })
  const DUAS_REDES = DA_REDE([OUTRA_REDE, redeDoPainel()])

  it('na rede, o "Vale hoje", o "Antes" e a contagem são os da rede do alvo, e não os da primeira da lista', async () => {
    montar(REDE, { redes: DUAS_REDES })
    expect(await screen.findByText('Vale hoje: R$ 5,00 por aluno, da rede.')).toBeTruthy()
    expect((await campoDoValor()).value).toBe('5,00')
    expect((await campoDoTeto()).value).toBe('')
    await digitar(await campoDoValor(), '4,00')
    expect(await screen.findByText('Antes: R$ 5,00 por aluno, teto 200%. Depois: R$ 4,00 por aluno, teto 200%.')).toBeTruthy()
    expect(screen.getByText('Muda o orçamento de 3 escolas que usam o valor da rede.')).toBeTruthy()
    expect(screen.queryByText(/R\$ 9,00/)).toBeNull()
  })

  it('na escola, "Usar o valor da rede" mostra no "Depois" o valor da rede dela, e não o da primeira da lista', async () => {
    montar(escola(), { redes: DUAS_REDES })
    expect(await screen.findByText('Antes: R$ 5,00 por aluno, teto 200%. Depois: R$ 5,00 por aluno, teto 200%.', { exact: false })).toBeTruthy()
    expect(screen.queryByText(/R\$ 9,00/)).toBeNull()
    await digitar(await campoDoTeto(), '300')
    expect(await screen.findByText('Antes: R$ 5,00 por aluno, teto 200%. Depois: R$ 5,00 por aluno, teto 300%.')).toBeTruthy()
    expect(screen.queryByText(/R\$ 9,00/)).toBeNull()
  })
})

describe('o diálogo Orçamento de IA: o pedido', () => {
  it('"Usar o valor da rede" manda null no valor, e o teto digitado segue; o caminho é o da escola', async () => {
    const { puts } = montar(escola(COM_VALOR_PROPRIO))
    await userEvent.click(await caixaDaRede())
    expect((await campoDoValor()).disabled).toBe(true)
    await userEvent.click(salvar())
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({ caminho: `/v1/operacao/escolas/${ESCOLA_ID}/orcamento-ia`, corpo: { valorPorAlunoCentavos: null, tetoDeSegurancaPercentual: 300 } })
  })

  it('o valor digitado em reais sai em centavos, e o teto em %; o caminho da rede é o da rede', async () => {
    const { puts } = montar(REDE)
    await digitar(await campoDoValor(), '4,10')
    await digitar(await campoDoTeto(), '250')
    await userEvent.click(salvar())
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({ caminho: `/v1/operacao/redes/${REDE_DE_TESTE_ID}/orcamento-ia`, corpo: { valorPorAlunoCentavos: 410, tetoDeSegurancaPercentual: 250 } })
  })

  it('a escola que desmarca a caixa e deixa o valor em branco não passa: o campo diz o intervalo, e nada sai', async () => {
    const { puts } = montar(escola())
    await userEvent.click(await caixaDaRede())
    // Os erros só vêm com a tentativa de salvar: o campo em branco, sozinho, não grita.
    expect(screen.queryByRole('alert')).toBeNull()
    await userEvent.click(salvar())
    expect((await screen.findByRole('alert')).textContent).toBe('Use um valor entre R$ 0,01 e R$ 100,00.')
    expect(puts).toHaveLength(0)
  })
})

describe('o diálogo Orçamento de IA: os limites dos campos, com o erro anunciado e ligado ao campo', () => {
  it.each([
    ['R$ 0,00', '0,00'],
    ['R$ 100,01', '100,01'],
    ['texto', 'abc'],
  ])('valor de %s: o texto do intervalo no campo, anunciado, sem chamar a API; corrigido, o pedido sai uma vez só', async (_nome, valor) => {
    const { puts } = montar(REDE)
    const campo = await campoDoValor()
    await digitar(campo, valor)
    await userEvent.click(salvar())
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toBe('Use um valor entre R$ 0,01 e R$ 100,00.')
    expect(campo.getAttribute('aria-describedby')?.split(' ')).toContain(alerta.id)
    expect(campo.getAttribute('aria-invalid')).toBe('true')
    // Só o campo recusado tem erro, e o teto não ganha marca nenhuma.
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect((await campoDoTeto()).getAttribute('aria-invalid')).toBeNull()
    // O teto, sem erro, só aponta para a ajuda dele: nenhum id que não esteja na tela.
    expect((await campoDoTeto()).getAttribute('aria-describedby')?.split(' ')).toHaveLength(1)
    expect(puts).toHaveLength(0)

    await digitar(campo, '4,00')
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(campo.getAttribute('aria-invalid')).toBeNull()
    await userEvent.click(salvar())
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]?.corpo).toEqual({ valorPorAlunoCentavos: 400, tetoDeSegurancaPercentual: null })
  })

  it.each([
    ['99%', '99'],
    ['1001%', '1001'],
  ])('teto de %s: "Use de 100%% a 1000%%." no campo do teto, anunciado, sem chamar a API', async (_nome, teto) => {
    const { puts } = montar(REDE)
    const campo = await campoDoTeto()
    await digitar(campo, teto)
    await userEvent.click(salvar())
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toBe('Use de 100% a 1000%.')
    expect(campo.getAttribute('aria-describedby')?.split(' ')).toContain(alerta.id)
    expect(campo.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect((await campoDoValor()).getAttribute('aria-invalid')).toBeNull()
    expect(puts).toHaveLength(0)

    await digitar(campo, '300')
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    await userEvent.click(salvar())
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]?.corpo).toEqual({ valorPorAlunoCentavos: 500, tetoDeSegurancaPercentual: 300 })
  })

  it('os dois campos recusados de uma vez têm cada um o seu erro, e o anúncio de cada um é um só', async () => {
    montar(REDE)
    await digitar(await campoDoValor(), '0')
    await digitar(await campoDoTeto(), '1')
    await userEvent.click(salvar())
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    expect(descricaoDe(await campoDoValor())).toContain('Use um valor entre R$ 0,01 e R$ 100,00.')
    expect(descricaoDe(await campoDoTeto())).toContain('Use de 100% a 1000%.')
    expect(descricaoDe(await campoDoValor())).not.toContain('Use de 100% a 1000%.')
  })

  it.each([
    ['R$ 0,01', '0,01', '', 1, null],
    ['R$ 100,00', '100,00', '', 10_000, null],
    ['100%', '5,00', '100', 500, 100],
    ['1000%', '5,00', '1000', 500, 1000],
  ])('%s passa: o pedido sai com os dois campos', async (_nome, valor, teto, centavos, percentual) => {
    const { puts } = montar(REDE)
    await digitar(await campoDoValor(), valor)
    await digitar(await campoDoTeto(), teto)
    await userEvent.click(salvar())
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]?.corpo).toEqual({ valorPorAlunoCentavos: centavos, tetoDeSegurancaPercentual: percentual })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('o diálogo Orçamento de IA: salvar', () => {
  it('"Orçamento salvo": avisa a tela uma vez, e as listas de redes, de escolas e o Uso são lidos de novo', async () => {
    const { rede, aoSalvar } = montar(REDE)
    await digitar(await campoDoValor(), '4,00')
    // As três leituras de entrada já saíram: a do diálogo (redes) e as duas sondas.
    await waitFor(() => expect(leituras(rede, '/v1/operacao/uso')).toBe(1))
    expect(leituras(rede, '/v1/operacao/redes')).toBe(1)
    expect(leituras(rede, '/v1/operacao/escolas')).toBe(1)
    expect(aoSalvar).not.toHaveBeenCalled()

    await userEvent.click(salvar())
    await waitFor(() => expect(aoSalvar).toHaveBeenCalledTimes(1))
    expect(leituras(rede, '/v1/operacao/redes')).toBe(2)
    expect(leituras(rede, '/v1/operacao/escolas')).toBe(2)
    expect(leituras(rede, '/v1/operacao/uso')).toBe(2)
  })

  it('enquanto o pedido está no ar, o botão diz "Salvando…" e fica desligado; o diálogo não fecha sozinho', async () => {
    let soltar: (resposta: FakeResponse) => void = () => undefined
    const { aoSalvar, aoFechar } = montar(REDE, { put: () => new Promise<FakeResponse>((resolver) => (soltar = resolver)) })
    await digitar(await campoDoValor(), '4,00')
    expect(screen.queryByText('Salvando o orçamento…')).toBeNull()
    expect((salvar() as HTMLButtonElement).disabled).toBe(false)
    await userEvent.click(salvar())
    const botao = await screen.findByRole('button', { name: 'Salvando…' })
    expect((botao as HTMLButtonElement).disabled).toBe(true)
    // O leitor de tela ouve que o orçamento está sendo salvo, uma vez.
    expect(screen.getByText('Salvando o orçamento…')).toBeTruthy()
    expect(aoSalvar).not.toHaveBeenCalled()
    expect(aoFechar).not.toHaveBeenCalled()
    soltar(SALVO)
    await waitFor(() => expect(aoSalvar).toHaveBeenCalledTimes(1))
  })

  it('dois envios seguidos, antes de a tela mostrar o primeiro: um `PUT` só', async () => {
    let soltar: (resposta: FakeResponse) => void = () => undefined
    const { puts, aoSalvar } = montar(REDE, { put: () => new Promise<FakeResponse>((resolver) => (soltar = resolver)) })
    await digitar(await campoDoValor(), '4,00')
    const formulario = salvar().closest('form')
    if (formulario === null) throw new Error('sem formulário')
    fireEvent.submit(formulario)
    fireEvent.submit(formulario)
    await waitFor(() => expect(puts).toHaveLength(1))
    soltar(SALVO)
    await waitFor(() => expect(aoSalvar).toHaveBeenCalledTimes(1))
    expect(puts).toHaveLength(1)
  })

  it('o clique duplo no botão também é um `PUT` só', async () => {
    let soltar: (resposta: FakeResponse) => void = () => undefined
    const { puts, aoSalvar } = montar(REDE, { put: () => new Promise<FakeResponse>((resolver) => (soltar = resolver)) })
    await digitar(await campoDoValor(), '4,00')
    await userEvent.dblClick(salvar())
    await waitFor(() => expect(puts).toHaveLength(1))
    soltar(SALVO)
    await waitFor(() => expect(aoSalvar).toHaveBeenCalledTimes(1))
    expect(puts).toHaveLength(1)
  })

  it('o 429 diz em quantos minutos tentar de novo, o diálogo fica, e o mesmo botão tenta de novo e salva', async () => {
    let chamada = 0
    const { puts, aoSalvar } = montar(REDE, { put: () => (++chamada === 1 ? { status: 429, cabecalhos: { 'Retry-After': '120' } } : SALVO) })
    await digitar(await campoDoValor(), '4,00')
    await userEvent.click(salvar())
    expect((await screen.findByRole('alert')).textContent).toBe('Muitas ações seguidas. Tente de novo em 2 minutos.')
    expect(aoSalvar).not.toHaveBeenCalled()
    expect((salvar() as HTMLButtonElement).disabled).toBe(false)

    await userEvent.click(salvar())
    await waitFor(() => expect(aoSalvar).toHaveBeenCalledTimes(1))
    expect(puts).toHaveLength(2)
  })

  it('a resposta do `PUT` fora do contrato manda atualizar a página, no alerta do diálogo', async () => {
    montar(REDE, { put: { status: 200, corpo: { orcamento: 'outro formato' } } })
    await digitar(await campoDoValor(), '4,00')
    await userEvent.click(salvar())
    expect((await screen.findByRole('alert')).textContent).toContain('Atualize a página')
  })
})

describe('o diálogo Orçamento de IA: carregando, erro e a web antiga com a API nova', () => {
  it('carregando: o texto do carregamento, sem formulário nem "Salvar orçamento"', async () => {
    let soltar: (resposta: FakeResponse) => void = () => undefined
    montar(REDE, {
      redes: () => new Promise<FakeResponse>((resolver) => (soltar = resolver)),
    })
    expect((await screen.findByRole('status')).textContent).toBe('Carregando o orçamento…')
    expect(screen.queryByLabelText('Valor por aluno por mês (R$)')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salvar orçamento' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    soltar(DA_REDE([redeDoPainel()]))
    expect(await campoDoValor()).toBeTruthy()
    expect(screen.queryByText('Carregando o orçamento…')).toBeNull()
  })

  it('erro: "Não foi possível carregar." com "Tentar de novo", que lê outra vez e abre o formulário', async () => {
    let chamada = 0
    // O erro interno é repetido sozinho uma vez (`shouldRetry`): as duas primeiras leituras falham.
    montar(REDE, { redes: () => (++chamada <= 2 ? ERRO_500 : DA_REDE([redeDoPainel()])) })
    expect((await screen.findByRole('alert', {}, { timeout: 4000 })).textContent).toBe('Não foi possível carregar.')
    expect(screen.queryByRole('button', { name: 'Salvar orçamento' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await campoDoValor()).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(chamada).toBe(3)
  })

  it('a rede que a lista não traz mais é o mesmo erro, e o "Cancelar" fecha', async () => {
    const { aoFechar } = montar(REDE, { redes: DA_REDE([]) })
    expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível carregar.')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('resposta fora do contrato: "Atualize a página", sem "Tentar de novo", que não resolveria', async () => {
    montar(REDE, { redes: { status: 200, corpo: { itens: [{ ...redeDoPainel(), campoNovo: 1 }] } } })
    const alerta = await screen.findByRole('alert', {}, { timeout: 4000 })
    expect(alerta.textContent).toContain('Atualize a página')
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salvar orçamento' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy()
  })

  it('a lista de redes chega com o diálogo já aberto: o foco vai ao campo do valor da rede', async () => {
    montar(REDE)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Valor por aluno por mês (R$)')))
  })

  it('na escola com o valor da rede, o campo do valor está desligado e o foco vai à caixa "Usar o valor da rede"', async () => {
    montar(escola())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'Usar o valor da rede' })))
  })

  it('o foco vai para a reserva ao fechar o diálogo, quando quem o abriu já saiu da página', async () => {
    const focoDeReserva = vi.fn()
    const { desmontar } = montar(REDE, { focoDeReserva })
    await campoDoValor()
    desmontar()
    expect(focoDeReserva).toHaveBeenCalledTimes(1)
  })

  it('o "Cancelar" do formulário fecha sem salvar', async () => {
    const { aoFechar, puts } = montar(REDE)
    await campoDoValor()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(aoFechar).toHaveBeenCalledTimes(1)
    expect(puts).toHaveLength(0)
  })
})
