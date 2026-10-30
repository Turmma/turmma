import { z } from 'zod'
import { CHAVES_DE_RETENCAO } from './retencao.js'
import { ESTADOS_DO_PEDIDO, TIPOS_DE_PEDIDO_DO_TITULAR } from './titular.js'

/**
 * O arquivo do titular (F3, RF11, RF12 e RF17; Tech Spec do F3, seções 3, 4 e 5; regra 20, item 7). O pedido de acesso ou
 * de portabilidade gera, fora da requisição, um JSON no storage privado; o titular o baixa em "Meus dados", e a
 * coordenação baixa a versão da escola só quando ele não tem conta ativa. O JSON nunca é renderizado: sai como arquivo.
 */

/** Os tipos de pedido que geram arquivo (RF11): acesso e portabilidade. Os outros três não têm o que montar. */
export const TIPOS_DE_PEDIDO_COM_ARQUIVO = ['acesso', 'portabilidade'] as const satisfies readonly (typeof TIPOS_DE_PEDIDO_DO_TITULAR)[number][]

/**
 * As duas versões do arquivo: a `completa`, que só o titular baixa, e a `coordenacao`, que a escola baixa quando ele não
 * tem conta ativa nesta escola e que nunca traz a conversa do professor (regra 70, item 8).
 */
export const VERSOES_DO_ARQUIVO = ['completa', 'coordenacao'] as const
export type VersaoDoArquivo = (typeof VERSOES_DO_ARQUIVO)[number]

/** Quantos dias o arquivo fica disponível, contados de quando ficou pronto (PRD, RF12). */
export const VALIDADE_DO_ARQUIVO_DIAS = 7

/** Por quantos segundos a URL assinada de download vale (Tech Spec do F3, seção 4): 5 minutos. */
export const VALIDADE_DA_URL_DO_ARQUIVO_SEGUNDOS = 300

/** Depois de quantas horas "em preparação" o alerta dispara (Tech Spec do F3, seção 7c). */
export const HORAS_EM_PREPARACAO_PARA_ALERTAR = 2

/**
 * As finalidades da leitura do arquivo, que a auditoria guarda em `titular.arquivo_baixado` (regra 20, item 10): a
 * coordenação baixa a versão da escola para entregar ao titular ou ao responsável legal dele, e o titular, o próprio
 * arquivo. Lista fechada: finalidade nunca é texto livre.
 */
export const FINALIDADES_DO_ARQUIVO_DA_ESCOLA = ['entregar_ao_titular', 'entregar_ao_responsavel_legal'] as const
export const FINALIDADE_DO_ARQUIVO_DO_PROPRIO_TITULAR = 'acesso_do_proprio_titular'
export const FINALIDADES_DO_ARQUIVO = [...FINALIDADES_DO_ARQUIVO_DA_ESCOLA, FINALIDADE_DO_ARQUIVO_DO_PROPRIO_TITULAR] as const
export type FinalidadeDoArquivo = (typeof FINALIDADES_DO_ARQUIVO)[number]

/** `POST /v1/privacidade/pedidos/:id/arquivo`: para que a coordenação baixa a versão da escola. */
export const baixarArquivoDaEscolaSchema = z.strictObject({ finalidade: z.enum(FINALIDADES_DO_ARQUIVO_DA_ESCOLA) })
export type BaixarArquivoDaEscola = z.infer<typeof baixarArquivoDaEscolaSchema>

/**
 * A resposta de `POST pedidos/:id/arquivo` e de `POST meus-dados/:id/baixar`: a URL assinada de 5 minutos e o nome do
 * arquivo, `meus-dados-AAAA-MM-DD.json`. **Nunca a chave do objeto no storage** (`chave_objeto`).
 */
export const arquivoResponseSchema = z.strictObject({
  url: z.url(),
  nome: z.string().regex(/^meus-dados-\d{4}-\d{2}-\d{2}\.json$/),
  validaAte: z.iso.datetime(),
})
export type ArquivoResponse = z.infer<typeof arquivoResponseSchema>

/** O nome do arquivo que o navegador grava: o dia (de São Paulo) em que foi pedido. */
export function nomeDoArquivoDoTitular(dia: string): string {
  return `meus-dados-${dia}.json`
}

/**
 * Um pedido do próprio usuário em "Meus dados": o tipo, o estado, quando chegou à escola e, se o arquivo existe, até
 * quando ele fica. Nunca quem registrou o pedido nem a foto do compartilhamento.
 */
export const pedidoDeMeusDadosSchema = z.strictObject({
  id: z.uuid(),
  tipo: z.enum(TIPOS_DE_PEDIDO_DO_TITULAR),
  estado: z.enum(ESTADOS_DO_PEDIDO),
  chegouEm: z.iso.date(),
  /** `disponivel`: dá para baixar agora. `expirado`: já passou dos 7 dias, ou foi apagado. */
  arquivo: z
    .strictObject({
      situacao: z.enum(['disponivel', 'expirado']),
      expiraEm: z.iso.datetime(),
    })
    .nullable(),
})
export type PedidoDeMeusDados = z.infer<typeof pedidoDeMeusDadosSchema>

/**
 * `GET /v1/meus-dados`: os pedidos do próprio usuário na escola ativa, e a contagem do que a escola guarda dele por
 * categoria de retenção. A contagem é a do próprio usuário sobre si (D45): nunca sai para a coordenação, que só vê a
 * prévia, e a do professor não traz uso da IA.
 */
export const meusDadosResponseSchema = z.strictObject({
  pedidos: z.array(pedidoDeMeusDadosSchema),
  categorias: z.array(z.strictObject({ categoria: z.enum(CHAVES_DE_RETENCAO), quantidade: z.number().int().nonnegative() })),
})
export type MeusDadosResponse = z.infer<typeof meusDadosResponseSchema>
