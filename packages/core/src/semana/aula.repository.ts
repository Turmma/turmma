import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { requireAnoEmCurso } from '../context/ano-em-curso.js'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { alocacao } from '../db/schema/alocacao.js'
import { anoLetivo } from '../db/schema/ano-letivo.js'
import { aula } from '../db/schema/aula.js'
import { eventoCalendario } from '../db/schema/evento-calendario.js'
import { vinculo } from '../db/schema/vinculo.js'
import { requestSessao } from '../identidade/auth.guard.js'

/**
 * A primeira metade da chave do `pg_advisory_xact_lock` que põe em fila, por vínculo, quem grava o texto da aula e o passo da grade que
 * mexe nele (F2b, Tech Spec da semana-do-professor, seções 5 e 7c). A segunda metade é `hashtext(escolaId ‖ vinculoId)`: a escola entra na
 * chave, e a chave de um vínculo da escola B nunca é a que a escola A calcula. As outras chaves do código são 7_000_001 (migração), 7_000_002
 * (operadores) e 7_000_003 (convite da escola). A tarefa 5.0 (o passo "o texto acompanha a grade") importa esta constante.
 */
export const CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA = 7_000_004

/** A espera máxima por uma trava de gravação do texto da aula: passada ela, a rota responde `INDISPONIVEL_TENTE_DE_NOVO` (`55P03`). */
const ESPERA_MAXIMA_DA_GRAVACAO_MS = 2_000

/**
 * O `statement_timeout` desta transação: a espera da trava é um comando só, e o `statement_timeout` da API (`BANCO_TIMEOUT_CONSULTA_MS`, 2 s)
 * a cortaria antes do `lock_timeout` de 2 s, com `57014` (`TEMPO_ESGOTADO`) no lugar do `55P03`. Com 1 s a mais, quem espera a trava é cortado pelo
 * `lock_timeout`, e a rota diz "tente de novo".
 */
const PRAZO_DA_GRAVACAO_MS = ESPERA_MAXIMA_DA_GRAVACAO_MS + 1_000

/**
 * A gravação do texto da aula da professora (F2b, tarefa 4.0; Tech Spec da semana-do-professor, seção 5, "Gravar"). Escola, ano e professora
 * vêm do contexto e da sessão (regra 10, item 3): nenhum método recebe escola, ano nem usuário. Quem chama roda numa transação e na ordem
 * global: `limitarEspera`, o ano em `for share` (`TurmaRepository.travarAnoEmCurso`), `vinculoDaProfessora` (lê **sem** trava de linha, e nunca
 * `VinculoRepository.travar`, que abre o ciclo com `encerrarOsMarcados`), só então `travarVinculo`, e por fim `fimDaAulaGravavel` e a escrita. O texto
 * nunca vai a log nem a auditoria (regra 20, itens 9 e 10; seção 11 da Tech Spec).
 */
export class AulaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * Os tempos desta transação (`set local`): espera por trava de 2 s, que vale para o ano, para a trava do vínculo e para qualquer linha, e o
   * `statement_timeout` de 3 s, para a espera acabar no `lock_timeout` (`PRAZO_DA_GRAVACAO_MS`).
   */
  async limitarEspera(): Promise<void> {
    requireEscolaId() // só afirma o contexto: sem escola autenticada não há transação de gravação (regra 10, item 3)
    await this.banco.execute(
      sql`select set_config('lock_timeout', ${String(ESPERA_MAXIMA_DA_GRAVACAO_MS)}, true), set_config('statement_timeout', ${String(PRAZO_DA_GRAVACAO_MS)}, true)`,
    )
  }

  /**
   * Se o vínculo é da professora da sessão, `confirmado`, de professor, da escola e do ano em curso do contexto. Vínculo de outra escola, de
   * colega, pendente, contestado, encerrado, de outro ano e id inexistente dão a mesma resposta: `false` (regra 10, itens 4 e 6). Lê sem trava
   * de linha: a conferência vem **antes** da trava consultiva, para quem não é dono do vínculo nunca ficar na fila do dono (R1b).
   */
  async vinculoDaProfessora(vinculoId: string): Promise<boolean> {
    const [achado] = await this.banco
      .select({ id: vinculo.id })
      .from(vinculo)
      .where(
        and(
          eq(vinculo.escolaId, requireEscolaId()),
          eq(vinculo.anoLetivoId, requireAnoEmCurso()),
          eq(vinculo.id, vinculoId),
          eq(vinculo.usuarioId, requestSessao().usuarioId),
          eq(vinculo.papel, 'professor'),
          eq(vinculo.estado, 'confirmado'),
        ),
      )
      .limit(1)
    return achado !== undefined
  }

  /**
   * Põe a transação na fila da trava do vínculo (`pg_advisory_xact_lock(7_000_004, hashtext(escolaId ‖ vinculoId))`); solta no commit ou no
   * rollback. Só se chama com um vínculo que `vinculoDaProfessora` achou: o id do cliente não vira chave antes da conferência.
   */
  async travarVinculo(vinculoId: string): Promise<void> {
    await this.banco.execute(
      sql`select pg_advisory_xact_lock(${CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA}, hashtext(${requireEscolaId()}::uuid::text || ${vinculoId}::uuid::text))`,
    )
  }

  /**
   * O `fim` a gravar, se a professora pode gravar o texto desta aula; `undefined` se não pode, e a rota responde `NAO_ENCONTRADO`. Cada cláusula que
   * falta tira a aula: (1) a data cai no ano em curso (o ano é o do contexto, travado pelo `for share` de quem chama); (2) o dia não é `feriado` nem
   * `recesso`; (3) há a alocação (vínculo, dia da semana, início), e o `fim` é o dela; ou (4) há um registro **passado** já gravado (`data < hoje`, e
   * hoje não é passado), que é o fora da grade e se corrige com o `fim` que tinha. `hoje` é o dia do fuso da escola, do relógio do service.
   */
  async fimDaAulaGravavel(vinculoId: string, data: string, inicio: string, hoje: string): Promise<string | undefined> {
    const escolaId = requireEscolaId()
    const anoLetivoId = requireAnoEmCurso()
    const [noAno] = await this.banco
      .select({ id: anoLetivo.id })
      .from(anoLetivo)
      .where(and(eq(anoLetivo.escolaId, escolaId), eq(anoLetivo.id, anoLetivoId), lte(anoLetivo.inicio, data), gte(anoLetivo.fim, data)))
      .limit(1)
    if (noAno === undefined) return undefined

    const [semAula] = await this.banco
      .select({ id: eventoCalendario.id })
      .from(eventoCalendario)
      .where(
        and(
          eq(eventoCalendario.escolaId, escolaId),
          eq(eventoCalendario.anoLetivoId, anoLetivoId),
          inArray(eventoCalendario.tipo, ['feriado', 'recesso']),
          lte(eventoCalendario.inicio, data),
          gte(eventoCalendario.fim, data),
        ),
      )
      .limit(1)
    if (semAula !== undefined) return undefined

    const [naGrade] = await this.banco
      .select({ fim: alocacao.fim })
      .from(alocacao)
      .where(
        and(
          eq(alocacao.escolaId, escolaId),
          eq(alocacao.anoLetivoId, anoLetivoId),
          eq(alocacao.vinculoId, vinculoId),
          eq(alocacao.diaSemana, sql`extract(isodow from ${data}::date)::int`),
          eq(alocacao.inicio, inicio),
        ),
      )
      .limit(1)
    if (naGrade !== undefined) return naGrade.fim

    const [passado] = await this.banco
      .select({ fim: aula.fim })
      .from(aula)
      .where(
        and(
          eq(aula.escolaId, escolaId),
          eq(aula.anoLetivoId, anoLetivoId),
          eq(aula.vinculoId, vinculoId),
          eq(aula.data, data),
          eq(aula.inicio, inicio),
          sql`${aula.data} < ${hoje}::date`,
        ),
      )
      .limit(1)
    return passado?.fim
  }

  /**
   * Grava o texto (já aparado, de 1 a 500): `insert … on conflict (vinculo_id, data, inicio) do update` de conteúdo, `fim` e `atualizadoEm`. O `fim` é o
   * da alocação ou, no registro fora da grade, o que ele já tinha. O `setWhere` repete a escola do contexto: com a FK composta e o vínculo já
   * conferido na escola, ele não é alcançável por dado consistente, e é a segunda camada se a linha for de outra escola. Se ela agisse, o `update` não
   * tocaria a linha e a rota ainda responderia 200: a resposta não refletiria o banco (hoje inalcançável, provado em `aulas.int.test.ts`).
   */
  async gravar(vinculoId: string, data: string, inicio: string, fim: string, texto: string): Promise<void> {
    const escolaId = requireEscolaId()
    await this.banco
      .insert(aula)
      .values({ escolaId, anoLetivoId: requireAnoEmCurso(), vinculoId, data, inicio, fim, conteudo: texto })
      .onConflictDoUpdate({
        target: [aula.vinculoId, aula.data, aula.inicio],
        set: { conteudo: texto, fim, atualizadoEm: sql`now()` },
        setWhere: eq(aula.escolaId, escolaId),
      })
  }

  /** Apaga o registro da aula, se houver: texto vazio é apagar, e apagar o que não existe não é erro. */
  async apagar(vinculoId: string, data: string, inicio: string): Promise<void> {
    await this.banco
      .delete(aula)
      .where(and(eq(aula.escolaId, requireEscolaId()), eq(aula.anoLetivoId, requireAnoEmCurso()), eq(aula.vinculoId, vinculoId), eq(aula.data, data), eq(aula.inicio, inicio)))
  }
}
