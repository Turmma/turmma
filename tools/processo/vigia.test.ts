import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { comLimpeza, comLimpezaDoArquivo, decidir, estaTrabalhando, LIMPEZA_DEMORA_MS, limpezaPerdida, nomesDoTime, SEM_OLHAR_MS } from './vigia.ts'

// A vigia que não acorda o modelo à toa. O erro caro é o contrário: ficar calada com o time parado. Por isso todo
// caso de dúvida acorda.

const PARADO = ['● Pronto.', '', '✻ Churned for 5s · done 15:59', '─────', '❯ ', '─────', '  ⏵⏵ bypass permissions on (shift+tab to cycle)'].join('\n')
const TRABALHANDO = ['● Rodando o portão da tarefa…', '', '✶ Forging… (2m 14s · ↓ 3.1k tokens · esc to interrupt)', '─────', '❯ ', '─────'].join('\n')
const agora = new Date('2026-10-12T10:00:00.000Z')
const ha = (minutos: number) => new Date(agora.getTime() - minutos * 60_000).toISOString()

const RAIZ = join(import.meta.dirname, '../..')
const FIXTURE_DO_LIST = join(import.meta.dirname, '__fixtures__/maestri-list.txt')

describe('quem é do time', () => {
  it('só os papéis, com ou sem número de linha, entre os agentes ligados', () => {
    const lista = [
      'You:',
      '  - name: "Claude Code"',
      '',
      'Connected agents:',
      '  - name: "Arquiteto"',
      '  - name: "Implementador"',
      '  - name: "Mesa 2"',
      '  - name: "Implementador 2"',
      '  - name: "Validador"',
      '  - name: "Claude Code #2"',
      '  - name: "Mesa de bar"',
    ].join('\n')
    expect(nomesDoTime(lista)).toEqual(['Arquiteto', 'Implementador', 'Mesa 2', 'Implementador 2', 'Validador'])
    expect(nomesDoTime('You:\n  - name: "Arquiteto"\n')).toEqual([])
  })

  it('trabalha quem mostra "esc to interrupt" no fim da tela, e não quem o tem lá em cima, de um turno antigo', () => {
    expect(estaTrabalhando(TRABALHANDO)).toBe(true)
    expect(estaTrabalhando(PARADO)).toBe(false)
    expect(estaTrabalhando(`${TRABALHANDO}\n${'linha\n'.repeat(30)}${PARADO}`)).toBe(false)
  })

  it('trabalha quem espera o portão em segundo plano: o rodapé conta o comando, e não o "still running" que ficou no histórico', () => {
    // Telas de 05/11/2026: o Implementador solta o portão, encerra o turno e espera o aviso de fim.
    const esperandoOPortao = [
      '● Estou à espera do portão. O aviso de fim chega sozinho.',
      '',
      '✻ Worked for 1m 58s · done 11:12 PM · 1 shell still running',
      '',
      '───── implementador ─',
      '❯ ',
      '─────',
      '  ⏵⏵ bypass permissions on · 1 shell · ↓ to manage',
      '',
    ].join('\n')
    expect(estaTrabalhando(esperandoOPortao)).toBe(true)
    expect(estaTrabalhando(esperandoOPortao.replace('· 1 shell ·', '· 2 shells ·'))).toBe(true)
    // O comando acabou: o rodapé volta ao normal, e a linha "still running" do turno antigo não conta.
    expect(estaTrabalhando(esperandoOPortao.replace('on · 1 shell · ↓ to manage', 'on (shift+tab to cycle)'))).toBe(false)
    expect(estaTrabalhando(`● Ran 1 shell command\n${PARADO}`)).toBe(false)
  })
})

describe('acordar ou não', () => {
  it('com alguém trabalhando, não acorda, e guarda desde quando', () => {
    const decisao = decidir({ Implementador: PARADO, Mesa: TRABALHANDO }, {}, agora)
    expect(decisao).toEqual({ acordar: false, motivo: 'Mesa trabalhando', visto: { Mesa: agora.toISOString() } })
    expect(decidir({ Mesa: TRABALHANDO }, { Mesa: ha(90) }, agora).visto).toEqual({ Mesa: ha(90) })
  })

  it('com todos parados, acorda: alguém deve um relatório, ou há pergunta na tela', () => {
    expect(decidir({ Implementador: PARADO, Mesa: PARADO }, { Mesa: ha(30) }, agora)).toEqual({ acordar: true, motivo: 'ninguém trabalhando', visto: {} })
  })

  it('sem terminal do time, ou com tela vazia, acorda', () => {
    expect(decidir({}, {}, agora).acordar).toBe(true)
    expect(decidir({ Implementador: '' }, {}, agora).acordar).toBe(true)
  })

  it('quem trabalha há duas horas sem a vigia olhar acorda o modelo uma vez, e o relógio recomeça', () => {
    const limite = SEM_OLHAR_MS / 60_000
    expect(decidir({ Implementador: TRABALHANDO }, { Implementador: ha(limite - 1) }, agora).acordar).toBe(false)
    const demorou = decidir({ Implementador: TRABALHANDO, 'Implementador 2': TRABALHANDO }, { Implementador: ha(limite), 'Implementador 2': ha(10) }, agora)
    expect(demorou.acordar).toBe(true)
    expect(demorou.motivo).toBe('Implementador trabalha há duas horas sem a vigia olhar')
    expect(demorou.visto).toEqual({ Implementador: agora.toISOString(), 'Implementador 2': ha(10) })
  })

  it('quem parou e voltou a trabalhar recomeça a contagem', () => {
    const parou = decidir({ Implementador: PARADO, Mesa: TRABALHANDO }, { Implementador: ha(119) }, agora)
    expect(parou.visto).toEqual({ Mesa: agora.toISOString() })
  })
})

describe('a saída real do maestri list (RF28)', () => {
  const lerFixture = () => readFileSync(FIXTURE_DO_LIST, 'utf8')
  const TIME = ['Arquiteto', 'Implementador', 'Mesa', 'Validador', 'Implementador 2', 'Mesa 2', 'Implementador 3', 'Mesa 3']

  it('lê os terminais do time entre os agentes ligados, com as linhas numeradas, e deixa de fora o que não é do time', () => {
    const lista = lerFixture()
    // A fixture é a saída crua de `maestri list`, gravada em 24/10/2026 no terminal do Orquestrador, onde a vigia roda: traz
    // as linhas numeradas (`Implementador 2`, `Mesa 3`), um terminal que não é do time (`Claude Code #2`), uma nota ligada
    // (`Comandos`, depois de "Connected agents:") e as linhas `⎿` de quem está ligado a quem. Regrave-a quando o Maestri
    // mudar o formato. Os dois blocos que o código lê têm de estar nela.
    expect(lista).toContain('Connected agents:')
    expect(lista).toContain('You:')
    expect(lista).toContain('- name: "Claude Code #2"')
    expect(lista).toContain('- name: "Comandos"')
    expect(nomesDoTime(lista)).toEqual(TIME)
    expect(nomesDoTime(lista)).not.toContain('Claude Code #2')
    expect(nomesDoTime(lista)).not.toContain('Comandos')
  })

  it('não lê o bloco "You": nome do time ali, como na lista de um terminal do time, não entra', () => {
    const lista = lerFixture()
    // A fixture, tirada do Orquestrador, tem só `Claude Code` no `You:`; a lista de um terminal do time traz um papel ali.
    // Troca-se o bloco por um papel e o resultado tem de ser o mesmo: sem o corte em `Connected agents:`, `Implementador`
    // entraria duas vezes.
    const comPapelNoYou = `You:\n  - name: "Implementador"\n${lista.slice(lista.indexOf('\nConnected agents:'))}`
    expect(comPapelNoYou).not.toBe(lista)
    expect(nomesDoTime(comPapelNoYou)).toEqual(TIME)
  })

  it('a fixture não leva caminho de usuário, e-mail nem endereço fora do loopback (o repositório é público)', () => {
    const lista = lerFixture()
    expect(lista).not.toMatch(/\/home\/|\/Users\/|C:\\|~\//)
    expect(lista).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/)
    const enderecos = [...lista.matchAll(/https?:\/\/([^\s:/"]+)/g)].map((achado) => achado[1])
    expect(enderecos.every((endereco) => endereco === '127.0.0.1' || endereco === 'localhost')).toBe(true)
  })
})

describe('docs/processo-sem-maestri.md (RF28)', () => {
  const documento = () => readFileSync(join(RAIZ, 'docs/processo-sem-maestri.md'), 'utf8')

  it('cita o comando dos quatro papéis, com o nome do arquivo que cada um tem em .claude/agents/', () => {
    for (const papel of ['arquiteto', 'implementador', 'mesa-de-revisao', 'validador']) {
      expect(existsSync(join(RAIZ, `.claude/agents/${papel}.md`))).toBe(true)
      expect(documento()).toMatch(new RegExp(`claude --dangerously-skip-permissions --agent ${papel}( |\\n|$)`, 'm'))
    }
  })

  it('traz o socorro do hook, com o que ele perde e o que não apaga', () => {
    const texto = documento()
    expect(texto).toContain('git -C <checkout> checkout origin/develop -- tools/processo .claude/settings.json')
    expect(texto).toMatch(/perde/)
    expect(texto).toMatch(/não apaga/)
  })
})

describe('a limpeza pedida e não feita (RF27)', () => {
  const pedida = (minutos: number) => ({ pedida: new Date(agora.getTime() - minutos * 60_000).toISOString() })

  it('pedida há 11 minutos sem feita: se perdeu. Há 9: ainda não', () => {
    expect(limpezaPerdida(pedida(11), agora)).toBe(true)
    expect(limpezaPerdida(pedida(9), agora)).toBe(false)
  })

  it('o limite é "mais de 10 minutos": em 10 em ponto ainda não, um milissegundo depois sim', () => {
    expect(LIMPEZA_DEMORA_MS).toBe(10 * 60_000)
    expect(limpezaPerdida({ pedida: new Date(agora.getTime() - LIMPEZA_DEMORA_MS).toISOString() }, agora)).toBe(false)
    expect(limpezaPerdida({ pedida: new Date(agora.getTime() - LIMPEZA_DEMORA_MS - 1).toISOString() }, agora)).toBe(true)
  })

  it('feita igual ou depois da pedida: aconteceu. Feita de antes dela não vale', () => {
    const { pedida: quando } = pedida(11)
    expect(limpezaPerdida({ pedida: quando, feita: ha(5) }, agora)).toBe(false)
    expect(limpezaPerdida({ pedida: quando, feita: quando }, agora)).toBe(false)
    expect(limpezaPerdida({ pedida: quando, feita: ha(30) }, agora)).toBe(true)
  })

  it('sem pedida, ou só com a feita, não há o que acusar', () => {
    expect(limpezaPerdida({}, agora)).toBe(false)
    expect(limpezaPerdida({ feita: ha(60) }, agora)).toBe(false)
  })

  it('data que não se lê conta como perdida: na dúvida, acorda', () => {
    expect(limpezaPerdida({ pedida: 'ontem' }, agora)).toBe(true)
    expect(limpezaPerdida({ pedida: ha(11), feita: 'ontem' }, agora)).toBe(true)
  })

  it('a limpeza perdida acorda mesmo com o time trabalhando, e guarda o relógio de quem trabalha', () => {
    const trabalhando = decidir({ Mesa: TRABALHANDO }, {}, agora)
    expect(trabalhando.acordar).toBe(false)
    const acordada = comLimpeza(trabalhando, pedida(11), agora)
    expect(acordada.acordar).toBe(true)
    expect(acordada.motivo).toBe(`a limpeza pedida às ${pedida(11).pedida} não aconteceu`)
    expect(acordada.visto).toEqual({ Mesa: agora.toISOString() })
  })

  it('a limpeza em dia deixa a decisão como estava', () => {
    const trabalhando = decidir({ Mesa: TRABALHANDO }, {}, agora)
    expect(comLimpeza(trabalhando, pedida(9), agora)).toEqual(trabalhando)
    expect(comLimpeza(trabalhando, {}, agora)).toEqual(trabalhando)
  })
})

describe('o limpeza.json que não é um objeto acorda, com o motivo dito (M5 da retro da X7)', () => {
  const trabalhando = decidir({ Mesa: TRABALHANDO }, {}, agora)
  const pedida = (minutos: number) => JSON.stringify({ pedida: ha(minutos) })

  it('sem arquivo, ou com o objeto em dia, a decisão fica como estava', () => {
    expect(comLimpezaDoArquivo(trabalhando, null, agora)).toEqual(trabalhando)
    expect(comLimpezaDoArquivo(trabalhando, pedida(9), agora)).toEqual(trabalhando)
    expect(comLimpezaDoArquivo(trabalhando, '{}', agora)).toEqual(trabalhando)
  })

  it('o objeto com a pedida de 11 minutos sem feita acorda, com o motivo da limpeza perdida', () => {
    const acordada = comLimpezaDoArquivo(trabalhando, pedida(11), agora)
    expect(acordada.acordar).toBe(true)
    expect(acordada.motivo).toBe(`a limpeza pedida às ${ha(11)} não aconteceu`)
  })

  it.each([
    { etiqueta: 'nulo', conteudo: 'null' },
    { etiqueta: 'lista', conteudo: '[]' },
    { etiqueta: 'lista com a pedida dentro', conteudo: `[${pedida(60)}]` },
    { etiqueta: 'texto', conteudo: '"ontem"' },
    { etiqueta: 'número', conteudo: '5' },
    { etiqueta: 'verdadeiro', conteudo: 'true' },
  ])('JSON válido que é $etiqueta: acorda com o time trabalhando, e o motivo diz que não é um objeto', ({ conteudo }) => {
    const acordada = comLimpezaDoArquivo(trabalhando, conteudo, agora)
    expect(acordada.acordar).toBe(true)
    expect(acordada.motivo).toBe('.processo/limpeza.json não é um objeto: não dá para saber se a limpeza aconteceu')
    // O relógio de quem trabalha continua guardado, como na limpeza perdida.
    expect(acordada.visto).toEqual(trabalhando.visto)
  })

  it('o que não é JSON acorda, e o motivo diz que não é JSON', () => {
    for (const conteudo of ['{ isto não é json', '', '[1, 2']) {
      const acordada = comLimpezaDoArquivo(trabalhando, conteudo, agora)
      expect(acordada.acordar, conteudo).toBe(true)
      expect(acordada.motivo).toBe('.processo/limpeza.json não é JSON: não dá para saber se a limpeza aconteceu')
    }
  })
})

describe('a vigia como a rotina a roda (RF27)', () => {
  const pastas: string[] = []
  afterAll(() => {
    for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true })
  })

  /** Um repositório com a cópia do `vigia.ts` e um `maestri` falso, que mostra o time trabalhando. */
  function montar(limpeza: object | null): string {
    const raiz = mkdtempSync(join(tmpdir(), 'vigia-'))
    pastas.push(raiz)
    mkdirSync(join(raiz, 'tools/processo'), { recursive: true })
    cpSync(join(RAIZ, 'tools/processo/vigia.ts'), join(raiz, 'tools/processo/vigia.ts'))
    mkdirSync(join(raiz, 'bin'))
    writeFileSync(join(raiz, 'tela.txt'), `${TRABALHANDO}\n`)
    writeFileSync(join(raiz, 'bin/maestri'), `#!/bin/sh\ncase "$1" in\n  list) cat '${FIXTURE_DO_LIST}' ;;\n  check) cat '${join(raiz, 'tela.txt')}' ;;\nesac\n`)
    chmodSync(join(raiz, 'bin/maestri'), 0o755)
    if (limpeza !== null) {
      mkdirSync(join(raiz, '.processo'))
      writeFileSync(join(raiz, '.processo/limpeza.json'), JSON.stringify(limpeza))
    }
    return raiz
  }

  function rodar(raiz: string): string {
    const resultado = spawnSync(process.execPath, [join(raiz, 'tools/processo/vigia.ts')], {
      cwd: raiz,
      env: { ...process.env, PATH: `${join(raiz, 'bin')}:${process.env['PATH'] ?? ''}` },
      encoding: 'utf8',
    })
    expect(resultado.status).toBe(0)
    return resultado.stdout
  }

  const haMinutos = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString()

  it('com o time trabalhando e a limpeza em dia, ou sem arquivo de limpeza, não imprime nada', () => {
    expect(rodar(montar(null))).toBe('')
    expect(rodar(montar({ pedida: haMinutos(9) }))).toBe('')
    expect(rodar(montar({ pedida: haMinutos(11), feita: haMinutos(5) }))).toBe('')
  })

  it('com o time trabalhando e a limpeza pedida há 11 minutos sem feita, imprime /vigia', () => {
    expect(rodar(montar({ pedida: haMinutos(11) }))).toBe('/vigia\n')
  })

  it.each(['null', '[]', '"texto"', '5'])('limpeza.json que é JSON mas não é um objeto (%s) acorda, e não cala', (conteudo) => {
    const raiz = montar(null)
    mkdirSync(join(raiz, '.processo'))
    writeFileSync(join(raiz, '.processo/limpeza.json'), conteudo)
    expect(rodar(raiz)).toBe('/vigia\n')
  })

  it('limpeza.json que não se lê acorda: na dúvida, acorda', () => {
    const raiz = montar(null)
    mkdirSync(join(raiz, '.processo'))
    writeFileSync(join(raiz, '.processo/limpeza.json'), '{ isto não é json')
    expect(rodar(raiz)).toBe('/vigia\n')
  })
})

describe('o início de sessão grava a limpeza feita (RF27)', () => {
  const pastas: string[] = []
  afterAll(() => {
    for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true })
  })

  const ambienteGit: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
  const git = (cwd: string, ...argumentos: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...argumentos], { cwd, env: ambienteGit, stdio: 'pipe' })

  /** O térreo: um checkout principal com o `ROADMAP.md` que o `contexto-inicial.sh` reconhece, e um commit. */
  function terreo(): string {
    const raiz = mkdtempSync(join(tmpdir(), 'limpeza-'))
    pastas.push(raiz)
    git(raiz, 'init', '-q')
    writeFileSync(join(raiz, 'ROADMAP.md'), '# Roadmap\n')
    git(raiz, 'add', 'ROADMAP.md')
    git(raiz, 'commit', '-q', '-m', 'raiz')
    return raiz
  }

  function iniciar(raiz: string, source: string, papel?: string): void {
    const ambiente: NodeJS.ProcessEnv = { ...ambienteGit, CLAUDE_PROJECT_DIR: raiz }
    delete ambiente['CLAUDE_CODE_AGENT']
    if (papel !== undefined) ambiente['CLAUDE_CODE_AGENT'] = papel
    const resultado = spawnSync('bash', [join(RAIZ, '.claude/hooks/contexto-inicial.sh')], { cwd: raiz, env: ambiente, input: JSON.stringify({ source }), encoding: 'utf8' })
    expect(resultado.status).toBe(0)
  }

  const limpezaDe = (raiz: string): Record<string, string> | null => {
    const arquivo = join(raiz, '.processo/limpeza.json')
    return existsSync(arquivo) ? (JSON.parse(readFileSync(arquivo, 'utf8')) as Record<string, string>) : null
  }

  it('source clear, sem papel, no térreo: grava a feita agora e mantém a pedida', () => {
    const raiz = terreo()
    mkdirSync(join(raiz, '.processo'))
    writeFileSync(join(raiz, '.processo/limpeza.json'), JSON.stringify({ pedida: '2026-10-24T10:00:00Z' }))
    const antes = Date.now()
    iniciar(raiz, 'clear')
    const limpeza = limpezaDe(raiz)
    expect(limpeza?.['pedida']).toBe('2026-10-24T10:00:00Z')
    expect(Date.parse(limpeza?.['feita'] ?? '')).toBeGreaterThanOrEqual(antes)
    expect(Date.parse(limpeza?.['feita'] ?? '')).toBeLessThanOrEqual(Date.now())
  })

  it('sem arquivo antes, cria só a feita; arquivo que não se lê é refeito', () => {
    const semArquivo = terreo()
    iniciar(semArquivo, 'clear')
    expect(Object.keys(limpezaDe(semArquivo) ?? {})).toEqual(['feita'])
    // Não é JSON, e é JSON que não é um objeto: lista, nulo e texto.
    for (const conteudo of ['[1, 2', '[1, 2]', 'null', '"texto"']) {
      const estragado = terreo()
      mkdirSync(join(estragado, '.processo'))
      writeFileSync(join(estragado, '.processo/limpeza.json'), conteudo)
      iniciar(estragado, 'clear')
      expect(Object.keys(limpezaDe(estragado) ?? {})).toEqual(['feita'])
    }
  })

  it('a feita vai para o .processo do térreo (CLAUDE_PROJECT_DIR), mesmo com o hook chamado de outra pasta (M5 da retro da X7)', () => {
    const raiz = terreo()
    const fora = mkdtempSync(join(tmpdir(), 'hook-de-fora-'))
    pastas.push(fora)
    mkdirSync(join(raiz, '.processo'))
    writeFileSync(join(raiz, '.processo/limpeza.json'), JSON.stringify({ pedida: '2026-10-24T10:00:00Z' }))
    const ambiente: NodeJS.ProcessEnv = { ...ambienteGit, CLAUDE_PROJECT_DIR: raiz }
    delete ambiente['CLAUDE_CODE_AGENT']
    const resultado = spawnSync('bash', [join(RAIZ, '.claude/hooks/contexto-inicial.sh')], { cwd: fora, env: ambiente, input: JSON.stringify({ source: 'clear' }), encoding: 'utf8' })
    expect(resultado.status).toBe(0)
    expect(Object.keys(limpezaDe(raiz) ?? {}).sort()).toEqual(['feita', 'pedida'])
    expect(existsSync(join(fora, '.processo'))).toBe(false)
  })

  it('com papel: não grava', () => {
    const raiz = terreo()
    iniciar(raiz, 'clear', 'mesa-de-revisao')
    expect(limpezaDe(raiz)).toBeNull()
  })

  it.each(['startup', 'compact', 'resume'])('source %s: não grava', (source) => {
    const raiz = terreo()
    iniciar(raiz, source)
    expect(limpezaDe(raiz)).toBeNull()
  })

  it('fora do térreo, num andar (worktree) do mesmo repositório: não grava', () => {
    const raiz = terreo()
    const andar = `${raiz}-andar`
    pastas.push(andar)
    git(raiz, 'worktree', 'add', '-q', '-b', 'spec/x', andar)
    iniciar(andar, 'clear')
    expect(limpezaDe(andar)).toBeNull()
    expect(readdirSync(raiz)).not.toContain('.processo')
  })

  it('fora de um repositório git: não grava', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'sem-git-'))
    pastas.push(raiz)
    writeFileSync(join(raiz, 'ROADMAP.md'), '# Roadmap\n')
    iniciar(raiz, 'clear')
    expect(limpezaDe(raiz)).toBeNull()
  })
})

describe('o comando da limpeza grava a pedida que a vigia lê (RF27)', () => {
  /** O bloco `bash` do passo que tem o comando da limpeza, como o Orquestrador o copia. */
  function comandoDo(passo: string): string {
    const texto = readFileSync(join(RAIZ, `.claude/skills/seguir/passos/${passo}`), 'utf8')
    const blocos = [...texto.matchAll(/```bash\n([\s\S]*?)```/g)].map((achado) => achado[1] ?? '').filter((bloco) => bloco.includes('Limpa o Orquestrador'))
    expect(blocos).toHaveLength(1)
    return (blocos[0] ?? '').trim()
  }

  /** Roda o comando do passo em `cwd`, com um `maestri` falso (em `bin/` do térreo) que só anota o que recebeu. */
  async function rodarOComando(passo: string, terreo: string, cwd: string) {
    const marca = join(terreo, 'disparou.txt')
    // O disparo é um processo solto (`nohup setsid … &`) que escreve a marca no térreo: o helper só devolve com ele terminado, e nenhum caso
    // apaga o térreo debaixo dele (ENOTEMPTY na esteira 40133872609). A marca de uma rodada anterior sai, para a espera ser desta.
    rmSync(marca, { force: true })
    mkdirSync(join(terreo, 'bin'), { recursive: true })
    writeFileSync(join(terreo, 'bin/maestri'), `#!/bin/sh\necho "$@" > '${marca}'\n`)
    chmodSync(join(terreo, 'bin/maestri'), 0o755)
    // O `sleep 25` é a espera do turno acabar: aqui não há turno.
    // O ambiente do git de quem roda o teste (dentro de um hook do git, `GIT_DIR` e `GIT_WORK_TREE` apontam o repositório real) não entra:
    // o `git rev-parse` do comando responde pelo `cwd`, e a pedida não pode ir parar no `.processo` do térreo de verdade.
    const resultado = spawnSync('sh', ['-c', comandoDo(passo).replace('sleep 25', 'sleep 0')], { cwd, env: { ...ambienteSemOGitDeFora(), PATH: `${join(terreo, 'bin')}:${process.env['PATH'] ?? ''}` }, encoding: 'utf8' })
    await esperar(marca)
    return { resultado, marca }
  }
  const VARIAVEIS_DO_GIT_DE_FORA = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_OBJECT_DIRECTORY']
  /** O ambiente do teste sem as variáveis que apontam um repositório: o `git` do comando e o do preparo respondem pelo `cwd`. */
  function ambienteSemOGitDeFora(): NodeJS.ProcessEnv {
    const herdado = Object.entries(process.env).filter(([nome]) => !VARIAVEIS_DO_GIT_DE_FORA.includes(nome))
    return { ...Object.fromEntries(herdado), GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
  }
  const ambienteGit = ambienteSemOGitDeFora()
  const git = (cwd: string, ...argumentos: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...argumentos], { cwd, env: ambienteGit, stdio: 'pipe' })
  afterEach(() => {
    vi.unstubAllEnvs()
  })
  const esperar = async (arquivo: string) => {
    // Com conteúdo: o `echo > marca` cria o arquivo e escreve em dois passos.
    const chegou = () => existsSync(arquivo) && readFileSync(arquivo, 'utf8').length > 0
    for (let tentativa = 0; tentativa < 50 && !chegou(); tentativa++) await new Promise((resolver) => setTimeout(resolver, 100))
    // Sem a marca o disparo não aconteceu (ou atrasou além do prazo): falha aqui, com o caminho, e não como ENOTEMPTY no `rmSync` do `finally`.
    if (!chegou()) throw new Error(`a rotina não disparou em 5 s: sem conteúdo em ${arquivo}`)
  }

  it.each(['6-tarefa.md', '9-vigia-e-contexto.md'])('%s: de dentro de um andar (worktree), a pedida vai para o térreo, que é onde a vigia lê, e não para o andar', async (passo) => {
    const terreo = mkdtempSync(join(tmpdir(), 'comando-terreo-'))
    const andar = `${terreo}-andar`
    try {
      git(terreo, 'init', '-q')
      writeFileSync(join(terreo, 'README.md'), '# x\n')
      git(terreo, 'add', 'README.md')
      git(terreo, 'commit', '-q', '-m', 'raiz')
      git(terreo, 'worktree', 'add', '-q', '-b', 'spec/x', andar)
      mkdirSync(join(andar, 'pasta'))
      // Do andar e de uma pasta dentro dele: o comando acha o térreo pelo git, e não pelo diretório em que o Bash está.
      for (const cwd of [andar, join(andar, 'pasta')]) {
        rmSync(join(terreo, '.processo'), { recursive: true, force: true })
        const { resultado, marca } = await rodarOComando(passo, terreo, cwd)
        expect(resultado.status).toBe(0)
        const limpeza = JSON.parse(readFileSync(join(terreo, '.processo/limpeza.json'), 'utf8')) as { pedida: string }
        expect(Object.keys(limpeza)).toEqual(['pedida'])
        expect(existsSync(join(andar, '.processo'))).toBe(false)
        expect(existsSync(join(andar, 'pasta/.processo'))).toBe(false)
        expect(readFileSync(marca, 'utf8').trim()).toBe('routine run Limpa o Orquestrador')
      }
    } finally {
      git(terreo, 'worktree', 'remove', '--force', andar)
      rmSync(terreo, { recursive: true, force: true })
    }
  })

  it('rodarOComando só devolve com a rotina já disparada: o térreo não é apagado debaixo do processo em segundo plano', async () => {
    const terreo = mkdtempSync(join(tmpdir(), 'comando-espera-'))
    try {
      git(terreo, 'init', '-q')
      // O disparo é um `nohup setsid … &`: sobrevive ao comando e escreve a marca no térreo. Quem apaga o térreo antes dele (o `finally` dos casos)
      // corre contra essa escrita, e o `rmSync` falha com ENOTEMPTY (esteira 40133872609).
      const { marca } = await rodarOComando('9-vigia-e-contexto.md', terreo, terreo)
      expect(readFileSync(marca, 'utf8').trim()).toBe('routine run Limpa o Orquestrador')
    } finally {
      rmSync(terreo, { recursive: true, force: true })
    }
  })

  it.each(['6-tarefa.md', '9-vigia-e-contexto.md'])('%s: com GIT_DIR e GIT_WORK_TREE de outro repositório no ambiente de quem roda, a pedida vai para o térreo do teste', async (passo) => {
    const terreo = mkdtempSync(join(tmpdir(), 'comando-git-de-fora-'))
    const intruso = mkdtempSync(join(tmpdir(), 'comando-intruso-'))
    try {
      git(terreo, 'init', '-q')
      git(intruso, 'init', '-q')
      // Dentro de um hook do git o ambiente é este: o repositório "de verdade" é o do `GIT_DIR`, qualquer que seja o `cwd`.
      vi.stubEnv('GIT_DIR', join(intruso, '.git'))
      vi.stubEnv('GIT_WORK_TREE', intruso)
      const { resultado } = await rodarOComando(passo, terreo, terreo)
      expect(resultado.status).toBe(0)
      expect(existsSync(join(terreo, '.processo/limpeza.json'))).toBe(true)
      expect(existsSync(join(intruso, '.processo'))).toBe(false)
    } finally {
      rmSync(terreo, { recursive: true, force: true })
      rmSync(intruso, { recursive: true, force: true })
    }
  })

  it.each(['6-tarefa.md', '9-vigia-e-contexto.md'])('%s: fora de um repositório não grava pedida em lugar nenhum, e a rotina é disparada mesmo assim', async (passo) => {
    const raiz = mkdtempSync(join(tmpdir(), 'comando-sem-git-'))
    try {
      // Sem o git o caminho da âncora viraria `/../.processo`, a raiz do disco: um `mkdir` falso, na frente do PATH, diz se o comando chegou
      // a tentar criá-lo (o `&&` depois do `git rev-parse` é o que o impede), sem que o teste escreva em lugar nenhum.
      mkdirSync(join(raiz, 'bin'))
      writeFileSync(join(raiz, 'bin/mkdir'), `#!/bin/sh\necho "$@" >> '${join(raiz, 'mkdir.log')}'\n`)
      chmodSync(join(raiz, 'bin/mkdir'), 0o755)
      const { resultado, marca } = await rodarOComando(passo, raiz, raiz)
      // A âncora é o git: sem ele não há onde gravar. O `/clear` não depende da pedida, e por isso a rotina segue.
      expect(resultado.status).toBe(0)
      expect(existsSync(join(raiz, 'mkdir.log'))).toBe(false)
      expect(existsSync(join(raiz, '.processo'))).toBe(false)
      expect(readFileSync(marca, 'utf8').trim()).toBe('routine run Limpa o Orquestrador')
    } finally {
      rmSync(raiz, { recursive: true, force: true })
    }
  })

  it.each(['6-tarefa.md', '9-vigia-e-contexto.md'])('%s: roda no térreo, grava a pedida de agora e dispara a rotina', async (passo) => {
    const raiz = mkdtempSync(join(tmpdir(), 'comando-'))
    try {
      git(raiz, 'init', '-q')
      const antes = Date.now()
      const { resultado } = await rodarOComando(passo, raiz, raiz)
      expect(resultado.status).toBe(0)
      const limpeza = JSON.parse(readFileSync(join(raiz, '.processo/limpeza.json'), 'utf8')) as { pedida: string; feita?: string }
      expect(Object.keys(limpeza)).toEqual(['pedida'])
      // A data tem a precisão de segundo do `date`: cabe numa janela de um segundo antes do comando e de um minuto depois.
      expect(Date.parse(limpeza.pedida)).toBeGreaterThanOrEqual(antes - 1000)
      expect(Date.parse(limpeza.pedida)).toBeLessThanOrEqual(Date.now())
      // E é o que a vigia lê: em dia agora, perdida onze minutos depois.
      expect(limpezaPerdida(limpeza, new Date())).toBe(false)
      expect(limpezaPerdida(limpeza, new Date(Date.now() + 11 * 60_000))).toBe(true)
      expect(readFileSync(join(raiz, 'disparou.txt'), 'utf8').trim()).toBe('routine run Limpa o Orquestrador')
    } finally {
      rmSync(raiz, { recursive: true, force: true })
    }
  })
})
