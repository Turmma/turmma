import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../tools/testes/integracao.setup.ts'
import { consumoDaSala, contarExecucoesRodando, falhasDaSala, medirEscolasDaSala, semearEscolaDaSala, TURMAS_POR_ESCOLA_DA_SALA } from '../scripts/carga.ts'

// Contra o Postgres do compose de teste, com as migrations: o que a carga da manhã (`npm run carga -- --so=sala`, X6, tarefa 11.0) grava e lê no banco, com poucos alunos.
// A corrida de verdade tem 60 alunos e 2 professoras por escola, em dez escolas: a forma é esta.

const pool = new pg.Pool({ connectionString: urlDoBancoDeTeste(), max: 2 })
afterAll(async () => {
  await pool.end()
})

async function escola(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `with nova_rede as (insert into rede (nome, tipo) values ('Rede da carga da manhã', 'independente') returning id)
     insert into escola (rede_id, nome, slug) select id, 'Escola da carga da manhã', $1 from nova_rede returning id`,
    [`carga-manha-${randomUUID()}`],
  )
  const id = rows[0]?.id
  if (id === undefined) throw new Error('escola de teste não criada')
  return id
}

/** Os usuários que o `ops:sessao-sintetica` cria antes da semente: alunos sem conta e professoras com a conta delas. */
async function usuarios(escolaId: string, alunos: number, professoras: number): Promise<{ alunos: string[]; professoras: string[] }> {
  const ids = { alunos: [] as string[], professoras: [] as string[] }
  for (let n = 0; n < alunos; n += 1) {
    const { rows } = await pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', 'Aluno da carga') returning id", [escolaId])
    ids.alunos.push(rows[0]?.id ?? '')
  }
  for (let n = 0; n < professoras; n += 1) {
    const conta = await pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`professora-${randomUUID()}@carga.invalid`])
    const { rows } = await pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'professor', 'Professora da carga', $2) returning id", [escolaId, conta.rows[0]?.id])
    ids.professoras.push(rows[0]?.id ?? '')
  }
  return ids
}

const contar = async (texto: string, valores: unknown[]): Promise<number> => Number((await pool.query<{ n: string }>(texto, valores)).rows[0]?.n)

describe('a estrutura de uma escola da sala', () => {
  it('seis turmas com os alunos em rodízio e as professoras com vínculo confirmado nas seis, na disciplina, e o material `pronto` da série', async () => {
    const escolaId = await escola()
    const { alunos, professoras } = await usuarios(escolaId, 12, 2)
    const { turmaId, disciplinaId } = await semearEscolaDaSala(pool, escolaId)

    expect(await contar('select count(*) as n from turma where escola_id = $1', [escolaId])).toBe(TURMAS_POR_ESCOLA_DA_SALA)
    // Cada aluno, um vínculo de aluno confirmado, e as seis turmas com o mesmo tanto (12 ÷ 6).
    expect(await contar("select count(*) as n from vinculo where escola_id = $1 and papel = 'aluno' and estado = 'confirmado'", [escolaId])).toBe(alunos.length)
    expect(await contar("select count(distinct usuario_id) as n from vinculo where escola_id = $1 and papel = 'aluno'", [escolaId])).toBe(alunos.length)
    const porTurma = await pool.query<{ n: string }>("select count(*) as n from vinculo where escola_id = $1 and papel = 'aluno' group by turma_id", [escolaId])
    expect(porTurma.rows.map((linha) => Number(linha.n))).toEqual(Array.from({ length: TURMAS_POR_ESCOLA_DA_SALA }, () => 2))
    // As professoras: o que `comVinculoConfirmadoDoProfessor` procura (professora, turma, disciplina, `confirmado`), nas seis turmas.
    for (const professoraId of professoras) {
      expect(
        await contar("select count(*) as n from vinculo where escola_id = $1 and usuario_id = $2 and papel = 'professor' and estado = 'confirmado' and disciplina_id = $3", [escolaId, professoraId, disciplinaId]),
      ).toBe(TURMAS_POR_ESCOLA_DA_SALA)
    }
    expect(await contar("select count(*) as n from vinculo where escola_id = $1 and turma_id = $2 and papel = 'professor' and disciplina_id = $3", [escolaId, turmaId, disciplinaId])).toBe(professoras.length)
    // O material que `existeMaterialDaSerie` exige: da disciplina, `pronto`, declarado para a série das turmas, com as páginas.
    expect(
      await contar(
        `select count(*) as n from material m join material_serie ms on ms.escola_id = m.escola_id and ms.material_id = m.id
           join turma t on t.escola_id = m.escola_id and t.serie_id = ms.serie_id and t.id = $2
          where m.escola_id = $1 and m.disciplina_id = $3 and m.estado = 'pronto' and m.excluido_em is null`,
        [escolaId, turmaId, disciplinaId],
      ),
    ).toBe(1)
    expect(await contar('select count(*) as n from trecho where escola_id = $1 and disciplina_id = $2', [escolaId, disciplinaId])).toBe(6)
  })
})

const instante = async (): Promise<Date> => (await pool.query<{ agora: Date }>('select clock_timestamp() as agora')).rows[0]?.agora ?? new Date()

/** Um job da IA, com a espera até começar (`null`: ainda não começou), o instante em que nasceu e o tipo. */
const inserirJob = (escolaId: string, fila: string, esperaMs: number | null, criadoEm = 'clock_timestamp()', tipo = 'ia.executar') =>
  pool.query(
    `insert into job_registro (escola_id, fila, prioridade, tipo, estado, nao_urgente, criado_em, iniciado_em)
     values ($1, $2, 1, $3, 'concluido', false, ${criadoEm}, ${esperaMs === null ? 'null' : `${criadoEm} + ${esperaMs} * interval '1 millisecond'`})`,
    [escolaId, fila, tipo],
  )

/** O que não conta para a escola `a`, três de cada em cada fila: com a espera de 9 s eles levariam o p95 para cima se entrassem; o que não começou (`iniciado_em` nulo) nem tem espera. */
async function semearJobsQueNaoContam(a: string, b: string): Promise<void> {
  for (const fila of ['interativa', 'ferramenta']) {
    for (let n = 0; n < 3; n += 1) {
      await inserirJob(a, fila, 9_000, "clock_timestamp() - interval '1 hour'")
      await inserirJob(a, fila, 9_000, 'clock_timestamp()', 'ingestao.processar')
      await inserirJob(b, fila, 9_000)
    }
    await inserirJob(a, fila, null)
  }
}

/** Uma execução do Tutor ou da ferramenta, com o instante em que nasceu e quanto durou (a que terminou) ou o estado. */
async function execucaoDaEscola(
  contexto: { escolaId: string; anoId: string; alunoId: string },
  { estado, erro = null, funcao = 'tutor_com_o_aluno', criadaEm = 'clock_timestamp()', duracaoMs = 0 }: { estado: string; erro?: string | null; funcao?: string; criadaEm?: string; duracaoMs?: number },
): Promise<void> {
  const tarefa = funcao === 'tutor_com_o_aluno' ? 'turno_do_tutor' : 'propor_ferramenta'
  await pool.query(
    `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, estado, erro, criada_em, iniciada_em, concluida_em, resultado)
     values ($1, $2, $3, $4, $5, gen_random_uuid(), jsonb_build_object('tarefa', $4::text), $6, $7, ${criadaEm},
             case when $6 = 'pendente' then null else ${criadaEm} end,
             case when $6 in ('falhou', 'concluida') then ${criadaEm} + ${duracaoMs} * interval '1 millisecond' else null end,
             case when $6 = 'concluida' then '{"tipo":"mensagem"}'::jsonb else null end)`,
    [contexto.escolaId, contexto.anoId, funcao, tarefa, contexto.alunoId, estado, erro],
  )
}

/** A escola com a estrutura da sala e o aluno que pede, para as execuções. */
async function escolaComExecucoes(): Promise<{ escolaId: string; anoId: string; alunoId: string }> {
  const escolaId = await escola()
  const { alunos } = await usuarios(escolaId, 1, 1)
  await semearEscolaDaSala(pool, escolaId)
  const { rows } = await pool.query<{ id: string }>('select id from ano_letivo where escola_id = $1', [escolaId])
  return { escolaId, anoId: rows[0]?.id ?? '', alunoId: alunos[0] ?? '' }
}

/** As escolas A e B com os jobs da espera: os da A que contam (20 do Tutor, 100 a 290 ms, e 12 da ferramenta, 3.000 a 4.100 ms), os que não contam, e a janela. */
async function escolasComJobs(): Promise<{ a: string; b: string; desde: Date }> {
  const [a, b] = [await escola(), await escola()]
  const desde = new Date((await instante()).getTime() - 1_000)
  for (let n = 0; n < 20; n += 1) await inserirJob(a, 'interativa', 100 + n * 10)
  for (let n = 0; n < 12; n += 1) await inserirJob(a, 'ferramenta', 3_000 + n * 100)
  await semearJobsQueNaoContam(a, b)
  return { a, b, desde }
}

describe('o que a corrida mede no banco', () => {
  it('a espera p95 de cada fila da escola, só dos jobs da IA que começaram depois da janela; a outra escola, o outro tipo de job e o job antigo não entram', async () => {
    const { a, b, desde } = await escolasComJobs()
    const [medidaA] = await medirEscolasDaSala(pool, [a, b], desde)
    expect(medidaA).toMatchObject({ escola: 'e1', amostrasDoTutor: 20, amostrasDaFerramenta: 12 })
    // 20 esperas de 100 a 290 ms: o p95 está entre a 19ª e a 20ª, e a ferramenta de 3.000 a 4.100 ms, entre a 11ª e a 12ª: 4.045.
    expect(medidaA?.esperaDoTutorP95Ms).toBeGreaterThan(280)
    expect(medidaA?.esperaDoTutorP95Ms).toBeLessThan(300)
    expect(Math.round(medidaA?.esperaDaFerramentaP95Ms ?? 0)).toBe(4_045)
    expect(medidaA?.turnoDoTutorP95Ms).toBeNull()
  })

  it('a outra escola mede só os jobs dela, na ordem em que a sala as nomeia', async () => {
    const { a, b, desde } = await escolasComJobs()
    const medidas = await medirEscolasDaSala(pool, [a, b], desde)
    expect(medidas.map((medida) => medida.escola)).toEqual(['e1', 'e2'])
    expect(medidas[1]).toMatchObject({ amostrasDoTutor: 3, amostrasDaFerramenta: 3 })
    expect(Math.round(medidas[1]?.esperaDoTutorP95Ms ?? 0)).toBe(9_000)
    expect(Math.round(medidas[1]?.esperaDaFerramentaP95Ms ?? 0)).toBe(9_000)
  })

  it('o turno do Tutor é o p95 de `criada_em` a `concluida_em` das execuções concluídas da escola depois da janela; a falha, o antigo, a ferramenta e a outra escola não entram', async () => {
    const a = await escolaComExecucoes()
    const b = await escolaComExecucoes()
    const desde = new Date((await instante()).getTime() - 1_000)
    for (let n = 1; n <= 10; n += 1) await execucaoDaEscola(a, { estado: 'concluida', duracaoMs: n * 1_000 })
    // O que não entra, dois de cada, a 60 s: o p95 iria a 60 s se entrasse.
    for (let n = 0; n < 2; n += 1) {
      await execucaoDaEscola(b, { estado: 'concluida', duracaoMs: 60_000 })
      await execucaoDaEscola(a, { estado: 'concluida', duracaoMs: 60_000, criadaEm: "clock_timestamp() - interval '1 hour'" })
      await execucaoDaEscola(a, { estado: 'falhou', erro: 'IA_INDISPONIVEL', duracaoMs: 60_000 })
      await execucaoDaEscola(a, { estado: 'concluida', funcao: 'conversa_e_ferramentas', duracaoMs: 60_000 })
    }
    const [medidaA, medidaB] = await medirEscolasDaSala(pool, [a.escolaId, b.escolaId], desde)
    // 1 a 10 s: o p95 está entre a 9ª e a 10ª, a 0,55 do caminho: 9,55 s.
    expect(Math.round(medidaA?.turnoDoTutorP95Ms ?? 0)).toBe(9_550)
    expect(Math.round(medidaB?.turnoDoTutorP95Ms ?? 0)).toBe(60_000)
  })

  it('as execuções em `rodando` são o teto do kill -9, as falhas saem por erro e só da escola e da janela', async () => {
    const a = await escolaComExecucoes()
    const b = await escolaComExecucoes()
    const desde = new Date((await instante()).getTime() - 1_000)
    await execucaoDaEscola(a, { estado: 'rodando' })
    await execucaoDaEscola(a, { estado: 'rodando' })
    await execucaoDaEscola(a, { estado: 'pendente' })
    await execucaoDaEscola(a, { estado: 'concluida' })
    await execucaoDaEscola(a, { estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
    await execucaoDaEscola(a, { estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
    await execucaoDaEscola(a, { estado: 'falhou', erro: 'IA_INDISPONIVEL' })
    await execucaoDaEscola(a, { estado: 'falhou', erro: 'IA_SAIDA_INVALIDA', criadaEm: "clock_timestamp() - interval '1 hour'" })
    // A outra escola tem as suas: nada dela entra na conta da A.
    await execucaoDaEscola(b, { estado: 'rodando' })
    await execucaoDaEscola(b, { estado: 'falhou', erro: 'IA_TEMPO_ESGOTADO' })
    expect(await contarExecucoesRodando(pool, [a.escolaId])).toBe(2)
    expect(await contarExecucoesRodando(pool, [a.escolaId, b.escolaId])).toBe(3)
    expect(await contarExecucoesRodando(pool, [await escola()])).toBe(0)
    expect(await falhasDaSala(pool, [a.escolaId], desde)).toEqual({ EXECUCAO_INTERROMPIDA: 2, IA_INDISPONIVEL: 1 })
    expect(await falhasDaSala(pool, [a.escolaId, b.escolaId], desde)).toEqual({ EXECUCAO_INTERROMPIDA: 2, IA_INDISPONIVEL: 1, IA_TEMPO_ESGOTADO: 1 })
    expect(await falhasDaSala(pool, [a.escolaId], new Date(Date.now() + 60_000))).toEqual({})
  })

  it('o consumo da janela soma chamadas, tokens e custo por função, e só da escola e da janela', async () => {
    const [a, b] = [await escola(), await escola()]
    const desde = new Date((await instante()).getTime() - 1_000)
    const consumo = (escolaId: string, funcao: string, tarefa: string, tokens: [number, number], custoMicros: number, em = 'now()') =>
      pool.query(
        `insert into consumo_ia (escola_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, custo_micros, duracao_ms, envio_externo, tentativas, estado, em)
         values ($1, $2, $3, 'rapido', 'falso', 'falso-deterministico', 'v1', $4, $5, $6, 10, false, 1, 'concluida', ${em})`,
        [escolaId, tarefa, funcao, tokens[0], tokens[1], custoMicros],
      )
    for (let n = 0; n < 3; n += 1) await consumo(a, 'tutor_com_o_aluno', 'turno_do_tutor', [3_000, 250], 7)
    for (let n = 0; n < 2; n += 1) await consumo(a, 'conversa_e_ferramentas', 'gerar_plano_de_aula', [1_000, 100], 500)
    // Fora da janela e de outra escola: nenhum dos dois entra.
    await consumo(a, 'tutor_com_o_aluno', 'turno_do_tutor', [9_000, 999], 999, "now() - interval '1 hour'")
    await consumo(b, 'adaptacao', 'adaptar_atividade', [5_000, 500], 50)
    expect(await consumoDaSala(pool, [a], desde)).toEqual([
      { funcao: 'conversa_e_ferramentas', chamadas: 2, tokens: 2_200, custoMicros: 1_000 },
      { funcao: 'tutor_com_o_aluno', chamadas: 3, tokens: 9_750, custoMicros: 21 },
    ])
    expect(await consumoDaSala(pool, [b], desde)).toEqual([{ funcao: 'adaptacao', chamadas: 1, tokens: 5_500, custoMicros: 50 }])
  })
})
