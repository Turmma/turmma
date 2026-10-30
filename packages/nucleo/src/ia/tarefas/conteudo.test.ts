import type { ConteudoDeAtividade, ConteudoDePlanoDeAula, TipoDeAdaptacao } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { withEscolaContextOfRequest } from '../__fixtures__/contexto-da-escola.js'
import { ScriptedAdapter } from '../__fixtures__/adaptador-roteirizado.js'
import { atividadeDeEstequiometria, entradaDeAdaptacao, entradaDeAtividade, entradaDePlano, ESCOLA_A } from '../__fixtures__/entradas.js'
import { CONTEXTO_DE_QUIMICA, HABILIDADES_DE_ESTEQUIOMETRIA, MATERIAL_DE_ESTEQUIOMETRIA, PAGINAS_DE_ESTEQUIOMETRIA, trechosDeEstequiometria } from '../__fixtures__/estequiometria.js'
import { FakeAdapter } from '../adaptador-falso.js'
import { InMemoryConsumo, InMemoryOrcamento } from '../consumo.js'
import { LLMError } from '../erros.js'
import { extrairFatos } from '../material.js'
import { LLMGateway } from '../provedor.js'
import { InMemorySuspensoes } from '../suspensao.js'
import { normalizar, semPontoFinal } from '../texto.js'
import { adaptarAtividade } from './adaptar-atividade.js'
import { gerarAtividadeObjetiva } from './gerar-atividade-objetiva.js'
import { gerarPlanoDeAula } from './gerar-plano-de-aula.js'

const MATERIAL_INTEIRO = normalizar(PAGINAS_DE_ESTEQUIOMETRIA.join(' '))
const textoDaPagina = (pagina: number): string => PAGINAS_DE_ESTEQUIOMETRIA[pagina - 1] ?? ''
const doMaterial = (texto: string): boolean => MATERIAL_INTEIRO.includes(normalizar(semPontoFinal(texto)))

function provedorCom(adaptador: FakeAdapter | ScriptedAdapter): { ia: LLMGateway; consumo: InMemoryConsumo } {
  const consumo = new InMemoryConsumo()
  return { ia: withEscolaContextOfRequest(new LLMGateway({ adaptador, registro: consumo, orcamento: new InMemoryOrcamento(consumo), suspensao: new InMemorySuspensoes() })), consumo }
}

async function erroDe(promessa: Promise<unknown>): Promise<LLMError> {
  const erro: unknown = await promessa.then(
    () => undefined,
    (motivo: unknown) => motivo,
  )
  if (!(erro instanceof LLMError)) throw new Error('a chamada deveria ter falhado com ErroDeIa')
  return erro
}

describe('gerar_atividade_objetiva, versão determinística', () => {
  it('tira as questões das frases definitórias: a correta é a definição do material, e os distratores são definições de outros termos', () => {
    const atividade = atividadeDeEstequiometria()
    expect(atividade.questoes).toHaveLength(6)
    const fatos = extrairFatos(trechosDeEstequiometria())
    for (const questao of atividade.questoes) {
      const fato = fatos.find((candidato) => candidato.frase === questao.citacao.trecho)
      if (fato === undefined) throw new Error(`a citação de "${questao.enunciado}" não é uma frase do material`)
      expect(questao.enunciado).toContain(fato.termo)
      const correta = questao.alternativas[questao.gabarito] ?? ''
      expect(normalizar(semPontoFinal(correta))).toBe(normalizar(fato.complemento))
      expect(new Set(questao.alternativas.map(normalizar)).size).toBe(4)
      for (const alternativa of questao.alternativas) expect(doMaterial(alternativa), alternativa).toBe(true)
      const definicoesDeOutros = fatos.filter((outro) => outro.termo !== fato.termo).map((outro) => normalizar(outro.complemento))
      for (const [indice, alternativa] of questao.alternativas.entries()) {
        if (indice !== questao.gabarito) expect(definicoesDeOutros).toContain(normalizar(semPontoFinal(alternativa)))
      }
    }
  })

  it('toda questão cita a página de onde saiu, com a frase que está naquela página, e leva uma habilidade da entrada', () => {
    const codigos = HABILIDADES_DE_ESTEQUIOMETRIA.map((habilidade) => habilidade.codigo)
    for (const questao of atividadeDeEstequiometria().questoes) {
      expect(questao.citacao.materialId).toBe(MATERIAL_DE_ESTEQUIOMETRIA)
      expect(textoDaPagina(questao.citacao.pagina)).toContain(questao.citacao.trecho)
      expect(questao.explicacao).toContain(`página ${questao.citacao.pagina}`)
      expect(codigos).toContain(questao.habilidade.codigo)
    }
  })

  it('espalha as questões pelas páginas antes de repetir assunto, e a habilidade acompanha o assunto da página', () => {
    const { questoes } = atividadeDeEstequiometria()
    expect(questoes.map((questao) => questao.citacao.pagina)).toEqual([1, 2, 3, 4, 5, 6])
    expect(questoes.find((questao) => questao.citacao.pagina === 5)?.habilidade.codigo).toBe('EM13CNT301')
    expect(questoes.find((questao) => questao.citacao.pagina === 2)?.habilidade.codigo).toBe('EM13CNT104')
  })

  it('a posição da correta varia entre as questões, sem ser sempre a mesma letra', () => {
    const posicoes = new Set(gerarAtividadeObjetiva.falso({ ...entradaDeAtividade(), quantidade: 12 }).questoes.map((questao) => questao.gabarito))
    expect(posicoes.size).toBeGreaterThanOrEqual(3)
  })

  it('relação com número vira "qual é", com outros valores do material como distratores', () => {
    const atividade = gerarAtividadeObjetiva.falso({ ...entradaDeAtividade(), quantidade: 20, trechos: trechosDeEstequiometria([2]) })
    const daAgua = atividade.questoes.find((questao) => questao.enunciado === 'Segundo o material, qual é a massa molar da água?')
    expect(daAgua?.alternativas[daAgua.gabarito]).toBe('18 g/mol')
    expect([...(daAgua?.alternativas ?? [])].sort()).toEqual(['18 g/mol', '32 g/mol', '44 g/mol', '58,5 g/mol'])
  })

  it('sem frase definitória, cai para lacuna: a palavra certa devolve a frase do material', () => {
    const texto =
      'Na síntese da água, dois mols de gás hidrogênio reagem com um mol de gás oxigênio. ' +
      'Perdas no manuseio e reagentes impuros explicam por que o rendimento real fica abaixo do teórico. ' +
      'Antes de qualquer cálculo, confere-se o balanceamento da equação química inteira. ' +
      'Para achar o limitante, compara-se a quantidade disponível de cada reagente com a proporção.'
    const entrada = { ...entradaDeAtividade(), quantidade: 3, trechos: [{ materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina: 9, texto }] }
    const atividade = gerarAtividadeObjetiva.falso(entrada)
    expect(atividade.questoes).toHaveLength(3)
    for (const questao of atividade.questoes) {
      expect(questao.enunciado).toMatch(/^Complete a frase do material: “.*______.*”$/)
      const certa = questao.alternativas[questao.gabarito] ?? ''
      const frase = questao.enunciado.replace(/^Complete a frase do material: “/, '').replace(/”$/, '')
      expect(texto.toLowerCase()).toContain(frase.replace('______', certa).toLowerCase())
      expect(questao.citacao.pagina).toBe(9)
      expect(questao.citacao.trecho.toLowerCase()).toBe(frase.replace('______', certa).toLowerCase())
    }
    expect(gerarAtividadeObjetiva.conferir?.(entrada, atividade)).toEqual([])
  })

  it('material sem frase aproveitável não vira atividade inventada: falha com material insuficiente', async () => {
    const { ia } = provedorCom(new FakeAdapter())
    const entrada = { ...entradaDeAtividade(), trechos: [{ materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina: 1, texto: 'Sumário. Capítulo 7.' }] }
    expect((await erroDe(ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada, escolaId: ESCOLA_A }))).codigoDeIa).toBe('MATERIAL_INSUFICIENTE')
  })
})

describe('gerar_atividade_objetiva, conferência da saída de qualquer modelo', () => {
  it('o "adaptacao" que o modelo acrescentar à atividade comum sai antes do schema, e a atividade vale', async () => {
    const comAdaptacao = { ...atividadeDeEstequiometria(), adaptacao: { tipos: ['fonte_ampliada'] } }
    const adaptador = new ScriptedAdapter([JSON.stringify(comAdaptacao)])
    const { saida } = await provedorCom(adaptador).ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(adaptador.chamadas).toBe(1)
    expect(saida.adaptacao).toBeUndefined()
  })

  const entrada = entradaDeAtividade()
  const boa = atividadeDeEstequiometria()
  const comPrimeira = (mudanca: Partial<ConteudoDeAtividade['questoes'][number]>): ConteudoDeAtividade => ({
    ...boa,
    questoes: boa.questoes.map((questao, indice) => (indice === 0 ? { ...questao, ...mudanca } : questao)),
  })

  it('questão sem citação nem passa no schema', () => {
    const [primeira, ...demais] = boa.questoes
    if (primeira === undefined) throw new Error('sem questão')
    const { citacao: _citacao, ...semCitacao } = primeira
    expect(gerarAtividadeObjetiva.esquemaDeSaida.safeParse({ ...boa, questoes: [semCitacao, ...demais] }).success).toBe(false)
  })

  it('citar página que não veio nos trechos é saída inválida, mesmo com o material certo', () => {
    const problemas = gerarAtividadeObjetiva.conferir?.(entrada, comPrimeira({ citacao: { materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina: 148, trecho: 'inventado' } })) ?? []
    expect(problemas).toHaveLength(1)
    expect(problemas[0]).toContain('página 148')
  })

  it('citar a página certa de outro material também é saída inválida', () => {
    const outroMaterial = '11111111-2222-4333-8444-555555555555'
    expect(gerarAtividadeObjetiva.conferir?.(entrada, comPrimeira({ citacao: { materialId: outroMaterial, pagina: 1, trecho: 'x' } }))).toHaveLength(1)
  })

  it('habilidade fora da entrada, alternativa repetida, questão a mais e campo de adaptação são recusados', () => {
    expect(gerarAtividadeObjetiva.conferir?.(entrada, comPrimeira({ habilidade: { codigo: 'EF09CI99', descricao: 'inventada' } }))).toHaveLength(1)
    expect(gerarAtividadeObjetiva.conferir?.(entrada, comPrimeira({ alternativas: ['a mesma', 'A Mesma', 'outra', 'mais uma'] }))).toHaveLength(1)
    expect(gerarAtividadeObjetiva.conferir?.({ ...entrada, quantidade: 5 }, boa)).toHaveLength(1)
    expect(gerarAtividadeObjetiva.conferir?.(entrada, { ...boa, adaptacao: { tipos: ['fonte_ampliada'] } })).toHaveLength(1)
  })

  it('o modelo que cita página inventada recebe o problema de volta e, corrigindo, a saída vale', async () => {
    const adaptador = new ScriptedAdapter([
      JSON.stringify(comPrimeira({ citacao: { materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina: 148, trecho: 'inventado' } })),
      JSON.stringify(boa),
    ])
    const { ia } = provedorCom(adaptador)
    const { saida, medicao } = await ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada, escolaId: ESCOLA_A })
    expect(saida).toEqual(boa)
    expect(medicao.tentativas).toBe(2)
    expect(adaptador.correcoes[1]?.problemas.join(' ')).toContain('página 148')
  })
})

describe('gerar_plano_de_aula', () => {
  it.each([10, 50, 240])('com %i minutos, as etapas somam exatamente a duração e nenhuma fica sem tempo', (duracaoMinutos) => {
    const plano = gerarPlanoDeAula.falso({ ...entradaDePlano(), duracaoMinutos })
    expect(plano.etapas.reduce((soma, etapa) => soma + etapa.minutos, 0)).toBe(duracaoMinutos)
    expect(Math.min(...plano.etapas.map((etapa) => etapa.minutos))).toBeGreaterThanOrEqual(1)
    expect(plano.duracaoMinutos).toBe(duracaoMinutos)
  })

  it('toda etapa cita a página, com frase que está naquela página, e a lista de citações não repete página', () => {
    const plano = gerarPlanoDeAula.falso(entradaDePlano())
    expect(plano.etapas).toHaveLength(4)
    for (const etapa of plano.etapas) {
      if (etapa.citacao === undefined) throw new Error(`a etapa "${etapa.titulo}" ficou sem citação`)
      expect(textoDaPagina(etapa.citacao.pagina)).toContain(etapa.citacao.trecho)
      expect(etapa.descricao).toContain(`página ${etapa.citacao.pagina}`)
    }
    const paginas = plano.citacoes.map((citacao) => citacao.pagina)
    expect(new Set(paginas).size).toBe(paginas.length)
    expect(plano.habilidades).toEqual(HABILIDADES_DE_ESTEQUIOMETRIA)
  })

  it('a conferência recusa etapa sem citação, página que não veio, soma acima da duração e habilidade de fora', () => {
    const entrada = entradaDePlano()
    const bom = gerarPlanoDeAula.falso(entrada)
    const comPrimeiraEtapa = (mudar: (etapa: ConteudoDePlanoDeAula['etapas'][number]) => ConteudoDePlanoDeAula['etapas'][number]): ConteudoDePlanoDeAula => ({
      ...bom,
      etapas: bom.etapas.map((etapa, indice) => (indice === 0 ? mudar(etapa) : etapa)),
    })
    const semCitacao = comPrimeiraEtapa(({ citacao: _citacao, ...etapa }) => etapa)
    // O schema aceita a etapa sem citação; quem recusa é a conferência.
    expect(gerarPlanoDeAula.esquemaDeSaida.safeParse(semCitacao).success).toBe(true)
    expect(gerarPlanoDeAula.conferir?.(entrada, semCitacao)).toEqual(['Etapa 1: falta a citação. Toda etapa cita o material e a página de onde saiu.'])
    expect(gerarPlanoDeAula.conferir?.(entrada, comPrimeiraEtapa((etapa) => ({ ...etapa, citacao: { materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina: 77, trecho: 'x' } })))).toHaveLength(1)
    expect(gerarPlanoDeAula.conferir?.(entrada, comPrimeiraEtapa((etapa) => ({ ...etapa, minutos: etapa.minutos + 1 })))).toHaveLength(1)
    expect(gerarPlanoDeAula.conferir?.(entrada, { ...bom, habilidades: [{ codigo: 'EF09CI99', descricao: 'inventada' }] })).toHaveLength(1)
    expect(gerarPlanoDeAula.conferir?.(entrada, { ...bom, citacoes: [{ materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina: 77, trecho: 'x' }] })).toHaveLength(1)
  })

  it('sem frase definitória, o plano se apoia nas frases do material e continua citando a página', () => {
    const texto = 'Na síntese da água, dois mols de gás hidrogênio reagem com um mol de gás oxigênio. Perdas no manuseio explicam por que o rendimento real fica abaixo do teórico.'
    const entrada = { ...entradaDePlano(), trechos: [{ materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina: 4, texto }] }
    const plano = gerarPlanoDeAula.falso(entrada)
    expect(gerarPlanoDeAula.esquemaDeSaida.safeParse(plano).success).toBe(true)
    expect(gerarPlanoDeAula.conferir?.(entrada, plano)).toEqual([])
    expect(plano.citacoes).toEqual([{ materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina: 4, trecho: expect.stringContaining('síntese da água') as unknown as string }])
  })
})

describe('adaptar_atividade', () => {
  it('os tipos de adaptação são do professor: o que o modelo escrever no lugar deles é trocado pelo que veio na entrada, e a resposta vale', async () => {
    // O caso do ensaio com o Qwen (04/10/2026): sem tempo adicional pedido, ele devolvia `tempoExtraPercentual: 0`, e o
    // schema reprovava a versão adaptada inteira duas vezes.
    const tipos: TipoDeAdaptacao[] = ['fonte_ampliada', 'linguagem_direta']
    const entrada = { ...entradaDeAdaptacao(), adaptacao: { tipos } }
    const doModelo = { ...entrada.conteudo, adaptacao: { tipos: ['enunciado_simplificado'], tempoExtraPercentual: 0 } }
    const adaptador = new ScriptedAdapter([JSON.stringify(doModelo)])
    const { saida } = await provedorCom(adaptador).ia.gerar({ tarefa: adaptarAtividade, entrada, escolaId: ESCOLA_A })
    expect(adaptador.chamadas).toBe(1)
    expect(saida.adaptacao).toEqual({ tipos: ['fonte_ampliada', 'linguagem_direta'] })
  })

  it('recebe só a atividade e os tipos: texto sobre o aluno, nome ou diagnóstico não têm onde entrar (D35, D67)', () => {
    const entrada = entradaDeAdaptacao()
    expect(adaptarAtividade.esquemaDeEntrada.safeParse(entrada).success).toBe(true)
    for (const extra of [{ aluno: 'Enzo Martins' }, { motivo: 'aluno com dislexia' }, { diagnostico: 'TDAH' }, { observacao: 'tem dificuldade de leitura' }]) {
      expect(adaptarAtividade.esquemaDeEntrada.safeParse({ ...entrada, ...extra }).success).toBe(false)
      expect(adaptarAtividade.esquemaDeEntrada.safeParse({ ...entrada, adaptacao: { ...entrada.adaptacao, ...extra } }).success).toBe(false)
    }
    // O tipo é de uma lista fechada: texto livre no lugar do tipo não passa.
    expect(adaptarAtividade.esquemaDeEntrada.safeParse({ ...entrada, adaptacao: { tipos: ['aluno com dislexia'] } }).success).toBe(false)
    expect(adaptarAtividade.esquemaDeEntrada.safeParse({ ...entrada, adaptacao: { tipos: [] } }).success).toBe(false)
  })

  it('tempo extra só vale com o tipo de tempo adicional, e versão adaptada não é adaptada de novo', () => {
    const entrada = entradaDeAdaptacao()
    expect(adaptarAtividade.esquemaDeEntrada.safeParse({ ...entrada, adaptacao: { tipos: ['fonte_ampliada'], tempoExtraPercentual: 50 } }).success).toBe(false)
    expect(adaptarAtividade.esquemaDeEntrada.safeParse({ ...entrada, conteudo: { ...entrada.conteudo, adaptacao: { tipos: ['fonte_ampliada'] } } }).success).toBe(false)
  })

  it('devolve o mesmo gabarito, as mesmas alternativas, a mesma habilidade e a mesma citação, questão a questão', () => {
    const entrada = { ...entradaDeAdaptacao(), adaptacao: { tipos: ['linguagem_direta', 'enunciado_simplificado', 'leitura_de_apoio'] as const } }
    const adaptada = adaptarAtividade.falso({ ...entrada, adaptacao: { tipos: [...entrada.adaptacao.tipos] } })
    expect(adaptada.questoes).toHaveLength(entrada.conteudo.questoes.length)
    adaptada.questoes.forEach((questao, indice) => {
      const original = entrada.conteudo.questoes[indice]
      expect(questao.gabarito).toBe(original?.gabarito)
      expect(questao.alternativas).toEqual(original?.alternativas)
      expect(questao.habilidade).toEqual(original?.habilidade)
      expect(questao.citacao).toEqual(original?.citacao)
      expect(questao.enunciado).not.toBe(original?.enunciado)
    })
    expect(adaptada.adaptacao).toEqual({ tipos: ['linguagem_direta', 'enunciado_simplificado', 'leitura_de_apoio'] })
  })

  it('linguagem direta tira o rodeio do enunciado; leitura de apoio aponta a página sem copiar a frase que é a resposta', () => {
    const entrada = entradaDeAdaptacao()
    const direta = adaptarAtividade.falso({ ...entrada, adaptacao: { tipos: ['linguagem_direta'] } })
    expect(direta.questoes[0]?.enunciado).toBe('O que é o mol?')
    const comApoio = adaptarAtividade.falso({ ...entrada, adaptacao: { tipos: ['leitura_de_apoio'] } })
    comApoio.questoes.forEach((questao) => {
      expect(questao.enunciado).toContain(`releia a página ${questao.citacao.pagina} do material`)
      expect(questao.enunciado).not.toContain(semPontoFinal(questao.alternativas[questao.gabarito] ?? ''))
    })
  })

  it('fonte ampliada e tempo adicional mudam a aplicação, não o texto: ficam registrados e as questões não mudam', () => {
    const entrada = { conteudo: atividadeDeEstequiometria(), adaptacao: { tipos: ['fonte_ampliada', 'tempo_adicional'] as ('fonte_ampliada' | 'tempo_adicional')[], tempoExtraPercentual: 50 } }
    const adaptada = adaptarAtividade.falso(entrada)
    expect(adaptada.questoes).toEqual(entrada.conteudo.questoes)
    expect(adaptada.adaptacao).toEqual({ tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 50 })
  })

  it('a conferência recusa gabarito trocado, citação trocada, habilidade trocada, questão a menos e adaptação diferente da pedida', () => {
    const entrada = entradaDeAdaptacao()
    const boa = adaptarAtividade.falso(entrada)
    const comPrimeira = (mudanca: Partial<ConteudoDeAtividade['questoes'][number]>): ConteudoDeAtividade => ({
      ...boa,
      questoes: boa.questoes.map((questao, indice) => (indice === 0 ? { ...questao, ...mudanca } : questao)),
    })
    const primeira = boa.questoes[0]
    if (primeira === undefined) throw new Error('sem questão')
    expect(adaptarAtividade.conferir?.(entrada, boa)).toEqual([])
    expect(adaptarAtividade.conferir?.(entrada, comPrimeira({ gabarito: (primeira.gabarito + 1) % 4 }))).toEqual(['Questão 1: o gabarito e a ordem das alternativas não mudam na adaptação.'])
    expect(adaptarAtividade.conferir?.(entrada, comPrimeira({ citacao: { ...primeira.citacao, pagina: primeira.citacao.pagina + 1 } }))).toHaveLength(1)
    expect(adaptarAtividade.conferir?.(entrada, comPrimeira({ habilidade: { codigo: 'EF09CI99', descricao: 'outra' } }))).toHaveLength(1)
    expect(adaptarAtividade.conferir?.(entrada, { ...boa, questoes: boa.questoes.slice(1) }).length).toBeGreaterThan(0)
    expect(adaptarAtividade.conferir?.(entrada, { ...boa, adaptacao: { tipos: ['fonte_ampliada'] } })).toHaveLength(1)
    const { adaptacao: _adaptacao, ...semAdaptacao } = boa
    expect(adaptarAtividade.conferir?.(entrada, semAdaptacao)).toHaveLength(1)
  })

  it('pelo provedor, o gasto é da função de adaptação e a saída de um modelo que troca o gabarito duas vezes não é entregue', async () => {
    const entrada = entradaDeAdaptacao()
    const boa = adaptarAtividade.falso(entrada)
    const trocada = { ...boa, questoes: boa.questoes.map((questao) => ({ ...questao, gabarito: (questao.gabarito + 1) % 4 })) }
    const { ia, consumo } = provedorCom(new ScriptedAdapter([JSON.stringify(trocada), JSON.stringify(trocada)]))
    expect((await erroDe(ia.gerar({ tarefa: adaptarAtividade, entrada, escolaId: ESCOLA_A }))).codigoDeIa).toBe('IA_SAIDA_INVALIDA')
    expect(consumo.registros).toMatchObject([{ funcao: 'adaptacao', estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA', tentativas: 2 }])
    expect(consumo.registros[0]?.saida).toBeUndefined()
  })
})

describe('contexto da turma', () => {
  it('é série e disciplina, e mais nada', () => {
    expect(Object.keys(CONTEXTO_DE_QUIMICA).sort()).toEqual(['disciplina', 'serie'])
    expect(gerarAtividadeObjetiva.esquemaDeEntrada.safeParse({ ...entradaDeAtividade(), contexto: { ...CONTEXTO_DE_QUIMICA, turma: '2ºB' } }).success).toBe(false)
  })
})
