import { randomUUID } from 'node:crypto'
import {
  ErrorCode,
  InvariantException,
  JOB_DEFINITIONS,
  TIPO_GRAVAR_PLANILHA,
  marcasDaPlanilhaSchema,
  type GravarPlanilhaRequest,
  type MarcasDaPlanilha,
  type PreviaDaPlanilhaRequest,
  type PreviaDaPlanilhaResponse,
  type ResumoDaImportacao,
  type TipoDePlanilha,
  previaDaPlanilhaResponseSchema,
} from '@educa/shared'
import { runInContext, currentContext } from '../context/context.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { AuditoriaRecorder } from '../auditoria/auditoria-recorder.js'
import { CicloDeVidaService } from '../ciclo-de-vida/ciclo-de-vida.service.js'
import { DomainException } from '../error/domain.exception.js'
import { postgresErrorIn } from '../error/summarize-error.js'
import type { JobOutbox } from '../queue/job-outbox.js'
import { DiferencaNaPlanilhaError } from './erros.js'
import { ImportacaoRepository, type AnoDeDestino, type ImportacaoParaExecutar } from './importacao.repository.js'
import type { ContasDoJob, PlanoDaImportacao, PreviaDoTipo, TipoDoMotor } from './tipo.js'
import { tipoAlunos } from './tipos/alunos.js'
import { tipoCalendario } from './tipos/calendario.js'
import { tipoProfessores } from './tipos/professores.js'

/**
 * O motor das planilhas (F2, 4.0; Tech Spec, seção 5): a prévia classifica, o gravar a refaz e enfileira, e o job a refaz de
 * novo e grava em três passos. Cada tipo de planilha (calendário na 4.0, professores na 6.0, alunos na 7.0; a grade na seguinte) entrega só
 * o que é dele: ler o texto, dizer o que faria no ano (`planejar`) e escrever (`aplicar`). A trava, a assinatura, os estados e
 * a auditoria são do motor, e valem igual para os quatro.
 */

/** Os tipos que o motor já sabe gravar. Os outros respondem `NAO_ENCONTRADO` até a tarefa deles chegar. */
const TIPOS_DO_MOTOR: Readonly<Partial<Record<TipoDePlanilha, TipoDoMotor>>> = { alunos: tipoAlunos, calendario: tipoCalendario, professores: tipoProfessores }

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
function tipoDoMotor(tipo: TipoDePlanilha): TipoDoMotor {
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
      const id = await importacoes.criar({ tipo, anoLetivoId: ano?.id ?? null, linhas: previa.guardado, marcas: pedido.marcas, assinatura: previa.assinatura })
      await this.enfileirador.enfileirar(tx, TIPO_GRAVAR_PLANILHA, { importacaoId: id })
      return { id }
    })
  }

  /**
   * O tipo de um ano (calendário, grade, alunos) grava no ano em curso ou no planejado que a coordenação escolheu; o de professores
   * não é de um ano: funciona com a escola sem ano em curso, e um `anoLetivoId` no corpo responde como o inexistente.
   */
  private async preparar(tipo: TipoDePlanilha, pedido: PreviaDaPlanilhaRequest): Promise<{ ano: AnoDeDestino | undefined; previa: PreviaDoTipo }> {
    const doTipo = tipoDoMotor(tipo)
    if (pedido.turmaId !== undefined && !doTipo.usaTurma) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const repositorio = new ImportacaoRepository(this.banco)
    if (!doTipo.usaAno) {
      if (pedido.anoLetivoId !== undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      return { ano: undefined, previa: await doTipo.previa(repositorio, pedido.texto) }
    }
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
  /**
   * Acha ou cria a conta do e-mail do professor (passo (1)), na transação que o motor abre para cada uma. É do worker, e não do
   * core: a função alcança a conta global sem escopo, e só o processor do job pode importá-la (Tech Spec, seção 6; as duas
   * guardas de cerca). Obrigatória na planilha de professores.
   */
  readonly acharConta?: (tx: DatabaseTransaction, email: string) => Promise<{ readonly id: string }>
  /**
   * Trava em `FOR SHARE` as contas que o passo (1) achou e confere o e-mail de cada uma (passo (3)), na transação do passo; `false`
   * se alguma o perdeu. Também é do worker, pelo mesmo motivo do `acharConta`. Obrigatória na planilha de professores.
   */
  readonly travarContas?: (tx: DatabaseTransaction, contas: ReadonlyMap<string, string>) => Promise<boolean>
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
 * (1) as contas dos professores: só o tipo professores (6.0), cada uma numa transação curta e na ordem do e-mail. (2) Sem trava:
 * lê a importação (fora de `na_fila`, sai) e refaz a classificação; assinatura diferente, ou ano encerrado, é `desatualizada`.
 * (3) Uma transação curta (`lock_timeout` de 1 s, `statement_timeout` de 1,5 s) que trava na ordem global, a mesma do `desativar`
 * e do `eliminar`: a importação (`for update`), o ano (`for share`) e, nos tipos que escrevem em pessoa, o que o tipo trava
 * (`travar`: a trava do convite da escola, anos, usuários, contas e turmas). Relê o que o (2) usou, e aplica; a troca de estado e
 * a auditoria saem na mesma transação.
 *
 * Trava esgotada ou deadlock sobem como erro (a fila repete com espera crescente); o chamador decide `falhou` na última
 * tentativa. Único violado, ou o que a prévia viu e já não é verdade (`DiferencaNaPlanilhaError`), desfaz a transação e a
 * importação sai `desatualizada`, nunca `falhou`. Conta que perdeu o e-mail entre o (1) e o (3) também desfaz, mas sobe como erro:
 * a nova tentativa refaz o (1).
 */
export async function executarPlanilha(banco: Database, importacaoId: string, opcoes: ExecucaoOptions = {}): Promise<ResultadoDaExecucao> {
  const repositorio = new ImportacaoRepository(banco)
  const lida = await repositorio.paraExecutar(importacaoId)
  if (lida?.estado !== 'na_fila') return 'ignorada'
  const alvo = alvoDe(lida)
  const contas = await passo1(banco, alvo, lida.linhas, opcoes)
  if (!(await passo2(repositorio, alvo, lida.linhas, contas))) return desatualizar(repositorio, importacaoId)
  const inicio = performance.now()
  try {
    const resultado = await banco.transaction((tx) => passo3(banco, new ImportacaoRepository(tx), tx, alvo, contas, opcoes))
    opcoes.aoMedirOPasso3?.((performance.now() - inicio) / 1_000)
    return resultado
  } catch (erro) {
    if (erro instanceof DiferencaNaPlanilhaError || postgresErrorIn(erro)?.code === SQLSTATE_UNICO_VIOLADO) return desatualizar(repositorio, importacaoId)
    throw erro
  }
}

/** O tipo, o ano (nulo só no tipo sem ano) e as marcas da importação guardada; se um deles não existe ou não tem a forma, ela não tem como ser gravada (`ImportacaoIlegivelError`). */
function alvoDe({ id, tipo, anoLetivoId, assinatura, marcas }: ImportacaoParaExecutar): Alvo {
  const doTipo = TIPOS_DO_MOTOR[tipo]
  if (doTipo === undefined || (doTipo.usaAno && anoLetivoId === null)) throw new ImportacaoIlegivelError()
  return { importacaoId: id, anoLetivoId, tipo: doTipo, assinatura, marcas: lerMarcas(marcas) }
}

function lerMarcas(guardadas: unknown): MarcasDaPlanilha {
  const lidas = marcasDaPlanilhaSchema.safeParse(guardadas)
  if (!lidas.success) throw new ImportacaoIlegivelError()
  return lidas.data
}

/** Passo (1): as contas dos e-mails do tipo sem ano, uma transação curta cada e na ordem do e-mail (duas escolas com os mesmos professores não se esperam em cruz). */
async function passo1(banco: Database, { tipo }: Alvo, linhas: unknown, opcoes: ExecucaoOptions): Promise<ContasDoJob> {
  if (tipo.usaAno) return new Map()
  const emails = tipo.emailsDasContas(linhas)
  const achar = opcoes.acharConta
  const travar = opcoes.travarContas
  if (emails === undefined) throw new ImportacaoIlegivelError()
  if (achar === undefined || travar === undefined) throw new InvariantException('a planilha de professores precisa do achar-ou-criar conta e da trava das contas do worker')
  const contas = new Map<string, string>()
  for (const email of emails) contas.set(email, (await banco.transaction((tx) => achar(tx, email))).id)
  return contas
}

/** Passo (2), sem trava: o ano ainda aceita a planilha e a classificação de agora tem a assinatura que o gravar viu. */
async function passo2(repositorio: ImportacaoRepository, alvo: Alvo, linhas: unknown, contas: ContasDoJob): Promise<boolean> {
  const { anoLetivoId, tipo, assinatura, marcas } = alvo
  if (tipo.usaAno) {
    const ano = anoLetivoId === null ? undefined : await repositorio.anoPorId(anoLetivoId)
    if (ano === undefined || ano.situacao === 'encerrado') return false
    const vista = await tipo.planejar(repositorio, ano, linhas)
    if (vista === undefined) throw new ImportacaoIlegivelError()
    return vista.assinatura === assinatura
  }
  const vista = await tipo.planejar(repositorio, linhas, marcas, contas)
  if (vista === undefined) throw new ImportacaoIlegivelError()
  return vista.assinatura === assinatura
}

/** O que o passo (3) precisa saber da importação que o (2) leu. */
interface Alvo {
  readonly importacaoId: string
  readonly anoLetivoId: string | null
  readonly tipo: TipoDoMotor
  readonly assinatura: string
  readonly marcas: MarcasDaPlanilha
}

/**
 * A transação do passo (3), nesta ordem: os tempos, a importação (`for update`; fora de `na_fila`, sai), o ano (`for share`, nos
 * tipos de um ano) ou a trava do tipo sem ano, a releitura do que o (2) usou e a escrita. A troca de estado e a auditoria saem na
 * mesma transação, e a escrita roda com a coordenação que gravou como autora: o `desativar` e o `convidar` auditam com ela.
 */
async function passo3(banco: Database, gravacao: ImportacaoRepository, tx: DatabaseTransaction, alvo: Alvo, contas: ContasDoJob, opcoes: ExecucaoOptions): Promise<ResultadoDaExecucao> {
  const { importacaoId, assinatura } = alvo
  await gravacao.limitesDoPasso3()
  const travada = await gravacao.travar(importacaoId)
  if (travada?.estado !== 'na_fila') return 'ignorada'
  // Quem gravou já saiu (a eliminação da pessoa anula `criado_por`): sem autor humano a gravação não tem de quem ser a auditoria.
  if (travada.criadoPor === null) return desatualizar(gravacao, importacaoId)
  const autor = travada.criadoPor
  const plano = await planejarSobTrava(gravacao, tx, alvo, travada.linhas, lerMarcas(travada.marcas), contas, opcoes)
  if (plano === 'encerrado') return desatualizar(gravacao, importacaoId)
  if (plano.assinatura !== assinatura) return desatualizar(gravacao, importacaoId)
  await comAutora(autor, () => plano.aplicar(gravacao, { tx, ciclo: new CicloDeVidaService(banco) }))
  if (!(await gravacao.concluir(importacaoId, plano.resumo))) throw new DomainException(ErrorCode.ERRO_INTERNO)
  await auditar(tx, importacaoId, travada.tipo, plano.resumo, autor)
  return 'concluida'
}

/** O plano de agora, lido já com as travas do tipo; `encerrado` é o ano que deixou de aceitar a planilha entre o (2) e o (3). */
async function planejarSobTrava(gravacao: ImportacaoRepository, tx: DatabaseTransaction, { anoLetivoId, tipo }: Alvo, linhas: unknown, marcas: MarcasDaPlanilha, contas: ContasDoJob, opcoes: ExecucaoOptions): Promise<PlanoDaImportacao | 'encerrado'> {
  if (!tipo.usaAno) {
    const travarContas = opcoes.travarContas
    if (travarContas === undefined) throw new InvariantException('a planilha de professores precisa da trava das contas do worker')
    await tipo.travar(gravacao, tx, linhas, marcas, contas, (daVez) => travarContas(tx, daVez))
    const plano = await tipo.planejar(gravacao, linhas, marcas, contas)
    if (plano === undefined) throw new ImportacaoIlegivelError()
    return plano
  }
  const ano = anoLetivoId === null ? undefined : await gravacao.anoPorId(anoLetivoId, true)
  if (ano === undefined || ano.situacao === 'encerrado') return 'encerrado'
  await tipo.travar?.(gravacao, ano, linhas)
  const plano = await tipo.planejar(gravacao, ano, linhas)
  if (plano === undefined) throw new ImportacaoIlegivelError()
  return plano
}

/** Fecha `desatualizada` a importação que ainda está `na_fila`; se outra execução já a fechou, ela foi `ignorada`. */
async function desatualizar(repositorio: ImportacaoRepository, importacaoId: string): Promise<ResultadoDaExecucao> {
  return (await repositorio.desatualizar(importacaoId)) ? 'desatualizada' : 'ignorada'
}

/** Roda `acao` com a coordenação que gravou como autora: o job não tem usuário no contexto, e o registro de auditoria lê o autor de lá. */
function comAutora<T>(autor: string, acao: () => Promise<T>): Promise<T> {
  const contexto = currentContext()
  return runInContext({ ...contexto, requisicaoId: contexto?.requisicaoId ?? randomUUID(), usuarioId: autor }, acao)
}

/**
 * `planilha.gravada`, na transação do passo (3), com a coordenação que gravou como autora. A rotina não assina esta ação
 * (`auditoria_rotina_so_nas_acoes`).
 */
async function auditar(tx: DatabaseTransaction, importacaoId: string, tipo: TipoDePlanilha, resumo: ResumoDaImportacao, autor: string): Promise<void> {
  const { nomes_corrigidos: corrigidos, ...resto } = resumo
  const depois = { tipo, contagens: { ...resto, ...(corrigidos === undefined ? {} : { corrigidos }) } }
  await comAutora(autor, () => registro.gravar(tx, 'planilha.gravada', { entidadeId: importacaoId, depois }))
}

/** Quantas tentativas o BullMQ dá ao job; a última é a que decide `falhou`. */
export const TENTATIVAS_DO_JOB = JOB_DEFINITIONS[TIPO_GRAVAR_PLANILHA].retentativa.tentativas

