import { derrubarJob } from '../processo/sequencia-do-portao.ts'

/** O que o `docker compose ps` devolveu: o código de saída, a saída padrão (uma linha por serviço) e a de erro. */
export interface ResultadoDoPs {
  codigo: number
  saida: string
  erro: string
}

export interface EntradaDaConferencia {
  /** Roda `docker compose <ARGUMENTOS_COMPOSE> ps --status running --services`: é a fronteira com o Docker, e a única coisa trocada no teste. */
  ps: () => ResultadoDoPs
  /** Os despachantes e workers do compose de teste (`servicosDeJob`, em `tools/ci/compose.ts`). */
  servicosDeJob: readonly string[]
  /** O começo do `docker compose` do ambiente de teste deste checkout (`['docker', ...ARGUMENTOS_COMPOSE]`). */
  docker: readonly string[]
}

/** Dos serviços de pé, os que consomem job. Postgres, Redis e storage de pé são o esperado e não entram. */
export function jobsDePe(saidaDoPs: string, servicosDeJob: readonly string[]): string[] {
  const dePe = new Set(saidaDoPs.split('\n').map((linha) => linha.trim()))
  return servicosDeJob.filter((servico) => dePe.has(servico))
}

/** A recusa: quem está de pé, por que importa, e o comando que os para, o mesmo `stop` da sequência do portão. */
export function mensagemDosJobsDePe(dePe: readonly string[], comandoDoStop: string): string {
  return [
    `Há despachante ou worker de pé no compose de teste: ${dePe.join(', ')}.`,
    'Um deles consome o job que o teste enfileirou, e o teste falha sem que o código esteja errado.',
    'Não os derrubo sozinho: o ambiente de pé pode ser a vitrine ou o e2e de alguém.',
    'Se for seu, pare-os na raiz do repositório e rode de novo:',
    `  ${comandoDoStop}`,
  ].join('\n')
}

/**
 * Recusa a integração enquanto houver despachante ou worker do compose de teste de pé. Nunca derruba nada: quem sabe se o
 * ambiente é seu é quem o subiu. O portão local já os para antes (`sequencia-do-portao.ts`); isto é para a integração
 * rodada à mão, onde o `e2e --manter-ambiente` e a vitrine os deixam de pé.
 */
export function recusarJobDePe({ ps, servicosDeJob, docker }: EntradaDaConferencia): void {
  const resultado = ps()
  if (resultado.codigo !== 0) {
    throw new Error(`Não foi possível listar os serviços de pé no compose de teste: \`docker compose ps\` falhou.\n${resultado.erro.trim()}`)
  }
  const dePe = jobsDePe(resultado.saida, servicosDeJob)
  if (dePe.length > 0) throw new Error(mensagemDosJobsDePe(dePe, derrubarJob(docker, servicosDeJob)))
}
