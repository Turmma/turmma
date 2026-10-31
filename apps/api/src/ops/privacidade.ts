import { InvalidConfigError, DomainException, runInContext, IncidenteDaEscolaRepository, summarizeError, SuboperadorDaEscolaRepository, type Database } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { AcessoDaEscolaRepository } from '../credencial/index.js'
import { abrirBancoDeOperacao, InvalidArgumentError, autorDoComando, lerOperador, OperadorRejectedError, type CommandDatabase, type CommandOutput } from './command.js'
import { ContagensDePrivacidadeRepository, type ContagensDoAtendimento } from './contagens-de-privacidade.repository.js'
import type { AuthorCheck } from '../sessao/index.js'

/**
 * A privacidade de uma escola vista pela operação (F3, RF17; Tech Spec do F3, seções 6 e 7; regra 20, item 10):
 *
 *   OPERADOR=<pessoa da equipe> npm run -s ops:privacidade -- --escola <uuid>
 *
 * Imprime JSON com **só contagens** e a data da última execução do expurgo: pedidos por estado, eliminações agendadas e
 * vencidas, arquivos ativos e vencidos, suboperadores vigentes, incidentes avisados e sem confirmação, e quantas categorias
 * do expurgo terminaram na última vez. Nenhum nome, id de titular, texto de pedido ou chave de objeto: a operação (D76)
 * acompanha se o atendimento e o expurgo andam, e nunca de quem.
 *
 * É ferramenta nossa, rodada por quem opera, e não rota. Como o `ops:uso` e o `ops:retencao listar`, abre o contexto da
 * escola do pedido e lê com o escopo dela: o atendimento, o arquivo e o expurgo pelo `ContagensDePrivacidadeRepository`, e os
 * suboperadores e os incidentes pelos leitores da escola que já existem, que o comando só conta. Nenhum `@Unscoped` novo.
 * A conferência do `OPERADOR` é a primeira instrução da transação (Tech Spec da A0b, seção 7c, "Autor ativo").
 *
 * O número de incidentes avisados é o da lista que a coordenação vê, que tem teto de `LIMITE_DA_LISTA_DE_INCIDENTES`: uma
 * escola com mais incidentes que isso em cinco anos tem outro problema que este número.
 */

export interface PedidoDePrivacidade {
  readonly escolaId: string
}

function lerOpcoes(argumentos: string[]) {
  try {
    return parseArgs({ args: argumentos, options: { escola: { type: 'string' } }, strict: true, allowPositionals: false }).values
  } catch {
    // O erro do parseArgs repete o argumento recebido; a mensagem fica só com a opção aceita.
    throw new InvalidArgumentError('--escola')
  }
}

export function lerPedidoDePrivacidade(argumentos: string[]): PedidoDePrivacidade {
  const escola = z.uuid().safeParse(lerOpcoes(argumentos).escola)
  if (!escola.success) throw new InvalidArgumentError('--escola')
  return { escolaId: escola.data.toLowerCase() }
}

/** O que o comando imprime: o id da escola que a operação pediu e as contagens, com a data em ISO. */
export interface RespostaDePrivacidade extends Omit<ContagensDoAtendimento, 'expurgo'> {
  readonly escolaId: string
  /** Vigentes para a escola: os de alcance `todas` e os da lista dela, sem `fim`. */
  readonly suboperadoresVigentes: number
  readonly incidentes: { readonly avisados: number; readonly semConfirmacao: number }
  readonly expurgo: { readonly categoriasConcluidas: number; readonly categoriasPendentes: number; readonly ultimaExecucaoEm: string | null }
}

/** As contagens da escola, lidas no contexto dela, numa transação curta que começa pela conferência do autor. */
export function consultarPrivacidade(banco: Database, autor: AuthorCheck, pedido: PedidoDePrivacidade): Promise<RespostaDePrivacidade> {
  const requisicaoId = randomUUID()
  return runInContext({ requisicaoId }, () =>
    banco.transaction(async (tx) => {
      await autor(tx)
      return runInContext({ requisicaoId, escolaId: pedido.escolaId }, async () => {
        if ((await new AcessoDaEscolaRepository(tx).nome()) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        const { expurgo, ...atendimento } = await new ContagensDePrivacidadeRepository(tx).doAtendimento()
        const suboperadores = await new SuboperadorDaEscolaRepository(tx).daEscola()
        const incidentes = await new IncidenteDaEscolaRepository(tx).daEscola()
        return {
          escolaId: pedido.escolaId,
          ...atendimento,
          suboperadoresVigentes: suboperadores.filter((empresa) => empresa.fim === null).length,
          incidentes: { avisados: incidentes.length, semConfirmacao: incidentes.filter((secao) => secao.confirmadoEm === null).length },
          expurgo: { ...expurgo, ultimaExecucaoEm: expurgo.ultimaExecucaoEm?.toISOString() ?? null },
        }
      })
    }),
  )
}

/**
 * Executa o comando e devolve o código de saída: 0 consultado, 1 `NAO_ENCONTRADO` ou `ERRO_INTERNO` resumido, 2 argumento ou
 * ambiente inválido, ou `OPERADOR` que não é operador ativo. Argumento e formato do `OPERADOR` são conferidos antes de abrir
 * o banco; o `OPERADOR`, contra os ativos, dentro da transação.
 */
export async function executarOpsPrivacidade(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: CommandOutput,
  abrirBanco: (ambiente: Record<string, string | undefined>) => CommandDatabase = abrirBancoDeOperacao,
): Promise<number> {
  try {
    const pedido = lerPedidoDePrivacidade(argumentos)
    const operador = lerOperador(ambiente)
    const { banco, fechar } = abrirBanco(ambiente)
    try {
      terminal.saida(`${JSON.stringify(await consultarPrivacidade(banco, autorDoComando(operador), pedido))}\n`)
      return 0
    } finally {
      await fechar()
    }
  } catch (erro) {
    if (erro instanceof InvalidArgumentError || erro instanceof InvalidConfigError || erro instanceof OperadorRejectedError) {
      // Só o nome da opção ou da variável: nunca o valor.
      terminal.erro(`${erro.message}\n`)
      return 2
    }
    if (erro instanceof DomainException && erro.codigo === ErrorCode.NAO_ENCONTRADO) {
      terminal.erro(`${ErrorCode.NAO_ENCONTRADO}: escola não encontrada\n`)
      return 1
    }
    // O erro cru do Postgres traz o valor da linha na mensagem e no `detail`: sai só o resumo seguro.
    terminal.erro(`${ErrorCode.ERRO_INTERNO}: ${JSON.stringify(summarizeError(erro))}\n`)
    return 1
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executarOpsPrivacidade(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
