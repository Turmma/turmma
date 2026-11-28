import type { MinhaAtividade, SituacaoDaMinhaAtividade } from '@educa/shared'
import { formatQuantity } from '../../format'

/**
 * O que a lista de atividades do aluno diz (MVP, A3; `docs/interface.md` 2 e 11.6): o estado de cada atividade **em
 * texto**, e nada sobre mais ninguém. O contrato de `GET /v1/minhas-atividades` não traz colega, média nem posição, e a
 * tela não tem de onde tirar (regra 50, item 9). Não existe "atrasada" nem contagem de tempo: atraso não é dito por
 * pressão (D59).
 */

/** O estado da atividade, como o aluno o lê. Começar e continuar são a mesma coisa para ele: é para fazer. */
export const TEXTO_DA_SITUACAO: Readonly<Record<SituacaoDaMinhaAtividade, string>> = {
  para_fazer: 'Para fazer',
  em_andamento: 'Para fazer',
  enviada: 'Entregue',
  encerrada: 'Encerrada',
  com_diagnostico: 'Corrigida',
}

/** O aviso da atividade avaliativa, dito **antes** de o aluno abrir: enquanto ela está aberta, o Tutor da turma para. */
export const AVISO_DA_AVALIACAO = 'Avaliação: o Tutor fica pausado até quem dá a aula encerrar.'

/** O que se diz enquanto a correção espera a professora: é o que separa "entregue" de "corrigida" (regra 70, item 3). */
export const TEXTO_DA_ESPERA_PELA_CORRECAO = 'Quem dá a aula ainda vai revisar a correção.'

/** A atividade ainda recebe resposta do aluno? */
export function estaParaResponder(atividade: Pick<MinhaAtividade, 'situacao'>): boolean {
  return atividade.situacao === 'para_fazer' || atividade.situacao === 'em_andamento'
}

/** O fuso da escola (o mesmo de `FUSO_DO_USO` na API): "10:00" é a hora da parede da escola, e não a do computador. */
export const FUSO_DA_ESCOLA = 'America/Sao_Paulo'

function partesNaEscola(iso: string): Record<'day' | 'month' | 'hour' | 'minute', string> {
  const partes = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_DA_ESCOLA, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso))
  const valor = (tipo: string): string => partes.find((parte) => parte.type === tipo)?.value ?? ''
  return { day: valor('day'), month: valor('month'), hour: valor('hour'), minute: valor('minute') }
}

/** "24/11 às 10:00": o dia e a hora da escola. */
export function diaEHoraNaEscola(iso: string): string {
  const { day, month, hour, minute } = partesNaEscola(iso)
  return `${day}/${month} às ${hour}:${minute}`
}

/** "11:40": a hora da escola. */
export function horaNaEscola(iso: string): string {
  const { hour, minute } = partesNaEscola(iso)
  return `${hour}:${minute}`
}

/**
 * Onde a janela da prova está em relação a agora, **pelo relógio deste computador**: `antes` (ainda não abriu), `aberta` e `depois` (já fechou). É o que a lista e "Antes de começar" dizem; quem decide, de
 * verdade, é o servidor (`PROVA_FORA_DA_JANELA`), e a tela dele vale mais que esta conta. Sem janela, a atividade não tem prova online: `aberta`.
 */
export type SituacaoDaJanela = 'antes' | 'aberta' | 'depois'

export function situacaoDaJanela(janela: MinhaAtividade['janela'], agora: number): SituacaoDaJanela {
  if (janela === null) return 'aberta'
  if (agora < Date.parse(janela.abreEm)) return 'antes'
  return agora >= Date.parse(janela.fechaEm) ? 'depois' : 'aberta'
}

/**
 * A linha da janela na lista (RF7): "Abre em 24/11 às 10:00" enquanto a prova não abriu, e "Fechou" quando passou sem o aluno ter começado. Quem já começou segue pela situação dele: a prova que ele
 * ainda faz depois do fim da janela (a extensão, a queda) não "fechou" para ele. Sem janela, nada.
 */
export function textoDaJanelaNaLista(atividade: Pick<MinhaAtividade, 'janela' | 'situacao'>, agora: number): string | undefined {
  if (atividade.janela === null || atividade.situacao !== 'para_fazer') return undefined
  const situacao = situacaoDaJanela(atividade.janela, agora)
  if (situacao === 'antes') return `Abre em ${diaEHoraNaEscola(atividade.janela.abreEm)}`
  return situacao === 'depois' ? 'Fechou' : undefined
}

/** A linha de apoio da atividade: a disciplina e o tamanho. Sem prazo e sem tempo: o contrato não tem, e a tela não inventa. */
export function resumoDaAtividade(atividade: Pick<MinhaAtividade, 'disciplina' | 'questoes'>): string {
  return `${atividade.disciplina.nome} · ${formatQuantity(atividade.questoes, 'questão', 'questões')}`
}

/**
 * O que a linha da atividade explica, pelo estado. **Só o `com_diagnostico` fala de resultado**: enviada e encerrada
 * dizem que a correção ainda vai ser revista, e nunca o que ela achou.
 */
export function detalheDaSituacao(atividade: Pick<MinhaAtividade, 'situacao' | 'respondidas' | 'questoes'>): string {
  if (atividade.situacao === 'para_fazer') return 'Você ainda não começou.'
  if (atividade.situacao === 'em_andamento') return `Você respondeu ${String(atividade.respondidas)} de ${String(atividade.questoes)}. Dá para continuar de onde parou.`
  if (atividade.situacao === 'enviada') return TEXTO_DA_ESPERA_PELA_CORRECAO
  if (atividade.situacao === 'encerrada') return `Quem dá a aula encerrou esta atividade. O que você marcou ficou guardado. ${TEXTO_DA_ESPERA_PELA_CORRECAO}`
  return 'A correção foi aprovada. Abra para ver os seus acertos por habilidade.'
}

/** O que a lista diz quando um grupo está vazio: um convite ou um fato, nunca uma cobrança (D59). */
export const VAZIO_DE_CADA_GRUPO = {
  paraFazer: 'Nada para fazer agora.',
  entregues: 'Nada esperando quem dá a aula.',
  corrigidas: 'Nenhuma corrigida ainda.',
} as const

export interface AtividadesSeparadas<Atividade> {
  /** O que ainda espera resposta do aluno: vem primeiro, porque é o que há para fazer agora. */
  readonly paraFazer: readonly Atividade[]
  /** Enviadas e encerradas: a correção ainda não foi aprovada por quem dá a aula. */
  readonly entregues: readonly Atividade[]
  /** **Só** as de correção aprovada (`com_diagnostico`): "Corrigida" nunca é dita antes da aprovação (regra 70, item 3). */
  readonly corrigidas: readonly Atividade[]
}

/** Separa a lista em três grupos, **na ordem em que a API entregou**: a tela não reordena nem pontua. */
export function separarAtividades<Atividade extends Pick<MinhaAtividade, 'situacao'>>(atividades: readonly Atividade[]): AtividadesSeparadas<Atividade> {
  return {
    paraFazer: atividades.filter(estaParaResponder),
    entregues: atividades.filter((atividade) => atividade.situacao === 'enviada' || atividade.situacao === 'encerrada'),
    corrigidas: atividades.filter((atividade) => atividade.situacao === 'com_diagnostico'),
  }
}
