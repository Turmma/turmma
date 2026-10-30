import { runInContext } from '@educa/nucleo'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { BancadaDeSessoes } from '../../../test/sessao-de-teste.js'
import { ContaExternaRepository, type ChaveDaContaExterna } from './conta-externa.repository.js'

/** E-mail sintético novo a cada execução: a conta é global, e o teste não quer achar a de outra execução. */
const emailSintetico = () => `professor.${randomUUID()}@repositorio.educa-sintetica.test`
const chaveGoogle = (): ChaveDaContaExterna => ({ provedor: 'google', tenant: null, sujeito: `google-sub-${randomUUID()}` })

describe('ContaExternaRepository: ligação, domínio e professor lidos só na escola do contexto', () => {
  const bancada = new BancadaDeSessoes()
  const repositorio = new ContaExternaRepository(bancada.banco)

  afterAll(async () => {
    await bancada.fechar()
  })

  const naEscola = <T>(escolaId: string, funcao: () => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)

  it('isolamento: a mesma conta Google ligada em A e em B devolve, em cada escola, o usuário dela; sem escola no contexto, recusa', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const [alunoDeA, alunoDeB] = [(await bancada.sessao(escolaA)).usuarioId, (await bancada.sessao(escolaB)).usuarioId]
    const chave = chaveGoogle()
    await naEscola(escolaA, () => repositorio.ligar(alunoDeA, chave))
    await naEscola(escolaB, () => repositorio.ligar(alunoDeB, chave))
    expect(await naEscola(escolaA, () => repositorio.ligacao(chave))).toEqual({ usuarioId: alunoDeA, contaId: null, ativo: true, suspenso: false })
    expect(await naEscola(escolaB, () => repositorio.ligacao(chave))).toEqual({ usuarioId: alunoDeB, contaId: null, ativo: true, suspenso: false })
    await expect(runInContext({ requisicaoId: randomUUID() }, () => repositorio.ligacao(chave))).rejects.toThrow('consulta com escopo sem escola no contexto')
  })

  it('isolamento: a ligação que só existe em B não é achada em A, e ligar em A com usuário de B é recusado pela FK composta', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const alunoDeB = (await bancada.sessao(escolaB)).usuarioId
    const chave = chaveGoogle()
    await naEscola(escolaB, () => repositorio.ligar(alunoDeB, chave))
    expect(await naEscola(escolaA, () => repositorio.ligacao(chave))).toBeUndefined()
    await expect(naEscola(escolaA, () => repositorio.ligar(alunoDeB, chaveGoogle()))).rejects.toMatchObject({ cause: { code: '23503' } })
  })

  it('isolamento: o domínio e o provedor liberados por B não valem em A', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const dominio = `b-${randomUUID().slice(0, 8)}.educa-sintetica.test`
    await bancada.pool.query("insert into provedor_escola (escola_id, provedor, valor) values ($1, 'google', $2)", [escolaB, dominio])
    expect(await naEscola(escolaA, () => repositorio.dominioLiberado('google', dominio))).toBe(false)
    expect(await naEscola(escolaA, () => repositorio.provedorLiberado('google'))).toBe(false)
    expect(await naEscola(escolaB, () => repositorio.dominioLiberado('google', dominio))).toBe(true)
    expect(await naEscola(escolaB, () => repositorio.provedorLiberado('google'))).toBe(true)
    expect(await naEscola(escolaB, () => repositorio.provedorLiberado('microsoft'))).toBe(false)
  })

  it('domínio retirado (removido_em) deixa de valer', async () => {
    const escola = await bancada.escola()
    const dominio = `retirado-${randomUUID().slice(0, 8)}.educa-sintetica.test`
    await bancada.pool.query("insert into provedor_escola (escola_id, provedor, valor, removido_em) values ($1, 'google', $2, now())", [escola, dominio])
    expect(await naEscola(escola, () => repositorio.dominioLiberado('google', dominio))).toBe(false)
    expect(await naEscola(escola, () => repositorio.provedorLiberado('google'))).toBe(false)
  })

  it('isolamento: o professor com o e-mail só em B não aparece em A; em B aparece, com a conta', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const email = emailSintetico()
    const professorDeB = await bancada.equipeComEmail(escolaB, email)
    expect(await naEscola(escolaA, () => repositorio.professorPeloEmail(email))).toBeUndefined()
    expect(await naEscola(escolaB, () => repositorio.professorPeloEmail(email.toUpperCase()))).toEqual({ ...professorDeB, jaLigado: false, suspenso: false })
  })

  it('isolamento: a mesma conta professora em A e em B, ligada só em B, aparece em A como não ligada', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const email = emailSintetico()
    const professorDeA = await bancada.equipeComEmail(escolaA, email)
    const professorDeB = await bancada.equipeComEmail(escolaB, email)
    await naEscola(escolaB, () => repositorio.ligar(professorDeB.usuarioId, chaveGoogle()))
    expect(await naEscola(escolaA, () => repositorio.professorPeloEmail(email))).toEqual({ ...professorDeA, jaLigado: false, suspenso: false })
    expect(await naEscola(escolaB, () => repositorio.professorPeloEmail(email))).toEqual({ ...professorDeB, jaLigado: true, suspenso: false })
  })

  it('só professor ativo: coordenador com o e-mail e professor desativado não aparecem', async () => {
    const escola = await bancada.escola()
    const email = emailSintetico()
    await bancada.equipeComEmail(escola, email, 'coordenador')
    expect(await naEscola(escola, () => repositorio.professorPeloEmail(email))).toBeUndefined()
    const professor = await bancada.equipeComEmail(escola, email)
    await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [escola, professor.usuarioId])
    expect(await naEscola(escola, () => repositorio.professorPeloEmail(email))).toBeUndefined()
  })

  it('banco: uma ligação por conta externa na escola e uma conta externa por usuário; o tenant é parte da chave na Microsoft', async () => {
    const escola = await bancada.escola()
    const [primeiro, segundo] = [(await bancada.sessao(escola)).usuarioId, (await bancada.sessao(escola)).usuarioId]
    const chave = chaveGoogle()
    expect(await naEscola(escola, () => repositorio.ligar(primeiro, chave))).toEqual(expect.any(String))
    // A mesma conta externa para outro usuário, e outra conta externa para o mesmo usuário: o banco recusa as duas.
    expect(await naEscola(escola, () => repositorio.ligar(segundo, chave))).toBeUndefined()
    expect(await naEscola(escola, () => repositorio.ligar(primeiro, chaveGoogle()))).toBeUndefined()
    // O mesmo oid em dois tenants são duas contas.
    const oid = randomUUID()
    const tenantA: ChaveDaContaExterna = { provedor: 'microsoft', tenant: randomUUID(), sujeito: oid }
    const tenantB: ChaveDaContaExterna = { provedor: 'microsoft', tenant: randomUUID(), sujeito: oid }
    expect(await naEscola(escola, () => repositorio.ligar(segundo, tenantA))).toEqual(expect.any(String))
    expect(await naEscola(escola, () => repositorio.ligacao(tenantB))).toBeUndefined()
    // Google sem tenant e Microsoft sem tenant são recusados pelo check.
    await expect(
      bancada.pool.query("insert into conta_externa (escola_id, usuario_id, provedor, tenant, sujeito) values ($1, $2, 'microsoft', null, 'x')", [escola, (await bancada.sessao(escola)).usuarioId]),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('usuário desativado: a ligação aparece, mas inativa', async () => {
    const escola = await bancada.escola()
    const aluno = (await bancada.sessao(escola)).usuarioId
    const chave = chaveGoogle()
    await naEscola(escola, () => repositorio.ligar(aluno, chave))
    await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [escola, aluno])
    expect(await naEscola(escola, () => repositorio.ligacao(chave))).toEqual({ usuarioId: aluno, contaId: null, ativo: false, suspenso: false })
  })
  it('eliminação agendada (14.0): a ligação e o professor pelo e-mail dizem `suspenso`, só da pessoa agendada e só na escola dela', async () => {
    const [escolaA, escolaB] = [await bancada.escola(), await bancada.escola()]
    const email = `suspenso-${randomUUID()}@escola.invalid`
    const professorDeA = await bancada.equipeComEmail(escolaA, email)
    const professorDeB = await bancada.equipeComEmail(escolaB, email)
    const chave = chaveGoogle()
    await naEscola(escolaA, () => repositorio.ligar(professorDeA.usuarioId, chave))
    await bancada.pool.query('update usuario set eliminacao_agendada_em = now() where id = $1', [professorDeA.usuarioId])

    expect(await naEscola(escolaA, () => repositorio.ligacao(chave))).toEqual({ usuarioId: professorDeA.usuarioId, contaId: professorDeA.contaId, ativo: true, suspenso: true })
    expect(await naEscola(escolaA, () => repositorio.professorPeloEmail(email))).toMatchObject({ usuarioId: professorDeA.usuarioId, suspenso: true })
    // O professor da mesma conta em B não está suspenso: a marca é do usuário, não da conta.
    expect(await naEscola(escolaB, () => repositorio.professorPeloEmail(email))).toMatchObject({ usuarioId: professorDeB.usuarioId, suspenso: false })
  })
})
