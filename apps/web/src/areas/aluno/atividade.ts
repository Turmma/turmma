import { ErrorCode, type MeuDiagnosticoResponse, type ProvaResponse, type QuestaoDaProva } from '@educa/shared'
import type { TempoLido } from '../../api/atividades-do-aluno'
import { ApiError } from '../../api/client'
import { formatQuantity } from '../../format'
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

/**
 * **A prova embaralhada é só de apresentação** (RF8; Tech Spec §4). `numero` é sempre o da questão original, e as questões vêm na ordem do aluno; `alternativas` vem na ordem em que a tela as mostra,
 * e `ordemDasAlternativas[posicao]` é o **índice original** da alternativa daquela posição. É o índice original que o `PUT` manda e que o diagnóstico devolve: aqui mora a conta entre os dois.
 */
export function questaoPorNumero(prova: Pick<ProvaResponse, 'questoes'>, numero: number): QuestaoDaProva | undefined {
  return prova.questoes.find((questao) => questao.numero === numero)
}

/** O índice original da alternativa que está na `posicao` da tela: é o que a resposta carrega. Sem a ordem (questão que não existe), a própria posição. */
export function alternativaOriginal(questao: Pick<QuestaoDaProva, 'ordemDasAlternativas'> | undefined, posicao: number): number {
  return questao?.ordemDasAlternativas[posicao] ?? posicao
}

/** A posição na tela da alternativa de índice original `original`: a conta inversa de `alternativaOriginal`. */
export function posicaoDaAlternativa(questao: Pick<QuestaoDaProva, 'ordemDasAlternativas'> | undefined, original: number): number {
  const posicao = questao?.ordemDasAlternativas.indexOf(original) ?? -1
  return posicao === -1 ? original : posicao
}

/** A posição, a partir de 1, em que o aluno vê a questão de número `numero`: o que a tela chama de "Questão N". Sem embaralhar é o próprio número. */
export function posicaoDaQuestao(prova: Pick<ProvaResponse, 'questoes'>, numero: number): number {
  const indice = prova.questoes.findIndex((questao) => questao.numero === numero)
  return indice === -1 ? numero : indice + 1
}

/** "B. Cinco": a alternativa de índice original `original`, com a letra e o texto **da posição em que o aluno a viu**, e não o da ordem original. */
export function alternativaComTexto(questao: Pick<QuestaoDaProva, 'alternativas' | 'ordemDasAlternativas'> | undefined, original: number): string {
  const posicao = posicaoDaAlternativa(questao, original)
  const texto = questao?.alternativas[posicao]
  return texto === undefined ? letraDaAlternativa(posicao) : `${letraDaAlternativa(posicao)}. ${texto}`
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
  if (leitura.error instanceof ApiError && leitura.error.codigo === ErrorCode.NAO_ENCONTRADO) return { tipo: 'aguardando' }
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

export function countRespostas(prova: Pick<ProvaResponse, 'questoes' | 'respostas'>, fila: EstadoDaFila): ContagemDasRespostas {
  const salvas = respostasSalvas(prova)
  const respondidas = prova.questoes.filter((questao) => alternativaMarcada(questao.numero, salvas, fila) !== undefined).length
  return { questoes: prova.questoes.length, respondidas, emBranco: prova.questoes.length - respondidas, naoSalvas: fila.pendentes.length }
}

/** "Você respondeu 6 de 8 questões." */
export function textoDasRespondidas(contagem: Pick<ContagemDasRespostas, 'respondidas' | 'questoes'>): string {
  return `${String(contagem.respondidas)} de ${formatQuantity(contagem.questoes, 'questão', 'questões')}`
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
export function avisoDeEscolhasPerdidas(fila: EstadoDaFila, naTela: (numero: number) => number = (numero) => numero): string | undefined {
  if (fila.falha !== 'encerrada' || fila.pendentes.length === 0) return undefined
  // Pelo número que o aluno viu na tela: com a prova embaralhada, o número original da questão não é o dela.
  const questoes = fila.pendentes.map((pendente) => naTela(pendente.questao)).sort((a, b) => a - b)
  const quais = questoes.length === 1 ? `a resposta da questão ${String(questoes[0])}` : `as respostas das questões ${questoes.slice(0, -1).join(', ')} e ${String(questoes.at(-1))}`
  return `A atividade foi encerrada antes de ${quais} ${questoes.length === 1 ? 'ser salva' : 'serem salvas'}. Se isso fizer diferença, avise quem dá a aula.`
}

/** "2 de 3 questões": o acerto numa habilidade, em contagem. Sem percentual, que se lê como nota (D46). */
export function textoDoAcerto(acertos: number, total: number): string {
  return `${String(acertos)} de ${formatQuantity(total, 'questão', 'questões')}`
}

/** O número da questão aberta, preso ao que a atividade tem. */
export function questaoValida(numero: number, questoes: number): number {
  if (!Number.isInteger(numero)) return 1
  return Math.min(Math.max(numero, 1), Math.max(questoes, 1))
}

/**
 * A prova em tela de foco (avaliacao-e-correcao, 12.0; `docs/interface.md` §2): o relógio, os avisos e os textos de erro. Aqui mora a regra, sem tela e sem rede. **O relógio é o do servidor** (RF6): o tempo que falta
 * é o `limiteEm` menos o `Date.now()` corrigido pelo desvio que a leitura do `tempo` trouxe, e nunca o relógio da máquina sozinho.
 */

/** Quanto tempo falta, em ms (zero ou negativo: acabou), ou `undefined` sem tempo lido ou sem limite. */
export function milissegundosQueFaltam(tempo: TempoLido | undefined, agora: number): number | undefined {
  if (tempo?.limiteEm === null || tempo === undefined) return undefined
  return Date.parse(tempo.limiteEm) - (agora + tempo.desvioMs)
}

/** O relógio da faixa: minutos inteiros, para cima, e nenhum segundo (a conta regressiva por segundo é pressão, D59). */
export function textoDoRelogio(faltaMs: number): string {
  if (faltaMs <= 0) return 'O tempo acabou'
  if (faltaMs <= 60_000) return 'Falta menos de 1 min'
  return `Faltam ${String(Math.ceil(faltaMs / 60_000))} min`
}

/** Os minutos em que o leitor de tela é avisado, uma vez cada: 10, 5 e 1 (`polite`). A 11 min, nenhum. */
export const LIMIARES_DO_ANUNCIO_DO_RELOGIO_MIN = [10, 5, 1] as const

export interface AnuncioDoRelogio {
  /** Os limiares que este anúncio cobre: o aluno que abre a prova com 8 min recebe um aviso só, e não o de 10 e o de 5. */
  readonly limiares: readonly number[]
  readonly texto: string
}

/** O aviso do momento, se há: o tempo que falta cruzou um limiar que ainda não foi dito. Depois que a prova acaba, quem fala é o fim, e não este. */
export function anuncioDoRelogio(faltaMs: number, jaAnunciados: ReadonlySet<number>): AnuncioDoRelogio | undefined {
  if (faltaMs <= 0) return undefined
  const minutos = Math.ceil(faltaMs / 60_000)
  const alcancados = LIMIARES_DO_ANUNCIO_DO_RELOGIO_MIN.filter((limiar) => minutos <= limiar)
  if (alcancados.length === 0 || alcancados.every((limiar) => jaAnunciados.has(limiar))) return undefined
  return { limiares: alcancados, texto: minutos === 1 ? 'Falta 1 minuto.' : `Faltam ${String(minutos)} minutos.` }
}

export const TEXTO_DE_SAIR_DA_PROVA = 'Sair da prova'
export const TEXTO_SEM_CONEXAO = 'Sem conexão. Suas respostas ficam guardadas e seguem quando a rede voltar. O tempo continua.'
export const TEXTO_DO_FIM_DO_TEMPO = 'O tempo acabou. Suas respostas salvas foram enviadas.'
export const TEXTO_DO_FIM_ENCERRADA = 'Quem dá a aula encerrou a prova. Suas respostas salvas foram enviadas.'
export const TEXTO_DO_FIM_ENVIADA = 'Prova enviada. Quem dá a aula vê a correção antes de você.'
export const TEXTO_DE_ERRO_AO_ABRIR_A_PROVA = 'Não foi possível abrir a prova. Tente de novo.'
export const TEXTO_DE_AGUARDE = 'Aguarde um instante.'
export const TEXTO_DO_ENVIO_QUE_NAO_SAIU = 'Não deu para enviar agora. Suas respostas estão guardadas; tente de novo em instantes. O tempo da queda volta para você.'

/** "2 respostas não chegaram. Chame o professor.": o fim com a fila ainda pendente. */
export function textoDasQueNaoChegaram(quantas: number): string {
  return quantas === 1 ? '1 resposta não chegou. Chame o professor.' : `${String(quantas)} respostas não chegaram. Chame o professor.`
}

/** O que a lista "Tarefas" diz, depois do "Sair da prova", enquanto a fila não esvazia. */
export function textoDasQueAindaNaoChegaram(quantas: number): string {
  return quantas === 1 ? '1 resposta ainda não chegou' : `${String(quantas)} respostas ainda não chegaram`
}

/** O texto de uma falha ao abrir a prova ou ao tocar em "Começar": o limite por minuto pede para esperar, e o resto é "tente de novo". Nenhum código aparece (regra 50, item 12). */
export function textoDoErroDaProva(erro: unknown): string {
  return erro instanceof ApiError && erro.codigo === ErrorCode.LIMITE_EXCEDIDO ? TEXTO_DE_AGUARDE : TEXTO_DE_ERRO_AO_ABRIR_A_PROVA
}

/**
 * O texto do "Enviar" que não saiu: o 503, a queda e o prazo que estourou dizem que as respostas estão guardadas (o que é verdade: a fila as tem), e o limite por minuto pede para esperar. A atividade
 * encerrada nunca chega aqui: a tela a trata como o fim.
 */
export function textoDoEnvioQueFalhou(erro: unknown): string {
  return erro instanceof ApiError && erro.codigo === ErrorCode.LIMITE_EXCEDIDO ? TEXTO_DE_AGUARDE : TEXTO_DO_ENVIO_QUE_NAO_SAIU
}
