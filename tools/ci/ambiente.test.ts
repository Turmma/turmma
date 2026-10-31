import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { COMANDO_HEALTHCHECK_BATIMENTO } from '../../packages/core/src/runtime/heartbeat.ts'
import { PROCESSOS_DA_FILA } from '../testes/compose.ts'
import { lerAmbienteDeCarga, lerAmbienteDeTeste, lerAmbienteExemplo, valorObrigatorio } from './compose.ts'
import { raizRepositorio } from './executar.ts'

const lerArquivo = (caminho: string) => readFileSync(join(raizRepositorio, caminho), 'utf8')

interface Servico {
  healthcheck?: { test?: unknown }
  restart?: string
  depends_on?: Record<string, { condition?: string }>
}

describe('.env.example e compose', () => {
  it('toda variável usada pelo compose está definida e preenchida em .env.example', () => {
    const ambiente = lerAmbienteExemplo()
    const usadas = new Set([...lerArquivo('infra/compose.yml').matchAll(/\$\{([A-Z0-9_]+)/g)].map((achado) => achado[1]))
    expect(usadas.size).toBeGreaterThan(0)
    for (const variavel of usadas) {
      expect(ambiente[variavel ?? ''], `${variavel} ausente em .env.example`).toBeTruthy()
    }
  })

  it('toda variável do compose é obrigatória: nada sobe com valor padrão escondido', () => {
    expect(lerArquivo('infra/compose.yml')).not.toMatch(/\$\{[A-Z0-9_]+:?-/)
  })

  it('todo serviço do compose tem healthcheck, para `up --wait` esperar o serviço de verdade', () => {
    // `merge`: as réplicas (api-2, realtime-2) herdam o serviço da primeira com `<<: *âncora`, como no compose.
    const { services } = parse(lerArquivo('infra/compose.yml'), { merge: true }) as { services: Record<string, Servico> }
    expect(Object.keys(services).length).toBeGreaterThan(0)
    // O serviço que roda uma vez e sai (migrar) não tem healthcheck: quem depende dele espera o término com sucesso.
    const deUmaVez = new Set(
      Object.values(services).flatMap((servico) =>
        Object.entries(servico.depends_on ?? {})
          .filter(([, dependencia]) => dependencia.condition === 'service_completed_successfully')
          .map(([nome]) => nome),
      ),
    )
    for (const [nome, servico] of Object.entries(services)) {
      if (deUmaVez.has(nome)) {
        expect(servico.restart, `${nome} roda uma vez e não pode reiniciar`).toBe('no')
        continue
      }
      expect(servico.healthcheck?.test, `${nome} sem healthcheck`).toBeDefined()
    }
  })

  it('despachante e worker, sem HTTP, usam o healthcheck do batimento com a mesma idade máxima do código', () => {
    const { services } = parse(lerArquivo('infra/compose.yml'), { merge: true }) as { services: Record<string, Servico> }
    for (const nome of ['despachante-1', 'despachante-2', 'worker-interativo-1', 'worker-interativo-2', 'worker-lote-1', 'worker-lote-2']) {
      expect(services[nome]?.healthcheck?.test, nome).toEqual(['CMD', 'node', '-e', COMANDO_HEALTHCHECK_BATIMENTO])
    }
  })

  it('api, realtime, despachante e worker têm threads do libuv e resolvedor com prazo curto, para nome que não resolve não tirar a vez do Postgres', () => {
    const { services } = parse(lerArquivo('infra/compose.yml'), { merge: true }) as {
      services: Record<string, Servico & { dns_opt?: string[]; environment?: Record<string, string> }>
    }
    const processosNode = ['api-1', 'api-2', 'realtime-1', 'realtime-2', ...PROCESSOS_DA_FILA]
    for (const nome of processosNode) {
      expect(services[nome]?.environment?.['UV_THREADPOOL_SIZE'], nome).toMatch(/^\$\{UV_THREADPOOL_SIZE:\?/)
      expect(services[nome]?.dns_opt, nome).toEqual(['timeout:1', 'attempts:2'])
    }
    // Quatro, o padrão do Node, foi o que deixou a conexão ao Postgres 15 s na fila atrás de nomes parados.
    expect(Number(lerAmbienteExemplo()['UV_THREADPOOL_SIZE'])).toBeGreaterThanOrEqual(16)
  })

  it('migrar roda antes de toda instância que usa o banco', () => {
    const { services } = parse(lerArquivo('infra/compose.yml'), { merge: true }) as {
      services: Record<string, Servico & { environment?: Record<string, string> }>
    }
    const usamOBanco = Object.entries(services).filter(([nome, servico]) => nome !== 'migrar' && servico.environment?.['BANCO_URL'] !== undefined)
    expect(usamOBanco.map(([nome]) => nome).sort()).toEqual([
      'api-1',
      'api-2',
      'despachante-1',
      'despachante-2',
      'realtime-1',
      'realtime-2',
      'worker-interativo-1',
      'worker-interativo-2',
      'worker-lote-1',
      'worker-lote-2',
    ])
    for (const [nome, servico] of usamOBanco) {
      expect(servico.depends_on?.['migrar']?.condition, nome).toBe('service_completed_successfully')
    }
  })

  it('worker-interativo atende interativa e normal, worker-lote só lote, com o pool do banco igual à soma dos pools das filas', () => {
    const ambiente = lerAmbienteExemplo()
    const { services } = parse(lerArquivo('infra/compose.yml'), { merge: true }) as {
      services: Record<string, Servico & { environment?: Record<string, string> }>
    }
    const esperado = { interativo: 'interativa,normal', lote: 'lote' }
    for (const [papel, filas] of Object.entries(esperado)) {
      for (const replica of [1, 2]) {
        const nome = `worker-${papel}-${replica}`
        const variaveis = services[nome]?.environment ?? {}
        expect(variaveis['FILAS'], nome).toBe(filas)
        const somaDosPools = filas.split(',').reduce((soma, fila) => soma + Number(ambiente[`WORKER_POOL_${fila.toUpperCase()}`]), 0)
        const poolDoBanco = Number(ambiente[String(variaveis['BANCO_POOL_MAXIMO']).replace(/^\$\{([A-Z_]+):\?.*\}$/, '$1')])
        expect(poolDoBanco, nome).toBe(somaDosPools)
      }
    }
  })

  it('as vagas padrão de dez escolas (D25) cabem nos pools das duas réplicas, e as de uma escola cabem numa réplica só', () => {
    const ambiente = lerAmbienteExemplo()
    const ESCOLAS_DO_PRIMEIRO_ANO = 10
    const REPLICAS = 2
    for (const fila of ['INTERATIVA', 'NORMAL', 'LOTE']) {
      const vagas = Number(ambiente[`VAGAS_ESCOLA_${fila}`])
      const pool = Number(ambiente[`WORKER_POOL_${fila}`])
      expect(ESCOLAS_DO_PRIMEIRO_ANO * vagas, fila).toBeLessThanOrEqual(REPLICAS * pool)
      // Com uma réplica fora, ou somando a vaga da rotina do sistema (que usa o mesmo padrão), a soma
      // pode passar do pool: aí o job espera a vez na fila, e o teto de cada escola segue valendo,
      // porque o worker confere a vaga ao começar (slots.int.test.ts, "publicação ambígua"). O que não
      // pode é uma escola sozinha não caber no pool de uma réplica.
      expect(vagas, fila).toBeLessThanOrEqual(pool)
    }
  })

  it('o compose de teste só troca portas e o que depende delas, e nada coincide com o ambiente de desenvolvimento', () => {
    const exemplo = lerAmbienteExemplo()
    const teste = parseEnv(lerArquivo('infra/teste.env'))
    expect(Object.keys(teste).length).toBeGreaterThan(0)
    for (const [chave, valor] of Object.entries(teste)) {
      expect(chave, 'a sobreposição de teste é só de porta, e do endereço que carrega uma').toMatch(/(_PORTA_HOST|_URL)$/)
      expect(exemplo[chave], `${chave} não existe em .env.example`).toBeDefined()
      expect(valor).not.toBe(exemplo[chave])
    }
  })

  it('as portas publicadas dos ambientes de teste e de carga ficam abaixo da faixa efêmera do Linux', () => {
    // A faixa padrão do `ip_local_port_range` é 32768–60999, no runner e na máquina. Porta publicada dentro dela
    // pode ser sorteada como origem de uma conexão de saída do próprio teste enquanto o serviço está parado, e o
    // `compose start` falha com "address already in use" (correção 2026-09-23-porta-do-teste-na-faixa-efemera).
    // Confere o ambiente que o compose de fato sobe (`.env.example` com a sobreposição por cima), com as portas
    // tiradas do `ports:` de cada serviço: porta nova que a sobreposição esqueceu herda a do desenvolvimento, que
    // está dentro da faixa, e falha aqui com o nome dela.
    const INICIO_DA_FAIXA_EFEMERA = 32_768
    const servicos = ['infra/compose.yml', 'infra/compose.carga.yml'].flatMap(
      (arquivo) => Object.values((parse(lerArquivo(arquivo)) as { services?: Record<string, { ports?: string[] }> }).services ?? {}),
    )
    const publicadas = servicos
      .flatMap((servico) => servico.ports ?? [])
      .flatMap((porta) => [...porta.matchAll(/\$\{([A-Z0-9_]+)/g)].map((achado) => achado[1] ?? ''))
    expect(publicadas.length).toBeGreaterThan(10)
    for (const [nome, ambiente] of [
      ['teste', lerAmbienteDeTeste()],
      ['carga', lerAmbienteDeCarga()],
    ] as const) {
      for (const variavel of publicadas) {
        expect(Number(valorObrigatorio(ambiente, variavel)), `${nome}: ${variavel}`).toBeLessThan(INICIO_DA_FAIXA_EFEMERA)
      }
    }
  })

  it('o retorno do login pela conta da escola aponta para a web do próprio ambiente', () => {
    // O provedor devolve o navegador a este endereço (13.0, 19.0): apontado para a porta do outro ambiente, o
    // e2e cairia na web do desenvolvimento, ou em porta nenhuma.
    for (const [nome, ambiente] of [
      ['.env.example', lerAmbienteExemplo()],
      ['infra/teste.env', lerAmbienteDeTeste()],
    ] as const) {
      const retorno = new URL(valorObrigatorio(ambiente, 'LOGIN_EXTERNO_RETORNO_URL'))
      expect(retorno.port, nome).toBe(valorObrigatorio(ambiente, 'WEB_PORTA_HOST'))
    }
  })

  it('a raiz sobe com .env.example, e .env local fica fora do git', () => {
    const raiz = parse(lerArquivo('compose.yaml')) as { include: Array<{ path: string; env_file: string }> }
    expect(raiz.include).toEqual([{ path: 'infra/compose.yml', env_file: '.env.example' }])
    expect(lerArquivo('.gitignore').split('\n')).toContain('.env')
  })
})
