import { z } from 'zod'
import { paginationQuerySchema } from '../estrutura/pagination.js'

/**
 * Os sinais do Tutor para o professor da turma (MVP, A4; glossário, "Sinal"; D34, D36, D57): `GET /v1/sinais?turmaId=`.
 * O sinal é um **tipo fechado mais a referência ao trabalho** (a atividade aplicada e a questão, ou o material e a
 * página). Não existe campo de texto: nada aqui descreve o aluno, o que ele escreveu, o humor ou o comportamento dele.
 * Deriva de fato declarado no uso, nunca de inferência (D57).
 */
export const TIPOS_DE_SINAL = ['travou', 'resposta_pronta', 'duvida_repetida', 'atencao_humana'] as const
export type TipoDeSinal = (typeof TIPOS_DE_SINAL)[number]

/** Os sinais sobre o trabalho, que carregam onde aconteceu. `atencao_humana` fica de fora: não carrega nada. */
export const TIPOS_DE_SINAL_DE_TRABALHO = ['travou', 'resposta_pronta', 'duvida_repetida'] as const satisfies readonly TipoDeSinal[]
export type TipoDeSinalDeTrabalho = (typeof TIPOS_DE_SINAL_DE_TRABALHO)[number]

/** O fato, como a tela o diz. Fala do que aconteceu no uso, nunca conclui sobre a pessoa. */
export const NOME_DO_SINAL: Readonly<Record<TipoDeSinal, string>> = {
  travou: 'Travou',
  resposta_pronta: 'Pediu a resposta pronta',
  duvida_repetida: 'Repetiu a mesma dúvida',
  atencao_humana: 'Precisa de atenção humana',
}

/**
 * O que o aluno ouve sobre o sinal `atencao_humana` (D36), **uma formulação só**: é a frase do aviso de privacidade da
 * introdução (`apps/web`, em linguagem de 11 anos: até 15 palavras) e a última linha das duas mensagens fixas do Tutor
 * (`packages/nucleo`, `MENSAGEM_DE_ASSUNTO_DELICADO` e `MENSAGEM_DE_RISCO_A_VIDA`). Diz as duas coisas que o sinal faz: o
 * professor da turma é avisado, e não vê o que o aluno escreveu (o sinal é estrito, sem conteúdo). Sem tempo hipotético ("Se
 * você contar…"), porque vale antes de o aluno escrever (introdução) e depois de ele ter escrito (mensagem fixa).
 *
 * A promessa é verdadeira **hoje**. Ela tem de mudar junto, nos dois lugares, no dia em que (a) existir tela ou rota que abra a
 * conversa de um aluno para o professor (regra 50, item 10), ou (b) o F9 der a orientação ou à direção acesso auditado ao
 * conteúdo, para notificar o Conselho Tutelar (Lei 13.819/2019; `docs/agentes.md`, "Assunto pessoal delicado";
 * `docs/regulacao.md`, seção 7). O texto segue em revisão pela orientação educacional e por advogado (`docs/aia/tutor.md`,
 * pendência 12).
 */
export const FRASE_DO_AVISO_AO_PROFESSOR = 'Em assunto pessoal difícil, seu professor é avisado, mas não vê o que você escreveu.'

/** O aluno do sinal, nomeado só para o professor da turma (D34). */
const aluno = z.strictObject({ id: z.uuid(), nome: z.string().min(1) })

/** Onde o sinal aconteceu. `questao` é o número da questão, a partir de 1, como a turma a vê. */
const referenciaAoTrabalho = {
  atividadeAplicadaId: z.uuid().nullable(),
  questao: z.number().int().min(1).nullable(),
  materialId: z.uuid().nullable(),
  pagina: z.number().int().min(1).nullable(),
}

/**
 * Um sinal. O de `atencao_humana` (D36) é um objeto estrito só com o tipo, o aluno e a hora: **sem o conteúdo da
 * conversa, sem a atividade, a questão ou a página**, e qualquer campo a mais é recusado pelo schema. O professor fica
 * sabendo que precisa procurar o aluno, e não o que ele escreveu.
 */
export const sinalSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ id: z.uuid(), tipo: z.enum(TIPOS_DE_SINAL_DE_TRABALHO), aluno, ...referenciaAoTrabalho, criadoEm: z.iso.datetime() }),
  z.strictObject({ id: z.uuid(), tipo: z.literal('atencao_humana'), aluno, criadoEm: z.iso.datetime() }),
])
export type Sinal = z.infer<typeof sinalSchema>

/** Consulta de `GET /v1/sinais`: a turma (obrigatória, com vínculo confirmado do professor) e a página. */
export const sinaisQuerySchema = paginationQuerySchema.extend({ turmaId: z.uuid() }).strict()
export type SinaisQuery = z.infer<typeof sinaisQuerySchema>

export const MAXIMO_DE_GRUPOS_DE_SINAL = 50

/**
 * O agrupado que "Seu time" mostra ("oito travaram na questão 3"): por tipo, atividade e questão, quantos alunos
 * diferentes. Só os sinais de trabalho entram: `atencao_humana` nunca é somado nem agrupado.
 */
export const grupoDeSinaisSchema = z.strictObject({
  tipo: z.enum(TIPOS_DE_SINAL_DE_TRABALHO),
  atividadeAplicadaId: z.uuid().nullable(),
  questao: z.number().int().min(1).nullable(),
  alunos: z.number().int().min(1),
})
export type GrupoDeSinais = z.infer<typeof grupoDeSinaisSchema>

/**
 * Resposta de `GET /v1/sinais`: os sinais da turma, do mais novo para o mais antigo (`proxima` quando há mais), e o
 * agrupado dos últimos sete dias. Nenhuma conversa de aluno vem junto.
 */
export const sinaisResponseSchema = z.strictObject({
  itens: z.array(sinalSchema),
  proxima: z.uuid().optional(),
  grupos: z.array(grupoDeSinaisSchema).max(MAXIMO_DE_GRUPOS_DE_SINAL),
})
export type SinaisResponse = z.infer<typeof sinaisResponseSchema>
