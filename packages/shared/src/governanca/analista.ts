import { z } from 'zod'
import { habilidadeSchema } from '../assistente/conteudo.js'
import { serieSchema } from '../estrutura/serie.js'
import { acertoPorHabilidadeSchema } from '../atividade/prova.js'
import { idempotencyKeySchema } from '../time/idempotency-key.js'
import type { TipoDeSinal, TipoDeSinalDeTrabalho } from '../tutor/sinal.js'

/**
 * O Analista de desempenho escolar (MVP, A5; D34, D45, D57, D64; regra 70, itens 7 a 9): `GET /v1/analista/resumo`,
 * `POST /v1/analista/gerar` e `GET /v1/analista/nominal`. O resumo é **agregado por série e disciplina**, e só de lote
 * aprovado. Alerta é hipótese com contexto, nunca veredito sobre professor ou aluno.
 *
 * O que se guarda em `resumo_do_analista.conteudo` é o objeto estrito abaixo: números, ids de série e disciplina e
 * códigos de lista fechada. **Não tem campo de pessoa nem texto livre**: nenhum nome, nenhum id de aluno ou professor,
 * e nenhuma frase escrita pelo modelo sobre alguém. A tela monta o texto a partir dos códigos.
 */

/** O grupo mínimo da D45: recorte (série × disciplina) com menos professores que isto conta como nominal, e não entra no agregado. */
export const GRUPO_MINIMO_DE_PROFESSORES = 2

/** O que o Analista aponta. Fato medido no agregado, com o número e a referência. */
export const TIPOS_DE_ALERTA_DO_ANALISTA = ['habilidade_com_acerto_baixo', 'habilidade_em_queda', 'sinais_concentrados', 'correcoes_esperando'] as const
export type TipoDeAlertaDoAnalista = (typeof TIPOS_DE_ALERTA_DO_ANALISTA)[number]

export const NOME_DO_ALERTA_DO_ANALISTA: Readonly<Record<TipoDeAlertaDoAnalista, string>> = {
  habilidade_com_acerto_baixo: 'Habilidade com acerto baixo',
  habilidade_em_queda: 'Habilidade em queda',
  sinais_concentrados: 'Muitos sinais do Tutor no mesmo ponto',
  correcoes_esperando: 'Correções esperando aprovação',
}

/**
 * As hipóteses que o Analista pode levantar para um alerta: lista fechada, sobre o **conteúdo e o material**, nunca
 * sobre uma pessoa. O modelo escolhe entre estas; não escreve a própria.
 */
export const HIPOTESES_DO_ANALISTA = ['conteudo_recente', 'poucas_atividades_no_tema', 'questoes_acima_do_material', 'pre_requisito_de_outra_serie', 'material_sem_o_tema'] as const
export type HipoteseDoAnalista = (typeof HIPOTESES_DO_ANALISTA)[number]

export const TEXTO_DA_HIPOTESE: Readonly<Record<HipoteseDoAnalista, string>> = {
  conteudo_recente: 'O conteúdo entrou há pouco, e as turmas ainda estão no começo dele.',
  poucas_atividades_no_tema: 'Houve poucas atividades neste tema, e o número ainda diz pouco.',
  questoes_acima_do_material: 'As questões podem ter pedido mais do que o material trabalha.',
  pre_requisito_de_outra_serie: 'O tema depende de conteúdo de série anterior, que pode precisar de retomada.',
  material_sem_o_tema: 'O material da escola quase não cobre este tema.',
}

const percentual = z.number().min(0).max(100)

/**
 * Um recorte do agregado: série × disciplina, com quantos professores e alunos entram nele, o acerto e as habilidades.
 * **O schema recusa o recorte com menos de dois professores** (D45): o de um professor só é o resultado dele, e só abre
 * pela leitura nominal, com auditoria.
 */
export const recorteDoAnalistaSchema = z.strictObject({
  serie: serieSchema,
  disciplina: z.strictObject({ id: z.uuid(), nome: z.string().min(1) }),
  professores: z.number().int().min(GRUPO_MINIMO_DE_PROFESSORES),
  alunos: z.number().int().nonnegative(),
  lotesAprovados: z.number().int().nonnegative(),
  acertoPercentual: percentual,
  porHabilidade: z.array(acertoPorHabilidadeSchema).max(60),
})
export type RecorteDoAnalista = z.infer<typeof recorteDoAnalistaSchema>

/** O recorte que ficou de fora do agregado pelo grupo mínimo: só diz qual é, **sem número nenhum**. */
export const recorteNominalSchema = z.strictObject({
  serie: serieSchema,
  disciplina: z.strictObject({ id: z.uuid(), nome: z.string().min(1) }),
})

/** Um alerta: o tipo, o recorte, a habilidade (quando é sobre uma), o valor medido, a referência e as hipóteses. */
export const alertaDoAnalistaSchema = z.strictObject({
  tipo: z.enum(TIPOS_DE_ALERTA_DO_ANALISTA),
  serie: serieSchema,
  disciplina: z.strictObject({ id: z.uuid(), nome: z.string().min(1) }),
  habilidade: habilidadeSchema.nullable(),
  valor: z.number().nonnegative(),
  referencia: z.number().nonnegative(),
  hipoteses: z.array(z.enum(HIPOTESES_DO_ANALISTA)).min(1).max(3),
})
export type AlertaDoAnalista = z.infer<typeof alertaDoAnalistaSchema>

/** Os sinais do Tutor somados na escola, por tipo. `atencao_humana` entra só como contagem da escola inteira. */
const contagem = z.number().int().nonnegative()
const sinaisSomados = z.strictObject({ travou: contagem, resposta_pronta: contagem, duvida_repetida: contagem, atencao_humana: contagem } satisfies Record<TipoDeSinal, z.ZodNumber>)

/** Os sinais de trabalho somados numa turma. **Sem `atencao_humana`**: numa turma, a contagem dele aponta poucos alunos, e esse aviso é só do professor (D36). */
const sinaisDeTrabalhoSomados = z.strictObject({ travou: contagem, resposta_pronta: contagem, duvida_repetida: contagem } satisfies Record<TipoDeSinalDeTrabalho, z.ZodNumber>)

/**
 * O conteúdo do resumo (`resumo_do_analista.conteudo`): o período, os números da escola, os recortes com grupo mínimo,
 * os recortes que ficaram de fora e os alertas. É validado na saída do modelo e de novo antes de gravar (regra 30, item 7).
 */
export const conteudoDoResumoDoAnalistaSchema = z.strictObject({
  periodo: z.strictObject({ inicio: z.iso.date(), fim: z.iso.date() }),
  escola: z.strictObject({
    atividadesAplicadas: z.number().int().nonnegative(),
    lotesAprovados: z.number().int().nonnegative(),
    lotesEsperando: z.number().int().nonnegative(),
    versoesAdaptadasAprovadas: z.number().int().nonnegative(),
    trocasComOTutor: z.number().int().nonnegative(),
    sinais: sinaisSomados,
  }),
  recortes: z.array(recorteDoAnalistaSchema).max(100),
  recortesNominais: z.array(recorteNominalSchema).max(100),
  alertas: z.array(alertaDoAnalistaSchema).max(20),
})
export type ConteudoDoResumoDoAnalista = z.infer<typeof conteudoDoResumoDoAnalistaSchema>

/** Resposta de `GET /v1/analista/resumo`: o resumo mais recente da escola no ano em curso, ou `null` se nenhum foi gerado. */
export const resumoDoAnalistaResponseSchema = z.strictObject({
  resumo: z.strictObject({ id: z.uuid(), geradoEm: z.iso.datetime(), conteudo: conteudoDoResumoDoAnalistaSchema }).nullable(),
})
export type ResumoDoAnalistaResponse = z.infer<typeof resumoDoAnalistaResponseSchema>

/** Corpo de `POST /v1/analista/gerar`: só a chave do envio. Responde 202 com a execução; o resultado traz o `resumoId`. */
export const gerarResumoDoAnalistaRequestSchema = z.strictObject({ chaveEnvio: idempotencyKeySchema })
export type GerarResumoDoAnalistaRequest = z.infer<typeof gerarResumoDoAnalistaRequestSchema>

/**
 * Por que a coordenação abre o dado nominal (regra 20, item 10; D45): código fixo, nunca texto livre, que fica na
 * auditoria da leitura. Nenhuma finalidade é de avaliar, cobrar ou decidir sobre o professor: isso não existe (regra 70,
 * item 8).
 */
export const FINALIDADES_DA_LEITURA_NOMINAL = ['conversa_pedagogica_a_pedido_do_professor', 'apoio_a_aluno_em_risco', 'pedido_do_titular', 'apuracao_de_denuncia'] as const
export type FinalidadeDaLeituraNominal = (typeof FINALIDADES_DA_LEITURA_NOMINAL)[number]

export const NOME_DA_FINALIDADE_NOMINAL: Readonly<Record<FinalidadeDaLeituraNominal, string>> = {
  conversa_pedagogica_a_pedido_do_professor: 'Conversa pedagógica com o professor, a pedido dele',
  apoio_a_aluno_em_risco: 'Apoio a um aluno em risco, com o professor da turma',
  pedido_do_titular: 'Atender pedido do titular do dado (LGPD)',
  apuracao_de_denuncia: 'Apurar denúncia sobre o uso de IA recebida no canal da escola',
}

/**
 * Consulta de `GET /v1/analista/nominal`: a turma e a finalidade, as duas obrigatórias. Sem finalidade é
 * `ENTRADA_INVALIDA` antes de procurar a turma, e toda leitura grava `analista.nominal_lido` na auditoria.
 */
export const analistaNominalQuerySchema = z.strictObject({ turmaId: z.uuid(), finalidade: z.enum(FINALIDADES_DA_LEITURA_NOMINAL) })
export type AnalistaNominalQuery = z.infer<typeof analistaNominalQuerySchema>

/**
 * Resposta de `GET /v1/analista/nominal`: o detalhe de **uma turma**, que identifica os professores dela. Traz os
 * professores com vínculo confirmado e a disciplina de cada um, o acerto por habilidade da turma nos lotes aprovados e os
 * sinais de trabalho do Tutor por tipo.
 *
 * O que **não** traz, de propósito:
 * - aluno: o desempenho por aluno é `GET /v1/turmas/:id/desempenho`, com a finalidade e a auditoria dele;
 * - a contagem de `atencao_humana`: só existe somada na escola inteira, no resumo;
 * - quantas entregas a turma tem pendentes, aprovadas ou rejeitadas: ao lado do professor nomeado, seria medir o uso
 *   que ele faz da ferramenta, e adoção nominal por professor não existe (D64; regra 70, item 9);
 * - ordenação e comparação entre professores (D45).
 */
export const analistaNominalResponseSchema = z.strictObject({
  turma: z.strictObject({ id: z.uuid(), nome: z.string().min(1), serie: serieSchema }),
  professores: z.array(z.strictObject({ id: z.uuid(), nome: z.string().min(1), disciplina: z.strictObject({ id: z.uuid(), nome: z.string().min(1) }) })).max(40),
  lotesAprovados: z.number().int().nonnegative(),
  porHabilidade: z.array(acertoPorHabilidadeSchema).max(60),
  sinais: sinaisDeTrabalhoSomados,
})
export type AnalistaNominalResponse = z.infer<typeof analistaNominalResponseSchema>
