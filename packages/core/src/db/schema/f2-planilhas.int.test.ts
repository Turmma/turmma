import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../../tools/testes/integracao.setup.ts'
import { createLogger } from '../../log/logger.js'
import { migrate, PASTA_MIGRACOES } from '../migrate.js'

/**
 * As invariantes do banco do F2 (migration 0040, tarefa 2.0), provadas por fora do código: é o que segura um insert escrito à mão,
 * um job ou um repository de outro pacote que esqueça a regra. As tabelas `importacao_planilha`, `alocacao` e `evento_calendario`
 * ainda não têm quem as grave (4.0 em diante), então o banco é a única barreira que existe hoje.
 *
 * O teste migra um banco só dele, com as migrations da pasta, em vez de usar o do ambiente de teste: o que se prova é o texto da
 * `0040_f2_planilhas.sql`, e o banco do ambiente já a aplicou antes de qualquer teste rodar.
 */

interface Cenario {
  escolaId: string
  anoLetivoId: string
  serieId: string
  turmaId: string
  disciplinaId: string
  coordenadorId: string
  professorId: string
  vinculoId: string
}

describe('F2: o banco recusa o que o contrato das planilhas proíbe', () => {
  const nomeDoBanco = `f2_planilhas_${Date.now()}`
  const urlDoAmbiente = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoAmbiente)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoAmbiente.toString() })
  const cliente = new pg.Client({ connectionString: urlDoScratch.toString() })

  /** O que o banco recusou: o código do erro e o nome da restrição. Falha se não recusou. */
  async function recusa(consulta: Promise<unknown>): Promise<{ codigo: string; restricao: string | undefined }> {
    try {
      await consulta
    } catch (erro) {
      const { code, constraint } = erro as { code: string; constraint?: string }
      return { codigo: code, restricao: constraint }
    }
    throw new Error('o banco deveria ter recusado')
  }

  async function id(instrucao: string, valores: unknown[]): Promise<string> {
    const { rows } = await cliente.query<{ id: string }>(instrucao, valores)
    const linha = rows[0]
    if (linha === undefined) throw new Error('insert sem linha')
    return linha.id
  }

  async function novoUsuario(escolaId: string, papel: 'coordenador' | 'professor'): Promise<string> {
    const contaId = await id('insert into conta (email) values ($1) returning id', [`f2-${randomUUID()}@educa.invalid`])
    return id("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, 'Pessoa sintética') returning id", [escolaId, contaId, papel])
  }

  /** Uma escola sintética inteira: ano em curso, série, turma, disciplina, coordenação, professor e o vínculo dele com a turma. */
  async function novoCenario(): Promise<Cenario> {
    const redeId = await id("insert into rede (nome, tipo) values ('Rede sintética do F2', 'independente') returning id", [])
    const escolaId = await id("insert into escola (rede_id, nome, slug) values ($1, 'Escola sintética do F2', $2) returning id", [redeId, `f2-${randomUUID()}`])
    const anoLetivoId = await id("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaId])
    const serieId = await id("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 8) returning id", [escolaId])
    const turmaId = await id("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '8ºA') returning id", [escolaId, anoLetivoId, serieId])
    const disciplinaId = await id("insert into disciplina (escola_id, nome) values ($1, 'Matemática') returning id", [escolaId])
    const coordenadorId = await novoUsuario(escolaId, 'coordenador')
    const professorId = await novoUsuario(escolaId, 'professor')
    const vinculoId = await novoVinculo({ escolaId, anoLetivoId, turmaId, disciplinaId, professorId, coordenadorId })
    return { escolaId, anoLetivoId, serieId, turmaId, disciplinaId, coordenadorId, professorId, vinculoId }
  }

  const novoVinculo = (c: Pick<Cenario, 'escolaId' | 'anoLetivoId' | 'turmaId' | 'disciplinaId' | 'professorId' | 'coordenadorId'>) =>
    id("insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, criado_por) values ($1, $2, $3, $4, $5, 'professor', $6) returning id", [
      c.escolaId,
      c.anoLetivoId,
      c.professorId,
      c.turmaId,
      c.disciplinaId,
      c.coordenadorId,
    ])

  /** Outro ano letivo da mesma escola, com uma turma dele. */
  async function outroAno(c: Cenario): Promise<{ anoLetivoId: string; turmaId: string }> {
    const anoLetivoId = await id("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2027, '2027-02-01', '2027-12-15', 'planejado') returning id", [c.escolaId])
    const turmaId = await id("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '8ºA') returning id", [c.escolaId, anoLetivoId, c.serieId])
    return { anoLetivoId, turmaId }
  }

  const aula = (c: Cenario, ajuste: Record<string, unknown> = {}) => {
    const linha = { escola_id: c.escolaId, ano_letivo_id: c.anoLetivoId, vinculo_id: c.vinculoId, dia_semana: 1, inicio: '07:30', fim: '08:20', ...ajuste }
    const colunas = Object.keys(linha)
    return id(`insert into alocacao (${colunas.join(', ')}) values (${colunas.map((_, i) => `$${String(i + 1)}`).join(', ')}) returning id`, Object.values(linha))
  }

  const evento = (c: Cenario, ajuste: Record<string, unknown> = {}) => {
    const linha = { escola_id: c.escolaId, ano_letivo_id: c.anoLetivoId, tipo: 'feriado', inicio: '2026-11-15', fim: '2026-11-15', descricao: 'Proclamação da República', ...ajuste }
    const colunas = Object.keys(linha)
    return id(`insert into evento_calendario (${colunas.join(', ')}) values (${colunas.map((_, i) => `$${String(i + 1)}`).join(', ')}) returning id`, Object.values(linha))
  }

  const importacao = (c: Cenario, ajuste: Record<string, unknown> = {}) => {
    const linha = { escola_id: c.escolaId, ano_letivo_id: c.anoLetivoId, tipo: 'alunos', estado: 'na_fila', assinatura: randomUUID(), ...ajuste }
    const colunas = Object.keys(linha)
    return id(`insert into importacao_planilha (${colunas.join(', ')}) values (${colunas.map((_, i) => `$${String(i + 1)}`).join(', ')}) returning id`, Object.values(linha))
  }

  const novaTurma = (c: Cenario, nome: string, chave: string | null, anoLetivoId = c.anoLetivoId, escolaId = c.escolaId, serieId = c.serieId) =>
    id('insert into turma (escola_id, ano_letivo_id, serie_id, nome, chave) values ($1, $2, $3, $4, $5) returning id', [escolaId, anoLetivoId, serieId, nome, chave])

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 60_000, pasta: PASTA_MIGRACOES }, createLogger({ servico: 'migrar-f2-teste', nivel: 'silent' }))
    await cliente.connect()
  }, 120_000)

  afterAll(async () => {
    await cliente.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
  })

  describe('alocacao', () => {
    it('o horário que termina antes de começar ou junto com o começo é recusado pelo check; o que termina depois entra', async () => {
      const c = await novoCenario()
      expect(await recusa(aula(c, { inicio: '08:20', fim: '07:30' }))).toEqual({ codigo: '23514', restricao: 'alocacao_horario_valido' })
      expect(await recusa(aula(c, { inicio: '07:30', fim: '07:30' }))).toEqual({ codigo: '23514', restricao: 'alocacao_horario_valido' })
      await expect(aula(c, { inicio: '07:30', fim: '07:31' })).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })

    it('o dia da semana 0 e 8 são recusados pelo check; de 1 a 7 entram', async () => {
      const c = await novoCenario()
      for (const dia of [0, 8, -1]) expect(await recusa(aula(c, { dia_semana: dia })), String(dia)).toEqual({ codigo: '23514', restricao: 'alocacao_dia_da_semana_valido' })
      for (const dia of [1, 7]) await expect(aula(c, { dia_semana: dia, inicio: '09:00', fim: '09:50' }), String(dia)).resolves.toBeDefined()
    })

    it('o mesmo vínculo no mesmo dia e início é recusado; outro início, outro dia ou outro vínculo entram', async () => {
      const c = await novoCenario()
      const outroVinculo = await novoVinculo({ ...c, disciplinaId: await id("insert into disciplina (escola_id, nome) values ($1, 'Física') returning id", [c.escolaId]) })
      await aula(c)
      expect(await recusa(aula(c, { fim: '08:30' }))).toEqual({ codigo: '23505', restricao: 'alocacao_vinculo_dia_inicio_unico' })
      await aula(c, { inicio: '08:20', fim: '09:10' })
      await aula(c, { dia_semana: 2 })
      await aula(c, { vinculo_id: outroVinculo })
    })

    it('o vínculo de outra escola e o de outro ano são recusados pela FK composta com o ano do vínculo', async () => {
      const [a, b] = [await novoCenario(), await novoCenario()]
      const planejado = await outroAno(a)
      // O vínculo da B numa aula da A, com o ano da própria A.
      expect(await recusa(aula(a, { vinculo_id: b.vinculoId }))).toEqual({ codigo: '23503', restricao: 'alocacao_vinculo_do_ano_da_escola_fk' })
      // O vínculo da A, no ano de 2026, com o ano de 2027 da mesma A.
      expect(await recusa(aula(a, { ano_letivo_id: planejado.anoLetivoId }))).toEqual({ codigo: '23503', restricao: 'alocacao_vinculo_do_ano_da_escola_fk' })
      // A escola da B na aula de um vínculo da A.
      expect(await recusa(aula(a, { escola_id: b.escolaId }))).toEqual({ codigo: '23503', restricao: 'alocacao_vinculo_do_ano_da_escola_fk' })
    })

    it('a aula sai com o vínculo, em cascata, e só a dele', async () => {
      const c = await novoCenario()
      const outroVinculo = await novoVinculo({ ...c, disciplinaId: await id("insert into disciplina (escola_id, nome) values ($1, 'Física') returning id", [c.escolaId]) })
      const [dele, doOutro] = [await aula(c), await aula(c, { vinculo_id: outroVinculo })]
      await cliente.query('delete from vinculo where id = $1', [c.vinculoId])
      const { rows } = await cliente.query<{ id: string }>('select id from alocacao where escola_id = $1', [c.escolaId])
      expect(rows.map((linha) => linha.id)).toEqual([doOutro])
      expect(rows.map((linha) => linha.id)).not.toContain(dele)
    })
  })

  describe('evento_calendario', () => {
    it('o tipo fora de feriado, recesso e evento é recusado; os três entram', async () => {
      const c = await novoCenario()
      expect(await recusa(evento(c, { tipo: 'prova' }))).toEqual({ codigo: '23514', restricao: 'evento_calendario_tipo_valido' })
      for (const tipo of ['feriado', 'recesso', 'evento']) await expect(evento(c, { tipo }), tipo).resolves.toBeDefined()
    })

    it('o fim antes do início é recusado; o mesmo dia e o período entram', async () => {
      const c = await novoCenario()
      expect(await recusa(evento(c, { inicio: '2026-11-16', fim: '2026-11-15' }))).toEqual({ codigo: '23514', restricao: 'evento_calendario_periodo_valido' })
      await evento(c, { inicio: '2026-11-15', fim: '2026-11-15' })
      await evento(c, { inicio: '2026-12-20', fim: '2027-01-31' })
    })

    it('a descrição vazia, só de espaços ou com mais de 120 caracteres é recusada; 120 entram', async () => {
      const c = await novoCenario()
      for (const descricao of ['', '   ', 'x'.repeat(121)]) expect(await recusa(evento(c, { descricao })), JSON.stringify(descricao)).toEqual({ codigo: '23514', restricao: 'evento_calendario_descricao_preenchida' })
      await evento(c, { descricao: 'x'.repeat(120) })
    })

    it('o ano de outra escola é recusado pela FK composta; o ano da própria escola, planejado ou em curso, entra', async () => {
      const [a, b] = [await novoCenario(), await novoCenario()]
      expect(await recusa(evento(a, { ano_letivo_id: b.anoLetivoId }))).toEqual({ codigo: '23503', restricao: 'evento_calendario_ano_letivo_da_escola_fk' })
      await evento(a, { ano_letivo_id: (await outroAno(a)).anoLetivoId })
    })
  })

  describe('importacao_planilha', () => {
    it('tipo e estado fora da lista são recusados pelo check', async () => {
      const c = await novoCenario()
      expect(await recusa(importacao(c, { tipo: 'notas' }))).toEqual({ codigo: '23514', restricao: 'importacao_planilha_tipo_valido' })
      expect(await recusa(importacao(c, { estado: 'em_andamento' }))).toEqual({ codigo: '23514', restricao: 'importacao_planilha_estado_valido' })
      for (const tipo of ['alunos', 'professores', 'grade', 'calendario']) await expect(importacao(c, { tipo, estado: 'concluida' }), tipo).resolves.toBeDefined()
      for (const estado of ['desatualizada', 'falhou']) await expect(importacao(c, { estado }), estado).resolves.toBeDefined()
    })

    it('o erro fora da lista fechada é recusado, inclusive o texto do Postgres; os três códigos e nenhum erro entram', async () => {
      const c = await novoCenario()
      for (const erro of ['duplicate key value violates unique constraint', 'expirada', '']) expect(await recusa(importacao(c, { estado: 'falhou', erro })), erro).toEqual({ codigo: '23514', restricao: 'importacao_planilha_erro_valido' })
      for (const erro of ['expirou', 'trava_esgotada', 'erro_interno']) await expect(importacao(c, { estado: 'falhou', erro }), erro).resolves.toBeDefined()
      await expect(importacao(c, { estado: 'concluida', erro: null })).resolves.toBeDefined()
    })

    it('o ano nulo só vale na planilha de professores: nas outras três o check recusa', async () => {
      const c = await novoCenario()
      for (const tipo of ['alunos', 'grade', 'calendario']) expect(await recusa(importacao(c, { tipo, ano_letivo_id: null, estado: 'concluida' })), tipo).toEqual({ codigo: '23514', restricao: 'importacao_planilha_ano_ou_professores' })
      await expect(importacao(c, { tipo: 'professores', ano_letivo_id: null, estado: 'concluida' })).resolves.toBeDefined()
    })

    it('o ano de outra escola é recusado pela FK composta, e o autor de outra escola também', async () => {
      const [a, b] = [await novoCenario(), await novoCenario()]
      expect(await recusa(importacao(a, { ano_letivo_id: b.anoLetivoId }))).toEqual({ codigo: '23503', restricao: 'importacao_planilha_ano_letivo_da_escola_fk' })
      expect(await recusa(importacao(a, { criado_por: b.coordenadorId }))).toEqual({ codigo: '23503', restricao: 'importacao_planilha_criado_por_da_escola_fk' })
      await expect(importacao(a, { criado_por: a.coordenadorId })).resolves.toBeDefined()
    })

    it('a escola que não existe é recusada na planilha de professores, que não tem ano: só a FK da escola a segura', async () => {
      const c = await novoCenario()
      expect(await recusa(importacao(c, { escola_id: randomUUID(), tipo: 'professores', ano_letivo_id: null }))).toEqual({ codigo: '23503', restricao: 'importacao_planilha_escola_id_escola_id_fk' })
      await expect(importacao(c, { tipo: 'professores', ano_letivo_id: null })).resolves.toBeDefined()
    })

    it('uma importação na fila por escola: a segunda é recusada; na outra escola entra, e depois que a primeira sai da fila a escola grava outra', async () => {
      const [a, b] = [await novoCenario(), await novoCenario()]
      const primeira = await importacao(a)
      expect(await recusa(importacao(a, { tipo: 'grade' }))).toEqual({ codigo: '23505', restricao: 'importacao_planilha_uma_na_fila_por_escola' })
      await importacao(b)
      // As que já saíram da fila não contam, e podem ser várias.
      await importacao(a, { estado: 'concluida' })
      await importacao(a, { estado: 'falhou', erro: 'expirou' })
      await cliente.query("update importacao_planilha set estado = 'concluida' where id = $1", [primeira])
      await expect(importacao(a, { tipo: 'calendario' })).resolves.toBeDefined()
    })

    it('eliminar quem gravou a planilha: o autor vira nulo, a escola e o resto da linha ficam', async () => {
      const c = await novoCenario()
      const autor = await novoUsuario(c.escolaId, 'coordenador')
      const planilha = await importacao(c, { criado_por: autor, estado: 'concluida', resumo: JSON.stringify({ entram: 3 }) })
      await cliente.query('delete from usuario where id = $1', [autor])
      const { rows } = await cliente.query<{ escola_id: string; criado_por: string | null; estado: string; resumo: unknown }>('select escola_id, criado_por, estado, resumo from importacao_planilha where id = $1', [planilha])
      expect(rows).toEqual([{ escola_id: c.escolaId, criado_por: null, estado: 'concluida', resumo: { entram: 3 } }])
    })
  })

  describe('turma.chave e vinculo.origem', () => {
    it('duas turmas do mesmo ano e da mesma escola com a mesma chave são recusadas, mesmo com nomes diferentes; sem chave convivem', async () => {
      const c = await novoCenario()
      await novaTurma(c, '9ºA', '9a')
      expect(await recusa(novaTurma(c, '9º A', '9a'))).toEqual({ codigo: '23505', restricao: 'turma_chave_no_ano_unica' })
      await novaTurma(c, 'Turma Azul', null)
      await novaTurma(c, 'Turma Verde', null)
    })

    it('a mesma chave em outro ano da escola e na escola B é aceita: o único é por escola e ano', async () => {
      const [a, b] = [await novoCenario(), await novoCenario()]
      const planejado = await outroAno(a)
      await novaTurma(a, '9ºA', '9a')
      await novaTurma(a, '9ºA', '9a', planejado.anoLetivoId)
      await novaTurma(b, '9ºA', '9a', b.anoLetivoId, b.escolaId, b.serieId)
    })

    it('o vínculo nasce `coordenacao`, aceita grade e lista, e recusa outra origem', async () => {
      const c = await novoCenario()
      const { rows } = await cliente.query<{ origem: string }>('select origem from vinculo where id = $1', [c.vinculoId])
      expect(rows).toEqual([{ origem: 'coordenacao' }])
      const outraTurma = await novaTurma(c, '9ºB', '9b')
      const comOrigem = (origem: string, usuarioId: string) =>
        cliente.query("insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, criado_por, origem) values ($1, $2, $3, $4, 'professor', $5, $6)", [
          c.escolaId,
          c.anoLetivoId,
          usuarioId,
          outraTurma,
          c.coordenadorId,
          origem,
        ])
      expect(await recusa(comOrigem('planilha', c.professorId))).toEqual({ codigo: '23514', restricao: 'vinculo_origem_valida' })
      await comOrigem('grade', c.professorId)
      await comOrigem('lista', await novoUsuario(c.escolaId, 'professor'))
    })
  })

  describe('os índices das tabelas novas', () => {
    it('cada um começa pelo escopo e os parciais são parciais (regra 80, item 8)', async () => {
      const { rows } = await cliente.query<{ indexname: string; indexdef: string }>(
        `select indexname, indexdef from pg_indexes where indexname in ('alocacao_ano_idx', 'evento_calendario_ano_idx', 'importacao_planilha_uma_na_fila_por_escola', 'importacao_planilha_na_fila_idx', 'importacao_planilha_escola_id_unico', 'turma_chave_no_ano_unica') order by indexname`,
      )
      const definicao = (nome: string) => rows.find((linha) => linha.indexname === nome)?.indexdef
      expect(definicao('alocacao_ano_idx')).toMatch(/\(escola_id, ano_letivo_id\)$/)
      expect(definicao('evento_calendario_ano_idx')).toMatch(/\(escola_id, ano_letivo_id\)$/)
      expect(definicao('importacao_planilha_uma_na_fila_por_escola')).toMatch(/UNIQUE INDEX .*\(escola_id\) WHERE \(estado = 'na_fila'::text\)$/)
      expect(definicao('importacao_planilha_na_fila_idx')).toMatch(/\(criado_em\) WHERE \(estado = 'na_fila'::text\)$/)
      expect(definicao('importacao_planilha_escola_id_unico')).toMatch(/UNIQUE INDEX .*\(escola_id, id\)$/)
      expect(definicao('turma_chave_no_ano_unica')).toMatch(/UNIQUE INDEX .*\(escola_id, ano_letivo_id, chave\) WHERE \(chave IS NOT NULL\)$/)
    })
  })
})
