import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { parseEnv } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ETAPAS_DE_DEPENDENCIAS,
  ETAPAS_DE_GUARDA,
  etapasSemGuardaNoPortao,
  GUARDAS_DA_ESTEIRA,
  IMAGEM_GITLEAKS,
} from './etapas-de-guarda.ts'
import { raizRepositorio, type Etapa } from './executar.ts'

// Os scripts reais da esteira, com `npm`, `npx` e `docker` trocados por imitações que só
// registram a chamada. Prova que cada `ci:*` roda o teste, não engole a falha e derruba o
// ambiente, sem subir compose nem rodar a suíte de verdade.

const diretorios: string[] = []

afterEach(() => {
  for (const diretorio of diretorios.splice(0)) rmSync(diretorio, { recursive: true, force: true })
})

interface Execucao {
  codigo: number | null
  chamadas: string[]
}

/**
 * `ambienteDeTeste` é o `EDUCA_AMBIENTE_TESTE` do script. O padrão é o 0, o da esteira, escrito aqui e não herdado:
 * é dele que as linhas afirmadas abaixo falam, e o checkout que roda este teste pode estar noutro número
 * (`.processo/ambiente`).
 */
function rodarScript(script: string, falharQuandoContem: string | null, argumentos: string[] = [], ambienteDeTeste = '0'): Execucao {
  const diretorio = mkdtempSync(join(tmpdir(), 'educa-esteira-'))
  diretorios.push(diretorio)
  const registro = join(diretorio, 'chamadas.log')
  for (const comando of ['npm', 'npx', 'docker']) {
    const imitacao = join(diretorio, comando)
    writeFileSync(
      imitacao,
      [
        '#!/bin/sh',
        `linha="${comando} $*"`,
        'echo "$linha" >> "$IMITACAO_REGISTRO"',
        'case "$linha" in *"$IMITACAO_FALHAR"*) [ -n "$IMITACAO_FALHAR" ] && exit 1 ;; esac',
        'exit 0',
        '',
      ].join('\n'),
    )
    chmodSync(imitacao, 0o755)
  }
  writeFileSync(registro, '')
  const resultado = spawnSync(process.execPath, [join('tools/ci', script), ...argumentos], {
    cwd: raizRepositorio,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: 'true',
      EDUCA_AMBIENTE_TESTE: ambienteDeTeste,
      PATH: `${diretorio}${delimiter}${process.env['PATH'] ?? ''}`,
      IMITACAO_REGISTRO: registro,
      IMITACAO_FALHAR: falharQuandoContem ?? '',
    },
  })
  return { codigo: resultado.status, chamadas: readFileSync(registro, 'utf8').trim().split('\n').filter(Boolean) }
}

/** A linha que o `npm`, o `npx` ou o `docker` de imitação registra para a etapa. */
function chamadaDa(etapa: Etapa): string {
  return `${etapa.comando} ${etapa.argumentos.join(' ')}`
}

function indiceDe(chamadas: string[], trecho: string): number {
  return chamadas.findIndex((chamada) => chamada.includes(trecho))
}

/**
 * A linha inteira que o despejo da falha tem de ser, e não uma lista de propriedades dela. Afirmar
 * propriedades deixa passar tudo que as satisfaz e ainda destrói a evidência: `--since 1m` corta o
 * despejo para o último minuto, e a falha aos 15 min desaparece. Assim afirmado, morrem de uma vez
 * `--since`, `--no-color` sumido, `--tail` duplicado (o Docker usa o último), lista de serviços no
 * fim (que some com o log dos doze serviços nossos), projeto trocado, arquivo de compose trocado e
 * ordem dos argumentos.
 *
 * O `4000` está escrito à mão, e não importado de `compose.ts`: lido de lá, baixar a régua deixaria
 * o teste verde. É medido — 21/09/2026, `test:infra`, maior log de serviço nosso `api-2` com 3.899
 * linhas. Ver `tasks/correcoes/2026-09-21-log-da-falha-sem-carimbo-de-hora.md`.
 */
const DESPEJO_DA_FALHA =
  'docker compose --project-name educa-teste --env-file .env.example --env-file infra/teste.env' +
  ' -f infra/compose.yml logs --no-color --timestamps --tail 4000'

/**
 * O despejo carimbado é a única evidência que sobra de um vermelho que não reproduz na máquina de
 * quem escreveu o teste. Afirmado aqui, no script real, e não só na função que o monta: sem isto,
 * um script que voltasse a montar os argumentos por conta própria — que é como estava antes de
 * `etapasDeEncerramento` existir — manteria a suíte verde sem carimbo nenhum no log.
 */
function afirmarDespejoCarimbado(chamadas: string[], derrubou = true): void {
  // `toContain` e não `indexOf >= 0`: quem acrescentar um `--env-file` legítimo recebe o diff pronto
  // entre o esperado e o que saiu, em vez de "esperava >= 0, recebi -1" com a lista crua ao lado.
  expect(chamadas).toContain(DESPEJO_DA_FALHA)
  // E antes do `down --volumes`: depois dele os contêineres já não existem e o despejo sai vazio.
  if (derrubou) expect(indiceDe(chamadas, ' down ')).toBeGreaterThan(chamadas.indexOf(DESPEJO_DA_FALHA))
}

describe('scripts ci:* reais', () => {
  it('ci:verificar roda tipos, lint, as guardas da lista, a unidade e o git hook, e sai verde só se todos passarem', () => {
    const verde = rodarScript('verificar.ts', null)
    expect(verde.codigo).toBe(0)
    // As guardas vêm de `ETAPAS_DE_GUARDA`, a lista que o portão local também lê (RF8): guarda posta direto no
    // `verificar.ts`, fora dela, acrescenta uma chamada que esta lista não tem, e o teste fica vermelho.
    // O teste do git hook (RF14) roda aqui, e não na integração, porque não sobe o compose.
    expect(verde.chamadas).toEqual(['npm run typecheck', 'npm run lint', ...ETAPAS_DE_GUARDA.map(chamadaDa), 'npm run test:unidade', 'npm run test:processo'])
  })

  it('as guardas da esteira são o gitleaks, o npm audit e o knip, nesta ordem', () => {
    // O que a lista contém, escrito à mão: lista esvaziada deixaria o teste acima verde, com a esteira sem guarda nenhuma.
    expect(ETAPAS_DE_GUARDA.map(chamadaDa)).toEqual([
      expect.stringContaining(`docker run --rm --network none`),
      'npm audit --audit-level=high --omit=dev',
      'npx --no -- knip --include dependencies,unlisted,binaries,unresolved',
    ])
  })

  it('RF8: o portão local cobre todas as etapas do ci:verificar, e uma guarda a mais só nele fica sem cobertura', () => {
    expect(etapasSemGuardaNoPortao(ETAPAS_DE_GUARDA)).toEqual([])
    const aMais: Etapa = { nome: 'guarda nova', comando: 'npm', argumentos: ['run', 'guarda:nova'] }
    expect(etapasSemGuardaNoPortao([...ETAPAS_DE_GUARDA, aMais])).toEqual([aMais])
    // A cobertura é da etapa que a lista tem, não de uma de mesmo texto.
    expect(etapasSemGuardaNoPortao([{ ...(ETAPAS_DE_GUARDA[0] as Etapa) }])).toHaveLength(1)
  })

  it('RF8: o script do portão de cada guarda existe no package.json e roda as etapas da lista', () => {
    const scripts = (JSON.parse(readFileSync(join(raizRepositorio, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts
    expect(GUARDAS_DA_ESTEIRA.map((guarda) => [guarda.suite, guarda.script, scripts[guarda.script]])).toEqual([
      ['segredo', 'guarda:segredo', 'node tools/ci/segredo.ts'],
      ['dependencias', 'guarda:dependencias', 'node tools/ci/dependencias.ts'],
    ])
    // O script de dependências roda as etapas da esteira, e não um texto redigitado: as mesmas chamadas, na mesma ordem.
    const dependencias = rodarScript('dependencias.ts', null)
    expect(dependencias.codigo).toBe(0)
    expect(dependencias.chamadas).toEqual(ETAPAS_DE_DEPENDENCIAS.map(chamadaDa))
    expect(rodarScript('dependencias.ts', 'npm audit').codigo).not.toBe(0)
    expect(rodarScript('dependencias.ts', 'knip').codigo).not.toBe(0)
    // E o do segredo roda o gitleaks da imagem fixada pela esteira.
    expect(rodarScript('segredo.ts', null).chamadas[0]).toContain(IMAGEM_GITLEAKS)
  })

  it.each(['npm run lint', IMAGEM_GITLEAKS, 'npm audit --audit-level=high --omit=dev', 'npx --no -- knip', 'npm run test:unidade'])(
    'ci:verificar sai vermelho quando "%s" falha: guarda é portão, não aviso',
    (etapa) => {
      expect(rodarScript('verificar.ts', etapa).codigo).not.toBe(0)
    },
  )

  it.each([
    ['integracao.ts', 'npm run test:integracao'],
    ['infra.ts', 'npm run test:infra'],
  ])('%s roda os seus testes, sai vermelho quando eles falham e ainda derruba o compose', (script, teste) => {
    const verde = rodarScript(script, null)
    expect(verde.codigo).toBe(0)
    expect(indiceDe(verde.chamadas, teste)).toBeGreaterThan(indiceDe(verde.chamadas, ' up '))
    expect(indiceDe(verde.chamadas, ' down ')).toBeGreaterThan(indiceDe(verde.chamadas, teste))

    const vermelho = rodarScript(script, teste)
    expect(vermelho.codigo).not.toBe(0)
    expect(indiceDe(vermelho.chamadas, ' down ')).toBeGreaterThan(indiceDe(vermelho.chamadas, teste))
    afirmarDespejoCarimbado(vermelho.chamadas)

    // E não despeja quando passou: log de execução verde é ruído no log do job.
    expect(verde.chamadas.some((chamada) => / logs /.test(chamada))).toBe(false)
  })

  it('ci:infra leva a fatia da esteira ao Vitest, e fatia malformada reprova antes de subir o compose', () => {
    const fatia = rodarScript('infra.ts', null, ['--shard=2/3'])
    expect(fatia.codigo).toBe(0)
    expect(fatia.chamadas).toContain('npm run test:infra -- --shard=2/3')
    expect(indiceDe(fatia.chamadas, 'npm run test:infra')).toBeGreaterThan(indiceDe(fatia.chamadas, ' up '))
    expect(indiceDe(fatia.chamadas, ' down ')).toBeGreaterThan(indiceDe(fatia.chamadas, 'npm run test:infra'))

    // Sem fatia, o projeto inteiro: é o `npm run ci:infra` da máquina e o portão da tarefa.
    expect(rodarScript('infra.ts', null).chamadas).toContain('npm run test:infra')
    expect(rodarScript('infra.ts', null).chamadas.some((chamada) => chamada.includes('--shard'))).toBe(false)

    // Fatia vermelha continua derrubando o compose e despejando o log.
    const vermelha = rodarScript('infra.ts', 'npm run test:infra', ['--shard=1/3'])
    expect(vermelha.codigo).not.toBe(0)
    afirmarDespejoCarimbado(vermelha.chamadas)

    // `${{ matrix.fatia }}` que não foi expandido, um índice fora do total ou duas fatias rodariam a suíte errada.
    for (const malformada of [['--shard=4/3'], ['--shard=0/3'], ['--shard=${{'], ['--shard=1/2', '--shard=2/2']]) {
      const resultado = rodarScript('infra.ts', null, malformada)
      expect(resultado.codigo, malformada.join(' ')).not.toBe(0)
      expect(resultado.chamadas, malformada.join(' ')).toEqual([])
    }
  })

  it('a esteira roda todo projeto do Vitest, e o `npm run test` do portão da tarefa só deixa de fora o de infra (D52)', async () => {
    const { default: configuracao } = await import('../../vitest.config.ts')
    const projetos = (configuracao.test?.projects ?? []).map((projeto) => (typeof projeto === 'object' && 'test' in projeto ? projeto.test?.name : undefined))
    expect(projetos).toEqual(['unidade', 'integracao', 'infra', 'processo'])

    const scripts = (JSON.parse(readFileSync(join(raizRepositorio, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts
    const chamadasDaEsteira = ['verificar.ts', 'integracao.ts', 'infra.ts'].flatMap((script) => rodarScript(script, null).chamadas)
    for (const projeto of projetos) {
      expect(scripts[`test:${String(projeto)}`]).toBe(`vitest run --project ${String(projeto)}`)
      expect(chamadasDaEsteira).toContain(`npm run test:${String(projeto)}`)
    }
    expect(scripts['test']).toBe('vitest run --project unidade --project integracao --project processo')
  })

  it('ci:e2e roda o Playwright, sai vermelho quando ele falha e ainda derruba o compose', () => {
    const verde = rodarScript('e2e.ts', null)
    expect(verde.codigo).toBe(0)
    expect(indiceDe(verde.chamadas, 'npx playwright test')).toBeGreaterThan(indiceDe(verde.chamadas, ' up '))
    expect(indiceDe(verde.chamadas, ' down ')).toBeGreaterThan(indiceDe(verde.chamadas, 'npx playwright test'))

    const vermelho = rodarScript('e2e.ts', 'npx playwright test')
    expect(vermelho.codigo).not.toBe(0)
    expect(indiceDe(vermelho.chamadas, ' down ')).toBeGreaterThan(indiceDe(vermelho.chamadas, 'npx playwright test'))
    afirmarDespejoCarimbado(vermelho.chamadas)
    expect(verde.chamadas.some((chamada) => / logs /.test(chamada))).toBe(false)
  })

  it('ci:e2e mede o teto do bundle depois do build da web e antes do Playwright, e sai vermelho quando ele estoura', () => {
    const verde = rodarScript('e2e.ts', null)
    const build = indiceDe(verde.chamadas, 'npm run build -w @educa/web')
    const teto = indiceDe(verde.chamadas, 'npx size-limit')
    expect(build).toBeGreaterThanOrEqual(0)
    expect(teto).toBeGreaterThan(build)
    expect(indiceDe(verde.chamadas, 'npx playwright test')).toBeGreaterThan(teto)

    const vermelho = rodarScript('e2e.ts', 'npx size-limit')
    expect(vermelho.codigo).not.toBe(0)
    expect(indiceDe(vermelho.chamadas, 'npx playwright test')).toBe(-1)
  })

  it('ci:e2e leva a fatia da esteira ao Playwright, e fatia malformada reprova antes de subir qualquer coisa', () => {
    const fatia = rodarScript('e2e.ts', null, ['--shard=2/4'])
    expect(fatia.codigo).toBe(0)
    expect(fatia.chamadas).toContain('npx playwright test --shard=2/4')
    // `CI=true` chega às etapas: é o mesmo `naEsteira` que faz o aviso de prazo sair como anotação da execução.
    expect(fatia.chamadas).toContain('npx playwright install --with-deps chromium')

    // Sem fatia, a suíte inteira: é o `npm run test:e2e` da máquina.
    expect(rodarScript('e2e.ts', null).chamadas).toContain('npx playwright test')

    // `${{ matrix.fatia }}` que não foi expandido, ou um índice fora do total, rodaria a suíte errada numa fatia.
    const malformada = rodarScript('e2e.ts', null, ['--shard=5/4'])
    expect(malformada.codigo).not.toBe(0)
    expect(malformada.chamadas).toEqual([])
  })

  it('test:e2e mantém o ambiente de pé para o desenvolvedor, mas não esconde a falha', () => {
    const vermelho = rodarScript('e2e.ts', 'npx playwright test', ['--manter-ambiente'])
    expect(vermelho.codigo).not.toBe(0)
    expect(indiceDe(vermelho.chamadas, ' down ')).toBe(-1)
    // Mantendo o ambiente, o despejo continua: quem depura tem o log carimbado e os contêineres de pé.
    afirmarDespejoCarimbado(vermelho.chamadas, false)
  })

  it.each(['integracao.ts', 'infra.ts', 'e2e.ts'])('todo compose de %s usa o projeto de teste e só os arquivos de ambiente versionados', (script) => {
    const { chamadas } = rodarScript(script, null)
    const composes = chamadas.filter((chamada) => chamada.startsWith('docker compose'))
    expect(composes.length).toBeGreaterThan(0)
    for (const chamada of composes) {
      expect(chamada).toContain(
        'docker compose --project-name educa-teste --env-file .env.example --env-file infra/teste.env -f infra/compose.yml',
      )
    }
  })

  it.each(['integracao.ts', 'infra.ts', 'e2e.ts'])('com EDUCA_AMBIENTE_TESTE=2, todo compose de %s fala com o projeto e as portas do ambiente 2', (script) => {
    const { codigo, chamadas } = rodarScript(script, null, [], '2')
    expect(codigo).toBe(0)
    const composes = chamadas.filter((chamada) => chamada.startsWith('docker compose'))
    expect(composes.length).toBeGreaterThan(0)
    for (const chamada of composes) {
      // A linha inteira até o `-f`, escrita à mão: com o projeto do ambiente 2 e sem o arquivo dele, ou com o
      // arquivo antes de `infra/teste.env`, o script subiria o `educa-teste-2` nas portas do ambiente 0.
      expect(chamada).toContain(
        'docker compose --project-name educa-teste-2 --env-file .env.example --env-file infra/teste.env' +
          ' --env-file .processo/ambiente-de-teste-2.env -f infra/compose.yml ',
      )
    }
    // O arquivo que a linha cita existe quando o compose roda, e leva a web 2000 acima da do ambiente 0.
    const base = parseEnv(readFileSync(join(raizRepositorio, 'infra/teste.env'), 'utf8'))
    const derivado = parseEnv(readFileSync(join(raizRepositorio, '.processo/ambiente-de-teste-2.env'), 'utf8'))
    expect(derivado['WEB_PORTA_HOST']).toBe(String(Number(base['WEB_PORTA_HOST']) + 2000))
    expect(derivado['POSTGRES_PORTA_HOST']).toBe(String(Number(base['POSTGRES_PORTA_HOST']) + 2000))
  })

  it.each(['integracao.ts', 'infra.ts', 'e2e.ts'])('com número de ambiente inválido, %s reprova antes de chamar o compose', (script) => {
    // Cair no ambiente 0 calado derrubaria o banco de outro checkout no `down --volumes` do fim.
    for (const invalido of ['4', 'dois', '']) {
      const { codigo, chamadas } = rodarScript(script, null, [], invalido)
      expect(codigo, invalido).not.toBe(0)
      expect(chamadas, invalido).toEqual([])
    }
  })
})
