// @vitest-environment jsdom
import type { MesDoUsoDeIaDaEscola } from '@educa/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeNetwork, janelaDe, renderOperacaoScreen, setupOperacaoScreen, type FakeResponse } from '../__fixtures__/render-operacao-screen'
import { MesesDeIa } from './MesesDeIa'

/**
 * "Ver meses" da aba Uso (camada-ia, 8.0; RF11): os 12 meses anteriores de uma escola, cada um pelo retrato. A rede é falsa e
 * tudo o mais é o código de verdade. A medida a 360 px e o alvo de 24 px são do e2e (`e2e/operacao-uso.spec.ts`).
 */
setupOperacaoScreen()

const ESCOLA = { id: '0197a1c0-0000-7000-8000-000000001001', nome: 'Escola Sintética 1' }
const CAMINHO = `/v1/operacao/escolas/${ESCOLA.id}/uso-ia`

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

/** O mês `posicao` meses antes de outubro de 2026 (o corrente do caso), sem retrato: só o consumo. */
function semRetrato(posicao: number, extra: Partial<MesDoUsoDeIaDaEscola> = {}): MesDoUsoDeIaDaEscola {
  return {
    mes: new Date(Date.UTC(2026, 8 - posicao, 1)).toISOString().slice(0, 7),
    execucoes: 0,
    chamadas: 0,
    tokens: 0,
    custoMicros: 0,
    chamadasPeloProvedorDeReserva: 0,
    alunosAtivos: null,
    valorPorAlunoMicros: null,
    origemDoValor: null,
    porcentagem: null,
    situacao: 'sem_retrato',
    ...extra,
  }
}

const COM_RETRATO: Partial<MesDoUsoDeIaDaEscola> = {
  chamadas: 1234,
  tokens: 12_345_678,
  custoMicros: 31_000_000,
  chamadasPeloProvedorDeReserva: 3,
  alunosAtivos: 100,
  valorPorAlunoMicros: 5_000_000,
  origemDoValor: 'escola',
  porcentagem: 62,
  situacao: 'definido',
}

const doze = (primeiros: readonly MesDoUsoDeIaDaEscola[]): FakeResponse => ({
  status: 200,
  corpo: { meses: [...primeiros, ...Array.from({ length: 12 - primeiros.length }, (_, posicao) => semRetrato(primeiros.length + posicao))] },
})

const FALHA_503: FakeResponse = { status: 503, corpo: { erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }

function montar(resposta: FakeResponse | FakeResponse[]) {
  const rede = fakeNetwork()
  for (const r of Array.isArray(resposta) ? resposta : [resposta]) rede.responder(r)
  const aoFechar = vi.fn()
  renderOperacaoScreen(<MesesDeIa escola={ESCOLA} aoFechar={aoFechar} />)
  return { rede, aoFechar }
}

describe('Ver meses: a lista dos 12 (RF11)', () => {
  it('12 meses, do mais recente ao mais antigo, com o mês por extenso em português e só a rota da escola lida', async () => {
    const { rede } = montar(doze([semRetrato(0, COM_RETRATO)]))
    const dialogo = await screen.findByRole('dialog', { name: 'Meses de IA' })
    const itens = await within(dialogo).findAllByRole('listitem')
    expect(itens).toHaveLength(12)
    expect(itens.map((item) => within(item).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'setembro de 2026',
      'agosto de 2026',
      'julho de 2026',
      'junho de 2026',
      'maio de 2026',
      'abril de 2026',
      'março de 2026',
      'fevereiro de 2026',
      'janeiro de 2026',
      'dezembro de 2025',
      'novembro de 2025',
      'outubro de 2025',
    ])
    expect(rede.chamadas.map(({ caminho }) => caminho)).toEqual([CAMINHO])
    expect(within(dialogo).getByText(ESCOLA.nome)).toBeTruthy()
  })

  it('o mês com retrato traz chamadas, tokens, reais, o custo por aluno contra o valor, a porcentagem da API e a reserva', async () => {
    montar(doze([semRetrato(0, COM_RETRATO)]))
    const primeiro = (await screen.findAllByRole('listitem'))[0]
    if (primeiro === undefined) throw new Error('sem mês')
    expect(within(primeiro).getByText('62% do orçamento')).toBeTruthy()
    const medidas = within(primeiro)
      .getAllByRole('term')
      .map((termo) => [termo.textContent, termo.nextElementSibling?.textContent])
    // R$ 31,00 sobre 100 alunos a R$ 5,00: R$ 0,31 de R$ 5,00.
    expect(medidas).toEqual([
      ['Chamadas', '1.234'],
      ['Tokens', '12.345.678'],
      ['Reais', 'R$ 31,00'],
      ['Custo por aluno', 'R$ 0,31 de R$ 5,00'],
      ['Chamadas da reserva', '3'],
    ])
  })

  it('o mês fechado antes da medição diz "sem retrato (antes da medição)" e mostra só o consumo, sem custo por aluno', async () => {
    montar(doze([semRetrato(0, COM_RETRATO), semRetrato(1, { chamadas: 7, tokens: 900, custoMicros: 2_000_000 })]))
    const itens = await screen.findAllByRole('listitem')
    const segundo = itens[1]
    if (segundo === undefined) throw new Error('sem mês')
    expect(within(segundo).getByText('sem retrato (antes da medição)')).toBeTruthy()
    expect(within(segundo).queryByText('Custo por aluno')).toBeNull()
    expect(within(segundo).getByText('R$ 2,00')).toBeTruthy()
  })

  it('cada situação do retrato diz o seu texto, nunca só a cor', async () => {
    montar(
      doze([
        semRetrato(0, { ...COM_RETRATO, situacao: 'sem_orcamento', valorPorAlunoMicros: null, origemDoValor: 'nenhuma', porcentagem: null }),
        semRetrato(1, { ...COM_RETRATO, situacao: 'sem_aluno_ativo', alunosAtivos: 0, porcentagem: null }),
        semRetrato(2, COM_RETRATO),
      ]),
    )
    const itens = await screen.findAllByRole('listitem')
    expect(within(itens[0] as HTMLElement).getByText('sem orçamento definido')).toBeTruthy()
    // Sem valor, o custo por aluno aparece sozinho: R$ 31,00 sobre 100 alunos.
    expect(within(itens[0] as HTMLElement).getByText('R$ 0,31')).toBeTruthy()
    expect(within(itens[1] as HTMLElement).getByText('sem porcentagem')).toBeTruthy()
    expect(within(itens[1] as HTMLElement).getByText('sem aluno ativo')).toBeTruthy()
    expect(within(itens[2] as HTMLElement).getByText('62% do orçamento')).toBeTruthy()
  })
})

describe('Ver meses: os estados (RF11)', () => {
  it('vazio: nenhum dos 12 meses tem retrato, e o texto diz que ainda não há mês fechado com retrato', async () => {
    montar(doze([]))
    expect(await screen.findByText('Ainda não há mês fechado com retrato.')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByText('sem retrato (antes da medição)')).toBeNull()
  })

  it('carregando: o texto do carregamento, sem lista e sem erro', async () => {
    const rede = fakeNetwork()
    const solta = rede.segurar()
    renderOperacaoScreen(<MesesDeIa escola={ESCOLA} aoFechar={() => undefined} />)
    expect(await screen.findByText('Carregando os meses…')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    solta.liberar(doze([semRetrato(0, COM_RETRATO)]))
    expect(await screen.findAllByRole('listitem')).toHaveLength(12)
    expect(screen.queryByText('Carregando os meses…')).toBeNull()
  })

  it('erro: "Não foi possível carregar." com "Tentar de novo", que lê outra vez e mostra os meses', async () => {
    const { rede } = montar([FALHA_503, FALHA_503])
    expect((await screen.findByRole('alert', {}, { timeout: 4000 })).textContent).toBe('Não foi possível carregar.')
    expect(screen.queryByRole('list')).toBeNull()
    rede.responder(doze([semRetrato(0, COM_RETRATO)]))
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findAllByRole('listitem')).toHaveLength(12)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('fora do contrato (onze meses): "Atualize a página", sem "Tentar de novo", que traria a mesma resposta', async () => {
    montar({ status: 200, corpo: { meses: Array.from({ length: 11 }, (_, posicao) => semRetrato(posicao)) } })
    expect((await screen.findByRole('alert', {}, { timeout: 4000 })).textContent).toBe('Atualize a página: esta tela ficou desatualizada em relação ao Turmma.')
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })

  it('o foco vai para a reserva ao fechar o diálogo, quando quem o abriu já saiu da página', async () => {
    const focoDeReserva = vi.fn()
    fakeNetwork().responder(doze([semRetrato(0, COM_RETRATO)]))
    const { unmount } = renderOperacaoScreen(<MesesDeIa escola={ESCOLA} aoFechar={vi.fn()} focoDeReserva={focoDeReserva} />)
    await screen.findAllByRole('listitem')
    unmount()
    expect(focoDeReserva).toHaveBeenCalledTimes(1)
  })

  it('"Fechar" chama o fechar da tela, na lista e no erro', async () => {
    const { aoFechar } = montar(doze([semRetrato(0, COM_RETRATO)]))
    await screen.findAllByRole('listitem')
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })
})
