import { z } from 'zod'
import { ESTADOS_DE_ENTREGA } from '../assistente/entrega.js'
import { paginationQuerySchema, pageSchema } from '../estrutura/pagination.js'

/**
 * A atividade aplicada (MVP, A3): o professor aplica uma atividade objetiva à turma, os alunos respondem, e o professor
 * encerra. **Aplicar é o ato humano registrado que leva a saída da IA ao aluno** (regra 70, item 3): fica com autor e
 * data na linha e na auditoria (`atividade.aplicada`). Nesta fatia não há `Nota` (D46): o que sai é diagnóstico formativo.
 */
export const ESTADOS_DE_ATIVIDADE_APLICADA = ['aberta', 'encerrada'] as const
export type EstadoDeAtividadeAplicada = (typeof ESTADOS_DE_ATIVIDADE_APLICADA)[number]

/** Como a tentativa foi enviada (prova online): pelo aluno, pelo limite dele, ou pelo encerramento da aplicação. */
export const ENVIOS_DA_TENTATIVA = ['aluno', 'limite', 'encerramento'] as const
export type EnvioDaTentativa = (typeof ENVIOS_DA_TENTATIVA)[number]

/** Os percentuais de tempo adicional que o professor escolhe (RF3). É adaptação, dado sensível (art. 11; D35): só o percentual, sem motivo. */
export const PERCENTUAIS_DE_TEMPO_ADICIONAL = [25, 50, 100] as const
export type PercentualDeTempoAdicional = (typeof PERCENTUAIS_DE_TEMPO_ADICIONAL)[number]
export const percentualDeTempoAdicionalSchema = z.union([z.literal(25), z.literal(50), z.literal(100)])

/** A duração da prova, em minutos (RF1), e a extensão que o professor dá durante ela (RF4). Os mesmos números dos checks do banco. */
export const DURACAO_MINIMA_DA_PROVA_MIN = 5
export const DURACAO_MAXIMA_DA_PROVA_MIN = 300
export const EXTENSAO_MINIMA_MIN = 1
export const EXTENSAO_MAXIMA_MIN = 120
/** Quantos alunos cabem numa lista de tempo adicional ou de convocados: mais que qualquer turma. */
export const MAXIMO_DE_ALUNOS_NA_LISTA_DA_PROVA = 200

/** A janela da prova: de quando abre a quando fecha, em instantes (UTC). `abreEm` antes de `fechaEm`, como o check do banco. */
export const janelaDaProvaSchema = z
  .strictObject({ abreEm: z.iso.datetime(), fechaEm: z.iso.datetime() })
  .refine((janela) => Date.parse(janela.abreEm) < Date.parse(janela.fechaEm))
export type JanelaDaProva = z.infer<typeof janelaDaProvaSchema>

export const duracaoDaProvaSchema = z.number().int().min(DURACAO_MINIMA_DA_PROVA_MIN).max(DURACAO_MAXIMA_DA_PROVA_MIN)

/** Um aluno com tempo adicional naquela prova. Nenhum campo de motivo: a chave a mais é `ENTRADA_INVALIDA` (RF3). */
export const tempoAdicionalDoAlunoSchema = z.strictObject({ alunoId: z.uuid(), percentual: percentualDeTempoAdicionalSchema })
export type TempoAdicionalDoAluno = z.infer<typeof tempoAdicionalDoAlunoSchema>
export const tempoAdicionalDosAlunosSchema = z
  .array(tempoAdicionalDoAlunoSchema)
  .max(MAXIMO_DE_ALUNOS_NA_LISTA_DA_PROVA)
  .refine((lista) => new Set(lista.map((item) => item.alunoId.toLowerCase())).size === lista.length)

/** O embaralhamento é só de apresentação: a tela recebe o número original (RF8). */
export const embaralharSchema = z.strictObject({ questoes: z.boolean(), alternativas: z.boolean() })
export type Embaralhar = z.infer<typeof embaralharSchema>
export const SEM_EMBARALHAR: Embaralhar = { questoes: false, alternativas: false }

/**
 * O tempo adicional cabe na janela? `fecha_em − abre_em` tem de ser ao menos `duração × (1 + o maior percentual)`: sem isso o aluno
 * com direito a +50% teria o limite cortado pelo fim da janela e nunca receberia o tempo que o professor marcou (Tech Spec, §5.1).
 * Sem tempo adicional, a conta não se faz: a prova pode ter duração maior que a janela, e quem começa tarde tem só o que sobra (RF1).
 * É a mesma função que a API usa ao aplicar, ao mudar a janela e na segunda chamada, e a tela usa para avisar antes de enviar.
 */
export function tempoAdicionalCabeNaJanela(janela: JanelaDaProva, duracaoMin: number, percentuais: readonly number[]): boolean {
  if (percentuais.length === 0) return true
  const maior = Math.max(...percentuais)
  const janelaEmMs = Date.parse(janela.fechaEm) - Date.parse(janela.abreEm)
  return janelaEmMs * 100 >= duracaoMin * 60_000 * (100 + maior)
}

/** O campo da prova que a conferência recusa. A API responde só `ENTRADA_INVALIDA`; o nome do campo serve à tela, que confere antes de enviar. */
export type CampoDaProva = 'janela' | 'duracaoMin' | 'embaralhar' | 'tempoAdicional'

interface ProvaParaConferir {
  readonly avaliativa: boolean
  readonly janela?: JanelaDaProva | undefined
  readonly duracaoMin?: number | undefined
  readonly embaralhar: Embaralhar
  readonly tempoAdicional: readonly TempoAdicionalDoAluno[]
}

/**
 * Os campos da prova que não fecham, juntos (a conferência única do aplicar, da mudança de janela e da segunda chamada):
 * - fora de avaliativa não existe janela, duração, embaralhamento nem tempo adicional (RF1; o banco recusa também);
 * - a avaliativa tem janela (RF1, a exigência entrou na 10.0): sem ela, `janela` é o campo recusado;
 * - duração sem janela não tem de onde contar, e tempo adicional sem duração não tem sobre o que somar;
 * - o tempo adicional tem de caber na janela (`tempoAdicionalCabeNaJanela`), e o erro é do campo da janela.
 */
export function camposInvalidosDaProva(prova: ProvaParaConferir): CampoDaProva[] {
  return prova.avaliativa ? camposInvalidosDaAvaliativa(prova) : camposDaProvaForaDeAvaliativa(prova)
}

/** O que a prova online carrega e a atividade que não é avaliativa não pode ter. */
function camposDaProvaForaDeAvaliativa(prova: ProvaParaConferir): CampoDaProva[] {
  const campos: CampoDaProva[] = []
  if (prova.janela !== undefined) campos.push('janela')
  if (prova.duracaoMin !== undefined) campos.push('duracaoMin')
  if (prova.embaralhar.questoes || prova.embaralhar.alternativas) campos.push('embaralhar')
  if (prova.tempoAdicional.length > 0) campos.push('tempoAdicional')
  return campos
}

function camposInvalidosDaAvaliativa(prova: ProvaParaConferir): CampoDaProva[] {
  const campos: CampoDaProva[] = []
  // A avaliativa que sai de uma escrita tem janela (RF1, 10.0 da avaliacao-e-correcao): no aplicar, na mudança de janela e na segunda
  // chamada. A de antes da F6, sem janela, segue **lida** como estava; mas, se receber um PATCH, a prova que resulta dele precisa trazer a janela.
  if (prova.janela === undefined) campos.push('janela')
  if (prova.duracaoMin !== undefined && prova.janela === undefined) campos.push('duracaoMin')
  if (prova.tempoAdicional.length > 0 && prova.duracaoMin === undefined) campos.push('tempoAdicional')
  if (prova.janela !== undefined && prova.duracaoMin !== undefined && !tempoAdicionalCabeNaJanela(prova.janela, prova.duracaoMin, prova.tempoAdicional.map((item) => item.percentual))) campos.push('janela')
  return campos
}

/**
 * Corpo de `POST /v1/atividades-aplicadas`: o artefato, a turma, se é avaliativa e, na prova, a janela, a duração, o embaralhamento e o
 * tempo adicional por aluno. Só atividade objetiva se aplica. A versão adaptada só se aplica com a entrega dela `aprovada`: sem isso,
 * `VERSAO_ADAPTADA_NAO_APROVADA`, e o banco recusa mesmo por fora da API. Com a avaliativa aberta, o Tutor da turma fica travado
 * (regra 30, item 10).
 *
 * **Estrito**: campo de motivo do tempo adicional, de escola, de ano ou de pessoa é `ENTRADA_INVALIDA`. **A avaliativa nova exige a janela**
 * (a atividade que não é avaliativa não a tem); `camposInvalidosDaProva` é a conferência de que os campos da prova fecham.
 *
 * A versão adaptada vai para a turma como qualquer atividade: **não existe vínculo entre aluno e adaptação** (D35). O tempo adicional é
 * por prova, escolhido pelo professor ao aplicar, e não vira o registro de adaptação do aluno.
 */
export const aplicarAtividadeRequestSchema = z
  .strictObject({
    artefatoId: z.uuid(),
    turmaId: z.uuid(),
    avaliativa: z.boolean(),
    janela: janelaDaProvaSchema.optional(),
    duracaoMin: duracaoDaProvaSchema.optional(),
    embaralhar: embaralharSchema.default(SEM_EMBARALHAR),
    tempoAdicional: tempoAdicionalDosAlunosSchema.default([]),
  })
  .superRefine((pedido, contexto) => {
    for (const campo of camposInvalidosDaProva(pedido)) contexto.addIssue({ code: 'custom', path: [campo], message: 'prova' })
  })
/** O que o cliente manda: `embaralhar` e `tempoAdicional` têm padrão, então a tela que não os conhece continua válida. */
export type AplicarAtividadeRequest = z.input<typeof aplicarAtividadeRequestSchema>
/** O que a API lê depois do contrato: com o padrão aplicado. */
export type AplicarAtividadeLido = z.output<typeof aplicarAtividadeRequestSchema>

/**
 * Corpo de `PATCH /v1/atividades-aplicadas/:id/janela`: **parcial**, qualquer um dos três, e ao menos um. O tempo adicional manda a lista
 * inteira (o que não está nela sai). Só antes do primeiro começo: com uma tentativa iniciada, `PROVA_JA_COMECOU` e nada muda. Depois do
 * começo o professor só estende (`POST …/extensoes`).
 */
export const mudarJanelaRequestSchema = z
  .strictObject({
    janela: janelaDaProvaSchema.optional(),
    duracaoMin: duracaoDaProvaSchema.optional(),
    tempoAdicional: tempoAdicionalDosAlunosSchema.optional(),
  })
  .refine((pedido) => pedido.janela !== undefined || pedido.duracaoMin !== undefined || pedido.tempoAdicional !== undefined)
export type MudarJanelaRequest = z.infer<typeof mudarJanelaRequestSchema>

/**
 * Corpo de `POST /v1/atividades-aplicadas/:id/segunda-chamada` (RF10): os alunos convocados, a janela nova, a duração e o tempo adicional.
 * As checagens do aplicar valem para a original (objetiva, versão adaptada aprovada); a original tem de estar encerrada, e o convocado
 * é da turma e não enviou.
 */
export const segundaChamadaRequestSchema = z
  .strictObject({
    alunoIds: z
      .array(z.uuid())
      .min(1)
      .max(MAXIMO_DE_ALUNOS_NA_LISTA_DA_PROVA)
      .refine((lista) => new Set(lista.map((id) => id.toLowerCase())).size === lista.length),
    janela: janelaDaProvaSchema,
    duracaoMin: duracaoDaProvaSchema.optional(),
    tempoAdicional: tempoAdicionalDosAlunosSchema.default([]),
  })
  .superRefine((pedido, contexto) => {
    const campos = camposInvalidosDaProva({ avaliativa: true, janela: pedido.janela, duracaoMin: pedido.duracaoMin, embaralhar: SEM_EMBARALHAR, tempoAdicional: pedido.tempoAdicional })
    for (const campo of campos) contexto.addIssue({ code: 'custom', path: [campo], message: 'prova' })
    const convocados = new Set(pedido.alunoIds.map((id) => id.toLowerCase()))
    if (pedido.tempoAdicional.some((item) => !convocados.has(item.alunoId.toLowerCase()))) contexto.addIssue({ code: 'custom', path: ['tempoAdicional'], message: 'prova' })
  })
export type SegundaChamadaRequest = z.infer<typeof segundaChamadaRequestSchema>

/**
 * Corpo de `POST /v1/atividades-aplicadas/:id/extensoes` (RF4): quantos minutos a mais, para um aluno (`alunoId`) ou, sem ele, para a
 * turma toda, e a `chave` gerada pela tela ao abrir o diálogo: dois cliques ou o reenvio gravam **uma** extensão só, e a chave é por aplicação.
 */
export const estenderTempoRequestSchema = z.strictObject({
  alunoId: z.uuid().optional(),
  minutos: z.number().int().min(EXTENSAO_MINIMA_MIN).max(EXTENSAO_MAXIMA_MIN),
  chave: z.uuid(),
})
export type EstenderTempoRequest = z.infer<typeof estenderTempoRequestSchema>

/**
 * Onde o aluno está na prova, para o professor acompanhar (`GET …/acompanhamento`): `nao_comecou`, `fazendo` (com o `limiteEm`), `enviou` e
 * `tempo_esgotado` (o limite passou sem envio; conta como enviada). **Sem a contagem de saídas da aba** (D70, D88): ela só aparece no lote.
 */
export const SITUACOES_NO_ACOMPANHAMENTO = ['nao_comecou', 'fazendo', 'enviou', 'tempo_esgotado'] as const
export type SituacaoNoAcompanhamento = (typeof SITUACOES_NO_ACOMPANHAMENTO)[number]
export const acompanhamentoDoAlunoSchema = z.strictObject({
  alunoId: z.uuid(),
  nome: z.string().min(1),
  situacao: z.enum(SITUACOES_NO_ACOMPANHAMENTO),
  limiteEm: z.iso.datetime().nullable(),
})
export const acompanhamentoResponseSchema = z.strictObject({
  atividadeAplicadaId: z.uuid(),
  /** O relógio do servidor, para a tela mostrar "termina às" sem confiar no do computador. */
  agora: z.iso.datetime(),
  alunos: z.array(acompanhamentoDoAlunoSchema).max(MAXIMO_DE_ALUNOS_NA_LISTA_DA_PROVA),
})
export type AcompanhamentoResponse = z.infer<typeof acompanhamentoResponseSchema>

/** Consulta de `GET /v1/atividades-aplicadas`: a turma (obrigatória, com vínculo confirmado do professor) e a página. */
export const atividadesAplicadasQuerySchema = paginationQuerySchema.extend({ turmaId: z.uuid() }).strict()
export type AtividadesAplicadasQuery = z.infer<typeof atividadesAplicadasQuerySchema>

/**
 * Uma atividade aplicada, como o professor da turma a vê: de que artefato veio, o estado, quantos alunos a turma tem,
 * quantos começaram e quantos enviaram (só contagem), e a entrega do lote de correção, quando já existe.
 */
export const atividadeAplicadaSchema = z.strictObject({
  id: z.uuid(),
  artefatoId: z.uuid(),
  turmaId: z.uuid(),
  titulo: z.string().min(1),
  avaliativa: z.boolean(),
  estado: z.enum(ESTADOS_DE_ATIVIDADE_APLICADA),
  questoes: z.number().int().min(1),
  aplicadaEm: z.iso.datetime(),
  encerradaEm: z.iso.datetime().nullable(),
  /**
   * A prova online (avaliacao-e-correcao): a janela e a duração, nulas na atividade sem relógio (e na avaliativa de antes da F6); o embaralhamento; de qual aplicação esta é a segunda chamada; e
   * **quantos** alunos têm tempo adicional, nunca quais: o percentual é adaptação, dado sensível, e só o limite de cada aluno o carrega. **Opcionais no contrato**, para o cliente e a
   * resposta de antes da F6 continuarem lendo-se; a API sempre os manda (`atividade.int.test.ts` e `prova-online.int.test.ts` conferem).
   */
  janela: janelaDaProvaSchema.nullable().optional(),
  duracaoMin: duracaoDaProvaSchema.nullable().optional(),
  embaralhar: embaralharSchema.optional(),
  segundaChamadaDe: z.uuid().nullable().optional(),
  comTempoAdicional: z.number().int().nonnegative().optional(),
  participacao: z.strictObject({
    alunos: z.number().int().nonnegative(),
    iniciaram: z.number().int().nonnegative(),
    enviaram: z.number().int().nonnegative(),
  }),
  entrega: z.strictObject({ id: z.uuid(), estado: z.enum(ESTADOS_DE_ENTREGA) }).nullable(),
})
export type AtividadeAplicada = z.infer<typeof atividadeAplicadaSchema>

/** Resposta de `POST /v1/atividades-aplicadas` (201). */
export const atividadeAplicadaResponseSchema = atividadeAplicadaSchema
export type AtividadeAplicadaResponse = AtividadeAplicada

export const listaDeAtividadesAplicadasResponseSchema = pageSchema(atividadeAplicadaSchema)
export type ListaDeAtividadesAplicadasResponse = z.infer<typeof listaDeAtividadesAplicadasResponseSchema>

/** Corpo de `POST /v1/atividades-aplicadas/:id/encerrar`, `POST /v1/atividades-aplicadas/:id/enviar` e dos outros `POST` sem dado: vazio e estrito. */
export const emptyBodyRequestSchema = z.strictObject({})
export type EmptyBodyRequest = z.infer<typeof emptyBodyRequestSchema>

/**
 * O mesmo corpo vazio e estrito, para a rota que aceita não receber corpo nenhum: o Express 5 deixa `req.body` indefinido
 * quando o cliente não manda corpo, e esse valia como `{}`. Qualquer campo continua sendo `ENTRADA_INVALIDA`.
 */
export const emptyOrMissingBodyRequestSchema = emptyBodyRequestSchema.default({})

/**
 * Resposta de `POST /v1/atividades-aplicadas/:id/encerrar`: a atividade, já `encerrada`, e a execução da correção, que
 * monta o lote e a entrega pendente. Encerrar de novo devolve o mesmo, sem segundo lote (o banco aceita um lote não
 * rejeitado por atividade aplicada). Com a função `correcao_de_objetiva` suspensa, a atividade encerra e `execucaoId`
 * vem nulo: a correção só roda quando a coordenação retomar a função e o professor encerrar de novo.
 */
export const atividadeEncerradaResponseSchema = z.strictObject({
  atividade: atividadeAplicadaSchema,
  execucaoId: z.uuid().nullable(),
})
export type AtividadeEncerradaResponse = z.infer<typeof atividadeEncerradaResponseSchema>
