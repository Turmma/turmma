import { z } from 'zod'

/**
 * Os caracteres da senha provisória (acesso-e-convites, tarefa 9.0; Tech Spec, seção 5, "Senha provisória"): 31, sem `0`, `1`, `I`,
 * `L` e `O`, que se confundem quando a senha é ditada em sala ou lida no papel. Só maiúsculas e algarismos.
 */
export const ALFABETO_DA_SENHA_PROVISORIA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** Quantos caracteres tem a senha provisória, em dois grupos de `CARACTERES_POR_GRUPO_DA_SENHA_PROVISORIA`. */
export const TAMANHO_DA_SENHA_PROVISORIA = 8
export const CARACTERES_POR_GRUPO_DA_SENHA_PROVISORIA = 4

/** Quanto vale a senha provisória, contada da geração: 24 horas (RF13). */
export const VALIDADE_DA_SENHA_PROVISORIA_HORAS = 24

/**
 * A janela em que uma provisória ainda não usada bloqueia outra, de qualquer autor (`CONFLITO`): quem clicou "gerar" duas vezes, ou a
 * coordenação e o professor ao mesmo tempo, não troca a senha que o primeiro acabou de ver na tela.
 */
export const JANELA_DO_CONFLITO_DA_SENHA_PROVISORIA_SEGUNDOS = 10

/** As cotas de quem gera, contadas só depois da checagem de escopo: 60 por hora por quem gera e 5 por dia por aluno. */
export const LIMITE_DE_PROVISORIAS_POR_HORA_E_USUARIO = 60
export const LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO = 5

/** Os papéis que geram a senha provisória, e que a auditoria guarda no `depois` de `senha_provisoria.gerada`. */
export const PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA = ['coordenador', 'professor'] as const
export type PapelQueGeraASenhaProvisoria = (typeof PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA)[number]

/** A senha em dois grupos separados por hífen, como a tela a mostra: `ABCD-EFGH`. */
export function formatarSenhaProvisoria(senha: string): string {
  return `${senha.slice(0, CARACTERES_POR_GRUPO_DA_SENHA_PROVISORIA)}-${senha.slice(CARACTERES_POR_GRUPO_DA_SENHA_PROVISORIA)}`
}

/**
 * Resposta de `POST /v1/usuarios/:usuarioId/senha-provisoria`: a senha em dois grupos e a validade. É a única vez que a senha existe em
 * claro: nenhuma leitura a devolve, o banco guarda só o hash, e a resposta sai com `Cache-Control: no-store`.
 */
export const senhaProvisoriaResponseSchema = z
  .object({
    senha: z.string().regex(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/),
    expiraEm: z.iso.datetime(),
  })
  .strict()

export type SenhaProvisoriaResponse = z.infer<typeof senhaProvisoriaResponseSchema>
