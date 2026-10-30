import { describe, expect, it } from 'vitest'
import { MENSAGENS_DE_ERRO } from '../errors/messages.js'
import {
  buscaDeMaterialQuerySchema,
  materialSchema,
  enviarMaterialRequestSchema,
  buscaDeMaterialResponseSchema,
  LICENCAS_DE_MATERIAL,
  MAXIMO_DE_BYTES_DO_MATERIAL,
  motivoDaRecusaDoMaterial,
  SEM_LICENCA,
} from './material.js'

// Valores fixos e sintéticos: o pacote não tem os tipos do Node.
const UM_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'
const OUTRO_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c'
const AGORA = '2026-10-04T13:00:00.000Z'

describe('envio de material (D5, D75): sem licença ou sem declaração, é recusado antes de abrir o arquivo', () => {
  const pedido = { titulo: 'Química 2, cap. 7', disciplinaId: UM_ID, titularidade: 'escola', licenca: 'autoria_da_escola', declaracao: 'true' }

  it('as quatro licenças com que um material entra, com a declaração marcada, passam', () => {
    expect(LICENCAS_DE_MATERIAL).toEqual(['dominio_publico', 'autoria_da_escola', 'licenca_aberta', 'licenca_comercial_autorizada'])
    for (const licenca of LICENCAS_DE_MATERIAL) expect(motivoDaRecusaDoMaterial({ licenca, declaracao: true }), licenca).toBeNull()
  })

  it('sem licença é recusado mesmo com a declaração marcada, e com licença mas sem a declaração também', () => {
    expect(motivoDaRecusaDoMaterial({ licenca: SEM_LICENCA, declaracao: true })).toBe('sem_licenca')
    expect(motivoDaRecusaDoMaterial({ licenca: SEM_LICENCA, declaracao: false })).toBe('sem_licenca')
    for (const licenca of LICENCAS_DE_MATERIAL) expect(motivoDaRecusaDoMaterial({ licenca, declaracao: false }), licenca).toBe('sem_declaracao')
    // A mensagem diz o que fazer, e não fala em "erro".
    expect(MENSAGENS_DE_ERRO.MATERIAL_SEM_LICENCA).toMatch(/licença/)
    expect(MENSAGENS_DE_ERRO.MATERIAL_SEM_LICENCA).toMatch(/declaração/)
  })

  it('o pedido chega do multipart com a declaração em texto, e o schema deixa passar o que a regra vai recusar, para a recusa ficar registrada', () => {
    expect(enviarMaterialRequestSchema.parse(pedido)).toEqual({ ...pedido, declaracao: true })
    const semLicenca = enviarMaterialRequestSchema.parse({ ...pedido, licenca: 'sem_licenca', declaracao: 'false' })
    expect(semLicenca.declaracao).toBe(false)
    expect(motivoDaRecusaDoMaterial(semLicenca)).toBe('sem_licenca')
    // Licença inventada não é recusa por licença: é entrada inválida.
    expect(enviarMaterialRequestSchema.safeParse({ ...pedido, licenca: 'comprei_na_banca' }).success).toBe(false)
    expect(enviarMaterialRequestSchema.safeParse({ ...pedido, declaracao: 'sim' }).success).toBe(false)
  })

  it('o licenciante existe só, e sempre, no material de terceiro; escola e quem envia não vêm do cliente', () => {
    const deTerceiro = { ...pedido, titularidade: 'terceiro_com_licenca', licenca: 'licenca_comercial_autorizada' }
    expect(enviarMaterialRequestSchema.safeParse(deTerceiro).success).toBe(false)
    expect(enviarMaterialRequestSchema.safeParse({ ...deTerceiro, licenciante: 'Editora Sintética' }).success).toBe(true)
    expect(enviarMaterialRequestSchema.safeParse({ ...pedido, licenciante: 'Editora Sintética' }).success).toBe(false)
    for (const campo of [{ escolaId: UM_ID }, { enviadoPor: UM_ID }, { estado: 'pronto' }]) expect(enviarMaterialRequestSchema.safeParse({ ...pedido, ...campo }).success, Object.keys(campo)[0]).toBe(false)
    expect(MAXIMO_DE_BYTES_DO_MATERIAL).toBe(20 * 1024 * 1024)
  })

  it('o material devolvido não traz o texto, o resumo do arquivo nem quem enviou; a busca devolve página e um trecho curto', () => {
    const material = { id: UM_ID, titulo: 'Química 2, cap. 7', disciplinaId: OUTRO_ID, titularidade: 'escola', licenciante: null, licenca: 'autoria_da_escola', estado: 'pronto', falha: null, paginas: 6, trechos: 6, enviadoEm: AGORA }
    expect(materialSchema.safeParse(material).success).toBe(true)
    for (const campo of [{ sha256: 'a'.repeat(64) }, { enviadoPor: UM_ID }, { texto: 'página inteira' }, { escolaId: UM_ID }]) expect(materialSchema.safeParse({ ...material, ...campo }).success, Object.keys(campo)[0]).toBe(false)
    // O material gravado nunca tem `sem_licenca`.
    expect(materialSchema.safeParse({ ...material, licenca: 'sem_licenca' }).success).toBe(false)

    const trecho = { materialId: UM_ID, titulo: 'Química 2, cap. 7', pagina: 151, trecho: 'O reagente limitante é o que acaba primeiro.' }
    expect(buscaDeMaterialResponseSchema.safeParse({ itens: [trecho] }).success).toBe(true)
    expect(buscaDeMaterialResponseSchema.safeParse({ itens: [{ ...trecho, trecho: 'x'.repeat(401) }] }).success).toBe(false)
    expect(buscaDeMaterialResponseSchema.safeParse({ itens: [{ ...trecho, escolaId: UM_ID }] }).success).toBe(false)
    expect(buscaDeMaterialQuerySchema.parse({ q: ' reagente limitante ' })).toEqual({ q: 'reagente limitante', limite: 8 })
    for (const consulta of [{ q: 'a' }, { q: 'reagente', escolaId: UM_ID }, { q: 'reagente', limite: '21' }, {}]) expect(buscaDeMaterialQuerySchema.safeParse(consulta).success, JSON.stringify(consulta)).toBe(false)
  })
})
