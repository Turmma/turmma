import { DomainException, ImportacaoRepository, MotorDePlanilha, requireEscolaId, type Database, type SchoolSemaphore } from '@educa/core'
import { ErrorCode, gravarPlanilhaResponseSchema, importacaoSchema, type GravarPlanilhaRequest, type GravarPlanilhaResponse, type Importacao, type PreviaDaPlanilhaRequest, type PreviaDaPlanilhaResponse, type TipoDePlanilha } from '@educa/shared'

/** Quanto tempo o cliente espera para tentar de novo quando as vagas da escola estão cheias: a prévia de 3.000 linhas leva até 2 s. */
const ESPERA_QUANDO_CHEIO_SEGUNDOS = 2

/**
 * As planilhas da escola pela coordenação (F2, 4.0 e 5.0). A classificação, a trava e a gravação moram no motor de `@educa/core`, que a
 * API e o worker usam pelo mesmo caminho; aqui a rota só entrega o pedido, confere a forma da resposta e segura a vaga da escola
 * enquanto a prévia e o gravar classificam (no máximo duas ao mesmo tempo por escola, no Redis, com prazo de validade). Nada
 * disto loga: o texto da planilha tem nome e matrícula, e o erro sai pelo filtro global só com id.
 */
export class ImportacaoService {
  constructor(
    private readonly motor: MotorDePlanilha,
    private readonly banco: Database,
    private readonly vagas: Pick<SchoolSemaphore, 'ocupar'>,
  ) {}

  previa(tipo: TipoDePlanilha, pedido: PreviaDaPlanilhaRequest): Promise<PreviaDaPlanilhaResponse> {
    return this.comVaga(() => this.motor.previa(tipo, pedido))
  }

  gravar(tipo: TipoDePlanilha, pedido: GravarPlanilhaRequest): Promise<GravarPlanilhaResponse> {
    return this.comVaga(async () => gravarPlanilhaResponseSchema.parse(await this.motor.gravar(tipo, pedido)))
  }

  /** `GET /v1/importacoes/:id`: o estado e as contagens da importação da escola da sessão. Id de outra escola é igual a inexistente. */
  async ler(id: string): Promise<Importacao> {
    const lida = await new ImportacaoRepository(this.banco).lerPorId(id)
    if (lida === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return importacaoSchema.parse({ ...lida, criadoEm: lida.criadoEm.toISOString(), concluidaEm: lida.concluidaEm?.toISOString() ?? null })
  }

  /** Ocupa a vaga da escola da sessão para o trabalho e a devolve no fim, com êxito ou erro. Vagas cheias: `LIMITE_EXCEDIDO`, e a outra escola segue. */
  private async comVaga<T>(trabalho: () => Promise<T>): Promise<T> {
    const vaga = await this.vagas.ocupar(requireEscolaId())
    if (vaga === undefined) throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, ESPERA_QUANDO_CHEIO_SEGUNDOS)
    try {
      return await trabalho()
    } finally {
      await vaga.liberar()
    }
  }
}
