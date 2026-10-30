import { z } from 'zod'
import { matriculaDigitadaSchema } from '../estrutura/lista.js'
import { TAMANHO_MAXIMO_TOKEN_DE_CONVITE, TAMANHO_MINIMO_SENHA_NOVA } from '../sessao/convite.js'
import { TAMANHO_MAXIMO_SENHA } from '../sessao/login.js'
import { TAMANHO_MAXIMO_SLUG_NO_LOGIN } from '../sessao/matricula.js'

/**
 * A entrada pública do aluno pela turma (A1, tarefas 5.0 e 6.0; Tech Spec da A1, seções 4 e 7): `POST /v1/salas/abrir`
 * e `POST /v1/salas/reivindicar`, sem login, com o endereço da escola e o link da sala ou o código da turma. Nada de
 * escola nem de turma vem do cliente: a escola sai do slug, e a turma e o ano, da linha do acesso vigente achada por ele.
 */

/**
 * Maior código digitado aceito: os 8 caracteres com o espaço ou o hífen que o aluno pôs entre os grupos, e folga para o
 * que ele colou. O que passa daqui é `ENTRADA_INVALIDA`; o que está dentro e não é um código vigente, `NAO_ENCONTRADO`.
 */
export const TAMANHO_MAXIMO_CODIGO_DIGITADO = 32

/**
 * Mais nomes livres que a página da sala mostra de uma vez (regra 80, itens 3 e 8): a rota é anônima, e uma lista sem
 * teto numa turma seria uma leitura sem teto a cada abertura. Uma turma de verdade tem dezenas de alunos.
 */
export const MAXIMO_DE_NOMES_NA_SALA = 500

const slug = z.string().min(1).max(TAMANHO_MAXIMO_SLUG_NO_LOGIN)
const token = z.string().min(1).max(TAMANHO_MAXIMO_TOKEN_DE_CONVITE)
const codigo = z.string().min(1).max(TAMANHO_MAXIMO_CODIGO_DIGITADO)

/**
 * Corpo de `POST /v1/salas/abrir`: o slug e o token do link (`/e/<slug>/turma#<token>`) **ou** o código digitado, nunca
 * os dois. Estrito: `escolaId`, `turmaId` ou qualquer campo a mais é `ENTRADA_INVALIDA`. O formato do token e do código
 * não é conferido aqui: o que não é um acesso vigente responde o mesmo `NAO_ENCONTRADO`, e a página escolhe o texto pelo
 * caminho que usou.
 */
export const abrirSalaRequestSchema = z.union([z.strictObject({ slug, token }), z.strictObject({ slug, codigo })])

export type AbrirSalaRequest = z.infer<typeof abrirSalaRequestSchema>

/**
 * Resposta de `POST /v1/salas/abrir` (sai com `no-store`): o nome da turma e os nomes livres da lista dela, cada um com
 * o id (que a reivindicação leva, 6.0) e o nome, em ordem de nome, até `MAXIMO_DE_NOMES_NA_SALA`. Nunca a matrícula, o
 * nome reivindicado ou aprovado, nem id de escola, ano ou turma. Estrito.
 */
export const salaAbertaResponseSchema = z.strictObject({
  turma: z.strictObject({ nome: z.string().min(1) }),
  nomes: z.array(z.strictObject({ id: z.uuid(), nome: z.string().min(1) })).max(MAXIMO_DE_NOMES_NA_SALA),
})

export type SalaAbertaResponse = z.infer<typeof salaAbertaResponseSchema>

/**
 * O estado do pedido de reivindicação (A1; Tech Spec da A1, seção 3): `pendente` até a decisão (6.0), `aprovada` ou
 * `recusada` por uma pessoa (8.0), ou `encerrada` pela virada do ano, sem decisão (10.0). O check
 * `reivindicacao_estado_valido` do banco aceita os mesmos.
 */
export const ESTADOS_DA_REIVINDICACAO = ['pendente', 'aprovada', 'recusada', 'encerrada'] as const
export type EstadoDaReivindicacao = (typeof ESTADOS_DA_REIVINDICACAO)[number]

/** Quem decidiu o pedido: o professor da turma ou a coordenação (RF16, destacado na auditoria). O check do banco aceita os mesmos. */
export const DECISORES_DA_REIVINDICACAO = ['professor', 'coordenacao'] as const
export type DecisorDaReivindicacao = (typeof DECISORES_DA_REIVINDICACAO)[number]

/**
 * O que o aluno manda para reivindicar o nome, além do caminho da sala: o id do nome livre que ele escolheu na lista
 * (`salas/abrir`), a matrícula, com as regras da lista (uma linha, sem espaço nas pontas, até 40), a senha que ele cria,
 * com o mínimo da senha nova (12), e a `chaveEnvio`, um UUID que a página sorteia a cada envio e guarda só na memória
 * (Tech Spec da A1, seção 7): o reenvio com a mesma chave responde `enviado` sem pedido novo.
 */
const camposDaReivindicacao = {
  listaNomeId: z.uuid(),
  matricula: matriculaDigitadaSchema,
  senha: z.string().min(TAMANHO_MINIMO_SENHA_NOVA).max(TAMANHO_MAXIMO_SENHA),
  chaveEnvio: z.uuid(),
}

/**
 * Corpo de `POST /v1/salas/reivindicar` (A1, tarefa 6.0): a sala pelo slug e o token **ou** o código, como no abrir, e
 * os campos da reivindicação. Estrito: `escolaId`, `turmaId` ou qualquer campo a mais é `ENTRADA_INVALIDA`. Escola, ano
 * e turma saem do acesso vigente; o nome é conferido contra a turma dele.
 */
export const reivindicarSalaRequestSchema = z.union([
  z.strictObject({ slug, token, ...camposDaReivindicacao }),
  z.strictObject({ slug, codigo, ...camposDaReivindicacao }),
])

export type ReivindicarSalaRequest = z.infer<typeof reivindicarSalaRequestSchema>

/**
 * Resposta de `POST /v1/salas/reivindicar` (sai com `no-store`): só `enviado`, igual para o pedido novo e para o reenvio
 * com a mesma chave. Não diz quem vai decidir, nem traz id, nome ou matrícula. Estrito.
 */
export const reivindicacaoResponseSchema = z.strictObject({ resultado: z.literal('enviado') })

export type ReivindicacaoResponse = z.infer<typeof reivindicacaoResponseSchema>
