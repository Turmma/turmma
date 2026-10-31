import { describe, expect, it } from 'vitest'
import { ALREADY_REFRESHED_WINDOW_SECONDS, JANELA_DE_RENOVACAO_SIMULTANEA_MS, resultByCookie } from './renovacao.service.js'

const AGORA = new Date('2026-09-18T09:00:00-03:00')
const rotacaoHa = (ms: number) => new Date(AGORA.getTime() - ms)

describe('resultadoPeloCookie: o que a renovação faz com a sessão válida, pelo cookie que chegou', () => {
  it('cookie atual: rotaciona, apresentado ou não', () => {
    expect(resultByCookie({ pelo: 'atual', atualApresentado: false, rotacionadoEm: null, agora: AGORA })).toBe('ok')
    expect(resultByCookie({ pelo: 'atual', atualApresentado: true, rotacionadoEm: rotacaoHa(60_000), agora: AGORA })).toBe('ok')
  })

  it('anterior com o token novo nunca usado: até 2 s é a outra aba renovando junto (409); depois, resposta perdida', () => {
    const anterior = { pelo: 'anterior', atualApresentado: false, agora: AGORA } as const
    expect(resultByCookie({ ...anterior, rotacionadoEm: rotacaoHa(0) })).toBe('ja_renovado')
    // A segunda transação pode ter começado antes de a primeira gravar a rotação.
    expect(resultByCookie({ ...anterior, rotacionadoEm: rotacaoHa(-5) })).toBe('ja_renovado')
    expect(resultByCookie({ ...anterior, rotacionadoEm: rotacaoHa(JANELA_DE_RENOVACAO_SIMULTANEA_MS - 1) })).toBe('ja_renovado')
    expect(resultByCookie({ ...anterior, rotacionadoEm: rotacaoHa(JANELA_DE_RENOVACAO_SIMULTANEA_MS) })).toBe('resposta_perdida')
    expect(resultByCookie({ ...anterior, rotacionadoEm: rotacaoHa(10 * 60_000) })).toBe('resposta_perdida')
  })

  it('anterior com o token novo já usado: até 30 s é 409, e passou disso é reuso', () => {
    const anterior = { pelo: 'anterior', atualApresentado: true, agora: AGORA } as const
    expect(resultByCookie({ ...anterior, rotacionadoEm: rotacaoHa(1_000) })).toBe('ja_renovado')
    expect(resultByCookie({ ...anterior, rotacionadoEm: rotacaoHa(ALREADY_REFRESHED_WINDOW_SECONDS * 1_000) })).toBe('ja_renovado')
    expect(resultByCookie({ ...anterior, rotacionadoEm: rotacaoHa(ALREADY_REFRESHED_WINDOW_SECONDS * 1_000 + 1) })).toBe('reuso')
    expect(resultByCookie({ ...anterior, rotacionadoEm: rotacaoHa(31_000) })).toBe('reuso')
  })
})
