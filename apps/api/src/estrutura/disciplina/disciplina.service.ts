import { DomainException, type Database } from '@educa/core'
import {
  ErrorCode,
  disciplinaResponseSchema,
  listaDeDisciplinasResponseSchema,
  type PaginationQuery,
  type CriarDisciplinaRequest,
  type RenomearDisciplinaRequest,
  type DisciplinaResponse,
  type ListaDeDisciplinasResponse,
} from '@educa/shared'
import { DisciplinaRepository } from './disciplina.repository.js'
import { paginar } from '../../http/paginacao.js'

/**
 * A coordenação cria, lista, renomeia e exclui as disciplinas da escola (RF2 do F1; RF3 da A1). O nome repetido na
 * escola é `CONFLITO`, sem o valor. Id de outra escola ou inexistente: `NAO_ENCONTRADO`, e nada muda. Excluir a
 * disciplina com vínculo: `CONFLITO`, e nada é apagado.
 */
export class DisciplinaService {
  constructor(private readonly banco: Database) {}

  async criar(pedido: CriarDisciplinaRequest): Promise<DisciplinaResponse> {
    return disciplinaResponseSchema.parse(await new DisciplinaRepository(this.banco).criar(pedido))
  }

  async renomear(id: string, pedido: RenomearDisciplinaRequest): Promise<DisciplinaResponse> {
    const renomeada = await new DisciplinaRepository(this.banco).renomear(id, pedido.nome)
    if (renomeada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return disciplinaResponseSchema.parse(renomeada)
  }

  async excluir(id: string): Promise<void> {
    if (!(await new DisciplinaRepository(this.banco).excluir(id))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
  }

  async listar(consulta: PaginationQuery): Promise<ListaDeDisciplinasResponse> {
    const linhas = await new DisciplinaRepository(this.banco).listar(consulta)
    return listaDeDisciplinasResponseSchema.parse(paginar(linhas, consulta.limite))
  }
}
