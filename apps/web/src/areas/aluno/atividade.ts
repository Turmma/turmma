import { ErrorCode, type MeuDiagnosticoResponse, type ProvaResponse } from '@educa/shared'
import { ErroDaApi } from '../../api/client'
import { formatarQuantidade } from '../../format'
import { pendenteDaQuestao, type EstadoDaFila } from './respostas'

/**
 * O que a tela da atividade mostra em cada momento (MVP, A3). Aqui mora a regra, sem tela e sem rede:
 * - **respondendo**: a atividade está aberta e o aluno não enviou. É a única fase em que ele marca alternativa.
 * - **enviada**: ele enviou. Não muda mais nada.
 * - **encerrada**: a professora encerrou antes de ele enviar. Também não muda mais nada.
 *
 * **O resultado só aparece depois de a professora aprovar a correção** (regra 70, item 3): enquanto a aprovação não
 * existe a API responde `NAO_ENCONTRADO` em `meu-diagnostico` — com o lote pendente, rejeitado ou ainda não corrigido —,
 * e a tela diz que a correção vai ser revista. O que aparece depois é diagnóstico por habilidade: contagem de acertos,
 * nunca nota nem conceito (D46), e nada de mais ninguém (regra 50, item 9).
 */

export type FaseDaAtividade = 'respondendo' | 'enviada' | 'encerrada'

export function faseDaAtividade(prova: Pick<ProvaResponse, 'estado' | 'enviadaEm'>): FaseDaAtividade {
  if (prova.enviadaEm !== null) return 'enviada'
  return prova.estado === 'encerrada' ? 'encerrada' : 'respondendo'
}

/** O que a leitura do diagnóstico trouxe, no mínimo que a regra precisa (é o formato de uma consulta do TanStack Query). */
export interface LeituraDoDiagnostico {
  readonly data: MeuDiagnosticoResponse | undefined
  readonly error: unknown
}

export type ResultadoNaTela =
  /** Ainda respondendo: não há resultado, e a tela nem pergunta por ele. */
  | { readonly tipo: 'nenhum' }
  | { readonly tipo: 'carregando' }
  /** A correção ainda não foi aprovada (pendente, rejeitada ou nem corrigida): a tela não diz nada do que ela achou. */
  | { readonly tipo: 'aguardando' }
  | { readonly tipo: 'erro'; readonly erro: unknown }
  | { readonly tipo: 'pronto'; readonly diagnostico: MeuDiagnosticoResponse }

export function resultadoNaTela(fase: FaseDaAtividade, leitura: LeituraDoDiagnostico): ResultadoNaTela {
  // Com a atividade ainda sendo respondida não há o que mostrar, mesmo que uma leitura antiga tenha ficado no cache.
  if (fase === 'respondendo') return { tipo: 'nenhum' }
  if (leitura.error instanceof ErroDaApi && leitura.error.codigo === ErrorCode.NAO_ENCONTRADO) return { tipo: 'aguardando' }
  if (leitura.data !== undefined) return { tipo: 'pronto', diagnostico: leitura.data }
  if (leitura.error !== null && leitura.error !== undefined) return { tipo: 'erro', erro: leitura.error }
  return { tipo: 'carregando' }
}

/**
 * O que a `Comemoracao` diz (RF8; D59; regra 70, item 4a): só o **fato** da entrega, e de quem vê a correção. Texto fixo:
 * não varia com acerto, tempo nem número de tentativas, não afirma ser pessoa, não promete voltar nem esperar, e não
 * faz festa de nota. O teste de falas (`atividade.test.ts`) lê esta constante, e não a tela.
 */
export const FALA_DA_ENTREGA = 'Atividade entregue. Quem dá a aula vê a correção antes de você.'

/** O botão que fecha a comemoração: leva à lista, o mesmo caminho do "Voltar" do alto da tela. */
export const ROTULO_DE_VOLTAR_AS_TAREFAS = 'Voltar às tarefas'

/**
 * Se a comemoração está na tela. Ela é **da entrega**, e de mais nada (RF8; D59):
 * - `entregueAgora`: o envio foi confirmado **nesta tela**, nesta abertura. Estado de tela: recarregar, abrir a tarefa
 *   pela lista ou voltar a ela depois de sair a apagam, e a tarefa enviada em outra hora ou em outra janela não a tem.
 * - `enviadaEm` preenchida: a tela já leu o envio. Sem ele a tela ainda é a de quem responde.
 * - sem o resultado na tela: a comemoração nunca divide a tela com acerto, mesmo que a correção seja aprovada enquanto
 *   o aluno ainda está nela.
 */
export function comemoracaoNaTela(entregueAgora: boolean, prova: Pick<ProvaResponse, 'enviadaEm'>, resultado: ResultadoNaTela): boolean {
  return entregueAgora && prova.enviadaEm !== null && resultado.tipo !== 'pronto'
}

/** As letras das alternativas, na ordem do índice do contrato (0 a 3). */
export const LETRAS_DAS_ALTERNATIVAS = ['A', 'B', 'C', 'D'] as const

export function letraDaAlternativa(indice: number): string {
  return LETRAS_DAS_ALTERNATIVAS[indice] ?? String(indice + 1)
}

/**
 * Como está a resposta de uma questão:
 * - `salva`: o servidor confirmou a alternativa marcada. Só aí a tela diz "Resposta salva".
 * - `salvando`: a escolha saiu, ou está na vez de sair.
 * - `nao_salva`: a gravação falhou; a escolha continua marcada e vai ser mandada de novo.
 * - `sem_resposta`: nada marcado.
 */
export type MarcaDaQuestao = 'sem_resposta' | 'salvando' | 'salva' | 'nao_salva'

/** As respostas que o servidor confirmou, pelo número da questão. */
export function respostasSalvas(prova: Pick<ProvaResponse, 'respostas'>): ReadonlyMap<number, number> {
  return new Map(prova.respostas.map((resposta) => [resposta.questao, resposta.alternativa]))
}

/** A alternativa que a tela mostra marcada: a escolha ainda não confirmada vem antes da salva, porque é a mais nova. */
export function alternativaMarcada(questao: number, salvas: ReadonlyMap<number, number>, fila: EstadoDaFila): number | undefined {
  return pendenteDaQuestao(fila, questao)?.alternativa ?? salvas.get(questao)
}

export function marcaDaQuestao(questao: number, salvas: ReadonlyMap<number, number>, fila: EstadoDaFila): MarcaDaQuestao {
  if (pendenteDaQuestao(fila, questao) !== undefined) return fila.falha === undefined ? 'salvando' : 'nao_salva'
  return salvas.has(questao) ? 'salva' : 'sem_resposta'
}

/**
 * O que a tela diz, no mesmo lugar do "Resposta salva", quando o servidor ficou com uma escolha mais nova feita em outra
 * janela (RF21): a alternativa que fica marcada é a gravada, e a próxima escolha daqui vale de novo.
 */
export const AVISO_DE_OUTRA_JANELA = 'Sua resposta foi alterada em outra janela'

/** O que a tela diz embaixo das alternativas. Sem resposta, nada: silêncio não é erro. */
export const TEXTO_DA_MARCA: Readonly<Record<MarcaDaQuestao, string>> = {
  sem_resposta: '',
  salvando: 'Salvando a resposta…',
  salva: 'Resposta salva',
  nao_salva: 'Não foi possível salvar agora. A sua escolha continua marcada, e a tela tenta de novo sozinha.',
}

/** O que o mapa das questões diz de cada uma, em texto: cor sozinha não diz estado (regra 50, item 11). */
export const NOME_DA_MARCA: Readonly<Record<MarcaDaQuestao, string>> = {
  sem_resposta: 'sem resposta',
  salvando: 'salvando',
  salva: 'respondida',
  nao_salva: 'resposta ainda não salva',
}

export function rotuloNoMapa(questao: number, marca: MarcaDaQuestao): string {
  return `Questão ${String(questao)}, ${NOME_DA_MARCA[marca]}`
}

export interface ContagemDasRespostas {
  readonly questoes: number
  /** Com alternativa marcada, salva ou não. */
  readonly respondidas: number
  readonly emBranco: number
  /** Marcadas que o servidor ainda não confirmou: enquanto houver, a atividade não é enviada. */
  readonly naoSalvas: number
}

export function contarRespostas(prova: Pick<ProvaResponse, 'questoes' | 'respostas'>, fila: EstadoDaFila): ContagemDasRespostas {
  const salvas = respostasSalvas(prova)
  const respondidas = prova.questoes.filter((questao) => alternativaMarcada(questao.numero, salvas, fila) !== undefined).length
  return { questoes: prova.questoes.length, respondidas, emBranco: prova.questoes.length - respondidas, naoSalvas: fila.pendentes.length }
}

/** "Você respondeu 6 de 8 questões." */
export function textoDasRespondidas(contagem: Pick<ContagemDasRespostas, 'respondidas' | 'questoes'>): string {
  return `${String(contagem.respondidas)} de ${formatarQuantidade(contagem.questoes, 'questão', 'questões')}`
}

/** O que a confirmação do envio diz sobre as questões em branco: quantas, por extenso, ou que não ficou nenhuma. */
export function textoDasEmBranco(emBranco: number): string {
  if (emBranco === 0) return 'Nenhuma questão em branco'
  return emBranco === 1 ? '1 questão em branco' : `${String(emBranco)} questões em branco`
}

/**
 * Por que o envio não sai agora, ou `undefined` quando sai. Enviar com escolha ainda não salva gravaria a atividade sem
 * ela: a tela segura o envio e diz por quê, em vez de perder a resposta em silêncio (regra 80, item 6).
 */
export function impedimentoDoEnvio(contagem: Pick<ContagemDasRespostas, 'naoSalvas'>): string | undefined {
  if (contagem.naoSalvas === 0) return undefined
  return contagem.naoSalvas === 1
    ? 'Uma resposta ainda não foi salva. Espere a mensagem "Resposta salva" e envie de novo.'
    : `${String(contagem.naoSalvas)} respostas ainda não foram salvas. Espere a conexão voltar e envie de novo.`
}

/** O que a tela diz quando a professora encerrou e ficaram escolhas que o servidor não chegou a receber. */
export function avisoDeEscolhasPerdidas(fila: EstadoDaFila): string | undefined {
  if (fila.falha !== 'encerrada' || fila.pendentes.length === 0) return undefined
  const questoes = fila.pendentes.map((pendente) => pendente.questao).sort((a, b) => a - b)
  const quais = questoes.length === 1 ? `a resposta da questão ${String(questoes[0])}` : `as respostas das questões ${questoes.slice(0, -1).join(', ')} e ${String(questoes.at(-1))}`
  return `A atividade foi encerrada antes de ${quais} ${questoes.length === 1 ? 'ser salva' : 'serem salvas'}. Se isso fizer diferença, avise quem dá a aula.`
}

/** "2 de 3 questões": o acerto numa habilidade, em contagem. Sem percentual, que se lê como nota (D46). */
export function textoDoAcerto(acertos: number, total: number): string {
  return `${String(acertos)} de ${formatarQuantidade(total, 'questão', 'questões')}`
}

/** O número da questão aberta, preso ao que a atividade tem. */
export function questaoValida(numero: number, questoes: number): number {
  if (!Number.isInteger(numero)) return 1
  return Math.min(Math.max(numero, 1), Math.max(questoes, 1))
}
