import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ErroDaApi } from '../api/cliente'
import { ehEnderecoRepetido, ehResultadoIncerto, falhaDoConvite, TEXTO_DA_OPERACAO_INDISPONIVEL, TEXTO_DA_SESSAO_ENCERRADA, TEXTO_DO_ENDERECO_REPETIDO, textoDaFalha, textoDoLimite } from './textos'

/**
 * W10 (mensagens de rede e escola): o que as telas do painel dizem para cada falha. O texto é o do cenário, escrito aqui
 * por extenso, e nenhum mostra o código nem o status (regra 50, item 12).
 */
describe('W10: as mensagens do painel para as falhas de rede e escola', () => {
  it('o 429 diz quanto esperar, com o N do Retry-After, e sem ele diz "em instantes"', () => {
    expect(textoDaFalha(new ErroDaApi(ErrorCode.LIMITE_EXCEDIDO, 7))).toBe('Muitas ações seguidas. Tente de novo em 7 segundos.')
    expect(textoDaFalha(new ErroDaApi(ErrorCode.LIMITE_EXCEDIDO, 1))).toBe('Muitas ações seguidas. Tente de novo em 1 segundo.')
    // Acima de um minuto, o minuto inteiro para cima (`formatarEspera`): dizer menos faria tentar cedo.
    expect(textoDaFalha(new ErroDaApi(ErrorCode.LIMITE_EXCEDIDO, 90))).toBe('Muitas ações seguidas. Tente de novo em 2 minutos.')
    expect(textoDaFalha(new ErroDaApi(ErrorCode.LIMITE_EXCEDIDO))).toBe('Muitas ações seguidas. Tente de novo em instantes.')
    expect(textoDoLimite(Number.NaN)).toBe('Muitas ações seguidas. Tente de novo em instantes.')
  })

  it('o 503 TEMPO_ESGOTADO tem o texto dele, e o 503 da API fora continua com o da operação', () => {
    expect(textoDaFalha(new ErroDaApi(ErrorCode.TEMPO_ESGOTADO))).toBe('A operação demorou demais. Tente de novo em instantes.')
    expect(textoDaFalha(new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toBe(TEXTO_DA_OPERACAO_INDISPONIVEL)
  })

  it('o CONFLITO do criar escola é o endereço repetido, com o texto do campo; os outros códigos não voltam ao campo', () => {
    expect(TEXTO_DO_ENDERECO_REPETIDO).toBe('Esse endereço já é de outra escola. Escolha outro.')
    expect(ehEnderecoRepetido(new ErroDaApi(ErrorCode.CONFLITO))).toBe(true)
    for (const codigo of [ErrorCode.NAO_ENCONTRADO, ErrorCode.ENTRADA_INVALIDA, ErrorCode.TEMPO_ESGOTADO, ErrorCode.LIMITE_EXCEDIDO]) {
      expect(ehEnderecoRepetido(new ErroDaApi(codigo))).toBe(false)
    }
    // O que não veio da API (a tela quebrou) nunca é lido como endereço repetido.
    expect(ehEnderecoRepetido(new Error('CONFLITO'))).toBe(false)
  })

  it('só a conexão que caiu e a resposta fora do contrato deixam incerto se a escola foi criada; recusa do servidor não', () => {
    expect(ehResultadoIncerto(new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toBe(true)
    expect(ehResultadoIncerto(new ErroDaApi(ErrorCode.ERRO_INTERNO))).toBe(true)
    expect(ehResultadoIncerto(new Error('a tela quebrou'))).toBe(true)
    for (const codigo of [ErrorCode.CONFLITO, ErrorCode.TEMPO_ESGOTADO, ErrorCode.LIMITE_EXCEDIDO, ErrorCode.ENTRADA_INVALIDA, ErrorCode.NAO_ENCONTRADO, ErrorCode.SESSAO_ENCERRADA]) {
      expect(ehResultadoIncerto(new ErroDaApi(codigo))).toBe(false)
    }
  })

  it('o 401 leva à entrada com "Sua sessão terminou. Entre de novo para continuar.", o texto que a sessão do operador deixa na entrada', () => {
    // Por extenso, como no W10: se o catálogo mudar, o cenário deixa de ser verdade e este teste fica vermelho.
    expect(TEXTO_DA_SESSAO_ENCERRADA).toBe('Sua sessão terminou. Entre de novo para continuar.')
    expect(TEXTO_DA_SESSAO_ENCERRADA).toBe(MENSAGENS_DE_ERRO.SESSAO_ENCERRADA)
  })

  it('nenhuma mensagem de falha mostra o código, o status ou o identificador do erro', () => {
    for (const codigo of Object.values(ErrorCode)) {
      const texto = textoDaFalha(new ErroDaApi(codigo, 5))
      expect(texto).not.toMatch(/\b(4\d\d|5\d\d)\b/)
      for (const identificador of Object.values(ErrorCode)) expect(texto).not.toContain(identificador)
    }
  })
})

/**
 * W10 (convite): o texto de cada falha de gerar, refazer e revogar, escrito aqui por extenso como no cenário. `CONFLITO` e
 * `NAO_ENCONTRADO` mandam recarregar a lista; o resto fica com o texto de `textoDaFalha`, e o mesmo botão tenta de novo.
 */
describe('W10: as mensagens do convite da coordenação', () => {
  const conflito = new ErroDaApi(ErrorCode.CONFLITO)
  const naoEncontrado = new ErroDaApi(ErrorCode.NAO_ENCONTRADO)

  it('o CONFLITO: no gerar, a escola já tem convite; no refazer e no revogar, o convite mudou; e a lista recarrega', () => {
    expect(falhaDoConvite('gerar', conflito)).toEqual({ texto: 'Esta escola já tem convite. Use Refazer para um link novo.', listaMudou: true })
    expect(falhaDoConvite('refazer', conflito)).toEqual({ texto: 'O convite mudou. A lista foi atualizada.', listaMudou: true })
    expect(falhaDoConvite('revogar', conflito)).toEqual({ texto: 'O convite mudou. A lista foi atualizada.', listaMudou: true })
  })

  it('o NAO_ENCONTRADO: no refazer e no revogar, o convite já não vale; no gerar, a escola não existe; e a lista recarrega', () => {
    expect(falhaDoConvite('revogar', naoEncontrado)).toEqual({ texto: 'Esse convite já não vale. A lista foi atualizada.', listaMudou: true })
    expect(falhaDoConvite('refazer', naoEncontrado)).toEqual({ texto: 'Esse convite já não vale. A lista foi atualizada.', listaMudou: true })
    expect(falhaDoConvite('gerar', naoEncontrado)).toEqual({ texto: 'Essa escola não foi encontrada. A lista foi atualizada.', listaMudou: true })
  })

  it('o 429, o 503 e o TEMPO_ESGOTADO ficam com o texto de sempre, e a lista não mudou: o botão tenta de novo', () => {
    for (const acao of ['gerar', 'refazer', 'revogar'] as const) {
      expect(falhaDoConvite(acao, new ErroDaApi(ErrorCode.LIMITE_EXCEDIDO, 7))).toEqual({ texto: 'Muitas ações seguidas. Tente de novo em 7 segundos.', listaMudou: false })
      expect(falhaDoConvite(acao, new ErroDaApi(ErrorCode.TEMPO_ESGOTADO))).toEqual({ texto: 'A operação demorou demais. Tente de novo em instantes.', listaMudou: false })
      expect(falhaDoConvite(acao, new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toEqual({ texto: TEXTO_DA_OPERACAO_INDISPONIVEL, listaMudou: false })
      // O que não veio da API nunca é lido como "a lista mudou".
      expect(falhaDoConvite(acao, new Error('CONFLITO')).listaMudou).toBe(false)
    }
  })

  it('nenhuma mensagem do convite mostra o código, o status ou o identificador do erro', () => {
    for (const acao of ['gerar', 'refazer', 'revogar'] as const) {
      for (const codigo of Object.values(ErrorCode)) {
        const { texto } = falhaDoConvite(acao, new ErroDaApi(codigo, 5))
        expect(texto).not.toMatch(/\b(4\d\d|5\d\d)\b/)
        for (const identificador of Object.values(ErrorCode)) expect(texto).not.toContain(identificador)
      }
    }
  })
})
