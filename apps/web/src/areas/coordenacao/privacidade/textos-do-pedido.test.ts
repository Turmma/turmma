import {
  ErrorCode,
  ESTADOS_DO_PEDIDO,
  FINALIDADES_DO_ARQUIVO_DA_ESCOLA,
  MAXIMO_DO_NOME_DO_TITULAR,
  ORIGENS_DO_COMPARTILHAMENTO,
  TIPOS_DE_PEDIDO_DO_TITULAR,
  type CompartilhamentoRow,
  type PedidoDoTitular,
  type SuboperadorDaEscola,
} from '@educa/shared'
import { describe, expect, it } from 'vitest'
import {
  acoesDoPedido,
  CODIGOS_QUE_MUDAM_O_PEDIDO,
  diasEntre,
  EFEITO_DE_CORRIGIR_NOME,
  efeitoDeConcluir,
  nomeDaEmpresa,
  nomeNovoDoTitular,
  orientacaoDoPedido,
  ordenarOCompartilhamento,
  periodoDaLinha,
  PRAZO_DA_DECLARACAO_COMPLETA_DIAS,
  prazoDoPedido,
  ROTULO_DA_FINALIDADE,
  ROTULO_DA_ORIGEM,
  somarDias,
  TEXTO_DO_NOME_IGUAL,
  textoDaTrocaDeNome,
  textoDoPrazo,
  TEXTOS_DA_FALHA_DE_BAIXAR,
  TEXTOS_DA_FALHA_DE_CANCELAR,
  TEXTOS_DA_FALHA_DE_CONCLUIR,
  TEXTOS_DA_FALHA_DE_CORRIGIR_NOME,
} from './textos-do-pedido'
import { TEXTO_DO_HOMONIMO } from './textos-dos-pedidos'

/** Os textos e as regras do detalhe do pedido (F3, 17.0; RF12, RF13, RF13b, RF14 e RF16), sem React. */

type Pedido = Pick<PedidoDoTitular, 'tipo' | 'estado' | 'titular'>
const pessoa = { nome: 'Ana Souza', turmas: ['6º A'] }
const pedido = (parcial: Partial<Pedido>): Pedido => ({
  tipo: 'acesso',
  estado: 'recebido',
  titular: pessoa,
  ...parcial,
})

describe('RF16: o prazo da declaração completa conta da chegada, em 15 dias de calendário', () => {
  it('o prazo é de 15 dias', () => {
    expect(PRAZO_DA_DECLARACAO_COMPLETA_DIAS).toBe(15)
  })

  it('soma e diferença de dias atravessam o fim do mês e o do ano, sem fuso nem hora de verão', () => {
    expect(somarDias('2026-10-01', 15)).toBe('2026-10-16')
    expect(somarDias('2026-12-25', 15)).toBe('2027-01-09')
    expect(somarDias('2028-02-20', 15)).toBe('2028-03-06')
    expect(diasEntre('2026-10-10', '2026-10-16')).toBe(6)
    expect(diasEntre('2026-10-16', '2026-10-10')).toBe(-6)
    expect(diasEntre('2026-10-10', '2026-10-10')).toBe(0)
  })

  it('o pedido aberto diz quantos dias faltam e o dia em que vence; o dia do vencimento ainda é prazo', () => {
    const pedidoAberto = {
      chegouEm: '2026-10-01',
      estado: 'recebido',
    } as const
    expect(prazoDoPedido(pedidoAberto, '2026-10-12')).toEqual({
      situacao: 'aberto',
      ate: '2026-10-16',
      faltam: 4,
    })
    expect(prazoDoPedido(pedidoAberto, '2026-10-16')).toEqual({
      situacao: 'aberto',
      ate: '2026-10-16',
      faltam: 0,
    })
    expect(prazoDoPedido(pedidoAberto, '2026-10-17')).toEqual({
      situacao: 'vencido',
      ate: '2026-10-16',
      atraso: 1,
    })
  })

  it('o texto: faltam N dias com a data; o vencido diz vencido, com o erro e há quantos dias; um dia no singular', () => {
    const aberto = { chegouEm: '2026-10-01', estado: 'em_preparacao' } as const
    expect(textoDoPrazo(prazoDoPedido(aberto, '2026-10-12'))).toEqual({
      familia: 'pendente',
      texto: 'Faltam 4 dias, até 16/10/2026',
    })
    expect(textoDoPrazo(prazoDoPedido(aberto, '2026-10-15'))).toEqual({
      familia: 'pendente',
      texto: 'Falta 1 dia, até 16/10/2026',
    })
    expect(textoDoPrazo(prazoDoPedido(aberto, '2026-10-16'))).toEqual({
      familia: 'pendente',
      texto: 'O prazo vence hoje, 16/10/2026',
    })
    expect(textoDoPrazo(prazoDoPedido(aberto, '2026-10-18'))).toEqual({
      familia: 'erro',
      texto: 'Prazo vencido há 2 dias (venceu em 16/10/2026)',
    })
    expect(textoDoPrazo(prazoDoPedido(aberto, '2026-10-17')).texto).toBe('Prazo vencido há 1 dia (venceu em 16/10/2026)')
  })

  it('o pedido que terminou não tem prazo a cumprir, por mais antigo que seja', () => {
    expect(prazoDoPedido({ chegouEm: '2026-01-01', estado: 'concluido' }, '2026-10-10')).toEqual({ situacao: 'concluido' })
    expect(prazoDoPedido({ chegouEm: '2026-01-01', estado: 'cancelado' }, '2026-10-10')).toEqual({ situacao: 'cancelado' })
    expect(textoDoPrazo({ situacao: 'concluido' }).familia).toBe('ok')
    expect(textoDoPrazo({ situacao: 'cancelado' }).texto).toContain('não há prazo')
  })

  it('a eliminação agendada tem prazo como qualquer pedido aberto: agendar não é atender', () => {
    expect(prazoDoPedido({ chegouEm: '2026-10-01', estado: 'agendado' }, '2026-10-10')).toEqual({ situacao: 'aberto', ate: '2026-10-16', faltam: 6 })
  })
})

describe('as ações do pedido seguem as regras da API: a tela não oferece o que ela recusaria', () => {
  it('concluir: acesso, portabilidade, compartilhamento e correção abertos; nunca a eliminação, nem o pedido que já terminou', () => {
    for (const tipo of TIPOS_DE_PEDIDO_DO_TITULAR) {
      for (const estado of ESTADOS_DO_PEDIDO) {
        const esperado = tipo !== 'eliminacao' && ['recebido', 'em_preparacao', 'pronto'].includes(estado)
        expect(acoesDoPedido(pedido({ tipo, estado })).concluir, `${tipo}/${estado}`).toBe(esperado)
      }
    }
  })

  it('cancelar: só a eliminação agendada', () => {
    for (const tipo of TIPOS_DE_PEDIDO_DO_TITULAR) {
      for (const estado of ESTADOS_DO_PEDIDO) {
        expect(acoesDoPedido(pedido({ tipo, estado })).cancelar, `${tipo}/${estado}`).toBe(tipo === 'eliminacao' && estado === 'agendado')
      }
    }
  })

  it('corrigir o nome: só o pedido de correção recebido ou pronto, e só enquanto a pessoa ainda existe', () => {
    expect(acoesDoPedido(pedido({ tipo: 'correcao', estado: 'recebido' })).corrigirNome).toBe(true)
    expect(acoesDoPedido(pedido({ tipo: 'correcao', estado: 'pronto' })).corrigirNome).toBe(true)
    expect(acoesDoPedido(pedido({ tipo: 'correcao', estado: 'concluido' })).corrigirNome).toBe(false)
    expect(acoesDoPedido(pedido({ tipo: 'correcao', estado: 'recebido', titular: null })).corrigirNome).toBe(false)
    expect(acoesDoPedido(pedido({ tipo: 'acesso', estado: 'recebido' })).corrigirNome).toBe(false)
  })

  it('baixar a versão da escola: acesso e portabilidade com o arquivo pronto, e só', () => {
    for (const tipo of TIPOS_DE_PEDIDO_DO_TITULAR) {
      for (const estado of ESTADOS_DO_PEDIDO) {
        const esperado = (tipo === 'acesso' || tipo === 'portabilidade') && estado === 'pronto'
        expect(acoesDoPedido(pedido({ tipo, estado })).baixar, `${tipo}/${estado}`).toBe(esperado)
      }
    }
  })
})

describe('RF13b: o nome novo é conferido antes de confirmar', () => {
  it('aceita o nome com as pontas aparadas; recusa vazio, igual ao atual e comprido demais', () => {
    expect(nomeNovoDoTitular('  Ana Souza Lima  ', 'Ana Souza')).toEqual({
      ok: true,
      nome: 'Ana Souza Lima',
    })
    expect(nomeNovoDoTitular('   ', 'Ana Souza').ok).toBe(false)
    expect(nomeNovoDoTitular(' Ana Souza ', 'Ana Souza')).toEqual({
      ok: false,
      erro: TEXTO_DO_NOME_IGUAL,
    })
    expect(nomeNovoDoTitular('x'.repeat(MAXIMO_DO_NOME_DO_TITULAR), 'Ana').ok).toBe(true)
    expect(nomeNovoDoTitular('x'.repeat(MAXIMO_DO_NOME_DO_TITULAR + 1), 'Ana').ok).toBe(false)
  })
})

describe('o que a eliminação fez com o nome nos textos livres, sem dizer onde', () => {
  const eliminacao = (parcial: Partial<Pick<PedidoDoTitular, 'estado' | 'nomeTrocado' | 'homonimo'>>) =>
    textoDaTrocaDeNome({
      tipo: 'eliminacao',
      estado: 'agendado',
      nomeTrocado: null,
      homonimo: null,
      ...parcial,
    })

  it('agendada, só o homônimo fala: o nome não será trocado', () => {
    expect(eliminacao({ homonimo: true })).toBe(TEXTO_DO_HOMONIMO)
    expect(eliminacao({ homonimo: false })).toBeUndefined()
    expect(eliminacao({ homonimo: null })).toBeUndefined()
  })

  it('concluída, diz se houve troca, ou por que não houve', () => {
    expect(eliminacao({ estado: 'concluido', nomeTrocado: true })).toContain('trocado por uma marca neutra')
    expect(eliminacao({ estado: 'concluido', nomeTrocado: false, homonimo: true })).toContain('mesmo nome completo')
    expect(eliminacao({ estado: 'concluido', nomeTrocado: false, homonimo: false })).toBe('Nenhum nome foi trocado nos textos livres da escola.')
  })

  it('fora da eliminação, e eliminação cancelada, não diz nada', () => {
    expect(
      textoDaTrocaDeNome({
        tipo: 'acesso',
        estado: 'pronto',
        nomeTrocado: null,
        homonimo: null,
      }),
    ).toBeUndefined()
    // O que a troca de nome diz é só da eliminação: nenhum outro tipo, nem concluído com a marca, nem com homônimo.
    for (const tipo of ['acesso', 'portabilidade', 'compartilhamento', 'correcao'] as const) {
      for (const estado of ['agendado', 'concluido'] as const) {
        expect(textoDaTrocaDeNome({ tipo, estado, nomeTrocado: true, homonimo: true })).toBeUndefined()
      }
    }
    expect(eliminacao({ estado: 'cancelado', homonimo: true })).toBeUndefined()
  })
})

describe('as orientações e as falhas dizem o que fazer, sem código nem texto cru', () => {
  it('a eliminação agendada diz que o cancelamento devolve o acesso, com os 7 dias', () => {
    const texto = orientacaoDoPedido({
      tipo: 'eliminacao',
      estado: 'agendado',
    })
    expect(texto).toContain('7 dias')
    expect(texto).toContain('devolve o acesso')
  })

  it('o arquivo em preparação diz que a página se atualiza; o pronto, por quantos dias fica', () => {
    expect(orientacaoDoPedido({ tipo: 'acesso', estado: 'em_preparacao' })).toContain('atualiza sozinha')
    expect(orientacaoDoPedido({ tipo: 'portabilidade', estado: 'pronto' })).toContain('7 dias')
  })

  it('o que corrigir o nome faz diz onde se corrige a turma, com o nome do lugar de hoje', () => {
    expect(EFEITO_DE_CORRIGIR_NOME).toContain('pela turma, em Escola › Turmas.')
    expect(EFEITO_DE_CORRIGIR_NOME).not.toContain('Estrutura')
  })

  it('a orientação existe só nos estados que pedem uma ação ou uma espera, e cada uma diz o que a coordenação faz', () => {
    const estados = ['recebido', 'em_preparacao', 'pronto', 'agendado', 'concluido', 'cancelado'] as const
    const comOrientacao = {
      acesso: ['em_preparacao', 'pronto'],
      portabilidade: ['em_preparacao', 'pronto'],
      compartilhamento: ['recebido'],
      correcao: ['recebido', 'pronto'],
      eliminacao: ['agendado', 'concluido', 'cancelado'],
    } as const
    for (const tipo of ['acesso', 'portabilidade', 'compartilhamento', 'correcao', 'eliminacao'] as const) {
      for (const estado of estados) {
        const esperada = (comOrientacao[tipo] as readonly string[]).includes(estado)
        expect(orientacaoDoPedido({ tipo, estado }) !== undefined, `${tipo} ${estado}`).toBe(esperada)
      }
    }
    expect(orientacaoDoPedido({ tipo: 'compartilhamento', estado: 'recebido' })).toContain('lista abaixo')
    expect(orientacaoDoPedido({ tipo: 'correcao', estado: 'recebido' })).toContain('Corrija o nome')
    expect(orientacaoDoPedido({ tipo: 'correcao', estado: 'pronto' })).toContain('Corrija o nome')
    // O nome do lugar de hoje: a turma se corrige em Escola › Turmas (X2, 12.0), e a palavra "Estrutura" saiu da tela.
    expect(orientacaoDoPedido({ tipo: 'correcao', estado: 'recebido' })).toContain('pela turma, em Escola › Turmas.')
    expect(orientacaoDoPedido({ tipo: 'correcao', estado: 'recebido' })).not.toContain('Estrutura')
    expect(orientacaoDoPedido({ tipo: 'eliminacao', estado: 'concluido' })).toContain('foram eliminados')
    expect(orientacaoDoPedido({ tipo: 'eliminacao', estado: 'cancelado' })).toContain('foi cancelada')
  })

  it('concluir só fala do arquivo quando há arquivo pronto: acesso e portabilidade prontos; os outros tipos e estados, não', () => {
    const titular = pessoa
    expect(efeitoDeConcluir({ tipo: 'acesso', estado: 'pronto', titular })).toContain('Não apaga o arquivo')
    expect(efeitoDeConcluir({ tipo: 'portabilidade', estado: 'pronto', titular })).toContain('Não apaga o arquivo')
    for (const [tipo, estado] of [
      ['acesso', 'em_preparacao'],
      ['acesso', 'recebido'],
      ['correcao', 'recebido'],
      ['compartilhamento', 'recebido'],
    ] as const) {
      expect(efeitoDeConcluir({ tipo, estado, titular }), `${tipo} ${estado}`).not.toContain('arquivo')
    }
  })

  it('o nome fora do tamanho e o download que não saiu têm texto, e dizem o que fazer', () => {
    expect(TEXTOS_DA_FALHA_DE_CORRIGIR_NOME[ErrorCode.ENTRADA_INVALIDA]).toContain('1 a 200 caracteres')
    expect(TEXTOS_DA_FALHA_DE_BAIXAR[ErrorCode.INDISPONIVEL_TENTE_DE_NOVO]).toContain('Tente de novo')
  })

  it('o pedido que mudou de estado e o pedido que sumiu têm texto próprio em cada ação', () => {
    for (const textos of [TEXTOS_DA_FALHA_DE_CONCLUIR, TEXTOS_DA_FALHA_DE_CANCELAR, TEXTOS_DA_FALHA_DE_CORRIGIR_NOME]) {
      expect(textos[ErrorCode.PEDIDO_EM_ESTADO_INVALIDO]).toBeDefined()
      expect(textos[ErrorCode.NAO_ENCONTRADO]).toBeDefined()
    }
    expect(TEXTOS_DA_FALHA_DE_CANCELAR[ErrorCode.PEDIDO_EM_ESTADO_INVALIDO]).toContain('7 dias')
    expect(TEXTOS_DA_FALHA_DE_BAIXAR[ErrorCode.NAO_ENCONTRADO]).toContain('conta ativa')
    expect(CODIGOS_QUE_MUDAM_O_PEDIDO).toEqual([ErrorCode.PEDIDO_EM_ESTADO_INVALIDO, ErrorCode.NAO_ENCONTRADO])
  })

  it('cada finalidade e cada origem do compartilhamento têm um texto, diferentes entre si', () => {
    const finalidades = FINALIDADES_DO_ARQUIVO_DA_ESCOLA.map((valor) => ROTULO_DA_FINALIDADE[valor])
    expect(new Set(finalidades).size).toBe(FINALIDADES_DO_ARQUIVO_DA_ESCOLA.length)
    const origens = ORIGENS_DO_COMPARTILHAMENTO.map((valor) => ROTULO_DA_ORIGEM[valor])
    expect(new Set(origens).size).toBe(ORIGENS_DO_COMPARTILHAMENTO.length)
  })
})

describe('RF13: as empresas da foto do compartilhamento', () => {
  const linha = (parcial: Partial<CompartilhamentoRow>): CompartilhamentoRow => ({
    suboperadorId: '0197f3b0-6f3e-7c11-9a3e-5d1c2b7a8e41',
    chave: 'maritaca',
    primeiroEm: '2026-09-10T13:00:00.000Z',
    ultimoEm: '2026-09-20T13:00:00.000Z',
    origem: 'rastro',
    ...parcial,
  })
  const suboperador = (parcial: Partial<SuboperadorDaEscola>): SuboperadorDaEscola => ({
    chave: 'maritaca',
    nome: 'Maritaca AI',
    finalidade: 'Modelo de linguagem',
    pais: 'BR',
    categorias: ['conversa_do_aluno'],
    vedaTreinamento: true,
    inicio: '2026-01-01T00:00:00.000Z',
    fim: null,
    ...parcial,
  })

  it('o nome vem do cadastro pela chave; sem cadastro, diz que não está cadastrada, e a lista que não chegou usa a chave', () => {
    expect(nomeDaEmpresa(linha({}), [suboperador({})])).toBe('Maritaca AI')
    expect(nomeDaEmpresa(linha({ suboperadorId: null, chave: 'outra' }), [suboperador({})])).toBe('Provedor não cadastrado: outra')
    expect(nomeDaEmpresa(linha({}), undefined)).toBe('maritaca')
  })

  it('a chave recadastrada rende duas empresas: vale a que estava vigente na última chamada', () => {
    const antigo = suboperador({
      nome: 'Maritaca antiga',
      inicio: '2026-01-01T00:00:00.000Z',
      fim: '2026-09-01T00:00:00.000Z',
    })
    const novo = suboperador({
      nome: 'Maritaca nova',
      inicio: '2026-09-01T00:00:01.000Z',
    })
    expect(nomeDaEmpresa(linha({ ultimoEm: '2026-09-20T13:00:00.000Z' }), [antigo, novo])).toBe('Maritaca nova')
    expect(nomeDaEmpresa(linha({ ultimoEm: '2026-08-20T13:00:00.000Z' }), [antigo, novo])).toBe('Maritaca antiga')
  })

  it('o período é o dia, quando começa e termina no mesmo, ou de um dia até o outro', () => {
    // O dia sai pelo fuso do computador (`formatarDiaDoInstante`), como nos vizinhos: meio-dia de UTC cai no mesmo dia em
    // qualquer fuso de -12 a +11, e a unidade roda em Tóquio (`vitest.config.ts`). 13 h e 18 h de UTC eram o mesmo dia só em
    // São Paulo (10 h e 15 h), e viravam dois dias em Tóquio (22 h e 3 h).
    expect(
      periodoDaLinha({
        primeiroEm: '2026-09-10T12:00:00.000Z',
        ultimoEm: '2026-09-10T12:05:00.000Z',
      }),
    ).toBe('Em 10/09/2026')
    expect(
      periodoDaLinha({
        primeiroEm: '2026-09-10T12:00:00.000Z',
        ultimoEm: '2026-09-20T12:00:00.000Z',
      }),
    ).toBe('De 10/09/2026 até 20/09/2026')
  })

  it('a ordem é a do primeiro dado e, no empate, a da chave', () => {
    const ordenadas = ordenarOCompartilhamento([
      linha({ chave: 'b', primeiroEm: '2026-09-12T00:00:00.000Z' }),
      linha({ chave: 'z', primeiroEm: '2026-09-10T00:00:00.000Z' }),
      linha({ chave: 'a', primeiroEm: '2026-09-12T00:00:00.000Z' }),
    ])
    expect(ordenadas.map(({ chave }) => chave)).toEqual(['z', 'a', 'b'])
  })
})
