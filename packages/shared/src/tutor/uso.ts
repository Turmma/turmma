import { z } from 'zod'
import { MAXIMO_DE_QUESTOES_POR_ATIVIDADE } from '../assistente/conversa.js'

/**
 * O uso do Tutor por turma, para o professor (MVP, A4; D8, D47; regra 70, itens 4 e 7): `GET /v1/tutor/uso?turmaId=`.
 * **Não existe uso do Tutor invisível ao professor.** O sinal só nasce em quatro situações; o aluno cujos turnos são
 * todos comuns não gera sinal nenhum, e é por aqui que o professor o vê: quem usou, quantas trocas hoje, quando foi a
 * última e em que estava.
 *
 * O que a resposta **não** tem, e o schema estrito recusa (regra 70, item 7: supervisão não é vigilância):
 * - **conteúdo de conversa**: nem a pergunta do aluno, nem a resposta do Tutor, nem trecho, assunto ou resumo;
 * - **tempo ocioso**, duração de sessão ou tempo entre trocas: só a hora da última troca;
 * - **histórico de navegação**: só a referência da **última** troca, nunca a lista do que o aluno abriu;
 * - quem **não** usou: a lista traz só quem trocou com o Tutor, em ordem de nome, sem ranking nem ordenação por uso.
 *
 * Só o professor com vínculo confirmado na turma lê; a coordenação e o aluno, nunca. A coordenação vê o uso somado da
 * escola, por função, na governança.
 */

/** Consulta de `GET /v1/tutor/uso`: a turma, obrigatória. Não aceita aluno, período nem ordenação. */
export const usoDoTutorQuerySchema = z.strictObject({ turmaId: z.uuid() })
export type UsoDoTutorQuery = z.infer<typeof usoDoTutorQuerySchema>

/**
 * Em que o aluno estava na última troca: a atividade aplicada e o número da questão, ou o material e a página. É a
 * referência ao trabalho que a própria tela do aluno mandou junto da pergunta; tudo nulo quando ele perguntou fora de
 * atividade e de material.
 */
export const referenciaDaUltimaTrocaSchema = z.strictObject({
  atividadeAplicadaId: z.uuid().nullable(),
  questao: z.number().int().min(1).max(MAXIMO_DE_QUESTOES_POR_ATIVIDADE).nullable(),
  materialId: z.uuid().nullable(),
  pagina: z.number().int().min(1).nullable(),
})

/** O uso de um aluno: nomeado só para o professor da turma (D34). Troca é a mensagem que o aluno mandou ao Tutor. */
export const usoDoAlunoSchema = z.strictObject({
  aluno: z.strictObject({ id: z.uuid(), nome: z.string().min(1) }),
  trocasHoje: z.number().int().nonnegative(),
  ultimaTrocaEm: z.iso.datetime(),
  ultimaReferencia: referenciaDaUltimaTrocaSchema,
})
export type UsoDoAluno = z.infer<typeof usoDoAlunoSchema>

export const MAXIMO_DE_ALUNOS_NO_USO = 200

/**
 * Resposta de `GET /v1/tutor/uso`: os alunos da turma que já trocaram com o Tutor no ano letivo em curso, em ordem de
 * nome, cada um com as trocas de hoje (zero, se a última foi em outro dia), a hora da última e a referência dela; o freio
 * do dia configurado na escola, para a tela dizer "12 de 60"; e a soma da turma no mês contra o pacote (D38). Turma em
 * que ninguém usou vem com a lista vazia.
 */
export const usoDoTutorResponseSchema = z.strictObject({
  turmaId: z.uuid(),
  limiteDoDia: z.number().int().min(1),
  trocasDaTurmaNoMes: z.number().int().nonnegative(),
  pacoteDaTurmaNoMes: z.number().int().nonnegative(),
  alunos: z.array(usoDoAlunoSchema).max(MAXIMO_DE_ALUNOS_NO_USO),
})
export type UsoDoTutorResponse = z.infer<typeof usoDoTutorResponseSchema>
