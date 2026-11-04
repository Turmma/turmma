import { and, asc, eq } from 'drizzle-orm'
import { requireAnoEmCurso } from '../context/ano-em-curso.js'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { eventoCalendario } from '../db/schema/evento-calendario.js'
import { vinculo } from '../db/schema/vinculo.js'
import { requestSessao } from '../identidade/auth.guard.js'
import type { EventoGravado } from './importacao.repository.js'

/**
 * A leitura do calendário do ano (F2, 5.0; Tech Spec, seção 4): `GET /v1/calendario`. Escola, ano em curso e usuário vêm do
 * contexto (regra 10, item 3); o ano planejado que a coordenação escolhe chega já validado pelo `ImportacaoRepository.anoDeDestino`.
 * A escrita do calendário é do motor da planilha, e não passa por aqui.
 */
export class CalendarioRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** Os eventos do ano na escola do contexto, por data de início, depois de fim e id: a ordem que a tela mostra. Ano de outra escola não devolve linha. */
  doAno(anoLetivoId: string): Promise<EventoGravado[]> {
    return this.banco
      .select({ id: eventoCalendario.id, tipo: eventoCalendario.tipo, inicio: eventoCalendario.inicio, fim: eventoCalendario.fim, descricao: eventoCalendario.descricao })
      .from(eventoCalendario)
      .where(and(eq(eventoCalendario.escolaId, requireEscolaId()), eq(eventoCalendario.anoLetivoId, anoLetivoId)))
      .orderBy(asc(eventoCalendario.inicio), asc(eventoCalendario.fim), asc(eventoCalendario.id))
  }

  /**
   * Se o professor da sessão tem, hoje, vínculo `confirmado` em alguma turma do ano em curso da escola (RF16; regra 60, item
   * 8a): o calendário do professor vem da estrutura que a escola definiu, e o vínculo `pendente`, `contestado` ou `encerrado`
   * não o abre. Lido a cada chamada, nunca guardado no token: o vínculo encerrado fecha o calendário na mesma hora.
   */
  async professorTemVinculoConfirmado(): Promise<boolean> {
    const [achado] = await this.banco
      .select({ id: vinculo.id })
      .from(vinculo)
      .where(
        and(
          eq(vinculo.escolaId, requireEscolaId()),
          eq(vinculo.anoLetivoId, requireAnoEmCurso()),
          eq(vinculo.usuarioId, requestSessao().usuarioId),
          eq(vinculo.papel, 'professor'),
          eq(vinculo.estado, 'confirmado'),
        ),
      )
      .limit(1)
    return achado !== undefined
  }
}
