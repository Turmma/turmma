import { ErrorCode, type QuestaoSalvaResponse, type RespostaSalva } from '@educa/shared'

/**
 * A fila das respostas que o servidor ainda não confirmou (regra 80, item 6: **resposta de prova nunca se perde**). A
 * escolha do aluno entra aqui na hora do toque, é mandada ao servidor, e só sai quando ele confirma. Se a gravação
 * falha, a escolha **fica**, e a fila tenta de novo sozinha; a tela continua mostrando o que ele marcou e diz que ainda
 * não foi salvo.
 *
 * **Só a escolha mais nova vale** (RF21): cada escolha leva a `sequencia` dela, `max(a que esta janela conhece, a que o
 * servidor gravou) + 1`, e o banco só grava a maior. Quem perde (o reenvio atrasado, a outra aba) **não reenvia**: adota
 * o que o servidor diz estar gravado e avisa a pessoa. O próximo clique sai uma acima e vence.
 *
 * Aqui mora só a regra, sem rede e sem relógio. Vive em memória (`fila-de-respostas.ts`), nunca em `localStorage`: o
 * que foi salvo de verdade é do servidor, lido pela consulta da prova. A única cópia fora da memória é o espelho das
 * pendentes em `sessionStorage` (`espelho-da-fila.ts`, 53.0): só ids, do aluno da sessão, para o F5 e a sessão vencida
 * não perderem a escolha que o servidor ainda não confirmou.
 */

export interface EscolhaPendente {
  /** O número da questão, a partir de 1. */
  readonly questao: number
  /** O índice da alternativa, de 0 a 3. */
  readonly alternativa: number
  /** A ordem desta escolha na questão: é o que o servidor compara. Quem reenvia manda a mesma. */
  readonly sequencia: number
}

/** O que esta janela sabe estar no servidor, ou ter mandado, numa questão. */
export interface EscolhaConhecida {
  readonly alternativa: number
  readonly sequencia: number
}

/**
 * - `passageira`: a rede caiu, a API não respondeu. A fila tenta de novo sozinha.
 * - `encerrada`: a professora encerrou (ou a atividade já foi enviada). O servidor não aceita mais resposta: a fila
 *   para, e a tela diz quais escolhas não chegaram a ser salvas.
 * - `recusada`: o servidor recusou por outro motivo que não passa com o tempo. A fila para, e a tela manda chamar a
 *   professora; uma escolha nova tenta de novo.
 */
export type FalhaDaFila = 'passageira' | 'encerrada' | 'recusada'

export interface EstadoDaFila {
  /** As escolhas ainda não confirmadas, na ordem em que foram feitas. **Uma por questão**: a última escolha vence. */
  readonly pendentes: readonly EscolhaPendente[]
  /** A escolha que está sendo mandada agora. Uma por vez. */
  readonly noAr: EscolhaPendente | undefined
  readonly falha: FalhaDaFila | undefined
  /** Quantas tentativas seguidas falharam: é o que espaça a seguinte. */
  readonly tentativas: number
  /** Por questão, a escolha mais nova que esta janela conhece: a que mandou ou a que o servidor disse. É a base da `sequencia` seguinte. */
  readonly conhecidas: Readonly<Record<number, EscolhaConhecida>>
  /** As questões em que o servidor ficou com uma escolha mais nova que a desta janela, vinda de outra janela. A tela avisa; o próximo clique limpa. */
  readonly alteradas: readonly number[]
}

export const FILA_VAZIA: EstadoDaFila = { pendentes: [], noAr: undefined, falha: undefined, tentativas: 0, conhecidas: {}, alteradas: [] }

/** A falha que não passa sozinha: a fila não tenta de novo por conta própria. */
export function falhaDefinitiva(estado: EstadoDaFila): boolean {
  return estado.falha === 'encerrada' || estado.falha === 'recusada'
}

/**
 * O aluno marcou uma alternativa. A escolha anterior da mesma questão que ainda não tinha sido salva dá lugar a esta: o
 * que vale é a última, e ela sai com a `sequencia` seguinte à mais nova que esta janela conhece (a que mandou, ou a que
 * o servidor gravou: `confirmarEnvio` e `adotarLeitura` guardam a maior). Com a atividade encerrada, nada entra: o
 * servidor não aceitaria, e a tela não finge que aceitou. A escolha nova depois de uma recusa tenta de novo, e apaga o
 * aviso de "alterada em outra janela" daquela questão.
 */
export function escolher(estado: EstadoDaFila, questao: number, alternativa: number): EstadoDaFila {
  if (estado.falha === 'encerrada') return estado
  const sequencia = (estado.conhecidas[questao]?.sequencia ?? 0) + 1
  const novo: EstadoDaFila = {
    ...estado,
    pendentes: [...estado.pendentes.filter((pendente) => pendente.questao !== questao), { questao, alternativa, sequencia }],
    conhecidas: { ...estado.conhecidas, [questao]: { alternativa, sequencia } },
    alteradas: estado.alteradas.filter((alterada) => alterada !== questao),
  }
  return estado.falha === 'recusada' ? { ...novo, falha: undefined, tentativas: 0 } : novo
}

/** O que mandar agora: a escolha mais antiga, uma por vez. Nada, com um envio no ar ou com a fila parada de vez. */
export function proximoEnvio(estado: EstadoDaFila): EscolhaPendente | undefined {
  if (estado.noAr !== undefined || falhaDefinitiva(estado)) return undefined
  return estado.pendentes[0]
}

/** O envio saiu. */
export function comecarEnvio(estado: EstadoDaFila): EstadoDaFila {
  const proximo = proximoEnvio(estado)
  return proximo === undefined ? estado : { ...estado, noAr: proximo }
}

/**
 * O servidor respondeu ao que estava no ar, com **o que ficou gravado**. Se é a escolha mandada (mesma alternativa e
 * mesma `sequencia`), ela sai da fila **só se ainda é a mesma**: quem trocou de alternativa enquanto a anterior era
 * salva continua com a nova na fila, para ser mandada em seguida. Se é outra, a escolha **perdeu** para uma mais nova de
 * outra janela: ela sai da fila **sem ser reenviada** (reenviar sobrescreveria a mais nova, ou perderia de novo), a
 * janela passa a conhecer a gravada e a questão ganha o aviso. A escolha mais nova feita aqui no meio não perde nada:
 * continua na fila, e o servidor decide por ela.
 */
export function confirmarEnvio(estado: EstadoDaFila, salva: Pick<QuestaoSalvaResponse, 'alternativa' | 'sequencia'>): EstadoDaFila {
  const { noAr } = estado
  if (noAr === undefined) return estado
  const perdeu = salva.sequencia !== noAr.sequencia || salva.alternativa !== noAr.alternativa
  const eEla = (pendente: EscolhaPendente): boolean => pendente.questao === noAr.questao && pendente.sequencia === noAr.sequencia
  const conhecida = estado.conhecidas[noAr.questao]?.sequencia ?? 0
  return {
    pendentes: estado.pendentes.filter((pendente) => !eEla(pendente)),
    noAr: undefined,
    falha: undefined,
    tentativas: 0,
    // O servidor já está na frente da escolha que veio depois? Então a conhecida é a dela, e não a que acabou de voltar.
    conhecidas: salva.sequencia >= conhecida ? { ...estado.conhecidas, [noAr.questao]: { alternativa: salva.alternativa, sequencia: salva.sequencia } } : estado.conhecidas,
    alteradas: perdeu && estado.pendentes.some(eEla) ? [...estado.alteradas.filter((alterada) => alterada !== noAr.questao), noAr.questao] : estado.alteradas,
  }
}

/**
 * A prova foi lida (ou o cache acertado) e o servidor tem, numa questão, uma escolha **mais nova** que a desta janela:
 * ela a adota, como o `PUT` que perde, e a questão ganha o aviso de "alterada em outra janela". Questão que tem
 * escolha na fila fica de fora: é o `PUT` dela que decide. A primeira leitura só ensina a `sequencia` de partida, sem
 * aviso: nesta janela não havia nada a ser alterado.
 */
export function adotarLeitura(estado: EstadoDaFila, lidas: readonly RespostaSalva[]): EstadoDaFila {
  let conhecidas = estado.conhecidas
  let alteradas = estado.alteradas
  for (const lida of lidas) {
    const conhecida = estado.conhecidas[lida.questao]
    if (conhecida !== undefined && lida.sequencia <= conhecida.sequencia) continue
    if (pendenteDaQuestao(estado, lida.questao) !== undefined) continue
    conhecidas = { ...conhecidas, [lida.questao]: { alternativa: lida.alternativa, sequencia: lida.sequencia } }
    if (conhecida !== undefined) alteradas = [...alteradas.filter((alterada) => alterada !== lida.questao), lida.questao]
  }
  return conhecidas === estado.conhecidas ? estado : { ...estado, conhecidas, alteradas }
}

/** Como a falha de uma gravação é tratada, pelo código. Na dúvida é passageira: a escolha fica e é tentada de novo. */
export function tipoDaFalha(codigo: ErrorCode): FalhaDaFila {
  if (codigo === ErrorCode.ATIVIDADE_ENCERRADA) return 'encerrada'
  if (codigo === ErrorCode.NAO_ENCONTRADO || codigo === ErrorCode.ENTRADA_INVALIDA) return 'recusada'
  return 'passageira'
}

/** A gravação falhou. **A escolha continua na fila**, em qualquer falha: é o que a tela mostra como marcado e não salvo. */
export function falharEnvio(estado: EstadoDaFila, codigo: ErrorCode): EstadoDaFila {
  if (estado.noAr === undefined) return estado
  return { ...estado, noAr: undefined, falha: tipoDaFalha(codigo), tentativas: estado.tentativas + 1 }
}

export const PRIMEIRA_ESPERA_DA_FILA_MS = 2_000
export const MAIOR_ESPERA_DA_FILA_MS = 15_000
/** Quanto a espera varia para cima e para baixo: ±25 %. */
export const JITTER_DA_FILA = 0.25

/**
 * Quanto esperar antes da tentativa seguinte: 2 s, 4 s, 8 s e, daí em diante, 15 s, cada uma com **±25 % de jitter** e
 * nunca acima do teto. Com a escola inteira atrás da mesma rede que caiu, trinta alunos tentando a cada segundo é o que
 * impediria a API de voltar (regra 80); e trinta alunos que falharam no mesmo instante, com a mesma espera exata,
 * voltariam todos no mesmo instante também.
 */
export function esperaAntesDeTentar(tentativas: number): number {
  const base = Math.min(MAIOR_ESPERA_DA_FILA_MS, PRIMEIRA_ESPERA_DA_FILA_MS * 2 ** Math.max(0, tentativas - 1))
  return Math.min(MAIOR_ESPERA_DA_FILA_MS, Math.round(base * (1 - JITTER_DA_FILA + 2 * JITTER_DA_FILA * Math.random())))
}

/**
 * As escolhas que o espelho guardou (o F5, a aba reaberta, a sessão que venceu e o mesmo aluno voltou) voltam para a
 * fila, com a `sequencia` com que saíram: o servidor grava uma vez só. A questão que já tem escolha na fila, ou que o
 * servidor já tem com `sequencia` igual ou maior (a leitura da prova chegou primeiro), fica como está: a do espelho
 * perderia de qualquer jeito. As do espelho são mais antigas que as da fila, e saem primeiro.
 */
export function hidratarDoEspelho(estado: EstadoDaFila, guardadas: readonly EscolhaPendente[]): EstadoDaFila {
  const entram = guardadas.filter((guardada) => pendenteDaQuestao(estado, guardada.questao) === undefined && guardada.sequencia > (estado.conhecidas[guardada.questao]?.sequencia ?? 0))
  if (entram.length === 0) return estado
  const conhecidas = { ...estado.conhecidas }
  for (const { questao, alternativa, sequencia } of entram) conhecidas[questao] = { alternativa, sequencia }
  return { ...estado, pendentes: [...entram, ...estado.pendentes], conhecidas }
}

/** A escolha da questão que ainda não foi confirmada, se houver. */
export function pendenteDaQuestao(estado: EstadoDaFila, questao: number): EscolhaPendente | undefined {
  return estado.pendentes.find((pendente) => pendente.questao === questao)
}

/** A questão em que o servidor ficou com uma escolha mais nova, de outra janela: a tela diz isso, em lugar fixo, até o próximo clique. */
export function alteradaEmOutraJanela(estado: EstadoDaFila, questao: number): boolean {
  return estado.alteradas.includes(questao)
}
