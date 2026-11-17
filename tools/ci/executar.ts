import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const raizRepositorio = fileURLToPath(new URL('../..', import.meta.url))

export interface Etapa {
  nome: string
  comando: string
  argumentos: readonly string[]
  /** Variáveis de ambiente desta etapa, por cima das do processo: o build da web que leva a galeria das peças. */
  ambiente?: Readonly<Record<string, string>>
  /** Chamado quando a etapa termina, verde ou vermelha, com a duração dela: é por aqui que o e2e mede os testes. */
  aoTerminar?: (codigo: number, duracaoMs: number) => void
}

export function rodarEtapa(etapa: Etapa): Promise<number> {
  process.stdout.write(`\n▶ ${etapa.nome}\n`)
  return new Promise((resolver) => {
    const processo = spawn(etapa.comando, etapa.argumentos, { cwd: raizRepositorio, stdio: 'inherit', ...(etapa.ambiente === undefined ? {} : { env: { ...process.env, ...etapa.ambiente } }) })
    processo.on('error', () => resolver(127))
    // Morto por sinal também é falha: `code` nulo não pode virar sucesso.
    processo.on('close', (codigo) => resolver(codigo ?? 1))
  })
}

/**
 * Roda as etapas em ordem e para na primeira que falhar. A finalização (derrubar o compose,
 * por exemplo) roda sempre, e nunca apaga a falha: o código devolvido é o da primeira etapa
 * que falhou, ou o da finalização se só ela falhou.
 */
export async function executarEtapas(
  etapas: readonly Etapa[],
  finalizacao: (codigo: number) => readonly Etapa[] = () => [],
): Promise<number> {
  let codigo = 0
  for (const etapa of etapas) {
    const inicio = performance.now()
    codigo = await rodarEtapa(etapa)
    etapa.aoTerminar?.(codigo, performance.now() - inicio)
    if (codigo !== 0) break
  }
  for (const etapa of finalizacao(codigo)) {
    const codigoFinalizacao = await rodarEtapa(etapa)
    if (codigo === 0) codigo = codigoFinalizacao
  }
  return codigo
}

/**
 * Lê `--shard=<i>/<n>` dos argumentos de `ci:infra` e de `ci:unidade`, a fatia dos arquivos de teste que este runner roda (o Vitest
 * reparte por arquivo, por hash do caminho). Sem ele, `null`: o projeto inteiro, que é o `npm run ci:<suíte>` da máquina. Formato
 * errado reprova antes de rodar qualquer coisa, em vez de rodar a suíte inteira numa fatia que não cabe no teto. `suite` só entra
 * na mensagem do erro.
 */
export function fatiaDosArgumentosDoVitest(argumentos: readonly string[], suite: 'infra' | 'unidade'): string | null {
  if (argumentos.length === 0) return null
  const fatia = /^--shard=(\d+)\/(\d+)$/.exec(argumentos.length === 1 ? (argumentos[0] ?? '') : '')
  const indice = Number(fatia?.[1])
  const total = Number(fatia?.[2])
  if (fatia === null || indice < 1 || indice > total) {
    throw new Error(`fatia da ${suite} inválida: ${argumentos.join(' ')} (esperado um só --shard=<i>/<n>, com 1 ≤ i ≤ n)`)
  }
  return `${String(indice)}/${String(total)}`
}

export async function encerrarCom(execucao: Promise<number>): Promise<never> {
  const codigo = await execucao
  process.stdout.write(codigo === 0 ? '\n✔ esteira: etapa verde\n' : `\n✖ esteira: falhou com código ${codigo}\n`)
  process.exit(codigo)
}
