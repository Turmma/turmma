import type { QuestaoObjetiva } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import {
  acertosDoLote,
  corrigirTentativa,
  destaquesDaTentativa,
  DISTANCIA_DO_HISTORICO,
  FRACAO_DA_TURMA_QUE_ACERTOU,
  FRACAO_DE_ERROS_ONDE_A_TURMA_ACERTOU,
  MINIMO_DE_COLEGAS_PARA_COMPARAR,
  MINIMO_DE_QUESTOES_NO_HISTORICO,
  MINIMO_DE_QUESTOES_PARA_COMPARAR_COM_O_HISTORICO,
  MINIMO_DE_QUESTOES_QUE_A_TURMA_ACERTOU,
  MINIMO_DE_RESPOSTAS_PARA_MESMA_ALTERNATIVA,
  type HistoricoAprovado,
  type RespostasDaTentativa,
} from './correcao-de-objetiva.js'

const MATERIAL = '018f4e2a-7b1c-7d3e-9a4b-0123456789ab'

/** Uma questão com o gabarito e a habilidade dados (`null` é a questão sem habilidade). O texto é sintético: a conta não o lê. O código antigo (`QUI.EM.05`) é só um texto aqui: a conta o trata como qualquer outro. */
function questao(gabarito: number, codigo: string | null = 'QUI.EM.05'): QuestaoObjetiva {
  return {
    enunciado: 'Enunciado sintético',
    alternativas: ['a', 'b', 'c', 'd'],
    gabarito,
    habilidade: codigo === null ? null : { codigo, descricao: `Habilidade ${codigo}` },
    citacao: { materialId: MATERIAL, pagina: 1, trecho: 'trecho' },
    explicacao: 'explicação',
  }
}

/** As respostas na ordem das questões; `null` é a questão em branco. */
function respostas(...marcadas: (number | null)[]): RespostasDaTentativa {
  return new Map(marcadas.flatMap((alternativa, indice) => (alternativa === null ? [] : [[indice + 1, alternativa] as const])))
}

const GABARITOS = [0, 1, 2, 3, 0]
const QUESTOES = GABARITOS.map((gabarito, indice) => questao(gabarito, indice < 3 ? 'QUI.EM.05' : 'QUI.EM.06'))
const TUDO_CERTO = respostas(...GABARITOS)

/** Os destaques de uma tentativa num lote de `colegas` que acertaram tudo, com o histórico dado. */
function destaques(marcadas: RespostasDaTentativa, { historico, colegas = 0, questoes = QUESTOES }: { historico?: HistoricoAprovado; colegas?: number; questoes?: QuestaoObjetiva[] } = {}) {
  const certo = respostas(...questoes.map((q) => q.gabarito))
  const lote = acertosDoLote(questoes, [marcadas, ...Array.from({ length: colegas }, () => certo)])
  return destaquesDaTentativa({ questoes, respostas: marcadas, correcao: corrigirTentativa(questoes, marcadas), historico, lote })
}

describe('correção de objetiva: a questão sem habilidade (classificacao-bncc, 10.0)', () => {
  it('conta numa linha à parte, com `codigo: null`, e nunca soma à de um código; as duas sem habilidade somam entre si', () => {
    const questoes = [questao(0, 'EM13CNT101'), questao(1, null), questao(2, null), questao(3, 'EM13CNT101')]
    const correcao = corrigirTentativa(questoes, respostas(0, 1, 0, 3))
    expect(correcao.porHabilidade).toEqual([
      { codigo: 'EM13CNT101', acertos: 2, total: 2 },
      { codigo: null, acertos: 1, total: 2 },
    ])
    expect(correcao).toMatchObject({ acertos: 3, total: 4, emBranco: 0 })
  })

  it('a linha sem habilidade segue a ordem da atividade, e não vai para o fim: com a questão 1 sem habilidade, ela vem primeiro no diagnóstico', () => {
    const questoes = [questao(0, null), questao(1, 'EM13CNT101'), questao(2, 'EM13CNT102')]
    expect(corrigirTentativa(questoes, respostas(0, 1, 3)).porHabilidade).toEqual([
      { codigo: null, acertos: 1, total: 1 },
      { codigo: 'EM13CNT101', acertos: 1, total: 1 },
      { codigo: 'EM13CNT102', acertos: 0, total: 1 },
    ])
  })

  it('a atividade toda sem habilidade tem uma linha só, com o total das questões', () => {
    expect(corrigirTentativa([questao(0, null), questao(1, null)], respostas(null, 1)).porHabilidade).toEqual([{ codigo: null, acertos: 1, total: 2 }])
  })
})

describe('correção de objetiva: a conta', () => {
  it('compara cada resposta com o gabarito e conta acertos, total e em branco; a questão errada não é acerto nem branco', () => {
    expect(corrigirTentativa(QUESTOES, respostas(0, 1, 3, null, 0))).toEqual({
      acertos: 3,
      total: 5,
      emBranco: 1,
      porHabilidade: [
        { codigo: 'QUI.EM.05', acertos: 2, total: 3 },
        { codigo: 'QUI.EM.06', acertos: 1, total: 2 },
      ],
    })
  })

  it('a prova em branco tem zero acertos e todas as questões em branco, com o total de cada habilidade', () => {
    expect(corrigirTentativa(QUESTOES, respostas())).toEqual({
      acertos: 0,
      total: 5,
      emBranco: 5,
      porHabilidade: [
        { codigo: 'QUI.EM.05', acertos: 0, total: 3 },
        { codigo: 'QUI.EM.06', acertos: 0, total: 2 },
      ],
    })
  })

  it('o gabarito é o do índice da alternativa: a alternativa de índice 0 só acerta a questão cujo gabarito é 0', () => {
    expect(corrigirTentativa(QUESTOES, respostas(0, 0, 0, 0, 0)).acertos).toBe(2)
    expect(corrigirTentativa(QUESTOES, TUDO_CERTO)).toMatchObject({ acertos: 5, emBranco: 0 })
  })

  it('o que sai é contagem: não há nota, conceito, percentual nem texto', () => {
    expect(Object.keys(corrigirTentativa(QUESTOES, TUDO_CERTO)).sort()).toEqual(['acertos', 'emBranco', 'porHabilidade', 'total'])
  })

  it('resposta em questão que a atividade não tem não conta', () => {
    expect(corrigirTentativa(QUESTOES, new Map([[9, 0]]))).toMatchObject({ acertos: 0, emBranco: 5 })
  })
})

describe('destaques: em branco', () => {
  it('a prova sem resposta nenhuma é destacada como em branco, e só como em branco, mesmo com histórico alto', () => {
    expect(destaques(respostas(), { historico: { acertos: 10, total: 10 } })).toEqual(['em_branco'])
  })

  it('uma questão respondida já não é prova em branco', () => {
    expect(destaques(respostas(0))).toEqual([])
  })
})

describe('destaques: fora do histórico do próprio aluno', () => {
  const historicoAlto: HistoricoAprovado = { acertos: 9, total: 10 }

  it('sem histórico, não dispara, por pior que seja o resultado', () => {
    expect(destaques(respostas(1, 0, 0, 0, 1))).toEqual([])
  })

  it(`histórico com menos de ${String(MINIMO_DE_QUESTOES_NO_HISTORICO)} questões não é histórico: não dispara`, () => {
    expect(destaques(respostas(1, 0, 0, 0, 1), { historico: { acertos: MINIMO_DE_QUESTOES_NO_HISTORICO - 1, total: MINIMO_DE_QUESTOES_NO_HISTORICO - 1 } })).toEqual([])
    expect(destaques(respostas(1, 0, 0, 0, 1), { historico: { acertos: MINIMO_DE_QUESTOES_NO_HISTORICO, total: MINIMO_DE_QUESTOES_NO_HISTORICO } })).toEqual(['fora_do_historico'])
  })

  it('dispara na queda: de 90% no histórico para 20% na atividade', () => {
    expect(destaques(respostas(0, 0, 0, 0, 1), { historico: historicoAlto })).toEqual(['fora_do_historico'])
  })

  it('dispara também no salto para cima: é fato para a professora abrir, não acusação', () => {
    expect(destaques(TUDO_CERTO, { historico: { acertos: 2, total: 10 } })).toEqual(['fora_do_historico'])
  })

  it(`o limiar é a distância de ${String(DISTANCIA_DO_HISTORICO)}: exatamente nela dispara, um pouco abaixo não`, () => {
    // 4 de 5 (0,8) contra 4 de 10 (0,4): distância 0,4.
    expect(destaques(respostas(0, 1, 2, 3, 1), { historico: { acertos: 4, total: 10 } })).toEqual(['fora_do_historico'])
    // 4 de 5 (0,8) contra 5 de 10 (0,5): distância 0,3.
    expect(destaques(respostas(0, 1, 2, 3, 1), { historico: { acertos: 5, total: 10 } })).toEqual([])
  })

  it(`atividade com menos de ${String(MINIMO_DE_QUESTOES_PARA_COMPARAR_COM_O_HISTORICO)} questões não se compara com o histórico`, () => {
    const curta = QUESTOES.slice(0, MINIMO_DE_QUESTOES_PARA_COMPARAR_COM_O_HISTORICO - 1)
    expect(destaques(respostas(1, 0), { historico: historicoAlto, questoes: curta })).toEqual([])
    const noLimite = QUESTOES.slice(0, MINIMO_DE_QUESTOES_PARA_COMPARAR_COM_O_HISTORICO)
    expect(destaques(respostas(1, 0, 0), { historico: historicoAlto, questoes: noLimite })).toEqual(['fora_do_historico'])
  })
})

describe('destaques: padrão de erro', () => {
  it(`a mesma alternativa em todas as respondidas, com erro, a partir de ${String(MINIMO_DE_RESPOSTAS_PARA_MESMA_ALTERNATIVA)} respostas`, () => {
    expect(destaques(respostas(0, 0, 0, 0, null))).toEqual(['padrao_de_erro'])
    expect(destaques(respostas(0, 0, 0, null, null))).toEqual([])
  })

  it('quando o gabarito é mesmo a mesma letra em todas, quem acertou tudo não é destacado', () => {
    const mesmaLetra = [2, 2, 2, 2].map((gabarito) => questao(gabarito))
    expect(destaques(respostas(2, 2, 2, 2), { questoes: mesmaLetra })).toEqual([])
    expect(destaques(respostas(1, 1, 1, 1), { questoes: mesmaLetra })).toEqual(['padrao_de_erro'])
  })

  it('alternativas variadas com erros não formam padrão quando não há turma com que comparar', () => {
    expect(destaques(respostas(1, 2, 3, 0, 1))).toEqual([])
  })

  it(`erro onde a turma quase toda acertou: só com ${String(MINIMO_DE_COLEGAS_PARA_COMPARAR)} colegas ou mais`, () => {
    const errouMetade = respostas(1, 2, 3, 3, 0)
    expect(destaques(errouMetade, { colegas: MINIMO_DE_COLEGAS_PARA_COMPARAR - 1 })).toEqual([])
    expect(destaques(errouMetade, { colegas: MINIMO_DE_COLEGAS_PARA_COMPARAR })).toEqual(['padrao_de_erro'])
  })

  it(`dispara com erro em ${String(FRACAO_DE_ERROS_ONDE_A_TURMA_ACERTOU)} ou mais das questões que a turma quase toda acertou, e não abaixo disso`, () => {
    // Cinco questões que os colegas todos acertaram: três erros (0,6) destacam, dois (0,4) não.
    expect(destaques(respostas(1, 2, 3, 3, 0), { colegas: 6 })).toEqual(['padrao_de_erro'])
    expect(destaques(respostas(1, 2, 2, 3, 0), { colegas: 6 })).toEqual([])
  })

  it('questão em branco não conta como erro: quem deixou em branco onde a turma acertou não tem padrão de erro', () => {
    expect(destaques(respostas(null, null, null, 3, 0), { colegas: 6 })).toEqual([])
  })

  it(`a questão só é das que a turma quase toda acertou com ${String(FRACAO_DA_TURMA_QUE_ACERTOU)} dos colegas acertando`, () => {
    const certo = respostas(...GABARITOS)
    const errouTudo = respostas(1, 2, 3, 0, 1)
    // Dez colegas; em cada questão, dois erraram (0,8 de acerto): nenhuma questão é das que a turma quase toda acertou.
    const colegasDivididos = [...Array.from({ length: 8 }, () => certo), errouTudo, errouTudo]
    const alvo = respostas(1, 2, 3, 3, 0)
    const lote = acertosDoLote(QUESTOES, [alvo, ...colegasDivididos])
    expect(destaquesDaTentativa({ questoes: QUESTOES, respostas: alvo, correcao: corrigirTentativa(QUESTOES, alvo), lote })).toEqual([])
  })

  it(`com menos de ${String(MINIMO_DE_QUESTOES_QUE_A_TURMA_ACERTOU)} questões que a turma acertou, não há padrão`, () => {
    const umaSo = [questao(0)]
    expect(destaques(respostas(1), { colegas: 6, questoes: umaSo })).toEqual([])
  })

  it('o acerto do próprio aluno não entra na conta dos colegas: quem acertou onde só ele acertou não vira "turma que acertou"', () => {
    // Seis colegas erraram tudo; o aluno acertou tudo. Nenhuma questão é da turma, e ele não é destacado.
    const errouTudo = respostas(1, 2, 3, 0, 1)
    const lote = acertosDoLote(QUESTOES, [TUDO_CERTO, ...Array.from({ length: 6 }, () => errouTudo)])
    expect(destaquesDaTentativa({ questoes: QUESTOES, respostas: TUDO_CERTO, correcao: corrigirTentativa(QUESTOES, TUDO_CERTO), lote })).toEqual([])
  })

  it('o acerto do próprio aluno sai da conta de cada questão: com ele a questão passaria da fração da turma, sem ele não passa', () => {
    // Cinco colegas: quatro acertaram tudo, um errou as três primeiras. O aluno acertou as três primeiras e errou as duas últimas, que todos os colegas acertaram.
    // Sem o aluno, as três primeiras têm 4 de 5 colegas (0,8): não são da turma, e só as duas últimas são, e ele errou as duas (padrão de erro).
    // Se o acerto dele contasse, as três primeiras teriam 5 de 5, as cinco seriam da turma, e dois erros em cinco (0,4) não destacariam.
    const aluno = respostas(0, 1, 2, 0, 1)
    const colegas = [TUDO_CERTO, TUDO_CERTO, TUDO_CERTO, TUDO_CERTO, respostas(1, 2, 3, 3, 0)]
    const lote = acertosDoLote(QUESTOES, [aluno, ...colegas])
    expect(destaquesDaTentativa({ questoes: QUESTOES, respostas: aluno, correcao: corrigirTentativa(QUESTOES, aluno), lote })).toEqual(['padrao_de_erro'])
  })
})

describe('destaques: o que sai', () => {
  it('os motivos saem na ordem do contrato, sem repetir, e são só os da lista fechada', () => {
    const tudoNaA = respostas(0, 0, 0, 0, 0)
    expect(destaques(tudoNaA, { historico: { acertos: 10, total: 10 }, colegas: 6 })).toEqual(['fora_do_historico', 'padrao_de_erro'])
  })

  it('quem foi bem, dentro do histórico e sem padrão, não é destacado', () => {
    expect(destaques(respostas(0, 1, 2, 3, 1), { historico: { acertos: 8, total: 10 }, colegas: 6 })).toEqual([])
  })
})
