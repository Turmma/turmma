import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PASTA_MIGRACOES } from './migrate.js'

/**
 * As duas migrations do orçamento de IA (camada-ia, tarefa 2.0; Tech Spec, seção 3; regra 80, item 9). O que se lê é o **comando**, sem os comentários do cabeçalho, que explicam justamente por que não há `concurrently`.
 * O comportamento delas (os checks, o `include` do índice) está em `orcamento-do-mes.repository.int.test.ts`, sobre o banco migrado.
 */
const comandos = (arquivo: string): string =>
  readFileSync(join(PASTA_MIGRACOES, arquivo), 'utf8')
    .split('\n')
    .filter((linha) => !linha.trimStart().startsWith('--') || linha.includes('--> statement-breakpoint'))
    .join('\n')

describe('as migrations do orçamento de IA', () => {
  it('a 0067 é só o índice do mês, sem `concurrently` (o `migrar` roda numa transação) e com `lock_timeout` de 5 s antes dele', () => {
    const sql = comandos('0067_indice_do_consumo_do_mes.sql')
    expect(sql).not.toMatch(/concurrently/iu)
    expect(sql).toMatch(/SET LOCAL lock_timeout = '5s'/u)
    expect(sql.indexOf('lock_timeout')).toBeLessThan(sql.indexOf('CREATE INDEX'))
    expect(sql.match(/CREATE INDEX/gu)).toHaveLength(1)
    // O `include` é o que deixa a soma ler só o índice: o drizzle não o modela, e a migration é quem o carrega.
    expect(sql).toMatch(/\("escola_id","em"\) INCLUDE \("custo_micros","tokens_de_entrada","tokens_de_saida","funcao","pelo_provedor_de_reserva","execucao_id"\)/u)
  })

  it('a 0066 só expande: nada some nem é renomeado, e nenhum índice nasce numa tabela existente (o `default` constante não reescreve `consumo_ia`)', () => {
    const sql = comandos('0066_orcamento_de_ia.sql')
    expect(sql).not.toMatch(/\bDROP\b|\bRENAME\b|\bCREATE INDEX\b/iu)
    expect(sql).toMatch(/SET LOCAL lock_timeout = '5s'/u)
    expect(sql).toMatch(/ALTER TABLE "consumo_ia" ADD COLUMN "pelo_provedor_de_reserva" boolean DEFAULT false NOT NULL/u)
  })
})
