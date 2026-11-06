import 'reflect-metadata'
import { CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA, ContaDaPlanilhaPerdidaError, createDatabase, createPool, ehFalhaDeTrava, ExpurgoDeAcessoRepository, ImportacaoRepository, LOTE_DO_EXPURGO, MotorDePlanilha, runInContext, schema, type Database, type DatabasePool } from '@educa/core'
import { CicloDeVidaService } from '@educa/core/ciclo-de-vida'
import { TurmaRepository, VinculoRepository } from '@educa/core/estrutura'
import { ErrorCode, type PreviaDaPlanilhaResponse } from '@educa/shared'
import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { esperarNaTrava, WriteBlockTrigger } from '../../api/test/write-block-trigger.js'
import { criarGravacaoDaPlanilha } from '../src/processors/gravar-planilha.js'
import { jobExecution } from './job-execution.fixture.js'
import { InMemoryLog, QueueFixtures } from './queue.fixture.js'

beforeAll(() => {
  // Worker do compose de pé poderia executar o job que o teste grava, e disputar a importação com o processador do próprio teste.
  compose('stop', ...PROCESSOS_DA_FILA)
})

/**
 * A planilha da grade pelo job `estrutura.gravar-planilha` (F2, tarefa 11.0; Tech Spec do onboarding, seção 5, "Gravar" e "O job"; `cenarios.md`,
 * RF7 e RF8), pelo processador do worker, uma tentativa por chamada: a `alocacao`, o vínculo `pendente` de `origem = grade` que o professor confirma,
 * o que nasce com a grade (turma, disciplina, professor), o vínculo aberto reaproveitado, o ano planejado e as corridas entre o passo (2) e o (3), e
 * com o `desativar`. A prévia e as rotas estão em `apps/api/test/importacao.int.test.ts`.
 */

const PREFIXO = `grd${randomUUID().slice(0, 6)}`
const SEM_MARCAS = { transferir: [], desligar: [], encerrar: [] }
const CABECALHO = 'turma;disciplina;professor;email;dia;inicio;fim;sala'

interface Escola {
  readonly escolaId: string
  readonly coordenadorId: string
  readonly anoId: string
  readonly serieId: string
}

interface Pessoa {
  readonly usuarioId: string
  readonly contaId: string
  readonly email: string
}

interface VinculoNoBanco {
  readonly id: string
  readonly usuario_id: string
  readonly turma_id: string
  readonly disciplina_id: string | null
  readonly ano_letivo_id: string
  readonly estado: string
  readonly origem: string
  readonly criado_por: string
  readonly decidido_em: Date | null
}

interface AulaNoBanco {
  readonly id: string
  readonly vinculo_id: string
  readonly ano_letivo_id: string
  readonly dia_semana: number
  readonly inicio: string
  readonly fim: string
  readonly sala: string | null
}

/** O e-mail desta execução: `nome` mais um sufixo próprio da chamada, para o banco de teste acumulado não repetir conta. */
const emailDe = (nome: string): string => `${PREFIXO}-${nome}-${randomUUID().slice(0, 6)}@professores.invalid`

/** Uma linha da planilha da grade. */
const aula = (turma: string, disciplina: string, professor: string, email: string, dia: string, inicio: string, fim: string, sala = ''): string => [turma, disciplina, professor, email, dia, inicio, fim, sala].join(';')

const planilha = (...linhas: string[]): string => [CABECALHO, ...linhas].join('\n')

describe('estrutura.gravar-planilha, planilha da grade', () => {
  const bancada = new QueueFixtures()
  const log = new InMemoryLog('worker-teste')
  const medidor = new MedidorDeTeste()
  /** O pool dos jobs em corrida e das paradas: o da bancada tem poucas conexões, e cada parada segura uma. */
  let apoio: DatabasePool
  let bancoDoJob: Database
  let gravacao: ReturnType<typeof criarGravacaoDaPlanilha>

  beforeAll(() => {
    apoio = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 10, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    bancoDoJob = createDatabase(apoio)
    gravacao = criarGravacaoDaPlanilha({ banco: bancoDoJob, logger: log.logger, medidor: medidor.medidor })
  })

  afterAll(async () => {
    await apoio.end()
    await medidor.encerrar()
    await bancada.fechar()
  })

  /** A escola com a coordenação que grava, o ano de 2026 em curso e a série do 8º ano do fundamental. */
  async function escolaNova(): Promise<Escola> {
    const escolaId = await bancada.escola()
    const ano = (await bancada.pool.query<{ id: string }>("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaId])).rows[0]?.id ?? ''
    const { rows: conta } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [emailDe('coordenacao')])
    const { rows: pessoa } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'coordenador', 'Coordenação sintética', $2) returning id", [escolaId, conta[0]?.id])
    const { rows: serie } = await bancada.pool.query<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 8) returning id", [escolaId])
    return { escolaId, coordenadorId: pessoa[0]?.id ?? '', anoId: ano, serieId: serie[0]?.id ?? '' }
  }

  /** O ano de 2027 da escola, planejado. */
  async function anoPlanejado(escola: Escola): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2027, '2027-02-01', '2027-12-15', 'planejado') returning id", [escola.escolaId])
    return rows[0]?.id ?? ''
  }

  /** A turma do ano (o em curso, se não for dito outro) com a chave que o nome dá: "8º A" é `8a`. */
  async function turmaNa(escola: Escola, nome: string, anoId = escola.anoId): Promise<string> {
    const chave = `${nome.charAt(0)}${nome.slice(-1).toLowerCase()}`
    const { rows } = await bancada.pool.query<{ id: string }>('insert into turma (escola_id, ano_letivo_id, serie_id, nome, chave) values ($1, $2, $3, $4, $5) returning id', [escola.escolaId, anoId, escola.serieId, nome, chave])
    return rows[0]?.id ?? ''
  }

  async function disciplinaNa(escola: Escola, nome: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>('insert into disciplina (escola_id, nome) values ($1, $2) returning id', [escola.escolaId, nome])
    return rows[0]?.id ?? ''
  }

  /** Um professor já na escola, com conta própria: ativo, ou desativado. */
  async function professorNaEscola(escola: Escola, nome: string, ativo = true): Promise<Pessoa> {
    const email = emailDe(nome.toLowerCase().replaceAll(' ', '-'))
    const { rows: conta } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [email])
    const contaId = conta[0]?.id ?? ''
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into usuario (escola_id, papel, nome, conta_id, desativado_em) values ($1, 'professor', $2, $3, ${ativo ? 'null' : 'now()'}) returning id`,
      [escola.escolaId, nome, contaId],
    )
    return { usuarioId: rows[0]?.id ?? '', contaId, email }
  }

  /** O vínculo de professor feito à mão (origem `coordenacao`), no estado pedido. */
  async function vinculoNaMao(escola: Escola, usuarioId: string, turmaId: string, disciplinaId: string, estado: 'pendente' | 'confirmado' | 'contestado' | 'encerrado', anoId = escola.anoId): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, contestacao, decidido_em, motivo_encerramento, encerrado_em)
       values ($1, $2, $3, $4, $5, 'professor', $6::text, $7, case when $6::text = 'contestado' then 'turma_errada' end, case when $6::text <> 'pendente' then now() end,
               case when $6::text = 'encerrado' then 'desligamento' end, case when $6::text = 'encerrado' then now() end) returning id`,
      [escola.escolaId, anoId, usuarioId, turmaId, disciplinaId, estado, escola.coordenadorId],
    )
    return rows[0]?.id ?? ''
  }

  const contextoDa = (escola: Escola) => ({ requisicaoId: randomUUID(), escolaId: escola.escolaId, usuarioId: escola.coordenadorId, papel: 'coordenador' as const, sessaoId: randomUUID(), anoLetivoId: escola.anoId })

  /** O gravar da coordenação, pelo motor (sem fila): devolve o id da importação `na_fila`. */
  function gravar(escola: Escola, texto: string, anoLetivoId?: string): Promise<string> {
    const motor = new MotorDePlanilha(bancada.banco, { enfileirar: () => Promise.resolve(randomUUID()) })
    return runInContext(contextoDa(escola), async () => (await motor.gravar('grade', { texto, marcas: SEM_MARCAS, ...(anoLetivoId === undefined ? {} : { anoLetivoId }) })).id)
  }

  /** A prévia da coordenação, pelo motor. */
  function previa(escola: Escola, texto: string): Promise<PreviaDaPlanilhaResponse> {
    const motor = new MotorDePlanilha(bancada.banco, { enfileirar: () => Promise.resolve(randomUUID()) })
    return runInContext(contextoDa(escola), () => motor.previa('grade', { texto }))
  }

  /** Uma tentativa do job, como o executor a entrega: no contexto da escola da linha do outbox. */
  function tentar(escolaId: string, importacaoId: string, tentativa = 1, processador = gravacao): Promise<void> {
    return runInContext({ requisicaoId: randomUUID(), escolaId }, () => processador({ importacaoId }, jobExecution(randomUUID(), tentativa)))
  }

  async function importacao(importacaoId: string): Promise<{ estado: string; erro: string | null; resumo: Record<string, number> | null }> {
    const { rows } = await bancada.pool.query<{ estado: string; erro: string | null; resumo: Record<string, number> | null }>('select estado, erro, resumo from importacao_planilha where id = $1', [importacaoId])
    return rows[0] ?? { estado: 'sumiu', erro: null, resumo: null }
  }

  async function vinculosDa(escola: Escola): Promise<VinculoNoBanco[]> {
    const { rows } = await bancada.pool.query<VinculoNoBanco>(
      'select id, usuario_id, turma_id, disciplina_id, ano_letivo_id, estado, origem, criado_por, decidido_em from vinculo where escola_id = $1 and papel = $2 order by id',
      [escola.escolaId, 'professor'],
    )
    return rows
  }

  async function aulasDa(escolaId: string): Promise<AulaNoBanco[]> {
    const { rows } = await bancada.pool.query<AulaNoBanco>(
      "select id, vinculo_id, ano_letivo_id, dia_semana, to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim, sala from alocacao where escola_id = $1 order by dia_semana, inicio, id",
      [escolaId],
    )
    return rows
  }

  /** O que o job contou, por resultado, desde o início (o medidor de teste acumula por ponto). */
  async function resultados(): Promise<Record<string, number>> {
    const pontos = await medidor.pontos('importacao.job')
    return Object.fromEntries(pontos.map(({ atributos, valor }) => [String(atributos['resultado']), valor as number]))
  }

  async function contar(tabela: string, escolaId: string): Promise<number> {
    return (await bancada.pool.query<{ total: number }>(`select count(*)::int as total from ${tabela} where escola_id = $1`, [escolaId])).rows[0]?.total ?? 0
  }

  async function auditoriaDa(escolaId: string, acao: string): Promise<Array<{ entidade_id: string; autor_usuario_id: string | null; depois: unknown }>> {
    const { rows } = await bancada.pool.query<{ entidade_id: string; autor_usuario_id: string | null; depois: unknown }>('select entidade_id, autor_usuario_id, depois from auditoria where escola_id = $1 and acao = $2 order by id', [escolaId, acao])
    return rows
  }

  /** O professor da escola com esse e-mail, pela conta, com o convite em aberto. */
  async function professorDe(escolaId: string, email: string): Promise<{ id: string; nome: string; ativo: boolean; convitesEmAberto: number } | undefined> {
    const { rows } = await bancada.pool.query<{ id: string; nome: string; ativo: boolean; convitesEmAberto: number }>(
      `select u.id, u.nome, u.desativado_em is null as ativo,
              (select count(*)::int from convite c where c.escola_id = u.escola_id and c.usuario_id = u.id and c.usado_em is null and c.revogado_em is null) as "convitesEmAberto"
         from usuario u join conta on conta.id = u.conta_id where u.escola_id = $1 and u.papel = 'professor' and conta.email = $2`,
      [escolaId, email],
    )
    return rows[0]
  }

  /** O contexto do professor logado no ano dado: o que a `SessaoGuard` grava e o `VinculoRepository` e o `TurmaRepository` leem. */
  const comoProfessor = <T>(escola: Escola, usuarioId: string, anoLetivoId: string, rodar: () => Promise<T>): Promise<T> =>
    runInContext({ requisicaoId: randomUUID(), escolaId: escola.escolaId, usuarioId, papel: 'professor', sessaoId: randomUUID(), anoLetivoId }, rodar)

  /** O professor decide o vínculo dele, como o `VinculoService` faz: trava, e só então decide. Devolve se decidiu. */
  const confirmar = (escola: Escola, usuarioId: string, anoLetivoId: string, vinculoId: string): Promise<boolean> =>
    comoProfessor(escola, usuarioId, anoLetivoId, () =>
      bancada.banco.transaction(async (tx) => {
        const repositorio = new VinculoRepository(tx)
        if ((await repositorio.travar(vinculoId, { doUsuario: true })) === undefined) return false
        return repositorio.decidir(vinculoId, { estado: 'confirmado' })
      }),
    )

  /** Os vínculos que o professor vê no ano do contexto: o que a lista dele (`listarDoUsuario`) devolve. */
  const vinculosQueVe = async (escola: Escola, usuarioId: string, anoLetivoId: string): Promise<string[]> =>
    (await comoProfessor(escola, usuarioId, anoLetivoId, () => bancada.banco.transaction((tx) => new VinculoRepository(tx).listarDoUsuario({ limite: 50 })))).map(({ id }) => id)

  /** Se o professor alcança a turma (RF5): a turma vinculada a ele, no ano do contexto. */
  const alcancaATurma = async (escola: Escola, usuarioId: string, anoLetivoId: string, turmaId: string): Promise<boolean> =>
    (await comoProfessor(escola, usuarioId, anoLetivoId, () => bancada.banco.transaction((tx) => new TurmaRepository(tx).aberta(turmaId, 'turma_vinculada')))) !== undefined

  it('tripla sem vínculo vira um vínculo pendente com `origem = grade`, as aulas ficam na `alocacao`, e a auditoria da coordenação traz a origem sem nome nem e-mail', async () => {
    const escola = await escolaNova()
    const turmaId = await turmaNa(escola, '8º A')
    const quimica = await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, 'segunda', '8:00', '8:50', 'Sala 12'), aula('8ºA', 'quimica', 'Ana Souza', ana.email, '3', '09:00', '09:50')))

    await tentar(escola.escolaId, id)

    const resumo = { aulas: 2, ja_existem: 0, turmas_novas: 0, disciplinas_novas: 0, professores_novos: 0, vinculos_criados: 1 }
    expect(await importacao(id)).toEqual({ estado: 'concluida', erro: null, resumo })
    const vinculos = await vinculosDa(escola)
    expect(vinculos).toEqual([expect.objectContaining({ usuario_id: ana.usuarioId, turma_id: turmaId, disciplina_id: quimica, ano_letivo_id: escola.anoId, estado: 'pendente', origem: 'grade', criado_por: escola.coordenadorId, decidido_em: null })])
    expect((await aulasDa(escola.escolaId)).map(({ vinculo_id, ano_letivo_id, dia_semana, inicio, fim, sala }) => [vinculo_id, ano_letivo_id, dia_semana, inicio, fim, sala])).toEqual([
      [vinculos[0]?.id, escola.anoId, 1, '08:00', '08:50', 'Sala 12'],
      [vinculos[0]?.id, escola.anoId, 3, '09:00', '09:50', null],
    ])
    const criados = await auditoriaDa(escola.escolaId, 'vinculo.criado')
    expect(criados).toEqual([expect.objectContaining({ entidade_id: vinculos[0]?.id, autor_usuario_id: escola.coordenadorId, depois: { usuarioId: ana.usuarioId, turmaId, disciplinaId: quimica, papel: 'professor', estado: 'pendente', origem: 'grade' } })])
    const [gravada] = await auditoriaDa(escola.escolaId, 'planilha.gravada')
    expect(gravada?.depois).toEqual({ tipo: 'grade', contagens: resumo })
    expect(gravada?.autor_usuario_id).toBe(escola.coordenadorId)
    expect(JSON.stringify([criados, gravada])).not.toMatch(/Ana|Souza|professores\.invalid/)
  })

  it('professor em duas turmas no mesmo horário: aviso nas duas linhas, e a grade grava as duas aulas', async () => {
    const escola = await escolaNova()
    await turmaNa(escola, '8º A')
    await turmaNa(escola, '8º B')
    await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const texto = planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50'), aula('8B', 'Química', 'Ana Souza', ana.email, '1', '8:30', '9:20'))

    const lida = await previa(escola, texto)
    expect(lida.linhas.map(({ resultado, aviso }) => [resultado, aviso])).toEqual([
      ['entra', 'professor_em_duas_turmas'],
      ['entra', 'professor_em_duas_turmas'],
    ])
    const id = await gravar(escola, texto)
    await tentar(escola.escolaId, id)

    expect((await importacao(id)).estado).toBe('concluida')
    expect(await aulasDa(escola.escolaId)).toHaveLength(2)
    expect(await vinculosDa(escola)).toHaveLength(2)
  })

  it('turma com duas aulas no mesmo horário: aviso nas duas linhas, e a grade grava as duas aulas (a turma dividida)', async () => {
    const escola = await escolaNova()
    await turmaNa(escola, '8º A')
    await disciplinaNa(escola, 'Química')
    await disciplinaNa(escola, 'Física')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const bruno = await professorNaEscola(escola, 'Bruno Lima')
    const texto = planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '2', '10:00', '10:50'), aula('8A', 'Física', 'Bruno Lima', bruno.email, '2', '10:00', '10:50'))

    const lida = await previa(escola, texto)
    expect(lida.linhas.map(({ resultado, aviso }) => [resultado, aviso])).toEqual([
      ['entra', 'turma_com_duas_aulas'],
      ['entra', 'turma_com_duas_aulas'],
    ])
    const id = await gravar(escola, texto)
    await tentar(escola.escolaId, id)

    expect((await importacao(id)).estado).toBe('concluida')
    expect(await aulasDa(escola.escolaId)).toHaveLength(2)
  })

  it('aula das 9h às 8h é erro na prévia, e o gravar recusa a planilha sem criar importação nem nada', async () => {
    const escola = await escolaNova()
    await turmaNa(escola, '8º A')
    await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const texto = planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '9:00', '8:00'))

    const lida = await previa(escola, texto)
    expect(lida.linhas.map(({ resultado, erro }) => [resultado, erro])).toEqual([['erro', 'fim_antes_do_inicio']])
    await expect(gravar(escola, texto)).rejects.toMatchObject({ codigo: ErrorCode.ENTRADA_INVALIDA })

    expect(await contar('importacao_planilha', escola.escolaId)).toBe(0)
    expect(await aulasDa(escola.escolaId)).toEqual([])
    expect(await vinculosDa(escola)).toEqual([])
  })

  it('linha sem professor é erro na prévia, e o gravar recusa a planilha: nenhuma aula entra sem professor', async () => {
    const escola = await escolaNova()
    await turmaNa(escola, '8º A')
    await disciplinaNa(escola, 'Química')
    const texto = planilha(aula('8A', 'Química', '', '', '1', '8:00', '8:50'))

    const lida = await previa(escola, texto)
    expect(lida.linhas.map(({ resultado, erro }) => [resultado, erro])).toEqual([['erro', 'sem_professor']])
    await expect(gravar(escola, texto)).rejects.toMatchObject({ codigo: ErrorCode.ENTRADA_INVALIDA })

    expect(await aulasDa(escola.escolaId)).toEqual([])
    expect(await vinculosDa(escola)).toEqual([])
  })

  it('o professor com duas disciplinas na mesma turma tem dois vínculos pendentes, um por disciplina, e cada aula no seu', async () => {
    const escola = await escolaNova()
    const turmaId = await turmaNa(escola, '8º A')
    const quimica = await disciplinaNa(escola, 'Química')
    const fisica = await disciplinaNa(escola, 'Física')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50'), aula('8A', 'Física', 'Ana Souza', ana.email, '1', '9:00', '9:50')))

    await tentar(escola.escolaId, id)

    const vinculos = await vinculosDa(escola)
    expect(vinculos.map(({ turma_id, disciplina_id, estado, origem }) => [turma_id, disciplina_id, estado, origem]).sort()).toEqual(
      [
        [turmaId, quimica, 'pendente', 'grade'],
        [turmaId, fisica, 'pendente', 'grade'],
      ].sort(),
    )
    const doVinculo = new Map(vinculos.map(({ id: vinculoId, disciplina_id }) => [vinculoId, disciplina_id]))
    expect((await aulasDa(escola.escolaId)).map(({ vinculo_id, inicio }) => [doVinculo.get(vinculo_id), inicio])).toEqual([
      [quimica, '08:00'],
      [fisica, '09:00'],
    ])
  })

  it('turma, disciplina e professor que a escola não tem são "novo" na prévia e nascem ao gravar: a turma na série do nome, o professor `pendente` com convite, e o vínculo pendente da grade', async () => {
    const escola = await escolaNova()
    const email = emailDe('novo')
    const texto = planilha(aula('8C', 'Geografia', 'Novo Professor', email, 'terça', '10:00', '10:50', 'Lab 2'))

    const lida = await previa(escola, texto)
    expect(lida.linhas.map(({ resultado }) => resultado)).toEqual(['novo'])
    expect(lida.contagens).toMatchObject({ aulas: 1, turmas_novas: 1, disciplinas_novas: 1, professores_novos: 1, vinculos_criados: 1 })
    const id = await gravar(escola, texto)
    await tentar(escola.escolaId, id)

    expect(await importacao(id)).toMatchObject({ estado: 'concluida', resumo: { aulas: 1, ja_existem: 0, turmas_novas: 1, disciplinas_novas: 1, professores_novos: 1, vinculos_criados: 1 } })
    const { rows: turmas } = await bancada.pool.query<{ id: string; chave: string; serie_id: string }>('select id, chave, serie_id from turma where escola_id = $1 and ano_letivo_id = $2', [escola.escolaId, escola.anoId])
    expect(turmas).toEqual([{ id: expect.any(String), chave: '8c', serie_id: escola.serieId }])
    const { rows: disciplinas } = await bancada.pool.query<{ id: string; nome: string }>('select id, nome from disciplina where escola_id = $1', [escola.escolaId])
    expect(disciplinas).toEqual([{ id: expect.any(String), nome: 'Geografia' }])
    const professor = await professorDe(escola.escolaId, email)
    expect(professor).toMatchObject({ nome: 'Novo Professor', ativo: false, convitesEmAberto: 1 })
    expect(await vinculosDa(escola)).toEqual([expect.objectContaining({ usuario_id: professor?.id, turma_id: turmas[0]?.id, disciplina_id: disciplinas[0]?.id, estado: 'pendente', origem: 'grade' })])
    expect(await aulasDa(escola.escolaId)).toEqual([expect.objectContaining({ dia_semana: 2, inicio: '10:00', fim: '10:50', sala: 'Lab 2' })])
    expect(await auditoriaDa(escola.escolaId, 'turma.criada')).toHaveLength(1)
    expect(await auditoriaDa(escola.escolaId, 'convite.criado')).toHaveLength(1)
    expect(JSON.stringify(await auditoriaDa(escola.escolaId, 'convite.criado'))).not.toMatch(/Novo Professor|professores\.invalid/)
  })

  it('dois professores novos com o mesmo nome e e-mails diferentes viram duas pessoas, cada uma com o seu convite e o seu vínculo: o professor se identifica pelo e-mail', async () => {
    const escola = await escolaNova()
    const turmaId = await turmaNa(escola, '8º A')
    const quimica = await disciplinaNa(escola, 'Química')
    const [um, dois] = [emailDe('ana-um'), emailDe('ana-dois')]
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', um, '1', '8:00', '8:50'), aula('8A', 'Química', 'Ana Souza', dois, '2', '8:00', '8:50')))

    await tentar(escola.escolaId, id)

    const [primeira, segunda] = [await professorDe(escola.escolaId, um), await professorDe(escola.escolaId, dois)]
    expect(primeira?.id).toBeDefined()
    expect(segunda?.id).toBeDefined()
    expect(primeira?.id).not.toBe(segunda?.id)
    expect([primeira?.convitesEmAberto, segunda?.convitesEmAberto]).toEqual([1, 1])
    expect((await vinculosDa(escola)).map(({ usuario_id, turma_id, disciplina_id }) => [usuario_id, turma_id, disciplina_id]).sort()).toEqual(
      [[primeira?.id, turmaId, quimica], [segunda?.id, turmaId, quimica]].sort(),
    )
    expect(await aulasDa(escola.escolaId)).toHaveLength(2)
  })

  it('o professor `desativado` volta pela grade com o mesmo usuário e o convite novo, e recebe o vínculo pendente', async () => {
    const escola = await escolaNova()
    const turmaId = await turmaNa(escola, '8º A')
    const quimica = await disciplinaNa(escola, 'Química')
    const volta = await professorNaEscola(escola, 'Volta Pela Grade', false)
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Volta Pela Grade', volta.email, '4', '7:30', '8:20')))

    await tentar(escola.escolaId, id)

    expect((await importacao(id)).estado).toBe('concluida')
    expect(await professorDe(escola.escolaId, volta.email)).toMatchObject({ id: volta.usuarioId, ativo: false, convitesEmAberto: 1 })
    expect(await vinculosDa(escola)).toEqual([expect.objectContaining({ usuario_id: volta.usuarioId, turma_id: turmaId, disciplina_id: quimica, estado: 'pendente', origem: 'grade' })])
  })

  it('antes de confirmar, o professor não alcança a turma; confirmado o vínculo da grade, alcança', async () => {
    const escola = await escolaNova()
    const turmaId = await turmaNa(escola, '8º A')
    await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50')))
    await tentar(escola.escolaId, id)
    const [vinculo] = await vinculosDa(escola)

    expect(await alcancaATurma(escola, ana.usuarioId, escola.anoId, turmaId)).toBe(false)
    expect(await confirmar(escola, ana.usuarioId, escola.anoId, vinculo?.id ?? '')).toBe(true)

    expect(await alcancaATurma(escola, ana.usuarioId, escola.anoId, turmaId)).toBe(true)
    expect((await vinculosDa(escola)).map(({ estado }) => estado)).toEqual(['confirmado'])
  })

  it('o vínculo confirmado não muda: a grade só põe a aula nele, sem outro vínculo e sem tocar a decisão', async () => {
    const escola = await escolaNova()
    const turmaId = await turmaNa(escola, '8º A')
    const quimica = await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const confirmado = await vinculoNaMao(escola, ana.usuarioId, turmaId, quimica, 'confirmado')
    const antes = (await vinculosDa(escola))[0]
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '5', '13:00', '13:50')))

    await tentar(escola.escolaId, id)

    expect(await importacao(id)).toMatchObject({ estado: 'concluida', resumo: { aulas: 1, vinculos_criados: 0 } })
    expect(await vinculosDa(escola)).toEqual([antes])
    expect((await aulasDa(escola.escolaId)).map(({ vinculo_id }) => vinculo_id)).toEqual([confirmado])
    expect(await auditoriaDa(escola.escolaId, 'vinculo.criado')).toEqual([])
  })

  it('o vínculo feito à mão com a mesma tripla é reaproveitado, sem pendente duplicado, e continua de origem `coordenacao`', async () => {
    const escola = await escolaNova()
    const turmaId = await turmaNa(escola, '8º A')
    const quimica = await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const naMao = await vinculoNaMao(escola, ana.usuarioId, turmaId, quimica, 'pendente')
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50')))

    await tentar(escola.escolaId, id)

    expect(await vinculosDa(escola)).toEqual([expect.objectContaining({ id: naMao, estado: 'pendente', origem: 'coordenacao' })])
    expect((await aulasDa(escola.escolaId)).map(({ vinculo_id }) => vinculo_id)).toEqual([naMao])
  })

  it('o vínculo encerrado com a mesma tripla não reabre: nasce um pendente da grade, e o encerrado fica como está', async () => {
    const escola = await escolaNova()
    const turmaId = await turmaNa(escola, '8º A')
    const quimica = await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const encerrado = await vinculoNaMao(escola, ana.usuarioId, turmaId, quimica, 'encerrado')
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50')))

    await tentar(escola.escolaId, id)

    const vinculos = await vinculosDa(escola)
    expect(vinculos.map(({ id: vinculoId, estado, origem }) => [vinculoId === encerrado, estado, origem]).sort()).toEqual([
      [false, 'pendente', 'grade'],
      [true, 'encerrado', 'coordenacao'],
    ])
    const novo = vinculos.find(({ id: vinculoId }) => vinculoId !== encerrado)
    expect((await aulasDa(escola.escolaId)).map(({ vinculo_id }) => vinculo_id)).toEqual([novo?.id])
  })

  it('a mesma tripla com um vínculo encerrado e outro aberto: a aula vai para o aberto, e nenhum vínculo nasce', async () => {
    const escola = await escolaNova()
    const turmaId = await turmaNa(escola, '8º A')
    const quimica = await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    await vinculoNaMao(escola, ana.usuarioId, turmaId, quimica, 'encerrado')
    const aberto = await vinculoNaMao(escola, ana.usuarioId, turmaId, quimica, 'confirmado')
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50')))

    await tentar(escola.escolaId, id)

    expect(await vinculosDa(escola)).toHaveLength(2)
    expect((await aulasDa(escola.escolaId)).map(({ vinculo_id }) => vinculo_id)).toEqual([aberto])
  })

  it('reimportar não reabre o contestado: o vínculo segue contestado, com a aula, e nenhum pendente nasce', async () => {
    const escola = await escolaNova()
    const turmaId = await turmaNa(escola, '8º A')
    const quimica = await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const contestado = await vinculoNaMao(escola, ana.usuarioId, turmaId, quimica, 'contestado')
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50')))

    await tentar(escola.escolaId, id)

    expect(await vinculosDa(escola)).toEqual([expect.objectContaining({ id: contestado, estado: 'contestado' })])
    expect((await aulasDa(escola.escolaId)).map(({ vinculo_id }) => vinculo_id)).toEqual([contestado])
  })

  it('a aula que já existe muda de fim e de sala e mantém o id; a mesma planilha de novo é "já existe" e não escreve nada', async () => {
    const escola = await escolaNova()
    await turmaNa(escola, '8º A')
    await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    await tentar(escola.escolaId, await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50', 'Sala 1'))))
    const [primeira] = await aulasDa(escola.escolaId)

    const mudada = planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:55', 'Sala 2'))
    expect((await previa(escola, mudada)).linhas.map(({ resultado }) => resultado)).toEqual(['entra'])
    const idDaMudanca = await gravar(escola, mudada)
    await tentar(escola.escolaId, idDaMudanca)

    expect(await importacao(idDaMudanca)).toMatchObject({ estado: 'concluida', resumo: { aulas: 1, ja_existem: 0, vinculos_criados: 0 } })
    expect(await aulasDa(escola.escolaId)).toEqual([{ ...primeira, fim: '08:55', sala: 'Sala 2' }])
    expect(await vinculosDa(escola)).toHaveLength(1)

    const idDoIgual = await gravar(escola, mudada)
    await tentar(escola.escolaId, idDoIgual)

    expect(await importacao(idDoIgual)).toMatchObject({ estado: 'concluida', resumo: { aulas: 0, ja_existem: 1 } })
    expect(await aulasDa(escola.escolaId)).toEqual([{ ...primeira, fim: '08:55', sala: 'Sala 2' }])
  })

  it('o job executado duas vezes grava uma vez: a segunda chamada acha a importação já `concluida` e não duplica vínculo nem aula', async () => {
    const escola = await escolaNova()
    await turmaNa(escola, '8º A')
    await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50')))

    await tentar(escola.escolaId, id)
    await tentar(escola.escolaId, id)

    expect((await importacao(id)).estado).toBe('concluida')
    expect(await vinculosDa(escola)).toHaveLength(1)
    expect(await aulasDa(escola.escolaId)).toHaveLength(1)
    expect(await auditoriaDa(escola.escolaId, 'vinculo.criado')).toHaveLength(1)
  })

  it('[P] duas execuções do mesmo job, a segunda depois de classificar e antes de gravar: um vínculo, uma aula, uma `concluida` e uma `ignorada`', async () => {
    const escola = await escolaNova()
    await turmaNa(escola, '8º A')
    await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50')))
    const antes = await resultados()
    const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'alocacao', evento: 'insert', quando: `new.escola_id = '${escola.escolaId}'::uuid` })
    await parada.armar()
    try {
      const primeira = tentar(escola.escolaId, id)
      await parada.esperarParadas()
      // A segunda lê a importação ainda `na_fila`, classifica e espera a trava `for update` que a primeira segura.
      const segunda = tentar(escola.escolaId, id)
      await esperarNaTrava(bancada.pool, '%importacao_planilha%for update%')
      await parada.soltar()
      await Promise.all([primeira, segunda])
    } finally {
      await parada.desarmar()
    }

    expect((await importacao(id)).estado).toBe('concluida')
    expect(await vinculosDa(escola)).toHaveLength(1)
    expect(await aulasDa(escola.escolaId)).toHaveLength(1)
    expect(await auditoriaDa(escola.escolaId, 'vinculo.criado')).toHaveLength(1)
    expect(await auditoriaDa(escola.escolaId, 'planilha.gravada')).toHaveLength(1)
    const depois = await resultados()
    expect((depois['concluida'] ?? 0) - (antes['concluida'] ?? 0)).toBe(1)
    expect((depois['ignorada'] ?? 0) - (antes['ignorada'] ?? 0)).toBe(1)
  })

  it('isolamento: o professor de outra escola com o mesmo e-mail não recebe vínculo nem aula da grade desta; ele aparece "novo" aqui, e a outra escola não muda', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    await turmaNa(a, '8º A')
    await disciplinaNa(a, 'Química')
    const turmaDeB = await turmaNa(b, '8º A')
    const quimicaDeB = await disciplinaNa(b, 'Química')
    const deB = await professorNaEscola(b, 'Ana Souza')
    const vinculoDeB = await vinculoNaMao(b, deB.usuarioId, turmaDeB, quimicaDeB, 'confirmado')
    const id = await gravar(a, planilha(aula('8A', 'Química', 'Ana Souza', deB.email, '1', '8:00', '8:50')))

    await tentar(a.escolaId, id)

    expect(await importacao(id)).toMatchObject({ estado: 'concluida', resumo: { professores_novos: 1, vinculos_criados: 1 } })
    const doProfessorNaA = await professorDe(a.escolaId, deB.email)
    expect(doProfessorNaA).toMatchObject({ ativo: false, convitesEmAberto: 1 })
    expect(doProfessorNaA?.id).not.toBe(deB.usuarioId)
    expect(await vinculosDa(a)).toEqual([expect.objectContaining({ usuario_id: doProfessorNaA?.id, estado: 'pendente' })])
    expect(await aulasDa(b.escolaId)).toEqual([])
    expect(await vinculosDa(b)).toEqual([expect.objectContaining({ id: vinculoDeB, estado: 'confirmado' })])
    expect(await aulasDa(a.escolaId)).toHaveLength(1)
    expect(await professorDe(b.escolaId, deB.email)).toMatchObject({ id: deB.usuarioId, ativo: true })
  })

  it('isolamento no repository: no contexto da escola A, o ano, as aulas, os vínculos e as disciplinas da B não são lidos, nem pelo id do ano da B; e as aulas de um ano não são lidas pelo id de outro', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const planejadoDeA = await anoPlanejado(a)
    await turmaNa(b, '8º A')
    await disciplinaNa(b, 'Química')
    const deB = await professorNaEscola(b, 'Ana Souza')
    await tentar(b.escolaId, await gravar(b, planilha(aula('8A', 'Química', 'Ana Souza', deB.email, '1', '8:00', '8:50'))))
    await turmaNa(a, '8º A')
    await disciplinaNa(a, 'Física')
    const deA = await professorNaEscola(a, 'Bia Lima')
    await tentar(a.escolaId, await gravar(a, planilha(aula('8A', 'Física', 'Bia Lima', deA.email, '2', '9:00', '9:50'))))
    expect(await vinculosDa(b)).toHaveLength(1)
    expect(await aulasDa(b.escolaId)).toHaveLength(1)
    expect(await aulasDa(a.escolaId)).toHaveLength(1)

    const lidoPelaA = await runInContext(contextoDa(a), async () => {
      const repositorio = new ImportacaoRepository(bancada.banco)
      return {
        aulasDaB: await repositorio.aulasDoAno(b.anoId),
        vinculosDaB: await repositorio.vinculosDeProfessorDoAno(b.anoId),
        aulasDoPlanejado: await repositorio.aulasDoAno(planejadoDeA),
        aulasDoAnoEmCurso: await repositorio.aulasDoAno(a.anoId),
        disciplinas: await repositorio.disciplinasDaEscola(),
      }
    })

    expect(lidoPelaA.aulasDaB).toEqual([])
    expect(lidoPelaA.vinculosDaB).toEqual([])
    expect(lidoPelaA.aulasDoPlanejado).toEqual([])
    expect(lidoPelaA.aulasDoAnoEmCurso).toHaveLength(1)
    expect(lidoPelaA.disciplinas.map(({ nome }) => nome)).toEqual(['Física'])
  })

  it('isolamento no upsert da `alocacao`: gravar, no contexto da escola A, uma aula na chave (vínculo, dia, início) da B não muda o fim nem a sala da aula da B, e não a conta', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    await turmaNa(b, '8º A')
    await disciplinaNa(b, 'Química')
    const deB = await professorNaEscola(b, 'Ana Souza')
    await tentar(b.escolaId, await gravar(b, planilha(aula('8A', 'Química', 'Ana Souza', deB.email, '1', '8:00', '8:50', 'Sala da B'))))
    const aulaDaB = (await aulasDa(b.escolaId))[0]
    expect(aulaDaB).toMatchObject({ dia_semana: 1, inicio: '08:00', fim: '08:50', sala: 'Sala da B' })

    const escritas = await runInContext(contextoDa(a), () =>
      new ImportacaoRepository(bancada.banco).gravarAulas(a.anoId, [{ vinculoId: aulaDaB?.vinculo_id ?? '', diaSemana: 1, inicio: '08:00', fim: '09:30', sala: 'Invasora' }]),
    )

    expect(escritas).toBe(0)
    expect(await aulasDa(b.escolaId)).toEqual([aulaDaB])
    expect(await aulasDa(a.escolaId)).toEqual([])
  })

  it('o ano planejado: o vínculo pendente dele o professor não vê nem confirma; com o ano em curso, confirma, e as aulas do ano em curso não mudam', async () => {
    const escola = await escolaNova()
    const planejado = await anoPlanejado(escola)
    const turma26 = await turmaNa(escola, '8º A')
    const turma27 = await turmaNa(escola, '8º A', planejado)
    const quimica = await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    await tentar(escola.escolaId, await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50'))))
    const aulasDe26 = await aulasDa(escola.escolaId)

    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '4', '10:00', '10:50')), planejado)
    await tentar(escola.escolaId, id)

    expect(await importacao(id)).toMatchObject({ estado: 'concluida', resumo: { aulas: 1, vinculos_criados: 1 } })
    const vinculo27 = (await vinculosDa(escola)).find(({ ano_letivo_id }) => ano_letivo_id === planejado)
    expect(vinculo27).toMatchObject({ turma_id: turma27, disciplina_id: quimica, estado: 'pendente', origem: 'grade' })
    expect((await aulasDa(escola.escolaId)).filter(({ ano_letivo_id }) => ano_letivo_id === escola.anoId)).toEqual(aulasDe26)
    expect((await aulasDa(escola.escolaId)).filter(({ ano_letivo_id }) => ano_letivo_id === planejado)).toEqual([expect.objectContaining({ vinculo_id: vinculo27?.id, dia_semana: 4, inicio: '10:00' })])
    // Com o 2026 em curso, o professor não alcança o vínculo do planejado: não o confirma, e a turma de 2027 não é dele.
    expect(await vinculosQueVe(escola, ana.usuarioId, escola.anoId)).not.toContain(vinculo27?.id)
    expect(await confirmar(escola, ana.usuarioId, escola.anoId, vinculo27?.id ?? '')).toBe(false)
    expect(await alcancaATurma(escola, ana.usuarioId, escola.anoId, turma27)).toBe(false)
    expect((await vinculosDa(escola)).find(({ id: vinculoId }) => vinculoId === vinculo27?.id)?.estado).toBe('pendente')

    // A virada: 2026 encerra e 2027 entra em curso.
    await bancada.pool.query("update ano_letivo set situacao = 'encerrado' where id = $1", [escola.anoId])
    await bancada.pool.query("update ano_letivo set situacao = 'em_curso' where id = $1", [planejado])

    // Com o 2027 em curso, o vínculo aparece na lista dela, ainda `pendente`: só o confirmar dela o muda.
    const vistos = await comoProfessor(escola, ana.usuarioId, planejado, () => bancada.banco.transaction((tx) => new VinculoRepository(tx).listarDoUsuario({ limite: 50 })))
    expect(vistos.find(({ id }) => id === vinculo27?.id)).toMatchObject({ estado: 'pendente', turma: { id: turma27 } })
    expect(await confirmar(escola, ana.usuarioId, planejado, vinculo27?.id ?? '')).toBe(true)
    expect(await alcancaATurma(escola, ana.usuarioId, planejado, turma27)).toBe(true)
    expect(await alcancaATurma(escola, ana.usuarioId, planejado, turma26)).toBe(false)
  })

  it('a planilha da grade não toca o ano em curso quando o destino é o planejado: nem turma, nem vínculo, nem aula do 2026', async () => {
    const escola = await escolaNova()
    const planejado = await anoPlanejado(escola)
    await turmaNa(escola, '8º A', planejado)
    await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')

    await tentar(escola.escolaId, await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50')), planejado))

    expect((await bancada.pool.query<{ total: number }>('select count(*)::int as total from turma where escola_id = $1 and ano_letivo_id = $2', [escola.escolaId, escola.anoId])).rows[0]?.total).toBe(0)
    expect((await vinculosDa(escola)).every(({ ano_letivo_id }) => ano_letivo_id === planejado)).toBe(true)
    expect((await aulasDa(escola.escolaId)).every(({ ano_letivo_id }) => ano_letivo_id === planejado)).toBe(true)
  })

  /** Segura a trava da importação, deixa o job passar pelos passos (1) e (2), faz `mexer` com o job parado no (3), e solta. */
  async function mexerEntreOs(escola: Escola, importacaoId: string, mexer: (segurador: { query: (texto: string, parametros?: unknown[]) => Promise<unknown> }) => Promise<void>): Promise<void> {
    const segurador = await bancada.pool.connect()
    let tentativa: Promise<void>
    try {
      await segurador.query('begin')
      await segurador.query('select id from importacao_planilha where id = $1 for update', [importacaoId])
      tentativa = tentar(escola.escolaId, importacaoId)
      await esperarNaTrava(bancada.pool, '%importacao_planilha%for update%')
      await mexer(segurador)
      await segurador.query('commit')
    } finally {
      segurador.release()
    }
    await tentativa
  }

  it('[P] o vínculo reaproveitado encerrado à mão entre o passo (2) e o (3): `desatualizada`, e nenhuma alocação em vínculo encerrado', async () => {
    const escola = await escolaNova()
    const turmaId = await turmaNa(escola, '8º A')
    const quimica = await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const vinculoId = await vinculoNaMao(escola, ana.usuarioId, turmaId, quimica, 'confirmado')
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50')))

    await mexerEntreOs(escola, id, async (segurador) => {
      await segurador.query("update vinculo set estado = 'encerrado', motivo_encerramento = 'desligamento', encerrado_em = now() where id = $1", [vinculoId])
    })

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada' })
    expect(await aulasDa(escola.escolaId)).toEqual([])
    expect(await vinculosDa(escola)).toEqual([expect.objectContaining({ id: vinculoId, estado: 'encerrado' })])
    expect(await auditoriaDa(escola.escolaId, 'planilha.gravada')).toEqual([])
  })

  it('[P] vínculo à mão com a mesma tripla criado entre o passo (2) e o (3): `desatualizada` na mesma execução, sem pendente duplicado e sem aula', async () => {
    const escola = await escolaNova()
    const turmaId = await turmaNa(escola, '8º A')
    const quimica = await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50')))

    await mexerEntreOs(escola, id, async (segurador) => {
      await segurador.query(
        "insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por) values ($1, $2, $3, $4, $5, 'professor', 'pendente', $6)",
        [escola.escolaId, escola.anoId, ana.usuarioId, turmaId, quimica, escola.coordenadorId],
      )
    })

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada' })
    expect(await vinculosDa(escola)).toEqual([expect.objectContaining({ origem: 'coordenacao', estado: 'pendente' })])
    expect(await aulasDa(escola.escolaId)).toEqual([])
  })

  it('[P] o vínculo à mão da mesma tripla entra depois da releitura do passo (3) e antes do insert da grade: o único viola (23505), e a mesma execução vira `desatualizada`, sem nada da grade', async () => {
    const escola = await escolaNova()
    const turmaId = await turmaNa(escola, '8º A')
    const quimica = await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    // A linha da Física cria a disciplina antes dos vínculos: o job para nesse insert, já com a releitura feita e as travas na mão.
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50'), aula('8A', 'Física', 'Ana Souza', ana.email, '2', '8:00', '8:50')))
    const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'disciplina', evento: 'insert', quando: `new.escola_id = '${escola.escolaId}'::uuid` })
    await gatilho.armar()
    try {
      const tentativa = tentar(escola.escolaId, id)
      await gatilho.esperarParadas()
      await bancada.pool.query(
        "insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por) values ($1, $2, $3, $4, $5, 'professor', 'pendente', $6)",
        [escola.escolaId, escola.anoId, ana.usuarioId, turmaId, quimica, escola.coordenadorId],
      )
      await gatilho.soltar()
      await tentativa
    } finally {
      await gatilho.desarmar()
    }

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada' })
    expect(await vinculosDa(escola)).toEqual([expect.objectContaining({ origem: 'coordenacao', estado: 'pendente' })])
    expect(await aulasDa(escola.escolaId)).toEqual([])
    expect(await contar('disciplina', escola.escolaId)).toBe(1)
    expect(await auditoriaDa(escola.escolaId, 'planilha.gravada')).toEqual([])
  })

  it('[P] o professor da grade desativado entre o passo (2) e o (3): `desatualizada`, sem vínculo, sem aula e sem convite', async () => {
    const escola = await escolaNova()
    await turmaNa(escola, '8º A')
    await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50')))

    await mexerEntreOs(escola, id, async (segurador) => {
      await segurador.query('update usuario set desativado_em = now() where id = $1', [ana.usuarioId])
    })

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada' })
    expect(await vinculosDa(escola)).toEqual([])
    expect(await aulasDa(escola.escolaId)).toEqual([])
    expect(await contar('convite', escola.escolaId)).toBe(0)
  })

  /** Duas turmas, o professor nas duas, e a planilha que as toca: o que as corridas com o `desativar` usam. */
  async function professorEmDuasTurmas(): Promise<{ escola: Escola; ana: Pessoa; turmas: string[]; quimica: string; texto: string }> {
    const escola = await escolaNova()
    const turmas = [await turmaNa(escola, '8º A'), await turmaNa(escola, '8º B')]
    const quimica = await disciplinaNa(escola, 'Química')
    const ana = await professorNaEscola(escola, 'Ana Souza')
    const texto = planilha(aula('8A', 'Química', 'Ana Souza', ana.email, '1', '8:00', '8:50'), aula('8B', 'Química', 'Ana Souza', ana.email, '2', '8:00', '8:50'))
    return { escola, ana, turmas, quimica, texto }
  }

  it('o passo (3) trava as turmas que a grade toca num único `for no key update` em ordem de id, depois do convite, do ano e dos usuários, e antes de escrever o vínculo', async () => {
    const { escola, ana, turmas, texto } = await professorEmDuasTurmas()
    const id = await gravar(escola, texto)
    const sql: string[] = []
    const parametros: unknown[][] = []
    const espiado = drizzle({
      client: apoio,
      schema,
      casing: 'snake_case',
      logger: {
        logQuery: (consulta: string, valores: unknown[]) => {
          sql.push(consulta.toLowerCase())
          parametros.push(valores)
        },
      },
    }) as unknown as Database
    const espiao = criarGravacaoDaPlanilha({ banco: espiado, logger: log.logger })

    await tentar(escola.escolaId, id, 1, espiao)

    const posicao = (padrao: RegExp): number => sql.findIndex((consulta) => padrao.test(consulta))
    const travasDeTurma = sql.filter((consulta) => /^select .*from "turma".* for no key update$/.test(consulta))
    expect(travasDeTurma).toHaveLength(1)
    expect(travasDeTurma[0]).toMatch(/order by "turma"\."id" asc for no key update$/)
    const daTurma = posicao(/^select .*from "turma".* for no key update$/)
    expect(parametros[daTurma]).toEqual(expect.arrayContaining([escola.escolaId, ...turmas]))
    expect(sql[posicao(/^select .*from "usuario".* for no key update$/)]).toMatch(/order by "usuario"\."id" asc for no key update$/)
    expect(posicao(/^select .*from "importacao_planilha".* for update$/)).toBeLessThan(posicao(/pg_advisory_xact_lock/))
    expect(posicao(/pg_advisory_xact_lock/)).toBeLessThan(posicao(/^select .*from "ano_letivo".* for share$/))
    expect(posicao(/^select .*from "ano_letivo".* for share$/)).toBeLessThan(posicao(/^select .*from "usuario".* for no key update$/))
    expect(posicao(/^select .*from "usuario".* for no key update$/)).toBeLessThan(daTurma)
    expect(daTurma).toBeLessThan(posicao(/^insert into "vinculo"/))
    expect(daTurma).toBeLessThan(posicao(/^insert into "alocacao"/))
    expect(await importacao(id)).toMatchObject({ estado: 'concluida' })
    expect((await vinculosDa(escola)).map(({ usuario_id }) => usuario_id)).toEqual([ana.usuarioId, ana.usuarioId])
  })

  it('[P] T1 e T2 contra o `desativar` do professor das duas, com barreira: o `desativar` espera a grade, zero `40P01`, e nenhum vínculo do professor fica aberto', async () => {
    const { escola, ana, turmas, quimica, texto } = await professorEmDuasTurmas()
    // O vínculo dela já existe na turma de id maior (a B): o `desativar` encerra a B, e o job trava A e B em ordem de id. Os dois lados
    // tocam as turmas em ordem inversa à do vínculo; a espera do `desativar` na trava do usuário é o que impede o `40P01`.
    await vinculoNaMao(escola, ana.usuarioId, turmas[1] ?? '', quimica, 'confirmado')
    const id = await gravar(escola, texto)
    const ciclo = new CicloDeVidaService(bancoDoJob)
    // O job para na primeira aula que escreve: ele já tem o ano, o usuário e as duas turmas travados.
    const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'alocacao', evento: 'insert', quando: `new.escola_id = '${escola.escolaId}'::uuid` })
    await gatilho.armar()
    let tentativa: Promise<void>
    let desativado: unknown
    try {
      tentativa = tentar(escola.escolaId, id)
      await gatilho.esperarParadas()
      const desativando = runInContext({ requisicaoId: randomUUID(), escolaId: escola.escolaId, usuarioId: escola.coordenadorId, papel: 'coordenador' }, () => ciclo.desativar(ana.usuarioId)).then(
        () => 'desativado',
        (erro: unknown) => erro,
      )
      await esperarNaTrava(bancada.pool, '%"usuario"%for no key update%')
      await gatilho.soltar()
      desativado = (await Promise.all([tentativa, desativando]))[1]
    } finally {
      await gatilho.desarmar()
    }

    expect(desativado).toBe('desativado')
    expect(await importacao(id)).toMatchObject({ estado: 'concluida', erro: null })
    const vinculos = await vinculosDa(escola)
    expect(vinculos).toHaveLength(2)
    expect(vinculos.map(({ estado }) => estado)).toEqual(['encerrado', 'encerrado'])
    expect((await bancada.pool.query<{ ativo: boolean }>('select desativado_em is null as ativo from usuario where id = $1', [ana.usuarioId])).rows[0]?.ativo).toBe(false)
  })

  it('a trava do convite da escola: com ela na mão de outra operação, o passo (3) espera, estoura o `lock_timeout` e volta; solta, a tentativa seguinte conclui', async () => {
    const escola = await escolaNova()
    await turmaNa(escola, '8º A')
    await disciplinaNa(escola, 'Química')
    const email = emailDe('espera-o-convite')
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Espera Convite', email, '1', '8:00', '8:50')))
    const segurador = await bancada.pool.connect()
    try {
      await segurador.query('begin')
      await segurador.query('select pg_advisory_xact_lock($1, hashtext($2::uuid::text))', [CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA, escola.escolaId])
      await expect(tentar(escola.escolaId, id, 1)).rejects.toSatisfy(ehFalhaDeTrava)
      expect((await importacao(id)).estado).toBe('na_fila')
      expect(await aulasDa(escola.escolaId)).toEqual([])
    } finally {
      await segurador.query('rollback')
      segurador.release()
    }

    await tentar(escola.escolaId, id, 2)

    expect((await importacao(id)).estado).toBe('concluida')
    expect(await professorDe(escola.escolaId, email)).toMatchObject({ ativo: false, convitesEmAberto: 1 })
  })

  it('[P] o expurgo de acesso limpa a conta do professor novo entre o passo (1) e o (3): a tentativa volta sem gravar nada, e a nova tentativa refaz o (1)', async () => {
    const escola = await escolaNova()
    await turmaNa(escola, '8º A')
    await disciplinaNa(escola, 'Química')
    const email = emailDe('limpa-no-meio')
    const contaId = (await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [email])).rows[0]?.id ?? ''
    const id = await gravar(escola, planilha(aula('8A', 'Química', 'Conta Limpa', email, '1', '8:00', '8:50')))
    const segurador = await bancada.pool.connect()
    let primeira: Promise<void>
    try {
      await segurador.query('begin')
      await segurador.query('select id from importacao_planilha where id = $1 for update', [id])
      primeira = tentar(escola.escolaId, id, 1)
      await esperarNaTrava(bancada.pool, '%importacao_planilha%for update%')
      await segurador.query('update conta set email = null where id = $1', [contaId])
      await segurador.query('commit')
    } finally {
      segurador.release()
    }

    await expect(primeira).rejects.toBeInstanceOf(ContaDaPlanilhaPerdidaError)
    expect((await importacao(id)).estado).toBe('na_fila')
    expect(await aulasDa(escola.escolaId)).toEqual([])
    expect(await contar('convite', escola.escolaId)).toBe(0)

    await tentar(escola.escolaId, id, 2)

    expect((await importacao(id)).estado).toBe('concluida')
    expect(await professorDe(escola.escolaId, email)).toMatchObject({ ativo: false, convitesEmAberto: 1 })
    expect(await vinculosDa(escola)).toHaveLength(1)
  })

  it('falha no segundo lote de 1.200 linhas: zero turmas, disciplinas, professores, vínculos e aulas, e a conta solta que o passo (1) criou perde o e-mail no expurgo de acesso', async () => {
    const escola = await escolaNova()
    const email = emailDe('lote')
    const linhas = Array.from({ length: 1200 }, (_, i) => {
      const minutos = 6 * 60 + Math.floor(i / 7) * 5
      const hora = (total: number): string => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
      return aula('8A', 'Física', 'Professor Do Lote', email, String((i % 7) + 1), hora(minutos), hora(minutos + 5), i === 700 ? 'MARCA' : '')
    })
    const id = await gravar(escola, planilha(...linhas))
    // Um gatilho só do banco de teste: a aula marcada, que cai no segundo lote de 500, estoura depois de o primeiro ter escrito.
    const nome = `teste_falha_${randomUUID().slice(0, 8).replaceAll('-', '')}`
    await bancada.pool.query(`create function ${nome}() returns trigger language plpgsql as $$ begin raise exception 'falha do teste no segundo lote'; end $$`)
    await bancada.pool.query(`create trigger ${nome} before insert on alocacao for each row when (new.escola_id = '${escola.escolaId}'::uuid and new.sala = 'MARCA') execute function ${nome}()`)
    onTestFinished(async () => {
      await bancada.pool.query(`drop trigger if exists ${nome} on alocacao`)
      await bancada.pool.query(`drop function if exists ${nome}()`)
    })

    // A mensagem do gatilho vem na causa do erro do Drizzle: afirmá-la prova que o job chegou ao insert do segundo lote.
    const erro = await tentar(escola.escolaId, id, 1).then(
      () => undefined,
      (falha: unknown) => falha,
    )
    expect(erro).toBeInstanceOf(Error)
    expect((erro as Error).cause).toMatchObject({ message: 'falha do teste no segundo lote' })

    expect((await importacao(id)).estado).toBe('na_fila')
    for (const tabela of ['turma', 'disciplina', 'vinculo', 'alocacao', 'convite']) expect(await contar(tabela, escola.escolaId), tabela).toBe(0)
    expect((await bancada.pool.query<{ total: number }>("select count(*)::int as total from usuario where escola_id = $1 and papel = 'professor'", [escola.escolaId])).rows[0]?.total).toBe(0)
    expect((await bancada.pool.query<{ total: number }>('select count(*)::int as total from conta where email = $1', [email])).rows[0]?.total).toBe(1)
    // O expurgo de acesso, com a hora de 30 dias depois (nenhum convite está válido): a conta sem usuário e sem convite perde o e-mail.
    const depois = new Date(Date.now() + 30 * 24 * 3_600_000)
    const repositorio = new ExpurgoDeAcessoRepository(bancada.banco)
    for (let rodada = 0; rodada < 50; rodada++) {
      const restantes = (await bancada.pool.query<{ total: number }>('select count(*)::int as total from conta where email = $1', [email])).rows[0]?.total ?? 0
      if (restantes === 0) break
      await repositorio.limparLoteDeContasSemUso(depois, LOTE_DO_EXPURGO)
    }
    expect((await bancada.pool.query<{ total: number }>('select count(*)::int as total from conta where email = $1', [email])).rows[0]?.total).toBe(0)
  }, 120_000)
})
