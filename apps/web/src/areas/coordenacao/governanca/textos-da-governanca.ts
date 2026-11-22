import {
  AGENTES,
  type Agente,
  type ErrorCode,
  ESTADOS_DE_ENTREGA,
  FUNCOES,
  MENSAGENS_DE_ERRO,
  nomeDaSerie,
  NOMES_DOS_AGENTES,
  type AlertaDoAnalista,
  type ChaveDeFuncao,
  type ConsumoDaFuncaoDoMes,
  type EstadoDeEntrega,
  type Etapa,
  type ItemDaGovernanca,
  type OrcamentoDoConsumo,
  type NivelDeAutonomia,
  type TipoDeEntrega,
} from '@educa/shared'
import { aparenciaDaFalha } from '../../../api/ciclo-de-execucao'
import type { Aprovacao } from '../../../components/ui/ai/approval'
import type { SegmentedOptions } from '../../../components/ui/fields/SegmentedControl'
import { formatNumber, formatQuantity } from '../../../format'

/**
 * Os textos da Governança, dos Agentes e do Analista, sem tela: o que cada código vira em português, num lugar só e com
 * teste. **Nenhum texto daqui nomeia pessoa, e nenhum conclui sobre professor ou aluno** (D45, D64; regra 70, itens 7 a
 * 9): o alerta é hipótese com contexto, e a linha da governança diz que uma pessoa decidiu, nunca quem.
 */

/** O que foi gerado, como a coordenação lê. */
export const NOME_DO_TIPO_DE_ENTREGA: Readonly<Record<TipoDeEntrega, string>> = {
  versao_adaptada: 'Versão adaptada de atividade',
  lote_de_correcao: 'Correção de objetiva de uma turma',
}

/** "Assistente de ensino · Correção de objetiva": o agente e a função, como o registro os diz (`docs/interface.md` 11.7). */
export function nomeDaFuncao(chave: ChaveDeFuncao): string {
  const { agente, nome } = FUNCOES[chave]
  return `${NOMES_DOS_AGENTES[agente]} · ${nome}`
}

/**
 * A aprovação de uma linha da governança, para a `ApprovalLine`. A API não diz quem decidiu (quem foi está na
 * auditoria), e a tela também não: fica "um professor", que é o único papel que decide entrega.
 */
export function aprovacaoDoItem(item: Pick<ItemDaGovernanca, 'estado' | 'decididaEm'>): Aprovacao {
  if (item.estado === 'pendente' || item.decididaEm === null) return { estado: 'pendente' }
  return item.estado === 'aprovada' ? { estado: 'aprovada', por: 'um professor', quando: item.decididaEm } : { estado: 'rejeitada', por: 'Um professor', quando: item.decididaEm, motivo: '' }
}

/** O filtro "Estado" da lista: "todos" não vai ao endereço nem à API, os outros três são os estados da entrega. */
export type FiltroDeEstado = 'todos' | EstadoDeEntrega

/** As quatro opções do filtro, como a coordenação as lê. O valor é o que a API entende e o que o endereço leva (`?estado=aprovada`). */
export const OPCOES_DO_ESTADO = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'pendente', rotulo: 'Esperando o professor' },
  { valor: 'aprovada', rotulo: 'Aprovados' },
  { valor: 'rejeitada', rotulo: 'Rejeitados' },
] as const satisfies SegmentedOptions<FiltroDeEstado>

/** O estado que o endereço pede (`?estado=aprovada`). Valor desconhecido é ignorado: a lista abre sem filtro, e a API nunca recebe o que não é estado. */
export function estadoDoEndereco(busca: string): EstadoDeEntrega | undefined {
  const valor = new URLSearchParams(busca).get('estado')
  return ESTADOS_DE_ENTREGA.find((estado) => estado === valor)
}

/**
 * A IA que o endereço pede (`?ia=tutor`), em "Como cada IA trabalha" (X2, 11.0). Só vale um dos três agentes do catálogo; qualquer
 * outro valor é ignorado, e a tela abre no Assistente de ensino, o primeiro.
 */
export function agenteDoEndereco(busca: string): Agente {
  const valor = new URLSearchParams(busca).get('ia')
  return AGENTES.find((agente) => agente === valor) ?? 'assistente_de_ensino'
}

/**
 * O que a lista diz quando o filtro não acha nada, por estado. Nenhum texto diz quem decidiu nem de que turma é a entrega, e a
 * frase fixa da tela continua explicando por que a série de um professor só não entra na lista (D45, D64).
 */
export const VAZIO_DO_FILTRO: Readonly<Record<EstadoDeEntrega, { readonly titulo: string; readonly descricao: string }>> = {
  pendente: { titulo: 'Nenhuma entrega esperando o professor', descricao: 'Quando a IA gerar uma versão adaptada ou uma correção de objetiva, ela aparece aqui até um professor decidir.' },
  aprovada: { titulo: 'Nenhuma entrega aprovada ainda', descricao: 'Quando um professor aprovar uma versão adaptada ou uma correção de objetiva, ela aparece aqui, com a data da decisão.' },
  rejeitada: { titulo: 'Nenhuma entrega rejeitada', descricao: 'Quando um professor rejeitar uma entrega, ela aparece aqui, com a data da decisão.' },
}

/** O que o selo pendente diz à coordenação, que não é quem aprova. */
export const ESPERANDO_O_PROFESSOR = 'Esperando o professor'

const percentual = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** `46.7` → `46,7%`. */
export function formatPercentual(valor: number): string {
  return `${percentual.format(valor)}%`
}

/** O acerto em percentual, de 0 a 100. Sem questão nenhuma, zero. */
export function acertoPercentual(acertos: number, total: number): number {
  return total <= 0 ? 0 : (acertos * 100) / total
}

/** "41% do que a IA trabalhou no mês · 128 execuções": a parte da função, escrita, ao lado do nome dela. Sem token e sem real (RF12, D40). */
export function textoDaParte(consumo: Pick<ConsumoDaFuncaoDoMes, 'parte' | 'execucoes'>): string {
  return `${formatNumber(consumo.parte)}% do que a IA trabalhou no mês · ${formatQuantity(consumo.execucoes, 'execução', 'execuções')}`
}

/** O que o Painel e a Governança dizem quando o orçamento do mês não tem porcentagem (RF9, D40; `docs/interface.md` 3). */
const SEM_PORCENTAGEM: Readonly<Record<'sem_orcamento' | 'sem_aluno_ativo' | 'sem_retrato', string>> = {
  sem_orcamento: 'O previsto de IA da escola ainda não foi definido. A equipe Turmma define com vocês.',
  sem_aluno_ativo: 'A porcentagem aparece quando a escola tiver aluno ativo.',
  // O mês que fechou antes de a medição existir (`?mes=` de antes da camada-ia): o retrato dele nunca foi guardado, e a tela não inventa um número.
  sem_retrato: 'Este mês fechou antes de o previsto de IA ser medido, por isso não há porcentagem.',
}

/** O aviso de cada limiar já cruzado no mês: a escola é avisada, e **nada é cortado** (D40). */
const AVISO_DO_ORCAMENTO: Readonly<Record<80 | 100, string>> = {
  80: 'A escola já usou 80% do previsto para a IA neste mês. Nada é cortado.',
  100: 'A escola passou do previsto para a IA neste mês. Nada é cortado, e a equipe Turmma vai conversar com vocês se isso se repetir.',
}

/**
 * A linha do orçamento do mês e o aviso, escritos: "IA do mês: 62% do previsto." e, se o limiar de 80% ou de 100% já foi cruzado, o aviso. Sem valor, sem aluno ou sem retrato, só a frase que diz por que não há número.
 * **Nenhum real e nenhum token** (RF12, D40): a porcentagem vem pronta do servidor, e a tela não calcula nada.
 */
export function textoDoOrcamento({ situacao, porcentagem, aviso }: OrcamentoDoConsumo): { readonly linha: string; readonly aviso: string | null } {
  if (situacao === 'definido' && porcentagem !== null) return { linha: `IA do mês: ${formatNumber(porcentagem)}% do previsto.`, aviso: aviso === null ? null : AVISO_DO_ORCAMENTO[aviso] }
  return { linha: SEM_PORCENTAGEM[situacao === 'definido' ? 'sem_retrato' : situacao], aviso: null }
}

/** "12 de 9.600 trocas": o uso do Tutor no mês contra o pacote da escola. */
export function textoDoPacoteDoTutor(tutor: { readonly trocasNoMes: number; readonly pacoteDoMes: number }): string {
  return `${formatNumber(tutor.trocasNoMes)} de ${formatQuantity(tutor.pacoteDoMes, 'troca', 'trocas')}`
}

/** "2º ano do Ensino Médio · Química": o recorte do Analista. Nunca turma, nunca professor. */
export function nomeDoRecorte(recorte: { readonly serie: { readonly etapa: Etapa; readonly ano: number }; readonly disciplina: { readonly nome: string } }): string {
  return `${nomeDaSerie(recorte.serie)} · ${recorte.disciplina.nome}`
}

/**
 * A frase do alerta, montada pela tela a partir do tipo, do número e da referência (o resumo não tem texto livre). Só o
 * alerta de habilidade com acerto baixo é produzido nesta fatia: os outros tipos do contrato **não ganham frase**, e a
 * tela não os mostra. A frase diz o que foi medido e onde; nunca conclui sobre pessoa.
 */
export function fraseDoAlerta(alerta: AlertaDoAnalista): string | null {
  if (alerta.tipo !== 'habilidade_com_acerto_baixo' || alerta.habilidade === null) return null
  return `Em ${nomeDoRecorte(alerta)}, o acerto em "${alerta.habilidade.descricao}" (${alerta.habilidade.codigo}) ficou em ${formatPercentual(alerta.valor)}, abaixo de ${formatPercentual(alerta.referencia)}, um limite provisório desta versão, a definir com a escola.`
}

/** O que acompanha todo alerta: é hipótese, e quem conclui é a escola. */
export const AVISO_DE_HIPOTESE = 'É uma hipótese a conferir, não uma conclusão: quem conclui é a escola, com os professores.'

/** O que vale para toda suspensão (decisão 14 do MVP; D60): recusa pedido novo e não apaga nada. */
const EFEITO_COMUM_DA_SUSPENSAO =
  'As outras funções continuam. O que ela já produziu não é apagado, e o que está esperando o professor continua podendo ser aprovado ou rejeitado por ele.'

/**
 * O que a confirmação de suspender diz que acontece, **por função**: cada uma para de um jeito, e duas coisas nunca param
 * (o encaminhamento de assunto delicado do Tutor e o aviso de que um aluno precisa de um adulto; D36).
 */
export const EFEITO_DA_SUSPENSAO: Readonly<Record<ChaveDeFuncao, string>> = {
  conversa_e_ferramentas: `O Assistente deixa de responder pedido novo dos professores e as ferramentas deixam de gerar. ${EFEITO_COMUM_DA_SUSPENSAO}`,
  correcao_de_objetiva: `A atividade objetiva que o professor encerrar fica sem correção até a função voltar; as respostas dos alunos ficam guardadas, e encerrar de novo depois corrige. ${EFEITO_COMUM_DA_SUSPENSAO}`,
  adaptacao: `O professor deixa de conseguir pedir versão adaptada nova. ${EFEITO_COMUM_DA_SUSPENSAO}`,
  classificacao_do_material: `O material novo deixa de ser classificado pela BNCC à noite e o pedido de classificar de novo é recusado. A geração de atividades e a cobertura do currículo passam a valer só pelas habilidades que a coordenação corrigiu. ${EFEITO_COMUM_DA_SUSPENSAO}`,
  tutor_com_o_aluno: `O Tutor deixa de responder dúvida nova dos alunos. Quem escrever sobre um assunto pessoal delicado continua recebendo a mensagem de encaminhamento, e o professor continua sendo avisado. ${EFEITO_COMUM_DA_SUSPENSAO}`,
  sinais_para_o_professor: `Param os avisos de aprendizagem (quem travou, quem pediu a resposta pronta, a dúvida repetida). O aviso de que um aluno precisa de um adulto continua chegando ao professor, e o uso do Tutor por turma continua visível a ele. ${EFEITO_COMUM_DA_SUSPENSAO}`,
  resumo_e_alerta: `O Analista deixa de gerar resumo novo; o último gerado continua na tela. ${EFEITO_COMUM_DA_SUSPENSAO}`,
}

export const AVISO_DA_SUSPENSAO = 'A suspensão fica na auditoria da escola, com quem suspendeu e quando.'

/** O que a Governança diz sobre o que chega ao aluno: só o Tutor responde sem aprovação prévia, e com o professor acompanhando (D47). */
export const O_QUE_CHEGA_AO_ALUNO =
  'Nenhum material nem diagnóstico da IA chega ao aluno sem um professor aprovar; o Tutor responde ao aluno na hora, com o professor acompanhando. As atividades e os planos que a professora gera ficam com ela, e só chegam à turma quando ela os aplica.'

/** A autonomia de cada função num selo curto (D9; `docs/agentes.md`), com o texto do catálogo ao lado. */
export const NOME_DA_AUTONOMIA: Readonly<Record<NivelDeAutonomia, string>> = {
  1: 'Faz e registra',
  2: 'Faz e avisa',
  3: 'Propõe e espera aprovação',
  4: 'Nunca faz',
}

/** O que o diálogo do dado nominal avisa antes de abrir (regra 20, item 10; D45). */
export const AVISO_DO_NOMINAL = 'Esta abertura fica na auditoria da escola, com o seu nome, a data, a turma e a finalidade.'

export const EFEITO_DO_NOMINAL = 'A resposta mostra os professores da turma pelo nome e o acerto por habilidade dela. Não mostra aluno, e não serve para avaliar nem comparar professores.'

/** Como a falha de "Gerar resumo" aparece: a que passa sozinha oferece tentar de novo; as outras dizem o que fazer. */
export function falhaDoResumo(erro: ErrorCode): { readonly repetivel: boolean; readonly texto: string } {
  const aparencia = aparenciaDaFalha(erro)
  if (aparencia === 'fila') return { repetivel: true, texto: '' }
  if (aparencia === 'suspensa') return { repetivel: false, texto: 'A função "Resumo e alerta" está suspensa nesta escola. Para gerar um resumo novo, retome a função em Agentes.' }
  if (aparencia === 'limite') return { repetivel: false, texto: 'Foram muitos pedidos em pouco tempo. Espere um minuto e peça de novo.' }
  return { repetivel: false, texto: MENSAGENS_DE_ERRO[erro] }
}
