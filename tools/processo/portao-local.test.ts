import { describe, expect, it } from 'vitest'
import { ARGUMENTOS_COMPOSE, servicosDeJob } from '../ci/compose.ts'
import { GUARDAS_DA_ESTEIRA } from '../ci/etapas-de-guarda.ts'
import { etapasDoE2e, tetoDoE2e } from '../ci/prazo-do-e2e.ts'
import { SUITES_DO_PORTAO_COMPLETO, SUITES_DO_PORTAO_DA_TAREFA, type AlvosDoPortao } from './revisoes.ts'
import { mutacaoDeIntegracao, passosDaSuite, sequenciaDoPortao, SUITES_DE_GUARDA, suitesDoPortao, type EntradaDaSequencia } from './sequencia-do-portao.ts'

// A sequência de comandos do portão local (RF7, RF8, 8.0). O `portao-local.ts` executa ao ser importado e não se testa
// por aqui: tudo o que se decide sobre a ordem dos comandos mora em `sequencia-do-portao.ts`, que é pura.

const SEM_ALVOS: AlvosDoPortao = { integracao: [], e2e: [], infra: [], processo: [] }
const DOCKER = ['docker', ...ARGUMENTOS_COMPOSE]

function entrada(alvos: Partial<AlvosDoPortao>, servicos: readonly string[] = servicosDeJob(), mutacoesDeIntegracao = false): EntradaDaSequencia {
  return { alvos: { ...SEM_ALVOS, ...alvos }, docker: DOCKER, servicosDeJob: servicos, mutacoesDeIntegracao }
}

const comandosDoAlvo = (alvos: Partial<AlvosDoPortao>): string[] => passosDaSuite('alvo', entrada(alvos)).map((passo) => passo.comando)
const indiceDe = (comandos: string[], trecho: string): number => comandos.findIndex((comando) => comando.includes(trecho))

describe('os serviços que consomem job, lidos do compose', () => {
  it('são os despachantes e os workers do compose de teste, e nenhum outro', () => {
    // O `infra/compose.yml` real: réplica que o compose ganhar entra sozinha, e é o que a lista fixa deixaria de fazer.
    expect(servicosDeJob()).toEqual(['despachante-1', 'despachante-2', 'worker-interativo-1', 'worker-interativo-2', 'worker-lote-1', 'worker-lote-2'])
  })

  it('o nome tem de começar por despachante ou worker, seguido de hífen ou do fim', () => {
    const compose = [
      'services:',
      '  despachante-1: { image: a }',
      '  despachante: { image: a }',
      '  worker-lote-3: { image: a }',
      '  worker: { image: a }',
      '  api-1: { image: a }',
      '  meu-worker: { image: a }',
      '  workers: { image: a }',
      '  despachante2: { image: a }',
    ].join('\n')
    expect(servicosDeJob(compose)).toEqual(['despachante-1', 'despachante', 'worker-lote-3', 'worker'])
  })
})

describe('RF7: o portão derruba os workers antes da integração', () => {
  it('com integração nos alvos, o `stop` dos despachantes e workers vem antes do vitest da integração', () => {
    const comandos = comandosDoAlvo({ integracao: ['apps/api/test/a.int.test.ts'] })
    const derrubar = indiceDe(comandos, ' stop ')
    expect(derrubar).toBeGreaterThanOrEqual(0)
    expect(indiceDe(comandos, '--project integracao')).toBeGreaterThan(derrubar)
    // O comando inteiro, do compose de teste deste checkout, e só os serviços de job: `stop` pelo projeto inteiro levaria o banco.
    expect(comandos[derrubar]).toBe(`${DOCKER.join(' ')} stop despachante-1 despachante-2 worker-interativo-1 worker-interativo-2 worker-lote-1 worker-lote-2`)
    expect(comandos).toHaveLength(2)
  })

  it('sem integração nos alvos, nada é derrubado, qualquer que seja o resto', () => {
    expect(comandosDoAlvo({})).toEqual([])
    const semIntegracao = comandosDoAlvo({ e2e: ['e2e/a.spec.ts'], infra: ['infra/test/a.int.test.ts'] })
    expect(semIntegracao).toHaveLength(2)
    expect(semIntegracao.filter((comando) => comando.includes('docker') || comando.includes(' stop '))).toEqual([])
  })

  it('depois da integração vêm o e2e e o infra, sem outro `stop` entre eles', () => {
    const comandos = comandosDoAlvo({ integracao: ['apps/api/test/a.int.test.ts'], e2e: ['e2e/a.spec.ts'], infra: ['infra/test/a.int.test.ts'] })
    expect(comandos).toHaveLength(4)
    expect(comandos[0]).toContain(' stop ')
    expect(comandos[1]).toContain('--project integracao')
    expect(comandos[2]).toBe('node tools/ci/e2e.ts --manter-ambiente e2e/a.spec.ts')
    expect(comandos[3]).toContain('--project infra')
    expect(comandos.filter((comando) => comando.includes(' stop '))).toHaveLength(1)
    expect(indiceDe(comandos, 'tools/ci/e2e.ts')).toBeGreaterThan(indiceDe(comandos, '--project integracao'))
  })

  it('o e2e sobe os workers de novo: o `up` dele é do ambiente inteiro, sem lista de serviços', () => {
    // O passo do e2e não repete o `up` dos workers: o `tools/ci/e2e.ts` sobe o ambiente completo, com `--build`. Se esse
    // `up` passasse a nomear serviços, os workers derrubados antes da integração ficariam parados no e2e.
    const subida = etapasDoE2e(['e2e/a.spec.ts'], tetoDoE2e(), false).find((etapa) => etapa.argumentos.includes('up'))
    expect(subida?.argumentos).toEqual([...ARGUMENTOS_COMPOSE, 'up', '--detach', '--build', '--wait'])
  })

  it('compose sem despachante nem worker é erro, e não um `stop` do projeto inteiro', () => {
    expect(() => passosDaSuite('alvo', entrada({ integracao: ['apps/api/test/a.int.test.ts'] }, []))).toThrow(/nenhum despachante nem worker/)
    // Sem integração nos alvos a lista não é lida, e vazia não reprova.
    expect(passosDaSuite('alvo', entrada({ e2e: ['e2e/a.spec.ts'] }, []))).toHaveLength(1)
  })
})

describe('RF7: o portão derruba os workers também antes das mutações de integração', () => {
  const ALVOS = { integracao: ['apps/api/test/a.int.test.ts'], e2e: ['e2e/a.spec.ts'], infra: ['infra/test/a.int.test.ts'] }
  const STOP = `${DOCKER.join(' ')} stop ${servicosDeJob().join(' ')}`
  const comandosDaTarefa = (mutacoesDeIntegracao: boolean, alvos: Partial<AlvosDoPortao> = ALVOS) =>
    sequenciaDoPortao(SUITES_DO_PORTAO_DA_TAREFA, entrada(alvos, servicosDeJob(), mutacoesDeIntegracao)).map((passo) => passo.comando)

  it('com mutação de integração, um `stop` vem depois do e2e e do infra, como último passo, antes de qualquer mutação', () => {
    const comandos = comandosDaTarefa(true)
    expect(comandos.filter((comando) => comando === STOP)).toHaveLength(2)
    expect(comandos.lastIndexOf(STOP)).toBe(comandos.length - 1)
    expect(comandos.lastIndexOf(STOP)).toBeGreaterThan(indiceDe(comandos, 'tools/ci/e2e.ts'))
    expect(comandos.lastIndexOf(STOP)).toBeGreaterThan(indiceDe(comandos, '--project infra'))
  })

  it('o e2e é o que deixa os workers de pé, e por isso o `stop` das mutações vale mesmo sem integração nos alvos', () => {
    // Sem integração nos alvos não há o `stop` do alvo; o das mutações é o único.
    const comandos = comandosDaTarefa(true, { e2e: ['e2e/a.spec.ts'] })
    expect(comandos.filter((comando) => comando === STOP)).toEqual([STOP])
    expect(comandos.indexOf(STOP)).toBeGreaterThan(indiceDe(comandos, 'tools/ci/e2e.ts'))
  })

  it('sem mutação de integração, só o `stop` do alvo', () => {
    expect(comandosDaTarefa(false).filter((comando) => comando === STOP)).toHaveLength(1)
    expect(comandosDaTarefa(false, {}).filter((comando) => comando.includes(' stop '))).toEqual([])
  })

  it('o `stop` das mutações tem a suíte `mutacoes` e não limpa o banco', () => {
    const passos = sequenciaDoPortao(SUITES_DO_PORTAO_DA_TAREFA, entrada({}, servicosDeJob(), true))
    expect(passos.at(-1)).toEqual({ suite: 'mutacoes', comando: STOP, bancoNovo: false })
  })

  it('compose sem despachante nem worker é erro também para as mutações', () => {
    expect(() => sequenciaDoPortao(SUITES_DO_PORTAO_DA_TAREFA, entrada({}, [], true))).toThrow(/nenhum despachante nem worker/)
    expect(sequenciaDoPortao(SUITES_DO_PORTAO_DA_TAREFA, entrada({}, [], false))).not.toHaveLength(0)
  })

  it('só o teste de integração conta: unidade, e2e e infra não pedem o `stop`', () => {
    expect(mutacaoDeIntegracao([{ teste: 'apps/api/test/a.int.test.ts' }])).toBe(true)
    expect(mutacaoDeIntegracao([{ teste: 'tools/x.test.ts' }, { teste: 'e2e/a.spec.ts' }, { teste: 'infra/test/a.int.test.ts' }])).toBe(false)
    expect(mutacaoDeIntegracao([{ teste: 'tools/x.test.ts' }, { teste: 'packages/core/test/a.int.test.ts' }])).toBe(true)
    expect(mutacaoDeIntegracao([])).toBe(false)
  })
})

describe('o banco limpo é só da primeira suíte que sobe o compose', () => {
  const bancoNovoDe = (suite: string, alvos: Partial<AlvosDoPortao> = {}): boolean[] => passosDaSuite(suite, entrada(alvos)).map((passo) => passo.bancoNovo)

  it('o `npm run test` e a integração dos alvos começam do banco limpo; o stop, o e2e e o infra não', () => {
    expect(bancoNovoDe('test')).toEqual([true])
    // Na ordem dos comandos: stop, integração, e2e, infra.
    expect(bancoNovoDe('alvo', { integracao: ['a.int.test.ts'], e2e: ['e2e/a.spec.ts'], infra: ['infra/a.int.test.ts'] })).toEqual([false, true, false, false])
  })

  it.each(['typecheck', 'lint', 'unidade', 'e2e', 'infra', 'segredo', 'dependencias'])('a suíte %s não limpa o banco', (suite) => {
    expect(bancoNovoDe(suite)).toEqual([false])
  })
})

describe('RF14: o teste do git hook roda sem o compose', () => {
  const comandos = (alvos: Partial<AlvosDoPortao>): string[] => passosDaSuite('alvo', entrada(alvos)).map((passo) => passo.comando)

  it('vai no projeto `processo`, sem `stop` nem banco limpo, mesmo com os outros alvos no portão', () => {
    const sozinho = passosDaSuite('alvo', entrada({ processo: ['tools/processo/hook-git.int.test.ts'] }))
    expect(sozinho.map((passo) => passo.comando)).toEqual(['npx vitest run --project processo tools/processo/hook-git.int.test.ts'])
    expect(sozinho.map((passo) => passo.bancoNovo)).toEqual([false])
    const junto = comandos({ integracao: ['apps/api/test/a.int.test.ts'], e2e: ['e2e/a.spec.ts'], infra: ['infra/a.int.test.ts'], processo: ['tools/processo/hook-git.int.test.ts'] })
    expect(junto.filter((comando) => comando.includes(' stop '))).toHaveLength(1)
    expect(junto.at(-1)).toBe('npx vitest run --project processo tools/processo/hook-git.int.test.ts')
  })

  it('sem alvo do processo, o projeto não é chamado', () => {
    expect(comandos({ integracao: ['apps/api/test/a.int.test.ts'] }).some((comando) => comando.includes('--project processo'))).toBe(false)
  })
})

describe('RF8: o portão chama as guardas da lista que o ci:verificar lê', () => {
  it('cada guarda roda o seu script, e a suíte de guarda tem o nome que o carimbo guarda', () => {
    expect(SUITES_DE_GUARDA).toEqual(GUARDAS_DA_ESTEIRA.map((guarda) => guarda.suite))
    for (const guarda of GUARDAS_DA_ESTEIRA) {
      expect(passosDaSuite(guarda.suite, entrada({})).map((passo) => passo.comando)).toEqual([`npm run ${guarda.script}`])
    }
  })

  it('as suítes de guarda estão, na mesma ordem, no portão da tarefa e no completo, entre o lint e os testes', () => {
    for (const suites of [SUITES_DO_PORTAO_DA_TAREFA, SUITES_DO_PORTAO_COMPLETO]) {
      const inicio = suites.indexOf('lint') + 1
      expect(suites.slice(inicio, inicio + SUITES_DE_GUARDA.length)).toEqual(SUITES_DE_GUARDA)
    }
  })

  it('a sequência do portão completo e a da tarefa levam os comandos das guardas, na ordem das suítes', () => {
    const guardas = GUARDAS_DA_ESTEIRA.map((guarda) => `npm run ${guarda.script}`)
    for (const suites of [SUITES_DO_PORTAO_COMPLETO, SUITES_DO_PORTAO_DA_TAREFA]) {
      const comandos = sequenciaDoPortao(suites, entrada({})).map((passo) => passo.comando)
      expect(comandos.filter((comando) => guardas.includes(comando))).toEqual(guardas)
      expect(comandos.indexOf('npm run lint')).toBeLessThan(comandos.indexOf(guardas[0] ?? ''))
    }
  })
})

describe('as suítes do portão', () => {
  it('o portão da tarefa roda as suítes que o carimbo e o hook leem', () => {
    expect(suitesDoPortao({ daTarefa: true, e2e: true, infra: true })).toEqual([...SUITES_DO_PORTAO_DA_TAREFA])
  })

  it('o portão completo é o da esteira, e só leva o e2e e o infra se pedidos', () => {
    expect(suitesDoPortao({ daTarefa: false, e2e: false, infra: false })).toEqual(['typecheck', 'lint', ...SUITES_DE_GUARDA, 'test'])
    expect(suitesDoPortao({ daTarefa: false, e2e: true, infra: false })).toEqual(['typecheck', 'lint', ...SUITES_DE_GUARDA, 'test', 'e2e'])
    expect(suitesDoPortao({ daTarefa: false, e2e: false, infra: true })).toEqual(['typecheck', 'lint', ...SUITES_DE_GUARDA, 'test', 'infra'])
    expect(suitesDoPortao({ daTarefa: false, e2e: true, infra: true })).toEqual([...SUITES_DO_PORTAO_COMPLETO])
  })

  it.each([
    ['typecheck', 'npm run typecheck'],
    ['lint', 'npm run lint'],
    ['test', 'npm run test'],
    ['unidade', 'npm run test:unidade'],
    ['e2e', 'npm run test:e2e'],
    ['infra', 'npm run test:infra'],
  ])('a suíte %s roda `%s`', (suite, comando) => {
    expect(passosDaSuite(suite, entrada({})).map((passo) => passo.comando)).toEqual([comando])
  })
})
