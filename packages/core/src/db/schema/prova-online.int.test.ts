import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getTableConfig, PgDialect, type PgTable } from 'drizzle-orm/pg-core'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../../tools/testes/integracao.setup.ts'
import { createLogger } from '../../log/logger.js'
import { migrate, PASTA_MIGRACOES } from '../migrate.js'
import { atividadeAplicada } from './atividade-aplicada.js'
import { convocadoDaSegundaChamada, extensaoDeTempo, indisponibilidade, pulsoDaApi, saidaDaAba, tempoAdicional } from './prova-online.js'
import { tentativaAtividade } from './tentativa-atividade.js'

/**
 * As invariantes da prova online (migration 0068, avaliacao-e-correcao 1.0), provadas no banco, por fora do código: é o que segura um insert escrito à mão, o job
 * da rotina de encerramento (6.0) e o repository de outro pacote que esqueça a regra. A janela, a duração, o embaralhamento e a segunda chamada ficam na
 * aplicação; o tempo adicional, a extensão, a convocação e a saída da aba, nas tabelas novas; o pulso e a indisponibilidade são fato global.
 */
describe('a prova online no banco: o que a migration 0068 recusa', () => {
  /**
   * Um banco só deste arquivo, construído pelas migrations da pasta **agora**: o do teste já tem a 0068 aplicada, e o que se muda nela depois não o alcança. Assim, o que a migration
   * cria é o que os casos abaixo exercitam, e o caso fica vermelho se uma restrição dela some ou muda.
   */
  const nomeDoBanco = `prova_online_${String(Date.now())}`
  const urlDoScratch = new URL(urlDoBancoDeTeste())
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoBancoDeTeste() })
  const cliente = new pg.Client({ connectionString: urlDoScratch.toString() })

  interface Cenario {
    escolaId: string
    anoLetivoId: string
    turmaId: string
    disciplinaId: string
    professorId: string
    alunoId: string
  }

  const id = async (instrucao: string, valores: unknown[]): Promise<string> => {
    const { rows } = await cliente.query<{ id: string }>(instrucao, valores)
    const linha = rows[0]
    if (linha === undefined) throw new Error('insert sem linha')
    return linha.id
  }

  /** O que o banco devolve ao recusar: o código SQL e o nome da restrição (ou o texto do gatilho, que não tem restrição). */
  async function recusa(consulta: Promise<unknown>): Promise<{ codigo: string; restricao: string | undefined }> {
    try {
      await consulta
    } catch (erro) {
      const { code, constraint } = erro as { code: string; constraint?: string }
      return { codigo: code, restricao: constraint }
    }
    throw new Error('o banco deveria ter recusado')
  }

  async function novoUsuario(escolaId: string, papel: 'professor' | 'aluno'): Promise<string> {
    let contaId: string | null = null
    if (papel === 'professor') {
      contaId = await id('insert into conta (email) values ($1) returning id', [`prova-${randomUUID()}@educa.invalid`])
    }
    return id("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, 'Pessoa sintética') returning id", [escolaId, contaId, papel])
  }

  async function novoCenario(): Promise<Cenario> {
    const redeId = await id("insert into rede (nome, tipo) values ('Rede sintética da prova', 'independente') returning id", [])
    const escolaId = await id("insert into escola (rede_id, nome, slug) values ($1, 'Escola sintética da prova', $2) returning id", [redeId, `prova-${randomUUID()}`])
    const anoLetivoId = await id("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaId])
    const serieId = await id("insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [escolaId])
    const turmaId = await id("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºB') returning id", [escolaId, anoLetivoId, serieId])
    const disciplinaId = await id("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [escolaId])
    return { escolaId, anoLetivoId, turmaId, disciplinaId, professorId: await novoUsuario(escolaId, 'professor'), alunoId: await novoUsuario(escolaId, 'aluno') }
  }

  const novoArtefato = (c: Cenario) =>
    id(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por) values ($1, $2, $3, $4, 'atividade_objetiva', 'Prova sintética', '{"tipo":"atividade_objetiva","questoes":[]}'::jsonb, $5) returning id`,
      [c.escolaId, c.anoLetivoId, c.turmaId, c.disciplinaId, c.professorId],
    )

  /** Uma aplicação, com o que a prova acrescenta em `ajuste` (colunas em snake_case). */
  async function aplicar(c: Cenario, artefatoId: string, ajuste: Record<string, unknown> = {}): Promise<string> {
    const linha = { escola_id: c.escolaId, ano_letivo_id: c.anoLetivoId, turma_id: c.turmaId, artefato_id: artefatoId, avaliativa: true, aplicada_por: c.professorId, ...ajuste }
    const colunas = Object.keys(linha)
    return id(`insert into atividade_aplicada (${colunas.join(', ')}) values (${colunas.map((_, i) => `$${String(i + 1)}`).join(', ')}) returning id`, Object.values(linha))
  }

  /** O começo e o envio da tentativa, com instantes fixos: o relógio do teste não é o do banco. */
  const ENVIADA = { iniciada_em: '2026-12-01T10:00:00Z', enviada_em: '2026-12-01T10:30:00Z' }
  const JANELA = { abre_em: '2026-12-01T10:00:00Z', fecha_em: '2026-12-01T12:00:00Z' }

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 120_000 }, createLogger({ servico: 'migrar-prova-online-teste', nivel: 'silent' }))
    await cliente.connect()
  }, 180_000)

  afterAll(async () => {
    await cliente.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
  })

  describe('o schema do Drizzle e a migration 0068 dizem o mesmo', () => {
    /** O banco de teste sai das migrations, não do schema: o que esta migration cria é provado nos casos abaixo, e aqui o espelho em TypeScript tem de ser o mesmo texto que o `drizzle-kit` levou ao SQL. */
    const migration = readFileSync(join(PASTA_MIGRACOES, '0068_prova_online.sql'), 'utf8')
    const dialeto = new PgDialect({ casing: 'snake_case' })
    const texto = (valor: unknown): string => dialeto.sqlToQuery(valor as never).sql
    const tabelas: Array<[string, PgTable]> = [
      ['atividade_aplicada', atividadeAplicada],
      ['tentativa_atividade', tentativaAtividade],
      ['tempo_adicional', tempoAdicional],
      ['extensao_de_tempo', extensaoDeTempo],
      ['convocado_da_segunda_chamada', convocadoDaSegundaChamada],
      ['saida_da_aba', saidaDaAba],
      ['pulso_da_api', pulsoDaApi],
      ['indisponibilidade', indisponibilidade],
    ]

    it('cada check que a migration cria está no schema com a mesma expressão, e o schema não declara check que ela não cria', () => {
      const criados = [...migration.matchAll(/CONSTRAINT "([a-z0-9_]+)" CHECK \(/g)].map((achado) => achado[1] as string).sort()
      const doSchema = tabelas.flatMap(([, tabela]) => getTableConfig(tabela).checks)
      // O check que já existia antes da 0068 (o estado e as datas) fica de fora: só os que ela cria.
      const novosNoSchema = doSchema.filter((check) => criados.includes(check.name))
      expect(novosNoSchema.map((check) => check.name).sort()).toEqual(criados)
      for (const check of novosNoSchema) expect(migration, check.name).toContain(`CONSTRAINT "${check.name}" CHECK (${texto(check.value)})`)
    })

    it('cada índice com condição ou expressão que a migration cria está no schema, com as mesmas colunas e a mesma condição', () => {
      const indices = tabelas.flatMap(([, tabela]) => getTableConfig(tabela).indexes.map((indice) => indice.config)).filter((config) => migration.includes(`INDEX "${config.name}`))
      expect(indices.map((config) => config.name).sort()).toEqual(
        ['atividade_aplicada_aberta_unica', 'atividade_aplicada_prova_aberta_idx', 'atividade_aplicada_segunda_chamada_aberta_unica', 'convocado_da_segunda_chamada_aluno_idx', 'extensao_de_tempo_aluno_idx', 'indisponibilidade_fim_idx', 'pulso_da_api_linha_unica', 'tempo_adicional_aluno_idx'],
      )
      for (const indice of indices) {
        const colunas = indice.columns.map((coluna) => ('name' in coluna ? `"${String(coluna.name).replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`)}"` : texto(coluna))).join(',')
        const condicao = indice.where === undefined ? '' : ` WHERE ${texto(indice.where)}`
        expect(migration, indice.name).toContain(`INDEX "${indice.name}`)
        expect(migration, indice.name).toContain(`USING btree (${colunas})${condicao};`)
      }
    })
  })

  describe('a janela, a duração e o embaralhamento da aplicação', () => {
    it('a janela vem inteira e ordenada, e a duração vai de 5 a 300 minutos e só com janela; a avaliativa com a prova inteira passa', async () => {
      const c = await novoCenario()
      const artefato = await novoArtefato(c)
      const recusadas: Array<[string, Record<string, unknown>, string]> = [
        ['abre sem fecha', { abre_em: JANELA.abre_em }, 'atividade_aplicada_janela_inteira'],
        ['fecha sem abre', { fecha_em: JANELA.fecha_em }, 'atividade_aplicada_janela_inteira'],
        ['fecha antes de abrir', { abre_em: JANELA.fecha_em, fecha_em: JANELA.abre_em }, 'atividade_aplicada_janela_ordenada'],
        ['abre e fecha juntos', { abre_em: JANELA.abre_em, fecha_em: JANELA.abre_em }, 'atividade_aplicada_janela_ordenada'],
        ['duração de 4 min', { ...JANELA, duracao_min: 4 }, 'atividade_aplicada_duracao_valida'],
        ['duração de 301 min', { ...JANELA, duracao_min: 301 }, 'atividade_aplicada_duracao_valida'],
        ['duração sem janela', { duracao_min: 40 }, 'atividade_aplicada_duracao_valida'],
      ]
      for (const [caso, ajuste, restricao] of recusadas) {
        expect(await recusa(aplicar(c, artefato, ajuste)), caso).toEqual({ codigo: '23514', restricao })
      }
      // Os dois limites da duração passam, e a avaliativa sem prova (como antes da F6) também.
      await aplicar(c, await novoArtefato(c), { ...JANELA, duracao_min: 5 })
      await aplicar(c, await novoArtefato(c), { ...JANELA, duracao_min: 300 })
      await aplicar(c, await novoArtefato(c))
    })

    it('a atividade que não é avaliativa não tem janela, duração, embaralhamento nem segunda chamada', async () => {
      const c = await novoCenario()
      const artefato = await novoArtefato(c)
      for (const ajuste of [{ ...JANELA }, { embaralhar_questoes: true }, { embaralhar_alternativas: true }]) {
        expect(await recusa(aplicar(c, artefato, { avaliativa: false, ...ajuste })), JSON.stringify(ajuste)).toEqual({ codigo: '23514', restricao: 'atividade_aplicada_prova_so_na_avaliativa' })
      }
      // A não avaliativa sem nada de prova passa, e a avaliativa pode embaralhar.
      await aplicar(c, artefato, { avaliativa: false })
      await aplicar(c, await novoArtefato(c), { embaralhar_questoes: true, embaralhar_alternativas: true })
    })

    it('a segunda chamada é da mesma turma e do mesmo artefato da original; só uma aberta por original, e a original aberta continua única', async () => {
      const c = await novoCenario()
      const artefato = await novoArtefato(c)
      const original = await aplicar(c, artefato, { ...JANELA, duracao_min: 40 })
      // A original aberta é única por turma e artefato, e a segunda chamada não a substitui nem a repete.
      expect(await recusa(aplicar(c, artefato, JANELA))).toEqual({ codigo: '23505', restricao: 'atividade_aplicada_aberta_unica' })
      await cliente.query("update atividade_aplicada set estado = 'encerrada', encerrada_em = now() where id = $1", [original])
      const segunda = await aplicar(c, artefato, { ...JANELA, segunda_chamada_de: original })
      // Com a segunda chamada aberta, a professora ainda pode aplicar a atividade de novo à turma: a unicidade da original não conta a segunda chamada.
      const novaOriginal = await aplicar(c, artefato, JANELA)
      await cliente.query("update atividade_aplicada set estado = 'encerrada', encerrada_em = now() where id = $1", [novaOriginal])
      // A segunda chamada aberta é única por original; encerrada, abre-se outra.
      expect(await recusa(aplicar(c, artefato, { ...JANELA, segunda_chamada_de: original }))).toEqual({ codigo: '23505', restricao: 'atividade_aplicada_segunda_chamada_aberta_unica' })
      await cliente.query("update atividade_aplicada set estado = 'encerrada', encerrada_em = now() where id = $1", [segunda])
      const terceira = await aplicar(c, artefato, { ...JANELA, segunda_chamada_de: original })
      await cliente.query("update atividade_aplicada set estado = 'encerrada', encerrada_em = now() where id = $1", [terceira])
      // Outro artefato como "original": a FK composta recusa.
      const outroArtefato = await novoArtefato(c)
      expect(await recusa(aplicar(c, outroArtefato, { ...JANELA, segunda_chamada_de: original }))).toEqual({ codigo: '23503', restricao: 'atividade_aplicada_segunda_chamada_da_original_fk' })
      // Outra turma da mesma escola com o mesmo artefato: a FK composta recusa também pela turma.
      const serieId = await id('select serie_id as id from turma where id = $1', [c.turmaId])
      const outraTurma = await id("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºD') returning id", [c.escolaId, c.anoLetivoId, serieId])
      expect(await recusa(aplicar(c, artefato, { ...JANELA, turma_id: outraTurma, segunda_chamada_de: original }))).toMatchObject({ codigo: '23503' })
      // A que não é avaliativa não tem segunda chamada.
      expect(await recusa(aplicar(c, await novoArtefato(c), { avaliativa: false, segunda_chamada_de: original }))).toEqual({ codigo: '23514', restricao: 'atividade_aplicada_prova_so_na_avaliativa' })
    })
  })

  describe('a tentativa', () => {
    it('o envio é `aluno`, `limite` ou `encerramento` e só com a hora de envio; a contagem de saídas não é negativa', async () => {
      const c = await novoCenario()
      const aplicacao = await aplicar(c, await novoArtefato(c))
      const inserir = (alunoId: string, ajuste: Record<string, unknown>) => {
        const linha = { escola_id: c.escolaId, ano_letivo_id: c.anoLetivoId, atividade_aplicada_id: aplicacao, aluno_id: alunoId, ...ajuste }
        const colunas = Object.keys(linha)
        return cliente.query(`insert into tentativa_atividade (${colunas.join(', ')}) values (${colunas.map((_, i) => `$${String(i + 1)}`).join(', ')})`, Object.values(linha))
      }
      expect(await recusa(inserir(await novoUsuario(c.escolaId, 'aluno'), { envio: 'aluno', iniciada_em: ENVIADA.iniciada_em }))).toEqual({ codigo: '23514', restricao: 'tentativa_atividade_envio_valido' })
      expect(await recusa(inserir(await novoUsuario(c.escolaId, 'aluno'), { envio: 'professor', ...ENVIADA }))).toEqual({ codigo: '23514', restricao: 'tentativa_atividade_envio_valido' })
      expect(await recusa(inserir(await novoUsuario(c.escolaId, 'aluno'), { saidas_da_aba: -1 }))).toEqual({ codigo: '23514', restricao: 'tentativa_atividade_saidas_nao_negativas' })
      for (const envio of ['aluno', 'limite', 'encerramento']) await inserir(await novoUsuario(c.escolaId, 'aluno'), { envio, ...ENVIADA })
      // A tentativa de antes da F6 não tem envio nem limite, e a contagem começa em zero.
      const alunoAntigo = await novoUsuario(c.escolaId, 'aluno')
      await inserir(alunoAntigo, {})
      const { rows } = await cliente.query('select envio, limite_base_em, ordem, saidas_da_aba from tentativa_atividade where aluno_id = $1', [alunoAntigo])
      expect(rows).toEqual([{ envio: null, limite_base_em: null, ordem: null, saidas_da_aba: 0 }])
    })
  })

  describe('o tempo adicional, a extensão e a convocação', () => {
    it('o tempo adicional é 25, 50 ou 100, um por aluno e prova, concedido por pessoa da equipe da escola', async () => {
      const c = await novoCenario()
      const aplicacao = await aplicar(c, await novoArtefato(c))
      const conceder = (alunoId: string, percentual: number, concedidoPor = c.professorId) =>
        cliente.query('insert into tempo_adicional (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, percentual, concedido_por) values ($1, $2, $3, $4, $5, $6)', [c.escolaId, c.anoLetivoId, aplicacao, alunoId, percentual, concedidoPor])
      const alunoB = await novoUsuario(c.escolaId, 'aluno')
      for (const percentual of [0, 10, 30, 75, 101, 150]) expect(await recusa(conceder(alunoB, percentual)), String(percentual)).toEqual({ codigo: '23514', restricao: 'tempo_adicional_percentual_valido' })
      await conceder(c.alunoId, 25)
      await conceder(alunoB, 50)
      await conceder(await novoUsuario(c.escolaId, 'aluno'), 100)
      // Um por aluno e prova, e quem concede não pode ser aluno (o gatilho da equipe da escola).
      expect(await recusa(conceder(c.alunoId, 50))).toEqual({ codigo: '23505', restricao: 'tempo_adicional_um_por_aluno' })
      const { codigo } = await recusa(conceder(await novoUsuario(c.escolaId, 'aluno'), 25, c.alunoId))
      expect(codigo).toBe('23503')
      // A mesma pessoa em outra prova recebe de novo: a unicidade é por aplicação.
      const outraProva = await aplicar(c, await novoArtefato(c))
      await cliente.query('insert into tempo_adicional (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, percentual, concedido_por) values ($1, $2, $3, $4, 25, $5)', [c.escolaId, c.anoLetivoId, outraProva, c.alunoId, c.professorId])
    })

    it('a extensão vai de 1 a 120 minutos, para um aluno ou para a turma, e a chave é por aplicação', async () => {
      const c = await novoCenario()
      const aplicacao = await aplicar(c, await novoArtefato(c))
      const estender = (minutos: number, chave: string, alunoId: string | null, prova = aplicacao, concedidaPor = c.professorId) =>
        cliente.query('insert into extensao_de_tempo (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, minutos, concedida_por, chave) values ($1, $2, $3, $4, $5, $6, $7)', [c.escolaId, c.anoLetivoId, prova, alunoId, minutos, concedidaPor, chave])
      for (const minutos of [0, -5, 121, 500]) expect(await recusa(estender(minutos, randomUUID(), c.alunoId)), String(minutos)).toEqual({ codigo: '23514', restricao: 'extensao_de_tempo_minutos_validos' })
      await estender(1, randomUUID(), c.alunoId)
      await estender(120, randomUUID(), null)
      const chave = randomUUID()
      await estender(10, chave, c.alunoId)
      // Quem concede a extensão é da equipe da escola: um aluno como autor é recusado pelo gatilho.
      expect((await recusa(estender(5, randomUUID(), c.alunoId, aplicacao, c.alunoId))).codigo).toBe('23503')
      // O clique duplo e o reenvio: a mesma chave na mesma aplicação é uma extensão só; em outra aplicação, é outra.
      expect(await recusa(estender(10, chave, c.alunoId))).toEqual({ codigo: '23505', restricao: 'extensao_de_tempo_chave_por_aplicacao' })
      await estender(10, chave, c.alunoId, await aplicar(c, await novoArtefato(c)))
    })

    it('a convocação é uma por aluno e aplicação: outro aluno da mesma aplicação é convocado, e o mesmo aluno em outra aplicação também', async () => {
      const c = await novoCenario()
      const aplicacao = await aplicar(c, await novoArtefato(c))
      const convocar = (alunoId: string, prova = aplicacao) =>
        cliente.query('insert into convocado_da_segunda_chamada (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) values ($1, $2, $3, $4)', [c.escolaId, c.anoLetivoId, prova, alunoId])
      await convocar(c.alunoId)
      expect(await recusa(convocar(c.alunoId))).toEqual({ codigo: '23505', restricao: 'convocado_da_segunda_chamada_um_por_aluno' })
      await convocar(await novoUsuario(c.escolaId, 'aluno'))
      await convocar(c.alunoId, await aplicar(c, await novoArtefato(c)))
    })

    it('a linha de aluno não aponta para o ano de outra aplicação: o tempo adicional, a extensão e a convocação trazem o ano da própria aplicação', async () => {
      const c = await novoCenario()
      const aplicacao = await aplicar(c, await novoArtefato(c))
      const outroAno = await id("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2025, '2025-02-01', '2025-12-15', 'encerrado') returning id", [c.escolaId])
      const aluno = await novoUsuario(c.escolaId, 'aluno')
      const linhas: Array<[string, string, unknown[]]> = [
        ['tempo_adicional_aplicacao_do_ano_da_escola_fk', 'insert into tempo_adicional (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, percentual, concedido_por) values ($1, $2, $3, $4, 25, $5)', [c.professorId]],
        ['extensao_de_tempo_aplicacao_do_ano_da_escola_fk', 'insert into extensao_de_tempo (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, minutos, concedida_por, chave) values ($1, $2, $3, $4, 10, $5, $6)', [c.professorId, randomUUID()]],
        ['convocado_da_segunda_chamada_aplicacao_do_ano_da_escola_fk', 'insert into convocado_da_segunda_chamada (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) values ($1, $2, $3, $4)', []],
      ]
      for (const [restricao, instrucao, resto] of linhas) {
        expect(await recusa(cliente.query(instrucao, [c.escolaId, outroAno, aplicacao, aluno, ...resto])), restricao).toEqual({ codigo: '23503', restricao })
      }
    })
  })

  describe('a saída da aba e a eliminação do aluno', () => {
    async function comTentativa(c: Cenario, aplicacao: string, alunoId: string): Promise<void> {
      await cliente.query('insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) values ($1, $2, $3, $4)', [c.escolaId, c.anoLetivoId, aplicacao, alunoId])
    }
    const saida = (c: Cenario, aplicacao: string, alunoId: string, chave: string) =>
      cliente.query('insert into saida_da_aba (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, chave) values ($1, $2, $3, $4, $5)', [c.escolaId, c.anoLetivoId, aplicacao, alunoId, chave])

    it('a saída da aba tem a chave v4 e não repete, e só existe para quem tem tentativa', async () => {
      const c = await novoCenario()
      const aplicacao = await aplicar(c, await novoArtefato(c))
      await comTentativa(c, aplicacao, c.alunoId)
      // A v7 traz o instante da saída no prefixo: recusada. A v4 passa, uma vez só.
      expect(await recusa(saida(c, aplicacao, c.alunoId, '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'))).toEqual({ codigo: '23514', restricao: 'saida_da_aba_chave_v4' })
      const v4 = randomUUID()
      await saida(c, aplicacao, c.alunoId, v4)
      expect(await recusa(saida(c, aplicacao, c.alunoId, v4))).toEqual({ codigo: '23505', restricao: 'saida_da_aba_pk' })
      // Sem a tentativa do aluno na prova, não há onde contar a saída.
      expect(await recusa(saida(c, aplicacao, await novoUsuario(c.escolaId, 'aluno'), randomUUID()))).toEqual({ codigo: '23503', restricao: 'saida_da_aba_tentativa_fk' })
    })

    it('eliminar o aluno apaga em cascata a saída da aba, o tempo adicional, a extensão e a convocação dele, e não as do colega nem a extensão da turma', async () => {
      const c = await novoCenario()
      const colega = await novoUsuario(c.escolaId, 'aluno')
      const aplicacao = await aplicar(c, await novoArtefato(c))
      for (const aluno of [c.alunoId, colega]) {
        await comTentativa(c, aplicacao, aluno)
        await saida(c, aplicacao, aluno, randomUUID())
        await cliente.query('insert into tempo_adicional (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, percentual, concedido_por) values ($1, $2, $3, $4, 50, $5)', [c.escolaId, c.anoLetivoId, aplicacao, aluno, c.professorId])
        await cliente.query('insert into convocado_da_segunda_chamada (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) values ($1, $2, $3, $4)', [c.escolaId, c.anoLetivoId, aplicacao, aluno])
      }
      for (const aluno of [c.alunoId, colega, null]) {
        await cliente.query('insert into extensao_de_tempo (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, minutos, concedida_por, chave) values ($1, $2, $3, $4, 10, $5, $6)', [c.escolaId, c.anoLetivoId, aplicacao, aluno, c.professorId, randomUUID()])
      }
      const contagens = async () => {
        const resultado: Record<string, number> = {}
        for (const tabela of ['saida_da_aba', 'tempo_adicional', 'extensao_de_tempo', 'convocado_da_segunda_chamada']) {
          resultado[tabela] = Number((await cliente.query<{ total: string }>(`select count(*) as total from ${tabela} where atividade_aplicada_id = $1`, [aplicacao])).rows[0]?.total)
        }
        return resultado
      }
      expect(await contagens()).toEqual({ saida_da_aba: 2, tempo_adicional: 2, extensao_de_tempo: 3, convocado_da_segunda_chamada: 2 })
      await cliente.query('delete from usuario where escola_id = $1 and id = $2', [c.escolaId, c.alunoId])
      // Do aluno saíram a saída, o tempo adicional, a extensão e a convocação; do colega ficam as quatro, e a extensão da turma (sem aluno) também.
      expect(await contagens()).toEqual({ saida_da_aba: 1, tempo_adicional: 1, extensao_de_tempo: 2, convocado_da_segunda_chamada: 1 })
    })
  })

  describe('os índices que a rotina e o aluno leem', () => {
    it('os índices da prova existem com o escopo na frente: o das provas abertas por fim da janela, os do aluno e o do fim da indisponibilidade', async () => {
      const { rows } = await cliente.query<{ indexname: string; indexdef: string }>(
        `select indexname, indexdef from pg_indexes where indexname = any($1::text[]) order by indexname`,
        [['atividade_aplicada_prova_aberta_idx', 'tempo_adicional_aluno_idx', 'extensao_de_tempo_aluno_idx', 'convocado_da_segunda_chamada_aluno_idx', 'indisponibilidade_fim_idx']],
      )
      const definicao = Object.fromEntries(rows.map((linha) => [linha.indexname, linha.indexdef]))
      expect(Object.keys(definicao).sort()).toEqual(['atividade_aplicada_prova_aberta_idx', 'convocado_da_segunda_chamada_aluno_idx', 'extensao_de_tempo_aluno_idx', 'indisponibilidade_fim_idx', 'tempo_adicional_aluno_idx'])
      for (const tabela of ['tempo_adicional', 'extensao_de_tempo', 'convocado_da_segunda_chamada']) expect(definicao[`${tabela}_aluno_idx`], tabela).toContain('(escola_id, aluno_id)')
      expect(definicao['atividade_aplicada_prova_aberta_idx']).toContain('(fecha_em)')
      expect(definicao['atividade_aplicada_prova_aberta_idx']).toContain('avaliativa')
      expect(definicao['atividade_aplicada_prova_aberta_idx']).toContain("estado = 'aberta'")
      expect(definicao['indisponibilidade_fim_idx']).toContain('(fim)')
    })
  })

  describe('o pulso e a indisponibilidade', () => {
    it('o pulso é uma linha só, criada pela migration; a indisponibilidade tem começo antes do fim', async () => {
      const { rows } = await cliente.query<{ total: string }>('select count(*) as total from pulso_da_api')
      expect(Number(rows[0]?.total)).toBe(1)
      expect(await recusa(cliente.query('insert into pulso_da_api (ultimo_em) values (now())'))).toEqual({ codigo: '23505', restricao: 'pulso_da_api_linha_unica' })
      const inicio = '2026-12-01T10:00:00Z'
      expect(await recusa(cliente.query('insert into indisponibilidade (inicio, fim) values ($1, $1)', [inicio]))).toEqual({ codigo: '23514', restricao: 'indisponibilidade_ordenada' })
      expect(await recusa(cliente.query('insert into indisponibilidade (inicio, fim) values ($1, $2)', ['2026-12-01T10:05:00Z', inicio]))).toEqual({ codigo: '23514', restricao: 'indisponibilidade_ordenada' })
      const gravada = await id('insert into indisponibilidade (inicio, fim) values ($1, $2) returning id', [inicio, '2026-12-01T10:05:00Z'])
      await cliente.query('delete from indisponibilidade where id = $1', [gravada])
    })
  })
})
