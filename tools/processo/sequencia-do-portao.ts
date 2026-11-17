// A sequência de comandos do portão local: que comando cada suíte roda, em que ordem e com que ambiente. Função pura, sem
// ler a árvore nem rodar nada, para o teste conferir a ordem sem subir o compose (`portao-local.ts` executa ao ser importado).
import { GUARDAS_DA_ESTEIRA } from '../ci/etapas-de-guarda.ts'
import { tipoDoTeste } from './mutacoes.ts'
import { SUITES_DO_PORTAO_DA_TAREFA, type AlvosDoPortao } from './revisoes.ts'

/** Um comando do portão, com a suíte a que pertence (é o nome que o portão diz ao ficar vermelho) e o banco que ele começa. */
export interface PassoDoPortao {
  suite: string
  comando: string
  /**
   * Começa do banco limpo, como a esteira (`EDUCA_BANCO_NOVO=1`, `comandosDaSubidaDeTeste`, em `tools/ci/compose.ts`). Só
   * o `test` e a integração dos alvos, os primeiros que sobem o compose: o e2e e o infra vêm depois e reusam o que eles
   * subiram. Com a variável neles, o `globalSetup` do infra derrubaria o ambiente que o `test:e2e --manter-ambiente`
   * deixou de pé.
   */
  bancoNovo: boolean
}

export interface EntradaDaSequencia {
  alvos: AlvosDoPortao
  /** O começo do `docker compose` do ambiente de teste deste checkout (`['docker', ...ARGUMENTOS_COMPOSE]`). */
  docker: readonly string[]
  /** Os despachantes e workers do compose de teste (`servicosDeJob`, em `tools/ci/compose.ts`). */
  servicosDeJob: readonly string[]
  /** Alguma mutação do documento cita um teste de integração (`mutacaoDeIntegracao`): o `stop` volta antes delas. */
  mutacoesDeIntegracao: boolean
}

/** O `stop` dos despachantes e workers do compose de teste. Sem serviço nenhum o `stop` derrubaria o projeto inteiro, o banco junto: lista vazia é erro. */
export function derrubarJob(docker: readonly string[], servicosDeJob: readonly string[]): string {
  if (servicosDeJob.length === 0) throw new Error('nenhum despachante nem worker no compose de teste: o portão não saberia o que derrubar antes da integração')
  return [...docker, 'stop', ...servicosDeJob].join(' ')
}

/** Alguma das mutações roda um teste de integração, que sobe só a infra e, com worker de pé, recusa (`tools/testes/workers-de-pe.ts`): o `stop` volta antes delas, porque elas rodam sem `EDUCA_BANCO_NOVO` (`mutacoes.ts`) e nada mais os derruba. */
export function mutacaoDeIntegracao(mutacoes: readonly { teste: string }[]): boolean {
  return mutacoes.some((mutacao) => tipoDoTeste(mutacao.teste) === 'integracao')
}

/** As suítes de guarda, na ordem da lista que o `ci:verificar` também lê (`GUARDAS_DA_ESTEIRA`). */
export const SUITES_DE_GUARDA: readonly string[] = GUARDAS_DA_ESTEIRA.map((guarda) => guarda.suite)

/**
 * Os comandos de uma suíte. Lista vazia é suíte sem nada a rodar: o alvo de uma tarefa que não alterou teste nenhum.
 *
 * No alvo, a integração vem primeiro e, antes dela, o `stop` dos despachantes e workers: um deles de pé consome o job que
 * o teste enfileirou, e o teste não vê o efeito. Sem integração nos alvos nada é derrubado. Os workers voltam no e2e
 * seguinte: `tools/ci/e2e.ts` sobe o ambiente completo (`up --detach --build --wait`, sem lista de serviços). O infra
 * dos alvos não sobe os workers de novo, e não precisa deles.
 */
export function passosDaSuite(suite: string, entrada: EntradaDaSequencia): PassoDoPortao[] {
  if (suite === 'alvo') return passosDoAlvo(entrada)
  const comando = COMANDO_DA_SUITE[suite] ?? `npm run ${suite}`
  return [{ suite, comando, bancoNovo: suite === 'test' }]
}

/** Os comandos fixos das suítes que não são o alvo. A guarda roda o script do portão que a lista dela declara. */
const COMANDO_DA_SUITE: Readonly<Record<string, string>> = {
  test: 'npm run test',
  unidade: 'npm run test:unidade',
  e2e: 'npm run test:e2e',
  infra: 'npm run test:infra',
  ...Object.fromEntries(GUARDAS_DA_ESTEIRA.map((guarda) => [guarda.suite, `npm run ${guarda.script}`])),
}

function passosDoAlvo({ alvos, docker, servicosDeJob }: EntradaDaSequencia): PassoDoPortao[] {
  const passo = (comando: string, bancoNovo = false): PassoDoPortao => ({ suite: 'alvo', comando, bancoNovo })
  // A mesma ordem do portão completo: a integração sobe o compose com o banco limpo, e o e2e e o infra o reusam.
  return [
    ...(alvos.integracao.length > 0
      ? [passo(derrubarJob(docker, servicosDeJob)), passo(`npx vitest run --project integracao ${alvos.integracao.join(' ')}`, true)]
      : []),
    ...(alvos.e2e.length > 0 ? [passo(`node tools/ci/e2e.ts --manter-ambiente ${alvos.e2e.join(' ')}`)] : []),
    ...(alvos.infra.length > 0 ? [passo(`npx vitest run --project infra ${alvos.infra.join(' ')}`)] : []),
    // O git hook roda contra um git de verdade, num repositório temporário: não usa o compose, e por isso vai por último.
    ...(alvos.processo.length > 0 ? [passo(`npx vitest run --project processo ${alvos.processo.join(' ')}`)] : []),
  ]
}

/**
 * As suítes que o portão roda, em ordem. A da tarefa é a de `portao.ts`, a que o carimbo e o hook leem; a completa é a
 * da esteira (`--e2e` e `--infra` põem as duas que a máquina não roda por padrão), com as guardas da mesma lista do
 * `ci:verificar`.
 */
export function suitesDoPortao({ daTarefa, e2e, infra }: { daTarefa: boolean; e2e: boolean; infra: boolean }): string[] {
  if (daTarefa) return [...SUITES_DO_PORTAO_DA_TAREFA]
  return ['typecheck', 'lint', ...SUITES_DE_GUARDA, 'test', ...(e2e ? ['e2e'] : []), ...(infra ? ['infra'] : [])]
}

/**
 * A sequência inteira: os passos de cada suíte, na ordem das suítes, e, se alguma mutação roda teste de integração, um
 * `stop` dos despachantes e workers depois de todas elas. É aí que o `stop` protege de verdade: a integração dos alvos
 * já começa do banco limpo (`down --volumes` derruba o projeto inteiro), mas o e2e que vem depois deixa o ambiente
 * completo de pé (`--manter-ambiente`), e as mutações de integração rodam sem banco limpo, com os workers consumindo o
 * job do teste.
 */
export function sequenciaDoPortao(suites: readonly string[], entrada: EntradaDaSequencia): PassoDoPortao[] {
  return [
    ...suites.flatMap((suite) => passosDaSuite(suite, entrada)),
    ...(entrada.mutacoesDeIntegracao ? [{ suite: 'mutacoes', comando: derrubarJob(entrada.docker, entrada.servicosDeJob), bancoNovo: false }] : []),
  ]
}
