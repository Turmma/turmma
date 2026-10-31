import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { CATEGORIAS_DE_RETENCAO, CHAVES_DE_RETENCAO } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { raizRepositorio } from '../../tools/ci/executar.ts'
import {
  AMOSTRAS_MINIMAS_DA_B,
  AMOSTRAS_MINIMAS_DO_TURNO,
  CATEGORIAS_DO_CATALOGO,
  contarStatementsCancelados,
  formasDosStatementsCancelados,
  julgarResultadoDoExpurgo,
  lerStatements,
  LIMITE_DO_STATEMENT_MS,
  LINHAS_VENCIDAS_DA_A,
  MARGEM_SOBRE_A_BASE_MS,
  TABELAS_DO_EXPURGO,
  TETO_DA_MEDIDA_MS,
  VOLUME_DA_A,
  type ResultadoDoExpurgo,
} from '../scripts/expurgo-da-carga.ts'

const lerArquivo = (caminho: string) => readFileSync(join(raizRepositorio, caminho), 'utf8')

/** O resultado da fase que passa: o que o cenário vê quando o expurgo e a troca de nome terminam sem atrapalhar a B. */
function limpo(troca: Partial<ResultadoDoExpurgo> = {}): ResultadoDoExpurgo {
  return {
    volumeVencidoAntes: LINHAS_VENCIDAS_DA_A,
    trabalho: { inicioMs: 1_000, fimMs: 10_000, expurgos: 1, eliminacoes: 1, falhos: 0, emAndamento: 0 },
    resto: { mensagensDoTutor: 0, execucoesPorAnonimizar: 0, consumosComTexto: 0, linhasComONome: 0, titularExiste: false, estadoDoPedido: 'concluido', categoriasConcluidas: CATEGORIAS_DO_CATALOGO },
    statements: {
      total: 120,
      piores: [{ forma: 'delete from mensagem_tutor where escola_id = $1', chamadas: 100, maximoMs: 180, mediaMs: 90 }],
      tabelasVistas: [...TABELAS_DO_EXPURGO],
    },
    esperaDaB: { amostras: 18, p95Ms: 120, maximaMs: 200 },
    esperaBaseP95Ms: 100,
    turnoDaB: { amostras: 13, p95Ms: 420, maximaMs: 500 },
    turnoBaseP95Ms: 400,
    statementsCancelados: 0,
    ...troca,
  }
}

const criterios = (resultado: ResultadoDoExpurgo) => julgarResultadoDoExpurgo(resultado).map((reprovacao) => reprovacao.criterio)

describe('veredito do banco na fase do expurgo e da troca de nome', () => {
  it('passa com tudo fora, o nome trocado, nenhum statement perto de 2 s e a B medida durante o trabalho', () => {
    expect(julgarResultadoDoExpurgo(limpo())).toEqual([])
  })

  it('job que falhou, expurgo que não enfileirou a eliminação e job que não terminou reprovam, cada um com a sua razão', () => {
    const falhou = julgarResultadoDoExpurgo(limpo({ trabalho: { inicioMs: 1, fimMs: 2, expurgos: 1, eliminacoes: 1, falhos: 1, emAndamento: 0 } }))
    expect(falhou).toEqual([{ criterio: 'job_da_a', detalhe: 'expurgo: 1 job(s) da escola A falharam' }])
    const semEliminacao = julgarResultadoDoExpurgo(limpo({ trabalho: { inicioMs: 1, fimMs: 2, expurgos: 1, eliminacoes: 0, falhos: 0, emAndamento: 0 } }))
    expect(semEliminacao.map((reprovacao) => reprovacao.detalhe)).toEqual(['expurgo: o expurgo não enfileirou a eliminação do titular'])
    const semExpurgo = julgarResultadoDoExpurgo(limpo({ trabalho: { inicioMs: null, fimMs: null, expurgos: 0, eliminacoes: 0, falhos: 0, emAndamento: 0 } }))
    expect(semExpurgo.map((reprovacao) => reprovacao.detalhe)).toContain('expurgo: o job do expurgo da escola A não existe')
    const emAndamento = julgarResultadoDoExpurgo(limpo({ trabalho: { inicioMs: 1, fimMs: 2, expurgos: 1, eliminacoes: 1, falhos: 0, emAndamento: 1 } }))
    expect(emAndamento.map((reprovacao) => reprovacao.detalhe)).toEqual(['expurgo: 1 job(s) da escola A não terminaram no prazo'])
  })

  it.each([
    ['mensagem do Tutor que ficou', { mensagensDoTutor: 1 }],
    ['execução vencida que ficou com o aluno', { execucoesPorAnonimizar: 1 }],
    ['consumo vencido que ficou com texto', { consumosComTexto: 1 }],
    ['pedido que não concluiu', { estadoDoPedido: 'agendado' }],
    ['pedido que sumiu', { estadoDoPedido: null }],
    ['categoria que não terminou', { categoriasConcluidas: CATEGORIAS_DO_CATALOGO - 1 }],
  ])('%s reprova como expurgo incompleto', (_caso, troca) => {
    const resultado = limpo()
    expect(criterios({ ...resultado, resto: { ...resultado.resto, ...troca } })).toEqual(['expurgo_incompleto'])
  })

  it.each([
    ['linha que ainda cita o nome', { linhasComONome: 1 }],
    ['titular que ainda existe', { titularExiste: true }],
  ])('%s reprova como troca de nome incompleta', (_caso, troca) => {
    const resultado = limpo()
    expect(criterios({ ...resultado, resto: { ...resultado.resto, ...troca } })).toEqual(['troca_de_nome_incompleta'])
  })

  it('o statement no teto da medida reprova, um milissegundo abaixo passa, e 1.600 ms (abaixo do corte do banco) já reprova', () => {
    const com = (maximoMs: number) => limpo({ statements: { total: 5, tabelasVistas: [...TABELAS_DO_EXPURGO], piores: [{ forma: 'update execucao_agente set entrada = $1', chamadas: 1, maximoMs, mediaMs: maximoMs }] } })
    expect(criterios(com(TETO_DA_MEDIDA_MS - 1))).toEqual([])
    expect(criterios(com(TETO_DA_MEDIDA_MS))).toEqual(['statement_acima_de_2s'])
    expect(criterios(com(1_600))).toEqual(['statement_acima_de_2s'])
    expect(julgarResultadoDoExpurgo(com(2_345))[0]?.detalhe).toBe(
      `expurgo: statement de 2345 ms, acima de ${TETO_DA_MEDIDA_MS} ms da medida (o corte do banco é ${LIMITE_DO_STATEMENT_MS} ms) (1 chamadas): update execucao_agente set entrada = $1`,
    )
  })

  it('o statement cancelado pelo statement_timeout reprova mesmo com o máximo medido baixo e o job concluído: a tentativa que passa não o apaga', () => {
    // Tentativa cortada em 2 s (fora do `max_exec_time`) e repetição que passa a 100 ms com o cache quente.
    const cortada = limpo({ statementsCancelados: 1 })
    expect(julgarResultadoDoExpurgo(cortada)).toEqual([{ criterio: 'statement_acima_de_2s', detalhe: 'expurgo: 1 statement(s) cancelado(s) pelo statement_timeout durante a fase' }])
    expect(criterios(limpo({ statementsCancelados: 0 }))).toEqual([])
    // Log que não foi lido: não se sabe, e a fase não passa por acaso.
    expect(criterios(limpo({ statementsCancelados: undefined }))).toEqual(['statements_sem_amostra'])
  })

  it('o log do Postgres: cada corte pelo statement_timeout conta uma vez, e o resto do log não conta', () => {
    const log = [
      'postgres-1  | 2026-10-10 23:20:01.000 UTC [88] ERROR:  canceling statement due to statement timeout',
      'postgres-1  | 2026-10-10 23:20:01.000 UTC [88] STATEMENT:  delete from mensagem_tutor where escola_id = $1',
      'postgres-1  | 2026-10-10 23:20:04.000 UTC [91] LOG:  checkpoint starting: time',
      'postgres-1  | 2026-10-10 23:20:09.000 UTC [90] ERROR:  canceling statement due to statement timeout',
    ].join('\n')
    expect(contarStatementsCancelados(log)).toBe(2)
    expect(contarStatementsCancelados('postgres-1  | LOG:  checkpoint complete: wrote 100 buffers\n')).toBe(0)
    expect(contarStatementsCancelados('')).toBe(0)
    // A forma de cada um, do `STATEMENT:` que vem logo depois (o segundo, sem a linha, diz que não há texto).
    expect(formasDosStatementsCancelados(log)).toEqual(['delete from mensagem_tutor where escola_id = $1', 'sem o texto do statement'])
    expect(formasDosStatementsCancelados('')).toEqual([])
    const comprido = `ERROR:  canceling statement due to statement timeout\nSTATEMENT:  update  x set ${'a'.repeat(300)}`
    expect(formasDosStatementsCancelados(comprido)[0]).toHaveLength(161)
  })

  it('o cancelado reprova dizendo qual statement foi cortado', () => {
    const [reprovacao] = julgarResultadoDoExpurgo(limpo({ statementsCancelados: 1, formasDosCancelados: ['update execucao_agente set entrada = $1'] }))
    expect(reprovacao?.criterio).toBe('statement_acima_de_2s')
    expect(reprovacao?.detalhe).toContain('1 statement(s) cancelado(s)')
    expect(reprovacao?.detalhe).toContain('update execucao_agente set entrada = $1')
  })

  it('o pg_stat_statements que não respondeu, que não viu nada ou que não viu uma tabela do expurgo não mede nada, e reprova', () => {
    expect(criterios(limpo({ statements: undefined }))).toEqual(['statements_sem_amostra'])
    expect(criterios(limpo({ statements: { total: 0, piores: [], tabelasVistas: [] } }))).toEqual(['statements_sem_amostra'])
    // Nenhum statement medido, mesmo com as tabelas "vistas": a medição vazia não prova que nada passou de 2 s.
    expect(criterios(limpo({ statements: { total: 0, piores: [], tabelasVistas: [...TABELAS_DO_EXPURGO] } }))).toEqual(['statements_sem_amostra'])
    const semAConsumo = julgarResultadoDoExpurgo(limpo({ statements: { total: 9, piores: [], tabelasVistas: TABELAS_DO_EXPURGO.filter((tabela) => tabela !== 'consumo_ia') } }))
    expect(semAConsumo).toEqual([{ criterio: 'statements_sem_amostra', detalhe: 'expurgo: sem statement medido em consumo_ia' }])
  })

  it('menos de dez jobs da B durante o trabalho da A é fase que mediu a B parada, e reprova', () => {
    expect(criterios(limpo({ esperaDaB: { amostras: AMOSTRAS_MINIMAS_DA_B - 1, p95Ms: 50, maximaMs: 60 } }))).toEqual(['sem_amostra_da_b'])
    expect(criterios(limpo({ esperaDaB: { amostras: AMOSTRAS_MINIMAS_DA_B, p95Ms: 50, maximaMs: 60 } }))).toEqual([])
  })

  it('o turno do Tutor da B durante o trabalho da A: na base + margem passa, um ms acima reprova com critério próprio, sem amostras não mede', () => {
    const limite = 400 + MARGEM_SOBRE_A_BASE_MS
    expect(criterios(limpo({ turnoDaB: { amostras: 13, p95Ms: limite, maximaMs: limite } }))).toEqual([])
    const reprovado = julgarResultadoDoExpurgo(limpo({ turnoDaB: { amostras: 13, p95Ms: limite + 1, maximaMs: 1_200 } }))
    expect(reprovado).toEqual([{ criterio: 'turno_b_no_expurgo', detalhe: `expurgo: p95 do turno do Tutor da B durante o trabalho da A em ${limite + 1} ms, acima de ${limite} ms (base + margem)` }])
    // A base fracionária arredonda para cima, como o threshold do k6.
    expect(criterios(limpo({ turnoBaseP95Ms: 400.2, turnoDaB: { amostras: 13, p95Ms: 401 + MARGEM_SOBRE_A_BASE_MS, maximaMs: 900 } }))).toEqual([])
    expect(criterios(limpo({ turnoDaB: { amostras: 13, p95Ms: null, maximaMs: null } }))).toEqual(['turno_b_no_expurgo'])
    // Menos turnos que o mínimo: a fase mediu o Tutor da B parado, e não passa mesmo com o p95 baixo.
    const poucos = julgarResultadoDoExpurgo(limpo({ turnoDaB: { amostras: AMOSTRAS_MINIMAS_DO_TURNO - 1, p95Ms: 50, maximaMs: 60 } }))
    expect(poucos).toEqual([{ criterio: 'sem_amostra_da_b', detalhe: `expurgo: só ${AMOSTRAS_MINIMAS_DO_TURNO - 1} turno(s) do Tutor da B concluíram durante o trabalho da A (mínimo ${AMOSTRAS_MINIMAS_DO_TURNO})` }])
    expect(criterios(limpo({ turnoDaB: { amostras: AMOSTRAS_MINIMAS_DO_TURNO, p95Ms: 50, maximaMs: 60 } }))).toEqual([])
    // O mínimo é o que o runbook diz: 5 turnos, pelo teto de 120 pedidos de IA por minuto por escola.
    expect(AMOSTRAS_MINIMAS_DO_TURNO).toBe(5)
  })

  it('a espera da B durante o trabalho: na base + margem passa, um ms acima reprova, mesmo com o resto limpo', () => {
    const limite = 100 + MARGEM_SOBRE_A_BASE_MS
    expect(criterios(limpo({ esperaDaB: { amostras: 30, p95Ms: limite, maximaMs: limite } }))).toEqual([])
    const reprovada = julgarResultadoDoExpurgo(limpo({ esperaDaB: { amostras: 30, p95Ms: limite + 1, maximaMs: 900 } }))
    expect(reprovada).toEqual([{ criterio: 'espera_b_no_expurgo', detalhe: `expurgo: p95 da espera da B durante o trabalho da A em ${limite + 1} ms, acima de ${limite} ms (base + margem)` }])
    // A base fracionária arredonda para cima, como o threshold do k6 (`Math.ceil`).
    expect(criterios(limpo({ esperaBaseP95Ms: 100.2, esperaDaB: { amostras: 30, p95Ms: 101 + MARGEM_SOBRE_A_BASE_MS, maximaMs: 700 } }))).toEqual([])
    expect(criterios(limpo({ esperaDaB: { amostras: 30, p95Ms: null, maximaMs: null } }))).toEqual(['espera_b_no_expurgo'])
  })
})

describe('a leitura do pg_stat_statements', () => {
  /** Um banco de mentira que responde o que o `pg_stat_statements` responderia a cada consulta, obedecendo ao `order by`. */
  function bancoDeMentira(statements: Array<{ query: string; calls: number; max: number; mean: number }>) {
    const consultas: string[] = []
    const banco = {
      query: async (texto: string, valores: unknown[] = []) => {
        consultas.push(texto)
        if (texto.includes('order by max_exec_time')) {
          const decrescente = /order by max_exec_time desc/.test(texto)
          const ordenados = [...statements].sort((x, y) => (decrescente ? y.max - x.max : x.max - y.max)).slice(0, 5)
          return { rows: ordenados.map((s) => ({ forma: s.query, chamadas: String(s.calls), maximoMs: s.max, mediaMs: s.mean })) }
        }
        if (texto.includes('query ~*')) {
          const palavra = new RegExp(String(valores[0]).replaceAll('\\m', '\\b').replaceAll('\\M', '\\b'), 'i')
          return { rows: [{ n: String(statements.filter((s) => s.calls > 0 && palavra.test(s.query)).length) }] }
        }
        return { rows: [{ n: String(statements.length) }] }
      },
    }
    return { banco: banco as unknown as Parameters<typeof lerStatements>[0], consultas }
  }

  it('devolve os cinco mais lentos pelo máximo, do pior para o melhor, e as tabelas do expurgo que apareceram', async () => {
    const { banco } = bancoDeMentira([
      { query: 'delete from mensagem_tutor where escola_id = $1', calls: 50, max: 140, mean: 70 },
      { query: 'update execucao_agente set entrada = $1', calls: 51, max: 1_900, mean: 94 },
      { query: 'update consumo_ia set entrada = $1', calls: 3, max: 410, mean: 58 },
      { query: 'select 1 from pedido_titular where id = $1', calls: 9, max: 12, mean: 2 },
      { query: 'select 1 from job_registro', calls: 900, max: 30, mean: 0.2 },
      { query: 'select 1 from usuario', calls: 2, max: 5, mean: 1 },
      { query: 'select 1 from artefato', calls: 2, max: 4, mean: 1 },
    ])
    const medicao = await lerStatements(banco)
    expect(medicao.total).toBe(7)
    expect(medicao.piores.map((statement) => statement.maximoMs)).toEqual([1_900, 410, 140, 30, 12])
    expect(medicao.piores[0]).toEqual({ forma: 'update execucao_agente set entrada = $1', chamadas: 51, maximoMs: 1_900, mediaMs: 94 })
    // Sem `expurgo_execucao`: nenhum statement a citou, e a fase reprova por isso.
    expect([...medicao.tabelasVistas].sort()).toEqual(['consumo_ia', 'execucao_agente', 'mensagem_tutor', 'pedido_titular'])
  })
})

describe('os números da fase batem com o resto do repositório', () => {
  it('o volume é o milhão da Tech Spec, e cada parte dele está vencida pelo catálogo de retenção', () => {
    expect(LINHAS_VENCIDAS_DA_A).toBe(1_000_000)
    expect(VOLUME_DA_A.execucoesDoTutor * 3 + VOLUME_DA_A.consumosComTexto).toBe(LINHAS_VENCIDAS_DA_A)
    // A semente tem 13 meses: se o padrão de uma dessas categorias passar disso, a fase deixaria de expurgar e passaria vazia.
    for (const categoria of ['conversa_tutor', 'execucao_agente', 'texto_do_modelo'] as const) {
      expect(CATEGORIAS_DE_RETENCAO[categoria].padrao, categoria).toBeLessThan(13)
    }
  })

  it('o catálogo tem as doze categorias que o expurgo conclui', () => {
    expect(CATEGORIAS_DO_CATALOGO).toBe(CHAVES_DE_RETENCAO.length)
    expect(CATEGORIAS_DO_CATALOGO).toBe(12)
  })

  it('o teto do statement é o BANCO_TIMEOUT_CONSULTA_MS do ambiente, e a margem é a do k6', () => {
    const ambiente = parseEnv(lerArquivo('.env.example'))
    expect(LIMITE_DO_STATEMENT_MS).toBe(Number(ambiente['BANCO_TIMEOUT_CONSULTA_MS']))
    const margem = /const MARGEM_SOBRE_A_BASE_MS = ([0-9_]+)/.exec(lerArquivo('infra/k6/justica-entre-escolas.js'))?.[1]
    expect(MARGEM_SOBRE_A_BASE_MS).toBe(Number(margem?.replaceAll('_', '')))
  })

  it('o teto da medida fica abaixo do corte do banco, e o turno mínimo cabe no teto de pedidos de IA da escola', () => {
    expect(TETO_DA_MEDIDA_MS).toBeLessThan(LIMITE_DO_STATEMENT_MS)
    // 1,5 turno por segundo = 90 por minuto, abaixo dos 120 por minuto por escola (`TETO_DE_PEDIDOS_DE_IA_POR_ESCOLA`).
    const teto = /export const TETO_DE_PEDIDOS_DE_IA_POR_ESCOLA = (\d+)/.exec(lerArquivo('apps/api/src/assistente/ai-request-rate-limit.ts'))?.[1]
    const turnosPor2s = /const TURNOS_DA_B_POR_2S = (\d+)/.exec(lerArquivo('infra/k6/justica-entre-escolas.js'))?.[1]
    expect((Number(turnosPor2s) / 2) * 60).toBeLessThan(Number(teto))
  })

  it('o k6 aceita a fase e a compara com a base: sem ela no ambiente, a fase não sobe', () => {
    const script = lerArquivo('infra/k6/justica-entre-escolas.js')
    expect(script).toContain("FASE !== 'expurgo'")
    expect(script).toContain('`a fase ${FASE} precisa de ESPERA_BASE_P95_MS`')
    // O turno do Tutor da B (a rota de verdade) vai ao lado do job sintético, na base e no expurgo, e não na carga.
    expect(script).toContain('${API}/v1/tutor/mensagens`')
    expect(script).toContain("new Trend('turno_b', true)")
    // O Trend não aceita `count` (o k6 recusa o script): quem exige ao menos um turno concluído é o contador ao lado.
    expect(script).toContain("new Counter('turnos_b_concluidos')")
    expect(script).toContain("thresholds.turnos_b_concluidos = ['count>0']")
    expect(script).not.toMatch(/turno_b[^\n]*'count/)
    expect(script).toContain("tokens('b_tutor')")
    expect(script).toContain("'a fase expurgo precisa de TURNO_BASE_P95_MS'")
    // A fase do expurgo é só a B: a rajada da A e as escolas C e anônimos são da fase `carga`.
    expect(script).toContain("FASE === 'carga' ? carga()")
  })
})
