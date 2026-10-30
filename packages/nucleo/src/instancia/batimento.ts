import { writeFileSync } from 'node:fs'

/** Arquivo que o processo sem HTTP (despachante, worker) toca para dizer que está vivo. */
export const ARQUIVO_BATIMENTO = '/tmp/educa-batimento'

/** Idade máxima do batimento para o healthcheck do compose considerar o processo saudável. */
export const IDADE_MAXIMA_BATIMENTO_MS = 10_000

/**
 * Healthcheck de processo sem porta HTTP. O despachante bate a cada rodada do laço, e o worker a
 * cada 2 s pelo event loop: laço parado ou event loop travado deixam o arquivo envelhecer, e o
 * compose vê `unhealthy`.
 */
export class Heartbeat {
  readonly #arquivo: string

  constructor(arquivo: string = ARQUIVO_BATIMENTO) {
    this.#arquivo = arquivo
  }

  bater(): void {
    try {
      writeFileSync(this.#arquivo, String(Date.now()))
    } catch {
      // Sem onde gravar, o healthcheck acusa; o trabalho do processo não para por isso.
    }
  }
}

/** Comando do healthcheck, com a mesma idade máxima usada aqui. */
export const COMANDO_HEALTHCHECK_BATIMENTO = `const fs=require('fs');try{process.exit(Date.now()-fs.statSync('${ARQUIVO_BATIMENTO}').mtimeMs<${IDADE_MAXIMA_BATIMENTO_MS}?0:1)}catch{process.exit(1)}`
