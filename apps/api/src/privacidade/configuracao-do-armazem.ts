import { validateEnvironment } from '@educa/nucleo'
import { z } from 'zod'

const esquemaDoArmazem = z.object({
  STORAGE_URL: z.url({ protocol: /^https?$/ }),
  // O endereço que o navegador abre: entra na assinatura. Sem ele vale `STORAGE_URL`, que no compose não resolve fora dele.
  STORAGE_URL_PUBLICA: z.url({ protocol: /^https?$/ }).optional(),
  STORAGE_REGIAO: z.string().regex(/^[a-z0-9-]+$/),
  STORAGE_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
  STORAGE_CHAVE_ACESSO: z.string().min(1),
  STORAGE_CHAVE_SECRETA: z.string().min(1),
})

/**
 * O armazém do arquivo do titular, visto da API (F3, tarefa 13.0; Tech Spec do F3, seções 4 e 12): por onde ela alcança o
 * storage (`url`), o endereço que vai na URL assinada (`urlPublica`) e a credencial. Mesmas variáveis do worker, mais
 * `STORAGE_URL_PUBLICA`. A mensagem de erro cita só o nome da variável, nunca o valor (a chave secreta).
 */
export interface ConfiguracaoDoArmazemDaApi {
  readonly url: string
  readonly urlPublica?: string
  readonly regiao: string
  readonly bucket: string
  readonly chaveAcesso: string
  readonly chaveSecreta: string
  /** Uma tentativa só: o cliente da API espera a resposta, e repetir seguraria a requisição por mais de um prazo. */
  readonly tentativas: number
  /** O prazo de cada chamada ao storage na API, em ms: menor que o do worker (regra 80, item 4). */
  readonly timeoutRequisicaoMs: number
}

export const TENTATIVAS_DO_ARMAZEM_NA_API = 1
export const TIMEOUT_DO_ARMAZEM_NA_API_MS = 5_000

export function lerConfiguracaoDoArmazem(ambiente: Record<string, string | undefined>): ConfiguracaoDoArmazemDaApi {
  const lido = validateEnvironment(esquemaDoArmazem, ambiente)
  return {
    url: lido.STORAGE_URL,
    ...(lido.STORAGE_URL_PUBLICA === undefined ? {} : { urlPublica: lido.STORAGE_URL_PUBLICA }),
    regiao: lido.STORAGE_REGIAO,
    bucket: lido.STORAGE_BUCKET,
    chaveAcesso: lido.STORAGE_CHAVE_ACESSO,
    chaveSecreta: lido.STORAGE_CHAVE_SECRETA,
    tentativas: TENTATIVAS_DO_ARMAZEM_NA_API,
    timeoutRequisicaoMs: TIMEOUT_DO_ARMAZEM_NA_API_MS,
  }
}

