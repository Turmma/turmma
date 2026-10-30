import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { extrairFatos, type Trecho } from '../../packages/nucleo/src/ia/material.ts'
import type { TaskDefinition } from '../../packages/nucleo/src/ia/tarefa.ts'
import { gerarAtividadeObjetiva } from '../../packages/nucleo/src/ia/tarefas/gerar-atividade-objetiva.ts'
import { gerarPlanoDeAula } from '../../packages/nucleo/src/ia/tarefas/gerar-plano-de-aula.ts'
import { turnoDoTutor } from '../../packages/nucleo/src/ia/tarefas/turno-do-tutor.ts'
import { MATERIAL_DE_DEMONSTRACAO, PAGINAS_DO_MATERIAL, normalizarTexto, textoDaPagina } from './conteudo-estequiometria.ts'
import { extrairTextoPorPagina } from './extrair-texto.ts'
import { CAMINHO_DO_MATERIAL } from './gerar-material.ts'

// O adaptador falso de IA é o que a demonstração usa sem modelo (`docs/mvp-rapido.md` seção 4, item 4). Ele só serve
// se render com o material de demonstração de verdade: aqui o trecho de cada página é o texto deste material, como
// o conteúdo o declara e como a extração do PDF commitado o devolve.

const MATERIAL = '5c0d7e1f-8a2b-4c3d-9e4f-0a1b2c3d4e5f'
const CONTEXTO = { serie: MATERIAL_DE_DEMONSTRACAO.serie, disciplina: MATERIAL_DE_DEMONSTRACAO.disciplina }
const HABILIDADES = [
  { codigo: 'EM13CNT101', descricao: 'Aplicar a conservação da massa e a proporção estequiométrica em equação balanceada' },
  { codigo: 'EM13CNT301', descricao: 'Identificar o reagente limitante e o reagente em excesso de uma reação' },
  { codigo: 'EM13CNT302', descricao: 'Calcular o rendimento teórico, o rendimento real e a pureza' },
]

const TRECHOS: Trecho[] = PAGINAS_DO_MATERIAL.map((pagina) => ({ materialId: MATERIAL, pagina: pagina.numero, texto: textoDaPagina(pagina.numero) }))
const paginaInteira = (numero: number): string => normalizarTexto(textoDaPagina(numero))
const semAcentoNemCaixa = (texto: string): string => normalizarTexto(texto).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const semPonto = (texto: string): string => texto.replace(/[.!?]+$/u, '')

/** A frase está nesta página e em nenhuma outra: a citação aponta para onde a frase saiu de fato. */
function expectFraseSoDaPagina(frase: string, pagina: number): void {
  expect(paginaInteira(pagina), `"${frase}" não está na página ${String(pagina)}`).toContain(frase)
  for (const outra of PAGINAS_DO_MATERIAL) {
    if (outra.numero !== pagina) expect(paginaInteira(outra.numero)).not.toContain(frase)
  }
}

/**
 * O caminho que o provedor faz com o adaptador falso: a entrada passa pelo schema, a versão determinística da tarefa
 * gera, e a saída passa pelo schema e pela conferência da tarefa. O provedor em si é testado em `packages/nucleo`;
 * aqui só entram as tarefas, que são dado (este teste é conferido pelo `tsconfig` da raiz, que não aceita a sintaxe
 * das classes do provedor).
 */
function executar<Entrada, Saida>(tarefa: TaskDefinition<Entrada, Saida>, entrada: Entrada): Saida {
  const saida = tarefa.esquemaDeSaida.parse(tarefa.semModelo?.(tarefa.esquemaDeEntrada.parse(entrada)) ?? tarefa.falso(tarefa.esquemaDeEntrada.parse(entrada)))
  expect(tarefa.conferir?.(entrada, saida) ?? []).toEqual([])
  return saida
}

const pedirAtividade = (tema: string, quantidade: number, trechos: Trecho[] = TRECHOS) =>
  executar(gerarAtividadeObjetiva, { tema, quantidade, contexto: CONTEXTO, habilidades: HABILIDADES, trechos })

let trechosDoPdf: Trecho[]

beforeAll(async () => {
  const paginas = await extrairTextoPorPagina(new Uint8Array(readFileSync(CAMINHO_DO_MATERIAL)))
  trechosDoPdf = paginas.map((texto, indice) => ({ materialId: MATERIAL, pagina: indice + 1, texto }))
})

describe('as frases definitórias do material de demonstração', () => {
  it('o material rende mais de vinte definições, de cinco páginas, todas frases-chave declaradas no conteúdo', () => {
    const fatos = extrairFatos(TRECHOS)
    expect(fatos.length).toBeGreaterThanOrEqual(25)
    expect(new Set(fatos.map((fato) => fato.pagina))).toEqual(new Set([1, 2, 3, 4, 5]))
    for (const fato of fatos) {
      // A definição é frase-chave declarada no conteúdo; a relação com número é um item da lista da página.
      const declaradas = PAGINAS_DO_MATERIAL.find((pagina) => pagina.numero === fato.pagina)?.frasesChave ?? []
      if (fato.numerico) expectFraseSoDaPagina(fato.frase, fato.pagina)
      else expect(declaradas, `"${fato.frase}" não é frase-chave da página ${String(fato.pagina)}`).toContain(fato.frase)
    }
    expect(fatos.filter((fato) => fato.numerico).map((fato) => [fato.termo, fato.complemento])).toEqual([
      ['massa molar de água (H2O)', '18 g/mol'],
      ['massa molar de gás carbônico (CO2)', '44 g/mol'],
      ['massa molar de carbonato de cálcio (CaCO3)', '100 g/mol'],
      ['massa molar de cloreto de sódio (NaCl)', '58,5 g/mol'],
    ])
  })

  it('definição sem artigo vira fato, e o que não é definição fica de fora', () => {
    const termos = extrairFatos(TRECHOS).map((fato) => fato.termo)
    for (const termo of ['mol', 'reagente limitante', 'massa molar', 'rendimento teórico', 'constante de Avogadro', 'cálculo mol–mol', 'pureza']) expect(termos).toContain(termo)
    // "O raciocínio é o mesmo de uma receita.", "O queijo é o limitante…", "O pacote da química é o mol.", "Esse valor é…",
    // "Qual é o reagente limitante…?", "O menor resultado é o do O2…", "A massa pura é 250 g × 80 / 100 = …".
    for (const termo of ['raciocínio', 'queijo', 'pacote da química', 'esse valor', 'qual', 'menor resultado', 'massa pura', 'equação', 'erro 1']) expect(termos).not.toContain(termo)
  })

  it('o texto que a extração do PDF devolve, com as quebras de linha do papel, rende os mesmos fatos', () => {
    expect(extrairFatos(trechosDoPdf)).toEqual(extrairFatos(TRECHOS))
  })
})

describe('atividade objetiva a partir do material de demonstração', () => {
  it('pedir 10 questões rende 10 questões válidas pelo schema e pela conferência da tarefa', () => {
    const atividade = pedirAtividade('estequiometria', 10)
    expect(atividade.questoes).toHaveLength(10)
    expect(gerarAtividadeObjetiva.esquemaDeSaida.safeParse(atividade).success).toBe(true)
    expect(atividade.titulo).toBe('Atividade — estequiometria')
  })

  it('cada questão cita a página de onde a frase saiu de fato, e a resposta certa é o que essa frase diz', () => {
    for (const questao of (pedirAtividade('estequiometria', 10)).questoes) {
      expect(questao.citacao.materialId).toBe(MATERIAL)
      expectFraseSoDaPagina(questao.citacao.trecho, questao.citacao.pagina)
      const correta = semPonto(questao.alternativas[questao.gabarito] ?? '')
      expect(semAcentoNemCaixa(questao.citacao.trecho)).toContain(semAcentoNemCaixa(correta))
      expect(questao.explicacao).toContain(`página ${String(questao.citacao.pagina)}`)
    }
  })

  it('nenhum enunciado contém a própria resposta, nem carrega título de seção colado', () => {
    for (const questao of (pedirAtividade('estequiometria', 20)).questoes) {
      const correta = semAcentoNemCaixa(semPonto(questao.alternativas[questao.gabarito] ?? ''))
      expect(correta.length).toBeGreaterThan(3)
      expect(semAcentoNemCaixa(questao.enunciado)).not.toContain(correta)
      expect(questao.enunciado).toMatch(/^Segundo o material, (o que|qual) é [^.:;]+\?$/)
      expect(questao.enunciado).not.toMatch(/\d\.\d/)
    }
  })

  it('as quatro alternativas são distintas, todas são definições do próprio material, e a posição da correta varia', () => {
    const { questoes } = pedirAtividade('estequiometria', 10)
    const material = semAcentoNemCaixa(PAGINAS_DO_MATERIAL.map((pagina) => textoDaPagina(pagina.numero)).join(' '))
    for (const questao of questoes) {
      expect(new Set(questao.alternativas.map(semAcentoNemCaixa)).size).toBe(4)
      for (const alternativa of questao.alternativas) expect(material).toContain(semAcentoNemCaixa(semPonto(alternativa)))
    }
    expect(new Set(questoes.map((questao) => questao.gabarito)).size).toBeGreaterThanOrEqual(3)
  })

  it('as questões vêm de pelo menos quatro páginas diferentes, e não repetem conceito', () => {
    const { questoes } = pedirAtividade('estequiometria', 10)
    expect(new Set(questoes.map((questao) => questao.citacao.pagina)).size).toBeGreaterThanOrEqual(4)
    expect(new Set(questoes.map((questao) => questao.enunciado)).size).toBe(10)
  })

  it('o tema pedido vem primeiro: atividade sobre reagente limitante abre com o reagente limitante, da página 4', () => {
    const { questoes } = pedirAtividade('reagente limitante', 5)
    expect(questoes[0]?.enunciado).toBe('Segundo o material, o que é reagente limitante?')
    expect(questoes[0]?.alternativas[questoes[0].gabarito]).toBe('O reagente que acaba primeiro e determina quanto produto se forma.')
    expect(questoes[0]?.citacao.pagina).toBe(4)
    // Os distratores são do mesmo assunto, não definições quaisquer.
    expect(questoes[0]?.alternativas).toContain('O reagente que sobra quando a reação termina.')
    expect(questoes[0]?.alternativas).toContain('A quantidade de reagente que sobra depois que o reagente limitante acaba.')
    expect(questoes.filter((questao) => questao.citacao.pagina === 4).length).toBeGreaterThanOrEqual(3)
  })

  it('a atividade não é só "o que é X?": a relação com número do material vira questão, com as outras massas molares como distratores', () => {
    const { questoes } = pedirAtividade('estequiometria', 10)
    const numericas = questoes.filter((questao) => questao.enunciado.startsWith('Segundo o material, qual é '))
    expect(numericas.length).toBeGreaterThanOrEqual(1)
    const [daAgua] = pedirAtividade('massa molar', 6).questoes.filter((questao) => questao.enunciado === 'Segundo o material, qual é a massa molar de água (H2O)?')
    if (daAgua === undefined) throw new Error('a atividade sobre massa molar deveria perguntar a da água')
    expect(daAgua.alternativas[daAgua.gabarito]).toBe('18 g/mol')
    expect([...daAgua.alternativas].sort()).toEqual(['100 g/mol', '18 g/mol', '44 g/mol', '58,5 g/mol'])
    expect(daAgua.citacao).toEqual({ materialId: MATERIAL, pagina: 2, trecho: 'Água, H2O: 2 × 1 + 16 = 18 g/mol.' })
    expectFraseSoDaPagina(daAgua.citacao.trecho, 2)
    expect(daAgua.enunciado).not.toContain('18')
  })

  it('com o texto extraído do PDF, a atividade é a mesma', () => {
    expect(pedirAtividade('estequiometria', 10, trechosDoPdf)).toEqual(pedirAtividade('estequiometria', 10))
  })
})

describe('plano de aula a partir do material de demonstração', () => {
  const pedirPlano = (tema: string) => executar(gerarPlanoDeAula, { tema, duracaoMinutos: 50, contexto: CONTEXTO, habilidades: HABILIDADES, trechos: TRECHOS })

  it('sai válido, com as etapas somando a duração e cada etapa citando a página de onde a frase saiu de fato', () => {
    const plano = pedirPlano('estequiometria')
    expect(gerarPlanoDeAula.esquemaDeSaida.safeParse(plano).success).toBe(true)
    expect(plano.etapas.reduce((soma, etapa) => soma + etapa.minutos, 0)).toBe(50)
    for (const etapa of plano.etapas) {
      if (etapa.citacao === undefined) throw new Error(`a etapa "${etapa.titulo}" ficou sem citação`)
      expectFraseSoDaPagina(etapa.citacao.trecho, etapa.citacao.pagina)
      expect(etapa.descricao).toContain(`página ${String(etapa.citacao.pagina)}`)
    }
    for (const citacao of plano.citacoes) expectFraseSoDaPagina(citacao.trecho, citacao.pagina)
  })

  it('o plano sobre reagente limitante se apoia na página do reagente limitante, e fala do conceito pelo nome', () => {
    const plano = pedirPlano('reagente limitante')
    expect(plano.etapas.filter((etapa) => etapa.citacao?.pagina === 4).length).toBeGreaterThanOrEqual(3)
    expect(plano.objetivos).toContain('Explicar o conceito de reagente limitante com as próprias palavras, com apoio do material.')
    const texto = JSON.stringify(plano)
    // Nada de artigo solto antes do termo nem de título de seção colado no texto do plano.
    expect(texto).not.toMatch(/ {2}|por o |de o conceito|\d\.\d [A-Z]/)
  })
})

describe('turno do Tutor sobre o material de demonstração', () => {
  const perguntar = (entrada: Partial<Parameters<typeof turnoDoTutor.falso>[0]> & { duvida: string }) =>
    executar(turnoDoTutor, { contexto: CONTEXTO, trechos: TRECHOS, memoria: [], turnosAnteriores: [], ...entrada })

  it.each([
    ['o que é reagente limitante?', 4, 'Reagente limitante é…'],
    ['não entendi o que é mol', 1, 'Mol é…'],
    ['me explica rendimento teórico', 5, 'Rendimento teórico é…'],
    ['o que significa massa molar', 2, 'Massa molar é…'],
    ['o que é cálculo mol–mol?', 3, 'Cálculo mol–mol é…'],
  ])('"%s": cita a página %i, onde o conceito é definido, e não entrega a definição de bandeja', (duvida, pagina, comeco) => {
    const saida = perguntar({ duvida })
    expect(saida.citacoes).toEqual([{ materialId: MATERIAL, pagina, trecho: comeco }])
    expect(saida.resposta).toContain(`página ${String(pagina)}`)
    expect(saida.resposta.trimEnd().endsWith('?')).toBe(true)
    // A definição pedida não aparece nem na resposta nem no trecho do chip: o aluno é mandado ler, não recebe pronto.
    const fato = extrairFatos(TRECHOS).find((candidato) => comeco.toLowerCase().startsWith(candidato.termo.toLowerCase()))
    if (fato === undefined) throw new Error(`o material deveria definir o conceito de "${comeco}"`)
    const visivel = semAcentoNemCaixa([saida.resposta, ...saida.citacoes.map((citacao) => citacao.trecho)].join(' '))
    expect(visivel).not.toContain(semAcentoNemCaixa(fato.complemento))
    expect(visivel).not.toContain(semAcentoNemCaixa(fato.complemento.split(' ').slice(0, 4).join(' ')))
  })

  it('na questão gerada a partir do material, pedir a resposta é recusado, com a página certa e sem o texto de nenhuma alternativa', () => {
    const [questao] = (pedirAtividade('reagente limitante', 1)).questoes
    if (questao === undefined) throw new Error('a atividade deveria ter uma questão')
    const emAndamento = { numero: 1, enunciado: questao.enunciado, alternativas: questao.alternativas, habilidade: questao.habilidade }
    for (const duvida of ['qual é a resposta?', 'é a letra D, né?', 'só me diz se é o que acaba ou o que sobra']) {
      const saida = perguntar({ duvida, questao: emAndamento })
      expect(saida.classificacao, duvida).toBe('pediu_resposta_pronta')
      expect(saida.citacoes).toEqual([{ materialId: MATERIAL, pagina: 4, trecho: 'Reagente limitante é…' }])
      const visivel = semAcentoNemCaixa([saida.resposta, ...saida.citacoes.map((citacao) => citacao.trecho)].join(' '))
      for (const alternativa of questao.alternativas) expect(visivel).not.toContain(semAcentoNemCaixa(semPonto(alternativa)))
    }
  })
})
