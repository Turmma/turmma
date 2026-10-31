import { ErrorCode, MAXIMO_DE_PEDIDOS_POR_DECISAO, type DecisaoDePedido, type DecisorDaReivindicacao, type ResultadoDaDecisao } from '@educa/shared'
import { textoDaFalha } from '../error-text'
import { formatarQuantidade } from '../../format'

/**
 * O que a tela dos pedidos diz (A1, 16.0; RF12; W6): a marca da tentativa com matrícula errada, o limite de uma decisão,
 * o efeito de aprovar e de recusar antes de confirmar, o aviso de auditoria da coordenação e o resultado de cada pedido.
 * Sem React aqui, para os textos terem teste de unidade.
 */

/**
 * A marca do pedido cujo nome teve tentativa com outra matrícula: um fato sobre o pedido, nunca uma suspeita sobre o
 * aluno (regra 70, item 7; nota do `conformidade-reviewer` na 8.0). Sem número de tentativas e sem hora.
 */
export const TEXTO_DA_MATRICULA_ERRADA = 'Houve tentativa com matrícula errada neste nome; pode ter sido erro de digitação'

/** O que a seção diz antes de qualquer marca: como se decide, o limite, e que não existe aprovar tudo de uma vez. */
export const TEXTO_DE_COMO_DECIDIR = `Marque os pedidos que você conferiu para aprovar ou recusar, até ${String(MAXIMO_DE_PEDIDOS_POR_DECISAO)} por vez. Cada nome é conferido: não há como aprovar todos de uma vez.`

/** O texto do limite, quando os 40 estão marcados: é ele que explica por que os outros pedidos ficam desligados. */
export const TEXTO_DO_LIMITE = `Você marcou ${String(MAXIMO_DE_PEDIDOS_POR_DECISAO)} pedidos, o máximo de uma decisão. Decida estes para marcar os outros.`

/** Havendo mais pedidos que os de uma leitura: os próximos chegam quando estes forem decididos. */
export const TEXTO_DE_QUE_HA_MAIS = 'Há mais pedidos esperando do que os que aparecem aqui. Os próximos aparecem depois que estes forem decididos.'

/** "1 pedido", "3 pedidos". */
export function quantidadeDePedidos(quantos: number): string {
  return formatarQuantidade(quantos, 'pedido', 'pedidos')
}

/** O que a região viva diz quando a atualização traz pedidos: "1 pedido novo na lista.", "3 pedidos novos na lista.". */
export function textoDosNovos(quantos: number): string {
  return `${formatarQuantidade(quantos, 'pedido novo', 'pedidos novos')} na lista.`
}

/** O título do diálogo de cada decisão. Sem a quantidade: ela pode mudar com o diálogo aberto, e fica no texto. */
export const TITULO_DA_DECISAO: Readonly<Record<DecisaoDePedido, string>> = { aprovar: 'Aprovar pedidos', recusar: 'Recusar pedidos' }

const VERBO_DA_DECISAO: Readonly<Record<DecisaoDePedido, string>> = { aprovar: 'aprovar', recusar: 'recusar' }

/** O que abre o diálogo, com o foco: o que vai ser decidido, de quantos pedidos e de qual turma. */
export function textoDoQueVaiSerDecidido(decisao: DecisaoDePedido, quantos: number, turmaNome: string): string {
  return `Você vai ${VERBO_DA_DECISAO[decisao]} ${quantidadeDePedidos(quantos)} da turma ${turmaNome}.`
}

/** O efeito de cada decisão, dito antes de confirmar (regra 50, item 8). */
export const EFEITO_DA_DECISAO: Readonly<Record<DecisaoDePedido, string>> = {
  aprovar:
    'Cada pedido aprovado vira a conta do aluno: ele passa a entrar no Turmma com a matrícula da lista e a senha que criou, já nesta turma. Confira se cada nome é mesmo de um aluno da turma antes de aprovar.',
  recusar: 'Cada pedido recusado é fechado, e o nome volta à lista da turma, livre para ser pedido de novo. A senha criada no pedido é apagada.',
}

/** O aviso de auditoria, só para a coordenação (RF16; regra 20, item 10): a decisão fica registrada como dela. */
export const TEXTO_DA_AUDITORIA_DA_DECISAO = 'Esta decisão fica registrada na auditoria, em seu nome, como decisão da coordenação.'

/** O aviso de auditoria da leitura, junto do "Atualizar" da coordenação: por que a lista dela não se atualiza sozinha. */
export const TEXTO_DA_AUDITORIA_DA_LEITURA = 'Cada consulta aos pedidos fica registrada na auditoria, em seu nome. Por isso a lista só é lida quando você clica em Atualizar.'

/** O que a seção da coordenação mostra antes da primeira leitura: nada foi lido, e o que fazer. */
export const TEXTO_ANTES_DA_LEITURA = 'Clique em Atualizar para ver os pedidos que esperam a decisão nesta turma.'

/** O que o professor lê sobre a lista dele: ela se atualiza sem ele pedir. */
export const TEXTO_DA_ATUALIZACAO_SOZINHA = 'A lista se atualiza sozinha a cada 15 segundos, enquanto esta aba estiver à vista.'

const ROTULO_DA_DECISAO: Readonly<Record<DecisaoDePedido, string>> = { aprovar: 'Aprovar', recusar: 'Recusar' }

/** O botão de cada decisão, na seção e no diálogo ("Aprovar 3 pedidos"), e o mesmo com o pedido no ar. */
export function rotuloDaDecisao(decisao: DecisaoDePedido, quantos: number): string {
  return `${ROTULO_DA_DECISAO[decisao]} ${quantidadeDePedidos(quantos)}`
}
export const ROTULO_EM_ANDAMENTO: Readonly<Record<DecisaoDePedido, string>> = { aprovar: 'Aprovando…', recusar: 'Recusando…' }

/** Quando todos os pedidos do diálogo saíram da lista com ele aberto: outra pessoa decidiu antes, e nada foi enviado. */
export const TEXTO_DE_QUE_TODOS_SAIRAM = 'Os pedidos que você marcou não estão mais esperando: outra pessoa decidiu antes. Nada foi enviado.'

/** Quando parte deles saiu: o diálogo passa a mostrar só os que continuam. */
export function textoDosQueSairam(quantos: number): string {
  return `${formatarQuantidade(quantos, 'pedido saiu', 'pedidos saíram')} desta decisão: outra pessoa decidiu antes.`
}

/**
 * O resultado de cada pedido, em texto (W6). O `ja_decidida` e o `nao_encontrada` são os textos da Tech Spec; o
 * `decidida` diz o que a decisão fez com aquele nome.
 */
export function textoDoResultado(decisao: DecisaoDePedido, resultado: ResultadoDaDecisao): string {
  if (resultado === 'ja_decidida') return 'Já decidido por outra pessoa'
  if (resultado === 'nao_encontrada') return 'Este pedido não está mais disponível'
  return decisao === 'aprovar' ? 'Aprovado: já pode entrar com a matrícula e a senha' : 'Recusado: o nome voltou à lista'
}

/**
 * O que a lista faz depois de uma decisão que falhou: um erro no meio do lote não desfaz os pedidos já decididos, e a
 * resposta não diz quais (nota da 8.0). A do professor foi relida; a da coordenação saiu da tela, e volta no "Atualizar".
 */
const DEPOIS_DA_FALHA: Readonly<Record<DecisorDaReivindicacao, string>> = {
  professor: 'Alguns pedidos podem já ter sido decididos: a lista foi atualizada, e os que continuam aqui ainda esperam.',
  coordenacao: 'Alguns pedidos podem já ter sido decididos. Feche e clique em Atualizar para ver os que continuam esperando.',
}

/** O `NAO_ENCONTRADO` da rota inteira: a escola ficou sem ano letivo em curso, e nenhum pedido pode ser decidido. */
const TEXTOS_DA_FALHA_DA_DECISAO: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.NAO_ENCONTRADO]: 'Os pedidos desta turma não podem ser decididos agora: a escola está sem ano letivo em curso.',
}

/** A falha da decisão, com o que fazer: o texto do erro e o que aconteceu com a lista. Nenhum texto diz o código do erro. */
export function textoDaFalhaDaDecisao(erro: unknown, quem: DecisorDaReivindicacao): string {
  return `${textoDaFalha(erro, TEXTOS_DA_FALHA_DA_DECISAO)} ${DEPOIS_DA_FALHA[quem]}`
}
