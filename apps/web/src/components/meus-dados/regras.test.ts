import { CATEGORIAS_DE_RETENCAO, CHAVES_DE_RETENCAO, ErrorCode, ESTADOS_DO_PEDIDO, TIPOS_DE_PEDIDO_DO_TITULAR, type PedidoDeMeusDados } from '@educa/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserTab } from '../pedidos/atualizacao-dos-pedidos'
import {
  agendarPreparacao,
  anuncioDoArquivoBaixado,
  CODIGOS_QUE_MUDAM_OS_MEUS_DADOS,
  INTERVALO_DA_PREPARACAO_MS,
  linhasDoResumo,
  ordenarPedidos,
  podeBaixar,
  relerEnquantoPrepara,
  situacaoDoArquivo,
  situacaoDoPedido,
  TEXTO_DO_ARQUIVO_APAGADO,
  TEXTO_DO_ARQUIVO_EM_PREPARACAO,
  TEXTO_DO_VAZIO,
  TEXTOS_DA_FALHA_DE_BAIXAR,
  textoDaEscola,
} from './regras'

/**
 * "Meus dados" do aluno e do professor (F3, 18.0; RF12 e RF20; `tasks/prd-lgpd-e-titular/cenarios.md`): o que cada pedido
 * diz à própria pessoa, quando o botão de baixar existe, a ordem, o resumo por categoria e o relógio de 10 s do arquivo em
 * preparação. Sem React nem rede: a tela que mostra isso, com a API e o worker de verdade, é do e2e.
 */

const AGORA = new Date('2026-10-10T15:00:00.000Z')
const AMANHA = '2026-10-11T15:00:00.000Z'
const ONTEM = '2026-10-09T15:00:00.000Z'

function pedido(parcial: Partial<PedidoDeMeusDados> = {}): PedidoDeMeusDados {
  return { id: '0190f5a0-0000-4000-8000-000000000001', tipo: 'acesso', estado: 'pronto', chegouEm: '2026-10-05', arquivo: null, ...parcial }
}

describe('quando o arquivo está disponível, em preparação, apagado ou não existe', () => {
  it('disponível: a API diz que vale e o instante dele ainda não passou', () => {
    const disponivel = pedido({ arquivo: { situacao: 'disponivel', expiraEm: AMANHA } })
    expect(situacaoDoArquivo(disponivel, AGORA)).toBe('disponivel')
    expect(podeBaixar(disponivel, AGORA)).toBe(true)
  })

  it('a aba aberta por dias: o arquivo que a API ainda dizia disponível, mas cujo instante passou, não oferece o botão', () => {
    const vencido = pedido({ arquivo: { situacao: 'disponivel', expiraEm: ONTEM } })
    expect(situacaoDoArquivo(vencido, AGORA)).toBe('apagado')
    expect(podeBaixar(vencido, AGORA)).toBe(false)
  })

  it('o arquivo que a API diz expirado fica apagado, mesmo com a data adiante: quem manda é a API', () => {
    const expirado = pedido({ arquivo: { situacao: 'expirado', expiraEm: AMANHA } })
    expect(situacaoDoArquivo(expirado, AGORA)).toBe('apagado')
    expect(podeBaixar(expirado, AGORA)).toBe(false)
  })

  it('acesso e portabilidade em preparação, sem arquivo ainda, estão preparando; os outros tipos em nenhum estado', () => {
    for (const tipo of ['acesso', 'portabilidade'] as const) {
      expect(situacaoDoArquivo(pedido({ tipo, estado: 'em_preparacao' }), AGORA), tipo).toBe('preparando')
    }
    for (const tipo of TIPOS_DE_PEDIDO_DO_TITULAR.filter((tipo) => tipo !== 'acesso' && tipo !== 'portabilidade')) {
      expect(situacaoDoArquivo(pedido({ tipo, estado: 'em_preparacao' }), AGORA), tipo).toBe('nenhum')
    }
  })

  it('sem arquivo e fora de preparação não há o que baixar nem o que esperar', () => {
    for (const estado of ESTADOS_DO_PEDIDO.filter((estado) => estado !== 'em_preparacao')) {
      expect(situacaoDoArquivo(pedido({ estado }), AGORA), estado).toBe('nenhum')
      expect(podeBaixar(pedido({ estado }), AGORA), estado).toBe(false)
    }
  })

  it('em preparação o botão não existe', () => {
    expect(podeBaixar(pedido({ estado: 'em_preparacao' }), AGORA)).toBe(false)
  })
})

describe('o selo e a explicação de cada pedido', () => {
  it('o arquivo pronto diz que dá para baixar, o apagado diz o que fazer, e o em preparação diz que volte em alguns minutos', () => {
    const preparando = situacaoDoPedido(pedido({ estado: 'em_preparacao' }), AGORA)
    expect(preparando).toEqual({ familia: 'info', selo: 'Em preparação', explicacao: 'Estamos preparando o seu arquivo. Volte em alguns minutos.' })
    expect(preparando.explicacao).toBe(TEXTO_DO_ARQUIVO_EM_PREPARACAO)

    const pronto = situacaoDoPedido(pedido({ arquivo: { situacao: 'disponivel', expiraEm: AMANHA } }), AGORA)
    expect(pronto).toMatchObject({ familia: 'ok', selo: 'Pronto para baixar' })

    const apagado = situacaoDoPedido(pedido({ arquivo: { situacao: 'expirado', expiraEm: ONTEM } }), AGORA)
    expect(apagado).toEqual({
      familia: 'info',
      selo: 'Arquivo apagado',
      explicacao: 'O arquivo ficou disponível por 7 dias e foi apagado. Para receber de novo, peça à coordenação.',
    })
    expect(apagado.explicacao).toBe(TEXTO_DO_ARQUIVO_APAGADO)
  })

  it('o pedido sem arquivo fala pelo estado da escola, e cada estado tem texto próprio', () => {
    const textos = ESTADOS_DO_PEDIDO.filter((estado) => estado !== 'em_preparacao').map((estado) => situacaoDoPedido(pedido({ tipo: 'correcao', estado }), AGORA).explicacao)
    // Cinco estados sem arquivo, cinco explicações diferentes: nenhum cai no texto de outro.
    expect(new Set(textos).size).toBe(textos.length)
    expect(situacaoDoPedido(pedido({ tipo: 'compartilhamento', estado: 'recebido' }), AGORA).selo).toBe('Recebido')
    expect(situacaoDoPedido(pedido({ tipo: 'eliminacao', estado: 'cancelado' }), AGORA).selo).toBe('Cancelado')
    expect(situacaoDoPedido(pedido({ tipo: 'correcao', estado: 'concluido' }), AGORA)).toMatchObject({ familia: 'ok', selo: 'Concluído' })
  })

  it('cada estado sem arquivo tem o selo e a família dele: nunca só a cor, e o agendado pede atenção', () => {
    const selos = ESTADOS_DO_PEDIDO.filter((estado) => estado !== 'em_preparacao').map((estado) => {
      const { familia, selo } = situacaoDoPedido(pedido({ tipo: 'eliminacao', estado }), AGORA)
      return { estado, familia, selo }
    })
    expect(selos).toEqual([
      { estado: 'recebido', familia: 'info', selo: 'Recebido' },
      { estado: 'pronto', familia: 'ok', selo: 'Pronto' },
      { estado: 'agendado', familia: 'pendente', selo: 'Eliminação agendada' },
      { estado: 'concluido', familia: 'ok', selo: 'Concluído' },
      { estado: 'cancelado', familia: 'info', selo: 'Cancelado' },
    ])
  })

  it('o vazio é um convite que diz a quem pedir', () => {
    expect(TEXTO_DO_VAZIO).toBe('Para receber uma cópia dos seus dados, peça à coordenação da escola.')
  })
})

describe('a ordem dos pedidos', () => {
  it('o mais recente primeiro, pelo dia em que chegou à escola, e não pela ordem do id que a API entrega', () => {
    const antigo = pedido({ id: 'ffffffff-0000-4000-8000-000000000001', chegouEm: '2026-09-01' })
    const recente = pedido({ id: '00000000-0000-4000-8000-000000000002', chegouEm: '2026-10-08' })
    const meio = pedido({ id: '88888888-0000-4000-8000-000000000003', chegouEm: '2026-09-20' })
    expect(ordenarPedidos([antigo, recente, meio]).map((item) => item.chegouEm)).toEqual(['2026-10-08', '2026-09-20', '2026-09-01'])
  })

  it('no mesmo dia, o id decide, e a lista de entrada não é alterada', () => {
    const a = pedido({ id: 'aaaaaaaa-0000-4000-8000-000000000001', chegouEm: '2026-10-08' })
    const b = pedido({ id: 'bbbbbbbb-0000-4000-8000-000000000002', chegouEm: '2026-10-08' })
    const entrada = [a, b]
    expect(ordenarPedidos(entrada).map((item) => item.id)).toEqual([b.id, a.id])
    expect(entrada.map((item) => item.id)).toEqual([a.id, b.id])
  })
})

describe('o resumo por categoria', () => {
  it('na ordem do catálogo, e não na da resposta, só com o que tem registro', () => {
    const linhas = linhasDoResumo([
      { categoria: 'pessoa_desativada', quantidade: 1 },
      { categoria: 'conversa_tutor', quantidade: 12 },
      { categoria: 'sinal_tutor', quantidade: 0 },
      { categoria: 'trabalho_do_aluno', quantidade: 3 },
    ])
    expect(linhas.map(({ categoria, quantidade }) => ({ categoria, quantidade }))).toEqual([
      { categoria: 'conversa_tutor', quantidade: 12 },
      { categoria: 'trabalho_do_aluno', quantidade: 3 },
      { categoria: 'pessoa_desativada', quantidade: 1 },
    ])
    expect(linhas[0]?.descricao).toBe('As suas conversas com o Tutor')
    // A ordem é a do catálogo da coordenação; o texto de cada linha é o do titular.
    const posicoes = linhas.map(({ categoria }) => CHAVES_DE_RETENCAO.indexOf(categoria))
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b))
  })

  it('sem nenhum registro, a lista é vazia', () => {
    expect(linhasDoResumo([])).toEqual([])
  })

  it('o rótulo é do titular: na segunda pessoa, e nunca a regra de guarda do catálogo', () => {
    const linhas = linhasDoResumo(CHAVES_DE_RETENCAO.map((categoria) => ({ categoria, quantidade: 1 })))

    expect(linhas).toHaveLength(CHAVES_DE_RETENCAO.length)
    for (const { categoria, descricao } of linhas) {
      expect(descricao, categoria).not.toBe(CATEGORIAS_DE_RETENCAO[categoria].descricao)
      expect(descricao, categoria).not.toMatch(/desativad|encerrad|do aluno/i)
    }
    expect(linhas.find((linha) => linha.categoria === 'pessoa_desativada')?.descricao).toBe('O seu cadastro na escola')
    expect(linhas.find((linha) => linha.categoria === 'vinculo_encerrado')?.descricao).toBe('Os seus vínculos com as turmas')
    // A contagem liga esta categoria à pessoa por dois caminhos (o nome dela na lista e quem decidiu): o rótulo diz os dois, e não afirma que foi ela quem pediu.
    expect(linhas.find((linha) => linha.categoria === 'reivindicacao_decidida')?.descricao).toBe('Os pedidos de entrada na turma feitos com o seu nome ou decididos por você')
  })
})

/** A aba como o navegador a dá: o estado de vista e o `visibilitychange`. */
function abaDeMentira(inicio: 'visible' | 'hidden' = 'visible') {
  const ouvintes = new Set<() => void>()
  const aba = {
    visibilityState: inicio,
    addEventListener: (_tipo: 'visibilitychange', ouvinte: () => void) => void ouvintes.add(ouvinte),
    removeEventListener: (_tipo: 'visibilitychange', ouvinte: () => void) => void ouvintes.delete(ouvinte),
  } satisfies BrowserTab as { visibilityState: 'visible' | 'hidden' } & BrowserTab
  return {
    aba,
    ouvintes,
    mudarPara(estado: 'visible' | 'hidden'): void {
      aba.visibilityState = estado
      for (const ouvinte of ouvintes) ouvinte()
    },
  }
}

describe('o arquivo em preparação se relê a cada 10 s, só com a aba à vista', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('o intervalo é de 10 segundos, e só o pedido em preparação se relê sozinho', () => {
    expect(INTERVALO_DA_PREPARACAO_MS).toBe(10_000)
    for (const estado of ESTADOS_DO_PEDIDO) expect(relerEnquantoPrepara([pedido({ estado })]), estado).toBe(estado === 'em_preparacao')
    // Um em preparação entre outros basta, e nenhum pedido não relê.
    expect(relerEnquantoPrepara([pedido({ estado: 'concluido' }), pedido({ estado: 'em_preparacao' })])).toBe(true)
    expect(relerEnquantoPrepara([])).toBe(false)
  })

  it('em preparação, uma leitura a cada 10 s: nenhuma antes, três em meio minuto', () => {
    const atualizar = vi.fn()
    const { aba } = abaDeMentira()
    agendarPreparacao([pedido({ estado: 'em_preparacao' })], atualizar, aba)
    vi.advanceTimersByTime(9_999)
    expect(atualizar).toHaveBeenCalledTimes(0)
    vi.advanceTimersByTime(1)
    expect(atualizar).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(20_000)
    expect(atualizar).toHaveBeenCalledTimes(3)
  })

  it('sem pedido em preparação nada é agendado: nem relógio, nem ouvinte da aba', () => {
    const atualizar = vi.fn()
    const { aba, ouvintes } = abaDeMentira()
    const parar = agendarPreparacao([pedido({ estado: 'pronto' }), pedido({ estado: 'concluido' })], atualizar, aba)
    vi.advanceTimersByTime(60_000)
    expect(atualizar).toHaveBeenCalledTimes(0)
    expect(ouvintes.size).toBe(0)
    parar()
  })

  it('com a aba escondida, para; ao voltar, relê na hora e recomeça a contagem', () => {
    const atualizar = vi.fn()
    const { aba, mudarPara } = abaDeMentira()
    agendarPreparacao([pedido({ estado: 'em_preparacao' })], atualizar, aba)
    vi.advanceTimersByTime(10_000)
    expect(atualizar).toHaveBeenCalledTimes(1)

    mudarPara('hidden')
    vi.advanceTimersByTime(120_000)
    expect(atualizar).toHaveBeenCalledTimes(1)

    mudarPara('visible')
    expect(atualizar).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(10_000)
    expect(atualizar).toHaveBeenCalledTimes(3)
  })

  it('ao parar (a tela saiu, ou o arquivo ficou pronto), o relógio e o ouvinte da aba saem junto', () => {
    const atualizar = vi.fn()
    const { aba, ouvintes } = abaDeMentira()
    const parar = agendarPreparacao([pedido({ estado: 'em_preparacao' })], atualizar, aba)
    expect(ouvintes.size).toBe(1)
    parar()
    expect(ouvintes.size).toBe(0)
    vi.advanceTimersByTime(60_000)
    expect(atualizar).toHaveBeenCalledTimes(0)
  })
})

describe('os textos do download e da escola', () => {
  it('a escola da tela é dita pelo nome, e sem ele a tela diz "a escola ativa"', () => {
    expect(textoDaEscola('Colégio Vista Alegre')).toContain('feitos em Colégio Vista Alegre')
    expect(textoDaEscola(undefined)).toContain('feitos na escola ativa')
    expect(textoDaEscola(undefined)).not.toContain('em a escola')
  })

  it('depois do download, o aviso diz o nome do arquivo e que se apaga num computador da escola', () => {
    expect(anuncioDoArquivoBaixado('meus-dados-2026-10-10.json')).toBe(
      'Arquivo baixado: meus-dados-2026-10-10.json. Se este computador é da escola, apague o arquivo dele depois de usar.',
    )
  })

  it('o arquivo que saiu e o armazém fora têm texto próprio, e só o que saiu muda o que a tela mostra', () => {
    expect(TEXTOS_DA_FALHA_DE_BAIXAR[ErrorCode.NAO_ENCONTRADO]).toContain('foi apagado')
    expect(TEXTOS_DA_FALHA_DE_BAIXAR[ErrorCode.INDISPONIVEL_TENTE_DE_NOVO]).toContain('o arquivo continua guardado')
    expect(CODIGOS_QUE_MUDAM_OS_MEUS_DADOS).toEqual([ErrorCode.NAO_ENCONTRADO])
  })
})
