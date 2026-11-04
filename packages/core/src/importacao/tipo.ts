import type { CandidatoDaMarca, MarcasDaPlanilha, PreviaDaPlanilhaRow, ResumoDaImportacao, TipoDePlanilha } from '@educa/shared'
import type { CicloDeVidaService } from '../ciclo-de-vida/ciclo-de-vida.service.js'
import type { DatabaseTransaction } from '../db/database.js'
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

/** O que o `aplicar` usa além do repository: a transação do passo (3) e o ciclo de vida, para desativar na mesma transação. */
export interface AmbienteDaGravacao {
  readonly tx: DatabaseTransaction
  readonly ciclo: CicloDeVidaService
}

/** O que a planilha fará no ano, na leitura de agora: a `assinatura` do que foi visto, as contagens e a escrita. */
export interface PlanoDaImportacao {
  readonly assinatura: string
  readonly resumo: ResumoDaImportacao
  /** Escreve na transação do passo (3), com o que o `planejar` desta transação viu. */
  aplicar(gravacao: ImportacaoRepository, ambiente: AmbienteDaGravacao): Promise<void>
}

interface TipoBase {
  readonly tipo: TipoDePlanilha
  /** Só a lista por turma (7.0) usa o `turmaId` do corpo; nos outros tipos ele não existe, e vale como turma que não se acha. */
  readonly usaTurma: boolean
}

/** O tipo que grava num ano letivo: o calendário, a grade e a lista de alunos. */
export interface TipoDeImportacao extends TipoBase {
  readonly usaAno: true
  previa(repositorio: ImportacaoRepository, ano: AnoDeDestino, texto: string): Promise<PreviaDoTipo>
  /**
   * A trava do passo (3) que o tipo pede depois do ano e antes de o `planejar` ler (a planilha de alunos trava as turmas que as
   * linhas tocam, em ordem de id e num comando, na ordem global da Tech Spec, seção 5). O calendário não tem.
   */
  travar?(repositorio: ImportacaoRepository, ano: AnoDeDestino, guardado: unknown): Promise<void>
  /** `undefined` quando o que o gravar guardou não tem a forma do tipo: o job falha de vez, sem repetir. */
  planejar(repositorio: ImportacaoRepository, ano: AnoDeDestino, guardado: unknown): Promise<PlanoDaImportacao | undefined>
}

/** As contas que o passo (1) achou ou criou, pelo e-mail normalizado: o `id` de cada uma. */
export type ContasDoJob = ReadonlyMap<string, string>

/** Trava as contas do passo (1) e confere o e-mail de cada uma; `false` se alguma o perdeu. É do worker, que alcança a conta global; o motor só a repassa. */
export type TravaDasContas = (contas: ContasDoJob) => Promise<boolean>

/**
 * O tipo que não é de um ano (a planilha de professores, `anoLetivoId` nulo): funciona com a escola sem ano em curso. Tem o
 * passo (1), as contas, e a trava própria do passo (3), porque escreve em usuário, conta e turma.
 */
export interface TipoSemAno extends TipoBase {
  readonly usaAno: false
  previa(repositorio: ImportacaoRepository, texto: string): Promise<PreviaDoTipo>
  /** Os e-mails do passo (1), um por pessoa e em ordem; `undefined` quando o que o gravar guardou não tem a forma do tipo. */
  emailsDasContas(guardado: unknown): readonly string[] | undefined
  /**
   * A trava do passo (3) depois da importação, na ordem global da Tech Spec (seção 5): a trava do convite da escola, os anos, os
   * usuários que vai escrever, as contas (`FOR SHARE`, com o e-mail conferido) e as turmas. Sem ela o `planejar` não lê.
   */
  travar(repositorio: ImportacaoRepository, tx: DatabaseTransaction, guardado: unknown, marcas: MarcasDaPlanilha, contas: ContasDoJob, travarContas: TravaDasContas): Promise<void>
  /** `undefined` quando o que o gravar guardou não tem a forma do tipo. */
  planejar(repositorio: ImportacaoRepository, guardado: unknown, marcas: MarcasDaPlanilha, contas: ContasDoJob): Promise<PlanoDaImportacao | undefined>
}

export type TipoDoMotor = TipoDeImportacao | TipoSemAno
