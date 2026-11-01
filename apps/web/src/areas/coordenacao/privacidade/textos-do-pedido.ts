import {
  ErrorCode,
  ESTADOS_ABERTOS_DO_PEDIDO,
  MAXIMO_DO_NOME_DO_TITULAR,
  type FINALIDADES_DO_ARQUIVO_DA_ESCOLA,
  PRAZO_DA_ELIMINACAO_DIAS,
  TIPOS_DE_PEDIDO_COM_ARQUIVO,
  VALIDADE_DO_ARQUIVO_DIAS,
  type CompartilhamentoRow,
  type OrigemDoCompartilhamento,
  type PedidoDoTitular,
  type SuboperadorDaEscola,
} from '@educa/shared'
import type { StatusFamily } from '../../../components/ui/StatusBadge'
import { formatarDiaDoInstante } from '../../../format'
import { TEXTO_DO_HOMONIMO } from './textos-dos-pedidos'

/**
 * Os textos e as regras sem React do detalhe do pedido do titular (F3, 17.0; RF12, RF13, RF13b, RF14 e RF16; Tech Spec do
 * F3, seção 9): o prazo, o que cada pedido deixa fazer, o que cada diálogo diz antes de confirmar (regra 50, item 8), o
 * texto de cada falha e a lista das empresas. Aqui para cada regra ter teste de unidade, e para a tela só desenhar.
 */

/**
 * Quantos dias a escola tem para a declaração completa, contados da **chegada** do pedido (LGPD, art. 19, II; RF16). É
 * constante e mora num lugar só: a ANPD pode regulamentá-lo, e o prazo da tela muda junto.
 */
export const PRAZO_DA_DECLARACAO_COMPLETA_DIAS = 15

const DIA_EM_MS = 86_400_000

function emMilissegundos(dia: string): number {
  return Date.parse(`${dia}T00:00:00Z`)
}

/** `AAAA-MM-DD` mais `dias`, em UTC: dia de calendário não tem hora de verão, e o fuso do computador não entra. */
export function somarDias(dia: string, dias: number): string {
  return new Date(emMilissegundos(dia) + dias * DIA_EM_MS).toISOString().slice(0, 10)
}

/** Quantos dias de calendário vão de `de` até `ate` (negativo quando `ate` é anterior). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((emMilissegundos(ate) - emMilissegundos(de)) / DIA_EM_MS)
}

/** `2026-10-20` → `20/10/2026`: o dia de calendário, sem passar por fuso (`formatarData` o escreve por extenso). */
export function diaCurto(dia: string): string {
  const [ano, mes, diaDoMes] = dia.split('-')
  return `${diaDoMes}/${mes}/${ano}`
}

/**
 * O prazo da declaração completa de um pedido (RF16). O pedido que terminou não tem prazo a cumprir; o aberto tem o dia
 * em que vence e quantos dias faltam, ou quantos passaram.
 */
export type PrazoDoPedido =
  | {
      readonly situacao: 'aberto'
      readonly ate: string
      readonly faltam: number
    }
  | {
      readonly situacao: 'vencido'
      readonly ate: string
      readonly atraso: number
    }
  | { readonly situacao: 'concluido' }
  | { readonly situacao: 'cancelado' }

/** O prazo do pedido a partir da chegada, olhado no dia `hoje` (`AAAA-MM-DD`, o de São Paulo). O dia do vencimento ainda é prazo. */
export function prazoDoPedido(pedido: Pick<PedidoDoTitular, 'chegouEm' | 'estado'>, hoje: string): PrazoDoPedido {
  if (pedido.estado === 'concluido') return { situacao: 'concluido' }
  if (pedido.estado === 'cancelado') return { situacao: 'cancelado' }
  const ate = somarDias(pedido.chegouEm, PRAZO_DA_DECLARACAO_COMPLETA_DIAS)
  const faltam = diasEntre(hoje, ate)
  return faltam >= 0 ? { situacao: 'aberto', ate, faltam } : { situacao: 'vencido', ate, atraso: -faltam }
}

const dias = (quantidade: number): string => `${String(quantidade)} ${quantidade === 1 ? 'dia' : 'dias'}`

/**
 * O prazo em texto e a família do selo. O vencido é `erro` e diz **vencido há N dias**, com o ícone do selo: estado nunca
 * é só cor (regra 50, item 11). O que ainda vale é `pendente`, e o dia em que vence é dito por inteiro.
 */
export function textoDoPrazo(prazo: PrazoDoPedido): {
  readonly familia: StatusFamily
  readonly texto: string
} {
  switch (prazo.situacao) {
    case 'concluido':
      return {
        familia: 'ok',
        texto: 'Pedido concluído: não há prazo a cumprir',
      }
    case 'cancelado':
      return {
        familia: 'info',
        texto: 'Pedido cancelado: não há prazo a cumprir',
      }
    case 'vencido':
      return {
        familia: 'erro',
        texto: `Prazo vencido há ${dias(prazo.atraso)} (venceu em ${diaCurto(prazo.ate)})`,
      }
    case 'aberto':
      if (prazo.faltam === 0)
        return {
          familia: 'pendente',
          texto: `O prazo vence hoje, ${diaCurto(prazo.ate)}`,
        }
      return {
        familia: 'pendente',
        texto: `${prazo.faltam === 1 ? 'Falta' : 'Faltam'} ${dias(prazo.faltam)}, até ${diaCurto(prazo.ate)}`,
      }
  }
}

/** O que a coordenação pode fazer com o pedido, de acordo com o tipo e com o estado dele (as mesmas regras da API, seção 4). */
export interface AcoesDoPedido {
  readonly concluir: boolean
  readonly cancelar: boolean
  readonly corrigirNome: boolean
  readonly baixar: boolean
}

/**
 * - **Concluir**: acesso, portabilidade, compartilhamento e correção, enquanto abertos. A eliminação não conclui pela tela: o
 *   job a conclui depois dos 7 dias (15.0). Vale também para o pedido ainda em preparação: a pessoa eliminada depois de
 *   pedir deixa o arquivo sem montar, e é a coordenação que o conclui.
 * - **Cancelar**: só a eliminação agendada.
 * - **Corrigir nome**: só o pedido de correção `recebido` ou `pronto`, e enquanto a pessoa ainda existe.
 * - **Baixar a versão da escola**: o acesso e a portabilidade com o arquivo pronto.
 */
export function acoesDoPedido(pedido: Pick<PedidoDoTitular, 'tipo' | 'estado' | 'titular'>): AcoesDoPedido {
  const aberto = (ESTADOS_ABERTOS_DO_PEDIDO as readonly string[]).includes(pedido.estado)
  return {
    concluir: pedido.tipo !== 'eliminacao' && aberto,
    cancelar: pedido.tipo === 'eliminacao' && pedido.estado === 'agendado',
    corrigirNome: pedido.tipo === 'correcao' && (pedido.estado === 'recebido' || pedido.estado === 'pronto') && pedido.titular !== null,
    baixar: (TIPOS_DE_PEDIDO_COM_ARQUIVO as readonly string[]).includes(pedido.tipo) && pedido.estado === 'pronto',
  }
}

/**
 * O que a coordenação faz com este pedido, numa frase, conforme o tipo e o estado: é o que diz o que esperar de cada seção
 * do detalhe (a versão da escola só existe sem conta ativa; a eliminação cancela nos 7 dias).
 */
export function orientacaoDoPedido(pedido: Pick<PedidoDoTitular, 'tipo' | 'estado'>): string | undefined {
  switch (pedido.tipo) {
    case 'acesso':
    case 'portabilidade':
      if (pedido.estado === 'em_preparacao') return 'Estamos preparando o arquivo. Esta página se atualiza sozinha enquanto estiver à vista: não é preciso recarregar.'
      if (pedido.estado === 'pronto') {
        return `O arquivo está pronto e fica disponível por ${String(VALIDADE_DO_ARQUIVO_DIAS)} dias. A pessoa o baixa na área dela, em Meus dados. A versão da escola só existe quando a pessoa já não tem conta ativa nesta escola.`
      }
      return undefined
    case 'compartilhamento':
      return pedido.estado === 'recebido'
        ? 'A resposta a este pedido é a lista abaixo, das empresas por onde passou dado da pessoa. Entregue a lista a quem pediu e conclua o pedido.'
        : undefined
    case 'correcao':
      return pedido.estado === 'recebido' || pedido.estado === 'pronto'
        ? 'Corrija o nome da pessoa por aqui. A correção de turma ou de vínculo se faz pela turma, em Escola › Turmas.'
        : undefined
    case 'eliminacao':
      if (pedido.estado === 'agendado') {
        return `A eliminação está agendada: o acesso da pessoa está suspenso e os dados são apagados ${String(PRAZO_DA_ELIMINACAO_DIAS)} dias depois do registro. Até lá, o cancelamento devolve o acesso.`
      }
      if (pedido.estado === 'concluido')
        return 'Os dados da pessoa foram eliminados. O pedido ficou só com os identificadores, que são o que a escola guarda para provar o atendimento.'
      if (pedido.estado === 'cancelado') return 'A eliminação foi cancelada e o acesso da pessoa voltou. Nada foi apagado.'
      return undefined
  }
}

const TEXTO_DO_NOME_TROCADO = 'O nome completo da pessoa foi trocado por uma marca neutra nos textos livres da escola (tema, material gerado e conversa do professor).'
const TEXTO_NENHUM_NOME_TROCADO = 'Nenhum nome foi trocado nos textos livres da escola.'
const TEXTO_DO_HOMONIMO_CONCLUIDO = 'Havia outro aluno com o mesmo nome completo nesta escola, e por isso o nome não foi trocado nos textos livres.'

/**
 * O que a eliminação fez com o nome nos textos livres, e o aviso de homônimo antes dela: a coordenação recebe só se houve
 * troca, nunca onde (RF15). Agendada, só o homônimo fala; concluída, diz o que aconteceu; fora da eliminação, nada.
 */
export function textoDaTrocaDeNome(pedido: Pick<PedidoDoTitular, 'tipo' | 'estado' | 'nomeTrocado' | 'homonimo'>): string | undefined {
  if (pedido.tipo !== 'eliminacao') return undefined
  if (pedido.estado === 'agendado') return pedido.homonimo === true ? TEXTO_DO_HOMONIMO : undefined
  if (pedido.estado !== 'concluido') return undefined
  if (pedido.nomeTrocado === true) return TEXTO_DO_NOME_TROCADO
  return pedido.homonimo === true ? TEXTO_DO_HOMONIMO_CONCLUIDO : TEXTO_NENHUM_NOME_TROCADO
}

const EFEITO_DE_CONCLUIR_SEM_ARQUIVO = 'Concluir encerra o atendimento na lista de pedidos.'

/** Concluir (RF16): o que o clique faz, e, só quando há arquivo pronto, que ele não o apaga. Correção, compartilhamento e acesso ainda sem arquivo não têm o que apagar. */
export function efeitoDeConcluir(pedido: Pick<PedidoDoTitular, 'tipo' | 'estado' | 'titular'>): string {
  if (!acoesDoPedido(pedido).baixar) return EFEITO_DE_CONCLUIR_SEM_ARQUIVO
  return `${EFEITO_DE_CONCLUIR_SEM_ARQUIVO} Não apaga o arquivo, que continua valendo pelos ${String(VALIDADE_DO_ARQUIVO_DIAS)} dias.`
}
export const AVISO_DE_CONCLUIR = 'A conclusão fica registrada na auditoria da escola, com quem a fez e quando.'

/** Cancelar a eliminação (RF14): o acesso volta, e o prazo em que ainda dá. */
export const EFEITO_DE_CANCELAR = `O acesso da pessoa volta com a mesma senha, na próxima vez que ela entrar. Nenhum dado é apagado e o pedido fica como cancelado. Depois dos ${String(PRAZO_DA_ELIMINACAO_DIAS)} dias, ou com a eliminação já em andamento, não dá mais para cancelar.`
export const AVISO_DE_CANCELAR = 'O cancelamento fica registrado na auditoria da escola, com quem o fez e quando.'

/** Corrigir o nome (RF13b): o que muda, o que não muda e o limite do nome anterior (Tech Spec do F3, seção 13). */
export const EFEITO_DE_CORRIGIR_NOME =
  'O nome muda no cadastro desta escola. O arquivo que já foi gerado não é refeito, e a correção de turma ou de vínculo se faz pela turma, em Escola › Turmas.'
export const AVISO_DO_NOME_ANTERIOR =
  'O nome anterior que tenha ficado em texto livre (tema, material gerado, conversa do professor) só sai quando o prazo de guarda dele passa. Se a pessoa pedir a eliminação depois, a troca procura só o nome novo. A correção fica na auditoria sem o nome anterior nem o novo.'

/** O nome novo conferido antes de confirmar: de 1 a 200 caracteres depois de tirar o espaço das pontas, e diferente do atual (a API recusa o resto). */
export type NomeNovoConferido = { readonly ok: true; readonly nome: string } | { readonly ok: false; readonly erro: string }

export const TEXTO_DO_NOME_IGUAL = 'O nome novo é igual ao atual. Digite o nome como deve ficar.'
export const TEXTO_DO_NOME_COMPRIDO = `O nome passa de ${String(MAXIMO_DO_NOME_DO_TITULAR)} caracteres.`

/** O que a coordenação digitou, conferido contra o contrato (`correcaoDeNomeSchema`) e contra o nome de agora. */
export function nomeNovoDoTitular(digitado: string, atual: string): NomeNovoConferido {
  const nome = digitado.trim()
  if (nome === '') return { ok: false, erro: 'Digite o nome correto.' }
  if (nome.length > MAXIMO_DO_NOME_DO_TITULAR) return { ok: false, erro: TEXTO_DO_NOME_COMPRIDO }
  if (nome === atual.trim()) return { ok: false, erro: TEXTO_DO_NOME_IGUAL }
  return { ok: true, nome }
}

/** Baixar a versão da escola (RF12 e RF17): o que o arquivo traz, para que serve e o que fazer com ele depois. */
export const EFEITO_DE_BAIXAR =
  'O arquivo traz tudo o que a escola guarda da pessoa, em formato aberto: cadastro, vínculos e trabalho; do aluno, também a conversa dele com o Tutor; do professor, o registro de uso da IA. Nunca traz a conversa do professor com o Assistente de ensino.'
export const AVISO_DE_BAIXAR = 'Este download fica registrado na auditoria da escola, com a finalidade. Entregue o arquivo a quem pediu e apague-o deste computador em seguida.'

/** A finalidade do download, em lista fechada (RF12): nunca texto livre (regra 20, item 10). */
export const ROTULO_DA_FINALIDADE: Readonly<Record<(typeof FINALIDADES_DO_ARQUIVO_DA_ESCOLA)[number], string>> = {
  entregar_ao_titular: 'Entregar à própria pessoa',
  entregar_ao_responsavel_legal: 'Entregar ao responsável legal',
}

/** O aviso que fica na tela depois do download: o arquivo saiu do sistema e o que resta é entregá-lo e apagá-lo. */
export function anuncioDoArquivoBaixado(nome: string): string {
  return `Arquivo baixado: ${nome}. Entregue-o a quem pediu e apague-o deste computador em seguida.`
}

export const ANUNCIO_DE_PEDIDO_CONCLUIDO = 'Pedido concluído.'
export const ANUNCIO_DE_ELIMINACAO_CANCELADA = 'Eliminação cancelada: o acesso da pessoa voltou.'
export const ANUNCIO_DE_NOME_CORRIGIDO = 'Nome corrigido.'
export const ANUNCIO_DO_ARQUIVO_PRONTO = 'O arquivo ficou pronto.'

const TEXTO_DO_PEDIDO_QUE_MUDOU = 'A página mostra a situação de agora.'
/** Texto do pedido que não é achado: outra escola, inexistente ou o da própria pessoa respondem igual (regra 10, item 6). */
export const TEXTO_DO_PEDIDO_AUSENTE = 'Este pedido não está mais disponível nesta escola. Volte à lista de pedidos.'

/** A falha de concluir: o pedido que mudou de estado é o caso, e a página já foi relida. */
export const TEXTOS_DA_FALHA_DE_CONCLUIR: Readonly<Partial<Record<ErrorCode, string>>> = {
  [ErrorCode.PEDIDO_EM_ESTADO_INVALIDO]: `Este pedido já foi concluído ou mudou de situação e não pode mais ser concluído. ${TEXTO_DO_PEDIDO_QUE_MUDOU}`,
  [ErrorCode.NAO_ENCONTRADO]: TEXTO_DO_PEDIDO_AUSENTE,
}

/** A falha de cancelar: depois dos 7 dias, ou com a eliminação já enfileirada, a API recusa, e a tela diz por quê. */
export const TEXTOS_DA_FALHA_DE_CANCELAR: Readonly<Partial<Record<ErrorCode, string>>> = {
  [ErrorCode.PEDIDO_EM_ESTADO_INVALIDO]: `Esta eliminação já não pode ser cancelada: o prazo de ${String(PRAZO_DA_ELIMINACAO_DIAS)} dias passou, ela já começou ou outra pessoa a cancelou. ${TEXTO_DO_PEDIDO_QUE_MUDOU}`,
  [ErrorCode.NAO_ENCONTRADO]: TEXTO_DO_PEDIDO_AUSENTE,
}

/** A falha de corrigir o nome: o nome fora do tamanho volta como erro do campo, e o pedido que mudou, como a página relida. */
export const TEXTOS_DA_FALHA_DE_CORRIGIR_NOME: Readonly<Partial<Record<ErrorCode, string>>> = {
  [ErrorCode.ENTRADA_INVALIDA]: 'O nome precisa ter de 1 a 200 caracteres. Confira o que foi digitado.',
  [ErrorCode.PEDIDO_EM_ESTADO_INVALIDO]: `Este pedido já não aceita a correção do nome: ele foi concluído ou deixou de ser de correção. ${TEXTO_DO_PEDIDO_QUE_MUDOU}`,
  [ErrorCode.NAO_ENCONTRADO]: TEXTO_DO_PEDIDO_AUSENTE,
}

/** A falha do download: sem a versão da escola, a pessoa ainda tem conta ativa (ela baixa o dela) ou o arquivo passou dos 7 dias. */
export const TEXTOS_DA_FALHA_DE_BAIXAR: Readonly<Partial<Record<ErrorCode, string>>> = {
  [ErrorCode.NAO_ENCONTRADO]: `A versão da escola não existe para este pedido: a pessoa ainda tem conta ativa nesta escola e baixa o arquivo completo em Meus dados, ou o arquivo passou dos ${String(VALIDADE_DO_ARQUIVO_DIAS)} dias e foi apagado.`,
  [ErrorCode.INDISPONIVEL_TENTE_DE_NOVO]: 'Não foi possível preparar o download agora. Tente de novo em instantes: o arquivo continua guardado.',
}

/** A falha que muda o que a página mostra: o diálogo some com o botão de confirmar e fica só o "Fechar", e a página é relida. */
export const CODIGOS_QUE_MUDAM_O_PEDIDO: readonly ErrorCode[] = [ErrorCode.PEDIDO_EM_ESTADO_INVALIDO, ErrorCode.NAO_ENCONTRADO]

/** Como cada origem da linha do compartilhamento é dita: do rastro das chamadas, ou do período em que a empresa atendia a escola. */
export const ROTULO_DA_ORIGEM: Readonly<Record<OrigemDoCompartilhamento, string>> = {
  rastro: 'Recebeu chamadas com dado da pessoa',
  periodo: 'A escola usava esta empresa enquanto a pessoa estava nela',
}

/**
 * Para avisar cada empresa da lista quando os dados são corrigidos ou eliminados (LGPD, art. 18, § 6º; RF13). O pedido de
 * compartilhamento é a própria lista, e o de acesso e portabilidade não pedem aviso.
 */
export const AVISO_DE_AVISAR_AS_EMPRESAS = 'Ao corrigir ou eliminar os dados da pessoa, a escola precisa avisar cada empresa desta lista (LGPD, art. 18, § 6º).'

/** O nome da empresa de uma linha: o cadastrado, que casa pela chave na época da chamada; ou o que diz que não há cadastro. */
export function nomeDaEmpresa(linha: CompartilhamentoRow, suboperadores: readonly SuboperadorDaEscola[] | undefined): string {
  if (linha.suboperadorId === null) return `Provedor não cadastrado: ${linha.chave}`
  const mesmaChave = (suboperadores ?? []).filter((suboperador) => suboperador.chave === linha.chave)
  // A chave recadastrada rende duas empresas com a mesma chave: vale a que estava vigente na última chamada da linha.
  const vigente = mesmaChave.find((suboperador) => suboperador.inicio <= linha.ultimoEm && (suboperador.fim === null || linha.ultimoEm <= suboperador.fim))
  return (vigente ?? mesmaChave[0])?.nome ?? linha.chave
}

/** O período da linha: o dia, quando começa e termina no mesmo; senão de um dia até o outro. */
export function periodoDaLinha(linha: Pick<CompartilhamentoRow, 'primeiroEm' | 'ultimoEm'>): string {
  const primeiro = formatarDiaDoInstante(linha.primeiroEm)
  const ultimo = formatarDiaDoInstante(linha.ultimoEm)
  return primeiro === ultimo ? `Em ${primeiro}` : `De ${primeiro} até ${ultimo}`
}

/** A foto do compartilhamento vem sem ordem: aqui vai do primeiro a ter dado ao último, e a chave desempata. */
export function ordenarOCompartilhamento(linhas: readonly CompartilhamentoRow[]): CompartilhamentoRow[] {
  return [...linhas].sort((a, b) => (a.primeiroEm === b.primeiroEm ? a.chave.localeCompare(b.chave) : a.primeiroEm < b.primeiroEm ? -1 : 1))
}
