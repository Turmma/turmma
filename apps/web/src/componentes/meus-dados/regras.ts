import {
  CHAVES_DE_RETENCAO,
  ErrorCode,
  TIPOS_DE_PEDIDO_COM_ARQUIVO,
  VALIDADE_DO_ARQUIVO_DIAS,
  type CategoriaDeRetencao,
  type EstadoDoPedido,
  type PedidoDeMeusDados,
  type MeusDadosResponse,
  type TipoDePedidoDoTitular,
} from '@educa/shared'
import type { FamiliaDeEstado } from '../ui/SeloDeEstado'
import { agendarRelitura, type AbaDoNavegador } from '../pedidos/atualizacao-dos-pedidos'

/**
 * Os textos e as regras sem React de "Meus dados" (F3, 18.0; RF12 e RF20; Tech Spec do F3, seção 9): o que cada pedido e cada
 * estado diz à própria pessoa, quando dá para baixar o arquivo, o resumo por categoria e o relógio de 10 s do arquivo em
 * preparação. Aqui para cada regra ter teste de unidade, e para a tela só desenhar. A tela é do aluno e do professor, e o
 * texto fala com a pessoa ("você"), com palavras que um aluno do 6º ano lê.
 */

/** De quanto em quanto tempo a tela relê enquanto algum arquivo está em preparação (Tech Spec do F3, seção 9). */
export const INTERVALO_DA_PREPARACAO_MS = 10_000

/** O tipo do pedido, como a pessoa o lê: a mesma frase na lista e no diálogo. */
export const ROTULO_DO_TIPO: Readonly<Record<TipoDePedidoDoTitular, string>> = {
  acesso: 'Cópia dos seus dados',
  portabilidade: 'Cópia para levar a outro serviço (portabilidade)',
  compartilhamento: 'Quem recebeu os seus dados',
  correcao: 'Correção dos seus dados',
  eliminacao: 'Eliminação dos seus dados',
}

/** O que o arquivo tem a dizer sobre si na lista. `nenhum` é o pedido que não gera arquivo (compartilhamento, correção, eliminação). */
export type SituacaoDoArquivo = 'preparando' | 'disponivel' | 'apagado' | 'nenhum'

/** Os tipos que geram arquivo: acesso e portabilidade (RF11). Os outros três não têm o que baixar. */
function geraArquivo(tipo: TipoDePedidoDoTitular): boolean {
  return (TIPOS_DE_PEDIDO_COM_ARQUIVO as readonly TipoDePedidoDoTitular[]).includes(tipo)
}

/**
 * Em que pé está o arquivo do pedido, para a pessoa:
 * - `preparando`: o worker ainda monta, e a tela relê sozinha;
 * - `disponivel`: a API diz que vale **e** o instante dele ainda não passou. Uma aba aberta por dias não oferece o botão de
 *   um arquivo que já saiu: a conferência do relógio é da tela, e a da API segue valendo (`NAO_ENCONTRADO`). O `agora` é o
 *   do último desenho da tela: uma aba parada não troca sozinha "Pronto para baixar" por "Arquivo apagado"; quem segura o
 *   download é a API;
 * - `apagado`: passou dos 7 dias, ou foi apagado (a eliminação, a expiração);
 * - `nenhum`: o pedido não gera arquivo, ou nunca teve um.
 */
export function situacaoDoArquivo(pedido: PedidoDeMeusDados, agora: Date): SituacaoDoArquivo {
  if (pedido.arquivo !== null) {
    return pedido.arquivo.situacao === 'disponivel' && Date.parse(pedido.arquivo.expiraEm) > agora.getTime() ? 'disponivel' : 'apagado'
  }
  return geraArquivo(pedido.tipo) && pedido.estado === 'em_preparacao' ? 'preparando' : 'nenhum'
}

/** O botão "Baixar" só existe com o arquivo disponível. */
export function podeBaixar(pedido: PedidoDeMeusDados, agora: Date): boolean {
  return situacaoDoArquivo(pedido, agora) === 'disponivel'
}

export const TEXTO_DO_ARQUIVO_EM_PREPARACAO = 'Estamos preparando o seu arquivo. Volte em alguns minutos.'
export const TEXTO_DO_ARQUIVO_APAGADO = `O arquivo ficou disponível por ${String(VALIDADE_DO_ARQUIVO_DIAS)} dias e foi apagado. Para receber de novo, peça à coordenação.`
/** O vazio é um convite (regra 50, item 5): a pessoa não pede aqui, e o texto diz a quem pedir. */
export const TITULO_DO_VAZIO = 'Nenhum pedido ainda'
export const TEXTO_DO_VAZIO = 'Para receber uma cópia dos seus dados, peça à coordenação da escola.'

/** O selo e a explicação de um pedido, em texto: estado nunca é só cor (regra 50, item 11). */
export interface SituacaoDoPedido {
  readonly familia: FamiliaDeEstado
  readonly selo: string
  readonly explicacao: string
}

const SELO_DO_ESTADO: Readonly<Record<EstadoDoPedido, { readonly familia: FamiliaDeEstado; readonly selo: string; readonly explicacao: string }>> = {
  recebido: { familia: 'info', selo: 'Recebido', explicacao: 'A escola recebeu o seu pedido e vai cuidar dele.' },
  em_preparacao: { familia: 'info', selo: 'Em preparação', explicacao: TEXTO_DO_ARQUIVO_EM_PREPARACAO },
  pronto: { familia: 'ok', selo: 'Pronto', explicacao: 'A escola preparou o seu pedido e vai concluí-lo.' },
  agendado: { familia: 'pendente', selo: 'Eliminação agendada', explicacao: 'A eliminação dos seus dados está agendada. Até lá, a coordenação pode cancelá-la.' },
  concluido: { familia: 'ok', selo: 'Concluído', explicacao: 'A escola concluiu este pedido.' },
  cancelado: { familia: 'info', selo: 'Cancelado', explicacao: 'Este pedido foi cancelado.' },
}

/**
 * O selo e a explicação do pedido. O arquivo manda quando o pedido gera um: pronto para baixar, em preparação ou apagado
 * dizem mais à pessoa do que o estado do pedido, que é da escola. Sem arquivo, vale o estado.
 */
export function situacaoDoPedido(pedido: PedidoDeMeusDados, agora: Date): SituacaoDoPedido {
  switch (situacaoDoArquivo(pedido, agora)) {
    case 'preparando':
      return { familia: 'info', selo: 'Em preparação', explicacao: TEXTO_DO_ARQUIVO_EM_PREPARACAO }
    case 'disponivel':
      return { familia: 'ok', selo: 'Pronto para baixar', explicacao: 'O seu arquivo está pronto.' }
    case 'apagado':
      return { familia: 'info', selo: 'Arquivo apagado', explicacao: TEXTO_DO_ARQUIVO_APAGADO }
    case 'nenhum':
      return SELO_DO_ESTADO[pedido.estado]
  }
}

/** Os mais recentes primeiro, pelo dia em que o pedido chegou à escola, e o id no empate: a API entrega pela ordem do id, que não é cronológica. */
export function ordenarPedidos(pedidos: readonly PedidoDeMeusDados[]): PedidoDeMeusDados[] {
  return [...pedidos].sort((a, b) => b.chegouEm.localeCompare(a.chegouEm) || b.id.localeCompare(a.id))
}

/**
 * O que cada categoria é, dito a quem é titular: na segunda pessoa e pelo que existe da pessoa, nunca pela regra de guarda.
 * É a variante, para o titular, de `ROTULO_DA_CATEGORIA_NA_PREVIA` (`areas/coordenacao/privacidade/textos-dos-pedidos.ts`),
 * que fala da pessoa em terceira para quem registra o pedido. O catálogo de retenção (`CATEGORIAS_DE_RETENCAO`) diz quando
 * o relógio começa a contar: serve à coordenação, e não a quem lê "o que a escola guarda de você".
 *
 * Cada rótulo foi conferido contra `contagemPorCategoria` (`apps/api/src/privacidade/titulares.repository.ts`), para o aluno
 * e para o professor: ele tem de ser verdadeiro para toda linha que a contagem alcança. O possessivo ("as suas", "que você
 * fez") só cabe quando a contagem liga a linha à pessoa por uma coluna só, a de quem é o dado ou de quem agiu (`aluno_id`,
 * `usuario_id`, `solicitada_por`, `criado_por`, `id`). Duas categorias ligam por dois caminhos, e o rótulo diz os dois:
 * - `reivindicacao_decidida`: o pedido feito no nome da pessoa na lista da turma (`lista_nome.usuario_id`: o que a aprovou e
 *   o recusado antes naquele nome, mesmo feito por outra pessoa) **ou** o que ela decidiu (`decidida_por`: o professor aprova
 *   a reivindicação de nome, D4). Por isso "feitos com o seu nome", e não "que você fez";
 * - `material_excluido`: o material que ela enviou (`enviado_por`) **ou** excluiu (`excluido_por`).
 * Categoria nova no catálogo, ou cláusula nova na contagem, pede a mesma conferência antes do rótulo.
 */
export const ROTULO_DA_CATEGORIA_PARA_O_TITULAR: Readonly<Record<CategoriaDeRetencao, string>> = {
  conversa_tutor: 'As suas conversas com o Tutor',
  sinal_tutor: 'Os sinais do Tutor ao professor sobre você',
  conversa_professor: 'As suas conversas com o Assistente de ensino',
  execucao_agente: 'Os pedidos que você fez à IA',
  texto_do_modelo: 'As chamadas ao modelo de IA que o seu uso gerou',
  consumo_por_aluno: 'O registro do seu uso da IA',
  trabalho_do_aluno: 'As suas respostas e as correções das suas atividades',
  reivindicacao_decidida: 'Os pedidos de entrada na turma feitos com o seu nome ou decididos por você',
  autoria_de_artefato: 'Os materiais que você gerou com a IA',
  material_excluido: 'Os materiais da escola que você enviou ou excluiu',
  vinculo_encerrado: 'Os seus vínculos com as turmas',
  pessoa_desativada: 'O seu cadastro na escola',
}

/** Uma linha do resumo: o que a escola guarda e quantos registros. */
export interface LinhaDoResumo {
  readonly categoria: CategoriaDeRetencao
  readonly descricao: string
  readonly quantidade: number
}

/**
 * O resumo por categoria, na ordem do catálogo (a mesma que a coordenação lê) e só com o que tem registro. O rótulo é o do
 * titular (`ROTULO_DA_CATEGORIA_PARA_O_TITULAR`): a ordem é a do catálogo de retenção, e o texto é o que existe da pessoa.
 */
export function linhasDoResumo(categorias: MeusDadosResponse['categorias']): LinhaDoResumo[] {
  const quantidades = new Map(categorias.map((linha) => [linha.categoria, linha.quantidade]))
  return CHAVES_DE_RETENCAO.flatMap((categoria) => {
    const quantidade = quantidades.get(categoria)
    return quantidade === undefined || quantidade === 0 ? [] : [{ categoria, descricao: ROTULO_DA_CATEGORIA_PARA_O_TITULAR[categoria], quantidade }]
  })
}

/** Só o arquivo em preparação muda sozinho: pedido parado nunca é relido por conta própria. */
export function relerEnquantoPrepara(pedidos: readonly PedidoDeMeusDados[]): boolean {
  return pedidos.some((pedido) => pedido.estado === 'em_preparacao')
}

/**
 * Relê a cada 10 s enquanto algum arquivo está em preparação e a aba está à vista, e para com a aba escondida (a aba
 * esquecida atrás de outra não fica batendo na API, regra 80); quando a aba volta, relê na hora. Fora de preparação não
 * agenda nada. Devolve como parar, para quando o estado muda ou a tela sai.
 */
export function agendarPreparacao(pedidos: readonly PedidoDeMeusDados[], atualizar: () => void, aba: AbaDoNavegador): () => void {
  if (!relerEnquantoPrepara(pedidos)) return () => undefined
  return agendarRelitura(atualizar, aba, INTERVALO_DA_PREPARACAO_MS)
}

/** Baixar: o que o arquivo traz, em palavras comuns. O que o aluno e o professor têm de dele é a mesma lista. */
export const EFEITO_DE_BAIXAR =
  'O arquivo traz tudo o que a escola guarda de você, em formato aberto (JSON): o cadastro, os vínculos com as turmas, o seu trabalho no sistema e as suas conversas com a IA.'
/** O aviso do computador compartilhado (RF12): o arquivo é de uma pessoa e o computador pode ser da escola. */
export const AVISO_DE_BAIXAR =
  'Se este computador é da escola, apague o arquivo dele depois de usar e saia da sua conta: o próximo a usar o computador poderia abri-lo. O download fica registrado na escola.'

/** O aviso que fica na tela depois do download: o arquivo saiu do sistema, e o que resta é apagá-lo do computador. */
export function anuncioDoArquivoBaixado(nome: string): string {
  return `Arquivo baixado: ${nome}. Se este computador é da escola, apague o arquivo dele depois de usar.`
}

/** A falha do download: o arquivo que saiu, ou o armazém fora do ar. O resto vem do catálogo de mensagens. */
export const TEXTOS_DA_FALHA_DE_BAIXAR: Readonly<Partial<Record<ErrorCode, string>>> = {
  [ErrorCode.NAO_ENCONTRADO]: `Este arquivo não está mais disponível: ele fica ${String(VALIDADE_DO_ARQUIVO_DIAS)} dias e foi apagado. Para receber de novo, peça à coordenação da escola.`,
  [ErrorCode.INDISPONIVEL_TENTE_DE_NOVO]: 'Não foi possível preparar o download agora. Tente de novo em instantes: o arquivo continua guardado.',
}

/** A falha que muda o que a tela mostra: o arquivo saiu enquanto a pessoa lia, e a lista é relida. */
export const CODIGOS_QUE_MUDAM_OS_MEUS_DADOS: readonly ErrorCode[] = [ErrorCode.NAO_ENCONTRADO]

/** A escola da tela, dita: os pedidos são só os dela. Sem o nome (a leitura do `/v1/eu` ainda não chegou), fala de "escola ativa". */
export function textoDaEscola(nomeDaEscola: string | undefined): string {
  const onde = nomeDaEscola === undefined ? 'na escola ativa' : `em ${nomeDaEscola}`
  return `Aqui aparecem só os pedidos feitos ${onde}. Quem estuda ou dá aula em mais de uma escola vê os pedidos de cada uma na escola em que entrou.`
}
