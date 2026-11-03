import { randomUUID } from 'node:crypto'
import {
  ErrorCode,
  JOB_DEFINITIONS,
  TIPO_GRAVAR_PLANILHA,
  type GravarPlanilhaRequest,
  type PreviaDaPlanilhaRequest,
  type PreviaDaPlanilhaResponse,
  type ResumoDaImportacao,
  type TipoDePlanilha,
  previaDaPlanilhaResponseSchema,
} from '@educa/shared'
import { runInContext, currentContext } from '../context/context.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { AuditoriaRecorder } from '../auditoria/auditoria-recorder.js'
import { DomainException } from '../error/domain.exception.js'
import { postgresErrorIn } from '../error/summarize-error.js'
import type { JobOutbox } from '../queue/job-outbox.js'
import { ImportacaoRepository, type AnoDeDestino, type ImportacaoParaExecutar } from './importacao.repository.js'
import type { PreviaDoTipo, TipoDeImportacao } from './tipo.js'
import { tipoCalendario } from './tipos/calendario.js'

/**
 * O motor das planilhas (F2, 4.0; Tech Spec, seção 5): a prévia classifica, o gravar a refaz e enfileira, e o job a refaz de
 * novo e grava em três passos. Cada tipo de planilha (calendário na 4.0; professores, alunos e grade nas seguintes) entrega só
 * o que é dele: ler o texto, dizer o que faria no ano (`planejar`) e escrever (`aplicar`). A trava, a assinatura, os estados e
 * a auditoria são do motor, e valem igual para os quatro.
 */

/** Os tipos que o motor já sabe gravar. Os outros respondem `NAO_ENCONTRADO` até a tarefa deles chegar. */
const TIPOS_DO_MOTOR: Readonly<Partial<Record<TipoDePlanilha, TipoDeImportacao>>> = { calendario: tipoCalendario }

/** `lock_not_available` (o `lock_timeout` do passo 3), `deadlock_detected` e `serialization_failure`: o que se tenta de novo, com espera. */
const SQLSTATE_DE_TRAVA = new Set(['55P03', '40P01', '40001'])
const SQLSTATE_UNICO_VIOLADO = '23505'

const registro = new AuditoriaRecorder()

/** Resume uma falha do passo (3): trava e deadlock repetem com espera; o resto, não. */
export function ehFalhaDeTrava(erro: unknown): boolean {
  const codigo = postgresErrorIn(erro)?.code
  return codigo !== undefined && SQLSTATE_DE_TRAVA.has(codigo)
}

/** O tipo que o motor sabe gravar, ou `NAO_ENCONTRADO` (como a rota que não existe). */
function tipoDoMotor(tipo: TipoDePlanilha): TipoDeImportacao {
  const achado = TIPOS_DO_MOTOR[tipo]
  if (achado === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
  return achado
}

/** A prévia e o gravar, na escola e no ano da sessão. O banco entra por quem constrói (API e testes). */
export class MotorDePlanilha {
  constructor(
    private readonly banco: Database,
    private readonly enfileirador: Pick<JobOutbox, 'enfileirar'>,
  ) {}

  /**
   * `POST /v1/importacoes/:tipo/previa`: o que cada linha faria, sem gravar nada. O `turmaId` num tipo que não usa turma, o ano
   * que não é o em curso nem um planejado da escola, e o tipo que o motor ainda não grava, respondem `NAO_ENCONTRADO`, como o id
   * de outra escola (regra 10, item 6); cabeçalho errado ou planilha sem linha, `ENTRADA_INVALIDA`.
   */
  async previa(tipo: TipoDePlanilha, pedido: PreviaDaPlanilhaRequest): Promise<PreviaDaPlanilhaResponse> {
    const { previa } = await this.preparar(tipo, pedido)
    return previaDaPlanilhaResponseSchema.parse({ linhas: previa.linhas, contagens: previa.contagens, candidatos: previa.candidatos })
  }

  /**
   * `POST /v1/importacoes/:tipo`: refaz a prévia (planilha com erro de linha, ou marca fora dos candidatos: `ENTRADA_INVALIDA`),
   * fecha `falhou` a `na_fila` de mais de 1 h e enfileira o job `estrutura.gravar-planilha`, na mesma transação da importação.
   * Já há uma `na_fila` na escola (o único parcial), ou a velha está sob um job que roda: `CONFLITO`, sem esperar.
   */
  async gravar(tipo: TipoDePlanilha, pedido: GravarPlanilhaRequest): Promise<{ readonly id: string }> {
    const { ano, previa } = await this.preparar(tipo, pedido)
    if (previa.linhas.some((linha) => linha.resultado === 'erro')) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
    const candidatos = new Set(previa.candidatos.map((candidato) => candidato.id))
    const marcadas = [...pedido.marcas.transferir, ...pedido.marcas.desligar, ...pedido.marcas.encerrar]
    if (marcadas.some((id) => !candidatos.has(id))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
    // Já há `na_fila` na escola: o único parcial viola `23505`, que o filtro global de erros responde como `CONFLITO`.
    return this.banco.transaction(async (tx) => {
      const importacoes = new ImportacaoRepository(tx)
      await importacoes.fecharAExpirada()
      const id = await importacoes.criar({ tipo, anoLetivoId: ano.id, linhas: previa.guardado, marcas: pedido.marcas, assinatura: previa.assinatura })
      await this.enfileirador.enfileirar(tx, TIPO_GRAVAR_PLANILHA, { importacaoId: id })
      return { id }
    })
  }

  private async preparar(tipo: TipoDePlanilha, pedido: PreviaDaPlanilhaRequest): Promise<{ ano: AnoDeDestino; previa: PreviaDoTipo }> {
    const doTipo = tipoDoMotor(tipo)
    if (pedido.turmaId !== undefined && !doTipo.usaTurma) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const repositorio = new ImportacaoRepository(this.banco)
    const ano = await repositorio.anoDeDestino(pedido.anoLetivoId)
    if (ano === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return { ano, previa: await doTipo.previa(repositorio, ano, pedido.texto) }
  }
}

/** Como o job terminou: `ignorada` é a importação que já não estava `na_fila` (outra execução a fechou, ou o expurgo). */
export type ResultadoDaExecucao = 'concluida' | 'desatualizada' | 'ignorada'

export interface ExecucaoOptions {
  /** Quanto durou o passo (3), da trava ao commit, em segundos. Só a execução que chegou a ele mede. */
  readonly aoMedirOPasso3?: (segundos: number) => void
}

/** A importação guardada não tem a forma do tipo, ou o tipo não existe: repetir não muda nada. */
export class ImportacaoIlegivelError extends Error {
  constructor() {
    super('importacao_ilegivel')
    this.name = 'ImportacaoIlegivelError'
  }
}

/**
 * O job `estrutura.gravar-planilha` em três passos (Tech Spec, seção 5), na escola do contexto do job.
 *
 * (1) as contas dos professores: só o tipo professores (6.0). (2) Sem trava: lê a importação (fora de `na_fila`, sai) e refaz a
 * classificação; assinatura diferente, ou ano encerrado, é `desatualizada`. (3) Uma transação curta (`lock_timeout` de 1 s,
 * `statement_timeout` de 1,5 s) que trava na ordem global, a mesma do `desativar` e do `eliminar`: a importação (`for update`),
 * o ano (`for share`) e, nos tipos de alunos e grade, usuários, contas, turmas e pedidos. Relê o que o (2) usou, e aplica; a
 * troca de estado e a auditoria saem na mesma transação.
 *
 * Trava esgotada ou deadlock sobem como erro (a fila repete com espera crescente); o chamador decide `falhou` na última
 * tentativa. Único violado no (3) desfaz a transação e a importação sai `desatualizada`, nunca `falhou`.
 */
export async function executarPlanilha(banco: Database, importacaoId: string, opcoes: ExecucaoOptions = {}): Promise<ResultadoDaExecucao> {
  const repositorio = new ImportacaoRepository(banco)
  const lida = await repositorio.paraExecutar(importacaoId)
  if (lida?.estado !== 'na_fila') return 'ignorada'
  const alvo = alvoDe(lida)
  if (!(await passo2(repositorio, alvo, lida.linhas))) return desatualizar(repositorio, importacaoId)
  const inicio = performance.now()
  try {
    const resultado = await banco.transaction((tx) => passo3(new ImportacaoRepository(tx), tx, alvo))
    opcoes.aoMedirOPasso3?.((performance.now() - inicio) / 1_000)
    return resultado
  } catch (erro) {
    if (postgresErrorIn(erro)?.code === SQLSTATE_UNICO_VIOLADO) return desatualizar(repositorio, importacaoId)
    throw erro
  }
}

/** O tipo e o ano da importação guardada; sem um dos dois, ela não tem como ser gravada (`ImportacaoIlegivelError`). */
function alvoDe({ id, tipo, anoLetivoId, assinatura }: ImportacaoParaExecutar): Alvo {
  const doTipo = TIPOS_DO_MOTOR[tipo]
  if (doTipo === undefined || anoLetivoId === null) throw new ImportacaoIlegivelError()
  return { importacaoId: id, anoLetivoId, tipo: doTipo, assinatura }
}

/** Passo (2), sem trava: o ano ainda aceita a planilha e a classificação de agora tem a assinatura que o gravar viu. */
async function passo2(repositorio: ImportacaoRepository, { anoLetivoId, tipo, assinatura }: Alvo, linhas: unknown): Promise<boolean> {
  const ano = await repositorio.anoPorId(anoLetivoId)
  if (ano === undefined || ano.situacao === 'encerrado') return false
  const vista = await tipo.planejar(repositorio, ano, linhas)
  if (vista === undefined) throw new ImportacaoIlegivelError()
  return vista.assinatura === assinatura
}

/** O que o passo (3) precisa saber da importação que o (2) leu. */
interface Alvo {
  readonly importacaoId: string
  readonly anoLetivoId: string
  readonly tipo: TipoDeImportacao
  readonly assinatura: string
}

/**
 * A transação do passo (3), nesta ordem: os tempos, a importação (`for update`; fora de `na_fila`, sai), o ano (`for share`), a
 * releitura do que o (2) usou e a escrita. A troca de estado e a auditoria saem na mesma transação.
 */
async function passo3(gravacao: ImportacaoRepository, tx: DatabaseTransaction, { importacaoId, anoLetivoId, tipo, assinatura }: Alvo): Promise<ResultadoDaExecucao> {
  await gravacao.limitesDoPasso3()
  const travada = await gravacao.travar(importacaoId)
  if (travada?.estado !== 'na_fila') return 'ignorada'
  // Quem gravou já saiu (a eliminação da pessoa anula `criado_por`): sem autor humano a gravação não tem de quem ser a auditoria.
  if (travada.criadoPor === null) return desatualizar(gravacao, importacaoId)
  const ano = await gravacao.anoPorId(anoLetivoId, true)
  if (ano === undefined || ano.situacao === 'encerrado') return desatualizar(gravacao, importacaoId)
  const plano = await tipo.planejar(gravacao, ano, travada.linhas)
  if (plano === undefined) throw new ImportacaoIlegivelError()
  if (plano.assinatura !== assinatura) return desatualizar(gravacao, importacaoId)
  await plano.aplicar(gravacao)
  if (!(await gravacao.concluir(importacaoId, plano.resumo))) throw new DomainException(ErrorCode.ERRO_INTERNO)
  await auditar(tx, importacaoId, travada.tipo, plano.resumo, travada.criadoPor)
  return 'concluida'
}

/** Fecha `desatualizada` a importação que ainda está `na_fila`; se outra execução já a fechou, ela foi `ignorada`. */
async function desatualizar(repositorio: ImportacaoRepository, importacaoId: string): Promise<ResultadoDaExecucao> {
  return (await repositorio.desatualizar(importacaoId)) ? 'desatualizada' : 'ignorada'
}

/**
 * `planilha.gravada`, na transação do passo (3), com a coordenação que gravou como autora: o job não tem usuário no contexto, e o
 * registro lê o autor de lá. A rotina não assina esta ação (`auditoria_rotina_so_nas_acoes`).
 */
async function auditar(tx: DatabaseTransaction, importacaoId: string, tipo: TipoDePlanilha, resumo: ResumoDaImportacao, autor: string): Promise<void> {
  const contexto = currentContext()
  const { nomes_corrigidos: corrigidos, ...resto } = resumo
  const depois = { tipo, contagens: { ...resto, ...(corrigidos === undefined ? {} : { corrigidos }) } }
  await runInContext({ ...contexto, requisicaoId: contexto?.requisicaoId ?? randomUUID(), usuarioId: autor }, () => registro.gravar(tx, 'planilha.gravada', { entidadeId: importacaoId, depois }))
}

/** Quantas tentativas o BullMQ dá ao job; a última é a que decide `falhou`. */
export const TENTATIVAS_DO_JOB = JOB_DEFINITIONS[TIPO_GRAVAR_PLANILHA].retentativa.tentativas

