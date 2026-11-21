import {
  FUSO_DO_ORCAMENTO,
  mesDeSaoPaulo,
  orcamentoDoMes,
  orcamentoSemRetrato,
  orcamentoVigente,
  type OrcamentoDefinido,
  type OrcamentoDoMes,
  type OrcamentoVigente,
  type RetratoDoOrcamento,
} from '@educa/shared'
import { and, eq, gte, lt, sql, type SQL } from 'drizzle-orm'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { configuracaoOperacionalEscola } from '../db/schema/configuracao-operacional-escola.js'
import { consumoIa } from '../db/schema/consumo-ia.js'
import { orcamentoIaDoMes } from '../db/schema/orcamento-ia-do-mes.js'

/**
 * Quantos alunos ativos tem a escola `escolaId`: **só o id do contexto (`requireEscolaId()`) ou, num método `@Unscoped` da Operação, o `e.id` da consulta de quem embute; nunca um valor vindo de requisição** (regra 10,
 * item 3: o escopo vem do contexto, e quem passar a usar este trecho confere isso). Ele recebe uma referência SQL, não o id: vínculo de aluno **não encerrado** no ano `em_curso`, de usuário não
 * desativado, contando cada aluno uma vez (o aluno em duas turmas do ano). Sem ano em curso, zero. É a conta da aba Escolas da Operação (`PainelRepository.escolas`), e o `uso()` da Operação a embute com este
 * mesmo trecho (camada-ia 5.0): o orçamento e a tela partem do mesmo número (RF8).
 */
export function alunosAtivosDaEscola(escolaId: SQL): SQL {
  return sql`(select count(distinct v.usuario_id)::int
    from vinculo as v
    join usuario as pessoa on pessoa.escola_id = v.escola_id and pessoa.id = v.usuario_id
    join ano_letivo as ano on ano.escola_id = v.escola_id and ano.id = v.ano_letivo_id and ano.situacao = 'em_curso'
    where v.escola_id = ${escolaId} and v.papel = 'aluno' and v.encerrado_em is null and pessoa.desativado_em is null)`
}

/** O mês `AAAA-MM` como o dia 1 que o retrato grava (`2026-03-01`). */
const primeiroDiaDoMes = (mes: string): string => `${mes}-01`

/**
 * O orçamento de IA da escola do contexto (camada-ia, tarefa 2.0; Tech Spec, seções 3, 5 e 6; RF7 e RF8): o consumo do mês, os alunos ativos, o valor e o teto da escola e da rede, o retrato do mês e a regravação
 * dele. Escreve também a configuração da escola do `PUT` da Operação (3.0: `lockConfiguracaoDaEscola` e `saveConfiguracaoDaEscola`, na transação do `PUT`). A API (Governança, Operação), o lote (o teto, 4.0) e a medida (4.0) leem por aqui, e a conta é a de `orcamentoDoMes`, em `@educa/shared`. **Nenhum método é `@Unscoped`**: toda leitura parte da escola do
 * contexto (`requireEscolaId()`), e a rede é lida pelo `escola.rede_id` dela, nunca por id vindo de fora. Só o `PUT` da rede, acima do tenant, é exceção, e mora em outro repository (3.0).
 *
 * O mês é o **civil de São Paulo** (`AAAA-MM`), e o "agora" entra como parâmetro: nenhuma conta lê o relógio do banco. O mês corrente nunca se lê do retrato: é calculado na hora; o fechado lê o retrato, com
 * o número de alunos e o valor de quando ele fechou.
 */
export class OrcamentoDoMesRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * A consulta da soma do mês, sem executá-la: o `EXPLAIN` do teste lê o plano **desta** consulta. A faixa é a do mês civil de São Paulo, `[dia 1 às 00h, dia 1 do mês seguinte às 00h)`, e começa pela
   * escola (o `consumo_ia_mes_idx`).
   */
  consultaDoCustoDoMes(mes: string) {
    const inicio = primeiroDiaDoMes(mes)
    return this.banco
      .select({ total: sql<string | null>`sum(${consumoIa.custoMicros})` })
      .from(consumoIa)
      .where(
        and(
          eq(consumoIa.escolaId, requireEscolaId()),
          gte(consumoIa.em, sql`(${inicio}::date)::timestamp at time zone ${FUSO_DO_ORCAMENTO}`),
          lt(consumoIa.em, sql`((${inicio}::date + interval '1 month')::timestamp at time zone ${FUSO_DO_ORCAMENTO})`),
        ),
      )
  }

  /** O custo, em micros, das chamadas da escola no mês civil de São Paulo (`AAAA-MM`): a soma do `custo_micros` gravado de cada linha, nunca recalculado pelo preço de hoje. Mês sem chamada soma nulo, e vale zero. */
  async custoDoMes(mes: string): Promise<number> {
    const [linha] = await this.consultaDoCustoDoMes(mes)
    return Number(linha?.total ?? 0)
  }

  /** Os alunos ativos de hoje, pela regra da aba Escolas (`alunosAtivosDaEscola`). */
  async alunosAtivos(): Promise<number> {
    const { rows } = await this.banco.execute<{ total: number }>(sql`select ${alunosAtivosDaEscola(sql`${requireEscolaId()}::uuid`)} as total`)
    // O `select` sem `from` devolve uma linha só; somar as linhas dispensa um valor padrão para a ausência dela.
    return rows.reduce((soma, linha) => soma + linha.total, 0)
  }

  /** O que a escola do contexto define: nulo onde não definiu, e nulo nas duas colunas se ela não tem linha de configuração. */
  async configuracaoDaEscola(): Promise<OrcamentoDefinido> {
    const [linha] = await this.banco
      .select({ valorPorAlunoMicros: configuracaoOperacionalEscola.iaValorPorAlunoMicros, tetoPercentual: configuracaoOperacionalEscola.iaTetoDeSegurancaPercentual })
      .from(configuracaoOperacionalEscola)
      .where(eq(configuracaoOperacionalEscola.escolaId, requireEscolaId()))
    return { valorPorAlunoMicros: linha?.valorPorAlunoMicros ?? null, tetoPercentual: linha?.tetoPercentual ?? null }
  }

  /**
   * A primeira metade do `PUT` da escola do contexto (camada-ia, 3.0; Tech Spec, seção 5): garante a linha de `configuracao_operacional_escola` (`insert … on conflict do nothing`: o painel não a cria, e a escola
   * sem linha é a que o `PUT` mais encontra) e a **trava** (`for update`), e devolve o que a escola define **agora**, o `antes` que a auditoria guarda. Só vale dentro da transação do `PUT`: a linha fica travada até ela
   * terminar, e o segundo `PUT` da mesma escola espera aqui e lê o `depois` do primeiro. Escola que não existe é recusada pela chave estrangeira (23503), e quem chama a trata como inexistente.
   */
  async lockConfiguracaoDaEscola(): Promise<OrcamentoDefinido> {
    const escolaId = requireEscolaId()
    await this.banco.insert(configuracaoOperacionalEscola).values({ escolaId }).onConflictDoNothing()
    const [linha] = await this.banco
      .select({ valorPorAlunoMicros: configuracaoOperacionalEscola.iaValorPorAlunoMicros, tetoPercentual: configuracaoOperacionalEscola.iaTetoDeSegurancaPercentual })
      .from(configuracaoOperacionalEscola)
      .where(eq(configuracaoOperacionalEscola.escolaId, escolaId))
      .for('update')
    return { valorPorAlunoMicros: linha?.valorPorAlunoMicros ?? null, tetoPercentual: linha?.tetoPercentual ?? null }
  }

  /** A segunda metade do `PUT`: grava as duas colunas da escola do contexto, a linha que `lockConfiguracaoDaEscola` garantiu e travou. */
  async saveConfiguracaoDaEscola(depois: OrcamentoDefinido): Promise<void> {
    await this.banco
      .update(configuracaoOperacionalEscola)
      .set({ iaValorPorAlunoMicros: depois.valorPorAlunoMicros, iaTetoDeSegurancaPercentual: depois.tetoPercentual })
      .where(eq(configuracaoOperacionalEscola.escolaId, requireEscolaId()))
  }

  /** O que a rede da escola do contexto define, achada pelo `escola.rede_id` da própria escola. */
  async configuracaoDaRede(): Promise<OrcamentoDefinido> {
    const { rows } = await this.banco.execute<{ valorPorAlunoMicros: string | null; tetoPercentual: number | null }>(sql`
      select r.ia_valor_por_aluno_micros as "valorPorAlunoMicros", r.ia_teto_de_seguranca_percentual as "tetoPercentual"
      from escola as e join rede as r on r.id = e.rede_id
      where e.id = ${requireEscolaId()}::uuid`)
    const linha = rows[0]
    return { valorPorAlunoMicros: linha?.valorPorAlunoMicros == null ? null : Number(linha.valorPorAlunoMicros), tetoPercentual: linha?.tetoPercentual ?? null }
  }

  /** O orçamento que vale hoje para a escola: a dela, senão a da rede, coluna a coluna. */
  async vigente(): Promise<OrcamentoVigente> {
    return orcamentoVigente(await this.configuracaoDaEscola(), await this.configuracaoDaRede())
  }

  /** O retrato gravado do mês `AAAA-MM`, ou `undefined` se a medida não o gravou (mês fechado antes da camada-ia). */
  async retrato(mes: string): Promise<RetratoDoOrcamento | undefined> {
    const [linha] = await this.banco
      .select({
        alunosAtivos: orcamentoIaDoMes.alunosAtivos,
        valorPorAlunoMicros: orcamentoIaDoMes.valorPorAlunoMicros,
        tetoPercentual: orcamentoIaDoMes.tetoPercentual,
        origemDoValor: orcamentoIaDoMes.origemDoValor,
      })
      .from(orcamentoIaDoMes)
      .where(and(eq(orcamentoIaDoMes.escolaId, requireEscolaId()), eq(orcamentoIaDoMes.mes, primeiroDiaDoMes(mes))))
    return linha
  }

  /**
   * O orçamento de um mês da escola: o corrente (o de `agora`) é calculado na hora, com os alunos e o valor de hoje; o fechado é o do retrato, com o custo somado do mês, ou `sem_retrato` se a medida não
   * o gravou. O aviso só existe no corrente.
   */
  async doMes(mes: string, agora: Date): Promise<OrcamentoDoMes> {
    const custoMicros = await this.custoDoMes(mes)
    if (mes === mesDeSaoPaulo(agora)) return orcamentoDoMes(await this.retratoDeHoje(), custoMicros, true)
    const retrato = await this.retrato(mes)
    return retrato === undefined ? orcamentoSemRetrato(custoMicros) : orcamentoDoMes(retrato, custoMicros, false)
  }

  /**
   * Grava o retrato do mês corrente (o de `agora`) e devolve o orçamento dele: a medida o chama a cada 5 minutos. Regravar atualiza a linha do mês (`on conflict do update`), nunca a duplica, e o mês que
   * fechou fica com o último retrato.
   */
  async regravarRetrato(agora: Date): Promise<OrcamentoDoMes> {
    const mes = mesDeSaoPaulo(agora)
    const retrato = await this.retratoDeHoje()
    await this.banco
      .insert(orcamentoIaDoMes)
      .values({ escolaId: requireEscolaId(), mes: primeiroDiaDoMes(mes), ...retrato, atualizadoEm: agora })
      .onConflictDoUpdate({ target: [orcamentoIaDoMes.escolaId, orcamentoIaDoMes.mes], set: { ...retrato, atualizadoEm: agora } })
    return orcamentoDoMes(retrato, await this.custoDoMes(mes), true)
  }

  /** O que valeria se o mês fosse hoje: os alunos ativos de agora e o valor e o teto vigentes. */
  private async retratoDeHoje(): Promise<RetratoDoOrcamento> {
    const alunosAtivos = await this.alunosAtivos()
    const vigente = await this.vigente()
    return { alunosAtivos, valorPorAlunoMicros: vigente.valorPorAlunoMicros, tetoPercentual: vigente.tetoPercentual, origemDoValor: vigente.origemDoValor }
  }
}
