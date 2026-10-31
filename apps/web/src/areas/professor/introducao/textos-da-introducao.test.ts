import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NOMES_DOS_AGENTES } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { NAVEGACAO } from '../../navigation'
import {
  AGENTE_DA_INTRODUCAO,
  DESCRICAO_DO_LUGAR,
  FALA_DO_PASSO_1,
  FALA_DO_PASSO_2,
  FALA_DO_PASSO_3,
  FALA_DO_PASSO_4,
  PASSOS_DO_PROFESSOR,
  TITULO_DE_ONDE_FICA_CADA_COISA,
  TOTAL_DE_PASSOS,
} from './textos-da-introducao'

/**
 * Os textos da introdução do professor (telas do aluno e primeiro acesso, 10.0; RF15, RF19; regra 70, itens 3, 4a, 8 e 9; D55, D58, D64).
 * Regra pura, sem tela: o que cada passo diz, uma asserção por elemento (apagar qualquer ideia deixa um caso vermelho), e as falas
 * sem afirmar ser pessoa nem prometer voltar. A tela que os mostra está em `BemVindo.test.tsx`.
 */

const texto = (id: string): string => {
  const passo = PASSOS_DO_PROFESSOR.find((candidato) => candidato.id === id)
  if (passo === undefined) throw new Error(`faltou o passo ${id}`)
  return [passo.fala, ...passo.linhas].join(' ')
}

/** Tudo o que o professor lê na introdução, fora a lista de lugares (que tem o teste dela, abaixo). */
const TUDO_QUE_A_ONCA_DIZ: readonly string[] = [...PASSOS_DO_PROFESSOR.flatMap((passo) => [passo.fala, ...passo.linhas]), TITULO_DE_ONDE_FICA_CADA_COISA, ...Object.values(DESCRICAO_DO_LUGAR)]

describe('os passos da introdução do professor', () => {
  it('são quatro, na ordem: a IA prepara e ele aprova, o Tutor, a redação e a discursiva, e o uso que não vira indicador', () => {
    expect(TOTAL_DE_PASSOS).toBe(4)
    expect(PASSOS_DO_PROFESSOR.map((passo) => passo.id)).toEqual(['prepara', 'tutor', 'discursiva', 'indicador'])
  })

  it('as falas são as da tarefa, palavra por palavra', () => {
    expect(PASSOS_DO_PROFESSOR.map((passo) => passo.fala)).toEqual([
      'Eu preparo, você revê, e só então vai à turma.',
      'Só a resposta do Tutor chega ao aluno sem a sua aprovação, uma a uma.',
      'Eu não corrijo redação nem discursiva: ajudo com a rubrica e com a organização do lote.',
      'Usar ou não esta ferramenta não gera número sobre você.',
    ])
    expect([FALA_DO_PASSO_1, FALA_DO_PASSO_2, FALA_DO_PASSO_3, FALA_DO_PASSO_4]).toEqual(PASSOS_DO_PROFESSOR.map((passo) => passo.fala))
  })

  it('nenhum é obrigatório: o professor pode pular a introdução inteira (RF15)', () => {
    expect(PASSOS_DO_PROFESSOR.map((passo) => passo.obrigatorio)).toEqual([false, false, false, false])
  })

  it('quem fala é o Assistente de ensino, e nenhum passo traz a pose da comemoração', () => {
    expect(AGENTE_DA_INTRODUCAO).toBe('assistente_de_ensino')
    expect(NOMES_DOS_AGENTES[AGENTE_DA_INTRODUCAO]).toBe('Assistente de ensino')
    for (const passo of PASSOS_DO_PROFESSOR) expect(['acenando', 'apontando']).toContain(passo.pose)
  })

  it('o passo 1 diz que a IA prepara e o professor aprova, e que o Assistente é um programa e pode errar', () => {
    expect(texto('prepara')).toMatch(/\bprepar/i)
    expect(texto('prepara')).toMatch(/aprova/i)
    // A frase não é absoluta: a exceção é a resposta do Tutor (passo 2), e quem pula no passo 1 só lê esta.
    expect(texto('prepara')).toMatch(/Nada do que eu preparo chega à turma sem a sua aprovação/)
    expect(texto('prepara')).toMatch(/programa e posso errar/i)
  })

  it('o passo 2 diz que só a resposta do Tutor chega ao aluno sem aprovação, uma a uma, e que o resto espera pela aprovação', () => {
    expect(texto('tutor')).toMatch(/Só a resposta do Tutor chega ao aluno sem a sua aprovação, uma a uma/)
    expect(texto('tutor')).toMatch(/espera pela sua aprovação/)
    // O que o professor vê do Tutor é uso e dificuldade de aprendizagem, e não o comportamento do aluno (regra 70, item 7).
    expect(texto('tutor')).toMatch(/Do Tutor você vê o uso: onde a turma travou e qual dúvida se repetiu/)
  })

  it('o passo 3 diz que a IA não corrige redação nem discursiva e que a correção é do professor, sem prometer rascunho nem nota (D55)', () => {
    expect(texto('discursiva')).toMatch(/não corrijo redação nem discursiva/)
    expect(texto('discursiva')).toMatch(/rubrica/)
    expect(texto('discursiva')).toMatch(/organização do lote/)
    expect(texto('discursiva')).toMatch(/a correção é sua/)
    // O que a diretriz chama de pré-correção não aparece, nem como oferta.
    expect(texto('discursiva')).not.toMatch(/rascunho|pré-?correç|sugest|nota\b|conceito/i)
  })

  it('o passo 3 diz que na objetiva só vale depois da aprovação do professor', () => {
    expect(texto('discursiva')).toMatch(/objetiva eu corrijo, e o resultado só vale depois da sua aprovação/)
  })

  it('o passo 4 diz que usar ou não a ferramenta não vira número, indicador nem cobrança, e que a conversa não vai à coordenação (D64)', () => {
    expect(texto('indicador')).toMatch(/Usar ou não esta ferramenta não gera número sobre você/)
    expect(texto('indicador')).toMatch(/não vira indicador, aviso nem cobrança/)
    expect(texto('indicador')).toMatch(/não aparece para a coordenação/)
  })

  it('nenhum passo fala de ranking, meta de uso, pontos, sequência nem de sentimento', () => {
    const proibido = /ranking|meta de uso|metas?\b|pontos?\b|sequência|prêmio|feliz|triste|adoro|gosto de você|orgulho|animad/i
    for (const frase of TUDO_QUE_A_ONCA_DIZ) expect(frase).not.toMatch(proibido)
  })

  it('o termo proibido, posto numa frase, seria pego (a lista não é decoração)', () => {
    const proibido = /ranking|meta de uso|metas?\b|pontos?\b|sequência|prêmio|feliz|triste|adoro|gosto de você|orgulho|animad/i
    for (const exemplo of ['Veja o ranking.', 'A meta de uso é 80%.', 'Você fez 10 pontos.', 'Uma sequência de dias.', 'Fico feliz com você.']) expect(exemplo).toMatch(proibido)
  })
})

describe('onde fica cada coisa', () => {
  it('o título é "Onde fica cada coisa"', () => {
    expect(TITULO_DE_ONDE_FICA_CADA_COISA).toBe('Onde fica cada coisa')
  })

  it('todo lugar da navegação do professor tem a frase dele, e nenhuma frase é de lugar que a navegação não tem', () => {
    const rotulos = NAVEGACAO.professor.map((lugar) => lugar.rotulo)
    for (const rotulo of rotulos) expect(DESCRICAO_DO_LUGAR[rotulo], rotulo).toBeTruthy()
    expect(Object.keys(DESCRICAO_DO_LUGAR).sort()).toEqual([...rotulos].sort())
  })

  it('cada frase termina em ponto e cabe numa linha curta', () => {
    for (const frase of Object.values(DESCRICAO_DO_LUGAR)) {
      expect(frase.endsWith('.'), frase).toBe(true)
      expect(frase.trim().split(/\s+/).length, frase).toBeLessThanOrEqual(12)
    }
  })
})

describe('as falas que o e2e espera', () => {
  it('a lista `FALAS_DA_INTRODUCAO_DO_PROFESSOR` do e2e é a das falas dos passos, na ordem: mudar o texto num lugar e não no outro reprova aqui', () => {
    // O `e2e/` não importa a web, e por isso guarda uma cópia das falas: este caso a confere contra os passos de verdade.
    const fonte = readFileSync(join(import.meta.dirname, '..', '..', '..', '..', '..', '..', 'e2e', 'support', 'casca.ts'), 'utf8')
    const bloco = /FALAS_DA_INTRODUCAO_DO_PROFESSOR = \[([^\]]*)\] as const/.exec(fonte)
    expect(bloco, 'a lista saiu de `e2e/support/casca.ts`: atualize este caso').not.toBeNull()
    const copiadas = [...(bloco?.[1] ?? '').matchAll(/'([^']*)'/g)].map((achado) => achado[1])
    expect(copiadas).toEqual(PASSOS_DO_PROFESSOR.map((passo) => passo.fala))
  })
})

describe('as falas do Assistente (regra 70, itens 4a e 4b; D58, D59)', () => {
  const AFIRMA_SER_PESSOA = /\b(sou|era|serei|somos)\s+(?:(?:uma?|seu|sua|o|a)\s+)?(pessoa|humano|humana|gente|professor|professora|amig[oa]|colega)\b/i
  const PROMETE_VOLTAR_OU_ESPERAR = /\b(volto|voltarei|vou voltar|espero|esperando|esperarei|vou esperar|sempre\s+(estou|estarei|aqui|ali|junto|por perto|com você)|estou aqui (para|pra) você)\b/i
  const VINCULO_OU_SAUDADE = /\b(saudades?|amig[oa]s?|amizade|vínculo|carinho|te amo|sinto sua falta|sentimos sua falta)\b/i

  it('nenhum texto da introdução afirma ser pessoa, professor ou amigo', () => {
    for (const frase of TUDO_QUE_A_ONCA_DIZ) expect(frase).not.toMatch(AFIRMA_SER_PESSOA)
  })

  it('nenhum promete voltar, esperar ou estar sempre ali', () => {
    for (const frase of TUDO_QUE_A_ONCA_DIZ) expect(frase).not.toMatch(PROMETE_VOLTAR_OU_ESPERAR)
  })

  it('nenhum usa termo de vínculo ou de saudade', () => {
    for (const frase of TUDO_QUE_A_ONCA_DIZ) expect(frase).not.toMatch(VINCULO_OU_SAUDADE)
  })

  it('as três listas pegam o que dizem pegar, e "Eu sou um programa" não é confundido com a afirmação', () => {
    expect('Eu sou uma pessoa como você.').toMatch(AFIRMA_SER_PESSOA)
    expect('Sou seu colega.').toMatch(AFIRMA_SER_PESSOA)
    expect('Eu sou o professor da turma.').toMatch(AFIRMA_SER_PESSOA)
    expect('Eu volto amanhã.').toMatch(PROMETE_VOLTAR_OU_ESPERAR)
    expect('Eu espero você aqui.').toMatch(PROMETE_VOLTAR_OU_ESPERAR)
    expect('Estou sempre aqui.').toMatch(PROMETE_VOLTAR_OU_ESPERAR)
    expect('Que saudade de você!').toMatch(VINCULO_OU_SAUDADE)
    expect('Nossa amizade.').toMatch(VINCULO_OU_SAUDADE)
    expect('Eu sou um programa e posso errar.').not.toMatch(AFIRMA_SER_PESSOA)
  })

  it('o texto fixo não muda com ninguém: sem número, sem "de novo" e sem conta de uso', () => {
    for (const frase of PASSOS_DO_PROFESSOR.flatMap((passo) => [passo.fala, ...passo.linhas])) {
      expect(frase).not.toMatch(/\d|de volta|de novo|faz tempo/i)
    }
  })
})
