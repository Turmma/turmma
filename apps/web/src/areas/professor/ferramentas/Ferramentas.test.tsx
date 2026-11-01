// @vitest-environment jsdom
import { montarTime, type ChaveDeFuncao } from '@educa/shared'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import { caminhoDaFerramentaDoProfessor, PROFESSOR_ROUTES } from '../../../paths'
import { TEXTO_DA_SUSPENSAO } from '../comum/avisos'
import Ferramentas from './Ferramentas'
import { ferramentaDoCatalogo } from './ferramentas'

/**
 * "Ferramentas" da professora (telas do professor, 7.0; RF10, RF22): o catálogo por categoria da D74, só com as três
 * ferramentas que existem, o selo da função que a coordenação suspendeu e os dois avisos que não tiram cartão (a leitura do
 * time que falha, a professora sem turma confirmada). A rede é falsa e responde **por caminho**; a tela, o cliente de
 * consultas e o roteador são de verdade. As colunas da grade, o tamanho do cartão e do toque, o axe e o recomeço pela pessoa
 * seguinte precisam de navegador e são do e2e (`e2e/professor-ferramentas.spec.ts`).
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const TURMA = { id: id(101), nome: '1º A' }
const QUIMICA = { id: id(500), nome: 'Química' }
const vinculo = (estado: string) => ({ id: id(401), turma: TURMA, disciplina: QUIMICA, estado })
const COM_TURMA: FakeResponse = { status: 200, corpo: { itens: [vinculo('confirmado')] } }
const SEM_VINCULO: FakeResponse = { status: 200, corpo: { itens: [] } }
const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
const timeSem = (...suspensas: ChaveDeFuncao[]): FakeResponse => ({ status: 200, corpo: montarTime(new Set(suspensas)) })
const NAO_ENCONTRADO = erro(404, 'NAO_ENCONTRADO')
const nuncaResponde = () => new Promise<FakeResponse>(() => undefined)
/** Confirma que o texto **não** aparece numa janela de 300 ms: a leitura já saiu e a resposta teve tempo de ser desenhada. */
const naoApareceDepoisDaLeitura = (texto: string) => expect(screen.findByText(texto, undefined, { timeout: 300 })).rejects.toThrow()

type Resposta = FakeResponse | (() => FakeResponse | Promise<FakeResponse>)

function instalar(rede: FakeNetwork, quem: { time?: Resposta; vinculos?: Resposta } = {}): void {
  rede.responderPor('/v1/time', quem.time ?? timeSem())
  rede.responderPor('/v1/meus-vinculos', quem.vinculos ?? COM_TURMA)
}

function montar() {
  const localizacao = memoryLocation({ path: PROFESSOR_ROUTES.ferramentas, record: true })
  renderScreen(
    <Router hook={localizacao.hook}>
      <Ferramentas />
    </Router>,
  )
  return localizacao
}

const cartao = (ferramenta: string) => {
  const achado = document.querySelector<HTMLElement>(`[data-ferramenta="${ferramenta}"]`)
  if (achado === null) throw new Error(`sem cartão de ${ferramenta}`)
  return achado
}
const seloDe = (ferramenta: string) => within(cartao(ferramenta)).queryByText('Suspensa pela coordenação')
const avisoDeSuspensao = (funcao: ChaveDeFuncao) => document.querySelector(`[data-funcao-suspensa="${funcao}"]`)
const chamadasA = (rede: FakeNetwork, caminho: string) => rede.chamadas.filter((chamada) => chamada.caminho.split('?')[0] === caminho)

describe('o catálogo (D74)', () => {
  it('uma seção por categoria que tem ferramenta, na ordem da D74, e "Corrigir" não aparece; só as três ferramentas, sem cartão desligado nem "em breve"', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await screen.findByRole('heading', { level: 2, name: 'Planejar' })

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ferramentas')
    expect(screen.getAllByRole('heading', { level: 2 }).map((titulo) => titulo.textContent)).toEqual(['Planejar', 'Preparar a aula', 'Avaliar'])
    expect(screen.queryByText('Corrigir')).toBeNull()
    expect(screen.queryByText(/em breve/i)).toBeNull()
    // Cada cartão está na seção da sua categoria.
    expect(within(screen.getByRole('region', { name: 'Planejar' })).getAllByRole('link').map((link) => link.textContent)).toEqual([expect.stringMatching(/^Plano de aula/)])
    expect(within(screen.getByRole('region', { name: 'Preparar a aula' })).getAllByRole('link').map((link) => link.textContent)).toEqual([expect.stringMatching(/^Adaptação/)])
    expect(within(screen.getByRole('region', { name: 'Avaliar' })).getAllByRole('link').map((link) => link.textContent)).toEqual([expect.stringMatching(/^Atividade objetiva/)])
    // Só as três, e todas abertas: um link cada, nenhum botão, nada desligado.
    expect([...document.querySelectorAll('[data-ferramenta]')].map((item) => item.getAttribute('data-ferramenta'))).toEqual(['plano_de_aula', 'adaptacao', 'atividade_objetiva'])
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(document.querySelectorAll('[aria-disabled="true"], [disabled]')).toHaveLength(0)
  })

  it('cada cartão leva ao formulário da ferramenta, tem o ícone dela como decoração e diz o que ela entrega', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await screen.findByRole('heading', { level: 2, name: 'Planejar' })

    for (const [ferramenta, nome] of [
      ['plano_de_aula', 'Plano de aula'],
      ['adaptacao', 'Adaptação'],
      ['atividade_objetiva', 'Atividade objetiva'],
    ] as const) {
      const link = within(cartao(ferramenta)).getByRole('link')
      expect(link.getAttribute('href')).toBe(caminhoDaFerramentaDoProfessor(ferramenta))
      // O nome acessível começa pelo nome da ferramenta: o ícone é decoração e não entra nele.
      expect(link.textContent?.startsWith(nome)).toBe(true)
      const icone = link.querySelector(`svg[data-icone-de-ferramenta="${ferramenta}"]`)
      expect(icone?.getAttribute('aria-hidden')).toBe('true')
      expect(icone?.getAttribute('width')).toBe('48')
      expect(link.querySelector('span.line-clamp-3')?.textContent).toBe(ferramentaDoCatalogo(ferramenta).descricao)
    }
  })

  it('a lista do que foi gerado não é lida aqui: a tela só chama o time e os vínculos', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await screen.findByRole('heading', { level: 2, name: 'Planejar' })
    await waitFor(() => expect(chamadasA(rede, '/v1/meus-vinculos')).toHaveLength(1))
    expect(chamadasA(rede, '/v1/time')).toHaveLength(1)
    expect(rede.chamadas.map((chamada) => chamada.caminho.split('?')[0]).sort()).toEqual(['/v1/meus-vinculos', '/v1/time'])
  })
})

describe('a função suspensa pela escola', () => {
  it('sem nenhuma suspensa: nenhum selo e nenhuma frase de suspensão', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await screen.findByRole('heading', { level: 2, name: 'Avaliar' })
    await waitFor(() => expect(chamadasA(rede, '/v1/time')).toHaveLength(1))
    expect(screen.queryByText('Suspensa pela coordenação')).toBeNull()
    expect(document.querySelector('[data-funcao-suspensa]')).toBeNull()
  })

  it('só a Adaptação suspensa: o selo e a frase são dela, os outros dois cartões seguem sem selo, e os três continuam abertos', async () => {
    const rede = fakeNetwork()
    instalar(rede, { time: timeSem('adaptacao') })
    montar()
    await waitFor(() => expect(avisoDeSuspensao('adaptacao')).not.toBeNull())

    expect(seloDe('adaptacao')).not.toBeNull()
    expect(seloDe('plano_de_aula')).toBeNull()
    expect(seloDe('atividade_objetiva')).toBeNull()
    expect(avisoDeSuspensao('adaptacao')?.textContent).toBe(TEXTO_DA_SUSPENSAO.adaptacao)
    expect(avisoDeSuspensao('conversa_e_ferramentas')).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('a conversa e as ferramentas suspensas: o selo está no plano de aula e na atividade, não na Adaptação, e a frase é a da função', async () => {
    const rede = fakeNetwork()
    instalar(rede, { time: timeSem('conversa_e_ferramentas') })
    montar()
    await waitFor(() => expect(avisoDeSuspensao('conversa_e_ferramentas')).not.toBeNull())

    expect(seloDe('plano_de_aula')).not.toBeNull()
    expect(seloDe('atividade_objetiva')).not.toBeNull()
    expect(seloDe('adaptacao')).toBeNull()
    expect(avisoDeSuspensao('conversa_e_ferramentas')?.textContent).toBe(TEXTO_DA_SUSPENSAO.conversa_e_ferramentas)
    // Duas ferramentas são da mesma função: a frase dela sai uma vez só, e não uma por cartão.
    expect(document.querySelectorAll('[data-funcao-suspensa]')).toHaveLength(1)
    // A frase manda a professora para onde o que ela gerou mora hoje (Criados), e não para a tela em que ela já está.
    expect(TEXTO_DA_SUSPENSAO.conversa_e_ferramentas).toContain('continua em Criados')
    expect(avisoDeSuspensao('adaptacao')).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('o time ainda não respondeu: os cartões estão na tela, sem selo e sem aviso', async () => {
    const rede = fakeNetwork()
    instalar(rede, { time: nuncaResponde })
    montar()
    await screen.findByRole('heading', { level: 2, name: 'Planejar' })
    await waitFor(() => expect(chamadasA(rede, '/v1/time')).toHaveLength(1))

    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.queryByText('Suspensa pela coordenação')).toBeNull()
    expect(screen.queryByText(/Não foi possível conferir/)).toBeNull()
  })

  it('a leitura do time falha: os cartões ficam, um aviso diz que não foi possível conferir, e "Tentar de novo" lê outra vez e, com a resposta, o aviso sai e o selo entra', async () => {
    const rede = fakeNetwork()
    const usuario = userEvent.setup()
    let leituras = 0
    let segunda: (resposta: FakeResponse) => void = () => undefined
    instalar(rede, {
      time: () => {
        leituras += 1
        return leituras === 1 ? NAO_ENCONTRADO : new Promise<FakeResponse>((resolver) => (segunda = resolver))
      },
    })
    montar()
    const aviso = await screen.findByText('Não foi possível conferir se alguma ferramenta está suspensa')

    expect(aviso.closest('[data-aviso]')?.getAttribute('data-aviso')).toBe('atencao')
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.queryByText('Suspensa pela coordenação')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()

    const botao = screen.getByRole('button', { name: 'Tentar de novo' }) as HTMLButtonElement
    await usuario.click(botao)
    // Enquanto a leitura corre, o botão não aceita um segundo clique e a tela diz que está tentando.
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Tentando de novo…'))
    expect((screen.getByRole('button', { name: 'Tentar de novo' }) as HTMLButtonElement).disabled).toBe(true)
    expect(chamadasA(rede, '/v1/time')).toHaveLength(2)

    segunda(timeSem('adaptacao'))
    await waitFor(() => expect(seloDe('adaptacao')).not.toBeNull())
    expect(screen.queryByText(/Não foi possível conferir/)).toBeNull()
    expect(avisoDeSuspensao('adaptacao')).not.toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })
})

describe('a professora sem turma confirmada', () => {
  it('sem vínculo nenhum: um aviso diz o que falta e leva a Turmas, e os três cartões ficam', async () => {
    const rede = fakeNetwork()
    const usuario = userEvent.setup()
    instalar(rede, { vinculos: SEM_VINCULO })
    const localizacao = montar()
    const aviso = await screen.findByText('Falta uma turma confirmada')

    expect(aviso.closest('[data-aviso]')?.getAttribute('data-aviso')).toBe('info')
    expect(screen.getAllByRole('link')).toHaveLength(3)
    await usuario.click(screen.getByRole('button', { name: 'Ir para Turmas' }))
    expect(localizacao.history?.at(-1)).toBe(PROFESSOR_ROUTES.turmas)
  })

  it('só com vínculo ainda por confirmar: continua sem turma confirmada, e o aviso aparece', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: { status: 200, corpo: { itens: [vinculo('pendente')] } } })
    montar()
    expect(await screen.findByText('Falta uma turma confirmada')).toBeTruthy()
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('com uma turma confirmada não há aviso', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: COM_TURMA })
    montar()
    await screen.findByRole('heading', { level: 2, name: 'Planejar' })
    await waitFor(() => expect(chamadasA(rede, '/v1/meus-vinculos')).toHaveLength(1))
    await naoApareceDepoisDaLeitura('Falta uma turma confirmada')
    expect(screen.queryByRole('button', { name: 'Ir para Turmas' })).toBeNull()
  })

  it('a leitura dos vínculos que falha: silêncio de propósito, sem aviso de turma e sem "Tentar de novo", e os três cartões ficam', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: NAO_ENCONTRADO })
    montar()
    await screen.findByRole('heading', { level: 2, name: 'Planejar' })
    await waitFor(() => expect(chamadasA(rede, '/v1/meus-vinculos')).toHaveLength(1))
    await naoApareceDepoisDaLeitura('Falta uma turma confirmada')

    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('enquanto os vínculos não chegam, o aviso não pisca: os cartões estão lá e nada diz que falta turma', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: nuncaResponde })
    montar()
    await screen.findByRole('heading', { level: 2, name: 'Planejar' })
    await waitFor(() => expect(chamadasA(rede, '/v1/meus-vinculos')).toHaveLength(1))

    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.queryByText('Falta uma turma confirmada')).toBeNull()
  })
})
