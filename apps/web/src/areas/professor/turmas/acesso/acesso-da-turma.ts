import { ErrorCode, exibirCodigoDaTurma, type ValidadeDoAcessoDias } from '@educa/shared'
import { ErroDaApi } from '../../../../api/cliente'
import type { DitosDaCopia } from '../../../../componentes/copia-unica'
import { listaMudou, textoDaFalha } from '../../../../componentes/texto-da-falha'
import { formatarQuantidade } from '../../../../formatar'
import { enderecoDaAba } from '../endereco-da-turma'

/**
 * O acesso da turma na tela do professor (A1, 15.0; RF9): a validade que a tela propõe, o que cada ação diz antes de
 * confirmar e o texto de cada falha. Sem React aqui, para a regra ter teste de unidade.
 */

/** A validade que o diálogo traz escolhida: uma semana. A API não tem padrão; quem propõe é a tela (Tech Spec, seção 4). */
export const VALIDADE_PADRAO_DO_ACESSO_DIAS: ValidadeDoAcessoDias = 7

/** "1 dia", "7 dias", "30 dias". */
export function rotuloDaValidade(dias: ValidadeDoAcessoDias): string {
  return formatarQuantidade(dias, 'dia', 'dias')
}

/**
 * O código como a tela o projeta, em dois grupos de quatro: é o `exibirCodigoDaTurma` de `packages/shared`, a mesma função
 * da página do aluno. A tela não refaz o agrupamento.
 */
export const codigoEmDoisGrupos = exibirCodigoDaTurma

/** O código para o leitor de tela, caractere a caractere, com a pausa entre os dois grupos: "A B C D, 2 3 4 5". */
export function codigoSoletrado(codigo: string): string {
  return codigoEmDoisGrupos(codigo)
    .split(' ')
    .map((grupo) => [...grupo].join(' '))
    .join(', ')
}

/**
 * O que a seção e o passo "Acesso vigente" dizem do acesso que já existe: o link e o código apareceram uma vez, quando foram
 * gerados, e a leitura não os devolve. Quem os perdeu gera um acesso novo.
 */
export const TEXTO_DO_ACESSO_QUE_JA_APARECEU = 'O link e o código apareceram uma vez, quando foram gerados. Se eles não estão mais com você, gere um novo acesso.'

/**
 * O parâmetro do endereço que abre o "Convidar alunos" na aba Alunos (`?aba=alunos&convidar=1`; telas do professor, 13.0; RF19). Só
 * este valor fixo vai ao endereço: o token, o link e o código nunca (regra 20, item 8).
 */
export const PARAMETRO_DO_CONVITE = 'convidar'

/** O endereço pede o "Convidar alunos"? Só o valor `1`: qualquer outro texto no parâmetro não abre nada. */
export function convitePedido(busca: string): boolean {
  return new URLSearchParams(busca).get(PARAMETRO_DO_CONVITE) === '1'
}

/** O endereço da aba Alunos de uma turma com o "Convidar alunos" pedido: para onde "Gerar o acesso" leva depois de confirmar a turma. */
export function enderecoDoConvite(caminhoDaTurma: string): string {
  return `${enderecoDaAba(caminhoDaTurma, 'alunos')}&${PARAMETRO_DO_CONVITE}=1`
}

/** O mesmo endereço sem o pedido, para quando o diálogo fecha: o resto da busca (a aba) fica, e sem busca nenhuma o caminho vai só. */
export function enderecoSemOConvite(caminho: string, busca: string): string {
  const parametros = new URLSearchParams(busca)
  parametros.delete(PARAMETRO_DO_CONVITE)
  const restante = parametros.toString()
  return restante === '' ? caminho : `${caminho}?${restante}`
}

/** O que o primeiro acesso da turma faz, antes de gerar. */
export const TEXTO_DO_ACESSO_NOVO = 'O link da sala e o código da turma levam os alunos à lista de nomes desta turma, onde cada um pede o próprio nome. Quem aprova é você.'

/**
 * O que "Gerar novo" faz, antes de confirmar (regra 50, item 8): o acesso de agora cai na hora, também o que outro
 * professor da turma gerou (a turma tem um acesso só), e o contador de matrícula errada de cada nome, que é por acesso,
 * recomeça.
 */
export const TEXTO_DO_ACESSO_QUE_CAI =
  'O link e o código de agora deixam de valer na hora, também se quem gerou foi outro professor ou outra professora da turma. Os nomes que ficaram travados por tentativas com a matrícula errada destravam.'

/** O que é dito do link e do código, antes de gerar: aparecem uma vez só. */
export const TEXTO_DO_ACESSO_UMA_VEZ = 'O link e o código aparecem uma vez, logo depois de gerar. Projete o código ou mande o link antes de fechar.'

/**
 * O que a professora precisa saber antes de mandar o link: ele é de uso múltiplo, e quem o tem (ou tem o código) vê os
 * nomes livres da turma; a revogação que ela tem à mão; e o que o WhatsApp leva, que é só a escola e o link (regra 20,
 * item 8; P27).
 */
export const TEXTO_DE_QUEM_VE_A_LISTA =
  'Quem tem o link ou o código vê os nomes da lista que ainda estão livres: mande só para a turma. Se o link ou o código forem parar onde não deviam, gere um novo acesso, e os anteriores deixam de valer na hora. Pelo WhatsApp vão o nome da escola e o link, sem nome de aluno.'

/** O WhatsApp abriu na aba nova: o convite saiu pela mão da professora. */
export const TEXTO_DO_WHATSAPP_ABERTO = 'O WhatsApp abriu em outra aba, com o convite pronto para mandar.'

/**
 * Sem o WhatsApp (o navegador não abriu a aba nova): o que o mesmo botão diz quando copia o texto do convite e, sem área
 * de transferência, quando só consegue selecionar o link. "Aqui", e não "neste computador": a tela abre no celular também.
 */
export const DITOS_DO_CONVITE_SEM_WHATSAPP: DitosDaCopia = {
  copiado: 'O WhatsApp não abriu aqui. O texto do convite foi copiado: cole onde a turma conversa.',
  selecionado: 'O WhatsApp não abriu aqui. O link está selecionado no campo: copie com Ctrl+C, ou toque e segure no campo e escolha Copiar.',
}

/** O que revogar faz, antes de confirmar: ninguém mais entra pelo link nem pelo código, e os pedidos já feitos ficam. */
export const TEXTO_DO_REVOGAR =
  'O link da sala e o código da turma deixam de valer na hora: quem ainda não pediu o nome não entra mais por eles. Os pedidos já feitos continuam esperando a decisão. Para os alunos voltarem a entrar, gere um novo acesso.'

/** A pergunta de fechar sem copiar: o link e o código aparecem uma vez, e sem eles só gerando outro acesso. */
export function textoDaPerguntaDeFechar(noAr: boolean): string {
  return noAr
    ? 'O acesso ainda está sendo gerado, e o link e o código aparecem uma vez só, aqui. Se fechar agora, eles não aparecem, e para os alunos entrarem será preciso gerar um novo acesso.'
    : 'O link e o código aparecem uma vez só. Se fechar agora, eles não aparecem de novo, e para os alunos entrarem será preciso gerar um novo acesso.'
}

/**
 * A turma que a API não acha para este professor (`NAO_ENCONTRADO`): o vínculo não está confirmado ou foi encerrado, a
 * turma foi excluída, ou o ano letivo virou. A API responde igual nos quatro casos e para a turma que não existe (regra
 * 10, item 6), e a tela diz uma coisa só, com a quem recorrer. "Tentar de novo" não mudaria nada.
 */
export const TEXTO_DA_TURMA_INDISPONIVEL =
  'Esta turma não está disponível para você agora: o seu vínculo com ela pode não estar confirmado, ou ela saiu do ano letivo em curso. Volte para Turmas; se ela deveria estar lá, fale com a coordenação.'

export function turmaIndisponivel(erro: unknown): boolean {
  return erro instanceof ErroDaApi && erro.codigo === ErrorCode.NAO_ENCONTRADO
}

/** A falha do gerar: o texto, e se o que a seção mostrava deixou de valer (aí ela recarrega, e o diálogo só oferece "Fechar"). */
export interface FalhaDoAcesso {
  readonly texto: string
  readonly secaoMudou: boolean
}

/** O `CONFLITO` do gerar: outro gerar chegou ao mesmo tempo (outro professor da turma, ou outra aba), e é o dele que vale. */
const TEXTO_DO_ACESSO_GERADO_EM_OUTRO_LUGAR =
  'Outro acesso para esta turma acabou de ser gerado, por outra pessoa ou em outra aba, e é ele que vale. A tela foi atualizada: se o link e o código não estão com você, gere um novo.'

/**
 * O que o gerar diz quando a API recusa: o `CONFLITO` e o `NAO_ENCONTRADO` mudam o que a seção mostra; o resto (503, 429)
 * fica com o texto do catálogo, e o mesmo botão tenta de novo. Nenhum texto diz o código do erro.
 */
export function falhaDoGerarAcesso(erro: unknown): FalhaDoAcesso {
  return {
    texto: textoDaFalha(erro, { [ErrorCode.CONFLITO]: TEXTO_DO_ACESSO_GERADO_EM_OUTRO_LUGAR, [ErrorCode.NAO_ENCONTRADO]: TEXTO_DA_TURMA_INDISPONIVEL }),
    secaoMudou: listaMudou(erro, [ErrorCode.CONFLITO, ErrorCode.NAO_ENCONTRADO]),
  }
}

/**
 * O `NAO_ENCONTRADO` do revogar: não há mais acesso vigente (venceu, ou outra pessoa revogou antes), ou a turma saiu do
 * alcance. A seção recarrega e mostra qual dos dois.
 */
export const TEXTOS_DA_FALHA_DO_REVOGAR: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.NAO_ENCONTRADO]: 'Esta turma já não tem acesso ativo. A tela foi atualizada.',
}
