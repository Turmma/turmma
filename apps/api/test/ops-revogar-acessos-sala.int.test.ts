import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { executarOpsRevogarAcessosSala } from '../src/ops/revogar-acessos-sala.js'
import { chamar, subirApi, type TestApi } from './test-api.js'
import { FerramentasDaSala, type TestSala } from './sala.fixture.js'
import { SessaoFixtures } from './sessao.fixture.js'

/**
 * `ops:revogar-acessos-sala` (A1, tarefa 9.0; `tasks/prd-apresentacao-escola/cenarios.md`, E29 e a concorrência): o
 * operador revoga, pelo id da escola que o log `sala.limite_atingido` traz, todo link e código vigente dela, com uma
 * auditoria por acesso e sem tocar em outra escola. O comando roda de verdade, com o banco de operação que ele mesmo
 * abre; o link e o código são conferidos pela página pública da sala, na API do teste. Postgres e Redis reais.
 */

const OPERADOR = 'operador-teste'
const AMBIENTE = { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' }

interface Execucao {
  readonly codigo: number
  readonly saida: string
  readonly erro: string
}

describe('ops:revogar-acessos-sala (A1, tarefa 9.0): o operador revoga os acessos da escola do log', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const ambiente = { ...lerAmbienteDeTeste(), OPERADOR }
  let api: TestApi
  let sala: FerramentasDaSala

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: AMBIENTE })
    sala = new FerramentasDaSala(api, bancada)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  async function rodar(argumentos: string[], doAmbiente: Record<string, string | undefined> = ambiente): Promise<Execucao> {
    let saida = ''
    let erro = ''
    const codigo = await executarOpsRevogarAcessosSala(argumentos, doAmbiente, { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) })
    return { codigo, saida, erro }
  }

  /**
   * A escola A do cenário: a `turma` com o acesso de agora e o que o "Gerar novo" derrubou, a `outraTurma` com o dela, e
   * uma terceira turma com o acesso vencido. Devolve o link e o código vigentes de cada turma e os ids.
   */
  async function montarEscolaComAcessos(): Promise<{
    sala: TestSala
    vigentes: Array<{ id: string; turmaId: string; token: string; codigo: string }>
    vencido: string
    revogadoAntes: string
  }> {
    const montada = await sala.montar()
    const revogadoAntes = await sala.acessoVigente(montada.turma)
    const daTurma = await sala.gerar(montada, montada.turma)
    const daOutra = await sala.gerar(montada, montada.outraTurma)
    const terceira = await chamar(api.url, 'POST', '/v1/turmas', montada.coordenacao.token, { serieId: montada.serieId, nome: '2ºD' })
    expect(terceira.status).toBe(201)
    const terceiraId = terceira.corpo['id'] as string
    const vinculo = await chamar(api.url, 'POST', '/v1/vinculos', montada.coordenacao.token, { usuarioId: montada.professor.usuarioId, turmaId: terceiraId, disciplinaId: montada.quimica, papel: 'professor' })
    expect(vinculo.status).toBe(201)
    expect((await chamar(api.url, 'POST', `/v1/vinculos/${vinculo.corpo['id'] as string}/confirmar`, montada.professor.token)).status).toBe(200)
    await sala.gerar(montada, terceiraId)
    const vencido = await sala.acessoVigente(terceiraId)
    await bancada.pool.query(`update acesso_turma set expira_em = now() - interval '1 minute' where id = $1`, [vencido])
    return {
      sala: montada,
      vigentes: [
        { id: await sala.acessoVigente(montada.turma), turmaId: montada.turma, ...daTurma },
        { id: await sala.acessoVigente(montada.outraTurma), turmaId: montada.outraTurma, ...daOutra },
      ],
      vencido,
      revogadoAntes,
    }
  }

  /** Os `acesso_turma.revogado` do operador na auditoria da escola, pelo id do acesso. */
  async function revogacoesDoOperador(escolaId: string): Promise<Array<{ entidade_id: string; autor_operador: string | null; autor_usuario_id: string | null; depois: unknown }>> {
    const { rows } = await bancada.pool.query<{ entidade_id: string; autor_operador: string | null; autor_usuario_id: string | null; depois: unknown }>(
      `select entidade_id, autor_operador, autor_usuario_id, depois from auditoria where escola_id = $1 and acao = 'acesso_turma.revogado' order by entidade_id`,
      [escolaId],
    )
    return rows
  }

  async function revogadoEm(id: string): Promise<Date | null> {
    const { rows } = await bancada.pool.query<{ revogado_em: Date | null }>('select revogado_em from acesso_turma where id = $1', [id])
    return rows[0]?.revogado_em ?? null
  }

  const abre = async (montada: TestSala, pelo: { token: string } | { codigo: string }) => (await sala.abrir({ slug: montada.slug, ...pelo })).status

  it('E29: revoga todos os vigentes de A na hora, link e código respondem NAO_ENCONTRADO, uma auditoria por acesso com o operador, e B intacta; a segunda execução revoga zero', async () => {
    const a = await montarEscolaComAcessos()
    const b = await sala.montar()
    // B com dois acessos vigentes, em duas turmas: nenhum dos dois pode cair.
    const daOutraDeB = await sala.gerar(b, b.outraTurma)
    for (const vigente of a.vigentes) {
      expect(await abre(a.sala, { token: vigente.token })).toBe(200)
      expect(await abre(a.sala, { codigo: vigente.codigo })).toBe(200)
    }

    const execucao = await rodar(['--escola', a.sala.escolaId])
    // Só a contagem: nada de slug, código, token nem id de acesso na saída.
    expect(execucao).toEqual({ codigo: 0, saida: `${JSON.stringify({ revogados: 2 })}\n`, erro: '' })

    for (const vigente of a.vigentes) {
      expect(await abre(a.sala, { token: vigente.token })).toBe(404)
      expect(await abre(a.sala, { codigo: vigente.codigo })).toBe(404)
      expect(await revogadoEm(vigente.id)).not.toBeNull()
    }
    // O vencido não é vigente: fica como estava, e o que o "Gerar novo" derrubou não ganha outra revogação.
    expect(await revogadoEm(a.vencido)).toBeNull()
    expect((await revogacoesDoOperador(a.sala.escolaId)).map((registro) => registro.entidade_id)).not.toContain(a.revogadoAntes)

    expect(await revogacoesDoOperador(a.sala.escolaId)).toEqual(
      a.vigentes
        .map((vigente) => ({ entidade_id: vigente.id, autor_operador: OPERADOR, autor_usuario_id: null, depois: { turmaId: vigente.turmaId } }))
        .sort((x, y) => x.entidade_id.localeCompare(y.entidade_id)),
    )

    // B, na mesma hora, continua abrindo pelo link e pelo código, sem revogação nem auditoria do operador.
    expect(await abre(b, { token: b.token })).toBe(200)
    expect(await abre(b, { codigo: b.codigo })).toBe(200)
    expect(await abre(b, { token: daOutraDeB.token })).toBe(200)
    expect(await abre(b, { codigo: daOutraDeB.codigo })).toBe(200)
    // A prova é o `abre` acima e o `acessoVigente`, que lança erro se a turma não tem um acesso não revogado; o
    // `revogadoEm` só repete o que ele já garante.
    expect(await revogadoEm(await sala.acessoVigente(b.turma))).toBeNull()
    expect(await revogadoEm(await sala.acessoVigente(b.outraTurma))).toBeNull()
    expect(await revogacoesDoOperador(b.escolaId)).toEqual([])

    // A segunda execução não acha vigente nenhum: zero, e nenhuma auditoria a mais.
    expect(await rodar(['--escola', a.sala.escolaId])).toEqual({ codigo: 0, saida: `${JSON.stringify({ revogados: 0 })}\n`, erro: '' })
    expect(await revogacoesDoOperador(a.sala.escolaId)).toHaveLength(2)
  })

  it('E29: o vigente de outro ano letivo da escola cai junto: o escopo do comando é a escola, sem o ano (Tech Spec da A1, seção 6)', async () => {
    const montada = await sala.montar()
    const { rows: anos } = await bancada.pool.query<{ id: string }>(
      `insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2025, '2025-02-01', '2025-12-15', 'encerrado') returning id`,
      [montada.escolaId],
    )
    const anoAnterior = anos[0]?.id ?? ''
    const { rows: turmas } = await bancada.pool.query<{ id: string }>(`insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºB') returning id`, [
      montada.escolaId,
      anoAnterior,
      montada.serieId,
    ])
    const { rows: acessos } = await bancada.pool.query<{ id: string }>(
      `insert into acesso_turma (escola_id, ano_letivo_id, turma_id, token_hash, codigo_hmac, validade_dias, expira_em)
       values ($1, $2, $3, $4, $5, 30, now() + interval '10 days') returning id`,
      [montada.escolaId, anoAnterior, turmas[0]?.id ?? '', randomUUID(), randomUUID()],
    )
    const doAnoAnterior = acessos[0]?.id ?? ''

    expect(await rodar(['--escola', montada.escolaId])).toEqual({ codigo: 0, saida: `${JSON.stringify({ revogados: 2 })}\n`, erro: '' })
    expect(await revogadoEm(doAnoAnterior)).not.toBeNull()
    const { rows: naoRevogados } = await bancada.pool.query('select 1 from acesso_turma where escola_id = $1 and revogado_em is null', [montada.escolaId])
    expect(naoRevogados).toEqual([])
    expect((await revogacoesDoOperador(montada.escolaId)).map((registro) => registro.entidade_id)).toContain(doAnoAnterior)
  })

  it('E29: escola inexistente é NAO_ENCONTRADO, com saída 1, sem gravar nada; o id que não é UUID é ArgumentoInvalido, com saída 2', async () => {
    const inexistente = randomUUID()
    expect(await rodar(['--escola', inexistente])).toEqual({ codigo: 1, saida: '', erro: `${ErrorCode.NAO_ENCONTRADO}\n` })
    const { rows } = await bancada.pool.query('select 1 from auditoria where escola_id = $1', [inexistente])
    expect(rows).toEqual([])
    expect(await rodar(['--escola', 'sala-limite-atingido'])).toEqual({ codigo: 2, saida: '', erro: 'Opção inválida ou ausente: --escola\n' })
  })

  it('E29: sem OPERADOR, recusa antes de tocar no banco: os acessos continuam vigentes', async () => {
    const a = await montarEscolaComAcessos()
    const execucao = await rodar(['--escola', a.sala.escolaId], { ...ambiente, OPERADOR: undefined })
    expect(execucao.codigo).toBe(2)
    expect(execucao.saida).toBe('')
    expect(execucao.erro).toContain('OPERADOR')
    for (const vigente of a.vigentes) expect(await revogadoEm(vigente.id)).toBeNull()
    expect(await revogacoesDoOperador(a.sala.escolaId)).toEqual([])
  })

  it('concorrência: duas execuções ao mesmo tempo revogam cada acesso uma vez, com uma auditoria por acesso, nenhuma em dobro', async () => {
    const a = await montarEscolaComAcessos()
    const b = await sala.montar()
    const [primeira, segunda] = await Promise.all([rodar(['--escola', a.sala.escolaId]), rodar(['--escola', a.sala.escolaId])])
    expect([primeira.codigo, segunda.codigo]).toEqual([0, 0])
    const contagens = [primeira, segunda].map((execucao) => (JSON.parse(execucao.saida) as { revogados: number }).revogados)
    expect(contagens.reduce((soma, contagem) => soma + contagem, 0)).toBe(2)
    const registros = await revogacoesDoOperador(a.sala.escolaId)
    expect(registros.map((registro) => registro.entidade_id).sort()).toEqual(a.vigentes.map((vigente) => vigente.id).sort())
    // B, montada antes, fica intacta também com as duas execuções: o `acessoVigente` lança erro se o dela caiu.
    expect(await revogadoEm(await sala.acessoVigente(b.turma))).toBeNull()
    expect(await revogacoesDoOperador(b.escolaId)).toEqual([])
  })
})
