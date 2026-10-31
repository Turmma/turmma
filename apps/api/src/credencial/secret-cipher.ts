import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { InvariantException } from '@educa/shared'

/** Bytes do vetor de inicialização do GCM: 96 bits, sorteado a cada cifra. */
const BYTES_DO_IV = 12
/** Bytes da etiqueta de autenticação do GCM. */
const BYTES_DA_ETIQUETA = 16

/** O segredo cifrado, como `conta.mfa_segredo_cifrado` e `conta.mfa_chave_versao` o guardam. */
export interface CipheredSecret {
  readonly cifrado: Buffer
  readonly versao: number
}

/** O segredo não decifra: chave de outra versão, bytes alterados, ou segredo copiado de outra conta. */
export class SecretDecryptionError extends Error {
  constructor() {
    super('segredo do MFA não decifra')
    this.name = 'SecretDecryptionError'
  }
}

/**
 * A cifra do segredo do app autenticador (Tech Spec, seção 5, "TOTP"): AES-256-GCM, com o `conta_id` como dado
 * autenticado (AAD) e a versão da chave gravada ao lado.
 *
 * - **AAD:** o segredo cifrado de uma conta, copiado para a linha de outra (por quem tem acesso de escrita ao banco),
 *   não decifra: a etiqueta não confere com outro `conta_id`. Sem isso, quem copia o próprio segredo para a conta de
 *   outro coordenador passaria no segundo fator dele.
 * - **Formato:** `iv (12) | etiqueta (16) | texto cifrado`. Nada legível: o segredo nunca é gravado em claro.
 * - **Versão:** o segredo novo sai sempre com a versão atual; o antigo decifra com a chave da versão dele, enquanto ela
 *   estiver declarada no ambiente.
 */
export class SecretCipher {
  constructor(
    private readonly versaoAtual: number,
    private readonly chaves: ReadonlyMap<number, Uint8Array>,
  ) {
    if (!chaves.has(versaoAtual)) throw new InvariantException('chave de cifra da versão atual ausente')
  }

  cifrar(segredo: Uint8Array, contaId: string): CipheredSecret {
    const iv = randomBytes(BYTES_DO_IV)
    const cifra = createCipheriv('aes-256-gcm', this.#chave(this.versaoAtual), iv, { authTagLength: BYTES_DA_ETIQUETA })
    cifra.setAAD(dadoAutenticado(contaId))
    const texto = Buffer.concat([cifra.update(segredo), cifra.final()])
    return { cifrado: Buffer.concat([iv, cifra.getAuthTag(), texto]), versao: this.versaoAtual }
  }

  /** Os bytes do segredo, ou `SecretDecryptionError`: nunca devolve um segredo que não seja o gravado para esta conta. */
  decifrar(gravado: CipheredSecret, contaId: string): Uint8Array {
    const chave = this.chaves.get(gravado.versao)
    if (chave === undefined || gravado.cifrado.length <= BYTES_DO_IV + BYTES_DA_ETIQUETA) throw new SecretDecryptionError()
    const iv = gravado.cifrado.subarray(0, BYTES_DO_IV)
    const etiqueta = gravado.cifrado.subarray(BYTES_DO_IV, BYTES_DO_IV + BYTES_DA_ETIQUETA)
    const texto = gravado.cifrado.subarray(BYTES_DO_IV + BYTES_DA_ETIQUETA)
    try {
      const decifra = createDecipheriv('aes-256-gcm', chave, iv, { authTagLength: BYTES_DA_ETIQUETA })
      decifra.setAAD(dadoAutenticado(contaId))
      decifra.setAuthTag(etiqueta)
      return new Uint8Array(Buffer.concat([decifra.update(texto), decifra.final()]))
    } catch {
      throw new SecretDecryptionError()
    }
  }

  #chave(versao: number): Uint8Array {
    const chave = this.chaves.get(versao)
    if (chave === undefined) throw new InvariantException('chave de cifra ausente')
    return chave
  }
}

/** O `conta_id` como o AAD o leva: em minúsculas, para o mesmo UUID escrito com outra caixa ser a mesma conta. */
function dadoAutenticado(contaId: string): Buffer {
  return Buffer.from(contaId.toLowerCase(), 'utf8')
}
