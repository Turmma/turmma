import type { Banco } from '@educa/nucleo'
import {
  listaDeSeriesResponseSchema,
  serieResponseSchema,
  type PaginationQuery,
  type CriarSerieRequest,
  type ListaDeSeriesResponse,
  type SerieResponse,
} from '@educa/shared'
import { paginar } from '../../http/paginacao.js'
import { SerieRepository } from './serie.repository.js'

/**
 * A coordenação cria e lista as séries do recorte (RF2, D43). Fora do recorte é `ENTRADA_INVALIDA` no contrato e, se
 * algum caminho passar dele, o check do banco recusa; a série repetida é `CONFLITO`, sem o valor na resposta.
 */
export class SerieService {
  constructor(private readonly banco: Banco) {}

  async criar(pedido: CriarSerieRequest): Promise<SerieResponse> {
    return serieResponseSchema.parse(await new SerieRepository(this.banco).criar(pedido))
  }

  async listar(consulta: PaginationQuery): Promise<ListaDeSeriesResponse> {
    const linhas = await new SerieRepository(this.banco).listar(consulta)
    return listaDeSeriesResponseSchema.parse(paginar(linhas, consulta.limite))
  }
}
