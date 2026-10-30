import {
  InvalidConfigError,
  diaAnterior,
  diaDeUso,
  diaValido,
  runInContext,
  FORMATO_MES,
  systemClock,
  UsageRepository,
  type Database,
  type Clock,
  type UsagePeriod,
} from '@educa/nucleo'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { abrirBancoDeOperacao, ArgumentoInvalido, autorDoComando, lerOperador, OperadorRecusado, type BancoDoComando, type SaidaDoComando } from './comando.js'
import type { ConferenciaDoAutor } from '../sessao/index.js'

export { ArgumentoInvalido }

// Mora em `comando.ts` desde a A0; reexportado para quem já o importava daqui (`ops:sessao-sintetica`).
export { urlDoBancoDeOperacao } from './comando.js'

/**
 * Consulta de operação do uso de infra de uma escola (D30, RF17), lida de `uso_infra_diario`:
 *
 *   OPERADOR=<pessoa da equipe> npm run -s ops:uso -- --escola <uuid> [--dia AAAA-MM-DD] [--mes AAAA-MM]
 *
 * Sem `--dia`, vale o último dia fechado (ontem, em São Paulo); sem `--mes`, o mês desse dia. Imprime
 * JSON com contagens e bytes, e nada de pessoa. O dia de hoje só aparece depois da consolidação das 2h.
 *
 * É ferramenta nossa, rodada por quem opera, e não rota: a escola vem da opção, e a consulta roda no
 * contexto dela, pelo mesmo repository com escopo que qualquer outro código usaria. Desde a A0 lê o `OPERADOR`, como os
 * outros `ops:*`: com operador ativo, só um deles consulta.
 */

export interface PedidoDeUso {
  escolaId: string
  dia: string
  mes: string
}

export interface RespostaDeUso {
  escolaId: string
  dia: UsagePeriod & { data: string }
  mes: UsagePeriod & { referencia: string }
}

function lerOpcoes(argumentos: string[]) {
  try {
    return parseArgs({
      args: argumentos,
      options: { escola: { type: 'string' }, dia: { type: 'string' }, mes: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    }).values
  } catch {
    // O erro do parseArgs repete o argumento recebido; a mensagem fica só com as opções aceitas.
    throw new ArgumentoInvalido('--escola, --dia ou --mes')
  }
}

export function lerPedidoDeUso(argumentos: string[], relogio: Clock = systemClock): PedidoDeUso {
  const valores = lerOpcoes(argumentos)
  if (valores.escola === undefined || !z.uuid().safeParse(valores.escola).success) throw new ArgumentoInvalido('--escola')
  const dia = valores.dia ?? diaAnterior(diaDeUso(relogio.agora()))
  if (!diaValido(dia)) throw new ArgumentoInvalido('--dia')
  const mes = valores.mes ?? dia.slice(0, 7)
  if (!FORMATO_MES.test(mes)) throw new ArgumentoInvalido('--mes')
  return { escolaId: valores.escola.toLowerCase(), dia, mes }
}

/**
 * O uso da escola do pedido no dia e no mês, lido no contexto dela, numa transação curta que começa pela conferência do
 * autor (Tech Spec da A0b, seção 7c, "Autor ativo"): o comando só lê, e mesmo assim só um operador ativo lê.
 */
export function consultarUso(banco: Database, autor: ConferenciaDoAutor, pedido: PedidoDeUso): Promise<RespostaDeUso> {
  const requisicaoId = randomUUID()
  return runInContext({ requisicaoId }, () =>
    banco.transaction(async (tx) => {
      await autor(tx)
      const repositorio = new UsageRepository(tx)
      return runInContext({ requisicaoId, escolaId: pedido.escolaId }, async () => ({
        escolaId: pedido.escolaId,
        dia: { data: pedido.dia, ...(await repositorio.doDia(pedido.dia)) },
        mes: { referencia: pedido.mes, ...(await repositorio.doMes(pedido.mes)) },
      }))
    }),
  )
}

/**
 * Executa o comando e devolve o código de saída: 0 consultado, 2 argumento ou ambiente inválido, ou `OPERADOR` que não é
 * operador ativo. Argumento e formato do `OPERADOR` são conferidos antes de abrir o banco; o `OPERADOR`, contra os
 * operadores ativos, na transação da consulta, antes dela.
 */
export async function executarOpsUso(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: SaidaDoComando,
  abrirBanco: (ambiente: Record<string, string | undefined>) => BancoDoComando = abrirBancoDeOperacao,
): Promise<number> {
  try {
    const pedido = lerPedidoDeUso(argumentos)
    const operador = lerOperador(ambiente)
    const { banco, fechar } = abrirBanco(ambiente)
    try {
      terminal.saida(`${JSON.stringify(await consultarUso(banco, autorDoComando(operador), pedido), null, 2)}\n`)
      return 0
    } finally {
      await fechar()
    }
  } catch (erro) {
    if (!(erro instanceof ArgumentoInvalido || erro instanceof InvalidConfigError || erro instanceof OperadorRecusado)) throw erro
    // Só o nome da opção ou da variável: nunca o valor, que pode ser a senha do banco.
    terminal.erro(`${erro.message}\n`)
    return 2
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executarOpsUso(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
