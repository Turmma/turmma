import { describe, expect, it } from 'vitest'
import * as textos from './aprovar'
import {
  ABAS_DA_CORRECAO,
  abaDoEndereco,
  acertosDoAluno,
  caminhoDeVoltaDaCorrecao,
  contadorDosDestaques,
  destaqueDoEndereco,
  enderecoDaCorrecao,
  estadoDoDestaque,
  explicacoesDoDestaque,
  semCorrecao,
  letraDaAlternativa,
  motivosDoDestaque,
  numerosDoLote,
  outrasEmOrdemDeNome,
  resumoDoLote,
  rotuloDaFaixa,
  rotuloDeAprovar,
  situacaoDaAplicacao,
  AVISO_DA_SAIDA_DA_ABA,
  hasSaidaDaAba,
  textoDasSaidas,
  textoDaMedia,
  textoDosCorrigidos,
  tituloDasOutras,
  tituloDosDestaques,
} from './aprovar'
import { QUANDO_O_TUTOR_AVISA, falaDoGrupo, horaDoUltimoAviso, textoDaAtencaoHumana, textoDaHoraDoAviso, textoDoSinal, tituloDaAtencaoHumana } from '../turmas/sinais'

const id = (final: string) => `0190f5a0-0000-7000-8000-0000000000${final}`
const destaque = (final: string, abertoEm: string | null = null) => ({ alunoId: id(final), nome: `Aluno sintético ${final}`, acertos: 1, total: 5, emBranco: 0, motivos: ['fora_do_historico' as const], abertoEm })
/** O que nenhuma tela do professor diz de uma correção (D46, D57, D59, D64): nota, conceito, pontuação, média, ranking e pódio. */
const VOCABULARIO_PROIBIDO = /\bnotas?\b|\bconceitos?\b|pontua|\bmédia\b|ranking|pódio/i
const RESUMO = { alunosDaTurma: 32, corrigidos: 28, questoes: 5, mediaDeAcertos: 3.42, distribuicao: [], porHabilidade: [], porQuestao: [] }

describe('aprovar a correção: o contador que diz por que o botão está desligado (D33)', () => {
  it('com destaque sem abrir, diz quantos faltam, no singular e no plural', () => {
    expect(contadorDosDestaques({ destaques: [destaque('01', '2026-10-05T13:38:00.000Z'), destaque('02'), destaque('03')], destaquesAbertos: 1, podeAprovar: false })).toEqual({
      texto: '1 de 3 destaques abertos',
      porQue: 'Abra os 2 destaques que faltam para liberar a aprovação.',
    })
    expect(contadorDosDestaques({ destaques: [destaque('01')], destaquesAbertos: 0, podeAprovar: false })).toEqual({ texto: '0 de 1 destaque aberto', porQue: 'Abra o destaque que falta para liberar a aprovação.' })
  })

  it('com todos abertos e a API liberando, não há por quê; sem destaque nenhum, a tela diz isso', () => {
    expect(contadorDosDestaques({ destaques: [destaque('01', '2026-10-05T13:38:00.000Z')], destaquesAbertos: 1, podeAprovar: true })).toEqual({ texto: '1 de 1 destaque aberto', porQue: undefined })
    expect(contadorDosDestaques({ destaques: [], destaquesAbertos: 0, podeAprovar: true })).toEqual({ texto: 'Nenhuma correção destacada neste lote', porQue: undefined })
  })

  it('quem libera o botão é a API: com todos abertos e a API ainda recusando, a tela não libera por conta própria', () => {
    expect(contadorDosDestaques({ destaques: [destaque('01', '2026-10-05T13:38:00.000Z')], destaquesAbertos: 1, podeAprovar: false }).porQue).toBe('A aprovação ainda não foi liberada. Atualize a tela.')
  })

  it('o destaque fechado diz que falta abrir; o aberto, a hora em que foi aberto', () => {
    expect(estadoDoDestaque(destaque('01'))).toEqual({ aberto: false, texto: 'Falta abrir' })
    expect(estadoDoDestaque(destaque('01', '2026-10-05T13:38:00.000Z'), { fuso: 'America/Sao_Paulo', agora: new Date('2026-10-05T14:00:00.000Z') })).toEqual({ aberto: true, texto: 'Aberto · 05/10, 10h38' })
  })
})

describe('aprovar a correção: os textos', () => {
  it('a média é de acertos, em questões, e a contagem diz de quantos alunos', () => {
    expect(textoDaMedia(RESUMO)).toBe('3,4 de 5 questões')
    expect(textoDaMedia({ mediaDeAcertos: 1, questoes: 1 })).toBe('1 de 1 questão')
    expect(textoDosCorrigidos(RESUMO)).toBe('28 alunos responderam · 32 na turma hoje')
    // Depois de uma transferência, quem respondeu pode ser mais que a turma de hoje: a tela não vira fração impossível.
    expect(textoDosCorrigidos({ corrigidos: 5, alunosDaTurma: 4 })).toBe('5 alunos responderam · 4 na turma hoje')
    expect(textoDosCorrigidos({ corrigidos: 1, alunosDaTurma: 30 })).toBe('1 aluno respondeu · 30 na turma hoje')
    expect(rotuloDeAprovar(28)).toBe('Aprovar 28 correções')
    expect(rotuloDeAprovar(1)).toBe('Aprovar 1 correção')
  })

  it('a faixa, os motivos do destaque, os acertos do aluno e a letra da alternativa', () => {
    expect([{ de: 0, ate: 1 }, { de: 1, ate: 1 }, { de: 2, ate: 2 }, { de: 4, ate: 5 }].map(rotuloDaFaixa)).toEqual(['0 a 1 acertos', '1 acerto', '2 acertos', '4 a 5 acertos'])
    expect(motivosDoDestaque({ motivos: ['em_branco', 'padrao_de_erro'] })).toBe('Em branco · Padrão de erro para conferir')
    expect(acertosDoAluno({ acertos: 2, total: 5, emBranco: 0 })).toBe('2 de 5 acertos')
    expect(acertosDoAluno({ acertos: 0, total: 5, emBranco: 5 })).toBe('0 de 5 acertos · 5 em branco')
    expect([0, 3, null].map(letraDaAlternativa)).toEqual(['a', 'd', '—'])
  })

  it('o diálogo de aprovar diz a atividade, a turma, quantas correções e os destaques abertos', () => {
    expect(resumoDoLote({ titulo: 'Atividade — Estequiometria', resumo: RESUMO, destaques: [destaque('01', '2026-10-05T13:38:00.000Z')], destaquesAbertos: 1 }, '2ºB')).toEqual([
      { rotulo: 'Atividade', valor: 'Atividade — Estequiometria' },
      { rotulo: 'Turma', valor: '2ºB' },
      { rotulo: 'Correções', valor: '28 alunos responderam · 32 na turma hoje' },
      { rotulo: 'Destaques abertos', valor: '1 de 1' },
    ])
  })

  it('a atividade aplicada diz se está aberta, se é avaliativa e quantos enviaram, sem nome de ninguém', () => {
    expect(situacaoDaAplicacao({ estado: 'aberta', avaliativa: true, participacao: { alunos: 30, iniciaram: 20, enviaram: 12 } })).toBe('Aberta para a turma · avaliativa · 12 de 30 alunos enviaram')
    expect(situacaoDaAplicacao({ estado: 'encerrada', avaliativa: false, participacao: { alunos: 1, iniciaram: 1, enviaram: 1 } })).toBe('Encerrada · prática · 1 de 1 aluno enviou')
    expect(situacaoDaAplicacao({ estado: 'aberta', avaliativa: false, participacao: { alunos: 30, iniciaram: 1, enviaram: 1 } })).toBe('Aberta para a turma · prática · 1 de 30 alunos enviou')
    expect(situacaoDaAplicacao({ estado: 'aberta', avaliativa: false, participacao: { alunos: 30, iniciaram: 0, enviaram: 0 } })).toBe('Aberta para a turma · prática · 0 de 30 alunos enviaram')
  })

  it('o motivo do destaque é dito como fato do trabalho, e não como juízo sobre o aluno', () => {
    expect(explicacoesDoDestaque({ motivos: ['em_branco'] })).toBe('Nenhuma questão foi respondida.')
    expect(explicacoesDoDestaque({ motivos: ['fora_do_historico', 'padrao_de_erro'] })).toBe(
      'Os acertos ficaram bem acima ou bem abaixo dos que ele teve nas correções aprovadas desta disciplina. A mesma alternativa em todas as questões, ou erro em questões que quase toda a turma acertou.',
    )
    for (const texto of Object.values(textos.EXPLICACAO_DO_MOTIVO)) expect(texto).not.toMatch(/desatent|chut|preguiç|desinteress|colou|cola\b|dificuldade de aprend/i)
  })

  it('a atividade encerrada sem correção diz por quê: ninguém respondeu, a função está suspensa, ou o lote foi rejeitado', () => {
    const participacao = { alunos: 30, iniciaram: 12, enviaram: 10 }
    expect(semCorrecao({ estado: 'aberta', entrega: null, participacao })).toBeUndefined()
    expect(semCorrecao({ estado: 'encerrada', entrega: null, participacao: { alunos: 30, iniciaram: 0, enviaram: 0 } })).toBe('ninguem_respondeu')
    expect(semCorrecao({ estado: 'encerrada', entrega: null, participacao })).toBe('correcao_suspensa')
    expect(semCorrecao({ estado: 'encerrada', entrega: { id: id('e1'), estado: 'rejeitada' }, participacao })).toBe('lote_rejeitado')
    expect(semCorrecao({ estado: 'encerrada', entrega: { id: id('e1'), estado: 'pendente' }, participacao })).toBeUndefined()
    expect(semCorrecao({ estado: 'encerrada', entrega: { id: id('e1'), estado: 'aprovada' }, participacao })).toBeUndefined()
  })

  it('D46: é diagnóstico, não nota — nenhum texto fixo desta tela fala em nota, conceito ou pontuação', () => {
    const fixos = [
      ...Object.values(textos).flatMap((valor) => (typeof valor === 'string' ? [valor] : [])),
      ...textos.ESCOLHA_DE_AVALIATIVA.flatMap((item) => [item.rotulo, item.descricao]),
      ...Object.values(textos.EXPLICACAO_DO_MOTIVO),
      ...Object.values(textos.TEXTO_SEM_CORRECAO),
    ]
    expect(fixos.length).toBeGreaterThan(4)
    const gerados = [textoDaMedia(RESUMO), textoDosCorrigidos(RESUMO), rotuloDeAprovar(3), rotuloDaFaixa({ de: 0, ate: 2 }), acertosDoAluno({ acertos: 1, total: 5, emBranco: 1 }), contadorDosDestaques({ destaques: [destaque('01')], destaquesAbertos: 0, podeAprovar: false }).porQue ?? '']
    for (const texto of [...fixos, ...gerados]) expect(texto).not.toMatch(VOCABULARIO_PROIBIDO)
  })

  it('X3, 14.0: os textos novos da tela (abas, faixa de números, títulos, avisos) não falam em nota, média, ranking nem comparam o aluno com o histórico dele', () => {
    const faixa = numerosDoLote({ resumo: RESUMO, destaques: [destaque('01', '2026-10-05T13:38:00.000Z'), destaque('02')], destaquesAbertos: 1 })
    const vazia = numerosDoLote({ resumo: RESUMO, destaques: [], destaquesAbertos: 0 })
    const novos = [
      textos.ROTULO_DAS_ABAS_DA_CORRECAO,
      textos.ROTULO_DE_REJEITAR_O_LOTE,
      textos.APOIO_DAS_OUTRAS,
      textos.AVISO_DO_GABARITO,
      ...ABAS_DA_CORRECAO.map((aba) => aba.rotulo),
      ...[0, 1, 2].map(tituloDosDestaques),
      ...[0, 1, 2].map(tituloDasOutras),
      ...[...faixa, ...vazia].flatMap((numero) => [numero.rotulo, numero.valor, numero.apoio]),
    ]
    expect(novos.length).toBeGreaterThan(20)
    for (const texto of novos) {
      expect(texto).not.toMatch(VOCABULARIO_PROIBIDO)
      expect(texto).not.toMatch(/costum|hist[óo]rico|diferentes d/i)
    }
  })
})

describe('aprovar a correção: as abas e o painel pelo endereço (X3, 14.0)', () => {
  it('a aba vem de ?aba=, e o que não é aba cai em Destaques', () => {
    expect(ABAS_DA_CORRECAO.map((aba) => aba.id)).toEqual(['destaques', 'outras', 'resumo'])
    expect(abaDoEndereco('aba=resumo')).toBe('resumo')
    expect(abaDoEndereco('aba=outras&ver=x')).toBe('outras')
    expect(abaDoEndereco('')).toBe('destaques')
    expect(abaDoEndereco('aba=todas')).toBe('destaques')
    expect(abaDoEndereco('aba=')).toBe('destaques')
    expect(abaDoEndereco('ver=resumo')).toBe('destaques')
  })

  it('?ver= só abre destaque do lote e já aberto: o fechado, o desconhecido e o de outro lote não abrem nada', () => {
    const fechado = destaque('01')
    const aberto = destaque('02', '2026-10-05T13:38:00.000Z')
    const lista = [fechado, aberto]
    expect(destaqueDoEndereco(`ver=${aberto.alunoId}`, lista, new Set())).toBe(aberto)
    // Destaque ainda fechado: recarregar com o endereço dele não abre o painel (e, por isso, não registra abertura).
    expect(destaqueDoEndereco(`ver=${fechado.alunoId}`, lista, new Set())).toBeUndefined()
    // O que a tela acabou de abrir e a leitura do lote ainda não trouxe vale, mas só para aquele destaque.
    expect(destaqueDoEndereco(`ver=${fechado.alunoId}`, lista, new Set([fechado.alunoId]))).toBe(fechado)
    expect(destaqueDoEndereco(`ver=${fechado.alunoId}`, lista, new Set([aberto.alunoId]))).toBeUndefined()
    // Id que o lote não tem (de outra turma ou de outra escola): igual a não existir.
    expect(destaqueDoEndereco(`ver=${id('99')}`, lista, new Set([id('99')]))).toBeUndefined()
    expect(destaqueDoEndereco('', lista, new Set())).toBeUndefined()
    expect(destaqueDoEndereco('aba=resumo', lista, new Set())).toBeUndefined()
  })

  it('o endereço troca a aba sem fechar o painel, e fecha o painel sem trocar a aba', () => {
    expect(enderecoDaCorrecao('/aprovar/x', '', { aba: 'resumo' })).toBe('/aprovar/x?aba=resumo')
    expect(enderecoDaCorrecao('/aprovar/x', 'aba=resumo&ver=a1', { aba: 'outras' })).toBe('/aprovar/x?aba=outras&ver=a1')
    expect(enderecoDaCorrecao('/aprovar/x', 'aba=resumo&ver=a1', { ver: null })).toBe('/aprovar/x?aba=resumo')
    expect(enderecoDaCorrecao('/aprovar/x', 'ver=a1', { ver: null })).toBe('/aprovar/x')
    expect(enderecoDaCorrecao('/aprovar/x', 'aba=resumo', { ver: 'a2' })).toBe('/aprovar/x?aba=resumo&ver=a2')
  })

  it('a faixa de números diz quantas correções, quantos destaques abertos e o acerto médio em questões', () => {
    const duas = [destaque('01', '2026-10-05T13:38:00.000Z'), destaque('02')]
    expect(numerosDoLote({ resumo: RESUMO, destaques: duas, destaquesAbertos: 1 })).toEqual([
      { rotulo: 'Corrigidas', valor: '28', apoio: 'Na turma hoje: 32. Quem não abriu a atividade não tem correção.' },
      { rotulo: 'Destaques abertos', valor: '1 de 2', apoio: 'Abra todos antes de aprovar.' },
      { rotulo: 'Acerto médio', valor: '3,4 de 5 questões', apoio: 'Por aluno que respondeu.' },
    ])
    expect(numerosDoLote({ resumo: RESUMO, destaques: duas, destaquesAbertos: 2 })[1]).toEqual({ rotulo: 'Destaques abertos', valor: '2 de 2', apoio: 'Todos abertos.' })
    expect(numerosDoLote({ resumo: RESUMO, destaques: [], destaquesAbertos: 0 })[1]).toEqual({ rotulo: 'Destaques abertos', valor: '0', apoio: 'Nenhum para abrir antes de aprovar.' })
    // Depois de uma transferência, quem respondeu pode passar da turma de hoje: são dois números, e não uma fração impossível.
    expect(numerosDoLote({ resumo: { ...RESUMO, corrigidos: 5, alunosDaTurma: 4 }, destaques: [], destaquesAbertos: 0 })[0]?.valor).toBe('5')
  })

  it('os títulos das abas dizem a quantidade, no singular e no plural', () => {
    expect([0, 1, 2].map(tituloDosDestaques)).toEqual(['Nenhuma correção para abrir antes de aprovar', 'Abra este antes de aprovar', 'Abra estes 2 antes de aprovar'])
    expect([1, 2, 30].map(tituloDasOutras)).toEqual(['A outra correção', 'As outras 2 correções', 'As outras 30 correções'])
  })

  it('as outras correções saem em ordem de nome, nunca de acerto, e nome igual desempata pelo id', () => {
    const aluno = (final: string, nome: string, acertos: number) => ({ alunoId: id(final), nome, acertos, total: 5, emBranco: 0 })
    // A ordem em que a API devolve não é a do nome, nem a do acerto (crescente ou decrescente): só o nome produz esta.
    const entrada = [aluno('01', 'Clara', 1), aluno('02', 'Bruno', 5), aluno('03', 'Ana', 3)]
    expect(outrasEmOrdemDeNome(entrada).map((item) => item.nome)).toEqual(['Ana', 'Bruno', 'Clara'])
    // Acento e caixa não mudam a ordem: "Álvaro" vem antes de "Bruno", e "ana" junto de "Ana".
    expect(outrasEmOrdemDeNome([aluno('01', 'Bruno', 1), aluno('02', 'Álvaro', 5), aluno('03', 'ana', 3)]).map((item) => item.nome)).toEqual(['Álvaro', 'ana', 'Bruno'])
    // Dois alunos com o mesmo nome: o id decide, e a ordem não depende de quem veio primeiro.
    const iguais = [aluno('0b', 'Ana', 1), aluno('0a', 'Ana', 5)]
    expect(outrasEmOrdemDeNome(iguais).map((item) => item.alunoId)).toEqual([id('0a'), id('0b')])
    expect(outrasEmOrdemDeNome([...iguais].reverse()).map((item) => item.alunoId)).toEqual([id('0a'), id('0b')])
    // Não muda a lista que recebeu.
    expect(entrada.map((item) => item.nome)).toEqual(['Clara', 'Bruno', 'Ana'])
  })
})

describe('aprovar a correção: "Voltar para a turma" (X3, 2.0)', () => {
  it('leva à turma da correção quando a entrega inteira a trouxe, e à lista de turmas enquanto não', () => {
    expect(caminhoDeVoltaDaCorrecao(id('a1'))).toBe(`/turmas/${id('a1')}`)
    expect(caminhoDeVoltaDaCorrecao(undefined)).toBe('/turmas')
    // Outra turma, outro caminho: o endereço não é fixo.
    expect(caminhoDeVoltaDaCorrecao(id('a2'))).not.toBe(caminhoDeVoltaDaCorrecao(id('a1')))
  })
})

describe('Hoje (X3, 10.0): é diagnóstico, não nota — nenhum texto da aba fala em nota, conceito, média, pontuação nem ranking (D46, D69)', () => {
  it('os textos fixos e os que os sinais geram', () => {
    const referencias = { atividades: { [id('a1')]: 'Atividade — Estequiometria' }, materiais: { [id('b1')]: 'Química 2' } }
    const aluno = { id: id('01'), nome: 'Aluno sintético 01' }
    const base = { id: id('s1'), aluno, criadoEm: '2026-10-05T13:00:00.000Z' }
    const textosDeHoje = [
      ...QUANDO_O_TUTOR_AVISA,
      ...[1, 3].flatMap((alunos) => [tituloDaAtencaoHumana(alunos), textoDaAtencaoHumana(alunos)]),
      textoDaHoraDoAviso(horaDoUltimoAviso([{ criadoEm: '2026-10-05T13:40:00.000Z' }]) ?? ''),
      ...(['travou', 'resposta_pronta', 'duvida_repetida'] as const).flatMap((tipo) => [
        falaDoGrupo({ tipo, atividadeAplicadaId: id('a1'), questao: 3, alunos: 8 }, referencias),
        textoDoSinal({ ...base, tipo, atividadeAplicadaId: id('a1'), questao: 3, materialId: null, pagina: null }, referencias),
      ]),
    ]
    expect(textosDeHoje.length).toBeGreaterThan(10)
    for (const texto of textosDeHoje) expect(texto).not.toMatch(VOCABULARIO_PROIBIDO)
  })

  it('a lista de palavras proibidas pega cada uma delas, o pódio inclusive', () => {
    for (const palavra of ['nota', 'conceito', 'pontuação', 'média', 'ranking', 'pódio']) expect(palavra).toMatch(VOCABULARIO_PROIBIDO)
  })
})

describe('a coluna "Saiu da aba" (D70, D88)', () => {
  const aluno = { alunoId: 'a', nome: 'Aluno', acertos: 1, total: 2, emBranco: 0 }

  it('só o lote em que a API devolveu `saidasDaAba` (a avaliativa) tem a coluna, nos destaques ou nas outras', () => {
    expect(hasSaidaDaAba({ destaques: [], outras: [aluno] })).toBe(false)
    expect(hasSaidaDaAba({ destaques: [{ ...aluno, motivos: ['em_branco'], abertoEm: null }], outras: [aluno] })).toBe(false)
    expect(hasSaidaDaAba({ destaques: [], outras: [{ ...aluno, saidasDaAba: 0 }] })).toBe(true)
    expect(hasSaidaDaAba({ destaques: [{ ...aluno, motivos: ['em_branco'], abertoEm: null, saidasDaAba: 2 }], outras: [] })).toBe(true)
    expect(hasSaidaDaAba({ destaques: [], outras: [] })).toBe(false)
  })

  it('a contagem sai como número, e o aviso fixo é a frase aprovada, sem acusar o aluno', () => {
    expect(textoDasSaidas({ saidasDaAba: 9 })).toBe('9')
    expect(textoDasSaidas({ saidasDaAba: 0 })).toBe('0')
    // Sem o campo (a API não o mandou), a contagem é 0: nunca "undefined" na célula.
    expect(textoDasSaidas({})).toBe('0')
    expect(AVISO_DA_SAIDA_DA_ABA).toBe('Conta as vezes em que a aba da prova perdeu o foco. Leitor de tela, teclado virtual e avisos do sistema também contam. Sozinho, não indica cola.')
  })
})
