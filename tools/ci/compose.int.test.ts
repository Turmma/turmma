import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:net'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { compose, composeOuFalha, recriarDoZero } from '../testes/compose.ts'
import { AMBIENTE_DE_TESTE, ARGUMENTOS_COMPOSE, ETAPA_DO_LOG_DA_FALHA, PROJETO_TESTE, lerAmbienteDeTeste, valorObrigatorio } from './compose.ts'
import { lerLinhaDoDespejo } from './despejo-da-falha.ts'
import { raizRepositorio } from './executar.ts'

/** Ambiente mínimo, sem nenhuma variável do projeto herdada do shell de quem roda. */
function ambienteLimpo(): Record<string, string> {
  const ambiente: Record<string, string> = {}
  for (const chave of ['PATH', 'HOME', 'DOCKER_HOST', 'DOCKER_CONFIG', 'DOCKER_CONTEXT']) {
    const valor = process.env[chave]
    if (valor !== undefined) ambiente[chave] = valor
  }
  return ambiente
}

function dockerLimpo(argumentos: string[]) {
  return spawnSync('docker', argumentos, { cwd: raizRepositorio, env: ambienteLimpo(), encoding: 'utf8' })
}

interface PortaPublicada {
  host_ip?: string
  published?: string
}

describe('ambiente do compose', () => {
  it('sobe só com .env.example: sem ele o compose recusa, com ele resolve tudo', () => {
    expect(existsSync(join(raizRepositorio, 'infra', '.env'))).toBe(false)
    expect(dockerLimpo(['compose', '-f', 'infra/compose.yml', 'config', '--quiet']).status).not.toBe(0)
    const comExemplo = dockerLimpo(['compose', '--env-file', '.env.example', '-f', 'infra/compose.yml', 'config', '--quiet'])
    expect(comExemplo.stderr).toBe('')
    expect(comExemplo.status).toBe(0)
  })

  it('`docker compose up` na raiz resolve a configuração só com os arquivos versionados', () => {
    const raiz = dockerLimpo(['compose', 'config', '--quiet'])
    expect(raiz.stderr).toBe('')
    expect(raiz.status).toBe(0)
  })

  it('o `build` resolvido de todo serviço aponta para um Dockerfile que existe, com o estágio do target (sem construir)', () => {
    interface Build {
      context: string
      dockerfile?: string
      target?: string
    }
    const configuracao = JSON.parse(composeOuFalha('config', '--format', 'json')) as { services: Record<string, { build?: Build }> }
    const construidos: [string, Build][] = []
    for (const [nome, servico] of Object.entries(configuracao.services)) if (servico.build !== undefined) construidos.push([nome, servico.build])
    expect(construidos.length).toBeGreaterThanOrEqual(6)
    for (const [nome, { context, dockerfile, target }] of construidos) {
      expect(dockerfile, `${nome}: sem dockerfile`).toBeDefined()
      expect(target, `${nome}: sem target`).toBeDefined()
      const caminho = resolve(context, dockerfile ?? '')
      expect(existsSync(caminho), `${nome}: ${caminho} não existe`).toBe(true)
      expect(readFileSync(caminho, 'utf8'), `${nome}: sem o estágio ${target ?? ''}`).toMatch(new RegExp(`^FROM \\S+ AS ${target ?? ''}$`, 'm'))
    }
  })

  it('toda porta publicada, de todos os serviços, escuta só no loopback da máquina', () => {
    const configuracao = JSON.parse(composeOuFalha('config', '--format', 'json')) as {
      services: Record<string, { ports?: PortaPublicada[] }>
    }
    const portas = Object.values(configuracao.services).flatMap((servico) => servico.ports ?? [])
    // Todo serviço com HTTP publica porta (a observabilidade, duas: Grafana e Prometheus); migrar, despachante
    // e worker não atendem ninguém e não publicam.
    const semPorta = ['migrar', 'despachante-1', 'despachante-2', 'worker-interativo-1', 'worker-interativo-2', 'worker-lote-1', 'worker-lote-2', 'worker-pdf']
    for (const [nome, servico] of Object.entries(configuracao.services)) {
      if (semPorta.includes(nome)) expect(servico.ports, nome).toBeUndefined()
      else expect(servico.ports?.length, nome).toBe(nome === 'observabilidade' ? 2 : 1)
    }
    for (const porta of portas) {
      expect(porta.host_ip).toBe('127.0.0.1')
    }
  })

  it('o compose sobe o projeto e publica as portas do ambiente de teste deste checkout, e de nenhum outro', () => {
    // O que o Docker resolve, e não o que `compose.ts` calcula: com o ambiente limpo, o projeto e as portas só podem
    // ter vindo dos argumentos. É o elo entre o número do ambiente (`EDUCA_AMBIENTE_TESTE` ou `.processo/ambiente`)
    // e o que de fato sobe: um `--env-file` fora de ordem deixaria o `educa-teste-2` nas portas do ambiente 0, e
    // os testes, que leem as portas de `lerAmbienteDeTeste`, falariam com o serviço de outro checkout.
    const resultado = dockerLimpo([...ARGUMENTOS_COMPOSE, 'config', '--format', 'json'])
    expect(resultado.status, resultado.stderr).toBe(0)
    const configuracao = JSON.parse(resultado.stdout) as {
      name: string
      services: Record<string, { image?: string; ports?: PortaPublicada[]; environment?: Record<string, string> }>
    }
    expect(configuracao.name).toBe(PROJETO_TESTE)
    expect(configuracao.name).toBe(AMBIENTE_DE_TESTE === 0 ? 'educa-teste' : `educa-teste-${String(AMBIENTE_DE_TESTE)}`)

    // A imagem que o compose constrói é deste ambiente: com o nome do ambiente 0 num checkout de outro número, o e2e
    // daqui rodaria sobre o código de quem construiu por último. O que o Docker resolve cobre a âncora (`api-2`).
    const etiqueta = AMBIENTE_DE_TESTE === 0 ? ':local' : `:teste-${String(AMBIENTE_DE_TESTE)}`
    const nossas = Object.entries(configuracao.services).filter(([, servico]) => servico.image?.startsWith('educa-'))
    expect(nossas.length).toBeGreaterThanOrEqual(11)
    for (const [nome, servico] of nossas) expect(servico.image?.endsWith(etiqueta), `${nome}: ${servico.image ?? ''}`).toBe(true)

    const ambiente = lerAmbienteDeTeste()
    const esperadas = Object.entries(ambiente).filter(([chave]) => chave.endsWith('_PORTA_HOST')).map(([, valor]) => valor)
    const publicadas = Object.values(configuracao.services).flatMap((servico) => servico.ports ?? []).map((porta) => porta.published)
    expect(publicadas.length).toBeGreaterThan(10)
    expect([...publicadas].sort()).toEqual([...esperadas].sort())

    // O que deriva de porta dentro dos serviços acompanha: o retorno do login, que leva a da web, e o endereço
    // público do storage, que o navegador usa para baixar o arquivo.
    for (const api of ['api-1', 'api-2']) {
      const variaveis = configuracao.services[api]?.environment ?? {}
      expect(variaveis['LOGIN_EXTERNO_RETORNO_URL'], api).toBe(`http://127.0.0.1:${valorObrigatorio(ambiente, 'WEB_PORTA_HOST')}/v1/sessao/externa/retorno`)
      expect(variaveis['STORAGE_URL_PUBLICA'], api).toBe(`http://127.0.0.1:${valorObrigatorio(ambiente, 'STORAGE_PORTA_HOST')}`)
    }
  })

  it('Redis de fila não expulsa chave e persiste em AOF; Redis de cache expulsa por LRU', () => {
    const politicaFila = composeOuFalha('exec', '-T', 'redis-fila', 'redis-cli', 'config', 'get', 'maxmemory-policy')
    const aofFila = composeOuFalha('exec', '-T', 'redis-fila', 'redis-cli', 'config', 'get', 'appendonly')
    const politicaCache = composeOuFalha('exec', '-T', 'redis-cache', 'redis-cli', 'config', 'get', 'maxmemory-policy')
    expect(politicaFila).toContain('noeviction')
    expect(aofFila).toMatch(/appendonly\s+yes/)
    expect(politicaCache).toContain('allkeys-lru')
  })

  it('a soma dos pools de todas as instâncias que usam o Postgres cabe no max_connections, com folga para operação', () => {
    const ambiente = lerAmbienteDeTeste()
    const configuracao = JSON.parse(composeOuFalha('config', '--format', 'json')) as {
      services: Record<string, { environment?: Record<string, string | null> }>
    }
    const comPool = Object.entries(configuracao.services).flatMap(([nome, servico]) => {
      const maximo = servico.environment?.['BANCO_POOL_MAXIMO']
      return maximo === undefined || maximo === null ? [] : [{ nome, maximo: Number(maximo) }]
    })
    // Todo processo com pool entra na soma: as duas APIs, os dois realtimes (o handshake lê a sessão), os dois
    // despachantes (com o LISTEN dentro do pool) e os quatro workers.
    expect(comPool.map(({ nome }) => nome).sort()).toEqual([
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
      'worker-pdf',
    ])
    const pools = comPool.map(({ maximo }) => maximo)
    const consultar = (sql: string) =>
      Number(
        composeOuFalha(
          'exec', '-T', 'postgres', 'psql', '-U', valorObrigatorio(ambiente, 'POSTGRES_USUARIO'),
          '-d', valorObrigatorio(ambiente, 'POSTGRES_BANCO'), '-tAc', sql,
        ).trim(),
      )
    const disponiveis = consultar('show max_connections') - consultar('show superuser_reserved_connections')
    // O serviço migrar e o psql de operação abrem conexão fora dos pools.
    const FOLGA_PARA_OPERACAO = 10
    expect(pools.reduce((soma, maximo) => soma + maximo, 0) + FOLGA_PARA_OPERACAO).toBeLessThanOrEqual(disponiveis)
  })

  it('Postgres tem pgvector disponível', () => {
    const ambiente = lerAmbienteDeTeste()
    const saida = composeOuFalha(
      'exec', '-T', 'postgres', 'psql', '-U', valorObrigatorio(ambiente, 'POSTGRES_USUARIO'),
      '-d', valorObrigatorio(ambiente, 'POSTGRES_BANCO'), '-tAc',
      "select count(*) from pg_available_extensions where name = 'vector'",
    )
    expect(saida.trim()).toBe('1')
  })

  it('storage grava e lê com a credencial S3, e recusa quem não assina: bucket nunca é público', async () => {
    const ambiente = lerAmbienteDeTeste()
    const objeto = `http://127.0.0.1:${valorObrigatorio(ambiente, 'STORAGE_PORTA_HOST')}/${valorObrigatorio(ambiente, 'STORAGE_BUCKET')}/fumaca-${Date.now()}.txt`
    const credencial = `${valorObrigatorio(ambiente, 'STORAGE_CHAVE_ACESSO')}:${valorObrigatorio(ambiente, 'STORAGE_CHAVE_SECRETA')}`
    const assinado = (...argumentos: string[]) =>
      spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--aws-sigv4', 'aws:amz:us-east-1:s3', '--user', credencial, ...argumentos], {
        encoding: 'utf8',
      }).stdout

    expect(assinado('-X', 'PUT', '--data-binary', 'sintetico', objeto)).toBe('200')
    expect(assinado(objeto)).toBe('200')
    expect((await fetch(objeto)).status).toBe(403)
    expect((await fetch(objeto, { method: 'PUT', body: 'x' })).status).toBe(403)
    expect(assinado('-X', 'DELETE', objeto)).toBe('204')
  })

  it('nenhum serviço declara `logging`: teto ou driver sem leitura fazem o despejo da falha sair curto ou vazio', () => {
    // O caminho **de configuração do compose** que mata a evidência da falha sem ficar vermelho, com
    // duas portas. Não é o único caminho de configuração que existe — o serviço também decide o que
    // escreve, e o `infra/Caddyfile` usa esse botão —, mas aquele já tem guarda. Por âncora e não por
    // número de linha, que envelheceu três vezes seguidas nesta correção: em `tools/ci/borda.test.ts`,
    // o caso "nada de requisição no log" afirma os dois blocos `log` por inteiro (pega `output`,
    // `format`, `level`, `exclude` e a quantidade de blocos); em `infra/test/borda.int.test.ts`, o caso
    // "a borda não registra acesso nem a URL de requisição que falhou" afirma o resultado no
    // `docker logs`, com controle positivo contra vacuidade. Aqui é o do compose, que não tinha nenhum.
    // O argv continua intacto e o despejo sai com exit 0 nas duas, então nada mais no repositório
    // percebe. É o edit plausível de quem for enxugar as 24,5 mil linhas do job vermelho — e a seção
    // de evidência da correção registra que 88% do log da borda é ruído de healthcheck, o que torna
    // `driver: none` na borda o caso mais provável de todos.
    //
    //   `options: {max-size: 100k}` → o despejo entrega MENOS que as 3.899 linhas do maior serviço
    //     nosso, matando o piso que justifica o `--tail 4000`;
    //   `driver: none` → o despejo entrega ZERO linha daquele serviço, com exit 0 e só um `warning`
    //     em stderr: "configured logging driver does not support reading".
    //
    // Os outros drivers a asserção também proíbe, porque é sobre `logging` inteiro — mas nem todos são
    // porta: `local` e `syslog` entregam tudo (6.000 de 6.000, medido), o primeiro com teto de 20 MB
    // por padrão, que 3.899 linhas não alcançam. `gelf`, `fluentd` e `awslogs` não foram medidos. A
    // correção tem a tabela e diz o que ficou de fora.
    //
    // Por isso a asserção é sobre `logging` inteiro, e não sobre `logging.options`: a segunda porta
    // não declara `options` nenhuma.
    const configuracao = dockerLimpo([...ARGUMENTOS_COMPOSE, 'config', '--format', 'json'])
    expect(configuracao.status, configuracao.stderr).toBe(0)
    const servicos = (JSON.parse(configuracao.stdout) as { services: Record<string, { logging?: unknown }> }).services
    // O laço antes do inventário: um serviço novo que já chegasse com `logging` ficaria vermelho pelas
    // duas asserções, e a que importa é esta — a outra diria só que a lista mudou.
    for (const [nome, servico] of Object.entries(servicos)) {
      expect(servico.logging, `${nome} declara logging: o despejo da falha deixa de ser confiável`).toBeUndefined()
    }
    // Os 20 pelo nome, e não "mais de um" nem uma contagem: um `config` que devolvesse dois serviços
    // deixaria dezoito sem checar e o laço acima passaria, e uma contagem não pega serviço renomeado
    // nem trocado um por um. Com os nomes, o vermelho ainda diz qual apareceu ou sumiu.
    expect(Object.keys(servicos).sort()).toEqual([
      'api-1', 'api-2', 'borda', 'despachante-1', 'despachante-2', 'mailpit', 'migrar',
      'observabilidade', 'oidc-falso', 'postgres', 'realtime-1', 'realtime-2', 'redis-cache', 'redis-fila', 'storage',
      'web', 'worker-interativo-1', 'worker-interativo-2', 'worker-lote-1', 'worker-lote-2', 'worker-pdf',
    ])
  })

  it('o despejo da falha sai cruzável: carimbo do Docker em toda linha, na escala do relógio de parede', () => {
    // Asserção de resultado, e não de argv como `compose.test.ts` e `scripts.test.ts` fazem. Ela
    // existe por dois motivos. O primeiro é provar o que a correção promete: linhas de serviços
    // diferentes ordenam entre si, que é o que faltava para cruzar um 503 com o instante em que a
    // borda mexeu no balanceamento. O segundo é que, se uma versão futura do compose recusar a
    // combinação de flags, o passo sairia não-zero **dentro de uma execução já vermelha**, e
    // `executar.ts` preserva o código original — o despejo falharia em silêncio exatamente na
    // execução em que ele é a única evidência.
    // Os argumentos vêm de `ETAPA_DO_LOG_DA_FALHA`, e não retipados: retipados, o guarda garantiria a
    // combinação de hoje e seguiria verde se o despejo real ganhasse uma flag amanhã. Aqui importar da
    // fonte é seguro, porque o que se afirma é o carimbo no resultado, não a régua do `--tail` (essa
    // fica em `compose.test.ts`, escrita à mão de propósito). Só o `--tail` cai para 15 linhas.
    const argumentos = ETAPA_DO_LOG_DA_FALHA.map((argumento, indice) =>
      ETAPA_DO_LOG_DA_FALHA[indice - 1] === '--tail' ? '15' : argumento,
    )
    // O `map` supõe `--tail` seguido do valor. Virasse `--tail=4000`, o caso passaria a despejar as
    // 150 mil linhas e ficaria lento em vez de vermelho, que é a pior forma de falhar.
    expect(argumentos).toContain('15')
    // `stdout` apenas: `composeOuFalha` concatena `stderr`, e um WARN do compose entraria na conta
    // como "linha sem carimbo".
    const resultado = dockerLimpo([...ARGUMENTOS_COMPOSE, ...argumentos, 'postgres', 'redis-fila'])
    expect(resultado.status, resultado.stderr).toBe(0)
    const linhas = resultado.stdout.split('\n').filter((linha) => linha.trim() !== '')
    expect(linhas.length).toBeGreaterThan(1)

    const carimbos = new Map<string, number[]>()
    for (const linha of linhas) {
      // `<serviço>-1  | <RFC3339Nano> <mensagem do próprio serviço>`, lido por `lerLinhaDoDespejo`: o `|` do
      // prefixo é do compose e não entra na promessa (a esteira 40095652612 recebeu uma linha sem ele). O
      // `JSON.stringify` mostra o que de fato veio, se a próxima linha estranha trouxer outro caractere.
      const lida = lerLinhaDoDespejo(linha)
      expect(lida, `linha sem carimbo do Docker: ${JSON.stringify(linha.slice(0, 120))}`).toBeDefined()
      if (lida === undefined) continue // o `expect` acima já derrubou o caso; isto só estreita o tipo
      carimbos.set(lida.servico, [...(carimbos.get(lida.servico) ?? []), lida.instante])
    }

    // Quem faz o trabalho de separar carimbo do Docker de carimbo do serviço é a **regex de
    // `despejo-da-falha.ts`**, que exige o `T` e o `Z` literais: ela reprova os três formatos reais (`1:M 21 Sep 2026` do Redis,
    // `2026-09-21 20:55:01.773 UTC` do Postgres, `"ts":1789870704.789` do Caddy) e qualquer forma com
    // deslocamento `-03:00`. Os limites abaixo pegam só **erro de época** — epoch, ano errado, fuso a
    // leste rotulado Z. Um carimbo em hora local de fuso a oeste rotulado Z passa por eles, e isso é
    // aceito: a regex já o teria barrado se não fosse `Z`, e aqui é região Brasil (D28).
    //
    // Janela larga dos dois lados de propósito, porque apertá-la custa vermelho falso por motivos que
    // não têm nada a ver com a regra: `integracao.setup.ts` sobe o ambiente de forma idempotente e
    // **não derruba**, então numa máquina de desenvolvimento de pé há dias as últimas 15 linhas podem
    // ser antigas; e a VM do Docker Desktop derrapa o relógio depois de suspender a máquina.
    expect([...carimbos.keys()].length).toBeGreaterThanOrEqual(2)
    const todos = [...carimbos.values()].flat()
    const agora = Date.now()
    expect(Math.max(...todos)).toBeLessThanOrEqual(agora + 60_000)
    expect(Math.min(...todos)).toBeGreaterThan(agora - 30 * 24 * 60 * 60 * 1_000)
  })
})

describe('recriar serviço do compose', () => {
  const SERVICO = 'oidc-falso'

  // O caso deixa o serviço recriado e saudável; se ele falhar no meio, o ambiente não pode ficar sem o
  // `oidc-falso`, que os arquivos seguintes da integração usam no login pela conta da escola.
  afterAll(() => {
    composeOuFalha('up', '--detach', '--wait', SERVICO)
  }, 120_000)

  /**
   * As linhas úteis da saída do compose. `saida` junta stdout e stderr, então um WARN do compose entra
   * na conta: comparar a saída inteira com `'healthy'` daria vermelho por um aviso que não tem nada a
   * ver com o caso — e esta correção existe justamente para tirar vermelho que não é regra.
   */
  const linhas = (...argumentos: string[]): string[] =>
    compose(...argumentos)
      .saida.split('\n')
      .map((linha) => linha.trim())
      .filter((linha) => linha !== '')

  /** O id do contêiner do serviço no projeto, ou vazio quando ele não existe. */
  const id = (): string => linhas('ps', '--all', '--format', '{{.ID}}', SERVICO).join(' ')

  /** `toContain` num array de linhas, e não `toBe` na saída: `'unhealthy'` contém `'healthy'`. */
  const saude = (): string[] => linhas('ps', '--format', '{{.Health}}', SERVICO)

  /**
   * Segura a porta publicada do lado de fora do Docker, no papel do proxy do contêiner que ainda está
   * saindo. Com nova tentativa: logo depois do `stop` a porta pode ainda não estar livre nem para nós —
   * que é exatamente o defeito sob teste, visto do outro lado.
   */
  async function segurarPorta(porta: number, limiteMs = 15_000): Promise<Server> {
    const prazo = Date.now() + limiteMs
    for (;;) {
      const servidor = createServer()
      const erro = await new Promise<NodeJS.ErrnoException | undefined>((resolver) => {
        servidor.once('error', resolver)
        servidor.listen(porta, '127.0.0.1', () => resolver(undefined))
      })
      if (erro === undefined) {
        // Depois do `listen`, o `once` do laço já foi gasto: sem um ouvinte permanente, um erro de
        // socket na janela em que a porta está presa subiria como `unhandled error` e derrubaria o
        // worker do Vitest, em vez de reprovar o caso.
        servidor.on('error', () => {})
        return servidor
      }
      if (erro.code !== 'EADDRINUSE' || Date.now() > prazo) throw erro
      await new Promise((resolver) => setTimeout(resolver, 200))
    }
  }

  it('recria o serviço em contêiner novo e não desiste enquanto a porta publicada ainda está presa', async () => {
    const porta = Number(valorObrigatorio(lerAmbienteDeTeste(), 'OIDC_FALSO_PORTA_HOST'))
    const antes = id()
    expect(antes).not.toBe('')

    // O contêiner parado, e não removido, é o estado que os `afterAll` do compose deixam: é dele que a
    // corrida nasce. A porta presa por 2 s é o proxy que ainda não soltou, encenado de forma
    // determinística — na máquina a janela real é de fração de segundo, e a intermitência custou dois
    // portões vermelhos em 22/09/2026.
    composeOuFalha('stop', SERVICO)
    const servidor = await segurarPorta(porta)
    const soltar = () => {
      if (servidor.listening) servidor.close()
    }
    const solta = setTimeout(soltar, 2_000)
    try {
      await recriarDoZero(SERVICO)
    } finally {
      clearTimeout(solta)
      soltar()
    }

    // Contêiner novo: quem trocar a recriação por `up`/`start` simples para fugir da corrida religa o
    // antigo, com a série do Prometheus e o estado de alerta da execução anterior dentro dele.
    const depois = id()
    expect(depois).not.toBe(antes)
    expect(depois).not.toBe('')
    expect(saude()).toContain('healthy')
  }, 120_000)

  it('recria tanto o serviço que está rodando quanto o que não tem contêiner no projeto', async () => {
    // Os dois estados em que os `beforeAll` de `infra/test/` chamam isto: a observabilidade de pé de um
    // arquivo anterior, e o ambiente recém-derrubado, sem contêiner nenhum. O caso acima cobre o
    // terceiro, que é o da corrida — o contêiner parado.
    const rodando = id()
    expect(saude()).toContain('healthy')
    await recriarDoZero(SERVICO)
    const recriado = id()
    expect(recriado).not.toBe(rodando)
    expect(saude()).toContain('healthy')

    composeOuFalha('rm', '--force', '--stop', SERVICO)
    expect(id()).toBe('')
    await recriarDoZero(SERVICO)
    expect(id()).not.toBe('')
    expect(id()).not.toBe(recriado)
    expect(saude()).toContain('healthy')
  }, 120_000)
})
