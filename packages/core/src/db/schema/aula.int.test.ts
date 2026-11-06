import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../../tools/testes/integracao.setup.ts'
import { createLogger } from '../../log/logger.js'
import { migrate, PASTA_MIGRACOES } from '../migrate.js'

/**
 * As invariantes do banco do registro da aula (migration 0041, F2b, tarefa 1.0), provadas por fora do código: é o que segura um
 * insert escrito à mão, o job da grade ou um repository de outro pacote que esqueça a regra. A `aula` ainda não tem quem a grave
 * (2.0 em diante), então o banco é a única barreira que existe hoje.
 *
 * O teste migra um banco só dele, com as migrations da pasta, como o `f2-planilhas.int.test.ts`: o que se prova é o texto da
 * `0041_registro_da_aula.sql`, e o banco do ambiente já a aplicou antes de qualquer teste rodar.
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

describe('F2b: o banco recusa o que o contrato do registro da aula proíbe', () => {
  const nomeDoBanco = `aula_${Date.now()}`
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
    const contaId = await id('insert into conta (email) values ($1) returning id', [`aula-${randomUUID()}@educa.invalid`])
    return id("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, 'Pessoa sintética') returning id", [escolaId, contaId, papel])
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

  /** Uma escola sintética inteira: ano em curso, série, turma, disciplina, coordenação, professor e o vínculo dele com a turma. */
  async function novoCenario(): Promise<Cenario> {
    const redeId = await id("insert into rede (nome, tipo) values ('Rede sintética da F2b', 'independente') returning id", [])
    const escolaId = await id("insert into escola (rede_id, nome, slug) values ($1, 'Escola sintética da F2b', $2) returning id", [redeId, `aula-${randomUUID()}`])
    const anoLetivoId = await id("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaId])
    const serieId = await id("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 8) returning id", [escolaId])
    const turmaId = await id("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '8ºA') returning id", [escolaId, anoLetivoId, serieId])
    const disciplinaId = await id("insert into disciplina (escola_id, nome) values ($1, 'Matemática') returning id", [escolaId])
    const coordenadorId = await novoUsuario(escolaId, 'coordenador')
    const professorId = await novoUsuario(escolaId, 'professor')
    const vinculoId = await novoVinculo({ escolaId, anoLetivoId, turmaId, disciplinaId, professorId, coordenadorId })
    return { escolaId, anoLetivoId, serieId, turmaId, disciplinaId, coordenadorId, professorId, vinculoId }
  }

  /** Outro ano letivo da mesma escola, com uma turma dele. */
  async function outroAno(c: Cenario): Promise<{ anoLetivoId: string; turmaId: string }> {
    const anoLetivoId = await id("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2027, '2027-02-01', '2027-12-15', 'planejado') returning id", [c.escolaId])
    const turmaId = await id("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '8ºA') returning id", [c.escolaId, anoLetivoId, c.serieId])
    return { anoLetivoId, turmaId }
  }

  /** Uma linha de `aula`; o que o teste quer provar entra em `ajuste`, e o resto é uma linha que o banco aceita. */
  const aula = (c: Cenario, ajuste: Record<string, unknown> = {}) => {
    const linha = { escola_id: c.escolaId, ano_letivo_id: c.anoLetivoId, vinculo_id: c.vinculoId, data: '2026-03-10', inicio: '07:30', fim: '08:20', conteudo: 'Frações equivalentes', ...ajuste }
    const colunas = Object.keys(linha)
    return id(`insert into aula (${colunas.join(', ')}) values (${colunas.map((_, i) => `$${String(i + 1)}`).join(', ')}) returning id`, Object.values(linha))
  }

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 60_000, pasta: PASTA_MIGRACOES }, createLogger({ servico: 'migrar-aula-teste', nivel: 'silent' }))
    await cliente.connect()
  }, 120_000)

  afterAll(async () => {
    await cliente.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
  })

  describe('o horário', () => {
    it('o fim igual ao início e o fim antes do início são recusados pelo check; o fim depois do início entra', async () => {
      const c = await novoCenario()
      expect(await recusa(aula(c, { inicio: '08:20', fim: '08:20' }))).toEqual({ codigo: '23514', restricao: 'aula_horario_valido' })
      expect(await recusa(aula(c, { inicio: '08:20', fim: '07:30' }))).toEqual({ codigo: '23514', restricao: 'aula_horario_valido' })
      await expect(aula(c, { inicio: '07:30', fim: '07:31' })).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })
  })

  describe('o texto', () => {
    it('o conteúdo vazio e o só de espaços são recusados pelo check do `btrim`; um caractere entra', async () => {
      const c = await novoCenario()
      expect(await recusa(aula(c, { conteudo: '' }))).toEqual({ codigo: '23514', restricao: 'aula_conteudo_preenchido' })
      expect(await recusa(aula(c, { conteudo: '     ' }))).toEqual({ codigo: '23514', restricao: 'aula_conteudo_preenchido' })
      await expect(aula(c, { conteudo: 'x' })).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })

    it('o tamanho vale depois do `btrim`: 501 caracteres úteis são recusados, mesmo com espaços em volta; 500 entram, também com espaços em volta', async () => {
      const c = await novoCenario()
      const limite = 'x'.repeat(500)
      expect(await recusa(aula(c, { conteudo: `${limite}x` }))).toEqual({ codigo: '23514', restricao: 'aula_conteudo_preenchido' })
      expect(await recusa(aula(c, { conteudo: ` ${limite}x ` }))).toEqual({ codigo: '23514', restricao: 'aula_conteudo_preenchido' })
      await expect(aula(c, { conteudo: limite, inicio: '09:00', fim: '09:50' })).resolves.toMatch(/^[0-9a-f-]{36}$/)
      // Os espaços em volta não contam: 500 úteis com dois espaços de cada lado são 504 no `char_length` cru.
      await expect(aula(c, { conteudo: `  ${limite}  `, inicio: '10:00', fim: '10:50' })).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })
  })

  describe('o vínculo', () => {
    it('a escola que não existe é recusada pela FK da escola', async () => {
      const c = await novoCenario()
      expect(await recusa(aula(c, { escola_id: randomUUID() }))).toEqual({ codigo: '23503', restricao: 'aula_escola_id_escola_id_fk' })
    })

    it('o vínculo de outra escola e o de outro ano são recusados pela FK composta com o ano do vínculo', async () => {
      const [a, b] = [await novoCenario(), await novoCenario()]
      const planejado = await outroAno(a)
      // O vínculo da B numa aula da A, com o ano da própria A.
      expect(await recusa(aula(a, { vinculo_id: b.vinculoId }))).toEqual({ codigo: '23503', restricao: 'aula_vinculo_do_ano_da_escola_fk' })
      // O vínculo da A, no ano de 2026, com o ano de 2027 da mesma A.
      expect(await recusa(aula(a, { ano_letivo_id: planejado.anoLetivoId }))).toEqual({ codigo: '23503', restricao: 'aula_vinculo_do_ano_da_escola_fk' })
      // A escola da B na aula de um vínculo da A.
      expect(await recusa(aula(a, { escola_id: b.escolaId }))).toEqual({ codigo: '23503', restricao: 'aula_vinculo_do_ano_da_escola_fk' })
    })

    it('a mesma aula (vínculo, data e início) é recusada; outro início, outra data ou outro vínculo entram', async () => {
      const c = await novoCenario()
      const outroVinculo = await novoVinculo({ ...c, disciplinaId: await id("insert into disciplina (escola_id, nome) values ($1, 'Física') returning id", [c.escolaId]) })
      await aula(c)
      expect(await recusa(aula(c, { fim: '08:30', conteudo: 'Outro texto' }))).toEqual({ codigo: '23505', restricao: 'aula_vinculo_data_inicio_unico' })
      await aula(c, { inicio: '08:20', fim: '09:10' })
      await aula(c, { data: '2026-03-11' })
      await aula(c, { vinculo_id: outroVinculo })
    })

    it('a aula sai com o vínculo, em cascata, e só a dele', async () => {
      const c = await novoCenario()
      const outroVinculo = await novoVinculo({ ...c, disciplinaId: await id("insert into disciplina (escola_id, nome) values ($1, 'Física') returning id", [c.escolaId]) })
      await aula(c)
      const doOutro = await aula(c, { vinculo_id: outroVinculo })
      await cliente.query('delete from vinculo where id = $1', [c.vinculoId])
      const { rows } = await cliente.query<{ id: string }>('select id from aula where escola_id = $1', [c.escolaId])
      expect(rows.map((linha) => linha.id)).toEqual([doOutro])
    })
  })

  describe('o índice', () => {
    it('a leitura da semana pelo escopo (escola e ano) usa o índice `aula_semana_idx`, que começa por eles', async () => {
      const c = await novoCenario()
      await aula(c)
      // Sem a varredura sequencial como opção, o plano mostra qual índice atende a leitura: só o da semana começa pela escola.
      await cliente.query('begin')
      try {
        await cliente.query('set local enable_seqscan = off')
        const { rows } = await cliente.query<{ 'QUERY PLAN': string }>('explain select id from aula where escola_id = $1 and ano_letivo_id = $2', [c.escolaId, c.anoLetivoId])
        expect(rows.map((linha) => linha['QUERY PLAN']).join('\n')).toContain('aula_semana_idx')
      } finally {
        await cliente.query('rollback')
      }
    })
  })
})
