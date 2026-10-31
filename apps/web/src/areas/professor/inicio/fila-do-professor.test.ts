import { ErrorCode, type Entrega, type Vinculo } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ErroDaApi } from '../../../api/client'
import { caminhoDaCorrecaoDoProfessor, ROTAS_DO_PROFESSOR } from '../../../paths'
import type { LeituraDaFila } from '../../../components/sino/leitura-do-sino'
import { esperandoVoce, esperaNaTurma, filaDoProfessor, GRUPO_DA_TURMA_SEM_NOME, TETO_DE_TURMAS_LIDAS, turmasConfirmadas, type EntradaDaFilaDoProfessor, type LeituraDaContagem } from './fila-do-professor'

const TURMA_B = '0190f5a0-0000-7000-8000-00000000002b'
const TURMA_A = '0190f5a0-0000-7000-8000-00000000002a'
const ATIVIDADE = '0190f5a0-0000-7000-8000-0000000000b1'
const CAMILA = { id: '0190f5a0-0000-7000-8000-0000000000f1', nome: 'Camila Souza' }

function entrega(final: string, campos: Partial<Entrega> = {}): Entrega {
  return {
    id: `0190f5a0-0000-7000-8000-0000000000${final}`,
    tipo: 'versao_adaptada',
    funcao: 'adaptacao',
    estado: 'pendente',
    turmaId: TURMA_B,
    titulo: 'Atividade de estequiometria (versão adaptada)',
    artefatoId: '0190f5a0-0000-7000-8000-0000000000a9',
    atividadeAplicadaId: null,
    criadaEm: '2026-10-05T13:40:00.000Z',
    decididaEm: null,
    decididaPor: null,
    justificativa: null,
    ...campos,
  }
}

function lote(final: string, campos: Partial<Entrega> = {}): Entrega {
  return entrega(final, { tipo: 'lote_de_correcao', funcao: 'correcao_de_objetiva', titulo: 'Atividade de estequiometria', artefatoId: null, atividadeAplicadaId: ATIVIDADE, ...campos })
}

function vinculo(final: string, turma: { id: string; nome: string }, campos: Partial<Vinculo> = {}): Vinculo {
  return { id: `0190f5a0-0000-7000-8000-0000000001${final}`, turma, estado: 'confirmado', disciplina: { id: '0190f5a0-0000-7000-8000-0000000002aa', nome: 'Química' }, ...campos }
}

const B = { id: TURMA_B, nome: '2ºB' }
const A = { id: TURMA_A, nome: '1ºA' }

const lida = <Dado>(dado: Dado, completa = true): LeituraDaFila<Dado> => ({ estado: 'lida', dado, completa })

function entrada(campos: Partial<EntradaDaFilaDoProfessor> = {}): EntradaDaFilaDoProfessor {
  return { entregas: lida<readonly Entrega[]>([]), vinculos: lida<readonly Vinculo[]>([]), contagens: new Map(), ...campos }
}

const contagem = (quantidade: number, haMais = false): LeituraDaContagem => ({ estado: 'lida', dado: { quantidade, haMais } })

describe('a fila da professora, tipo a tipo (RF3)', () => {
  it('a correção leva à tela de revisar a atividade; o lote sem atividade aplicada leva ao Assistente', () => {
    const fila = filaDoProfessor(entrada({ entregas: lida([lote('01'), lote('02', { atividadeAplicadaId: null })]), vinculos: lida([vinculo('01', B)]), contagens: new Map([[TURMA_B, contagem(0)]]) }))
    expect(fila.itens.map((item) => [item.tipo, item.titulo, item.para])).toEqual([
      ['correcao', 'Correção para revisar', caminhoDaCorrecaoDoProfessor(ATIVIDADE)],
      ['correcao', 'Correção para revisar', ROTAS_DO_PROFESSOR.timeDoAssistente],
    ])
    expect(fila.itens[0]?.detalhe).toBe('Atividade de estequiometria')
  })

  it('a versão adaptada leva ao Assistente, e a decidida não conta', () => {
    const fila = filaDoProfessor(entrada({ entregas: lida([entrega('01'), entrega('02', { estado: 'aprovada', decididaEm: '2026-10-05T13:42:00.000Z', decididaPor: CAMILA })]) }))
    expect(fila.itens).toHaveLength(1)
    expect(fila.itens[0]).toMatchObject({ tipo: 'versao-adaptada', titulo: 'Versão adaptada para decidir', para: '/time/assistente' })
  })

  it('o pedido de nome é um item por turma, com a quantidade e sem nome de aluno, e leva à aba Alunos da turma', () => {
    const fila = filaDoProfessor(entrada({ vinculos: lida([vinculo('01', B)]), contagens: new Map([[TURMA_B, contagem(3)]]) }))
    expect(fila.itens).toHaveLength(1)
    expect(fila.itens[0]).toMatchObject({ tipo: 'pedidos-de-nome', grupo: '2ºB', detalhe: '3 pedidos esperando a decisão', contador: { n: 3, oQueConta: 'pedidos de nome' } })
    expect(fila.itens[0]?.para).toBe(`/turmas/${TURMA_B}?aba=alunos`)
  })

  it('um pedido fala no singular, e turma sem pedido não vira item', () => {
    const um = filaDoProfessor(entrada({ vinculos: lida([vinculo('01', B)]), contagens: new Map([[TURMA_B, contagem(1)]]) }))
    expect(um.itens[0]?.detalhe).toBe('1 pedido esperando a decisão')
    expect(um.itens[0]?.contador).toEqual({ n: 1, oQueConta: 'pedido de nome' })
    expect(filaDoProfessor(entrada({ vinculos: lida([vinculo('01', B)]), contagens: new Map([[TURMA_B, contagem(0)]]) })).itens).toEqual([])
  })

  it('página cheia com outra depois diz "100 ou mais", e não um número exato', () => {
    const fila = filaDoProfessor(entrada({ vinculos: lida([vinculo('01', B)]), contagens: new Map([[TURMA_B, contagem(100, true)]]) }))
    expect(fila.itens[0]).toMatchObject({ detalhe: '100 ou mais pedidos esperando a decisão', contador: { n: 100, oQueConta: 'ou mais pedidos de nome' } })
  })

  it('a turma a confirmar leva a Turmas, com a disciplina; o vínculo sem disciplina diz que a coordenação alocou', () => {
    const fila = filaDoProfessor(entrada({ vinculos: lida([vinculo('01', B, { estado: 'pendente' }), vinculo('02', A, { estado: 'pendente', disciplina: undefined })]) }))
    expect(fila.itens.map((item) => [item.tipo, item.grupo, item.detalhe, item.para])).toEqual([
      ['confirme-sua-turma', '1ºA', 'A coordenação alocou você nesta turma', '/turmas'],
      ['confirme-sua-turma', '2ºB', 'Química', '/turmas'],
    ])
  })

  it('o vínculo contestado espera a coordenação e não conta; o encerrado (de ano que acabou) não espera ninguém', () => {
    const fila = filaDoProfessor(entrada({ vinculos: lida([vinculo('01', B, { estado: 'contestado' }), vinculo('02', A, { estado: 'encerrado' })]) }))
    expect(fila.itens).toEqual([])
    expect(fila.situacao).toBe('pronta')
  })

  it('duas disciplinas na mesma turma são uma turma só: uma leitura de pedidos e um item', () => {
    const outra = { id: '0190f5a0-0000-7000-8000-0000000002ab', nome: 'Física' }
    const vinculos = [vinculo('01', B), vinculo('02', B, { disciplina: outra })]
    expect(turmasConfirmadas(vinculos)).toEqual([{ turmaId: TURMA_B, nome: '2ºB' }])
    const fila = filaDoProfessor(entrada({ vinculos: lida(vinculos), contagens: new Map([[TURMA_B, contagem(2)]]) }))
    expect(fila.itens.filter((item) => item.tipo === 'pedidos-de-nome')).toHaveLength(1)
  })

  it('a turma confirmada sai em ordem de nome, com número no jeito da professora (2ºA antes de 10ºA)', () => {
    const dez = { id: '0190f5a0-0000-7000-8000-00000000002c', nome: '10ºA' }
    expect(turmasConfirmadas([vinculo('01', dez), vinculo('02', B), vinculo('03', A), vinculo('04', { id: 'x', nome: '3ºA' }, { estado: 'pendente' })]).map((turma) => turma.nome)).toEqual(['1ºA', '2ºB', '10ºA'])
  })
})

describe('a ordem da fila', () => {
  it('agrupa por turma em ordem de nome e, dentro dela, correção, versão adaptada, pedidos e turma a confirmar', () => {
    const fila = filaDoProfessor(
      entrada({
        entregas: lida([entrega('01'), lote('02'), lote('03', { turmaId: TURMA_A })]),
        vinculos: lida([vinculo('01', B), vinculo('02', A), vinculo('03', { id: '0190f5a0-0000-7000-8000-00000000002c', nome: '3ºC' }, { estado: 'pendente' })]),
        contagens: new Map([
          [TURMA_B, contagem(2)],
          [TURMA_A, contagem(0)],
        ]),
      }),
    )
    expect(fila.itens.map((item) => `${item.grupo}:${item.tipo}`)).toEqual(['1ºA:correcao', '2ºB:correcao', '2ºB:versao-adaptada', '2ºB:pedidos-de-nome', '3ºC:confirme-sua-turma'])
  })

  it('a entrega de turma que os vínculos não trazem vai para "Outras turmas", por último', () => {
    // O nome da turma vem depois de "Outras turmas" na ordem das letras: só a regra põe o grupo sem nome por último.
    const zebra = { id: TURMA_B, nome: 'Turma Zebra' }
    const fila = filaDoProfessor(entrada({ entregas: lida([entrega('01', { turmaId: '0190f5a0-0000-7000-8000-0000000000ff' }), lote('02')]), vinculos: lida([vinculo('01', zebra)]), contagens: new Map([[TURMA_B, contagem(0)]]) }))
    expect(fila.itens.map((item) => item.grupo)).toEqual(['Turma Zebra', GRUPO_DA_TURMA_SEM_NOME])
  })

  it('dentro da turma e do tipo, a entrega mais antiga vem primeiro', () => {
    const fila = filaDoProfessor(entrada({ entregas: lida([entrega('02', { criadaEm: '2026-10-05T14:00:00.000Z' }), entrega('01', { criadaEm: '2026-10-05T09:00:00.000Z' })]), vinculos: lida([vinculo('01', B)]), contagens: new Map([[TURMA_B, contagem(0)]]) }))
    expect(fila.itens.map((item) => item.id.slice(-2))).toEqual(['01', '02'])
  })
})

describe('a situação da fila: nunca "Tudo em dia" sem ter lido tudo', () => {
  const completa = (campos: Partial<EntradaDaFilaDoProfessor> = {}) => entrada({ vinculos: lida([vinculo('01', B)]), contagens: new Map([[TURMA_B, contagem(0)]]), ...campos })

  it('tudo lido e nada esperando é pronta; qualquer leitura em curso é carregando', () => {
    expect(filaDoProfessor(completa())).toMatchObject({ situacao: 'pronta', itens: [], naoLeu: [] })
    expect(filaDoProfessor(completa({ entregas: { estado: 'carregando' } })).situacao).toBe('carregando')
    expect(filaDoProfessor(completa({ vinculos: { estado: 'carregando' } })).situacao).toBe('carregando')
    expect(filaDoProfessor(completa({ contagens: new Map([[TURMA_B, { estado: 'carregando' }]]) })).situacao).toBe('carregando')
  })

  it('as entregas que não vieram deixam a fila parcial e dizem o que faltou', () => {
    expect(filaDoProfessor(completa({ entregas: { estado: 'erro', erro: new Error('falhou') } }))).toMatchObject({ situacao: 'parcial', naoLeu: ['as correções e as versões adaptadas'] })
    expect(filaDoProfessor(completa({ entregas: lida([], false) }))).toMatchObject({ situacao: 'parcial', naoLeu: ['parte das correções e das versões adaptadas'] })
  })

  it('a página de entregas cheia, com outra depois, faz a fila dizer que há mais; inteira, não', () => {
    const cem = Array.from({ length: 100 }, (_, i) => lote(String(i).padStart(2, '0')))
    const cheia = filaDoProfessor(completa({ entregas: lida(cem, false) }))
    expect(cheia).toMatchObject({ situacao: 'parcial', haMais: true })
    expect(cheia.itens).toHaveLength(100)
    // O controle: as mesmas 100, lidas até o fim, são exatamente 100.
    expect(filaDoProfessor(completa({ entregas: lida(cem, true) }))).toMatchObject({ situacao: 'pronta', haMais: false })
    // O que falhou ou ainda lê não tem número a dizer.
    expect(filaDoProfessor(completa({ entregas: { estado: 'erro', erro: new Error('falhou') } })).haMais).toBe(false)
    expect(filaDoProfessor(completa({ entregas: { estado: 'carregando' } })).haMais).toBe(false)
  })

  it('os vínculos que não vieram, ou vieram em parte, deixam a fila parcial', () => {
    expect(filaDoProfessor(completa({ vinculos: { estado: 'erro', erro: new Error('falhou') } }))).toMatchObject({ situacao: 'parcial', naoLeu: ['as suas turmas'] })
    expect(filaDoProfessor(completa({ vinculos: lida([vinculo('01', B)], false) }))).toMatchObject({ situacao: 'parcial', naoLeu: ['parte das suas turmas'] })
  })

  it('entregas e vínculos que falharam juntos são erro, com a primeira falha', () => {
    const falha = new Error('rede')
    expect(filaDoProfessor(completa({ entregas: { estado: 'erro', erro: falha }, vinculos: { estado: 'erro', erro: new Error('outra') } }))).toMatchObject({ situacao: 'erro', erro: falha })
    // Só uma das duas que falha não é erro: o que a outra leu aparece, e a fila diz o que faltou.
    expect(filaDoProfessor(completa({ entregas: { estado: 'erro', erro: falha } })).situacao).toBe('parcial')
    expect(filaDoProfessor(completa({ vinculos: { estado: 'erro', erro: falha } })).situacao).toBe('parcial')
  })

  it('a turma cuja contagem falhou ou não foi lida deixa a fila parcial, e o aviso conta as turmas', () => {
    expect(filaDoProfessor(completa({ contagens: new Map([[TURMA_B, { estado: 'erro', erro: new Error('x') }]]) }))).toMatchObject({ situacao: 'parcial', naoLeu: ['os pedidos de nome de 1 turma'] })
    const duas = filaDoProfessor(entrada({ vinculos: lida([vinculo('01', B), vinculo('02', A)]), contagens: new Map<string, LeituraDaContagem>([[TURMA_B, { estado: 'nao-lida' }], [TURMA_A, { estado: 'nao-lida' }]]) }))
    expect(duas).toMatchObject({ situacao: 'parcial', naoLeu: ['os pedidos de nome de 2 turmas'] })
  })

  it('além do teto de turmas, as que não entram na leitura contam como não lidas', () => {
    const turmas = Array.from({ length: TETO_DE_TURMAS_LIDAS + 2 }, (_, i) => ({ id: `0190f5a0-0000-7000-8000-0000000003${String(i).padStart(2, '0')}`, nome: `Turma ${String(i + 1).padStart(2, '0')}` }))
    const contagens = new Map<string, LeituraDaContagem>(turmas.slice(0, TETO_DE_TURMAS_LIDAS).map((turma) => [turma.id, contagem(0)]))
    const fila = filaDoProfessor(entrada({ vinculos: lida(turmas.map((turma, i) => vinculo(String(i).padStart(2, '0'), turma))), contagens }))
    expect(fila).toMatchObject({ situacao: 'parcial', itens: [], naoLeu: ['os pedidos de nome de 2 turmas'] })
  })

  it('sem ano letivo em curso a fila é parcial, não lê turma e não diz "em dia"', () => {
    const semAno = new ErroDaApi(ErrorCode.NAO_ENCONTRADO)
    const fila = filaDoProfessor(entrada({ vinculos: { estado: 'erro', erro: semAno }, entregas: { estado: 'erro', erro: semAno } }))
    expect(fila).toMatchObject({ situacao: 'parcial', semAnoLetivo: true, itens: [] })
  })

  it('a falha que não é "não encontrado" não vira "sem ano letivo"', () => {
    const fila = filaDoProfessor(entrada({ vinculos: { estado: 'erro', erro: new ErroDaApi(ErrorCode.ERRO_INTERNO) } }))
    expect(fila.semAnoLetivo).toBe(false)
  })
})

describe('"Esperando você" do Início (11.2), que veio de entregas.ts', () => {
  it('só as pendentes aparecem, da mais antiga para a mais nova, com a função, o que é e a turma', () => {
    const itens = esperandoVoce(
      [
        entrega('02', { criadaEm: '2026-10-05T14:00:00.000Z', titulo: 'Lista 3' }),
        entrega('03', { estado: 'aprovada', decididaEm: '2026-10-05T13:42:00.000Z', decididaPor: CAMILA }),
        lote('01', { criadaEm: '2026-10-05T09:00:00.000Z' }),
        entrega('04', { estado: 'rejeitada', decididaEm: '2026-10-05T13:42:00.000Z', decididaPor: CAMILA, justificativa: 'Faltou a questão 2.' }),
      ],
      { [TURMA_B]: '2ºB' },
    )
    expect(itens).toEqual([
      { id: '0190f5a0-0000-7000-8000-000000000001', funcao: 'correcao_de_objetiva', nomeDaFuncao: 'Correção de objetiva', titulo: 'Correção da turma', detalhe: 'Atividade de estequiometria · 2ºB', atividadeAplicadaId: ATIVIDADE },
      { id: '0190f5a0-0000-7000-8000-000000000002', funcao: 'adaptacao', nomeDaFuncao: 'Adaptação', titulo: 'Versão adaptada', detalhe: 'Lista 3 · 2ºB', atividadeAplicadaId: null },
    ])
  })

  it('sem pendência a lista é vazia, e a turma que a tela não conhece não vira "undefined"', () => {
    expect(esperandoVoce([entrega('03', { estado: 'aprovada', decididaEm: '2026-10-05T13:42:00.000Z', decididaPor: CAMILA })], {})).toEqual([])
    expect(esperandoVoce([entrega('01')], {})[0]?.detalhe).toBe('Atividade de estequiometria (versão adaptada)')
  })
})

describe('o que espera em cada turma, para o cartão de Turmas (9.0)', () => {
  const dasDuas = (campos: Partial<EntradaDaFilaDoProfessor> = {}) =>
    filaDoProfessor(
      entrada({
        vinculos: lida([vinculo('01', B), vinculo('02', A)]),
        contagens: new Map([
          [TURMA_B, contagem(3)],
          [TURMA_A, contagem(0)],
        ]),
        ...campos,
      }),
    )

  it('soma a correção, a versão adaptada e os pedidos da turma, e só os dela', () => {
    const fila = dasDuas({ entregas: lida([lote('01'), entrega('02'), lote('03', { turmaId: TURMA_A })]) })
    expect(esperaNaTurma(fila, TURMA_B)).toEqual({ n: 5, ouMais: false, leitura: 'lida' })
    expect(esperaNaTurma(fila, TURMA_A)).toEqual({ n: 1, ouMais: false, leitura: 'lida' })
  })

  it('o vínculo a confirmar não entra na soma, e a turma sem nada esperando e lida inteira é zero', () => {
    const fila = filaDoProfessor(entrada({ vinculos: lida([vinculo('01', B, { estado: 'pendente' }), vinculo('02', A)]), contagens: new Map([[TURMA_A, contagem(0)]]) }))
    expect(fila.itens.map((item) => item.tipo)).toEqual(['confirme-sua-turma'])
    expect(esperaNaTurma(fila, TURMA_B).n).toBe(0)
    expect(esperaNaTurma(fila, TURMA_A)).toEqual({ n: 0, ouMais: false, leitura: 'lida' })
  })

  it('a página de pedidos que veio cheia faz do número um piso', () => {
    const fila = dasDuas({ contagens: new Map([[TURMA_B, contagem(100, true)], [TURMA_A, contagem(0)]]) })
    expect(esperaNaTurma(fila, TURMA_B)).toEqual({ n: 100, ouMais: true, leitura: 'lida' })
    expect(esperaNaTurma(fila, TURMA_A).ouMais).toBe(false)
  })

  it('a turma não lida (pedidos com erro, não lidos ou sem leitura) nunca é "lida"; as entregas lidas pela metade tiram a leitura de todas', () => {
    const fila = dasDuas({ contagens: new Map<string, LeituraDaContagem>([[TURMA_B, { estado: 'erro', erro: new Error('x') }], [TURMA_A, { estado: 'nao-lida' }]]) })
    expect(esperaNaTurma(fila, TURMA_B).leitura).toBe('nao-lida')
    expect(esperaNaTurma(fila, TURMA_A).leitura).toBe('nao-lida')
    expect(esperaNaTurma(dasDuas({ contagens: new Map([[TURMA_B, contagem(0)]]) }), TURMA_A).leitura).toBe('nao-lida')
    expect(esperaNaTurma(dasDuas({ entregas: lida([], false) }), TURMA_B).leitura).toBe('nao-lida')
    expect(esperaNaTurma(dasDuas({ entregas: { estado: 'erro', erro: new Error('x') } }), TURMA_B).leitura).toBe('nao-lida')
    // O que está por responder é "lendo", e o número já lido continua sendo um piso.
    const lendo = dasDuas({ entregas: { estado: 'carregando' }, contagens: new Map<string, LeituraDaContagem>([[TURMA_B, contagem(3)], [TURMA_A, { estado: 'carregando' }]]) })
    expect(esperaNaTurma(lendo, TURMA_B)).toEqual({ n: 3, ouMais: true, leitura: 'lendo' })
    expect(esperaNaTurma(lendo, TURMA_A).leitura).toBe('lendo')
    // Turma que a fila não conhece (não confirmada) não é lida.
    expect(esperaNaTurma(dasDuas(), '0190f5a0-0000-7000-8000-000000009999').leitura).toBe('nao-lida')
  })

  it('a turma além do teto de 12 é não lida', () => {
    const turmas = Array.from({ length: TETO_DE_TURMAS_LIDAS + 1 }, (_, i) => ({ id: `0190f5a0-0000-7000-8000-0000000003${String(i).padStart(2, '0')}`, nome: `Turma ${String(i + 1).padStart(2, '0')}` }))
    const contagens = new Map<string, LeituraDaContagem>(turmas.slice(0, TETO_DE_TURMAS_LIDAS).map((turma) => [turma.id, contagem(0)]))
    const fila = filaDoProfessor(entrada({ vinculos: lida(turmas.map((turma, i) => vinculo(String(i).padStart(2, '0'), turma))), contagens }))
    expect(esperaNaTurma(fila, turmas[0]?.id ?? '').leitura).toBe('lida')
    expect(esperaNaTurma(fila, turmas[TETO_DE_TURMAS_LIDAS]?.id ?? '').leitura).toBe('nao-lida')
  })
})
