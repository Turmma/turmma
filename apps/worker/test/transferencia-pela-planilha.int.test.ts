import 'reflect-metadata'
import { createDatabase, createPool, DomainException, MotorDePlanilha, runInContext, type Database, type DatabasePool } from '@educa/core'
import { CicloDeVidaService } from '@educa/core/ciclo-de-vida'
import { DecisaoRepository, ListaRepository, VinculoRepository } from '@educa/core/estrutura'
import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { DecisaoService } from '../../api/src/sala/decisao/decisao.service.js'
import { esperarNaTrava, WriteBlockTrigger } from '../../api/test/write-block-trigger.js'
import { criarGravacaoDaPlanilha } from '../src/processors/gravar-planilha.js'
import { jobExecution } from './job-execution.fixture.js'
import { InMemoryLog, QueueFixtures } from './queue.fixture.js'

beforeAll(() => {
  // Worker do compose de pé poderia executar o job que o teste grava, e disputar a importação com o processador do próprio teste.
  compose('stop', ...PROCESSOS_DA_FILA)
})

/**
 * A transferência pela planilha de alunos (F2, tarefa 9.0; Tech Spec do onboarding, seção 5, "O job" e "Gravar"; `cenarios.md`, RF5 e
 * "Corridas"), pelo processador do worker, uma tentativa por chamada. O aluno marcado "muda de turma" tem o vínculo antigo encerrado
 * por `realocacao` e o novo confirmado no mesmo instante; o nome ainda não aprovado vai livre à turma nova, com o pedido pendente
 * encerrado sem decisão; o que o aluno fez fica na turma antiga. As prévias, os tetos e as rotas estão em
 * `apps/api/test/importacao-alunos.int.test.ts`; a reimportação sem marca, em `gravar-planilha-alunos.int.test.ts`.
 */

const PREFIXO = `tra${randomUUID().slice(0, 6)}`
let contador = 0
const matricula = (): string => `${PREFIXO}-${String((contador += 1))}`

interface Escola {
  readonly escolaId: string
  readonly coordenadorId: string
  readonly anoId: string
}

interface Aluno {
  readonly usuarioId: string
  readonly nome: string
  readonly matricula: string
  readonly vinculoId: string
}

interface Nome {
  readonly id: string
  readonly nome: string
  readonly matricula: string
}

/** A escola da transferência: a 8A e a 8B, e quem está em cada uma antes da planilha. */
interface Cenario {
  readonly escola: Escola
  readonly t1: string
  readonly t2: string
  /** Aprovado da 8A que a planilha põe na 8B. */
  readonly aprovado: Aluno
  /** Aprovado da 8A que a planilha deixa na 8A: o segundo aprovado, que não muda de lugar. */
  readonly fica: Aluno
  /** Aprovado da 8B que a planilha deixa na 8B. */
  readonly daT2: Aluno
  /** Reivindicado da 8A, com o pedido pendente e um pedido recusado antigo do mesmo nome; a planilha o põe na 8B. */
  readonly pendente: Nome & { readonly pedidoId: string; readonly recusadoId: string }
  /** Livre da 8A, que a planilha põe na 8B. */
  readonly livre: Nome
  /** Livre da 8A que a planilha não traz: candidato a desligar (a 10.0), nunca a transferir. */
  readonly ausente: Nome
}

describe('estrutura.gravar-planilha, transferência de aluno', () => {
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

  const consulta = async <Registro extends object>(sql: string, parametros: unknown[] = []): Promise<Registro[]> => (await bancada.pool.query<Registro>(sql, parametros)).rows

  async function escolaNova(): Promise<Escola> {
    const escolaId = await bancada.escola()
    const [ano] = await consulta<{ id: string }>("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaId])
    const [conta] = await consulta<{ id: string }>('insert into conta (email) values ($1) returning id', [`${PREFIXO}-coord-${randomUUID().slice(0, 6)}@escola.invalid`])
    const [pessoa] = await consulta<{ id: string }>("insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'coordenador', 'Coordenação sintética', $2) returning id", [escolaId, conta?.id])
    return { escolaId, coordenadorId: pessoa?.id ?? '', anoId: ano?.id ?? '' }
  }

  async function turmaNova(escola: Escola, serieId: string, nome: string, chave: string): Promise<string> {
    const [turma] = await consulta<{ id: string }>('insert into turma (escola_id, ano_letivo_id, serie_id, nome, chave) values ($1, $2, $3, $4, $5) returning id', [escola.escolaId, escola.anoId, serieId, nome, chave])
    return turma?.id ?? ''
  }

  /** O aluno aprovado de uma turma: usuário, credencial, linha `aprovado` na lista e vínculo confirmado, como a aprovação os deixa. */
  async function alunoAprovado(escola: Escola, turmaId: string, nome: string): Promise<Aluno> {
    const m = matricula()
    const [usuario] = await consulta<{ id: string }>("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', $2) returning id", [escola.escolaId, nome])
    const usuarioId = usuario?.id ?? ''
    await consulta('insert into credencial_matricula (escola_id, usuario_id, matricula) values ($1, $2, $3)', [escola.escolaId, usuarioId, m])
    await consulta("insert into lista_nome (escola_id, ano_letivo_id, turma_id, estado, usuario_id) values ($1, $2, $3, 'aprovado', $4)", [escola.escolaId, escola.anoId, turmaId, usuarioId])
    const [vinculo] = await consulta<{ id: string }>(
      "insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now()) returning id",
      [escola.escolaId, escola.anoId, usuarioId, turmaId, escola.coordenadorId],
    )
    return { usuarioId, nome, matricula: m, vinculoId: vinculo?.id ?? '' }
  }

  async function nomeNaLista(escola: Escola, turmaId: string, nome: string, estado: 'livre' | 'reivindicado'): Promise<Nome> {
    const m = matricula()
    const [linha] = await consulta<{ id: string }>('insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, estado) values ($1, $2, $3, $4, $5, $6) returning id', [escola.escolaId, escola.anoId, turmaId, nome, m, estado])
    return { id: linha?.id ?? '', nome, matricula: m }
  }

  /** Um pedido de reivindicação do nome, no estado dado (o `pendente` leva hash, chave e marca, como o check exige). */
  async function pedidoDe(escola: Escola, turmaId: string, listaNomeId: string, estado: 'pendente' | 'recusada'): Promise<string> {
    const [pedido] = await consulta<{ id: string }>(
      estado === 'pendente'
        ? "insert into reivindicacao (escola_id, ano_letivo_id, turma_id, lista_nome_id, chave_envio, senha_hash, teve_matricula_errada, estado) values ($1, $2, $3, $4, gen_random_uuid(), 'hash-sintetico', false, 'pendente') returning id"
        : "insert into reivindicacao (escola_id, ano_letivo_id, turma_id, lista_nome_id, estado, decidida_em, decidida_por, decidida_como) values ($1, $2, $3, $4, 'recusada', now(), $5, 'professor') returning id",
      estado === 'pendente' ? [escola.escolaId, escola.anoId, turmaId, listaNomeId] : [escola.escolaId, escola.anoId, turmaId, listaNomeId, escola.coordenadorId],
    )
    return pedido?.id ?? ''
  }

  async function cenario(): Promise<Cenario> {
    const escola = await escolaNova()
    const [serie] = await consulta<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 8) returning id", [escola.escolaId])
    const t1 = await turmaNova(escola, serie?.id ?? '', '8A', '8a')
    const t2 = await turmaNova(escola, serie?.id ?? '', '8B', '8b')
    const aprovado = await alunoAprovado(escola, t1, 'Aluno Aprovado')
    const fica = await alunoAprovado(escola, t1, 'Aluno Que Fica')
    const daT2 = await alunoAprovado(escola, t2, 'Aluno Da Oitava B')
    const reivindicado = await nomeNaLista(escola, t1, 'Nome Reivindicado', 'reivindicado')
    const recusadoId = await pedidoDe(escola, t1, reivindicado.id, 'recusada')
    const pedidoId = await pedidoDe(escola, t1, reivindicado.id, 'pendente')
    const livre = await nomeNaLista(escola, t1, 'Nome Livre', 'livre')
    const ausente = await nomeNaLista(escola, t1, 'Nome Ausente', 'livre')
    return { escola, t1, t2, aprovado, fica, daT2, pendente: { ...reivindicado, pedidoId, recusadoId }, livre, ausente }
  }

  const texto = (...linhas: string[]): string => ['turma;nome;matricula', ...linhas].join('\n')

  /** A planilha que põe o aprovado, o reivindicado e o livre da 8A na 8B e deixa os outros onde estão (turma `destino` para os três). */
  const planilhaDe = (c: Cenario, destino = '8B'): string =>
    texto(
      `${destino};${c.aprovado.nome};${c.aprovado.matricula}`,
      `${destino};${c.pendente.nome};${c.pendente.matricula}`,
      `${destino};${c.livre.nome};${c.livre.matricula}`,
      `8A;${c.fica.nome};${c.fica.matricula}`,
      `8B;${c.daT2.nome};${c.daT2.matricula}`,
    )

  const contextoDe = (escola: Escola) => ({ requisicaoId: randomUUID(), escolaId: escola.escolaId, usuarioId: escola.coordenadorId, papel: 'coordenador' as const, sessaoId: randomUUID(), anoLetivoId: escola.anoId })
  const motor = (): MotorDePlanilha => new MotorDePlanilha(bancada.banco, { enfileirar: () => Promise.resolve(randomUUID()) })

  interface CandidatoLido {
    readonly id: string
    readonly acao: string
    readonly rotulo: string
  }

  const candidatosDe = (escola: Escola, planilha: string): Promise<readonly CandidatoLido[]> => runInContext(contextoDe(escola), async () => (await motor().previa('alunos', { texto: planilha })).candidatos)

  /** O gravar da coordenação, pelo motor (sem fila), com a marca dos candidatos que `marcar` escolhe (por padrão, todo `transferir`). */
  async function gravar(escola: Escola, planilha: string, marcar: (candidato: CandidatoLido) => boolean = (candidato) => candidato.acao === 'transferir'): Promise<string> {
    const marcados = (await candidatosDe(escola, planilha)).filter(marcar).map(({ id }) => id)
    return runInContext(contextoDe(escola), async () => (await motor().gravar('alunos', { texto: planilha, marcas: { transferir: marcados, desligar: [], encerrar: [] } })).id)
  }

  /** Uma tentativa do job, como o executor a entrega: no contexto da escola da linha do outbox. */
  function tentar(escolaId: string, importacaoId: string): Promise<void> {
    return runInContext({ requisicaoId: randomUUID(), escolaId }, () => gravacao({ importacaoId }, jobExecution(randomUUID(), 1)))
  }

  /** A decisão do professor ou da coordenação como a produção a faz: o `DecisaoService` real, com o contador de login falso (o Redis não é o assunto). */
  const contadorDeLogin = { chaveDe: (identificador: string) => identificador, zerar: () => Promise.resolve(true) }
  const aprovarPeloServico = (escola: Escola, pedidoId: string) =>
    runInContext(contextoDe(escola), () => new DecisaoService(bancoDoJob, contadorDeLogin).decidir({ ids: [pedidoId], decisao: 'aprovar' }))

  const importacao = async (id: string) => (await consulta<{ estado: string; erro: string | null; resumo: Record<string, number> | null }>('select estado, erro, resumo from importacao_planilha where id = $1', [id]))[0]

  /** O vínculo aberto do aluno na turma é o que o dá por "alcança": o que o aluno vê, no produto, parte dele. */
  const alcanca = async (usuarioId: string, turmaId: string): Promise<boolean> =>
    (await consulta<{ total: number }>("select count(*)::int as total from vinculo where usuario_id = $1 and turma_id = $2 and papel = 'aluno' and estado = 'confirmado'", [usuarioId, turmaId]))[0]?.total === 1

  const vinculosDe = (usuarioId: string) =>
    consulta<{ turma_id: string; estado: string; motivo_encerramento: string | null; encerrado_em: Date | null; origem: string; criado_por: string; decidido_em: Date | null }>(
      'select turma_id, estado, motivo_encerramento, encerrado_em, origem, criado_por, decidido_em from vinculo where usuario_id = $1 order by criado_em, id',
      [usuarioId],
    )

  const listaDe = (escolaId: string) =>
    consulta<{ id: string; turma: string; estado: string; nome: string | null; matricula: string | null; usuario_id: string | null }>(
      'select l.id, t.nome as turma, l.estado, l.nome, l.matricula, l.usuario_id from lista_nome l join turma t on t.id = l.turma_id where l.escola_id = $1 order by l.id',
      [escolaId],
    )

  const pedido = async (id: string) =>
    (await consulta<{ estado: string; decidida_em: Date | null; decidida_por: string | null; decidida_como: string | null; senha_hash: string | null; chave_envio: string | null; teve_matricula_errada: boolean | null; lista_nome_id: string | null }>(
      'select estado, decidida_em, decidida_por, decidida_como, senha_hash, chave_envio, teve_matricula_errada, lista_nome_id from reivindicacao where id = $1',
      [id],
    ))[0]

  /** Tudo o que a transferência pode mexer, para comparar antes e depois. */
  async function retrato(escolaId: string): Promise<unknown> {
    return {
      lista: await consulta('select id, turma_id, estado, nome, matricula, usuario_id from lista_nome where escola_id = $1 order by id', [escolaId]),
      vinculos: await consulta('select id, usuario_id, turma_id, estado, motivo_encerramento from vinculo where escola_id = $1 order by id', [escolaId]),
      pedidos: await consulta('select id, estado, lista_nome_id, senha_hash from reivindicacao where escola_id = $1 order by id', [escolaId]),
      turmas: await consulta('select id, nome from turma where escola_id = $1 order by id', [escolaId]),
    }
  }

  const auditoriaDa = (escolaId: string, acao: string) =>
    consulta<{ entidade_id: string; autor_usuario_id: string | null; antes: unknown; depois: unknown }>('select entidade_id, autor_usuario_id, antes, depois from auditoria where escola_id = $1 and acao = $2 order by id', [escolaId, acao])

  /**
   * Segura a importação em `FOR UPDATE`, deixa o job passar pelo passo (2) e esperar no (3), roda `mexer` com o job parado, solta a
   * trava e espera o job terminar: é o "entre o (2) e o (3)" dos cenários.
   */
  async function entreOs2e3(escola: Escola, importacaoId: string, mexer: () => Promise<void>): Promise<void> {
    const segurador = await bancada.pool.connect()
    let tentativa: Promise<void>
    try {
      await segurador.query('begin')
      await segurador.query('select id from importacao_planilha where id = $1 for update', [importacaoId])
      tentativa = tentar(escola.escolaId, importacaoId)
      await esperarNaTrava(bancada.pool, '%importacao_planilha%for update%')
      await mexer()
      await segurador.query('commit')
    } finally {
      await segurador.query('rollback').catch(() => undefined)
      segurador.release()
    }
    await tentativa
  }

  /**
   * Abre uma transação que escreve o que o job também vai escrever e **não confirma**, deixa o job chegar à escrita (que espera na
   * linha), confirma, e espera o job terminar: a diferença de verdade, sob a trava, e não a que o passo (3) já enxerga ao reler.
   */
  async function escritaParadaContraOJob(escola: Escola, importacaoId: string, escrever: (consulta: (sql: string, parametros: unknown[]) => Promise<unknown>) => Promise<void>, esperaPor: string): Promise<void> {
    const segurador = await bancada.pool.connect()
    let tentativa: Promise<void>
    try {
      await segurador.query('begin')
      await escrever((sql, parametros) => segurador.query(sql, parametros))
      tentativa = tentar(escola.escolaId, importacaoId)
      await esperarNaTrava(bancada.pool, esperaPor)
      await segurador.query('commit')
    } finally {
      await segurador.query('rollback').catch(() => undefined)
      segurador.release()
    }
    await tentativa
  }

  it('o transferido alcança a turma nova e não a antiga; o aprovado que a planilha deixa na 8A e o da 8B ficam onde estão, e a lista acompanha o aluno', async () => {
    const c = await cenario()
    const id = await gravar(c.escola, planilhaDe(c))

    await tentar(c.escola.escolaId, id)

    expect(await importacao(id)).toEqual({ estado: 'concluida', erro: null, resumo: { entram: 0, ja_existem: 2, turmas_novas: 0, transferidos: 3 } })
    expect([await alcanca(c.aprovado.usuarioId, c.t2), await alcanca(c.aprovado.usuarioId, c.t1)]).toEqual([true, false])
    expect([await alcanca(c.fica.usuarioId, c.t1), await alcanca(c.fica.usuarioId, c.t2)]).toEqual([true, false])
    expect([await alcanca(c.daT2.usuarioId, c.t2), await alcanca(c.daT2.usuarioId, c.t1)]).toEqual([true, false])
    // A linha `aprovado` da lista vai com o aluno, sem nome nem matrícula; o nome do usuário não muda (a transferência não corrige nome).
    const naLista = (await listaDe(c.escola.escolaId)).filter((linha) => linha.usuario_id !== null)
    expect(naLista.map((linha) => [linha.usuario_id, linha.turma, linha.estado, linha.nome, linha.matricula]).sort()).toEqual(
      [
        [c.aprovado.usuarioId, '8B', 'aprovado', null, null],
        [c.fica.usuarioId, '8A', 'aprovado', null, null],
        [c.daT2.usuarioId, '8B', 'aprovado', null, null],
      ].sort(),
    )
    expect((await consulta<{ nome: string }>('select nome from usuario where id = $1', [c.aprovado.usuarioId]))[0]?.nome).toBe('Aluno Aprovado')
  })

  it('a resposta de atividade do transferido continua presa à turma antiga, onde foi dada', async () => {
    const c = await cenario()
    const [disciplina] = await consulta<{ id: string }>("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [c.escola.escolaId])
    const [artefato] = await consulta<{ id: string }>(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por)
       values ($1, $2, $3, $4, 'atividade_objetiva', 'Atividade da 8A', '{"tipo":"atividade_objetiva","questoes":[]}'::jsonb, $5) returning id`,
      [c.escola.escolaId, c.escola.anoId, c.t1, disciplina?.id, c.escola.coordenadorId],
    )
    const [aplicada] = await consulta<{ id: string }>('insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, aplicada_por) values ($1, $2, $3, $4, false, $5) returning id', [
      c.escola.escolaId,
      c.escola.anoId,
      c.t1,
      artefato?.id,
      c.escola.coordenadorId,
    ])
    await consulta('insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) values ($1, $2, $3, $4)', [c.escola.escolaId, c.escola.anoId, aplicada?.id, c.aprovado.usuarioId])
    await consulta('insert into resposta_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao, alternativa) values ($1, $2, $3, $4, 1, 2)', [c.escola.escolaId, c.escola.anoId, aplicada?.id, c.aprovado.usuarioId])
    const id = await gravar(c.escola, planilhaDe(c))

    await tentar(c.escola.escolaId, id)

    expect((await importacao(id))?.estado).toBe('concluida')
    expect(await alcanca(c.aprovado.usuarioId, c.t2)).toBe(true)
    expect(await consulta('select r.questao, r.alternativa, a.turma_id from resposta_atividade r join atividade_aplicada a on a.id = r.atividade_aplicada_id where r.aluno_id = $1', [c.aprovado.usuarioId])).toEqual([{ questao: 1, alternativa: 2, turma_id: c.t1 }])
  })

  it('a transferência passa pelo encerramento: o vínculo da 8A fica `encerrado` por `realocacao`, com a hora, e o da 8B nasce confirmado, com origem `lista`, a coordenação como autora e `decidido_em`', async () => {
    const c = await cenario()
    const id = await gravar(c.escola, planilhaDe(c))

    await tentar(c.escola.escolaId, id)

    const vinculos = await vinculosDe(c.aprovado.usuarioId)
    expect(vinculos.map((v) => [v.turma_id, v.estado, v.motivo_encerramento, v.encerrado_em !== null, v.origem, v.criado_por, v.decidido_em !== null])).toEqual([
      [c.t1, 'encerrado', 'realocacao', true, 'coordenacao', c.escola.coordenadorId, true],
      [c.t2, 'confirmado', null, false, 'lista', c.escola.coordenadorId, true],
    ])
    // Quem não foi marcado não ganha vínculo novo nem tem o seu encerrado.
    expect((await vinculosDe(c.fica.usuarioId)).map((v) => [v.turma_id, v.estado])).toEqual([[c.t1, 'confirmado']])
  })

  it('transferido com pedido pendente: o pedido fica `encerrada`, o nome volta `livre` na 8B com o mesmo nome e matrícula, e o pedido recusado antigo do mesmo nome continua recusado', async () => {
    const c = await cenario()
    const id = await gravar(c.escola, planilhaDe(c))

    await tentar(c.escola.escolaId, id)

    expect((await pedido(c.pendente.pedidoId))?.estado).toBe('encerrada')
    expect((await pedido(c.pendente.recusadoId))?.estado).toBe('recusada')
    const nome = (await listaDe(c.escola.escolaId)).find((linha) => linha.id === c.pendente.id)
    expect(nome).toEqual(expect.objectContaining({ turma: '8B', estado: 'livre', nome: 'Nome Reivindicado', matricula: c.pendente.matricula, usuario_id: null }))
    // O livre também vai à 8B e segue livre; o ausente não é mexido.
    expect((await listaDe(c.escola.escolaId)).filter((linha) => [c.livre.id, c.ausente.id].includes(linha.id)).map((linha) => [linha.id === c.livre.id, linha.turma, linha.estado]).sort()).toEqual([[false, '8A', 'livre'], [true, '8B', 'livre']].sort())
  })

  it('o pedido encerrado pela transferência fica sem `decididaEm`, `decididaPor` e `decididaComo`, e sem o hash, a chave e a marca de matrícula errada; o recusado antigo conserva a decisão dele', async () => {
    const c = await cenario()
    const id = await gravar(c.escola, planilhaDe(c))

    await tentar(c.escola.escolaId, id)

    expect(await pedido(c.pendente.pedidoId)).toEqual({
      estado: 'encerrada',
      decidida_em: null,
      decidida_por: null,
      decidida_como: null,
      senha_hash: null,
      chave_envio: null,
      teve_matricula_errada: null,
      lista_nome_id: c.pendente.id,
    })
    expect(await pedido(c.pendente.recusadoId)).toMatchObject({ estado: 'recusada', decidida_por: c.escola.coordenadorId, decidida_como: 'professor' })
  })

  it('sem a marca, "muda de turma" não muda nada, nem cria a turma nova que só ela pedia: o banco fica como estava e o resumo não traz `transferidos`', async () => {
    const c = await cenario()
    const antes = await retrato(c.escola.escolaId)
    const id = await gravar(c.escola, planilhaDe(c, '8C'), () => false)

    await tentar(c.escola.escolaId, id)

    expect(await importacao(id)).toEqual({ estado: 'concluida', erro: null, resumo: { entram: 0, ja_existem: 2, turmas_novas: 0 } })
    expect(await retrato(c.escola.escolaId)).toEqual(antes)
  })

  it('a transferência para uma turma que a escola ainda não tem a cria na série do nome, e só com a marca', async () => {
    const c = await cenario()
    const id = await gravar(c.escola, planilhaDe(c, '9C'), (candidato) => candidato.acao === 'transferir' && candidato.rotulo.startsWith('Aluno Aprovado'))

    await tentar(c.escola.escolaId, id)

    expect((await importacao(id))?.resumo).toEqual({ entram: 0, ja_existem: 2, turmas_novas: 1, transferidos: 1 })
    const [nova] = await consulta<{ id: string; nome: string; etapa: string; serie: number }>('select t.id, t.nome, s.etapa, s.ano as serie from turma t join serie s on s.id = t.serie_id where t.escola_id = $1 and t.chave = $2', [c.escola.escolaId, '9c'])
    expect(nova).toMatchObject({ nome: '9C', etapa: 'ef_anos_finais', serie: 9 })
    expect([await alcanca(c.aprovado.usuarioId, nova?.id ?? ''), await alcanca(c.aprovado.usuarioId, c.t1)]).toEqual([true, false])
    // O reivindicado e o livre da mesma planilha não foram marcados: seguem na 8A, com o pedido pendente.
    expect((await pedido(c.pendente.pedidoId))?.estado).toBe('pendente')
    expect((await listaDe(c.escola.escolaId)).filter((linha) => linha.id === c.pendente.id || linha.id === c.livre.id).map((linha) => linha.turma)).toEqual(['8A', '8A'])
    expect((await auditoriaDa(c.escola.escolaId, 'turma.criada')).map((registro) => registro.depois)).toEqual([{ serie: { etapa: 'ef_anos_finais', ano: 9 }, origem: 'planilha' }])
  })

  it('mais transferidos do que cabem num lote (500): 501 alunos aprovados passam da 8A à 8B, e a soma das linhas mudadas por lote fecha a conta sem `desatualizada`', async () => {
    const c = await cenario()
    const quantos = 501
    const prefixo = `lote-${randomUUID().slice(0, 6)}`
    await consulta(
      `with u as (insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno Do Lote ' || g from generate_series(1, $2::int) g returning id, nome),
            c as (insert into credencial_matricula (escola_id, usuario_id, matricula) select $1, id, $3 || '-' || substr(nome, 15) from u returning usuario_id),
            l as (insert into lista_nome (escola_id, ano_letivo_id, turma_id, estado, usuario_id) select $1, $4, $5, 'aprovado', usuario_id from c returning usuario_id)
       insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) select $1, $4, usuario_id, $5, 'aluno', 'confirmado', $6, now() from l`,
      [c.escola.escolaId, quantos, prefixo, c.escola.anoId, c.t1, c.escola.coordenadorId],
    )
    const linhas = Array.from({ length: quantos }, (_, i) => `8B;Aluno Do Lote ${String(i + 1)};${prefixo}-${String(i + 1)}`)
    const id = await gravar(c.escola, texto(...linhas, `8A;${c.fica.nome};${c.fica.matricula}`), (candidato) => candidato.acao === 'transferir' && candidato.rotulo.startsWith('Aluno Do Lote'))

    await tentar(c.escola.escolaId, id)

    expect(await importacao(id)).toMatchObject({ estado: 'concluida', erro: null, resumo: { transferidos: quantos } })
    const contar = async (sql: string, ...parametros: string[]) => (await consulta<{ total: number }>(sql, [c.escola.escolaId, ...parametros]))[0]?.total
    expect(await contar("select count(*)::int as total from vinculo where escola_id = $1 and turma_id = $2 and papel = 'aluno' and estado = 'confirmado' and origem = 'lista'", c.t2)).toBe(quantos)
    expect(await contar("select count(*)::int as total from vinculo where escola_id = $1 and turma_id = $2 and papel = 'aluno' and estado = 'encerrado' and motivo_encerramento = 'realocacao'", c.t1)).toBe(quantos)
    expect(await contar("select count(*)::int as total from lista_nome where escola_id = $1 and turma_id = $2 and estado = 'aprovado' and nome is null", c.t2)).toBe(quantos + 1)
    expect((await auditoriaDa(c.escola.escolaId, 'aluno.transferido')).length).toBe(quantos)
  })

  it('[P] a transferência contra o professor aprovando o mesmo pedido pelo `DecisaoService`, com a aprovação parada na escrita da lista: o job espera na trava do pedido, relê o aluno já aprovado e sai `desatualizada`; o aprovado fica inteiro na turma antiga, e nunca no meio', async () => {
    const c = await cenario()
    // Só linhas da 8B: a 8A (de onde o aluno sai e onde o pedido espera) não é citada, e só a trava da origem de cada marcado a alcança.
    const id = await gravar(c.escola, texto(`8B;${c.aprovado.nome};${c.aprovado.matricula}`, `8B;${c.pendente.nome};${c.pendente.matricula}`, `8B;${c.daT2.nome};${c.daT2.matricula}`))
    // A aprovação de verdade (ano em `FOR SHARE`, depois o pedido), parada quando escreve a linha da lista como `aprovado`.
    const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'lista_nome', evento: 'update', quando: `new.id = '${c.pendente.id}'::uuid and new.estado = 'aprovado'` })
    await gatilho.armar()
    try {
      const aprovando = aprovarPeloServico(c.escola, c.pendente.pedidoId)
      await gatilho.esperarParadas()
      const tentativa = tentar(c.escola.escolaId, id)
      await esperarNaTrava(bancada.pool, '%reivindicacao%for update%')
      await gatilho.soltar()
      const [aprovada] = await Promise.all([aprovando, tentativa])
      expect(aprovada.resultados.map((r) => r.resultado)).toEqual(['decidida'])
    } finally {
      await gatilho.desarmar()
    }

    const novoId = (await listaDe(c.escola.escolaId)).find((linha) => linha.id === c.pendente.id)?.usuario_id ?? ''
    expect((await importacao(id))?.estado).toBe('desatualizada')
    expect((await pedido(c.pendente.pedidoId))?.estado).toBe('aprovada')
    expect(novoId).not.toBe('')
    expect([await alcanca(novoId, c.t1), await alcanca(novoId, c.t2)]).toEqual([true, false])
    expect((await listaDe(c.escola.escolaId)).find((linha) => linha.id === c.pendente.id)).toMatchObject({ turma: '8A', estado: 'aprovado', usuario_id: novoId })
    // Nada da planilha foi aplicado, nem aos outros marcados: o job volta inteiro.
    expect([await alcanca(c.aprovado.usuarioId, c.t1), await alcanca(c.aprovado.usuarioId, c.t2)]).toEqual([true, false])
  })

  it('[P] o professor aprovando pelo `DecisaoService` com o job parado depois de encerrar o pedido: a decisão espera na trava do pedido e sai `ja_decidida`; a transferência conclui, o nome fica livre na 8B e ninguém nasce na 8A', async () => {
    const c = await cenario()
    const id = await gravar(c.escola, planilhaDe(c), (candidato) => candidato.acao === 'transferir' && candidato.rotulo.startsWith('Nome Reivindicado'))
    // O job parado na auditoria do nome transferido: já escreveu o nome na 8B e encerrou o pedido, e ainda não confirmou.
    const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'auditoria', evento: 'insert', quando: `new.acao = 'lista.transferida' and new.entidade_id = '${c.pendente.id}'::uuid` })
    await gatilho.armar()
    try {
      const tentativa = tentar(c.escola.escolaId, id)
      await gatilho.esperarParadas()
      const decidindo = aprovarPeloServico(c.escola, c.pendente.pedidoId)
      await esperarNaTrava(bancada.pool, '%reivindicacao%for update%')
      await gatilho.soltar()
      const [decisao] = await Promise.all([decidindo, tentativa])
      expect(decisao.resultados.map((r) => r.resultado)).toEqual(['ja_decidida'])
    } finally {
      await gatilho.desarmar()
    }

    expect((await importacao(id))?.estado).toBe('concluida')
    const pedidoFechado = await pedido(c.pendente.pedidoId)
    expect(pedidoFechado).toMatchObject({ estado: 'encerrada', decidida_em: null, decidida_por: null, decidida_como: null, senha_hash: null })
    expect((await listaDe(c.escola.escolaId)).find((linha) => linha.id === c.pendente.id)).toMatchObject({ turma: '8B', estado: 'livre', nome: c.pendente.nome, matricula: c.pendente.matricula, usuario_id: null })
    expect(await consulta("select id from usuario where escola_id = $1 and nome = $2", [c.escola.escolaId, c.pendente.nome])).toEqual([])
    expect(await consulta("select id from credencial_matricula where escola_id = $1 and matricula = $2", [c.escola.escolaId, c.pendente.matricula])).toEqual([])
  })

  it('[P] o usuário do aluno transferido preso por outra transação: o job espera na trava do usuário e, liberado, conclui a transferência inteira', async () => {
    const c = await cenario()
    const id = await gravar(c.escola, planilhaDe(c))
    await escritaParadaContraOJob(c.escola, id, async (consulta) => {
      await consulta('select id from usuario where id = $1 for update', [c.aprovado.usuarioId])
    }, '%usuario%for no key update%')

    expect((await importacao(id))?.estado).toBe('concluida')
    expect([await alcanca(c.aprovado.usuarioId, c.t1), await alcanca(c.aprovado.usuarioId, c.t2)]).toEqual([false, true])
  })

  it('[P] a reivindicação parada no nome livre da turma antiga contra o passo (3): o job sai `desatualizada` e o pedido fica pendente com o nome na turma antiga, nunca pendente com o nome na turma nova', async () => {
    const c = await cenario()
    const id = await gravar(c.escola, planilhaDe(c), (candidato) => candidato.acao === 'transferir' && candidato.rotulo.startsWith('Nome Livre'))
    let pedidoNovoId = ''

    await escritaParadaContraOJob(
      c.escola,
      id,
      async (executar) => {
        // O `tomar` e o pedido da reivindicação, sem confirmar: o nome passa a `reivindicado` com o pedido pendente.
        await executar("update lista_nome set estado = 'reivindicado' where id = $1 and estado = 'livre'", [c.livre.id])
        const resposta = (await executar(
          "insert into reivindicacao (escola_id, ano_letivo_id, turma_id, lista_nome_id, chave_envio, senha_hash, teve_matricula_errada, estado) values ($1, $2, $3, $4, gen_random_uuid(), 'hash-sintetico', false, 'pendente') returning id",
          [c.escola.escolaId, c.escola.anoId, c.t1, c.livre.id],
        )) as { rows: Array<{ id: string }> }
        pedidoNovoId = resposta.rows[0]?.id ?? ''
      },
      '%update lista_nome as l set turma_id%',
    )

    expect((await importacao(id))?.estado).toBe('desatualizada')
    expect((await pedido(pedidoNovoId))?.estado).toBe('pendente')
    expect((await listaDe(c.escola.escolaId)).find((linha) => linha.id === c.livre.id)).toMatchObject({ turma: '8A', estado: 'reivindicado' })
    expect(await consulta('select r.id from reivindicacao r join lista_nome l on l.id = r.lista_nome_id where r.escola_id = $1 and r.estado = $2 and l.turma_id <> r.turma_id', [c.escola.escolaId, 'pendente'])).toEqual([])
  })

  it.each([
    ['o nome livre', 'Nome Livre'],
    ['o aluno aprovado', 'Aluno Aprovado'],
  ])('[P] %s levado à 8C à mão com o job parado na escrita: o job sai `desatualizada`, e a linha fica onde a mão a pôs', async (_quem, rotulo) => {
    const c = await cenario()
    const [serie] = await consulta<{ id: string }>('select serie_id as id from turma where id = $1', [c.t1])
    const t3 = await turmaNova(c.escola, serie?.id ?? '', '8C', '8c')
    const id = await gravar(c.escola, planilhaDe(c), (candidato) => candidato.acao === 'transferir' && candidato.rotulo.startsWith(rotulo))
    const alvoId = rotulo === 'Nome Livre' ? c.livre.id : c.aprovado.usuarioId

    await escritaParadaContraOJob(
      c.escola,
      id,
      (executar) => executar(rotulo === 'Nome Livre' ? 'update lista_nome set turma_id = $2 where id = $1' : 'update lista_nome set turma_id = $2 where usuario_id = $1', [alvoId, t3]) as Promise<void>,
      '%update lista_nome as l set turma_id%',
    )

    expect((await importacao(id))?.estado).toBe('desatualizada')
    const linha = (await listaDe(c.escola.escolaId)).find((l) => (rotulo === 'Nome Livre' ? l.id === c.livre.id : l.usuario_id === c.aprovado.usuarioId))
    expect(linha?.turma).toBe('8C')
    // O vínculo do aluno também volta atrás: o job é uma transação só.
    expect([await alcanca(c.aprovado.usuarioId, c.t1), await alcanca(c.aprovado.usuarioId, c.t2)]).toEqual([true, false])
  })

  it('[P] o vínculo do aluno encerrado à mão entre o passo (2) e o (3): o job sai `desatualizada`, sem vínculo novo e sem mexer em nenhum outro marcado', async () => {
    const c = await cenario()
    const id = await gravar(c.escola, planilhaDe(c))
    const antes = (await retrato(c.escola.escolaId)) as { vinculos: unknown[]; lista: unknown[] }

    await entreOs2e3(c.escola, id, async () => {
      await consulta("update vinculo set estado = 'encerrado', motivo_encerramento = 'desligamento', encerrado_em = now() where id = $1", [c.aprovado.vinculoId])
    })

    expect((await importacao(id))?.estado).toBe('desatualizada')
    const depois = (await retrato(c.escola.escolaId)) as { vinculos: Array<{ id: string }>; lista: unknown[] }
    expect(depois.vinculos.map((v) => v.id)).toEqual((antes.vinculos as Array<{ id: string }>).map((v) => v.id))
    expect(depois.lista).toEqual(antes.lista)
    expect((await pedido(c.pendente.pedidoId))?.estado).toBe('pendente')
    expect(await alcanca(c.aprovado.usuarioId, c.t2)).toBe(false)
  })

  it('[P] o aluno a transferir desativado de verdade entre o passo (2) e o (3): o job sai `desatualizada`, sem vínculo novo, com a lista intacta e sem mexer em nenhum outro marcado', async () => {
    const c = await cenario()
    const id = await gravar(c.escola, planilhaDe(c))
    const antes = (await retrato(c.escola.escolaId)) as { vinculos: Array<{ id: string }>; lista: unknown[] }

    await entreOs2e3(c.escola, id, () => runInContext(contextoDe(c.escola), () => new CicloDeVidaService(bancoDoJob).desativar(c.aprovado.usuarioId)))

    expect((await importacao(id))?.estado).toBe('desatualizada')
    const depois = (await retrato(c.escola.escolaId)) as { vinculos: Array<{ id: string; estado: string }>; lista: unknown[] }
    expect(depois.vinculos.map((v) => v.id)).toEqual(antes.vinculos.map((v) => v.id))
    expect(depois.lista).toEqual(antes.lista)
    expect(await alcanca(c.aprovado.usuarioId, c.t2)).toBe(false)
    // O único vínculo que muda é o do desativado, pela própria desativação; os dos outros marcados e dos que ficam seguem confirmados.
    expect(depois.vinculos.filter((v) => v.id !== c.aprovado.vinculoId).every((v) => v.estado === 'confirmado')).toBe(true)
    expect((await pedido(c.pendente.pedidoId))?.estado).toBe('pendente')
    expect((await listaDe(c.escola.escolaId)).find((linha) => linha.id === c.livre.id)).toMatchObject({ turma: '8A', estado: 'livre' })
  })

  it('o aluno que já tem vínculo aberto na turma de destino viola o único: o job sai `desatualizada` na mesma execução, e o vínculo da 8A não é encerrado', async () => {
    const c = await cenario()
    await consulta("insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())", [c.escola.escolaId, c.escola.anoId, c.aprovado.usuarioId, c.t2, c.escola.coordenadorId])
    const id = await gravar(c.escola, planilhaDe(c))

    await tentar(c.escola.escolaId, id)

    expect((await importacao(id))?.estado).toBe('desatualizada')
    expect((await vinculosDe(c.aprovado.usuarioId)).map((v) => [v.turma_id, v.estado])).toEqual([[c.t1, 'confirmado'], [c.t2, 'confirmado']])
    expect((await listaDe(c.escola.escolaId)).find((linha) => linha.usuario_id === c.aprovado.usuarioId)?.turma).toBe('8A')
  })

  it('isolamento dos métodos da transferência: no contexto da A, o ano e os ids da B não mudam a B; no contexto da B, os mesmos argumentos mudam', async () => {
    const a = await cenario()
    const b = await cenario()
    const doB = {
      nomes: [{ id: b.livre.id, estadoLido: 'livre' as const, turmaLidaId: b.t1, turmaId: b.t2 }],
      aprovados: [{ usuarioId: b.aprovado.usuarioId, turmaLidaId: b.t1, turmaId: b.t2 }],
      vinculos: [{ usuarioId: b.aprovado.usuarioId, turmaId: b.t1 }],
    }
    const chamar = (escola: Escola) =>
      runInContext(contextoDe(escola), async () => ({
        pedidos: await new DecisaoRepository(bancoDoJob).fechar({ listaNomeIds: [b.pendente.id] }, 'encerrada'),
        nomes: await new ListaRepository(bancoDoJob).transferirNomes(b.escola.anoId, doB.nomes),
        aprovados: await new ListaRepository(bancoDoJob).transferirAprovados(b.escola.anoId, doB.aprovados),
        vinculos: (await new VinculoRepository(bancoDoJob).encerrarDosAlunos(b.escola.anoId, doB.vinculos, 'realocacao')).length,
      }))
    const antes = await retrato(b.escola.escolaId)

    expect(await chamar(a.escola)).toEqual({ pedidos: [], nomes: 0, aprovados: 0, vinculos: 0 })
    expect(await retrato(b.escola.escolaId)).toEqual(antes)

    // O controle: o mesmo pedido, na escola dela, muda, e o teste acima não passou por falta de dado.
    expect(await chamar(b.escola)).toEqual({ pedidos: [b.pendente.pedidoId], nomes: 1, aprovados: 1, vinculos: 1 })
    expect(await retrato(b.escola.escolaId)).not.toEqual(antes)
  })

  it('a marca de um aluno de outra escola, ou com a ação trocada, é `ENTRADA_INVALIDA` e nada é gravado; o aluno da outra escola não muda de turma', async () => {
    const a = await cenario()
    const b = await cenario()
    const planilhaDaB = planilhaDe(b)
    const daB = (await candidatosDe(b.escola, planilhaDaB)).filter((candidato) => candidato.acao === 'transferir')
    const ausenteDaA = (await candidatosDe(a.escola, planilhaDe(a))).find((candidato) => candidato.acao === 'desligar')
    expect(daB.length).toBe(3)
    expect(ausenteDaA).toBeDefined()
    const antesDaB = await retrato(b.escola.escolaId)

    const recusa = async (marcas: { transferir: string[]; desligar: string[] }) =>
      runInContext(contextoDe(a.escola), () => motor().gravar('alunos', { texto: planilhaDe(a), marcas: { ...marcas, encerrar: [] } })).then(
        () => 'gravou',
        (erro: unknown) => (erro instanceof DomainException ? erro.codigo : 'outro erro'),
      )

    expect(await recusa({ transferir: daB.map(({ id }) => id), desligar: [] })).toBe(ErrorCode.ENTRADA_INVALIDA)
    // O id de quem sai da planilha, marcado como transferência: não transfere nem desliga ninguém.
    expect(await recusa({ transferir: [ausenteDaA?.id ?? ''], desligar: [] })).toBe(ErrorCode.ENTRADA_INVALIDA)
    expect(await consulta('select id from importacao_planilha where escola_id = $1', [a.escola.escolaId])).toEqual([])
    expect(await retrato(b.escola.escolaId)).toEqual(antesDaB)
  })

  it('a transferência da A não alcança a B: a matrícula da B na planilha da A é "entra", sem vínculo nem lista movidos na B', async () => {
    const a = await escolaNova()
    const [serie] = await consulta<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 8) returning id", [a.escolaId])
    await turmaNova(a, serie?.id ?? '', '8B', '8b')
    const b = await cenario()
    const antesDaB = await retrato(b.escola.escolaId)
    const id = await gravar(a, texto(`8B;Outro Nome;${b.aprovado.matricula}`, `8B;Outro Nome 2;${b.pendente.matricula}`))

    await tentar(a.escolaId, id)

    expect((await importacao(id))?.resumo).toEqual({ entram: 2, ja_existem: 0, turmas_novas: 0 })
    expect(await retrato(b.escola.escolaId)).toEqual(antesDaB)
  })

  it('a auditoria da transferência: `aluno.transferido` e `lista.transferida` com as turmas de origem e destino, `vinculo.encerrado` e `vinculo.criado` com a origem, e `planilha.gravada` com a contagem; nenhum registro traz nome nem matrícula', async () => {
    const c = await cenario()
    const id = await gravar(c.escola, planilhaDe(c))
    await tentar(c.escola.escolaId, id)
    const turmas = { turmaOrigemId: c.t1, turmaDestinoId: c.t2 }
    const [vinculoAntigo, vinculoNovo] = await vinculosDe(c.aprovado.usuarioId)
    const [novo] = await consulta<{ id: string }>("select id from vinculo where usuario_id = $1 and estado = 'confirmado'", [c.aprovado.usuarioId])

    expect(await auditoriaDa(c.escola.escolaId, 'aluno.transferido')).toEqual([{ entidade_id: c.aprovado.usuarioId, autor_usuario_id: c.escola.coordenadorId, antes: null, depois: turmas }])
    const dosNomes = await auditoriaDa(c.escola.escolaId, 'lista.transferida')
    expect(dosNomes.map((r) => [r.entidade_id, r.autor_usuario_id, r.depois]).sort()).toEqual(
      [
        [c.pendente.id, c.escola.coordenadorId, turmas],
        [c.livre.id, c.escola.coordenadorId, turmas],
      ].sort(),
    )
    expect(await auditoriaDa(c.escola.escolaId, 'vinculo.encerrado')).toEqual([
      { entidade_id: c.aprovado.vinculoId, autor_usuario_id: c.escola.coordenadorId, antes: { estado: 'confirmado' }, depois: { estado: 'encerrado', motivo: 'realocacao', origem: 'lista' } },
    ])
    expect(await auditoriaDa(c.escola.escolaId, 'vinculo.criado')).toEqual([
      {
        entidade_id: novo?.id,
        autor_usuario_id: c.escola.coordenadorId,
        antes: null,
        depois: { usuarioId: c.aprovado.usuarioId, turmaId: c.t2, disciplinaId: null, papel: 'aluno', estado: 'confirmado', origem: 'lista' },
      },
    ])
    expect(vinculoAntigo?.estado).toBe('encerrado')
    expect(vinculoNovo?.estado).toBe('confirmado')
    const [gravada] = await auditoriaDa(c.escola.escolaId, 'planilha.gravada')
    expect(gravada?.depois).toEqual({ tipo: 'alunos', contagens: { entram: 0, ja_existem: 2, turmas_novas: 0, transferidos: 3 } })
    const serializado = JSON.stringify([...(await auditoriaDa(c.escola.escolaId, 'aluno.transferido')), ...dosNomes, gravada])
    for (const sentinela of [c.aprovado.nome, c.pendente.nome, c.livre.nome, c.aprovado.matricula, c.pendente.matricula, c.livre.matricula, '8B']) expect(serializado).not.toContain(sentinela)
  })
})
