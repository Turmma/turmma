import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CATEGORIAS_DE_RETENCAO, FRASE_DO_AVISO_AO_PROFESSOR } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { TEXTO_DA_SUPERVISAO } from '../tutor'
import { FALA_DO_AVISO, FRASES_DO_AVISO, GRUPOS_DO_AVISO } from './aviso-de-privacidade'
import { PASSOS_DO_ALUNO, TOTAL_DE_PASSOS } from './textos-da-introducao'

/**
 * Os textos da introdução do aluno (telas do aluno e primeiro acesso, 9.0; RF13, RF14, RF19; regra 70, itens 4a e 4b; D58, D59,
 * D62). Regra pura, sem tela: o aviso em linguagem de 11 anos, uma asserção por elemento (apagar qualquer frase deixa um caso
 * vermelho), e as falas sem afirmar ser pessoa nem prometer voltar. A tela que os mostra está em `BemVindo.test.tsx`.
 */

const { piso, teto } = CATEGORIAS_DE_RETENCAO.conversa_tutor
const palavras = (frase: string) => frase.trim().split(/\s+/).filter(Boolean)
const frasesCom = (padrao: RegExp) => FRASES_DO_AVISO.filter((frase) => padrao.test(frase))

/** Tudo o que o aluno lê na introdução, fora o que é da tela (o tamanho da letra tem o teste dele). */
const TUDO_QUE_A_ONCA_E_O_AVISO_DIZEM: readonly string[] = [...PASSOS_DO_ALUNO.flatMap((passo) => [passo.fala, ...passo.linhas]), ...GRUPOS_DO_AVISO.map((grupo) => grupo.titulo), ...FRASES_DO_AVISO]

describe('o aviso de privacidade: forma', () => {
  it('cada frase é uma frase só, de até 15 palavras, e termina em ponto', () => {
    expect(FRASES_DO_AVISO.length).toBeGreaterThan(0)
    for (const frase of FRASES_DO_AVISO) {
      expect(palavras(frase).length, frase).toBeLessThanOrEqual(15)
      expect(frase.endsWith('.'), frase).toBe(true)
      expect(/[.!?]\s+\S/.test(frase), `duas frases numa só: ${frase}`).toBe(false)
    }
  })

  it('a fala é "Veja o que a escola guarda de você." e o título de cada grupo cabe em poucas palavras', () => {
    expect(FALA_DO_AVISO).toBe('Veja o que a escola guarda de você.')
    for (const grupo of GRUPOS_DO_AVISO) expect(palavras(grupo.titulo).length, grupo.titulo).toBeLessThanOrEqual(5)
  })

  it('não usa termo jurídico nem a palavra "nota" (o resultado de uma tarefa não é Nota, D46), nem na fala nem nos títulos', () => {
    const proibidos = /\b(titular(?:es)?|controlador(?:a|es)?|LGPD|consentimento|tratamento|nota|notas)\b/i
    for (const texto of [FALA_DO_AVISO, ...GRUPOS_DO_AVISO.map((grupo) => grupo.titulo), ...FRASES_DO_AVISO]) expect(texto).not.toMatch(proibidos)
  })

  it('o termo proibido, posto numa frase, seria pego (a lista não é decoração)', () => {
    const proibidos = /\b(titular(?:es)?|controlador(?:a|es)?|LGPD|consentimento|tratamento|nota|notas)\b/i
    for (const exemplo of ['A sua nota fica aqui.', 'O titular dos dados.', 'Pela LGPD.', 'O tratamento dos dados.', 'Seu consentimento.', 'O controlador.']) expect(exemplo).toMatch(proibidos)
  })
})

describe('o aviso de privacidade: conteúdo, uma asserção por elemento (RF14)', () => {
  it.each([
    ['o que a escola guarda: nome, turma e matrícula', /^A escola guarda seu nome, sua turma e sua matrícula\.$/],
    ['o que a escola guarda: as tarefas e o resultado delas', /^A escola guarda suas tarefas e o resultado delas\.$/],
    ['o que a escola guarda: o que escreve ao Tutor e o que ele responde', /^A escola guarda o que você escreve para o Tutor e o que ele responde\.$/],
    ['o prazo das tarefas, sem número', /^Suas tarefas ficam pelo tempo que a escola escolhe\.$/],
    ['quem vê: o professor da turma vê as tarefas e o resultado', /^O professor da turma vê suas tarefas e o resultado\.$/],
    ['quem vê: a coordenação vê os números da turma toda', /^A coordenação vê os números da turma toda\.$/],
    ['quem vê: em assunto pessoal difícil, o professor é avisado, mas não vê o que o aluno escreveu', /^Em assunto pessoal difícil, seu professor é avisado, mas não vê o que você escreveu\.$/],
    ['quem vê: ver algo do aluno fica registrado', /^Ver algo seu fica registrado\.$/],
    ['quem vê: os colegas não veem nada', /^Seus colegas não veem nada seu\.$/],
    ['para onde vai: o que escreve e as habilidades a rever vão a um programa de IA', /escreve e as habilidades a rever vão a um programa de IA/],
    ['para onde vai: o programa é de uma empresa contratada', /programa é de uma empresa contratada/],
    ['para onde vai: os dados não treinam IA', /^Seus dados não treinam IA\.$/],
    ['como ver os dados: Eu e depois Privacidade', /abra Eu e depois Privacidade/],
    ['como pedir mais: quem dá a aula ou a coordenação', /fale com quem dá a aula ou com a coordenação/],
  ])('diz %s', (_descricao, padrao) => {
    expect(frasesCom(padrao)).toHaveLength(1)
  })

  it.each(['e-mail', 'telefone', 'CPF', 'foto', 'endereço', 'data de nascimento'])('o que não temos: "%s"', (dado) => {
    const frases = frasesCom(new RegExp(`^Não temos .*\\b${dado}\\b`))
    expect(frases).toHaveLength(1)
  })

  it('o aviso de atenção é a frase do aviso ao professor do shared, uma só, a mesma da mensagem fixa do Tutor', () => {
    expect(FRASES_DO_AVISO.filter((frase) => frase === FRASE_DO_AVISO_AO_PROFESSOR)).toHaveLength(1)
  })

  it('a frase do aviso ao professor vale antes e depois do relato, sem tempo hipotético', () => {
    expect(FRASE_DO_AVISO_AO_PROFESSOR).not.toMatch(/^(?:se|quando|caso)\b/i)
    expect(FRASE_DO_AVISO_AO_PROFESSOR).not.toMatch(/\b(?:contar|contou)\b/i)
    expect(FRASE_DO_AVISO_AO_PROFESSOR).toMatch(/\bnão vê o que você escreveu\.$/)
  })

  it('a supervisão é a frase da faixa do Início, a mesma e uma só (D8)', () => {
    expect(TEXTO_DA_SUPERVISAO).toBe('Quem dá a aula acompanha como você usa o Tutor.')
    expect(FRASES_DO_AVISO.filter((frase) => frase === TEXTO_DA_SUPERVISAO)).toHaveLength(1)
  })

  it('o prazo da conversa com o Tutor usa o piso e o teto do catálogo de retenção, e a escola escolhe', () => {
    const frases = frasesCom(new RegExp(`^A conversa com o Tutor fica de ${String(piso)} a ${String(teto)} meses; a escola escolhe\\.$`))
    expect(frases).toHaveLength(1)
    expect([piso, teto]).toEqual([6, 24])
  })

  it('o intervalo de meses aparece só numa frase, e ela fala do Tutor: um número solto não diz de quê', () => {
    const comNumero = FRASES_DO_AVISO.filter((frase) => /\d/.test(frase))
    expect(comNumero).toHaveLength(1)
    expect(comNumero[0]).toMatch(/Tutor/)
    expect(FRASES_DO_AVISO.filter((frase) => /tarefas/.test(frase) && /\d/.test(frase))).toEqual([])
  })
})

describe('os passos da introdução do aluno', () => {
  it('são quatro, na ordem: o Tutor, quem dá a aula, o aviso de privacidade e o tamanho da letra', () => {
    expect(TOTAL_DE_PASSOS).toBe(4)
    expect(PASSOS_DO_ALUNO.map((passo) => passo.id)).toEqual(['tutor', 'supervisao', 'privacidade', 'letra'])
  })

  it('o passo 1 diz que o Tutor é um programa e que pode errar, e nenhum passo traz a pose da comemoração', () => {
    const [primeiro] = PASSOS_DO_ALUNO
    expect(primeiro?.fala).toMatch(/Tutor, um programa da escola/)
    expect(primeiro?.linhas.join(' ')).toMatch(/posso errar/i)
    for (const passo of PASSOS_DO_ALUNO) expect(['acenando', 'apontando', 'pensando']).toContain(passo.pose)
    // A pose de cada passo, na ordem: só o passo da letra pensa (a pose `pensando` foi aprovada para ele pelo parecer da correção
    // `2026-10-28-onca-do-mockup`); voltar a `acenando` ou espalhar o `pensando` por outro passo reprova.
    expect(PASSOS_DO_ALUNO.map((passo) => `${passo.id}:${passo.pose}`)).toEqual(['tutor:acenando', 'supervisao:apontando', 'privacidade:apontando', 'letra:pensando'])
  })

  it('os três primeiros passos são obrigatórios (RF13) e o da letra não', () => {
    expect(PASSOS_DO_ALUNO.map((passo) => passo.obrigatorio)).toEqual([true, true, true, false])
  })

  it('o passo 2 repete a frase da supervisão, e o passo 3 abre com a fala do aviso', () => {
    expect(PASSOS_DO_ALUNO[1]?.fala).toBe(TEXTO_DA_SUPERVISAO)
    expect(PASSOS_DO_ALUNO[2]?.fala).toBe(FALA_DO_AVISO)
  })

  it('o passo 2 diz o que o professor vê no uso do Tutor: onde travou, a resposta pronta e a dúvida repetida (o sinal de atenção está no aviso)', () => {
    expect(PASSOS_DO_ALUNO[1]?.linhas).toEqual(['Quem dá a aula vê onde você travou.', 'Vê se você pediu a resposta pronta e qual dúvida você repetiu.'])
  })
})

describe('as falas que o e2e espera', () => {
  it('a lista `FALAS_DA_INTRODUCAO_DO_ALUNO` do e2e é a das falas dos passos, na ordem: mudar o texto num lugar e não no outro reprova aqui', () => {
    // O `e2e/` não importa a web, e por isso guarda uma cópia das falas: este caso a confere contra os passos de verdade.
    const fonte = readFileSync(join(import.meta.dirname, '..', '..', '..', '..', '..', '..', 'e2e', 'support', 'casca.ts'), 'utf8')
    const bloco = /FALAS_DA_INTRODUCAO_DO_ALUNO = \[([^\]]*)\] as const/.exec(fonte)
    expect(bloco, 'a lista saiu de `e2e/support/casca.ts`: atualize este caso').not.toBeNull()
    const copiadas = [...(bloco?.[1] ?? '').matchAll(/'([^']*)'/g)].map((achado) => achado[1])
    expect(copiadas).toEqual(PASSOS_DO_ALUNO.map((passo) => passo.fala))
  })
})

describe('as falas do Tutor (regra 70, itens 4a e 4b; D58, D59)', () => {
  const AFIRMA_SER_PESSOA = /\b(sou|era|serei|somos)\s+(?:(?:uma?|seu|sua|o|a)\s+)?(pessoa|humano|humana|gente|professor|professora|amig[oa]|colega)\b/i
  const PROMETE_VOLTAR_OU_ESPERAR = /\b(volto|voltarei|vou voltar|espero|esperando|esperarei|vou esperar|sempre\s+(estou|estarei|aqui|ali|junto|por perto|com você)|estou aqui (para|pra) você)\b/i
  const VINCULO_OU_SAUDADE = /\b(saudades?|amig[oa]s?|amizade|vínculo|carinho|te amo|sinto sua falta|sentimos sua falta)\b/i

  it('nenhum texto da introdução afirma ser pessoa, professor ou amigo', () => {
    for (const texto of TUDO_QUE_A_ONCA_E_O_AVISO_DIZEM) expect(texto).not.toMatch(AFIRMA_SER_PESSOA)
  })

  it('nenhum promete voltar, esperar ou estar sempre ali', () => {
    for (const texto of TUDO_QUE_A_ONCA_E_O_AVISO_DIZEM) expect(texto).not.toMatch(PROMETE_VOLTAR_OU_ESPERAR)
  })

  it('nenhum usa termo de vínculo ou de saudade', () => {
    for (const texto of TUDO_QUE_A_ONCA_E_O_AVISO_DIZEM) expect(texto).not.toMatch(VINCULO_OU_SAUDADE)
  })

  it('as três listas pegam o que dizem pegar, e a frase "e não uma pessoa" não é confundida com a afirmação', () => {
    expect('Eu sou uma pessoa como você.').toMatch(AFIRMA_SER_PESSOA)
    expect('Sou seu amigo.').toMatch(AFIRMA_SER_PESSOA)
    expect('Eu sou o professor da turma.').toMatch(AFIRMA_SER_PESSOA)
    expect('Eu volto amanhã.').toMatch(PROMETE_VOLTAR_OU_ESPERAR)
    expect('Eu espero você aqui.').toMatch(PROMETE_VOLTAR_OU_ESPERAR)
    expect('Estou sempre aqui.').toMatch(PROMETE_VOLTAR_OU_ESPERAR)
    expect('Que saudade de você!').toMatch(VINCULO_OU_SAUDADE)
    expect('Nossa amizade.').toMatch(VINCULO_OU_SAUDADE)
    expect('Eu sou um programa, e não uma pessoa.').not.toMatch(AFIRMA_SER_PESSOA)
  })

  it('o texto fixo não muda com ninguém: sem nome, sem número de uso e sem "de novo"', () => {
    for (const texto of PASSOS_DO_ALUNO.flatMap((passo) => [passo.fala, ...passo.linhas])) {
      expect(texto).not.toMatch(/\d|de volta|de novo|faz tempo|sequência|pontos?\b/i)
    }
  })
})
