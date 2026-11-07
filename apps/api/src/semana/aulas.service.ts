import { AulaRepository, DEFAULT_RETRY_AFTER_SECONDS, DomainException, diaDeUso, postgresErrorIn, systemClock, type Clock, type Database } from '@educa/core'
import { TurmaRepository } from '@educa/core/estrutura'
import { ErrorCode, gravarAulaResponseSchema, type GravarAulaRequest, type GravarAulaResponse } from '@educa/shared'

/** SQLSTATE `lock_not_available`: o `lock_timeout` de 2 s estourou na fila da trava. */
const TRAVA_NAO_DISPONIVEL = '55P03'

/**
 * A professora grava o que vai dar numa aula (F2b, tarefa 4.0; Tech Spec da semana-do-professor, seção 5, "Gravar"), numa transação com
 * `lock_timeout` de 2 s e `statement_timeout` de 3 s (o da API, 2 s, cortaria a espera da trava antes do `lock_timeout`), na ordem global: (1) o ano em curso em `for share` (ordena com a virada); (2) o vínculo é dela, `confirmado`, da escola e do
 * ano, lido sem trava de linha; (3) só então a trava consultiva do vínculo; (4) a data cai no ano, num dia sem feriado nem recesso, com a alocação ou
 * com um registro passado já gravado. Faltou uma, `NAO_ENCONTRADO` e nada gravado, a mesma resposta para o que não é dela e para o que não existe
 * (regra 10, item 6). Texto vazio apaga; senão grava (upsert). `55P03` vira `INDISPONIVEL_TENTE_DE_NOVO`. Nada de auditoria, e o texto nunca vai a log.
 */
export class AulasService {
  constructor(
    private readonly banco: Database,
    private readonly relogio: Clock = systemClock,
  ) {}

  async gravar({ vinculoId, data, inicio, texto }: GravarAulaRequest): Promise<GravarAulaResponse> {
    const hoje = diaDeUso(this.relogio.agora())
    try {
      await this.banco.transaction(async (tx) => {
        const aulas = new AulaRepository(tx)
        await aulas.limitarEspera()
        if (!(await new TurmaRepository(tx).travarAnoEmCurso())) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        if (!(await aulas.vinculoDaProfessora(vinculoId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        await aulas.travarVinculo(vinculoId)
        const fim = await aulas.fimDaAulaGravavel(vinculoId, data, inicio, hoje)
        if (fim === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        if (texto === '') await aulas.apagar(vinculoId, data, inicio)
        else await aulas.gravar(vinculoId, data, inicio, fim, texto)
      })
    } catch (erro) {
      if (postgresErrorIn(erro)?.code === TRAVA_NAO_DISPONIVEL) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
      throw erro
    }
    return gravarAulaResponseSchema.parse({ vinculoId, data, inicio, texto: texto === '' ? null : texto })
  }
}
