import { describe, expect, it } from 'vitest'
import {
  centavosParaMicros,
  ESCOLAS_POR_PAGINA,
  MICROS_POR_CENTAVO,
  orcamentoDaEscolaNoPainel,
  orcamentoDaRedeNoPainel,
  orcamentoDeIaDoPainelSchema,
  orcamentoDeIaRequestSchema,
  painelQuerySchema,
  conviteDaCoordenacaoRequestSchema,
  criarEscolaRequestSchema,
  criarRedeRequestSchema,
  conviteDaCoordenacaoResponseSchema,
  criadoNoPainelResponseSchema,
  escolasDoPainelResponseSchema,
  redesDoPainelResponseSchema,
  usoDoPainelQuerySchema,
  usoDoPainelResponseSchema,
  usoDeIaDaEscolaDoPainelResponseSchema,
  MESES_DO_USO_DE_IA,
  MAXIMA_PAGINA_DO_PAINEL,
  MAXIMO_DE_REDES_DO_PAINEL,
  REFAZER_CONVITE_POR_ESTADO,
  REVOGAR_CONVITE_POR_ESTADO,
} from './painel.js'

const V4 = '3f1c8a52-6b0e-4d7a-9c21-5e8f0a1b2c3d'
const V7 = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5'
const REDE = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f6'

const SEM_ORCAMENTO = {
  proprio: { valorPorAlunoMicros: null, tetoDeSegurancaPercentual: null },
  vigente: { valorPorAlunoMicros: null, origemDoValor: 'nenhuma', tetoDeSegurancaPercentual: 200, origemDoTeto: 'padrao' },
}
const rede = { id: V4, nome: 'Rede Sintética', tipo: 'grupo' }
const redeDaLista = { ...rede, orcamento: SEM_ORCAMENTO, escolasQueUsamOValorDaRede: 0 }
const escola = { id: V7, redeId: REDE, nome: 'Colégio Sintético', slug: 'colegio-sintetico' }

describe('contratos do painel da operação (Tech Spec da A0b, seção 4)', () => {
  it('o id do pedido é UUID v4 ou v7: sorteado, nunca escolhido à mão (regra 10, item 7)', () => {
    expect(criarRedeRequestSchema.safeParse(rede).success).toBe(true)
    expect(criarRedeRequestSchema.safeParse({ ...rede, id: V7 }).success).toBe(true)
    for (const id of ['00000000-0000-0000-0000-000000000000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8', '1', 'rede-1']) {
      expect(criarRedeRequestSchema.safeParse({ ...rede, id }).success, id).toBe(false)
      expect(criarEscolaRequestSchema.safeParse({ ...escola, id }).success, id).toBe(false)
    }
  })

  it('E12 (contrato): campo a mais, como autor, é recusado nos dois corpos', () => {
    expect(criarRedeRequestSchema.safeParse({ ...rede, autor: 'outra-pessoa' }).success).toBe(false)
    expect(criarEscolaRequestSchema.safeParse({ ...escola, autor: 'outra-pessoa' }).success).toBe(false)
    expect(criarEscolaRequestSchema.safeParse({ ...escola, escolaId: V4 }).success).toBe(false)
  })

  it('o tipo da rede é um dos três, e o slug tem o formato e o tamanho do check do banco', () => {
    expect(criarRedeRequestSchema.safeParse({ ...rede, tipo: 'estado' }).success).toBe(false)
    for (const slug of ['Colegio', 'colegio--x', '-colegio', 'colegio-', 'colégio', `a${'b'.repeat(63)}`, '']) {
      expect(criarEscolaRequestSchema.safeParse({ ...escola, slug }).success, slug).toBe(false)
    }
    expect(criarEscolaRequestSchema.safeParse({ ...escola, slug: `a${'b'.repeat(62)}` }).success).toBe(true)
  })

  it('o nome é de uma linha, sem espaço nas pontas e até 200', () => {
    expect(criarRedeRequestSchema.parse({ ...rede, nome: '  Rede Sintética  ' }).nome).toBe('Rede Sintética')
    for (const nome of ['', '   ', 'Rede\nSintética', 'x'.repeat(201)]) expect(criarRedeRequestSchema.safeParse({ ...rede, nome }).success, nome).toBe(false)
  })

  it('as respostas são estritas: só o id, e a rede só com id, nome, tipo, orçamento e a contagem, até 200', () => {
    expect(criadoNoPainelResponseSchema.safeParse({ id: V4, slug: 'x' }).success).toBe(false)
    expect(redesDoPainelResponseSchema.safeParse({ itens: [{ ...redeDaLista, ipsSaida: [] }] }).success).toBe(false)
    const muitas = Array.from({ length: MAXIMO_DE_REDES_DO_PAINEL + 1 }, () => redeDaLista)
    expect(redesDoPainelResponseSchema.safeParse({ itens: muitas }).success).toBe(false)
    expect(redesDoPainelResponseSchema.safeParse({ itens: muitas.slice(1) }).success).toBe(true)
  })

  it('o pedido do convite da coordenação é estrito: só nome e e-mail, e o e-mail sai sem espaço e em minúsculas', () => {
    const pedido = { nome: 'Coordenação Sintética', email: '  Coordenacao@Escola.Invalid ' }
    expect(conviteDaCoordenacaoRequestSchema.parse(pedido)).toStrictEqual({ nome: 'Coordenação Sintética', email: 'coordenacao@escola.invalid' })
    for (const aMais of [{ autor: 'outra-pessoa' }, { escolaId: V4 }, { token: 'x' }]) expect(conviteDaCoordenacaoRequestSchema.safeParse({ ...pedido, ...aMais }).success).toBe(false)
    for (const email of ['', 'sem-arroba', '@escola.invalid', `${'a'.repeat(250)}@x.io`]) expect(conviteDaCoordenacaoRequestSchema.safeParse({ ...pedido, email }).success, email).toBe(false)
    for (const nome of ['', 'Linha\nDupla', 'x'.repeat(201)]) expect(conviteDaCoordenacaoRequestSchema.safeParse({ ...pedido, nome }).success, nome).toBe(false)
  })

  it('a resposta do convite é estrita: o id e o token de 32 bytes em base64url, e nada da pessoa', () => {
    const token = 'A'.repeat(42) + '_'
    expect(conviteDaCoordenacaoResponseSchema.safeParse({ conviteId: V7, token }).success).toBe(true)
    expect(conviteDaCoordenacaoResponseSchema.safeParse({ conviteId: V7, token, email: 'coordenacao@escola.invalid' }).success).toBe(false)
    for (const invalido of ['A'.repeat(42), 'A'.repeat(44), `${'A'.repeat(42)}=`, `${'A'.repeat(42)}+`]) {
      expect(conviteDaCoordenacaoResponseSchema.safeParse({ conviteId: V7, token: invalido }).success, invalido).toBe(false)
    }
  })

  it('a consulta da lista e do uso: página de 1 em diante e ordem nome ou uso, com os padrões; estrita, sem escola nem filtro', () => {
    expect(painelQuerySchema.parse({})).toStrictEqual({ pagina: 1, ordem: 'nome' })
    expect(painelQuerySchema.parse({ pagina: '3', ordem: 'uso' })).toStrictEqual({ pagina: 3, ordem: 'uso' })
    expect(painelQuerySchema.parse({ pagina: String(MAXIMA_PAGINA_DO_PAINEL) }).pagina).toBe(MAXIMA_PAGINA_DO_PAINEL)
    for (const pagina of ['0', '-1', '1.5', 'x', '', String(MAXIMA_PAGINA_DO_PAINEL + 1), ['1', '2']]) expect(painelQuerySchema.safeParse({ pagina }).success, String(pagina)).toBe(false)
    for (const ordem of ['Nome', 'id', 'requisicoes', ['nome', 'uso']]) expect(painelQuerySchema.safeParse({ ordem }).success, String(ordem)).toBe(false)
    for (const aMais of [{ escolaId: V4 }, { redeId: V4 }, { limite: '100' }]) expect(painelQuerySchema.safeParse(aMais).success).toBe(false)
  })

  it('a resposta da lista é estrita: só id, nome, endereço, rede, estado, convite e número, até 25 por página', () => {
    const item = { id: V7, nome: 'Colégio Sintético', slug: 'colegio-sintetico', rede: { id: REDE, nome: 'Rede Sintética' }, estado: 'pendente', conviteId: V4, turmas: 2, professores: 3, alunos: 40, orcamento: SEM_ORCAMENTO }
    const pagina = { itens: [item], pagina: 1, total: 1 }
    expect(escolasDoPainelResponseSchema.safeParse(pagina).success).toBe(true)
    const { conviteId: _semConvite, ...semConvite } = item
    expect(escolasDoPainelResponseSchema.safeParse({ ...pagina, itens: [{ ...semConvite, estado: 'sem_convite' }] }).success).toBe(true)
    for (const aMais of [{ coordenacao: 'Coordenação Sintética' }, { email: 'coordenacao@escola.invalid' }, { alunosNomes: [] }]) {
      expect(escolasDoPainelResponseSchema.safeParse({ ...pagina, itens: [{ ...item, ...aMais }] }).success).toBe(false)
    }
    expect(escolasDoPainelResponseSchema.safeParse({ ...pagina, itens: [{ ...item, rede: { ...item.rede, tipo: 'grupo' } }] }).success).toBe(false)
    expect(escolasDoPainelResponseSchema.safeParse({ ...pagina, itens: [{ ...item, estado: 'ativo' }] }).success).toBe(false)
    expect(escolasDoPainelResponseSchema.safeParse({ ...pagina, itens: [{ ...item, alunos: -1 }] }).success).toBe(false)
    expect(escolasDoPainelResponseSchema.safeParse({ ...pagina, itens: Array.from({ length: ESCOLAS_POR_PAGINA + 1 }, () => item) }).success).toBe(false)
  })

  it('a consulta do uso aceita também a ordem `custo`, e a da lista não: `custo` é só do uso', () => {
    expect(usoDoPainelQuerySchema.parse({})).toStrictEqual({ pagina: 1, ordem: 'nome' })
    for (const ordem of ['nome', 'uso', 'custo']) expect(usoDoPainelQuerySchema.parse({ pagina: '2', ordem })).toStrictEqual({ pagina: 2, ordem })
    expect(painelQuerySchema.safeParse({ ordem: 'custo' }).success).toBe(false)
    for (const invalida of [{ ordem: 'Custo' }, { ordem: 'tokens' }, { pagina: '0' }, { escolaId: V4 }]) expect(usoDoPainelQuerySchema.safeParse(invalida).success, JSON.stringify(invalida)).toBe(false)
  })

  it('a resposta do uso é estrita: id, nome, dia e mês com as três medidas, o grupo `ia`, e as datas de referência', () => {
    const periodo = { requisicoes: 10, jobs: 2, bytesStorage: 1_048_576 }
    const consumo = { execucoes: 3, chamadas: 5, tokens: 1200, custoMicros: 45_000, chamadasPeloProvedorDeReserva: 1 }
    const ia = { hoje: consumo, mes: consumo, alunosAtivos: 100, valorPorAlunoMicros: 5_000_000, origemDoValor: 'escola', porcentagem: 20, situacao: 'definido' }
    const item = { id: V7, nome: 'Colégio Sintético', rede: { id: REDE, nome: 'Rede Sintética' }, orcamento: SEM_ORCAMENTO, dia: periodo, mes: periodo, ia }
    const resposta = { itens: [item], pagina: 1, total: 1, dia: '2026-09-23', mes: '2026-09' }
    const comIa = (mudanca: object) => ({ ...resposta, itens: [{ ...resposta.itens[0], ia: { ...ia, ...mudanca } }] })
    expect(usoDoPainelResponseSchema.safeParse(resposta).success).toBe(true)
    expect(usoDoPainelResponseSchema.safeParse({ ...resposta, itens: [{ ...resposta.itens[0], slug: 'x' }] }).success).toBe(false)
    // O grupo `ia` é obrigatório e estrito: sem ele, ou com pessoa, função, modelo ou aviso, a resposta é recusada.
    expect(usoDoPainelResponseSchema.safeParse({ ...resposta, itens: [{ id: V7, nome: 'Colégio Sintético', dia: periodo, mes: periodo }] }).success).toBe(false)
    // A rede e o orçamento da escola são obrigatórios e estritos, como na lista de escolas (8.0): o diálogo "Orçamento de IA" abre da linha do uso com eles.
    for (const incompleto of [{ ...item, rede: undefined }, { ...item, orcamento: undefined }]) expect(usoDoPainelResponseSchema.safeParse({ ...resposta, itens: [incompleto] }).success).toBe(false)
    for (const aMais of [{ rede: { id: REDE, nome: 'Rede Sintética', tipo: 'grupo' } }, { rede: { id: REDE } }, { orcamento: { ...SEM_ORCAMENTO, aviso: 80 } }, { orcamento: { proprio: SEM_ORCAMENTO.proprio } }]) {
      expect(usoDoPainelResponseSchema.safeParse({ ...resposta, itens: [{ ...item, ...aMais }] }).success, JSON.stringify(aMais)).toBe(false)
    }
    for (const aMais of [{ alunoId: V4 }, { funcao: 'tutor' }, { modelo: 'x' }, { aviso: 80 }, { tetoDeSegurancaPercentual: 200 }]) expect(usoDoPainelResponseSchema.safeParse(comIa(aMais)).success, JSON.stringify(aMais)).toBe(false)
    expect(usoDoPainelResponseSchema.safeParse(comIa({ hoje: { ...consumo, usuarioId: V4 } })).success).toBe(false)
    // O mês corrente nunca é `sem_retrato`; a porcentagem é inteira e não negativa, ou nula (sem divisão por zero).
    expect(usoDoPainelResponseSchema.safeParse(comIa({ situacao: 'sem_retrato' })).success).toBe(false)
    expect(usoDoPainelResponseSchema.safeParse(comIa({ situacao: 'sem_aluno_ativo', porcentagem: null, valorPorAlunoMicros: null, origemDoValor: 'nenhuma', alunosAtivos: 0 })).success).toBe(true)
    for (const porcentagem of [-1, 1.5, '20']) expect(usoDoPainelResponseSchema.safeParse(comIa({ porcentagem })).success, String(porcentagem)).toBe(false)
    expect(usoDoPainelResponseSchema.safeParse(comIa({ hoje: { ...consumo, custoMicros: -1 } })).success).toBe(false)
    expect(usoDoPainelResponseSchema.safeParse({ ...resposta, itens: [{ ...resposta.itens[0], dia: { ...periodo, custo: 1 } }] }).success).toBe(false)
    for (const dia of ['2026-02-30', '23/09/2026', '2026-9-23']) expect(usoDoPainelResponseSchema.safeParse({ ...resposta, dia }).success, dia).toBe(false)
    for (const mes of ['2026-13', '2026-9', '2026-09-01']) expect(usoDoPainelResponseSchema.safeParse({ ...resposta, mes }).success, mes).toBe(false)
  })
})

/**
 * A matriz estado × ação do convite, escrita aqui por extenso como na tabela da Tech Spec da A0b (seção 5): o servidor
 * decide por ela e a tela a espelha, e por isso ela não pode dizer outra coisa que a tabela.
 */
describe('a matriz do convite da coordenação é a da Tech Spec (A0b, seção 5)', () => {
  it('revogar: `sem_convite` e `revogado` são `NAO_ENCONTRADO`, como a tabela e a rota respondem', () => {
    expect(REVOGAR_CONVITE_POR_ESTADO).toEqual({
      sem_convite: 'nao_encontrado',
      pendente: 'revogar',
      vencido: 'revogar',
      revogado: 'nao_encontrado',
      aceito: 'revogar',
      sem_coordenacao: 'conflito',
      ativa: 'conflito',
    })
  })

  it('refazer: só `pendente` e `vencido`; o `sem_convite` (inalcançável, o id é de convite inexistente) fica em `conflito`', () => {
    expect(REFAZER_CONVITE_POR_ESTADO).toEqual({
      sem_convite: 'conflito',
      pendente: 'refazer',
      vencido: 'refazer',
      revogado: 'conflito',
      aceito: 'conflito',
      sem_coordenacao: 'conflito',
      ativa: 'conflito',
    })
  })
})

/**
 * O orçamento de IA no painel da Operação (camada-ia, 3.0; Tech Spec, seção 4; RF7): o corpo do `PUT` é em centavos e estrito, a resposta é em micros, e a conta do que vale é a mesma da Governança e do lote.
 */
describe('o orçamento de IA no painel da Operação (camada-ia, 3.0)', () => {
  const pedido = { valorPorAlunoCentavos: 500, tetoDeSegurancaPercentual: 200 }

  it('500 centavos são 5.000.000 micros: o fator é de 10.000 micros por centavo', () => {
    expect(MICROS_POR_CENTAVO).toBe(10_000)
    expect(centavosParaMicros(500)).toBe(5_000_000)
    expect(centavosParaMicros(1)).toBe(10_000)
    expect(centavosParaMicros(10_000)).toBe(100_000_000)
  })

  it('os limites do valor: 0 e R$ 100,01 recusam; R$ 0,01 e R$ 100,00 passam; centavo fracionado, texto e fora do inteiro recusam', () => {
    for (const valorPorAlunoCentavos of [0, 10_001, -1, 0.5, 500.5, '500', Number.NaN]) {
      expect(orcamentoDeIaRequestSchema.safeParse({ ...pedido, valorPorAlunoCentavos }).success, String(valorPorAlunoCentavos)).toBe(false)
    }
    for (const valorPorAlunoCentavos of [1, 10_000]) expect(orcamentoDeIaRequestSchema.safeParse({ ...pedido, valorPorAlunoCentavos }).success, String(valorPorAlunoCentavos)).toBe(true)
  })

  it('os limites do teto: 99 e 1001 recusam; 100 e 1000 passam; fracionado recusa', () => {
    for (const tetoDeSegurancaPercentual of [99, 1001, 0, 150.5, '200']) {
      expect(orcamentoDeIaRequestSchema.safeParse({ ...pedido, tetoDeSegurancaPercentual }).success, String(tetoDeSegurancaPercentual)).toBe(false)
    }
    for (const tetoDeSegurancaPercentual of [100, 1000]) expect(orcamentoDeIaRequestSchema.safeParse({ ...pedido, tetoDeSegurancaPercentual }).success, String(tetoDeSegurancaPercentual)).toBe(true)
  })

  it('nulo volta à rede, em cada campo ou nos dois; os dois campos são obrigatórios e o corpo é estrito', () => {
    expect(orcamentoDeIaRequestSchema.safeParse({ valorPorAlunoCentavos: null, tetoDeSegurancaPercentual: null }).success).toBe(true)
    expect(orcamentoDeIaRequestSchema.safeParse({ valorPorAlunoCentavos: null, tetoDeSegurancaPercentual: 200 }).success).toBe(true)
    expect(orcamentoDeIaRequestSchema.safeParse({ valorPorAlunoCentavos: 500, tetoDeSegurancaPercentual: null }).success).toBe(true)
    expect(orcamentoDeIaRequestSchema.safeParse({ valorPorAlunoCentavos: 500 }).success).toBe(false)
    expect(orcamentoDeIaRequestSchema.safeParse({ tetoDeSegurancaPercentual: 200 }).success).toBe(false)
    for (const aMais of [{ autor: 'outra-pessoa' }, { escolaId: V4 }, { redeId: V4 }, { valorPorAlunoMicros: 5_000_000 }]) expect(orcamentoDeIaRequestSchema.safeParse({ ...pedido, ...aMais }).success).toBe(false)
  })

  it('a escola sem valor e a rede com R$ 5: vale o da rede; a precedência é por coluna, e a rede vale com a origem dela', () => {
    const rede5 = { valorPorAlunoMicros: 5_000_000, tetoPercentual: null }
    const nada = { valorPorAlunoMicros: null, tetoPercentual: null }
    expect(orcamentoDaEscolaNoPainel(nada, rede5)).toEqual({
      proprio: { valorPorAlunoMicros: null, tetoDeSegurancaPercentual: null },
      vigente: { valorPorAlunoMicros: 5_000_000, origemDoValor: 'rede', tetoDeSegurancaPercentual: 200, origemDoTeto: 'padrao' },
    })
    // Teto próprio e sem valor: o valor é o da rede e o teto é o da escola.
    expect(orcamentoDaEscolaNoPainel({ valorPorAlunoMicros: null, tetoPercentual: 150 }, { valorPorAlunoMicros: 5_000_000, tetoPercentual: 300 }).vigente).toEqual({
      valorPorAlunoMicros: 5_000_000,
      origemDoValor: 'rede',
      tetoDeSegurancaPercentual: 150,
      origemDoTeto: 'escola',
    })
    // A rede sozinha: o próprio é o que ela define; o vigente tem origem `rede` onde ela definiu e `nenhuma` e `padrao` onde não.
    expect(orcamentoDaRedeNoPainel({ valorPorAlunoMicros: 5_000_000, tetoPercentual: null })).toEqual({
      proprio: { valorPorAlunoMicros: 5_000_000, tetoDeSegurancaPercentual: null },
      vigente: { valorPorAlunoMicros: 5_000_000, origemDoValor: 'rede', tetoDeSegurancaPercentual: 200, origemDoTeto: 'padrao' },
    })
    expect(orcamentoDaRedeNoPainel(nada).vigente).toEqual({ valorPorAlunoMicros: null, origemDoValor: 'nenhuma', tetoDeSegurancaPercentual: 200, origemDoTeto: 'padrao' })
  })

  it('a resposta é estrita: o próprio e o vigente, só valor, teto e origem, e o valor zero ou o teto fora da faixa são recusados', () => {
    expect(orcamentoDeIaDoPainelSchema.safeParse(SEM_ORCAMENTO).success).toBe(true)
    expect(orcamentoDeIaDoPainelSchema.safeParse({ ...SEM_ORCAMENTO, autor: 'joaquim' }).success).toBe(false)
    expect(orcamentoDeIaDoPainelSchema.safeParse({ ...SEM_ORCAMENTO, proprio: { ...SEM_ORCAMENTO.proprio, valorPorAlunoMicros: 0 } }).success).toBe(false)
    expect(orcamentoDeIaDoPainelSchema.safeParse({ ...SEM_ORCAMENTO, vigente: { ...SEM_ORCAMENTO.vigente, tetoDeSegurancaPercentual: 99 } }).success).toBe(false)
    expect(orcamentoDeIaDoPainelSchema.safeParse({ ...SEM_ORCAMENTO, vigente: { ...SEM_ORCAMENTO.vigente, origemDoValor: 'operador' } }).success).toBe(false)
  })
})

describe('o uso de IA dos 12 meses anteriores de uma escola (camada-ia, 5.0)', () => {
  const consumo = { execucoes: 3, chamadas: 5, tokens: 1200, custoMicros: 45_000, chamadasPeloProvedorDeReserva: 1 }
  const fechado = { ...consumo, mes: '2026-03', alunosAtivos: 100, valorPorAlunoMicros: 5_000_000, origemDoValor: 'escola', porcentagem: 20, situacao: 'definido' }
  const semRetrato = { ...consumo, mes: '2026-02', alunosAtivos: null, valorPorAlunoMicros: null, origemDoValor: null, porcentagem: null, situacao: 'sem_retrato' }
  const meses = (quantos: number) => Array.from({ length: quantos }, () => fechado)

  it('são exatamente 12 meses: 11 ou 13 são recusados', () => {
    expect(MESES_DO_USO_DE_IA).toBe(12)
    expect(usoDeIaDaEscolaDoPainelResponseSchema.safeParse({ meses: meses(12) }).success).toBe(true)
    for (const quantos of [0, 11, 13]) expect(usoDeIaDaEscolaDoPainelResponseSchema.safeParse({ meses: meses(quantos) }).success, String(quantos)).toBe(false)
  })

  it('o mês sem retrato leva só o consumo e o resto nulo; o mês é `AAAA-MM`; o item e a resposta são estritos', () => {
    expect(usoDeIaDaEscolaDoPainelResponseSchema.safeParse({ meses: [semRetrato, ...meses(11)] }).success).toBe(true)
    for (const mes of ['2026-13', '2026-3', '2026-03-01', 'março']) expect(usoDeIaDaEscolaDoPainelResponseSchema.safeParse({ meses: [{ ...fechado, mes }, ...meses(11)] }).success, mes).toBe(false)
    for (const aMais of [{ aviso: 80 }, { alunoId: V4 }, { funcao: 'tutor' }, { tetoDeSegurancaPercentual: 200 }]) {
      expect(usoDeIaDaEscolaDoPainelResponseSchema.safeParse({ meses: [{ ...fechado, ...aMais }, ...meses(11)] }).success, JSON.stringify(aMais)).toBe(false)
    }
    expect(usoDeIaDaEscolaDoPainelResponseSchema.safeParse({ meses: meses(12), escolaId: V4 }).success).toBe(false)
    expect(usoDeIaDaEscolaDoPainelResponseSchema.safeParse({ meses: [{ ...fechado, situacao: 'outra' }, ...meses(11)] }).success).toBe(false)
  })
})
