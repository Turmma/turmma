import { sql } from 'drizzle-orm'
import { bigint, check, integer, jsonb, pgTable, smallint, text, time, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'

/** Vagas por fila numa escola. Fila ausente usa o padrão do ambiente. */
export type ConfiguredConcurrency = Partial<Record<'interativa' | 'ferramenta' | 'normal' | 'lote' | 'pdf', number>>

/**
 * O que a escola tem de diferente do padrão do ambiente na operação: limite de requisição, vagas
 * simultâneas por fila e horário letivo (Tech Spec, seção 3). Uma linha por escola, e toda coluna
 * nula cai no padrão do ambiente: escola sem linha nenhuma opera com o padrão inteiro. O limite é
 * configuração por escola, nunca constante no código (D41).
 *
 * - `vagas` só aceita as cinco filas, cada uma com inteiro positivo: o check garante no banco o que
 *   o despachante lê.
 * - `fuso`, `dias_letivos`, `inicio` e `fim` são o horário letivo da escola, em que o lote não
 *   urgente fica segurado; `inicio` é incluso e `fim`, exclusivo.
 * - A FK de `escola_id` entrou `NOT VALID` na tarefa 3.0 do F1: configuração de escola que não existe
 *   é recusada pelo banco.
 * - `tutor_trocas_por_dia` e `tutor_trocas_por_mes` (MVP, migration 0022) são o freio diário por aluno e o
 *   pacote do mês por aluno, somado na turma (D38). Nulo cai em `TROCAS_POR_DIA_PADRAO_DO_TUTOR` (60) e
 *   `TROCAS_POR_MES_PADRAO_DO_TUTOR` (300), de `@educa/shared`: a rede pública configura menos (D41), e o
 *   valor nunca é constante no código de quem aplica o freio (regra 30, item 8).
 * - `ia_valor_por_aluno_micros` e `ia_teto_de_seguranca_percentual` (camada-ia, tarefa 2.0) são o orçamento de IA da escola (D39, D41) e o
 *   teto que segura só o lote (D40): coluna a coluna, o valor da escola vale sobre o da rede, e o teto nulo nos dois vale 200%. O valor nulo
 *   nos dois é "sem orçamento". Só a Operação grava (a rota é da 3.0); a coordenação nunca as lê. Nenhuma é dado de pessoa.
 */
export const configuracaoOperacionalEscola = pgTable(
  'configuracao_operacional_escola',
  {
    escolaId: uuid()
      .primaryKey()
      .references(() => escola.id),
    /** Fuso IANA da escola (`America/Sao_Paulo`). */
    fuso: text(),
    /** Dias letivos da semana, ISO 8601: 1 é segunda, 7 é domingo. */
    diasLetivos: smallint().array(),
    inicio: time(),
    fim: time(),
    limiteReqUsuarioMin: integer(),
    limiteReqEscolaMin: integer(),
    vagas: jsonb().$type<ConfiguredConcurrency>(),
    /** Trocas com o Tutor por aluno e por dia (D38). */
    tutorTrocasPorDia: integer(),
    /** Trocas com o Tutor por aluno e por mês, somadas na turma (D38). */
    tutorTrocasPorMes: integer(),
    /** O valor de IA por aluno por mês, em milionésimos de real (camada-ia, tarefa 2.0; D39, D41). Nulo vale o da rede. */
    iaValorPorAlunoMicros: bigint({ mode: 'number' }),
    /** O teto de segurança do lote, em % do orçamento do mês (100 a 1000). Nulo vale o da rede e, sem ele, 200%. */
    iaTetoDeSegurancaPercentual: smallint(),
  },
  (tabela) => [
    check('configuracao_operacional_limite_usuario_positivo', sql`${tabela.limiteReqUsuarioMin} > 0`),
    check('configuracao_operacional_limite_escola_positivo', sql`${tabela.limiteReqEscolaMin} > 0`),
    check('configuracao_operacional_tutor_trocas_por_dia_positivo', sql`${tabela.tutorTrocasPorDia} > 0`),
    check('configuracao_operacional_tutor_trocas_por_mes_positivo', sql`${tabela.tutorTrocasPorMes} > 0`),
    check('configuracao_operacional_ia_valor_positivo', sql`${tabela.iaValorPorAlunoMicros} > 0`),
    check('configuracao_operacional_ia_teto_valido', sql`${tabela.iaTetoDeSegurancaPercentual} between 100 and 1000`),
    check(
      'configuracao_operacional_vagas_validas',
      sql`${tabela.vagas} is null or (
        jsonb_typeof(${tabela.vagas}) = 'object'
        and ${tabela.vagas} - 'interativa' - 'ferramenta' - 'normal' - 'lote' - 'pdf' = '{}'::jsonb
        and not jsonb_path_exists(${tabela.vagas}, '$.* ? (@.type() != "number" || @ < 1 || @ != @.floor())')
      )`,
    ),
    check('configuracao_operacional_dias_letivos_validos', sql`${tabela.diasLetivos} <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]`),
    // Os dois configurados fora de ordem não formam horário letivo; um só é conferido contra o padrão, na leitura.
    check('configuracao_operacional_horario_valido', sql`${tabela.inicio} is null or ${tabela.fim} is null or ${tabela.inicio} < ${tabela.fim}`),
  ],
)
