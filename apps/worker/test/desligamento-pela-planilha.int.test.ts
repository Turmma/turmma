import 'reflect-metadata'
import { createDatabase, createPool, DomainException, MotorDePlanilha, runInContext, schema, type Database, type DatabasePool } from '@educa/core'
import { CicloDeVidaService } from '@educa/core/ciclo-de-vida'
import { ListaRepository } from '@educa/core/estrutura'
import { ErrorCode } from '@educa/shared'
import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { DecisaoService } from '../../api/src/sala/decisao/decisao.service.js'
import { CredencialMatriculaRepository } from '../../api/src/credencial/credencial-matricula.repository.js'
import { esperarNaTrava, WriteBlockTrigger } from '../../api/test/write-block-trigger.js'
import { criarGravacaoDaPlanilha } from '../src/processors/gravar-planilha.js'
import { jobExecution } from './job-execution.fixture.js'
import { InMemoryLog, QueueFixtures } from './queue.fixture.js'

beforeAll(() => {
  // Worker do compose de pé poderia executar o job que o teste grava, e disputar a importação com o processador do próprio teste.
  compose('stop', ...PROCESSOS_DA_FILA)
})

/**
 * O desligamento e a virada de ano pela planilha de alunos (F2, tarefa 10.0; Tech Spec do onboarding, seção 5, "O job" e "Gravar";
 * `cenarios.md`, RF5 e "Virada de ano"), pelo processador do worker, uma tentativa por chamada. O aluno aprovado marcado "fora da
 * planilha" é desligado pelo `desativar` do ciclo de vida, na transação do passo (3); o nome não aprovado marcado sai da lista, e o
 * pedido pendente dele é encerrado sem decisão. Na planilha do ano planejado, o aluno do ano encerrado "volta" com o mesmo login. As
 * prévias, os tetos e as rotas estão em `apps/api/test/importacao-alunos.int.test.ts`; a transferência, em `transferencia-pela-planilha.int.test.ts`.
 */

const PREFIXO = `des${randomUUID().slice(0, 6)}`
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

/** A escola do desligamento: a 8A (a que a planilha cita) e a 8B (a que ela não cita), e quem está em cada uma antes da planilha. */
interface Cenario {
  readonly escola: Escola
  readonly t1: string
  readonly t2: string
  /** O ano planejado da escola, com a turma 8A dele: onde o ausente também tem vínculo. */
  readonly planejadoId: string
  /** Aprovado da 8A que a planilha traz (com o nome corrigido). */
  readonly fica: Aluno
  /** Aprovado da 8A que a planilha não traz, com senha, sessão aberta e vínculo nos dois anos. */
  readonly ausente: Aluno & { readonly vinculoDoPlanejadoId: string; readonly sessaoId: string }
  /** Segundo aprovado da 8A que a planilha não traz, e que a coordenação não marca. */
  readonly ausenteSemMarca: Aluno
  /** Aprovado da 8B, turma que a planilha não cita: nunca é candidato. */
  readonly daT2: Aluno
  /** Livre da 8A que a planilha não traz. */
  readonly livre: Nome
  /** Reivindicado da 8A que a planilha não traz, com o pedido pendente e um recusado antigo do mesmo nome. */
  readonly pendente: Nome & { readonly pedidoId: string; readonly recusadoId: string }
}

describe('estrutura.gravar-planilha, desligamento e virada de ano de aluno', () => {
  const bancada = new QueueFixtures()
  const log = new InMemoryLog('worker-teste')
  const medidor = new MedidorDeTeste()
  /** O pool dos jobs em corrida e das paradas: o da bancada tem poucas conexões, e cada parada segura uma. */
  let apoio: DatabasePool
  let bancoDoJob: Database
  let gravacao: ReturnType<typeof criarGravacaoDaPlanilha>

  beforeAll(() => {
    apoio = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 12, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    bancoDoJob = createDatabase(apoio)
    gravacao = criarGravacaoDaPlanilha({ banco: bancoDoJob, logger: log.logger, medidor: medidor.medidor })
  })

  afterAll(async () => {
    await apoio.end()
    await medidor.encerrar()
    await bancada.fechar()
  })

  const consulta = async <Registro extends object>(sql: string, parametros: unknown[] = []): Promise<Registro[]> => (await bancada.pool.query<Registro>(sql, parametros)).rows

  async function anoNovo(escolaId: string, ano: number, situacao: 'em_curso' | 'planejado' | 'encerrado'): Promise<string> {
    const [linha] = await consulta<{ id: string }>('insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, $2, $3, $4, $5) returning id', [escolaId, ano, `${String(ano)}-02-01`, `${String(ano)}-12-15`, situacao])
    return linha?.id ?? ''
  }

  async function escolaNova(situacao: 'em_curso' | 'planejado' = 'em_curso', ano = 2026): Promise<Escola> {
    const escolaId = await bancada.escola()
    const anoId = await anoNovo(escolaId, ano, situacao)
    const [conta] = await consulta<{ id: string }>('insert into conta (email) values ($1) returning id', [`${PREFIXO}-coord-${randomUUID().slice(0, 6)}@escola.invalid`])
    const [pessoa] = await consulta<{ id: string }>("insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'coordenador', 'Coordenação sintética', $2) returning id", [escolaId, conta?.id])
    return { escolaId, coordenadorId: pessoa?.id ?? '', anoId }
  }

  async function serieNova(escolaId: string): Promise<string> {
    const [serie] = await consulta<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 8) returning id", [escolaId])
    return serie?.id ?? ''
  }

  async function turmaNova(escola: Escola, serieId: string, nome: string, chave: string, anoId = escola.anoId): Promise<string> {
    const [turma] = await consulta<{ id: string }>('insert into turma (escola_id, ano_letivo_id, serie_id, nome, chave) values ($1, $2, $3, $4, $5) returning id', [escola.escolaId, anoId, serieId, nome, chave])
    return turma?.id ?? ''
  }

  /** O aluno aprovado de uma turma: usuário, credencial com senha, linha `aprovado` na lista e vínculo confirmado, como a aprovação os deixa. */
  async function alunoAprovado(escola: Escola, turmaId: string, nome: string, anoId = escola.anoId, estadoDoVinculo: 'confirmado' | 'encerrado' = 'confirmado'): Promise<Aluno> {
    const m = matricula()
    const [usuario] = await consulta<{ id: string }>("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', $2) returning id", [escola.escolaId, nome])
    const usuarioId = usuario?.id ?? ''
    await consulta("insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, 'hash-sintetico')", [escola.escolaId, usuarioId, m])
    await consulta("insert into lista_nome (escola_id, ano_letivo_id, turma_id, estado, usuario_id) values ($1, $2, $3, 'aprovado', $4)", [escola.escolaId, anoId, turmaId, usuarioId])
    return { usuarioId, nome, matricula: m, vinculoId: await vinculoDoAluno(escola, anoId, turmaId, usuarioId, estadoDoVinculo) }
  }

  async function vinculoDoAluno(escola: Escola, anoId: string, turmaId: string, usuarioId: string, estado: 'confirmado' | 'encerrado' = 'confirmado'): Promise<string> {
    const [vinculo] = await consulta<{ id: string }>(
      estado === 'confirmado'
        ? "insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now()) returning id"
        : "insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em, motivo_encerramento, encerrado_em) values ($1, $2, $3, $4, 'aluno', 'encerrado', $5, now(), 'fim_do_ano', now()) returning id",
      [escola.escolaId, anoId, usuarioId, turmaId, escola.coordenadorId],
    )
    return vinculo?.id ?? ''
  }

  async function sessaoAberta(escola: Escola, usuarioId: string): Promise<string> {
    const [sessao] = await consulta<{ id: string }>(
      "insert into sessao (escola_id, usuario_id, metodo, familia, refresh_hash, expira_em) values ($1, $2, 'matricula', gen_random_uuid(), $3, now() + interval '1 day') returning id",
      [escola.escolaId, usuarioId, randomUUID()],
    )
    return sessao?.id ?? ''
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
    const serie = await serieNova(escola.escolaId)
    const t1 = await turmaNova(escola, serie, '8A', '8a')
    const t2 = await turmaNova(escola, serie, '8B', '8b')
    const planejadoId = await anoNovo(escola.escolaId, 2027, 'planejado')
    const turmaDoPlanejado = await turmaNova(escola, serie, '8A', '8a', planejadoId)
    const fica = await alunoAprovado(escola, t1, 'Aluno Que Fica')
    const ausente = await alunoAprovado(escola, t1, 'Aluno Ausente')
    const vinculoDoPlanejadoId = await vinculoDoAluno(escola, planejadoId, turmaDoPlanejado, ausente.usuarioId)
    const sessaoId = await sessaoAberta(escola, ausente.usuarioId)
    const ausenteSemMarca = await alunoAprovado(escola, t1, 'Aluno Ausente Sem Marca')
    await sessaoAberta(escola, ausenteSemMarca.usuarioId)
    await sessaoAberta(escola, fica.usuarioId)
    const daT2 = await alunoAprovado(escola, t2, 'Aluno Da Oitava B')
    const livre = await nomeNaLista(escola, t1, 'Nome Livre Ausente', 'livre')
    const reivindicado = await nomeNaLista(escola, t1, 'Nome Reivindicado Ausente', 'reivindicado')
    const recusadoId = await pedidoDe(escola, t1, reivindicado.id, 'recusada')
    const pedidoId = await pedidoDe(escola, t1, reivindicado.id, 'pendente')
    return { escola, t1, t2, planejadoId, fica, ausente: { ...ausente, vinculoDoPlanejadoId, sessaoId }, ausenteSemMarca, daT2, livre, pendente: { ...reivindicado, pedidoId, recusadoId } }
  }

  const texto = (...linhas: string[]): string => ['turma;nome;matricula', ...linhas].join('\n')

  /** A planilha que traz só o aprovado `fica` da 8A (com o nome corrigido): todos os outros da 8A estão ausentes, e a 8B não é citada. */
  const planilhaDe = (c: Cenario, nomeDoFica = c.fica.nome): string => texto(`8A;${nomeDoFica};${c.fica.matricula}`)

  const contextoDe = (escola: Escola) => ({ requisicaoId: randomUUID(), escolaId: escola.escolaId, usuarioId: escola.coordenadorId, papel: 'coordenador' as const, sessaoId: randomUUID(), anoLetivoId: escola.anoId })
  const motor = (): MotorDePlanilha => new MotorDePlanilha(bancada.banco, { enfileirar: () => Promise.resolve(randomUUID()) })

  interface CandidatoLido {
    readonly id: string
    readonly acao: string
    readonly rotulo: string
  }

  const candidatosDe = (escola: Escola, planilha: string): Promise<readonly CandidatoLido[]> => runInContext(contextoDe(escola), async () => (await motor().previa('alunos', { texto: planilha })).candidatos)

  /** O gravar da coordenação, pelo motor (sem fila), com a marca dos candidatos que `marcar` escolhe (por padrão, nenhum). */
  async function gravar(escola: Escola, planilha: string, marcar: (candidato: CandidatoLido) => boolean = () => false): Promise<string> {
    const marcados = (await candidatosDe(escola, planilha)).filter(marcar).map(({ id }) => id)
    return runInContext(contextoDe(escola), async () => (await motor().gravar('alunos', { texto: planilha, marcas: { transferir: [], desligar: marcados, encerrar: [] } })).id)
  }

  /** A marca de quem o rótulo da prévia nomeia (o nome do banco, e a matrícula entre parênteses). */
  const quemSe = (...nomes: string[]) => (candidato: CandidatoLido) => candidato.acao === 'desligar' && nomes.some((nome) => candidato.rotulo.startsWith(nome))

  /** Uma tentativa do job, como o executor a entrega: no contexto da escola da linha do outbox. */
  function tentar(escolaId: string, importacaoId: string): Promise<void> {
    return runInContext({ requisicaoId: randomUUID(), escolaId }, () => gravacao({ importacaoId }, jobExecution(randomUUID(), 1)))
  }

  const contadorDeLogin = { chaveDe: (identificador: string) => identificador, zerar: () => Promise.resolve(true) }
  const aprovarPeloServico = (escola: Escola, pedidoId: string) => runInContext(contextoDe(escola), () => new DecisaoService(bancoDoJob, contadorDeLogin).decidir({ ids: [pedidoId], decisao: 'aprovar' }))

  const importacao = async (id: string) => (await consulta<{ estado: string; erro: string | null; resumo: Record<string, number> | null }>('select estado, erro, resumo from importacao_planilha where id = $1', [id]))[0]

  const usuarioDe = async (id: string) => (await consulta<{ desativado: boolean }>('select desativado_em is not null as desativado from usuario where id = $1', [id]))[0]?.desativado
  const senhaDe = async (usuarioId: string) => (await consulta<{ senha_hash: string | null }>('select senha_hash from credencial_matricula where usuario_id = $1', [usuarioId]))[0]?.senha_hash

  const vinculosDe = (usuarioId: string) =>
    consulta<{ id: string; ano_letivo_id: string; turma_id: string; estado: string; motivo_encerramento: string | null; encerrado_em: Date | null; origem: string; criado_por: string; decidido_em: Date | null }>(
      'select id, ano_letivo_id, turma_id, estado, motivo_encerramento, encerrado_em, origem, criado_por, decidido_em from vinculo where usuario_id = $1 order by criado_em, id',
      [usuarioId],
    )

  const sessoesDe = (usuarioId: string) => consulta<{ encerrada: boolean; motivo: string | null }>('select encerrada_em is not null as encerrada, motivo from sessao where usuario_id = $1 order by id', [usuarioId])

  const listaDe = (escolaId: string) =>
    consulta<{ id: string; turma: string; estado: string; nome: string | null; matricula: string | null; usuario_id: string | null; ano: number }>(
      'select l.id, t.nome as turma, l.estado, l.nome, l.matricula, l.usuario_id, a.ano from lista_nome l join turma t on t.id = l.turma_id join ano_letivo a on a.id = l.ano_letivo_id where l.escola_id = $1 order by l.id',
      [escolaId],
    )

  const pedido = async (id: string) =>
    (await consulta<{ estado: string; decidida_em: Date | null; decidida_por: string | null; decidida_como: string | null; senha_hash: string | null; chave_envio: string | null; teve_matricula_errada: boolean | null; lista_nome_id: string | null }>(
      'select estado, decidida_em, decidida_por, decidida_como, senha_hash, chave_envio, teve_matricula_errada, lista_nome_id from reivindicacao where id = $1',
      [id],
    ))[0]

  /** Tudo o que o desligamento pode mexer, para comparar antes e depois. */
  async function retrato(escolaId: string): Promise<unknown> {
    return {
      lista: await consulta('select id, turma_id, estado, nome, matricula, usuario_id from lista_nome where escola_id = $1 order by id', [escolaId]),
      vinculos: await consulta('select id, usuario_id, turma_id, estado, motivo_encerramento from vinculo where escola_id = $1 order by id', [escolaId]),
      pedidos: await consulta('select id, estado, lista_nome_id, senha_hash from reivindicacao where escola_id = $1 order by id', [escolaId]),
      usuarios: await consulta('select id, desativado_em, nome from usuario where escola_id = $1 order by id', [escolaId]),
      credenciais: await consulta('select usuario_id, senha_hash from credencial_matricula where escola_id = $1 order by usuario_id', [escolaId]),
      sessoes: await consulta('select id, encerrada_em from sessao where escola_id = $1 order by id', [escolaId]),
    }
  }

  const auditoriaDa = (escolaId: string, acao: string) =>
    consulta<{ entidade_id: string; autor_usuario_id: string | null; antes: unknown; depois: unknown }>('select entidade_id, autor_usuario_id, antes, depois from auditoria where escola_id = $1 and acao = $2 order by id', [escolaId, acao])

  /** Segura a importação em `FOR UPDATE`, deixa o job passar pelo passo (2) e esperar no (3), roda `mexer` com o job parado, solta a trava e espera o job terminar. */
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

  /** Abre uma transação que escreve o que o job também vai escrever e **não confirma**, deixa o job chegar à escrita (que espera na linha), confirma, e espera o job terminar. */
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

  describe('o aluno aprovado marcado "fora da planilha"', () => {
    it('o ausente sem marca segue ativo, com a senha, as sessões e os vínculos: o banco fica como estava, o resumo não traz `desligados` nem `retirados`, e o candidato existe', async () => {
      const c = await cenario()
      const antes = await retrato(c.escola.escolaId)
      const candidatos = await candidatosDe(c.escola, planilhaDe(c))
      const id = await gravar(c.escola, planilhaDe(c, 'Nome Corrigido'))

      await tentar(c.escola.escolaId, id)

      expect(candidatos.filter((candidato) => candidato.acao === 'desligar').length).toBe(4)
      const resumo = (await importacao(id))?.resumo
      expect(resumo).toEqual({ entram: 0, ja_existem: 0, nomes_corrigidos: 1, turmas_novas: 0 })
      const depois = (await retrato(c.escola.escolaId)) as { usuarios: Array<{ id: string; nome: string }> }
      expect(depois.usuarios.find((usuario) => usuario.id === c.fica.usuarioId)?.nome).toBe('Nome Corrigido')
      expect(await usuarioDe(c.ausente.usuarioId)).toBe(false)
      expect(await senhaDe(c.ausente.usuarioId)).toBe('hash-sintetico')
      // O que a planilha corrigiu é só o nome do `fica`: o resto do banco é o mesmo.
      expect({ ...depois, usuarios: [] }).toEqual({ ...(antes as object), usuarios: [] })
    })

    it('o ausente com a marca é desligado pelo `desativar`: o usuário fica desativado, a senha é apagada, os vínculos dos dois anos são encerrados por `desligamento`, e quem não foi marcado segue como estava', async () => {
      const c = await cenario()
      const id = await gravar(c.escola, planilhaDe(c), quemSe('Aluno Ausente ('))

      await tentar(c.escola.escolaId, id)

      expect(await importacao(id)).toEqual({ estado: 'concluida', erro: null, resumo: { entram: 0, ja_existem: 1, turmas_novas: 0, desligados: 1 } })
      expect(await usuarioDe(c.ausente.usuarioId)).toBe(true)
      expect(await senhaDe(c.ausente.usuarioId)).toBeNull()
      expect((await vinculosDe(c.ausente.usuarioId)).map((v) => [v.id, v.estado, v.motivo_encerramento, v.encerrado_em !== null])).toEqual([
        [c.ausente.vinculoId, 'encerrado', 'desligamento', true],
        [c.ausente.vinculoDoPlanejadoId, 'encerrado', 'desligamento', true],
      ])
      for (const quem of [c.fica, c.ausenteSemMarca, c.daT2]) {
        expect(await usuarioDe(quem.usuarioId), quem.nome).toBe(false)
        expect(await senhaDe(quem.usuarioId), quem.nome).toBe('hash-sintetico')
        expect((await vinculosDe(quem.usuarioId)).map((v) => v.estado), quem.nome).toEqual(['confirmado'])
      }
      // A linha `aprovado` da lista fica (o aluno desativado segue com o histórico do ano), e os nomes não marcados também.
      expect((await listaDe(c.escola.escolaId)).filter((linha) => linha.usuario_id === c.ausente.usuarioId).map((linha) => [linha.turma, linha.estado, linha.nome])).toEqual([['8A', 'aprovado', null]])
      expect((await listaDe(c.escola.escolaId)).filter((linha) => [c.livre.id, c.pendente.id].includes(linha.id)).map((linha) => linha.estado).sort()).toEqual(['livre', 'reivindicado'])
    })

    it('o desligado não entra por matrícula: a credencial dele deixa de ser achada como de aluno ativo, e a do colega que ficou segue sendo', async () => {
      const c = await cenario()
      const achar = (matriculaDoAluno: string) => runInContext(contextoDe(c.escola), () => new CredencialMatriculaRepository(bancoDoJob).doAlunoAtivo(matriculaDoAluno))
      expect(await achar(c.ausente.matricula)).toMatchObject({ usuarioId: c.ausente.usuarioId, senhaHash: 'hash-sintetico' })
      const id = await gravar(c.escola, planilhaDe(c), quemSe('Aluno Ausente ('))

      await tentar(c.escola.escolaId, id)

      expect(await achar(c.ausente.matricula)).toBeUndefined()
      expect(await achar(c.fica.matricula)).toMatchObject({ usuarioId: c.fica.usuarioId })
      expect(await achar(c.ausenteSemMarca.matricula)).toMatchObject({ usuarioId: c.ausenteSemMarca.usuarioId })
    })

    it('as sessões do desligado caem, com o motivo `desativacao`, e as dos colegas seguem abertas', async () => {
      const c = await cenario()
      const id = await gravar(c.escola, planilhaDe(c), quemSe('Aluno Ausente ('))

      await tentar(c.escola.escolaId, id)

      expect(await sessoesDe(c.ausente.usuarioId)).toEqual([{ encerrada: true, motivo: 'desativacao' }])
      expect(await sessoesDe(c.fica.usuarioId)).toEqual([{ encerrada: false, motivo: null }])
      expect(await sessoesDe(c.ausenteSemMarca.usuarioId)).toEqual([{ encerrada: false, motivo: null }])
    })

    it('a auditoria `usuario.desativado` e `vinculo.encerrado` leva o id do desligado e a coordenação como autora; nenhum registro da planilha traz nome nem matrícula', async () => {
      const c = await cenario()
      const id = await gravar(c.escola, planilhaDe(c), quemSe('Aluno Ausente ('))

      await tentar(c.escola.escolaId, id)

      const desativado = await auditoriaDa(c.escola.escolaId, 'usuario.desativado')
      expect(desativado).toEqual([
        {
          entidade_id: c.ausente.usuarioId,
          autor_usuario_id: c.escola.coordenadorId,
          antes: { papel: 'aluno' },
          depois: expect.objectContaining({ sessoesEncerradas: 1, credencialApagada: true, contaExternaDesligada: false }) as unknown,
        },
      ])
      const encerrados = await auditoriaDa(c.escola.escolaId, 'vinculo.encerrado')
      expect(encerrados.map((r) => [r.entidade_id, r.autor_usuario_id, r.antes, r.depois]).sort()).toEqual(
        [
          [c.ausente.vinculoId, c.escola.coordenadorId, { estado: 'confirmado' }, { estado: 'encerrado', motivo: 'desligamento' }],
          [c.ausente.vinculoDoPlanejadoId, c.escola.coordenadorId, { estado: 'confirmado' }, { estado: 'encerrado', motivo: 'desligamento' }],
        ].sort(),
      )
      const [gravada] = await auditoriaDa(c.escola.escolaId, 'planilha.gravada')
      expect(gravada?.depois).toEqual({ tipo: 'alunos', contagens: { entram: 0, ja_existem: 1, turmas_novas: 0, desligados: 1 } })
      const serializado = JSON.stringify([...desativado, ...encerrados, gravada])
      for (const sentinela of [c.ausente.nome, c.ausente.matricula, c.fica.matricula]) expect(serializado).not.toContain(sentinela)
    })

    it('a mesma marca duas vezes desliga o aluno uma vez só: o job conclui, com um `usuario.desativado`', async () => {
      const c = await cenario()
      const planilha = planilhaDe(c)
      const marcado = (await candidatosDe(c.escola, planilha)).find(quemSe('Aluno Ausente ('))
      const id = await runInContext(contextoDe(c.escola), async () => (await motor().gravar('alunos', { texto: planilha, marcas: { transferir: [], desligar: [marcado?.id ?? '', marcado?.id ?? ''], encerrar: [] } })).id)

      await tentar(c.escola.escolaId, id)

      expect(await importacao(id)).toMatchObject({ estado: 'concluida', resumo: { desligados: 1 } })
      expect(await auditoriaDa(c.escola.escolaId, 'usuario.desativado')).toHaveLength(1)
    })

    it('a marca de quem a planilha não deixa ausente (a turma não citada, o que ela traz) é `ENTRADA_INVALIDA`, e nada é gravado', async () => {
      const c = await cenario()
      // Os dois nomes ainda não aprovados que a planilha não deixa ausentes: o de turma que ela não cita e o que ela traz.
      const livreDaT2 = await nomeNaLista(c.escola, c.t2, 'Nome Livre Da Oitava B', 'livre')
      const livreQueATrazida = await nomeNaLista(c.escola, c.t1, 'Nome Livre Que A Planilha Traz', 'livre')
      // E os de outra escola: o aprovado e o nome da B são, para a A, o mesmo que um id que não existe.
      const outra = await cenario()
      const planilha = texto(`8A;${c.fica.nome};${c.fica.matricula}`, `8A;${livreQueATrazida.nome};${livreQueATrazida.matricula}`)
      const recusa = (desligar: string[]) =>
        runInContext(contextoDe(c.escola), () => motor().gravar('alunos', { texto: planilha, marcas: { transferir: [], desligar, encerrar: [] } })).then(
          () => 'gravou',
          (erro: unknown) => (erro instanceof DomainException ? erro.codigo : 'outro erro'),
        )

      expect(await recusa([c.daT2.usuarioId])).toBe(ErrorCode.ENTRADA_INVALIDA)
      expect(await recusa([c.fica.usuarioId])).toBe(ErrorCode.ENTRADA_INVALIDA)
      expect(await recusa([livreDaT2.id])).toBe(ErrorCode.ENTRADA_INVALIDA)
      expect(await recusa([livreQueATrazida.id])).toBe(ErrorCode.ENTRADA_INVALIDA)
      expect(await recusa([outra.ausente.usuarioId])).toBe(ErrorCode.ENTRADA_INVALIDA)
      expect(await recusa([outra.livre.id])).toBe(ErrorCode.ENTRADA_INVALIDA)
      expect(await consulta('select id from importacao_planilha where escola_id = $1', [c.escola.escolaId])).toEqual([])
    })
  })

  describe('o nome não aprovado marcado "fora da planilha"', () => {
    it('o livre e o reivindicado saem da lista, o pedido pendente fica `encerrada` sem decisão nem segredo, o recusado antigo conserva a decisão, e `lista_nome.retirado` leva só a turma e o estado', async () => {
      const c = await cenario()
      const id = await gravar(c.escola, planilhaDe(c), quemSe('Nome Livre Ausente', 'Nome Reivindicado Ausente'))

      await tentar(c.escola.escolaId, id)

      expect(await importacao(id)).toEqual({ estado: 'concluida', erro: null, resumo: { entram: 0, ja_existem: 1, turmas_novas: 0, retirados: 2 } })
      expect((await listaDe(c.escola.escolaId)).filter((linha) => [c.livre.id, c.pendente.id].includes(linha.id))).toEqual([])
      expect(await pedido(c.pendente.pedidoId)).toEqual({ estado: 'encerrada', decidida_em: null, decidida_por: null, decidida_como: null, senha_hash: null, chave_envio: null, teve_matricula_errada: null, lista_nome_id: null })
      expect(await pedido(c.pendente.recusadoId)).toMatchObject({ estado: 'recusada', decidida_por: c.escola.coordenadorId, decidida_como: 'professor', lista_nome_id: null })
      const retirados = await auditoriaDa(c.escola.escolaId, 'lista_nome.retirado')
      expect(retirados.map((r) => [r.entidade_id, r.autor_usuario_id, r.antes, r.depois]).sort()).toEqual(
        [
          [c.livre.id, c.escola.coordenadorId, { turmaId: c.t1, estado: 'livre' }, null],
          [c.pendente.id, c.escola.coordenadorId, { turmaId: c.t1, estado: 'reivindicado' }, null],
        ].sort(),
      )
      const serializado = JSON.stringify(retirados)
      for (const sentinela of [c.livre.nome, c.livre.matricula, c.pendente.nome, c.pendente.matricula]) expect(serializado).not.toContain(sentinela)
      // Os alunos aprovados não foram marcados: ninguém foi desativado.
      expect(await usuarioDe(c.ausente.usuarioId)).toBe(false)
    })

    it('mais nomes do que cabem num lote (500): 501 nomes livres ausentes saem da lista, e a soma das linhas retiradas por lote fecha a conta sem `desatualizada`', async () => {
      const c = await cenario()
      const quantos = 501
      await consulta(
        `insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, estado)
         select $1, $2, $3, 'Nome Do Lote ' || g, $4 || '-' || g, 'livre' from generate_series(1, $5::int) g`,
        [c.escola.escolaId, c.escola.anoId, c.t1, `lote-${randomUUID().slice(0, 6)}`, quantos],
      )
      const id = await gravar(c.escola, planilhaDe(c), quemSe('Nome Do Lote'))

      await tentar(c.escola.escolaId, id)

      expect(await importacao(id)).toMatchObject({ estado: 'concluida', erro: null, resumo: { retirados: quantos } })
      expect((await consulta<{ total: number }>("select count(*)::int as total from lista_nome where escola_id = $1 and nome like 'Nome Do Lote %'", [c.escola.escolaId]))[0]?.total).toBe(0)
      expect((await auditoriaDa(c.escola.escolaId, 'lista_nome.retirado')).length).toBe(quantos)
    })
  })

  describe('as corridas do passo (3)', () => {
    it('[P] a reivindicação parada no nome livre ausente contra o passo (3) do desligamento: o job sai `desatualizada`, e o pedido fica pendente com o nome na lista, nunca pendente com o nome nulo', async () => {
      const c = await cenario()
      const id = await gravar(c.escola, planilhaDe(c), quemSe('Nome Livre Ausente'))
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
        '%delete from lista_nome%',
      )

      expect((await importacao(id))?.estado).toBe('desatualizada')
      expect(await pedido(pedidoNovoId)).toMatchObject({ estado: 'pendente', lista_nome_id: c.livre.id })
      expect((await listaDe(c.escola.escolaId)).find((linha) => linha.id === c.livre.id)).toMatchObject({ turma: '8A', estado: 'reivindicado', nome: c.livre.nome })
      expect(await consulta("select id from reivindicacao where escola_id = $1 and estado = 'pendente' and lista_nome_id is null", [c.escola.escolaId])).toEqual([])
    })

    it('[P] o nome livre levado à 8B à mão com o job parado na escrita: o job sai `desatualizada`, e a linha fica onde a mão a pôs', async () => {
      const c = await cenario()
      const id = await gravar(c.escola, planilhaDe(c), quemSe('Nome Livre Ausente'))

      await escritaParadaContraOJob(c.escola, id, (executar) => executar('update lista_nome set turma_id = $2 where id = $1', [c.livre.id, c.t2]) as Promise<void>, '%delete from lista_nome%')

      expect((await importacao(id))?.estado).toBe('desatualizada')
      expect((await listaDe(c.escola.escolaId)).find((linha) => linha.id === c.livre.id)).toMatchObject({ turma: '8B', estado: 'livre' })
      expect(await auditoriaDa(c.escola.escolaId, 'lista_nome.retirado')).toEqual([])
    })

    it('[P] o desligamento do reivindicado contra a decisão do mesmo pedido, com a aprovação parada na escrita da lista: o job espera na trava do pedido, relê o nome já aprovado e sai `desatualizada`; o pedido fica decidido, nunca `falhou`', async () => {
      const c = await cenario()
      const id = await gravar(c.escola, planilhaDe(c), quemSe('Nome Reivindicado Ausente'))
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

      expect(await importacao(id)).toMatchObject({ estado: 'desatualizada', erro: null })
      expect((await pedido(c.pendente.pedidoId))?.estado).toBe('aprovada')
      const novoId = (await listaDe(c.escola.escolaId)).find((linha) => linha.id === c.pendente.id)?.usuario_id ?? ''
      expect(novoId).not.toBe('')
      expect(await usuarioDe(novoId)).toBe(false)
    })

    it('[P] a decisão do pedido com o job parado depois de retirar o nome: a decisão espera na trava do pedido e sai `ja_decidida`; o desligamento conclui, o pedido fica `encerrada` e ninguém nasce com aquele nome', async () => {
      const c = await cenario()
      const id = await gravar(c.escola, planilhaDe(c), quemSe('Nome Reivindicado Ausente'))
      // O job parado na auditoria do nome retirado: já encerrou o pedido e apagou a linha, e ainda não confirmou.
      const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'auditoria', evento: 'insert', quando: `new.acao = 'lista_nome.retirado' and new.entidade_id = '${c.pendente.id}'::uuid` })
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
      expect(await pedido(c.pendente.pedidoId)).toMatchObject({ estado: 'encerrada', decidida_em: null, decidida_por: null, decidida_como: null, senha_hash: null, lista_nome_id: null })
      expect((await listaDe(c.escola.escolaId)).find((linha) => linha.id === c.pendente.id)).toBeUndefined()
      expect(await consulta('select id from usuario where escola_id = $1 and nome = $2', [c.escola.escolaId, c.pendente.nome])).toEqual([])
      expect(await consulta('select id from credencial_matricula where escola_id = $1 and matricula = $2', [c.escola.escolaId, c.pendente.matricula])).toEqual([])
    })

    it('[P] o aluno a desligar desativado à mão entre o passo (2) e o (3): o job sai `desatualizada` na releitura, sem retirar o nome marcado junto nem mexer em outro aluno', async () => {
      const c = await cenario()
      const id = await gravar(c.escola, planilhaDe(c), quemSe('Aluno Ausente (', 'Nome Livre Ausente'))

      await entreOs2e3(c.escola, id, () => runInContext(contextoDe(c.escola), () => new CicloDeVidaService(bancoDoJob).desativar(c.ausente.usuarioId)))

      expect((await importacao(id))?.estado).toBe('desatualizada')
      expect(await usuarioDe(c.ausente.usuarioId)).toBe(true)
      // O nome marcado junto volta com o job: a linha segue na lista, e os outros alunos seguem ativos.
      expect((await listaDe(c.escola.escolaId)).find((linha) => linha.id === c.livre.id)).toMatchObject({ estado: 'livre' })
      expect(await auditoriaDa(c.escola.escolaId, 'lista_nome.retirado')).toEqual([])
      for (const quem of [c.fica, c.ausenteSemMarca, c.daT2]) expect(await usuarioDe(quem.usuarioId), quem.nome).toBe(false)
    })

    it('[P] o (3) corrigindo o nome de um aluno e desligando outro, parado depois da correção, contra a coordenação desativando e eliminando o desligado: nenhum pedido sai `40P01`, o job conclui e o desligado fica desativado ou eliminado, nunca os dois pela metade', async () => {
      const c = await cenario()
      const id = await gravar(c.escola, planilhaDe(c, 'Nome Corrigido'), quemSe('Aluno Ausente ('))
      const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'auditoria', evento: 'insert', quando: `new.acao = 'usuario.nome_corrigido' and new.entidade_id = '${c.fica.usuarioId}'::uuid` })
      const ciclo = new CicloDeVidaService(bancoDoJob)
      const resultado = (acao: Promise<void>) => acao.then(() => 'ok', (erro: unknown) => (erro instanceof DomainException ? erro.codigo : `erro: ${String(erro)}`))
      await gatilho.armar()
      let desfechos: string[]
      try {
        const tentativa = tentar(c.escola.escolaId, id)
        await gatilho.esperarParadas()
        const desativando = resultado(runInContext(contextoDe(c.escola), () => ciclo.desativar(c.ausente.usuarioId)))
        const eliminando = resultado(runInContext(contextoDe(c.escola), () => ciclo.eliminar(c.ausente.usuarioId)))
        await esperarNaTrava(bancada.pool, '%"usuario"%for no key update%', 2)
        await gatilho.soltar()
        desfechos = (await Promise.all([desativando, eliminando, tentativa.then(() => 'job')])).filter((desfecho) => desfecho !== 'job')
      } finally {
        await gatilho.desarmar()
      }

      for (const desfecho of desfechos) expect(['ok', ErrorCode.NAO_ENCONTRADO]).toContain(desfecho)
      expect(await importacao(id)).toMatchObject({ estado: 'concluida', erro: null })
      expect((await consulta<{ nome: string }>('select nome from usuario where id = $1', [c.fica.usuarioId]))[0]?.nome).toBe('Nome Corrigido')
      const restou = await consulta<{ desativado: boolean }>('select desativado_em is not null as desativado from usuario where id = $1', [c.ausente.usuarioId])
      expect(restou.length === 0 || restou[0]?.desativado === true).toBe(true)
      expect(await consulta("select id from vinculo where usuario_id = $1 and estado <> 'encerrado'", [c.ausente.usuarioId])).toEqual([])
    })

    it('o passo (3) trava, nesta ordem, o ano, os usuários, as turmas tocadas e os pedidos pendentes, tudo antes da primeira escrita, com o desligado na trava de usuários e o pedido travado uma vez só', async () => {
      const c = await cenario()
      // Sem nome corrigido: o único usuário que o (3) trava é o desligado, e é por ele que a ordem se prova.
      const id = await gravar(c.escola, planilhaDe(c), quemSe('Aluno Ausente (', 'Nome Reivindicado Ausente'))
      const sqlDoJob: string[] = []
      const parametrosDoJob: unknown[][] = []
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

      await runInContext({ requisicaoId: randomUUID(), escolaId: c.escola.escolaId }, () => espiao({ importacaoId: id }, jobExecution(randomUUID(), 1)))

      const posicao = (padrao: RegExp): number => sqlDoJob.findIndex((consultaDoJob) => padrao.test(consultaDoJob))
      const ano = posicao(/^select .*from "ano_letivo".* for share$/)
      const anosDosVinculos = posicao(/^select .*from "ano_letivo".*order by "ano_letivo"\."id" asc for share$/)
      const usuarios = posicao(/^select .*from "usuario".* for no key update$/)
      const turmas = posicao(/^select .*from "turma".* for no key update$/)
      const pedidos = posicao(/^select .*from "reivindicacao".* for update$/)
      const primeiraEscrita = posicao(/^\s*(update "?(usuario|lista_nome)"?|delete from lista_nome)/)
      for (const [nome, indice] of [['ano', ano], ['anos dos vínculos', anosDosVinculos], ['usuários', usuarios], ['turmas', turmas], ['pedidos', pedidos], ['escrita', primeiraEscrita]] as const) expect(indice, nome).toBeGreaterThanOrEqual(0)
      expect([ano, anosDosVinculos, usuarios, turmas, pedidos, primeiraEscrita]).toEqual([ano, anosDosVinculos, usuarios, turmas, pedidos, primeiraEscrita].toSorted((x, y) => x - y))
      // Os pedidos são travados uma vez, pelo passo (3), e os usuários marcados entram na trava de usuários num comando só, em ordem de id.
      expect(sqlDoJob.filter((consultaDoJob) => /^select .*from "reivindicacao".* for update$/.test(consultaDoJob))).toHaveLength(1)
      expect(sqlDoJob[usuarios]).toMatch(/order by "usuario"\."id" asc for no key update$/)
      // Só o marcado entra na trava: o ausente que ninguém marcou segue ativo e livre para outra transação.
      expect(parametrosDoJob[usuarios]).toContain(c.ausente.usuarioId)
      expect(parametrosDoJob[usuarios]).not.toContain(c.ausenteSemMarca.usuarioId)
      expect(await importacao(id)).toMatchObject({ estado: 'concluida', resumo: { desligados: 1, retirados: 1 } })
    })
  })

  describe('a virada de ano: o aluno do ano anterior na planilha do planejado', () => {
    interface Virada {
      readonly escola: Escola
      readonly encerradoId: string
      readonly emCursoId: string
      readonly planejadoId: string
      readonly t25: string
      readonly t26: string
      readonly t27: string
      /** Aprovado do ano encerrado (vínculo `encerrado` por `fim_do_ano`) e do ano em curso (vínculo confirmado), sem nada no planejado. */
      readonly volta: Aluno
      /** Aluno ativo cujo único vínculo no planejado está `encerrado`, sem linha na lista: o vínculo encerrado não o impede de voltar. */
      readonly reentra: Aluno
      /** Aprovado do ano encerrado e desativado, sem linha no planejado. */
      readonly desativado: Aluno
      /** Aluno que já tem linha e vínculo no planejado. */
      readonly jaTem: Aluno
      /** Aluno ativo com vínculo confirmado no planejado e sem linha na lista dele. */
      readonly semLinha: Aluno
    }

    async function viradaDeAno(): Promise<Virada> {
      const escola = await escolaNova('em_curso', 2026)
      const encerradoId = await anoNovo(escola.escolaId, 2025, 'encerrado')
      const planejadoId = await anoNovo(escola.escolaId, 2027, 'planejado')
      const serie = await serieNova(escola.escolaId)
      const t25 = await turmaNova(escola, serie, '8A', '8a', encerradoId)
      const t26 = await turmaNova(escola, serie, '8A', '8a')
      const t27 = await turmaNova(escola, serie, '8A', '8a', planejadoId)
      const volta = await alunoAprovado(escola, t26, 'Aluno Que Volta')
      await consulta("insert into lista_nome (escola_id, ano_letivo_id, turma_id, estado, usuario_id) values ($1, $2, $3, 'aprovado', $4)", [escola.escolaId, encerradoId, t25, volta.usuarioId])
      await vinculoDoAluno(escola, encerradoId, t25, volta.usuarioId, 'encerrado')
      const reentra = await alunoAprovado(escola, t26, 'Aluno Que Reentra')
      await vinculoDoAluno(escola, planejadoId, t27, reentra.usuarioId, 'encerrado')
      const desativado = await alunoAprovado(escola, t25, 'Aluno Desativado', encerradoId, 'encerrado')
      await consulta('update usuario set desativado_em = now() where id = $1', [desativado.usuarioId])
      const jaTem = await alunoAprovado(escola, t27, 'Aluno Que Ja Tem', planejadoId)
      const semLinha = await alunoAprovado(escola, t27, 'Aluno Sem Linha', planejadoId)
      await consulta('delete from lista_nome where usuario_id = $1 and ano_letivo_id = $2', [semLinha.usuarioId, planejadoId])
      return { escola, encerradoId, emCursoId: escola.anoId, planejadoId, t25, t26, t27, volta, reentra, desativado, jaTem, semLinha }
    }

    const planilhaDoPlanejado = (v: Virada, ...extras: string[]): string =>
      texto(`8A;${v.volta.nome};${v.volta.matricula}`, `8A;${v.reentra.nome};${v.reentra.matricula}`, `8A;${v.jaTem.nome};${v.jaTem.matricula}`, `8A;${v.semLinha.nome};${v.semLinha.matricula}`, ...extras)
    const gravarNoPlanejado = (v: Virada, planilha: string) =>
      runInContext(contextoDe(v.escola), async () => (await motor().gravar('alunos', { texto: planilha, anoLetivoId: v.planejadoId, marcas: { transferir: [], desligar: [], encerrar: [] } })).id)

    it('o aluno do ano anterior "volta" com o mesmo login: vínculo confirmado na turma nova, linha `aprovado` na lista do planejado, o mesmo usuário e a mesma credencial; quem já tem vínculo aberto no ano segue "já existe"', async () => {
      const v = await viradaDeAno()
      const usuariosAntes = (await consulta<{ total: number }>('select count(*)::int as total from usuario where escola_id = $1', [v.escola.escolaId]))[0]?.total
      const id = await gravarNoPlanejado(v, planilhaDoPlanejado(v, `8A;Aluno Novo;${matricula()}`))

      await tentar(v.escola.escolaId, id)

      expect(await importacao(id)).toEqual({ estado: 'concluida', erro: null, resumo: { entram: 1, ja_existem: 2, voltam: 2, turmas_novas: 0 } })
      for (const quem of [v.volta, v.reentra]) {
        expect((await vinculosDe(quem.usuarioId)).filter((vinculo) => vinculo.ano_letivo_id === v.planejadoId && vinculo.estado === 'confirmado').map((vinculo) => [vinculo.turma_id, vinculo.origem, vinculo.criado_por, vinculo.decidido_em !== null]), quem.nome).toEqual([
          [v.t27, 'lista', v.escola.coordenadorId, true],
        ])
      }
      expect((await listaDe(v.escola.escolaId)).filter((linha) => linha.usuario_id === v.volta.usuarioId).map((linha) => [linha.ano, linha.turma, linha.estado, linha.nome, linha.matricula]).sort()).toEqual([
        [2025, '8A', 'aprovado', null, null],
        [2026, '8A', 'aprovado', null, null],
        [2027, '8A', 'aprovado', null, null],
      ])
      // Quem já tinha vínculo aberto no planejado não ganha outro.
      expect((await vinculosDe(v.semLinha.usuarioId)).map((vinculo) => [vinculo.turma_id, vinculo.estado])).toEqual([[v.t27, 'confirmado']])
      // O mesmo login: nenhum usuário nasceu (o aluno novo da planilha só entra na lista), a credencial é a mesma (mesmo usuário, mesma senha), e o aluno entra por matrícula.
      expect((await consulta<{ total: number }>('select count(*)::int as total from usuario where escola_id = $1', [v.escola.escolaId]))[0]?.total).toBe(usuariosAntes)
      expect(await consulta('select usuario_id, senha_hash from credencial_matricula where escola_id = $1 and matricula = $2', [v.escola.escolaId, v.volta.matricula])).toEqual([{ usuario_id: v.volta.usuarioId, senha_hash: 'hash-sintetico' }])
      expect(await runInContext(contextoDe(v.escola), () => new CredencialMatriculaRepository(bancoDoJob).doAlunoAtivo(v.volta.matricula))).toMatchObject({ usuarioId: v.volta.usuarioId })
    })

    it('na volta, os vínculos dos outros anos ficam intactos: o do ano encerrado continua `encerrado` por `fim_do_ano`, com a mesma hora, e o do ano em curso continua confirmado', async () => {
      const v = await viradaDeAno()
      const antes = await vinculosDe(v.volta.usuarioId)
      const id = await gravarNoPlanejado(v, planilhaDoPlanejado(v))

      await tentar(v.escola.escolaId, id)

      const depois = await vinculosDe(v.volta.usuarioId)
      expect(depois).toHaveLength(3)
      expect(depois.filter((vinculo) => vinculo.ano_letivo_id !== v.planejadoId)).toEqual(antes)
      expect(antes.map((vinculo) => [vinculo.ano_letivo_id, vinculo.turma_id, vinculo.estado, vinculo.motivo_encerramento])).toEqual(
        [
          [v.emCursoId, v.t26, 'confirmado', null],
          [v.encerradoId, v.t25, 'encerrado', 'fim_do_ano'],
        ].sort(),
      )
      expect((await vinculosDe(v.jaTem.usuarioId)).map((vinculo) => [vinculo.turma_id, vinculo.estado])).toEqual([[v.t27, 'confirmado']])
    })

    it('a mesma planilha de novo não muda nada: quem voltou passa a "já existe", sem outro vínculo nem outra linha na lista', async () => {
      const v = await viradaDeAno()
      await tentar(v.escola.escolaId, await gravarNoPlanejado(v, planilhaDoPlanejado(v)))
      const depoisDaPrimeira = await retrato(v.escola.escolaId)
      const segunda = await gravarNoPlanejado(v, planilhaDoPlanejado(v))

      await tentar(v.escola.escolaId, segunda)

      expect(await importacao(segunda)).toEqual({ estado: 'concluida', erro: null, resumo: { entram: 0, ja_existem: 4, turmas_novas: 0 } })
      expect(await retrato(v.escola.escolaId)).toEqual(depoisDaPrimeira)
    })

    it('o aluno desativado na planilha é erro na linha (`aluno_desativado`) e nada é gravado; no ano em curso, a mesma matrícula segue "já existe"', async () => {
      const v = await viradaDeAno()
      const planilha = planilhaDoPlanejado(v, `8A;${v.desativado.nome};${v.desativado.matricula}`)
      const previa = await runInContext(contextoDe(v.escola), () => motor().previa('alunos', { texto: planilha, anoLetivoId: v.planejadoId }))
      const antes = await retrato(v.escola.escolaId)

      expect(previa.linhas).toEqual([
        { linha: 2, resultado: 'volta' },
        { linha: 3, resultado: 'volta' },
        { linha: 4, resultado: 'ja_existe' },
        { linha: 5, resultado: 'ja_existe' },
        { linha: 6, resultado: 'erro', erro: 'aluno_desativado' },
      ])
      await expect(gravarNoPlanejado(v, planilha)).rejects.toMatchObject({ codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(await retrato(v.escola.escolaId)).toEqual(antes)
      expect(JSON.stringify(previa)).not.toContain(v.desativado.matricula)

      // O ano em curso não tem a virada: as mesmas linhas, contra o 8A do ano em curso, são só "já existe", também a do desativado.
      const emCurso = await runInContext(contextoDe(v.escola), () => motor().previa('alunos', { texto: planilha }))
      expect(emCurso.linhas.map((linha) => linha.resultado)).toEqual(['ja_existe', 'ja_existe', 'ja_existe', 'ja_existe', 'ja_existe'])
    })

    it('a auditoria da volta: `vinculo.criado` de cada aluno que volta, com a coordenação como autora e a origem `lista`, e `planilha.gravada` com `voltam`; nenhum registro traz nome nem matrícula', async () => {
      const v = await viradaDeAno()
      const id = await gravarNoPlanejado(v, planilhaDoPlanejado(v))

      await tentar(v.escola.escolaId, id)

      const novos = await consulta<{ id: string; usuario_id: string }>("select id, usuario_id from vinculo where ano_letivo_id = $1 and estado = 'confirmado' and origem = 'lista' and usuario_id in ($2, $3)", [v.planejadoId, v.volta.usuarioId, v.reentra.usuarioId])
      const criados = await auditoriaDa(v.escola.escolaId, 'vinculo.criado')
      expect(criados.map((r) => [r.entidade_id, r.autor_usuario_id, r.antes, r.depois]).sort()).toEqual(
        novos
          .map(({ id: vinculoId, usuario_id: usuarioId }) => [vinculoId, v.escola.coordenadorId, null, { usuarioId, turmaId: v.t27, disciplinaId: null, papel: 'aluno', estado: 'confirmado', origem: 'lista' }])
          .sort(),
      )
      expect(novos).toHaveLength(2)
      const [gravada] = await auditoriaDa(v.escola.escolaId, 'planilha.gravada')
      expect(gravada?.depois).toEqual({ tipo: 'alunos', contagens: { entram: 0, ja_existem: 2, turmas_novas: 0, voltam: 2 } })
      const serializado = JSON.stringify([...criados, gravada])
      for (const sentinela of [v.volta.nome, v.volta.matricula, '8A']) expect(serializado).not.toContain(sentinela)
    })

    it('mais alunos do que cabem num lote (500): 501 alunos do ano anterior voltam, e a soma das linhas gravadas por lote fecha a conta sem `desatualizada`', async () => {
      const v = await viradaDeAno()
      const quantos = 501
      const prefixo = `volta-${randomUUID().slice(0, 6)}`
      await consulta(
        `with u as (insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno Do Lote ' || g from generate_series(1, $2::int) g returning id, nome)
         insert into credencial_matricula (escola_id, usuario_id, matricula) select $1, id, $3 || '-' || substr(nome, 15) from u`,
        [v.escola.escolaId, quantos, prefixo],
      )
      const linhas = Array.from({ length: quantos }, (_, i) => `8A;Aluno Do Lote ${String(i + 1)};${prefixo}-${String(i + 1)}`)
      const id = await gravarNoPlanejado(v, texto(...linhas, `8A;${v.jaTem.nome};${v.jaTem.matricula}`))

      await tentar(v.escola.escolaId, id)

      expect(await importacao(id)).toMatchObject({ estado: 'concluida', erro: null, resumo: { voltam: quantos } })
      const contar = async (sql: string) => (await consulta<{ total: number }>(sql, [v.escola.escolaId, v.planejadoId]))[0]?.total
      expect(await contar("select count(*)::int as total from vinculo where escola_id = $1 and ano_letivo_id = $2 and papel = 'aluno' and estado = 'confirmado' and origem = 'lista' and usuario_id in (select usuario_id from credencial_matricula where matricula like 'volta-%')")).toBe(quantos)
      expect(await contar("select count(*)::int as total from lista_nome where escola_id = $1 and ano_letivo_id = $2 and estado = 'aprovado' and usuario_id in (select usuario_id from credencial_matricula where matricula like 'volta-%')")).toBe(quantos)
    })

    it('[P] o aluno desativado à mão entre o passo (2) e o (3) não volta: o job sai `desatualizada`, sem vínculo novo nem linha na lista, e sem mexer em quem voltaria junto', async () => {
      const v = await viradaDeAno()
      const id = await gravarNoPlanejado(v, planilhaDoPlanejado(v))
      const antes = await retrato(v.escola.escolaId)

      await entreOs2e3(v.escola, id, async () => {
        await consulta('update usuario set desativado_em = now() where id = $1', [v.volta.usuarioId])
      })

      expect((await importacao(id))?.estado).toBe('desatualizada')
      const depois = (await retrato(v.escola.escolaId)) as { vinculos: unknown[]; lista: unknown[] }
      expect(depois.vinculos).toEqual((antes as { vinculos: unknown[] }).vinculos)
      expect(depois.lista).toEqual((antes as { lista: unknown[] }).lista)
    })

    it('[P] o usuário do aluno que volta preso por outra transação: o job espera na trava do usuário (o que se prova é a consulta esperando: o resultado final seria o mesmo sem ela) e, liberado, conclui a volta inteira', async () => {
      const v = await viradaDeAno()
      const id = await gravarNoPlanejado(v, planilhaDoPlanejado(v))

      await escritaParadaContraOJob(
        v.escola,
        id,
        async (executar) => {
          await executar('select id from usuario where id = $1 for update', [v.volta.usuarioId])
        },
        '%usuario%for no key update%',
      )

      expect(await importacao(id)).toMatchObject({ estado: 'concluida', resumo: { voltam: 2 } })
      expect((await vinculosDe(v.volta.usuarioId)).filter((vinculo) => vinculo.ano_letivo_id === v.planejadoId).map((vinculo) => vinculo.estado)).toEqual(['confirmado'])
    })

    it('isolamento: a matrícula da escola B na planilha do planejado da A é "entra", nunca "volta", e nada muda na B; a mesma consulta, na B, acha o aluno dela, e só o que não tem linha nem vínculo no ano', async () => {
      const a = await viradaDeAno()
      const b = await viradaDeAno()
      const antesDaB = await retrato(b.escola.escolaId)
      // As matrículas da B de quem volta, do desativado e de quem já tem linha: na planilha da A, nenhuma delas é erro, "já existe" nem "volta".
      const daB = [b.volta, b.desativado, b.jaTem]
      const previa = await runInContext(contextoDe(a.escola), () => motor().previa('alunos', { texto: texto(...daB.map(({ matricula }) => `8A;Nome Qualquer;${matricula}`)), anoLetivoId: a.planejadoId }))
      const daVirada = (v: Virada, matriculas: string[]) => runInContext(contextoDe(v.escola), () => new ListaRepository(bancoDoJob).daVirada(b.planejadoId, matriculas))

      expect(previa.linhas).toEqual([
        { linha: 2, resultado: 'entra' },
        { linha: 3, resultado: 'entra' },
        { linha: 4, resultado: 'entra' },
      ])
      expect(await daVirada(a, daB.map(({ matricula }) => matricula))).toEqual([])
      const porMatricula = (x: { matricula: string }, y: { matricula: string }) => (x.matricula < y.matricula ? -1 : 1)
      expect((await daVirada(b, [b.volta.matricula, b.semLinha.matricula, b.desativado.matricula, b.jaTem.matricula])).sort(porMatricula)).toEqual(
        [
          { usuarioId: b.volta.usuarioId, matricula: b.volta.matricula, desativado: false, comVinculo: false },
          { usuarioId: b.semLinha.usuarioId, matricula: b.semLinha.matricula, desativado: false, comVinculo: true },
          { usuarioId: b.desativado.usuarioId, matricula: b.desativado.matricula, desativado: true, comVinculo: false },
        ].sort(porMatricula),
      )
      expect(await retrato(b.escola.escolaId)).toEqual(antesDaB)
    })
  })

  it('isolamento dos métodos do desligamento: no contexto da A, o ano e os ids da B não saem da lista da B; no contexto da B, os mesmos argumentos saem', async () => {
    const a = await cenario()
    const b = await cenario()
    const doB = [{ id: b.livre.id, estadoLido: 'livre' as const, turmaLidaId: b.t1 }]
    const chamar = (escola: Escola, anoId = b.escola.anoId) => runInContext(contextoDe(escola), () => new ListaRepository(bancoDoJob).retirarNomes(anoId, doB))
    const antes = await retrato(b.escola.escolaId)

    expect(await chamar(a.escola)).toEqual([])
    expect(await retrato(b.escola.escolaId)).toEqual(antes)
    // O ano também é condição: na escola dela, com o ano planejado no lugar do ano da linha, nada sai.
    expect(await chamar(b.escola, b.planejadoId)).toEqual([])
    expect(await retrato(b.escola.escolaId)).toEqual(antes)

    // O controle: o mesmo pedido, na escola dela, retira, e o teste acima não passou por falta de dado.
    expect(await chamar(b.escola)).toEqual([b.livre.id])
    expect(await retrato(b.escola.escolaId)).not.toEqual(antes)
  })

  it('o desligamento da A não alcança a B: a marca da A só vale para os candidatos da A, e o aluno e o nome da B ficam como estavam', async () => {
    const a = await cenario()
    const b = await cenario()
    const antesDaB = await retrato(b.escola.escolaId)
    const id = await gravar(a.escola, planilhaDe(a), () => true)

    await tentar(a.escola.escolaId, id)

    expect(await importacao(id)).toMatchObject({ estado: 'concluida', resumo: { desligados: 2, retirados: 2 } })
    expect(await retrato(b.escola.escolaId)).toEqual(antesDaB)
  })
})
