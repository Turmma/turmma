import type { EstadoDeAtividadeAplicada, ExtensaoDoLimite } from '@educa/shared'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { requireAnoEmCurso } from '../context/ano-em-curso.js'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { artefato } from '../db/schema/artefato.js'
import { atividadeAplicada } from '../db/schema/atividade-aplicada.js'
import { extensaoDeTempo } from '../db/schema/prova-online.js'
import { tentativaAtividade } from '../db/schema/tentativa-atividade.js'

/** A atividade aplicada travada para o encerramento, com o conteúdo do artefato, que tem o gabarito. */
export interface AplicacaoTravada {
  readonly id: string
  readonly turmaId: string
  readonly estado: EstadoDeAtividadeAplicada
  readonly disciplinaId: string
  readonly conteudo: unknown
}

/** A aplicação que a rotina trava: a travada de sempre, e o que decide se está vencida. */
export interface AplicacaoDaRotina extends AplicacaoTravada {
  readonly avaliativa: boolean
  /** Nulo na avaliativa de antes da F6, sem janela: a rotina não a encerra. */
  readonly fechaEm: Date | null
}

/** A tentativa em andamento (sem envio) com o que `limiteDaTentativa` pede dela. */
export interface AttemptInProgress {
  readonly id: string
  readonly alunoId: string
  readonly iniciadaEm: Date
  /** `limite_base_em`: nulo quando a prova não tem duração nem janela, e então não há limite. */
  readonly limiteBase: Date | null
}

/** A tentativa vencida, que o encerramento grava como enviada no limite. */
export interface TentativaVencida {
  readonly id: string
  readonly limite: Date
}

/**
 * O encerramento da prova no `core` (avaliacao-e-correcao, 6.0; Tech Spec §5.5 e §5.6, "Onde mora o miolo"): o que o encerramento da professora e a rotina que encerra a prova vencida
 * fazem **do mesmo jeito**, a partir da aplicação travada. Escola e ano são os do contexto, em toda consulta (regra 10, item 3); nenhum método os recebe. **Nada aqui confere a professora**:
 * quem encerra pela professora acha e trava a aplicação no alcance dela (`AtividadeAplicadaRepository.lock`), e a rotina roda sem pessoa (`lockDaRotina`), no contexto da escola do job.
 * O `for update` e a gravação valem dentro da transação de quem encerra; a medição do alerta só lê, com o banco.
 *
 * Nenhuma coluna daqui guarda nota, conceito nem texto sobre o aluno (D46, D55, D57).
 */
export class EncerramentoDaProvaRepository {
  constructor(private readonly tx: Database | DatabaseTransaction) {}

  /**
   * A aplicação da escola e do ano do contexto, **travada até o fim da transação** (`for update`): o segundo encerramento espera o primeiro, a extensão (que a toma em `for share`) e a resposta,
   * a tentativa e o envio do aluno também esperam ou são esperados. Sem o alcance da professora: é a da rotina, que o job de uma escola só alcança com o contexto dela.
   */
  async lockDaRotina(id: string): Promise<AplicacaoDaRotina | undefined> {
    const [linha] = await this.tx
      .select({
        id: atividadeAplicada.id,
        turmaId: atividadeAplicada.turmaId,
        estado: atividadeAplicada.estado,
        disciplinaId: artefato.disciplinaId,
        conteudo: artefato.conteudo,
        avaliativa: atividadeAplicada.avaliativa,
        fechaEm: atividadeAplicada.fechaEm,
      })
      .from(atividadeAplicada)
      .innerJoin(artefato, and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId)))
      .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id)))
      .for('update', { of: atividadeAplicada })
    return linha
  }

  /** `aberta` → `encerrada`, com a hora do banco. A já encerrada não muda: a data do primeiro encerramento fica. */
  async encerrar(id: string): Promise<void> {
    await this.tx
      .update(atividadeAplicada)
      .set({ estado: 'encerrada', encerradaEm: sql`now()` })
      .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
  }

  /** As tentativas da aplicação que ainda não foram enviadas, na ordem do id: o que o limite de cada uma decide. */
  async tentativasEmAndamento(atividadeAplicadaId: string): Promise<AttemptInProgress[]> {
    return this.tx
      .select({ id: tentativaAtividade.id, alunoId: tentativaAtividade.alunoId, iniciadaEm: tentativaAtividade.iniciadaEm, limiteBase: tentativaAtividade.limiteBaseEm })
      .from(tentativaAtividade)
      .where(
        and(
          eq(tentativaAtividade.escolaId, requireEscolaId()),
          eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()),
          eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId),
          isNull(tentativaAtividade.enviadaEm),
        ),
      )
      .orderBy(asc(tentativaAtividade.id))
  }

  /** Todas as extensões da aplicação, as de cada aluno e as da turma (`alunoId` nulo): `limiteDaTentativa` escolhe as de cada aluno, e a janela soma as da turma. */
  async extensoes(atividadeAplicadaId: string): Promise<ExtensaoDoLimite[]> {
    return this.tx
      .select({ alunoId: extensaoDeTempo.alunoId, minutos: extensaoDeTempo.minutos })
      .from(extensaoDeTempo)
      .where(and(eq(extensaoDeTempo.escolaId, requireEscolaId()), eq(extensaoDeTempo.anoLetivoId, requireAnoEmCurso()), eq(extensaoDeTempo.atividadeAplicadaId, atividadeAplicadaId)))
  }

  /**
   * **O encerramento grava o fato** (§5.5): cada tentativa vencida recebe `enviada_em` igual ao **limite** dela (nunca o `now()` do encerramento) e `envio = 'limite'`. Só a que ainda
   * está sem envio: a enviada pelo aluno entre a leitura e a gravação (impossível com a aplicação travada, mas é a barreira) não muda.
   */
  async registrarVencidas(atividadeAplicadaId: string, vencidas: readonly TentativaVencida[]): Promise<void> {
    for (const { id, limite } of vencidas) {
      await this.tx
        .update(tentativaAtividade)
        .set({ enviadaEm: limite, envio: 'limite' })
        .where(
          and(
            eq(tentativaAtividade.escolaId, requireEscolaId()),
            eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()),
            eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId),
            eq(tentativaAtividade.id, id),
            isNull(tentativaAtividade.enviadaEm),
          ),
        )
    }
  }
}
