import { z } from 'zod'
import { PAPEIS_DE_USUARIO } from '../permissao/matriz.js'

/**
 * Um acesso da conta, para o seletor de escola (RF14 do F1; P30, A1 tarefa 12.0) e para a escolha no login: o usuário
 * ativo, o nome da escola, o nome da rede dela e o papel nela. Nada além disso da outra escola: nem id dela nem da rede,
 * nem turma, nem número de turmas, nem vínculo (Tech Spec da A1, seção 11).
 */
export const esquemaAcessoDaConta = z
  .object({ usuarioId: z.uuid(), escolaNome: z.string().min(1), redeNome: z.string().min(1), papel: z.enum(PAPEIS_DE_USUARIO) })
  .strict()

export type AcessoDaConta = z.infer<typeof esquemaAcessoDaConta>

/**
 * Corpo de `GET /v1/eu`: quem está na sessão, na escola da sessão, e os minutos sem uso até ela vencer. Estrito: nada
 * além destes campos, e nenhum e-mail (a conta da equipe não sai aqui). `acessos` lista os usuários ativos da conta da
 * sessão, este incluído; o aluno não tem conta, e para ele vem vazio.
 */
export const esquemaRespostaEu = z
  .object({
    usuarioId: z.uuid(),
    papel: z.enum(PAPEIS_DE_USUARIO),
    nome: z.string().min(1),
    escola: z.object({ id: z.uuid(), nome: z.string().min(1), slug: z.string().min(1) }).strict(),
    inatividadeMin: z.number().int().positive(),
    /** Quando a pessoa viu a introdução do papel dela, ou nulo se ainda não viu. */
    introducaoVistaEm: z.iso.datetime().nullable(),
    acessos: z.array(esquemaAcessoDaConta),
  })
  .strict()

export type RespostaEu = z.infer<typeof esquemaRespostaEu>

/** Corpo de `POST /v1/eu/introducao`: a pessoa marca que viu a introdução. Vazio e estrito: nada vem do cliente. */
export const esquemaConcluirIntroducao = z.object({}).strict()

/** Resposta do POST: a mesma data que o `GET /v1/eu` devolveria, a primeira que ficou gravada. */
export const esquemaRespostaIntroducao = z.object({ introducaoVistaEm: z.iso.datetime() }).strict()

export type RespostaIntroducao = z.infer<typeof esquemaRespostaIntroducao>
