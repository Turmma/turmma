import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { runInContext } from '../context/context.js'
import { createDatabase, type Database } from '../db/database.js'
import { createPool, type DatabasePool } from '../db/pool.js'
import { AuditoriaRepository } from './auditoria.repository.js'
import { AuditoriaRejectedError } from './auditoria-rejected.error.js'
import { AuditoriaRecorder, type DadosDaAuditoria } from './auditoria-recorder.js'

const registro = new AuditoriaRecorder()

describe('auditoria no banco', () => {
  let pool: DatabasePool
  let banco: Database
  let redeId: string
  let escolaA: string
  let escolaB: string
  const sufixo = randomUUID().slice(0, 8)
  /** Os suboperadores que o teste audita sem escola: a limpeza os apaga pelo id. */
  const suboperadoresAuditados: string[] = []

  const criarEscola = async (slug: string): Promise<string> => {
    const { rows } = await pool.query<{ id: string }>(`insert into escola (rede_id, nome, slug) values ($1, 'Escola Sintética', $2) returning id`, [redeId, slug])
    const id = rows[0]?.id
    if (id === undefined) throw new Error('escola não criada')
    return id
  }

  const gravarComoOperador = (escolaId: string, entidadeId: string) =>
    runInContext({ requisicaoId: randomUUID(), escolaId }, () =>
      banco.transaction((tx) => registro.gravar(tx, 'escola.criada', { entidadeId, depois: { redeId }, autorOperador: 'operador-teste' })),
    )

  beforeAll(async () => {
    pool = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 2, timeoutConexaoMs: 2_000, timeoutConsultaMs: 2_000 }, () => undefined)
    banco = createDatabase(pool)
    const { rows } = await pool.query<{ id: string }>(`insert into rede (nome, tipo) values ('Rede Sintética', 'grupo') returning id`)
    redeId = rows[0]?.id ?? ''
    escolaA = await criarEscola(`auditoria-a-${sufixo}`)
    escolaB = await criarEscola(`auditoria-b-${sufixo}`)
  })

  afterAll(async () => {
    await pool.query('delete from auditoria where escola_id = any($1::uuid[]) or entidade_id = any($2::uuid[])', [[escolaA, escolaB], [redeId, ...suboperadoresAuditados]])
    await pool.query('delete from usuario where escola_id = any($1::uuid[])', [[escolaA, escolaB]])
    await pool.query('delete from escola where id = any($1::uuid[])', [[escolaA, escolaB]])
    await pool.query('delete from rede where id = $1', [redeId])
    await pool.end()
  })

  it('isolamento: com auditoria em A e em B, listarDaEscola no contexto de A não traz linha de B', async () => {
    await gravarComoOperador(escolaA, escolaA)
    await gravarComoOperador(escolaB, escolaB)
    const repositorio = new AuditoriaRepository(banco)

    const deA = await runInContext({ requisicaoId: randomUUID(), escolaId: escolaA }, () => repositorio.listarDaEscola())
    expect(deA.length).toBeGreaterThan(0)
    expect(deA.every((registro) => registro.escolaId === escolaA)).toBe(true)
    expect(deA.map((registro) => registro.entidadeId)).not.toContain(escolaB)

    const deB = await runInContext({ requisicaoId: randomUUID(), escolaId: escolaB }, () => repositorio.listarDaEscola())
    expect(deB.map((registro) => registro.entidadeId)).toEqual([escolaB])
  })

  it('listarDaEscola sem escola no contexto falha fechado, em vez de listar tudo', async () => {
    const repositorio = new AuditoriaRepository(banco)
    await expect(runInContext({ requisicaoId: randomUUID() }, () => repositorio.listarDaEscola())).rejects.toEqual(new AuditoriaRejectedError('sem_escola'))
  })

  it('a gravação vai com a transação de quem chama: a transação desfeita não deixa registro', async () => {
    const entidadeId = randomUUID()
    const requisicaoId = randomUUID()
    await expect(
      runInContext({ requisicaoId, escolaId: escolaA }, () =>
        banco.transaction(async (tx) => {
          await registro.gravar(tx, 'escola.criada', { entidadeId, depois: { redeId }, autorOperador: 'operador-teste' })
          throw new Error('a ação auditada falhou depois do registro')
        }),
      ),
    ).rejects.toThrow('a ação auditada falhou')
    const { rows } = await pool.query('select 1 from auditoria where entidade_id = $1', [entidadeId])
    expect(rows).toHaveLength(0)
  })

  it('grava escola e requisição do contexto, e o usuário do contexto como autor, sem operador', async () => {
    // O autor é um usuário da escola: a FK composta (escola_id, autor_usuario_id) recusa id solto ou de outra escola.
    const { rows: usuarios } = await pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', 'Pessoa sintética') returning id", [escolaA])
    const usuarioId = usuarios[0]?.id ?? ''
    const requisicaoId = randomUUID()
    const entidadeId = randomUUID()
    await runInContext({ requisicaoId, escolaId: escolaA, usuarioId }, () =>
      registro.gravar(banco, 'escola.criada', { entidadeId, depois: { redeId } }),
    )
    const { rows } = await pool.query('select escola_id, autor_usuario_id, autor_operador, acao, entidade, antes, depois, finalidade, requisicao_id from auditoria where entidade_id = $1', [
      entidadeId,
    ])
    expect(rows).toEqual([
      {
        escola_id: escolaA,
        autor_usuario_id: usuarioId,
        autor_operador: null,
        acao: 'escola.criada',
        entidade: 'escola',
        antes: null,
        depois: { redeId },
        finalidade: null,
        requisicao_id: requisicaoId,
      },
    ])
  })

  it('a rede criada pelo operador é o único registro sem escola', async () => {
    await runInContext({ requisicaoId: randomUUID() }, () =>
      registro.gravar(banco, 'rede.criada', { entidadeId: redeId, depois: { tipo: 'grupo' }, autorOperador: 'operador-teste' }),
    )
    const { rows } = await pool.query('select escola_id, autor_operador, entidade from auditoria where entidade_id = $1', [redeId])
    expect(rows).toEqual([{ escola_id: null, autor_operador: 'operador-teste', entidade: 'rede' }])
    // A mesma ação com um usuário no contexto, e sem escola, é recusada antes do banco.
    await expect(
      runInContext({ requisicaoId: randomUUID(), usuarioId: randomUUID() }, () =>
        registro.gravar(banco, 'rede.criada', { entidadeId: redeId, depois: { tipo: 'grupo' } }),
      ),
    ).rejects.toEqual(new AuditoriaRejectedError('sem_escola'))
  })

  it('o suboperador cadastrado ou encerrado pelo operador também grava sem escola (F3, 8.0); com usuário no contexto, ou outra entidade, é recusado', async () => {
    const suboperadorId = randomUUID()
    suboperadoresAuditados.push(suboperadorId)
    const finalidade = 'informar_o_compartilhamento'
    await runInContext({ requisicaoId: randomUUID() }, () =>
      banco.transaction(async (tx) => {
        await registro.gravar(tx, 'suboperador.cadastrado', { entidadeId: suboperadorId, depois: { alcance: 'todas', escolas: 0 }, finalidade, autorOperador: 'operador-teste' })
        await registro.gravar(tx, 'suboperador.encerrado', { entidadeId: suboperadorId, antes: { alcance: 'todas' }, depois: { ligacoesEncerradas: 0 }, finalidade, autorOperador: 'operador-teste' })
      }),
    )
    const { rows } = await pool.query('select escola_id, autor_operador, acao, entidade from auditoria where entidade_id = $1 order by em, acao', [suboperadorId])
    expect(rows).toEqual([
      { escola_id: null, autor_operador: 'operador-teste', acao: 'suboperador.cadastrado', entidade: 'suboperador' },
      { escola_id: null, autor_operador: 'operador-teste', acao: 'suboperador.encerrado', entidade: 'suboperador' },
    ])
    await expect(
      runInContext({ requisicaoId: randomUUID(), usuarioId: randomUUID() }, () =>
        registro.gravar(banco, 'suboperador.cadastrado', { entidadeId: suboperadorId, depois: { alcance: 'todas', escolas: 0 }, finalidade }),
      ),
    ).rejects.toEqual(new AuditoriaRejectedError('sem_escola'))
    // Texto livre não entra: nem a chave da empresa, nem o nome dela.
    const comNome = { entidadeId: suboperadorId, depois: { alcance: 'todas', escolas: 0, nome: 'Empresa' }, finalidade, autorOperador: 'operador-teste' } as unknown as DadosDaAuditoria<'suboperador.cadastrado'>
    await expect(runInContext({ requisicaoId: randomUUID() }, () => registro.gravar(banco, 'suboperador.cadastrado', comNome))).rejects.toEqual(new AuditoriaRejectedError('dados_fora_do_schema'))
  })

  describe('checks do banco, mesmo por fora do RegistroDeAuditoria', () => {
    interface ColunasDoTeste {
      escolaId: string | null
      autorUsuarioId: string | null
      autorOperador: string | null
      entidade: string
      finalidade?: string
    }
    const inserir = (colunas: ColunasDoTeste) =>
      pool.query(
        `insert into auditoria (escola_id, autor_usuario_id, autor_operador, acao, entidade, entidade_id, finalidade, requisicao_id)
         values ($1, $2, $3, 'teste.check', $4, $5, $6, $7)`,
        [colunas.escolaId, colunas.autorUsuarioId, colunas.autorOperador, colunas.entidade, randomUUID(), colunas.finalidade ?? null, randomUUID()],
      )

    it('escola nula com autor usuário é recusada, mesmo com entidade rede', async () => {
      await expect(inserir({ escolaId: null, autorUsuarioId: randomUUID(), autorOperador: null, entidade: 'rede' })).rejects.toMatchObject({
        code: '23514',
        constraint: 'auditoria_escola_ou_operacao_global',
      })
    })

    it('escola nula com operador é aceita para a rede e para o suboperador, e só para eles (F3, 8.0)', async () => {
      for (const entidade of ['rede', 'suboperador']) {
        await inserir({ escolaId: null, autorUsuarioId: null, autorOperador: 'operador-teste', entidade })
      }
      await pool.query(`delete from auditoria where acao = 'teste.check' and escola_id is null`)
    })

    it('escola nula com operador e entidade diferente de rede e de suboperador é recusada', async () => {
      await expect(inserir({ escolaId: null, autorUsuarioId: null, autorOperador: 'operador-teste', entidade: 'escola' })).rejects.toMatchObject({
        code: '23514',
        constraint: 'auditoria_escola_ou_operacao_global',
      })
    })

    it('registro sem autor nenhum é recusado, mesmo com escola', async () => {
      await expect(inserir({ escolaId: escolaA, autorUsuarioId: null, autorOperador: null, entidade: 'escola' })).rejects.toMatchObject({
        code: '23514',
        constraint: 'auditoria_um_autor',
      })
    })

    it('registro com os dois autores é recusado: operador não age em nome de usuário, nem na rede', async () => {
      await expect(inserir({ escolaId: escolaA, autorUsuarioId: randomUUID(), autorOperador: 'operador-teste', entidade: 'escola' })).rejects.toMatchObject({
        code: '23514',
        constraint: 'auditoria_um_autor',
      })
      await expect(inserir({ escolaId: null, autorUsuarioId: randomUUID(), autorOperador: 'operador-teste', entidade: 'rede' })).rejects.toMatchObject({
        code: '23514',
        constraint: 'auditoria_um_autor',
      })
    })

    it.each([['nome e e-mail', 'Joaquim <j@x.ia>'], ['maiúscula', 'Joaquim'], ['curto demais', 'j']])(
      'operador fora do formato (%s) é recusado: nome completo ou e-mail não entram em autor_operador',
      async (_caso, autorOperador) => {
        await expect(inserir({ escolaId: escolaA, autorUsuarioId: null, autorOperador, entidade: 'escola' })).rejects.toMatchObject({
          code: '23514',
          constraint: 'auditoria_operador_formato',
        })
      },
    )

    it('finalidade vazia ou com mais de 200 caracteres é recusada', async () => {
      for (const finalidade of ['', 'x'.repeat(201)]) {
        await expect(inserir({ escolaId: escolaA, autorUsuarioId: null, autorOperador: 'operador-teste', entidade: 'escola', finalidade })).rejects.toMatchObject({
          code: '23514',
          constraint: 'auditoria_finalidade_curta',
        })
      }
    })

    it('escola que não existe é recusada pela FK', async () => {
      await expect(inserir({ escolaId: randomUUID(), autorUsuarioId: null, autorOperador: 'operador-teste', entidade: 'escola' })).rejects.toMatchObject({ code: '23503' })
    })
  })

  describe('o autor `rotina` (F3, tarefa 15.0): o banco o aceita só nas quatro ações da eliminação', () => {
    const comoRotina = (acao: string, entidade: string) =>
      pool.query(
        `insert into auditoria (escola_id, autor_usuario_id, autor_operador, acao, entidade, entidade_id, requisicao_id)
         values ($1, null, 'rotina', $2, $3, $4, $5)`,
        [escolaA, acao, entidade, randomUUID(), randomUUID()],
      )

    it.each([
      ['usuario.eliminado', 'usuario'],
      ['acesso_turma.revogado', 'acesso_turma'],
      ['titular.nome_trocado', 'texto_livre'],
      ['pedido.concluido', 'pedido_titular'],
    ])('aceita %s', async (acao, entidade) => {
      await comoRotina(acao, entidade)
      const { rows } = await pool.query('select autor_operador from auditoria where escola_id = $1 and acao = $2', [escolaA, acao])
      expect(rows).toEqual([{ autor_operador: 'rotina' }])
    })

    it.each([
      ['entrega.decidida', 'entrega'],
      ['lote.aprovado', 'lote_de_correcao'],
      ['escola.criada', 'escola'],
      ['pedido.cancelado', 'pedido_titular'],
      ['usuario.desativado', 'usuario'],
    ])('recusa %s: aprovar, rejeitar e validar são de pessoa, e a rotina não assina', async (acao, entidade) => {
      await expect(comoRotina(acao, entidade)).rejects.toMatchObject({ code: '23514', constraint: 'auditoria_rotina_so_nas_acoes' })
    })

    it('outro operador assina qualquer ação: o check é só da rotina', async () => {
      await pool.query(
        `insert into auditoria (escola_id, autor_usuario_id, autor_operador, acao, entidade, entidade_id, requisicao_id)
         values ($1, null, 'operador-teste', 'entrega.decidida', 'entrega', $2, $3)`,
        [escolaA, randomUUID(), randomUUID()],
      )
    })

    it('o apelido `rotina` não entra na tabela de operadores, nem por fora do comando', async () => {
      await expect(
        pool.query(`insert into operador (apelido, nome, email) values ('rotina', 'Pessoa Sintética', $1)`, [`rotina-${randomUUID()}@turmma.invalid`]),
      ).rejects.toMatchObject({ code: '23514', constraint: 'operador_apelido_formato' })
    })
  })

  it('rede: tipo fora da lista e nome em branco são recusados pelo banco', async () => {
    await expect(pool.query(`insert into rede (nome, tipo) values ('Rede Sintética', 'municipal')`)).rejects.toMatchObject({ code: '23514', constraint: 'rede_tipo_valido' })
    await expect(pool.query(`insert into rede (nome, tipo) values ('   ', 'grupo')`)).rejects.toMatchObject({ code: '23514', constraint: 'rede_nome_preenchido' })
  })

  it('escola: slug fora do formato ou longo, nome vazio e inatividade zero são recusados pelo banco', async () => {
    await expect(pool.query(`insert into escola (rede_id, nome, slug) values ($1, 'Escola Sintética', 'Colégio Horizonte')`, [redeId])).rejects.toMatchObject({
      code: '23514',
      constraint: 'escola_slug_formato',
    })
    await expect(
      pool.query(`insert into escola (rede_id, nome, slug, inatividade_aluno_min) values ($1, 'Escola Sintética', $2, 0)`, [redeId, `inatividade-${sufixo}`]),
    ).rejects.toMatchObject({ code: '23514', constraint: 'escola_inatividade_aluno_positiva' })
    await expect(
      pool.query(`insert into escola (rede_id, nome, slug, inatividade_equipe_min) values ($1, 'Escola Sintética', $2, -5)`, [redeId, `inatividade-${sufixo}`]),
    ).rejects.toMatchObject({ code: '23514', constraint: 'escola_inatividade_equipe_positiva' })
    await expect(pool.query(`insert into escola (rede_id, nome, slug) values ($1, 'Escola Sintética', $2)`, [redeId, 'a'.repeat(64)])).rejects.toMatchObject({
      code: '23514',
      constraint: 'escola_slug_formato',
    })
    await expect(pool.query(`insert into escola (rede_id, nome, slug) values ($1, '', $2)`, [redeId, `sem-nome-${sufixo}`])).rejects.toMatchObject({
      code: '23514',
      constraint: 'escola_nome_preenchido',
    })
    const { rows } = await pool.query('select inatividade_aluno_min, inatividade_equipe_min from escola where id = $1', [escolaA])
    expect(rows).toEqual([{ inatividade_aluno_min: 30, inatividade_equipe_min: 120 }])
  })
})
