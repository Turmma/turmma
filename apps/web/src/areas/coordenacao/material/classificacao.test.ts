import { ErrorCode, type SecaoDoMaterialResponse } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../api/client'
import {
  assinaturaDaSecao,
  codigosIniciaisDaCorrecao,
  contagemDoReclassificar,
  falhaMudouAClassificacao,
  paginasDaSecao,
  rotuloDaSecao,
  TEXTO_DA_SUSPENSAO,
  TEXTO_DO_CONFLITO_DA_CORRECAO,
  textoDaConfirmacaoDoReclassificar,
  textoDaFalhaDaCorrecao,
  textoDaFalhaDoReclassificar,
  textoDaOrigem,
  textoDoComponenteQueFalta,
  textoDoLimiteDaClassificacao,
  textoDoReclassificarPedido,
  tituloDaSecao,
} from './classificacao'

/** As regras da seção "Habilidades da BNCC" do painel que não dependem do React (classificacao-bncc, 8.0; `cenarios.md`, "Telas"). */

const secao = (parte: Partial<SecaoDoMaterialResponse> = {}): SecaoDoMaterialResponse => ({
  id: '0197a1c0-0000-7000-8000-000000000001',
  ordem: 1,
  paginaInicial: 1,
  paginaFinal: 10,
  capitulo: { numero: 3, titulo: 'Frações' },
  situacao: 'classificada',
  habilidades: [],
  corrigida: false,
  ...parte,
})
const IA = { codigo: 'EF06CI01', descricao: 'Texto', origem: 'ia' as const }
const COORDENACAO = { codigo: 'EF06CI02', descricao: 'Outro texto', origem: 'coordenacao' as const }

describe('o nome do capítulo', () => {
  it('"Capítulo N · título", o título sozinho sem número, e "Páginas X a Y" no bloco de páginas; nunca "trecho" nem "seção"', () => {
    expect(tituloDaSecao(secao())).toBe('Capítulo 3 · Frações')
    expect(tituloDaSecao(secao({ capitulo: { numero: null, titulo: 'Apêndice' } }))).toBe('Apêndice')
    expect(tituloDaSecao(secao({ capitulo: null, paginaInicial: 11, paginaFinal: 20 }))).toBe('Páginas 11 a 20')
    expect(tituloDaSecao(secao({ capitulo: null, paginaInicial: 21, paginaFinal: 21 }))).toBe('Página 21')
    // O capítulo diz as páginas em linha própria; o bloco já as disse no nome.
    expect(paginasDaSecao(secao({ paginaInicial: 5, paginaFinal: 9 }))).toBe('Páginas 5 a 9')
    expect(paginasDaSecao(secao({ capitulo: null }))).toBeUndefined()
  })
})

describe('o rótulo de cada situação', () => {
  it('os cinco, em texto: só a classificada não diz nada, porque as habilidades são o que ela mostra', () => {
    expect(rotuloDaSecao(secao({ situacao: 'nao_agendada' }), false)).toEqual({ texto: 'Ainda não classificado', familia: 'info' })
    expect(rotuloDaSecao(secao({ situacao: 'aguardando' }), false)).toEqual({ texto: 'Classificação à noite', familia: 'pendente' })
    expect(rotuloDaSecao(secao({ situacao: 'classificada', habilidades: [IA] }), false)).toBeUndefined()
    expect(rotuloDaSecao(secao({ situacao: 'sem_habilidade' }), false)).toEqual({ texto: 'A IA não achou habilidade neste capítulo', familia: 'info' })
    expect(rotuloDaSecao(secao({ situacao: 'nao_classificada' }), false)).toEqual({ texto: 'A classificação não terminou.', familia: 'erro' })
  })

  it('o capítulo que a coordenação deixou sem habilidade não diz "a IA não achou": foi a coordenação', () => {
    expect(rotuloDaSecao(secao({ situacao: 'sem_habilidade', corrigida: true }), false)?.texto).toBe('Sem habilidade neste capítulo, como a coordenação corrigiu')
    // O capítulo que a coordenação corrigiu com habilidades segue sem rótulo: as habilidades são o que ele mostra.
    expect(rotuloDaSecao(secao({ situacao: 'classificada', corrigida: true, habilidades: [COORDENACAO] }), false)).toBeUndefined()
  })

  it('com a função suspensa, o capítulo que a IA não terminou fica sem rótulo: quem fala é o aviso da suspensão', () => {
    expect(rotuloDaSecao(secao({ situacao: 'nao_classificada' }), true)).toBeUndefined()
    // Os outros estados seguem como são.
    expect(rotuloDaSecao(secao({ situacao: 'nao_agendada' }), true)?.texto).toBe('Ainda não classificado')
  })
})

describe('a origem das habilidades', () => {
  it('a IA se declara como tal, e a correção diz que é da coordenação; suspensa, a sugestão da IA diz que não vale', () => {
    expect(textoDaOrigem('ia', false)).toBe('Sugerida pela IA')
    expect(textoDaOrigem('coordenacao', false)).toBe('Corrigida pela coordenação')
    expect(textoDaOrigem('ia', true)).toBe('Sugerida pela IA (não vale enquanto a classificação está suspensa)')
    expect(textoDaOrigem('coordenacao', true)).toBe('Corrigida pela coordenação')
  })
})

describe('os códigos com que o editor começa', () => {
  const candidatas = new Set(['EF06CI01', 'EF06CI02'])
  it('os que o capítulo tem hoje; com a função suspensa, só os da coordenação, e nunca um que o recorte atual não aceita', () => {
    const duas = secao({ habilidades: [IA, COORDENACAO] })
    expect(codigosIniciaisDaCorrecao(duas, false, candidatas)).toEqual(['EF06CI01', 'EF06CI02'])
    expect(codigosIniciaisDaCorrecao(duas, true, candidatas)).toEqual(['EF06CI02'])
    // A correção ficou depois de as séries mudarem: o código que deixou de ser candidato não entra, porque a API o recusaria.
    expect(codigosIniciaisDaCorrecao(duas, false, new Set(['EF06CI02']))).toEqual(['EF06CI02'])
  })
})

describe('o "Reclassificar"', () => {
  it('conta o que se refaz e o que a coordenação corrigiu, e o texto da confirmação diz os dois números, no singular e no plural', () => {
    const lista = [secao(), secao(), secao({ corrigida: true }), secao()]
    expect(contagemDoReclassificar(lista)).toEqual({ refeitos: 3, corrigidos: 1 })
    expect(contagemDoReclassificar([])).toEqual({ refeitos: 0, corrigidos: 0 })
    expect(textoDaConfirmacaoDoReclassificar(3, 1)).toBe('3 capítulos serão classificados de novo à noite; 1 corrigido fica como está.')
    expect(textoDaConfirmacaoDoReclassificar(1, 2)).toBe('1 capítulo será classificado de novo à noite; 2 corrigidos ficam como estão.')
    expect(textoDaConfirmacaoDoReclassificar(4, 0)).toBe('4 capítulos serão classificados de novo à noite; 0 corrigidos ficam como estão.')
  })

  it('depois do pedido, a tela diz o que a API aceitou, com os números dela', () => {
    expect(textoDoReclassificarPedido({ secoes: 5, preservadas: 2 })).toBe('Pedido feito. 5 capítulos serão classificados de novo à noite; 2 corrigidos ficam como estão.')
  })
})

describe('o texto de cada falha', () => {
  const erro = (codigo: ErrorCode, espera?: number) => new ApiError(codigo, espera)

  it('o 429 diz em quantos minutos tentar de novo, arredondando para cima, e em instantes sem o `Retry-After`', () => {
    expect(textoDoLimiteDaClassificacao(600)).toBe('Muitas alterações seguidas. Tente de novo em 10 minutos.')
    expect(textoDoLimiteDaClassificacao(61)).toBe('Muitas alterações seguidas. Tente de novo em 2 minutos.')
    expect(textoDoLimiteDaClassificacao(1)).toBe('Muitas alterações seguidas. Tente de novo em 1 minuto.')
    // `Retry-After: 0` (ou menos de um minuto) diz um minuto, e nunca "0 minutos".
    expect(textoDoLimiteDaClassificacao(0)).toBe('Muitas alterações seguidas. Tente de novo em 1 minuto.')
    expect(textoDoLimiteDaClassificacao(undefined)).toBe('Muitas alterações seguidas. Tente de novo em instantes.')
  })

  it('a correção: o 429, o material que ainda não está pronto, o código que não vale mais e o capítulo que saiu; o resto cai no catálogo', () => {
    expect(textoDaFalhaDaCorrecao(erro(ErrorCode.LIMITE_EXCEDIDO, 120))).toBe('Muitas alterações seguidas. Tente de novo em 2 minutos.')
    expect(textoDaFalhaDaCorrecao(erro(ErrorCode.CONFLITO))).toBe(TEXTO_DO_CONFLITO_DA_CORRECAO)
    expect(TEXTO_DO_CONFLITO_DA_CORRECAO).toBe('Este material ainda não terminou de processar. Corrija as habilidades quando ele estiver pronto.')
    expect(textoDaFalhaDaCorrecao(erro(ErrorCode.ENTRADA_INVALIDA))).toMatch(/não vale mais/)
    expect(textoDaFalhaDaCorrecao(erro(ErrorCode.NAO_ENCONTRADO))).toMatch(/já não existe/)
    expect(textoDaFalhaDaCorrecao(erro(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).not.toMatch(/Muitas alterações/)
  })

  it('o "Reclassificar": o 429, a suspensão que veio depois de a tela abrir, o material que não pode e o que saiu', () => {
    expect(textoDaFalhaDoReclassificar(erro(ErrorCode.LIMITE_EXCEDIDO, 300))).toBe('Muitas alterações seguidas. Tente de novo em 5 minutos.')
    expect(textoDaFalhaDoReclassificar(erro(ErrorCode.FUNCAO_SUSPENSA))).toBe(TEXTO_DA_SUSPENSAO)
    expect(textoDaFalhaDoReclassificar(erro(ErrorCode.CONFLITO))).toMatch(/não pode ser classificado de novo agora/)
    expect(textoDaFalhaDoReclassificar(erro(ErrorCode.NAO_ENCONTRADO))).toMatch(/já não existe/)
  })

  it('só a falha que muda o que a tela sabe manda ler de novo; o 429 e a indisponibilidade não', () => {
    for (const codigo of [ErrorCode.NAO_ENCONTRADO, ErrorCode.CONFLITO, ErrorCode.ENTRADA_INVALIDA, ErrorCode.FUNCAO_SUSPENSA]) expect(falhaMudouAClassificacao(erro(codigo)), codigo).toBe(true)
    for (const codigo of [ErrorCode.LIMITE_EXCEDIDO, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO]) expect(falhaMudouAClassificacao(erro(codigo)), codigo).toBe(false)
    expect(falhaMudouAClassificacao(new Error('x'))).toBe(false)
    // Só o `ApiError` vale: um objeto qualquer com o mesmo `codigo` não é a resposta da API.
    expect(falhaMudouAClassificacao({ codigo: ErrorCode.CONFLITO })).toBe(false)
  })
})

describe('os avisos e a assinatura do capítulo', () => {
  it('o aviso do componente nomeia a disciplina e manda para a Estrutura', () => {
    expect(textoDoComponenteQueFalta('Química')).toBe('Defina o componente da BNCC de Química na Estrutura para classificar este material')
  })

  it('a assinatura muda com a situação, a correção e cada habilidade com a origem, e não com a ordem de nada além delas', () => {
    const base = secao({ habilidades: [IA] })
    expect(assinaturaDaSecao(base)).toBe(assinaturaDaSecao(secao({ habilidades: [IA] })))
    expect(assinaturaDaSecao(base)).not.toBe(assinaturaDaSecao(secao({ habilidades: [IA], corrigida: true })))
    expect(assinaturaDaSecao(base)).not.toBe(assinaturaDaSecao(secao({ habilidades: [IA], situacao: 'sem_habilidade' })))
    expect(assinaturaDaSecao(base)).not.toBe(assinaturaDaSecao(secao({ habilidades: [{ ...IA, origem: 'coordenacao' }] })))
    expect(assinaturaDaSecao(base)).not.toBe(assinaturaDaSecao(secao({ habilidades: [IA, COORDENACAO] })))
  })
})
