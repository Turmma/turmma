import { z } from 'zod'
import { TAMANHO_MAXIMO_SENHA, loginResponseSchema } from './login.js'
import { TAMANHO_MINIMO_SENHA_NOVA } from './convite.js'

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
 * A senha provisória como o aluno a digita vira a que foi sorteada: sem o hífen nem os espaços da tela, e em maiúsculas (o alfabeto só tem maiúsculas e algarismos). O login de matrícula
 * só a aplica quando o hash que confere é o da provisória: a senha comum do aluno vai como veio.
 */
export function normalizarSenhaProvisoria(digitada: string): string {
  return digitada.replace(/[\s-]/g, '').toUpperCase()
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

/** A finalidade fixa, escrita pelo servidor, da leitura do alvo da provisória pela coordenação (regra 20, item 10): confirmar de quem é a senha antes de gerá-la. */
export const FINALIDADE_DA_LEITURA_DO_ALVO = 'confirmar_o_aluno_da_senha_provisoria'

/**
 * Resposta de `GET /v1/usuarios/:usuarioId/senha-provisoria` (acesso-e-convites, tarefa 17.0; Tech Spec, seção 5, "O alvo da provisória"): o aluno que a confirmação mostra antes de gerar,
 * um por vez. `turma` é a do vínculo confirmado no ano em curso (nula sem ano em curso, para a coordenação); `matricula`, a da credencial (nula no aluno só com a conta da escola);
 * `entraPelaContaDaEscola` diz o que a geração responderia com `ENTRA_PELA_CONTA_DA_ESCOLA`. Nunca hash, provisória, validade, quem gerou nem e-mail. Sai com `Cache-Control: no-store`.
 */
export const alvoDaSenhaProvisoriaResponseSchema = z
  .object({
    nome: z.string().min(1),
    turma: z.string().min(1).nullable(),
    matricula: z.string().min(1).nullable(),
    entraPelaContaDaEscola: z.boolean(),
  })
  .strict()

export type AlvoDaSenhaProvisoriaResponse = z.infer<typeof alvoDaSenhaProvisoriaResponseSchema>

/** Quanto vale o bilhete da troca, contado do login com a provisória: 10 minutos (acesso-e-convites, tarefa 10.0; Tech Spec, seção 5, "Senha provisória"). */
export const VALIDADE_DO_BILHETE_DA_TROCA_MINUTOS = 10

/** Quantas provisórias anteriores a troca mostra ao aluno: as 10 mais recentes (RF13). */
export const MAXIMO_DE_PROVISORIAS_ANTERIORES_NA_TROCA = 10

/** A etapa que o login de matrícula devolve no lugar da sessão quando a senha certa é a provisória: o aluno só pode criar a nova. */
export const ETAPA_TROCAR_SENHA = 'trocar_senha'

/** Maior bilhete aceito na resposta do login: um JWT curto, com a escola, o aluno e a validade da provisória. */
const TAMANHO_MAXIMO_BILHETE_DA_TROCA = 1_024

/**
 * Resposta 200 do login de matrícula: a do login comum (`pronta`, ou o segundo fator que o aluno não tem) ou, com a senha provisória certa, `trocar_senha` com o bilhete
 * (acesso-e-convites, tarefa 10.0). O bilhete não é sessão: só vale em `trocar-senha` e em `trocas`, no `Authorization`, nunca na URL.
 */
export const loginMatriculaResponseSchema = z.union([
  loginResponseSchema,
  z.object({ etapa: z.literal(ETAPA_TROCAR_SENHA), bilhete: z.string().min(1).max(TAMANHO_MAXIMO_BILHETE_DA_TROCA) }).strict(),
])

export type LoginMatriculaResponse = z.infer<typeof loginMatriculaResponseSchema>

/** Corpo de `POST /v1/sessao/matricula/trocar-senha`: só a senha nova, com o mínimo do aceite do convite. O aluno e a escola vêm do bilhete, nunca do corpo. */
export const trocarSenhaProvisoriaRequestSchema = z.object({ senha: z.string().min(TAMANHO_MINIMO_SENHA_NOVA).max(TAMANHO_MAXIMO_SENHA) }).strict()

export type TrocarSenhaProvisoriaRequest = z.infer<typeof trocarSenhaProvisoriaRequestSchema>

/**
 * Resposta de `GET /v1/sessao/matricula/trocas`: as provisórias geradas antes da que o aluno acabou de usar, da mais nova à mais antiga, com a data, o papel de quem gerou
 * (`coordenador` ou `professor`, nunca o nome nem o id) e se foi usada. Mostra ao aluno que alguém gerou uma senha para ele que ele não usou.
 */
export const trocasDaProvisoriaResponseSchema = z
  .object({
    anteriores: z
      .array(z.object({ geradaEm: z.iso.datetime(), papel: z.enum(PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA), usada: z.boolean() }).strict())
      .max(MAXIMO_DE_PROVISORIAS_ANTERIORES_NA_TROCA),
  })
  .strict()

export type TrocasDaProvisoriaResponse = z.infer<typeof trocasDaProvisoriaResponseSchema>
