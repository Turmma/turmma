import { createDatabase, createPool, runInContext } from '@educa/core'
import { CicloDeVidaRepository, CicloDeVidaService } from '@educa/core/ciclo-de-vida'
import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { sortearCodigoDaTurma } from '../src/sala/codigo-da-sala.js'
import { chamar, subirApi, type ApiDeTeste } from './test-api.js'
import { esperarNaTrava, GatilhoDeParada } from './write-block-trigger.js'
import { FerramentasDaSala, semRequisicao, type SalaDeTeste } from './sala.fixture.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao.fixture.js'

/**
 * O acesso da turma depois do fim do vínculo de quem o gerou (correção `2026-10-03-acesso-sobrevive-ao-vinculo`, G1 da
 * validação da A1; regra 20, item 18): quando termina o último vínculo confirmado do professor na turma — encerrado pela
 * coordenação (`desligamento` ou `realocacao`) ou apagado pela eliminação do usuário —, o acesso vigente daquela turma
 * que ele gerou é revogado na mesma transação, com `acesso_turma.revogado` na auditoria. O link e o código revogados
 * abrem a sala como o inexistente. Outro vínculo dele na turma, o acesso gerado por outro professor e o de outra escola
 * não caem. As duas ordens da corrida com o gerar também. Postgres e Redis reais; nomes sintéticos (regra 20, item 17).
 */

const AMBIENTE = { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' }

const NAO_ENCONTRADO = {
  status: 404,
  texto: JSON.stringify({ erro: { codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO, requisicaoId: '-' } }),
}

interface LinhaDoAcesso {
  readonly id: string
  readonly criado_por: string | null
  readonly revogado_em: Date | null
}

describe('acesso da turma × fim do vínculo de quem o gerou (correção 2026-10-03)', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  // Um pool próprio para a eliminação: o da bancada tem duas conexões, e nas corridas uma fica com a trava do gatilho.
  const poolDoCiclo = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 4, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
  const ciclo = new CicloDeVidaService(createDatabase(poolDoCiclo))
  let api: ApiDeTeste
  let sala: FerramentasDaSala

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: AMBIENTE })
    sala = new FerramentasDaSala(api, bancada)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await poolDoCiclo.end()
    await medidor.encerrar()
  })

  const post = (sessao: SessaoDeTeste, caminho: string, corpo?: unknown) => chamar(api.url, 'POST', caminho, sessao.token, corpo)

  /** O vínculo de professor do usuário na turma, pelo banco (a `montar` da sala não devolve os ids). */
  async function vinculoDe(s: SalaDeTeste, usuarioId: string, turmaId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>("select id from vinculo where escola_id = $1 and usuario_id = $2 and turma_id = $3 and papel = 'professor'", [
      s.escolaId,
      usuarioId,
      turmaId,
    ])
    const [linha] = rows
    if (linha === undefined || rows.length !== 1) throw new Error('vínculo não achado')
    return linha.id
  }

  /** Um professor novo da escola, confirmado na turma e na disciplina. */
  async function professorConfirmado(s: SalaDeTeste, turmaId: string, disciplinaId: string): Promise<SessaoDeTeste> {
    const professor = await bancada.sessao(s.escolaId, 'professor')
    const criado = await post(s.coordenacao, '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId, disciplinaId, papel: 'professor' })
    expect(criado.status).toBe(201)
    expect((await post(professor, `/v1/vinculos/${criado.corpo['id'] as string}/confirmar`)).status).toBe(200)
    return professor
  }

  async function encerrar(s: SalaDeTeste, vinculo: string, motivo: 'desligamento' | 'realocacao' = 'desligamento') {
    return post(s.coordenacao, `/v1/vinculos/${vinculo}/encerrar`, { motivo })
  }

  async function acessosDa(s: Pick<SalaDeTeste, 'escolaId'>, turmaId: string): Promise<LinhaDoAcesso[]> {
    const { rows } = await bancada.pool.query<LinhaDoAcesso>('select id, criado_por, revogado_em from acesso_turma where escola_id = $1 and turma_id = $2 order by criado_em, id', [
      s.escolaId,
      turmaId,
    ])
    return rows
  }

  async function revogadosNaAuditoria(s: Pick<SalaDeTeste, 'escolaId'>): Promise<Array<{ entidade_id: string; autor_usuario_id: string | null; depois: unknown }>> {
    const { rows } = await bancada.pool.query<{ entidade_id: string; autor_usuario_id: string | null; depois: unknown }>(
      "select entidade_id, autor_usuario_id, depois from auditoria where escola_id = $1 and acao = 'acesso_turma.revogado' order by id",
      [s.escolaId],
    )
    return rows
  }

  /** O link e o código abrem a sala (200) ou respondem o mesmo corpo do token e do código sorteados. */
  async function abreASala(s: Pick<SalaDeTeste, 'slug' | 'token' | 'codigo'>): Promise<{ token: number; codigo: number }> {
    return { token: (await sala.abrir({ slug: s.slug, token: s.token })).status, codigo: (await sala.abrir({ slug: s.slug, codigo: s.codigo })).status }
  }

  async function naoAbreASala(s: Pick<SalaDeTeste, 'slug' | 'token' | 'codigo'>): Promise<void> {
    expect(semRequisicao(await sala.abrir({ slug: s.slug, token: s.token }))).toEqual(NAO_ENCONTRADO)
    expect(semRequisicao(await sala.abrir({ slug: s.slug, codigo: s.codigo }))).toEqual(NAO_ENCONTRADO)
    // O revogado responde byte a byte como o que nunca existiu (regra 10, item 6).
    expect(semRequisicao(await sala.abrir({ slug: s.slug, token: randomBytes(32).toString('base64url') }))).toEqual(NAO_ENCONTRADO)
    expect(semRequisicao(await sala.abrir({ slug: s.slug, codigo: sortearCodigoDaTurma() }))).toEqual(NAO_ENCONTRADO)
  }

  describe.each(['desligamento', 'realocacao'] as const)('encerrar por %s', (motivo) => {
    it('encerrar o último vínculo do professor na turma revoga o acesso que ele gerou, com auditoria da coordenação, e o link e o código deixam de abrir a sala', async () => {
      const s = await sala.montar()
      // O acesso da outra turma, do mesmo professor, onde o vínculo dele continua: não cai.
      const daOutraTurma = await sala.gerar(s, s.outraTurma)
      expect(await abreASala(s)).toEqual({ token: 200, codigo: 200 })
      const [acesso] = await acessosDa(s, s.turma)

      expect((await encerrar(s, await vinculoDe(s, s.professor.usuarioId, s.turma), motivo)).status).toBe(200)

      expect(await acessosDa(s, s.turma)).toEqual([expect.objectContaining({ id: acesso?.id, revogado_em: expect.any(Date) })])
      await naoAbreASala(s)
      expect(await revogadosNaAuditoria(s)).toEqual([{ entidade_id: acesso?.id, autor_usuario_id: s.coordenacao.usuarioId, depois: { turmaId: s.turma } }])
      expect(await acessosDa(s, s.outraTurma)).toEqual([expect.objectContaining({ revogado_em: null })])
      expect(await abreASala({ slug: s.slug, ...daOutraTurma })).toEqual({ token: 200, codigo: 200 })
    })
  })

  it('o acesso continua se o professor ainda tem outro vínculo confirmado na turma (outra disciplina)', async () => {
    const s = await sala.montar()
    const fisica = await post(s.coordenacao, '/v1/vinculos', { usuarioId: s.professor.usuarioId, turmaId: s.turma, disciplinaId: s.fisica, papel: 'professor' })
    expect(fisica.status).toBe(201)
    expect((await post(s.professor, `/v1/vinculos/${fisica.corpo['id'] as string}/confirmar`)).status).toBe(200)
    const antes = await acessosDa(s, s.turma)

    const { rows } = await bancada.pool.query<{ id: string }>('select id from vinculo where escola_id = $1 and usuario_id = $2 and turma_id = $3 and disciplina_id = $4', [
      s.escolaId,
      s.professor.usuarioId,
      s.turma,
      s.quimica,
    ])
    const [quimica] = rows
    if (quimica === undefined) throw new Error('vínculo de química não achado')
    expect((await encerrar(s, quimica.id)).status).toBe(200)

    expect(await acessosDa(s, s.turma)).toEqual(antes)
    expect(await abreASala(s)).toEqual({ token: 200, codigo: 200 })
    expect(await revogadosNaAuditoria(s)).toEqual([])
  })

  it('o acesso não cai quando quem sai não é quem o gerou, nem quando quem o gerou foi substituído por outro professor', async () => {
    const s = await sala.montar()
    const outro = await professorConfirmado(s, s.turma, s.fisica)
    const antes = await acessosDa(s, s.turma)
    // Quem sai não gerou o acesso vigente: ele fica.
    expect((await encerrar(s, await vinculoDe(s, outro.usuarioId, s.turma))).status).toBe(200)
    expect(await acessosDa(s, s.turma)).toEqual(antes)
    expect(await abreASala(s)).toEqual({ token: 200, codigo: 200 })

    // O terceiro gera de novo ("Gerar novo" derruba o do primeiro); o primeiro sai, e o acesso do terceiro fica.
    const terceiro = await professorConfirmado(s, s.turma, s.fisica)
    const novo = await sala.gerar({ professor: terceiro }, s.turma)
    expect((await encerrar(s, await vinculoDe(s, s.professor.usuarioId, s.turma))).status).toBe(200)
    expect((await acessosDa(s, s.turma)).filter((linha) => linha.revogado_em === null)).toEqual([expect.objectContaining({ criado_por: terceiro.usuarioId })])
    expect(await abreASala({ slug: s.slug, ...novo })).toEqual({ token: 200, codigo: 200 })
    expect(await revogadosNaAuditoria(s)).toEqual([])
  })

  it('o colega confirmado em outra disciplina da mesma turma não segura o acesso de quem o gerou: encerrar e eliminar quem gerou revogam, com auditoria (F3, tarefa 1.0)', async () => {
    // Encerrar: o vínculo de quem gerou acaba, e o colega de física continua confirmado na turma.
    const s = await sala.montar()
    const colega = await professorConfirmado(s, s.turma, s.fisica)
    const [acesso] = await acessosDa(s, s.turma)
    expect(acesso?.criado_por).toBe(s.professor.usuarioId)
    expect((await encerrar(s, await vinculoDe(s, s.professor.usuarioId, s.turma))).status).toBe(200)
    expect(await acessosDa(s, s.turma)).toEqual([expect.objectContaining({ id: acesso?.id, revogado_em: expect.any(Date) })])
    await naoAbreASala(s)
    expect(await revogadosNaAuditoria(s)).toEqual([{ entidade_id: acesso?.id, autor_usuario_id: s.coordenacao.usuarioId, depois: { turmaId: s.turma } }])
    expect((await bancada.pool.query("select 1 from vinculo where escola_id = $1 and usuario_id = $2 and estado = 'confirmado'", [s.escolaId, colega.usuarioId])).rowCount).toBe(1)

    // Eliminar: o mesmo, pela eliminação de quem gerou, com o colega ainda na turma.
    const e = await sala.montar()
    await professorConfirmado(e, e.turma, e.fisica)
    const [acessoDeE] = await acessosDa(e, e.turma)
    await runInContext({ requisicaoId: randomUUID(), escolaId: e.escolaId, usuarioId: e.coordenacao.usuarioId, papel: 'coordenador' }, () => ciclo.eliminar(e.professor.usuarioId))
    expect(await acessosDa(e, e.turma)).toEqual([{ id: acessoDeE?.id, criado_por: null, revogado_em: expect.any(Date) }])
    await naoAbreASala(e)
    expect(await revogadosNaAuditoria(e)).toEqual([{ entidade_id: acessoDeE?.id, autor_usuario_id: e.coordenacao.usuarioId, depois: { turmaId: e.turma } }])
  })

  it('um vínculo de aluno do mesmo usuário na turma não segura o acesso que ele gerou como professor (F3, tarefa 1.0)', async () => {
    const s = await sala.montar()
    // Só o banco cria este vínculo: o papel do vínculo não depende do papel do usuário, e é a cláusula de papel que o separa.
    await bancada.pool.query("insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())", [
      s.escolaId,
      s.anoLetivoId,
      s.professor.usuarioId,
      s.turma,
      s.coordenacao.usuarioId,
    ])
    const [acesso] = await acessosDa(s, s.turma)
    expect((await encerrar(s, await vinculoDe(s, s.professor.usuarioId, s.turma))).status).toBe(200)
    expect(await acessosDa(s, s.turma)).toEqual([expect.objectContaining({ id: acesso?.id, revogado_em: expect.any(Date) })])
    await naoAbreASala(s)
  })

  it('isolamento: o encerramento numa escola não toca o acesso de outra, e a coordenação de B não encerra o vínculo de A', async () => {
    const a = await sala.montar()
    const b = await sala.montar()
    const deA = await vinculoDe(a, a.professor.usuarioId, a.turma)
    const acessosDeAAntes = await acessosDa(a, a.turma)

    expect((await encerrar(b, deA)).status).toBe(404)
    expect((await encerrar(b, await vinculoDe(b, b.professor.usuarioId, b.turma))).status).toBe(200)

    expect(await acessosDa(a, a.turma)).toEqual(acessosDeAAntes)
    expect(await abreASala(a)).toEqual({ token: 200, codigo: 200 })
    expect(await revogadosNaAuditoria(a)).toEqual([])
    await naoAbreASala(b)
  })

  it('isolamento no repository: no contexto da escola A, a revogação de quem saiu não alcança o acesso que o professor de B gerou', async () => {
    const a = await sala.montar()
    const b = await sala.montar()
    // O vínculo de B encerrado pelo banco, sem passar pela revogação: o acesso de B fica vigente e sem vínculo que o segure.
    await bancada.pool.query("update vinculo set estado = 'encerrado', motivo_encerramento = 'desligamento', encerrado_em = now() where id = $1", [
      await vinculoDe(b, b.professor.usuarioId, b.turma),
    ])
    const antesEmB = await acessosDa(b, b.turma)

    // Só a cláusula de escola separa: sem ela, o professor e a turma de B casariam.
    const revogados = await runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () =>
      bancada.banco.transaction((tx) => new CicloDeVidaRepository(tx).revogarDeQuemSaiu(b.professor.usuarioId, b.turma)),
    )

    expect(revogados).toEqual([])
    expect(await acessosDa(b, b.turma)).toEqual(antesEmB)
    expect(await abreASala(b)).toEqual({ token: 200, codigo: 200 })
    // No contexto de B, o mesmo pedido revoga: o teste acima não passa por o acesso não casar com nada.
    const deB = await runInContext({ requisicaoId: randomUUID(), escolaId: b.escolaId }, () =>
      bancada.banco.transaction((tx) => new CicloDeVidaRepository(tx).revogarDeQuemSaiu(b.professor.usuarioId, b.turma)),
    )
    expect(deB).toEqual([{ id: antesEmB[0]?.id, turmaId: b.turma }])
  })

  it('repository (F3, tarefa 1.0): com a turma, a revogação de quem saiu não alcança o acesso dele em outra turma, mesmo sem vínculo que o segure', async () => {
    const s = await sala.montar()
    await sala.gerar(s, s.outraTurma)
    // Os dois vínculos encerrados pelo banco, sem passar pela revogação: os dois acessos ficam vigentes e sem vínculo que os segure.
    for (const turmaId of [s.turma, s.outraTurma]) {
      await bancada.pool.query("update vinculo set estado = 'encerrado', motivo_encerramento = 'desligamento', encerrado_em = now() where id = $1", [
        await vinculoDe(s, s.professor.usuarioId, turmaId),
      ])
    }
    const [daTurma] = await acessosDa(s, s.turma)
    const daOutraTurma = await acessosDa(s, s.outraTurma)

    const revogados = await runInContext({ requisicaoId: randomUUID(), escolaId: s.escolaId }, () =>
      bancada.banco.transaction((tx) => new CicloDeVidaRepository(tx).revogarDeQuemSaiu(s.professor.usuarioId, s.turma)),
    )

    // Só a turma pedida: o acesso da outra turma, que casaria pelo professor, continua vigente.
    expect(revogados).toEqual([{ id: daTurma?.id, turmaId: s.turma }])
    expect(await acessosDa(s, s.outraTurma)).toEqual(daOutraTurma)
    expect(daOutraTurma).toEqual([expect.objectContaining({ revogado_em: null })])
  })

  it('a eliminação do professor revoga o acesso que ele gerou, com auditoria, e o link e o código deixam de abrir a sala', async () => {
    const s = await sala.montar()
    const [acesso] = await acessosDa(s, s.turma)
    const contexto = { requisicaoId: randomUUID(), escolaId: s.escolaId, usuarioId: s.coordenacao.usuarioId, papel: 'coordenador' as const }

    await runInContext(contexto, () => ciclo.eliminar(s.professor.usuarioId))

    expect(await acessosDa(s, s.turma)).toEqual([{ id: acesso?.id, criado_por: null, revogado_em: expect.any(Date) }])
    await naoAbreASala(s)
    expect(await revogadosNaAuditoria(s)).toEqual([{ entidade_id: acesso?.id, autor_usuario_id: s.coordenacao.usuarioId, depois: { turmaId: s.turma } }])
  })

  it('a eliminação pelo comando do operador, sem usuário nem ano no contexto, revoga com o operador como autor', async () => {
    const s = await sala.montar()
    const [acesso] = await acessosDa(s, s.turma)

    await runInContext({ requisicaoId: randomUUID(), escolaId: s.escolaId }, () => ciclo.eliminar(s.professor.usuarioId, { autorOperador: 'operador-teste' }))

    expect(await acessosDa(s, s.turma)).toEqual([{ id: acesso?.id, criado_por: null, revogado_em: expect.any(Date) }])
    const { rows } = await bancada.pool.query<{ entidade_id: string; autor_usuario_id: string | null; autor_operador: string | null }>(
      "select entidade_id, autor_usuario_id, autor_operador from auditoria where escola_id = $1 and acao = 'acesso_turma.revogado'",
      [s.escolaId],
    )
    expect(rows).toEqual([{ entidade_id: acesso?.id, autor_usuario_id: null, autor_operador: 'operador-teste' }])
    await naoAbreASala(s)
  })

  it('o acesso vencido de quem saiu não é revogado de novo nem ganha auditoria', async () => {
    const s = await sala.montar()
    const [acesso] = await acessosDa(s, s.turma)
    await bancada.pool.query("update acesso_turma set expira_em = now() - interval '1 minute' where id = $1", [acesso?.id])

    expect((await encerrar(s, await vinculoDe(s, s.professor.usuarioId, s.turma))).status).toBe(200)

    expect(await acessosDa(s, s.turma)).toEqual([expect.objectContaining({ id: acesso?.id, revogado_em: null })])
    expect(await revogadosNaAuditoria(s)).toEqual([])
  })

  describe('a ordem das travas: turma, depois vínculo', () => {
    it('o encerrar espera a turma sem segurar o vínculo: quem tem a turma (o excluir, a eliminação) alcança o vínculo, sem deadlock', async () => {
      const s = await sala.montar()
      const vinculo = await vinculoDe(s, s.professor.usuarioId, s.turma)
      // O segurador faz o que o excluir e a eliminação fazem: trava a turma e depois precisa da linha do vínculo (a FK no
      // `delete` da turma pede `FOR KEY SHARE`; a eliminação apaga o vínculo).
      const segurador = await bancada.pool.connect()
      try {
        await segurador.query('begin')
        await segurador.query('select id from turma where id = $1 for update', [s.turma])
        const encerrando = encerrar(s, vinculo)
        await esperarNaTrava(bancada.pool, '%"turma"%for no key update%')
        // Com o encerrar segurando o vínculo antes da turma, este comando esperaria por ele, e o Postgres abortaria um dos
        // dois com 40P01. Na ordem turma → vínculo, o vínculo está livre.
        await segurador.query("set local lock_timeout = '2s'")
        await segurador.query('select id from vinculo where id = $1 for key share', [vinculo])
        await segurador.query('commit')
        expect((await encerrando).status).toBe(200)
      } finally {
        await segurador.query('rollback').catch(() => undefined)
        segurador.release()
      }
      await naoAbreASala(s)
    })

    it('a eliminação trava também a turma do vínculo ainda pendente: o professor que confirma no meio não ganha uma turma destravada', async () => {
      const s = await sala.montar()
      // Na `turma`, o professor fica só com um vínculo pendente (Física): o confirmado de Química e o acesso saem pelo banco.
      // Na `outraTurma`, o confirmado da montagem continua.
      const quimica = await vinculoDe(s, s.professor.usuarioId, s.turma)
      await bancada.pool.query('delete from acesso_turma where turma_id = $1', [s.turma])
      await bancada.pool.query('delete from vinculo where id = $1', [quimica])
      const pendente = await post(s.coordenacao, '/v1/vinculos', { usuarioId: s.professor.usuarioId, turmaId: s.turma, disciplinaId: s.fisica, papel: 'professor' })
      expect(pendente.status).toBe(201)
      const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'vinculo', evento: 'delete', quando: `old.usuario_id = '${s.professor.usuarioId}'::uuid` })
      await gatilho.armar()
      try {
        const eliminando = eliminarPelaCoordenacao(s)
        await gatilho.esperarParadas()
        // A eliminação já passou pela trava das turmas: a do vínculo pendente está presa, e o gerar que viesse esperaria.
        const sonda = await bancada.pool.connect()
        try {
          await expect(sonda.query('select id from turma where id = $1 for share nowait', [s.turma])).rejects.toMatchObject({ code: '55P03' })
        } finally {
          sonda.release()
        }
        await gatilho.soltar()
        await eliminando
      } finally {
        await gatilho.desarmar()
      }
    })
  })

  const eliminarPelaCoordenacao = (s: SalaDeTeste) =>
    runInContext({ requisicaoId: randomUUID(), escolaId: s.escolaId, usuarioId: s.coordenacao.usuarioId, papel: 'coordenador' as const }, () => ciclo.eliminar(s.professor.usuarioId))

  describe('a corrida com o gerar, na trava da turma', () => {
    it('o gerar parado depois do insert: o encerrar espera a turma e revoga o acesso que acabou de nascer', async () => {
      const s = await sala.montar()
      const vinculo = await vinculoDe(s, s.professor.usuarioId, s.turma)
      const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'acesso_turma', evento: 'insert', quando: `new.turma_id = '${s.turma}'::uuid` })
      await gatilho.armar()
      try {
        const gerando = chamar(api.url, 'POST', `/v1/turmas/${s.turma}/acesso`, s.professor.token, { validadeDias: 7 })
        await gatilho.esperarParadas()
        const encerrando = encerrar(s, vinculo)
        await esperarNaTrava(bancada.pool, '%"turma"%for no key update%')
        await gatilho.soltar()
        const [gerado, encerrado] = await Promise.all([gerando, encerrando])
        expect(gerado.status).toBe(201)
        expect(encerrado.status).toBe(200)
      } finally {
        await gatilho.desarmar()
      }
      expect((await acessosDa(s, s.turma)).filter((linha) => linha.revogado_em === null)).toEqual([])
    })

    it('o encerrar parado com a turma travada: o gerar espera, reconfere o vínculo e sai NAO_ENCONTRADO, sem acesso vigente', async () => {
      const s = await sala.montar()
      const vinculo = await vinculoDe(s, s.professor.usuarioId, s.turma)
      const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'vinculo', evento: 'update', quando: `new.id = '${vinculo}'::uuid and new.estado = 'encerrado'` })
      await gatilho.armar()
      try {
        const encerrando = encerrar(s, vinculo)
        await gatilho.esperarParadas()
        const gerando = chamar(api.url, 'POST', `/v1/turmas/${s.turma}/acesso`, s.professor.token, { validadeDias: 7 })
        await esperarNaTrava(bancada.pool, '%"turma"%for share%')
        await gatilho.soltar()
        const [encerrado, gerado] = await Promise.all([encerrando, gerando])
        expect(encerrado.status).toBe(200)
        expect(gerado.status).toBe(404)
        expect(gerado.corpo['erro']).toEqual(expect.objectContaining({ codigo: ErrorCode.NAO_ENCONTRADO }))
      } finally {
        await gatilho.desarmar()
      }
      expect((await acessosDa(s, s.turma)).filter((linha) => linha.revogado_em === null)).toEqual([])
      await naoAbreASala(s)
    })

    it('o gerar parado depois do insert: a eliminação espera a turma e revoga o acesso que acabou de nascer', async () => {
      const s = await sala.montar()
      const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'acesso_turma', evento: 'insert', quando: `new.turma_id = '${s.turma}'::uuid` })
      await gatilho.armar()
      let novo: { token: string; codigo: string } | undefined
      try {
        const gerando = chamar(api.url, 'POST', `/v1/turmas/${s.turma}/acesso`, s.professor.token, { validadeDias: 7 })
        await gatilho.esperarParadas()
        const eliminando = eliminarPelaCoordenacao(s)
        await esperarNaTrava(bancada.pool, '%"turma"%for no key update%')
        await gatilho.soltar()
        const [gerado] = await Promise.all([gerando, eliminando])
        expect(gerado.status).toBe(201)
        novo = { token: gerado.corpo['token'] as string, codigo: gerado.corpo['codigo'] as string }
      } finally {
        await gatilho.desarmar()
      }
      expect((await acessosDa(s, s.turma)).filter((linha) => linha.revogado_em === null)).toEqual([])
      await naoAbreASala({ slug: s.slug, ...novo })
    })

    it('a eliminação parada com a turma travada: o gerar espera, reconfere o vínculo e sai NAO_ENCONTRADO, sem acesso vigente', async () => {
      const s = await sala.montar()
      const vinculo = await vinculoDe(s, s.professor.usuarioId, s.turma)
      const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'vinculo', evento: 'delete', quando: `old.id = '${vinculo}'::uuid` })
      await gatilho.armar()
      try {
        const eliminando = eliminarPelaCoordenacao(s)
        await gatilho.esperarParadas()
        const gerando = chamar(api.url, 'POST', `/v1/turmas/${s.turma}/acesso`, s.professor.token, { validadeDias: 7 })
        await esperarNaTrava(bancada.pool, '%"turma"%for share%')
        await gatilho.soltar()
        const [, gerado] = await Promise.all([eliminando, gerando])
        expect(gerado.status).toBe(404)
        expect(gerado.corpo['erro']).toEqual(expect.objectContaining({ codigo: ErrorCode.NAO_ENCONTRADO }))
      } finally {
        await gatilho.desarmar()
      }
      expect((await acessosDa(s, s.turma)).filter((linha) => linha.revogado_em === null)).toEqual([])
      await naoAbreASala(s)
    })
  })
})
