import { z } from 'zod'

/**
 * A cópia congelada do contrato de lista de materiais **antes** da F4 (`packages/shared/src/material/material.ts` em `699d7fa9`, o último commit que o mexeu antes da
 * ingestão do material), com os mesmos valores aceitos e o mesmo `strictObject`. É o que o código anterior usa para ler o que a F4 gravou depois que a versão volta
 * (`docs/runbook.md`, "Voltar o código depois da F4"): um valor que ela não conhece, em `falha`, `estado`, `titularidade` ou `licenca`, derruba a lista inteira.
 *
 * **Não se atualiza.** Nunca importe `@educa/shared` aqui: a cópia existe justamente para não acompanhar o contrato novo.
 */
const TITULARIDADES = ['escola', 'professor', 'terceiro_com_licenca', 'dominio_publico'] as const
const LICENCAS = ['dominio_publico', 'autoria_da_escola', 'licenca_aberta', 'licenca_comercial_autorizada'] as const
const ESTADOS = ['processando', 'pronto', 'falhou'] as const
const FALHAS = ['arquivo_invalido', 'sem_texto', 'extracao_falhou'] as const

export const materialAntesDaF4Schema = z.strictObject({
  id: z.uuid(),
  titulo: z.string().min(1),
  disciplinaId: z.uuid(),
  titularidade: z.enum(TITULARIDADES),
  licenciante: z.string().min(1).nullable(),
  licenca: z.enum(LICENCAS),
  estado: z.enum(ESTADOS),
  falha: z.enum(FALHAS).nullable(),
  paginas: z.number().int().min(1).nullable(),
  trechos: z.number().int().nonnegative(),
  enviadoEm: z.iso.datetime(),
})

/** `listaDeMateriaisResponseSchema` daquela versão: `pageSchema(materialSchema)`. */
export const listaDeMateriaisAntesDaF4Schema = z.object({ itens: z.array(materialAntesDaF4Schema), proxima: z.uuid().optional() }).strict()
