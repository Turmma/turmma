import { z } from 'zod'
import { AGENTES, CHAVES_DE_FUNCAO, FUNCOES, NIVEIS_DE_AUTONOMIA, NOMES_DOS_AGENTES, type Agente, type ChaveDeFuncao } from './funcoes.js'

/**
 * `GET /v1/time` (MVP, A2 e A5; D9, D32, D60): os três agentes, as funções de cada um, a autonomia em português comum e
 * se a função está suspensa na escola. Professor e coordenação leem o mesmo. O que é fixo vem do catálogo `FUNCOES`, em
 * código; do banco vem só a suspensão vigente.
 */

/** `:chave` das rotas de função da governança. */
export const chaveDeFuncaoSchema = z.enum(CHAVES_DE_FUNCAO)

/** Uma função, como a tela a mostra. `suspensa` diz se a coordenação a desligou nesta escola: o servidor recusa executá-la. */
export const funcaoDoTimeSchema = z.strictObject({
  chave: chaveDeFuncaoSchema,
  nome: z.string().min(1),
  autonomia: z.literal(NIVEIS_DE_AUTONOMIA),
  altoRisco: z.boolean(),
  fazSozinha: z.string().min(1),
  esperaAprovacao: z.string().min(1),
  suspensa: z.boolean(),
})
export type FuncaoDoTime = z.infer<typeof funcaoDoTimeSchema>

export const agenteDoTimeSchema = z.strictObject({
  agente: z.enum(AGENTES),
  nome: z.string().min(1),
  funcoes: z.array(funcaoDoTimeSchema).min(1).max(CHAVES_DE_FUNCAO.length),
})
export type AgenteDoTime = z.infer<typeof agenteDoTimeSchema>

/** Resposta de `GET /v1/time`: os agentes na ordem do catálogo, cada um com as funções dele. */
export const timeResponseSchema = z.strictObject({ agentes: z.array(agenteDoTimeSchema).length(AGENTES.length) })
export type TimeResponse = z.infer<typeof timeResponseSchema>

/**
 * Monta a resposta de `GET /v1/time` a partir do catálogo e das funções suspensas na escola. Um lugar só: a tela do
 * professor, a da coordenação e a governança não escrevem a mesma autonomia de dois jeitos (regra 70, item 5).
 */
export function montarTime(suspensas: ReadonlySet<ChaveDeFuncao>): TimeResponse {
  return {
    agentes: AGENTES.map((agente: Agente) => ({
      agente,
      nome: NOMES_DOS_AGENTES[agente],
      funcoes: CHAVES_DE_FUNCAO.filter((chave) => FUNCOES[chave].agente === agente).map((chave) => {
        const { nome, autonomia, altoRisco, fazSozinha, esperaAprovacao } = FUNCOES[chave]
        return { chave, nome, autonomia, altoRisco, fazSozinha, esperaAprovacao, suspensa: suspensas.has(chave) }
      }),
    })),
  }
}
