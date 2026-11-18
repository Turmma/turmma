import {
  AgendamentoDaClassificacaoRepository,
  currentContext,
  EXECUCOES_POR_NOITE_DA_ESCOLA,
  requireEscolaId,
  runInContext,
  SECOES_POR_EXECUCAO,
  SECOES_POR_LOTE_DO_AGENDAMENTO,
  summarizeError,
  type Clock,
  type AlvoDaMudancaDeRecorte,
  type CronEscolasRepository,
  type Database,
  type JanelaLetiva,
  type JobOutbox,
  type JobProcessor,
  type LoggerBase,
  type OperationalSettings,
  JobFailureError,
} from '@educa/core'
import { InvariantException, JobFailureCode, TIPO_AGENDAR_CLASSIFICACAO, type TIPO_AGENDAR_CLASSIFICACAO_DAS_ESCOLAS } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { chaveDaNoite } from './expurgar-dado-pessoal.js'

/** O `statement_timeout` de cada lote: 500 seções leem e gravam em segundos, e a consulta que passa disso é cortada em vez de segurar a transação (Tech Spec, seção 7c, "Laços"). */
const PRAZO_DO_LOTE_MS = 20_000

export interface RotinaDaClassificacaoDependencies {
  escolas: Pick<CronEscolasRepository, 'listarIds'>
  banco: Database
  enfileirador: Pick<JobOutbox, 'enfileirarUmaVez'>
  /** O horário letivo da escola do contexto: dele sai o fuso da data local da chave. */
  janelaDaEscola: Pick<OperationalSettings<JanelaLetiva>, 'daEscola'>
  relogio: Clock
  logger: LoggerBase
}

/**
 * `sistema.agendar-classificacao` (classificacao-bncc, tarefa 5.0; Tech Spec, seção 5, "Agendar" (a)), às 19h: lista as escolas (`CronEscolasRepository`, a única consulta sem escopo da rotina) e, **no contexto de cada uma**,
 * grava um `material.agendar-classificacao` na fila de lote, não urgente, com a data local da noite no fuso dela por chave. Rodar duas vezes na mesma noite, ou duas réplicas ao mesmo tempo, dá um job por escola. Como a rotina
 * do expurgo, uma escola que falha não segura as outras: a rotina segue e, no fim, falha o job, para a fila tentar de novo (as já enfileiradas colidem na chave). Loga só contagens, e a escola que falhou pelo id.
 */
export function criarRotinaDaClassificacao({ escolas, banco, enfileirador, janelaDaEscola, relogio, logger }: RotinaDaClassificacaoDependencies): JobProcessor<typeof TIPO_AGENDAR_CLASSIFICACAO_DAS_ESCOLAS> {
  return async () => {
    const contexto = currentContext()
    if (contexto?.rotinaDoSistema !== true) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
    const agora = relogio.agora()
    const ids = await escolas.listarIds()
    let enfileiradosTotal = 0
    let jaEnfileiradosTotal = 0
    let falhasTotal = 0
    for (const escolaId of ids) {
      try {
        const resultado = await runInContext({ requisicaoId: contexto.requisicaoId, escolaId }, async () => {
          const { fuso } = await janelaDaEscola.daEscola()
          return banco.transaction((tx) => enfileirador.enfileirarUmaVez(tx, TIPO_AGENDAR_CLASSIFICACAO, {}, chaveDaNoite(fuso, agora)))
        })
        if (resultado.situacao === 'enfileirado') enfileiradosTotal += 1
        else jaEnfileiradosTotal += 1
      } catch (erro) {
        falhasTotal += 1
        logger.warn({ evento: 'classificacao.escola_nao_enfileirada', escolaId, erro: summarizeError(erro) })
      }
    }
    const escolasTotal = ids.length
    logger.info({ evento: 'classificacao.rotina_disparada', escolasTotal, enfileiradosTotal, jaEnfileiradosTotal, falhasTotal })
    if (falhasTotal > 0) throw new InvariantException('classificação não enfileirada em alguma escola')
  }
}

export interface AgendamentoDaClassificacaoDependencies {
  banco: Database
  enfileirador: Pick<JobOutbox, 'enfileirarUmaVez'>
  logger: LoggerBase
  /** Seções por lote. Só o teste troca. */
  lote?: number
  /** Execuções que a escola ganha numa noite. Só o teste troca. */
  limiteDeExecucoes?: number
}

/**
 * `material.agendar-classificacao` (classificacao-bncc, tarefas 5.0 e 6.0; Tech Spec, seções 5 "Agendar" e 7c "Laços"). **Com `materialId` ou `disciplinaId`** é a mudança de recorte (`refazOsRecortes`, 6.0), e os dois juntos são
 * `DADOS_INVALIDOS`. **Sem dados** é o da rotina das 19h (5.0): no contexto da escola do job, lê as seções que precisam de execução em **lotes de 500, cada um numa transação**
 * (`statement_timeout` de 20 s) e cria as execuções `classificar_secoes` e os jobs delas (`AgendamentoDaClassificacaoRepository`). Para entre dois lotes quando o `sinal` aborta (o prazo, o desligamento), sem deixar seção sem
 * execução no meio de um lote, quando a função está suspensa e quando a escola já ganhou o limite de execuções da noite (`EXECUCOES_POR_NOITE_DA_ESCOLA`): o resto sai na noite seguinte, pelo mesmo caminho. Cada lote começa
 * depois da última seção do anterior, então a seção que nenhum lote consegue agendar (a que o outro agendamento levou) não prende o laço. Loga só ids e contagens, nunca título, texto nem código.
 */
export function criarAgendamentoDaClassificacao({ banco, enfileirador, logger, lote = SECOES_POR_LOTE_DO_AGENDAMENTO, limiteDeExecucoes = EXECUCOES_POR_NOITE_DA_ESCOLA }: AgendamentoDaClassificacaoDependencies): JobProcessor<typeof TIPO_AGENDAR_CLASSIFICACAO> {
  return async (dados, _execucao, sinal = new AbortController().signal) => {
    const alvo = alvoDoJob(dados)
    if (alvo !== undefined) return refazOsRecortes({ banco, enfileirador, logger, lote }, alvo, sinal)
    const escolaId = requireEscolaId()
    let cursor: string | undefined
    let lotesTotal = 0
    let execucoesTotal = 0
    let secoesTotal = 0
    let estado: 'fim' | 'suspensa' | 'limite' | 'sinal'
    for (;;) {
      if (sinal.aborted) {
        estado = 'sinal'
        break
      }
      if (execucoesTotal >= limiteDeExecucoes) {
        estado = 'limite'
        break
      }
      // O lote nunca passa do que ainda cabe no limite da noite: cada execução leva até 12 seções.
      const tamanho = Math.min(lote, (limiteDeExecucoes - execucoesTotal) * SECOES_POR_EXECUCAO)
      const feito = await banco.transaction(async (tx) => {
        await tx.execute(sql`select set_config('statement_timeout', ${String(PRAZO_DO_LOTE_MS)}, true)`)
        const repositorio = new AgendamentoDaClassificacaoRepository(tx)
        if (!(await repositorio.funcaoEstaAtiva())) return 'suspensa' as const
        const proximas = await repositorio.proximasSecoes(tamanho, cursor === undefined ? {} : { depoisDe: cursor })
        const ultima = proximas.at(-1)
        if (ultima === undefined) return 'fim' as const
        return { ultima: ultima.secaoId, agendado: await repositorio.agendar(proximas, enfileirador, limiteDeExecucoes - execucoesTotal) }
      })
      if (feito === 'suspensa' || feito === 'fim') {
        estado = feito
        break
      }
      cursor = feito.ultima
      lotesTotal += 1
      execucoesTotal += feito.agendado.execucoes
      secoesTotal += feito.agendado.secoes
    }
    logger.info({ evento: 'classificacao.agendada', escolaId, estado, lotesTotal, execucoesTotal, secoesTotal })
  }
}

/** O alvo da mudança de recorte que os dados do job dizem; sem nenhum, é o job da rotina. Os dois ao mesmo tempo não são um pedido que o `PATCH` faça: `DADOS_INVALIDOS`, sem nova tentativa. */
function alvoDoJob(dados: { readonly materialId?: string | undefined; readonly disciplinaId?: string | undefined }): AlvoDaMudancaDeRecorte | undefined {
  if (dados.materialId !== undefined && dados.disciplinaId !== undefined) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
  if (dados.materialId !== undefined) return { materialId: dados.materialId }
  if (dados.disciplinaId !== undefined) return { disciplinaId: dados.disciplinaId }
  return undefined
}

/**
 * A mudança de recorte (6.0; Tech Spec, seção 5, "Agendar" (b)): o `PATCH` das séries do material ou do componente da disciplina só enfileirou este job, e ele **decide pelo recorte que está no banco agora**, nunca pelo
 * conteúdo do `PATCH`. Em lotes de 500 seções, cada um numa transação (`statement_timeout` de 20 s), **limpa** as seções não corrigidas do alvo (`limparDoRecorte`: lê `for update`, apaga o código da IA, anula a execução,
 * zera as falhas) e, com a função ativa, agenda as que acabaram de ser limpas e têm componente e série (`proximasSecoes` com `secaoIds`). Sem componente (apagado) nem série, a seção fica `nao_agendada`; com a função
 * suspensa, limpa e não agenda (a retomada devolve as seções à rotina das 19h). Sem teto de execuções da noite: foi a coordenação que pediu, e a execução só roda fora da janela letiva. Para entre dois lotes quando o `sinal`
 * aborta, e o job entregue de novo (retentativa, entrega ao menos uma vez) começa do início: limpa de novo as seções dos lotes que já agendou, e as execuções `pendente` daquela tentativa ficam sem seção, concluem sem modelo e sem consumo (P11), sobrando só a execução e o job à toa. Loga só ids e contagens, nunca título, texto nem código.
 */
async function refazOsRecortes({ banco, enfileirador, logger, lote = SECOES_POR_LOTE_DO_AGENDAMENTO }: AgendamentoDaClassificacaoDependencies, alvo: AlvoDaMudancaDeRecorte, sinal: AbortSignal): Promise<void> {
  const escolaId = requireEscolaId()
  let cursor: string | undefined
  let lotesTotal = 0
  let limpasTotal = 0
  let execucoesTotal = 0
  let secoesTotal = 0
  let estado: 'fim' | 'sinal' = 'fim'
  for (;;) {
    if (sinal.aborted) {
      estado = 'sinal'
      break
    }
    const feito = await banco.transaction(async (tx) => {
      await tx.execute(sql`select set_config('statement_timeout', ${String(PRAZO_DO_LOTE_MS)}, true)`)
      const repositorio = new AgendamentoDaClassificacaoRepository(tx)
      const { limpas, ultima } = await repositorio.limparDoRecorte(alvo, lote, cursor)
      if (ultima === undefined) return undefined
      if (!(await repositorio.funcaoEstaAtiva())) return { ultima, limpas: limpas.length, agendado: { execucoes: 0, secoes: 0 } }
      const proximas = await repositorio.proximasSecoes(limpas.length, { secaoIds: limpas })
      return { ultima, limpas: limpas.length, agendado: await repositorio.agendar(proximas, enfileirador) }
    })
    if (feito === undefined) break
    cursor = feito.ultima
    lotesTotal += 1
    limpasTotal += feito.limpas
    execucoesTotal += feito.agendado.execucoes
    secoesTotal += feito.agendado.secoes
  }
  logger.info({ evento: 'classificacao.recorte_refeito', escolaId, tipo: 'materialId' in alvo ? 'material' : 'disciplina', estado, lotesTotal, limpasTotal, execucoesTotal, secoesTotal })
}
