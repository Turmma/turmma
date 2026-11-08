import { describe, expect, it } from 'vitest'
import { CONVITES_POR_HORA_POR_ESCOLA, enviarConvitesRequestSchema, enviarConvitesResponseSchema, MAXIMO_DE_PROFESSORES_NO_ENVIO, professorDaEscolaSchema } from './professores.js'

/** Um UUID v4 válido e distinto por número, sem depender do Node. */
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

describe('o contrato do "Enviar convites" (acesso-e-convites, 3.0)', () => {
  it('o pedido aceita todos (sem lista) ou de 1 a 1.000 ids, e nada além de `usuarioIds`', () => {
    expect(enviarConvitesRequestSchema.safeParse({}).success).toBe(true)
    expect(enviarConvitesRequestSchema.safeParse({ usuarioIds: [uuid(100_000)] }).success).toBe(true)
    const mil = Array.from({ length: MAXIMO_DE_PROFESSORES_NO_ENVIO }, (_, i) => uuid(i))
    expect(enviarConvitesRequestSchema.safeParse({ usuarioIds: mil }).success).toBe(true)
    expect(enviarConvitesRequestSchema.safeParse({ usuarioIds: [...mil, uuid(100_000)] }).success).toBe(false)
    expect(enviarConvitesRequestSchema.safeParse({ usuarioIds: [] }).success).toBe(false)
    expect(enviarConvitesRequestSchema.safeParse({ usuarioIds: ['1'] }).success).toBe(false)
    expect(enviarConvitesRequestSchema.safeParse({ escolaId: uuid(100_000) }).success).toBe(false)
  })

  it('a resposta é só a contagem: de 0 ao máximo, sem campo a mais', () => {
    expect(enviarConvitesResponseSchema.safeParse({ quantidade: 0 }).success).toBe(true)
    expect(enviarConvitesResponseSchema.safeParse({ quantidade: MAXIMO_DE_PROFESSORES_NO_ENVIO }).success).toBe(true)
    expect(enviarConvitesResponseSchema.safeParse({ quantidade: MAXIMO_DE_PROFESSORES_NO_ENVIO + 1 }).success).toBe(false)
    expect(enviarConvitesResponseSchema.safeParse({ quantidade: -1 }).success).toBe(false)
    expect(enviarConvitesResponseSchema.safeParse({ quantidade: 1, token: 'x' }).success).toBe(false)
  })

  it('a cota é de 300 por hora, e a lista sem `envio` (resposta antiga) vale `null`', () => {
    expect(CONVITES_POR_HORA_POR_ESCOLA).toBe(300)
    expect(professorDaEscolaSchema.parse({ usuarioId: uuid(100_000), nome: 'Professor sintético', estado: 'pendente' }).envio).toBeNull()
  })
})
