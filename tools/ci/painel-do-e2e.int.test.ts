import { TIPO_EXPURGAR_ESCOLA } from '@educa/shared'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { apagarDadosDasEscolas, removerEscolaSemConvite, removerPainel, semearEscolaDoConvite, semearPainel } from '../../e2e/support/painel.ts'
import { urlDoBancoDeTeste } from './compose.ts'

/**
 * A limpeza do seed do painel do e2e (`e2e/support/painel.ts`) com o que o ambiente deixa nas escolas sintéticas: o
 * `job_registro` (rotina de escola, `escola_id` preenchido), o `expurgo_execucao` (o que o job do expurgo grava ao rodar) e o
 * `orcamento_ia_do_mes` (o retrato do mês do orçamento de IA), todos com FK para a escola e sem `on delete`. Esteira 44862658083: o
 * `afterEach` do `operacao-escolas.spec.ts` caía em `job_registro_escola_id_escola_id_fk`; depois, o `operacao-uso.spec.ts` em
 * `orcamento_ia_do_mes_escola_id_escola_id_fk`. A limpeza apaga toda tabela com FK para a escola, lida do catálogo, e o teste confere
 * contra o catálogo, para a tabela nova não quebrá-la de novo. Postgres real do compose de teste.
 */
describe('a limpeza do painel do e2e com o que o ambiente grava na escola (job, expurgo, orçamento do mês e toda tabela com FK para a escola, lida do catálogo)', () => {
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
    await apagarDadosDasEscolas(banco, [foraDoSeed.escolaId])
    await banco.query('delete from escola where id = $1', [foraDoSeed.escolaId])
    await banco.query('delete from rede where id = $1', [foraDoSeed.redeId])
    await banco.end()
  })

  /**
   * O que o ambiente grava na escola: o job do expurgo (`job_registro`), a linha da categoria que ele grava ao rodar
   * (`expurgo_execucao`) e o retrato do mês do orçamento de IA (`orcamento_ia_do_mes`).
   */
  async function trabalhoDoWorker(escolaId: string): Promise<void> {
    await banco.query("insert into job_registro (escola_id, fila, prioridade, tipo) values ($1, 'lote', 5, $2)", [escolaId, TIPO_EXPURGAR_ESCOLA])
    await banco.query("insert into expurgo_execucao (escola_id, categoria, linhas, concluida, em) values ($1, 'conversa_tutor', 0, true, now())", [escolaId])
    await banco.query("insert into orcamento_ia_do_mes (escola_id, mes, alunos_ativos, teto_percentual, origem_do_valor) values ($1, date_trunc('month', now())::date, 0, 200, 'nenhuma')", [escolaId])
  }
  const contar = async (tabela: 'escola' | 'job_registro' | 'expurgo_execucao' | 'orcamento_ia_do_mes' | 'sessao', ids: string[]): Promise<number> => {
    const coluna = tabela === 'escola' ? 'id' : 'escola_id'
    const { rows } = await banco.query<{ total: string }>(`select count(*)::text as total from ${tabela} where ${coluna} = any($1::uuid[])`, [ids])
    return Number(rows[0]?.total)
  }

  /**
   * As tabelas com FK para a escola que ainda guardam linha de alguma das escolas, lidas do catálogo do Postgres: é a conferência que
   * não depende de alguém lembrar da tabela nova.
   */
  const tabelasComLinhaDeEscola = async (ids: string[]): Promise<string[]> => {
    const { rows } = await banco.query<{ tabela: string; coluna: string }>(
      `select cl.relname as tabela, a.attname as coluna
         from pg_constraint con
         join pg_class cl on cl.oid = con.conrelid
         join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
        where con.contype = 'f' and con.confrelid = 'public.escola'::regclass and cardinality(con.conkey) = 1`,
    )
    const comLinha: string[] = []
    for (const { tabela, coluna } of rows) {
      const { rows: achadas } = await banco.query(`select 1 from "${tabela}" where "${coluna}" = any($1::uuid[]) limit 1`, [ids])
      if (achadas.length > 0) comLinha.push(tabela)
    }
    return comLinha
  }

  it('removerPainel apaga as escolas semeadas, com os jobs, as linhas de expurgo, o orçamento do mês e a sessão que o ambiente gravou nelas, e só elas', async () => {
    const painel = await semearPainel('nenhum')
    const ids = painel.escolas.map((escola) => escola.id)
    await trabalhoDoWorker(ids[0] as string)
    await trabalhoDoWorker(ids[5] as string)
    expect(await contar('job_registro', ids)).toBe(2)
    expect(await contar('expurgo_execucao', ids)).toBe(2)
    expect(await contar('orcamento_ia_do_mes', ids)).toBe(2)
    // Uma sessão de um usuário semeado: a FK dela para `usuario` não tem ação, então a limpeza só passa se a `sessao` sair antes do `usuario`.
    const { rows: usuarios } = await banco.query<{ id: string; escola_id: string }>('select id, escola_id from usuario where escola_id = any($1::uuid[]) limit 1', [ids])
    const usuario = usuarios[0]
    expect(usuario).toBeDefined()
    await banco.query(
      "insert into sessao (escola_id, usuario_id, metodo, familia, refresh_hash, expira_em) values ($1, $2, 'matricula', gen_random_uuid(), $3, now() + interval '1 day')",
      [usuario?.escola_id, usuario?.id, crypto.randomUUID()],
    )
    expect(await contar('sessao', ids)).toBe(1)

    await removerPainel(painel)

    expect(await contar('escola', ids)).toBe(0)
    expect(await contar('job_registro', ids)).toBe(0)
    expect(await contar('expurgo_execucao', ids)).toBe(0)
    expect(await contar('orcamento_ia_do_mes', ids)).toBe(0)
    expect(await contar('sessao', ids)).toBe(0)
    expect(await tabelasComLinhaDeEscola(ids)).toEqual([])
    expect(await contar('job_registro', [foraDoSeed.escolaId])).toBe(1)
    expect(await contar('expurgo_execucao', [foraDoSeed.escolaId])).toBe(1)
    expect(await contar('orcamento_ia_do_mes', [foraDoSeed.escolaId])).toBe(1)
  })

  it('removerEscolaSemConvite apaga a escola com o job, a linha de expurgo e o orçamento do mês, e nenhuma tabela com FK para ela guarda linha dela, e só ela', async () => {
    const escola = await semearEscolaDoConvite('sem_convite')
    await trabalhoDoWorker(escola.id)
    expect(await contar('job_registro', [escola.id])).toBe(1)
    expect(await contar('expurgo_execucao', [escola.id])).toBe(1)
    expect(await contar('orcamento_ia_do_mes', [escola.id])).toBe(1)

    await removerEscolaSemConvite(escola)

    expect(await contar('escola', [escola.id])).toBe(0)
    expect(await contar('job_registro', [escola.id])).toBe(0)
    expect(await contar('expurgo_execucao', [escola.id])).toBe(0)
    expect(await contar('orcamento_ia_do_mes', [escola.id])).toBe(0)
    expect(await tabelasComLinhaDeEscola([escola.id])).toEqual([])
    expect(await contar('job_registro', [foraDoSeed.escolaId])).toBe(1)
    expect(await contar('expurgo_execucao', [foraDoSeed.escolaId])).toBe(1)
    expect(await contar('orcamento_ia_do_mes', [foraDoSeed.escolaId])).toBe(1)
  })
})
