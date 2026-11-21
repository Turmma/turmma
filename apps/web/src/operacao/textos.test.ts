import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import {
  isEnderecoRepetido,
  isResultadoIncerto,
  falhaDoConvite,
  reais,
  RespostaForaDoContrato,
  TEXTO_DA_OPERACAO_INDISPONIVEL,
  TEXTO_DA_SESSAO_ENCERRADA,
  TEXTO_DO_ENDERECO_REPETIDO,
  TEXTO_DO_TETO_FORA_DO_INTERVALO,
  TEXTO_DO_VALOR_FORA_DO_INTERVALO,
  TEXTO_PARA_ATUALIZAR,
  textoDaFalha,
  textoDoErroAoSalvar,
  textoDasEscolasQueMudam,
  textoDoAntesEDepois,
  textoDoLimite,
  textoDoValeHoje,
  valorDoCampoEmReais,
} from './textos'

/**
 * W10 (mensagens de rede e escola): o que as telas do painel dizem para cada falha. O texto é o do cenário, escrito aqui
 * por extenso, e nenhum mostra o código nem o status (regra 50, item 12).
 */
describe('W10: as mensagens do painel para as falhas de rede e escola', () => {
  it('o 429 diz quanto esperar, com o N do Retry-After, e sem ele diz "em instantes"', () => {
    expect(textoDaFalha(new ApiError(ErrorCode.LIMITE_EXCEDIDO, 7))).toBe('Muitas ações seguidas. Tente de novo em 7 segundos.')
    expect(textoDaFalha(new ApiError(ErrorCode.LIMITE_EXCEDIDO, 1))).toBe('Muitas ações seguidas. Tente de novo em 1 segundo.')
    // Acima de um minuto, o minuto inteiro para cima (`formatEspera`): dizer menos faria tentar cedo.
    expect(textoDaFalha(new ApiError(ErrorCode.LIMITE_EXCEDIDO, 90))).toBe('Muitas ações seguidas. Tente de novo em 2 minutos.')
    expect(textoDaFalha(new ApiError(ErrorCode.LIMITE_EXCEDIDO))).toBe('Muitas ações seguidas. Tente de novo em instantes.')
    expect(textoDoLimite(Number.NaN)).toBe('Muitas ações seguidas. Tente de novo em instantes.')
  })

  it('o 503 TEMPO_ESGOTADO tem o texto dele, e o 503 da API fora continua com o da operação', () => {
    expect(textoDaFalha(new ApiError(ErrorCode.TEMPO_ESGOTADO))).toBe('A operação demorou demais. Tente de novo em instantes.')
    expect(textoDaFalha(new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toBe(TEXTO_DA_OPERACAO_INDISPONIVEL)
  })

  it('o CONFLITO do criar escola é o endereço repetido, com o texto do campo; os outros códigos não voltam ao campo', () => {
    expect(TEXTO_DO_ENDERECO_REPETIDO).toBe('Esse endereço já é de outra escola. Escolha outro.')
    expect(isEnderecoRepetido(new ApiError(ErrorCode.CONFLITO))).toBe(true)
    for (const codigo of [ErrorCode.NAO_ENCONTRADO, ErrorCode.ENTRADA_INVALIDA, ErrorCode.TEMPO_ESGOTADO, ErrorCode.LIMITE_EXCEDIDO]) {
      expect(isEnderecoRepetido(new ApiError(codigo))).toBe(false)
    }
    // O que não veio da API (a tela quebrou) nunca é lido como endereço repetido.
    expect(isEnderecoRepetido(new Error('CONFLITO'))).toBe(false)
  })

  it('só a conexão que caiu e a resposta fora do contrato deixam incerto se a escola foi criada; recusa do servidor não', () => {
    expect(isResultadoIncerto(new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toBe(true)
    expect(isResultadoIncerto(new ApiError(ErrorCode.ERRO_INTERNO))).toBe(true)
    expect(isResultadoIncerto(new Error('a tela quebrou'))).toBe(true)
    for (const codigo of [ErrorCode.CONFLITO, ErrorCode.TEMPO_ESGOTADO, ErrorCode.LIMITE_EXCEDIDO, ErrorCode.ENTRADA_INVALIDA, ErrorCode.NAO_ENCONTRADO, ErrorCode.SESSAO_ENCERRADA]) {
      expect(isResultadoIncerto(new ApiError(codigo))).toBe(false)
    }
  })

  it('o estouro do prazo no navegador deixa incerto se a escola foi criada, e o 503 TEMPO_ESGOTADO da API, que é recusa, não', () => {
    expect(isResultadoIncerto(new ApiError(ErrorCode.TEMPO_ESGOTADO, undefined, 'cliente'))).toBe(true)
    expect(isResultadoIncerto(new ApiError(ErrorCode.TEMPO_ESGOTADO))).toBe(false)
  })

  it('o 401 leva à entrada com "Sua sessão terminou. Entre de novo para continuar.", o texto que a sessão do operador deixa na entrada', () => {
    // Por extenso, como no W10: se o catálogo mudar, o cenário deixa de ser verdade e este teste fica vermelho.
    expect(TEXTO_DA_SESSAO_ENCERRADA).toBe('Sua sessão terminou. Entre de novo para continuar.')
    expect(TEXTO_DA_SESSAO_ENCERRADA).toBe(MENSAGENS_DE_ERRO.SESSAO_ENCERRADA)
  })

  it('nenhuma mensagem de falha mostra o código, o status ou o identificador do erro', () => {
    for (const codigo of Object.values(ErrorCode)) {
      const texto = textoDaFalha(new ApiError(codigo, 5))
      expect(texto).not.toMatch(/\b(4\d\d|5\d\d)\b/)
      for (const identificador of Object.values(ErrorCode)) expect(texto).not.toContain(identificador)
    }
  })
})

/**
 * W10 (convite): o texto de cada falha de gerar, refazer e revogar, escrito aqui por extenso como no cenário. `CONFLITO` e
 * `NAO_ENCONTRADO` mandam recarregar a lista; o resto fica com o texto de `errorText`, e o mesmo botão tenta de novo.
 */
describe('W10: as mensagens do convite da coordenação', () => {
  const conflito = new ApiError(ErrorCode.CONFLITO)
  const naoEncontrado = new ApiError(ErrorCode.NAO_ENCONTRADO)

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
      expect(falhaDoConvite(acao, new ApiError(ErrorCode.LIMITE_EXCEDIDO, 7))).toEqual({ texto: 'Muitas ações seguidas. Tente de novo em 7 segundos.', listaMudou: false })
      expect(falhaDoConvite(acao, new ApiError(ErrorCode.TEMPO_ESGOTADO))).toEqual({ texto: 'A operação demorou demais. Tente de novo em instantes.', listaMudou: false })
      expect(falhaDoConvite(acao, new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toEqual({ texto: TEXTO_DA_OPERACAO_INDISPONIVEL, listaMudou: false })
      // O que não veio da API nunca é lido como "a lista mudou".
      expect(falhaDoConvite(acao, new Error('CONFLITO')).listaMudou).toBe(false)
    }
  })

  it('nenhuma mensagem do convite mostra o código, o status ou o identificador do erro', () => {
    for (const acao of ['gerar', 'refazer', 'revogar'] as const) {
      for (const codigo of Object.values(ErrorCode)) {
        const { texto } = falhaDoConvite(acao, new ApiError(codigo, 5))
        expect(texto).not.toMatch(/\b(4\d\d|5\d\d)\b/)
        for (const identificador of Object.values(ErrorCode)) expect(texto).not.toContain(identificador)
      }
    }
  })
})

/** Os textos do diálogo Orçamento de IA (camada-ia, 7.0), escritos por extenso como na `cenarios.md`, seção 4. */
describe('o diálogo Orçamento de IA: os textos', () => {
  const REDE_5 = { valorPorAlunoMicros: 5_000_000, origemDoValor: 'rede', tetoDeSegurancaPercentual: 200, origemDoTeto: 'padrao' } as const

  it('reais com vírgula e duas casas, e o espaço comum depois do R$', () => {
    expect(reais(5_000_000)).toBe('R$ 5,00')
    expect(reais(10_000)).toBe('R$ 0,01')
    expect(reais(100_000_000)).toBe('R$ 100,00')
    expect(reais(4_100_000)).toBe('R$ 4,10')
    expect(valorDoCampoEmReais(4_000_000)).toBe('4,00')
  })

  it('os limites, como o cenário os diz', () => {
    expect(TEXTO_DO_VALOR_FORA_DO_INTERVALO).toBe('Use um valor entre R$ 0,01 e R$ 100,00.')
    expect(TEXTO_DO_TETO_FORA_DO_INTERVALO).toBe('Use de 100% a 1000%.')
  })

  it('"Vale hoje" diz o valor e de quem ele é; sem valor, diz que não há', () => {
    expect(textoDoValeHoje(REDE_5)).toBe('Vale hoje: R$ 5,00 por aluno, da rede.')
    expect(textoDoValeHoje({ ...REDE_5, valorPorAlunoMicros: 3_000_000, origemDoValor: 'escola' })).toBe('Vale hoje: R$ 3,00 por aluno, da escola.')
    expect(textoDoValeHoje({ valorPorAlunoMicros: null, origemDoValor: 'nenhuma', tetoDeSegurancaPercentual: 200, origemDoTeto: 'padrao' })).toBe('Vale hoje: sem valor por aluno.')
  })

  it('o antes e o depois, e as escolas que mudam no singular e no plural', () => {
    expect(textoDoAntesEDepois(REDE_5, { ...REDE_5, valorPorAlunoMicros: 4_000_000 })).toBe('Antes: R$ 5,00 por aluno, teto 200%. Depois: R$ 4,00 por aluno, teto 200%.')
    expect(textoDoAntesEDepois(REDE_5, { ...REDE_5, valorPorAlunoMicros: null, tetoDeSegurancaPercentual: 1000 })).toBe(
      'Antes: R$ 5,00 por aluno, teto 200%. Depois: sem valor por aluno, teto 1.000%.',
    )
    expect(textoDasEscolasQueMudam(3)).toBe('Muda o orçamento de 3 escolas que usam o valor da rede.')
    expect(textoDasEscolasQueMudam(1)).toBe('Muda o orçamento de 1 escola que usa o valor da rede.')
  })

  it('a resposta fora do contrato manda atualizar a página, continua sendo o erro interno para quem decide pelo código, e o erro interno comum não manda', () => {
    expect(textoDaFalha(new RespostaForaDoContrato())).toBe(TEXTO_PARA_ATUALIZAR)
    expect(TEXTO_PARA_ATUALIZAR).toContain('Atualize a página')
    expect(new RespostaForaDoContrato().codigo).toBe(ErrorCode.ERRO_INTERNO)
    expect(isResultadoIncerto(new RespostaForaDoContrato())).toBe(true)
    expect(textoDaFalha(new ApiError(ErrorCode.ERRO_INTERNO))).toBe(MENSAGENS_DE_ERRO[ErrorCode.ERRO_INTERNO])
    // O que o diálogo do orçamento mostra ao salvar é o mesmo texto.
    expect(textoDoErroAoSalvar(new RespostaForaDoContrato())).toBe(TEXTO_PARA_ATUALIZAR)
    expect(textoDoErroAoSalvar(new ApiError(ErrorCode.ERRO_INTERNO))).toBe(MENSAGENS_DE_ERRO[ErrorCode.ERRO_INTERNO])
  })
})
