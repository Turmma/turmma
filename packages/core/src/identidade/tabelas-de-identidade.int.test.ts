import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'

/**
 * As invariantes de `ano_letivo`, `conta`, `usuario`, `sessao`, `registro_acesso` e da FK nova da `auditoria`, provadas
 * no banco, por fora do código: é o que segura um insert escrito à mão, um job ou uma migration futura.
 */
describe('tabelas de identidade: o banco recusa o que a Tech Spec proíbe', () => {
  const cliente = new pg.Client({ connectionString: urlDoBancoDeTeste() })
  const escolas: string[] = []
  const redes: string[] = []
  const contas: string[] = []

  async function sqlstate(consulta: Promise<unknown>): Promise<{ codigo: string; restricao: string | undefined }> {
    try {
      await consulta
    } catch (erro) {
      const { code, constraint } = erro as { code: string; constraint?: string }
      return { codigo: code, restricao: constraint }
    }
    throw new Error('o banco deveria ter recusado')
  }

  async function novaEscola(): Promise<string> {
    const rede = await cliente.query<{ id: string }>("insert into rede (nome, tipo) values ('Rede sintética', 'independente') returning id")
    const redeId = rede.rows[0]?.id ?? ''
    redes.push(redeId)
    const escola = await cliente.query<{ id: string }>("insert into escola (rede_id, nome, slug) values ($1, 'Escola sintética', $2) returning id", [redeId, `tabelas-${randomUUID()}`])
    const escolaId = escola.rows[0]?.id ?? ''
    escolas.push(escolaId)
    return escolaId
  }

  async function novaConta(email = `sintetico-${randomUUID()}@educa.invalid`): Promise<string> {
    const { rows } = await cliente.query<{ id: string }>('insert into conta (email) values ($1) returning id', [email])
    const contaId = rows[0]?.id ?? ''
    contas.push(contaId)
    return contaId
  }

  async function novoUsuario(escolaId: string, papel = 'aluno', contaId: string | null = null): Promise<string> {
    const { rows } = await cliente.query<{ id: string }>("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, 'Pessoa sintética') returning id", [escolaId, contaId, papel])
    return rows[0]?.id ?? ''
  }

  const novaSessao = (escolaId: string, usuarioId: string) =>
    cliente.query<{ id: string }>("insert into sessao (escola_id, usuario_id, metodo, familia, refresh_hash, expira_em) values ($1, $2, 'matricula', uuidv7(), $3, now() + interval '12 hours') returning id", [
      escolaId,
      usuarioId,
      randomUUID(),
    ])

  beforeAll(async () => {
    await cliente.connect()
  })

  afterAll(async () => {
    await cliente.query('delete from registro_acesso where escola_id = any($1::uuid[])', [escolas])
    await cliente.query('delete from sessao where escola_id = any($1::uuid[])', [escolas])
    await cliente.query('delete from auditoria where escola_id = any($1::uuid[])', [escolas])
    await cliente.query('delete from ano_letivo where escola_id = any($1::uuid[])', [escolas])
    await cliente.query('delete from usuario where escola_id = any($1::uuid[])', [escolas])
    await cliente.query('delete from conta where id = any($1::uuid[])', [contas])
    await cliente.query('delete from escola where id = any($1::uuid[])', [escolas])
    await cliente.query('delete from rede where id = any($1::uuid[])', [redes])
    await cliente.end()
  })

  it('usuario: conta nula só para aluno; professor e coordenador sem conta são recusados', async () => {
    const escolaId = await novaEscola()
    await expect(novoUsuario(escolaId, 'aluno')).resolves.toMatch(/^[0-9a-f-]{36}$/)
    for (const papel of ['professor', 'coordenador']) {
      expect(await sqlstate(novoUsuario(escolaId, papel)), papel).toEqual({ codigo: '23514', restricao: 'usuario_conta_so_falta_para_aluno' })
    }
    await expect(novoUsuario(escolaId, 'professor', await novaConta())).resolves.toMatch(/^[0-9a-f-]{36}$/)
    expect(await sqlstate(novoUsuario(escolaId, 'rede', await novaConta()))).toEqual({ codigo: '23514', restricao: 'usuario_papel_valido' })
  })

  it('usuario: a mesma conta não tem o mesmo papel duas vezes na mesma escola, mas tem em outra escola', async () => {
    const [escolaA, escolaB] = [await novaEscola(), await novaEscola()]
    const contaId = await novaConta()
    await novoUsuario(escolaA, 'professor', contaId)
    expect(await sqlstate(novoUsuario(escolaA, 'professor', contaId))).toEqual({ codigo: '23505', restricao: 'usuario_escola_conta_papel_unico' })
    await expect(novoUsuario(escolaA, 'coordenador', contaId)).resolves.toBeTruthy()
    await expect(novoUsuario(escolaB, 'professor', contaId)).resolves.toBeTruthy()
  })

  it('isolamento: sessão que aponta para usuário de outra escola é recusada pela FK composta', async () => {
    const [escolaA, escolaB] = [await novaEscola(), await novaEscola()]
    const usuarioDeA = await novoUsuario(escolaA)
    await expect(novaSessao(escolaA, usuarioDeA)).resolves.toBeTruthy()
    expect(await sqlstate(novaSessao(escolaB, usuarioDeA))).toEqual({ codigo: '23503', restricao: 'sessao_usuario_da_escola_fk' })
  })

  it('isolamento: auditoria com autor usuário de outra escola é recusada pela FK composta', async () => {
    const [escolaA, escolaB] = [await novaEscola(), await novaEscola()]
    const usuarioDeA = await novoUsuario(escolaA)
    const inserir = (escolaId: string) =>
      cliente.query("insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id) values ($1, $2, 'teste.fk', 'escola', $1, $3)", [escolaId, usuarioDeA, randomUUID()])
    await expect(inserir(escolaA)).resolves.toBeTruthy()
    expect(await sqlstate(inserir(escolaB))).toEqual({ codigo: '23503', restricao: 'auditoria_autor_da_escola_fk' })
  })

  it('sessao: fillfactor 70, índice no hash anterior, e nenhum índice que contenha ultimo_uso_em', async () => {
    const { rows: opcoes } = await cliente.query<{ reloptions: string[] | null }>("select reloptions from pg_class where relname = 'sessao'")
    expect(opcoes[0]?.reloptions).toEqual(['fillfactor=70'])
    const { rows: indices } = await cliente.query<{ indexdef: string }>("select indexdef from pg_indexes where tablename = 'sessao'")
    const definicoes = indices.map((indice) => indice.indexdef)
    expect(definicoes.some((definicao) => /\(refresh_hash_anterior\)/.test(definicao))).toBe(true)
    expect(definicoes.some((definicao) => /UNIQUE.*\(refresh_hash\)/.test(definicao))).toBe(true)
    expect(definicoes.filter((definicao) => definicao.includes('ultimo_uso_em'))).toEqual([])
  })

  it('conta: e-mail único sem diferença de caixa', async () => {
    const email = `Sintetico-${randomUUID()}@Educa.invalid`
    await novaConta(email)
    expect(await sqlstate(novaConta(email.toLowerCase()))).toEqual({ codigo: '23505', restricao: 'conta_email_unico' })
  })

  it('registro_acesso: escola nula só na falha de login sem usuário', async () => {
    const escolaId = await novaEscola()
    const inserir = (escola: string | null, usuarioId: string | null, evento: string) =>
      cliente.query("insert into registro_acesso (escola_id, usuario_id, evento, ip) values ($1, $2, $3, '198.51.100.7')", [escola, usuarioId, evento])
    await expect(inserir(null, null, 'login_falho')).resolves.toBeTruthy()
    await expect(inserir(escolaId, randomUUID(), 'login')).resolves.toBeTruthy()
    for (const [usuarioId, evento] of [[null, 'login'], [randomUUID(), 'login_falho'], [null, 'renovacao']] as const) {
      expect(await sqlstate(inserir(null, usuarioId, evento)), `${evento} ${String(usuarioId)}`).toEqual({ codigo: '23514', restricao: 'registro_acesso_escola_so_falta_na_falha_sem_usuario' })
    }
    await cliente.query('delete from registro_acesso where escola_id is null and usuario_id is null and ip = $1', ['198.51.100.7'])
  })

  it('ano_letivo: um só em curso por escola; outra escola tem o seu', async () => {
    const [escolaA, escolaB] = [await novaEscola(), await novaEscola()]
    const inserir = (escolaId: string, ano: number, situacao: string) =>
      cliente.query("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, $2::smallint, make_date($2::int, 2, 1), make_date($2::int, 12, 15), $3)", [escolaId, ano, situacao])
    await inserir(escolaA, 2026, 'em_curso')
    await inserir(escolaA, 2025, 'encerrado')
    await inserir(escolaA, 2027, 'planejado')
    expect(await sqlstate(inserir(escolaA, 2028, 'em_curso'))).toEqual({ codigo: '23505', restricao: 'ano_letivo_um_em_curso_por_escola' })
    await expect(inserir(escolaB, 2026, 'em_curso')).resolves.toBeTruthy()
    expect(await sqlstate(inserir(escolaB, 2029, 'ativo'))).toEqual({ codigo: '23514', restricao: 'ano_letivo_situacao_valida' })
  })
})
