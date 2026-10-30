import { contextoAtual, ErroDeDominio, RegistroDeAuditoria, type Banco } from '@educa/nucleo'
import { ErrorCode, escolaSessaoResponseSchema, type EscolaSessaoRequest, type EscolaSessaoResponse } from '@educa/shared'
import { EscolaSessaoRepository } from './escola-sessao.repository.js'

/**
 * A coordenação configura a inatividade da escola (RF13): quantos minutos sem uso até a sessão do aluno e a da equipe
 * vencerem. Numa transação, lê os valores com a linha travada, grava os novos e a auditoria `escola.sessao_alterada`
 * com os dois números de antes e de depois (regra 20, item 10). Vale na requisição seguinte de cada sessão da escola,
 * porque a guarda lê a inatividade junto com a sessão.
 */
export class EscolaSessaoService {
  readonly #auditoria = new RegistroDeAuditoria()

  constructor(private readonly banco: Banco) {}

  async alterar(pedido: EscolaSessaoRequest): Promise<EscolaSessaoResponse> {
    const escolaId = contextoAtual()?.escolaId
    if (escolaId === undefined) throw new ErroDeDominio(ErrorCode.NAO_AUTENTICADO)
    const gravada = await this.banco.transaction(async (tx) => {
      const repositorio = new EscolaSessaoRepository(tx)
      const antes = await repositorio.lerParaAlterar()
      if (antes === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
      const depois = await repositorio.alterar(pedido)
      if (depois === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
      await this.#auditoria.gravar(tx, 'escola.sessao_alterada', { entidadeId: escolaId, antes: { ...antes }, depois: { ...depois } })
      return depois
    })
    return escolaSessaoResponseSchema.parse({ inatividadeAlunoMin: gravada.inatividadeAlunoMin, inatividadeEquipeMin: gravada.inatividadeEquipeMin })
  }
}
