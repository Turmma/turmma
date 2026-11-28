import {
  ErrorCode,
  atividadeEnviadaResponseSchema,
  meuDiagnosticoResponseSchema,
  minhasAtividadesResponseSchema,
  provaAntesDeComecarResponseSchema,
  provaEmAndamentoResponseSchema,
  provaOnlineResponseSchema,
  provaResponseSchema,
  questaoDaProvaSchema,
  respostaSalvaSchema,
  tempoDaProvaSchema,
  tempoResponseSchema,
  type ProvaEmAndamentoResponse,
  type ProvaOnlineResponse,
  type ProvaResponse,
  questaoSalvaResponseSchema,
  type AtividadeEnviadaResponse,
  type QuestaoSalvaResponse,
  type TempoDaProva,
} from '@educa/shared'
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { ApiError, EMPTY_BODY, type ResponseSchema } from './client'
import { shouldRetry } from './query-client'
import { PROVA_QUERY_KEY, MINHAS_ATIVIDADES_QUERY_KEY, MEU_DIAGNOSTICO_QUERY_KEY } from './chaves-do-aluno'
import { authedGet, authedRequest } from './sessao'

/**
 * O lado do aluno na atividade (MVP, A3; `docs/mvp-contratos.md`, "Atividade e correção"). A escola, o ano, a turma e o
 * aluno vêm do token: nenhuma chamada daqui tem como pedir a atividade, a resposta ou o diagnóstico de outra pessoa, e
 * nenhuma resposta traz colega (regra 50, item 9). Tudo fica só no cache de consultas, que toda troca de sessão esvazia
 * (`main.tsx`): nada de resposta nem de resultado em `localStorage`.
 */

const CAMINHO_DAS_ATIVIDADES = '/v1/minhas-atividades'

function caminhoDaAtividade(atividadeAplicadaId: string): string {
  return `/v1/atividades-aplicadas/${encodeURIComponent(atividadeAplicadaId)}`
}

/** `GET /v1/minhas-atividades`: o que foi atribuído à turma do aluno, paginado como a API entrega (`?pagina=`). */
export const minhasAtividadesInfiniteQueryOptions = infiniteQueryOptions({
  queryKey: MINHAS_ATIVIDADES_QUERY_KEY,
  queryFn: ({ pageParam, signal }) =>
    authedGet(pageParam === undefined ? CAMINHO_DAS_ATIVIDADES : `${CAMINHO_DAS_ATIVIDADES}?pagina=${encodeURIComponent(pageParam)}`, minhasAtividadesResponseSchema, signal),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (ultima) => ultima.proxima,
})

/**
 * **A web tolera o campo a mais da prova** (recomendação do `infra-guardian` na 4.0). Os contratos da prova são estritos, e a API continua a recusar o que não é deles; mas a aba aberta com este pacote, quando a API
 * ganhar um campo na prova, não pode quebrar a prova do aluno no meio da manhã. Antes de conferir, a leitura descarta o que o contrato não conhece, na raiz, no tempo, nas questões e nas respostas: o que o contrato
 * conhece continua conferido por inteiro (tipo errado e campo que falta ainda são `RespostaForaDoContrato`).
 *
 * **Isto não é a guarda de privacidade** (regra 20, item 4): descartar o campo a mais só tira dado da leitura da web, e um campo pessoal que a API passasse a mandar continuaria na resposta dela. Quem barra isso é o
 * contrato estrito da API (`apps/api/test/contracts.test.ts`), não o cliente.
 */
function soOsCamposDe(forma: Readonly<Record<string, unknown>>, valor: unknown): unknown {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return valor
  return Object.fromEntries(Object.entries(valor).filter(([chave]) => chave in forma))
}

function aMesmaProvaSemOCampoAMais(dado: unknown): unknown {
  const raiz = soOsCamposDe({ ...provaAntesDeComecarResponseSchema.shape, ...provaEmAndamentoResponseSchema.shape }, dado)
  if (typeof raiz !== 'object' || raiz === null) return raiz
  const { questoes, respostas, tempo, ...resto } = raiz as Record<string, unknown>
  return {
    ...resto,
    ...(questoes === undefined ? {} : { questoes: Array.isArray(questoes) ? questoes.map((questao) => soOsCamposDe(questaoDaProvaSchema.shape, questao)) : questoes }),
    ...(respostas === undefined ? {} : { respostas: Array.isArray(respostas) ? respostas.map((resposta) => soOsCamposDe(respostaSalvaSchema.shape, resposta)) : respostas }),
    ...(tempo === undefined ? {} : { tempo: soOsCamposDe(tempoDaProvaSchema.shape, tempo) }),
  }
}

const tempoTolerante: ResponseSchema<TempoDaProva> = { safeParse: (dado) => tempoResponseSchema.safeParse(soOsCamposDe(tempoDaProvaSchema.shape, dado)) }

const provaOnlineTolerante: ResponseSchema<ProvaOnlineResponse> = { safeParse: (dado) => provaOnlineResponseSchema.safeParse(aMesmaProvaSemOCampoAMais(dado)) }

/**
 * `POST /v1/atividades-aplicadas/:id/comecar`: começa a prova, ou devolve a que já começou (avaliacao-e-correcao, 3.0). É o que cria a tentativa; **a tela de hoje o chama
 * antes de ler a prova**, e a janela e o limite que a 3.0 passou a conferir chegam como erro tipado (`PROVA_FORA_DA_JANELA`, `ATIVIDADE_ENCERRADA`), que a tela mostra como qualquer outro.
 */
export function comecarProva(atividadeAplicadaId: string): Promise<ProvaOnlineResponse> {
  return authedRequest(`${caminhoDaAtividade(atividadeAplicadaId)}/comecar`, provaOnlineTolerante, { metodo: 'POST', corpo: {} })
}

/** A prova sem o `comecou` e o `tempo`: o que a tela de hoje e a fila de respostas guardam no cache. O contrato da prova é estrito, e a leitura é conferida de novo. */
export function provaSemOTempo(lida: ProvaEmAndamentoResponse): ProvaResponse {
  const { comecou: _comecou, tempo: _tempo, ...prova } = lida
  return provaResponseSchema.parse(prova)
}

/**
 * A prova que a leitura disse **não ter começado**, numa tela que só mostra prova em andamento. **A tela de foco nunca começa a prova**: quem começa é o "Começar" de "Antes de
 * começar", depois do aviso (D70). O endereço da prova digitado sem ter começado leva de volta à atividade.
 */
export class ProvaNaoComecou extends Error {
  constructor() {
    super('a prova ainda não começou')
    this.name = 'ProvaNaoComecou'
  }
}

/**
 * `GET /v1/atividades-aplicadas/:id/prova`, **sem começar**: o que a porta de entrada da atividade lê para decidir a tela (Tech Spec §4: ler a prova não grava). Não guarda nada: cada abertura lê
 * de novo, e o "ainda não começou" de ontem nunca aparece no lugar do "em andamento" de hoje.
 */
export function provaLidaQueryOptions(atividadeAplicadaId: string) {
  return queryOptions({
    queryKey: [...PROVA_QUERY_KEY, atividadeAplicadaId, 'lida'],
    queryFn: ({ signal }) => authedGet(`${caminhoDaAtividade(atividadeAplicadaId)}/prova`, provaOnlineTolerante, signal),
    gcTime: 0,
    staleTime: 0,
    // Voltar para a aba não relê: a tela decide pelo que leu ao abrir, e a leitura nova no meio da tela de outra atividade só a trocaria.
    refetchOnWindowFocus: false,
    retry: retryDaProva,
  })
}

/**
 * A prova em andamento da tela de foco: a mesma chave de `provaQueryOptions` (é nela que a fila de respostas acerta o "Resposta salva"), mas **só lê**: sem `comecar`. A que ainda não
 * começou é `ProvaNaoComecou`. Não envelhece sozinha, pelo mesmo motivo da outra: quem muda as respostas é o aluno.
 */
export function provaEmFocoQueryOptions(atividadeAplicadaId: string) {
  return queryOptions({
    queryKey: [...PROVA_QUERY_KEY, atividadeAplicadaId],
    queryFn: async ({ signal }): Promise<ProvaResponse> => {
      const lida = await authedGet(`${caminhoDaAtividade(atividadeAplicadaId)}/prova`, provaOnlineTolerante, signal)
      if (!lida.comecou) throw new ProvaNaoComecou()
      return provaSemOTempo(lida)
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: retryDaProva,
  })
}

/** A prova que ainda não começou não é falha de rede: repetir a leitura não a faz começar, e a tela já sabe o que fazer. O resto segue a regra do cliente de consultas. */
function retryDaProva(falhas: number, erro: unknown): boolean {
  return !(erro instanceof ProvaNaoComecou) && shouldRetry(falhas, erro)
}

/**
 * O tempo como a tela o usa: o `limiteEm` dele, como a prova foi enviada, e **o desvio do relógio do computador** (o `agora` do servidor menos o `Date.now()` do instante em que a resposta chegou).
 * É por ele que a tela conta o tempo que falta com o relógio do servidor, e não com o da máquina, que pode estar adiantado ou atrasado (RF6; regra 80, item 6).
 */
export interface TempoLido {
  readonly limiteEm: string | null
  readonly envio: TempoDaProva['envio']
  readonly desvioMs: number
}

export function tempoLido(tempo: TempoDaProva, recebidoEm: number = Date.now()): TempoLido {
  return { limiteEm: tempo.limiteEm, envio: tempo.envio, desvioMs: Date.parse(tempo.agora) - recebidoEm }
}

/** De quanto em quanto tempo a tela relê o `tempo`: 30 s (Tech Spec §4). */
export const INTERVALO_DO_TEMPO_MS = 30_000

/**
 * `GET /v1/atividades-aplicadas/:id/tempo`: relido a cada 30 s e ao voltar para a aba. **A falha mantém o último** (o TanStack guarda o dado anterior quando a leitura falha): o 503 e a queda não
 * tiram o limite da tela. O 30 s é do `refetchInterval`, que a tela liga só enquanto a prova importa.
 */
export function tempoDaProvaQueryOptions(atividadeAplicadaId: string) {
  return queryOptions({
    queryKey: [...PROVA_QUERY_KEY, atividadeAplicadaId, 'tempo'],
    queryFn: async ({ signal }): Promise<TempoLido> => tempoLido(await authedRequest(`${caminhoDaAtividade(atividadeAplicadaId)}/tempo`, tempoTolerante, { sinal: signal, tipo: 'prova' })),
    staleTime: 0,
  })
}

/**
 * `POST /v1/atividades-aplicadas/:id/saidas-da-aba` (D70): a `chave` é a da saída, e o reenvio da mesma saída leva a mesma. 204, sem corpo. É a fila de saídas (`fila-de-saidas.ts`) que o chama.
 */
export function registrarSaidaDaAba(atividadeAplicadaId: string, chave: string): Promise<void> {
  return authedRequest(`${caminhoDaAtividade(atividadeAplicadaId)}/saidas-da-aba`, EMPTY_BODY, { metodo: 'POST', corpo: { chave }, tipo: 'prova' })
}

/**
 * `GET /v1/atividades-aplicadas/:id/prova`, **depois de `comecar`**: a atividade como o aluno a faz, com o que ele já respondeu. Sem gabarito nem
 * explicação: o contrato é estrito. **Não envelhece sozinha**: enquanto o aluno responde, quem muda as respostas é ele,
 * e a tela as acerta no cache a cada "Resposta salva"; reler no meio (ao voltar para a aba) trocaria a escolha que ainda
 * está sendo salva pela anterior.
 */
export function provaQueryOptions(atividadeAplicadaId: string) {
  return queryOptions({
    queryKey: [...PROVA_QUERY_KEY, atividadeAplicadaId],
    queryFn: async ({ signal }): Promise<ProvaResponse> => {
      await comecarProva(atividadeAplicadaId)
      const lida = await authedGet(`${caminhoDaAtividade(atividadeAplicadaId)}/prova`, provaOnlineTolerante, signal)
      // Depois do `comecar` a leitura traz a prova. A que ainda não começou (ramo `comecou: false`) é a que `AntesDeComecar` mostra antes do aviso, e não chega a esta tela (a porta de entrada decide antes).
      if (!lida.comecou) throw new ApiError(ErrorCode.NAO_ENCONTRADO)
      // O tempo (`tempo`) é da tela de foco: a tela de uma atividade sem prova online lê a prova como sempre leu.
      return provaSemOTempo(lida)
    },
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/**
 * `GET /v1/atividades-aplicadas/:id/meu-diagnostico`: o diagnóstico do próprio aluno, **que só existe depois de a
 * professora aprovar a correção**. Antes disso a rota responde `NAO_ENCONTRADO`, e a tela diz que a correção ainda vai
 * ser revista (regra 70, item 3). Quem está esperando relê ao voltar para a tela.
 */
export function meuDiagnosticoQueryOptions(atividadeAplicadaId: string) {
  return queryOptions({
    queryKey: [...MEU_DIAGNOSTICO_QUERY_KEY, atividadeAplicadaId],
    queryFn: ({ signal }) => authedGet(`${caminhoDaAtividade(atividadeAplicadaId)}/meu-diagnostico`, meuDiagnosticoResponseSchema, signal),
    staleTime: 0,
  })
}

/**
 * `PUT /v1/atividades-aplicadas/:id/respostas/:questao`: a alternativa marcada e a `sequencia` dela. A gravação é
 * idempotente (regra 80, item 6): mandar a mesma escolha de novo, quando a rede volta, não muda nada no servidor, e a de
 * `sequencia` menor que a gravada perde: a resposta traz o que ficou gravado, e a fila não reenvia (RF21). Sai com o prazo de
 * 10 s (`tipo: 'prova'`): a que pendura estoura em `TEMPO_ESGOTADO` e a fila a manda para o fim, sem travar as outras (RF11).
 */
export function responderQuestao(atividadeAplicadaId: string, questao: number, alternativa: number, sequencia: number): Promise<QuestaoSalvaResponse> {
  return authedRequest(`${caminhoDaAtividade(atividadeAplicadaId)}/respostas/${String(questao)}`, questaoSalvaResponseSchema, { metodo: 'PUT', corpo: { alternativa, sequencia }, tipo: 'prova' })
}

/** `POST /v1/atividades-aplicadas/:id/enviar`: corpo vazio e estrito. Enviar de novo devolve o mesmo. */
export function sendAtividade(atividadeAplicadaId: string): Promise<AtividadeEnviadaResponse> {
  return authedRequest(`${caminhoDaAtividade(atividadeAplicadaId)}/enviar`, atividadeEnviadaResponseSchema, { metodo: 'POST', corpo: {} })
}
