import { idDoPedidoSchema, TAMANHO_MAXIMO_SLUG } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { TEXTO_DO_EMAIL_INVALIDO, TEXTO_DO_NOME_INVALIDO } from '../components/pedido-de-convite'
import { pedidoDeConvite, pedidoDeEscola, pedidoDeRede, newRequestId } from './pedidos-do-painel'
import { REGRA_DO_ENDERECO } from './textos'

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
