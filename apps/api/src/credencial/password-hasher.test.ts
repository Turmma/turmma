import { verify } from '@node-rs/argon2'
import { describe, expect, it, vi } from 'vitest'
import { PasswordHasher } from './password-hasher.js'

// O argon2 de verdade, com um espião por cima: o teste conta as verificações sem trocar o hash.
vi.mock('@node-rs/argon2', async (original) => {
  const real = await original<typeof import('@node-rs/argon2')>()
  return { ...real, verify: vi.fn(real.verify) }
})

const OWASP = { memoriaKib: 19_456, iteracoes: 2 }

describe('HashDeSenha', () => {
  it('gera argon2id com um fio e os parâmetros da configuração, e confere a senha certa', async () => {
    const hash = await PasswordHasher.criar(OWASP)
    const guardado = await hash.gerar('senha-sintetica-1')
    expect(guardado).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    expect(await hash.verificar(guardado, 'senha-sintetica-1')).toBe(true)
    expect(await hash.verificar(guardado, 'senha-sintetica-2')).toBe(false)
  })

  it('privacidade: sem hash guardado (e-mail inexistente, conta sem senha) roda o argon2 contra o hash fixo, e nunca confere', async () => {
    const verificar = vi.mocked(verify)
    const hash = await PasswordHasher.criar(OWASP)
    verificar.mockClear()
    expect(await hash.verificar(undefined, 'qualquer')).toBe(false)
    expect(await hash.verificar(null, 'qualquer')).toBe(false)
    expect(verificar).toHaveBeenCalledTimes(2)
    const [alvo] = verificar.mock.calls[0] ?? []
    expect(String(alvo)).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
  })

  it('hash guardado quebrado conta como senha errada, e não derruba o login', async () => {
    const hash = await PasswordHasher.criar(OWASP)
    expect(await hash.verificar('isto-nao-e-hash', 'qualquer')).toBe(false)
  })
})
