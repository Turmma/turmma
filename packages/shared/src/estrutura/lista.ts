import { z } from 'zod'
import { nomeDigitadoSchema } from '../operacao/painel.js'
import { pareceDocumento } from './documento-na-matricula.js'
import { TAMANHO_MAXIMO_MATRICULA } from '../sessao/matricula.js'
import { paginationQuerySchema, pageSchema } from './pagination.js'
import { FINALIDADES_DA_LEITURA_DE_ALUNOS } from './turma.js'

/**
 * A lista de nomes da turma (A1, tarefa 2.0, RF4 e RF5): a coordenação sobe nome e matrícula de cada aluno, antes de
 * ele entrar, e o aluno reivindica o próprio nome pelo link ou pelo código da turma.
 */

/** O estado de cada nome: ninguém pediu, há pedido pendente (6.0), ou virou usuário com a aprovação (8.0). */
export const ESTADOS_DO_NOME_DA_LISTA = ['livre', 'reivindicado', 'aprovado'] as const
export type EstadoDoNomeDaLista = (typeof ESTADOS_DO_NOME_DA_LISTA)[number]

/**
 * O teto de um envio, colado ou em arquivo (Tech Spec da A1, seção 4; regra 80, item 3): 200 linhas de aluno e 64 KB
 * em UTF-8. É o que deixa a lista rodar dentro da requisição, sem fila (seção 11, regra 00; `docs/infra.md` 3.5). Acima
 * de qualquer um dos dois, `ENTRADA_INVALIDA`, e nada é lido.
 */
export const MAXIMO_DE_LINHAS_DA_LISTA = 200
export const MAXIMO_DE_BYTES_DA_LISTA = 64 * 1024

/** A matrícula digitada: uma linha, sem caractere de controle e sem espaço nas pontas, até 40 (a do login). */
export const matriculaDigitadaSchema = z
  .string()
  .trim()
  .min(1)
  .max(TAMANHO_MAXIMO_MATRICULA)
  .regex(/^[^\p{Cc}]+$/u)

/**
 * Corpo de `POST /v1/turmas/:id/lista/previa` e de `POST /v1/turmas/:id/lista`: o texto como a coordenação colou ou
 * como o arquivo foi lido, uma linha por aluno, com nome e matrícula separados por `;`, `,` ou tabulação. O teto de
 * linhas e de bytes é conferido na leitura do texto. Estrito: a turma vem do caminho, a escola e o ano, da sessão.
 */
export const textoDaListaRequestSchema = z.strictObject({ texto: z.string() })
export type TextoDaListaRequest = z.infer<typeof textoDaListaRequestSchema>

/**
 * Corpo de `POST /v1/turmas/:id/lista/nome`: o nome avulso, com as regras de cada linha do texto. A matrícula com forma
 * de CPF pontuado ou de data é `ENTRADA_INVALIDA` (regra 20, item 2; correção `2026-10-03-trava-de-documento-so-na-tela`);
 * a de CPF sem pontuação, sozinha, passa: pesa só na lista, pela maioria (`matriculasQueParecemDocumento`).
 */
export const nomeAvulsoRequestSchema = z.strictObject({ nome: nomeDigitadoSchema, matricula: matriculaDigitadaSchema.refine((matricula) => !pareceDocumento(matricula)) })
export type NomeAvulsoRequest = z.infer<typeof nomeAvulsoRequestSchema>

/** O que acontece com a linha se a lista for gravada: entra, já está na lista desta turma, ou tem erro. */
export const RESULTADOS_DA_LINHA_DA_LISTA = ['entra', 'ja_existe', 'erro'] as const
export type ResultadoDaLinhaDaLista = (typeof RESULTADOS_DA_LINHA_DA_LISTA)[number]

/**
 * O erro da linha, um só, na ordem em que é conferido:
 * - `sem_nome`, `nome_invalido`: o nome vazio; com mais de 200 caracteres ou caractere de controle;
 * - `sem_matricula`, `matricula_invalida`: a matrícula vazia; com mais de 40 ou caractere de controle;
 * - `matricula_parece_documento`: a matrícula com forma de CPF pontuado ou de data, ou de CPF sem pontuação quando a
 *   maioria da lista tem essa forma (`matriculasQueParecemDocumento`; regra 20, item 2);
 * - `matricula_repetida`: a mesma matrícula em mais de uma linha do texto (todas as linhas dela são apontadas);
 * - `matricula_em_uso`: a matrícula está na lista de outra turma da escola neste ano, ou é de um aluno da escola.
 */
export const ERROS_DA_LINHA_DA_LISTA = [
  'sem_nome',
  'nome_invalido',
  'sem_matricula',
  'matricula_invalida',
  'matricula_parece_documento',
  'matricula_repetida',
  'matricula_em_uso',
] as const
export type ErroDaLinhaDaLista = (typeof ERROS_DA_LINHA_DA_LISTA)[number]

/**
 * Uma linha da prévia: o número da linha no texto (contando cabeçalho e linha em branco, para a coordenação achá-la no
 * arquivo), o nome e a matrícula como foram lidos, e o resultado. `erro` vem só com o resultado `erro`.
 */
export const linhaDaPreviaSchema = z
  .strictObject({
    linha: z.number().int().positive(),
    nome: z.string(),
    matricula: z.string(),
    resultado: z.enum(RESULTADOS_DA_LINHA_DA_LISTA),
    erro: z.enum(ERROS_DA_LINHA_DA_LISTA).optional(),
  })
  .refine((linha) => (linha.resultado === 'erro') === (linha.erro !== undefined))
export type PreviaRow = z.infer<typeof linhaDaPreviaSchema>

/** Resposta de `POST /v1/turmas/:id/lista/previa`: as linhas, na ordem do texto, e quantas de cada resultado. */
export const previaDaListaResponseSchema = z.strictObject({
  linhas: z.array(linhaDaPreviaSchema),
  entram: z.number().int().nonnegative(),
  jaExistem: z.number().int().nonnegative(),
  comErro: z.number().int().nonnegative(),
})
export type PreviaDaListaResponse = z.infer<typeof previaDaListaResponseSchema>

/** Resposta de `POST /v1/turmas/:id/lista`: quantos nomes entraram e quantos já estavam na lista da turma. */
export const gravacaoDaListaResponseSchema = z.strictObject({
  gravados: z.number().int().nonnegative(),
  jaExistentes: z.number().int().nonnegative(),
})
export type GravacaoDaListaResponse = z.infer<typeof gravacaoDaListaResponseSchema>

/**
 * Um nome da lista, como a coordenação o lê: o aprovado vem sem nome e sem matrícula, que passaram ao usuário e à
 * credencial dele (`docs/lgpd.md`). Resposta de `POST /v1/turmas/:id/lista/nome` e item de `GET /v1/turmas/:id/lista`.
 */
export const nomeDaListaSchema = z.strictObject({
  id: z.uuid(),
  nome: z.string().nullable(),
  matricula: z.string().nullable(),
  estado: z.enum(ESTADOS_DO_NOME_DA_LISTA),
})
export type NomeDaLista = z.infer<typeof nomeDaListaSchema>

/**
 * Consulta de `GET /v1/turmas/:id/lista`: a página e a finalidade, obrigatória (regra 20, item 10; só a coordenação lê a
 * lista), a mesma lista fechada da leitura dos alunos da turma. Sem ela, `ENTRADA_INVALIDA` antes de procurar a turma,
 * igual para qualquer id. Estrita: nada de escola nem de ano.
 */
export const listaDaTurmaQuerySchema = paginationQuerySchema.extend({ finalidade: z.enum(FINALIDADES_DA_LEITURA_DE_ALUNOS) }).strict()
export type ListaDaTurmaQuery = z.infer<typeof listaDaTurmaQuerySchema>

/** Resposta de `GET /v1/turmas/:id/lista`: os nomes da turma em ordem de id, com `proxima` quando há mais. */
export const listaDaTurmaResponseSchema = pageSchema(nomeDaListaSchema)
export type ListaDaTurmaResponse = z.infer<typeof listaDaTurmaResponseSchema>
