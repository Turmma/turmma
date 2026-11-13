import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { createLogger } from '../log/logger.js'
import { migrate, PASTA_MIGRACOES, type MigrationConfig } from './migrate.js'
import { listaDeMateriaisAntesDaF4Schema } from './test/schema-antes-da-f4.js'

/**
 * A volta do código depois da F4 (ingestao-do-material, tarefa 8.0; Tech Spec, seções 3 e 5; `docs/runbook.md`, "Voltar o código depois da F4"). Um banco só para este teste, migrado
 * até a 0056 (a última da F4), com o que a F4 grava: material `processando` e `pronto`, edição em andamento e já feita, `falhou` pelos três códigos, de terceiro com licença, e jobs `pdf`.
 *
 * O SQL que o teste roda **é o do runbook**: ele é lido dos blocos `-- volta-da-f4` do documento, de modo que o procedimento que a pessoa de plantão copia é o que está provado. Depois do bloco 1
 * as linhas passam pela **cópia congelada** do contrato de antes da F4 (`test/schema-antes-da-f4.ts`): nenhum valor novo em `falha` e nada `processando` para a varredura do código anterior. O `licenciante` preenchido no material de terceiro é gravado pelo código novo, e quem o prova é a API (`apps/api/test/material-edicao.int.test.ts`, a herança; `material.int.test.ts`, o envio): este teste não escreve código de produção, e a linha que ele insere à mão nada diria sobre ele. O bloco 2,
 * do roll-forward, conserta o que o código anterior gravou durante a volta (material sem série, e de terceiro sem `licenca_id`).
 */

const logger = createLogger({ servico: 'volta-f4-teste', nivel: 'silent' })
const RUNBOOK = join(fileURLToPath(new URL('../../../../docs/runbook.md', import.meta.url)))

/** O bloco de SQL do runbook que abre com `-- volta-da-f4: <nome>`. */
function blocoDoRunbook(nome: string): string {
  const texto = readFileSync(RUNBOOK, 'utf8')
  const achado = new RegExp('```sql\\n-- volta-da-f4: ' + nome + '[^\\n]*\\n([\\s\\S]*?)```').exec(texto)
  if (achado?.[1] === undefined) throw new Error(`o runbook não tem o bloco "volta-da-f4: ${nome}"`)
  return achado[1]
}

describe('a volta do código depois da F4', () => {
  const nomeDoBanco = `f4_volta_${Date.now()}`
  const urlDoTeste = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoTeste)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoTeste.toString() })
  const scratch = new pg.Client({ connectionString: urlDoScratch.toString() })
  const configuracao: MigrationConfig = { url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 120_000, pasta: PASTA_MIGRACOES }

  async function id(instrucao: string, valores: unknown[]): Promise<string> {
    const { rows } = await scratch.query<{ id: string }>(instrucao, valores)
    const linha = rows[0]
    if (linha === undefined) throw new Error('insert sem linha')
    return linha.id
  }

  let contador = 0
  interface CasoDeMaterial {
    readonly estado: 'processando' | 'pronto' | 'falhou'
    readonly falha?: string
    readonly titularidade?: 'escola' | 'terceiro_com_licenca'
    readonly licenciante?: string
    readonly licencaId?: string
    readonly substituiId?: string
    readonly excluido?: boolean
    readonly comSerie?: boolean
  }

  let escolaId: string
  let disciplinaId: string
  let serieId: string
  let licencaId: string
  const casos: Record<string, string> = {}
  interface MaterialRow {
    readonly id: string
    readonly estado: string
    readonly falha: string | null
    readonly processado_em: Date | null
  }
  let antesDoBloco1: MaterialRow[]

  async function material(nome: string, caso: CasoDeMaterial): Promise<string> {
    contador += 1
    const idDoMaterial = await id(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenciante, licenca, declaracao, sha256, tamanho_bytes, estado, falha, paginas, licenca_id, substitui_id, enviado_em, excluido_em)
       values ($1, $2, $3, $4, $5, $6, true, md5($7::text) || md5($7::text || 'x'), 1000, $8, $9, $10, $11, $12, now() - interval '1 hour', $13) returning id`,
      [
        escolaId,
        disciplinaId,
        `Material ${String(contador)}`,
        caso.titularidade ?? 'escola',
        caso.licenciante ?? null,
        caso.titularidade === 'terceiro_com_licenca' ? 'licenca_comercial_autorizada' : 'autoria_da_escola',
        String(contador),
        caso.estado,
        caso.falha ?? null,
        caso.estado === 'pronto' ? 6 : null,
        caso.licencaId ?? null,
        caso.substituiId ?? null,
        caso.excluido === true ? new Date().toISOString() : null,
      ],
    )
    if (caso.comSerie !== false) await scratch.query('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [escolaId, idDoMaterial, serieId])
    casos[nome] = idDoMaterial
    return idDoMaterial
  }

  async function jobPdf(estado: string): Promise<string> {
    return id(
      `insert into job_registro (escola_id, fila, prioridade, tipo, dados, estado, concluido_em) values ($1, 'pdf', 3, 'material.extrair-pdf', '{}'::jsonb, $2, case when $2 in ('concluido', 'falhou') then now() end) returning id`,
      [escolaId, estado],
    )
  }

  /** Como o código anterior lê o material: as colunas que ele conhecia, só os não excluídos, e `trechos` contados. */
  async function comoOCodigoAnteriorLe(): Promise<unknown> {
    const { rows } = await scratch.query<Record<string, unknown>>(
      `select m.id, m.titulo, m.disciplina_id as "disciplinaId", m.titularidade, m.licenciante, m.licenca, m.estado, m.falha, m.paginas,
              (select count(*)::int from trecho t where t.escola_id = m.escola_id and t.material_id = m.id) as trechos, to_char(m.enviado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "enviadoEm"
         from material m where m.escola_id = $1 and m.excluido_em is null order by m.id`,
      [escolaId],
    )
    return { itens: rows }
  }

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate(configuracao, logger)
    await scratch.connect()
    const rede = await id("insert into rede (nome, tipo) values ('Rede da volta', 'independente') returning id", [])
    escolaId = await id("insert into escola (rede_id, nome, slug) values ($1, 'Escola da volta', 'volta-f4') returning id", [rede])
    disciplinaId = await id("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [escolaId])
    serieId = await id("insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [escolaId])
    licencaId = await id(
      "insert into licenca_de_material (escola_id, licenciante, cobertura, referencia, vigente_desde) values ($1, 'Editora X', 'Apostilas de teste', 'contrato sintético', '2020-01-01') returning id",
      [escolaId],
    )

    // O que a F4 grava: o material de terceiro com a licença e o `licenciante` copiado, a edição `processando` sobre ele, a já substituída, e as três falhas.
    const terceiro = await material('terceiro', { estado: 'pronto', titularidade: 'terceiro_com_licenca', licenciante: 'Editora X', licencaId })
    await material('edicaoEmAndamento', { estado: 'processando', titularidade: 'terceiro_com_licenca', licenciante: 'Editora X', licencaId, substituiId: terceiro })
    const antigo = await material('antigoSubstituido', { estado: 'pronto', excluido: true })
    const nova = await material('edicaoPronta', { estado: 'pronto', substituiId: antigo })
    await scratch.query('update material set substituido_por = $2 where id = $1', [antigo, nova])
    await material('processando', { estado: 'processando' })
    await material('processandoExcluido', { estado: 'processando', excluido: true })
    await material('arquivoInvalido', { estado: 'falhou', falha: 'arquivo_invalido' })
    await material('semTexto', { estado: 'falhou', falha: 'sem_texto' })
    await material('extracaoFalhou', { estado: 'falhou', falha: 'extracao_falhou' })
    await jobPdf('aguardando')
    await jobPdf('reservado')
    await jobPdf('ativo')
    await jobPdf('concluido')
    // O estado de antes e de depois do bloco 1 nasce uma vez, aqui: cada caso lê o que precisa e roda sozinho (`-t`).
    antesDoBloco1 = (await scratch.query<MaterialRow>('select id, estado, falha, processado_em from material where escola_id = $1', [escolaId])).rows
    await scratch.query(`begin; ${blocoDoRunbook('bloco 1')}; commit`)
  }, 240_000)

  afterAll(async () => {
    await scratch.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
  })

  it('o bloco 1 fecha o que está `processando` como `falhou` com `extracao_falhou` e `processado_em`, e conclui os jobs `pdf` que não terminaram; o excluído e o resto ficam como estavam', async () => {
    expect(antesDoBloco1.filter((linha) => linha.estado === 'processando')).toHaveLength(3)

    const { rows } = await scratch.query<MaterialRow>('select id, estado, falha, processado_em from material where escola_id = $1', [escolaId])
    const porId = new Map(rows.map((linha) => [linha.id, linha]))
    for (const nome of ['edicaoEmAndamento', 'processando']) {
      expect(porId.get(casos[nome] ?? ''), nome).toMatchObject({ estado: 'falhou', falha: 'extracao_falhou', processado_em: expect.any(Date) as Date })
    }
    // O excluído ficou `processando` (ninguém o vê, e o expurgo o leva com o objeto); o pronto e o que já tinha falhado, intactos.
    expect(porId.get(casos['processandoExcluido'] ?? '')).toMatchObject({ estado: 'processando', processado_em: null })
    expect(porId.get(casos['terceiro'] ?? '')).toMatchObject({ estado: 'pronto', falha: null })
    expect(porId.get(casos['semTexto'] ?? '')).toMatchObject({ estado: 'falhou', falha: 'sem_texto', processado_em: null })
    const { rows: jobs } = await scratch.query<{ estado: string; total: number }>("select estado, count(*)::int as total from job_registro where fila = 'pdf' group by estado order by estado")
    expect(jobs).toEqual([{ estado: 'concluido', total: 4 }])
  })

  it('depois do bloco 1, as linhas da F4 passam pela lista de materiais de antes da F4: nenhum valor novo em `falha`, e nada `processando` para o código anterior varrer', async () => {
    const lista = listaDeMateriaisAntesDaF4Schema.parse(await comoOCodigoAnteriorLe())

    expect(lista.itens.length).toBeGreaterThanOrEqual(7)
    for (const item of lista.itens) {
      if (item.falha !== null) expect(['arquivo_invalido', 'sem_texto', 'extracao_falhou']).toContain(item.falha)
      expect(item.estado === 'falhou', item.id).toBe(item.falha !== null)
      expect(item.estado, 'nada fica `processando` para o código anterior varrer').not.toBe('processando')
    }
    // A edição e o substituído: o código anterior os lista como material comum, e o substituído (excluído) nem aparece.
    expect(lista.itens.map((item) => item.id)).toContain(casos['edicaoPronta'])
    expect(lista.itens.map((item) => item.id)).not.toContain(casos['antigoSubstituido'])
  })

  it('um `falha` novo no lugar de `extracao_falhou` no bloco 1 é recusado pelo banco (`material_falha_valida`): o bloco não pode gravar outro código que os três que o código anterior conhece', async () => {
    const adulterado = blocoDoRunbook('bloco 1').replace("falha = 'extracao_falhou'", "falha = 'arquivo_ausente'")
    expect(adulterado).not.toBe(blocoDoRunbook('bloco 1'))
    await material('novoProcessando', { estado: 'processando' })
    await expect(scratch.query(`begin; ${adulterado}; commit`)).rejects.toMatchObject({ code: '23514' })
    await scratch.query('rollback')
    await scratch.query('delete from material_serie where escola_id = $1 and material_id = $2', [escolaId, casos['novoProcessando']])
    await scratch.query('delete from material where id = $1', [casos['novoProcessando']])
  })

  it('o bloco 2, no roll-forward: o material que o código anterior gravou sem série ganha todas as da escola, e o de terceiro sem `licenca_id` é ligado à licença do mesmo licenciante, ou a uma nova; o que já tinha fica', async () => {
    // O que o código anterior grava durante a volta: sem `material_serie`, sem `licenca_id`, e o `licenciante` só na linha.
    const outraSerie = await id("insert into serie (escola_id, etapa, ano) values ($1, 'em', 3) returning id", [escolaId])
    const daLicencaExistente = await material('duranteAVolta1', { estado: 'pronto', titularidade: 'terceiro_com_licenca', licenciante: 'Editora X', comSerie: false })
    const daLicencaNova = await material('duranteAVolta2', { estado: 'pronto', titularidade: 'terceiro_com_licenca', licenciante: 'Editora Nova', comSerie: false })
    const propria = await material('duranteAVolta3', { estado: 'pronto', comSerie: false })
    const antesDoTerceiro = await scratch.query<{ licenca_id: string }>('select licenca_id from material where id = $1', [casos['terceiro']])

    await scratch.query(`begin; ${blocoDoRunbook('bloco 2')}; commit`)

    const { rows } = await scratch.query<{ id: string; licenca_id: string | null }>('select id, licenca_id from material where id = any($1::uuid[])', [[daLicencaExistente, daLicencaNova, propria, casos['terceiro']]])
    const porId = new Map(rows.map((linha) => [linha.id, linha.licenca_id]))
    expect(porId.get(daLicencaExistente)).toBe(licencaId)
    expect(porId.get(propria)).toBeNull()
    expect(porId.get(casos['terceiro'] ?? '')).toBe(antesDoTerceiro.rows[0]?.licenca_id)
    const nova = await scratch.query<{ id: string; licenciante: string; referencia: string; vigente_ate: string | null }>(
      "select id, licenciante, referencia, vigente_ate from licenca_de_material where escola_id = $1 and licenciante = 'Editora Nova'",
      [escolaId],
    )
    expect(nova.rows).toEqual([expect.objectContaining({ referencia: 'registrada durante a volta do código', vigente_ate: null })])
    expect(porId.get(daLicencaNova)).toBe(nova.rows[0]?.id)
    // A licença que já existia continua uma só.
    expect((await scratch.query<{ total: number }>("select count(*)::int as total from licenca_de_material where escola_id = $1 and licenciante = 'Editora X'", [escolaId])).rows[0]?.total).toBe(1)

    const series = await scratch.query<{ material_id: string; serie_id: string }>('select material_id, serie_id from material_serie where escola_id = $1 and material_id = any($2::uuid[]) order by serie_id', [escolaId, [daLicencaExistente, daLicencaNova, propria]])
    for (const alvo of [daLicencaExistente, daLicencaNova, propria]) expect(series.rows.filter((linha) => linha.material_id === alvo).map((linha) => linha.serie_id).toSorted()).toEqual([serieId, outraSerie].toSorted())
    // O que já tinha série não ganha outra.
    expect((await scratch.query<{ total: number }>('select count(*)::int as total from material_serie where escola_id = $1 and material_id = $2', [escolaId, casos['terceiro']])).rows[0]?.total).toBe(1)

    // Rodar de novo não duplica nada: o roll-forward pode ser repetido.
    await scratch.query(`begin; ${blocoDoRunbook('bloco 2')}; commit`)
    expect((await scratch.query<{ total: number }>('select count(*)::int as total from material_serie where escola_id = $1 and material_id = $2', [escolaId, propria])).rows[0]?.total).toBe(2)
    expect((await scratch.query<{ total: number }>("select count(*)::int as total from licenca_de_material where escola_id = $1 and licenciante = 'Editora Nova'", [escolaId])).rows[0]?.total).toBe(1)
  })
})
