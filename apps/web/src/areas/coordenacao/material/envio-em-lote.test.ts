import { ErrorCode, type Material } from '@educa/shared'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import type { CamposDoEnvioDeMaterial } from './api/material'
import { enviarOLote } from './envio-em-lote'
import type { ItemDoLote } from './material-envio'

/** O laço do envio em lote (ingestao-do-material, 7.0; RF14), sem React: um por vez, o que falha não derruba os outros, e o que vale para o lote todo o para. */

const CAMPOS: CamposDoEnvioDeMaterial = { titulo: 'x', disciplinaId: 'd', serieIds: ['s'], titularidade: 'escola', licenca: 'autoria_da_escola', declaracao: true }
const MATERIAL = {} as Material
const itens = (quantos: number): ItemDoLote[] => Array.from({ length: quantos }, (_, indice) => ({ chave: indice + 1, arquivo: new File(['%PDF-1.7'], `a${String(indice + 1)}.pdf`), titulo: `T${String(indice + 1)}`, situacao: 'pendente' }))

function rodar(lista: ItemDoLote[], resposta: (indice: number) => Promise<Material>, extra: { cancelado?: () => boolean; camposDe?: (item: ItemDoLote) => CamposDoEnvioDeMaterial | undefined } = {}) {
  const situacoes = new Map<number, string>()
  const textos = new Map<number, string | undefined>()
  const emAndamento = { agora: 0, maximo: 0 }
  let chamadas = 0
  const resultado = enviarOLote({
    itens: lista,
    camposDe: extra.camposDe ?? (() => CAMPOS),
    enviar: async () => {
      emAndamento.agora += 1
      emAndamento.maximo = Math.max(emAndamento.maximo, emAndamento.agora)
      const indice = chamadas
      chamadas += 1
      try {
        return await resposta(indice)
      } finally {
        emAndamento.agora -= 1
      }
    },
    aoMudar: (chave, parte) => {
      if (parte.situacao !== undefined) situacoes.set(chave, parte.situacao)
      if (parte.texto !== undefined) textos.set(chave, parte.texto)
    },
    aoEnviar: () => undefined,
    cancelado: extra.cancelado ?? (() => false),
  })
  return { resultado, situacoes, textos, emAndamento, chamadas: () => chamadas }
}

describe('enviarOLote', () => {
  it('20 arquivos, um inválido e um repetido: 18 prontos, uma falha, um "já enviado", um por vez', async () => {
    const lista = itens(20)
    const r = rodar(lista, async (indice) => {
      if (indice === 4) throw new ApiError(ErrorCode.ENTRADA_INVALIDA)
      if (indice === 9) throw new ApiError(ErrorCode.CONFLITO)
      return MATERIAL
    })
    expect(await r.resultado).toBeUndefined()
    const valores = [...r.situacoes.values()]
    expect(valores.filter((situacao) => situacao === 'enviado')).toHaveLength(18)
    expect(valores.filter((situacao) => situacao === 'falhou')).toHaveLength(1)
    expect(valores.filter((situacao) => situacao === 'ja_enviado')).toHaveLength(1)
    expect(r.textos.get(5)).toContain('não é um PDF')
    expect(r.chamadas()).toBe(20)
    // Um por vez: nunca dois pedidos no ar.
    expect(r.emAndamento.maximo).toBe(1)
  })

  it('o 429 no meio para o lote: o arquivo e os que faltam ficam pendentes, e a espera da API vai junto', async () => {
    const r = rodar(itens(20), async (indice) => {
      if (indice === 12) throw new ApiError(ErrorCode.LIMITE_EXCEDIDO, 1800)
      return MATERIAL
    })
    expect(await r.resultado).toEqual({ tipo: 'limite', esperaSegundos: 1800 })
    expect([...r.situacoes.values()].filter((situacao) => situacao === 'enviado')).toHaveLength(12)
    expect(r.situacoes.get(13)).toBe('pendente')
    expect(r.situacoes.has(14)).toBe(false)
    expect(r.chamadas()).toBe(13)
  })

  it.each([
    [ErrorCode.LICENCA_VENCIDA, 'licenca_vencida'],
    [ErrorCode.NAO_ENCONTRADO, 'nao_encontrado'],
    [ErrorCode.MATERIAL_SEM_LICENCA, 'recusa'],
    [ErrorCode.NAO_AUTENTICADO, 'sessao'],
  ] as const)('%s para o lote, sem gastar os outros arquivos', async (codigo, tipo) => {
    const r = rodar(itens(3), async () => {
      throw new ApiError(codigo)
    })
    expect(await r.resultado).toEqual({ tipo })
    expect(r.chamadas()).toBe(1)
    expect(r.situacoes.get(1)).toBe('pendente')
  })

  it('a falha do storage não derruba os outros, e diz o que fazer', async () => {
    const r = rodar(itens(2), async (indice) => {
      if (indice === 0) throw new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
      return MATERIAL
    })
    expect(await r.resultado).toBeUndefined()
    expect(r.situacoes.get(1)).toBe('falhou')
    expect(r.textos.get(1)).toBe('O envio não foi concluído. Tente de novo em instantes.')
    expect(r.situacoes.get(2)).toBe('enviado')
  })

  it('quem fecha o diálogo deixa de enviar os arquivos seguintes, depois do que está no ar', async () => {
    let fechou = false
    const enviar = vi.fn(async () => MATERIAL)
    const r = rodar(itens(5), async (indice) => {
      if (indice === 1) fechou = true
      return enviar()
    }, { cancelado: () => fechou })
    expect(await r.resultado).toEqual({ tipo: 'cancelado' })
    expect(r.chamadas()).toBe(2)
  })

  it('o que fecha o diálogo durante o último arquivo também é cancelado, e não "terminou"', async () => {
    let fechou = false
    const r = rodar(itens(1), async () => {
      fechou = true
      return MATERIAL
    }, { cancelado: () => fechou })
    expect(await r.resultado).toEqual({ tipo: 'cancelado' })
    expect(r.situacoes.get(1)).toBe('enviado')
  })

  it('o arquivo sem pedido válido é pulado: não vai à API e não muda de situação', async () => {
    const r = rodar(itens(3), async () => MATERIAL, { camposDe: (item) => (item.chave === 2 ? undefined : CAMPOS) })
    expect(await r.resultado).toBeUndefined()
    expect(r.chamadas()).toBe(2)
    expect(r.situacoes.has(2)).toBe(false)
    expect(r.situacoes.get(3)).toBe('enviado')
  })

  it('a falha que não é da API (a rede caiu, ou a promessa foi recusada sem motivo) é falha do arquivo, e o lote segue', async () => {
    const r = rodar(itens(3), async (indice) => {
      if (indice === 0) throw new TypeError('Failed to fetch')
      if (indice === 1) return Promise.reject(undefined)
      return MATERIAL
    })
    expect(await r.resultado).toBeUndefined()
    expect(r.situacoes.get(1)).toBe('falhou')
    expect(r.situacoes.get(2)).toBe('falhou')
    expect(r.situacoes.get(3)).toBe('enviado')
  })
})
