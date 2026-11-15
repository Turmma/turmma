import { QUEUE_NAMES } from '@educa/shared'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { createLogger } from '../log/logger.js'
import { migrate, PASTA_MIGRACOES, type MigrationConfig } from './migrate.js'

/**
 * A migration `0058_fila_ferramenta` (reengenharia-continuacao, tarefa 3.0; Tech Spec, seção 3) sobre dado que já existia: um banco só para este teste, migrado até a 0057 (o que
 * o código anterior conhece), com um job e uma configuração de escola de antes, e depois migrado até a 0058 pelo mesmo `migrate` do serviço de migração. Prova a promessa da Tech Spec:
 * os dois checks, o da fila de `job_registro` e o das vagas da escola, passam a aceitar `ferramenta`, continuam recusando fila que não existe, e a migration só expande (a linha de
 * antes segue lá e o código anterior continua gravando).
 */

const ULTIMA_ANTES_DA_FERRAMENTA = '0057_auditoria_material_recusado'
const DA_FERRAMENTA = '0058_fila_ferramenta'

const logger = createLogger({ servico: 'migrar-ferramenta-teste', nivel: 'silent' })

describe('a migration da fila `ferramenta` sobre dado da fila de antes', () => {
  const nomeDoBanco = `ferramenta_migracao_${String(Date.now())}`
  const urlDoTeste = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoTeste)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoTeste.toString() })
  const scratch = new pg.Client({ connectionString: urlDoScratch.toString() })
  const pastas: string[] = []
  let escolaId = ''

  const configuracao = (pasta: string): MigrationConfig => ({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 120_000, pasta })

  /** A pasta de migrations só até `tag` (inclusive): copia a do repositório e tira do diário, e da pasta, o que vem depois. */
  function pastaAte(tag: string): string {
    const pasta = mkdtempSync(join(tmpdir(), 'educa-migrar-ferramenta-'))
    pastas.push(pasta)
    cpSync(PASTA_MIGRACOES, pasta, { recursive: true })
    const diario = JSON.parse(readFileSync(join(pasta, 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> }
    const indice = diario.entries.findIndex((entrada) => entrada.tag === tag)
    expect(indice, `${tag} está no diário`).toBeGreaterThan(0)
    writeFileSync(join(pasta, 'meta', '_journal.json'), JSON.stringify({ ...diario, entries: diario.entries.slice(0, indice + 1) }))
    for (const entrada of diario.entries.slice(indice + 1)) rmSync(join(pasta, `${entrada.tag}.sql`))
    return pasta
  }

  const gravarJob = (fila: string) =>
    scratch.query("insert into job_registro (escola_id, tipo, fila, prioridade, nao_urgente, dados) values ($1, 'sintetico', $2, 1, false, '{}'::jsonb)", [escolaId, fila])
  const configurarVagas = (vagas: unknown) =>
    scratch.query('insert into configuracao_operacional_escola (escola_id, vagas) values ($1, $2::jsonb) on conflict (escola_id) do update set vagas = excluded.vagas', [escolaId, JSON.stringify(vagas)])
  const total = async (tabela: 'job_registro' | 'configuracao_operacional_escola') => Number((await scratch.query<{ total: string }>(`select count(*) as total from ${tabela}`)).rows[0]?.total)

  let antes: { jobFerramenta: string; vagasFerramenta: string; jobs: number; configuracoes: number }
  let validados: Array<{ conname: string; convalidated: boolean }>

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate(configuracao(pastaAte(ULTIMA_ANTES_DA_FERRAMENTA)), logger)
    await scratch.connect()
    const rede = (await scratch.query<{ id: string }>("insert into rede (nome, tipo) values ('Rede da migração da ferramenta', 'independente') returning id")).rows[0]?.id
    escolaId = (await scratch.query<{ id: string }>("insert into escola (rede_id, nome, slug) values ($1, 'Escola da ferramenta', 'ferramenta-a') returning id", [rede])).rows[0]?.id ?? ''
    // O dado de antes: um job na `interativa` e a escola com `vagas.interativa` configurada.
    await gravarJob('interativa')
    await configurarVagas({ interativa: 3 })
    // Antes da 0058, o banco recusa a fila nova: é o que o código anterior espera.
    const recusa = async (promessa: Promise<unknown>): Promise<string> => promessa.then(() => 'aceitou', (erro: Error) => erro.message)
    antes = {
      jobFerramenta: await recusa(gravarJob('ferramenta')),
      vagasFerramenta: await recusa(configurarVagas({ ferramenta: 2 })),
      jobs: await total('job_registro'),
      configuracoes: await total('configuracao_operacional_escola'),
    }
    await configurarVagas({ interativa: 3 })
    await migrate(configuracao(pastaAte(DA_FERRAMENTA)), logger)
    validados = (await scratch.query<{ conname: string; convalidated: boolean }>("select conname, convalidated from pg_constraint where conname in ('job_registro_fila_valida', 'configuracao_operacional_vagas_validas')")).rows
  }, 240_000)

  afterAll(async () => {
    await scratch.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
    for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true })
  })

  it('antes da migration o banco recusa `ferramenta` nos dois checks: o teste parte do banco que o código anterior conhece', () => {
    expect(antes.jobFerramenta).toContain('job_registro_fila_valida')
    expect(antes.vagasFerramenta).toContain('configuracao_operacional_vagas_validas')
  })

  it('o check da fila de `job_registro` aceita toda fila de `QUEUE_NAMES`, a `ferramenta` entre elas, e recusa fila que não existe', async () => {
    expect(QUEUE_NAMES).toContain('ferramenta')
    for (const fila of QUEUE_NAMES) await expect(gravarJob(fila), fila).resolves.toBeDefined()
    await expect(gravarJob('prioritaria')).rejects.toThrow('job_registro_fila_valida')
  })

  it('o check das vagas aceita `vagas.ferramenta` inteiro e positivo, e recusa fila que não existe, zero, fração e texto', async () => {
    await expect(configurarVagas({ ferramenta: 2 })).resolves.toBeDefined()
    await expect(configurarVagas({ interativa: 10, ferramenta: 4, normal: 5, lote: 2, pdf: 2 })).resolves.toBeDefined()
    for (const vagas of [{ prioritaria: 1 }, { ferramenta: 0 }, { ferramenta: 2.5 }, { ferramenta: '4' }]) {
      await expect(configurarVagas(vagas), JSON.stringify(vagas)).rejects.toThrow('configuracao_operacional_vagas_validas')
    }
  })

  it('só expande: a linha de antes segue lá e o que o código anterior gravava continua aceito', async () => {
    expect(antes.jobs).toBe(1)
    expect(antes.configuracoes).toBe(1)
    expect(await total('job_registro')).toBeGreaterThanOrEqual(antes.jobs)
    for (const fila of ['interativa', 'normal', 'lote', 'pdf']) await expect(gravarJob(fila), fila).resolves.toBeDefined()
    await expect(configurarVagas({ interativa: 3, normal: 1, lote: 1, pdf: 1 })).resolves.toBeDefined()
  })

  it('os dois checks terminam validados: o `VALIDATE` varreu as linhas que já existiam', () => {
    expect(validados.map((check) => check.conname).sort()).toEqual(['configuracao_operacional_vagas_validas', 'job_registro_fila_valida'])
    expect(validados.every((check) => check.convalidated)).toBe(true)
  })
})
