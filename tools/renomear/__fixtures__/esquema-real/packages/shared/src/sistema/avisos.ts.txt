import { z } from 'zod'

/** Teto de avisos na configuração: a casca é uma tela curta, e aviso demais deixa de ser lido. */
export const MAXIMO_DE_AVISOS = 10

/**
 * Um aviso do sistema, escrito por nós na configuração (manutenção, janela de atualização). Texto
 * fixo e público: nunca dado de escola nem de pessoa. `publicadoEm` é a data, sem hora.
 */
export const esquemaAviso = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,64}$/),
    texto: z.string().min(1).max(280),
    publicadoEm: z.iso.date(),
  })
  .strict()

export type Aviso = z.infer<typeof esquemaAviso>

/** Corpo de `GET /v1/sistema/avisos`, rota anônima. Lista vazia é o estado normal. */
export const esquemaRespostaAvisos = z
  .object({
    itens: z.array(esquemaAviso).max(MAXIMO_DE_AVISOS),
  })
  .strict()

export type RespostaAvisos = z.infer<typeof esquemaRespostaAvisos>
