import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { lerAmbienteExemplo } from './compose.ts'
import { raizRepositorio } from './executar.ts'

// A troca de instância sem 502 depende de números espalhados por quatro arquivos. Cada relação
// abaixo, quebrada, derruba requisição ou tira as duas instâncias do ar, sem erro de sintaxe
// nenhum para avisar.

const lerArquivo = (caminho: string) => readFileSync(join(raizRepositorio, caminho), 'utf8')
const caddyfile = lerArquivo('infra/Caddyfile')
const blocoDaSonda = caddyfile.slice(caddyfile.indexOf('(sonda_e_troca) {'), caddyfile.indexOf(':8080 {'))

/**
 * As diretivas de um bloco `log <nome> { ... }` do Caddyfile, sem indentação nem comentário, na ordem
 * em que estão. Serve para afirmar o bloco **inteiro** em vez de uma diretiva por regex: é o que fecha
 * a classe de edit que esvazia as negativas de `infra/test/borda.int.test.ts` sem nenhum guarda ver.
 * Tolerante a espaço ou tabulação, para reformatação do arquivo não virar vermelho sem explicação.
 */
function diretivasDoBloco(nome: string): string[] {
  const partida = new RegExp(String.raw`^[ \t]*log ${nome} \{$([\s\S]*?)^[ \t]*\}$`, 'm').exec(caddyfile)
  expect(partida, `bloco \`log ${nome}\` não encontrado no Caddyfile`).not.toBeNull()
  return (partida?.[1] ?? '')
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha !== '' && !linha.startsWith('#'))
}

function segundos(texto: string): number {
  const partes = /^(\d+)(ms|s|m)$/.exec(texto)
  if (partes === null) throw new Error(`duração fora do formato: ${texto}`)
  const valor = Number(partes[1])
  return partes[2] === 'ms' ? valor / 1000 : partes[2] === 'm' ? valor * 60 : valor
}

function diretiva(nome: string): string {
  const achado = new RegExp(`^\\s*${nome}\\s+(\\S+)\\s*$`, 'm').exec(blocoDaSonda)
  if (achado?.[1] === undefined) throw new Error(`${nome} ausente na sonda da borda`)
  return achado[1]
}

const ambiente = lerAmbienteExemplo()
const esperaDaBordaS = Number(ambiente['DRENAGEM_ESPERA_BORDA_MS']) / 1000
const prazoS = Number(ambiente['DRENAGEM_PRAZO_MS']) / 1000

describe('borda (infra/Caddyfile) e drenagem das instâncias', () => {
  it('as duas reverse_proxy (API e realtime) usam a mesma sonda e a mesma troca', () => {
    expect(caddyfile.match(/import sonda_e_troca/g)).toHaveLength(2)
    expect(diretiva('health_uri')).toBe('/prontidao')
  })

  it('a instância lenta não sai do balanceamento numa rodada só: timeout de pelo menos 3 s e duas falhas seguidas', () => {
    expect(segundos(diretiva('health_timeout'))).toBeGreaterThanOrEqual(3)
    expect(Number(diretiva('health_fails'))).toBeGreaterThanOrEqual(2)
  })

  it('a espera da drenagem cobre o tempo de a borda perceber o 503, com folga de 1 s', () => {
    const percepcaoS = segundos(diretiva('health_interval')) * Number(diretiva('health_fails'))
    expect(esperaDaBordaS).toBeGreaterThanOrEqual(percepcaoS + 1)
  })

  it('espera < prazo da drenagem < tempo que o Docker dá antes do SIGKILL, em toda instância que drena', () => {
    const { services } = parse(lerArquivo('infra/compose.yml'), { merge: true }) as {
      services: Record<string, { environment?: Record<string, string>; stop_grace_period?: string }>
    }
    const quemDrena = Object.entries(services).filter(([, servico]) => servico.environment?.['DRENAGEM_PRAZO_MS'] !== undefined)
    expect(quemDrena.map(([nome]) => nome).sort()).toEqual(['api-1', 'api-2', 'realtime-1', 'realtime-2'])
    expect(esperaDaBordaS).toBeLessThan(prazoS)
    for (const [nome, servico] of quemDrena) {
      expect(segundos(servico.stop_grace_period ?? '10s'), nome).toBeGreaterThan(prazoS)
    }
  })

  it('a borda fecha a conexão ociosa antes da instância: keepalive da borda < OCIOSIDADE_HTTP_MS', () => {
    const ociosidade = /export const OCIOSIDADE_HTTP_MS = ([\d_]+)/.exec(lerArquivo('packages/nucleo/src/instancia/drenagem.ts'))
    expect(ociosidade?.[1]).toBeDefined()
    expect(segundos(diretiva('keepalive'))).toBeLessThan(Number(ociosidade?.[1]?.replaceAll('_', '')) / 1000)
  })

  it('o erro da própria borda é o envelope tipado, com a mensagem do catálogo', () => {
    const corpo = /respond `(\{.*\})` 503/.exec(caddyfile)?.[1]
    expect(corpo).toBeDefined()
    const envelope = JSON.parse(corpo ?? '') as { erro: Record<string, string> }
    expect(envelope).toEqual({
      erro: {
        codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO,
        mensagem: MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO,
        requisicaoId: '{http.request.uuid}',
      },
    })
    // O cliente espera o mesmo tempo, venha o 503 da borda ou da API.
    const daApi = /export const DEFAULT_RETRY_AFTER_SECONDS = (\d+)/.exec(lerArquivo('packages/nucleo/src/erro/erro-de-dominio.ts'))?.[1]
    expect(daApi).toBeDefined()
    expect(/header Retry-After (\d+)/.exec(caddyfile)?.[1]).toBe(daApi)
  })

  it('nada de requisição no log: acesso, erro por requisição, proxy e API de administração fora do log padrão; só a sonda à parte', () => {
    expect(caddyfile).not.toMatch(/^\s*log\s*\{/m)
    // Os dois blocos **por inteiro**, e não um regex por diretiva.
    //
    // Esta correção tropeçou cinco vezes na mesma armadilha — asserção negativa cuja entrada pode ser
    // esvaziada por um edit que nenhum guarda enxerga —, e cada conserto por diretiva abria a próxima:
    // `exclude` trocado, `output` trocado (`file`, `discard`), `format console` (que muda o encoder e
    // cega qualquer negativa por **nome** de logger), `level ERROR`. A família é aberta por construção:
    // toda diretiva do bloco é um jeito de mudar a entrada das negativas de `borda.int.test.ts`, e a
    // próxima versão do Caddy pode acrescentar outra.
    //
    // Fixar o bloco fecha a classe: pega `output`, `format`, `level`, `exclude`, `include`, a ordem
    // entre elas e o que vier depois, com mensagem de falha que mostra exatamente o que mudou.
    expect(diretivasDoBloco('default')).toEqual([
      'output stderr',
      'format json',
      'exclude http.log.access http.log.error http.handlers.reverse_proxy admin.api',
    ])
    expect(diretivasDoBloco('sonda')).toEqual([
      'output stderr',
      'format json',
      'include http.handlers.reverse_proxy.health_checker',
    ])
    // E são só esses dois: um terceiro bloco poderia religar o que os dois de cima desligam.
    // `[ \t]*` e não tabulação literal nem `+`: medido nas duas pontas — um terceiro bloco indentado
    // com espaços passava verde com tabulação literal, e um `log acesso { }` na **coluna 0** dentro do
    // bloco `:8080 {` passava verde com `+`. O `not.toMatch(/^\s*log\s*\{/m)` acima não pega, porque é
    // bloco nomeado.
    expect([...caddyfile.matchAll(/^[ \t]*log (\S+) \{$/gm)].map(([, nome]) => nome)).toEqual(['default', 'sonda'])
  })
})
