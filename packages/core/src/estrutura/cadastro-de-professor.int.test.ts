import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { ContaGlobalRepository } from '../ciclo-de-vida/conta-global.repository.js'
import { createDatabase, type Database } from '../db/database.js'
import { createPool, type DatabasePool } from '../db/pool.js'
import { contaDoProfessor } from './cadastro-de-professor.js'

/**
 * O cadastro do professor no core (onboarding-por-convite, tarefa 1.0): o `contaParaConvite` que veio do
 * `TenantResolutionRepository` responde como respondia, e o cadastro entrega só o id, sem o `nova`.
 */
describe('cadastro do professor: a conta do e-mail, achada ou criada', () => {
  let pool: DatabasePool
  let banco: Database
  const contas: string[] = []
  const cliente = new pg.Client({ connectionString: urlDoBancoDeTeste() })

  beforeAll(async () => {
    pool = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 2, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    banco = createDatabase(pool)
    await cliente.connect()
  })

  afterAll(async () => {
    if (contas.length > 0) await cliente.query('delete from conta where id = any($1::uuid[])', [contas])
    await cliente.end()
    await pool.end()
  })

  const emailNovo = () => `professor-${randomUUID()}@escola.invalid`

  async function contaCom(email: string): Promise<string> {
    const { rows } = await cliente.query<{ id: string }>('insert into conta (email) values ($1) returning id', [email])
    const id = rows[0]?.id ?? ''
    contas.push(id)
    return id
  }

  const quantasComOEmail = async (email: string) => Number((await cliente.query<{ total: string }>('select count(*) as total from conta where email = $1', [email])).rows[0]?.total)

  it('a classe acha a conta que já existe e diz que ela não é nova, sem criar outra', async () => {
    const email = emailNovo()
    const existente = await contaCom(email)
    const achada = await banco.transaction((tx) => new ContaGlobalRepository(tx).contaParaConvite(email))
    expect(achada).toEqual({ id: existente, nova: false })
    expect(await quantasComOEmail(email)).toBe(1)
  })

  it('a classe cria a conta do e-mail que não tem, sem senha, e diz que ela é nova', async () => {
    const email = emailNovo()
    const criada = await banco.transaction((tx) => new ContaGlobalRepository(tx).contaParaConvite(email))
    contas.push(criada.id)
    expect(criada.nova).toBe(true)
    const { rows } = await cliente.query<{ email: string; senha_hash: string | null }>('select email, senha_hash from conta where id = $1', [criada.id])
    expect(rows).toEqual([{ email, senha_hash: null }])
  })

  it('o cadastro devolve a conta que existe só com o id', async () => {
    const email = emailNovo()
    const existente = await contaCom(email)
    const achada = await banco.transaction((tx) => contaDoProfessor(tx, email))
    expect(achada).toStrictEqual({ id: existente })
  })

  it('o cadastro cria a conta nova e descarta o nova: nada diz que o e-mail não tinha conta', async () => {
    const email = emailNovo()
    const criada = await banco.transaction((tx) => contaDoProfessor(tx, email))
    contas.push(criada.id)
    expect(criada).toStrictEqual({ id: criada.id })
    expect(Object.keys(criada)).toEqual(['id'])
    expect(await quantasComOEmail(email)).toBe(1)
  })
})
