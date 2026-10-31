import { z } from 'zod'
import { TIPOS_DE_ADAPTACAO } from '../assistente/conteudo.js'
import { mensagemDoAgenteSchema, parametrosDeFerramentaSchema, RESPOSTAS_A_PROPOSTA } from '../assistente/conversa.js'
import { ErrorCode } from '../errors/error-code.js'
import { mensagemDoTutorAoAlunoSchema } from '../tutor/tutor.js'
import type { ChaveDeFuncao } from './funcoes.js'

/**
 * A execução de agente (MVP, seção 4, item 1; glossário, "Agente"; D49): todo `POST` que dispara IA grava uma
 * `execucao_agente` `pendente` e responde 202 com o id dela. A execução roda depois, pelo `AgenteExecutor` da camada
 * de IA, e a tela consulta `GET /v1/execucoes/:id` até ela terminar. Não há WebSocket nesta fatia.
 */
export const ESTADOS_DE_EXECUCAO = ['pendente', 'rodando', 'concluida', 'falhou'] as const
export type EstadoDeExecucao = (typeof ESTADOS_DE_EXECUCAO)[number]

/** Os estados em que a tela para de consultar. */
export const ESTADOS_FINAIS_DE_EXECUCAO = ['concluida', 'falhou'] as const satisfies readonly EstadoDeExecucao[]

/** De quanto em quanto a tela consulta `GET /v1/execucoes/:id`. */
export const INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS = 1000

/**
 * As tarefas de IA da fatia: os mesmos nomes do catálogo `TAREFAS_DE_IA` da camada de IA (`packages/core/src/ia`), que
 * é quem tem o prompt e o schema de cada uma. É o que `execucao_agente.tarefa` e `consumo_ia.tarefa` guardam.
 */
export const TAREFAS_DE_IA = [
  'propor_ferramenta',
  'gerar_atividade_objetiva',
  'gerar_plano_de_aula',
  'adaptar_atividade',
  'turno_do_tutor',
  'relatorio_da_correcao',
  'resumo_do_analista',
] as const
export type TarefaDeIa = (typeof TAREFAS_DE_IA)[number]

/**
 * A função de cada tarefa: é por ela que a suspensão alcança a execução (D60) e que o consumo se soma (D14). O check
 * `execucao_agente_tarefa_da_funcao` do banco repete o par: a correção gravada com a função do chat escaparia da
 * suspensão da correção de objetiva.
 */
export const FUNCAO_DA_TAREFA_DE_IA = {
  propor_ferramenta: 'conversa_e_ferramentas',
  gerar_atividade_objetiva: 'conversa_e_ferramentas',
  gerar_plano_de_aula: 'conversa_e_ferramentas',
  adaptar_atividade: 'adaptacao',
  turno_do_tutor: 'tutor_com_o_aluno',
  relatorio_da_correcao: 'correcao_de_objetiva',
  resumo_do_analista: 'resumo_e_alerta',
} as const satisfies Record<TarefaDeIa, ChaveDeFuncao>

/** O perfil de IA de uma chamada (regra 30, item 2): a classe de tarefa que escolhe o modelo. O check `consumo_ia_perfil_valido` repete a lista. */
export const PERFIS_DE_IA = ['rapido', 'padrao', 'complexo', 'visao'] as const
export type PerfilDeIa = (typeof PERFIS_DE_IA)[number]

/**
 * Quem atendeu a chamada: o adaptador falso, o provedor do padrão OpenAI, ou nenhum, quando a resposta saiu de regra
 * fixa (o assunto delicado no Tutor, D36). É a `OutputSource` da camada de IA; o check `consumo_ia_origem_valida` repete
 * a lista.
 */
export const ORIGENS_DA_SAIDA_DE_IA = ['falso', 'openai_compat', 'regra_fixa'] as const
export type OrigemDaSaidaDeIa = (typeof ORIGENS_DA_SAIDA_DE_IA)[number]

/** Como a chamada ao modelo terminou, em `consumo_ia.estado`. */
export const ESTADOS_DE_CONSUMO_DE_IA = ['concluida', 'falhou'] as const
export type EstadoDeConsumoDeIa = (typeof ESTADOS_DE_CONSUMO_DE_IA)[number]

/**
 * O formato de todo código de erro: maiúsculas, algarismos e sublinhado. É o que o check de `execucao_agente.erro` e de
 * `consumo_ia.codigo_de_erro` aceita: um código nosso cabe, e a mensagem de um provedor, com espaço e minúscula, não.
 */
export const FORMATO_DO_CODIGO_DE_ERRO = /^[A-Z][A-Z0-9_]{2,63}$/

/** Resposta 202 de todo `POST` que dispara IA: só o id da execução. O reenvio com a mesma `chaveEnvio` devolve o mesmo id. */
export const execucaoAceitaResponseSchema = z.strictObject({ execucaoId: z.uuid() })
export type ExecucaoAceitaResponse = z.infer<typeof execucaoAceitaResponseSchema>

const tiposDeAdaptacao = z.array(z.enum(TIPOS_DE_ADAPTACAO)).min(1).max(TIPOS_DE_ADAPTACAO.length)

/**
 * O que se guarda em `execucao_agente.entrada`: só o que a execução precisa e que não está em outra linha. A mensagem
 * do professor e a do aluno ficam em `mensagem_agente` e `mensagem_tutor`, ligadas pela execução, e **não se repetem
 * aqui**. Os ids são entrada, e não vínculo: quem executa os relê pelo repository, no escopo da escola da execução.
 */
export const execucaoInputSchema = z.discriminatedUnion('tarefa', [
  // `resposta` é a marca de lista fechada de quem escolheu "só conversar" na proposta (D18): nunca o texto da mensagem.
  z.strictObject({ tarefa: z.literal('propor_ferramenta'), resposta: z.enum(RESPOSTAS_A_PROPOSTA).optional() }),
  z.strictObject({ tarefa: z.literal('gerar_atividade_objetiva'), parametros: parametrosDeFerramentaSchema }),
  z.strictObject({ tarefa: z.literal('gerar_plano_de_aula'), parametros: parametrosDeFerramentaSchema }),
  z.strictObject({ tarefa: z.literal('adaptar_atividade'), artefatoId: z.uuid(), tipos: tiposDeAdaptacao, tempoExtraPercentual: z.number().int().min(10).max(100).optional() }),
  z.strictObject({ tarefa: z.literal('turno_do_tutor') }),
  z.strictObject({ tarefa: z.literal('relatorio_da_correcao'), atividadeAplicadaId: z.uuid() }),
  z.strictObject({ tarefa: z.literal('resumo_do_analista') }),
])
export type ExecucaoInput = z.infer<typeof execucaoInputSchema>

/**
 * O que se guarda em `execucao_agente.resultado`, e o que o trabalho da execução devolve ao `AgenteExecutor`: **só a
 * referência** ao que ela gravou. A mensagem do Assistente e a do Tutor ficam em `mensagem_agente` e `mensagem_tutor`, e
 * o texto delas não é copiado para a execução: a conversa do aluno tem um lugar só, com a retenção dela.
 */
export const resultadoGravadoSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('mensagem'), mensagemId: z.uuid() }),
  z.strictObject({ tipo: z.literal('artefato'), artefatoId: z.uuid(), entregaId: z.uuid().nullable() }),
  z.strictObject({ tipo: z.literal('mensagem_do_tutor'), mensagemId: z.uuid() }),
  z.strictObject({ tipo: z.literal('lote_de_correcao'), entregaId: z.uuid() }),
  z.strictObject({ tipo: z.literal('resumo_do_analista'), resumoId: z.uuid() }),
])
export type ResultadoGravado = z.infer<typeof resultadoGravadoSchema>

/**
 * O resultado da execução concluída, como a tela o recebe. A API o monta a partir do `resultado` gravado, lendo a
 * mensagem pelo id, no escopo de quem pede.
 *
 * - `mensagem`: a resposta do Assistente na conversa, texto ou proposta de ferramenta (D18).
 * - `artefato`: o que a ferramenta ou a adaptação gerou; na adaptação vem também a entrega pendente.
 * - `mensagem_do_tutor`: a resposta do Tutor ao aluno.
 * - `lote_de_correcao`: a entrega do lote, pendente, que o professor abre em `GET /v1/atividades-aplicadas/:id/correcao`.
 * - `resumo_do_analista`: o resumo gerado, que a coordenação lê em `GET /v1/analista/resumo`.
 */
export const resultadoDaExecucaoSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('mensagem'), mensagem: mensagemDoAgenteSchema }),
  z.strictObject({ tipo: z.literal('artefato'), artefatoId: z.uuid(), entregaId: z.uuid().nullable() }),
  z.strictObject({ tipo: z.literal('mensagem_do_tutor'), mensagem: mensagemDoTutorAoAlunoSchema }),
  z.strictObject({ tipo: z.literal('lote_de_correcao'), entregaId: z.uuid() }),
  z.strictObject({ tipo: z.literal('resumo_do_analista'), resumoId: z.uuid() }),
])
export type ResultadoDaExecucao = z.infer<typeof resultadoDaExecucaoSchema>

/**
 * Resposta de `GET /v1/execucoes/:id`, só para quem pediu a execução (a de outra pessoa, mesmo da mesma escola, responde
 * como inexistente). `resultado` só existe na `concluida`, e `erro`, só na `falhou`. `erro` é um `ErrorCode`: a tela
 * mostra a mensagem do catálogo (`MENSAGENS_DE_ERRO`), e o aluno nunca vê erro cru (regra 80, item 4). Nunca a entrada, o
 * prompt, o modelo nem o custo.
 */
export const execucaoResponseSchema = z
  .strictObject({
    id: z.uuid(),
    tarefa: z.enum(TAREFAS_DE_IA),
    estado: z.enum(ESTADOS_DE_EXECUCAO),
    resultado: resultadoDaExecucaoSchema.nullable(),
    erro: z.enum(ErrorCode).nullable(),
  })
  .refine((execucao) => (execucao.estado === 'concluida') === (execucao.resultado !== null), { path: ['resultado'], message: 'resultado só na execução concluída' })
  .refine((execucao) => (execucao.estado === 'falhou') === (execucao.erro !== null), { path: ['erro'], message: 'erro só na execução que falhou' })
export type ExecucaoResponse = z.infer<typeof execucaoResponseSchema>
