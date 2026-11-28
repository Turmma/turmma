import { AuditoriaRecorder, DomainException, type Database } from '@educa/core'
import { ErrorCode, atividadeAplicadaResponseSchema, type AtividadeAplicadaResponse, type SegundaChamadaRequest } from '@educa/shared'
import { conferirArtefatoParaAplicar, paraATela } from './atividade-aplicada.service.js'
import { AtividadeAplicadaRepository } from './atividade-aplicada.repository.js'

const registro = new AuditoriaRecorder()

/**
 * A segunda chamada (avaliacao-e-correcao, 9.0; RF10; Tech Spec §5.9): com a original **encerrada**, a professora reabre a prova, com janela nova, só para quem não a enviou. É uma aplicação nova
 * (`segunda_chamada_de` aponta a original), com os convocados e o tempo adicional dela, e o lote de correção é o dela: o da original, aprovado ou não, não muda.
 *
 * - **Quem pode**: a professora da turma e da disciplina da original (o `NAO_ENCONTRADO` de sempre, igual para a de outra escola, outra turma, outra disciplina e a inexistente). A original tem de estar
 *   encerrada, ser avaliativa e não ser ela mesma uma segunda chamada: o resto é `ENTRADA_INVALIDA`. As recusas do aplicar valem de novo (`conferirArtefatoParaAplicar`).
 * - **Quem é convocado**: aluno da turma de agora (vínculo `confirmado`, conta ativa) que **não enviou** a original, nem pelo aluno nem pelo limite. Quem nunca começou e quem a professora cortou
 *   antes do limite continuam convocáveis. O de outra turma, o de outra escola, o inexistente, o desativado e o que já enviou respondem o mesmo `ENTRADA_INVALIDA`: nenhum confirma o outro, e nada se grava.
 * - **A janela, a duração e o tempo adicional** passam pela mesma conferência do aplicar (`camposInvalidosDaProva`, no contrato do corpo). O embaralhamento é o da original: a prova é a mesma.
 * - **Duas ao mesmo tempo**: a segunda aberta por original é o índice único parcial do banco (`CONFLITO`), não uma leitura antes de gravar (regra 80, item 7). A auditoria
 *   `atividade.segunda_chamada_aplicada` leva só as contagens: nem os convocados nem o tempo adicional por aluno (regra 20, item 3; D35).
 */
export class SegundaChamadaService {
  constructor(private readonly banco: Database) {}

  async aplicar(originalId: string, pedido: SegundaChamadaRequest): Promise<AtividadeAplicadaResponse> {
    const criada = await this.banco.transaction(async (tx) => {
      const aplicacoes = new AtividadeAplicadaRepository(tx)
      const original = await aplicacoes.originalDaSegundaChamada(originalId)
      if (original === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      // A original é conferida antes de travar o artefato: o pedido que vai ser recusado não trava nada.
      if (original.estado !== 'encerrada' || !original.avaliativa || original.segundaChamadaDe !== null) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
      // Na mesma ordem do aplicar: o artefato é travado (`for update`) antes de a aplicação nascer.
      const alvo = await aplicacoes.artefatoParaAplicar(original.artefatoId)
      if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      conferirArtefatoParaAplicar(alvo)
      const convocados = pedido.alunoIds.map((alunoId) => alunoId.toLowerCase())
      const daTurma = await aplicacoes.alunosDaTurmaEntre(original.turmaId, convocados)
      const jaEnviaram = await aplicacoes.quemEnviou(original.id, convocados)
      if (convocados.some((alunoId) => !daTurma.has(alunoId) || jaEnviaram.has(alunoId))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
      const id = await aplicacoes.create({
        turmaId: original.turmaId,
        artefatoId: original.artefatoId,
        avaliativa: true,
        janela: pedido.janela,
        duracaoMin: pedido.duracaoMin,
        embaralhar: original.embaralhar,
        segundaChamadaDe: original.id,
      })
      await aplicacoes.saveConvocados(id, convocados)
      await aplicacoes.saveTempoAdicional(id, pedido.tempoAdicional)
      await registro.save(tx, 'atividade.segunda_chamada_aplicada', {
        entidadeId: id,
        depois: { segundaChamadaDe: original.id, turmaId: original.turmaId, convocados: convocados.length, comTempoAdicional: pedido.tempoAdicional.length },
      })
      const lida = await aplicacoes.porId(id)
      if (lida === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      return lida
    })
    return atividadeAplicadaResponseSchema.parse(paraATela(criada))
  }
}
