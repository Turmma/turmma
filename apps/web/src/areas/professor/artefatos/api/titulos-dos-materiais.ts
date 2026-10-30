import { listaDeMateriaisResponseSchema, type Material } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { lerPaginas } from '../../../../api/estrutura'

/**
 * O título de cada material que a professora alcança (`GET /v1/materiais`: os das disciplinas em que ela tem vínculo
 * confirmado), pelo id. A citação de uma questão traz só o `materialId` e a página; é daqui que o chip e a lista de
 * fontes tiram o nome do material. Sem esta leitura a citação continua valendo, com "Material da escola" no lugar do
 * título (`componentes/ui/ia/textos-das-fontes.ts`): a falha dela não derruba a tela.
 */
export const consultaTitulosDosMateriais = queryOptions({
  queryKey: ['materiais', 'titulos'],
  queryFn: async ({ signal }): Promise<Readonly<Record<string, string>>> => {
    const { itens } = await lerPaginas<Material>('/v1/materiais', listaDeMateriaisResponseSchema, signal, 3)
    return Object.fromEntries(itens.map((material) => [material.id, material.titulo]))
  },
  staleTime: 5 * 60_000,
})
