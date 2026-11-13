import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { FATIAS_DO_E2E } from '../processo/esteira.ts'
import { branchDaLinha } from '../processo/linhas.ts'
import { ARQUIVO_DO_CENSO_DO_E2E, PREFIXO_DO_ARTEFATO_DO_CENSO, VARIAVEL_DO_RELATORIO_DO_E2E } from './duracao-do-e2e.ts'
import { raizRepositorio } from './executar.ts'
import { FRACAO_DE_FOLGA_DO_E2E, minutosEstimadosDoE2e, tetoDoE2e } from './prazo-do-e2e.ts'

interface Passo {
  uses?: string
  run?: string
  if?: string
  env?: unknown
  with?: Record<string, unknown>
}

interface Job {
  name?: string
  'timeout-minutes'?: number
  strategy?: { 'fail-fast'?: unknown; matrix?: Record<string, unknown> }
  permissions?: unknown
  env?: unknown
  steps: Passo[]
}

interface ProjetoDoPlaywright {
  name?: string
  outputDir?: string
  use?: { trace?: unknown }
}

interface ConfiguracaoDoPlaywright {
  outputDir?: string
  use?: { trace?: unknown }
  projects?: ProjetoDoPlaywright[]
}

/**
 * O nome do artefato é contrato: é por ele que se procura o traço na execução que falhou. Um por fatia, com o número
 * dela no fim: duas fatias publicando o mesmo nome na mesma execução teriam a segunda recusada.
 */
const NOME_DO_ARTEFATO_DO_TRACO = 'traco-do-e2e-${{ matrix.fatia }}'
/** A única expressão que o workflow aceita: o número da fatia do e2e, que vem da lista fixa da própria matriz. */
const EXPRESSAO_DA_FATIA = '${{ matrix.fatia }}'
/**
 * O modo de traço que guarda o arquivo do caso que falhou, e só dele. `'on'` também guardaria na falha,
 * mas retém os 132 casos: o artefato passaria a levar a suíte inteira, e ele é público (regra 20).
 */
const MODOS_QUE_GUARDAM_NA_FALHA = ['retain-on-failure'] as const
/** Onde o Playwright escreve quando `outputDir` não é declarado. */
const PADRAO_DO_DIRETORIO_DE_SAIDA = 'test-results'

/**
 * Quantos casos o Playwright vai rodar, pelos dois projetos, na fatia pedida (ou na suíte inteira): é ele quem conta e
 * quem reparte, e não uma busca por `test(` no fonte nem uma divisão feita aqui.
 */
function casosDoE2e(argumentos: readonly string[] = []): number {
  const lista = spawnSync('npx', ['playwright', 'test', '--list', ...argumentos], { cwd: raizRepositorio, encoding: 'utf8' })
  expect(lista.status, lista.stderr).toBe(0)
  return Number(/^Total: (\d+) tests? in \d+ files?$/m.exec(lista.stdout)?.[1])
}

/**
 * Os índices das fatias de um job em fatias (`e2e` e `infra`), pela matriz dele (`strategy.matrix.fatia`). Sem matriz, uma fatia só:
 * a suíte inteira num job, que é como a esteira estava até a correção 2026-10-03-e2e-em-fatias (o e2e) e até a
 * 2026-11-12-job-de-infra-passa-de-45-min (a infra).
 */
function fatiasDoJob(nome: 'e2e' | 'infra'): number[] {
  const matriz = workflow.jobs[nome]?.strategy?.matrix
  if (matriz === undefined) return [1]
  // Só a fatia: `include` ou `exclude` acrescentariam ou tirariam jobs sem a guarda ver.
  expect(Object.keys(matriz)).toEqual(['fatia'])
  const fatias = matriz['fatia']
  expect(Array.isArray(fatias), `strategy.matrix.fatia do ${nome} é uma lista`).toBe(true)
  const indices = fatias as number[]
  // De 1 a n, sem buraco nem repetição: a fatia que falta na matriz é suíte que deixa de rodar sem nenhum vermelho.
  expect(indices).toEqual(Array.from({ length: indices.length }, (_, posicao) => posicao + 1))
  return indices
}

function fatiasDoE2e(): number[] {
  return fatiasDoJob('e2e')
}

interface Workflow {
  on: { push?: { branches?: string[] }; pull_request?: { branches?: string[] } } & Record<string, unknown>
  concurrency?: { group?: string; 'cancel-in-progress'?: string | boolean }
  permissions?: unknown
  env?: unknown
  jobs: Record<string, Job>
}

const textoWorkflow = readFileSync(join(raizRepositorio, '.github/workflows/ci.yml'), 'utf8')
const workflow = parse(textoWorkflow) as Workflow
const scripts = (JSON.parse(readFileSync(join(raizRepositorio, 'package.json'), 'utf8')) as { scripts: Record<string, string> })
  .scripts

/** O que o GitHub preenche em cada evento, só o que o `concurrency` pode ler. */
interface ContextoDoGithub {
  event_name: string
  ref: string
  run_id: number
  event: { pull_request?: { number: number } }
}
type Valor = string | number | boolean | null | undefined | object

/** Os nomes que uma expressão do `ci.yml` pode usar: o que o GitHub preenche sozinho, e as duas funções que o grupo usa. */
const NOMES_PERMITIDOS = ['github.event_name', 'github.ref', 'github.run_id', 'github.event.pull_request.number']
const FICHAS = /'(?:[^']|'')*'|&&|\|\||==|[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)*|\d+|[(),]/g

function verdadeiro(valor: Valor): boolean {
  return !(valor === false || valor === 0 || valor === '' || valor === null || valor === undefined)
}

function igual(a: Valor, b: Valor): boolean {
  return typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() : a === b
}

function funcao(nome: string, argumentos: Valor[]): Valor {
  const [primeiro, segundo] = argumentos
  if (nome === 'startsWith') return String(primeiro).toLowerCase().startsWith(String(segundo).toLowerCase())
  if (nome === 'format') return String(primeiro).replace(/\{(\d+)\}/g, (_, indice: string) => String(argumentos[Number(indice) + 1]))
  throw new Error(`função fora da lista: ${nome}`)
}

/**
 * Avalia uma expressão `${{ }}` do `ci.yml` com a semântica do GitHub (`&&` e `||` devolvem o operando, `==` ignora
 * maiúscula), só para a gramática que o `concurrency` usa. Ficha que não reconhece, ou nome fora de `NOMES_PERMITIDOS`,
 * lança: expressão nova no YAML reprova aqui até alguém decidir, pelo teste, que ela é segura.
 * Limite: a conferência de que nada ficou sem ficha compara com o texto sem espaços, então string com espaço dentro das
 * aspas (`'a b'`) reprova com "fora da gramática", e não por ser insegura. Quem precisar dela troca a conferência.
 */
function avaliarExpressao(expressao: string, contexto: ContextoDoGithub): Valor {
  const texto = /^\$\{\{([\s\S]*)\}\}$/.exec(expressao.trim())?.[1] ?? ''
  const fichas = texto.match(FICHAS) ?? []
  if (fichas.join('') !== texto.replace(/\s+/g, '')) throw new Error(`expressão fora da gramática: ${texto}`)
  let posicao = 0
  const olhar = (): string => fichas[posicao] ?? ''
  const proxima = (): string => fichas[posicao++] ?? ''

  function encadeada(operador: string, operando: () => Valor, combinar: (a: Valor, b: Valor) => Valor): Valor {
    let atual = operando()
    while (olhar() === operador) {
      proxima()
      atual = combinar(atual, operando())
    }
    return atual
  }
  function ou(): Valor {
    return encadeada('||', e, (a, b) => (verdadeiro(a) ? a : b))
  }
  function e(): Valor {
    return encadeada('&&', comparacao, (a, b) => (verdadeiro(a) ? b : a))
  }
  function comparacao(): Valor {
    return encadeada('==', primario, igual)
  }
  function primario(): Valor {
    const ficha = proxima()
    if (ficha === '(') {
      const dentro = ou()
      proxima()
      return dentro
    }
    if (ficha.startsWith("'")) return ficha.slice(1, -1).replaceAll("''", "'")
    if (/^\d+$/.test(ficha)) return Number(ficha)
    if (olhar() !== '(') return nome(ficha, contexto)
    proxima()
    const argumentos: Valor[] = []
    while (olhar() !== ')') {
      argumentos.push(ou())
      if (olhar() === ',') proxima()
    }
    proxima()
    return funcao(ficha, argumentos)
  }

  const resultado = ou()
  if (posicao !== fichas.length) throw new Error(`sobrou expressão: ${texto}`)
  return resultado
}

function nome(caminho: string, contexto: ContextoDoGithub): Valor {
  if (!NOMES_PERMITIDOS.includes(caminho)) throw new Error(`nome fora da lista: ${caminho}`)
  const [raiz, ...campos] = caminho.split('.')
  let atual: unknown = raiz === 'github' ? contexto : undefined
  for (const campo of campos) atual = (atual as Record<string, unknown> | undefined)?.[campo]
  return atual as Valor
}

/** O grupo e o `cancel-in-progress` que o GitHub calcularia para esse evento. */
function concorrenciaPara(contexto: ContextoDoGithub): { grupo: string; cancela: boolean } {
  const { group, 'cancel-in-progress': cancela } = workflow.concurrency ?? {}
  expect(group, 'concurrency.group').toBeTypeOf('string')
  expect(['boolean', 'string'], 'concurrency.cancel-in-progress').toContain(typeof cancela)
  return {
    grupo: String(avaliarExpressao(String(group), contexto)),
    cancela: typeof cancela === 'boolean' ? cancela : verdadeiro(avaliarExpressao(cancela ?? '', contexto)),
  }
}

function push(ref: string, execucao = 100): ContextoDoGithub {
  return { event_name: 'push', ref, run_id: execucao, event: {} }
}

/**
 * O filtro de branch do `on.push` com a regra do GitHub: os padrões valem na ordem, o positivo inclui e o `!` exclui o que
 * já tinha entrado. `*` não passa a barra, `**` passa. Só essa gramática: padrão com outro caractere especial lança, e
 * quem o usar decide, pelo teste, o que ele quer dizer.
 */
function disparaNoPush(branch: string, padroes: string[]): boolean {
  let entra = false
  for (const padrao of padroes) {
    const nega = padrao.startsWith('!')
    const corpo = nega ? padrao.slice(1) : padrao
    if (/[?+[\]]/.test(corpo)) throw new Error(`padrão fora da gramática do teste: ${padrao}`)
    const expressao = corpo
      .split('**')
      .map((parte) => parte.split('*').map((trecho) => trecho.replace(/[.\\^$|(){}]/g, '\\$&')).join('[^/]*'))
      .join('.*')
    if (new RegExp(`^${expressao}$`).test(branch)) entra = !nega
  }
  return entra
}

describe('esteira do GitHub (.github/workflows/ci.yml)', () => {
  it('roda em todo push nas branches integradoras e nas de spec (menos as de linha) e de correção, no pull request para a develop e na execução manual, e em nenhum outro evento', () => {
    // O trabalho acontece na branch da spec, que entra na `develop` por pouso (D78). A esteira de cada push dela é o
    // portão completo de cada tarefa, sem espera (D79): sem `spec/**` e `correcao/**` aqui, o que uma tarefa quebra
    // fora dos testes que alterou só apareceria no fim da spec, e a D52 e a regra 40 contam com isso. A branch de linha
    // (`!spec/**--l*`) é a exceção: o que ela traz roda no push da spec, no encontro (o caso dela está logo abaixo).
    expect(workflow.on.push?.branches).toEqual(['develop', 'release', 'main', 'spec/**', '!spec/**--l*', 'correcao/**'])
    // O PR para a `develop` (D23 revista em 23/10/2026, RF19): só ele, com os tipos padrão. `pull_request_target` roda com
    // permissão de escrita e segredo sobre o código de quem abriu o PR, e por isso nunca entra.
    expect(workflow.on.pull_request).toEqual({ branches: ['develop'] })
    expect(Object.keys(workflow.on).sort()).toEqual(['pull_request', 'push', 'workflow_dispatch'])
    expect(textoWorkflow).not.toMatch(/pull_request_target/)
  })

  it('a branch de linha (spec/<func>--l<n>) não dispara a esteira no push, e a da spec e a da correção disparam', () => {
    // A linha entra na spec no encontro (`tools/processo/linhas.ts`), e é o push da spec que o Orquestrador lê. Rodar também o da
    // linha repete as seis suítes e disputa os runners com a que importa (X7: 34 das 83 execuções, até 4 h 26 do push ao veredito).
    const padroes = workflow.on.push?.branches ?? []
    // Os nomes vêm do gerador de `linhas.ts`, e não escritos à mão: se o sufixo mudar, o teste acompanha.
    const linhas = [
      branchDaLinha('spec/harness', 1),
      branchDaLinha('spec/harness', 12),
      branchDaLinha('spec/harness', 0),
      branchDaLinha('spec/telas-do-aluno', 3),
      branchDaLinha('spec/a/b', 2),
    ]
    for (const branch of linhas) {
      expect(branch, 'o gerador devolve branch de linha de spec').toMatch(/^spec\/.+--l\d+$/)
      expect(disparaNoPush(branch, padroes), branch).toBe(false)
    }
    for (const branch of ['spec/harness', 'spec/telas-do-aluno-e-primeiro-acesso', 'correcao/2026-10-24-esteira', 'develop', 'release', 'main']) {
      expect(disparaNoPush(branch, padroes), branch).toBe(true)
    }
    // Fora de todos os padrões, a branch nunca dispara, com ou sem o sufixo.
    expect(disparaNoPush('feature/x--l1', padroes)).toBe(false)
    expect(disparaNoPush('spec-x--l1', padroes)).toBe(false)
  })

  it('o grupo de concorrência cancela a execução superada só em spec/** e correcao/**, uma por branch', () => {
    for (const ref of ['refs/heads/spec/harness', 'refs/heads/spec/x', 'refs/heads/correcao/2026-10-23-casca']) {
      expect(concorrenciaPara(push(ref)), ref).toEqual({ grupo: ref, cancela: true })
      // Dois pushes seguidos na mesma branch caem no mesmo grupo: é isso que cancela o primeiro.
      expect(concorrenciaPara(push(ref, 1)).grupo).toBe(concorrenciaPara(push(ref, 2)).grupo)
    }
    // E branches diferentes não se cancelam entre si.
    expect(concorrenciaPara(push('refs/heads/spec/x')).grupo).not.toBe(concorrenciaPara(push('refs/heads/spec/y')).grupo)
    expect(concorrenciaPara(push('refs/heads/spec/x')).grupo).not.toBe(concorrenciaPara(push('refs/heads/correcao/x')).grupo)
  })

  it('develop, release, main e a execução manual têm o run_id como grupo: nunca cancelam nem enfileiram ninguém', () => {
    const esperado = (execucao: number): { grupo: string; cancela: boolean } => ({ grupo: String(execucao), cancela: false })
    for (const ref of ['refs/heads/develop', 'refs/heads/release', 'refs/heads/main']) {
      expect(concorrenciaPara(push(ref, 7)), ref).toEqual(esperado(7))
      // Dois pushes seguidos têm grupos diferentes: o segundo não espera nem cancela o primeiro.
      expect(concorrenciaPara(push(ref, 8)).grupo).not.toBe(concorrenciaPara(push(ref, 7)).grupo)
    }
    // A execução manual numa branch de spec não cancela a do push, nem é cancelada por ele.
    expect(concorrenciaPara({ ...push('refs/heads/spec/x', 9), event_name: 'workflow_dispatch' })).toEqual(esperado(9))
    // O prefixo vale com a barra, e no começo da ref: `spec-x` e `feature/spec/x` não são branch de spec.
    expect(concorrenciaPara(push('refs/heads/spec-x', 10))).toEqual(esperado(10))
    expect(concorrenciaPara(push('refs/heads/feature/spec/x', 11))).toEqual(esperado(11))
    expect(concorrenciaPara(push('refs/heads/correcoes/x', 12))).toEqual(esperado(12))
  })

  it('o pull request tem o grupo pr-<número>, e o push novo nele cancela a execução anterior do mesmo PR', () => {
    const pr = (numero: number, execucao: number): ContextoDoGithub => ({
      event_name: 'pull_request',
      ref: `refs/pull/${String(numero)}/merge`,
      run_id: execucao,
      event: { pull_request: { number: numero } },
    })
    expect(concorrenciaPara(pr(7, 1))).toEqual({ grupo: 'pr-7', cancela: true })
    expect(concorrenciaPara(pr(7, 2)).grupo).toBe('pr-7')
    expect(concorrenciaPara(pr(8, 3)).grupo).toBe('pr-8')
  })

  it('só lê do contexto o que o GitHub preenche sozinho: nada que quem abre o PR escolhe, e nenhuma outra expressão fora a da fatia', () => {
    for (const nome of ['github.head_ref', 'github.event.pull_request.title', 'github.event.pull_request.head.ref']) {
      expect(() => avaliarExpressao(`\${{ ${nome} }}`, push('refs/heads/spec/x')), nome).toThrow('nome fora da lista')
    }
    expect(() => avaliarExpressao("${{ secrets.TOKEN }}", push('refs/heads/spec/x'))).toThrow('nome fora da lista')
    // Toda `${{ }}` do arquivo é a da fatia ou uma das duas do `concurrency`, que acima são avaliadas com a lista fechada.
    const doConcurrency = [workflow.concurrency?.group, workflow.concurrency?.['cancel-in-progress']].filter((valor) => typeof valor === 'string')
    expect(doConcurrency).toHaveLength(2)
    const expressoes = textoWorkflow.match(/\$\{\{[\s\S]*?\}\}/g) ?? []
    for (const expressao of expressoes) expect([EXPRESSAO_DA_FATIA, ...doConcurrency]).toContain(expressao)
  })

  it('só pede leitura do conteúdo, e nenhum job amplia a permissão', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' })
    for (const job of Object.values(workflow.jobs)) {
      expect(job.permissions).toBeUndefined()
    }
  })

  it('não usa segredo, variável do repositório nem ambiente declarado no YAML', () => {
    expect(textoWorkflow).not.toMatch(/secrets\s*[.[]/)
    // Só duas famílias de expressão: o número da fatia do e2e, que vem da lista fixa do próprio YAML, e as do
    // `concurrency`, que o teste do grupo avalia com a lista fechada de nomes. Segredo, `vars.*` e contexto externo só
    // entram por `${{ }}`, e nenhuma das duas famílias os lê.
    const doConcurrency = [workflow.concurrency?.group, workflow.concurrency?.['cancel-in-progress']]
    const expressoes = textoWorkflow.match(/\$\{\{[\s\S]*?\}\}/g) ?? []
    expect(expressoes.length).toBeGreaterThan(0)
    for (const expressao of expressoes) expect([EXPRESSAO_DA_FATIA, ...doConcurrency]).toContain(expressao)
    expect(textoWorkflow.split('${{').length - 1).toBe(expressoes.length)
    expect(workflow.env).toBeUndefined()
    for (const job of Object.values(workflow.jobs)) {
      expect(job.env).toBeUndefined()
      for (const passo of job.steps) {
        // A única variável é o nome do arquivo do relatório do censo, no passo do e2e: literal, sem segredo nem contexto.
        const ehOPassoDoE2e = passo.run?.trim().startsWith('npm run ci:e2e') === true
        if (ehOPassoDoE2e) expect(passo.env).toEqual({ [VARIAVEL_DO_RELATORIO_DO_E2E]: ARQUIVO_DO_CENSO_DO_E2E })
        else expect(passo.env).toBeUndefined()
      }
    }
  })

  it('tem os jobs verificar, integracao, infra e e2e, e cada um só chama npm ci e o seu npm run ci:*', () => {
    expect(Object.keys(workflow.jobs).sort()).toEqual(['e2e', 'infra', 'integracao', 'verificar'])
    for (const [nome, job] of Object.entries(workflow.jobs)) {
      const comandos = job.steps.flatMap((passo) => (passo.run === undefined ? [] : [passo.run.trim()]))
      // O e2e e a infra passam a fatia deles, e o total do `--shard` é o tamanho da matriz: `/3` com quatro fatias rodaria a quarta
      // fatia de três, que não existe, e a de `/5` deixaria um quinto da suíte sem rodar.
      const argumentos = nome === 'e2e' || nome === 'infra' ? ` -- --shard=${EXPRESSAO_DA_FATIA}/${String(fatiasDoJob(nome).length)}` : ''
      // O `verificar` confere também as entregas (RF14, terceira camada), antes das suítes; o teste dele está abaixo.
      const antes = nome === 'verificar' ? ['npm run ci:conferir-entregas'] : []
      expect(comandos).toEqual(['npm ci', ...antes, `npm run ci:${nome}${argumentos}`])
      expect(scripts[`ci:${nome}`]).toMatch(/^node tools\/ci\/[a-z0-9]+\.ts$/)
    }
  })

  it('o e2e roda em fatias que não se cancelam: o vermelho de uma não esconde o das outras, nem o traço delas', () => {
    const job = workflow.jobs['e2e']
    expect(fatiasDoE2e().length).toBeGreaterThan(1)
    expect(job?.strategy?.['fail-fast']).toBe(false)
    // O nome mostra a fatia: sem isso, os jobs da execução aparecem iguais e não se sabe qual ficou vermelho.
    expect(job?.name).toContain(`${EXPRESSAO_DA_FATIA}/${String(fatiasDoE2e().length)}`)
  })

  it('a infra roda em fatias que não se cancelam: o vermelho de uma não esconde o das outras, e cada uma tem teto de até 45 min', () => {
    const job = workflow.jobs['infra']
    expect(fatiasDoJob('infra').length).toBeGreaterThan(1)
    expect(job?.strategy?.['fail-fast']).toBe(false)
    // O nome mostra a fatia: sem isso, os jobs da execução aparecem iguais e não se sabe qual ficou vermelho.
    expect(job?.name).toContain(`${EXPRESSAO_DA_FATIA}/${String(fatiasDoJob('infra').length)}`)
    // Cada fatia tem o seu teto: a soma dos arquivos de `infra/test` dividida em fatias, e não o job inteiro em 45 min (run 43325031136).
    expect(Number(job?.['timeout-minutes'])).toBeGreaterThan(0)
    expect(Number(job?.['timeout-minutes'])).toBeLessThanOrEqual(45)
  })

  it('só usa ações oficiais da própria GitHub, fixadas por SHA completo, e não por tag que pode ser movida', () => {
    const passos = Object.values(workflow.jobs).flatMap((job) => job.steps.filter((passo) => passo.uses !== undefined))
    expect(passos.length).toBeGreaterThan(0)
    for (const passo of passos) {
      // A lista é fechada de propósito: ação de terceiro na esteira roda com acesso ao repositório clonado.
      expect(passo.uses).toMatch(/^actions\/(checkout|setup-node|upload-artifact)@[0-9a-f]{40}$/)
    }
  })

  it('o e2e publica o traço da falha, só quando falha e por prazo curto: sem isso o vermelho fica indiagnosticável', async () => {
    const passos = workflow.jobs['e2e']?.steps ?? []
    const publicacoes = passos.filter((passo) => passo.uses?.startsWith('actions/upload-artifact@') && String(passo.with?.['name']).startsWith('traco-'))
    expect(publicacoes).toHaveLength(1)
    const [publicacao] = publicacoes
    expect(publicacao).toBeDefined()
    expect(publicacao?.with?.['name']).toBe(NOME_DO_ARTEFATO_DO_TRACO)
    // As duas condições, sem depender da ordem em que estão escritas: `always()` ou só uma delas fica vermelho.
    expect(publicacao?.if).toContain('failure()')
    expect(publicacao?.if).toContain('cancelled()')
    // E só elas: `success()` ou `always()` publicariam também na execução verde, contra o "só quando falha" do título.
    expect(publicacao?.if).not.toContain('success()')
    expect(publicacao?.if).not.toMatch(/\balways\(\)/)
    // Diretório vazio precisa aparecer no log: é o sintoma de a configuração do traço ter mudado.
    expect(publicacao?.with?.['if-no-files-found']).toBe('warn')
    // O `cancelled()` só tem o que cobrir porque o job tem prazo: sem ele, a condição fica inofensiva em silêncio.
    expect(Number(workflow.jobs['e2e']?.['timeout-minutes'])).toBeGreaterThan(0)

    // Depois de rodar o e2e: antes dele, o `if` dispararia por falha do `npm ci` e não haveria traço nenhum.
    const indiceDoE2e = passos.findIndex((passo) => passo.run?.trim().startsWith('npm run ci:e2e') === true)
    expect(indiceDoE2e).toBeGreaterThanOrEqual(0)
    expect(passos.indexOf(publicacao as Passo)).toBeGreaterThan(indiceDoE2e)

    // Prazo curto: o artefato leva captura de tela e corpo de requisição do e2e (sintéticos, regra 20, item 17),
    // e serve para diagnosticar aquela execução, não para arquivo.
    const prazo = Number(publicacao?.with?.['retention-days'])
    expect(prazo).toBeGreaterThan(0)
    expect(prazo).toBeLessThanOrEqual(7)

    // O elo que faltava: sem amarrar ao `playwright.config.ts`, `trace: 'off'` ou outro `outputDir` deixariam
    // a esteira verde publicando um diretório vazio, e o defeito voltaria em silêncio.
    //
    // Resolvido **por projeto**, não só no `use` de topo: `projects[].use` vence o topo, então `trace: 'on'`
    // dentro do `celular` passaria a retar o traço dos casos verdes dele, e `outputDir` no projeto jogaria o
    // traço fora do que se publica. Os dois deixariam a guarda verde se ela olhasse só o topo.
    const configuracao = (await import('../../playwright.config.ts')) as { default: ConfiguracaoDoPlaywright }
    const caminhoPublicado = String(publicacao?.with?.['path']).replace(/\/$/, '')
    const projetos = configuracao.default.projects ?? []
    expect(projetos.length).toBeGreaterThan(0)
    for (const projeto of [...projetos, {} as ProjetoDoPlaywright]) {
      const modo = projeto.use?.trace ?? configuracao.default.use?.trace
      expect(MODOS_QUE_GUARDAM_NA_FALHA, `modo de traço de ${projeto.name ?? 'topo'}`).toContain(modo)
      const saida = projeto.outputDir ?? configuracao.default.outputDir ?? PADRAO_DO_DIRETORIO_DE_SAIDA
      expect(caminhoPublicado, `diretório de saída de ${projeto.name ?? 'topo'}`).toBe(saida.replace(/\/$/, ''))
    }
  })

  /** O passo que publica o relatório do censo, o único do e2e com esse prefixo no nome. */
  function publicacaoDoCenso(): Passo | undefined {
    const publicacoes = (workflow.jobs['e2e']?.steps ?? []).filter(
      (passo) => passo.uses?.startsWith('actions/upload-artifact@') && String(passo.with?.['name']).startsWith(PREFIXO_DO_ARTEFATO_DO_CENSO),
    )
    expect(publicacoes).toHaveLength(1)
    return publicacoes[0]
  }

  it('o e2e publica o relatório do censo, também no verde: só o JSON da fatia, por 7 dias, sem o test-results/ do traço', () => {
    const publicacao = publicacaoDoCenso()
    // Um artefato por fatia, com o número dela no nome: é por ele que `esteira.ts --censo` procura cada relatório.
    expect(publicacao?.with?.['name']).toBe(`${PREFIXO_DO_ARTEFATO_DO_CENSO}${EXPRESSAO_DA_FATIA}`)
    // Só o arquivo do relatório: `test-results/` leva traço, captura de tela e anexo, e o artefato é público (regra 20).
    expect(publicacao?.with?.['path']).toBe(ARQUIVO_DO_CENSO_DO_E2E)
    expect(Number(publicacao?.with?.['retention-days'])).toBe(7)
    // Reexecutar a fatia vermelha que passa publicaria de novo o mesmo nome.
    expect(publicacao?.with?.['overwrite']).toBe(true)
  })

  it('o relatório do censo sobe também na execução verde, sem o cancelado, e só depois do e2e que o grava com o nome certo', () => {
    const passos = workflow.jobs['e2e']?.steps ?? []
    const publicacao = publicacaoDoCenso()
    // Sem `success()` a fatia verde não publicaria nada, e o censo só lê a execução verde.
    expect(publicacao?.if).toBe('success() || failure()')
    // O arquivo que se publica é o que o Playwright grava: o passo do e2e liga o repórter com esse nome, e ele roda antes.
    const indiceDoE2e = passos.findIndex((passo) => passo.run?.trim().startsWith('npm run ci:e2e') === true)
    expect(indiceDoE2e).toBeGreaterThanOrEqual(0)
    expect(passos[indiceDoE2e]?.env).toEqual({ [VARIAVEL_DO_RELATORIO_DO_E2E]: ARQUIVO_DO_CENSO_DO_E2E })
    expect(passos.indexOf(publicacao as Passo)).toBeGreaterThan(indiceDoE2e)
    // As fatias que o censo lê são as da matriz.
    expect([...FATIAS_DO_E2E]).toEqual(fatiasDoE2e())
  })

  it('o job e2e publica exatamente dois artefatos, o traço e o relatório do censo: um terceiro, com outro nome, levaria o que não se declarou a um repositório público', () => {
    const publicacoes = (workflow.jobs['e2e']?.steps ?? []).filter((passo) => passo.uses?.startsWith('actions/upload-artifact@'))
    expect(publicacoes.map((passo) => passo.with?.['name'])).toEqual([NOME_DO_ARTEFATO_DO_TRACO, `${PREFIXO_DO_ARTEFATO_DO_CENSO}${EXPRESSAO_DA_FATIA}`])
  })

  it('nenhum arquivo de e2e/ anexa corpo ao resultado: o relatório do censo é público e o repórter json o grava dentro dele, em base64', () => {
    const pasta = join(raizRepositorio, 'e2e')
    const arquivos = readdirSync(pasta, { recursive: true, encoding: 'utf8' }).filter((arquivo) => arquivo.endsWith('.ts'))
    expect(arquivos.length).toBeGreaterThan(0)
    const comAnexo = arquivos.filter((arquivo) => /\.attach\(/.test(readFileSync(join(pasta, arquivo), 'utf8')))
    expect(comAnexo).toEqual([])
  })

  it('o teto do e2e cobre a suíte que existe, fatia a fatia e com folga: estourado, a esteira cancela o job sem nenhum teste vermelho', () => {
    const teto = Number(workflow.jobs['e2e']?.['timeout-minutes'])
    expect(teto).toBe(tetoDoE2e())
    const indices = fatiasDoE2e()
    const total = casosDoE2e()
    expect(total).toBeGreaterThan(0)
    const limite = teto * FRACAO_DE_FOLGA_DO_E2E
    let somados = 0
    for (const indice of indices) {
      const casos = indices.length === 1 ? total : casosDoE2e([`--shard=${String(indice)}/${String(indices.length)}`])
      expect(casos, `fatia ${String(indice)}`).toBeGreaterThan(0)
      somados += casos
      const minutos = minutosEstimadosDoE2e(casos)
      expect(
        minutos,
        `a fatia ${String(indice)} de ${String(indices.length)} do e2e tem ${String(casos)} casos, uns ${String(minutos)} min no runner, e ` +
          `o teto do job é de ${String(teto)} min: passa de ${String(Math.round(FRACAO_DE_FOLGA_DO_E2E * 100))}% dele, e a esteira ` +
          'chega ao cancelamento com a suíte verde. O que fazer está em docs/runbook.md, "Esteira vermelha no e2e".',
      ).toBeLessThanOrEqual(limite)
    }
    // As fatias juntas são a suíte. Quase tautológico, porque é o próprio Playwright quem reparte; o que pega a fatia
    // esquecida de fato são a matriz `1..n` (`fatiasDoE2e`) e o `/n` do passo, no teste dos comandos.
    expect(somados).toBe(total)
  }, 180_000)

  it('nenhum outro job publica artefato: só o e2e produz traço, e artefato de esteira é superfície a mais', () => {
    for (const [nome, job] of Object.entries(workflow.jobs)) {
      if (nome === 'e2e') continue
      expect(job.steps.filter((passo) => passo.uses?.startsWith('actions/upload-artifact@'))).toEqual([])
    }
  })

  it('o verificar baixa o histórico inteiro, para o gitleaks varrer todo commit e não só o último', () => {
    const checkout = workflow.jobs['verificar']?.steps.find((passo) => passo.uses?.startsWith('actions/checkout@'))
    expect(checkout?.with?.['fetch-depth']).toBe(0)
  })

  it('o verificar confere as entregas só em spec/** e correcao/**, com o histórico inteiro, e não na develop nem no pull request', () => {
    const passos = workflow.jobs['verificar']?.steps ?? []
    const indice = passos.findIndex((passo) => passo.run?.trim() === 'npm run ci:conferir-entregas')
    expect(indice).toBeGreaterThanOrEqual(0)
    const passo = passos[indice] as Passo
    // O script é o do `package.json`, e o histórico que ele lê (`origin/develop..HEAD`) vem do checkout inteiro.
    expect(scripts['ci:conferir-entregas']).toBe('node tools/ci/conferir-entregas.ts')
    const checkout = passos.find((candidato) => candidato.uses?.startsWith('actions/checkout@'))
    expect(checkout?.with?.['fetch-depth']).toBe(0)
    expect(passos.indexOf(checkout as Passo)).toBeLessThan(indice)
    // Antes das suítes: o vermelho das entregas não espera os minutos delas.
    expect(indice).toBeLessThan(passos.findIndex((candidato) => candidato.run?.trim() === 'npm run ci:verificar'))
    const condicao = passo.if
    expect(condicao, 'o passo tem condição').toBeTypeOf('string')
    const roda = (contexto: ContextoDoGithub): boolean => verdadeiro(avaliarExpressao(`\${{ ${String(condicao)} }}`, contexto))
    for (const ref of ['refs/heads/spec/harness', 'refs/heads/spec/x', 'refs/heads/correcao/2026-10-23-casca']) {
      expect(roda(push(ref)), ref).toBe(true)
    }
    // A execução manual numa branch de trabalho também confere: é a reexecução do push.
    expect(roda({ ...push('refs/heads/spec/x'), event_name: 'workflow_dispatch' })).toBe(true)
    for (const ref of ['refs/heads/develop', 'refs/heads/release', 'refs/heads/main', 'refs/heads/spec-x', 'refs/heads/feature/spec/x', 'refs/heads/correcoes/x']) {
      expect(roda(push(ref)), ref).toBe(false)
    }
    // No pull request a ref é a do merge, e o intervalo contra a `develop` seria o do próprio PR.
    expect(roda({ event_name: 'pull_request', ref: 'refs/pull/7/merge', run_id: 1, event: { pull_request: { number: 7 } } })).toBe(false)
    // Nenhum outro job o chama.
    for (const [nome, job] of Object.entries(workflow.jobs)) {
      if (nome !== 'verificar') expect(job.steps.filter((outro) => outro.run?.includes('conferir-entregas'))).toEqual([])
    }
  })

  it('o checkout não deixa o token do GitHub gravado no repositório clonado', () => {
    const checkouts = Object.values(workflow.jobs).flatMap((job) =>
      job.steps.filter((passo) => passo.uses?.startsWith('actions/checkout@')),
    )
    expect(checkouts).toHaveLength(Object.keys(workflow.jobs).length)
    for (const checkout of checkouts) {
      expect(checkout.with?.['persist-credentials']).toBe(false)
    }
  })
})
