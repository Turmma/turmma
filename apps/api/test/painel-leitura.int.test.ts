import { createDatabase, createPool, OrcamentoDoMesRepository, runInContext, type Database, type DatabasePool } from '@educa/core'
import {
  ErrorCode,
  ESCOLAS_POR_PAGINA,
  mesDeSaoPaulo,
  conviteDaCoordenacaoResponseSchema,
  escolasDoPainelResponseSchema,
  redesDoPainelResponseSchema,
  usoDeIaDaEscolaDoPainelResponseSchema,
  usoDoPainelResponseSchema,
  type EscolaDoPainel,
  type OrdemDoPainel,
  type OrdemDoUso,
  type UsoDaEscolaDoPainel,
  type UsoDoPeriodoDoPainel,
} from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { PainelService } from '../src/operacao/painel/painel.service.js'
import { esperarErro, nomeQueVemPrimeiro, pedir, PRAZO_DAS_CONSULTAS_MS, subirApiDoPainel, todasAsPaginas, type Resposta } from './painel.fixture.js'
import { OperadorFixtures, type TestOperadorSessao } from './operador-session.fixture.js'
import { segurarTravaDaEscola } from './escola-lock.js'

/**
 * A leitura entre escolas do painel da operação (A0b, tarefa 5.0): `GET /v1/operacao/escolas` e `GET /v1/operacao/uso`,
 * pelo `PainelRepository`. Cenários de `tasks/prd-apresentacao-painel/cenarios.md`: I4, I5, I6 (as oito rotas), L1, L2 e
 * L3; a L4 está em `painel-convite.int.test.ts`, com as escolas em cada estado. Postgres e Redis reais do compose de teste.
 *
 * O banco de teste guarda as escolas dos outros arquivos: a lista é de todas, e cada teste percorre as páginas e procura
 * as suas. Os ids são sorteados (v4): nenhuma conta supõe que o id cresce com a criação.
 */

/** O prazo das consultas da API da I6 que deixa o `statement_timeout` estourar na trava ou na tabela seguras pelo teste. */
const PRAZO_CURTO_MS = 1_000
/** O limite do operador folgado: os testes percorrem todas as páginas, várias vezes, com a mesma sessão. */
const AMBIENTE = { LIMITE_REQ_OPERADOR_MIN: '100000' }

type Contagens = Pick<EscolaDoPainel, 'turmas' | 'professores' | 'alunos'>

const periodo = (requisicoes: number, jobs: number, bytesStorage: number): UsoDoPeriodoDoPainel => ({ requisicoes, jobs, bytesStorage })
const ZERO = periodo(0, 0, 0)
/** O orçamento de IA da escola sem nada próprio, numa rede sem nada: o padrão (`orcamentoDaEscolaNoPainel`). */
const SEM_ORCAMENTO_DA_ESCOLA = {
  proprio: { valorPorAlunoMicros: null, tetoDeSegurancaPercentual: null },
  vigente: { valorPorAlunoMicros: null, origemDoValor: 'nenhuma', tetoDeSegurancaPercentual: 200, origemDoTeto: 'padrao' },
}

/** Ordena como o painel: pela chave, e o desempate pelo `id` (o `uuid` do Postgres compara como o texto em minúsculas). */
const porId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

describe('painel da operação: a lista de escolas e o uso, entre escolas (tarefa 5.0)', () => {
  const operadores = new OperadorFixtures()
  const linhasDeLog: string[] = []
  const sufixo = randomUUID().slice(0, 8)
  const escolas: string[] = []
  const contas: string[] = []
  const redes: string[] = []
  let app: INestApplication
  let url: string
  let pool: DatabasePool
  let banco: Database
  let redeId: string
  let sessao: TestOperadorSessao

  async function umaLinha<T>(consulta: string, parametros: unknown[]): Promise<T> {
    const { rows } = await pool.query<T & Record<string, unknown>>(consulta, parametros)
    const linha = rows[0]
    if (linha === undefined) throw new Error(`nada devolvido: ${consulta}`)
    return linha
  }
  const idDe = async (consulta: string, parametros: unknown[]) => (await umaLinha<{ id: string }>(consulta, parametros)).id

  /** Uma escola nova na rede deste arquivo, com o id sorteado (v4) ou o dado. */
  async function novaEscola(nome = `Escola Leitura ${sufixo}`, id: string = randomUUID()): Promise<string> {
    await pool.query('insert into escola (id, rede_id, nome, slug) values ($1, $2, $3, $4)', [id, redeId, nome, `leitura-${randomUUID()}`])
    escolas.push(id)
    return id
  }
  const anoLetivo = (escolaId: string, ano: number, situacao: 'planejado' | 'em_curso' | 'encerrado') =>
    idDe(`insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, $2::int, make_date($2::int, 2, 1), make_date($2::int, 12, 15), $3) returning id`, [escolaId, ano, situacao])
  const serie = (escolaId: string) => idDe(`insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id`, [escolaId])
  const disciplina = (escolaId: string, nome: string) => idDe('insert into disciplina (escola_id, nome) values ($1, $2) returning id', [escolaId, nome])
  const turma = (escolaId: string, anoId: string, serieId: string, nome: string) =>
    idDe('insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4) returning id', [escolaId, anoId, serieId, nome])

  /** Uma conta global nova (e-mail em `.invalid`), para professor e coordenador. */
  async function conta(email = `leitura-${randomUUID()}@escola.invalid`): Promise<string> {
    const id = await idDe('insert into conta (email) values ($1) returning id', [email])
    contas.push(id)
    return id
  }

  /** Um usuário na escola; professor e coordenador com conta (a dada, ou uma nova), aluno sem. */
  async function pessoa(escolaId: string, papel: 'coordenador' | 'professor' | 'aluno', opcoes: { nome?: string; desativada?: boolean; contaId?: string } = {}): Promise<string> {
    const contaId = papel === 'aluno' ? null : (opcoes.contaId ?? (await conta()))
    return idDe(`insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, $3, $4, case when $5 then now() end) returning id`, [
      escolaId,
      contaId,
      papel,
      opcoes.nome ?? 'Pessoa sintética de teste',
      opcoes.desativada === true,
    ])
  }

  interface OpcoesDoVinculo {
    estado?: 'pendente' | 'confirmado' | 'contestado' | 'encerrado'
    disciplinaId?: string
    complemento?: string
    /** `encerrado_em` preenchido sem o estado `encerrado` (e sem motivo): o que só a coluna diz. */
    comEncerradoEm?: boolean
  }

  function vinculo(escolaId: string, anoId: string, usuarioId: string, turmaId: string, papel: 'professor' | 'aluno', criadoPor: string, opcoes: OpcoesDoVinculo = {}): Promise<unknown> {
    const estado = opcoes.estado ?? 'confirmado'
    return pool.query(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, contestacao, complemento, motivo_encerramento, encerrado_em, criado_por)
       values ($1, $2, $3, $4, $5, $6, $7, case when $7 = 'contestado' then 'outro' end, $8, case when $7 = 'encerrado' then 'desligamento' end,
               case when $7 = 'encerrado' or $9 then now() end, $10)`,
      [escolaId, anoId, usuarioId, turmaId, opcoes.disciplinaId ?? null, papel, estado, opcoes.complemento ?? null, opcoes.comEncerradoEm === true, criadoPor],
    )
  }

  async function usoNoDia(escolaId: string, dia: string, uso: UsoDoPeriodoDoPainel): Promise<void> {
    await pool.query('insert into uso_infra_diario (escola_id, dia, requisicoes, jobs, bytes_storage) values ($1, $2, $3, $4, $5)', [escolaId, dia, uso.requisicoes, uso.jobs, uso.bytesStorage])
  }

  /** A lista inteira, página a página, pela API, conferindo o contrato e o `no-store` de cada resposta. */
  async function lista(ordem: OrdemDoPainel, textos?: string[]) {
    return todasAsPaginas(async (pagina) => {
      const resposta = await pedir(url, 'GET', `/v1/operacao/escolas?pagina=${pagina}&ordem=${ordem}`, sessao.token)
      textos?.push(resposta.texto)
      expect(resposta.status).toBe(200)
      expect(resposta.cacheControl).toBe('no-store')
      return escolasDoPainelResponseSchema.parse(resposta.corpo)
    })
  }

  /** O uso inteiro, página a página, pela API. */
  async function uso(ordem: OrdemDoUso, textos?: string[]) {
    let referencia: { dia: string; mes: string } | undefined
    const lido = await todasAsPaginas(async (pagina) => {
      const resposta = await pedir(url, 'GET', `/v1/operacao/uso?pagina=${pagina}&ordem=${ordem}`, sessao.token)
      textos?.push(resposta.texto)
      expect(resposta.status).toBe(200)
      expect(resposta.cacheControl).toBe('no-store')
      const lida = usoDoPainelResponseSchema.parse(resposta.corpo)
      // A referência é a mesma em todas as páginas.
      referencia ??= { dia: lida.dia, mes: lida.mes }
      expect({ dia: lida.dia, mes: lida.mes }).toEqual(referencia)
      return lida
    })
    return { ...lido, referencia }
  }

  /**
   * O período de referência que a API usa agora, lido da primeira página do uso: o teste semeia no dia que a API vai ler,
   * e não no do relógio do teste (a regra do período é a L2, com o relógio parado).
   */
  async function referenciaDaApi(): Promise<{ dia: string; primeiroDoMes: string }> {
    const resposta = await pedir(url, 'GET', '/v1/operacao/uso', sessao.token)
    expect(resposta.status).toBe(200)
    const { dia } = usoDoPainelResponseSchema.parse(resposta.corpo)
    return { dia, primeiroDoMes: `${dia.slice(0, 7)}-01` }
  }

  const doItem = <Item extends { id: string }>(itens: readonly Item[], id: string): Item => {
    const achados = itens.filter((item) => item.id === id)
    expect(achados, id).toHaveLength(1)
    return achados[0] as Item
  }
  const soAsMinhas = <Item extends { id: string }>(itens: readonly Item[], minhas: readonly string[]) => itens.filter((item) => minhas.includes(item.id))

  beforeAll(async () => {
    pool = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 6, timeoutConexaoMs: 5_000, timeoutConsultaMs: PRAZO_DAS_CONSULTAS_MS }, () => undefined)
    banco = createDatabase(pool)
    ;({ app, url } = await subirApiDoPainel(linhasDeLog, AMBIENTE))
    redeId = await idDe(`insert into rede (nome, tipo) values ($1, 'grupo') returning id`, [`Rede Leitura ${sufixo}`])
    redes.push(redeId)
    sessao = await operadores.operadorComSessao()
  })

  afterAll(async () => {
    // A limpeza roda mesmo se a API não fechar: sem ela, as escolas deste arquivo entrariam na lista dos seguintes.
    try {
      await app.close()
    } finally {
      try {
        for (const tabela of ['consumo_ia', 'orcamento_ia_do_mes', 'execucao_agente', 'vinculo', 'credencial_matricula', 'turma', 'disciplina', 'serie', 'ano_letivo', 'convite', 'sessao', 'usuario', 'uso_infra_diario', 'auditoria', 'configuracao_operacional_escola']) {
          await pool.query(`delete from ${tabela} where escola_id = any($1::uuid[])`, [escolas])
        }
        await pool.query('delete from escola where id = any($1::uuid[])', [escolas])
        await pool.query('delete from auditoria where entidade_id = any($1::uuid[])', [redes])
        await pool.query('delete from rede where id = any($1::uuid[])', [redes])
        await pool.query('delete from conta c where c.id = any($1::uuid[]) and not exists (select 1 from usuario u where u.conta_id = c.id)', [contas])
      } finally {
        await pool.end()
        await operadores.fechar()
      }
    }
  })

  describe('I4 e L1: cada escola com as suas contagens do ano em curso, cada pessoa uma vez', () => {
    it('as bordas de professores, alunos e turmas, em três escolas com números diferentes', async () => {
      // Escola A: 2026 em curso, 2025 encerrado.
      const a = await novaEscola()
      const coordenacaoA = await pessoa(a, 'coordenador')
      const [a2026, a2025, serieA] = await Promise.all([anoLetivo(a, 2026, 'em_curso'), anoLetivo(a, 2025, 'encerrado'), serie(a)])
      const [quimica, fisica] = await Promise.all([disciplina(a, 'Química'), disciplina(a, 'Física')])
      const t1 = await turma(a, a2026, serieA, '2ºB')
      const t2 = await turma(a, a2026, serieA, '2ºC')
      const t0 = await turma(a, a2025, serieA, '2ºB')
      // Turma do ano ainda sem professor nem aluno (a coordenação importa as turmas antes de alocar): conta.
      await turma(a, a2026, serieA, '2ºD')
      const naA = (usuarioId: string, turmaId: string, papel: 'professor' | 'aluno', opcoes: OpcoesDoVinculo = {}, anoId = a2026) => vinculo(a, anoId, usuarioId, turmaId, papel, coordenacaoA, opcoes)

      // Professores de A: contam o P1 (duas disciplinas na mesma turma, uma vez) e o P2 (que também dá aula em B).
      const p1 = await pessoa(a, 'professor')
      await naA(p1, t1, 'professor', { disciplinaId: quimica })
      await naA(p1, t1, 'professor', { disciplinaId: fisica })
      const contaDoP2 = await conta()
      await naA(await pessoa(a, 'professor', { contaId: contaDoP2 }), t2, 'professor', { disciplinaId: quimica })
      await naA(await pessoa(a, 'professor'), t1, 'professor', { estado: 'pendente' })
      await naA(await pessoa(a, 'professor'), t1, 'professor', { estado: 'contestado' })
      await naA(await pessoa(a, 'professor', { desativada: true }), t1, 'professor')
      await naA(await pessoa(a, 'professor'), t0, 'professor', {}, a2025)
      await naA(await pessoa(a, 'professor'), t2, 'professor', { estado: 'encerrado' })
      // Defesa: `confirmado` com `encerrado_em` (o banco aceita, sem motivo): a coluna sozinha já tira da conta.
      await naA(await pessoa(a, 'professor'), t2, 'professor', { disciplinaId: fisica, comEncerradoEm: true })

      // Alunos de A: contam o A1, o A2 (em duas turmas do ano, uma vez) e o A3, de vínculo `pendente`: do aluno conta o
      // vínculo não encerrado, qualquer que seja o estado (Tech Spec da A0b, seção 5).
      await naA(await pessoa(a, 'aluno'), t1, 'aluno')
      await naA(await pessoa(a, 'aluno'), t2, 'aluno', { estado: 'pendente' })
      const a2 = await pessoa(a, 'aluno')
      await naA(a2, t1, 'aluno')
      await naA(a2, t2, 'aluno')
      await naA(await pessoa(a, 'aluno'), t1, 'aluno', { estado: 'encerrado' })
      await naA(await pessoa(a, 'aluno'), t2, 'aluno', { comEncerradoEm: true })
      await naA(await pessoa(a, 'aluno', { desativada: true }), t1, 'aluno')
      await naA(await pessoa(a, 'aluno'), t0, 'aluno', {}, a2025)

      // Escola B: 2026 em curso; uma turma, o P2 (a mesma conta, outro usuário) e três alunos.
      const b = await novaEscola()
      const coordenacaoB = await pessoa(b, 'coordenador')
      const [b2026, serieB] = await Promise.all([anoLetivo(b, 2026, 'em_curso'), serie(b)])
      const tb = await turma(b, b2026, serieB, '1ºA')
      await vinculo(b, b2026, await pessoa(b, 'professor', { contaId: contaDoP2 }), tb, 'professor', coordenacaoB)
      for (let vez = 0; vez < 3; vez++) await vinculo(b, b2026, await pessoa(b, 'aluno'), tb, 'aluno', coordenacaoB)

      // Escola C: sem ano em curso (um planejado e um encerrado, cada um com turma, professor e aluno): zero.
      const c = await novaEscola()
      const coordenacaoC = await pessoa(c, 'coordenador')
      const serieC = await serie(c)
      for (const [ano, situacao] of [
        [2027, 'planejado'],
        [2025, 'encerrado'],
      ] as const) {
        const anoId = await anoLetivo(c, ano, situacao)
        const tc = await turma(c, anoId, serieC, '3ºA')
        await vinculo(c, anoId, await pessoa(c, 'professor'), tc, 'professor', coordenacaoC)
        await vinculo(c, anoId, await pessoa(c, 'aluno'), tc, 'aluno', coordenacaoC)
      }

      const { itens } = await lista('nome')
      const contagens = (id: string): Contagens => {
        const { turmas, professores, alunos } = doItem(itens, id)
        return { turmas, professores, alunos }
      }
      expect(contagens(a)).toEqual({ turmas: 3, professores: 2, alunos: 3 })
      expect(contagens(b)).toEqual({ turmas: 1, professores: 1, alunos: 3 })
      expect(contagens(c)).toEqual({ turmas: 0, professores: 0, alunos: 0 })

      // O item inteiro: só id, nome, endereço, rede, estado, número e o orçamento de IA (a escola sem nada próprio, e a rede sem nada: o padrão).
      const { rows } = await pool.query<{ slug: string }>('select slug from escola where id = $1', [a])
      expect(doItem(itens, a)).toStrictEqual({
        id: a,
        nome: `Escola Leitura ${sufixo}`,
        slug: rows[0]?.slug,
        rede: { id: redeId, nome: `Rede Leitura ${sufixo}` },
        estado: 'ativa',
        turmas: 3,
        professores: 2,
        alunos: 3,
        orcamento: {
          proprio: { valorPorAlunoMicros: null, tetoDeSegurancaPercentual: null },
          vigente: { valorPorAlunoMicros: null, origemDoValor: 'nenhuma', tetoDeSegurancaPercentual: 200, origemDoTeto: 'padrao' },
        },
      })
    })
  })

  describe('o índice dos coordenadores ativos, que a lista usa para o estado da coordenação (tarefa 5.0)', () => {
    it('existe em usuario, pela escola, parcial nos coordenadores ativos', async () => {
      const { rows } = await pool.query<{ indexdef: string }>(`select indexdef from pg_indexes where tablename = 'usuario' and indexname = 'usuario_coordenador_ativo_idx'`)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.indexdef).toMatch(/ON public\.usuario USING btree \(escola_id\) WHERE \(\(papel = 'coordenador'::text\) AND \(desativado_em IS NULL\)\)/)
    })
  })

  describe('I5: cada escola com o seu uso, no /uso e na lista em ordem de uso', () => {
    it('duas escolas com uso diferente no dia e no mês; a de mais requisições no mês vem antes, mesmo com o id maior', async () => {
      const referencia = await referenciaDaApi()
      const [menor, maior] = [randomUUID(), randomUUID()].toSorted()
      if (menor === undefined || maior === undefined) throw new Error('ids')
      // A de mais uso fica com o id maior: sem a correlação do uso pela escola, o desempate por id a poria depois.
      const muito = await novaEscola(`Escola Leitura Uso ${sufixo}`, maior)
      const pouco = await novaEscola(`Escola Leitura Uso ${sufixo}`, menor)
      await usoNoDia(muito, referencia.dia, periodo(7_000, 30, 5_000))
      await usoNoDia(pouco, referencia.dia, periodo(70, 3, 1_000))
      // No mês, antes do dia de referência (quando ele não é o dia 1), mais uma linha em cada uma.
      const antes = referencia.dia === referencia.primeiroDoMes ? undefined : referencia.primeiroDoMes
      if (antes !== undefined) {
        await usoNoDia(muito, antes, periodo(1_000, 10, 9_000))
        await usoNoDia(pouco, antes, periodo(5, 1, 400))
      }

      const lido = await uso('uso')
      expect(lido.referencia).toEqual({ dia: referencia.dia, mes: referencia.dia.slice(0, 7) })
      expect(doItem(lido.itens, muito)).toStrictEqual({
        id: muito,
        nome: `Escola Leitura Uso ${sufixo}`,
        rede: { id: redeId, nome: `Rede Leitura ${sufixo}` },
        orcamento: SEM_ORCAMENTO_DA_ESCOLA,
        dia: periodo(7_000, 30, 5_000),
        mes: antes === undefined ? periodo(7_000, 30, 5_000) : periodo(8_000, 40, 9_000),
        ia: expect.objectContaining({ alunosAtivos: 0 }),
      })
      expect(doItem(lido.itens, pouco)).toStrictEqual({
        id: pouco,
        nome: `Escola Leitura Uso ${sufixo}`,
        rede: { id: redeId, nome: `Rede Leitura ${sufixo}` },
        orcamento: SEM_ORCAMENTO_DA_ESCOLA,
        dia: periodo(70, 3, 1_000),
        mes: antes === undefined ? periodo(70, 3, 1_000) : periodo(75, 4, 1_000),
        ia: expect.objectContaining({ alunosAtivos: 0 }),
      })
      expect(soAsMinhas(lido.itens, [muito, pouco]).map((item) => item.id)).toEqual([muito, pouco])

      const { itens } = await lista('uso')
      expect(soAsMinhas(itens, [muito, pouco]).map((item) => item.id)).toEqual([muito, pouco])
    })
  })

  describe('L2: o último dia fechado e o mês dele, no relógio de São Paulo', () => {
    /** O uso inteiro pelo service, com o relógio parado em `agora`: a regra do período, sem esperar o calendário. */
    async function usoEm(agora: string) {
      const servico = new PainelService(banco, { agora: () => new Date(agora) })
      let referencia: { dia: string; mes: string } | undefined
      const lido = await todasAsPaginas(async (pagina) => {
        const resposta = await servico.uso({ pagina, ordem: 'nome' })
        referencia ??= { dia: resposta.dia, mes: resposta.mes }
        return resposta
      })
      return { ...lido, referencia }
    }
    const usoDa = (itens: readonly UsoDaEscolaDoPainel[], id: string) => {
      const { dia, mes } = doItem(itens, id)
      return { dia, mes }
    }

    it('no meio do mês: o mês soma requisições e jobs e pega o pico de bytes, sem o mês anterior; hoje não aparece; sem linha, zero', async () => {
      const escola = await novaEscola()
      const semUso = await novaEscola()
      await usoNoDia(escola, '2031-09-30', periodo(1_000, 100, 9_000_000))
      await usoNoDia(escola, '2031-10-01', periodo(10, 1, 500))
      await usoNoDia(escola, '2031-10-10', periodo(20, 2, 900))
      await usoNoDia(escola, '2031-10-14', periodo(30, 3, 700))
      // Hoje, ainda não fechado: nem no dia nem no mês.
      await usoNoDia(escola, '2031-10-15', periodo(5_000, 500, 99_999_999))
      const lido = await usoEm('2031-10-15T15:00:00Z')
      expect(lido.referencia).toEqual({ dia: '2031-10-14', mes: '2031-10' })
      // Soma dos bytes seria 2.100; o pico é 900.
      expect(usoDa(lido.itens, escola)).toEqual({ dia: periodo(30, 3, 700), mes: periodo(60, 6, 900) })
      expect(usoDa(lido.itens, semUso)).toEqual({ dia: ZERO, mes: ZERO })
    })

    it('no dia 1, a referência é o último dia do mês anterior, e o mês é o anterior', async () => {
      const escola = await novaEscola()
      await usoNoDia(escola, '2031-10-05', periodo(1, 1, 100))
      await usoNoDia(escola, '2031-10-31', periodo(2, 2, 300))
      await usoNoDia(escola, '2031-11-01', periodo(999, 999, 999_999))
      const lido = await usoEm('2031-11-01T15:00:00Z')
      expect(lido.referencia).toEqual({ dia: '2031-10-31', mes: '2031-10' })
      expect(usoDa(lido.itens, escola)).toEqual({ dia: periodo(2, 2, 300), mes: periodo(3, 3, 300) })
    })

    it('em 1º de janeiro, a referência é 31 de dezembro do ano anterior', async () => {
      const escola = await novaEscola()
      await usoNoDia(escola, '2031-11-30', periodo(50, 5, 5_000))
      await usoNoDia(escola, '2031-12-02', periodo(4, 4, 400))
      await usoNoDia(escola, '2031-12-31', periodo(6, 6, 200))
      await usoNoDia(escola, '2032-01-01', periodo(777, 777, 777_777))
      const lido = await usoEm('2032-01-01T15:00:00Z')
      expect(lido.referencia).toEqual({ dia: '2031-12-31', mes: '2031-12' })
      expect(usoDa(lido.itens, escola)).toEqual({ dia: periodo(6, 6, 200), mes: periodo(10, 10, 400) })
    })

    it('a ordem por uso conta o mesmo período: do dia 1 até o último dia fechado, sem o mês anterior e sem hoje, na lista e no uso', async () => {
      const [menor, maior] = [randomUUID(), randomUUID()].toSorted()
      if (menor === undefined || maior === undefined) throw new Error('ids')
      // X, de id menor, só passa Y se a chave contar hoje ou o mês anterior; Y, de id maior, só vem antes pela chave certa.
      const x = await novaEscola(`Escola Leitura Ordem ${sufixo}`, menor)
      const y = await novaEscola(`Escola Leitura Ordem ${sufixo}`, maior)
      await usoNoDia(x, '2031-09-30', periodo(9_000, 0, 0))
      await usoNoDia(x, '2031-10-01', periodo(10, 0, 0))
      await usoNoDia(x, '2031-10-15', periodo(9_000, 0, 0))
      await usoNoDia(y, '2031-10-14', periodo(50, 0, 0))
      const servico = new PainelService(banco, { agora: () => new Date('2031-10-15T15:00:00Z') })
      const noUso = await todasAsPaginas((pagina) => servico.uso({ pagina, ordem: 'uso' }))
      const naLista = await todasAsPaginas((pagina) => servico.escolas({ pagina, ordem: 'uso' }))
      expect(soAsMinhas(noUso.itens, [x, y]).map((item) => item.id)).toEqual([y, x])
      expect(soAsMinhas(naLista.itens, [x, y]).map((item) => item.id)).toEqual([y, x])
      expect(usoDa(noUso.itens, x).mes).toEqual(periodo(10, 0, 0))
    })

    it('entre 22h e 23h59 de São Paulo (já o dia seguinte em UTC), o último dia fechado é o de ontem em São Paulo; à meia-noite, vira', async () => {
      // A escola criada às 22h do dia 15 (São Paulo): o uso de hoje (15) e o do dia 16 em UTC ainda não aparecem.
      const escola = await novaEscola()
      await usoNoDia(escola, '2031-10-14', periodo(8, 8, 800))
      await usoNoDia(escola, '2031-10-15', periodo(9_000, 90, 9_000))
      await usoNoDia(escola, '2031-10-16', periodo(70_000, 700, 70_000))
      for (const agora of ['2031-10-16T01:00:00Z', '2031-10-16T02:59:59Z']) {
        const lido = await usoEm(agora)
        expect(lido.referencia, agora).toEqual({ dia: '2031-10-14', mes: '2031-10' })
        expect(usoDa(lido.itens, escola), agora).toEqual({ dia: periodo(8, 8, 800), mes: periodo(8, 8, 800) })
      }
      const meiaNoite = await usoEm('2031-10-16T03:00:00Z')
      expect(meiaNoite.referencia).toEqual({ dia: '2031-10-15', mes: '2031-10' })
      expect(usoDa(meiaNoite.itens, escola)).toEqual({ dia: periodo(9_000, 90, 9_000), mes: periodo(9_008, 98, 9_000) })
    })
  })

  describe('L3: 30 escolas nas duas ordens, página a página', () => {
    it('nenhuma repete nem some, o total é o do banco, e o desempate por id se mantém entre as páginas, com várias em zero', async () => {
      const referencia = await referenciaDaApi()
      // 15 nomes, cada um em duas escolas (o desempate por id na ordem por nome); 8 com uso distinto, 4 empatadas e 18 em
      // zero (9 sem linha, 9 com linha de zero requisições).
      const minhas: { id: string; nome: string; requisicoes: number }[] = []
      for (let posicao = 0; posicao < 30; posicao++) {
        const nome = `Escola L3 ${sufixo} ${String(posicao % 15).padStart(2, '0')}`
        const requisicoes = posicao < 8 ? 100 * (8 - posicao) : posicao < 12 ? 50 : 0
        const id = await novaEscola(nome)
        if (requisicoes > 0 || posicao >= 21) await usoNoDia(id, referencia.dia, periodo(requisicoes, posicao, 10 * posicao))
        minhas.push({ id, nome, requisicoes })
      }
      const ids = minhas.map((escola) => escola.id)
      const { rows } = await pool.query<{ total: number }>('select count(*)::int as total from escola')
      const noBanco = rows[0]?.total
      expect(noBanco).toBeGreaterThan(ESCOLAS_POR_PAGINA)

      const porNome = minhas.toSorted((x, y) => (x.nome < y.nome ? -1 : x.nome > y.nome ? 1 : porId(x, y))).map((escola) => escola.id)
      const porUso = minhas.toSorted((x, y) => y.requisicoes - x.requisicoes || porId(x, y)).map((escola) => escola.id)
      expect(porNome).not.toEqual(porUso)

      const listas = { nome: await lista('nome'), uso: await lista('uso') }
      const usos = { nome: await uso('nome'), uso: await uso('uso') }
      for (const lido of [listas.nome, listas.uso, usos.nome, usos.uso]) {
        expect(lido.total).toBe(noBanco)
        const vistos = lido.itens.map((item) => item.id)
        expect(new Set(vistos).size).toBe(vistos.length)
        expect(vistos).toHaveLength(noBanco ?? -1)
        for (const id of ids) expect(vistos.filter((visto) => visto === id)).toHaveLength(1)
      }
      expect(soAsMinhas(listas.nome.itens, ids).map((item) => item.id)).toEqual(porNome)
      expect(soAsMinhas(listas.uso.itens, ids).map((item) => item.id)).toEqual(porUso)
      // A lista e o uso andam na mesma ordem, página a página.
      expect(listas.nome.itens.map((item) => item.id)).toEqual(usos.nome.itens.map((item) => item.id))
      expect(listas.uso.itens.map((item) => item.id)).toEqual(usos.uso.itens.map((item) => item.id))

      // No uso em ordem de uso, a sequência inteira desce pelas requisições do mês e, no empate, sobe pelo id; e há empate
      // atravessando o corte de página (as escolas em zero passam de uma página).
      const sequencia = usos.uso.itens
      for (let posicao = 1; posicao < sequencia.length; posicao++) {
        const [antes, depois] = [sequencia[posicao - 1], sequencia[posicao]]
        if (antes === undefined || depois === undefined) throw new Error('sequência')
        expect(antes.mes.requisicoes).toBeGreaterThanOrEqual(depois.mes.requisicoes)
        if (antes.mes.requisicoes === depois.mes.requisicoes) expect(porId(antes, depois)).toBe(-1)
      }
      const cortes = usos.uso.paginas.slice(1).map((pagina, posicao) => [usos.uso.paginas[posicao]?.itens.at(-1), pagina.itens[0]] as const)
      expect(cortes.some(([fim, inicio]) => fim !== undefined && inicio !== undefined && fim.mes.requisicoes === inicio.mes.requisicoes)).toBe(true)

      // Sem consulta, a primeira página em ordem de nome.
      const padrao = await pedir(url, 'GET', '/v1/operacao/escolas', sessao.token)
      expect(padrao.status).toBe(200)
      expect(padrao.corpo).toEqual(listas.nome.paginas[0])
    })
  })

  /**
   * O orçamento de IA que a lista de escolas e a de redes mostram (camada-ia, 3.0; RF7 e RF11): o próprio e o vigente de cada uma, e quantas escolas usam o valor ou o teto da rede. Três redes com valores
   * diferentes, escolas com cada combinação de próprio e herdado, e a contagem de uma rede que não alcança a outra.
   */
  describe('camada-ia 3.0: o orçamento próprio e o vigente, e as escolas que usam o valor da rede', () => {
    const REAIS = 1_000_000
    const propria = (valorPorAlunoMicros: number | null, tetoDeSegurancaPercentual: number | null) => ({ valorPorAlunoMicros, tetoDeSegurancaPercentual })
    const vigente = (valorPorAlunoMicros: number | null, origemDoValor: string, tetoDeSegurancaPercentual: number, origemDoTeto: string) => ({ valorPorAlunoMicros, origemDoValor, tetoDeSegurancaPercentual, origemDoTeto })

    /** Uma rede com o orçamento dado (o nome vem antes das outras: as 200 do `GET /redes`). */
    async function redeComOrcamento(valorMicros: number | null, teto: number | null): Promise<string> {
      const id = await idDe(`insert into rede (nome, tipo, ia_valor_por_aluno_micros, ia_teto_de_seguranca_percentual) values ($1, 'grupo', $2, $3) returning id`, [nomeQueVemPrimeiro('Rede do Orçamento'), valorMicros, teto])
      redes.push(id)
      return id
    }
    /** Uma escola na rede, com a linha de configuração só se `proprio` vier (o painel não cria a linha). */
    async function escolaComOrcamento(rede: string, proprio?: { valorMicros: number | null; teto: number | null }): Promise<string> {
      const id = await idDe('insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id', [rede, nomeQueVemPrimeiro('Escola do Orçamento'), `orcamento-${randomUUID()}`])
      escolas.push(id)
      if (proprio !== undefined) await pool.query('insert into configuracao_operacional_escola (escola_id, ia_valor_por_aluno_micros, ia_teto_de_seguranca_percentual) values ($1, $2, $3)', [id, proprio.valorMicros, proprio.teto])
      return id
    }
    const redesLidas = async () => {
      const resposta = await pedir(url, 'GET', '/v1/operacao/redes', sessao.token)
      expect(resposta.status).toBe(200)
      return redesDoPainelResponseSchema.parse(resposta.corpo).itens
    }

    it('GET /escolas e /redes: o próprio e o vigente de cada escola e de cada rede, a escola sobre a rede coluna a coluna, e a contagem só das escolas da rede que usam o valor ou o teto dela', async () => {
      // A rede 1 (R$ 5, teto 300%), a rede 2 (R$ 1, teto 100%) e a rede 3, sem nada.
      const rede1 = await redeComOrcamento(5 * REAIS, 300)
      const rede2 = await redeComOrcamento(1 * REAIS, 100)
      const rede3 = await redeComOrcamento(null, null)
      const valorProprioETetoDaRede = await escolaComOrcamento(rede1, { valorMicros: 3 * REAIS, teto: null })
      const tetoProprioEValorDaRede = await escolaComOrcamento(rede1, { valorMicros: null, teto: 150 })
      const osDoisProprios = await escolaComOrcamento(rede1, { valorMicros: 2 * REAIS, teto: 150 })
      const semLinha = await escolaComOrcamento(rede1)
      const daRede2 = await escolaComOrcamento(rede2)
      const daRede3 = await escolaComOrcamento(rede3)

      const lidas = await redesLidas()
      expect(doItem(lidas, rede1)).toMatchObject({ orcamento: { proprio: propria(5 * REAIS, 300), vigente: vigente(5 * REAIS, 'rede', 300, 'rede') }, escolasQueUsamOValorDaRede: 3 })
      // A escola da rede 2 usa o valor da rede 2, e não conta na 1; a rede 3 não define nada, e a escola dela não usa nada da rede.
      expect(doItem(lidas, rede2)).toMatchObject({ orcamento: { proprio: propria(1 * REAIS, 100), vigente: vigente(1 * REAIS, 'rede', 100, 'rede') }, escolasQueUsamOValorDaRede: 1 })
      expect(doItem(lidas, rede3)).toMatchObject({ orcamento: { proprio: propria(null, null), vigente: vigente(null, 'nenhuma', 200, 'padrao') }, escolasQueUsamOValorDaRede: 0 })

      const { itens } = await lista('nome')
      expect(doItem(itens, valorProprioETetoDaRede).orcamento).toStrictEqual({ proprio: propria(3 * REAIS, null), vigente: vigente(3 * REAIS, 'escola', 300, 'rede') })
      expect(doItem(itens, tetoProprioEValorDaRede).orcamento).toStrictEqual({ proprio: propria(null, 150), vigente: vigente(5 * REAIS, 'rede', 150, 'escola') })
      expect(doItem(itens, osDoisProprios).orcamento).toStrictEqual({ proprio: propria(2 * REAIS, 150), vigente: vigente(2 * REAIS, 'escola', 150, 'escola') })
      expect(doItem(itens, semLinha).orcamento).toStrictEqual({ proprio: propria(null, null), vigente: vigente(5 * REAIS, 'rede', 300, 'rede') })
      expect(doItem(itens, daRede2).orcamento).toStrictEqual({ proprio: propria(null, null), vigente: vigente(1 * REAIS, 'rede', 100, 'rede') })
      expect(doItem(itens, daRede3).orcamento).toStrictEqual({ proprio: propria(null, null), vigente: vigente(null, 'nenhuma', 200, 'padrao') })
    })

    it('GET /redes: as redes vêm por nome, a mais nova do teste primeiro, e não pela ordem em que nasceram', async () => {
      const nascidas: string[] = []
      for (let i = 0; i < 3; i += 1) {
        nascidas.push(await redeComOrcamento(null, null))
        // O nome que vem primeiro leva o relógio: a espera garante um nome diferente a cada rede.
        await new Promise((pronto) => setTimeout(pronto, 5))
      }
      const lidas = (await redesLidas()).map((item) => item.id).filter((id) => nascidas.includes(id))
      expect(lidas).toEqual([...nascidas].reverse())
    })

    it('a rede que só define o teto conta a escola sem teto próprio, e a que só define o valor conta a escola sem valor próprio; escola com os dois próprios não conta em nenhuma', async () => {
      const soOTeto = await redeComOrcamento(null, 250)
      const soOValor = await redeComOrcamento(4 * REAIS, null)
      await escolaComOrcamento(soOTeto, { valorMicros: 2 * REAIS, teto: null })
      await escolaComOrcamento(soOTeto, { valorMicros: null, teto: 150 })
      await escolaComOrcamento(soOTeto, { valorMicros: 2 * REAIS, teto: 150 })
      await escolaComOrcamento(soOValor, { valorMicros: null, teto: 150 })
      await escolaComOrcamento(soOValor, { valorMicros: 2 * REAIS, teto: 150 })
      // Sem teto próprio, mas a rede não define teto: não usa nada dela.
      await escolaComOrcamento(soOValor, { valorMicros: 2 * REAIS, teto: null })
      const lidas = await redesLidas()
      // Só o teto da rede: a escola que tem teto próprio não usa nada dela (a de valor próprio e sem teto usa o teto); só o valor: a de teto próprio e sem valor usa o valor.
      expect(doItem(lidas, soOTeto).escolasQueUsamOValorDaRede).toBe(1)
      expect(doItem(lidas, soOValor).escolasQueUsamOValorDaRede).toBe(1)
    })
  })

  /**
   * O uso de IA que a aba Uso da Operação lê (camada-ia, 5.0; RF11; `cenarios.md` §1 RF11 e §2): `GET /v1/operacao/uso`, com o grupo `ia` de hoje e do mês corrente de São Paulo e a ordem por custo, e
   * `GET /v1/operacao/escolas/:id/uso-ia`, os 12 meses anteriores pelo retrato. O relógio é falso (`AGORA`: 23h45 de 30/04/2033 em São Paulo, já 1º/05 em UTC) e todo consumo é de 2033, longe do de outros arquivos.
   */
  describe('camada-ia 5.0: o uso de IA por escola, hoje e no mês, e os 12 meses anteriores', () => {
    const REAIS = 1_000_000
    const AGORA = new Date('2033-05-01T02:45:00Z')
    const comRelogioFalso = () => new PainelService(banco, { agora: () => AGORA })
    const ZERO_DE_IA = { execucoes: 0, chamadas: 0, tokens: 0, custoMicros: 0, chamadasPeloProvedorDeReserva: 0 }
    const deIa = (execucoes: number, chamadas: number, tokens: number, custoMicros: number, chamadasPeloProvedorDeReserva: number) => ({ execucoes, chamadas, tokens, custoMicros, chamadasPeloProvedorDeReserva })

    interface Montagem {
      rede?: { valor: number | null; teto: number | null }
      propria?: { valor: number | null; teto: number | null }
      alunos?: number
      semAnoEmCurso?: boolean
      id?: string
    }
    interface EscolaDeIa {
      id: string
      anoId: string
      serieId: string
      turmaId: string
      coordenadorId: string
    }

    /** Uma rede do grupo, com o valor e o teto dados (ou nulos), anotada para a limpeza. */
    const redeDeIa = (rede: Montagem['rede']) => idDe(`insert into rede (nome, tipo, ia_valor_por_aluno_micros, ia_teto_de_seguranca_percentual) values ($1, 'grupo', $2, $3) returning id`, [`Rede IA ${randomUUID()}`, rede?.valor ?? null, rede?.teto ?? null])

    /** Uma escola em rede própria, com o orçamento da rede e o da escola dados, o ano de 2033 (em curso, salvo `semAnoEmCurso`) e `alunos` alunos ativos na turma. */
    async function escolaDeIa({ rede, propria, alunos = 0, semAnoEmCurso, id }: Montagem = {}): Promise<EscolaDeIa> {
      const redeId = await redeDeIa(rede)
      redes.push(redeId)
      const escolaId = id ?? randomUUID()
      await pool.query('insert into escola (id, rede_id, nome, slug) values ($1, $2, $3, $4)', [escolaId, redeId, nomeQueVemPrimeiro('Escola IA'), `ia-${randomUUID()}`])
      escolas.push(escolaId)
      if (propria !== undefined) {
        await pool.query('insert into configuracao_operacional_escola (escola_id, ia_valor_por_aluno_micros, ia_teto_de_seguranca_percentual) values ($1, $2, $3)', [escolaId, propria.valor, propria.teto])
      }
      const anoId = await anoLetivo(escolaId, 2033, semAnoEmCurso === true ? 'planejado' : 'em_curso')
      const serieId = await serie(escolaId)
      const turmaId = await turma(escolaId, anoId, serieId, '2ºB')
      const coordenadorId = await pessoa(escolaId, 'coordenador')
      const escolaDeTeste = { id: escolaId, anoId, serieId, turmaId, coordenadorId }
      if (alunos > 0) await alunosNaTurma(escolaDeTeste, alunos)
      return escolaDeTeste
    }

    /** `quantos` alunos novos, cada um com um vínculo de aluno não encerrado na turma e no ano dados. */
    async function alunosNaTurma(e: EscolaDeIa, quantos: number, turmaId = e.turmaId, anoId = e.anoId): Promise<string[]> {
      const { rows } = await pool.query<{ id: string }>(
        `with novos as (
           insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno sintético' from generate_series(1, $2::int) returning id
         ), vinculos as (
           insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, criado_por) select $1, $3, id, $4, 'aluno', $5 from novos returning usuario_id
         ) select usuario_id as id from vinculos`,
        [e.id, quantos, anoId, turmaId, e.coordenadorId],
      )
      return rows.map((linha) => linha.id)
    }

    /** Uma execução da rotina de classificação, sem pessoa e sem ano: a que as linhas de consumo apontam. */
    const execucaoDe = (escolaId: string) =>
      idDe(`insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, null, 'classificacao_do_material', 'classificar_secoes', null, $2, '{"tarefa":"classificar_secoes"}') returning id`, [
        escolaId,
        randomUUID(),
      ])

    /** Uma chamada da escola, com o custo gravado, 100 tokens de entrada e 50 de saída, no instante `em`. */
    function chamada(escolaId: string, em: string, custoMicros: number, opcoes: { execucaoId?: string; reserva?: boolean } = {}): Promise<unknown> {
      return pool.query(
        `insert into consumo_ia (escola_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, custo_micros, pelo_provedor_de_reserva, execucao_id, em)
         values ($1, 'gerar_atividade_objetiva', 'conversa_e_ferramentas', 'padrao', 'openai_compat', 'modelo-de-teste', '2026-11-21.1', 100, 50, 10, false, 1, 'concluida', $2, $3, $4, $5::timestamptz)`,
        [escolaId, custoMicros, opcoes.reserva === true, opcoes.execucaoId ?? null, em],
      )
    }

    const retrato = (escolaId: string, mes: string, r: { alunos: number; valor: number | null; teto: number; origem: 'escola' | 'rede' | 'nenhuma' }) =>
      pool.query('insert into orcamento_ia_do_mes (escola_id, mes, alunos_ativos, valor_por_aluno_micros, teto_percentual, origem_do_valor) values ($1, $2, $3, $4, $5, $6)', [escolaId, mes, r.alunos, r.valor, r.teto, r.origem])

    /** A primeira página do uso, na ordem por custo (as escolas com custo de IA no mês vêm antes das sem), pelo relógio falso. */
    const usoPorCusto = async () => (await comRelogioFalso().uso({ pagina: 1, ordem: 'custo' })).itens
    const mesesDe = async (escolaId: string) => (await comRelogioFalso().usoDeIaDaEscola(escolaId)).meses

    /** A (rede R$ 9 e 500%, escola R$ 5 e 200%) e B (rede R$ 2 e 300%, escola R$ 1 e 100%), em redes diferentes, no mesmo mês. */
    async function aEB() {
      const a = await escolaDeIa({ rede: { valor: 9 * REAIS, teto: 500 }, propria: { valor: 5 * REAIS, teto: 200 }, alunos: 100 })
      const b = await escolaDeIa({ rede: { valor: 2 * REAIS, teto: 300 }, propria: { valor: 1 * REAIS, teto: 100 }, alunos: 900 })
      // A gastou R$ 100 em abril (R$ 40 às 23h30 do último dia, em São Paulo), R$ 700 em março e R$ 5.000 já em maio; B gastou R$ 1.000 em abril.
      await chamada(a.id, '2033-04-10T10:00:00-03:00', 60 * REAIS)
      await chamada(a.id, '2033-04-30T23:30:00-03:00', 40 * REAIS)
      await chamada(a.id, '2033-03-31T23:59:00-03:00', 700 * REAIS)
      await chamada(a.id, '2033-05-01T00:10:00-03:00', 5000 * REAIS)
      await chamada(b.id, '2033-04-15T10:00:00-03:00', 1000 * REAIS)
      await chamada(b.id, '2033-05-01T00:10:00-03:00', 5000 * REAIS)
      return { a, b }
    }

    it('A e B da §2: a linha de A traz 20% e 100 alunos, a de B 111% e 900; a chamada de 23h30 do último dia conta no mês e em hoje, e a de março e a de maio, não', async () => {
      const { a, b } = await aEB()
      const itens = await usoPorCusto()
      expect(soAsMinhas(itens, [a.id, b.id]).map((item) => item.id)).toEqual([b.id, a.id])
      expect(doItem(itens, a.id).ia).toStrictEqual({
        hoje: deIa(1, 1, 150, 40 * REAIS, 0),
        mes: deIa(2, 2, 300, 100 * REAIS, 0),
        alunosAtivos: 100,
        valorPorAlunoMicros: 5 * REAIS,
        origemDoValor: 'escola',
        porcentagem: 20,
        situacao: 'definido',
      })
      expect(doItem(itens, b.id).ia).toStrictEqual({
        hoje: ZERO_DE_IA,
        mes: deIa(1, 1, 150, 1000 * REAIS, 0),
        alunosAtivos: 900,
        valorPorAlunoMicros: 1 * REAIS,
        origemDoValor: 'escola',
        porcentagem: 111,
        situacao: 'definido',
      })
    })

    it('a ordem por custo põe a de maior custo do mês primeiro, mesmo com o id maior, e conta o mês corrente de São Paulo: o de março e o de maio não entram', async () => {
      const [menor, maior] = [randomUUID(), randomUUID()].toSorted()
      if (menor === undefined || maior === undefined) throw new Error('ids')
      const pouco = await escolaDeIa({ id: menor })
      const muito = await escolaDeIa({ id: maior })
      // `pouco` gastou muito em março e em maio e R$ 10 em abril; `muito` gastou R$ 20 em abril: só abril vale, e o desempate pelo id poria `pouco` na frente.
      await chamada(pouco.id, '2033-03-20T10:00:00-03:00', 500 * REAIS)
      await chamada(pouco.id, '2033-04-20T10:00:00-03:00', 10 * REAIS)
      await chamada(pouco.id, '2033-05-01T00:30:00-03:00', 900 * REAIS)
      await chamada(muito.id, '2033-04-20T10:00:00-03:00', 20 * REAIS)
      const itens = await usoPorCusto()
      expect(soAsMinhas(itens, [pouco.id, muito.id]).map((item) => item.id)).toEqual([muito.id, pouco.id])
      expect(doItem(itens, muito.id).ia.mes.custoMicros).toBe(20 * REAIS)
    })

    it('`chamadasPeloProvedorDeReserva` conta linhas e `execucoes` conta execuções (uma por linha sem execução); hoje e o mês, cada um com a sua soma de tokens', async () => {
      const e = await escolaDeIa({ alunos: 3 })
      const comDuasLinhas = await execucaoDe(e.id)
      const comUma = await execucaoDe(e.id)
      // Hoje (30/04): uma execução com duas linhas (a segunda, da reserva). No mês, antes de hoje: duas linhas sem execução (uma da reserva) e uma execução de uma linha.
      await chamada(e.id, '2033-04-30T10:00:00-03:00', 3 * REAIS, { execucaoId: comDuasLinhas })
      await chamada(e.id, '2033-04-30T10:00:05-03:00', 2 * REAIS, { execucaoId: comDuasLinhas, reserva: true })
      await chamada(e.id, '2033-04-12T10:00:00-03:00', 1 * REAIS)
      await chamada(e.id, '2033-04-12T10:00:01-03:00', 1 * REAIS, { reserva: true })
      await chamada(e.id, '2033-04-12T10:00:02-03:00', 1 * REAIS, { execucaoId: comUma })
      const { ia } = doItem(await usoPorCusto(), e.id)
      expect(ia.hoje).toStrictEqual(deIa(1, 2, 300, 5 * REAIS, 1))
      expect(ia.mes).toStrictEqual(deIa(4, 5, 750, 8 * REAIS, 2))
    })

    it('sem valor nem na rede: `sem_orcamento`, origem `nenhuma` e porcentagem nula, com os alunos e os reais à vista; a rede com valor e a escola sem: vale a da rede', async () => {
      const semValor = await escolaDeIa({ alunos: 4 })
      const daRede = await escolaDeIa({ rede: { valor: 4 * REAIS, teto: null }, alunos: 5 })
      await chamada(semValor.id, '2033-04-10T10:00:00-03:00', 7 * REAIS)
      await chamada(daRede.id, '2033-04-10T10:00:00-03:00', 10 * REAIS)
      const itens = await usoPorCusto()
      expect(doItem(itens, semValor.id).ia).toMatchObject({ situacao: 'sem_orcamento', origemDoValor: 'nenhuma', valorPorAlunoMicros: null, porcentagem: null, alunosAtivos: 4, mes: { custoMicros: 7 * REAIS } })
      // R$ 10 sobre 5 alunos a R$ 4 (R$ 20): 50%.
      expect(doItem(itens, daRede.id).ia).toMatchObject({ situacao: 'definido', origemDoValor: 'rede', valorPorAlunoMicros: 4 * REAIS, porcentagem: 50 })
    })

    it('a linha do uso traz a rede da escola e o orçamento próprio e o vigente, os mesmos da aba Escolas, para o diálogo "Orçamento de IA" abrir da própria linha (8.0)', async () => {
      const soTeto = await escolaDeIa({ rede: { valor: 4 * REAIS, teto: 300 }, propria: { valor: null, teto: 150 }, alunos: 2 })
      const semNada = await escolaDeIa()
      // Com gasto no mês, as duas entram na primeira página da ordem por custo (o banco de teste guarda escolas de outras execuções, todas com custo zero).
      await chamada(soTeto.id, '2033-04-10T10:00:00-03:00', 3 * REAIS)
      await chamada(semNada.id, '2033-04-10T10:00:00-03:00', 2 * REAIS)
      const { rows } = await pool.query<{ id: string; redeId: string; redeNome: string }>(
        'select e.id, r.id as "redeId", r.nome as "redeNome" from escola as e join rede as r on r.id = e.rede_id where e.id = any($1::uuid[])',
        [[soTeto.id, semNada.id]],
      )
      const redeDe = (escolaId: string) => {
        const linha = rows.find((candidata) => candidata.id === escolaId)
        return { id: linha?.redeId, nome: linha?.redeNome }
      }
      // As duas escolas estão em redes diferentes: sem isso, a rede de uma passaria pela da outra.
      expect(redeDe(soTeto.id).id).toBeDefined()
      expect(redeDe(semNada.id).id).toBeDefined()
      expect(redeDe(soTeto.id).id).not.toBe(redeDe(semNada.id).id)
      const itens = await usoPorCusto()
      const daLinha = doItem(itens, soTeto.id)
      // A rede da outra escola não entra: a rede de cada linha é a da própria escola, e o valor vem da rede e o teto da escola, coluna a coluna.
      expect(daLinha.rede).toStrictEqual(redeDe(soTeto.id))
      expect(daLinha.orcamento).toStrictEqual({
        proprio: { valorPorAlunoMicros: null, tetoDeSegurancaPercentual: 150 },
        vigente: { valorPorAlunoMicros: 4 * REAIS, origemDoValor: 'rede', tetoDeSegurancaPercentual: 150, origemDoTeto: 'escola' },
      })
      expect(doItem(itens, semNada.id).rede).toStrictEqual(redeDe(semNada.id))
      expect(doItem(itens, semNada.id).orcamento).toStrictEqual(SEM_ORCAMENTO_DA_ESCOLA)
      // O que o grupo `ia` diz do valor é o do `orcamento.vigente`: a mesma conta, as mesmas entradas.
      expect(daLinha.ia).toMatchObject({ valorPorAlunoMicros: daLinha.orcamento.vigente.valorPorAlunoMicros, origemDoValor: daLinha.orcamento.vigente.origemDoValor })
    })

    it('sem ano em curso: `sem_aluno_ativo`, sem porcentagem e com os reais à vista; sem valor e sem aluno vale `sem_orcamento`', async () => {
      const semAluno = await escolaDeIa({ propria: { valor: 5 * REAIS, teto: null }, semAnoEmCurso: true })
      const semNada = await escolaDeIa({ semAnoEmCurso: true })
      await chamada(semAluno.id, '2033-04-10T10:00:00-03:00', 7 * REAIS)
      await chamada(semNada.id, '2033-04-10T10:00:00-03:00', 6 * REAIS)
      const itens = await usoPorCusto()
      expect(doItem(itens, semAluno.id).ia).toMatchObject({ situacao: 'sem_aluno_ativo', alunosAtivos: 0, valorPorAlunoMicros: 5 * REAIS, porcentagem: null, mes: { custoMicros: 7 * REAIS } })
      expect(doItem(itens, semNada.id).ia).toMatchObject({ situacao: 'sem_orcamento', alunosAtivos: 0, porcentagem: null })
    })

    it('os alunos ativos da linha são os da aba Escolas: o vínculo não encerrado do ano anterior não conta, e o aluno em duas turmas do ano conta uma vez (A segue com 100)', async () => {
      const a = await escolaDeIa({ propria: { valor: 5 * REAIS, teto: null }, alunos: 99 })
      const segundaTurma = await turma(a.id, a.anoId, a.serieId, '2ºC')
      const [emDuasTurmas] = await alunosNaTurma(a, 1)
      if (emDuasTurmas === undefined) throw new Error('aluno')
      await vinculo(a.id, a.anoId, emDuasTurmas, segundaTurma, 'aluno', a.coordenadorId)
      // Cinco alunos com vínculo não encerrado só num ano anterior, já encerrado.
      const anoAnterior = await anoLetivo(a.id, 2032, 'encerrado')
      const turmaAnterior = await turma(a.id, anoAnterior, a.serieId, '1ºB')
      await alunosNaTurma(a, 5, turmaAnterior, anoAnterior)
      await chamada(a.id, '2033-04-10T10:00:00-03:00', 100 * REAIS)
      const { ia } = doItem(await usoPorCusto(), a.id)
      expect(ia).toMatchObject({ alunosAtivos: 100, porcentagem: 20 })
      // A aba Escolas (o nome da escola vem antes dos outros do banco, na primeira página) conta os mesmos 100.
      expect(doItem((await comRelogioFalso().escolas({ pagina: 1, ordem: 'nome' })).itens, a.id).alunos).toBe(100)
    })

    it('o relógio é o do serviço, não o `now()` do Postgres: com o relógio em 2033, a chamada de 2033 conta, e a de hoje de verdade não', async () => {
      const e = await escolaDeIa({ propria: { valor: 5 * REAIS, teto: null }, alunos: 10 })
      await chamada(e.id, '2033-04-30T12:00:00-03:00', 4 * REAIS)
      await pool.query(`insert into consumo_ia (escola_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, custo_micros, em)
         values ($1, 'gerar_atividade_objetiva', 'conversa_e_ferramentas', 'padrao', 'openai_compat', 'modelo-de-teste', '2026-11-21.1', 1, 1, 10, false, 1, 'concluida', $2, now())`, [e.id, 9 * REAIS])
      const { ia } = doItem(await usoPorCusto(), e.id)
      expect(ia.mes).toStrictEqual(deIa(1, 1, 150, 4 * REAIS, 0))
      expect(ia.hoje).toStrictEqual(deIa(1, 1, 150, 4 * REAIS, 0))
    })

    it('GET /uso aceita `ordem=custo` e GET /escolas a recusa com `ENTRADA_INVALIDA`', async () => {
      const noUso = await pedir(url, 'GET', '/v1/operacao/uso?ordem=custo', sessao.token)
      expect(noUso.status).toBe(200)
      expect(noUso.cacheControl).toBe('no-store')
      usoDoPainelResponseSchema.parse(noUso.corpo)
      esperarErro(await pedir(url, 'GET', '/v1/operacao/escolas?ordem=custo', sessao.token), 400, ErrorCode.ENTRADA_INVALIDA)
    })

    it('os 12 meses de A, cada um do seu retrato, com B com retrato num mês em que A não tem (A `sem_retrato`) e o consumo de B nos mesmos meses fora da soma de A', async () => {
      const a = await escolaDeIa({ propria: { valor: 9 * REAIS, teto: null }, alunos: 100 })
      const b = await escolaDeIa({ propria: { valor: 1 * REAIS, teto: null }, alunos: 900 })
      // Retratos de A: março (80 alunos, R$ 5), janeiro (sem aluno) e dezembro (sem valor); B: fevereiro e março, com números próprios.
      await retrato(a.id, '2033-03-01', { alunos: 80, valor: 5 * REAIS, teto: 200, origem: 'escola' })
      await retrato(a.id, '2033-01-01', { alunos: 0, valor: 5 * REAIS, teto: 200, origem: 'escola' })
      await retrato(a.id, '2032-12-01', { alunos: 10, valor: null, teto: 200, origem: 'nenhuma' })
      await retrato(b.id, '2033-02-01', { alunos: 900, valor: 1 * REAIS, teto: 100, origem: 'rede' })
      await retrato(b.id, '2033-03-01', { alunos: 900, valor: 1 * REAIS, teto: 100, origem: 'rede' })
      // O consumo de A: março com uma execução de duas linhas (a segunda, da reserva); o mês corrente, o de 13 meses atrás e o de janeiro (R$ 7, sem alunos): o corrente e o antigo de fora.
      const execucao = await execucaoDe(a.id)
      await chamada(a.id, '2033-03-10T10:00:00-03:00', 100 * REAIS, { execucaoId: execucao })
      await chamada(a.id, '2033-03-10T10:00:05-03:00', 100 * REAIS, { execucaoId: execucao, reserva: true })
      // A chamada de 23h30 do último dia de março (já 1º/04 em UTC) é de março, não de abril.
      await chamada(a.id, '2033-03-31T23:30:00-03:00', 20 * REAIS)
      await chamada(a.id, '2033-04-10T10:00:00-03:00', 999 * REAIS)
      await chamada(a.id, '2032-03-31T23:30:00-03:00', 888 * REAIS)
      await chamada(a.id, '2033-01-05T10:00:00-03:00', 7 * REAIS)
      // O consumo de B nos mesmos meses, com outros valores.
      await chamada(b.id, '2033-03-10T10:00:00-03:00', 700 * REAIS)
      await chamada(b.id, '2033-02-10T10:00:00-03:00', 450 * REAIS)
      await chamada(b.id, '2033-01-05T10:00:00-03:00', 33 * REAIS)

      const dosMesesDeA = await mesesDe(a.id)
      expect(dosMesesDeA.map((mes) => mes.mes)).toEqual(['2033-03', '2033-02', '2033-01', '2032-12', '2032-11', '2032-10', '2032-09', '2032-08', '2032-07', '2032-06', '2032-05', '2032-04'])
      const doMes = (mes: string) => dosMesesDeA.find((item) => item.mes === mes)
      // Março pelo retrato dele (80 alunos, R$ 5: orçamento R$ 400, R$ 220 gastos, 55%), e não pelos 100 alunos e R$ 9 de hoje.
      expect(doMes('2033-03')).toStrictEqual({ mes: '2033-03', ...deIa(2, 3, 450, 220 * REAIS, 1), alunosAtivos: 80, valorPorAlunoMicros: 5 * REAIS, origemDoValor: 'escola', porcentagem: 55, situacao: 'definido' })
      // Fevereiro: B tem retrato e A não, então A é `sem_retrato`, com o consumo de A (zero), e nunca o de B.
      expect(doMes('2033-02')).toStrictEqual({ mes: '2033-02', ...ZERO_DE_IA, alunosAtivos: null, valorPorAlunoMicros: null, origemDoValor: null, porcentagem: null, situacao: 'sem_retrato' })
      expect(doMes('2033-01')).toStrictEqual({ mes: '2033-01', ...deIa(1, 1, 150, 7 * REAIS, 0), alunosAtivos: 0, valorPorAlunoMicros: 5 * REAIS, origemDoValor: 'escola', porcentagem: null, situacao: 'sem_aluno_ativo' })
      expect(doMes('2032-12')).toMatchObject({ ...ZERO_DE_IA, alunosAtivos: 10, valorPorAlunoMicros: null, origemDoValor: 'nenhuma', porcentagem: null, situacao: 'sem_orcamento' })
      // O mês de 13 meses atrás não entra, nem o mês corrente: nenhum dos 12 soma R$ 888 nem R$ 999.
      expect(dosMesesDeA.some((mes) => [888 * REAIS, 999 * REAIS].includes(mes.custoMicros))).toBe(false)
      expect(dosMesesDeA.filter((mes) => mes.situacao === 'sem_retrato')).toHaveLength(9)

      const dosMesesDeB = await mesesDe(b.id)
      expect(dosMesesDeB).toHaveLength(12)
      expect(dosMesesDeB.find((item) => item.mes === '2033-02')).toStrictEqual({ mes: '2033-02', ...deIa(1, 1, 150, 450 * REAIS, 0), alunosAtivos: 900, valorPorAlunoMicros: 1 * REAIS, origemDoValor: 'rede', porcentagem: 50, situacao: 'definido' })
      expect(dosMesesDeB.find((item) => item.mes === '2033-03')).toMatchObject({ custoMicros: 700 * REAIS, porcentagem: 77 })
      expect(dosMesesDeB.find((item) => item.mes === '2033-01')).toMatchObject({ custoMicros: 33 * REAIS, situacao: 'sem_retrato' })
    })

    it('o mês fechado não leva aviso, mesmo a 100% do orçamento: o aviso é só do mês corrente', async () => {
      const a = await escolaDeIa({ propria: { valor: 5 * REAIS, teto: null }, alunos: 10 })
      await retrato(a.id, '2033-03-01', { alunos: 10, valor: 5 * REAIS, teto: 200, origem: 'escola' })
      await chamada(a.id, '2033-03-10T10:00:00-03:00', 50 * REAIS)
      const meses = await runInContext({ requisicaoId: randomUUID(), escolaId: a.id }, () => new OrcamentoDoMesRepository(banco).usoDosMesesAnteriores(AGORA))
      expect(meses?.find((item) => item.mes === '2033-03')?.orcamento).toMatchObject({ situacao: 'definido', porcentagem: 100, aviso: null })
    })

    it('GET /escolas/:id/uso-ia: 12 meses, do anterior ao corrente para trás, com o contrato estrito e `no-store`; o id inexistente (ou que não é UUID) responde `NAO_ENCONTRADO`', async () => {
      const e = await escolaDeIa()
      const resposta = await pedir(url, 'GET', `/v1/operacao/escolas/${e.id}/uso-ia`, sessao.token)
      expect(resposta.status).toBe(200)
      expect(resposta.cacheControl).toBe('no-store')
      const { meses } = usoDeIaDaEscolaDoPainelResponseSchema.parse(resposta.corpo)
      // Os 12 meses anteriores ao corrente **de São Paulo** (e não de UTC, que vira três horas antes no último dia do mês).
      const [anoDeHoje = 0, mesDeHoje = 0] = mesDeSaoPaulo(new Date()).split('-').map(Number)
      const esperados = Array.from({ length: 12 }, (_, indice) => {
        const posicao = anoDeHoje * 12 + (mesDeHoje - 1) - (indice + 1)
        return `${String(Math.floor(posicao / 12))}-${String((posicao % 12) + 1).padStart(2, '0')}`
      })
      expect(meses.map((mes) => mes.mes)).toEqual(esperados)
      for (const inexistente of [randomUUID(), 'nao-e-uuid', '1']) esperarErro(await pedir(url, 'GET', `/v1/operacao/escolas/${inexistente}/uso-ia`, sessao.token), 404, ErrorCode.NAO_ENCONTRADO)
    })
  })

  describe('I6: nenhuma resposta das rotas de leitura e de convite traz pessoa da escola, nem o operador, inclusive 400, 404, 409 e 503', () => {
    it('com sentinelas em cada tabela de pessoa: coordenação, professor, aluno, matrícula, complemento, turma e operador', async () => {
      const marca = randomUUID().slice(0, 8)
      const sentinelas = {
        coordenacaoNome: `Coordenação Sentinela ${marca}`,
        coordenacaoEmail: `sentinela-coordenacao-${marca}@escola.invalid`,
        professorNome: `Professor Sentinela ${marca}`,
        professorEmail: `sentinela-professor-${marca}@escola.invalid`,
        complemento: `Complemento Sentinela ${marca}`,
        alunoNome: `Aluno Sentinela ${marca}`,
        matricula: `MAT-SENTINELA-${marca}`,
        turma: `Turma Sentinela ${marca}`,
        operadorNome: `Operador Sentinela ${marca}`,
        operadorEmail: `${sessao.apelido}@turmma.invalid`,
      }
      await operadores.pool.query('update operador set nome = $1 where id = $2', [sentinelas.operadorNome, sessao.operadorId])
      // A escola das sentinelas, com ano em curso, turma, professor com complemento, aluno com matrícula e uso.
      const escolaId = await novaEscola()
      const [anoId, serieId] = await Promise.all([anoLetivo(escolaId, 2026, 'em_curso'), serie(escolaId)])
      const turmaId = await turma(escolaId, anoId, serieId, sentinelas.turma)
      const professor = await pessoa(escolaId, 'professor', { nome: sentinelas.professorNome, contaId: await conta(sentinelas.professorEmail) })
      await vinculo(escolaId, anoId, professor, turmaId, 'professor', professor, { estado: 'contestado', complemento: sentinelas.complemento })
      const aluno = await pessoa(escolaId, 'aluno', { nome: sentinelas.alunoNome })
      await pool.query(`insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, 'hash-sintetico')`, [escolaId, aluno, sentinelas.matricula])
      await vinculo(escolaId, anoId, aluno, turmaId, 'aluno', professor)
      await usoNoDia(escolaId, (await referenciaDaApi()).dia, periodo(12, 3, 4_096))

      // A escola em `ativa`, para o revogar que dá `CONFLITO`: coordenador ativo e um convite em aberto de outra pessoa.
      const ativa = await novaEscola()
      await pessoa(ativa, 'coordenador', { nome: sentinelas.coordenacaoNome })
      const outraCoordenacao = await pessoa(ativa, 'coordenador', { desativada: true })
      const conviteDaAtiva = await idDe(`insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em) values ($1, $2, 'coordenador', $3, now() + interval '72 hours') returning id`, [
        ativa,
        randomBytes(32).toString('hex'),
        outraCoordenacao,
      ])

      linhasDeLog.length = 0
      const respostas: Resposta[] = []
      const guardar = (resposta: Resposta) => {
        respostas.push(resposta)
        return resposta
      }
      const textos: string[] = []
      const t = sessao.token
      const post = (caminho: string, corpo?: unknown, naApi = url) => pedir(naApi, 'POST', caminho, t, corpo)
      const get = (caminho: string, naApi = url) => pedir(naApi, 'GET', caminho, t)

      // GET /redes, POST /redes e POST /escolas: 200, 201, 400, 404 e 409.
      expect(guardar(await get('/v1/operacao/redes')).status).toBe(200)
      const novaRede = { id: randomUUID(), nome: `Rede Leitura I6 ${marca}`, tipo: 'independente' }
      expect(guardar(await post('/v1/operacao/redes', novaRede)).status).toBe(201)
      redes.push(novaRede.id)
      esperarErro(guardar(await post('/v1/operacao/redes', { ...novaRede, autor: sentinelas.operadorNome })), 400, ErrorCode.ENTRADA_INVALIDA)
      esperarErro(guardar(await post('/v1/operacao/redes', { ...novaRede, nome: `${novaRede.nome} outra` })), 409, ErrorCode.CONFLITO)
      const novaEscolaPedida = { id: randomUUID(), redeId: novaRede.id, nome: `Escola Leitura I6 ${marca}`, slug: `leitura-i6-${marca}` }
      expect(guardar(await post('/v1/operacao/escolas', novaEscolaPedida)).status).toBe(201)
      escolas.push(novaEscolaPedida.id)
      esperarErro(guardar(await post('/v1/operacao/escolas', { ...novaEscolaPedida, id: randomUUID(), redeId: randomUUID(), slug: `leitura-i6-sem-rede-${marca}` })), 404, ErrorCode.NAO_ENCONTRADO)
      esperarErro(guardar(await post('/v1/operacao/escolas', { ...novaEscolaPedida, id: randomUUID() })), 409, ErrorCode.CONFLITO)
      esperarErro(guardar(await post('/v1/operacao/escolas', { ...novaEscolaPedida, escolaId })), 400, ErrorCode.ENTRADA_INVALIDA)

      // O convite da coordenação: gerar (com as sentinelas da coordenação), refazer e revogar, com 400, 404 e 409.
      const gerar = (id: string, corpo: unknown, naApi = url) => post(`/v1/operacao/escolas/${id}/convite-coordenacao`, corpo, naApi)
      const coordenacao = { nome: sentinelas.coordenacaoNome, email: sentinelas.coordenacaoEmail }
      const gerado = guardar(await gerar(escolaId, coordenacao))
      expect(gerado.status).toBe(201)
      const { conviteId } = conviteDaCoordenacaoResponseSchema.parse(gerado.corpo)
      contas.push(await idDe('select id from conta where email = $1', [sentinelas.coordenacaoEmail]))
      esperarErro(guardar(await gerar(escolaId, coordenacao)), 409, ErrorCode.CONFLITO)
      esperarErro(guardar(await gerar(randomUUID(), coordenacao)), 404, ErrorCode.NAO_ENCONTRADO)
      esperarErro(guardar(await gerar(escolaId, { ...coordenacao, autor: sentinelas.operadorNome })), 400, ErrorCode.ENTRADA_INVALIDA)
      const refeito = guardar(await post(`/v1/operacao/convites/${conviteId}/refazer`))
      expect(refeito.status).toBe(201)
      const novoConvite = conviteDaCoordenacaoResponseSchema.parse(refeito.corpo).conviteId
      esperarErro(guardar(await post(`/v1/operacao/convites/${randomUUID()}/refazer`)), 404, ErrorCode.NAO_ENCONTRADO)
      esperarErro(guardar(await post(`/v1/operacao/convites/${novoConvite}/refazer`, { autor: sentinelas.operadorNome })), 400, ErrorCode.ENTRADA_INVALIDA)
      esperarErro(guardar(await post(`/v1/operacao/convites/${conviteDaAtiva}/refazer`)), 409, ErrorCode.CONFLITO)
      esperarErro(guardar(await post(`/v1/operacao/convites/${conviteDaAtiva}/revogar`)), 409, ErrorCode.CONFLITO)
      esperarErro(guardar(await post(`/v1/operacao/convites/${conviteId}/revogar`)), 404, ErrorCode.NAO_ENCONTRADO)
      esperarErro(guardar(await post(`/v1/operacao/convites/${novoConvite}/revogar`, { autor: sentinelas.operadorNome })), 400, ErrorCode.ENTRADA_INVALIDA)

      // A lista e o uso inteiros (a escola das sentinelas está neles, com o que ela tem), e a consulta recusada.
      const lidaNaLista = doItem((await lista('nome', textos)).itens, escolaId)
      expect(lidaNaLista).toMatchObject({ estado: 'pendente', conviteId: novoConvite, turmas: 1, professores: 0, alunos: 1 })
      expect(doItem((await uso('uso', textos)).itens, escolaId).dia).toEqual(periodo(12, 3, 4_096))
      // O uso de IA (camada-ia, 5.0): `?ordem=custo` e os 12 meses da escola das sentinelas, e o 404 do id que não existe.
      expect(doItem((await uso('custo', textos)).itens, escolaId).ia).toMatchObject({ alunosAtivos: 1, hoje: { chamadas: 0 } })
      const dosMeses = guardar(await get(`/v1/operacao/escolas/${escolaId}/uso-ia`))
      expect(dosMeses.status).toBe(200)
      textos.push(dosMeses.texto)
      esperarErro(guardar(await get(`/v1/operacao/escolas/${randomUUID()}/uso-ia`)), 404, ErrorCode.NAO_ENCONTRADO)
      for (const consulta of ['ordem=nome&escolaId=' + escolaId, 'ordem=aluno', 'pagina=0']) {
        esperarErro(guardar(await get(`/v1/operacao/escolas?${consulta}`)), 400, ErrorCode.ENTRADA_INVALIDA)
        esperarErro(guardar(await get(`/v1/operacao/uso?${consulta}`)), 400, ErrorCode.ENTRADA_INVALIDA)
      }
      // 204, sem corpo.
      expect(guardar(await post(`/v1/operacao/convites/${novoConvite}/revogar`)).status).toBe(204)

      // 503: numa API com o prazo das consultas curto, cada rota espera o que o teste segura (a tabela que ela lê, ou a
      // trava do convite da escola) até o `statement_timeout` cortar.
      const curta = await subirApiDoPainel(linhasDeLog, AMBIENTE, PRAZO_CURTO_MS)
      try {
        const esgotados: Resposta[] = []
        const naTabelaSegura = async (tabela: string, chamadas: (() => Promise<Resposta>)[]) => {
          const conexao = await pool.connect()
          try {
            await conexao.query('begin')
            await conexao.query(`lock table ${tabela} in access exclusive mode`)
            for (const chamada of chamadas) esgotados.push(await chamada())
          } finally {
            await conexao.query('rollback')
            conexao.release()
          }
        }
        await naTabelaSegura('rede', [
          () => get('/v1/operacao/redes', curta.url),
          () => post('/v1/operacao/redes', { id: randomUUID(), nome: `Rede Leitura I6 ${marca} 503`, tipo: 'grupo' }, curta.url),
          () => post('/v1/operacao/escolas', { id: randomUUID(), redeId: novaRede.id, nome: 'Escola 503', slug: `leitura-503-${marca}` }, curta.url),
        ])
        await naTabelaSegura('turma', [() => get('/v1/operacao/escolas?ordem=nome', curta.url)])
        await naTabelaSegura('uso_infra_diario', [() => get('/v1/operacao/uso?ordem=uso', curta.url)])
        const soltar = await segurarTravaDaEscola(pool, escolaId)
        try {
          esgotados.push(await gerar(escolaId, coordenacao, curta.url))
        } finally {
          await soltar()
        }
        const soltarAtiva = await segurarTravaDaEscola(pool, ativa)
        try {
          esgotados.push(await post(`/v1/operacao/convites/${conviteDaAtiva}/refazer`, undefined, curta.url))
          esgotados.push(await post(`/v1/operacao/convites/${conviteDaAtiva}/revogar`, undefined, curta.url))
        } finally {
          await soltarAtiva()
        }
        for (const esgotado of esgotados) {
          esperarErro(guardar(esgotado), 503, ErrorCode.TEMPO_ESGOTADO)
          expect(esgotado.retryAfter).not.toBeNull()
        }
        expect(esgotados).toHaveLength(8)
      } finally {
        await curta.app.close()
      }

      // As rotas responderam (as do uso de IA entre elas), com cada código de erro; e nenhum texto de resposta traz uma sentinela.
      expect(new Set(respostas.map((resposta) => resposta.status))).toEqual(new Set([200, 201, 204, 400, 404, 409, 503]))
      const todas = [...respostas.map((resposta) => resposta.texto), ...textos]
      expect(todas.some((texto) => texto.includes(escolaId))).toBe(true)
      for (const texto of todas) for (const [qual, sentinela] of Object.entries(sentinelas)) expect(texto, qual).not.toContain(sentinela)
      // Nem o log dessas rotas, inclusive o 503 do gerar, cuja consulta cortada levava o nome e o e-mail da coordenação.
      expect(linhasDeLog.length).toBeGreaterThan(0)
      const todoOLog = linhasDeLog.join('\n')
      for (const [qual, sentinela] of Object.entries(sentinelas)) expect(todoOLog, qual).not.toContain(sentinela)
    })
  })
})
