import { createDatabase, createPool, type Database, type DatabasePool } from '@educa/nucleo'
import {
  ErrorCode,
  ESCOLAS_POR_PAGINA,
  conviteDaCoordenacaoResponseSchema,
  escolasDoPainelResponseSchema,
  usoDoPainelResponseSchema,
  type EscolaDoPainel,
  type OrdemDoPainel,
  type UsoDaEscolaDoPainel,
  type UsoDoPeriodoDoPainel,
} from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { PainelService } from '../src/operacao/painel/painel.service.js'
import { esperarErro, pedir, PRAZO_DAS_CONSULTAS_MS, subirApiDoPainel, todasAsPaginas, type Resposta } from './painel-de-teste.js'
import { BancadaDeOperadores, type SessaoDeOperadorDeTeste } from './sessao-de-operador.js'
import { segurarTravaDaEscola } from './trava-da-escola.js'

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

/** Ordena como o painel: pela chave, e o desempate pelo `id` (o `uuid` do Postgres compara como o texto em minúsculas). */
const porId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

describe('painel da operação: a lista de escolas e o uso, entre escolas (tarefa 5.0)', () => {
  const operadores = new BancadaDeOperadores()
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
  let sessao: SessaoDeOperadorDeTeste

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
  async function uso(ordem: OrdemDoPainel, textos?: string[]) {
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
        for (const tabela of ['vinculo', 'credencial_matricula', 'turma', 'disciplina', 'serie', 'ano_letivo', 'convite', 'sessao', 'usuario', 'uso_infra_diario', 'auditoria']) {
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

      // O item inteiro: só id, nome, endereço, rede, estado e número.
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
        dia: periodo(7_000, 30, 5_000),
        mes: antes === undefined ? periodo(7_000, 30, 5_000) : periodo(8_000, 40, 9_000),
      })
      expect(doItem(lido.itens, pouco)).toStrictEqual({
        id: pouco,
        nome: `Escola Leitura Uso ${sufixo}`,
        dia: periodo(70, 3, 1_000),
        mes: antes === undefined ? periodo(70, 3, 1_000) : periodo(75, 4, 1_000),
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

  describe('I6: nenhuma resposta das oito rotas traz pessoa da escola, nem o operador, inclusive 400, 404, 409 e 503', () => {
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

      // As oito rotas responderam, com cada código de erro; e nenhum texto de resposta traz uma sentinela.
      expect(new Set(respostas.map((resposta) => resposta.status))).toEqual(new Set([200, 201, 204, 400, 404, 409, 503]))
      const todas = [...respostas.map((resposta) => resposta.texto), ...textos]
      expect(todas.some((texto) => texto.includes(escolaId))).toBe(true)
      for (const texto of todas) for (const [qual, sentinela] of Object.entries(sentinelas)) expect(texto, qual).not.toContain(sentinela)
      // Nem o log das oito rotas, inclusive o 503 do gerar, cuja consulta cortada levava o nome e o e-mail da coordenação.
      expect(linhasDeLog.length).toBeGreaterThan(0)
      const todoOLog = linhasDeLog.join('\n')
      for (const [qual, sentinela] of Object.entries(sentinelas)) expect(todoOLog, qual).not.toContain(sentinela)
    })
  })
})
