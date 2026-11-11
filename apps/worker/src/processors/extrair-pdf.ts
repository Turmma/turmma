import {
  ExtracaoDoMaterialRepository,
  chaveDoTemporario,
  METRICS,
  PRAZO_DO_OBJETO_DO_MATERIAL_MS,
  requireEscolaId,
  summarizeError,
  type Database,
  type FileStorage,
  type LoggerBase,
  type Meter,
} from '@educa/core'
import type { PdfExtractor } from '@educa/core/material'
import { JOB_DEFINITIONS, JobFailureCode, TIPO_EXTRAIR_PDF, type FalhaDeMaterial } from '@educa/shared'
import type { JobProcessor } from '../job-executor.js'
import { JobFailureError } from '../job-failure.error.js'

/** Os limites do histograma da extração, em segundos: de um PDF curto aos dez minutos do prazo do tipo. */
export const LIMITES_DA_EXTRACAO_S = [1, 5, 15, 30, 60, 120, 300, 600]

/** Quantas tentativas o tipo tem: a em curso que chega a este número é a última, e a falha dela é a do material. */
const TENTATIVAS_DA_EXTRACAO = JOB_DEFINITIONS[TIPO_EXTRAIR_PDF].retentativa.tentativas

export interface ExtrairPdfDependencies {
  banco: Database
  armazem: Pick<FileStorage, 'lerBytes' | 'apagar'>
  extrator: Pick<PdfExtractor, 'extrair'>
  logger: LoggerBase
  medidor?: Meter | undefined
}

/** Como a execução terminou, que é o `resultado` da métrica e o que o log diz. */
type Desfecho = 'pronto' | 'falhou' | 'arquivo_ausente' | 'sem_efeito'

/**
 * Rejeita quando o `sinal` aborta (o prazo, ou o desligamento além da graça): o processador recupera o controle mesmo que o extrator não honre
 * o sinal, e a última tentativa fecha o material e apaga o objeto em vez de deixá-los para quem lê o `falhou` do job. Nunca resolve.
 */
function quandoAbortar(sinal: AbortSignal): Promise<never> {
  return new Promise<never>((_, rejeitar) => {
    const falhar = (): void => rejeitar(new JobFailureError(JobFailureCode.ERRO_INTERNO))
    if (sinal.aborted) falhar()
    else sinal.addEventListener('abort', falhar, { once: true })
  })
}

/**
 * `material.extrair-pdf` (ingestao-do-material, tarefa 1.0; Tech Spec, seção 5, "Extração"; onda 3b, 45.0): no contexto da escola do job,
 * lê o PDF do storage, extrai o texto por página e grava os trechos e o estado do material numa transação só; **depois do commit**, apaga o
 * objeto. O PDF não sobra no storage em nenhum caminho: sucesso, falha definitiva, exclusão (o envio da exclusão o apaga), expurgo.
 *
 * - **A transição abre a transação.** `processando` e não excluído, da escola do job: sem linha, o job conclui sem efeito. É a que faz o job
 *   repetido, o que chega depois da exclusão e o segundo job do mesmo material (D49) saírem sem gravar trecho nem mudar estado, e é a que
 *   protege o `pronto` de um objeto que o primeiro job já apagou.
 * - **Falha definitiva numa tentativa só**: `sem_texto` e `arquivo_invalido` (o PDF é o PDF: repetir não muda), e o objeto ausente de um
 *   material ainda `processando` (`extracao_falhou`, sem valor novo em `falha`). O objeto ausente de material que já saiu de `processando`
 *   (excluído, ou extraído pelo outro job) conclui sem efeito, e não conta como falha.
 * - **Qualquer outro erro** (o storage fora, o banco, a leitura que falhou, o prazo, o desligamento) repete até a última tentativa do tipo. Na
 *   última, o material vira `falhou` e o objeto sai antes de o erro subir, para o job terminar `falhou` com o material consistente; com
 *   tentativa sobrando, o objeto fica para a próxima. O prazo e o desligamento além da graça abortam o `sinal`, e o processador recupera o controle
 *   mesmo que o extrator o ignore (`quandoAbortar`): na última tentativa, o material fecha e o objeto sai com o processo ainda vivo. Se o processo
 *   morre antes disso, o job termina `falhou` e quem fecha o material e apaga o objeto é o "Descartar" da 3.0 (o alerta de job falhou de vez o chama).
 * - **O objeto apagado fica registrado** (`objeto_apagado_em`). Se o `apagar` falha, o objeto fica e a varredura da 2.0 o acha; o job conclui.
 * - **Log e métrica**: ids, códigos e contagens, nunca título, nome de arquivo, licenciante nem texto (regra 20, itens 7 e 9). O objeto ausente
 *   de um material `processando` é `arquivo_ausente`, à parte de `extracao_falhou`: é o sinal de um objeto perdido.
 */
export function criarExtracaoDoPdf({ banco, armazem, extrator, logger, medidor }: ExtrairPdfDependencies): JobProcessor<typeof TIPO_EXTRAIR_PDF> {
  const porResultado = medidor?.createCounter(METRICS.extracaoDoMaterial, { description: 'Execuções do job de extração do PDF, por resultado' })
  const duracao = medidor?.createHistogram(METRICS.duracaoDaExtracaoDoMaterial, {
    unit: 's',
    description: 'Duração da execução do job de extração do PDF',
    advice: { explicitBucketBoundaries: LIMITES_DA_EXTRACAO_S },
  })

  const medir = (resultado: Desfecho | 'nova_tentativa', inicio: number): void => {
    porResultado?.add(1, { resultado })
    duracao?.record((performance.now() - inicio) / 1_000, { resultado })
  }

  /** O objeto sai do storage e a linha registra: o que falha aqui fica para a varredura, e o job não falha por isso. */
  const apagarObjeto = async (materialId: string): Promise<void> => {
    try {
      await armazem.apagar(chaveDoTemporario(materialId))
      await new ExtracaoDoMaterialRepository(banco).marcarObjetoApagado(materialId)
    } catch (erro) {
      logger.warn({ evento: 'material.objeto_nao_apagado', materialId, erro: summarizeError(erro) })
    }
  }

  /**
   * A falha que o material guarda: a linha muda só se ele ainda é `processando`, e então o objeto sai e o log diz o evento. O objeto ausente é
   * `material.arquivo_ausente`, à parte de `material.extracao_falhou`, e os dois guardam o mesmo código em `falha`.
   */
  const falharDeVez = async (materialId: string, codigo: FalhaDeMaterial, evento: 'material.extracao_falhou' | 'material.arquivo_ausente', tentativa: number): Promise<boolean> => {
    const mudou = await new ExtracaoDoMaterialRepository(banco).marcarFalhou(materialId, codigo)
    if (!mudou) return false
    logger.warn({ evento, materialId, tentativa, codigo })
    await apagarObjeto(materialId)
    return true
  }

  // O executor sempre entrega o `sinal`; o padrão, que nunca aborta, é só para quem chama o processador direto.
  return async ({ materialId }, execucao, sinal = new AbortController().signal) => {
    requireEscolaId()
    const inicio = performance.now()
    const { tentativa } = execucao
    const ultimaTentativa = tentativa >= TENTATIVAS_DA_EXTRACAO

    const extrair = async (): Promise<Desfecho> => {
      const material = await new ExtracaoDoMaterialRepository(banco).lerParaExtrair(materialId)
      if (material === undefined) return 'sem_efeito'
      const bytes = await armazem.lerBytes(chaveDoTemporario(materialId), { prazoMs: PRAZO_DO_OBJETO_DO_MATERIAL_MS })
      if (bytes === undefined) return (await falharDeVez(materialId, 'extracao_falhou', 'material.arquivo_ausente', tentativa)) ? 'arquivo_ausente' : 'sem_efeito'
      const resultado = await Promise.race([extrator.extrair(bytes, sinal), quandoAbortar(sinal)])
      if (resultado.falha === 'extracao_falhou') throw new JobFailureError(JobFailureCode.ERRO_INTERNO)
      if (resultado.falha !== null) return (await falharDeVez(materialId, resultado.falha, 'material.extracao_falhou', tentativa)) ? 'falhou' : 'sem_efeito'
      const gravou = await banco.transaction(async (tx) => {
        const materiais = new ExtracaoDoMaterialRepository(tx)
        const disciplinaId = await materiais.marcarPronto(materialId, resultado.paginas)
        // Excluído, ou já extraído por outro job, enquanto era lido: nenhum trecho entra, e o objeto é de quem mudou a linha.
        if (disciplinaId === undefined) return false
        await materiais.gravarTrechos(materialId, disciplinaId, resultado.trechos)
        return true
      })
      if (!gravou) return 'sem_efeito'
      const paginasTotal = resultado.paginas
      const trechosTotal = resultado.trechos.length
      logger.info({ evento: 'material.extraido', materialId, paginasTotal, trechosTotal, tentativa })
      await apagarObjeto(materialId)
      return 'pronto'
    }

    let desfecho: Desfecho
    try {
      desfecho = await extrair()
    } catch (erro) {
      if (!ultimaTentativa) {
        medir('nova_tentativa', inicio)
        logger.warn({ evento: 'material.extracao_repetira', materialId, tentativa, erro: summarizeError(erro) })
        throw erro
      }
      // A última tentativa falhou: o material não fica `processando` com o job `falhou`, e o objeto não fica para trás. Falha daqui não esconde o erro.
      await falharDeVez(materialId, 'extracao_falhou', 'material.extracao_falhou', tentativa).catch((falha: unknown) =>
        logger.warn({ evento: 'material.falha_nao_gravada', materialId, erro: summarizeError(falha) }),
      )
      medir('falhou', inicio)
      throw erro
    }
    medir(desfecho, inicio)
    if (desfecho === 'sem_efeito') logger.info({ evento: 'material.extracao_sem_efeito', materialId, tentativa })
  }
}
