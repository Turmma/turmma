import { sql } from 'drizzle-orm'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA } from './aula.repository.js'

/** Uma aula da grade como o passo a vê: o vínculo, o dia da semana (1 segunda a 7 domingo) e o horário em `HH:MM`. */
export interface AulaDaGrade {
  readonly vinculoId: string
  readonly diaSemana: number
  readonly inicio: string
  readonly fim: string
}

/** O que a reimportação da grade muda nos vínculos que já existiam: as aulas que saem do ano e as que entram nele (as que só mudam de fim ou de sala, não). */
export interface MudancaDaGrade {
  readonly saem: readonly AulaDaGrade[]
  readonly entram: readonly AulaDaGrade[]
}

/** A aula que sai e a que entra, do mesmo vínculo e dia, pela ordem de início: o texto da velha vai para o horário da nova. */
interface Par {
  readonly vinculoId: string
  readonly diaSemana: number
  readonly velho: string
  readonly novo: string
  readonly fimNovo: string
}

/** A aula que sai sem par: o texto das datas de hoje em diante sai com ela. */
interface Sobra {
  readonly vinculoId: string
  readonly diaSemana: number
  readonly velho: string
}

/** Quantas linhas de `values` vão em cada comando: 500 pares são 2.500 parâmetros, longe dos 65.535 do protocolo. */
const TAMANHO_DO_LOTE = 500

const porInicio = (a: AulaDaGrade, b: AulaDaGrade): number => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0)

/**
 * Pareia, por (vínculo, dia da semana) e na ordem de início, as aulas que saem com as que entram (Tech Spec da semana-do-professor, seção 5,
 * "Reimportar a grade"). A k-ésima que sai leva o texto para a k-ésima que entra; a que sai e não acha par é `sobra`, e a que entra sem par não
 * tem texto a receber. Aula de outro dia da semana nunca é par: quem muda de dia perde o futuro do dia velho e não leva nada ao novo.
 */
export function parear(mudanca: MudancaDaGrade): { readonly pares: readonly Par[]; readonly sobras: readonly Sobra[] } {
  const grupos = new Map<string, { saem: AulaDaGrade[]; entram: AulaDaGrade[] }>()
  const grupoDe = ({ vinculoId, diaSemana }: AulaDaGrade): { saem: AulaDaGrade[]; entram: AulaDaGrade[] } => {
    const chave = JSON.stringify([vinculoId, diaSemana])
    const achado = grupos.get(chave) ?? { saem: [], entram: [] }
    grupos.set(chave, achado)
    return achado
  }
  for (const aula of mudanca.saem) grupoDe(aula).saem.push(aula)
  for (const aula of mudanca.entram) grupoDe(aula).entram.push(aula)
  const pares: Par[] = []
  const sobras: Sobra[] = []
  for (const { saem, entram } of grupos.values()) {
    const velhas = [...saem].sort(porInicio)
    const novas = [...entram].sort(porInicio)
    velhas.forEach((velha, posicao) => {
      const nova = novas[posicao]
      if (nova === undefined) sobras.push({ vinculoId: velha.vinculoId, diaSemana: velha.diaSemana, velho: velha.inicio })
      else pares.push({ vinculoId: velha.vinculoId, diaSemana: velha.diaSemana, velho: velha.inicio, novo: nova.inicio, fimNovo: nova.fim })
    })
  }
  return { pares, sobras }
}

/**
 * O texto da aula acompanha a reimportação da grade (F2b, tarefa 5.0; Tech Spec da semana-do-professor, seções 5 e 7c; RF13 e RF14). Roda na
 * transação do passo (3) do job `estrutura.gravar-planilha`, **entre `gravarAulas` e `encerrarOsMarcados`**: a escola é a do job
 * (`requireEscolaId()`) e o ano é o de destino da planilha; nenhum método recebe escola.
 *
 * Na ordem global da Tech Spec: o ano (`for share`, do motor) → a trava consultiva dos vínculos → a linha do vínculo (o `for update` do
 * `encerrarOsMarcados`, depois do passo). Primeiro as travas, num comando só e na ordem de `hashtext(escolaId ‖ vinculoId)`, a mesma chave da
 * gravação (`CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA`); só depois os comandos que leem e escrevem a `aula`, cada um com o instantâneo de depois da
 * trava: a gravação que estava na fila e confirmou dentro da espera é vista. O vínculo que a reimportação cria não existe para a gravação e não
 * entra no conjunto travado. O texto nunca vai a log nem a auditoria (regra 20, itens 9 e 10; seção 11 da Tech Spec), e o resumo e a prévia do F2
 * não mudam.
 */
export class TextoAcompanhaAGradeRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * Acompanha a mudança da grade: re-chaveia o texto do par (do início velho para o início e o `fim` novos, em todas as datas, menos onde um
   * registro fora da grade já ocupa o início novo, que fica onde está) e apaga o das aulas que saem sem par com `data >= hoje`. O passado dessas
   * fica na semana dele, fora da grade. `hoje` é o dia de Brasília (`AAAA-MM-DD`, `diaDeUso`), do relógio do job.
   */
  async acompanhar(anoLetivoId: string, mudanca: MudancaDaGrade, hoje: string): Promise<void> {
    const escolaId = requireEscolaId()
    const vinculos = [...new Set([...mudanca.saem, ...mudanca.entram].map(({ vinculoId }) => vinculoId))]
    if (vinculos.length === 0) return
    await this.travarVinculos(escolaId, vinculos)
    const { pares, sobras } = parear(mudanca)
    for (let inicio = 0; inicio < pares.length; inicio += TAMANHO_DO_LOTE) await this.rechavear(escolaId, anoLetivoId, pares.slice(inicio, inicio + TAMANHO_DO_LOTE))
    for (let inicio = 0; inicio < sobras.length; inicio += TAMANHO_DO_LOTE) await this.apagarOFuturo(escolaId, anoLetivoId, sobras.slice(inicio, inicio + TAMANHO_DO_LOTE), hoje)
  }

  /**
   * Toma a trava consultiva de cada vínculo num comando só, na ordem da chave: duas reimportações (de escolas diferentes ou não) nunca se esperam em
   * cruz, e a gravação, que toma uma só, não fecha ciclo com este passo. Vínculos de chave igual (colisão do `hashtext`) tomam a mesma trava duas vezes, o que é permitido.
   * A ordem vem do `order by` da subconsulta que o `select` de fora lê: o padrão SQL não a garante, o planejador do Postgres a mantém, e o caso
   * "as travas saem na ordem da chave" (`apps/api/test/semana-reimportacao.int.test.ts`) é quem a guarda.
   */
  private async travarVinculos(escolaId: string, vinculos: readonly string[]): Promise<void> {
    const valores = sql.join(
      vinculos.map((vinculoId) => sql`(${vinculoId}::uuid)`),
      sql`, `,
    )
    await this.banco.execute(sql`
      select pg_advisory_xact_lock(${CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA}, chave)
        from (select distinct hashtext(${escolaId}::uuid::text || v.id::text) as chave from (values ${valores}) as v(id) order by chave) as ordenadas
    `)
  }

  /** O texto do início velho passa a ser o do início novo, com o `fim` novo, exceto onde já há registro no início novo da mesma data. */
  private async rechavear(escolaId: string, anoLetivoId: string, pares: readonly Par[]): Promise<void> {
    const valores = sql.join(
      pares.map(({ vinculoId, diaSemana, velho, novo, fimNovo }) => sql`(${vinculoId}::uuid, ${diaSemana}::int, ${velho}::time, ${novo}::time, ${fimNovo}::time)`),
      sql`, `,
    )
    await this.banco.execute(sql`
      update aula as a
         set inicio = p.novo, fim = p.fim_novo
        from (values ${valores}) as p(vinculo_id, dia, velho, novo, fim_novo)
       where a.escola_id = ${escolaId}::uuid
         and a.ano_letivo_id = ${anoLetivoId}::uuid
         and a.vinculo_id = p.vinculo_id
         and extract(isodow from a.data)::int = p.dia
         and a.inicio = p.velho
         and not exists (
           select 1 from aula as ocupada
            where ocupada.escola_id = a.escola_id and ocupada.vinculo_id = a.vinculo_id and ocupada.data = a.data and ocupada.inicio = p.novo
         )
    `)
  }

  /** Apaga o texto de hoje em diante das aulas que saíram sem par; o de data anterior a hoje fica. */
  private async apagarOFuturo(escolaId: string, anoLetivoId: string, sobras: readonly Sobra[], hoje: string): Promise<void> {
    const valores = sql.join(
      sobras.map(({ vinculoId, diaSemana, velho }) => sql`(${vinculoId}::uuid, ${diaSemana}::int, ${velho}::time)`),
      sql`, `,
    )
    await this.banco.execute(sql`
      delete from aula as a
       using (values ${valores}) as s(vinculo_id, dia, velho)
       where a.escola_id = ${escolaId}::uuid
         and a.ano_letivo_id = ${anoLetivoId}::uuid
         and a.vinculo_id = s.vinculo_id
         and extract(isodow from a.data)::int = s.dia
         and a.inicio = s.velho
         and a.data >= ${hoje}::date
    `)
  }
}
