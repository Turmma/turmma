import { z } from 'zod'

/**
 * O que o Assistente de ensino produz e o que se guarda em `artefato.conteudo`: um formato só, validado na saída do
 * modelo e na leitura (regra 30: schema validado). Toda questão e toda etapa **cita a página** do material que a
 * escola subiu (D6): sem citação, o conteúdo é recusado.
 *
 * Aqui não há campo para texto sobre o aluno. A adaptação recebe um **tipo** (D35, D67); `tiposDeAdaptacao` é uma lista
 * fechada, nunca texto livre.
 */

export const citacaoSchema = z.strictObject({
  materialId: z.uuid(),
  /** Página do PDF, a partir de 1. */
  pagina: z.number().int().min(1),
  /** Um trecho curto da página, para a professora conferir de relance. */
  trecho: z.string().min(1).max(400),
})
export type Citacao = z.infer<typeof citacaoSchema>

export const habilidadeSchema = z.strictObject({
  codigo: z.string().min(1).max(20),
  descricao: z.string().min(1).max(300),
})
export type Habilidade = z.infer<typeof habilidadeSchema>

export const TIPOS_DE_ADAPTACAO = [
  'fonte_ampliada',
  'tempo_adicional',
  'linguagem_direta',
  'enunciado_simplificado',
  'resposta_escrita_no_lugar_da_oral',
  'leitura_de_apoio',
] as const
export type TipoDeAdaptacao = (typeof TIPOS_DE_ADAPTACAO)[number]

export const ROTULOS_DA_ADAPTACAO: Readonly<Record<TipoDeAdaptacao, string>> = {
  fonte_ampliada: 'Fonte ampliada',
  tempo_adicional: 'Tempo adicional',
  linguagem_direta: 'Linguagem direta',
  enunciado_simplificado: 'Enunciado simplificado',
  resposta_escrita_no_lugar_da_oral: 'Resposta escrita no lugar da oral',
  leitura_de_apoio: 'Leitura de apoio',
}

export const adaptacaoAplicadaSchema = z.strictObject({
  tipos: z.array(z.enum(TIPOS_DE_ADAPTACAO)).min(1).max(TIPOS_DE_ADAPTACAO.length),
  /** Só com `tempo_adicional`, em % sobre o tempo da turma. */
  tempoExtraPercentual: z.number().int().min(10).max(100).optional(),
})
export type AdaptacaoAplicada = z.infer<typeof adaptacaoAplicadaSchema>

export const ALTERNATIVAS_POR_QUESTAO = 4

export const questaoObjetivaSchema = z.strictObject({
  enunciado: z.string().min(1).max(1200),
  alternativas: z.array(z.string().min(1).max(400)).length(ALTERNATIVAS_POR_QUESTAO),
  /** Índice da alternativa correta, de 0 a 3. */
  gabarito: z.number().int().min(0).max(ALTERNATIVAS_POR_QUESTAO - 1),
  habilidade: habilidadeSchema,
  citacao: citacaoSchema,
  /** Por que a alternativa é a correta: alimenta o relatório por questão. Nunca chega ao aluno antes da aprovação. */
  explicacao: z.string().min(1).max(600),
})
export type QuestaoObjetiva = z.infer<typeof questaoObjetivaSchema>

export const conteudoDeAtividadeSchema = z.strictObject({
  tipo: z.literal('atividade_objetiva'),
  titulo: z.string().min(1).max(160),
  questoes: z.array(questaoObjetivaSchema).min(1).max(20),
  /** Presente só na versão adaptada. */
  adaptacao: adaptacaoAplicadaSchema.optional(),
})
export type ConteudoDeAtividade = z.infer<typeof conteudoDeAtividadeSchema>

export const etapaDoPlanoSchema = z.strictObject({
  titulo: z.string().min(1).max(120),
  minutos: z.number().int().min(1).max(240),
  descricao: z.string().min(1).max(800),
  citacao: citacaoSchema.optional(),
})

export const conteudoDePlanoDeAulaSchema = z.strictObject({
  tipo: z.literal('plano_de_aula'),
  titulo: z.string().min(1).max(160),
  objetivos: z.array(z.string().min(1).max(300)).min(1).max(6),
  habilidades: z.array(habilidadeSchema).min(1).max(6),
  duracaoMinutos: z.number().int().min(10).max(240),
  etapas: z.array(etapaDoPlanoSchema).min(1).max(8),
  avaliacao: z.string().min(1).max(600),
  citacoes: z.array(citacaoSchema).min(1).max(8),
})
export type ConteudoDePlanoDeAula = z.infer<typeof conteudoDePlanoDeAulaSchema>

export const conteudoDoArtefatoSchema = z.discriminatedUnion('tipo', [conteudoDeAtividadeSchema, conteudoDePlanoDeAulaSchema])
export type ConteudoDoArtefato = z.infer<typeof conteudoDoArtefatoSchema>

export const TIPOS_DE_ARTEFATO = ['atividade_objetiva', 'plano_de_aula'] as const
export type TipoDeArtefato = (typeof TIPOS_DE_ARTEFATO)[number]

/** As ferramentas do Assistente no MVP (D74): cada uma entrega um output próprio. */
export const FERRAMENTAS = ['atividade_objetiva', 'plano_de_aula', 'adaptacao'] as const
export type Ferramenta = (typeof FERRAMENTAS)[number]
