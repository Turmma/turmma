import {
  currentContext,
  diaAnterior,
  diaDeUso,
  postgresErrorIn,
  runInContext,
  METRICS,
  summarizeError,
  type UsageMeter,
  type LoggerBase,
  type Meter,
  type Clock,
  type UsagePeriod,
  type UsageRepository,
} from '@educa/nucleo'
import { JobFailureCode, type TIPO_CONSOLIDAR_USO } from '@educa/shared'
import type { Processador } from '../executor.js'
import { FalhaDeJob } from '../falha-de-job.js'
import type { MedidorDeStorage } from '../storage/medidor-de-storage.js'

/**
 * Pastas seguidas com erro de storage depois das quais a medição desiste e o job falha. Uma pasta com erro é da
 * escola; várias seguidas é o storage fora, e esperar o prazo de cada escola só atrasaria a nova tentativa da fila.
 */
export const FALHAS_DE_STORAGE_SEGUIDAS_ATE_DESISTIR = 3

/** De onde veio a gravação pulada: o contador do Redis de um dia, ou a medição do storage. Rótulo `origem`. */
export type OrigemDaEscolaIgnorada = 'contador' | 'storage'

/**
 * Por que a gravação foi pulada. Rótulo `causa`.
 * - `escola_inexistente`: a escola não está no banco (eliminada; o SeaweedFS guarda a pasta vazia).
 * - `valor_invalido`: o banco recusou o valor (texto num contador, dia que não existe, número negativo).
 * - `erro_de_storage`: a listagem da pasta da escola falhou.
 */
export type CausaDaEscolaIgnorada = 'escola_inexistente' | 'valor_invalido' | 'erro_de_storage'

const FK_DA_ESCOLA = 'uso_infra_diario_escola_id_escola_id_fk'
const SQLSTATE_FK = '23503'
const SQLSTATE_CHECK = '23514'
/** Classe 22 do SQLSTATE: "data exception", sempre sobre o valor enviado, nunca sobre o estado do banco. */
const CLASSE_DADO_INVALIDO = '22'

/**
 * A causa, quando o erro da gravação é da escola e não do banco. Qualquer outro erro (conexão, prazo, servidor
 * derrubando a sessão) devolve `undefined` e sobe: o job falha e a fila tenta de novo.
 */
function causaNaEscola(erro: unknown): CausaDaEscolaIgnorada | undefined {
  const doPostgres = postgresErrorIn(erro)
  if (doPostgres === undefined) return undefined
  if (doPostgres.code === SQLSTATE_FK && doPostgres.constraint === FK_DA_ESCOLA) return 'escola_inexistente'
  if (doPostgres.code === SQLSTATE_CHECK || doPostgres.code.startsWith(CLASSE_DADO_INVALIDO)) return 'valor_invalido'
  return undefined
}

export interface DependenciasDaConsolidacao {
  contador: Pick<UsageMeter, 'lerDiasFechados' | 'apagarConsolidado'>
  repositorio: Pick<UsageRepository, 'gravarDia'>
  storage: Pick<MedidorDeStorage, 'listarEscolas' | 'bytesDaEscola'>
  /** De onde vem a hora que decide quais dias fecharam. Só o teste troca. */
  relogio: Clock
  logger: LoggerBase
  /** Medidor da telemetria, para `uso.escola_ignorada`. Sem ele (os testes que não olham métrica), só o log. */
  medidor?: Meter
}

/**
 * `sistema.consolidar-uso`: leva os contadores de uso do Redis de fila para `uso_infra_diario` e mede
 * o storage de cada escola (Tech Spec, seção 5, "Uso por escola").
 *
 * 1. Para cada dia fechado (anterior a hoje em São Paulo) de cada escola: lê o contador (`GET`), grava o
 *    valor absoluto no banco e só então apaga o contador, se ele ainda tem o valor gravado. Rodar de
 *    novo, em sequência ou em paralelo, regrava o mesmo número: não soma duas vezes. Se cair entre a
 *    gravação e a remoção, a próxima execução regrava o mesmo valor e apaga.
 * 2. Para cada escola com pasta no storage: grava os bytes de `escolas/{id}/` no dia que acabou de
 *    fechar, também como valor absoluto.
 *
 * Toda leitura e gravação de uma escola roda no contexto dela: a descoberta das escolas é a única
 * parte sem escopo (`@Unscoped` no contador e no medidor). Com o Redis de fila, o Postgres ou o
 * storage fora, a tentativa falha e a fila tenta de novo; o que já foi gravado continua certo.
 *
 * Uma escola não para a consolidação das outras (regra 80, item 3). A gravação que o banco recusa por causa da
 * escola (ela não existe mais, ou o valor é inválido) é pulada, com `uso.escola_ignorada` no log, só com o id, e na
 * métrica, por origem e causa. O contador pulado **fica no Redis** e vence sozinho pelo prazo que o `marcar` lhe deu
 * (`VALIDADE_DO_CONTADOR_SEGUNDOS`): o que não pôde ser gravado não é apagado, e reexecutar pula de novo, sem mudar
 * nada. A pasta com erro de storage também é pulada, mas o job falha no fim, depois das outras escolas, porque o erro
 * pode ser do storage e não da pasta; com `FALHAS_DE_STORAGE_SEGUIDAS_ATE_DESISTIR` pastas seguidas com erro, falha na
 * hora. Se **todas** as escolas encontradas (no contador e no storage) forem inexistentes no banco, cada uma é pulada do
 * mesmo jeito, mas o job falha no fim, com `uso.nenhuma_escola_no_banco` no log: em geral é o worker apontado para outro
 * banco; também dispara numa noite em que todas as encontradas são resto de escola eliminada, até a eliminação apagar o
 * resto de uso (`TODO.md`). Uma inexistente entre escolas que existem continua só pulada.
 */
export function criarConsolidacaoDeUso(dependencias: DependenciasDaConsolidacao): Processador<typeof TIPO_CONSOLIDAR_USO> {
  const { contador, repositorio, storage, relogio, logger, medidor } = dependencias
  const escolaIgnorada = medidor?.createCounter(METRICS.escolaIgnoradaNoUso, {
    description: 'Gravações de uso de uma escola que a consolidação noturna pulou, por origem e causa',
  })
  return async () => {
    const contexto = currentContext()
    // Só a rotina do sistema consolida: um job de escola com este tipo não alcança as outras escolas.
    if (contexto?.rotinaDoSistema !== true) throw new FalhaDeJob(JobFailureCode.DADOS_INVALIDOS, true)
    const naEscola = <T>(escolaId: string, funcao: () => Promise<T>): Promise<T> =>
      runInContext({ requisicaoId: contexto.requisicaoId, escolaId }, funcao)

    let ignoradasTotal = 0
    /** As escolas que o banco não tem: se forem todas as encontradas, o job falha no fim. */
    const inexistentes = new Set<string>()
    const ignorar = (escolaId: string, origem: OrigemDaEscolaIgnorada, causa: CausaDaEscolaIgnorada, erro: unknown): void => {
      ignoradasTotal++
      if (causa === 'escola_inexistente') inexistentes.add(escolaId)
      escolaIgnorada?.add(1, { origem, causa })
      // Só o id e o erro resumido (SQLSTATE e restrição, ou o tipo): a mensagem do banco traz o valor da linha (regra 20, item 9).
      logger.warn({ evento: 'uso.escola_ignorada', escolaId, origem, causa, erro: summarizeError(erro) })
    }
    /** Grava o dia da escola, ou devolve a causa se o banco o recusou por causa dela. Erro do banco sobe. */
    const gravar = async (escolaId: string, dia: string, valores: Partial<UsagePeriod>): Promise<{ causa: CausaDaEscolaIgnorada; erro: unknown } | undefined> => {
      try {
        await naEscola(escolaId, () => repositorio.gravarDia(dia, valores))
        return undefined
      } catch (erro) {
        const causa = causaNaEscola(erro)
        if (causa === undefined) throw erro
        return { causa, erro }
      }
    }

    const hoje = diaDeUso(relogio.agora())
    const contagens = await contador.lerDiasFechados(hoje)
    for (const { escolaId, dia, requisicoes, jobs } of contagens) {
      const valores: Partial<UsagePeriod> = {
        ...(requisicoes === undefined ? {} : { requisicoes }),
        ...(jobs === undefined ? {} : { jobs }),
      }
      const recusa = await gravar(escolaId, dia, valores)
      if (recusa !== undefined) {
        ignorar(escolaId, 'contador', recusa.causa, recusa.erro)
        continue
      }
      await naEscola(escolaId, async () => {
        if (requisicoes !== undefined) await contador.apagarConsolidado(dia, 'req', requisicoes)
        if (jobs !== undefined) await contador.apagarConsolidado(dia, 'jobs', jobs)
      })
    }

    const ontem = diaAnterior(hoje)
    const escolas = await storage.listarEscolas()
    let falhaDeStorage: unknown
    let falhasSeguidas = 0
    for (const escolaId of escolas) {
      let bytesStorage: number
      try {
        bytesStorage = await naEscola(escolaId, () => storage.bytesDaEscola())
        falhasSeguidas = 0
      } catch (erro) {
        ignorar(escolaId, 'storage', 'erro_de_storage', erro)
        if (++falhasSeguidas >= FALHAS_DE_STORAGE_SEGUIDAS_ATE_DESISTIR) throw erro
        falhaDeStorage ??= erro
        continue
      }
      const recusa = await gravar(escolaId, ontem, { bytesStorage })
      if (recusa !== undefined) ignorar(escolaId, 'storage', recusa.causa, recusa.erro)
    }
    const diasTotal = contagens.length
    const escolasTotal = escolas.length
    logger.info({ evento: 'uso.consolidado', diasTotal, escolasTotal, ignoradasTotal })
    // Nenhuma das escolas encontradas existe no banco: em geral é o worker apontado para outro banco, ou uma restauração
    // pela metade (ou só resto de escolas eliminadas, até a eliminação apagá-lo). Pular todas terminaria em sucesso sem
    // gravar nada, e ninguém veria.
    const encontradas = new Set([...contagens.map(({ escolaId }) => escolaId), ...escolas])
    if (encontradas.size > 0 && [...encontradas].every((escolaId) => inexistentes.has(escolaId))) {
      // Contador e storage juntos: não é o `escolasTotal` de `uso.consolidado`, que conta só as pastas do storage.
      const encontradasTotal = encontradas.size
      logger.error({ evento: 'uso.nenhuma_escola_no_banco', encontradasTotal })
      throw new FalhaDeJob(JobFailureCode.ERRO_INTERNO)
    }
    // A pasta com erro não segurou as outras escolas, mas o erro não é engolido: a fila tenta de novo, e a
    // reexecução regrava o mesmo valor nas que já foram (D49).
    if (falhaDeStorage !== undefined) throw falhaDeStorage
  }
}
