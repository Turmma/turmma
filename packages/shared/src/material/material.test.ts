import { describe, expect, it } from 'vitest'
import { MENSAGENS_DE_ERRO } from '../errors/messages.js'
import {
  atualizarMaterialRequestSchema,
  buscaDeMaterialQuerySchema,
  materialSchema,
  enviarEdicaoRequestSchema,
  enviarMaterialRequestSchema,
  buscaDeMaterialResponseSchema,
  DIAS_DAS_RECUSAS_NO_RESUMO,
  LICENCAS_DE_MATERIAL,
  MAXIMO_DE_BYTES_DO_MATERIAL,
  MAXIMO_DE_PDFS_POR_LOTE,
  MAXIMO_DE_SERIES_DO_MATERIAL,
  materiaisQuerySchema,
  motivoDaRecusaDoMaterial,
  MOTIVOS_DA_RECUSA_QUE_O_RESUMO_CONTA,
  resumoDoMaterialResponseSchema,
  SEM_LICENCA,
  TAMANHO_MAXIMO_DA_EDICAO,
} from './material.js'

// Valores fixos e sintéticos: o pacote não tem os tipos do Node.
const UM_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'
const OUTRO_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c'
const AGORA = '2026-10-04T13:00:00.000Z'

describe('envio de material (D5, D75): sem licença ou sem declaração, é recusado antes de abrir o arquivo', () => {
  const pedido = { titulo: 'Química 2, cap. 7', disciplinaId: UM_ID, serieIds: [UM_ID], titularidade: 'escola', licenca: 'autoria_da_escola', declaracao: 'true' }

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

  it('a licença registrada existe só, e sempre, no material de terceiro; o licenciante não vem do cliente; escola e quem envia também não', () => {
    const deTerceiro = { ...pedido, titularidade: 'terceiro_com_licenca', licenca: 'licenca_comercial_autorizada' }
    // Sem `licencaId` o schema deixa passar, e a regra recusa com registro (`sem_licenca`): a recusa precisa deixar rastro.
    const semRegistro = enviarMaterialRequestSchema.parse(deTerceiro)
    expect(motivoDaRecusaDoMaterial({ licenca: semRegistro.licenca, declaracao: semRegistro.declaracao, titularidade: semRegistro.titularidade, licencaId: semRegistro.licencaId })).toBe('sem_licenca')
    const comRegistro = enviarMaterialRequestSchema.parse({ ...deTerceiro, licencaId: OUTRO_ID })
    expect(motivoDaRecusaDoMaterial({ licenca: comRegistro.licenca, declaracao: comRegistro.declaracao, titularidade: comRegistro.titularidade, licencaId: comRegistro.licencaId })).toBeNull()
    expect(enviarMaterialRequestSchema.safeParse({ ...pedido, licencaId: OUTRO_ID }).success).toBe(false)
    expect(enviarMaterialRequestSchema.safeParse({ ...deTerceiro, licencaId: 'não é id' }).success).toBe(false)
    for (const campo of [{ licenciante: 'Editora Sintética' }, { escolaId: UM_ID }, { enviadoPor: UM_ID }, { estado: 'pronto' }]) {
      expect(enviarMaterialRequestSchema.safeParse({ ...deTerceiro, licencaId: OUTRO_ID, ...campo }).success, Object.keys(campo)[0]).toBe(false)
    }
    expect(MAXIMO_DE_BYTES_DO_MATERIAL).toBe(20 * 1024 * 1024)
  })

  it('as séries: de 1 a 7, sem repetir; um valor só do multipart vira lista de um; sem série, vazia, repetida (também em maiúscula) ou a oitava é entrada inválida', () => {
    expect(MAXIMO_DE_SERIES_DO_MATERIAL).toBe(7)
    expect(MAXIMO_DE_PDFS_POR_LOTE).toBe(20)
    const outras = Array.from({ length: 7 }, (_, indice) => `0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a${String(indice).padStart(2, '0')}`)
    expect(enviarMaterialRequestSchema.parse({ ...pedido, serieIds: UM_ID }).serieIds).toEqual([UM_ID])
    expect(enviarMaterialRequestSchema.parse({ ...pedido, serieIds: outras }).serieIds).toEqual(outras)
    const invalidas: unknown[] = [undefined, [], [...outras, UM_ID], [UM_ID, UM_ID], [UM_ID, UM_ID.toUpperCase()], ['não é id'], [UM_ID, 'x']]
    for (const serieIds of invalidas) expect(enviarMaterialRequestSchema.safeParse({ ...pedido, serieIds }).success, JSON.stringify(serieIds)).toBe(false)
    expect(materiaisQuerySchema.safeParse({ serieId: UM_ID }).success).toBe(true)
    expect(materiaisQuerySchema.safeParse({ serieId: 'x' }).success).toBe(false)
  })

  it('o material devolvido não traz o texto, o resumo do arquivo nem quem enviou; a busca devolve página e um trecho curto', () => {
    const material = { id: UM_ID, titulo: 'Química 2, cap. 7', disciplinaId: OUTRO_ID, titularidade: 'escola', licenciante: null, licencaId: null, licenca: 'autoria_da_escola', serieIds: [UM_ID], edicao: null, substitui: null, estado: 'pronto', falha: null, paginas: 6, trechos: 6, enviadoEm: AGORA }
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

describe('edição do material (8.0): só o rótulo e o título vêm do pedido, o resto é herdado do alvo', () => {
  it('o pedido pode vir vazio; o rótulo e o título são aparados, e o rótulo tem no máximo 60 caracteres', () => {
    expect(TAMANHO_MAXIMO_DA_EDICAO).toBe(60)
    expect(enviarEdicaoRequestSchema.parse({})).toEqual({})
    expect(enviarEdicaoRequestSchema.parse({ edicao: '  2ª edição  ', titulo: '  Química 2  ' })).toEqual({ edicao: '2ª edição', titulo: 'Química 2' })
    for (const pedido of [{ edicao: '   ' }, { edicao: 'x'.repeat(61) }, { titulo: '' }, { titulo: 'x'.repeat(161) }]) expect(enviarEdicaoRequestSchema.safeParse(pedido).success, JSON.stringify(pedido)).toBe(false)
    expect(enviarEdicaoRequestSchema.safeParse({ edicao: 'x'.repeat(60) }).success).toBe(true)
  })

  it('o pedido não escolhe o que a edição herda: disciplina, séries, titularidade, licença, licenciante, declaração e escola são recusados', () => {
    for (const campo of [{ disciplinaId: UM_ID }, { serieIds: [UM_ID] }, { titularidade: 'escola' }, { licenca: 'licenca_aberta' }, { licencaId: UM_ID }, { licenciante: 'Editora' }, { declaracao: 'true' }, { escolaId: UM_ID }]) {
      expect(enviarEdicaoRequestSchema.safeParse(campo).success, Object.keys(campo)[0]).toBe(false)
    }
  })

  it('o material devolvido leva o rótulo e a referência da edição, ambos anuláveis, e o rótulo vazio ou longo demais não passa', () => {
    const material = { id: UM_ID, titulo: 'Química 2, cap. 7', disciplinaId: OUTRO_ID, titularidade: 'escola', licenciante: null, licencaId: null, licenca: 'autoria_da_escola', serieIds: [UM_ID], estado: 'pronto', falha: null, paginas: 6, trechos: 6, enviadoEm: AGORA }
    expect(materialSchema.safeParse({ ...material, edicao: null, substitui: null }).success).toBe(true)
    expect(materialSchema.safeParse({ ...material, edicao: '2ª edição', substitui: OUTRO_ID }).success).toBe(true)
    // Sem os dois campos, a resposta não é do contrato: a tela precisa de `edicao` e `substitui`, mesmo nulos.
    expect(materialSchema.safeParse(material).success).toBe(false)
    for (const campo of [{ edicao: '' }, { edicao: 'x'.repeat(61) }, { substitui: 'não é id' }]) expect(materialSchema.safeParse({ ...material, edicao: null, substitui: null, ...campo }).success, JSON.stringify(campo)).toBe(false)
  })
})

describe('o resumo do material (ingestao-do-material, 11.0; RF18): só ids e contagens', () => {
  const linha = { disciplinaId: UM_ID, serieId: OUTRO_ID, pronto: 2, processando: 1, falhou: 0, recusados30Dias: 3 }

  it('a linha de uma série e a sem série, de serieId nulo, passam, com o total dos sem série', () => {
    expect(resumoDoMaterialResponseSchema.safeParse({ linhas: [linha, { ...linha, serieId: null }], semSerie: 4 }).success).toBe(true)
    expect(resumoDoMaterialResponseSchema.safeParse({ linhas: [], semSerie: 0 }).success).toBe(true)
  })

  it('campo a mais, na linha ou na resposta, não passa: o resumo não leva título, licenciante nem autor', () => {
    expect(resumoDoMaterialResponseSchema.safeParse({ linhas: [{ ...linha, titulo: 'Apostila' }], semSerie: 0 }).success).toBe(false)
    expect(resumoDoMaterialResponseSchema.safeParse({ linhas: [linha], semSerie: 0, licenciante: 'Editora' }).success).toBe(false)
  })

  it('a contagem negativa ou fracionária não passa, em cada campo', () => {
    for (const campo of ['pronto', 'processando', 'falhou', 'recusados30Dias'] as const) {
      for (const valor of [-1, 1.5]) expect(resumoDoMaterialResponseSchema.safeParse({ linhas: [{ ...linha, [campo]: valor }], semSerie: 0 }).success, `${campo} ${String(valor)}`).toBe(false)
    }
    for (const valor of [-1, 1.5]) expect(resumoDoMaterialResponseSchema.safeParse({ linhas: [], semSerie: valor }).success, `semSerie ${String(valor)}`).toBe(false)
  })

  it('a disciplina e a série são ids, e a série é o único campo que pode ser nulo', () => {
    expect(resumoDoMaterialResponseSchema.safeParse({ linhas: [{ ...linha, disciplinaId: 'Química' }], semSerie: 0 }).success).toBe(false)
    expect(resumoDoMaterialResponseSchema.safeParse({ linhas: [{ ...linha, disciplinaId: null }], semSerie: 0 }).success).toBe(false)
    expect(resumoDoMaterialResponseSchema.safeParse({ linhas: [{ ...linha, serieId: '6º ano' }], semSerie: 0 }).success).toBe(false)
  })

  it('a janela é de 30 dias e os motivos são os três que a API responde como licença; a licença inexistente fica de fora', () => {
    expect(DIAS_DAS_RECUSAS_NO_RESUMO).toBe(30)
    expect([...MOTIVOS_DA_RECUSA_QUE_O_RESUMO_CONTA].sort()).toEqual(['licenca_vencida', 'sem_declaracao', 'sem_licenca'])
  })
})

describe('correção do material (12.0): `PATCH` com o título e as séries, e pelo menos um dos dois', () => {
  const OUTRO_ID = '0190c7e2-0000-7000-8000-000000000001'

  it('o título é aparado; as séries são de 1 a 7, e o pedido pode levar só um dos campos', () => {
    expect(atualizarMaterialRequestSchema.parse({ titulo: '  Química 2  ' })).toEqual({ titulo: 'Química 2' })
    expect(atualizarMaterialRequestSchema.parse({ serieIds: [UM_ID] })).toEqual({ serieIds: [UM_ID] })
    expect(atualizarMaterialRequestSchema.parse({ titulo: 'Química', serieIds: [UM_ID, OUTRO_ID] }).serieIds).toEqual([UM_ID, OUTRO_ID])
  })

  it('o pedido vazio, as séries vazias ou repetidas, o título vazio ou longo demais e o campo a mais são recusados', () => {
    const recusados = [{}, { serieIds: [] }, { serieIds: [UM_ID, UM_ID] }, { serieIds: [UM_ID, UM_ID.toUpperCase()] }, { titulo: '   ' }, { titulo: 'x'.repeat(161) }, { serieIds: Array.from({ length: 8 }, (_, n) => `0190c7e2-0000-7000-8000-00000000010${String(n)}`) }]
    for (const pedido of recusados) expect(atualizarMaterialRequestSchema.safeParse(pedido).success, JSON.stringify(pedido)).toBe(false)
    // O que não é título nem série não se altera por aqui.
    for (const campo of [{ disciplinaId: UM_ID }, { titularidade: 'escola' }, { licenca: 'licenca_aberta' }, { licenciante: 'Editora' }, { escolaId: UM_ID }, { estado: 'pronto' }]) {
      expect(atualizarMaterialRequestSchema.safeParse({ titulo: 'Química', ...campo }).success, Object.keys(campo)[0]).toBe(false)
    }
  })
})
