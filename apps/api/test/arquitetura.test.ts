import 'reflect-metadata'
import * as nucleo from '@educa/nucleo'
import { CHAVES_DE_RETENCAO, CLASSIFICACAO_DAS_TABELAS, ErrorCode, COLUNAS_FORA_DO_ARQUIVO } from '@educa/shared'
import { Controller, Get, SetMetadata, type ExecutionContext, type Type } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { getTableName, is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { EntradaDeOperacao, RotaDeOperacao } from '../src/operacao/marcadores.js'
import { OperacaoModule } from '../src/operacao/operacao.module.js'
import { PainelController } from '../src/operacao/painel/painel.controller.js'
import { PainelRepository } from '../src/operacao/painel/painel.repository.js'
import { configuracaoDeTeste } from './configuracao-de-teste.js'
import { controladoresDoModulo, ROTAS_COM_SESSAO_DE_OPERADOR, ROTAS_DO_PAINEL, rotasDe, rotasDeOperacaoSemGuarda, rotasForaDaCerca, type RotaRegistrada } from './rotas-registradas.js'

const RAIZ = fileURLToPath(new URL('../../../', import.meta.url))
const ESTE_ARQUIVO = 'apps/api/test/arquitetura.test.ts'

interface Arquivo {
  caminho: string
  texto: string
}

/** Todo `.ts`, `.tsx`, `.mts`, `.js` e `.mjs` de código e de teste, sem `dist` e sem `node_modules`. */
function arquivosDoRepositorio(): Arquivo[] {
  return ['apps', 'packages', 'infra', 'tools', 'e2e'].flatMap((pasta) =>
    readdirSync(join(RAIZ, pasta), { recursive: true, encoding: 'utf8' })
      .filter((arquivo) => /\.(ts|tsx|mts|js|mjs)$/.test(arquivo))
      .filter((arquivo) => !arquivo.split(sep).some((parte) => parte === 'node_modules' || parte === 'dist'))
      .map((arquivo) => {
        const caminho = relative(RAIZ, join(RAIZ, pasta, arquivo)).split(sep).join('/')
        return { caminho, texto: readFileSync(join(RAIZ, caminho), 'utf8') }
      }),
  )
}

/**
 * As três classes que a regra 10, item 9, cerca (X5, 12.0). O `guarda:camadas` olha quem **importa o arquivo** da classe; o
 * reexport feito de dentro da zona (um `export { X }` no `painel.service.ts`, numa ponte de `ciclo-de-vida/` ou de `sessao/`)
 * deixa qualquer arquivo importá-la por outro caminho, sem violação nenhuma. Aqui se olha o **nome**: código de produção fora
 * da zona não cita a classe, por qual arquivo quer que a tenha achado. Teste e fixture ficam de fora (mudança aceita da 12.0).
 */
const ZONAS_DAS_CLASSES_CERCADAS: readonly { classe: string; uso: RegExp; zona: readonly string[] }[] = [
  { classe: 'ResolucaoDeTenantRepository', uso: /\bResolucaoDeTenantRepository\b|resolucao-de-tenant\.repository/, zona: ['apps/api/src/sessao/'] },
  { classe: 'ContaGlobalRepository', uso: /\bContaGlobalRepository\b|conta-global\.repository|@educa\/nucleo\/conta-global/, zona: ['apps/api/src/sessao/', 'packages/nucleo/src/ciclo-de-vida/'] },
  // A zona do painel é o arquivo do service e o do repository, e não a pasta `operacao/painel/`.
  { classe: 'PainelRepository', uso: /\bPainelRepository\b|painel\.repository/, zona: ['apps/api/src/operacao/painel/painel.service.ts', 'apps/api/src/operacao/painel/painel.repository.ts'] },
]

/** `classe: caminho`, de cada arquivo de produção fora da zona dela que a cita no código (comentário não conta). */
function usosForaDaZona(arquivos: readonly Arquivo[]): string[] {
  return ZONAS_DAS_CLASSES_CERCADAS.flatMap(({ classe, uso, zona }) =>
    arquivos
      .filter((arquivo) => !deTeste(arquivo.caminho) && !arquivo.caminho.includes('/__fixtures__/'))
      .filter((arquivo) => !zona.some((permitido) => arquivo.caminho.startsWith(permitido)))
      .filter((arquivo) => uso.test(semComentarios(arquivo.texto)))
      .map((arquivo) => `${classe}: ${arquivo.caminho}`),
  )
}

describe('arquitetura: o nome das classes cercadas só aparece dentro da zona de cada uma, também pelo reexport (X5, 12.0)', () => {
  it('a varredura enxerga o código: acha as três classes dentro da zona delas', () => {
    const arquivos = arquivosDoRepositorio()
    expect(arquivos.length).toBeGreaterThan(100)
    for (const { classe, uso, zona } of ZONAS_DAS_CLASSES_CERCADAS) {
      const dentro = arquivos.filter((arquivo) => zona.some((permitido) => arquivo.caminho.startsWith(permitido)) && uso.test(semComentarios(arquivo.texto)))
      expect(dentro.length, classe).toBeGreaterThan(0)
    }
  })

  it('nenhum código de produção fora da zona cita a ResolucaoDeTenantRepository, a ContaGlobalRepository nem o PainelRepository', () => {
    expect(usosForaDaZona(arquivosDoRepositorio())).toEqual([])
  })

  it('reprova quem usa a classe por uma ponte de dentro da zona, em apps, packages, tools e infra, e deixa passar a zona, o teste, a fixture e o comentário', () => {
    const fora = [
      // O reexport pelo service do painel, por uma ponte de `ciclo-de-vida/` e por uma de `sessao/`: o arquivo da classe não aparece no import.
      { caminho: 'apps/api/src/estrutura/turma/vaza.ts', texto: "import { PainelRepository } from '../../operacao/painel/painel.service.js'" },
      { caminho: 'packages/nucleo/src/retencao/vaza.ts', texto: "import { ContaGlobalRepository } from '../ciclo-de-vida/ponte.js'" },
      { caminho: 'tools/vaza.ts', texto: "import { ResolucaoDeTenantRepository } from '../apps/api/src/sessao/login/ponte.js'" },
      { caminho: 'infra/vaza.ts', texto: "import { ContaGlobalRepository } from '../apps/api/src/sessao/login/ponte.js'" },
      // Outro arquivo da pasta do painel não é a zona.
      { caminho: 'apps/api/src/operacao/painel/relatorio.ts', texto: "import { PainelRepository } from './painel.repository.js'" },
    ]
    const dentro = [
      { caminho: 'apps/api/src/sessao/login/ponte.ts', texto: "export { ResolucaoDeTenantRepository } from '../tenant/resolucao-de-tenant.repository.js'" },
      { caminho: 'packages/nucleo/src/ciclo-de-vida/ponte.ts', texto: "export { ContaGlobalRepository } from './conta-global.repository.js'" },
      { caminho: 'apps/api/src/operacao/painel/painel.service.ts', texto: "import { PainelRepository } from './painel.repository.js'" },
    ]
    const inocentes = [
      { caminho: 'apps/api/test/painel-leitura.int.test.ts', texto: "import { PainelRepository } from '../src/operacao/painel/painel.repository.js'" },
      { caminho: 'tools/guardas/__fixtures__/camadas/infra/painel-import.ts', texto: "import { PainelRepository } from '../apps/api/src/operacao/painel/painel.repository.js'" },
      { caminho: 'apps/api/src/estrutura/turma/turma.service.ts', texto: "/** Antes vinha da `ContaGlobalRepository`. */\n// e do @educa/nucleo/conta-global" },
      { caminho: 'apps/api/src/telemetria/metricas.ts', texto: "const chave = 'metrica.conta-global.limpas'" },
    ]
    expect(usosForaDaZona([...fora, ...dentro, ...inocentes])).toEqual([
      'ResolucaoDeTenantRepository: tools/vaza.ts',
      'ContaGlobalRepository: packages/nucleo/src/retencao/vaza.ts',
      'ContaGlobalRepository: infra/vaza.ts',
      'PainelRepository: apps/api/src/estrutura/turma/vaza.ts',
      'PainelRepository: apps/api/src/operacao/painel/relatorio.ts',
    ])
  })
})

/**
 * F3, tarefa 1.0 (Tech Spec do F3, seção 6; regra 10, item 9): as escritas na conta global que o ciclo de vida faz saíram
 * da resolução de tenant para a `ContaGlobalRepository`, em `packages/nucleo/src/ciclo-de-vida`, quando o ciclo de vida
 * foi para o `nucleo`. A exceção da `Conta` (`docs/modelo-de-dados.md`, regras transversais, item 1) passa a aceitar dois
 * caminhos: o módulo `sessao` da API e a pasta do ciclo de vida. A classe não sai pelo barrel do pacote nem pelo
 * subcaminho do ciclo de vida, só pelo `@educa/nucleo/conta-global`. Quem a importa é a regra `cerca-conta-global` do
 * `guarda:camadas` (X5, 12.0), por import direto; o que os barris trazem em execução, o reexport que ela não vê, é conferido aqui.
 */
describe('arquitetura: a conta global só pelo módulo sessao e pelo ciclo de vida (F3, tarefa 1.0)', () => {
  it('nem o barrel do @educa/nucleo nem o subcaminho do ciclo de vida exportam a ContaGlobalRepository, com o nome dela ou outro', async () => {
    const { ContaGlobalRepository } = await import('@educa/nucleo/conta-global')
    const cicloDeVida = await import('@educa/nucleo/ciclo-de-vida')
    for (const [nome, modulo] of [
      ['@educa/nucleo', nucleo],
      ['@educa/nucleo/ciclo-de-vida', cicloDeVida],
    ] as const) {
      expect(Object.keys(modulo), nome).not.toContain('ContaGlobalRepository')
      expect(Object.values(modulo), nome).not.toContain(ContaGlobalRepository)
    }
    // O subcaminho do ciclo de vida é o que a API e o worker usam: o serviço sai por ele.
    expect(Object.keys(cicloDeVida)).toContain('CicloDeVidaService')
  })

  it('nem o barrel de credencial/ exporta a ResolucaoDeTenantRepository nem a ContaGlobalRepository, com o nome dela ou outro (33.0)', async () => {
    const credencial = await import('../src/credencial/index.js')
    const { ContaGlobalRepository } = await import('@educa/nucleo/conta-global')
    const { ResolucaoDeTenantRepository } = await import('../src/sessao/tenant/resolucao-de-tenant.repository.js')
    // O barrel é lido de verdade: sem isto, um import que falhasse em silêncio deixaria as duas conferências abaixo verdes.
    expect(Object.keys(credencial)).toContain('HashDeSenha')
    for (const [nome, classe] of [
      ['ResolucaoDeTenantRepository', ResolucaoDeTenantRepository],
      ['ContaGlobalRepository', ContaGlobalRepository],
    ] as const) {
      expect(Object.keys(credencial), nome).not.toContain(nome)
      expect(Object.values(credencial), nome).not.toContain(classe)
    }
  })

  it('nem o barrel de sessao/ exporta a ResolucaoDeTenantRepository nem a ContaGlobalRepository, com o nome dela ou outro, e a tenant/ só entra pelo AcessoDaSala e pelas sessões sintéticas (34.0)', async () => {
    const sessao = await import('../src/sessao/index.js')
    const { ContaGlobalRepository } = await import('@educa/nucleo/conta-global')
    const { ResolucaoDeTenantRepository } = await import('../src/sessao/tenant/resolucao-de-tenant.repository.js')
    const { AcessoDaSala } = await import('../src/sessao/tenant/acesso-da-sala.js')
    // O barrel é lido de verdade: sem isto, um import que falhasse em silêncio deixaria as conferências abaixo verdes.
    expect(Object.keys(sessao)).toContain('SessaoModule')
    expect(Object.values(sessao)).toContain(AcessoDaSala)
    // O índice reexporta por nome (nunca `export *`), e da `tenant/` só entram os dois arquivos que o resto da API usa.
    const textoDoIndice = semComentarios(readFileSync(join(RAIZ, 'apps/api/src/sessao/index.ts'), 'utf8'))
    expect(textoDoIndice).not.toMatch(/export\s+(type\s+)?\*/)
    expect([...new Set([...textoDoIndice.matchAll(/from ['"]\.\/tenant\/([^'"]+)['"]/g)].map((achado) => achado[1]))].sort()).toEqual(['acesso-da-sala.js', 'sessoes-sinteticas.js'])
    // O depcruise não vê o reexport em dois passos (`export * from './tenant/index.js'`): o que o módulo traz em execução é que vale.
    for (const [nome, classe] of [
      ['ResolucaoDeTenantRepository', ResolucaoDeTenantRepository],
      ['ContaGlobalRepository', ContaGlobalRepository],
    ] as const) {
      expect(Object.keys(sessao), nome).not.toContain(nome)
      expect(Object.values(sessao), nome).not.toContain(classe)
    }
  })
})

/**
 * I1 (Tech Spec da A0b, seção 6; regra 10, item 9): a leitura entre escolas do painel mora num repository só, o
 * `PainelRepository`, com exatamente três métodos, cada um `@SemEscopo` com a justificativa do painel. Um quarto método
 * sem escopo é mudança da spec. Que só o `painel.service.ts` o use é a regra `cerca-painel-repository` do `guarda:camadas`
 * (X5, 12.0).
 */
describe('arquitetura: a leitura entre escolas mora só no PainelRepository, com três métodos @SemEscopo (I1)', () => {
  it('os métodos são exatamente redes, escolas e uso, cada um @SemEscopo com a justificativa que cita o painel', () => {
    const metodos = Object.getOwnPropertyNames(PainelRepository.prototype).filter((nome) => nome !== 'constructor')
    expect(metodos.toSorted()).toEqual(['escolas', 'redes', 'uso'])
    for (const metodo of metodos) expect(nucleo.justificativaSemEscopo(PainelRepository, metodo), metodo).toMatch(/^painel do operador: /)
  })
})

/**
 * C45 (Tech Spec da A0, seção 6): as seis tabelas da operação não têm `escola_id`, e o que impede que isso vire atalho
 * é que só o `OperadorRepository` as toca, e ele não toca outra tabela; e o expurgo (tarefa 9.0), que só apaga, pelo
 * prazo, o acesso, a sessão e o convite da operação. Ficam de fora o schema delas, o barrel do pacote, as migrations
 * (`.sql`, que não são varridas) e os testes.
 */
const REPOSITORY_DA_OPERACAO = 'apps/api/src/operacao/operador/operador.repository.ts'
const EXPURGO_DA_OPERACAO = 'packages/nucleo/src/retencao/expurgo-de-acesso.repository.ts'
const QUEM_PODE_TOCAR_A_OPERACAO = [REPOSITORY_DA_OPERACAO, EXPURGO_DA_OPERACAO]
/** O que o expurgo pode tocar da operação: nunca `operador`, `codigo_recuperacao_operador` nem `auditoria_operacao`. */
const EXPURGAVEIS_DA_OPERACAO = ['acesso_operacao', 'convite_operador', 'sessao_operador']
const FORA_DA_VARREDURA = ['packages/nucleo/src/db/schema/operador.ts', 'packages/nucleo/src/db/schema/suboperador.ts', 'packages/nucleo/src/db/schema/incidente.ts', 'packages/nucleo/src/index.ts']
const TABELAS_DA_OPERACAO = [nucleo.operador, nucleo.codigoRecuperacaoOperador, nucleo.conviteOperador, nucleo.sessaoOperador, nucleo.acessoOperacao, nucleo.auditoriaOperacao]

/** Nome exportado pelo `@educa/nucleo` → nome físico, de toda tabela que o pacote exporta. */
const TABELAS_EXPORTADAS = new Map<string, string>(
  Object.entries(nucleo as Record<string, unknown>).flatMap(([nome, valor]): [string, string][] => (is(valor, PgTable) ? [[nome, getTableName(valor)]] : [])),
)
const FISICOS_DA_OPERACAO = new Set<string>(TABELAS_DA_OPERACAO.map((tabela) => getTableName(tabela)))
const EXPORTS_DA_OPERACAO = new Set([...TABELAS_EXPORTADAS].filter(([, fisico]) => FISICOS_DA_OPERACAO.has(fisico)).map(([nome]) => nome))
const GRUPO_DO_OPERADOR: GrupoDeTabelas = { exports: EXPORTS_DA_OPERACAO, fisicos: FISICOS_DA_OPERACAO, schema: 'operador' }

/**
 * F3, tarefa 8.0 (Tech Spec do F3, seção 6): o suboperador e a ligação dele com a escola. `suboperador` não tem `escola_id`
 * (exceção do item 1 de `docs/modelo-de-dados.md`), então o que impede que vire atalho é a cerca: só o
 * `OperacaoPrivacidadeRepository` escreve nas duas, e só o `SuboperadorDaEscolaRepository` as lê, sem escrever.
 */
const ESCRITOR_DO_SUBOPERADOR = 'apps/api/src/ops/operacao-privacidade.repository.ts'
const LEITOR_DO_SUBOPERADOR = 'packages/nucleo/src/titular/suboperador-da-escola.repository.ts'
const QUEM_PODE_TOCAR_O_SUBOPERADOR = [ESCRITOR_DO_SUBOPERADOR, LEITOR_DO_SUBOPERADOR]
const TABELAS_DO_SUBOPERADOR = [nucleo.suboperador, nucleo.suboperadorEscola]
const FISICOS_DO_SUBOPERADOR = new Set<string>(TABELAS_DO_SUBOPERADOR.map((tabela) => getTableName(tabela)))
const EXPORTS_DO_SUBOPERADOR = new Set([...TABELAS_EXPORTADAS].filter(([, fisico]) => FISICOS_DO_SUBOPERADOR.has(fisico)).map(([nome]) => nome))
const GRUPO_DO_SUBOPERADOR: GrupoDeTabelas = { exports: EXPORTS_DO_SUBOPERADOR, fisicos: FISICOS_DO_SUBOPERADOR, schema: 'suboperador' }

/**
 * F3, tarefa 9.0 (Tech Spec do F3, seção 6): o incidente e a seção de cada escola. `incidente` não tem `escola_id` (exceção do item 1
 * de `docs/modelo-de-dados.md`), então a cerca é: o `OperacaoPrivacidadeRepository` escreve nas duas (`ops:incidente`), o
 * `IncidenteDaEscolaRepository` lê as duas pela escola do contexto e só escreve na seção da escola (a confirmação), e o expurgo de
 * acesso apaga o `incidente`, que leva as seções em cascata.
 */
const LEITOR_DO_INCIDENTE = 'packages/nucleo/src/titular/incidente-da-escola.repository.ts'
const QUEM_PODE_TOCAR_O_INCIDENTE = [ESCRITOR_DO_SUBOPERADOR, LEITOR_DO_INCIDENTE, EXPURGO_DA_OPERACAO]
const TABELAS_DO_INCIDENTE = [nucleo.incidente, nucleo.incidenteEscola]
const FISICOS_DO_INCIDENTE = new Set<string>(TABELAS_DO_INCIDENTE.map((tabela) => getTableName(tabela)))
const EXPORTS_DO_INCIDENTE = new Set([...TABELAS_EXPORTADAS].filter(([, fisico]) => FISICOS_DO_INCIDENTE.has(fisico)).map(([nome]) => nome))
const GRUPO_DO_INCIDENTE: GrupoDeTabelas = { exports: EXPORTS_DO_INCIDENTE, fisicos: FISICOS_DO_INCIDENTE, schema: 'incidente' }
/** O escritor da operação de privacidade escreve nas duas famílias: o suboperador e o incidente, e em nenhuma outra tabela. */
const GRUPO_DO_ESCRITOR_DA_PRIVACIDADE: GrupoDeTabelas = {
  exports: new Set([...EXPORTS_DO_SUBOPERADOR, ...EXPORTS_DO_INCIDENTE]),
  fisicos: new Set([...FISICOS_DO_SUBOPERADOR, ...FISICOS_DO_INCIDENTE]),
  schema: 'suboperador',
}

/** Toda tabela criada nas migrations, inclusive as que o pacote não exporta (`auditoria`). */
const TABELAS_FISICAS: readonly string[] = readdirSync(join(RAIZ, 'packages/nucleo/drizzle'))
  .filter((arquivo) => arquivo.endsWith('.sql'))
  .flatMap((arquivo) => [...readFileSync(join(RAIZ, 'packages/nucleo/drizzle', arquivo), 'utf8').matchAll(/CREATE TABLE "(\w+)"/g)].map((criacao) => criacao[1] ?? ''))

/** As tabelas que o texto cita em SQL: depois de `from`, `into`, `update`, `join`, `table` ou `truncate`. */
function tabelasEmSql(texto: string): string[] {
  return [...texto.matchAll(/\b(?:from|into|update|join|table|truncate)\s+(?:"?public"?\.)?"?(\w+)"?/gi)].map((uso) => uso[1] ?? '').filter((nome) => TABELAS_FISICAS.includes(nome))
}

/** Um grupo de tabelas da operação: os nomes que o pacote exporta, os nomes físicos, e o arquivo do schema dele. */
interface GrupoDeTabelas {
  readonly exports: ReadonlySet<string>
  readonly fisicos: ReadonlySet<string>
  /** O nome do arquivo do schema, sem extensão: `operador`, `suboperador`. */
  readonly schema: string
}

/** Os nomes que o texto importa (ou reexporta) do `@educa/nucleo` ou do schema da operação, sem o `as` e o `type`. */
function nomesImportados(texto: string): string[] {
  return [...texto.matchAll(/(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](@educa\/nucleo|[^'"]*schema\/(?:operador|suboperador|incidente)(?:\.js|\.ts)?)['"]/g)].flatMap((importacao) =>
    (importacao[1] ?? '')
      .split(',')
      .map((nome) => nome.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0] ?? '')
      .filter((nome) => nome !== ''),
  )
}

/** As tabelas do grupo que o arquivo alcança: por nome importado, por namespace do pacote, pelo arquivo do schema ou em SQL. */
function usosDoGrupo(texto: string, grupo: GrupoDeTabelas): string[] {
  const porImport = nomesImportados(texto).filter((nome) => grupo.exports.has(nome))
  const namespaces = [...texto.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]@educa\/nucleo['"]/g)].map((uso) => uso[1] ?? '')
  const porNamespace = namespaces.flatMap((ns) => [...texto.matchAll(new RegExp(`\\b${ns}\\.(\\w+)`, 'g'))].map((uso) => uso[1] ?? '').filter((nome) => grupo.exports.has(nome)))
  const peloArquivo = new RegExp(`['"][^'"]*db\\/schema\\/${grupo.schema}(?:\\.js|\\.ts)?['"]`).test(texto) ? [`schema/${grupo.schema}`] : []
  const porSql = tabelasEmSql(texto).filter((nome) => grupo.fisicos.has(nome))
  return [...porImport, ...porNamespace, ...peloArquivo, ...porSql]
}

/** As seis tabelas da operação que o arquivo alcança. */
const usosDaOperacao = (texto: string): string[] => usosDoGrupo(texto, GRUPO_DO_OPERADOR)

/**
 * Teste e apoio de teste (`*.test.ts`, o que mora numa pasta `test/`, como a bancada de operadores da tarefa 4.0, e o
 * e2e, cujo apoio cria e apaga o operador que entra pela tela na tarefa 10.0).
 */
function deTeste(caminho: string): boolean {
  return /\.test\.ts$/.test(caminho) || /(^|\/)test\//.test(caminho) || /^e2e\//.test(caminho)
}

function quemTocaAOperacao(arquivos: readonly Arquivo[]): string[] {
  return arquivos
    .filter((arquivo) => !deTeste(arquivo.caminho) && !FORA_DA_VARREDURA.includes(arquivo.caminho))
    .filter((arquivo) => usosDaOperacao(arquivo.texto).length > 0)
    .map((arquivo) => arquivo.caminho)
}

/** O que o repository toca fora do grupo dele: tabela importada do pacote que não é do grupo, e tabela de fora em SQL. */
function tabelasDeForaNoRepository(texto: string, grupo: GrupoDeTabelas = GRUPO_DO_OPERADOR): string[] {
  const importadas = nomesImportados(texto).filter((nome) => TABELAS_EXPORTADAS.has(nome) && !grupo.exports.has(nome))
  const emSql = tabelasEmSql(texto).filter((nome) => !grupo.fisicos.has(nome))
  return [...importadas, ...emSql]
}

describe('arquitetura: as seis tabelas da operação só pelo OperadorRepository (C45)', () => {
  it('a lista das seis vem do pacote, e a varredura conhece todas as tabelas das migrations', () => {
    expect([...FISICOS_DA_OPERACAO].sort()).toEqual(['acesso_operacao', 'auditoria_operacao', 'codigo_recuperacao_operador', 'convite_operador', 'operador', 'sessao_operador'])
    expect(EXPORTS_DA_OPERACAO.size).toBe(6)
    for (const tabela of [...FISICOS_DA_OPERACAO, 'auditoria', 'conta', 'escola', 'sessao']) expect(TABELAS_FISICAS).toContain(tabela)
  })

  it('só o OperadorRepository e o expurgo tocam as seis tabelas, por import, por namespace, pelo arquivo do schema ou pelo nome em SQL', () => {
    // Cada entrada da lista é um arquivo que existe: um caminho que mudasse de lugar deixaria a lista valendo para nada.
    for (const caminho of QUEM_PODE_TOCAR_A_OPERACAO) expect(existsSync(join(RAIZ, caminho)), caminho).toBe(true)
    expect(quemTocaAOperacao(arquivosDoRepositorio()).sort()).toEqual([...QUEM_PODE_TOCAR_A_OPERACAO].sort())
  })

  it('o expurgo toca da operação só o acesso, a sessão e o convite, e continua com dois métodos @SemEscopo (C45, tarefa 9.0)', () => {
    const expurgo = arquivosDoRepositorio().find((arquivo) => arquivo.caminho === EXPURGO_DA_OPERACAO)
    expect(expurgo && [...new Set(usosDaOperacao(expurgo.texto))].sort()).toEqual(EXPURGAVEIS_DA_OPERACAO)
    // Os alvos do job são exatamente as tabelas que o arquivo cita: nenhuma a mais passa pelo `apagarLoteVencido`.
    expect(nucleo.ALVOS_DO_EXPURGO_DE_ACESSO.filter((alvo) => FISICOS_DA_OPERACAO.has(alvo)).sort()).toEqual(EXPURGAVEIS_DA_OPERACAO)
    const metodos = Object.getOwnPropertyNames(nucleo.ExpurgoDeAcessoRepository.prototype).filter((metodo) => metodo !== 'constructor')
    const marcados = metodos.filter((metodo) => nucleo.justificativaSemEscopo(nucleo.ExpurgoDeAcessoRepository, metodo) !== undefined)
    expect(marcados.sort()).toEqual(['apagarLoteVencido', 'limparLoteDeContasSemUso'])
    // A justificativa do `apagarLoteVencido` cobre as tabelas da equipe, que não têm escola (9.2).
    expect(nucleo.justificativaSemEscopo(nucleo.ExpurgoDeAcessoRepository, 'apagarLoteVencido')).toMatch(/operação Turmma.*não têm escola/)
  })

  it('a checagem do expurgo reprova o que apaga operador, código de recuperação ou auditoria da operação', () => {
    const tocadas = (texto: string) => [...new Set(usosDaOperacao(texto))].sort()
    const permitido = 'sql`delete from acesso_operacao`; sql`delete from convite_operador`; sql`delete from sessao_operador`'
    expect(tocadas(permitido)).toEqual(EXPURGAVEIS_DA_OPERACAO)
    for (const proibida of ['operador', 'codigo_recuperacao_operador', 'auditoria_operacao']) {
      expect(tocadas(`${permitido}; sql\`delete from ${proibida} where em < now()\``), proibida).toEqual([...EXPURGAVEIS_DA_OPERACAO, proibida].sort())
    }
  })

  it('o OperadorRepository não toca nenhuma outra tabela', () => {
    const repository = arquivosDoRepositorio().find((arquivo) => arquivo.caminho === REPOSITORY_DA_OPERACAO)
    expect(repository && usosDaOperacao(repository.texto).length).toBeGreaterThan(0)
    expect(repository && tabelasDeForaNoRepository(repository.texto)).toEqual([])
  })

  it('a varredura pega o uso em qualquer forma, e não confunde variável ou comentário com tabela', () => {
    const fora = [
      { caminho: 'apps/api/src/painel/painel.repository.ts', texto: "import { and, operador, sql } from '@educa/nucleo'" },
      { caminho: 'apps/api/src/painel/alias.ts', texto: "import { type Banco, sessaoOperador as sessoes } from '@educa/nucleo'" },
      { caminho: 'apps/api/src/painel/ns.ts', texto: "import * as n from '@educa/nucleo'\nn.conviteOperador" },
      { caminho: 'apps/api/src/painel/reexporta.ts', texto: "export { auditoriaOperacao } from '@educa/nucleo'" },
      { caminho: 'apps/api/src/painel/schema.ts', texto: "import { operador as o } from '../../../../packages/nucleo/src/db/schema/operador.js'" },
      { caminho: 'apps/worker/src/sql.ts', texto: "pool.query('delete from acesso_operacao where em < now()')" },
      { caminho: 'apps/worker/src/sql-aspas.ts', texto: 'sql`update "public"."codigo_recuperacao_operador" set x = 1`' },
      { caminho: 'apps/worker/src/sql-maiuscula.ts', texto: "pool.query('SELECT 1 FROM operador')" },
    ]
    const inocentes = [
      { caminho: 'apps/api/src/ops/escola.ts', texto: "const operador = lerOperador(ambiente)\nimport { FORMATO_OPERADOR } from '@educa/nucleo'\n// o operador da equipe" },
      { caminho: 'apps/api/src/sessao/x.repository.ts', texto: "pool.query('select 1 from sessao where escola_id = $1')" },
      { caminho: 'apps/api/src/ops/operador.test.ts', texto: "pool.query('delete from operador')" },
      { caminho: 'apps/api/test/sessao-de-operador.ts', texto: "pool.query('insert into sessao_operador (operador_id) values ($1)')" },
      { caminho: 'packages/nucleo/src/index.ts', texto: "export { operador } from './db/schema/operador.js'" },
    ]
    expect(quemTocaAOperacao([...fora, ...inocentes])).toEqual(fora.map((arquivo) => arquivo.caminho))
  })

  it('reprova o repository que importa outra tabela do pacote ou cita outra tabela em SQL', () => {
    expect(tabelasDeForaNoRepository("import { conta, operador } from '@educa/nucleo'")).toEqual(['conta'])
    expect(tabelasDeForaNoRepository("sql`select 1 from escola`; sql`insert into auditoria (x)`; sql`update operador set x = 1`")).toEqual(['escola', 'auditoria'])
  })
})

/** Quem, fora de teste e do schema, alcança `suboperador` ou `suboperador_escola`: por import, por namespace, pelo arquivo do schema ou em SQL. */
function quemTocaOSuboperador(arquivos: readonly Arquivo[]): string[] {
  return arquivos
    .filter((arquivo) => !deTeste(arquivo.caminho) && !FORA_DA_VARREDURA.includes(arquivo.caminho))
    .filter((arquivo) => usosDoGrupo(arquivo.texto, GRUPO_DO_SUBOPERADOR).length > 0)
    .map((arquivo) => arquivo.caminho)
}

/** O código sem comentário, para procurar escrita: citar `insert` num docblock não é escrever. */
const ESCREVE_NO_BANCO = /\.(?:insert|update|delete)\s*\(|\b(?:insert\s+into|update|delete\s+from)\s+"?\w+"?/i

describe('arquitetura: o suboperador só pelo OperacaoPrivacidadeRepository, que escreve, e pelo SuboperadorDaEscolaRepository, que lê (F3, tarefa 8.0)', () => {
  it('as duas tabelas vêm do pacote e das migrations, e nenhuma é uma das seis do operador', () => {
    expect([...FISICOS_DO_SUBOPERADOR].sort()).toEqual(['suboperador', 'suboperador_escola'])
    expect(EXPORTS_DO_SUBOPERADOR.size).toBe(2)
    for (const tabela of FISICOS_DO_SUBOPERADOR) {
      expect(TABELAS_FISICAS).toContain(tabela)
      expect(FISICOS_DA_OPERACAO.has(tabela)).toBe(false)
    }
  })

  it('só os dois repositórios tocam as duas tabelas, por import, por namespace, pelo arquivo do schema ou pelo nome em SQL', () => {
    for (const caminho of QUEM_PODE_TOCAR_O_SUBOPERADOR) expect(existsSync(join(RAIZ, caminho)), caminho).toBe(true)
    expect(quemTocaOSuboperador(arquivosDoRepositorio()).sort()).toEqual([...QUEM_PODE_TOCAR_O_SUBOPERADOR].sort())
  })

  it('o repositório da escola não escreve nas duas tabelas, nem em outra: só lê', () => {
    const arquivos = arquivosDoRepositorio()
    const leitor = arquivos.find((arquivo) => arquivo.caminho === LEITOR_DO_SUBOPERADOR)
    expect(leitor && usosDoGrupo(leitor.texto, GRUPO_DO_SUBOPERADOR).length).toBeGreaterThan(0)
    expect(leitor && ESCREVE_NO_BANCO.test(semComentarios(leitor.texto))).toBe(false)
    expect(leitor && tabelasDeForaNoRepository(leitor.texto, GRUPO_DO_SUBOPERADOR)).toEqual([])
    // Correção da 8.0: o leitor também lê a `escola` do contexto (a vigência nunca é anterior a ela). O detector acima não enxerga
    // import por caminho relativo, então a lista dos schemas importados é conferida aqui: uma tabela nova passaria sem ninguém ver.
    // Limite: a regex só enxerga import relativo `…/db/schema/<tabela>`; import por `@educa/nucleo` ou por barrel passaria. Se o repositório
    // passar a importar assim, amplie a regex.
    const schemasImportados = [...semComentarios(leitor?.texto ?? '').matchAll(/from\s+['"](?:\.\.?\/)+db\/schema\/(\w+)(?:\.js|\.ts)?['"]/g)].map((importacao) => importacao[1])
    expect(schemasImportados.toSorted()).toEqual(['escola', 'suboperador'])
    // O escritor, ao contrário, escreve (a varredura enxerga a escrita) e não toca outra tabela.
    const escritor = arquivos.find((arquivo) => arquivo.caminho === ESCRITOR_DO_SUBOPERADOR)
    expect(escritor && ESCREVE_NO_BANCO.test(semComentarios(escritor.texto))).toBe(true)
    expect(escritor && tabelasDeForaNoRepository(escritor.texto, GRUPO_DO_ESCRITOR_DA_PRIVACIDADE)).toEqual([])
    expect(escritor && usosDaOperacao(escritor.texto)).toEqual([])
  })

  it('o único @SemEscopo é o encerramento das ligações em todas as escolas; a leitura da escola não tem nenhum', async () => {
    const escritor = await import('../src/ops/operacao-privacidade.repository.js')
    const metodos = Object.getOwnPropertyNames(escritor.OperacaoPrivacidadeRepository.prototype).filter((metodo) => metodo !== 'constructor')
    expect(metodos.toSorted()).toEqual(['cadastrar', 'encerrar', 'encerrarLigacoes', 'ligarEscola', 'ligarEscolaAoIncidente', 'registrarIncidente', 'travarVigente'])
    expect(metodos.filter((metodo) => nucleo.justificativaSemEscopo(escritor.OperacaoPrivacidadeRepository, metodo) !== undefined)).toEqual(['encerrarLigacoes'])
    const leitura = Object.getOwnPropertyNames(nucleo.SuboperadorDaEscolaRepository.prototype).filter((metodo) => metodo !== 'constructor')
    expect(leitura).toEqual(['daEscola'])
    expect(nucleo.justificativaSemEscopo(nucleo.SuboperadorDaEscolaRepository, 'daEscola')).toBeUndefined()
  })

  it('a varredura pega o uso em qualquer forma, e não confunde variável, comentário nem teste com tabela', () => {
    const fora = [
      { caminho: 'apps/api/src/privacidade/privacidade.service.ts', texto: "import { and, suboperador } from '@educa/nucleo'" },
      { caminho: 'apps/api/src/privacidade/alias.ts', texto: "import { type Banco, suboperadorEscola as ligacao } from '@educa/nucleo'" },
      { caminho: 'apps/api/src/privacidade/ns.ts', texto: "import * as n from '@educa/nucleo'\nn.suboperador" },
      { caminho: 'apps/api/src/privacidade/reexporta.ts', texto: "export { suboperadorEscola } from '@educa/nucleo'" },
      { caminho: 'apps/api/src/privacidade/schema.ts', texto: "import { suboperador as s } from '../../../../packages/nucleo/src/db/schema/suboperador.js'" },
      { caminho: 'apps/worker/src/sql.ts', texto: "pool.query('delete from suboperador_escola where fim < now()')" },
      { caminho: 'apps/worker/src/sql-aspas.ts', texto: 'sql`update "public"."suboperador" set fim = now()`' },
    ]
    const inocentes = [
      { caminho: 'apps/api/src/ops/suboperador.ts', texto: "import { OperacaoPrivacidadeRepository } from './operacao-privacidade.repository.js'\nconst suboperador = lerPedido()\n// a tabela suboperador" },
      { caminho: 'apps/api/test/suboperador.int.test.ts', texto: "pool.query('select 1 from suboperador')" },
      { caminho: 'packages/nucleo/src/index.ts', texto: "export { suboperador } from './db/schema/suboperador.js'" },
      { caminho: 'packages/nucleo/src/db/schema/suboperador.ts', texto: 'export const suboperador = pgTable()' },
    ]
    expect(quemTocaOSuboperador([...fora, ...inocentes])).toEqual(fora.map((arquivo) => arquivo.caminho))
  })

  it('reprova o repositório de leitura que escreve, e o de escrita que toca outra tabela', () => {
    for (const escrita of ['await this.banco.insert(suboperador).values(x)', 'await this.banco.update(suboperadorEscola).set(x)', 'await this.banco.delete(suboperador)', "sql`delete from suboperador`", "sql`insert into suboperador_escola (x) values (1)`"]) {
      expect(ESCREVE_NO_BANCO.test(semComentarios(escrita)), escrita).toBe(true)
    }
    expect(ESCREVE_NO_BANCO.test(semComentarios('/** não faz insert nem update */\nawait this.banco.select().from(suboperador)'))).toBe(false)
    expect(tabelasDeForaNoRepository("import { suboperador, conta } from '@educa/nucleo'", GRUPO_DO_SUBOPERADOR)).toEqual(['conta'])
    expect(tabelasDeForaNoRepository("sql`select 1 from sessao`; sql`select 1 from suboperador`", GRUPO_DO_SUBOPERADOR)).toEqual(['sessao'])
    // O OperadorRepository, que não é do grupo, também não pode tocar o suboperador.
    expect(tabelasDeForaNoRepository("import { operador, suboperador } from '@educa/nucleo'")).toEqual(['suboperador'])
  })
})

describe('arquitetura: o Compartilhamento é só regra, e o banco é do CompartilhamentoRepository (F3, tarefa 12.0)', () => {
  it('compartilhamento.ts não consulta o banco', () => {
    const regra = arquivosDoRepositorio().find((arquivo) => arquivo.caminho === 'packages/nucleo/src/titular/compartilhamento.ts')
    expect(regra).toBeDefined()
    const texto = semComentarios(regra?.texto ?? '')
    expect(texto).not.toMatch(/\.(execute|select|insert|update|delete)\(/)
    expect(texto).not.toMatch(/from\s+['"]drizzle-orm['"]/)
    expect(texto).not.toMatch(/db\/schema\//)
  })

  it('o repository lê a escola do contexto e nenhum método a recebe', () => {
    const leitor = arquivosDoRepositorio().find((arquivo) => arquivo.caminho === 'packages/nucleo/src/titular/compartilhamento.repository.ts')
    expect(leitor).toBeDefined()
    const texto = semComentarios(leitor?.texto ?? '')
    expect(texto).toContain('exigirEscolaDoContexto()')
    expect(texto).not.toMatch(/\(\s*escolaId\s*[:,)]/)
    expect(texto).not.toMatch(/,\s*escolaId\s*:\s*string/)
  })
})

/** Quem, fora de teste e do schema, alcança `incidente` ou `incidente_escola`: por import, por namespace, pelo arquivo do schema ou em SQL. */
function quemTocaOIncidente(arquivos: readonly Arquivo[]): string[] {
  return arquivos
    .filter((arquivo) => !deTeste(arquivo.caminho) && !FORA_DA_VARREDURA.includes(arquivo.caminho))
    .filter((arquivo) => usosDoGrupo(arquivo.texto, GRUPO_DO_INCIDENTE).length > 0)
    .map((arquivo) => arquivo.caminho)
}

/** As chamadas de escrita do código sem comentário, com a tabela de cada uma: `.insert(incidente)`, `.update(incidenteEscola)`. */
const escritasDoCodigo = (texto: string): string[] => [...semComentarios(texto).matchAll(/\.(?:insert|update|delete)\s*\(\s*\w+\s*\)/g)].map((escrita) => escrita[0].replace(/\s+/g, ''))

describe('arquitetura: o incidente só pelo OperacaoPrivacidadeRepository, pelo IncidenteDaEscolaRepository e pelo expurgo de acesso (F3, tarefa 9.0)', () => {
  it('as duas tabelas vêm do pacote e das migrations, e nenhuma é do operador nem do suboperador', () => {
    expect([...FISICOS_DO_INCIDENTE].sort()).toEqual(['incidente', 'incidente_escola'])
    expect(EXPORTS_DO_INCIDENTE.size).toBe(2)
    for (const tabela of FISICOS_DO_INCIDENTE) {
      expect(TABELAS_FISICAS).toContain(tabela)
      expect(FISICOS_DA_OPERACAO.has(tabela)).toBe(false)
      expect(FISICOS_DO_SUBOPERADOR.has(tabela)).toBe(false)
    }
  })

  it('só o escritor, o leitor da escola e o expurgo tocam as duas tabelas, por import, por namespace, pelo arquivo do schema ou pelo nome em SQL', () => {
    for (const caminho of QUEM_PODE_TOCAR_O_INCIDENTE) expect(existsSync(join(RAIZ, caminho)), caminho).toBe(true)
    expect(quemTocaOIncidente(arquivosDoRepositorio()).sort()).toEqual([...QUEM_PODE_TOCAR_O_INCIDENTE].sort())
  })

  it('o expurgo toca só o `incidente` (a seção sai em cascata), e apaga; o escritor insere nas duas e nunca apaga nem altera', () => {
    const arquivos = arquivosDoRepositorio()
    const expurgo = arquivos.find((arquivo) => arquivo.caminho === EXPURGO_DA_OPERACAO)
    expect(expurgo && [...new Set(usosDoGrupo(expurgo.texto, GRUPO_DO_INCIDENTE))]).toEqual(['incidente'])
    const escritor = arquivos.find((arquivo) => arquivo.caminho === ESCRITOR_DO_SUBOPERADOR)
    const escritas = escritasDoCodigo(escritor?.texto ?? '').filter((escrita) => /incidente/i.test(escrita))
    expect(escritas.toSorted()).toEqual(['.insert(incidente)', '.insert(incidenteEscola)'])
  })

  it('o leitor da escola lê as duas, escreve só na seção da escola (a confirmação), nunca no incidente, e nenhum método dele é @SemEscopo', () => {
    const leitor = arquivosDoRepositorio().find((arquivo) => arquivo.caminho === LEITOR_DO_INCIDENTE)
    expect(leitor && usosDoGrupo(leitor.texto, GRUPO_DO_INCIDENTE).length).toBeGreaterThan(0)
    expect(escritasDoCodigo(leitor?.texto ?? '')).toEqual(['.update(incidenteEscola)'])
    // Todo SQL escrito à mão ficaria fora da conta acima: o leitor não tem nenhum.
    expect(semComentarios(leitor?.texto ?? '')).not.toMatch(/\bsql`\s*(?:insert|update|delete)\b/i)
    expect(leitor && tabelasDeForaNoRepository(leitor.texto, GRUPO_DO_INCIDENTE)).toEqual([])
    const metodos = Object.getOwnPropertyNames(nucleo.IncidenteDaEscolaRepository.prototype).filter((metodo) => metodo !== 'constructor')
    expect(metodos.toSorted()).toEqual(['confirmar', 'conhecidoEmDoPendenteMaisAntigo', 'daEscola', 'existe'])
    for (const metodo of metodos) expect(nucleo.justificativaSemEscopo(nucleo.IncidenteDaEscolaRepository, metodo), metodo).toBeUndefined()
  })

  it('a varredura pega o uso em qualquer forma, e não confunde variável, comentário nem teste com tabela', () => {
    const fora = [
      { caminho: 'apps/api/src/privacidade/privacidade.service.ts', texto: "import { and, incidente } from '@educa/nucleo'" },
      { caminho: 'apps/api/src/privacidade/alias.ts', texto: "import { type Banco, incidenteEscola as secao } from '@educa/nucleo'" },
      { caminho: 'apps/api/src/privacidade/ns.ts', texto: "import * as n from '@educa/nucleo'\nn.incidenteEscola" },
      { caminho: 'apps/api/src/privacidade/reexporta.ts', texto: "export { incidente } from '@educa/nucleo'" },
      { caminho: 'apps/api/src/privacidade/schema.ts', texto: "import { incidente as i } from '../../../../packages/nucleo/src/db/schema/incidente.js'" },
      { caminho: 'apps/worker/src/sql.ts', texto: "pool.query('delete from incidente_escola where confirmado_em is null')" },
      { caminho: 'apps/worker/src/sql-aspas.ts', texto: 'sql`update "public"."incidente" set conhecido_em = now()`' },
    ]
    const inocentes = [
      { caminho: 'apps/api/src/ops/incidente.ts', texto: "import { OperacaoPrivacidadeRepository } from './operacao-privacidade.repository.js'\nconst incidente = lerPedido()\n// a tabela incidente" },
      { caminho: 'apps/api/test/incidente.int.test.ts', texto: "pool.query('select 1 from incidente')" },
      { caminho: 'packages/nucleo/src/index.ts', texto: "export { incidente } from './db/schema/incidente.js'" },
      { caminho: 'packages/nucleo/src/db/schema/incidente.ts', texto: 'export const incidente = pgTable()' },
    ]
    expect(quemTocaOIncidente([...fora, ...inocentes])).toEqual(fora.map((arquivo) => arquivo.caminho))
    expect(escritasDoCodigo('await this.banco.update(incidente).set(x)\n// .delete(incidente)\nawait this.banco.insert( incidenteEscola ).values(y)')).toEqual(['.update(incidente)', '.insert(incidenteEscola)'])
  })
})

/**
 * C40 a C42 e C36 (parte) (Tech Spec da A0, seção 6): as rotas `/v1/operacao/*` escapam das guardas de escola pelo
 * `rotaSemSessao`, e o que impede que isso vire atalho é que os marcadores só existem na pasta da operação, que a rota
 * `@RotaDeOperacao` sempre leva a `GuardaDeOperador`, que marcador e caminho andam juntos, e que o limite conta o
 * operador. A lista de rotas é a que o `AppModule` registra, lida dos metadados, sem subir a aplicação.
 */
const PASTA_DA_OPERACAO = 'apps/api/src/operacao/'
const NOMES_DOS_MARCADORES = /\b(?:RotaDeOperacao|EntradaDeOperacao)\b/
const CHAVES_DOS_MARCADORES = /\bMETADADO_(?:ROTA|ENTRADA)_DE_OPERACAO\b/
/** Quem pode citar as chaves: onde nascem, o barrel, a conferência do boot, e os decoradores. */
const QUEM_PODE_CITAR_AS_CHAVES = [
  'packages/nucleo/src/identidade/marcadores-de-operacao.ts',
  'packages/nucleo/src/index.ts',
  'packages/nucleo/src/permissao/conferencia-das-permissoes.ts',
  'apps/api/src/operacao/marcadores.ts',
]

/** O texto sem comentário de bloco nem de linha: citar o marcador num comentário não é usá-lo. */
function semComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

/** Os arquivos de código de produção que usam um marcador fora da pasta da operação, ou citam as chaves fora da lista. */
function marcadoresForaDaOperacao(arquivos: readonly Arquivo[]): string[] {
  return arquivos
    .filter((arquivo) => /^(apps|packages)\/[^/]+\/src\//.test(arquivo.caminho) && !deTeste(arquivo.caminho))
    .filter((arquivo) => {
      const codigo = semComentarios(arquivo.texto)
      const usaMarcador = NOMES_DOS_MARCADORES.test(codigo) && !arquivo.caminho.startsWith(PASTA_DA_OPERACAO)
      const citaChave = CHAVES_DOS_MARCADORES.test(codigo) && !QUEM_PODE_CITAR_AS_CHAVES.includes(arquivo.caminho)
      return usaMarcador || citaChave
    })
    .map((arquivo) => arquivo.caminho)
}

const rotasDaApi = (): RotaRegistrada[] => rotasDe(controladoresDoModulo(AppModule.com(configuracaoDeTeste())))
const nomeDaRota = (rota: RotaRegistrada) => `${rota.verbo} ${rota.caminho}`

// Controllers de mentira, para provar que as conferências reprovam o que deveriam.
@Controller('v1/operacao/so-metadado')
class SoMetadadoController {
  @Get()
  @SetMetadata(nucleo.METADADO_ROTA_DE_OPERACAO, true)
  obter(): void {}
}

@RotaDeOperacao()
@Controller('v1/operacao/na-classe')
class NaClasseController {
  @Get()
  obter(): void {}
}

@Controller('v1/operacao/no-metodo')
class NoMetodoController {
  @Get()
  @RotaDeOperacao()
  obter(): void {}

  @Get('entrar')
  @EntradaDeOperacao()
  entrar(): void {}
}

@Controller('v1/operacao/esquecida')
class SemMarcadorController {
  @Get()
  obter(): void {}
}

@Controller('v1/escola/marcada')
class EscolaMarcadaController {
  @Get()
  @RotaDeOperacao()
  obter(): void {}
}

@Controller('v1/operacaox')
class PrefixoParecidoController {
  @Get()
  @EntradaDeOperacao()
  obter(): void {}
}

describe('arquitetura: os marcadores da operação só na pasta da operação (C40)', () => {
  it('nenhum código de produção fora de apps/api/src/operacao/ usa os marcadores, e as chaves só onde é preciso', () => {
    const arquivos = arquivosDoRepositorio()
    // A varredura enxerga o código: os decoradores e o controller do /eu usam os marcadores.
    expect(arquivos.filter((arquivo) => NOMES_DOS_MARCADORES.test(semComentarios(arquivo.texto))).map((arquivo) => arquivo.caminho)).toEqual(
      expect.arrayContaining(['apps/api/src/operacao/marcadores.ts', 'apps/api/src/operacao/eu/eu.controller.ts']),
    )
    expect(marcadoresForaDaOperacao(arquivos)).toEqual([])
  })

  it('em método e em classe: todo controller registrado com marcador é um controller do OperacaoModule', () => {
    const daOperacao = new Set(controladoresDoModulo(OperacaoModule.com(configuracaoDeTeste().identidade, { dispositivo: configuracaoDeTeste().login.dispositivo, mfa: configuracaoDeTeste().login.mfa })))
    const marcados = new Set(rotasDaApi().filter((rota) => rota.marcador !== undefined).map((rota) => rota.controlador))
    expect(marcados.size).toBeGreaterThan(0)
    expect([...marcados].filter((controlador) => !daOperacao.has(controlador)).map((controlador) => controlador.name)).toEqual([])
    // E o OperacaoModule só registra controller da própria pasta.
    const modulo = readFileSync(join(RAIZ, PASTA_DA_OPERACAO, 'operacao.module.ts'), 'utf8')
    expect([...modulo.matchAll(/import\s+\{[^}]*Controller[^}]*\}\s+from\s+'([^']+)'/g)].map((importacao) => importacao[1]).every((origem) => origem?.startsWith('./'))).toBe(true)
  })

  it('a varredura reprova o marcador fora da pasta, na classe, no método ou pela chave, e não confunde comentário com uso', () => {
    const fora = [
      { caminho: 'apps/api/src/estrutura/turma/turma.controller.ts', texto: "import { RotaDeOperacao } from '../operacao/marcadores.js'\n@RotaDeOperacao()\n@Controller('v1/turmas')\nexport class TurmaController {}" },
      { caminho: 'apps/api/src/sessao/atalho.controller.ts', texto: 'export class Atalho {\n  @Get()\n  @EntradaDeOperacao()\n  obter() {}\n}' },
      { caminho: 'apps/api/src/sessao/chave.ts', texto: "import { METADADO_ROTA_DE_OPERACAO } from '@educa/nucleo'\nSetMetadata(METADADO_ROTA_DE_OPERACAO, true)" },
      { caminho: 'packages/nucleo/src/limite/outro.ts', texto: 'reflector.get(METADADO_ENTRADA_DE_OPERACAO, alvo)' },
    ]
    const inocentes = [
      { caminho: 'apps/api/src/operacao/painel/painel.controller.ts', texto: '@RotaDeOperacao()\nexport class PainelController {}' },
      { caminho: 'packages/nucleo/src/limite/guarda-limite.ts', texto: '/** A rota `@RotaDeOperacao()` conta no rl:op. */\n// e a @EntradaDeOperacao não\nconst x = 1' },
      { caminho: 'apps/api/test/qualquer.int.test.ts', texto: '@RotaDeOperacao()\nclass X {}' },
      { caminho: 'apps/api/test/rotas-registradas.ts', texto: "import { METADADO_ROTA_DE_OPERACAO } from '@educa/nucleo'" },
    ]
    expect(marcadoresForaDaOperacao([...fora, ...inocentes])).toEqual(fora.map((arquivo) => arquivo.caminho))
  })
})

describe('arquitetura: a rota @RotaDeOperacao tem a GuardaDeOperador no handler resolvido (C41)', () => {
  it('toda rota @RotaDeOperacao registrada tem a guarda', () => {
    const rotas = rotasDaApi().filter((rota) => rota.marcador === 'rota')
    // I3 (A0b): a varredura enxerga exatamente o `/eu` e as oito rotas do painel, nem uma a mais, nem uma a menos.
    expect(rotas.map(nomeDaRota).toSorted()).toEqual(ROTAS_COM_SESSAO_DE_OPERADOR)
    expect(rotasDe([PainelController]).map(nomeDaRota).toSorted()).toEqual(ROTAS_DO_PAINEL.toSorted())
    expect(ROTAS_DO_PAINEL).toHaveLength(8)
    expect(rotasDeOperacaoSemGuarda(rotas)).toEqual([])
  })

  it('reprova a rota com o marcador e sem a guarda, e aceita o marcador no método e na classe', () => {
    expect(rotasDeOperacaoSemGuarda(rotasDe([SoMetadadoController, NaClasseController, NoMetodoController]))).toEqual(['SoMetadadoController.obter'])
  })
})

describe('arquitetura: marcador e caminho /v1/operacao andam juntos (C42)', () => {
  it('todo caminho /v1/operacao tem marcador, e todo marcador está sob /v1/operacao', () => {
    const rotas = rotasDaApi()
    expect(rotas.length).toBeGreaterThan(30)
    expect(rotasForaDaCerca(rotas)).toEqual([])
  })

  it('reprova o caminho da operação sem marcador, o marcador fora dela, e não se engana com prefixo parecido', () => {
    const rotas = rotasDe([NaClasseController, NoMetodoController, SemMarcadorController, EscolaMarcadaController, PrefixoParecidoController])
    expect(rotasForaDaCerca(rotas)).toEqual(['GET /v1/operacao/esquecida', 'GET /v1/escola/marcada', 'GET /v1/operacaox'])
  })
})

describe('arquitetura: toda rota @RotaDeOperacao conta pelo rl:op:{sub} (C36, parte)', () => {
  const identidade = configuracaoDeTeste().identidade
  const OPERADOR = '0190f5a0-0000-7000-8000-0000000000e1'
  const SESSAO = '0190f5a0-0000-7000-8000-0000000000f1'

  function guardaComLimitador(resultado: nucleo.ResultadoDoLimite = { aceita: true }) {
    const limitador = {
      consumirDeOperador: vi.fn(async (_operadorId: string) => resultado),
      consumirAnonima: vi.fn(async () => ({ aceita: true }) as const),
      consumirDoLogin: vi.fn(async () => ({ aceita: true }) as const),
      consumirDaOperacao: vi.fn(async () => ({ aceita: true }) as const),
      consumirAutenticada: vi.fn(async () => ({ aceita: true }) as const),
    }
    const guarda = new nucleo.GuardaDeLimite(new Reflector(), limitador as unknown as nucleo.LimitadorDeRequisicoes, new nucleo.ProxiesConfiaveis(['127.0.0.1']), { daEscola: async () => ({ porUsuarioMin: 1, porEscolaMin: 1 }) }, identidade)
    return { guarda, limitador }
  }

  function execucao(rota: Pick<RotaRegistrada, 'handler' | 'controlador'>, authorization?: string): ExecutionContext {
    const requisicao = { headers: authorization === undefined ? {} : { authorization }, socket: { remoteAddress: '127.0.0.1' } }
    return {
      getHandler: () => rota.handler,
      getClass: () => rota.controlador as Type,
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => requisicao }),
    } as unknown as ExecutionContext
  }

  const tokenDeOperador = async () => `Bearer ${(await new nucleo.EmissorDeTokenDeOperador(identidade.chaveAssinatura).emitir({ operadorId: OPERADOR, sessaoId: SESSAO })).token}`

  it('em cada rota @RotaDeOperacao registrada, o token de operador conta no rl:op do sub, e em nenhum outro limite', async () => {
    const rotas = rotasDaApi().filter((rota) => rota.marcador === 'rota')
    // I3 (A0b): as varridas são exatamente o `/eu` e as oito rotas do painel.
    expect(rotas.map(nomeDaRota).toSorted()).toEqual(ROTAS_COM_SESSAO_DE_OPERADOR)
    for (const rota of rotas) {
      const { guarda, limitador } = guardaComLimitador()
      expect(await guarda.canActivate(execucao(rota, await tokenDeOperador())), nomeDaRota(rota)).toBe(true)
      expect(limitador.consumirDeOperador.mock.calls, nomeDaRota(rota)).toEqual([[OPERADOR]])
      expect([limitador.consumirAnonima, limitador.consumirDoLogin, limitador.consumirDaOperacao, limitador.consumirAutenticada].map((consumo) => consumo.mock.calls.length), nomeDaRota(rota)).toEqual([0, 0, 0, 0])
    }
  })

  it('acima do limite, 429 LIMITE_EXCEDIDO com a espera; sem token de operador que confira, não conta nada e deixa a GuardaDeOperador responder', async () => {
    const [rota] = rotasDaApi().filter((candidata) => candidata.marcador === 'rota')
    if (rota === undefined) throw new Error('nenhuma rota @RotaDeOperacao')
    const recusada = guardaComLimitador({ aceita: false, msAteLiberar: 1_500 })
    await expect(recusada.guarda.canActivate(execucao(rota, await tokenDeOperador()))).rejects.toMatchObject({ codigo: ErrorCode.LIMITE_EXCEDIDO, status: 429, tenteDeNovoEmSegundos: 2 })

    const tokenDeEscola = (await new nucleo.EmissorDeToken(identidade.chaveAssinatura).emitir({ escolaId: SESSAO, usuarioId: OPERADOR, sessaoId: SESSAO })).token
    for (const authorization of [undefined, `Bearer ${tokenDeEscola}`, 'Bearer a.b.c']) {
      const { guarda, limitador } = guardaComLimitador()
      expect(await guarda.canActivate(execucao(rota, authorization))).toBe(true)
      expect(Object.values(limitador).map((consumo) => consumo.mock.calls.length)).toEqual([0, 0, 0, 0, 0])
    }
  })
})

/**
 * C43 (Tech Spec da A0, seções 4 e 6): as rotas `@EntradaDeOperacao` pulam as guardas de escola sem a `GuardaDeOperador`,
 * e por isso são uma lista fechada, escrita aqui. Rota de entrada nova é mudança da spec, não do código.
 */
const AS_SETE_ENTRADAS = [
  'POST /v1/operacao/convite/consultar',
  'POST /v1/operacao/convite/aceitar',
  'POST /v1/operacao/sessao/email',
  'POST /v1/operacao/sessao/mfa/configurar',
  'POST /v1/operacao/sessao/mfa',
  'POST /v1/operacao/sessao/renovar',
  'POST /v1/operacao/sessao/sair',
]

describe('arquitetura: as rotas @EntradaDeOperacao são exatamente as sete da seção 4 (C43)', () => {
  it('a lista registrada é a da spec, nem uma a mais, nem uma a menos', () => {
    expect(rotasDaApi().filter((rota) => rota.marcador === 'entrada').map(nomeDaRota).sort()).toEqual([...AS_SETE_ENTRADAS].sort())
  })
})

describe('arquitetura: toda rota @EntradaDeOperacao está num dos três grupos de limite (C36, parte)', () => {
  const identidade = configuracaoDeTeste().identidade
  /**
   * O grupo de cada entrada (Tech Spec da A0, seção 5, "Limite"): rebaixa no semáforo do hash (quem recusa é o contador
   * por conta), recusa pelo contador do `operador.id` no service (a rota também não responde 429 pelo IP), ou o limite
   * por IP que recusa. As três contam no balde por IP próprio da operação (`rl:ip:op`, A0b, tarefa 9.0), nunca no `rl:ip`
   * nem no `rl:ip-login` da escola.
   */
  const GRUPOS: Record<string, 'rebaixa_no_hash' | 'contador_do_operador' | 'recusa_pelo_ip'> = {
    'POST /v1/operacao/convite/consultar': 'recusa_pelo_ip',
    'POST /v1/operacao/convite/aceitar': 'rebaixa_no_hash',
    'POST /v1/operacao/sessao/email': 'rebaixa_no_hash',
    'POST /v1/operacao/sessao/mfa/configurar': 'recusa_pelo_ip',
    'POST /v1/operacao/sessao/mfa': 'contador_do_operador',
    'POST /v1/operacao/sessao/renovar': 'recusa_pelo_ip',
    'POST /v1/operacao/sessao/sair': 'recusa_pelo_ip',
  }

  /** O que a `GuardaDeLimite` faz com a rota, com o IP acima do limite: qual limite ela conta, e se responde 429. */
  async function acimaDoLimite(rota: RotaRegistrada): Promise<{ contou: string[]; recusou: boolean; rebaixou: boolean }> {
    const recusa = { aceita: false, msAteLiberar: 1_000 } as const
    const limitador = {
      consumirDeOperador: vi.fn(async () => recusa),
      consumirAnonima: vi.fn(async () => recusa),
      consumirDoLogin: vi.fn(async () => recusa),
      consumirDaOperacao: vi.fn(async () => recusa),
      consumirAutenticada: vi.fn(async () => recusa),
    }
    const guarda = new nucleo.GuardaDeLimite(new Reflector(), limitador as unknown as nucleo.LimitadorDeRequisicoes, new nucleo.ProxiesConfiaveis(['127.0.0.1']), { daEscola: async () => ({ porUsuarioMin: 1, porEscolaMin: 1 }) }, identidade)
    const requisicao = { headers: {}, socket: { remoteAddress: '127.0.0.1' } }
    const execucao = {
      getHandler: () => rota.handler,
      getClass: () => rota.controlador,
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => requisicao }),
    } as unknown as ExecutionContext
    let recusou = false
    try {
      await guarda.canActivate(execucao)
    } catch (erro) {
      expect(erro).toMatchObject({ codigo: ErrorCode.LIMITE_EXCEDIDO, status: 429 })
      recusou = true
    }
    const contou = Object.entries(limitador)
      .filter(([, consumo]) => consumo.mock.calls.length > 0)
      .map(([nome]) => nome)
    return { contou, recusou, rebaixou: nucleo.acimaDoLimiteDoIp(requisicao as unknown as IncomingMessage) }
  }

  it('cada entrada conta no rl:ip:op, o balde por IP da operação: o grupo que recusa responde 429; rebaixar e o contador do operador nunca recusam pelo IP, só marcam a requisição', async () => {
    const entradas = rotasDaApi().filter((rota) => rota.marcador === 'entrada')
    expect(entradas.map(nomeDaRota).sort()).toEqual(Object.keys(GRUPOS).sort())
    const esperado = {
      recusa_pelo_ip: { contou: ['consumirDaOperacao'], recusou: true, rebaixou: false },
      rebaixa_no_hash: { contou: ['consumirDaOperacao'], recusou: false, rebaixou: true },
      contador_do_operador: { contou: ['consumirDaOperacao'], recusou: false, rebaixou: true },
    }
    for (const rota of entradas) {
      const grupo = GRUPOS[nomeDaRota(rota)]
      if (grupo === undefined) throw new Error(`entrada sem grupo: ${nomeDaRota(rota)}`)
      expect(await acimaDoLimite(rota), nomeDaRota(rota)).toEqual(esperado[grupo])
    }
  })
})

/**
 * C44 (Tech Spec da A0, seção 6; PRD, RF1): o operador e o convite dele nascem só pelo `ops:operador`. Os únicos
 * métodos que os inserem são o `criar` e o `criarConvite` do `OperadorRepository` (e só ele toca as tabelas, C45); aqui
 * se prova que só o comando os chama, e que nenhum módulo da API importa o código dos comandos, sem exceção: `criarRede` e
 * `criarEscola`, o caso de uso das duas rotas de criação do painel da operação (A0b), moram em `operacao/escola/`, e
 * `ops/` só tem terminal (X5, 35.0). Que nenhum arquivo da API fora de `ops/` importe o código dos comandos é a regra
 * `api-nao-importa-ops` do `guarda:camadas` (X5, 12.0); aqui fica a chamada pelo nome. Quem importa o caso de uso fica
 * preso em `escola.repository.test.ts` (I2).
 */
const COMANDO_DO_OPERADOR = 'apps/api/src/ops/operador.ts'
const PASTA_DOS_COMANDOS = 'apps/api/src/ops/'

/** Os arquivos de produção que criam operador ou convite de operador fora do comando. */
function quemCriaOperadorForaDoComando(arquivos: readonly Arquivo[]): string[] {
  return arquivos
    .filter((arquivo) => /^(apps|packages)\/[^/]+\/src\//.test(arquivo.caminho) && !deTeste(arquivo.caminho))
    .filter((arquivo) => {
      const codigo = semComentarios(arquivo.texto)
      const chamaORepository = /\bOperadorRepository\b/.test(codigo) && /\.(?:criar|criarConvite)\s*\(/.test(codigo) && arquivo.caminho !== COMANDO_DO_OPERADOR
      const chamaOComando = /\b(?:criarOperador|gerarConviteDeOperador|executarOpsOperador)\s*\(/.test(codigo) && !arquivo.caminho.startsWith(PASTA_DOS_COMANDOS)
      return chamaORepository || chamaOComando
    })
    .map((arquivo) => arquivo.caminho)
}

describe('arquitetura: nenhuma rota registrada cria operador (C44)', () => {
  it('só o comando cria operador e convite de operador', () => {
    const arquivos = arquivosDoRepositorio()
    // A varredura enxerga o código: o comando cria pelo repository.
    expect(arquivos.find((arquivo) => arquivo.caminho === COMANDO_DO_OPERADOR)?.texto).toMatch(/repositorio\.criar\(/)
    expect(quemCriaOperadorForaDoComando(arquivos)).toEqual([])
  })

  it('a varredura reprova a rota que cria pelo repository ou pelo comando; não confunde comentário, teste nem outro repository', () => {
    const fora = [
      { caminho: 'apps/api/src/operacao/painel/painel.service.ts', texto: "import { OperadorRepository } from './operador.repository.js'\nawait new OperadorRepository(tx).criar(dados)" },
      { caminho: 'apps/api/src/operacao/convite.service.ts', texto: "import { OperadorRepository } from './operador.repository.js'\nawait repositorio.criarConvite({ operadorId })" },
      { caminho: 'apps/api/src/operacao/atalho.controller.ts', texto: "import { criarOperador } from '../ops/operador.js'\nawait criarOperador(banco, autor, dados)" },
    ]
    const inocentes = [
      { caminho: COMANDO_DO_OPERADOR, texto: "import { OperadorRepository } from '../operacao/operador/operador.repository.js'\nawait repositorio.criar(dados)" },
      { caminho: 'apps/api/src/estrutura/turma/turma.service.ts', texto: 'await turmas.criar({ nome })' },
      { caminho: 'apps/api/src/operacao/eu/eu.service.ts', texto: "import type { OperadorRepository } from './operador.repository.js'\n// nunca chama .criar( daqui" },
      { caminho: 'apps/api/test/registros-operador.int.test.ts', texto: "import { criarOperador } from '../src/ops/operador.js'\nawait criarOperador(banco, autor, dados)" },
      { caminho: 'apps/api/src/operacao/painel/painel.service.ts', texto: "import { criarEscola, criarRede } from '../escola/escola.js'" },
    ]
    expect(quemCriaOperadorForaDoComando([...fora, ...inocentes])).toEqual(fora.map((arquivo) => arquivo.caminho))
  })
})

/**
 * Regra 10, item 1: toda tabela de domínio tem `escola_id`, e as exceções são curtas, fixas e escritas no item 1 das
 * "Regras transversais" do `docs/modelo-de-dados.md`. A exceção que entra numa migration sem entrar no documento deixa
 * o desenho mentindo sobre o isolamento (validação da A0, correção 2026-09-24-modelo-de-dados-tabelas-da-operacao).
 */
const DOC_MODELO = 'docs/modelo-de-dados.md'

/**
 * O SQL de uma migration em comandos, sem o que não é DDL: o corpo das funções (`$$ … $$`), os comentários (inclusive o
 * `--> statement-breakpoint` do drizzle) e o texto entre aspas simples. Assim um `;` ou um `CREATE TABLE` dentro de
 * função, comentário ou texto não vira comando.
 */
function comandosDaMigration(sql: string): string[] {
  return sql
    .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, "''")
    .replace(/--[^\n]*/g, '')
    .replace(/'(?:[^']|'')*'/g, "''")
    .split(';')
    .map((comando) => comando.trim())
    .filter((comando) => comando !== '')
}

/** O nome de tabela como a migration o escreve: com ou sem aspas, com ou sem o esquema `public` na frente. */
const NOME_DE_TABELA = String.raw`(?:"?public"?\.)?"?(\w+)"?`
const CRIACAO = new RegExp(String.raw`^create\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?${NOME_DE_TABELA}\s*\(([\s\S]*)\)`, 'i')
const ALTERACAO = new RegExp(String.raw`^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${NOME_DE_TABELA}\s+([\s\S]*)$`, 'i')
/** Qualquer `CREATE … TABLE`, inclusive o que a leitura acima não entende: a conferência de que nenhuma escapou. */
const CRIACAO_SOLTA = /\bcreate\s+(?:[a-z]+\s+)*table\b/gi
const COLUNA_ESCOLA = String.raw`"?escola_id"?(?![\w"])`

/**
 * Toda tabela das migrations que termina sem `escola_id`, na ordem das migrations. Lê o DDL do drizzle e o escrito à
 * mão: `CREATE TABLE [IF NOT EXISTS]` com ou sem `"public".`, em qualquer caixa; `ALTER TABLE … ADD`/`DROP`/`RENAME
 * COLUMN` do `escola_id`; `ALTER TABLE … RENAME TO`; e `DROP TABLE`. Um `CREATE TABLE` que ela não consegue ler (`AS
 * SELECT`, `PARTITION OF`, temporária, outro esquema) **falha o teste**, em vez de sumir da conta calado: a leitura
 * estrita tem de achar tantas criações quanto a busca solta. O `ALTER` não tem essa conferência: uma forma dele que a
 * leitura não conheça (o `escola_id` perdido por outro caminho) ainda passaria, e a regra 80, item 9, já a torna rara.
 */
function tabelasSemEscola(sqls: readonly string[]): string[] {
  const temEscola = new Map<string, boolean>()
  for (const sql of sqls) {
    for (const comando of comandosDaMigration(sql)) {
      const soltas = [...comando.matchAll(CRIACAO_SOLTA)].length
      const criacao = CRIACAO.exec(comando)
      if (soltas !== (criacao === null ? 0 : 1)) throw new Error(`criação de tabela que a leitura das migrations não reconhece: ${comando.slice(0, 120)}`)
      if (criacao !== null) {
        temEscola.set(criacao[1] ?? '', new RegExp(`(?:^|[\\s(,])${COLUNA_ESCOLA}`, 'i').test(criacao[2] ?? ''))
        continue
      }
      const alteracao = ALTERACAO.exec(comando)
      if (alteracao !== null) {
        const tabela = alteracao[1] ?? ''
        const acoes = alteracao[2] ?? ''
        const novoNome = new RegExp(String.raw`^rename\s+to\s+"?(\w+)"?$`, 'i').exec(acoes)?.[1]
        if (novoNome !== undefined) {
          const tinha = temEscola.get(tabela)
          temEscola.delete(tabela)
          if (tinha !== undefined) temEscola.set(novoNome, tinha)
          continue
        }
        if (new RegExp(String.raw`\b(?:add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?|rename\s+(?:column\s+)?"?\w+"?\s+to\s+)${COLUNA_ESCOLA}`, 'i').test(acoes)) temEscola.set(tabela, true)
        if (new RegExp(String.raw`\b(?:drop\s+(?:column\s+)?(?:if\s+exists\s+)?|rename\s+(?:column\s+)?)${COLUNA_ESCOLA}`, 'i').test(acoes)) temEscola.set(tabela, false)
        continue
      }
      const remocao = new RegExp(String.raw`^drop\s+table\s+(?:if\s+exists\s+)?([\s\S]+?)(?:\s+(?:cascade|restrict))?$`, 'i').exec(comando)
      for (const nome of remocao?.[1]?.split(',') ?? []) temEscola.delete(new RegExp(`^\\s*${NOME_DE_TABELA}\\s*$`).exec(nome)?.[1] ?? '')
    }
  }
  return [...temEscola].filter(([, tem]) => !tem).map(([tabela]) => tabela)
}

/** `codigo_recuperacao_operador` → `CodigoRecuperacaoOperador`, o nome com que o documento desenha a tabela. */
function nomeNoDocumento(tabela: string): string {
  return tabela
    .split('_')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join('')
}

/** O texto do item 1 das "Regras transversais", até o item 2. */
function excecoesDoDocumento(doc: string): string {
  const secao = doc.split(/^## Regras transversais$/m)[1] ?? ''
  return (secao.split(/^2\. /m)[0] ?? '').split(/^1\. /m)[1] ?? ''
}

/** As tabelas sem `escola_id` que o item 1 não nomeia, pelo nome entre crases. */
function excecoesNaoDeclaradas(tabelas: readonly string[], doc: string): string[] {
  const item = excecoesDoDocumento(doc)
  return tabelas.filter((tabela) => !item.includes(`\`${nomeNoDocumento(tabela)}\``))
}

describe('arquitetura: toda tabela sem escola_id está nas exceções do modelo de dados (regra 10, item 1)', () => {
  const sqls = readdirSync(join(RAIZ, 'packages/nucleo/drizzle'))
    .filter((arquivo) => arquivo.endsWith('.sql'))
    .sort()
    .map((arquivo) => readFileSync(join(RAIZ, 'packages/nucleo/drizzle', arquivo), 'utf8'))
  const doc = readFileSync(join(RAIZ, DOC_MODELO), 'utf8')

  it('a varredura enxerga as migrations: acha a identidade de login e as seis da operação, e não acha tabela com escola', () => {
    const sem = tabelasSemEscola(sqls)
    for (const tabela of ['conta', 'codigo_recuperacao', ...FISICOS_DA_OPERACAO]) expect(sem).toContain(tabela)
    for (const tabela of ['usuario', 'turma', 'auditoria', 'job_registro']) expect(sem).not.toContain(tabela)
    expect(excecoesDoDocumento(doc)).not.toBe('')
  })

  it(`o item 1 das Regras transversais do ${DOC_MODELO} nomeia cada uma`, () => {
    expect(excecoesNaoDeclaradas(tabelasSemEscola(sqls), doc)).toEqual([])
  })

  it('reprova a tabela nova sem escola_id que o documento não nomeia, e aceita a que ganhou escola_id depois', () => {
    const migrations = [
      'CREATE TABLE "conta" (\n\t"id" uuid\n);',
      'CREATE TABLE "nova" (\n\t"id" uuid\n);\nCREATE TABLE "tardia" (\n\t"id" uuid\n);\nCREATE TABLE "de_escola" (\n\t"escola_id" uuid\n);',
      'ALTER TABLE "tardia" ADD COLUMN "escola_id" uuid;',
    ]
    const documento = '## Regras transversais\n\n1. Exceções: `Conta`.\n2. Id é UUID. `Nova` aparece aqui, fora do item 1.\n'
    expect(tabelasSemEscola(migrations)).toEqual(['conta', 'nova'])
    expect(excecoesNaoDeclaradas(tabelasSemEscola(migrations), documento)).toEqual(['nova'])
  })

  it('lê o CREATE TABLE escrito à mão: IF NOT EXISTS, "public"., caixa baixa, sem aspas, CRLF e ") ;"', () => {
    expect(tabelasSemEscola(['CREATE TABLE IF NOT EXISTS "nova" (\n\t"id" uuid\n);'])).toEqual(['nova'])
    expect(tabelasSemEscola(['CREATE TABLE "public"."nova" (\n\t"id" uuid\n);'])).toEqual(['nova'])
    expect(tabelasSemEscola(['create table nova (\r\n  id uuid\r\n) ;'])).toEqual(['nova'])
    // A mesma escrita à mão com `escola_id` não entra na lista: a coluna é lida no corpo, com ou sem aspas.
    expect(tabelasSemEscola(['create table if not exists public.de_escola (\r\n  id uuid,\r\n  escola_id uuid not null\r\n);'])).toEqual([])
  })

  it('segue a tabela pelo ALTER escrito à mão: RENAME TO leva o nome novo, e DROP ou RENAME do escola_id a põe na lista', () => {
    const nova = 'CREATE TABLE "nova" (\n\t"id" uuid\n);'
    const deEscola = 'CREATE TABLE "de_escola" (\n\t"escola_id" uuid\n);'
    expect(tabelasSemEscola([nova, 'ALTER TABLE "nova" RENAME TO "renomeada";'])).toEqual(['renomeada'])
    expect(tabelasSemEscola([deEscola, 'ALTER TABLE "public"."de_escola" RENAME TO "com_escola";'])).toEqual([])
    expect(tabelasSemEscola([deEscola, 'ALTER TABLE "de_escola" DROP COLUMN "escola_id";'])).toEqual(['de_escola'])
    expect(tabelasSemEscola([deEscola, 'alter table de_escola drop column if exists escola_id cascade;'])).toEqual(['de_escola'])
    expect(tabelasSemEscola([deEscola, 'ALTER TABLE "de_escola" RENAME COLUMN "escola_id" TO "unidade_id";'])).toEqual(['de_escola'])
    expect(tabelasSemEscola([nova, 'ALTER TABLE "nova" RENAME COLUMN "unidade_id" TO "escola_id";'])).toEqual([])
    // O que só parece: a restrição com `escola_id` no nome e a coluna que só termina em `escola_id` não mudam nada.
    expect(tabelasSemEscola([deEscola, 'ALTER TABLE "de_escola" DROP CONSTRAINT "de_escola_escola_id_escola_id_fk";'])).toEqual([])
    expect(tabelasSemEscola([deEscola, 'ALTER TABLE "de_escola" DROP COLUMN "outra_escola_id";'])).toEqual([])
    expect(tabelasSemEscola([nova, 'ALTER TABLE "nova" ADD COLUMN "outra_escola_id" uuid;'])).toEqual(['nova'])
    expect(tabelasSemEscola([nova, 'DROP TABLE IF EXISTS "public"."nova" CASCADE;'])).toEqual([])
  })

  it('falha diante do CREATE TABLE que não consegue ler, e não se confunde com o que está em comentário, texto ou função', () => {
    for (const ilegivel of [
      'CREATE TABLE "copia" AS SELECT * FROM "escola";',
      'CREATE TABLE "auth"."conta" (\n\t"id" uuid\n);',
      'CREATE TABLE "filha" PARTITION OF "mae" FOR VALUES IN (1);',
      'CREATE TEMPORARY TABLE "rascunho" (\n\t"id" uuid\n);',
    ]) {
      expect(() => tabelasSemEscola([ilegivel]), ilegivel).toThrow(/não reconhece/)
    }
    const semDdl = [
      '-- CREATE TABLE "fantasma" (\n',
      "CREATE FUNCTION \"f\"() RETURNS trigger LANGUAGE plpgsql AS $$\nBEGIN\n  CREATE TABLE fantasma (id uuid);\n  RETURN NULL;\nEND;\n$$;",
      "ALTER TABLE \"x\" ADD CONSTRAINT \"x_nome\" CHECK (\"x\".\"nome\" <> 'create table fantasma (; ');",
    ].join('\n')
    expect(tabelasSemEscola([semDdl])).toEqual([])
  })
})

/**
 * F3, RF1 (Tech Spec do F3, seção 3, "Classificação de toda tabela"): toda tabela das migrations está em
 * `CLASSIFICACAO_DAS_TABELAS`, com a classe que diz como ela sai e se entra no arquivo do titular, e nada fora das
 * migrations está lá. A tabela nova que nasce sem classificação deixa a esteira vermelha: é como uma tabela de pessoa
 * escaparia do expurgo e do arquivo do titular sem ninguém ver.
 */
const PALAVRAS_DE_RESTRICAO = new Set(['constraint', 'primary', 'unique', 'check', 'foreign', 'exclude'])

/** O corpo do `CREATE TABLE` em itens, separando pelas vírgulas de fora dos parênteses. */
function itensDoCorpo(corpo: string): string[] {
  const itens: string[] = []
  let profundidade = 0
  let atual = ''
  for (const caractere of corpo) {
    if (caractere === '(') profundidade++
    if (caractere === ')') profundidade--
    if (caractere === ',' && profundidade === 0) {
      itens.push(atual)
      atual = ''
      continue
    }
    atual += caractere
  }
  return [...itens, atual].map((item) => item.trim()).filter((item) => item !== '')
}

/** O nome da coluna de um item do corpo, ou de uma ação de `ALTER`, se não for restrição. */
function nomeDeColuna(texto: string): string | undefined {
  const nome = /^"?(\w+)"?/.exec(texto.trim())?.[1]
  return nome === undefined || PALAVRAS_DE_RESTRICAO.has(nome.toLowerCase()) ? undefined : nome
}

/**
 * As colunas de cada tabela como as migrations, na ordem, as deixam: o `CREATE TABLE`, e no `ALTER TABLE` o `ADD`,
 * `DROP` e `RENAME COLUMN` e o `RENAME TO`; o `DROP TABLE` tira a tabela. Lê o mesmo DDL de `tabelasSemEscola`.
 */
function colunasDasTabelas(sqls: readonly string[]): Map<string, Set<string>> {
  const tabelas = new Map<string, Set<string>>()
  for (const sql of sqls) {
    for (const comando of comandosDaMigration(sql)) {
      const criacao = CRIACAO.exec(comando)
      if (criacao !== null) {
        tabelas.set(criacao[1] ?? '', new Set(itensDoCorpo(criacao[2] ?? '').flatMap((item) => nomeDeColuna(item) ?? [])))
        continue
      }
      const alteracao = ALTERACAO.exec(comando)
      if (alteracao !== null) {
        const tabela = alteracao[1] ?? ''
        const acoes = alteracao[2] ?? ''
        const novoNome = new RegExp(String.raw`^rename\s+to\s+"?(\w+)"?$`, 'i').exec(acoes)?.[1]
        const colunas = tabelas.get(tabela)
        if (colunas === undefined) continue
        if (novoNome !== undefined) {
          tabelas.delete(tabela)
          tabelas.set(novoNome, colunas)
          continue
        }
        for (const acao of itensDoCorpo(acoes)) {
          const renomeada = new RegExp(String.raw`^rename\s+(?:column\s+)?"?(\w+)"?\s+to\s+"?(\w+)"?$`, 'i').exec(acao)
          if (renomeada !== null) {
            colunas.delete(renomeada[1] ?? '')
            colunas.add(renomeada[2] ?? '')
            continue
          }
          const acrescentada = new RegExp(String.raw`^add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?([\s\S]+)$`, 'i').exec(acao)?.[1]
          const apagada = new RegExp(String.raw`^drop\s+(?:column\s+)?(?:if\s+exists\s+)?([\s\S]+)$`, 'i').exec(acao)?.[1]
          const nomeAcrescentado = acrescentada === undefined ? undefined : nomeDeColuna(acrescentada)
          const nomeApagado = apagada === undefined ? undefined : nomeDeColuna(apagada)
          if (nomeAcrescentado !== undefined) colunas.add(nomeAcrescentado)
          if (nomeApagado !== undefined) colunas.delete(nomeApagado)
        }
        continue
      }
      const remocao = new RegExp(String.raw`^drop\s+table\s+(?:if\s+exists\s+)?([\s\S]+?)(?:\s+(?:cascade|restrict))?$`, 'i').exec(comando)
      for (const nome of remocao?.[1]?.split(',') ?? []) tabelas.delete(new RegExp(`^\\s*${NOME_DE_TABELA}\\s*$`).exec(nome)?.[1] ?? '')
    }
  }
  return tabelas
}

/**
 * Nome de coluna que guarda segredo, chave, hash, o estado do segundo fator ou o identificador opaco da conta externa:
 * nunca pode entrar no arquivo do titular. Só a data de ativação do segundo fator fica de fora do padrão.
 */
const NOME_DE_SEGREDO = /hash|hmac|segredo|chave_envio|chave_objeto|^mfa_(?!ativado_em$)|^sujeito$|^tenant$/

/**
 * O que está errado na classificação, contra as colunas das migrations: tabela sem classificação, classificação de
 * tabela que não existe, tabela sem "entra no arquivo" (ou de classe desconhecida), tabela sem pessoa que entra no
 * arquivo, tabela que entra sem coluna de ligação ou com ligação que não existe, coluna de `foraDoArquivo` que não
 * existe, e coluna com nome de segredo fora de `foraDoArquivo`.
 */
function problemasDaClassificacao(classificacao: Readonly<Record<string, unknown>>, colunas: ReadonlyMap<string, ReadonlySet<string>>, foraDoArquivo: readonly string[]): string[] {
  const problemas: string[] = []
  for (const tabela of colunas.keys()) if (!Object.hasOwn(classificacao, tabela)) problemas.push(`${tabela}: sem classificação`)
  for (const [tabela, valor] of Object.entries(classificacao)) {
    const daTabela = colunas.get(tabela)
    if (daTabela === undefined) {
      problemas.push(`${tabela}: classificada e inexistente nas migrations`)
      continue
    }
    const { classe, arquivo } = (valor ?? {}) as { classe?: unknown; arquivo?: { entra?: unknown; ligacao?: unknown } }
    if (classe !== 'categoria' && classe !== 'prazo_fixo' && classe !== 'sem_pessoa') problemas.push(`${tabela}: classe desconhecida`)
    if (arquivo === undefined || typeof arquivo.entra !== 'boolean') {
      problemas.push(`${tabela}: sem "entra no arquivo"`)
      continue
    }
    if (!arquivo.entra) continue
    if (classe === 'sem_pessoa') problemas.push(`${tabela}: sem pessoa e no arquivo`)
    const ligacao = Array.isArray(arquivo.ligacao) ? (arquivo.ligacao as unknown[]) : []
    if (ligacao.length === 0) problemas.push(`${tabela}: no arquivo sem coluna de ligação`)
    for (const coluna of ligacao) if (typeof coluna !== 'string' || !daTabela.has(coluna)) problemas.push(`${tabela}.${String(coluna)}: coluna de ligação inexistente`)
  }
  for (const proibida of foraDoArquivo) {
    const [tabela = '', coluna = ''] = proibida.split('.')
    if (colunas.get(tabela)?.has(coluna) !== true) problemas.push(`${proibida}: coluna fora do arquivo inexistente`)
  }
  for (const [tabela, daTabela] of colunas) {
    for (const coluna of daTabela) if (NOME_DE_SEGREDO.test(coluna) && !foraDoArquivo.includes(`${tabela}.${coluna}`)) problemas.push(`${tabela}.${coluna}: segredo fora de COLUNAS_FORA_DO_ARQUIVO`)
  }
  return problemas
}

describe('arquitetura: toda tabela das migrations está classificada para a retenção e o arquivo do titular (F3, RF1)', () => {
  const sqls = readdirSync(join(RAIZ, 'packages/nucleo/drizzle'))
    .filter((arquivo) => arquivo.endsWith('.sql'))
    .sort()
    .map((arquivo) => readFileSync(join(RAIZ, 'packages/nucleo/drizzle', arquivo), 'utf8'))
  const colunas = colunasDasTabelas(sqls)

  it('a leitura das colunas enxerga as migrations: a criação, o ADD COLUMN do MVP e a tabela da retenção', () => {
    expect([...colunas.keys()].toSorted()).toEqual([...TABELAS_FISICAS].toSorted())
    expect(colunas.get('conta')).toEqual(new Set(['id', 'email', 'senha_hash', 'mfa_segredo_cifrado', 'mfa_chave_versao', 'mfa_ativado_em', 'mfa_ultimo_passo']))
    expect(colunas.get('mensagem_tutor')?.has('pagina')).toBe(true)
    expect(colunas.get('retencao_escola')).toEqual(new Set(['escola_id', 'categoria', 'meses', 'referencia_contrato', 'alterada_em', 'alterada_por']))
  })

  it('a CLASSIFICACAO_DAS_TABELAS confere com as migrations, nos dois sentidos, e as colunas fora do arquivo existem e cobrem todo segredo', () => {
    expect(problemasDaClassificacao(CLASSIFICACAO_DAS_TABELAS, colunas, COLUNAS_FORA_DO_ARQUIVO)).toEqual([])
  })

  it('toda categoria do catálogo tem ao menos uma tabela', () => {
    const usadas = new Set(Object.values(CLASSIFICACAO_DAS_TABELAS).flatMap((classificada) => (classificada.classe === 'categoria' ? classificada.categorias : [])))
    expect([...CHAVES_DE_RETENCAO].filter((categoria) => !usadas.has(categoria))).toEqual([])
  })

  it('reprova a tabela de migration fora da classificação, a classificada que não existe e a sem "entra no arquivo"', () => {
    const migrations = ['CREATE TABLE "pessoa" (\n\t"id" uuid PRIMARY KEY,\n\t"escola_id" uuid NOT NULL,\n\t"nome" text\n);', 'CREATE TABLE "nova" (\n\t"id" uuid\n);']
    const lidas = colunasDasTabelas(migrations)
    expect(problemasDaClassificacao({ pessoa: { classe: 'sem_pessoa', arquivo: { entra: false } } }, lidas, [])).toEqual(['nova: sem classificação'])
    expect(
      problemasDaClassificacao({ pessoa: { classe: 'sem_pessoa', arquivo: { entra: false } }, nova: { classe: 'sem_pessoa', arquivo: { entra: false } }, sumida: { classe: 'sem_pessoa', arquivo: { entra: false } } }, lidas, []),
    ).toEqual(['sumida: classificada e inexistente nas migrations'])
    expect(problemasDaClassificacao({ pessoa: { classe: 'categoria', categorias: ['conversa_tutor'] }, nova: { classe: 'sem_pessoa', arquivo: { entra: false } } }, lidas, [])).toEqual(['pessoa: sem "entra no arquivo"'])
  })

  it('reprova a ligação que falta ou não existe, a tabela sem pessoa no arquivo, a coluna fora do arquivo inexistente e o segredo fora da lista', () => {
    const lidas = colunasDasTabelas(['CREATE TABLE "pessoa" (\n\t"id" uuid,\n\t"aluno_id" uuid,\n\t"token_hash" text,\n\t"mfa_ativado_em" timestamp\n);'])
    const comArquivo = (arquivo: unknown, classe = 'categoria') => ({ pessoa: { classe, categorias: ['conversa_tutor'], arquivo } })
    expect(problemasDaClassificacao(comArquivo({ entra: true, ligacao: ['aluno_id'] }), lidas, ['pessoa.token_hash'])).toEqual([])
    expect(problemasDaClassificacao(comArquivo({ entra: true, ligacao: [] }), lidas, ['pessoa.token_hash'])).toEqual(['pessoa: no arquivo sem coluna de ligação'])
    expect(problemasDaClassificacao(comArquivo({ entra: true, ligacao: ['usuario_id'] }), lidas, ['pessoa.token_hash'])).toEqual(['pessoa.usuario_id: coluna de ligação inexistente'])
    expect(problemasDaClassificacao(comArquivo({ entra: true, ligacao: ['aluno_id'] }, 'sem_pessoa'), lidas, ['pessoa.token_hash'])).toEqual(['pessoa: sem pessoa e no arquivo'])
    expect(problemasDaClassificacao(comArquivo({ entra: false }), lidas, ['pessoa.token_hash', 'pessoa.mfa_ultimo_passo'])).toEqual(['pessoa.mfa_ultimo_passo: coluna fora do arquivo inexistente'])
    expect(problemasDaClassificacao(comArquivo({ entra: false }), lidas, [])).toEqual(['pessoa.token_hash: segredo fora de COLUNAS_FORA_DO_ARQUIVO'])
    // O padrão pega o estado do segundo fator e o identificador da conta externa, e deixa passar só a data de ativação.
    const segredos = colunasDasTabelas(['CREATE TABLE "conta_x" (\n\t"mfa_ultimo_passo" bigint,\n\t"mfa_chave_versao" smallint,\n\t"mfa_ativado_em" timestamp,\n\t"sujeito" text,\n\t"tenant" text\n);'])
    expect(problemasDaClassificacao({ conta_x: { classe: 'sem_pessoa', arquivo: { entra: false } } }, segredos, [])).toEqual([
      'conta_x.mfa_ultimo_passo: segredo fora de COLUNAS_FORA_DO_ARQUIVO',
      'conta_x.mfa_chave_versao: segredo fora de COLUNAS_FORA_DO_ARQUIVO',
      'conta_x.sujeito: segredo fora de COLUNAS_FORA_DO_ARQUIVO',
      'conta_x.tenant: segredo fora de COLUNAS_FORA_DO_ARQUIVO',
    ])
    expect(problemasDaClassificacao(comArquivo({ entra: false }, 'apagada_um_dia'), lidas, ['pessoa.token_hash'])).toEqual(['pessoa: classe desconhecida'])
  })

  it('a leitura das colunas segue o ALTER: ADD, DROP e RENAME COLUMN, RENAME TO e DROP TABLE, e não confunde restrição com coluna', () => {
    const criada = 'CREATE TABLE "nova" (\n\t"id" uuid,\n\t"velha" text,\n\tCONSTRAINT "nova_pk" PRIMARY KEY("id")\n);'
    expect(colunasDasTabelas([criada])).toEqual(new Map([['nova', new Set(['id', 'velha'])]]))
    expect(colunasDasTabelas([criada, 'ALTER TABLE "nova" ADD COLUMN "token_hash" text;'])).toEqual(new Map([['nova', new Set(['id', 'velha', 'token_hash'])]]))
    expect(colunasDasTabelas([criada, 'alter table nova add column if not exists extra int, drop column velha;'])).toEqual(new Map([['nova', new Set(['id', 'extra'])]]))
    expect(colunasDasTabelas([criada, 'ALTER TABLE "nova" RENAME COLUMN "velha" TO "chave_envio";'])).toEqual(new Map([['nova', new Set(['id', 'chave_envio'])]]))
    expect(colunasDasTabelas([criada, 'ALTER TABLE "nova" ADD CONSTRAINT "nova_x" CHECK ("id" is not null);', 'ALTER TABLE "nova" DROP CONSTRAINT "nova_x";'])).toEqual(new Map([['nova', new Set(['id', 'velha'])]]))
    expect(colunasDasTabelas([criada, 'ALTER TABLE "nova" RENAME TO "renomeada";'])).toEqual(new Map([['renomeada', new Set(['id', 'velha'])]]))
    expect(colunasDasTabelas([criada, 'DROP TABLE "nova";'])).toEqual(new Map())
  })
})

/**
 * F3, tarefa 13.0 (Tech Spec do F3, seção 3 e seção 5, "Arquivo"): o arquivo do titular lê exatamente as tabelas que a
 * `CLASSIFICACAO_DAS_TABELAS` diz que entram, e **cada coluna delas tem um destino**: ou entra, ou está em `fora` com o motivo.
 * Coluna nova numa tabela do arquivo deixa a esteira vermelha até alguém decidir se ela é do titular; o que
 * `COLUNAS_FORA_DO_ARQUIVO` proíbe nunca está entre as que entram, em nenhuma tabela.
 */
interface LeituraDaTabelaParaConferir {
  readonly colunas: readonly string[]
  readonly derivadas?: readonly string[]
  readonly fora: Readonly<Record<string, string>>
}

function problemasDaLeitura(
  leituras: Readonly<Record<string, LeituraDaTabelaParaConferir>>,
  classificacao: Readonly<Record<string, { arquivo: { entra: boolean } }>>,
  colunas: ReadonlyMap<string, ReadonlySet<string>>,
  foraDoArquivo: readonly string[],
): string[] {
  const problemas: string[] = []
  for (const [tabela, { arquivo }] of Object.entries(classificacao)) {
    if (arquivo.entra && !Object.hasOwn(leituras, tabela)) problemas.push(`${tabela}: entra no arquivo e não tem leitura`)
  }
  for (const [tabela, leitura] of Object.entries(leituras)) {
    if (classificacao[tabela]?.arquivo.entra !== true) problemas.push(`${tabela}: tem leitura e a classificação não a põe no arquivo`)
    const daTabela = colunas.get(tabela)
    if (daTabela === undefined) {
      problemas.push(`${tabela}: leitura de tabela que não existe`)
      continue
    }
    const entram = new Set(leitura.colunas)
    const de_fora = new Set(Object.keys(leitura.fora))
    for (const coluna of daTabela) {
      if (!entram.has(coluna) && !de_fora.has(coluna)) problemas.push(`${tabela}.${coluna}: coluna sem destino (nem entra, nem está em fora)`)
      if (entram.has(coluna) && de_fora.has(coluna)) problemas.push(`${tabela}.${coluna}: entra e está em fora`)
    }
    for (const coluna of [...entram, ...de_fora]) {
      if (!daTabela.has(coluna) && !(leitura.derivadas ?? []).includes(coluna)) problemas.push(`${tabela}.${coluna}: coluna que a tabela não tem`)
    }
    for (const coluna of entram) if (foraDoArquivo.includes(`${tabela}.${coluna}`)) problemas.push(`${tabela}.${coluna}: está em COLUNAS_FORA_DO_ARQUIVO e entra`)
    for (const proibida of foraDoArquivo) {
      const [daProibida = '', coluna = ''] = proibida.split('.')
      if (daProibida === tabela && !de_fora.has(coluna)) problemas.push(`${proibida}: proibida e sem motivo em fora`)
    }
  }
  return problemas
}

describe('arquitetura: o arquivo do titular lê as tabelas da classificação, e toda coluna delas tem destino (F3, tarefa 13.0)', () => {
  const sqls = readdirSync(join(RAIZ, 'packages/nucleo/drizzle'))
    .filter((arquivo) => arquivo.endsWith('.sql'))
    .sort()
    .map((arquivo) => readFileSync(join(RAIZ, 'packages/nucleo/drizzle', arquivo), 'utf8'))
  const colunas = colunasDasTabelas(sqls)

  it('as tabelas lidas são exatamente as que a classificação põe no arquivo, e nenhuma coluna fica sem destino', () => {
    expect(problemasDaLeitura(nucleo.LEITURAS_DO_ARQUIVO, CLASSIFICACAO_DAS_TABELAS, colunas, COLUNAS_FORA_DO_ARQUIVO)).toEqual([])
    const lidas = Object.keys(nucleo.LEITURAS_DO_ARQUIVO).toSorted()
    const esperadas = Object.entries(CLASSIFICACAO_DAS_TABELAS)
      .filter(([, { arquivo }]) => arquivo.entra)
      .map(([tabela]) => tabela)
      .toSorted()
    expect(lidas).toEqual(esperadas)
  })

  it('reprova a tabela sem leitura, a leitura sem classificação, a coluna sem destino ou duplicada, e a proibida que entra', () => {
    const lidas = colunasDasTabelas(['CREATE TABLE "pessoa" (\n\t"id" uuid,\n\t"nome" text,\n\t"senha_hash" text\n);'])
    const classificacao = { pessoa: { arquivo: { entra: true } } }
    const boa = { pessoa: { colunas: ['id', 'nome'], fora: { senha_hash: 'segredo' } } }
    expect(problemasDaLeitura(boa, classificacao, lidas, ['pessoa.senha_hash'])).toEqual([])
    expect(problemasDaLeitura({}, classificacao, lidas, [])).toEqual(['pessoa: entra no arquivo e não tem leitura'])
    expect(problemasDaLeitura(boa, { pessoa: { arquivo: { entra: false } } }, lidas, ['pessoa.senha_hash'])).toEqual(['pessoa: tem leitura e a classificação não a põe no arquivo'])
    expect(problemasDaLeitura({ pessoa: { colunas: ['id'], fora: { senha_hash: 'segredo' } } }, classificacao, lidas, ['pessoa.senha_hash'])).toEqual(['pessoa.nome: coluna sem destino (nem entra, nem está em fora)'])
    expect(problemasDaLeitura({ pessoa: { colunas: ['id', 'nome', 'senha_hash'], fora: { senha_hash: 'segredo' } } }, classificacao, lidas, ['pessoa.senha_hash'])).toEqual([
      'pessoa.senha_hash: entra e está em fora',
      'pessoa.senha_hash: está em COLUNAS_FORA_DO_ARQUIVO e entra',
    ])
    expect(problemasDaLeitura({ pessoa: { colunas: ['id', 'nome', 'fantasma'], fora: { senha_hash: 'segredo' } } }, classificacao, lidas, ['pessoa.senha_hash'])).toEqual(['pessoa.fantasma: coluna que a tabela não tem'])
    expect(problemasDaLeitura({ pessoa: { colunas: ['id', 'nome', 'situacao'], derivadas: ['situacao'], fora: { senha_hash: 'segredo' } } }, classificacao, lidas, ['pessoa.senha_hash'])).toEqual([])
    expect(problemasDaLeitura({ pessoa: { colunas: ['id', 'nome'], fora: {} } }, classificacao, lidas, ['pessoa.senha_hash'])).toEqual([
      'pessoa.senha_hash: coluna sem destino (nem entra, nem está em fora)',
      'pessoa.senha_hash: proibida e sem motivo em fora',
    ])
  })
})

/** Cita a classe da rotina noturna ou o arquivo dela (F3, tarefa 3.0). */
const USO_DA_ROTINA = /\bEscolasDaRotinaRepository\b|escolas-da-rotina\.repository/

/**
 * Fora dos testes, quem pode usar a lista de escolas da rotina: ela mesma, o barrel, e o worker-lote, que a usa na rotina
 * noturna (para abrir o contexto de cada escola) e nas medições por escola: as noites do expurgo e as horas do incidente sem
 * confirmação (a base `MedicaoPorEscola`, F3, tarefa 9.0). Uma rota da API que a importasse
 * teria uma consulta sem escopo ao alcance de uma requisição.
 */
const QUEM_USA_A_ROTINA = [
  'apps/worker/src/medicao-da-eliminacao.ts',
  'apps/worker/src/medicao-do-arquivo.ts',
  'apps/worker/src/medicao-do-expurgo.ts',
  'apps/worker/src/medicao-do-incidente.ts',
  'apps/worker/src/medicao-por-escola.ts',
  'apps/worker/src/montagem.ts',
  'apps/worker/src/processadores/expurgar-dado-pessoal.ts',
  'packages/nucleo/src/index.ts',
  'packages/nucleo/src/rotina/escolas-da-rotina.repository.ts',
]

describe('arquitetura: a rotina noturna é a única consulta sem escopo do expurgo da escola (F3, tarefa 3.0; Tech Spec do F3, seção 6)', () => {
  it('a EscolasDaRotinaRepository tem um método só, `listarIds`, @SemEscopo com a justificativa da rotina', () => {
    const metodos = Object.getOwnPropertyNames(nucleo.EscolasDaRotinaRepository.prototype).filter((metodo) => metodo !== 'constructor')
    expect(metodos).toEqual(['listarIds'])
    expect(nucleo.justificativaSemEscopo(nucleo.EscolasDaRotinaRepository, 'listarIds')).toMatch(/^rotina noturna: .*só os ids/)
  })

  it('o ExpurgoDaEscolaRepository não tem nenhum @SemEscopo: tudo nele vem da escola do contexto', () => {
    const metodos = Object.getOwnPropertyNames(nucleo.ExpurgoDaEscolaRepository.prototype).filter((metodo) => metodo !== 'constructor')
    expect(metodos.length).toBeGreaterThan(0)
    expect(metodos.filter((metodo) => nucleo.justificativaSemEscopo(nucleo.ExpurgoDaEscolaRepository, metodo) !== undefined)).toEqual([])
  })

  it('fora dos testes, só o worker-lote usa a lista de escolas da rotina', () => {
    for (const caminho of QUEM_USA_A_ROTINA) expect(existsSync(join(RAIZ, caminho)), caminho).toBe(true)
    const usos = arquivosDoRepositorio()
      .filter((arquivo) => !/(^|\/)test\//.test(arquivo.caminho) && !/\.test\.tsx?$/.test(arquivo.caminho))
      .filter((arquivo) => USO_DA_ROTINA.test(arquivo.texto))
      .map((arquivo) => arquivo.caminho)
    expect(usos.sort()).toEqual([...QUEM_USA_A_ROTINA].sort())
  })
})

describe('arquitetura: o que a auditoria diz de outra pessoa não entra no arquivo de quem é só autor (F3, 13.0 e 15.0)', () => {
  /**
   * O arquivo do titular (13.0) lista a auditoria em que ele é o autor. A ação com `entidade: 'usuario'` tem como `entidade_id` o
   * id de **outra pessoa** (a desativada, a eliminada, a que teve o segundo fator redefinido): se um professor ou um aluno a
   * assinasse, o arquivo dele carregaria o id de outra pessoa. A lista é a das ações que **só a coordenação, a operação e a
   * rotina** assinam, mais `usuario.ativado_por_convite`, em que quem assina é a própria pessoa e o id é o dela. Ação nova com
   * `entidade: 'usuario'` obriga a quem a cria a ler este comentário e a decidir quem a assina.
   */
  const COORDENACAO_OPERACAO_E_ROTINA = ['professor.cadastrado', 'usuario.desativado', 'usuario.eliminado', 'usuario.mfa_redefinicao_recusada', 'usuario.mfa_redefinido']
  const A_PROPRIA_PESSOA = ['usuario.ativado_por_convite']

  it('as ações sobre `usuario` são exatamente estas, e nenhuma é de professor ou aluno sobre outra pessoa', () => {
    const doUsuario = Object.entries(nucleo.ACOES_DE_AUDITORIA)
      .filter(([, definicao]) => definicao.entidade === 'usuario')
      .map(([acao]) => acao)
      .sort()
    expect(doUsuario).toEqual([...COORDENACAO_OPERACAO_E_ROTINA, ...A_PROPRIA_PESSOA].sort())
  })
})

// Que `sessao/` não importe `operacao/` é a regra `sessao-nao-importa-operacao` do `guarda:camadas` (X5, 12.0); o ciclo que
// o arquivo de prazos fechava com o repository, a `sem-ciclo`. Aqui fica o que a guarda não vê: o que o arquivo declara.
describe('arquitetura: o arquivo de prazos da sessão do operador não fecha ciclo com o repository (X5, 10.0)', () => {
  const codigoDe = (caminho: string): string => {
    const arquivo = arquivosDoRepositorio().find((candidato) => candidato.caminho === caminho)
    if (arquivo === undefined) throw new Error(`arquivo não encontrado: ${caminho}`)
    return semComentarios(arquivo.texto)
  }

  it('operacao/sessao/prazos-da-sessao.ts não importa operador.repository', () => {
    expect(codigoDe('apps/api/src/operacao/sessao/prazos-da-sessao.ts')).not.toContain('operador.repository')
  })

  it('operador.repository.ts não declara nem reexporta ConferenciaDoAutor', () => {
    expect(codigoDe('apps/api/src/operacao/operador/operador.repository.ts')).not.toMatch(/\bConferenciaDoAutor\b/)
  })
})

describe('arquitetura: só o controller e o módulo importam o login.service (X5, 11.0)', () => {
  /** Provisório: a regra definitiva é a do depcruise, da 12.0, que então substitui estes `it`. */
  const IMPORTA_O_LOGIN_SERVICE = /\blogin\.service\.js['"]/
  const ARQUIVO_DO_LOGIN_SERVICE = 'apps/api/src/sessao/login/login.service.ts'

  /** Quem, fora de teste, importa, reexporta ou carrega por `import()` o `login.service` (ele não cita a si mesmo). */
  const quemImportaOLoginService = (arquivos: readonly Arquivo[]): string[] =>
    arquivos
      .filter((arquivo) => !deTeste(arquivo.caminho))
      .filter((arquivo) => IMPORTA_O_LOGIN_SERVICE.test(semComentarios(arquivo.texto)))
      .map((arquivo) => arquivo.caminho)
      .sort()

  it('fora de teste, só o login-email.controller.ts e o sessao.module.ts o importam', () => {
    const arquivos = arquivosDoRepositorio()
    expect(arquivos.filter((arquivo) => arquivo.caminho === ARQUIVO_DO_LOGIN_SERVICE)).toHaveLength(1)
    expect(quemImportaOLoginService(arquivos)).toEqual(['apps/api/src/sessao/login/login-email.controller.ts', 'apps/api/src/sessao/sessao.module.ts'])
  })

  it('a varredura reprova quem mais o importa, reexporta ou carrega por import dinâmico, e deixa o teste e o comentário passarem', () => {
    const fora = [
      { caminho: 'apps/api/src/sessao/conclusao/conclusao-de-login.ts', texto: "import { hashDoRefresh } from './login.service.js'" },
      { caminho: 'apps/api/src/operacao/sessao/sessao.service.ts', texto: "export * from '../sessao/login.service.js'" },
      { caminho: 'apps/worker/src/atalho.ts', texto: "const modulo = await import('../../api/src/sessao/login.service.js')" },
    ]
    const inocentes = [
      { caminho: 'apps/api/src/sessao/login/login.service.test.ts', texto: "import * as loginService from './login.service.js'" },
      { caminho: 'apps/api/src/sessao/convite/convite.service.ts', texto: "/** Antes vinha do './login.service.js'. */\n// e do 'login.service'" },
    ]
    expect(quemImportaOLoginService([...fora, ...inocentes])).toEqual(fora.map((arquivo) => arquivo.caminho).sort())
  })
})

describe('arquitetura: o controller valida pelo pipe no parâmetro, e as funções antigas de entrada não existem mais (X5, 17.0, D81)', () => {
  /** A trava do resto é o bloco `no-restricted-syntax` do ESLint; estes `it` pegam o `safeParse` e as três funções, que o bloco não vê. */
  const CHAMA_O_LEITOR_ANTIGO = /\b(safeParse|lerEntrada|idDoCaminho|lerConsultaPaginada)\b/
  const DECLARA_UMA_DAS_TRES = /\b(function|const)\s+(lerEntrada|idDoCaminho|lerConsultaPaginada)\b/
  const ARQUIVO_DA_PAGINACAO = 'apps/api/src/http/paginacao.ts'
  const ehControllerDaApi = (caminho: string): boolean => /^apps\/api\/src\/.+\.controller\.ts$/.test(caminho)

  /** Os controllers cujo código (sem comentário) chama uma das quatro. */
  const quemLeAEntradaPorFora = (arquivos: readonly Arquivo[]): string[] =>
    arquivos
      .filter((arquivo) => ehControllerDaApi(arquivo.caminho))
      .filter((arquivo) => CHAMA_O_LEITOR_ANTIGO.test(semComentarios(arquivo.texto)))
      .map((arquivo) => arquivo.caminho)
      .sort()

  it('nenhum controller chama safeParse, lerEntrada, idDoCaminho nem lerConsultaPaginada', () => {
    const arquivos = arquivosDoRepositorio()
    expect(arquivos.filter((arquivo) => ehControllerDaApi(arquivo.caminho)).length).toBeGreaterThan(50)
    expect(quemLeAEntradaPorFora(arquivos)).toEqual([])
  })

  it('lerEntrada, idDoCaminho e lerConsultaPaginada não são declaradas em apps nem em packages, e o paginacao.ts só guarda a paginação', () => {
    const arquivos = arquivosDoRepositorio().filter((arquivo) => /^(apps|packages)\//.test(arquivo.caminho) && arquivo.caminho !== ESTE_ARQUIVO)
    expect(arquivos.filter((arquivo) => DECLARA_UMA_DAS_TRES.test(semComentarios(arquivo.texto))).map((arquivo) => arquivo.caminho)).toEqual([])
    const entrada = arquivos.find((arquivo) => arquivo.caminho === ARQUIVO_DA_PAGINACAO)
    expect(entrada?.texto).toContain('export function paginar')
    expect(semComentarios(entrada?.texto ?? '')).not.toMatch(/\b(lerEntrada|idDoCaminho|lerConsultaPaginada)\b/)
  })

  it('a varredura reprova o controller que devolve um safeParse ou uma das três funções, em qualquer módulo, e deixa o comentário, o service e o teste passarem', () => {
    const fora = [
      { caminho: 'apps/api/src/tutor/tutor.controller.ts', texto: 'const lida = esquema.safeParse(corpo)' },
      { caminho: 'apps/api/src/material/material.controller.ts', texto: 'return lerEntrada(esquema, corpo)' },
      { caminho: 'apps/api/src/privacidade/privacidade.controller.ts', texto: 'idDoCaminho(id)' },
      { caminho: 'apps/api/src/estrutura/turma/turma.controller.ts', texto: 'lerConsultaPaginada(consulta)' },
      { caminho: 'apps/api/src/modulo-novo/modulo-novo.controller.ts', texto: 'esquema.safeParse(corpo)' },
    ]
    const inocentes = [
      { caminho: 'apps/api/src/sistema/saude.controller.ts', texto: '/** Antes: lerEntrada(esquema, corpo). */\n// idDoCaminho(id)\n@Body(new ZodValidationPipe(esquema)) corpo: Pedido' },
      { caminho: 'apps/api/src/tutor/tutor.service.ts', texto: 'esquema.safeParse(resposta)' },
      { caminho: 'apps/api/src/tutor/tutor.controller.test.ts', texto: 'esquema.safeParse(corpo)' },
    ]
    expect(quemLeAEntradaPorFora([...fora, ...inocentes])).toEqual(fora.map((arquivo) => arquivo.caminho).sort())
  })
})
