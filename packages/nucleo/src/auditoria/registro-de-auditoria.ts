import { FORMATO_OPERADOR } from '@educa/shared'
import { z } from 'zod'
import { currentContext } from '../contexto/contexto.js'
import { ACOES_DE_AUDITORIA, type AcaoDeAuditoria, type DefinicaoDeAcao, type EstadosDaAcao } from './acoes.js'
import { AuditoriaRejectedError } from './auditoria-recusada.js'
import type { DatabaseExecutor } from './auditoria.repository.js'
import { insertAuditoria } from './insercao-de-auditoria.repository.js'

export type DadosDaAuditoria<Acao extends AcaoDeAuditoria> = EstadosDaAcao<Acao> & {
  entidadeId: string
  /** Quem da nossa equipe rodou o comando. Só é aceito sem usuário no contexto. */
  autorOperador?: string
}

const entidadeIdSchema = z.uuid()

/**
 * As entidades que o operador audita sem escola no contexto (F3, 8.0): a rede, que ainda não tem escola, e o suboperador,
 * que pode atender toda escola. A lista é a do check `auditoria_escola_ou_operacao_global`; qualquer outra ação sem escola
 * é recusada aqui, antes de chegar ao banco.
 */
export const ENTIDADES_DE_AUDITORIA_SEM_ESCOLA: readonly string[] = ['rede', 'suboperador']

/** O valor conferido contra o schema da ação; ação sem schema para a parte não aceita valor nenhum. */
function conferido<Valor>(esquema: z.ZodType<Valor> | null, valor: unknown): Valor | null {
  if (esquema === null) {
    if (valor !== undefined) throw new AuditoriaRejectedError('dados_fora_do_schema')
    return null
  }
  const resultado = esquema.safeParse(valor)
  if (!resultado.success) throw new AuditoriaRejectedError('dados_fora_do_schema')
  return resultado.data
}

/**
 * A única porta de escrita da auditoria (regra 20, item 10). Grava na transação de quem chamou, para a
 * ação e o registro dela existirem juntos ou nenhum dos dois. Sem estado: a API o recebe por injeção, e o
 * comando do operador cria o seu.
 */
export class AuditoriaRecorder {
  /**
   * Confere a ação, a lista fechada de `antes`, `depois` e `finalidade`, o autor e a escola, e grava. A
   * escola e o usuário vêm do contexto, nunca do argumento (regra 10, item 3).
   */
  async gravar<Acao extends AcaoDeAuditoria>(executor: DatabaseExecutor, acao: Acao, dados: DadosDaAuditoria<Acao>): Promise<void> {
    const contexto = currentContext()
    if (contexto === undefined) throw new AuditoriaRejectedError('sem_contexto')
    const definicao: DefinicaoDeAcao | undefined = Object.hasOwn(ACOES_DE_AUDITORIA, acao) ? ACOES_DE_AUDITORIA[acao] : undefined
    if (definicao === undefined) throw new AuditoriaRejectedError('acao_desconhecida')

    const antes = conferido(definicao.antes, dados.antes)
    const depois = conferido(definicao.depois, dados.depois)
    // Ação que aceita finalidade exige uma; a que não aceita recusa qualquer valor.
    const finalidade = conferido(definicao.finalidade, dados.finalidade)
    if (!entidadeIdSchema.safeParse(dados.entidadeId).success) throw new AuditoriaRejectedError('dados_fora_do_schema')

    const { usuarioId } = contexto
    if (usuarioId !== undefined && dados.autorOperador !== undefined) throw new AuditoriaRejectedError('operador_com_usuario')
    if (usuarioId === undefined && (dados.autorOperador === undefined || !FORMATO_OPERADOR.test(dados.autorOperador))) {
      throw new AuditoriaRejectedError('sem_autor')
    }
    const autorOperador = usuarioId === undefined ? (dados.autorOperador ?? null) : null
    if (contexto.escolaId === undefined && !(ENTIDADES_DE_AUDITORIA_SEM_ESCOLA.includes(definicao.entidade) && autorOperador !== null)) throw new AuditoriaRejectedError('sem_escola')

    await insertAuditoria(executor, {
      acao,
      entidade: definicao.entidade,
      entidadeId: dados.entidadeId,
      autorUsuarioId: usuarioId ?? null,
      autorOperador,
      antes,
      depois,
      finalidade: typeof finalidade === 'string' ? finalidade : null,
    })
  }
}
