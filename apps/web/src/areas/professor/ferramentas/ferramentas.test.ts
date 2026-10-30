import { InvariantException, adaptarArtefatoRequestSchema, gerarComFerramentaRequestSchema, FERRAMENTAS, ROTULOS_DA_ADAPTACAO, TIPOS_DE_ADAPTACAO } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { problemaDaDescricao, validarFormulario, valoresPadrao } from '../../../componentes/ui/ia/motor-formulario'
import { CATALOGO_DE_FERRAMENTAS, CATEGORIAS_DE_FERRAMENTA, catalogoPorCategoria, COMO_VAI_SAIR, descricaoDaFerramenta, ehFerramenta, ferramentaDoCatalogo, iniciaisDoPedido, montarPedido, TEMPOS_EXTRAS, type OpcoesDaDescricao } from './ferramentas'

const TURMA = '0190f5a0-0000-7000-8000-00000000002b'
const DISCIPLINA = '0190f5a0-0000-7000-8000-0000000000c1'
const ATIVIDADE = '0190f5a0-0000-7000-8000-0000000000a1'
const CHAVE = '0190f5a0-0000-7000-8000-0000000000e1'
const OPCOES: OpcoesDaDescricao = { turmas: [{ valor: `${TURMA}:${DISCIPLINA}`, rotulo: '2ºB · Química' }], atividades: [{ valor: ATIVIDADE, rotulo: 'Atividade de estequiometria · 2ºB' }] }

describe('o catálogo de ferramentas (D74)', () => {
  it('tem só as três ferramentas que existem, cada uma numa categoria da D74, e nenhuma outra', () => {
    expect(CATALOGO_DE_FERRAMENTAS.map((item) => item.ferramenta).sort()).toEqual([...FERRAMENTAS].sort())
    expect(catalogoPorCategoria().map((categoria) => [categoria.nome, categoria.ferramentas.map((item) => item.nome)])).toEqual([
      ['Planejar', ['Plano de aula']],
      ['Preparar a aula', ['Adaptação']],
      ['Avaliar', ['Atividade objetiva']],
    ])
    expect(ehFerramenta('adaptacao')).toBe(true)
    // As outras do desenho não existem, nem para o endereço digitado à mão.
    expect(['prova', 'simulado', 'redacao', 'mapa-mental', ''].map(ehFerramenta)).toEqual([false, false, false, false, false])
  })

  it('as categorias saem na ordem da D74 e só as que têm ferramenta: "Corrigir" existe na lista da D74 e não aparece, porque nenhuma ferramenta dela existe', () => {
    expect(CATEGORIAS_DE_FERRAMENTA.map((categoria) => categoria.id)).toEqual(['planejar', 'preparar', 'avaliar', 'corrigir'])
    expect(catalogoPorCategoria().map((categoria) => categoria.id)).toEqual(['planejar', 'preparar', 'avaliar'])
    // Nenhuma categoria sai vazia: o catálogo não desenha seção sem cartão.
    expect(catalogoPorCategoria().every((categoria) => categoria.ferramentas.length > 0)).toBe(true)
    // E cada ferramenta está só na categoria que declarou.
    expect(catalogoPorCategoria().flatMap((categoria) => categoria.ferramentas.map((item) => [categoria.id, item.categoria]))).toEqual([
      ['planejar', 'planejar'],
      ['preparar', 'preparar'],
      ['avaliar', 'avaliar'],
    ])
  })

  it('a função que assina cada ferramenta é a que a escola suspende: a Adaptação é da função de adaptação', () => {
    expect(Object.fromEntries(CATALOGO_DE_FERRAMENTAS.map((item) => [item.ferramenta, item.funcao]))).toEqual({
      atividade_objetiva: 'conversa_e_ferramentas',
      plano_de_aula: 'conversa_e_ferramentas',
      adaptacao: 'adaptacao',
    })
  })
})

describe('os campos de cada ferramenta: a ferramenta é dado (P23)', () => {
  it('toda descrição passa na conferência do motor, e os campos são os do contrato', () => {
    for (const ferramenta of FERRAMENTAS) expect(problemaDaDescricao(descricaoDaFerramenta(ferramenta, OPCOES))).toBeUndefined()
    expect(descricaoDaFerramenta('atividade_objetiva', OPCOES).campos.map((campo) => [campo.chave, campo.tipo])).toEqual([
      ['turma', 'selecao'],
      ['tema', 'texto'],
      ['quantidade', 'numero'],
    ])
    expect(descricaoDaFerramenta('plano_de_aula', OPCOES).campos.map((campo) => [campo.chave, campo.tipo])).toEqual([
      ['turma', 'selecao'],
      ['tema', 'texto'],
    ])
  })

  it('D35, D67: a Adaptação não tem campo de texto — só a atividade de origem, os tipos da lista fechada e o tempo extra', () => {
    const { campos } = descricaoDaFerramenta('adaptacao', OPCOES)
    // Quem acrescentar um campo de texto aqui quebra este teste: texto livre na Adaptação é texto sobre o aluno.
    expect(campos.map((campo) => [campo.chave, campo.tipo])).toEqual([
      ['origem', 'selecao'],
      ['tipos', 'multipla'],
      ['tempoExtra', 'selecao'],
    ])
    expect(campos.map((campo) => campo.tipo)).not.toContain('texto')
    const tipos = campos.find((campo) => campo.chave === 'tipos')
    expect(tipos?.tipo === 'multipla' ? tipos.opcoes : []).toEqual(TIPOS_DE_ADAPTACAO.map((tipo) => ({ valor: tipo, rotulo: ROTULOS_DA_ADAPTACAO[tipo] })))
    expect(tipos?.tipo === 'multipla' ? tipos.minimo : 0).toBe(1)
  })

  it('a turma única já vem escolhida, e o que o Assistente entendeu do pedido já vem preenchido', () => {
    const descricao = descricaoDaFerramenta('atividade_objetiva', { ...OPCOES, iniciais: { tema: 'Estequiometria', quantidade: 10 } })
    expect(valoresPadrao(descricao.campos)).toEqual({ turma: `${TURMA}:${DISCIPLINA}`, tema: 'Estequiometria', quantidade: '10' })
    const duas = descricaoDaFerramenta('plano_de_aula', { ...OPCOES, turmas: [...OPCOES.turmas, { valor: `${TURMA}:${ATIVIDADE}`, rotulo: '2ºB · Ciências' }] })
    // Com duas turmas, nenhuma vem escolhida: a professora escolhe.
    expect(valoresPadrao(duas.campos)).toEqual({ turma: '', tema: '' })
    expect(valoresPadrao(descricaoDaFerramenta('adaptacao', { ...OPCOES, iniciais: { origem: ATIVIDADE } }).campos)).toEqual({ origem: ATIVIDADE, tipos: [], tempoExtra: '' })
  })
})

function validados(ferramenta: (typeof FERRAMENTAS)[number], valores: Record<string, string | readonly string[]>) {
  const resultado = validarFormulario(descricaoDaFerramenta(ferramenta, OPCOES).campos, valores)
  if (!resultado.ok) throw new Error(`formulário inválido: ${resultado.pendencias.map((pendencia) => pendencia.mensagem).join(' ')}`)
  return resultado.valores
}

describe('o pedido que sai do formulário', () => {
  it('a atividade leva turma, disciplina, tema e quantidade, e o corpo passa no contrato da rota', () => {
    const montado = montarPedido('atividade_objetiva', validados('atividade_objetiva', { turma: `${TURMA}:${DISCIPLINA}`, tema: '  Reagente limitante ', quantidade: '8' }))
    expect(montado).toEqual({ ok: true, pedido: { ferramenta: 'atividade_objetiva', parametros: { turmaId: TURMA, disciplinaId: DISCIPLINA, tema: 'Reagente limitante', quantidade: 8 } } })
    if (!montado.ok || montado.pedido.ferramenta === 'adaptacao') throw new Error('era para montar')
    expect(gerarComFerramentaRequestSchema.safeParse({ ...montado.pedido.parametros, chaveEnvio: CHAVE }).success).toBe(true)
  })

  it('o plano de aula não leva quantidade', () => {
    expect(montarPedido('plano_de_aula', { turma: `${TURMA}:${DISCIPLINA}`, tema: 'Introdução à estequiometria', quantidade: 9 })).toEqual({
      ok: true,
      pedido: { ferramenta: 'plano_de_aula', parametros: { turmaId: TURMA, disciplinaId: DISCIPLINA, tema: 'Introdução à estequiometria' } },
    })
  })

  it('a Adaptação leva só a atividade, os tipos e o tempo extra: nada mais do formulário entra no pedido', () => {
    const montado = montarPedido('adaptacao', { origem: ATIVIDADE, tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtra: '50', tema: 'texto que não devia existir', observacao: 'aluno com laudo' })
    expect(montado).toEqual({ ok: true, pedido: { ferramenta: 'adaptacao', artefatoId: ATIVIDADE, tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 50 } })
    if (!montado.ok || montado.pedido.ferramenta !== 'adaptacao') throw new Error('era para montar')
    const { ferramenta: _ferramenta, artefatoId: _artefatoId, ...corpo } = montado.pedido
    // O corpo é estrito no contrato: um campo a mais (um texto) seria `ENTRADA_INVALIDA`.
    expect(adaptarArtefatoRequestSchema.safeParse({ ...corpo, chaveEnvio: CHAVE }).success).toBe(true)
    expect(adaptarArtefatoRequestSchema.safeParse({ ...corpo, chaveEnvio: CHAVE, observacao: 'aluno com laudo' }).success).toBe(false)
  })

  it('sem tempo extra escolhido o pedido sai sem ele, e todo tempo extra da lista cabe na faixa do contrato', () => {
    expect(montarPedido('adaptacao', validados('adaptacao', { origem: ATIVIDADE, tipos: ['linguagem_direta'], tempoExtra: '' }))).toEqual({
      ok: true,
      pedido: { ferramenta: 'adaptacao', artefatoId: ATIVIDADE, tipos: ['linguagem_direta'] },
    })
    for (const tempo of TEMPOS_EXTRAS)
      expect(adaptarArtefatoRequestSchema.safeParse({ tipos: ['tempo_adicional'], tempoExtraPercentual: Number(tempo.valor), chaveEnvio: CHAVE }).success).toBe(true)
  })

  it('tempo extra sem "Tempo adicional" marcado não sai: o campo some do formulário, e o valor que ficou de antes não vai no pedido', () => {
    // O campo é condicional: sem o tipo marcado, o formulário nem o valida, e o pedido sai só com os tipos.
    const montado = montarPedido('adaptacao', validados('adaptacao', { origem: ATIVIDADE, tipos: ['fonte_ampliada'], tempoExtra: '25' }))
    expect(montado).toEqual({ ok: true, pedido: { ferramenta: 'adaptacao', artefatoId: ATIVIDADE, tipos: ['fonte_ampliada'] } })
    // E quem monta o pedido continua recusando o tempo extra sem o tipo, se os valores chegarem por outro caminho.
    expect(montarPedido('adaptacao', { origem: ATIVIDADE, tipos: ['fonte_ampliada'], tempoExtra: '25' })).toEqual({
      ok: false,
      problema: 'O tempo extra só vale com "Tempo adicional" marcado. Marque esse tipo, ou deixe o tempo extra sem escolha.',
    })
  })

  it('tipo fora da lista fechada não vira pedido', () => {
    expect(montarPedido('adaptacao', { origem: ATIVIDADE, tipos: ['fonte_ampliada', 'dislexia'] }).ok).toBe(false)
    expect(montarPedido('adaptacao', { origem: ATIVIDADE, tipos: [] }).ok).toBe(false)
  })
})

describe('o que o cartão recebe do pedido escrito na caixa', () => {
  it('a atividade e o plano recebem a turma da caixa e o texto como tema, cortado no tamanho do tema', () => {
    expect(iniciaisDoPedido('atividade_objetiva', '  estequiometria, dez questões  ', `${TURMA}:${DISCIPLINA}`)).toEqual({ turma: `${TURMA}:${DISCIPLINA}`, tema: 'estequiometria, dez questões' })
    expect(iniciaisDoPedido('plano_de_aula', 'a'.repeat(400), undefined).tema).toHaveLength(300)
    expect(iniciaisDoPedido('plano_de_aula', '   ', undefined)).toEqual({})
  })

  it('D35: a Adaptação nunca recebe o texto da caixa de pedido', () => {
    expect(iniciaisDoPedido('adaptacao', 'prova adaptada para o João, que tem TDAH', `${TURMA}:${DISCIPLINA}`)).toEqual({})
  })
})

/** D46, RF21: nem nota, nem conceito, nem pontuação, nem média, nem ranking; e o "diagnóstico do aluno" não é o texto de uma ferramenta. */
const VOCABULARIO_PROIBIDO = /\bnotas?\b|\bconceitos?\b|pontua|\bmédias?\b|ranking|diagn[óo]stico do aluno/i
/** D35: a Adaptação não fala de aluno nem de condição dele. */
const FALA_DE_ALUNO_OU_CONDICAO = /alun|laudo|diagn[óo]stic|defici|condi[çc]|transtorno|TDAH|dislex|autis|necessidade|motivo/i

describe('"Como vai sair": o texto fixo de cada ferramenta (telas do professor, 8.0; RF11)', () => {
  it('há um texto por ferramenta do catálogo, de uma a três linhas, e nenhum para ferramenta que não existe', () => {
    expect(Object.keys(COMO_VAI_SAIR).sort()).toEqual(CATALOGO_DE_FERRAMENTAS.map((item) => item.ferramenta).sort())
    for (const item of CATALOGO_DE_FERRAMENTAS) {
      const linhas = COMO_VAI_SAIR[item.ferramenta]
      expect(linhas.length, `${item.nome}: linhas`).toBeGreaterThanOrEqual(1)
      expect(linhas.length, `${item.nome}: linhas`).toBeLessThanOrEqual(3)
      for (const linha of linhas) expect(linha.trim(), `${item.nome}: linha vazia`).not.toBe('')
    }
  })

  it('diz o que sai, onde fica (Criados) e se vai à turma, e como', () => {
    for (const item of CATALOGO_DE_FERRAMENTAS) {
      const texto = COMO_VAI_SAIR[item.ferramenta].join(' ')
      expect(texto, `${item.nome}: onde fica`).toContain('Criados')
      expect(texto, `${item.nome}: se vai à turma`).toMatch(/turma/)
    }
    // Só a atividade se aplica à turma pela professora; o plano é só dela; a versão adaptada espera a aprovação.
    expect(COMO_VAI_SAIR.atividade_objetiva.join(' ')).toContain('“Aplicar à turma”')
    expect(COMO_VAI_SAIR.plano_de_aula.join(' ')).toContain('Não vai à turma')
    expect(COMO_VAI_SAIR.adaptacao.join(' ')).toContain('esperando a sua aprovação')
    expect(COMO_VAI_SAIR.adaptacao.join(' ')).toContain('Só o tipo da adaptação é registrado')
    // Aprovada, a versão ainda precisa de "Aplicar à turma": a frase diz como ela vai, e não só que vai.
    expect(COMO_VAI_SAIR.adaptacao.join(' ')).toContain('Depois de aprovada, vai à turma quando você escolher “Aplicar à turma”')
  })

  it('as aspas são as tipográficas, como nas outras telas: nenhuma linha leva aspas retas', () => {
    for (const item of CATALOGO_DE_FERRAMENTAS) for (const linha of COMO_VAI_SAIR[item.ferramenta]) expect(linha).not.toContain('"')
  })

  it('D46, RF21: nenhum texto fala em nota, conceito, pontuação, média, ranking nem em diagnóstico do aluno', () => {
    for (const item of CATALOGO_DE_FERRAMENTAS) for (const linha of COMO_VAI_SAIR[item.ferramenta]) expect(linha).not.toMatch(VOCABULARIO_PROIBIDO)
  })

  it('D35: o texto da Adaptação não cita aluno nem condição de aluno', () => {
    for (const linha of COMO_VAI_SAIR.adaptacao) expect(linha).not.toMatch(FALA_DE_ALUNO_OU_CONDICAO)
  })

  it('as listas de palavras proibidas pegam o que dizem pegar', () => {
    for (const palavra of ['nota', 'notas', 'conceito', 'conceitos', 'pontuação', 'média', 'médias', 'ranking', 'diagnóstico do aluno']) expect(palavra).toMatch(VOCABULARIO_PROIBIDO)
    for (const palavra of ['aluno', 'laudo', 'diagnóstico', 'TDAH', 'dislexia', 'condição']) expect(palavra).toMatch(FALA_DE_ALUNO_OU_CONDICAO)
    // O vocabulário permitido não é pego por engano: "anotar" não é "nota", e "gabarito" e "acerto" são o que a tela diz.
    for (const palavra of ['anotar', 'gabarito', 'acerto', 'Criados']) expect(palavra).not.toMatch(VOCABULARIO_PROIBIDO)
  })
})

describe('ferramentaDoCatalogo', () => {
  it('a ferramenta fora do catálogo é um ErroDeInvariante de motivo fixo, sem o nome recebido', () => {
    const fora = 'ferramenta-que-nao-existe' as never

    expect(() => ferramentaDoCatalogo(fora)).toThrow(InvariantException)
    expect(() => ferramentaDoCatalogo(fora)).toThrow(new InvariantException('ferramenta fora do catálogo'))
    expect(() => ferramentaDoCatalogo(fora)).not.toThrow('ferramenta-que-nao-existe')
  })
})
