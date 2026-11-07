import { CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA, createDatabase, createPool, executarPlanilha, ImportacaoRepository, runInContext, type Clock, type Database, type DatabasePool } from '@educa/core'
import { ErrorCode, semanaResponseSchema } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { TEST_APP_OPTIONS } from './test-config.js'
import { aguardar, WriteBlockTrigger } from './write-block-trigger.js'

/**
 * O texto da aula acompanha a reimportação da grade e do calendário (F2b, tarefa 5.0; `tasks/prd-semana-do-professor/cenarios.md`, "Reimportação da
 * grade", J1 a J16, RF13 e RF14). A reimportação é a real do F2: a planilha vai pela API e o job (`executarPlanilha`) a grava, com o relógio injetado
 * (quarta, 2026-11-04, 10h em Brasília). Postgres real do compose de teste; escolas, anos, e-mails e nomes gerados. As corridas (J11a, J11b, J12 e J16)
 * têm a ordem forçada: o job para num gatilho do banco de teste (`WriteBlockTrigger`) ou na trava consultiva do vínculo, que o teste segura.
 */

const NAO_ENCONTRADO = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO }
const PREFIXO = `reim${randomUUID().slice(0, 6)}`
const CABECALHO_DA_GRADE = 'turma;disciplina;professor;email;dia;inicio;fim;sala'
const CABECALHO_DO_CALENDARIO = 'inicio;fim;tipo;descricao'
const SENTINELA = `texto-sentinela-${PREFIXO}`

/** Uma quarta-feira, 10h em Brasília: `hoje` é 2026-11-04. */
const QUARTA_DE_MANHA = new Date('2026-11-04T13:00:00Z')
/** 22h de quarta em Brasília, já quinta em UTC: `hoje` continua 2026-11-04. */
const QUARTA_A_NOITE = new Date('2026-11-05T01:00:00Z')
const HOJE = '2026-11-04'
const SEGUNDA_ANTERIOR = '2026-10-26'
const SEGUNDA_PASSADA = '2026-11-02'
const SEGUNDA_FUTURA = '2026-11-09'
const SEGUNDA_SEGUINTE = '2026-11-16'
const TERCA_PASSADA = '2026-11-03'
const TERCA_FUTURA = '2026-11-10'
const QUARTA_PASSADA = '2026-10-28'
const QUARTA_FUTURA = '2026-11-11'
const QUARTA_SEGUINTE = '2026-11-18'

function erroDe(resposta: RespostaHttp): { status: number; codigo: unknown } {
  return { status: resposta.status, codigo: (resposta.corpo.erro as { codigo?: unknown } | undefined)?.codigo }
}

/** O dia da semana (1 segunda a 7 domingo), o início e o fim de uma aula da grade. */
type Aula = readonly [dia: number, inicio: string, fim: string]
/** Um registro de texto como o banco o guarda: data, início, fim e o texto. */
type Registro = readonly [data: string, inicio: string, fim: string, conteudo: string]

interface Escola {
  readonly escolaId: string
  readonly coordenacao: TestSessao
  readonly emCurso: string
  readonly planejado: string
  readonly serieId: string
}

interface Professora {
  readonly sessao: TestSessao
  readonly nome: string
  readonly email: string
}

/** O cliente de uma conexão do pool de apoio, para a transação que o teste segura. */
type Cliente = PoolClient

/** A professora com o vínculo (já confirmado) que a grade importada criou para ela na turma. */
interface Docente {
  readonly professora: Professora
  readonly vinculoId: string
  readonly turmaCurta: string
}

describe('a reimportação da grade e do calendário: o texto da aula acompanha (F2b, tarefa 5.0)', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const relogio: Clock & { atual: Date } = { atual: QUARTA_DE_MANHA, agora: () => relogio.atual }
  let api: TestApi
  let apoio: DatabasePool
  let bancoDoJob: Database

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_USUARIO_MIN: '1000', LIMITE_REQ_ESCOLA_MIN: '1000' } }, undefined, { ...TEST_APP_OPTIONS, relogioDaSemana: relogio })
    apoio = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 8, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    bancoDoJob = createDatabase(apoio)
  })

  afterAll(async () => {
    await api.app.close()
    await apoio.end()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const pedir = (sessao: TestSessao, metodo: string, caminho: string, corpo?: unknown) => chamar(api.url, metodo, caminho, sessao.token, corpo)
  const gravar = (sessao: TestSessao, vinculoId: string, data: string, inicio: string, texto: string) => pedir(sessao, 'PUT', '/v1/aulas', { vinculoId, data, inicio, texto })

  async function criado(resposta: Promise<RespostaHttp>, status = 201): Promise<string> {
    const lida = await resposta
    expect(lida.status).toBe(status)
    return lida.corpo['id'] as string
  }

  async function anoNovo(coordenacao: TestSessao, ano: number, abrir: boolean): Promise<string> {
    const id = await criado(pedir(coordenacao, 'POST', '/v1/anos-letivos', { ano, inicio: `${String(ano)}-02-01`, fim: `${String(ano)}-12-15` }))
    if (abrir) await criado(pedir(coordenacao, 'POST', `/v1/anos-letivos/${id}/abrir`), 200)
    return id
  }

  /** A escola com a coordenação, o ano de 2026 (02-01 a 12-15) em curso, o de 2027 planejado e a série do 8º ano. */
  async function escolaComAnos(): Promise<Escola> {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const { rows } = await bancada.pool.query<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 8) returning id", [escolaId])
    return { escolaId, coordenacao, emCurso: await anoNovo(coordenacao, 2026, true), planejado: await anoNovo(coordenacao, 2027, false), serieId: rows[0]?.id ?? '' }
  }

  async function turmaNa(e: Escola, nome: string): Promise<void> {
    const chave = `${nome.charAt(0)}${nome.slice(-1).toLowerCase()}`
    await bancada.pool.query('insert into turma (escola_id, ano_letivo_id, serie_id, nome, chave) values ($1, $2, $3, $4, $5)', [e.escolaId, e.emCurso, e.serieId, nome, chave])
  }

  async function disciplinaNa(e: Escola): Promise<void> {
    await bancada.pool.query('insert into disciplina (escola_id, nome) values ($1, $2)', [e.escolaId, `Química ${PREFIXO}`])
  }

  /** Uma professora da escola com sessão, nome e e-mail próprios (a conta existe: a planilha da grade só reaproveita professor que a escola já tem). */
  async function professoraNa(e: Escola, rotulo: string): Promise<Professora> {
    const sessao = await bancada.sessao(e.escolaId, 'professor')
    const nome = `Prof ${rotulo} ${PREFIXO}`
    const email = `${PREFIXO}-${rotulo}-${randomUUID().slice(0, 6)}@professores.invalid`
    const { rows: conta } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [email])
    await bancada.pool.query('update usuario set nome = $2, conta_id = $3 where id = $1', [sessao.usuarioId, nome, conta[0]?.id])
    return { sessao, nome, email }
  }

  const linhaDaGrade = ({ professora, turmaCurta }: Pick<Docente, 'professora' | 'turmaCurta'>, [dia, inicio, fim]: Aula): string =>
    [turmaCurta, `Química ${PREFIXO}`, professora.nome, professora.email, String(dia), inicio, fim, ''].join(';')
  const linhasDaGrade = (docente: Pick<Docente, 'professora' | 'turmaCurta'>, aulas: readonly Aula[]): string[] => aulas.map((aula) => linhaDaGrade(docente, aula))

  /** O job uma vez, na escola do job, com o relógio pedido: a grade só reaproveita professor que a escola já tem, e por isso o job nunca pede conta global. */
  const rodar = (escolaId: string, importacaoId: string, doJob: Clock = relogio) =>
    runInContext({ requisicaoId: randomUUID(), escolaId }, () =>
      executarPlanilha(bancoDoJob, importacaoId, { acharConta: () => Promise.reject(new Error('a grade deste teste não cadastra professor')), travarContas: () => Promise.resolve(true), relogio: doJob }),
    )

  /** Grava a planilha (202) e devolve o id da importação. */
  async function gravarPlanilha(e: Escola, tipo: 'grade' | 'calendario', linhas: string[], extra: { encerrar?: string[]; anoLetivoId?: string } = {}): Promise<string> {
    const texto = [tipo === 'grade' ? CABECALHO_DA_GRADE : CABECALHO_DO_CALENDARIO, ...linhas].join('\n')
    const marcas = { transferir: [], desligar: [], encerrar: extra.encerrar ?? [] }
    return criado(pedir(e.coordenacao, 'POST', `/v1/importacoes/${tipo}`, { texto, marcas, ...(extra.anoLetivoId === undefined ? {} : { anoLetivoId: extra.anoLetivoId }) }), 202)
  }

  /** Grava a planilha da grade e roda o job; devolve o id da importação e o que o job respondeu. */
  async function reimportar(e: Escola, linhas: string[], extra: { encerrar?: string[]; anoLetivoId?: string; doJob?: Clock } = {}): Promise<{ id: string; resultado: string }> {
    const id = await gravarPlanilha(e, 'grade', linhas, extra)
    return { id, resultado: await rodar(e.escolaId, id, extra.doJob) }
  }

  async function importarCalendario(e: Escola, linhas: string[]): Promise<void> {
    const id = await gravarPlanilha(e, 'calendario', linhas)
    expect(await rodar(e.escolaId, id)).toBe('concluida')
  }

  /**
   * Uma escola com a turma, a Química e as professoras pedidas, com a grade de todas importada pelo job real (o vínculo nasce `pendente` e a
   * professora o confirma, como no uso: aqui, direto no banco). Devolve as professoras na ordem em que foram pedidas.
   */
  async function escolaComGrade(especificacoes: ReadonlyArray<readonly [rotulo: string, turma: string, aulas: readonly Aula[]]>): Promise<{ e: Escola; docentes: Docente[] }> {
    const e = await escolaComAnos()
    await disciplinaNa(e)
    for (const turma of new Set(especificacoes.map(([, nome]) => nome))) await turmaNa(e, turma)
    const pendentes = await Promise.all(
      especificacoes.map(async ([rotulo, turma]) => ({ professora: await professoraNa(e, rotulo), turmaCurta: `${turma.charAt(0)}${turma.slice(-1)}` })),
    )
    const linhas = especificacoes.flatMap(([, , aulas], posicao) => linhasDaGrade(pendentes[posicao] as Pick<Docente, 'professora' | 'turmaCurta'>, aulas))
    expect((await reimportar(e, linhas)).resultado).toBe('concluida')
    const docentes: Docente[] = []
    for (const { professora, turmaCurta } of pendentes) {
      const { rows } = await bancada.pool.query<{ id: string }>("update vinculo set estado = 'confirmado', decidido_em = now() where escola_id = $1 and usuario_id = $2 returning id", [e.escolaId, professora.sessao.usuarioId])
      docentes.push({ professora, vinculoId: rows[0]?.id ?? '', turmaCurta })
    }
    return { e, docentes }
  }

  /** O registro de texto da aula, gravado direto no banco (o que a rota não grava: o passado sem alocação). */
  async function registrar(e: Escola, vinculoId: string, data: string, inicio: string, fim: string, conteudo: string, anoId = e.emCurso, cliente: Pick<Cliente, 'query'> = bancada.pool): Promise<void> {
    await cliente.query('insert into aula (escola_id, ano_letivo_id, vinculo_id, data, inicio, fim, conteudo) values ($1, $2, $3, $4, $5, $6, $7)', [e.escolaId, anoId, vinculoId, data, inicio, fim, conteudo])
  }

  /** Os registros do vínculo, direto do banco, em ordem de data e início. */
  async function registrosDe(vinculoId: string): Promise<Registro[]> {
    const { rows } = await bancada.pool.query<{ data: string; inicio: string; fim: string; conteudo: string }>(
      "select to_char(data, 'YYYY-MM-DD') as data, to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim, conteudo from aula where vinculo_id = $1 order by data, inicio",
      [vinculoId],
    )
    return rows.map((linha) => [linha.data, linha.inicio, linha.fim, linha.conteudo] as const)
  }

  /** As alocações do vínculo: dia, início e fim. */
  async function gradeDe(vinculoId: string): Promise<Aula[]> {
    const { rows } = await bancada.pool.query<{ dia: number; inicio: string; fim: string }>(
      "select dia_semana as dia, to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim from alocacao where vinculo_id = $1 order by dia_semana, inicio",
      [vinculoId],
    )
    return rows.map((linha) => [linha.dia, linha.inicio, linha.fim] as const)
  }

  const estadoDaImportacao = async (id: string): Promise<string | undefined> => (await bancada.pool.query<{ estado: string }>('select estado from importacao_planilha where id = $1', [id])).rows[0]?.estado
  const estadoDoVinculo = async (id: string): Promise<string | undefined> => (await bancada.pool.query<{ estado: string }>('select estado from vinculo where id = $1', [id])).rows[0]?.estado

  /** A chave da trava do vínculo como o banco a calcula, no formato do `objid` do `pg_locks` (o `int4` sem sinal). */
  const OBJID_DA_TRAVA = '(hashtext($1::uuid::text || $2::uuid::text)::bigint & 4294967295)'

  /** Quantas transações esperam, agora, na trava deste vínculo (a classe e a chave da gravação), e não em qualquer trava consultiva. */
  async function esperandoNaTravaDe(e: Escola, vinculoId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ total: number }>(
      `select count(*)::int as total from pg_locks where locktype = 'advisory' and classid = $3 and objsubid = 2 and not granted and objid::text::bigint = ${OBJID_DA_TRAVA}`,
      [e.escolaId, vinculoId, CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA],
    )
    return rows[0]?.total ?? 0
  }

  async function esperarNaFilaDaTrava(e: Escola, vinculoId: string): Promise<void> {
    await aguardar(async () => (await esperandoNaTravaDe(e, vinculoId)) >= 1, `alguém esperando na trava do vínculo ${vinculoId}`)
  }

  /**
   * As chaves da trava do vínculo que alguma transação tem concedidas agora (no formato de `OBJID_DA_TRAVA`), só das `dessaEscola`: o banco de teste
   * é de todas as execuções, e outra transação segurando a classe, de outra escola, não pode deixar o caso vermelho por acaso.
   */
  async function travasConcedidas(dessaEscola: readonly number[]): Promise<number[]> {
    const { rows } = await bancada.pool.query<{ chave: string }>(
      "select objid::text as chave from pg_locks where locktype = 'advisory' and classid = $1 and objsubid = 2 and granted and objid::text = any($2::text[]) order by objid",
      [CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA, dessaEscola.map(String)],
    )
    return rows.map(({ chave }) => Number(chave))
  }

  async function chaveDaTrava(e: Escola, vinculoId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ chave: string }>(`select ${OBJID_DA_TRAVA}::text as chave`, [e.escolaId, vinculoId])
    return Number(rows[0]?.chave)
  }

  /** Segura a trava do vínculo numa transação do teste que não confirma; `consultar` roda na mesma transação. */
  async function segurarTrava(e: Escola, vinculoId: string): Promise<{ cliente: Cliente; terminar: (como: 'commit' | 'rollback') => Promise<void> }> {
    const cliente = await apoio.connect()
    await cliente.query('begin')
    await cliente.query('select pg_advisory_xact_lock($1, hashtext($2::uuid::text || $3::uuid::text))', [CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA, e.escolaId, vinculoId])
    return {
      cliente,
      terminar: async (como) => {
        try {
          await cliente.query(como)
        } finally {
          cliente.release()
        }
      },
    }
  }

  /** Linhas que as FKs compostas não deixam existir (escola ou ano de um lado, vínculo do outro): só com `session_replication_role = replica`. */
  async function plantar(registros: ReadonlyArray<{ escolaId: string; anoId: string; vinculoId: string; data: string; inicio: string }>): Promise<void> {
    const cliente = await apoio.connect()
    try {
      await cliente.query('begin')
      await cliente.query('set local session_replication_role = replica')
      for (const { escolaId, anoId, vinculoId, data, inicio } of registros) {
        await cliente.query("insert into aula (escola_id, ano_letivo_id, vinculo_id, data, inicio, fim, conteudo) values ($1, $2, $3, $4, $5, '23:00', $6)", [escolaId, anoId, vinculoId, data, inicio, 'plantada'])
      }
      await cliente.query('commit')
    } finally {
      await cliente.query('rollback').catch(() => undefined)
      cliente.release()
    }
  }

  const MANHA: Aula = [1, '07:30', '08:20']
  const horaDe = (minutos: number): string => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
  const somarMinutos = (hora: string, minutos: number): string => horaDe(Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) + minutos)

  describe('a aula que continua, a que muda de horário e a que sai (RF14)', () => {
    it('J1: a aula que continua mantém o texto, também quando só o fim ou a sala mudam, e a que entra em outro dia não mexe nos registros', async () => {
      const { e, docentes } = await escolaComGrade([['ana', '8º A', [MANHA, [3, '07:30', '08:20']]]])
      const [ana] = docentes as [Docente]
      const vinculoId = ana.vinculoId
      await registrar(e, vinculoId, SEGUNDA_PASSADA, '07:30', '08:20', 'segunda passada')
      await registrar(e, vinculoId, SEGUNDA_FUTURA, '07:30', '08:20', 'segunda futura')
      await registrar(e, vinculoId, QUARTA_FUTURA, '07:30', '08:20', 'quarta futura')

      // A segunda continua (com o fim mudado), a quarta continua, e uma aula nova entra na sexta.
      const { resultado } = await reimportar(e, linhasDaGrade(ana, [[1, '07:30', '08:30'], [3, '07:30', '08:20'], [5, '07:30', '08:20']]))

      expect(resultado).toBe('concluida')
      expect(await gradeDe(vinculoId)).toEqual([[1, '07:30', '08:30'], [3, '07:30', '08:20'], [5, '07:30', '08:20']])
      // O `fim` do registro é cópia, só para a que sai da grade: a troca só do fim na grade não o atualiza (Tech Spec, seção 3).
      expect(await registrosDe(vinculoId)).toEqual([
        [SEGUNDA_PASSADA, '07:30', '08:20', 'segunda passada'],
        [SEGUNDA_FUTURA, '07:30', '08:20', 'segunda futura'],
        [QUARTA_FUTURA, '07:30', '08:20', 'quarta futura'],
      ])
    })

    it('J2: a que muda só o horário, no mesmo vínculo e dia, leva o texto das datas passadas e futuras para o início e o fim novos; o que fica no dia, o do colega e o PUT no horário novo não são tocados', async () => {
      const { e, docentes } = await escolaComGrade([
        ['beto', '8º A', [MANHA, [1, '09:00', '09:50'], [3, '07:30', '08:20']]],
        ['cida', '8º B', [MANHA, [3, '07:30', '08:20']]],
      ])
      const [beto, cida] = docentes as [Docente, Docente]
      const vinculoId = beto.vinculoId
      for (const [data, conteudo] of [[SEGUNDA_ANTERIOR, 'anterior'], [SEGUNDA_PASSADA, 'passada'], [SEGUNDA_FUTURA, 'futura'], [SEGUNDA_SEGUINTE, 'seguinte']] as const) {
        await registrar(e, vinculoId, data, '07:30', '08:20', conteudo)
      }
      await registrar(e, vinculoId, SEGUNDA_FUTURA, '09:00', '09:50', 'nove horas, que continua')
      await registrar(e, vinculoId, QUARTA_FUTURA, '07:30', '08:20', 'quarta, que não muda')
      await registrar(e, cida.vinculoId, SEGUNDA_FUTURA, '07:30', '08:20', 'da colega, no mesmo dia e início')
      await registrar(e, cida.vinculoId, QUARTA_FUTURA, '07:30', '08:20', 'da colega, na quarta')

      const { id, resultado } = await reimportar(e, [...linhasDaGrade(beto, [[1, '07:40', '08:30'], [1, '09:00', '09:50'], [3, '07:30', '08:20']]), ...linhasDaGrade(cida, [MANHA, [3, '07:30', '08:20']])])

      expect(resultado).toBe('concluida')
      expect(await estadoDaImportacao(id)).toBe('concluida')
      expect(await gradeDe(vinculoId)).toEqual([[1, '07:40', '08:30'], [1, '09:00', '09:50'], [3, '07:30', '08:20']])
      expect(await registrosDe(vinculoId)).toEqual([
        [SEGUNDA_ANTERIOR, '07:40', '08:30', 'anterior'],
        [SEGUNDA_PASSADA, '07:40', '08:30', 'passada'],
        [SEGUNDA_FUTURA, '07:40', '08:30', 'futura'],
        [SEGUNDA_FUTURA, '09:00', '09:50', 'nove horas, que continua'],
        [QUARTA_FUTURA, '07:30', '08:20', 'quarta, que não muda'],
        [SEGUNDA_SEGUINTE, '07:40', '08:30', 'seguinte'],
      ])
      expect(await registrosDe(cida.vinculoId)).toEqual([
        [SEGUNDA_FUTURA, '07:30', '08:20', 'da colega, no mesmo dia e início'],
        [QUARTA_FUTURA, '07:30', '08:20', 'da colega, na quarta'],
      ])
      expect((await gravar(beto.professora.sessao, vinculoId, SEGUNDA_FUTURA, '07:40', 'revista')).status).toBe(200)
      expect((await registrosDe(vinculoId)).filter(([data, inicio]) => data === SEGUNDA_FUTURA && inicio !== '09:00')).toEqual([[SEGUNDA_FUTURA, '07:40', '08:30', 'revista']])
    })

    it('J3: a que sai sem par apaga os registros de hoje em diante (hoje inclusive) e os passados ficam, fora da grade; o que continua, o que fica no dia e o do colega não mudam', async () => {
      const { e, docentes } = await escolaComGrade([
        ['carla', '8º A', [MANHA, [3, '07:30', '08:20'], [3, '09:00', '09:50']]],
        ['cida', '8º B', [MANHA, [3, '07:30', '08:20']]],
      ])
      const [carla, cida] = docentes as [Docente, Docente]
      const vinculoId = carla.vinculoId
      await registrar(e, vinculoId, SEGUNDA_FUTURA, '07:30', '08:20', 'segunda, que continua')
      await registrar(e, vinculoId, QUARTA_PASSADA, '07:30', '08:20', 'quarta passada')
      await registrar(e, vinculoId, HOJE, '07:30', '08:20', 'quarta de hoje')
      await registrar(e, vinculoId, QUARTA_FUTURA, '07:30', '08:20', 'quarta futura')
      await registrar(e, vinculoId, QUARTA_FUTURA, '09:00', '09:50', 'nove horas da quarta, que continua')
      await registrar(e, cida.vinculoId, QUARTA_FUTURA, '07:30', '08:20', 'da colega, na quarta')

      const { resultado } = await reimportar(e, [...linhasDaGrade(carla, [MANHA, [3, '09:00', '09:50']]), ...linhasDaGrade(cida, [MANHA, [3, '07:30', '08:20']])])

      expect(resultado).toBe('concluida')
      expect(await gradeDe(vinculoId)).toEqual([MANHA, [3, '09:00', '09:50']])
      expect(await registrosDe(vinculoId)).toEqual([
        [QUARTA_PASSADA, '07:30', '08:20', 'quarta passada'],
        [SEGUNDA_FUTURA, '07:30', '08:20', 'segunda, que continua'],
        [QUARTA_FUTURA, '09:00', '09:50', 'nove horas da quarta, que continua'],
      ])
      expect(await registrosDe(cida.vinculoId)).toEqual([[QUARTA_FUTURA, '07:30', '08:20', 'da colega, na quarta']])
    })

    it('a aula que continua com o fim mudado, ao lado de uma que sai no mesmo dia: o texto da que continua não é "par" da que sai', async () => {
      const { e, docentes } = await escolaComGrade([['carol', '8º A', [[1, '07:30', '08:20'], [1, '09:00', '09:50']]]])
      const [carol] = docentes as [Docente]
      const vinculoId = carol.vinculoId
      await registrar(e, vinculoId, SEGUNDA_FUTURA, '07:30', '08:20', 'a das 7h30, que continua')
      await registrar(e, vinculoId, SEGUNDA_FUTURA, '09:00', '09:50', 'a das 9h, que sai')
      await registrar(e, vinculoId, SEGUNDA_PASSADA, '09:00', '09:50', 'a das 9h, passada')

      const { resultado } = await reimportar(e, linhasDaGrade(carol, [[1, '07:30', '08:30']]))

      expect(resultado).toBe('concluida')
      expect(await registrosDe(vinculoId)).toEqual([
        [SEGUNDA_PASSADA, '09:00', '09:50', 'a das 9h, passada'],
        [SEGUNDA_FUTURA, '07:30', '08:20', 'a das 7h30, que continua'],
      ])
    })

    it('J4: um registro fora da grade já ocupa o início novo numa data passada: o re-chaveamento daquela data não acontece, os dois textos ficam, e as outras datas se movem; o registro da colega no início novo não conta', async () => {
      const { e, docentes } = await escolaComGrade([
        ['dani', '8º A', [MANHA]],
        ['cida', '8º B', [MANHA]],
      ])
      const [dani, cida] = docentes as [Docente, Docente]
      const vinculoId = dani.vinculoId
      await registrar(e, vinculoId, SEGUNDA_ANTERIOR, '07:30', '08:20', 'a que se move')
      await registrar(e, vinculoId, SEGUNDA_PASSADA, '07:30', '08:20', 'a velha, que não se move')
      await registrar(e, vinculoId, SEGUNDA_PASSADA, '07:40', '08:30', 'a fora da grade, que já ocupa o início novo')
      await registrar(e, vinculoId, SEGUNDA_FUTURA, '07:30', '08:20', 'a futura, que se move')
      // A colega tem registro às 7h40 na data da que se move: não é o vínculo da Dani, e não impede nada.
      await registrar(e, cida.vinculoId, SEGUNDA_ANTERIOR, '07:40', '08:30', 'da colega, no início novo da Dani')
      await registrar(e, cida.vinculoId, SEGUNDA_FUTURA, '07:40', '08:30', 'da colega, também')

      const { resultado } = await reimportar(e, [...linhasDaGrade(dani, [[1, '07:40', '08:30']]), ...linhasDaGrade(cida, [MANHA])])

      expect(resultado).toBe('concluida')
      expect(await registrosDe(vinculoId)).toEqual([
        [SEGUNDA_ANTERIOR, '07:40', '08:30', 'a que se move'],
        [SEGUNDA_PASSADA, '07:30', '08:20', 'a velha, que não se move'],
        [SEGUNDA_PASSADA, '07:40', '08:30', 'a fora da grade, que já ocupa o início novo'],
        [SEGUNDA_FUTURA, '07:40', '08:30', 'a futura, que se move'],
      ])
      expect(await registrosDe(cida.vinculoId)).toEqual([
        [SEGUNDA_ANTERIOR, '07:40', '08:30', 'da colega, no início novo da Dani'],
        [SEGUNDA_FUTURA, '07:40', '08:30', 'da colega, também'],
      ])
    })

    it('J5: aula dupla: o pareamento por ordem de início leva cada texto à sua aula, qualquer que seja a ordem em que as linhas chegam', async () => {
      // A grade nasce com a segunda aula primeiro: a ordem em que as linhas chegam ao banco não é a de início.
      const { e, docentes } = await escolaComGrade([['edu', '8º A', [[1, '08:20', '09:10'], [1, '07:30', '08:20']]]])
      const [edu] = docentes as [Docente]
      const vinculoId = edu.vinculoId
      await registrar(e, vinculoId, SEGUNDA_FUTURA, '07:30', '08:20', 'primeira aula')
      await registrar(e, vinculoId, SEGUNDA_FUTURA, '08:20', '09:10', 'segunda aula')
      await registrar(e, vinculoId, SEGUNDA_PASSADA, '08:20', '09:10', 'segunda aula passada')

      // As linhas novas vêm da segunda para a primeira: o par é pelo início, não pela linha.
      const { resultado } = await reimportar(e, linhasDaGrade(edu, [[1, '08:50', '09:40'], [1, '08:00', '08:50']]))

      expect(resultado).toBe('concluida')
      expect(await registrosDe(vinculoId)).toEqual([
        [SEGUNDA_PASSADA, '08:50', '09:40', 'segunda aula passada'],
        [SEGUNDA_FUTURA, '08:00', '08:50', 'primeira aula'],
        [SEGUNDA_FUTURA, '08:50', '09:40', 'segunda aula'],
      ])
    })

    it('saem duas e entra uma: a primeira re-chaveia e a segunda sai sem par, com o futuro apagado e o passado fora da grade', async () => {
      const { e, docentes } = await escolaComGrade([['fabi', '8º A', [[1, '07:30', '08:20'], [1, '08:20', '09:10']]]])
      const [fabi] = docentes as [Docente]
      const vinculoId = fabi.vinculoId
      await registrar(e, vinculoId, SEGUNDA_FUTURA, '07:30', '08:20', 'primeira, futura')
      await registrar(e, vinculoId, SEGUNDA_FUTURA, '08:20', '09:10', 'segunda, futura')
      await registrar(e, vinculoId, SEGUNDA_PASSADA, '08:20', '09:10', 'segunda, passada')

      const { resultado } = await reimportar(e, linhasDaGrade(fabi, [[1, '07:40', '08:30']]))

      expect(resultado).toBe('concluida')
      expect(await registrosDe(vinculoId)).toEqual([
        [SEGUNDA_PASSADA, '08:20', '09:10', 'segunda, passada'],
        [SEGUNDA_FUTURA, '07:40', '08:30', 'primeira, futura'],
      ])
    })

    it('a aula que muda de dia: o futuro da terça sai e nada vai à quarta; o passado da terça fica', async () => {
      const { e, docentes } = await escolaComGrade([['gabi', '8º A', [[2, '07:30', '08:20'], MANHA]]])
      const [gabi] = docentes as [Docente]
      const vinculoId = gabi.vinculoId
      await registrar(e, vinculoId, TERCA_PASSADA, '07:30', '08:20', 'terça passada')
      await registrar(e, vinculoId, TERCA_FUTURA, '07:30', '08:20', 'terça futura')
      await registrar(e, vinculoId, QUARTA_FUTURA, '07:30', '08:20', 'quarta, que o teste pôs à mão e a grade não tinha')

      const { resultado } = await reimportar(e, linhasDaGrade(gabi, [[3, '07:30', '08:20'], MANHA]))

      expect(resultado).toBe('concluida')
      expect(await registrosDe(vinculoId)).toEqual([
        [TERCA_PASSADA, '07:30', '08:20', 'terça passada'],
        [QUARTA_FUTURA, '07:30', '08:20', 'quarta, que o teste pôs à mão e a grade não tinha'],
      ])
    })

    it('J7: a mesma grade reimportada duas vezes mantém todos os textos, no horário em que o primeiro job os deixou', async () => {
      const { e, docentes } = await escolaComGrade([['hugo', '8º A', [MANHA]]])
      const [hugo] = docentes as [Docente]
      const vinculoId = hugo.vinculoId
      await registrar(e, vinculoId, SEGUNDA_PASSADA, '07:30', '08:20', 'passada')
      await registrar(e, vinculoId, SEGUNDA_FUTURA, '07:30', '08:20', 'futura')
      const nova = linhasDaGrade(hugo, [[1, '07:40', '08:30']])
      const esperado: Registro[] = [
        [SEGUNDA_PASSADA, '07:40', '08:30', 'passada'],
        [SEGUNDA_FUTURA, '07:40', '08:30', 'futura'],
      ]

      expect((await reimportar(e, nova)).resultado).toBe('concluida')
      expect(await registrosDe(vinculoId)).toEqual(esperado)
      expect((await reimportar(e, nova)).resultado).toBe('concluida')
      expect(await registrosDe(vinculoId)).toEqual(esperado)
      expect(await gradeDe(vinculoId)).toEqual([[1, '07:40', '08:30']])
    })

    it('o mesmo job entregue duas vezes (D49): a segunda entrega sai `ignorada` e o texto não se move de novo', async () => {
      const { e, docentes } = await escolaComGrade([['iara', '8º A', [MANHA]]])
      const [iara] = docentes as [Docente]
      const vinculoId = iara.vinculoId
      await registrar(e, vinculoId, SEGUNDA_FUTURA, '07:30', '08:20', 'futura')
      const id = await gravarPlanilha(e, 'grade', linhasDaGrade(iara, [[1, '07:40', '08:30']]))

      expect(await rodar(e.escolaId, id)).toBe('concluida')
      // Uma terceira linha, que a primeira entrega não conhecia, mostra que a segunda não relê nem move nada.
      await registrar(e, vinculoId, SEGUNDA_SEGUINTE, '07:30', '08:20', 'posta depois, no horário velho')
      expect(await rodar(e.escolaId, id)).toBe('ignorada')

      expect(await registrosDe(vinculoId)).toEqual([
        [SEGUNDA_FUTURA, '07:40', '08:30', 'futura'],
        [SEGUNDA_SEGUINTE, '07:30', '08:20', 'posta depois, no horário velho'],
      ])
    })
  })

  describe('as escolas e os anos não se tocam (J6 e J15), e "hoje" é o de Brasília (J8)', () => {
    it('J6: a reimportação da escola A não toca o registro da escola B, nem o que está gravado com a escola de B sobre o vínculo de A', async () => {
      const a = await escolaComGrade([['jaque', '8º A', [MANHA, [3, '07:30', '08:20']]]])
      const b = await escolaComGrade([['kaue', '8º A', [MANHA, [3, '07:30', '08:20']]]])
      const [jaque] = a.docentes as [Docente]
      const [kaue] = b.docentes as [Docente]
      const vinculoA = jaque.vinculoId
      const vinculoB = kaue.vinculoId
      for (const [escola, vinculoId] of [[a.e, vinculoA], [b.e, vinculoB]] as const) {
        await registrar(escola, vinculoId, SEGUNDA_FUTURA, '07:30', '08:20', 'segunda futura')
        await registrar(escola, vinculoId, QUARTA_FUTURA, '07:30', '08:20', 'quarta futura')
      }
      // A linha que as FKs não deixam existir: a escola B, com o vínculo e o ano de A, no dia e no início que o passo de A mexe.
      await plantar([
        { escolaId: b.e.escolaId, anoId: a.e.emCurso, vinculoId: vinculoA, data: SEGUNDA_SEGUINTE, inicio: '07:30' },
        { escolaId: b.e.escolaId, anoId: a.e.emCurso, vinculoId: vinculoA, data: QUARTA_SEGUINTE, inicio: '07:30' },
      ])

      // Em A, a segunda muda de horário e a quarta sai.
      const { resultado } = await reimportar(a.e, linhasDaGrade(jaque, [[1, '07:40', '08:30']]))

      expect(resultado).toBe('concluida')
      // O de A: o da segunda se moveu, o da quarta saiu com a aula; os dois plantados com a escola de B continuam onde estavam.
      expect(await registrosDe(vinculoA)).toEqual([
        [SEGUNDA_FUTURA, '07:40', '08:30', 'segunda futura'],
        [SEGUNDA_SEGUINTE, '07:30', '23:00', 'plantada'],
        [QUARTA_SEGUINTE, '07:30', '23:00', 'plantada'],
      ])
      expect(await registrosDe(vinculoB)).toEqual([
        [SEGUNDA_FUTURA, '07:30', '08:20', 'segunda futura'],
        [QUARTA_FUTURA, '07:30', '08:20', 'quarta futura'],
      ])
      expect(await gradeDe(vinculoB)).toEqual([MANHA, [3, '07:30', '08:20']])
    })

    it('J15: reimportar a grade do ano planejado não toca o texto do ano em curso, nem o gravado com o ano em curso sobre o vínculo do planejado', async () => {
      const { e, docentes } = await escolaComGrade([['lia', '8º A', [MANHA]]])
      const [lia] = docentes as [Docente]
      const vinculoEmCurso = lia.vinculoId
      await registrar(e, vinculoEmCurso, SEGUNDA_FUTURA, '07:30', '08:20', 'do ano em curso')
      const primeira = await reimportar(e, linhasDaGrade(lia, [MANHA, [3, '07:30', '08:20']]), { anoLetivoId: e.planejado })
      expect(primeira.resultado).toBe('concluida')
      const { rows } = await bancada.pool.query<{ id: string }>('select id from vinculo where escola_id = $1 and ano_letivo_id = $2 and usuario_id = $3', [e.escolaId, e.planejado, lia.professora.sessao.usuarioId])
      const vinculoPlanejado = rows[0]?.id ?? ''
      expect(vinculoPlanejado).not.toBe('')
      // As linhas que as FKs não deixam existir: o ano em curso sobre o vínculo do planejado, na data e no início que o passo do planejado mexe (a segunda muda de horário, a quarta sai).
      await plantar([
        { escolaId: e.escolaId, anoId: e.emCurso, vinculoId: vinculoPlanejado, data: SEGUNDA_SEGUINTE, inicio: '07:30' },
        { escolaId: e.escolaId, anoId: e.emCurso, vinculoId: vinculoPlanejado, data: QUARTA_SEGUINTE, inicio: '07:30' },
      ])

      const segunda = await reimportar(e, linhasDaGrade(lia, [[1, '07:40', '08:30']]), { anoLetivoId: e.planejado })

      expect(segunda.resultado).toBe('concluida')
      expect(await gradeDe(vinculoPlanejado)).toEqual([[1, '07:40', '08:30']])
      expect(await gradeDe(vinculoEmCurso)).toEqual([MANHA])
      expect(await registrosDe(vinculoEmCurso)).toEqual([[SEGUNDA_FUTURA, '07:30', '08:20', 'do ano em curso']])
      expect(await registrosDe(vinculoPlanejado)).toEqual([
        [SEGUNDA_SEGUINTE, '07:30', '23:00', 'plantada'],
        [QUARTA_SEGUINTE, '07:30', '23:00', 'plantada'],
      ])
    })

    it('J8: às 22h de Brasília (já o dia seguinte em UTC) o "data de hoje em diante" do passo é o dia de Brasília: o registro de hoje sai', async () => {
      const { e, docentes } = await escolaComGrade([['mari', '8º A', [MANHA, [3, '07:30', '08:20']]]])
      const [mari] = docentes as [Docente]
      const vinculoId = mari.vinculoId
      await registrar(e, vinculoId, QUARTA_PASSADA, '07:30', '08:20', 'quarta passada')
      await registrar(e, vinculoId, HOJE, '07:30', '08:20', 'quarta de hoje')
      await registrar(e, vinculoId, QUARTA_FUTURA, '07:30', '08:20', 'quarta futura')

      const { resultado } = await reimportar(e, linhasDaGrade(mari, [MANHA]), { doJob: { agora: () => QUARTA_A_NOITE } })

      expect(resultado).toBe('concluida')
      expect(await registrosDe(vinculoId)).toEqual([[QUARTA_PASSADA, '07:30', '08:20', 'quarta passada']])
    })
  })

  describe('prévia, resumo e auditoria do F2 não mudam (J9)', () => {
    it('J9: a reimportação que re-chaveia e apaga texto deixa o mesmo resumo, a mesma prévia e a mesma auditoria que a de uma escola sem nenhum registro, e nenhum deles traz o texto', async () => {
      const com = await escolaComGrade([['nina', '8º A', [MANHA, [3, '07:30', '08:20']]]])
      const sem = await escolaComGrade([['otto', '8º A', [MANHA, [3, '07:30', '08:20']]]])
      const [nina] = com.docentes as [Docente]
      const [otto] = sem.docentes as [Docente]
      await registrar(com.e, nina.vinculoId, SEGUNDA_FUTURA, '07:30', '08:20', SENTINELA)
      await registrar(com.e, nina.vinculoId, QUARTA_FUTURA, '07:30', '08:20', SENTINELA)

      const auditoriaAntes = async (e: Escola) => new Set((await bancada.pool.query<{ id: string }>('select id from auditoria where escola_id = $1', [e.escolaId])).rows.map(({ id }) => id))
      const tudoQueSaiu = async (e: Escola, docente: Docente, antes: Set<string>) => {
        const texto = [CABECALHO_DA_GRADE, ...linhasDaGrade(docente, [[1, '07:40', '08:30']])].join('\n')
        const previa = await pedir(e.coordenacao, 'POST', '/v1/importacoes/grade/previa', { texto })
        expect(previa.status).toBe(200)
        const { id, resultado } = await reimportar(e, linhasDaGrade(docente, [[1, '07:40', '08:30']]))
        expect(resultado).toBe('concluida')
        const { rows: importacao } = await bancada.pool.query<{ resumo: unknown }>('select resumo from importacao_planilha where id = $1', [id])
        const { rows: auditoria } = await bancada.pool.query<{ id: string; acao: string; antes: unknown; depois: unknown }>('select id, acao, antes, depois from auditoria where escola_id = $1 order by id', [e.escolaId])
        return { previa: previa.corpo, resumo: importacao[0]?.resumo, auditoria: auditoria.filter(({ id: linha }) => !antes.has(linha)).map(({ acao, antes: depoisDe, depois }) => ({ acao, antes: depoisDe, depois })) }
      }

      const antesCom = await auditoriaAntes(com.e)
      const antesSem = await auditoriaAntes(sem.e)
      const doComTexto = await tudoQueSaiu(com.e, nina, antesCom)
      const doSemTexto = await tudoQueSaiu(sem.e, otto, antesSem)

      expect(await registrosDe(nina.vinculoId)).toEqual([[SEGUNDA_FUTURA, '07:40', '08:30', SENTINELA]])
      expect(doComTexto.resumo).toEqual(doSemTexto.resumo)
      expect(doComTexto.previa).toEqual(doSemTexto.previa)
      expect(doComTexto.auditoria).toEqual(doSemTexto.auditoria)
      expect(doComTexto.auditoria.length).toBeGreaterThan(0)
      expect(JSON.stringify(doComTexto)).not.toContain(SENTINELA)
    })
  })

  describe('uma transação só', () => {
    it('falha injetada em `encerrarOsMarcados`: a grade e os registros voltam juntos, a importação segue `na_fila`, e a nova tentativa grava tudo', async () => {
      const { e, docentes } = await escolaComGrade([
        ['paula', '8º A', [MANHA]],
        ['quim', '8º B', [[3, '07:30', '08:20']]],
      ])
      const [paula, quim] = docentes as [Docente, Docente]
      const vinculoPaula = paula.vinculoId
      const vinculoQuim = quim.vinculoId
      await registrar(e, vinculoPaula, SEGUNDA_FUTURA, '07:30', '08:20', 'da Paula, que se move')
      await registrar(e, vinculoQuim, QUARTA_FUTURA, '07:30', '08:20', 'do Quim, que sai com a aula')
      // A Paula muda de horário (o passo re-chaveia); o Quim sai da grade e é encerrado (o que a falha injetada derruba, depois do passo).
      const id = await gravarPlanilha(e, 'grade', linhasDaGrade(paula, [[1, '07:40', '08:30']]), { encerrar: [vinculoQuim] })
      const nome = `falha_injetada_${randomUUID().replaceAll('-', '').slice(0, 10)}`
      await bancada.pool.query(`create function ${nome}() returns trigger language plpgsql as $$ begin raise exception 'falha injetada pelo teste'; end $$`)
      await bancada.pool.query(`create trigger ${nome} before update on vinculo for each row when (new.id = '${vinculoQuim}'::uuid and new.estado = 'encerrado') execute function ${nome}()`)
      try {
        await expect(rodar(e.escolaId, id)).rejects.toThrow()
        expect(await estadoDaImportacao(id)).toBe('na_fila')
        expect(await gradeDe(vinculoPaula)).toEqual([MANHA])
        expect(await gradeDe(vinculoQuim)).toEqual([[3, '07:30', '08:20']])
        expect(await registrosDe(vinculoPaula)).toEqual([[SEGUNDA_FUTURA, '07:30', '08:20', 'da Paula, que se move']])
        expect(await registrosDe(vinculoQuim)).toEqual([[QUARTA_FUTURA, '07:30', '08:20', 'do Quim, que sai com a aula']])
        expect(await estadoDoVinculo(vinculoQuim)).toBe('confirmado')
      } finally {
        await bancada.pool.query(`drop trigger if exists ${nome} on vinculo`)
        await bancada.pool.query(`drop function if exists ${nome}()`)
      }

      expect(await rodar(e.escolaId, id)).toBe('concluida')
      expect(await gradeDe(vinculoPaula)).toEqual([[1, '07:40', '08:30']])
      expect(await registrosDe(vinculoPaula)).toEqual([[SEGUNDA_FUTURA, '07:40', '08:30', 'da Paula, que se move']])
      expect(await registrosDe(vinculoQuim)).toEqual([])
      expect(await estadoDoVinculo(vinculoQuim)).toBe('encerrado')
    })
  })

  describe('o calendário não apaga texto (J10, RF13)', () => {
    it('J10: o feriado novo esconde a aula na Semana e o registro continua no banco; retirado o feriado, a aula volta com o texto', async () => {
      const { e, docentes } = await escolaComGrade([['rita', '8º A', [MANHA, [3, '07:30', '08:20']]]])
      const [rita] = docentes as [Docente]
      const vinculoId = rita.vinculoId
      await registrar(e, vinculoId, QUARTA_FUTURA, '07:30', '08:20', 'quarta, a de antes do feriado')
      const quartaDaSemana = async () => {
        const lida = await pedir(rita.professora.sessao, 'GET', `/v1/semana?segunda=${SEGUNDA_FUTURA}`)
        expect(lida.status).toBe(200)
        const dia = semanaResponseSchema.parse(lida.corpo).dias.find(({ data }) => data === QUARTA_FUTURA)
        return { aulas: dia?.aulas.map(({ texto }) => texto) ?? [], eventos: dia?.eventos.map(({ tipo }) => tipo) ?? [] }
      }
      expect(await quartaDaSemana()).toEqual({ aulas: ['quarta, a de antes do feriado'], eventos: [] })

      await importarCalendario(e, [`${QUARTA_FUTURA};${QUARTA_FUTURA};feriado;Feriado ${PREFIXO}`])
      expect(await quartaDaSemana()).toEqual({ aulas: [], eventos: ['feriado'] })
      expect(await registrosDe(vinculoId)).toEqual([[QUARTA_FUTURA, '07:30', '08:20', 'quarta, a de antes do feriado']])

      await importarCalendario(e, [`${SEGUNDA_SEGUINTE};${SEGUNDA_SEGUINTE};evento;Reunião ${PREFIXO}`])
      expect(await quartaDaSemana()).toEqual({ aulas: ['quarta, a de antes do feriado'], eventos: [] })
      expect(await registrosDe(vinculoId)).toEqual([[QUARTA_FUTURA, '07:30', '08:20', 'quarta, a de antes do feriado']])
    })
  })

  describe('as corridas, com a ordem forçada', () => {
    it('J11a: o job para depois de apagar o futuro e antes do commit; o PUT dessa aula espera na trava do vínculo, e depois do commit responde NAO_ENCONTRADO sem deixar registro futuro sem alocação', async () => {
      const { e, docentes } = await escolaComGrade([['sara', '8º A', [MANHA, [3, '07:30', '08:20']]]])
      const [sara] = docentes as [Docente]
      const vinculoId = sara.vinculoId
      await registrar(e, vinculoId, QUARTA_FUTURA, '07:30', '08:20', 'quarta, que sai com a aula')
      const id = await gravarPlanilha(e, 'grade', linhasDaGrade(sara, [MANHA]))
      const gatilho = new WriteBlockTrigger(apoio, { tabela: 'aula', evento: 'delete', quando: `old.vinculo_id = '${vinculoId}'::uuid` })
      await gatilho.armar()
      try {
        // A pausa do job é uma espera de trava sob o `lock_timeout` de 1 s do passo (3): o PUT entra na fila e a pausa solta logo, antes de 1 s.
        const rodando = rodar(e.escolaId, id)
        await gatilho.esperarParadas()
        const gravando = gravar(sara.professora.sessao, vinculoId, QUARTA_FUTURA, '07:30', 'tarde demais')
        await esperarNaFilaDaTrava(e, vinculoId)
        await gatilho.soltar()
        const [job, resposta] = await Promise.all([rodando, gravando])

        expect(job).toBe('concluida')
        expect(erroDe(resposta)).toEqual(NAO_ENCONTRADO)
      } finally {
        await gatilho.desarmar()
      }
      expect(await registrosDe(vinculoId)).toEqual([])
      expect(await gradeDe(vinculoId)).toEqual([MANHA])
    })

    it('J11b: a gravação primeiro: uma transação do teste segura a trava do vínculo e grava na alocação velha; o job já apagou a alocação, para na trava e, depois do commit do teste, lê a aula e apaga o registro futuro', async () => {
      const { e, docentes } = await escolaComGrade([['tina', '8º A', [MANHA, [3, '07:30', '08:20']]]])
      const [tina] = docentes as [Docente]
      const vinculoId = tina.vinculoId
      const id = await gravarPlanilha(e, 'grade', linhasDaGrade(tina, [MANHA]))
      const segurada = await segurarTrava(e, vinculoId)
      let terminou = false
      try {
        await registrar(e, vinculoId, QUARTA_FUTURA, '07:30', '08:20', 'gravado na alocação velha, sem confirmar', e.emCurso, segurada.cliente)
        const rodando = rodar(e.escolaId, id)
        await esperarNaFilaDaTrava(e, vinculoId)
        await segurada.terminar('commit')
        terminou = true

        expect(await rodando).toBe('concluida')
      } finally {
        if (!terminou) await segurada.terminar('rollback')
      }
      expect(await registrosDe(vinculoId)).toEqual([])
      expect(await gradeDe(vinculoId)).toEqual([MANHA])
    })

    it('J12: o PUT no registro que o job re-chaveia: o job para depois do re-chaveamento e antes do commit, o PUT espera na trava e, depois, responde NAO_ENCONTRADO; fica uma linha só, com o texto do job, sem sobrescrever nem duplicar', async () => {
      const { e, docentes } = await escolaComGrade([['uri', '8º A', [MANHA]]])
      const [uri] = docentes as [Docente]
      const vinculoId = uri.vinculoId
      await registrar(e, vinculoId, SEGUNDA_PASSADA, '07:30', '08:20', 'o texto de antes da reimportação')
      const id = await gravarPlanilha(e, 'grade', linhasDaGrade(uri, [[1, '07:40', '08:30']]))
      const gatilho = new WriteBlockTrigger(apoio, { tabela: 'aula', evento: 'update', quando: `new.vinculo_id = '${vinculoId}'::uuid` })
      await gatilho.armar()
      try {
        const rodando = rodar(e.escolaId, id)
        await gatilho.esperarParadas()
        // O registro passado ainda está no início velho, e a alocação velha ainda é visível a quem não é o job: a gravação passaria, se não houvesse a trava.
        const gravando = gravar(uri.professora.sessao, vinculoId, SEGUNDA_PASSADA, '07:30', 'o texto que chegou no meio')
        await esperarNaFilaDaTrava(e, vinculoId)
        await gatilho.soltar()
        const [job, resposta] = await Promise.all([rodando, gravando])

        expect(job).toBe('concluida')
        expect(erroDe(resposta)).toEqual(NAO_ENCONTRADO)
      } finally {
        await gatilho.desarmar()
      }
      expect(await registrosDe(vinculoId)).toEqual([[SEGUNDA_PASSADA, '07:40', '08:30', 'o texto de antes da reimportação']])
    })

    it('J16: o vínculo marcado "sai da grade", com a trava segura por uma transação do teste que insere um registro novo e confirma: nenhum 40P01 nem 55P03 na transação do teste nem na primeira tentativa do job, e nenhum registro futuro no fim', async () => {
      const { e, docentes } = await escolaComGrade([
        ['vera', '8º A', [MANHA]],
        ['wagner', '8º B', [[3, '07:30', '08:20']]],
      ])
      const [vera, wagner] = docentes as [Docente, Docente]
      const vinculoWagner = wagner.vinculoId
      const id = await gravarPlanilha(e, 'grade', linhasDaGrade(vera, [MANHA]), { encerrar: [vinculoWagner] })
      const segurada = await segurarTrava(e, vinculoWagner)
      let terminou = false
      try {
        const rodando = rodar(e.escolaId, id).then(
          (resultado) => ({ resultado }),
          (erro: unknown) => ({ erro }),
        )
        await esperarNaFilaDaTrava(e, vinculoWagner)
        // Logo depois de ver o job esperando, e sem `await` lento no meio: um insert novo (data futura, alocação velha: passa pela FK) e o commit.
        const doTeste = registrar(e, vinculoWagner, QUARTA_FUTURA, '07:30', '08:20', 'gravado entre o apagar da alocação e o encerrar', e.emCurso, segurada.cliente)
          .then(() => segurada.terminar('commit'))
          .then(
            () => {
              terminou = true
              return null
            },
            (erro: unknown) => erro,
          )
        const [job, doLadoDoTeste] = await Promise.all([rodando, doTeste])

        expect(doLadoDoTeste).toBeNull()
        expect(job).toEqual({ resultado: 'concluida' })
      } finally {
        if (!terminou) await segurada.terminar('rollback').catch(() => undefined)
      }
      expect(await estadoDoVinculo(vinculoWagner)).toBe('encerrado')
      expect(await registrosDe(vinculoWagner)).toEqual([])
    })
  })

  describe('o conjunto travado', () => {
    it('só os vínculos que já existiam e têm aula que sai ou entra tomam a trava; o vínculo que não muda e o que a reimportação cria não tomam nenhuma', async () => {
      const { e, docentes } = await escolaComGrade([
        ['xuxa', '8º A', [MANHA]],
        ['yuri', '8º A', [[2, '07:30', '08:20']]],
        ['zeze', '8º A', [[4, '07:30', '08:20'], [5, '07:30', '08:20']]],
        ['wanda', '8º A', [[4, '09:00', '09:50']]],
      ])
      await turmaNa(e, '8º B')
      const [xuxa, yuri, zeze, wanda] = docentes as [Docente, Docente, Docente, Docente]
      // A Xuxa muda de horário (existia; a aula sai e a outra entra); o Yuri ganha uma aula (existia; só entra); a Zezé perde a sexta (existia; só sai);
      // a Wanda continua igual (não toma trava); e a Xuxa ganha um vínculo novo, na 8ºB, que a reimportação cria (não toma trava nem tem aula para ler).
      const linhas = [
        ...linhasDaGrade(xuxa, [[1, '07:40', '08:30']]),
        ...linhasDaGrade(yuri, [[2, '07:30', '08:20'], [5, '07:30', '08:20']]),
        ...linhasDaGrade(zeze, [[4, '07:30', '08:20']]),
        ...linhasDaGrade(wanda, [[4, '09:00', '09:50']]),
        ...linhasDaGrade({ professora: xuxa.professora, turmaCurta: '8B' }, [[3, '09:00', '09:50']]),
      ]
      const id = await gravarPlanilha(e, 'grade', linhas)
      // A pausa é a última escrita do passo (3), a troca de estado da importação: o passo do texto já rodou e as travas ainda estão com o job.
      const gatilho = new WriteBlockTrigger(apoio, { tabela: 'importacao_planilha', evento: 'update', quando: `new.id = '${id}'::uuid and new.estado = 'concluida'` })
      await gatilho.armar()
      const esperadas = [await chaveDaTrava(e, xuxa.vinculoId), await chaveDaTrava(e, yuri.vinculoId), await chaveDaTrava(e, zeze.vinculoId)].sort((a, b) => a - b)
      const daEscola = [...esperadas, await chaveDaTrava(e, wanda.vinculoId)]
      try {
        const rodando = rodar(e.escolaId, id)
        await gatilho.esperarParadas()
        // Com o job parado dentro do passo (3), as travas do vínculo que ele tem concedidas são as do conjunto travado, e só elas.
        expect((await travasConcedidas(daEscola)).sort((a, b) => a - b)).toEqual(esperadas)
        await gatilho.soltar()
        expect(await rodando).toBe('concluida')
      } finally {
        await gatilho.desarmar()
      }
    })

    it('as travas saem na ordem da chave, num comando só: com a maior presa por outra transação, o passo já tem a menor concedida enquanto espera pela maior', async () => {
      const { e, docentes } = await escolaComGrade([
        ['ze', '8º A', [MANHA]],
        ['zu', '8º B', [MANHA]],
      ])
      const [ze, zu] = docentes as [Docente, Docente]
      const comChave = await Promise.all([ze, zu].map(async (docente) => ({ docente, chave: await chaveDaTrava(e, docente.vinculoId) })))
      // O `order by` do comando ordena o `hashtext` como `int4` (com sinal); o `objid` do `pg_locks` o mostra sem sinal.
      const comSinal = (chave: number): number => (chave > 2 ** 31 - 1 ? chave - 2 ** 32 : chave)
      const [menor, maior] = comChave.sort((a, b) => comSinal(a.chave) - comSinal(b.chave)) as [(typeof comChave)[number], (typeof comChave)[number]]
      const aulaDe = ({ docente }: (typeof comChave)[number]) => ({ vinculoId: docente.vinculoId, diaSemana: 1, inicio: '07:30', fim: '08:20' })
      const segurada = await segurarTrava(e, maior.docente.vinculoId)
      let terminou = false
      try {
        // A maior chega primeiro ao passo: só o `order by` da chave a manda para depois da menor.
        const passo = bancoDoJob.transaction((tx) =>
          runInContext({ requisicaoId: randomUUID(), escolaId: e.escolaId }, () => new ImportacaoRepository(tx).acompanharOTextoDaAula(e.emCurso, { saem: [aulaDe(maior), aulaDe(menor)], entram: [] }, HOJE)),
        )
        await esperarNaFilaDaTrava(e, maior.docente.vinculoId)
        expect(await travasConcedidas([menor.chave, maior.chave])).toContain(menor.chave)
        await segurada.terminar('commit')
        terminou = true
        await passo
      } finally {
        if (!terminou) await segurada.terminar('rollback')
      }
    })
  })

  describe('mais de um lote', () => {
    it('504 aulas que mudam de horário e 504 que saem passam todas pelo passo, nos lotes de 500: nenhum texto fica para trás', async () => {
      const aulas: Aula[] = []
      for (let dia = 1; dia <= 7; dia += 1) for (let posicao = 0; posicao < 72; posicao += 1) aulas.push([dia, horaDe(300 + 15 * posicao), horaDe(310 + 15 * posicao)])
      const novas: Aula[] = aulas.map(([dia, inicio, fim]) => [dia, somarMinutos(inicio, 5), somarMinutos(fim, 5)])
      const { e, docentes } = await escolaComGrade([['lote', '8º A', aulas]])
      const [lote] = docentes as [Docente]
      // O colega tem as mesmas 504 aulas, postas à mão (a planilha de 1.008 linhas passaria de 100 KB), e a reimportação não as traz: todas saem.
      const colega = await professoraNa(e, 'colega-do-lote')
      await turmaNa(e, '8º B')
      const { rows: turma } = await bancada.pool.query<{ id: string }>("select id from turma where escola_id = $1 and nome = '8º B'", [e.escolaId])
      const { rows: disciplina } = await bancada.pool.query<{ id: string }>('select id from disciplina where escola_id = $1', [e.escolaId])
      const { rows: vinculo } = await bancada.pool.query<{ id: string }>(
        "insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'professor', 'confirmado', $6, now()) returning id",
        [e.escolaId, e.emCurso, colega.sessao.usuarioId, turma[0]?.id, disciplina[0]?.id, e.coordenacao.usuarioId],
      )
      const vinculoDoColega = vinculo[0]?.id ?? ''
      const dias = aulas.map(([dia]) => dia)
      const inicios = aulas.map(([, inicio]) => inicio)
      const fins = aulas.map(([, , fim]) => fim)
      await bancada.pool.query('insert into alocacao (escola_id, ano_letivo_id, vinculo_id, dia_semana, inicio, fim) select $1, $2, $3, a.dia, a.inicio::time, a.fim::time from unnest($4::int[], $5::text[], $6::text[]) as a(dia, inicio, fim)', [e.escolaId, e.emCurso, vinculoDoColega, dias, inicios, fins])
      for (const vinculoId of [lote.vinculoId, vinculoDoColega]) {
        await bancada.pool.query(
          "insert into aula (escola_id, ano_letivo_id, vinculo_id, data, inicio, fim, conteudo) select $1, $2, $3, date '2026-11-09' + (a.dia - 1), a.inicio::time, a.fim::time, 'texto ' || a.dia || ' ' || a.inicio from unnest($4::int[], $5::text[], $6::text[]) as a(dia, inicio, fim)",
          [e.escolaId, e.emCurso, vinculoId, dias, inicios, fins],
        )
      }

      const { resultado } = await reimportar(e, linhasDaGrade(lote, novas))

      expect(resultado).toBe('concluida')
      const movidos = await registrosDe(lote.vinculoId)
      expect(movidos).toHaveLength(504)
      expect(movidos).toEqual(
        novas.map(([dia, inicio, fim], posicao): Registro => [`2026-11-${String(8 + dia).padStart(2, '0')}`, inicio, fim, `texto ${String(dia)} ${aulas[posicao]?.[1] ?? ''}`]),
      )
      expect(await registrosDe(vinculoDoColega)).toEqual([])
    })
  })
})
