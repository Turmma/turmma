import { ErrorCode, MAXIMO_DE_QUESTOES_POR_ATIVIDADE, MENSAGENS_DE_ERRO, type MensagemDoTutor, type MensagemDoTutorAoAluno, type MensagemAoTutorRequest, type ConversaDoTutorResponse } from '@educa/shared'
import { aparenciaDaFalha, emCurso, type CicloDeExecucao } from '../../api/ciclo-de-execucao'

/**
 * O que a tela do Tutor mostra (MVP, A4; `docs/interface.md` 11.6; D8, D36, D38, D47, D58, D59). Aqui mora a regra, sem
 * tela e sem rede. **Quem decide o estado do Tutor é o servidor**; a tela só o diz, com calma: pausado em avaliação e no
 * limite do dia são avisos que explicam, e nunca erro.
 */

/** A faixa fixa do topo, que não fecha (D8; regra 70, item 4). */
export const TEXTO_DA_SUPERVISAO = 'Quem dá a aula acompanha como você usa o Tutor.'

/** A mensagem que o aluno mandou ao Tutor, sem a `chaveEnvio`, que o ciclo sorteia. */
export type PedidoAoTutor = Omit<MensagemAoTutorRequest, 'chaveEnvio'>

export interface UsoDoDia {
  /** "Hoje: 12 de 60 perguntas", em texto. */
  readonly rotulo: string
  /** O que falta, dito com calma: "faltam 48", ou "por hoje acabou". */
  readonly resto: string
  /** O valor da barra, preso ao limite: a barra não passa do fim. */
  readonly valor: number
  readonly maximo: number
}

/**
 * O uso do dia, **em texto** (D38, D59): quanto já foi e o ponto de parada, sem esconder nem dramatizar. A barra que
 * acompanha é a `ProgressBar`, neutra sempre; aqui não há cor, e o texto do fim não é alarme.
 */
export function usoDoDia(uso: ConversaDoTutorResponse['uso']): UsoDoDia {
  const hoje = Math.min(Math.max(uso.hoje, 0), uso.limiteDoDia)
  const faltam = uso.limiteDoDia - hoje
  return {
    rotulo: `Hoje: ${String(hoje)} de ${String(uso.limiteDoDia)} ${uso.limiteDoDia === 1 ? 'pergunta' : 'perguntas'}`,
    resto: faltam === 0 ? 'por hoje acabou' : faltam === 1 ? 'falta 1' : `faltam ${String(faltam)}`,
    valor: hoje,
    maximo: uso.limiteDoDia,
  }
}

/**
 * Por que o Tutor não responde agora, quando não responde:
 * - `avaliacao`: há avaliação aberta para a turma; ele volta quando a professora encerrar.
 * - `limite_do_dia`: o aluno fez as perguntas de hoje; amanhã volta.
 * - `pacote_do_mes`: a turma usou as perguntas do mês.
 * - `fora`: a escola deixou o Tutor desligado neste horário.
 * - `suspenso`: a coordenação suspendeu o Tutor na escola.
 */
export type PausaDoTutor = 'avaliacao' | 'limite_do_dia' | 'pacote_do_mes' | 'fora' | 'suspenso'

export interface AvisoDaPausa {
  readonly pausa: PausaDoTutor
  readonly titulo: string
  readonly texto: string
}

/** O que cada pausa diz: o que houve, e quando ou com quem isso muda. Sem culpa e sem ponto de exclamação. */
export function avisoDaPausa(pausa: PausaDoTutor, contexto: { readonly avaliacao?: string | undefined; readonly limiteDoDia?: number | undefined } = {}): AvisoDaPausa {
  if (pausa === 'avaliacao')
    return {
      pausa,
      titulo: 'O Tutor está pausado durante a avaliação.',
      texto: `${contexto.avaliacao === undefined ? 'A sua turma tem uma avaliação aberta agora.' : `A sua turma tem uma avaliação aberta agora: ${contexto.avaliacao}.`} Ele volta quando quem dá a aula encerrar.`,
    }
  if (pausa === 'limite_do_dia')
    return {
      pausa,
      titulo: 'Por hoje acabou.',
      texto: `${contexto.limiteDoDia === undefined ? 'Você fez as perguntas de hoje.' : `Você fez as ${String(contexto.limiteDoDia)} perguntas de hoje.`} Amanhã o Tutor volta. As suas atividades continuam abertas.`,
    }
  if (pausa === 'pacote_do_mes')
    return { pausa, titulo: 'As perguntas deste mês acabaram.', texto: 'A sua turma usou todas as perguntas ao Tutor deste mês. Se precisar de ajuda na atividade, chame quem dá a aula.' }
  if (pausa === 'fora') return { pausa, titulo: 'O Tutor está desligado agora.', texto: 'A sua escola escolhe os horários em que ele funciona. Não é um erro. As suas atividades continuam abertas.' }
  return { pausa, titulo: 'O Tutor está pausado na sua escola.', texto: 'A coordenação pausou o Tutor por enquanto. Não é um erro, e não é com você. Se precisar de ajuda na atividade, chame quem dá a aula.' }
}

/** A pausa que o estado da conversa diz. No `limite`, é o do dia quando o aluno chegou nele; senão, é o pacote da turma. */
export function pausaDoEstado(conversa: Pick<ConversaDoTutorResponse, 'estado' | 'uso'>): PausaDoTutor | undefined {
  if (conversa.estado === 'ligado') return undefined
  if (conversa.estado === 'avaliacao') return 'avaliacao'
  if (conversa.estado === 'fora') return 'fora'
  return conversa.uso.hoje >= conversa.uso.limiteDoDia ? 'limite_do_dia' : 'pacote_do_mes'
}

/** A pausa que a recusa de um envio diz, pelo código. Os outros códigos não são pausa. */
export function pausaDoErro(erro: ErrorCode): PausaDoTutor | undefined {
  if (erro === ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO) return 'avaliacao'
  if (erro === ErrorCode.LIMITE_DIARIO_DO_TUTOR) return 'limite_do_dia'
  if (erro === ErrorCode.PACOTE_DO_TUTOR_ESGOTADO) return 'pacote_do_mes'
  if (erro === ErrorCode.FUNCAO_SUSPENSA) return 'suspenso'
  return undefined
}

/**
 * Como a falha de uma pergunta aparece (regra 80, item 4: nunca erro cru para o aluno):
 * - `pausa`: o servidor recusou porque o Tutor está pausado. A tela mostra o aviso do estado, e não erro.
 * - `tentar`: o modelo não respondeu, ou a rede caiu. A pergunta fica na conversa, com "Tentar de novo".
 * - `esperar`: perguntas demais em pouco tempo. Também fica, com o aviso de esperar um pouco.
 * - `explicada`: outra recusa. A mensagem do catálogo diz o que fazer.
 */
export type FalhaDaPergunta =
  | { readonly tipo: 'pausa'; readonly pausa: PausaDoTutor }
  | { readonly tipo: 'tentar'; readonly texto: string }
  | { readonly tipo: 'esperar'; readonly texto: string }
  | { readonly tipo: 'explicada'; readonly texto: string }

export const TEXTO_DA_FALHA_DO_TUTOR = 'O Tutor não conseguiu responder agora. Tente de novo.'
export const TEXTO_DE_ESPERAR_UM_POUCO = 'Você mandou muitas perguntas em pouco tempo. Espere um minuto e tente de novo: a sua pergunta continua aqui.'

export function falhaDaPergunta(erro: ErrorCode): FalhaDaPergunta {
  const pausa = pausaDoErro(erro)
  if (pausa !== undefined) return { tipo: 'pausa', pausa }
  const aparencia = aparenciaDaFalha(erro)
  if (aparencia === 'fila') return { tipo: 'tentar', texto: TEXTO_DA_FALHA_DO_TUTOR }
  if (aparencia === 'limite') return { tipo: 'esperar', texto: TEXTO_DE_ESPERAR_UM_POUCO }
  return { tipo: 'explicada', texto: MENSAGENS_DE_ERRO[erro] }
}

/**
 * O que a conversa mostra **além do que a API já devolveu**: a pergunta que acabou de sair, o "preparando", a resposta
 * que a execução trouxe antes de a conversa ser lida de novo, e a falha. A conversa é da API; isto é só o trecho que
 * ainda não chegou nela.
 */
export interface PendenteNoTutor {
  /** A pergunta do aluno, enquanto a conversa lida não a tem. */
  readonly pergunta?: string
  readonly pensando: boolean
  readonly resposta?: MensagemDoTutorAoAluno
  readonly falha?: FalhaDaPergunta
}

/**
 * O que falta na conversa lida, pelo ciclo da pergunta. **Só vale para a conversa da atividade em que a pergunta foi
 * feita**, e nada aparece duas vezes: a pergunta que a API já gravou é a última mensagem da conversa, e a resposta que já
 * está na conversa não é repetida.
 */
export function pendenteNoTutor(mensagens: readonly MensagemDoTutor[], ciclo: CicloDeExecucao<PedidoAoTutor> | undefined, atividadeAplicadaId: string): PendenteNoTutor | undefined {
  if (ciclo === undefined || ciclo.pedido.atividadeAplicadaId !== atividadeAplicadaId) return undefined
  const resposta = ciclo.etapa === 'concluida' && ciclo.resultado.tipo === 'mensagem_do_tutor' ? ciclo.resultado.mensagem : undefined
  if (resposta !== undefined && mensagens.some((mensagem) => mensagem.id === resposta.id)) return undefined
  if (ciclo.etapa === 'concluida' && resposta === undefined) return undefined
  const ultima = mensagens.at(-1)
  const perguntaJaGravada = ultima?.autor === 'aluno' && ultima.texto === ciclo.pedido.texto
  return {
    ...(perguntaJaGravada ? {} : { pergunta: ciclo.pedido.texto }),
    pensando: emCurso(ciclo),
    ...(resposta === undefined ? {} : { resposta }),
    ...(ciclo.etapa === 'falhou' ? { falha: falhaDaPergunta(ciclo.erro) } : {}),
  }
}

/** Um item da conversa na tela: uma mensagem (lida ou trazida pela execução) ou a pergunta que a API ainda não devolveu. */
export type ItemDoTutor = { readonly tipo: 'mensagem'; readonly mensagem: MensagemDoTutor } | { readonly tipo: 'pergunta'; readonly texto: string }

/**
 * A conversa **na ordem em que aconteceu**: as mensagens lidas, depois a pergunta que ainda não voltou da API e só então a
 * resposta que a execução trouxe. A pergunta vem sempre antes da resposta dela, também quando a execução termina antes de
 * a conversa ser relida (a mensagem com o 188 inclusive): é nessa ordem que o registro anuncia ao leitor de tela.
 */
export function itensDoTutor(mensagens: readonly MensagemDoTutor[], pendente: PendenteNoTutor | undefined): ItemDoTutor[] {
  const itens: ItemDoTutor[] = mensagens.map((mensagem) => ({ tipo: 'mensagem', mensagem }))
  if (pendente?.pergunta !== undefined) itens.push({ tipo: 'pergunta', texto: pendente.pergunta })
  if (pendente?.resposta !== undefined) itens.push({ tipo: 'mensagem', mensagem: pendente.resposta })
  return itens
}

/**
 * O que faz a conversa rolar até o fim: o último item, a etapa da pergunta e a pausa. **As mensagens anteriores que "Ver
 * mensagens anteriores" traz não mudam nada disto**: quem foi ler o começo da conversa não é jogado para o fim.
 */
export function marcaDoFim(itens: readonly ItemDoTutor[], etapa: string | undefined, pausa: string | undefined): string {
  const ultimo = itens.at(-1)
  return `${ultimo === undefined ? '' : ultimo.tipo === 'mensagem' ? ultimo.mensagem.id : `pergunta:${ultimo.texto}`}|${etapa ?? ''}|${pausa ?? ''}`
}

/** A conversa como a tela a desenha: a lida, mais a resposta que a execução já trouxe. */
export function mensagensNaTela(mensagens: readonly MensagemDoTutor[], pendente: PendenteNoTutor | undefined): readonly MensagemDoTutor[] {
  return pendente?.resposta === undefined ? mensagens : [...mensagens, pendente.resposta]
}

/**
 * A pausa que a tela mostra: **a que a última pergunta recebeu do servidor vem antes** da que a conversa lida diz, porque
 * é mais nova (a professora abriu a avaliação depois de a tela ler a conversa).
 */
export function pausaNaTela(conversa: Pick<ConversaDoTutorResponse, 'estado' | 'uso'> | undefined, pendente: PendenteNoTutor | undefined): PausaDoTutor | undefined {
  if (pendente?.falha?.tipo === 'pausa') return pendente.falha.pausa
  return conversa === undefined ? undefined : pausaDoEstado(conversa)
}

/**
 * A recusa por pausa que já não vale: a conversa foi lida **depois** dela e diz que o Tutor está ligado (a professora
 * encerrou a avaliação, o dia virou). Sem isto, o aviso da recusa ficaria na tela até o aluno escrever de novo, e ele não
 * escreveria, porque o aviso diz que está pausado. A suspensão pela escola não aparece na conversa lida, e por isso fica.
 */
export function recusaVencida(pausaRecusada: PausaDoTutor | undefined, pausaLida: PausaDoTutor | undefined, lidaDepoisDaRecusa: boolean): boolean {
  if (pausaRecusada === undefined || pausaRecusada === 'suspenso') return false
  return lidaDepoisDaRecusa && pausaLida === undefined
}

/** O telefone do CVV (D36). */
export const TELEFONE_DO_CVV = '188'

/** O que a tela acrescenta quando a mensagem fixa não traz o número: ele está sempre lá, para ligar ou copiar. */
export const LINHA_DO_CVV = { antes: 'Se você estiver em perigo ou pensando em se machucar, ligue ', depois: ' (CVV). A ligação é gratuita e funciona a qualquer hora.' } as const

export type ParteDoEncaminhamento = { readonly tipo: 'texto'; readonly texto: string } | { readonly tipo: 'telefone'; readonly numero: string }

/**
 * A mensagem fixa de assunto delicado (D36), em parágrafos, com o **188 separado do texto**: a tela o desenha como texto
 * selecionável e link `tel:`. O texto é o que a API mandou, palavra por palavra; aqui ele só é partido onde o número
 * aparece sozinho (o "188" dentro de outro número não é telefone).
 */
export function partesDoEncaminhamento(texto: string): readonly (readonly ParteDoEncaminhamento[])[] {
  return texto
    .split(/\n{2,}/)
    .map((paragrafo) => paragrafo.trim())
    .filter((paragrafo) => paragrafo !== '')
    .map((paragrafo) =>
      paragrafo
        .split(/(?<!\d)(188)(?!\d)/)
        .filter((pedaco) => pedaco !== '')
        .map((pedaco): ParteDoEncaminhamento => (pedaco === TELEFONE_DO_CVV ? { tipo: 'telefone', numero: pedaco } : { tipo: 'texto', texto: pedaco })),
    )
}

/** A mensagem já traz o telefone? Se não traz, a tela acrescenta a linha dele. */
export function temTelefone(paragrafos: readonly (readonly ParteDoEncaminhamento[])[]): boolean {
  return paragrafos.some((paragrafo) => paragrafo.some((parte) => parte.tipo === 'telefone'))
}

/** A questão em que o aluno estava, pelo endereço (`?questao=3`): só um número de questão que existe; o resto é ignorado. */
export function questaoDoEndereco(consulta: string): number | undefined {
  const valor = new URLSearchParams(consulta).get('questao')
  if (valor === null || !/^\d{1,2}$/.test(valor)) return undefined
  const numero = Number(valor)
  return numero >= 1 && numero <= MAXIMO_DE_QUESTOES_POR_ATIVIDADE ? numero : undefined
}
