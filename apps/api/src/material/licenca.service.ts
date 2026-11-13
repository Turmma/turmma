import { AuditoriaRecorder, diaDeUso, DomainException, systemClock, type Clock, type Database } from '@educa/core'
import {
  ErrorCode,
  licencaResponseSchema,
  listaDeLicencasResponseSchema,
  situacaoDaLicenca,
  vigenciaInvalida,
  type AlterarLicencaRequest,
  type LicencaResponse,
  type LicencasQuery,
  type ListaDeLicencasResponse,
  type RegistrarLicencaRequest,
} from '@educa/shared'
import { paginar } from '../http/pagination.js'
import { LicencaRepository, type LicencaLida } from './licenca.repository.js'

const registro = new AuditoriaRecorder()

export interface LicencaDependencies {
  readonly banco: Database
  /** O relógio da situação (`vigente`, `vence_em_30_dias`...): o dia de São Paulo. O teste injeta o dele; nunca vem do ambiente. */
  readonly relogio?: Clock
}

/**
 * A licença do material de terceiro (ingestao-do-material, 5.0; PRD, RF16 e RF17), só da coordenação (`licenca` na `MATRIZ`): registrar, listar com a situação do dia e a contagem
 * de materiais, e alterar a vigência, a cobertura e a referência. Não há exclusão. A de outra escola, e a inexistente, dão o mesmo `NAO_ENCONTRADO` (regra 10, item 6).
 *
 * **Nada disto loga licenciante, cobertura nem referência** (regra 20, item 9), e a auditoria leva só a vigência: texto livre pode ter nome de pessoa.
 */
export class LicencaService {
  constructor(private readonly dependencias: LicencaDependencies) {}

  /** O dia de São Paulo em que a pergunta é feita (`diaDeUso`): às 23h do último dia a licença ainda vale, e às 0h01 do seguinte não. Lido uma vez por resposta, para a página inteira ficar no mesmo dia. */
  #hoje(): string {
    return diaDeUso((this.dependencias.relogio ?? systemClock).agora())
  }

  #paraResposta(lida: LicencaLida, hoje: string): LicencaResponse {
    return licencaResponseSchema.parse({
      ...lida,
      situacao: situacaoDaLicenca(hoje, lida.vigenteDesde, lida.vigenteAte),
      registradaEm: lida.registradaEm.toISOString(),
      alteradaEm: lida.alteradaEm.toISOString(),
    })
  }

  /** `GET /v1/licencas`: uma página, em ordem de id, das licenças da escola. */
  async listar(consulta: LicencasQuery): Promise<ListaDeLicencasResponse> {
    const linhas = await new LicencaRepository(this.dependencias.banco).listar(consulta)
    const { itens, proxima } = paginar(linhas, consulta.limite)
    const hoje = this.#hoje()
    return listaDeLicencasResponseSchema.parse({ itens: itens.map((item) => this.#paraResposta(item, hoje)), ...(proxima === undefined ? {} : { proxima }) })
  }

  /** `POST /v1/licencas`: a licença e a auditoria `licenca.registrada`, na mesma transação. */
  async registrar(pedido: RegistrarLicencaRequest): Promise<LicencaResponse> {
    const id = await this.dependencias.banco.transaction(async (tx) => {
      const novaId = await new LicencaRepository(tx).inserir(pedido)
      await registro.gravar(tx, 'licenca.registrada', { entidadeId: novaId, depois: { vigenteDesde: pedido.vigenteDesde, vigenteAte: pedido.vigenteAte ?? null } })
      return novaId
    })
    return this.#lerGravada(id)
  }

  /**
   * `PATCH /v1/licencas/:id`. A transação trava a linha (`for update`) antes de ler a vigência: o fim novo é conferido contra o começo que está gravado
   * **agora**, e a auditoria leva o "antes" que de fato encontrou. Dois `PATCH` ao mesmo tempo passam um depois do outro. O fim antes do começo é `ENTRADA_INVALIDA`.
   */
  async alterar(id: string, pedido: AlterarLicencaRequest): Promise<LicencaResponse> {
    await this.dependencias.banco.transaction(async (tx) => {
      const licencas = new LicencaRepository(tx)
      const antes = await licencas.travarVigencia(id)
      if (antes === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const depois = { vigenteDesde: pedido.vigenteDesde ?? antes.vigenteDesde, vigenteAte: pedido.vigenteAte === undefined ? antes.vigenteAte : pedido.vigenteAte }
      if (vigenciaInvalida(depois.vigenteDesde, depois.vigenteAte)) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
      if (!(await licencas.alterar(id, pedido))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      await registro.gravar(tx, 'licenca.alterada', { entidadeId: id, antes, depois })
    })
    return this.#lerGravada(id)
  }

  async #lerGravada(id: string): Promise<LicencaResponse> {
    const lida = await new LicencaRepository(this.dependencias.banco).porId(id)
    if (lida === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return this.#paraResposta(lida, this.#hoje())
  }
}
