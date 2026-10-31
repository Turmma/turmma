import { ErrorCode, MENSAGENS_DE_ERRO, VALIDADES_DO_ACESSO_DIAS } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ErroDaApi } from '../../../../api/client'
import {
  codigoEmDoisGrupos,
  convitePedido,
  enderecoDoConvite,
  enderecoSemOConvite,
  PARAMETRO_DO_CONVITE,
  TEXTO_DO_ACESSO_QUE_JA_APARECEU,
  codigoSoletrado,
  DITOS_DO_CONVITE_SEM_WHATSAPP,
  falhaDoGerarAcesso,
  rotuloDaValidade,
  TEXTO_DA_TURMA_INDISPONIVEL,
  TEXTO_DO_ACESSO_QUE_CAI,
  textoDaPerguntaDeFechar,
  TEXTOS_DA_FALHA_DO_REVOGAR,
  turmaIndisponivel,
  VALIDADE_PADRAO_DO_ACESSO_DIAS,
} from './acesso-da-turma'

describe('o acesso da turma na tela do professor (A1, 15.0)', () => {
  it('a validade que o diálogo propõe é 7 dias, uma das três que a API aceita, e cada uma tem o nome dela', () => {
    expect(VALIDADE_PADRAO_DO_ACESSO_DIAS).toBe(7)
    expect(VALIDADES_DO_ACESSO_DIAS).toContain(VALIDADE_PADRAO_DO_ACESSO_DIAS)
    expect(VALIDADES_DO_ACESSO_DIAS.map(rotuloDaValidade)).toEqual(['1 dia', '7 dias', '30 dias'])
  })

  it('W7: o código aparece em dois grupos de quatro, e o leitor de tela o recebe soletrado, com a pausa entre os grupos', () => {
    expect(codigoEmDoisGrupos('ABCD2345')).toBe('ABCD 2345')
    expect(codigoSoletrado('ABCD2345')).toBe('A B C D, 2 3 4 5')
  })

  it('sem o WhatsApp, o botão diz o que fez com o convite, sem falar de computador: a tela abre no celular também', () => {
    expect(DITOS_DO_CONVITE_SEM_WHATSAPP.copiado).toBe('O WhatsApp não abriu aqui. O texto do convite foi copiado: cole onde a turma conversa.')
    expect(DITOS_DO_CONVITE_SEM_WHATSAPP.selecionado).toBe(
      'O WhatsApp não abriu aqui. O link está selecionado no campo: copie com Ctrl+C, ou toque e segure no campo e escolha Copiar.',
    )
    for (const dito of Object.values(DITOS_DO_CONVITE_SEM_WHATSAPP)) expect(dito).not.toContain('computador')
  })

  it('W7: "Gerar novo" diz que o acesso de agora cai, também o de outro professor da turma, e que os nomes travados destravam', () => {
    expect(TEXTO_DO_ACESSO_QUE_CAI).toContain('deixam de valer na hora')
    expect(TEXTO_DO_ACESSO_QUE_CAI).toContain('outro professor ou outra professora da turma')
    expect(TEXTO_DO_ACESSO_QUE_CAI).toContain('travados por tentativas com a matrícula errada destravam')
  })

  it('o CONFLITO do gerar diz que outro acesso passou a valer, e o NAO_ENCONTRADO, que a turma saiu do alcance: os dois mudam a seção', () => {
    const conflito = falhaDoGerarAcesso(new ErroDaApi(ErrorCode.CONFLITO))
    expect(conflito.texto).toBe(
      'Outro acesso para esta turma acabou de ser gerado, por outra pessoa ou em outra aba, e é ele que vale. A tela foi atualizada: se o link e o código não estão com você, gere um novo.',
    )
    expect(conflito.secaoMudou).toBe(true)
    expect(falhaDoGerarAcesso(new ErroDaApi(ErrorCode.NAO_ENCONTRADO))).toEqual({ texto: TEXTO_DA_TURMA_INDISPONIVEL, secaoMudou: true })
  })

  it('o resto das falhas do gerar fica com o texto do catálogo, e o mesmo botão tenta de novo; nenhum texto diz o código do erro', () => {
    for (const codigo of [ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, ErrorCode.LIMITE_EXCEDIDO, ErrorCode.ERRO_INTERNO, ErrorCode.TEMPO_ESGOTADO]) {
      expect(falhaDoGerarAcesso(new ErroDaApi(codigo)), codigo).toEqual({ texto: MENSAGENS_DE_ERRO[codigo], secaoMudou: false })
    }
    // O que não veio da API (a tela quebrou no meio) também tem texto, e não muda a seção.
    expect(falhaDoGerarAcesso(new Error('qualquer'))).toEqual({ texto: MENSAGENS_DE_ERRO[ErrorCode.ERRO_INTERNO], secaoMudou: false })
    for (const codigo of Object.values(ErrorCode)) {
      const { texto } = falhaDoGerarAcesso(new ErroDaApi(codigo))
      expect(texto, codigo).not.toContain(codigo)
      expect(texto, codigo).not.toMatch(/\b[45]\d\d\b/)
    }
  })

  it('só o NAO_ENCONTRADO é a turma que saiu do alcance; a queda de rede não é', () => {
    expect(turmaIndisponivel(new ErroDaApi(ErrorCode.NAO_ENCONTRADO))).toBe(true)
    expect(turmaIndisponivel(new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toBe(false)
    expect(turmaIndisponivel(new ErroDaApi(ErrorCode.CONFLITO))).toBe(false)
    expect(turmaIndisponivel(null)).toBe(false)
  })

  it('o revogar do acesso que já não vale diz que a turma não tem acesso ativo', () => {
    expect(TEXTOS_DA_FALHA_DO_REVOGAR).toEqual({ NAO_ENCONTRADO: 'Esta turma já não tem acesso ativo. A tela foi atualizada.' })
  })

  it('a pergunta de fechar fala do link e do código: com o pedido no ar, diz que ainda está sendo gerado', () => {
    expect(textoDaPerguntaDeFechar(true)).toContain('O acesso ainda está sendo gerado')
    expect(textoDaPerguntaDeFechar(false)).toBe(
      'O link e o código aparecem uma vez só. Se fechar agora, eles não aparecem de novo, e para os alunos entrarem será preciso gerar um novo acesso.',
    )
    expect(textoDaPerguntaDeFechar(false)).not.toContain('sendo gerado')
  })

  it('o texto do acesso que já existe diz que o link e o código apareceram uma vez e que, sem eles, só gerando um novo', () => {
    expect(TEXTO_DO_ACESSO_QUE_JA_APARECEU).toBe('O link e o código apareceram uma vez, quando foram gerados. Se eles não estão mais com você, gere um novo acesso.')
  })
})

describe('o endereço do "Convidar alunos" (telas do professor, 13.0)', () => {
  it('só `convidar=1` pede o diálogo, com a aba ou sem ela; qualquer outro valor, ou nenhum, não abre nada', () => {
    expect(PARAMETRO_DO_CONVITE).toBe('convidar')
    expect(convitePedido('convidar=1')).toBe(true)
    expect(convitePedido('aba=alunos&convidar=1')).toBe(true)
    expect(convitePedido('convidar=1&aba=alunos')).toBe(true)
    for (const busca of ['', 'aba=alunos', 'convidar=0', 'convidar=true', 'convidar=', 'convidar=11', 'convidar=1x', 'outro=1']) expect(convitePedido(busca), busca).toBe(false)
  })

  it('"Gerar o acesso" leva à aba Alunos da turma com o pedido, e o endereço não tem mais nada: nenhum token, link nem código', () => {
    const endereco = enderecoDoConvite('/turmas/0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5')
    expect(endereco).toBe('/turmas/0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5?aba=alunos&convidar=1')
    expect(convitePedido(endereco.split('?')[1] ?? '')).toBe(true)
  })

  it('fechar tira só o pedido do endereço: a aba fica, e sem outra busca o caminho vai sozinho', () => {
    expect(enderecoSemOConvite('/turmas/abc', 'aba=alunos&convidar=1')).toBe('/turmas/abc?aba=alunos')
    expect(enderecoSemOConvite('/turmas/abc', 'convidar=1&aba=alunos')).toBe('/turmas/abc?aba=alunos')
    expect(enderecoSemOConvite('/turmas/abc', 'convidar=1')).toBe('/turmas/abc')
    expect(enderecoSemOConvite('/turmas/abc', 'aba=alunos')).toBe('/turmas/abc?aba=alunos')
    expect(convitePedido(enderecoSemOConvite('/turmas/abc', 'aba=alunos&convidar=1').split('?')[1] ?? '')).toBe(false)
  })
})
