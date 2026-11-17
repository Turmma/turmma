import { describe, expect, it } from 'vitest'
import { derrubarJob } from '../processo/sequencia-do-portao.ts'
import { jobsDePe, recusarJobDePe, type ResultadoDoPs } from './workers-de-pe.ts'

const DOCKER = ['docker', 'compose', '--project-name', 'educa-teste-9'] as const
const JOBS = ['despachante-1', 'worker-pdf', 'worker-ia-1'] as const

/** O `ps` de um ambiente que o `e2e --manter-ambiente` deixou de pé: a infra, a API e os workers. */
const AMBIENTE_DO_E2E: ResultadoDoPs = { codigo: 0, saida: 'api-1\ndespachante-1\npostgres\nredis-fila\nstorage\nworker-pdf\n', erro: '' }
/** O `ps` de quem subiu só o que a integração sobe. */
const SO_A_INFRA: ResultadoDoPs = { codigo: 0, saida: 'oidc-falso\npostgres\nredis-cache\nredis-fila\nstorage\n', erro: '' }

function conferir(resultado: ResultadoDoPs): void {
  recusarJobDePe({ ps: () => resultado, servicosDeJob: JOBS, docker: DOCKER })
}

describe('jobsDePe', () => {
  it('guarda só os serviços de job, na ordem do compose, e ignora a infra e a API', () => {
    expect(jobsDePe(AMBIENTE_DO_E2E.saida, JOBS)).toEqual(['despachante-1', 'worker-pdf'])
  })

  it('não confunde serviço de nome parecido: `worker-pdf-extra` de pé não é o `worker-pdf`', () => {
    expect(jobsDePe('worker-pdf-extra\n', JOBS)).toEqual([])
  })

  it('acha o worker mesmo com fim de linha do Windows ou espaço sobrando na saída do `ps`', () => {
    expect(jobsDePe('postgres\r\nworker-pdf\r\n  despachante-1  \n', JOBS)).toEqual(['despachante-1', 'worker-pdf'])
  })
})

describe('recusarJobDePe: a integração rodada à mão com os workers de pé', () => {
  it('recusa, nomeia quem está de pé e dá o mesmo `stop` que a sequência do portão', () => {
    const recusa = (): void => conferir(AMBIENTE_DO_E2E)

    expect(recusa).toThrow('despachante-1, worker-pdf')
    expect(recusa).toThrow(derrubarJob(DOCKER, JOBS))
  })

  it('segue quando só a infra está de pé', () => {
    expect(() => conferir(SO_A_INFRA)).not.toThrow()
  })

  it('segue quando nada está de pé', () => {
    expect(() => conferir({ codigo: 0, saida: '', erro: '' })).not.toThrow()
  })

  it('não toma o `ps` que falhou por "nada de pé": para, e diz que não conseguiu listar e por quê', () => {
    const erro = 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock.\n'

    expect(() => conferir({ codigo: 1, saida: '', erro })).toThrow('Não foi possível listar')
    expect(() => conferir({ codigo: 1, saida: '', erro })).toThrow('Cannot connect to the Docker daemon')
  })
})
