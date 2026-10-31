import { FUNCOES, NOME_DO_TIPO_DE_ENTREGA, ROTULOS_DA_ADAPTACAO, TAMANHO_MAXIMO_DA_JUSTIFICATIVA, TAMANHO_MINIMO_DA_JUSTIFICATIVA, type AdaptacaoAplicada, type Entrega } from '@educa/shared'
import type { Aprovacao } from '../../../components/ui/ai/approval'

/**
 * O que a tela diz de uma entrega (glossário, "Entrega"; regra 70, item 3): a situação dela diante da aprovação, o que
 * o Assistente fez, o que espera a professora e o que acontece quando ela aprova. Texto curto, na primeira pessoa do
 * agente, e **nunca sobre aluno**: a entrega fala do que foi produzido.
 */

/** Quem decidiu e não está mais na escola: o registro fica, sem o nome (o id sobrevive à eliminação da pessoa). */
export const AUTOR_QUE_SAIU = 'pessoa que não está mais na escola'

/**
 * A situação da entrega para a `LinhaAprovacao`: pendente, aprovada por quem e quando, ou rejeitada com o motivo. A
 * decidida que chegar sem a data (o contrato não deixa) é mostrada como pendente: a tela não afirma uma aprovação que
 * não sabe datar.
 */
export function aprovacaoDaEntrega(entrega: Pick<Entrega, 'estado' | 'decididaEm' | 'decididaPor' | 'justificativa'>): Aprovacao {
  if (entrega.estado === 'pendente' || entrega.decididaEm === null) return { estado: 'pendente' }
  const por = entrega.decididaPor?.nome ?? AUTOR_QUE_SAIU
  if (entrega.estado === 'aprovada') return { estado: 'aprovada', por, quando: entrega.decididaEm }
  return { estado: 'rejeitada', por, quando: entrega.decididaEm, motivo: entrega.justificativa ?? '' }
}

/** O verbo da linha, com o gênero do que foi aprovado: a versão adaptada é "Aprovada por"; a correção, também. */
export const VERBO_DA_ENTREGA = 'Aprovada por'

/** "Fonte ampliada + Tempo adicional (50% a mais)": os tipos escolhidos, e nunca o motivo. */
export function textoDaAdaptacao(adaptacao: AdaptacaoAplicada): string {
  return adaptacao.tipos.map((tipo) => (tipo === 'tempo_adicional' && adaptacao.tempoExtraPercentual !== undefined ? `${ROTULOS_DA_ADAPTACAO[tipo]} (${String(adaptacao.tempoExtraPercentual)}% a mais)` : ROTULOS_DA_ADAPTACAO[tipo])).join(' + ')
}

function daTurma(nomeDaTurma: string | undefined): string {
  return nomeDaTurma === undefined ? '' : ` da turma ${nomeDaTurma}`
}

/**
 * O que o Assistente diz da entrega, no balão de "O que o Assistente fez": o que fez, e o que falta para valer. Só o trabalho, sem
 * número de aluno nem nome: o detalhe abre na tela da própria entrega.
 */
export function falaDaEntrega(entrega: Pick<Entrega, 'tipo' | 'titulo'>, nomeDaTurma: string | undefined): string {
  // O título da entrega de adaptação é o da própria versão adaptada (a API o devolve assim), e já diz o que ela é.
  if (entrega.tipo === 'versao_adaptada') return `Preparei "${entrega.titulo}"${daTurma(nomeDaTurma)}. Esta versão adaptada só pode ir aos alunos depois que você aprovar.`
  return `Corrigi "${entrega.titulo}"${daTurma(nomeDaTurma)}. O diagnóstico só chega aos alunos depois que você revisar os destaques e aprovar.`
}

/**
 * O que a entrega pendente diz quando a escola suspendeu a função que a fez (D60): que a função está suspensa, e que a
 * decisão continua sendo da professora — suspender não decide nada por ela. Sem data: o contrato não diz desde quando.
 * A entrega já decidida não diz nada: ela não espera mais ninguém.
 */
export function avisoDaFuncaoSuspensa(entrega: Pick<Entrega, 'estado' | 'funcao'>, suspensa: boolean): string | undefined {
  if (!suspensa || entrega.estado !== 'pendente') return undefined
  return `A coordenação suspendeu a função "${FUNCOES[entrega.funcao].nome}" nesta escola: o Assistente não prepara outra enquanto isso. Esta entrega continua esperando a sua decisão.`
}

/**
 * Como a versão adaptada sai em PDF, pela situação da entrega dela (regra 70, item 3): a aprovada sai limpa; a que ainda
 * espera a decisão sai como **rascunho**, marcada em toda página; **a rejeitada não sai**. O artefato que não é versão
 * adaptada (sem entrega) é rascunho da professora e sai como está.
 */
export type SaidaEmPdf = 'limpa' | 'rascunho' | 'nao_exporta'

export function saidaEmPdf(entrega: { readonly estado: Entrega['estado'] } | null): SaidaEmPdf {
  if (entrega === null || entrega.estado === 'aprovada') return 'limpa'
  return entrega.estado === 'pendente' ? 'rascunho' : 'nao_exporta'
}

export const TEXTO_DO_RASCUNHO_EM_PDF = 'Esta versão ainda espera a sua decisão: o PDF sai marcado como rascunho em todas as páginas.'
export const TEXTO_DA_REJEITADA_SEM_PDF = 'Esta versão foi rejeitada e não pode ser exportada: ela não vai aos alunos. Peça outra versão adaptada a partir da atividade de origem.'

/** O título só muda enquanto a versão adaptada espera a decisão: depois de decidida, o que foi decidido não muda de nome. */
export function podeRenomear(entrega: { readonly estado: Entrega['estado'] } | null): boolean {
  return entrega === null || entrega.estado === 'pendente'
}

/** O aviso do título e do tema: os dois vão para o modelo, e não são lugar de escrever sobre aluno (regra 20, item 3). */
export const AVISO_DE_TEXTO_SEM_ALUNO = 'Não escreva nome nem condição de aluno.'

/** Os filtros da conversa do Assistente em "O que o Assistente fez" (11.4; P14): tudo, o que espera a professora, e por função. */
export const FILTROS_DO_TIME = [
  { id: 'tudo', rotulo: 'Tudo' },
  { id: 'esperando', rotulo: 'Esperando você' },
  { id: 'correcao_de_objetiva', rotulo: 'Correção' },
  { id: 'adaptacao', rotulo: 'Adaptação' },
] as const
export type FiltroDoTime = (typeof FILTROS_DO_TIME)[number]['id']

export function ehFiltroDoTime(valor: string): valor is FiltroDoTime {
  return FILTROS_DO_TIME.some((filtro) => filtro.id === valor)
}

/** As entregas que o filtro deixa passar. */
export function entregasDoFiltro(entregas: readonly Entrega[], filtro: FiltroDoTime): Entrega[] {
  if (filtro === 'tudo') return [...entregas]
  if (filtro === 'esperando') return entregas.filter((entrega) => entrega.estado === 'pendente')
  return entregas.filter((entrega) => entrega.funcao === filtro)
}

/**
 * A entrega se decide por `POST /v1/entregas/:id/decidir`? Só a versão adaptada pendente. O lote de correção se aprova
 * na tela de revisão, que grava o registro da validação (D56): aqui ele aparece, e a decisão dele não.
 */
export function decideAqui(entrega: Pick<Entrega, 'tipo' | 'estado'>): boolean {
  return entrega.tipo === 'versao_adaptada' && entrega.estado === 'pendente'
}

/** Os limites da justificativa de quem rejeita, os do contrato: o `CampoLongo` conta e o `problemaDoTexto` diz o que falta. */
export const LIMITES_DA_JUSTIFICATIVA = { minimo: TAMANHO_MINIMO_DA_JUSTIFICATIVA, maximo: TAMANHO_MAXIMO_DA_JUSTIFICATIVA } as const

/** O aviso do campo da justificativa: ela fala da saída da IA, e não de aluno (regra 20). */
export const AVISO_DA_JUSTIFICATIVA = 'Diga o que está errado na versão, para o Assistente refazer. Não escreva nome de aluno nem o motivo da adaptação.'

/** O que o diálogo de aprovar mostra antes de confirmar (regra 50, item 8): o que é, de qual turma, e o que muda. */
export function resumoDaAprovacao(entrega: Pick<Entrega, 'tipo' | 'titulo'>, nomeDaTurma: string | undefined): readonly [{ rotulo: string; valor: string }, ...{ rotulo: string; valor: string }[]] {
  return [
    { rotulo: NOME_DO_TIPO_DE_ENTREGA[entrega.tipo], valor: entrega.titulo },
    { rotulo: 'Turma', valor: nomeDaTurma ?? 'Turma da atividade' },
    { rotulo: 'Feita por', valor: 'Assistente de ensino, com IA' },
  ]
}

export const EFEITO_DE_APROVAR = 'Só depois da sua aprovação esta versão pode ir aos alunos da turma. Fica registrado que você aprovou, com a data e a hora.'
export const EFEITO_DE_REJEITAR = 'A versão não vai aos alunos. Fica registrado que você rejeitou, com a data, a hora e o motivo.'
