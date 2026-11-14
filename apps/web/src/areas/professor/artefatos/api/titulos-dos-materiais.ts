import { listaDeMateriaisResponseSchema, type Material } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { lerPaginas } from '../../../../api/estrutura'

/**
 * O título de cada material que a professora alcança (`GET /v1/materiais`: os das disciplinas em que ela tem vínculo
 * confirmado), pelo id. A citação traz só o `materialId` e a página; é daqui que o chip e a lista de fontes **da conversa e da
 * Turma hoje** tiram o nome do material. O artefato aberto e o resultado da ferramenta **não leem daqui**: a resposta do
 * artefato traz as `fontes`, com título, edição e "edição anterior", inclusive do material que esta lista já não tem
 * (ingestao-do-material, 10.0; `titulosDasFontes`). Sem esta leitura a citação continua valendo, com "Material da escola" no lugar do
 * título (`components/ui/ai/source-labels.ts`): a falha dela não derruba a tela.
 */
export const titulosDosMateriaisQueryOptions = queryOptions({
  queryKey: ['materiais', 'titulos'],
  queryFn: async ({ signal }): Promise<Readonly<Record<string, string>>> => {
    const { itens } = await lerPaginas<Material>('/v1/materiais', listaDeMateriaisResponseSchema, signal, 3)
    return Object.fromEntries(itens.map((material) => [material.id, material.titulo]))
  },
  staleTime: 5 * 60_000,
})
