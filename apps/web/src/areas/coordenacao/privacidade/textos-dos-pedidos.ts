import {
  ErrorCode,
  MINIMO_DE_LETRAS_DO_TERMO,
  PRAZO_DA_ELIMINACAO_DIAS,
  SOLICITANTES_DO_PEDIDO,
  TIPOS_DE_PEDIDO_DO_TITULAR,
  VALIDADE_DO_ARQUIVO_DIAS,
  type CategoriaDeRetencao,
  type EstadoDoPedido,
  type ItemDoPedido,
  type PapelDoTitular,
  type RegistroDePedido,
  type SolicitanteDoPedido,
  type TipoDePedidoDoTitular,
  type TitularAchado,
} from '@educa/shared'
import type { StatusFamily } from '../../../components/ui/StatusBadge'

/**
 * Os textos e as regras sem React da aba Pedidos da Privacidade (F3, 16.0; RF10 e RF16): o que cada tipo, quem pediu e
 * estado diz, o que o registro faz antes de a coordenação confirmar (regra 50, item 8), o texto de cada falha e a conferência
 * dos três campos do pedido. Aqui para cada regra ter teste de unidade, e para a tela só desenhar.
 */

/** O tipo do pedido, por extenso: é o mesmo texto na lista, na escolha e na confirmação. */
export const ROTULO_DO_TIPO: Readonly<Record<TipoDePedidoDoTitular, string>> = {
  acesso: 'Acesso aos dados',
  portabilidade: 'Portabilidade dos dados',
  compartilhamento: 'Compartilhamento dos dados',
  correcao: 'Correção de dados',
  eliminacao: 'Eliminação dos dados',
}

/** Quem pediu: lista fechada, sem nome de pessoa (RF10). */
export const ROTULO_DE_QUEM_PEDIU: Readonly<Record<SolicitanteDoPedido, string>> = {
  titular: 'A própria pessoa',
  responsavel_legal: 'O responsável legal',
}

export const ROTULO_DO_PAPEL: Readonly<Record<PapelDoTitular, string>> = { aluno: 'Aluno', professor: 'Professor' }

/**
 * O estado do pedido na lista: a família do selo e o texto. Estado nunca é só cor (regra 50, item 11): o texto diz. Os que
 * esperam a coordenação (recebido, pronto, agendado) são `pendente`; o arquivo em montagem é `info`.
 */
export const SITUACAO_DO_PEDIDO: Readonly<Record<EstadoDoPedido, { readonly familia: StatusFamily; readonly texto: string }>> = {
  recebido: { familia: 'pendente', texto: 'Recebido' },
  em_preparacao: { familia: 'info', texto: 'Em preparação' },
  pronto: { familia: 'pendente', texto: 'Pronto' },
  agendado: { familia: 'pendente', texto: 'Eliminação agendada' },
  concluido: { familia: 'ok', texto: 'Concluído' },
  cancelado: { familia: 'info', texto: 'Cancelado' },
}

/** O que a lista diz do titular que já foi eliminado: o nome e a turma saíram do sistema, o pedido fica com os ids (RF14, RF15). */
export const TEXTO_DO_TITULAR_ELIMINADO = 'Titular eliminado'

const TEXTO_SEM_TURMA = 'Sem turma neste ano'

/** As turmas do titular, ou o que diz que ele não tem nenhuma neste ano. */
export function textoDasTurmas(turmas: readonly string[]): string {
  return turmas.length === 0 ? TEXTO_SEM_TURMA : turmas.join(', ')
}

/**
 * O que a busca mostra de cada pessoa achada, depois do nome: o papel e, do aluno, a turma do ano e a matrícula; do
 * professor, as disciplinas e as turmas desta escola. É o que separa dois homônimos (a turma) sem a coordenação ter de abrir nada.
 */
export function descricaoDoAchado(achado: TitularAchado): string {
  const turmas = achado.turmas.map(({ nome }) => nome)
  const partes: string[] = [ROTULO_DO_PAPEL[achado.papel]]
  if (achado.papel === 'professor' && achado.disciplinas.length > 0) partes.push(achado.disciplinas.map(({ nome }) => nome).join(', '))
  partes.push(textoDasTurmas(turmas))
  if (achado.matricula !== null) partes.push(`matrícula ${achado.matricula}`)
  if (achado.estado === 'desativado') partes.push('conta desativada')
  return partes.join(' · ')
}

/** O anúncio do resultado da busca, lido pelo leitor de tela (`aria-live`): quantas pessoas, ou que nenhuma foi achada. */
export function anuncioDaBusca(quantidade: number): string {
  if (quantidade === 0) return 'Nenhuma pessoa encontrada com esse nome.'
  return quantidade === 1 ? '1 pessoa encontrada. Escolha-a para continuar.' : `${String(quantidade)} pessoas encontradas. Escolha uma para continuar.`
}

export const TEXTO_DE_NINGUEM_ACHADO =
  'Confira a grafia. O aluno que ainda não reivindicou o nome não aparece aqui: ele está só na lista de nomes da turma, em Escola › Turmas.'

/** O aviso fixo da aba: o aluno da lista não tem conta, e o caminho dele é a lista da turma (A1; Tech Spec do F3, seção 4). */
export const AVISO_DO_ALUNO_DA_LISTA =
  'O aluno que ainda não reivindicou o nome não tem conta e não aparece na busca: ele está só na lista de nomes da turma. Para atendê-lo, abra a turma em Escola › Turmas. Ler a lista é o acesso, e corrigir é retirar o nome e acrescentá-lo de novo.'

export const TEXTO_DO_TERMO_CURTO = `Digite pelo menos ${String(MINIMO_DE_LETRAS_DO_TERMO)} letras do nome.`

/** Confere o termo antes de enviar: com menos de 3 letras depois de tirar o espaço das pontas, nenhuma busca sai (o mesmo corte da API). */
export function termoDaBusca(digitado: string): { readonly ok: true; readonly termo: string } | { readonly ok: false; readonly erro: string } {
  const termo = digitado.trim()
  return termo.length >= MINIMO_DE_LETRAS_DO_TERMO ? { ok: true, termo } : { ok: false, erro: TEXTO_DO_TERMO_CURTO }
}

/** O aviso do homônimo, no texto da Tech Spec (seção 9): sem ele a coordenação esperaria uma troca de nome que não vai acontecer. */
export const TEXTO_DO_HOMONIMO = 'Há outro aluno com o mesmo nome completo nesta escola. O nome não será trocado nos textos livres.'

/** O que a eliminação diz de si (Tech Spec do F3, seção 9; PRD, seção 10): os 7 dias, o cancelamento e o que a escola guarda fora daqui. */
export const EFEITO_DA_ELIMINACAO = `O acesso da pessoa é suspenso na próxima ação dela, e os dados são apagados daqui a ${String(PRAZO_DA_ELIMINACAO_DIAS)} dias. Até lá, a coordenação pode cancelar o pedido e o acesso volta. Depois disso, não há como desfazer.`

export const AVISO_DA_ELIMINACAO =
  'A eliminação apaga da Turmma o que a escola talvez precise guardar por lei, como o registro escolar. Confira que o necessário está no sistema de gestão da escola antes de confirmar.'

/** O que registrar cada tipo de pedido faz, numa frase, antes de confirmar (regra 50, item 8). */
export const EFEITO_DO_PEDIDO: Readonly<Record<TipoDePedidoDoTitular, string>> = {
  acesso: `O sistema monta um arquivo com tudo o que esta escola guarda da pessoa, com um resumo para ler. Quando ficar pronto, ela o baixa na área dela por ${String(VALIDADE_DO_ARQUIVO_DIAS)} dias.`,
  portabilidade: `O sistema monta o mesmo arquivo em formato aberto, legível por máquina, para a pessoa levar a outro lugar. Ela o baixa na área dela por ${String(VALIDADE_DO_ARQUIVO_DIAS)} dias.`,
  compartilhamento: 'O pedido guarda a lista das empresas por onde passou dado da pessoa, com o período, para a escola avisar cada uma. A lista aparece no pedido.',
  correcao: 'O pedido fica aberto para a coordenação corrigir o nome da pessoa. A correção de turma ou de vínculo se faz pela turma, em Escola › Turmas.',
  eliminacao: EFEITO_DA_ELIMINACAO,
}

/** O que cada categoria da prévia é, para quem confere: não é o prazo de guarda (aba "Por quanto tempo guardamos"), é o que existe da pessoa. */
export const ROTULO_DA_CATEGORIA_NA_PREVIA: Readonly<Record<CategoriaDeRetencao, string>> = {
  conversa_tutor: 'Mensagens da conversa com o Tutor',
  sinal_tutor: 'Sinais do Tutor ao professor',
  conversa_professor: 'Mensagens da conversa com o Assistente de ensino',
  execucao_agente: 'Pedidos feitos à IA',
  texto_do_modelo: 'Chamadas ao modelo de IA',
  consumo_por_aluno: 'Registros de uso da IA',
  trabalho_do_aluno: 'Respostas e correções de atividades',
  reivindicacao_decidida: 'Pedidos de entrada na turma',
  autoria_de_artefato: 'Materiais gerados com a IA',
  material_excluido: 'Materiais da escola enviados ou excluídos',
  vinculo_encerrado: 'Vínculos com turmas',
  pessoa_desativada: 'Cadastro na escola',
}

/** Quando a prévia do aluno vem sem nenhuma categoria: não há o que a escola guarde dele nas categorias de retenção. */
export const TEXTO_DA_PREVIA_SEM_DADO = 'Nenhum dado desta pessoa foi encontrado nas categorias que a escola guarda.'

/** A falha da busca: o limite de buscas por minuto diz o que fazer, em vez do "muitas tentativas" do catálogo. */
export const TEXTOS_DA_FALHA_DA_BUSCA: Readonly<Partial<Record<ErrorCode, string>>> = {
  [ErrorCode.LIMITE_EXCEDIDO]: 'Muitas buscas em pouco tempo. Aguarde um minuto e busque de novo.',
}

/**
 * A falha do registro. A queda de rede e o 503 dizem que tentar de novo não duplica o pedido (é a chave de envio), que é o que
 * a coordenação teme ao ver um erro depois de confirmar. Os demais explicam o que mudou.
 */
export const TEXTOS_DA_FALHA_DO_REGISTRO: Readonly<Partial<Record<ErrorCode, string>>> = {
  [ErrorCode.INDISPONIVEL_TENTE_DE_NOVO]: 'Não foi possível confirmar o registro agora. Tente de novo: o pedido não será registrado duas vezes.',
  [ErrorCode.ENTRADA_INVALIDA]: 'Os dados do pedido não foram aceitos. Confira o dia em que ele chegou à escola, que não pode ser depois de hoje: cancele e registre o pedido de novo.',
  [ErrorCode.NAO_ENCONTRADO]: 'Esta pessoa não está mais disponível para pedido. Cancele e busque de novo.',
  [ErrorCode.PEDIDO_EM_ESTADO_INVALIDO]: 'Esta pessoa já tem um pedido de eliminação aberto. Cancele e veja a lista de pedidos.',
}

export type CampoDoPedido = 'tipo' | 'solicitante' | 'chegouEm'

const TEXTO_DO_CAMPO_DO_PEDIDO: Readonly<Record<CampoDoPedido, string>> = {
  tipo: 'Escolha o tipo do pedido.',
  solicitante: 'Diga quem pediu.',
  chegouEm: 'Informe o dia em que o pedido chegou à escola, que não pode ser depois de hoje.',
}

/** O que a pessoa escolheu nos três campos, ainda como o formulário os guarda: a escolha vazia é `''`. */
export interface EscolhasDoPedido {
  readonly tipo: string
  readonly solicitante: string
  readonly chegouEm: string
}

/** O pedido sem a chave de envio (que nasce com o diálogo de confirmação), ou o texto de cada campo que não vale. */
export type ValidacaoDoPedido =
  | { readonly ok: true; readonly registro: Omit<RegistroDePedido, 'chaveEnvio' | 'titularId'> }
  | { readonly ok: false; readonly erros: Readonly<Partial<Record<CampoDoPedido, string>>> }

/**
 * `AAAA-MM-DD` de um dia que existe, como `z.iso.date()` da API: o `31/02` não passa, e nem `10/10/2026`. O que não é data
 * sai invalidado pelo `Date`, e o que é data de outro mês volta diferente do texto; por isso não há conferência de formato à parte.
 */
function ehDiaDoCalendario(texto: string): boolean {
  const data = new Date(`${texto}T00:00:00Z`)
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto
}

/**
 * Confere os três campos do pedido contra o contrato (`registroDePedidoSchema`): tipo e quem pediu da lista fechada, e o
 * dia no formato `AAAA-MM-DD` e **não depois de hoje**, o mesmo corte da API (`ENTRADA_INVALIDA`). O `hoje` é o dia de São Paulo.
 */
export function validarOPedido(escolhas: EscolhasDoPedido, hoje: string): ValidacaoDoPedido {
  const erros: Partial<Record<CampoDoPedido, string>> = {}
  const tipo = TIPOS_DE_PEDIDO_DO_TITULAR.find((valor) => valor === escolhas.tipo)
  const solicitante = SOLICITANTES_DO_PEDIDO.find((valor) => valor === escolhas.solicitante)
  const diaValido = ehDiaDoCalendario(escolhas.chegouEm) && escolhas.chegouEm <= hoje
  if (tipo === undefined) erros.tipo = TEXTO_DO_CAMPO_DO_PEDIDO.tipo
  if (solicitante === undefined) erros.solicitante = TEXTO_DO_CAMPO_DO_PEDIDO.solicitante
  if (!diaValido) erros.chegouEm = TEXTO_DO_CAMPO_DO_PEDIDO.chegouEm
  if (tipo === undefined || solicitante === undefined || !diaValido) return { ok: false, erros }
  return { ok: true, registro: { tipo, solicitante, chegouEm: escolhas.chegouEm } }
}

/**
 * O dia de hoje em São Paulo, `AAAA-MM-DD`: o mesmo dia por onde a API recusa a chegada no futuro (`diaDeUso`). O dia do
 * navegador, num computador com o fuso errado, deixaria a coordenação escolher um dia que a API recusa.
 */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(agora)
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

/**
 * A ordem da lista: a chegada mais recente primeiro, e o id no empate. É a chave em que a API entrega cada página (`proxima` é o
 * id do último item dela): a tela a repete sobre as páginas já lidas, e por isso "Ver mais pedidos" só acrescenta no fim.
 */
export function ordenarOsPedidos(itens: readonly ItemDoPedido[]): ItemDoPedido[] {
  return [...itens].sort((a, b) => (a.chegouEm === b.chegouEm ? a.id.localeCompare(b.id) : a.chegouEm < b.chegouEm ? 1 : -1))
}
