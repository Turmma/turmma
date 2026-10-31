import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { COOKIE_OIDC, CookieOidc, VALIDADE_DO_COOKIE_OIDC_SEGUNDOS, type LoginExternoEmAndamento } from './cookie-oidc.js'

const CHAVE = new Uint8Array(randomBytes(32))
const OUTRA_CHAVE = new Uint8Array(randomBytes(32))
const AGORA = Date.parse('2026-09-18T10:00:00Z')

const EM_ANDAMENTO: LoginExternoEmAndamento = {
  escolaId: '0199a0b0-0000-7000-8000-00000000000a',
  slug: 'colegio-sintetico',
  provedor: 'google',
  state: 'state-sintetico-0123456789',
  nonce: 'nonce-sintetico-0123456789',
  verificador: 'verificador-sintetico-0123456789',
}

/** O valor do cookie no `Set-Cookie`, como o navegador o devolveria. */
function valorDe(setCookie: string): string {
  return setCookie.split(';')[0]?.slice(`${COOKIE_OIDC}=`.length) ?? ''
}

function cookie(agora = AGORA, chave = CHAVE, ambiente: 'local' | 'staging' = 'local'): CookieOidc {
  return new CookieOidc(chave, ambiente, () => agora)
}

describe('cookie educa_oidc do login pela conta da escola', () => {
  it('volta o que o iniciar gravou, dentro dos 5 minutos', () => {
    const valor = valorDe(cookie().gravar(EM_ANDAMENTO))
    expect(cookie(AGORA + VALIDADE_DO_COOKIE_OIDC_SEGUNDOS * 1_000).ler(valor)).toEqual(EM_ANDAMENTO)
  })

  it('não leva nada legível: nem a escola, nem o slug, nem o state', () => {
    const texto = Buffer.from(valorDe(cookie().gravar(EM_ANDAMENTO)), 'base64url').toString('latin1')
    for (const parte of [EM_ANDAMENTO.escolaId, EM_ANDAMENTO.slug, EM_ANDAMENTO.state, EM_ANDAMENTO.verificador]) expect(texto).not.toContain(parte)
  })

  it('vencido, um instante depois dos 5 minutos, não vale, mesmo que o navegador ainda o mande', () => {
    const valor = valorDe(cookie().gravar(EM_ANDAMENTO))
    expect(cookie(AGORA + VALIDADE_DO_COOKIE_OIDC_SEGUNDOS * 1_000 + 1).ler(valor)).toBeUndefined()
  })

  it('emitido no futuro além da tolerância de relógio não vale', () => {
    const valor = valorDe(cookie(AGORA + 31_000).gravar(EM_ANDAMENTO))
    expect(cookie(AGORA).ler(valor)).toBeUndefined()
    const dentroDaTolerancia = valorDe(cookie(AGORA + 29_000).gravar(EM_ANDAMENTO))
    expect(cookie(AGORA).ler(dentroDaTolerancia)).toEqual(EM_ANDAMENTO)
  })

  it('qualquer byte alterado, em qualquer posição, não decifra', () => {
    const bytes = Buffer.from(valorDe(cookie().gravar(EM_ANDAMENTO)), 'base64url')
    for (let posicao = 0; posicao < bytes.length; posicao++) {
      const alterado = Buffer.from(bytes)
      alterado[posicao] = (alterado[posicao] ?? 0) ^ 0x01
      expect(cookie().ler(alterado.toString('base64url')), `byte ${String(posicao)}`).toBeUndefined()
    }
  })

  it('cifrado com outra chave não vale: o cookie de outra instalação não abre o login desta', () => {
    const valor = valorDe(cookie(AGORA, OUTRA_CHAVE).gravar(EM_ANDAMENTO))
    expect(cookie().ler(valor)).toBeUndefined()
  })

  it('ausente, vazio, curto ou lixo não vale', () => {
    for (const valor of [undefined, '', 'abc', Buffer.from('{"escolaId":"x"}').toString('base64url')]) expect(cookie().ler(valor)).toBeUndefined()
  })

  it('local: HttpOnly, SameSite=Lax, só em /v1/sessao/externa, 5 min, sem Secure', () => {
    const atributos = cookie().gravar(EM_ANDAMENTO).split('; ').slice(1).sort()
    expect(atributos).toEqual(['HttpOnly', 'Max-Age=300', 'Path=/v1/sessao/externa', 'SameSite=Lax'].sort())
  })

  it('fora do local, também Secure; e apagar zera o cookie no mesmo caminho', () => {
    expect(cookie(AGORA, CHAVE, 'staging').gravar(EM_ANDAMENTO).split('; ')).toContain('Secure')
    expect(cookie(AGORA, CHAVE, 'staging').apagar().split('; ').sort()).toEqual(['HttpOnly', 'Max-Age=0', 'Path=/v1/sessao/externa', 'SameSite=Lax', 'Secure', `${COOKIE_OIDC}=`].sort())
  })

  it('chave que não é de 256 bits não sobe', () => {
    expect(() => new CookieOidc(new Uint8Array(16), 'local')).toThrow()
  })
})
