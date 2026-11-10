import { z } from 'zod'
import { pageSchema } from '../estrutura/pagination.js'
import { emailConvidadoSchema, nomeDigitadoSchema, TAMANHO_MAXIMO_NOME_DIGITADO } from '../operacao/painel.js'
import { tokenDeLinkSchema } from '../sessao/token.js'

/**
 * A vida do envio do convite por e-mail (acesso-e-convites, tarefa 1.0; Tech Spec, seção 3). Só o convite de canal `email` tem envio: o copiado
 * tem `null`. Mora aqui porque a lista de professores (`GET /v1/professores`) e a web o leem; o schema do banco o reexporta.
 */
export const ESTADOS_DO_ENVIO = ['na_fila', 'enviando', 'enviado', 'falhou', 'cancelado'] as const

export type EstadoDoEnvio = (typeof ESTADOS_DO_ENVIO)[number]

/**
 * Quantos convites por e-mail uma escola manda por hora (acesso-e-convites, tarefa 3.0; Tech Spec, seção 5, "Enviar"): conta o convite que entra na
 * fila, não a seleção. Acima disso, `LIMITE_EXCEDIDO` (429) com `Retry-After`, e nada é enfileirado.
 */
export const CONVITES_POR_HORA_POR_ESCOLA = 300

/**
 * Quantos professores um "Enviar" aceita na seleção: o dobro da cota, para a seleção da escola inteira caber e a lista nunca virar um corpo sem fim.
 */
export const MAXIMO_DE_PROFESSORES_NO_ENVIO = 1_000

/**
 * Corpo de `POST /v1/professores` (A1, RF6): o nome e o e-mail de login do professor, com as regras do convite da
 * coordenação (nome de uma linha, até 200; e-mail sem espaço nas pontas e em minúsculas). Estrito: campo a mais, como
 * `escolaId` ou `papel`, é `ENTRADA_INVALIDA`. A escola vem da sessão; o papel é sempre `professor`.
 */
export const cadastrarProfessorRequestSchema = z.strictObject({
  nome: nomeDigitadoSchema,
  email: emailConvidadoSchema,
})

export type CadastrarProfessorRequest = z.infer<typeof cadastrarProfessorRequestSchema>

/**
 * Corpo de `POST /v1/professores/:usuarioId/convite/{refazer,revogar}`: nenhum campo. Estrito: `{}` ou corpo nenhum; o
 * convite é sempre o último de professor daquele usuário na escola da sessão, nunca um id vindo do corpo.
 */
export const conviteDeProfessorEmptyBodyRequestSchema = z.strictObject({})

/**
 * Corpo de `POST /v1/professores/:usuarioId/email` (acesso-e-convites, 18.0; Tech Spec, seção 5, "Corrigir o e-mail"): o e-mail certo do professor que nunca entrou, com as regras do
 * cadastro (`emailConvidadoSchema`: sem espaço nas pontas e em minúsculas). Estrito: campo a mais, como `escolaId` ou `contaId`, é `ENTRADA_INVALIDA`. A escola vem da sessão e
 * o professor, do endereço; o e-mail de hoje não é pedido nem devolvido (E8).
 */
export const corrigirEmailDoProfessorRequestSchema = z.strictObject({
  email: emailConvidadoSchema,
})

export type CorrigirEmailDoProfessorRequest = z.infer<typeof corrigirEmailDoProfessorRequestSchema>

/**
 * Corpo de `POST /v1/professores/convites/enviar` (acesso-e-convites, tarefa 3.0, RF11): os professores selecionados, ou nenhum campo para mandar a todos
 * os que esperam o convite. Estrito: campo a mais, como `escolaId`, é `ENTRADA_INVALIDA`. Ids que não são de professor da escola, ou que não esperam o
 * convite (revogado, aceito, ativo, desativado), não entram e não são recusados: a contagem diz quantos entraram. A escola vem da sessão.
 */
export const enviarConvitesRequestSchema = z.strictObject({
  usuarioIds: z.array(z.uuid()).min(1).max(MAXIMO_DE_PROFESSORES_NO_ENVIO).optional(),
})

export type EnviarConvitesRequest = z.infer<typeof enviarConvitesRequestSchema>

/**
 * Resposta de `POST /v1/professores/convites/enviar`: quantos convites entraram na fila. Zero é resposta válida (ninguém esperava o convite), nunca 409.
 * O e-mail sai depois, pelo worker: a resposta não espera o envio.
 */
export const enviarConvitesResponseSchema = z.strictObject({
  quantidade: z.int().min(0).max(MAXIMO_DE_PROFESSORES_NO_ENVIO),
})

export type EnviarConvitesResponse = z.infer<typeof enviarConvitesResponseSchema>

/**
 * Resposta do cadastro (`POST /v1/professores`) e do refazer (`POST /v1/professores/:usuarioId/convite/refazer`): o
 * usuário do professor na escola (que o refazer e o revogar recebem), o id do convite novo e o token, que só existe nesta
 * resposta (o banco guarda o SHA-256). A web monta o link `/convite#<token>`. Sai com `no-store`. Estrito: nada da pessoa,
 * e nada que diga se a conta do e-mail já existia (E11).
 */
export const conviteDeProfessorResponseSchema = z.strictObject({
  usuarioId: z.uuid(),
  conviteId: z.uuid(),
  token: tokenDeLinkSchema,
})

export type ConviteDeProfessorResponse = z.infer<typeof conviteDeProfessorResponseSchema>

/**
 * O estado do professor na escola, pelo convite dele (A1, tarefa 3.0). Calculado só por `estadoDoProfessor`, em
 * `@educa/core`: a lista e a escrita (refazer, revogar) usam a mesma função.
 *
 * - `pendente`, `vencido`: o último convite está em aberto (não usado, não revogado), dentro ou fora do prazo;
 * - `revogado`: o último convite foi revogado, e o professor não entrou;
 * - `aceito`: entrou pelo convite, esteja já ativo ou ainda à espera da primeira entrada com a senha que a conta tinha. Os
 *   dois ficam juntos de propósito: separá-los diria à coordenação se o e-mail tinha conta em outra escola (E11);
 * - `ativo`: ativo sem ter entrado por convite de professor (o que veio antes da A1);
 * - `desativado`: inativo, sem convite em aberto, depois de ter entrado ou sem convite nenhum.
 */
export const ESTADOS_DO_PROFESSOR = ['pendente', 'vencido', 'revogado', 'aceito', 'ativo', 'desativado'] as const

export type EstadoDoProfessor = (typeof ESTADOS_DO_PROFESSOR)[number]

/**
 * Os estados em que a coordenação aloca o professor numa turma (`POST /v1/vinculos`; A1, 13.0, decidido pelo Joaquim em
 * 27/09/2026): o convite em aberto e dentro do prazo, e quem já entrou. O servidor decide por esta lista, com o estado de
 * `estadoDoProfessor`, e a tela de alocação oferece só estes professores. O vínculo nasce `pendente` e só alcança a turma
 * depois do aceite e da confirmação (P2).
 *
 * `vencido`, `revogado` e `desativado` ficam de fora, e respondem como o professor inexistente. O `aceito` entra inteiro:
 * alocar só o ativo diria à coordenação se o e-mail tinha conta em outra escola (E11).
 */
export const ESTADOS_DO_PROFESSOR_ALOCAVEIS = ['pendente', 'aceito', 'ativo'] as const satisfies readonly EstadoDoProfessor[]

/**
 * A matriz estado × ação do convite do professor, num lugar só, como a da coordenação (A0b): o servidor decide por ela,
 * sob a trava da escola, e a tela (14.0) mostra só as ações que ela permite. Quem recusa é o servidor. O professor sem
 * convite de professor nenhum não chega à matriz: `NAO_ENCONTRADO`.
 *
 * Refazer: só o convite em aberto, pendente ou vencido.
 */
export const REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO: Readonly<Record<EstadoDoProfessor, 'refazer' | 'conflito'>> = {
  pendente: 'refazer',
  vencido: 'refazer',
  revogado: 'conflito',
  aceito: 'conflito',
  ativo: 'conflito',
  desativado: 'conflito',
}

/**
 * Revogar: só o convite em aberto, pendente ou vencido. `revogado` fica `NAO_ENCONTRADO`, como o do coordenador. O
 * `aceito` é `CONFLITO` nos dois casos que ele junta: revogar só o que espera a primeira entrada diria à coordenação que a
 * conta existia (E11). Para chamar de volta quem aceitou e não entrou, a coordenação cadastra de novo o mesmo e-mail.
 */
export const REVOGAR_CONVITE_DE_PROFESSOR_POR_ESTADO: Readonly<Record<EstadoDoProfessor, 'revogar' | 'conflito' | 'nao_encontrado'>> = {
  pendente: 'revogar',
  vencido: 'revogar',
  revogado: 'nao_encontrado',
  aceito: 'conflito',
  ativo: 'conflito',
  desativado: 'conflito',
}

/**
 * Corrigir o e-mail (acesso-e-convites, 18.0): a mesma matriz do refazer, por estado, escrita à parte para a tela (19.0) e o servidor lerem a regra por ela. **Tem de ficar igual à do `REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO`**: nenhum teste compara as duas hoje (a divergência só apareceria nos casos de estado da rota). Só o convite
 * em aberto, `pendente` ou `vencido`, troca de conta. O `aceito` e o `ativo` (quem já entrou, ou entra) e o `desativado` e o `revogado` são `CONFLITO`: a coordenação
 * revoga e cadastra o e-mail certo. Além do estado, o servidor recusa quem já entrou alguma vez (um convite de professor com `usadoEm`).
 */
export const CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO: Readonly<Record<EstadoDoProfessor, 'corrigir' | 'conflito'>> = {
  pendente: 'corrigir',
  vencido: 'corrigir',
  revogado: 'conflito',
  aceito: 'conflito',
  ativo: 'conflito',
  desativado: 'conflito',
}

/**
 * Um professor na lista da coordenação: o usuário, o nome, o estado do convite e o envio dele por e-mail (`null` quando o último convite foi copiado, e
 * `falhou` quando o servidor recusou ou o prazo esgotou), e `enviadoEm`, a hora em que o job entregou o e-mail (ISO; só com `envio = 'enviado'`, `null` nos
 * outros quatro estados e no convite copiado). A API sempre manda os dois; quem lê uma resposta sem eles (a de antes) os recebe `null`. Nem e-mail, nem token, nem link, nem nada que diga se a conta do e-mail era nova (E8, E11).
 */
export const professorDaEscolaSchema = z.strictObject({
  usuarioId: z.uuid(),
  nome: z.string().min(1).max(TAMANHO_MAXIMO_NOME_DIGITADO),
  estado: z.enum(ESTADOS_DO_PROFESSOR),
  envio: z.enum(ESTADOS_DO_ENVIO).nullable().default(null),
  enviadoEm: z.iso.datetime().nullable().default(null),
})

export type ProfessorDaEscola = z.infer<typeof professorDaEscolaSchema>

/** Resposta de `GET /v1/professores`: uma página, em ordem de `usuarioId`, com `?pagina=` e `?limite=` da estrutura. */
export const listaDeProfessoresResponseSchema = pageSchema(professorDaEscolaSchema)

export type ListaDeProfessoresResponse = z.infer<typeof listaDeProfessoresResponseSchema>
