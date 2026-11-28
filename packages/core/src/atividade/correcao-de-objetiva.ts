import { MOTIVOS_DE_DESTAQUE, type DiagnosticoGravado, type MotivoDeDestaque, type QuestaoObjetiva } from '@educa/shared'

/**
 * A correção de objetiva (D33, D46; `docs/aia/correcao-de-objetiva.md`): **uma conta**, pelo gabarito, sem modelo. Tudo
 * aqui é função pura sobre as respostas e o artefato. O que sai é contagem de questões e o diagnóstico por habilidade:
 * não existe nota, conceito nem pontuação convertida (D46), e nenhum texto sobre o aluno (D57, D66).
 *
 * `questao` é o número da questão, a partir de 1; `alternativa` e `gabarito`, o índice, de 0 a 3.
 */

/** As respostas de uma tentativa: número da questão → índice da alternativa marcada. Questão em branco não tem entrada. */
export type RespostasDaTentativa = ReadonlyMap<number, number>

export interface CorrecaoCalculada {
  readonly acertos: number
  readonly total: number
  readonly emBranco: number
  readonly porHabilidade: DiagnosticoGravado
}

/**
 * Compara as respostas com o gabarito. A habilidade sai na ordem em que aparece na atividade. A questão sem habilidade
 * (`habilidade: null`) conta numa linha à parte, com `codigo: null`: nunca soma à de um código (classificacao-bncc, 10.0;
 * correção 2026-11-20-leitura-de-habilidade-nula).
 */
export function corrigirTentativa(questoes: readonly QuestaoObjetiva[], respostas: RespostasDaTentativa): CorrecaoCalculada {
  const porHabilidade = new Map<string | null, { codigo: string | null; acertos: number; total: number }>()
  let acertos = 0
  let emBranco = 0
  questoes.forEach((questao, indice) => {
    const marcada = respostas.get(indice + 1)
    const acertou = marcada === questao.gabarito
    if (marcada === undefined) emBranco += 1
    if (acertou) acertos += 1
    const codigo = questao.habilidade?.codigo ?? null
    const habilidade = porHabilidade.get(codigo) ?? { codigo, acertos: 0, total: 0 }
    habilidade.total += 1
    if (acertou) habilidade.acertos += 1
    porHabilidade.set(habilidade.codigo, habilidade)
  })
  return { acertos, total: questoes.length, emBranco, porHabilidade: [...porHabilidade.values()] }
}

/**
 * Os limiares dos destaques. **São decisão de produto em aberto** (`CLAUDE.md`, "Indicadores de desempenho"; AIA da
 * correção, 1.8, item 4): ficam aqui, nomeados e testados, para trocar num lugar só.
 */

/** `fora_do_historico`: o histórico do aluno precisa somar pelo menos tantas questões em lotes aprovados. Menos que isso não é histórico. */
export const MINIMO_DE_QUESTOES_NO_HISTORICO = 5
/** `fora_do_historico`: a atividade precisa ter pelo menos tantas questões para a taxa dela se comparar com a do histórico. */
export const MINIMO_DE_QUESTOES_PARA_COMPARAR_COM_O_HISTORICO = 3
/** `fora_do_historico`: a distância, em fração de acertos (0,40 são 40 pontos percentuais), para cima ou para baixo. */
export const DISTANCIA_DO_HISTORICO = 0.4
/** Quantos lotes aprovados, dos mais recentes, formam o histórico. É também o teto da lista que o destaque aberto mostra. */
export const MAXIMO_DE_LOTES_NO_HISTORICO = 10

/** `padrao_de_erro`, mesma alternativa em todas: só com pelo menos tantas questões respondidas. */
export const MINIMO_DE_RESPOSTAS_PARA_MESMA_ALTERNATIVA = 4

/** `padrao_de_erro`, erro onde a turma acertou: só se compara com pelo menos tantos colegas corrigidos no lote. */
export const MINIMO_DE_COLEGAS_PARA_COMPARAR = 5
/** Uma questão é das que "a turma quase toda acertou" quando esta fração dos colegas, ou mais, acertou. */
export const FRACAO_DA_TURMA_QUE_ACERTOU = 0.9
/** Precisa haver pelo menos tantas questões que a turma quase toda acertou. */
export const MINIMO_DE_QUESTOES_QUE_A_TURMA_ACERTOU = 2
/** O destaque dispara quando o aluno marcou errado nesta fração, ou mais, das questões que a turma quase toda acertou. */
export const FRACAO_DE_ERROS_ONDE_A_TURMA_ACERTOU = 0.5

/** O acerto somado do próprio aluno nos lotes **aprovados** antes deste, na mesma disciplina. */
export interface HistoricoAprovado {
  readonly acertos: number
  readonly total: number
}

/** O que a turma fez no lote, para comparar um aluno com os colegas: quantos foram corrigidos e quantos acertaram cada questão. */
export interface AcertosDoLote {
  readonly corrigidos: number
  /** Posição `i` é a questão de número `i + 1`. */
  readonly acertosPorQuestao: readonly number[]
}

/** Quantos acertaram cada questão, somando as tentativas do lote. */
export function acertosDoLote(questoes: readonly QuestaoObjetiva[], tentativas: readonly RespostasDaTentativa[]): AcertosDoLote {
  return {
    corrigidos: tentativas.length,
    acertosPorQuestao: questoes.map((questao, indice) => tentativas.filter((respostas) => respostas.get(indice + 1) === questao.gabarito).length),
  }
}

function foraDoHistorico(correcao: CorrecaoCalculada, historico: HistoricoAprovado | undefined): boolean {
  if (historico === undefined || historico.total < MINIMO_DE_QUESTOES_NO_HISTORICO) return false
  if (correcao.total < MINIMO_DE_QUESTOES_PARA_COMPARAR_COM_O_HISTORICO) return false
  const distancia = Math.abs(correcao.acertos / correcao.total - historico.acertos / historico.total)
  // A folga cobre o erro de ponto flutuante: 0,8 − 0,4 não dá 0,4 exato.
  return distancia >= DISTANCIA_DO_HISTORICO - 1e-9
}

function mesmaAlternativaEmTodas(questoes: readonly QuestaoObjetiva[], respostas: RespostasDaTentativa, correcao: CorrecaoCalculada): boolean {
  const marcadas = questoes.flatMap((_, indice) => respostas.get(indice + 1) ?? [])
  if (marcadas.length < MINIMO_DE_RESPOSTAS_PARA_MESMA_ALTERNATIVA) return false
  // Se o gabarito é mesmo a mesma letra em todas, quem acertou tudo não tem padrão nenhum a conferir.
  return new Set(marcadas).size === 1 && correcao.acertos < marcadas.length
}

function errouOndeATurmaAcertou(questoes: readonly QuestaoObjetiva[], respostas: RespostasDaTentativa, lote: AcertosDoLote): boolean {
  const colegas = lote.corrigidos - 1
  if (colegas < MINIMO_DE_COLEGAS_PARA_COMPARAR) return false
  let queATurmaAcertou = 0
  let erradas = 0
  questoes.forEach((questao, indice) => {
    const marcada = respostas.get(indice + 1)
    const acertosDosColegas = (lote.acertosPorQuestao[indice] ?? 0) - (marcada === questao.gabarito ? 1 : 0)
    if (acertosDosColegas < colegas * FRACAO_DA_TURMA_QUE_ACERTOU) return
    queATurmaAcertou += 1
    // Em branco não é erro: a prova em branco tem o destaque dela.
    if (marcada !== undefined && marcada !== questao.gabarito) erradas += 1
  })
  return queATurmaAcertou >= MINIMO_DE_QUESTOES_QUE_A_TURMA_ACERTOU && erradas >= queATurmaAcertou * FRACAO_DE_ERROS_ONDE_A_TURMA_ACERTOU
}

export interface TentativaParaDestacar {
  readonly questoes: readonly QuestaoObjetiva[]
  readonly respostas: RespostasDaTentativa
  readonly correcao: CorrecaoCalculada
  /** Ausente, ou curto demais, o destaque de histórico não dispara. */
  readonly historico?: HistoricoAprovado | undefined
  readonly lote: AcertosDoLote
}

/**
 * Por que a correção de um aluno precisa ser aberta antes da aprovação (D33). Cada motivo é **fato sobre o trabalho**,
 * de lista fechada, e nenhum conclui sobre a pessoa (D57; AIA, N7): não há texto, rótulo nem suspeita gravada.
 *
 * - `em_branco`: nenhuma questão respondida.
 * - `fora_do_historico`: a taxa de acertos ficou a `DISTANCIA_DO_HISTORICO` ou mais da taxa do próprio aluno nos lotes
 *   aprovados, para cima ou para baixo. Sem histórico suficiente não dispara, e não dispara na prova em branco, que já
 *   tem o motivo dela.
 * - `padrao_de_erro`: a mesma alternativa em todas as respondidas (com erro), ou erro na maior parte das questões que a
 *   turma quase toda acertou.
 */
export function destaquesDaTentativa({ questoes, respostas, correcao, historico, lote }: TentativaParaDestacar): MotivoDeDestaque[] {
  const emBranco = correcao.emBranco === correcao.total
  const motivos = new Set<MotivoDeDestaque>()
  if (emBranco) motivos.add('em_branco')
  if (!emBranco && foraDoHistorico(correcao, historico)) motivos.add('fora_do_historico')
  if (mesmaAlternativaEmTodas(questoes, respostas, correcao) || errouOndeATurmaAcertou(questoes, respostas, lote)) motivos.add('padrao_de_erro')
  return MOTIVOS_DE_DESTAQUE.filter((motivo) => motivos.has(motivo))
}
