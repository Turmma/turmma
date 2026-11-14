import { ErrorCode } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../api/client'
import {
  erroDoRotuloDaEdicao,
  errosDoPainel,
  falhaMudouOMaterial,
  houveMudanca,
  paginasDoCapitulo,
  pedidoDoPatch,
  temEdicaoEmAndamento,
  textoDaFalhaDaEdicao,
  textoDaFalhaDoPatch,
  textoDoLimiteDeAlteracoes,
  tituloDoCapitulo,
} from './material-painel'

/** As regras do painel do material que não dependem do React (ingestao-do-material, 12.0; RF4, RF6, RF10). */

const A = '0197a1c0-0000-7000-8000-000000000001'
const B = '0197a1c0-0000-7000-8000-000000000002'
const material = { titulo: 'Apostila de Química', serieIds: [A] }

describe('o pedido do `PATCH`', () => {
  it('leva só o que mudou: o título aparado, ou as séries, ou os dois', () => {
    expect(pedidoDoPatch(material, { titulo: '  Química 2 ', serieIds: [A] })).toEqual({ titulo: 'Química 2' })
    expect(pedidoDoPatch(material, { titulo: material.titulo, serieIds: [A, B] })).toEqual({ serieIds: [A, B] })
    expect(pedidoDoPatch(material, { titulo: 'Química 2', serieIds: [B] })).toEqual({ titulo: 'Química 2', serieIds: [B] })
    // Tirar uma série também é mudança: as séries de antes são as duas, e a pessoa deixou só uma.
    expect(pedidoDoPatch({ titulo: 'x', serieIds: [A, B] }, { titulo: 'x', serieIds: [A] })).toEqual({ serieIds: [A] })
    expect(houveMudanca(material, { titulo: 'Outro', serieIds: [A] })).toBe(true)
    expect(houveMudanca(material, { titulo: material.titulo, serieIds: [A, B] })).toBe(true)
  })

  it('sem mudança, a ordem das séries e os espaços das pontas do título não fazem pedido', () => {
    expect(pedidoDoPatch(material, { titulo: `  ${material.titulo}  `, serieIds: [A] })).toBeUndefined()
    expect(pedidoDoPatch({ titulo: 'x', serieIds: [A, B] }, { titulo: 'x', serieIds: [B, A] })).toBeUndefined()
    expect(houveMudanca({ titulo: 'x', serieIds: [A, B] }, { titulo: 'x', serieIds: [B, A] })).toBe(false)
  })

  it('com erro no formulário (título vazio ou sem série), não há pedido, e cada campo diz o que fazer', () => {
    expect(pedidoDoPatch(material, { titulo: '   ', serieIds: [A, B] })).toBeUndefined()
    expect(pedidoDoPatch(material, { titulo: 'Química 2', serieIds: [] })).toBeUndefined()
    expect(errosDoPainel({ titulo: '', serieIds: [] })).toEqual({
      titulo: 'Dê um título ao material, como ele aparece no livro ou na apostila.',
      serieIds: 'Marque ao menos uma série: é por ela que o professor e o Tutor acham o material.',
    })
    expect(errosDoPainel({ titulo: 'x', serieIds: [A] })).toEqual({})
  })

  it('o título passa do teto de 160 caracteres: erro, e nenhum pedido', () => {
    expect(errosDoPainel({ titulo: 'x'.repeat(161), serieIds: [A] }).titulo).toMatch(/no máximo 160/)
    expect(pedidoDoPatch(material, { titulo: 'x'.repeat(161), serieIds: [A] })).toBeUndefined()
  })
})

describe('a edição em andamento', () => {
  const alvo = { id: A, estado: 'pronto' as const, substitui: null }
  it('o material com uma edição `processando` sobre ele, ou que é essa edição, está com edição em andamento', () => {
    expect(temEdicaoEmAndamento(alvo, [alvo, { estado: 'processando', substitui: A }])).toBe(true)
    expect(temEdicaoEmAndamento({ id: B, estado: 'processando', substitui: A }, [alvo])).toBe(true)
  })

  it('a edição que já ficou pronta ou que falhou, a que substitui outro material e o material sem edição não contam', () => {
    expect(temEdicaoEmAndamento(alvo, [{ estado: 'pronto', substitui: A }])).toBe(false)
    expect(temEdicaoEmAndamento(alvo, [{ estado: 'falhou', substitui: A }])).toBe(false)
    expect(temEdicaoEmAndamento(alvo, [{ estado: 'processando', substitui: B }])).toBe(false)
    // O material inicial ainda sendo lido não é edição de ninguém: o `PATCH` o aceita.
    expect(temEdicaoEmAndamento({ id: A, estado: 'processando', substitui: null }, [])).toBe(false)
  })
})

describe('os capítulos', () => {
  it('o título leva o número que o PDF escreve, quando há; as páginas, no singular quando é uma só', () => {
    expect(tituloDoCapitulo({ numero: 3, titulo: 'Frações' })).toBe('Capítulo 3 · Frações')
    expect(tituloDoCapitulo({ numero: null, titulo: 'Apêndice' })).toBe('Apêndice')
    expect(tituloDoCapitulo({ numero: 0, titulo: 'Apresentação' })).toBe('Capítulo 0 · Apresentação')
    expect(paginasDoCapitulo({ paginaInicial: 12, paginaFinal: 20 })).toBe('Páginas 12 a 20')
    expect(paginasDoCapitulo({ paginaInicial: 6, paginaFinal: 6 })).toBe('Página 6')
  })
})

describe('o texto de cada falha', () => {
  const agora = new Date('2026-11-14T15:00:00.000Z')

  it('os quatro erros do que a tela envia: edição em andamento, licença vencida, limite com a hora e 503', () => {
    expect(textoDaFalhaDoPatch(new ApiError(ErrorCode.EDICAO_EM_ANDAMENTO))).toBe('Espere a edição em processamento terminar.')
    expect(textoDaFalhaDaEdicao(new ApiError(ErrorCode.EDICAO_EM_ANDAMENTO))).toBe('Espere a edição em processamento terminar.')
    expect(textoDaFalhaDaEdicao(new ApiError(ErrorCode.LICENCA_VENCIDA))).toBe('A licença deste material não está vigente. Atualize a vigência em Licenças e envie de novo.')
    // 15:00 UTC são 12:00 em São Paulo; 10 minutos de espera.
    expect(textoDaFalhaDoPatch(new ApiError(ErrorCode.LIMITE_EXCEDIDO, 600), agora)).toBe('Muitas alterações por agora. Tente de novo às 12:10.')
    expect(textoDaFalhaDaEdicao(new ApiError(ErrorCode.LIMITE_EXCEDIDO, 600), agora)).toBe('Muitos envios por agora. Tente de novo às 12:10.')
    expect(textoDaFalhaDoPatch(new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toBe('As alterações não foram salvas. Tente de novo em instantes.')
    expect(textoDaFalhaDaEdicao(new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toBe('O envio não foi concluído. Tente de novo em instantes.')
  })

  it('o limite sem `Retry-After` não inventa uma hora', () => {
    expect(textoDoLimiteDeAlteracoes(undefined, agora)).toBe('Muitas alterações por agora. Tente de novo em instantes.')
    expect(textoDaFalhaDaEdicao(new ApiError(ErrorCode.LIMITE_EXCEDIDO), agora)).toBe('Muitos envios por agora. Tente de novo em instantes.')
  })

  it('o material que sumiu diz que a lista foi atualizada; o que não é da tela cai no texto do catálogo, sem o código', () => {
    expect(textoDaFalhaDoPatch(new ApiError(ErrorCode.NAO_ENCONTRADO))).toMatch(/A lista foi atualizada\.$/)
    expect(textoDaFalhaDaEdicao(new ApiError(ErrorCode.NAO_ENCONTRADO))).toMatch(/A lista foi atualizada\.$/)
    expect(textoDaFalhaDoPatch(new ApiError(ErrorCode.ERRO_INTERNO))).not.toMatch(/ERRO_INTERNO/)
  })

  it('só o material que sumiu ou a edição que começou mudam o que o painel mostra', () => {
    expect(falhaMudouOMaterial(new ApiError(ErrorCode.NAO_ENCONTRADO))).toBe(true)
    expect(falhaMudouOMaterial(new ApiError(ErrorCode.EDICAO_EM_ANDAMENTO))).toBe(true)
    expect(falhaMudouOMaterial(new ApiError(ErrorCode.LIMITE_EXCEDIDO))).toBe(false)
    expect(falhaMudouOMaterial(new Error('x'))).toBe(false)
  })

  it('o nome da edição tem no máximo 60 caracteres', () => {
    expect(erroDoRotuloDaEdicao('2ª edição')).toBeUndefined()
    expect(erroDoRotuloDaEdicao('x'.repeat(60))).toBeUndefined()
    expect(erroDoRotuloDaEdicao('x'.repeat(61))).toMatch(/no máximo 60/)
  })
})
