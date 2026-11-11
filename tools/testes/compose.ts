import { spawn, spawnSync } from 'node:child_process'
import { ARGUMENTOS_COMPOSE } from '../ci/compose.ts'
import { raizRepositorio } from '../ci/executar.ts'

/**
 * Os processos da fila no compose: dois despachantes, duas réplicas do worker interativo (filas
 * interativa e normal), duas do worker de lote e o worker da fila `pdf`. Teste que usa despachante e worker no próprio processo
 * para estes antes, para nenhum deles disputar as linhas.
 */
export const PROCESSOS_DA_FILA = ['despachante-1', 'despachante-2', 'worker-interativo-1', 'worker-interativo-2', 'worker-lote-1', 'worker-lote-2', 'worker-pdf'] as const

export interface ResultadoComando {
  codigo: number
  saida: string
}

export function compose(...argumentos: string[]): ResultadoComando {
  const resultado = spawnSync('docker', [...ARGUMENTOS_COMPOSE, ...argumentos], {
    cwd: raizRepositorio,
    encoding: 'utf8',
  })
  return { codigo: resultado.status ?? 1, saida: `${resultado.stdout}${resultado.stderr}` }
}

/**
 * Como `compose`, sem bloquear o event loop: o teste segue disparando requisição enquanto o
 * compose reinicia ou para um serviço.
 */
export function composeAssincrono(...argumentos: string[]): Promise<ResultadoComando> {
  return composeAssincronoCom({}, ...argumentos)
}

/**
 * Como `composeAssincrono`, com variáveis que sobrepõem as dos arquivos de ambiente na interpolação do compose (a do
 * processo vence a do `--env-file`): o ensaio de alertas recria a API com o hash lento assim, sem arquivo a mais.
 */
export function composeAssincronoCom(sobreposicao: Readonly<Record<string, string>>, ...argumentos: string[]): Promise<ResultadoComando> {
  return new Promise((resolver) => {
    const processo = spawn('docker', [...ARGUMENTOS_COMPOSE, ...argumentos], { cwd: raizRepositorio, env: { ...process.env, ...sobreposicao } })
    let saida = ''
    processo.stdout.on('data', (parte: Buffer) => (saida += parte.toString()))
    processo.stderr.on('data', (parte: Buffer) => (saida += parte.toString()))
    processo.on('error', () => resolver({ codigo: 127, saida }))
    processo.on('close', (codigo) => resolver({ codigo: codigo ?? 1, saida }))
  })
}

export async function composeAssincronoOuFalha(...argumentos: string[]): Promise<string> {
  const resultado = await composeAssincrono(...argumentos)
  if (resultado.codigo !== 0) {
    throw new Error(`docker compose ${argumentos.join(' ')} falhou:\n${resultado.saida}`)
  }
  return resultado.saida
}

export function composeOuFalha(...argumentos: string[]): string {
  const resultado = compose(...argumentos)
  if (resultado.codigo !== 0) {
    throw new Error(`docker compose ${argumentos.join(' ')} falhou:\n${resultado.saida}`)
  }
  return resultado.saida
}

/** O erro do daemon quando o bind da porta publicada esbarra em quem ainda a segura. */
const PORTA_OCUPADA = /address already in use/i

/** Como `recriarDoZero` fala com o compose. */
export type ExecutorDeCompose = (...argumentos: string[]) => Promise<ResultadoComando>

/** Quantas voltas a porta ocupada ganha, e a espera entre elas: a janela real é de fração de segundo. */
const TENTATIVAS_COM_A_PORTA_OCUPADA = 5
const ESPERA_ENTRE_TENTATIVAS_MS = 1_000

/**
 * Recria o serviço em contêiner novo — sem nada da execução anterior dentro dele — sem disputar a porta
 * publicada com o contêiner que sai.
 *
 * `up --force-recreate` sobe o novo sem esperar o anterior soltar a porta, e o bind morre com
 * `address already in use` (dois portões vermelhos em 22/09/2026,
 * `tasks/correcoes/2026-09-22-corrida-de-porta-na-observabilidade.md`). `rm --force --stop` devolve com a
 * publicação já liberada, e é isso que torna a subida seguinte segura. As voltas cobrem quem segura a
 * porta de fora deste comando — um `down` de outra execução ainda saindo —, e o `rm` de cada uma leva
 * junto o contêiner que a anterior deixou em `created`.
 *
 * Reaproveitar o contêiner (`up` ou `start` simples) não serve onde isto é usado: a observabilidade não
 * tem volume, então série do Prometheus e estado de alerta vivem dentro dele.
 *
 * Devolve com o serviço são, pelo `--wait`: quem chama não precisa do `aguardarSaudavel` que a guarda
 * `esperar-servico-do-compose` exige de quem sobe serviço na mão. Sem `--no-deps`: dependência
 * declarada no compose sobe junto, como em qualquer `up`.
 *
 * `executar` existe para o laço ter teste sem Docker: nova tentativa **só** no erro do bind, e o fim das
 * voltas. Quem chama de verdade não passa nada.
 */
export async function recriarDoZero(servico: string, executar: ExecutorDeCompose = composeAssincrono): Promise<void> {
  for (let tentativa = 1; ; tentativa++) {
    const remocao = await executar('rm', '--force', '--stop', servico)
    if (remocao.codigo !== 0) {
      throw new Error(`docker compose rm --force --stop ${servico} falhou:\n${remocao.saida}`)
    }
    const subida = await executar('up', '--detach', '--wait', servico)
    if (subida.codigo === 0) return
    // Qualquer falha que não seja a porta ocupada estoura na hora: repeti-la custaria cinco subidas de
    // serviço quebrado (a observabilidade espera o healthcheck por ~2 min) antes de o vermelho aparecer.
    if (tentativa === TENTATIVAS_COM_A_PORTA_OCUPADA || !PORTA_OCUPADA.test(subida.saida)) {
      throw new Error(`docker compose up --detach --wait ${servico} falhou na tentativa ${tentativa}:\n${subida.saida}`)
    }
    await new Promise((resolver) => setTimeout(resolver, ESPERA_ENTRE_TENTATIVAS_MS))
  }
}

/**
 * Espera o healthcheck do serviço voltar a `healthy`. `up --wait` não serve depois de um
 * `pause`: ele desiste na hora se o último estado registrado for `unhealthy`.
 */
export async function aguardarSaudavel(servico: string, limiteMs = 60_000): Promise<void> {
  const prazo = Date.now() + limiteMs
  while (Date.now() < prazo) {
    const { codigo, saida } = compose('ps', '--all', '--format', '{{.Health}}', servico)
    if (codigo === 0 && saida.trim() === 'healthy') return
    await new Promise((resolver) => setTimeout(resolver, 500))
  }
  // Estado e fim do log junto do erro: na esteira, o log do fim da execução só guarda as últimas linhas de
  // cada serviço, e o trecho da falha já saiu dele.
  const estado = compose('ps', '--all', '--format', '{{.State}} {{.Status}} {{.Health}}', servico).saida.trim()
  const log = compose('logs', '--no-color', '--timestamps', '--tail', '40', servico).saida
  throw new Error(`${servico} não voltou a healthy em ${limiteMs} ms (${estado})\n${log}`)
}
