import { hash, verify, type Algorithm } from '@node-rs/argon2'
import { randomBytes } from 'node:crypto'
import type { HashParams } from './login-config.js'

/**
 * O hash de senha da equipe (Tech Spec, seção 5, "Hash"): argon2id, p=1, com memória e iterações da configuração,
 * nunca abaixo da OWASP.
 *
 * Toda verificação custa um hash, exista a conta ou não: sem hash guardado (e-mail que não existe, conta que ainda não
 * tem senha), a senha é conferida contra um hash fixo, gerado no boot com os mesmos parâmetros, e o resultado é
 * sempre `false`. Assim senha errada e e-mail inexistente levam o mesmo tempo e respondem igual (RF6).
 *
 * O hash guardado leva os próprios parâmetros: subir a calibração não invalida as senhas antigas.
 */
export class PasswordHasher {
  private constructor(
    private readonly parametros: HashParams,
    private readonly hashFixo: string,
  ) {}

  /** Gera o hash fixo com uma senha sorteada que ninguém guarda. */
  static async criar(parametros: HashParams): Promise<PasswordHasher> {
    return new PasswordHasher(parametros, await gerarHash(randomBytes(32).toString('base64url'), parametros))
  }

  /** O hash de uma senha nova, para gravar (convite, troca de senha). */
  gerar(senha: string): Promise<string> {
    return gerarHash(senha, this.parametros)
  }

  /**
   * Confere a senha contra o hash guardado, ou contra o hash fixo quando não há. Roda o argon2 uma vez em qualquer
   * caso; hash guardado quebrado conta como senha errada, e não como erro.
   */
  async verificar(hashGuardado: string | null | undefined, senha: string): Promise<boolean> {
    const alvo = hashGuardado ?? this.hashFixo
    let confere: boolean
    try {
      confere = await verify(alvo, senha)
    } catch {
      confere = false
    }
    return confere && hashGuardado !== null && hashGuardado !== undefined
  }
}

/** `Algorithm.Argon2id`. O enum do pacote é `const` e ambiente, e não se lê com `isolatedModules`; o hash gerado traz `$argon2id$`. */
const ARGON2ID = 2 as Algorithm

function gerarHash(senha: string, parametros: HashParams): Promise<string> {
  return hash(senha, { algorithm: ARGON2ID, memoryCost: parametros.memoriaKib, timeCost: parametros.iteracoes, parallelism: 1 })
}
