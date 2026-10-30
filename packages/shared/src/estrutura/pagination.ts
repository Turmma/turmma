import { z } from 'zod'

/** Itens por página quando o pedido não diz. */
export const TAMANHO_PADRAO_DA_PAGINA = 50
/** O maior pedido aceito: listagem nunca devolve a tabela inteira (regra 80, item 8). */
export const TAMANHO_MAXIMO_DA_PAGINA = 100

/**
 * Consulta das listagens da estrutura: `?pagina=<id>` continua depois do último item da página anterior (o `proxima`
 * da resposta), e `?limite=` pede até 100 itens. Estrita: nada de escola ou ano, que vêm da sessão (regra 10, item 3).
 */
export const paginationQuerySchema = z
  .object({
    pagina: z.uuid().optional(),
    limite: z.coerce.number().int().min(1).max(TAMANHO_MAXIMO_DA_PAGINA).default(TAMANHO_PADRAO_DA_PAGINA),
  })
  .strict()

export type PaginationQuery = z.infer<typeof paginationQuerySchema>

/** Uma página: os itens e, se houver mais, o `proxima` a mandar em `?pagina=`. */
export function pageSchema<Item extends z.ZodType>(item: Item) {
  return z
    .object({
      itens: z.array(item),
      proxima: z.uuid().optional(),
    })
    .strict()
}
