import { describe, expect, it } from 'vitest'
import {
  ESCOLAS_POR_PAGINA,
  painelQuerySchema,
  conviteDaCoordenacaoRequestSchema,
  criarEscolaRequestSchema,
  criarRedeRequestSchema,
  conviteDaCoordenacaoResponseSchema,
  criadoNoPainelResponseSchema,
  escolasDoPainelResponseSchema,
  redesDoPainelResponseSchema,
  usoDoPainelResponseSchema,
  MAXIMA_PAGINA_DO_PAINEL,
  MAXIMO_DE_REDES_DO_PAINEL,
  REFAZER_CONVITE_POR_ESTADO,
  REVOGAR_CONVITE_POR_ESTADO,
} from './painel.js'

const V4 = '3f1c8a52-6b0e-4d7a-9c21-5e8f0a1b2c3d'
const V7 = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5'
const REDE = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f6'

const rede = { id: V4, nome: 'Rede Sintética', tipo: 'grupo' }
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

  it('as respostas são estritas: só o id, e a rede só com id, nome e tipo, até 200', () => {
    expect(criadoNoPainelResponseSchema.safeParse({ id: V4, slug: 'x' }).success).toBe(false)
    expect(redesDoPainelResponseSchema.safeParse({ itens: [{ ...rede, ipsSaida: [] }] }).success).toBe(false)
    const muitas = Array.from({ length: MAXIMO_DE_REDES_DO_PAINEL + 1 }, () => rede)
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
    const item = { id: V7, nome: 'Colégio Sintético', slug: 'colegio-sintetico', rede: { id: REDE, nome: 'Rede Sintética' }, estado: 'pendente', conviteId: V4, turmas: 2, professores: 3, alunos: 40 }
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

  it('a resposta do uso é estrita: id, nome, dia e mês com as três medidas, e as datas de referência', () => {
    const periodo = { requisicoes: 10, jobs: 2, bytesStorage: 1_048_576 }
    const resposta = { itens: [{ id: V7, nome: 'Colégio Sintético', dia: periodo, mes: periodo }], pagina: 1, total: 1, dia: '2026-09-23', mes: '2026-09' }
    expect(usoDoPainelResponseSchema.safeParse(resposta).success).toBe(true)
    expect(usoDoPainelResponseSchema.safeParse({ ...resposta, itens: [{ ...resposta.itens[0], slug: 'x' }] }).success).toBe(false)
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
