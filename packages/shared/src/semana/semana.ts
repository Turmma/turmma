import { z } from 'zod'
import { TIPOS_DE_EVENTO_DO_CALENDARIO } from '../importacao/contratos.js'

/**
 * O contrato das duas rotas da Semana do professor (F2b; Tech Spec da semana-do-professor, seção 4): `GET /v1/semana` e `PUT /v1/aulas`.
 * Todo corpo e toda consulta são estritos: a escola, o ano e a professora vêm da sessão, nunca do pedido (regra 10, item 3).
 */

/** O texto que a professora escreve numa aula: até 500 caracteres depois de aparado. O check `aula_conteudo_preenchido` do banco repete o número. */
export const TAMANHO_MAXIMO_DO_TEXTO_DA_AULA = 500

/** O horário de uma aula, `HH:MM`. */
const horario = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

/** `AAAA-MM-DD` que cai numa segunda-feira (aritmética de calendário, sem fuso). */
export function ehSegundaFeira(dia: string): boolean {
  return new Date(`${dia}T00:00:00Z`).getUTCDay() === 1
}

/** Consulta de `GET /v1/semana`: a segunda-feira da semana pedida. Outro dia da semana é `ENTRADA_INVALIDA`. */
export const semanaQuerySchema = z.strictObject({
  segunda: z.iso.date().refine(ehSegundaFeira, { message: 'segunda deve ser uma segunda-feira' }),
})
export type SemanaQuery = z.infer<typeof semanaQuerySchema>

/** Uma aula da professora num dia: a alocação do vínculo dela, ou o registro passado que saiu da grade (`foraDaGrade`). Sem nome de professor nem de aluno. */
export const aulaDaSemanaSchema = z.strictObject({
  vinculoId: z.uuid(),
  turmaId: z.uuid(),
  turma: z.string(),
  disciplinaId: z.uuid(),
  disciplina: z.string(),
  inicio: horario,
  fim: horario,
  sala: z.string().nullable(),
  texto: z.string().nullable(),
  foraDaGrade: z.boolean(),
})
export type AulaDaSemana = z.infer<typeof aulaDaSemanaSchema>

/** O evento do calendário que cai no dia: o tipo e a descrição, nada mais. */
export const eventoDoDiaSchema = z.strictObject({
  tipo: z.enum(TIPOS_DE_EVENTO_DO_CALENDARIO),
  descricao: z.string(),
})
export type EventoDoDia = z.infer<typeof eventoDoDiaSchema>

/** O que aconteceu no dia na turma e disciplina da professora (RF7). Sem nota, acerto, nome de aluno nem autor. */
export const TIPOS_DE_ITEM_DO_DIA = ['aplicada', 'encerrada', 'correcao'] as const
export type TipoDeItemDoDia = (typeof TIPOS_DE_ITEM_DO_DIA)[number]

/** O estado de hoje da correção que o Assistente concluiu: o da entrega (`pendente` é "para revisar"). */
export const ESTADOS_DE_ITEM_DO_DIA = ['pendente', 'aprovada', 'rejeitada'] as const
export type EstadoDeItemDoDia = (typeof ESTADOS_DE_ITEM_DO_DIA)[number]

export const itemDoDiaSchema = z.strictObject({
  tipo: z.enum(TIPOS_DE_ITEM_DO_DIA),
  turmaId: z.uuid(),
  disciplinaId: z.uuid(),
  atividadeAplicadaId: z.uuid(),
  titulo: z.string(),
  estado: z.enum(ESTADOS_DE_ITEM_DO_DIA).optional(),
})
export type ItemDoDia = z.infer<typeof itemDoDiaSchema>

export const diaDaSemanaSchema = z.strictObject({
  data: z.iso.date(),
  eventos: z.array(eventoDoDiaSchema),
  aulas: z.array(aulaDaSemanaSchema),
  itens: z.array(itemDoDiaSchema),
})
export type DiaDaSemana = z.infer<typeof diaDaSemanaSchema>

/**
 * Resposta de `GET /v1/semana`. Sem ano em curso, `ano` é `null` e não há dia. `hoje` e `agora` são os do fuso da escola (S13); `dias` só traz
 * os dias do ano em curso.
 */
export const semanaResponseSchema = z.strictObject({
  ano: z.strictObject({ inicio: z.iso.date(), fim: z.iso.date() }).nullable(),
  hoje: z.iso.date(),
  agora: horario,
  gradeImportada: z.boolean(),
  calendarioImportado: z.boolean(),
  dias: z.array(diaDaSemanaSchema),
})
export type SemanaResponse = z.infer<typeof semanaResponseSchema>

/** Corpo de `PUT /v1/aulas` (4.0): o texto aparado, de 0 a 500; vazio apaga o registro. */
export const gravarAulaRequestSchema = z.strictObject({
  vinculoId: z.uuid(),
  data: z.iso.date(),
  inicio: horario,
  texto: z.string().trim().max(TAMANHO_MAXIMO_DO_TEXTO_DA_AULA),
})
export type GravarAulaRequest = z.infer<typeof gravarAulaRequestSchema>

export const gravarAulaResponseSchema = z.strictObject({
  vinculoId: z.uuid(),
  data: z.iso.date(),
  inicio: horario,
  texto: z.string().nullable(),
})
export type GravarAulaResponse = z.infer<typeof gravarAulaResponseSchema>

/** Os rótulos em português dos tipos de item e dos estados da correção, numa tabela só (S15): a tela nunca os escreve de novo. */
export const ROTULOS_DA_SEMANA = {
  item: {
    aplicada: 'Atividade aplicada',
    encerrada: 'Atividade encerrada',
    correcao: 'Correção do Assistente',
  },
  estado: {
    pendente: 'Para revisar',
    aprovada: 'Aprovada',
    rejeitada: 'Rejeitada',
  },
} as const satisfies { item: Record<TipoDeItemDoDia, string>; estado: Record<EstadoDeItemDoDia, string> }

/** O rótulo do item do dia: o tipo e, na correção, o estado de hoje. */
export function rotuloDoItem(item: Pick<ItemDoDia, 'tipo' | 'estado'>): string {
  const tipo = ROTULOS_DA_SEMANA.item[item.tipo]
  return item.estado === undefined ? tipo : `${tipo} · ${ROTULOS_DA_SEMANA.estado[item.estado]}`
}
