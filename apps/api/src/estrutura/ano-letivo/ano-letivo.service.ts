import { DomainException, AuditoriaRecorder, type Database, type DatabaseTransaction } from '@educa/core'
import {
  ErrorCode,
  anoLetivoResponseSchema,
  listaDeAnosLetivosResponseSchema,
  type AnoLetivo,
  type PaginationQuery,
  type CriarAnoLetivoRequest,
  type AnoLetivoResponse,
  type ListaDeAnosLetivosResponse,
  type SituacaoDoAnoLetivo,
} from '@educa/shared'
import { AnoLetivoRepository } from './ano-letivo.repository.js'
import { paginar } from '../../http/pagination.js'
import { VinculoRepository } from '../vinculo/vinculo.repository.js'

const registro = new AuditoriaRecorder()

/**
 * A coordenação cria, abre e encerra o ano letivo da escola (RF2; Tech Spec, seção 4). Não depende de haver ano em
 * curso: é assim que a escola começa do zero sem ficar travada (seção 5, "Requisição").
 *
 * - Criar: nasce `planejado`. O mesmo ano duas vezes na escola dá `CONFLITO` (`ano_letivo_escola_ano_unico`).
 * - Abrir: `planejado` → `em_curso`. Com outro ano em curso na escola, `CONFLITO`, pelo índice único parcial. Abrir de
 *   novo o que já está em curso responde o ano como está (o segundo clique); encerrado não reabre.
 * - Encerrar: `em_curso` → `encerrado`, com a virada na mesma transação (10.0): os vínculos do ano vão a `encerrado`
 *   por `fim_do_ano`, o `complemento` das contestações é apagado, e a sala das turmas vira (A1, 10.0,
 *   `AnoLetivoRepository.virarSala`): os acessos revogados, os pedidos pendentes fechados como `encerrada` e os nomes
 *   livres e reivindicados apagados. A auditoria leva as contagens. O ano muda antes de tudo: a escrita que faz nascer
 *   algo no ano (turma, vínculo, acesso, nome da lista, pedido, aprovação) trava o ano em `FOR SHARE`, e ou termina
 *   antes e é alcançada pela virada, ou espera e, relido o ano, não grava. Qualquer falha no meio desfaz tudo, e o ano
 *   continua em curso. Encerrar de novo responde o ano como está, sem virada nem auditoria;
 *   planejado nunca aberto não se encerra. O cache de sessão por escola da Tech Spec (seção 13) não existe: quando a
 *   16.0 o criar, é aqui que a versão avança.
 * - Id de outra escola, inexistente ou fora do formato: `NAO_ENCONTRADO`, igual (regra 10, item 6).
 */
export class AnoLetivoService {
  constructor(private readonly banco: Database) {}

  async criar(pedido: CriarAnoLetivoRequest): Promise<AnoLetivoResponse> {
    return anoLetivoResponseSchema.parse(await new AnoLetivoRepository(this.banco).criar(pedido))
  }

  async listar(consulta: PaginationQuery): Promise<ListaDeAnosLetivosResponse> {
    const linhas = await new AnoLetivoRepository(this.banco).listar(consulta)
    return listaDeAnosLetivosResponseSchema.parse(paginar(linhas, consulta.limite))
  }

  abrir(id: string): Promise<AnoLetivoResponse> {
    return this.#transitar(this.banco, id, 'planejado', 'em_curso')
  }

  encerrar(id: string): Promise<AnoLetivoResponse> {
    return this.banco.transaction((tx) =>
      this.#transitar(tx, id, 'em_curso', 'encerrado', async (ano) => {
        const contagens = await new VinculoRepository(tx).virarAno(ano.id)
        const daSala = await new AnoLetivoRepository(tx).virarSala(ano.id)
        await registro.gravar(tx, 'ano_letivo.encerrado', { entidadeId: ano.id, antes: { situacao: 'em_curso' }, depois: { situacao: 'encerrado', ...contagens, ...daSala } })
      }),
    )
  }

  /**
   * A transição condicional e, só quando ela aconteceu nesta chamada, o que vem junto na mesma transação. O segundo
   * clique relê o ano já mudado e responde como está, sem repetir o efeito.
   */
  async #transitar(
    executor: Database | DatabaseTransaction,
    id: string,
    de: SituacaoDoAnoLetivo,
    para: SituacaoDoAnoLetivo,
    efeito?: (ano: AnoLetivo) => Promise<void>,
  ): Promise<AnoLetivoResponse> {
    const repositorio = new AnoLetivoRepository(executor)
    const mudado = await repositorio.mudarSituacao(id, de, para)
    if (mudado !== undefined) {
      await efeito?.(mudado)
      return anoLetivoResponseSchema.parse(mudado)
    }
    const atual = await repositorio.porId(id)
    if (atual === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    if (atual.situacao === para) return anoLetivoResponseSchema.parse(atual)
    throw new DomainException(ErrorCode.CONFLITO)
  }
}
