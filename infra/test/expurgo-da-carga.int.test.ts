import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../tools/testes/integracao.setup.ts'
import {
  aguardarTrabalhoDaA,
  enfileirarExpurgoDaA,
  lerEsperaDaBNoTrabalho,
  lerRestoDaA,
  lerTurnoDaBNaJanela,
  lerTrabalhoDaA,
  liberarJanelaDaA,
  linhasVencidas,
  medirEscritaDosIndices,
  NOME_DO_TITULAR,
  PRIORIDADE_DO_LOTE,
  semearEscolaA,
  semearTutorDaB,
  TIPO_DA_ELIMINACAO,
  TIPO_DO_EXPURGO,
  type VolumeDaA,
} from '../scripts/expurgo-da-carga.ts'

// Contra o Postgres do compose de teste, com as migrations: o que a fase do expurgo do cenário de carga grava e lê no
// banco, com um volume pequeno. A semente que o cenário usa tem 1 milhão de linhas; a forma dela é esta.

const pool = new pg.Pool({ connectionString: urlDoBancoDeTeste(), max: 2 })

/** Escola de verdade, com rede própria: a semente e `job_registro` têm FK para `escola`. */
async function escola(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `with nova_rede as (insert into rede (nome, tipo) values ('Rede do expurgo da carga', 'independente') returning id)
     insert into escola (rede_id, nome, slug) select id, 'Escola do expurgo da carga', $1 from nova_rede returning id`,
    [`expurgo-carga-${randomUUID()}`],
  )
  const id = rows[0]?.id
  if (id === undefined) throw new Error('escola de teste não criada')
  return id
}

const PEQUENO: VolumeDaA = { execucoesDoTutor: 40, consumosComTexto: 25, alunosDoTutor: 4, trocasRecentesDoTitular: 6, execucoesComONome: 7, artefatosComONome: 3 }

beforeAll(async () => {
  await pool.query('select 1')
})

afterAll(async () => {
  await pool.end()
})

describe('a semente da escola A', () => {
  it('cria o volume vencido, o ano de uso do titular, o que cita o nome e o pedido agendado e vencido', async () => {
    const escolaId = await escola()
    const semente = await semearEscolaA(pool, escolaId, PEQUENO)
    expect(semente.nome).toBe(NOME_DO_TITULAR)
    expect(linhasVencidas(PEQUENO)).toBe(40 * 3 + 25)

    const contagem = async (texto: string, valores: unknown[] = [escolaId]): Promise<number> => Number((await pool.query<{ n: string }>(texto, valores)).rows[0]?.n)
    // Nenhuma execução aberta: a varredura da API falharia a que ficou `pendente` ou `rodando`, e a fase mediria isso.
    expect(await contagem("select count(*) as n from execucao_agente where escola_id = $1 and estado <> 'concluida'")).toBe(0)
    // As execuções vencidas do Tutor (13 meses) e as recentes do titular: cada uma com a pergunta e a resposta.
    expect(await contagem("select count(*) as n from execucao_agente where escola_id = $1 and funcao = 'tutor_com_o_aluno' and criada_em < now() - interval '12 months'")).toBe(40)
    expect(await contagem("select count(*) as n from mensagem_tutor where escola_id = $1 and criada_em < now() - interval '12 months'")).toBe(80)
    expect(await contagem("select count(*) as n from mensagem_tutor where escola_id = $1 and criada_em >= now() - interval '12 months' and aluno_id = $2", [escolaId, semente.alunoId])).toBe(12)
    expect(await contagem("select count(*) as n from consumo_ia where escola_id = $1 and entrada is not null and saida is not null and em < now() - interval '12 months'")).toBe(25)
    // O titular é um dos alunos do Tutor, e pediu só uma parte das vencidas (40 sobre 4 alunos).
    expect(await contagem("select count(*) as n from execucao_agente where escola_id = $1 and solicitada_por = $2 and criada_em < now() - interval '12 months'", [escolaId, semente.alunoId])).toBe(10)
    expect(await contagem("select count(distinct solicitada_por) as n from execucao_agente where escola_id = $1 and funcao = 'tutor_com_o_aluno'")).toBe(4)

    // O que a troca de nome encontra: execuções e artefatos do professor com o nome, e o nome é o do aluno.
    const resto = await lerRestoDaA(pool, escolaId, semente)
    expect(resto).toEqual({
      // 80 vencidas e 12 recentes do titular.
      mensagensDoTutor: 92,
      execucoesPorAnonimizar: 40,
      consumosComTexto: 25,
      linhasComONome: 7 + 3,
      titularExiste: true,
      estadoDoPedido: 'agendado',
      categoriasConcluidas: 0,
    })
    const { rows } = await pool.query<{ vencido: boolean; marca: boolean }>(
      `select p.eliminar_em < now() as vencido, u.eliminacao_agendada_em is not null as marca
         from pedido_titular p join usuario u on u.escola_id = p.escola_id and u.id = p.titular_id
        where p.escola_id = $1 and p.titular_id = $2 and p.tipo = 'eliminacao'`,
      [escolaId, semente.alunoId],
    )
    expect(rows).toEqual([{ vencido: true, marca: true }])
    const { rows: nome } = await pool.query<{ nome: string }>('select nome from usuario where id = $1', [semente.alunoId])
    expect(nome[0]?.nome).toBe(NOME_DO_TITULAR)
  })

  it('a semente não toca a escola ao lado', async () => {
    const [a, outra] = await Promise.all([escola(), escola()])
    await semearEscolaA(pool, a, PEQUENO)
    for (const tabela of ['execucao_agente', 'mensagem_tutor', 'consumo_ia', 'pedido_titular', 'usuario', 'artefato']) {
      const { rows } = await pool.query<{ n: string }>(`select count(*) as n from ${tabela} where escola_id = $1`, [outra])
      expect(Number(rows[0]?.n), tabela).toBe(0)
    }
  })
})

describe('o que a A ainda tem depois do expurgo', () => {
  it('não conta o que já foi anonimizado nem o consumo que perdeu os dois textos, mas conta o que ainda tem um deles', async () => {
    const escolaId = await escola()
    const semente = await semearEscolaA(pool, escolaId, PEQUENO)
    // 5 das 40 execuções vencidas já foram anonimizadas.
    await pool.query(
      `update execucao_agente set anonimizada_em = now()
        where id in (select id from execucao_agente where escola_id = $1 and criada_em < now() - interval '12 months' limit 5)`,
      [escolaId],
    )
    // 4 dos 25 consumos perderam entrada e saída; 3 perderam só a entrada, e ainda têm a saída.
    await pool.query(
      `update consumo_ia set entrada = null, saida = null
        where id in (select id from consumo_ia where escola_id = $1 and em < now() - interval '12 months' limit 4)`,
      [escolaId],
    )
    await pool.query(
      `update consumo_ia set entrada = null
        where id in (select id from consumo_ia where escola_id = $1 and em < now() - interval '12 months' and entrada is not null limit 3)`,
      [escolaId],
    )
    const resto = await lerRestoDaA(pool, escolaId, semente)
    expect(resto.execucoesPorAnonimizar).toBe(35)
    expect(resto.consumosComTexto).toBe(21)
  })

  it('a categoria conta pela última execução dela, e não pela primeira que terminou', async () => {
    const escolaId = await escola()
    const semente = await semearEscolaA(pool, escolaId, PEQUENO)
    const execucao = (categoria: string, concluida: boolean, horas: number) =>
      pool.query(`insert into expurgo_execucao (escola_id, categoria, linhas, concluida, em) values ($1, $2, 7, $3, now() - make_interval(hours => $4))`, [escolaId, categoria, concluida, horas])
    // A conversa terminou numa noite e parou na seguinte: hoje está pendente. A execução do agente terminou uma vez.
    await execucao('conversa_tutor', true, 30)
    await execucao('conversa_tutor', false, 6)
    await execucao('execucao_agente', true, 7)
    expect((await lerRestoDaA(pool, escolaId, semente)).categoriasConcluidas).toBe(1)
  })
})

describe('a janela, o job e a leitura do trabalho da A', () => {
  it('libera a janela da A sem apagar o que a escola já tinha configurado', async () => {
    const escolaId = await escola()
    await pool.query(`insert into configuracao_operacional_escola (escola_id, fuso, dias_letivos, vagas) values ($1, 'America/Sao_Paulo', '{1,2,3}', '{"lote": 4}'::jsonb)`, [escolaId])
    await liberarJanelaDaA(pool, escolaId)
    const { rows } = await pool.query<{ fuso: string; dias: number[]; vagas: Record<string, number> }>(
      'select fuso, dias_letivos as dias, vagas from configuracao_operacional_escola where escola_id = $1',
      [escolaId],
    )
    expect(rows).toEqual([{ fuso: 'America/Sao_Paulo', dias: [], vagas: { lote: 4 } }])
    // Sem linha nenhuma, a liberação cria a da escola.
    const nova = await escola()
    await liberarJanelaDaA(pool, nova)
    expect((await pool.query('select dias_letivos from configuracao_operacional_escola where escola_id = $1', [nova])).rows).toEqual([{ dias_letivos: [] }])
  })

  it('grava o job do expurgo como a rotina da noite o grava: lote, a prioridade do lote, não urgente, com a data da noite', async () => {
    const escolaId = await escola()
    const agora = new Date('2026-10-10T03:00:00.000Z')
    const jobId = await enfileirarExpurgoDaA(pool, escolaId, agora)
    const { rows } = await pool.query(
      `select fila, prioridade, tipo, dados, nao_urgente, estado, chave_idempotencia from job_registro where escola_id = $1 and id = $2`,
      [escolaId, jobId],
    )
    expect(rows).toEqual([{ fila: 'lote', prioridade: PRIORIDADE_DO_LOTE, tipo: TIPO_DO_EXPURGO, dados: {}, nao_urgente: true, estado: 'aguardando', chave_idempotencia: '2026-10-10' }])
  })

  it('lê o trabalho da A: o começo do primeiro, o fim do último, e quantos falharam ou ainda correm', async () => {
    const escolaId = await escola()
    const grava = (tipo: string, estado: string, inicioHa: number | null, fimHa: number | null) =>
      pool.query(
        `insert into job_registro (escola_id, fila, prioridade, tipo, estado, nao_urgente, iniciado_em, concluido_em)
         values ($1, 'lote', 4, $2, $3, true,
                 case when $4::float8 is null then null else now() - make_interval(secs => $4::float8) end,
                 case when $5::float8 is null then null else now() - make_interval(secs => $5::float8) end)`,
        [escolaId, tipo, estado, inicioHa, fimHa],
      )
    await grava(TIPO_DO_EXPURGO, 'concluido', 30, 12)
    await grava(TIPO_DA_ELIMINACAO, 'ativo', 20, null)
    const andando = await lerTrabalhoDaA(pool, escolaId)
    expect(andando).toMatchObject({ expurgos: 1, eliminacoes: 1, falhos: 0, emAndamento: 1 })
    expect(Date.now() - (andando.inicioMs ?? 0)).toBeGreaterThan(29_000)
    expect(Date.now() - (andando.inicioMs ?? 0)).toBeLessThan(40_000)
    // Enquanto algum job corre, a espera não devolve: respeita o prazo e entrega o que há.
    const inicio = performance.now()
    expect((await aguardarTrabalhoDaA(pool, escolaId, 2_500)).emAndamento).toBe(1)
    expect(performance.now() - inicio).toBeGreaterThanOrEqual(2_400)

    await pool.query(`update job_registro set estado = 'concluido', concluido_em = now() - interval '5 seconds' where escola_id = $1 and tipo = $2`, [escolaId, TIPO_DA_ELIMINACAO])
    const pronto = await aguardarTrabalhoDaA(pool, escolaId, 10_000)
    expect(pronto).toMatchObject({ expurgos: 1, eliminacoes: 1, falhos: 0, emAndamento: 0 })
    // Do começo do expurgo (há 30 s, quando o teste começou) ao fim da eliminação (há 5 s, contados de uns 4 s depois).
    expect((pronto.fimMs ?? 0) - (pronto.inicioMs ?? 0)).toBeGreaterThan(27_000)
    expect((pronto.fimMs ?? 0) - (pronto.inicioMs ?? 0)).toBeLessThan(31_000)

    await grava(TIPO_DA_ELIMINACAO, 'falhou', 10, 8)
    // O que falhou não está "em andamento": os dois estados se excluem.
    expect(await lerTrabalhoDaA(pool, escolaId)).toMatchObject({ falhos: 1, eliminacoes: 2, emAndamento: 0 })
    // Um job que falhou encerra a espera na hora: não há o que esperar.
    const antes = performance.now()
    expect((await aguardarTrabalhoDaA(pool, escolaId, 20_000)).falhos).toBe(1)
    expect(performance.now() - antes).toBeLessThan(5_000)
  })

  it('sem a eliminação enfileirada, o expurgo concluído não encerra a espera: o trabalho da A ainda não terminou', async () => {
    const escolaId = await escola()
    await pool.query(
      `insert into job_registro (escola_id, fila, prioridade, tipo, estado, nao_urgente, iniciado_em, concluido_em)
       values ($1, 'lote', 4, $2, 'concluido', true, now() - interval '20 seconds', now() - interval '10 seconds')`,
      [escolaId, TIPO_DO_EXPURGO],
    )
    const inicio = performance.now()
    const trabalho = await aguardarTrabalhoDaA(pool, escolaId, 2_500)
    expect(performance.now() - inicio).toBeGreaterThanOrEqual(2_400)
    expect(trabalho).toMatchObject({ expurgos: 1, eliminacoes: 0, emAndamento: 0 })
  })

  it('só olha os jobs da própria escola e dos dois tipos do expurgo', async () => {
    const [a, outra] = await Promise.all([escola(), escola()])
    await pool.query(
      `insert into job_registro (escola_id, fila, prioridade, tipo, estado, nao_urgente, iniciado_em, concluido_em) values
         ($1, 'lote', 4, $3, 'falhou', true, now(), now()),
         ($2, 'lote', 4, $4, 'falhou', true, now(), now()),
         ($2, 'interativa', 1, 'sintetico', 'falhou', false, now(), now())`,
      [outra, a, TIPO_DO_EXPURGO, 'sintetico'],
    )
    expect(await lerTrabalhoDaA(pool, a)).toEqual({ inicioMs: null, fimMs: null, expurgos: 0, eliminacoes: 0, falhos: 0, emAndamento: 0 })
  })
})

describe('a espera da B durante o trabalho da A', () => {
  async function jobDaB(escolaId: string, { fila = 'interativa', criadoHaMs, esperaMs }: { fila?: string; criadoHaMs: number; esperaMs: number | null }): Promise<void> {
    await pool.query(
      `insert into job_registro (escola_id, fila, prioridade, tipo, estado, criado_em, iniciado_em)
       values ($1, $2, 1, 'sintetico', 'concluido', now() - make_interval(secs => $3::float8 / 1000),
               case when $4::float8 is null then null else now() - make_interval(secs => ($3::float8 - $4::float8) / 1000) end)`,
      [escolaId, fila, criadoHaMs, esperaMs],
    )
  }

  it('conta só os interativos da B que nasceram entre o começo e o fim do trabalho, e que já começaram', async () => {
    const [b, outra] = await Promise.all([escola(), escola()])
    const agora = Date.now()
    const trabalho = { inicioMs: agora - 20_000, fimMs: agora - 10_000 }
    // Dentro: criados há 15 s e há 12 s, esperaram 40 e 900 ms.
    await jobDaB(b, { criadoHaMs: 15_000, esperaMs: 40 })
    await jobDaB(b, { criadoHaMs: 12_000, esperaMs: 900 })
    // Fora da janela (antes, depois), de lote, que não começou, e de outra escola: nada disso entra.
    await jobDaB(b, { criadoHaMs: 25_000, esperaMs: 5_000 })
    await jobDaB(b, { criadoHaMs: 5_000, esperaMs: 5_000 })
    await jobDaB(b, { criadoHaMs: 15_000, esperaMs: 7_000, fila: 'lote' })
    await jobDaB(b, { criadoHaMs: 14_000, esperaMs: null })
    await jobDaB(outra, { criadoHaMs: 15_000, esperaMs: 8_000 })
    const espera = await lerEsperaDaBNoTrabalho(pool, b, trabalho)
    expect(espera.amostras).toBe(2)
    expect(espera.maximaMs).toBeGreaterThanOrEqual(850)
    expect(espera.maximaMs).toBeLessThanOrEqual(950)
    // p95 entre 40 e 900 ms, interpolado: perto do maior.
    expect(espera.p95Ms).toBeGreaterThan(800)
    expect(espera.p95Ms).toBeLessThanOrEqual(900)
  })

  it('sem trabalho medido, a B não tem amostra', async () => {
    expect(await lerEsperaDaBNoTrabalho(pool, await escola(), { inicioMs: null, fimMs: null })).toEqual({ amostras: 0, p95Ms: null, maximaMs: null })
  })
})

describe('o Tutor da B: a estrutura que os alunos precisam e o turno medido', () => {
  const aluno = async (escolaId: string): Promise<string> =>
    (await pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', 'Pessoa sintética') returning id", [escolaId])).rows[0]?.id ?? ''

  it('dá a cada aluno da B o vínculo confirmado na turma do ano em curso, uma estrutura só, e nenhum a quem já tem ou é de outra escola', async () => {
    const [b, outra] = await Promise.all([escola(), escola()])
    const alunosDaB = await Promise.all([aluno(b), aluno(b), aluno(b)])
    const deOutra = await aluno(outra)
    expect(await semearTutorDaB(pool, b)).toBe(3)
    const vinculos = await pool.query<{ usuario_id: string; papel: string; estado: string; turma_id: string; ano: string }>(
      `select v.usuario_id, v.papel, v.estado, v.turma_id, a.situacao as ano from vinculo v join ano_letivo a on a.escola_id = v.escola_id and a.id = v.ano_letivo_id where v.escola_id = $1`,
      [b],
    )
    expect(vinculos.rows.map((linha) => linha.usuario_id).sort()).toEqual([...alunosDaB].sort())
    expect(new Set(vinculos.rows.map((linha) => linha.turma_id)).size).toBe(1)
    expect(vinculos.rows.every((linha) => linha.papel === 'aluno' && linha.estado === 'confirmado' && linha.ano === 'em_curso')).toBe(true)
    expect((await pool.query('select 1 from vinculo where escola_id = $1 and usuario_id = $2', [outra, deOutra])).rows).toEqual([])

    // De novo, com um aluno novo (as sessões de cada fase são alunos novos): só ele ganha vínculo, na mesma turma.
    const novo = await aluno(b)
    expect(await semearTutorDaB(pool, b)).toBe(1)
    expect(await semearTutorDaB(pool, b)).toBe(0)
    const turmas = await pool.query<{ turma_id: string }>('select distinct turma_id from vinculo where escola_id = $1', [b])
    expect(turmas.rows).toHaveLength(1)
    expect((await pool.query('select 1 from vinculo where escola_id = $1 and usuario_id = $2', [b, novo])).rows).toHaveLength(1)
    expect((await pool.query("select 1 from ano_letivo where escola_id = $1 and situacao = 'em_curso'", [b])).rows).toHaveLength(1)
  })

  it('conta só os turnos concluídos do Tutor da B criados na janela do trabalho da A, de criada_em a concluida_em', async () => {
    const [b, outra] = await Promise.all([escola(), escola()])
    const alunoB = await aluno(b)
    const alunoOutra = await aluno(outra)
    await semearTutorDaB(pool, b)
    await semearTutorDaB(pool, outra)
    const anoDe = async (escolaId: string): Promise<string> => (await pool.query<{ id: string }>("select id from ano_letivo where escola_id = $1 and situacao = 'em_curso'", [escolaId])).rows[0]?.id ?? ''
    const [anoB, anoOutra] = [await anoDe(b), await anoDe(outra)]
    const agora = Date.now()
    const janela = { inicioMs: agora - 20_000, fimMs: agora - 10_000 }
    const turno = (
      escolaId: string,
      ano: string,
      alunoId: string,
      { criadoHaMs, duracaoMs, funcao = 'tutor_com_o_aluno', concluido = true }: { criadoHaMs: number; duracaoMs: number; funcao?: string; concluido?: boolean },
    ) => {
      // A tarefa e o tipo do resultado seguem a função: o banco recusa o par que não existe.
      const [tarefa, tipo] = funcao === 'tutor_com_o_aluno' ? ['turno_do_tutor', 'mensagem_do_tutor'] : ['propor_ferramenta', 'mensagem']
      return pool.query(
        `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, estado, entrada, criada_em, iniciada_em, concluida_em, resultado)
         values ($1, $2, $3, $4, $5, gen_random_uuid(), $6, jsonb_build_object('tarefa', $4::text),
                 now() - make_interval(secs => $7::float8 / 1000),
                 now() - make_interval(secs => $7::float8 / 1000),
                 case when $6 = 'concluida' then now() - make_interval(secs => ($7::float8 - $8::float8) / 1000) end,
                 case when $6 = 'concluida' then jsonb_build_object('tipo', $9::text, 'mensagemId', '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b') end)`,
        [escolaId, ano, funcao, tarefa, alunoId, concluido ? 'concluida' : 'rodando', criadoHaMs, duracaoMs, tipo],
      )
    }
    // Dentro da janela (criados há 15 s e há 12 s): turnos de 400 e 900 ms.
    await turno(b, anoB, alunoB, { criadoHaMs: 15_000, duracaoMs: 400 })
    await turno(b, anoB, alunoB, { criadoHaMs: 12_000, duracaoMs: 900 })
    // Fora: antes e depois da janela, ainda rodando, de outra função e de outra escola.
    await turno(b, anoB, alunoB, { criadoHaMs: 25_000, duracaoMs: 5_000 })
    await turno(b, anoB, alunoB, { criadoHaMs: 5_000, duracaoMs: 5_000 })
    await turno(b, anoB, alunoB, { criadoHaMs: 14_000, duracaoMs: 700, concluido: false })
    await turno(b, anoB, alunoB, { criadoHaMs: 14_000, duracaoMs: 800, funcao: 'conversa_e_ferramentas' })
    await turno(outra, anoOutra, alunoOutra, { criadoHaMs: 15_000, duracaoMs: 8_000 })

    const medida = await lerTurnoDaBNaJanela(pool, b, janela)
    expect(medida.amostras).toBe(2)
    expect(medida.maximaMs).toBeGreaterThanOrEqual(850)
    expect(medida.maximaMs).toBeLessThanOrEqual(950)
    // p95 entre 400 e 900 ms, interpolado: perto do maior.
    expect(medida.p95Ms).toBeGreaterThan(800)
    expect(medida.p95Ms).toBeLessThanOrEqual(900)
    expect(await lerTurnoDaBNaJanela(pool, b, { inicioMs: null, fimMs: null })).toEqual({ amostras: 0, p95Ms: null, maximaMs: null })
  })
})

describe('a escrita a mais dos índices de anonimização', () => {
  it('mede com e sem os índices, e não deixa nada: nem as linhas inseridas, nem um índice a menos', async () => {
    const escolaId = await escola()
    const semente = await semearEscolaA(pool, escolaId, PEQUENO)
    const contagem = async (tabela: string): Promise<number> => Number((await pool.query<{ n: string }>(`select count(*) as n from ${tabela} where escola_id = $1`, [escolaId])).rows[0]?.n)
    const indices = async (): Promise<string[]> =>
      (await pool.query<{ indexname: string }>(`select indexname from pg_indexes where indexname = any($1::text[]) order by indexname`, [
        ['execucao_agente_a_anonimizar_idx', 'execucao_agente_do_tutor_a_anonimizar_idx', 'consumo_ia_aluno_a_anular_idx'],
      ])).rows.map((linha) => linha.indexname)
    const antes = { execucoes: await contagem('execucao_agente'), consumos: await contagem('consumo_ia'), indices: await indices() }
    expect(antes.indices).toHaveLength(3)

    // `begin`, `drop index` e `rollback` na mesma conexão: o pool poderia mandar cada um por uma.
    const cliente = await pool.connect()
    let medidas: Awaited<ReturnType<typeof medirEscritaDosIndices>>
    try {
      medidas = await medirEscritaDosIndices(cliente, escolaId, semente.anoId, 300)
    } finally {
      cliente.release()
    }
    expect(medidas.map((medida) => [medida.tabela, medida.indices.length, medida.linhas])).toEqual([
      ['execucao_agente', 2, 300],
      ['consumo_ia', 1, 300],
    ])
    for (const medida of medidas) {
      expect(medida.comIndicesUs).toBeGreaterThan(0)
      expect(medida.semIndicesUs).toBeGreaterThan(0)
    }
    expect({ execucoes: await contagem('execucao_agente'), consumos: await contagem('consumo_ia'), indices: await indices() }).toEqual(antes)
  })

  it('apaga os três índices dentro da transação da medida e termina em rollback, uma transação por tabela', async () => {
    const escolaId = await escola()
    const semente = await semearEscolaA(pool, escolaId, PEQUENO)
    const cliente = await pool.connect()
    const comandos: string[] = []
    try {
      const espiao = { query: (texto: string, valores?: unknown[]) => (comandos.push(texto.trim().split(/\s+/).slice(0, 3).join(' ')), cliente.query(texto, valores)) }
      await medirEscritaDosIndices(espiao as unknown as Parameters<typeof medirEscritaDosIndices>[0], escolaId, semente.anoId, 50)
    } finally {
      cliente.release()
    }
    const controle = comandos.filter((comando) => /^(begin|set local lock_timeout|rollback|commit|drop index)/.test(comando))
    // O `lock_timeout` logo depois de cada `begin`: o `drop index` não espera sem fim pela trava exclusiva da tabela.
    expect(controle).toEqual([
      'begin',
      'set local lock_timeout',
      'drop index execucao_agente_a_anonimizar_idx',
      'drop index execucao_agente_do_tutor_a_anonimizar_idx',
      'rollback',
      'begin',
      'set local lock_timeout',
      'drop index consumo_ia_aluno_a_anular_idx',
      'rollback',
    ])
  })

  it('sem aluno na escola, recusa em vez de medir o que não existe', async () => {
    await expect(medirEscritaDosIndices(pool, await escola(), randomUUID(), 10)).rejects.toThrow('a escola A não tem aluno')
  })
})
