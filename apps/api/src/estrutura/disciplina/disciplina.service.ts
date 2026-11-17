import { AuditoriaRecorder, DomainException, type Database } from '@educa/core'
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
import { DisciplinaRepository } from '@educa/core/estrutura'
import { paginar } from '../../http/pagination.js'

const registro = new AuditoriaRecorder()

/**
 * A coordenação cria, lista, renomeia e exclui as disciplinas da escola (RF2 do F1; RF3 da A1) e define o componente da BNCC de cada
 * uma (classificacao-bncc, 1.0; RF1). O nome repetido na escola é `CONFLITO`, sem o valor. Trocar ou apagar o componente grava
 * `disciplina.componente_alterado`, com o de antes e o de depois, na mesma transação; o mesmo componente que já estava não grava nada. A 6.0
 * acrescenta o job que refaz a classificação do material, e esta tarefa não agenda nada. Id de outra escola ou inexistente: `NAO_ENCONTRADO`, e nada muda. Excluir a
 * disciplina com vínculo: `CONFLITO`, e nada é apagado.
 */
export class DisciplinaService {
  constructor(private readonly banco: Database) {}

  async criar(pedido: CriarDisciplinaRequest): Promise<DisciplinaResponse> {
    return disciplinaResponseSchema.parse(await new DisciplinaRepository(this.banco).criar(pedido))
  }

  /**
   * `PATCH`: o nome e/ou o componente. Numa transação só, com a linha da disciplina travada: o objeto no alcance primeiro (`NAO_ENCONTRADO`, igual ao de
   * outra escola), depois o nome (`CONFLITO` com outra disciplina da escola desfaz tudo), depois o componente, que só audita quando mudou.
   */
  renomear(id: string, pedido: RenomearDisciplinaRequest): Promise<DisciplinaResponse> {
    return this.banco.transaction(async (tx) => {
      const repositorio = new DisciplinaRepository(tx)
      const atual = await repositorio.travarPorId(id)
      if (atual === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      let resultado = atual
      if (pedido.nome !== undefined) {
        const renomeada = await repositorio.renomear(id, pedido.nome)
        if (renomeada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        resultado = renomeada
      }
      if (pedido.componenteBncc !== undefined && pedido.componenteBncc !== atual.componenteBncc) {
        const alterada = await repositorio.definirComponente(id, pedido.componenteBncc)
        if (alterada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        resultado = alterada
        await registro.gravar(tx, 'disciplina.componente_alterado', {
          entidadeId: id,
          antes: { componenteBncc: atual.componenteBncc },
          depois: { componenteBncc: pedido.componenteBncc },
        })
      }
      return disciplinaResponseSchema.parse(resultado)
    })
  }

  async excluir(id: string): Promise<void> {
    if (!(await new DisciplinaRepository(this.banco).excluir(id))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
  }

  async listar(consulta: PaginationQuery): Promise<ListaDeDisciplinasResponse> {
    const linhas = await new DisciplinaRepository(this.banco).listar(consulta)
    return listaDeDisciplinasResponseSchema.parse(paginar(linhas, consulta.limite))
  }
}
