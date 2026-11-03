import type { CandidatoDaMarca, PreviaDaPlanilhaRow, ResumoDaImportacao, TipoDePlanilha } from '@educa/shared'
import type { AnoDeDestino, ImportacaoRepository } from './importacao.repository.js'

/**
 * O que um tipo de planilha entrega ao motor (F2, 4.0; Tech Spec, seção 5): ler o texto e dizer o que faria no ano (`previa`,
 * `planejar`), e escrever (`aplicar`). A trava, a assinatura, os estados e a auditoria são do motor, e valem igual para os quatro tipos.
 */

/** O que o tipo diz de uma planilha na prévia: as linhas, as contagens, o que a coordenação pode marcar, e o que o job vai ler. */
export interface PreviaDoTipo {
  readonly linhas: readonly PreviaDaPlanilhaRow[]
  readonly contagens: ResumoDaImportacao
  readonly candidatos: readonly CandidatoDaMarca[]
  /** O que o gravar guarda em `importacao_planilha.linhas`: já lido e validado, para o job não ler o texto de novo. */
  readonly guardado: unknown
  readonly assinatura: string
}

/** O que a planilha fará no ano, na leitura de agora: a `assinatura` do que foi visto, as contagens e a escrita. */
export interface PlanoDaImportacao {
  readonly assinatura: string
  readonly resumo: ResumoDaImportacao
  /** Escreve na transação do passo (3), com o que o `planejar` desta transação viu. */
  aplicar(gravacao: ImportacaoRepository): Promise<void>
}

export interface TipoDeImportacao {
  readonly tipo: TipoDePlanilha
  /** Só a lista por turma (7.0) usa o `turmaId` do corpo; nos outros tipos ele não existe, e vale como turma que não se acha. */
  readonly usaTurma: boolean
  previa(repositorio: ImportacaoRepository, ano: AnoDeDestino, texto: string): Promise<PreviaDoTipo>
  /** `undefined` quando o que o gravar guardou não tem a forma do tipo: o job falha de vez, sem repetir. */
  planejar(repositorio: ImportacaoRepository, ano: AnoDeDestino, guardado: unknown): Promise<PlanoDaImportacao | undefined>
}
