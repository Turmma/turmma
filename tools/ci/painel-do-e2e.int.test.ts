import { TIPO_EXPURGAR_ESCOLA } from '@educa/shared'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { removerEscolaSemConvite, removerPainel, semearEscolaDoConvite, semearPainel } from '../../e2e/support/painel.ts'
import { urlDoBancoDeTeste } from './compose.ts'

/**
 * A limpeza do seed do painel do e2e (`e2e/support/painel.ts`) com o que o worker do ambiente deixa nas escolas sintéticas: o
 * `job_registro` (rotina de escola, `escola_id` preenchido) e o `expurgo_execucao` (o que o job do expurgo grava ao rodar), os dois
 * com FK para a escola e sem `on delete`. Esteira 44862658083: o `afterEach` do `operacao-escolas.spec.ts` caía em
 * `job_registro_escola_id_escola_id_fk`. Postgres real do compose de teste.
 */
describe('a limpeza do painel do e2e com o que o worker grava na escola', () => {
  let banco: Client
  /** A escola de fora do seed, com o job e a linha de expurgo que a limpeza não pode tocar; sai no `afterAll`. */
  let foraDoSeed: { escolaId: string; redeId: string }

  beforeAll(async () => {
    banco = new Client({ connectionString: urlDoBancoDeTeste() })
    await banco.connect()
    const marca = crypto.randomUUID().replaceAll('-', '')
    const rede = await banco.query<{ id: string }>("insert into rede (nome, tipo) values ($1, 'grupo') returning id", [`Rede sintética da limpeza ${marca}`])
    const redeId = rede.rows[0]?.id as string
    const escola = await banco.query<{ id: string }>('insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id', [redeId, `Escola sintética da limpeza ${marca}`, `limpeza-${marca}`])
    foraDoSeed = { escolaId: escola.rows[0]?.id as string, redeId }
    await trabalhoDoWorker(foraDoSeed.escolaId)
  })

  afterAll(async () => {
    await banco.query('delete from expurgo_execucao where escola_id = $1', [foraDoSeed.escolaId])
    await banco.query('delete from job_registro where escola_id = $1', [foraDoSeed.escolaId])
    await banco.query('delete from escola where id = $1', [foraDoSeed.escolaId])
    await banco.query('delete from rede where id = $1', [foraDoSeed.redeId])
    await banco.end()
  })

  /** O que o worker grava na escola: o job do expurgo (`job_registro`) e, ao rodá-lo, a linha da categoria (`expurgo_execucao`). */
  async function trabalhoDoWorker(escolaId: string): Promise<void> {
    await banco.query("insert into job_registro (escola_id, fila, prioridade, tipo) values ($1, 'lote', 5, $2)", [escolaId, TIPO_EXPURGAR_ESCOLA])
    await banco.query("insert into expurgo_execucao (escola_id, categoria, linhas, concluida, em) values ($1, 'conversa_tutor', 0, true, now())", [escolaId])
  }
  const contar = async (tabela: 'escola' | 'job_registro' | 'expurgo_execucao', ids: string[]): Promise<number> => {
    const coluna = tabela === 'escola' ? 'id' : 'escola_id'
    const { rows } = await banco.query<{ total: string }>(`select count(*)::text as total from ${tabela} where ${coluna} = any($1::uuid[])`, [ids])
    return Number(rows[0]?.total)
  }

  it('removerPainel apaga as escolas semeadas, com os jobs e as linhas de expurgo que o worker gravou nelas, e só elas', async () => {
    const painel = await semearPainel('nenhum')
    const ids = painel.escolas.map((escola) => escola.id)
    await trabalhoDoWorker(ids[0] as string)
    await trabalhoDoWorker(ids[5] as string)
    expect(await contar('job_registro', ids)).toBe(2)
    expect(await contar('expurgo_execucao', ids)).toBe(2)

    await removerPainel(painel)

    expect(await contar('escola', ids)).toBe(0)
    expect(await contar('job_registro', ids)).toBe(0)
    expect(await contar('expurgo_execucao', ids)).toBe(0)
    expect(await contar('job_registro', [foraDoSeed.escolaId])).toBe(1)
    expect(await contar('expurgo_execucao', [foraDoSeed.escolaId])).toBe(1)
  })

  it('removerEscolaSemConvite apaga a escola com o job e a linha de expurgo do worker, e só ela', async () => {
    const escola = await semearEscolaDoConvite('sem_convite')
    await trabalhoDoWorker(escola.id)
    expect(await contar('job_registro', [escola.id])).toBe(1)
    expect(await contar('expurgo_execucao', [escola.id])).toBe(1)

    await removerEscolaSemConvite(escola)

    expect(await contar('escola', [escola.id])).toBe(0)
    expect(await contar('job_registro', [escola.id])).toBe(0)
    expect(await contar('expurgo_execucao', [escola.id])).toBe(0)
    expect(await contar('job_registro', [foraDoSeed.escolaId])).toBe(1)
    expect(await contar('expurgo_execucao', [foraDoSeed.escolaId])).toBe(1)
  })
})
