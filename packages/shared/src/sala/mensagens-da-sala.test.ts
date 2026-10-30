import { describe, expect, it } from 'vitest'
import { ErrorCode } from '../errors/error-code.js'
import { MENSAGENS_DA_SALA, mensagemDaSala, mensagemDoLimiteDaSala, minutosDaEspera } from './mensagens-da-sala.js'

/** W9 (`tasks/prd-apresentacao-escola/cenarios.md`): os textos exatos da página pública da turma. */
describe('W9: MENSAGENS_DA_SALA', () => {
  it('o NAO_ENCONTRADO é escolhido pelo caminho que a página usou, e não pelo que o servidor respondeu', () => {
    expect(mensagemDaSala(ErrorCode.NAO_ENCONTRADO, { caminho: 'codigo' })).toBe(
      'Não encontramos turma com este código. Confira as letras e os números; se estiver certo, peça o código atual ao professor.',
    )
    expect(mensagemDaSala(ErrorCode.NAO_ENCONTRADO, { caminho: 'link' })).toBe('Este link não vale mais. Peça o código atual ao professor.')
  })

  it('a recusa é um texto só, nos dois caminhos, que não diz se foi o nome ou a matrícula', () => {
    const texto = 'Não foi possível enviar. Confira a matrícula; se estiver certa, chame o professor.'
    expect(mensagemDaSala(ErrorCode.REIVINDICACAO_RECUSADA, { caminho: 'codigo' })).toBe(texto)
    expect(mensagemDaSala(ErrorCode.REIVINDICACAO_RECUSADA, { caminho: 'link' })).toBe(texto)
  })

  it('o limite diz os minutos do Retry-After arredondados para cima, no mínimo 1, com o singular', () => {
    expect(mensagemDaSala(ErrorCode.LIMITE_EXCEDIDO, { caminho: 'codigo', esperaSegundos: 600 })).toBe('Muitas tentativas agora. Espere 10 minutos ou chame o professor.')
    expect(mensagemDoLimiteDaSala(60)).toBe('Muitas tentativas agora. Espere 1 minuto ou chame o professor.')
    expect(mensagemDoLimiteDaSala(61)).toBe('Muitas tentativas agora. Espere 2 minutos ou chame o professor.')
    expect(mensagemDoLimiteDaSala(1)).toBe('Muitas tentativas agora. Espere 1 minuto ou chame o professor.')
    // O `Retry-After` de zero (a janela acabando) ainda diz 1 minuto: "0 minutos" faria o aluno tentar na hora.
    expect(mensagemDoLimiteDaSala(0)).toBe('Muitas tentativas agora. Espere 1 minuto ou chame o professor.')
    expect(minutosDaEspera(119)).toBe(2)
    expect(minutosDaEspera(120)).toBe(2)
    expect(minutosDaEspera(121)).toBe(3)
  })

  it('o limite é o mesmo pelo nome e pelo rl:ip, e sem o Retry-After não inventa número', () => {
    expect(mensagemDaSala(ErrorCode.LIMITE_EXCEDIDO, { caminho: 'link', esperaSegundos: 61 })).toBe(mensagemDaSala(ErrorCode.LIMITE_EXCEDIDO, { caminho: 'codigo', esperaSegundos: 61 }))
    expect(mensagemDaSala(ErrorCode.LIMITE_EXCEDIDO, { caminho: 'codigo' })).toBe('Muitas tentativas agora. Espere alguns minutos ou chame o professor.')
    expect(mensagemDoLimiteDaSala(Number.NaN)).toBe(MENSAGENS_DA_SALA.limiteSemEspera)
  })

  it('o limite não promete que um código novo destrava: no rl:ip seria falso', () => {
    for (const espera of [undefined, 30, 600]) expect(mensagemDoLimiteDaSala(espera)).not.toMatch(/código novo|novo código/i)
  })

  it('o 503 diz que a página tenta de novo, e depois do terceiro reenvio só que o sistema está cheio', () => {
    expect(mensagemDaSala(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, { caminho: 'codigo' })).toBe('O sistema está cheio agora. Tentando de novo…')
    expect(mensagemDaSala(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, { caminho: 'link', esgotado: true })).toBe('O sistema está cheio agora.')
  })

  it('nenhum texto, de nenhum código e caminho, traz código de erro, status ou a palavra "computador"', () => {
    for (const codigo of Object.values(ErrorCode))
      for (const caminho of ['link', 'codigo'] as const)
        for (const esgotado of [false, true]) {
          const texto = mensagemDaSala(codigo, { caminho, esperaSegundos: 90, esgotado })
          expect(texto, codigo).not.toMatch(/computador/i)
          expect(texto, codigo).not.toMatch(/\b(?:4\d\d|5\d\d)\b/)
          for (const nome of Object.values(ErrorCode)) expect(texto, codigo).not.toContain(nome)
        }
    for (const texto of Object.values(MENSAGENS_DA_SALA)) expect(texto).not.toMatch(/computador/i)
  })
})
