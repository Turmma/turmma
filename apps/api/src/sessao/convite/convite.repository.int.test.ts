import { DomainException, runInContext } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { createHash, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SessaoFixtures } from '../../../test/sessao.fixture.js'
import { ConviteRepository } from './convite.repository.js'

interface EstadoDoConvite {
  /** Há quanto tempo o usuário ficou inativo, em segundos. */
  inativoHaS?: number
  /** Há quanto tempo o convite foi aceito, em segundos; `null` quando não foi. */
  aceitoHaS?: number | null
  revogado?: boolean
}

describe('ConviteRepository: o convite e o usuário convidado só na escola do contexto', () => {
  const bancada = new SessaoFixtures()
  let escolaA: string
  let escolaB: string

  beforeAll(async () => {
    escolaA = await bancada.escola()
    escolaB = await bancada.escola()
    await bancada.pool.query("update escola set nome = 'Colégio A sintético' where id = $1", [escolaA])
    await bancada.pool.query("update escola set nome = 'Colégio B sintético' where id = $1", [escolaB])
  })

  afterAll(async () => {
    await bancada.fechar()
  })

  const naEscola = <T>(escolaId: string, funcao: (repositorio: ConviteRepository) => Promise<T>) =>
    runInContext({ requisicaoId: randomUUID(), escolaId }, () => funcao(new ConviteRepository(bancada.banco)))

  /** Um coordenador inativo em A com um convite no estado pedido. Por padrão: inativo há 60 s e aceito há 10 s. */
  async function convidado({ inativoHaS = 60, aceitoHaS = 10, revogado = false }: EstadoDoConvite = {}): Promise<{ usuarioId: string; conviteId: string; contaId: string }> {
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`convidada-${randomUUID()}@escola.invalid`])
    const contaId = contas[0]?.id ?? ''
    const { rows: usuarios } = await bancada.pool.query<{ id: string }>(
      "insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'coordenador', 'Pessoa sintética', now() - make_interval(secs => $3)) returning id",
      [escolaA, contaId, inativoHaS],
    )
    const usuarioId = usuarios[0]?.id ?? ''
    const { rows: convites } = await bancada.pool.query<{ id: string }>(
      `insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, usado_em, revogado_em)
       values ($1, $2, 'coordenador', $3, now() + interval '72 hours', case when $4::int is null then null else now() - make_interval(secs => $4::int) end, case when $5 then now() end)
       returning id`,
      [escolaA, createHash('sha256').update(randomUUID()).digest('hex'), usuarioId, aceitoHaS, revogado],
    )
    return { usuarioId, conviteId: convites[0]?.id ?? '', contaId }
  }

  async function ativo(usuarioId: string): Promise<boolean> {
    const { rows } = await bancada.pool.query<{ ativo: boolean }>('select desativado_em is null as ativo from usuario where id = $1', [usuarioId])
    return rows[0]?.ativo ?? false
  }

  it('isolamento: no contexto de B, o usuário e o convite de A não são ativados nem revogados, e o nome é o de B', async () => {
    const alvo = await convidado()
    expect(await naEscola(escolaB, (repositorio) => repositorio.ativarPorConvite(alvo.usuarioId, alvo.conviteId))).toBe(false)
    expect(await ativo(alvo.usuarioId)).toBe(false)
    expect(await naEscola(escolaB, (repositorio) => repositorio.revogar(alvo.conviteId, 'coordenador'))).toBe(false)
    expect(await naEscola(escolaB, (repositorio) => repositorio.revogado(alvo.conviteId))).toBeUndefined()
    const { rows } = await bancada.pool.query<{ revogado: boolean }>('select revogado_em is not null as revogado from convite where id = $1', [alvo.conviteId])
    expect(rows).toEqual([{ revogado: false }])
    expect(await naEscola(escolaB, (repositorio) => repositorio.nomeDaEscola())).toBe('Colégio B sintético')
    expect(await naEscola(escolaA, (repositorio) => repositorio.nomeDaEscola())).toBe('Colégio A sintético')

    // Na escola dele, ativa uma vez só.
    expect(await naEscola(escolaA, (repositorio) => repositorio.ativarPorConvite(alvo.usuarioId, alvo.conviteId))).toBe(true)
    expect(await ativo(alvo.usuarioId)).toBe(true)
    expect(await naEscola(escolaA, (repositorio) => repositorio.ativarPorConvite(alvo.usuarioId, alvo.conviteId))).toBe(false)
  })

  it.each<[string, EstadoDoConvite]>([
    ['convite não aceito', { aceitoHaS: null }],
    ['convite revogado', { revogado: true }],
    ['aceito antes de o usuário ficar inativo (desativado depois de entrar)', { inativoHaS: 10, aceitoHaS: 60 }],
  ])('borda: %s não ativa', async (_caso, estado) => {
    const alvo = await convidado(estado)
    expect(await naEscola(escolaA, (repositorio) => repositorio.ativarPorConvite(alvo.usuarioId, alvo.conviteId))).toBe(false)
    expect(await ativo(alvo.usuarioId)).toBe(false)
  })

  it('borda: o convite de outro usuário da mesma escola não ativa este', async () => {
    const alvo = await convidado({ aceitoHaS: null })
    const outro = await convidado()
    expect(await naEscola(escolaA, (repositorio) => repositorio.ativarPorConvite(alvo.usuarioId, outro.conviteId))).toBe(false)
    expect(await ativo(alvo.usuarioId)).toBe(false)
  })

  it('concorrência: duas ativações ao mesmo tempo ativam uma vez', async () => {
    const alvo = await convidado()
    const resultados = await Promise.all([1, 2].map(() => naEscola(escolaA, (repositorio) => repositorio.ativarPorConvite(alvo.usuarioId, alvo.conviteId))))
    expect(resultados.sort()).toEqual([false, true])
  })

  it('o coordenador convidado nasce inativo; o que já está ativo não é convidado de novo; o inativo volta a esperar', async () => {
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`convidada-${randomUUID()}@escola.invalid`])
    const contaId = contas[0]?.id ?? ''
    const usuarioId = await naEscola(escolaA, (repositorio) => repositorio.usuarioConvidado(contaId, 'Pessoa sintética', 'coordenador'))
    expect(usuarioId).toEqual(expect.any(String))
    expect(await ativo(usuarioId ?? '')).toBe(false)
    await bancada.pool.query('update usuario set desativado_em = null where id = $1', [usuarioId])
    // Ativo: nada muda, nem o nome.
    expect(await naEscola(escolaA, (repositorio) => repositorio.usuarioConvidado(contaId, 'Pessoa sintética Outra', 'coordenador'))).toBeUndefined()
    expect(await ativo(usuarioId ?? '')).toBe(true)
    expect((await bancada.pool.query('select nome from usuario where id = $1', [usuarioId])).rows).toEqual([{ nome: 'Pessoa sintética' }])
    await bancada.pool.query("update usuario set desativado_em = now() - interval '1 day' where id = $1", [usuarioId])
    // Inativo: volta a esperar, com o nome digitado agora.
    expect(await naEscola(escolaA, (repositorio) => repositorio.usuarioConvidado(contaId, 'Pessoa sintética Corrigida', 'coordenador'))).toBe(usuarioId)
    const { rows } = await bancada.pool.query<{ recente: boolean; nome: string }>("select desativado_em > now() - interval '1 minute' as recente, nome from usuario where id = $1", [usuarioId])
    expect(rows).toEqual([{ recente: true, nome: 'Pessoa sintética Corrigida' }])
  })

  it('isolamento (A0b, 2.3): o estado da coordenação só enxerga a escola do contexto; o último convite é o de maior expira_em, depois o de maior id', async () => {
    const [escolaC, escolaD] = [await bancada.escola(), await bancada.escola()]
    const coordenadorEm = async (escolaId: string, desativado: boolean) => {
      const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`convidada-${randomUUID()}@escola.invalid`])
      const { rows } = await bancada.pool.query<{ id: string }>(
        "insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'coordenador', 'Pessoa sintética', case when $3 then now() end) returning id",
        [escolaId, contas[0]?.id, desativado],
      )
      return rows[0]?.id ?? ''
    }
    const conviteEm = async (escolaId: string, usuarioId: string, expiraEm: string, id: string) => {
      await bancada.pool.query("insert into convite (id, escola_id, token_hash, tipo, usuario_id, expira_em) values ($1, $2, $3, 'coordenador', $4, $5)", [
        id,
        escolaId,
        createHash('sha256').update(randomUUID()).digest('hex'),
        usuarioId,
        expiraEm,
      ])
    }
    // Em C: três convites de três usuários inativos; o de maior expira_em empata com outro, e o de maior id vence.
    const prefixo = randomUUID().slice(0, 8)
    const [menor, meio, maior] = [1, 2, 3].map((n) => `${prefixo}-0000-7000-8000-00000000000${n}`)
    const daqui3Dias = new Date(Date.now() + 72 * 60 * 60 * 1_000).toISOString()
    await conviteEm(escolaC, await coordenadorEm(escolaC, true), daqui3Dias, maior ?? '')
    await conviteEm(escolaC, await coordenadorEm(escolaC, true), daqui3Dias, menor ?? '')
    await conviteEm(escolaC, await coordenadorEm(escolaC, true), new Date(Date.now() + 60 * 60 * 1_000).toISOString(), meio ?? '')

    const deC = await naEscola(escolaC, (repositorio) => repositorio.dadosDaCoordenacao())
    expect(deC).toMatchObject({ coordenadorAtivo: false, ultimoConvite: { id: maior, usadoEm: null, revogadoEm: null, usuarioDesativadoEm: expect.any(Date) }, agora: expect.any(Date) })
    // D não vê nada de C: sem a escola nas duas consultas, veria o convite e o coordenador ativo de C.
    await coordenadorEm(escolaC, false)
    expect((await naEscola(escolaC, (repositorio) => repositorio.dadosDaCoordenacao()))?.coordenadorAtivo).toBe(true)
    expect(await naEscola(escolaD, (repositorio) => repositorio.dadosDaCoordenacao())).toMatchObject({ coordenadorAtivo: false, ultimoConvite: undefined })
    expect(await naEscola(escolaD, (repositorio) => repositorio.revogado(maior ?? ''))).toBeUndefined()
    expect(await naEscola(escolaC, (repositorio) => repositorio.revogado(maior ?? ''))).toBe(false)
    // Escola que não existe: nada, nem a hora.
    expect(await naEscola(randomUUID(), (repositorio) => repositorio.dadosDaCoordenacao())).toBeUndefined()
  })

  it('convite_pendente_unico (A0b, 2.2): sem a trava, o segundo convite em aberto do mesmo usuário é CONFLITO; usado ou revogado o anterior, ou outro usuário, passa', async () => {
    const escolaE = await bancada.escola()
    const coordenadorEm = async () => {
      const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`convidada-${randomUUID()}@escola.invalid`])
      const { rows } = await bancada.pool.query<{ id: string }>(
        "insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'coordenador', 'Pessoa sintética', now()) returning id",
        [escolaE, contas[0]?.id],
      )
      return rows[0]?.id ?? ''
    }
    const criar = (usuarioId: string) =>
      naEscola(escolaE, (repositorio) =>
        repositorio.criarConvite({ tipo: 'coordenador', tokenHash: createHash('sha256').update(randomUUID()).digest('hex'), usuarioId, expiraEm: new Date(Date.now() + 72 * 60 * 60 * 1_000) }),
      )
    const convitesDe = async (usuarioId: string) => (await bancada.pool.query<{ id: string }>('select id from convite where usuario_id = $1 order by id', [usuarioId])).rows.map((linha) => linha.id)

    const usuarioId = await coordenadorEm()
    const primeiro = await criar(usuarioId)
    // O erro do índice sai tipado, e não como o erro cru do Postgres (que traria o valor da linha no `detail`).
    const recusa = await criar(usuarioId).catch((erro: unknown) => erro)
    expect(recusa).toBeInstanceOf(DomainException)
    expect(recusa).toMatchObject({ codigo: ErrorCode.CONFLITO })
    expect(await convitesDe(usuarioId)).toEqual([primeiro])

    // Outro usuário na mesma escola não é bloqueado: a chave é (escola_id, usuario_id).
    const outro = await coordenadorEm()
    expect(await convitesDe(outro)).toEqual([])
    const doOutro = await criar(outro)
    expect(await convitesDe(outro)).toEqual([doOutro])

    // Usado o anterior, o mesmo usuário recebe outro; revogado esse, recebe mais um: só o em aberto conta.
    await bancada.pool.query('update convite set usado_em = now() where id = $1', [primeiro])
    const segundo = await criar(usuarioId)
    await bancada.pool.query('update convite set revogado_em = now() where id = $1', [segundo])
    const terceiro = await criar(usuarioId)
    expect(await convitesDe(usuarioId)).toEqual([primeiro, segundo, terceiro].sort())
  })

  it('revogarParaRefazer (A0b, 3.0): só o convite em aberto (pendente ou vencido) da escola do contexto, uma vez; no contexto de B, o de A fica como está', async () => {
    const revogadoEm = async (conviteId: string) => (await bancada.pool.query<{ revogado: boolean }>('select revogado_em is not null as revogado from convite where id = $1', [conviteId])).rows[0]?.revogado
    const pendente = await convidado({ aceitoHaS: null })
    // Em B, o convite de A não é achado: sem a escola no `where`, seria revogado e o usuário de A voltaria.
    expect(await naEscola(escolaB, (repositorio) => repositorio.revogarParaRefazer(pendente.conviteId, 'coordenador'))).toBeUndefined()
    expect(await revogadoEm(pendente.conviteId)).toBe(false)
    expect(await naEscola(escolaA, (repositorio) => repositorio.revogarParaRefazer(pendente.conviteId, 'coordenador'))).toBe(pendente.usuarioId)
    expect(await revogadoEm(pendente.conviteId)).toBe(true)
    // Já revogado: não revoga de novo, e não devolve usuário para outro convite.
    expect(await naEscola(escolaA, (repositorio) => repositorio.revogarParaRefazer(pendente.conviteId, 'coordenador'))).toBeUndefined()

    const vencido = await convidado({ aceitoHaS: null })
    await bancada.pool.query("update convite set expira_em = now() - interval '1 hour' where id = $1", [vencido.conviteId])
    expect(await naEscola(escolaA, (repositorio) => repositorio.revogarParaRefazer(vencido.conviteId, 'coordenador'))).toBe(vencido.usuarioId)
    expect(await revogadoEm(vencido.conviteId)).toBe(true)

    // Usado (aceito): não é mais refeito, e continua sem revogação.
    const usado = await convidado({ aceitoHaS: 10 })
    expect(await naEscola(escolaA, (repositorio) => repositorio.revogarParaRefazer(usado.conviteId, 'coordenador'))).toBeUndefined()
    expect(await revogadoEm(usado.conviteId)).toBe(false)
  })

  it('I7 (camada do repository): revogarParaRefazer e revogar só alcançam o convite do tipo pedido; o de professor, pelo tipo coordenador, fica em aberto, e vice-versa', async () => {
    const revogadoEm = async (conviteId: string) => (await bancada.pool.query<{ revogado: boolean }>('select revogado_em is not null as revogado from convite where id = $1', [conviteId])).rows[0]?.revogado
    const deProfessor = await convidado({ aceitoHaS: null })
    // A 0018 afrouxou o check: o convite passa a ser de professor direto no banco.
    await bancada.pool.query("update convite set tipo = 'professor' where id = $1", [deProfessor.conviteId])
    expect(await naEscola(escolaA, (repositorio) => repositorio.revogarParaRefazer(deProfessor.conviteId, 'coordenador'))).toBeUndefined()
    expect(await naEscola(escolaA, (repositorio) => repositorio.revogar(deProfessor.conviteId, 'coordenador'))).toBe(false)
    expect(await revogadoEm(deProfessor.conviteId)).toBe(false)

    const deCoordenador = await convidado({ aceitoHaS: null })
    expect(await naEscola(escolaA, (repositorio) => repositorio.revogarParaRefazer(deCoordenador.conviteId, 'professor'))).toBeUndefined()
    expect(await naEscola(escolaA, (repositorio) => repositorio.revogar(deCoordenador.conviteId, 'professor'))).toBe(false)
    expect(await revogadoEm(deCoordenador.conviteId)).toBe(false)

    // Com o tipo certo, cada um revoga o seu.
    expect(await naEscola(escolaA, (repositorio) => repositorio.revogarParaRefazer(deProfessor.conviteId, 'professor'))).toBe(deProfessor.usuarioId)
    expect(await naEscola(escolaA, (repositorio) => repositorio.revogar(deCoordenador.conviteId, 'coordenador'))).toBe(true)
    expect([await revogadoEm(deProfessor.conviteId), await revogadoEm(deCoordenador.conviteId)]).toEqual([true, true])
  })

  it('sem escola no contexto, falha fechada', async () => {
    const alvo = await convidado()
    await expect(runInContext({ requisicaoId: randomUUID() }, () => new ConviteRepository(bancada.banco).ativarPorConvite(alvo.usuarioId, alvo.conviteId))).rejects.toThrow(
      'consulta com escopo sem escola no contexto',
    )
  })
})
