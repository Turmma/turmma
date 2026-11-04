import { CalendarioRepository, DomainException, ImportacaoRepository, requestSessao, requireAnoEmCurso, type Database } from '@educa/core'
import { alcanceDe, calendarioResponseSchema, ErrorCode, type CalendarioQuery, type CalendarioResponse } from '@educa/shared'

/**
 * O calendário do ano para quem o lê (F2, 5.0; Tech Spec, seção 4; regra 60, item 8). A coordenação lê o da escola: sem filtro, o do
 * ano em curso; com `anoLetivoId`, só o do ano `planejado` da escola da sessão. O professor lê o do ano em curso, e só enquanto tem
 * vínculo `confirmado` (o alcance `turma_vinculada` da matriz); com filtro de ano, ou sem vínculo confirmado, a resposta é a do
 * inexistente (regra 10, item 6), igual à do ano de outra escola.
 */
export class CalendarioService {
  constructor(private readonly banco: Database) {}

  async ler(consulta: CalendarioQuery): Promise<CalendarioResponse> {
    const calendario = new CalendarioRepository(this.banco)
    const alcance = alcanceDe(requestSessao().papel, 'calendario', 'ler')
    if (alcance === 'unidade') {
      const ano = await new ImportacaoRepository(this.banco).anoDeDestino(consulta.anoLetivoId)
      if (ano === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      return calendarioResponseSchema.parse({ eventos: await calendario.doAno(ano.id) })
    }
    if (alcance !== 'turma_vinculada' || consulta.anoLetivoId !== undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const anoEmCurso = requireAnoEmCurso()
    if (!(await calendario.professorTemVinculoConfirmado())) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return calendarioResponseSchema.parse({ eventos: await calendario.doAno(anoEmCurso) })
  }
}
