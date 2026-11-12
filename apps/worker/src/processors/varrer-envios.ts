import {
  chaveDoTemporario,
  currentContext,
  EnvioDeMaterialRepository,
  ExtracaoDoMaterialRepository,
  FileStorageUnavailableError,
  runInContext,
  summarizeError,
  VarreduraDoMaterialRepository,
  type AlvoDaVarredura,
  type Clock,
  type Database,
  type FileStorage,
  type LoggerBase,
} from '@educa/core'
import { InvariantException, JobFailureCode, type TIPO_VARRER_TEMPORARIOS_DE_MATERIAL } from '@educa/shared'
import type { JobProcessor } from '../job-executor.js'
import { JobFailureError } from '../job-failure.error.js'

/** Uma hora: a linha do envio que passou disto não vai mais virar material (o envio mais lento leva o prazo do `guardarBytes`, 30 s, e a transação). */
export const FOLGA_DA_LINHA_DO_ENVIO_MS = 60 * 60_000
/** 25 h: o objeto que sobrou depois do commit (o `apagar` falhou, o processo caiu) já teve a hora seguinte do expurgo noturno para sair. */
export const FOLGA_DO_OBJETO_QUE_SOBROU_MS = 25 * 60 * 60_000
/**
 * Alvos de cada leitura por execução: o que passar disto sai na próxima tentativa ou na hora seguinte. O lote **não** cabe no `prazoMs` do job no pior
 * caso (cada `apagar` levando pouco menos de 10 s, 500 alvos, duas vezes, passa de 600 s): quem garante o corte é o `sinal`, que para o laço entre um
 * alvo e outro, e o storage fora do ar, que o interrompe (`FALHAS_SEGUIDAS_DO_STORAGE_FORA`).
 */
export const LOTE_DA_VARREDURA = 500
/**
 * Quantas falhas de storage seguidas, sem nenhum alvo que passou no meio, e em **pelo menos duas escolas**, dizem que o storage está fora do ar e não
 * uma chave com defeito. O `S3FileStorage` transforma toda falha do `DeleteObject` (403 numa chave, 5xx, prazo do SDK) em `FileStorageUnavailableError`, e o
 * `apagarComPrazo` faz o mesmo no prazo de 10 s: uma chave que falha sempre, ou um `apagar` que passa sempre do prazo, é o alvo que volta primeiro a cada
 * hora, e parar a varredura nele deixaria o PDF das outras escolas no storage para sempre. Falha em uma escola só, por mais seguida que seja, nunca para a execução.
 */
export const FALHAS_SEGUIDAS_DO_STORAGE_FORA = 3
/** O prazo de cada `apagar`: a varredura segura a linha do envio enquanto o faz, e o envio lento espera por ela sob `lock_timeout` curto. */
export const PRAZO_DO_APAGAR_DA_VARREDURA_MS = 10_000

export interface VarreduraDeTemporariosDependencies {
  banco: Database
  armazem: Pick<FileStorage, 'apagar'>
  relogio: Clock
  logger: LoggerBase
  /** Alvos por leitura e prazo de cada `apagar`. Só o teste troca. */
  lote?: number
  prazoDoApagarMs?: number
}

/**
 * `apagar` com prazo: o armazém que não responde não segura a trava da linha nem o job. Estourado, falha como o armazém fora do ar. Se o `sinal` do
 * job aborta (o prazo dele, ou o desligamento além da graça), rejeita na hora, e a transação que segura a linha desfaz e solta a conexão.
 */
async function apagarComPrazo(armazem: Pick<FileStorage, 'apagar'>, chave: string, prazoMs: number, sinal: AbortSignal): Promise<void> {
  let relogio: NodeJS.Timeout | undefined
  let aoAbortar: (() => void) | undefined
  const interrompido = new Promise<never>((_, rejeitar) => {
    relogio = setTimeout(() => rejeitar(new FileStorageUnavailableError()), prazoMs)
    aoAbortar = () => rejeitar(new JobFailureError(JobFailureCode.TEMPO_ESGOTADO))
    if (sinal.aborted) aoAbortar()
    else sinal.addEventListener('abort', aoAbortar, { once: true })
  })
  try {
    await Promise.race([armazem.apagar(chave), interrompido])
  } finally {
    clearTimeout(relogio)
    if (aoAbortar) sinal.removeEventListener('abort', aoAbortar)
  }
}

/** O que a execução já fez: as contagens do resumo e se o storage já mostrou que está fora do ar. */
interface Andamento {
  enviosApagadosTotal: number
  enviosPuladosTotal: number
  objetosApagadosTotal: number
  falhasTotal: number
  /** A escola de cada falha de storage desde o último alvo que passou: com `FALHAS_SEGUIDAS_DO_STORAGE_FORA` delas, em duas escolas ou mais, o storage está fora. */
  falhasDeStorageSeguidas: string[]
  storageFora: boolean
}

/** O storage está fora do ar: falhas de storage seguidas em número suficiente e em mais de uma escola (uma chave com defeito não é o storage fora). */
function storageForaDepoisDe(escolasDasFalhas: readonly string[]): boolean {
  return escolasDasFalhas.length >= FALHAS_SEGUIDAS_DO_STORAGE_FORA && new Set(escolasDasFalhas).size >= 2
}

/** Como a execução terminou, para o resumo do log: o corte do job, o storage fora do ar, ou o lote inteiro. */
function comoTerminou(sinal: AbortSignal, andamento: Andamento): 'cortada' | 'storage_fora' | 'completa' {
  if (sinal.aborted) return 'cortada'
  return andamento.storageFora ? 'storage_fora' : 'completa'
}

/**
 * `sistema.varrer-temporarios-de-material` (ingestao-do-material, tarefa 2.0; Tech Spec, seções 5 e 7c; onda 3b, 3. Falha), de hora em hora na fila `lote`:
 * apaga o PDF que sobrou no storage, em duas passadas, cada uma no **contexto da escola do alvo**, com repositories com escopo.
 *
 * - **O envio que não chegou ao commit.** Cada linha de `envio_de_material` de mais de 1 h (`FOLGA_DA_LINHA_DO_ENVIO_MS`, contada do `Clock`
 *   do job) é travada com `for update skip locked` numa transação da escola dela; o **objeto sai primeiro** (prazo curto), e só então a linha. A linha
 *   que um envio em andamento já travou é pulada e o objeto fica para ele; a que o `apagar` não deixou apagar fica, e sai na hora seguinte. Linha sem
 *   objeto (a queda foi antes do upload) sai sem erro, porque apagar o que não existe não falha.
 * - **O objeto que sobrou depois do commit.** O material `pronto`, `falhou` ou excluído há mais de 25 h, com `objeto_apagado_em` nulo, tem o objeto
 *   apagado e só então a marca. O `processando` não excluído nunca entra, e o material de antes da F4 (`objeto_apagado_em = enviado_em`) também não.
 *
 * As duas leituras entre escolas são `@Unscoped` e devolvem só `(escola, id)` (`VarreduraDoMaterialRepository`). Cada execução trata até `lote` alvos de cada
 * leitura. **Uma escola que falha não segura as outras**: a varredura segue e, no fim, falha o job, para a fila tentar de novo (o que já saiu não volta).
 *
 * Três coisas a param antes do fim, e o que sobra sai na próxima tentativa ou na hora seguinte: o `sinal` do executor (o prazo do job, ou o desligamento além
 * da graça), conferido antes de cada alvo e dentro de cada `apagar`; o storage fora do ar, que é `FALHAS_SEGUIDAS_DO_STORAGE_FORA` falhas de storage
 * (`FileStorageUnavailableError`, que também é o `apagar` que estourou o prazo curto) seguidas e em duas escolas ou mais, porque os alvos seguintes também falhariam,
 * cada um segurando uma conexão do pool de lote pelo prazo inteiro; e o fim do lote. **Uma chave que falha sempre não para as outras escolas**: falha seguida em
 * uma escola só nunca conta como storage fora, e o alvo que passa zera a conta. Tolera reexecução e duas réplicas ao mesmo tempo (D49). Loga só ids e
 * contagens, nunca título, arquivo, licenciante nem a chave do objeto.
 */
export function criarVarreduraDeTemporarios({
  banco,
  armazem,
  relogio,
  logger,
  lote = LOTE_DA_VARREDURA,
  prazoDoApagarMs = PRAZO_DO_APAGAR_DA_VARREDURA_MS,
}: VarreduraDeTemporariosDependencies): JobProcessor<typeof TIPO_VARRER_TEMPORARIOS_DE_MATERIAL> {
  const varredura = new VarreduraDoMaterialRepository(banco)

  // O executor sempre entrega o `sinal`; o padrão, que nunca aborta, é só para quem chama o processador direto.
  return async (_dados, _execucao, sinal = new AbortController().signal) => {
    const contexto = currentContext()
    if (contexto?.rotinaDoSistema !== true) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
    const agora = relogio.agora().getTime()
    const linhasAntesDe = new Date(agora - FOLGA_DA_LINHA_DO_ENVIO_MS)
    const objetosAntesDe = new Date(agora - FOLGA_DO_OBJETO_QUE_SOBROU_MS)
    const naEscola = <T>({ escolaId }: AlvoDaVarredura, trabalho: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: contexto.requisicaoId, escolaId }, trabalho)

    const andamento: Andamento = { enviosApagadosTotal: 0, enviosPuladosTotal: 0, objetosApagadosTotal: 0, falhasTotal: 0, falhasDeStorageSeguidas: [], storageFora: false }
    const falhou = (alvo: AlvoDaVarredura, origem: 'envio' | 'objeto', erro: unknown): void => {
      andamento.falhasTotal += 1
      if (erro instanceof FileStorageUnavailableError) {
        andamento.falhasDeStorageSeguidas.push(alvo.escolaId)
        andamento.storageFora = storageForaDepoisDe(andamento.falhasDeStorageSeguidas)
      }
      // Nem a chave do objeto nem o texto do erro vão ao log: a escola e o material, a passada e o motivo resumido.
      logger.warn({ evento: 'material.varredura_nao_apagou', escolaId: alvo.escolaId, materialId: alvo.materialId, origem, erro: summarizeError(erro) })
    }
    /** Uma passada: um alvo de cada vez, parando no corte do job e no storage fora do ar. Quem falha não segura o seguinte, salvo o storage fora (ver `storageForaDepoisDe`). */
    const percorrer = async (alvos: readonly AlvoDaVarredura[], origem: 'envio' | 'objeto', tratar: (alvo: AlvoDaVarredura) => Promise<void>): Promise<void> => {
      for (const alvo of alvos) {
        if (sinal.aborted || andamento.storageFora) return
        try {
          await tratar(alvo)
          andamento.falhasDeStorageSeguidas.length = 0
        } catch (erro) {
          // O corte do job não é falha do alvo: a transação já desfez, e a hora seguinte o retoma.
          if (sinal.aborted) return
          falhou(alvo, origem, erro)
        }
      }
    }

    await percorrer(
      await varredura.enviosParados(linhasAntesDe, lote),
      'envio',
      async (alvo) => {
        const apagou = await naEscola(alvo, () =>
          banco.transaction(async (tx) => {
            const envios = new EnvioDeMaterialRepository(tx)
            if (!(await envios.travarParada(alvo.materialId, linhasAntesDe))) return false
            await apagarComPrazo(armazem, chaveDoTemporario(alvo.materialId), prazoDoApagarMs, sinal)
            await envios.apagar(alvo.materialId)
            return true
          }),
        )
        if (apagou) andamento.enviosApagadosTotal += 1
        else andamento.enviosPuladosTotal += 1
      },
    )

    await percorrer(
      await varredura.objetosQueSobraram(objetosAntesDe, lote),
      'objeto',
      async (alvo) => {
        await naEscola(alvo, async () => {
          await apagarComPrazo(armazem, chaveDoTemporario(alvo.materialId), prazoDoApagarMs, sinal)
          await new ExtracaoDoMaterialRepository(banco).marcarObjetoApagado(alvo.materialId)
        })
        andamento.objetosApagadosTotal += 1
      },
    )

    const estado = comoTerminou(sinal, andamento)
    logger.info({
      evento: 'material.varredura',
      enviosApagadosTotal: andamento.enviosApagadosTotal,
      enviosPuladosTotal: andamento.enviosPuladosTotal,
      objetosApagadosTotal: andamento.objetosApagadosTotal,
      falhasTotal: andamento.falhasTotal,
      estado,
    })
    if (andamento.falhasTotal > 0) throw new InvariantException('objeto de material não apagado em alguma escola')
  }
}
