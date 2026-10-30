import { ErroDeDominio, exigirOperadorDoContexto } from '@educa/nucleo'
import { ErrorCode, euDoOperadorResponseSchema, type EuDoOperadorResponse } from '@educa/shared'
import type { OperadorRepository } from '../operador/operador.repository.js'

/** `GET /v1/operacao/eu`: o apelido e o nome do operador da sessão, pelo contrato estrito de `packages/shared`. */
export class EuDoOperadorService {
  constructor(private readonly operadores: Pick<OperadorRepository, 'daSessao'>) {}

  async obter(): Promise<EuDoOperadorResponse> {
    const operador = await this.operadores.daSessao(exigirOperadorDoContexto())
    // Desativado entre a guarda e aqui: a sessão acabou de terminar.
    if (operador === undefined) throw new ErroDeDominio(ErrorCode.SESSAO_ENCERRADA)
    return euDoOperadorResponseSchema.parse(operador)
  }
}
