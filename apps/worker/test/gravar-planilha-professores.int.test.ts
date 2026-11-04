import 'reflect-metadata'
import { CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA, ContaDaPlanilhaPerdidaError, convidarProfessorDaPlanilha, createDatabase, ehFalhaDeTrava, createPool, executarPlanilha, MotorDePlanilha, runInContext, schema, TENTATIVAS_DO_JOB, type Database, type DatabasePool } from '@educa/core'
import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { esperarNaTrava, WriteBlockTrigger } from '../../api/test/write-block-trigger.js'
import { JobFailureError } from '../src/job-failure.error.js'
import { criarGravacaoDaPlanilha } from '../src/processors/gravar-planilha.js'
import { jobExecution } from './job-execution.fixture.js'
import { InMemoryLog, QueueFixtures } from './queue.fixture.js'

beforeAll(() => {
  // Worker do compose de pé poderia executar o job que o teste grava, e disputar a importação com o processador do próprio teste.
  compose('stop', ...PROCESSOS_DA_FILA)
})

/**
 * A planilha de professores pelo job `estrutura.gravar-planilha` (F2, tarefa 6.0; Tech Spec do onboarding, seção 5, "O job" e
 * "Gravar"; `cenarios.md`, RF6 e "Corridas"), pelo processador do worker, uma tentativa por chamada. O que cada tentativa deixa no
 * banco: usuário `pendente`, convite sem token, conta achada ou criada no passo (1), desligamento só do marcado, e as corridas
 * entre escolas, entre o passo (2) e o (3), e com o expurgo de acesso. A prévia e as rotas estão em `apps/api/test/professores.int.test.ts`.
 */

const PREFIXO = `prf${randomUUID().slice(0, 6)}`
const SEM_MARCAS = { transferir: [], desligar: [], encerrar: [] }
const ULTIMA = TENTATIVAS_DO_JOB

interface Escola {
  readonly escolaId: string
  readonly coordenadorId: string
  readonly anoId: string | undefined
  readonly serieId: string
}

interface Pessoa {
  readonly usuarioId: string
  readonly contaId: string
  readonly email: string
}

/** O e-mail desta execução: `nome` mais um sufixo próprio da chamada, para o banco de teste acumulado não repetir conta. */
const emailDe = (nome: string): string => `${PREFIXO}-${nome}-${randomUUID().slice(0, 6)}@professores.invalid`

describe('estrutura.gravar-planilha, planilha de professores', () => {
  const bancada = new QueueFixtures()
  const log = new InMemoryLog('worker-teste')
  const medidor = new MedidorDeTeste()
  /** O pool dos jobs em corrida e das paradas: o da bancada tem poucas conexões, e cada parada segura uma. */
  let apoio: DatabasePool
  let bancoDoJob: Database
  let gravacao: ReturnType<typeof criarGravacaoDaPlanilha>
  const sqlDoJob: string[] = []
  const parametrosDoJob: unknown[][] = []

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

  /** A escola com a coordenação que grava e, se pedido, o ano de 2026 em curso. */
  async function escolaNova(comAno = true): Promise<Escola> {
    const escolaId = await bancada.escola()
    const ano = comAno
      ? (await bancada.pool.query<{ id: string }>("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaId])).rows[0]?.id
      : undefined
    const { rows: conta } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [emailDe('coordenacao')])
    const { rows: pessoa } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'coordenador', 'Coordenação sintética', $2) returning id", [escolaId, conta[0]?.id])
    const { rows: serie } = await bancada.pool.query<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [escolaId])
    return { escolaId, coordenadorId: pessoa[0]?.id ?? '', anoId: ano, serieId: serie[0]?.id ?? '' }
  }

  /** Um professor já na escola, com conta própria: ativo, ou inativo (esperando convite que o teste monta). */
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

  /** Uma turma do ano em curso, e um vínculo de professor nela no estado pedido. */
  async function vinculoDe(escola: Escola, usuarioId: string, estado: 'confirmado' | 'pendente' | 'encerrado'): Promise<{ turmaId: string; vinculoId: string }> {
    const { rows: turma } = await bancada.pool.query<{ id: string }>('insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4) returning id', [escola.escolaId, escola.anoId, escola.serieId, `2º ${randomUUID().slice(0, 4)}`])
    const turmaId = turma[0]?.id ?? ''
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em, motivo_encerramento, encerrado_em)
       values ($1, $2, $3, $4, 'professor', $5::text, $6, case when $5::text <> 'pendente' then now() end, case when $5::text = 'encerrado' then 'desligamento' end, case when $5::text = 'encerrado' then now() end) returning id`,
      [escola.escolaId, escola.anoId, usuarioId, turmaId, estado, escola.coordenadorId],
    )
    return { turmaId, vinculoId: rows[0]?.id ?? '' }
  }

  const texto = (...linhas: string[]): string => ['nome;email', ...linhas].join('\n')

  /** O gravar da coordenação, pelo motor (sem fila): devolve o id da importação `na_fila`. */
  function gravar(escola: Escola, planilha: string, desligar: readonly string[] = []): Promise<string> {
    const motor = new MotorDePlanilha(bancada.banco, { enfileirar: () => Promise.resolve(randomUUID()) })
    const contexto = { requisicaoId: randomUUID(), escolaId: escola.escolaId, usuarioId: escola.coordenadorId, papel: 'coordenador' as const, sessaoId: randomUUID(), ...(escola.anoId === undefined ? {} : { anoLetivoId: escola.anoId }) }
    return runInContext(contexto, async () => (await motor.gravar('professores', { texto: planilha, marcas: { ...SEM_MARCAS, desligar: [...desligar] } })).id)
  }

  /** Uma tentativa do job, como o executor a entrega: no contexto da escola da linha do outbox. */
  function tentar(escolaId: string, importacaoId: string, tentativa = 1, processador = gravacao): Promise<void> {
    return runInContext({ requisicaoId: randomUUID(), escolaId }, () => processador({ importacaoId }, jobExecution(randomUUID(), tentativa)))
  }

  async function importacao(importacaoId: string): Promise<{ estado: string; erro: string | null; linhas: unknown; marcas: unknown; resumo: Record<string, number> | null }> {
    const { rows } = await bancada.pool.query<{ estado: string; erro: string | null; linhas: unknown; marcas: unknown; resumo: Record<string, number> | null }>('select estado, erro, linhas, marcas, resumo from importacao_planilha where id = $1', [importacaoId])
    return rows[0] ?? { estado: 'sumiu', erro: null, linhas: undefined, marcas: undefined, resumo: null }
  }

  interface UsuarioNoBanco {
    readonly id: string
    readonly nome: string
    readonly ativo: boolean
    readonly convitesEmAberto: number
    readonly convitesTotal: number
    readonly diasDoConvite: number | null
  }

  /** O professor da escola com esse e-mail, pela conta, com o estado do convite em aberto. */
  async function professorDe(escolaId: string, email: string): Promise<UsuarioNoBanco | undefined> {
    const { rows } = await bancada.pool.query<UsuarioNoBanco>(
      `select u.id, u.nome, u.desativado_em is null as ativo,
              (select count(*)::int from convite c where c.escola_id = u.escola_id and c.usuario_id = u.id and c.usado_em is null and c.revogado_em is null) as "convitesEmAberto",
              (select count(*)::int from convite c where c.escola_id = u.escola_id and c.usuario_id = u.id) as "convitesTotal",
              (select round(extract(epoch from (max(c.expira_em) - now())) / 86400)::int from convite c where c.escola_id = u.escola_id and c.usuario_id = u.id) as "diasDoConvite"
         from usuario u join conta on conta.id = u.conta_id where u.escola_id = $1 and u.papel = 'professor' and conta.email = $2`,
      [escolaId, email],
    )
    return rows[0]
  }

  const ativoPeloId = async (usuarioId: string): Promise<boolean> => (await bancada.pool.query<{ ativo: boolean }>('select desativado_em is null as ativo from usuario where id = $1', [usuarioId])).rows[0]?.ativo ?? true

  const contasDe = async (email: string): Promise<number> => (await bancada.pool.query<{ total: number }>('select count(*)::int as total from conta where email = $1', [email])).rows[0]?.total ?? 0

  async function auditoriaDa(escolaId: string, acao: string): Promise<Array<{ entidade_id: string; autor_usuario_id: string | null; depois: unknown }>> {
    const { rows } = await bancada.pool.query<{ entidade_id: string; autor_usuario_id: string | null; depois: unknown }>('select entidade_id, autor_usuario_id, depois from auditoria where escola_id = $1 and acao = $2 order by id', [escolaId, acao])
    return rows
  }

  /** Quantas vezes o passo (3) foi medido, em qualquer escola: só a execução que chega a ele mede. */
  async function passosMedidos(): Promise<number> {
    const [duracao] = await medidor.pontos('importacao.passo3.duracao')
    return typeof duracao?.valor === 'object' ? duracao.valor.contagem : 0
  }

  async function resultados(): Promise<Record<string, number>> {
    const pontos = await medidor.pontos('importacao.job')
    return Object.fromEntries(pontos.map(({ atributos, valor }) => [String(atributos['resultado']), valor as number]))
  }

  it('o job cadastra cada professor `pendente`, com um convite de 7 dias sem token, a conta achada ou criada, e a auditoria da coordenação sem nome nem e-mail', async () => {
    const escola = await escolaNova()
    const ana = emailDe('ana')
    const bruno = emailDe('bruno')
    const id = await gravar(escola, texto(`Ana Souza;${ana}`, `Bruno Lima;${bruno}`))

    await tentar(escola.escolaId, id)

    expect(await importacao(id)).toEqual({ estado: 'concluida', erro: null, linhas: null, marcas: null, resumo: { entram: 2, ja_existem: 0, desligados: 0 } })
    expect(await professorDe(escola.escolaId, ana)).toMatchObject({ nome: 'Ana Souza', ativo: false, convitesEmAberto: 1, convitesTotal: 1, diasDoConvite: 7 })
    expect(await professorDe(escola.escolaId, bruno)).toMatchObject({ nome: 'Bruno Lima', ativo: false, convitesEmAberto: 1 })
    expect(await contasDe(ana)).toBe(1)
    for (const acao of ['professor.cadastrado', 'convite.criado']) {
      const linhas = await auditoriaDa(escola.escolaId, acao)
      expect(linhas, acao).toHaveLength(2)
      expect(linhas.every((linha) => linha.autor_usuario_id === escola.coordenadorId), acao).toBe(true)
      expect(JSON.stringify(linhas), acao).not.toMatch(/Ana|Bruno|professores\.invalid/)
    }
    const [gravada] = await auditoriaDa(escola.escolaId, 'planilha.gravada')
    expect(gravada?.depois).toEqual({ tipo: 'professores', contagens: { entram: 2, ja_existem: 0, desligados: 0 } })
  })

  it('o mesmo e-mail duas vezes, em qualquer caixa, é uma pessoa: um usuário, um convite e uma conta', async () => {
    const escola = await escolaNova()
    const email = emailDe('dupla')
    const id = await gravar(escola, texto(`Dupla Nome;${email}`, `Outra Grafia;${email.toUpperCase()}`))

    await tentar(escola.escolaId, id)

    expect((await importacao(id)).resumo).toEqual({ entram: 1, ja_existem: 0, desligados: 0 })
    expect(await professorDe(escola.escolaId, email)).toMatchObject({ nome: 'Dupla Nome', convitesTotal: 1 })
    expect(await contasDe(email)).toBe(1)
    const { rows } = await bancada.pool.query<{ total: number }>("select count(*)::int as total from usuario where escola_id = $1 and papel = 'professor'", [escola.escolaId])
    expect(rows[0]?.total).toBe(1)
  })

  it('escola sem ano em curso: a planilha de professores funciona', async () => {
    const escola = await escolaNova(false)
    const email = emailDe('sem-ano')
    const id = await gravar(escola, texto(`Sem Ano;${email}`))

    await tentar(escola.escolaId, id)

    expect((await importacao(id)).estado).toBe('concluida')
    expect(await professorDe(escola.escolaId, email)).toMatchObject({ ativo: false, convitesEmAberto: 1 })
    const { rows } = await bancada.pool.query<{ ano_letivo_id: string | null }>('select ano_letivo_id from importacao_planilha where id = $1', [id])
    expect(rows[0]?.ano_letivo_id).toBeNull()
  })

  it('o professor que já está na escola não muda: ativo e com convite em aberto aparecem como "já existe", sem convite novo', async () => {
    const escola = await escolaNova()
    const ativa = await professorNaEscola(escola, 'Ativa da Silva')
    const idDaPrimeira = await gravar(escola, texto(`Pendente Antes;${emailDe('pendente')}`))
    await tentar(escola.escolaId, idDaPrimeira)
    const { rows: pendente } = await bancada.pool.query<{ email: string }>("select conta.email from usuario u join conta on conta.id = u.conta_id where u.escola_id = $1 and u.nome = 'Pendente Antes'", [escola.escolaId])
    const emailDoPendente = pendente[0]?.email ?? ''

    const id = await gravar(escola, texto(`Outro Nome;${ativa.email}`, `Outro Nome Ainda;${emailDoPendente}`))
    await tentar(escola.escolaId, id)

    expect((await importacao(id)).resumo).toEqual({ entram: 0, ja_existem: 2, desligados: 0 })
    expect(await professorDe(escola.escolaId, ativa.email)).toMatchObject({ nome: 'Ativa da Silva', ativo: true, convitesTotal: 0 })
    expect(await professorDe(escola.escolaId, emailDoPendente)).toMatchObject({ nome: 'Pendente Antes', convitesTotal: 1 })
  })

  it('o professor de convite revogado volta a esperar o convite novo, com o nome da planilha', async () => {
    const escola = await escolaNova()
    const email = emailDe('revogada')
    await tentar(escola.escolaId, await gravar(escola, texto(`Nome Velho;${email}`)))
    await bancada.pool.query("update convite set revogado_em = now() where escola_id = $1", [escola.escolaId])

    const id = await gravar(escola, texto(`Nome Novo;${email}`))
    await tentar(escola.escolaId, id)

    expect((await importacao(id)).resumo).toEqual({ entram: 1, ja_existem: 0, desligados: 0 })
    expect(await professorDe(escola.escolaId, email)).toMatchObject({ nome: 'Nome Novo', ativo: false, convitesEmAberto: 1, convitesTotal: 2 })
  })

  it('ausente da planilha e sem marca: o professor segue ativo, com os vínculos', async () => {
    const escola = await escolaNova()
    const ausente = await professorNaEscola(escola, 'Ausente Sem Marca')
    const { vinculoId } = await vinculoDe(escola, ausente.usuarioId, 'confirmado')
    const id = await gravar(escola, texto(`Nova Pessoa;${emailDe('nova')}`))

    await tentar(escola.escolaId, id)

    expect((await importacao(id)).resumo).toEqual({ entram: 1, ja_existem: 0, desligados: 0 })
    expect(await professorDe(escola.escolaId, ausente.email)).toMatchObject({ ativo: true })
    const { rows } = await bancada.pool.query<{ estado: string }>('select estado from vinculo where id = $1', [vinculoId])
    expect(rows[0]?.estado).toBe('confirmado')
  })

  it('ausente e marcado: o `desativar` o desliga, encerra os vínculos dele (confirmado, pendente e encerrado) por desligamento, e a auditoria é da coordenação; o outro ausente fica', async () => {
    const escola = await escolaNova()
    const saindo = await professorNaEscola(escola, 'Marcada Para Sair')
    const ficando = await professorNaEscola(escola, 'Ausente Que Fica')
    const confirmado = await vinculoDe(escola, saindo.usuarioId, 'confirmado')
    const pendente = await vinculoDe(escola, saindo.usuarioId, 'pendente')
    const encerrado = await vinculoDe(escola, saindo.usuarioId, 'encerrado')
    const doOutro = await vinculoDe(escola, ficando.usuarioId, 'confirmado')
    const id = await gravar(escola, texto(`Quem Entra;${emailDe('entra')}`), [saindo.usuarioId])

    await tentar(escola.escolaId, id)

    expect((await importacao(id)).resumo).toEqual({ entram: 1, ja_existem: 0, desligados: 1 })
    // Sem outro usuário na conta, a desativação a limpa (o e-mail some): o professor se acha pelo id.
    expect(await ativoPeloId(saindo.usuarioId)).toBe(false)
    expect(await professorDe(escola.escolaId, ficando.email)).toMatchObject({ ativo: true })
    const { rows } = await bancada.pool.query<{ id: string; estado: string; motivo_encerramento: string | null }>('select id, estado, motivo_encerramento from vinculo where escola_id = $1 order by id', [escola.escolaId])
    const porId = new Map(rows.map((linha) => [linha.id, linha]))
    for (const vinculo of [confirmado, pendente, encerrado]) expect(porId.get(vinculo.vinculoId), vinculo.vinculoId).toMatchObject({ estado: 'encerrado', motivo_encerramento: 'desligamento' })
    expect(porId.get(doOutro.vinculoId)).toMatchObject({ estado: 'confirmado' })
    const desativados = await auditoriaDa(escola.escolaId, 'usuario.desativado')
    expect(desativados.map((linha) => [linha.entidade_id, linha.autor_usuario_id])).toEqual([[saindo.usuarioId, escola.coordenadorId]])
  })

  it('ausente que aceitou o convite com a conta que já tinha senha e não entrou (`aceito`): marcado, sai `desativado`', async () => {
    const escola = await escolaNova()
    const espera = await professorNaEscola(escola, 'Aceitou E Nao Entrou', false)
    await bancada.pool.query(
      "insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, usado_em) values ($1, $2, 'professor', $3, now() + interval '7 days', now() + interval '1 second')",
      [escola.escolaId, randomUUID().replaceAll('-', '').padEnd(64, 'a'), espera.usuarioId],
    )
    const id = await gravar(escola, texto(`Outra Pessoa;${emailDe('outra')}`), [espera.usuarioId])

    await tentar(escola.escolaId, id)

    expect((await importacao(id)).resumo).toEqual({ entram: 1, ja_existem: 0, desligados: 1 })
    expect((await auditoriaDa(escola.escolaId, 'usuario.desativado')).map((linha) => linha.entidade_id)).toEqual([espera.usuarioId])
  })

  it('o `resumo` e a `planilha.gravada` de e-mail com conta em outra escola cliente são iguais aos de e-mail novo', async () => {
    const outraEscola = await escolaNova()
    const jaTemConta = await professorNaEscola(outraEscola, 'Em Outra Escola')
    const a = await escolaNova()
    const b = await escolaNova()
    const idA = await gravar(a, texto(`Com Conta Fora;${jaTemConta.email}`))
    const idB = await gravar(b, texto(`Sem Conta Fora;${emailDe('inedito')}`))

    await tentar(a.escolaId, idA)
    await tentar(b.escolaId, idB)

    expect((await importacao(idA)).resumo).toEqual((await importacao(idB)).resumo)
    expect((await auditoriaDa(a.escolaId, 'planilha.gravada')).map((linha) => linha.depois)).toEqual((await auditoriaDa(b.escolaId, 'planilha.gravada')).map((linha) => linha.depois))
    expect((await auditoriaDa(a.escolaId, 'convite.criado')).map((linha) => Object.keys(linha.depois as object))).toEqual((await auditoriaDa(b.escolaId, 'convite.criado')).map((linha) => Object.keys(linha.depois as object)))
    expect(await contasDe(jaTemConta.email)).toBe(1)
    expect(await professorDe(a.escolaId, jaTemConta.email)).toMatchObject({ ativo: false, convitesEmAberto: 1 })
    expect(await professorDe(outraEscola.escolaId, jaTemConta.email)).toMatchObject({ ativo: true })
  })

  it('[P] duas escolas importam o mesmo professor ao mesmo tempo: as duas `concluida`, uma só conta', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const email = emailDe('em-duas')
    const idA = await gravar(a, texto(`Em Duas;${email}`))
    const idB = await gravar(b, texto(`Em Duas;${email}`))

    await Promise.all([tentar(a.escolaId, idA), tentar(b.escolaId, idB)])

    expect([(await importacao(idA)).estado, (await importacao(idB)).estado]).toEqual(['concluida', 'concluida'])
    expect(await contasDe(email)).toBe(1)
    expect(await professorDe(a.escolaId, email)).toMatchObject({ convitesEmAberto: 1 })
    expect(await professorDe(b.escolaId, email)).toMatchObject({ convitesEmAberto: 1 })
  })

  it('[P] duas escolas importam os mesmos professores em ordens opostas: as duas `concluida`, porque o passo (1) segue a ordem do e-mail e não a da planilha', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const emails = ['a', 'b', 'c', 'd', 'e', 'f'].map((letra) => emailDe(`ordem-${letra}`)).sort()
    const linhas = emails.map((email, posicao) => `Pessoa ${String(posicao)};${email}`)
    const idA = await gravar(a, texto(...linhas))
    const idB = await gravar(b, texto(...[...linhas].reverse()))

    await Promise.all([tentar(a.escolaId, idA), tentar(b.escolaId, idB)])

    expect([(await importacao(idA)).estado, (await importacao(idB)).estado]).toEqual(['concluida', 'concluida'])
    for (const email of emails) expect(await contasDe(email), email).toBe(1)
  })

  it('[P] candidato desativado à mão entre o passo (2) e o (3): `desatualizada`, sem cadastro e sem desligamento', async () => {
    const escola = await escolaNova()
    const candidato = await professorNaEscola(escola, 'Desativada No Meio')
    const email = emailDe('nao-entra')
    const id = await gravar(escola, texto(`Nao Entra;${email}`), [candidato.usuarioId])
    // O passo (3) para na trava da importação, que o teste segura: o (1) e o (2) já passaram.
    const segurador = await bancada.pool.connect()
    let tentativa: Promise<void>
    try {
      await segurador.query('begin')
      await segurador.query('select id from importacao_planilha where id = $1 for update', [id])
      tentativa = tentar(escola.escolaId, id)
      await esperarNaTrava(bancada.pool, '%importacao_planilha%for update%')
      await segurador.query('update usuario set desativado_em = now() where id = $1', [candidato.usuarioId])
      await segurador.query('commit')
    } finally {
      segurador.release()
    }
    await tentativa

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada', linhas: null, marcas: null })
    expect(await professorDe(escola.escolaId, email)).toBeUndefined()
    expect((await auditoriaDa(escola.escolaId, 'usuario.desativado')).length).toBe(0)
  })

  it('o `desativar` que não alcança o marcado (zero linhas no `update` do usuário, o `NAO_ENCONTRADO`): `desatualizada`, e o cadastro da mesma planilha volta junto', async () => {
    const escola = await escolaNova()
    const candidato = await professorNaEscola(escola, 'Que O Update Nao Pega')
    const email = emailDe('volta-junto')
    const id = await gravar(escola, texto(`Volta Junto;${email}`), [candidato.usuarioId])
    // Um gatilho só do banco de teste que pula o `update` desse usuário: o plano o viu ativo, e o `desativar` não o altera.
    const nome = `teste_pula_${randomUUID().slice(0, 8).replaceAll('-', '')}`
    await bancada.pool.query(`create function ${nome}() returns trigger language plpgsql as $$ begin return null; end $$`)
    await bancada.pool.query(`create trigger ${nome} before update on usuario for each row when (old.id = '${candidato.usuarioId}') execute function ${nome}()`)
    onTestFinished(async () => {
      await bancada.pool.query(`drop trigger if exists ${nome} on usuario`)
      await bancada.pool.query(`drop function if exists ${nome}()`)
    })

    await tentar(escola.escolaId, id)

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada', linhas: null, marcas: null })
    expect(await professorDe(escola.escolaId, email)).toBeUndefined()
    expect(await professorDe(escola.escolaId, candidato.email)).toMatchObject({ ativo: true })
  })

  it('o passo (3) trava as turmas de todos os vínculos dos desligados, de todos os estados, num único `for no key update` em ordem de id, antes de encerrar vínculo algum, e depois dos anos, dos usuários e das contas', async () => {
    const escola = await escolaNova()
    const saindo = await professorNaEscola(escola, 'Com Varias Turmas')
    const outro = await professorNaEscola(escola, 'Tambem Sai')
    const turmas = [(await vinculoDe(escola, saindo.usuarioId, 'confirmado')).turmaId, (await vinculoDe(escola, saindo.usuarioId, 'pendente')).turmaId, (await vinculoDe(escola, saindo.usuarioId, 'encerrado')).turmaId]
    const turmaDoOutro = (await vinculoDe(escola, outro.usuarioId, 'confirmado')).turmaId
    const id = await gravar(escola, texto(`Quem Entra;${emailDe('entra-2')}`), [saindo.usuarioId, outro.usuarioId])
    sqlDoJob.length = 0
    parametrosDoJob.length = 0
    const espiado = drizzle({
      client: apoio,
      schema,
      casing: 'snake_case',
      logger: {
        logQuery: (consulta: string, parametros: unknown[]) => {
          sqlDoJob.push(consulta.toLowerCase())
          parametrosDoJob.push(parametros)
        },
      },
    }) as unknown as Database
    const espiao = criarGravacaoDaPlanilha({ banco: espiado, logger: log.logger })

    await tentar(escola.escolaId, id, 1, espiao)

    const posicao = (padrao: RegExp): number => sqlDoJob.findIndex((consulta) => padrao.test(consulta))
    const travasDeTurma = sqlDoJob.filter((consulta) => /^select .*from "turma".* for no key update$/.test(consulta))
    expect(travasDeTurma.length).toBeGreaterThanOrEqual(1)
    expect(travasDeTurma[0]).toMatch(/order by "turma"\."id" asc for no key update$/)
    const primeiraDaTurma = posicao(/^select .*from "turma".* for no key update$/)
    expect(parametrosDoJob[primeiraDaTurma]).toEqual(expect.arrayContaining([escola.escolaId, saindo.usuarioId, outro.usuarioId]))
    expect(sqlDoJob[posicao(/^select .*from "usuario".* for no key update$/)]).toMatch(/order by "usuario"\."id" asc for no key update$/)
    expect(sqlDoJob[posicao(/^select .*from "conta".* for share$/)]).toMatch(/order by "conta"\."id" asc for share$/)
    expect(posicao(/^select .*from "importacao_planilha".* for update$/)).toBeLessThan(posicao(/pg_advisory_xact_lock/))
    expect(posicao(/pg_advisory_xact_lock/)).toBeLessThan(posicao(/^select .*from "ano_letivo".* for share$/))
    expect(posicao(/^select .*from "ano_letivo".* for share$/)).toBeLessThan(posicao(/^select .*from "usuario".* for no key update$/))
    expect(posicao(/^select .*from "usuario".* for no key update$/)).toBeLessThan(posicao(/^select .*from "conta".* for share$/))
    expect(posicao(/^select .*from "conta".* for share$/)).toBeLessThan(primeiraDaTurma)
    expect(primeiraDaTurma).toBeLessThan(posicao(/^(select .*from "vinculo".* for update|update "vinculo")/))
    expect(await importacao(id)).toMatchObject({ estado: 'concluida' })
    const { rows } = await bancada.pool.query<{ turma_id: string }>("select turma_id from vinculo where usuario_id = any($1::uuid[]) and estado = 'encerrado'", [[saindo.usuarioId, outro.usuarioId]])
    expect(rows.map((linha) => linha.turma_id).sort()).toEqual([...turmas, turmaDoOutro].sort())
  })

  it('[P] duas escolas desligam o mesmo professor pela planilha ao mesmo tempo: as duas `concluida` (o `40P01` entre os jobs vira nova tentativa)', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const email = emailDe('em-duas-saindo')
    const contaCompartilhada = (await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [email])).rows[0]?.id ?? ''
    const saindoDe = async (escola: Escola): Promise<string> => {
      const { rows } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'professor', 'Nas Duas', $2) returning id", [escola.escolaId, contaCompartilhada])
      await vinculoDe(escola, rows[0]?.id ?? '', 'confirmado')
      return rows[0]?.id ?? ''
    }
    const idA = await gravar(a, texto(`Quem Entra A;${emailDe('ea')}`), [await saindoDe(a)])
    const idB = await gravar(b, texto(`Quem Entra B;${emailDe('eb')}`), [await saindoDe(b)])

    // Cada job tem as tentativas da fila: o deadlock de uma vira a nova tentativa, e a segunda conclui.
    const comRepeticao = async (escola: Escola, importacaoId: string): Promise<void> => {
      for (let tentativa = 1; tentativa <= ULTIMA; tentativa++) {
        try {
          await tentar(escola.escolaId, importacaoId, tentativa)
          return
        } catch {
          // a nova tentativa é a da fila
        }
      }
    }
    await Promise.all([comRepeticao(a, idA), comRepeticao(b, idB)])

    expect([(await importacao(idA)).estado, (await importacao(idB)).estado]).toEqual(['concluida', 'concluida'])
    expect([(await importacao(idA)).erro, (await importacao(idB)).erro]).toEqual([null, null])
    const { rows } = await bancada.pool.query<{ total: number }>("select count(*)::int as total from usuario where conta_id = $1 and desativado_em is not null", [contaCompartilhada])
    expect(rows[0]?.total).toBe(2)
  })

  it('[P] o expurgo de acesso limpa a conta entre o passo (1) e o (3): a nova tentativa refaz o (1), e nenhum convite vai para conta sem e-mail', async () => {
    const escola = await escolaNova()
    const email = emailDe('limpa-no-meio')
    // A conta já existe, sem usuário nenhum: é a que o (1) vai achar, e a que a limpeza esvazia.
    const contaId = (await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [email])).rows[0]?.id ?? ''
    const id = await gravar(escola, texto(`Conta Limpa;${email}`))
    const segurador = await bancada.pool.connect()
    let primeira: Promise<void>
    try {
      await segurador.query('begin')
      await segurador.query('select id from importacao_planilha where id = $1 for update', [id])
      primeira = tentar(escola.escolaId, id, 1)
      await esperarNaTrava(bancada.pool, '%importacao_planilha%for update%')
      // A limpeza da conta sem uso (a do expurgo de acesso): o e-mail some enquanto o passo (3) espera a importação.
      await segurador.query('update conta set email = null where id = $1', [contaId])
      await segurador.query('commit')
    } finally {
      segurador.release()
    }

    await expect(primeira).rejects.toBeInstanceOf(ContaDaPlanilhaPerdidaError)
    expect(await importacao(id)).toMatchObject({ estado: 'na_fila' })
    const { rows: convites } = await bancada.pool.query<{ total: number }>('select count(*)::int as total from convite where escola_id = $1', [escola.escolaId])
    expect(convites[0]?.total).toBe(0)

    await tentar(escola.escolaId, id, 2)

    expect((await importacao(id)).estado).toBe('concluida')
    expect(await professorDe(escola.escolaId, email)).toMatchObject({ ativo: false, convitesEmAberto: 1 })
    expect(await contasDe(email)).toBe(1)
    const { rows } = await bancada.pool.query<{ id: string }>('select id from conta where email = $1', [email])
    expect(rows[0]?.id).not.toBe(contaId)
  })

  it('a conta que o passo (1) achou é travada `for share` no (3), e a limpeza que chega depois espera o fim do passo', async () => {
    const escola = await escolaNova()
    const email = emailDe('travada')
    const id = await gravar(escola, texto(`Conta Travada;${email}`))
    const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'convite', evento: 'insert', quando: `new.escola_id = '${escola.escolaId}'` })
    await parada.armar()
    let tentativa: Promise<void>
    try {
      tentativa = tentar(escola.escolaId, id)
      await parada.esperarParadas()
      // O passo (3) está no meio, com o convite gravado: a limpeza da conta espera.
      const limpeza = bancada.pool.query('update conta set email = null where email = $1', [email])
      await esperarNaTrava(bancada.pool, '%update conta set email%')
      await parada.soltar()
      await Promise.all([tentativa, limpeza])
    } finally {
      await parada.desarmar()
    }

    expect((await importacao(id)).estado).toBe('concluida')
    expect(await contasDe(email)).toBe(0)
    expect((await resultados())['concluida']).toBeGreaterThanOrEqual(1)
  })

  it('o `convidar` da planilha não muda o professor que já está ativo: devolve `false`, sem convite e sem trocar o nome', async () => {
    const escola = await escolaNova()
    const ativo = await professorNaEscola(escola, 'Ativo Antigo')

    const convidou = await runInContext({ requisicaoId: randomUUID(), escolaId: escola.escolaId, usuarioId: escola.coordenadorId }, () =>
      bancada.banco.transaction((tx) => convidarProfessorDaPlanilha(tx, { contaId: ativo.contaId, nome: 'Nome Trocado' })),
    )

    expect(convidou).toBe(false)
    expect(await professorDe(escola.escolaId, ativo.email)).toMatchObject({ nome: 'Ativo Antigo', ativo: true, convitesTotal: 0 })
    expect(await auditoriaDa(escola.escolaId, 'convite.criado')).toHaveLength(0)
  })

  it('o `convidar` da planilha recusa o professor que já tem convite em aberto: devolve `false` (o índice único), e a transação não deixa convite a mais', async () => {
    const escola = await escolaNova()
    const esperando = await professorNaEscola(escola, 'Com Convite Aberto', false)
    await bancada.pool.query("insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em) values ($1, $2, 'professor', $3, now() + interval '3 days')", [escola.escolaId, randomUUID().replaceAll('-', '').repeat(2), esperando.usuarioId])

    const convidou = await runInContext({ requisicaoId: randomUUID(), escolaId: escola.escolaId, usuarioId: escola.coordenadorId }, () =>
      bancada.banco.transaction((tx) => convidarProfessorDaPlanilha(tx, { contaId: esperando.contaId, nome: 'Outro Nome' })),
    )

    expect(convidou).toBe(false)
    expect(await professorDe(escola.escolaId, esperando.email)).toMatchObject({ nome: 'Com Convite Aberto', convitesTotal: 1, convitesEmAberto: 1 })
  })

  it('assinatura diferente antes do job (o candidato saiu à mão depois do gravar): `desatualizada` já no passo (2), sem cadastrar ninguém e sem chegar ao (3)', async () => {
    const escola = await escolaNova()
    const candidato = await professorNaEscola(escola, 'Sai Antes Do Job')
    const email = emailDe('nao-entra')
    const id = await gravar(escola, texto(`Nao Entra;${email}`), [candidato.usuarioId])
    await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [candidato.usuarioId])
    const medidos = await passosMedidos()

    await tentar(escola.escolaId, id)

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada', linhas: null, marcas: null })
    expect(await professorDe(escola.escolaId, email)).toBeUndefined()
    expect(await passosMedidos()).toBe(medidos)
  })

  it('falha definitiva: as linhas guardadas sem a forma do tipo, ou as marcas sem a forma, saem `falhou` na primeira tentativa, sem repetir', async () => {
    const escola = await escolaNova()
    const semForma = await gravar(escola, texto(`Linha Ruim;${emailDe('ruim')}`))
    await bancada.pool.query('update importacao_planilha set linhas = $2::jsonb where id = $1', [semForma, JSON.stringify([{ tipo: 'inventado' }])])
    await expect(tentar(escola.escolaId, semForma, 1)).rejects.toBeInstanceOf(JobFailureError)
    expect(await importacao(semForma)).toMatchObject({ estado: 'falhou', erro: 'erro_interno' })

    const marcasRuins = await gravar(escola, texto(`Marca Ruim;${emailDe('marca-ruim')}`))
    await bancada.pool.query('update importacao_planilha set marcas = $2::jsonb where id = $1', [marcasRuins, JSON.stringify('nao-sao-marcas')])
    await expect(tentar(escola.escolaId, marcasRuins, 1)).rejects.toBeInstanceOf(JobFailureError)
    expect(await importacao(marcasRuins)).toMatchObject({ estado: 'falhou', erro: 'erro_interno' })
  })

  it('o motor sem o achar-ou-criar conta do worker não grava a planilha de professores: a falha é de invariante, e a importação segue `na_fila`', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, texto(`Sem Worker;${emailDe('sem-worker')}`))

    const rodar = (opcoes: Parameters<typeof executarPlanilha>[2]) => runInContext({ requisicaoId: randomUUID(), escolaId: escola.escolaId }, () => executarPlanilha(bancoDoJob, id, opcoes))

    await expect(rodar({})).rejects.toThrow('achar-ou-criar conta')
    // Só com o achar-ou-criar: sem a trava das contas o job também não começa, e nenhuma conta nasce.
    await expect(rodar({ acharConta: () => Promise.reject(new Error('não devia achar conta')) })).rejects.toThrow('trava das contas')

    expect((await importacao(id)).estado).toBe('na_fila')
  })

  it('o último convite decide o estado: professor com convite antigo revogado e outro em aberto é "já existe", sem convite novo', async () => {
    const escola = await escolaNova()
    const esperando = await professorNaEscola(escola, 'Dois Convites', false)
    await bancada.pool.query(
      "insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, revogado_em) values ($1, $2, 'professor', $4, now() + interval '1 day', now()), ($1, $3, 'professor', $4, now() + interval '5 days', null)",
      [escola.escolaId, randomUUID().replaceAll('-', '').repeat(2), randomUUID().replaceAll('-', '').repeat(2), esperando.usuarioId],
    )
    const id = await gravar(escola, texto(`Dois Convites;${esperando.email}`))

    await tentar(escola.escolaId, id)

    expect((await importacao(id)).estado).toBe('concluida')
    expect(await professorDe(escola.escolaId, esperando.email)).toMatchObject({ convitesTotal: 2, convitesEmAberto: 1 })
  })

  it('a conta com o e-mail em maiúsculas casa com a planilha em minúsculas: o professor ativo é "já existe", e a conta sem usuário entra e é travada sem perder o e-mail', async () => {
    const escola = await escolaNova()
    const existente = await professorNaEscola(escola, 'Conta Em Caixa Alta')
    await bancada.pool.query('update conta set email = upper(email) where id = $1', [existente.contaId])
    const novo = emailDe('caixa-alta-nova')
    const contaId = (await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [novo.toUpperCase()])).rows[0]?.id ?? ''
    const id = await gravar(escola, texto(`Conta Em Caixa Alta;${existente.email}`, `Nova Em Caixa Alta;${novo}`))

    await tentar(escola.escolaId, id)

    expect(await importacao(id)).toMatchObject({ estado: 'concluida', resumo: { entram: 1, ja_existem: 1 } })
    expect(await professorDe(escola.escolaId, existente.email)).toMatchObject({ ativo: true, convitesTotal: 0 })
    expect(await professorDe(escola.escolaId, novo)).toMatchObject({ ativo: false, convitesEmAberto: 1 })
    expect((await bancada.pool.query<{ total: number }>('select count(*)::int as total from conta where id = $1', [contaId])).rows[0]?.total).toBe(1)
  })

  it('a trava do convite da escola: com ela na mão de outra operação (cadastrar, refazer, revogar), o passo (3) espera, estoura o `lock_timeout` e volta; solta, a tentativa seguinte conclui', async () => {
    const escola = await escolaNova()
    const email = emailDe('espera-o-convite')
    const id = await gravar(escola, texto(`Espera O Convite;${email}`))
    const segurador = await bancada.pool.connect()
    try {
      await segurador.query('begin')
      await segurador.query('select pg_advisory_xact_lock($1, hashtext($2::uuid::text))', [CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA, escola.escolaId])
      await expect(tentar(escola.escolaId, id, 1)).rejects.toSatisfy(ehFalhaDeTrava)
      expect((await importacao(id)).estado).toBe('na_fila')
      expect(await professorDe(escola.escolaId, email)).toBeUndefined()
    } finally {
      await segurador.query('rollback')
      segurador.release()
    }

    await tentar(escola.escolaId, id, 2)

    expect((await importacao(id)).estado).toBe('concluida')
    expect(await professorDe(escola.escolaId, email)).toMatchObject({ ativo: false, convitesEmAberto: 1 })
  })

  it('isolamento: a marca de um professor da escola B gravada na importação de A (à mão, sem passar pela API) não alcança B: `desatualizada`, B segue ativo e o job não espera a trava dele', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const deB = await professorNaEscola(b, 'Professor Da B')
    const vinculoDeB = await vinculoDe(b, deB.usuarioId, 'confirmado')
    const emailNovo = emailDe('entra-na-a')
    const id = await gravar(a, texto(`Entra Na A;${emailNovo}`))
    await bancada.pool.query('update importacao_planilha set marcas = $2::jsonb where id = $1', [id, JSON.stringify({ ...SEM_MARCAS, desligar: [deB.usuarioId] })])
    const segurador = await bancada.pool.connect()
    try {
      // A linha do professor da B está travada por outra transação: se o passo (3) da A a travasse, estouraria o `lock_timeout`.
      await segurador.query('begin')
      await segurador.query('select id from usuario where id = $1 for update', [deB.usuarioId])

      await tentar(a.escolaId, id)
    } finally {
      await segurador.query('rollback')
      segurador.release()
    }

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada' })
    expect(await ativoPeloId(deB.usuarioId)).toBe(true)
    const { rows } = await bancada.pool.query<{ estado: string }>('select estado from vinculo where id = $1', [vinculoDeB.vinculoId])
    expect(rows[0]?.estado).toBe('confirmado')
    expect(await professorDe(a.escolaId, emailNovo)).toBeUndefined()
  })

  it('dois professores com o mesmo nome e e-mails diferentes são duas pessoas: dois usuários, dois convites, duas contas', async () => {
    const escola = await escolaNova()
    const um = emailDe('mesmo-nome-um')
    const dois = emailDe('mesmo-nome-dois')
    const id = await gravar(escola, texto(`Maria da Silva;${um}`, `Maria da Silva;${dois}`))

    await tentar(escola.escolaId, id)

    expect((await importacao(id)).estado).toBe('concluida')
    const primeira = await professorDe(escola.escolaId, um)
    const segunda = await professorDe(escola.escolaId, dois)
    expect(primeira).toMatchObject({ nome: 'Maria da Silva', ativo: false, convitesEmAberto: 1 })
    expect(segunda).toMatchObject({ nome: 'Maria da Silva', ativo: false, convitesEmAberto: 1 })
    expect(primeira?.id).not.toBe(segunda?.id)
  })

  it('o professor `desativado` cuja conta ainda tem e-mail volta pelo mesmo usuário, com o nome da planilha e o convite novo `pendente`', async () => {
    const escola = await escolaNova()
    const desativado = await professorNaEscola(escola, 'Nome Antigo', false)
    const id = await gravar(escola, texto(`Nome Novo;${desativado.email}`))

    await tentar(escola.escolaId, id)

    expect((await importacao(id)).estado).toBe('concluida')
    expect(await professorDe(escola.escolaId, desativado.email)).toMatchObject({ id: desativado.usuarioId, nome: 'Nome Novo', ativo: false, convitesEmAberto: 1 })
  })

  it('o professor `desativado` cuja conta já foi limpa (e-mail nulo) não é achado pela planilha: o e-mail entra como pessoa nova, e o usuário antigo fica como está', async () => {
    const escola = await escolaNova()
    const antigo = await professorNaEscola(escola, 'Professor Antigo', false)
    await bancada.pool.query('update conta set email = null where id = $1', [antigo.contaId])
    const id = await gravar(escola, texto(`Professor Novo;${antigo.email}`))

    await tentar(escola.escolaId, id)

    expect((await importacao(id)).estado).toBe('concluida')
    const novo = await professorDe(escola.escolaId, antigo.email)
    expect(novo).toMatchObject({ nome: 'Professor Novo', ativo: false, convitesEmAberto: 1 })
    expect(novo?.id).not.toBe(antigo.usuarioId)
    expect(await ativoPeloId(antigo.usuarioId)).toBe(false)
    const { rows } = await bancada.pool.query<{ nome: string; convites: number }>('select u.nome, (select count(*)::int from convite c where c.usuario_id = u.id) as convites from usuario u where u.id = $1', [antigo.usuarioId])
    expect(rows[0]).toEqual({ nome: 'Professor Antigo', convites: 0 })
  })
})
