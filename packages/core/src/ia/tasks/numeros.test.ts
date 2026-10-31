import { conteudoDaMensagemDoAgenteSchema, conteudoDoResumoDoAnalistaSchema, HIPOTESES_DO_ANALISTA } from '@educa/shared'
import { describe, expect, it, vi } from 'vitest'
import { withEscolaContextOfRequest } from '../__fixtures__/escola-context.js'
import { ScriptedAdapter } from '../__fixtures__/scripted-adapter.js'
import { AMOSTRAS_DO_ASSISTENTE } from '../__fixtures__/assistente-samples.js'
import { AMOSTRAS_DA_REVISAO, SAIDAS_DA_REVISAO } from '../__fixtures__/assistente-review-samples.js'
import { entradaDoAnalista, entradaDoAssistente, entradaDoRelatorio, ESCOLA_A } from '../__fixtures__/inputs.js'
import { MATERIAL_DE_ESTEQUIOMETRIA } from '../__fixtures__/estequiometria.js'
import type { ModelAdapter } from '../adapter.js'
import { InMemoryConsumo, InMemoryOrcamento } from '../consumo.js'
import { LLMError } from '../errors.js'
import { PROMPT_PROPOR_FERRAMENTA } from '../prompts/propor-ferramenta.js'
import { LLMGateway } from '../llm-gateway.js'
import { InMemorySuspensoes } from '../suspensao.js'
import { atribuiNotaOuConceito, conversaPedeJulgamentoDeTextoDeAluno, conversaTrazTextoDeAluno, julgaTextoDeAluno, pedeJulgamentoDeTextoDeAluno, proporFerramenta, RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO, turnosQuePodemIrAoModelo } from './propor-ferramenta.js'
import { relatorioDaCorrecao } from './relatorio-da-correcao.js'
import { resumoDoAnalista } from './resumo-do-analista.js'

function provedorCom(adaptador: ModelAdapter): { ia: LLMGateway; consumo: InMemoryConsumo } {
  const consumo = new InMemoryConsumo()
  return { ia: withEscolaContextOfRequest(new LLMGateway({ adaptador, registro: consumo, orcamento: new InMemoryOrcamento(consumo), suspensao: new InMemorySuspensoes() })), consumo }
}

describe('propor_ferramenta: o Assistente pergunta antes de abrir a ferramenta (D18)', () => {
  const proposta = (mensagem: string) => proporFerramenta.falso(entradaDoAssistente(mensagem))

  it('pedido que corresponde a uma ferramenta vira proposta com o que deu para entender, e nada é gerado', () => {
    expect(proposta('monta uma atividade com 5 questões sobre reagente limitante para o 2ºB')).toEqual({
      tipo: 'proposta_de_ferramenta',
      texto: 'Quer que eu abra a ferramenta de atividade objetiva com 5 questões sobre “reagente limitante”? Você ajusta antes de gerar.',
      proposta: { ferramenta: 'atividade_objetiva', parametros: { tema: 'reagente limitante', quantidade: 5 } },
    })
    expect(proposta('preciso de um plano de aula de 50 minutos sobre mol e massa molar')).toMatchObject({
      tipo: 'proposta_de_ferramenta',
      proposta: { ferramenta: 'plano_de_aula', parametros: { tema: 'mol e massa molar' } },
    })
  })

  it('a saída cabe no conteúdo que a mensagem do agente guarda, depois que o Assistente acrescenta a turma e a disciplina', () => {
    const turmaId = '2f0e1d3c-4b5a-4c6d-8e7f-9a0b1c2d3e4f'
    const disciplinaId = '3a1f2e4d-5c6b-4d7e-9f80-a1b2c3d4e5f6'
    for (const mensagem of ['monta uma atividade com 5 questões sobre reagente limitante', 'plano de aula sobre mol', 'o que é rendimento teórico?', 'bom dia']) {
      const saida = proposta(mensagem)
      const conteudo = saida.tipo === 'texto' ? saida : { ...saida, proposta: { ...saida.proposta, parametros: { ...saida.proposta.parametros, turmaId, disciplinaId } } }
      expect(conteudoDaMensagemDoAgenteSchema.safeParse(conteudo).success, mensagem).toBe(true)
    }
  })

  it('sem quantidade no pedido, a proposta não inventa: o cartão abre só com o tema', () => {
    const saida = proposta('faz uns exercícios sobre rendimento')
    expect(saida).toMatchObject({ proposta: { ferramenta: 'atividade_objetiva', parametros: { tema: 'rendimento' } } })
    expect(saida.tipo === 'proposta_de_ferramenta' && 'quantidade' in saida.proposta.parametros).toBe(false)
  })

  it('pedido de adaptação que descreve um aluno vira texto que aponta a ferramenta: o que foi dito sobre o aluno não aparece em lugar nenhum da saída', () => {
    const saida = proposta('quero adaptar a atividade com fonte ampliada e mais tempo para o Enzo, que tem baixa visão')
    expect(saida.tipo).toBe('texto')
    expect(saida.texto).toContain('pede só o tipo de adaptação, sem nenhuma informação sobre o aluno')
    expect(JSON.stringify(saida)).not.toMatch(/Enzo|baixa visão/)
  })

  it('a proposta só existe para as ferramentas que geram a partir de um tema, e não tem campo para texto sobre aluno', () => {
    const base = { tipo: 'proposta_de_ferramenta', texto: 'Quer abrir?' }
    expect(proporFerramenta.esquemaDeSaida.safeParse({ ...base, proposta: { ferramenta: 'adaptacao', parametros: { tema: 'x' } } }).success).toBe(false)
    expect(proporFerramenta.esquemaDeSaida.safeParse({ ...base, proposta: { ferramenta: 'prova_discursiva', parametros: { tema: 'x' } } }).success).toBe(false)
    expect(proporFerramenta.esquemaDeSaida.safeParse({ ...base, proposta: { ferramenta: 'atividade_objetiva', parametros: { tema: 'x', observacao: 'aluno com baixa visão' } } }).success).toBe(false)
    expect(proporFerramenta.esquemaDeSaida.safeParse({ ...base, proposta: { ferramenta: 'atividade_objetiva', parametros: { tema: 'x' } } }).success).toBe(true)
  })

  it('o que não é pedido de ferramenta vira texto, com a página do material citada quando a resposta vem dele', () => {
    const saida = proposta('o que é rendimento teórico?')
    expect(saida).toMatchObject({ tipo: 'texto', citacoes: [{ materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina: 6 }] })
    expect(saida.texto).toContain('página 6')
    expect(proporFerramenta.falso({ ...entradaDoAssistente('bom dia'), trechos: [] })).toMatchObject({ tipo: 'texto', citacoes: [] })
  })

  it('texto do modelo citando página que não veio nos trechos é recusado', () => {
    const entrada = entradaDoAssistente('o que é mol?')
    const problemas = proporFerramenta.conferir?.(entrada, { tipo: 'texto', texto: 'Está na página 1.', citacoes: [{ materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina: 1, trecho: 'O mol é…' }] })
    expect(problemas).toHaveLength(1)
  })

  describe('"só conversar": quem recusou a ferramenta recebe texto, nunca a mesma pergunta de novo', () => {
    const PEDIDOS_DE_FERRAMENTA = [
      'monta uma atividade com 5 questões sobre reagente limitante',
      'quero um plano de aula sobre rendimento',
      'faz uma lista de exercícios de estequiometria',
      'prepara um simulado com 10 questões',
      'adapta a atividade para um aluno com baixa visão',
      'o que é rendimento teórico?',
      'bom dia',
    ]
    const soConversar = (pedido: string, mensagem = 'Só conversar') => ({ ...entradaDoAssistente(mensagem), semProposta: true, turnosAnteriores: [{ autor: 'professor' as const, texto: pedido }, { autor: 'assistente' as const, texto: 'Quer que eu abra a ferramenta?' }] })

    it('com a marca, a tarefa nunca devolve proposta, qualquer que seja o pedido, com ou sem turno anterior, com ou sem material', () => {
      for (const pedido of PEDIDOS_DE_FERRAMENTA) {
        // Sem a marca, os quatro primeiros viram proposta: é a marca que muda a saída.
        for (const entrada of [soConversar(pedido), { ...soConversar(pedido), trechos: [] }, { ...entradaDoAssistente(pedido), semProposta: true }]) {
          const saida = proporFerramenta.falso(entrada)
          expect(saida.tipo, pedido).toBe('texto')
          expect(proporFerramenta.esquemaDeSaida.safeParse(saida).success).toBe(true)
          expect(proporFerramenta.conferir?.(entrada, saida)).toEqual([])
        }
      }
      expect(PEDIDOS_DE_FERRAMENTA.slice(0, 4).map((pedido) => proposta(pedido).tipo)).toEqual(Array.from({ length: 4 }, () => 'proposta_de_ferramenta'))
    })

    it('responde ao último pedido do professor, e não à fala "só conversar", citando a página do material', () => {
      const saida = proporFerramenta.falso(soConversar('monta uma atividade sobre rendimento teórico'))
      expect(saida).toMatchObject({ tipo: 'texto', citacoes: [{ materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina: 6 }] })
      expect(saida.texto).toContain('página 6')
      // Sem material sobre o pedido, o texto diz isso, e não inventa citação.
      expect(proporFerramenta.falso({ ...soConversar('monta uma atividade sobre rendimento teórico'), trechos: [] })).toMatchObject({ tipo: 'texto', citacoes: [] })
      // O que foi dito sobre um aluno no pedido não volta na resposta.
      expect(JSON.stringify(proporFerramenta.falso(soConversar('adapta a atividade para a Mariana, que tem dislexia')))).not.toMatch(/Mariana|dislexia/u)
    })

    it('a proposta que o modelo devolver com a marca é saída inválida, e a instrução ao modelo muda', async () => {
      const entrada = soConversar('monta uma atividade sobre mol')
      const umaProposta = { tipo: 'proposta_de_ferramenta' as const, texto: 'Quer que eu abra a ferramenta?', proposta: { ferramenta: 'atividade_objetiva' as const, parametros: { tema: 'mol' } } }
      expect(proporFerramenta.conferir?.(entrada, umaProposta)).toHaveLength(1)
      expect(proporFerramenta.conferir?.({ ...entrada, semProposta: false }, umaProposta)).toEqual([])
      expect(proporFerramenta.conferir?.(entradaDoAssistente('monta uma atividade sobre mol'), umaProposta)).toEqual([])
      expect(proporFerramenta.montarPedido(entrada).instrucao).toContain('só conversar')
      expect(proporFerramenta.montarPedido(entradaDoAssistente()).instrucao).not.toContain('só conversar')
      // O modelo que insiste na proposta duas vezes não entrega nada; o que corrige na repetição entrega o texto.
      const insistente = new ScriptedAdapter([JSON.stringify(umaProposta), JSON.stringify(umaProposta)])
      const erro: unknown = await provedorCom(insistente).ia.gerar({ tarefa: proporFerramenta, entrada, escolaId: ESCOLA_A }).catch((motivo: unknown) => motivo)
      expect((erro as LLMError).codigoDeIa).toBe('IA_SAIDA_INVALIDA')
      expect(insistente.correcoes[1]?.problemas.join(' ')).toContain('só conversar')
      const emTexto = { tipo: 'texto', texto: 'O mol é a unidade de quantidade de matéria.', citacoes: [] }
      const { saida } = await provedorCom(new ScriptedAdapter([JSON.stringify(umaProposta), JSON.stringify(emTexto)])).ia.gerar({ tarefa: proporFerramenta, entrada, escolaId: ESCOLA_A })
      expect(saida).toEqual(emTexto)
    })

    it('a marca é booleana e a entrada continua estrita', () => {
      expect(proporFerramenta.esquemaDeEntrada.safeParse(soConversar('x')).success).toBe(true)
      expect(proporFerramenta.esquemaDeEntrada.safeParse({ ...entradaDoAssistente(), semProposta: 'sim' }).success).toBe(false)
      expect(proporFerramenta.esquemaDeEntrada.safeParse({ ...entradaDoAssistente(), resposta: 'so_conversar' }).success).toBe(false)
    })
  })
})

describe('propor_ferramenta e a D55: a IA não julga texto de aluno nem dá nota (regra 70, item 2a)', () => {
  /** A regra é fixa: sobre as amostras de hoje, acerta todas. O ensaio com o modelo local declara a dele sobre o mesmo arquivo. */
  const TAXA_MINIMA = 1
  const AMOSTRAS_MINIMAS = 50
  const recusas = AMOSTRAS_DO_ASSISTENTE.filter((amostra) => amostra.espera === 'recusa')
  const legitimos = AMOSTRAS_DO_ASSISTENTE.filter((amostra) => amostra.espera === 'legitimo')

  it('a regra acerta a taxa declarada sobre as amostras fixas, nos dois sentidos, e o teste diz quais errou', () => {
    expect(AMOSTRAS_DO_ASSISTENTE.length).toBeGreaterThanOrEqual(AMOSTRAS_MINIMAS)
    expect(recusas.length).toBeGreaterThanOrEqual(30)
    expect(legitimos.length).toBeGreaterThanOrEqual(20)
    const erradas = AMOSTRAS_DO_ASSISTENTE.filter((amostra) => pedeJulgamentoDeTextoDeAluno(amostra.frase) !== (amostra.espera === 'recusa')).map((amostra) => `${amostra.espera}: ${amostra.frase.slice(0, 90)}`)
    expect(erradas).toEqual(erradas.slice(0, Math.floor(AMOSTRAS_DO_ASSISTENTE.length * (1 - TAXA_MINIMA))))
  })

  it('as frases que o revisor trouxe são recusadas, e os pedidos legítimos dele passam', () => {
    for (const frase of ['dá uma olhada nesse texto do aluno', 'que nota você daria', 'avalia essa resposta', 'corrige essa resposta do aluno', 'o que você acha dessa redação?', 'analise a redação abaixo', 'que conceito merece esse texto?']) {
      expect(pedeJulgamentoDeTextoDeAluno(frase), frase).toBe(true)
    }
    for (const frase of ['corrige a atividade que eu gerei', 'avalia se essa questão está boa', 'melhora o enunciado da questão 3', 'monta uma rubrica de redação', 'cria critérios para a discursiva']) {
      expect(pedeJulgamentoDeTextoDeAluno(frase), frase).toBe(false)
    }
  })

  it('a mensagem recusada pela regra não sai para o modelo: o adaptador não é chamado em nenhuma das amostras de recusa, e a resposta é a fixa', async () => {
    for (const { frase } of recusas) {
      const adaptador = new ScriptedAdapter([])
      const { ia, consumo } = provedorCom(adaptador)
      const { saida, medicao } = await ia.gerar({ tarefa: proporFerramenta, entrada: entradaDoAssistente(frase), escolaId: ESCOLA_A })
      expect(adaptador.chamadas, frase).toBe(0)
      expect(saida).toEqual({ tipo: 'texto', texto: RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO, citacoes: [] })
      expect(medicao).toMatchObject({ origem: 'regra_fixa', envioExterno: false, tokensDeEntrada: 0, tokensDeSaida: 0 })
      // Nem o consumo guarda a mensagem: a tarefa leva texto livre de pessoa.
      expect(JSON.stringify(consumo.registros)).not.toContain('tecnologia')
    }
    // A recusa não repete o texto do aluno, e não traz número nenhum.
    expect(RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO).not.toMatch(/\d/u)
    expect(atribuiNotaOuConceito(RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO)).toBe(false)
  })

  it('em "só conversar", a regra olha também para o último pedido, que é o que a resposta atende', () => {
    const soConversar = (pedido: string) => ({ ...entradaDoAssistente('Só conversar'), semProposta: true, turnosAnteriores: [{ autor: 'professor' as const, texto: pedido }] })
    expect(proporFerramenta.semModelo?.(soConversar('corrige esta redação do aluno'))).toMatchObject({ tipo: 'texto', texto: RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO })
    expect(proporFerramenta.semModelo?.(soConversar('monta uma atividade sobre mol'))).toBeUndefined()
    expect(proporFerramenta.semModelo?.({ ...soConversar('corrige esta redação do aluno'), semProposta: false })).toBeUndefined()
    expect(proporFerramenta.semModelo?.(entradaDoAssistente('monta uma atividade de estequiometria'))).toBeUndefined()
  })

  it('a tarefa declara que pode levar texto de aluno: o que a regra não reconhece segue para o modelo', () => {
    // O resíduo, dito com franqueza: texto colado sem palavra de julgamento nem de nota não é pego pela regra.
    const semPalavraChave = 'Segue o que a turma escreveu. A tecnologia mudou muito a vida das pessoas, porque hoje todo mundo conversa pelo celular e antes não era assim.'
    expect(pedeJulgamentoDeTextoDeAluno(semPalavraChave)).toBe(false)
    expect(proporFerramenta.levaTextoDeAluno).toBe(true)
    expect(proporFerramenta.levaTextoLivreDePessoa).toBe(true)
  })

  describe('a conferência da saída: nota, conceito ou pontuação na resposta nunca é entregue', () => {
    it.each([
      'Eu daria nota 7,5 para essa redação: a tese está clara, mas falta conclusão.',
      'Nota: 8',
      'Esse texto vale 6/10.',
      'Fica com 7 de 10, porque os argumentos são fracos.',
      'O texto merece conceito B.',
      'Conceito: A',
      'Conceito sugerido: muito bom.',
      'A resposta leva 3 pontos dos 5.',
      'Pontuação: 4 em 5.',
      'Eu daria um 6 para esse parágrafo.',
      'Acho que merece uma nota alta.',
    ])('recusa: %s', (texto) => {
      expect(atribuiNotaOuConceito(texto)).toBe(true)
      expect(proporFerramenta.conferir?.(entradaDoAssistente('o que é mol?'), { tipo: 'texto', texto, citacoes: [] })).toHaveLength(1)
    })

    it.each([
      'No material da turma, a página 6 diz: “O rendimento percentual é a razão entre a massa obtida e a massa teórica, multiplicada por 100.”',
      'A massa molar da água é 18 g/mol, e 1 mol tem 6,02 × 10²³ partículas.',
      'O conceito a ser trabalhado primeiro é o de mol; depois, o conceito de massa molar.',
      'Posso montar uma atividade com 10 questões sobre isso: é só pedir.',
      'Sugiro começar a aula de 50 minutos com 5 de 10 exercícios da lista.',
      'Monte as notas de aula a partir da página 3.',
    ])('aceita: %s', (texto) => {
      expect(atribuiNotaOuConceito(texto)).toBe(false)
    })

    it('o modelo que tenta dar nota duas vezes entrega a recusa, e o que corrige na repetição entrega a resposta sem nota', async () => {
      // O resíduo da regra: o texto do aluno veio colado sem palavra-chave, e o modelo resolveu avaliá-lo. Antes da 3.0 isto era
      // `IA_SAIDA_INVALIDA`; agora a última reprovação é da D55, e a reserva responde com a recusa fixa.
      const entrada = entradaDoAssistente('Segue o que a Bia escreveu. A tecnologia mudou muito a vida das pessoas e hoje todo mundo conversa pelo celular.')
      expect(proporFerramenta.semModelo?.(entrada)).toBeUndefined()
      const comNota = JSON.stringify({ tipo: 'texto', texto: 'O texto da Bia está razoável. Eu daria nota 6,5: falta desenvolver o argumento.', citacoes: [] })
      const insistente = new ScriptedAdapter([comNota, comNota])
      const { ia, consumo } = provedorCom(insistente)
      const { saida } = await ia.gerar({ tarefa: proporFerramenta, entrada, escolaId: ESCOLA_A })
      expect(saida).toEqual({ tipo: 'texto', texto: RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO, citacoes: [] })
      expect(insistente.chamadas).toBe(2)
      expect(insistente.correcoes[1]?.problemas.join(' ')).toContain('nota, conceito ou pontuação')
      expect(consumo.registros).toMatchObject([{ funcao: 'conversa_e_ferramentas', estado: 'concluida', tentativas: 2 }])
      expect(JSON.stringify(consumo.registros)).not.toMatch(/6,5|razoável|Bia/u)

      const semNota = { tipo: 'texto', texto: 'Eu não avalio texto de aluno: a correção é sua.', citacoes: [] }
      const { saida: corrigida } = await provedorCom(new ScriptedAdapter([comNota, JSON.stringify(semNota)])).ia.gerar({ tarefa: proporFerramenta, entrada, escolaId: ESCOLA_A })
      expect(corrigida).toEqual(semNota)
    })

    it('a proposta de ferramenta com nota no texto também é recusada', () => {
      const proposta = { tipo: 'proposta_de_ferramenta' as const, texto: 'A redação vale nota 8. Quer que eu abra a ferramenta?', proposta: { ferramenta: 'atividade_objetiva' as const, parametros: { tema: 'mol' } } }
      expect(proporFerramenta.conferir?.(entradaDoAssistente(), proposta)).toHaveLength(1)
    })
  })

  describe('o tema da proposta é o assunto, nunca o que foi dito sobre um aluno', () => {
    const tema = (mensagem: string) => {
      const saida = proporFerramenta.falso(entradaDoAssistente(mensagem))
      return saida.tipo === 'proposta_de_ferramenta' ? saida.proposta.parametros.tema : undefined
    }

    it('sem "sobre", o tema é o que vem depois do nome da ferramenta, e não a mensagem inteira', () => {
      expect(tema('monta uma atividade de estequiometria')).toBe('estequiometria')
      expect(tema('monta uma atividade de estequiometria com 5 questões')).toBe('estequiometria')
      expect(tema('faz uma lista de exercícios de reagente limitante para o 2º ano')).toBe('reagente limitante')
      expect(tema('preciso de um plano de aula de mol e massa molar')).toBe('mol e massa molar')
      expect(tema('quero uma prova objetiva de balanceamento, bem curta')).toBe('balanceamento')
    })

    it('o nome e a condição de um aluno não viram tema, com ou sem a palavra "adapta": sem assunto claro, o tema é a disciplina', () => {
      const proibido = /Mariana|dislexia|Enzo|TDAH|laudo|aluno/iu
      for (const mensagem of [
        'Monta uma atividade para a Mariana, que tem dislexia',
        'monta uma atividade de estequiometria para a Mariana, que tem dislexia',
        'faz uns exercícios pro Enzo que tem TDAH',
        'prepara uma prova sobre mol para o aluno com laudo de dislexia',
        'quero uma lista de exercícios do aluno Enzo',
        'monta uma atividade sobre dislexia do Enzo',
      ]) {
        const saida = proporFerramenta.falso(entradaDoAssistente(mensagem))
        expect(saida.tipo, mensagem).toBe('proposta_de_ferramenta')
        expect(JSON.stringify(saida), mensagem).not.toMatch(proibido)
      }
      expect(tema('Monta uma atividade para a Mariana, que tem dislexia')).toBe('Química')
      expect(tema('monta uma atividade de estequiometria para a Mariana, que tem dislexia')).toBe('estequiometria')
      expect(tema('prepara uma prova sobre mol para o aluno com laudo de dislexia')).toBe('mol')
    })
  })
})

describe('a D55 sobre as amostras escritas sem olhar para a regra (a revisão da conformidade)', () => {
  /** A taxa declarada sobre este arquivo, à parte da do primeiro: hoje, a regra acerta todas, nos dois sentidos. */
  const TAXA_MINIMA = 1
  const comoTurnos = (anteriores: readonly string[] = []) => anteriores.map((texto) => ({ autor: 'professor' as const, texto }))

  it('a regra, olhando a conversa, acerta a taxa declarada, e o teste diz quais errou', () => {
    expect(AMOSTRAS_DA_REVISAO.filter((amostra) => amostra.origem === 'professora' && amostra.espera === 'recusa').length).toBeGreaterThanOrEqual(30)
    const erradas = AMOSTRAS_DA_REVISAO.filter((amostra) => conversaPedeJulgamentoDeTextoDeAluno(amostra.frase, comoTurnos(amostra.anteriores)) !== (amostra.espera === 'recusa')).map(
      (amostra) => `${amostra.espera}: ${amostra.frase.slice(0, 90)}`,
    )
    expect(erradas).toEqual(erradas.slice(0, Math.floor(AMOSTRAS_DA_REVISAO.length * (1 - TAXA_MINIMA))))
  })

  it('a conferência da saída acerta as respostas da revisão: nota por número, por extenso ou por letra é recusada; número que não é nota passa', () => {
    const erradas = SAIDAS_DA_REVISAO.filter((saida) => atribuiNotaOuConceito(saida.texto) !== saida.atribuiNota).map((saida) => saida.texto)
    expect(erradas).toEqual([])
  })

  it('o turno anterior que a regra recusaria, e o texto colado, não vão ao modelo; o pedido comum vai', () => {
    const colado = 'Na minha opinião a internet ajudou muito as pessoas porque agora da para estudar de casa e falar com os amigos. Mas tambem tem coisas ruins como o cyberbullying e as fake news.'
    const turnos = [
      { autor: 'professor' as const, texto: 'monta uma atividade de mol' },
      { autor: 'assistente' as const, texto: 'Quer que eu abra a ferramenta?' },
      { autor: 'professor' as const, texto: 'corrige a redação do Lucas' },
      { autor: 'professor' as const, texto: colado },
    ]
    expect(turnosQuePodemIrAoModelo(turnos)).toEqual(turnos.slice(0, 2))
    const pedido = proporFerramenta.montarPedido({ ...entradaDoAssistente('monta uma atividade de rendimento'), turnosAnteriores: turnos })
    const enviado = JSON.stringify(pedido)
    expect(enviado).not.toMatch(/Lucas|cyberbullying/u)
    expect(enviado).toContain('monta uma atividade de mol')
    // E a mensagem curta depois do texto colado é recusada sem modelo.
    expect(proporFerramenta.semModelo?.({ ...entradaDoAssistente('e aí, ficou bom?'), turnosAnteriores: [{ autor: 'professor', texto: colado }] })).toMatchObject({ texto: RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO })
    expect(proporFerramenta.semModelo?.({ ...entradaDoAssistente('ficou bom, pode gerar'), turnosAnteriores: [{ autor: 'professor', texto: 'monta uma atividade de mol' }] })).toBeUndefined()
  })
})

describe('propor_ferramenta na tarefa 3.0: juízo sobre texto de aluno, na entrada e na saída (D55)', () => {
  const COLADO_LONGO =
    'A tecnologia mudou muito a vida das pessoas porque hoje todo mundo conversa pelo celular e antes não era assim, e por isso a escola precisa pensar em como usar isso a favor do ensino.'
  const TEXTO_DA_BIA = 'Segue o que a Bia escreveu. A tecnologia mudou muito a vida das pessoas e hoje todo mundo conversa pelo celular.'
  const EXECUCAO = '0d1e2f3a-4b5c-4d6e-8f70-a1b2c3d4e5f6'
  const doProfessor = (texto: string) => ({ autor: 'professor' as const, texto })
  const doAssistente = (texto: string) => ({ autor: 'assistente' as const, texto })
  const julga = (texto: string) => julgaTextoDeAluno(texto, true)
  /** Das frases que deviam ser barradas, as que passaram: a lista vazia é o que se espera. */
  const queEscapam = (frases: readonly string[]) => frases.filter((frase) => !julga(frase))
  /** Das frases que deviam passar, as que foram barradas: a lista vazia é o que se espera. */
  const queForamBarradas = (frases: readonly string[]) => frases.filter((frase) => julga(frase))

  describe('a saída: duas chaves, o juízo e o texto de aluno na conversa', () => {
    it('saída que julga texto concreto é barrada quando a conversa traz texto de aluno, e passa quando não traz', () => {
      const saidas = ['O parágrafo 2 do texto da turma está sem coesão.', 'A redação da turma ficou fraca e confusa.', 'O texto da Bia está no nível 3 da rubrica.']
      expect(queEscapam(saidas)).toEqual([])
      for (const saida of saidas) expect(julgaTextoDeAluno(saida, false), saida).toBe(false)
    })

    it('com texto de aluno na conversa, a saída que não julga nada passa: lote agrupado, correção cega, conferência de entrega', () => {
      expect(
        queForamBarradas([
          'Os textos da turma ficaram agrupados pelo tema escolhido.',
          'Escondi o nome de cada aluno e numerei os trabalhos de 1 a 12, para a correção cega.',
          'Faltam 3 entregas: A-03, A-07 e A-11 ainda não enviaram.',
          'Separei os trabalhos por turma e por data de entrega.',
        ]),
      ).toEqual([])
    })

    it('a resposta de conteúdo passa com a chave ligada, sem nenhuma palavra de organização, de rubrica ou de material', () => {
      const conteudo = [
        'A Revolução Francesa começou em 1789 com a queda da Bastilha.',
        'A Revolução Francesa mostrou que o poder pode mudar de mãos.',
        'A Lei de Lavoisier diz que, numa reação, a massa total se conserva.',
        'Mol é a quantidade de matéria que contém 6,02 × 10²³ entidades elementares.',
        'Rendimento teórico é a massa máxima de produto prevista pela estequiometria da reação.',
        'O mol é a unidade de quantidade de matéria no Sistema Internacional.',
        'O reagente limitante é aquele que acaba primeiro na reação.',
        'Fotossíntese ocorre nos cloroplastos das células vegetais.',
        'Um bom exemplo de reação exotérmica é a combustão.',
        'O resultado da reação é 58,5 g de cloreto de sódio.',
        'A definição de mol é a quantidade de matéria com 6,02 × 10²³ entidades.',
        'O cálculo da massa molar soma as massas atômicas de cada átomo.',
        'A ideia central da fotossíntese é converter luz em açúcar.',
        'Ele reage com o oxigênio e libera calor.',
        'Lavoisier usou uma balança de precisão nos experimentos.',
        'Darwin explicou a seleção natural em A Origem das Espécies.',
        'É claro que a massa se conserva.',
        'Ótimo! Aqui está a atividade de mol.',
        'A reação é rápida demais para ver a olho nu.',
        'A melhor forma de balancear é por tentativa.',
        'A resposta correta da questão 2 é a letra C.',
        'Está claro que a massa se conserva.',
        'É bom lembrar que a massa se conserva.',
        'É correto afirmar que o mol é a unidade.',
        'O resultado da reação é claro: 58,5 g de cloreto de sódio.',
        'Uma boa definição de mol é a quantidade de matéria com 6,02 × 10²³ entidades.',
        'Um bom cálculo da massa molar soma as massas atômicas de cada átomo.',
        'Uma boa ideia para lembrar a fotossíntese é converter luz em açúcar.',
        'Ele é um ácido forte e reage com metais.',
        'Lavoisier usou uma boa balança de precisão nos experimentos.',
        'A Revolução Francesa mostrou grande capacidade de mobilização popular.',
      ]
      expect(queForamBarradas(conteudo)).toEqual([])
      const conversas = [{ ...entradaDoAssistente('explica a Revolução Francesa') }, { ...entradaDoAssistente('e o mol?'), turnosAnteriores: [doProfessor(TEXTO_DA_BIA)] }, entradaDoAssistente(TEXTO_DA_BIA)]
      for (const entrada of conversas) for (const texto of conteudo) expect(proporFerramenta.conferir?.(entrada, { tipo: 'texto', texto, citacoes: [] }), `${entrada.mensagem} | ${texto}`).toEqual([])
    })

    it('"coesão é um critério" passa; "o parágrafo 2 está sem coesão" é barrado', () => {
      expect(julga('A coesão é um critério da rubrica de redação.')).toBe(false)
      expect(julga('O parágrafo 2 está sem coesão.')).toBe(true)
    })

    it('rubrica e critérios, em geral e antes da aplicação, passam mesmo com texto de aluno na conversa', () => {
      const porNivel = ['Critério 1 — Tese', 'Nível 1: o texto não apresenta tese.', 'Nível 2: o texto apresenta tese vaga.', 'Nível 3: o texto apresenta tese clara e argumentos que a sustentam.'].join('\n')
      const porCriterio = 'O critério de tese vale 2 pontos. O critério de coesão avalia os conectivos do texto. O critério de repertório pede uma citação. O critério de proposta exige agente e ação.'
      const tresCriterios = ['Critério 1: tese clara.', 'Critério 2: o texto cita um dado.', 'Critério 3: o texto vale 2 pontos.'].join('\n')
      expect(queForamBarradas([porNivel, porCriterio, tresCriterios])).toEqual([])
      expect(julga('Critério 3: o texto vale 2 pontos.')).toBe(true)
      expect(
        queForamBarradas([
          'Se o texto não tiver tese, o nível é 1.',
          'O texto deve apresentar tese clara e conclusão.',
          'Textos que citam dados ganham o nível 3.',
          'Textos que apresentam tese clara ganham 2 pontos.',
          'Espera-se que o texto seja claro.',
          'Critérios para o texto dissertativo, antes da aplicação.',
          'Na rubrica da turma, o texto fica no nível 2 quando não tem tese.',
          'Espera-se que o texto tenha tese.',
          'No critério de clareza, o texto da turma precisa ser claro.',
        ]),
      ).toEqual([])
      // O mesmo descritor, solto, sem a rubrica em volta, é o texto de alguém.
      expect(julga('Nível 3: o texto apresenta tese clara e argumentos que a sustentam.')).toBe(true)
    })

    it('cada jeito de julgar o texto é barrado: bom ou fraco, parabéns, erro, não fecha, sem, correta, ignorou, exibe, melhor que, mais completo, imperativo, sugestão, versão melhorada', () => {
      expect(
        queEscapam([
          'O texto da turma ficou superficial.',
          'Parabéns à turma pelo texto.',
          'Há uma falha na redação da turma.',
          'A conclusão não fecha com o resto do texto da turma.',
          'O texto da turma ficou sem conectivos.',
          'A resposta da turma está correta.',
          'O texto da turma ignorou o contexto.',
          'O texto da turma exibe maturidade.',
          'O primeiro texto da turma é melhor que o segundo.',
          'O texto da turma é mais completo.',
          'Reescreva a introdução do texto da turma.',
          'Seria interessante trocar a ordem dos parágrafos do texto da turma.',
          'A versão melhorada do texto da turma segue abaixo.',
          'A Bia ficou superficial na turma.',
          'O texto da turma foge do tema.',
        ]),
      ).toEqual([])
    })

    it('cada jeito de afirmar o nível da rubrica para um texto é barrado', () => {
      expect(
        queEscapam([
          'O texto da turma fica no nível 3.',
          'Eu coloco o texto da turma no nível 2.',
          'O texto da turma atende ao esperado.',
          'O texto da turma demonstrou plenamente o conceito.',
          'O objetivo foi parcialmente atingido no texto da turma.',
          'No texto da turma, o critério de coesão está em dois pontos.',
        ]),
      ).toEqual([])
    })

    it('o juízo dito sem apontar o texto, com a conversa trazendo texto de aluno, é barrado', () => {
      expect(
        queEscapam([
          'Pontos fortes da turma neste lote.',
          'Segue o ranking do lote.',
          'A turma errou a questão 4.',
          'A versão aprimorada da frase da turma é: “o celular muda a rotina”.',
          'Faltou coesão na entrega da turma.',
          'Na verdade, o gabarito da turma é outro.',
          'A coesão da turma está em nível avançado.',
          'Pontos a corrigir no lote.',
          'O segundo trecho precisa de crase.',
          'Há falta de parágrafo de introdução na redação.',
        ]),
      ).toEqual([])
    })

    it('o excesso, o aquém do esperado, o superlativo de uma parte do texto e a sugestão com "pode" ou "precisa" são juízo, e a frase tem de falar do texto', () => {
      expect(
        queEscapam([
          'O parágrafo de abertura está extenso demais.',
          'O trabalho da Lara ficou aquém do esperado para a série.',
          'Entre os três textos, o do Caio traz a melhor conclusão.',
          'Ele precisa reformular a tese do primeiro parágrafo.',
        ]),
      ).toEqual([])
    })

    it('o juízo sem sujeito, com o texto subentendido, é barrado; a conversa sem texto de aluno e a resposta de conteúdo não são tocadas', () => {
      const frases = ['É confuso e pouco convincente.', 'É muito bom.', 'Muito bom, parabéns!', 'Parabéns pelo esforço!', 'É um bom começo.', 'Em geral, está confuso e vago.', 'Está confuso e pouco convincente no geral.', 'Ficou excelente, está muito claro e convincente.', 'Está bem claro e coeso.', 'Muito bom! Está claro, bem construído e convincente.', 'Está ótimo, só poderia ser um pouco mais curto no fim.', 'Gostei.', 'Bom trabalho!']
      const entrada = entradaDoAssistente(TEXTO_DA_BIA)
      for (const texto of frases) {
        expect(proporFerramenta.conferir?.(entrada, { tipo: 'texto', texto, citacoes: [] }), texto).not.toEqual([])
        expect(proporFerramenta.conferir?.(entradaDoAssistente('explica a Revolução Francesa'), { tipo: 'texto', texto, citacoes: [] }), texto).toEqual([])
      }
      expect(queEscapam(['Parabéns!', 'Muito bom!'])).toEqual([])
    })

    it('rubrica sob medida para o texto colado é barrada, por qualquer um dos três jeitos ou nomeando de quem é o texto; para o gênero, passa', () => {
      expect(queEscapam(['Segue o critério para essa redação.', 'Montei a rubrica com base na redação da turma.', 'A rubrica acompanha o que ela escreveu.', 'Critérios para o texto da Bia.'])).toEqual([])
      expect(julga('Critérios para o texto dissertativo-argumentativo.')).toBe(false)
    })

    it('a frase dirigida ao professor passa, mesmo falando do que o aluno entendeu: imperativo, você, vc, posso, podemos, vamos, vou, sugiro, recomendo, se quiser', () => {
      expect(
        queForamBarradas([
          'Escolha o aluno que entendeu o capítulo para apresentar.',
          'Vc pode chamar o aluno que dominou o capítulo.',
          'Você pode chamar o aluno que dominou o capítulo.',
          'Posso chamar o aluno que dominou o capítulo depois.',
          'Podemos chamar o aluno que dominou o capítulo depois.',
          'Vamos chamar o aluno que dominou o capítulo depois.',
          'Vou chamar o aluno que dominou o capítulo depois.',
          'Sugiro chamar o aluno que dominou o capítulo.',
          'Recomendo chamar o aluno que dominou o capítulo.',
          'Falamos do aluno que dominou o capítulo, se quiser.',
        ]),
      ).toEqual([])
    })

    it('o desempenho de quem escreveu, dito com verbo, é barrado; a menção sem juízo e a que fala do critério passam', () => {
      expect(queEscapam(['O aluno entendeu o capítulo do livro.', 'Ele precisa praticar bastante mais.', 'Bia demonstrou domínio pleno.', 'A Bia precisa estudar mais o capítulo.', 'A Bia entendeu o tema.', 'Caio dominou o conteúdo.'])).toEqual([])
      expect(
        queForamBarradas([
          'A Bia leu o capítulo do livro.',
          'O trabalho segue o critério combinado.',
          'Ele ainda não enviou a atividade.',
          'Ele segue o critério combinado ontem.',
          'Ele gostou do capítulo do livro.',
          'Tudo certo, pode seguir.',
          'O critério do capítulo vale quando o aluno aprendeu a regra.',
          'Ela abriu o capítulo do livro às oito.',
        ]),
      ).toEqual([])
      expect(julga('Eu não avalio se o aluno entendeu o texto: a correção é sua.')).toBe(false)
    })
  })

  describe('a chave: a conversa traz texto de aluno', () => {
    it('cada marca da mensagem, sozinha, liga a chave: texto colado, de aluno, pessoa pelo nome, pessoa que fez, texto apontado', () => {
      const marcas = { colado: COLADO_LONGO, deAluno: 'olha as respostas dos alunos', pessoaDonaDoTexto: 'confere o texto da Ana', pessoaQueFez: 'Bianca usou bem os conectivos?', apontado: 'como ficou esse resumo?', queAPessoaEscreveu: 'o que a Bia escreveu?', parteDeTextoPelaPalavra: 'Bia errou o parágrafo 2?' }
      for (const [marca, mensagem] of Object.entries(marcas)) expect(conversaTrazTextoDeAluno(mensagem, []), marca).toBe(true)
    })

    it('redação ou discursiva, sozinhas, e um nome com maiúscula, sozinho, não ligam a chave: nomear o gênero ou o assunto não põe texto na conversa', () => {
      for (const mensagem of ['rubrica pra redação do 9º ano', 'cria critérios para a discursiva', 'monta uma atividade sobre mol', 'explica a Revolução Francesa', 'monta uma atividade para a Ana', 'fala do Sistema Internacional', 'o que o Napoleão fez?', 'o que a Química escreveu?', 'Lavoisier usou uma balança, monta uma atividade', 'Darwin escreveu A Origem das Espécies?']) {
        expect(conversaTrazTextoDeAluno(mensagem, []), mensagem).toBe(false)
      }
    })

    it('o texto de aluno num turno anterior do professor conta; o do assistente e o turno comum, não', () => {
      expect(conversaTrazTextoDeAluno('e agora?', [doProfessor(TEXTO_DA_BIA)])).toBe(true)
      expect(conversaTrazTextoDeAluno('e agora?', [doAssistente(TEXTO_DA_BIA)])).toBe(false)
      expect(conversaTrazTextoDeAluno('e agora?', [doProfessor('monta uma atividade de mol')])).toBe(false)
    })

    it('"esse tipo de texto" aponta para o que o professor trouxe antes: com turno dele liga a chave; sem turno dele, não', () => {
      const pedido = 'cria uma rubrica para esse tipo de texto'
      expect(conversaTrazTextoDeAluno(pedido, [doProfessor('monta uma atividade de mol')])).toBe(true)
      expect(conversaTrazTextoDeAluno(pedido, [])).toBe(false)
      expect(conversaTrazTextoDeAluno(pedido, [doAssistente('Quer que eu abra a ferramenta?')])).toBe(false)
    })
  })

  describe('a entrada: as formas de pedir que escapavam', () => {
    const colado = [doProfessor(COLADO_LONGO)]

    it('nota pedida pelo verbo de dar ou pelo número é recusada; "quanto tempo devo dar" é outro assunto', () => {
      for (const frase of ['quanto eu devo dar pra essa resposta', 'que número você colocaria?']) expect(pedeJulgamentoDeTextoDeAluno(frase), frase).toBe(true)
      expect(pedeJulgamentoDeTextoDeAluno('quanto tempo devo dar para a prova?')).toBe(false)
      expect(pedeJulgamentoDeTextoDeAluno('quanto de tempo devo dar para a prova?')).toBe(false)
    })

    it('uma pessoa pelo nome que faz o que o aluno faz, no começo da frase, é texto de aluno: "Bianca usou bem os conectivos?"', () => {
      expect(pedeJulgamentoDeTextoDeAluno('Bianca usou bem os conectivos?')).toBe(true)
      expect(pedeJulgamentoDeTextoDeAluno('Química usou bem os conectivos?')).toBe(false)
      expect(pedeJulgamentoDeTextoDeAluno('Davi não acertou a 3?')).toBe(true)
      for (const pedido of ['Ninguém entendeu estequiometria, monta uma lista de revisão', 'Quem errou a questão 3?', 'Alguém acertou a 5?', 'Metade errou o balanceamento, monta uma lista de revisão', 'Todo mundo errou a questão 3, monta uma lista de revisão', 'Quase ninguém entendeu estequiometria, monta uma lista de revisão', 'Muita gente errou o balanceamento, monta uma lista de revisão', 'Mais da metade errou a 4, monta uma lista']) {
        expect(pedeJulgamentoDeTextoDeAluno(pedido), pedido).toBe(false)
      }
    })

    it('rubrica ou critérios pedidos depois de um texto colado são pré-correção; sem texto antes, passam', () => {
      for (const pedido of ['monta uma rubrica pra esse tipo de texto', 'cria critérios antes de eu aplicar', 'elabora uma rubrica de redação']) {
        expect(conversaPedeJulgamentoDeTextoDeAluno(pedido, colado), pedido).toBe(true)
        expect(conversaPedeJulgamentoDeTextoDeAluno(pedido, []), pedido).toBe(false)
      }
      expect(conversaPedeJulgamentoDeTextoDeAluno('cria uma rubrica de redação', [doProfessor('monta uma atividade de mol')])).toBe(false)
    })

    it('mexer no que veio antes, com a referência a ele, é mexer no texto do aluno; no enunciado ou no que é do professor, não', () => {
      for (const pedido of ['deixa isso mais curto', 'torna isso mais simples', 'enxuga esse trecho', 'resume esse texto', 'reescreve ele']) {
        expect(conversaPedeJulgamentoDeTextoDeAluno(pedido, colado), pedido).toBe(true)
        expect(conversaPedeJulgamentoDeTextoDeAluno(pedido, []), pedido).toBe(false)
      }
      const doMaterial = ['deixa o enunciado da questão 1 mais curto', 'resume esse trecho do enunciado', 'resume esse texto que eu escrevi', 'deixa a aula mais curta']
      const demonstrativoDeMaterial = ['simplifica esse plano', 'torna essa atividade mais simples', 'resume esse capítulo', 'deixa essa questão mais curta']
      for (const pedido of [...doMaterial, ...demonstrativoDeMaterial]) expect(conversaPedeJulgamentoDeTextoDeAluno(pedido, colado), pedido).toBe(false)
    })
  })

  describe('a conferência e a reserva', () => {
    const juizo = JSON.stringify({ tipo: 'texto', texto: 'O texto da Bia está confuso e fraco, sem coesão.', citacoes: [] })
    const citacaoInvalida = JSON.stringify({ tipo: 'texto', texto: 'Está na página 1.', citacoes: [{ materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina: 1, trecho: 'O mol é…' }] })
    const recusa = { tipo: 'texto' as const, texto: RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO, citacoes: [] }
    const comLog = (roteiro: readonly string[]) => {
      const consumo = new InMemoryConsumo()
      const logger = { info: vi.fn(), warn: vi.fn() }
      const adaptador = new ScriptedAdapter(roteiro)
      const ia = withEscolaContextOfRequest(new LLMGateway({ adaptador, registro: consumo, orcamento: new InMemoryOrcamento(consumo), suspensao: new InMemorySuspensoes(), logger }))
      return { ia, consumo, logger, adaptador }
    }

    it('a conferência confere os dois tipos de saída: o texto e a proposta de ferramenta', () => {
      const entrada = entradaDoAssistente(TEXTO_DA_BIA)
      const julgando = 'O texto da Bia está confuso e fraco.'
      expect(proporFerramenta.conferir?.(entrada, { tipo: 'texto', texto: julgando, citacoes: [] })).toHaveLength(1)
      expect(proporFerramenta.conferir?.(entrada, { tipo: 'proposta_de_ferramenta', texto: `${julgando} Quer que eu abra a ferramenta?`, proposta: { ferramenta: 'atividade_objetiva', parametros: { tema: 'mol' } } })).toHaveLength(1)
      // O texto de aluno pode ter vindo num turno anterior, e a mensagem de agora ser curta.
      expect(proporFerramenta.conferir?.({ ...entradaDoAssistente('e agora?'), turnosAnteriores: [doProfessor(TEXTO_DA_BIA)] }, { tipo: 'texto', texto: julgando, citacoes: [] })).toHaveLength(1)
      // Sem texto de aluno na conversa, a mesma frase passa.
      expect(proporFerramenta.conferir?.(entradaDoAssistente('o que é mol?'), { tipo: 'texto', texto: julgando, citacoes: [] })).toEqual([])
    })

    it('as saídas do próprio Assistente (proposta, resposta com a página, adaptação, só conversar) passam, mesmo com texto de aluno na conversa', () => {
      const comTexto = { turnosAnteriores: [doProfessor(TEXTO_DA_BIA)] }
      const pedidos = ['monta uma atividade com 5 questões sobre reagente limitante', 'preciso de um plano de aula sobre mol', 'o que é rendimento teórico?', 'bom dia', 'quero adaptar a atividade com fonte ampliada']
      for (const pedido of pedidos) {
        for (const semProposta of [false, true]) {
          const entrada = { ...entradaDoAssistente(pedido), ...comTexto, ...(semProposta ? { semProposta } : {}) }
          const saida = proporFerramenta.falso(entrada)
          expect(proporFerramenta.conferir?.(entrada, saida), `${pedido} (${String(semProposta)})`).toEqual([])
        }
      }
    })

    it('duas saídas julgadoras entregam a recusa, com duas chamadas; o consumo e o log não levam o texto nem a saída', async () => {
      const entrada = entradaDoAssistente(TEXTO_DA_BIA)
      expect(proporFerramenta.semModelo?.(entrada)).toBeUndefined()
      const { ia, consumo, logger, adaptador } = comLog([juizo, juizo])
      const { saida } = await ia.gerar({ tarefa: proporFerramenta, entrada, escolaId: ESCOLA_A, execucaoId: EXECUCAO })
      expect(saida).toEqual(recusa)
      expect(adaptador.chamadas).toBe(2)
      expect(adaptador.correcoes[1]?.problemas.join(' ')).toContain('julga texto de aluno')
      expect(consumo.registros).toMatchObject([{ funcao: 'conversa_e_ferramentas', estado: 'concluida', tentativas: 2 }])
      expect(JSON.stringify(consumo.registros)).not.toMatch(/Bia|confuso|coes/u)
      // Duas linhas, só com id e contagem: a da reserva e a da conclusão. Nenhuma leva o texto, a saída ou a conversa.
      expect(logger.info.mock.calls).toEqual([
        [{ evento: 'ia.geracao.reserva', tipo: 'propor_ferramenta', escolaId: ESCOLA_A, execucaoId: EXECUCAO, tentativas: 2 }],
        [{ evento: 'ia.geracao.concluida', tipo: 'propor_ferramenta', escolaId: ESCOLA_A, execucaoId: EXECUCAO, duracaoMs: expect.any(Number) as number, tentativas: 2 }],
      ])
    })

    it('só a nota, duas vezes, entrega a recusa: a última reprovação é da D55 mesmo sem texto de aluno na conversa', async () => {
      const soNota = JSON.stringify({ tipo: 'texto', texto: 'Eu daria nota 7 para essa atividade.', citacoes: [] })
      const { ia, adaptador } = comLog([soNota, soNota])
      const { saida } = await ia.gerar({ tarefa: proporFerramenta, entrada: entradaDoAssistente('monta uma atividade sobre mol'), escolaId: ESCOLA_A })
      expect(saida).toEqual(recusa)
      expect(adaptador.chamadas).toBe(2)
      expect(adaptador.correcoes[1]?.problemas.join(' ')).toContain('nota, conceito ou pontuação')
      expect(adaptador.correcoes[1]?.problemas.join(' ')).not.toContain('julga texto de aluno')
    })

    it('a recusa passa nas duas conferências e no schema, em qualquer conversa com texto de aluno', () => {
      const conversas = [entradaDoAssistente(TEXTO_DA_BIA), entradaDoAssistente(COLADO_LONGO), { ...entradaDoAssistente('e agora?'), turnosAnteriores: [doProfessor(TEXTO_DA_BIA)] }]
      for (const entrada of conversas) {
        expect(proporFerramenta.conferir?.(entrada, recusa)).toEqual([])
      }
      expect(proporFerramenta.esquemaDeSaida.safeParse(recusa).success).toBe(true)
      expect(julga(RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO)).toBe(false)
    })

    it('JSON quebrado duas vezes segue sendo IA_SAIDA_INVALIDA, sem reserva', async () => {
      const { ia, logger } = comLog(['{quebrado', '{quebrado'])
      await expect(ia.gerar({ tarefa: proporFerramenta, entrada: entradaDoAssistente(TEXTO_DA_BIA), escolaId: ESCOLA_A })).rejects.toMatchObject({ codigoDeIa: 'IA_SAIDA_INVALIDA' })
      expect(logger.info).not.toHaveBeenCalled()
    })

    it('citação inválida duas vezes, sem texto de aluno, segue sendo IA_SAIDA_INVALIDA: a reserva é só da D55', async () => {
      const { ia } = comLog([citacaoInvalida, citacaoInvalida])
      await expect(ia.gerar({ tarefa: proporFerramenta, entrada: entradaDoAssistente('o que é mol?'), escolaId: ESCOLA_A })).rejects.toMatchObject({ codigoDeIa: 'IA_SAIDA_INVALIDA' })
    })

    it('só a última reprovação decide a reserva: juízo e depois citação inválida é falha; citação inválida e depois juízo é a recusa', async () => {
      const entrada = entradaDoAssistente(TEXTO_DA_BIA)
      await expect(comLog([juizo, citacaoInvalida]).ia.gerar({ tarefa: proporFerramenta, entrada, escolaId: ESCOLA_A })).rejects.toMatchObject({ codigoDeIa: 'IA_SAIDA_INVALIDA' })
      const { saida } = await comLog([citacaoInvalida, juizo]).ia.gerar({ tarefa: proporFerramenta, entrada, escolaId: ESCOLA_A })
      expect(saida).toEqual(recusa)
    })

    it('o prompt sobe a versão e proíbe o juízo de qualidade sobre texto de aluno, sem proibir a rubrica em geral nem o lote', () => {
      expect(PROMPT_PROPOR_FERRAMENTA.versao).toBe('2026-10-22.1')
      expect(PROMPT_PROPOR_FERRAMENTA.sistema).toContain('Nem juízo de qualidade você dá sobre texto de aluno')
      expect(PROMPT_PROPOR_FERRAMENTA.sistema).toContain('Rubrica e critérios você escreve em geral')
    })
  })
})

describe('relatorio_da_correcao: a conta é do domínio, a IA só põe em palavras', () => {
  it('usa os números como vieram: acertos, total, percentual, a errada mais marcada e os em branco', () => {
    const { questoes, visaoGeral } = relatorioDaCorrecao.falso(entradaDoRelatorio())
    expect(questoes.map((questao) => questao.numero)).toEqual([1, 2, 3])
    expect(questoes[0]?.texto).toContain('25 de 30 acertaram (83%). A correta é a D.')
    expect(questoes[1]?.texto).toContain('8 de 30 acertaram (27%). A correta é a C. A errada mais marcada foi a B, com 15 respostas. 2 ficaram em branco. Menos da metade acertou')
    expect(questoes[1]?.texto).toContain('Identificar o reagente limitante')
    expect(questoes[2]?.texto).toContain('30 de 30 acertaram (100%)')
    expect(questoes[2]?.texto).toContain('Todos acertaram.')
    expect(visaoGeral).toContain('30 alunos enviaram 3 questões')
    expect(visaoGeral).toContain('menos acertos foi a 2 (27%)')
    expect(visaoGeral).toContain('mais acertos, a 3 (100%)')
  })

  it('a entrada é a contagem da turma: resposta de um aluno, ou aluno identificado, não tem onde entrar', () => {
    const entrada = entradaDoRelatorio()
    const [primeira] = entrada.questoes
    expect(relatorioDaCorrecao.esquemaDeEntrada.safeParse({ ...entrada, respostas: [{ alunoId: 'x', alternativa: 2 }] }).success).toBe(false)
    expect(relatorioDaCorrecao.esquemaDeEntrada.safeParse({ ...entrada, questoes: [{ ...primeira, errou: ['Enzo Martins'] }] }).success).toBe(false)
  })

  it('a saída não tem campo de nota, e relatório que pula ou troca questão é recusado', () => {
    const entrada = entradaDoRelatorio()
    const bom = relatorioDaCorrecao.falso(entrada)
    expect(relatorioDaCorrecao.esquemaDeSaida.safeParse({ ...bom, nota: 7.5 }).success).toBe(false)
    expect(relatorioDaCorrecao.conferir?.(entrada, { ...bom, questoes: bom.questoes.slice(0, 2) })).toHaveLength(1)
    expect(relatorioDaCorrecao.conferir?.(entrada, { ...bom, questoes: [...bom.questoes].reverse() })).toHaveLength(1)
  })

  it('questão que ninguém respondeu não vira divisão por zero', () => {
    const entrada = { ...entradaDoRelatorio(), respondentes: 0, questoes: entradaDoRelatorio().questoes.map((questao) => ({ ...questao, marcacoes: [0, 0, 0, 0], emBranco: 0 })) }
    const saida = relatorioDaCorrecao.falso(entrada)
    expect(saida.questoes.map((questao) => questao.texto)).toEqual(['Ninguém respondeu a esta questão.', 'Ninguém respondeu a esta questão.', 'Ninguém respondeu a esta questão.'])
    expect(JSON.stringify(saida)).not.toContain('NaN')
  })
})

describe('resumo_do_analista: só agregado, em listas fechadas, sem texto do modelo', () => {
  const entrada = entradaDoAnalista()
  const bom = resumoDoAnalista.falso(entrada)

  it('a saída é exatamente o que `resumo_do_analista.conteudo` guarda: passa no schema do contrato de @educa/shared', () => {
    expect(resumoDoAnalista.esquemaDeSaida).toBe(conteudoDoResumoDoAnalistaSchema)
    expect(conteudoDoResumoDoAnalistaSchema.safeParse(bom).success).toBe(true)
    expect(resumoDoAnalista.conferir?.(entrada, bom)).toEqual([])
  })

  it('devolve os agregados como vieram e acrescenta só os alertas', () => {
    const { alertas, ...agregados } = bom
    const { limiarDeAcertoBaixoPercentual: _limiar, ...recebidos } = entrada
    expect(agregados).toEqual(recebidos)
    expect(alertas.length).toBeGreaterThan(0)
  })

  it('alerta só o que está abaixo do limiar recebido, do pior para o melhor, com o valor medido, a referência e hipóteses da lista fechada', () => {
    // 2ª série: 88/180 = 48,9% e 58/90 = 64,4%. 1ª série: 197/240 = 82,1% e 30/60 = 50%. Limiar: 60.
    expect(bom.alertas.map((alerta) => [alerta.tipo, alerta.serie.ano, alerta.habilidade?.codigo, alerta.valor, alerta.referencia])).toEqual([
      ['habilidade_com_acerto_baixo', 2, 'EM13CNT104', 48.9, 60],
      ['habilidade_com_acerto_baixo', 1, 'EM13CNT302', 50, 60],
    ])
    for (const alerta of bom.alertas) for (const hipotese of alerta.hipoteses) expect(HIPOTESES_DO_ANALISTA).toContain(hipotese)
    // Com um lote só no recorte, a hipótese é que o número ainda diz pouco; com mais, as duas que cabe conferir primeiro.
    expect(bom.alertas[0]?.hipoteses).toEqual(['conteudo_recente', 'questoes_acima_do_material'])
    expect(bom.alertas[1]?.hipoteses).toEqual(['poucas_atividades_no_tema'])
  })

  it('o limiar é de quem chama: mudando o limiar, muda o que é alerta', () => {
    expect(resumoDoAnalista.falso({ ...entrada, limiarDeAcertoBaixoPercentual: 40 }).alertas).toEqual([])
    expect(resumoDoAnalista.falso({ ...entrada, limiarDeAcertoBaixoPercentual: 70 }).alertas.map((alerta) => alerta.valor)).toEqual([48.9, 50, 64.4])
  })

  it('recorte com um professor só é nominal e nem entra com número (D45)', () => {
    const [primeiro, ...demais] = entrada.recortes
    expect(resumoDoAnalista.esquemaDeEntrada.safeParse({ ...entrada, recortes: [{ ...primeiro, professores: 1 }, ...demais] }).success).toBe(false)
    expect(resumoDoAnalista.esquemaDeEntrada.safeParse({ ...entrada, recortesNominais: [{ ...entrada.recortesNominais[0], acertoPercentual: 40 }] }).success).toBe(false)
  })

  it('não há pessoa na entrada: professor, turma nomeada e aluno não têm campo', () => {
    const [primeiro, ...demais] = entrada.recortes
    for (const extra of [{ professor: 'Camila Souza' }, { turma: '2ºB' }, { alunosEmRisco: ['Enzo Martins'] }, { professorId: '3a1f2e4d-5c6b-4d7e-9f80-a1b2c3d4e5f6' }]) {
      expect(resumoDoAnalista.esquemaDeEntrada.safeParse({ ...entrada, recortes: [{ ...primeiro, ...extra }, ...demais] }).success).toBe(false)
    }
  })

  it('a saída não tem onde levar texto do modelo: campo de texto, em qualquer lugar, é recusado pelo schema', () => {
    const [alerta] = bom.alertas
    if (alerta === undefined) throw new Error('o resumo de teste deveria ter alerta')
    const recusadas: unknown[] = [
      { ...bom, resumo: 'O resultado indica falha do professor da 2ª série.' },
      { ...bom, alertas: [{ ...alerta, hipotese: 'Os professores não retomaram o conteúdo.' }] },
      { ...bom, alertas: [{ ...alerta, contexto: 'Agregado de 180 respostas.' }] },
      { ...bom, alertas: [{ ...alerta, hipoteses: ['o professor faltou muito'] }] },
      { ...bom, alertas: [{ ...alerta, hipoteses: [] }] },
      { ...bom, alertas: [{ ...alerta, tipo: 'professor_com_turma_fraca' }] },
      { ...bom, recortes: bom.recortes.map((recorte) => ({ ...recorte, leitura: 'turma fraca' })) },
    ]
    for (const saida of recusadas) expect(resumoDoAnalista.esquemaDeSaida.safeParse(saida).success, JSON.stringify(saida).slice(0, 80)).toBe(false)
  })

  it('o único texto do alerta é o da entrada, campo por campo: o modelo não troca nome de disciplina nem descrição de habilidade', () => {
    const [alerta] = bom.alertas
    if (alerta === undefined || alerta.habilidade === null) throw new Error('o resumo de teste deveria ter alerta de habilidade')
    const com = (mudanca: Partial<typeof alerta>) => resumoDoAnalista.conferir?.(entrada, { ...bom, alertas: [{ ...alerta, ...mudanca }] }) ?? []
    expect(com({})).toEqual([])
    expect(com({ disciplina: { ...alerta.disciplina, nome: 'Química (culpa do professor da tarde)' } })).toHaveLength(1)
    expect(com({ habilidade: { ...alerta.habilidade, descricao: 'Os alunos do 2ºB não estudam' } })).toHaveLength(1)
    expect(com({ serie: { ...alerta.serie, ano: 3 } })).toHaveLength(1)
  })

  it('a conferência recusa número inventado, referência trocada, alerta acima do limiar, recorte que não veio, tipo sem dado e agregado alterado', () => {
    const [alerta] = bom.alertas
    if (alerta === undefined) throw new Error('o resumo de teste deveria ter alerta')
    const com = (mudanca: Partial<typeof alerta>) => resumoDoAnalista.conferir?.(entrada, { ...bom, alertas: [{ ...alerta, ...mudanca }] }) ?? []
    expect(com({ valor: 12 })).toHaveLength(1)
    expect(com({ referencia: 75 })).toHaveLength(1)
    expect(com({ serie: { ...alerta.serie, id: 'e5f6a7b8-c9d0-4e1f-8a3b-4c5d6e7f8091' } })).toHaveLength(1)
    expect(com({ tipo: 'habilidade_em_queda' })).toHaveLength(1)
    expect(com({ hipoteses: ['conteudo_recente', 'conteudo_recente'] })).toHaveLength(1)
    expect(resumoDoAnalista.conferir?.(entrada, { ...bom, alertas: [alerta, alerta] })).toHaveLength(1)
    // 58/90 = 64,4%, acima do limiar de 60: não é alerta.
    const acima = entrada.recortes[0]?.porHabilidade[1]
    if (acima === undefined) throw new Error('sem a segunda habilidade')
    expect(com({ habilidade: acima.habilidade, valor: 64.4 })).toHaveLength(1)
    expect(resumoDoAnalista.conferir?.(entrada, { ...bom, escola: { ...bom.escola, lotesAprovados: 99 } })).toHaveLength(1)
    expect(resumoDoAnalista.conferir?.(entrada, { ...bom, recortes: [...bom.recortes].reverse() })).toHaveLength(1)
  })

  it('o modelo que escreve texto no resumo duas vezes não tem nada entregue à coordenação', async () => {
    const comTexto = JSON.stringify({ ...bom, resumo: 'O resultado indica falha do professor da 2ª série.' })
    const adaptador = new ScriptedAdapter([comTexto, comTexto])
    const { ia, consumo } = provedorCom(adaptador)
    const erro: unknown = await ia.gerar({ tarefa: resumoDoAnalista, entrada, escolaId: ESCOLA_A }).catch((motivo: unknown) => motivo)
    expect(erro).toBeInstanceOf(LLMError)
    expect((erro as LLMError).codigoDeIa).toBe('IA_SAIDA_INVALIDA')
    expect(adaptador.correcoes[1]?.problemas.join(' ')).toContain('resumo')
    expect(consumo.registros).toMatchObject([{ funcao: 'resumo_e_alerta', estado: 'falhou' }])
  })
})
