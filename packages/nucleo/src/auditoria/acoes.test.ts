import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { InvariantException } from '@educa/shared'
import { ACOES_DE_AUDITORIA, CAMPOS_PROIBIDOS_NA_AUDITORIA, exigirMapaDeAcoesValido, MapaDeAuditoriaInvalido, problemasDoMapaDeAcoes, type DefinicaoDeAcao } from './acoes.js'

const acaoCom = (depois: z.ZodObject): Record<string, DefinicaoDeAcao> => ({ 'teste.acao': { entidade: 'teste', antes: null, depois, finalidade: null } })

describe('mapa de ações da auditoria', () => {
  it('o mapa real passa na conferência: nenhum nome proibido, todo objeto estrito, só tipos de id, estado ou data', () => {
    expect(Object.keys(ACOES_DE_AUDITORIA).length).toBeGreaterThan(0)
    expect(problemasDoMapaDeAcoes(ACOES_DE_AUDITORIA)).toEqual([])
  })

  it('o mapa com problema é recusado com um ErroDeInvariante de mensagem fixa e os caminhos num campo; o mapa real passa', () => {
    const mapa: Record<string, DefinicaoDeAcao> = { 'teste.frouxo': { entidade: 'teste', antes: null, depois: z.object({ turmaId: z.uuid() }), finalidade: null } }

    const recusa = (() => {
      try {
        exigirMapaDeAcoesValido(mapa)
      } catch (erro) {
        return erro
      }
      return undefined
    })()

    expect(recusa).toBeInstanceOf(MapaDeAuditoriaInvalido)
    expect(recusa).toBeInstanceOf(InvariantException)
    expect(recusa).toMatchObject({ name: 'MapaDeAuditoriaInvalido', message: 'mapa de auditoria inválido', problemas: ['teste.frouxo.depois: objeto não estrito'] })
    expect(() => exigirMapaDeAcoesValido(ACOES_DE_AUDITORIA)).not.toThrow()
  })

  it('a lista proibida é a da Tech Spec, seção 3, mais senha', () => {
    expect([...CAMPOS_PROIBIDOS_NA_AUDITORIA].sort()).toEqual(['complemento', 'email', 'hash', 'matricula', 'nome', 'segredo', 'senha'])
  })

  it.each(CAMPOS_PROIBIDOS_NA_AUDITORIA)('a conferência acha "%s" como campo, como parte do nome e dentro de objeto aninhado', (proibido) => {
    const comMaiuscula = `${proibido[0]?.toUpperCase() ?? ''}${proibido.slice(1)}`
    const mapa: Record<string, DefinicaoDeAcao> = {
      'teste.direto': { entidade: 'teste', antes: null, depois: z.strictObject({ [proibido]: z.uuid() }), finalidade: null },
      'teste.composto': { entidade: 'teste', antes: z.strictObject({ [`aluno${comMaiuscula}`]: z.uuid().optional() }), depois: null, finalidade: null },
      'teste.aninhado': {
        entidade: 'teste',
        antes: null,
        depois: z.strictObject({ itens: z.array(z.strictObject({ turmaId: z.uuid(), [proibido]: z.boolean().nullable() })) }),
        finalidade: null,
      },
    }
    expect(problemasDoMapaDeAcoes(mapa)).toEqual([
      `teste.direto.depois.${proibido}: nome proibido`,
      `teste.composto.antes.aluno${comMaiuscula}: nome proibido`,
      `teste.aninhado.depois.itens.${proibido}: nome proibido`,
    ])
  })

  it('objeto que não é estrito é apontado: campo fora da lista seria descartado em silêncio, e não recusado', () => {
    const mapa: Record<string, DefinicaoDeAcao> = {
      'teste.frouxo': { entidade: 'teste', antes: null, depois: z.object({ turmaId: z.uuid() }), finalidade: null },
      'teste.aninhado': { entidade: 'teste', antes: null, depois: z.strictObject({ vinculo: z.looseObject({ estado: z.enum(['pendente']) }).optional() }), finalidade: null },
    }
    expect(problemasDoMapaDeAcoes(mapa)).toEqual(['teste.frouxo.depois: objeto não estrito', 'teste.aninhado.depois.vinculo: objeto não estrito'])
  })

  // Cada um aceitaria `{ dados: { nome: 'Enzo Martins' } }` ou texto livre sem nenhum campo proibido declarado.
  it.each([
    ['record', z.record(z.string(), z.uuid()), 'tipo não permitido (record)'],
    ['unknown', z.unknown(), 'tipo não permitido (unknown)'],
    ['any', z.any(), 'tipo não permitido (any)'],
    ['union com objeto', z.union([z.strictObject({ turmaId: z.uuid() }), z.null()]), 'tipo não permitido (union)'],
    ['default sobre objeto', z.strictObject({ turmaId: z.uuid() }).default({ turmaId: '0190f5a0-0000-7000-8000-00000000000a' }), 'tipo não permitido (default)'],
    ['readonly', z.strictObject({ turmaId: z.uuid() }).readonly(), 'tipo não permitido (readonly)'],
    ['lazy', z.lazy(() => z.uuid()), 'tipo não permitido (lazy)'],
    ['tuple', z.tuple([z.uuid()]), 'tipo não permitido (tuple)'],
    ['intersection', z.intersection(z.strictObject({ a: z.uuid() }), z.strictObject({ b: z.uuid() })), 'tipo não permitido (intersection)'],
    ['map', z.map(z.string(), z.uuid()), 'tipo não permitido (map)'],
    ['transform', z.uuid().transform((valor) => valor), 'tipo não permitido (pipe)'],
    ['texto sem formato', z.string(), 'texto sem formato de id ou data'],
    ['texto com regex', z.string().regex(/^[a-z]+$/), 'texto sem formato de id ou data'],
    ['texto e-mail', z.email(), 'texto sem formato de id ou data'],
    ['uuid com overwrite', z.uuid().overwrite(() => 'Enzo Martins'), 'texto sem formato de id ou data'],
    ['uuid com trim', z.uuid().trim(), 'texto sem formato de id ou data'],
    ['uuid com refine', z.uuid().refine(() => true), 'texto sem formato de id ou data'],
    ['formato próprio com nome de uuid', z.stringFormat('uuid', () => true), 'texto sem formato de id ou data'],
  ])('%s é recusado em qualquer profundidade, com o caminho', (_caso, esquema, problema) => {
    expect(problemasDoMapaDeAcoes(acaoCom(z.strictObject({ dados: esquema })))).toEqual([`teste.acao.depois.dados: ${problema}`])
    expect(problemasDoMapaDeAcoes(acaoCom(z.strictObject({ lista: z.array(z.strictObject({ dados: esquema.optional() })) })))).toEqual([
      `teste.acao.depois.lista.dados: ${problema}`,
    ])
  })

  it('os tipos que guardam id, estado, código, número ou data passam', () => {
    const esquema = z.strictObject({
      turmaId: z.uuid(),
      estado: z.enum(['pendente', 'confirmado']),
      versao: z.literal(1),
      ativo: z.boolean(),
      tentativas: z.int(),
      decididoEm: z.iso.datetime().nullable(),
      dia: z.iso.date().optional(),
      disciplinas: z.array(z.uuid()),
    })
    expect(problemasDoMapaDeAcoes(acaoCom(esquema))).toEqual([])
  })

  it('acesso_turma.gerado aceita só a validade de 1, 7 ou 30 dias, como o check do banco (A1, 4.0)', () => {
    const depois = ACOES_DE_AUDITORIA['acesso_turma.gerado'].depois
    const base = { turmaId: '0190c7e2-0000-7000-8000-000000000000', expiraEm: '2026-09-26T12:00:00.000Z', substituidos: [] }
    for (const validadeDias of [1, 7, 30]) expect(depois.safeParse({ ...base, validadeDias }).success, String(validadeDias)).toBe(true)
    for (const validadeDias of [0, 2, 31]) expect(depois.safeParse({ ...base, validadeDias }).success, String(validadeDias)).toBe(false)
  })

  // MVP de apresentação (D77): o que a fatia audita (regra 20, item 10; regra 70, item 6).
  const UM_ID = '0190c7e2-0000-7000-8000-000000000000'

  it('o MVP audita material enviado, recusado e excluído, a aplicação, a decisão da entrega, o destaque aberto, o lote aprovado, a suspensão e a retomada, e as duas leituras nominais', () => {
    const acoes = Object.keys(ACOES_DE_AUDITORIA)
    for (const acao of [
      'material.enviado',
      'material.recusado',
      'material.excluido',
      'atividade.aplicada',
      'entrega.decidida',
      'correcao.destaque_aberto',
      'lote.aprovado',
      'funcao.suspensa',
      'funcao.retomada',
      'turma.desempenho_lido',
      'analista.nominal_lido',
    ]) {
      expect(acoes, acao).toContain(acao)
    }
  })

  it('a leitura nominal e a do desempenho de aluno pela coordenação só gravam com finalidade de lista fechada', () => {
    for (const acao of ['turma.desempenho_lido', 'analista.nominal_lido'] as const) {
      const { finalidade } = ACOES_DE_AUDITORIA[acao]
      expect(finalidade, acao).not.toBeNull()
      expect(finalidade.safeParse('quero ver como a professora Ana está indo').success, acao).toBe(false)
      expect(finalidade.safeParse(undefined).success, acao).toBe(false)
    }
    expect(ACOES_DE_AUDITORIA['analista.nominal_lido'].finalidade.options).toEqual(['conversa_pedagogica_a_pedido_do_professor', 'apoio_a_aluno_em_risco', 'pedido_do_titular', 'apuracao_de_denuncia'])
    // Nenhuma finalidade é de avaliar, cobrar ou decidir sobre o professor (regra 70, item 8).
    for (const finalidade of ACOES_DE_AUDITORIA['analista.nominal_lido'].finalidade.options) expect(finalidade).not.toMatch(/avalia|desempenho_do_professor|cobranca|sancao|dispensa|ranking/)
    // As ações que não são leitura de pessoa não aceitam finalidade.
    for (const acao of ['material.enviado', 'entrega.decidida', 'lote.aprovado', 'funcao.suspensa'] as const) expect(ACOES_DE_AUDITORIA[acao].finalidade, acao).toBeNull()
  })

  it('a decisão da entrega não leva a justificativa, e o material recusado leva o que foi declarado, sem título nem licenciante', () => {
    const decidida = ACOES_DE_AUDITORIA['entrega.decidida'].depois
    const base = { tipo: 'versao_adaptada', funcao: 'adaptacao', turmaId: UM_ID, estado: 'rejeitada', artefatoId: UM_ID, atividadeAplicadaId: null }
    expect(decidida.safeParse(base).success).toBe(true)
    expect(decidida.safeParse({ ...base, justificativa: 'O enunciado da questão 2 mudou o que é cobrado' }).success).toBe(false)
    expect(decidida.safeParse({ ...base, estado: 'pendente' }).success).toBe(false)

    const recusado = ACOES_DE_AUDITORIA['material.recusado'].depois
    const declarado = { titularidade: 'terceiro_com_licenca', licenca: 'sem_licenca', declaracao: true, motivo: 'sem_licenca' }
    expect(recusado.safeParse(declarado).success).toBe(true)
    expect(recusado.safeParse({ ...declarado, licenca: 'licenca_aberta', declaracao: false, motivo: 'sem_declaracao' }).success).toBe(true)
    for (const proibido of [{ titulo: 'Apostila Sistema X' }, { licenciante: 'Editora X' }, { arquivo: 'apostila.pdf' }]) expect(recusado.safeParse({ ...declarado, ...proibido }).success, Object.keys(proibido)[0]).toBe(false)
    // O material que entrou só é registrado com licença que permite o uso e com a declaração marcada.
    const enviado = ACOES_DE_AUDITORIA['material.enviado'].depois
    expect(enviado.safeParse({ disciplinaId: UM_ID, titularidade: 'escola', licenca: 'autoria_da_escola', declaracao: true }).success).toBe(true)
    expect(enviado.safeParse({ disciplinaId: UM_ID, titularidade: 'escola', licenca: 'sem_licenca', declaracao: true }).success).toBe(false)
    expect(enviado.safeParse({ disciplinaId: UM_ID, titularidade: 'escola', licenca: 'autoria_da_escola', declaracao: false }).success).toBe(false)
  })

  it('o lote aprovado leva a validação e as contagens, e a suspensão, a função e o motivo de lista fechada', () => {
    const lote = ACOES_DE_AUDITORIA['lote.aprovado'].depois
    const base = { estado: 'aprovada', atividadeAplicadaId: UM_ID, turmaId: UM_ID, validacaoId: UM_ID, corrigidos: 30, destaques: 3, destaquesAbertos: 3 }
    expect(lote.safeParse(base).success).toBe(true)
    // Sem o registro da validação não há o que auditar: a aprovação do lote é sempre com ela (D56).
    expect(lote.safeParse({ ...base, validacaoId: undefined }).success).toBe(false)
    expect(lote.safeParse({ ...base, nota: 7.5 }).success).toBe(false)

    const suspensa = ACOES_DE_AUDITORIA['funcao.suspensa'].depois
    expect(suspensa.safeParse({ funcao: 'correcao_de_objetiva', motivo: null }).success).toBe(true)
    expect(suspensa.safeParse({ funcao: 'correcao_de_objetiva', motivo: 'incidente' }).success).toBe(true)
    expect(suspensa.safeParse({ funcao: 'correcao_de_objetiva', motivo: 'a professora Ana reclamou' }).success).toBe(false)
    expect(suspensa.safeParse({ funcao: 'corretor', motivo: null }).success).toBe(false)
  })

  it('finalidade só como enum: texto livre é recusado', () => {
    const mapa = {
      'teste.livre': { entidade: 'teste', antes: null, depois: null, finalidade: z.string().max(200) },
      'teste.codigo': { entidade: 'teste', antes: null, depois: null, finalidade: z.enum(['conferir_turma']) },
    } as unknown as Record<string, DefinicaoDeAcao>
    expect(problemasDoMapaDeAcoes(mapa)).toEqual(['teste.livre.finalidade: precisa ser enum'])
  })
})
