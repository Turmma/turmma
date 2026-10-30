import { z } from 'zod'

/** Ambientes em que o sistema sobe. O mesmo conjunto que a configuração da API valida no boot. */
export const SYSTEM_ENVIRONMENTS = ['local', 'staging', 'producao'] as const

/** Partes do sistema que a casca mostra. Só o que a API consegue verificar sem token e sem custo. */
export const SYSTEM_COMPONENTS = ['api', 'banco'] as const

export const COMPONENT_STATUSES = ['disponivel', 'indisponivel'] as const

/**
 * Corpo de `GET /v1/sistema/estado`, rota anônima. Não carrega dado de escola nem de pessoa: versão
 * do código, ambiente e a situação de cada componente, com a hora da verificação.
 */
export const systemStatusResponseSchema = z
  .object({
    versao: z.string().min(1).max(64),
    ambiente: z.enum(SYSTEM_ENVIRONMENTS),
    componentes: z.array(
      z
        .object({
          nome: z.enum(SYSTEM_COMPONENTS),
          situacao: z.enum(COMPONENT_STATUSES),
          verificadoEm: z.iso.datetime(),
        })
        .strict(),
    ),
  })
  .strict()

export type SystemStatusResponse = z.infer<typeof systemStatusResponseSchema>
export type SystemComponent = SystemStatusResponse['componentes'][number]
