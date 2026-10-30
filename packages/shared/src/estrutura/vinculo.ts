import { z } from 'zod'
import { paginationQuerySchema, pageSchema } from './pagination.js'

/**
 * O vínculo de uma pessoa a uma turma, e a uma disciplina quando é de professor, no ano letivo em curso (glossário,
 * "Vínculo"; regra 60, item 8a). A escola cria, e só o vínculo `confirmado` dá acesso à turma e aos alunos dela (RF3 a
 * RF5).
 */
export const ESTADOS_DE_VINCULO = ['pendente', 'confirmado', 'contestado', 'encerrado'] as const
export type EstadoDeVinculo = (typeof ESTADOS_DE_VINCULO)[number]

/** Os estados de que o professor ainda decide: confirmar ou contestar vale só a partir deles. */
export const ESTADOS_EM_DECISAO = ['pendente', 'contestado'] as const satisfies readonly EstadoDeVinculo[]

/** Os papéis de um vínculo. O de aluno vem do seed no F1, e da lista ou da reivindicação no F2. */
export const PAPEIS_DE_VINCULO = ['professor', 'aluno'] as const
export type PapelDeVinculo = (typeof PAPEIS_DE_VINCULO)[number]

/**
 * Os papéis que a coordenação cria por `POST /v1/vinculos` no F1: só professor. O vínculo de aluno nasceria pendente
 * sem ninguém que o confirme (o aluno não confirma vínculo), e a entrada do aluno é outro fluxo (F2).
 */
export const PAPEIS_DE_VINCULO_PELA_COORDENACAO = ['professor'] as const satisfies readonly PapelDeVinculo[]

/** Por que o professor contesta: código fixo, e o `complemento` curto é opcional. */
export const CONTESTACOES_DE_VINCULO = ['nao_leciono', 'turma_errada', 'disciplina_errada', 'outro'] as const
export type ContestacaoDeVinculo = (typeof CONTESTACOES_DE_VINCULO)[number]

/** Por que o vínculo acabou. `fim_do_ano` é só da virada do ano letivo (10.0). */
export const MOTIVOS_DE_ENCERRAMENTO_DE_VINCULO = ['fim_do_ano', 'desligamento', 'realocacao'] as const
export type MotivoDeEncerramentoDeVinculo = (typeof MOTIVOS_DE_ENCERRAMENTO_DE_VINCULO)[number]

/** Os motivos que a coordenação usa em `POST /v1/vinculos/:id/encerrar`. */
export const MOTIVOS_DE_ENCERRAMENTO_PELA_COORDENACAO = ['desligamento', 'realocacao'] as const satisfies readonly MotivoDeEncerramentoDeVinculo[]

/**
 * O texto livre da contestação: até 140 caracteres, só para a coordenação, nunca em log nem em auditoria, e apagado na
 * virada do ano (`docs/lgpd.md`). A tela avisa "não escreva nome de aluno".
 */
export const TAMANHO_MAXIMO_DO_COMPLEMENTO = 140

/**
 * O estado do vínculo em português, para a tela dizer em texto o que hoje só a cor diria (regra 50, item 11): o
 * professor daltônico e o leitor de tela precisam da mesma informação que a cor dá.
 */
export const NOME_DO_ESTADO_DE_VINCULO: Readonly<Record<EstadoDeVinculo, string>> = {
  pendente: 'Aguardando a sua confirmação',
  confirmado: 'Confirmado por você',
  contestado: 'Contestado por você',
  encerrado: 'Encerrado pela escola',
}

/** Por que o professor contesta, em português, na ordem em que a tela oferece as opções. */
export const NOME_DA_CONTESTACAO: Readonly<Record<ContestacaoDeVinculo, string>> = {
  nao_leciono: 'Não dou aula nesta turma',
  turma_errada: 'A turma está errada',
  disciplina_errada: 'A disciplina está errada',
  outro: 'Outro motivo',
}

/**
 * O aviso que a tela mostra ao lado do complemento da contestação (Tech Spec, seção 5, "Vínculo"; regra 20): o texto
 * livre é lido pela coordenação e guardado até a virada do ano, e nome de aluno ali é dado pessoal de menor sem
 * finalidade nenhuma.
 */
export const AVISO_DO_COMPLEMENTO = 'Não escreva nome de aluno aqui.'

/**
 * O que acontece ao contestar, mostrado antes de enviar (regra 50, item 8): é ação oficial, a coordenação vê, e o
 * vínculo contestado não dá acesso à turma até ser corrigido (RF5).
 */
export const EFEITO_DA_CONTESTACAO =
  'A coordenação vê a sua contestação e corrige a alocação. Até lá, este vínculo não dá acesso à turma nem aos alunos dela.'

/** Corpo de `POST /v1/vinculos`. Estrito: nada de escola, de ano letivo nem de estado, que vêm da sessão e nascem `pendente`. */
export const criarVinculoRequestSchema = z
  .object({
    usuarioId: z.uuid(),
    turmaId: z.uuid(),
    disciplinaId: z.uuid().optional(),
    papel: z.enum(PAPEIS_DE_VINCULO_PELA_COORDENACAO),
  })
  .strict()

export type CriarVinculoRequest = z.infer<typeof criarVinculoRequestSchema>

/** Consulta de `GET /v1/vinculos`: a página e, opcional, o estado (a coordenação procura os `contestado`). */
export const vinculosQuerySchema = paginationQuerySchema.extend({ estado: z.enum(ESTADOS_DE_VINCULO).optional() }).strict()
export type VinculosQuery = z.infer<typeof vinculosQuerySchema>

/** Corpo de `POST /v1/vinculos/:id/encerrar`. */
export const encerrarVinculoRequestSchema = z.object({ motivo: z.enum(MOTIVOS_DE_ENCERRAMENTO_PELA_COORDENACAO) }).strict()
export type EncerrarVinculoRequest = z.infer<typeof encerrarVinculoRequestSchema>

/** Corpo de `POST /v1/vinculos/:id/contestar`: o código e, se quiser, um complemento curto. */
export const contestarVinculoRequestSchema = z
  .object({
    contestacao: z.enum(CONTESTACOES_DE_VINCULO),
    complemento: z.string().trim().min(1).max(TAMANHO_MAXIMO_DO_COMPLEMENTO).optional(),
  })
  .strict()

export type ContestarVinculoRequest = z.infer<typeof contestarVinculoRequestSchema>

const referenciaSchema = z.object({ id: z.uuid(), nome: z.string() }).strict()

/**
 * O vínculo como o professor dono o vê (`meus-vinculos`, `confirmar`, `contestar`): a turma, a disciplina, o estado, o
 * código da contestação e quando ele decidiu. Nunca o `complemento`, que é só da coordenação.
 */
export const vinculoSchema = z
  .object({
    id: z.uuid(),
    turma: referenciaSchema,
    disciplina: referenciaSchema.optional(),
    estado: z.enum(ESTADOS_DE_VINCULO),
    contestacao: z.enum(CONTESTACOES_DE_VINCULO).optional(),
    decididoEm: z.iso.datetime().optional(),
  })
  .strict()

export type Vinculo = z.infer<typeof vinculoSchema>

/**
 * O vínculo como a coordenação o vê (`GET /v1/vinculos`, criar, encerrar): o do professor, mais o id de quem é (sem
 * nome: a coordenação já tem a equipe), o papel, o `complemento` da contestação e o motivo do encerramento.
 */
export const vinculoDaCoordenacaoSchema = vinculoSchema
  .extend({
    usuarioId: z.uuid(),
    papel: z.enum(PAPEIS_DE_VINCULO),
    complemento: z.string().optional(),
    motivoEncerramento: z.enum(MOTIVOS_DE_ENCERRAMENTO_DE_VINCULO).optional(),
  })
  .strict()

export type VinculoDaCoordenacao = z.infer<typeof vinculoDaCoordenacaoSchema>

/** Resposta de `POST /v1/vinculos/:id/confirmar` e `/contestar`. */
export const vinculoResponseSchema = vinculoSchema
export type VinculoResponse = Vinculo

/** Resposta de `POST /v1/vinculos` e `/:id/encerrar`. */
export const vinculoDaCoordenacaoResponseSchema = vinculoDaCoordenacaoSchema
export type VinculoDaCoordenacaoResponse = VinculoDaCoordenacao

/** Resposta de `GET /v1/vinculos`. */
export const listaDeVinculosResponseSchema = pageSchema(vinculoDaCoordenacaoSchema)
export type ListaDeVinculosResponse = z.infer<typeof listaDeVinculosResponseSchema>

/** Resposta de `GET /v1/meus-vinculos`. */
export const meusVinculosResponseSchema = pageSchema(vinculoSchema)
export type MeusVinculosResponse = z.infer<typeof meusVinculosResponseSchema>
