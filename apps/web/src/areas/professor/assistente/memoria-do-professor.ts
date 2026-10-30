import type { Ferramenta, MensagemAoAssistenteRequest, ExecucaoAceitaResponse } from '@educa/shared'
import { adaptarArtefato } from '../artefatos/api/artefatos'
import { enviarMensagemAoAssistente } from './api/assistente'
import { emCurso, type CicloDeExecucao } from '../../../api/ciclo-de-execucao'
import { gerarComFerramenta } from '../ferramentas/api/ferramentas'
import { criarLugarNaAba, type LugarNaAba } from '../../../api/memoria-da-aba'
import type { IniciaisDaFerramenta, PedidoDeFerramenta } from '../ferramentas/ferramentas'

/**
 * O que as telas do Assistente lembram entre uma rota e outra (`api/memoria-da-aba.ts`): só em memória, e esvaziado com
 * a sessão. **A conversa não mora aqui**: ela é da API (`api/assistente.ts`). Aqui fica o que ainda não chegou lá — o
 * pedido que saiu e está sendo respondido — e o que é só da tela.
 */

/** A mensagem que a professora mandou ao Assistente, sem a `chaveEnvio`, que o ciclo sorteia. */
export type PedidoDaConversa = Omit<MensagemAoAssistenteRequest, 'chaveEnvio'>

/** O pedido ao Assistente que está no ar: sai da Home e é acompanhado na Conversa. */
export const CICLO_DA_CONVERSA = criarLugarNaAba<CicloDeExecucao<PedidoDaConversa>>()

export function enviarPedidoDaConversa(pedido: PedidoDaConversa, chaveEnvio: string): Promise<ExecucaoAceitaResponse> {
  return enviarMensagemAoAssistente({ ...pedido, chaveEnvio })
}

/**
 * A geração de cada ferramenta que está no ar, uma por ferramenta: o cartão dentro da conversa e o formulário de
 * Ferramentas olham o mesmo lugar, porque são o mesmo caso de uso (D18).
 */
export const CICLO_DA_FERRAMENTA: Readonly<Record<Ferramenta, LugarNaAba<CicloDeExecucao<PedidoDeFerramenta>>>> = {
  atividade_objetiva: criarLugarNaAba(),
  plano_de_aula: criarLugarNaAba(),
  adaptacao: criarLugarNaAba(),
}

/** O `POST` de cada ferramenta. Na Adaptação vão só os tipos e o tempo extra: o pedido não tem onde levar texto. */
export function enviarPedidoDeFerramenta(pedido: PedidoDeFerramenta, chaveEnvio: string): Promise<ExecucaoAceitaResponse> {
  if (pedido.ferramenta === 'adaptacao')
    return adaptarArtefato(pedido.artefatoId, { tipos: [...pedido.tipos], ...(pedido.tempoExtraPercentual === undefined ? {} : { tempoExtraPercentual: pedido.tempoExtraPercentual }), chaveEnvio })
  return gerarComFerramenta(pedido.ferramenta, { ...pedido.parametros, chaveEnvio })
}

/** A turma e a disciplina escolhidas na caixa de pedido (`turmas-da-professora.ts`): a Conversa abre com a mesma da Home. */
export const CONTEXTO_ESCOLHIDO = criarLugarNaAba<string>()

/** O cartão de ferramenta aberto dentro da conversa (11.3): qual ferramenta, e o que ela já sabe do pedido. */
export interface CartaoAberto {
  readonly ferramenta: Ferramenta
  readonly iniciais: IniciaisDaFerramenta
}
export const CARTAO_DA_CONVERSA = criarLugarNaAba<CartaoAberto>()

/**
 * Esquece a geração que já terminou (concluída ou falha) de uma ferramenta: o formulário que abre de novo começa em
 * branco, e não com o resultado do pedido anterior. A que ainda está no ar fica: é ela que o formulário vai mostrar.
 */
export function esquecerGeracaoTerminada(ferramenta: Ferramenta): void {
  const lugar = CICLO_DA_FERRAMENTA[ferramenta]
  if (!emCurso(lugar.ler())) lugar.guardar(undefined)
}

/** Abre o cartão de uma ferramenta dentro da conversa, com o que ela já sabe do pedido. */
export function abrirCartaoNaConversa(cartao: CartaoAberto): void {
  esquecerGeracaoTerminada(cartao.ferramenta)
  CARTAO_DA_CONVERSA.guardar(cartao)
}

/** O que a professora respondeu à pergunta da D18 em cada proposta, pelo id da mensagem: a proposta respondida não pergunta de novo. */
export type EscolhaDaProposta = 'ferramenta' | 'conversa'
export const ESCOLHAS_DAS_PROPOSTAS = criarLugarNaAba<Readonly<Record<string, EscolhaDaProposta>>>()
