import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseEnv } from 'node:util'
import { parse } from 'yaml'
import { executarEtapas, raizRepositorio, type Etapa } from './executar.ts'

/**
 * Testes e esteira sobem um projeto compose próprio (`educa-teste`), com os valores de
 * `.env.example` e as portas de `infra/teste.env`. Nada depende de um `.env` local, e parar
 * o Postgres num teste nunca derruba o ambiente de desenvolvimento.
 *
 * Esse é o ambiente de teste 0, o da esteira e o de quem não escolheu outro. Cada checkout pode ter o seu
 * (`numeroDoAmbienteDeTeste`): com o número N, de 1 a 3, o projeto é `educa-teste-N` e toda porta publicada sobe
 * N × 1000, e toda imagem que o compose constrói leva a etiqueta `teste-N` (`arquivoDasImagensDoAmbiente`). A escolha
 * é feita aqui e só aqui; quem precisa do projeto, dos argumentos do compose ou de uma porta lê deste arquivo
 * (`PROJETO_TESTE`, `ARGUMENTOS_COMPOSE`, `lerAmbienteDeTeste`, `urlDoBancoDeTeste`).
 */
const PROJETO_DO_AMBIENTE_ZERO = 'educa-teste'
export const ARQUIVOS_AMBIENTE_TESTE = ['.env.example', 'infra/teste.env'] as const

/** De onde vem o número do ambiente de teste: a variável vence o arquivo, que fica na pasta que o git ignora. */
export const VARIAVEL_DO_AMBIENTE_DE_TESTE = 'EDUCA_AMBIENTE_TESTE'
export const ARQUIVO_DO_NUMERO_DO_AMBIENTE = '.processo/ambiente'
export const ULTIMO_AMBIENTE_DE_TESTE = 3
/**
 * Quanto cada ambiente desloca as portas do anterior. As de `infra/teste.env` vão de 23010 a 29100: com 3 × 1000 a
 * maior fica em 32100, abaixo da faixa efêmera do Linux (32768), e nenhuma cai sobre a de outro ambiente, sobre as do
 * desenvolvimento (`.env.example`) nem sobre as do cenário de carga (`infra/carga.env`). O teste confere os três.
 */
export const PORTAS_POR_AMBIENTE = 1000
const SUFIXO_DE_PORTA_PUBLICADA = '_PORTA_HOST'
const COMPOSE = 'infra/compose.yml'
/** As imagens que o compose constrói com nome fixo, as únicas que precisam de etiqueta por ambiente. */
const IMAGEM_CONSTRUIDA = /^educa-[a-z-]+:local$/

function lerArquivoDoNumero(): string | undefined {
  const caminho = join(raizRepositorio, ARQUIVO_DO_NUMERO_DO_AMBIENTE)
  return existsSync(caminho) ? readFileSync(caminho, 'utf8') : undefined
}

function numeroValido(texto: string, origem: string): number {
  const limpo = texto.trim()
  const numero = /^(0|[1-9]\d*)$/.test(limpo) ? Number(limpo) : Number.NaN
  if (!(numero >= 0 && numero <= ULTIMO_AMBIENTE_DE_TESTE)) {
    throw new Error(
      `número do ambiente de teste inválido em ${origem}: ${JSON.stringify(limpo)} (esperado um inteiro de 0 a ${String(ULTIMO_AMBIENTE_DE_TESTE)})`,
    )
  }
  return numero
}

/**
 * O número do ambiente de teste deste checkout: o de `EDUCA_AMBIENTE_TESTE` ou, sem ela, o de `.processo/ambiente`,
 * que contém só o número. Sem os dois, 0.
 *
 * Valor que não é inteiro de 0 a 3 é erro, e nunca vira 0: o 0 é o ambiente que os outros checkouts da máquina
 * dividem, e cair nele calado é derrubar o banco de quem está no meio de um teste (`EDUCA_BANCO_NOVO=1`). Vale
 * também para a variável definida e vazia, que é como chega `EDUCA_AMBIENTE_TESTE=$N` com o `N` esquecido.
 */
export function numeroDoAmbienteDeTeste(
  ambiente: Readonly<Record<string, string | undefined>> = process.env,
  lerArquivo: () => string | undefined = lerArquivoDoNumero,
): number {
  const daVariavel = ambiente[VARIAVEL_DO_AMBIENTE_DE_TESTE]
  if (daVariavel !== undefined) return numeroValido(daVariavel, VARIAVEL_DO_AMBIENTE_DE_TESTE)
  const doArquivo = lerArquivo()
  return doArquivo === undefined ? 0 : numeroValido(doArquivo, ARQUIVO_DO_NUMERO_DO_AMBIENTE)
}

export function projetoDeTeste(numero: number): string {
  return numero === 0 ? PROJETO_DO_AMBIENTE_ZERO : `${PROJETO_DO_AMBIENTE_ZERO}-${String(numero)}`
}

/**
 * O arquivo de ambiente que leva ao compose as portas do ambiente N, gerado em `.processo/` a partir dos dois
 * versionados (`gravarAmbienteDerivado`). O ambiente 0 não tem: sobe só com os versionados, como sempre subiu.
 */
export function arquivoDoAmbienteDerivado(numero: number): string | null {
  return numero === 0 ? null : `.processo/ambiente-de-teste-${String(numero)}.env`
}

/**
 * O arquivo de compose que dá às imagens construídas a etiqueta do ambiente N, gerado em `.processo/`
 * (`gravarAmbienteDerivado`). O ambiente 0 não tem. Sem ele, `infra/compose.yml` chama a imagem da API de
 * `educa-api:local` em todo projeto: dois checkouts com código diferente construiriam por cima um do outro, e o e2e
 * de um testaria a imagem do outro.
 */
export function arquivoDasImagensDoAmbiente(numero: number): string | null {
  return numero === 0 ? null : `.processo/compose-de-teste-${String(numero)}.yml`
}

/**
 * Os argumentos de todo `docker compose` do ambiente N. O arquivo derivado vai por último entre os `--env-file`: no
 * compose o último sobrepõe o anterior, e é assim que as portas dele vencem as de `infra/teste.env`. O das imagens vai
 * depois de `infra/compose.yml`, pelo mesmo motivo. Por arquivo, e não pelo ambiente do processo do `docker`: quem
 * chama o compose com o ambiente limpo (`tools/ci/compose.int.test.ts`) continua falando com o projeto, as portas e
 * as imagens certas.
 */
export function argumentosDoCompose(numero: number): string[] {
  const derivado = arquivoDoAmbienteDerivado(numero)
  const imagens = arquivoDasImagensDoAmbiente(numero)
  return [
    'compose',
    '--project-name',
    projetoDeTeste(numero),
    ...[...ARQUIVOS_AMBIENTE_TESTE, ...(derivado === null ? [] : [derivado])].flatMap((arquivo) => ['--env-file', arquivo]),
    ...[COMPOSE, ...(imagens === null ? [] : [imagens])].flatMap((arquivo) => ['-f', arquivo]),
  ]
}

/**
 * Os arquivos com que o cenário de carga sobe o projeto `educa-carga`. Mora aqui, e não em
 * `infra/scripts/carga.ts`, porque quem precisa deles são os dois: o cenário, para subir, e o teste
 * da configuração, para afirmar o que a carga dá às APIs. Duplicar a lista já custou caro uma vez —
 * o cenário mediria o prazo de desenvolvimento com o teste verde
 * (`tasks/correcoes/2026-09-22-corte-de-100-ms-do-redis-recusa-o-desafio-no-e2e.md`).
 */
export const ARQUIVOS_AMBIENTE_CARGA = ['.env.example', 'infra/carga.env'] as const

/**
 * O ambiente de teste deste checkout, decidido uma vez, na carga do módulo: número inválido reprova aqui, antes de
 * qualquer `docker`. O arquivo derivado é gravado no mesmo instante, para existir quando o primeiro compose o ler.
 */
export const AMBIENTE_DE_TESTE = numeroDoAmbienteDeTeste()
export const PROJETO_TESTE = projetoDeTeste(AMBIENTE_DE_TESTE)
export const ARGUMENTOS_COMPOSE: readonly string[] = argumentosDoCompose(AMBIENTE_DE_TESTE)
gravarAmbienteDerivado(AMBIENTE_DE_TESTE)

/**
 * O que os testes de integração sobem: os dados e o `oidc-falso`, no lugar do Google e da Microsoft no login pela conta
 * da escola (13.0), para nenhum teste chamar provedor de verdade.
 */
export const SERVICOS_INFRA = ['postgres', 'redis-fila', 'redis-cache', 'storage', 'oidc-falso'] as const

export function etapaCompose(nome: string, ...argumentos: string[]): Etapa {
  return { nome, comando: 'docker', argumentos: [...ARGUMENTOS_COMPOSE, ...argumentos] }
}

/**
 * O despejo de log da falha, que é o que sobra para diagnosticar um vermelho que não reproduz.
 *
 * `--timestamps` é o que o torna cruzável: sem ele cada linha vem com o carimbo que o próprio serviço
 * imprime — o Caddy com `ts` no JSON, o Postgres e o Redis cada um no seu formato —, e correlacionar o
 * instante de uma requisição com o instante em que a borda mexeu no balanceamento vira adivinhação.
 *
 * `--tail` é por contêiner, não no total, e 4.000 é medido, não estimado: numa execução de
 * `test:infra` de 20 min, o maior log de serviço nosso foi o da `api-2`, com 3.899 linhas. Em 4.000
 * o despejo leva **o log inteiro dos doze serviços que escrevemos**. Vão truncados de propósito
 * cinco de terceiro — postgres, borda, redis-fila, redis-cache e storage —, que somam 149.322
 * linhas; neles o que serve para diagnosticar é o carimbo, não o começo. (Os outros dois de
 * terceiro, oidc-falso e observabilidade, saem completos.) Medição em
 * tasks/correcoes/2026-09-21-log-da-falha-sem-carimbo-de-hora.md.
 */
export const ETAPA_DO_LOG_DA_FALHA = ['logs', '--no-color', '--timestamps', '--tail', '4000'] as const

/** O projeto de teste inteiro, com os volumes: o que a esteira faz no fim de cada job. */
export const DERRUBAR_COM_VOLUMES = ['down', '--volumes', '--remove-orphans'] as const

/** Os passos de encerramento, em função do código de saída. Separado para o caminho de falha ter teste. */
export function etapasDeEncerramento(codigo: number, derrubar = true): Etapa[] {
  return [
    ...(codigo === 0 ? [] : [etapaCompose('logs dos serviços', ...ETAPA_DO_LOG_DA_FALHA)]),
    ...(derrubar ? [etapaCompose('derrubar o ambiente', ...DERRUBAR_COM_VOLUMES)] : []),
  ]
}

/**
 * O que o `globalSetup` da integração pede ao compose de teste, depois de `ARGUMENTOS_COMPOSE`.
 *
 * Com `EDUCA_BANCO_NOVO=1`, que o portão local define, começa do zero, como cada job da esteira: o projeto de teste
 * inteiro cai com os volumes antes de subir. Sem isso o banco da máquina acumulava milhares de escolas de outras
 * execuções, e três testes da A0b passaram na esteira e falharam na máquina (ou o contrário) por percorrer a lista
 * global ou supor a ordem do id; o volume foi recriado à mão quatro vezes. O projeto inteiro, e não só os serviços de
 * dados: o `test:e2e --manter-ambiente` deixa API e worker de pé, presos ao banco que ia sumir.
 */
export function comandosDaSubidaDeTeste(ambiente: Readonly<Record<string, string | undefined>>): string[][] {
  return [...(ambiente['EDUCA_BANCO_NOVO'] === '1' ? [[...DERRUBAR_COM_VOLUMES]] : []), ['up', '--detach', '--wait', ...SERVICOS_INFRA]]
}

/**
 * Lê `--shard=<i>/<n>` dos argumentos de `ci:infra`, a fatia dos arquivos de `infra/test` que este runner roda (o Vitest reparte
 * por arquivo). Sem ele, `null`: o projeto inteiro, que é o `npm run ci:infra` da máquina. Formato errado reprova antes de subir
 * o compose, em vez de rodar a suíte inteira numa fatia que não cabe no teto.
 */
export function fatiaDosArgumentosDaInfra(argumentos: readonly string[]): string | null {
  if (argumentos.length === 0) return null
  const fatia = /^--shard=(\d+)\/(\d+)$/.exec(argumentos.length === 1 ? (argumentos[0] ?? '') : '')
  const indice = Number(fatia?.[1])
  const total = Number(fatia?.[2])
  if (fatia === null || indice < 1 || indice > total) {
    throw new Error(`fatia da infra inválida: ${argumentos.join(' ')} (esperado um só --shard=<i>/<n>, com 1 ≤ i ≤ n)`)
  }
  return `${String(indice)}/${String(total)}`
}

/**
 * Sobe Postgres, Redis e storage, roda o `npm run <script>` (numa fatia dos arquivos, quando é a da esteira) e derruba o
 * ambiente, com os logs dos serviços antes quando falha. É o corpo de `ci:integracao` e `ci:infra`.
 */
export function executarTestesComInfra(nome: string, script: string, fatia: string | null = null): Promise<number> {
  return executarEtapas(
    [
      etapaCompose('subir Postgres, Redis, storage e oidc-falso', 'up', '--detach', '--wait', ...SERVICOS_INFRA),
      { nome, comando: 'npm', argumentos: ['run', script, ...(fatia === null ? [] : ['--', `--shard=${fatia}`])] },
    ],
    (codigo) => etapasDeEncerramento(codigo),
  )
}

function lerArquivoAmbiente(caminho: string): Record<string, string> {
  const valores: Record<string, string> = {}
  for (const [chave, valor] of Object.entries(parseEnv(readFileSync(join(raizRepositorio, caminho), 'utf8')))) {
    if (valor !== undefined) valores[chave] = valor
  }
  return valores
}

export function lerAmbienteExemplo(): Record<string, string> {
  return lerArquivoAmbiente('.env.example')
}

/**
 * O ambiente `base` com as portas do ambiente N: toda `*_PORTA_HOST` somada de N × 1000, e todo endereço da própria
 * máquina que aponta para uma delas (`LOGIN_EXTERNO_RETORNO_URL`, que leva a porta da web) acompanhando. Endereço de
 * dentro da rede do compose (`oidc-falso:8080`) e porta que não é publicada por nós (a do `LLM_BASE_URL`) ficam como
 * estão. Separado da leitura dos arquivos para ter teste com um ambiente escrito à mão.
 */
export function deslocarPortas(base: Readonly<Record<string, string>>, numero: number): Record<string, string> {
  if (numero === 0) return { ...base }
  const deslocadas = new Map<string, string>()
  for (const [chave, valor] of Object.entries(base)) {
    if (!chave.endsWith(SUFIXO_DE_PORTA_PUBLICADA)) continue
    if (!/^\d+$/.test(valor)) throw new Error(`ambiente de teste com ${chave} que não é porta: ${JSON.stringify(valor)}`)
    deslocadas.set(valor, String(Number(valor) + numero * PORTAS_POR_AMBIENTE))
  }
  return Object.fromEntries(
    Object.entries(base).map(([chave, valor]) => [
      chave,
      chave.endsWith(SUFIXO_DE_PORTA_PUBLICADA)
        ? (deslocadas.get(valor) ?? valor)
        : valor.replace(/(?<=\b(?:127\.0\.0\.1|localhost):)\d+/g, (porta) => deslocadas.get(porta) ?? porta),
    ]),
  )
}

/** Valores com que o compose de teste do ambiente N sobe: o último arquivo sobrepõe o anterior, como no compose. */
export function ambienteDeTesteDo(numero: number): Record<string, string> {
  return deslocarPortas(Object.assign({}, ...ARQUIVOS_AMBIENTE_TESTE.map(lerArquivoAmbiente)) as Record<string, string>, numero)
}

/** O mesmo, para o ambiente de teste deste checkout: é o que a integração, o e2e e a vitrine leem. */
export function lerAmbienteDeTeste(): Record<string, string> {
  return ambienteDeTesteDo(AMBIENTE_DE_TESTE)
}

/** O texto do arquivo derivado do ambiente N: só o que muda em relação ao ambiente 0. */
export function conteudoDoAmbienteDerivado(numero: number): string {
  const zero = ambienteDeTesteDo(0)
  const linhas = Object.entries(ambienteDeTesteDo(numero))
    .filter(([chave, valor]) => zero[chave] !== valor)
    .map(([chave, valor]) => `${chave}=${valor}`)
  return [
    `# Gerado por tools/ci/compose.ts a partir de ${ARQUIVOS_AMBIENTE_TESTE.join(' e ')}: não edite.`,
    `# As portas do ambiente de teste ${String(numero)} (projeto compose \`${projetoDeTeste(numero)}\`), cada uma ${String(numero * PORTAS_POR_AMBIENTE)} acima da do ambiente 0.`,
    ...linhas,
    '',
  ].join('\n')
}

/**
 * A imagem de cada serviço de um compose, com a âncora resolvida: `api-2`, que é `<<: *api`, tem a imagem da `api-1`.
 * Lido do texto, com `merge: true` para a chave `<<`, e não de `docker compose config`: este módulo é carregado por
 * todo processo do Vitest e do Playwright, e nenhum deles pode esperar o `docker` para saber com que ambiente fala.
 * O teste de integração do compose confere o resultado contra o `config` de verdade.
 */
export function imagensDosServicos(conteudoCompose: string): Map<string, string> {
  const { services } = parse(conteudoCompose, { merge: true }) as { services: Record<string, { image?: string }> }
  const imagens = new Map<string, string>()
  for (const [nome, servico] of Object.entries(services)) {
    if (servico.image !== undefined) imagens.set(nome, servico.image)
  }
  return imagens
}

/**
 * Os serviços que consomem job: os despachantes e os workers, em todas as réplicas que o compose declara. O portão local
 * os derruba antes da integração (`tools/processo/sequencia-do-portao.ts`): com um deles de pé, o job que o teste
 * enfileirou é consumido por ele, e o teste não vê o efeito. Lidos do compose, e não escritos à mão: réplica nova entra
 * sozinha.
 */
export function servicosDeJob(conteudoCompose: string = readFileSync(join(raizRepositorio, COMPOSE), 'utf8')): string[] {
  return [...imagensDosServicos(conteudoCompose).keys()].filter((servico) => /^(despachante|worker)(-|$)/.test(servico))
}

/** O texto do arquivo das imagens do ambiente N: cada serviço que o compose constrói, com a etiqueta `teste-N`. */
export function conteudoDasImagensDoAmbiente(numero: number, conteudoCompose: string = readFileSync(join(raizRepositorio, COMPOSE), 'utf8')): string {
  const construidas = [...imagensDosServicos(conteudoCompose)].filter(([, imagem]) => IMAGEM_CONSTRUIDA.test(imagem))
  return [
    `# Gerado por tools/ci/compose.ts a partir de ${COMPOSE}: não edite.`,
    `# As imagens que o ambiente de teste ${String(numero)} constrói, com etiqueta própria: o código deste checkout não cai sobre o de outro.`,
    'services:',
    ...construidas.flatMap(([servico, imagem]) => [`  ${servico}:`, `    image: ${imagem.replace(/:local$/, `:teste-${String(numero)}`)}`]),
    '',
  ].join('\n')
}

function gravarSeMudou(caminho: string, conteudo: string): void {
  if (existsSync(caminho) && readFileSync(caminho, 'utf8') === conteudo) return
  mkdirSync(dirname(caminho), { recursive: true })
  const provisorio = `${caminho}.${String(process.pid)}.tmp`
  writeFileSync(provisorio, conteudo)
  renameSync(provisorio, caminho)
}

/**
 * Grava em `.processo/` os dois arquivos derivados do ambiente N, o das portas e o das imagens, e devolve o caminho
 * do primeiro (`null` no ambiente 0, que não tem nenhum). Só escreve quando o conteúdo muda, e troca o arquivo de uma
 * vez (`rename`): os processos do Vitest e do Playwright carregam este módulo ao mesmo tempo, e nenhum pode ler o
 * arquivo pela metade.
 */
export function gravarAmbienteDerivado(numero: number, raiz: string = raizRepositorio): string | null {
  const relativo = arquivoDoAmbienteDerivado(numero)
  const imagens = arquivoDasImagensDoAmbiente(numero)
  if (relativo === null || imagens === null) return null
  gravarSeMudou(join(raiz, relativo), conteudoDoAmbienteDerivado(numero))
  gravarSeMudou(join(raiz, imagens), conteudoDasImagensDoAmbiente(numero))
  return join(raiz, relativo)
}

/**
 * Valores com que o cenário de carga sobe, do mesmo jeito. O teste da configuração confere aqui o que o projeto
 * `educa-carga` dá às APIs, que não é o do `.env.example`: o hash calibrado e o corte de produção do Redis do login.
 * Não enxerga `infra/compose.carga.yml`: um `environment:` de lá passaria despercebido (`test-engineer`).
 */
export function lerAmbienteDeCarga(): Record<string, string> {
  return Object.assign({}, ...ARQUIVOS_AMBIENTE_CARGA.map(lerArquivoAmbiente)) as Record<string, string>
}

/**
 * URL do Postgres do compose de teste, vista da máquina: a mesma para a integração e para o seed do e2e. Sem
 * argumento, a do ambiente de teste deste checkout.
 */
export function urlDoBancoDeTeste(numero: number = AMBIENTE_DE_TESTE): string {
  const ambiente = ambienteDeTesteDo(numero)
  const usuario = valorObrigatorio(ambiente, 'POSTGRES_USUARIO')
  const senha = valorObrigatorio(ambiente, 'POSTGRES_SENHA')
  const banco = valorObrigatorio(ambiente, 'POSTGRES_BANCO')
  return `postgres://${usuario}:${senha}@127.0.0.1:${valorObrigatorio(ambiente, 'POSTGRES_PORTA_HOST')}/${banco}`
}

export function valorObrigatorio(ambiente: Record<string, string>, chave: string): string {
  const valor = ambiente[chave]
  if (valor === undefined || valor === '') {
    throw new Error(`ambiente de teste sem ${chave}`)
  }
  return valor
}
