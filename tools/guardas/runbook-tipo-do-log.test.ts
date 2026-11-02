import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { raizRepositorio } from '../ci/executar.ts'
import { lerTodosOsMapas } from '../renomear/reaplicar.ts'

/**
 * `summarizeError` grava `erro.name` no campo `tipo` do log. A X8 (nomes de mercado) renomeou estas classes de erro do servidor, e
 * com elas o `tipo`: busca de log salva com o nome antigo deixa de casar, sem erro. O runbook diz o nome novo de cada uma.
 * O erro do cliente web não chega a log do servidor: fica fora.
 *
 * Só o nome novo é escrito aqui. O antigo vem dos mapas da renomeação (`tools/renomear/mapas/*.json`), onde ele já mora: repeti-lo no
 * teste o deixaria como resto de nome antigo para o `restos`, e um 21º renomeado exigiria editar dois lugares.
 */
const TIPOS_NOVOS: readonly string[] = [
  'InvalidArgumentError',
  'FileStorageUnavailableError',
  'AuditoriaRejectedError',
  'InvalidConfigError',
  'DesativacaoRejectedError',
  'DomainException',
  'LLMError',
  'InvariantException',
  'ProviderError',
  'QueueFacingError',
  'JobFailureError',
  'InvalidAuditoriaMapError',
  'MaterialSemConteudoAproveitavelError',
  'MigrationFailedError',
  'OperadorRejectedError',
  'JobRequestRejectedError',
  'QueueTimeoutError',
  'ExternalProviderError',
  'RoutesWithoutPermissaoError',
  'SecretDecryptionError',
]

/** Os nomes antigos de cada nome novo, segundo as entradas `simbolo` dos mapas aplicados (lidos como o `restos` os lê). */
function antigosPorNovo(): Map<string, Set<string>> {
  const antigos = new Map<string, Set<string>>(TIPOS_NOVOS.map((novo) => [novo, new Set<string>()]))
  for (const mapa of lerTodosOsMapas(raizRepositorio)) {
    for (const entrada of mapa.entradas) {
      if (entrada.tipo === 'simbolo') antigos.get(entrada.para)?.add(entrada.de)
    }
  }
  return antigos
}

/**
 * Os pares `[antigo, novo]`, na ordem de `TIPOS_NOVOS`. O nome novo sem antigo nos mapas fica fora dos pares, e os casos que usam os
 * pares não reclamam: quem impede o branco é o caso "cada `tipo` novo tem um único nome antigo nos mapas da renomeação".
 */
function tiposRenomeados(): ReadonlyArray<readonly [antigo: string, novo: string]> {
  const antigos = antigosPorNovo()
  return TIPOS_NOVOS.flatMap((novo) => [...(antigos.get(novo) ?? [])].map((antigo): readonly [string, string] => [antigo, novo]))
}

const TITULO_DA_SECAO = '## Buscar um erro no log pelo `tipo`'

function arquivosDoRepositorio(): string[] {
  const resultado = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: raizRepositorio, encoding: 'utf8' })
  expect(resultado.status).toBe(0)
  return resultado.stdout.split('\n').filter(Boolean)
}

function ler(caminho: string): string {
  return readFileSync(join(raizRepositorio, caminho), 'utf8')
}

/** O corpo da seção do runbook, até o próximo título de segundo nível. */
function secaoDoRunbook(): string {
  const runbook = ler('docs/runbook.md')
  const inicio = runbook.indexOf(`${TITULO_DA_SECAO}\n`)
  if (inicio === -1) return ''
  const resto = runbook.slice(inicio + TITULO_DA_SECAO.length)
  const fim = resto.search(/\n## /)
  return fim === -1 ? resto : resto.slice(0, fim)
}

/** Os arquivos de código de produção do servidor que podem dar nome a uma classe de erro. */
function codigoDoServidor(): string[] {
  return arquivosDoRepositorio().filter((caminho) => /^(apps\/(api|worker|despachante|realtime)|packages\/(core|shared))\/src\/.*\.ts$/.test(caminho) && !/\.test\.ts$/.test(caminho))
}

describe('runbook: o `tipo` do log das classes de erro renomeadas na X8', () => {
  it('cada `tipo` novo tem um único nome antigo nos mapas da renomeação', () => {
    const antigos = antigosPorNovo()
    expect(TIPOS_NOVOS.filter((novo) => antigos.get(novo)?.size !== 1)).toEqual([])
  })

  it('o runbook diz, para cada classe de erro renomeada, o `tipo` antigo e o novo, na mesma linha', () => {
    const secao = secaoDoRunbook()
    expect(secao).not.toBe('')
    const linhas = secao.split('\n')
    const semLinha = tiposRenomeados().filter(([antigo, novo]) => !linhas.some((linha) => linha.includes(`\`${antigo}\``) && linha.includes(`\`${novo}\``)))
    expect(semLinha).toEqual([])
  })

  it('o `tipo` novo de cada linha é o `name` de uma classe do código, e o antigo não é mais de nenhuma', () => {
    const conteudo = codigoDoServidor().map(ler).join('\n')
    const definidos = (nome: string) => new RegExp(`\\bname(?:\\s*=|:)\\s*'${nome}'`).test(conteudo)
    expect(TIPOS_NOVOS.filter((novo) => !definidos(novo))).toEqual([])
    expect(tiposRenomeados().filter(([antigo]) => definidos(antigo))).toEqual([])
  })

  it('nenhuma regra de alerta busca pelo `tipo` antigo', () => {
    const regras = arquivosDoRepositorio().filter((caminho) => caminho.startsWith('infra/grafana/alertas/'))
    expect(regras.length).toBeGreaterThan(0)
    const conteudo = regras.map(ler).join('\n')
    expect(tiposRenomeados().filter(([antigo]) => conteudo.includes(antigo))).toEqual([])
  })
})

describe('citação de teste de `infra/test/`', () => {
  it('nenhum arquivo do repositório cita um arquivo de `infra/test/` que não existe (o histórico de `tasks/` e dos mapas de renomeação fica de fora)', () => {
    // O nome de uma letra (`a.int.test.ts`, `i.test.ts`) é entrada sintética de teste do portão e da conferência da renomeação, não citação.
    const historico = (caminho: string) => caminho.startsWith('tasks/') || caminho.startsWith('tools/renomear/mapas/')
    const citacoes = arquivosDoRepositorio()
      .filter((caminho) => !historico(caminho) && /\.(ts|tsx|mjs|cjs|md|yaml|yml|json)$/.test(caminho) && existsSync(join(raizRepositorio, caminho)))
      .flatMap((caminho) => [...ler(caminho).matchAll(/infra\/test\/[\w-]{2,}[\w.-]*\.ts\b/g)].map((achado) => ({ caminho, citado: achado[0] })))
    const quebradas = citacoes.filter(({ citado }) => !existsSync(join(raizRepositorio, citado)))
    expect(quebradas).toEqual([])
  })
})
