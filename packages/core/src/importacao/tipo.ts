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
  /**
   * Os nomes que a prévia leu do banco e mostrou à coordenação (os rótulos das marcas), por turma de onde saíram: cada turma vira
   * um `turma.alunos_lidos` na auditoria (regra 20, item 10), que o motor grava na prévia (não no gravar, que não mostra nome).
   */
  readonly leituras?: ReadonlyArray<{ readonly turmaId: string; readonly quantidade: number }>
}

/** Uma linha da lista de uma turma (A1), já separada do texto: o número dela no texto, o nome e a matrícula, sem espaço nas pontas. */
export interface ListaRow {
  readonly linha: number
  readonly nome: string
  readonly matricula: string
}

/** O pedido da lista de uma turma: a turma do caminho e as linhas que a API leu do texto (o formato da lista é o da A1, sem coluna de turma). */
export interface DaLista {
  readonly turmaId: string
  readonly linhas: readonly ListaRow[]
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
  /** O `turmaId` do corpo de `/v1/importacoes/:tipo` não existe em nenhum tipo (a lista por turma tem rota e entrada próprias); com ele, a resposta é a da turma que não se acha. */
  readonly usaTurma: boolean
}

/** O que o passo (3) dá ao `travar` de um tipo de um ano que cadastra professor: as contas que o passo (1) achou e a trava delas. */
export interface ContasDoPasso3 {
  readonly contas: ContasDoJob
  /** Trava em `FOR SHARE` as contas e confere o e-mail de cada uma; `false` se alguma o perdeu. */
  readonly travarContas: TravaDasContas
}

/** O tipo que grava num ano letivo: o calendário, a grade e a lista de alunos. */
export interface TipoDeImportacao extends TipoBase {
  readonly usaAno: true
  /**
   * O tipo que cadastra professor novo (a grade): o motor pega a trava do convite da escola antes do ano, a primeira da ordem global do passo
   * (3) depois da importação, porque o `convidar` a pede antes de ler o estado do professor.
   */
  readonly cadastraProfessores?: true
  previa(repositorio: ImportacaoRepository, ano: AnoDeDestino, texto: string): Promise<PreviaDoTipo>
  /**
   * Os e-mails do passo (1), um por pessoa, para o tipo de um ano que cadastra professor (a grade: só os professores que a escola ainda não
   * tem). Lida sem trava, e só diz de quem a conta se acha ou se cria; `undefined` quando o que o gravar guardou não tem a forma do tipo.
   */
  emailsDasContas?(repositorio: ImportacaoRepository, guardado: unknown): Promise<readonly string[] | undefined>
  /**
   * A trava do passo (3) que o tipo pede depois do ano e antes de o `planejar` ler (a planilha de alunos trava os anos dos vínculos de quem vai desligar, os usuários que escreve, as turmas que as
   * linhas tocam e as de origem de cada transferência marcada, em ordem de id e num comando, na ordem global da Tech Spec, seção 5;
   * a grade, os professores que cita, as contas dos novos e as turmas). O calendário não tem. As `marcas` são as da coordenação,
   * validadas contra os candidatos pelo gravar; o `passo3` só é usado por quem cadastra professor, e a `tx` é a do passo (3), para quem trava
   * por outro repository (os anos dos vínculos de quem vai desligar).
   */
  travar?(repositorio: ImportacaoRepository, ano: AnoDeDestino, guardado: unknown, marcas: MarcasDaPlanilha, passo3: ContasDoPasso3, tx: DatabaseTransaction): Promise<void>
  /** `undefined` quando o que o gravar guardou não tem a forma do tipo: o job falha de vez, sem repetir. As `contas` são as do passo (1), que só a grade usa; sem elas, vazias. */
  planejar(repositorio: ImportacaoRepository, ano: AnoDeDestino, guardado: unknown, marcas: MarcasDaPlanilha, contas?: ContasDoJob): Promise<PlanoDaImportacao | undefined>
  /**
   * A prévia da lista de uma turma (A1, 8.0): as mesmas linhas, o mesmo gravar e o mesmo job, com a turma já dada em vez de achada
   * pelo nome. Só a planilha de alunos a tem. A turma que não é da escola e do ano de destino é `NAO_ENCONTRADO`.
   */
  previaDaLista?(repositorio: ImportacaoRepository, ano: AnoDeDestino, lista: DaLista): Promise<PreviaDoTipo>
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
