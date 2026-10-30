import { FORMATO_OPERADOR } from '@educa/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { FORMATO_OPERADOR as DO_SCHEMA } from './schema/auditoria.js'
import { createPool, type DatabasePool } from './pool.js'

/**
 * O formato do apelido do operador tem uma definição só, `FORMATO_OPERADOR` em `@educa/shared` (retro da A0, pendência
 * da 4.0): o contrato do `GET /v1/operacao/eu`, o `OPERADOR` dos comandos e a `AuditoriaRecorder` a leem. Os checks do
 * banco a escrevem por extenso (o drizzle-kit lê o pacote pelo `dist`); aqui se prova, no banco migrado, que cada um
 * deles tem exatamente a expressão da constante. Mudar a constante sem a migration, ou a migration sem a constante,
 * deixa este teste vermelho.
 */
const CHECKS_DO_FORMATO = ['auditoria_operacao_autor_formato', 'auditoria_operador_formato', 'operador_apelido_formato', 'retencao_escola_alterada_por_formato']

describe('FORMATO_OPERADOR: a constante e os checks do banco', () => {
  let pool: DatabasePool

  beforeAll(() => {
    pool = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 1, timeoutConexaoMs: 2_000, timeoutConsultaMs: 2_000 }, () => undefined)
  })

  afterAll(async () => {
    await pool.end()
  })

  it('o nucleo reexporta a mesma constante do shared, sem cópia', () => {
    expect(DO_SCHEMA).toBe(FORMATO_OPERADOR)
  })

  it('todo check que confere apelido ou autor de operador usa exatamente a expressão de FORMATO_OPERADOR', async () => {
    // Todo check com `~` sobre `apelido`, `autor`, `autor_operador` ou `alterada_por` (a retenção, F3), em qualquer
    // tabela: um check novo com outra expressão também aparece aqui.
    const { rows } = await pool.query<{ nome: string; definicao: string }>(
      `select conname as nome, pg_get_constraintdef(oid) as definicao from pg_constraint
        where contype = 'c' and connamespace = 'public'::regnamespace and pg_get_constraintdef(oid) ~ '\\m(apelido|autor|autor_operador|alterada_por) ~ '
        order by conname`,
    )
    expect(rows.map((linha) => linha.nome)).toEqual(CHECKS_DO_FORMATO)
    for (const { nome, definicao } of rows) {
      const expressoes = [...definicao.matchAll(/\b(?:apelido|autor|autor_operador|alterada_por) ~ '([^']*)'/g)].map((casada) => casada[1])
      expect(expressoes, nome).toEqual([FORMATO_OPERADOR.source])
    }
  })

  it('a constante aceita e recusa o que o banco aceita e recusa', async () => {
    for (const apelido of ['joaquim', 'gabriel-s', 'a1', 'Joaquim', 'j', 'joaquim paes', `a${'b'.repeat(32)}`, '1joaquim']) {
      const { rows } = await pool.query<{ casa: boolean }>(`select $1 ~ $2 as casa`, [apelido, FORMATO_OPERADOR.source])
      expect(rows[0]?.casa, apelido).toBe(FORMATO_OPERADOR.test(apelido))
    }
  })
})
