import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GRUPO_MINIMO_DE_PROFESSORES, NOMES_DOS_AGENTES } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { O_QUE_A_IA_NUNCA_FAZ } from '../governanca/nunca-faz'
import { NAVEGACAO } from '../../navigation'
import {
  AGENTE_DA_INTRODUCAO,
  DESCRICAO_DO_LUGAR,
  FALA_DO_PASSO_2,
  FALA_DO_PASSO_3,
  FALA_DO_PASSO_4,
  falaDoPasso1,
  falasDosPassos,
  PASSOS_DA_COORDENACAO,
  TITULO_DE_ONDE_FICA_CADA_COISA,
  TOTAL_DE_PASSOS,
} from './textos-da-introducao'

/** O grupo mínimo de professores por extenso, como a frase do passo 2 o escreve. Número que não está aqui sai como "<<n>>" e reprova o caso: escreva a palavra e a frase juntas. */
const POR_EXTENSO: Readonly<Record<number, string>> = { 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco' }
const PALAVRA_DO_GRUPO_MINIMO = POR_EXTENSO[GRUPO_MINIMO_DE_PROFESSORES] ?? `<<${String(GRUPO_MINIMO_DE_PROFESSORES)}>>`

/**
 * Os textos da introdução da coordenação (telas do aluno e primeiro acesso, 11.0; RF15, RF19; regra 20, itens 10 e 10a; regra 70,
 * itens 2, 4a, 8 e 9; D45, D55, D57, D58, D64). Regra pura, sem tela: o que cada passo diz, uma asserção por elemento (apagar qualquer
 * ideia deixa um caso vermelho), e as falas sem afirmar ser pessoa nem prometer voltar. A tela que os mostra está em `BemVindo.test.tsx`.
 */

const ESCOLA = 'Colégio Vista Alegre'

const texto = (id: string): string => {
  const passo = PASSOS_DA_COORDENACAO.find((candidato) => candidato.id === id)
  const indice = PASSOS_DA_COORDENACAO.findIndex((candidato) => candidato.id === id)
  if (passo === undefined) throw new Error(`faltou o passo ${id}`)
  return [falasDosPassos(ESCOLA)[indice], ...passo.linhas].join(' ')
}

/** Tudo o que a coordenação lê na introdução, fora a lista de lugares (que tem o teste dela, abaixo). */
const TUDO_QUE_A_ONCA_DIZ: readonly string[] = [
  ...falasDosPassos(ESCOLA),
  ...falasDosPassos(),
  ...PASSOS_DA_COORDENACAO.flatMap((passo) => passo.linhas),
  TITULO_DE_ONDE_FICA_CADA_COISA,
  ...Object.values(DESCRICAO_DO_LUGAR),
]

describe('os passos da introdução da coordenação', () => {
  it('são quatro, na ordem: os números da escola, o agregado, o nominal com motivo e o que a IA nunca faz', () => {
    expect(TOTAL_DE_PASSOS).toBe(4)
    expect(PASSOS_DA_COORDENACAO.map((passo) => passo.id)).toEqual(['numeros', 'agregado', 'nominal', 'nunca'])
  })

  it('as falas são as da tarefa, palavra por palavra, e a do passo 1 diz o nome da escola', () => {
    expect(falasDosPassos(ESCOLA)).toEqual([
      'Eu ajudo a ler os números de Colégio Vista Alegre.',
      'Você vê a escola em números agregados.',
      'Dado com nome só abre com um motivo, e isso fica registrado.',
      'Estas coisas a IA nunca faz.',
    ])
    expect([FALA_DO_PASSO_2, FALA_DO_PASSO_3, FALA_DO_PASSO_4]).toEqual(falasDosPassos(ESCOLA).slice(1))
  })

  it('o nome da escola vem depois de "de", e não de "da": "Colégio" e "Escola" concordam com a mesma frase', () => {
    for (const nome of ['Colégio Vista Alegre', 'Escola Municipal Jardim das Flores', 'Instituto Lago Azul']) expect(falaDoPasso1(nome)).toBe(`Eu ajudo a ler os números de ${nome}.`)
  })

  it('enquanto o nome da escola não chegou (o carregando), a fala do passo 1 diz "da sua escola" e não deixa buraco', () => {
    expect(falaDoPasso1()).toBe('Eu ajudo a ler os números da sua escola.')
    expect(falaDoPasso1()).not.toMatch(/undefined|null|\{|\}/)
    expect(falasDosPassos()[0]).toBe(falaDoPasso1())
  })

  it('nenhum é obrigatório: a coordenação pode pular a introdução inteira (RF15)', () => {
    expect(PASSOS_DA_COORDENACAO.map((passo) => passo.obrigatorio)).toEqual([false, false, false, false])
  })

  it('quem fala é o Analista de desempenho escolar, e nenhum passo traz a pose da comemoração', () => {
    expect(AGENTE_DA_INTRODUCAO).toBe('analista_de_desempenho_escolar')
    expect(NOMES_DOS_AGENTES[AGENTE_DA_INTRODUCAO]).toBe('Analista de desempenho escolar')
    for (const passo of PASSOS_DA_COORDENACAO) expect(['acenando', 'apontando']).toContain(passo.pose)
  })

  it('o passo 1 diz que a IA prepara e avisa e quem aprova é a escola, e que o Analista é um programa e pode errar', () => {
    expect(texto('numeros')).toMatch(/Eu preparo e aviso\. Quem aprova é a escola\./)
    expect(texto('numeros')).toMatch(/programa e posso errar/i)
  })

  it('o passo 2 diz que a escola se vê em números agregados e que o desempenho de professores só aparece com dois ou mais no grupo (D45)', () => {
    expect(texto('agregado')).toMatch(/Você vê a escola em números agregados/)
    expect(texto('agregado')).toMatch(/somadas, sem nome de pessoa/)
    expect(texto('agregado')).toContain(`O desempenho de professores só aparece com ${PALAVRA_DO_GRUPO_MINIMO} ou mais no grupo.`)
  })

  it('"dois ou mais" é o grupo mínimo que o código aplica: mudar `GRUPO_MINIMO_DE_PROFESSORES` obriga a mudar a frase', () => {
    expect(texto('agregado')).toContain(`com ${PALAVRA_DO_GRUPO_MINIMO} ou mais`)
  })

  it('o passo 3 diz que o dado com nome só abre com um motivo e que o registro guarda quem abriu, quando e para quê (regra 20, item 10)', () => {
    expect(texto('nominal')).toMatch(/Dado com nome só abre com um motivo, e isso fica registrado/)
    expect(texto('nominal')).toMatch(/Abrir um aluno ou um professor pelo nome pede um motivo/)
    expect(texto('nominal')).toMatch(/O registro guarda quem abriu, quando e para quê/)
  })

  it('o passo 4 traz a lista do que a IA nunca faz, a mesma da Governança, na mesma ordem', () => {
    expect(texto('nunca')).toMatch(/Estas coisas a IA nunca faz/)
    const passo = PASSOS_DA_COORDENACAO.find((candidato) => candidato.id === 'nunca')
    expect(passo?.linhas).toEqual(O_QUE_A_IA_NUNCA_FAZ)
    expect(O_QUE_A_IA_NUNCA_FAZ.length).toBeGreaterThan(0)
  })

  it('o que a IA nunca faz diz as quatro vedações que o CNE e a D55 fazem: discursiva, decisão sobre aluno, emoção e ranking de professor', () => {
    const lista = O_QUE_A_IA_NUNCA_FAZ.join(' ')
    expect(lista).toMatch(/redação e discursiva/)
    expect(lista).toMatch(/aprovação, reprovação ou encaminhamento de aluno/)
    expect(lista).toMatch(/Inferir emoção/)
    expect(lista).toMatch(/Ranquear professores/)
  })

  it('nenhum passo fala de ranking, meta de uso, pontos, sequência nem de sentimento', () => {
    const proibido = /ranking|meta de uso|metas?\b|pontos?\b|sequência|prêmio|feliz|triste|adoro|gosto de você|orgulho|animad/i
    for (const frase of TUDO_QUE_A_ONCA_DIZ) expect(frase).not.toMatch(proibido)
  })

  it('o termo proibido, posto numa frase, seria pego (a lista não é decoração)', () => {
    const proibido = /ranking|meta de uso|metas?\b|pontos?\b|sequência|prêmio|feliz|triste|adoro|gosto de você|orgulho|animad/i
    for (const exemplo of ['Veja o ranking.', 'A meta de uso é 80%.', 'Você fez 10 pontos.', 'Uma sequência de dias.', 'Fico feliz com você.']) expect(exemplo).toMatch(proibido)
  })

  it('nenhum passo promete aumentar o uso ou mede o professor: sem "adoção", sem "engajamento" e sem cobrança (D64)', () => {
    for (const frase of [...falasDosPassos(ESCOLA), ...PASSOS_DA_COORDENACAO.flatMap((passo) => (passo.id === 'nunca' ? [] : passo.linhas))]) {
      expect(frase).not.toMatch(/ado[çc][ãa]o|engaj|cobran[çc]a|produtividade/i)
    }
  })
})

describe('onde fica cada coisa', () => {
  it('o título é "Onde fica cada coisa"', () => {
    expect(TITULO_DE_ONDE_FICA_CADA_COISA).toBe('Onde fica cada coisa')
  })

  it('todo lugar da navegação da coordenação tem a frase dele, e nenhuma frase é de lugar que a navegação não tem', () => {
    const rotulos = NAVEGACAO.coordenador.map((lugar) => lugar.rotulo)
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
  const fonte = readFileSync(join(import.meta.dirname, '..', '..', '..', '..', '..', '..', 'e2e', 'support', 'casca.ts'), 'utf8')

  it('a lista `FALAS_DOS_PASSOS_2_A_4_DA_COORDENACAO` do e2e é a das falas dos passos 2 a 4, na ordem: mudar o texto num lugar e não no outro reprova aqui', () => {
    // O `e2e/` não importa a web, e por isso guarda uma cópia das falas: este caso a confere contra os passos de verdade.
    const bloco = /FALAS_DOS_PASSOS_2_A_4_DA_COORDENACAO = \[([^\]]*)\] as const/.exec(fonte)
    expect(bloco, 'a lista saiu de `e2e/support/casca.ts`: atualize este caso').not.toBeNull()
    const copiadas = [...(bloco?.[1] ?? '').matchAll(/'([^']*)'/g)].map((achado) => achado[1])
    expect(copiadas).toEqual(falasDosPassos(ESCOLA).slice(1))
  })

  it('a fala do passo 1 do e2e é a do código, com o nome da escola no lugar', () => {
    const molde = /falaDoPasso1DaCoordenacao = \(escolaNome: string\): string => `([^`]*)`/.exec(fonte)
    expect(molde, 'a função saiu de `e2e/support/casca.ts`: atualize este caso').not.toBeNull()
    expect((molde?.[1] ?? '').replace('${escolaNome}', ESCOLA)).toBe(falaDoPasso1(ESCOLA))
  })
})

describe('as falas do Analista (regra 70, itens 4a e 4b; D58, D59)', () => {
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
    expect('Eu sou o professor da escola.').toMatch(AFIRMA_SER_PESSOA)
    expect('Eu volto amanhã.').toMatch(PROMETE_VOLTAR_OU_ESPERAR)
    expect('Eu espero você aqui.').toMatch(PROMETE_VOLTAR_OU_ESPERAR)
    expect('Estou sempre aqui.').toMatch(PROMETE_VOLTAR_OU_ESPERAR)
    expect('Que saudade de você!').toMatch(VINCULO_OU_SAUDADE)
    expect('Nossa amizade.').toMatch(VINCULO_OU_SAUDADE)
    expect('Eu sou um programa e posso errar.').not.toMatch(AFIRMA_SER_PESSOA)
  })

  it('o texto fixo não muda com ninguém: sem número, sem "de novo" e sem conta de uso', () => {
    for (const frase of [...falasDosPassos(ESCOLA), ...PASSOS_DA_COORDENACAO.flatMap((passo) => passo.linhas)]) {
      expect(frase).not.toMatch(/\d|de volta|de novo|faz tempo/i)
    }
  })
})
