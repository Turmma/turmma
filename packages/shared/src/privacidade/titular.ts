import { z } from 'zod'
import { CHAVES_DE_RETENCAO } from './retencao.js'

/**
 * O pedido do titular à escola (F3, RF10 a RF13b e RF16; Tech Spec do F3, seções 3, 4 e 7; regra 20, item 19). A
 * coordenação registra e conduz o pedido de acesso, portabilidade, compartilhamento, correção ou eliminação de um
 * aluno ou de um professor da escola, e cada passo fica na auditoria da escola.
 *
 * O pedido guarda **id, tipo, quem pediu, datas, estado, autor e a foto do compartilhamento** — nunca nome, matrícula
 * nem texto (`docs/lgpd.md`, "Pedido do titular"). O nome do titular só aparece nas respostas da coordenação, pelo
 * `usuario` que ainda existe, e some quando ele é eliminado ("Titular eliminado" na tela).
 */

/** Quem pode ser titular de um pedido atendido pela coordenação. O aluno que só está na lista de nomes não é titular: ele é atendido pela lista (A1). */
export const PAPEIS_DO_TITULAR = ['aluno', 'professor'] as const
export type PapelDoTitular = (typeof PAPEIS_DO_TITULAR)[number]

/** Os tipos de pedido, do PRD, seção 5 (RF10). */
export const TIPOS_DE_PEDIDO_DO_TITULAR = ['acesso', 'portabilidade', 'compartilhamento', 'correcao', 'eliminacao'] as const
export type TipoDePedidoDoTitular = (typeof TIPOS_DE_PEDIDO_DO_TITULAR)[number]

/** Quem pediu: o próprio titular ou o responsável legal dele. Lista fechada, sem nome de pessoa (PRD, RF10). */
export const SOLICITANTES_DO_PEDIDO = ['titular', 'responsavel_legal'] as const
export type SolicitanteDoPedido = (typeof SOLICITANTES_DO_PEDIDO)[number]

/**
 * Os estados do pedido (Tech Spec do F3, seção 3): `recebido` até a escola atender, `em_preparacao` e `pronto` quando
 * o arquivo existe (13.0), `agendado` na eliminação dos 7 dias (14.0), `concluido` e `cancelado` no fim.
 */
export const ESTADOS_DO_PEDIDO = ['recebido', 'em_preparacao', 'pronto', 'agendado', 'concluido', 'cancelado'] as const
export type EstadoDoPedido = (typeof ESTADOS_DO_PEDIDO)[number]

/**
 * Quantos dias a eliminação fica agendada, com o acesso suspenso, antes de acontecer de fato (F3, RF14; Tech Spec do F3,
 * seção 5): é o tempo em que a coordenação ainda cancela e o acesso volta. Conta do `now()` do banco, nunca do cliente.
 */
export const PRAZO_DA_ELIMINACAO_DIAS = 7

/**
 * Depois de quantas horas do enfileiramento o pedido `agendado` e vencido volta à fila (Tech Spec do F3, seção 5): o job
 * que a janela letiva interrompeu, ou que se perdeu, é retomado na noite seguinte; menos que isto, o job ainda pode estar
 * rodando. Vinte horas cabem entre duas noites seguidas do expurgo.
 */
export const HORAS_PARA_REENFILEIRAR_A_ELIMINACAO = 20

/**
 * Depois de quantas horas de `eliminar_em` o pedido ainda `agendado` dispara o alerta (Tech Spec do F3, seção 7c): uma
 * interrupção pela janela letiva é esperada e cabe nas 48 horas.
 */
export const HORAS_AGENDADO_PARA_ALERTAR = 48

/** Os estados de `concluir` e `corrigir_nome`: o pedido aberto, que a coordenação ainda atende. */
export const ESTADOS_ABERTOS_DO_PEDIDO = ['recebido', 'em_preparacao', 'pronto'] as const

/** O estado do titular na escola, como a busca o mostra: ativo, ou desativado (que ainda tem pedido e auditoria). */
export const ESTADOS_DO_TITULAR = ['ativo', 'desativado'] as const
export type EstadoDoTitular = (typeof ESTADOS_DO_TITULAR)[number]

/** A busca de titulares só parte de três letras: menos que isso varre a escola inteira por um pedaço de nome. */
export const MINIMO_DE_LETRAS_DO_TERMO = 3

/** O maior nome de titular que a correção aceita, o mesmo do `usuario` (check `usuario_nome_preenchido`). */
export const MAXIMO_DO_NOME_DO_TITULAR = 200

/** Quantos titulares a busca devolve, no máximo (Tech Spec do F3, seção 4). */
export const MAXIMO_DE_RESULTADOS_DA_BUSCA = 20

/**
 * O limite da busca de titulares: 30 por minuto **por usuário** (`rl:busca-titular`, Tech Spec do F3, seção 7c). É um
 * balde à parte do rate limit do F0, que continua valendo: a busca acha nome de pessoa e custa mais que uma leitura.
 * Recusa com `LIMITE_EXCEDIDO` (429), por usuário e nunca por IP (regra 80, item 1).
 */
export const LIMITE_DA_BUSCA_DE_TITULARES_POR_MINUTO = 30

/**
 * A finalidade fixa da leitura de titular e de pedido pela coordenação (`titular.buscado`, `titular.previa_lida`,
 * `pedidos.listados` e `pedido.lido`): atender o pedido do titular. É sempre ela, nunca texto livre (regra 20, item 10).
 */
export const FINALIDADE_DO_ATENDIMENTO_DO_TITULAR = 'atender_o_pedido_do_titular'

/**
 * De onde veio cada linha da foto do compartilhamento (Tech Spec do F3, seção 5): do rastro das chamadas externas que
 * levaram dado do titular, ou só do período em que a empresa atendia a escola (a reserva, quando o rastro expirou).
 */
export const ORIGENS_DO_COMPARTILHAMENTO = ['rastro', 'periodo'] as const
export type OrigemDoCompartilhamento = (typeof ORIGENS_DO_COMPARTILHAMENTO)[number]

/**
 * Uma empresa por onde passou dado do titular, com o período. Sem pessoa: a chave do suboperador e as datas.
 * É o que o `POST pedidos` calcula e grava no registro (tarefa 12.0), e o que o detalhe do pedido devolve.
 */
export const linhaDoCompartilhamentoSchema = z.strictObject({
  suboperadorId: z.uuid().nullable(),
  chave: z.string().min(1),
  primeiroEm: z.iso.datetime(),
  ultimoEm: z.iso.datetime(),
  origem: z.enum(ORIGENS_DO_COMPARTILHAMENTO),
})
export type CompartilhamentoRow = z.infer<typeof linhaDoCompartilhamentoSchema>

/** A foto do compartilhamento do pedido: as linhas, sem ordem garantida. */
export const compartilhamentoSchema = z.array(linhaDoCompartilhamentoSchema)
export type Compartilhamento = z.infer<typeof compartilhamentoSchema>

/**
 * `POST /v1/privacidade/titulares/busca`: o termo, de três letras a um nome inteiro. É aparado antes de conferir: o
 * termo de espaços não vale como busca (que viraria a lista da escola inteira), e o acima de 200 não é nome de
 * pessoa. O termo nunca vai a log nem à auditoria.
 */
export const buscaDeTitularesSchema = z.strictObject({ termo: z.string().trim().min(MINIMO_DE_LETRAS_DO_TERMO).max(MAXIMO_DO_NOME_DO_TITULAR) })
export type BuscaDeTitulares = z.infer<typeof buscaDeTitularesSchema>

/**
 * O titular como a busca o devolve: id, nome, papel, matrícula e turma do ano (aluno) ou disciplinas e turmas desta
 * escola (professor), e o estado. A busca só acha quem é `usuario` da escola: o aluno que só está na lista de nomes é
 * atendido pela lista da turma (A1), e a tela de Pedidos explica o caminho.
 */
export const titularAchadoSchema = z.strictObject({
  id: z.uuid(),
  nome: z.string().min(1),
  papel: z.enum(PAPEIS_DO_TITULAR),
  matricula: z.string().nullable(),
  turmas: z.array(z.strictObject({ id: z.uuid(), nome: z.string() })),
  disciplinas: z.array(z.strictObject({ id: z.uuid(), nome: z.string() })),
  estado: z.enum(ESTADOS_DO_TITULAR),
})
export type TitularAchado = z.infer<typeof titularAchadoSchema>

export const buscaDeTitularesResponseSchema = z.strictObject({ titulares: z.array(titularAchadoSchema).max(MAXIMO_DE_RESULTADOS_DA_BUSCA) })
export type BuscaDeTitularesResponse = z.infer<typeof buscaDeTitularesResponseSchema>

/**
 * A prévia do titular, antes de registrar o pedido (Tech Spec do F3, seção 4; D64):
 *
 * - **aluno:** a contagem por categoria de retenção do que a escola guarda dele, e o `homonimo`;
 * - **professor:** só as categorias de cadastro e vínculo (`pessoa_desativada` e `vinculo_encerrado`), **sem
 *   contagem** e sem período: as de uso da IA não aparecem, e a resposta é a mesma para quem usou e para quem não
 *   usou (D64; regra 70, itens 8 e 9). O compartilhamento nunca vem na prévia: só depois do pedido registrado.
 *
 * `homonimo` é a mesma regra da troca de nome da eliminação (etapa 2, tarefa 15.0): há outro aluno ativo com o mesmo
 * nome completo nesta escola, ou um nome livre igual na lista. Sem ele, a coordenação confirmaria uma troca que não
 * vai acontecer. Nunca identifica o outro aluno.
 */
export const previaDoTitularResponseSchema = z.discriminatedUnion('papel', [
  z.strictObject({
    id: z.uuid(),
    nome: z.string().min(1),
    papel: z.literal('aluno'),
    categorias: z.array(z.strictObject({ categoria: z.enum(CHAVES_DE_RETENCAO), quantidade: z.number().int().nonnegative() })),
    homonimo: z.boolean(),
  }),
  z.strictObject({
    id: z.uuid(),
    nome: z.string().min(1),
    papel: z.literal('professor'),
    categorias: z.array(z.enum(CHAVES_DE_RETENCAO)),
    homonimo: z.boolean(),
  }),
])
export type PreviaDoTitularResponse = z.infer<typeof previaDoTitularResponseSchema>

/** As categorias que a prévia do professor mostra: as de cadastro e de vínculo, e nada mais (D64). */
export const CATEGORIAS_DE_CADASTRO_E_VINCULO: readonly (typeof CHAVES_DE_RETENCAO)[number][] = ['pessoa_desativada', 'vinculo_encerrado']

/** `POST /v1/privacidade/pedidos`: o titular, o tipo, quem pediu, quando chegou à escola e a chave de envio. */
export const registroDePedidoSchema = z.strictObject({
  titularId: z.uuid(),
  tipo: z.enum(TIPOS_DE_PEDIDO_DO_TITULAR),
  solicitante: z.enum(SOLICITANTES_DO_PEDIDO),
  chegouEm: z.iso.date(),
  chaveEnvio: z.uuid(),
})
export type RegistroDePedido = z.infer<typeof registroDePedidoSchema>

/**
 * `POST /v1/privacidade/pedidos/:id/corrigir-nome`: o nome novo, de 1 a 200 caracteres depois de tirar o espaço das
 * pontas (o mesmo do check `usuario_nome_preenchido`). Fora daí, `ENTRADA_INVALIDA` — nunca o erro cru do banco. O nome
 * anterior não entra em lugar nenhum.
 */
export const correcaoDeNomeSchema = z.strictObject({ nome: z.string().trim().min(1).max(MAXIMO_DO_NOME_DO_TITULAR) })
export type CorrecaoDeNome = z.infer<typeof correcaoDeNomeSchema>

/**
 * O titular como o pedido o mostra: nome e turmas enquanto ele existe, e `null` quando foi eliminado (a tela mostra
 * "Titular eliminado"). Nunca o nome de quem registrou nem a matrícula.
 */
export const titularDoPedidoSchema = z.strictObject({
  nome: z.string().min(1),
  turmas: z.array(z.string()),
})
export type TitularDoPedido = z.infer<typeof titularDoPedidoSchema>

/** O pedido como a lista o devolve: nome e turma do titular enquanto ele existe, e `null` quando foi eliminado. */
export const itemDoPedidoSchema = z.strictObject({
  id: z.uuid(),
  tipo: z.enum(TIPOS_DE_PEDIDO_DO_TITULAR),
  solicitante: z.enum(SOLICITANTES_DO_PEDIDO),
  chegouEm: z.iso.date(),
  estado: z.enum(ESTADOS_DO_PEDIDO),
  titular: titularDoPedidoSchema.nullable(),
})
export type ItemDoPedido = z.infer<typeof itemDoPedidoSchema>

/**
 * O detalhe do pedido: a lista, mais a foto do compartilhamento salva no registro, o `nomeTrocado` e o `homonimo`
 * (Tech Spec do F3, seção 4). `nomeTrocado` e `homonimo` são nulos enquanto a eliminação não os marcou; o nome
 * anterior a uma correção nunca volta em nenhuma resposta.
 */
export const pedidoDoTitularSchema = itemDoPedidoSchema.extend({
  homonimo: z.boolean().nullable(),
  nomeTrocado: z.boolean().nullable(),
  compartilhamento: compartilhamentoSchema,
  concluidoEm: z.iso.datetime().nullable(),
})
export type PedidoDoTitular = z.infer<typeof pedidoDoTitularSchema>

/** `GET /v1/privacidade/pedidos`: a página de pedidos da escola. */
export const pedidosResponseSchema = z.strictObject({ itens: z.array(itemDoPedidoSchema), proxima: z.uuid().optional() })
export type PedidosResponse = z.infer<typeof pedidosResponseSchema>
