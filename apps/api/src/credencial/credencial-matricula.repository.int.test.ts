import { runInContext } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { SessaoFixtures } from '../../test/sessao.fixture.js'
import { CredencialMatriculaRepository } from './credencial-matricula.repository.js'

/** Hash sintético: o repository não confere senha, só devolve o que está gravado. */
const HASH_SINTETICO = '$argon2id$v=19$m=19456,t=2,p=1$c2ludGV0aWNv$c2ludGV0aWNvc2ludGV0aWNv'

describe('CredencialMatriculaRepository: a matrícula é lida só na escola do contexto', () => {
  const bancada = new SessaoFixtures()

  afterAll(async () => {
    await bancada.fechar()
  })

  const naEscola = <T>(escolaId: string, funcao: () => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)

  it('isolamento: com contexto forjado (escola A), a matrícula que só existe em B não é achada; na escola B, é', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const matricula = `RA${randomUUID().slice(0, 8)}`
    const [alunoDeB] = await bancada.alunosComMatricula(escolaB, [{ matricula, senhaHash: HASH_SINTETICO }])
    const repositorio = new CredencialMatriculaRepository(bancada.banco)
    expect(await naEscola(escolaA, () => repositorio.doAlunoAtivo(matricula))).toBeUndefined()
    expect(await naEscola(escolaB, () => repositorio.doAlunoAtivo(matricula))).toEqual({ usuarioId: alunoDeB, senhaHash: HASH_SINTETICO, provisoriaExpiraEm: null, suspenso: false })
    await expect(runInContext({ requisicaoId: randomUUID() }, () => repositorio.doAlunoAtivo(matricula))).rejects.toThrow('consulta com escopo sem escola no contexto')
  })

  it('eliminação agendada (14.0): o aluno é achado, com `suspenso`, para o login conferir a senha antes de dizer que o acesso está suspenso', async () => {
    const escola = await bancada.escola()
    const [agendado, comum] = await bancada.alunosComMatricula(escola, [
      { matricula: '3333', senhaHash: HASH_SINTETICO },
      { matricula: '4444', senhaHash: HASH_SINTETICO },
    ])
    await bancada.pool.query('update usuario set eliminacao_agendada_em = now() where escola_id = $1 and id = $2', [escola, agendado])
    const repositorio = new CredencialMatriculaRepository(bancada.banco)

    expect(await naEscola(escola, () => repositorio.doAlunoAtivo('3333'))).toEqual({ usuarioId: agendado, senhaHash: HASH_SINTETICO, provisoriaExpiraEm: null, suspenso: true })
    expect(await naEscola(escola, () => repositorio.doAlunoAtivo('4444'))).toEqual({ usuarioId: comum, senhaHash: HASH_SINTETICO, provisoriaExpiraEm: null, suspenso: false })
  })

  it('provisória (10.0): sem senha, o aluno vem com o hash e o vencimento da provisória que vale; com a provisória vencida, os dois vêm `null`', async () => {
    const escola = await bancada.escola()
    const [vigente, vencida] = await bancada.alunosComMatricula(escola, [
      { matricula: '5555', senhaHash: HASH_SINTETICO },
      { matricula: '6666', senhaHash: HASH_SINTETICO },
    ])
    const hashDaProvisoria = '$argon2id$v=19$m=19456,t=2,p=1$cHJvdmlzb3JpYQ$cHJvdmlzb3JpYXByb3Zpc29yaWE'
    // Gerar a provisória apaga a senha do aluno (`gravarProvisoria`): o estado aqui é o mesmo, com o vencimento escolhido.
    const gravar = (usuarioId: string | undefined, intervalo: string) =>
      bancada.pool.query<{ texto: string }>(
        `update credencial_matricula set senha_hash = null, provisoria_hash = $3, provisoria_expira_em = now() + $4::interval
         where escola_id = $1 and usuario_id = $2
         returning to_char(provisoria_expira_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as texto`,
        [escola, usuarioId, hashDaProvisoria, intervalo],
      )
    const { rows } = await gravar(vigente, '1 hour')
    await gravar(vencida, '-1 minute')
    const repositorio = new CredencialMatriculaRepository(bancada.banco)

    expect(await naEscola(escola, () => repositorio.doAlunoAtivo('5555'))).toEqual({ usuarioId: vigente, senhaHash: hashDaProvisoria, provisoriaExpiraEm: rows[0]?.texto, suspenso: false })
    expect(await naEscola(escola, () => repositorio.doAlunoAtivo('6666'))).toEqual({ usuarioId: vencida, senhaHash: null, provisoriaExpiraEm: null, suspenso: false })
  })

  it('borda: aluno desativado e credencial de usuário que não é aluno não são achados', async () => {
    const escola = await bancada.escola()
    const [desativado] = await bancada.alunosComMatricula(escola, [{ matricula: '1111', senhaHash: HASH_SINTETICO }])
    await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [escola, desativado])
    const professor = await bancada.sessao(escola, 'professor')
    // O banco aceita a credencial de outro papel (a FK só pede a mesma escola): o login é que não a aceita.
    await bancada.pool.query("insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, '2222', $3)", [escola, professor.usuarioId, HASH_SINTETICO])
    const repositorio = new CredencialMatriculaRepository(bancada.banco)
    expect(await naEscola(escola, () => repositorio.doAlunoAtivo('1111'))).toBeUndefined()
    expect(await naEscola(escola, () => repositorio.doAlunoAtivo('2222'))).toBeUndefined()
  })

  it('banco: a matrícula é única na escola e repetida em outra; a credencial não aponta para usuário de outra escola, e matrícula com espaço nas pontas é recusada', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    await bancada.alunosComMatricula(escolaA, [{ matricula: '1234', senhaHash: HASH_SINTETICO }])
    await expect(bancada.alunosComMatricula(escolaB, [{ matricula: '1234', senhaHash: HASH_SINTETICO }])).resolves.toHaveLength(1)
    await expect(bancada.alunosComMatricula(escolaA, [{ matricula: '1234', senhaHash: HASH_SINTETICO }])).rejects.toMatchObject({ cause: { code: '23505' } })
    const [alunoDeB] = await bancada.alunosComMatricula(escolaB, [{ matricula: '5678', senhaHash: HASH_SINTETICO }])
    await expect(
      bancada.pool.query("insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, '9999', $3)", [escolaA, alunoDeB, HASH_SINTETICO]),
    ).rejects.toMatchObject({ code: '23503' })
    const [semCredencial] = await bancada.sessoes(escolaA)
    await expect(
      bancada.pool.query("insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, ' 777', $3)", [escolaA, semCredencial?.usuarioId, HASH_SINTETICO]),
    ).rejects.toMatchObject({ code: '23514' })
  })
})
