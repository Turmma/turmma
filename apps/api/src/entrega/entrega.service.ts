import { DomainException, AuditoriaRecorder, type Database } from '@educa/core'
import { ErrorCode, entregaResponseSchema, listaDeEntregasResponseSchema, type EntregasQuery, type DecidirEntregaRequest, type EntregaResponse, type ListaDeEntregasResponse } from '@educa/shared'
import { paginar } from '../http/paginacao.js'
import { EntregaRepository, type EntregaLida } from './entrega.repository.js'

const registro = new AuditoriaRecorder()

/** A entrega como a tela a recebe (DTO explícito; regra 20, item 4). Quem decidiu e já foi eliminado sai sem nome. */
function paraATela(lida: EntregaLida): unknown {
  return {
    id: lida.id,
    tipo: lida.tipo,
    funcao: lida.funcao,
    estado: lida.estado,
    turmaId: lida.turmaId,
    titulo: lida.titulo,
    artefatoId: lida.artefatoId,
    atividadeAplicadaId: lida.atividadeAplicadaId,
    criadaEm: lida.criadaEm.toISOString(),
    decididaEm: lida.decididaEm?.toISOString() ?? null,
    decididaPor: lida.decididaPor === null || lida.nomeDeQuemDecidiu === null ? null : { id: lida.decididaPor, nome: lida.nomeDeQuemDecidiu },
    justificativa: lida.justificativa,
  }
}

/**
 * As entregas que esperam a decisão do professor (MVP, A2; regra 70, itens 3 e 6): o que a IA produziu só vale depois
 * da aprovação registrada, com autor e data, e pode ser rejeitado com justificativa.
 *
 * - **Só o professor com vínculo confirmado na turma e na disciplina da entrega** lê e decide. A de outra turma, de
 *   outra disciplina da mesma turma, de outra escola e a inexistente respondem o mesmo `NAO_ENCONTRADO` (regra 10, item 6).
 * - **Decidir é uma vez só.** O `update` condicional grava a primeira decisão; a segunda, mesmo simultânea, responde
 *   `ENTREGA_JA_DECIDIDA`, não troca nada e não grava auditoria.
 * - **O lote de correção não se aprova por aqui** (`ENTRADA_INVALIDA`): a aprovação dele grava o registro da validação
 *   (D56), em `POST /v1/entregas/:id/aprovar-lote`. Rejeitar o lote é por aqui.
 * - **Suspender a função não mexe na entrega** (D60): a pendente de uma função suspensa continua podendo ser decidida,
 *   porque quem decide é a pessoa. Por isso nada aqui consulta a suspensão.
 * - **Só uma pessoa decide.** Não há job, execução nem rotina que chame `decidir`: o autor é o usuário da sessão.
 * - A auditoria `entrega.decidida` vai na mesma transação, sem a justificativa.
 */
export class EntregaService {
  constructor(private readonly banco: Database) {}

  async listar(consulta: EntregasQuery): Promise<ListaDeEntregasResponse> {
    const linhas = await new EntregaRepository(this.banco).listar({ ...consulta, ...(consulta.turmaId === undefined ? {} : { turmaId: consulta.turmaId.toLowerCase() }) })
    const { itens, proxima } = paginar(linhas, consulta.limite)
    return listaDeEntregasResponseSchema.parse({ itens: itens.map(paraATela), ...(proxima === undefined ? {} : { proxima }) })
  }

  async decidir(id: string, pedido: DecidirEntregaRequest): Promise<EntregaResponse> {
    const decidida = await this.banco.transaction(async (tx) => {
      const entregas = new EntregaRepository(tx)
      const pendente = await entregas.porId(id)
      if (pendente === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if (pedido.decisao === 'aprovar' && pendente.tipo === 'lote_de_correcao') throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
      const estado = pedido.decisao === 'aprovar' ? 'aprovada' : 'rejeitada'
      const gravou = await entregas.decidir(id, estado, pedido.decisao === 'rejeitar' ? pedido.justificativa : null)
      if (!gravou) throw new DomainException(ErrorCode.ENTREGA_JA_DECIDIDA)
      await registro.gravar(tx, 'entrega.decidida', {
        entidadeId: id,
        antes: { estado: 'pendente' },
        depois: { tipo: pendente.tipo, funcao: pendente.funcao, turmaId: pendente.turmaId, estado, artefatoId: pendente.artefatoId, atividadeAplicadaId: pendente.atividadeAplicadaId },
      })
      const gravada = await entregas.porId(id)
      if (gravada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      return gravada
    })
    return entregaResponseSchema.parse(paraATela(decidida))
  }
}
