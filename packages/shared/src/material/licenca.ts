import { z } from 'zod'
import { pageSchema, paginationQuerySchema } from '../estrutura/pagination.js'
import { TAMANHO_MAXIMO_DO_LICENCIANTE } from './material.js'

/**
 * A licença do material de terceiro, registrada uma vez pela coordenação (ingestao-do-material, 5.0; PRD, RF16 e RF17; Tech Spec, seções 3 e 4): quem licenciou
 * (`licenciante`, que pode ser nome de pessoa), o que a licença cobre, a referência do documento (sem anexar o contrato) e a vigência. Material de terceiro entra
 * apontando uma licença vigente, e a licença que vence tira da busca o material que ela cobre (7.0 e 9.0). A licença não se exclui: encerra-se alterando o fim.
 */

/** Os tetos das colunas `licenca_de_material` (os checks `licenca_de_material_*_preenchido` os repetem). O do licenciante é o do material de antes. */
export const TAMANHO_MAXIMO_DA_COBERTURA = 300
export const TAMANHO_MAXIMO_DA_REFERENCIA = 200

/** Quantos dias antes do fim a licença passa a `vence_em_30_dias`, e o sino a avisa (RF17). */
export const DIAS_DO_AVISO_DE_VENCIMENTO = 30

/**
 * Onde a licença está na linha do tempo, pelo dia de São Paulo (`diaDeUso`): `futura` ainda não começou, `vencida` terminou ontem ou antes,
 * `vence_em_30_dias` termina de hoje a 30 dias, `vigente` é o resto. O dia do fim ainda vale: o material sai da busca no dia seguinte (RF17).
 */
export const SITUACOES_DA_LICENCA = ['vigente', 'vence_em_30_dias', 'vencida', 'futura'] as const
export type SituacaoDaLicenca = (typeof SITUACOES_DA_LICENCA)[number]

/** `AAAA-MM-DD` mais `dias`, por aritmética de calendário, sem fuso. */
function maisDias(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`)
  data.setUTCDate(data.getUTCDate() + dias)
  return data.toISOString().slice(0, 10)
}

/**
 * A situação da licença no dia `hoje` (`AAAA-MM-DD`, o de São Paulo). As datas são do calendário e se comparam como texto: o formato
 * é o mesmo, e a ordem lexical é a cronológica. `vigenteAte` nulo é a licença sem fim, que nunca vence.
 */
export function situacaoDaLicenca(hoje: string, vigenteDesde: string, vigenteAte: string | null): SituacaoDaLicenca {
  if (vigenteDesde > hoje) return 'futura'
  if (vigenteAte === null) return 'vigente'
  if (vigenteAte < hoje) return 'vencida'
  return vigenteAte <= maisDias(hoje, DIAS_DO_AVISO_DE_VENCIMENTO) ? 'vence_em_30_dias' : 'vigente'
}

const dia = z.iso.date()
const licenciante = z.string().trim().min(1).max(TAMANHO_MAXIMO_DO_LICENCIANTE)
const cobertura = z.string().trim().min(1).max(TAMANHO_MAXIMO_DA_COBERTURA)
const referencia = z.string().trim().min(1).max(TAMANHO_MAXIMO_DA_REFERENCIA)

/** O fim antes do começo: o check `licenca_de_material_vigencia_valida` repete a regra, e a API a recusa antes, como `ENTRADA_INVALIDA`. */
export function vigenciaInvalida(vigenteDesde: string, vigenteAte: string | null | undefined): boolean {
  return vigenteAte !== null && vigenteAte !== undefined && vigenteAte < vigenteDesde
}

/** `POST /v1/licencas`. Estrito: nada de escola nem de autor, que vêm da sessão (regra 10, item 3). */
export const registrarLicencaRequestSchema = z
  .strictObject({
    licenciante,
    cobertura,
    referencia,
    vigenteDesde: dia,
    /** Ausente ou nulo: a licença não tem fim. */
    vigenteAte: dia.nullish(),
  })
  .refine((pedido) => !vigenciaInvalida(pedido.vigenteDesde, pedido.vigenteAte), { path: ['vigenteAte'], message: 'o fim da vigência não pode vir antes do começo' })
export type RegistrarLicencaRequest = z.infer<typeof registrarLicencaRequestSchema>

/**
 * `PATCH /v1/licencas/:id`: a vigência, a cobertura e a referência. O licenciante não muda (é quem licenciou: outro licenciante é outra licença). `vigenteAte: null`
 * tira o fim. Ao menos um campo. O fim contra o começo que já está gravado é conferido pelo serviço, com a linha travada.
 */
export const alterarLicencaRequestSchema = z
  .strictObject({ cobertura: cobertura.optional(), referencia: referencia.optional(), vigenteDesde: dia.optional(), vigenteAte: dia.nullable().optional() })
  .refine((pedido) => Object.values(pedido).some((valor) => valor !== undefined), { message: 'ao menos um campo' })
  .refine((pedido) => pedido.vigenteDesde === undefined || !vigenciaInvalida(pedido.vigenteDesde, pedido.vigenteAte), { path: ['vigenteAte'], message: 'o fim da vigência não pode vir antes do começo' })
export type AlterarLicencaRequest = z.infer<typeof alterarLicencaRequestSchema>

/** `GET /v1/licencas`: a página, em ordem de id. */
export const licencasQuerySchema = paginationQuerySchema
export type LicencasQuery = z.infer<typeof licencasQuerySchema>

/**
 * A licença como a coordenação a lê: com a situação do dia e quantos materiais **vivos** (não excluídos) ela cobre. Nunca quem a registrou nem alterou:
 * a autoria fica na auditoria (`licenca.registrada`, `licenca.alterada`).
 */
export const licencaSchema = z.strictObject({
  id: z.uuid(),
  licenciante: z.string().min(1),
  cobertura: z.string().min(1),
  referencia: z.string().min(1),
  vigenteDesde: dia,
  vigenteAte: dia.nullable(),
  situacao: z.enum(SITUACOES_DA_LICENCA),
  materiais: z.number().int().nonnegative(),
  registradaEm: z.iso.datetime(),
  alteradaEm: z.iso.datetime(),
})
export type Licenca = z.infer<typeof licencaSchema>

export const licencaResponseSchema = licencaSchema
export type LicencaResponse = Licenca

export const listaDeLicencasResponseSchema = pageSchema(licencaSchema)
export type ListaDeLicencasResponse = z.infer<typeof listaDeLicencasResponseSchema>
