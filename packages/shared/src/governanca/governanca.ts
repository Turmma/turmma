import { z } from 'zod'
import { ESTADOS_DE_ENTREGA, TIPOS_DE_ENTREGA } from '../assistente/entrega.js'
import { paginationQuerySchema } from '../estrutura/pagination.js'
import { serieSchema } from '../estrutura/serie.js'
import { AGENTES, CHAVES_DE_FUNCAO } from '../time/funcoes.js'
import { chaveDeFuncaoSchema, funcaoDoTimeSchema } from '../time/time.js'
import type { SituacaoDoOrcamento } from './orcamento-de-ia.js'

/**
 * A governança de IA da coordenação (MVP, A5; D9, D45, D60, D64; regra 70, itens 5, 6, 8 e 9): o que a IA gerou e se uma
 * pessoa aprovou, o que cada função faz sozinha, a suspensão por função e o consumo.
 *
 * **Tudo aqui é agregado ou sem pessoa.** Nenhum schema desta pasta tem campo de professor (id, nome, quem aprovou), nem
 * turma, que numa disciplina aponta um professor só; nenhuma consulta aceita filtro ou ordenação por professor. Os
 * objetos são estritos: o campo que alguém acrescentar por engano é recusado. O dado nominal tem rota própria, com
 * finalidade e auditoria (`GET /v1/analista/nominal`).
 */

/** Consulta de `GET /v1/governanca/resumo`: a página e o estado. Não existe `professorId`, `turmaId` nem `ordenarPor`. */
export const resumoDaGovernancaQuerySchema = paginationQuerySchema.extend({ estado: z.enum(ESTADOS_DE_ENTREGA).optional() }).strict()
export type ResumoDaGovernancaQuery = z.infer<typeof resumoDaGovernancaQuerySchema>

/**
 * Uma linha de "o que a IA gerou e quem aprovou": a entrega, de que função veio, o estado e as datas, com a série da
 * turma. **Sem turma e sem quem decidiu**: aqui a coordenação vê que uma pessoa decidiu e quando; quem, só na auditoria.
 */
export const itemDaGovernancaSchema = z.strictObject({
  id: z.uuid(),
  funcao: chaveDeFuncaoSchema,
  tipo: z.enum(TIPOS_DE_ENTREGA),
  estado: z.enum(ESTADOS_DE_ENTREGA),
  serie: serieSchema,
  criadaEm: z.iso.datetime(),
  decididaEm: z.iso.datetime().nullable(),
})
export type ItemDaGovernanca = z.infer<typeof itemDaGovernancaSchema>

/**
 * Resposta de `GET /v1/governanca/resumo`: os números da escola no ano em curso e as entregas, da mais nova para a mais
 * antiga. `geradoPorIa` conta artefatos e lotes de correção; `aprovadoPorPessoa`, `rejeitado` e `esperando`, as entregas.
 */
export const resumoDaGovernancaResponseSchema = z.strictObject({
  numeros: z.strictObject({
    geradoPorIa: z.number().int().nonnegative(),
    aprovadoPorPessoa: z.number().int().nonnegative(),
    rejeitado: z.number().int().nonnegative(),
    esperando: z.number().int().nonnegative(),
  }),
  itens: z.array(itemDaGovernancaSchema),
  proxima: z.uuid().optional(),
})
export type ResumoDaGovernancaResponse = z.infer<typeof resumoDaGovernancaResponseSchema>

/**
 * Por que a coordenação suspende uma função (D60): código fixo, nunca texto livre, que é onde o nome de um aluno ou de
 * um professor acabaria escrito. Opcional: suspender não pode ser mais difícil que deixar ligado.
 */
export const MOTIVOS_DE_SUSPENSAO = ['erro_recorrente', 'revisao_pedagogica', 'pedido_da_comunidade', 'incidente', 'decisao_da_escola'] as const
export type MotivoDeSuspensao = (typeof MOTIVOS_DE_SUSPENSAO)[number]

export const NOME_DO_MOTIVO_DE_SUSPENSAO: Readonly<Record<MotivoDeSuspensao, string>> = {
  erro_recorrente: 'A função errou mais de uma vez',
  revisao_pedagogica: 'A escola está revendo o uso pedagógico',
  pedido_da_comunidade: 'Pedido de professor, aluno ou família',
  incidente: 'Houve um incidente e a escola está apurando',
  decisao_da_escola: 'Decisão da escola',
}

/** A suspensão vigente de uma função: desde quando e por quê. Quem suspendeu fica na auditoria (`funcao.suspensa`). */
export const suspensaoVigenteSchema = z.strictObject({ suspensaEm: z.iso.datetime(), motivo: z.enum(MOTIVOS_DE_SUSPENSAO).nullable() })

/** Uma função na governança: o mesmo que `GET /v1/time` mostra, com a suspensão vigente. */
export const funcaoDaGovernancaSchema = funcaoDoTimeSchema.extend({ suspensao: suspensaoVigenteSchema.nullable() }).strict()
export type FuncaoDaGovernanca = z.infer<typeof funcaoDaGovernancaSchema>

/** Resposta de `GET /v1/governanca/funcoes`: os três agentes e as funções, com a autonomia em português comum (regra 70, item 5). */
export const funcoesDaGovernancaResponseSchema = z.strictObject({
  agentes: z
    .array(z.strictObject({ agente: z.enum(AGENTES), nome: z.string().min(1), funcoes: z.array(funcaoDaGovernancaSchema).min(1).max(CHAVES_DE_FUNCAO.length) }))
    .length(AGENTES.length),
})
export type FuncoesDaGovernancaResponse = z.infer<typeof funcoesDaGovernancaResponseSchema>

/**
 * Corpo de `POST /v1/governanca/funcoes/:chave/suspender`: o motivo, se a coordenação quiser dar. A suspensão vale no
 * servidor: a função suspensa recusa executar com `FUNCAO_SUSPENSA`, e as outras do mesmo agente continuam. Suspender a
 * que já está suspensa devolve a suspensão vigente, sem segunda linha (o banco aceita uma vigente por escola e função).
 */
export const suspenderFuncaoRequestSchema = z.strictObject({ motivo: z.enum(MOTIVOS_DE_SUSPENSAO).optional() })
export type SuspenderFuncaoRequest = z.infer<typeof suspenderFuncaoRequestSchema>

/** Resposta de `POST …/suspender` e de `POST …/retomar` (corpo vazio e estrito): a função como ficou. */
export const funcaoDaGovernancaResponseSchema = funcaoDaGovernancaSchema
export type FuncaoDaGovernancaResponse = FuncaoDaGovernanca

/** Consulta de `GET /v1/governanca/consumo`: o mês (`2026-10`). Sem ele, o mês corrente no fuso da escola. */
export const consumoQuerySchema = z.strictObject({ mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() })
export type ConsumoQuery = z.infer<typeof consumoQuerySchema>

/** Como está o orçamento de IA do mês, para a coordenação (camada-ia 6.0; D40): o mesmo `situacao` da Operação, sem valor, sem teto e sem real. */
const situacaoDoOrcamentoSchema = z.enum(['definido', 'sem_orcamento', 'sem_aluno_ativo', 'sem_retrato'] satisfies readonly SituacaoDoOrcamento[])

/**
 * O orçamento do mês como a coordenação o lê (RF9, RF12; D40: nada é cortado e nada é dito em reais): a `situacao`, a `porcentagem` do previsto que já foi usada (inteira, para baixo; **só** em `definido`) e o
 * `aviso`, o limiar já cruzado no mês corrente (80 ou 100; nulo no mês fechado e fora de `definido`). Nenhum valor por aluno, teto, custo nem número de alunos sai por aqui: é a conta do servidor, e a tela só a mostra.
 */
export const orcamentoDoConsumoSchema = z
  .strictObject({
    situacao: situacaoDoOrcamentoSchema,
    porcentagem: z.number().int().nonnegative().nullable(),
    aviso: z.union([z.literal(80), z.literal(100)]).nullable(),
  })
  // Porcentagem e aviso só existem em `definido`: nas outras situações a tela diz por que não há número, e a resposta que traz um número ali é recusada.
  .refine(({ situacao, porcentagem, aviso }) => (situacao === 'definido' ? porcentagem !== null : porcentagem === null && aviso === null), { message: 'porcentagem e aviso só valem em `definido`' })
export type OrcamentoDoConsumo = z.infer<typeof orcamentoDoConsumoSchema>

/**
 * O que uma função da IA trabalhou no mês: a `parte` (0 a 100, inteira) é a fatia dela nos tokens do mês da escola, e `execucoes` conta execuções (cada uma pode ter mais de uma chamada ao modelo: a repetição por
 * saída inválida e a troca de modelo). **Sem token e sem custo**: a coordenação não lê o número bruto (RF12).
 */
export const consumoDaFuncaoSchema = z.strictObject({
  funcao: chaveDeFuncaoSchema,
  parte: z.number().int().min(0).max(100),
  execucoes: z.number().int().nonnegative(),
})
export type ConsumoDaFuncaoDoMes = z.infer<typeof consumoDaFuncaoSchema>

/**
 * Resposta de `GET /v1/governanca/consumo` (D14, D38, D40; camada-ia 6.0): o orçamento do mês, a parte de cada função e o pacote do Tutor (as trocas do mês contra o pacote configurado, somando as turmas).
 * **Por função, nunca por pessoa**: não existe consumo por professor, em tela nenhuma nem no banco (D64). **Sem reais e sem tokens**: o schema é estrito, e `tokens*` e `custoMicros` são recusados.
 */
export const consumoResponseSchema = z.strictObject({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  orcamento: orcamentoDoConsumoSchema,
  porFuncao: z.array(consumoDaFuncaoSchema).max(CHAVES_DE_FUNCAO.length),
  tutor: z.strictObject({
    trocasNoMes: z.number().int().nonnegative(),
    pacoteDoMes: z.number().int().nonnegative(),
    trocasPorDiaPorAluno: z.number().int().min(1),
    trocasPorMesPorAluno: z.number().int().min(1),
  }),
})
export type ConsumoResponse = z.infer<typeof consumoResponseSchema>

/**
 * A fatia de uma função nos tokens do mês da escola, em % inteira (0 a 100), arredondada ao mais próximo: a soma das funções fica a ±1 por função de 100. **Sem token no mês, zero** em todas (nunca divisão por
 * zero). É a conta do servidor; a tela só mostra o número.
 */
export function parteDosTokens(tokensDaFuncao: number, tokensDoMes: number): number {
  if (tokensDoMes <= 0) return 0
  return Math.round((tokensDaFuncao * 100) / tokensDoMes)
}
