import { describe, expect, it } from 'vitest'
import { ENVIOS_POR_ESCOLA_NA_JANELA, ENVIOS_POR_USUARIO_NA_JANELA, MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA } from '../src/material/material.service.js'

/**
 * Os tetos de envio do material são os da Tech Spec (ingestao-do-material, seção 7c): 100 envios por hora por pessoa, 300 por escola, e 300 materiais ainda em processamento por escola. É o que deixa
 * a noite das 300 apostilas (três coordenadores, cem cada um) passar sem um 429 que não é o da proteção. Os testes de integração importam as constantes e seguiriam verdes com outro número: este
 * fixa os valores, e voltar para os 30, 60 e 3 de antes da 9.0 reprova aqui.
 */
describe('os tetos de envio do material', () => {
  it('são 100 por pessoa, 300 por escola e 300 em processamento, os da Tech Spec §7c', () => {
    expect([ENVIOS_POR_USUARIO_NA_JANELA, ENVIOS_POR_ESCOLA_NA_JANELA, MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA]).toEqual([100, 300, 300])
  })
})
