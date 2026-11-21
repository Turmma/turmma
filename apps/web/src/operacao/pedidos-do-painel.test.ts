import { idDoPedidoSchema, TAMANHO_MAXIMO_SLUG } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { TEXTO_DO_EMAIL_INVALIDO, TEXTO_DO_NOME_INVALIDO } from '../components/pedido-de-convite'
import { pedidoDeConvite, pedidoDeEscola, pedidoDeOrcamento, pedidoDeRede, newRequestId } from './pedidos-do-painel'
import { REGRA_DO_ENDERECO, TEXTO_DO_TETO_FORA_DO_INTERVALO, TEXTO_DO_VALOR_FORA_DO_INTERVALO } from './textos'

const REDE = '3f2a8c1e-6b7d-4e9a-8c21-5d4f0e9b7a61'
const ID = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d'

describe('o id do pedido de rede e de escola (Tech Spec da A0b, seção 5, "Idempotência")', () => {
  it('é um UUID v4 que o contrato aceita, e cada abertura de diálogo sorteia outro', () => {
    const ids = Array.from({ length: 500 }, newRequestId)
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      expect(idDoPedidoSchema.safeParse(id).success).toBe(true)
    }
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('o pedido de rede, pelo contrato estrito da API', () => {
  it('sai com o nome sem os espaços das pontas: a nova tentativa manda os mesmos dados para o mesmo id', () => {
    const primeira = pedidoDeRede(ID, { nome: '  Rede Municipal de Joinville ', tipo: 'prefeitura' })
    const segunda = pedidoDeRede(ID, { nome: 'Rede Municipal de Joinville', tipo: 'prefeitura' })
    expect(primeira).toEqual({ ok: true, pedido: { id: ID, nome: 'Rede Municipal de Joinville', tipo: 'prefeitura' } })
    expect(segunda).toEqual(primeira)
  })

  it('nome vazio, só de espaços ou acima de 200 volta com o texto do campo, e nada sai', () => {
    for (const nome of ['', '   ', 'x'.repeat(201)]) expect(pedidoDeRede(ID, { nome, tipo: 'grupo' })).toEqual({ ok: false, erros: { nome: TEXTO_DO_NOME_INVALIDO } })
    expect(pedidoDeRede(ID, { nome: 'x'.repeat(200), tipo: 'grupo' }).ok).toBe(true)
  })
})

describe('o pedido de escola, pelo contrato estrito da API', () => {
  it('sai com o nome e o endereço sem os espaços das pontas', () => {
    expect(pedidoDeEscola(ID, { redeId: REDE, nome: ' Colégio Horizonte ', slug: ' colegio-horizonte ' })).toEqual({
      ok: true,
      pedido: { id: ID, redeId: REDE, nome: 'Colégio Horizonte', slug: 'colegio-horizonte' },
    })
  })

  it('o endereço fora da regra visível volta com a regra no campo: maiúscula, acento, espaço, hífen na ponta ou dobrado, e acima de 63', () => {
    for (const slug of ['Colegio', 'colégio', 'colegio horizonte', '-colegio', 'colegio-', 'colegio--horizonte', 'a'.repeat(TAMANHO_MAXIMO_SLUG + 1), '']) {
      expect(pedidoDeEscola(ID, { redeId: REDE, nome: 'Colégio', slug })).toEqual({ ok: false, erros: { slug: REGRA_DO_ENDERECO } })
    }
    expect(pedidoDeEscola(ID, { redeId: REDE, nome: 'Colégio', slug: 'a'.repeat(TAMANHO_MAXIMO_SLUG) }).ok).toBe(true)
  })

  it('sem rede escolhida, e com o nome vazio, cada campo volta com o seu texto, todos de uma vez', () => {
    expect(pedidoDeEscola(ID, { redeId: '', nome: ' ', slug: 'Errado' })).toEqual({
      ok: false,
      erros: { redeId: 'Escolha a rede da escola.', nome: TEXTO_DO_NOME_INVALIDO, slug: REGRA_DO_ENDERECO },
    })
  })
})

describe('o pedido do convite da coordenação, pelo contrato estrito da API (tarefa 7.0)', () => {
  it('sai com o nome sem os espaços das pontas e o e-mail em minúsculas: é o que o resumo mostra e o que a API grava', () => {
    expect(pedidoDeConvite({ nome: '  Coordenadora Sintética ', email: ' Coord.Sintetica@Escola.INVALID ' })).toEqual({
      ok: true,
      pedido: { nome: 'Coordenadora Sintética', email: 'coord.sintetica@escola.invalid' },
    })
  })

  it('e-mail sem @, sem domínio ou vazio volta com o texto do campo; nome vazio com o dele, os dois de uma vez', () => {
    for (const email of ['', 'coordenacao', 'coordenacao@', '@escola.invalid', 'coordenacao@escola']) {
      expect(pedidoDeConvite({ nome: 'Coordenadora', email }), email).toEqual({ ok: false, erros: { email: TEXTO_DO_EMAIL_INVALIDO } })
    }
    expect(pedidoDeConvite({ nome: '  ', email: 'x' })).toEqual({ ok: false, erros: { nome: TEXTO_DO_NOME_INVALIDO, email: TEXTO_DO_EMAIL_INVALIDO } })
  })
})

describe('o pedido do orçamento de IA, pelo contrato estrito da API (camada-ia, 7.0)', () => {
  const ok = (valorPorAlunoCentavos: number | null, tetoDeSegurancaPercentual: number | null) => ({ ok: true, pedido: { valorPorAlunoCentavos, tetoDeSegurancaPercentual } })

  it('o valor em reais vira centavos, com vírgula ou ponto, e os dois limites passam nos dois lados', () => {
    expect(pedidoDeOrcamento({ valor: '4,00', teto: '200', semValor: false })).toEqual(ok(400, 200))
    expect(pedidoDeOrcamento({ valor: '4.5', teto: '', semValor: false })).toEqual(ok(450, null))
    expect(pedidoDeOrcamento({ valor: ' 0,01 ', teto: '100', semValor: false })).toEqual(ok(1, 100))
    expect(pedidoDeOrcamento({ valor: '100,00', teto: '1000', semValor: false })).toEqual(ok(10_000, 1000))
    expect(pedidoDeOrcamento({ valor: '100', teto: '', semValor: false })).toEqual(ok(10_000, null))
    // 4,10 × 100 não dá 410 em ponto flutuante: o pedido sai arredondado.
    expect(pedidoDeOrcamento({ valor: '4,10', teto: '', semValor: false })).toEqual(ok(410, null))
  })

  it('R$ 0,00, R$ 100,01, texto e mais de duas casas voltam com o texto do valor; 99% e 1001% com o do teto', () => {
    for (const valor of ['0,00', '0', '100,01', '101', 'abc', '4,005', '-1', '1e2', 'R$ 4,00', '']) {
      expect(pedidoDeOrcamento({ valor, teto: '', semValor: false }), valor).toEqual({ ok: false, erros: { valorPorAlunoCentavos: TEXTO_DO_VALOR_FORA_DO_INTERVALO } })
    }
    for (const teto of ['99', '1001', '0', 'abc', '200,5', '-100', '1e3', '0x190']) {
      expect(pedidoDeOrcamento({ valor: '4,00', teto, semValor: false }), teto).toEqual({ ok: false, erros: { tetoDeSegurancaPercentual: TEXTO_DO_TETO_FORA_DO_INTERVALO } })
    }
    expect(pedidoDeOrcamento({ valor: 'x', teto: 'y', semValor: false })).toEqual({
      ok: false,
      erros: { valorPorAlunoCentavos: TEXTO_DO_VALOR_FORA_DO_INTERVALO, tetoDeSegurancaPercentual: TEXTO_DO_TETO_FORA_DO_INTERVALO },
    })
  })

  it('"sem valor" manda null sem ler o campo, e o teto em branco também é null', () => {
    expect(pedidoDeOrcamento({ valor: 'texto que não é valor', teto: '', semValor: true })).toEqual(ok(null, null))
    expect(pedidoDeOrcamento({ valor: '', teto: '300', semValor: true })).toEqual(ok(null, 300))
  })
})
