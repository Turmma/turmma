import { z } from 'zod'
import { CATEGORIAS_DE_DADO_DO_SUBOPERADOR, CHAVES_DE_CATEGORIA_DO_SUBOPERADOR } from './suboperador.js'

/**
 * O incidente de segurança que afetou escolas (F3, RF8 e RF9; Tech Spec do F3, seções 3, 4 e 5; `docs/lgpd.md`, seção 8;
 * Resolução CD/ANPD 15/2024, art. 10). A operação o registra por comando (`ops:incidente registrar`), com uma seção por
 * escola afetada; a coordenação de cada escola lê **só a seção dela** e confirma que recebeu o aviso.
 *
 * O registro não guarda dado de titular: guarda quando a Turmma soube, o que aconteceu, que categorias de dado foram
 * alcançadas, quantos titulares se estima, o risco, a contenção e a correção, cada um por escola. Quem notifica a ANPD e os
 * titulares é a escola, como controladora (D10); o nosso prazo de avisá-la é de 24 h da detecção.
 */

/** O risco do incidente para o titular, na escala do formulário da ANPD. */
export const RISCOS_DO_INCIDENTE = ['baixo', 'relevante', 'alto'] as const
export type RiscoDoIncidente = (typeof RISCOS_DO_INCIDENTE)[number]

/** O tamanho de cada texto da seção da escola: circunstâncias, contenção e correção. O banco repete no check. */
export const MAXIMO_DO_TEXTO_DO_INCIDENTE = 1000

/** O teto de titulares estimados de uma seção. É uma estimativa, e o teto só tira o absurdo de um zero a mais. */
export const MAXIMO_DE_TITULARES_ESTIMADOS = 100_000_000

/** Quantas escolas um incidente pode listar de uma vez. */
export const MAXIMO_DE_ESCOLAS_DO_INCIDENTE = 200

/**
 * Em quantas horas da detecção a escola precisa ter confirmado o recebimento. É o prazo nosso (`docs/lgpd.md`, seção 8): o
 * alerta "Incidente sem confirmação em 24 h" dispara quando a idade do incidente mais antigo ainda sem confirmação passa disto.
 */
export const HORAS_PARA_A_ESCOLA_CONFIRMAR = 24

/** A finalidade fixa na auditoria do registro e da confirmação: a escola poder comunicar a ANPD e os titulares no prazo dela. */
export const FINALIDADE_DO_REGISTRO_DE_INCIDENTE = 'comunicar_o_incidente'

/**
 * O prazo da escola, como a coordenação o lê ao lado de cada incidente. É texto fixo da Turmma, que não decide por ela: o
 * prazo legal é da escola, como controladora (D10), e a ANPD pode regulamentá-lo.
 */
export const TEXTO_DO_PRAZO_LEGAL_DO_INCIDENTE =
  'A escola, como controladora dos dados, comunica a ANPD e os titulares afetados em até 3 dias úteis do conhecimento do incidente (Resolução CD/ANPD nº 15/2024, art. 6º).'

/** As categorias de dado do incidente: as mesmas do mapa de dados, que o suboperador também usa. */
export const CATEGORIAS_DE_DADO_DO_INCIDENTE = CATEGORIAS_DE_DADO_DO_SUBOPERADOR
export const CHAVES_DE_CATEGORIA_DO_INCIDENTE = CHAVES_DE_CATEGORIA_DO_SUBOPERADOR
export type CategoriaDeDadoDoIncidente = (typeof CHAVES_DE_CATEGORIA_DO_INCIDENTE)[number]

/**
 * O incidente como a escola o lê: só a seção dela. O `id` é o da ligação com a escola, e não o do incidente, que duas escolas
 * dividiriam e que revelaria a uma que a outra foi afetada. Sem quem registrou, sem as outras escolas e sem os números delas.
 */
export const incidenteDaEscolaSchema = z.strictObject({
  id: z.uuid(),
  conhecidoEm: z.iso.datetime(),
  circunstancias: z.string().min(1).max(MAXIMO_DO_TEXTO_DO_INCIDENTE),
  categorias: z.array(z.enum(CHAVES_DE_CATEGORIA_DO_INCIDENTE)).min(1),
  titularesEstimados: z.number().int().min(0).max(MAXIMO_DE_TITULARES_ESTIMADOS),
  risco: z.enum(RISCOS_DO_INCIDENTE),
  contencao: z.string().min(1).max(MAXIMO_DO_TEXTO_DO_INCIDENTE),
  correcao: z.string().min(1).max(MAXIMO_DO_TEXTO_DO_INCIDENTE),
  avisadoEm: z.iso.datetime(),
  confirmadoEm: z.iso.datetime().nullable(),
})
export type IncidenteDaEscola = z.infer<typeof incidenteDaEscolaSchema>

/** A resposta de `GET /v1/privacidade/incidentes`: os da escola, os sem confirmação primeiro, e o texto fixo do prazo legal dela. */
export const incidentesResponseSchema = z.strictObject({
  incidentes: z.array(incidenteDaEscolaSchema),
  prazoLegal: z.string().min(1),
})
export type IncidentesResponse = z.infer<typeof incidentesResponseSchema>
