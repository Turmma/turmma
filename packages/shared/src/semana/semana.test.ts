import { describe, expect, it } from 'vitest'
import { ESTADOS_DE_ITEM_DO_DIA, gravarAulaRequestSchema, rotuloDoItem, ROTULOS_DA_SEMANA, semanaQuerySchema, TIPOS_DE_ITEM_DO_DIA } from './semana.js'

describe('o contrato da Semana do professor (F2b, tarefa 2.0)', () => {
  it('G7: a consulta só aceita uma segunda-feira, sem campo a mais', () => {
    expect(semanaQuerySchema.safeParse({ segunda: '2026-11-02' }).success).toBe(true)
    // terça, domingo e a segunda da semana seguinte ao domingo: só a segunda passa
    expect(semanaQuerySchema.safeParse({ segunda: '2026-11-03' }).success).toBe(false)
    expect(semanaQuerySchema.safeParse({ segunda: '2026-11-08' }).success).toBe(false)
    expect(semanaQuerySchema.safeParse({ segunda: '2026-11-09' }).success).toBe(true)
    expect(semanaQuerySchema.safeParse({ segunda: '2026-02-30' }).success).toBe(false)
    expect(semanaQuerySchema.safeParse({}).success).toBe(false)
    expect(semanaQuerySchema.safeParse({ segunda: '2026-11-02', escolaId: '7' }).success).toBe(false)
  })

  it('G7: o corpo da gravação recusa campo a mais e texto acima de 500; apara antes de contar', () => {
    const base = { vinculoId: '0199b0a0-0000-7000-8000-000000000001', data: '2026-11-03', inicio: '07:30', texto: 'frações' }
    expect(gravarAulaRequestSchema.safeParse(base).success).toBe(true)
    expect(gravarAulaRequestSchema.safeParse({ ...base, escolaId: '7' }).success).toBe(false)
    expect(gravarAulaRequestSchema.safeParse({ ...base, texto: 'a'.repeat(501) }).success).toBe(false)
    const quinhentos = gravarAulaRequestSchema.safeParse({ ...base, texto: `  ${'a'.repeat(500)}  ` })
    expect(quinhentos.success && quinhentos.data.texto.length).toBe(500)
    expect(gravarAulaRequestSchema.safeParse({ ...base, inicio: '7h30' }).success).toBe(false)
  })

  it('S15: todo tipo e todo estado de item tem rótulo em português numa tabela só, e o rótulo do item junta os dois', () => {
    expect(Object.keys(ROTULOS_DA_SEMANA.item).sort()).toEqual([...TIPOS_DE_ITEM_DO_DIA].sort())
    expect(Object.keys(ROTULOS_DA_SEMANA.estado).sort()).toEqual([...ESTADOS_DE_ITEM_DO_DIA].sort())
    expect(rotuloDoItem({ tipo: 'aplicada' })).toBe('Atividade aplicada')
    expect(rotuloDoItem({ tipo: 'encerrada' })).toBe('Atividade encerrada')
    expect(rotuloDoItem({ tipo: 'correcao', estado: 'pendente' })).toBe('Correção do Assistente · Para revisar')
    expect(rotuloDoItem({ tipo: 'correcao', estado: 'aprovada' })).toBe('Correção do Assistente · Aprovada')
    expect(rotuloDoItem({ tipo: 'correcao', estado: 'rejeitada' })).toBe('Correção do Assistente · Rejeitada')
  })
})
