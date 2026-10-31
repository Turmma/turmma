import { ROTULOS_DA_ADAPTACAO, TIPOS_DE_ADAPTACAO } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { campoVisivel, problemaDaDescricao, resumoDoPedido, validarFormulario, valoresPadrao, type CampoDoMotor, type DescricaoDeFerramenta } from './schema-form'

const TURMAS = [
  { valor: 'turma-2b', rotulo: '2ºB' },
  { valor: 'turma-1a', rotulo: '1ºA' },
]

const ATIVIDADE = {
  ferramenta: 'atividade_objetiva',
  nome: 'Atividade objetiva',
  verbo: 'Gerar atividade',
  campos: [
    { tipo: 'selecao', chave: 'turmaId', rotulo: 'Turma', opcoes: TURMAS, obrigatorio: true },
    { tipo: 'texto', chave: 'tema', rotulo: 'Tema', obrigatorio: true, maximo: 40 },
    { tipo: 'numero', chave: 'quantidade', rotulo: 'Questões', minimo: 1, maximo: 20, padrao: 10 },
  ],
} as const satisfies DescricaoDeFerramenta

const ADAPTACAO = {
  ferramenta: 'adaptacao',
  nome: 'Adaptação',
  verbo: 'Gerar versão adaptada',
  campos: [
    { tipo: 'multipla', chave: 'tipos', rotulo: 'Tipo de adaptação', minimo: 1, opcoes: TIPOS_DE_ADAPTACAO.map((valor) => ({ valor, rotulo: ROTULOS_DA_ADAPTACAO[valor] })) },
    { tipo: 'numero', chave: 'tempoExtraPercentual', rotulo: 'Tempo adicional (%)', minimo: 10, maximo: 100 },
  ],
} satisfies DescricaoDeFerramenta

describe('a Adaptação não tem campo de texto livre (D35, D67)', () => {
  it('o tipo recusa o campo de texto na descrição da Adaptação', () => {
    const campoDeTexto = { tipo: 'texto', chave: 'observacao', rotulo: 'Sobre o aluno' } as const
    // @ts-expect-error campo de texto na Adaptação é onde o diagnóstico do aluno entraria no sistema
    const comTexto: DescricaoDeFerramenta = { ferramenta: 'adaptacao', nome: 'Adaptação', verbo: 'Gerar versão adaptada', campos: [campoDeTexto] }
    // O controle: o mesmo campo, em outra ferramenta, compila. O que o tipo recusa é o texto **na Adaptação**.
    const noPlano: DescricaoDeFerramenta = { ferramenta: 'plano_de_aula', nome: 'Plano de aula', verbo: 'Gerar plano', campos: [campoDeTexto] }
    expect(problemaDaDescricao(noPlano)).toBeUndefined()
    // E a mesma descrição, chegando como dado, é recusada em execução.
    expect(problemaDaDescricao(comTexto)).toMatch(/Adaptação não tem campo de texto/)
  })

  it('as outras ferramentas podem ter texto (o tema), e a Adaptação só com listas passa', () => {
    expect(problemaDaDescricao(ATIVIDADE)).toBeUndefined()
    expect(problemaDaDescricao(ADAPTACAO)).toBeUndefined()
  })

  it('a descrição com duas chaves iguais é recusada: um campo apagaria o valor do outro', () => {
    const campos: CampoDoMotor[] = [
      { tipo: 'texto', chave: 'tema', rotulo: 'Tema' },
      { tipo: 'numero', chave: 'tema', rotulo: 'Questões', minimo: 1, maximo: 20 },
    ]
    expect(problemaDaDescricao({ ferramenta: 'plano_de_aula', campos })).toMatch(/mesma chave/)
  })
})

describe('valores padrão', () => {
  it('cada campo abre com o padrão dele, e vazio quando não tem', () => {
    expect(valoresPadrao(ATIVIDADE.campos)).toEqual({ turmaId: '', tema: '', quantidade: '10' })
    expect(valoresPadrao(ADAPTACAO.campos)).toEqual({ tipos: [], tempoExtraPercentual: '' })
  })

  it('o padrão que não está na lista de opções é ignorado', () => {
    const campos: CampoDoMotor[] = [
      { tipo: 'selecao', chave: 'turmaId', rotulo: 'Turma', opcoes: TURMAS, padrao: 'turma-de-outra-escola' },
      { tipo: 'multipla', chave: 'tipos', rotulo: 'Tipos', opcoes: [{ valor: 'fonte_ampliada', rotulo: 'Fonte ampliada' }], padrao: ['fonte_ampliada', 'laudo'] },
    ]
    expect(valoresPadrao(campos)).toEqual({ turmaId: '', tipos: ['fonte_ampliada'] })
  })
})

describe('validação do formulário', () => {
  it('preenchido, devolve os valores prontos: texto aparado e número como número', () => {
    expect(validarFormulario(ATIVIDADE.campos, { turmaId: 'turma-2b', tema: '  Estequiometria ', quantidade: '8' })).toEqual({
      ok: true,
      valores: { turmaId: 'turma-2b', tema: 'Estequiometria', quantidade: 8 },
    })
  })

  it('diz o que falta, campo a campo, na ordem do formulário', () => {
    const resultado = validarFormulario(ATIVIDADE.campos, { turmaId: '', tema: '   ', quantidade: '10' })
    expect(resultado).toEqual({
      ok: false,
      pendencias: [
        { chave: 'turmaId', rotulo: 'Turma', mensagem: 'Escolha uma opção em "Turma".' },
        { chave: 'tema', rotulo: 'Tema', mensagem: 'Preencha "Tema".' },
      ],
    })
  })

  it('o campo opcional em branco fica fora do pedido, sem pendência', () => {
    expect(validarFormulario(ATIVIDADE.campos, { turmaId: 'turma-2b', tema: 'Estequiometria', quantidade: '' })).toEqual({
      ok: true,
      valores: { turmaId: 'turma-2b', tema: 'Estequiometria' },
    })
  })

  it('número fora da faixa, quebrado ou que não é número é recusado', () => {
    for (const quantidade of ['0', '21', '2.5', '1e1', 'dez', '-3']) {
      const resultado = validarFormulario(ATIVIDADE.campos, { turmaId: 'turma-2b', tema: 'Estequiometria', quantidade })
      expect(resultado, quantidade).toEqual({ ok: false, pendencias: [{ chave: 'quantidade', rotulo: 'Questões', mensagem: 'Use um número inteiro de 1 a 20 em "Questões".' }] })
    }
    expect(validarFormulario(ATIVIDADE.campos, { turmaId: 'turma-2b', tema: 'Estequiometria', quantidade: '20' })).toMatchObject({ ok: true, valores: { quantidade: 20 } })
  })

  it('texto acima do máximo é recusado, dizendo o limite', () => {
    const resultado = validarFormulario(ATIVIDADE.campos, { turmaId: 'turma-2b', tema: 'x'.repeat(41), quantidade: '10' })
    expect(resultado).toEqual({ ok: false, pendencias: [{ chave: 'tema', rotulo: 'Tema', mensagem: 'Use até 40 caracteres em "Tema".' }] })
  })

  it('a opção que não está na lista é recusada: o pedido só leva o que a ferramenta declarou', () => {
    expect(validarFormulario(ATIVIDADE.campos, { turmaId: 'turma-de-outra-escola', tema: 'Estequiometria', quantidade: '10' })).toEqual({
      ok: false,
      pendencias: [{ chave: 'turmaId', rotulo: 'Turma', mensagem: 'Escolha uma das opções de "Turma".' }],
    })
    expect(validarFormulario(ADAPTACAO.campos, { tipos: ['fonte_ampliada', 'laudo de TDAH'], tempoExtraPercentual: '' })).toEqual({
      ok: false,
      pendencias: [{ chave: 'tipos', rotulo: 'Tipo de adaptação', mensagem: 'Escolha só entre as opções de "Tipo de adaptação".' }],
    })
  })

  it('a Adaptação pede pelo menos um tipo, e devolve os tipos na ordem da lista, sem repetição', () => {
    expect(validarFormulario(ADAPTACAO.campos, { tipos: [], tempoExtraPercentual: '' })).toEqual({
      ok: false,
      pendencias: [{ chave: 'tipos', rotulo: 'Tipo de adaptação', mensagem: 'Marque pelo menos uma opção em "Tipo de adaptação".' }],
    })
    expect(validarFormulario(ADAPTACAO.campos, { tipos: ['tempo_adicional', 'fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: '25' })).toEqual({
      ok: true,
      valores: { tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 25 },
    })
  })

  it('valor de chave que a descrição não tem não sai no pedido', () => {
    const resultado = validarFormulario(ADAPTACAO.campos, { tipos: ['fonte_ampliada'], tempoExtraPercentual: '', observacao: 'o aluno tem dislexia' })
    expect(resultado).toEqual({ ok: true, valores: { tipos: ['fonte_ampliada'] } })
  })
})

describe('campo condicional', () => {
  const tipos = { tipo: 'multipla', chave: 'tipos', rotulo: 'Tipo de adaptação', minimo: 1, opcoes: TIPOS_DE_ADAPTACAO.map((valor) => ({ valor, rotulo: ROTULOS_DA_ADAPTACAO[valor] })) } as const
  const tempo = { tipo: 'numero', chave: 'tempoExtraPercentual', rotulo: 'Tempo adicional (%)', minimo: 10, maximo: 100, obrigatorio: true, quando: { campo: 'tipos', contem: 'tempo_adicional' } } as const
  const comCondicao = { ferramenta: 'adaptacao', nome: 'Adaptação', verbo: 'Gerar versão adaptada', campos: [tipos, tempo] } satisfies DescricaoDeFerramenta

  it('o campo só aparece com a opção marcada no campo de múltipla escolha', () => {
    expect(campoVisivel(tempo, { tipos: ['fonte_ampliada'], tempoExtraPercentual: '' })).toBe(false)
    expect(campoVisivel(tempo, { tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: '' })).toBe(true)
    expect(campoVisivel(tempo, {})).toBe(false)
    // Sem condição, sempre.
    expect(campoVisivel(tipos, {})).toBe(true)
  })

  it('escondido, o campo obrigatório não é cobrado e o valor que ficou de antes não sai no pedido', () => {
    expect(validarFormulario(comCondicao.campos, { tipos: ['fonte_ampliada'], tempoExtraPercentual: '25' })).toEqual({ ok: true, valores: { tipos: ['fonte_ampliada'] } })
  })

  it('à vista, o campo é cobrado e sai no pedido como qualquer outro', () => {
    expect(validarFormulario(comCondicao.campos, { tipos: ['tempo_adicional'], tempoExtraPercentual: '' })).toEqual({
      ok: false,
      pendencias: [{ chave: 'tempoExtraPercentual', rotulo: 'Tempo adicional (%)', mensagem: 'Preencha "Tempo adicional (%)".' }],
    })
    expect(validarFormulario(comCondicao.campos, { tipos: ['tempo_adicional'], tempoExtraPercentual: '25' })).toEqual({ ok: true, valores: { tipos: ['tempo_adicional'], tempoExtraPercentual: 25 } })
  })

  it('a condição só aponta para uma opção de um campo de múltipla escolha: a descrição com outra coisa é recusada', () => {
    expect(problemaDaDescricao(comCondicao)).toBeUndefined()
    const semOpcao = { ...tempo, quando: { campo: 'tipos', contem: 'laudo' } }
    const semCampo = { ...tempo, quando: { campo: 'nao-existe', contem: 'tempo_adicional' } }
    const deSelecao: CampoDoMotor = { tipo: 'selecao', chave: 'turmaId', rotulo: 'Turma', opcoes: TURMAS }
    const sobreSelecao = { ...tempo, quando: { campo: 'turmaId', contem: 'turma-2b' } }
    const sobreSiMesmo: CampoDoMotor = { ...tipos, quando: { campo: 'tipos', contem: 'tempo_adicional' } }
    expect(problemaDaDescricao({ ferramenta: 'adaptacao', campos: [tipos, semOpcao] })).toMatch(/não aponta para uma opção/)
    expect(problemaDaDescricao({ ferramenta: 'adaptacao', campos: [tipos, semCampo] })).toMatch(/não aponta para uma opção/)
    expect(problemaDaDescricao({ ferramenta: 'adaptacao', campos: [deSelecao, sobreSelecao] })).toMatch(/não aponta para uma opção/)
    expect(problemaDaDescricao({ ferramenta: 'adaptacao', campos: [sobreSiMesmo] })).toMatch(/não aponta para uma opção/)
  })

  it('a condição não abre brecha para texto na Adaptação: o campo condicional de texto continua recusado', () => {
    const texto = { tipo: 'texto', chave: 'observacao', rotulo: 'Sobre o aluno', quando: { campo: 'tipos', contem: 'tempo_adicional' } } as const
    // @ts-expect-error com ou sem condição, a Adaptação não tem campo de texto
    const descricao: DescricaoDeFerramenta = { ferramenta: 'adaptacao', nome: 'Adaptação', verbo: 'Gerar versão adaptada', campos: [tipos, texto] }
    expect(problemaDaDescricao(descricao)).toMatch(/Adaptação não tem campo de texto/)
  })
})

describe('resumo do pedido', () => {
  it('conta o pedido numa linha, com o rótulo da opção e não o id', () => {
    expect(resumoDoPedido(ATIVIDADE.campos, { turmaId: 'turma-2b', tema: 'Estequiometria', quantidade: 8 })).toBe('2ºB · Estequiometria · Questões: 8')
    expect(resumoDoPedido(ADAPTACAO.campos, { tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 25 })).toBe('Fonte ampliada + Tempo adicional · Tempo adicional (%): 25')
  })

  it('o campo que não foi preenchido não aparece', () => {
    expect(resumoDoPedido(ATIVIDADE.campos, { turmaId: 'turma-2b', tema: 'Estequiometria' })).toBe('2ºB · Estequiometria')
  })
})
