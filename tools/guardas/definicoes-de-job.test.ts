import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core'
import { JOB_DEFINITIONS, QUEUE_NAMES, type JobDataSchema } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { jobRegistro } from '../../packages/nucleo/src/db/schema/job-registro.ts'
import { raizRepositorio } from '../ci/executar.ts'
import { ehNomePessoal } from './regras-log.mjs'

// O registro de jobs (`packages/shared/src/system/job-definitions.ts`) contra o que ele não enxerga de dentro do `shared`: o
// banco, que recusa fila e escopo por check, e o worker, que não pode ter outra lista de tipos (reengenharia, 18.0).

/** O check de `job_registro` pelo nome, como o Postgres o recebe. */
function check(nome: string): string {
  const achado = getTableConfig(jobRegistro).checks.find((candidato) => candidato.name === nome)
  if (achado === undefined) throw new Error(`job_registro não tem o check ${nome}`)
  return new PgDialect().sqlToQuery(achado.value).sql
}

/** As chaves do esquema com nome pessoal, palavra por palavra: `nomeDoAluno` é pessoal, e `pedidoId`, não. */
function chavesPessoaisDe(esquema: JobDataSchema): string[] {
  return Object.keys(esquema.shape).filter((chave) => ehNomePessoal(chave))
}

describe('o registro de jobs contra o banco', () => {
  it('toda fila de toda definição está no check `job_registro_fila_valida`, e o check não tem fila que o registro ignore', () => {
    const lidas = /fila in \((.+)\)/.exec(check('job_registro_fila_valida'))?.[1]
    const filasDoBanco = (lidas ?? '').split(',').map((fila) => fila.trim().replaceAll("'", ''))
    expect([...filasDoBanco].sort()).toEqual([...QUEUE_NAMES].sort())
    for (const [tipo, definicao] of Object.entries(JOB_DEFINITIONS)) {
      for (const fila of definicao.filas) expect(filasDoBanco, `${tipo} / ${fila}`).toContain(fila)
    }
  })

  it('o escopo é `sistema` se, e somente se, o tipo começa com o prefixo que o check `job_registro_escola_ou_sistema` aceita sem escola', () => {
    const prefixo = /^escola_id is not null or tipo like '([^%']+)%'$/.exec(check('job_registro_escola_ou_sistema'))?.[1]
    expect(prefixo).toBe('sistema.')
    for (const [tipo, definicao] of Object.entries(JOB_DEFINITIONS)) {
      expect(definicao.escopo === 'sistema', tipo).toBe(tipo.startsWith(prefixo ?? ''))
    }
  })

  it('a retentativa de todo tipo é a de hoje: cinco tentativas, recuo de 2 s e jitter de 0,5, em literal', () => {
    for (const [tipo, definicao] of Object.entries(JOB_DEFINITIONS)) {
      expect(definicao.retentativa, tipo).toEqual({ tentativas: 5, recuoMs: 2_000, jitter: 0.5 })
    }
  })
})

describe('o payload de um job é só id e parâmetro técnico (regra 20, item 9)', () => {
  it('o detector olha a chave por palavra: `nomeDoAluno` e `respostas` reprovam, e `pedidoId` e `cpuMs`, não', () => {
    const esquema = z.strictObject({ nomeDoAluno: z.string(), respostas: z.string(), pedidoId: z.uuid(), cpuMs: z.number() })
    expect(chavesPessoaisDe(esquema)).toEqual(['nomeDoAluno', 'respostas'])
  })

  it('nenhum esquema do registro tem chave de `CHAVES_PESSOAIS`', () => {
    for (const [tipo, definicao] of Object.entries(JOB_DEFINITIONS)) {
      expect(chavesPessoaisDe(definicao.dados), tipo).toEqual([])
    }
  })
})

describe('a fonte única do tipo', () => {
  it('o worker não declara constante `TIPO_*`: os 8 tipos vêm de `@educa/shared`', () => {
    const pasta = join(raizRepositorio, 'apps/worker/src')
    const arquivos = readdirSync(pasta, { recursive: true, encoding: 'utf8' }).filter((caminho) => caminho.endsWith('.ts') && !caminho.endsWith('.test.ts'))
    expect(arquivos.length).toBeGreaterThan(0)
    const declaracoes = arquivos.flatMap((arquivo) =>
      readFileSync(join(pasta, arquivo), 'utf8')
        .split('\n')
        .filter((linha) => /\bconst TIPO_[A-Z_]+\b/.test(linha))
        .map((linha) => `${arquivo}: ${linha.trim()}`),
    )
    expect(declaracoes).toEqual([])
  })
})
