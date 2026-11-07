// A fila de carga da máquina: um `flock` que o portão local, o e2e e o encontro das linhas tomam sozinhos.
//
// Cada linha da spec tem o seu ambiente de teste, mas a máquina é uma só: o e2e de duas linhas ao mesmo tempo estoura os
// 30 s do runner (X2, carga de 9 a 24). A fila existia só no texto das skills (`flock /tmp/educa-carga.lock <comando>`),
// e dependia de quem digitava o comando. Aqui ela é do comando: `portao-local.ts`, `tools/ci/e2e.ts` e `tools/processo/linhas.ts encontro`
// chamam `garantirFilaDeCarga()` antes de qualquer etapa e, sem o lugar, se relançam por dentro do `flock`.
//
// - Quem já está na fila não entra de novo. O fd da trava vive no processo que o `flock` executa, mas não passa aos
//   filhos que o Node inicia (o libuv não o deixa herdar: medido com `npm exec -- node` sob `flock`), e é um filho assim
//   o `npm run test:e2e` que o portão inicia por dentro. Por isso a pergunta é outra: algum antepassado deste processo é
//   o dono da trava em `/proc/locks`? Cobre também quem digita `flock … node …` como as skills mandavam.
// - Na esteira (`CI=true`) não há fila: cada job tem uma máquina só para ele.
// - Sem `flock` na máquina o comando segue sem fila, e diz isso.
// - Fila presa: `kill -9` no comando de fora não leva o relançado junto, e ele segue segurando a vez até acabar. Ache o
//   dono com `cat /proc/locks` (o inode de `/tmp/educa-carga.lock` está em `stat -c %i`) e mate esse pid.
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, openSync, readFileSync, statSync } from 'node:fs'

export const FILA_DE_CARGA = '/tmp/educa-carga.lock'
/** Só o teste a muda: a trava de verdade é a que o portão que roda os testes está segurando. */
export const VARIAVEL_DA_FILA = 'EDUCA_FILA_DE_CARGA'

/** Os pids que seguram a trava deste inode (as linhas `->` são quem espera, e não seguram). */
export function donosDoTravamento(locks: string, inode: number): Set<number> {
  const donos = new Set<number>()
  for (const linha of locks.split('\n')) {
    const achado = /^\d+:\s+FLOCK\s+\S+\s+\S+\s+(\d+)\s+[0-9a-f]+:[0-9a-f]+:(\d+)\s/.exec(linha)
    if (achado && Number(achado[2]) === inode) donos.add(Number(achado[1]))
  }
  return donos
}

function paiNoProc(pid: number): number | null {
  try {
    const estado = readFileSync(`/proc/${String(pid)}/stat`, 'utf8')
    // O nome do processo (entre parênteses) pode ter espaço: o resto começa depois do último `)`.
    const pai = Number(estado.slice(estado.lastIndexOf(')') + 2).split(' ')[1])
    return Number.isInteger(pai) ? pai : null
  } catch {
    return null
  }
}

/** O processo e os pais dele, até a raiz. */
export function ancestraisDe(pid: number, paiDe: (pid: number) => number | null = paiNoProc): number[] {
  const cadeia: number[] = []
  let atual: number | null = pid
  while (atual !== null && atual > 0 && !cadeia.includes(atual)) {
    cadeia.push(atual)
    atual = paiDe(atual)
  }
  return cadeia
}

function inodeDaTrava(caminho: string): number {
  closeSync(openSync(caminho, 'a'))
  return statSync(caminho).ino
}

function jaEstaNaFila(caminho: string): boolean {
  try {
    const donos = donosDoTravamento(readFileSync('/proc/locks', 'utf8'), inodeDaTrava(caminho))
    return ancestraisDe(process.pid).some((pid) => donos.has(pid))
  } catch {
    return false
  }
}

/**
 * Garante o lugar na fila. Quem já tem o lugar (ou está na esteira) segue; os outros se relançam por dentro de
 * `flock <trava> node <este mesmo script> <mesmos argumentos>` e saem com o código do relançado.
 */
export async function garantirFilaDeCarga(): Promise<void> {
  if (process.env['CI'] === 'true') return
  const caminho = process.env[VARIAVEL_DA_FILA] ?? FILA_DE_CARGA
  if (jaEstaNaFila(caminho)) return

  const sondagem = spawnSync('flock', ['-n', caminho, 'true'])
  if (sondagem.error) {
    process.stdout.write(`\n⚠ sem o flock nesta máquina: ${process.argv[1] ?? 'o comando'} segue sem a fila de carga.\n`)
    return
  }
  if (sondagem.status !== 0) {
    process.stdout.write(`\n⏳ fila de carga: outra linha está rodando o portão ou o e2e. Espero a vez em ${caminho}.\n`)
  }
  const filho = spawn('flock', ['--no-fork', caminho, process.execPath, ...process.execArgv, ...process.argv.slice(1)], { stdio: 'inherit' })
  // `--no-fork`: o `flock` vira o próprio comando, e o sinal que este processo repassa chega nele. Com o fork padrão o
  // `flock` morre sozinho e o portão continua, órfão, segurando a fila sem dono.
  for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(sinal, () => filho.kill(sinal))
  const codigo = await new Promise<number>((resolver) => filho.on('close', (saida) => resolver(saida ?? 1)))
  process.exit(codigo)
}
