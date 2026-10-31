import { ErrorCode, ESTADOS_FINAIS_DE_EXECUCAO, INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS, type EstadoDeExecucao, type ExecucaoResponse, type ResultadoDaExecucao } from '@educa/shared'
import { CHAVE_DA_CONVERSA, CHAVE_DAS_ENTREGAS, CHAVE_DOS_ARTEFATOS } from './chaves-do-professor'
import { ErroDaApi } from './client'

/**
 * O ciclo de todo pedido que dispara IA (`docs/mvp-contratos.md`, seção 2): a tela sorteia a `chaveEnvio`, manda o
 * `POST`, recebe o 202 com a execução e consulta `GET /v1/execucoes/:id` até ela terminar. Aqui mora a regra, sem tela e
 * sem rede: quando um pedido sai, com que chave, quando a consulta para e o que precisa ser lido de novo no fim.
 *
 * - `enviando`: o `POST` saiu e o 202 não chegou.
 * - `esperando`: a execução existe (`pendente` ou `rodando`) e a tela a consulta.
 * - `concluida`: o resultado chegou.
 * - `falhou`: o envio não foi aceito (sem `execucaoId`) ou a execução terminou em `falhou` (com ele).
 */
export type CicloDeExecucao<Pedido> =
  | { readonly etapa: 'enviando'; readonly pedido: Pedido; readonly chaveEnvio: string; readonly desde: number }
  | { readonly etapa: 'esperando'; readonly pedido: Pedido; readonly chaveEnvio: string; readonly desde: number; readonly execucaoId: string }
  | { readonly etapa: 'concluida'; readonly pedido: Pedido; readonly chaveEnvio: string; readonly execucaoId: string; readonly resultado: ResultadoDaExecucao }
  | { readonly etapa: 'falhou'; readonly pedido: Pedido; readonly chaveEnvio: string; readonly erro: ErrorCode; readonly execucaoId?: string }

/** O pedido ainda está no ar: saiu e não terminou. */
export function emCurso<Pedido>(ciclo: CicloDeExecucao<Pedido> | undefined): ciclo is Extract<CicloDeExecucao<Pedido>, { etapa: 'enviando' | 'esperando' }> {
  return ciclo?.etapa === 'enviando' || ciclo?.etapa === 'esperando'
}

/**
 * Um pedido novo. **A chave é sorteada a cada envio**, e com um pedido ainda no ar nada sai (`undefined`): o segundo
 * Enter e o duplo clique não viram duas execuções (regra 80, item 7).
 */
export function comecarEnvio<Pedido>(atual: CicloDeExecucao<Pedido> | undefined, pedido: Pedido, sortear: () => string, agora: number): CicloDeExecucao<Pedido> | undefined {
  if (emCurso(atual)) return undefined
  return { etapa: 'enviando', pedido, chaveEnvio: sortear(), desde: agora }
}

/**
 * "Tentar de novo", só a partir de uma falha. **O reenvio do mesmo pedido usa a mesma chave** quando o envio não foi
 * aceito: a resposta pode ter se perdido depois de a API gravar a execução, e a mesma chave devolve a mesma execução em
 * vez de gerar outra. Quando foi a execução que falhou, a chave é nova: a antiga devolveria a execução que falhou.
 */
export function tentarDeNovo<Pedido>(atual: CicloDeExecucao<Pedido> | undefined, sortear: () => string, agora: number): CicloDeExecucao<Pedido> | undefined {
  if (atual?.etapa !== 'falhou') return undefined
  return { etapa: 'enviando', pedido: atual.pedido, chaveEnvio: atual.execucaoId === undefined ? atual.chaveEnvio : sortear(), desde: agora }
}

/** O 202 chegou. A resposta de um envio que já não é o da tela (outro pedido entrou no lugar) é ignorada. */
export function aceitarEnvio<Pedido>(atual: CicloDeExecucao<Pedido> | undefined, chaveEnvio: string, execucaoId: string): CicloDeExecucao<Pedido> | undefined {
  if (atual?.etapa !== 'enviando' || atual.chaveEnvio !== chaveEnvio) return atual
  return { etapa: 'esperando', pedido: atual.pedido, chaveEnvio, desde: atual.desde, execucaoId }
}

/** O envio não foi aceito: fica o código, e nunca o erro cru. */
export function recusarEnvio<Pedido>(atual: CicloDeExecucao<Pedido> | undefined, chaveEnvio: string, erro: unknown): CicloDeExecucao<Pedido> | undefined {
  if (atual?.etapa !== 'enviando' || atual.chaveEnvio !== chaveEnvio) return atual
  return { etapa: 'falhou', pedido: atual.pedido, chaveEnvio, erro: codigoDoErro(erro) }
}

/** O que a consulta da execução trouxe. `pendente` e `rodando` não mudam nada; a de outra execução é ignorada. */
export function registrarExecucao<Pedido>(atual: CicloDeExecucao<Pedido> | undefined, execucao: ExecucaoResponse): CicloDeExecucao<Pedido> | undefined {
  if (atual?.etapa !== 'esperando' || atual.execucaoId !== execucao.id) return atual
  if (execucao.estado === 'concluida' && execucao.resultado !== null) return { etapa: 'concluida', pedido: atual.pedido, chaveEnvio: atual.chaveEnvio, execucaoId: execucao.id, resultado: execucao.resultado }
  if (execucao.estado === 'falhou') return { etapa: 'falhou', pedido: atual.pedido, chaveEnvio: atual.chaveEnvio, execucaoId: execucao.id, erro: execucao.erro ?? ErrorCode.ERRO_INTERNO }
  return atual
}

/** A consulta da execução não respondeu: a execução pode ter terminado, e a mesma chave a devolve no "Tentar de novo". */
export function desistirDaConsulta<Pedido>(atual: CicloDeExecucao<Pedido> | undefined, erro: unknown): CicloDeExecucao<Pedido> | undefined {
  if (atual?.etapa !== 'esperando') return atual
  return { etapa: 'falhou', pedido: atual.pedido, chaveEnvio: atual.chaveEnvio, erro: codigoDoErro(erro) }
}

/** O código de qualquer falha: o da API quando ela respondeu, erro interno para o resto. */
export function codigoDoErro(erro: unknown): ErrorCode {
  return erro instanceof ErroDaApi ? erro.codigo : ErrorCode.ERRO_INTERNO
}

/**
 * De quanto em quanto a tela consulta a execução: o intervalo do contrato enquanto ela não termina, e **nunca mais**
 * depois de `concluida` ou `falhou`. A consulta que falhou também para: quem decide repetir é a pessoa.
 */
export function intervaloDaConsulta(execucao: { readonly estado: EstadoDeExecucao } | undefined, falhou: boolean): number | false {
  if (falhou) return false
  if (execucao !== undefined && (ESTADOS_FINAIS_DE_EXECUCAO as readonly EstadoDeExecucao[]).includes(execucao.estado)) return false
  return INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS
}

/**
 * A partir de quando a tela avisa que a resposta está demorando, sem contar o tempo na tela (D59). Vinte segundos: uma
 * geração de atividade num modelo local passa dos dez com folga, e o aviso que aparece em toda geração deixa de avisar.
 */
export const LIMIAR_DA_DEMORA_MS = 20_000

export function estaDemorando(desde: number, agora: number): boolean {
  return agora - desde >= LIMIAR_DA_DEMORA_MS
}

/**
 * O que a tela lê de novo quando a execução conclui, pelo que ela produziu: a resposta do Assistente entra na conversa;
 * o artefato novo entra na lista e no artefato de origem (a versão adaptada aparece nele); e a entrega que nasceu com
 * ele entra em "Esperando você", na Home e no sino.
 */
export function chavesParaInvalidar(resultado: ResultadoDaExecucao): readonly (readonly string[])[] {
  if (resultado.tipo === 'mensagem') return [CHAVE_DA_CONVERSA]
  if (resultado.tipo === 'artefato') return resultado.entregaId === null ? [CHAVE_DOS_ARTEFATOS] : [CHAVE_DOS_ARTEFATOS, CHAVE_DAS_ENTREGAS]
  if (resultado.tipo === 'lote_de_correcao') return [CHAVE_DAS_ENTREGAS]
  return []
}

/** Os erros que passam sozinhos: vale pedir de novo com o mesmo pedido. O resto pede que algo mude antes. */
const PASSAGEIROS: readonly ErrorCode[] = [
  ErrorCode.IA_INDISPONIVEL,
  ErrorCode.IA_TEMPO_ESGOTADO,
  ErrorCode.IA_SAIDA_INVALIDA,
  ErrorCode.IA_ENTRADA_INVALIDA,
  ErrorCode.EXECUCAO_INTERROMPIDA,
  ErrorCode.INDISPONIVEL_TENTE_DE_NOVO,
  ErrorCode.TEMPO_ESGOTADO,
  ErrorCode.ERRO_INTERNO,
]

/**
 * Como a falha aparece na tela, pelo código (regra 80, item 4: nunca erro cru):
 * - `fila`: passa sozinha, e a tela oferece "Tentar de novo" (`AvisoFila`);
 * - `suspensa`: a escola suspendeu a função. É aviso que explica, e não erro: pedir de novo não adianta;
 * - `limite`: a pessoa passou do número de pedidos de IA por minuto (429). Não é falha de ninguém: a tela diz com calma
 *   que é só esperar, e o pedido continua lá para ser repetido;
 * - `explicada`: algo precisa mudar antes (o tema, o orçamento da escola), e a mensagem do catálogo diz o quê.
 */
export type AparenciaDaFalha = 'fila' | 'suspensa' | 'limite' | 'explicada'

export function aparenciaDaFalha(erro: ErrorCode): AparenciaDaFalha {
  if (erro === ErrorCode.FUNCAO_SUSPENSA) return 'suspensa'
  if (erro === ErrorCode.LIMITE_EXCEDIDO) return 'limite'
  return PASSAGEIROS.includes(erro) ? 'fila' : 'explicada'
}
