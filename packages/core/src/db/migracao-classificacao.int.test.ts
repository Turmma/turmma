import { FUNCAO_DA_TAREFA_DE_IA, TAREFAS_DE_IA } from '@educa/shared'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { createLogger } from '../log/logger.js'
import { migrate, PASTA_MIGRACOES, type MigrationConfig } from './migrate.js'

/**
 * A migration `0062_execucao_classificacao` (classificacao-bncc, tarefa 3.0; Tech Spec, seção 3, "Migrations", passo 1) sobre dado que já existia: um banco só para este teste, migrado até a 0061
 * (o que o código anterior conhece), com uma execução de antes, e depois migrado até a 0062 pelo mesmo `migrate` do serviço de migração. Prova a promessa da Tech Spec: a função e a tarefa novas
 * entram nos checks de `execucao_agente`, `consumo_ia` e `suspensao_de_funcao`, o ano letivo da execução passa a aceitar nulo só na `classificar_secoes`, o que já estava lá segue lá, e todo
 * check termina validado (o `VALIDATE` varreu as linhas de antes).
 */

const ULTIMA_ANTES_DA_CLASSIFICACAO = '0061_secao_do_material_backfill'
const DA_CLASSIFICACAO = '0062_execucao_classificacao'

const logger = createLogger({ servico: 'migrar-classificacao-teste', nivel: 'silent' })

describe('a migration da classificação do material sobre execução de antes', () => {
  const nomeDoBanco = `classificacao_migracao_${String(Date.now())}`
  const urlDoTeste = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoTeste)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoTeste.toString() })
  const scratch = new pg.Client({ connectionString: urlDoScratch.toString() })
  const pastas: string[] = []
  let escolaId = ''
  let anoLetivoId = ''
  let coordenadorId = ''
  let execucaoDeAntes = ''

  const configuracao = (pasta: string): MigrationConfig => ({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 120_000, pasta })

  /** A pasta de migrations só até `tag` (inclusive): copia a do repositório e tira do diário, e da pasta, o que vem depois. */
  function pastaAte(tag: string): string {
    const pasta = mkdtempSync(join(tmpdir(), 'educa-migrar-classificacao-'))
    pastas.push(pasta)
    cpSync(PASTA_MIGRACOES, pasta, { recursive: true })
    const diario = JSON.parse(readFileSync(join(pasta, 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> }
    const indice = diario.entries.findIndex((entrada) => entrada.tag === tag)
    expect(indice, `${tag} está no diário`).toBeGreaterThan(0)
    writeFileSync(join(pasta, 'meta', '_journal.json'), JSON.stringify({ ...diario, entries: diario.entries.slice(0, indice + 1) }))
    for (const entrada of diario.entries.slice(indice + 1)) rmSync(join(pasta, `${entrada.tag}.sql`))
    return pasta
  }

  const gravarExecucao = async (tarefa: string, funcao: string, ano: string | null): Promise<string> =>
    (
      await scratch.query<{ id: string }>(
        `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, $3, $4, null, gen_random_uuid(), $5::jsonb) returning id`,
        [escolaId, ano, funcao, tarefa, JSON.stringify({ tarefa })],
      )
    ).rows[0]?.id ?? ''
  const gravarConsumo = (funcao: string) =>
    scratch.query(
      `insert into consumo_ia (escola_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado)
       values ($1, 'classificar_secoes', $2, 'rapido', 'openai_compat', 'modelo-de-teste', '2026-11-17.1', 120, 80, 35, false, 1, 'concluida')`,
      [escolaId, funcao],
    )
  const suspender = (funcao: string) => scratch.query('insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, $2, $3)', [escolaId, funcao, coordenadorId])
  /** O texto do erro, para o teste dizer qual check recusou. */
  const inserir = async (consulta: string, parametros: string[] = []): Promise<string> => (await scratch.query<{ id: string }>(consulta, parametros)).rows[0]?.id ?? ''
  const recusa = async (promessa: Promise<unknown>): Promise<string> => promessa.then(() => 'aceitou', (erro: Error) => erro.message)

  // Antes da 0062, o banco recusa a tarefa, a função e o ano nulo: é o que o código anterior espera.
  const recusasDeAntes = async (): Promise<{ classificar: string; funcaoNova: string; anoNulo: string; consumo: string; suspensao: string }> => ({
    classificar: await recusa(gravarExecucao('classificar_secoes', 'classificacao_do_material', anoLetivoId)),
    funcaoNova: await recusa(gravarExecucao('propor_ferramenta', 'classificacao_do_material', anoLetivoId)),
    anoNulo: await recusa(gravarExecucao('propor_ferramenta', 'conversa_e_ferramentas', null)),
    consumo: await recusa(gravarConsumo('classificacao_do_material')),
    suspensao: await recusa(suspender('classificacao_do_material')),
  })

  let antes: { classificar: string; funcaoNova: string; anoNulo: string; consumo: string; suspensao: string }
  let validados: Array<{ conname: string; convalidated: boolean }>
  let anoAceitaNulo: string

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate(configuracao(pastaAte(ULTIMA_ANTES_DA_CLASSIFICACAO)), logger)
    await scratch.connect()
    const rede = await inserir("insert into rede (nome, tipo) values ('Rede da migração da classificação', 'independente') returning id")
    escolaId = await inserir("insert into escola (rede_id, nome, slug) values ($1, 'Escola da classificação', 'classificacao-a') returning id", [rede])
    anoLetivoId = await inserir("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaId])
    const conta = await inserir("insert into conta (email) values ('coordenacao@classificacao.invalid') returning id")
    coordenadorId = await inserir("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'coordenador', 'Coordenação') returning id", [escolaId, conta])
    // O dado de antes: uma execução da conversa, com ano.
    execucaoDeAntes = await gravarExecucao('propor_ferramenta', 'conversa_e_ferramentas', anoLetivoId)
    antes = await recusasDeAntes()
    await migrate(configuracao(pastaAte(DA_CLASSIFICACAO)), logger)
    anoAceitaNulo = (await scratch.query<{ is_nullable: string }>("select is_nullable from information_schema.columns where table_name = 'execucao_agente' and column_name = 'ano_letivo_id'")).rows[0]?.is_nullable ?? ''
    validados = (
      await scratch.query<{ conname: string; convalidated: boolean }>(
        `select conname, convalidated from pg_constraint where conname in ('consumo_ia_funcao_valida', 'suspensao_de_funcao_funcao_valida', 'execucao_agente_funcao_valida', 'execucao_agente_tarefa_valida',
           'execucao_agente_tarefa_da_funcao', 'execucao_agente_ano_so_nulo_na_classificacao') order by conname`,
      )
    ).rows
  }, 240_000)

  afterAll(async () => {
    await scratch.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
    for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true })
  })

  it('antes da migration o banco recusa a tarefa, a função e o ano nulo, nos cinco lugares: o teste parte do banco que o código anterior conhece', () => {
    // A linha viola mais de um check, e o Postgres acusa o primeiro: a tarefa nova com a função nova cai em qualquer um dos três.
    expect(antes.classificar).toMatch(/execucao_agente_(funcao_valida|tarefa_valida|tarefa_da_funcao)/u)
    expect(antes.funcaoNova).toMatch(/execucao_agente_(funcao_valida|tarefa_da_funcao)/u)
    expect(antes.anoNulo).toContain('ano_letivo_id')
    expect(antes.consumo).toContain('consumo_ia_funcao_valida')
    expect(antes.suspensao).toContain('suspensao_de_funcao_funcao_valida')
  })

  it('o ano letivo da execução passa a aceitar nulo, e só a `classificar_secoes` o usa: a das outras seis tarefas recusa no check novo', async () => {
    expect(anoAceitaNulo).toBe('YES')
    await expect(gravarExecucao('classificar_secoes', 'classificacao_do_material', null)).resolves.toBeDefined()
    await expect(gravarExecucao('classificar_secoes', 'classificacao_do_material', anoLetivoId)).resolves.toBeDefined()
    for (const tarefa of TAREFAS_DE_IA.filter((nome) => nome !== 'classificar_secoes')) {
      expect(await recusa(gravarExecucao(tarefa, FUNCAO_DA_TAREFA_DE_IA[tarefa], null)), tarefa).toContain('execucao_agente_ano_so_nulo_na_classificacao')
    }
  })

  it('a tarefa e a função entram no par e só nele; o par errado e o desconhecido continuam recusados', async () => {
    expect(await recusa(gravarExecucao('classificar_secoes', 'conversa_e_ferramentas', null))).toContain('execucao_agente_tarefa_da_funcao')
    expect(await recusa(gravarExecucao('propor_ferramenta', 'classificacao_do_material', anoLetivoId))).toContain('execucao_agente_tarefa_da_funcao')
    expect(await recusa(gravarExecucao('classificar_secoes', 'classificacao_inventada', null))).toMatch(/execucao_agente_(funcao_valida|tarefa_da_funcao)/u)
    // A tarefa inventada viola o par e a lista de tarefas, e o Postgres acusa o primeiro.
    expect(await recusa(gravarExecucao('tarefa_inventada', 'classificacao_do_material', anoLetivoId))).toMatch(/execucao_agente_(tarefa_valida|tarefa_da_funcao)/u)
  })

  it('o consumo e a suspensão aceitam a função nova e recusam a desconhecida', async () => {
    await expect(gravarConsumo('classificacao_do_material')).resolves.toBeDefined()
    await expect(suspender('classificacao_do_material')).resolves.toBeDefined()
    expect(await recusa(gravarConsumo('classificacao_inventada'))).toContain('consumo_ia_funcao_valida')
    expect(await recusa(suspender('classificacao_inventada'))).toContain('suspensao_de_funcao_funcao_valida')
  })

  it('só expande: a execução de antes segue lá, intacta, e o que o código anterior gravava continua aceito', async () => {
    const { rows } = await scratch.query<{ funcao: string; tarefa: string; ano_letivo_id: string }>('select funcao, tarefa, ano_letivo_id from execucao_agente where id = $1', [execucaoDeAntes])
    expect(rows).toEqual([{ funcao: 'conversa_e_ferramentas', tarefa: 'propor_ferramenta', ano_letivo_id: anoLetivoId }])
    for (const tarefa of TAREFAS_DE_IA.filter((nome) => nome !== 'classificar_secoes')) {
      await expect(gravarExecucao(tarefa, FUNCAO_DA_TAREFA_DE_IA[tarefa], anoLetivoId), tarefa).resolves.toBeDefined()
    }
  })

  it('os seis checks terminam validados: o `VALIDATE` varreu as linhas que já existiam', () => {
    expect(validados.map((check) => check.conname)).toEqual([
      'consumo_ia_funcao_valida',
      'execucao_agente_ano_so_nulo_na_classificacao',
      'execucao_agente_funcao_valida',
      'execucao_agente_tarefa_da_funcao',
      'execucao_agente_tarefa_valida',
      'suspensao_de_funcao_funcao_valida',
    ])
    expect(validados.every((check) => check.convalidated)).toBe(true)
  })
})
