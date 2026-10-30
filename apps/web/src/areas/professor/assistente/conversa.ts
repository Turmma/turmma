import type { ErrorCode, MensagemDaConversa, MensagemDoAgente, PropostaDeFerramenta } from '@educa/shared'
import { emCurso, type CicloDeExecucao } from '../../../api/ciclo-de-execucao'
import type { EscolhaDaProposta, PedidoDaConversa } from './memoria-do-professor'

/**
 * O que a conversa mostra **além do que a API já devolveu** (`docs/interface.md` 11.3): o pedido que acabou de sair, o
 * "pensando", a resposta que a execução trouxe antes de a conversa ser lida de novo, e a falha. A conversa é da API;
 * isto é só o trecho que ainda não chegou nela, e some sozinho quando chega.
 */
export interface PendenteNaConversa {
  /** O pedido da professora, enquanto a conversa lida não o tem. */
  readonly pedido?: string
  /** A execução ainda não terminou: a tela mostra o "pensando". */
  readonly pensando: boolean
  /** A resposta do Assistente que a execução trouxe e a conversa lida ainda não tem. */
  readonly resposta?: MensagemDoAgente
  /** O pedido falhou: o código, que a tela troca pelo aviso certo. */
  readonly erro?: ErrorCode
}

/**
 * O que falta na conversa lida, pelo ciclo do pedido. **Nada aparece duas vezes**: o pedido que a API já gravou é a
 * última mensagem da conversa (ou a penúltima, seguida da resposta dele), e a resposta que já está na conversa não é
 * repetida. A professora que manda duas vezes o mesmo texto vê as duas: só a última mensagem conta como "já gravado".
 */
export function pendenteNaConversa(mensagens: readonly MensagemDaConversa[], ciclo: CicloDeExecucao<PedidoDaConversa> | undefined): PendenteNaConversa | undefined {
  if (ciclo === undefined) return undefined
  const resposta = ciclo.etapa === 'concluida' && ciclo.resultado.tipo === 'mensagem' ? ciclo.resultado.mensagem : undefined
  const posicaoDaResposta = resposta === undefined ? -1 : mensagens.findIndex((mensagem) => mensagem.id === resposta.id)
  // A resposta já está na conversa lida: o pedido também está, e não falta nada.
  if (posicaoDaResposta !== -1) return undefined
  if (ciclo.etapa === 'concluida' && resposta === undefined) return undefined
  const ultima = mensagens.at(-1)
  const pedidoJaGravado = ultima?.autor === 'usuario' && ultima.texto === ciclo.pedido.texto
  return {
    ...(pedidoJaGravado ? {} : { pedido: ciclo.pedido.texto }),
    pensando: emCurso(ciclo),
    ...(resposta === undefined ? {} : { resposta }),
    ...(ciclo.etapa === 'falhou' ? { erro: ciclo.erro } : {}),
  }
}

/** O que a professora "diz" ao escolher só conversar: é a fala dela na thread, como a tela a mostra. */
export const FALA_DE_SO_CONVERSAR = 'Só conversar'

/**
 * A resposta "só conversar" à pergunta da D18, como pedido ao Assistente: a mensagem seguinte dela, na turma e na
 * disciplina da proposta, **com a marca** que faz o Assistente responder em texto ao último pedido, sem propor a
 * ferramenta de novo. A marca é de lista fechada (`RESPOSTAS_A_PROPOSTA`): nada do que ela escreveu vai junto.
 */
export function pedidoDeSoConversar(proposta: PropostaDeFerramenta): PedidoDaConversa {
  return { texto: FALA_DE_SO_CONVERSAR, turmaId: proposta.parametros.turmaId, disciplinaId: proposta.parametros.disciplinaId, resposta: 'so_conversar' }
}

/** Um item da conversa na tela: uma mensagem (lida, ou a resposta que a execução trouxe) ou o pedido que ainda não foi lido de volta. */
export type ItemDaConversa = { readonly tipo: 'mensagem'; readonly mensagem: MensagemDaConversa } | { readonly tipo: 'pedido'; readonly texto: string }

/**
 * A conversa **na ordem em que aconteceu**: as mensagens lidas, depois o pedido que ainda não voltou da API e só então a
 * resposta que a execução trouxe. A pergunta vem sempre antes da resposta dela, também no intervalo em que as duas ainda
 * não foram lidas de volta: é nessa ordem que o registro da conversa anuncia ao leitor de tela.
 */
export function itensDaConversa(mensagens: readonly MensagemDaConversa[], pendente: PendenteNaConversa | undefined): ItemDaConversa[] {
  const itens: ItemDaConversa[] = mensagens.map((mensagem) => ({ tipo: 'mensagem', mensagem }))
  if (pendente?.pedido !== undefined) itens.push({ tipo: 'pedido', texto: pendente.pedido })
  if (pendente?.resposta !== undefined) itens.push({ tipo: 'mensagem', mensagem: pendente.resposta })
  return itens
}

/**
 * O que faz a conversa rolar até o fim: a última mensagem, o pedido no ar e a etapa dele. **As mensagens anteriores que
 * "Ver mensagens anteriores" traz não mudam nada disto**: quem foi ler o começo da conversa não é jogada para o fim.
 */
export function marcaDoFim(itens: readonly ItemDaConversa[], etapa: string | undefined): string {
  const ultimo = itens.at(-1)
  return `${ultimo === undefined ? '' : ultimo.tipo === 'mensagem' ? ultimo.mensagem.id : `pedido:${ultimo.texto}`}|${etapa ?? ''}`
}

/** As mensagens da conversa, com a resposta que a execução já trouxe: é por elas que a tela decide qual proposta pergunta. */
export function mensagensNaTela(mensagens: readonly MensagemDaConversa[], pendente: PendenteNaConversa | undefined): readonly MensagemDaConversa[] {
  return pendente?.resposta === undefined ? mensagens : [...mensagens, pendente.resposta]
}

/**
 * A proposta de ferramenta que ainda pergunta (D18): **só a última mensagem da conversa**, quando é uma proposta do
 * Assistente, a professora ainda não respondeu e não há pedido novo no ar. Proposta antiga não volta a perguntar: a
 * conversa seguiu dali.
 */
export function propostaQuePergunta(
  mensagens: readonly MensagemDaConversa[],
  escolhas: Readonly<Record<string, EscolhaDaProposta>>,
  ciclo: CicloDeExecucao<PedidoDaConversa> | undefined,
): string | undefined {
  const ultima = mensagens.at(-1)
  if (ultima === undefined || ultima.autor !== 'agente' || ultima.tipo !== 'proposta_de_ferramenta') return undefined
  if (escolhas[ultima.id] !== undefined || emCurso(ciclo)) return undefined
  return ultima.id
}
