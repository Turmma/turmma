import {
  atividadeAplicadaResponseSchema,
  atividadeEncerradaResponseSchema,
  correcaoDoLoteResponseSchema,
  desempenhoDaTurmaResponseSchema,
  destaqueAbertoResponseSchema,
  listaDeAtividadesAplicadasResponseSchema,
  loteAprovadoResponseSchema,
  TAMANHO_MAXIMO_DA_PAGINA,
  type AplicarAtividadeRequest,
  type AtividadeAplicadaResponse,
  type AtividadeEncerradaResponse,
  type DestaqueAbertoResponse,
  type LoteAprovadoResponse,
} from '@educa/shared'
import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { CHAVE_DA_CORRECAO, CHAVE_DAS_ATIVIDADES, CHAVE_DAS_ENTREGAS, CHAVE_DO_DESEMPENHO, CHAVE_DOS_ARTEFATOS } from '../../../../api/chaves-do-professor'
import { buscarComSessao, chamarComSessao } from '../../../../api/sessao'

/**
 * A atividade aplicada à turma, a correção de objetiva e o desempenho por habilidade (A3; D33, D46, D56), pelo professor
 * com vínculo confirmado na turma. A escola, o ano e a pessoa vêm do token: o que vai no pedido é o artefato, a turma e
 * a escolha "é avaliativa?".
 */
const CAMINHO = '/v1/atividades-aplicadas'

/**
 * `POST /v1/atividades-aplicadas`: a atividade vai para a turma. **Aplicar é a decisão registrada da professora** sobre
 * a atividade (quem aplicou e quando ficam gravados). A versão adaptada só aplica aprovada
 * (`VERSAO_ADAPTADA_NAO_APROVADA`), e a que já está aberta para a turma responde `CONFLITO`.
 */
export function aplicarAtividade(pedido: AplicarAtividadeRequest): Promise<AtividadeAplicadaResponse> {
  return chamarComSessao(CAMINHO, atividadeAplicadaResponseSchema, { metodo: 'POST', corpo: pedido })
}

/** As atividades aplicadas à turma, com quantos alunos começaram e enviaram, e a entrega do lote quando já foi corrigida. */
export function consultaAtividadesAplicadas(turmaId: string) {
  return queryOptions({
    queryKey: [...CHAVE_DAS_ATIVIDADES, turmaId],
    queryFn: ({ signal }) => buscarComSessao(`${CAMINHO}?turmaId=${encodeURIComponent(turmaId)}&limite=${String(TAMANHO_MAXIMO_DA_PAGINA)}`, listaDeAtividadesAplicadasResponseSchema, signal),
  })
}

/** `POST /v1/atividades-aplicadas/:id/encerrar`: as respostas param, a correção é feita e a entrega do lote nasce pendente. */
export function encerrarAtividade(id: string): Promise<AtividadeEncerradaResponse> {
  return chamarComSessao(`${CAMINHO}/${encodeURIComponent(id)}/encerrar`, atividadeEncerradaResponseSchema, { metodo: 'POST', corpo: {} })
}

/** O que muda na tela quando uma atividade é aplicada ou encerrada: as atividades da turma, o artefato e as entregas. */
export function recarregarAtividades(cliente: QueryClient): void {
  void cliente.invalidateQueries({ queryKey: CHAVE_DAS_ATIVIDADES })
  void cliente.invalidateQueries({ queryKey: CHAVE_DOS_ARTEFATOS })
  void cliente.invalidateQueries({ queryKey: CHAVE_DAS_ENTREGAS })
}

/**
 * O lote de correção da atividade (`GET /v1/atividades-aplicadas/:id/correcao`): o resumo, os destaques, as outras
 * correções e, depois de aprovado, o registro da validação. O nome do aluno só chega ao professor da turma (D34), e não
 * fica guardado depois de a tela sair (`gcTime: 0`).
 */
export function consultaCorrecaoDoLote(atividadeAplicadaId: string) {
  return queryOptions({
    queryKey: [...CHAVE_DA_CORRECAO, atividadeAplicadaId],
    queryFn: ({ signal }) => buscarComSessao(`${CAMINHO}/${encodeURIComponent(atividadeAplicadaId)}/correcao`, correcaoDoLoteResponseSchema, signal),
    gcTime: 0,
  })
}

/**
 * `POST …/correcao/destaques/:alunoId/abrir`: **abrir é o que fica registrado** (D56). A API grava quem abriu e quando,
 * uma vez só, e devolve as respostas do aluno e o histórico dele. A tela não manda o que mostrou: quem monta o
 * "apresentado" é o servidor.
 */
export function abrirDestaque(atividadeAplicadaId: string, alunoId: string): Promise<DestaqueAbertoResponse> {
  return chamarComSessao(`${CAMINHO}/${encodeURIComponent(atividadeAplicadaId)}/correcao/destaques/${encodeURIComponent(alunoId)}/abrir`, destaqueAbertoResponseSchema, { metodo: 'POST', corpo: {} })
}

/**
 * `POST /v1/entregas/:id/aprovar-lote`, de corpo vazio: a aprovação com o registro da validação. Com destaque sem abrir
 * responde `DESTAQUES_NAO_ABERTOS`; já decidida, `ENTREGA_JA_DECIDIDA`. Rejeitar o lote é `decidirEntrega`.
 */
export function aprovarLote(entregaId: string): Promise<LoteAprovadoResponse> {
  return chamarComSessao(`/v1/entregas/${encodeURIComponent(entregaId)}/aprovar-lote`, loteAprovadoResponseSchema, { metodo: 'POST', corpo: {} })
}

/** O que muda na tela quando o lote é decidido: a correção, as entregas, as atividades e o desempenho da turma. */
export async function recarregarDepoisDoLote(cliente: QueryClient): Promise<void> {
  void cliente.invalidateQueries({ queryKey: CHAVE_DAS_ENTREGAS })
  void cliente.invalidateQueries({ queryKey: CHAVE_DAS_ATIVIDADES })
  void cliente.invalidateQueries({ queryKey: CHAVE_DO_DESEMPENHO })
  await cliente.invalidateQueries({ queryKey: CHAVE_DA_CORRECAO })
}

/** O acerto por habilidade da turma e de cada aluno, **só de lotes aprovados** (`GET /v1/turmas/:id/desempenho`). */
export function consultaDesempenhoDaTurma(turmaId: string) {
  return queryOptions({
    queryKey: [...CHAVE_DO_DESEMPENHO, turmaId],
    queryFn: ({ signal }) => buscarComSessao(`/v1/turmas/${encodeURIComponent(turmaId)}/desempenho`, desempenhoDaTurmaResponseSchema, signal),
    gcTime: 0,
  })
}
