import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { COOKIE_CONTA_PROVADA, COOKIE_OIDC, CookieContaProvada, CookieOidc, VALIDADE_DO_COOKIE_CONTA_PROVADA_SEGUNDOS, VALIDADE_DO_COOKIE_OIDC_SEGUNDOS, type ContaProvada, type LoginExternoEmAndamento } from './cookie-oidc.js'

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

const CONTA: ContaProvada = {
  escolaId: '0199a0b0-0000-7000-8000-00000000000a',
  acessoId: '0199a0b0-0000-7000-8000-00000000000b',
  provedor: 'microsoft',
  tenant: 'aaaaaaaa-0000-4000-8000-00000000000a',
  sujeito: '0a0a0a0a-1111-4111-8111-00000000000a',
}

function daConta(agora = AGORA, chave = CHAVE, ambiente: 'local' | 'staging' = 'local'): CookieContaProvada {
  return new CookieContaProvada(chave, ambiente, () => agora)
}

function valorDaConta(setCookie: string): string {
  return setCookie.split(';')[0]?.slice(`${COOKIE_CONTA_PROVADA}=`.length) ?? ''
}

describe('cookie educa_conta_provada da conta da escola que o aluno provou na sala (14.0)', () => {
  it('volta a conta gravada, até os 15 minutos, e vence um instante depois', () => {
    const valor = valorDaConta(daConta().gravar(CONTA))
    expect(daConta(AGORA + VALIDADE_DO_COOKIE_CONTA_PROVADA_SEGUNDOS * 1_000).ler(valor)).toEqual(CONTA)
    expect(daConta(AGORA + VALIDADE_DO_COOKIE_CONTA_PROVADA_SEGUNDOS * 1_000 + 1).ler(valor)).toBeUndefined()
  })

  it('só vai à rota da sala, HttpOnly e Lax, com 15 minutos; fora do local ganha Secure; apagar zera o Max-Age no mesmo caminho', () => {
    expect(daConta().gravar(CONTA)).toMatch(/^educa_conta_provada=[\w-]+; Path=\/v1\/salas; HttpOnly; SameSite=Lax; Max-Age=900$/)
    expect(daConta(AGORA, CHAVE, 'staging').gravar(CONTA)).toMatch(/; Secure; Max-Age=900$/)
    expect(daConta().apagar()).toBe('educa_conta_provada=; Path=/v1/salas; HttpOnly; SameSite=Lax; Max-Age=0')
  })

  it('não leva nada legível: nem a escola, nem o acesso, nem o identificador da conta', () => {
    const texto = Buffer.from(valorDaConta(daConta().gravar(CONTA)), 'base64url').toString('latin1')
    for (const parte of [CONTA.escolaId, CONTA.acessoId, CONTA.sujeito, CONTA.tenant ?? '']) expect(texto).not.toContain(parte)
  })

  it('byte alterado, outra chave, valor ausente, vazio ou sem sentido não valem', () => {
    // O byte, não o caractere: o último caractere do base64url leva bits de enchimento que o decodificador ignora, e trocá-lo
    // às vezes (1 cookie em 16, pelo IV aleatório) devolve os mesmos bytes. Vários cookies, cada um com IV novo, para o
    // resultado não depender de qual saiu.
    for (let amostra = 0; amostra < 50; amostra++) {
      const bytes = Buffer.from(valorDaConta(daConta().gravar(CONTA)), 'base64url')
      expect(daConta().ler(bytes.toString('base64url'))).toEqual(CONTA)
      for (let posicao = 0; posicao < bytes.length; posicao++) {
        const alterado = Buffer.from(bytes)
        alterado[posicao] = (alterado[posicao] ?? 0) ^ 0x01
        expect(daConta().ler(alterado.toString('base64url')), `amostra ${String(amostra)}, byte ${String(posicao)}`).toBeUndefined()
      }
    }
    const valor = valorDaConta(daConta().gravar(CONTA))
    expect(daConta(AGORA, OUTRA_CHAVE).ler(valor)).toBeUndefined()
    for (const sem of [undefined, '', 'x', 'não-é-base64!']) expect(daConta().ler(sem)).toBeUndefined()
  })

  it('cifrado pela nossa chave mas fora do formato (provedor que não existe, sujeito vazio, campo faltando) também não vale', () => {
    const forjado = (conta: object): string => valorDaConta(daConta().gravar(conta as unknown as ContaProvada))
    expect(daConta().ler(forjado(CONTA))).toEqual(CONTA)
    expect(daConta().ler(forjado({ ...CONTA, provedor: 'facebook' }))).toBeUndefined()
    expect(daConta().ler(forjado({ ...CONTA, sujeito: '' }))).toBeUndefined()
    expect(daConta().ler(forjado({ escolaId: CONTA.escolaId }))).toBeUndefined()
  })

  it('o do educa_oidc não vale como o da conta, nem o da conta como o do login, mesmo com a mesma chave (dado autenticado próprio)', () => {
    const doLogin = valorDe(cookie().gravar(EM_ANDAMENTO))
    const daProva = valorDaConta(daConta().gravar(CONTA))
    expect(daConta().ler(doLogin)).toBeUndefined()
    expect(cookie().ler(daProva)).toBeUndefined()
  })

  it('emitido no futuro além da tolerância de relógio não vale; chave que não tem 256 bits é recusada', () => {
    expect(daConta().ler(valorDaConta(daConta(AGORA + 31_000).gravar(CONTA)))).toBeUndefined()
    expect(daConta().ler(valorDaConta(daConta(AGORA + 29_000).gravar(CONTA)))).toEqual(CONTA)
    expect(() => new CookieContaProvada(new Uint8Array(16), 'local')).toThrow('256 bits')
  })
})
