import { parentPort } from 'node:worker_threads'

/**
 * Thread do sandbox de CPU do job sintético (`SandboxDeCpu`, em `synthetic.ts`). Recebe `{ cpuMs }`, queima
 * esse tanto de CPU desta thread e responde `pronto`. O event loop do worker fica livre enquanto isso, e segue
 * renovando o lock e a vaga dos jobs em andamento.
 *
 * O tempo contado é o de CPU da própria thread, e não o do relógio: num container com `cpus:` fixo e disputado,
 * um job de 2 s de CPU demora mais que 2 s, como um trabalho de verdade demoraria. Sem import de pacote do
 * monorepo: a thread carrega este arquivo sozinha, compilado (`.js`) no container e pelo Node no teste (`.ts`).
 */

/** De quantas em quantas voltas o laço confere o tempo de CPU: a consulta custa mais que a volta. */
const VOLTAS_POR_CONFERENCIA = 20_000

function queimar(cpuMs: number): void {
  const inicio = process.threadCpuUsage()
  const alvoMicrossegundos = cpuMs * 1_000
  let acumulado = 0
  for (;;) {
    for (let volta = 0; volta < VOLTAS_POR_CONFERENCIA; volta++) acumulado = (acumulado * 31 + volta) | 0
    const gasto = process.threadCpuUsage(inicio)
    if (gasto.user + gasto.system >= alvoMicrossegundos) return
  }
}

function cpuMsDoPedido(pedido: unknown): number | undefined {
  if (typeof pedido !== 'object' || pedido === null || !('cpuMs' in pedido)) return undefined
  const { cpuMs } = pedido
  return typeof cpuMs === 'number' && Number.isInteger(cpuMs) && cpuMs >= 0 ? cpuMs : undefined
}

parentPort?.on('message', (pedido: unknown) => {
  const cpuMs = cpuMsDoPedido(pedido)
  if (cpuMs === undefined) {
    parentPort?.postMessage('pedido_invalido')
    return
  }
  queimar(cpuMs)
  parentPort?.postMessage('pronto')
})
