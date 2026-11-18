import { FUNCAO_DA_TAREFA_DE_IA, TIPO_EXECUTAR_LOTE, type ComponenteBncc } from '@educa/shared'
import { and, asc, eq, exists, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { requireEscolaId } from '../context/context-escola.js'
import type { DatabaseTransaction } from '../db/database.js'
import { disciplina } from '../db/schema/disciplina.js'
import { execucaoAgente } from '../db/schema/execucao-agente.js'
import { habilidadeDaSecao, material, materialSerie, secaoDoMaterial } from '../db/schema/material.js'
import { serie } from '../db/schema/serie.js'
import { suspensaoDeFuncao } from '../db/schema/suspensao-de-funcao.js'
import { SECOES_POR_EXECUCAO } from '../ia/tasks/classificar-secoes.js'
import type { JobOutbox } from '../queue/job-outbox.js'

/** Depois de quantas execuções seguidas que falharam com `IA_SAIDA_INVALIDA` a seção espera o reclassificar: a quarta noite não chama o modelo (Tech Spec, seção 5, "Agendar"). */
export const TETO_DE_FALHAS_SEGUIDAS = 3
/** As seções que cada lote do agendamento lê e agenda, cada lote numa transação (Tech Spec, seção 7c, "Laços"). */
export const SECOES_POR_LOTE_DO_AGENDAMENTO = 500
/**
 * O limite de execuções que o job de uma escola cria numa noite. Mil execuções são 12 mil seções, quase o dobro das 7.500 de 300 apostilas de 25 capítulos (630 execuções, 15 lotes de 42): o onboarding cabe com folga, e o que passar
 * do limite sai na noite seguinte. É o freio de custo da rotina, a R$ 4 a R$ 20 por 630 execuções (Tech Spec, seção 8): a escola nunca passa de ~R$ 32 numa noite.
 */
export const EXECUCOES_POR_NOITE_DA_ESCOLA = 1_000
/** A função suspensível a que a classificação pertence. */
const FUNCAO_DA_CLASSIFICACAO = FUNCAO_DA_TAREFA_DE_IA.classificar_secoes

/** A seção que o agendamento leu: o `execucao_id` que ela tinha (`execucaoLida`) é a condição de o agendamento a trocar (P9). */
export interface SecaoParaAgendar {
  readonly secaoId: string
  readonly materialId: string
  readonly execucaoLida: string | null
  readonly falhasSeguidas: number
  readonly componente: ComponenteBncc
}

export interface Agendado {
  /** As execuções criadas, cada uma com pelo menos uma seção (a que perdeu a corrida não deixa execução). */
  readonly execucoes: number
  /** As seções que passaram a uma execução nova. */
  readonly secoes: number
}

/** O que escolhe as seções a agendar além da regra da rotina: as de um material (a extração), as depois de um cursor (o laço da rotina) ou as que a mudança de recorte acabou de limpar (`secaoIds`). */
export interface FiltroDoAgendamento {
  readonly materialId?: string
  readonly depoisDe?: string
  readonly secaoIds?: readonly string[]
}

/** O que a mudança de recorte refaz: o material cujas séries mudaram, ou a disciplina cujo componente mudou (todos os materiais dela). */
export type AlvoDaMudancaDeRecorte = { readonly materialId: string } | { readonly disciplinaId: string }

/**
 * O agendamento da classificação (classificacao-bncc, tarefa 5.0; Tech Spec, seções 5 "Seções" e "Agendar" (a), e 7c "Laços"): lê as seções que precisam de execução e cria as execuções `classificar_secoes` delas, com o
 * job `ia.executar-lote` de cada uma, **na transação de quem chama** (a extração do material, ou um lote do job da escola). Mora no `core` porque a extração (`apps/worker`, fila `pdf`) e o job da escola (`apps/worker`,
 * `lote`) o usam, e o domínio da IA (`apps/api`) não é importável por app.
 *
 * - **O que se agenda** (`proximasSecoes`): a seção **não corrigida** de material `pronto` e não excluído, com componente na disciplina e série declarada, **sem execução, ou com a última `falhou` e `falhas_seguidas`
 *   abaixo de 3**. Nunca a `aguardando` (execução `pendente` ou `rodando`), nem a `classificada` ou `sem_habilidade` (execução `concluida`), nem a de material sem componente ou sem série: essa volta quando o professor ou a
 *   coordenação os definir (mudança de recorte, 6.0).
 * - **Uma execução é de um recorte**: as seções do mesmo componente e das mesmas séries vão juntas, até 12 por execução (`SECOES_POR_EXECUCAO`). A seção com `falhas_seguidas > 0` vai numa execução **só dela**, para a que
 *   provoca a falha chegar a 3 sozinha e as outras onze não pagarem por ela.
 * - **Corrida entre quem agenda** (P9: a rotina duas vezes, entre réplicas ou na reentrega; a rotina e a mudança de recorte): a troca do `execucao_id` leva `execucao_id is not distinct from :lido`. O segundo a chegar não
 *   troca nada, e a execução que ele acabou de criar sai na mesma transação, sem job e sem chamar o modelo.
 * - **A função suspensa não agenda**: `funcaoEstaAtiva` é a conferência, lida a cada lote por quem chama.
 *
 * **Não tire o termo de escola do `update` cru nem do `delete` da execução que perdeu a corrida (`#criarExecucao`).** Nenhum teste os distingue, porque a leitura com escopo e a FK composta já protegem
 * (a seção da B não chega até aqui no contexto da A, e a execução da A não aponta para seção da B): são a defesa em profundidade da regra 10, item 3, e uma refatoração não pode levá-los.
 *
 * A escola é a do contexto, em toda consulta (regra 10, item 3); nenhum método a recebe. Sem pessoa nem ano: a execução da rotina não tem `solicitada_por` nem `ano_letivo_id`.
 */
export class AgendamentoDaClassificacaoRepository {
  constructor(private readonly tx: DatabaseTransaction) {}

  /** A função da classificação não está suspensa na escola do contexto: a suspensão vigente é a que não foi retomada. */
  async funcaoEstaAtiva(): Promise<boolean> {
    const vigentes = await this.tx
      .select({ id: suspensaoDeFuncao.id })
      .from(suspensaoDeFuncao)
      .where(and(eq(suspensaoDeFuncao.escolaId, requireEscolaId()), eq(suspensaoDeFuncao.funcao, FUNCAO_DA_CLASSIFICACAO), isNull(suspensaoDeFuncao.retomadaEm)))
      .limit(1)
    return vigentes.length === 0
  }

  /** As próximas seções a agendar, na ordem do id, até `limite`: a regra da rotina das 19h, e a mesma da extração do material (as seções dele acabaram de nascer, sem execução). */
  async proximasSecoes(limite: number, filtro: FiltroDoAgendamento = {}): Promise<SecaoParaAgendar[]> {
    const escolaId = requireEscolaId()
    const linhas = await this.tx
      .select({
        secaoId: secaoDoMaterial.id,
        materialId: secaoDoMaterial.materialId,
        execucaoLida: secaoDoMaterial.execucaoId,
        falhasSeguidas: secaoDoMaterial.falhasSeguidas,
        componente: disciplina.componenteBncc,
      })
      .from(secaoDoMaterial)
      .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
      .innerJoin(disciplina, and(eq(disciplina.escolaId, material.escolaId), eq(disciplina.id, material.disciplinaId)))
      .leftJoin(execucaoAgente, and(eq(execucaoAgente.escolaId, secaoDoMaterial.escolaId), eq(execucaoAgente.id, secaoDoMaterial.execucaoId)))
      .where(
        and(
          eq(secaoDoMaterial.escolaId, escolaId),
          isNull(secaoDoMaterial.corrigidaEm),
          eq(material.estado, 'pronto'),
          isNull(material.excluidoEm),
          sql`${disciplina.componenteBncc} is not null`,
          exists(
            this.tx
              .select({ um: sql`1` })
              .from(materialSerie)
              .where(and(eq(materialSerie.escolaId, secaoDoMaterial.escolaId), eq(materialSerie.materialId, secaoDoMaterial.materialId))),
          ),
          or(isNull(secaoDoMaterial.execucaoId), and(eq(execucaoAgente.estado, 'falhou'), lt(secaoDoMaterial.falhasSeguidas, TETO_DE_FALHAS_SEGUIDAS))),
          filtro.materialId === undefined ? undefined : eq(secaoDoMaterial.materialId, filtro.materialId),
          filtro.depoisDe === undefined ? undefined : gt(secaoDoMaterial.id, filtro.depoisDe),
          filtro.secaoIds === undefined ? undefined : inArray(secaoDoMaterial.id, [...filtro.secaoIds]),
        ),
      )
      .orderBy(asc(secaoDoMaterial.id))
      .limit(limite)
    return linhas.flatMap((linha) => (linha.componente === null ? [] : [{ ...linha, componente: linha.componente }]))
  }

  /**
   * **Limpar** (Tech Spec, seção 5, "Agendar" (b); P10): o lote seguinte das seções **não corrigidas** do alvo, na ordem do id e depois do cursor. Lê cada uma `for update`, e só então apaga as habilidades `origem: 'ia'`, anula
   * o `execucao_id` e zera `falhas_seguidas` e `classificada_em`. A ordem é a regra: o `concluir` que ainda não confirmou (P10a) segura a seção, a limpeza espera e apaga os códigos que ele acabou de gravar; o que chega depois
   * (P10b) acha o `execucao_id` nulo e não grava. A seção corrigida pela coordenação nunca entra: a correção fica. Devolve os ids limpos (os que agendar em seguida) e o último lido, que é o cursor do lote seguinte.
   *
   * O `select ... for update` é quem decide quais seções entram (escola, não corrigida, alvo, cursor): o `delete` e o `update` só agem sobre os ids que ele devolveu, já travados, e por isso a corrigida não precisa ser
   * conferida de novo (ninguém a corrige no meio, a trava é nossa). O material do alvo entra em qualquer estado (`processando`, excluído): o que não é `pronto` não será agendado, e uma seção sem execução nem código é o que ele deve ter. A escola é a do contexto, em toda consulta.
   */
  async limparDoRecorte(alvo: AlvoDaMudancaDeRecorte, limite: number, depoisDe?: string): Promise<{ limpas: string[]; ultima: string | undefined }> {
    const escolaId = requireEscolaId()
    const doAlvo = 'materialId' in alvo ? eq(secaoDoMaterial.materialId, alvo.materialId) : eq(material.disciplinaId, alvo.disciplinaId)
    const travadas = await this.tx
      .select({ id: secaoDoMaterial.id })
      .from(secaoDoMaterial)
      .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
      .where(and(eq(secaoDoMaterial.escolaId, escolaId), isNull(secaoDoMaterial.corrigidaEm), doAlvo, depoisDe === undefined ? undefined : gt(secaoDoMaterial.id, depoisDe)))
      .orderBy(asc(secaoDoMaterial.id))
      .limit(limite)
      .for('update', { of: secaoDoMaterial })
    const ultima = travadas.at(-1)?.id
    const ids = travadas.map((travada) => travada.id)
    if (ids.length === 0) return { limpas: [], ultima }
    await this.tx.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), inArray(habilidadeDaSecao.secaoId, ids), eq(habilidadeDaSecao.origem, 'ia')))
    await this.tx
      .update(secaoDoMaterial)
      .set({ execucaoId: null, falhasSeguidas: 0, classificadaEm: null })
      .where(and(eq(secaoDoMaterial.escolaId, escolaId), inArray(secaoDoMaterial.id, ids)))
    return { limpas: ids, ultima }
  }

  /**
   * Cria as execuções das seções lidas e os jobs delas. `enfileirador` é o `JobOutbox`: o job `ia.executar-lote` nasce na fila `lote`, não urgente, com a **execução por chave**, na mesma transação. A seção cujo
   * material perdeu a série entre a leitura e aqui (corrida com a mudança de séries) fica como está.
   *
   * `maximoDeExecucoes` é o que ainda cabe no limite da noite da escola: com ele, o agendamento para ao criar essa quantidade, e as seções que sobraram ficam como estão (quem chama para o laço, pois o limite foi
   * alcançado). Sem ele, não há teto: é o caso da extração, que agenda no máximo as seções de um material.
   */
  async agendar(secoes: readonly SecaoParaAgendar[], enfileirador: Pick<JobOutbox, 'enfileirarUmaVez'>, maximoDeExecucoes = Number.POSITIVE_INFINITY): Promise<Agendado> {
    if (secoes.length === 0) return { execucoes: 0, secoes: 0 }
    const grupos = await this.#agrupar(secoes)
    let execucoes = 0
    let agendadas = 0
    for (const grupo of grupos.values()) {
      for (let inicio = 0; inicio < grupo.length && execucoes < maximoDeExecucoes; inicio += SECOES_POR_EXECUCAO) {
        const trocadas = await this.#criarExecucao(grupo.slice(inicio, inicio + SECOES_POR_EXECUCAO), enfileirador)
        if (trocadas === 0) continue
        execucoes += 1
        agendadas += trocadas
      }
    }
    return { execucoes, secoes: agendadas }
  }

  /** As seções por execução que vão nascer: a que já falhou, sozinha; as outras, com as do mesmo componente e das mesmas séries. A seção cujo material perdeu a série fica de fora. */
  async #agrupar(secoes: readonly SecaoParaAgendar[]): Promise<Map<string, SecaoParaAgendar[]>> {
    const recortes = await this.#seriesDosMateriais([...new Set(secoes.map((alvo) => alvo.materialId))])
    const grupos = new Map<string, SecaoParaAgendar[]>()
    for (const alvo of secoes) {
      const series = recortes.get(alvo.materialId)
      if (series === undefined) continue
      const chave = alvo.falhasSeguidas > 0 ? `falha|${alvo.secaoId}` : `${alvo.componente}|${series}`
      grupos.set(chave, [...(grupos.get(chave) ?? []), alvo])
    }
    return grupos
  }

  /** As séries de cada material, em texto (`ef_anos_finais6,ef_anos_finais7`) para o agrupamento por recorte. O material sem série não aparece. */
  async #seriesDosMateriais(materialIds: readonly string[]): Promise<Map<string, string>> {
    const linhas = await this.tx
      .select({ materialId: materialSerie.materialId, etapa: serie.etapa, ano: serie.ano })
      .from(materialSerie)
      .innerJoin(serie, and(eq(serie.escolaId, materialSerie.escolaId), eq(serie.id, materialSerie.serieId)))
      .where(and(eq(materialSerie.escolaId, requireEscolaId()), inArray(materialSerie.materialId, [...materialIds])))
    const porMaterial = new Map<string, string[]>()
    for (const linha of linhas) porMaterial.set(linha.materialId, [...(porMaterial.get(linha.materialId) ?? []), `${linha.etapa}${String(linha.ano)}`])
    return new Map([...porMaterial].map(([materialId, series]) => [materialId, series.sort().join(',')]))
  }

  /** A execução de até 12 seções: grava a linha, troca o `execucao_id` com a condição de P9 e, se alguma seção trocou, enfileira o job. Devolve quantas seções trocaram. */
  async #criarExecucao(secoes: readonly SecaoParaAgendar[], enfileirador: Pick<JobOutbox, 'enfileirarUmaVez'>): Promise<number> {
    const escolaId = requireEscolaId()
    const [execucao] = await this.tx
      .insert(execucaoAgente)
      .values({
        escolaId,
        anoLetivoId: null,
        funcao: FUNCAO_DA_CLASSIFICACAO,
        tarefa: 'classificar_secoes',
        solicitadaPor: null,
        chaveEnvio: randomUUID(),
        entrada: { tarefa: 'classificar_secoes' },
      })
      .returning({ id: execucaoAgente.id })
    if (execucao === undefined) return 0
    const valores = sql.join(
      secoes.map((alvo) => sql`(${alvo.secaoId}::uuid, ${alvo.execucaoLida}::uuid)`),
      sql`, `,
    )
    const trocadas = await this.tx.execute(sql`
      update secao_do_material s set execucao_id = ${execucao.id}
        from (values ${valores}) as lida(id, execucao_id)
       where s.escola_id = ${escolaId}
         and s.id = lida.id
         and s.execucao_id is not distinct from lida.execucao_id
         and s.corrigida_em is null`)
    const total = trocadas.rowCount ?? 0
    if (total === 0) {
      // Outro agendamento chegou primeiro: a execução que sobrou não tem seção, e sai sem job.
      await this.tx.delete(execucaoAgente).where(and(eq(execucaoAgente.escolaId, escolaId), eq(execucaoAgente.id, execucao.id)))
      return 0
    }
    await enfileirador.enfileirarUmaVez(this.tx, TIPO_EXECUTAR_LOTE, { execucaoId: execucao.id }, execucao.id, { fila: 'lote' })
    return total
  }
}
