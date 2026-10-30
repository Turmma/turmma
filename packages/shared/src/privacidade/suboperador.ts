import { z } from 'zod'

/**
 * Os suboperadores: as empresas que recebem dado da escola para nos prestar o serviço (F3, RF6 e RF7; Tech Spec do F3,
 * seções 3, 4 e 6; LGPD, art. 18, VII). A operação cadastra e encerra por comando (`ops:suboperador`); a coordenação vê os
 * da escola dela, vigentes e passados, em "Empresas que recebem dados".
 *
 * O suboperador não é pessoa: nome da empresa, o que ela faz, onde processa e o que recebe. O número do contrato, quem
 * cadastrou e o apelido do operador ficam na operação e nunca chegam à escola.
 */

/**
 * O formato da `chave` do suboperador: o mesmo do `IA_PROVEDOR_ID`, que é como a chamada externa de IA registra quem a
 * atendeu (`consumo_ia.provedor`, tarefa 7.0). É por essa igualdade que o compartilhamento do titular (tarefa 12.0) casa uma
 * chamada com o suboperador vigente.
 */
export const FORMATO_DA_CHAVE_DO_SUBOPERADOR = /^[a-z][a-z0-9_-]{1,39}$/

/** A referência do contrato com a empresa: um código curto (`DPA-2026-03`), nunca texto do contrato. */
export const FORMATO_DO_CONTRATO_DO_SUBOPERADOR = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$/

/** O país onde a empresa processa o dado: o código ISO de duas letras maiúsculas (`BR`, `US`). */
export const FORMATO_DO_PAIS_DO_SUBOPERADOR = /^[A-Z]{2}$/

/** Tamanho do nome e da finalidade, que são texto de empresa e vão para a tela da coordenação. */
export const MAXIMO_DO_NOME_DO_SUBOPERADOR = 120
export const MAXIMO_DA_FINALIDADE_DO_SUBOPERADOR = 300

/** A quem o suboperador atende: a toda escola (a hospedagem), ou só às que a operação listou (um provedor contratado por uma rede). */
export const ALCANCES_DO_SUBOPERADOR = ['todas', 'lista'] as const
export type AlcanceDoSuboperador = (typeof ALCANCES_DO_SUBOPERADOR)[number]

/**
 * As categorias de dado que uma empresa pode receber, na ordem em que a coordenação as lê, com o texto que ela lê. Lista
 * fechada, que a migration repete por extenso no check `suboperador_categorias_validas` (o drizzle-kit lê o pacote pelo
 * `dist`); o teste da migration compara os dois. Sai do mapa de dados de `docs/lgpd.md`: uma categoria nova é uma linha
 * nova no mapa, na mesma tarefa.
 */
export const CATEGORIAS_DE_DADO_DO_SUBOPERADOR = {
  cadastro: 'Cadastro de alunos, professores e turmas',
  conta_de_acesso: 'E-mail e senha de acesso de professores e da coordenação',
  registro_de_acesso: 'Registro de acesso: data, hora e IP de cada entrada',
  conversa_do_aluno: 'Conversa do aluno com o Tutor',
  conversa_do_professor: 'Conversa do professor com o Assistente de ensino',
  trabalho_do_aluno: 'Respostas e correção das atividades do aluno',
  material_da_escola: 'Material pedagógico da escola',
  consulta_de_busca: 'Consulta de pesquisa escrita pelo modelo, sem dado de pessoa',
} as const
export const CHAVES_DE_CATEGORIA_DO_SUBOPERADOR = ['cadastro', 'conta_de_acesso', 'registro_de_acesso', 'conversa_do_aluno', 'conversa_do_professor', 'trabalho_do_aluno', 'material_da_escola', 'consulta_de_busca'] as const satisfies readonly (keyof typeof CATEGORIAS_DE_DADO_DO_SUBOPERADOR)[]
export type CategoriaDeDadoDoSuboperador = (typeof CHAVES_DE_CATEGORIA_DO_SUBOPERADOR)[number]

/** A finalidade fixa na auditoria do cadastro e do encerramento: a escola poder informar o titular sobre o compartilhamento. */
export const FINALIDADE_DO_REGISTRO_DE_SUBOPERADOR = 'informar_o_compartilhamento'

/**
 * O que a coordenação lê de cada suboperador da escola dela. `inicio` e `fim` são a vigência **para esta escola**: a do
 * suboperador quando ele atende toda escola, a da ligação quando atende só as listadas; o `fim` é o mais cedo entre os
 * dois, e nulo é vigente. Sem id, sem contrato, sem quem cadastrou e sem a lista das outras escolas.
 */
export const suboperadorDaEscolaSchema = z.strictObject({
  chave: z.string().regex(FORMATO_DA_CHAVE_DO_SUBOPERADOR),
  nome: z.string().min(1).max(MAXIMO_DO_NOME_DO_SUBOPERADOR),
  finalidade: z.string().min(1).max(MAXIMO_DA_FINALIDADE_DO_SUBOPERADOR),
  pais: z.string().regex(FORMATO_DO_PAIS_DO_SUBOPERADOR),
  categorias: z.array(z.enum(CHAVES_DE_CATEGORIA_DO_SUBOPERADOR)).min(1),
  vedaTreinamento: z.boolean(),
  inicio: z.iso.datetime(),
  fim: z.iso.datetime().nullable(),
})
export type SuboperadorDaEscola = z.infer<typeof suboperadorDaEscolaSchema>

export const suboperadoresResponseSchema = z.strictObject({ suboperadores: z.array(suboperadorDaEscolaSchema) })
export type SuboperadoresResponse = z.infer<typeof suboperadoresResponseSchema>
