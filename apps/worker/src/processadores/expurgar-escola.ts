import {
  ALVOS_DO_EXPURGO_DA_ESCOLA,
  currentContext,
  estaNaJanela,
  LOTE_DO_EXPURGO,
  ordemDaNoite,
  summarizeError,
  type FileStorage,
  type ArquivoDoTitularRepository,
  type OperationalSettings,
  type JobOutbox,
  type ExpurgoDaEscolaRepository,
  type JanelaLetiva,
  type LoggerBase,
  type Clock,
  type RetencaoDaEscolaRepository,
} from '@educa/nucleo'
import { JobFailureCode, InvariantException, retencaoDaEscola, type TIPO_EXPURGAR_ESCOLA } from '@educa/shared'
import type { Processador } from '../executor.js'
import { FalhaDeJob } from '../falha-de-job.js'

/** Quantos arquivos do titular o expurgo apaga por volta: cada um é uma chamada ao storage, e são poucos por escola. */
export const LOTE_DOS_ARQUIVOS_DO_TITULAR = 100

export interface DependenciasDoExpurgoDaEscola {
  repositorio: Pick<ExpurgoDaEscolaRepository, 'expurgarLote' | 'expurgarRegistroDoExpurgo' | 'registrar' | 'categoriaPendente' | 'enfileirarEliminacoes'>
  /** A porta de entrada do trabalho demorado: o job `titular.eliminar` de cada pedido de eliminação vencido sai por ela (F3, tarefa 15.0). */
  enfileirador: Pick<JobOutbox, 'enfileirarUmaVez'>
  /** Os arquivos do titular vencidos ou marcados `apagado_em` (F3, tarefa 13.0): o objeto sai do storage, e só então a linha. */
  arquivos: Pick<ArquivoDoTitularRepository, 'aApagar' | 'apagarLinhas'>
  armazem: Pick<FileStorage, 'apagar'>
  retencao: Pick<RetencaoDaEscolaRepository, 'ajustes'>
  /** O horário letivo da escola do contexto: o expurgo confere a cada lote, e para quando ele abre. */
  janelaDaEscola: Pick<OperationalSettings<JanelaLetiva>, 'daEscola'>
  relogio: Clock
  logger: LoggerBase
  /** Linhas por lote. Só o teste troca. */
  lote?: number
}

/**
 * `retencao.expurgar-escola` (F3, tarefas 3.0 a 5.0; Tech Spec do F3, seção 5): no contexto da escola do job, apaga,
 * anonimiza ou elimina, como o catálogo diz, o que passou do prazo efetivo de cada categoria (`retencaoDaEscola`, com o ajuste da
 * escola e as travas: o tema da execução e o texto do modelo não passam da conversa do professor, e o aluno do consumo não
 * passa da conversa do Tutor), em lotes de 5.000, uma transação por lote, e grava uma linha de `expurgo_execucao` por
 * categoria, mesmo com zero. Terminadas as categorias, apaga o próprio registro do expurgo (`expurgo_execucao`) que passou
 * de 5 anos, sem linha sobre isso.
 *
 * - **O lote que falha** grava a linha da categoria com `concluida = false` antes de o erro subir, para a falha contar
 *   no alerta mesmo na primeira noite da escola.
 * - **A janela letiva é conferida antes de cada lote.** Se ela abriu, a categoria em andamento grava `concluida = false`
 *   com o que já saiu, e o job termina sem passar às seguintes. A noite seguinte começa pela categoria pendente e dá a
 *   volta no catálogo; duas noites seguidas sem terminar disparam o alerta (`expurgo.noites_incompletas`).
 * - **O corte é contado de um `agora` só**, lido no começo: a execução inteira usa o mesmo prazo, e o teste o injeta.
 *   A janela usa o relógio a cada lote. O fuso do horário letivo vai junto ao lote: a autoria de artefato conta de uma
 *   data, e o dia que vale é o da escola.
 * - Tolera reexecução e dois jobs da mesma escola ao mesmo tempo (D49): o que saiu não volta, o que foi anonimizado não é
 *   relido, e o `skip locked` dá a cada um linhas diferentes. Um job que morre no meio desfaz só o lote em andamento.
 * - **Primeiro, as eliminações vencidas** (F3, tarefa 15.0): o pedido `agendado` com `eliminar_em` passado, ainda sem job ou com o
 *   job enfileirado há mais de 20 h, vira um `titular.eliminar` na fila de lote, não urgente, na transação que marca
 *   `eliminacao_enfileirada_em` (a trava do cancelamento). O trabalho em si é do job `titular.eliminar`.
 * - Loga só a categoria (sob `tipo`) e as contagens; a escola vai pelo contexto, nunca uma linha.
 */
export function criarExpurgoDaEscola({ repositorio, arquivos, armazem, retencao, janelaDaEscola, enfileirador, relogio, logger, lote = LOTE_DO_EXPURGO }: DependenciasDoExpurgoDaEscola): Processador<typeof TIPO_EXPURGAR_ESCOLA> {
  return async () => {
    if (currentContext()?.escolaId === undefined) throw new FalhaDeJob(JobFailureCode.DADOS_INVALIDOS, true)
    const agora = relogio.agora()
    // Primeiro, as eliminações vencidas (F3, tarefa 15.0): cada pedido `agendado` com `eliminar_em` passado vira um
    // `titular.eliminar` na fila de lote, na mesma transação da marca `eliminacao_enfileirada_em`. É só gravar linhas: o
    // job faz o trabalho pesado, e a janela letiva já o segura (não urgente). Falhar aqui falha o job da escola, e a fila repete.
    const { enfileirados: eliminacoesTotal, jaEnfileirados: eliminacoesJaEnfileiradasTotal } = await repositorio.enfileirarEliminacoes(enfileirador)
    const prazos = new Map(retencaoDaEscola(await retencao.ajustes()).map(({ categoria, meses }) => [categoria, meses]))
    const janela = await janelaDaEscola.daEscola()
    // Primeiro os arquivos do titular (F3, tarefa 13.0): o objeto sai do storage e só então a linha. O que o storage não
    // deixou apagar fica com a linha e é tentado de novo na noite seguinte (pelo `apagado_em` ou pelo vencimento).
    const { apagados: arquivosApagadosTotal, naoApagados: arquivosNaoApagadosTotal } = await apagarArquivosDoTitular({ arquivos, armazem, janela, relogio, agora, logger })
    const ordem = ordemDaNoite(await repositorio.categoriaPendente())
    let linhasTotal = 0
    for (const categoria of ordem) {
      const meses = prazos.get(categoria)
      if (meses === undefined) throw new InvariantException('categoria sem prazo no catálogo')
      let linhasDaCategoriaTotal = 0
      try {
        for (const alvo of ALVOS_DO_EXPURGO_DA_ESCOLA[categoria]) {
          for (;;) {
            if (estaNaJanela(janela, relogio.agora())) {
              await repositorio.registrar(categoria, linhasDaCategoriaTotal, false, relogio.agora())
              linhasTotal += linhasDaCategoriaTotal
              // A categoria vai sob `tipo`: o nome dela é do catálogo, nunca de pessoa.
              const tipo = categoria
              logger.info({ evento: 'retencao.expurgo_interrompido', tipo, linhasDaCategoriaTotal, linhasTotal })
              return
            }
            const doLote = await repositorio.expurgarLote(alvo, { agora, meses, fuso: janela.fuso }, lote)
            linhasDaCategoriaTotal += doLote.linhas
            if (!doLote.cheio) break
          }
        }
      } catch (erro) {
        // O lote que falha (prazo da instrução, erro de SQL) também deixa a linha da noite, `false`: sem ela, a escola cujo
        // expurgo falha desde a primeira noite nunca teria série, e o alerta de duas noites nunca dispararia. O erro sobe,
        // e a fila tenta de novo; se nem a linha grava (o banco fora), fica o aviso e sobe o erro original. A gravação da
        // janela letiva, acima, também está aqui dentro: se ela falhar, esta tenta a mesma linha de novo, uma vez só.
        await repositorio.registrar(categoria, linhasDaCategoriaTotal, false, relogio.agora()).catch((falhaDoRegistro: unknown) => {
          const tipo = categoria
          logger.warn({ evento: 'retencao.registro_nao_gravado', tipo, erro: summarizeError(falhaDoRegistro) })
        })
        throw erro
      }
      await repositorio.registrar(categoria, linhasDaCategoriaTotal, true, relogio.agora())
      linhasTotal += linhasDaCategoriaTotal
    }
    // O registro do próprio expurgo (prazo fixo de 5 anos) sai depois das categorias, também em lotes e sem passar da janela
    // letiva. A noite já está completa (cada categoria gravou `true`): se a janela abrir aqui, o resto sai na seguinte.
    let registroApagadoTotal = 0
    for (;;) {
      if (estaNaJanela(janela, relogio.agora())) {
        const tipo = 'expurgo_execucao'
        logger.info({ evento: 'retencao.expurgo_interrompido', tipo, registroApagadoTotal, linhasTotal })
        return
      }
      const doLote = await repositorio.expurgarRegistroDoExpurgo(agora, lote)
      registroApagadoTotal += doLote.linhas
      if (!doLote.cheio) break
    }
    const categoriasTotal = ordem.length
    logger.info({
      evento: 'retencao.expurgada',
      categoriasTotal,
      linhasTotal,
      registroApagadoTotal,
      arquivosApagadosTotal,
      arquivosNaoApagadosTotal,
      eliminacoesTotal,
      eliminacoesJaEnfileiradasTotal,
    })
  }
}

interface DependenciasDoApagarArquivos {
  arquivos: DependenciasDoExpurgoDaEscola['arquivos']
  armazem: DependenciasDoExpurgoDaEscola['armazem']
  janela: JanelaLetiva
  relogio: Clock
  agora: Date
  logger: LoggerBase
}

/**
 * Apaga os arquivos do titular que venceram ou foram marcados `apagado_em` (a eliminação do titular, 15.0), em lotes, do mais
 * antigo, **sem passar da janela letiva**: o objeto sai do storage e, só depois, a linha. Falha ao apagar um objeto não
 * derruba o job nem os outros arquivos: a linha fica, e a noite seguinte o tenta de novo. O lote em que nenhum objeto saiu
 * para o laço, porque os mesmos voltariam; o laço termina quando a leitura volta vazia. O arquivo com 7 dias fica e o com 8 sai
 * (a comparação do repositório é estrita).
 */
async function apagarArquivosDoTitular({ arquivos, armazem, janela, relogio, agora, logger }: DependenciasDoApagarArquivos): Promise<{ apagados: number; naoApagados: number }> {
  let apagados = 0
  let naoApagados = 0
  for (;;) {
    const doLote = await arquivos.aApagar(agora, LOTE_DOS_ARQUIVOS_DO_TITULAR)
    if (doLote.length === 0) break
    // A janela só é conferida quando há o que apagar: a escola sem arquivo vencido não gasta uma leitura do relógio.
    if (estaNaJanela(janela, relogio.agora())) break
    const sairam: string[] = []
    for (const arquivo of doLote) {
      try {
        await armazem.apagar(arquivo.chaveObjeto)
        sairam.push(arquivo.id)
      } catch (erro) {
        naoApagados += 1
        // Nem a chave do objeto nem o texto do erro vão ao log: só que um objeto ficou, e o motivo resumido.
        logger.warn({ evento: 'retencao.arquivo_nao_apagado', erro: summarizeError(erro) })
      }
    }
    const linhasApagadas = await arquivos.apagarLinhas(sairam)
    apagados += linhasApagadas
    // Nenhum objeto saiu, ou nenhuma linha saiu com eles: o mesmo lote voltaria, e a noite seguinte tenta de novo.
    if (sairam.length === 0 || linhasApagadas === 0) break
  }
  return { apagados, naoApagados }
}
