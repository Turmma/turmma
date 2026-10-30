import { z } from 'zod'
import { idempotencyKeySchema } from '../time/idempotency-key.js'
import { citacaoSchema } from './conteudo.js'

/**
 * A conversa do professor com o Assistente de ensino (MVP, A2; D18): `GET /v1/assistente/conversa` e
 * `POST /v1/assistente/mensagens`. **Só o próprio professor lê a conversa dele** (regra 70, item 8): não existe rota,
 * schema nem célula da matriz que a entregue à coordenação. Escola, ano e dono da thread vêm da sessão.
 */

/** O maior pedido que o professor escreve de uma vez. */
export const TAMANHO_MAXIMO_DO_PEDIDO = 2000
export const TAMANHO_MAXIMO_DO_TEMA = 300
export const MAXIMO_DE_QUESTOES_POR_ATIVIDADE = 20
export const QUESTOES_PADRAO_POR_ATIVIDADE = 5
export const MAXIMO_DE_CITACOES_POR_MENSAGEM = 8

/** As ferramentas que geram um artefato a partir de um tema (D74). A Adaptação parte de um artefato, e tem rota própria. */
export const FERRAMENTAS_GERADORAS = ['atividade_objetiva', 'plano_de_aula'] as const
export type FerramentaGeradora = (typeof FERRAMENTAS_GERADORAS)[number]

export const NOME_DA_FERRAMENTA: Readonly<Record<FerramentaGeradora | 'adaptacao', string>> = {
  atividade_objetiva: 'Atividade objetiva',
  plano_de_aula: 'Plano de aula',
  adaptacao: 'Adaptação',
}

/**
 * O que a ferramenta precisa para gerar: a turma, a disciplina, o tema e, na atividade, quantas questões. É o mesmo
 * objeto no formulário, no cartão da conversa e na proposta do Assistente: um motor só (D18).
 */
export const parametrosDeFerramentaSchema = z.strictObject({
  turmaId: z.uuid(),
  disciplinaId: z.uuid(),
  tema: z.string().trim().min(1).max(TAMANHO_MAXIMO_DO_TEMA),
  quantidade: z.number().int().min(1).max(MAXIMO_DE_QUESTOES_POR_ATIVIDADE).optional(),
})
export type ParametrosDeFerramenta = z.infer<typeof parametrosDeFerramentaSchema>

/**
 * A pergunta da D18: o Assistente entendeu que o pedido cabe numa ferramenta e **pergunta antes de gerar**. A tela mostra
 * as duas opções com o mesmo peso (abrir a ferramenta ou seguir conversando) e, com o sim, abre o cartão já preenchido
 * com `parametros`, que o professor ajusta antes de mandar para `POST /v1/ferramentas/:ferramenta/gerar`.
 */
export const propostaDeFerramentaSchema = z.strictObject({
  ferramenta: z.enum(FERRAMENTAS_GERADORAS),
  parametros: parametrosDeFerramentaSchema,
})
export type PropostaDeFerramenta = z.infer<typeof propostaDeFerramentaSchema>

/**
 * O que o professor respondeu à pergunta da D18, quando a resposta **não** foi abrir a ferramenta. As duas opções têm o
 * mesmo peso: abrir a ferramenta é `POST /v1/ferramentas/:ferramenta/gerar`; "só conversar" é a mensagem seguinte com
 * esta marca, e o Assistente responde ao último pedido em texto, sem propor ferramenta de novo. Lista fechada: não é
 * campo de texto.
 */
export const RESPOSTAS_A_PROPOSTA = ['so_conversar'] as const
export type RespostaAProposta = (typeof RESPOSTAS_A_PROPOSTA)[number]

/**
 * Corpo de `POST /v1/assistente/mensagens`: o texto, a turma e a disciplina sobre as quais o professor está falando (com
 * vínculo confirmado dele; a de outra pessoa responde como inexistente) e a chave do envio. Responde 202 com a execução.
 *
 * `resposta: 'so_conversar'` é opcional, e vai quando o professor escolheu "só conversar" na proposta de ferramenta: o
 * `texto` é a fala dele como a tela a mostra, e a resposta do Assistente é sempre texto, sobre o último pedido dele. Sem
 * a marca, nada muda.
 */
export const mensagemAoAssistenteRequestSchema = z.strictObject({
  texto: z.string().trim().min(1).max(TAMANHO_MAXIMO_DO_PEDIDO),
  turmaId: z.uuid(),
  disciplinaId: z.uuid(),
  chaveEnvio: idempotencyKeySchema,
  resposta: z.enum(RESPOSTAS_A_PROPOSTA).optional(),
})
export type MensagemAoAssistenteRequest = z.infer<typeof mensagemAoAssistenteRequestSchema>

export const AUTORES_DE_MENSAGEM_DE_AGENTE = ['usuario', 'agente'] as const
export type AutorDeMensagemDeAgente = (typeof AUTORES_DE_MENSAGEM_DE_AGENTE)[number]

/**
 * O que se guarda em `mensagem_agente.conteudo` quando quem fala é o agente: texto com as páginas citadas, ou a proposta
 * de ferramenta. Validado na saída do modelo e na leitura (regra 30, item 7).
 */
export const conteudoDaMensagemDoAgenteSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('texto'), texto: z.string().min(1).max(8000), citacoes: z.array(citacaoSchema).max(MAXIMO_DE_CITACOES_POR_MENSAGEM) }),
  z.strictObject({ tipo: z.literal('proposta_de_ferramenta'), texto: z.string().min(1).max(1000), proposta: propostaDeFerramentaSchema }),
])
export type ConteudoDaMensagemDoAgente = z.infer<typeof conteudoDaMensagemDoAgenteSchema>

/** O que se guarda em `mensagem_agente.conteudo` quando quem fala é o professor: só o texto. A turma e a disciplina são colunas. */
export const conteudoDaMensagemDoUsuarioSchema = z.strictObject({ tipo: z.literal('texto'), texto: z.string().min(1).max(TAMANHO_MAXIMO_DO_PEDIDO) })
export type ConteudoDaMensagemDoUsuario = z.infer<typeof conteudoDaMensagemDoUsuarioSchema>

const camposDaMensagem = { id: z.uuid(), criadaEm: z.iso.datetime() }

/** Uma mensagem do Assistente, como a tela a mostra. Toda mensagem do agente é saída de IA e leva o selo de IA (regra 70, item 4a). */
export const mensagemDoAgenteSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ ...camposDaMensagem, autor: z.literal('agente'), tipo: z.literal('texto'), texto: z.string().min(1), citacoes: z.array(citacaoSchema).max(MAXIMO_DE_CITACOES_POR_MENSAGEM) }),
  z.strictObject({ ...camposDaMensagem, autor: z.literal('agente'), tipo: z.literal('proposta_de_ferramenta'), texto: z.string().min(1), proposta: propostaDeFerramentaSchema }),
])
export type MensagemDoAgente = z.infer<typeof mensagemDoAgenteSchema>

/** Uma mensagem do professor na conversa dele. */
export const mensagemDoUsuarioSchema = z.strictObject({
  ...camposDaMensagem,
  autor: z.literal('usuario'),
  tipo: z.literal('texto'),
  texto: z.string().min(1),
  turmaId: z.uuid(),
  disciplinaId: z.uuid(),
})
export type MensagemDoUsuario = z.infer<typeof mensagemDoUsuarioSchema>

export const mensagemDaConversaSchema = z.union([mensagemDoUsuarioSchema, mensagemDoAgenteSchema])
export type MensagemDaConversa = z.infer<typeof mensagemDaConversaSchema>

export const MENSAGENS_PADRAO_POR_PAGINA = 50
export const MAXIMO_DE_MENSAGENS_POR_PAGINA = 100

/**
 * Consulta das conversas (`GET /v1/assistente/conversa` e `GET /v1/tutor/conversa`): sem nada, as mensagens mais
 * recentes; com `antes=<id>`, as anteriores àquela. Listagem sempre com teto (regra 80, item 8).
 */
export const camposDaConsultaDeConversa = {
  antes: z.uuid().optional(),
  limite: z.coerce.number().int().min(1).max(MAXIMO_DE_MENSAGENS_POR_PAGINA).default(MENSAGENS_PADRAO_POR_PAGINA),
}
export const conversaDoAssistenteQuerySchema = z.strictObject(camposDaConsultaDeConversa)
export type ConversaDoAssistenteQuery = z.infer<typeof conversaDoAssistenteQuerySchema>

/**
 * Resposta de `GET /v1/assistente/conversa`: as mensagens da thread do professor no ano em curso, da mais antiga para a
 * mais nova, e `anterior` (o id a mandar em `?antes=`) quando há mais para trás. Thread que ainda não existe é lista vazia.
 */
export const conversaDoAssistenteResponseSchema = z.strictObject({
  mensagens: z.array(mensagemDaConversaSchema).max(MAXIMO_DE_MENSAGENS_POR_PAGINA),
  anterior: z.uuid().optional(),
})
export type ConversaDoAssistenteResponse = z.infer<typeof conversaDoAssistenteResponseSchema>
